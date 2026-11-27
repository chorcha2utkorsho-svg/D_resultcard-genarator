import {
  PortalAuthSession,
  PortalRole,
  SchoolClass,
  StaffAccount,
  StaffActivityLog,
  StaffAttendanceRecord,
  StaffLeaveRequest,
  Student,
} from '../types';
import { INITIAL_STUDENTS } from '../data/defaultData';
import { getStudentPortalId, normalizeBengaliDigits } from './bengali';
import { CANONICAL_STAFF_ROSTER, mergeCanonicalStaffRoster } from './staffDirectorySeed';
import {
  getDesignationMeta,
  normalizeStaffDesignation,
  resolveStaffCategoryKey,
} from './staffDesignations';
import { ensureUniqueStudentCredentials } from './credentialGenerator';

const LOCAL_STAFF_KEY = 'dlikon_local_staff_accounts_v2';
const LOCAL_STAFF_ATT_KEY = 'dlikon_local_staff_attendance_v1';
const LOCAL_STAFF_LEAVES_KEY = 'dlikon_local_staff_leaves_v1';
const LOCAL_STAFF_ACTIVITIES_KEY = 'dlikon_local_staff_activities_v1';

export const DEFAULT_STARTER_STAFF: StaffAccount[] = CANONICAL_STAFF_ROSTER;

export function getLocalStaffAccounts(): StaffAccount[] {
  try {
    const raw =
      localStorage.getItem(LOCAL_STAFF_KEY) ||
      localStorage.getItem('dlikon_local_staff_accounts_v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return mergeCanonicalStaffRoster(parsed);
      }
    }
  } catch {
    // Ignore storage read errors
  }
  return CANONICAL_STAFF_ROSTER;
}

export function saveLocalStaffAccounts(accounts: StaffAccount[]): void {
  try {
    localStorage.setItem(LOCAL_STAFF_KEY, JSON.stringify(mergeCanonicalStaffRoster(accounts)));
  } catch {
    // Ignore storage write errors
  }
}

export function getLocalStaffAttendance(): StaffAttendanceRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STAFF_ATT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Ignore storage read errors
  }
  return [];
}

export function saveLocalStaffAttendance(records: StaffAttendanceRecord[]): void {
  try {
    localStorage.setItem(LOCAL_STAFF_ATT_KEY, JSON.stringify(records));
  } catch {
    // Ignore storage write errors
  }
}

export function getLocalStaffLeaves(): StaffLeaveRequest[] {
  try {
    const raw = localStorage.getItem(LOCAL_STAFF_LEAVES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Ignore storage read errors
  }
  return [];
}

export function saveLocalStaffLeaves(leaves: StaffLeaveRequest[]): void {
  try {
    localStorage.setItem(LOCAL_STAFF_LEAVES_KEY, JSON.stringify(leaves));
  } catch {
    // Ignore storage write errors
  }
}

export function getLocalStaffActivities(): StaffActivityLog[] {
  try {
    const raw = localStorage.getItem(LOCAL_STAFF_ACTIVITIES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Ignore storage read errors
  }
  return [];
}

export function saveLocalStaffActivities(activities: StaffActivityLog[]): void {
  try {
    localStorage.setItem(LOCAL_STAFF_ACTIVITIES_KEY, JSON.stringify(activities));
  } catch {
    // Ignore storage write errors
  }
}

export async function safeFetchJson(
  url: string,
  options?: RequestInit,
  timeoutMs = 7000
): Promise<{ reachable: boolean; ok: boolean; status: number; data: any }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      cache: 'no-store',
      credentials: 'same-origin',
      signal: controller.signal,
    });
    clearTimeout(timer);
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return { reachable: false, ok: false, status: res.status, data: null };
    }
    const data = await res.json();
    return { reachable: true, ok: res.ok, status: res.status, data };
  } catch {
    clearTimeout(timer);
    return { reachable: false, ok: false, status: 0, data: null };
  }
}

export function authenticateLocally(params: {
  role: PortalRole;
  identifier: string;
  password: string;
  classId?: string;
  students: Student[];
  classes: SchoolClass[];
}): {
  success: boolean;
  message?: string;
  session?: PortalAuthSession;
  student?: Student;
} {
  const { role, identifier, password, classId, classes } = params;
  const rawPool = params.students && params.students.length > 0 ? params.students : INITIAL_STUDENTS;
  const studentPool = ensureUniqueStudentCredentials(rawPool);

  const rawId = identifier.trim();
  const normId = normalizeBengaliDigits(rawId).toLowerCase();
  const normPass = normalizeBengaliDigits(password).trim();

  if (!rawId || !normPass) {
    return { success: false, message: 'ইউজার আইডি/মোবাইল এবং পাসওয়ার্ড দিন।' };
  }

  if (role === 'official' || role === 'employee') {
    const accounts = getLocalStaffAccounts();
    const matched = accounts.find((acc) => {
      if (acc.role !== role) return false;
      const codeMatch = acc.staffCode.toLowerCase() === normId;
      const emailMatch = acc.email && acc.email.toLowerCase() === normId;
      const nameMatch = acc.nameBn.trim().toLowerCase() === normId;
      const cleanIdDigits = normId.replace(/\D/g, '');
      const cleanAccDigits = normalizeBengaliDigits(acc.phone).replace(/\D/g, '');
      const phoneMatch = cleanIdDigits.length >= 6 && cleanAccDigits.endsWith(cleanIdDigits.slice(-8));
      const adminAlias =
        role === 'official' &&
        (normId === 'admin' || normId === 'dl-admin') &&
        (acc.staffCode.toLowerCase() === 'dl-prn-01' || acc.staffCode.toLowerCase() === 'dl-admin');
      const legacyEmpAlias =
        role === 'employee' &&
        normId === 'dl-emp-01' &&
        acc.staffCode.toLowerCase() === 'dl-tch-01';
      return codeMatch || emailMatch || phoneMatch || nameMatch || adminAlias || legacyEmpAlias;
    });

    if (!matched) {
      return {
        success: false,
        message:
          role === 'official'
            ? 'সঠিক অফিসিয়াল আইডি, নাম বা মোবাইল পাওয়া যায়নি।'
            : 'সঠিক এমপ্লয়ী আইডি, নাম বা মোবাইল পাওয়া যায়নি।',
      };
    }

    if (matched.status === 'pending') {
      return { success: false, message: 'আপনার অ্যাকাউন্টটি অফিসিয়াল অনুমোদনের অপেক্ষায় রয়েছে।' };
    }

    const expected = normalizeBengaliDigits(matched.password || '').trim();
    if (normPass !== expected && normPass.toLowerCase() !== expected.toLowerCase()) {
      return { success: false, message: 'পাসওয়ার্ড সঠিক নয়!' };
    }

    const normalizedDes = normalizeStaffDesignation(matched.designationBn);
    const meta = getDesignationMeta(normalizedDes);
    return {
      success: true,
      session: {
        role: matched.role,
        accountId: matched.id,
        displayName: matched.nameBn,
        subLabel: normalizedDes,
        staffCode: matched.staffCode,
        designationBn: normalizedDes,
        categoryKey: resolveStaffCategoryKey(matched, meta.labelBn),
        lockVersion: typeof matched.unlockEpoch === 'number' ? matched.unlockEpoch : 0,
      },
    };
  }

  // Student local auth
  const pool = classId && classId !== 'all' ? studentPool.filter((s) => s.classId === classId) : studentPool;
  const cleanDigits = normId.replace(/\D/g, '');
  const upperRaw = rawId.toUpperCase();

  let matchedStudent = studentPool.find((s) => {
    const pCode = getStudentPortalId(s).toUpperCase();
    return (
      pCode === upperRaw ||
      s.id.toLowerCase() === normId ||
      (s.securityQrCode && s.securityQrCode.toLowerCase() === normId)
    );
  });

  if (!matchedStudent && cleanDigits.length >= 6) {
    matchedStudent = pool.find((s) =>
      [s.guardianPhone, s.fatherPhone, s.motherPhone, s.emergencyPhone].some(
        (ph) => ph && normalizeBengaliDigits(ph).replace(/\D/g, '').endsWith(cleanDigits.slice(-8))
      )
    );
  }

  if (!matchedStudent && cleanDigits.length > 0 && cleanDigits.length <= 3 && !normId.includes('-')) {
    const rollMatches = pool.filter((s) => String(s.roll) === String(Number(cleanDigits)));
    if (rollMatches.length > 1 && (!classId || classId === 'all')) {
      return {
        success: false,
        message: `রোল ${cleanDigits} একাধিক শ্রেণিতে রয়েছে! অনুগ্রহ করে আপনার সন্তানের নির্দিষ্ট শ্রেণি সিলেক্ট করুন অথবা ইউনিক আইডি (যেমন: DL-C4-01) দিন।`,
      };
    }
    matchedStudent = rollMatches[0];
  }

  if (!matchedStudent) {
    return {
      success: false,
      message: 'প্রদত্ত ইউনিক আইডি, শ্রেণি, রোল বা মোবাইল নম্বরের কোনো শিক্ষার্থী পাওয়া যায়নি।',
    };
  }

  const expectedPin = normalizeBengaliDigits(matchedStudent.guardianPin || '').toLowerCase();
  if (!expectedPin || normPass.toLowerCase() !== expectedPin) {
    return {
      success: false,
      message: 'ভুল পাসওয়ার্ড/পিন কোড! অফিস থেকে প্রদত্ত ব্যক্তিগত ইউনিক পাসওয়ার্ড দিন অথবা প্রিন্সিপাল অফিসে যোগাযোগ করুন।',
    };
  }

  const clsObj = classes.find((c) => c.id === matchedStudent!.classId);
  return {
    success: true,
    session: {
      role: 'student',
      accountId: matchedStudent.id,
      displayName: matchedStudent.nameBn,
      subLabel: `${clsObj?.nameBn || matchedStudent.classId} • রোল ${matchedStudent.roll}`,
      staffCode: getStudentPortalId(matchedStudent),
      lockVersion: typeof matchedStudent.unlockEpoch === 'number' ? matchedStudent.unlockEpoch : 0,
    },
    student: matchedStudent,
  };
}
