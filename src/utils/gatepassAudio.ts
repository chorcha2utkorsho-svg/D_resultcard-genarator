import { ScannerVoiceSettings, Student } from '../types';
import { toBengaliRoll } from './bengali';

export interface DailyScheduleConfig {
  ptStartTimeBn: string;
  classStartTimeBn: string;
  breakTimeBn: string;
  dismissalTimeBn: string;
}

export const DEFAULT_DAILY_SCHEDULE: DailyScheduleConfig = {
  ptStartTimeBn: 'আটটা পঞ্চান্ন মিনিটে',
  classStartTimeBn: 'নয়টা বিশ মিনিটে',
  breakTimeBn: 'দুপুর একটা দশ মিনিটে',
  dismissalTimeBn: 'বিকাল চারটায়',
};

export const DEFAULT_SCANNER_VOICE_SETTINGS: ScannerVoiceSettings = {
  entryMessageTemplate:
    'আসসালামু আলাইকুম ওয়া রাহমাতুল্লাহ {name}, স্বাগতম! শৃঙ্খলা, শান্ত মন, শেখার আগ্রহই তোমার সব। তোমার চূড়ান্ত সাফল্য কামনা করছি {name}।',
  exitMessageTemplate:
    'আসসালামু আলাইকুম ওয়া রাহমাতুল্লাহ {name}, বিদায়! শৃঙ্খলা ও শান্ত মন নিয়ে নিরাপদে বাড়ি ফিরে যাও। তোমার চূড়ান্ত সাফল্য কামনা করছি {name}।',
};

export function buildScannerVoiceMessage(
  student: Pick<Student, 'nameBn' | 'roll'>,
  classNameBn: string,
  action: 'entry' | 'exit',
  settings?: Partial<ScannerVoiceSettings> | null
): string {
  const defaultTemplate =
    action === 'entry'
      ? DEFAULT_SCANNER_VOICE_SETTINGS.entryMessageTemplate
      : DEFAULT_SCANNER_VOICE_SETTINGS.exitMessageTemplate;

  const rawTemplate =
    action === 'entry'
      ? settings?.entryMessageTemplate
      : settings?.exitMessageTemplate;

  const template =
    typeof rawTemplate === 'string' && rawTemplate.trim()
      ? rawTemplate.trim()
      : defaultTemplate;

  const studentName = student.nameBn || 'শিক্ষার্থী';
  const studentRoll = toBengaliRoll(student.roll || 1);
  const className = classNameBn || 'শ্রেণি';

  return template
    .replace(/\{name\}|\{নাম\}/gi, studentName)
    .replace(/\{class\}|\{শ্রেণি\}/gi, className)
    .replace(/\{roll\}|\{রোল\}/gi, studentRoll);
}

export function buildGuardianVoiceMessage(
  student: Pick<Student, 'nameBn'>,
  action: 'entry' | 'exit',
  dailySchedule?: Partial<DailyScheduleConfig> | null
): string {
  const schedule = {
    ptStartTimeBn: dailySchedule?.ptStartTimeBn || DEFAULT_DAILY_SCHEDULE.ptStartTimeBn,
    classStartTimeBn: dailySchedule?.classStartTimeBn || DEFAULT_DAILY_SCHEDULE.classStartTimeBn,
    breakTimeBn: dailySchedule?.breakTimeBn || DEFAULT_DAILY_SCHEDULE.breakTimeBn,
    dismissalTimeBn: dailySchedule?.dismissalTimeBn || DEFAULT_DAILY_SCHEDULE.dismissalTimeBn,
  };
  const studentName = student.nameBn || 'আপনার সন্তান';

  if (action === 'entry') {
    return `মনোযোগ দিন! আপনার প্রিয় ${studentName}, আপনার সন্তান ${studentName} এইমাত্র স্কুল প্রাঙ্গনে প্রবেশ করেছে। আজকে পিটি শুরু হবে ${schedule.ptStartTimeBn}, ক্লাস শুরু হবে ${schedule.classStartTimeBn}। প্রথমবার বিরতি থাকবে ${schedule.breakTimeBn}। ছুটি ${schedule.dismissalTimeBn}।`;
  }
  return `মনোযোগ দিন! আপনার প্রিয় ${studentName}, আপনার সন্তান ${studentName} এইমাত্র স্কুল প্রাঙ্গন থেকে নিরাপদে প্রস্থান করেছে।`;
}

export function buildGuardianRepeatedAlertPhrases(
  student: Pick<Student, 'nameBn'>,
  action: 'entry' | 'exit',
  dailySchedule?: Partial<DailyScheduleConfig> | null,
  repeatCount = 3
): string[] {
  const studentName = student.nameBn || 'আপনার সন্তান';
  const primary = buildGuardianVoiceMessage(student, action, dailySchedule);
  const shortRepeat =
    action === 'entry'
      ? `প্রিয় অভিভাবক, ${studentName} বিদ্যালয়ে প্রবেশ করেছে! ${studentName}-এর উপস্থিতি নিশ্চিত হয়েছে।`
      : `প্রিয় অভিভাবক, ${studentName} বিদ্যালয় থেকে নিরাপদে প্রস্থান করেছে!`;

  const phrases: string[] = [primary];
  const extraCycles = Math.max(0, Math.min(7, repeatCount - 1));
  for (let i = 0; i < extraCycles; i++) {
    phrases.push(shortRepeat);
  }
  return phrases;
}

// 44-byte silent PCM WAV data URL used to prime HTML5 <audio> on iOS Safari / Android Chrome
const SILENT_WAV_DATA_URI =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

export interface GuardianAudioHardwareStatus {
  unlocked: boolean;
  audioContextState: AudioContextState | 'unavailable';
  liveWatchActive: boolean;
  wakeLockActive: boolean;
  lastEngineUsed: 'none' | 'webaudio' | 'html_audio' | 'web_speech';
  lastPlaybackError: string | null;
}

let sharedAudioCtx: AudioContext | null = null;
let sharedCompressorNode: DynamicsCompressorNode | null = null;
let sharedVoiceAudioEl: HTMLAudioElement | null = null;
let activeBufferSource: AudioBufferSourceNode | null = null;
let activeObjectUrl: string | null = null;

function getLoudAudioDestination(ctx: AudioContext): AudioNode {
  try {
    if (!sharedCompressorNode || sharedCompressorNode.context !== ctx) {
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.setValueAtTime(-16, ctx.currentTime);
      comp.knee.setValueAtTime(12, ctx.currentTime);
      comp.ratio.setValueAtTime(4, ctx.currentTime);
      comp.attack.setValueAtTime(0.003, ctx.currentTime);
      comp.release.setValueAtTime(0.2, ctx.currentTime);
      comp.connect(ctx.destination);
      sharedCompressorNode = comp;
    }
    return sharedCompressorNode;
  } catch {
    return ctx.destination;
  }
}

// Sub-audible continuous oscillator keeping Android Chrome / iOS Safari AudioContext awake while guardian alarm is armed
let liveWatchOsc: OscillatorNode | null = null;
let liveWatchGain: GainNode | null = null;
let liveWatchDesired = false;
let wakeLockSentinel: any = null;

let voiceElementPrimed = false;
let isVoiceAudioPlaying = false;
let audioUnlockedInSession = false;
let currentSpeechRunToken = 0;
let lastEngineUsed: GuardianAudioHardwareStatus['lastEngineUsed'] = 'none';
let lastPlaybackError: string | null = null;

export interface PendingBlockedSpeechAlert {
  message: string;
  logId: string;
  studentNameBn?: string;
  action?: 'entry' | 'exit';
  dailySchedule?: Partial<DailyScheduleConfig> | null;
}

let pendingBlockedAlert: PendingBlockedSpeechAlert | null = null;

// Memory LRU cache of fetched single-sentence MP3 ArrayBuffers & decoded AudioBuffers for instant 0ms playback
const ttsArrayBufferCache = new Map<string, ArrayBuffer>();
const decodedAudioBufferCache = new Map<string, AudioBuffer>();
let hwWatchdogTimer: ReturnType<typeof setInterval> | null = null;
let lastObservedCtxState: AudioContextState | 'unavailable' = 'unavailable';
const activeUtterances = new Set<SpeechSynthesisUtterance>();
const unlockSubscribers = new Set<(unlocked: boolean) => void>();
const statusSubscribers = new Set<(status: GuardianAudioHardwareStatus) => void>();
const playbackSubscribers = new Set<(playing: boolean) => void>();
const pendingAlertSubscribers = new Set<(pending: PendingBlockedSpeechAlert | null) => void>();

export function getGuardianAudioStatus(): GuardianAudioHardwareStatus {
  return {
    unlocked: audioUnlockedInSession,
    audioContextState: sharedAudioCtx ? sharedAudioCtx.state : 'unavailable',
    liveWatchActive: Boolean(liveWatchOsc) || liveWatchDesired,
    wakeLockActive: Boolean(wakeLockSentinel),
    lastEngineUsed,
    lastPlaybackError,
  };
}

export function isSpeechActivelyPlaying(): boolean {
  return isVoiceAudioPlaying;
}

function setVoicePlayingState(playing: boolean) {
  if (isVoiceAudioPlaying === playing) return;
  isVoiceAudioPlaying = playing;
  for (const cb of playbackSubscribers) {
    try {
      cb(playing);
    } catch {
      // Ignore subscriber errors
    }
  }
}

export function subscribeSpeechPlayback(cb: (playing: boolean) => void): () => void {
  playbackSubscribers.add(cb);
  cb(isVoiceAudioPlaying);
  return () => {
    playbackSubscribers.delete(cb);
  };
}

function notifyUnlockSubscribers() {
  for (const cb of unlockSubscribers) {
    try {
      cb(audioUnlockedInSession);
    } catch {
      // Ignore subscriber errors
    }
  }
  const snap = getGuardianAudioStatus();
  for (const cb of statusSubscribers) {
    try {
      cb(snap);
    } catch {
      // Ignore subscriber errors
    }
  }
}

function notifyPendingSubscribers() {
  for (const cb of pendingAlertSubscribers) {
    try {
      cb(pendingBlockedAlert);
    } catch {
      // Ignore subscriber errors
    }
  }
}

export function isMobileAudioUnlocked(): boolean {
  return audioUnlockedInSession;
}

export function subscribeMobileAudioUnlock(cb: (unlocked: boolean) => void): () => void {
  unlockSubscribers.add(cb);
  cb(audioUnlockedInSession);
  return () => {
    unlockSubscribers.delete(cb);
  };
}

export function subscribeGuardianAudioStatus(
  cb: (status: GuardianAudioHardwareStatus) => void
): () => void {
  statusSubscribers.add(cb);
  cb(getGuardianAudioStatus());
  return () => {
    statusSubscribers.delete(cb);
  };
}

export function getPendingBlockedSpeech() {
  return pendingBlockedAlert;
}

export function setPendingBlockedSpeech(pending: PendingBlockedSpeechAlert | null) {
  pendingBlockedAlert = pending;
  notifyPendingSubscribers();
}

export function subscribePendingBlockedSpeech(
  cb: (pending: PendingBlockedSpeechAlert | null) => void
): () => void {
  pendingAlertSubscribers.add(cb);
  cb(pendingBlockedAlert);
  return () => {
    pendingAlertSubscribers.delete(cb);
  };
}

export function getSharedAudioContext(): AudioContext | null {
  try {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioCtx();
      sharedAudioCtx.onstatechange = () => {
        if (!sharedAudioCtx) return;
        const isRunning = sharedAudioCtx.state === 'running';
        if (isRunning && !audioUnlockedInSession) {
          audioUnlockedInSession = true;
        }
        notifyUnlockSubscribers();
      };
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

function getSharedVoiceAudioElement(): HTMLAudioElement | null {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
  if (!sharedVoiceAudioEl) {
    sharedVoiceAudioEl = new Audio();
    sharedVoiceAudioEl.setAttribute('playsinline', 'true');
    sharedVoiceAudioEl.setAttribute('webkit-playsinline', 'true');
    sharedVoiceAudioEl.preload = 'auto';
  }
  return sharedVoiceAudioEl;
}

function startSubAudibleKeepAlive(ctx: AudioContext): void {
  try {
    if (liveWatchOsc || ctx.state !== 'running') return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(20, ctx.currentTime);
    // Sub-audible ultra-low gain keeping Android Chrome / iOS Safari AudioContext awake while guardian alarm is armed
    gain.gain.setValueAtTime(0.00012, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    liveWatchOsc = osc;
    liveWatchGain = gain;
    notifyUnlockSubscribers();
  } catch {
    // Non-fatal
  }
}

function stopSubAudibleKeepAlive(): void {
  if (liveWatchOsc) {
    try {
      liveWatchOsc.stop();
      liveWatchOsc.disconnect();
    } catch {
      // Ignore
    }
    liveWatchOsc = null;
  }
  if (liveWatchGain) {
    try {
      liveWatchGain.disconnect();
    } catch {
      // Ignore
    }
    liveWatchGain = null;
  }
}

async function acquireWakeLock(): Promise<void> {
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
  try {
    if (!wakeLockSentinel) {
      wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
      wakeLockSentinel?.addEventListener?.('release', () => {
        wakeLockSentinel = null;
        notifyUnlockSubscribers();
      });
      notifyUnlockSubscribers();
    }
  } catch {
    // Wake lock not permitted on some browsers/battery-saver modes
  }
}

function releaseWakeLock(): void {
  if (wakeLockSentinel) {
    try {
      wakeLockSentinel.release().catch(() => {});
    } catch {
      // Ignore
    }
    wakeLockSentinel = null;
  }
}

function updateGuardianMediaSession(studentNameBn?: string) {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  try {
    const MediaMeta = (window as any).MediaMetadata;
    if (MediaMeta) {
      (navigator as any).mediaSession.metadata = new MediaMeta({
        title: studentNameBn ? `${studentNameBn} • লাইভ গেটপাস এলার্ম` : 'ডি-লিকন লাইভ গেটপাস',
        artist: 'ডি-লিকন মডেল একাডেমী',
        album: 'স্মার্ট অভিভাবক নিরাপত্তা এলার্ম',
      });
    }
    (navigator as any).mediaSession.playbackState = 'playing';
    (navigator as any).mediaSession.setActionHandler('stop', () => {
      stopBengaliSpeech();
    });
    (navigator as any).mediaSession.setActionHandler('pause', () => {
      stopBengaliSpeech();
    });
  } catch {
    // Ignore browsers without full MediaSession support
  }
}

function syncHardwareStateSnapshot(attemptResume = false): void {
  const ctx = sharedAudioCtx;
  if (attemptResume && liveWatchDesired && ctx && ctx.state === 'suspended') {
    ctx
      .resume()
      .then(() => {
        if (ctx.state === 'running' && liveWatchDesired) {
          audioUnlockedInSession = true;
          startSubAudibleKeepAlive(ctx);
        }
        lastObservedCtxState = ctx.state;
        notifyUnlockSubscribers();
      })
      .catch(() => {
        lastObservedCtxState = ctx.state;
        notifyUnlockSubscribers();
      });
    return;
  }
  const currentState: AudioContextState | 'unavailable' = ctx ? ctx.state : 'unavailable';
  if (currentState !== lastObservedCtxState) {
    lastObservedCtxState = currentState;
    if (currentState === 'running' && liveWatchDesired) {
      audioUnlockedInSession = true;
      if (ctx) startSubAudibleKeepAlive(ctx);
    }
    notifyUnlockSubscribers();
  }
}

function startHardwareStateWatchdog(): void {
  if (typeof window === 'undefined' || hwWatchdogTimer) return;
  hwWatchdogTimer = setInterval(() => {
    if (!liveWatchDesired) return;
    syncHardwareStateSnapshot(false);
  }, 4000);
}

function stopHardwareStateWatchdog(): void {
  if (hwWatchdogTimer) {
    clearInterval(hwWatchdogTimer);
    hwWatchdogTimer = null;
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      syncHardwareStateSnapshot(liveWatchDesired);
      if (liveWatchDesired) {
        void acquireWakeLock();
      }
    }
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('focus', () => {
    syncHardwareStateSnapshot(liveWatchDesired);
    if (liveWatchDesired) {
      void acquireWakeLock();
    }
  });
}

/**
 * Keep Guardian Phone AudioContext running & awake while alarm watch is armed.
 */
export function setGuardianLiveWatchActive(active: boolean): void {
  liveWatchDesired = active;
  if (active) {
    startHardwareStateWatchdog();
    const ctx = getSharedAudioContext();
    if (ctx) {
      ctx
        .resume()
        .then(() => {
          if (ctx.state === 'running' && liveWatchDesired) {
            audioUnlockedInSession = true;
            startSubAudibleKeepAlive(ctx);
          }
          lastObservedCtxState = ctx.state;
          notifyUnlockSubscribers();
        })
        .catch(() => {
          lastObservedCtxState = ctx.state;
          notifyUnlockSubscribers();
        });
    }
    void acquireWakeLock();
  } else {
    stopHardwareStateWatchdog();
    stopSubAudibleKeepAlive();
    releaseWakeLock();
    notifyUnlockSubscribers();
  }
}

export function isGuardianLiveWatchActive(): boolean {
  return liveWatchDesired;
}

export async function requestGuardianNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/**
 * Show system notification cleanly across both Desktop and Android Chrome (via ServiceWorkerRegistration.showNotification).
 */
export function showGuardianSystemNotification(title: string, body: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const opts: NotificationOptions = {
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: 'dlikon-gatepass-live',
  };

  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((reg) => reg.showNotification(title, opts))
      .catch(() => {
        try {
          new Notification(title, opts);
        } catch {
          // Ignore Android constructor restriction
        }
      });
    return;
  }

  try {
    new Notification(title, opts);
  } catch {
    // Ignore
  }
}

/**
 * Unlock mobile Chrome / Android WebView / iOS Safari AudioContext + persistent HTML5 <audio>
 * HONESTLY: only sets `audioUnlockedInSession = true` when hardware AudioContext enters 'running'
 * OR <audio>.play() genuinely resolves without NotAllowedError.
 */
export function unlockMobileAudioAndSpeech(skipSpeechPrime = false): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const ctx = getSharedAudioContext();
    if (ctx) {
      const activateBuffer = () => {
        try {
          const buffer = ctx.createBuffer(1, 1, 22050);
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          source.start(0);
          if (ctx.state === 'running') {
            audioUnlockedInSession = true;
            if (liveWatchDesired) {
              startSubAudibleKeepAlive(ctx);
            }
            notifyUnlockSubscribers();
          }
        } catch {
          // Non-fatal
        }
      };

      if (ctx.state === 'suspended') {
        ctx
          .resume()
          .then(() => {
            activateBuffer();
          })
          .catch(() => {});
      } else if (ctx.state === 'running') {
        activateBuffer();
      }
    }
  } catch {
    // Non-fatal
  }

  try {
    const voiceEl = getSharedVoiceAudioElement();
    if (voiceEl && !isVoiceAudioPlaying && (!voiceElementPrimed || voiceEl.paused)) {
      if (!voiceEl.src || voiceEl.src.startsWith('data:audio/wav')) {
        voiceEl.src = SILENT_WAV_DATA_URI;
      }
      voiceEl.muted = false;
      voiceEl.volume = voiceEl.src.startsWith('data:audio/wav') ? 0.01 : 1;
      const playPromise = voiceEl.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(() => {
            voiceElementPrimed = true;
            if (!audioUnlockedInSession) {
              audioUnlockedInSession = true;
              notifyUnlockSubscribers();
            }
          })
          .catch(() => {
            // Do NOT mark unlocked on failed silent prime (e.g. passive scroll rejected by Chrome)
          });
      }
    }
  } catch {
    // Non-fatal
  }

  try {
    if ('speechSynthesis' in window && !skipSpeechPrime) {
      window.speechSynthesis.resume();
      window.speechSynthesis.getVoices();
      if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
        const silentUtter = new SpeechSynthesisUtterance(' ');
        silentUtter.volume = 0;
        silentUtter.rate = 10;
        silentUtter.lang = 'bn-BD';
        activeUtterances.add(silentUtter);
        silentUtter.onend = () => activeUtterances.delete(silentUtter);
        silentUtter.onerror = () => activeUtterances.delete(silentUtter);
        window.speechSynthesis.speak(silentUtter);
      }
    }
  } catch {
    // Non-fatal
  }

  // If an alert arrived before user tapped screen, replay immediately once unlocked
  if (pendingBlockedAlert && (audioUnlockedInSession || (sharedAudioCtx && sharedAudioCtx.state === 'running'))) {
    const queued = pendingBlockedAlert;
    setPendingBlockedSpeech(null);
    playAlarmChime();
    if (queued.studentNameBn && queued.action) {
      speakRepeatedGuardianAlert(
        { nameBn: queued.studentNameBn },
        queued.action,
        queued.dailySchedule ?? null,
        { delayMs: 220, repeatCount: 6 }
      );
    } else {
      speakBengaliSpeech(queued.message, { delayMs: 220 });
    }
  }

  return audioUnlockedInSession;
}

export function replayPendingBlockedSpeech(): boolean {
  if (!pendingBlockedAlert) {
    unlockMobileAudioAndSpeech(true);
    return false;
  }
  const queued = pendingBlockedAlert;
  setPendingBlockedSpeech(null);
  unlockMobileAudioAndSpeech(true);
  playAlarmChime();
  if (queued.studentNameBn && queued.action) {
    speakRepeatedGuardianAlert(
      { nameBn: queued.studentNameBn },
      queued.action,
      queued.dailySchedule ?? null,
      { delayMs: 220, repeatCount: 6 }
    );
  } else {
    speakBengaliSpeech(queued.message, { delayMs: 220 });
  }
  return true;
}

// Web Audio API beep sound generator for realistic barcode scanner beep
export function playScannerBeep(freq = 1900, durationMs = 120): void {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;
    const triggerBeep = () => {
      if (ctx.state !== 'running') return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + durationMs / 1000);
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(triggerBeep).catch(() => {});
    } else {
      triggerBeep();
    }
  } catch {
    // Audio might be blocked until user gesture
  }
}

// Clear 3-note chime for guardian alert
export function playAlarmChime(): void {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;

    const triggerNotes = () => {
      if (ctx.state !== 'running') return;
      const now = ctx.currentTime;
      const notes = [
        { f1: 587.33, f2: 880, start: 0, dur: 0.16 },
        { f1: 783.99, f2: 1174.66, start: 0.16, dur: 0.16 },
        { f1: 1046.5, f2: 1567.98, start: 0.32, dur: 0.34 },
      ];
      for (const n of notes) {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.type = 'triangle';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(n.f1, now + n.start);
        osc2.frequency.setValueAtTime(n.f2, now + n.start);
        gain.gain.setValueAtTime(0.001, now + n.start);
        gain.gain.linearRampToValueAtTime(0.45, now + n.start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + n.start + n.dur);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(getLoudAudioDestination(ctx));
        osc1.start(now + n.start);
        osc2.start(now + n.start);
        osc1.stop(now + n.start + n.dur);
        osc2.stop(now + n.start + n.dur);
      }
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(triggerNotes).catch(() => {});
    } else {
      triggerNotes();
    }
  } catch {
    // Ignore audio context restriction
  }
}

/**
 * Split Bengali text strictly into <= 145 char sentence chunks so `/api/tts/bn` always returns a
 * single pure MP3 frame stream (ZERO multi-MP3 ID3 concatenation errors in AudioContext.decodeAudioData!).
 */
function splitBengaliSentences(text: string, maxLen = 145): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const rawParts = cleaned
    .split(/(?<=[।?!.])\s+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  for (const part of rawParts) {
    if (part.length <= maxLen) {
      chunks.push(part);
    } else {
      const subParts = part.split(/(?<=[,;—–])\s+/);
      let current = '';
      for (const sp of subParts) {
        if ((current + ' ' + sp).trim().length <= maxLen) {
          current = (current + ' ' + sp).trim();
        } else {
          if (current) chunks.push(current);
          if (sp.length <= maxLen) {
            current = sp;
          } else {
            const words = sp.split(/\s+/);
            current = '';
            for (const w of words) {
              if ((current + ' ' + w).trim().length <= maxLen) {
                current = (current + ' ' + w).trim();
              } else {
                if (current) chunks.push(current);
                current = w.slice(0, maxLen);
              }
            }
          }
        }
      }
      if (current) chunks.push(current);
    }
  }
  return chunks.length > 0 ? chunks : [cleaned.slice(0, maxLen)];
}

function selectBestBengaliVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;
  return (
    voices.find((v) => v.lang.toLowerCase() === 'bn-bd') ||
    voices.find((v) => v.lang.toLowerCase() === 'bn-in') ||
    voices.find((v) => v.lang.toLowerCase().startsWith('bn')) ||
    voices.find((v) => /bengali|bangla|বাংলা/i.test(v.name)) ||
    null
  );
}

function waitForVoices(timeoutMs = 350): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve([]);
      return;
    }
    const existing = window.speechSynthesis.getVoices();
    if (existing.length > 0) {
      resolve(existing);
      return;
    }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.speechSynthesis.removeEventListener?.('voiceschanged', onVoices);
      resolve(window.speechSynthesis.getVoices());
    };
    const onVoices = () => finish();
    window.speechSynthesis.addEventListener?.('voiceschanged', onVoices);
    setTimeout(finish, timeoutMs);
  });
}

export interface SpeakBengaliOptions {
  delayMs?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onBlocked?: () => void;
  studentNameBn?: string;
}

async function fetchSingleChunkTtsBuffer(chunk: string): Promise<ArrayBuffer> {
  const key = chunk.slice(0, 200);
  const cached = ttsArrayBufferCache.get(key);
  if (cached && cached.byteLength > 0) {
    return cached.slice(0);
  }

  const url = `/api/tts/bn?text=${encodeURIComponent(key)}`;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 8000) : null;
  try {
    const resp = await fetch(url, {
      cache: 'force-cache',
      signal: controller ? controller.signal : undefined,
    });
    if (!resp.ok) {
      throw new Error(`TTS HTTP ${resp.status}`);
    }
    const contentType = (resp.headers.get('content-type') || '').toLowerCase();
    if (
      (resp.url || '').includes('__cookie_check') ||
      (contentType && !contentType.includes('audio') && !contentType.includes('octet-stream'))
    ) {
      throw new Error('TTS returned non-audio response (auth/proxy redirect)');
    }
    const buf = await resp.arrayBuffer();
    if (!buf || buf.byteLength < 64) {
      throw new Error('Empty TTS audio buffer');
    }
    if (ttsArrayBufferCache.size >= 80) {
      const oldest = ttsArrayBufferCache.keys().next().value;
      if (oldest) ttsArrayBufferCache.delete(oldest);
    }
    ttsArrayBufferCache.set(key, buf.slice(0));
    return buf;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Pre-fetch and cache Bengali MP3 voice chunks for the signed-in student's arrival/exit messages
 * so incoming gatepass alerts trigger instant 0ms Web Audio playback without network latency.
 */
export async function prewarmGuardianVoiceCache(
  student: Pick<Student, 'nameBn'> | null | undefined,
  dailySchedule?: Partial<DailyScheduleConfig> | null
): Promise<void> {
  if (typeof window === 'undefined' || !student?.nameBn) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  const entryPhrases = buildGuardianRepeatedAlertPhrases(student, 'entry', dailySchedule, 2);
  const exitPhrases = buildGuardianRepeatedAlertPhrases(student, 'exit', dailySchedule, 2);
  const uniqueChunks = Array.from(
    new Set(
      [...entryPhrases, ...exitPhrases].flatMap((p) => splitBengaliSentences(p, 145))
    )
  ).slice(0, 12);

  for (const chunk of uniqueChunks) {
    const key = chunk.slice(0, 200);
    let buf: ArrayBuffer | null = ttsArrayBufferCache.get(key) || null;
    if (!buf) {
      try {
        buf = await fetchSingleChunkTtsBuffer(chunk);
      } catch {
        buf = null;
      }
    }
    if (buf && !decodedAudioBufferCache.has(key) && sharedAudioCtx && sharedAudioCtx.state === 'running') {
      try {
        const decoded = await sharedAudioCtx.decodeAudioData(buf.slice(0));
        if (decodedAudioBufferCache.size >= 80) {
          const oldest = decodedAudioBufferCache.keys().next().value;
          if (oldest) decodedAudioBufferCache.delete(oldest);
        }
        decodedAudioBufferCache.set(key, decoded);
      } catch {
        // Non-fatal decode prewarm skip
      }
    }
  }
}

function playSingleDecodedBuffer(
  ctx: AudioContext,
  audioBuffer: AudioBuffer,
  runToken: number
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (runToken !== currentSpeechRunToken) {
      resolve(false);
      return;
    }
    try {
      if (activeBufferSource) {
        try {
          activeBufferSource.onended = null;
          activeBufferSource.stop();
          activeBufferSource.disconnect();
        } catch {
          // Ignore
        }
        activeBufferSource = null;
      }

      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = audioBuffer;
      gain.gain.setValueAtTime(1.65, ctx.currentTime);
      source.connect(gain);
      gain.connect(getLoudAudioDestination(ctx));

      activeBufferSource = source;
      let done = false;
      const safetyTimeout = setTimeout(() => {
        if (!done) {
          done = true;
          resolve(true);
        }
      }, Math.max(1500, Math.ceil((audioBuffer.duration || 3) * 1000) + 1200));

      source.onended = () => {
        clearTimeout(safetyTimeout);
        if (activeBufferSource === source) {
          activeBufferSource = null;
        }
        try {
          source.disconnect();
          gain.disconnect();
        } catch {
          // Ignore
        }
        if (!done) {
          done = true;
          resolve(runToken === currentSpeechRunToken);
        }
      };

      source.start(0);
    } catch (err: any) {
      lastPlaybackError = String(err?.message || 'WebAudio start failed');
      resolve(false);
    }
  });
}

async function playChunksViaWebAudio(
  chunks: string[],
  buffers: (ArrayBuffer | null)[],
  runToken: number,
  options: { onFirstStart?: () => void }
): Promise<boolean> {
  const ctx = getSharedAudioContext();
  if (!ctx) return false;

  try {
    if (ctx.state === 'suspended') {
      await Promise.race([
        ctx.resume(),
        new Promise<void>((_, rej) => setTimeout(() => rej(new Error('AudioContext resume timeout')), 1200)),
      ]);
    }
    if (ctx.state !== 'running') {
      return false;
    }

    let started = false;
    for (let i = 0; i < chunks.length; i++) {
      if (runToken !== currentSpeechRunToken) return true;
      const chunkKey = chunks[i].slice(0, 200);
      let decoded = decodedAudioBufferCache.get(chunkKey);
      if (!decoded) {
        const rawBuf = buffers[i];
        if (!rawBuf || rawBuf.byteLength === 0) continue;
        decoded = await ctx.decodeAudioData(rawBuf.slice(0));
        if (decodedAudioBufferCache.size >= 80) {
          const oldest = decodedAudioBufferCache.keys().next().value;
          if (oldest) decodedAudioBufferCache.delete(oldest);
        }
        decodedAudioBufferCache.set(chunkKey, decoded);
      }
      if (runToken !== currentSpeechRunToken) return true;

      if (!started) {
        started = true;
        setVoicePlayingState(true);
        lastEngineUsed = 'webaudio';
        lastPlaybackError = null;
        audioUnlockedInSession = true;
        notifyUnlockSubscribers();
        options.onFirstStart?.();
      }

      const completed = await playSingleDecodedBuffer(ctx, decoded, runToken);
      if (!completed || runToken !== currentSpeechRunToken) {
        return true;
      }
    }
    return started;
  } catch (err: any) {
    lastPlaybackError = String(err?.message || err || 'WebAudio decode failed');
    return false;
  }
}

function playSingleHtmlAudioChunk(
  arrBuf: ArrayBuffer | null,
  fallbackUrl: string,
  runToken: number,
  onFirstStart?: () => void
): Promise<'ended' | 'aborted' | 'failed'> {
  const audioEl = getSharedVoiceAudioElement();
  if (!audioEl) return Promise.resolve('failed');

  return new Promise((resolve) => {
    let settled = false;
    let started = false;

    const cleanup = () => {
      audioEl.onplaying = null;
      audioEl.onended = null;
      audioEl.onerror = null;
    };

    const finish = (outcome: 'ended' | 'aborted' | 'failed', errMsg?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(loadTimeout);
      cleanup();
      if (errMsg) lastPlaybackError = errMsg;
      resolve(outcome);
    };

    const loadTimeout = setTimeout(() => {
      if (!started) {
        finish('failed', 'HTMLAudio timeout');
      }
    }, 2500);

    audioEl.onplaying = () => {
      if (runToken !== currentSpeechRunToken) {
        try {
          audioEl.pause();
        } catch {}
        finish('aborted');
        return;
      }
      started = true;
      clearTimeout(loadTimeout);
      setVoicePlayingState(true);
      voiceElementPrimed = true;
      lastEngineUsed = 'html_audio';
      lastPlaybackError = null;
      if (!audioUnlockedInSession) {
        audioUnlockedInSession = true;
        notifyUnlockSubscribers();
      }
      onFirstStart?.();
    };

    audioEl.onended = () => {
      if (activeObjectUrl) {
        try {
          URL.revokeObjectURL(activeObjectUrl);
        } catch {}
        activeObjectUrl = null;
      }
      finish(runToken === currentSpeechRunToken ? 'ended' : 'aborted');
    };

    audioEl.onerror = () => {
      finish('failed', 'HTMLAudio element error');
    };

    try {
      if (activeObjectUrl) {
        try {
          URL.revokeObjectURL(activeObjectUrl);
        } catch {}
        activeObjectUrl = null;
      }

      if (arrBuf) {
        const blob = new Blob([arrBuf], { type: 'audio/mpeg' });
        activeObjectUrl = URL.createObjectURL(blob);
        audioEl.src = activeObjectUrl;
      } else {
        audioEl.src = fallbackUrl;
      }

      audioEl.muted = false;
      audioEl.volume = 1;
      audioEl.playbackRate = 1.0;

      const playPromise = audioEl.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.catch((err: any) => {
          finish('failed', String(err?.name || err?.message || 'HTMLAudio play rejected'));
        });
      }
    } catch (err: any) {
      finish('failed', String(err?.message || 'HTMLAudio setup failed'));
    }
  });
}

async function playChunksViaHtmlAudio(
  chunks: string[],
  buffers: (ArrayBuffer | null)[],
  runToken: number,
  options: { onFirstStart?: () => void }
): Promise<boolean> {
  let startedAny = false;
  for (let i = 0; i < chunks.length; i++) {
    if (runToken !== currentSpeechRunToken) return true;
    const chunk = chunks[i];
    const buf = buffers[i] || null;
    const url = `/api/tts/bn?text=${encodeURIComponent(chunk.slice(0, 200))}`;
    const outcome = await playSingleHtmlAudioChunk(buf, url, runToken, () => {
      if (!startedAny) {
        startedAny = true;
        options.onFirstStart?.();
      }
    });
    if (outcome === 'aborted') return true;
    if (outcome === 'failed') return startedAny;
  }
  return startedAny;
}

async function playWithWebSpeechFallback(
  sentences: string[],
  runToken: number,
  options: { onFirstStart?: () => void; onBlocked?: () => void }
): Promise<boolean> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || sentences.length === 0) {
    options.onBlocked?.();
    return false;
  }

  return new Promise<boolean>((resolve) => {
    const startExec = async () => {
      try {
        const needsCancel = window.speechSynthesis.speaking || window.speechSynthesis.pending;
        if (needsCancel) {
          window.speechSynthesis.cancel();
          await new Promise((r) => setTimeout(r, 90));
        }
        if (runToken !== currentSpeechRunToken) {
          resolve(false);
          return;
        }

        const voices = await waitForVoices(350);
        if (runToken !== currentSpeechRunToken) {
          resolve(false);
          return;
        }
        const bnVoice = selectBestBengaliVoice(voices);
        if (voices.length > 0 && !bnVoice) {
          // Many Android phones report voices list without a bn-BD voice pack and play silence on speak()
          lastPlaybackError = 'Bengali voice pack unavailable for Web Speech';
          notifyUnlockSubscribers();
          options.onBlocked?.();
          resolve(false);
          return;
        }

        try {
          window.speechSynthesis.resume();
        } catch {
          // Ignore
        }

        let anyChunkStarted = false;
        let blockedNotified = false;
        const notifyBlocked = () => {
          if (!blockedNotified) {
            blockedNotified = true;
            lastPlaybackError = 'Mobile browser blocked background speech synthesis';
            notifyUnlockSubscribers();
            options.onBlocked?.();
          }
        };

        const speakChunk = (index: number) => {
          if (runToken !== currentSpeechRunToken) {
            resolve(anyChunkStarted);
            return;
          }
          if (index >= sentences.length) {
            if (!anyChunkStarted) {
              notifyBlocked();
            }
            resolve(anyChunkStarted);
            return;
          }

          const utterance = new SpeechSynthesisUtterance(sentences[index]);
          utterance.rate = 0.94;
          utterance.pitch = 1.02;
          utterance.volume = 1;
          utterance.lang = bnVoice?.lang || 'bn-BD';
          if (bnVoice) {
            utterance.voice = bnVoice;
          }

          activeUtterances.add(utterance);

          let chunkStarted = false;
          const startWatchdog =
            index === 0
              ? setTimeout(() => {
                  if (!chunkStarted && !anyChunkStarted && runToken === currentSpeechRunToken) {
                    notifyBlocked();
                    resolve(false);
                  }
                }, 1300)
              : null;

          utterance.onstart = () => {
            chunkStarted = true;
            if (startWatchdog) clearTimeout(startWatchdog);
            if (!anyChunkStarted) {
              anyChunkStarted = true;
              setVoicePlayingState(true);
              lastEngineUsed = 'web_speech';
              lastPlaybackError = null;
              options.onFirstStart?.();
            }
          };

          utterance.onend = () => {
            if (startWatchdog) clearTimeout(startWatchdog);
            activeUtterances.delete(utterance);
            if (!anyChunkStarted) {
              notifyBlocked();
              resolve(false);
              return;
            }
            if (runToken === currentSpeechRunToken) {
              speakChunk(index + 1);
            } else {
              resolve(anyChunkStarted);
            }
          };

          utterance.onerror = (ev) => {
            if (startWatchdog) clearTimeout(startWatchdog);
            activeUtterances.delete(utterance);
            const errCode = (ev as SpeechSynthesisErrorEvent)?.error || '';
            if (
              errCode === 'not-allowed' ||
              errCode === 'audio-busy' ||
              errCode === 'synthesis-failed' ||
              !anyChunkStarted
            ) {
              notifyBlocked();
            }
            resolve(anyChunkStarted);
          };

          window.speechSynthesis.speak(utterance);
        };

        speakChunk(0);
      } catch {
        options.onBlocked?.();
        resolve(false);
      }
    };
    void startExec();
  });
}

function haltCurrentPlaybackPreserveToken() {
  setVoicePlayingState(false);

  if (activeBufferSource) {
    try {
      activeBufferSource.onended = null;
      activeBufferSource.stop();
      activeBufferSource.disconnect();
    } catch {
      // Ignore
    }
    activeBufferSource = null;
  }

  const voiceEl = getSharedVoiceAudioElement();
  if (voiceEl) {
    try {
      voiceEl.onplaying = null;
      voiceEl.onended = null;
      voiceEl.onerror = null;
      voiceEl.pause();
    } catch {
      // Ignore
    }
  }
}

async function playPhraseList(
  phrases: string[],
  runToken: number,
  options: {
    pauseBetweenMs?: number;
    chimeBetweenCycles?: boolean;
    studentNameBn?: string;
    onStart?: () => void;
    onEnd?: () => void;
    onBlocked?: () => void;
  }
) {
  const { pauseBetweenMs = 850, chimeBetweenCycles = false, studentNameBn, onStart, onEnd, onBlocked } = options;
  const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
  let notifiedStart = false;
  let playedAnyPhrase = false;
  let blockedReported = false;

  const fireStartOnce = () => {
    if (!notifiedStart) {
      notifiedStart = true;
      updateGuardianMediaSession(studentNameBn);
      onStart?.();
    }
  };

  const fireBlockedOnce = () => {
    if (!blockedReported) {
      blockedReported = true;
      onBlocked?.();
    }
  };

  for (let pIdx = 0; pIdx < phrases.length; pIdx++) {
    if (runToken !== currentSpeechRunToken) break;
    const phrase = phrases[pIdx].replace(/\s+/g, ' ').trim();
    if (!phrase) continue;

    if (pIdx > 0) {
      await new Promise((r) => setTimeout(r, pauseBetweenMs));
      if (runToken !== currentSpeechRunToken) break;
      if (chimeBetweenCycles && pIdx >= 1) {
        playAlarmChime();
        await new Promise((r) => setTimeout(r, 420));
        if (runToken !== currentSpeechRunToken) break;
      }
    }

    const sentenceChunks = splitBengaliSentences(phrase, 145);
    let playedPhrase = false;

    if (isOnline) {
      const fetchedBuffers: (ArrayBuffer | null)[] = await Promise.all(
        sentenceChunks.map((chunk) =>
          fetchSingleChunkTtsBuffer(chunk).catch((err: any) => {
            lastPlaybackError = String(err?.message || 'TTS fetch failed');
            return null;
          })
        )
      );
      if (runToken !== currentSpeechRunToken) break;

      if (fetchedBuffers.some(Boolean)) {
        playedPhrase = await playChunksViaWebAudio(sentenceChunks, fetchedBuffers, runToken, {
          onFirstStart: fireStartOnce,
        });
      }

      if (!playedPhrase && runToken === currentSpeechRunToken) {
        playedPhrase = await playChunksViaHtmlAudio(sentenceChunks, fetchedBuffers, runToken, {
          onFirstStart: fireStartOnce,
        });
      }
    }

    if (playedPhrase) {
      playedAnyPhrase = true;
      continue;
    }

    if (runToken === currentSpeechRunToken) {
      playedPhrase = await playWithWebSpeechFallback(sentenceChunks, runToken, {
        onFirstStart: fireStartOnce,
        onBlocked: pIdx === 0 ? fireBlockedOnce : undefined,
      });
      if (playedPhrase) {
        playedAnyPhrase = true;
      } else {
        if (!playedAnyPhrase) fireBlockedOnce();
        break;
      }
    }
  }

  if (runToken === currentSpeechRunToken) {
    if (!playedAnyPhrase) {
      fireBlockedOnce();
    }
    setVoicePlayingState(false);
    onEnd?.();
  }
}

/**
 * Reliable cross-device Bengali TTS playback:
 * Splits text into clean single-sentence chunks (<=145 chars) so every MP3 decodes reliably
 * on Android Chrome & iOS Safari via AudioContext, with HTML5 Audio & Web Speech fallbacks.
 */
export function speakBengaliSpeech(text: string, options: SpeakBengaliOptions = {}): void {
  const { delayMs = 0, onStart, onEnd, onBlocked, studentNameBn } = options;
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (typeof window === 'undefined' || !cleaned) {
    onBlocked?.();
    onEnd?.();
    return;
  }

  const runToken = ++currentSpeechRunToken;
  haltCurrentPlaybackPreserveToken();

  const startFn = () => {
    if (runToken !== currentSpeechRunToken) return;
    void playPhraseList([cleaned], runToken, {
      studentNameBn,
      onStart,
      onEnd,
      onBlocked,
    });
  };

  if (delayMs > 0) {
    setTimeout(startFn, delayMs);
  } else {
    startFn();
  }
}

/**
 * Repeat Guardian Voice Notification multiple times calling the student's name clearly
 * until stopped or all repeat rounds finish cleanly.
 */
export function speakRepeatedGuardianAlert(
  student: Pick<Student, 'nameBn'>,
  action: 'entry' | 'exit',
  dailySchedule?: Partial<DailyScheduleConfig> | null,
  options: SpeakBengaliOptions & { repeatCount?: number } = {}
): void {
  const { delayMs = 0, repeatCount = 3, onStart, onEnd, onBlocked } = options;
  if (typeof window === 'undefined') {
    onBlocked?.();
    onEnd?.();
    return;
  }

  const phrases = buildGuardianRepeatedAlertPhrases(student, action, dailySchedule, repeatCount);
  const runToken = ++currentSpeechRunToken;
  haltCurrentPlaybackPreserveToken();

  const startFn = () => {
    if (runToken !== currentSpeechRunToken) return;
    void playPhraseList(phrases, runToken, {
      pauseBetweenMs: 950,
      chimeBetweenCycles: true,
      studentNameBn: student.nameBn,
      onStart,
      onEnd,
      onBlocked,
    });
  };

  if (delayMs > 0) {
    setTimeout(startFn, delayMs);
  } else {
    startFn();
  }
}

export function stopBengaliSpeech(): void {
  currentSpeechRunToken++;
  haltCurrentPlaybackPreserveToken();

  if (activeObjectUrl) {
    try {
      URL.revokeObjectURL(activeObjectUrl);
    } catch {}
    activeObjectUrl = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore
    }
  }
  activeUtterances.clear();
  if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
    try {
      (navigator as any).mediaSession.playbackState = 'none';
    } catch {}
  }
}
