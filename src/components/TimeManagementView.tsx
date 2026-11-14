import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  CalendarDays,
  CheckCircle2,
  Circle,
  Compass,
  Home,
  Pause,
  Play,
  Plus,
  Rocket,
  RotateCcw,
  Sparkles,
  Timer,
  Trash2,
  Zap,
} from 'lucide-react';
import {
  RoutineBlockCategory,
  RoutineDayKey,
  Student,
  StudentDailyMomentumLog,
  StudentRoutineBlock,
  StudentTimeManagementData,
} from '../types';
import { formatBengaliDate, toBengaliNumber } from '../utils/bengali';

interface TimeManagementViewProps {
  student: Student;
  dailyStudyHoursGoal?: number;
  onSaveTimeManagement: (nextData: StudentTimeManagementData) => void;
  onOpenMonerBari: () => void;
  onOpenIccheDana: () => void;
}

const ROUTINE_CATEGORIES: {
  id: RoutineBlockCategory;
  labelBn: string;
  barClass: string;
}[] = [
  { id: 'study', labelBn: 'পড়াশোনা ও অনুশীলন', barClass: 'bg-indigo-600' },
  { id: 'school', labelBn: 'বিদ্যালয় ও ক্লাস', barClass: 'bg-sky-600' },
  { id: 'spiritual', labelBn: 'নামাজ ও মানসিক প্রশান্তি', barClass: 'bg-emerald-600' },
  { id: 'health', labelBn: 'খেলাধুলা ও স্বাস্থ্য', barClass: 'bg-amber-500' },
  { id: 'hobby', labelBn: 'সৃজনশীল ও শখ', barClass: 'bg-violet-600' },
  { id: 'rest', labelBn: 'বিশ্রাম ও পরিবার', barClass: 'bg-slate-400' },
];

const WEEKDAYS_LIST: { key: RoutineDayKey; shortBn: string; fullBn: string; jsDay: number }[] = [
  { key: 'sat', shortBn: 'শনি', fullBn: 'শনিবার', jsDay: 6 },
  { key: 'sun', shortBn: 'রবি', fullBn: 'রবিবার', jsDay: 0 },
  { key: 'mon', shortBn: 'সোম', fullBn: 'সোমবার', jsDay: 1 },
  { key: 'tue', shortBn: 'মঙ্গল', fullBn: 'মঙ্গলবার', jsDay: 2 },
  { key: 'wed', shortBn: 'বুধ', fullBn: 'বুধবার', jsDay: 3 },
  { key: 'thu', shortBn: 'বৃহঃ', fullBn: 'বৃহস্পতিবার', jsDay: 4 },
  { key: 'fri', shortBn: 'শুক্র', fullBn: 'শুক্রবার', jsDay: 5 },
];

const BN_SHORT_WEEKDAYS = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র', 'শনি'];

const FOCUS_PRESETS_MIN = [15, 25, 45, 60];

const TIMELINE_START_MIN = 5 * 60; // 05:00 AM
const TIMELINE_END_MIN = 23 * 60; // 11:00 PM
const TIMELINE_SPAN_MIN = TIMELINE_END_MIN - TIMELINE_START_MIN; // 1080 min

function getLocalDateIso(dateObj = new Date()): string {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTodayRoutineDayKey(dateObj = new Date()): RoutineDayKey {
  const jsDay = dateObj.getDay();
  return WEEKDAYS_LIST.find((w) => w.jsDay === jsDay)?.key || 'sat';
}

function getCurrentTimeHHMM(dateObj = new Date()): string {
  const hh = String(dateObj.getHours()).padStart(2, '0');
  const mm = String(dateObj.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = (hhmm || '00:00').split(':').map((n) => parseInt(n, 10) || 0);
  return h * 60 + m;
}

function getDurationMinutes(startTime: string, endTime: string): number {
  const s = timeToMinutes(startTime);
  let e = timeToMinutes(endTime);
  if (e <= s) e += 24 * 60;
  return Math.max(5, e - s);
}

function formatDurationBn(minutes: number): string {
  if (minutes < 60) {
    return `${toBengaliNumber(minutes)} মিনিট`;
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${toBengaliNumber(h)} ঘণ্টা`;
  return `${toBengaliNumber(h)} ঘণ্টা ${toBengaliNumber(m)} মি.`;
}

function formatTimeBn(hhmm: string): string {
  const [hRaw, mRaw] = (hhmm || '00:00').split(':').map((n) => parseInt(n, 10) || 0);
  const period =
    hRaw < 5
      ? 'রাত'
      : hRaw < 12
      ? 'সকাল'
      : hRaw < 15
      ? 'দুপুর'
      : hRaw < 18
      ? 'বিকাল'
      : hRaw < 20
      ? 'সন্ধ্যা'
      : 'রাত';
  const h12 = hRaw % 12 === 0 ? 12 : hRaw % 12;
  const mmStr = String(mRaw).padStart(2, '0');
  return `${period} ${toBengaliNumber(h12)}:${toBengaliNumber(mmStr)}`;
}

function blockAppliesToDay(block: StudentRoutineBlock, dayKey: RoutineDayKey): boolean {
  if (!block.daysOfWeek || block.daysOfWeek.length === 0 || block.daysOfWeek.length === 7) {
    return true;
  }
  return block.daysOfWeek.includes(dayKey);
}

function formatBlockDaysLabel(daysOfWeek?: RoutineDayKey[]): string {
  if (!daysOfWeek || daysOfWeek.length === 0 || daysOfWeek.length === 7) {
    return 'প্রতিদিন';
  }
  return daysOfWeek
    .map((k) => WEEKDAYS_LIST.find((w) => w.key === k)?.shortBn || k)
    .join(', ');
}

function buildStarterRoutine(studentId: string): StudentRoutineBlock[] {
  return [
    {
      id: `rt-${studentId}-1`,
      startTime: '06:00',
      endTime: '06:30',
      titleBn: 'ফজরের নামাজ, হালকা ব্যায়াম ও সকালের সতেজ শুরু',
      category: 'spiritual',
      daysOfWeek: ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'],
      noteBn: 'শান্ত মনে দিন শুরু করলে সারা দিনের মোমেন্টাম সুন্দর থাকে',
      completedDates: [],
    },
    {
      id: `rt-${studentId}-2`,
      startTime: '06:45',
      endTime: '08:00',
      titleBn: 'সকালের গভীর মনোযোগী পড়াশোনা (গণিত ও ইংরেজি)',
      category: 'study',
      daysOfWeek: ['sat', 'sun', 'mon', 'tue', 'wed', 'thu'],
      noteBn: 'সকালের সতেজ মস্তিষ্কে কঠিন বিষয় অনুশীলন',
      completedDates: [],
    },
    {
      id: `rt-${studentId}-3`,
      startTime: '09:00',
      endTime: '15:30',
      titleBn: 'বিদ্যালয়ে নিয়মিত উপস্থিতি ও শ্রেণি পাঠদান',
      category: 'school',
      daysOfWeek: ['sat', 'sun', 'mon', 'tue', 'wed', 'thu'],
      noteBn: 'শিক্ষকের প্রতিটি কথা মনোযোগ দিয়ে শোনা ও নোট নেওয়া',
      completedDates: [],
    },
    {
      id: `rt-${studentId}-weekly-fri`,
      startTime: '09:30',
      endTime: '11:30',
      titleBn: 'সাপ্তাহিক পড়াশোনা রিভিশন ও মডেল টেস্ট অনুশীলন',
      category: 'study',
      daysOfWeek: ['fri'],
      noteBn: 'সারা সপ্তাহের পড়া ঝালাই করে নেওয়ার বিশেষ সাপ্তাহিক সেশন',
      completedDates: [],
    },
    {
      id: `rt-${studentId}-4`,
      startTime: '16:30',
      endTime: '17:30',
      titleBn: 'বিকেলের খেলাধুলা, শরীরচর্চা ও আনন্দময় সময়',
      category: 'health',
      daysOfWeek: ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'],
      noteBn: 'সুস্থ শরীর মানেই প্রখর মনোযোগ',
      completedDates: [],
    },
    {
      id: `rt-${studentId}-5`,
      startTime: '18:30',
      endTime: '20:30',
      titleBn: 'সন্ধ্যার হোমওয়ার্ক ও পাঠ পুনরাবৃত্তি (রিভিশন)',
      category: 'study',
      daysOfWeek: ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'],
      noteBn: 'দিনের পড়া দিনেই গুছিয়ে শেষ করা',
      completedDates: [],
    },
    {
      id: `rt-${studentId}-6`,
      startTime: '20:45',
      endTime: '21:15',
      titleBn: 'পরিবারের সাথে রাতের খাবার ও গল্পগুজব',
      category: 'rest',
      daysOfWeek: ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'],
      noteBn: 'মা-বাবার সাথে সুন্দর মুহূর্ত কাটানো',
      completedDates: [],
    },
    {
      id: `rt-${studentId}-7`,
      startTime: '21:15',
      endTime: '21:45',
      titleBn: 'পরদিনের স্কুল ব্যাগ গোছানো ও মনের বাড়ি ডায়েরি লেখা',
      category: 'hobby',
      daysOfWeek: ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'],
      noteBn: 'আগাম প্রস্তুতিই আগামীকালের সাফল্যের চাবিকাঠি',
      completedDates: [],
    },
  ];
}

function getCategoryMeta(cat: RoutineBlockCategory) {
  return ROUTINE_CATEGORIES.find((c) => c.id === cat) || ROUTINE_CATEGORIES[0];
}

export const TimeManagementView: React.FC<TimeManagementViewProps> = ({
  student,
  dailyStudyHoursGoal = 3,
  onSaveTimeManagement,
  onOpenMonerBari,
  onOpenIccheDana,
}) => {
  const todayIso = useMemo(() => getLocalDateIso(), []);
  const todayDayKey = useMemo(() => getTodayRoutineDayKey(), []);
  const [selectedDayKey, setSelectedDayKey] = useState<RoutineDayKey>(todayDayKey);
  const [nowHHMM, setNowHHMM] = useState<string>(() => getCurrentTimeHHMM());

  useEffect(() => {
    const t = setInterval(() => setNowHHMM(getCurrentTimeHHMM()), 30000);
    return () => clearInterval(t);
  }, []);

  const starterBlocks = useMemo(() => buildStarterRoutine(student.id), [student.id]);

  const timeData: StudentTimeManagementData = useMemo(() => {
    if (student.timeManagement && Array.isArray(student.timeManagement.routineBlocks)) {
      return student.timeManagement;
    }
    return {
      routineBlocks: starterBlocks,
      dailyLogs: [],
      totalFocusMinutes: 0,
    };
  }, [student.timeManagement, starterBlocks]);

  const allRoutineBlocks = useMemo(
    () =>
      [...(timeData.routineBlocks || [])].sort((a, b) =>
        a.startTime.localeCompare(b.startTime)
      ),
    [timeData.routineBlocks]
  );

  // Blocks belonging to the currently viewed day (today or another day in the weekly planner)
  const dayRoutineBlocks = useMemo(
    () => allRoutineBlocks.filter((b) => blockAppliesToDay(b, selectedDayKey)),
    [allRoutineBlocks, selectedDayKey]
  );

  const dailyLogs = useMemo(() => timeData.dailyLogs || [], [timeData.dailyLogs]);

  // Category filter state
  const [categoryFilter, setCategoryFilter] = useState<'all' | RoutineBlockCategory>('all');

  // Add routine block form state (supports daily + weekly multi-day selection)
  const [showAddForm, setShowAddForm] = useState(false);
  const [startTimeInput, setStartTimeInput] = useState('17:30');
  const [endTimeInput, setEndTimeInput] = useState('18:15');
  const [titleInput, setTitleInput] = useState('');
  const [categoryInput, setCategoryInput] = useState<RoutineBlockCategory>('study');
  const [selectedFormDays, setSelectedFormDays] = useState<RoutineDayKey[]>(
    WEEKDAYS_LIST.map((w) => w.key)
  );
  const [noteInput, setNoteInput] = useState('');
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  // Interactive Focus Timer ("Time Machine") state
  const [timerPresetMin, setTimerPresetMin] = useState<number>(25);
  const [timerTaskTitle, setTimerTaskTitle] = useState<string>('গভীর মনোযোগী পড়াশোনা');
  const [secondsLeft, setSecondsLeft] = useState<number>(25 * 60);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setSaveNotice(msg);
    setTimeout(() => setSaveNotice(null), 3500);
  };

  const commitTimeData = (next: StudentTimeManagementData, msg: string) => {
    onSaveTimeManagement({
      ...next,
      updatedAt: new Date().toISOString(),
    });
    showToast(msg);
  };

  // Focus Timer countdown tick
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  const selectTimerDuration = (minutes: number, customTitle?: string) => {
    setIsRunning(false);
    setTimerPresetMin(minutes);
    setSecondsLeft(minutes * 60);
    if (customTitle) {
      setTimerTaskTitle(customTitle);
    }
  };

  const handleLogFocusSession = () => {
    const elapsedSec = Math.max(60, timerPresetMin * 60 - secondsLeft);
    const loggedMinutes = Math.max(1, Math.round(elapsedSec / 60));

    const existingTodayLog = dailyLogs.find((l) => l.date === todayIso);
    const updatedTodayLog: StudentDailyMomentumLog = existingTodayLog
      ? {
          ...existingTodayLog,
          focusedMinutes: existingTodayLog.focusedMinutes + loggedMinutes,
          sessionsCount: existingTodayLog.sessionsCount + 1,
        }
      : {
          date: todayIso,
          completedBlockIds: allRoutineBlocks
            .filter(
              (b) =>
                blockAppliesToDay(b, todayDayKey) &&
                (b.completedDates || []).includes(todayIso)
            )
            .map((b) => b.id),
          focusedMinutes: loggedMinutes,
          sessionsCount: 1,
        };

    const nextLogs = [
      updatedTodayLog,
      ...dailyLogs.filter((l) => l.date !== todayIso),
    ].slice(0, 60);

    commitTimeData(
      {
        ...timeData,
        routineBlocks: allRoutineBlocks,
        dailyLogs: nextLogs,
        totalFocusMinutes: (timeData.totalFocusMinutes || 0) + loggedMinutes,
      },
      `✓ অভিনন্দন! ${toBengaliNumber(loggedMinutes)} মিনিটের সফল ফোকাস সেশন লগ হয়েছে!`
    );

    setIsRunning(false);
    setSecondsLeft(timerPresetMin * 60);
  };

  const handleToggleBlockComplete = (blockId: string) => {
    const nextBlocks = allRoutineBlocks.map((b) => {
      if (b.id !== blockId) return b;
      const dates = b.completedDates || [];
      const already = dates.includes(todayIso);
      return {
        ...b,
        completedDates: already ? dates.filter((d) => d !== todayIso) : [...dates, todayIso],
      };
    });

    const completedIdsToday = nextBlocks
      .filter((b) => (b.completedDates || []).includes(todayIso))
      .map((b) => b.id);

    const existingTodayLog = dailyLogs.find((l) => l.date === todayIso);
    const updatedTodayLog: StudentDailyMomentumLog = existingTodayLog
      ? { ...existingTodayLog, completedBlockIds: completedIdsToday }
      : {
          date: todayIso,
          completedBlockIds: completedIdsToday,
          focusedMinutes: 0,
          sessionsCount: 0,
        };

    const nextLogs = [
      updatedTodayLog,
      ...dailyLogs.filter((l) => l.date !== todayIso),
    ].slice(0, 60);

    const toggledBlock = nextBlocks.find((b) => b.id === blockId);
    const nowDone = Boolean(toggledBlock?.completedDates?.includes(todayIso));

    commitTimeData(
      {
        ...timeData,
        routineBlocks: nextBlocks,
        dailyLogs: nextLogs,
      },
      nowDone
        ? '✓ দারুণ! একটি সোনালি মোমেন্টাম সম্পন্ন হয়েছে!'
        : '✓ কাজের অবস্থা আপডেট করা হয়েছে'
    );
  };

  const handleToggleFormDay = (dayKey: RoutineDayKey) => {
    setSelectedFormDays((prev) => {
      if (prev.includes(dayKey)) {
        return prev.length > 1 ? prev.filter((d) => d !== dayKey) : prev;
      }
      return [...prev, dayKey];
    });
  };

  const handleAddBlock = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedTitle = titleInput.trim();
    if (!cleanedTitle) return;

    const newBlock: StudentRoutineBlock = {
      id: `rt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      startTime: startTimeInput,
      endTime: endTimeInput,
      titleBn: cleanedTitle,
      category: categoryInput,
      daysOfWeek:
        selectedFormDays.length === 7
          ? WEEKDAYS_LIST.map((w) => w.key)
          : selectedFormDays,
      noteBn: noteInput.trim() || undefined,
      completedDates: [],
    };

    commitTimeData(
      {
        ...timeData,
        routineBlocks: [...allRoutineBlocks, newBlock],
      },
      '✓ তোমার দৈনিক ও সাপ্তাহিক রুটিনে নতুন সময়সূচি যুক্ত হয়েছে!'
    );

    setTitleInput('');
    setNoteInput('');
    setShowAddForm(false);
  };

  const handleDeleteBlock = (blockId: string) => {
    commitTimeData(
      {
        ...timeData,
        routineBlocks: allRoutineBlocks.filter((b) => b.id !== blockId),
      },
      '✓ রুটিনের সময়টি তালিকা থেকে সরানো হয়েছে'
    );
  };

  const handleLoadStarterTemplate = () => {
    commitTimeData(
      {
        ...timeData,
        routineBlocks: buildStarterRoutine(student.id),
      },
      '✓ আদর্শ শিক্ষার্থীর দৈনিক ও সাপ্তাহিক রুটিন সেট করা হয়েছে!'
    );
  };

  // Computed KPI Metrics for Today
  const todayBlocks = useMemo(
    () => allRoutineBlocks.filter((b) => blockAppliesToDay(b, todayDayKey)),
    [allRoutineBlocks, todayDayKey]
  );

  const completedTodayCount = useMemo(
    () => todayBlocks.filter((b) => (b.completedDates || []).includes(todayIso)).length,
    [todayBlocks, todayIso]
  );

  const momentumPercent = useMemo(() => {
    if (todayBlocks.length === 0) return 0;
    return Math.round((completedTodayCount / todayBlocks.length) * 100);
  }, [completedTodayCount, todayBlocks.length]);

  const selectedDayStudyMinutes = useMemo(
    () =>
      dayRoutineBlocks
        .filter((b) => b.category === 'study')
        .reduce((sum, b) => sum + getDurationMinutes(b.startTime, b.endTime), 0),
    [dayRoutineBlocks]
  );

  const currentOrNextBlock = useMemo(() => {
    const nowMin = timeToMinutes(nowHHMM);
    const active = todayBlocks.find((b) => {
      const s = timeToMinutes(b.startTime);
      const e = timeToMinutes(b.endTime);
      return nowMin >= s && nowMin < e;
    });
    if (active) return { block: active, status: 'চলমান এখন' as const };
    const upcoming = todayBlocks.find((b) => timeToMinutes(b.startTime) > nowMin);
    if (upcoming) return { block: upcoming, status: 'পরবর্তী কাজ' as const };
    return todayBlocks[0]
      ? { block: todayBlocks[0], status: 'আগামীকালের প্রথম কাজ' as const }
      : null;
  }, [todayBlocks, nowHHMM]);

  const filteredBlocks = useMemo(() => {
    if (categoryFilter === 'all') return dayRoutineBlocks;
    return dayRoutineBlocks.filter((b) => b.category === categoryFilter);
  }, [dayRoutineBlocks, categoryFilter]);

  const todayLog = useMemo(
    () => dailyLogs.find((l) => l.date === todayIso),
    [dailyLogs, todayIso]
  );

  // Day Progress Timeline geometry (05:00 to 23:00 waking day)
  const isViewingToday = selectedDayKey === todayDayKey;
  const nowMinClamped = Math.min(
    TIMELINE_END_MIN,
    Math.max(TIMELINE_START_MIN, timeToMinutes(nowHHMM))
  );
  const nowMarkerPercent =
    ((nowMinClamped - TIMELINE_START_MIN) / TIMELINE_SPAN_MIN) * 100;

  const timelineSegments = useMemo(() => {
    return dayRoutineBlocks
      .map((block) => {
        const s = Math.max(TIMELINE_START_MIN, timeToMinutes(block.startTime));
        const e = Math.min(TIMELINE_END_MIN, timeToMinutes(block.endTime));
        if (e <= s) return null;
        const leftPct = ((s - TIMELINE_START_MIN) / TIMELINE_SPAN_MIN) * 100;
        const widthPct = Math.max(1.5, ((e - s) / TIMELINE_SPAN_MIN) * 100);
        const isDone = isViewingToday && (block.completedDates || []).includes(todayIso);
        return {
          block,
          leftPct,
          widthPct,
          isDone,
          durationMin: getDurationMinutes(block.startTime, block.endTime),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [dayRoutineBlocks, isViewingToday, todayIso]);

  // 7-day momentum consistency strip
  const last7DaysMomentum = useMemo(() => {
    const arr: {
      dateIso: string;
      dayShortBn: string;
      dayNumBn: string;
      completedCount: number;
      focusedMinutes: number;
    }[] = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = getLocalDateIso(d);
      const log = dailyLogs.find((item) => item.date === iso);
      const blocksDoneFromBlocks = allRoutineBlocks.filter((b) =>
        (b.completedDates || []).includes(iso)
      ).length;
      arr.push({
        dateIso: iso,
        dayShortBn: BN_SHORT_WEEKDAYS[d.getDay()],
        dayNumBn: toBengaliNumber(d.getDate()),
        completedCount: Math.max(log?.completedBlockIds?.length || 0, blocksDoneFromBlocks),
        focusedMinutes: log?.focusedMinutes || 0,
      });
    }
    return arr;
  }, [dailyLogs, allRoutineBlocks]);

  // Expert Time Manager Progression Rank
  const expertRankLabel = useMemo(() => {
    const totalDone = (timeData.totalFocusMinutes || 0) + completedTodayCount * 20;
    if (totalDone >= 300) return 'মাস্টার টাইম ম্যানেজার';
    if (totalDone >= 120) return 'অ্যাডভান্সড টাইম ম্যানেজার';
    if (totalDone >= 40) return 'সচেতন পরিকল্পনা শিল্পী';
    return 'নবীন এক্সপার্ট টাইম ম্যানেজার';
  }, [timeData.totalFocusMinutes, completedTodayCount]);

  // Timer formatting & SVG ring progress
  const mmDisplay = toBengaliNumber(String(Math.floor(secondsLeft / 60)).padStart(2, '0'));
  const ssDisplay = toBengaliNumber(String(secondsLeft % 60).padStart(2, '0'));
  const totalSec = Math.max(1, timerPresetMin * 60);
  const progressRatio = Math.min(1, Math.max(0, (totalSec - secondsLeft) / totalSec));
  const ringRadius = 56;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringStrokeOffset = ringCircumference * (1 - progressRatio);

  const selectedDayMeta =
    WEEKDAYS_LIST.find((w) => w.key === selectedDayKey) || WEEKDAYS_LIST[0];

  return (
    <div className="space-y-6">
      {/* 1. Motivational 'Expert Time Manager' Banner */}
      <header className="bg-[#091e42] text-white rounded-2xl border border-slate-800 p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2.5 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 text-xs text-amber-300 font-semibold">
            <Award className="w-4 h-4 shrink-0" />
            <span>এক্সপার্ট টাইম ম্যানেজার (Expert Time Manager)</span>
            <span aria-hidden="true" className="text-slate-500">·</span>
            <span className="text-emerald-300">{expertRankLabel}</span>
            <span aria-hidden="true" className="text-slate-500">·</span>
            <span className="text-slate-300">{formatBengaliDate(todayIso)}</span>
          </div>

          <h3 className="text-2xl sm:text-3xl font-bold font-serif text-white tracking-tight">
            হয়ে ওঠো এক্সপার্ট টাইম ম্যানেজার — সময়ের সোনালি রেখায় সাজাও জীবন
          </h3>

          <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-serif">
            আমরা যদি সুন্দর করে পরিকল্পনা করি, তবেই সামনে তৈরি হয় চমৎকার সব মোমেন্টাম বা সোনালি মুহূর্ত। সময়ের পরিকল্পিত ব্যবহারে আমরা যত দক্ষ হবো, ভবিষ্যৎ ঠিক সেই আলোর রেখা ধরেই উজ্জ্বল থেকে উজ্জ্বলতর হবে। তাই নিয়মিত পড়াশোনার রুটিন তৈরি করো এখনই — দেখবে, সময়ের চালিকাশক্তি ঠিকই চলে আসবে তোমারই নিয়ন্ত্রণে!
          </p>
        </div>

        <div className="flex flex-wrap lg:flex-col items-stretch sm:items-center lg:items-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setSelectedFormDays([selectedDayKey]);
              setShowAddForm(true);
            }}
            className="px-4 py-2.5 min-h-[44px] bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs sm:text-sm font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>এখনই নতুন রুটিন যোগ করো</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenMonerBari}
              className="px-3.5 py-2 min-h-[40px] bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Home className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
              <span>মনের বাড়ি</span>
            </button>
            <button
              type="button"
              onClick={onOpenIccheDana}
              className="px-3.5 py-2 min-h-[40px] bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Rocket className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>ইচ্ছে ডানা</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Real-Time Time-Control Summary Strip (4 Tabular Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-1.5">
          <div className="text-xs font-medium text-slate-500">আজকের মোমেন্টাম (Momentum)</div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold text-emerald-700 font-mono tabular-nums">
              {toBengaliNumber(momentumPercent)}%
            </span>
            <span className="text-xs text-slate-600 tabular-nums">
              {toBengaliNumber(completedTodayCount)}/{toBengaliNumber(todayBlocks.length)} সম্পন্ন
            </span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-600 rounded-full transition-all duration-300"
              style={{ width: `${momentumPercent}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-1">
          <div className="text-xs font-medium text-slate-500">
            {selectedDayMeta.shortBn}বার পড়াশোনার বরাদ্দ
          </div>
          <div className="text-2xl font-bold text-indigo-900 font-mono tabular-nums">
            {formatDurationBn(selectedDayStudyMinutes)}
          </div>
          <div className="text-xs text-slate-500 tabular-nums">
            দৈনিক লক্ষ্য: {toBengaliNumber(dailyStudyHoursGoal)} ঘণ্টা
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-1">
          <div className="text-xs font-medium text-slate-500">আজকের গভীর মনোযোগ</div>
          <div className="text-2xl font-bold text-amber-700 font-mono tabular-nums">
            {toBengaliNumber(todayLog?.focusedMinutes || 0)} মি.
          </div>
          <div className="text-xs text-slate-500 tabular-nums">
            মোট সঞ্চিত: {toBengaliNumber(timeData.totalFocusMinutes || 0)} মিনিট
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-1">
          <div className="text-xs font-medium text-slate-500">
            {currentOrNextBlock ? currentOrNextBlock.status : 'রুটিন অবস্থা'}
          </div>
          <div className="text-sm font-bold text-slate-900 line-clamp-1">
            {currentOrNextBlock ? currentOrNextBlock.block.titleBn : 'সময় যোগ করো'}
          </div>
          <div className="text-xs text-slate-500 font-mono tabular-nums">
            {currentOrNextBlock
              ? `${formatTimeBn(currentOrNextBlock.block.startTime)} – ${formatTimeBn(currentOrNextBlock.block.endTime)}`
              : 'তোমার সময় তোমার নিয়ন্ত্রণে'}
          </div>
        </div>
      </div>

      {/* 3. Visual Day Progress Timeline (ভোর ৫:০০ – রাত ১১:০০) */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h4 className="text-base sm:text-lg font-bold text-slate-900 font-serif flex items-center gap-2">
              <Timer className="w-4 h-4 text-indigo-700 shrink-0" />
              <span>
                দিনের সময়ের অগ্রগতি টাইমলাইন — {selectedDayMeta.fullBn}
                {isViewingToday ? ' (আজ)' : ''}
              </span>
            </h4>
            <p className="text-xs text-slate-500">
              ভোর ৫টা থেকে রাত ১১টা পর্যন্ত তোমার পুরো দিনটি কীভাবে সাজানো আছে তা এক নজরে দেখো।
            </p>
          </div>

          {isViewingToday && (
            <div className="text-xs font-semibold text-slate-700 font-mono tabular-nums">
              এখন: {formatTimeBn(nowHHMM)} · দিনের {toBengaliNumber(Math.round(nowMarkerPercent))}% অতিবাহিত
            </div>
          )}
        </div>

        {/* Weekly Day Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto">
          {WEEKDAYS_LIST.map((day) => {
            const isSelected = selectedDayKey === day.key;
            const isToday = day.key === todayDayKey;
            return (
              <button
                key={day.key}
                type="button"
                onClick={() => setSelectedDayKey(day.key)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                <span>{day.fullBn}</span>
                {isToday && (
                  <span
                    className={`text-[10px] font-bold ${
                      isSelected ? 'text-amber-300' : 'text-emerald-700'
                    }`}
                  >
                    (আজ)
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Visual Horizontal 18-Hour Timeline Bar */}
        <div className="space-y-2 pt-2">
          <div className="relative h-12 bg-slate-100 rounded-xl border border-slate-200 overflow-hidden">
            {/* Elapsed day soft shading when viewing today */}
            {isViewingToday && (
              <div
                className="absolute inset-y-0 left-0 bg-slate-200/70 pointer-events-none"
                style={{ width: `${nowMarkerPercent}%` }}
              />
            )}

            {/* Scheduled Routine Segments */}
            {timelineSegments.map(({ block, leftPct, widthPct, isDone }) => {
              const catMeta = getCategoryMeta(block.category);
              return (
                <button
                  key={block.id}
                  type="button"
                  onClick={() =>
                    selectTimerDuration(
                      Math.min(
                        90,
                        Math.max(5, getDurationMinutes(block.startTime, block.endTime))
                      ),
                      block.titleBn
                    )
                  }
                  title={`${formatTimeBn(block.startTime)} – ${formatTimeBn(block.endTime)}: ${block.titleBn}`}
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                  className={`absolute top-1.5 bottom-1.5 rounded-lg transition-opacity cursor-pointer overflow-hidden px-1.5 flex items-center justify-center text-[10px] font-bold text-white shadow-sm ${
                    isDone ? 'bg-emerald-600 ring-2 ring-emerald-300' : catMeta.barClass
                  } hover:opacity-95`}
                >
                  <span className="truncate">{widthPct >= 6 ? block.titleBn : ''}</span>
                </button>
              );
            })}

            {/* Current Clock Vertical Needle */}
            {isViewingToday && (
              <div
                className="absolute inset-y-0 w-0.5 bg-rose-600 z-10 pointer-events-none"
                style={{ left: `${nowMarkerPercent}%` }}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-rose-600 -ml-[4px] -mt-0.5 border border-white" />
              </div>
            )}
          </div>

          {/* Hour Markers & Category Legend */}
          <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono tabular-nums px-0.5">
            <span>ভোর ৫টা</span>
            <span className="hidden sm:inline">সকাল ৮টা</span>
            <span>সকাল ১১টা</span>
            <span className="hidden sm:inline">দুপুর ২টা</span>
            <span>বিকাল ৫টা</span>
            <span className="hidden sm:inline">রাত ৮টা</span>
            <span>রাত ১১টা</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-xs text-slate-600">
            {ROUTINE_CATEGORIES.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-sm ${c.barClass}`} />
                <span>{c.labelBn}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {saveNotice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs sm:text-sm font-bold text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{saveNotice}</span>
        </div>
      )}

      {/* 4. Main Two-Zone Workspace: Routine Board (Left 7 cols) + Focus Time-Machine (Right 5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT ZONE: Daily & Weekly Routine Planner */}
        <section className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <h4 className="text-base sm:text-lg font-bold text-slate-900 font-serif flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-indigo-700 shrink-0" />
                <span>
                  {selectedDayMeta.fullBn}-এর পড়াশোনা ও দৈনিক রুটিন ({toBengaliNumber(dayRoutineBlocks.length)}টি ধাপ)
                </span>
              </h4>
              <p className="text-xs text-slate-500">
                সপ্তাহের প্রতিটি দিনের জন্য বিষয়ভিত্তিক বা প্রতিদিনের রুটিন তৈরি ও অনুসরণ করো।
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleLoadStarterTemplate}
                className="px-3 py-2 min-h-[40px] bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition cursor-pointer whitespace-nowrap"
              >
                আদর্শ রুটিন সাজাও
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm((prev) => !prev)}
                className="px-3.5 py-2 min-h-[40px] bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>{showAddForm ? 'ফর্ম বন্ধ' : 'নতুন সময় যোগ'}</span>
              </button>
            </div>
          </div>

          {/* Add New Routine Block Form (Daily or Specific Weekdays) */}
          {showAddForm && (
            <form
              onSubmit={handleAddBlock}
              className="p-4 sm:p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4"
            >
              <div className="text-sm font-bold text-slate-900 font-serif">
                দৈনিক বা সাপ্তাহিক রুটিনে নতুন সময়-ব্লক তৈরি করো
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">শুরুর সময় *</label>
                  <input
                    type="time"
                    required
                    value={startTimeInput}
                    onChange={(e) => setStartTimeInput(e.target.value)}
                    className="w-full min-h-[42px] text-xs sm:text-sm px-3 py-2 border border-slate-300 rounded-xl bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">শেষের সময় *</label>
                  <input
                    type="time"
                    required
                    value={endTimeInput}
                    onChange={(e) => setEndTimeInput(e.target.value)}
                    className="w-full min-h-[42px] text-xs sm:text-sm px-3 py-2 border border-slate-300 rounded-xl bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">কাজের ধরন</label>
                  <select
                    value={categoryInput}
                    onChange={(e) => setCategoryInput(e.target.value as RoutineBlockCategory)}
                    className="w-full min-h-[42px] text-xs px-3 py-2 border border-slate-300 rounded-xl bg-white"
                  >
                    {ROUTINE_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.labelBn}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    কোন কোন দিনে এটি প্রযোজ্য হবে?
                  </label>
                  <button
                    type="button"
                    onClick={() => setSelectedFormDays(WEEKDAYS_LIST.map((w) => w.key))}
                    className="text-xs font-semibold text-indigo-700 hover:underline cursor-pointer"
                  >
                    প্রতিদিন সিলেক্ট করুন
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS_LIST.map((w) => {
                    const active = selectedFormDays.includes(w.key);
                    return (
                      <button
                        key={w.key}
                        type="button"
                        onClick={() => handleToggleFormDay(w.key)}
                        className={`px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-semibold border transition cursor-pointer ${
                          active
                            ? 'bg-indigo-700 text-white border-indigo-700'
                            : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400'
                        }`}
                      >
                        {w.shortBn}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  কী করবে এই সময়ে? *
                </label>
                <input
                  type="text"
                  required
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  placeholder="যেমন: গণিত জ্যামিতি ও ইংরেজি গ্রামার অনুশীলন"
                  className="w-full min-h-[44px] text-xs sm:text-sm px-3.5 py-2 border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  সহায়ক নোট বা লক্ষ্য (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="যেমন: মোবাইল দূরে রেখে পূর্ণ মনোযোগে পড়া"
                  className="w-full min-h-[42px] text-xs sm:text-sm px-3.5 py-2 border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 min-h-[40px] bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 min-h-[40px] bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>রুটিনে যুক্ত করুন</span>
                </button>
              </div>
            </form>
          )}

          {/* Category Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                categoryFilter === 'all'
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              সবগুলো ({toBengaliNumber(dayRoutineBlocks.length)})
            </button>
            {ROUTINE_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryFilter(c.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  categoryFilter === c.id
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                {c.labelBn}
              </button>
            ))}
          </div>

          {/* Chronological Timeline List */}
          {filteredBlocks.length === 0 ? (
            <div className="p-8 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-center space-y-2">
              <div className="text-sm font-bold text-slate-800">
                {selectedDayMeta.fullBn}-এর এই বিভাগে এখনো কোনো সময়সূচি নেই
              </div>
              <p className="text-xs text-slate-500">
                উপরের &ldquo;নতুন সময় যোগ&rdquo; বাটনে ক্লিক করে এই দিনের বিশেষ রুটিন সাজাও।
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {filteredBlocks.map((block) => {
                const isDone = isViewingToday && (block.completedDates || []).includes(todayIso);
                const durationMin = getDurationMinutes(block.startTime, block.endTime);
                const isLiveNow =
                  isViewingToday &&
                  timeToMinutes(nowHHMM) >= timeToMinutes(block.startTime) &&
                  timeToMinutes(nowHHMM) < timeToMinutes(block.endTime);
                const catMeta = getCategoryMeta(block.category);

                return (
                  <li
                    key={block.id}
                    className={`p-3.5 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isDone
                        ? 'bg-emerald-50/70 border-emerald-200'
                        : isLiveNow
                        ? 'bg-amber-50/70 border-amber-300'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <button
                        type="button"
                        disabled={!isViewingToday}
                        onClick={() => handleToggleBlockComplete(block.id)}
                        aria-label={isDone ? 'সম্পন্ন বাতিল করুন' : 'সম্পন্ন হিসেবে চিহ্নিত করুন'}
                        title={
                          isViewingToday
                            ? 'আজকের কাজ সম্পন্ন চিহ্নিত করুন'
                            : 'কেবল আজকের দিনের কাজের টিক চিহ্ন দেওয়া যায়'
                        }
                        className="min-w-[44px] min-h-[44px] -m-2 flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-default shrink-0"
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                        ) : (
                          <Circle className="w-5 h-5 text-slate-400 hover:text-indigo-600" />
                        )}
                      </button>

                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className={`w-2 h-2 rounded-full ${catMeta.barClass} shrink-0`} />
                          <span className="font-mono font-bold text-slate-800 tabular-nums">
                            {formatTimeBn(block.startTime)} – {formatTimeBn(block.endTime)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">{formatDurationBn(durationMin)}</span>
                          <span aria-hidden="true">·</span>
                          <span className="text-indigo-700 font-semibold">{catMeta.labelBn}</span>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-500">
                            {formatBlockDaysLabel(block.daysOfWeek)}
                          </span>
                          {isLiveNow && !isDone && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-amber-800 font-bold">এখনকার সময়</span>
                            </>
                          )}
                        </div>

                        <div
                          className={`text-sm font-bold leading-snug ${
                            isDone ? 'text-slate-500 line-through' : 'text-slate-900'
                          }`}
                        >
                          {block.titleBn}
                        </div>

                        {block.noteBn && (
                          <p className="text-xs text-slate-600 leading-relaxed">{block.noteBn}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 pl-9 sm:pl-0">
                      <button
                        type="button"
                        onClick={() =>
                          selectTimerDuration(Math.min(90, Math.max(5, durationMin)), block.titleBn)
                        }
                        className="px-3 py-1.5 min-h-[36px] bg-slate-100 hover:bg-indigo-700 hover:text-white text-slate-700 text-xs font-semibold rounded-lg transition flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        <Play className="w-3 h-3 shrink-0" />
                        <span>টাইমার</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteBlock(block.id)}
                        className="p-2 min-h-[36px] min-w-[36px] text-slate-400 hover:text-rose-600 rounded-lg transition cursor-pointer flex items-center justify-center"
                        title="মুছে ফেলুন"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* RIGHT ZONE: Interactive Time-Machine Focus Timer + Weekly Consistency */}
        <div className="lg:col-span-5 space-y-6">
          {/* Interactive Focus Timer ("সময়-যন্ত্র ও গভীর মনোযোগ টাইমার") */}
          <section className="bg-[#091e42] text-white rounded-2xl border border-slate-800 p-5 sm:p-6 space-y-5">
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-base sm:text-lg font-bold text-amber-300 font-serif flex items-center gap-2">
                  <Zap className="w-4 h-4 shrink-0" />
                  <span>সময়-যন্ত্র ফোকাস টাইমার</span>
                </h4>
                <span className="text-xs text-emerald-300 font-mono tabular-nums">
                  {isRunning ? 'সক্রিয়' : 'প্রস্তুত'}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                নির্বাচিত কাজ: <strong className="text-white">{timerTaskTitle}</strong>
              </p>
            </div>

            {/* Circular Timer Ring & Readout */}
            <div className="flex flex-col items-center justify-center py-2">
              <div className="relative w-36 h-36 flex items-center justify-center">
                <svg className="w-36 h-36 -rotate-90" viewBox="0 0 128 128">
                  <circle
                    cx="64"
                    cy="64"
                    r={ringRadius}
                    fill="none"
                    stroke="rgba(148, 163, 184, 0.2)"
                    strokeWidth="8"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r={ringRadius}
                    fill="none"
                    stroke={secondsLeft === 0 ? '#10b981' : '#f59e0b'}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringStrokeOffset}
                    className="transition-all duration-300"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold font-mono tabular-nums text-white tracking-tight">
                    {mmDisplay}:{ssDisplay}
                  </span>
                  <span className="text-[11px] text-slate-300 mt-0.5 tabular-nums">
                    লক্ষ্য: {toBengaliNumber(timerPresetMin)} মি.
                  </span>
                </div>
              </div>
            </div>

            {/* Duration Quick Presets */}
            <div className="grid grid-cols-4 gap-2">
              {FOCUS_PRESETS_MIN.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => selectTimerDuration(m)}
                  className={`py-2 min-h-[40px] rounded-xl text-xs font-bold font-mono tabular-nums border transition cursor-pointer whitespace-nowrap ${
                    timerPresetMin === m
                      ? 'bg-amber-400 text-slate-950 border-amber-300'
                      : 'bg-slate-900/80 text-slate-200 border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  {toBengaliNumber(m)} মি.
                </button>
              ))}
            </div>

            {/* Play / Pause / Reset / Log Controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsRunning((r) => !r)}
                className={`flex-1 min-h-[44px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
                  isRunning
                    ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                }`}
              >
                {isRunning ? (
                  <>
                    <Pause className="w-4 h-4 shrink-0" />
                    <span>বিরতি দাও</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 shrink-0" />
                    <span>ফোকাস শুরু করো</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsRunning(false);
                  setSecondsLeft(timerPresetMin * 60);
                }}
                aria-label="টাইমার রিসেট"
                className="min-h-[44px] px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl transition flex items-center justify-center cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleLogFocusSession}
              className="w-full min-h-[44px] px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-emerald-500/40 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>এই সেশনের ফোকাস সময় লগ করো</span>
            </button>
          </section>

          {/* 7-Day Momentum Progress Map */}
          <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
            <div className="space-y-1">
              <h4 className="text-base font-bold text-slate-900 font-serif flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                <span>সাপ্তাহিক মোমেন্টাম ও সময় নিয়ন্ত্রণ</span>
              </h4>
              <p className="text-xs text-slate-500">
                প্রতিদিনের সম্পন্ন কাজ এবং মনোযোগের সময় মিলে তৈরি হয় তোমার সাফল্যের আলোর রেখা।
              </p>
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {last7DaysMomentum.map((day) => {
                const isToday = day.dateIso === todayIso;
                const activeDay = day.completedCount > 0 || day.focusedMinutes > 0;
                return (
                  <div
                    key={day.dateIso}
                    className={`rounded-xl p-2 border flex flex-col items-center justify-center gap-1 text-center ${
                      isToday
                        ? 'bg-slate-900 text-white border-slate-900'
                        : activeDay
                        ? 'bg-emerald-50 text-emerald-950 border-emerald-200'
                        : 'bg-slate-50 text-slate-500 border-slate-200'
                    }`}
                  >
                    <span className="text-[11px] font-medium leading-none">{day.dayShortBn}</span>
                    <span className="text-sm font-bold font-mono tabular-nums leading-none">
                      {day.dayNumBn}
                    </span>
                    <span
                      className={`text-[10px] font-mono tabular-nums leading-none ${
                        isToday
                          ? 'text-amber-300'
                          : activeDay
                          ? 'text-emerald-700 font-semibold'
                          : 'text-slate-400'
                      }`}
                    >
                      {toBengaliNumber(day.completedCount)} কাজ
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Consistent Study Habits Guide */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs text-slate-700 leading-relaxed">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
                <span>এক্সপার্ট টাইম ম্যানেজার হওয়ার ৩টি সূত্র</span>
              </div>
              <p>১. আগের রাতেই পরদিনের কঠিন ও জরুরি পড়া ঠিক করে রাখা।</p>
              <p>২. একসাথে অনেক কিছু না ধরে ২৫ মিনিট ধরে একটি কাজ শেষ করা।</p>
              <p>৩. পড়াশোনা, নামাজ, খেলা ও বিশ্রাম—প্রতিটির জন্য নির্দিষ্ট সময় রাখা।</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
