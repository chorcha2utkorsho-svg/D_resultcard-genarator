/**
 * Utilities for Bengali numeral conversion, GPA calculation, and formatting
 */

export const BENGALI_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toBengaliNumber(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === '') return '';
  const str = String(val);
  return str.replace(/[0-9]/g, (digit) => BENGALI_DIGITS[parseInt(digit, 10)] || digit);
}

export function toBengaliRoll(roll: number | string): string {
  const num = parseInt(String(roll), 10);
  if (isNaN(num)) return String(roll);
  const formatted = num < 10 ? `0${num}` : `${num}`;
  return toBengaliNumber(formatted);
}

export interface GradeResult {
  letterGrade: string;
  gradePoint: number;
}

/**
 * Calculates grade and point based on marks and full marks scale
 */
export function calculateGrade(marks: number | null | undefined, fullMarks = 100): GradeResult {
  if (marks === null || marks === undefined || isNaN(marks)) {
    return { letterGrade: '-', gradePoint: 0 };
  }

  // Normalize to 100-mark percentage scale
  const percentage = fullMarks > 0 ? (marks / fullMarks) * 100 : marks;

  if (percentage >= 80) return { letterGrade: 'A+', gradePoint: 5.0 };
  if (percentage >= 70) return { letterGrade: 'A', gradePoint: 4.0 };
  if (percentage >= 60) return { letterGrade: 'A-', gradePoint: 3.5 };
  if (percentage >= 50) return { letterGrade: 'B', gradePoint: 3.0 };
  if (percentage >= 40) return { letterGrade: 'C', gradePoint: 2.0 };
  if (percentage >= 33) return { letterGrade: 'D', gradePoint: 1.0 };
  return { letterGrade: 'F', gradePoint: 0.0 };
}

export function getOverallGradeFromGpa(gpa: number): string {
  if (gpa >= 5.0) return 'A+';
  if (gpa >= 4.0) return 'A';
  if (gpa >= 3.5) return 'A-';
  if (gpa >= 3.0) return 'B';
  if (gpa >= 2.0) return 'C';
  if (gpa >= 1.0) return 'D';
  return 'F';
}

export function formatGpa(gpa: number): string {
  if (isNaN(gpa) || gpa === 0) return '0.00';
  return gpa.toFixed(2);
}

export function toBengaliOrdinal(num: number): string {
  const ordinals: Record<number, string> = {
    1: '১ম',
    2: '২য়',
    3: '৩য়',
    4: '৪র্থ',
    5: '৫ম',
    6: '৬ষ্ঠ',
    7: '৭ম',
    8: '৮ম',
    9: '৯ম',
    10: '১০ম',
    11: '১১তম',
    12: '১২তম',
    13: '১৩তম',
    14: '১৪তম',
    15: '১৫তম',
  };
  return ordinals[num] || `${toBengaliNumber(num)}তম`;
}

export function parseBengaliNumber(val: string | number | null | undefined): number {
  if (val === null || val === undefined) return NaN;
  const str = String(val).trim();
  const bengaliMap: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
  };
  const converted = str.replace(/[০-৯]/g, (ch) => bengaliMap[ch] || ch);
  return parseInt(converted, 10);
}

export function normalizeBengaliDigits(val: string | null | undefined): string {
  if (!val) return '';
  const bengaliMap: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
  };
  return String(val).replace(/[০-৯]/g, (ch) => bengaliMap[ch] || ch);
}

export const BENGALI_MONTHS = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
];

export const BENGALI_DAYS = [
  'রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'
];

export function formatBengaliDate(isoDateString: string | null | undefined): string {
  if (!isoDateString) return '';
  try {
    const parts = isoDateString.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      const dayName = BENGALI_DAYS[d.getDay()] || '';
      const monthName = BENGALI_MONTHS[month] || '';
      return `${toBengaliNumber(day)} ${monthName}, ${toBengaliNumber(year)} (${dayName})`;
    }
  } catch {
    // fallback
  }
  return toBengaliNumber(isoDateString);
}

