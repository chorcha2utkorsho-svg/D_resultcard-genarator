import React, { useState, useEffect } from 'react';
import {
  Save,
  CheckCircle2,
  Users,
  BookOpen,
  Calendar,
  Layers,
  Sparkles,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { calculateGrade, toBengaliNumber, toBengaliRoll } from '../utils/bengali';

interface MarkEntryViewProps {
  onNavigate?: (tab: string) => void;
}

export const MarkEntryView: React.FC<MarkEntryViewProps> = ({ onNavigate }) => {
  const {
    classes,
    examTerms,
    students,
    examRecords,
    saveMarkRecord,
    bulkSaveSubjectMarks,
    selectedYear,
    setSelectedYear,
    selectedExamId,
    setSelectedExamId,
    selectedClassId,
    setSelectedClassId,
    selectedSection,
    setSelectedSection,
  } = useSchool();

  // Active Subject selection
  const currentClass = classes.find((c) => c.id === selectedClassId) || classes[0];
  const subjects = currentClass?.defaultSubjects || [];
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(subjects[0]?.id || '');

  // Keep subject in sync when class changes
  useEffect(() => {
    if (subjects.length > 0 && !subjects.find((s) => s.id === selectedSubjectId)) {
      setSelectedSubjectId(subjects[0].id);
    }
  }, [selectedClassId, subjects, selectedSubjectId]);

  const activeSubject = subjects.find((s) => s.id === selectedSubjectId) || subjects[0];
  const fullMarks = activeSubject?.fullMarks || 100;

  // Filter students for selected class and section
  const filteredStudents = students
    .filter((s) => s.classId === selectedClassId && (!selectedSection || s.section === selectedSection))
    .sort((a, b) => a.roll - b.roll);

  // Local state for fast input editing
  const [localMarks, setLocalMarks] = useState<
    Record<
      string,
      {
        examMarks: string;
        monthly20: string;
        workingDays: string;
        attendance: string;
        remarks: string;
      }
    >
  >({});

  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [entryMode, setEntryMode] = useState<'subject_wise' | 'student_wise'>('subject_wise');
  const [activeStudentId, setActiveStudentId] = useState<string>(filteredStudents[0]?.id || '');

  // Initialize local marks from context exam records
  useEffect(() => {
    const newLocalMarks: Record<
      string,
      { examMarks: string; monthly20: string; workingDays: string; attendance: string; remarks: string }
    > = {};

    filteredStudents.forEach((student) => {
      const recordId = `${student.id}_${selectedExamId}_${selectedYear}`;
      const record = examRecords[recordId];
      const subjectMark = record?.marks[selectedSubjectId];

      newLocalMarks[student.id] = {
        examMarks: subjectMark?.examMarks !== null && subjectMark?.examMarks !== undefined ? String(subjectMark.examMarks) : '',
        monthly20: subjectMark?.monthlyMarks20 !== null && subjectMark?.monthlyMarks20 !== undefined ? String(subjectMark.monthlyMarks20) : '',
        workingDays: record?.workingDays ? String(record.workingDays) : '120',
        attendance: record?.attendance ? String(record.attendance) : '110',
        remarks: record?.teacherRemarks || '',
      };
    });

    setLocalMarks(newLocalMarks);
  }, [selectedExamId, selectedYear, selectedClassId, selectedSection, selectedSubjectId, examRecords]);

  // Handle single input change with instant auto-save to context
  const handleExamMarkChange = (studentId: string, value: string) => {
    setLocalMarks((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        examMarks: value,
      },
    }));

    const numValue = value === '' ? null : Math.min(fullMarks, Math.max(0, parseFloat(value) || 0));
    const monthlyNum = localMarks[studentId]?.monthly20 === '' ? null : parseFloat(localMarks[studentId]?.monthly20) || 0;

    saveMarkRecord(
      studentId,
      selectedExamId,
      selectedYear,
      selectedClassId,
      selectedSection,
      selectedSubjectId,
      { examMarks: numValue, monthlyMarks20: monthlyNum }
    );

    triggerSavedFeedback();
  };

  const handleMonthlyMarkChange = (studentId: string, value: string) => {
    setLocalMarks((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        monthly20: value,
      },
    }));

    const examNum = localMarks[studentId]?.examMarks === '' ? null : parseFloat(localMarks[studentId]?.examMarks) || 0;
    const monthlyNum = value === '' ? null : Math.min(20, Math.max(0, parseFloat(value) || 0));

    saveMarkRecord(
      studentId,
      selectedExamId,
      selectedYear,
      selectedClassId,
      selectedSection,
      selectedSubjectId,
      { examMarks: examNum, monthlyMarks20: monthlyNum }
    );

    triggerSavedFeedback();
  };

  const handleRemarksChange = (studentId: string, text: string) => {
    setLocalMarks((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        remarks: text,
      },
    }));

    saveMarkRecord(
      studentId,
      selectedExamId,
      selectedYear,
      selectedClassId,
      selectedSection,
      selectedSubjectId,
      {},
      { teacherRemarks: text }
    );
  };

  const triggerSavedFeedback = () => {
    setSaveStatus('সংরক্ষিত');
    setTimeout(() => {
      setSaveStatus(null);
    }, 2000);
  };

  // Quick fill monthly assessment
  const handleBulkFillMonthly = (val: number) => {
    const updates = filteredStudents.map((std) => ({
      studentId: std.id,
      examMarks: localMarks[std.id]?.examMarks !== '' ? parseFloat(localMarks[std.id]?.examMarks) : null,
      monthlyMarks20: val,
    }));

    bulkSaveSubjectMarks(selectedExamId, selectedYear, selectedClassId, selectedSection, selectedSubjectId, updates);
    triggerSavedFeedback();
  };

  return (
    <div className="space-y-6">
      {/* Top Filter Selection Panel */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 mb-4">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-700">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 font-serif">
                মার্ক এন্ট্রি ফরম (বিষয় ও শ্রেণিভিত্তিক)
              </h2>
              <p className="text-xs text-slate-500">
                খাতা দেখার পর সরাসরি প্রাপ্ত নম্বর এন্ট্রি করুন। ৮০% ও ২০% অটোমেটিক হিসাব হয়ে যাবে।
              </p>
            </div>
          </div>

          {/* Save status badge */}
          <div className="flex items-center space-x-2">
            {saveStatus ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                {saveStatus}
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                <Save className="w-3.5 h-3.5 mr-1" /> রিয়েল-টাইম অটো সেভ
              </span>
            )}

            {/* Mode switch */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              <button
                onClick={() => setEntryMode('subject_wise')}
                className={`px-3 py-1.5 rounded-md font-medium transition ${
                  entryMode === 'subject_wise' ? 'bg-white shadow text-indigo-700 font-bold' : 'text-slate-600'
                }`}
              >
                বিষয়ভিত্তিক এন্ট্রি
              </button>
              <button
                onClick={() => setEntryMode('student_wise')}
                className={`px-3 py-1.5 rounded-md font-medium transition ${
                  entryMode === 'student_wise' ? 'bg-white shadow text-indigo-700 font-bold' : 'text-slate-600'
                }`}
              >
                শিক্ষার্থীভিত্তিক এন্ট্রি
              </button>
            </div>
          </div>
        </div>

        {/* Filter Dropdowns Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Exam */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              <Calendar className="w-3.5 h-3.5 inline mr-1 text-slate-500" />
              পরীক্ষার নাম
            </label>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="w-full text-sm font-medium border border-slate-300 rounded-lg px-2.5 py-2 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              {examTerms.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.nameBn}
                </option>
              ))}
            </select>
          </div>

          {/* Academic Year */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">শিক্ষাবর্ষ</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full text-sm font-medium border border-slate-300 rounded-lg px-2.5 py-2 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="২০২৬">২০২৬ ইং</option>
              <option value="২০২৫">২০২৫ ইং</option>
              <option value="২০২৭">২০২৭ ইং</option>
            </select>
          </div>

          {/* Class */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              <Layers className="w-3.5 h-3.5 inline mr-1 text-slate-500" />
              শ্রেণি
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full text-sm font-semibold border border-indigo-300 rounded-lg px-2.5 py-2 bg-indigo-50/50 text-indigo-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.nameBn}
                </option>
              ))}
            </select>
          </div>

          {/* Section */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">শাখা</label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full text-sm font-medium border border-slate-300 rounded-lg px-2.5 py-2 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="">সকল শাখা</option>
              <option value="ক">ক শাখা</option>
              <option value="খ">খ শাখা</option>
              <option value="সাধারণ">সাধারণ</option>
            </select>
          </div>

          {/* Subject (if subject-wise mode) */}
          {entryMode === 'subject_wise' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  <BookOpen className="w-3.5 h-3.5 inline mr-1 text-indigo-600" />
                  বিষয় নির্বাচন
                </label>
                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => onNavigate('subjects')}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer"
                    title="বিষয় যোগ বা পরিমার্জন করুন"
                  >
                    + বিষয় ব্যবস্থাপনা
                  </button>
                )}
              </div>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="w-full text-sm font-bold border border-amber-400 rounded-lg px-2.5 py-2 bg-amber-50 text-amber-950 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              >
                {subjects.length === 0 ? (
                  <option value="">কোনো বিষয় নেই</option>
                ) : (
                  subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.nameBn} (পূর্ণমান {toBengaliNumber(sub.fullMarks)}{sub.hasMonthlyExam === false ? ' • ১০০% পরীক্ষা' : ''})
                    </option>
                  ))
                )}
              </select>
            </div>
          )}

          {/* Student (if student-wise mode) */}
          {entryMode === 'student_wise' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                <Users className="w-3.5 h-3.5 inline mr-1 text-indigo-600" />
                শিক্ষার্থী নির্বাচন
              </label>
              <select
                value={activeStudentId}
                onChange={(e) => setActiveStudentId(e.target.value)}
                className="w-full text-sm font-bold border border-indigo-300 rounded-lg px-2.5 py-2 bg-white text-indigo-950 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                {filteredStudents.map((std) => (
                  <option key={std.id} value={std.id}>
                    রোল {toBengaliRoll(std.roll)} - {std.nameBn}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* SUBJECT-WISE ENTRY TABLE (All Students of this Class for Selected Subject) */}
      {entryMode === 'subject_wise' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Header Bar with quick tools */}
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-800 text-sm sm:text-base">
                {currentClass.nameBn} &gt; {activeSubject?.nameBn}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">
                পূর্ণমান: {toBengaliNumber(fullMarks)}
              </span>
              <span className="text-xs text-slate-500">
                (শিক্ষার্থী সংখ্যা: {toBengaliNumber(filteredStudents.length)})
              </span>
            </div>

            {/* Quick bulk fill helper */}
            <div className="flex items-center space-x-2 text-xs">
              <span className="text-slate-600 font-medium hidden sm:inline">
                মাসিক ২০% কুইক ফিল:
              </span>
              <button
                onClick={() => handleBulkFillMonthly(18)}
                className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded text-slate-700 font-semibold"
              >
                ১৮
              </button>
              <button
                onClick={() => handleBulkFillMonthly(17)}
                className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded text-slate-700 font-semibold"
              >
                ১৭
              </button>
              <button
                onClick={() => handleBulkFillMonthly(16)}
                className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded text-slate-700 font-semibold"
              >
                ১৬
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100/80 text-slate-700 text-xs font-bold border-b border-slate-200 uppercase tracking-wider">
                  <th className="py-3 px-3 text-center w-16">রোল</th>
                  <th className="py-3 px-3">শিক্ষার্থীর নাম</th>
                  <th className="py-3 px-2 text-center w-32 bg-amber-50/60">
                    প্রাপ্ত নম্বর
                    <div className="text-[10px] text-amber-800 font-normal">
                      (পূর্ণমান {toBengaliNumber(fullMarks)})
                    </div>
                  </th>
                  <th className="py-3 px-2 text-center w-28 bg-slate-50">
                    {activeSubject?.hasMonthlyExam === false ? 'প্রাপ্ত মূল নম্বর' : '৮০% হিসাব'}
                    <div className="text-[10px] text-slate-500 font-normal">
                      {activeSubject?.hasMonthlyExam === false ? '(১০০% চূড়ান্ত)' : '(অটোমেটিক)'}
                    </div>
                  </th>
                  <th className="py-3 px-2 text-center w-28 bg-blue-50/60">
                    মাসিক ২০%
                    <div className="text-[10px] text-blue-800 font-normal">
                      {activeSubject?.hasMonthlyExam === false ? '(প্রযোজ্য নয়)' : '(ধারাবাহিক)'}
                    </div>
                  </th>
                  <th className="py-3 px-2 text-center w-28 bg-emerald-50/60 font-bold">
                    মোট প্রাপ্ত নম্বর
                  </th>
                  <th className="py-3 px-2 text-center w-24">গ্রেড / পয়েন্ট</th>
                  <th className="py-3 px-3 w-52">শিক্ষকের মন্তব্য / নোট</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500 font-medium">
                      এই শ্রেণি ও শাখায় কোন শিক্ষার্থী পাওয়া যায়নি। &quot;শিক্ষার্থী তথ্য&quot; ট্যাব থেকে শিক্ষার্থী যুক্ত করুন।
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((std, index) => {
                    const examVal = localMarks[std.id]?.examMarks || '';
                    const monthlyVal = localMarks[std.id]?.monthly20 || '';
                    const remarksVal = localMarks[std.id]?.remarks || '';

                    const numExam = examVal !== '' ? parseFloat(examVal) : null;
                    const numMonthly = monthlyVal !== '' ? parseFloat(monthlyVal) : null;

                    let calc80: number | null = null;
                    let totalObtained: number | null = null;

                    if (numExam !== null) {
                      if (activeSubject?.hasMonthlyExam === false) {
                        calc80 = numExam;
                        totalObtained = Math.round(numExam);
                      } else {
                        calc80 = parseFloat(((numExam * 80) / 100).toFixed(1));
                        totalObtained = Math.round(calc80 + (numMonthly || 0));
                      }
                    }

                    const grade = calculateGrade(totalObtained, fullMarks);

                    return (
                      <tr
                        key={std.id}
                        className={`hover:bg-indigo-50/30 transition ${
                          index % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                        }`}
                      >
                        {/* Roll */}
                        <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                          {toBengaliRoll(std.roll)}
                        </td>

                        {/* Name */}
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900">{std.nameBn}</div>
                          {std.section && (
                            <span className="text-[11px] text-slate-500">শাখা: {std.section}</span>
                          )}
                        </td>

                        {/* Exam Marks Input */}
                        <td className="py-2.5 px-2 text-center bg-amber-50/40">
                          <input
                            type="number"
                            min="0"
                            max={fullMarks}
                            step="any"
                            placeholder="০-১০০"
                            value={examVal}
                            onChange={(e) => handleExamMarkChange(std.id, e.target.value)}
                            className="w-24 text-center font-bold text-base border-2 border-amber-300 rounded-lg py-1 px-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none bg-white text-slate-950"
                          />
                        </td>

                        {/* 80% auto mark */}
                        <td className="py-2.5 px-2 text-center font-bold text-slate-700 bg-slate-50">
                          {calc80 !== null ? toBengaliNumber(calc80) : '-'}
                        </td>

                        {/* Monthly 20% mark Input */}
                        <td className="py-2.5 px-2 text-center bg-blue-50/40">
                          {activeSubject?.hasMonthlyExam === false ? (
                            <span className="text-[11px] text-slate-400 font-medium italic">
                              প্রযোজ্য নয়
                            </span>
                          ) : (
                            <input
                              type="number"
                              min="0"
                              max="20"
                              step="any"
                              placeholder="০-২০"
                              value={monthlyVal}
                              onChange={(e) => handleMonthlyMarkChange(std.id, e.target.value)}
                              className="w-20 text-center font-semibold text-sm border border-blue-300 rounded-lg py-1 px-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-blue-950"
                            />
                          )}
                        </td>

                        {/* Total Obtained */}
                        <td className="py-2.5 px-2 text-center font-bold text-base text-emerald-800 bg-emerald-50/40">
                          {totalObtained !== null ? toBengaliNumber(totalObtained) : '-'}
                        </td>

                        {/* Grade & Point */}
                        <td className="py-2.5 px-2 text-center">
                          {totalObtained !== null ? (
                            <div className="inline-flex flex-col items-center">
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-bold ${
                                  grade.letterGrade === 'F'
                                    ? 'bg-rose-100 text-rose-800'
                                    : grade.letterGrade === 'A+'
                                    ? 'bg-emerald-100 text-emerald-800 font-extrabold'
                                    : 'bg-indigo-100 text-indigo-800'
                                }`}
                              >
                                {grade.letterGrade}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                {grade.gradePoint.toFixed(2)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* Remarks */}
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            placeholder="মন্তব্য লিখুন..."
                            value={remarksVal}
                            onChange={(e) => handleRemarksChange(std.id, e.target.value)}
                            className="w-full text-xs border border-slate-300 rounded-md py-1 px-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* STUDENT-WISE ENTRY (All Subjects for One Student) */}
      {entryMode === 'student_wise' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <span className="text-xs text-indigo-600 font-bold uppercase tracking-wider">
                একক শিক্ষার্থী এন্ট্রি মোড
              </span>
              <h3 className="text-xl font-bold text-slate-900 font-serif">
                {filteredStudents.find((s) => s.id === activeStudentId)?.nameBn || 'শিক্ষার্থী'} (রোল:{' '}
                {toBengaliRoll(filteredStudents.find((s) => s.id === activeStudentId)?.roll || 1)})
              </h3>
            </div>

            {/* Quick Next/Prev student navigation */}
            <div className="flex items-center space-x-2">
              <button
                disabled={filteredStudents.findIndex((s) => s.id === activeStudentId) <= 0}
                onClick={() => {
                  const idx = filteredStudents.findIndex((s) => s.id === activeStudentId);
                  if (idx > 0) setActiveStudentId(filteredStudents[idx - 1].id);
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                পূর্ববর্তী
              </button>
              <button
                disabled={filteredStudents.findIndex((s) => s.id === activeStudentId) >= filteredStudents.length - 1}
                onClick={() => {
                  const idx = filteredStudents.findIndex((s) => s.id === activeStudentId);
                  if (idx < filteredStudents.length - 1) setActiveStudentId(filteredStudents[idx + 1].id);
                }}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-40 flex items-center"
              >
                পরবর্তী শিক্ষার্থী <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </button>
            </div>
          </div>

          {/* Subjects Table for this student */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 text-xs font-bold border-b border-slate-200">
                  <th className="py-2.5 px-3">বিষয়</th>
                  <th className="py-2.5 px-2 text-center w-24">মোট নম্বর</th>
                  <th className="py-2.5 px-2 text-center w-32 bg-amber-50">প্রাপ্ত নম্বর</th>
                  <th className="py-2.5 px-2 text-center w-28">৮০% নম্বর</th>
                  <th className="py-2.5 px-2 text-center w-28 bg-blue-50">মাসিক ২০%</th>
                  <th className="py-2.5 px-2 text-center w-28 bg-emerald-50">মোট প্রাপ্ত</th>
                  <th className="py-2.5 px-2 text-center w-24">গ্রেড / পয়েন্ট</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {subjects.map((sub) => {
                  const recordId = `${activeStudentId}_${selectedExamId}_${selectedYear}`;
                  const rec = examRecords[recordId];
                  const subMark = rec?.marks[sub.id];

                  const examMarks = subMark?.examMarks !== null && subMark?.examMarks !== undefined ? subMark.examMarks : '';
                  const monthly20 = subMark?.monthlyMarks20 !== null && subMark?.monthlyMarks20 !== undefined ? subMark.monthlyMarks20 : '';
                  const calc80 = subMark?.calcMarks80 !== null && subMark?.calcMarks80 !== undefined ? subMark.calcMarks80 : null;
                  const totalMarks = subMark?.totalMarks !== null && subMark?.totalMarks !== undefined ? subMark.totalMarks : null;
                  const grade = calculateGrade(totalMarks, sub.fullMarks);

                  return (
                    <tr key={sub.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-semibold text-slate-800">{sub.nameBn}</td>
                      <td className="py-2 px-2 text-center font-bold text-slate-600">
                        {toBengaliNumber(sub.fullMarks)}
                      </td>
                      <td className="py-2 px-2 text-center bg-amber-50/50">
                        <input
                          type="number"
                          min="0"
                          max={sub.fullMarks}
                          placeholder="০"
                          value={examMarks}
                          onChange={(e) => {
                            const val = e.target.value === '' ? null : parseFloat(e.target.value);
                            saveMarkRecord(
                              activeStudentId,
                              selectedExamId,
                              selectedYear,
                              selectedClassId,
                              selectedSection,
                              sub.id,
                              { examMarks: val }
                            );
                          }}
                          className="w-20 text-center font-bold text-sm border-2 border-amber-300 rounded py-1 px-1 bg-white"
                        />
                      </td>
                      <td className="py-2 px-2 text-center font-bold text-slate-700">
                        {calc80 !== null ? toBengaliNumber(calc80) : '-'}
                      </td>
                      <td className="py-2 px-2 text-center bg-blue-50/50">
                        {sub.hasMonthlyExam === false ? (
                          <span className="text-[11px] text-slate-400 font-medium italic">
                            প্রযোজ্য নয়
                          </span>
                        ) : (
                          <input
                            type="number"
                            min="0"
                            max="20"
                            placeholder="০"
                            value={monthly20}
                            onChange={(e) => {
                              const val = e.target.value === '' ? null : parseFloat(e.target.value);
                              saveMarkRecord(
                                activeStudentId,
                                selectedExamId,
                                selectedYear,
                                selectedClassId,
                                selectedSection,
                                sub.id,
                                { monthlyMarks20: val }
                              );
                            }}
                            className="w-16 text-center font-semibold text-sm border border-blue-300 rounded py-1 px-1 bg-white"
                          />
                        )}
                      </td>
                      <td className="py-2 px-2 text-center font-bold text-emerald-800 bg-emerald-50/40">
                        {totalMarks !== null ? toBengaliNumber(totalMarks) : '-'}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {totalMarks !== null ? (
                          <span className="font-bold text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                            {grade.letterGrade} ({grade.gradePoint.toFixed(1)})
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Student's Attendance and Remarks Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">মোট কার্য দিবস</label>
              <input
                type="number"
                value={examRecords[`${activeStudentId}_${selectedExamId}_${selectedYear}`]?.workingDays || 120}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10) || 120;
                  saveMarkRecord(
                    activeStudentId,
                    selectedExamId,
                    selectedYear,
                    selectedClassId,
                    selectedSection,
                    subjects[0]?.id || '',
                    {},
                    { workingDays: val }
                  );
                }}
                className="w-full text-sm border border-slate-300 rounded-lg p-2"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">উপস্থিতির দিন</label>
              <input
                type="number"
                value={examRecords[`${activeStudentId}_${selectedExamId}_${selectedYear}`]?.attendance || 110}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10) || 0;
                  saveMarkRecord(
                    activeStudentId,
                    selectedExamId,
                    selectedYear,
                    selectedClassId,
                    selectedSection,
                    subjects[0]?.id || '',
                    {},
                    { attendance: val }
                  );
                }}
                className="w-full text-sm border border-slate-300 rounded-lg p-2"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">শিক্ষকের মন্তব্য</label>
              <input
                type="text"
                placeholder="লেখাপড়ায় মনোযোগী..."
                value={examRecords[`${activeStudentId}_${selectedExamId}_${selectedYear}`]?.teacherRemarks || ''}
                onChange={(e) => {
                  saveMarkRecord(
                    activeStudentId,
                    selectedExamId,
                    selectedYear,
                    selectedClassId,
                    selectedSection,
                    subjects[0]?.id || '',
                    {},
                    { teacherRemarks: e.target.value }
                  );
                }}
                className="w-full text-sm border border-slate-300 rounded-lg p-2"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
