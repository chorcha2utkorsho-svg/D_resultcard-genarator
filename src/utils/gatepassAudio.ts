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
    'স্বাগতম {name}, শৃঙ্খলা, শান্ত মন, শেখার আগ্রহই তোমার সব। তোমার চূড়ান্ত সাফল্য কামনা করছি {name}।',
  exitMessageTemplate:
    'বিদায় {name}, শৃঙ্খলা ও শান্ত মন নিয়ে নিরাপদে বাড়ি ফিরে যাও। তোমার চূড়ান্ত সাফল্য কামনা করছি {name}।',
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

  if (action === 'entry') {
    return `আপনার প্রিয় ${student.nameBn} এইমাত্র স্কুল প্রাঙ্গনে প্রবেশ করেছে। আজকে পিটি শুরু হবে ${schedule.ptStartTimeBn}, ক্লাস শুরু হবে ${schedule.classStartTimeBn}। প্রথমবার বিরতি থাকবে ${schedule.breakTimeBn}। ছুটি ${schedule.dismissalTimeBn}।`;
  }
  return `আপনার প্রিয় ${student.nameBn} এইমাত্র স্কুল প্রাঙ্গন থেকে নিরাপদে প্রস্থান করেছে।`;
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
let sharedVoiceAudioEl: HTMLAudioElement | null = null;
let activeBufferSource: AudioBufferSourceNode | null = null;
let activeObjectUrl: string | null = null;

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

let pendingBlockedAlert: {
  message: string;
  logId: string;
  studentNameBn?: string;
  action?: 'entry' | 'exit';
} | null = null;

// Memory LRU cache of fetched MP3 ArrayBuffers so repeat alerts/replays start in <5ms
const ttsArrayBufferCache = new Map<string, ArrayBuffer>();
const activeUtterances = new Set<SpeechSynthesisUtterance>();
const unlockSubscribers = new Set<(unlocked: boolean) => void>();
const statusSubscribers = new Set<(status: GuardianAudioHardwareStatus) => void>();
const pendingAlertSubscribers = new Set<
  (pending: { message: string; logId: string; studentNameBn?: string; action?: 'entry' | 'exit' } | null) => void
>();

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

export function setPendingBlockedSpeech(
  pending: { message: string; logId: string; studentNameBn?: string; action?: 'entry' | 'exit' } | null
) {
  pendingBlockedAlert = pending;
  notifyPendingSubscribers();
}

export function subscribePendingBlockedSpeech(
  cb: (pending: { message: string; logId: string; studentNameBn?: string; action?: 'entry' | 'exit' } | null) => void
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
    // Inaudible DC/ultra-low amplitude just to prevent Android Chrome / iOS Safari from suspending AudioContext
    gain.gain.setValueAtTime(0.00008, ctx.currentTime);
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

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && liveWatchDesired) {
      const ctx = getSharedAudioContext();
      if (ctx) {
        ctx
          .resume()
          .then(() => {
            if (ctx.state === 'running' && liveWatchDesired) {
              startSubAudibleKeepAlive(ctx);
            }
          })
          .catch(() => {});
      }
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
    const ctx = getSharedAudioContext();
    if (ctx) {
      ctx
        .resume()
        .then(() => {
          if (ctx.state === 'running' && liveWatchDesired) {
            audioUnlockedInSession = true;
            startSubAudibleKeepAlive(ctx);
          }
          notifyUnlockSubscribers();
        })
        .catch(() => {});
    }
    void acquireWakeLock();
  } else {
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
    speakBengaliSpeech(queued.message, { delayMs: 280 });
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
  speakBengaliSpeech(queued.message, { delayMs: 280 });
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
        gain.gain.linearRampToValueAtTime(0.28, now + n.start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + n.start + n.dur);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
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

function splitBengaliSentences(text: string): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const rawParts = cleaned
    .split(/(?<=[।?!.])\s+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  for (const part of rawParts) {
    if (part.length <= 165) {
      chunks.push(part);
    } else {
      const subParts = part.split(/(?<=[,;])\s+/);
      let current = '';
      for (const sp of subParts) {
        if ((current + ' ' + sp).trim().length <= 165) {
          current = (current + ' ' + sp).trim();
        } else {
          if (current) chunks.push(current);
          current = sp;
        }
      }
      if (current) chunks.push(current);
    }
  }
  return chunks.length > 0 ? chunks : [cleaned];
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
}

async function fetchBengaliTtsBuffer(cleanedText: string): Promise<ArrayBuffer> {
  const key = cleanedText.slice(0, 1450);
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
    const buf = await resp.arrayBuffer();
    if (!buf || buf.byteLength === 0) {
      throw new Error('Empty TTS audio buffer');
    }
    if (ttsArrayBufferCache.size >= 40) {
      const oldest = ttsArrayBufferCache.keys().next().value;
      if (oldest) ttsArrayBufferCache.delete(oldest);
    }
    ttsArrayBufferCache.set(key, buf.slice(0));
    return buf;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function playBufferViaWebAudio(
  arrBuf: ArrayBuffer,
  runToken: number,
  options: SpeakBengaliOptions
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

    const audioBuffer = await ctx.decodeAudioData(arrBuf.slice(0));
    if (runToken !== currentSpeechRunToken) return true;

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
    gain.gain.setValueAtTime(1.15, ctx.currentTime);
    source.connect(gain);
    gain.connect(ctx.destination);

    activeBufferSource = source;
    isVoiceAudioPlaying = true;
    lastEngineUsed = 'webaudio';
    lastPlaybackError = null;
    audioUnlockedInSession = true;
    notifyUnlockSubscribers();

    source.onended = () => {
      if (activeBufferSource === source) {
        activeBufferSource = null;
      }
      try {
        source.disconnect();
        gain.disconnect();
      } catch {
        // Ignore
      }
      isVoiceAudioPlaying = false;
      if (runToken === currentSpeechRunToken) {
        options.onEnd?.();
      }
    };

    source.start(0);
    options.onStart?.();
    return true;
  } catch (err: any) {
    lastPlaybackError = String(err?.message || err || 'WebAudio decode failed');
    isVoiceAudioPlaying = false;
    return false;
  }
}

async function playViaHtmlAudioElement(
  arrBuf: ArrayBuffer | null,
  fallbackUrl: string,
  runToken: number,
  options: SpeakBengaliOptions
): Promise<boolean> {
  const audioEl = getSharedVoiceAudioElement();
  if (!audioEl) return false;

  return new Promise<boolean>((resolve) => {
    let settled = false;
    let started = false;

    const cleanupListeners = () => {
      audioEl.onplaying = null;
      audioEl.onended = null;
      audioEl.onerror = null;
    };

    const fail = (errMsg?: string) => {
      if (settled) return;
      settled = true;
      isVoiceAudioPlaying = false;
      clearTimeout(loadTimeout);
      cleanupListeners();
      if (errMsg) lastPlaybackError = errMsg;
      resolve(false);
    };

    const loadTimeout = setTimeout(() => {
      if (!started && !settled) {
        fail('HTMLAudio timeout');
      }
    }, 5500);

    audioEl.onplaying = () => {
      if (runToken !== currentSpeechRunToken) {
        try {
          audioEl.pause();
        } catch {}
        clearTimeout(loadTimeout);
        cleanupListeners();
        if (!settled) {
          settled = true;
          resolve(true);
        }
        return;
      }
      started = true;
      settled = true;
      isVoiceAudioPlaying = true;
      voiceElementPrimed = true;
      lastEngineUsed = 'html_audio';
      lastPlaybackError = null;
      if (!audioUnlockedInSession) {
        audioUnlockedInSession = true;
        notifyUnlockSubscribers();
      }
      clearTimeout(loadTimeout);
      options.onStart?.();
      resolve(true);
    };

    audioEl.onended = () => {
      isVoiceAudioPlaying = false;
      clearTimeout(loadTimeout);
      cleanupListeners();
      if (activeObjectUrl) {
        try {
          URL.revokeObjectURL(activeObjectUrl);
        } catch {}
        activeObjectUrl = null;
      }
      if (runToken === currentSpeechRunToken) {
        options.onEnd?.();
      }
      if (!settled) {
        settled = true;
        resolve(true);
      }
    };

    audioEl.onerror = () => {
      fail('HTMLAudio element error');
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
          fail(String(err?.name || err?.message || 'HTMLAudio play rejected'));
        });
      }
    } catch (err: any) {
      fail(String(err?.message || 'HTMLAudio setup failed'));
    }
  });
}

async function playWithWebSpeechFallback(
  text: string,
  runToken: number,
  options: SpeakBengaliOptions
): Promise<void> {
  const { onStart, onEnd, onBlocked } = options;
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onBlocked?.();
    onEnd?.();
    return;
  }

  const sentences = splitBengaliSentences(text);

  try {
    const needsCancel = window.speechSynthesis.speaking || window.speechSynthesis.pending;
    if (needsCancel) {
      window.speechSynthesis.cancel();
      await new Promise((r) => setTimeout(r, 90));
    }
    if (runToken !== currentSpeechRunToken) return;

    const voices = await waitForVoices(350);
    if (runToken !== currentSpeechRunToken) return;
    const bnVoice = selectBestBengaliVoice(voices);

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
        onBlocked?.();
      }
    };

    const speakChunk = (index: number) => {
      if (runToken !== currentSpeechRunToken) {
        onEnd?.();
        return;
      }
      if (index >= sentences.length) {
        onEnd?.();
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
              }
            }, 1300)
          : null;

      utterance.onstart = () => {
        chunkStarted = true;
        if (startWatchdog) clearTimeout(startWatchdog);
        if (!anyChunkStarted) {
          anyChunkStarted = true;
          lastEngineUsed = 'web_speech';
          lastPlaybackError = null;
          onStart?.();
        }
      };

      utterance.onend = () => {
        if (startWatchdog) clearTimeout(startWatchdog);
        activeUtterances.delete(utterance);
        if (runToken === currentSpeechRunToken) {
          speakChunk(index + 1);
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
        onEnd?.();
      };

      window.speechSynthesis.speak(utterance);
    };

    speakChunk(0);
  } catch {
    onBlocked?.();
    onEnd?.();
  }
}

/**
 * Reliable cross-device Bengali TTS playback:
 * 1. Tier 1 (Mobile-Proof): Fetch `/api/tts/bn` MP3 -> `ctx.decodeAudioData()` -> play on unlocked `AudioContext`.
 *    Works asynchronously from WebSocket/SSE/Polling hours after initial tap on Android Chrome & iOS Safari!
 * 2. Tier 2: Persistent `HTMLAudioElement` using Blob ObjectURL (or direct streaming URL).
 * 3. Tier 3: Web Speech API fallback (offline / desktop).
 */
export function speakBengaliSpeech(text: string, options: SpeakBengaliOptions = {}): void {
  const { delayMs = 0, onStart, onEnd, onBlocked } = options;
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (typeof window === 'undefined' || !cleaned) {
    onBlocked?.();
    onEnd?.();
    return;
  }

  const runToken = ++currentSpeechRunToken;

  // Halt any prior speech cleanly
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
  isVoiceAudioPlaying = false;

  const beginPlayback = async () => {
    if (runToken !== currentSpeechRunToken) return;

    const ttsUrl = `/api/tts/bn?text=${encodeURIComponent(cleaned.slice(0, 1450))}`;
    const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;

    if (isOnline) {
      let arrBuf: ArrayBuffer | null = null;
      try {
        arrBuf = await fetchBengaliTtsBuffer(cleaned);
      } catch (err: any) {
        lastPlaybackError = String(err?.message || 'TTS fetch failed');
        arrBuf = null;
      }

      if (runToken !== currentSpeechRunToken) return;

      // Tier 1: Unlocked Web Audio API Buffer playback (never triggers HTMLMediaElement NotAllowedError)
      if (arrBuf) {
        const playedViaWebAudio = await playBufferViaWebAudio(arrBuf, runToken, options);
        if (playedViaWebAudio) return;
      }

      if (runToken !== currentSpeechRunToken) return;

      // Tier 2: HTML5 Audio fallback (using pre-fetched Blob URL or direct URL)
      const playedViaHtml = await playViaHtmlAudioElement(arrBuf, ttsUrl, runToken, options);
      if (playedViaHtml) return;
    }

    if (runToken !== currentSpeechRunToken) return;

    // Tier 3: Web Speech API offline/backup
    await playWithWebSpeechFallback(cleaned, runToken, options);
  };

  if (delayMs > 0) {
    setTimeout(() => {
      void beginPlayback();
    }, delayMs);
  } else {
    void beginPlayback();
  }
}

export function stopBengaliSpeech(): void {
  currentSpeechRunToken++;
  isVoiceAudioPlaying = false;

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

  if (sharedVoiceAudioEl) {
    try {
      sharedVoiceAudioEl.onplaying = null;
      sharedVoiceAudioEl.onended = null;
      sharedVoiceAudioEl.onerror = null;
      sharedVoiceAudioEl.pause();
    } catch {
      // Ignore
    }
  }
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
}
