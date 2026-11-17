import { useEffect, useRef, useState } from 'react';
import { useSchool } from '../context/SchoolContext';
import { PortalRole, SecurityGatepassLog } from '../types';
import {
  buildGuardianVoiceMessage,
  playAlarmChime,
  setPendingBlockedSpeech,
  showGuardianSystemNotification,
  speakBengaliSpeech,
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
  enabled?: boolean;
}

export type RealtimeTransportMode = 'ws' | 'sse' | 'polling' | 'connecting';

export function useGatepassRealtime({
  role,
  studentId,
  enabled = true,
}: UseGatepassRealtimeParams) {
  const { students, schoolInfo, addSecurityLog } = useSchool();
  const [liveRingingAlert, setLiveRingingAlert] = useState<{
    log: SecurityGatepassLog;
    message: string;
  } | null>(null);
  const [connectionTransport, setConnectionTransport] =
    useState<RealtimeTransportMode>('connecting');
  const [lastSyncServerTime, setLastSyncServerTime] = useState<number>(0);

  const studentsRef = useRef(students);
  studentsRef.current = students;

  const scheduleRef = useRef(schoolInfo.dailySchedule);
  scheduleRef.current = schoolInfo.dailySchedule;

  const schoolNameRef = useRef(schoolInfo.name);
  schoolNameRef.current = schoolInfo.name;

  const lastServerTimeRef = useRef<number>(0);
  const hasBaselineRef = useRef<boolean>(false);
  const ringClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Unlock mobile audio strictly on real tap/click activation gestures (never false-positive passive scroll)
  useEffect(() => {
    if (!enabled || role !== 'student' || typeof window === 'undefined') return;

    const handleActivationGesture = () => {
      unlockMobileAudioAndSpeech(true);
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

  useEffect(() => {
    if (!enabled || !role) return;
    if (role === 'student' && !studentId) return;

    hasBaselineRef.current = false;
    lastServerTimeRef.current = 0;
    setConnectionTransport('connecting');

    let isDisposed = false;
    let ws: WebSocket | null = null;
    let sse: EventSource | null = null;
    let wsConnected = false;
    let sseConnected = false;
    let wsReconnectAttempts = 0;
    let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let wsPingTimer: ReturnType<typeof setInterval> | null = null;
    let sseFallbackTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let bc: BroadcastChannel | null = null;

    const triggerAlertForStudent = (log: SecurityGatepassLog) => {
      if (role !== 'student' || !studentId || log.studentId !== studentId) return;
      if (hasPlayedGuardianVoiceLog(log.id)) return;
      markGuardianVoiceLogPlayed(log.id);

      const targetStudent =
        studentsRef.current.find((s) => s.id === studentId) ||
        ({ id: studentId, nameBn: log.studentNameBn || 'আপনার সন্তান' } as any);

      const message = buildGuardianVoiceMessage(
        targetStudent,
        log.action === 'exit' ? 'exit' : 'entry',
        scheduleRef.current
      );

      setLiveRingingAlert({ log, message });
      if (ringClearTimerRef.current) clearTimeout(ringClearTimerRef.current);
      ringClearTimerRef.current = setTimeout(() => {
        setLiveRingingAlert(null);
      }, 9000);

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate([220, 90, 220, 90, 350]);
        } catch {
          // Ignore
        }
      }

      if (!isGuardianAudioEnabledPref()) return;

      playAlarmChime();
      showGuardianSystemNotification(
        `${schoolNameRef.current || 'ডি-লিকন একাডেমী'} • লাইভ গেটপাস`,
        message
      );

      speakBengaliSpeech(message, {
        delayMs: 240,
        onBlocked: () => {
          setPendingBlockedSpeech({
            message,
            logId: log.id,
            studentNameBn: targetStudent.nameBn,
            action: log.action === 'exit' ? 'exit' : 'entry',
          });
        },
      });
    };

    const handleIncomingPayload = (rawPayload: any) => {
      if (isDisposed || !rawPayload) return;

      const serverTime =
        typeof rawPayload.serverTime === 'number' ? rawPayload.serverTime : Date.now();
      if (serverTime > lastServerTimeRef.current) {
        lastServerTimeRef.current = serverTime;
      }
      setLastSyncServerTime(Date.now());

      if (rawPayload.type === 'gatepass:init') {
        const logs: SecurityGatepassLog[] = Array.isArray(rawPayload.logs) ? rawPayload.logs : [];
        const isFirstInit = !hasBaselineRef.current;
        hasBaselineRef.current = true;

        let newestRecentUnseen: SecurityGatepassLog | null = null;
        for (const item of logs) {
          if (!item || !item.id) continue;
          addSecurityLog(item);
          markGatepassLogSeen(item.id);
          if (
            isFirstInit &&
            role === 'student' &&
            item.studentId === studentId &&
            !hasPlayedGuardianVoiceLog(item.id)
          ) {
            const logMs =
              typeof item.serverTimestamp === 'number'
                ? item.serverTimestamp
                : new Date(item.timestamp).getTime() || 0;
            // Play if a fresh scan occurred right before the guardian opened the page (within 45s)
            if (logMs >= serverTime - 45000 && !item.guardianAcknowledged) {
              if (!newestRecentUnseen) {
                newestRecentUnseen = item;
              }
            } else {
              // Historical log on initial load: mark played so opening dashboard doesn't replay yesterday's alerts
              markGuardianVoiceLogPlayed(item.id);
            }
          }
        }
        if (newestRecentUnseen) {
          triggerAlertForStudent(newestRecentUnseen);
        }
        return;
      }

      if (rawPayload.type === 'gatepass:scan' && rawPayload.log && rawPayload.log.id) {
        const incomingLog: SecurityGatepassLog = rawPayload.log;
        addSecurityLog(incomingLog);
        markGatepassLogSeen(incomingLog.id);
        hasBaselineRef.current = true;
        if (role === 'student' && incomingLog.studentId === studentId) {
          triggerAlertForStudent(incomingLog);
        }
        return;
      }

      if (rawPayload.type === 'gatepass:acknowledge' && rawPayload.log && rawPayload.log.id) {
        addSecurityLog(rawPayload.log);
      }
    };

    const pollLatestLogs = async () => {
      if (isDisposed) return;
      try {
        const sinceParam =
          hasBaselineRef.current && lastServerTimeRef.current > 0
            ? Math.max(0, lastServerTimeRef.current - 5000)
            : 0;
        const queryStr =
          role === 'student' && studentId
            ? `since=${sinceParam}&studentId=${encodeURIComponent(studentId)}`
            : `since=${sinceParam}`;
        const res = await fetch(`/api/security/latest-logs?${queryStr}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (isDisposed || !data || !Array.isArray(data.logs)) return;

        setLastSyncServerTime(Date.now());
        if (!wsConnected && !sseConnected) {
          setConnectionTransport('polling');
        }

        const serverNow = typeof data.serverTime === 'number' ? data.serverTime : Date.now();

        if (!hasBaselineRef.current) {
          handleIncomingPayload({
            type: 'gatepass:init',
            logs: data.logs,
            serverTime: serverNow,
          });
          return;
        }

        lastServerTimeRef.current = Math.max(lastServerTimeRef.current, serverNow - 2000);
        // Process chronological oldest-to-newest for fresh logs
        const sorted = [...data.logs].sort(
          (a, b) =>
            (a.serverTimestamp || new Date(a.timestamp).getTime() || 0) -
            (b.serverTimestamp || new Date(b.timestamp).getTime() || 0)
        );
        for (const log of sorted) {
          if (log && log.id) {
            const isNewGuardianAlert =
              role === 'student' && log.studentId === studentId && !hasPlayedGuardianVoiceLog(log.id);
            if (!seenGatepassLogIds.has(log.id) || isNewGuardianAlert) {
              handleIncomingPayload({ type: 'gatepass:scan', log, serverTime: serverNow });
            } else {
              addSecurityLog(log);
            }
          }
        }
      } catch {
        // Non-fatal network interruption
      }
    };

    const startSseFallback = () => {
      if (isDisposed || sse || wsConnected || typeof EventSource === 'undefined') return;
      try {
        const params = new URLSearchParams();
        if (studentId) params.set('studentId', studentId);
        if (role) params.set('role', role);
        sse = new EventSource(`/api/security/stream?${params.toString()}`);
        sse.onopen = () => {
          sseConnected = true;
          if (!wsConnected) setConnectionTransport('sse');
        };
        sse.addEventListener('gatepass', (ev: MessageEvent) => {
          try {
            handleIncomingPayload(JSON.parse(ev.data));
          } catch {
            // Ignore malformed SSE payload
          }
        });
        sse.onerror = () => {
          sseConnected = false;
          if (!wsConnected) setConnectionTransport('polling');
        };
      } catch {
        sseConnected = false;
      }
    };

    const stopSseFallback = () => {
      if (sse) {
        sse.close();
        sse = null;
      }
      sseConnected = false;
    };

    const connectWebSocket = () => {
      if (isDisposed || typeof window === 'undefined' || !('WebSocket' in window)) {
        startSseFallback();
        return;
      }

      try {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const params = new URLSearchParams();
        if (studentId) params.set('studentId', studentId);
        if (role) params.set('role', role);
        const wsUrl = `${proto}//${window.location.host}/ws/gatepass?${params.toString()}`;
        ws = new WebSocket(wsUrl);

        if (sseFallbackTimer) clearTimeout(sseFallbackTimer);
        sseFallbackTimer = setTimeout(() => {
          if (!wsConnected && !isDisposed) {
            startSseFallback();
          }
        }, 2500);

        ws.onopen = () => {
          wsConnected = true;
          wsReconnectAttempts = 0;
          setConnectionTransport('ws');
          if (sseFallbackTimer) {
            clearTimeout(sseFallbackTimer);
            sseFallbackTimer = null;
          }
          stopSseFallback();

          if (wsPingTimer) clearInterval(wsPingTimer);
          wsPingTimer = setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
              try {
                ws.send(JSON.stringify({ type: 'ping' }));
              } catch {
                // Ignore
              }
            }
          }, 20000);
        };

        ws.onmessage = (event) => {
          try {
            handleIncomingPayload(JSON.parse(event.data));
          } catch {
            // Ignore malformed WS message
          }
        };

        ws.onclose = () => {
          wsConnected = false;
          if (wsPingTimer) {
            clearInterval(wsPingTimer);
            wsPingTimer = null;
          }
          if (isDisposed) return;
          setConnectionTransport(sseConnected ? 'sse' : 'polling');
          startSseFallback();
          const backoffMs = Math.min(10000, 1200 * Math.pow(1.6, wsReconnectAttempts));
          wsReconnectAttempts += 1;
          wsReconnectTimer = setTimeout(connectWebSocket, backoffMs);
        };

        ws.onerror = () => {
          wsConnected = false;
          startSseFallback();
        };
      } catch {
        startSseFallback();
      }
    };

    // Instant same-browser tab BroadcastChannel listener
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        bc = new BroadcastChannel(GATEPASS_BROADCAST_CHANNEL);
        bc.onmessage = (ev) => {
          handleIncomingPayload(ev.data);
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
  }, [enabled, role, studentId, addSecurityLog]);

  return {
    liveRingingAlert,
    dismissLiveRingingAlert: () => setLiveRingingAlert(null),
    connectionTransport,
    lastSyncServerTime,
  };
}
