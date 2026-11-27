import { PortalAuthSession, PortalRole, Student } from '../types';
import { idbDelete, idbGet, idbSet } from './indexedDbStorage';

export const LOCKED_STUDENT_STORAGE_KEY = 'dlikon_locked_student_id';
export const LOCKED_STUDENT_SNAPSHOT_KEY = 'dlikon_locked_student_snapshot';
export const LOCKED_DEVICE_SNAPSHOT_KEY = 'dlikon_locked_device_v2';
export const EXPLICITLY_UNLOCKED_KEY = 'dlikon_device_explicitly_unlocked';
const SESSION_STORAGE_KEY = 'dlikon_portal_auth_session_v1';

export interface LockedDeviceSnapshot {
  role: PortalRole;
  accountId: string;
  lockVersion: number;
  session: PortalAuthSession;
  lockedAt: string;
  studentId?: string;
}

export type LockedStudentSnapshot = LockedDeviceSnapshot;

export function isDeviceExplicitlyUnlockedSync(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(EXPLICITLY_UNLOCKED_KEY) === '1';
  } catch {
    return false;
  }
}

export function clearExplicitUnlockFlag(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(EXPLICITLY_UNLOCKED_KEY);
  } catch {
    // Ignore storage error
  }
}

function normalizeLockedSnapshot(raw: any): LockedDeviceSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const session: PortalAuthSession | undefined = raw.session;
  const accountId =
    typeof raw.accountId === 'string' && raw.accountId
      ? raw.accountId
      : typeof raw.studentId === 'string' && raw.studentId
      ? raw.studentId
      : session?.accountId;
  if (!accountId || !session) return null;
  const role: PortalRole = raw.role || session.role || 'student';
  const lockVersion =
    typeof raw.lockVersion === 'number' && Number.isFinite(raw.lockVersion)
      ? raw.lockVersion
      : typeof session.lockVersion === 'number'
      ? session.lockVersion
      : 0;
  return {
    role,
    accountId,
    lockVersion,
    session: { ...session, lockVersion },
    lockedAt: raw.lockedAt || new Date().toISOString(),
    ...(role === 'student' ? { studentId: accountId } : {}),
  };
}

export function getLockedDeviceSnapshotSync(): LockedDeviceSnapshot | null {
  if (typeof window === 'undefined' || isDeviceExplicitlyUnlockedSync()) return null;
  try {
    const rawV2 = localStorage.getItem(LOCKED_DEVICE_SNAPSHOT_KEY);
    if (rawV2) {
      const parsed = normalizeLockedSnapshot(JSON.parse(rawV2));
      if (parsed) return parsed;
    }
    const rawLegacy = localStorage.getItem(LOCKED_STUDENT_SNAPSHOT_KEY);
    if (rawLegacy) {
      const parsed = normalizeLockedSnapshot(JSON.parse(rawLegacy));
      if (parsed) return parsed;
    }
  } catch {
    // Ignore parse error
  }
  return null;
}

export function getLockedStudentSnapshotSync(): LockedDeviceSnapshot | null {
  const snap = getLockedDeviceSnapshotSync();
  return snap && snap.role === 'student' ? snap : null;
}

export function getLockedStudentIdSync(): string | null {
  if (typeof window === 'undefined' || isDeviceExplicitlyUnlockedSync()) return null;
  try {
    const snap = getLockedDeviceSnapshotSync();
    if (snap && snap.role === 'student') return snap.accountId;
    if (snap && snap.role !== 'student') return null;
    const params = new URLSearchParams(window.location.search);
    if (params.get('locked') === '1' && params.get('guardian')) {
      return params.get('guardian');
    }
    return localStorage.getItem(LOCKED_STUDENT_STORAGE_KEY);
  } catch {
    return null;
  }
}

export async function lockDeviceToSession(
  session: PortalAuthSession,
  options?: { student?: Student | null; lockVersion?: number }
): Promise<PortalAuthSession> {
  const lockVersion =
    typeof options?.lockVersion === 'number' && Number.isFinite(options.lockVersion)
      ? options.lockVersion
      : typeof session.lockVersion === 'number'
      ? session.lockVersion
      : 0;
  const finalizedSession: PortalAuthSession = {
    ...session,
    lockVersion,
  };
  const snapshot: LockedDeviceSnapshot = {
    role: finalizedSession.role,
    accountId: finalizedSession.accountId,
    lockVersion,
    session: finalizedSession,
    lockedAt: new Date().toISOString(),
    ...(finalizedSession.role === 'student' ? { studentId: finalizedSession.accountId } : {}),
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(EXPLICITLY_UNLOCKED_KEY);
      localStorage.setItem(LOCKED_DEVICE_SNAPSHOT_KEY, JSON.stringify(snapshot));
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(finalizedSession));

      if (finalizedSession.role === 'student') {
        localStorage.setItem(LOCKED_STUDENT_STORAGE_KEY, finalizedSession.accountId);
        localStorage.setItem(LOCKED_STUDENT_SNAPSHOT_KEY, JSON.stringify(snapshot));
        localStorage.setItem('dlikon_guardian_paired_student_id', finalizedSession.accountId);
        localStorage.setItem('dlikon_pwa_guardian_mode', 'true');
        if (options?.student) {
          document.title = `${options.student.nameBn} · ডি-লিকন ড্যাশবোর্ড`;
        }
      } else {
        localStorage.removeItem(LOCKED_STUDENT_STORAGE_KEY);
        localStorage.removeItem(LOCKED_STUDENT_SNAPSHOT_KEY);
        localStorage.removeItem('dlikon_guardian_paired_student_id');
        localStorage.removeItem('dlikon_pwa_guardian_mode');
        document.title = `${finalizedSession.displayName} · ডি-লিকন ড্যাশবোর্ড`;
      }
    } catch {
      // Ignore storage restrictions
    }
  }

  const tasks: Promise<void>[] = [idbSet(LOCKED_DEVICE_SNAPSHOT_KEY, snapshot)];
  if (finalizedSession.role === 'student') {
    tasks.push(
      idbSet(LOCKED_STUDENT_STORAGE_KEY, finalizedSession.accountId),
      idbSet(LOCKED_STUDENT_SNAPSHOT_KEY, snapshot)
    );
  } else {
    tasks.push(idbDelete(LOCKED_STUDENT_STORAGE_KEY), idbDelete(LOCKED_STUDENT_SNAPSHOT_KEY));
  }
  await Promise.all(tasks);

  return finalizedSession;
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
    lockVersion: typeof student.unlockEpoch === 'number' ? student.unlockEpoch : 0,
  };
  return lockDeviceToSession(session, {
    student,
    lockVersion: session.lockVersion,
  });
}

export async function loadLockedDeviceFromStorage(): Promise<LockedDeviceSnapshot | null> {
  if (isDeviceExplicitlyUnlockedSync()) return null;
  const syncSnap = getLockedDeviceSnapshotSync();
  if (syncSnap) return syncSnap;

  const syncId = getLockedStudentIdSync();
  try {
    const idbV2 = normalizeLockedSnapshot(await idbGet<LockedDeviceSnapshot>(LOCKED_DEVICE_SNAPSHOT_KEY));
    if (idbV2) {
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(LOCKED_DEVICE_SNAPSHOT_KEY, JSON.stringify(idbV2));
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(idbV2.session));
          if (idbV2.role === 'student') {
            localStorage.setItem(LOCKED_STUDENT_STORAGE_KEY, idbV2.accountId);
            localStorage.setItem(LOCKED_STUDENT_SNAPSHOT_KEY, JSON.stringify(idbV2));
            localStorage.setItem('dlikon_guardian_paired_student_id', idbV2.accountId);
            localStorage.setItem('dlikon_pwa_guardian_mode', 'true');
          }
        } catch {
          // Ignore
        }
      }
      return idbV2;
    }

    const idbSnap = normalizeLockedSnapshot(await idbGet<LockedDeviceSnapshot>(LOCKED_STUDENT_SNAPSHOT_KEY));
    if (idbSnap) {
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(LOCKED_DEVICE_SNAPSHOT_KEY, JSON.stringify(idbSnap));
          localStorage.setItem(LOCKED_STUDENT_STORAGE_KEY, idbSnap.accountId);
          localStorage.setItem(LOCKED_STUDENT_SNAPSHOT_KEY, JSON.stringify(idbSnap));
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(idbSnap.session));
          localStorage.setItem('dlikon_guardian_paired_student_id', idbSnap.accountId);
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
        role: 'student',
        accountId: idbId,
        studentId: idbId,
        lockVersion: 0,
        session: {
          role: 'student',
          accountId: idbId,
          displayName: 'শিক্ষার্থী ড্যাশবোর্ড',
          subLabel: 'ডি-লিকন মডেল একাডেমী',
          lockVersion: 0,
        },
        lockedAt: new Date().toISOString(),
      };
    }
  } catch {
    // Ignore IDB errors
  }

  if (syncId) {
    return {
      role: 'student',
      accountId: syncId,
      studentId: syncId,
      lockVersion: 0,
      session: {
        role: 'student',
        accountId: syncId,
        displayName: 'শিক্ষার্থী ড্যাশবোর্ড',
        subLabel: 'ডি-লিকন মডেল একাডেমী',
        lockVersion: 0,
      },
      lockedAt: new Date().toISOString(),
    };
  }

  return null;
}

export async function loadLockedStudentFromStorage(): Promise<LockedDeviceSnapshot | null> {
  return loadLockedDeviceFromStorage();
}

export async function unlockDeviceFromAccount(): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(EXPLICITLY_UNLOCKED_KEY, '1');
      localStorage.removeItem(LOCKED_DEVICE_SNAPSHOT_KEY);
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
    idbDelete(LOCKED_DEVICE_SNAPSHOT_KEY),
    idbDelete(LOCKED_STUDENT_STORAGE_KEY),
    idbDelete(LOCKED_STUDENT_SNAPSHOT_KEY),
  ]);
}

export async function unlockDeviceFromStudent(): Promise<void> {
  return unlockDeviceFromAccount();
}
