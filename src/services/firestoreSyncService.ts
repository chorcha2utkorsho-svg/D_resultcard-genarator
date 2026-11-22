import {
  collection,
  doc,
  getDoc,
  getDocs,
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
import { LibraryMaterial, SchoolInfo, SecurityGatepassLog, Student } from '../types';

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

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        portalUserId: clampStr(portalUserId || student.portalUserId || '', 64),
        studentNameBn: clampStr(student.nameBn || 'শিক্ষার্থী', 160),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        id: bindingId,
        studentId: cleanStudentId,
        portalUserId: clampStr(portalUserId || student.portalUserId || '', 64),
        studentNameBn: clampStr(student.nameBn || 'শিক্ষার্থী', 160),
        guardianUid: cleanUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
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
        ownerUid: safeId(user.uid),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
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
      serverTimestamp: typeof data.serverTimestamp === 'number' ? data.serverTimestamp : undefined,
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
    query(colRef, where('ownerUid', '==', uid), limit(100)),
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
    query(colRef, where('guardianUid', '==', uid), limit(100)),
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
    query(colRef, where('guardianUids', 'array-contains', uid), limit(100)),
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

