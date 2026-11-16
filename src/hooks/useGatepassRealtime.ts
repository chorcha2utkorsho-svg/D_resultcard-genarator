import { useEffect, useRef, useState } from 'react';
import { useSchool } from '../context/SchoolContext';
import { PortalRole, SecurityGatepassLog } from '../types';
import {
  buildGuardianVoiceMessage,
  playAlarmChime,
  setPendingBlockedSpeech,
  speakBengaliSpeech,
  unlockMobileAudioAndSpeech,
} from '../utils/gatepassAudio';

// Shared module-level dedup set (synced with sessionStorage) so WS + SSE + HTTP polling + Firestore never double-play the same scan ID
const SEEN_LOGS_STORAGE_KEY = 'dlikon_seen_gatepass_log_ids_v1';
export const seenGatepassLogIds = new Set<string>(
  (() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = sessionStorage.getItem(SEEN_LOGS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
    } catch {
      return [];
    }
  })()
);

export function markGatepassLogSeen(id: string): void {
  if (!id) return;
  seenGatepassLogIds.add(id);
  if (typeof window === 'undefined') return;
  try {
    const recent = Array.from(seenGatepassLogIds).slice(-200);
    sessionStorage.setItem(SEEN_LOGS_STORAGE_KEY, JSON.stringify(recent));
  } catch {
    // Ignore storage limit errors
  }
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

  const studentsRef = useRef(students);
  studentsRef.current = students;

  const scheduleRef = useRef(schoolInfo.dailySchedule);
  scheduleRef.current = schoolInfo.dailySchedule;

  const schoolNameRef = useRef(schoolInfo.name);
  schoolNameRef.current = schoolInfo.name;

  const lastServerTimeRef = useRef<number>(0);
  const hasBaselineRef = useRef<boolean>(false);
  const ringClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Passive first-touch unlock on mobile phones (crucial when PWA auto-logs in without a button click)
  useEffect(() => {
    if (!enabled || role !== 'student' || typeof window === 'undefined') return;

    const handleFirstUserGesture = () => {
      unlockMobileAudioAndSpeech(true);
    };

    window.addEventListener('pointerdown', handleFirstUserGesture, { capture: true, passive: true });
    window.addEventListener('touchstart', handleFirstUserGesture, { capture: true, passive: true });
    window.addEventListener('keydown', handleFirstUserGesture, { capture: true, passive: true });

    return () => {
      window.removeEventListener('pointerdown', handleFirstUserGesture, { capture: true });
      window.removeEventListener('touchstart', handleFirstUserGesture, { capture: true });
      window.removeEventListener('keydown', handleFirstUserGesture, { capture: true });
    };
  }, [enabled, role]);

  useEffect(() => {
    if (!enabled || !role) return;
    if (role === 'student' && !studentId) return;

    hasBaselineRef.current = false;
    lastServerTimeRef.current = 0;

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
      }, 8000);

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate([220, 90, 220, 90, 350]);
        } catch {
          // Ignore
        }
      }

      if (!isGuardianAudioEnabledPref()) return;

      playAlarmChime();

      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(`${schoolNameRef.current || 'ডি-লিকন একাডেমী'} • লাইভ গেটপাস`, {
            body: message,
            icon: '/pwa-192x192.png',
          });
        } catch {
          // Ignore
        }
      }

      speakBengaliSpeech(message, {
        delayMs: 420,
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

      if (rawPayload.type === 'gatepass:init') {
        const logs: SecurityGatepassLog[] = Array.isArray(rawPayload.logs) ? rawPayload.logs : [];
        const isFirstInit = !hasBaselineRef.current;
        hasBaselineRef.current = true;

        let newestRecentUnseen: SecurityGatepassLog | null = null;
        for (const item of logs) {
          if (!item || !item.id) continue;
          addSecurityLog(item);
          const alreadySeen = seenGatepassLogIds.has(item.id);
          markGatepassLogSeen(item.id);
          if (isFirstInit && !alreadySeen && role === 'student' && item.studentId === studentId) {
            const logMs =
              typeof item.serverTimestamp === 'number'
                ? item.serverTimestamp
                : new Date(item.timestamp).getTime() || 0;
            if (!newestRecentUnseen && logMs >= serverTime - 25000 && !item.guardianAcknowledged) {
              newestRecentUnseen = item;
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
        if (seenGatepassLogIds.has(incomingLog.id)) return;
        markGatepassLogSeen(incomingLog.id);
        hasBaselineRef.current = true;
        triggerAlertForStudent(incomingLog);
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
            if (!seenGatepassLogIds.has(log.id)) {
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

        // If WebSocket takes too long behind a restrictive proxy, spin up SSE alongside
        if (sseFallbackTimer) clearTimeout(sseFallbackTimer);
        sseFallbackTimer = setTimeout(() => {
          if (!wsConnected && !isDisposed) {
            startSseFallback();
          }
        }, 2500);

        ws.onopen = () => {
          wsConnected = true;
          wsReconnectAttempts = 0;
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

    // Connect WebSocket immediately + baseline poll
    connectWebSocket();
    void pollLatestLogs();

    // Adaptive polling: fast 2.5s whenever neither WS nor SSE is open, 12s background reconciliation otherwise
    let lastPollTick = Date.now();
    pollTimer = setInterval(() => {
      const now = Date.now();
      const isPushActive = wsConnected || sseConnected;
      if (!isPushActive || now - lastPollTick >= 12000) {
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
  };
}
