import { SchoolClass, Student } from '../types';
import { getStudentPortalId, normalizeBengaliDigits, toBengaliRoll } from './bengali';

export interface GatepassMatchResult {
  student: Student | null;
  extractedToken?: string;
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
  reason?:
    | 'ambiguous_roll'
    | 'ambiguous_name'
    | 'ambiguous_phone'
    | 'ambiguous_id'
    | 'invalid_structured_token'
    | 'not_found';
  ambiguousMatches?: Student[];
  errorMessage?: string;
}

export function describeMatchRuleBn(ruleOrReason?: string): string {
  switch (ruleOrReason) {
    case 'security_qr':
      return 'সিকিউরিটি QR কোড (সরাসরি ইউনিক মিল)';
    case 'default_sec_qr':
      return 'ক্যানোনিক্যাল SEC QR টোকেন মিল';
    case 'legacy_qr':
      return 'লিগ্যাসি DLIKON QR টোকেন মিল';
    case 'portal_id':
      return 'ইউনিক পোর্টাল আইডি (DL-*) মিল';
    case 'student_id':
      return 'ডাটাবেজ শিক্ষার্থী আইডি (std_*) মিল';
    case 'birth_reg':
      return '১৭ ডিজিট জন্ম নিবন্ধন নম্বর মিল';
    case 'id_suffix_class_roll':
      return 'QR আইডি সাফিক্স ও শ্রেণি যাচাইকৃত মিল';
    case 'phone':
      return 'অভিভাবক মোবাইল নম্বর (একক মিল)';
    case 'unique_roll':
      return 'একক রোল নম্বর (সম্পূর্ণ বিদ্যালয়ে ১ জন)';
    case 'name':
      return 'শিক্ষার্থীর নাম (একক মিল)';
    case 'manual_candidate_selected':
      return 'একাধিক মিল থাকায় অপারেটর তালিকা থেকে নির্বাচিত';
    case 'quick_simulation':
      return 'দ্রুত স্ক্যান সিমুলেশন বাটন থেকে যাচাইকৃত';
    case 'ambiguous_roll':
      return 'একাধিক শিক্ষার্থীর রোল/পোর্টাল আইডি মিলে যাওয়ায় অটো-লোড আটকানো হয়েছে';
    case 'ambiguous_name':
      return 'একই নামে একাধিক শিক্ষার্থী থাকায় অটো-লোড আটকানো হয়েছে';
    case 'ambiguous_phone':
      return 'একই মোবাইল নম্বরে একাধিক শিক্ষার্থী থাকায় তালিকা চাওয়া হয়েছে';
    case 'ambiguous_id':
      return 'ডাটাবেজে একই আইডি/টোকেন একাধিক প্রোফাইলে পাওয়ায় কনফ্লিক্ট সতর্কতা';
    case 'invalid_structured_token':
      return 'অকার্যকর বা অচেনা স্ট্রাকচার্ড QR টোকেন (রোল ফলোব্যাক নিষিদ্ধ)';
    case 'not_found':
      return 'স্ক্যানকৃত ইনপুটের সাথে কোনো সক্রিয় শিক্ষার্থী মেলেনি';
    default:
      return ruleOrReason || 'অজানা';
  }
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

function cleanZeroWidthAndTrim(val: string): string {
  return (val || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
}

function extractEmbeddedToken(rawTrimmed: string): string {
  // Handle full URL QR payloads such as https://.../?guardian=std_...
  const guardianMatch = rawTrimmed.match(/[?&]guardian=([^&#\s]+)/i);
  if (guardianMatch && guardianMatch[1]) {
    try {
      return cleanZeroWidthAndTrim(decodeURIComponent(guardianMatch[1]));
    } catch {
      return cleanZeroWidthAndTrim(guardianMatch[1]);
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
  const portalMatch = rawTrimmed.match(/\b(DL-[A-Z0-9]+-\d{1,3})\b/i);
  if (portalMatch && portalMatch[1]) {
    return portalMatch[1].trim();
  }
  return rawTrimmed;
}

function formatAmbiguousList(matches: Student[], classes: SchoolClass[]): string {
  return matches
    .slice(0, 4)
    .map((s) => {
      const cls = classes.find((c) => c.id === s.classId)?.nameBn || s.classId;
      return `${s.nameBn} (${cls}, রোল ${toBengaliRoll(s.roll)} • ${getStudentPortalId(s)})`;
    })
    .join(', ');
}

/**
 * Matches a scanned QR payload or manual search query to an exact student.
 * Strict validation rules:
 *  1. Unique QR / Portal ID / Student ID / Birth Reg matches require uniqueness (hits.length === 1).
 *     If any identifier collides across two records, returns ambiguous error instead of loading a wrong profile.
 *  2. Structured QR tokens (DLIKON-*, std_*, DL-*) NEVER fall back to bare roll numbers or guesses.
 *  3. Bare roll numbers, phones, or names ONLY auto-load when exactly 1 student matches unambiguously;
 *     multiple matches ALWAYS return `ambiguousMatches` for explicit operator selection.
 */
export function matchStudentByQrOrQuery(
  inputQuery: string,
  students: Student[],
  classes: SchoolClass[] = []
): GatepassMatchResult {
  const rawTrimmed = cleanZeroWidthAndTrim(inputQuery);
  if (!rawTrimmed || students.length === 0) {
    return { student: null, extractedToken: rawTrimmed, reason: 'not_found' };
  }

  const candidateRaw = extractEmbeddedToken(rawTrimmed);
  const q = normalizeBengaliDigits(candidateRaw).toLowerCase().trim();
  const rawQ = normalizeBengaliDigits(rawTrimmed).toLowerCase().trim();
  const cleanDigitsQ = q.replace(/\D/g, '');
  const withToken = (res: GatepassMatchResult): GatepassMatchResult => ({
    ...res,
    extractedToken: candidateRaw,
  });

  // Pass 1: Strict uniqueness-checked exact identifiers (QR -> canonical QR -> ID -> portal ID -> birthReg)
  const securityQrHits = students.filter(
    (s) => s.securityQrCode && cleanZeroWidthAndTrim(s.securityQrCode).toLowerCase() === q
  );
  if (securityQrHits.length === 1) {
    return withToken({ student: securityQrHits[0], matchedBy: 'security_qr' });
  }
  if (securityQrHits.length > 1) {
    return withToken({
      student: null,
      reason: 'ambiguous_id',
      ambiguousMatches: securityQrHits,
      errorMessage: `⚠️ এই QR কোডটি একাধিক শিক্ষার্থীর প্রোফাইলে পাওয়া গেছে (${formatAmbiguousList(securityQrHits, classes)})।`,
    });
  }

  const primarySecQrHits = students.filter(
    (s) => getCanonicalStudentQrTokens(s).primarySecQr.toLowerCase() === q
  );
  if (primarySecQrHits.length === 1) {
    return withToken({ student: primarySecQrHits[0], matchedBy: 'default_sec_qr' });
  }
  if (primarySecQrHits.length > 1) {
    return withToken({
      student: null,
      reason: 'ambiguous_id',
      ambiguousMatches: primarySecQrHits,
      errorMessage: `⚠️ একাধিক শিক্ষার্থীর সাথে এই QR কোড মিলেছে: ${formatAmbiguousList(primarySecQrHits, classes)}।`,
    });
  }

  const legacyQrHits = students.filter(
    (s) => getCanonicalStudentQrTokens(s).legacyQr.toLowerCase() === q
  );
  if (legacyQrHits.length === 1) {
    return withToken({ student: legacyQrHits[0], matchedBy: 'legacy_qr' });
  }
  if (legacyQrHits.length > 1) {
    return withToken({
      student: null,
      reason: 'ambiguous_id',
      ambiguousMatches: legacyQrHits,
      errorMessage: `⚠️ একাধিক শিক্ষার্থীর সাথে এই QR কোড মিলেছে: ${formatAmbiguousList(legacyQrHits, classes)}।`,
    });
  }

  const studentIdHits = students.filter((s) => s.id.toLowerCase() === q);
  if (studentIdHits.length === 1) {
    return withToken({ student: studentIdHits[0], matchedBy: 'student_id' });
  }
  if (studentIdHits.length > 1) {
    return withToken({
      student: null,
      reason: 'ambiguous_id',
      ambiguousMatches: studentIdHits,
      errorMessage: `⚠️ একই শিক্ষার্থী আইডি একাধিক প্রোফাইলে রয়েছে: ${formatAmbiguousList(studentIdHits, classes)}।`,
    });
  }

  const portalIdHits = students.filter(
    (s) => getCanonicalStudentQrTokens(s).portalId.toLowerCase() === q
  );
  if (portalIdHits.length === 1) {
    return withToken({ student: portalIdHits[0], matchedBy: 'portal_id' });
  }
  if (portalIdHits.length > 1) {
    return withToken({
      student: null,
      reason: 'ambiguous_roll',
      ambiguousMatches: portalIdHits,
      errorMessage: `⚠️ ইউনিক আইডি (${q.toUpperCase()}) একাধিক শিক্ষার্থীর রোলের সাথে মিলেছে: ${formatAmbiguousList(portalIdHits, classes)}। নিচের তালিকা থেকে সঠিক শিক্ষার্থী নির্বাচন করুন বা কার্ডের QR কোড স্ক্যান করুন।`,
    });
  }

  if (cleanDigitsQ.length >= 8 && /^[\d+\-\s]+$/.test(q)) {
    const birthHits = students.filter((s) => {
      const sBirthDigits = s.birthRegNo ? normalizeBengaliDigits(s.birthRegNo).replace(/\D/g, '') : '';
      return sBirthDigits.length >= 8 && sBirthDigits === cleanDigitsQ;
    });
    if (birthHits.length === 1) {
      return withToken({ student: birthHits[0], matchedBy: 'birth_reg' });
    }
    if (birthHits.length > 1) {
      return withToken({
        student: null,
        reason: 'ambiguous_id',
        ambiguousMatches: birthHits,
        errorMessage: `⚠️ এই জন্ম নিবন্ধন নম্বর একাধিক শিক্ষার্থীর সাথে মিলেছে: ${formatAmbiguousList(birthHits, classes)}।`,
      });
    }
  }

  // Pass 2: Structured DLIKON QR token parsing (handles cards printed before a roll update in the same class)
  const structuredDlikonMatch = q.match(/^dlikon-(?:sec-)?([a-z0-9_]+)-(\d+)-([a-z0-9]{4,})$/i);
  if (structuredDlikonMatch) {
    const [, tokenClass, tokenRoll, tokenSuffix] = structuredDlikonMatch;
    const suffixMatches = students.filter((s) => {
      const idTail = (s.id.split('_').pop() || '').toLowerCase();
      const storedQrTail = s.securityQrCode ? (s.securityQrCode.split('-').pop() || '').toLowerCase() : '';
      return idTail === tokenSuffix || storedQrTail === tokenSuffix;
    });
    if (suffixMatches.length === 1) {
      const candidate = suffixMatches[0];
      const sameClass = (candidate.classId || '').toLowerCase() === tokenClass;
      const sameRoll = String(candidate.roll) === String(Number(tokenRoll));
      // Require sameClass (or exact both) so cross-class same roll never falsely triggers
      if (sameClass || (sameRoll && sameClass)) {
        return withToken({ student: candidate, matchedBy: 'id_suffix_class_roll' });
      }
    }

    return withToken({
      student: null,
      reason: 'invalid_structured_token',
      errorMessage: `❌ স্ক্যানকৃত QR টোকেন (${rawTrimmed}) কোনো সক্রিয় শিক্ষার্থীর সাথে মেলেনি। অনুগ্রহ করে শিক্ষার্থীর বর্তমান আইডি কার্ড যাচাই করুন।`,
    });
  }

  // Never allow structured tokens (DLIKON-*, std_*, DL-*) to fall back to bare rolls/names
  const isStructuredToken =
    q.startsWith('dlikon-') || q.startsWith('std_') || /^dl-[a-z0-9]+-\d+$/i.test(q);
  if (isStructuredToken) {
    const portalMatch = q.match(/^dl-([a-z0-9]+)-(\d+)$/i);
    if (portalMatch) {
      const targetPortal = `DL-${portalMatch[1].toUpperCase()}-${String(Number(portalMatch[2])).padStart(2, '0')}`;
      const hits = students.filter((s) => getStudentPortalId(s).toUpperCase() === targetPortal);
      if (hits.length === 1) {
        return withToken({ student: hits[0], matchedBy: 'portal_id' });
      }
      if (hits.length > 1) {
        return withToken({
          student: null,
          reason: 'ambiguous_roll',
          ambiguousMatches: hits,
          errorMessage: `⚠️ ইউনিক আইডি (${targetPortal}) একাধিক শিক্ষার্থীর সাথে মিলেছে: ${formatAmbiguousList(hits, classes)}। সঠিক শিক্ষার্থী নির্বাচন করুন।`,
        });
      }
    }

    return withToken({
      student: null,
      reason: 'invalid_structured_token',
      errorMessage: `❌ স্ক্যানকৃত QR / ইউনিক আইডি "${rawTrimmed}" ডাটাবেজে পাওয়া যায়নি।`,
    });
  }

  // Pass 3: Manual search by explicit student ID tail segment (must include '_' or digit so English names never collide)
  if (q.length >= 4 && /^[a-z0-9_]+$/i.test(q) && (q.includes('_') || /\d/.test(q)) && !/^\d+$/.test(q)) {
    const suffixHits = students.filter(
      (s) =>
        s.id.toLowerCase().endsWith(q) ||
        (s.id.split('_').pop() || '').toLowerCase() === q
    );
    if (suffixHits.length === 1) {
      return withToken({ student: suffixHits[0], matchedBy: 'student_id' });
    }
    if (suffixHits.length > 1) {
      return withToken({
        student: null,
        reason: 'ambiguous_id',
        ambiguousMatches: suffixHits,
        errorMessage: `⚠️ এই আইডি কোডে একাধিক শিক্ষার্থী পাওয়া গেছে: ${formatAmbiguousList(suffixHits, classes)}।`,
      });
    }
  }

  // Pass 4: Manual search by Guardian / Father / Mother phone (>= 8 digits, numeric phone format)
  if (cleanDigitsQ.length >= 8 && /^[\d+\-\s()]+$/.test(q)) {
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
      return withToken({ student: phoneHits[0], matchedBy: 'phone' });
    }
    if (phoneHits.length > 1) {
      return withToken({
        student: null,
        reason: 'ambiguous_phone',
        ambiguousMatches: phoneHits,
        errorMessage: `⚠️ এই মোবাইল নম্বরে একাধিক শিক্ষার্থী নিবন্ধিত রয়েছে (${formatAmbiguousList(phoneHits, classes)})। সঠিক শিক্ষার্থী নির্বাচন করুন।`,
      });
    }
  }

  // Pass 5: Manual search by bare roll number — ONLY auto-verify if unambiguous (1 match total)
  if (/^\d{1,3}$/.test(q)) {
    const rollNum = Number(q);
    const rollMatches = students.filter((s) => Number(s.roll) === rollNum);
    if (rollMatches.length === 1) {
      return withToken({ student: rollMatches[0], matchedBy: 'unique_roll' });
    }
    if (rollMatches.length > 1) {
      return withToken({
        student: null,
        reason: 'ambiguous_roll',
        ambiguousMatches: rollMatches,
        errorMessage: `⚠️ রোল নম্বর ${toBengaliRoll(rollNum)} মোট ${rollMatches.length}টি শ্রেণিতে রয়েছে (${formatAmbiguousList(rollMatches, classes)}...)। সঠিক শিক্ষার্থী নির্বাচন করুন অথবা কার্ডের QR কোড স্ক্যান করুন।`,
      });
    }
  }

  // Pass 6: Manual search by student name (>= 2 chars) — NEVER auto-select first match if ambiguous
  if (rawQ.length >= 2) {
    const exactMatches = students.filter(
      (s) =>
        cleanZeroWidthAndTrim(s.nameBn).toLowerCase() === rawQ ||
        Boolean(s.nameEn && cleanZeroWidthAndTrim(s.nameEn).toLowerCase() === rawQ)
    );
    if (exactMatches.length === 1) {
      return withToken({ student: exactMatches[0], matchedBy: 'name' });
    }
    if (exactMatches.length > 1) {
      return withToken({
        student: null,
        reason: 'ambiguous_name',
        ambiguousMatches: exactMatches,
        errorMessage: `⚠️ "${rawTrimmed}" নামে ${exactMatches.length} জন শিক্ষার্থী রয়েছে (${formatAmbiguousList(exactMatches, classes)})। সঠিক শ্রেণি/রোল নিশ্চিত হয়ে তালিকা থেকে নির্বাচন করুন।`,
      });
    }

    const nameMatches = students.filter(
      (s) =>
        s.nameBn.toLowerCase().includes(rawQ) ||
        Boolean(s.nameEn && s.nameEn.toLowerCase().includes(rawQ))
    );
    if (nameMatches.length === 1) {
      return withToken({ student: nameMatches[0], matchedBy: 'name' });
    }
    if (nameMatches.length > 1) {
      return withToken({
        student: null,
        reason: 'ambiguous_name',
        ambiguousMatches: nameMatches,
        errorMessage: `⚠️ "${rawTrimmed}" নামের সাথে ${nameMatches.length} জন শিক্ষার্থী মিলেছে (${formatAmbiguousList(nameMatches, classes)}...)। তালিকা থেকে নির্দিষ্ট শিক্ষার্থী নির্বাচন করুন।`,
      });
    }
  }

  return withToken({
    student: null,
    reason: 'not_found',
    errorMessage: `❌ "${rawTrimmed}" কিউআর কোড বা নম্বরে কোনো শিক্ষার্থীর তথ্য পাওয়া যায়নি।`,
  });
}
