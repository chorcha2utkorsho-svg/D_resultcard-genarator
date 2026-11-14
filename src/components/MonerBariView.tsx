import React, { useEffect, useMemo, useState } from 'react';
import {
  BookHeart,
  CalendarDays,
  CheckCircle2,
  Circle,
  Compass,
  Edit3,
  Heart,
  Home,
  Plus,
  Rocket,
  Save,
  Smile,
  Sparkles,
  Sun,
  Target,
  Trash2,
} from 'lucide-react';
import {
  MonerBariData,
  MonerBariEmotionalGoal,
  MonerBariGratitudeItem,
  MonerBariJournalEntry,
  MonerBariMoodLog,
  Student,
} from '../types';
import {
  MONER_BARI_AFFIRMATIONS,
  MONER_BARI_MOODS,
} from '../data/dreamCareerGallery';
import { formatBengaliDate, toBengaliNumber } from '../utils/bengali';

interface MonerBariViewProps {
  student: Student;
  dreamCareer: string;
  dailyStudyHoursGoal?: number;
  onSaveMonerBari: (nextData: MonerBariData) => void;
  onOpenIccheDana: () => void;
}

const GRATITUDE_STARTERS = [
  'মা-বাবার ভালোবাসা ও যত্ন',
  'শিক্ষকের সুন্দর পাঠদান',
  'আজকের নতুন শেখা বিষয়',
  'বন্ধুর সাথে ভালো সময়',
  'সুস্থ ও সুন্দর একটি দিন',
];

const JOURNAL_PROMPTS = [
  'আজ আমার সবচেয়ে ভালো কী লেগেছে?',
  'কোন বিষয়টি আমাকে আজ সাহস বা আনন্দ দিয়েছে?',
  'আগামীকাল আমি নিজের মধ্যে কোন ভালো অভ্যাস গড়তে চাই?',
  'আজ কার প্রতি আমি কৃতজ্ঞ এবং কেন?',
];

const CONFIDENCE_LABELS: Record<number, string> = {
  1: 'শান্ত বিশ্রাম প্রয়োজন',
  2: 'ধীরে এগোচ্ছি',
  3: 'স্বাভাবিক ও স্থির',
  4: 'উৎসাহী ও মনোযোগী',
  5: 'পূর্ণ আত্মবিশ্বাসী',
};

const BN_SHORT_WEEKDAYS = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র', 'শনি'];

function getLocalDateIso(dateObj = new Date()): string {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMoodIcon(moodId: string) {
  switch (moodId) {
    case 'confident':
      return Smile;
    case 'curious':
      return Compass;
    case 'focused':
      return Sun;
    case 'determined':
      return Target;
    case 'grateful':
      return Heart;
    default:
      return Sparkles;
  }
}

export const MonerBariView: React.FC<MonerBariViewProps> = ({
  student,
  dreamCareer,
  dailyStudyHoursGoal = 3,
  onSaveMonerBari,
  onOpenIccheDana,
}) => {
  const todayIso = useMemo(() => getLocalDateIso(), []);

  const defaultEmotionalGoals: MonerBariEmotionalGoal[] = useMemo(
    () => [
      {
        id: `eg-${student.id}-1`,
        titleBn: 'রাগ বা অস্থিরতা নিয়ন্ত্রণ করে সবার সাথে হাসিমুখে কথা বলা',
        achieved: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: `eg-${student.id}-2`,
        titleBn: 'ভুল হলে মন খারাপ না করে নতুন উদ্যমে আবার চেষ্টা করা',
        achieved: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: `eg-${student.id}-3`,
        titleBn: 'প্রতিদিন মা-বাবা ও শিক্ষকদের প্রতি কৃতজ্ঞতা প্রকাশ করা',
        achieved: true,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    [student.id]
  );

  const existingMonerBari: MonerBariData = useMemo(
    () =>
      student.monerBari || {
        moodToday: 'প্রফুল্ল ও আত্মবিশ্বাসী',
        dailyAffirmation: MONER_BARI_AFFIRMATIONS[0],
        favoriteQuote: 'আমি প্রতিদিন একটু একটু করে নিজের সেরা সংস্করণ হয়ে উঠছি।',
        proudMoment: '',
        gratitudeNote: 'আমার প্রিয় মা-বাবা এবং ডি-লিকন মডেল একাডেমীর শিক্ষকদের প্রতি কৃতজ্ঞতা।',
        emotionalGoals: defaultEmotionalGoals,
        journalEntries: [],
        moodHistory: [],
        gratitudeLogs: [],
      },
    [student.monerBari, defaultEmotionalGoals]
  );

  const moodHistory = useMemo(
    () => existingMonerBari.moodHistory || [],
    [existingMonerBari.moodHistory]
  );
  const gratitudeLogs = useMemo(
    () => existingMonerBari.gratitudeLogs || [],
    [existingMonerBari.gratitudeLogs]
  );
  const emotionalGoalsList = useMemo(
    () => existingMonerBari.emotionalGoals || defaultEmotionalGoals,
    [existingMonerBari.emotionalGoals, defaultEmotionalGoals]
  );
  const journalEntriesList = useMemo(
    () => existingMonerBari.journalEntries || [],
    [existingMonerBari.journalEntries]
  );

  const todayMoodEntry = useMemo(
    () => moodHistory.find((m) => m.date === todayIso),
    [moodHistory, todayIso]
  );

  const [monerMood, setMonerMood] = useState(
    todayMoodEntry?.moodLabelBn || existingMonerBari.moodToday || 'প্রফুল্ল ও আত্মবিশ্বাসী'
  );
  const [confidenceScore, setConfidenceScore] = useState<number>(
    todayMoodEntry?.confidenceScore || 4
  );
  const [moodNoteDraft, setMoodNoteDraft] = useState<string>(todayMoodEntry?.noteBn || '');
  const [selectedTimelineDate, setSelectedTimelineDate] = useState<string>(todayIso);

  const [monerAffirmation, setMonerAffirmation] = useState(
    existingMonerBari.dailyAffirmation || MONER_BARI_AFFIRMATIONS[0]
  );

  // Gratitude Journal inputs
  const [gratefulForInput, setGratefulForInput] = useState('');
  const [dailyThoughtInput, setDailyThoughtInput] = useState('');

  // Reflective Journal inputs
  const [journalPrompt, setJournalPrompt] = useState(JOURNAL_PROMPTS[0]);
  const [journalDraft, setJournalDraft] = useState('');

  // Emotional Goals inputs
  const [newEmotionalGoalText, setNewEmotionalGoalText] = useState('');

  // Core reflection fields
  const [monerQuote, setMonerQuote] = useState(existingMonerBari.favoriteQuote || '');
  const [monerProud, setMonerProud] = useState(existingMonerBari.proudMoment || '');
  const [monerGratitude, setMonerGratitude] = useState(existingMonerBari.gratitudeNote || '');

  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    setMonerMood(
      todayMoodEntry?.moodLabelBn || existingMonerBari.moodToday || 'প্রফুল্ল ও আত্মবিশ্বাসী'
    );
    setConfidenceScore(todayMoodEntry?.confidenceScore || 4);
    setMoodNoteDraft(todayMoodEntry?.noteBn || '');
    setMonerAffirmation(existingMonerBari.dailyAffirmation || MONER_BARI_AFFIRMATIONS[0]);
    setMonerQuote(existingMonerBari.favoriteQuote || '');
    setMonerProud(existingMonerBari.proudMoment || '');
    setMonerGratitude(existingMonerBari.gratitudeNote || '');
  }, [student.id, existingMonerBari, todayMoodEntry]);

  const showNotice = (message: string) => {
    setSavedNotice(message);
    setTimeout(() => setSavedNotice(null), 3500);
  };

  const commitMonerBari = (partial: Partial<MonerBariData>, noticeText: string) => {
    const payload: MonerBariData = {
      moodToday: partial.moodToday ?? monerMood,
      dailyAffirmation: partial.dailyAffirmation ?? monerAffirmation,
      favoriteQuote: partial.favoriteQuote ?? monerQuote,
      proudMoment: partial.proudMoment ?? monerProud,
      gratitudeNote: partial.gratitudeNote ?? monerGratitude,
      emotionalGoals: partial.emotionalGoals ?? emotionalGoalsList,
      journalEntries: partial.journalEntries ?? journalEntriesList,
      moodHistory: partial.moodHistory ?? moodHistory,
      gratitudeLogs: partial.gratitudeLogs ?? gratitudeLogs,
      updatedAt: new Date().toISOString(),
    };
    onSaveMonerBari(payload);
    showNotice(noticeText);
  };

  // Last 7 days list for horizontal mood timeline scroller
  const last7Days = useMemo(() => {
    const days: { dateIso: string; dayShortBn: string; dayNumBn: string; log?: MonerBariMoodLog }[] =
      [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = getLocalDateIso(d);
      const log = moodHistory.find((item) => item.date === iso);
      days.push({
        dateIso: iso,
        dayShortBn: BN_SHORT_WEEKDAYS[d.getDay()],
        dayNumBn: toBengaliNumber(d.getDate()),
        log,
      });
    }
    return days;
  }, [moodHistory]);

  // Calculate consecutive mood check-in streak ending today or yesterday
  const moodStreakDays = useMemo(() => {
    if (moodHistory.length === 0) return 0;
    const dateSet = new Set(moodHistory.map((m) => m.date));
    let streak = 0;
    const cursor = new Date();
    if (!dateSet.has(getLocalDateIso(cursor))) {
      cursor.setDate(cursor.getDate() - 1);
    }
    while (dateSet.has(getLocalDateIso(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }, [moodHistory]);

  const selectedDayRecord = useMemo(
    () => moodHistory.find((m) => m.date === selectedTimelineDate) || null,
    [moodHistory, selectedTimelineDate]
  );

  const handleLogDailyMood = (
    overrideMoodLabel?: string,
    overrideConfidence?: number,
    overrideNote?: string
  ) => {
    const label = overrideMoodLabel ?? monerMood;
    const matchedMood = MONER_BARI_MOODS.find((m) => m.labelBn === label) || MONER_BARI_MOODS[0];
    const score = overrideConfidence ?? confidenceScore;
    const note = (overrideNote ?? moodNoteDraft).trim();

    const newEntry: MonerBariMoodLog = {
      id: `mood-${todayIso}`,
      date: todayIso,
      moodId: matchedMood.id,
      moodLabelBn: label,
      confidenceScore: score,
      noteBn: note || undefined,
      createdAt: new Date().toISOString(),
    };

    const filtered = moodHistory.filter((item) => item.date !== todayIso);
    const nextHistory = [newEntry, ...filtered].slice(0, 90);
    setSelectedTimelineDate(todayIso);

    commitMonerBari(
      {
        moodToday: label,
        moodHistory: nextHistory,
      },
      '✓ আজকের মনের অবস্থা ও অনুভূতি লগ হয়েছে!'
    );
  };

  const handleAddGratitudeLog = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanGrateful = gratefulForInput.trim();
    if (!cleanGrateful) return;

    const entry: MonerBariGratitudeItem = {
      id: `grat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: todayIso,
      gratefulForBn: cleanGrateful,
      dailyThoughtBn: dailyThoughtInput.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    commitMonerBari(
      { gratitudeLogs: [entry, ...gratitudeLogs] },
      '✓ আজকের কৃতজ্ঞতা ও ভালো চিন্তা সংরক্ষিত হয়েছে!'
    );
    setGratefulForInput('');
    setDailyThoughtInput('');
  };

  const handleDeleteGratitudeLog = (itemId: string) => {
    commitMonerBari(
      { gratitudeLogs: gratitudeLogs.filter((g) => g.id !== itemId) },
      '✓ কৃতজ্ঞতা এন্ট্রিটি সরানো হয়েছে'
    );
  };

  const handleAddJournalEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = journalDraft.trim();
    if (!cleaned) return;
    const entry: MonerBariJournalEntry = {
      id: `jr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: todayIso,
      mood: monerMood,
      promptBn: journalPrompt,
      contentBn: cleaned,
      createdAt: new Date().toISOString(),
    };
    commitMonerBari(
      { journalEntries: [entry, ...journalEntriesList] },
      '✓ আজকের ডায়েরি ও মনের কথা সংরক্ষিত হয়েছে!'
    );
    setJournalDraft('');
  };

  const handleDeleteJournalEntry = (entryId: string) => {
    commitMonerBari(
      { journalEntries: journalEntriesList.filter((j) => j.id !== entryId) },
      '✓ ডায়েরির লেখা মুছে ফেলা হয়েছে'
    );
  };

  const handleAddEmotionalGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newEmotionalGoalText.trim();
    if (!cleaned) return;
    const newGoal: MonerBariEmotionalGoal = {
      id: `eg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      titleBn: cleaned,
      achieved: false,
      createdAt: new Date().toISOString(),
    };
    commitMonerBari(
      { emotionalGoals: [newGoal, ...emotionalGoalsList] },
      '✓ নতুন মানসিক ও চরিত্রগত লক্ষ্য যোগ হয়েছে!'
    );
    setNewEmotionalGoalText('');
  };

  const handleToggleEmotionalGoal = (goalId: string) => {
    const nextGoals = emotionalGoalsList.map((g) =>
      g.id === goalId ? { ...g, achieved: !g.achieved } : g
    );
    commitMonerBari({ emotionalGoals: nextGoals }, '✓ মানসিক লক্ষ্যের অগ্রগতি আপডেট হয়েছে!');
  };

  const handleDeleteEmotionalGoal = (goalId: string) => {
    commitMonerBari(
      { emotionalGoals: emotionalGoalsList.filter((g) => g.id !== goalId) },
      '✓ লক্ষ্য তালিকা থেকে সরানো হয়েছে'
    );
  };

  const achievedGoalsCount = emotionalGoalsList.filter((g) => g.achieved).length;

  return (
    <div className="space-y-6">
      {/* 1. Calm Editorial Header */}
      <header className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-700 font-semibold">
            <Home className="w-4 h-4 shrink-0" />
            <span>{student.nameBn}-এর একান্ত প্রশান্তির জায়গা</span>
            <span aria-hidden="true" className="text-slate-400">·</span>
            <span>দৈনিক মন ট্র্যাকার ও কৃতজ্ঞতা ডায়েরি</span>
          </div>
          <h3 className="text-2xl sm:text-3xl font-bold font-serif text-slate-900">
            মনের বাড়ি — আমি নিজেকে বিশ্বাস করি
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            প্রতিদিন নিজের মনের অবস্থা চিহ্নিত করো এবং ছোট ছোট কৃতজ্ঞতা ও অনুভূতি লিখে রাখো। মন যত শান্ত ও কৃতজ্ঞ থাকবে, শেখার আনন্দ ততই বাড়বে।
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenIccheDana}
            className="px-4 py-2.5 min-h-[44px] bg-indigo-900 hover:bg-indigo-800 text-white text-xs sm:text-sm font-bold rounded-xl transition flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Rocket className="w-4 h-4 text-amber-300 shrink-0" />
            <span>ইচ্ছে ডানায় স্বপ্ন দেখো</span>
          </button>
        </div>
      </header>

      {/* Emotional Progress Tabular Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-1">
          <div className="text-xs font-medium text-slate-500">নিয়মিত চেক-ইন ধারা</div>
          <div className="text-2xl font-bold text-emerald-700 font-mono tabular-nums">
            {toBengaliNumber(moodStreakDays)} দিন
          </div>
          <div className="text-xs text-slate-500">
            {todayMoodEntry ? 'আজকের চেক-ইন সম্পন্ন' : 'আজকের অনুভূতি লগ বাকি'}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-1">
          <div className="text-xs font-medium text-slate-500">মোট মনের অবস্থা লগ</div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {toBengaliNumber(moodHistory.length)} দিন
          </div>
          <div className="text-xs text-slate-500">মানসিক অগ্রগতির রেকর্ড</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-1">
          <div className="text-xs font-medium text-slate-500">কৃতজ্ঞতা ও ভাবনা</div>
          <div className="text-2xl font-bold text-indigo-900 font-mono tabular-nums">
            {toBengaliNumber(gratitudeLogs.length + journalEntriesList.length)}টি
          </div>
          <div className="text-xs text-slate-500">
            কৃতজ্ঞতা {toBengaliNumber(gratitudeLogs.length)} · ডায়েরি {toBengaliNumber(journalEntriesList.length)}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-1">
          <div className="text-xs font-medium text-slate-500">মানসিক ও চরিত্র লক্ষ্য</div>
          <div className="text-2xl font-bold text-amber-700 font-mono tabular-nums">
            {toBengaliNumber(achievedGoalsCount)}/{toBengaliNumber(emotionalGoalsList.length)}
          </div>
          <div className="text-xs text-slate-500">ইতিবাচক অভ্যাস অর্জিত</div>
        </div>
      </div>

      {savedNotice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs sm:text-sm font-bold text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{savedNotice}</span>
        </div>
      )}

      {/* 2. Daily Mood Tracker + 7-Day Emotional Progress & Affirmation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left (7 cols): Daily Mood Check-In & 7-Day Progress Timeline */}
        <section className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1">
                <h4 className="text-base sm:text-lg font-bold text-slate-900 font-serif flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>১. দৈনিক মনের অবস্থা ট্র্যাকার (Daily Mood Tracker)</span>
                </h4>
                <p className="text-xs text-slate-500">
                  আজ তোমার মন কেমন এবং মনোবল কতটুকু—প্রতিদিন একবার সেভ করে নিজের মানসিক অগ্রগতি দেখো।
                </p>
              </div>
              <span className="text-xs font-medium text-slate-500 tabular-nums">
                {formatBengaliDate(todayIso)}
              </span>
            </div>

            {/* Tactile Mood Selection Buttons */}
            <div className="flex flex-wrap gap-2">
              {MONER_BARI_MOODS.map((m) => {
                const Icon = getMoodIcon(m.id);
                const active = monerMood === m.labelBn;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMonerMood(m.labelBn)}
                    className={`px-3.5 py-2.5 min-h-[44px] rounded-xl text-xs font-semibold border transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/60'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{m.labelBn}</span>
                  </button>
                );
              })}
            </div>

            {/* Emotional Energy / Confidence Scale (1 to 5) */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold text-slate-800">আজকের মনোবল ও উৎসাহের মাত্রা</span>
                <span className="font-semibold text-emerald-800">
                  {toBengaliNumber(confidenceScore)}/৫ · {CONFIDENCE_LABELS[confidenceScore]}
                </span>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((level) => {
                  const selected = confidenceScore === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setConfidenceScore(level)}
                      className={`min-h-[44px] rounded-xl text-sm font-bold font-mono tabular-nums border transition cursor-pointer ${
                        selected
                          ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      {toBengaliNumber(level)}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <input
                  type="text"
                  value={moodNoteDraft}
                  onChange={(e) => setMoodNoteDraft(e.target.value)}
                  placeholder="আজকের অনুভূতি নিয়ে ১ লাইন নোট (ঐচ্ছিক)..."
                  className="flex-1 min-h-[44px] text-xs sm:text-sm px-3.5 py-2 border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
                <button
                  type="button"
                  onClick={() => handleLogDailyMood()}
                  className="px-4 py-2.5 min-h-[44px] bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{todayMoodEntry ? 'আজকের লগ আপডেট করুন' : 'আজকের মন লগ করুন'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* 7-Day Horizontal Emotional Progress Scroller */}
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-slate-800">গত ৭ দিনের অনুভূতির ধারাবাহিকতা</span>
              <span className="text-slate-500">দিনের ওপর ক্লিক করে বিস্তারিত দেখো</span>
            </div>

            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {last7Days.map((d) => {
                const isSelected = selectedTimelineDate === d.dateIso;
                const hasLog = Boolean(d.log);
                return (
                  <button
                    key={d.dateIso}
                    type="button"
                    onClick={() => setSelectedTimelineDate(d.dateIso)}
                    className={`min-h-[58px] rounded-xl p-1.5 flex flex-col items-center justify-center gap-1 border transition cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900'
                        : hasLog
                        ? 'bg-emerald-50 text-emerald-950 border-emerald-200 hover:border-emerald-400'
                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-[11px] font-medium leading-none">{d.dayShortBn}</span>
                    <span className="text-sm font-bold tabular-nums font-mono leading-none">
                      {d.dayNumBn}
                    </span>
                    <span
                      className={`text-[10px] leading-none font-bold ${
                        isSelected
                          ? hasLog
                            ? 'text-emerald-300'
                            : 'text-slate-400'
                          : hasLog
                          ? 'text-emerald-700'
                          : 'text-slate-300'
                      }`}
                    >
                      {hasLog ? '✓' : '—'}
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedDayRecord ? (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="font-semibold text-slate-900">
                    {formatBengaliDate(selectedDayRecord.date)} · {selectedDayRecord.moodLabelBn}
                  </div>
                  {selectedDayRecord.noteBn && (
                    <p className="text-slate-600">{selectedDayRecord.noteBn}</p>
                  )}
                </div>
                {selectedDayRecord.confidenceScore && (
                  <span className="font-mono font-bold text-emerald-800 tabular-nums">
                    মনোবল: {toBengaliNumber(selectedDayRecord.confidenceScore)}/৫
                  </span>
                )}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                {formatBengaliDate(selectedTimelineDate)} তারিখে এখনো কোনো মনের অবস্থা লগ করা হয়নি।
              </div>
            )}
          </div>
        </section>

        {/* Right (5 cols): Daily Confidence Affirmation Card */}
        <section className="lg:col-span-5 bg-[#091e42] text-white rounded-2xl border border-slate-800 p-5 sm:p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-base font-bold text-amber-300 font-serif">
                ২. আজকের আত্মবিশ্বাসের বাণী
              </h4>
              <button
                type="button"
                onClick={() => {
                  const idx = MONER_BARI_AFFIRMATIONS.indexOf(monerAffirmation);
                  const next =
                    MONER_BARI_AFFIRMATIONS[(idx + 1) % MONER_BARI_AFFIRMATIONS.length];
                  setMonerAffirmation(next);
                  commitMonerBari({ dailyAffirmation: next }, '✓ আজকের বাণী আপডেট হয়েছে!');
                }}
                className="text-xs font-semibold text-emerald-300 hover:text-emerald-200 cursor-pointer whitespace-nowrap min-h-[36px] px-2"
              >
                নতুন বাণী দেখো →
              </button>
            </div>

            <blockquote className="text-lg sm:text-xl font-serif text-white leading-relaxed pt-2">
              &ldquo;{monerAffirmation}&rdquo;
            </blockquote>
          </div>

          <div className="pt-4 border-t border-slate-800 space-y-3 text-xs text-slate-300">
            <div className="flex flex-wrap items-center gap-2">
              <span>বর্তমান স্বপ্ন:</span>
              <strong className="text-amber-300">{dreamCareer}</strong>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span>দৈনিক লক্ষ্য:</span>
              <strong className="text-emerald-300 tabular-nums">
                {toBengaliNumber(dailyStudyHoursGoal)} ঘণ্টা
              </strong>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-slate-400">
              <span>আজকের অনুভূতি:</span>
              <strong className="text-white">{monerMood}</strong>
            </div>
          </div>
        </section>
      </div>

      {/* 3. Simple Gratitude Journal + Daily Reflective Thoughts & Emotional Goals */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left (6 cols): Simple Daily Gratitude Journal */}
        <section className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-5">
          <div className="space-y-1">
            <h4 className="text-base sm:text-lg font-bold text-slate-900 font-serif flex items-center gap-2">
              <BookHeart className="w-4 h-4 text-rose-600 shrink-0" />
              <span>৩. আমার কৃতজ্ঞতা জার্নাল (Gratitude Journal)</span>
            </h4>
            <p className="text-xs text-slate-500">
              আজকের দিনের যে ছোট বা বড় বিষয়টির জন্য তুমি কৃতজ্ঞ ও আনন্দিত, সেটি সহজে লিখে রাখো।
            </p>
          </div>

          {/* Interactive Starter Chips */}
          <div className="flex flex-wrap gap-1.5">
            {GRATITUDE_STARTERS.map((starter) => (
              <button
                key={starter}
                type="button"
                onClick={() => setGratefulForInput(starter)}
                className={`px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-medium border transition cursor-pointer whitespace-nowrap ${
                  gratefulForInput === starter
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-rose-50/60 hover:border-rose-200'
                }`}
              >
                {starter}
              </button>
            ))}
          </div>

          <form onSubmit={handleAddGratitudeLog} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                আজ আমি কার বা কোন বিষয়ের জন্য কৃতজ্ঞ? *
              </label>
              <input
                type="text"
                required
                value={gratefulForInput}
                onChange={(e) => setGratefulForInput(e.target.value)}
                placeholder="যেমন: মা-বাবার দোয়া এবং আজ গণিতের কঠিন অঙ্কটা বুঝতে পারা..."
                className="w-full min-h-[44px] text-xs sm:text-sm px-3.5 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                আজকের একটি সুন্দর চিন্তা বা অনুভূতি (ঐচ্ছিক)
              </label>
              <textarea
                rows={2}
                value={dailyThoughtInput}
                onChange={(e) => setDailyThoughtInput(e.target.value)}
                placeholder="এই বিষয়টি আজ আমার মনকে কীভাবে ভালো করেছে..."
                className="w-full text-xs sm:text-sm p-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-4 py-2.5 min-h-[44px] bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>কৃতজ্ঞতা সেভ করুন</span>
              </button>
            </div>
          </form>

          {gratitudeLogs.length > 0 ? (
            <div className="space-y-2.5 pt-3 border-t border-slate-100 max-h-80 overflow-y-auto pr-1">
              {gratitudeLogs.map((item) => (
                <article
                  key={item.id}
                  className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">
                      {formatBengaliDate(item.date)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteGratitudeLog(item.id)}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded cursor-pointer"
                      title="মুছে ফেলুন"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-slate-900">
                    {item.gratefulForBn}
                  </div>
                  {item.dailyThoughtBn && (
                    <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                      {item.dailyThoughtBn}
                    </p>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-center text-xs text-slate-500">
              এখনো কোনো কৃতজ্ঞতা এন্ট্রি যোগ হয়নি। উপরের যেকোনো একটি বিষয় বেছে নিয়ে বা নিজে লিখে শুরু করো!
            </div>
          )}
        </section>

        {/* Right (6 cols): Reflective Thoughts Journal + Personal Emotional Goals */}
        <div className="lg:col-span-6 space-y-6">
          {/* Reflective Thoughts Diary */}
          <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
            <div className="space-y-1">
              <h4 className="text-base sm:text-lg font-bold text-slate-900 font-serif flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>৪. প্রতিদিনের মনের ডায়েরি (Reflective Journal)</span>
              </h4>
              <p className="text-xs text-slate-500">
                একটি প্রশ্ন বেছে নিয়ে আজকের চিন্তা, শেখা ও সৃজনশীল ভাবনা লিখে রাখো।
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {JOURNAL_PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setJournalPrompt(p)}
                  className={`px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-semibold border transition cursor-pointer ${
                    journalPrompt === p
                      ? 'bg-emerald-700 text-white border-emerald-700'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50/70'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <form onSubmit={handleAddJournalEntry} className="space-y-3">
              <textarea
                rows={3}
                required
                value={journalDraft}
                onChange={(e) => setJournalDraft(e.target.value)}
                placeholder={`"${journalPrompt}" — এখানে মন খুলে লেখো...`}
                className="w-full text-xs sm:text-sm p-3.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>
                  সংযুক্ত মন-অবস্থা: <strong className="text-emerald-800">{monerMood}</strong>
                </span>
                <button
                  type="submit"
                  className="px-4 py-2 min-h-[44px] bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span>ডায়েরিতে যোগ করুন</span>
                </button>
              </div>
            </form>

            {journalEntriesList.length > 0 && (
              <div className="space-y-2.5 pt-2 border-t border-slate-100 max-h-64 overflow-y-auto pr-1">
                {journalEntriesList.map((entry) => (
                  <article
                    key={entry.id}
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-700">
                          {formatBengaliDate(entry.date)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="text-emerald-800 font-medium">{entry.mood}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteJournalEntry(entry.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded cursor-pointer"
                        title="মুছে ফেলুন"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {entry.promptBn && (
                      <div className="text-xs font-semibold text-indigo-800">{entry.promptBn}</div>
                    )}
                    <p className="text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-line">
                      {entry.contentBn}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* Personal Emotional & Character Goals Checklist */}
          <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
            <div className="space-y-1">
              <h4 className="text-base sm:text-lg font-bold text-slate-900 font-serif flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-600 shrink-0" />
                <span>৫. মানসিক ও চরিত্রগত লক্ষ্য</span>
              </h4>
              <p className="text-xs text-slate-500">
                নিজেকে শান্ত, সাহসী ও ভালো মানুষ হিসেবে গড়ে তোলার ছোট ছোট প্রতিজ্ঞা।
              </p>
            </div>

            <form onSubmit={handleAddEmotionalGoal} className="flex gap-2">
              <input
                type="text"
                required
                value={newEmotionalGoalText}
                onChange={(e) => setNewEmotionalGoalText(e.target.value)}
                placeholder="যেমন: প্রতিদিন কমপক্ষে ১ জনকে সাহায্য করব..."
                className="flex-1 min-h-[44px] text-xs sm:text-sm px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <button
                type="submit"
                className="px-4 py-2 min-h-[44px] bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition cursor-pointer whitespace-nowrap shrink-0"
              >
                + যোগ
              </button>
            </form>

            <div className="space-y-2.5">
              {emotionalGoalsList.map((goal) => (
                <div
                  key={goal.id}
                  className={`p-3 rounded-xl border flex items-start justify-between gap-2.5 transition ${
                    goal.achieved
                      ? 'bg-emerald-50/70 border-emerald-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleToggleEmotionalGoal(goal.id)}
                    className="flex items-start gap-2.5 text-left flex-1 cursor-pointer min-h-[32px]"
                  >
                    {goal.achieved ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    )}
                    <span
                      className={`text-xs sm:text-sm leading-snug ${
                        goal.achieved ? 'text-emerald-950 font-semibold' : 'text-slate-800'
                      }`}
                    >
                      {goal.titleBn}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteEmotionalGoal(goal.id)}
                    className="text-slate-400 hover:text-rose-600 p-1 rounded cursor-pointer shrink-0"
                    title="মুছে ফেলুন"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* 4. Core Motto, Proud Moment & Gratitude Pledge */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-900 font-serif">
              আমার প্রিয় মূলমন্ত্র ও অঙ্গীকার
            </label>
            <textarea
              rows={3}
              value={monerQuote}
              onChange={(e) => setMonerQuote(e.target.value)}
              placeholder="তোমার মনের দৃঢ় প্রতিজ্ঞা বা প্রিয় বাক্যটি লেখো..."
              className="w-full text-xs sm:text-sm p-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-900 font-serif">
              আজ আমি যা নিয়ে গর্বিত
            </label>
            <textarea
              rows={3}
              value={monerProud}
              onChange={(e) => setMonerProud(e.target.value)}
              placeholder="যেমন: আজ আমি সময়মতো পড়া শেষ করেছি অথবা বন্ধুকে সাহায্য করেছি..."
              className="w-full text-xs sm:text-sm p-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-900 font-serif">
              মা-বাবা ও শিক্ষকের প্রতি কৃতজ্ঞতা
            </label>
            <textarea
              rows={3}
              value={monerGratitude}
              onChange={(e) => setMonerGratitude(e.target.value)}
              placeholder="মা-বাবা বা শিক্ষকদের জন্য মনের কথা ও দোয়া..."
              className="w-full text-xs sm:text-sm p-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <span className="text-xs text-slate-500">
            মনের বাড়িতে লেখা তোমার প্রতিটি কথা সুরক্ষিতভাবে সংরক্ষিত থাকে।
          </span>
          <button
            type="button"
            onClick={() =>
              commitMonerBari(
                {
                  favoriteQuote: monerQuote,
                  proudMoment: monerProud,
                  gratitudeNote: monerGratitude,
                },
                '✓ মনের বাড়ির মূলমন্ত্র ও অঙ্গীকার সংরক্ষিত হয়েছে!'
              )
            }
            className="px-5 py-2.5 min-h-[44px] bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold rounded-xl transition flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <Save className="w-4 h-4 shrink-0" />
            <span>মনের বাড়িতে সেভ করুন</span>
          </button>
        </div>
      </section>
    </div>
  );
};
