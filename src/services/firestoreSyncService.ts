import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  limit,
  writeBatch,
  deleteDoc,
  Unsubscribe,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  DailyAttendanceRecord,
  LibraryMaterial,
  SchoolInfo,
  SecurityGatepassLog,
  StaffAccount,
  StaffActivityLog,
  StaffAttendanceRecord,
  StaffCategoryKey,
  StaffLeaveRequest,
  Student,
} from '../types';

export const DEFAULT_SCHOOL_ID = 'dlikon_academy';
export const BOOTSTRAP_ADMIN_EMAIL = 'chorcho2utkosho@gmail.com';
const MAX_FIRESTORE_PHOTO_LEN = 180000;

const clampStr = (val: unknown, max: number): string => {
  const s = typeof val === 'string' ? val : String(val ?? '');
  return s.slice(0, max);
};

const safePhotoStr = (val: unknown): string => {
  if (typeof val !== 'string') return '';
  return val.length <= MAX_FIRESTORE_PHOTO_LEN ? val : '';
};

const safeId = (val: string): string => {
  const cleaned = val.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);
  return cleaned || `doc_${Date.now()}`;
};

export interface CloudScannerAuthStatus {
  authorized: boolean;
  isBootstrapAdmin: boolean;
  schoolExists: boolean;
  reason: 'verified_admin' | 'school_owner' | 'not_authorized' | 'unverified';
}

export async function checkCloudScannerAuthorization(
  user: User
): Promise<CloudScannerAuthStatus> {
  if (!user.emailVerified) {
    return {
      authorized: false,
      isBootstrapAdmin: false,
      schoolExists: false,
      reason: 'unverified',
    };
  }
  const cleanUid = safeId(user.uid);
  const isBootstrap = user.email === BOOTSTRAP_ADMIN_EMAIL;
  if (isBootstrap) {
    let schoolExists = false;
    try {
      const snap = await getDoc(doc(db, 'schools', DEFAULT_SCHOOL_ID));
      schoolExists = snap.exists();
    } catch {
      schoolExists = false;
    }
    return {
      authorized: true,
      isBootstrapAdmin: true,
      schoolExists,
      reason: 'verified_admin',
    };
  }

  try {
    const adminSnap = await getDoc(doc(db, 'admins', cleanUid));
    if (adminSnap.exists()) {
      let schoolExists = true;
      try {
        const sSnap = await getDoc(doc(db, 'schools', DEFAULT_SCHOOL_ID));
        schoolExists = sSnap.exists();
      } catch {
        schoolExists = true;
      }
      return {
        authorized: true,
        isBootstrapAdmin: false,
        schoolExists,
        reason: 'verified_admin',
      };
    }
  } catch {
    // Continue to school owner check
  }

  try {
    const schoolSnap = await getDoc(doc(db, 'schools', DEFAULT_SCHOOL_ID));
    if (schoolSnap.exists() && schoolSnap.data()?.ownerUid === cleanUid) {
      return {
        authorized: true,
        isBootstrapAdmin: false,
        schoolExists: true,
        reason: 'school_owner',
      };
    }
    return {
      authorized: false,
      isBootstrapAdmin: false,
      schoolExists: schoolSnap.exists(),
      reason: 'not_authorized',
    };
  } catch {
    return {
      authorized: false,
      isBootstrapAdmin: false,
      schoolExists: true,
      reason: 'not_authorized',
    };
  }
}

export async function authorizeScannerUidInFirestore(
  scannerUid: string,
  scannerEmail: string | undefined,
  adminUser: User
): Promise<void> {
  if (!adminUser.emailVerified || adminUser.email !== BOOTSTRAP_ADMIN_EMAIL) {
    throw new Error('শুধুমাত্র মূল অ্যাডমিন (chorcho2utkosho@gmail.com) অন্য স্ক্যানার অনুমোদন করতে পারবেন।');
  }
  const cleanUid = safeId(scannerUid.trim());
  const path = `admins/${cleanUid}`;
  const ref = doc(db, 'admins', cleanUid);
  const payload: Record<string, any> = {
    uid: cleanUid,
    createdAt: serverTimestamp(),
  };
  if (scannerEmail && scannerEmail.trim()) {
    payload.email = clampStr(scannerEmail.trim(), 200);
  }
  try {
    await setDoc(ref, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeBootstrapGuardianSubscribersMirror(
  user: User,
  getLocalStudents: () => Student[],
  onError?: (err: Error) => void
): Unsubscribe {
  if (!user.emailVerified || user.email !== BOOTSTRAP_ADMIN_EMAIL) {
    return () => {};
  }
  const subCol = collection(db, 'schools', DEFAULT_SCHOOL_ID, 'guardianSubscribers');

  return onSnapshot(
    query(subCol, limit(500)),
    async (snapshot) => {
      if (snapshot.empty) return;
      const localList = getLocalStudents();
      const localById = new Map<string, Student>();
      const portalToStudentIds = new Map<string, string[]>();
      for (const s of localList) {
        const cleanId = safeId(s.id);
        localById.set(cleanId, s);
        const rawPortal = typeof s.portalUserId === 'string' && s.portalUserId.trim() ? s.portalUserId.trim() : '';
        if (rawPortal) {
          const pKey = rawPortal.toUpperCase();
          const arr = portalToStudentIds.get(pKey) || [];
          arr.push(cleanId);
          portalToStudentIds.set(pKey, arr);
        }
      }

      const byStudent = new Map<string, Set<string>>();
      for (const d of snapshot.docs) {
        const data = d.data();
        const gUid =
          typeof data.guardianUid === 'string' && data.guardianUid.trim()
            ? safeId(data.guardianUid.trim())
            : '';
        if (!gUid) continue;
        if (typeof data.studentId === 'string' && data.studentId.trim()) {
          const sid = safeId(data.studentId.trim());
          if (!byStudent.has(sid)) byStudent.set(sid, new Set<string>());
          byStudent.get(sid)!.add(gUid);
        }
        if (typeof data.portalUserId === 'string' && data.portalUserId.trim()) {
          const matchedSids = portalToStudentIds.get(data.portalUserId.trim().toUpperCase()) || [];
          for (const sid of matchedSids) {
            if (!byStudent.has(sid)) byStudent.set(sid, new Set<string>());
            byStudent.get(sid)!.add(gUid);
          }
        }
      }

      for (const [sid, uidSet] of byStudent.entries()) {
        const nextUids = Array.from(uidSet).slice(0, 10);
        if (nextUids.length === 0) continue;
        try {
          const stRef = doc(db, 'schools', DEFAULT_SCHOOL_ID, 'students', sid);
          const stSnap = await getDoc(stRef);
          if (!stSnap.exists()) {
            const localStd = localById.get(sid);
            if (!localStd) continue;
            const payload = buildStudentFirestorePayload(
              { ...localStd, guardianUid: nextUids[0], guardianUids: nextUids },
              user
            );
            await setDoc(stRef, payload);
            continue;
          }
          const stData = stSnap.data();
          const curUids = Array.isArray(stData?.guardianUids)
            ? stData.guardianUids.filter((u: unknown) => typeof u === 'string')
            : [];
          if (typeof stData?.guardianUid === 'string' && stData.guardianUid.trim()) {
            if (!nextUids.includes(stData.guardianUid.trim()) && nextUids.length < 10) {
              nextUids.push(stData.guardianUid.trim());
            }
          }
          const needsUpdate =
            nextUids.some((u) => !curUids.includes(u)) ||
            (!stData?.guardianUid && nextUids.length > 0);
          if (needsUpdate) {
            await updateDoc(stRef, {
              guardianUid: stData?.guardianUid || nextUids[0],
              guardianUids: nextUids.slice(0, 10),
              updatedAt: serverTimestamp(),
            });
          }
        } catch {
          // Non-fatal mirror skip
        }
      }
    },
    (err) => {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  );
}

export async function registerGuardianSubscription(
  student: Student,
  portalUserId: string,
  user: User
): Promise<{ bindingId: string }> {
  if (!user.emailVerified) {
    throw new Error('গুগল অ্যাকাউন্টের ইমেইল ভেরিফাইড নয়।');
  }
  const cleanStudentId = safeId(student.id);
  const cleanUid = safeId(user.uid);
  const bindingId = `${cleanStudentId}__${cleanUid}`;
  const path = `schools/${DEFAULT_SCHOOL_ID}/guardianSubscribers/${bindingId}`;
  const ref = doc(db, 'schools', DEFAULT_SCHOOL_ID, 'guardianSubscribers', bindingId);
  const safePortalId = clampStr(portalUserId || student.portalUserId || '', 64);
  const safeStudentName = clampStr(student.nameBn || 'শিক্ষার্থী', 160);

  try {
    let existingSnap: Awaited<ReturnType<typeof getDoc>> | null = null;
    try {
      existingSnap = await getDocFromServer(ref);
    } catch {
      try {
        existingSnap = await getDoc(ref);
      } catch {
        existingSnap = null;
      }
    }

    if (existingSnap?.exists()) {
      await updateDoc(ref, {
        portalUserId: safePortalId,
        studentNameBn: safeStudentName,
        updatedAt: serverTimestamp(),
      });
    } else {
      try {
        await setDoc(ref, {
          id: bindingId,
          studentId: cleanStudentId,
          portalUserId: safePortalId,
          studentNameBn: safeStudentName,
          guardianUid: cleanUid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (writeErr: any) {
        // Fallback: if doc actually existed on server while cache missed it, try updateDoc
        const writeMsg = String(writeErr?.message || writeErr?.code || '');
        if (writeMsg.includes('permission-denied') || writeMsg.includes('already-exists')) {
          await updateDoc(ref, {
            portalUserId: safePortalId,
            studentNameBn: safeStudentName,
            updatedAt: serverTimestamp(),
          });
        } else {
          throw writeErr;
        }
      }
    }
    return { bindingId };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function ensureSchoolDocument(
  user: User,
  schoolInfo: SchoolInfo
): Promise<void> {
  if (!user.emailVerified) return;
  const path = `schools/${DEFAULT_SCHOOL_ID}`;
  const ref = doc(db, 'schools', DEFAULT_SCHOOL_ID);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        schoolId: DEFAULT_SCHOOL_ID,
        name: clampStr(schoolInfo.name || 'ডি-লিকন মডেল একাডেমী', 200),
        address: clampStr(schoolInfo.address || '', 300),
        phone: clampStr(schoolInfo.phone || '', 50),
        email: clampStr(schoolInfo.email || '', 150),
        alwaysLockDevices: schoolInfo.alwaysLockDevices !== false,
        ownerUid: safeId(user.uid),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncSchoolLockPolicyToFirestore(
  alwaysLockDevices: boolean,
  user: User,
  schoolInfo: SchoolInfo
): Promise<void> {
  if (!user.emailVerified) return;
  await ensureSchoolDocument(user, { ...schoolInfo, alwaysLockDevices });
  const path = `schools/${DEFAULT_SCHOOL_ID}`;
  const ref = doc(db, 'schools', DEFAULT_SCHOOL_ID);
  try {
    await updateDoc(ref, {
      alwaysLockDevices: Boolean(alwaysLockDevices),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function pushSecurityLogToFirestore(
  log: SecurityGatepassLog,
  user: User,
  schoolInfo: SchoolInfo,
  guardianUid?: string,
  extraGuardianUids?: string[]
): Promise<{ guardianCount: number }> {
  if (!user.emailVerified) return { guardianCount: 0 };
  await ensureSchoolDocument(user, schoolInfo);

  const cleanLogId = safeId(log.id);
  const cleanStudentId = safeId(log.studentId);
  const path = `schools/${DEFAULT_SCHOOL_ID}/securityLogs/${cleanLogId}`;
  const ref = doc(db, 'schools', DEFAULT_SCHOOL_ID, 'securityLogs', cleanLogId);

  const uidSet = new Set<string>();
  const addValidUid = (candidate: unknown) => {
    if (typeof candidate === 'string' && candidate.trim()) {
      uidSet.add(safeId(candidate.trim()));
    }
  };
  addValidUid(guardianUid);
  if (Array.isArray(extraGuardianUids)) {
    extraGuardianUids.forEach(addValidUid);
  }

  // Pull bound guardian UIDs from cloud student doc (allowed for any authorized admin/owner)
  let studentDocGuardianUids: string[] = [];
  let studentDocExists = false;
  try {
    const stSnap = await getDoc(doc(db, 'schools', DEFAULT_SCHOOL_ID, 'students', cleanStudentId));
    if (stSnap.exists()) {
      studentDocExists = true;
      const stData = stSnap.data();
      addValidUid(stData.guardianUid);
      if (Array.isArray(stData.guardianUids)) {
        studentDocGuardianUids = stData.guardianUids.filter((u: unknown) => typeof u === 'string');
        studentDocGuardianUids.forEach(addValidUid);
      }
    }
  } catch {
    // Non-fatal
  }

  // Bootstrap admin also queries live guardianSubscribers collection (both studentId & portalUserId)
  if (user.email === BOOTSTRAP_ADMIN_EMAIL) {
    const subCol = collection(db, 'schools', DEFAULT_SCHOOL_ID, 'guardianSubscribers');
    const discoveredFromSubs: string[] = [];
    try {
      const byStudentSnap = await getDocs(query(subCol, where('studentId', '==', cleanStudentId), limit(10)));
      byStudentSnap.docs.forEach((d) => {
        const gUid = d.data()?.guardianUid;
        if (typeof gUid === 'string' && gUid.trim()) {
          discoveredFromSubs.push(safeId(gUid.trim()));
          addValidUid(gUid);
        }
      });
    } catch {
      // Non-fatal
    }
    if (log.portalUserId) {
      try {
        const byPortalSnap = await getDocs(
          query(subCol, where('portalUserId', '==', clampStr(log.portalUserId, 64)), limit(10))
        );
        byPortalSnap.docs.forEach((d) => {
          const gUid = d.data()?.guardianUid;
          if (typeof gUid === 'string' && gUid.trim()) {
            discoveredFromSubs.push(safeId(gUid.trim()));
            addValidUid(gUid);
          }
        });
      } catch {
        // Non-fatal
      }
    }

    // Opportunistically mirror discovered guardian UIDs back onto students/{studentId} for secondary scanners
    if (studentDocExists && discoveredFromSubs.length > 0) {
      const mergedForStudent = Array.from(uidSet).slice(0, 10);
      const missingOnStudent = mergedForStudent.some((u) => !studentDocGuardianUids.includes(u));
      if (missingOnStudent) {
        updateDoc(doc(db, 'schools', DEFAULT_SCHOOL_ID, 'students', cleanStudentId), {
          guardianUids: mergedForStudent,
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      }
    }
  }

  const boundedGuardianUids = Array.from(uidSet).slice(0, 10);

  const payload: Record<string, any> = {
    id: cleanLogId,
    studentId: cleanStudentId,
    studentNameBn: clampStr(log.studentNameBn, 160),
    studentRoll: Number(log.studentRoll) || 0,
    classNameBn: clampStr(log.classNameBn, 80),
    action: log.action === 'exit' ? 'exit' : 'entry',
    timestamp: clampStr(log.timestamp, 64),
    serverTimestamp: typeof log.serverTimestamp === 'number' ? log.serverTimestamp : Date.now(),
    status: log.status === 'flagged' ? 'flagged' : 'verified',
    voiceDispatched: Boolean(log.voiceDispatched),
    smsDispatched: Boolean(log.smsDispatched),
    guardianAcknowledged: Boolean(log.guardianAcknowledged),
    ownerUid: safeId(user.uid),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (log.portalUserId) payload.portalUserId = clampStr(log.portalUserId, 64);
  if (log.classId) payload.classId = clampStr(log.classId, 64);
  if (log.guardianResponse) payload.guardianResponse = clampStr(log.guardianResponse, 300);
  if (log.acknowledgedAt) payload.acknowledgedAt = clampStr(log.acknowledgedAt, 64);
  if (log.acknowledgedBy) payload.acknowledgedBy = clampStr(log.acknowledgedBy, 160);
  if (boundedGuardianUids.length > 0) {
    payload.guardianUid = boundedGuardianUids[0];
    payload.guardianUids = boundedGuardianUids;
  }

  try {
    await setDoc(ref, payload);
    return { guardianCount: boundedGuardianUids.length };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function acknowledgeSecurityLogInFirestore(
  logId: string,
  guardianResponse: string,
  acknowledgedBy: string,
  user: User
): Promise<void> {
  if (!user.emailVerified) return;
  const cleanLogId = safeId(logId);
  const path = `schools/${DEFAULT_SCHOOL_ID}/securityLogs/${cleanLogId}`;
  const ref = doc(db, 'schools', DEFAULT_SCHOOL_ID, 'securityLogs', cleanLogId);

  try {
    await updateDoc(ref, {
      guardianAcknowledged: true,
      guardianResponse: clampStr(guardianResponse, 300),
      acknowledgedAt: new Date().toISOString().slice(0, 64),
      acknowledgedBy: clampStr(acknowledgedBy || 'অভিভাবক', 160),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

function buildStudentFirestorePayload(
  student: Student,
  user: User,
  existingData?: Record<string, any>,
  explicitClear?: boolean | { avatarUrl?: boolean; fatherAvatarUrl?: boolean; motherAvatarUrl?: boolean }
): Record<string, any> {
  const cleanStudentId = safeId(student.id);
  const payload: Record<string, any> = {
    id: cleanStudentId,
    nameBn: clampStr(student.nameBn, 160),
    roll: Number(student.roll) || 0,
    classId: clampStr(student.classId, 64),
    ownerUid: existingData?.ownerUid ? safeId(existingData.ownerUid) : safeId(user.uid),
    createdAt: existingData?.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (student.section) payload.section = clampStr(student.section, 32);
  if (student.portalUserId) payload.portalUserId = clampStr(student.portalUserId, 64);
  if (student.guardianPhone) payload.guardianPhone = clampStr(student.guardianPhone, 32);
  if (student.guardianName) payload.guardianNameBn = clampStr(student.guardianName, 160);
  if (student.guardianPin) payload.guardianPin = clampStr(student.guardianPin, 32);
  payload.unlockEpoch =
    typeof student.unlockEpoch === 'number' && Number.isFinite(student.unlockEpoch)
      ? Math.max(0, Math.floor(student.unlockEpoch))
      : typeof existingData?.unlockEpoch === 'number'
      ? Math.max(0, Math.floor(existingData.unlockEpoch))
      : 0;
  const resolvedGuardianUid =
    typeof student.guardianUid === 'string' && student.guardianUid.trim()
      ? safeId(student.guardianUid.trim())
      : typeof existingData?.guardianUid === 'string' && existingData.guardianUid.trim()
      ? safeId(existingData.guardianUid.trim())
      : '';
  if (resolvedGuardianUid) payload.guardianUid = resolvedGuardianUid;

  const mergedGuardianUids = new Set<string>();
  if (resolvedGuardianUid) mergedGuardianUids.add(resolvedGuardianUid);
  if (Array.isArray(existingData?.guardianUids)) {
    existingData.guardianUids.forEach((u: unknown) => {
      if (typeof u === 'string' && u.trim()) mergedGuardianUids.add(safeId(u.trim()));
    });
  }
  if (mergedGuardianUids.size > 0) {
    payload.guardianUids = Array.from(mergedGuardianUids).slice(0, 10);
  }

  const isCleared = (field: 'avatarUrl' | 'fatherAvatarUrl' | 'motherAvatarUrl') =>
    explicitClear === true || Boolean(explicitClear && typeof explicitClear === 'object' && explicitClear[field]);

  const avatar = safePhotoStr(student.avatarUrl);
  const fatherAvatar = safePhotoStr(student.fatherAvatarUrl);
  const motherAvatar = safePhotoStr(student.motherAvatarUrl);

  const existingAvatar = safePhotoStr(existingData?.avatarUrl);
  const existingFather = safePhotoStr(existingData?.fatherAvatarUrl);
  const existingMother = safePhotoStr(existingData?.motherAvatarUrl);

  if (avatar) payload.avatarUrl = avatar;
  else if (isCleared('avatarUrl') && existingAvatar) payload.avatarUrl = '';
  else if (existingAvatar) payload.avatarUrl = existingAvatar;

  if (fatherAvatar) payload.fatherAvatarUrl = fatherAvatar;
  else if (isCleared('fatherAvatarUrl') && existingFather) payload.fatherAvatarUrl = '';
  else if (existingFather) payload.fatherAvatarUrl = existingFather;

  if (motherAvatar) payload.motherAvatarUrl = motherAvatar;
  else if (isCleared('motherAvatarUrl') && existingMother) payload.motherAvatarUrl = '';
  else if (existingMother) payload.motherAvatarUrl = existingMother;

  const photoTimestamp = student.photoUpdatedAt || existingData?.photoUpdatedAt;
  if (photoTimestamp) payload.photoUpdatedAt = clampStr(photoTimestamp, 64);

  return payload;
}

export async function syncStudentRecordToFirestore(
  student: Student,
  user: User,
  schoolInfo: SchoolInfo,
  explicitClear?: boolean | { avatarUrl?: boolean; fatherAvatarUrl?: boolean; motherAvatarUrl?: boolean }
): Promise<void> {
  if (!user.emailVerified) return;
  await ensureSchoolDocument(user, schoolInfo);

  const cleanStudentId = safeId(student.id);
  const path = `schools/${DEFAULT_SCHOOL_ID}/students/${cleanStudentId}`;
  const ref = doc(db, 'schools', DEFAULT_SCHOOL_ID, 'students', cleanStudentId);

  try {
    const existingSnap = await getDoc(ref);
    const existingData = existingSnap.exists() ? existingSnap.data() : undefined;
    const payload = buildStudentFirestorePayload(student, user, existingData, explicitClear);

    if (existingSnap.exists()) {
      await updateDoc(ref, payload);
    } else {
      await setDoc(ref, payload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function batchPushStudentsToFirestore(
  students: Student[],
  user: User,
  schoolInfo: SchoolInfo,
  onProgress?: (done: number, total: number) => void
): Promise<{ pushedCount: number; failedCount: number }> {
  if (!user.emailVerified || students.length === 0) {
    return { pushedCount: 0, failedCount: 0 };
  }

  await ensureSchoolDocument(user, schoolInfo);

  const colRef = collection(db, 'schools', DEFAULT_SCHOOL_ID, 'students');
  const existingMap = new Map<string, Record<string, any>>();
  try {
    const snap = await getDocs(colRef);
    snap.docs.forEach((d) => {
      existingMap.set(d.id, d.data());
    });
  } catch {
    // Non-fatal: continue with direct set/update fallback
  }

  const CHUNK_SIZE = 10;
  let pushedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < students.length; i += CHUNK_SIZE) {
    const chunk = students.slice(i, i + CHUNK_SIZE);
    try {
      const batch = writeBatch(db);
      for (const student of chunk) {
        const cleanId = safeId(student.id);
        const ref = doc(db, 'schools', DEFAULT_SCHOOL_ID, 'students', cleanId);
        const existingData = existingMap.get(cleanId);
        const payload = buildStudentFirestorePayload(student, user, existingData);
        if (existingData) {
          batch.update(ref, payload);
        } else {
          batch.set(ref, payload);
        }
      }
      await batch.commit();
      pushedCount += chunk.length;
    } catch {
      // Fallback one-by-one if a chunk fails
      for (const student of chunk) {
        try {
          await syncStudentRecordToFirestore(student, user, schoolInfo);
          pushedCount++;
        } catch {
          failedCount++;
        }
      }
    }
    onProgress?.(Math.min(i + chunk.length, students.length), students.length);
  }

  return { pushedCount, failedCount };
}

export async function pullStudentsFromFirestore(
  user: User
): Promise<Partial<Student>[]> {
  if (!user.emailVerified) return [];
  const path = `schools/${DEFAULT_SCHOOL_ID}/students`;
  const colRef = collection(db, 'schools', DEFAULT_SCHOOL_ID, 'students');
  const isAdminUser = user.email === BOOTSTRAP_ADMIN_EMAIL;
  const q = isAdminUser
    ? query(colRef)
    : query(colRef, where('ownerUid', '==', safeId(user.uid)));

  try {
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: data.id || d.id,
        nameBn: data.nameBn,
        roll: Number(data.roll) || 0,
        classId: data.classId,
        section: data.section,
        portalUserId: data.portalUserId,
        guardianPhone: data.guardianPhone,
        guardianName: data.guardianNameBn,
        guardianPin: data.guardianPin,
        unlockEpoch: typeof data.unlockEpoch === 'number' ? data.unlockEpoch : 0,
        ...(typeof data.guardianUid === 'string' && data.guardianUid ? { guardianUid: data.guardianUid } : {}),
        avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : undefined,
        fatherAvatarUrl: typeof data.fatherAvatarUrl === 'string' ? data.fatherAvatarUrl : undefined,
        motherAvatarUrl: typeof data.motherAvatarUrl === 'string' ? data.motherAvatarUrl : undefined,
        photoUpdatedAt: typeof data.photoUpdatedAt === 'string' ? data.photoUpdatedAt : undefined,
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export function subscribeCloudSecurityLogs(
  user: User,
  onLogs: (logs: SecurityGatepassLog[], isInitialSnapshot: boolean) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!user.emailVerified) {
    return () => {};
  }
  const path = `schools/${DEFAULT_SCHOOL_ID}/securityLogs`;
  const colRef = collection(db, 'schools', DEFAULT_SCHOOL_ID, 'securityLogs');

  const reportSnapshotError = (error: unknown) => {
    try {
      handleFirestoreError(error, OperationType.LIST, path);
    } catch (wrappedErr: any) {
      onError?.(wrappedErr instanceof Error ? wrappedErr : new Error(String(error)));
    }
  };

  const mapDoc = (d: any): SecurityGatepassLog => {
    const data = d.data();
    const fallbackServerTs =
      typeof data.serverTimestamp === 'number'
        ? data.serverTimestamp
        : data.createdAt && typeof data.createdAt.toMillis === 'function'
        ? data.createdAt.toMillis()
        : undefined;
    return {
      id: data.id || d.id,
      studentId: data.studentId,
      portalUserId: typeof data.portalUserId === 'string' ? data.portalUserId : undefined,
      classId: typeof data.classId === 'string' ? data.classId : undefined,
      studentNameBn: data.studentNameBn,
      studentRoll: Number(data.studentRoll) || 0,
      classNameBn: data.classNameBn,
      action: data.action === 'exit' ? 'exit' : 'entry',
      timestamp: data.timestamp,
      serverTimestamp: fallbackServerTs,
      guardianPhone: '',
      voiceDispatched: Boolean(data.voiceDispatched),
      smsDispatched: Boolean(data.smsDispatched),
      status: data.status === 'flagged' ? 'flagged' : 'verified',
      guardianAcknowledged: Boolean(data.guardianAcknowledged),
      guardianResponse: data.guardianResponse,
      acknowledgedAt: data.acknowledgedAt,
      acknowledgedBy: data.acknowledgedBy,
    };
  };

  const isAdminUser = user.email === BOOTSTRAP_ADMIN_EMAIL;
  if (isAdminUser) {
    const q = query(colRef, orderBy('timestamp', 'desc'), limit(100));
    let isFirst = true;
    return onSnapshot(
      q,
      (snapshot) => {
        const logs = snapshot.docs.map(mapDoc);
        logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        onLogs(logs, isFirst);
        isFirst = false;
      },
      reportSnapshotError
    );
  }

  const uid = safeId(user.uid);
  const ownerMap = new Map<string, SecurityGatepassLog>();
  const guardianMap = new Map<string, SecurityGatepassLog>();
  const guardianArrayMap = new Map<string, SecurityGatepassLog>();
  let isFirst = true;

  const emitMerged = () => {
    const merged = new Map<string, SecurityGatepassLog>();
    for (const [k, v] of ownerMap.entries()) merged.set(k, v);
    for (const [k, v] of guardianMap.entries()) merged.set(k, v);
    for (const [k, v] of guardianArrayMap.entries()) merged.set(k, v);
    const logs = Array.from(merged.values());
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    onLogs(logs, isFirst);
    isFirst = false;
  };

  const unsubOwner = onSnapshot(
    query(colRef, where('ownerUid', '==', uid), limit(500)),
    (snapshot) => {
      ownerMap.clear();
      for (const d of snapshot.docs) {
        const log = mapDoc(d);
        ownerMap.set(log.id, log);
      }
      emitMerged();
    },
    reportSnapshotError
  );

  const unsubGuardian = onSnapshot(
    query(colRef, where('guardianUid', '==', uid), limit(500)),
    (snapshot) => {
      guardianMap.clear();
      for (const d of snapshot.docs) {
        const log = mapDoc(d);
        guardianMap.set(log.id, log);
      }
      emitMerged();
    },
    reportSnapshotError
  );

  const unsubGuardianArray = onSnapshot(
    query(colRef, where('guardianUids', 'array-contains', uid), limit(500)),
    (snapshot) => {
      guardianArrayMap.clear();
      for (const d of snapshot.docs) {
        const log = mapDoc(d);
        guardianArrayMap.set(log.id, log);
      }
      emitMerged();
    },
    reportSnapshotError
  );

  return () => {
    unsubOwner();
    unsubGuardian();
    unsubGuardianArray();
  };
}

export async function pullLatestCloudSecurityLogs(
  user: User
): Promise<SecurityGatepassLog[]> {
  if (!user.emailVerified) return [];
  const path = `schools/${DEFAULT_SCHOOL_ID}/securityLogs`;
  const colRef = collection(db, 'schools', DEFAULT_SCHOOL_ID, 'securityLogs');

  const mapDoc = (d: any): SecurityGatepassLog => {
    const data = d.data();
    const fallbackServerTs =
      typeof data.serverTimestamp === 'number'
        ? data.serverTimestamp
        : data.createdAt && typeof data.createdAt.toMillis === 'function'
        ? data.createdAt.toMillis()
        : undefined;
    return {
      id: data.id || d.id,
      studentId: data.studentId,
      portalUserId: typeof data.portalUserId === 'string' ? data.portalUserId : undefined,
      classId: typeof data.classId === 'string' ? data.classId : undefined,
      studentNameBn: data.studentNameBn,
      studentRoll: Number(data.studentRoll) || 0,
      classNameBn: data.classNameBn,
      action: data.action === 'exit' ? 'exit' : 'entry',
      timestamp: data.timestamp,
      serverTimestamp: fallbackServerTs,
      guardianPhone: '',
      voiceDispatched: Boolean(data.voiceDispatched),
      smsDispatched: Boolean(data.smsDispatched),
      status: data.status === 'flagged' ? 'flagged' : 'verified',
      guardianAcknowledged: Boolean(data.guardianAcknowledged),
      guardianResponse: data.guardianResponse,
      acknowledgedAt: data.acknowledgedAt,
      acknowledgedBy: data.acknowledgedBy,
    };
  };

  const runServerFirst = async (q: ReturnType<typeof query>) => {
    try {
      return await getDocsFromServer(q);
    } catch {
      return await getDocs(q);
    }
  };

  try {
    if (user.email === BOOTSTRAP_ADMIN_EMAIL) {
      const snap = await runServerFirst(query(colRef, orderBy('timestamp', 'desc'), limit(100)));
      return snap.docs
        .map(mapDoc)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }

    const uid = safeId(user.uid);
    const merged = new Map<string, SecurityGatepassLog>();
    const [ownerSnap, gSnap, gArrSnap] = await Promise.all([
      runServerFirst(query(colRef, where('ownerUid', '==', uid), limit(500))),
      runServerFirst(query(colRef, where('guardianUid', '==', uid), limit(500))),
      runServerFirst(query(colRef, where('guardianUids', 'array-contains', uid), limit(500))),
    ]);
    for (const snap of [ownerSnap, gSnap, gArrSnap]) {
      for (const d of snap.docs) {
        const log = mapDoc(d);
        if (log.id) merged.set(log.id, log);
      }
    }
    return Array.from(merged.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function syncLibraryMaterialToFirestore(
  material: LibraryMaterial,
  user: User,
  schoolInfo: SchoolInfo
): Promise<void> {
  if (!user.emailVerified) return;
  await ensureSchoolDocument(user, schoolInfo);

  const cleanId = safeId(material.id);
  const path = `schools/${DEFAULT_SCHOOL_ID}/libraryMaterials/${cleanId}`;
  const ref = doc(db, 'schools', DEFAULT_SCHOOL_ID, 'libraryMaterials', cleanId);

  try {
    const existingSnap = await getDoc(ref);
    const existingData = existingSnap.exists() ? existingSnap.data() : undefined;

    const payload: Record<string, any> = {
      id: cleanId,
      title: clampStr(material.title, 240),
      category: material.category,
      fileType: material.fileType,
      classId: clampStr(material.classId || 'all', 64),
      fileName: clampStr(material.fileName || 'material.pdf', 240),
      mimeType: clampStr(material.mimeType || 'application/octet-stream', 128),
      fileSizeBytes: Math.max(0, Number(material.fileSizeBytes) || 0),
      fileUrl: clampStr(material.fileUrl, 1000),
      isExternalUrl: Boolean(material.isExternalUrl),
      uploadedBy: clampStr(material.uploadedBy || 'শিক্ষক', 160),
      downloadsCount: Math.max(0, Number(material.downloadsCount) || 0),
      academicYear: clampStr(material.academicYear || '২০২৬', 24),
      ownerUid: existingData?.ownerUid ? safeId(existingData.ownerUid) : safeId(user.uid),
      createdAt: existingData?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (material.description) payload.description = clampStr(material.description, 1500);
    if (material.subjectId) payload.subjectId = clampStr(material.subjectId, 64);
    if (material.subjectNameBn) payload.subjectNameBn = clampStr(material.subjectNameBn, 120);
    if (material.chapter) payload.chapter = clampStr(material.chapter, 160);
    if (material.uploadedByRole === 'official' || material.uploadedByRole === 'employee') {
      payload.uploadedByRole = material.uploadedByRole;
    }

    if (existingSnap.exists()) {
      await updateDoc(ref, payload);
    } else {
      await setDoc(ref, payload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteLibraryMaterialFromFirestore(
  materialId: string,
  user: User
): Promise<void> {
  if (!user.emailVerified) return;
  const cleanId = safeId(materialId);
  const path = `schools/${DEFAULT_SCHOOL_ID}/libraryMaterials/${cleanId}`;
  const ref = doc(db, 'schools', DEFAULT_SCHOOL_ID, 'libraryMaterials', cleanId);
  try {
    await deleteDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function pullLibraryMaterialsFromFirestore(
  user: User
): Promise<LibraryMaterial[]> {
  if (!user.emailVerified) return [];
  const path = `schools/${DEFAULT_SCHOOL_ID}/libraryMaterials`;
  const colRef = collection(db, 'schools', DEFAULT_SCHOOL_ID, 'libraryMaterials');
  const isAdminUser = user.email === BOOTSTRAP_ADMIN_EMAIL;
  const q = isAdminUser
    ? query(colRef)
    : query(colRef, where('ownerUid', '==', safeId(user.uid)));

  try {
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      const createdAtIso =
        data.createdAt && typeof data.createdAt.toDate === 'function'
          ? data.createdAt.toDate().toISOString()
          : new Date().toISOString();
      const updatedAtIso =
        data.updatedAt && typeof data.updatedAt.toDate === 'function'
          ? data.updatedAt.toDate().toISOString()
          : createdAtIso;
      return {
        id: data.id || d.id,
        title: data.title || '',
        description: data.description || '',
        category: data.category || 'pdf_lecture',
        fileType: data.fileType || 'pdf',
        classId: data.classId || 'all',
        subjectId: data.subjectId || '',
        subjectNameBn: data.subjectNameBn || '',
        chapter: data.chapter || '',
        fileName: data.fileName || 'material.pdf',
        mimeType: data.mimeType || 'application/pdf',
        fileSizeBytes: Number(data.fileSizeBytes) || 0,
        fileUrl: data.fileUrl || '',
        isExternalUrl: Boolean(data.isExternalUrl),
        uploadedBy: data.uploadedBy || 'শিক্ষক',
        uploadedByRole: data.uploadedByRole,
        downloadsCount: Number(data.downloadsCount) || 0,
        academicYear: data.academicYear || '২০২৬',
        createdAt: createdAtIso,
        updatedAt: updatedAtIso,
      } as LibraryMaterial;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

function mapStaffAttendanceDoc(d: any): StaffAttendanceRecord {
  const data = d.data();
  const fallbackServerTs =
    typeof data.serverTimestamp === 'number'
      ? data.serverTimestamp
      : data.updatedAt && typeof data.updatedAt.toMillis === 'function'
      ? data.updatedAt.toMillis()
      : data.createdAt && typeof data.createdAt.toMillis === 'function'
      ? data.createdAt.toMillis()
      : undefined;
  return {
    id: data.id || d.id,
    staffId: data.staffId,
    ...(typeof data.staffCode === 'string' && data.staffCode ? { staffCode: data.staffCode } : {}),
    staffNameBn: data.staffNameBn || 'এমপ্লয়ী',
    designationBn: data.designationBn || 'শিক্ষক',
    date: data.date,
    checkInTime: data.checkInTime || '',
    ...(typeof data.checkInMs === 'number' ? { checkInMs: data.checkInMs } : {}),
    ...(typeof data.checkOutTime === 'string' && data.checkOutTime ? { checkOutTime: data.checkOutTime } : {}),
    ...(typeof data.checkOutMs === 'number' ? { checkOutMs: data.checkOutMs } : {}),
    ...(typeof data.workedMinutes === 'number' ? { workedMinutes: data.workedMinutes } : {}),
    ...(typeof data.workedDurationBn === 'string' && data.workedDurationBn ? { workedDurationBn: data.workedDurationBn } : {}),
    ...(data.action === 'checkout' || data.action === 'checkin' ? { action: data.action } : {}),
    status: data.status === 'late' || data.status === 'leave' ? data.status : 'present',
    ...(typeof data.note === 'string' && data.note ? { note: data.note } : {}),
    serverTimestamp: fallbackServerTs,
  };
}

export async function pushStaffAttendanceToFirestore(
  record: StaffAttendanceRecord,
  user: User,
  schoolInfo: SchoolInfo
): Promise<void> {
  if (!user.emailVerified) return;

  const cleanAttId = safeId(record.id);
  const cleanStaffId = safeId(record.staffId);
  const cleanUid = safeId(user.uid);
  const path = `schools/${DEFAULT_SCHOOL_ID}/staffAttendance/${cleanAttId}`;
  const ref = doc(db, 'schools', DEFAULT_SCHOOL_ID, 'staffAttendance', cleanAttId);

  let schoolOwnerUid = cleanUid;
  try {
    const schoolSnap = await getDoc(doc(db, 'schools', DEFAULT_SCHOOL_ID));
    if (schoolSnap.exists() && typeof schoolSnap.data()?.ownerUid === 'string') {
      schoolOwnerUid = safeId(schoolSnap.data()!.ownerUid);
    }
  } catch {
    // Non-fatal; proceed with cleanUid
  }

  let existingSnap: Awaited<ReturnType<typeof getDoc>> | null = null;
  try {
    existingSnap = await getDocFromServer(ref);
  } catch {
    try {
      existingSnap = await getDoc(ref);
    } catch {
      existingSnap = null;
    }
  }

  const nowTs = typeof record.serverTimestamp === 'number' ? record.serverTimestamp : Date.now();

  try {
    if (existingSnap?.exists()) {
      const updatePayload: Record<string, any> = {
        status: record.status === 'late' || record.status === 'leave' ? record.status : 'present',
        action: record.action === 'checkout' ? 'checkout' : 'checkin',
        serverTimestamp: nowTs,
        updatedAt: serverTimestamp(),
      };
      if (record.designationBn) updatePayload.designationBn = clampStr(record.designationBn, 120);
      if (record.checkInTime) updatePayload.checkInTime = clampStr(record.checkInTime, 40);
      if (typeof record.checkInMs === 'number' && record.checkInMs >= 0) {
        updatePayload.checkInMs = record.checkInMs;
      }
      if (record.checkOutTime) updatePayload.checkOutTime = clampStr(record.checkOutTime, 40);
      if (typeof record.checkOutMs === 'number' && record.checkOutMs >= 0) {
        updatePayload.checkOutMs = record.checkOutMs;
      }
      if (typeof record.workedMinutes === 'number' && record.workedMinutes >= 0) {
        updatePayload.workedMinutes = Math.min(10080, Math.round(record.workedMinutes));
      }
      if (record.workedDurationBn) {
        updatePayload.workedDurationBn = clampStr(record.workedDurationBn, 80);
      }
      if (typeof record.note === 'string') updatePayload.note = clampStr(record.note, 300);
      await updateDoc(ref, updatePayload);
    } else {
      if (user.email === BOOTSTRAP_ADMIN_EMAIL) {
        await ensureSchoolDocument(user, schoolInfo).catch(() => {});
      }
      const createPayload: Record<string, any> = {
        id: cleanAttId,
        staffId: cleanStaffId,
        staffNameBn: clampStr(record.staffNameBn || 'এমপ্লয়ী', 160),
        designationBn: clampStr(record.designationBn || 'শিক্ষক', 120),
        date: clampStr(record.date, 24),
        checkInTime: clampStr(record.checkInTime || '', 40),
        action: record.action === 'checkout' ? 'checkout' : 'checkin',
        status: record.status === 'late' || record.status === 'leave' ? record.status : 'present',
        serverTimestamp: nowTs,
        ownerUid: schoolOwnerUid,
        staffUid: cleanUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (record.staffCode) createPayload.staffCode = clampStr(record.staffCode, 40);
      if (typeof record.checkInMs === 'number' && record.checkInMs >= 0) {
        createPayload.checkInMs = record.checkInMs;
      }
      if (record.checkOutTime) createPayload.checkOutTime = clampStr(record.checkOutTime, 40);
      if (typeof record.checkOutMs === 'number' && record.checkOutMs >= 0) {
        createPayload.checkOutMs = record.checkOutMs;
      }
      if (typeof record.workedMinutes === 'number' && record.workedMinutes >= 0) {
        createPayload.workedMinutes = Math.min(10080, Math.round(record.workedMinutes));
      }
      if (record.workedDurationBn) {
        createPayload.workedDurationBn = clampStr(record.workedDurationBn, 80);
      }
      if (record.note) createPayload.note = clampStr(record.note, 300);
      await setDoc(ref, createPayload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeCloudStaffAttendance(
  user: User,
  onRecords: (records: StaffAttendanceRecord[], isInitialSnapshot: boolean) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!user.emailVerified) {
    return () => {};
  }
  const path = `schools/${DEFAULT_SCHOOL_ID}/staffAttendance`;
  const colRef = collection(db, 'schools', DEFAULT_SCHOOL_ID, 'staffAttendance');

  const reportSnapshotError = (error: unknown) => {
    try {
      handleFirestoreError(error, OperationType.LIST, path);
    } catch (wrappedErr: any) {
      onError?.(wrappedErr instanceof Error ? wrappedErr : new Error(String(error)));
    }
  };

  const isAdminUser = user.email === BOOTSTRAP_ADMIN_EMAIL;
  if (isAdminUser) {
    let isFirst = true;
    return onSnapshot(
      query(colRef, limit(200)),
      (snapshot) => {
        const list = snapshot.docs
          .map(mapStaffAttendanceDoc)
          .sort((a, b) => (b.serverTimestamp || 0) - (a.serverTimestamp || 0));
        onRecords(list, isFirst);
        isFirst = false;
      },
      reportSnapshotError
    );
  }

  const uid = safeId(user.uid);
  const ownerMap = new Map<string, StaffAttendanceRecord>();
  const staffMap = new Map<string, StaffAttendanceRecord>();
  let isFirst = true;

  const emitMerged = () => {
    const merged = new Map<string, StaffAttendanceRecord>();
    for (const [k, v] of ownerMap.entries()) merged.set(k, v);
    for (const [k, v] of staffMap.entries()) merged.set(k, v);
    const list = Array.from(merged.values()).sort(
      (a, b) => (b.serverTimestamp || 0) - (a.serverTimestamp || 0)
    );
    onRecords(list, isFirst);
    isFirst = false;
  };

  const unsubOwner = onSnapshot(
    query(colRef, where('ownerUid', '==', uid), limit(200)),
    (snapshot) => {
      ownerMap.clear();
      for (const d of snapshot.docs) {
        const rec = mapStaffAttendanceDoc(d);
        ownerMap.set(rec.id, rec);
      }
      emitMerged();
    },
    reportSnapshotError
  );

  const unsubStaff = onSnapshot(
    query(colRef, where('staffUid', '==', uid), limit(200)),
    (snapshot) => {
      staffMap.clear();
      for (const d of snapshot.docs) {
        const rec = mapStaffAttendanceDoc(d);
        staffMap.set(rec.id, rec);
      }
      emitMerged();
    },
    reportSnapshotError
  );

  return () => {
    unsubOwner();
    unsubStaff();
  };
}

export async function pullLatestCloudStaffAttendance(
  user: User
): Promise<StaffAttendanceRecord[]> {
  if (!user.emailVerified) return [];
  const path = `schools/${DEFAULT_SCHOOL_ID}/staffAttendance`;
  const colRef = collection(db, 'schools', DEFAULT_SCHOOL_ID, 'staffAttendance');

  const runServerFirst = async (q: ReturnType<typeof query>) => {
    try {
      return await getDocsFromServer(q);
    } catch {
      return await getDocs(q);
    }
  };

  try {
    if (user.email === BOOTSTRAP_ADMIN_EMAIL) {
      const snap = await runServerFirst(query(colRef, limit(200)));
      return snap.docs
        .map(mapStaffAttendanceDoc)
        .sort((a, b) => (b.serverTimestamp || 0) - (a.serverTimestamp || 0));
    }

    const uid = safeId(user.uid);
    const merged = new Map<string, StaffAttendanceRecord>();
    const [ownerSnap, staffSnap] = await Promise.all([
      runServerFirst(query(colRef, where('ownerUid', '==', uid), limit(200))),
      runServerFirst(query(colRef, where('staffUid', '==', uid), limit(200))),
    ]);
    for (const snap of [ownerSnap, staffSnap]) {
      for (const d of snap.docs) {
        const rec = mapStaffAttendanceDoc(d);
        if (rec.id) merged.set(rec.id, rec);
      }
    }
    return Array.from(merged.values()).sort(
      (a, b) => (b.serverTimestamp || 0) - (a.serverTimestamp || 0)
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function syncStaffAccountToFirestore(
  staff: StaffAccount,
  user: User,
  schoolInfo: SchoolInfo
): Promise<void> {
  if (!user.emailVerified) return;
  await ensureSchoolDocument(user, schoolInfo);

  const cleanStaffId = safeId(staff.id);
  const path = `schools/${DEFAULT_SCHOOL_ID}/staffAccounts/${cleanStaffId}`;
  const ref = doc(db, 'schools', DEFAULT_SCHOOL_ID, 'staffAccounts', cleanStaffId);

  try {
    const existingSnap = await getDoc(ref);
    const existingData = existingSnap.exists() ? existingSnap.data() : undefined;
    const payload: Record<string, any> = {
      id: cleanStaffId,
      staffCode: clampStr(staff.staffCode, 40),
      role: staff.role === 'official' ? 'official' : 'employee',
      nameBn: clampStr(staff.nameBn, 160),
      designationBn: clampStr(staff.designationBn || 'শিক্ষক', 120),
      phone: clampStr(staff.phone || '01700000000', 32),
      status: staff.status === 'pending' ? 'pending' : 'active',
      unlockEpoch:
        typeof staff.unlockEpoch === 'number' && Number.isFinite(staff.unlockEpoch)
          ? Math.max(0, Math.floor(staff.unlockEpoch))
          : typeof existingData?.unlockEpoch === 'number'
          ? Math.max(0, Math.floor(existingData.unlockEpoch))
          : 0,
      ownerUid: existingData?.ownerUid ? safeId(existingData.ownerUid) : safeId(user.uid),
      createdAt: existingData?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (staff.categoryKey) {
      payload.categoryKey = clampStr(staff.categoryKey, 40);
    }
    if (typeof staff.baseMonthlySalary === 'number' && staff.baseMonthlySalary >= 0) {
      payload.baseMonthlySalary = Math.min(10000000, Math.round(staff.baseMonthlySalary));
    }
    if (typeof staff.dailyShiftHours === 'number' && staff.dailyShiftHours >= 1) {
      payload.dailyShiftHours = Math.min(24, Math.max(1, Number(staff.dailyShiftHours)));
    }
    if (typeof staff.overtimeHourlyRate === 'number' && staff.overtimeHourlyRate >= 0) {
      payload.overtimeHourlyRate = Math.min(100000, Math.round(staff.overtimeHourlyRate));
    }
    if (existingData?.staffUid) {
      payload.staffUid = safeId(existingData.staffUid);
    }
    if (existingSnap.exists()) {
      await updateDoc(ref, payload);
    } else {
      await setDoc(ref, payload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function pullStaffAccountsFromFirestore(
  user: User
): Promise<StaffAccount[]> {
  if (!user.emailVerified) return [];
  const path = `schools/${DEFAULT_SCHOOL_ID}/staffAccounts`;
  const colRef = collection(db, 'schools', DEFAULT_SCHOOL_ID, 'staffAccounts');
  const isAdminUser = user.email === BOOTSTRAP_ADMIN_EMAIL;
  const q = isAdminUser
    ? query(colRef, limit(200))
    : query(colRef, where('ownerUid', '==', safeId(user.uid)), limit(200));

  try {
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: data.id || d.id,
        staffCode: data.staffCode || '',
        role: data.role === 'official' ? 'official' : 'employee',
        categoryKey: typeof data.categoryKey === 'string' ? (data.categoryKey as StaffCategoryKey) : undefined,
        nameBn: data.nameBn || 'শিক্ষক',
        designationBn: data.designationBn || 'শিক্ষক',
        baseMonthlySalary: typeof data.baseMonthlySalary === 'number' ? data.baseMonthlySalary : undefined,
        dailyShiftHours: typeof data.dailyShiftHours === 'number' ? data.dailyShiftHours : undefined,
        overtimeHourlyRate: typeof data.overtimeHourlyRate === 'number' ? data.overtimeHourlyRate : undefined,
        phone: data.phone || '',
        password: '',
        status: data.status === 'pending' ? 'pending' : 'active',
        unlockEpoch: typeof data.unlockEpoch === 'number' ? data.unlockEpoch : 0,
        createdAt:
          data.createdAt && typeof data.createdAt.toDate === 'function'
            ? data.createdAt.toDate().toISOString()
            : new Date().toISOString(),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

function mapDailyAttendanceDoc(d: any): DailyAttendanceRecord {
  const data = d.data();
  let parsedRecords: DailyAttendanceRecord['records'] = {};
  if (typeof data.recordsJson === 'string' && data.recordsJson.trim()) {
    try {
      const obj = JSON.parse(data.recordsJson);
      if (obj && typeof obj === 'object') {
        parsedRecords = obj;
      }
    } catch {
      parsedRecords = {};
    }
  }
  const updatedAtIso =
    data.updatedAt && typeof data.updatedAt.toDate === 'function'
      ? data.updatedAt.toDate().toISOString()
      : new Date().toISOString();
  return {
    id: data.id || d.id,
    date: data.date || '',
    academicYear: data.academicYear || '২০২৬',
    classId: data.classId || '',
    section: data.section || 'ক',
    records: parsedRecords,
    updatedAt: updatedAtIso,
  };
}

export async function pushDailyAttendanceToFirestore(
  record: DailyAttendanceRecord,
  totalStudentsInClass: number,
  user: User,
  schoolInfo: SchoolInfo
): Promise<void> {
  if (!user.emailVerified || !record?.id) return;

  const cleanAttId = safeId(record.id);
  const cleanUid = safeId(user.uid);
  const path = `schools/${DEFAULT_SCHOOL_ID}/dailyAttendance/${cleanAttId}`;
  const ref = doc(db, 'schools', DEFAULT_SCHOOL_ID, 'dailyAttendance', cleanAttId);

  let schoolOwnerUid = cleanUid;
  try {
    const schoolSnap = await getDoc(doc(db, 'schools', DEFAULT_SCHOOL_ID));
    if (schoolSnap.exists() && typeof schoolSnap.data()?.ownerUid === 'string') {
      schoolOwnerUid = safeId(schoolSnap.data()!.ownerUid);
    }
  } catch {
    // Non-fatal
  }

  const entries = Object.values(record.records || {});
  const presentCount = entries.filter((e) => e?.status === 'present').length;
  const lateCount = entries.filter((e) => e?.status === 'late').length;
  const leaveCount = entries.filter((e) => e?.status === 'leave').length;
  const absentCount = entries.filter((e) => e?.status === 'absent').length;
  const totalStudents = Math.min(10000, Math.max(totalStudentsInClass || 0, entries.length));
  const recordsJson = clampStr(JSON.stringify(record.records || {}), 120000) || '{}';

  let existingSnap: Awaited<ReturnType<typeof getDoc>> | null = null;
  try {
    existingSnap = await getDocFromServer(ref);
  } catch {
    try {
      existingSnap = await getDoc(ref);
    } catch {
      existingSnap = null;
    }
  }

  try {
    if (existingSnap?.exists()) {
      await updateDoc(ref, {
        academicYear: clampStr(record.academicYear || '২০২৬', 24),
        section: clampStr(record.section || 'ক', 32),
        presentCount,
        absentCount,
        lateCount,
        leaveCount,
        totalStudents,
        recordsJson,
        updatedByUid: cleanUid,
        updatedAt: serverTimestamp(),
      });
    } else {
      if (user.email === BOOTSTRAP_ADMIN_EMAIL) {
        await ensureSchoolDocument(user, schoolInfo).catch(() => {});
      }
      await setDoc(ref, {
        id: cleanAttId,
        date: clampStr(record.date, 24),
        academicYear: clampStr(record.academicYear || '২০২৬', 24),
        classId: clampStr(record.classId, 64),
        section: clampStr(record.section || 'ক', 32),
        presentCount,
        absentCount,
        lateCount,
        leaveCount,
        totalStudents,
        recordsJson,
        ownerUid: schoolOwnerUid,
        updatedByUid: cleanUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeCloudDailyAttendance(
  user: User,
  onRecords: (records: DailyAttendanceRecord[], isInitialSnapshot: boolean) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!user.emailVerified) {
    return () => {};
  }
  const path = `schools/${DEFAULT_SCHOOL_ID}/dailyAttendance`;
  const colRef = collection(db, 'schools', DEFAULT_SCHOOL_ID, 'dailyAttendance');
  const reportSnapshotError = (error: unknown) => {
    try {
      handleFirestoreError(error, OperationType.LIST, path);
    } catch (wrappedErr: any) {
      onError?.(wrappedErr instanceof Error ? wrappedErr : new Error(String(error)));
    }
  };

  const isAdminUser = user.email === BOOTSTRAP_ADMIN_EMAIL;
  if (isAdminUser) {
    let isFirst = true;
    return onSnapshot(
      query(colRef, limit(200)),
      (snapshot) => {
        const list = snapshot.docs.map(mapDailyAttendanceDoc);
        onRecords(list, isFirst);
        isFirst = false;
      },
      reportSnapshotError
    );
  }

  const uid = safeId(user.uid);
  let isFirst = true;
  return onSnapshot(
    query(colRef, where('ownerUid', '==', uid), limit(200)),
    (snapshot) => {
      const list = snapshot.docs.map(mapDailyAttendanceDoc);
      onRecords(list, isFirst);
      isFirst = false;
    },
    reportSnapshotError
  );
}

export async function pullLatestCloudDailyAttendance(
  user: User
): Promise<DailyAttendanceRecord[]> {
  if (!user.emailVerified) return [];
  const path = `schools/${DEFAULT_SCHOOL_ID}/dailyAttendance`;
  const colRef = collection(db, 'schools', DEFAULT_SCHOOL_ID, 'dailyAttendance');
  const isAdminUser = user.email === BOOTSTRAP_ADMIN_EMAIL;
  const q = isAdminUser
    ? query(colRef, limit(200))
    : query(colRef, where('ownerUid', '==', safeId(user.uid)), limit(200));

  try {
    let snap;
    try {
      snap = await getDocsFromServer(q);
    } catch {
      snap = await getDocs(q);
    }
    return snap.docs.map(mapDailyAttendanceDoc);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function pushStaffLeaveToFirestore(
  leave: StaffLeaveRequest,
  user: User,
  schoolInfo: SchoolInfo
): Promise<void> {
  if (!user.emailVerified || !leave?.id) return;

  const cleanLeaveId = safeId(leave.id);
  const cleanUid = safeId(user.uid);
  const path = `schools/${DEFAULT_SCHOOL_ID}/staffLeaves/${cleanLeaveId}`;
  const ref = doc(db, 'schools', DEFAULT_SCHOOL_ID, 'staffLeaves', cleanLeaveId);

  let schoolOwnerUid = cleanUid;
  try {
    const schoolSnap = await getDoc(doc(db, 'schools', DEFAULT_SCHOOL_ID));
    if (schoolSnap.exists() && typeof schoolSnap.data()?.ownerUid === 'string') {
      schoolOwnerUid = safeId(schoolSnap.data()!.ownerUid);
    }
  } catch {
    // Non-fatal
  }

  let existingSnap: Awaited<ReturnType<typeof getDoc>> | null = null;
  try {
    existingSnap = await getDocFromServer(ref);
  } catch {
    try {
      existingSnap = await getDoc(ref);
    } catch {
      existingSnap = null;
    }
  }

  try {
    if (existingSnap?.exists()) {
      await updateDoc(ref, {
        status: leave.status === 'approved' || leave.status === 'rejected' ? leave.status : 'pending',
        ...(leave.reviewedBy ? { reviewedBy: clampStr(leave.reviewedBy, 160) } : {}),
        ...(leave.reviewNote ? { reviewNote: clampStr(leave.reviewNote, 500) } : {}),
        updatedAt: serverTimestamp(),
      });
    } else {
      if (user.email === BOOTSTRAP_ADMIN_EMAIL) {
        await ensureSchoolDocument(user, schoolInfo).catch(() => {});
      }
      await setDoc(ref, {
        id: cleanLeaveId,
        staffId: safeId(leave.staffId),
        ...(leave.staffCode ? { staffCode: clampStr(leave.staffCode, 40) } : {}),
        staffNameBn: clampStr(leave.staffNameBn || 'এমপ্লয়ী', 160),
        designationBn: clampStr(leave.designationBn || 'শিক্ষক', 120),
        startDate: clampStr(leave.startDate, 24),
        endDate: clampStr(leave.endDate, 24),
        daysCount: Math.max(1, Math.min(60, Math.round(leave.daysCount || 1))),
        leaveType: leave.leaveType || 'casual',
        reason: clampStr(leave.reason || 'ব্যক্তিগত কারণ', 500),
        status: leave.status === 'approved' || leave.status === 'rejected' ? leave.status : 'pending',
        ...(leave.reviewedBy ? { reviewedBy: clampStr(leave.reviewedBy, 160) } : {}),
        ...(leave.reviewNote ? { reviewNote: clampStr(leave.reviewNote, 500) } : {}),
        ownerUid: schoolOwnerUid,
        staffUid: cleanUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteStaffLeaveFromFirestore(
  leaveId: string,
  user: User
): Promise<void> {
  if (!user.emailVerified || !leaveId) return;
  const cleanLeaveId = safeId(leaveId);
  const path = `schools/${DEFAULT_SCHOOL_ID}/staffLeaves/${cleanLeaveId}`;
  const ref = doc(db, 'schools', DEFAULT_SCHOOL_ID, 'staffLeaves', cleanLeaveId);
  try {
    await deleteDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

function mapStaffLeaveDoc(d: { id: string; data: () => Record<string, any> }): StaffLeaveRequest {
  const data = d.data();
  return {
    id: data.id || d.id,
    staffId: data.staffId || '',
    staffCode: data.staffCode || undefined,
    staffNameBn: data.staffNameBn || '',
    designationBn: data.designationBn || 'শিক্ষক',
    startDate: data.startDate || '',
    endDate: data.endDate || '',
    daysCount: Number(data.daysCount) || 1,
    leaveType: data.leaveType || 'casual',
    reason: data.reason || '',
    status: data.status || 'pending',
    reviewedBy: data.reviewedBy || undefined,
    reviewNote: data.reviewNote || undefined,
    createdAt:
      data.createdAt && typeof data.createdAt.toDate === 'function'
        ? data.createdAt.toDate().toISOString()
        : new Date().toISOString(),
    updatedAt:
      data.updatedAt && typeof data.updatedAt.toDate === 'function'
        ? data.updatedAt.toDate().toISOString()
        : new Date().toISOString(),
  };
}

export async function pullStaffLeavesFromFirestore(
  user: User
): Promise<StaffLeaveRequest[]> {
  if (!user.emailVerified) return [];
  const path = `schools/${DEFAULT_SCHOOL_ID}/staffLeaves`;
  const colRef = collection(db, 'schools', DEFAULT_SCHOOL_ID, 'staffLeaves');
  const isAdminUser = user.email === BOOTSTRAP_ADMIN_EMAIL;

  try {
    if (isAdminUser) {
      const snap = await getDocs(query(colRef, limit(200)));
      return snap.docs.map(mapStaffLeaveDoc);
    }
    const uid = safeId(user.uid);
    const [ownerSnap, staffSnap] = await Promise.all([
      getDocs(query(colRef, where('ownerUid', '==', uid), limit(200))),
      getDocs(query(colRef, where('staffUid', '==', uid), limit(200))),
    ]);
    const map = new Map<string, StaffLeaveRequest>();
    for (const snap of [ownerSnap, staffSnap]) {
      for (const d of snap.docs) {
        const mapped = mapStaffLeaveDoc(d);
        map.set(mapped.id, mapped);
      }
    }
    return Array.from(map.values());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export function subscribeCloudStaffLeaves(
  user: User,
  onLeaves: (leaves: StaffLeaveRequest[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!user.emailVerified) {
    return () => {};
  }
  const path = `schools/${DEFAULT_SCHOOL_ID}/staffLeaves`;
  const colRef = collection(db, 'schools', DEFAULT_SCHOOL_ID, 'staffLeaves');

  const reportSnapshotError = (error: unknown) => {
    try {
      handleFirestoreError(error, OperationType.LIST, path);
    } catch (wrappedErr: any) {
      onError?.(wrappedErr instanceof Error ? wrappedErr : new Error(String(error)));
    }
  };

  const isAdminUser = user.email === BOOTSTRAP_ADMIN_EMAIL;
  if (isAdminUser) {
    return onSnapshot(
      query(colRef, limit(200)),
      (snapshot) => {
        const list = snapshot.docs
          .map(mapStaffLeaveDoc)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        onLeaves(list);
      },
      reportSnapshotError
    );
  }

  const uid = safeId(user.uid);
  const ownerMap = new Map<string, StaffLeaveRequest>();
  const staffMap = new Map<string, StaffLeaveRequest>();

  const emitMerged = () => {
    const merged = new Map<string, StaffLeaveRequest>();
    for (const [k, v] of ownerMap.entries()) merged.set(k, v);
    for (const [k, v] of staffMap.entries()) merged.set(k, v);
    const list = Array.from(merged.values()).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
    onLeaves(list);
  };

  const unsubOwner = onSnapshot(
    query(colRef, where('ownerUid', '==', uid), limit(200)),
    (snapshot) => {
      ownerMap.clear();
      for (const d of snapshot.docs) {
        const mapped = mapStaffLeaveDoc(d);
        ownerMap.set(mapped.id, mapped);
      }
      emitMerged();
    },
    reportSnapshotError
  );

  const unsubStaff = onSnapshot(
    query(colRef, where('staffUid', '==', uid), limit(200)),
    (snapshot) => {
      staffMap.clear();
      for (const d of snapshot.docs) {
        const mapped = mapStaffLeaveDoc(d);
        staffMap.set(mapped.id, mapped);
      }
      emitMerged();
    },
    reportSnapshotError
  );

  return () => {
    unsubOwner();
    unsubStaff();
  };
}

export async function pushStaffActivityToFirestore(
  activity: StaffActivityLog,
  user: User,
  schoolInfo: SchoolInfo
): Promise<void> {
  if (!user.emailVerified || !activity?.id) return;

  const cleanActId = safeId(activity.id);
  const cleanUid = safeId(user.uid);
  const path = `schools/${DEFAULT_SCHOOL_ID}/staffActivities/${cleanActId}`;
  const ref = doc(db, 'schools', DEFAULT_SCHOOL_ID, 'staffActivities', cleanActId);

  let schoolOwnerUid = cleanUid;
  try {
    const schoolSnap = await getDoc(doc(db, 'schools', DEFAULT_SCHOOL_ID));
    if (schoolSnap.exists() && typeof schoolSnap.data()?.ownerUid === 'string') {
      schoolOwnerUid = safeId(schoolSnap.data()!.ownerUid);
    }
  } catch {
    // Non-fatal
  }

  try {
    if (user.email === BOOTSTRAP_ADMIN_EMAIL) {
      await ensureSchoolDocument(user, schoolInfo).catch(() => {});
    }
    await setDoc(ref, {
      id: cleanActId,
      staffId: safeId(activity.staffId),
      staffNameBn: clampStr(activity.staffNameBn || 'এমপ্লয়ী', 160),
      designationBn: clampStr(activity.designationBn || 'শিক্ষক', 120),
      categoryKey: clampStr(activity.categoryKey || 'teacher', 40),
      date: clampStr(activity.date, 24),
      title: clampStr(activity.title, 200),
      ...(activity.details ? { details: clampStr(activity.details, 1000) } : {}),
      timestamp: clampStr(activity.timestamp || new Date().toISOString(), 64),
      ownerUid: schoolOwnerUid,
      staffUid: cleanUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function pullStaffActivitiesFromFirestore(
  user: User
): Promise<StaffActivityLog[]> {
  if (!user.emailVerified) return [];
  const path = `schools/${DEFAULT_SCHOOL_ID}/staffActivities`;
  const colRef = collection(db, 'schools', DEFAULT_SCHOOL_ID, 'staffActivities');
  const isAdminUser = user.email === BOOTSTRAP_ADMIN_EMAIL;

  try {
    if (isAdminUser) {
      const snap = await getDocs(query(colRef, limit(200)));
      return snap.docs.map((d) => {
        const data = d.data();
        return {
          id: data.id || d.id,
          staffId: data.staffId || '',
          staffNameBn: data.staffNameBn || '',
          designationBn: data.designationBn || 'শিক্ষক',
          categoryKey: (data.categoryKey || 'teacher') as StaffCategoryKey,
          date: data.date || '',
          title: data.title || '',
          details: data.details || undefined,
          timestamp: data.timestamp || new Date().toISOString(),
        };
      });
    }
    const uid = safeId(user.uid);
    const [ownerSnap, staffSnap] = await Promise.all([
      getDocs(query(colRef, where('ownerUid', '==', uid), limit(200))),
      getDocs(query(colRef, where('staffUid', '==', uid), limit(200))),
    ]);
    const map = new Map<string, StaffActivityLog>();
    for (const snap of [ownerSnap, staffSnap]) {
      for (const d of snap.docs) {
        const data = d.data();
        const id = data.id || d.id;
        map.set(id, {
          id,
          staffId: data.staffId || '',
          staffNameBn: data.staffNameBn || '',
          designationBn: data.designationBn || 'শিক্ষক',
          categoryKey: (data.categoryKey || 'teacher') as StaffCategoryKey,
          date: data.date || '',
          title: data.title || '',
          details: data.details || undefined,
          timestamp: data.timestamp || new Date().toISOString(),
        });
      }
    }
    return Array.from(map.values());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}
