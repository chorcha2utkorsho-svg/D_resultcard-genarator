/**
 * SMS utility functions for D-Likon Model Academy
 * Includes character/part counting (Bangla Unicode & GSM-7),
 * Phone number validation, and SMS generators for results and notices.
 */

import { CalculatedStudentResult, SchoolInfo, SMSNoticeTemplate } from '../types';
import { toBengaliNumber, toBengaliOrdinal, toBengaliRoll } from './bengali';

/**
 * Standardize Bangladeshi mobile numbers
 * E.g., "+8801712-345678" or "8801712345678" or "01712345678" -> "01712345678"
 */
export function formatPhoneNumber(phone?: string): string {
  if (!phone) return '';
  // Remove spaces, hyphens, plus signs
  let cleaned = phone.replace(/[\s\-\+\(\)]/g, '');
  // If starts with 880, strip 88
  if (cleaned.startsWith('880')) {
    cleaned = cleaned.substring(2);
  }
  return cleaned;
}

/**
 * Validates whether string is a valid 11-digit Bangladeshi mobile number
 * (013, 014, 015, 016, 017, 018, 019)
 */
export function isValidBDMobile(phone?: string): boolean {
  if (!phone) return false;
  const formatted = formatPhoneNumber(phone);
  return /^01[3-9]\d{8}$/.test(formatted);
}

/**
 * Check if text contains non-GSM characters (such as Bengali or Unicode)
 */
export function isUnicodeText(text: string): boolean {
  // Checks if any character code is greater than 127 or not in GSM 7-bit standard
  return /[^\u0000-\u007F]/.test(text);
}

export interface SMSLengthInfo {
  charCount: number;
  isUnicode: boolean;
  smsParts: number;
  remainingInPart: number;
  maxInCurrentPart: number;
}

/**
 * Calculates SMS character length and number of billable SMS parts
 * Unicode (Bangla):
 *  - 1 part: up to 70 chars
 *  - Multi-part: 67 chars per part
 * GSM-7 (English):
 *  - 1 part: up to 160 chars
 *  - Multi-part: 153 chars per part
 */
export function calculateSMSLength(text: string): SMSLengthInfo {
  const charCount = text.length;
  const isUnicode = isUnicodeText(text);

  if (charCount === 0) {
    return {
      charCount: 0,
      isUnicode,
      smsParts: 0,
      remainingInPart: isUnicode ? 70 : 160,
      maxInCurrentPart: isUnicode ? 70 : 160,
    };
  }

  if (isUnicode) {
    if (charCount <= 70) {
      return {
        charCount,
        isUnicode: true,
        smsParts: 1,
        remainingInPart: 70 - charCount,
        maxInCurrentPart: 70,
      };
    }
    const smsParts = Math.ceil(charCount / 67);
    const remainingInPart = smsParts * 67 - charCount;
    return {
      charCount,
      isUnicode: true,
      smsParts,
      remainingInPart,
      maxInCurrentPart: 67,
    };
  } else {
    if (charCount <= 160) {
      return {
        charCount,
        isUnicode: false,
        smsParts: 1,
        remainingInPart: 160 - charCount,
        maxInCurrentPart: 160,
      };
    }
    const smsParts = Math.ceil(charCount / 153);
    const remainingInPart = smsParts * 153 - charCount;
    return {
      charCount,
      isUnicode: false,
      smsParts,
      remainingInPart,
      maxInCurrentPart: 153,
    };
  }
}

/**
 * Generate automated Bengali result summary SMS for a student
 */
export function generateResultSMS(
  result: CalculatedStudentResult,
  schoolInfo: SchoolInfo,
  classNameBn: string,
  examTitleBn: string
): string {
  const schoolName = schoolInfo.name || 'ডি-লিকন মডেল একাডেমী';
  const studentName = result.student.nameBn || result.student.nameEn || 'শিক্ষার্থী';
  const roll = toBengaliRoll(result.student.roll);
  const totalMarks = toBengaliNumber(result.grandTotalObtained);
  const totalFullMarks = toBengaliNumber(result.totalFullMarks);
  const gpa = toBengaliNumber(result.gpa.toFixed(2));
  const grade = result.overallGrade;
  const merit = result.meritPositionBn || toBengaliOrdinal(result.meritPosition);
  const passStatus = result.isPassed ? 'উত্তীর্ণ' : 'অনুত্তীর্ণ';

  return `${schoolName}: প্রিয় অভিভাবক, আপনার সন্তান ${studentName} (রোল: ${roll}, ${classNameBn}), ${examTitleBn}-এ মোট নম্বর: ${totalMarks}/${totalFullMarks}, GPA: ${gpa} (গ্রেড: ${grade}), মেধাক্রম: ${merit} (${passStatus})। বিস্তারিত প্রোগ্রেস কার্ড স্কুলে সংরক্ষিত। - প্রধান শিক্ষক।`;
}

/**
 * Generate click-to-SMS URI that opens the phone's native messaging app
 * Handles iOS and Android URL schema differences
 */
export function createDeviceSmsUrl(phone: string, body: string): string {
  const cleanPhone = formatPhoneNumber(phone);
  const encodedBody = encodeURIComponent(body);

  // Check if iOS/MacOS userAgent
  const isIOS =
    typeof navigator !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent);

  if (isIOS) {
    return `sms:${cleanPhone}&body=${encodedBody}`;
  }
  // Android and universal standard
  return `sms:${cleanPhone}?body=${encodedBody}`;
}

/**
 * Generate WhatsApp direct chat URL
 */
export function createWhatsAppUrl(phone: string, body: string): string {
  let cleanPhone = formatPhoneNumber(phone);
  if (cleanPhone.startsWith('0')) {
    cleanPhone = '88' + cleanPhone;
  }
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(body)}`;
}

/**
 * Pre-defined SMS templates for Bangladeshi schools
 */
export const DEFAULT_SMS_TEMPLATES: SMSNoticeTemplate[] = [
  {
    id: 'tpl_result_published',
    title: 'ফলাফল প্রকাশ সংক্রান্ত নোটিশ',
    category: 'result',
    body: 'ডি-লিকন মডেল একাডেমী: সম্মানিত অভিভাবক, অত্র বিদ্যালয়ের {EXAM_NAME} পরীক্ষার ফলাফল প্রকাশিত হয়েছে। আগামী {DATE} তারিখের মধ্যে অফিস কক্ষ থেকে মূল প্রোগ্রেস কার্ড সংগ্রহের জন্য অনুরোধ করা হচ্ছে। প্রধান শিক্ষক।',
  },
  {
    id: 'tpl_parents_meeting',
    title: 'অভিভাবক সমাবেশ (PTA Meeting)',
    category: 'meeting',
    body: 'ডি-লিকন মডেল একাডেমী: সম্মানিত অভিভাবক, আগামী {DATE}, রোজ {DAY} সকাল ১০:০০ ঘটিকায় শিক্ষার্থীদের সার্বিক পড়াশোনা বিষয়ে অভিভাবক সমাবেশ অনুষ্ঠিত হবে। আপনার উপস্থিতি একান্ত কাম্য। প্রধান শিক্ষক।',
  },
  {
    id: 'tpl_fees_reminder',
    title: 'মাসিক বেতন ও বকেয়া পরিশোধ তাগাদা',
    category: 'fees',
    body: 'ডি-লিকন মডেল একাডেমী: প্রিয় অভিভাবক, আপনার সন্তান {STUDENT_NAME}-এর চলতি মাসের স্কুল বেতন ও পরীক্ষার ফি আগামী {DATE} তারিখের মধ্যে পরিশোধ করার জন্য বিনীত অনুরোধ করা হচ্ছে। প্রধান শিক্ষক।',
  },
  {
    id: 'tpl_holiday_notice',
    title: 'ছুটি ও স্কুল বন্ধের নোটিশ',
    category: 'holiday',
    body: 'ডি-লিকন মডেল একাডেমী: সম্মানিত অভিভাবক, {OCCASION} উপলক্ষে আগামী {START_DATE} হতে {END_DATE} পর্যন্ত বিদ্যালয়ের সকল ক্লাস বন্ধ থাকবে। {REOPEN_DATE} হতে যথারীতি ক্লাস চলবে। প্রধান শিক্ষক।',
  },
  {
    id: 'tpl_exam_routine',
    title: 'পরীক্ষার সময়সূচি ও প্রবেশপত্র',
    category: 'exam',
    body: 'ডি-লিকন মডেল একাডেমী: সম্মানিত অভিভাবক, আগামী {START_DATE} তারিখ থেকে {EXAM_NAME} পরীক্ষা শুরু হবে। পরীক্ষা শুরুর পূর্বেই শিক্ষার্থীদের সকল বকেয়া পরিশোধ করে প্রবেশপত্র সংগ্রহ করতে বলা হচ্ছে। প্রধান শিক্ষক।',
  },
  {
    id: 'tpl_general_notice',
    title: 'সাধারণ জরুরি বিজ্ঞপ্তি',
    category: 'general',
    body: 'ডি-লিকন মডেল একাডেমী: সম্মানিত অভিভাবক, বিশেষ প্রয়োজনেই এই বিজ্ঞপ্তি। বিস্তারিত জানতে বিদ্যালয়ের নোটিশ বোর্ড অথবা অফিসে যোগাযোগ করুন। ধন্যবাদ। প্রধান শিক্ষক।',
  },
];

export function generateAbsenceSMS(
  studentName: string,
  roll: number,
  className: string,
  date: string,
  schoolName: string = 'ডি-লিকন মডেল একাডেমী'
): string {
  return `${schoolName}: প্রিয় অভিভাবক, আপনার সন্তান ${studentName} (রোল: ${toBengaliRoll(roll)}, শ্রেণি: ${className}), অদ্য ${date} তারিখে বিদ্যালয়ে অনুপস্থিত। নিয়মিত উপস্থিতি নিশ্চিত করার জন্য অনুরোধ করা হলো। - প্রধান শিক্ষক।`;
}
