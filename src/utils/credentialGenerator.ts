import { getStudentPortalId } from './bengali';

const WEAK_PINS = new Set([
  '1234',
  '4321',
  '0000',
  '1111',
  '12345',
  '123456',
  '654321',
  '000000',
  '111111',
  '222222',
  '333333',
  '444444',
  '555555',
  '666666',
  '777777',
  '888888',
  '999999',
  '121212',
  '012345',
  '543210',
  'admin123',
]);

export function isWeakOrDefaultPin(pin?: string | null): boolean {
  if (!pin || typeof pin !== 'string') return true;
  const clean = pin.trim();
  if (clean.length < 4) return true;
  if (WEAK_PINS.has(clean.toLowerCase())) return true;
  if (/^(.)\1+$/.test(clean)) return true;
  if (/^\d+$/.test(clean) && clean.length >= 4) {
    if ('0123456789'.includes(clean) || '9876543210'.includes(clean)) return true;
  }
  return false;
}

function fnv1a32(input: string, seed = 2166136261): number {
  let hash = seed >>> 0;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

export function computeDeterministicStudentPin(student: {
  id?: string;
  classId?: string;
  roll?: number | string;
  portalUserId?: string;
  nameBn?: string;
}): string {
  const key = `${(student.portalUserId || '').trim().toUpperCase()}|${student.id || ''}|${student.classId || ''}|${student.roll ?? ''}|${student.nameBn || ''}`;
  const h1 = fnv1a32(key, 2166136261);
  const h2 = fnv1a32(`DLIKON:${key}`, h1 ^ 0x9e3779b9);
  let num = (h2 % 900000) + 100000;
  let guard = 0;
  while (isWeakOrDefaultPin(String(num)) && guard < 100) {
    num = ((num - 100000 + 7919) % 900000) + 100000;
    guard++;
  }
  return String(num);
}

export function generateUniquePin6(existingPins?: Set<string>, seedHint?: string): string {
  const startBase = seedHint ? fnv1a32(seedHint) : Math.floor(Math.random() * 900000);
  for (let attempt = 0; attempt < 500; attempt++) {
    const offset = attempt === 0 && seedHint ? startBase % 900000 : Math.floor(Math.random() * 900000);
    const num = (offset % 900000) + 100000;
    const candidate = String(num);
    if (!isWeakOrDefaultPin(candidate) && (!existingPins || !existingPins.has(candidate))) {
      existingPins?.add(candidate);
      return candidate;
    }
  }
  let fallback = (startBase % 900000) + 100000;
  while (isWeakOrDefaultPin(String(fallback)) || (existingPins && existingPins.has(String(fallback)))) {
    fallback = ((fallback - 100000 + 7919) % 900000) + 100000;
  }
  const resolved = String(fallback);
  existingPins?.add(resolved);
  return resolved;
}

const UNAMBIGUOUS_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const UNAMBIGUOUS_DIGITS = '23456789';
const UNAMBIGUOUS_ALPHANUM = `${UNAMBIGUOUS_LETTERS}${UNAMBIGUOUS_DIGITS}`;

export interface StaffPasswordHint {
  staffCode?: string;
  categoryKey?: string;
  designationBn?: string;
  role?: string;
}

function resolveStaffPrefix(prefixOrStaff?: string | StaffPasswordHint): string {
  if (!prefixOrStaff) return 'DL';
  if (typeof prefixOrStaff === 'string') return prefixOrStaff;
  const code = String(prefixOrStaff.staffCode || '').toUpperCase();
  if (code.includes('-DIR-')) return 'DR';
  if (code.includes('-VP-')) return 'VP';
  if (code.includes('-ACC-')) return 'AC';
  if (code.includes('-TCH-')) return 'TC';
  if (code.includes('-DP-')) return 'DP';
  if (code.includes('-AYA-')) return 'AY';
  if (code.includes('-NG-')) return 'NG';
  if (code.includes('-PRN-')) return 'PR';
  const cat = String(prefixOrStaff.categoryKey || '').toLowerCase();
  if (cat.includes('entrepreneur')) return 'DR';
  if (cat.includes('assistant')) return 'VP';
  if (cat.includes('accountant')) return 'AC';
  if (cat.includes('teacher')) return 'TC';
  if (cat.includes('office_assistant')) return 'DP';
  if (cat.includes('aya')) return 'AY';
  if (cat.includes('night') || cat.includes('guard')) return 'NG';
  return prefixOrStaff.role === 'official' ? 'OF' : 'ST';
}

export function generateStaffPassword(
  prefixOrStaff: string | StaffPasswordHint = 'DL',
  existingPasswords?: Set<string>
): string {
  const cleanPrefix = resolveStaffPrefix(prefixOrStaff)
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .replace(/[ILO]/g, 'X');
  const tag = (cleanPrefix + 'DL').slice(0, 2);

  for (let attempt = 0; attempt < 500; attempt++) {
    const d1 = UNAMBIGUOUS_DIGITS[Math.floor(Math.random() * UNAMBIGUOUS_DIGITS.length)];
    const d2 = UNAMBIGUOUS_DIGITS[Math.floor(Math.random() * UNAMBIGUOUS_DIGITS.length)];
    const c3 = UNAMBIGUOUS_ALPHANUM[Math.floor(Math.random() * UNAMBIGUOUS_ALPHANUM.length)];
    const d4 = UNAMBIGUOUS_DIGITS[Math.floor(Math.random() * UNAMBIGUOUS_DIGITS.length)];
    const candidate = `${tag}${d1}${d2}${c3}${d4}`;
    if (
      !isWeakOrDefaultPin(candidate) &&
      (!existingPasswords || !existingPasswords.has(candidate))
    ) {
      existingPasswords?.add(candidate);
      return candidate;
    }
  }
  const fallback = `${tag}${generateUniquePin6().slice(0, 4)}`;
  existingPasswords?.add(fallback);
  return fallback;
}

export interface CredentialStudentShape {
  id: string;
  classId: string;
  roll: number;
  nameBn?: string;
  portalUserId?: string;
  guardianPin?: string;
  unlockEpoch?: number;
}

export function ensureUniqueStudentCredentials<T extends CredentialStudentShape>(
  students: T[]
): T[] {
  if (!Array.isArray(students) || students.length === 0) {
    return Array.isArray(students) ? students : [];
  }

  const usedPins = new Set<string>();
  const resolvedCustomPinForIndex = new Map<number, string>();

  // Pass 1: preserve already-customized unique non-weak PINs
  students.forEach((s, idx) => {
    if (!s || typeof s !== 'object') return;
    const rawPin = typeof s.guardianPin === 'string' ? s.guardianPin.trim() : '';
    if (rawPin && !isWeakOrDefaultPin(rawPin) && !usedPins.has(rawPin)) {
      usedPins.add(rawPin);
      resolvedCustomPinForIndex.set(idx, rawPin);
    }
  });

  let changed = false;

  // Pass 2: assign deterministic unique 6-digit PINs for missing/weak/duplicate entries
  const nextStudents = students.map((s, idx) => {
    if (!s || typeof s !== 'object') return s;
    const expectedPortalId =
      typeof s.portalUserId === 'string' && s.portalUserId.trim()
        ? s.portalUserId.trim().toUpperCase()
        : getStudentPortalId(s);

    let nextPin = resolvedCustomPinForIndex.get(idx);
    if (!nextPin) {
      const seedPin = computeDeterministicStudentPin({
        ...s,
        portalUserId: expectedPortalId,
      });
      let num = Number(seedPin);
      let candidate = String(num);
      let guard = 0;
      while ((isWeakOrDefaultPin(candidate) || usedPins.has(candidate)) && guard < 1000) {
        num = ((num - 100000 + 7919) % 900000) + 100000;
        candidate = String(num);
        guard++;
      }
      nextPin = candidate;
      usedPins.add(nextPin);
    }

    const nextUnlockEpoch =
      typeof s.unlockEpoch === 'number' && Number.isFinite(s.unlockEpoch) && s.unlockEpoch >= 0
        ? Math.floor(s.unlockEpoch)
        : 0;

    if (
      s.portalUserId !== expectedPortalId ||
      s.guardianPin !== nextPin ||
      s.unlockEpoch !== nextUnlockEpoch
    ) {
      changed = true;
      return {
        ...s,
        portalUserId: expectedPortalId,
        guardianPin: nextPin,
        unlockEpoch: nextUnlockEpoch,
      };
    }
    return s;
  });

  return changed ? nextStudents : students;
}
