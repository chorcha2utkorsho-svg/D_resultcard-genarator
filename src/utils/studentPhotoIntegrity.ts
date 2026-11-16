import {
  ExplicitPhotoClearFlags,
  SchoolClass,
  Student,
  StudentPhotoRegistryEntry,
} from '../types';

export type PhotoFieldKey = 'avatarUrl' | 'fatherAvatarUrl' | 'motherAvatarUrl';

export const PHOTO_FIELD_KEYS: PhotoFieldKey[] = [
  'avatarUrl',
  'fatherAvatarUrl',
  'motherAvatarUrl',
];

export const CLASS_1_TO_8_IDS = new Set([
  'class_1',
  'class_2',
  'class_3',
  'class_4',
  'class_5',
  'class_6',
  'class_7',
  'class_8',
]);

/**
 * Validates that an image URL or Data URL is structurally sound and not a
 * truncated/empty/corrupted placeholder string.
 */
export function isValidImageReference(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (!trimmed) return false;

  if (trimmed.startsWith('data:image/')) {
    if (trimmed.startsWith('data:image/svg+xml')) {
      return trimmed.length >= 30;
    }
    const commaIdx = trimmed.indexOf(',');
    if (commaIdx === -1) return false;
    const payload = trimmed.slice(commaIdx + 1);
    return payload.length >= 24;
  }

  if (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed.length >= 5;
  }

  return false;
}

/**
 * Computes a normalized (classId, roll) relationship lookup key so photo
 * references survive bulk CSV/Excel upserts or ID regenerations.
 */
export function buildStudentRelationKey(
  student: Partial<Pick<Student, 'classId' | 'roll' | 'section'>>,
  includeSection = false
): string {
  const cls = String(student.classId || '').trim().toLowerCase();
  const roll = Number(student.roll ?? 0);
  if (!cls || !Number.isFinite(roll) || roll <= 0) return '';
  if (!includeSection) return `${cls}::${roll}`;
  const sec = String(student.section || '').trim().toLowerCase();
  return `${cls}::${roll}::${sec}`;
}

/**
 * Reconciles incoming student profile updates against both the existing
 * student record and the relational photo registry so old/existing image
 * references are NEVER silently wiped by stale UI state, bulk imports, or
 * stripped sync payloads.
 */
export function reconcileStudentPhotoReferences(
  incoming: Partial<Student> & { id: string },
  existing?: Partial<Student> | null,
  registryEntry?: Partial<StudentPhotoRegistryEntry> | null,
  options?: {
    explicitClear?: boolean | ExplicitPhotoClearFlags;
    isStrippedSync?: boolean;
  }
): { student: Student; protectedFields: PhotoFieldKey[] } {
  const explicitClear = options?.explicitClear;
  const isStrippedSync = Boolean(options?.isStrippedSync);
  const protectedFields: PhotoFieldKey[] = [];

  const incTime = new Date(incoming.photoUpdatedAt || 0).getTime() || 0;
  const extTime =
    Math.max(
      new Date(existing?.photoUpdatedAt || 0).getTime() || 0,
      new Date(registryEntry?.photoUpdatedAt || 0).getTime() || 0
    ) || 0;

  const isFieldExplicitlyCleared = (field: PhotoFieldKey): boolean => {
    if (explicitClear === true) return true;
    if (explicitClear && typeof explicitClear === 'object') {
      return Boolean(explicitClear[field]);
    }
    return false;
  };

  const resolveField = (field: PhotoFieldKey): string => {
    const rawInc = incoming[field];
    const incValid = isValidImageReference(rawInc) ? rawInc.trim() : '';

    const rawExt = existing?.[field];
    const extValid = isValidImageReference(rawExt) ? rawExt.trim() : '';

    const rawReg = registryEntry?.[field];
    const regValid = isValidImageReference(rawReg) ? rawReg.trim() : '';

    const preservedFallback = extValid || regValid;

    // 1. Honor explicit user-initiated photo deletion ("ছবি মুছুন")
    if (isFieldExplicitlyCleared(field)) {
      return '';
    }

    // 2. If stripped sync payload dropped image bytes, ALWAYS keep existing/registry image
    if (isStrippedSync && !incValid && preservedFallback) {
      protectedFields.push(field);
      return preservedFallback;
    }

    // 3. Relationship guard: never drop a valid existing image when incoming is empty/invalid
    if (!incValid && preservedFallback) {
      protectedFields.push(field);
      return preservedFallback;
    }

    // 4. Both exist: preserve whichever image carries a strictly newer timestamp
    if (incValid && preservedFallback && extTime > incTime && incTime > 0) {
      protectedFields.push(field);
      return preservedFallback;
    }

    return incValid || preservedFallback || '';
  };

  const nextAvatar = resolveField('avatarUrl');
  const nextFather = resolveField('fatherAvatarUrl');
  const nextMother = resolveField('motherAvatarUrl');

  const mergedDreamGallery =
    Array.isArray(incoming.dreamGallery) && incoming.dreamGallery.length > 0
      ? incoming.dreamGallery
      : Array.isArray(existing?.dreamGallery) && existing.dreamGallery.length > 0
      ? existing.dreamGallery
      : incoming.dreamGallery || existing?.dreamGallery;

  const nextPhotoUpdatedAt =
    incTime >= extTime
      ? incoming.photoUpdatedAt || existing?.photoUpdatedAt || registryEntry?.photoUpdatedAt
      : existing?.photoUpdatedAt || registryEntry?.photoUpdatedAt || incoming.photoUpdatedAt;

  const hasAnyPhoto = Boolean(nextAvatar || nextFather || nextMother);
  const resolvedClassId = incoming.classId || existing?.classId || registryEntry?.classId || 'class_play';
  const resolvedRoll = incoming.roll ?? existing?.roll ?? registryEntry?.roll ?? 1;

  const cleanMerged: Record<string, any> = {
    ...(existing || {}),
    ...incoming,
    id: incoming.id || existing?.id,
    classId: resolvedClassId,
    roll: resolvedRoll,
    avatarUrl: nextAvatar,
    fatherAvatarUrl: nextFather,
    motherAvatarUrl: nextMother,
    ...(mergedDreamGallery !== undefined ? { dreamGallery: mergedDreamGallery } : {}),
    ...(nextPhotoUpdatedAt
      ? { photoUpdatedAt: nextPhotoUpdatedAt }
      : hasAnyPhoto
      ? { photoUpdatedAt: new Date().toISOString() }
      : {}),
    portalUserId: incoming.portalUserId || existing?.portalUserId,
    guardianPin: incoming.guardianPin || existing?.guardianPin,
    securityQrCode:
      incoming.securityQrCode ||
      existing?.securityQrCode ||
      `DLIKON-SEC-${String(resolvedClassId).toUpperCase()}-${resolvedRoll}-${String(incoming.id).slice(-4).toUpperCase()}`,
  };

  delete cleanMerged._photosStripped;
  delete cleanMerged._explicitPhotoClear;

  return {
    student: cleanMerged as Student,
    protectedFields,
  };
}

/**
 * Runs a relationship & format audit across all classes (Play to Class 8)
 * and restores missing image references from the local IndexedDB photo map.
 */
export function auditAndRepairLocalStudentPhotos(
  students: Student[],
  classes: SchoolClass[],
  photoMap?: Record<string, Partial<StudentPhotoRegistryEntry>> | null
): {
  repairedStudents: Student[];
  repairedCount: number;
  invalidClearedCount: number;
  perClass: {
    classId: string;
    classNameBn: string;
    totalStudents: number;
    withStudentPhoto: number;
    withFatherPhoto: number;
    withMotherPhoto: number;
    repairedCount: number;
    invalidCount: number;
  }[];
} {
  let repairedCount = 0;
  let invalidClearedCount = 0;
  const perClassRepairs = new Map<string, number>();
  const perClassInvalid = new Map<string, number>();

  // Build relation fallback index from photoMap in case ID changed during re-import
  const relationRegistry = new Map<string, Partial<StudentPhotoRegistryEntry>>();
  if (photoMap && typeof photoMap === 'object') {
    for (const [idKey, entry] of Object.entries(photoMap)) {
      if (!entry) continue;
      const relKey = buildStudentRelationKey(
        { classId: entry.classId, roll: entry.roll },
        false
      );
      if (relKey && (entry.avatarUrl || entry.fatherAvatarUrl || entry.motherAvatarUrl)) {
        relationRegistry.set(relKey, { ...entry, studentId: idKey });
      }
    }
  }

  const repairedStudents = students.map((std) => {
    const idEntry = photoMap?.[std.id];
    const relKey = buildStudentRelationKey(std, false);
    const regEntry = idEntry || (relKey ? relationRegistry.get(relKey) : undefined);

    let localInvalid = 0;
    for (const field of PHOTO_FIELD_KEYS) {
      const val = std[field];
      if (typeof val === 'string' && val.trim().length > 0 && !isValidImageReference(val)) {
        localInvalid++;
      }
    }
    if (localInvalid > 0) {
      invalidClearedCount += localInvalid;
      perClassInvalid.set(std.classId, (perClassInvalid.get(std.classId) || 0) + localInvalid);
    }

    const { student: cleanStd, protectedFields } = reconcileStudentPhotoReferences(
      std,
      std,
      regEntry
    );

    if (protectedFields.length > 0) {
      repairedCount++;
      perClassRepairs.set(std.classId, (perClassRepairs.get(std.classId) || 0) + 1);
    }

    return cleanStd;
  });

  const perClass = classes.map((cls) => {
    const list = repairedStudents.filter((s) => s.classId === cls.id);
    return {
      classId: cls.id,
      classNameBn: cls.nameBn,
      totalStudents: list.length,
      withStudentPhoto: list.filter((s) => isValidImageReference(s.avatarUrl)).length,
      withFatherPhoto: list.filter((s) => isValidImageReference(s.fatherAvatarUrl)).length,
      withMotherPhoto: list.filter((s) => isValidImageReference(s.motherAvatarUrl)).length,
      repairedCount: perClassRepairs.get(cls.id) || 0,
      invalidCount: perClassInvalid.get(cls.id) || 0,
    };
  });

  return {
    repairedStudents,
    repairedCount,
    invalidClearedCount,
    perClass,
  };
}
