import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  limit,
  Unsubscribe,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { SchoolInfo, SecurityGatepassLog, Student } from '../types';

export const DEFAULT_SCHOOL_ID = 'dlikon_academy';
export const BOOTSTRAP_ADMIN_EMAIL = 'chorcho2utkosho@gmail.com';

const clampStr = (val: unknown, max: number): string => {
  const s = typeof val === 'string' ? val : String(val ?? '');
  return s.slice(0, max);
};

const safeId = (val: string): string => {
  const cleaned = val.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);
  return cleaned || `doc_${Date.now()}`;
};

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
  guardianUid?: string
): Promise<void> {
  if (!user.emailVerified) return;
  await ensureSchoolDocument(user, schoolInfo);

  const cleanLogId = safeId(log.id);
  const path = `schools/${DEFAULT_SCHOOL_ID}/securityLogs/${cleanLogId}`;
  const ref = doc(db, 'schools', DEFAULT_SCHOOL_ID, 'securityLogs', cleanLogId);

  const payload: Record<string, any> = {
    id: cleanLogId,
    studentId: safeId(log.studentId),
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

  if (log.guardianResponse) payload.guardianResponse = clampStr(log.guardianResponse, 300);
  if (log.acknowledgedAt) payload.acknowledgedAt = clampStr(log.acknowledgedAt, 64);
  if (log.acknowledgedBy) payload.acknowledgedBy = clampStr(log.acknowledgedBy, 160);
  if (guardianUid) payload.guardianUid = safeId(guardianUid);

  try {
    await setDoc(ref, payload);
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

export async function syncStudentRecordToFirestore(
  student: Student,
  user: User,
  schoolInfo: SchoolInfo
): Promise<void> {
  if (!user.emailVerified) return;
  await ensureSchoolDocument(user, schoolInfo);

  const cleanStudentId = safeId(student.id);
  const path = `schools/${DEFAULT_SCHOOL_ID}/students/${cleanStudentId}`;
  const ref = doc(db, 'schools', DEFAULT_SCHOOL_ID, 'students', cleanStudentId);

  try {
    const existingSnap = await getDoc(ref);
    const payload: Record<string, any> = {
      id: cleanStudentId,
      nameBn: clampStr(student.nameBn, 160),
      roll: Number(student.roll) || 0,
      classId: clampStr(student.classId, 64),
      ownerUid: existingSnap.exists()
        ? safeId(existingSnap.data().ownerUid || user.uid)
        : safeId(user.uid),
      updatedAt: serverTimestamp(),
    };
    if (!existingSnap.exists()) {
      payload.createdAt = serverTimestamp();
    } else {
      payload.createdAt = existingSnap.data().createdAt || serverTimestamp();
    }
    if (student.section) payload.section = clampStr(student.section, 32);
    if (student.portalUserId) payload.portalUserId = clampStr(student.portalUserId, 64);
    if (student.guardianPhone) payload.guardianPhone = clampStr(student.guardianPhone, 32);
    if (student.guardianName) payload.guardianNameBn = clampStr(student.guardianName, 160);
    if (student.guardianPin) payload.guardianPin = clampStr(student.guardianPin, 32);

    if (existingSnap.exists()) {
      await updateDoc(ref, payload);
    } else {
      await setDoc(ref, payload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeCloudSecurityLogs(
  user: User,
  onLogs: (logs: SecurityGatepassLog[], isInitialSnapshot: boolean) => void
): Unsubscribe {
  if (!user.emailVerified) {
    return () => {};
  }
  const path = `schools/${DEFAULT_SCHOOL_ID}/securityLogs`;
  const colRef = collection(db, 'schools', DEFAULT_SCHOOL_ID, 'securityLogs');

  const isAdminUser = user.email === BOOTSTRAP_ADMIN_EMAIL;
  const q = isAdminUser
    ? query(colRef, orderBy('timestamp', 'desc'), limit(100))
    : query(colRef, where('guardianUid', '==', safeId(user.uid)), limit(100));

  let isFirst = true;
  return onSnapshot(
    q,
    (snapshot) => {
      const logs: SecurityGatepassLog[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: data.id || d.id,
          studentId: data.studentId,
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
      });
      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      onLogs(logs, isFirst);
      isFirst = false;
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}
