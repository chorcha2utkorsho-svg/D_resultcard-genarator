import { useCallback, useEffect, useRef, useState } from 'react';
import { useSchool } from '../context/SchoolContext';
import { PortalRole, SecurityGatepassLog } from '../types';
import { getStudentPortalId } from '../utils/bengali';
import { parseJsonApiResponse } from '../utils/apiResponse';
import {
  AudioDiagnosticEvent,
  buildGuardianVoiceMessage,
  getRecentAudioDiagnosticEvents,
  playAlarmChime,
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
        return [entry, ...prev].slice(0, 100);
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

      playAlarmChime();
      showGuardianSystemNotification(
        `${schoolNameRef.current || 'ডি-লিকন একাডেমী'} • ${targetStudent.nameBn}`,
        message
      );

      speakRepeatedGuardianAlert(targetStudent, action, currentSchedule, {
        repeatCount: 6,
        delayMs: 160,
        onBlocked: () => {
          appendDiagnosticLog(
            'TRIGGER',
            'error',
            'ভয়েস অটোপ্লে ব্রাউজার দ্বারা বাধাপ্রাপ্ত হয়েছে (AudioContext suspended)',
            { detail: `logId=${log.id}` }
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

    const nowMs = Date.now() + (clockOffsetRef.current ?? 0);
    const matchingLogs = securityLogs.filter((l) => isMatchingStudentLog(l));

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
          if (logMs >= nowMs - 90000 && !item.guardianAcknowledged) {
            if (!newestRecentUnseen) {
              newestRecentUnseen = item;
            }
          } else {
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
        // Post-baseline newly arrived logs: generous 15m window prevents phone-clock skew from silencing live scans
        if (logMs >= nowMs - 15 * 60 * 1000 && !item.guardianAcknowledged) {
          if (!freshUnplayed) {
            freshUnplayed = item;
          }
        } else {
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
    let wsReconnectAttempts = 0;
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
        if (effectiveClassId) params.set('classId', effectiveClassId);
        if (effectiveRoll) params.set('roll', String(effectiveRoll));
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
          appendDiagnosticLog('WS', 'ok', 'WebSocket পিং-পং (RTT) সম্পন্ন', {
            latencyMs: rtt,
            detail: rawPayload.serverInstanceId ? `instance=${rawPayload.serverInstanceId}` : undefined,
          });
        }
        if (typeof rawPayload.serverInstanceId === 'string' && rawPayload.serverInstanceId) {
          setServerInstanceId(rawPayload.serverInstanceId);
        }
        setLastSyncServerTime(clientNow);
        return;
      }

      const serverTime =
        typeof rawPayload.serverTime === 'number' ? rawPayload.serverTime : clientNow;
      if (serverTime > lastServerTimeRef.current) {
        lastServerTimeRef.current = serverTime;
      }
      setLastSyncServerTime(clientNow);
      if (typeof rawPayload.serverInstanceId === 'string' && rawPayload.serverInstanceId) {
        setServerInstanceId(rawPayload.serverInstanceId);
      }

      if (rawPayload.type === 'gatepass:init') {
        const logs: SecurityGatepassLog[] = Array.isArray(rawPayload.logs) ? rawPayload.logs : [];
        const isFirstInit = !hasBaselineRef.current;
        hasBaselineRef.current = true;
        const windowMs = isFirstInit ? 90000 : 180000;
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
        appendDiagnosticLog(
          viaTransport === 'ws' ? 'WS' : viaTransport === 'sse' ? 'SSE' : 'POLL',
          'info',
          `সার্ভার থেকে প্রাথমিক সিঙ্ক (${logs.length}টি লগ)`,
          {
            latencyMs: approxLag,
            detail: rawPayload.serverInstanceId ? `instance=${rawPayload.serverInstanceId}` : undefined,
          }
        );

        let newestRecentUnseen: SecurityGatepassLog | null = null;
        for (const item of logs) {
          if (!item || !item.id) continue;
          addSecurityLog(item, { suppressAutoPush: true });
          markGatepassLogSeen(item.id);
          if (
            role === 'student' &&
            isMatchingStudentLog(item) &&
            !hasPlayedGuardianVoiceLog(item.id)
          ) {
            const logMs =
              typeof item.serverTimestamp === 'number'
                ? item.serverTimestamp
                : new Date(item.timestamp).getTime() || 0;
            // Play if a fresh scan occurred shortly before connect or during a brief WS reconnect
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
          triggerAlertForStudent(newestRecentUnseen, viaTransport);
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

        const matched = role === 'student' ? isMatchingStudentLog(incomingLog) : false;
        appendDiagnosticLog(
          'SIGNAL',
          matched ? 'ok' : 'info',
          `স্ক্যান সিগন্যাল প্রাপ্ত (${viaTransport.toUpperCase()}): ${incomingLog.studentNameBn || incomingLog.studentId} — ${
            matched ? 'এই শিক্ষার্থীর সাথে মিলেছে' : 'অন্য শিক্ষার্থী'
          }`,
          {
            latencyMs: signalLatency,
            detail: `portal=${incomingLog.portalUserId || 'N/A'}, id=${incomingLog.id}`,
          }
        );

        addSecurityLog(incomingLog, { suppressAutoPush: true });
        markGatepassLogSeen(incomingLog.id);
        hasBaselineRef.current = true;
        if (rawPayload.attendanceRecord) {
          upsertAttendanceRecordFromServer(rawPayload.attendanceRecord, { suppressAutoPush: true });
        }
        if (role === 'student' && matched) {
          triggerAlertForStudent(incomingLog, viaTransport);
        }
        return;
      }

      if (rawPayload.type === 'gatepass:acknowledge' && rawPayload.log && rawPayload.log.id) {
        addSecurityLog(rawPayload.log, { suppressAutoPush: true });
      }
    };

    const pollLatestLogs = async () => {
      if (isDisposed) return;
      const pollReqStart = Date.now();
      try {
        const sinceParam =
          hasBaselineRef.current && lastServerTimeRef.current > 0
            ? Math.max(0, lastServerTimeRef.current - 15000)
            : 0;
        const params = buildStudentQueryParams({ since: String(sinceParam) });
        const res = await fetch(`/api/security/latest-logs?${params.toString()}`, {
          cache: 'no-store',
        });
        const parsed = await parseJsonApiResponse<any>(res);
        if (isDisposed) return;

        if (parsed.staticHostNoBackend) {
          pollVerified = false;
          if (!wsConnected && !sseConnected) {
            setSyncHealth('static_host');
          }
          appendDiagnosticLog(
            'POLL',
            'error',
            'ব্যাকএন্ড সার্ভার (server.ts) পাওয়া যায়নি — স্ট্যাটিক HTML রেসপন্স আসছে',
            { detail: 'এই হোস্টিং URL-এ কেবল ফ্রন্টএন্ড ফাইল চলছে, Node সার্ভার/WebSocket চালু নেই' }
          );
          return;
        }

        if (parsed.authRedirected) {
          pollVerified = false;
          if (!wsConnected && !sseConnected) {
            setSyncHealth('auth_redirect');
          }
          appendDiagnosticLog(
            'POLL',
            'error',
            'পোলিং অনুরোধ অথেনটিকেশন রিডাইরেক্টে আটকে গেছে',
            { detail: 'সেশন ভেরিফিকেশন রিডাইরেক্ট হচ্ছে — পেজ রিলোড প্রয়োজন' }
          );
          return;
        }

        if (!parsed.ok || !parsed.data || !Array.isArray(parsed.data.logs)) {
          pollVerified = false;
          if (!wsConnected && !sseConnected) {
            setSyncHealth((prev) => (prev === 'static_host' || prev === 'auth_redirect' ? prev : 'unreachable'));
          }
          appendDiagnosticLog('POLL', 'warn', 'HTTP পোলিং রেসপন্স পাওয়া যায়নি', {
            detail: `status=${parsed.status || 'network_err'}`,
          });
          return;
        }

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
          setServerInstanceId(data.serverInstanceId);
        }
        if (!wsConnected && !sseConnected) {
          setConnectionTransport('polling');
          setSyncHealth('verified_polling');
        }

        const serverNow = typeof data.serverTime === 'number' ? data.serverTime : Date.now();

        if (!hasBaselineRef.current) {
          handleIncomingPayload(
            {
              type: 'gatepass:init',
              logs: data.logs,
              serverTime: serverNow,
              serverInstanceId: data.serverInstanceId,
            },
            'polling'
          );
          return;
        }

        lastServerTimeRef.current = Math.max(lastServerTimeRef.current, serverNow - 3000);
        // Process chronological oldest-to-newest for fresh logs
        const sorted = [...data.logs].sort(
          (a, b) =>
            (a.serverTimestamp || new Date(a.timestamp).getTime() || 0) -
            (b.serverTimestamp || new Date(b.timestamp).getTime() || 0)
        );
        for (const log of sorted) {
          if (log && log.id) {
            const isNewGuardianAlert =
              role === 'student' && isMatchingStudentLog(log) && !hasPlayedGuardianVoiceLog(log.id);
            if (!seenGatepassLogIds.has(log.id) || isNewGuardianAlert) {
              handleIncomingPayload({ type: 'gatepass:scan', log, serverTime: serverNow }, 'polling');
            } else {
              addSecurityLog(log, { suppressAutoPush: true });
            }
          }
        }
      } catch (err: any) {
        pollVerified = false;
        if (!wsConnected && !sseConnected) {
          setSyncHealth((prev) =>
            prev === 'auth_redirect' || prev === 'static_host' ? prev : 'unreachable'
          );
        }
        appendDiagnosticLog('POLL', 'error', 'HTTP পোলিং নেটওয়ার্ক ত্রুটি', {
          detail: String(err?.message || 'Fetch failed'),
        });
      }
    };

    const startSseFallback = () => {
      if (isDisposed || sse || wsConnected || typeof EventSource === 'undefined') return;
      try {
        const params = buildStudentQueryParams();
        sse = new EventSource(`/api/security/stream?${params.toString()}`);
        setSseReadyState('CONNECTING');
        appendDiagnosticLog('SSE', 'info', 'SSE ফ্যালব্যাক স্ট্রিম সংযোগ শুরু হয়েছে');

        sse.onopen = () => {
          sseConnected = true;
          setSseReadyState('OPEN');
          appendDiagnosticLog('SSE', 'ok', 'SSE ইভেন্ট স্ট্রিম সংযুক্ত (OPEN)');
          if (!wsConnected) {
            setConnectionTransport('sse');
            setSyncHealth('verified_sse');
          }
        };
        sse.addEventListener('gatepass', (ev: MessageEvent) => {
          try {
            sseConnected = true;
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
          appendDiagnosticLog('SSE', 'warn', 'SSE সংযোগ বিচ্ছিন্ন বা ত্রুটি ঘটেছে');
          if (!wsConnected) {
            setConnectionTransport(pollVerified ? 'polling' : 'connecting');
            setSyncHealth((prev) =>
              pollVerified
                ? 'verified_polling'
                : prev === 'auth_redirect' || prev === 'static_host'
                ? prev
                : 'connecting'
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
        appendDiagnosticLog('WS', 'warn', 'এই ব্রাউজারে WebSocket সাপোর্ট নেই, SSE চালু করা হচ্ছে');
        startSseFallback();
        return;
      }

      try {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const params = buildStudentQueryParams();
        const fullWsUrl = `${proto}//${window.location.host}/ws/gatepass?${params.toString()}`;
        setWsUrl(fullWsUrl);
        setWsReadyState('CONNECTING');
        appendDiagnosticLog('WS', 'info', 'WebSocket সংযোগ স্থাপনের চেষ্টা চলছে...', {
          detail: `${proto}//${window.location.host}/ws/gatepass`,
        });

        ws = new WebSocket(fullWsUrl);
        activeWsRef.current = ws;

        if (sseFallbackTimer) clearTimeout(sseFallbackTimer);
        sseFallbackTimer = setTimeout(() => {
          if (!wsConnected && !isDisposed) {
            startSseFallback();
          }
        }, 2500);

        ws.onopen = () => {
          wsConnected = true;
          wsReconnectAttempts = 0;
          setWsReconnectAttemptsState(0);
          setWsReadyState(mapWsReadyState(ws?.readyState));
          setWsLastOpenAt(Date.now());
          setConnectionTransport('ws');
          setSyncHealth('verified_ws');
          appendDiagnosticLog('WS', 'ok', 'WebSocket সংযোগ সফলভাবে চালু হয়েছে (OPEN)');

          if (sseFallbackTimer) {
            clearTimeout(sseFallbackTimer);
            sseFallbackTimer = null;
          }
          stopSseFallback();

          // Immediately measure WS ping RTT so Signal Latency populates right away
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
          }, 20000);
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

          appendDiagnosticLog(
            'WS',
            'warn',
            `WebSocket সংযোগ বন্ধ হয়েছে (code=${ev?.code ?? 'N/A'})`,
            { detail: ev?.reason || `reconnectAttempt=${wsReconnectAttempts + 1}` }
          );

          setConnectionTransport(sseConnected ? 'sse' : pollVerified ? 'polling' : 'connecting');
          setSyncHealth((prev) =>
            sseConnected
              ? 'verified_sse'
              : pollVerified
              ? 'verified_polling'
              : prev === 'auth_redirect' || prev === 'static_host'
              ? prev
              : 'connecting'
          );
          startSseFallback();
          const backoffMs = Math.min(10000, 1200 * Math.pow(1.6, wsReconnectAttempts));
          wsReconnectAttempts += 1;
          setWsReconnectAttemptsState(wsReconnectAttempts);
          wsReconnectTimer = setTimeout(connectWebSocket, backoffMs);
        };

        ws.onerror = () => {
          wsConnected = false;
          setWsReadyState(mapWsReadyState(ws?.readyState));
          appendDiagnosticLog('WS', 'error', 'WebSocket সংযোগে ত্রুটি ঘটেছে (SSE/Polling ফ্যালব্যাক সক্রিয়)');
          startSseFallback();
        };
      } catch (err: any) {
        setWsReadyState('CLOSED');
        appendDiagnosticLog('WS', 'error', 'WebSocket চালু করতে ব্যর্থ', {
          detail: String(err?.message || err),
        });
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

    // Adaptive polling: fast 2.5s whenever WS/SSE isn't open (and 8s even with WS open so cloud proxies never drop silent updates)
    let lastPollTick = Date.now();
    pollTimer = setInterval(() => {
      const now = Date.now();
      const isPushActive = wsConnected || sseConnected;
      if (!isPushActive || now - lastPollTick >= 8000) {
        lastPollTick = now;
        void pollLatestLogs();
      }
    }, 2500);

    const handleWakeUp = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void pollLatestLogs();
      if (!wsConnected && (!ws || ws.readyState === WebSocket.CLOSED)) {
        connectWebSocket();
      }
    };
    window.addEventListener('focus', handleWakeUp);
    document.addEventListener('visibilitychange', handleWakeUp);

    return () => {
      isDisposed = true;
      activeWsRef.current = null;
      window.removeEventListener('focus', handleWakeUp);
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
  }, [
    enabled,
    role,
    effectiveStudentId,
    effectivePortalId,
    effectiveClassId,
    effectiveRoll,
    reconnectNonce,
    addSecurityLog,
    upsertAttendanceRecordFromServer,
    isMatchingStudentLog,
    triggerAlertForStudent,
    appendDiagnosticLog,
  ]);

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
      const res = await fetch(`/api/security/latest-logs?${params.toString()}`, {
        cache: 'no-store',
      });
      const parsed = await parseJsonApiResponse<any>(res);
      if (parsed.staticHostNoBackend) {
        setSyncHealth('static_host');
        return { foundCount: 0, latestLog: null };
      }
      if (parsed.authRedirected) {
        setSyncHealth('auth_redirect');
        return { foundCount: 0, latestLog: null };
      }
      if (!parsed.ok || !parsed.data) {
        setSyncHealth('unreachable');
        return { foundCount: 0, latestLog: null };
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
      const serverNow = typeof data?.serverTime === 'number' ? data.serverTime : Date.now();
      let matchingCount = 0;
      let newestMatching: SecurityGatepassLog | null = null;
      let unplayedRecent: SecurityGatepassLog | null = null;

      for (const item of serverLogs) {
        if (!item || !item.id) continue;
        addSecurityLog(item, { suppressAutoPush: true });
        markGatepassLogSeen(item.id);
        if (role === 'student' && isMatchingStudentLog(item)) {
          matchingCount += 1;
          if (!newestMatching) newestMatching = item;
          const logMs =
            typeof item.serverTimestamp === 'number'
              ? item.serverTimestamp
              : new Date(item.timestamp).getTime() || 0;
          if (
            !unplayedRecent &&
            !hasPlayedGuardianVoiceLog(item.id) &&
            logMs >= serverNow - 15 * 60 * 1000
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
      setSyncHealth('unreachable');
      return { foundCount: 0, latestLog: null };
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

    try {
      const res = await fetch('/api/security/health', { cache: 'no-store' });
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
