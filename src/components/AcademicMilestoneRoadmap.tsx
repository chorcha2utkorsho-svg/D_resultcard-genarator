import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  Compass,
  FileText,
  Filter,
  Map as MapIcon,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import {
  AcademicMilestoneStatus,
  ExamTerm,
  Student,
  StudentAcademicRoadmapData,
  Subject,
  SyllabusItem,
} from '../types';
import { toBengaliNumber } from '../utils/bengali';

interface AcademicMilestoneRoadmapProps {
  student: Student;
  classNameBn: string;
  subjects: Subject[];
  examTerms: ExamTerm[];
  syllabi: SyllabusItem[];
  onSaveRoadmap: (nextData: StudentAcademicRoadmapData) => void;
  onOpenTimeManagement?: () => void;
}

interface RoadmapUnit {
  unitKey: string;
  termId: string;
  termName: string;
  subjectId: string;
  subjectName: string;
  title: string;
  description: string;
  referenceBooks?: string;
  marksDistribution?: string;
  chapters: string[];
  isOfficialSyllabus: boolean;
}

const STATUS_META: Record<
  AcademicMilestoneStatus,
  {
    labelBn: string;
    shortBn: string;
    cardClass: string;
    textClass: string;
    btnActiveClass: string;
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  not_started: {
    labelBn: 'শুরু হয়নি',
    shortBn: 'বাকি',
    cardClass: 'bg-white border-slate-200',
    textClass: 'text-slate-600',
    btnActiveClass: 'bg-slate-800 text-white border-slate-800',
    Icon: Circle,
  },
  in_progress: {
    labelBn: 'চলমান (In Progress)',
    shortBn: 'চলমান',
    cardClass: 'bg-sky-50/40 border-sky-300',
    textClass: 'text-sky-800',
    btnActiveClass: 'bg-sky-600 text-white border-sky-600',
    Icon: Clock,
  },
  completed: {
    labelBn: 'সম্পন্ন (Completed)',
    shortBn: 'সম্পন্ন',
    cardClass: 'bg-emerald-50/45 border-emerald-300',
    textClass: 'text-emerald-800',
    btnActiveClass: 'bg-emerald-600 text-white border-emerald-600',
    Icon: CheckCircle2,
  },
  needs_revision: {
    labelBn: 'রিভিশন প্রয়োজন (Needs Revision)',
    shortBn: 'রিভিশন',
    cardClass: 'bg-amber-50/50 border-amber-300',
    textClass: 'text-amber-900',
    btnActiveClass: 'bg-amber-500 text-slate-950 border-amber-500',
    Icon: RotateCcw,
  },
};

const EDITABLE_STATUSES: AcademicMilestoneStatus[] = [
  'in_progress',
  'completed',
  'needs_revision',
];

export const AcademicMilestoneRoadmap: React.FC<AcademicMilestoneRoadmapProps> = ({
  student,
  classNameBn,
  subjects,
  examTerms,
  syllabi,
  onSaveRoadmap,
  onOpenTimeManagement,
}) => {
  const [selectedTermFilter, setSelectedTermFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | AcademicMilestoneStatus>('all');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const [editingNoteKey, setEditingNoteKey] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>('');
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const roadmapData: StudentAcademicRoadmapData = useMemo(
    () => student.academicRoadmap || { milestones: {} },
    [student.academicRoadmap]
  );

  // Build full academic roadmap units per exam term pulling class syllabi + subject curricula
  const allRoadmapUnits = useMemo<RoadmapUnit[]>(() => {
    const units: RoadmapUnit[] = [];

    for (const term of examTerms) {
      const termSyllabi = syllabi.filter(
        (s) => s.classId === student.classId && s.examId === term.id
      );

      const coveredSubjectIds = new Set<string>();

      for (const syl of termSyllabi) {
        coveredSubjectIds.add(syl.subjectId);
        const subName =
          subjects.find((sub) => sub.id === syl.subjectId)?.nameBn || 'নির্ধারিত বিষয়';
        units.push({
          unitKey: `syl::${syl.id}`,
          termId: term.id,
          termName: term.nameBn,
          subjectId: syl.subjectId,
          subjectName: subName,
          title: syl.title,
          description: syl.description,
          referenceBooks: syl.referenceBooks,
          marksDistribution: syl.marksDistribution,
          chapters: Array.isArray(syl.chapters) ? syl.chapters : [],
          isOfficialSyllabus: true,
        });
      }

      // Add curriculum fallback cards for remaining class subjects so the entire year can be tracked
      for (const sub of subjects) {
        if (coveredSubjectIds.has(sub.id)) continue;
        units.push({
          unitKey: `sub::${term.id}::${sub.id}`,
          termId: term.id,
          termName: term.nameBn,
          subjectId: sub.id,
          subjectName: sub.nameBn,
          title: `${sub.nameBn} — ${term.nameBn} পাঠ্যসূচি`,
          description: `${classNameBn}-র ${sub.nameBn} বিষয়ের ${term.nameBn} অংশের পাঠ্যবই অনুশীলন ও প্রশ্নোত্তর প্রস্তুতি।`,
          chapters: [],
          isOfficialSyllabus: false,
        });
      }
    }

    return units;
  }, [examTerms, syllabi, student.classId, subjects, classNameBn]);

  const getItemStatus = (key: string): AcademicMilestoneStatus => {
    return roadmapData.milestones?.[key]?.status || 'not_started';
  };

  const getItemNote = (key: string): string => {
    return roadmapData.milestones?.[key]?.noteBn || '';
  };

  const updateMilestoneStatus = (key: string, nextStatus: AcademicMilestoneStatus) => {
    const existing = roadmapData.milestones?.[key];
    const resolvedStatus: AcademicMilestoneStatus =
      existing?.status === nextStatus ? 'not_started' : nextStatus;

    const nextMilestones = {
      ...(roadmapData.milestones || {}),
      [key]: {
        status: resolvedStatus,
        noteBn: existing?.noteBn,
        updatedAt: new Date().toISOString(),
      },
    };

    onSaveRoadmap({
      milestones: nextMilestones,
      updatedAt: new Date().toISOString(),
    });

    setSaveNotice(`✓ অবস্থা হালনাগাদ হয়েছে: ${STATUS_META[resolvedStatus].labelBn}`);
    setTimeout(() => setSaveNotice(null), 2400);
  };

  const handleSaveNote = (key: string) => {
    const existing = roadmapData.milestones?.[key];
    const nextMilestones = {
      ...(roadmapData.milestones || {}),
      [key]: {
        status: existing?.status || 'in_progress',
        noteBn: noteDraft.trim() || undefined,
        updatedAt: new Date().toISOString(),
      },
    };
    onSaveRoadmap({
      milestones: nextMilestones,
      updatedAt: new Date().toISOString(),
    });
    setEditingNoteKey(null);
    setNoteDraft('');
    setSaveNotice('✓ রিভিশন নোট সংরক্ষিত হয়েছে');
    setTimeout(() => setSaveNotice(null), 2400);
  };

  // Compute overall & per-term progress stats across units (and chapters when present)
  const overallStats = useMemo(() => {
    let totalTrackables = 0;
    let completed = 0;
    let inProgress = 0;
    let needsRevision = 0;

    for (const unit of allRoadmapUnits) {
      if (unit.chapters.length > 0) {
        for (let idx = 0; idx < unit.chapters.length; idx += 1) {
          totalTrackables += 1;
          const st = getItemStatus(`${unit.unitKey}::ch_${idx}`);
          if (st === 'completed') completed += 1;
          else if (st === 'in_progress') inProgress += 1;
          else if (st === 'needs_revision') needsRevision += 1;
        }
      } else {
        totalTrackables += 1;
        const st = getItemStatus(unit.unitKey);
        if (st === 'completed') completed += 1;
        else if (st === 'in_progress') inProgress += 1;
        else if (st === 'needs_revision') needsRevision += 1;
      }
    }

    const percent = totalTrackables > 0 ? Math.round((completed / totalTrackables) * 100) : 0;
    return { totalTrackables, completed, inProgress, needsRevision, percent };
  }, [allRoadmapUnits, roadmapData]);

  // Filter units cleanly
  const filteredUnitsByTerm = useMemo(() => {
    return examTerms
      .filter((t) => selectedTermFilter === 'all' || t.id === selectedTermFilter)
      .map((term) => {
        const termUnitsAll = allRoadmapUnits.filter((u) => u.termId === term.id);

        // Compute term completion stats across all units in term
        let termTotal = 0;
        let termDone = 0;
        for (const u of termUnitsAll) {
          if (u.chapters.length > 0) {
            u.chapters.forEach((_, idx) => {
              termTotal += 1;
              if (getItemStatus(`${u.unitKey}::ch_${idx}`) === 'completed') termDone += 1;
            });
          } else {
            termTotal += 1;
            if (getItemStatus(u.unitKey) === 'completed') termDone += 1;
          }
        }
        const termPct = termTotal > 0 ? Math.round((termDone / termTotal) * 100) : 0;

        const visibleUnits = termUnitsAll.filter((unit) => {
          if (selectedSubjectFilter !== 'all' && unit.subjectId !== selectedSubjectFilter) {
            return false;
          }
          if (selectedStatusFilter === 'all') return true;
          const unitSt = getItemStatus(unit.unitKey);
          if (unitSt === selectedStatusFilter) return true;
          if (unit.chapters.length > 0) {
            return unit.chapters.some(
              (_, idx) => getItemStatus(`${unit.unitKey}::ch_${idx}`) === selectedStatusFilter
            );
          }
          return false;
        });

        return {
          term,
          termTotal,
          termDone,
          termPct,
          units: visibleUnits,
        };
      });
  }, [examTerms, allRoadmapUnits, selectedTermFilter, selectedSubjectFilter, selectedStatusFilter, roadmapData]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-indigo-900 text-amber-300 rounded-2xl shrink-0 shadow-xs">
              <MapIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700">
                <Compass className="w-3.5 h-3.5" />
                <span>বার্ষিক সিলেবাস ও পাঠ্যক্রম ট্র্যাকার</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 font-serif mt-0.5">
                একাডেমিক মাইলফলক রোডম্যাপ ({classNameBn})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                প্রতিটি বিষয়ের অধ্যায় ও সিলেবাসকে <strong>চলমান</strong>, <strong>সম্পন্ন</strong> অথবা <strong>রিভিশন প্রয়োজন</strong> হিসেবে চিহ্নিত করে সারা বছরের প্রস্তুতি নজরে রাখো।
              </p>
            </div>
          </div>

          {onOpenTimeManagement && (
            <button
              type="button"
              onClick={onOpenTimeManagement}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap self-start lg:self-auto"
            >
              <Clock className="w-4 h-4 text-amber-300" />
              <span>পড়ার রুটিনে সময় বসাও</span>
            </button>
          )}
        </div>

        {/* Save toast */}
        {saveNotice && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveNotice}</span>
          </div>
        )}

        {/* Yearly KPI Progress Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 tabular-nums">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1.5">
            <div className="text-xs font-medium text-slate-500">সর্বমোট পাঠ্য-অগ্রগতি</div>
            <div className="text-2xl font-extrabold text-slate-900 font-mono">
              {toBengaliNumber(overallStats.percent)}%
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                style={{ width: `${overallStats.percent}%` }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>সম্পন্ন (Completed)</span>
            </div>
            <div className="text-2xl font-extrabold text-emerald-900 font-mono mt-1">
              {toBengaliNumber(overallStats.completed)}টি
            </div>
            <div className="text-[11px] text-emerald-700">
              মোট {toBengaliNumber(overallStats.totalTrackables)}টি অধ্যায়/ইউনিটের মধ্যে
            </div>
          </div>

          <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-800">
              <Clock className="w-4 h-4 text-sky-600" />
              <span>চলমান (In Progress)</span>
            </div>
            <div className="text-2xl font-extrabold text-sky-900 font-mono mt-1">
              {toBengaliNumber(overallStats.inProgress)}টি
            </div>
            <div className="text-[11px] text-sky-700">বর্তমানে অধ্যয়ন ও অনুশীলন চলছে</div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
              <RotateCcw className="w-4 h-4 text-amber-600" />
              <span>রিভিশন প্রয়োজন</span>
            </div>
            <div className="text-2xl font-extrabold text-amber-950 font-mono mt-1">
              {toBengaliNumber(overallStats.needsRevision)}টি
            </div>
            <div className="text-[11px] text-amber-800">পরীক্ষার আগে আরেকবার ঝালিয়ে নিতে হবে</div>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600">
              <Filter className="w-3.5 h-3.5" />
              অবস্থা:
            </span>
            {[
              { id: 'all' as const, label: 'সকল' },
              { id: 'in_progress' as const, label: 'চলমান (In Progress)' },
              { id: 'completed' as const, label: 'সম্পন্ন (Completed)' },
              { id: 'needs_revision' as const, label: 'রিভিশন প্রয়োজন' },
              { id: 'not_started' as const, label: 'শুরু হয়নি' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedStatusFilter(item.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                  selectedStatusFilter === item.id
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedTermFilter}
              onChange={(e) => setSelectedTermFilter(e.target.value)}
              className="text-xs font-semibold border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-800"
              aria-label="পরীক্ষা অনুযায়ী ফিল্টার"
            >
              <option value="all">সকল পরীক্ষা (পুরো বছর)</option>
              {examTerms.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.nameBn}
                </option>
              ))}
            </select>

            <select
              value={selectedSubjectFilter}
              onChange={(e) => setSelectedSubjectFilter(e.target.value)}
              className="text-xs font-semibold border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-800"
              aria-label="বিষয় অনুযায়ী ফিল্টার"
            >
              <option value="all">সকল বিষয় ({toBengaliNumber(subjects.length)})</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.nameBn}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Visual Connected Term-by-Term Roadmap Timeline */}
      <div className="relative space-y-6">
        {filteredUnitsByTerm.map(({ term, termDone, termTotal, termPct, units }, termIdx) => (
          <section
            key={term.id}
            className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4"
          >
            {/* Term Node Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#091e42] text-amber-300 font-bold text-sm flex items-center justify-center shrink-0 tabular-nums font-mono">
                  {toBengaliNumber(termIdx + 1)}
                </div>
                <div>
                  <h4 className="text-base sm:text-lg font-bold text-slate-900 font-serif">
                    {term.nameBn} — শিক্ষণ মাইলফলক
                  </h4>
                  <p className="text-xs text-slate-500 tabular-nums">
                    {toBengaliNumber(termDone)} / {toBengaliNumber(termTotal)}টি ইউনিট ও অধ্যায় সম্পন্ন ({toBengaliNumber(termPct)}%)
                  </p>
                </div>
              </div>

              <div className="w-full sm:w-48 space-y-1">
                <div className="flex justify-between text-[11px] font-bold text-slate-700 tabular-nums">
                  <span>পর্বের অগ্রগতি</span>
                  <span className="text-indigo-700">{toBengaliNumber(termPct)}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                  <div
                    className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                    style={{ width: `${termPct}%` }}
                  />
                </div>
              </div>
            </div>

            {units.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                নির্বাচিত ফিল্টার অনুযায়ী এই পর্বে কোনো সিলেবাস আইটেম পাওয়া যায়নি।
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {units.map((unit) => {
                  // Derive unit overall status or chapter completion
                  const explicitStatus = getItemStatus(unit.unitKey);
                  const chapterStatuses = unit.chapters.map((_, idx) =>
                    getItemStatus(`${unit.unitKey}::ch_${idx}`)
                  );
                  const completedChCount = chapterStatuses.filter((st) => st === 'completed').length;

                  const derivedStatus: AcademicMilestoneStatus =
                    unit.chapters.length > 0 && explicitStatus === 'not_started'
                      ? completedChCount === unit.chapters.length
                        ? 'completed'
                        : chapterStatuses.some((st) => st === 'needs_revision')
                        ? 'needs_revision'
                        : chapterStatuses.some((st) => st === 'in_progress' || st === 'completed')
                        ? 'in_progress'
                        : 'not_started'
                      : explicitStatus;

                  const meta = STATUS_META[derivedStatus];
                  const StatusIcon = meta.Icon;
                  const existingNote = getItemNote(unit.unitKey);

                  return (
                    <article
                      key={unit.unitKey}
                      className={`rounded-xl border p-4 flex flex-col justify-between gap-3.5 transition ${meta.cardClass}`}
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                              <span className="font-bold text-indigo-800">{unit.subjectName}</span>
                              <span aria-hidden="true">·</span>
                              <span>
                                {unit.isOfficialSyllabus ? 'অফিসিয়াল সিলেবাস' : 'পাঠ্যবই ইউনিট'}
                              </span>
                            </div>
                            <h5 className="text-sm sm:text-base font-bold text-slate-900 font-serif mt-0.5">
                              {unit.title}
                            </h5>
                          </div>

                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-bold shrink-0 ${meta.textClass}`}
                          >
                            <StatusIcon className="w-3.5 h-3.5 shrink-0" />
                            <span>{meta.shortBn}</span>
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed">{unit.description}</p>

                        {(unit.referenceBooks || unit.marksDistribution) && (
                          <div className="text-[11px] text-slate-500 space-y-0.5 bg-white/75 rounded-lg p-2.5 border border-slate-200/70">
                            {unit.referenceBooks && (
                              <div>
                                <strong className="text-slate-700">সহায়ক বই: </strong>
                                {unit.referenceBooks}
                              </div>
                            )}
                            {unit.marksDistribution && (
                              <div>
                                <strong className="text-slate-700">মানবণ্টন: </strong>
                                {unit.marksDistribution}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Chapter-by-Chapter Trackers if syllabus contains chapters */}
                        {unit.chapters.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 tabular-nums">
                              <span className="inline-flex items-center gap-1">
                                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                                অধ্যায়ভিত্তিক অগ্রগতি:
                              </span>
                              <span>
                                {toBengaliNumber(completedChCount)} / {toBengaliNumber(unit.chapters.length)} সম্পন্ন
                              </span>
                            </div>
                            <ul className="space-y-1.5">
                              {unit.chapters.map((chap, idx) => {
                                const chKey = `${unit.unitKey}::ch_${idx}`;
                                const chStatus = getItemStatus(chKey);
                                const chMeta = STATUS_META[chStatus];
                                const ChIcon = chMeta.Icon;

                                return (
                                  <li
                                    key={chKey}
                                    className="bg-white rounded-lg border border-slate-200/90 px-2.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs"
                                  >
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <ChIcon className={`w-4 h-4 shrink-0 ${chMeta.textClass}`} />
                                      <span
                                        className={`font-medium truncate ${
                                          chStatus === 'completed'
                                            ? 'text-slate-500 line-through'
                                            : 'text-slate-900'
                                        }`}
                                      >
                                        {chap}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                                      {EDITABLE_STATUSES.map((st) => {
                                        const stMeta = STATUS_META[st];
                                        const active = chStatus === st;
                                        return (
                                          <button
                                            key={st}
                                            type="button"
                                            onClick={() => updateMilestoneStatus(chKey, st)}
                                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition cursor-pointer ${
                                              active
                                                ? stMeta.btnActiveClass
                                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                            }`}
                                          >
                                            {stMeta.shortBn}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* Footer: Unit Status Action Bar + Personal Revision Note */}
                      <div className="pt-3 border-t border-slate-200/80 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-slate-600">
                            {unit.chapters.length > 0 ? 'সিলেবাসের সার্বিক অবস্থা:' : 'অবস্থা নির্বাচন করো:'}
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {EDITABLE_STATUSES.map((st) => {
                              const stMeta = STATUS_META[st];
                              const active = explicitStatus === st;
                              return (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={() => updateMilestoneStatus(unit.unitKey, st)}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                                    active
                                      ? stMeta.btnActiveClass
                                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                  }`}
                                >
                                  {stMeta.shortBn}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {editingNoteKey === unit.unitKey ? (
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              value={noteDraft}
                              onChange={(e) => setNoteDraft(e.target.value)}
                              placeholder="যেমন: অনুশীলনী ৩.২ আবার অনুশীলন করতে হবে..."
                              className="flex-1 text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveNote(unit.unitKey)}
                              className="px-3 py-1.5 bg-indigo-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                            >
                              সেভ
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingNoteKey(null)}
                              className="px-2.5 py-1.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg cursor-pointer"
                            >
                              বাতিল
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-600">
                            {existingNote ? (
                              <span className="truncate">
                                <strong className="text-slate-800">নোট: </strong>
                                {existingNote}
                              </span>
                            ) : (
                              <span className="text-slate-400">কোনো রিভিশন নোট নেই</span>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingNoteKey(unit.unitKey);
                                setNoteDraft(existingNote);
                              }}
                              className="inline-flex items-center gap-1 font-semibold text-indigo-700 hover:text-indigo-900 shrink-0 cursor-pointer"
                            >
                              <FileText className="w-3 h-3" />
                              <span>{existingNote ? 'নোট এডিট' : '+ নোট লেখো'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
};
