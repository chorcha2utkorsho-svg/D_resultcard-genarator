import {
  SchoolInfo,
  SchoolClass,
  Student,
  StudentExamRecord,
  ExamTerm,
  SyllabusItem,
  StudyNote,
  QuestionPaper,
  DailyAttendanceRecord,
  AcademicCalendarEvent,
  FeeHead,
  FeeInvoice,
  PaymentRecord,
} from '../types';
import bundledStudents from './bundledStudents.json';

export const DEFAULT_SCHOOL_INFO: SchoolInfo = {
  name: 'ডি-লিকন মডেল একাডেমী',
  address: 'দক্ষিণগাঁও, গণি মার্কেট, সনমানিয়া, কাপাসিয়া, গাজীপুর।',
  established: 'স্থাপিত:২০১৮',
  phone: '০১৩১৩১৫৯৪৫৯',
  email: 'contact.dlikonmodelacademy@gmail.com',
  dailySchedule: {
    ptStartTimeBn: 'আটটা পঞ্চান্ন মিনিটে',
    classStartTimeBn: 'নয়টা বিশ মিনিটে',
    breakTimeBn: 'দুপুর একটা দশ মিনিটে',
    dismissalTimeBn: 'বিকাল চারটায়',
  },
};

export const DEFAULT_EXAM_TERMS: ExamTerm[] = [
  { id: 'term_1', nameBn: '১ম সাময়িক পরীক্ষা' },
  { id: 'term_2', nameBn: '২য় সাময়িক পরীক্ষা', isDefault: true },
  { id: 'term_annual', nameBn: 'বার্ষিক পরীক্ষা' },
  { id: 'term_tutorial_1', nameBn: '১ম টিউটোরিয়াল পরীক্ষা' },
  { id: 'term_tutorial_2', nameBn: '২য় টিউটোরিয়াল পরীক্ষা' },
];

export const DEFAULT_CLASSES: SchoolClass[] = [
  {
    id: 'class_play',
    nameBn: 'প্লে শ্রেণি',
    nameEn: 'Play',
    numericOrder: 0,
    defaultSubjects: [
      { id: 'sub_play_bn', nameBn: 'বাংলা', classId: 'class_play', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_play_en', nameBn: 'ইংরেজী', classId: 'class_play', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_play_math', nameBn: 'গণিত', classId: 'class_play', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_play_gk', nameBn: 'সাধারণ জ্ঞান ও মৌখিক', classId: 'class_play', fullMarks: 50, hasMonthlyExam: true },
    ],
  },
  {
    id: 'class_nursery',
    nameBn: 'নার্সারি শ্রেণি',
    nameEn: 'Nursery',
    numericOrder: 0.5,
    defaultSubjects: [
      { id: 'sub_nur_bn', nameBn: 'বাংলা', classId: 'class_nursery', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_nur_en', nameBn: 'ইংরেজী', classId: 'class_nursery', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_nur_math', nameBn: 'গণিত', classId: 'class_nursery', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_nur_rel', nameBn: 'ধর্ম ও নৈতিক শিক্ষা', classId: 'class_nursery', fullMarks: 50, hasMonthlyExam: true },
      { id: 'sub_nur_gk', nameBn: 'সাধারণ জ্ঞান ও ড্রয়িং', classId: 'class_nursery', fullMarks: 50, hasMonthlyExam: true },
    ],
  },
  {
    id: 'class_kg',
    nameBn: 'কেজি শ্রেণি',
    nameEn: 'KG',
    numericOrder: 0.8,
    defaultSubjects: [
      { id: 'sub_kg_bn', nameBn: 'বাংলা', classId: 'class_kg', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_kg_en', nameBn: 'ইংরেজী', classId: 'class_kg', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_kg_math', nameBn: 'গণিত', classId: 'class_kg', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_kg_rel', nameBn: 'ধর্ম ও নৈতিক শিক্ষা', classId: 'class_kg', fullMarks: 50, hasMonthlyExam: true },
      { id: 'sub_kg_sci', nameBn: 'প্রাথমিক পরিবেশ ও সাধারণ জ্ঞান', classId: 'class_kg', fullMarks: 50, hasMonthlyExam: true },
    ],
  },
  {
    id: 'class_1',
    nameBn: '১ম শ্রেণি',
    nameEn: 'Class 1',
    numericOrder: 1,
    defaultSubjects: [
      { id: 'sub_1_bn', nameBn: 'বাংলা', classId: 'class_1', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_1_en', nameBn: 'ইংরেজী', classId: 'class_1', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_1_math', nameBn: 'গণিত', classId: 'class_1', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_1_rel', nameBn: 'ধর্ম ও নৈতিক শিক্ষা', classId: 'class_1', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_1_gk', nameBn: 'সাধারণ জ্ঞান ও চিত্রাঙ্কন', classId: 'class_1', fullMarks: 50, hasMonthlyExam: true },
    ],
  },
  {
    id: 'class_2',
    nameBn: '২য় শ্রেণি',
    nameEn: 'Class 2',
    numericOrder: 2,
    defaultSubjects: [
      { id: 'sub_2_bn', nameBn: 'বাংলা', classId: 'class_2', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_2_en', nameBn: 'ইংরেজী', classId: 'class_2', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_2_math', nameBn: 'গণিত', classId: 'class_2', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_2_rel', nameBn: 'ধর্ম ও নৈতিক শিক্ষা', classId: 'class_2', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_2_gk', nameBn: 'সাধারণ জ্ঞান ও অঙ্কন', classId: 'class_2', fullMarks: 50, hasMonthlyExam: true },
    ],
  },
  {
    id: 'class_3',
    nameBn: '৩য় শ্রেণি',
    nameEn: 'Class 3',
    numericOrder: 3,
    defaultSubjects: [
      { id: 'sub_3_bn', nameBn: 'বাংলা', classId: 'class_3', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_3_en', nameBn: 'ইংরেজি', classId: 'class_3', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_3_math', nameBn: 'প্রাথমিক গণিত', classId: 'class_3', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_3_sci', nameBn: 'প্রাথমিক বিজ্ঞান', classId: 'class_3', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_3_bgs', nameBn: 'বাংলাদেশ ও বিশ্বপরিচয়', classId: 'class_3', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_3_rel', nameBn: 'ধর্ম ও নৈতিক শিক্ষা', classId: 'class_3', fullMarks: 100, hasMonthlyExam: true },
    ],
  },
  {
    id: 'class_4',
    nameBn: '৪র্থ শ্রেণি',
    nameEn: 'Class 4',
    numericOrder: 4,
    defaultSubjects: [
      { id: 'sub_4_bn', nameBn: 'বাংলা', classId: 'class_4', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_4_en1', nameBn: 'ইংরেজী ১ম পত্র', classId: 'class_4', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_4_en2', nameBn: 'ইংরেজী ২য় পত্র', classId: 'class_4', fullMarks: 50, hasMonthlyExam: true },
      { id: 'sub_4_math', nameBn: 'প্রাথমিক গণিত', classId: 'class_4', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_4_sci', nameBn: 'প্রাথমিক বিজ্ঞান', classId: 'class_4', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_4_bgs', nameBn: 'বাংলাদেশ ও বিশ্ব পরিচয়', classId: 'class_4', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_4_rel', nameBn: 'ইসলাম ও নৈতিক শিক্ষা/ হিন্দু ধর্ম', classId: 'class_4', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_4_gk', nameBn: 'সাধারণ জ্ঞান', classId: 'class_4', fullMarks: 50, hasMonthlyExam: true },
    ],
  },
  {
    id: 'class_5',
    nameBn: '৫ম শ্রেণি',
    nameEn: 'Class 5',
    numericOrder: 5,
    defaultSubjects: [
      { id: 'sub_5_bn', nameBn: 'বাংলা', classId: 'class_5', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_5_en', nameBn: 'ইংরেজি', classId: 'class_5', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_5_math', nameBn: 'প্রাথমিক গণিত', classId: 'class_5', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_5_sci', nameBn: 'প্রাথমিক বিজ্ঞান', classId: 'class_5', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_5_bgs', nameBn: 'বাংলাদেশ ও বিশ্বপরিচয়', classId: 'class_5', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_5_rel', nameBn: 'ধর্ম ও নৈতিক শিক্ষা', classId: 'class_5', fullMarks: 100, hasMonthlyExam: true },
    ],
  },
  {
    id: 'class_6',
    nameBn: '৬ষ্ঠ শ্রেণি',
    nameEn: 'Class 6',
    numericOrder: 6,
    defaultSubjects: [
      { id: 'sub_6_bn', nameBn: 'বাংলা', classId: 'class_6', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_6_en', nameBn: 'ইংরেজি', classId: 'class_6', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_6_math', nameBn: 'গণিত', classId: 'class_6', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_6_sci', nameBn: 'বিজ্ঞান অনুসন্ধান ও অনুশীলন', classId: 'class_6', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_6_hist', nameBn: 'ইতিহাস ও সামাজিক বিজ্ঞান', classId: 'class_6', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_6_rel', nameBn: 'ধর্ম ও নৈতিক শিক্ষা', classId: 'class_6', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_6_ict', nameBn: 'ডিজিটাল প্রযুক্তি', classId: 'class_6', fullMarks: 50, hasMonthlyExam: true },
      { id: 'sub_6_health', nameBn: 'স্বাস্থ্য সুরক্ষা', classId: 'class_6', fullMarks: 50, hasMonthlyExam: true },
    ],
  },
  {
    id: 'class_7',
    nameBn: '৭ম শ্রেণি',
    nameEn: 'Class 7',
    numericOrder: 7,
    defaultSubjects: [
      { id: 'sub_7_bn', nameBn: 'বাংলা', classId: 'class_7', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_7_en', nameBn: 'ইংরেজি', classId: 'class_7', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_7_math', nameBn: 'গণিত', classId: 'class_7', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_7_sci', nameBn: 'বিজ্ঞান', classId: 'class_7', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_7_hist', nameBn: 'ইতিহাস ও সামাজিক বিজ্ঞান', classId: 'class_7', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_7_rel', nameBn: 'ধর্ম ও নৈতিক শিক্ষা', classId: 'class_7', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_7_ict', nameBn: 'ডিজিটাল প্রযুক্তি', classId: 'class_7', fullMarks: 50, hasMonthlyExam: true },
    ],
  },
  {
    id: 'class_8',
    nameBn: '৮ম শ্রেণি',
    nameEn: 'Class 8',
    numericOrder: 8,
    defaultSubjects: [
      { id: 'sub_8_bn', nameBn: 'বাংলা', classId: 'class_8', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_8_en', nameBn: 'ইংরেজি', classId: 'class_8', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_8_math', nameBn: 'গণিত', classId: 'class_8', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_8_sci', nameBn: 'বিজ্ঞান', classId: 'class_8', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_8_hist', nameBn: 'ইতিহাস ও সামাজিক বিজ্ঞান', classId: 'class_8', fullMarks: 100, hasMonthlyExam: true },
      { id: 'sub_8_rel', nameBn: 'ধর্ম ও নৈতিক শিক্ষা', classId: 'class_8', fullMarks: 100, hasMonthlyExam: true },
    ],
  },
];

export const INITIAL_STUDENTS: Student[] = Array.isArray(bundledStudents)
  ? (bundledStudents as Student[])
  : [];

export const INITIAL_EXAM_RECORDS: StudentExamRecord[] = [];

export const INITIAL_SYLLABI: SyllabusItem[] = [
  {
    id: 'syl_1',
    classId: 'class_4',
    subjectId: 'sub_4_bn',
    examId: 'term_2',
    title: 'বাংলা ২য় সাময়িক সিলেবাস ২০২৬',
    chapters: ['পাখিপ্রেমী', 'হাত ধুয়ে নাও', 'মহীয়সী রোকেয়া', 'যুক্তবর্ণ ও ব্যাকরণ অনুচ্ছেদ'],
    description: 'গদ্যাংশ থেকে শব্দার্থ, শূন্যস্থান পূরণ, প্রশ্নোত্তর ও ব্যাকরণ অংশ থেকে পদ প্রকরণ এবং দরখাস্ত রচনা থাকবে।',
    referenceBooks: 'আমার বাংলা বই - ৪র্থ শ্রেণি (জাতীয় শিক্ষাক্রম ও পাঠ্যপুস্তক বোর্ড)',
    marksDistribution: 'সৃজনশীল/বর্ণনামূলক: ৬০, ব্যাকরণ: ২০, মাসিক/ধারাবাহিক: ২০। মোট: ১০০ নম্বর।',
    createdAt: '2026-03-10',
  },
  {
    id: 'syl_2',
    classId: 'class_4',
    subjectId: 'sub_4_math',
    examId: 'term_2',
    title: 'প্রাথমিক গণিত ২য় সাময়িক সিলেবাস ২০২৬',
    chapters: ['অধ্যায় ৫: চার প্রক্রিয়া সম্পর্কিত সমস্যাবলি', 'অধ্যায় ৬: গাণিতিক প্রতীক', 'অধ্যায় ৭: গুণিতক ও গুণনীয়ক'],
    description: 'সংক্ষিপ্ত প্রশ্ন ২০টি (২০ নম্বর), কাঠামোবদ্ধ প্রশ্ন ৫টি (৪০ নম্বর), ও মাসিক পরীক্ষা ২০ নম্বর।',
    referenceBooks: 'প্রাথমিক গণিত - ৪র্থ শ্রেণি',
    marksDistribution: 'সংক্ষিপ্ত প্রশ্ন: ২০, কাঠামোবদ্ধ প্রশ্ন: ৬০, মাসিক মূল্যায়ন: ২০। মোট: ১০০',
    createdAt: '2026-03-11',
  },
];

export const INITIAL_NOTES: StudyNote[] = [
  {
    id: 'note_1',
    classId: 'class_4',
    subjectId: 'sub_4_math',
    chapter: 'গুণিতক ও গুণনীয়ক (অধ্যায় ৭)',
    title: 'লসাগু ও গসাগু নির্ণয়ের সহজ নিয়ম ও সূত্রাবলী',
    content: `### লসাগু (লঘিষ্ঠ সাধারণ গুণিতক)
- দুই বা ততোধিক সংখ্যার সাধারণ গুণিতকগুলোর মধ্যে সবচেয়ে ছোট সংখ্যাটিকে তাদের লঘিষ্ঠ সাধারণ গুণিতক বা লসাগু বলে।
- উদাহরণ: ৪ ও ৬ এর লসাগু কত?
  - ৪ এর গুণিতক: ৪, ৮, ১২, ১৬, ২০, ২৪...
  - ৬ এর গুণিতক: ৬, ১২, ১৮, ২৪...
  - সাধারণ গুণিতক: ১২, ২৪... সুতরাং সবচেয়ে ছোটটি হলো ১২।

### গসাগু (গরিষ্ঠ সাধারণ গুণনীয়ক)
- দুই বা ততোধিক সংখ্যার সাধারণ গুণনীয়কগুলোর মধ্যে সবচেয়ে বড় সংখ্যাটিকে গসাগু বলে।
- উদাহরণ: ১২ ও ১৮ এর গসাগু কত?
  - ১২ এর গুণনীয়ক: ১, ২, ৩, ৪, ৬, ১২
  - ১৮ এর গুণনীয়ক: ১, ২, ৩, ৬, ৯, ১৮
  - সাধারণ গুণনীয়ক: ১, ২, ৩, ৬। সবচেয়ে বড়টি হলো ৬।

### মনে রাখার টিপস:
- মৌলিক উৎপাদকে বিশ্লেষণ করে দ্রুত লসাগু ও গসাগু বের করা যায়।`,
    authorTeacher: 'মোঃ কামরুল হাসান (সহকারী শিক্ষক, গণিত)',
    tags: ['গণিত', 'লসাগু', 'গসাগু', '৪র্থ শ্রেণি'],
    createdAt: '2026-03-15',
  },
  {
    id: 'note_2',
    classId: 'class_4',
    subjectId: 'sub_4_sci',
    chapter: 'অধ্যায় ৪: খাদ্য ও পুষ্টি',
    title: 'খাদ্যের ৬টি উপাদান ও তাদের কাজসমূহ',
    content: `### খাদ্যের প্রধান ৬টি উপাদান:
১. শর্করা (কার্বোহাইড্রেট) - শক্তি জোগায় (যেমন: ভাত, আলু, রুটি)
২. আমিষ (প্রোটিন) - দেহের বৃদ্ধি ও ক্ষয়পূরণ করে (যেমন: মাছ, মাংস, ডিম, ডাল)
৩. স্নেহ (চর্বি) - শক্তি ও তাপ উৎপাদন করে (যেমন: তেল, ঘি, মাখন)
৪. ভিটামিন (খাদ্যপ্রাণ) - রোগ প্রতিরোধ ক্ষমতা বাড়ায় (শাকসবজি, ফলমূল)
৫. খনিজ লবণ - হাড় ও দাঁত মজবুত করে এবং রক্ত তৈরি করে (দুধ, কচুশাক, আয়োডিনযুক্ত লবণ)
৬. পানি - খাদ্য পরিপাক ও দেহের তাপমাত্রা নিয়ন্ত্রণে রাখে।`,
    authorTeacher: 'মোসাঃ নাসরিন সুলতানা (বিজ্ঞান শিক্ষিকা)',
    tags: ['বিজ্ঞান', 'খাদ্য ও পুষ্টি', 'ভিটামিন'],
    createdAt: '2026-03-16',
  },
];

export const INITIAL_QUESTION_PAPERS: QuestionPaper[] = [
  {
    id: 'qp_4_bn_term_2',
    title: '২য় সাময়িক পরীক্ষা - ২০২৬',
    classId: 'class_4',
    subjectId: 'sub_4_bn',
    subjectName: 'বাংলা',
    academicYear: '২০২৬',
    timeAllowed: '২ ঘণ্টা ৩০ মিনিট',
    fullMarks: 100,
    generalInstructions: 'দ্রষ্টব্য: সকল প্রশ্নের উত্তর ক্রমানুসারে লিখতে হবে। ডানপাশের সংখ্যা প্রশ্নের পূর্ণমান জ্ঞাপক।',
    sections: [
      {
        sectionTitle: 'ক-বিভাগ: অনুচ্ছেদ ও পাঠ্যবই ভিত্তিক প্রশ্ন',
        instructions: 'নিচের অনুচ্ছেদটি মনোযোগ সহকারে পড়ে ১ ও ২ নম্বর প্রশ্নের উত্তর দাও:',
        questions: [
          {
            id: 'q1',
            type: 'creative',
            questionText: 'অনুচ্ছেদটি পড়ে নিচের প্রশ্নগুলোর উত্তর দাও:',
            marks: 15,
            stimulus: 'পাখিরা আমাদের পরিবেশের অন্যতম সেরা বন্ধু। তারা সকালে কিচিরমিচির শব্দে আমাদের ঘুম ভাঙায়। ক্ষতিকর পোকামাকড় খেয়ে তারা ফসলের সুরক্ষা দেয়। কিন্তু বন জঙ্গল কেটে ফেলায় তাদের বাসস্থান দিন দিন ধ্বংস হচ্ছে।',
            subQuestions: [
              { label: 'ক', text: 'পাখিদের বাসস্থান ধ্বংস হওয়ার মূল কারণ কী?', marks: 2 },
              { label: 'খ', text: 'পাখিরা কীভাবে আমাদের ফসল রক্ষা করে বুঝিয়ে লেখ।', marks: 4 },
              { label: 'গ', text: 'পাখিদের বাঁচাতে তোমার ৪টি করণীয় পরামর্শ দাও।', marks: 4 },
              { label: 'ঘ', text: '"পাখিরা পরিবেশের ভারসাম্য রক্ষা করে" - উক্তিটির যথার্থতা মূল্যায়ন কর।', marks: 5 },
            ],
          },
          {
            id: 'q2',
            type: 'short',
            questionText: 'শব্দার্থ লেখ (যেকোনো ৫টি): অভয়ারণ্য, কিচিরমিচির, বিচরণ, মোহনা, মহীয়সী, কুহক।',
            marks: 5,
          },
        ],
      },
      {
        sectionTitle: 'খ-বিভাগ: ব্যাকরণ ও নির্মিতি',
        instructions: 'নির্দেশনা অনুযায়ী উত্তর দাও:',
        questions: [
          {
            id: 'q3',
            type: 'short',
            questionText: 'যুক্তবর্ণ ভেঙে প্রতিটি দিয়ে একটি করে বাক্য রচনা কর (যেকোনো ৫টি): ক্ষ, জ্ঞ, ষ্ণ, ক্ত, ত্র, ঙ্গ।',
            marks: 10,
          },
          {
            id: 'q4',
            type: 'broad',
            questionText: 'ছুটি চেয়ে প্রধান শিক্ষকের কাছে একটি আবেদনপত্র লেখ।',
            marks: 10,
          },
          {
            id: 'q5',
            type: 'broad',
            questionText: 'যেকোনো একটি বিষয়ে ২০০ শব্দের মধ্যে রচনা লেখ: (ক) আমাদের বিদ্যালয়, (খ) ডিজিটাল বাংলাদেশ ও স্মার্ট শিক্ষা, (গ) প্রিয় ঋতু বর্ষা।',
            marks: 15,
          },
        ],
      },
    ],
    createdAt: '2026-03-20',
  },
];

export const INITIAL_ATTENDANCE_RECORDS: Record<string, DailyAttendanceRecord> = {};

export const INITIAL_CALENDAR_EVENTS: AcademicCalendarEvent[] = [
  {
    id: 'evt_2026_01',
    title: 'বই বিতরণ উৎসব ও নতুন শিক্ষাবর্ষ উদ্বোধন',
    type: 'event',
    startDate: '2026-01-01',
    description: 'সকল শ্রেণির শিক্ষার্থীদের মাঝে বিনামূল্যে পাঠ্যপুস্তক বিতরণ এবং শিক্ষাবর্ষের শুভ সূচনা।',
    academicYear: '২০২৬',
    isSchoolClosed: false,
    location: 'বিদ্যালয় প্রাঙ্গণ',
  },
  {
    id: 'evt_2026_02',
    title: 'শহীদ দিবস ও আন্তর্জাতিক মাতৃভাষা দিবস',
    type: 'holiday',
    startDate: '2026-02-21',
    description: 'প্রভাতফেরি, শহিদ মিনারে পুষ্পস্তবক অর্পণ ও ভাষা আন্দোলনের আলোচনা সভা।',
    academicYear: '২০২৬',
    isSchoolClosed: true,
    location: 'কেন্দ্রীয় শহিদ মিনার ও বিদ্যালয় মিলনায়তন',
  },
  {
    id: 'evt_2026_03',
    title: 'জাতির পিতার জন্মবার্ষিকী ও জাতীয় শিশু দিবস',
    type: 'event',
    startDate: '2026-03-17',
    description: 'চিত্রাঙ্কন প্রতিযোগিতা, রচনা প্রতিযোগিতা ও বিশেষ দোয়া মাহফিল।',
    academicYear: '২০২৬',
    isSchoolClosed: false,
    location: 'বিদ্যালয় অডিটোরিয়াম',
  },
  {
    id: 'evt_2026_04',
    title: 'পবিত্র ঈদুল ফিতর ও শবে কদর ছুটি',
    type: 'holiday',
    startDate: '2026-03-20',
    endDate: '2026-03-25',
    description: 'পবিত্র শবে কদর, জুমাতুল বিদা ও ঈদুল ফিতর উপলক্ষে সাধারণ ছুটি।',
    academicYear: '২০২৬',
    isSchoolClosed: true,
  },
  {
    id: 'evt_2026_05',
    title: 'মহান স্বাধীনতা ও জাতীয় দিবস',
    type: 'holiday',
    startDate: '2026-03-26',
    description: 'জাতীয় পতাকা উত্তোলন, কুচকাওয়াজ প্রদর্শন এবং স্বাধীনতা দিবসের বিশেষ আয়োজন।',
    academicYear: '২০২৬',
    isSchoolClosed: true,
    location: 'বিদ্যালয় মাঠ',
  },
  {
    id: 'evt_2026_06',
    title: 'বাংলা নববর্ষ (পহেলা বৈশাখ ১৪৩৩)',
    type: 'holiday',
    startDate: '2026-04-14',
    description: 'মঙ্গল শোভাযাত্রা, বৈশাখী মেলা ও সাংস্কৃতিক অনুষ্ঠান।',
    academicYear: '২০২৬',
    isSchoolClosed: true,
  },
  {
    id: 'evt_2026_07',
    title: '১ম সাময়িক পরীক্ষা ২০২৬',
    type: 'exam',
    startDate: '2026-04-20',
    endDate: '2026-04-30',
    description: 'প্লে শ্রেণি হতে ৫ম শ্রেণি পর্যন্ত শিক্ষার্থীদের ১ম সাময়িক পরীক্ষা অনুষ্ঠিত হবে।',
    academicYear: '২০২৬',
    isSchoolClosed: false,
    location: 'সকল ক্লাসরুম',
  },
  {
    id: 'evt_2026_08',
    title: 'মে দিবস (আন্তর্জাতিক শ্রমিক দিবস)',
    type: 'holiday',
    startDate: '2026-05-01',
    description: 'আন্তর্জাতিক শ্রমিক দিবস উপলক্ষে বিদ্যালয় বন্ধ থাকবে।',
    academicYear: '২০২৬',
    isSchoolClosed: true,
  },
  {
    id: 'evt_2026_09',
    title: '১ম সাময়িক পরীক্ষার ফলাফল প্রকাশ ও অভিভাবক সমাবেশ',
    type: 'result',
    startDate: '2026-05-10',
    description: '১ম সাময়িক পরীক্ষার প্রোগ্রেস কার্ড প্রদান এবং শিক্ষার্থীদের পড়াশোনার মানোন্নয়নে অভিভাবক মতবিনিময়।',
    academicYear: '২০২৬',
    isSchoolClosed: false,
    location: 'বিদ্যালয় মিলনায়তন',
  },
  {
    id: 'evt_2026_10',
    title: 'পবিত্র ঈদুল আযহা ও গ্রীষ্মকালীন ছুটি',
    type: 'holiday',
    startDate: '2026-05-26',
    endDate: '2026-06-03',
    description: 'পবিত্র ঈদুল আযহা ও গ্রীষ্মের অবকাশকালীন সাধারণ ছুটি।',
    academicYear: '২০২৬',
    isSchoolClosed: true,
  },
  {
    id: 'evt_2026_11',
    title: 'অভিভাবক সমাবেশ ও শিক্ষা পরামর্শ সভা',
    type: 'meeting',
    startDate: '2026-07-15',
    description: 'শিক্ষার্থীদের দ্বিতীয় সাময়িক পরীক্ষার প্রস্তুতি ও উপস্থিতি বৃদ্ধিতে অভিভাবক সমাবেশ।',
    academicYear: '২০২৬',
    isSchoolClosed: false,
    location: 'স্কুল সেমিনার হল',
  },
  {
    id: 'evt_2026_12',
    title: 'শ্রী শ্রী জন্মাষ্টমী',
    type: 'holiday',
    startDate: '2026-09-04',
    description: 'শুভ জন্মাষ্টমী উপলক্ষে বিদ্যালয় বন্ধ থাকবে।',
    academicYear: '২০২৬',
    isSchoolClosed: true,
  },
  {
    id: 'evt_2026_13',
    title: '২য় সাময়িক পরীক্ষা ২০২৬',
    type: 'exam',
    startDate: '2026-09-15',
    endDate: '2026-09-26',
    description: 'সকল শ্রেণির ২য় সাময়িক লিখিত ও মৌখিক পরীক্ষা সময়সূচি অনুযায়ী অনুষ্ঠিত হবে।',
    academicYear: '২০২৬',
    isSchoolClosed: false,
    location: 'সকল ক্লাসরুম',
  },
  {
    id: 'evt_2026_14',
    title: 'পবিত্র ঈদ-ই-মিলাদুন্নবী (সা.)',
    type: 'holiday',
    startDate: '2026-09-28',
    description: 'পবিত্র ঈদ-ই-মিলাদুন্নবী (সা.) উপলক্ষে বিদ্যালয় বন্ধ এবং বিশেষ দোয়া মাহফিল।',
    academicYear: '২০২৬',
    isSchoolClosed: true,
  },
  {
    id: 'evt_2026_15',
    title: '২য় সাময়িক পরীক্ষার ফলাফল প্রকাশ ও প্রোগ্রেস কার্ড বিতরণ',
    type: 'result',
    startDate: '2026-10-08',
    description: 'অফিস কক্ষ থেকে সকাল ১০:০০ ঘটিকা হতে ২য় সাময়িক পরীক্ষার প্রোগ্রেস কার্ড বিতরণ করা হবে।',
    academicYear: '২০২৬',
    isSchoolClosed: false,
    location: 'অফিস ও ক্লাসরুম',
  },
  {
    id: 'evt_2026_16',
    title: 'শ্রী শ্রী দুর্গাপূজা ও ফাতেহা-ই-ইয়াজদাহম ছুটি',
    type: 'holiday',
    startDate: '2026-10-18',
    endDate: '2026-10-24',
    description: 'দুর্গাপূজা (বিজয়া দশমী) ও ফাতেহা-ই-ইয়াজদাহম উপলক্ষে ছুটি।',
    academicYear: '২০২৬',
    isSchoolClosed: true,
  },
  {
    id: 'evt_2026_17',
    title: 'বার্ষিক ক্রীড়া প্রতিযোগিতা ও সাংস্কৃতিক সপ্তাহ',
    type: 'event',
    startDate: '2026-11-05',
    endDate: '2026-11-07',
    description: 'দৌড়, ভারসাম্য দৌড়, যেমন খুশি তেমন সাজো ও বার্ষিক সাংস্কৃতিক প্রতিযোগিতার আয়োজন।',
    academicYear: '২০২৬',
    isSchoolClosed: false,
    location: 'বিদ্যালয় কেন্দ্রীয় খেলার মাঠ',
  },
  {
    id: 'evt_2026_18',
    title: 'বার্ষিক পরীক্ষা ২০২৬',
    type: 'exam',
    startDate: '2026-11-22',
    endDate: '2026-12-05',
    description: 'চলতি শিক্ষাবর্ষের সমাপনী ও চূড়ান্ত বার্ষিক পরীক্ষা অনুষ্ঠিত হবে।',
    academicYear: '২০২৬',
    isSchoolClosed: false,
    location: 'সকল পরীক্ষার হল',
  },
  {
    id: 'evt_2026_19',
    title: 'মহান বিজয় দিবস',
    type: 'holiday',
    startDate: '2026-12-16',
    description: 'জাতীয় পতাকা উত্তোলন, কুচকাওয়াজ ও মুক্তিযুদ্ধ বিষয়ক আলোচনা অনুষ্ঠান।',
    academicYear: '২০২৬',
    isSchoolClosed: true,
    location: 'বিদ্যালয় প্রাঙ্গণ',
  },
  {
    id: 'evt_2026_20',
    title: 'যিশু খ্রিস্টের জন্মদিন (বড়দিন) ও শীতকালীন অবকাশ',
    type: 'holiday',
    startDate: '2026-12-25',
    endDate: '2026-12-31',
    description: 'বড়দিন ও বার্ষিক শীতকালীন ছুটি।',
    academicYear: '২০২৬',
    isSchoolClosed: true,
  },
  {
    id: 'evt_2026_21',
    title: 'বার্ষিক পরীক্ষার চূড়ান্ত ফলাফল ও মেধাবৃত্তি ঘোষণা',
    type: 'result',
    startDate: '2026-12-30',
    description: 'চূড়ান্ত ফলাফল প্রকাশ, নতুন ক্লাসে প্রমোশন ও সেরা মেধাবী শিক্ষার্থীদের বৃত্তি প্রদান।',
    academicYear: '২০২৬',
    isSchoolClosed: false,
    location: 'বিদ্যালয় মিলনায়তন',
  },
];

// ==================== DEFAULT FEE & BILLING DATA ====================

export const STANDARD_8_VOUCHER_HEADS = [
  { id: 'fh_tuition', serialBn: '১', nameBn: 'মাসিক বেতন', defaultAmount: 500, category: 'monthly_tuition' as const, isMonthly: true },
  { id: 'fh_arrears', serialBn: '২', nameBn: 'বকেয়া', defaultAmount: 0, category: 'arrears' as const, isMonthly: false },
  { id: 'fh_coaching', serialBn: '৩', nameBn: 'কোচিং', defaultAmount: 300, category: 'coaching' as const, isMonthly: true },
  { id: 'fh_midterm', serialBn: '৪', nameBn: 'মিডটার্ম ফি', defaultAmount: 250, category: 'midterm' as const, isMonthly: false },
  { id: 'fh_semester', serialBn: '৫', nameBn: 'সেমিস্টার ফি', defaultAmount: 350, category: 'semester' as const, isMonthly: false },
  { id: 'fh_electricity', serialBn: '৬', nameBn: 'আদার্স চার্জ/বিদ্যুৎ বিল', defaultAmount: 100, category: 'electricity_others' as const, isMonthly: true },
  { id: 'fh_stationery', serialBn: '৭', nameBn: 'বই/ডায়েরী/বেতন বই/ব্যাজ', defaultAmount: 200, category: 'books_diary_badge' as const, isMonthly: false },
  { id: 'fh_others', serialBn: '৮', nameBn: 'অন্যান্য', defaultAmount: 50, category: 'other' as const, isMonthly: false },
];

export const DEFAULT_FEE_HEADS: FeeHead[] = [
  {
    id: 'fh_tuition',
    nameBn: 'মাসিক বেতন',
    category: 'monthly_tuition',
    defaultAmount: 500,
    isMonthly: true,
  },
  {
    id: 'fh_arrears',
    nameBn: 'বকেয়া',
    category: 'arrears',
    defaultAmount: 0,
    isMonthly: false,
  },
  {
    id: 'fh_coaching',
    nameBn: 'কোচিং',
    category: 'coaching',
    defaultAmount: 300,
    isMonthly: true,
  },
  {
    id: 'fh_midterm',
    nameBn: 'মিডটার্ম ফি',
    category: 'midterm',
    defaultAmount: 250,
    isMonthly: false,
  },
  {
    id: 'fh_semester',
    nameBn: 'সেমিস্টার ফি',
    category: 'semester',
    defaultAmount: 350,
    isMonthly: false,
  },
  {
    id: 'fh_electricity',
    nameBn: 'আদার্স চার্জ/বিদ্যুৎ বিল',
    category: 'electricity_others',
    defaultAmount: 100,
    isMonthly: true,
  },
  {
    id: 'fh_stationery',
    nameBn: 'বই/ডায়েরী/বেতন বই/ব্যাজ',
    category: 'books_diary_badge',
    defaultAmount: 200,
    isMonthly: false,
  },
  {
    id: 'fh_others',
    nameBn: 'অন্যান্য',
    category: 'other',
    defaultAmount: 50,
    isMonthly: false,
  },
];

export const INITIAL_FEE_INVOICES: FeeInvoice[] = [];

export const INITIAL_PAYMENT_RECEIPTS: PaymentRecord[] = [];

