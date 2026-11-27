import {
  AcademicCalendarEvent,
  StaffAccount,
  StaffAttendanceRecord,
  StaffCategoryKey,
  StaffLeaveRequest,
  StaffLeaveType,
} from '../types';
import { normalizeBengaliDigits, toBengaliNumber } from './bengali';

export const LEAVE_TYPE_LABELS: Record<StaffLeaveType, string> = {
  casual: 'নৈমিত্তিক ছুটি (CL)',
  sick: 'অসুস্থতা ছুটি (SL)',
  earned: 'অর্জিত ছুটি (EL)',
  emergency: 'জরুরি ছুটি',
};

export function computeLeaveDaysCount(startDate: string, endDate: string): number {
  const startMs = Date.parse(`${startDate}T00:00:00Z`);
  const endMs = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return 0;
  }
  return Math.min(60, Math.floor((endMs - startMs) / 86400000) + 1);
}

export interface CanonicalStaffDesignation {
  order: number;
  key: StaffCategoryKey;
  labelBn: string;
  dashboardTitleBn: string;
  shiftScheduleLabelBn: string;
  defaultRole: 'official' | 'employee';
  defaultDepartment: 'administration' | 'academic' | 'accounts' | 'security' | 'office';
  defaultShiftHours: number;
  defaultBaseSalary: number;
  defaultOvertimeRatePerHour: number;
  isOvernightShift?: boolean;
  defaultDutiesBn: string[];
}

export const STAFF_DESIGNATIONS: CanonicalStaffDesignation[] = [
  {
    order: 1,
    key: 'education_entrepreneur',
    labelBn: 'শিক্ষা উদ্যোক্তা',
    dashboardTitleBn: 'শিক্ষা উদ্যোক্তা পরিচালনা ও বিনিয়োগ তদারকি ড্যাশবোর্ড',
    shiftScheduleLabelBn: 'দৈনিক ৬ ঘণ্টা তদারকি (নমনীয়)',
    defaultRole: 'official',
    defaultDepartment: 'administration',
    defaultShiftHours: 6,
    defaultBaseSalary: 25000,
    defaultOvertimeRatePerHour: 250,
    defaultDutiesBn: [
      'প্রতিষ্ঠানের দৈনিক উপস্থিতি ও একাডেমিক অগ্রগতি পর্যালোচনা',
      'আর্থিক আয়-ব্যয় ও ফি আদায় রিপোর্ট যাচাই',
      'বোর্ড মিটিং ও অভিভাবক মতবিনিময় সমন্বয়',
    ],
  },
  {
    order: 2,
    key: 'principal',
    labelBn: 'প্রিন্সিপাল',
    dashboardTitleBn: 'প্রিন্সিপাল নির্বাহী ও একাডেমিক নেতৃত্ব ড্যাশবোর্ড',
    shiftScheduleLabelBn: 'সকাল ৮:০০ – বিকাল ৪:০০ (৮ ঘণ্টা)',
    defaultRole: 'official',
    defaultDepartment: 'administration',
    defaultShiftHours: 8,
    defaultBaseSalary: 28000,
    defaultOvertimeRatePerHour: 250,
    defaultDutiesBn: [
      'শিক্ষক ও কর্মচারীদের দৈনিক উপস্থিতি ও ক্লাস মনিটরিং',
      'পরীক্ষা নিয়ন্ত্রণ, ফলাফল অনুমোদন ও অভিভাবক সাক্ষাৎ',
      'ছুটির আবেদন অনুমোদন ও প্রাতিষ্ঠানিক সিদ্ধান্ত গ্রহণ',
    ],
  },
  {
    order: 3,
    key: 'vice_principal',
    labelBn: 'সহ অধ্যক্ষ',
    dashboardTitleBn: 'সহ অধ্যক্ষ ও একাডেমিক সমন্বয় ড্যাশবোর্ড',
    shiftScheduleLabelBn: 'সকাল ৮:০০ – বিকাল ৪:০০ (৮ ঘণ্টা)',
    defaultRole: 'official',
    defaultDepartment: 'administration',
    defaultShiftHours: 8,
    defaultBaseSalary: 22000,
    defaultOvertimeRatePerHour: 200,
    defaultDutiesBn: [
      'দৈনিক ক্লাস রুটিন, প্রক্সি ক্লাস ও শৃঙ্খলা তদারকি',
      'ট্যাবুল্যাশন শিট, প্রবেশপত্র ও আসন বিন্যাস যাচাই',
      'শিক্ষকদের একাডেমিক নোট ও প্রশ্নপত্র সমন্বয়',
    ],
  },
  {
    order: 4,
    key: 'accountant_clerk',
    labelBn: 'একাউন্টেন্ট কম কেরানী',
    dashboardTitleBn: 'একাউন্টেন্ট কম কেরানী — হিসাব, ফি ও দাপ্তরিক ড্যাশবোর্ড',
    shiftScheduleLabelBn: 'সকাল ৮:৩০ – বিকাল ৪:৩০ (৮ ঘণ্টা)',
    defaultRole: 'employee',
    defaultDepartment: 'accounts',
    defaultShiftHours: 8,
    defaultBaseSalary: 16000,
    defaultOvertimeRatePerHour: 150,
    defaultDutiesBn: [
      'শিক্ষার্থীদের মাসিক ফি আদায় ও মানি রিসিট প্রদান',
      'দৈনিক ক্যাশ সমাপনী ও বকেয়া তালিকা হালনাগাদ',
      'ভর্তি রেজিস্টার, ভাউচার ও দাপ্তরিক চিঠিপত্র সংরক্ষণ',
    ],
  },
  {
    order: 5,
    key: 'teacher',
    labelBn: 'শিক্ষক',
    dashboardTitleBn: 'শিক্ষক ও শ্রেণি পাঠদান ড্যাশবোর্ড',
    shiftScheduleLabelBn: 'সকাল ৮:৩০ – বিকাল ৩:৩০ (৭ ঘণ্টা)',
    defaultRole: 'employee',
    defaultDepartment: 'academic',
    defaultShiftHours: 7,
    defaultBaseSalary: 14000,
    defaultOvertimeRatePerHour: 150,
    defaultDutiesBn: [
      'শ্রেণি কক্ষে পাঠদান ও দৈনিক শিক্ষার্থী হাজিরা গ্রহণ',
      'বাড়ির কাজ, ক্লাস নোট ও ডিজিটাল লাইব্রেরি রিসোর্স আপলোড',
      'পরীক্ষার খাতা মূল্যায়ন ও বিষয়ভিত্তিক মার্ক এন্ট্রি',
    ],
  },
  {
    order: 6,
    key: 'office_assistant',
    labelBn: 'দপ্তরী',
    dashboardTitleBn: 'দপ্তরী — ঘণ্টা, গেট ও দাপ্তরিক সহায়তা ড্যাশবোর্ড',
    shiftScheduleLabelBn: 'সকাল ৮:০০ – বিকাল ৪:০০ (৮ ঘণ্টা)',
    defaultRole: 'employee',
    defaultDepartment: 'office',
    defaultShiftHours: 8,
    defaultBaseSalary: 10000,
    defaultOvertimeRatePerHour: 100,
    defaultDutiesBn: [
      'সময়মতো ক্লাস ঘণ্টা বাজানো ও অফিস কক্ষ প্রস্তুত রাখা',
      'স্কুল গেটপাস স্ক্যানিং ও শ্রেণিকক্ষে নোটিশ বিতরণ',
      'প্রশাসনিক ফাইল, পানি ও অতিথি আপ্যায়ন সহায়তা',
    ],
  },
  {
    order: 7,
    key: 'ayah',
    labelBn: 'আয়া',
    dashboardTitleBn: 'আয়া — শিশু যত্ন, পরিচ্ছন্নতা ও নিরাপত্তা ড্যাশবোর্ড',
    shiftScheduleLabelBn: 'সকাল ৮:০০ – বিকাল ৪:০০ (৮ ঘণ্টা)',
    defaultRole: 'employee',
    defaultDepartment: 'office',
    defaultShiftHours: 8,
    defaultBaseSalary: 8500,
    defaultOvertimeRatePerHour: 80,
    defaultDutiesBn: [
      'প্লে, নার্সারি ও কেজি শ্রেণির শিশুদের যত্ন ও ওয়াশরুম সহায়তা',
      'শ্রেণিকক্ষ ও করিডোর পরিষ্কার-পরিচ্ছন্ন রাখা',
      'ছুটির সময় ছোট শিক্ষার্থীদের নিরাপদে অভিভাবকের হাতে তুলে দেওয়া',
    ],
  },
  {
    order: 8,
    key: 'night_guard',
    labelBn: 'নৈশ প্রহরী',
    dashboardTitleBn: 'নৈশ প্রহরী — রাত্রিকালীন নিরাপত্তা ও টহল ড্যাশবোর্ড',
    shiftScheduleLabelBn: 'রাত ৮:০০ – সকাল ৬:০০ (১০ ঘণ্টা নাইট শিফট)',
    defaultRole: 'employee',
    defaultDepartment: 'security',
    defaultShiftHours: 10,
    defaultBaseSalary: 10500,
    defaultOvertimeRatePerHour: 90,
    isOvernightShift: true,
    defaultDutiesBn: [
      'মূল গেট, শ্রেণিকক্ষ ও অফিস কক্ষের তালা-চাবি যাচাই',
      'রাত্রিকালীন ক্যাম্পাস টহল ও বিদ্যুৎ/পানির লাইন পরীক্ষা',
      'সকালবেলা দায়িত্ব হস্তান্তর ও নিরাপত্তা লগ নথিভুক্তি',
    ],
  },
];

export function normalizeStaffDesignation(raw?: string | null): string {
  const clean = (raw || '').trim();
  if (!clean) return 'শিক্ষক';

  const exact = STAFF_DESIGNATIONS.find((d) => d.labelBn === clean);
  if (exact) return exact.labelBn;

  if (
    clean.includes('সহ অধ্যক্ষ') ||
    clean.includes('সহ-অধ্যক্ষ') ||
    clean.includes('সহকারী প্রিন্সিপাল') ||
    clean.includes('সহাকারী প্রিন্সিপাল') ||
    clean.includes('উপ-অধ্যক্ষ') ||
    clean.includes('অফিস প্রশাসক')
  ) {
    return 'সহ অধ্যক্ষ';
  }
  if (clean.includes('শিক্ষা উদ্যোক্তা') || clean.includes('উদ্যোক্তা')) {
    return 'শিক্ষা উদ্যোক্তা';
  }
  if (clean.includes('প্রিন্সিপাল') || clean.includes('অধ্যক্ষ') || clean.includes('প্রধান শিক্ষক')) {
    return 'প্রিন্সিপাল';
  }
  if (
    clean.includes('একাউন্টেন্ট') ||
    clean.includes('অ্যাকাউন্টেন্ট') ||
    clean.includes('কেরানী') ||
    clean.includes('কেরানি') ||
    clean.includes('হিসাবরক্ষক')
  ) {
    return 'একাউন্টেন্ট কম কেরানী';
  }
  if (clean.includes('দপ্তরী') || clean.includes('দপ্তরি') || clean.includes('পিয়ন')) {
    return 'দপ্তরী';
  }
  if (clean.includes('আয়া') || clean.includes('আয়া')) {
    return 'আয়া';
  }
  if (
    clean.includes('নৈশ প্রহরী') ||
    clean.includes('প্রহরী নৈশ্য') ||
    clean.includes('নৈশ্য') ||
    clean.includes('নৈশ') ||
    clean.includes('রাত্রিকালীন') ||
    clean.includes('প্রহরী') ||
    clean.includes('গার্ড')
  ) {
    return 'নৈশ প্রহরী';
  }
  if (clean.includes('শিক্ষক') || clean.includes('টিচার')) {
    return 'শিক্ষক';
  }
  return clean;
}

export function getDesignationMeta(designationBn?: string | null): CanonicalStaffDesignation {
  const normalized = normalizeStaffDesignation(designationBn);
  return (
    STAFF_DESIGNATIONS.find((d) => d.labelBn === normalized) ||
    STAFF_DESIGNATIONS.find((d) => d.key === 'teacher')!
  );
}

export function resolveStaffCategoryKey(
  staff?: Pick<StaffAccount, 'categoryKey' | 'designationBn' | 'role'> | null,
  fallbackDesignation?: string
): StaffCategoryKey {
  if (staff?.categoryKey && STAFF_DESIGNATIONS.some((d) => d.key === staff.categoryKey)) {
    return staff.categoryKey;
  }
  const meta = getDesignationMeta(staff?.designationBn || fallbackDesignation);
  return meta.key;
}

export function isOfficialAuthorizerAccount(
  staff?: Pick<StaffAccount, 'categoryKey' | 'designationBn' | 'role'> | null
): boolean {
  if (!staff) return false;
  const cat = resolveStaffCategoryKey(staff);
  return cat === 'principal' || cat === 'education_entrepreneur';
}

export function getDesignationOrder(designationBn?: string | null): number {
  return getDesignationMeta(designationBn)?.order ?? 99;
}

export function getDhakaTodayIso(baseDate = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(baseDate);
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // Fallback below
  }
  return baseDate.toISOString().split('T')[0];
}

export function parseTimeLabelToEpochMs(dateIso: string, timeLabel?: string | null): number | null {
  if (!dateIso || !timeLabel) return null;
  const norm = normalizeBengaliDigits(timeLabel).trim();
  const match = norm.match(/(\d{1,2})\s*:\s*(\d{2})(?:\s*(AM|PM|am|pm))?/);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = (match[3] || '').toUpperCase();

  if (Number.isNaN(hours) || Number.isNaN(minutes) || minutes < 0 || minutes > 59) {
    return null;
  }

  if (ampm === 'PM' && hours < 12) hours += 12;
  else if (ampm === 'AM' && hours === 12) hours = 0;
  else if (!ampm) {
    if (norm.includes('বিকাল') || norm.includes('সন্ধ্যা') || norm.includes('রাত')) {
      if (hours >= 1 && hours < 12) hours += 12;
    } else if (norm.includes('দুপুর') && hours >= 1 && hours <= 5) {
      hours += 12;
    }
  }

  if (hours < 0 || hours > 23) return null;
  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const parsed = Date.parse(`${dateIso}T${hh}:${mm}:00+06:00`);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatWorkedDurationBn(totalMinutes: number): string {
  const mins = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours === 0) {
    return `${toBengaliNumber(remMins)} মিনিট`;
  }
  if (remMins === 0) {
    return `${toBengaliNumber(hours)} ঘণ্টা`;
  }
  return `${toBengaliNumber(hours)} ঘণ্টা ${toBengaliNumber(remMins)} মিনিট`;
}

export function computeStaffWorkedMinutes(
  record: Pick<
    StaffAttendanceRecord,
    'date' | 'checkInTime' | 'checkOutTime' | 'checkInMs' | 'checkOutMs' | 'workedMinutes'
  > | null | undefined,
  nowMs = Date.now()
): {
  minutes: number;
  isOngoing: boolean;
  checkInMs: number | null;
  checkOutMs: number | null;
} {
  if (!record) {
    return { minutes: 0, isOngoing: false, checkInMs: null, checkOutMs: null };
  }

  const checkInMs =
    typeof record.checkInMs === 'number' && record.checkInMs > 0
      ? record.checkInMs
      : parseTimeLabelToEpochMs(record.date, record.checkInTime);

  const hasCheckedOut =
    Boolean(record.checkOutTime) || (typeof record.checkOutMs === 'number' && record.checkOutMs > 0);
  if (hasCheckedOut) {
    let checkOutMs =
      typeof record.checkOutMs === 'number' && record.checkOutMs > 0
        ? record.checkOutMs
        : parseTimeLabelToEpochMs(record.date, record.checkOutTime);

    if (typeof record.workedMinutes === 'number' && record.workedMinutes >= 0) {
      return {
        minutes: Math.round(record.workedMinutes),
        isOngoing: false,
        checkInMs,
        checkOutMs,
      };
    }

    if (checkInMs !== null && checkOutMs !== null) {
      if (checkOutMs < checkInMs) {
        // Overnight shift wrap (e.g. নৈশ প্রহরী)
        checkOutMs += 24 * 60 * 60 * 1000;
      }
      const diffMins = Math.max(0, Math.round((checkOutMs - checkInMs) / 60000));
      return {
        minutes: diffMins,
        isOngoing: false,
        checkInMs,
        checkOutMs,
      };
    }

    return { minutes: 0, isOngoing: false, checkInMs, checkOutMs };
  }

  if (checkInMs !== null) {
    const liveMins = Math.max(0, Math.round((nowMs - checkInMs) / 60000));
    return {
      minutes: liveMins,
      isOngoing: true,
      checkInMs,
      checkOutMs: null,
    };
  }

  return { minutes: 0, isOngoing: false, checkInMs: null, checkOutMs: null };
}

export interface MonthlyPayrollSummary {
  monthIso: string; // YYYY-MM
  totalMonthlyWorkingDays: number;
  elapsedWorkingDays: number;
  presentDays: number;
  lateDays: number;
  approvedLeaveDays: number;
  pendingLeaveDays: number;
  absentDays: number;
  totalWorkedMinutes: number;
  expectedShiftMinutes: number;
  dailyShiftHours: number;
  overtimeMinutes: number;
  baseMonthlySalary: number;
  overtimeHourlyRate: number;
  perDaySalary: number;
  absentDeduction: number;
  overtimeBonus: number;
  estimatedNetSalary: number;
  dailyRows: Array<{
    record: StaffAttendanceRecord;
    workedMinutes: number;
    overtimeMinutes: number;
  }>;
}

function expandDateRangeIso(startIso: string, endIso: string): string[] {
  const startMs = Date.parse(`${startIso}T00:00:00Z`);
  const endMs = Date.parse(`${endIso}T00:00:00Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return [];
  const dates: string[] = [];
  const maxDays = 60;
  for (let ms = startMs, i = 0; ms <= endMs && i < maxDays; ms += 86400000, i++) {
    dates.push(new Date(ms).toISOString().slice(0, 10));
  }
  return dates;
}

export function computeMonthlyStaffPayroll(params: {
  staff: StaffAccount;
  attendanceRecords: StaffAttendanceRecord[];
  leaveRequests: StaffLeaveRequest[];
  calendarEvents?: AcademicCalendarEvent[];
  monthIso?: string;
  todayIso?: string;
  nowMs?: number;
}): MonthlyPayrollSummary {
  const todayIso = params.todayIso || getDhakaTodayIso();
  const monthIso = params.monthIso || todayIso.slice(0, 7);
  const nowMs = params.nowMs ?? Date.now();
  const meta = getDesignationMeta(params.staff.designationBn);

  const dailyShiftHours =
    typeof params.staff.dailyShiftHours === 'number' && params.staff.dailyShiftHours > 0
      ? params.staff.dailyShiftHours
      : meta.defaultShiftHours;
  const baseMonthlySalary =
    typeof params.staff.baseMonthlySalary === 'number' && params.staff.baseMonthlySalary >= 0
      ? params.staff.baseMonthlySalary
      : meta.defaultBaseSalary;
  const overtimeHourlyRate =
    typeof params.staff.overtimeHourlyRate === 'number' && params.staff.overtimeHourlyRate >= 0
      ? params.staff.overtimeHourlyRate
      : meta.defaultOvertimeRatePerHour;

  const [yearStr, monStr] = monthIso.split('-');
  const year = Number(yearStr) || new Date().getFullYear();
  const month = Number(monStr) || new Date().getMonth() + 1;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  // Holiday dates from AcademicCalendarEvent
  const holidayDates = new Set<string>();
  for (const ev of params.calendarEvents || []) {
    if (ev.type === 'holiday' && ev.startDate) {
      const dates = expandDateRangeIso(ev.startDate, ev.endDate || ev.startDate);
      for (const d of dates) holidayDates.add(d);
    }
  }

  // Filter attendance for this staff in this month
  const staffMonthlyAtt = params.attendanceRecords
    .filter((r) => r && r.staffId === params.staff.id && r.date.startsWith(monthIso))
    .sort((a, b) => b.date.localeCompare(a.date));

  const presentDates = new Set<string>();
  const lateDates = new Set<string>();
  const attLeaveDates = new Set<string>();

  const shiftMins = dailyShiftHours * 60;
  let totalWorkedMinutes = 0;
  let overtimeMinutes = 0;

  const dailyRows = staffMonthlyAtt.map((rec) => {
    const calc = computeStaffWorkedMinutes(rec, rec.date === todayIso ? nowMs : nowMs);
    const worked = calc.minutes;
    const isHolidayOrFriday = (() => {
      const dt = new Date(`${rec.date}T00:00:00Z`);
      const isFri = !Number.isNaN(dt.getTime()) && dt.getUTCDay() === 5;
      return !meta.isOvernightShift && (isFri || holidayDates.has(rec.date));
    })();

    const ot =
      rec.status === 'leave'
        ? 0
        : isHolidayOrFriday
        ? worked
        : Math.max(0, worked - shiftMins);

    if (rec.status === 'leave') {
      attLeaveDates.add(rec.date);
    } else {
      presentDates.add(rec.date);
      if (rec.status === 'late') lateDates.add(rec.date);
      totalWorkedMinutes += worked;
      overtimeMinutes += ot;
    }

    return {
      record: rec,
      workedMinutes: worked,
      overtimeMinutes: ot,
    };
  });

  // Approved & pending leave dates within this month
  const approvedLeaveDates = new Set<string>(attLeaveDates);
  const pendingLeaveDates = new Set<string>();
  for (const lr of params.leaveRequests) {
    if (!lr || lr.staffId !== params.staff.id) continue;
    const dates = expandDateRangeIso(lr.startDate, lr.endDate);
    for (const d of dates) {
      if (!d.startsWith(monthIso)) continue;
      if (lr.status === 'approved') approvedLeaveDates.add(d);
      else if (lr.status === 'pending') pendingLeaveDates.add(d);
    }
  }

  // Tracking start anchor: don't penalize historical days prior to account creation if created in same month
  const createdDateIso =
    typeof params.staff.createdAt === 'string' && /^\d{4}-\d{2}-\d{2}/.test(params.staff.createdAt)
      ? params.staff.createdAt.slice(0, 10)
      : `${monthIso}-01`;

  let totalMonthlyWorkingDays = 0;
  let elapsedWorkingDays = 0;
  let absentDays = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const dateIso = `${monthIso}-${String(day).padStart(2, '0')}`;
    const dt = new Date(Date.UTC(year, month - 1, day));
    const isFriday = !meta.isOvernightShift && dt.getUTCDay() === 5;
    const isHoliday = !meta.isOvernightShift && holidayDates.has(dateIso);
    if (isFriday || isHoliday) continue;

    totalMonthlyWorkingDays += 1;

    // Only count absent on strictly past working days (or current month past days >= createdDateIso)
    const isPastDay = dateIso < todayIso;
    const isAfterJoin = dateIso >= createdDateIso;
    if (isPastDay && isAfterJoin) {
      elapsedWorkingDays += 1;
      if (!presentDates.has(dateIso) && !approvedLeaveDates.has(dateIso)) {
        absentDays += 1;
      }
    } else if (dateIso === todayIso && presentDates.has(dateIso)) {
      elapsedWorkingDays += 1;
    }
  }

  const effectiveWorkingBase = Math.max(1, totalMonthlyWorkingDays);
  const perDaySalary = baseMonthlySalary / effectiveWorkingBase;
  const absentDeduction = Math.round(absentDays * perDaySalary);
  const overtimeBonus = Math.round((overtimeMinutes / 60) * overtimeHourlyRate);
  const estimatedNetSalary = Math.max(
    0,
    Math.round(baseMonthlySalary - absentDeduction + overtimeBonus)
  );

  return {
    monthIso,
    totalMonthlyWorkingDays,
    elapsedWorkingDays,
    presentDays: presentDates.size,
    lateDays: lateDates.size,
    approvedLeaveDays: approvedLeaveDates.size,
    pendingLeaveDays: pendingLeaveDates.size,
    absentDays,
    totalWorkedMinutes,
    expectedShiftMinutes: Math.max(presentDates.size, elapsedWorkingDays) * shiftMins,
    dailyShiftHours,
    overtimeMinutes,
    baseMonthlySalary,
    overtimeHourlyRate,
    perDaySalary,
    absentDeduction,
    overtimeBonus,
    estimatedNetSalary,
    dailyRows,
  };
}
