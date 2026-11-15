import { AttendanceStatus, Subject } from '../types';

export interface BrowserSpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      0: {
        transcript: string;
        confidence: number;
      };
    };
  };
}

export interface BrowserSpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

export interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((ev: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onresult: ((ev: BrowserSpeechRecognitionEvent) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export function getSpeechRecognitionConstructor(): (new () => BrowserSpeechRecognition) | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

const BENGALI_WORD_NUMBERS: Record<string, string> = {
  শূন্য: '0',
  zero: '0',
  এক: '1',
  one: '1',
  দুই: '2',
  two: '2',
  তিন: '3',
  three: '3',
  চার: '4',
  four: '4',
  পাঁচ: '5',
  পাচ: '5',
  five: '5',
  ছয়: '6',
  ছয়: '6',
  six: '6',
  সাত: '7',
  seven: '7',
  আট: '8',
  eight: '8',
  নয়: '9',
  নয়: '9',
  nine: '9',
  দশ: '10',
  ten: '10',
  এগারো: '11',
  বারো: '12',
  তেরো: '13',
  চৌদ্দ: '14',
  পনেরো: '15',
  ষোল: '16',
  সতেরো: '17',
  আঠারো: '18',
  উনিশ: '19',
  বিশ: '20',
  পঁচিশ: '25',
  ত্রিশ: '30',
  তিরিশ: '30',
  চল্লিশ: '40',
  পঞ্চাশ: '50',
  ষাট: '60',
  সত্তর: '70',
  আশি: '80',
  নব্বই: '90',
  একশ: '100',
  একশো: '100',
  hundred: '100',
};

export function normalizeSpokenTranscript(rawText: string): string {
  // Convert Bengali numerals to ASCII digits
  let normalized = rawText.replace(/[০-৯]/g, (ch) =>
    String('০১২৩৪৫৬৭৮৯'.indexOf(ch))
  );

  // Replace standalone Bengali/English number words cleanly
  const tokens = normalized.trim().split(/\s+/);
  normalized = tokens
    .map((tok) => {
      const lower = tok.toLowerCase();
      return BENGALI_WORD_NUMBERS[lower] ?? tok;
    })
    .join(' ');

  return normalized;
}

export type ParsedVoiceCommand =
  | { type: 'exam_mark'; roll?: number; subjectId?: string; value: number; rawSegment: string }
  | { type: 'monthly_mark'; roll?: number; subjectId?: string; value: number; rawSegment: string }
  | { type: 'daily_attendance'; roll?: number; status: AttendanceStatus; rawSegment: string }
  | { type: 'attendance_days'; roll?: number; value: number; rawSegment: string }
  | { type: 'navigate_student'; direction: 'next' | 'prev'; rawSegment: string };

const SUBJECT_ALIASES: { keywords: string[]; matchName: string }[] = [
  { keywords: ['বাংলা', 'bangla', 'bengali'], matchName: 'বাংলা' },
  { keywords: ['ইংরেজি', 'english'], matchName: 'ইংরেজি' },
  { keywords: ['গণিত', 'অঙ্ক', 'অংক', 'math', 'mathematics'], matchName: 'গণিত' },
  { keywords: ['বিজ্ঞান', 'science'], matchName: 'বিজ্ঞান' },
  { keywords: ['ইসলাম', 'ধর্ম', 'religion', 'islam'], matchName: 'ধর্ম' },
  { keywords: ['ইতিহাস', 'সমাজ', 'বাংলাদেশ ও বিশ্বপরিচয়', 'history', 'social', 'bgs'], matchName: 'বিশ্বপরিচয়' },
  { keywords: ['ডিজিটাল', 'আইসিটি', 'কম্পিউটার', 'ict', 'digital'], matchName: 'প্রযুক্তি' },
  { keywords: ['আরবি', 'কুরআন', 'arabic', 'quran'], matchName: 'কুরআন' },
];

function matchSubjectFromSpeech(text: string, subjects: Subject[]): Subject | undefined {
  const lower = text.toLowerCase();
  for (const sub of subjects) {
    if (lower.includes(sub.nameBn.toLowerCase())) {
      return sub;
    }
    if (sub.nameEn && lower.includes(sub.nameEn.toLowerCase())) {
      return sub;
    }
  }
  for (const alias of SUBJECT_ALIASES) {
    if (alias.keywords.some((kw) => lower.includes(kw))) {
      const matched = subjects.find(
        (s) => s.nameBn.includes(alias.matchName) || (s.nameEn || '').toLowerCase().includes(alias.keywords[alias.keywords.length - 1])
      );
      if (matched) return matched;
    }
  }
  return undefined;
}

export function parseClassroomVoiceCommands(
  rawTranscript: string,
  subjects: Subject[] = []
): ParsedVoiceCommand[] {
  const normalized = normalizeSpokenTranscript(rawTranscript);
  if (!normalized.trim()) return [];

  // Split chained segments on commas, semicolons, বা/এবং, or repeated roll announcements
  const rawSegments = normalized
    .replace(/\b(roll|রোল|রূল|রুল)\b/gi, '|roll')
    .split(/[,;|।]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const commands: ParsedVoiceCommand[] = [];

  for (const seg of rawSegments) {
    const lower = seg.toLowerCase();

    // Navigation commands
    if (/(পরবর্তী|নেক্সট|next student|next)/i.test(lower)) {
      commands.push({ type: 'navigate_student', direction: 'next', rawSegment: seg });
      continue;
    }
    if (/(পূর্ববর্তী|আগের|previous student|previous|prev)/i.test(lower)) {
      commands.push({ type: 'navigate_student', direction: 'prev', rawSegment: seg });
      continue;
    }

    // Extract optional roll number
    let roll: number | undefined;
    let remaining = seg;
    const rollMatch = remaining.match(/\b(?:roll|রোল|রূল|রুল)\s*(?:নং|নম্বর|number)?\s*(\d+)/i);
    if (rollMatch) {
      roll = parseInt(rollMatch[1], 10);
      remaining = remaining.replace(rollMatch[0], ' ').trim();
    }

    const remLower = remaining.toLowerCase();

    // Numeric numbers left after stripping roll number
    const numbersInRem = remaining.match(/\d+(?:\.\d+)?/g)?.map((n) => parseFloat(n)) || [];

    // 1. Check attendance days count (e.g. "roll 5 attendance 115", "রোল ৫ উপস্থিতির দিন ১১২")
    if (
      numbersInRem.length > 0 &&
      /(উপস্থিতির দিন|উপস্থিতি|হাজিরা|attendance|days)/i.test(remLower)
    ) {
      commands.push({
        type: 'attendance_days',
        roll,
        value: Math.round(numbersInRem[numbersInRem.length - 1]),
        rawSegment: seg,
      });
      continue;
    }

    // 2. Check daily roll-call status ("present", "absent", "late", "উপস্থিত", "অনুপস্থিত", "দেরি")
    // Note: check 'absent' / 'অনুপস্থিত' BEFORE 'present' / 'উপস্থিত' because 'অনুপস্থিত' contains 'উপস্থিত'!
    if (/(অনুপস্থিত|অনুপস্তিত|অ্যাবসেন্ট|অ্যাপসেন্ট|absent|নাই|নেই)/i.test(remLower)) {
      commands.push({
        type: 'daily_attendance',
        roll,
        status: 'absent',
        rawSegment: seg,
      });
      continue;
    }
    if (/(বিলম্ব|দেরি|লেট|late)/i.test(remLower)) {
      commands.push({
        type: 'daily_attendance',
        roll,
        status: 'late',
        rawSegment: seg,
      });
      continue;
    }
    if (/(উপস্থিত|উপস্তিত|প্রেজেন্ট|হাজির|present|আছে)/i.test(remLower)) {
      commands.push({
        type: 'daily_attendance',
        roll,
        status: 'present',
        rawSegment: seg,
      });
      continue;
    }

    // 3. Monthly assessment marks ("মাসিক ১৮", "monthly 18")
    const matchedSubject = matchSubjectFromSpeech(remaining, subjects);
    if (
      numbersInRem.length > 0 &&
      /(মাসিক|ধারাবাহিক|monthly)/i.test(remLower)
    ) {
      commands.push({
        type: 'monthly_mark',
        roll,
        subjectId: matchedSubject?.id,
        value: numbersInRem[numbersInRem.length - 1],
        rawSegment: seg,
      });
      continue;
    }

    // 4. Exam Marks ("roll 5 marks 85", "রোল ৫ নম্বর ৮৫", "রোল ৫ ৮৫", "গণিত ৯০", or direct number "85")
    if (numbersInRem.length > 0) {
      commands.push({
        type: 'exam_mark',
        roll,
        subjectId: matchedSubject?.id,
        value: numbersInRem[numbersInRem.length - 1],
        rawSegment: seg,
      });
    }
  }

  return commands;
}
