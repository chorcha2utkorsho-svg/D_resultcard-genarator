import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
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
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  Sparkles,
  ArrowRight,
  BarChart3,
  LineChart as LineChartIcon,
  Filter,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { toBengaliNumber } from '../utils/bengali';

interface PerformanceTrendPoint {
  examId: string;
  examName: string;
  shortName: string;
  totalStudents: number;
  evaluatedCount: number;
  passedCount: number;
  failedCount: number;
  passRate: number; // percentage e.g. 94.5
  avgGpa: number; // GPA out of 5.0
  avgTotalMarks: number; // raw total average marks
  avgPercentage: number; // percentage marks
  highestMarks: number;
  aPlusCount: number;
  hasData: boolean;
}

interface DashboardWidgetProps {
  onNavigate?: (tab: string) => void;
}

export const DashboardWidget: React.FC<DashboardWidgetProps> = ({ onNavigate }) => {
  const {
    classes,
    examTerms,
    selectedYear,
    selectedClassId,
    setSelectedClassId,
    selectedSection,
    setSelectedSection,
    getCalculatedResultsForClass,
  } = useSchool();

  // Metric to highlight: 'gpa' | 'passRate' | 'avgMarks'
  const [selectedMetric, setSelectedMetric] = useState<'gpa' | 'passRate' | 'avgMarks'>('gpa');
  // Chart type: 'area' | 'bar' | 'line'
  const [chartType, setChartType] = useState<'area' | 'bar' | 'line'>('area');
  // Target class selector: 'all_classes' or specific classId
  const [viewScope, setViewScope] = useState<'current_class' | 'cross_class'>('current_class');

  const currentClass = classes.find((c) => c.id === selectedClassId) || classes[0];

  // 1. Calculate multi-exam trend data for current selected class
  const examTrendsData: PerformanceTrendPoint[] = useMemo(() => {
    if (!currentClass) return [];

    return examTerms.map((term) => {
      const results = getCalculatedResultsForClass(
        selectedClassId,
        selectedSection,
        term.id,
        selectedYear
      );

      // Only evaluate students who have at least one marked subject
      const evaluatedResults = results.filter((r) =>
        r.subjectRows.some((sr) => sr.totalObtained !== null && sr.totalObtained !== undefined)
      );

      const totalStudents = results.length;
      const evaluatedCount = evaluatedResults.length;
      const passedCount = evaluatedResults.filter((r) => r.isPassed).length;
      const failedCount = evaluatedCount - passedCount;
      const passRate = evaluatedCount > 0
        ? Number(((passedCount / evaluatedCount) * 100).toFixed(1))
        : 0;

      const avgGpa = evaluatedCount > 0
        ? Number((evaluatedResults.reduce((sum, r) => sum + r.gpa, 0) / evaluatedCount).toFixed(2))
        : 0;

      const avgTotalMarks = evaluatedCount > 0
        ? Math.round(evaluatedResults.reduce((sum, r) => sum + r.grandTotalObtained, 0) / evaluatedCount)
        : 0;

      const avgPercentage = evaluatedCount > 0
        ? Number((evaluatedResults.reduce((sum, r) => sum + r.averageMarks, 0) / evaluatedCount).toFixed(1))
        : 0;

      const highestMarks = evaluatedCount > 0
        ? Math.max(...evaluatedResults.map((r) => r.grandTotalObtained))
        : 0;

      const aPlusCount = evaluatedResults.filter((r) => r.overallGrade === 'A+').length;

      const shortName = term.nameBn
        .replace(' পরীক্ষা', '')
        .replace(' সাময়িক', ' সাময়িক')
        .replace('টিউটোরিয়াল', 'টিউটোরিয়াল');

      return {
        examId: term.id,
        examName: term.nameBn,
        shortName,
        totalStudents,
        evaluatedCount,
        passedCount,
        failedCount,
        passRate,
        avgGpa,
        avgTotalMarks,
        avgPercentage,
        highestMarks,
        aPlusCount,
        hasData: evaluatedCount > 0,
      };
    });
  }, [
    currentClass,
    examTerms,
    getCalculatedResultsForClass,
    selectedClassId,
    selectedSection,
    selectedYear,
  ]);

  // Active trend points with data
  const termsWithData = examTrendsData.filter((t) => t.hasData);
  const latestTerm = termsWithData[termsWithData.length - 1] || examTrendsData[0];
  const previousTerm = termsWithData.length > 1 ? termsWithData[termsWithData.length - 2] : null;

  // Calculate delta/change between latest and previous exam
  const gpaDelta = previousTerm && latestTerm && latestTerm.hasData && previousTerm.hasData
    ? Number((latestTerm.avgGpa - previousTerm.avgGpa).toFixed(2))
    : 0;

  const passRateDelta = previousTerm && latestTerm && latestTerm.hasData && previousTerm.hasData
    ? Number((latestTerm.passRate - previousTerm.passRate).toFixed(1))
    : 0;

  // 2. Cross-Class comparison data across recent terms
  const crossClassSummary = useMemo(() => {
    return classes.map((cls) => {
      // Find results for first available exam with data
      const defaultExamId = 'term_2';
      const results = getCalculatedResultsForClass(cls.id, '', defaultExamId, selectedYear);
      const evaluated = results.filter((r) =>
        r.subjectRows.some((sr) => sr.totalObtained !== null && sr.totalObtained !== undefined)
      );

      const passCount = evaluated.filter((r) => r.isPassed).length;
      const pRate = evaluated.length > 0
        ? Number(((passCount / evaluated.length) * 100).toFixed(1))
        : 0;

      const gpa = evaluated.length > 0
        ? Number((evaluated.reduce((s, r) => s + r.gpa, 0) / evaluated.length).toFixed(2))
        : 0;

      return {
        classId: cls.id,
        className: cls.nameBn.replace(' শ্রেণি', ''),
        total: results.length,
        evaluated: evaluated.length,
        passRate: pRate,
        avgGpa: gpa,
        hasData: evaluated.length > 0,
      };
    }).filter((c) => c.hasData);
  }, [classes, getCalculatedResultsForClass, selectedYear]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {/* Header Bar */}
      <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>পারফরম্যান্স ট্রেন্ড অ্যানালিটিক্স (Recharts)</span>
          </div>
          <h3 className="text-lg sm:text-xl font-bold font-serif tracking-tight text-white flex items-center gap-2">
            সাম্প্রতিক পরীক্ষার ফলাফল ও অগ্রগতির চিত্র
          </h3>
          <p className="text-xs text-indigo-200">
            শিক্ষাবর্ষ {toBengaliNumber(selectedYear)} • বিভিন্ন সাময়িক ও টিউটোরিয়াল পরীক্ষায় শিক্ষার্থীদের ধারাবাহিক মূল্যায়ন
          </p>
        </div>

        {/* Action Controls & Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Class Selector Dropdown */}
          <div className="relative">
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="appearance-none bg-indigo-900/90 hover:bg-indigo-800 text-white text-xs font-semibold pl-3 pr-8 py-2 rounded-xl border border-indigo-700/60 shadow-xs focus:outline-hidden focus:ring-2 focus:ring-amber-400 cursor-pointer"
            >
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id} className="bg-slate-900 text-white">
                  {cls.nameBn}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-indigo-300 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Metric Selector Buttons */}
          <div className="inline-flex p-1 bg-slate-950/60 rounded-xl border border-indigo-800/60 text-xs">
            <button
              onClick={() => setSelectedMetric('gpa')}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1 ${
                selectedMetric === 'gpa'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'text-indigo-200 hover:text-white'
              }`}
            >
              <Award className="w-3 h-3" />
              গড় GPA
            </button>
            <button
              onClick={() => setSelectedMetric('passRate')}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1 ${
                selectedMetric === 'passRate'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'text-indigo-200 hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              পাস হার %
            </button>
            <button
              onClick={() => setSelectedMetric('avgMarks')}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1 ${
                selectedMetric === 'avgMarks'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'text-indigo-200 hover:text-white'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              গড় নম্বর
            </button>
          </div>

          {/* Chart View Type: Area / Bar / Line */}
          <div className="hidden sm:inline-flex p-1 bg-slate-950/60 rounded-xl border border-indigo-800/60 text-xs">
            <button
              title="এরিয়া চার্ট"
              onClick={() => setChartType('area')}
              className={`p-1.5 rounded-lg transition ${
                chartType === 'area' ? 'bg-indigo-600 text-white' : 'text-indigo-300 hover:text-white'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
            </button>
            <button
              title="বার চার্ট"
              onClick={() => setChartType('bar')}
              className={`p-1.5 rounded-lg transition ${
                chartType === 'bar' ? 'bg-indigo-600 text-white' : 'text-indigo-300 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
            </button>
            <button
              title="লাইন চার্ট"
              onClick={() => setChartType('line')}
              className={`p-1.5 rounded-lg transition ${
                chartType === 'line' ? 'bg-indigo-600 text-white' : 'text-indigo-300 hover:text-white'
              }`}
            >
              <LineChartIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 sm:p-5 bg-slate-50 border-b border-slate-100">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
            <span>নির্বাচিত শ্রেণি</span>
            <GraduationCap className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <div className="text-base sm:text-lg font-bold text-slate-900 mt-1 font-serif">
            {currentClass?.nameBn}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            মোট ছাত্র/ছাত্রী: {toBengaliNumber(currentClass ? examTrendsData[0]?.totalStudents || 0 : 0)} জন
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
            <span>সর্বশেষ পরীক্ষার গড় GPA</span>
            <Award className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-base sm:text-lg font-bold text-slate-900 mt-1 font-serif flex items-center gap-1.5">
            <span>{toBengaliNumber(latestTerm ? latestTerm.avgGpa.toFixed(2) : '0.00')}</span>
            <span className="text-xs font-normal text-slate-500">/ ৫.০০</span>
            {gpaDelta !== 0 && (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  gpaDelta > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}
              >
                {gpaDelta > 0 ? `+${toBengaliNumber(gpaDelta)}` : toBengaliNumber(gpaDelta)}
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 truncate">
            {latestTerm?.examName}
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
            <span>সর্বশেষ পাসের হার</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-base sm:text-lg font-bold text-slate-900 mt-1 font-serif flex items-center gap-1.5">
            <span>{toBengaliNumber(latestTerm ? latestTerm.passRate : 0)}%</span>
            {passRateDelta !== 0 && (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  passRateDelta > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}
              >
                {passRateDelta > 0 ? `+${toBengaliNumber(passRateDelta)}%` : `${toBengaliNumber(passRateDelta)}%`}
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            উত্তীর্ণ: {toBengaliNumber(latestTerm?.passedCount || 0)} জন
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
            <span>A+ প্রাপ্ত শিক্ষার্থী</span>
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
          </div>
          <div className="text-base sm:text-lg font-bold text-slate-900 mt-1 font-serif">
            {toBengaliNumber(latestTerm?.aPlusCount || 0)} জন
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            সর্বোচ্চ নম্বর: {toBengaliNumber(latestTerm?.highestMarks || 0)}
          </div>
        </div>
      </div>

      {/* Main Chart Section */}
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse"></span>
            <span className="text-xs font-bold text-slate-700">
              {selectedMetric === 'gpa' && 'পরীক্ষাভিত্তিক গড় জিপিএ (GPA) ট্রেন্ড লাইন'}
              {selectedMetric === 'passRate' && 'পরীক্ষাভিত্তিক পাসের হার শতকরা (%) গ্রাফ'}
              {selectedMetric === 'avgMarks' && 'পরীক্ষাভিত্তিক মোট গড় নম্বর অগ্রগতি'}
            </span>
            <span className="text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
              {currentClass?.nameBn}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 text-slate-600">
              <span className="w-3 h-3 rounded-full bg-indigo-600"></span>
              <span>মূল্যায়নকৃত গড়</span>
            </div>
            {selectedMetric === 'passRate' && (
              <div className="flex items-center gap-1.5 text-slate-600">
                <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                <span>লক্ষ্যমাত্রা (৮০%+)</span>
              </div>
            )}
          </div>
        </div>

        {/* Recharts Container */}
        <div className="w-full h-72">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'area' ? (
              <AreaChart
                data={examTrendsData}
                margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="widgetColorIndigo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="widgetColorEmerald" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="shortName"
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis
                  domain={
                    selectedMetric === 'gpa'
                      ? [0, 5.0]
                      : selectedMetric === 'passRate'
                      ? [0, 100]
                      : ['dataMin - 50', 'dataMax + 50']
                  }
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickFormatter={(val) => toBengaliNumber(val)}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as PerformanceTrendPoint;
                      return (
                        <div className="bg-slate-900 text-white text-xs rounded-xl p-3.5 shadow-xl border border-slate-700 space-y-1.5 min-w-[200px]">
                          <div className="font-bold text-amber-300 border-b border-slate-700 pb-1 flex items-center justify-between">
                            <span>{data.examName}</span>
                            <span className="text-[10px] text-slate-400">{currentClass?.nameBn}</span>
                          </div>
                          <div className="flex justify-between items-center text-indigo-200">
                            <span>গড় জিপিএ (GPA):</span>
                            <span className="font-bold text-white text-sm">
                              {toBengaliNumber(data.avgGpa.toFixed(2))}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-emerald-300">
                            <span>পাসের হার:</span>
                            <span className="font-bold">
                              {toBengaliNumber(data.passRate)}% ({toBengaliNumber(data.passedCount)}/{toBengaliNumber(data.evaluatedCount)})
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-amber-200">
                            <span>গড় মোট নম্বর:</span>
                            <span className="font-bold">{toBengaliNumber(data.avgTotalMarks)}</span>
                          </div>
                          <div className="flex justify-between items-center text-purple-300">
                            <span>A+ প্রাপ্ত:</span>
                            <span className="font-bold">{toBengaliNumber(data.aPlusCount)} জন</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey={
                    selectedMetric === 'gpa'
                      ? 'avgGpa'
                      : selectedMetric === 'passRate'
                      ? 'passRate'
                      : 'avgTotalMarks'
                  }
                  name="পারফরম্যান্স"
                  stroke="#4f46e5"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#widgetColorIndigo)"
                  activeDot={{ r: 6, stroke: '#4f46e5', strokeWidth: 2, fill: '#ffffff' }}
                />
              </AreaChart>
            ) : chartType === 'bar' ? (
              <BarChart
                data={examTrendsData}
                margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="shortName"
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis
                  domain={
                    selectedMetric === 'gpa'
                      ? [0, 5.0]
                      : selectedMetric === 'passRate'
                      ? [0, 100]
                      : ['auto', 'auto']
                  }
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickFormatter={(val) => toBengaliNumber(val)}
                />
                <Tooltip
                  formatter={(val: any) => [toBengaliNumber(val), 'মান']}
                  labelFormatter={(lbl) => `${lbl} (${currentClass?.nameBn})`}
                />
                <Bar
                  dataKey={
                    selectedMetric === 'gpa'
                      ? 'avgGpa'
                      : selectedMetric === 'passRate'
                      ? 'passRate'
                      : 'avgTotalMarks'
                  }
                  fill="#4f46e5"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            ) : (
              <LineChart
                data={examTrendsData}
                margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="shortName"
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis
                  domain={
                    selectedMetric === 'gpa'
                      ? [0, 5.0]
                      : selectedMetric === 'passRate'
                      ? [0, 100]
                      : ['auto', 'auto']
                  }
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickFormatter={(val) => toBengaliNumber(val)}
                />
                <Tooltip
                  formatter={(val: any) => [toBengaliNumber(val), 'মান']}
                  labelFormatter={(lbl) => `${lbl} (${currentClass?.nameBn})`}
                />
                <Line
                  type="monotone"
                  dataKey={
                    selectedMetric === 'gpa'
                      ? 'avgGpa'
                      : selectedMetric === 'passRate'
                      ? 'passRate'
                      : 'avgTotalMarks'
                  }
                  stroke="#4f46e5"
                  strokeWidth={3}
                  dot={{ r: 5, fill: '#4f46e5' }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Exam comparison badges */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {examTrendsData.map((term) => (
              <div
                key={term.examId}
                className={`px-3 py-1.5 rounded-lg border text-xs flex items-center gap-2 ${
                  term.hasData
                    ? 'bg-slate-50 border-slate-200 text-slate-800'
                    : 'bg-slate-50/50 border-dashed border-slate-200 text-slate-400'
                }`}
              >
                <span className="font-semibold">{term.shortName}:</span>
                {term.hasData ? (
                  <span className="font-bold text-indigo-700">
                    GPA {toBengaliNumber(term.avgGpa.toFixed(2))} • {toBengaliNumber(term.passRate)}% পাস
                  </span>
                ) : (
                  <span className="italic text-[11px] text-slate-400">মার্ক এন্ট্রি বাকি</span>
                )}
              </div>
            ))}
          </div>

          {onNavigate && (
            <button
              onClick={() => onNavigate('results')}
              className="inline-flex items-center text-xs font-bold text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
            >
              বিস্তারিত বিশ্লেষণ ও কার্ড দেখুন <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
