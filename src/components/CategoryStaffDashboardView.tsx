import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  Bell,
  BookOpen,
  Briefcase,
  Calculator,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  CreditCard,
  FileBadge,
  FileCheck2,
  FileText,
  GraduationCap,
  HeartHandshake,
  HelpCircle,
  LayoutGrid,
  Library,
  LogIn,
  LogOut,
  MessageSquare,
  Moon,
  Plus,
  Printer,
  QrCode,
  Receipt,
  Send,
  ShieldAlert,
  ShieldCheck,
  TableProperties,
  Timer,
  Trash2,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import {
  PortalAuthSession,
  StaffAccount,
  StaffCategoryKey,
  StaffLeaveType,
} from '../types';
import { toBengaliNumber } from '../utils/bengali';
import {
  LEAVE_TYPE_LABELS,
  computeLeaveDaysCount,
  computeMonthlyStaffPayroll,
  computeStaffWorkedMinutes,
  formatWorkedDurationBn,
  getDesignationMeta,
  getDhakaTodayIso,
  normalizeStaffDesignation,
  resolveStaffCategoryKey,
} from '../utils/staffDesignations';

interface CategoryStaffDashboardViewProps {
  session: PortalAuthSession;
  onNavigate: (tab: string) => void;
}

interface CategoryModuleItem {
  id: string;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
}

interface CategoryVisualMeta {
  workspaceSubtitle: string;
  heroSurfaceClass: string;
  accentLabel: string;
  roleBadgeIcon: React.ComponentType<{ className?: string }>;
  dutySectionTitle: string;
  modules: CategoryModuleItem[];
}

const CATEGORY_VISUALS: Record<StaffCategoryKey, CategoryVisualMeta> = {
  education_entrepreneur: {
    workspaceSubtitle: 'প্রাতিষ্ঠানিক কৌশল, রাজস্ব ও উপস্থিতি তদারকি',
    heroSurfaceClass: 'bg-gradient-to-br from-[#0B1733] via-[#132952] to-[#0E1E3B]',
    accentLabel: '১। শিক্ষা উদ্যোক্তা',
    roleBadgeIcon: Award,
    dutySectionTitle: 'উদ্যোক্তা ও বোর্ড তদারকি কার্যক্রম',
    modules: [
      {
        id: 'dashboard',
        title: 'লাইভ নির্বাহী ড্যাশবোর্ড',
        desc: 'ক্লাস অনুযায়ী শিক্ষার্থী উপস্থিতি ও স্টাফ কনফার্মেশন পর্যালোচনা',
        icon: Users,
        iconClass: 'bg-[#0F1E3D] text-amber-300',
      },
      {
        id: 'daily_report',
        title: 'দৈনিক ফি আদায় ও আয়-ব্যয়',
        desc: 'নগদ ও ব্যাংক জমার দৈনিক সমাপনী প্রতিবেদন',
        icon: Receipt,
        iconClass: 'bg-emerald-800 text-white',
      },
      {
        id: 'staff_management',
        title: 'স্টাফ, বেতন ও ছুটি অনুমোদন',
        desc: 'সকল ২০ জন স্টাফের বেতন কাঠামো ও ছুটির আবেদন পর্যালোচনা',
        icon: Briefcase,
        iconClass: 'bg-indigo-800 text-white',
      },
      {
        id: 'calendar',
        title: 'একাডেমিক ক্যালেন্ডার',
        desc: 'প্রতিষ্ঠানের বাৎসরিক ছুটি ও কর্মসূচি সূচি',
        icon: CalendarDays,
        iconClass: 'bg-slate-800 text-white',
      },
    ],
  },
  principal: {
    workspaceSubtitle: 'একাডেমিক নেতৃত্ব, পরীক্ষা ও স্টাফ নিয়ন্ত্রণ',
    heroSurfaceClass: 'bg-gradient-to-br from-[#131C3A] via-[#1E2B58] to-[#0F172A]',
    accentLabel: '২। প্রিন্সিপাল',
    roleBadgeIcon: ShieldCheck,
    dutySectionTitle: 'প্রিন্সিপাল দৈনন্দিন দায়িত্ব ও তদারকি',
    modules: [
      {
        id: 'dashboard',
        title: 'লাইভ উপস্থিতি ও ভয়েস মনিটর',
        desc: 'সকল শিক্ষক ও কর্মচারীর রিয়েলটাইম প্রবেশ-প্রস্থান ড্যাশবোর্ড',
        icon: Users,
        iconClass: 'bg-[#0F1E3D] text-amber-300',
      },
      {
        id: 'staff_management',
        title: 'স্টাফ ও ছুটির অনুমোদন',
        desc: 'ছুটির আবেদন অনুমোদন ও বেতন-ওভারটাইম কনফিগারেশন',
        icon: Briefcase,
        iconClass: 'bg-indigo-800 text-white',
      },
      {
        id: 'results',
        title: 'রেজাল্ট কার্ড ও পারফরম্যান্স',
        desc: 'পরীক্ষার ফলাফল অনুমোদন ও মেধাতালিকা প্রকাশ',
        icon: Printer,
        iconClass: 'bg-emerald-800 text-white',
      },
      {
        id: 'digital_security',
        title: 'ডিজিটাল গেটপাস নিয়ন্ত্রণ',
        desc: 'শিক্ষার্থীর নিরাপদ প্রবেশ ও অভিভাবক ভয়েস অ্যালার্ট',
        icon: QrCode,
        iconClass: 'bg-teal-800 text-white',
      },
      {
        id: 'sms',
        title: 'এসএমএস নোটিশ ও বার্তা',
        desc: 'অভিভাবক ও স্টাফদের জরুরি প্রাতিষ্ঠানিক বার্তা',
        icon: MessageSquare,
        iconClass: 'bg-amber-700 text-white',
      },
      {
        id: 'calendar',
        title: 'একাডেমিক ক্যালেন্ডার',
        desc: 'পরীক্ষা, ছুটি ও প্রাতিষ্ঠানিক সময়সূচি',
        icon: CalendarDays,
        iconClass: 'bg-slate-800 text-white',
      },
    ],
  },
  vice_principal: {
    workspaceSubtitle: 'একাডেমিক রুটিন, শৃঙ্খলা ও পরীক্ষা সমন্বয়',
    heroSurfaceClass: 'bg-gradient-to-br from-[#0F2942] via-[#163B5C] to-[#0B1D30]',
    accentLabel: '৩। সহ অধ্যক্ষ',
    roleBadgeIcon: GraduationCap,
    dutySectionTitle: 'সহ অধ্যক্ষ একাডেমিক সমন্বয় লগ',
    modules: [
      {
        id: 'dashboard',
        title: 'লাইভ ক্লাস ও স্টাফ মনিটর',
        desc: 'দৈনিক শিক্ষার্থী হাজিরা ও শ্রেণিকক্ষ শৃঙ্খলা পর্যবেক্ষণ',
        icon: Users,
        iconClass: 'bg-[#0F1E3D] text-white',
      },
      {
        id: 'attendance',
        title: 'শিক্ষার্থী উপস্থিতি তদারকি',
        desc: 'সকল শ্রেণির দৈনিক ও মাসিক হাজিরা প্রতিবেদন',
        icon: CalendarCheck,
        iconClass: 'bg-teal-800 text-white',
      },
      {
        id: 'tabulation',
        title: 'ট্যাবুল্যাশন মাস্টার শিট',
        desc: 'শ্রেণিভিত্তিক ফলাফল যাচাই ও এক্সপোর্ট',
        icon: TableProperties,
        iconClass: 'bg-indigo-800 text-white',
      },
      {
        id: 'admit_card',
        title: 'এডমিট কার্ড জেনারেটর',
        desc: 'পরীক্ষার প্রবেশপত্র প্রস্তুত ও প্রিন্ট সমন্বয়',
        icon: FileBadge,
        iconClass: 'bg-amber-700 text-white',
      },
      {
        id: 'seat_plan',
        title: 'পরীক্ষার আসন বিন্যাস',
        desc: 'কক্ষভিত্তিক রোল ও ছবিযুক্ত সিট প্ল্যান',
        icon: LayoutGrid,
        iconClass: 'bg-emerald-800 text-white',
      },
      {
        id: 'calendar',
        title: 'একাডেমিক ক্যালেন্ডার',
        desc: 'পরীক্ষা ও পাঠ্যক্রম সময়সূচি',
        icon: CalendarDays,
        iconClass: 'bg-slate-800 text-white',
      },
    ],
  },
  accountant_clerk: {
    workspaceSubtitle: 'বেতন-ভাতা, ফি আদায় ও দাপ্তরিক হিসাবরক্ষণ',
    heroSurfaceClass: 'bg-gradient-to-br from-[#0B3B2E] via-[#0F4F3D] to-[#082A21]',
    accentLabel: '৪। একাউন্টেন্ট কম কেরানী',
    roleBadgeIcon: Calculator,
    dutySectionTitle: 'হিসাব ও কেরানী দাপ্তরিক লগ',
    modules: [
      {
        id: 'fees',
        title: 'বকেয়া ও ফি আদায়',
        desc: 'শিক্ষার্থীর ফি সংগ্রহ, মানি রিসিট ও ডিউ স্লিপ প্রিন্ট',
        icon: CreditCard,
        iconClass: 'bg-emerald-800 text-white',
      },
      {
        id: 'daily_report',
        title: 'দৈনিক ফি আদায় রিপোর্ট',
        desc: 'আজকের মোট নগদ-অনলাইন আয় ও খাতভিত্তিক সমাপনী',
        icon: Receipt,
        iconClass: 'bg-teal-800 text-white',
      },
      {
        id: 'defaulters',
        title: 'খেলাপি ও বকেয়া তালিকা',
        desc: '৩০+ দিন বকেয়া থাকা শিক্ষার্থীদের তালিকা ও তাগাদা',
        icon: ShieldAlert,
        iconClass: 'bg-rose-700 text-white',
      },
      {
        id: 'calendar',
        title: 'একাডেমিক ক্যালেন্ডার',
        desc: 'মাসিক বেতন ও পরীক্ষার সময়সূচি',
        icon: CalendarDays,
        iconClass: 'bg-slate-800 text-white',
      },
    ],
  },
  teacher: {
    workspaceSubtitle: 'শ্রেণি পাঠদান, হাজিরা, মূল্যায়ন ও ডিজিটাল কন্টেন্ট',
    heroSurfaceClass: 'bg-gradient-to-br from-[#0B3235] via-[#0F4347] to-[#135257]',
    accentLabel: '৫। শিক্ষক',
    roleBadgeIcon: BookOpen,
    dutySectionTitle: 'শিক্ষক শ্রেণি কার্যক্রম ও পাঠদান লগ',
    modules: [
      {
        id: 'attendance',
        title: 'শিক্ষার্থী উপস্থিতি ও হাজিরা',
        desc: 'প্রতিদিনের ক্লাস হাজিরা গ্রহণ ও মাসিক উপস্থিতি সংরক্ষণ',
        icon: CalendarCheck,
        iconClass: 'bg-teal-800 text-white',
      },
      {
        id: 'marks_entry',
        title: 'বিষয়ভিত্তিক মার্ক এন্ট্রি',
        desc: 'সাময়িক ও মাসিক পরীক্ষার নম্বর এন্ট্রি',
        icon: FileCheck2,
        iconClass: 'bg-emerald-800 text-white',
      },
      {
        id: 'employee_scanner',
        title: 'স্মার্ট গেটপাস স্ক্যানার',
        desc: 'শিক্ষার্থীর আইডি কার্ড স্ক্যান করে প্রবেশ ও প্রস্থান নিশ্চিতকরণ',
        icon: QrCode,
        iconClass: 'bg-slate-800 text-white',
      },
      {
        id: 'digital_library',
        title: 'ডিজিটাল লাইব্রেরি ও ই-বুক',
        desc: 'পিডিএফ, লেকচার শিট ও নোট আপলোড',
        icon: Library,
        iconClass: 'bg-slate-900 text-amber-300',
      },
      {
        id: 'syllabus',
        title: 'সিলেবাস ও মানবণ্টন',
        desc: 'শ্রেণি অনুযায়ী পাঠ্যক্রম নির্ধারণ',
        icon: BookOpen,
        iconClass: 'bg-cyan-800 text-white',
      },
      {
        id: 'notes',
        title: 'ক্লাস নোট ও লেকচার',
        desc: 'অধ্যায়ভিত্তিক সংক্ষিপ্ত নোট তৈরি',
        icon: FileText,
        iconClass: 'bg-indigo-800 text-white',
      },
      {
        id: 'question_papers',
        title: 'প্রশ্নপত্র প্রস্তুতকারক',
        desc: 'সৃজনশীল ও বহুনির্বাচনী প্রশ্নপত্র তৈরি',
        icon: HelpCircle,
        iconClass: 'bg-amber-700 text-white',
      },
      {
        id: 'calendar',
        title: 'একাডেমিক ক্যালেন্ডার',
        desc: 'ছুটি ও পরীক্ষার সময়সূচি',
        icon: CalendarDays,
        iconClass: 'bg-stone-800 text-white',
      },
    ],
  },
  office_assistant: {
    workspaceSubtitle: 'ঘণ্টা, ফাইল আদান-প্রদান ও গেটপাস সহায়তা',
    heroSurfaceClass: 'bg-gradient-to-br from-[#2B261E] via-[#3D3529] to-[#1E1A14]',
    accentLabel: '৬। দপ্তরী',
    roleBadgeIcon: Bell,
    dutySectionTitle: 'দপ্তরী দৈনন্দিন দাপ্তরিক ও গেট কার্যক্রম',
    modules: [
      {
        id: 'employee_scanner',
        title: 'স্মার্ট গেটপাস স্ক্যানার',
        desc: 'স্কুল গেটে শিক্ষার্থীর আইডি কার্ড স্ক্যানিংয়ে সহায়তা',
        icon: QrCode,
        iconClass: 'bg-amber-700 text-white',
      },
      {
        id: 'calendar',
        title: 'একাডেমিক ক্যালেন্ডার ও ছুটি',
        desc: 'বিদ্যালয় খোলা ও বন্ধের তারিখ ও সময়সূচি',
        icon: CalendarDays,
        iconClass: 'bg-slate-800 text-white',
      },
    ],
  },
  ayah: {
    workspaceSubtitle: 'শিশু শিক্ষার্থীদের যত্ন, পরিচ্ছন্নতা ও নিরাপত্তা সহায়তা',
    heroSurfaceClass: 'bg-gradient-to-br from-[#3D1D2E] via-[#51273D] to-[#29131F]',
    accentLabel: '৭। আয়া',
    roleBadgeIcon: HeartHandshake,
    dutySectionTitle: 'আয়া শিশু-যত্ন ও পরিচ্ছন্নতা কার্যক্রম',
    modules: [
      {
        id: 'employee_scanner',
        title: 'ছুটির সময় গেটপাস যাচাই',
        desc: 'ছোট শিক্ষার্থীদের অভিভাবকের কাছে হস্তান্তর ও স্ক্যান সহায়তা',
        icon: QrCode,
        iconClass: 'bg-rose-800 text-white',
      },
      {
        id: 'calendar',
        title: 'একাডেমিক ক্যালেন্ডার',
        desc: 'বিদ্যালয়ের কর্মদিবস ও বিশেষ অনুষ্ঠান সূচি',
        icon: CalendarDays,
        iconClass: 'bg-slate-800 text-white',
      },
    ],
  },
  night_guard: {
    workspaceSubtitle: 'রাত্রিকালীন নিরাপত্তা, তালা-চাবি ও ক্যাম্পাস টহল',
    heroSurfaceClass: 'bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#090D16]',
    accentLabel: '৮। নৈশ প্রহরী',
    roleBadgeIcon: Moon,
    dutySectionTitle: 'নৈশ প্রহরী নিরাপত্তা টহল ও হস্তান্তর লগ',
    modules: [
      {
        id: 'employee_scanner',
        title: 'ভোর ও গেট নিরাপত্তা স্ক্যানার',
        desc: 'সকালবেলা গেট খোলা ও প্রাথমিক প্রবেশ যাচাই',
        icon: QrCode,
        iconClass: 'bg-slate-800 text-amber-300',
      },
      {
        id: 'calendar',
        title: 'ক্যাম্পাস ছুটি ও অনুষ্ঠান সূচি',
        desc: 'ছুটির দিনে বিশেষ নিরাপত্তা প্রস্তুতি দেখুন',
        icon: CalendarDays,
        iconClass: 'bg-indigo-900 text-white',
      },
    ],
  },
};

const BENGALI_MONTH_NAMES = [
  'জানুয়ারি',
  'ফেব্রুয়ারি',
  'মার্চ',
  'এপ্রিল',
  'মে',
  'জুন',
  'জুলাই',
  'আগস্ট',
  'সেপ্টেম্বর',
  'অক্টোবর',
  'নভেম্বর',
  'ডিসেম্বর',
];

function formatMonthLabelBn(monthIso: string): string {
  const [yStr, mStr] = monthIso.split('-');
  const mIdx = Number(mStr) - 1;
  const mName = BENGALI_MONTH_NAMES[mIdx] || monthIso;
  return `${mName} ${toBengaliNumber(yStr)}`;
}

export const CategoryStaffDashboardView: React.FC<CategoryStaffDashboardViewProps> = ({
  session,
  onNavigate,
}) => {
  const {
    classes,
    students,
    calendarEvents,
    staffAccounts,
    staffAttendance,
    staffLeaves,
    staffActivities,
    refreshStaffOverview,
    recordStaffAttendanceAction,
    submitStaffLeave,
    cancelStaffLeave,
    addStaffActivity,
    deleteStaffActivity,
  } = useSchool();

  const todayIso = getDhakaTodayIso();
  const [selectedMonth, setSelectedMonth] = useState<string>(() => todayIso.slice(0, 7));
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [isUpdatingAtt, setIsUpdatingAtt] = useState(false);
  const [attFeedback, setAttFeedback] = useState<string | null>(null);

  // Activity form state
  const [activityTitle, setActivityTitle] = useState('');
  const [activityDetails, setActivityDetails] = useState('');
  const [isSavingActivity, setIsSavingActivity] = useState(false);
  const [activityFeedback, setActivityFeedback] = useState<string | null>(null);

  // Leave request form & history filter state
  const [leaveType, setLeaveType] = useState<StaffLeaveType>('casual');
  const [leaveStart, setLeaveStart] = useState(todayIso);
  const [leaveEnd, setLeaveEnd] = useState(todayIso);
  const [leaveReason, setLeaveReason] = useState('');
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);
  const [leaveFeedback, setLeaveFeedback] = useState<string | null>(null);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [leaveStatusFilter, setLeaveStatusFilter] = useState<
    'all' | 'pending' | 'approved' | 'rejected'
  >('all');
  const [confirmCancelLeaveId, setConfirmCancelLeaveId] = useState<string | null>(null);
  const [cancellingLeaveId, setCancellingLeaveId] = useState<string | null>(null);

  useEffect(() => {
    void refreshStaffOverview();
  }, [refreshStaffOverview]);

  const staffProfile: StaffAccount = useMemo(() => {
    const found = staffAccounts.find((a) => a.id === session.accountId);
    if (found) return found;
    const fallbackDes = normalizeStaffDesignation(session.designationBn || session.subLabel);
    const meta = getDesignationMeta(fallbackDes);
    return {
      id: session.accountId,
      staffCode: session.staffCode || 'DL-STF',
      role: session.role === 'official' ? 'official' : 'employee',
      categoryKey: meta.key,
      nameBn: session.displayName,
      designationBn: meta.labelBn,
      phone: '',
      password: '',
      baseMonthlySalary: meta.defaultBaseSalary,
      dailyShiftHours: meta.defaultShiftHours,
      overtimeHourlyRate: meta.defaultOvertimeRatePerHour,
      status: 'active',
      createdAt: `${todayIso.slice(0, 7)}-01`,
    };
  }, [staffAccounts, session, todayIso]);

  const categoryKey = resolveStaffCategoryKey(
    staffProfile,
    session.designationBn || session.subLabel
  );
  const designationMeta = getDesignationMeta(staffProfile.designationBn);
  const visualMeta = CATEGORY_VISUALS[categoryKey];
  const RoleBadgeIcon = visualMeta.roleBadgeIcon;

  // Match open attendance record (today, or overnight unclosed record within last 18h for নৈশ প্রহরী)
  const myActiveAttendance = useMemo(() => {
    const todayRec = staffAttendance.find(
      (r) => r.staffId === staffProfile.id && r.date === todayIso
    );
    if (todayRec) return todayRec;
    if (designationMeta.isOvernightShift) {
      const openOvernight = staffAttendance.find(
        (r) =>
          r.staffId === staffProfile.id &&
          !r.checkOutTime &&
          typeof r.checkInMs === 'number' &&
          nowMs - r.checkInMs <= 18 * 3600000
      );
      if (openOvernight) return openOvernight;
    }
    return undefined;
  }, [staffAttendance, staffProfile.id, todayIso, designationMeta.isOvernightShift, nowMs]);

  useEffect(() => {
    if (!myActiveAttendance || myActiveAttendance.checkOutTime) return;
    const timer = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(timer);
  }, [myActiveAttendance?.id, myActiveAttendance?.checkOutTime]);

  const myActiveWorked = myActiveAttendance
    ? computeStaffWorkedMinutes(myActiveAttendance, nowMs)
    : null;

  // Monthly payroll, attendance, overtime, leave, absent calculations
  const payroll = useMemo(
    () =>
      computeMonthlyStaffPayroll({
        staff: staffProfile,
        attendanceRecords: staffAttendance,
        leaveRequests: staffLeaves,
        calendarEvents,
        monthIso: selectedMonth,
        todayIso,
        nowMs,
      }),
    [staffProfile, staffAttendance, staffLeaves, calendarEvents, selectedMonth, todayIso, nowMs]
  );

  const myLeaves = useMemo(
    () =>
      staffLeaves
        .filter((l) => l.staffId === staffProfile.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [staffLeaves, staffProfile.id]
  );

  const myPendingLeavesCount = useMemo(
    () => myLeaves.filter((l) => l.status === 'pending').length,
    [myLeaves]
  );
  const myApprovedLeavesCount = useMemo(
    () => myLeaves.filter((l) => l.status === 'approved').length,
    [myLeaves]
  );
  const myRejectedLeavesCount = useMemo(
    () => myLeaves.filter((l) => l.status === 'rejected').length,
    [myLeaves]
  );
  const myApprovedTotalDays = useMemo(
    () =>
      myLeaves
        .filter((l) => l.status === 'approved')
        .reduce((sum, l) => sum + (Number(l.daysCount) || 0), 0),
    [myLeaves]
  );
  const filteredMyLeaves = useMemo(
    () =>
      leaveStatusFilter === 'all'
        ? myLeaves
        : myLeaves.filter((l) => l.status === leaveStatusFilter),
    [myLeaves, leaveStatusFilter]
  );
  const calculatedLeaveDays = useMemo(
    () => computeLeaveDaysCount(leaveStart, leaveEnd),
    [leaveStart, leaveEnd]
  );

  const myActivities = useMemo(
    () =>
      staffActivities
        .filter((a) => a.staffId === staffProfile.id)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [staffActivities, staffProfile.id]
  );

  const myTodayActivitiesCount = useMemo(
    () => myActivities.filter((a) => a.date === todayIso).length,
    [myActivities, todayIso]
  );

  const handleSelfAttendance = async (action: 'checkin' | 'checkout') => {
    setIsUpdatingAtt(true);
    setAttFeedback(null);
    try {
      const saved = await recordStaffAttendanceAction(
        {
          id: staffProfile.id,
          staffCode: staffProfile.staffCode,
          nameBn: staffProfile.nameBn,
          designationBn: designationMeta.labelBn,
        },
        action
      );
      setAttFeedback(
        action === 'checkin'
          ? 'আজকের প্রবেশ (চেক-ইন) সংরক্ষিত হয়েছে ও পরিচালনা ড্যাশবোর্ডে পাঠানো হয়েছে।'
          : `প্রস্থান (চেক-আউট) রেকর্ড সম্পন্ন${saved?.workedDurationBn ? ` — মোট সময়: ${saved.workedDurationBn}` : ''}।`
      );
      setTimeout(() => setAttFeedback(null), 5000);
    } finally {
      setIsUpdatingAtt(false);
    }
  };

  const handleLogQuickDuty = async (dutyTitle: string) => {
    setIsSavingActivity(true);
    setActivityFeedback(null);
    try {
      const created = await addStaffActivity({
        staffId: staffProfile.id,
        staffNameBn: staffProfile.nameBn,
        designationBn: designationMeta.labelBn,
        date: todayIso,
        title: dutyTitle,
        details: `${designationMeta.labelBn} নির্ধারিত দৈনিক দায়িত্ব সম্পন্ন`,
      });
      if (created) {
        setActivityFeedback('দায়িত্ব সম্পন্ন হিসেবে সংরক্ষিত হয়েছে।');
        setTimeout(() => setActivityFeedback(null), 3500);
      }
    } finally {
      setIsSavingActivity(false);
    }
  };

  const handleAddCustomActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activityTitle.trim()) return;
    setIsSavingActivity(true);
    setActivityFeedback(null);
    try {
      const created = await addStaffActivity({
        staffId: staffProfile.id,
        staffNameBn: staffProfile.nameBn,
        designationBn: designationMeta.labelBn,
        date: todayIso,
        title: activityTitle.trim(),
        details: activityDetails.trim(),
      });
      if (created) {
        setActivityTitle('');
        setActivityDetails('');
        setActivityFeedback('নতুন অ্যাক্টিভিটি সফলভাবে যোগ করা হয়েছে।');
        setTimeout(() => setActivityFeedback(null), 3500);
      }
    } finally {
      setIsSavingActivity(false);
    }
  };

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeaveFeedback(null);
    setLeaveError(null);
    if (!leaveStart || !leaveEnd) {
      setLeaveError('শুরুর ও শেষের তারিখ নির্বাচন করুন।');
      return;
    }
    if (leaveEnd < leaveStart) {
      setLeaveError('শেষের তারিখ অবশ্যই শুরুর তারিখের সমান বা পরের হতে হবে।');
      return;
    }
    if (!leaveReason.trim()) {
      setLeaveError('অনুগ্রহ করে ছুটির কারণ লিখুন।');
      return;
    }
    setIsSubmittingLeave(true);
    try {
      const created = await submitStaffLeave({
        staffId: staffProfile.id,
        staffCode: staffProfile.staffCode,
        staffNameBn: staffProfile.nameBn,
        designationBn: designationMeta.labelBn,
        startDate: leaveStart,
        endDate: leaveEnd,
        leaveType,
        reason: leaveReason.trim(),
      });
      if (created) {
        setLeaveReason('');
        setLeaveStatusFilter('all');
        setLeaveFeedback(
          `মোট ${toBengaliNumber(created.daysCount)} দিনের ছুটির আবেদন জমা হয়েছে। প্রিন্সিপালের অফিসিয়াল ড্যাশবোর্ডে তাৎক্ষণিক পৌঁছে গেছে।`
        );
        setTimeout(() => setLeaveFeedback(null), 6000);
      } else {
        setLeaveError('ছুটির আবেদন পাঠানো যায়নি। তারিখ ও কারণ যাচাই করে আবার চেষ্টা করুন।');
      }
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  const handleCancelPendingLeave = async (leaveId: string) => {
    setCancellingLeaveId(leaveId);
    setLeaveFeedback(null);
    setLeaveError(null);
    try {
      const ok = await cancelStaffLeave(leaveId, staffProfile.id);
      setConfirmCancelLeaveId(null);
      if (ok) {
        setLeaveFeedback('অপেক্ষমান ছুটির আবেদন প্রত্যাহার করা হয়েছে।');
        setTimeout(() => setLeaveFeedback(null), 4500);
      } else {
        setLeaveError('আবেদনটি প্রত্যাহার করা যায়নি (সম্ভবত ইতিমধ্যে পর্যালোচিত হয়েছে)।');
      }
    } finally {
      setCancellingLeaveId(null);
    }
  };

  const assignedClassIds = staffProfile.assignedClassIds || [];
  const assignedClasses = classes.filter((c) => assignedClassIds.includes(c.id));
  const assignedStudentsCount =
    assignedClassIds.length > 0
      ? students.filter((s) => assignedClassIds.includes(s.classId)).length
      : students.length;

  return (
    <div className="space-y-6">
      {/* 1. Category-Tailored Header & Silent Live Check-In / Check-Out */}
      <section
        className={`${visualMeta.heroSurfaceClass} rounded-2xl p-6 sm:p-8 text-white border border-white/10`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-14 h-14 rounded-xl bg-white/12 border border-white/20 flex items-center justify-center shrink-0">
              <RoleBadgeIcon className="w-7 h-7 text-amber-300" />
            </div>
            <div className="min-w-0 space-y-1.5">
              <div className="text-xs text-slate-200/90 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold text-amber-300">{visualMeta.accentLabel}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono">আইডি: {staffProfile.staffCode}</span>
                <span aria-hidden="true">·</span>
                <span>{designationMeta.shiftScheduleLabelBn}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white text-balance">
                {staffProfile.nameBn}
              </h1>
              <p className="text-sm text-slate-200">{designationMeta.dashboardTitleBn}</p>
              <div className="text-xs text-slate-300 pt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>{visualMeta.workspaceSubtitle}</span>
                {categoryKey === 'teacher' && assignedClasses.length > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      শ্রেণি: {assignedClasses.map((c) => c.nameBn).join(', ')} (
                      {toBengaliNumber(assignedStudentsCount)} জন)
                    </span>
                  </>
                )}
              </div>
              <div className="pt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('employee-leave-module');
                    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/12 hover:bg-white/20 border border-white/20 text-xs font-semibold text-white transition cursor-pointer tabular-nums"
                >
                  <CalendarCheck className="w-3.5 h-3.5 text-amber-300" />
                  <span>ছুটির আবেদন ও স্ট্যাটাস</span>
                  {myPendingLeavesCount > 0 && (
                    <span className="text-amber-300 font-bold">
                      ({toBengaliNumber(myPendingLeavesCount)}টি অপেক্ষমান)
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Silent Check-In / Check-Out Panel (Zero audio on employee devices) */}
          <div className="bg-black/25 border border-white/15 rounded-xl p-4 sm:p-5 min-w-[290px] space-y-3 shrink-0">
            <div className="flex items-center justify-between text-xs text-slate-200">
              <span className="font-semibold flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-300" />
                <span>আজকের হাজিরা ও কর্মঘণ্টা</span>
              </span>
              <span className="tabular-nums font-mono text-slate-300">{todayIso}</span>
            </div>

            {myActiveAttendance ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs bg-white/10 rounded-lg px-3 py-2">
                  <span className="text-slate-200">প্রবেশ (Check-In)</span>
                  <span className="font-bold text-emerald-300 tabular-nums">
                    {myActiveAttendance.checkInTime}
                  </span>
                </div>
                {myActiveWorked && (
                  <div className="flex items-center justify-between text-xs bg-white/10 rounded-lg px-3 py-2">
                    <span className="text-slate-200">
                      {myActiveAttendance.checkOutTime ? 'মোট কাজের সময়' : 'চলমান কর্মঘণ্টা'}
                    </span>
                    <span className="font-bold text-amber-200 tabular-nums">
                      {myActiveAttendance.workedDurationBn ||
                        formatWorkedDurationBn(myActiveWorked.minutes)}
                    </span>
                  </div>
                )}
                {myActiveAttendance.checkOutTime ? (
                  <div className="flex items-center justify-between text-xs bg-white/10 rounded-lg px-3 py-2">
                    <span className="text-slate-200">প্রস্থান (Check-Out)</span>
                    <span className="font-bold text-amber-300 tabular-nums">
                      {myActiveAttendance.checkOutTime}
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isUpdatingAtt}
                    onClick={() => handleSelfAttendance('checkout')}
                    className="w-full py-2.5 px-4 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>{isUpdatingAtt ? 'সংরক্ষণ হচ্ছে...' : 'ছুটি / চেক-আউট রেকর্ড করুন'}</span>
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                disabled={isUpdatingAtt}
                onClick={() => handleSelfAttendance('checkin')}
                className="w-full py-2.5 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <LogIn className="w-4 h-4" />
                <span>{isUpdatingAtt ? 'সংরক্ষণ হচ্ছে...' : 'আজকের হাজিরা (Check-In) দিন'}</span>
              </button>
            )}

            {attFeedback && (
              <div className="text-xs font-medium text-amber-200 flex items-start gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{attFeedback}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 2. Month Filter & 5-KPI Personal Summary Strip */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-serif font-bold text-slate-900">
              মাসিক কর্মঘণ্টা, ওভারটাইম, ছুটি ও সম্ভাব্য বেতন সারসংক্ষেপ
            </h2>
            <p className="text-xs text-slate-500">
              হাজিরা, ওভারটাইম ও অনুমোদিত ছুটির ওপর ভিত্তি করে স্বয়ংক্রিয়ভাবে হিসাবকৃত ({formatMonthLabelBn(selectedMonth)})
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <label htmlFor="payroll-month-select" className="text-xs font-semibold text-slate-600">
              মাস নির্বাচন:
            </label>
            <input
              id="payroll-month-select"
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value || todayIso.slice(0, 7))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800 tabular-nums"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* Card 1: Worked Hours */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>মোট কর্মঘণ্টা</span>
              <Timer className="w-4 h-4 text-[#0F1E3D]" />
            </div>
            <div className="text-xl font-bold text-slate-900 tabular-nums">
              {formatWorkedDurationBn(payroll.totalWorkedMinutes)}
            </div>
            <div className="text-xs text-slate-500 tabular-nums">
              নির্ধারিত শিফট: {toBengaliNumber(payroll.dailyShiftHours)} ঘণ্টা/দিন
            </div>
          </div>

          {/* Card 2: Overtime */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>ওভারটাইম ও ভাতা</span>
              <Clock className="w-4 h-4 text-teal-700" />
            </div>
            <div className="text-xl font-bold text-teal-800 tabular-nums">
              {formatWorkedDurationBn(payroll.overtimeMinutes)}
            </div>
            <div className="text-xs text-teal-700 font-semibold tabular-nums">
              + ৳{toBengaliNumber(payroll.overtimeBonus)} (৳{toBengaliNumber(payroll.overtimeHourlyRate)}/ঘণ্টা)
            </div>
          </div>

          {/* Card 3: Leave */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>উপস্থিত ও ছুটি</span>
              <CalendarCheck className="w-4 h-4 text-indigo-700" />
            </div>
            <div className="text-xl font-bold text-slate-900 tabular-nums">
              উপস্থিত {toBengaliNumber(payroll.presentDays)} · ছুটি{' '}
              {toBengaliNumber(payroll.approvedLeaveDays)} দিন
            </div>
            <div className="text-xs text-slate-500 tabular-nums">
              অপেক্ষমান ছুটির আবেদন: {toBengaliNumber(payroll.pendingLeaveDays)} দিন
            </div>
          </div>

          {/* Card 4: Absent */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>অ্যাবসেন্ট (অনুপস্থিতি)</span>
              <ShieldAlert className="w-4 h-4 text-rose-700" />
            </div>
            <div className="text-xl font-bold text-rose-700 tabular-nums">
              {toBengaliNumber(payroll.absentDays)} দিন
            </div>
            <div className="text-xs text-rose-700 font-medium tabular-nums">
              কর্তন: − ৳{toBengaliNumber(payroll.absentDeduction)}
            </div>
          </div>

          {/* Card 5: Estimated Net Salary */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>সম্ভাব্য প্রাপ্য বেতন</span>
              <Wallet className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="text-2xl font-bold text-emerald-800 tabular-nums">
              ৳{toBengaliNumber(payroll.estimatedNetSalary)}
            </div>
            <div className="text-xs text-slate-500 tabular-nums">
              মূল বেতন: ৳{toBengaliNumber(payroll.baseMonthlySalary)}
            </div>
          </div>
        </div>
      </section>

      {/* 3. Transparent Payslip Breakdown + Category Activity Checklist */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Transparent Payslip Breakdown */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 font-serif">
                সম্ভাব্য বেতন ও ভাতার স্বচ্ছ বিবরণী
              </h3>
              <p className="text-xs text-slate-500">
                {formatMonthLabelBn(selectedMonth)} · মোট কার্যদিবস{' '}
                {toBengaliNumber(payroll.totalMonthlyWorkingDays)} দিন
              </p>
            </div>
            <Wallet className="w-5 h-5 text-emerald-700 shrink-0" />
          </div>

          <div className="divide-y divide-slate-100 text-xs sm:text-sm tabular-nums">
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-600">নির্ধারিত মাসিক মূল বেতন</span>
              <span className="font-bold text-slate-900">
                ৳{toBengaliNumber(payroll.baseMonthlySalary)}
              </span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-600">দৈনিক গড় হার</span>
              <span className="font-medium text-slate-700">
                ৳{toBengaliNumber(Math.round(payroll.perDaySalary))} / দিন
              </span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-600">উপস্থিত কর্মদিবস / অনুমোদিত ছুটি</span>
              <span className="font-semibold text-slate-800">
                {toBengaliNumber(payroll.presentDays)} / {toBengaliNumber(payroll.approvedLeaveDays)} দিন
              </span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-600">
                অনুপস্থিতি কর্তন ({toBengaliNumber(payroll.absentDays)} দিন)
              </span>
              <span className="font-semibold text-rose-700">
                − ৳{toBengaliNumber(payroll.absentDeduction)}
              </span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-600">
                ওভারটাইম ভাতা ({formatWorkedDurationBn(payroll.overtimeMinutes)} × ৳
                {toBengaliNumber(payroll.overtimeHourlyRate)})
              </span>
              <span className="font-semibold text-emerald-700">
                + ৳{toBengaliNumber(payroll.overtimeBonus)}
              </span>
            </div>
            <div className="pt-3 flex items-center justify-between text-base">
              <span className="font-bold text-[#0F1E3D]">সম্ভাব্য প্রাপ্য বেতন</span>
              <span className="font-extrabold text-emerald-800">
                ৳{toBengaliNumber(payroll.estimatedNetSalary)}
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-500 pt-1 leading-relaxed">
            অনুমোদিত ছুটির দিনগুলো থেকে কোনো বেতন কাটা হয় না। কেবল পূর্ববর্তী কর্মদিবসে অনুপস্থিত থাকলে দৈনিক হারে কর্তন ও অতিরিক্ত সময়ের জন্য ওভারটাইম ভাতা যোগ হয়।
          </p>
        </div>

        {/* Right: Category-Specific Activity Log & Daily Checklist */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 font-serif flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-teal-700" />
                <span>{visualMeta.dutySectionTitle}</span>
              </h3>
              <p className="text-xs text-slate-500">
                আজকের সম্পন্ন কাজ ({toBengaliNumber(myTodayActivitiesCount)}টি) · মোট সংরক্ষিত লগ{' '}
                {toBengaliNumber(myActivities.length)}টি
              </p>
            </div>
          </div>

          {/* One-Click Category Duties */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-600">
              নির্ধারিত দায়িত্ব থেকে দ্রুত লগ করুন:
            </div>
            <div className="flex flex-wrap gap-2">
              {designationMeta.defaultDutiesBn.map((duty) => (
                <button
                  key={duty}
                  type="button"
                  disabled={isSavingActivity}
                  onClick={() => handleLogQuickDuty(duty)}
                  className="text-left px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-teal-50 hover:border-teal-300 text-xs font-medium text-slate-800 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <Plus className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                  <span>{duty}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Activity Form */}
          <form onSubmit={handleAddCustomActivity} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-1">
            <input
              type="text"
              value={activityTitle}
              onChange={(e) => setActivityTitle(e.target.value)}
              placeholder="আজকের কাজের শিরোনাম লিখুন..."
              required
              className="sm:col-span-5 px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-teal-700"
            />
            <input
              type="text"
              value={activityDetails}
              onChange={(e) => setActivityDetails(e.target.value)}
              placeholder="সংক্ষিপ্ত বিবরণ (ঐচ্ছিক)"
              className="sm:col-span-5 px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-teal-700"
            />
            <button
              type="submit"
              disabled={isSavingActivity}
              className="sm:col-span-2 py-2 px-3 rounded-lg bg-[#0F1E3D] hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer whitespace-nowrap disabled:opacity-60"
            >
              সংরক্ষণ
            </button>
          </form>

          {activityFeedback && (
            <div className="text-xs font-medium text-emerald-700">{activityFeedback}</div>
          )}

          {/* Personal Activity Feed */}
          <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
            {myActivities.length === 0 ? (
              <p className="text-xs text-slate-500 py-4">
                এখনো কোনো ব্যক্তিগত অ্যাক্টিভিটি লগ নেই। উপরের দায়িত্ব বা ফর্ম থেকে প্রথম কাজটি নথিভুক্ত করুন।
              </p>
            ) : (
              myActivities.slice(0, 12).map((act) => (
                <div key={act.id} className="py-2.5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900">{act.title}</div>
                    <div className="text-[11px] text-slate-500 tabular-nums mt-0.5">
                      <span>{act.date}</span>
                      {act.details ? (
                        <>
                          <span aria-hidden="true"> · </span>
                          <span>{act.details}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteStaffActivity(act.id)}
                    title="মুছে ফেলুন"
                    className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* 4. Category Action Modules */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-serif font-bold text-slate-900">
            {designationMeta.labelBn}-এর নির্ধারিত কার্যাবলি ও টুলস
          </h2>
          <span className="text-xs text-slate-500">{visualMeta.modules.length}টি মডিউল সক্রিয়</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visualMeta.modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => onNavigate(mod.id)}
                className="text-left bg-white rounded-xl border border-slate-200 p-5 hover:border-teal-600/50 transition cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className={`w-10 h-10 rounded-xl ${mod.iconClass} flex items-center justify-center mb-3`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-base text-slate-900 group-hover:text-teal-800 transition">
                    {mod.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{mod.desc}</p>
                </div>
                <div className="pt-4 mt-2 flex items-center text-xs font-bold text-teal-800 group-hover:translate-x-1 transition">
                  প্রবেশ করুন <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 5. Leave Request Form + Monthly Daily Attendance & Overtime Table */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Leave Application & Status */}
        <div
          id="employee-leave-module"
          className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 space-y-4 scroll-mt-4"
        >
          <div className="border-b border-slate-200 pb-3 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 font-serif flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-teal-700 shrink-0" />
                <span>ছুটির আবেদন ও অনুমোদন অবস্থা</span>
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              আবেদন জমা দিলে প্রিন্সিপালের অফিসিয়াল ড্যাশবোর্ডে তাৎক্ষণিক পৌঁছে যাবে
            </p>
            <div className="text-[11px] text-slate-600 tabular-nums pt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>
                মোট অনুমোদিত:{' '}
                <strong className="text-emerald-700">
                  {toBengaliNumber(myApprovedTotalDays)} দিন
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                অপেক্ষমান:{' '}
                <strong className="text-amber-700">
                  {toBengaliNumber(myPendingLeavesCount)}টি
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                বাতিল:{' '}
                <strong className="text-rose-700">
                  {toBengaliNumber(myRejectedLeavesCount)}টি
                </strong>
              </span>
            </div>
          </div>

          <form onSubmit={handleLeaveSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ছুটির ধরন
                </label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value as StaffLeaveType)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium bg-white"
                >
                  {Object.entries(LEAVE_TYPE_LABELS).map(([k, lbl]) => (
                    <option key={k} value={k}>
                      {lbl}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  শুরুর তারিখ
                </label>
                <input
                  type="date"
                  value={leaveStart}
                  onChange={(e) => {
                    const nextStart = e.target.value;
                    setLeaveStart(nextStart);
                    if (nextStart && leaveEnd && leaveEnd < nextStart) {
                      setLeaveEnd(nextStart);
                    }
                    setLeaveError(null);
                  }}
                  required
                  className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  শেষ তারিখ
                </label>
                <input
                  type="date"
                  value={leaveEnd}
                  min={leaveStart}
                  onChange={(e) => {
                    setLeaveEnd(e.target.value);
                    setLeaveError(null);
                  }}
                  required
                  className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-xs tabular-nums"
                />
              </div>
            </div>

            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs tabular-nums">
              <span className="text-slate-600 font-medium">হিসাবকৃত মোট ছুটির মেয়াদ</span>
              <span
                className={`font-bold ${
                  calculatedLeaveDays > 0 ? 'text-[#0F1E3D]' : 'text-rose-700'
                }`}
              >
                {calculatedLeaveDays > 0
                  ? `${toBengaliNumber(calculatedLeaveDays)} দিন`
                  : 'অবৈধ তারিখ'}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ছুটির কারণ ও বিবরণ
              </label>
              <textarea
                rows={2}
                value={leaveReason}
                onChange={(e) => {
                  setLeaveReason(e.target.value);
                  setLeaveError(null);
                }}
                maxLength={500}
                placeholder="ছুটির কারণ স্পষ্টভাবে লিখুন (যেমন: পারিবারিক জরুরি কাজ / অসুস্থতা)..."
                required
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmittingLeave || calculatedLeaveDays === 0}
              className="w-full py-2.5 px-3 rounded-lg bg-teal-800 hover:bg-teal-900 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {isSubmittingLeave
                  ? 'প্রিন্সিপালের নিকট পাঠানো হচ্ছে...'
                  : 'ছুটির আবেদন জমা দিন'}
              </span>
            </button>
          </form>

          {leaveError && (
            <div className="px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800">
              {leaveError}
            </div>
          )}

          {leaveFeedback && (
            <div className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800 flex items-start gap-1.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700" />
              <span>{leaveFeedback}</span>
            </div>
          )}

          {/* Filter Tabs for Personal Leave History */}
          <div className="pt-2 border-t border-slate-200 space-y-2.5">
            <div className="flex flex-wrap items-center gap-1.5 tabular-nums">
              {(
                [
                  { id: 'all', label: `সকল (${toBengaliNumber(myLeaves.length)})` },
                  { id: 'pending', label: `অপেক্ষমান (${toBengaliNumber(myPendingLeavesCount)})` },
                  { id: 'approved', label: `অনুমোদিত (${toBengaliNumber(myApprovedLeavesCount)})` },
                  { id: 'rejected', label: `বাতিল (${toBengaliNumber(myRejectedLeavesCount)})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setLeaveStatusFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition cursor-pointer ${
                    leaveStatusFilter === tab.id
                      ? 'bg-[#0F1E3D] text-white border-[#0F1E3D]'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
              {filteredMyLeaves.length === 0 ? (
                <p className="text-xs text-slate-500 py-3">
                  {myLeaves.length === 0
                    ? 'এখনো কোনো ছুটির আবেদন করা হয়নি।'
                    : 'এই ফিল্টারে কোনো ছুটির আবেদন নেই।'}
                </p>
              ) : (
                filteredMyLeaves.slice(0, 20).map((lr) => (
                  <div key={lr.id} className="py-2.5 space-y-1.5 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900">
                          {LEAVE_TYPE_LABELS[lr.leaveType] || lr.leaveType}{' '}
                          <span aria-hidden="true">·</span>{' '}
                          <span className="tabular-nums">
                            {toBengaliNumber(lr.daysCount)} দিন
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 tabular-nums mt-0.5">
                          {lr.startDate} থেকে {lr.endDate}
                        </div>
                      </div>
                      <span
                        className={`font-bold whitespace-nowrap shrink-0 ${
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

                    <div className="text-[11px] text-slate-700 leading-relaxed">{lr.reason}</div>

                    {(lr.reviewedBy || lr.reviewNote) && (
                      <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2">
                        {lr.reviewedBy && <span>সিদ্ধান্ত: {lr.reviewedBy}</span>}
                        {lr.reviewNote && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-slate-700">মন্তব্য: {lr.reviewNote}</span>
                          </>
                        )}
                      </div>
                    )}

                    {lr.status === 'pending' && (
                      <div className="pt-0.5 flex items-center gap-2">
                        {confirmCancelLeaveId === lr.id ? (
                          <div className="inline-flex items-center gap-1.5 text-[11px]">
                            <span className="text-rose-700 font-semibold">প্রত্যাহার করবেন?</span>
                            <button
                              type="button"
                              disabled={cancellingLeaveId === lr.id}
                              onClick={() => handleCancelPendingLeave(lr.id)}
                              className="px-2 py-0.5 rounded bg-rose-700 hover:bg-rose-800 text-white font-bold cursor-pointer disabled:opacity-60"
                            >
                              {cancellingLeaveId === lr.id ? '...' : 'হ্যাঁ'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmCancelLeaveId(null)}
                              className="px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-700 font-semibold cursor-pointer"
                            >
                              না
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmCancelLeaveId(lr.id)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 hover:text-rose-800 cursor-pointer"
                          >
                            <XCircle className="w-3 h-3" />
                            <span>আবেদন প্রত্যাহার করুন</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Monthly Attendance & Overtime Table */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="border-b border-slate-200 pb-3 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 font-serif">
                মাসিক দৈনিক হাজিরা, কর্মঘণ্টা ও ওভারটাইম খতিয়ান
              </h3>
              <p className="text-xs text-slate-500">
                {formatMonthLabelBn(selectedMonth)} — মোট {toBengaliNumber(payroll.dailyRows.length)} দিনের লগ
              </p>
            </div>
          </div>

          {payroll.dailyRows.length === 0 ? (
            <p className="text-xs text-slate-500 py-6">
              এই মাসে এখনো কোনো হাজিরা রেকর্ড নেই। উপরের &quot;আজকের হাজিরা (Check-In) দিন&quot; বাটনে ক্লিক করে শুরু করুন।
            </p>
          ) : (
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-3 font-semibold">তারিখ</th>
                    <th className="py-2 px-3 font-semibold">প্রবেশ</th>
                    <th className="py-2 px-3 font-semibold">প্রস্থান</th>
                    <th className="py-2 px-3 font-semibold">মোট কর্মঘণ্টা</th>
                    <th className="py-2 px-3 font-semibold">ওভারটাইম</th>
                    <th className="py-2 pl-3 font-semibold text-right">অবস্থা</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {payroll.dailyRows.map(({ record, workedMinutes, overtimeMinutes }) => (
                    <tr key={record.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 pr-3 font-medium text-slate-800">{record.date}</td>
                      <td className="py-2.5 px-3 text-emerald-700 font-semibold">
                        {record.checkInTime}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {record.checkOutTime || 'কর্মরত'}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-[#0F1E3D]">
                        {record.workedDurationBn || formatWorkedDurationBn(workedMinutes)}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-teal-700">
                        {overtimeMinutes > 0 ? formatWorkedDurationBn(overtimeMinutes) : '—'}
                      </td>
                      <td className="py-2.5 pl-3 text-right font-semibold text-slate-700">
                        {record.status === 'leave'
                          ? 'ছুটি'
                          : record.checkOutTime
                          ? 'সম্পন্ন'
                          : 'উপস্থিত'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
