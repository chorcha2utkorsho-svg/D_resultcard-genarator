import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  Award,
  Users,
  CheckCircle,
  AlertTriangle,
  BookOpen,
  Trophy,
  Filter,
  BarChart3,
  PieChart as PieChartIcon,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Printer,
  Sparkles,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { toBengaliNumber, toBengaliOrdinal, toBengaliRoll } from '../utils/bengali';
import { CalculatedStudentResult, SchoolClass } from '../types';

interface ResultAnalyticsViewProps {
  onBackToCards?: () => void;
}

// Color palettes for Recharts
const GRADE_COLORS: Record<string, string> = {
  'A+': '#10b981', // emerald-500
  'A': '#3b82f6',  // blue-500
  'A-': '#06b6d4', // cyan-500
  'B': '#8b5cf6',  // purple-500
  'C': '#f59e0b',  // amber-500
  'D': '#f97316',  // orange-500
  'F': '#ef4444',  // rose-500
};

const PIE_COLORS = ['#10b981', '#f43f5e']; // Passed (Emerald), Failed (Rose)

export const ResultAnalyticsView: React.FC<ResultAnalyticsViewProps> = ({ onBackToCards }) => {
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
    getCalculatedResultsForClass,
  } = useSchool();

  const [activeTab, setActiveTab] = useState<'current_class' | 'cross_class' | 'term_trends'>('current_class');

  const currentClass = classes.find((c) => c.id === selectedClassId) || classes[0];
  const currentExam = examTerms.find((e) => e.id === selectedExamId) || examTerms[0];

  // 1. Current Class Calculated Results
  const currentClassResults: CalculatedStudentResult[] = useMemo(() => {
    return getCalculatedResultsForClass(
      selectedClassId,
      selectedSection,
      selectedExamId,
      selectedYear
    );
  }, [selectedClassId, selectedSection, selectedExamId, selectedYear, getCalculatedResultsForClass]);

  // Overall Class Stats
  const totalStudents = currentClassResults.length;
  const passedStudents = currentClassResults.filter((r) => r.isPassed).length;
  const failedStudents = totalStudents - passedStudents;
  const passRate = totalStudents > 0 ? Number(((passedStudents / totalStudents) * 100).toFixed(1)) : 0;
  const failRate = totalStudents > 0 ? Number((100 - passRate).toFixed(1)) : 0;

  const avgGpa = totalStudents > 0
    ? Number((currentClassResults.reduce((sum, r) => sum + r.gpa, 0) / totalStudents).toFixed(2))
    : 0;

  const avgTotalMarks = totalStudents > 0
    ? Math.round(currentClassResults.reduce((sum, r) => sum + r.grandTotalObtained, 0) / totalStudents)
    : 0;

  const topStudent = currentClassResults.length > 0
    ? currentClassResults.reduce((prev, curr) => (curr.grandTotalObtained > prev.grandTotalObtained ? curr : prev))
    : null;

  // 2. Pass vs Fail Pie Chart Data
  const passFailData = useMemo(() => {
    if (totalStudents === 0) return [];
    return [
      { name: 'উত্তীর্ণ', value: passedStudents, percentage: passRate },
      { name: 'অনুত্তীর্ণ', value: failedStudents, percentage: failRate },
    ];
  }, [totalStudents, passedStudents, failedStudents, passRate, failRate]);

  // 3. Grade Distribution Data
  const gradeDistributionData = useMemo(() => {
    const grades = ['A+', 'A', 'A-', 'B', 'C', 'D', 'F'];
    const counts: Record<string, number> = { 'A+': 0, 'A': 0, 'A-': 0, 'B': 0, 'C': 0, 'D': 0, 'F': 0 };

    currentClassResults.forEach((r) => {
      const g = r.overallGrade || 'F';
      if (counts[g] !== undefined) {
        counts[g]++;
      } else {
        counts['F']++;
      }
    });

    return grades.map((grade) => ({
      grade,
      count: counts[grade],
      percentage: totalStudents > 0 ? Number(((counts[grade] / totalStudents) * 100).toFixed(1)) : 0,
      fill: GRADE_COLORS[grade] || '#64748b',
    }));
  }, [currentClassResults, totalStudents]);

  // 4. Subject-Specific Averages & Highest
  const subjectAveragesData = useMemo(() => {
    if (!currentClass?.defaultSubjects || currentClassResults.length === 0) return [];

    return currentClass.defaultSubjects.map((sub) => {
      const marksList: number[] = [];
      let passedCount = 0;
      let evaluatedCount = 0;

      currentClassResults.forEach((r) => {
        const sRow = r.subjectRows.find((sr) => sr.subject.id === sub.id);
        if (sRow && sRow.totalObtained !== null && sRow.totalObtained !== undefined) {
          marksList.push(sRow.totalObtained);
          evaluatedCount++;
          // Pass mark standard 33%
          if (sRow.totalObtained >= Math.ceil(sub.fullMarks * 0.33)) {
            passedCount++;
          }
        }
      });

      const avg = marksList.length > 0 ? Math.round(marksList.reduce((a, b) => a + b, 0) / marksList.length) : 0;
      const highest = marksList.length > 0 ? Math.max(...marksList) : 0;
      const lowest = marksList.length > 0 ? Math.min(...marksList) : 0;
      const subjectPassRate = evaluatedCount > 0 ? Number(((passedCount / evaluatedCount) * 100).toFixed(1)) : 0;

      return {
        id: sub.id,
        name: sub.nameBn,
        fullName: `${sub.nameBn} (${sub.fullMarks})`,
        fullMarks: sub.fullMarks,
        average: avg,
        highest,
        lowest,
        passRate: subjectPassRate,
        evaluatedCount,
      };
    });
  }, [currentClass, currentClassResults]);

  // Best & Toughest subjects based on average
  const sortedSubjectsByAvg = useMemo(() => {
    return [...subjectAveragesData].sort((a, b) => (b.average / b.fullMarks) - (a.average / a.fullMarks));
  }, [subjectAveragesData]);

  const bestSubject = sortedSubjectsByAvg[0] || null;
  const toughestSubject = sortedSubjectsByAvg.length > 1 ? sortedSubjectsByAvg[sortedSubjectsByAvg.length - 1] : null;

  // 5. Score Range Brackets (80%+, 70-79%, 60-69%, 50-59%, 33-49%, <33%)
  const scoreBracketsData = useMemo(() => {
    const brackets = [
      { range: '৮০% - ১০০% (A+)', count: 0, color: '#10b981' },
      { range: '৭০% - ৭৯% (A)', count: 0, color: '#3b82f6' },
      { range: '৬০% - ৬৯% (A-)', count: 0, color: '#06b6d4' },
      { range: '৫০% - ৫৯% (B)', count: 0, color: '#8b5cf6' },
      { range: '৩৩% - ৪৯% (C-D)', count: 0, color: '#f59e0b' },
      { range: '৩৩% এর কম (F)', count: 0, color: '#ef4444' },
    ];

    currentClassResults.forEach((r) => {
      const pct = r.totalFullMarks > 0 ? (r.grandTotalObtained / r.totalFullMarks) * 100 : 0;
      if (pct >= 80) brackets[0].count++;
      else if (pct >= 70) brackets[1].count++;
      else if (pct >= 60) brackets[2].count++;
      else if (pct >= 50) brackets[3].count++;
      else if (pct >= 33) brackets[4].count++;
      else brackets[5].count++;
    });

    return brackets;
  }, [currentClassResults]);

  // 6. Cross-Class Performance Comparison Data (Across all classes for selected exam)
  const crossClassData = useMemo(() => {
    return classes.map((cls) => {
      const results = getCalculatedResultsForClass(cls.id, '', selectedExamId, selectedYear);
      const total = results.length;
      const passed = results.filter((r) => r.isPassed).length;
      const cPassRate = total > 0 ? Number(((passed / total) * 100).toFixed(1)) : 0;
      const cAvgGpa = total > 0
        ? Number((results.reduce((sum, r) => sum + r.gpa, 0) / total).toFixed(2))
        : 0;

      return {
        classId: cls.id,
        className: cls.nameBn,
        shortName: cls.nameBn.replace(' শ্রেণি', ''),
        totalStudents: total,
        passedStudents: passed,
        failedStudents: total - passed,
        passRate: cPassRate,
        avgGpa: cAvgGpa,
      };
    }).filter((c) => c.totalStudents > 0);
  }, [classes, selectedExamId, selectedYear, getCalculatedResultsForClass]);

  // 7. Exam Term Trends for Current Class (Term 1 vs Term 2 vs Annual)
  const examTermTrendsData = useMemo(() => {
    return examTerms.map((term) => {
      const results = getCalculatedResultsForClass(selectedClassId, selectedSection, term.id, selectedYear);
      const total = results.length;
      const passed = results.filter((r) => r.isPassed).length;
      const tPassRate = total > 0 ? Number(((passed / total) * 100).toFixed(1)) : 0;
      const tAvgGpa = total > 0
        ? Number((results.reduce((sum, r) => sum + r.gpa, 0) / total).toFixed(2))
        : 0;
      const tAvgMarks = total > 0
        ? Math.round(results.reduce((sum, r) => sum + r.grandTotalObtained, 0) / total)
        : 0;

      return {
        termId: term.id,
        termName: term.nameBn,
        shortName: term.nameBn.replace(' পরীক্ষা', ''),
        totalStudents: total,
        passedStudents: passed,
        passRate: tPassRate,
        avgGpa: tAvgGpa,
        avgMarks: tAvgMarks,
      };
    });
  }, [examTerms, selectedClassId, selectedSection, selectedYear, getCalculatedResultsForClass]);

  // Top 5 Merit Students
  const topMeritStudents = useMemo(() => {
    return [...currentClassResults]
      .sort((a, b) => a.meritPosition - b.meritPosition)
      .slice(0, 5);
  }, [currentClassResults]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white rounded-2xl shadow-xl p-6 sm:p-7 border border-indigo-800/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 mb-2">
              <TrendingUp className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
              স্মার্ট একাডেমিক পারফরম্যান্স ভিজ্যুয়ালাইজেশন
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-serif tracking-tight text-white flex items-center">
              ফলাফল ও পারফরম্যান্স অ্যানালিটিক্স
            </h1>
            <p className="text-xs sm:text-sm text-indigo-200 mt-1 max-w-2xl">
              {schoolInfo.name} • {currentClass.nameBn} • {currentExam.nameBn} ({selectedYear})
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {onBackToCards && (
              <button
                onClick={onBackToCards}
                className="px-4 py-2 bg-indigo-700/80 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl border border-indigo-500/50 shadow-sm transition flex items-center"
              >
                <BookOpen className="w-3.5 h-3.5 mr-1.5" />
                প্রোগ্রেস কার্ডে ফিরুন
              </button>
            )}
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-white text-indigo-950 hover:bg-indigo-50 text-xs font-bold rounded-xl shadow-md transition flex items-center"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
              চার্ট ও রিপোর্ট প্রিন্ট
            </button>
          </div>
        </div>

        {/* View Selection Tabs */}
        <div className="flex items-center space-x-2 mt-6 overflow-x-auto pb-1 border-b border-indigo-800/80 scrollbar-none">
          <button
            onClick={() => setActiveTab('current_class')}
            className={`flex items-center px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'current_class'
                ? 'bg-white text-indigo-950 border-amber-400 shadow-md'
                : 'text-indigo-200 hover:text-white hover:bg-indigo-900/50 border-transparent'
            }`}
          >
            <BarChart3 className="w-4 h-4 mr-1.5 text-indigo-500" />
            শ্রেণিভিত্তিক ফলাফল ও বিষয় গড় ({currentClass.nameBn})
          </button>

          <button
            onClick={() => setActiveTab('cross_class')}
            className={`flex items-center px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'cross_class'
                ? 'bg-white text-indigo-950 border-amber-400 shadow-md'
                : 'text-indigo-200 hover:text-white hover:bg-indigo-900/50 border-transparent'
            }`}
          >
            <Layers className="w-4 h-4 mr-1.5 text-emerald-400" />
            সকল শ্রেণির পারফরম্যান্স তুলনা (All Classes)
          </button>

          <button
            onClick={() => setActiveTab('term_trends')}
            className={`flex items-center px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'term_trends'
                ? 'bg-white text-indigo-950 border-amber-400 shadow-md'
                : 'text-indigo-200 hover:text-white hover:bg-indigo-900/50 border-transparent'
            }`}
          >
            <TrendingUp className="w-4 h-4 mr-1.5 text-amber-400" />
            সাময়িক পরীক্ষার ট্রেন্ড ও অগ্রগতি
          </button>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white p-4 rounded-xl shadow-xs border border-slate-200">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">পরীক্ষা</label>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="w-full text-xs font-medium border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-indigo-500"
            >
              {examTerms.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.nameBn}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">শিক্ষাবর্ষ</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full text-xs font-medium border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-indigo-500"
            >
              <option value="২০২৬">২০২৬</option>
              <option value="২০২৫">২০২৫</option>
              <option value="২০২৭">২০২৭</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">শ্রেণি</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full text-xs font-bold border border-indigo-300 rounded-lg px-2.5 py-1.5 bg-indigo-50/50 text-indigo-950 focus:bg-white focus:ring-1 focus:ring-indigo-500"
            >
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.nameBn}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">শাখা</label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full text-xs font-medium border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">সকল শাখা</option>
              <option value="ক">ক শাখা</option>
              <option value="খ">খ শাখা</option>
            </select>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: CURRENT CLASS PERFORMANCE & SUBJECT AVERAGES                   */}
      {/* ===================================================================== */}
      {activeTab === 'current_class' && (
        <div className="space-y-6">
          {/* Key Metrics KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-3.5">
              <div className="p-3 bg-blue-50 text-blue-700 rounded-xl">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-500 font-medium">মোট পরীক্ষার্থী</div>
                <div className="text-xl font-extrabold text-slate-900 font-serif">
                  {toBengaliNumber(totalStudents)} জন
                </div>
                <div className="text-[11px] text-slate-400">শাখা: {selectedSection || 'সকল'}</div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-3.5">
              <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-500 font-medium">পাসের হার (Pass Rate)</div>
                <div className="text-xl font-extrabold text-emerald-700 font-serif">
                  {toBengaliNumber(passRate)}%
                </div>
                <div className="text-[11px] text-slate-400">
                  উত্তীর্ণ {toBengaliNumber(passedStudents)} জন / ফেল {toBengaliNumber(failedStudents)} জন
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-3.5">
              <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-500 font-medium">শ্রেণি গড় জিপিএ (GPA)</div>
                <div className="text-xl font-extrabold text-indigo-900 font-serif">
                  {toBengaliNumber(avgGpa.toFixed(2))}
                </div>
                <div className="text-[11px] text-slate-400">
                  গড় নম্বর: {toBengaliNumber(avgTotalMarks)}
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-3.5">
              <div className="p-3 bg-amber-50 text-amber-700 rounded-xl">
                <Trophy className="w-5 h-5" />
              </div>
              <div className="truncate">
                <div className="text-xs text-slate-500 font-medium">সর্বোচ্চ মেধাক্রম (১ম)</div>
                <div className="text-sm font-bold text-amber-900 truncate">
                  {topStudent ? topStudent.student.nameBn : 'তথ্য নেই'}
                </div>
                {topStudent && (
                  <div className="text-[11px] text-slate-400">
                    রোল: {toBengaliRoll(topStudent.student.roll)} | GPA {toBengaliNumber(topStudent.gpa.toFixed(2))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {totalStudents === 0 ? (
            <div className="bg-white p-12 text-center rounded-xl border border-slate-200 text-slate-500 space-y-2">
              <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
              <p className="font-bold text-slate-700">এই শ্রেণিতে কোনো শিক্ষার্থীর ফলাফল পাওয়া যায়নি।</p>
              <p className="text-xs text-slate-400">
                অনুগ্রহ করে &quot;মার্ক এন্ট্রি&quot; মডিউল থেকে এই শ্রেণির নম্বর এন্ট্রি সম্পন্ন করুন।
              </p>
            </div>
          ) : (
            <>
              {/* Row 1: Pass Rate Donut & Grade Distribution */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Chart 1: Pass vs Fail Donut */}
                <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex flex-col justify-between">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 font-serif flex items-center">
                        <PieChartIcon className="w-4 h-4 mr-1.5 text-indigo-600" />
                        পাস বনাম ফেল অনুপাত ও শতকরা হার
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        মোট {toBengaliNumber(totalStudents)} জন পরীক্ষার্থীর ফলাফল বিন্যাস
                      </p>
                    </div>
                    <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-lg border border-emerald-200">
                      পাস {toBengaliNumber(passRate)}%
                    </span>
                  </div>

                  <div className="h-64 my-2 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={passFailData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={3}
                          label={({ name, percent }: any) =>
                            `${name || ''} (${(((percent as number) || 0) * 100).toFixed(0)}%)`
                          }
                        >
                          {passFailData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: any, name: any, item: any) => [
                            `${toBengaliNumber(value)} জন (${toBengaliNumber(item.payload.percentage)}%)`,
                            name,
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Centered KPI */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-2xl font-black text-slate-800 font-serif">
                        {toBengaliNumber(passRate)}%
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">পাসের হার</span>
                    </div>
                  </div>

                  {/* Summary legend footer */}
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
                    <div className="flex items-center space-x-2 bg-emerald-50/60 p-2 rounded-lg border border-emerald-100">
                      <div className="w-3 h-3 rounded-full bg-emerald-500" />
                      <div>
                        <div className="text-slate-500 text-[10px]">উত্তীর্ণ (Passed)</div>
                        <div className="font-bold text-emerald-800">
                          {toBengaliNumber(passedStudents)} জন ({toBengaliNumber(passRate)}%)
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 bg-rose-50/60 p-2 rounded-lg border border-rose-100">
                      <div className="w-3 h-3 rounded-full bg-rose-500" />
                      <div>
                        <div className="text-slate-500 text-[10px]">অনুত্তীর্ণ (Failed)</div>
                        <div className="font-bold text-rose-800">
                          {toBengaliNumber(failedStudents)} জন ({toBengaliNumber(failRate)}%)
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Chart 2: Grade Breakdown Bar Chart */}
                <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex flex-col justify-between">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 font-serif flex items-center">
                        <BarChart3 className="w-4 h-4 mr-1.5 text-blue-600" />
                        লেটার গ্রেড বিন্যাস (A+ থেকে F)
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        শিক্ষার্থীদের অর্জিত গ্রেড সংখ্যার গ্রাফিক্যাল চিত্র
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-slate-500">
                      A+ প্রাপ্ত: <strong className="text-emerald-600 font-bold">{toBengaliNumber(gradeDistributionData.find((g) => g.grade === 'A+')?.count || 0)}</strong> জন
                    </span>
                  </div>

                  <div className="h-64 my-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={gradeDistributionData} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="grade" stroke="#64748b" fontSize={11} tickLine={false} />
                        <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} tickLine={false} />
                        <Tooltip
                          formatter={(value: any, name: any, item: any) => [
                            `${toBengaliNumber(value)} জন (${toBengaliNumber(item.payload.percentage)}%)`,
                            'শিক্ষার্থী সংখ্যা',
                          ]}
                          labelFormatter={(label) => `গ্রেড: ${label}`}
                        />
                        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                          {gradeDistributionData.map((entry, index) => (
                            <Cell key={`grade-cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Quick grade mini pills */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5 pt-3 border-t border-slate-100 text-[11px]">
                    {gradeDistributionData.map((g) => (
                      <div key={g.grade} className="flex items-center space-x-1">
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block"
                          style={{ backgroundColor: g.fill }}
                        />
                        <span className="font-bold text-slate-700">{g.grade}:</span>
                        <span className="text-slate-500">{toBengaliNumber(g.count)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Row 2: Subject-Specific Averages & Mastery */}
              <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 font-serif flex items-center">
                      <BookOpen className="w-4 h-4 mr-2 text-indigo-600" />
                      বিষয়ভিত্তিক গড় নম্বর ও তুলনামূলক চিত্র
                    </h3>
                    <p className="text-xs text-slate-500">
                      কোন বিষয়ে শিক্ষার্থীরা কেমন করেছে এবং বিষয়ে সর্বোচ্চ নম্বর কত উঠেছে
                    </p>
                  </div>

                  {/* Highlights */}
                  <div className="flex items-center space-x-2 text-xs">
                    {bestSubject && (
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
                        ✨ সেরা বিষয়: <strong>{bestSubject.name}</strong> (গড় {toBengaliNumber(bestSubject.average)})
                      </span>
                    )}
                    {toughestSubject && (
                      <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-medium">
                        ⚠️ নজর প্রয়োজন: <strong>{toughestSubject.name}</strong> (গড় {toBengaliNumber(toughestSubject.average)})
                      </span>
                    )}
                  </div>
                </div>

                {/* Subject Average Bar Chart */}
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={subjectAveragesData} margin={{ top: 20, right: 20, left: -10, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="name"
                        stroke="#475569"
                        fontSize={11}
                        interval={0}
                        angle={-15}
                        textAnchor="end"
                        tickLine={false}
                      />
                      <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                      <Tooltip
                        formatter={(value: any, name: any) => [
                          toBengaliNumber(value),
                          name === 'average' ? 'গড় প্রাপ্ত নম্বর' : name === 'highest' ? 'সর্বোচ্চ নম্বর' : name,
                        ]}
                        labelFormatter={(label) => `বিষয়: ${label}`}
                      />
                      <Legend
                        verticalAlign="top"
                        align="right"
                        formatter={(value) => (value === 'average' ? 'শ্রেণির গড় নম্বর' : 'সর্বোচ্চ নম্বর')}
                      />
                      <Bar
                        dataKey="average"
                        name="average"
                        fill="#4f46e5"
                        radius={[4, 4, 0, 0]}
                        barSize={28}
                      />
                      <Bar
                        dataKey="highest"
                        name="highest"
                        fill="#10b981"
                        radius={[4, 4, 0, 0]}
                        barSize={28}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Subject Breakdown Detailed Grid Table */}
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">বিষয়</th>
                        <th className="py-2.5 px-3 text-center">পূর্ণমান</th>
                        <th className="py-2.5 px-3 text-center">গড় নম্বর</th>
                        <th className="py-2.5 px-3 text-center">সর্বোচ্চ</th>
                        <th className="py-2.5 px-3 text-center">সর্বনিম্ন</th>
                        <th className="py-2.5 px-3 text-center">পাসের হার (%)</th>
                        <th className="py-2.5 px-3">অবস্থা</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {subjectAveragesData.map((sub) => {
                        const pct = (sub.average / sub.fullMarks) * 100;
                        return (
                          <tr key={sub.id} className="hover:bg-slate-50/60">
                            <td className="py-2.5 px-3 font-semibold text-slate-800">{sub.name}</td>
                            <td className="py-2.5 px-3 text-center text-slate-600 font-mono">
                              {toBengaliNumber(sub.fullMarks)}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-indigo-700 font-mono">
                              {toBengaliNumber(sub.average)}
                            </td>
                            <td className="py-2.5 px-3 text-center text-emerald-700 font-bold font-mono">
                              {toBengaliNumber(sub.highest)}
                            </td>
                            <td className="py-2.5 px-3 text-center text-rose-600 font-mono">
                              {toBengaliNumber(sub.lowest)}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold font-mono">
                              <span
                                className={`px-2 py-0.5 rounded ${
                                  sub.passRate >= 80
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : sub.passRate >= 60
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'bg-rose-50 text-rose-700'
                                }`}
                              >
                                {toBengaliNumber(sub.passRate)}%
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden">
                                <div
                                  className={`h-full ${
                                    pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-500' : 'bg-amber-500'
                                  }`}
                                  style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Row 3: Score Range Brackets & Top Merit Rankers */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Score Range Distribution */}
                <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
                  <h3 className="text-sm font-bold text-slate-900 font-serif mb-1 flex items-center">
                    <Layers className="w-4 h-4 mr-1.5 text-purple-600" />
                    নম্বর রেঞ্জ বণ্টন (Score Brackets)
                  </h3>
                  <p className="text-[11px] text-slate-400 mb-4">
                    শতকরা নম্বরের ভিত্তিতে শিক্ষার্থীর অবস্থান
                  </p>

                  <div className="space-y-3">
                    {scoreBracketsData.map((b) => {
                      const pct = totalStudents > 0 ? (b.count / totalStudents) * 100 : 0;
                      return (
                        <div key={b.range} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-700">{b.range}</span>
                            <span className="font-mono text-slate-600">
                              {toBengaliNumber(b.count)} জন ({toBengaliNumber(pct.toFixed(0))}%)
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, backgroundColor: b.color }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Top 5 Merit Students Showcase */}
                <div className="lg:col-span-2 bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 font-serif flex items-center">
                          <Trophy className="w-4 h-4 mr-1.5 text-amber-500" />
                          শীর্ষ ৫ মেধাক্রম শিক্ষার্থী (Top 5 Rankers)
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          {currentClass.nameBn} - সর্বোচ্চ নম্বর ও জিপিএ প্রাপ্ত শিক্ষার্থী
                        </p>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                        মেধা তালিকা
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {topMeritStudents.map((res, idx) => {
                        const medalColors = ['#f59e0b', '#94a3b8', '#b45309', '#6366f1', '#6366f1'];
                        return (
                          <div
                            key={res.student.id}
                            className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:border-indigo-200 bg-slate-50/50 hover:bg-indigo-50/20 transition"
                          >
                            <div className="flex items-center space-x-3">
                              <div
                                className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-xs"
                                style={{ backgroundColor: medalColors[idx] || '#64748b' }}
                              >
                                {toBengaliOrdinal(idx + 1)}
                              </div>
                              <div>
                                <div className="text-xs font-bold text-slate-900">
                                  {res.student.nameBn}
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  রোল: {toBengaliRoll(res.student.roll)} | শাখা: {res.student.section || 'ক'}
                                </div>
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="text-xs font-bold text-indigo-700">
                                GPA {toBengaliNumber(res.gpa.toFixed(2))} ({res.overallGrade})
                              </div>
                              <div className="text-[11px] text-slate-500">
                                মোট: {toBengaliNumber(res.grandTotalObtained)} / {toBengaliNumber(res.totalFullMarks)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 mt-4 text-center">
                    বিস্তারিত প্রোগ্রেস কার্ড প্রিন্ট করতে &quot;একক রেজাল্ট কার্ড&quot; অথবা &quot;ট্যাবুল্যাশন শিট&quot; দেখুন।
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: CROSS-CLASS PERFORMANCE COMPARISON                             */}
      {/* ===================================================================== */}
      {activeTab === 'cross_class' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 font-serif flex items-center">
                  <Layers className="w-5 h-5 mr-2 text-emerald-600" />
                  শ্রেণিভিত্তিক পাসের হার ও পারফরম্যান্স তুলনা
                </h3>
                <p className="text-xs text-slate-500">
                  {currentExam.nameBn} ({selectedYear}) - বিদ্যালয়ের সকল শ্রেণির তুলনামূলক গ্রাফ
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-lg">
                মোট অন্তর্ভুক্ত শ্রেণি: {toBengaliNumber(crossClassData.length)} টি
              </span>
            </div>

            {/* Cross-Class Pass Rate Bar Chart */}
            <div className="h-80 my-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={crossClassData} margin={{ top: 20, right: 20, left: -10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="shortName"
                    stroke="#475569"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} domain={[0, 100]} />
                  <Tooltip
                    formatter={(value: any, name: any) => [
                      `${toBengaliNumber(value)}%`,
                      name === 'passRate' ? 'পাসের হার' : name,
                    ]}
                    labelFormatter={(label) => `শ্রেণি: ${label}`}
                  />
                  <Bar
                    dataKey="passRate"
                    name="passRate"
                    fill="#10b981"
                    radius={[6, 6, 0, 0]}
                    barSize={34}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Cross Class GPA Comparison Line Chart */}
            <div className="pt-6 border-t border-slate-100">
              <div className="mb-4">
                <h4 className="text-sm font-bold text-slate-800 font-serif">
                  শ্রেণিভিত্তিক গড় জিপিএ (Average GPA) তুলনা
                </h4>
                <p className="text-xs text-slate-400">প্রতিটি শ্রেণির শিক্ষার্থীদের সামগ্রিক গড় পয়েন্ট (০.০০ - ৫.০০)</p>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={crossClassData} margin={{ top: 10, right: 20, left: -10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="shortName" stroke="#64748b" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} domain={[0, 5]} tickLine={false} />
                    <Tooltip
                      formatter={(value: any) => [`GPA ${toBengaliNumber(value)}`, 'গড় জিপিএ']}
                      labelFormatter={(label) => `শ্রেণি: ${label}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="avgGpa"
                      stroke="#6366f1"
                      strokeWidth={3}
                      dot={{ r: 5, fill: '#4f46e5' }}
                      activeDot={{ r: 7 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Table Breakdown */}
            <div className="mt-6 overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">শ্রেণির নাম</th>
                    <th className="py-2.5 px-3 text-center">মোট শিক্ষার্থী</th>
                    <th className="py-2.5 px-3 text-center">উত্তীর্ণ</th>
                    <th className="py-2.5 px-3 text-center">অনুত্তীর্ণ</th>
                    <th className="py-2.5 px-3 text-center">গড় জিপিএ</th>
                    <th className="py-2.5 px-3 text-center">পাসের হার (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {crossClassData.map((c) => (
                    <tr key={c.classId} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{c.className}</td>
                      <td className="py-2.5 px-3 text-center font-mono">{toBengaliNumber(c.totalStudents)} জন</td>
                      <td className="py-2.5 px-3 text-center text-emerald-700 font-bold font-mono">
                        {toBengaliNumber(c.passedStudents)} জন
                      </td>
                      <td className="py-2.5 px-3 text-center text-rose-600 font-mono">
                        {toBengaliNumber(c.failedStudents)} জন
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-indigo-700 font-mono">
                        {toBengaliNumber(c.avgGpa.toFixed(2))}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold font-mono text-emerald-700">
                        {toBengaliNumber(c.passRate)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: EXAM TERM PERFORMANCE TRENDS                                   */}
      {/* ===================================================================== */}
      {activeTab === 'term_trends' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
            <div className="pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 font-serif flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-indigo-600" />
                সাময়িক পরীক্ষাভিত্তিক পারফরম্যান্স অগ্রগতি ও ট্রেন্ড ({currentClass.nameBn})
              </h3>
              <p className="text-xs text-slate-500">
                ১ম সাময়িক, ২য় সাময়িক ও বার্ষিক পরীক্ষার তুলনামূলক উন্নয়নের গ্রাফ
              </p>
            </div>

            {/* Line Trend Chart for Terms */}
            <div className="h-80 my-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={examTermTrendsData} margin={{ top: 20, right: 20, left: -10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="shortName" stroke="#475569" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} tickLine={false} />
                  <Tooltip
                    formatter={(value: any, name: any) => [
                      name === 'passRate' ? `${toBengaliNumber(value)}%` : toBengaliNumber(value),
                      name === 'passRate' ? 'পাসের হার' : 'গড় নম্বর',
                    ]}
                    labelFormatter={(label) => `পরীক্ষা: ${label}`}
                  />
                  <Legend verticalAlign="top" align="right" />
                  <Line
                    type="monotone"
                    dataKey="passRate"
                    name="passRate"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ r: 6, fill: '#059669' }}
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Term Summary Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
              {examTermTrendsData.map((term) => (
                <div key={term.termId} className="bg-slate-50/80 p-4 rounded-xl border border-slate-200 space-y-2">
                  <div className="text-xs font-bold text-slate-800">{term.termName}</div>
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-slate-500">পাসের হার:</span>
                    <span className="font-bold text-emerald-700">{toBengaliNumber(term.passRate)}%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">গড় জিপিএ:</span>
                    <span className="font-bold text-indigo-700">{toBengaliNumber(term.avgGpa.toFixed(2))}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">পরীক্ষার্থী:</span>
                    <span className="font-bold text-slate-700">{toBengaliNumber(term.totalStudents)} জন</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
