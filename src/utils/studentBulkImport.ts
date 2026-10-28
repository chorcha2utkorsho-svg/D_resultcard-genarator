import * as XLSX from 'xlsx';
import { SchoolClass, Student } from '../types';
import { parseBengaliNumber, normalizeBengaliDigits } from './bengali';

export interface ParsedStudentRow {
  index: number;
  roll: number;
  nameBn: string;
  nameEn: string;
  classId: string;
  classNameDisplay: string;
  section: string;
  gender: 'ছাত্র' | 'ছাত্রী';
  guardianPhone: string;
  fatherName: string;
  motherName: string;
  bloodGroup: string;
  academicYear: string;
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export const SAMPLE_STUDENTS_DATA = [
  {
    roll: 1,
    nameBn: 'আফরিন জাহান নুহা',
    nameEn: 'Afrin Jahan Nuha',
    section: 'ক',
    gender: 'ছাত্রী' as const,
    guardianPhone: '01712345678',
    fatherName: 'মোঃ আবুল কাশেম',
    motherName: 'নাসরিন জাহান',
    bloodGroup: 'A+',
    academicYear: '২০২৬',
  },
  {
    roll: 2,
    nameBn: 'তানভীর আহমেদ মাহিন',
    nameEn: 'Tanvir Ahmed Mahin',
    section: 'ক',
    gender: 'ছাত্র' as const,
    guardianPhone: '01812345679',
    fatherName: 'আনিসুর রহমান',
    motherName: 'শাহানাজ পারভীন',
    bloodGroup: 'B+',
    academicYear: '২০২৬',
  },
  {
    roll: 3,
    nameBn: 'সুমাইয়া আক্তার ইতি',
    nameEn: 'Sumaiya Akter Iti',
    section: 'ক',
    gender: 'ছাত্রী' as const,
    guardianPhone: '01912345680',
    fatherName: 'মোঃ মোজাম্মেল হক',
    motherName: 'রাবেয়া খাতুন',
    bloodGroup: 'O+',
    academicYear: '২০২৬',
  },
  {
    roll: 4,
    nameBn: 'রাকিব হাসান শামীম',
    nameEn: 'Rakib Hasan Shamim',
    section: 'ক',
    gender: 'ছাত্র' as const,
    guardianPhone: '01734567890',
    fatherName: 'মোঃ সেলিম হোসেন',
    motherName: 'শিরিনা আক্তার',
    bloodGroup: 'AB+',
    academicYear: '২০২৬',
  },
  {
    roll: 5,
    nameBn: 'ফারজানা আক্তার মীম',
    nameEn: 'Farzana Akter Mim',
    section: 'ক',
    gender: 'ছাত্রী' as const,
    guardianPhone: '01623456781',
    fatherName: 'নুরুল ইসলাম',
    motherName: 'জাহানারা বেগম',
    bloodGroup: 'O+',
    academicYear: '২০২৬',
  },
  {
    roll: 6,
    nameBn: 'সাকিব আল হাসান',
    nameEn: 'Sakib Al Hasan',
    section: 'ক',
    gender: 'ছাত্র' as const,
    guardianPhone: '01512345682',
    fatherName: 'মোঃ আব্দুল বাতেন',
    motherName: 'খালেদা আক্তার',
    bloodGroup: 'B+',
    academicYear: '২০২৬',
  },
];

/**
 * Builds CSV string formatted with UTF-8 BOM
 */
export function buildStudentCSVTemplate(
  includeSample: boolean,
  className = 'চতুর্থ শ্রেণি',
  sectionName = 'ক',
  year = '২০২৬'
): string {
  const headers = [
    'রোল (Roll)',
    'শিক্ষার্থীর নাম (বাংলা)',
    'ইংরেজি নাম (Name in English)',
    'শ্রেণি (Class)',
    'শাখা (Section)',
    'লিঙ্গ (ছাত্র/ছাত্রী)',
    'অভিভাবক মোবাইল নম্বর',
    'পিতার নাম',
    'মাতার নাম',
    'রক্তের গ্রুপ',
    'শিক্ষাবর্ষ',
  ];

  let csvRows = [headers.join(',')];

  if (includeSample) {
    SAMPLE_STUDENTS_DATA.forEach((s) => {
      const row = [
        s.roll,
        `"${s.nameBn}"`,
        `"${s.nameEn}"`,
        `"${className}"`,
        `"${s.section || sectionName}"`,
        `"${s.gender}"`,
        `"${s.guardianPhone}"`,
        `"${s.fatherName}"`,
        `"${s.motherName}"`,
        `"${s.bloodGroup}"`,
        `"${s.academicYear || year}"`,
      ];
      csvRows.push(row.join(','));
    });
  } else {
    // Blank template with one example comment row
    csvRows.push(
      `১,"শিক্ষার্থীর নাম বাংলায়","English Name","${className}","${sectionName}","ছাত্র","017xxxxxxxx","পিতার নাম","মাতার নাম","A+","${year}"`
    );
  }

  // Prepend UTF-8 BOM so Excel opens Bangla cleanly
  return '\uFEFF' + csvRows.join('\r\n');
}

/**
 * Downloads the student CSV template
 */
export function downloadStudentCSVTemplate(
  includeSample: boolean,
  className = 'চতুর্থ শ্রেণি',
  sectionName = 'ক',
  year = '২০২৬'
) {
  const csvContent = buildStudentCSVTemplate(includeSample, className, sectionName, year);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const fileName = includeSample
    ? `শিক্ষার্থী_নিবন্ধন_নমুনা_টেমপ্লেট_${className.replace(/\s+/g, '_')}_${year}.csv`
    : `শিক্ষার্থী_নিবন্ধন_খালি_টেমপ্লেট_${className.replace(/\s+/g, '_')}_${year}.csv`;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Generates and downloads an Excel (.xlsx) registration template
 */
export function downloadStudentExcelTemplate(
  includeSample: boolean,
  className = 'চতুর্থ শ্রেণি',
  sectionName = 'ক',
  year = '২০২৬'
) {
  const wb = XLSX.utils.book_new();

  const dataRows: (string | number)[][] = [
    [
      'রোল',
      'শিক্ষার্থীর নাম (বাংলা) *',
      'ইংরেজি নাম',
      'শ্রেণি',
      'শাখা',
      'লিঙ্গ (ছাত্র/ছাত্রী)',
      'অভিভাবক মোবাইল',
      'পিতার নাম',
      'মাতার নাম',
      'রক্তের গ্রুপ',
      'শিক্ষাবর্ষ',
    ],
  ];

  if (includeSample) {
    SAMPLE_STUDENTS_DATA.forEach((s) => {
      dataRows.push([
        s.roll,
        s.nameBn,
        s.nameEn,
        className,
        s.section || sectionName,
        s.gender,
        s.guardianPhone,
        s.fatherName,
        s.motherName,
        s.bloodGroup,
        s.academicYear || year,
      ]);
    });
  } else {
    dataRows.push([
      1,
      'উদাহরণ: রাকিবুল ইসলাম',
      'Rakibul Islam',
      className,
      sectionName,
      'ছাত্র',
      '01712345678',
      'মোঃ রফিকুল ইসলাম',
      'মোসাঃ রহিমা বেগম',
      'A+',
      year,
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(dataRows);

  // Column width hints
  ws['!cols'] = [
    { wch: 8 },  // রোল
    { wch: 26 }, // নাম বাংলা
    { wch: 22 }, // নাম ইংরেজি
    { wch: 14 }, // শ্রেণি
    { wch: 8 },  // শাখা
    { wch: 12 }, // লিঙ্গ
    { wch: 18 }, // ফোন
    { wch: 22 }, // পিতা
    { wch: 22 }, // মাতা
    { wch: 12 }, // ব্লাড
    { wch: 10 }, // সাল
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'শিক্ষার্থী_নিবন্ধন');

  // Instructions Sheet
  const instructions = [
    ['ডি-লিকন মডেল একাডেমী - শিক্ষার্থী বাল্ক আপলোড নির্দেশিকা'],
    [''],
    ['১. "শিক্ষার্থীর নাম (বাংলা)" কলামটি পূরণ করা বাধ্যতামূলক।'],
    ['২. রোল নম্বরে বাংলা (১, ২, ৩) অথবা ইংরেজি (1, 2, 3) উভয় ডিজিট গ্রহণযোগ্য।'],
    ['৩. অভিভাবক মোবাইল নম্বরে ১১ ডিজিটের বাংলাদেশি নম্বর (যেমন: 01712345678) লিখুন।'],
    ['৪. শ্রেণি কলাম ফাঁকা থাকলে আপলোডের সময় নির্বাচিত শ্রেণি প্রযোজ্য হবে।'],
    ['৫. শাখা কলাম ফাঁকা থাকলে ডিফল্ট শাখা (ক) প্রযোজ্য হবে।'],
    ['৬. রক্তের গ্রুপ: A+, A-, B+, B-, O+, O-, AB+, AB- ব্যবহার করুন।'],
    ['৭. ফাইল সংরক্ষণ করে বাল্ক রেজিস্ট্রেশন মডিউলে আপলোড করুন।'],
  ];
  const wsGuide = XLSX.utils.aoa_to_sheet(instructions);
  XLSX.utils.book_append_sheet(wb, wsGuide, 'ব্যবহার_নির্দেশিকা');

  const fileName = includeSample
    ? `শিক্ষার্থী_বাল্ক_নিবন্ধন_টেমপ্লেট_নমুনাসহ_${className.replace(/\s+/g, '_')}_${year}.xlsx`
    : `শিক্ষার্থী_বাল্ক_নিবন্ধন_খালি_টেমপ্লেট_${className.replace(/\s+/g, '_')}_${year}.xlsx`;

  XLSX.writeFile(wb, fileName);
}

/**
 * Flexible text/CSV line splitter respecting quotes
 */
function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  const delimiter = line.includes('\t') ? '\t' : ',';

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result.map((col) => col.replace(/^["']|["']$/g, '').trim());
}

/**
 * Normalizes phone numbers
 */
function cleanPhoneNumber(phone: string): string {
  if (!phone) return '';
  const digitsOnly = normalizeBengaliDigits(phone).replace(/[^0-9]/g, '');
  if (digitsOnly.length === 11 && digitsOnly.startsWith('01')) {
    return digitsOnly;
  }
  return digitsOnly || phone;
}

/**
 * Intelligent class detection from filename
 */
export function detectClassFromFilename(
  filename: string,
  classes: SchoolClass[]
): { classId: string; className: string } | null {
  if (!filename) return null;
  const name = filename.toLowerCase();

  // Prioritize Play, Nursery, KG and double-digit classes first to avoid partial matches
  const classPatterns: { pattern: RegExp; idHint: string; banglaName: string }[] = [
    { pattern: /(play|প্লে)/i, idHint: 'class_play', banglaName: 'প্লে শ্রেণি' },
    { pattern: /(nursary|nursery|নার্সারি|নার্সারী)/i, idHint: 'class_nursery', banglaName: 'নার্সারি শ্রেণি' },
    { pattern: /(kg|k\.g|কেজি|কে\.জি)/i, idHint: 'class_kg', banglaName: 'কেজি শ্রেণি' },
    { pattern: /(class[-_\s]*10|১০ম|দশম)/i, idHint: 'class_10', banglaName: '১০ম শ্রেণি' },
    { pattern: /(class[-_\s]*9|৯ম|নবম)/i, idHint: 'class_9', banglaName: '৯ম শ্রেণি' },
    { pattern: /(class[-_\s]*8|৮ম|অষ্টম)/i, idHint: 'class_8', banglaName: '৮ম শ্রেণি' },
    { pattern: /(class[-_\s]*7|৭ম|সপ্তম)/i, idHint: 'class_7', banglaName: '৭ম শ্রেণি' },
    { pattern: /(class[-_\s]*6|৬ষ্ঠ|ষষ্ঠ)/i, idHint: 'class_6', banglaName: '৬ষ্ঠ শ্রেণি' },
    { pattern: /(class[-_\s]*5|৫ম|পঞ্চম)/i, idHint: 'class_5', banglaName: '৫ম শ্রেণি' },
    { pattern: /(class[-_\s]*4|৪র্থ|চতুর্থ)/i, idHint: 'class_4', banglaName: '৪র্থ শ্রেণি' },
    { pattern: /(class[-_\s]*3|৩য়|৩য়|তৃতীয়|তৃতীয়)/i, idHint: 'class_3', banglaName: '৩য় শ্রেণি' },
    { pattern: /(class[-_\s]*2|২য়|২য়|দ্বিতীয়|দ্বিতীয়)/i, idHint: 'class_2', banglaName: '২য় শ্রেণি' },
    { pattern: /(class[-_\s]*1(?![\d0-9])|১ম|প্রথম)/i, idHint: 'class_1', banglaName: '১ম শ্রেণি' },
  ];

  for (const { pattern, idHint, banglaName } of classPatterns) {
    if (pattern.test(name)) {
      const matched = classes.find(
        (c) =>
          c.id.toLowerCase() === idHint.toLowerCase() ||
          c.nameBn.includes(banglaName) ||
          c.id.includes(idHint.replace('class_', ''))
      );
      if (matched) {
        return { classId: matched.id, className: matched.nameBn };
      }
      return { classId: idHint, className: banglaName };
    }
  }

  return null;
}

/**
 * Intelligent class detection from sheet text or headers
 */
export function detectClassFromSheet(
  rows: (string | number)[][],
  sheetName = '',
  classes: SchoolClass[]
): { classId: string; className: string } | null {
  // Check sheetName first
  if (sheetName) {
    const fromName = detectClassFromFilename(sheetName, classes);
    if (fromName) return fromName;
  }

  // Scan top 10 rows for "শ্রেণি: ..." or "Class: ..."
  const scanRows = rows.slice(0, 10);
  for (const row of scanRows) {
    for (const cell of row) {
      const str = String(cell || '').trim();
      if (!str) continue;

      const fromCell = detectClassFromFilename(str, classes);
      if (fromCell && (str.includes('শ্রেণি') || str.includes('class') || str.includes('Class'))) {
        return fromCell;
      }
    }
  }

  return null;
}

/**
 * Parses raw text or sheet rows into validated student registration records
 */
export function parseStudentData(
  rawData: (string | number)[][] | string,
  defaultClassId: string,
  defaultSection: string,
  defaultYear: string,
  classes: SchoolClass[],
  options?: {
    fileName?: string;
    sheetName?: string;
  }
): ParsedStudentRow[] {
  let rows: string[][] = [];

  if (typeof rawData === 'string') {
    const lines = rawData
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    rows = lines.map(splitCSVLine);
  } else {
    rows = rawData.map((row) =>
      row.map((cell) => String(cell !== undefined && cell !== null ? cell : '').trim())
    );
  }

  if (rows.length === 0) return [];

  // 1. Detect Class from filename or sheet
  const detectedFromFilename = options?.fileName
    ? detectClassFromFilename(options.fileName, classes)
    : null;
  const detectedFromSheet = detectClassFromSheet(rows, options?.sheetName, classes);

  const resolvedClassId =
    detectedFromFilename?.classId || detectedFromSheet?.classId || defaultClassId;
  const resolvedClassName =
    detectedFromFilename?.className ||
    detectedFromSheet?.className ||
    classes.find((c) => c.id === resolvedClassId)?.nameBn ||
    'শ্রেণি';

  // 2. Locate Header Row
  let headerIndex = -1;
  let isAttendanceSheet = false;

  const fileNameLower = (options?.fileName || '').toLowerCase();
  if (fileNameLower.includes('attendance') || fileNameLower.includes('উপস্থিতি')) {
    isAttendanceSheet = true;
  }

  // Search first 10 rows for header
  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const rowCells = rows[r].map((c) => c.toLowerCase());
    const hasRollOrSl = rowCells.some(
      (c) =>
        c.includes('রোল') ||
        c.includes('roll') ||
        c.includes('sl') ||
        c.includes('ক্রমিক') ||
        c.includes('নং')
    );
    const hasName = rowCells.some(
      (c) => c.includes('নাম') || c.includes('name') || c.includes('শিক্ষার্থী')
    );

    if (hasRollOrSl && hasName) {
      headerIndex = r;
      break;
    }
  }

  // Column mapping indices
  let rollCol = 0;
  let nameBnCol = 1;
  let nameEnCol = -1;
  let classCol = -1;
  let sectionCol = -1;
  let genderCol = -1;
  let phoneCol = -1;
  let fatherCol = -1;
  let motherCol = -1;
  let bloodCol = -1;
  let yearCol = -1;

  if (headerIndex >= 0) {
    const headerRow = rows[headerIndex].map((c) => c.toLowerCase());

    headerRow.forEach((colName, cIdx) => {
      if (
        (colName.includes('রোল') || colName.includes('roll') || colName.includes('sl') || colName.includes('ক্রমিক')) &&
        rollCol === 0
      ) {
        rollCol = cIdx;
      } else if (
        colName.includes('ইংরেজি') ||
        colName.includes('english') ||
        colName.includes('en name')
      ) {
        nameEnCol = cIdx;
      } else if (
        colName.includes('নাম') ||
        colName.includes('name') ||
        colName.includes('শিক্ষার্থী')
      ) {
        if (nameBnCol === 1 && cIdx !== rollCol) {
          nameBnCol = cIdx;
        }
      } else if (colName.includes('শ্রেণি') || colName.includes('class')) {
        classCol = cIdx;
      } else if (colName.includes('শাখা') || colName.includes('section')) {
        sectionCol = cIdx;
      } else if (colName.includes('লিঙ্গ') || colName.includes('gender') || colName.includes('sex')) {
        genderCol = cIdx;
      } else if (colName.includes('মোবাইল') || colName.includes('phone') || colName.includes('mobile')) {
        phoneCol = cIdx;
      } else if (colName.includes('পিতা') || colName.includes('father')) {
        fatherCol = cIdx;
      } else if (colName.includes('মাতা') || colName.includes('mother')) {
        motherCol = cIdx;
      } else if (colName.includes('রক্ত') || colName.includes('blood')) {
        bloodCol = cIdx;
      } else if (colName.includes('শিক্ষাবর্ষ') || colName.includes('year') || colName.includes('সাল')) {
        yearCol = cIdx;
      }
    });

    // Check if the header has numbered date columns (1, 2, 3... 31) -> Attendance sheet!
    const numberCount = headerRow.filter((h) => /^\d{1,2}$/.test(h.trim())).length;
    if (numberCount >= 5) {
      isAttendanceSheet = true;
    }
  } else {
    // If no header found, search for the first row containing a numeric roll in col 0 and name in col 1
    for (let r = 0; r < Math.min(rows.length, 10); r++) {
      const candidateRoll = parseBengaliNumber(rows[r][0]);
      const candidateName = rows[r][1] || '';
      if (!isNaN(candidateRoll) && candidateRoll > 0 && candidateName.length >= 2 && !/^\d+$/.test(candidateName)) {
        headerIndex = r - 1; // data starts at r
        break;
      }
    }
  }

  // Determine starting data row
  const startRow = headerIndex >= 0 ? headerIndex + 1 : 0;
  const dataRows = rows.slice(startRow);

  const seenRolls = new Set<number>();
  const parsedStudents: ParsedStudentRow[] = [];

  dataRows.forEach((cols, idx) => {
    // If empty row, skip
    if (cols.every((c) => !c || c.trim() === '')) return;

    // Check roll and name
    const rawRoll = cols[rollCol] || '';
    const nameBn = cols[nameBnCol] || '';

    // If no name found or roll is empty header-like row, skip
    if (!nameBn.trim()) return;

    // If name is actually a header keyword or date, skip
    if (
      nameBn.includes('নাম') ||
      nameBn.includes('Name') ||
      nameBn.includes('উপস্থিতি') ||
      nameBn.includes('Attendance') ||
      nameBn.includes('স্বাক্ষর') ||
      nameBn.includes('Total') ||
      nameBn.includes('মোট')
    ) {
      return;
    }

    let rollNum = parseBengaliNumber(rawRoll);
    if (isNaN(rollNum) || rollNum <= 0) {
      rollNum = parsedStudents.length + 1;
    }

    let nameEn = nameEnCol >= 0 ? cols[nameEnCol] || '' : '';
    let rawClass = classCol >= 0 ? cols[classCol] || '' : '';
    let section = sectionCol >= 0 ? cols[sectionCol] || '' : '';
    let rawGender = genderCol >= 0 ? cols[genderCol] || '' : '';
    let phone = phoneCol >= 0 ? cols[phoneCol] || '' : '';
    let father = fatherCol >= 0 ? cols[fatherCol] || '' : '';
    let mother = motherCol >= 0 ? cols[motherCol] || '' : '';
    let blood = bloodCol >= 0 ? cols[bloodCol] || '' : '';
    let year = yearCol >= 0 ? cols[yearCol] || defaultYear : defaultYear;

    // If it's NOT an attendance sheet and columns weren't explicitly named:
    if (!isAttendanceSheet && classCol === -1 && phoneCol === -1) {
      if (cols.length >= 9) {
        rawClass = cols[3] || '';
        section = cols[4] || '';
        rawGender = cols[5] || '';
        phone = cols[6] || '';
        father = cols[7] || '';
        mother = cols[8] || '';
        blood = cols[9] || '';
        year = cols[10] || defaultYear;
      }
    }

    // Gender detection
    let gender: 'ছাত্র' | 'ছাত্রী' = 'ছাত্র';
    if (
      rawGender.includes('ছাত্রী') ||
      rawGender.toLowerCase().includes('female') ||
      rawGender.toLowerCase().includes('girl')
    ) {
      gender = 'ছাত্রী';
    }

    // Class resolution
    let matchedClassId = resolvedClassId;
    let classNameDisplay = resolvedClassName;

    if (rawClass) {
      const foundCls = classes.find(
        (c) =>
          c.nameBn.toLowerCase().includes(rawClass.toLowerCase()) ||
          c.nameEn.toLowerCase().includes(rawClass.toLowerCase()) ||
          c.id.toLowerCase() === rawClass.toLowerCase()
      );
      if (foundCls) {
        matchedClassId = foundCls.id;
        classNameDisplay = foundCls.nameBn;
      }
    }

    // Blood group cleanup
    let cleanBlood = blood.toUpperCase().replace(/\s+/g, '');
    const validBloods = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
    if (!validBloods.includes(cleanBlood)) {
      cleanBlood = blood;
    }

    // Validation
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!nameBn.trim()) {
      errors.push('শিক্ষার্থীর নাম (বাংলা) আবশ্যক');
    }

    if (seenRolls.has(rollNum)) {
      warnings.push(`তালিকায় একাধিক শিক্ষার্থীর রোল ${rollNum}`);
    } else {
      seenRolls.add(rollNum);
    }

    const cleanedPhone = cleanPhoneNumber(phone);
    if (cleanedPhone && cleanedPhone.length !== 11) {
      warnings.push('মোবাইল নম্বরটি ১১ ডিজিটের নয়');
    }

    parsedStudents.push({
      index: idx + 1,
      roll: rollNum,
      nameBn: nameBn.trim(),
      nameEn: nameEn.trim(),
      classId: matchedClassId,
      classNameDisplay,
      section: section.trim() || defaultSection || 'ক',
      gender,
      guardianPhone: cleanedPhone || phone.trim(),
      fatherName: father.trim(),
      motherName: mother.trim(),
      bloodGroup: cleanBlood,
      academicYear: year.trim() || defaultYear,
      isValid: errors.length === 0,
      errors,
      warnings,
    });
  });

  return parsedStudents;
}
