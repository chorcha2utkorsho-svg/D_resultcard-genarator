import React, { useState, useMemo } from 'react';
import {
  Printer,
  User,
  Users,
  ChevronLeft,
  ChevronRight,
  Trophy,
  Award,
  CheckCircle,
  Smartphone,
  Check,
  BarChart2,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Download,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { useSchool } from '../context/SchoolContext';
import { MarksheetCard } from './MarksheetCard';
import { ResultAnalyticsView } from './ResultAnalyticsView';
import { toBengaliNumber, toBengaliRoll } from '../utils/bengali';
import { generateResultSMS, isValidBDMobile } from '../utils/smsHelper';
import { exportElementToPDF, exportMultipleElementsToPDF } from '../utils/pdfExport';

export const ResultsView: React.FC = () => {
  const {
    schoolInfo,
    classes,
    examTerms,
    selectedYear,
    setSelectedYear,
    selectedExamId,
    setSelectedExamId,
    selectedClassId,
    setSelectedClassId,
    selectedSection,
    setSelectedSection,
    students,
    updateStudent,
    getCalculatedResultsForClass,
    sendSingleSMS,
    sendBatchSMS,
  } = useSchool();

  const handleStudentPhotoUpload = (studentId: string, base64: string) => {
    const student = students.find((s) => s.id === studentId);
    if (student) {
      updateStudent({
        ...student,
        avatarUrl: base64,
      });
    }
  };

  const [viewMode, setViewMode] = useState<'single' | 'batch' | 'analytics'>('single');
  const [selectedStudentIndex, setSelectedStudentIndex] = useState<number>(0);
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [smsFeedback, setSmsFeedback] = useState<string | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);
  const [pdfProgress, setPdfProgress] = useState<{ current: number; total: number; message: string } | null>(null);
  const [trendMetric, setTrendMetric] = useState<'combined' | 'gpa' | 'percentage'>('combined');

  const currentClass = classes.find((c) => c.id === selectedClassId) || classes[0];
  const currentExam = examTerms.find((e) => e.id === selectedExamId) || examTerms[0];

  // Calculate full results for the class
  const classResults = getCalculatedResultsForClass(
    selectedClassId,
    selectedSection,
    selectedExamId,
    selectedYear
  );

  const activeResult = classResults[selectedStudentIndex] || classResults[0];

  // Initialize batch selection when results change
  React.useEffect(() => {
    if (classResults.length > 0) {
      setSelectedBatchIds(classResults.map((r) => r.student.id));
    }
  }, [selectedClassId, selectedSection, selectedExamId, selectedYear, classResults.length]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadSinglePDF = async (targetResult = activeResult) => {
    if (!targetResult) return;
    setIsDownloadingPdf(true);
    setPdfProgress({
      current: 1,
      total: 1,
      message: `${targetResult.student.nameBn}-এর প্রোগ্রেস কার্ডের উচ্চমানের PDF প্রস্তুত হচ্ছে...`,
    });

    try {
      // Find element in active view or offscreen container
      let el = document.getElementById(`marksheet-card-${targetResult.student.id}`);
      if (!el) {
        el = document.getElementById(`marksheet-pdf-hidden-${targetResult.student.id}`);
      }
      if (!el) {
        throw new Error('কার্ড উপাদান পাওয়া যায়নি');
      }

      const cleanClassName = (currentClass?.nameBn || '').replace(/\s+/g, '_');
      const cleanExamName = (currentExam?.nameBn || '').replace(/\s+/g, '_');
      const cleanStudentName = targetResult.student.nameBn.replace(/\s+/g, '_');
      const fileName = `রেজাল্ট_কার্ড_${cleanClassName}_রোল_${targetResult.student.roll}_${cleanStudentName}_${cleanExamName}_${selectedYear}.pdf`;

      await exportElementToPDF(el, {
        fileName,
        quality: 2.5,
      });

      setSmsFeedback(`সফলভাবে "${targetResult.student.nameBn}"-এর রেজাল্ট কার্ড PDF ডাউনলোড হয়েছে!`);
      setTimeout(() => setSmsFeedback(null), 4000);
    } catch (err) {
      console.error('PDF export error:', err);
      setSmsFeedback('পিডিএফ ডাউনলোডে ত্রুটি দেখা দিয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
      setTimeout(() => setSmsFeedback(null), 4000);
    } finally {
      setIsDownloadingPdf(false);
      setPdfProgress(null);
    }
  };

  const handleDownloadBatchPDF = async () => {
    const selectedResults = classResults.filter((r) => selectedBatchIds.includes(r.student.id));
    if (selectedResults.length === 0) {
      setSmsFeedback('অনুগ্রহ করে অন্তত একজন শিক্ষার্থী নির্বাচন করুন!');
      setTimeout(() => setSmsFeedback(null), 3000);
      return;
    }

    setIsDownloadingPdf(true);
    setPdfProgress({
      current: 0,
      total: selectedResults.length,
      message: 'সকল শিক্ষার্থীর প্রোগ্রেস কার্ড এক ফাইলে একত্রিত করা হচ্ছে...',
    });

    try {
      const elements: HTMLElement[] = [];
      for (const res of selectedResults) {
        let el = document.getElementById(`marksheet-card-${res.student.id}`);
        if (!el) {
          el = document.getElementById(`marksheet-pdf-hidden-${res.student.id}`);
        }
        if (el) {
          elements.push(el);
        }
      }

      if (elements.length === 0) {
        throw new Error('কোনো কার্ড উপাদান পাওয়া যায়নি');
      }

      const cleanClassName = (currentClass?.nameBn || '').replace(/\s+/g, '_');
      const cleanExamName = (currentExam?.nameBn || '').replace(/\s+/g, '_');
      const fileName = `সকল_রেজাল্ট_কার্ড_${cleanClassName}_${cleanExamName}_${selectedYear}.pdf`;

      await exportMultipleElementsToPDF(elements, {
        fileName,
        quality: 2.0,
        onProgress: (current, total, message) => {
          setPdfProgress({ current, total, message });
        },
      });

      setSmsFeedback(
        `সফলভাবে ${toBengaliNumber(selectedResults.length)} জন শিক্ষার্থীর কার্ড সমন্বিত PDF ফাইলে ডাউনলোড হয়েছে!`
      );
      setTimeout(() => setSmsFeedback(null), 4000);
    } catch (err) {
      console.error('Batch PDF export error:', err);
      setSmsFeedback('সকলের পিডিএফ ডাউনলোডে ত্রুটি হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
      setTimeout(() => setSmsFeedback(null), 4000);
    } finally {
      setIsDownloadingPdf(false);
      setPdfProgress(null);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedBatchIds(classResults.map((r) => r.student.id));
    } else {
      setSelectedBatchIds([]);
    }
  };

  const toggleStudentSelection = (id: string) => {
    setSelectedBatchIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Stats calculation
  const totalStudents = classResults.length;
  const passedStudents = classResults.filter((r) => r.isPassed).length;
  const topStudent = classResults.find((r) => r.meritPosition === 1);
  const avgGpa =
    totalStudents > 0
      ? (classResults.reduce((sum, r) => sum + r.gpa, 0) / totalStudents).toFixed(2)
      : '0.00';

  // Multi-exam performance trend for the selected student across all exam terms
  const studentExamTrend = useMemo(() => {
    if (!activeResult) return [];
    return examTerms.map((term) => {
      const termResults = getCalculatedResultsForClass(
        selectedClassId,
        selectedSection,
        term.id,
        selectedYear
      );
      const found = termResults.find((r) => r.student.id === activeResult.student.id);
      const hasMarks = Boolean(
        found && found.subjectRows.some((sr) => sr.totalObtained !== null && sr.totalObtained !== undefined)
      );
      const percentage =
        hasMarks && found && found.totalFullMarks > 0
          ? Number(((found.grandTotalObtained / found.totalFullMarks) * 100).toFixed(1))
          : null;

      const shortName = term.nameBn.replace(/\s*পরীক্ষা.*$/, '').trim() || term.nameBn;

      return {
        termId: term.id,
        termName: term.nameBn,
        shortName,
        hasMarks,
        gpa: hasMarks && found ? Number(found.gpa.toFixed(2)) : null,
        percentage,
        obtainedMarks: hasMarks && found ? found.grandTotalObtained : null,
        fullMarks: found ? found.totalFullMarks : 0,
        overallGrade: hasMarks && found ? found.overallGrade : '—',
        meritPosition: hasMarks && found ? found.meritPosition : null,
        meritPositionBn: hasMarks && found ? found.meritPositionBn : 'নম্বর নেই',
        isPassed: hasMarks && found ? found.isPassed : false,
        isSelected: term.id === selectedExamId,
      };
    });
  }, [
    activeResult,
    examTerms,
    getCalculatedResultsForClass,
    selectedClassId,
    selectedSection,
    selectedYear,
    selectedExamId,
  ]);

  const enteredTrendPoints = useMemo(
    () => studentExamTrend.filter((item) => item.hasMarks && item.gpa !== null && item.percentage !== null),
    [studentExamTrend]
  );

  const trendSummary = useMemo(() => {
    if (enteredTrendPoints.length === 0) return null;
    const first = enteredTrendPoints[0];
    const latest = enteredTrendPoints[enteredTrendPoints.length - 1];
    const gpaDelta =
      enteredTrendPoints.length >= 2 && first.gpa !== null && latest.gpa !== null
        ? Number((latest.gpa - first.gpa).toFixed(2))
        : null;
    const pctDelta =
      enteredTrendPoints.length >= 2 && first.percentage !== null && latest.percentage !== null
        ? Number((latest.percentage - first.percentage).toFixed(1))
        : null;
    const avgGpaTerms =
      enteredTrendPoints.reduce((acc, p) => acc + (p.gpa || 0), 0) / enteredTrendPoints.length;
    const avgPctTerms =
      enteredTrendPoints.reduce((acc, p) => acc + (p.percentage || 0), 0) / enteredTrendPoints.length;
    const bestTerm = enteredTrendPoints.reduce((best, cur) =>
      (cur.percentage || 0) > (best.percentage || 0) ? cur : best
    );

    return {
      count: enteredTrendPoints.length,
      gpaDelta,
      pctDelta,
      avgGpa: Number(avgGpaTerms.toFixed(2)),
      avgPct: Number(avgPctTerms.toFixed(1)),
      bestTerm,
    };
  }, [enteredTrendPoints]);

  return (
    <div className="space-y-6">
      {/* Non-print control bar */}
      <div className="no-print space-y-4">
        {/* Top Control Header */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 mb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 font-serif flex items-center">
                <Printer className="w-5 h-5 mr-2 text-indigo-600" />
                ফলাফল ও প্রোগ্রেস কার্ড প্রিন্ট
              </h2>
              <p className="text-xs text-slate-500">
                সংযুক্ত অফিসিয়াল ফরম্যাটে একক অথবা একসাথে সকল শিক্ষার্থীর রেজাল্ট কার্ড প্রিন্ট করুন।
              </p>
            </div>

            {/* Print Mode Switcher */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                <button
                  onClick={() => setViewMode('single')}
                  className={`inline-flex items-center px-3 py-1.5 rounded-md text-xs font-bold transition ${
                    viewMode === 'single'
                      ? 'bg-white shadow text-indigo-700'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <User className="w-3.5 h-3.5 mr-1" />
                  একক রেজাল্ট কার্ড
                </button>
                <button
                  onClick={() => setViewMode('batch')}
                  className={`inline-flex items-center px-3 py-1.5 rounded-md text-xs font-bold transition ${
                    viewMode === 'batch'
                      ? 'bg-white shadow text-indigo-700'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 mr-1" />
                  একসাথে সকল রেজাল্ট
                </button>
                <button
                  onClick={() => setViewMode('analytics')}
                  className={`inline-flex items-center px-3 py-1.5 rounded-md text-xs font-bold transition ${
                    viewMode === 'analytics'
                      ? 'bg-indigo-600 shadow text-white'
                      : 'text-indigo-700 hover:text-indigo-900 hover:bg-indigo-50'
                  }`}
                >
                  <BarChart2 className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                  চার্ট ও অ্যানালিটিক্স
                </button>
              </div>

              {/* Action Buttons: PDF and Print */}
              {viewMode === 'single' ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownloadSinglePDF()}
                    disabled={isDownloadingPdf || !activeResult}
                    className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition disabled:opacity-50"
                    title="এই শিক্ষার্থীর প্রোগ্রেস কার্ডটি উচ্চমানের PDF ফরম্যাটে ডাউনলোড করুন"
                  >
                    {isDownloadingPdf ? (
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-1.5" />
                    )}
                    পিডিএফ ডাউনলোড (PDF)
                  </button>

                  <button
                    onClick={handlePrint}
                    className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition"
                  >
                    <Printer className="w-4 h-4 mr-1.5" />
                    প্রিন্ট করুন
                  </button>
                </div>
              ) : viewMode === 'batch' ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadBatchPDF}
                    disabled={isDownloadingPdf || selectedBatchIds.length === 0}
                    className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition disabled:opacity-50"
                    title="নির্বাচিত সকল শিক্ষার্থীর রেজাল্ট কার্ড একটি সমন্বিত মাল্টি-পেজ PDF হিসেবে ডাউনলোড করুন"
                  >
                    {isDownloadingPdf ? (
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-1.5" />
                    )}
                    সকল কার্ড এক ফাইলে PDF
                  </button>

                  <button
                    onClick={handlePrint}
                    className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition"
                  >
                    <Printer className="w-4 h-4 mr-1.5" />
                    নির্বাচিত সকল কার্ড প্রিন্ট করুন
                  </button>
                </div>
              ) : (
                <button
                  onClick={handlePrint}
                  className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition"
                >
                  <Printer className="w-4 h-4 mr-1.5" />
                  অ্যানালিটিক্স প্রিন্ট
                </button>
              )}
            </div>
          </div>

          {/* Filter Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">পরীক্ষা</label>
              <select
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                className="w-full text-sm font-medium border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none"
              >
                {examTerms.map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.nameBn}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">শিক্ষাবর্ষ</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full text-sm font-medium border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none"
              >
                <option value="২০২৬">২০২৬</option>
                <option value="২০২৫">২০২৫</option>
                <option value="২০২৭">২০২৭</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">শ্রেণি</label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full text-sm font-bold border border-indigo-300 rounded-lg px-2.5 py-1.5 bg-indigo-50/50 text-indigo-900 focus:outline-none"
              >
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.nameBn}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">শাখা</label>
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="w-full text-sm font-medium border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none"
              >
                <option value="">সকল শাখা</option>
                <option value="ক">ক শাখা</option>
                <option value="খ">খ শাখা</option>
              </select>
            </div>
          </div>
        </div>

        {/* Quick Result Stats Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
            <div className="p-2.5 bg-blue-50 text-blue-700 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">মোট শিক্ষার্থী</div>
              <div className="text-lg font-bold text-slate-900">
                {toBengaliNumber(totalStudents)} জন
              </div>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-lg">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">উত্তীর্ণের সংখ্যা</div>
              <div className="text-lg font-bold text-emerald-700">
                {toBengaliNumber(passedStudents)} জন (
                {totalStudents > 0 ? toBengaliNumber(Math.round((passedStudents / totalStudents) * 100)) : 0}%)
              </div>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
            <div className="p-2.5 bg-amber-50 text-amber-700 rounded-lg">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">গড় জিপিএ (GPA)</div>
              <div className="text-lg font-bold text-slate-900">
                {toBengaliNumber(avgGpa)}
              </div>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
            <div className="p-2.5 bg-purple-50 text-purple-700 rounded-lg">
              <Trophy className="w-5 h-5" />
            </div>
            <div className="truncate">
              <div className="text-xs text-slate-500 font-medium">১ম স্থান (মেধাক্রম ১)</div>
              <div className="text-sm font-bold text-purple-900 truncate">
                {topStudent ? `${topStudent.student.nameBn}` : '-'}
              </div>
            </div>
          </div>
        </div>

        {/* Analytics Mode Banner button if on card view */}
        {viewMode !== 'analytics' && (
          <div className="bg-gradient-to-r from-indigo-50 via-blue-50 to-purple-50 border border-indigo-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-xs">
                <BarChart2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-indigo-950">
                  পারফরম্যান্স গ্রাফ ও বিষয়ভিত্তিক অ্যানালিটিক্স
                </h4>
                <p className="text-[11px] text-indigo-700">
                  শ্রেণিভিত্তিক পাসের হার, গ্রেড বণ্টন, বিষয়ভিত্তিক গড় নম্বর এবং সাময়িক ট্রেন্ড চার্ট দেখুন।
                </p>
              </div>
            </div>
            <button
              onClick={() => setViewMode('analytics')}
              className="inline-flex items-center px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition"
            >
              <TrendingUp className="w-3.5 h-3.5 mr-1 text-emerald-300" />
              গ্রাফিক্যাল বিশ্লেষণ দেখুন →
            </button>
          </div>
        )}

        {/* Single Student Selector Navigation */}
        {viewMode === 'single' && classResults.length > 0 && (
          <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-indigo-900">শিক্ষার্থী নির্বাচন:</span>
              <select
                value={selectedStudentIndex}
                onChange={(e) => setSelectedStudentIndex(parseInt(e.target.value, 10))}
                className="text-sm font-bold border border-indigo-300 rounded-lg px-3 py-1.5 bg-white text-indigo-950 focus:outline-none"
              >
                {classResults.map((res, idx) => (
                  <option key={res.student.id} value={idx}>
                    রোল {toBengaliRoll(res.student.roll)}: {res.student.nameBn} (জিপিএ: {res.gpa.toFixed(2)}, {res.meritPositionBn})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={async () => {
                  if (!activeResult) return;
                  if (!activeResult.student.guardianPhone || !isValidBDMobile(activeResult.student.guardianPhone)) {
                    setSmsFeedback('অভিভাবকের সঠিক মোবাইল নম্বর নেই!');
                    setTimeout(() => setSmsFeedback(null), 3000);
                    return;
                  }
                  const text = generateResultSMS(activeResult, schoolInfo, currentClass.nameBn, currentExam.nameBn);
                  const res = await sendSingleSMS(
                    activeResult.student.guardianPhone,
                    text,
                    `${activeResult.student.nameBn} (অভিভাবক)`,
                    {
                      roll: activeResult.student.roll,
                      className: currentClass.nameBn,
                      messageType: 'result',
                      channel: 'device_sms',
                    }
                  );
                  setSmsFeedback(res.message);
                  setTimeout(() => setSmsFeedback(null), 3000);
                }}
                className="inline-flex items-center px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition"
              >
                <Smartphone className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                ফলাফল এসএমএস পাঠান
              </button>

              <button
                onClick={() => handleDownloadSinglePDF(activeResult)}
                disabled={isDownloadingPdf || !activeResult}
                className="inline-flex items-center px-3 py-1.5 rounded-lg border border-indigo-300 bg-indigo-50 text-xs font-bold text-indigo-900 hover:bg-indigo-100 transition disabled:opacity-50 shadow-xs"
                title="এই প্রোগ্রেস কার্ডটি PDF ফাইল হিসেবে সংরক্ষণ করুন"
              >
                {isDownloadingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1 text-indigo-700 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5 mr-1 text-indigo-700" />
                )}
                পিডিএফ ডাউনলোড
              </button>

              <button
                disabled={selectedStudentIndex <= 0}
                onClick={() => setSelectedStudentIndex((prev) => Math.max(0, prev - 1))}
                className="inline-flex items-center px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> পূর্ববর্তী
              </button>
              <span className="text-xs font-semibold text-slate-600">
                {toBengaliNumber(selectedStudentIndex + 1)} / {toBengaliNumber(classResults.length)}
              </span>
              <button
                disabled={selectedStudentIndex >= classResults.length - 1}
                onClick={() =>
                  setSelectedStudentIndex((prev) => Math.min(classResults.length - 1, prev + 1))
                }
                className="inline-flex items-center px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                পরবর্তী <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        )}

        {/* Feedback Alert Toast */}
        {smsFeedback && (
          <div className="bg-emerald-800 text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold flex items-center justify-between animate-in fade-in">
            <span className="flex items-center">
              <Check className="w-4 h-4 mr-2 text-emerald-300" />
              {smsFeedback}
            </span>
          </div>
        )}

        {/* Batch Print Student Checklist Selector */}
        {viewMode === 'batch' && (
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between pb-3 border-b border-amber-200/80 mb-3 gap-2">
              <div>
                <h4 className="text-sm font-bold text-amber-950">
                  একসাথে সকল রেজাল্ট প্রিন্ট চেকলিস্ট
                </h4>
                <p className="text-xs text-amber-800">
                  নিচের যেসকল শিক্ষার্থীর পাশে টিক চিহ্ন রয়েছে তাদের রেজাল্ট কার্ড প্রিন্ট হবে।
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <label className="inline-flex items-center text-xs font-bold text-amber-950 cursor-pointer mr-2">
                  <input
                    type="checkbox"
                    checked={selectedBatchIds.length === classResults.length && classResults.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 mr-1.5 h-4 w-4"
                  />
                  সবাইকে নির্বাচন ({toBengaliNumber(selectedBatchIds.length)})
                </label>

                <button
                  onClick={async () => {
                    const selected = classResults.filter((r) => selectedBatchIds.includes(r.student.id));
                    const valid = selected.filter((r) => r.student.guardianPhone && isValidBDMobile(r.student.guardianPhone));
                    if (valid.length === 0) {
                      setSmsFeedback('নির্বাচিত শিক্ষার্থীদের মধ্যে কোনো অভিভাবক ফোন নম্বর নেই!');
                      setTimeout(() => setSmsFeedback(null), 3000);
                      return;
                    }
                    const batchData = valid.map((r) => ({
                      phone: r.student.guardianPhone!,
                      text: generateResultSMS(r, schoolInfo, currentClass.nameBn, currentExam.nameBn),
                      recipientName: `${r.student.nameBn} (অভিভাবক)`,
                      roll: r.student.roll,
                      className: currentClass.nameBn,
                    }));
                    const res = await sendBatchSMS(batchData, 'result');
                    setSmsFeedback(`সফলভাবে ${toBengaliNumber(res.sentCount)} জনকে ফলাফল এসএমএস পাঠানো হয়েছে!`);
                    setTimeout(() => setSmsFeedback(null), 3000);
                  }}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm inline-flex items-center"
                >
                  <Smartphone className="w-3.5 h-3.5 mr-1" />
                  এসএমএস পাঠান
                </button>

                <button
                  onClick={handleDownloadBatchPDF}
                  disabled={isDownloadingPdf || selectedBatchIds.length === 0}
                  className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-sm inline-flex items-center transition disabled:opacity-50"
                  title="নির্বাচিত শিক্ষার্থীদের সকল কার্ড সমন্বিত PDF হিসেবে ডাউনলোড করুন"
                >
                  {isDownloadingPdf ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5 mr-1" />
                  )}
                  সকলের PDF ডাউনলোড
                </button>

                <button
                  onClick={handlePrint}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5 inline mr-1" /> এখনই প্রিন্ট দিন
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 max-h-48 overflow-y-auto pr-1">
              {classResults.map((res) => {
                const isSelected = selectedBatchIds.includes(res.student.id);
                return (
                  <label
                    key={res.student.id}
                    className={`flex items-center p-2 rounded-lg border text-xs cursor-pointer transition ${
                      isSelected
                        ? 'bg-white border-indigo-400 font-semibold text-indigo-950 shadow-xs'
                        : 'bg-amber-100/40 border-amber-200 text-slate-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleStudentSelection(res.student.id)}
                      className="rounded text-indigo-600 mr-2 h-3.5 w-3.5"
                    />
                    <span className="truncate">
                      রোল {toBengaliRoll(res.student.roll)}: {res.student.nameBn}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* VIEW CONTENT: ANALYTICS OR RESULT CARDS */}
      {viewMode === 'analytics' ? (
        <ResultAnalyticsView onBackToCards={() => setViewMode('single')} />
      ) : (
        <>
          {/* Non-print Multi-Exam Student Performance Trend Graph (Single Student View) */}
          {viewMode === 'single' && activeResult && (
            <div className="no-print bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4.5 h-4.5 text-indigo-600 shrink-0" />
                    <h3 className="text-base font-bold text-slate-900 truncate">
                      {activeResult.student.nameBn} — একাধিক পরীক্ষার পারফরম্যান্স ট্রেন্ড
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                    রোল {toBengaliRoll(activeResult.student.roll)} • {currentClass?.nameBn} • শিক্ষাবর্ষ {selectedYear} •{' '}
                    {toBengaliNumber(enteredTrendPoints.length)}/{toBengaliNumber(studentExamTrend.length)}টি পরীক্ষার নম্বর সংযুক্ত
                  </p>
                </div>

                {/* Metric View Switcher */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setTrendMetric('combined')}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                      trendMetric === 'combined'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    সমন্বিত (GPA ও %)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrendMetric('percentage')}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                      trendMetric === 'percentage'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    শতাংশ (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrendMetric('gpa')}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                      trendMetric === 'gpa'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    জিপিএ (GPA)
                  </button>
                </div>
              </div>

              {/* Trend Summary KPI Strip */}
              {trendSummary ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-2.5">
                    <div className="text-[11px] font-medium text-slate-500">গড় জিপিএ (সকল পরীক্ষা)</div>
                    <div className="text-lg font-bold text-slate-900 tabular-nums mt-0.5">
                      {toBengaliNumber(trendSummary.avgGpa.toFixed(2))}
                      <span className="text-xs font-normal text-slate-500"> / ৫.০০</span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-2.5">
                    <div className="text-[11px] font-medium text-slate-500">গড় নম্বর শতাংশ</div>
                    <div className="text-lg font-bold text-indigo-700 tabular-nums mt-0.5">
                      {toBengaliNumber(trendSummary.avgPct.toFixed(1))}%
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-2.5">
                    <div className="text-[11px] font-medium text-slate-500">সর্বোচ্চ পারফরম্যান্স</div>
                    <div className="text-sm font-bold text-slate-900 truncate mt-0.5">
                      {trendSummary.bestTerm.shortName}
                    </div>
                    <div className="text-[11px] font-semibold text-emerald-700 tabular-nums">
                      {toBengaliNumber((trendSummary.bestTerm.percentage || 0).toFixed(1))}% • GPA{' '}
                      {toBengaliNumber((trendSummary.bestTerm.gpa || 0).toFixed(2))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-2.5">
                    <div className="text-[11px] font-medium text-slate-500">পরীক্ষাভিত্তিক পরিবর্তন</div>
                    {trendSummary.pctDelta !== null && trendSummary.gpaDelta !== null ? (
                      <div className="mt-0.5 flex items-center gap-1.5">
                        {trendSummary.pctDelta > 0 ? (
                          <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : trendSummary.pctDelta < 0 ? (
                          <TrendingDown className="w-4 h-4 text-rose-600 shrink-0" />
                        ) : (
                          <Minus className="w-4 h-4 text-slate-500 shrink-0" />
                        )}
                        <span
                          className={`text-sm font-bold tabular-nums ${
                            trendSummary.pctDelta > 0
                              ? 'text-emerald-700'
                              : trendSummary.pctDelta < 0
                                ? 'text-rose-700'
                                : 'text-slate-700'
                          }`}
                        >
                          {trendSummary.pctDelta > 0 ? '+' : ''}
                          {toBengaliNumber(trendSummary.pctDelta.toFixed(1))}% (
                          {trendSummary.gpaDelta > 0 ? '+' : ''}
                          {toBengaliNumber(trendSummary.gpaDelta.toFixed(2))} GPA)
                        </span>
                      </div>
                    ) : (
                      <div className="text-xs font-medium text-slate-500 mt-1">
                        তুলনার জন্য কমপক্ষে ২টি পরীক্ষা প্রয়োজন
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3 flex items-center gap-2.5 text-xs text-amber-900">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    এই শিক্ষার্থীর জন্য {selectedYear} শিক্ষাবর্ষের কোনো পরীক্ষার নম্বর এখনো এন্ট্রি করা হয়নি। মার্ক এন্ট্রি সম্পন্ন হলে স্বয়ংক্রিয়ভাবে ট্রেন্ড গ্রাফ প্রদর্শিত হবে।
                  </span>
                </div>
              )}

              {/* Recharts Visualization */}
              {enteredTrendPoints.length > 0 && (
                <div className="space-y-2">
                  {enteredTrendPoints.length === 1 && (
                    <div className="flex items-center gap-2 text-[11px] text-indigo-800 bg-indigo-50/80 border border-indigo-200 rounded-lg px-3 py-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span>
                        বর্তমানে ১টি পরীক্ষার ({enteredTrendPoints[0].termName}) ফলাফল পাওয়া গেছে; পরবর্তী পরীক্ষার নম্বর যুক্ত হলে সম্পূর্ণ অগ্রগতির রেখাচিত্র দেখা যাবে।
                      </span>
                    </div>
                  )}

                  <div className="w-full h-64 min-w-0 pt-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={studentExamTrend}
                        margin={{ top: 12, right: 16, left: 0, bottom: 4 }}
                      >
                        <defs>
                          <linearGradient id="studentPerfPctFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.22} />
                            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.02} />
                          </linearGradient>
                          <linearGradient id="studentPerfGpaFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#059669" stopOpacity={0.22} />
                            <stop offset="95%" stopColor="#059669" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>

                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />

                        <XAxis
                          dataKey="shortName"
                          tick={{ fontSize: 12, fill: '#334155', fontWeight: 600 }}
                          axisLine={{ stroke: '#cbd5e1' }}
                          tickLine={false}
                        />

                        {(trendMetric === 'combined' || trendMetric === 'percentage') && (
                          <YAxis
                            yAxisId="pct"
                            domain={[0, 100]}
                            tick={{ fontSize: 11, fill: '#4f46e5' }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(val: number) => `${toBengaliNumber(val)}%`}
                            width={44}
                          />
                        )}

                        {(trendMetric === 'combined' || trendMetric === 'gpa') && (
                          <YAxis
                            yAxisId="gpa"
                            orientation={trendMetric === 'combined' ? 'right' : 'left'}
                            domain={[0, 5]}
                            ticks={[0, 1, 2, 3, 4, 5]}
                            tick={{ fontSize: 11, fill: '#059669' }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(val: number) => toBengaliNumber(val.toFixed(1))}
                            width={38}
                          />
                        )}

                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload || payload.length === 0) return null;
                            const row = payload[0]?.payload as (typeof studentExamTrend)[number];
                            if (!row) return null;
                            return (
                              <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs space-y-1.5 min-w-[205px]">
                                <div className="font-bold text-slate-900 border-b border-slate-100 pb-1 flex items-center justify-between gap-2">
                                  <span>{row.termName}</span>
                                  {row.isSelected && (
                                    <span className="text-[10px] font-semibold text-indigo-700">সক্রিয় কার্ড</span>
                                  )}
                                </div>
                                {row.hasMarks ? (
                                  <div className="space-y-1 tabular-nums">
                                    <div className="flex items-center justify-between">
                                      <span className="text-slate-500">গ্রেড ও জিপিএ:</span>
                                      <span className="font-bold text-emerald-700">
                                        {row.overallGrade} ({toBengaliNumber((row.gpa || 0).toFixed(2))})
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-slate-500">প্রাপ্ত নম্বর:</span>
                                      <span className="font-bold text-slate-900">
                                        {toBengaliNumber(row.obtainedMarks || 0)} / {toBengaliNumber(row.fullMarks)}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-slate-500">শতাংশ:</span>
                                      <span className="font-bold text-indigo-700">
                                        {toBengaliNumber((row.percentage || 0).toFixed(1))}%
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-slate-500">মেধাক্রম:</span>
                                      <span className="font-semibold text-slate-800">{row.meritPositionBn}</span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-slate-500 py-1">এই পরীক্ষার নম্বর এখনো এন্ট্রি হয়নি।</div>
                                )}
                              </div>
                            );
                          }}
                        />

                        {trendMetric === 'percentage' && trendSummary && (
                          <ReferenceLine
                            yAxisId="pct"
                            y={trendSummary.avgPct}
                            stroke="#6366f1"
                            strokeDasharray="4 4"
                            strokeOpacity={0.65}
                          />
                        )}

                        {trendMetric === 'gpa' && trendSummary && (
                          <ReferenceLine
                            yAxisId="gpa"
                            y={trendSummary.avgGpa}
                            stroke="#059669"
                            strokeDasharray="4 4"
                            strokeOpacity={0.65}
                          />
                        )}

                        {trendMetric === 'combined' && (
                          <>
                            <Bar
                              yAxisId="pct"
                              dataKey="percentage"
                              name="শতাংশ (%)"
                              fill="url(#studentPerfPctFill)"
                              stroke="#6366f1"
                              strokeWidth={1.5}
                              barSize={38}
                              radius={[6, 6, 0, 0]}
                            />
                            <Line
                              yAxisId="gpa"
                              type="monotone"
                              dataKey="gpa"
                              name="জিপিএ (GPA)"
                              stroke="#059669"
                              strokeWidth={3}
                              connectNulls={false}
                              dot={{ r: 5, fill: '#059669', stroke: '#ffffff', strokeWidth: 2 }}
                              activeDot={{ r: 7, fill: '#047857', stroke: '#ffffff', strokeWidth: 2 }}
                            />
                          </>
                        )}

                        {trendMetric === 'percentage' && (
                          <Area
                            yAxisId="pct"
                            type="monotone"
                            dataKey="percentage"
                            name="শতাংশ (%)"
                            stroke="#4f46e5"
                            strokeWidth={3}
                            fill="url(#studentPerfPctFill)"
                            connectNulls={false}
                            dot={{ r: 5, fill: '#4f46e5', stroke: '#ffffff', strokeWidth: 2 }}
                            activeDot={{ r: 7, fill: '#4338ca', stroke: '#ffffff', strokeWidth: 2 }}
                          />
                        )}

                        {trendMetric === 'gpa' && (
                          <Area
                            yAxisId="gpa"
                            type="monotone"
                            dataKey="gpa"
                            name="জিপিএ (GPA)"
                            stroke="#059669"
                            strokeWidth={3}
                            fill="url(#studentPerfGpaFill)"
                            connectNulls={false}
                            dot={{ r: 5, fill: '#059669', stroke: '#ffffff', strokeWidth: 2 }}
                            activeDot={{ r: 7, fill: '#047857', stroke: '#ffffff', strokeWidth: 2 }}
                          />
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Legend Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 pt-1">
                    <div className="flex items-center gap-4">
                      {(trendMetric === 'combined' || trendMetric === 'percentage') && (
                        <span className="inline-flex items-center gap-1.5 font-medium">
                          <span className="w-3 h-3 rounded-xs bg-indigo-500/30 border border-indigo-600 inline-block" />
                          মোট নম্বরের শতাংশ (%)
                        </span>
                      )}
                      {(trendMetric === 'combined' || trendMetric === 'gpa') && (
                        <span className="inline-flex items-center gap-1.5 font-medium">
                          <span className="w-3 h-0.5 bg-emerald-600 inline-block" />
                          অর্জিত জিপিএ (৫.০০ এর মধ্যে)
                        </span>
                      )}
                    </div>
                    <span className="text-slate-500">নিচের যেকোনো পরীক্ষায় ক্লিক করে সেই কার্ডে যান</span>
                  </div>
                </div>
              )}

              {/* Exam-by-Exam Interactive Breakdown Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                {studentExamTrend.map((term) => (
                  <button
                    key={term.termId}
                    type="button"
                    onClick={() => setSelectedExamId(term.termId)}
                    className={`text-left rounded-lg border p-3 transition ${
                      term.isSelected
                        ? 'border-indigo-500 bg-indigo-50/70 ring-1 ring-indigo-500/30'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900 truncate">{term.termName}</span>
                      <span
                        className={`text-[11px] font-bold tabular-nums ${
                          term.hasMarks
                            ? term.isPassed
                              ? 'text-emerald-700'
                              : 'text-rose-700'
                            : 'text-slate-400'
                        }`}
                      >
                        {term.hasMarks ? `${term.overallGrade}` : 'ফাঁকা'}
                      </span>
                    </div>
                    {term.hasMarks ? (
                      <div className="mt-1.5 flex items-baseline justify-between text-xs tabular-nums">
                        <span className="font-bold text-slate-800">
                          GPA {toBengaliNumber((term.gpa || 0).toFixed(2))}
                          <span className="text-slate-400 font-normal"> • </span>
                          {toBengaliNumber((term.percentage || 0).toFixed(1))}%
                        </span>
                        <span className="text-[11px] font-medium text-slate-600">
                          {term.meritPositionBn}
                        </span>
                      </div>
                    ) : (
                      <div className="mt-1.5 text-[11px] text-slate-400">নম্বর এন্ট্রি বাকি রয়েছে</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* RESULT CARDS RENDERING (PRINTABLE AREA) */}
          <div className="printable-area">
            {classResults.length === 0 ? (
              <div className="no-print bg-white p-12 text-center rounded-xl border border-slate-200 text-slate-500">
                এই শ্রেণিতে এখনো কোনো ফলাফল প্রস্তুত নেই। &quot;মার্ক এন্ট্রি&quot; থেকে নম্বর এন্ট্রি সম্পন্ন করুন।
              </div>
            ) : viewMode === 'single' ? (
              /* Single Card View */
              activeResult && (
                <MarksheetCard
                  result={activeResult}
                  schoolInfo={schoolInfo}
                  classNameTitle={currentClass.nameBn}
                  isPrintMode={false}
                  onDownloadPdf={() => handleDownloadSinglePDF(activeResult)}
                  isExportingPdf={isDownloadingPdf}
                  onPhotoUpload={handleStudentPhotoUpload}
                />
              )
            ) : (
              /* Batch Cards View - Each will break onto its own A4 page in print! */
              <div className="space-y-8 print:space-y-0">
                {classResults
                  .filter((res) => selectedBatchIds.includes(res.student.id))
                  .map((res) => (
                    <MarksheetCard
                      key={res.student.id}
                      result={res}
                      schoolInfo={schoolInfo}
                      classNameTitle={currentClass.nameBn}
                      isPrintMode={true}
                    />
                  ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* PDF Generation Progress Modal Overlay */}
      {pdfProgress && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 text-center space-y-4 animate-in zoom-in-95">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">উচ্চমানের PDF তৈরি হচ্ছে...</h3>
              <p className="text-xs text-slate-500 mt-1">{pdfProgress.message}</p>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                style={{
                  width: `${
                    pdfProgress.total > 0
                      ? Math.round((pdfProgress.current / pdfProgress.total) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
            <div className="text-xs font-bold text-indigo-900">
              {toBengaliNumber(pdfProgress.current)} / {toBengaliNumber(pdfProgress.total)} (
              {toBengaliNumber(
                pdfProgress.total > 0
                  ? Math.round((pdfProgress.current / pdfProgress.total) * 100)
                  : 0
              )}
              %)
            </div>
            <p className="text-[11px] text-slate-400">
              প্রোগ্রেস কার্ড হাই-রেজোলিউশনে রেন্ডার হচ্ছে, সম্পন্ন হলে স্বয়ংক্রিয়ভাবে ডাউনলোড শুরু হবে।
            </p>
          </div>
        </div>
      )}

      {/* Offscreen Container to guarantee all cards are rendered for Batch PDF */}
      <div
        id="batch-pdf-offscreen-container"
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '-9999px',
          top: 0,
          width: '820px',
          pointerEvents: 'none',
          opacity: 0.01,
        }}
      >
        {classResults.map((res) => (
          <div key={`pdf-hidden-${res.student.id}`} id={`marksheet-pdf-hidden-${res.student.id}`}>
            <MarksheetCard
              result={res}
              schoolInfo={schoolInfo}
              classNameTitle={currentClass.nameBn}
              isPrintMode={true}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
