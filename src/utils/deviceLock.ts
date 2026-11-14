import { PortalAuthSession, Student } from '../types';
import { idbDelete, idbGet, idbSet } from './indexedDbStorage';

export const LOCKED_STUDENT_STORAGE_KEY = 'dlikon_locked_student_id';
export const LOCKED_STUDENT_SNAPSHOT_KEY = 'dlikon_locked_student_snapshot';
const SESSION_STORAGE_KEY = 'dlikon_portal_auth_session_v1';

export interface LockedStudentSnapshot {
  studentId: string;
  session: PortalAuthSession;
  lockedAt: string;
}

export function getLockedStudentSnapshotSync(): LockedStudentSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCKED_STUDENT_SNAPSHOT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LockedStudentSnapshot;
      if (parsed?.studentId && parsed?.session) {
        return parsed;
      }
    }
  } catch {
    // Ignore parse error
  }
  return null;
}

export function getLockedStudentIdSync(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('locked') === '1' && params.get('guardian')) {
      return params.get('guardian');
    }
    return localStorage.getItem(LOCKED_STUDENT_STORAGE_KEY);
  } catch {
    return null;
  }
}

export async function lockDeviceToStudent(
  student: Student,
  portalId: string,
  classNameBn: string
): Promise<PortalAuthSession> {
  const session: PortalAuthSession = {
    role: 'student',
    accountId: student.id,
    displayName: student.nameBn,
    subLabel: `${classNameBn} • রোল ${student.roll}`,
    staffCode: portalId,
  };

  const snapshot: LockedStudentSnapshot = {
    studentId: student.id,
    session,
    lockedAt: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCKED_STUDENT_STORAGE_KEY, student.id);
      localStorage.setItem(LOCKED_STUDENT_SNAPSHOT_KEY, JSON.stringify(snapshot));
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      localStorage.setItem('dlikon_guardian_paired_student_id', student.id);
      localStorage.setItem('dlikon_pwa_guardian_mode', 'true');

      const nextUrl = `${window.location.pathname}?guardian=${encodeURIComponent(student.id)}&locked=1`;
      window.history.replaceState({}, '', nextUrl);
      document.title = `${student.nameBn} · ডি-লিকন ড্যাশবোর্ড`;
    } catch {
      // Ignore storage restrictions
    }
  }

  await Promise.all([
    idbSet(LOCKED_STUDENT_STORAGE_KEY, student.id),
    idbSet(LOCKED_STUDENT_SNAPSHOT_KEY, snapshot),
  ]);

  return session;
}

export async function loadLockedStudentFromStorage(): Promise<LockedStudentSnapshot | null> {
  const syncSnap = getLockedStudentSnapshotSync();
  if (syncSnap) return syncSnap;

  const syncId = getLockedStudentIdSync();
  try {
    const idbSnap = await idbGet<LockedStudentSnapshot>(LOCKED_STUDENT_SNAPSHOT_KEY);
    if (idbSnap?.studentId && idbSnap?.session) {
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(LOCKED_STUDENT_STORAGE_KEY, idbSnap.studentId);
          localStorage.setItem(LOCKED_STUDENT_SNAPSHOT_KEY, JSON.stringify(idbSnap));
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(idbSnap.session));
          localStorage.setItem('dlikon_guardian_paired_student_id', idbSnap.studentId);
          localStorage.setItem('dlikon_pwa_guardian_mode', 'true');
        } catch {
          // Ignore
        }
      }
      return idbSnap;
    }
    const idbId = syncId || (await idbGet<string>(LOCKED_STUDENT_STORAGE_KEY));
    if (idbId) {
      return {
        studentId: idbId,
        session: {
          role: 'student',
          accountId: idbId,
          displayName: 'শিক্ষার্থী ড্যাশবোর্ড',
          subLabel: 'ডি-লিকন মডেল একাডেমী',
        },
        lockedAt: new Date().toISOString(),
      };
    }
  } catch {
    // Ignore IDB errors
  }

  if (syncId) {
    return {
      studentId: syncId,
      session: {
        role: 'student',
        accountId: syncId,
        displayName: 'শিক্ষার্থী ড্যাশবোর্ড',
        subLabel: 'ডি-লিকন মডেল একাডেমী',
      },
      lockedAt: new Date().toISOString(),
    };
  }

  return null;
}

export async function unlockDeviceFromStudent(): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(LOCKED_STUDENT_STORAGE_KEY);
      localStorage.removeItem(LOCKED_STUDENT_SNAPSHOT_KEY);
      localStorage.removeItem(SESSION_STORAGE_KEY);
      localStorage.removeItem('dlikon_guardian_paired_student_id');
      localStorage.removeItem('dlikon_pwa_guardian_mode');
      window.history.replaceState({}, '', window.location.pathname);
      document.title = 'ডি-লিকন মডেল একাডেমী — স্মার্ট একাডেমিক ও নিরাপত্তা পোর্টাল';
    } catch {
      // Ignore
    }
  }
  await Promise.all([
    idbDelete(LOCKED_STUDENT_STORAGE_KEY),
    idbDelete(LOCKED_STUDENT_SNAPSHOT_KEY),
  ]);
}
