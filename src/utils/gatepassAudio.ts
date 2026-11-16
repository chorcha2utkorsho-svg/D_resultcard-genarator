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
// Single persistent <audio> element kept unlocked across the session for async WebSocket/poll playback
let sharedVoiceAudioEl: HTMLAudioElement | null = null;
let voiceElementPrimed = false;
let isVoiceAudioPlaying = false;
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

/**
 * Unlock mobile Chrome / Android WebView / iOS Safari AudioContext + persistent HTML5 <audio> + Web Speech API
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
    const voiceEl = getSharedVoiceAudioElement();
    // Never interrupt active real TTS audio on passive screen touch, and avoid re-priming if already primed cleanly
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
          })
          .catch(() => {});
      } else {
        voiceElementPrimed = true;
      }
      didUnlock = true;
    }
  } catch {
    // Non-fatal
  }

  try {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.resume();
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
    speakBengaliSpeech(queued.message, { delayMs: 300 });
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
  speakBengaliSpeech(queued.message, { delayMs: 300 });
  return true;
}

// Web Audio API beep sound generator for realistic barcode scanner beep
export function playScannerBeep(freq = 1900, durationMs = 120): void {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;
    const triggerBeep = () => {
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

// Clear 3-note chime for guardian alert (resumes AudioContext before scheduling so mobile idle doesn't drop notes)
export function playAlarmChime(): void {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;

    const triggerNotes = () => {
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
        gain.gain.linearRampToValueAtTime(0.24, now + n.start + 0.02);
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
 * 1. Primary: Plays natural Bengali MP3 (/api/tts/bn) through the persistent session-unlocked
 *    HTMLAudioElement so Android Chrome & iOS Safari play asynchronously from WebSocket/SSE/Polling
 *    even long after the user gesture expires!
 * 2. Fallback: Automatically falls back to chunked window.speechSynthesis if offline or MP3 unavailable.
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

  // Halt previous speech cleanly without destroying the unlocked HTMLAudioElement reference
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

    const audioEl = getSharedVoiceAudioElement();
    const canTryServerMp3 = Boolean(audioEl) && (typeof navigator === 'undefined' || navigator.onLine !== false);

    if (canTryServerMp3 && audioEl) {
      let settled = false;
      let started = false;

      const cleanupListeners = () => {
        audioEl.onplaying = null;
        audioEl.onended = null;
        audioEl.onerror = null;
      };

      const loadTimeout = setTimeout(() => {
        if (!started && !settled && runToken === currentSpeechRunToken) {
          settled = true;
          cleanupListeners();
          isVoiceAudioPlaying = false;
          void playWithWebSpeechFallback(cleaned, runToken, options);
        }
      }, 6000);

      audioEl.onplaying = () => {
        if (runToken !== currentSpeechRunToken) {
          try {
            audioEl.pause();
          } catch {}
          clearTimeout(loadTimeout);
          cleanupListeners();
          return;
        }
        started = true;
        isVoiceAudioPlaying = true;
        voiceElementPrimed = true;
        clearTimeout(loadTimeout);
        onStart?.();
      };

      audioEl.onended = () => {
        if (settled) return;
        settled = true;
        isVoiceAudioPlaying = false;
        clearTimeout(loadTimeout);
        cleanupListeners();
        if (runToken === currentSpeechRunToken) {
          onEnd?.();
        }
      };

      audioEl.onerror = () => {
        if (settled) return;
        settled = true;
        isVoiceAudioPlaying = false;
        clearTimeout(loadTimeout);
        cleanupListeners();
        if (runToken === currentSpeechRunToken) {
          void playWithWebSpeechFallback(cleaned, runToken, options);
        }
      };

      try {
        if ('speechSynthesis' in window && (window.speechSynthesis.speaking || window.speechSynthesis.pending)) {
          window.speechSynthesis.cancel();
        }
        audioEl.muted = false;
        audioEl.volume = 1;
        audioEl.playbackRate = 1.0;
        audioEl.src = `/api/tts/bn?text=${encodeURIComponent(cleaned.slice(0, 1450))}`;
        const playResult = audioEl.play();
        if (playResult && typeof playResult.then === 'function') {
          playResult.catch((err: any) => {
            if (settled || runToken !== currentSpeechRunToken) return;
            settled = true;
            isVoiceAudioPlaying = false;
            clearTimeout(loadTimeout);
            cleanupListeners();
            const isNotAllowed = err?.name === 'NotAllowedError' || /not\s*allowed|gesture|interact/i.test(String(err?.message || ''));
            if (isNotAllowed) {
              // Still try Web Speech fallback before flagging blocked
              void playWithWebSpeechFallback(cleaned, runToken, options);
            } else {
              void playWithWebSpeechFallback(cleaned, runToken, options);
            }
          });
        }
        return;
      } catch {
        clearTimeout(loadTimeout);
        cleanupListeners();
        isVoiceAudioPlaying = false;
      }
    }

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
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore
    }
  }
  activeUtterances.clear();
}
