export interface SchoolInfo {
  name: string;
  address: string;
  established: string;
  phone: string;
  email: string;
  logoUrl?: string;
  principalSignatureUrl?: string;
  sealUrl?: string;
}

export interface Student {
  id: string;
  nameBn: string;
  nameEn?: string;
  roll: number;
  classId: string;
  section: string;
  academicYear: string;
  fatherName?: string;
  motherName?: string;
  guardianPhone?: string;
  gender?: 'ছাত্র' | 'ছাত্রী';
  bloodGroup?: string;
  avatarUrl?: string;
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


