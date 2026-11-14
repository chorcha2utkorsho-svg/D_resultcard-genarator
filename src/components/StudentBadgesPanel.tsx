import React, { useMemo, useState } from 'react';
import {
  Award,
  CalendarCheck2,
  CheckCircle2,
  Clock,
  Crown,
  Flame,
  HeartHandshake,
  Lock,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import {
  CalculatedStudentResult,
  Student,
} from '../types';
import { formatGpa, toBengaliNumber } from '../utils/bengali';

export interface VirtualBadge {
  id: string;
  titleBn: string;
  titleEn: string;
  categoryBn: string;
  descriptionBn: string;
  criterionBn: string;
  earned: boolean;
  progressPercent: number;
  progressTextBn: string;
  tier: 'gold' | 'emerald' | 'indigo' | 'amber' | 'rose';
  Icon: React.ComponentType<{ className?: string }>;
}

interface StudentBadgesPanelProps {
  student: Student;
  allTermResults: {
    termId: string;
    termName: string;
    result: CalculatedStudentResult;
  }[];
  attendanceMetrics: {
    totalWorkingDays: number;
    presentDays: number;
    percentage: number;
  };
  latestTermResult: CalculatedStudentResult | null;
  variant?: 'summary' | 'full';
  onViewAllBadges?: () => void;
}

const TIER_STYLES: Record<
  VirtualBadge['tier'],
  {
    earnedCard: string;
    iconBox: string;
    barFill: string;
    accentText: string;
  }
> = {
  gold: {
    earnedCard: 'bg-amber-50/70 border-amber-300',
    iconBox: 'bg-amber-400 text-slate-950 shadow-sm',
    barFill: 'bg-amber-500',
    accentText: 'text-amber-800',
  },
  emerald: {
    earnedCard: 'bg-emerald-50/70 border-emerald-300',
    iconBox: 'bg-emerald-600 text-white shadow-sm',
    barFill: 'bg-emerald-600',
    accentText: 'text-emerald-800',
  },
  indigo: {
    earnedCard: 'bg-indigo-50/70 border-indigo-300',
    iconBox: 'bg-indigo-600 text-white shadow-sm',
    barFill: 'bg-indigo-600',
    accentText: 'text-indigo-800',
  },
  amber: {
    earnedCard: 'bg-orange-50/60 border-orange-300',
    iconBox: 'bg-orange-500 text-white shadow-sm',
    barFill: 'bg-orange-500',
    accentText: 'text-orange-800',
  },
  rose: {
    earnedCard: 'bg-rose-50/60 border-rose-300',
    iconBox: 'bg-rose-600 text-white shadow-sm',
    barFill: 'bg-rose-600',
    accentText: 'text-rose-800',
  },
};

export const StudentBadgesPanel: React.FC<StudentBadgesPanelProps> = ({
  student,
  allTermResults,
  attendanceMetrics,
  latestTermResult,
  variant = 'full',
  onViewAllBadges,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'earned' | 'in_progress'>('all');

  const badges = useMemo<VirtualBadge[]>(() => {
    // 1. Attendance calculation (Daily attendance first, fallback to latest marksheet attendance)
    let attendancePct: number | null = null;
    let workingDays = 0;
    let presentDays = 0;
    if (attendanceMetrics.totalWorkingDays > 0) {
      attendancePct = attendanceMetrics.percentage;
      workingDays = attendanceMetrics.totalWorkingDays;
      presentDays = attendanceMetrics.presentDays;
    } else if (latestTermResult && latestTermResult.totalWorkingDays > 0) {
      workingDays = latestTermResult.totalWorkingDays;
      presentDays = latestTermResult.attendanceDays;
      attendancePct = Math.round((presentDays / workingDays) * 100);
    }

    const perfectAttendanceEarned = attendancePct !== null && attendancePct >= 95;
    const attendanceProgress = attendancePct !== null ? Math.min(100, Math.round((attendancePct / 95) * 100)) : 0;
    const attendanceProgressText =
      attendancePct !== null
        ? `${toBengaliNumber(attendancePct)}% (${toBengaliNumber(presentDays)}/${toBengaliNumber(workingDays)} দিন)`
        : 'হাজিরা তথ্য অপেক্ষমাণ';

    // 2. Academic Top Scorer & A+ Stars
    const bestGpa =
      allTermResults.length > 0
        ? Math.max(...allTermResults.map((t) => t.result.gpa))
        : 0;
    const bestRank =
      allTermResults.length > 0
        ? Math.min(...allTermResults.map((t) => t.result.meritPosition))
        : null;
    const bestPct =
      allTermResults.length > 0
        ? Math.max(
            ...allTermResults.map((t) =>
              t.result.totalFullMarks > 0
                ? Math.round((t.result.grandTotalObtained / t.result.totalFullMarks) * 100)
                : 0
            )
          )
        : 0;

    const aPlusSubjectsCount = allTermResults.reduce((maxCount, item) => {
      const cnt = item.result.subjectRows.filter((sr) => sr.letterGrade === 'A+').length;
      return Math.max(maxCount, cnt);
    }, 0);

    const topScorerEarned =
      allTermResults.length > 0 &&
      ((bestRank !== null && bestRank <= 3) || bestGpa >= 4.75 || bestPct >= 85);
    const topScorerProgress =
      allTermResults.length === 0
        ? 0
        : topScorerEarned
        ? 100
        : Math.min(99, Math.round((bestGpa / 4.75) * 100));
    const topScorerText =
      allTermResults.length === 0
        ? 'পরীক্ষার নম্বর অপেক্ষমাণ'
        : bestRank !== null && bestRank <= 3
        ? `মেধাক্রম ${toBengaliNumber(bestRank)} · সর্বোচ্চ ${toBengaliNumber(bestPct)}%`
        : `সর্বোচ্চ GPA ${formatGpa(bestGpa)} (${toBengaliNumber(bestPct)}%)`;

    const aPlusStarEarned = bestGpa >= 5.0 || aPlusSubjectsCount >= 2;
    const aPlusProgress = aPlusStarEarned
      ? 100
      : allTermResults.length === 0
      ? 0
      : Math.min(99, Math.round((aPlusSubjectsCount / 2) * 100));
    const aPlusText =
      allTermResults.length === 0
        ? 'ফলাফল প্রকাশিত হয়নি'
        : bestGpa >= 5.0
        ? `অর্জিত GPA ${formatGpa(bestGpa)} (A+)`
        : `${toBengaliNumber(aPlusSubjectsCount)} / ২টি বিষয়ে A+`;

    // 3. Exam Consistency & Progress Climber
    const passedTermsCount = allTermResults.filter((t) => t.result.isPassed).length;
    const improvedAcrossTerms =
      allTermResults.length >= 2 &&
      allTermResults[allTermResults.length - 1].result.gpa >= allTermResults[0].result.gpa &&
      allTermResults[allTermResults.length - 1].result.isPassed;
    const consistencyEarned =
      improvedAcrossTerms || (allTermResults.length >= 2 && passedTermsCount === allTermResults.length);
    const consistencyProgress = consistencyEarned
      ? 100
      : allTermResults.length === 1 && allTermResults[0].result.isPassed
      ? 50
      : 0;
    const consistencyText =
      allTermResults.length >= 2
        ? `${toBengaliNumber(passedTermsCount)}/${toBengaliNumber(allTermResults.length)} পরীক্ষায় উত্তীর্ণ`
        : allTermResults.length === 1
        ? '১/২টি পরীক্ষার ফলাফল সম্পন্ন'
        : 'একাধিক পরীক্ষার ফলাফল প্রয়োজন';

    // 4. Time Management Champion
    const routineCount = student.timeManagement?.routineBlocks?.length || 0;
    const focusMinutes = student.timeManagement?.totalFocusMinutes || 0;
    const routineLogsCount = student.timeManagement?.dailyLogs?.length || 0;
    const routineEarned = routineCount >= 3 && (focusMinutes >= 25 || routineLogsCount >= 1);
    const routineProgress = Math.min(
      100,
      Math.round(
        ((Math.min(routineCount, 3) / 3) * 50) +
          ((focusMinutes >= 25 || routineLogsCount >= 1 ? 1 : 0) * 50)
      )
    );
    const routineText = `রুটিন ${toBengaliNumber(routineCount)}টি · ফোকাস ${toBengaliNumber(focusMinutes)} মি.`;

    // 5. Mindful Journaler (Moner Bari)
    const moodCount = student.monerBari?.moodHistory?.length || 0;
    const gratitudeCount = student.monerBari?.gratitudeLogs?.length || 0;
    const journalCount = student.monerBari?.journalEntries?.length || 0;
    const reflectionTotal = gratitudeCount + journalCount;
    const mindfulEarned = moodCount >= 1 && reflectionTotal >= 1;
    const mindfulProgress = Math.min(
      100,
      (moodCount >= 1 ? 50 : 0) + (reflectionTotal >= 1 ? 50 : 0)
    );
    const mindfulText = `মুড লগ ${toBengaliNumber(moodCount)}টি · ডায়েরি/কৃতজ্ঞতা ${toBengaliNumber(reflectionTotal)}টি`;

    // 6. Goal Achiever (Future Plan milestones)
    const milestones = student.futurePlan?.milestones || [];
    const achievedMilestones = milestones.filter((m) => m.status === 'achieved').length;
    const goalEarned = achievedMilestones >= 1;
    const goalProgress = goalEarned ? 100 : milestones.length > 0 ? 45 : 0;
    const goalText = `${toBengaliNumber(achievedMilestones)}টি মাইলফলক অর্জিত`;

    const coreBadges: VirtualBadge[] = [
      {
        id: 'perfect_attendance',
        titleBn: 'পারফেক্ট অ্যাটেনডেন্স',
        titleEn: 'Perfect Attendance',
        categoryBn: 'নিয়মিত উপস্থিতি',
        descriptionBn: 'বিদ্যালয়ে ধারাবাহিক ও নিয়মিত উপস্থিতির মাধ্যমে আদর্শ শৃঙ্খলা বজায় রাখা।',
        criterionBn: 'অন্তত ৯৫% বা তার বেশি উপস্থিতি',
        earned: perfectAttendanceEarned,
        progressPercent: attendanceProgress,
        progressTextBn: attendanceProgressText,
        tier: 'emerald',
        Icon: CalendarCheck2,
      },
      {
        id: 'top_scorer',
        titleBn: 'টপ স্কোরার',
        titleEn: 'Top Scorer',
        categoryBn: 'একাডেমিক শ্রেষ্ঠত্ব',
        descriptionBn: 'পরীক্ষায় অসাধারণ ফলাফল ও শ্রেণির শীর্ষ মেধাতালিকায় স্থান অর্জন।',
        criterionBn: 'শ্রেণিতে শীর্ষ ৩-এ স্থান অথবা GPA ৪.৭৫+ / ৮৫%+ নম্বর',
        earned: topScorerEarned,
        progressPercent: topScorerProgress,
        progressTextBn: topScorerText,
        tier: 'gold',
        Icon: Crown,
      },
      {
        id: 'a_plus_star',
        titleBn: 'এ+ বিষয় তারকা',
        titleEn: 'Subject A+ Star',
        categoryBn: 'বিষয়ভিত্তিক দক্ষতা',
        descriptionBn: 'একাধিক বিষয়ে ৮০+ নম্বর পেয়ে A+ গ্রেড অর্জন করার স্বীকৃতি।',
        criterionBn: 'GPA ৫.০০ অথবা কমপক্ষে ২টি বিষয়ে A+ (৮০+)',
        earned: aPlusStarEarned,
        progressPercent: aPlusProgress,
        progressTextBn: aPlusText,
        tier: 'indigo',
        Icon: Star,
      },
      {
        id: 'consistent_climber',
        titleBn: 'ধারাবাহিক অগ্রগতি',
        titleEn: 'Consistent Climber',
        categoryBn: 'অধ্যবসায় ও উন্নতি',
        descriptionBn: 'একাধিক পরীক্ষায় ধারাবাহিক সাফল্য ও ফলাফলের মান ধরে রাখা বা উন্নত করা।',
        criterionBn: 'কমপক্ষে ২টি পরীক্ষায় উত্তীর্ণ ও ধারাবাহিক জিপিএ',
        earned: consistencyEarned,
        progressPercent: consistencyProgress,
        progressTextBn: consistencyText,
        tier: 'amber',
        Icon: TrendingUp,
      },
      {
        id: 'routine_master',
        titleBn: 'সময় ব্যবস্থাপনা চ্যাম্পিয়ন',
        titleEn: 'Time Manager',
        categoryBn: 'শৃঙ্খলা ও রুটিন',
        descriptionBn: 'নিজস্ব দৈনিক পড়ার রুটিন তৈরি ও ফোকাস টাইমার ব্যবহার করে অধ্যয়ন।',
        criterionBn: 'কমপক্ষে ৩টি রুটিন ব্লক ও ১টি ফোকাস সেশন/কাজ সম্পন্ন',
        earned: routineEarned,
        progressPercent: routineProgress,
        progressTextBn: routineText,
        tier: 'indigo',
        Icon: Clock,
      },
      {
        id: 'mindful_scholar',
        titleBn: 'সচেতন মনন ও কৃতজ্ঞতা',
        titleEn: 'Mindful Journaler',
        categoryBn: 'মানসিক সুস্থতা',
        descriptionBn: 'মনের বাড়িতে প্রতিদিনের অনুভূতি, কৃতজ্ঞতা ও ইতিবাচক ভাবনা চর্চা।',
        criterionBn: 'অন্তত ১টি মুড চেক-ইন এবং ১টি কৃতজ্ঞতা/জার্নাল এন্ট্রি',
        earned: mindfulEarned,
        progressPercent: mindfulProgress,
        progressTextBn: mindfulText,
        tier: 'rose',
        Icon: HeartHandshake,
      },
      {
        id: 'goal_achiever',
        titleBn: 'লক্ষ্যভেদী স্বপ্নদ্রষ্টা',
        titleEn: 'Goal Achiever',
        categoryBn: 'ভবিষ্যৎ লক্ষ্য',
        descriptionBn: 'ভবিষ্যৎ পরিকল্পনার নির্ধারিত মাইলফলক সফলভাবে অর্জন করা।',
        criterionBn: 'অন্তত ১টি ব্যক্তিগত লক্ষ্য "অর্জিত" হিসেবে সম্পন্ন করা',
        earned: goalEarned,
        progressPercent: goalProgress,
        progressTextBn: goalText,
        tier: 'emerald',
        Icon: Target,
      },
    ];

    const earnedCoreCount = coreBadges.filter((b) => b.earned).length;
    const allRounderBadge: VirtualBadge = {
      id: 'all_rounder_star',
      titleBn: 'অলরাউন্ডার নক্ষত্র',
      titleEn: 'Academy All-Rounder',
      categoryBn: 'সর্বোচ্চ সম্মাননা',
      descriptionBn: 'পড়াশোনা, উপস্থিতি, রুটিন ও মনন চর্চায় বহুমুখী প্রতিভার সমন্বয়।',
      criterionBn: 'উপরের কমপক্ষে ৪টি ব্যাজ অর্জন করা',
      earned: earnedCoreCount >= 4,
      progressPercent: Math.min(100, Math.round((earnedCoreCount / 4) * 100)),
      progressTextBn: `${toBengaliNumber(earnedCoreCount)} / ৪টি ব্যাজ অর্জিত`,
      tier: 'gold',
      Icon: Trophy,
    };

    return [...coreBadges, allRounderBadge];
  }, [allTermResults, attendanceMetrics, latestTermResult, student]);

  const earnedBadges = useMemo(() => badges.filter((b) => b.earned), [badges]);
  const lockedBadges = useMemo(() => badges.filter((b) => !b.earned), [badges]);

  const filteredBadges = useMemo(() => {
    if (filterMode === 'earned') return earnedBadges;
    if (filterMode === 'in_progress') return lockedBadges;
    return badges;
  }, [badges, earnedBadges, lockedBadges, filterMode]);

  // Compact Overview Showcase Mode
  if (variant === 'summary') {
    const previewList =
      earnedBadges.length > 0 ? earnedBadges.slice(0, 4) : badges.slice(0, 4);

    return (
      <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 font-serif">
                ভার্চুয়াল ব্যাজ ও অর্জন
              </h3>
              <p className="text-xs text-slate-500 tabular-nums">
                পারফরম্যান্স ডেটা অনুযায়ী {toBengaliNumber(badges.length)}টির মধ্যে{' '}
                <strong className="text-slate-800">{toBengaliNumber(earnedBadges.length)}টি</strong> ব্যাজ অর্জিত
              </p>
            </div>
          </div>

          {onViewAllBadges && (
            <button
              type="button"
              onClick={onViewAllBadges}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition cursor-pointer whitespace-nowrap"
            >
              সব ব্যাজ ও অগ্রগতি দেখুন →
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {previewList.map((badge) => {
            const Icon = badge.Icon;
            const style = TIER_STYLES[badge.tier];
            return (
              <div
                key={badge.id}
                className={`rounded-xl border p-3.5 flex items-start gap-3 transition ${
                  badge.earned ? style.earnedCard : 'bg-slate-50/70 border-slate-200'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    badge.earned ? style.iconBox : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-900 truncate">
                      {badge.titleBn}
                    </span>
                    {badge.earned ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                    )}
                  </div>
                  <div className="text-[11px] text-slate-600 truncate tabular-nums">
                    {badge.progressTextBn}
                  </div>
                  <div className="w-full h-1.5 bg-white/80 rounded-full overflow-hidden border border-slate-200/70">
                    <div
                      className={`h-full rounded-full ${
                        badge.earned ? style.barFill : 'bg-slate-400'
                      }`}
                      style={{ width: `${badge.progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  // Full Interactive Badges & Achievements System
  const completionPct = Math.round((earnedBadges.length / badges.length) * 100);

  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-5">
      {/* Header + Progress Summary */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-start gap-3.5">
          <div className="p-3 bg-amber-400 text-slate-950 rounded-2xl shadow-xs shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-800">
              <Sparkles className="w-3.5 h-3.5" />
              <span>পারফরম্যান্স-ভিত্তিক ডিজিটাল সম্মাননা</span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 font-serif mt-0.5">
              {student.nameBn}-এর ভার্চুয়াল ব্যাজ সংগ্রহশালা
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              উপস্থিতি, পরীক্ষার ফলাফল, সময় ব্যবস্থাপনা এবং মনের বাড়ির নিয়মিত চর্চার ওপর ভিত্তি করে ব্যাজ আনলক হয়।
            </p>
          </div>
        </div>

        {/* Earned Score Box */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-4 shrink-0 tabular-nums">
          <div>
            <div className="text-[11px] font-medium text-slate-500">অর্জিত ব্যাজ</div>
            <div className="text-2xl font-extrabold text-slate-900 font-mono">
              {toBengaliNumber(earnedBadges.length)}
              <span className="text-sm font-normal text-slate-500"> / {toBengaliNumber(badges.length)}</span>
            </div>
          </div>
          <div className="w-28 space-y-1">
            <div className="flex justify-between text-[11px] font-bold text-amber-800">
              <span>অগ্রগতি</span>
              <span>{toBengaliNumber(completionPct)}%</span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-500"
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200">
          {[
            { id: 'all' as const, label: `সকল ব্যাজ (${toBengaliNumber(badges.length)})` },
            { id: 'earned' as const, label: `অর্জিত (${toBengaliNumber(earnedBadges.length)})` },
            { id: 'in_progress' as const, label: `অর্জনের পথে (${toBengaliNumber(lockedBadges.length)})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterMode(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                filterMode === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Flame className="w-4 h-4 text-amber-600" />
          <span>ফলাফল বা রুটিন আপডেট হলে নতুন ব্যাজ স্বয়ংক্রিয়ভাবে আনলক হবে</span>
        </div>
      </div>

      {/* Badges Grid */}
      {filteredBadges.length === 0 ? (
        <div className="py-10 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
          {filterMode === 'earned'
            ? 'এখনো কোনো ভার্চুয়াল ব্যাজ আনলক হয়নি — নিচের লক্ষ্যগুলো পূরণ করলেই প্রথম ব্যাজ অর্জিত হবে!'
            : 'অভিনন্দন! সবগুলো ভার্চুয়াল ব্যাজ ইতোমধ্যেই অর্জিত হয়ে গেছে!'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {filteredBadges.map((badge) => {
            const Icon = badge.Icon;
            const style = TIER_STYLES[badge.tier];

            return (
              <article
                key={badge.id}
                className={`rounded-2xl border p-4 flex flex-col justify-between gap-3.5 transition ${
                  badge.earned ? style.earnedCard : 'bg-slate-50/70 border-slate-200'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                        badge.earned ? style.iconBox : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>

                    <div
                      className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                        badge.earned ? 'text-emerald-700' : 'text-slate-500'
                      }`}
                    >
                      {badge.earned ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>অর্জিত</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5 text-slate-400" />
                          <span>চলমান</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-semibold text-slate-500">
                      {badge.categoryBn} · {badge.titleEn}
                    </div>
                    <h4 className="text-base font-bold text-slate-900 font-serif mt-0.5">
                      {badge.titleBn}
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed mt-1">
                      {badge.descriptionBn}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200/70 space-y-2 text-xs">
                  <div className="text-[11px] text-slate-600">
                    <strong className="text-slate-800">শর্ত: </strong>
                    {badge.criterionBn}
                  </div>

                  <div className="space-y-1 tabular-nums">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className={`font-bold ${badge.earned ? style.accentText : 'text-slate-700'}`}>
                        {badge.progressTextBn}
                      </span>
                      <span className="font-mono font-bold text-slate-700">
                        {toBengaliNumber(badge.progressPercent)}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-white rounded-full overflow-hidden border border-slate-200">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          badge.earned ? style.barFill : 'bg-slate-400'
                        }`}
                        style={{ width: `${badge.progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
