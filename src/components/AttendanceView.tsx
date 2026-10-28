import React, { useState, useMemo } from 'react';
import {
  CalendarCheck,
  Calendar,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Printer,
  Download,
  RefreshCw,
  Search,
  Sparkles,
  Send,
  Save,
  FileSpreadsheet,
  TrendingUp,
  Award,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Info,
  PhoneCall,
  UserCheck,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { AttendanceStatus } from '../types';
import { toBengaliNumber, toBengaliRoll } from '../utils/bengali';
import { generateAbsenceSMS, isValidBDMobile, formatPhoneNumber } from '../utils/smsHelper';
import { SchoolLogo } from './SchoolLogo';

const BENGALI_MONTHS = [
  { value: 1, name: 'জানুয়ারি' },
  { value: 2, name: 'ফেব্রুয়ারি' },
  { value: 3, name: 'মার্চ' },
  { value: 4, name: 'এপ্রিল' },
  { value: 5, name: 'মে' },
  { value: 6, name: 'জুন' },
  { value: 7, name: 'জুলাই' },
  { value: 8, name: 'আগস্ট' },
  { value: 9, name: 'সেপ্টেম্বর' },
  { value: 10, name: 'অক্টোবর' },
  { value: 11, name: 'নভেম্বর' },
  { value: 12, name: 'ডিসেম্বর' },
];

export const AttendanceView: React.FC<{ onNavigateToResults?: () => void }> = ({ onNavigateToResults }) => {
  const {
    schoolInfo,
    classes,
    students,
    examTerms,
    selectedClassId,
    setSelectedClassId,
    selectedSection,
    setSelectedSection,
    selectedYear,
    setSelectedYear,
    selectedExamId,
    setSelectedExamId,
    attendanceRecords,
    saveDailyAttendance,
    getDailyAttendance,
    getMonthlyAttendance,
    calculateStudentAttendanceMetrics,
    syncAttendanceToExamRecords,
    sendSingleSMS,
    sendBatchSMS,
  } = useSchool();

  // Active view tab inside Attendance Module
  const [activeTab, setActiveTab] = useState<'daily' | 'monthly' | 'progress_metrics'>('daily');

  // Daily attendance state
  const todayStr = useMemo(() => {
    const d = new Date();
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${day}`;
  }, []);

  const [attendanceDate, setAttendanceDate] = useState<string>('2026-09-24'); // default to current mock/app date or today
  const [dailyStatusMap, setDailyStatusMap] = useState<Record<string, { status: AttendanceStatus; remarks: string }>>({});
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Monthly report state
  const [reportMonth, setReportMonth] = useState<number>(9); // September by default
  const [reportYear, setReportYear] = useState<string>('২০২৬');

  // Progress card sync state
  const [customWorkingDays, setCustomWorkingDays] = useState<number>(120);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Absent SMS modal state
  const [smsModalOpen, setSmsModalOpen] = useState<boolean>(false);
  const [selectedAbsentStudents, setSelectedAbsentStudents] = useState<string[]>([]);
  const [smsSending, setSmsSending] = useState<boolean>(false);
  const [smsFeedback, setSmsFeedback] = useState<string | null>(null);

  // Current selected class object
  const currentClass = useMemo(() => {
    return classes.find((c) => c.id === selectedClassId) || classes[0];
  }, [classes, selectedClassId]);

  // Students belonging to current selected class & section
  const currentStudents = useMemo(() => {
    return students
      .filter((s) => s.classId === selectedClassId && (!selectedSection || s.section === selectedSection))
      .sort((a, b) => a.roll - b.roll);
  }, [students, selectedClassId, selectedSection]);

  // Load existing daily attendance when date, class, or section changes
  React.useEffect(() => {
    const existing = getDailyAttendance(selectedClassId, selectedSection, attendanceDate);
    const initialMap: Record<string, { status: AttendanceStatus; remarks: string }> = {};

    currentStudents.forEach((std) => {
      const rec = existing?.records[std.id];
      initialMap[std.id] = {
        status: rec?.status || 'present',
        remarks: rec?.remarks || '',
      };
    });

    setDailyStatusMap(initialMap);
  }, [selectedClassId, selectedSection, attendanceDate, currentStudents, attendanceRecords]);

  // Filtered students for daily table search
  const filteredStudents = useMemo(() => {
    if (!searchFilter.trim()) return currentStudents;
    const q = searchFilter.toLowerCase();
    return currentStudents.filter(
      (s) =>
        s.nameBn.toLowerCase().includes(q) ||
        (s.nameEn && s.nameEn.toLowerCase().includes(q)) ||
        s.roll.toString().includes(q) ||
        (s.guardianPhone && s.guardianPhone.includes(q))
    );
  }, [currentStudents, searchFilter]);

  // Daily statistics
  const dailyStats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let leave = 0;

    currentStudents.forEach((std) => {
      const entry = dailyStatusMap[std.id];
      if (entry) {
        if (entry.status === 'present') present++;
        else if (entry.status === 'absent') absent++;
        else if (entry.status === 'late') late++;
        else if (entry.status === 'leave') leave++;
      } else {
        present++;
      }
    });

    const total = currentStudents.length;
    const rate = total > 0 ? parseFloat((((present + late) / total) * 100).toFixed(1)) : 0;

    return { total, present, absent, late, leave, rate };
  }, [currentStudents, dailyStatusMap]);

  // Quick mark all actions
  const handleMarkAll = (status: AttendanceStatus) => {
    setDailyStatusMap((prev) => {
      const next = { ...prev };
      currentStudents.forEach((std) => {
        next[std.id] = {
          status,
          remarks: next[std.id]?.remarks || '',
        };
      });
      return next;
    });
  };

  // Change single student status
  const handleSetStudentStatus = (studentId: string, status: AttendanceStatus) => {
    setDailyStatusMap((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status,
        remarks: prev[studentId]?.remarks || '',
      },
    }));
  };

  // Change single student remarks
  const handleSetStudentRemarks = (studentId: string, remarks: string) => {
    setDailyStatusMap((prev) => ({
      ...prev,
      [studentId]: {
        status: prev[studentId]?.status || 'present',
        remarks,
      },
    }));
  };

  // Save daily attendance
  const handleSaveDaily = () => {
    saveDailyAttendance(selectedClassId, selectedSection, attendanceDate, selectedYear, dailyStatusMap);
    setSaveSuccessMsg('হাজিরা সফলভাবে ডাটাবেসে সংরক্ষিত হয়েছে!');
    setTimeout(() => {
      setSaveSuccessMsg(null);
    }, 3500);
  };

  // Date increment/decrement
  const handleShiftDate = (days: number) => {
    const cur = new Date(attendanceDate);
    cur.setDate(cur.getDate() + days);
    const yr = cur.getFullYear();
    const mo = String(cur.getMonth() + 1).padStart(2, '0');
    const day = String(cur.getDate()).padStart(2, '0');
    setAttendanceDate(`${yr}-${mo}-${day}`);
  };

  // Monthly Report Data
  const monthlyData = useMemo(() => {
    return getMonthlyAttendance(selectedClassId, selectedSection, reportYear, reportMonth);
  }, [getMonthlyAttendance, selectedClassId, selectedSection, reportYear, reportMonth, attendanceRecords, students]);

  // Absent students for today
  const absentStudentsList = useMemo(() => {
    return currentStudents.filter((s) => dailyStatusMap[s.id]?.status === 'absent');
  }, [currentStudents, dailyStatusMap]);

  // Open Absentee SMS Dialog
  const handleOpenAbsentSMS = () => {
    setSelectedAbsentStudents(absentStudentsList.map((s) => s.id));
    setSmsModalOpen(true);
  };

  // Send Absence SMS
  const handleSendAbsentSMS = async () => {
    const targets = absentStudentsList.filter((s) => selectedAbsentStudents.includes(s.id));
    if (targets.length === 0) return;

    setSmsSending(true);
    setSmsFeedback(null);

    const items = targets.map((std) => ({
      phone: std.guardianPhone || '',
      text: generateAbsenceSMS(std.nameBn, std.roll, currentClass.nameBn, attendanceDate, schoolInfo.name),
      recipientName: `${std.nameBn} (অভিভাবক)`,
      roll: std.roll,
      className: currentClass.nameBn,
    }));

    try {
      const result = await sendBatchSMS(items, 'attendance');
      setSmsFeedback(`সফলভাবে ${result.sentCount} জন অভিভাবককে অনুপস্থিতি নোটিফিকেশন পাঠানো হয়েছে!`);
      setTimeout(() => {
        setSmsModalOpen(false);
        setSmsFeedback(null);
      }, 2500);
    } catch {
      setSmsFeedback('এসএমএস প্রেরণে ত্রুটি ঘটেছে।');
    } finally {
      setSmsSending(false);
    }
  };

  // Sync Attendance to Progress Cards
  const handleSyncToProgressCards = () => {
    const res = syncAttendanceToExamRecords(selectedClassId, selectedExamId, selectedYear, customWorkingDays);
    setSyncFeedback(`সফলভাবে ${toBengaliNumber(res.updatedCount)} জন শিক্ষার্থীর প্রোগ্রেস কার্ডে হাজিরা ও কর্মদিবস হালনাগাদ করা হয়েছে!`);
    setTimeout(() => {
      setSyncFeedback(null);
    }, 4500);
  };

  // Print function
  const handlePrint = () => {
    window.print();
  };

  // Export Monthly CSV
  const handleExportCSV = () => {
    const header = ['রোল', 'নাম', 'মোট কর্মদিবস', 'উপস্থিতি', 'অনুপস্থিতি', 'দেরিতে', 'ছুটি', 'উপস্থিতির হার (%)'];
    const rows = monthlyData.summaries.map((s) => [
      s.student.roll,
      `"${s.student.nameBn}"`,
      s.totalWorkingDays,
      s.presentDays,
      s.absentDays,
      s.lateDays,
      s.leaveDays,
      `${s.percentage}%`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [header.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `attendance_${currentClass.nameBn}_${BENGALI_MONTHS.find((m) => m.value === reportMonth)?.name}_${reportYear}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* MODULE HEADER BAR */}
      <div className="no-print bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-md">
              <CalendarCheck className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-800 font-serif">
                  ডিজিটাল শিক্ষার্থী হাজিরা ও উপস্থিতি ব্যবস্থাপনা
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <UserCheck className="w-3.5 h-3.5 mr-1" /> স্মার্ট হাজিরা
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500">
                দৈনিক ডিজিটাল হাজিরা এন্ট্রি, মাসিক উপস্থিতি শিট এবং প্রোগ্রেস কার্ডের স্বয়ংক্রিয় পারফরম্যান্স মেট্রিক্স
              </p>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab('daily')}
              className={`inline-flex items-center px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition ${
                activeTab === 'daily'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Calendar className="w-4 h-4 mr-1.5 text-emerald-600" />
              দৈনিক হাজিরা এন্ট্রি
            </button>
            <button
              onClick={() => setActiveTab('monthly')}
              className={`inline-flex items-center px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition ${
                activeTab === 'monthly'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 mr-1.5 text-indigo-600" />
              মাসিক হাজিরা শিট ও রিপোর্ট
            </button>
            <button
              onClick={() => setActiveTab('progress_metrics')}
              className={`inline-flex items-center px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition ${
                activeTab === 'progress_metrics'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <TrendingUp className="w-4 h-4 mr-1.5 text-amber-300" />
              প্রোগ্রেস কার্ড পারফরম্যান্স মেট্রিক্স
            </button>
          </div>
        </div>

        {/* Global Class & Academic Filters */}
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">শ্রেণি নির্বাচন:</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.nameBn} ({cls.nameEn})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">শাখা (Section):</label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="ক">শাখা - ক</option>
              <option value="খ">শাখা - খ</option>
              <option value="গ">শাখা - গ</option>
              <option value="">সকল শাখা</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">শিক্ষাবর্ষ:</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="২০২৬">২০২৬ শিক্ষাবর্ষ</option>
              <option value="২০২৫">২০২৫ শিক্ষাবর্ষ</option>
              <option value="২০২৪">২০২৪ শিক্ষাবর্ষ</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">পরীক্ষার টার্ম (প্রোগ্রেস সিঙ্ক):</label>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              {examTerms.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.nameBn}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* SUCCESS TOASTS */}
      {saveSuccessMsg && (
        <div className="no-print bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-xl flex items-center justify-between text-emerald-800 shadow-sm animate-fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span className="font-bold text-sm">{saveSuccessMsg}</span>
          </div>
          <button onClick={() => setSaveSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-900 text-xs font-bold">
            বন্ধ করুন ✕
          </button>
        </div>
      )}

      {syncFeedback && (
        <div className="no-print bg-indigo-50 border-l-4 border-indigo-500 p-4 rounded-xl flex items-center justify-between text-indigo-800 shadow-sm animate-fade-in">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-indigo-600 flex-shrink-0" />
            <span className="font-bold text-sm">{syncFeedback}</span>
          </div>
          <div className="flex items-center space-x-2">
            {onNavigateToResults && (
              <button
                onClick={onNavigateToResults}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
              >
                কার্ড দেখুন →
              </button>
            )}
            <button onClick={() => setSyncFeedback(null)} className="text-indigo-600 hover:text-indigo-900 text-xs font-bold">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: DAILY ATTENDANCE MARKING */}
      {/* ========================================================================= */}
      {activeTab === 'daily' && (
        <div className="space-y-6">
          {/* Daily Date Controller & Action Bar */}
          <div className="no-print bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Date Navigation */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleShiftDate(-1)}
                  title="পূর্ববর্তী দিন"
                  className="p-2 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 transition"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <div className="flex items-center space-x-2 bg-emerald-50/80 border border-emerald-300 px-3 py-1.5 rounded-xl">
                  <Calendar className="w-4 h-4 text-emerald-700" />
                  <input
                    type="date"
                    value={attendanceDate}
                    onChange={(e) => setAttendanceDate(e.target.value)}
                    className="bg-transparent text-sm font-bold text-emerald-950 focus:outline-none cursor-pointer"
                  />
                </div>

                <button
                  onClick={() => handleShiftDate(1)}
                  title="পরবর্তী দিন"
                  className="p-2 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 transition"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>

                <button
                  onClick={() => setAttendanceDate(todayStr)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition"
                >
                  আজকের তারিখ
                </button>
              </div>

              {/* Quick Bulk Actions & Save */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleMarkAll('present')}
                  className="inline-flex items-center px-3 py-2 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 transition shadow-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                  সকলকে উপস্থিত
                </button>

                <button
                  onClick={() => handleMarkAll('absent')}
                  className="inline-flex items-center px-3 py-2 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-300 hover:bg-rose-100 transition shadow-xs"
                >
                  <XCircle className="w-3.5 h-3.5 mr-1 text-rose-600" />
                  সকলকে অনুপস্থিত
                </button>

                {absentStudentsList.length > 0 && (
                  <button
                    onClick={handleOpenAbsentSMS}
                    className="inline-flex items-center px-3 py-2 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-sm transition"
                  >
                    <Send className="w-3.5 h-3.5 mr-1" />
                    অনুপস্থিত এসএমএস ({toBengaliNumber(absentStudentsList.length)})
                  </button>
                )}

                <button
                  onClick={handleSaveDaily}
                  className="inline-flex items-center px-5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition"
                >
                  <Save className="w-4 h-4 mr-1.5" />
                  হাজিরা সংরক্ষণ করুন
                </button>
              </div>
            </div>

            {/* Daily Summary Metric Cards */}
            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">মোট শিক্ষার্থী</span>
                <span className="text-xl font-black text-slate-800">{toBengaliNumber(dailyStats.total)} জন</span>
              </div>
              <div className="bg-emerald-50/80 p-3 rounded-xl border border-emerald-200">
                <span className="text-[11px] font-bold text-emerald-700 uppercase block">উপস্থিত</span>
                <span className="text-xl font-black text-emerald-700">{toBengaliNumber(dailyStats.present)} জন</span>
              </div>
              <div className="bg-rose-50/80 p-3 rounded-xl border border-rose-200">
                <span className="text-[11px] font-bold text-rose-700 uppercase block">অনুপস্থিত</span>
                <span className="text-xl font-black text-rose-700">{toBengaliNumber(dailyStats.absent)} জন</span>
              </div>
              <div className="bg-amber-50/80 p-3 rounded-xl border border-amber-200">
                <span className="text-[11px] font-bold text-amber-700 uppercase block">দেরিতে (Late)</span>
                <span className="text-xl font-black text-amber-700">{toBengaliNumber(dailyStats.late)} জন</span>
              </div>
              <div className="bg-sky-50/80 p-3 rounded-xl border border-sky-200">
                <span className="text-[11px] font-bold text-sky-700 uppercase block">ছুটি (Leave)</span>
                <span className="text-xl font-black text-sky-700">{toBengaliNumber(dailyStats.leave)} জন</span>
              </div>
              <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-3 rounded-xl border border-indigo-200">
                <span className="text-[11px] font-bold text-indigo-700 uppercase block">আজকের উপস্থিতি</span>
                <span className="text-xl font-black text-indigo-800">{toBengaliNumber(dailyStats.rate)}%</span>
              </div>
            </div>
          </div>

          {/* Daily Student List Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Table Search & Title Header */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                  {currentClass.nameBn} - শিক্ষার্থী হাজিরা তালিকা ({toBengaliNumber(currentStudents.length)} জন)
                </h3>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="নাম বা রোল দিয়ে খুঁজুন..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Students Table */}
            {filteredStudents.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                এই শ্রেণি বা ফিল্টারে কোনো শিক্ষার্থী পাওয়া যায়নি। &quot;শিক্ষার্থী তথ্য&quot; থেকে শিক্ষার্থী যোগ করুন।
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4 text-center w-16">রোল</th>
                      <th className="py-3 px-4">শিক্ষার্থীর নাম</th>
                      <th className="py-3 px-4 text-center">অভিভাবকের ফোন</th>
                      <th className="py-3 px-4 text-center w-72">উপস্থিতির স্থিতি (Status)</th>
                      <th className="py-3 px-4">মন্তব্য / কারণ</th>
                      <th className="py-3 px-4 text-center w-28">এসএমএস</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStudents.map((student) => {
                      const entry = dailyStatusMap[student.id] || { status: 'present', remarks: '' };
                      const isAbsent = entry.status === 'absent';
                      const isLate = entry.status === 'late';
                      const isLeave = entry.status === 'leave';

                      return (
                        <tr
                          key={student.id}
                          className={`hover:bg-slate-50/80 transition ${
                            isAbsent
                              ? 'bg-rose-50/30'
                              : isLate
                              ? 'bg-amber-50/30'
                              : isLeave
                              ? 'bg-sky-50/30'
                              : ''
                          }`}
                        >
                          {/* Roll */}
                          <td className="py-3 px-4 text-center font-bold text-slate-800">
                            <span className="inline-block px-2.5 py-1 bg-slate-100 rounded-lg text-xs font-mono font-bold">
                              {toBengaliRoll(student.roll)}
                            </span>
                          </td>

                          {/* Name & Gender */}
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-800 text-sm">{student.nameBn}</div>
                            <div className="text-[11px] text-slate-500 flex items-center space-x-2">
                              <span>{student.nameEn}</span>
                              <span>•</span>
                              <span className="text-slate-600">{student.gender || 'শিক্ষার্থী'}</span>
                            </div>
                          </td>

                          {/* Guardian Phone */}
                          <td className="py-3 px-4 text-center">
                            {student.guardianPhone ? (
                              <span className="text-xs font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                                {student.guardianPhone}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">দেওয়া নেই</span>
                            )}
                          </td>

                          {/* Status Toggles */}
                          <td className="py-3 px-4 text-center">
                            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 space-x-1">
                              {/* Present */}
                              <button
                                type="button"
                                onClick={() => handleSetStudentStatus(student.id, 'present')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center ${
                                  entry.status === 'present'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50'
                                }`}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                উপস্থিত
                              </button>

                              {/* Absent */}
                              <button
                                type="button"
                                onClick={() => handleSetStudentStatus(student.id, 'absent')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center ${
                                  entry.status === 'absent'
                                    ? 'bg-rose-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-rose-700 hover:bg-rose-50'
                                }`}
                              >
                                <XCircle className="w-3.5 h-3.5 mr-1" />
                                অনুপস্থিত
                              </button>

                              {/* Late */}
                              <button
                                type="button"
                                onClick={() => handleSetStudentStatus(student.id, 'late')}
                                className={`px-2 py-1 rounded-lg text-xs font-bold transition flex items-center ${
                                  entry.status === 'late'
                                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                                    : 'text-slate-600 hover:text-amber-700 hover:bg-amber-50'
                                }`}
                              >
                                <Clock className="w-3.5 h-3.5 mr-0.5" />
                                দেরিতে
                              </button>

                              {/* Leave */}
                              <button
                                type="button"
                                onClick={() => handleSetStudentStatus(student.id, 'leave')}
                                className={`px-2 py-1 rounded-lg text-xs font-bold transition flex items-center ${
                                  entry.status === 'leave'
                                    ? 'bg-sky-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-sky-700 hover:bg-sky-50'
                                }`}
                              >
                                ছুটি
                              </button>
                            </div>
                          </td>

                          {/* Remarks */}
                          <td className="py-3 px-4">
                            <input
                              type="text"
                              placeholder={isAbsent ? 'অনুপস্থিতির কারণ...' : 'মন্তব্য (প্রয়োজনে)...'}
                              value={entry.remarks}
                              onChange={(e) => handleSetStudentRemarks(student.id, e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                            />
                          </td>

                          {/* SMS Trigger */}
                          <td className="py-3 px-4 text-center">
                            {isAbsent && student.guardianPhone ? (
                              <button
                                onClick={async () => {
                                  const text = generateAbsenceSMS(
                                    student.nameBn,
                                    student.roll,
                                    currentClass.nameBn,
                                    attendanceDate,
                                    schoolInfo.name
                                  );
                                  await sendSingleSMS(student.guardianPhone!, text, `${student.nameBn} (অভিভাবক)`, {
                                    roll: student.roll,
                                    className: currentClass.nameBn,
                                    messageType: 'attendance',
                                  });
                                  setSaveSuccessMsg(`রোল ${toBengaliRoll(student.roll)}-এর অভিভাবককে এসএমএস পাঠানো হয়েছে।`);
                                }}
                                title="অভিভাবককে অনুপস্থিতির এসএমএস পাঠান"
                                className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold bg-rose-100 hover:bg-rose-200 text-rose-800 transition"
                              >
                                <Send className="w-3 h-3 mr-1 text-rose-700" />
                                নোটিশ
                              </button>
                            ) : (
                              <span className="text-slate-300 text-xs">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Bottom Save Bar */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-slate-500">
                হাজিরা পরিবর্তন শেষে অবশ্যই <strong>&quot;হাজিরা সংরক্ষণ করুন&quot;</strong> বাটনে চাপ দিন।
              </span>
              <button
                onClick={handleSaveDaily}
                className="inline-flex items-center px-6 py-2 rounded-xl text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition"
              >
                <Save className="w-4 h-4 mr-1.5" />
                আজকের হাজিরা সংরক্ষণ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MONTHLY ATTENDANCE REPORT & PRINTABLE SHEET */}
      {/* ========================================================================= */}
      {activeTab === 'monthly' && (
        <div className="space-y-6">
          {/* Month & Year Controls */}
          <div className="no-print bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">মাস নির্বাচন:</label>
                  <select
                    value={reportMonth}
                    onChange={(e) => setReportMonth(parseInt(e.target.value, 10))}
                    className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    {BENGALI_MONTHS.map((mo) => (
                      <option key={mo.value} value={mo.value}>
                        {mo.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">বছর:</label>
                  <select
                    value={reportYear}
                    onChange={(e) => setReportYear(e.target.value)}
                    className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="২০২৬">২০২৬</option>
                    <option value="২০২৫">২০২৫</option>
                    <option value="২০২৪">২০২৪</option>
                  </select>
                </div>
              </div>

              {/* Print and Export Buttons */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleExportCSV}
                  className="inline-flex items-center px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition shadow-xs"
                >
                  <Download className="w-4 h-4 mr-1.5 text-slate-600" />
                  এক্সেল / CSV এক্সপোর্ট
                </button>
                <button
                  onClick={handlePrint}
                  className="inline-flex items-center px-5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition"
                >
                  <Printer className="w-4 h-4 mr-1.5" />
                  মাসিক শিট প্রিন্ট করুন
                </button>
              </div>
            </div>

            {/* Monthly Analytics Cards */}
            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-indigo-50/70 p-3.5 rounded-xl border border-indigo-200 flex items-center space-x-3">
                <div className="p-2.5 bg-indigo-600 text-white rounded-lg shadow-xs">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-indigo-700 uppercase block">শ্রেণির গড় উপস্থিতি</span>
                  <span className="text-xl font-black text-indigo-950">
                    {toBengaliNumber(monthlyData.classAveragePercentage)}%
                  </span>
                </div>
              </div>

              <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200 flex items-center space-x-3">
                <div className="p-2.5 bg-emerald-600 text-white rounded-lg shadow-xs">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-emerald-700 uppercase block">মোট নির্ধারিত কর্মদিবস</span>
                  <span className="text-xl font-black text-emerald-950">
                    {toBengaliNumber(monthlyData.totalWorkingDays)} দিন
                  </span>
                </div>
              </div>

              <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200 flex items-center space-x-3">
                <div className="p-2.5 bg-amber-500 text-slate-950 rounded-lg shadow-xs">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-amber-800 uppercase block">সতর্কতাপ্রাপ্ত (&lt;৭৫%)</span>
                  <span className="text-xl font-black text-amber-950">
                    {toBengaliNumber(monthlyData.summaries.filter((s) => !s.isEligible).length)} জন শিক্ষার্থী
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Printable Monthly Attendance Register (A4-friendly Sheet) */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 print:border-none print:shadow-none print:p-0">
            {/* Printable Official School Header */}
            <div className="text-center pb-4 mb-4 border-b-2 border-slate-800">
              <div className="flex items-center justify-center space-x-3 mb-1">
                <SchoolLogo customLogoUrl={schoolInfo.logoUrl} size={48} />
                <div>
                  <h2 className="text-2xl font-black text-slate-900 font-serif">{schoolInfo.name}</h2>
                  <p className="text-xs text-slate-600">{schoolInfo.address}</p>
                </div>
              </div>
              <div className="inline-block mt-2 px-4 py-1 bg-slate-900 text-white text-xs sm:text-sm font-bold rounded-md">
                মাসিক শিক্ষার্থী উপস্থিতি ও হাজিরা রেজিস্টার শিট
              </div>
              <div className="mt-2 flex items-center justify-center space-x-4 text-xs font-bold text-slate-700">
                <span>শ্রেণি: {currentClass.nameBn}</span>
                <span>•</span>
                <span>শাখা: {selectedSection || 'সকল'}</span>
                <span>•</span>
                <span>
                  মাস: {BENGALI_MONTHS.find((m) => m.value === reportMonth)?.name}, {reportYear}
                </span>
                <span>•</span>
                <span>মোট কর্মদিবস: {toBengaliNumber(monthlyData.totalWorkingDays)} দিন</span>
              </div>
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse border border-slate-800 text-center">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-800">
                    <th className="border border-slate-800 py-2 px-1 w-8">রোল</th>
                    <th className="border border-slate-800 py-2 px-2 text-left min-w-[140px]">শিক্ষার্থীর নাম</th>
                    {monthlyData.daysInMonth.map((dayNum) => (
                      <th key={dayNum} className="border border-slate-800 py-1 px-0.5 w-6 text-[10px]">
                        {toBengaliNumber(dayNum)}
                      </th>
                    ))}
                    <th className="border border-slate-800 py-2 px-1 w-12 bg-emerald-50">উপস্থিত</th>
                    <th className="border border-slate-800 py-2 px-1 w-12 bg-rose-50">অনুপস্থিত</th>
                    <th className="border border-slate-800 py-2 px-1 w-10 bg-amber-50">দেরি</th>
                    <th className="border border-slate-800 py-2 px-1 w-10 bg-sky-50">ছুটি</th>
                    <th className="border border-slate-800 py-2 px-1 w-14 bg-indigo-50 font-black">হার (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyData.summaries.map((summary) => {
                    const normYear = reportYear.replace(/[০-৯]/g, (d) => '০১২৩৪৫৬৭৮৯'.indexOf(d).toString());
                    const yr = parseInt(normYear, 10) || 2026;
                    const moStr = reportMonth < 10 ? `0${reportMonth}` : `${reportMonth}`;

                    return (
                      <tr key={summary.studentId} className="border-b border-slate-300 hover:bg-slate-50/50">
                        {/* Roll */}
                        <td className="border border-slate-800 py-1.5 px-1 font-bold">
                          {toBengaliRoll(summary.student.roll)}
                        </td>

                        {/* Student Name */}
                        <td className="border border-slate-800 py-1.5 px-2 text-left font-medium truncate max-w-[160px]">
                          {summary.student.nameBn}
                        </td>

                        {/* Days of Month Status Cells */}
                        {monthlyData.daysInMonth.map((dayNum) => {
                          const dayStr = dayNum < 10 ? `0${dayNum}` : `${dayNum}`;
                          const dateKey = `${yr}-${moStr}-${dayStr}`;
                          const dailyRec = monthlyData.recordsByDate[dateKey];
                          const studentEntry = dailyRec?.records[summary.studentId];

                          // BD Friday check
                          const dateObj = new Date(yr, reportMonth - 1, dayNum);
                          const isFriday = dateObj.getDay() === 5;

                          if (isFriday) {
                            return (
                              <td
                                key={dayNum}
                                className="border border-slate-800 py-1 px-0.5 bg-slate-200/80 text-[10px] text-slate-500 font-bold"
                                title="শুক্রবার (সাপ্তাহিক ছুটি)"
                              >
                                বন্ধ
                              </td>
                            );
                          }

                          if (!dailyRec) {
                            return (
                              <td key={dayNum} className="border border-slate-800 py-1 px-0.5 text-slate-300 text-[10px]">
                                -
                              </td>
                            );
                          }

                          const status = studentEntry?.status;
                          if (status === 'present') {
                            return (
                              <td
                                key={dayNum}
                                className="border border-slate-800 py-1 px-0.5 font-bold text-emerald-700 bg-emerald-50/40 text-[11px]"
                                title="উপস্থিত"
                              >
                                P
                              </td>
                            );
                          } else if (status === 'absent') {
                            return (
                              <td
                                key={dayNum}
                                className="border border-slate-800 py-1 px-0.5 font-bold text-rose-700 bg-rose-50/60 text-[11px]"
                                title="অনুপস্থিত"
                              >
                                A
                              </td>
                            );
                          } else if (status === 'late') {
                            return (
                              <td
                                key={dayNum}
                                className="border border-slate-800 py-1 px-0.5 font-bold text-amber-700 bg-amber-50/60 text-[11px]"
                                title="বিলম্বিত"
                              >
                                L
                              </td>
                            );
                          } else if (status === 'leave') {
                            return (
                              <td
                                key={dayNum}
                                className="border border-slate-800 py-1 px-0.5 font-bold text-sky-700 bg-sky-50/60 text-[11px]"
                                title="অনুমোদিত ছুটি"
                              >
                                H
                              </td>
                            );
                          }

                          return (
                            <td key={dayNum} className="border border-slate-800 py-1 px-0.5 text-slate-300">
                              -
                            </td>
                          );
                        })}

                        {/* Summary Columns */}
                        <td className="border border-slate-800 py-1.5 px-1 font-bold text-emerald-700 bg-emerald-50/30">
                          {toBengaliNumber(summary.presentDays)}
                        </td>
                        <td className="border border-slate-800 py-1.5 px-1 font-bold text-rose-700 bg-rose-50/30">
                          {toBengaliNumber(summary.absentDays)}
                        </td>
                        <td className="border border-slate-800 py-1.5 px-1 text-amber-700 bg-amber-50/30">
                          {toBengaliNumber(summary.lateDays)}
                        </td>
                        <td className="border border-slate-800 py-1.5 px-1 text-sky-700 bg-sky-50/30">
                          {toBengaliNumber(summary.leaveDays)}
                        </td>
                        <td
                          className={`border border-slate-800 py-1.5 px-1 font-black ${
                            summary.percentage >= 90
                              ? 'text-emerald-700 bg-emerald-50/50'
                              : summary.percentage >= 75
                              ? 'text-indigo-700 bg-indigo-50/50'
                              : 'text-rose-700 bg-rose-50/50'
                          }`}
                        >
                          {toBengaliNumber(summary.percentage)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Legend & Teacher Signature for Print */}
            <div className="mt-6 pt-4 border-t border-slate-300 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-4">
              <div className="flex items-center space-x-3">
                <span className="font-bold">চিহ্ন নির্দেশিকা:</span>
                <span className="inline-flex items-center text-emerald-700 font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-1 inline-block"></span> P = উপস্থিত
                </span>
                <span className="inline-flex items-center text-rose-700 font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 mr-1 inline-block"></span> A = অনুপস্থিত
                </span>
                <span className="inline-flex items-center text-amber-700 font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 mr-1 inline-block"></span> L = দেরিতে (Late)
                </span>
                <span className="inline-flex items-center text-sky-700 font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500 mr-1 inline-block"></span> H = ছুটি (Leave)
                </span>
              </div>

              {/* Official Signatures */}
              <div className="flex items-center space-x-12 pt-6">
                <div className="text-center">
                  <div className="border-t border-slate-800 w-32 pt-1 font-bold text-slate-800">শ্রেণি শিক্ষকের স্বাক্ষর</div>
                </div>
                <div className="text-center">
                  <div className="border-t border-slate-800 w-32 pt-1 font-bold text-slate-800">প্রধান শিক্ষকের স্বাক্ষর</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PROGRESS CARD PERFORMANCE METRICS & SYNC */}
      {/* ========================================================================= */}
      {activeTab === 'progress_metrics' && (
        <div className="space-y-6">
          {/* Header & Sync Controller */}
          <div className="no-print bg-gradient-to-r from-emerald-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-md">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-6 h-6 text-amber-300" />
                  <h3 className="text-lg sm:text-xl font-black font-serif text-amber-300">
                    প্রোগ্রেস কার্ড উপস্থিতি ও শতকরা পারফরম্যান্স মেট্রিক্স
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-indigo-200 mt-1 max-w-2xl">
                  শিক্ষার্থীদের দৈনিক উপস্থিতির ভিত্তিতে প্রকৃত কার্যদিবস ও উপস্থিতির হার স্বয়ংক্রিয়ভাবে গণনা করা হয়েছে।
                  এক ক্লিকেই এই মেট্রিক্স মূল পরীক্ষার ফলাফল ও মার্কশিট কার্ডে সিঙ্ক করুন।
                </p>
              </div>

              {/* Sync Action */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/20">
                  <span className="text-[11px] text-indigo-200 block">টার্ম কার্যদিবস নির্ধারণ:</span>
                  <input
                    type="number"
                    value={customWorkingDays}
                    onChange={(e) => setCustomWorkingDays(Math.max(1, parseInt(e.target.value, 10) || 120))}
                    className="w-20 bg-white text-slate-900 font-bold px-2 py-1 rounded text-sm focus:outline-none"
                  />
                </div>

                <button
                  onClick={handleSyncToProgressCards}
                  className="inline-flex items-center px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm shadow-lg transition"
                >
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  প্রোগ্রেস কার্ডে সিঙ্ক করুন
                </button>

                {onNavigateToResults && (
                  <button
                    onClick={onNavigateToResults}
                    className="inline-flex items-center px-4 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs sm:text-sm transition"
                  >
                    ফলাফল কার্ড দেখুন →
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Metrics Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-800 text-sm sm:text-base">
                  {currentClass.nameBn} - উপস্থিতি পারফরম্যান্স রেটিং ও প্রোগ্রেস মেট্রিক্স
                </h4>
                <p className="text-xs text-slate-500">
                  শিক্ষাবর্ষ: {selectedYear} • মোট শিক্ষার্থী: {toBengaliNumber(currentStudents.length)} জন
                </p>
              </div>
              <button
                onClick={handlePrint}
                className="inline-flex items-center px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition"
              >
                <Printer className="w-3.5 h-3.5 mr-1" />
                রিপোর্ট প্রিন্ট
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 text-center w-16">রোল</th>
                    <th className="py-3 px-4">শিক্ষার্থীর নাম</th>
                    <th className="py-3 px-4 text-center">রেকর্ডকৃত কার্যদিবস</th>
                    <th className="py-3 px-4 text-center">উপস্থিত দিন</th>
                    <th className="py-3 px-4 text-center">অনুপস্থিত দিন</th>
                    <th className="py-3 px-4 w-48 text-center">উপস্থিতির হার (%)</th>
                    <th className="py-3 px-4 text-center">পারফরম্যান্স রেটিং</th>
                    <th className="py-3 px-4">প্রোগ্রেস কার্ডে প্রযোজ্য মন্তব্য</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentStudents.map((std) => {
                    const metrics = calculateStudentAttendanceMetrics(std.id, selectedClassId, selectedYear);
                    const pct = metrics.totalWorkingDays > 0 ? metrics.percentage : 95;
                    const isHigh = pct >= 90;
                    const isModerate = pct >= 75 && pct < 90;
                    const isLow = pct < 75;

                    let ratingBadge = '';
                    let ratingText = '';
                    let suggestedRemark = '';

                    if (pct >= 95) {
                      ratingBadge = 'bg-emerald-100 text-emerald-800 border-emerald-300';
                      ratingText = 'অনন্য ও প্রশংসনীয় (A+)';
                      suggestedRemark = 'নিয়মিত ও অত্যন্ত মনোযোগী শিক্ষার্থী। উপস্থিতির চমৎকার রেকর্ড।';
                    } else if (pct >= 90) {
                      ratingBadge = 'bg-indigo-100 text-indigo-800 border-indigo-300';
                      ratingText = 'অতি উত্তম (A)';
                      suggestedRemark = 'শ্রেণিকক্ষে নিয়মিত উপস্থিতি ও একাগ্রতা প্রশংসনীয়।';
                    } else if (pct >= 80) {
                      ratingBadge = 'bg-blue-100 text-blue-800 border-blue-300';
                      ratingText = 'উত্তম (A-)';
                      suggestedRemark = 'উপস্থিতি ভালো। নিয়মিত অধ্যবসায় বজায় রাখো।';
                    } else if (pct >= 75) {
                      ratingBadge = 'bg-slate-100 text-slate-800 border-slate-300';
                      ratingText = 'সন্তোষজনক (B)';
                      suggestedRemark = 'ন্যূনতম উপস্থিতির শর্ত পূরণ হয়েছে। আরও নিয়মিত হওয়া প্রয়োজন।';
                    } else {
                      ratingBadge = 'bg-rose-100 text-rose-800 border-rose-300';
                      ratingText = 'ঝুঁকিপূর্ণ / সতর্কবার্তা (F)';
                      suggestedRemark = 'অনুপস্থিতির হার বেশি। ক্লাসে নিয়মিত না হলে পড়াশোনায় পিছিয়ে পড়বে।';
                    }

                    return (
                      <tr key={std.id} className="hover:bg-slate-50 transition">
                        {/* Roll */}
                        <td className="py-3 px-4 text-center font-bold text-slate-800">
                          <span className="inline-block px-2.5 py-1 bg-slate-100 rounded-lg text-xs font-mono font-bold">
                            {toBengaliRoll(std.roll)}
                          </span>
                        </td>

                        {/* Name */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-800">{std.nameBn}</div>
                          <div className="text-xs text-slate-400">{std.nameEn}</div>
                        </td>

                        {/* Working Days */}
                        <td className="py-3 px-4 text-center font-bold text-slate-700">
                          {toBengaliNumber(metrics.totalWorkingDays > 0 ? metrics.totalWorkingDays : customWorkingDays)} দিন
                        </td>

                        {/* Present Days */}
                        <td className="py-3 px-4 text-center font-bold text-emerald-700">
                          {toBengaliNumber(
                            metrics.totalWorkingDays > 0
                              ? metrics.presentDays
                              : Math.round((customWorkingDays * pct) / 100)
                          )}{' '}
                          দিন
                        </td>

                        {/* Absent Days */}
                        <td className="py-3 px-4 text-center font-bold text-rose-700">
                          {toBengaliNumber(
                            metrics.totalWorkingDays > 0
                              ? metrics.absentDays
                              : customWorkingDays - Math.round((customWorkingDays * pct) / 100)
                          )}{' '}
                          দিন
                        </td>

                        {/* Progress Bar & Percentage */}
                        <td className="py-3 px-4 text-center">
                          <div className="w-full bg-slate-100 rounded-full h-2.5 mb-1 overflow-hidden border border-slate-200">
                            <div
                              className={`h-2.5 rounded-full ${
                                isHigh ? 'bg-emerald-500' : isModerate ? 'bg-indigo-500' : 'bg-rose-500'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-mono font-black text-slate-800">
                            {toBengaliNumber(pct)}%
                          </span>
                        </td>

                        {/* Rating */}
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold border ${ratingBadge}`}
                          >
                            {ratingText}
                          </span>
                        </td>

                        {/* Remarks */}
                        <td className="py-3 px-4 text-xs text-slate-600 italic">
                          &quot;{suggestedRemark}&quot;
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2 text-xs text-slate-500">
                <Info className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                <span>
                  প্রোগ্রেস কার্ডে উপস্থিতির হার ৭৫% বা তদূর্ধ্ব হলে শিক্ষার্থী নিয়মিত ও পরীক্ষায় অংশগ্রহণে পূর্ণ যোগ্য বলে বিবেচিত হয়।
                </span>
              </div>
              <button
                onClick={handleSyncToProgressCards}
                className="inline-flex items-center px-6 py-2 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition"
              >
                <Sparkles className="w-4 h-4 mr-1.5" />
                সকল শিক্ষার্থীর প্রোগ্রেস কার্ডে সিঙ্ক করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABSENTEE BULK SMS MODAL */}
      {/* ========================================================================= */}
      {smsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-rose-100 text-rose-700 rounded-xl">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">অনুপস্থিতি নোটিফিকেশন এসএমএস</h3>
                  <p className="text-xs text-slate-500">তারিখ: {attendanceDate} • শ্রেণি: {currentClass.nameBn}</p>
                </div>
              </div>
              <button
                onClick={() => setSmsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {smsFeedback && (
              <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{smsFeedback}</span>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>প্রাপক নির্বাচন ({selectedAbsentStudents.length} জন):</span>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedAbsentStudents.length === absentStudentsList.length) {
                      setSelectedAbsentStudents([]);
                    } else {
                      setSelectedAbsentStudents(absentStudentsList.map((s) => s.id));
                    }
                  }}
                  className="text-indigo-600 hover:underline"
                >
                  {selectedAbsentStudents.length === absentStudentsList.length ? 'সব আনচেক' : 'সব চেক'}
                </button>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-2 bg-slate-50/50">
                {absentStudentsList.map((std) => (
                  <label
                    key={std.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs"
                  >
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={selectedAbsentStudents.includes(std.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedAbsentStudents((prev) => [...prev, std.id]);
                          } else {
                            setSelectedAbsentStudents((prev) => prev.filter((id) => id !== std.id));
                          }
                        }}
                        className="rounded text-rose-600 focus:ring-rose-500"
                      />
                      <span className="font-bold text-slate-800">
                        {toBengaliRoll(std.roll)}. {std.nameBn}
                      </span>
                    </div>
                    <span className="font-mono text-slate-500 text-[11px]">{std.guardianPhone || 'নম্বর নেই'}</span>
                  </label>
                ))}
              </div>

              {/* Sample Preview */}
              <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-500 block mb-1">এসএমএস প্রিভিউ নমুনা:</span>
                <p className="text-xs text-slate-700 font-serif leading-relaxed">
                  {generateAbsenceSMS(
                    absentStudentsList[0]?.nameBn || 'শিক্ষার্থীর নাম',
                    absentStudentsList[0]?.roll || 1,
                    currentClass.nameBn,
                    attendanceDate,
                    schoolInfo.name
                  )}
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setSmsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                বাতিল
              </button>
              <button
                type="button"
                disabled={smsSending || selectedAbsentStudents.length === 0}
                onClick={handleSendAbsentSMS}
                className="inline-flex items-center px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md disabled:opacity-50 transition"
              >
                {smsSending ? (
                  <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-1.5" />
                )}
                {smsSending ? 'পাঠানো হচ্ছে...' : `নোটিফিকেশন পাঠান (${toBengaliNumber(selectedAbsentStudents.length)})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
