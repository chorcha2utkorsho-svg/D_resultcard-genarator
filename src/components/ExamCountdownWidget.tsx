import React, { useMemo } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Flame,
  MapPin,
  Sparkles,
  Target,
} from 'lucide-react';
import { AcademicCalendarEvent } from '../types';
import { formatBengaliDate, toBengaliNumber } from '../utils/bengali';

interface ExamCountdownWidgetProps {
  calendarEvents: AcademicCalendarEvent[];
  studentClassId: string;
  classNameBn: string;
  syllabusCount: number;
  onOpenTimeManagement?: () => void;
}

function getLocalTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseLocalDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map((n) => parseInt(n, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

function diffDaysLocal(fromIso: string, toIso: string): number {
  const a = parseLocalDate(fromIso);
  const b = parseLocalDate(toIso);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export const ExamCountdownWidget: React.FC<ExamCountdownWidgetProps> = ({
  calendarEvents,
  studentClassId,
  classNameBn,
  syllabusCount,
  onOpenTimeManagement,
}) => {
  const todayIso = getLocalTodayIso();

  const upcomingExams = useMemo(() => {
    return calendarEvents
      .filter((ev) => {
        if (ev.type !== 'exam') return false;
        const endOrStart = ev.endDate || ev.startDate;
        if (endOrStart < todayIso) return false;
        if (
          ev.applicableClasses &&
          ev.applicableClasses.length > 0 &&
          !ev.applicableClasses.includes(studentClassId)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .map((ev) => {
        const effectiveEnd = ev.endDate || ev.startDate;
        const isOngoing = ev.startDate <= todayIso && effectiveEnd >= todayIso;
        const daysUntilStart = Math.max(0, diffDaysLocal(todayIso, ev.startDate));
        const daysUntilEnd = Math.max(0, diffDaysLocal(todayIso, effectiveEnd));
        const totalDurationDays = Math.max(1, diffDaysLocal(ev.startDate, effectiveEnd) + 1);

        return {
          event: ev,
          isOngoing,
          daysUntilStart,
          daysUntilEnd,
          totalDurationDays,
        };
      });
  }, [calendarEvents, studentClassId, todayIso]);

  const primaryExam = upcomingExams[0] || null;
  const secondaryExams = upcomingExams.slice(1, 3);

  // Visual countdown progress percentage (30-day preparation window)
  const countdownProgress = useMemo(() => {
    if (!primaryExam) return 0;
    if (primaryExam.isOngoing) return 100;
    const windowDays = 30;
    const clamped = Math.min(windowDays, Math.max(0, primaryExam.daysUntilStart));
    return Math.round(((windowDays - clamped) / windowDays) * 100);
  }, [primaryExam]);

  const urgencyMeta = useMemo(() => {
    if (!primaryExam) {
      return {
        label: 'পরীক্ষার সূচি অপেক্ষমাণ',
        tip: 'একাডেমিক ক্যালেন্ডারে নতুন পরীক্ষার তারিখ যুক্ত হলে এখানে কাউন্টডাউন শুরু হবে।',
        accentText: 'text-slate-700',
        ringStroke: '#64748b',
        barFill: 'bg-slate-500',
        surfaceClass: 'bg-white border-slate-200',
        badgeBox: 'bg-slate-100 text-slate-800 border-slate-200',
        Icon: Calendar,
      };
    }

    if (primaryExam.isOngoing) {
      return {
        label: 'পরীক্ষা চলমান রয়েছে',
        tip: 'প্রতিদিন পরীক্ষার আগের রাতে পাঠ্যবই ও গুরুত্বপূর্ণ প্রশ্নগুলো আরেকবার ঝালিয়ে নাও এবং সময়মতো ঘুমাও।',
        accentText: 'text-rose-700',
        ringStroke: '#e11d48',
        barFill: 'bg-rose-600',
        surfaceClass: 'bg-white border-rose-200',
        badgeBox: 'bg-rose-50 text-rose-800 border-rose-200',
        Icon: Flame,
      };
    }

    if (primaryExam.daysUntilStart <= 7) {
      return {
        label: 'চূড়ান্ত প্রস্তুতি পর্ব',
        tip: 'সময় খুবই কম! নতুন বিষয় নয়, বরং পড়া অধ্যায়গুলো দ্রুত রিভিশন ও মডেল টেস্ট অনুশীলন করো।',
        accentText: 'text-amber-800',
        ringStroke: '#d97706',
        barFill: 'bg-amber-500',
        surfaceClass: 'bg-white border-amber-200',
        badgeBox: 'bg-amber-50 text-amber-900 border-amber-200',
        Icon: AlertCircle,
      };
    }

    if (primaryExam.daysUntilStart <= 21) {
      return {
        label: 'সুবর্ণ প্রস্তুতির সময়',
        tip: 'রুটিন মেনে প্রতিদিন সব বিষয়ে সমান সময় দাও—দুর্বল অধ্যায়গুলোতে আজ থেকেই বাড়তি গুরুত্ব দাও।',
        accentText: 'text-indigo-800',
        ringStroke: '#4f46e5',
        barFill: 'bg-indigo-600',
        surfaceClass: 'bg-white border-indigo-200',
        badgeBox: 'bg-indigo-50 text-indigo-900 border-indigo-200',
        Icon: Target,
      };
    }

    return {
      label: 'নিয়মিত অধ্যয়ন ও অনুশীলন',
      tip: 'হাতে পর্যাপ্ত সময় আছে! প্রতিদিনের ক্লাসের পড়া প্রতিদিন শেষ করলে পরীক্ষার আগে কোনো চাপ থাকবে না।',
      accentText: 'text-emerald-800',
      ringStroke: '#059669',
      barFill: 'bg-emerald-600',
      surfaceClass: 'bg-white border-emerald-200',
      badgeBox: 'bg-emerald-50 text-emerald-900 border-emerald-200',
      Icon: CheckCircle2,
    };
  }, [primaryExam]);

  const StatusIcon = urgencyMeta.Icon;

  // SVG circular gauge geometry
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (countdownProgress / 100) * circumference;

  if (!primaryExam) {
    return (
      <section className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-3 bg-slate-100 text-slate-700 rounded-xl shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 font-serif">আসন্ন পরীক্ষার কাউন্টডাউন</h3>
            <p className="text-xs text-slate-500 mt-1">
              {classNameBn}-র জন্য একাডেমিক ক্যালেন্ডারে আপাতত কোনো আসন্ন পরীক্ষার তারিখ নির্ধারিত নেই। নতুন পরীক্ষার সূচি প্রকাশ হলে এখানে দিন গণনা শুরু হবে।
            </p>
          </div>
        </div>
        {onOpenTimeManagement && (
          <button
            type="button"
            onClick={onOpenTimeManagement}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-center"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>পড়ার রুটিন সাজাও</span>
          </button>
        )}
      </section>
    );
  }

  const { event, isOngoing, daysUntilStart, daysUntilEnd, totalDurationDays } = primaryExam;
  const weeksLeft = Math.floor(daysUntilStart / 7);
  const remDays = daysUntilStart % 7;

  return (
    <section className={`rounded-2xl border p-5 sm:p-6 shadow-xs space-y-4 ${urgencyMeta.surfaceClass}`}>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        {/* Left: Visual Circular Countdown + Title + Schedule Info */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-5 flex-1 min-w-0">
          {/* Circular Visual Countdown Dial */}
          <div className="relative w-28 h-28 shrink-0 flex items-center justify-center self-start sm:self-center">
            <svg className="w-28 h-28 -rotate-90" viewBox="0 0 104 104" aria-hidden="true">
              <circle
                cx="52"
                cy="52"
                r={radius}
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="8"
              />
              <circle
                cx="52"
                cy="52"
                r={radius}
                fill="none"
                stroke={urgencyMeta.ringStroke}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-none">
              {isOngoing ? (
                <>
                  <span className="text-xl font-extrabold text-rose-700 tabular-nums font-mono">
                    {toBengaliNumber(daysUntilEnd)}
                  </span>
                  <span className="text-[11px] font-bold text-rose-700 mt-1">দিন বাকি</span>
                </>
              ) : daysUntilStart === 0 ? (
                <>
                  <span className="text-lg font-extrabold text-rose-700">আজই</span>
                  <span className="text-[11px] font-semibold text-slate-600 mt-1">শুরু</span>
                </>
              ) : (
                <>
                  <span className={`text-3xl font-extrabold tabular-nums font-mono ${urgencyMeta.accentText}`}>
                    {toBengaliNumber(daysUntilStart)}
                  </span>
                  <span className="text-[11px] font-bold text-slate-600 mt-1">দিন বাকি</span>
                </>
              )}
            </div>
          </div>

          {/* Exam Title & Academic Calendar Details */}
          <div className="space-y-2 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={`inline-flex items-center gap-1.5 font-bold ${urgencyMeta.accentText}`}>
                <StatusIcon className="w-4 h-4 shrink-0" />
                <span>{urgencyMeta.label}</span>
              </span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span className="text-slate-500 font-medium">একাডেমিক ক্যালেন্ডার থেকে সংযুক্ত</span>
            </div>

            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 font-serif tracking-tight">
              {event.title}
            </h3>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600 tabular-nums">
              <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
                <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>
                  {formatBengaliDate(event.startDate)}
                  {event.endDate && event.endDate !== event.startDate
                    ? ` — ${formatBengaliDate(event.endDate)}`
                    : ''}
                </span>
              </span>

              {event.location && (
                <span className="inline-flex items-center gap-1 text-slate-600">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{event.location}</span>
                </span>
              )}

              <span className="inline-flex items-center gap-1 text-slate-600">
                <BookOpen className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>মোট সিলেবাস: {toBengaliNumber(syllabusCount)}টি</span>
              </span>
            </div>

            {event.description && (
              <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                {event.description}
              </p>
            )}
          </div>
        </div>

        {/* Right: Structured Breakdown & Study Routine Action */}
        <div className="lg:w-72 shrink-0 flex flex-col justify-between gap-3 bg-slate-50 rounded-xl border border-slate-200/80 p-4">
          <div className="grid grid-cols-3 gap-2 text-center tabular-nums">
            <div className="bg-white rounded-lg border border-slate-200 py-2 px-1">
              <div className="text-base font-bold text-slate-900 font-mono">
                {toBengaliNumber(weeksLeft)}
              </div>
              <div className="text-[11px] text-slate-500">সপ্তাহ</div>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 py-2 px-1">
              <div className="text-base font-bold text-slate-900 font-mono">
                {toBengaliNumber(remDays)}
              </div>
              <div className="text-[11px] text-slate-500">অবশিষ্ট দিন</div>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 py-2 px-1">
              <div className="text-base font-bold text-indigo-700 font-mono">
                {toBengaliNumber(totalDurationDays)}
              </div>
              <div className="text-[11px] text-slate-500">দিনের সূচি</div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-600 tabular-nums">
              <span className="font-semibold">প্রস্তুতির সময়সূচি অগ্রসর</span>
              <span className={`font-bold ${urgencyMeta.accentText}`}>
                {toBengaliNumber(countdownProgress)}%
              </span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${urgencyMeta.barFill}`}
                style={{ width: `${countdownProgress}%` }}
              />
            </div>
          </div>

          {onOpenTimeManagement && (
            <button
              type="button"
              onClick={onOpenTimeManagement}
              className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5 text-amber-300" />
              <span>পরীক্ষার রুটিন সাজাও</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Bottom: Preparation Tip + Other Upcoming Exams Preview */}
      <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
        <div className="flex items-start sm:items-center gap-2 text-slate-700">
          <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5 sm:mt-0" />
          <span>{urgencyMeta.tip}</span>
        </div>

        {secondaryExams.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 shrink-0 tabular-nums">
            <span className="font-semibold text-slate-700">পরবর্তী সূচি:</span>
            {secondaryExams.map((item) => (
              <span key={item.event.id}>
                {item.event.title} ({toBengaliNumber(item.daysUntilStart)} দিন বাকি)
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
