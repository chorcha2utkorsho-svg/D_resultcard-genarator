export interface SchoolDailySchedule {
  ptStartTimeBn: string;
  classStartTimeBn: string;
  breakTimeBn: string;
  dismissalTimeBn: string;
}

export interface SchoolInfo {
  name: string;
  address: string;
  established: string;
  phone: string;
  email: string;
  logoUrl?: string;
  principalSignatureUrl?: string;
  sealUrl?: string;
  dailySchedule?: SchoolDailySchedule;
}

export interface Student {
  id: string;
  nameBn: string;
  nameEn?: string;
  roll: number;
  classId: string;
  section: string;
  academicYear: string;
  avatarUrl?: string; // ছবি
  dob?: string; // জন্ম তারিখ (YYYY-MM-DD)
  birthRegNo?: string; // জন্ম নিবন্ধন নম্বর (১৭ ডিজিট)
  gender?: 'ছাত্র' | 'ছাত্রী';
  bloodGroup?: string;
  religion?: string;

  // পিতা সংক্রান্ত বিস্তারিত তথ্য
  fatherNameBn?: string;
  fatherNameEn?: string;
  fatherAvatarUrl?: string; // পিতার ছবি
  fatherDob?: string;
  fatherBirthRegNo?: string;
  fatherNid?: string;
  fatherPhone?: string;
  fatherOccupation?: string;

  // মাতা সংক্রান্ত বিস্তারিত তথ্য
  motherNameBn?: string;
  motherNameEn?: string;
  motherAvatarUrl?: string; // মাতার ছবি
  motherDob?: string;
  motherBirthRegNo?: string;
  motherNid?: string;
  motherPhone?: string;
  motherOccupation?: string;

  // অভিভাবক ও যোগাযোগ
  guardianName?: string;
  guardianRelation?: 'পিতা' | 'মাতা' | 'ভাই' | 'চাচা' | 'অন্যান্য';
  guardianPhone?: string;
  guardianNid?: string;
  emergencyPhone?: string;
  guardianPin?: string; // অভিভাবকের গোপন পিন বা পাসওয়ার্ড

  // ঠিকানা
  presentAddress?: string; // বর্তমান ঠিকানা (বাড়ি/রাস্তা, ডাকঘর, উপজেলা, জেলা)
  permanentAddress?: string; // স্থায়ী ঠিকানা

  // Backward compatibility fields
  fatherName?: string;
  motherName?: string;

  // পোর্টালে নিজস্ব ড্যাশবোর্ড লগইন ও ব্যক্তিগত প্রগ্রেস ডেটা
  portalUserId?: string; // ইউনিক লগইন আইডি (যেমন: DL-4-01)
  futurePlan?: StudentFuturePlan;
  achievements?: StudentAchievement[];
  dreamGallery?: DreamGalleryPhoto[];
  monerBari?: MonerBariData;
  timeManagement?: StudentTimeManagementData;

  // ডিজিটাল সিকিউরিটি ও স্মার্ট আইডি কিউআর কোড
  securityQrCode?: string; // সিকিউর কিউআর কোড টোকেন
}

export interface DreamGalleryPhoto {
  id: string;
  careerTag: string;
  titleBn: string;
  captionBn?: string;
  imageUrl: string;
  isAiGenerated?: boolean;
  createdAt: string;
}

export interface MonerBariJournalEntry {
  id: string;
  date: string;
  mood: string;
  promptBn?: string;
  contentBn: string;
  createdAt: string;
}

export interface MonerBariEmotionalGoal {
  id: string;
  titleBn: string;
  achieved: boolean;
  createdAt: string;
}

export interface MonerBariMoodLog {
  id: string;
  date: string; // YYYY-MM-DD
  moodId: string;
  moodLabelBn: string;
  confidenceScore?: number; // 1 to 5
  noteBn?: string;
  createdAt: string;
}

export interface MonerBariGratitudeItem {
  id: string;
  date: string; // YYYY-MM-DD
  gratefulForBn: string;
  dailyThoughtBn?: string;
  createdAt: string;
}

export interface MonerBariData {
  moodToday?: string;
  dailyAffirmation?: string;
  favoriteQuote?: string;
  proudMoment?: string;
  gratitudeNote?: string;
  emotionalGoals?: MonerBariEmotionalGoal[];
  journalEntries?: MonerBariJournalEntry[];
  moodHistory?: MonerBariMoodLog[];
  gratitudeLogs?: MonerBariGratitudeItem[];
  updatedAt?: string;
}

export type RoutineBlockCategory =
  | 'study'
  | 'school'
  | 'spiritual'
  | 'health'
  | 'hobby'
  | 'rest';

export type RoutineDayKey =
  | 'sat'
  | 'sun'
  | 'mon'
  | 'tue'
  | 'wed'
  | 'thu'
  | 'fri';

export interface StudentRoutineBlock {
  id: string;
  startTime: string; // HH:MM (24-hour for chronological sort)
  endTime: string;   // HH:MM
  titleBn: string;
  category: RoutineBlockCategory;
  daysOfWeek?: RoutineDayKey[]; // empty or all 7 = daily; subset = weekly specific days
  noteBn?: string;
  completedDates?: string[]; // YYYY-MM-DD dates when marked completed
}

export interface StudentDailyMomentumLog {
  date: string; // YYYY-MM-DD
  completedBlockIds: string[];
  focusedMinutes: number;
  sessionsCount: number;
}

export interface StudentTimeManagementData {
  routineBlocks: StudentRoutineBlock[];
  dailyLogs?: StudentDailyMomentumLog[];
  totalFocusMinutes?: number;
  updatedAt?: string;
}

export interface StudentMilestone {
  id: string;
  title: string;
  targetYear: string;
  category: 'academic' | 'skill' | 'character' | 'sports' | 'other';
  status: 'planned' | 'in_progress' | 'achieved';
  note?: string;
}

export interface StudentFuturePlan {
  dreamCareer: string;
  motto: string;
  focusSubjects?: string[];
  dailyStudyHoursGoal?: number;
  milestones: StudentMilestone[];
  updatedAt?: string;
}

export interface StudentAchievement {
  id: string;
  title: string;
  date: string;
  category: 'academic' | 'sports' | 'cultural' | 'character' | 'memory';
  awardedBy?: string;
  description: string;
  photoUrl?: string;
  createdAt: string;
}

export interface SecurityGatepassLog {
  id: string;
  studentId: string;
  studentNameBn: string;
  studentRoll: number;
  classNameBn: string;
  action: 'entry' | 'exit';
  timestamp: string; // ISO string
  serverTimestamp?: number;
  guardianPhone: string;
  voiceDispatched: boolean;
  smsDispatched: boolean;
  status: 'verified' | 'flagged';
  operatorNote?: string;
  guardianAcknowledged?: boolean;
  acknowledgedAt?: string;
  guardianResponse?: string;
  acknowledgedBy?: string;
}

export interface Subject {
  id: string;
  nameBn: string;
  nameEn?: string;
  code?: string;
  classId: string;
  fullMarks: number; // e.g. 100 or 50
  passMarks?: number;
  hasMonthlyExam: boolean; // default true for 80% + 20%
  isOptional?: boolean;
  category?: string;
}

export interface StudentSubjectMark {
  subjectId: string;
  examMarks: number | null; // e.g. out of 100
  calcMarks80: number | null; // 80% of exam mark
  monthlyMarks20: number | null; // 20% from continuous/monthly
  totalMarks: number | null; // calcMarks80 + monthlyMarks20
  letterGrade: string; // A+, A, A-, B, C, D, F
  gradePoint: number; // 5.0, 4.0, etc.
}

export interface StudentExamRecord {
  id: string; // `${studentId}_${examId}_${year}`
  studentId: string;
  examId: string; // e.g. "term_2"
  academicYear: string;
  classId: string;
  section: string;
  marks: Record<string, StudentSubjectMark>; // subjectId -> mark
  workingDays?: number;
  attendance?: number;
  teacherRemarks?: string;
}

export interface CalculatedStudentResult {
  student: Student;
  examTitle: string;
  academicYear: string;
  subjectRows: {
    subject: Subject;
    fullMarks: number;
    obtainedMarks: number | null;
    marks80: number | null;
    monthly20: number | null;
    totalObtained: number | null;
    classHighest: number | null;
    letterGrade: string;
    gradePoint: number;
  }[];
  totalFullMarks: number;
  grandTotalObtained: number;
  averageMarks: number;
  gpa: number;
  overallGrade: string;
  meritPosition: number;
  meritPositionBn: string;
  totalWorkingDays: number;
  attendanceDays: number;
  absenceDays: number;
  teacherRemarks: string;
  isPassed: boolean;
}

export interface SchoolClass {
  id: string;
  nameBn: string;
  nameEn: string;
  numericOrder: number;
  defaultSubjects: Subject[];
}

export interface ExamTerm {
  id: string;
  nameBn: string;
  isDefault?: boolean;
}

export interface SyllabusItem {
  id: string;
  classId: string;
  subjectId: string;
  examId: string;
  title: string;
  chapters: string[];
  description: string;
  referenceBooks?: string;
  marksDistribution?: string;
  createdAt: string;
}

export interface StudyNote {
  id: string;
  classId: string;
  subjectId: string;
  chapter: string;
  title: string;
  content: string; // Markdown or rich text
  authorTeacher?: string;
  tags?: string[];
  createdAt: string;
}

export interface QuestionPaperQuestion {
  id: string;
  type: 'mcq' | 'creative' | 'short' | 'broad';
  questionText: string;
  marks: number;
  // For MCQ
  options?: string[]; // [ 'ক...', 'খ...', 'গ...', 'ঘ...' ]
  correctOption?: number;
  // For Creative (CQ)
  stimulus?: string; // উদ্দীপক
  subQuestions?: { label: string; text: string; marks: number }[]; // ক, খ, গ, ঘ
}

export interface QuestionPaper {
  id: string;
  title: string; // e.g. "২য় সাময়িক পরীক্ষা - ২০২৬"
  classId: string;
  subjectId: string;
  subjectName: string;
  academicYear: string;
  timeAllowed: string; // e.g. "২ ঘণ্টা ৩০ মিনিট"
  fullMarks: number; // e.g. ১০০
  generalInstructions?: string;
  sections: {
    sectionTitle: string; // e.g. "ক-বিভাগ (সৃজনশীল প্রশ্ন)"
    instructions?: string; // e.g. "যেকোনো ৫টি প্রশ্নের উত্তর দাও:"
    questions: QuestionPaperQuestion[];
  }[];
  createdAt: string;
}

export interface SMSLog {
  id: string;
  recipientPhone: string;
  recipientName: string;
  studentRoll?: number;
  className?: string;
  messageType: 'result' | 'notice' | 'attendance' | 'fees' | 'custom';
  messageText: string;
  sentAt: string;
  status: 'sent' | 'delivered' | 'failed';
  channel: 'device_sms' | 'gateway' | 'whatsapp';
}

export interface SMSGatewayConfig {
  provider: 'device_sms' | 'greenweb' | 'bulksmsbd' | 'onnorokom' | 'custom_webhook';
  apiKey?: string;
  senderId?: string; // e.g. "DLIKON_MA"
  webhookUrl?: string;
  balance?: number;
  autoLog: boolean;
}

export interface SMSNoticeTemplate {
  id: string;
  title: string;
  category: 'result' | 'meeting' | 'holiday' | 'fees' | 'exam' | 'general';
  body: string;
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'leave';

export interface DailyAttendanceRecord {
  id: string; // `${classId}_${section || 'all'}_${date}`
  date: string; // YYYY-MM-DD
  academicYear: string;
  classId: string;
  section: string;
  records: Record<
    string,
    {
      status: AttendanceStatus;
      remarks?: string;
    }
  >; // studentId -> { status, remarks }
  updatedAt: string;
}

export interface StudentAttendanceSummary {
  studentId: string;
  student: Student;
  totalWorkingDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  leaveDays: number;
  percentage: number;
  isEligible: boolean;
}

export type CalendarEventType = 'exam' | 'holiday' | 'event' | 'meeting' | 'result' | 'admission';

export interface AcademicCalendarEvent {
  id: string;
  title: string;
  type: CalendarEventType;
  startDate: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD (inclusive, for multi-day events)
  description?: string;
  applicableClasses?: string[]; // classIds or empty for all
  academicYear: string; // e.g. "২০২৬"
  isSchoolClosed: boolean; // whether classes are suspended
  location?: string;
}

// ==================== FEE & BILLING MODULE TYPES ====================

export type FeeCategory =
  | 'monthly_tuition'
  | 'arrears'
  | 'coaching'
  | 'midterm'
  | 'semester'
  | 'electricity_others'
  | 'books_diary_badge'
  | 'admission'
  | 'session'
  | 'exam'
  | 'books'
  | 'ict'
  | 'sports'
  | 'other';

export interface Standard8FeeItem {
  id: string;
  serialBn: string; // '১', '২', etc.
  nameBn: string;
  amount: number;
}

export interface FeeHead {
  id: string;
  nameBn: string;
  category: FeeCategory;
  defaultAmount: number;
  isMonthly: boolean;
  applicableClassIds?: string[];
}

export interface StudentFeeBillItem {
  headId: string;
  nameBn: string;
  month?: string;
  amount: number;
  waiver?: number;
  netAmount: number;
}

export type FeeInvoiceStatus = 'paid' | 'partial' | 'unpaid';

export interface FeeInvoice {
  id: string;
  invoiceNumber: string; // e.g. "INV-2026-001"
  studentId: string;
  studentNameBn: string;
  studentRoll: number;
  classId: string;
  section: string;
  academicYear: string;
  title: string; // e.g. "অক্টোবর ২০২৬ মাসিক বেতন ও পরীক্ষা ফি"
  billMonthYear: string;
  items: StudentFeeBillItem[];
  subtotal: number;
  previousDue: number;
  waiverTotal: number;
  fineAmount: number;
  totalPayable: number;
  paidAmount: number;
  dueAmount: number; // Real-time updated after payment
  status: FeeInvoiceStatus;
  dueDate: string;
  createdAt: string;
  lastPaymentDate?: string;
}

export type PaymentMethod = 'নগদ' | 'বিকাশ' | 'নগদ/রকেট' | 'ব্যাংক' | 'অন্যান্য';

export interface PaymentRecord {
  id: string;
  receiptNumber: string; // e.g. "MR-2026-012"
  invoiceId?: string;
  studentId: string;
  studentNameBn: string;
  studentRoll: number;
  classId: string;
  section: string;
  academicYear: string;
  paidAmount: number;
  amountInWordsBn: string;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  transactionRef?: string;
  collectedBy: string;
  previousTotalDue: number; // পেমেন্ট গ্রহণের পূর্বের বকেয়া
  remainingDue: number; // পেমেন্ট গ্রহণের পর তাৎক্ষণিক অবশিষ্ট বকেয়া
  itemsBreakdown: { nameBn: string; amount: number }[];
  notes?: string;
}

export interface StudentDueSummary {
  student: Student;
  totalBilled: number;
  totalPaid: number;
  totalDue: number;
  invoices: FeeInvoice[];
  receipts: PaymentRecord[];
  status: FeeInvoiceStatus;
  lastPaymentDate?: string;
}

// ==================== 3-PORTAL AUTH & ROLE TYPES ====================

export type PortalRole = 'official' | 'student' | 'employee';

export interface StaffAccount {
  id: string;
  staffCode: string; // e.g. 'DL-ADMIN' or 'DL-EMP-01'
  role: 'official' | 'employee';
  nameBn: string;
  designationBn: string;
  phone: string;
  email?: string;
  password: string;
  department?: 'administration' | 'academic' | 'accounts' | 'security' | 'office';
  assignedClassIds?: string[];
  status: 'active' | 'pending';
  avatarUrl?: string;
  createdAt: string;
}

export interface StaffAttendanceRecord {
  id: string; // `${staffId}_${date}`
  staffId: string;
  staffNameBn: string;
  designationBn: string;
  date: string; // YYYY-MM-DD
  checkInTime: string;
  checkOutTime?: string;
  status: 'present' | 'late' | 'leave';
  note?: string;
}

export interface AdmissionSignupRequest {
  id: string;
  studentNameBn: string;
  classId: string;
  desiredRoll?: number;
  guardianNameBn: string;
  guardianPhone: string;
  password: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface PortalAuthSession {
  role: PortalRole;
  accountId: string;
  displayName: string;
  subLabel: string;
  staffCode?: string;
}


