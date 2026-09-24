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
