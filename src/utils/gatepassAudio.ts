import { Student } from '../types';

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

// 44-byte silent PCM WAV data URL used to unlock HTML5 <audio> playback on iOS Safari / Android Chrome
const SILENT_WAV_DATA_URI =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

let sharedAudioCtx: AudioContext | null = null;
let sharedSilentAudioEl: HTMLAudioElement | null = null;
let audioUnlockedInSession = false;
let currentSpeechRunToken = 0;
let pendingBlockedAlert: { message: string; logId: string; studentNameBn?: string; action?: 'entry' | 'exit' } | null =
  null;

const activeUtterances = new Set<SpeechSynthesisUtterance>();
const unlockSubscribers = new Set<(unlocked: boolean) => void>();
const pendingAlertSubscribers = new Set<
  (pending: { message: string; logId: string; studentNameBn?: string; action?: 'entry' | 'exit' } | null) => void
>();

function notifyUnlockSubscribers() {
  for (const cb of unlockSubscribers) {
    try {
      cb(audioUnlockedInSession);
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
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

/**
 * Unlock mobile Chrome / Android WebView / iOS Safari AudioContext + HTML5 Audio + Web Speech API
 * inside any direct user gesture (login submit, button tap, or first screen touch).
 */
export function unlockMobileAudioAndSpeech(skipSpeechPrime = false): boolean {
  if (typeof window === 'undefined') return false;
  let didUnlock = false;

  try {
    const ctx = getSharedAudioContext();
    if (ctx) {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      didUnlock = true;
    }
  } catch {
    // Non-fatal
  }

  try {
    if (!sharedSilentAudioEl) {
      sharedSilentAudioEl = new Audio(SILENT_WAV_DATA_URI);
      sharedSilentAudioEl.setAttribute('playsinline', 'true');
      sharedSilentAudioEl.volume = 0.01;
    }
    const playPromise = sharedSilentAudioEl.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {});
    }
    didUnlock = true;
  } catch {
    // Non-fatal
  }

  try {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.resume();
      // Trigger voice list population early on Chromium/Android
      window.speechSynthesis.getVoices();
      if (!skipSpeechPrime && !window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
        const silentUtter = new SpeechSynthesisUtterance(' ');
        silentUtter.volume = 0;
        silentUtter.rate = 10;
        silentUtter.lang = 'bn-BD';
        activeUtterances.add(silentUtter);
        silentUtter.onend = () => activeUtterances.delete(silentUtter);
        silentUtter.onerror = () => activeUtterances.delete(silentUtter);
        window.speechSynthesis.speak(silentUtter);
      }
      didUnlock = true;
    }
  } catch {
    // Non-fatal
  }

  if (didUnlock && !audioUnlockedInSession) {
    audioUnlockedInSession = true;
    notifyUnlockSubscribers();
  }

  // If a gatepass voice alert arrived earlier before the user touched the screen, play it right now inside this gesture!
  if (pendingBlockedAlert) {
    const queued = pendingBlockedAlert;
    setPendingBlockedSpeech(null);
    playAlarmChime();
    speakBengaliSpeech(queued.message, { delayMs: 260 });
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
  speakBengaliSpeech(queued.message, { delayMs: 260 });
  return true;
}

// Web Audio API beep sound generator for realistic barcode scanner beep
export function playScannerBeep(freq = 1900, durationMs = 120): void {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
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
  } catch {
    // Audio might be blocked until user gesture
  }
}

// Clear 3-note chime for guardian alert (helps wake Bluetooth/mobile speaker before TTS begins)
export function playAlarmChime(): void {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
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
      gain.gain.linearRampToValueAtTime(0.22, now + n.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + n.start + n.dur);
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      osc1.start(now + n.start);
      osc2.start(now + n.start);
      osc1.stop(now + n.start + n.dur);
      osc2.stop(now + n.start + n.dur);
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

/**
 * Reliable cross-device Bengali TTS playback:
 * - Splits long schedule announcements by sentence to avoid Chromium's 15s cutoff bug
 * - Waits ~90ms after speechSynthesis.cancel() to prevent Android Chrome dropping the next utterance
 * - Retains utterance references to avoid mobile GC cancellation
 * - Detects autoplay block (`not-allowed` / silent timeout) and triggers `onBlocked`
 */
export function speakBengaliSpeech(text: string, options: SpeakBengaliOptions = {}): void {
  const { delayMs = 0, onStart, onEnd, onBlocked } = options;
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text.trim()) {
    onBlocked?.();
    onEnd?.();
    return;
  }

  const runToken = ++currentSpeechRunToken;
  const sentences = splitBengaliSentences(text);

  const beginPlayback = async () => {
    if (runToken !== currentSpeechRunToken) return;

    try {
      const needsCancel = window.speechSynthesis.speaking || window.speechSynthesis.pending;
      if (needsCancel) {
        window.speechSynthesis.cancel();
        // Android Chrome drops newly spoken utterances if called synchronously right after cancel()
        await new Promise((r) => setTimeout(r, 90));
      }
      if (runToken !== currentSpeechRunToken) return;

      const voices = await waitForVoices(350);
      if (runToken !== currentSpeechRunToken) return;
      const bnVoice = selectBestBengaliVoice(voices);

      try {
        window.speechSynthesis.resume();
      } catch {
        // Ignore resume failure
      }

      let anyChunkStarted = false;
      let blockedNotified = false;
      const notifyBlocked = () => {
        if (!blockedNotified) {
          blockedNotified = true;
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

        const chunkText = sentences[index];
        const utterance = new SpeechSynthesisUtterance(chunkText);
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
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore
    }
  }
  activeUtterances.clear();
}
