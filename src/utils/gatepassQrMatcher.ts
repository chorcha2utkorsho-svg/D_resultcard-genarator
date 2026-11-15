import { SchoolClass, Student } from '../types';
import { getStudentPortalId, normalizeBengaliDigits, toBengaliRoll } from './bengali';

export interface GatepassMatchResult {
  student: Student | null;
  matchedBy?:
    | 'security_qr'
    | 'default_sec_qr'
    | 'legacy_qr'
    | 'portal_id'
    | 'student_id'
    | 'birth_reg'
    | 'id_suffix_class_roll'
    | 'phone'
    | 'unique_roll'
    | 'name';
  reason?: 'ambiguous_roll' | 'invalid_structured_token' | 'not_found';
  ambiguousMatches?: Student[];
  errorMessage?: string;
}

export function getCanonicalStudentQrTokens(student: Student): {
  primarySecQr: string;
  legacyQr: string;
  portalId: string;
  idLast4: string;
} {
  const classUpper = (student.classId || 'CLS').toUpperCase();
  const idLast4 = (student.id || '').slice(-4).toUpperCase();
  const primarySecQr = `DLIKON-SEC-${classUpper}-${student.roll}-${idLast4}`;
  const legacyQr = `DLIKON-${classUpper}-${student.roll}-${idLast4}`;
  const portalId = getStudentPortalId(student).toUpperCase();
  return { primarySecQr, legacyQr, portalId, idLast4 };
}

function extractEmbeddedToken(rawTrimmed: string): string {
  // Handle full URL QR payloads such as https://.../?guardian=std_...
  const guardianMatch = rawTrimmed.match(/[?&]guardian=([^&#\s]+)/i);
  if (guardianMatch && guardianMatch[1]) {
    try {
      return decodeURIComponent(guardianMatch[1]).trim();
    } catch {
      return guardianMatch[1].trim();
    }
  }
  const dlikonMatch = rawTrimmed.match(/(DLIKON-(?:SEC-)?[A-Z0-9_]+-\d+-[A-Z0-9]+)/i);
  if (dlikonMatch && dlikonMatch[1]) {
    return dlikonMatch[1].trim();
  }
  const stdMatch = rawTrimmed.match(/(std_[a-z0-9_]+)/i);
  if (stdMatch && stdMatch[1]) {
    return stdMatch[1].trim();
  }
  return rawTrimmed;
}

/**
 * Matches a scanned QR payload or manual search query to an exact student.
 * Strict rules:
 *  1. Unique QR / Portal ID / Student ID / Birth Reg matches ALWAYS take top priority.
 *  2. Structured QR tokens (DLIKON-*, std_*, DL-*) NEVER fall back to bare roll numbers
 *     so another class's Roll 1 (like মোঃ মাজিদ at index 0) can NEVER be falsely selected.
 *  3. Bare roll numbers (e.g. "1") only match if exactly 1 student in the school has that roll;
 *     otherwise return an explicit ambiguous_roll error asking to scan QR or enter unique ID.
 */
export function matchStudentByQrOrQuery(
  inputQuery: string,
  students: Student[],
  classes: SchoolClass[] = []
): GatepassMatchResult {
  const rawTrimmed = (inputQuery || '').trim();
  if (!rawTrimmed || students.length === 0) {
    return { student: null, reason: 'not_found' };
  }

  const candidateRaw = extractEmbeddedToken(rawTrimmed);
  const q = normalizeBengaliDigits(candidateRaw).toLowerCase().trim();
  const rawQ = normalizeBengaliDigits(rawTrimmed).toLowerCase().trim();
  const cleanDigitsQ = q.replace(/\D/g, '');

  // Pass 1: Exact unique identifier / QR code match
  for (const s of students) {
    const { primarySecQr, legacyQr, portalId } = getCanonicalStudentQrTokens(s);

    if (s.securityQrCode && s.securityQrCode.trim().toLowerCase() === q) {
      return { student: s, matchedBy: 'security_qr' };
    }
    if (primarySecQr.toLowerCase() === q) {
      return { student: s, matchedBy: 'default_sec_qr' };
    }
    if (legacyQr.toLowerCase() === q) {
      return { student: s, matchedBy: 'legacy_qr' };
    }
    if (portalId.toLowerCase() === q) {
      const portalHits = students.filter(
        (cand) => getCanonicalStudentQrTokens(cand).portalId.toLowerCase() === q
      );
      if (portalHits.length === 1) {
        return { student: portalHits[0], matchedBy: 'portal_id' };
      }
      if (portalHits.length > 1) {
        return {
          student: null,
          reason: 'ambiguous_roll',
          ambiguousMatches: portalHits,
          errorMessage: `⚠️ এই ইউনিক আইডি (${portalId}) একাধিক শিক্ষার্থীর রোলের সাথে মিলেছে (${portalHits.map((p) => p.nameBn).join(', ')})। কার্ডের QR কোড স্ক্যান করুন।`,
        };
      }
    }
    if (s.id.toLowerCase() === q) {
      return { student: s, matchedBy: 'student_id' };
    }
    const sBirthDigits = s.birthRegNo ? normalizeBengaliDigits(s.birthRegNo).replace(/\D/g, '') : '';
    if (sBirthDigits.length >= 8 && cleanDigitsQ.length >= 8 && sBirthDigits === cleanDigitsQ) {
      return { student: s, matchedBy: 'birth_reg' };
    }
  }

  // Pass 2: Structured DLIKON QR token parsing (e.g. if student's roll or class was updated after card print)
  const structuredDlikonMatch = q.match(/^dlikon-(?:sec-)?([a-z0-9_]+)-(\d+)-([a-z0-9]{4,})$/i);
  if (structuredDlikonMatch) {
    const [, tokenClass, tokenRoll, tokenSuffix] = structuredDlikonMatch;
    // Match by unique 4-char ID suffix confirmed by same class OR roll
    const suffixMatches = students.filter((s) => s.id.toLowerCase().endsWith(tokenSuffix));
    if (suffixMatches.length === 1) {
      const candidate = suffixMatches[0];
      const sameClass = (candidate.classId || '').toLowerCase() === tokenClass;
      const sameRoll = String(candidate.roll) === String(Number(tokenRoll));
      if (sameClass || sameRoll) {
        return { student: candidate, matchedBy: 'id_suffix_class_roll' };
      }
    }

    return {
      student: null,
      reason: 'invalid_structured_token',
      errorMessage: `❌ স্ক্যানকৃত QR টোকেন (${rawTrimmed}) কোনো সক্রিয় শিক্ষার্থীর সাথে মেলেনি। অনুগ্রহ করে শিক্ষার্থীর বর্তমান আইডি কার্ড যাচাই করুন।`,
    };
  }

  // If input looks like any structured token (DLIKON-*, std_*, DL-*), NEVER guess blindly by roll
  const isStructuredToken =
    q.startsWith('dlikon-') || q.startsWith('std_') || /^dl-[a-z0-9]+-\d+$/i.test(q);
  if (isStructuredToken) {
    // Allow exact class+roll match ONLY for DL-{CODE}-{ROLL} even if zero-padding differed (when unambiguous)
    const portalMatch = q.match(/^dl-([a-z0-9]+)-(\d+)$/i);
    if (portalMatch) {
      const targetPortal = `DL-${portalMatch[1].toUpperCase()}-${String(Number(portalMatch[2])).padStart(2, '0')}`;
      const hits = students.filter((s) => getStudentPortalId(s).toUpperCase() === targetPortal);
      if (hits.length === 1) {
        return { student: hits[0], matchedBy: 'portal_id' };
      }
    }

    return {
      student: null,
      reason: 'invalid_structured_token',
      errorMessage: `❌ স্ক্যানকৃত QR / ইউনিক আইডি "${rawTrimmed}" ডাটাবেজে পাওয়া যায়নি।`,
    };
  }

  // Pass 3: Manual search by exact 4+ char ID suffix (only if unique)
  if (q.length >= 4 && /^[a-z0-9_]+$/i.test(q) && !/^\d+$/.test(q)) {
    const suffixHits = students.filter((s) => s.id.toLowerCase().endsWith(q));
    if (suffixHits.length === 1) {
      return { student: suffixHits[0], matchedBy: 'student_id' };
    }
  }

  // Pass 4: Manual search by Guardian / Father / Mother phone (>= 8 digits)
  if (cleanDigitsQ.length >= 8) {
    const phoneSuffix = cleanDigitsQ.slice(-8);
    const phoneHits = students.filter((s) => {
      const phones = [s.guardianPhone, s.fatherPhone, s.motherPhone, s.emergencyPhone];
      return phones.some((p) => {
        if (!p) return false;
        const d = normalizeBengaliDigits(p).replace(/\D/g, '');
        return d.length >= 8 && d.endsWith(phoneSuffix);
      });
    });
    if (phoneHits.length === 1) {
      return { student: phoneHits[0], matchedBy: 'phone' };
    }
  }

  // Pass 5: Manual search by bare roll number — ONLY auto-verify if unambiguous (1 match total)
  if (/^\d{1,3}$/.test(q)) {
    const rollNum = Number(q);
    const rollMatches = students.filter((s) => Number(s.roll) === rollNum);
    if (rollMatches.length === 1) {
      return { student: rollMatches[0], matchedBy: 'unique_roll' };
    }
    if (rollMatches.length > 1) {
      const classHints = rollMatches
        .slice(0, 4)
        .map((s) => {
          const cls = classes.find((c) => c.id === s.classId)?.nameBn || s.classId;
          return `${s.nameBn} (${cls} - ${getStudentPortalId(s)})`;
        })
        .join(', ');
      return {
        student: null,
        reason: 'ambiguous_roll',
        ambiguousMatches: rollMatches,
        errorMessage: `⚠️ রোল নম্বর ${toBengaliRoll(rollNum)} মোট ${rollMatches.length}টি শ্রেণিতে রয়েছে (${classHints}...)। সঠিক শিক্ষার্থী নির্ণয়ে কার্ডের QR কোড স্ক্যান করুন অথবা ইউনিক আইডি (যেমন: DL-C1-01) লিখুন।`,
      };
    }
  }

  // Pass 6: Manual search by student name (>= 2 chars)
  if (rawQ.length >= 2) {
    const nameMatches = students.filter(
      (s) =>
        s.nameBn.toLowerCase().includes(rawQ) ||
        Boolean(s.nameEn && s.nameEn.toLowerCase().includes(rawQ))
    );
    if (nameMatches.length === 1) {
      return { student: nameMatches[0], matchedBy: 'name' };
    }
    if (nameMatches.length > 1) {
      // Exact full name match if any
      const exactName = nameMatches.find((s) => s.nameBn.trim().toLowerCase() === rawQ);
      if (exactName) {
        return { student: exactName, matchedBy: 'name' };
      }
      return {
        student: nameMatches[0],
        matchedBy: 'name',
      };
    }
  }

  return {
    student: null,
    reason: 'not_found',
    errorMessage: `❌ "${rawTrimmed}" কিউআর কোড বা নম্বরে কোনো শিক্ষার্থীর তথ্য পাওয়া যায়নি।`,
  };
}
