import { useCallback, useEffect, useRef, useState } from 'react';
import { useSchool } from '../context/SchoolContext';
import { DailyAttendanceRecord, PortalRole, SecurityGatepassLog, StaffAccount, StaffAttendanceRecord } from '../types';
import { getStudentPortalId } from '../utils/bengali';
import { parseJsonApiResponse } from '../utils/apiResponse';
import {
  AudioDiagnosticEvent,
  buildGuardianVoiceMessage,
  getGuardianAudioStatus,
  getRecentAudioDiagnosticEvents,
  playAlarmChime,
  playGuardianAttentionBell,
  prewarmGuardianVoiceCache,
  setGuardianLiveWatchActive,
  setPendingBlockedSpeech,
  showGuardianSystemNotification,
  speakRepeatedGuardianAlert,
  stopBengaliSpeech,
  subscribeAudioDiagnosticEvents,
  subscribeMobileAudioUnlock,
  unlockMobileAudioAndSpeech,
} from '../utils/gatepassAudio';

// Shared dedup sets (synced with sessionStorage):
// 1) seenGatepassLogIds: tracks logs merged into React state (used across Official/Employee/Student roles)
// 2) playedGuardianVoiceLogIds: strictly tracks logs that ACTUALLY fired a guardian smartphone voice alert
// Separating these ensures background Official/Employee syncing never silences a Guardian Portal alert!
const SEEN_LOGS_STORAGE_KEY = 'dlikon_seen_gatepass_log_ids_v1';
const PLAYED_GUARDIAN_VOICE_KEY = 'dlikon_played_guardian_voice_ids_v1';

function readSessionIdSet(key: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeSessionIdSet(key: string, setObj: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    const recent = Array.from(setObj).slice(-200);
    sessionStorage.setItem(key, JSON.stringify(recent));
  } catch {
    // Ignore storage quota errors
  }
}

export const seenGatepassLogIds = new Set<string>(readSessionIdSet(SEEN_LOGS_STORAGE_KEY));
export const playedGuardianVoiceLogIds = new Set<string>(readSessionIdSet(PLAYED_GUARDIAN_VOICE_KEY));

export function markGatepassLogSeen(id: string): void {
  if (!id) return;
  seenGatepassLogIds.add(id);
  writeSessionIdSet(SEEN_LOGS_STORAGE_KEY, seenGatepassLogIds);
}

export function hasPlayedGuardianVoiceLog(id: string): boolean {
  if (!id) return false;
  return playedGuardianVoiceLogIds.has(id);
}

export function markGuardianVoiceLogPlayed(id: string): void {
  if (!id) return;
  playedGuardianVoiceLogIds.add(id);
  writeSessionIdSet(PLAYED_GUARDIAN_VOICE_KEY, playedGuardianVoiceLogIds);
}

export const GUARDIAN_AUDIO_PREF_KEY = 'dlikon_guardian_audio_enabled';
export const GATEPASS_BROADCAST_CHANNEL = 'dlikon_gatepass_live';

export function isGuardianAudioEnabledPref(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(GUARDIAN_AUDIO_PREF_KEY) !== 'false';
}

export function setGuardianAudioEnabledPref(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(GUARDIAN_AUDIO_PREF_KEY, enabled ? 'true' : 'false');
  window.dispatchEvent(new CustomEvent('dlikon:guardian-audio-pref', { detail: enabled }));
}

export function broadcastLocalGatepassScan(log: SecurityGatepassLog): void {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
  try {
    const ch = new BroadcastChannel(GATEPASS_BROADCAST_CHANNEL);
    ch.postMessage({ type: 'gatepass:scan', log, serverTime: Date.now() });
    ch.close();
  } catch {
    // Ignore BroadcastChannel errors
  }
}

export function broadcastLocalStaffAttendance(
  record: StaffAttendanceRecord,
  action: 'checkin' | 'checkout',
  summary?: { totalStaffCount?: number; presentCount?: number; pendingCount?: number }
): void {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
  try {
    const ch = new BroadcastChannel(GATEPASS_BROADCAST_CHANNEL);
    ch.postMessage({
      type: 'staff:attendance',
      action,
      record,
      totalStaffCount: summary?.totalStaffCount,
      presentCount: summary?.presentCount,
      pendingCount: summary?.pendingCount,
      serverTime: Date.now(),
    });
    ch.close();
  } catch {
    // Ignore BroadcastChannel errors
  }
}

export function broadcastLocalDailyAttendance(record: DailyAttendanceRecord): void {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window) || !record?.id) return;
  try {
    const ch = new BroadcastChannel(GATEPASS_BROADCAST_CHANNEL);
    ch.postMessage({
      type: 'attendance:updated',
      attendanceRecord: record,
      serverTime: Date.now(),
    });
    ch.close();
  } catch {
    // Ignore BroadcastChannel errors
  }
}

interface UseGatepassRealtimeParams {
  role?: PortalRole | null;
  studentId?: string | null;
  portalId?: string | null;
  classId?: string | null;
  roll?: number | null;
  enabled?: boolean;
}

export type RealtimeTransportMode = 'ws' | 'sse' | 'polling' | 'connecting';
export type RealtimeSyncHealth =
  | 'connecting'
  | 'verified_ws'
  | 'verified_sse'
  | 'verified_polling'
  | 'auth_redirect'
  | 'static_host'
  | 'unreachable';

export type WebSocketReadyStateLabel =
  | 'CONNECTING'
  | 'OPEN'
  | 'CLOSING'
  | 'CLOSED'
  | 'UNINITIALIZED'
  | 'UNSUPPORTED';

export type DiagnosticLogSource = 'WS' | 'SSE' | 'POLL' | 'SIGNAL' | 'AUDIO' | 'TRIGGER' | 'BC';
export type DiagnosticLogLevel = 'info' | 'ok' | 'warn' | 'error';

export interface RealtimeDiagnosticEntry {
  id: string;
  at: number;
  source: DiagnosticLogSource;
  level: DiagnosticLogLevel;
  message: string;
  latencyMs?: number | null;
  detail?: string;
}

export interface GatepassRealtimeDiagnostics {
  wsReadyState: WebSocketReadyStateLabel;
  wsUrl: string;
  wsReconnectAttempts: number;
  wsLastOpenAt: number | null;
  wsLastCloseCode: number | null;
  wsLastCloseReason: string | null;
  sseReadyState: 'CONNECTING' | 'OPEN' | 'CLOSED' | 'UNINITIALIZED';
  lastSignalLatencyMs: number | null;
  lastScanLatencyMs: number | null;
  lastPingRttMs: number | null;
  lastSignalType: string | null;
  lastSignalAt: number | null;
  lastSignalTransport: 'ws' | 'sse' | 'polling' | 'broadcast' | 'firestore' | null;
  clockOffsetMs: number | null;
  connectedHost: string;
  serverInstanceId: string;
  notificationPermission: NotificationPermission | 'unsupported';
  logs: RealtimeDiagnosticEntry[];
}

function mapWsReadyState(readyState: number | undefined): WebSocketReadyStateLabel {
  switch (readyState) {
    case 0:
      return 'CONNECTING';
    case 1:
      return 'OPEN';
    case 2:
      return 'CLOSING';
    case 3:
      return 'CLOSED';
    default:
      return 'UNINITIALIZED';
  }
}

export function useGatepassRealtime({
  role,
  studentId,
  portalId,
  classId,
  roll,
  enabled = true,
}: UseGatepassRealtimeParams) {
  const {
    students,
    schoolInfo,
    securityLogs,
    addSecurityLog,
    upsertAttendanceRecordFromServer,
    pullCloudSecurityLogsNow,
    setStaffAccountsList,
    setStaffLeavesList,
    recordRealtimeStaffAttendance,
  } = useSchool();
  const [liveRingingAlert, setLiveRingingAlert] = useState<{
    log: SecurityGatepassLog;
    message: string;
  } | null>(null);
  const [connectionTransport, setConnectionTransport] =
    useState<RealtimeTransportMode>('connecting');
  const [syncHealth, setSyncHealth] = useState<RealtimeSyncHealth>('connecting');
  const [lastSyncServerTime, setLastSyncServerTime] = useState<number>(0);
  const [serverInstanceId, setServerInstanceId] = useState<string>('');
  const [reconnectNonce, setReconnectNonce] = useState<number>(0);

  // Live Diagnostic State
  const [wsReadyState, setWsReadyState] = useState<WebSocketReadyStateLabel>('UNINITIALIZED');
  const [wsUrl, setWsUrl] = useState<string>('');
  const [wsReconnectAttemptsState, setWsReconnectAttemptsState] = useState<number>(0);
  const [wsLastOpenAt, setWsLastOpenAt] = useState<number | null>(null);
  const [wsLastCloseCode, setWsLastCloseCode] = useState<number | null>(null);
  const [wsLastCloseReason, setWsLastCloseReason] = useState<string | null>(null);
  const [sseReadyState, setSseReadyState] = useState<
    'CONNECTING' | 'OPEN' | 'CLOSED' | 'UNINITIALIZED'
  >('UNINITIALIZED');
  const [lastSignalLatencyMs, setLastSignalLatencyMs] = useState<number | null>(null);
  const [lastScanLatencyMs, setLastScanLatencyMs] = useState<number | null>(null);
  const [lastPingRttMs, setLastPingRttMs] = useState<number | null>(null);
  const [lastSignalType, setLastSignalType] = useState<string | null>(null);
  const [lastSignalAt, setLastSignalAt] = useState<number | null>(null);
  const [lastSignalTransport, setLastSignalTransport] = useState<
    'ws' | 'sse' | 'polling' | 'broadcast' | 'firestore' | null
  >(null);
  const [clockOffsetMs, setClockOffsetMs] = useState<number | null>(null);
  const [diagnosticLogs, setDiagnosticLogs] = useState<RealtimeDiagnosticEntry[]>(() =>
    getRecentAudioDiagnosticEvents().map((ev) => ({
      id: ev.id,
      at: ev.at,
      source: 'AUDIO' as const,
      level: ev.level,
      message: ev.message,
      detail: ev.detail,
    }))
  );

  const appendDiagnosticLog = useCallback(
    (
      source: DiagnosticLogSource,
      level: DiagnosticLogLevel,
      message: string,
      opts?: { latencyMs?: number | null; detail?: string; at?: number; id?: string }
    ) => {
      const entry: RealtimeDiagnosticEntry = {
        id: opts?.id || `diag_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        at: opts?.at || Date.now(),
        source,
        level,
        message,
        latencyMs: opts?.latencyMs ?? null,
        detail: opts?.detail,
      };
      setDiagnosticLogs((prev) => {
        if (prev.some((p) => p.id === entry.id)) return prev;
        const head = prev[0];
        if (
          head &&
          head.source === entry.source &&
          head.level === entry.level &&
          head.message === entry.message
        ) {
          const updatedHead: RealtimeDiagnosticEntry = {
            ...head,
            at: entry.at,
            latencyMs: entry.latencyMs ?? head.latencyMs,
            detail: entry.detail ?? head.detail,
          };
          return [updatedHead, ...prev.slice(1, 20)];
        }
        return [entry, ...prev].slice(0, 20);
      });
    },
    []
  );

  useEffect(() => {
    const mapAudioEvent = (ev: AudioDiagnosticEvent) => {
      appendDiagnosticLog('AUDIO', ev.level, ev.message, {
        at: ev.at,
        id: ev.id,
        detail: ev.detail,
      });
    };
    const unsub = subscribeAudioDiagnosticEvents(mapAudioEvent);
    return unsub;
  }, [appendDiagnosticLog]);

  const studentsRef = useRef(students);
  studentsRef.current = students;

  const scheduleRef = useRef(schoolInfo.dailySchedule);
  scheduleRef.current = schoolInfo.dailySchedule;

  const schoolNameRef = useRef(schoolInfo.name);
  schoolNameRef.current = schoolInfo.name;

  const clockOffsetRef = useRef<number | null>(null);
  clockOffsetRef.current = clockOffsetMs;

  const activeWsRef = useRef<WebSocket | null>(null);
  const lastServerTimeRef = useRef<number>(0);
  const prevServerInstanceIdRef = useRef<string>('');
  const hasBaselineRef = useRef<boolean>(false);
  const hasContextLogsBaselineRef = useRef<boolean>(false);
  const ringClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resolvedStudent = students.find(
    (s) =>
      (studentId && s.id === studentId) ||
      (portalId && getStudentPortalId(s).toUpperCase() === portalId.trim().toUpperCase()) ||
      (classId && roll && s.classId === classId && Number(s.roll) === Number(roll))
  );
  const effectiveStudentId = resolvedStudent?.id || studentId || '';
  const effectivePortalId =
    portalId?.trim().toUpperCase() ||
    (resolvedStudent ? getStudentPortalId(resolvedStudent).toUpperCase() : '');
  const effectiveClassId = resolvedStudent?.classId || classId || '';
  const effectiveRoll =
    resolvedStudent?.roll ?? (typeof roll === 'number' && !Number.isNaN(roll) && roll > 0 ? roll : null);

  const effectiveClassIdRef = useRef<string>(effectiveClassId);
  effectiveClassIdRef.current = effectiveClassId;
  const effectiveRollRef = useRef<number | null>(effectiveRoll);
  effectiveRollRef.current = effectiveRoll;

  // Dynamically update server subscription when classId/roll hydrate after initial WS open without resetting baseline
  useEffect(() => {
    const ws = activeWsRef.current;
    if (!enabled || !role || !ws || ws.readyState !== WebSocket.OPEN) return;
    if (!effectiveClassId && !effectiveRoll) return;
    try {
      ws.send(
        JSON.stringify({
          type: 'subscribe',
          role,
          studentId: effectiveStudentId,
          portalId: effectivePortalId,
          classId: effectiveClassId,
          roll: effectiveRoll,
        })
      );
    } catch {
      // Ignore send race
    }
  }, [enabled, role, effectiveStudentId, effectivePortalId, effectiveClassId, effectiveRoll]);

  const isMatchingStudentLog = useCallback(
    (log: SecurityGatepassLog | null | undefined): boolean => {
      if (!log) return false;
      if (effectiveStudentId && log.studentId === effectiveStudentId) return true;
      const logPortal = (log.portalUserId || '').trim().toUpperCase();
      if (effectivePortalId && logPortal && logPortal === effectivePortalId) return true;
      if (
        effectiveClassId &&
        effectiveRoll &&
        log.classId &&
        log.classId === effectiveClassId &&
        Number(log.studentRoll) === Number(effectiveRoll)
      ) {
        return true;
      }
      const currentStd =
        studentsRef.current.find(
          (s) =>
            (effectiveStudentId && s.id === effectiveStudentId) ||
            (effectivePortalId && getStudentPortalId(s).toUpperCase() === effectivePortalId)
        ) || null;
      if (
        currentStd &&
        log.classId &&
        log.classId === currentStd.classId &&
        Number(log.studentRoll) === Number(currentStd.roll)
      ) {
        return true;
      }
      return false;
    },
    [effectiveStudentId, effectivePortalId, effectiveClassId, effectiveRoll]
  );

  const triggerAlertForStudent = useCallback(
    (log: SecurityGatepassLog, viaTransport?: 'ws' | 'sse' | 'polling' | 'broadcast' | 'firestore') => {
      if (role !== 'student' || !isMatchingStudentLog(log)) return;
      if (hasPlayedGuardianVoiceLog(log.id)) {
        appendDiagnosticLog('TRIGGER', 'info', `গেটপাস ${log.action === 'exit' ? 'প্রস্থান' : 'প্রবেশ'} আগে থেকেই প্লে করা হয়েছে (deduped)`, {
          detail: `logId=${log.id}`,
        });
        return;
      }
      markGuardianVoiceLogPlayed(log.id);

      const targetStudent =
        studentsRef.current.find(
          (s) =>
            s.id === (effectiveStudentId || log.studentId) ||
            (effectivePortalId && getStudentPortalId(s).toUpperCase() === effectivePortalId) ||
            (effectiveClassId &&
              effectiveRoll &&
              s.classId === effectiveClassId &&
              Number(s.roll) === Number(effectiveRoll))
        ) ||
        ({ id: effectiveStudentId || log.studentId, nameBn: log.studentNameBn || 'আপনার সন্তান' } as any);

      const action: 'entry' | 'exit' = log.action === 'exit' ? 'exit' : 'entry';
      const currentSchedule = scheduleRef.current;
      const message = buildGuardianVoiceMessage(targetStudent, action, currentSchedule);

      setLiveRingingAlert({ log, message });
      if (ringClearTimerRef.current) clearTimeout(ringClearTimerRef.current);
      ringClearTimerRef.current = setTimeout(() => {
        setLiveRingingAlert(null);
      }, 65000);

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate([320, 120, 320, 120, 520]);
        } catch {
          // Ignore
        }
      }

      if (!isGuardianAudioEnabledPref()) {
        appendDiagnosticLog(
          'TRIGGER',
          'warn',
          'অভিভাবক অডিও মিউট করা থাকায় ভয়েস স্বয়ংক্রিয়ভাবে বাজেনি',
          { detail: `student=${targetStudent.nameBn}, via=${viaTransport || 'realtime'}` }
        );
        setPendingBlockedSpeech({
          message,
          logId: log.id,
          studentNameBn: targetStudent.nameBn,
          action,
          dailySchedule: currentSchedule,
        });
        return;
      }

      appendDiagnosticLog(
        'TRIGGER',
        'ok',
        `${targetStudent.nameBn}-এর জন্য গেটপাস ভয়েস এলার্ম ট্রিগার হয়েছে`,
        { detail: `action=${action}, via=${viaTransport || 'realtime'}, logId=${log.id}` }
      );

      playGuardianAttentionBell();
      showGuardianSystemNotification(
        `${schoolNameRef.current || 'ডি-লিকন একাডেমী'} • ${targetStudent.nameBn}`,
        message
      );

      speakRepeatedGuardianAlert(targetStudent, action, currentSchedule, {
        repeatCount: 6,
        delayMs: 180,
        onBlocked: () => {
          const hw = getGuardianAudioStatus();
          if (hw.audioContextState === 'running') {
            playAlarmChime();
          }
          appendDiagnosticLog(
            'TRIGGER',
            'error',
            'ভয়েস অটোপ্লে ব্রাউজার দ্বারা বাধাপ্রাপ্ত হয়েছে বা ভয়েস ইঞ্জিন ব্যর্থ',
            { detail: `logId=${log.id}, ctx=${hw.audioContextState}` }
          );
          setPendingBlockedSpeech({
            message,
            logId: log.id,
            studentNameBn: targetStudent.nameBn,
            action,
            dailySchedule: currentSchedule,
          });
        },
      });
    },
    [
      role,
      effectiveStudentId,
      effectivePortalId,
      effectiveClassId,
      effectiveRoll,
      isMatchingStudentLog,
      appendDiagnosticLog,
    ]
  );

  const isMatchingStudentLogRef = useRef(isMatchingStudentLog);
  isMatchingStudentLogRef.current = isMatchingStudentLog;
  const triggerAlertForStudentRef = useRef(triggerAlertForStudent);
  triggerAlertForStudentRef.current = triggerAlertForStudent;
  const appendDiagnosticLogRef = useRef(appendDiagnosticLog);
  appendDiagnosticLogRef.current = appendDiagnosticLog;
  const addSecurityLogRef = useRef(addSecurityLog);
  addSecurityLogRef.current = addSecurityLog;
  const upsertAttendanceRecordFromServerRef = useRef(upsertAttendanceRecordFromServer);
  upsertAttendanceRecordFromServerRef.current = upsertAttendanceRecordFromServer;
  const pullCloudSecurityLogsNowRef = useRef(pullCloudSecurityLogsNow);
  pullCloudSecurityLogsNowRef.current = pullCloudSecurityLogsNow;
  const setStaffAccountsListRef = useRef(setStaffAccountsList);
  setStaffAccountsListRef.current = setStaffAccountsList;
  const setStaffLeavesListRef = useRef(setStaffLeavesList);
  setStaffLeavesListRef.current = setStaffLeavesList;
  const recordRealtimeStaffAttendanceRef = useRef(recordRealtimeStaffAttendance);
  recordRealtimeStaffAttendanceRef.current = recordRealtimeStaffAttendance;

  // Pre-warm Bengali voice MP3 cache so incoming alerts play instantaneously (0ms fetch delay)
  useEffect(() => {
    if (!enabled || role !== 'student' || !resolvedStudent) return;
    const timer = setTimeout(() => {
      void prewarmGuardianVoiceCache(resolvedStudent, schoolInfo.dailySchedule);
    }, 500);
    const unsubUnlock = subscribeMobileAudioUnlock((unlocked) => {
      if (unlocked) {
        void prewarmGuardianVoiceCache(resolvedStudent, schoolInfo.dailySchedule);
      }
    });
    return () => {
      clearTimeout(timer);
      unsubUnlock();
    };
  }, [enabled, role, resolvedStudent?.id, resolvedStudent?.nameBn, schoolInfo.dailySchedule]);

  // Unlock mobile audio strictly on real tap/click activation gestures (never false-positive passive scroll)
  useEffect(() => {
    if (!enabled || role !== 'student' || typeof window === 'undefined') return;

    const handleActivationGesture = () => {
      unlockMobileAudioAndSpeech(true);
      if (isGuardianAudioEnabledPref()) {
        setGuardianLiveWatchActive(true);
      }
    };

    window.addEventListener('click', handleActivationGesture, { capture: true, passive: true });
    window.addEventListener('touchend', handleActivationGesture, { capture: true, passive: true });
    window.addEventListener('keydown', handleActivationGesture, { capture: true, passive: true });

    return () => {
      window.removeEventListener('click', handleActivationGesture, { capture: true });
      window.removeEventListener('touchend', handleActivationGesture, { capture: true });
      window.removeEventListener('keydown', handleActivationGesture, { capture: true });
    };
  }, [enabled, role]);

  // Reset context log baseline whenever signed-in student changes
  useEffect(() => {
    hasContextLogsBaselineRef.current = false;
  }, [effectiveStudentId, effectivePortalId]);

  // React to securityLogs changes in SchoolContext (handles Cloud Firestore onSnapshot & /api/school-data cross-device bridge)
  useEffect(() => {
    if (!enabled || role !== 'student') return;
    if (!effectiveStudentId && !effectivePortalId && !(effectiveClassId && effectiveRoll)) return;

    const hasServerClock = clockOffsetRef.current !== null;
    const nowMs = Date.now() + (clockOffsetRef.current ?? 0);
    const matchingLogs = securityLogs.filter((l) => isMatchingStudentLog(l));

    const baselineWindowMs = hasServerClock ? 5 * 60 * 1000 : 30 * 60 * 1000;
    if (!hasContextLogsBaselineRef.current) {
      hasContextLogsBaselineRef.current = true;
      let newestRecentUnseen: SecurityGatepassLog | null = null;
      for (const item of matchingLogs) {
        if (!item?.id) continue;
        markGatepassLogSeen(item.id);
        if (!hasPlayedGuardianVoiceLog(item.id)) {
          const logMs =
            typeof item.serverTimestamp === 'number'
              ? item.serverTimestamp
              : new Date(item.timestamp).getTime() || 0;
          if (logMs >= nowMs - baselineWindowMs && !item.guardianAcknowledged) {
            if (!newestRecentUnseen) {
              newestRecentUnseen = item;
            }
          } else if (item.guardianAcknowledged || (hasServerClock && logMs < nowMs - 60 * 60 * 1000)) {
            markGuardianVoiceLogPlayed(item.id);
          }
        }
      }
      if (newestRecentUnseen) {
        triggerAlertForStudent(newestRecentUnseen, 'firestore');
      }
      return;
    }

    let freshUnplayed: SecurityGatepassLog | null = null;
    for (const item of matchingLogs) {
      if (!item?.id) continue;
      markGatepassLogSeen(item.id);
      if (!hasPlayedGuardianVoiceLog(item.id)) {
        const logMs =
          typeof item.serverTimestamp === 'number'
            ? item.serverTimestamp
            : new Date(item.timestamp).getTime() || 0;
        const postBaselineWindowMs = hasServerClock ? 20 * 60 * 1000 : 2 * 60 * 60 * 1000;
        // Post-baseline newly arrived logs: generous window prevents phone-clock skew from silencing live scans
        if (logMs >= nowMs - postBaselineWindowMs && !item.guardianAcknowledged) {
          if (!freshUnplayed) {
            freshUnplayed = item;
          }
        } else if (item.guardianAcknowledged || (hasServerClock && logMs < nowMs - 60 * 60 * 1000)) {
          markGuardianVoiceLogPlayed(item.id);
        }
      }
    }
    if (freshUnplayed) {
      triggerAlertForStudent(freshUnplayed, 'firestore');
    }
  }, [
    enabled,
    role,
    securityLogs,
    effectiveStudentId,
    effectivePortalId,
    effectiveClassId,
    effectiveRoll,
    isMatchingStudentLog,
    triggerAlertForStudent,
  ]);

  useEffect(() => {
    if (!enabled || !role) return;
    if (role === 'student' && !effectiveStudentId && !effectivePortalId && !(effectiveClassId && effectiveRoll)) {
      return;
    }

    hasBaselineRef.current = false;
    lastServerTimeRef.current = 0;
    setConnectionTransport('connecting');
    setSyncHealth('connecting');
    setWsReconnectAttemptsState(0);

    let isDisposed = false;
    let ws: WebSocket | null = null;
    let sse: EventSource | null = null;
    let wsConnected = false;
    let sseConnected = false;
    let pollVerified = false;
    let staticHostDetected = false;
    let consecutivePollFailures = 0;
    let wsReconnectAttempts = 0;
    let wsLoggedFallbackNote = false;
    let sseLoggedWarnNote = false;
    let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let wsPingTimer: ReturnType<typeof setInterval> | null = null;
    let sseFallbackTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let bc: BroadcastChannel | null = null;

    const buildStudentQueryParams = (extra?: Record<string, string>) => {
      const params = new URLSearchParams();
      if (extra) {
        for (const [k, v] of Object.entries(extra)) {
          params.set(k, v);
        }
      }
      if (role) params.set('role', role);
      if (role === 'student') {
        if (effectiveStudentId) params.set('studentId', effectiveStudentId);
        if (effectivePortalId) params.set('portalId', effectivePortalId);
        if (effectiveClassIdRef.current) params.set('classId', effectiveClassIdRef.current);
        if (effectiveRollRef.current) params.set('roll', String(effectiveRollRef.current));
      }
      return params;
    };

    const handleIncomingPayload = (
      rawPayload: any,
      viaTransport: 'ws' | 'sse' | 'polling' | 'broadcast'
    ) => {
      if (isDisposed || !rawPayload) return;
      const clientNow = Date.now();

      if (rawPayload.type === 'pong') {
        const sentAt = typeof rawPayload.clientSentAt === 'number' ? rawPayload.clientSentAt : null;
        const rtt = sentAt !== null ? Math.max(0, clientNow - sentAt) : null;
        if (typeof rawPayload.serverTime === 'number' && rtt !== null) {
          setClockOffsetMs(Math.round(rawPayload.serverTime + rtt / 2 - clientNow));
        }
        if (rtt !== null) {
          setLastPingRttMs(rtt);
          setLastSignalLatencyMs(rtt);
          setLastSignalType('ws:pong');
          setLastSignalAt(clientNow);
          setLastSignalTransport('ws');
        }
        if (typeof rawPayload.serverInstanceId === 'string' && rawPayload.serverInstanceId) {
          setServerInstanceId(rawPayload.serverInstanceId);
        }
        setLastSyncServerTime(clientNow);
        return;
      }

      if (typeof rawPayload.serverInstanceId === 'string' && rawPayload.serverInstanceId) {
        if (
          prevServerInstanceIdRef.current &&
          prevServerInstanceIdRef.current !== rawPayload.serverInstanceId
        ) {
          lastServerTimeRef.current = 0;
        }
        prevServerInstanceIdRef.current = rawPayload.serverInstanceId;
        setServerInstanceId(rawPayload.serverInstanceId);
      }

      const serverTime =
        typeof rawPayload.serverTime === 'number' ? rawPayload.serverTime : clientNow;
      if (serverTime > lastServerTimeRef.current) {
        lastServerTimeRef.current = serverTime;
      }
      setLastSyncServerTime(clientNow);

      if (rawPayload.type === 'staff:attendance' && rawPayload.record && rawPayload.record.id) {
        if (role === 'official') {
          const attRec: StaffAttendanceRecord = rawPayload.record;
          const act: 'checkin' | 'checkout' =
            rawPayload.action === 'checkout' || attRec.action === 'checkout' ? 'checkout' : 'checkin';
          setLastSignalType(`staff:attendance (${act})`);
          setLastSignalAt(clientNow);
          setLastSignalTransport(viaTransport);
          recordRealtimeStaffAttendanceRef.current(attRec, act, {
            totalStaffCount:
              typeof rawPayload.totalStaffCount === 'number' ? rawPayload.totalStaffCount : undefined,
            presentCount:
              typeof rawPayload.presentCount === 'number' ? rawPayload.presentCount : undefined,
            pendingCount:
              typeof rawPayload.pendingCount === 'number' ? rawPayload.pendingCount : undefined,
          });
        }
        return;
      }

      if (rawPayload.type === 'staff:leaves' && Array.isArray(rawPayload.staffLeaves)) {
        if (role === 'official' || role === 'employee') {
          setLastSignalType(`staff:leaves (${rawPayload.action || 'updated'})`);
          setLastSignalAt(clientNow);
          setLastSignalTransport(viaTransport);
          setStaffLeavesListRef.current(rawPayload.staffLeaves);
        }
        return;
      }

      if (rawPayload.type === 'attendance:updated' && rawPayload.attendanceRecord?.id) {
        setLastSignalType('attendance:updated');
        setLastSignalAt(clientNow);
        setLastSignalTransport(viaTransport);
        upsertAttendanceRecordFromServerRef.current(rawPayload.attendanceRecord, {
          suppressAutoPush: true,
        });
        return;
      }

      if (rawPayload.type === 'gatepass:init') {
        const logs: SecurityGatepassLog[] = Array.isArray(rawPayload.logs) ? rawPayload.logs : [];
        const isFirstInit = !hasBaselineRef.current;
        hasBaselineRef.current = true;
        if (Array.isArray(rawPayload.todayStudentAttendance)) {
          for (const attRec of rawPayload.todayStudentAttendance) {
            if (attRec?.id && attRec?.records) {
              upsertAttendanceRecordFromServerRef.current(attRec, { suppressAutoPush: true });
            }
          }
        }
        if (role === 'official' && Array.isArray(rawPayload.staffAccounts)) {
          setStaffAccountsListRef.current(rawPayload.staffAccounts as StaffAccount[]);
        }
        if (role === 'official' && Array.isArray(rawPayload.staffAttendance)) {
          const staffRecs: StaffAttendanceRecord[] = rawPayload.staffAttendance;
          const freshWindowMs = isFirstInit ? 2 * 60 * 1000 : 10 * 60 * 1000;
          for (const rec of staffRecs) {
            if (!rec?.id) continue;
            const recTs = rec.serverTimestamp || 0;
            if (recTs >= serverTime - freshWindowMs) {
              recordRealtimeStaffAttendanceRef.current(rec, rec.action, rawPayload.staffSummary);
            }
          }
        }
        // Generous 5m/15m window for unacknowledged live scans so phones waking from background sleep never miss an alert
        const windowMs = isFirstInit ? 5 * 60 * 1000 : 15 * 60 * 1000;
        const approxLag =
          typeof rawPayload.serverTime === 'number'
            ? Math.max(0, Math.round(clientNow + (clockOffsetRef.current ?? 0) - rawPayload.serverTime))
            : null;
        setLastSignalType('gatepass:init');
        setLastSignalAt(clientNow);
        setLastSignalTransport(viaTransport);
        if (approxLag !== null) {
          setLastSignalLatencyMs((prev) => prev ?? approxLag);
        }
        if (isFirstInit) {
          appendDiagnosticLogRef.current(
            viaTransport === 'ws' ? 'WS' : viaTransport === 'sse' ? 'SSE' : 'POLL',
            'ok',
            `সার্ভারের সাথে লাইভ সংযোগ স্থাপিত (${logs.length}টি রেকর্ড)`,
            {
              latencyMs: approxLag,
              detail: rawPayload.serverInstanceId ? `instance=${rawPayload.serverInstanceId}` : undefined,
            }
          );
        }

        let newestRecentUnseen: SecurityGatepassLog | null = null;
        for (const item of logs) {
          if (!item || !item.id) continue;
          addSecurityLogRef.current(item, { suppressAutoPush: true });
          markGatepassLogSeen(item.id);
          if (
            role === 'student' &&
            isMatchingStudentLogRef.current(item) &&
            !hasPlayedGuardianVoiceLog(item.id)
          ) {
            const logMs =
              typeof item.serverTimestamp === 'number'
                ? item.serverTimestamp
                : new Date(item.timestamp).getTime() || 0;
            // Play if a fresh scan occurred shortly before connect or during a brief reconnect
            if (logMs >= serverTime - windowMs && !item.guardianAcknowledged) {
              if (!newestRecentUnseen) {
                newestRecentUnseen = item;
              }
            } else if (isFirstInit) {
              markGuardianVoiceLogPlayed(item.id);
            }
          }
        }
        if (newestRecentUnseen) {
          triggerAlertForStudentRef.current(newestRecentUnseen, viaTransport);
        }
        return;
      }

      if (rawPayload.type === 'gatepass:scan' && rawPayload.log && rawPayload.log.id) {
        const incomingLog: SecurityGatepassLog = rawPayload.log;
        const originMs =
          typeof incomingLog.serverTimestamp === 'number'
            ? incomingLog.serverTimestamp
            : typeof rawPayload.serverTime === 'number'
            ? rawPayload.serverTime
            : null;
        const signalLatency =
          originMs !== null
            ? Math.max(0, Math.round(clientNow + (clockOffsetRef.current ?? 0) - originMs))
            : null;

        setLastSignalLatencyMs(signalLatency);
        setLastScanLatencyMs(signalLatency);
        setLastSignalType(`gatepass:scan (${incomingLog.action === 'exit' ? 'exit' : 'entry'})`);
        setLastSignalAt(clientNow);
        setLastSignalTransport(viaTransport);

        const matched = role === 'student' ? isMatchingStudentLogRef.current(incomingLog) : false;
        if (matched) {
          appendDiagnosticLogRef.current(
            'SIGNAL',
            'ok',
            `স্ক্যান সিগন্যাল প্রাপ্ত (${viaTransport.toUpperCase()}): ${incomingLog.studentNameBn || incomingLog.studentId}`,
            {
              latencyMs: signalLatency,
              detail: `portal=${incomingLog.portalUserId || 'N/A'}, id=${incomingLog.id}`,
            }
          );
        }

        addSecurityLogRef.current(incomingLog, { suppressAutoPush: true });
        markGatepassLogSeen(incomingLog.id);
        hasBaselineRef.current = true;
        if (rawPayload.attendanceRecord) {
          upsertAttendanceRecordFromServerRef.current(rawPayload.attendanceRecord, {
            suppressAutoPush: true,
          });
        }
        if (role === 'student' && matched) {
          triggerAlertForStudentRef.current(incomingLog, viaTransport);
        }
        return;
      }

      if (rawPayload.type === 'gatepass:acknowledge' && rawPayload.log && rawPayload.log.id) {
        const ackLog: SecurityGatepassLog & { updatedServerTimestamp?: number } = rawPayload.log;
        const originMs =
          typeof ackLog.updatedServerTimestamp === 'number'
            ? ackLog.updatedServerTimestamp
            : typeof rawPayload.serverTime === 'number'
            ? rawPayload.serverTime
            : null;
        const ackLatency =
          originMs !== null
            ? Math.max(0, Math.round(clientNow + (clockOffsetRef.current ?? 0) - originMs))
            : null;

        setLastSignalLatencyMs(ackLatency);
        setLastSignalType('gatepass:acknowledge');
        setLastSignalAt(clientNow);
        setLastSignalTransport(viaTransport);

        addSecurityLogRef.current(ackLog, { suppressAutoPush: true });
      }
    };

    const pollLatestLogs = async () => {
      if (isDisposed) return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        consecutivePollFailures += 1;
        pollVerified = false;
        if (!wsConnected && !sseConnected && consecutivePollFailures >= 2) {
          setSyncHealth('unreachable');
        }
        return;
      }

      const pollReqStart = Date.now();
      const abortCtrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutHandle = abortCtrl ? setTimeout(() => abortCtrl.abort(), 8000) : null;

      try {
        const sinceParam =
          hasBaselineRef.current && lastServerTimeRef.current > 0
            ? Math.max(0, lastServerTimeRef.current - 30000)
            : 0;
        const params = buildStudentQueryParams({ since: String(sinceParam) });
        const res = await fetch(`/api/security/latest-logs?${params.toString()}`, {
          cache: 'no-store',
          credentials: 'include',
          signal: abortCtrl?.signal,
        });
        const parsed = await parseJsonApiResponse<any>(res);
        if (isDisposed) return;

        if (parsed.staticHostNoBackend) {
          consecutivePollFailures += 1;
          pollVerified = false;
          if (!wsConnected && !sseConnected && consecutivePollFailures >= 2) {
            staticHostDetected = true;
            setSyncHealth('static_host');
            appendDiagnosticLogRef.current(
              'POLL',
              'error',
              'ব্যাকএন্ড সার্ভার (server.ts) পাওয়া যায়নি',
              { detail: 'Static HTML রেসপন্স আসছে' }
            );
          }
          return;
        }

        if (parsed.authRedirected) {
          consecutivePollFailures += 1;
          pollVerified = false;
          if (!wsConnected && !sseConnected && consecutivePollFailures >= 2) {
            setSyncHealth('auth_redirect');
            appendDiagnosticLogRef.current(
              'POLL',
              'error',
              'পোলিং অনুরোধ অথেনটিকেশন রিডাইরেক্টে আটকে গেছে'
            );
          }
          return;
        }

        if (!parsed.ok || !parsed.data || !Array.isArray(parsed.data.logs)) {
          consecutivePollFailures += 1;
          if (!wsConnected && !sseConnected && consecutivePollFailures >= 3) {
            pollVerified = false;
            setSyncHealth((prev) =>
              prev === 'static_host' || prev === 'auth_redirect' ? prev : 'unreachable'
            );
            appendDiagnosticLogRef.current('POLL', 'warn', 'সার্ভার পোলিং অস্থায়ীভাবে বিচ্ছিন্ন', {
              detail: `status=${parsed.status || 'retry'}`,
            });
          }
          return;
        }

        // Healthy poll response — immediately clear failure state
        consecutivePollFailures = 0;
        const pollRtt = Math.max(0, Date.now() - pollReqStart);
        const data = parsed.data;
        pollVerified = true;
        setLastSyncServerTime(Date.now());
        if (typeof data.serverTime === 'number' && !wsConnected) {
          setClockOffsetMs(Math.round(data.serverTime + pollRtt / 2 - Date.now()));
        }
        if (!wsConnected) {
          setLastPingRttMs(pollRtt);
          setLastSignalLatencyMs((prev) => prev ?? pollRtt);
          setLastSignalAt(Date.now());
          setLastSignalType((prev) => prev || 'http:poll');
          setLastSignalTransport((prev) => prev || 'polling');
        }
        if (typeof data.serverInstanceId === 'string' && data.serverInstanceId) {
          if (
            prevServerInstanceIdRef.current &&
            prevServerInstanceIdRef.current !== data.serverInstanceId
          ) {
            lastServerTimeRef.current = 0;
          }
          prevServerInstanceIdRef.current = data.serverInstanceId;
          setServerInstanceId(data.serverInstanceId);
        }
        if (!wsConnected && !sseConnected) {
          setConnectionTransport('polling');
          setSyncHealth('verified_polling');
        } else if (sseConnected && !wsConnected) {
          setSyncHealth('verified_sse');
        }

        const serverNow = typeof data.serverTime === 'number' ? data.serverTime : Date.now();

        if (!hasBaselineRef.current) {
          handleIncomingPayload(
            {
              type: 'gatepass:init',
              logs: data.logs,
              staffAccounts: data.staffAccounts,
              staffAttendance: data.staffAttendance,
              staffSummary: data.staffSummary,
              todayStudentAttendance: data.todayStudentAttendance,
              serverTime: serverNow,
              serverInstanceId: data.serverInstanceId,
            },
            'polling'
          );
          return;
        }

        if (Array.isArray(data.todayStudentAttendance)) {
          for (const attRec of data.todayStudentAttendance) {
            if (attRec?.id && attRec?.records) {
              upsertAttendanceRecordFromServerRef.current(attRec, { suppressAutoPush: true });
            }
          }
        }

        if (role === 'official' && Array.isArray(data.staffAccounts)) {
          setStaffAccountsListRef.current(data.staffAccounts as StaffAccount[]);
        }
        if (role === 'official' && Array.isArray(data.staffAttendance)) {
          const staffRecs: StaffAttendanceRecord[] = data.staffAttendance;
          for (const rec of staffRecs) {
            if (!rec?.id) continue;
            const recTs = rec.serverTimestamp || 0;
            if (recTs > 0 && recTs >= serverNow - 10 * 60 * 1000) {
              recordRealtimeStaffAttendanceRef.current(rec, rec.action, data.staffSummary);
            }
          }
        }

        lastServerTimeRef.current = Math.max(lastServerTimeRef.current, serverNow - 5000);
        const sorted = [...data.logs].sort(
          (a, b) =>
            (a.serverTimestamp || new Date(a.timestamp).getTime() || 0) -
            (b.serverTimestamp || new Date(b.timestamp).getTime() || 0)
        );
        for (const log of sorted) {
          if (log && log.id) {
            const isNewGuardianAlert =
              role === 'student' &&
              isMatchingStudentLogRef.current(log) &&
              !hasPlayedGuardianVoiceLog(log.id) &&
              !log.guardianAcknowledged;
            if (!seenGatepassLogIds.has(log.id) || isNewGuardianAlert) {
              handleIncomingPayload({ type: 'gatepass:scan', log, serverTime: serverNow }, 'polling');
            } else {
              addSecurityLogRef.current(log, { suppressAutoPush: true });
            }
          }
        }
      } catch (err: any) {
        consecutivePollFailures += 1;
        if (!wsConnected && !sseConnected && consecutivePollFailures >= 3) {
          pollVerified = false;
          setSyncHealth((prev) =>
            prev === 'auth_redirect' || prev === 'static_host' ? prev : 'unreachable'
          );
          appendDiagnosticLogRef.current('POLL', 'warn', 'সার্ভার পোলিংয়ে অস্থায়ী নেটওয়ার্ক ত্রুটি', {
            detail: String(err?.name === 'AbortError' ? 'Timeout 8s' : err?.message || 'Fetch failed'),
          });
        }
      } finally {
        if (timeoutHandle) clearTimeout(timeoutHandle);
      }
    };

    const startSseFallback = () => {
      if (isDisposed || sse || wsConnected || typeof EventSource === 'undefined') return;
      try {
        const params = buildStudentQueryParams();
        sse = new EventSource(`/api/security/stream?${params.toString()}`);
        setSseReadyState('CONNECTING');

        sse.onopen = () => {
          sseConnected = true;
          consecutivePollFailures = 0;
          sseLoggedWarnNote = false;
          setSseReadyState('OPEN');
          appendDiagnosticLogRef.current('SSE', 'ok', 'SSE লাইভ স্ট্রিম সক্রিয় হয়েছে');
          if (!wsConnected) {
            setConnectionTransport('sse');
            setSyncHealth('verified_sse');
          }
        };
        sse.addEventListener('gatepass', (ev: MessageEvent) => {
          try {
            sseConnected = true;
            consecutivePollFailures = 0;
            setSseReadyState('OPEN');
            if (!wsConnected) {
              setConnectionTransport('sse');
              setSyncHealth('verified_sse');
            }
            handleIncomingPayload(JSON.parse(ev.data), 'sse');
          } catch {
            // Ignore malformed SSE payload
          }
        });
        sse.onerror = () => {
          sseConnected = false;
          setSseReadyState('CLOSED');
          if (sse && sse.readyState === EventSource.CLOSED) {
            try {
              sse.close();
            } catch {}
            sse = null;
          }
          if (!sseLoggedWarnNote && !pollVerified) {
            sseLoggedWarnNote = true;
            appendDiagnosticLogRef.current('SSE', 'info', 'HTTP পোলিং চ্যানেলে লাইভ সিঙ্ক সচল আছে');
          }
          if (!wsConnected) {
            setConnectionTransport(pollVerified ? 'polling' : 'connecting');
            setSyncHealth((prev) =>
              pollVerified
                ? 'verified_polling'
                : prev === 'auth_redirect' || prev === 'static_host'
                ? prev
                : prev
            );
          }
        };
      } catch {
        sseConnected = false;
        setSseReadyState('CLOSED');
      }
    };

    const stopSseFallback = () => {
      if (sse) {
        sse.close();
        sse = null;
      }
      sseConnected = false;
      setSseReadyState('CLOSED');
    };

    const connectWebSocket = () => {
      if (isDisposed || typeof window === 'undefined' || !('WebSocket' in window)) {
        setWsReadyState('UNSUPPORTED');
        startSseFallback();
        return;
      }

      try {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const params = buildStudentQueryParams();
        const fullWsUrl = `${proto}//${window.location.host}/ws/gatepass?${params.toString()}`;
        setWsUrl(fullWsUrl);
        setWsReadyState('CONNECTING');

        ws = new WebSocket(fullWsUrl);
        activeWsRef.current = ws;

        if (sseFallbackTimer) clearTimeout(sseFallbackTimer);
        sseFallbackTimer = setTimeout(() => {
          if (!wsConnected && !isDisposed) {
            startSseFallback();
          }
        }, 2000);

        ws.onopen = () => {
          wsConnected = true;
          consecutivePollFailures = 0;
          wsReconnectAttempts = 0;
          wsLoggedFallbackNote = false;
          setWsReconnectAttemptsState(0);
          setWsReadyState(mapWsReadyState(ws?.readyState));
          setWsLastOpenAt(Date.now());
          setConnectionTransport('ws');
          setSyncHealth('verified_ws');
          appendDiagnosticLogRef.current('WS', 'ok', 'WebSocket লাইভ সংযোগ চালু হয়েছে');

          if (sseFallbackTimer) {
            clearTimeout(sseFallbackTimer);
            sseFallbackTimer = null;
          }
          stopSseFallback();

          try {
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'ping', clientSentAt: Date.now() }));
            }
          } catch {
            // Ignore
          }

          if (wsPingTimer) clearInterval(wsPingTimer);
          wsPingTimer = setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
              try {
                ws.send(JSON.stringify({ type: 'ping', clientSentAt: Date.now() }));
              } catch {
                // Ignore
              }
            }
          }, 25000);
        };

        ws.onmessage = (event) => {
          try {
            handleIncomingPayload(JSON.parse(event.data), 'ws');
          } catch {
            // Ignore malformed WS message
          }
        };

        ws.onclose = (ev) => {
          wsConnected = false;
          activeWsRef.current = null;
          setWsReadyState('CLOSED');
          setWsLastCloseCode(typeof ev?.code === 'number' ? ev.code : null);
          setWsLastCloseReason(ev?.reason || null);

          if (wsPingTimer) {
            clearInterval(wsPingTimer);
            wsPingTimer = null;
          }
          if (isDisposed) return;

          if (!wsLoggedFallbackNote) {
            wsLoggedFallbackNote = true;
            appendDiagnosticLogRef.current(
              'WS',
              'info',
              `SSE/HTTP পোলিং চ্যানেলে নিরবচ্ছিন্ন সংযোগ সচল (WS code=${ev?.code ?? 'N/A'})`
            );
          }

          setConnectionTransport(sseConnected ? 'sse' : pollVerified ? 'polling' : 'connecting');
          setSyncHealth((prev) =>
            sseConnected
              ? 'verified_sse'
              : pollVerified
              ? 'verified_polling'
              : prev
          );
          startSseFallback();

          // Graceful backoff: slow down after 4 failed proxy WS upgrades so we don't spam sockets
          wsReconnectAttempts += 1;
          setWsReconnectAttemptsState(wsReconnectAttempts);
          const backoffMs =
            wsReconnectAttempts <= 3
              ? 2000 * Math.pow(2, wsReconnectAttempts - 1)
              : 45000;
          wsReconnectTimer = setTimeout(connectWebSocket, backoffMs);
        };

        ws.onerror = () => {
          wsConnected = false;
          setWsReadyState(mapWsReadyState(ws?.readyState));
          startSseFallback();
        };
      } catch {
        setWsReadyState('CLOSED');
        startSseFallback();
      }
    };

    // Instant same-browser tab BroadcastChannel listener
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        bc = new BroadcastChannel(GATEPASS_BROADCAST_CHANNEL);
        bc.onmessage = (ev) => {
          handleIncomingPayload(ev.data, 'broadcast');
        };
      } catch {
        bc = null;
      }
    }

    connectWebSocket();
    void pollLatestLogs();

    // Adaptive polling: fast 2.5s whenever WS isn't open (and 8s even with WS open);
    // on static hosts (Vercel), avoid spamming HTML endpoints and run periodic cloud catch-up instead
    let lastPollTick = Date.now();
    let lastCloudCatchupTick = Date.now();
    pollTimer = setInterval(() => {
      const now = Date.now();
      if (staticHostDetected) {
        if (now - lastCloudCatchupTick >= 20000) {
          lastCloudCatchupTick = now;
          void pullCloudSecurityLogsNowRef.current();
        }
        return;
      }
      const isPushActive = wsConnected;
      if (!isPushActive || now - lastPollTick >= 8000) {
        lastPollTick = now;
        void pollLatestLogs();
      }
    }, 2500);

    const handleWakeUp = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      consecutivePollFailures = 0;
      if (!staticHostDetected) {
        void pollLatestLogs();
        if (!wsConnected && (!ws || ws.readyState === WebSocket.CLOSED)) {
          wsReconnectAttempts = 0;
          connectWebSocket();
        }
      }
      void pullCloudSecurityLogsNowRef.current();
    };
    const handleOnline = () => {
      consecutivePollFailures = 0;
      wsReconnectAttempts = 0;
      if (!staticHostDetected) {
        void pollLatestLogs();
        if (!wsConnected && (!ws || ws.readyState === WebSocket.CLOSED)) {
          connectWebSocket();
        }
      }
      void pullCloudSecurityLogsNowRef.current();
    };
    const handleOffline = () => {
      pollVerified = false;
      if (!wsConnected && !sseConnected) {
        setSyncHealth((prev) =>
          prev === 'static_host' || prev === 'auth_redirect' ? prev : 'unreachable'
        );
      }
    };
    window.addEventListener('focus', handleWakeUp);
    window.addEventListener('pageshow', handleWakeUp);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleWakeUp);

    return () => {
      isDisposed = true;
      activeWsRef.current = null;
      window.removeEventListener('focus', handleWakeUp);
      window.removeEventListener('pageshow', handleWakeUp);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleWakeUp);
      if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
      if (wsPingTimer) clearInterval(wsPingTimer);
      if (sseFallbackTimer) clearTimeout(sseFallbackTimer);
      if (pollTimer) clearInterval(pollTimer);
      if (ringClearTimerRef.current) clearTimeout(ringClearTimerRef.current);
      if (ws) {
        try {
          ws.close();
        } catch {}
      }
      stopSseFallback();
      if (bc) {
        try {
          bc.close();
        } catch {}
      }
    };
  }, [enabled, role, effectiveStudentId, effectivePortalId, reconnectNonce]);

  const forceCheckNow = useCallback(async (): Promise<{
    foundCount: number;
    latestLog: SecurityGatepassLog | null;
  }> => {
    if (role === 'student') {
      unlockMobileAudioAndSpeech(true);
      if (isGuardianAudioEnabledPref()) {
        setGuardianLiveWatchActive(true);
      }
    }
    let cloudPulledLogs: SecurityGatepassLog[] = [];
    const cloudPullPromise = pullCloudSecurityLogsNow()
      .then((logs) => {
        cloudPulledLogs = logs;
        return logs;
      })
      .catch(() => [] as SecurityGatepassLog[]);

    const evaluateCloudFallbackLogs = (): {
      foundCount: number;
      latestLog: SecurityGatepassLog | null;
    } => {
      if (role !== 'student' || cloudPulledLogs.length === 0) {
        return { foundCount: 0, latestLog: null };
      }
      const matching = cloudPulledLogs.filter((l) => isMatchingStudentLog(l));
      const nowMs = Date.now() + (clockOffsetRef.current ?? 0);
      let unplayed: SecurityGatepassLog | null = null;
      for (const item of matching) {
        markGatepassLogSeen(item.id);
        const logMs =
          typeof item.serverTimestamp === 'number'
            ? item.serverTimestamp
            : new Date(item.timestamp).getTime() || 0;
        if (
          !unplayed &&
          !item.guardianAcknowledged &&
          !hasPlayedGuardianVoiceLog(item.id) &&
          logMs >= nowMs - 20 * 60 * 1000
        ) {
          unplayed = item;
        }
      }
      if (unplayed) {
        triggerAlertForStudent(unplayed, 'firestore');
      }
      return { foundCount: matching.length, latestLog: matching[0] || null };
    };

    try {
      const params = new URLSearchParams();
      params.set('since', '0');
      if (role) params.set('role', role);
      if (role === 'student') {
        if (effectiveStudentId) params.set('studentId', effectiveStudentId);
        if (effectivePortalId) params.set('portalId', effectivePortalId);
        if (effectiveClassId) params.set('classId', effectiveClassId);
        if (effectiveRoll) params.set('roll', String(effectiveRoll));
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      let res: Response;
      try {
        res = await fetch(`/api/security/latest-logs?${params.toString()}`, {
          cache: 'no-store',
          credentials: 'include',
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }
      const [parsed] = await Promise.all([parseJsonApiResponse<any>(res), cloudPullPromise]);
      if (parsed.staticHostNoBackend) {
        setSyncHealth('static_host');
        return evaluateCloudFallbackLogs();
      }
      if (parsed.authRedirected) {
        setSyncHealth('auth_redirect');
        return evaluateCloudFallbackLogs();
      }
      if (!parsed.ok || !parsed.data) {
        setSyncHealth((prev) =>
          prev === 'verified_ws' || prev === 'verified_sse' ? prev : 'unreachable'
        );
        return evaluateCloudFallbackLogs();
      }
      const data = parsed.data;
      setLastSyncServerTime(Date.now());
      setSyncHealth((prev) =>
        prev === 'verified_ws' || prev === 'verified_sse' ? prev : 'verified_polling'
      );
      if (typeof data?.serverInstanceId === 'string' && data.serverInstanceId) {
        setServerInstanceId(data.serverInstanceId);
      }
      const serverLogs: SecurityGatepassLog[] = Array.isArray(data?.logs) ? data.logs : [];
      const mergedCheckLogs = new Map<string, SecurityGatepassLog>();
      for (const item of serverLogs) {
        if (item?.id) mergedCheckLogs.set(item.id, item);
      }
      for (const item of cloudPulledLogs) {
        if (item?.id && !mergedCheckLogs.has(item.id)) {
          mergedCheckLogs.set(item.id, item);
        }
      }
      const serverNow = typeof data?.serverTime === 'number' ? data.serverTime : Date.now();
      let matchingCount = 0;
      let newestMatching: SecurityGatepassLog | null = null;
      let unplayedRecent: SecurityGatepassLog | null = null;

      for (const item of mergedCheckLogs.values()) {
        if (!item || !item.id) continue;
        addSecurityLog(item, { suppressAutoPush: true });
        markGatepassLogSeen(item.id);
        if (role === 'student' && isMatchingStudentLog(item)) {
          matchingCount += 1;
          if (
            !newestMatching ||
            new Date(item.timestamp).getTime() > new Date(newestMatching.timestamp).getTime()
          ) {
            newestMatching = item;
          }
          const logMs =
            typeof item.serverTimestamp === 'number'
              ? item.serverTimestamp
              : new Date(item.timestamp).getTime() || 0;
          if (
            !unplayedRecent &&
            !item.guardianAcknowledged &&
            !hasPlayedGuardianVoiceLog(item.id) &&
            logMs >= serverNow - 20 * 60 * 1000
          ) {
            unplayedRecent = item;
          }
        }
      }

      if (unplayedRecent) {
        triggerAlertForStudent(unplayedRecent, 'polling');
      }
      return { foundCount: matchingCount, latestLog: newestMatching };
    } catch {
      await cloudPullPromise;
      setSyncHealth((prev) =>
        prev === 'verified_ws' || prev === 'verified_sse' ? prev : 'unreachable'
      );
      return evaluateCloudFallbackLogs();
    }
  }, [
    role,
    effectiveStudentId,
    effectivePortalId,
    effectiveClassId,
    effectiveRoll,
    addSecurityLog,
    isMatchingStudentLog,
    triggerAlertForStudent,
    pullCloudSecurityLogsNow,
  ]);

  const sendDiagnosticPing = useCallback(async (): Promise<number | null> => {
    const started = Date.now();
    const activeWs = activeWsRef.current;
    if (activeWs && activeWs.readyState === WebSocket.OPEN) {
      try {
        activeWs.send(JSON.stringify({ type: 'ping', clientSentAt: started }));
        appendDiagnosticLog('WS', 'info', 'ম্যানুয়াল WebSocket পিং পাঠানো হয়েছে...');
      } catch {
        // Fallback to HTTP below
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch('/api/security/health', {
        cache: 'no-store',
        signal: controller.signal,
      });
      const parsed = await parseJsonApiResponse<any>(res);
      const httpRtt = Math.max(0, Date.now() - started);
      if (parsed.ok && parsed.data) {
        if (typeof parsed.data.serverInstanceId === 'string' && parsed.data.serverInstanceId) {
          setServerInstanceId(parsed.data.serverInstanceId);
        }
        if (typeof parsed.data.serverTime === 'number') {
          setClockOffsetMs(Math.round(parsed.data.serverTime + httpRtt / 2 - Date.now()));
        }
        if (!activeWs || activeWs.readyState !== WebSocket.OPEN) {
          setLastPingRttMs(httpRtt);
          setLastSignalLatencyMs(httpRtt);
          setLastSignalType('http:health');
          setLastSignalAt(Date.now());
          setLastSignalTransport('polling');
          appendDiagnosticLog('POLL', 'ok', 'সার্ভার হেলথ পিং (HTTP RTT) সম্পন্ন', {
            latencyMs: httpRtt,
            detail: parsed.data.serverInstanceId ? `instance=${parsed.data.serverInstanceId}` : undefined,
          });
        }
        return httpRtt;
      }
      appendDiagnosticLog('POLL', 'warn', 'সার্ভার হেলথ পিং অসম্পূর্ণ', {
        detail: parsed.staticHostNoBackend
          ? 'Static Host (server.ts অনুপস্থিত)'
          : parsed.authRedirected
          ? 'Auth Redirect'
          : `HTTP ${parsed.status}`,
      });
      return null;
    } catch (err: any) {
      appendDiagnosticLog('POLL', 'error', 'সার্ভার হেলথ পিং ব্যর্থ', {
        detail: String(err?.message || 'Network error'),
      });
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }, [appendDiagnosticLog]);

  const reconnectRealtime = useCallback(() => {
    appendDiagnosticLog('WS', 'info', 'ইউজার কর্তৃক ম্যানুয়াল রিকানেক্ট শুরু হয়েছে');
    setReconnectNonce((n) => n + 1);
  }, [appendDiagnosticLog]);

  const clearDiagnosticLogs = useCallback(() => {
    setDiagnosticLogs([
      {
        id: `diag_${Date.now()}_cleared`,
        at: Date.now(),
        source: 'WS',
        level: 'info',
        message: 'ডায়াগনস্টিক লগ পরিষ্কার করা হয়েছে',
      },
    ]);
  }, []);

  const diagnostics: GatepassRealtimeDiagnostics = {
    wsReadyState,
    wsUrl,
    wsReconnectAttempts: wsReconnectAttemptsState,
    wsLastOpenAt,
    wsLastCloseCode,
    wsLastCloseReason,
    sseReadyState,
    lastSignalLatencyMs,
    lastScanLatencyMs,
    lastPingRttMs,
    lastSignalType,
    lastSignalAt,
    lastSignalTransport,
    clockOffsetMs,
    connectedHost: typeof window !== 'undefined' ? window.location.host : '',
    serverInstanceId,
    notificationPermission:
      typeof window !== 'undefined' && 'Notification' in window
        ? Notification.permission
        : 'unsupported',
    logs: diagnosticLogs,
  };

  return {
    liveRingingAlert,
    dismissLiveRingingAlert: () => {
      stopBengaliSpeech();
      setLiveRingingAlert(null);
    },
    connectionTransport,
    syncHealth,
    lastSyncServerTime,
    serverInstanceId,
    forceCheckNow,
    diagnostics,
    sendDiagnosticPing,
    reconnectRealtime,
    clearDiagnosticLogs,
  };
}
