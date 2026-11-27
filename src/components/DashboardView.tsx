import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  GraduationCap,
  FileCheck2,
  Printer,
  TableProperties,
  Users,
  BookOpen,
  HelpCircle,
  Download,
  ShieldCheck,
  Award,
  ArrowRight,
  MessageSquare,
  CalendarCheck,
  CalendarDays,
  FileSpreadsheet,
  BookMarked,
  CreditCard,
  Receipt,
  ShieldAlert,
  LayoutGrid,
  FileBadge,
  Briefcase,
  Library,
  Volume2,
  VolumeX,
  UserCheck,
  Clock,
  Phone,
  X,
  BellRing,
  Activity,
  ChevronDown,
  ChevronUp,
  Database,
  LogIn,
  LogOut,
  PlusCircle,
  Timer,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { SchoolLogo } from './SchoolLogo';
import { DashboardWidget } from './DashboardWidget';
import { toBengaliNumber } from '../utils/bengali';
import {
  speakBengaliSpeech,
  stopBengaliSpeech,
  subscribeSpeechPlayback,
  unlockMobileAudioAndSpeech,
} from '../utils/gatepassAudio';
import {
  LEAVE_TYPE_LABELS,
  STAFF_DESIGNATIONS,
  computeStaffWorkedMinutes,
  formatWorkedDurationBn,
  getDesignationOrder,
  getDhakaTodayIso,
  normalizeStaffDesignation,
} from '../utils/staffDesignations';
import { StaffAccount, StaffAttendanceRecord, StaffLeaveRequest } from '../types';

interface DashboardViewProps {
  onNavigate: (tab: string) => void;
  onOpenSettings: () => void;
  reviewerNameBn?: string;
}

const STAFF_VOICE_PREF_KEY = 'dlikon_official_staff_voice_enabled';

function formatDhakaClockBn(ms: number): string {
  try {
    return new Intl.DateTimeFormat('bn-BD', {
      timeZone: 'Asia/Dhaka',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toLocaleTimeString('bn-BD');
  }
}

function getLogDhakaDateIso(timestampIso?: string, serverTimestamp?: number): string {
  const ms =
    typeof serverTimestamp === 'number' && serverTimestamp > 0
      ? serverTimestamp
      : timestampIso
      ? Date.parse(timestampIso)
      : NaN;
  if (!Number.isFinite(ms)) return '';
  return getDhakaTodayIso(new Date(ms));
}

function formatShortTimeBn(timestampIso?: string, serverTimestamp?: number): string {
  const ms =
    typeof serverTimestamp === 'number' && serverTimestamp > 0
      ? serverTimestamp
      : timestampIso
      ? Date.parse(timestampIso)
      : NaN;
  if (!Number.isFinite(ms)) return '';
  try {
    return new Intl.DateTimeFormat('bn-BD', {
      timeZone: 'Asia/Dhaka',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toLocaleTimeString('bn-BD');
  }
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenSettings,
  reviewerNameBn = 'প্রিন্সিপাল',
}) => {
  const {
    schoolInfo,
    classes,
    students,
    syllabi,
    questionPapers,
    libraryMaterials,
    exportDatabaseBackup,
    selectedYear,
    staffAccounts,
    staffAttendance,
    staffLeaves,
    latestStaffConfirmation,
    staffConfirmationFeed,
    dismissStaffConfirmation,
    recordStaffAttendanceAction,
    reviewStaffLeave,
    refreshStaffOverview,
    attendanceRecords,
    securityLogs,
    cloudUser,
    cloudConnectionStatus,
    serverSyncStatus,
    lastSyncedTime,
  } = useSchool();

  const [staffVoiceEnabled, setStaffVoiceEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STAFF_VOICE_PREF_KEY);
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const [isVoicePlaying, setIsVoicePlaying] = useState(false);
  const [voiceAutoplayBlocked, setVoiceAutoplayBlocked] = useState(false);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [selectedDesignationFilter, setSelectedDesignationFilter] = useState<string>('all');
  const [staffBoardMode, setStaffBoardMode] = useState<'today' | 'history'>('today');
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);
  const [pendingActionStaffId, setPendingActionStaffId] = useState<string | null>(null);

  // Principal Leave Approval Queue state
  const [leaveFilterStatus, setLeaveFilterStatus] = useState<
    'pending' | 'approved' | 'rejected' | 'all'
  >('pending');
  const [leaveDesignationFilter, setLeaveDesignationFilter] = useState<string>('all');
  const [leaveReviewNotes, setLeaveReviewNotes] = useState<Record<string, string>>({});
  const [busyLeaveId, setBusyLeaveId] = useState<string | null>(null);
  const [isRefreshingLeaves, setIsRefreshingLeaves] = useState(false);
  const [leaveActionFeedback, setLeaveActionFeedback] = useState<string | null>(null);

  const mountedAtRef = useRef<number>(Date.now());
  const spokenEventIdRef = useRef<string | null>(null);

  useEffect(() => {
    return subscribeSpeechPlayback(setIsVoicePlaying);
  }, []);

  // 1-second live Dhaka clock + automatic ongoing work-duration tick
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const todayIso = getDhakaTodayIso(new Date(nowMs));
  const liveClockBn = formatDhakaClockBn(nowMs);

  // 1) All-Designation (1-9) Real-Time Staff Metrics & Cumulative Work Hours
  const {
    activeStaffList,
    presentStaffRecords,
    totalStaffCount,
    presentCount,
    pendingCount,
    onDutyCount,
    checkedOutCount,
    todayTotalWorkedMinutes,
    allTimeTotalWorkedMinutes,
    designationSummaries,
    staffDirectoryRows,
    fallbackTodayMessage,
  } = useMemo(() => {
    const activeStaff = staffAccounts.filter((a) => a && a.status !== 'pending');
    const todayRecs = staffAttendance.filter((r) => r && r.date === todayIso);
    const todayByStaffId = new Map<string, StaffAttendanceRecord>();
    for (const rec of todayRecs) {
      if (!rec?.staffId) continue;
      if (!todayByStaffId.has(rec.staffId)) {
        todayByStaffId.set(rec.staffId, rec);
      }
    }

    // Cumulative historical hours across ALL saved days in DB
    const cumulativeByStaffId = new Map<
      string,
      { daysCount: number; completedDays: number; totalMinutes: number; lastDate: string }
    >();
    let allTimeMinutesSum = 0;

    for (const rec of staffAttendance) {
      if (!rec?.staffId) continue;
      const calc = computeStaffWorkedMinutes(rec, rec.date === todayIso ? nowMs : Date.now());
      allTimeMinutesSum += calc.minutes;
      const cur = cumulativeByStaffId.get(rec.staffId) || {
        daysCount: 0,
        completedDays: 0,
        totalMinutes: 0,
        lastDate: rec.date,
      };
      cur.daysCount += 1;
      if (rec.checkOutTime) cur.completedDays += 1;
      cur.totalMinutes += calc.minutes;
      if (rec.date > cur.lastDate) cur.lastDate = rec.date;
      cumulativeByStaffId.set(rec.staffId, cur);
    }

    // Merge registered active staff + any today check-ins without matching staffAccounts entry
    const combinedStaffMap = new Map<string, StaffAccount>();
    for (const st of activeStaff) {
      combinedStaffMap.set(st.id, st);
    }
    for (const rec of todayByStaffId.values()) {
      if (!combinedStaffMap.has(rec.staffId)) {
        combinedStaffMap.set(rec.staffId, {
          id: rec.staffId,
          staffCode: rec.staffCode || 'DL-STF',
          role: 'employee',
          nameBn: rec.staffNameBn,
          designationBn: rec.designationBn,
          phone: '',
          password: '',
          status: 'active',
          createdAt: rec.date,
        });
      }
    }

    const rows = Array.from(combinedStaffMap.values()).map((staff) => {
      const todayRec = todayByStaffId.get(staff.id) || null;
      const normalizedDesignation = normalizeStaffDesignation(
        todayRec?.designationBn || staff.designationBn
      );
      const order = getDesignationOrder(normalizedDesignation);
      const todayCalc = todayRec ? computeStaffWorkedMinutes(todayRec, nowMs) : null;
      const historyStats = cumulativeByStaffId.get(staff.id) || {
        daysCount: 0,
        completedDays: 0,
        totalMinutes: 0,
        lastDate: '',
      };
      return {
        staff,
        normalizedDesignation,
        designationOrder: order,
        todayRecord: todayRec,
        todayWorkedMinutes: todayCalc?.minutes ?? 0,
        isPresentToday: Boolean(todayRec),
        isOnDuty: Boolean(todayRec && !todayRec.checkOutTime),
        isCheckedOut: Boolean(todayRec && todayRec.checkOutTime),
        cumulativeDays: historyStats.daysCount,
        cumulativeCompletedDays: historyStats.completedDays,
        cumulativeMinutes: historyStats.totalMinutes,
        lastActiveDate: historyStats.lastDate,
      };
    });

    rows.sort(
      (a, b) =>
        a.designationOrder - b.designationOrder ||
        (b.todayRecord?.serverTimestamp || 0) - (a.todayRecord?.serverTimestamp || 0) ||
        a.staff.nameBn.localeCompare(b.staff.nameBn, 'bn')
    );

    const presentList = Array.from(todayByStaffId.values()).sort(
      (a, b) => (b.serverTimestamp || 0) - (a.serverTimestamp || 0)
    );

    const totalCount = rows.length;
    const presCount = rows.filter((r) => r.isPresentToday).length;
    const pendCount = Math.max(0, totalCount - presCount);
    const activeDutyCount = rows.filter((r) => r.isOnDuty).length;
    const doneDutyCount = rows.filter((r) => r.isCheckedOut).length;
    const todayMinutesSum = rows.reduce((sum, r) => sum + r.todayWorkedMinutes, 0);

    const desSummaries = STAFF_DESIGNATIONS.map((meta) => {
      const matched = rows.filter((r) => r.normalizedDesignation === meta.labelBn);
      const desPresent = matched.filter((r) => r.isPresentToday).length;
      const desMinutes = matched.reduce((sum, r) => sum + r.todayWorkedMinutes, 0);
      return {
        ...meta,
        totalCount: matched.length,
        presentCount: desPresent,
        todayMinutes: desMinutes,
      };
    });

    let fallbackMsg = '';
    if (presentList.length > 0) {
      const latestRec = presentList[0];
      const actionVerb =
        latestRec.action === 'checkout' || latestRec.checkOutTime
          ? 'প্রস্থান করেছেন'
          : 'প্রবেশ করেছেন';
      const timeLabel =
        latestRec.action === 'checkout' && latestRec.checkOutTime
          ? latestRec.checkOutTime
          : latestRec.checkInTime;
      const timePhrase = timeLabel ? ` (সময়: ${timeLabel})` : '';
      const durationPhrase =
        (latestRec.action === 'checkout' || latestRec.checkOutTime) && latestRec.workedDurationBn
          ? ` — মোট কর্মঘণ্টা: ${latestRec.workedDurationBn}`
          : '';
      fallbackMsg = `এইমাত্র ${normalizeStaffDesignation(latestRec.designationBn)} পদে দায়িত্বশীল ${latestRec.staffNameBn} ${actionVerb}${timePhrase}${durationPhrase}। মোট উপস্থিতির সংখ্যা ${toBengaliNumber(presCount)} জন, অপেক্ষমান সংখ্যা ${toBengaliNumber(pendCount)} জন।`;
    }

    return {
      activeStaffList: activeStaff,
      presentStaffRecords: presentList,
      totalStaffCount: totalCount,
      presentCount: presCount,
      pendingCount: pendCount,
      onDutyCount: activeDutyCount,
      checkedOutCount: doneDutyCount,
      todayTotalWorkedMinutes: todayMinutesSum,
      allTimeTotalWorkedMinutes: allTimeMinutesSum,
      designationSummaries: desSummaries,
      staffDirectoryRows: rows,
      fallbackTodayMessage: fallbackMsg,
    };
  }, [staffAccounts, staffAttendance, todayIso, nowMs]);

  // 2) Class-by-Class Live Student Attendance (merged DailyAttendance + Today Gatepass Scans)
  const {
    classAttendanceRows,
    totalStudentsPresentToday,
    totalStudentsLateToday,
    totalStudentsAbsentOrPendingToday,
    overallStudentAttendancePct,
    todayStudentScanCount,
  } = useMemo(() => {
    const studentById = new Map(students.map((s) => [s.id, s]));
    const todayAttRecords = Object.values(attendanceRecords).filter(
      (r) => r && r.date === todayIso
    );
    const todayLogs = securityLogs.filter(
      (l) => l && getLogDhakaDateIso(l.timestamp, l.serverTimestamp) === todayIso
    );

    const sortedClasses = [...classes].sort(
      (a, b) => (a.numericOrder ?? 99) - (b.numericOrder ?? 99)
    );

    let globalPresent = 0;
    let globalLate = 0;
    let globalAbsentPending = 0;

    const rows = sortedClasses.map((cls) => {
      const classStudents = students
        .filter((s) => s.classId === cls.id)
        .sort((a, b) => Number(a.roll) - Number(b.roll));

      const attMapForClass: Record<string, { status: string; remarks?: string }> = {};
      for (const rec of todayAttRecords) {
        if (rec.classId === cls.id && rec.records) {
          Object.assign(attMapForClass, rec.records);
        }
      }

      const scanByStudent = new Map<
        string,
        { action: 'entry' | 'exit'; timeLabel: string; serverTs: number }
      >();
      let classLatestTime = '';
      let classLatestTs = 0;

      for (const log of todayLogs) {
        const resolvedClassId = log.classId || studentById.get(log.studentId)?.classId;
        if (resolvedClassId !== cls.id) continue;
        const tsMs =
          typeof log.serverTimestamp === 'number' && log.serverTimestamp > 0
            ? log.serverTimestamp
            : Date.parse(log.timestamp) || 0;
        const timeStr = formatShortTimeBn(log.timestamp, log.serverTimestamp);
        if (tsMs >= classLatestTs) {
          classLatestTs = tsMs;
          classLatestTime = timeStr;
        }
        const existingScan = scanByStudent.get(log.studentId);
        if (!existingScan || tsMs >= existingScan.serverTs) {
          scanByStudent.set(log.studentId, {
            action: log.action === 'exit' ? 'exit' : 'entry',
            timeLabel: timeStr,
            serverTs: tsMs,
          });
        }
      }

      let present = 0;
      let late = 0;
      let leave = 0;
      let absent = 0;
      let pending = 0;

      const studentStatuses = classStudents.map((st) => {
        const recEntry = attMapForClass[st.id];
        const scanInfo = scanByStudent.get(st.id);
        let status: 'present' | 'late' | 'leave' | 'absent' | 'pending' = 'pending';

        if (recEntry?.status === 'late') {
          status = 'late';
          late += 1;
          present += 1;
        } else if (recEntry?.status === 'present' || scanInfo) {
          status = 'present';
          present += 1;
        } else if (recEntry?.status === 'leave') {
          status = 'leave';
          leave += 1;
        } else if (recEntry?.status === 'absent') {
          status = 'absent';
          absent += 1;
        } else {
          status = 'pending';
          pending += 1;
        }

        return {
          student: st,
          status,
          scanAction: scanInfo?.action || null,
          scanTimeLabel: scanInfo?.timeLabel || '',
          remarks: recEntry?.remarks || '',
        };
      });

      const total = classStudents.length;
      const pct = total > 0 ? Math.round((present / total) * 100) : 0;

      globalPresent += present;
      globalLate += late;
      globalAbsentPending += absent + pending + leave;

      return {
        classObj: cls,
        totalStudents: total,
        presentCount: present,
        lateCount: late,
        leaveCount: leave,
        absentOrPendingCount: absent + pending + leave,
        percentage: pct,
        latestScanTime: classLatestTime,
        studentStatuses,
      };
    });

    const totalAll = students.length;
    const globalPct = totalAll > 0 ? Math.round((globalPresent / totalAll) * 100) : 0;

    return {
      classAttendanceRows: rows,
      totalStudentsPresentToday: globalPresent,
      totalStudentsLateToday: globalLate,
      totalStudentsAbsentOrPendingToday: globalAbsentPending,
      overallStudentAttendancePct: globalPct,
      todayStudentScanCount: todayLogs.length,
    };
  }, [classes, students, attendanceRecords, securityLogs, todayIso]);

  const filteredStaffRows = useMemo(() => {
    if (selectedDesignationFilter === 'all') return staffDirectoryRows;
    return staffDirectoryRows.filter(
      (r) => r.normalizedDesignation === selectedDesignationFilter
    );
  }, [staffDirectoryRows, selectedDesignationFilter]);

  const activeConfirmationMessage =
    latestStaffConfirmation?.messageBn || fallbackTodayMessage;

  useEffect(() => {
    if (!staffVoiceEnabled || !latestStaffConfirmation) return;
    if (latestStaffConfirmation.receivedAt < mountedAtRef.current) return;
    if (spokenEventIdRef.current === latestStaffConfirmation.eventId) return;

    spokenEventIdRef.current = latestStaffConfirmation.eventId;
    setVoiceAutoplayBlocked(false);
    speakBengaliSpeech(latestStaffConfirmation.messageBn, {
      onBlocked: () => {
        setVoiceAutoplayBlocked(true);
      },
    });
  }, [latestStaffConfirmation, staffVoiceEnabled]);

  const handleToggleStaffVoice = () => {
    const next = !staffVoiceEnabled;
    setStaffVoiceEnabled(next);
    try {
      localStorage.setItem(STAFF_VOICE_PREF_KEY, String(next));
    } catch {
      // Ignore storage failure
    }
    if (next) {
      unlockMobileAudioAndSpeech(true);
      setVoiceAutoplayBlocked(false);
    } else {
      stopBengaliSpeech();
      setVoiceAutoplayBlocked(false);
    }
  };

  const handlePlayStaffMessageNow = () => {
    if (!activeConfirmationMessage) return;
    unlockMobileAudioAndSpeech(true);
    setVoiceAutoplayBlocked(false);
    speakBengaliSpeech(activeConfirmationMessage, {
      onBlocked: () => {
        setVoiceAutoplayBlocked(true);
      },
    });
  };

  const handleQuickStaffAction = async (
    staff: StaffAccount,
    action: 'checkin' | 'checkout'
  ) => {
    setPendingActionStaffId(staff.id);
    try {
      await recordStaffAttendanceAction(
        {
          id: staff.id,
          staffCode: staff.staffCode,
          nameBn: staff.nameBn,
          designationBn: normalizeStaffDesignation(staff.designationBn),
        },
        action
      );
    } finally {
      setPendingActionStaffId(null);
    }
  };

  // Staff Leave Approval computations & actions
  const {
    sortedStaffLeaves,
    pendingLeaveRequests,
    approvedLeaveRequests,
    rejectedLeaveRequests,
    filteredLeaveRequests,
  } = useMemo(() => {
    const sorted = [...staffLeaves].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const pending = sorted.filter((l) => l.status === 'pending');
    const approved = sorted.filter((l) => l.status === 'approved');
    const rejected = sorted.filter((l) => l.status === 'rejected');
    const byStatus =
      leaveFilterStatus === 'all'
        ? sorted
        : sorted.filter((l) => l.status === leaveFilterStatus);
    const byDes =
      leaveDesignationFilter === 'all'
        ? byStatus
        : byStatus.filter(
            (l) => normalizeStaffDesignation(l.designationBn) === leaveDesignationFilter
          );
    return {
      sortedStaffLeaves: sorted,
      pendingLeaveRequests: pending,
      approvedLeaveRequests: approved,
      rejectedLeaveRequests: rejected,
      filteredLeaveRequests: byDes,
    };
  }, [staffLeaves, leaveFilterStatus, leaveDesignationFilter]);

  const handlePrincipalLeaveDecision = async (
    leave: StaffLeaveRequest,
    decision: 'approved' | 'rejected'
  ) => {
    setBusyLeaveId(leave.id);
    setLeaveActionFeedback(null);
    const noteText = (leaveReviewNotes[leave.id] || '').trim();
    try {
      const updated = await reviewStaffLeave(
        leave.id,
        decision,
        reviewerNameBn || 'প্রিন্সিপাল',
        noteText || undefined
      );
      if (updated) {
        setLeaveReviewNotes((prev) => {
          const next = { ...prev };
          delete next[leave.id];
          return next;
        });
        setLeaveActionFeedback(
          decision === 'approved'
            ? `${leave.staffNameBn}-এর ${toBengaliNumber(leave.daysCount)} দিনের ছুটির আবেদন অনুমোদিত হয়েছে এবং বেতন হিসাবে সমন্বিত হয়েছে।`
            : `${leave.staffNameBn}-এর ছুটির আবেদন বাতিল করা হয়েছে।`
        );
        setTimeout(() => setLeaveActionFeedback(null), 5000);
      }
    } finally {
      setBusyLeaveId(null);
    }
  };

  const handleManualLeaveRefresh = async () => {
    setIsRefreshingLeaves(true);
    try {
      await refreshStaffOverview();
    } finally {
      setIsRefreshingLeaves(false);
    }
  };

  const totalStudents = students.length;
  const totalClasses = classes.length;
  const totalSyllabi = syllabi.length;
  const totalQuestionPapers = questionPapers.length;

  const quickActions = [
    {
      id: 'staff_management',
      title: 'অফিসিয়াল, এমপ্লয়ী ও সাইন-আপ অনুমোদন',
      desc: 'শিক্ষক ও স্টাফ অ্যাকাউন্ট তৈরি, স্টাফ হাজিরা এবং নতুন শিক্ষার্থীর সাইন-আপ আবেদন অনুমোদন',
      icon: Briefcase,
      color: 'bg-[#0F1E3D] text-white',
      badge: 'স্টাফ ও অনুমোদন',
    },
    {
      id: 'defaulters',
      title: 'ফি খেলাপি তালিকা (৩০+ দিন বকেয়া)',
      desc: 'দীর্ঘমেয়াদী বকেয়া ঋণ পর্যবেক্ষণ, খেলাপি নোটিশ এসএমএস ও ঋণ রিকভারি খতিয়ান',
      icon: ShieldAlert,
      color: 'bg-rose-700 text-white',
      badge: '৩০+ দিন খেলাপি',
    },
    {
      id: 'daily_report',
      title: 'দৈনিক ফি আদায় ও বকেয়া খতিয়ান',
      desc: 'আজকের মোট ফি আদায়, নগদ ও অনলাইন জমার হিসাব, খাতভিত্তিক আয় ও এ৪ সমাপনী প্রিন্ট',
      icon: Receipt,
      color: 'bg-teal-700 text-white',
      badge: 'দৈনিক রিপোর্ট ও ক্যাশ',
    },
    {
      id: 'fees',
      title: 'বকেয়া ও ফি আদায় (মানি রিসিট ও ডিউ স্লিপ)',
      desc: 'শিক্ষার্থীদের বকেয়া তথ্য, তাৎক্ষণিক পেমেন্ট কর্তন, অফিশিয়াল মানি রিসিট ও ডিউ স্লিপ প্রিন্ট',
      icon: CreditCard,
      color: 'bg-emerald-600 text-white',
      badge: 'বকেয়া ও মানি রিসিট',
    },
    {
      id: 'subjects',
      title: 'বিষয় ব্যবস্থাপনা',
      desc: 'শ্রেণি অনুযায়ী বিষয় যোগ, সম্পাদনা, পূর্ণমান ও ২০% মাসিক পরীক্ষা নির্ধারণ',
      icon: BookMarked,
      color: 'bg-blue-600 text-white',
      badge: 'ডায়নামিক সিঙ্ক',
    },
    {
      id: 'marks_entry',
      title: 'মার্ক এন্ট্রি ফরম',
      desc: 'পরীক্ষার খাতা দেখার পর বিষয়ভিত্তিক নম্বর এন্ট্রি করুন',
      icon: FileCheck2,
      color: 'bg-indigo-600 text-white',
      badge: '৮০% ও ২০% হিসাব',
    },
    {
      id: 'results',
      title: 'রেজাল্ট কার্ড ও পারফরম্যান্স চার্ট',
      desc: 'একক বা সকল কার্ড প্রিন্ট এবং ড্যাশবোর্ড চার্টে বিষয়ভিত্তিক পারফরম্যান্স বিশ্লেষণ',
      icon: Printer,
      color: 'bg-emerald-600 text-white',
      badge: 'কার্ড ও ডেটা ভিজ্যুয়ালাইজেশন',
    },
    {
      id: 'admit_card',
      title: 'এপিঠ-ওপিঠ এডমিট কার্ড জেনারেটর',
      desc: '১টি A4 পাতায় ৪টি করে প্রবেশপত্র ও অপর পৃষ্ঠায় পরীক্ষার সাধারণ নিয়মাবলী প্রিন্ট',
      icon: FileBadge,
      color: 'bg-amber-600 text-white',
      badge: 'এপিঠ-ওপিঠ ৪টি/A4',
    },
    {
      id: 'seat_plan',
      title: 'পরীক্ষার আসন বিন্যাস স্লিপ (ছবি সহ)',
      desc: '১টি A4 পাতায় ৮টি করে ছবি ও রোল সহ আসন বিন্যাস স্লিপ প্রস্তুত ও এক ক্লিকে প্রিন্ট',
      icon: LayoutGrid,
      color: 'bg-indigo-700 text-white',
      badge: 'ছবি সহ ৮টি/A4',
    },
    {
      id: 'sms',
      title: 'এসএমএস নোটিফিকেশন',
      desc: 'অভিভাবকদের কাছে পরীক্ষার ফলাফল সামারি ও নোটিশ সরাসরি পাঠান',
      icon: MessageSquare,
      color: 'bg-teal-600 text-white',
      badge: 'স্বয়ংক্রিয় ফলাফল এসএমএস',
    },
    {
      id: 'tabulation',
      title: 'ট্যাবুল্যাশন শিট',
      desc: 'সকল শিক্ষার্থীর বিষয়ভিত্তিক নম্বর ও মেধাক্রম মাস্টার শিট',
      icon: TableProperties,
      color: 'bg-purple-600 text-white',
      badge: 'Excel (.xlsx) ও প্রিন্ট',
    },
    {
      id: 'attendance',
      title: 'শিক্ষার্থী হাজিরা ও পারফরম্যান্স মেট্রিক্স',
      desc: 'দৈনিক ডিজিটাল হাজিরা এন্ট্রি, মাসিক শিট এবং প্রোগ্রেস কার্ডে উপস্থিতির স্বয়ংক্রিয় মেট্রিক্স',
      icon: CalendarCheck,
      color: 'bg-teal-600 text-white',
      badge: 'দৈনিক ও মাসিক রিপোর্ট',
    },
    {
      id: 'calendar',
      title: 'একাডেমিক ক্যালেন্ডার ও শিক্ষাপঞ্জি',
      desc: 'পরীক্ষার সময়সূচি, সরকারি ও ধর্মীয় ছুটি, ফলাফল প্রকাশ এবং বার্ষিক অনুষ্ঠান ব্যবস্থাপনা',
      icon: CalendarDays,
      color: 'bg-indigo-700 text-white',
      badge: 'গ্রিড ও সময়সূচি',
    },
    {
      id: 'students',
      title: 'শিক্ষার্থী তথ্য ও বাল্ক আপলোড',
      desc: 'এক্সেল/সিএসভি থেকে সকল শ্রেণির তথ্য এক ক্লিকে আপলোড',
      icon: Users,
      color: 'bg-amber-600 text-white',
      badge: 'এক্সেল সাপোর্ট',
    },
    {
      id: 'question_papers',
      title: 'প্রশ্নপত্র প্রস্তুতকারক',
      desc: 'সৃজনশীল, বহুনির্বাচনী ও সংক্ষিপ্ত প্রশ্নপত্র জেনারেট করুন',
      icon: HelpCircle,
      color: 'bg-blue-600 text-white',
      badge: 'স্কুল স্ট্যান্ডার্ড',
    },
    {
      id: 'syllabus',
      title: 'সিলেবাস ও মানবণ্টন',
      desc: 'সাময়িক ও বার্ষিক পরীক্ষার বিষয়ভিত্তিক পাঠ্যক্রম ও মানবণ্টন',
      icon: BookOpen,
      color: 'bg-rose-600 text-white',
      badge: 'প্রিন্ট উপযোগী',
    },
    {
      id: 'digital_library',
      title: 'ডিজিটাল লাইব্রেরি (ই-বুক ও পিডিএফ)',
      desc: 'ই-বুক, পিডিএফ লেকচার শিট, নোট ও প্রশ্নব্যাংক আপলোড করে শিক্ষার্থীদের জন্য ডাউনলোডযোগ্য করুন',
      icon: Library,
      color: 'bg-slate-900 text-amber-300',
      badge: `${toBengaliNumber(libraryMaterials.length)}টি রিসোর্স`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* School Welcome Hero Card */}
      <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-blue-950 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <div className="bg-white p-2 rounded-full shadow-lg flex-shrink-0">
            <SchoolLogo customLogoUrl={schoolInfo.logoUrl} size={100} />
          </div>

          <div className="text-center sm:text-left space-y-1.5 flex-1">
            <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-400 text-slate-950 mb-1">
              {schoolInfo.established || 'স্থাপিত:২০১৮'} • শিক্ষাবর্ষ {toBengaliNumber(selectedYear)} ইং
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-serif text-amber-300">
              {schoolInfo.name || 'ডি-লিকন মডেল একাডেমী'}
            </h1>
            <p className="text-sm text-indigo-200">
              {schoolInfo.address || 'দক্ষিণগাঁও, গণি মার্কেট, সনমানিয়া, কাপাসিয়া, গাজীপুর।'}
            </p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-indigo-200 pt-1">
              <span>মোবাইল: {toBengaliNumber(schoolInfo.phone)}</span>
              <span>•</span>
              <span>ই-মেইল: {schoolInfo.email}</span>
            </div>

            <div className="pt-4 flex flex-wrap gap-2.5 justify-center sm:justify-start">
              <button
                onClick={() => onNavigate('my_dashboard')}
                className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-bold bg-white text-[#0F1E3D] hover:bg-amber-100 shadow-md transition cursor-pointer"
              >
                <Timer className="w-4 h-4 mr-1.5 text-teal-700" />
                আমার ড্যাশবোর্ড ও বেতন
              </button>
              <button
                onClick={() => onNavigate('daily_report')}
                className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition"
              >
                <Receipt className="w-4 h-4 mr-1.5 text-amber-300" />
                দৈনিক আদায় রিপোর্ট
              </button>
              <button
                onClick={() => onNavigate('marks_entry')}
                className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-md transition"
              >
                <FileCheck2 className="w-4 h-4 mr-1.5" />
                মার্ক এন্ট্রি শুরু করুন
              </button>
              <button
                onClick={() => onNavigate('results')}
                className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition backdrop-blur-sm"
              >
                <Printer className="w-4 h-4 mr-1.5 text-amber-400" />
                রেজাল্ট কার্ড দেখুন
              </button>
              <button
                onClick={() => onNavigate('digital_security')}
                className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 mr-1.5 text-emerald-300" />
                ডিজিটাল সিকিউরিটি গেটপাস
              </button>
              <button
                onClick={() => onNavigate('bulk_upload')}
                className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition backdrop-blur-sm cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 mr-1.5 text-amber-300" />
                বাল্ক শিক্ষার্থী আপলোড
              </button>
              <button
                onClick={exportDatabaseBackup}
                className="inline-flex items-center px-3.5 py-2 rounded-lg text-xs font-medium bg-emerald-700/80 hover:bg-emerald-600 text-white transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                ডাটাবেস ব্যাকআপ
              </button>
            </div>
          </div>
        </div>

        {/* Decorative backdrop shapes */}
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute right-1/4 -top-12 w-48 h-48 bg-blue-500/20 rounded-full blur-2xl pointer-events-none"></div>
      </div>

      {/* Live Real-Time Operations Dashboard: Student Attendance by Class + 9-Designation Staff Tracking */}
      <section
        aria-label="লাইভ রিয়েলটাইম উপস্থিতি ও কর্মঘণ্টা ড্যাশবোর্ড"
        className="space-y-5"
      >
        {/* Top Real-Time Control Header & Live Clock */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-[#0F1E3D] text-amber-300 rounded-lg shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 font-serif">
                  লাইভ রিয়েল-টাইম উপস্থিতি ও স্টাফ কর্মঘণ্টা ড্যাশবোর্ড
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  লাইভ সিঙ্ক
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 tabular-nums flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>তারিখ: {toBengaliNumber(todayIso)}</span>
                <span>·</span>
                <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                  <Database className="w-3.5 h-3.5 text-teal-700" />
                  স্থায়ী ডাটাবেজ:{' '}
                  {cloudUser?.emailVerified && cloudConnectionStatus === 'connected'
                    ? 'সার্ভার + ক্লাউড সংরক্ষিত'
                    : serverSyncStatus === 'synced'
                    ? 'সার্ভার ডাটাবেজ সংরক্ষিত'
                    : 'লোকাল + অটো-সিঙ্ক'}
                  {lastSyncedTime ? ` (${lastSyncedTime})` : ''}
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="px-3 py-1.5 rounded-lg bg-slate-900 text-amber-300 text-xs font-bold tabular-nums flex items-center gap-1.5 whitespace-nowrap">
              <Clock className="w-3.5 h-3.5" />
              <span>{liveClockBn}</span>
            </div>

            <button
              type="button"
              onClick={handleToggleStaffVoice}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer whitespace-nowrap shrink-0 ${
                staffVoiceEnabled
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {staffVoiceEnabled ? (
                <Volume2 className="w-3.5 h-3.5 text-emerald-700" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-slate-500" />
              )}
              {staffVoiceEnabled ? 'ভয়েস ঘোষণা চালু' : 'ভয়েস মিউট'}
            </button>

            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('principal-leave-approvals');
                el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer whitespace-nowrap shrink-0 tabular-nums ${
                pendingLeaveRequests.length > 0
                  ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <CalendarCheck className="w-3.5 h-3.5 text-teal-700" />
              <span>
                ছুটির অনুমোদন ({toBengaliNumber(pendingLeaveRequests.length)}টি)
              </span>
            </button>

            {activeConfirmationMessage && (
              <button
                type="button"
                onClick={isVoicePlaying ? () => stopBengaliSpeech() : handlePlayStaffMessageNow}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0F1E3D] hover:bg-slate-800 text-white transition cursor-pointer whitespace-nowrap shrink-0"
              >
                <BellRing className="w-3.5 h-3.5 text-amber-300" />
                {isVoicePlaying ? 'শোনা বন্ধ করুন' : 'ঘোষণা শুনুন'}
              </button>
            )}
          </div>
        </div>

        {/* Live 4-KPI Summary Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-500">আজ উপস্থিত শিক্ষার্থী</div>
              <div className="text-xl font-bold text-slate-900 tabular-nums mt-0.5">
                {toBengaliNumber(totalStudentsPresentToday)} / {toBengaliNumber(totalStudents)} জন
              </div>
              <div className="text-[11px] text-emerald-700 font-semibold tabular-nums mt-0.5">
                হার: {toBengaliNumber(overallStudentAttendancePct)}% · অনুপস্থিত/বাকি {toBengaliNumber(totalStudentsAbsentOrPendingToday)} জন
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700 shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-500">আজ উপস্থিত স্টাফ (১–৮ ক্যাটাগরি)</div>
              <div className="text-xl font-bold text-slate-900 tabular-nums mt-0.5">
                {toBengaliNumber(presentCount)} / {toBengaliNumber(totalStaffCount)} জন
              </div>
              <div className="text-[11px] text-amber-800 font-semibold tabular-nums mt-0.5">
                অপেক্ষমান: {toBengaliNumber(pendingCount)} জন
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-indigo-50 text-[#0F1E3D] shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-500">দায়িত্বে কর্মরত ও প্রস্থান</div>
              <div className="text-xl font-bold text-slate-900 tabular-nums mt-0.5">
                কর্মরত {toBengaliNumber(onDutyCount)} · প্রস্থান {toBengaliNumber(checkedOutCount)}
              </div>
              <div className="text-[11px] text-slate-600 font-medium tabular-nums mt-0.5">
                গেটপাস স্ক্যান আজ: {toBengaliNumber(todayStudentScanCount)} বার
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-teal-50 text-teal-800 shrink-0">
              <Users className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-500">আজকের মোট স্টাফ কর্মঘণ্টা</div>
              <div className="text-xl font-bold text-[#0F1E3D] tabular-nums mt-0.5">
                {formatWorkedDurationBn(todayTotalWorkedMinutes)}
              </div>
              <div className="text-[11px] text-slate-600 font-medium tabular-nums mt-0.5">
                মোট সংরক্ষিত: {formatWorkedDurationBn(allTimeTotalWorkedMinutes)}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-50 text-amber-800 shrink-0">
              <Timer className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Live Confirmation Banner (Principal & Entrepreneur) */}
        {activeConfirmationMessage && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="text-xs font-semibold text-emerald-900 flex flex-wrap items-center gap-1.5">
                <BellRing className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span>
                  {latestStaffConfirmation
                    ? 'তাৎক্ষণিক রিয়েলটাইম স্টাফ কনফার্মেশন'
                    : 'সর্বশেষ উপস্থিতি কনফার্মেশন'}
                </span>
                <span>·</span>
                <span>
                  {normalizeStaffDesignation(
                    latestStaffConfirmation
                      ? latestStaffConfirmation.record.designationBn
                      : presentStaffRecords[0]?.designationBn || 'শিক্ষক'
                  )}
                </span>
                <span>·</span>
                <span>
                  {latestStaffConfirmation
                    ? latestStaffConfirmation.record.staffNameBn
                    : presentStaffRecords[0]?.staffNameBn || ''}
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-900 leading-relaxed tabular-nums">
                {activeConfirmationMessage}
              </p>
              {voiceAutoplayBlocked && (
                <div className="pt-1 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-amber-800">
                    ব্রাউজার স্বয়ংক্রিয় অডিও আটকে দিয়েছে —
                  </span>
                  <button
                    type="button"
                    onClick={handlePlayStaffMessageNow}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    ভয়েস আনলক ও শুনুন
                  </button>
                </div>
              )}
            </div>
            {latestStaffConfirmation && (
              <button
                type="button"
                onClick={dismissStaffConfirmation}
                aria-label="কনফার্মেশন বার্তা বন্ধ করুন"
                className="p-1 rounded text-emerald-700 hover:bg-emerald-100 transition cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Section A: Class-by-Class Live Student Attendance */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 sm:px-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 font-serif flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-teal-700" />
                <span>ক্লাস অনুযায়ী লাইভ শিক্ষার্থী উপস্থিতি</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                ডিজিটাল গেটপাস স্ক্যান ও শ্রেণিভিত্তিক দৈনিক হাজিরা স্বয়ংক্রিয়ভাবে সমন্বিত (মোট উপস্থিত {toBengaliNumber(totalStudentsPresentToday)} জন, বিলম্ব {toBengaliNumber(totalStudentsLateToday)} জন)
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onNavigate('attendance')}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-800 transition cursor-pointer whitespace-nowrap"
              >
                শ্রেণি হাজিরা এন্ট্রি
              </button>
              <button
                type="button"
                onClick={() => onNavigate('digital_security')}
                className="px-3 py-1.5 rounded-lg bg-[#0F1E3D] hover:bg-slate-800 text-white text-xs font-semibold transition cursor-pointer whitespace-nowrap"
              >
                লাইভ গেটপাস
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-2.5 pl-5 pr-3 font-semibold">শ্রেণি</th>
                  <th className="py-2.5 px-3 font-semibold">মোট শিক্ষার্থী</th>
                  <th className="py-2.5 px-3 font-semibold">উপস্থিত</th>
                  <th className="py-2.5 px-3 font-semibold">অপেক্ষমান / অনুপস্থিত</th>
                  <th className="py-2.5 px-3 font-semibold">উপস্থিতি হার</th>
                  <th className="py-2.5 px-3 font-semibold">সর্বশেষ স্ক্যান</th>
                  <th className="py-2.5 pl-3 pr-5 font-semibold text-right">তালিকা</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {classAttendanceRows.map((row) => {
                  const isExpanded = expandedClassId === row.classObj.id;
                  return (
                    <React.Fragment key={row.classObj.id}>
                      <tr className="hover:bg-slate-50/70 transition">
                        <td className="py-3 pl-5 pr-3 font-bold text-slate-900">
                          {row.classObj.nameBn}
                        </td>
                        <td className="py-3 px-3 text-slate-700 font-medium">
                          {toBengaliNumber(row.totalStudents)} জন
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-bold text-emerald-700">
                            {toBengaliNumber(row.presentCount)} জন
                          </span>
                          {row.lateCount > 0 && (
                            <span className="ml-1.5 text-[11px] text-amber-700">
                              (বিলম্ব {toBengaliNumber(row.lateCount)})
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {toBengaliNumber(row.absentOrPendingCount)} জন
                        </td>
                        <td className="py-3 px-3 min-w-[140px]">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-slate-100 rounded overflow-hidden">
                              <div
                                className="h-full bg-emerald-600 rounded transition-all duration-300"
                                style={{ width: `${row.percentage}%` }}
                              />
                            </div>
                            <span className="font-bold text-slate-800 w-9 text-right">
                              {toBengaliNumber(row.percentage)}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {row.latestScanTime || '—'}
                        </td>
                        <td className="py-3 pl-3 pr-5 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedClassId(isExpanded ? null : row.classObj.id)
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-100 text-[11px] font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
                          >
                            {isExpanded ? (
                              <>
                                <span>সংক্ষিপ্ত</span>
                                <ChevronUp className="w-3.5 h-3.5" />
                              </>
                            ) : (
                              <>
                                <span>বিস্তারিত</span>
                                <ChevronDown className="w-3.5 h-3.5" />
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-50/80">
                          <td colSpan={7} className="px-5 py-3.5">
                            {row.studentStatuses.length === 0 ? (
                              <div className="text-xs text-slate-500">
                                এই শ্রেণিতে এখনো কোনো শিক্ষার্থী নিবন্ধিত নেই।
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {row.studentStatuses.map((stItem) => (
                                  <div
                                    key={stItem.student.id}
                                    className="bg-white border border-slate-200 rounded-lg px-3 py-2 flex items-center justify-between gap-2"
                                  >
                                    <div className="min-w-0">
                                      <div className="font-semibold text-slate-900 truncate">
                                        রোল {toBengaliNumber(stItem.student.roll)} · {stItem.student.nameBn}
                                      </div>
                                      <div className="text-[11px] text-slate-500 truncate">
                                        {stItem.scanTimeLabel
                                          ? `${stItem.scanAction === 'exit' ? 'প্রস্থান' : 'প্রবেশ'}: ${stItem.scanTimeLabel}`
                                          : stItem.remarks || 'এখনো স্ক্যান/হাজিরা হয়নি'}
                                      </div>
                                    </div>
                                    <span
                                      className={`px-2 py-0.5 rounded text-[11px] font-bold whitespace-nowrap shrink-0 ${
                                        stItem.status === 'present'
                                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                          : stItem.status === 'late'
                                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                          : stItem.status === 'absent'
                                          ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                                      }`}
                                    >
                                      {stItem.status === 'present'
                                        ? 'উপস্থিত'
                                        : stItem.status === 'late'
                                        ? 'বিলম্ব'
                                        : stItem.status === 'leave'
                                        ? 'ছুটি'
                                        : stItem.status === 'absent'
                                        ? 'অনুপস্থিত'
                                        : 'অপেক্ষমান'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section B: 9-Designation Teacher & Staff Real-Time Entry, Exit & Work Duration Board */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 sm:px-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 font-serif flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[#0F1E3D]" />
                <span>ক্যাটাগরি অনুযায়ী শিক্ষক ও কর্মচারী উপস্থিতি (১–৮) — প্রবেশ, প্রস্থান ও মোট কর্মঘণ্টা</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                প্রতিটি স্টাফের প্রবেশ ও প্রস্থানের সময় এবং চলমান/মোট কাজের সময় স্বয়ংক্রিয়ভাবে হিসাব হয়ে স্থায়ী ডাটাবেজে সংরক্ষিত থাকে
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setStaffBoardMode('today')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                    staffBoardMode === 'today'
                      ? 'bg-[#0F1E3D] text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  আজকের লাইভ সময়সূচি
                </button>
                <button
                  type="button"
                  onClick={() => setStaffBoardMode('history')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                    staffBoardMode === 'history'
                      ? 'bg-[#0F1E3D] text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  সর্বমোট সংরক্ষিত কর্মঘণ্টা
                </button>
              </div>

              <button
                type="button"
                onClick={() => onNavigate('staff_management')}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition cursor-pointer whitespace-nowrap"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>স্টাফ ব্যবস্থাপনা</span>
              </button>
            </div>
          </div>

          {/* 9-Designation Filter Tabs (1-9 Order) */}
          <div className="px-4 sm:px-5 py-3 bg-slate-50/80 border-b border-slate-200 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedDesignationFilter('all')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold border transition cursor-pointer whitespace-nowrap tabular-nums ${
                selectedDesignationFilter === 'all'
                  ? 'bg-[#0F1E3D] text-white border-[#0F1E3D]'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              সকল পদ ({toBengaliNumber(presentCount)}/{toBengaliNumber(totalStaffCount)})
            </button>
            {designationSummaries.map((des) => {
              const isSelected = selectedDesignationFilter === des.labelBn;
              return (
                <button
                  key={des.key}
                  type="button"
                  onClick={() => setSelectedDesignationFilter(des.labelBn)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-semibold border transition cursor-pointer whitespace-nowrap tabular-nums ${
                    isSelected
                      ? 'bg-[#0F1E3D] text-white border-[#0F1E3D]'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {toBengaliNumber(des.order)}। {des.labelBn} (
                  {toBengaliNumber(des.presentCount)}/{toBengaliNumber(des.totalCount)})
                </button>
              );
            })}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-2.5 pl-5 pr-3 font-semibold">ক্যাটাগরি (১–৮)</th>
                  <th className="py-2.5 px-3 font-semibold">নাম ও আইডি</th>
                  {staffBoardMode === 'today' ? (
                    <>
                      <th className="py-2.5 px-3 font-semibold">প্রবেশের সময়</th>
                      <th className="py-2.5 px-3 font-semibold">প্রস্থানের সময়</th>
                      <th className="py-2.5 px-3 font-semibold">আজকের মোট কাজ</th>
                      <th className="py-2.5 px-3 font-semibold">অবস্থা</th>
                      <th className="py-2.5 pl-3 pr-5 font-semibold text-right">দ্রুত এন্ট্রি</th>
                    </>
                  ) : (
                    <>
                      <th className="py-2.5 px-3 font-semibold">মোট উপস্থিত দিন</th>
                      <th className="py-2.5 px-3 font-semibold">সম্পন্ন শিফট</th>
                      <th className="py-2.5 px-3 font-semibold">সর্বশেষ তারিখ</th>
                      <th className="py-2.5 px-3 font-semibold">সর্বমোট সংরক্ষিত কর্মঘণ্টা</th>
                      <th className="py-2.5 pl-3 pr-5 font-semibold text-right">আজকের অবস্থা</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {filteredStaffRows.map((row) => {
                  const rec = row.todayRecord;
                  const isBusy = pendingActionStaffId === row.staff.id;
                  const todayDurationLabel = rec
                    ? rec.checkOutTime && rec.workedDurationBn
                      ? rec.workedDurationBn
                      : formatWorkedDurationBn(row.todayWorkedMinutes)
                    : '—';
                  const cumulativeLabel =
                    row.cumulativeMinutes > 0 || row.cumulativeDays > 0
                      ? formatWorkedDurationBn(row.cumulativeMinutes)
                      : '০ মিনিট';

                  return (
                    <tr key={row.staff.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 pl-5 pr-3 font-semibold text-slate-800 whitespace-nowrap">
                        {row.designationOrder <= 8
                          ? `${toBengaliNumber(row.designationOrder)}। `
                          : ''}
                        {row.normalizedDesignation}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{row.staff.nameBn}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2">
                          <span className="font-mono">{row.staff.staffCode}</span>
                          {row.staff.phone && (
                            <a
                              href={`tel:${row.staff.phone}`}
                              className="inline-flex items-center gap-0.5 text-slate-600 hover:text-teal-800"
                            >
                              <Phone className="w-3 h-3" />
                              {toBengaliNumber(row.staff.phone)}
                            </a>
                          )}
                        </div>
                      </td>

                      {staffBoardMode === 'today' ? (
                        <>
                          <td className="py-3 px-3 font-semibold text-emerald-800 whitespace-nowrap">
                            {rec?.checkInTime || '—'}
                          </td>
                          <td className="py-3 px-3 text-slate-700 whitespace-nowrap">
                            {rec?.checkOutTime || (row.isOnDuty ? 'কর্মরত আছেন' : '—')}
                          </td>
                          <td className="py-3 px-3 font-bold text-[#0F1E3D] whitespace-nowrap">
                            {rec ? (
                              <span>
                                {row.isOnDuty ? 'চলমান: ' : ''}
                                {todayDurationLabel}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal">০ মিনিট</span>
                            )}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            {row.isCheckedOut ? (
                              <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-[11px]">
                                প্রস্থান সম্পন্ন
                              </span>
                            ) : row.isOnDuty ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold text-[11px]">
                                কর্মরত
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 font-semibold text-[11px]">
                                অপেক্ষমান
                              </span>
                            )}
                          </td>
                          <td className="py-3 pl-3 pr-5 text-right whitespace-nowrap">
                            {!rec ? (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleQuickStaffAction(row.staff, 'checkin')}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold transition cursor-pointer disabled:opacity-50"
                              >
                                <LogIn className="w-3 h-3" />
                                প্রবেশ
                              </button>
                            ) : !rec.checkOutTime ? (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleQuickStaffAction(row.staff, 'checkout')}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold transition cursor-pointer disabled:opacity-50"
                              >
                                <LogOut className="w-3 h-3" />
                                প্রস্থান
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-500 font-medium">
                                মোট {cumulativeLabel}
                              </span>
                            )}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-3 px-3 font-semibold text-slate-800">
                            {toBengaliNumber(row.cumulativeDays)} দিন
                          </td>
                          <td className="py-3 px-3 text-slate-700">
                            {toBengaliNumber(row.cumulativeCompletedDays)} দিন
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            {row.lastActiveDate || '—'}
                          </td>
                          <td className="py-3 px-3 font-bold text-[#0F1E3D]">
                            {cumulativeLabel}
                          </td>
                          <td className="py-3 pl-3 pr-5 text-right whitespace-nowrap">
                            {row.isOnDuty ? (
                              <span className="text-emerald-700 font-semibold">আজ কর্মরত</span>
                            ) : row.isCheckedOut ? (
                              <span className="text-slate-600 font-semibold">আজ প্রস্থান</span>
                            ) : (
                              <span className="text-amber-700 font-medium">আজ অপেক্ষমান</span>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}

                {/* Show any of the 9 canonical designations that currently have 0 registered accounts */}
                {designationSummaries
                  .filter(
                    (des) =>
                      des.totalCount === 0 &&
                      (selectedDesignationFilter === 'all' ||
                        selectedDesignationFilter === des.labelBn)
                  )
                  .map((emptyDes) => (
                    <tr key={`empty_${emptyDes.key}`} className="bg-slate-50/40 text-slate-500">
                      <td className="py-2.5 pl-5 pr-3 font-semibold text-slate-700 whitespace-nowrap">
                        {toBengaliNumber(emptyDes.order)}। {emptyDes.labelBn}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400" colSpan={5}>
                        এই পদে এখনো কোনো স্টাফ নিবন্ধিত নেই
                      </td>
                      <td className="py-2.5 pl-3 pr-5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onNavigate('staff_management')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-semibold text-slate-700 cursor-pointer"
                        >
                          <PlusCircle className="w-3 h-3" />
                          যুক্ত করুন
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {staffConfirmationFeed.length > 0 && (
            <div className="px-4 sm:px-5 py-3 bg-slate-50/80 border-t border-slate-200">
              <div className="text-[11px] font-semibold text-slate-500 mb-1.5">
                সাম্প্রতিক রিয়েলটাইম স্টাফ উপস্থিতি লগ ({toBengaliNumber(activeStaffList.length)} জন সক্রিয় স্টাফ)
              </div>
              <div className="space-y-1">
                {staffConfirmationFeed.slice(0, 3).map((ev) => (
                  <div
                    key={ev.eventId}
                    className="text-xs text-slate-700 flex items-center justify-between gap-2 tabular-nums"
                  >
                    <span className="truncate">{ev.messageBn}</span>
                    <span className="text-[11px] text-slate-500 shrink-0">
                      {ev.action === 'checkout'
                        ? ev.record.checkOutTime || ev.record.checkInTime
                        : ev.record.checkInTime}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Section C: Principal Leave Approval & Decision Queue */}
        <div
          id="principal-leave-approvals"
          className="bg-white rounded-xl border border-slate-200 overflow-hidden scroll-mt-4"
        >
          <div className="p-4 sm:px-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 font-serif flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-teal-700 shrink-0" />
                <span>কর্মচারী ও শিক্ষকদের ছুটির আবেদন ও প্রিন্সিপাল অনুমোদন</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                অপেক্ষমান:{' '}
                <strong className="text-amber-700">
                  {toBengaliNumber(pendingLeaveRequests.length)}টি
                </strong>{' '}
                <span aria-hidden="true">·</span> অনুমোদিত:{' '}
                <strong className="text-emerald-700">
                  {toBengaliNumber(approvedLeaveRequests.length)}টি
                </strong>{' '}
                <span aria-hidden="true">·</span> বাতিল:{' '}
                <strong className="text-rose-700">
                  {toBengaliNumber(rejectedLeaveRequests.length)}টি
                </strong>{' '}
                <span aria-hidden="true">·</span> অনুমোদিত ছুটি বেতন ও হাজিরা হিসাবে স্বয়ংক্রিয়ভাবে যুক্ত হয়
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <select
                value={leaveDesignationFilter}
                onChange={(e) => setLeaveDesignationFilter(e.target.value)}
                aria-label="পদবি ফিল্টার"
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700"
              >
                <option value="all">সকল ক্যাটাগরি (১–৮)</option>
                {STAFF_DESIGNATIONS.map((des) => (
                  <option key={des.key} value={des.labelBn}>
                    {toBengaliNumber(des.order)}। {des.labelBn}
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={isRefreshingLeaves}
                onClick={handleManualLeaveRefresh}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-semibold transition cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 text-teal-700 ${isRefreshingLeaves ? 'animate-spin' : ''}`}
                />
                <span>তালিকা রিফ্রেশ</span>
              </button>
            </div>
          </div>

          {/* Status Segmented Tabs */}
          <div className="px-4 sm:px-5 py-2.5 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center gap-1.5 tabular-nums">
            {(
              [
                {
                  id: 'pending',
                  label: `অপেক্ষমান (${toBengaliNumber(pendingLeaveRequests.length)})`,
                },
                {
                  id: 'approved',
                  label: `অনুমোদিত (${toBengaliNumber(approvedLeaveRequests.length)})`,
                },
                {
                  id: 'rejected',
                  label: `বাতিল (${toBengaliNumber(rejectedLeaveRequests.length)})`,
                },
                {
                  id: 'all',
                  label: `সকল (${toBengaliNumber(sortedStaffLeaves.length)})`,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setLeaveFilterStatus(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition cursor-pointer whitespace-nowrap ${
                  leaveFilterStatus === tab.id
                    ? 'bg-[#0F1E3D] text-white border-[#0F1E3D]'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {leaveActionFeedback && (
            <div className="px-4 sm:px-5 py-2.5 bg-emerald-50 border-b border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{leaveActionFeedback}</span>
            </div>
          )}

          {filteredLeaveRequests.length === 0 ? (
            <div className="px-5 py-8 text-center text-xs text-slate-500">
              {leaveFilterStatus === 'pending'
                ? 'এই মুহূর্তে প্রিন্সিপালের অনুমোদনের জন্য কোনো অপেক্ষমান ছুটির আবেদন নেই।'
                : 'নির্বাচিত ফিল্টারে কোনো ছুটির আবেদন পাওয়া যায়নি।'}
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {filteredLeaveRequests.slice(0, 30).map((lr) => {
                const desLabel = normalizeStaffDesignation(lr.designationBn);
                const desOrder = getDesignationOrder(desLabel);
                const isBusy = busyLeaveId === lr.id;
                return (
                  <div
                    key={lr.id}
                    className="p-4 sm:px-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/70 transition"
                  >
                    <div className="min-w-0 space-y-1 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                        <span className="font-bold text-slate-900 text-sm">
                          {lr.staffNameBn}
                        </span>
                        <span aria-hidden="true" className="text-slate-400">
                          ·
                        </span>
                        <span className="font-semibold text-[#0F1E3D] tabular-nums">
                          {toBengaliNumber(desOrder)}। {desLabel}
                        </span>
                        {lr.staffCode && (
                          <>
                            <span aria-hidden="true" className="text-slate-400">
                              ·
                            </span>
                            <span className="font-mono text-[11px] text-slate-500">
                              {lr.staffCode}
                            </span>
                          </>
                        )}
                        <span aria-hidden="true" className="text-slate-400">
                          ·
                        </span>
                        <span
                          className={`font-bold ${
                            lr.status === 'approved'
                              ? 'text-emerald-700'
                              : lr.status === 'rejected'
                              ? 'text-rose-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {lr.status === 'approved'
                            ? 'অনুমোদিত'
                            : lr.status === 'rejected'
                            ? 'বাতিল'
                            : 'অপেক্ষমান'}
                        </span>
                      </div>

                      <div className="text-xs text-slate-700 tabular-nums flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="font-semibold text-teal-800">
                          {LEAVE_TYPE_LABELS[lr.leaveType] || lr.leaveType}
                        </span>
                        <span aria-hidden="true" className="text-slate-400">
                          ·
                        </span>
                        <span>
                          {lr.startDate} থেকে {lr.endDate} (
                          <strong>{toBengaliNumber(lr.daysCount)} দিন</strong>)
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed">
                        কারণ: <span className="text-slate-900">{lr.reason}</span>
                      </p>

                      {(lr.reviewedBy || lr.reviewNote) && (
                        <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2 pt-0.5">
                          {lr.reviewedBy && <span>সিদ্ধান্তদাতা: {lr.reviewedBy}</span>}
                          {lr.reviewNote && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-slate-700">মন্তব্য: {lr.reviewNote}</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {lr.status === 'pending' && (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 shrink-0 lg:w-[400px]">
                        <input
                          type="text"
                          value={leaveReviewNotes[lr.id] || ''}
                          onChange={(e) =>
                            setLeaveReviewNotes((prev) => ({
                              ...prev,
                              [lr.id]: e.target.value,
                            }))
                          }
                          maxLength={300}
                          placeholder="প্রিন্সিপালের মন্তব্য (ঐচ্ছিক)..."
                          className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-teal-700"
                        />
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handlePrincipalLeaveDecision(lr, 'approved')}
                            className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-60 whitespace-nowrap"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{isBusy ? '...' : 'অনুমোদন'}</span>
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handlePrincipalLeaveDecision(lr, 'rejected')}
                            className="px-3 py-1.5 rounded-lg border border-rose-300 bg-white hover:bg-rose-50 text-rose-700 text-xs font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-60 whitespace-nowrap"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>বাতিল</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3.5">
          <div className="p-3 bg-blue-50 text-blue-700 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">নিবন্ধিত শিক্ষার্থী</div>
            <div className="text-2xl font-bold text-slate-900 font-serif">
              {toBengaliNumber(totalStudents)} জন
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3.5">
          <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">মোট শ্রেণি</div>
            <div className="text-2xl font-bold text-slate-900 font-serif">
              {toBengaliNumber(totalClasses)}টি
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3.5">
          <div className="p-3 bg-purple-50 text-purple-700 rounded-xl">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">নির্ধারিত সিলেবাস</div>
            <div className="text-2xl font-bold text-slate-900 font-serif">
              {toBengaliNumber(totalSyllabi)}টি
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3.5">
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">তৈরিকৃত প্রশ্নপত্র</div>
            <div className="text-2xl font-bold text-slate-900 font-serif">
              {toBengaliNumber(totalQuestionPapers)}টি
            </div>
          </div>
        </div>
      </div>

      {/* Student Performance Trends Widget (Recharts) */}
      <DashboardWidget onNavigate={onNavigate} />

      {/* Main Core Modules Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900 font-serif flex items-center">
            <Award className="w-5 h-5 mr-2 text-indigo-600" />
            প্রধান কার্যাবলি ও ফিচারসমূহ
          </h2>
          <span className="text-xs text-slate-500">ডেস্কটপ ও মোবাইল উভয় প্লাটফর্মেই সমান উপযোগী</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <div
                key={action.id}
                onClick={() => onNavigate(action.id)}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-indigo-300 transition cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2.5 rounded-xl ${action.color} shadow-sm`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {action.badge}
                    </span>
                  </div>
                  <h3 className="font-bold text-base text-slate-900 group-hover:text-indigo-600 transition font-serif">
                    {action.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{action.desc}</p>
                </div>

                <div className="pt-4 mt-2 flex items-center text-xs font-bold text-indigo-600 group-hover:translate-x-1 transition">
                  প্রবেশ করুন <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Database Security & How-to Box */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-5 border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-start space-x-3.5">
          <div className="p-2.5 bg-emerald-600 text-white rounded-xl flex-shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-emerald-950 text-sm">
              ডাটাবেসের নিরাপত্তা ও স্বয়ংক্রিয় ব্যাকআপ ব্যবস্থা
            </h4>
            <p className="text-xs text-emerald-800 mt-0.5">
              সকল ডাটা অফলাইনে সম্পূর্ণ নিরাপদে সংরক্ষিত থাকে। প্রতি সপ্তাহ বা পরীক্ষার পর &quot;ব্যাকআপ ডাউনলোড&quot; বাটনে ক্লিক করে ব্যাকআপ ফাইলটি সংরক্ষণ করে রাখুন।
            </p>
          </div>
        </div>

        <button
          onClick={onOpenSettings}
          className="whitespace-nowrap px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-xs transition"
        >
          সেটিংস ও স্বাক্ষর কনফিগার করুন
        </button>
      </div>
    </div>
  );
};
