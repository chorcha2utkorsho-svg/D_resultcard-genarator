import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  SchoolInfo,
  SchoolClass,
  Student,
  StudentExamRecord,
  ExamTerm,
  CalculatedStudentResult,
  SyllabusItem,
  StudyNote,
  QuestionPaper,
  Subject,
  StudentSubjectMark,
  SMSLog,
  SMSGatewayConfig,
  AttendanceStatus,
  DailyAttendanceRecord,
  StudentAttendanceSummary,
  AcademicCalendarEvent,
  FeeHead,
  FeeInvoice,
  PaymentRecord,
  StudentDueSummary,
  PaymentMethod,
  FeeInvoiceStatus,
  StudentFeeBillItem,
  SecurityGatepassLog,
  LibraryMaterial,
  LibraryCategory,
  LibraryFileType,
  ExplicitPhotoClearFlags,
  StudentPhotoRegistryEntry,
  PhotoIntegrityReport,
} from '../types';
import { idbSet, idbGet } from '../utils/indexedDbStorage';
import { compressImageBase64 } from '../utils/imageCompressor';
import {
  auditAndRepairLocalStudentPhotos,
  buildStudentRelationKey,
  CLASS_1_TO_8_IDS,
  isValidImageReference,
  reconcileStudentPhotoReferences,
} from '../utils/studentPhotoIntegrity';
import {
  DEFAULT_SCHOOL_INFO,
  DEFAULT_CLASSES,
  DEFAULT_EXAM_TERMS,
  INITIAL_STUDENTS,
  INITIAL_EXAM_RECORDS,
  INITIAL_SYLLABI,
  INITIAL_NOTES,
  INITIAL_QUESTION_PAPERS,
  INITIAL_ATTENDANCE_RECORDS,
  INITIAL_CALENDAR_EVENTS,
  DEFAULT_FEE_HEADS,
  INITIAL_FEE_INVOICES,
  INITIAL_PAYMENT_RECEIPTS,
  INITIAL_LIBRARY_MATERIALS,
} from '../data/defaultData';
import {
  calculateGrade,
  formatGpa,
  getOverallGradeFromGpa,
  getStudentPortalId,
  toBengaliOrdinal,
  toBengaliNumber,
} from '../utils/bengali';
import { numberToBengaliWords } from '../utils/bengaliWords';
import {
  auth,
  onAuthStateChanged,
  signInWithGoogleCloudSync,
  signOutCloudSync,
  User,
} from '../firebase';
import {
  acknowledgeSecurityLogInFirestore,
  batchPushStudentsToFirestore,
  deleteLibraryMaterialFromFirestore,
  ensureSchoolDocument,
  pullLibraryMaterialsFromFirestore,
  pullStudentsFromFirestore,
  pushSecurityLogToFirestore,
  subscribeCloudSecurityLogs,
  syncLibraryMaterialToFirestore,
  syncStudentRecordToFirestore,
} from '../services/firestoreSyncService';

interface SchoolContextType {
  schoolInfo: SchoolInfo;
  updateSchoolInfo: (info: Partial<SchoolInfo>) => void;
  classes: SchoolClass[];
  updateClasses: (classes: SchoolClass[]) => void;
  updateClassSubjects: (classId: string, subjects: Subject[]) => void;
  addSubjectToClass: (classId: string, subjectData: Omit<Subject, 'id' | 'classId'>) => Subject;
  addSubjectToMultipleClasses: (classIds: string[], subjectData: Omit<Subject, 'id' | 'classId'>) => void;
  updateSubjectInClass: (classId: string, subject: Subject) => void;
  deleteSubjectFromClass: (classId: string, subjectId: string) => void;
  reorderClassSubjects: (classId: string, subjects: Subject[]) => void;
  copySubjectsBetweenClasses: (sourceClassId: string, targetClassId: string, mode?: 'replace' | 'append') => void;
  resetClassSubjectsToDefault: (classId: string) => void;
  examTerms: ExamTerm[];
  students: Student[];
  addStudent: (student: Omit<Student, 'id'>) => Student;
  updateStudent: (student: Student, options?: { explicitPhotoClear?: ExplicitPhotoClearFlags }) => Promise<boolean>;
  updateStudentPhoto: (
    studentId: string,
    role: 'student' | 'father' | 'mother',
    base64: string
  ) => Promise<{ ok: boolean; avatarUrl: string; message: string }>;
  batchUpdateStudentPhotos: (
    items: { id: string; avatarUrl?: string; fatherAvatarUrl?: string; motherAvatarUrl?: string; photoUpdatedAt?: string }[]
  ) => Promise<{ ok: boolean; updatedCount: number; message: string }>;
  deleteStudent: (studentId: string) => void;
  bulkImportStudents: (
    students: Omit<Student, 'id'>[],
    options?: {
      mode?: 'append' | 'upsert' | 'replace';
      targetClassId?: string;
      targetClassIds?: string[];
      targetSection?: string;
    }
  ) => number;
  moveStudentsToClass: (studentIds: string[], targetClassId: string, targetSection?: string) => number;
  deleteStudentsByClass: (classId: string, section?: string) => number;
  deleteMultipleStudents: (studentIds: string[]) => number;
  examRecords: Record<string, StudentExamRecord>;
  saveMarkRecord: (
    studentId: string,
    examId: string,
    academicYear: string,
    classId: string,
    section: string,
    subjectId: string,
    markData: Partial<StudentSubjectMark>,
    meta?: { workingDays?: number; attendance?: number; teacherRemarks?: string }
  ) => void;
  bulkSaveSubjectMarks: (
    examId: string,
    academicYear: string,
    classId: string,
    section: string,
    subjectId: string,
    studentMarks: { studentId: string; examMarks: number | null; monthlyMarks20: number | null }[]
  ) => void;
  getCalculatedResultsForClass: (
    classId: string,
    section: string,
    examId: string,
    academicYear: string
  ) => CalculatedStudentResult[];
  syllabi: SyllabusItem[];
  addSyllabus: (item: Omit<SyllabusItem, 'id' | 'createdAt'>) => void;
  deleteSyllabus: (id: string) => void;
  notes: StudyNote[];
  addNote: (note: Omit<StudyNote, 'id' | 'createdAt'>) => void;
  deleteNote: (id: string) => void;
  questionPapers: QuestionPaper[];
  addQuestionPaper: (paper: Omit<QuestionPaper, 'id' | 'createdAt'>) => void;
  deleteQuestionPaper: (id: string) => void;
  // Digital Library Module
  libraryMaterials: LibraryMaterial[];
  uploadLibraryMaterial: (params: {
    title: string;
    description?: string;
    category: LibraryCategory;
    fileType: LibraryFileType;
    classId: string;
    subjectId?: string;
    subjectNameBn?: string;
    chapter?: string;
    fileName: string;
    mimeType: string;
    fileSizeBytes: number;
    fileDataUrl?: string;
    externalUrl?: string;
    uploadedBy: string;
    uploadedByRole?: 'official' | 'employee';
    academicYear: string;
  }) => Promise<{ success: boolean; material?: LibraryMaterial; message?: string }>;
  updateLibraryMaterial: (
    id: string,
    updates: Partial<
      Pick<
        LibraryMaterial,
        'title' | 'description' | 'category' | 'classId' | 'subjectId' | 'subjectNameBn' | 'chapter' | 'academicYear'
      >
    >
  ) => Promise<{ success: boolean; message?: string }>;
  deleteLibraryMaterial: (id: string) => Promise<void>;
  trackLibraryDownload: (id: string) => Promise<void>;
  exportDatabaseBackup: () => void;
  importDatabaseBackup: (jsonContent: string) => { success: boolean; message: string };
  resetToDefaultData: () => void;
  selectedYear: string;
  setSelectedYear: (year: string) => void;
  selectedExamId: string;
  setSelectedExamId: (examId: string) => void;
  selectedClassId: string;
  setSelectedClassId: (classId: string) => void;
  selectedSection: string;
  setSelectedSection: (sec: string) => void;
  smsLogs: SMSLog[];
  addSMSLog: (log: Omit<SMSLog, 'id' | 'sentAt'>) => void;
  deleteSMSLog: (id: string) => void;
  clearSMSLogs: () => void;
  smsGatewayConfig: SMSGatewayConfig;
  updateSMSGatewayConfig: (cfg: Partial<SMSGatewayConfig>) => void;
  sendSingleSMS: (
    phone: string,
    messageText: string,
    recipientName: string,
    meta?: {
      roll?: number;
      className?: string;
      messageType?: SMSLog['messageType'];
      channel?: SMSLog['channel'];
    }
  ) => Promise<{ success: boolean; message: string }>;
  sendBatchSMS: (
    items: {
      phone: string;
      text: string;
      recipientName: string;
      roll?: number;
      className?: string;
    }[],
    messageType: SMSLog['messageType']
  ) => Promise<{ sentCount: number; failedCount: number }>;
  // Attendance Module
  attendanceRecords: Record<string, DailyAttendanceRecord>;
  saveDailyAttendance: (
    classId: string,
    section: string,
    date: string,
    academicYear: string,
    records: Record<string, { status: AttendanceStatus; remarks?: string }>
  ) => void;
  markStudentAttendanceFromScan: (
    student: Pick<Student, 'id' | 'classId' | 'section' | 'academicYear'>,
    action: 'entry' | 'exit',
    timestampIso?: string
  ) => { date: string; classId: string; section: string };
  upsertAttendanceRecordFromServer: (
    record: DailyAttendanceRecord,
    options?: { suppressAutoPush?: boolean }
  ) => void;
  getDailyAttendance: (classId: string, section: string, date: string) => DailyAttendanceRecord | undefined;
  getMonthlyAttendance: (
    classId: string,
    section: string,
    year: string,
    month: number
  ) => {
    daysInMonth: number[];
    recordsByDate: Record<string, DailyAttendanceRecord>;
    summaries: StudentAttendanceSummary[];
    classAveragePercentage: number;
    totalWorkingDays: number;
  };
  calculateStudentAttendanceMetrics: (
    studentId: string,
    classId: string,
    academicYear: string
  ) => {
    totalWorkingDays: number;
    presentDays: number;
    absentDays: number;
    lateDays: number;
    leaveDays: number;
    percentage: number;
  };
  syncAttendanceToExamRecords: (
    classId: string,
    examId: string,
    academicYear: string,
    workingDaysOverride?: number
  ) => { updatedCount: number };
  // Academic Calendar Module
  calendarEvents: AcademicCalendarEvent[];
  addCalendarEvent: (event: Omit<AcademicCalendarEvent, 'id'>) => AcademicCalendarEvent;
  updateCalendarEvent: (event: AcademicCalendarEvent) => void;
  deleteCalendarEvent: (eventId: string) => void;
  resetCalendarEvents: () => void;
  // Student Fees, Dues & Receipts Module
  feeHeads: FeeHead[];
  updateFeeHeads: (heads: FeeHead[]) => void;
  feeInvoices: FeeInvoice[];
  createFeeInvoice: (invoice: Omit<FeeInvoice, 'id' | 'createdAt' | 'dueAmount' | 'status'> & { id?: string }) => FeeInvoice;
  updateFeeInvoice: (invoice: FeeInvoice) => void;
  deleteFeeInvoice: (id: string) => void;
  generateClassMonthlyBill: (params: {
    classId: string;
    section?: string;
    academicYear: string;
    title: string;
    billMonthYear: string;
    headIds: string[];
    dueDate: string;
    customFine?: number;
  }) => { createdCount: number };
  feeReceipts: PaymentRecord[];
  collectFeePayment: (params: {
    studentId: string;
    invoiceId?: string;
    paidAmount: number;
    paymentMethod: PaymentMethod;
    transactionRef?: string;
    collectedBy: string;
    notes?: string;
    itemsBreakdown?: { nameBn: string; amount: number }[];
  }) => PaymentRecord;
  deletePaymentReceipt: (id: string) => void;
  getStudentDueSummary: (studentId: string) => StudentDueSummary | null;
  getClassDueOverview: (
    classId: string,
    section?: string
  ) => {
    totalBilled: number;
    totalCollected: number;
    totalDue: number;
    collectionRate: number;
    studentCount: number;
    dueStudentCount: number;
  };
  // Digital Security & Gatepass Module
  securityLogs: SecurityGatepassLog[];
  addSecurityLog: (
    log: Omit<SecurityGatepassLog, 'id' | 'timestamp'> & { id?: string; timestamp?: string },
    options?: { suppressAutoPush?: boolean }
  ) => SecurityGatepassLog;
  updateSecurityLogEtiquette: (logId: string, replyText: string) => Promise<void>;
  acknowledgeSecurityLog: (
    logId: string,
    guardianResponse: string,
    acknowledgedBy?: string
  ) => Promise<void>;
  clearSecurityLogs: () => void;
  clearAllStudents: () => Promise<void>;
  scanAndRecoverBrowserData: () => Promise<{ studentCount: number; recoveredPhotoCount?: number; message: string }>;
  verifyAndRepairPhotoIntegrity: () => Promise<PhotoIntegrityReport>;
  // Multi-Device Server Synchronization
  isServerSyncing: boolean;
  serverSyncStatus: 'synced' | 'syncing' | 'offline' | 'error';
  syncErrorMessage: string | null;
  lastSyncedTime: string;
  forceServerSync: () => Promise<void>;
  seedParentDetailsForClass: (classId: string) => number;
  // Real-time Firebase Cloud Sync (works across Vercel, PC & mobile PWA)
  cloudUser: User | null;
  cloudSyncError: string | null;
  cloudUnauthorizedDomain: string | null;
  isCloudPhotoSyncing: boolean;
  cloudPhotoSyncProgress: { done: number; total: number } | null;
  connectCloudSync: () => Promise<boolean>;
  disconnectCloudSync: () => Promise<void>;
  syncAllPhotosToCloud: () => Promise<{ ok: boolean; pushedCount: number; pulledCount: number; message: string }>;
  broadcastSecurityLogToCloud: (log: SecurityGatepassLog) => Promise<void>;
}

const STORAGE_KEY = 'dlikon_academy_db_v1';

const SchoolContext = createContext<SchoolContextType | undefined>(undefined);

export const SchoolProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load saved state or default
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_info`);
      return saved ? JSON.parse(saved) : DEFAULT_SCHOOL_INFO;
    } catch {
      return DEFAULT_SCHOOL_INFO;
    }
  });

  const [classes, setClasses] = useState<SchoolClass[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_classes`);
      return saved ? JSON.parse(saved) : DEFAULT_CLASSES;
    } catch {
      return DEFAULT_CLASSES;
    }
  });

  const [examTerms] = useState<ExamTerm[]>(DEFAULT_EXAM_TERMS);

  const [students, setStudents] = useState<Student[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_students`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleaned = parsed.filter((s: Student) => !['std_4_01', 'std_4_02', 'std_4_03', 'std_4_04', 'std_4_05'].includes(s.id));
          if (cleaned.length > 0) return cleaned;
        }
      }
      return INITIAL_STUDENTS;
    } catch {
      return INITIAL_STUDENTS;
    }
  });

  const [examRecords, setExamRecords] = useState<Record<string, StudentExamRecord>>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_exam_records`);
      if (saved) {
        const parsed = JSON.parse(saved);
        const cleaned: Record<string, StudentExamRecord> = {};
        Object.entries(parsed).forEach(([k, v]: [string, any]) => {
          if (v && v.studentId && !['std_4_01', 'std_4_02', 'std_4_03', 'std_4_04', 'std_4_05'].includes(v.studentId)) {
            cleaned[k] = v;
          }
        });
        return cleaned;
      }
      return {};
    } catch {
      return {};
    }
  });

  const [syllabi, setSyllabi] = useState<SyllabusItem[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_syllabi`);
      return saved ? JSON.parse(saved) : INITIAL_SYLLABI;
    } catch {
      return INITIAL_SYLLABI;
    }
  });

  const [notes, setNotes] = useState<StudyNote[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_notes`);
      return saved ? JSON.parse(saved) : INITIAL_NOTES;
    } catch {
      return INITIAL_NOTES;
    }
  });

  const [questionPapers, setQuestionPapers] = useState<QuestionPaper[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_question_papers`);
      return saved ? JSON.parse(saved) : INITIAL_QUESTION_PAPERS;
    } catch {
      return INITIAL_QUESTION_PAPERS;
    }
  });

  const [libraryMaterials, setLibraryMaterials] = useState<LibraryMaterial[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_library_materials`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      return INITIAL_LIBRARY_MATERIALS;
    } catch {
      return INITIAL_LIBRARY_MATERIALS;
    }
  });

  const [smsLogs, setSmsLogs] = useState<SMSLog[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_sms_logs`);
      return saved ? JSON.parse(saved) : [
        {
          id: 'sms_log_1',
          recipientPhone: '01712345678',
          recipientName: 'আফরিন জাহান নুহা (অভিভাবক)',
          studentRoll: 1,
          className: 'চতুর্থ শ্রেণি',
          messageType: 'result',
          messageText: 'ডি-লিকন মডেল একাডেমী: প্রিয় অভিভাবক, আপনার সন্তান আফরিন জাহান নুহা (রোল: ০১, ৪র্থ শ্রেণি), ২য় সাময়িক পরীক্ষা ২০২৬-এ মোট নম্বর: ৫৭৩/৬০০, GPA: 5.00 (গ্রেড: A+), মেধাক্রম: ১ম (উত্তীর্ণ)। বিস্তারিত প্রোগ্রেস কার্ড স্কুলে সংরক্ষিত। - প্রধান শিক্ষক।',
          sentAt: '2026-09-23 11:30 AM',
          status: 'delivered',
          channel: 'device_sms',
        },
        {
          id: 'sms_log_2',
          recipientPhone: '01812345679',
          recipientName: 'তানভীর আহমেদ মাহিন (অভিভাবক)',
          studentRoll: 2,
          className: 'চতুর্থ শ্রেণি',
          messageType: 'result',
          messageText: 'ডি-লিকন মডেল একাডেমী: প্রিয় অভিভাবক, আপনার সন্তান তানভীর আহমেদ মাহিন (রোল: ০২, ৪র্থ শ্রেণি), ২য় সাময়িক পরীক্ষা ২০২৬-এ মোট নম্বর: ৫৫৪/৬০০, GPA: 5.00 (গ্রেড: A+), মেধাক্রম: ২য় (উত্তীর্ণ)। বিস্তারিত প্রোগ্রেস কার্ড স্কুলে সংরক্ষিত। - প্রধান শিক্ষক।',
          sentAt: '2026-09-23 11:32 AM',
          status: 'delivered',
          channel: 'device_sms',
        },
      ];
    } catch {
      return [];
    }
  });

  const [smsGatewayConfig, setSmsGatewayConfig] = useState<SMSGatewayConfig>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_sms_config`);
      return saved ? JSON.parse(saved) : {
        provider: 'device_sms',
        senderId: 'DLIKON_MA',
        apiKey: '',
        webhookUrl: '',
        balance: 250,
        autoLog: true,
      };
    } catch {
      return {
        provider: 'device_sms',
        senderId: 'DLIKON_MA',
        apiKey: '',
        webhookUrl: '',
        balance: 250,
        autoLog: true,
      };
    }
  });

  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, DailyAttendanceRecord>>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_attendance`);
      return saved ? JSON.parse(saved) : INITIAL_ATTENDANCE_RECORDS;
    } catch {
      return INITIAL_ATTENDANCE_RECORDS;
    }
  });

  const [calendarEvents, setCalendarEvents] = useState<AcademicCalendarEvent[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_calendar_events`);
      return saved ? JSON.parse(saved) : INITIAL_CALENDAR_EVENTS;
    } catch {
      return INITIAL_CALENDAR_EVENTS;
    }
  });

  // Student Fees, Invoices & Receipts State
  const [feeHeads, setFeeHeads] = useState<FeeHead[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_fee_heads`);
      return saved ? JSON.parse(saved) : DEFAULT_FEE_HEADS;
    } catch {
      return DEFAULT_FEE_HEADS;
    }
  });

  const [feeInvoices, setFeeInvoices] = useState<FeeInvoice[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_fee_invoices`);
      return saved ? JSON.parse(saved) : INITIAL_FEE_INVOICES;
    } catch {
      return INITIAL_FEE_INVOICES;
    }
  });

  const [feeReceipts, setFeeReceipts] = useState<PaymentRecord[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_fee_receipts`);
      return saved ? JSON.parse(saved) : INITIAL_PAYMENT_RECEIPTS;
    } catch {
      return INITIAL_PAYMENT_RECEIPTS;
    }
  });

  const [securityLogs, setSecurityLogs] = useState<SecurityGatepassLog[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_security_logs`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Global Filter selections
  const [selectedYear, setSelectedYear] = useState<string>('২০২৬');
  const [selectedExamId, setSelectedExamId] = useState<string>('term_2');
  const [selectedClassId, setSelectedClassId] = useState<string>('class_4');
  const [selectedSection, setSelectedSection] = useState<string>('ক');

  // Persistence effects
  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_fee_heads`, JSON.stringify(feeHeads));
    } catch (e) {
      console.error('Failed to save fee heads', e);
    }
  }, [feeHeads]);

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_fee_invoices`, JSON.stringify(feeInvoices));
    } catch (e) {
      console.error('Failed to save fee invoices', e);
    }
  }, [feeInvoices]);

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_fee_receipts`, JSON.stringify(feeReceipts));
    } catch (e) {
      console.error('Failed to save fee receipts', e);
    }
  }, [feeReceipts]);

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_calendar_events`, JSON.stringify(calendarEvents));
    } catch (e) {
      console.error('Failed to save calendar events', e);
    }
  }, [calendarEvents]);

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_attendance`, JSON.stringify(attendanceRecords));
    } catch (e) {
      console.error('Failed to save attendance records', e);
    }
  }, [attendanceRecords]);

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_sms_logs`, JSON.stringify(smsLogs));
    } catch (e) {
      console.error('Failed to save sms logs', e);
    }
  }, [smsLogs]);

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_sms_config`, JSON.stringify(smsGatewayConfig));
    } catch (e) {
      console.error('Failed to save sms config', e);
    }
  }, [smsGatewayConfig]);

  // Persistence effects
  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_info`, JSON.stringify(schoolInfo));
    } catch (e) {
      console.error('Failed to save school info', e);
    }
  }, [schoolInfo]);

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_classes`, JSON.stringify(classes));
    } catch (e) {
      console.error('Failed to save classes', e);
    }
  }, [classes]);

  const [isIdbInitialized, setIsIdbInitialized] = useState(false);
  const [isServerSyncing, setIsServerSyncing] = useState<boolean>(false);
  const [serverSyncStatus, setServerSyncStatus] = useState<'synced' | 'syncing' | 'offline' | 'error'>('syncing');
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>('');
  const lastSyncTimestampRef = useRef<number>(0);
  const isInitialServerLoadDone = useRef<boolean>(false);
  const suppressNextAutoPushRef = useRef<boolean>(false);
  const isPushingRef = useRef<boolean>(false);
  const hasAutoSyncedCloudSessionRef = useRef<string | null>(null);
  // Track confirmed server photo signatures & in-flight local uploads so background polls never wipe Class 1-8 photos
  const syncedServerPhotoSigRef = useRef<Map<string, string>>(new Map());
  const recentLocalPhotoUploadsRef = useRef<
    Map<
      string,
      {
        avatarUrl?: string;
        fatherAvatarUrl?: string;
        motherAvatarUrl?: string;
        photoUpdatedAt: string;
        updatedAtMs: number;
        explicitlyCleared?: { avatarUrl?: boolean; fatherAvatarUrl?: boolean; motherAvatarUrl?: boolean };
      }
    >
  >(new Map());
  const inFlightPhotoSyncCountRef = useRef<number>(0);
  const lastLocalPhotoMutationTimeRef = useRef<number>(0);
  const studentPhotoMapRef = useRef<Record<string, StudentPhotoRegistryEntry>>({});

  const [cloudUser, setCloudUser] = useState<User | null>(null);
  const [cloudSyncError, setCloudSyncError] = useState<string | null>(null);
  const [cloudUnauthorizedDomain, setCloudUnauthorizedDomain] = useState<string | null>(null);
  const [isCloudPhotoSyncing, setIsCloudPhotoSyncing] = useState<boolean>(false);
  const [cloudPhotoSyncProgress, setCloudPhotoSyncProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCloudUser(user);
      if (user) {
        setCloudSyncError(null);
        setCloudUnauthorizedDomain(null);
      } else {
        hasAutoSyncedCloudSessionRef.current = null;
      }
    });
    return () => unsub();
  }, []);

  const mergeCloudStudentPhotos = useCallback((cloudRecords: Partial<Student>[]): { pulledCount: number; mergedList: Student[]; pulledStudents: Student[] } => {
    if (!cloudRecords || cloudRecords.length === 0) {
      return { pulledCount: 0, mergedList: latestStateRef.current.students, pulledStudents: [] };
    }
    const cloudMap = new Map<string, Partial<Student>>();
    for (const cr of cloudRecords) {
      if (cr && cr.id) cloudMap.set(cr.id, cr);
    }

    let pulledCount = 0;
    const pulledStudents: Student[] = [];
    const currentList = latestStateRef.current.students;
    const mergedList = currentList.map((localStd) => {
      const cloudStd = cloudMap.get(localStd.id);
      if (!cloudStd) return localStd;

      const localTime = new Date(localStd.photoUpdatedAt || 0).getTime() || 0;
      const cloudTime = new Date(cloudStd.photoUpdatedAt || 0).getTime() || 0;

      const pickPhoto = (localVal?: string, cloudVal?: string) => {
        const lValid = isValidImageReference(localVal) ? localVal.trim() : '';
        const cValid = isValidImageReference(cloudVal) ? cloudVal.trim() : '';
        if (!lValid && cValid) return cValid;
        if (cValid && cloudTime > localTime) return cValid;
        return lValid || '';
      };

      const nextAvatar = pickPhoto(localStd.avatarUrl, cloudStd.avatarUrl);
      const nextFather = pickPhoto(localStd.fatherAvatarUrl, cloudStd.fatherAvatarUrl);
      const nextMother = pickPhoto(localStd.motherAvatarUrl, cloudStd.motherAvatarUrl);

      const changed =
        nextAvatar !== (localStd.avatarUrl || '') ||
        nextFather !== (localStd.fatherAvatarUrl || '') ||
        nextMother !== (localStd.motherAvatarUrl || '');

      if (!changed) return localStd;
      pulledCount++;
      const mergedStd: Student = {
        ...localStd,
        avatarUrl: nextAvatar,
        fatherAvatarUrl: nextFather,
        motherAvatarUrl: nextMother,
        photoUpdatedAt:
          cloudTime > localTime
            ? cloudStd.photoUpdatedAt
            : localStd.photoUpdatedAt || cloudStd.photoUpdatedAt,
      };
      pulledStudents.push(mergedStd);
      return mergedStd;
    });

    if (pulledCount > 0) {
      setStudents(mergedList);
      idbSet(`${STORAGE_KEY}_students`, mergedList);
      const nextMap: Record<string, StudentPhotoRegistryEntry> = { ...studentPhotoMapRef.current };
      const nowIso = new Date().toISOString();
      for (const ps of mergedList) {
        if (ps && ps.id && (isValidImageReference(ps.avatarUrl) || isValidImageReference(ps.fatherAvatarUrl) || isValidImageReference(ps.motherAvatarUrl))) {
          nextMap[ps.id] = {
            studentId: ps.id,
            classId: ps.classId,
            roll: ps.roll,
            section: ps.section,
            nameBn: ps.nameBn,
            ...(isValidImageReference(ps.avatarUrl) ? { avatarUrl: ps.avatarUrl } : {}),
            ...(isValidImageReference(ps.fatherAvatarUrl) ? { fatherAvatarUrl: ps.fatherAvatarUrl } : {}),
            ...(isValidImageReference(ps.motherAvatarUrl) ? { motherAvatarUrl: ps.motherAvatarUrl } : {}),
            photoUpdatedAt: ps.photoUpdatedAt || nowIso,
            updatedAt: nowIso,
          };
        }
      }
      studentPhotoMapRef.current = nextMap;
      idbSet(`${STORAGE_KEY}_student_photos_map`, nextMap);
    }

    return { pulledCount, mergedList, pulledStudents };
  }, []);

  const syncAllPhotosToCloudWithUser = useCallback(
    async (
      targetUser: User | null
    ): Promise<{ ok: boolean; pushedCount: number; pulledCount: number; message: string }> => {
      if (!targetUser || !targetUser.emailVerified) {
        return {
          ok: false,
          pushedCount: 0,
          pulledCount: 0,
          message: 'প্রথমে উপরের "ক্লাউড সিঙ্ক চালু" বাটনে ক্লিক করে গুগল অ্যাকাউন্ট দিয়ে সাইন ইন করুন।',
        };
      }

      setIsCloudPhotoSyncing(true);
      setCloudSyncError(null);
      try {
        await ensureSchoolDocument(targetUser, latestStateRef.current.schoolInfo);

        // Step 1: Pull any photos already saved in Firestore so we don't lose other devices' uploads
        let pulledCount = 0;
        let workingStudents = latestStateRef.current.students;
        try {
          const cloudRecords = await pullStudentsFromFirestore(targetUser);
          const mergedRes = mergeCloudStudentPhotos(cloudRecords);
          pulledCount = mergedRes.pulledCount;
          workingStudents = mergedRes.mergedList;
          if (mergedRes.pulledStudents.length > 0) {
            for (let i = 0; i < mergedRes.pulledStudents.length; i += 8) {
              const chunk = mergedRes.pulledStudents.slice(i, i + 8).map((s) => ({
                id: s.id,
                avatarUrl: s.avatarUrl || '',
                fatherAvatarUrl: s.fatherAvatarUrl || '',
                motherAvatarUrl: s.motherAvatarUrl || '',
                photoUpdatedAt: s.photoUpdatedAt || new Date().toISOString(),
                studentRecord: s,
              }));
              await fetch('/api/students/batch-photos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: chunk }),
              }).catch(() => {});
            }
          }
        } catch (pullErr) {
          console.warn('Firestore pull warning (proceeding with push):', pullErr);
        }

        // Step 2: Push all student records + photos to Firestore in safe chunks of 10
        const { pushedCount, failedCount } = await batchPushStudentsToFirestore(
          workingStudents,
          targetUser,
          latestStateRef.current.schoolInfo,
          (done, total) => setCloudPhotoSyncProgress({ done, total })
        );

        setCloudPhotoSyncProgress(null);
        setLastSyncedTime(
          new Date().toLocaleTimeString('bn-BD', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        );

        const photoTotal = workingStudents.filter(
          (s) => Boolean(s.avatarUrl || s.fatherAvatarUrl || s.motherAvatarUrl)
        ).length;

        return {
          ok: failedCount === 0,
          pushedCount,
          pulledCount,
          message: `✓ ক্লাউডে ${toBengaliNumber(pushedCount)} জন শিক্ষার্থীর তথ্য (${toBengaliNumber(photoTotal)}টি ছবিসহ) স্থায়ীভাবে সংরক্ষিত হয়েছে${pulledCount > 0 ? ` এবং ${toBengaliNumber(pulledCount)}টি ছবি ক্লাউড থেকে পুনরুদ্ধার হয়েছে` : ''}।`,
        };
      } catch (err: any) {
        const msg = err?.message || 'ক্লাউডে ছবি সিঙ্ক করতে সমস্যা হয়েছে।';
        setCloudSyncError(msg);
        return { ok: false, pushedCount: 0, pulledCount: 0, message: msg };
      } finally {
        setIsCloudPhotoSyncing(false);
        setCloudPhotoSyncProgress(null);
      }
    },
    [mergeCloudStudentPhotos]
  );

  const syncAllPhotosToCloud = useCallback(async () => {
    return syncAllPhotosToCloudWithUser(cloudUser);
  }, [cloudUser, syncAllPhotosToCloudWithUser]);

  useEffect(() => {
    if (!cloudUser || !cloudUser.emailVerified) return;
    ensureSchoolDocument(cloudUser, latestStateRef.current.schoolInfo).catch(() => {});

    // Automatically run 2-way student & photo sync once per verified sign-in
    if (hasAutoSyncedCloudSessionRef.current !== cloudUser.uid) {
      hasAutoSyncedCloudSessionRef.current = cloudUser.uid;
      syncAllPhotosToCloudWithUser(cloudUser).catch(() => {});
      pullLibraryMaterialsFromFirestore(cloudUser)
        .then((cloudMats) => {
          if (cloudMats.length === 0) return;
          setLibraryMaterials((prev) => {
            const merged = new Map<string, LibraryMaterial>();
            for (const item of prev) merged.set(item.id, item);
            for (const cm of cloudMats) {
              const ex = merged.get(cm.id);
              if (!ex || new Date(cm.updatedAt).getTime() > new Date(ex.updatedAt).getTime()) {
                merged.set(cm.id, {
                  ...cm,
                  downloadsCount: Math.max(cm.downloadsCount || 0, ex?.downloadsCount || 0),
                });
              }
            }
            return Array.from(merged.values()).sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
          });
        })
        .catch(() => {});
    }

    const unsub = subscribeCloudSecurityLogs(cloudUser, (cloudLogs) => {
      setServerSyncStatus('synced');
      setLastSyncedTime(
        new Date().toLocaleTimeString('bn-BD', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
      if (cloudLogs.length === 0) return;
      setSecurityLogs((prev) => {
        const mergedMap = new Map<string, SecurityGatepassLog>();
        for (const item of prev) {
          if (item && item.id) mergedMap.set(item.id, item);
        }
        for (const item of cloudLogs) {
          if (item && item.id) {
            const existing = mergedMap.get(item.id);
            if (existing) {
              mergedMap.set(item.id, {
                ...existing,
                ...item,
                portalUserId: item.portalUserId || existing.portalUserId,
                classId: item.classId || existing.classId,
                guardianPhone: existing.guardianPhone || item.guardianPhone,
                guardianAcknowledged: Boolean(existing.guardianAcknowledged || item.guardianAcknowledged),
                acknowledgedAt: item.acknowledgedAt || existing.acknowledgedAt,
                guardianResponse: item.guardianResponse || existing.guardianResponse,
                acknowledgedBy: item.acknowledgedBy || existing.acknowledgedBy,
              });
            } else {
              mergedMap.set(item.id, item);
            }
          }
        }
        return Array.from(mergedMap.values())
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 1000);
      });
    });
    return () => unsub();
  }, [cloudUser, syncAllPhotosToCloudWithUser]);

  const connectCloudSync = useCallback(async (): Promise<boolean> => {
    setCloudSyncError(null);
    setCloudUnauthorizedDomain(null);
    const res = await signInWithGoogleCloudSync();
    if (!res.ok) {
      setCloudSyncError(res.message || 'ক্লাউড সিঙ্ক ব্যর্থ হয়েছে।');
      if (res.unauthorizedDomain) {
        setCloudUnauthorizedDomain(res.unauthorizedDomain);
      }
      return false;
    }
    if (res.user) {
      await ensureSchoolDocument(res.user, latestStateRef.current.schoolInfo).catch(() => {});
      hasAutoSyncedCloudSessionRef.current = res.user.uid;
      await syncAllPhotosToCloudWithUser(res.user).catch(() => {});
    }
    return true;
  }, [syncAllPhotosToCloudWithUser]);

  const disconnectCloudSync = useCallback(async (): Promise<void> => {
    hasAutoSyncedCloudSessionRef.current = null;
    await signOutCloudSync();
  }, []);

  // Keep a reference to latest state so pushToServer doesn't need to recreate on every render
  const latestStateRef = useRef({
    schoolInfo,
    classes,
    students,
    examRecords,
    syllabi,
    notes,
    questionPapers,
    libraryMaterials,
    smsLogs,
    smsGatewayConfig,
    attendanceRecords,
    calendarEvents,
    feeHeads,
    feeInvoices,
    feeReceipts,
    securityLogs,
  });

  useEffect(() => {
    latestStateRef.current = {
      schoolInfo,
      classes,
      students,
      examRecords,
      syllabi,
      notes,
      questionPapers,
      libraryMaterials,
      smsLogs,
      smsGatewayConfig,
      attendanceRecords,
      calendarEvents,
      feeHeads,
      feeInvoices,
      feeReceipts,
      securityLogs,
    };
  });

  const getStudentPhotoSig = (s?: Partial<Student> | null): string => {
    if (!s) return '0:0:0:';
    return `${s.avatarUrl?.length || 0}:${s.fatherAvatarUrl?.length || 0}:${s.motherAvatarUrl?.length || 0}:${s.photoUpdatedAt || ''}`;
  };

  const persistStudentPhotoMapToIdb = useCallback((studentList: Student[]) => {
    // Keep previously known registry entries (e.g. during replace imports) while updating live student photos
    const mapObj: Record<string, StudentPhotoRegistryEntry> = { ...studentPhotoMapRef.current };
    const nowIso = new Date().toISOString();
    for (const s of studentList) {
      if (!s || !s.id) continue;
      const validAvatar = isValidImageReference(s.avatarUrl) ? s.avatarUrl : '';
      const validFather = isValidImageReference(s.fatherAvatarUrl) ? s.fatherAvatarUrl : '';
      const validMother = isValidImageReference(s.motherAvatarUrl) ? s.motherAvatarUrl : '';
      if (validAvatar || validFather || validMother) {
        mapObj[s.id] = {
          studentId: s.id,
          classId: s.classId,
          roll: s.roll,
          section: s.section,
          nameBn: s.nameBn,
          ...(validAvatar ? { avatarUrl: validAvatar } : {}),
          ...(validFather ? { fatherAvatarUrl: validFather } : {}),
          ...(validMother ? { motherAvatarUrl: validMother } : {}),
          ...(s.photoUpdatedAt ? { photoUpdatedAt: s.photoUpdatedAt } : {}),
          updatedAt: nowIso,
        };
      } else if (mapObj[s.id]) {
        // Check if explicitly cleared right now by recentLocalPhotoUploadsRef
        const recent = recentLocalPhotoUploadsRef.current.get(s.id);
        if (recent?.explicitlyCleared?.avatarUrl && recent?.explicitlyCleared?.fatherAvatarUrl && recent?.explicitlyCleared?.motherAvatarUrl) {
          delete mapObj[s.id];
        }
      }
    }
    studentPhotoMapRef.current = mapObj;
    idbSet(`${STORAGE_KEY}_student_photos_map`, mapObj);
  }, []);

  // Helper: upload student photos in safe 8-student chunks so proxy payload limits never cause silent failures
  const pushPhotosInChunks = useCallback(async (targetStudents: Student[]): Promise<boolean> => {
    const items = targetStudents
      .filter((s) => Boolean(s.avatarUrl || s.fatherAvatarUrl || s.motherAvatarUrl || s.photoUpdatedAt))
      .map((s) => ({
        id: s.id,
        avatarUrl: s.avatarUrl || '',
        fatherAvatarUrl: s.fatherAvatarUrl || '',
        motherAvatarUrl: s.motherAvatarUrl || '',
        photoUpdatedAt: s.photoUpdatedAt || new Date().toISOString(),
        studentRecord: s,
      }));

    if (items.length === 0) return true;

    const CHUNK_SIZE = 8;
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      const chunk = items.slice(i, i + CHUNK_SIZE);
      const res = await fetch('/api/students/batch-photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: chunk }),
      });
      if (!res.ok) {
        return false;
      }
      for (const ch of chunk) {
        syncedServerPhotoSigRef.current.set(ch.id, getStudentPhotoSig(ch));
      }
    }
    return true;
  }, []);

  // Push latest application data to central full-stack server with dirty-photo tracking & chunked fallback
  const pushToServer = useCallback(async () => {
    if (isPushingRef.current) return;
    isPushingRef.current = true;
    try {
      setIsServerSyncing(true);
      const payload = latestStateRef.current;

      // Determine only students whose photos haven't yet been confirmed on server
      const dirtyPhotoStudents = payload.students.filter((s) => {
        const hasAnyPhoto = Boolean(s.avatarUrl || s.fatherAvatarUrl || s.motherAvatarUrl);
        if (!hasAnyPhoto) return false;
        const confirmedSig = syncedServerPhotoSigRef.current.get(s.id);
        return confirmedSig !== getStudentPhotoSig(s);
      });

      let coreOk = false;
      let photosSynced = true;

      const serialized = JSON.stringify(payload);
      if (serialized.length <= 900_000) {
        const res = await fetch('/api/school-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: serialized,
        });
        coreOk = res.ok;
        if (coreOk) {
          for (const s of payload.students) {
            if (s.avatarUrl || s.fatherAvatarUrl || s.motherAvatarUrl) {
              syncedServerPhotoSigRef.current.set(s.id, getStudentPhotoSig(s));
            }
          }
        }
      }

      if (!coreOk) {
        // Send compact metadata payload (server preserves existing confirmed photos via _photosStripped)
        const lightweightPayload = {
          ...payload,
          students: payload.students.map((s) => ({
            ...s,
            avatarUrl: '',
            fatherAvatarUrl: '',
            motherAvatarUrl: '',
            _photosStripped: true,
          })),
        };
        const coreRes = await fetch('/api/school-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(lightweightPayload),
        });
        coreOk = coreRes.ok;
        if (coreOk && dirtyPhotoStudents.length > 0) {
          photosSynced = await pushPhotosInChunks(dirtyPhotoStudents);
        }
      }

      if (coreOk && photosSynced) {
        setServerSyncStatus('synced');
        setSyncErrorMessage(null);
        setLastSyncedTime(
          new Date().toLocaleTimeString('bn-BD', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        );
        lastSyncTimestampRef.current = Date.now();
      } else {
        setServerSyncStatus('error');
        setSyncErrorMessage('সার্ভারে সম্পূর্ণ ডেটা/ছবি সেভ হতে সমস্যা হয়েছে। পুনরায় চেষ্টা করুন।');
      }
    } catch (e: any) {
      console.warn('Could not push to server database:', e);
      setServerSyncStatus('offline');
      setSyncErrorMessage(e?.message || 'সার্ভার সংযোগ পাওয়া যাচ্ছে না।');
    } finally {
      setIsServerSyncing(false);
      isPushingRef.current = false;
    }
  }, [pushPhotosInChunks]);

  // Pull latest data from central server across all PCs/smartphones without overwriting local unsynced photos
  const fetchFromServer = useCallback(
    async (options?: { force?: boolean }) => {
      if (isPushingRef.current) return;
      if (
        !options?.force &&
        (inFlightPhotoSyncCountRef.current > 0 ||
          Date.now() - lastLocalPhotoMutationTimeRef.current < 4000)
      ) {
        return;
      }

      try {
        setIsServerSyncing(true);
        const res = await fetch('/api/school-data', { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (json.exists && json.data) {
            const db = json.data;
            const localPhotosMissingOnServer: Student[] = [];
            let anySliceChanged = false;

            if (Array.isArray(db.students)) {
              const cleanedStudents: Student[] = db.students.filter(
                (s: Student) => !['std_4_01', 'std_4_02', 'std_4_03', 'std_4_04', 'std_4_05'].includes(s.id)
              );

              // Record confirmed server photo signatures
              for (const srvStd of cleanedStudents) {
                if (srvStd && srvStd.id && (srvStd.avatarUrl || srvStd.fatherAvatarUrl || srvStd.motherAvatarUrl)) {
                  syncedServerPhotoSigRef.current.set(srvStd.id, getStudentPhotoSig(srvStd));
                }
              }

              const currentSnapshot = latestStateRef.current.students;
              if (cleanedStudents.length === 0 && currentSnapshot.length > 0) {
                console.warn('[Sync Safeguard] Server is empty but client has data. Pushing client data to server.');
                setTimeout(() => pushToServer(), 500);
              } else {
                const mergeServerWithPrev = (prev: Student[]): { merged: Student[]; changed: boolean; missingOnSrv: Student[] } => {
                  if (prev.length === 0 && cleanedStudents.length === 0) {
                    return { merged: prev, changed: false, missingOnSrv: [] };
                  }
                  const prevMap = new Map<string, Student>();
                  for (const p of prev) {
                    if (p && p.id) prevMap.set(p.id, p);
                  }

                  const nowMs = Date.now();
                  const missingList: Student[] = [];
                  const seenServerIds = new Set<string>();

                  const mergedStudents: Student[] = cleanedStudents.map((srvStd: Student) => {
                    seenServerIds.add(srvStd.id);
                    const prevStd = prevMap.get(srvStd.id);
                    const recentGuard = recentLocalPhotoUploadsRef.current.get(srvStd.id);
                    const guardActive = Boolean(recentGuard && nowMs - recentGuard.updatedAtMs < 20_000);

                    if (!prevStd && !guardActive) return srvStd;

                    const effectivePrev = prevStd || ({} as Student);
                    const prevPhotoTime = new Date(
                      guardActive && recentGuard ? recentGuard.photoUpdatedAt : effectivePrev.photoUpdatedAt || 0
                    ).getTime();
                    const srvPhotoTime = new Date(srvStd.photoUpdatedAt || 0).getTime();

                    const mergePhoto = (
                      field: 'avatarUrl' | 'fatherAvatarUrl' | 'motherAvatarUrl',
                      prevVal?: string,
                      srvVal?: string
                    ) => {
                      const guardVal = guardActive && recentGuard ? recentGuard[field] : undefined;
                      const wasExplicitClear = Boolean(guardActive && recentGuard?.explicitlyCleared?.[field]);
                      const p = guardVal !== undefined ? guardVal : prevVal || '';
                      const s = srvVal || '';

                      if (wasExplicitClear && prevPhotoTime >= srvPhotoTime) return '';
                      if (guardActive && p && !s) return p;
                      if (p && !s && prevPhotoTime >= srvPhotoTime) return p;
                      if (s && !p && srvPhotoTime >= prevPhotoTime) return s;
                      if (p && s) return srvPhotoTime > prevPhotoTime ? s : p;
                      return s || p;
                    };

                    const nextAvatar = mergePhoto('avatarUrl', effectivePrev.avatarUrl, srvStd.avatarUrl);
                    const nextFather = mergePhoto('fatherAvatarUrl', effectivePrev.fatherAvatarUrl, srvStd.fatherAvatarUrl);
                    const nextMother = mergePhoto('motherAvatarUrl', effectivePrev.motherAvatarUrl, srvStd.motherAvatarUrl);
                    const nextPhotoUpdatedAt =
                      srvPhotoTime > prevPhotoTime
                        ? srvStd.photoUpdatedAt
                        : (guardActive && recentGuard?.photoUpdatedAt) || effectivePrev.photoUpdatedAt || srvStd.photoUpdatedAt;

                    const serverMissedLocalPhoto =
                      (Boolean(nextAvatar) && !srvStd.avatarUrl) ||
                      (Boolean(nextFather) && !srvStd.fatherAvatarUrl) ||
                      (Boolean(nextMother) && !srvStd.motherAvatarUrl) ||
                      (guardActive && prevPhotoTime > srvPhotoTime && (nextAvatar !== (srvStd.avatarUrl || '') || nextFather !== (srvStd.fatherAvatarUrl || '') || nextMother !== (srvStd.motherAvatarUrl || '')));

                    const resultStd: Student = {
                      ...srvStd,
                      avatarUrl: nextAvatar,
                      fatherAvatarUrl: nextFather,
                      motherAvatarUrl: nextMother,
                      ...(nextPhotoUpdatedAt ? { photoUpdatedAt: nextPhotoUpdatedAt } : {}),
                    };

                    if (serverMissedLocalPhoto) {
                      missingList.push(resultStd);
                    }
                    return resultStd;
                  });

                  // Preserve recently protected local students that server doesn't have yet
                  for (const p of prev) {
                    if (p && p.id && !seenServerIds.has(p.id) && recentLocalPhotoUploadsRef.current.has(p.id)) {
                      mergedStudents.push(p);
                      missingList.push(p);
                    }
                  }

                  const isUnchanged =
                    prev.length === mergedStudents.length &&
                    prev.every((p, idx) => {
                      const m = mergedStudents[idx];
                      if (!m) return false;
                      return (
                        p.id === m.id &&
                        p.nameBn === m.nameBn &&
                        p.roll === m.roll &&
                        p.classId === m.classId &&
                        p.section === m.section &&
                        (p.avatarUrl || '') === (m.avatarUrl || '') &&
                        (p.fatherAvatarUrl || '') === (m.fatherAvatarUrl || '') &&
                        (p.motherAvatarUrl || '') === (m.motherAvatarUrl || '') &&
                        (p.photoUpdatedAt || '') === (m.photoUpdatedAt || '') &&
                        (p.guardianPhone || '') === (m.guardianPhone || '') &&
                        (p.portalUserId || '') === (m.portalUserId || '') &&
                        (p.monerBari?.updatedAt || '') === (m.monerBari?.updatedAt || '') &&
                        (p.timeManagement?.updatedAt || '') === (m.timeManagement?.updatedAt || '') &&
                        (p.academicRoadmap?.updatedAt || '') === (m.academicRoadmap?.updatedAt || '')
                      );
                    });

                  return { merged: mergedStudents, changed: !isUnchanged, missingOnSrv: missingList };
                };

                const preCheck = mergeServerWithPrev(currentSnapshot);
                if (preCheck.changed) {
                  anySliceChanged = true;
                  suppressNextAutoPushRef.current = true;
                  setStudents((prev) => {
                    const resMerge = mergeServerWithPrev(prev);
                    if (!resMerge.changed) return prev;
                    idbSet(`${STORAGE_KEY}_students`, resMerge.merged);
                    persistStudentPhotoMapToIdb(resMerge.merged);
                    return resMerge.merged;
                  });
                }
                if (preCheck.missingOnSrv.length > 0) {
                  localPhotosMissingOnServer.push(...preCheck.missingOnSrv);
                }
              }

              if (localPhotosMissingOnServer.length > 0) {
                setTimeout(() => {
                  pushPhotosInChunks(localPhotosMissingOnServer).catch(() => {});
                }, 300);
              }
            }

            if (Array.isArray(db.classes) && db.classes.length > 0) {
              if (JSON.stringify(latestStateRef.current.classes) !== JSON.stringify(db.classes)) {
                anySliceChanged = true;
                suppressNextAutoPushRef.current = true;
                setClasses(db.classes);
              }
            }

            if (db.schoolInfo && db.schoolInfo.name) {
              const curInfo = latestStateRef.current.schoolInfo;
              if (
                curInfo.name !== db.schoolInfo.name ||
                curInfo.address !== db.schoolInfo.address ||
                curInfo.logoUrl !== db.schoolInfo.logoUrl ||
                curInfo.principalSignatureUrl !== db.schoolInfo.principalSignatureUrl
              ) {
                anySliceChanged = true;
                suppressNextAutoPushRef.current = true;
                setSchoolInfo(db.schoolInfo);
              }
            }

            if (db.examRecords && typeof db.examRecords === 'object') {
              if (JSON.stringify(latestStateRef.current.examRecords) !== JSON.stringify(db.examRecords)) {
                anySliceChanged = true;
                suppressNextAutoPushRef.current = true;
                setExamRecords(db.examRecords);
              }
            }

            if (db.attendanceRecords && typeof db.attendanceRecords === 'object') {
              if (JSON.stringify(latestStateRef.current.attendanceRecords) !== JSON.stringify(db.attendanceRecords)) {
                anySliceChanged = true;
                suppressNextAutoPushRef.current = true;
                setAttendanceRecords(db.attendanceRecords);
              }
            }

            if (Array.isArray(db.feeHeads) && db.feeHeads.length > 0) {
              if (JSON.stringify(latestStateRef.current.feeHeads) !== JSON.stringify(db.feeHeads)) {
                anySliceChanged = true;
                suppressNextAutoPushRef.current = true;
                setFeeHeads(db.feeHeads);
              }
            }

            if (Array.isArray(db.feeInvoices)) {
              if (JSON.stringify(latestStateRef.current.feeInvoices) !== JSON.stringify(db.feeInvoices)) {
                anySliceChanged = true;
                suppressNextAutoPushRef.current = true;
                setFeeInvoices(db.feeInvoices);
              }
            }

            if (Array.isArray(db.feeReceipts)) {
              if (JSON.stringify(latestStateRef.current.feeReceipts) !== JSON.stringify(db.feeReceipts)) {
                anySliceChanged = true;
                suppressNextAutoPushRef.current = true;
                setFeeReceipts(db.feeReceipts);
              }
            }

            if (Array.isArray(db.securityLogs)) {
              const prevLogs = latestStateRef.current.securityLogs;
              if (prevLogs.length > 0 || db.securityLogs.length > 0) {
                const mergedMap = new Map<string, SecurityGatepassLog>();
                for (const item of prevLogs) {
                  if (item && item.id) mergedMap.set(item.id, item);
                }
                for (const item of db.securityLogs as SecurityGatepassLog[]) {
                  if (item && item.id) {
                    const existing = mergedMap.get(item.id);
                    if (existing) {
                      mergedMap.set(item.id, {
                        ...existing,
                        ...item,
                        guardianAcknowledged: Boolean(existing.guardianAcknowledged || item.guardianAcknowledged),
                        acknowledgedAt: item.acknowledgedAt || existing.acknowledgedAt,
                        guardianResponse: item.guardianResponse || existing.guardianResponse,
                        acknowledgedBy: item.acknowledgedBy || existing.acknowledgedBy,
                      });
                    } else {
                      mergedMap.set(item.id, item);
                    }
                  }
                }
                const nextLogs = Array.from(mergedMap.values())
                  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                  .slice(0, 1000);
                if (
                  prevLogs.length !== nextLogs.length ||
                  prevLogs[0]?.id !== nextLogs[0]?.id ||
                  prevLogs[0]?.guardianAcknowledged !== nextLogs[0]?.guardianAcknowledged
                ) {
                  anySliceChanged = true;
                  suppressNextAutoPushRef.current = true;
                  setSecurityLogs(nextLogs);
                }
              }
            }

            if (Array.isArray(db.smsLogs)) {
              setSmsLogs((prev) => {
                if (prev.length === db.smsLogs.length && prev[0]?.id === db.smsLogs[0]?.id) return prev;
                return db.smsLogs;
              });
            }
            if (db.smsGatewayConfig) setSmsGatewayConfig(db.smsGatewayConfig);
            if (Array.isArray(db.calendarEvents) && db.calendarEvents.length > 0) {
              if (JSON.stringify(latestStateRef.current.calendarEvents) !== JSON.stringify(db.calendarEvents)) {
                anySliceChanged = true;
                suppressNextAutoPushRef.current = true;
                setCalendarEvents(db.calendarEvents);
              }
            }
            if (Array.isArray(db.libraryMaterials) && db.libraryMaterials.length > 0) {
              if (JSON.stringify(latestStateRef.current.libraryMaterials) !== JSON.stringify(db.libraryMaterials)) {
                anySliceChanged = true;
                suppressNextAutoPushRef.current = true;
                setLibraryMaterials(db.libraryMaterials as LibraryMaterial[]);
              }
            }

            // Keep anySliceChanged visible cleanly without synchronously clearing suppressNextAutoPushRef when state changed
            void anySliceChanged;

            setServerSyncStatus('synced');
            setSyncErrorMessage(null);
            setLastSyncedTime(
              new Date().toLocaleTimeString('bn-BD', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })
            );
            lastSyncTimestampRef.current = Date.now();
          } else {
            // If server was fresh/empty, push current data to initialize server
            pushToServer();
          }
        } else {
          setServerSyncStatus('offline');
        }
      } catch (err) {
        console.warn('Could not fetch from server database:', err);
        setServerSyncStatus('offline');
      } finally {
        setIsServerSyncing(false);
        isInitialServerLoadDone.current = true;
      }
    },
    [pushToServer, pushPhotosInChunks, persistStudentPhotoMapToIdb]
  );

  // Initial load: IndexedDB local cache + Server Sync (Runs ONCE on mount)
  useEffect(() => {
    let isMounted = true;
    Promise.all([
      idbGet<Student[]>(`${STORAGE_KEY}_students`).catch(() => null),
      idbGet<
        Record<string, { avatarUrl?: string; fatherAvatarUrl?: string; motherAvatarUrl?: string; photoUpdatedAt?: string }>
      >(`${STORAGE_KEY}_student_photos_map`).catch(() => null),
    ])
      .then(([idbStudents, idbPhotoMap]) => {
        if (!isMounted) return;
        if (idbPhotoMap && typeof idbPhotoMap === 'object') {
          studentPhotoMapRef.current = {
            ...studentPhotoMapRef.current,
            ...(idbPhotoMap as Record<string, StudentPhotoRegistryEntry>),
          };
        }
        const validStudents =
          idbStudents && Array.isArray(idbStudents)
            ? idbStudents.filter(
                (s: Student) => !['std_4_01', 'std_4_02', 'std_4_03', 'std_4_04', 'std_4_05'].includes(s.id)
              )
            : [];
        const hasPhotoMap = Boolean(idbPhotoMap && typeof idbPhotoMap === 'object' && Object.keys(idbPhotoMap).length > 0);

        if (validStudents.length > 0 || hasPhotoMap) {
          const cachedById = new Map<string, Student>();
          for (const vs of validStudents) {
            if (vs && vs.id) cachedById.set(vs.id, vs);
          }
          const restoredForServer: Student[] = [];

          setStudents((current) => {
            // If current is empty (or had fewer students), seed from IDB first, then merge photoMap
            const baseList = current.length === 0 || (!isInitialServerLoadDone.current && validStudents.length >= current.length)
              ? validStudents
              : current;

            if (baseList.length === 0 && INITIAL_STUDENTS.length > 0) {
              return INITIAL_STUDENTS;
            }

            let anyUpdated = baseList !== current;
            const merged = baseList.map((curStd) => {
              const cachedStd = cachedById.get(curStd.id);
              const mappedPhoto = idbPhotoMap?.[curStd.id];
              const curTime = new Date(curStd.photoUpdatedAt || 0).getTime();
              const cachedTime = new Date(cachedStd?.photoUpdatedAt || mappedPhoto?.photoUpdatedAt || 0).getTime();

              const pickBest = (curVal?: string, cachedVal?: string, mapVal?: string) => {
                if (curVal) {
                  const bestAlt = (cachedVal && cachedTime > curTime) ? cachedVal : (mapVal && cachedTime > curTime) ? mapVal : '';
                  return bestAlt || curVal;
                }
                return cachedVal || mapVal || '';
              };

              const nextAvatar = pickBest(curStd.avatarUrl, cachedStd?.avatarUrl, mappedPhoto?.avatarUrl);
              const nextFather = pickBest(curStd.fatherAvatarUrl, cachedStd?.fatherAvatarUrl, mappedPhoto?.fatherAvatarUrl);
              const nextMother = pickBest(curStd.motherAvatarUrl, cachedStd?.motherAvatarUrl, mappedPhoto?.motherAvatarUrl);
              const nextPhotoTime = cachedTime > curTime
                ? (cachedStd?.photoUpdatedAt || mappedPhoto?.photoUpdatedAt)
                : (curStd.photoUpdatedAt || cachedStd?.photoUpdatedAt || mappedPhoto?.photoUpdatedAt);

              if (
                nextAvatar !== (curStd.avatarUrl || '') ||
                nextFather !== (curStd.fatherAvatarUrl || '') ||
                nextMother !== (curStd.motherAvatarUrl || '')
              ) {
                anyUpdated = true;
                const updatedStd: Student = {
                  ...curStd,
                  avatarUrl: nextAvatar,
                  fatherAvatarUrl: nextFather,
                  motherAvatarUrl: nextMother,
                  ...(nextPhotoTime ? { photoUpdatedAt: nextPhotoTime } : {}),
                };
                if (isInitialServerLoadDone.current) {
                  restoredForServer.push(updatedStd);
                }
                return updatedStd;
              }
              return curStd;
            });

            if (!anyUpdated) return current;
            if (isInitialServerLoadDone.current && restoredForServer.length > 0) {
              suppressNextAutoPushRef.current = true;
            }
            return merged;
          });

          if (restoredForServer.length > 0) {
            setTimeout(() => {
              pushPhotosInChunks(restoredForServer).catch(() => {});
            }, 350);
          }
        } else if (INITIAL_STUDENTS.length > 0) {
          setStudents((current) => (current.length === 0 ? INITIAL_STUDENTS : current));
        }
        setIsIdbInitialized(true);
      })
      .catch((err) => {
        console.warn('Could not read students from IndexedDB:', err);
        if (isMounted) setIsIdbInitialized(true);
      });

    idbGet<SecurityGatepassLog[]>(`${STORAGE_KEY}_security_logs`)
      .then((logs) => {
        if (isMounted && logs && Array.isArray(logs) && logs.length > 0) {
          setSecurityLogs(logs);
        }
      })
      .catch((err) => {
        console.warn('Could not read security logs from IndexedDB:', err);
      });

    // Immediately sync with central server once on mount
    fetchFromServer({ force: true });

    // Auto-poll server every 15s for staff (or 120s for guardian devices, which get instant gatepass logs via WS/SSE/latest-logs)
    const isGuardianSession = () => {
      try {
        return localStorage.getItem('dlikon_pwa_guardian_mode') === 'true';
      } catch {
        return false;
      }
    };

    const handleFocus = () => {
      const focusCooldownMs = isGuardianSession() ? 45000 : 6000;
      if (
        inFlightPhotoSyncCountRef.current === 0 &&
        Date.now() - lastLocalPhotoMutationTimeRef.current > 6000 &&
        Date.now() - lastSyncTimestampRef.current > focusCooldownMs
      ) {
        fetchFromServer();
      }
    };
    window.addEventListener('focus', handleFocus);
    const interval = setInterval(() => {
      if (isGuardianSession() && Date.now() - lastSyncTimestampRef.current < 120000) {
        return;
      }
      fetchFromServer();
    }, 15000);

    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, []); // Run strictly once on mount to prevent infinite re-render loops

  // Debounced auto-save to central server ONLY on actual local user mutations
  useEffect(() => {
    if (!isInitialServerLoadDone.current) return;
    if (suppressNextAutoPushRef.current) {
      suppressNextAutoPushRef.current = false;
      return;
    }
    const timer = setTimeout(() => {
      pushToServer();
    }, 1000);
    return () => clearTimeout(timer);
  }, [
    students,
    classes,
    schoolInfo,
    examRecords,
    attendanceRecords,
    feeHeads,
    feeInvoices,
    feeReceipts,
    securityLogs,
    calendarEvents,
    libraryMaterials,
    pushToServer,
  ]);

  // Save students to IndexedDB (unlimited + dedicated photo map) & keep localStorage compact to avoid QuotaExceededError wipes
  useEffect(() => {
    if (!isIdbInitialized) return; // Prevent overwriting IndexedDB on initial mount!

    // 1. IndexedDB handles full data (including all photos across Play..Class 8) without quota errors
    idbSet(`${STORAGE_KEY}_students`, students);
    persistStudentPhotoMapToIdb(students);

    // 2. Keep localStorage safely under Chrome 5MB UTF-16 quota
    try {
      const jsonStr = JSON.stringify(students);
      if (jsonStr.length <= 950_000) {
        localStorage.setItem(`${STORAGE_KEY}_students`, jsonStr);
      } else {
        const lightweight = students.map((s) => ({
          ...s,
          avatarUrl: '',
          fatherAvatarUrl: '',
          motherAvatarUrl: '',
        }));
        localStorage.setItem(`${STORAGE_KEY}_students`, JSON.stringify(lightweight));
      }
    } catch (e) {
      console.warn('localStorage quota guard triggered; IndexedDB + server remain source of truth:', e);
    }
  }, [students, isIdbInitialized, persistStudentPhotoMapToIdb]);

  // Security gatepass logs persistence
  useEffect(() => {
    idbSet(`${STORAGE_KEY}_security_logs`, securityLogs);
    try {
      localStorage.setItem(`${STORAGE_KEY}_security_logs`, JSON.stringify(securityLogs));
    } catch (e) {
      console.warn('Could not save security logs to localStorage:', e);
    }
  }, [securityLogs]);

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_exam_records`, JSON.stringify(examRecords));
    } catch (e) {
      console.error('Failed to save exam records', e);
    }
  }, [examRecords]);

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_syllabi`, JSON.stringify(syllabi));
    } catch (e) {
      console.error('Failed to save syllabi', e);
    }
  }, [syllabi]);

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_notes`, JSON.stringify(notes));
    } catch (e) {
      console.error('Failed to save notes', e);
    }
  }, [notes]);

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_question_papers`, JSON.stringify(questionPapers));
    } catch (e) {
      console.error('Failed to save question papers', e);
    }
  }, [questionPapers]);

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_library_materials`, JSON.stringify(libraryMaterials));
    } catch (e) {
      console.error('Failed to save library materials', e);
    }
  }, [libraryMaterials]);

  const updateSchoolInfo = (info: Partial<SchoolInfo>) => {
    setSchoolInfo((prev) => ({ ...prev, ...info }));
  };

  const updateClasses = (newClasses: SchoolClass[]) => {
    setClasses(newClasses);
  };

  const updateClassSubjects = (classId: string, subjects: Subject[]) => {
    setClasses((prev) =>
      prev.map((c) => (c.id === classId ? { ...c, defaultSubjects: subjects } : c))
    );
  };

  const addSubjectToClass = (classId: string, subjectData: Omit<Subject, 'id' | 'classId'>): Subject => {
    const newId = `sub_${classId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newSubject: Subject = {
      ...subjectData,
      id: newId,
      classId,
    };
    setClasses((prev) =>
      prev.map((c) => {
        if (c.id === classId) {
          return {
            ...c,
            defaultSubjects: [...c.defaultSubjects, newSubject],
          };
        }
        return c;
      })
    );
    return newSubject;
  };

  const addSubjectToMultipleClasses = (classIds: string[], subjectData: Omit<Subject, 'id' | 'classId'>) => {
    setClasses((prev) =>
      prev.map((c) => {
        if (classIds.includes(c.id)) {
          const newId = `sub_${c.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const newSubject: Subject = {
            ...subjectData,
            id: newId,
            classId: c.id,
          };
          return {
            ...c,
            defaultSubjects: [...c.defaultSubjects, newSubject],
          };
        }
        return c;
      })
    );
  };

  const updateSubjectInClass = (classId: string, updatedSubject: Subject) => {
    setClasses((prev) =>
      prev.map((c) => {
        if (c.id === classId) {
          return {
            ...c,
            defaultSubjects: c.defaultSubjects.map((s) => (s.id === updatedSubject.id ? updatedSubject : s)),
          };
        }
        return c;
      })
    );
  };

  const deleteSubjectFromClass = (classId: string, subjectId: string) => {
    setClasses((prev) =>
      prev.map((c) => {
        if (c.id === classId) {
          return {
            ...c,
            defaultSubjects: c.defaultSubjects.filter((s) => s.id !== subjectId),
          };
        }
        return c;
      })
    );
  };

  const reorderClassSubjects = (classId: string, newSubjects: Subject[]) => {
    setClasses((prev) =>
      prev.map((c) => (c.id === classId ? { ...c, defaultSubjects: newSubjects } : c))
    );
  };

  const copySubjectsBetweenClasses = (
    sourceClassId: string,
    targetClassId: string,
    mode: 'replace' | 'append' = 'replace'
  ) => {
    const sourceClass = classes.find((c) => c.id === sourceClassId);
    if (!sourceClass) return;

    const clonedSubjects: Subject[] = sourceClass.defaultSubjects.map((s, idx) => ({
      ...s,
      id: `sub_${targetClassId}_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      classId: targetClassId,
    }));

    setClasses((prev) =>
      prev.map((c) => {
        if (c.id === targetClassId) {
          return {
            ...c,
            defaultSubjects: mode === 'append' ? [...c.defaultSubjects, ...clonedSubjects] : clonedSubjects,
          };
        }
        return c;
      })
    );
  };

  const resetClassSubjectsToDefault = (classId: string) => {
    const defaultCls = DEFAULT_CLASSES.find((c) => c.id === classId);
    if (!defaultCls) return;
    setClasses((prev) =>
      prev.map((c) => (c.id === classId ? { ...c, defaultSubjects: [...defaultCls.defaultSubjects] } : c))
    );
  };

  const addStudent = (studentData: Omit<Student, 'id'>): Student => {
    const newId = `std_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const qrCode = studentData.securityQrCode || `DLIKON-SEC-${(studentData.classId || 'CLS').toUpperCase()}-${studentData.roll}-${newId.slice(-4).toUpperCase()}`;
    const hasAnyPhoto = Boolean(studentData.avatarUrl || studentData.fatherAvatarUrl || studentData.motherAvatarUrl);
    const stampedTime = hasAnyPhoto ? (studentData.photoUpdatedAt || new Date().toISOString()) : undefined;
    const newStudent: Student = {
      ...studentData,
      id: newId,
      securityQrCode: qrCode,
      ...(stampedTime ? { photoUpdatedAt: stampedTime } : {}),
    };

    if (hasAnyPhoto && stampedTime) {
      lastLocalPhotoMutationTimeRef.current = Date.now();
      recentLocalPhotoUploadsRef.current.set(newId, {
        avatarUrl: newStudent.avatarUrl || '',
        fatherAvatarUrl: newStudent.fatherAvatarUrl || '',
        motherAvatarUrl: newStudent.motherAvatarUrl || '',
        photoUpdatedAt: stampedTime,
        updatedAtMs: Date.now(),
      });
    }

    const compressAndSyncNewStudent = async () => {
      inFlightPhotoSyncCountRef.current++;
      try {
        const updates: Partial<Student> = {};
        if (studentData.avatarUrl && studentData.avatarUrl.length > 18000) {
          updates.avatarUrl = await compressImageBase64(studentData.avatarUrl);
        }
        if (studentData.fatherAvatarUrl && studentData.fatherAvatarUrl.length > 18000) {
          updates.fatherAvatarUrl = await compressImageBase64(studentData.fatherAvatarUrl);
        }
        if (studentData.motherAvatarUrl && studentData.motherAvatarUrl.length > 18000) {
          updates.motherAvatarUrl = await compressImageBase64(studentData.motherAvatarUrl);
        }
        const finalized = { ...newStudent, ...updates };
        if (Object.keys(updates).length > 0) {
          setStudents((prev) => prev.map((s) => (s.id === newId ? finalized : s)));
        }
        if (hasAnyPhoto) {
          recentLocalPhotoUploadsRef.current.set(newId, {
            avatarUrl: finalized.avatarUrl || '',
            fatherAvatarUrl: finalized.fatherAvatarUrl || '',
            motherAvatarUrl: finalized.motherAvatarUrl || '',
            photoUpdatedAt: finalized.photoUpdatedAt || new Date().toISOString(),
            updatedAtMs: Date.now(),
          });
        }
        try {
          const res = await fetch('/api/student/profile-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId: finalized.id, updates: finalized }),
          });
          if (res.ok && hasAnyPhoto) {
            syncedServerPhotoSigRef.current.set(finalized.id, getStudentPhotoSig(finalized));
          }
        } catch {
          // Auto-sync handles retry
        }
        if (cloudUser && cloudUser.emailVerified) {
          syncStudentRecordToFirestore(finalized, cloudUser, latestStateRef.current.schoolInfo).catch(() => {});
        }
      } finally {
        inFlightPhotoSyncCountRef.current = Math.max(0, inFlightPhotoSyncCountRef.current - 1);
      }
    };
    compressAndSyncNewStudent();

    setStudents((prev) => [...prev, newStudent]);
    return newStudent;
  };

  const pushSingleStudentWithRetry = useCallback(
    async (payload: Student, explicitPhotoClear?: ExplicitPhotoClearFlags): Promise<boolean> => {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await fetch('/api/student/profile-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              studentId: payload.id,
              updates: payload,
              ...(explicitPhotoClear ? { explicitPhotoClear } : {}),
            }),
          });
          if (res.ok) {
            syncedServerPhotoSigRef.current.set(payload.id, getStudentPhotoSig(payload));
            setServerSyncStatus('synced');
            setSyncErrorMessage(null);
            setLastSyncedTime(
              new Date().toLocaleTimeString('bn-BD', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })
            );
            lastSyncTimestampRef.current = Date.now();
            return true;
          }
        } catch {
          // Retry or fallback
        }
      }

      // Fallback via batch-photos endpoint (also supports upsert)
      try {
        const resBatch = await fetch('/api/students/batch-photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: [
              {
                id: payload.id,
                avatarUrl: payload.avatarUrl || '',
                fatherAvatarUrl: payload.fatherAvatarUrl || '',
                motherAvatarUrl: payload.motherAvatarUrl || '',
                photoUpdatedAt: payload.photoUpdatedAt || new Date().toISOString(),
                ...(explicitPhotoClear ? { explicitClear: explicitPhotoClear } : {}),
                studentRecord: payload,
              },
            ],
          }),
        });
        if (resBatch.ok) {
          syncedServerPhotoSigRef.current.set(payload.id, getStudentPhotoSig(payload));
          setServerSyncStatus('synced');
          setSyncErrorMessage(null);
          return true;
        }
      } catch {
        // Fall through to error status
      }

      setServerSyncStatus('error');
      setSyncErrorMessage(`"${payload.nameBn}"-এর ছবি সার্ভারে সংরক্ষণ ব্যর্থ হয়েছে — অনুগ্রহ করে পুনরায় চেষ্টা করুন।`);
      return false;
    },
    []
  );

  const updateStudent = async (
    student: Student,
    options?: { explicitPhotoClear?: ExplicitPhotoClearFlags }
  ): Promise<boolean> => {
    const existing = latestStateRef.current.students.find((s) => s.id === student.id);
    const explicitClear = options?.explicitPhotoClear;

    inFlightPhotoSyncCountRef.current++;
    try {
      const compAvatar =
        isValidImageReference(student.avatarUrl) && student.avatarUrl.length > 18000
          ? await compressImageBase64(student.avatarUrl)
          : student.avatarUrl;
      const compFather =
        isValidImageReference(student.fatherAvatarUrl) && student.fatherAvatarUrl.length > 18000
          ? await compressImageBase64(student.fatherAvatarUrl)
          : student.fatherAvatarUrl;
      const compMother =
        isValidImageReference(student.motherAvatarUrl) && student.motherAvatarUrl.length > 18000
          ? await compressImageBase64(student.motherAvatarUrl)
          : student.motherAvatarUrl;

      const latestExisting = latestStateRef.current.students.find((s) => s.id === student.id) || existing;
      const regEntry = studentPhotoMapRef.current[student.id];

      const incomingNormalized: Student = {
        ...student,
        avatarUrl: compAvatar,
        fatherAvatarUrl: compFather,
        motherAvatarUrl: compMother,
      };

      const { student: finalStudent } = reconcileStudentPhotoReferences(
        incomingNormalized,
        latestExisting,
        regEntry,
        { explicitClear }
      );

      const photosModified =
        (finalStudent.avatarUrl || '') !== (latestExisting?.avatarUrl || '') ||
        (finalStudent.fatherAvatarUrl || '') !== (latestExisting?.fatherAvatarUrl || '') ||
        (finalStudent.motherAvatarUrl || '') !== (latestExisting?.motherAvatarUrl || '');

      const nowIso = new Date().toISOString();
      if (photosModified) {
        finalStudent.photoUpdatedAt = nowIso;
        lastLocalPhotoMutationTimeRef.current = Date.now();
        recentLocalPhotoUploadsRef.current.set(finalStudent.id, {
          avatarUrl: finalStudent.avatarUrl || '',
          fatherAvatarUrl: finalStudent.fatherAvatarUrl || '',
          motherAvatarUrl: finalStudent.motherAvatarUrl || '',
          photoUpdatedAt: nowIso,
          updatedAtMs: Date.now(),
          explicitlyCleared: {
            avatarUrl: Boolean(explicitClear?.avatarUrl && !finalStudent.avatarUrl),
            fatherAvatarUrl: Boolean(explicitClear?.fatherAvatarUrl && !finalStudent.fatherAvatarUrl),
            motherAvatarUrl: Boolean(explicitClear?.motherAvatarUrl && !finalStudent.motherAvatarUrl),
          },
        });
      }

      // Update registry cache synchronously (honoring explicit clear if set)
      if (finalStudent.avatarUrl || finalStudent.fatherAvatarUrl || finalStudent.motherAvatarUrl) {
        studentPhotoMapRef.current[finalStudent.id] = {
          studentId: finalStudent.id,
          classId: finalStudent.classId,
          roll: finalStudent.roll,
          section: finalStudent.section,
          nameBn: finalStudent.nameBn,
          ...(finalStudent.avatarUrl ? { avatarUrl: finalStudent.avatarUrl } : {}),
          ...(finalStudent.fatherAvatarUrl ? { fatherAvatarUrl: finalStudent.fatherAvatarUrl } : {}),
          ...(finalStudent.motherAvatarUrl ? { motherAvatarUrl: finalStudent.motherAvatarUrl } : {}),
          photoUpdatedAt: finalStudent.photoUpdatedAt,
          updatedAt: nowIso,
        };
      } else if (explicitClear?.avatarUrl || explicitClear?.fatherAvatarUrl || explicitClear?.motherAvatarUrl) {
        delete studentPhotoMapRef.current[finalStudent.id];
      }

      setStudents((prev) => {
        const next = prev.map((s) => (s.id === finalStudent.id ? finalStudent : s));
        idbSet(`${STORAGE_KEY}_students`, next);
        persistStudentPhotoMapToIdb(next);
        return next;
      });

      const savedOk = await pushSingleStudentWithRetry(finalStudent, explicitClear);
      if (cloudUser && cloudUser.emailVerified) {
        syncStudentRecordToFirestore(finalStudent, cloudUser, latestStateRef.current.schoolInfo, explicitClear).catch(
          () => {}
        );
      }
      return savedOk;
    } finally {
      inFlightPhotoSyncCountRef.current = Math.max(0, inFlightPhotoSyncCountRef.current - 1);
    }
  };

  const updateStudentPhoto = async (
    studentId: string,
    role: 'student' | 'father' | 'mother',
    base64: string
  ): Promise<{ ok: boolean; avatarUrl: string; message: string }> => {
    lastLocalPhotoMutationTimeRef.current = Date.now();
    inFlightPhotoSyncCountRef.current++;
    try {
      const sanitizedInput = base64 && isValidImageReference(base64) ? base64 : '';
      const compressed = sanitizedInput ? await compressImageBase64(sanitizedInput, 220, 280, 0.72) : '';
      const photoUpdatedAt = new Date().toISOString();
      const fieldKey =
        role === 'student' ? 'avatarUrl' : role === 'father' ? 'fatherAvatarUrl' : 'motherAvatarUrl';

      const currentLatest = latestStateRef.current.students.find((s) => s.id === studentId);
      if (!currentLatest) {
        return { ok: false, avatarUrl: compressed, message: 'শিক্ষার্থী পাওয়া যায়নি।' };
      }

      const explicitFieldClear: ExplicitPhotoClearFlags | undefined = !compressed ? { [fieldKey]: true } : undefined;
      const prevGuard = recentLocalPhotoUploadsRef.current.get(studentId);
      recentLocalPhotoUploadsRef.current.set(studentId, {
        avatarUrl: role === 'student' ? compressed : prevGuard?.avatarUrl ?? currentLatest.avatarUrl ?? '',
        fatherAvatarUrl: role === 'father' ? compressed : prevGuard?.fatherAvatarUrl ?? currentLatest.fatherAvatarUrl ?? '',
        motherAvatarUrl: role === 'mother' ? compressed : prevGuard?.motherAvatarUrl ?? currentLatest.motherAvatarUrl ?? '',
        photoUpdatedAt,
        updatedAtMs: Date.now(),
        explicitlyCleared: {
          ...(prevGuard?.explicitlyCleared || {}),
          [fieldKey]: !compressed,
        },
      });

      const { student: updatedStudent } = reconcileStudentPhotoReferences(
        {
          ...currentLatest,
          [fieldKey]: compressed,
          photoUpdatedAt,
        },
        currentLatest,
        studentPhotoMapRef.current[studentId],
        { explicitClear: explicitFieldClear }
      );

      setStudents((prev) => {
        const next = prev.map((s) => (s.id === studentId ? updatedStudent : s));
        idbSet(`${STORAGE_KEY}_students`, next);
        persistStudentPhotoMapToIdb(next);
        return next;
      });

      const savedOk = await pushSingleStudentWithRetry(updatedStudent, explicitFieldClear);
      if (cloudUser && cloudUser.emailVerified) {
        syncStudentRecordToFirestore(
          updatedStudent,
          cloudUser,
          latestStateRef.current.schoolInfo,
          explicitFieldClear
        ).catch(() => {});
      }

      return {
        ok: savedOk,
        avatarUrl: compressed,
        message: savedOk
          ? `✓ "${updatedStudent.nameBn}"-এর ছবি সার্ভারে স্থায়ীভাবে সংরক্ষিত হয়েছে`
          : `⚠ "${updatedStudent.nameBn}"-এর ছবি সার্ভারে সেভ হয়নি — ইন্টারনেট বা সার্ভার চেক করুন`,
      };
    } finally {
      inFlightPhotoSyncCountRef.current = Math.max(0, inFlightPhotoSyncCountRef.current - 1);
    }
  };

  const batchUpdateStudentPhotos = async (
    items: {
      id: string;
      avatarUrl?: string;
      fatherAvatarUrl?: string;
      motherAvatarUrl?: string;
      photoUpdatedAt?: string;
    }[]
  ): Promise<{ ok: boolean; updatedCount: number; message: string }> => {
    if (!items || items.length === 0) {
      return { ok: true, updatedCount: 0, message: 'কোনো ছবি নির্বাচন করা হয়নি।' };
    }
    lastLocalPhotoMutationTimeRef.current = Date.now();
    inFlightPhotoSyncCountRef.current++;
    try {
      const nowIso = new Date().toISOString();
      const itemMap = new Map<string, (typeof items)[0]>();
      for (const it of items) {
        if (it && it.id) {
          const ts = it.photoUpdatedAt || nowIso;
          itemMap.set(it.id, { ...it, photoUpdatedAt: ts });
          recentLocalPhotoUploadsRef.current.set(it.id, {
            avatarUrl: it.avatarUrl,
            fatherAvatarUrl: it.fatherAvatarUrl,
            motherAvatarUrl: it.motherAvatarUrl,
            photoUpdatedAt: ts,
            updatedAtMs: Date.now(),
          });
        }
      }

      let changedStudents: Student[] = [];
      setStudents((prev) => {
        const next = prev.map((s) => {
          const inc = itemMap.get(s.id);
          if (!inc) return s;
          const { student: upd } = reconcileStudentPhotoReferences(
            {
              ...s,
              ...(inc.avatarUrl !== undefined ? { avatarUrl: inc.avatarUrl } : {}),
              ...(inc.fatherAvatarUrl !== undefined ? { fatherAvatarUrl: inc.fatherAvatarUrl } : {}),
              ...(inc.motherAvatarUrl !== undefined ? { motherAvatarUrl: inc.motherAvatarUrl } : {}),
              photoUpdatedAt: inc.photoUpdatedAt || nowIso,
            },
            s,
            studentPhotoMapRef.current[s.id]
          );
          changedStudents.push(upd);
          return upd;
        });
        idbSet(`${STORAGE_KEY}_students`, next);
        persistStudentPhotoMapToIdb(next);
        return next;
      });

      // Fallback compute if state updater is batched
      if (changedStudents.length === 0) {
        changedStudents = latestStateRef.current.students
          .filter((s) => itemMap.has(s.id))
          .map((s) => {
            const inc = itemMap.get(s.id)!;
            return reconcileStudentPhotoReferences(
              {
                ...s,
                ...(inc.avatarUrl !== undefined ? { avatarUrl: inc.avatarUrl } : {}),
                ...(inc.fatherAvatarUrl !== undefined ? { fatherAvatarUrl: inc.fatherAvatarUrl } : {}),
                ...(inc.motherAvatarUrl !== undefined ? { motherAvatarUrl: inc.motherAvatarUrl } : {}),
                photoUpdatedAt: inc.photoUpdatedAt || nowIso,
              },
              s,
              studentPhotoMapRef.current[s.id]
            ).student;
          });
      }

      const ok = await pushPhotosInChunks(changedStudents);
      if (ok) {
        setServerSyncStatus('synced');
        setSyncErrorMessage(null);
      } else {
        setServerSyncStatus('error');
        setSyncErrorMessage('সার্ভারে সব ছবি সেভ হতে পারেনি। পুনরায় চেষ্টা করুন।');
      }

      return {
        ok,
        updatedCount: changedStudents.length,
        message: ok
          ? `✓ ${toBengaliNumber(changedStudents.length)} জন শিক্ষার্থীর ছবি সার্ভারে স্থায়ীভাবে সংরক্ষিত হয়েছে`
          : '⚠ সার্ভারে সব ছবি সংরক্ষিত হতে সমস্যা হয়েছে',
      };
    } finally {
      inFlightPhotoSyncCountRef.current = Math.max(0, inFlightPhotoSyncCountRef.current - 1);
    }
  };

  const deleteStudent = (studentId: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== studentId));
  };

  const addSecurityLog = useCallback(
    (
      logData: Omit<SecurityGatepassLog, 'id' | 'timestamp'> & { id?: string; timestamp?: string },
      options?: { suppressAutoPush?: boolean }
    ): SecurityGatepassLog => {
      const newLog: SecurityGatepassLog = {
        ...logData,
        id: logData.id || `seclog_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: logData.timestamp || new Date().toISOString(),
      };
      if (options?.suppressAutoPush) {
        suppressNextAutoPushRef.current = true;
      }
      setSecurityLogs((prev) => {
        const existingIdx = prev.findIndex((l) => l.id === newLog.id);
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = {
            ...updated[existingIdx],
            ...newLog,
            portalUserId: newLog.portalUserId || updated[existingIdx].portalUserId,
            classId: newLog.classId || updated[existingIdx].classId,
            section: newLog.section || updated[existingIdx].section,
            studentEtiquetteReply:
              newLog.studentEtiquetteReply || updated[existingIdx].studentEtiquetteReply,
            guardianAcknowledged: Boolean(
              updated[existingIdx].guardianAcknowledged || newLog.guardianAcknowledged
            ),
            acknowledgedAt: newLog.acknowledgedAt || updated[existingIdx].acknowledgedAt,
            guardianResponse: newLog.guardianResponse || updated[existingIdx].guardianResponse,
            acknowledgedBy: newLog.acknowledgedBy || updated[existingIdx].acknowledgedBy,
          };
          return updated;
        }
        return [newLog, ...prev].slice(0, 1000);
      });
      return newLog;
    },
    []
  );

  const updateSecurityLogEtiquette = useCallback(async (logId: string, replyText: string) => {
    const cleanReply = replyText.trim() || 'ওয়ালাইকুমুস সালাম ওয়া রাহমাতুল্লাহ';
    setSecurityLogs((prev) =>
      prev.map((l) => (l.id === logId ? { ...l, studentEtiquetteReply: cleanReply } : l))
    );
    try {
      await fetch('/api/security/etiquette', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId, studentEtiquetteReply: cleanReply }),
      });
    } catch {
      // Non-fatal
    }
  }, []);

  const broadcastSecurityLogToCloud = useCallback(
    async (log: SecurityGatepassLog) => {
      if (cloudUser && cloudUser.emailVerified) {
        const matchedStudent = latestStateRef.current.students.find(
          (s) =>
            s.id === log.studentId ||
            (log.portalUserId && getStudentPortalId(s).toUpperCase() === log.portalUserId.toUpperCase()) ||
            (log.classId && s.classId === log.classId && Number(s.roll) === Number(log.studentRoll))
        );
        await pushSecurityLogToFirestore(
          log,
          cloudUser,
          latestStateRef.current.schoolInfo,
          matchedStudent?.guardianUid
        ).catch((err) => {
          console.warn('Firestore security log push warning:', err);
        });
      }
    },
    [cloudUser]
  );

  const acknowledgeSecurityLog = useCallback(
    async (logId: string, guardianResponse: string, acknowledgedBy?: string) => {
      const ackTime = new Date().toISOString();
      const responseText = guardianResponse.trim() || 'মেসেজ শুনেছি ও নিশ্চিত করলাম';
      let targetStudentId = '';

      setSecurityLogs((prev) =>
        prev.map((l) => {
          if (l.id === logId) {
            targetStudentId = l.studentId;
            return {
              ...l,
              guardianAcknowledged: true,
              acknowledgedAt: ackTime,
              guardianResponse: responseText,
              acknowledgedBy: acknowledgedBy || 'অভিভাবক',
            };
          }
          return l;
        })
      );

      if (cloudUser && cloudUser.emailVerified) {
        acknowledgeSecurityLogInFirestore(
          logId,
          responseText,
          acknowledgedBy || 'অভিভাবক',
          cloudUser
        ).catch((err) => console.warn('Firestore ack sync warning:', err));
      }

      try {
        await fetch('/api/security/acknowledge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            logId,
            studentId: targetStudentId,
            guardianResponse: responseText,
            acknowledgedBy: acknowledgedBy || 'অভিভাবক',
          }),
        });
      } catch (err) {
        console.warn('Could not sync guardian acknowledgement to server:', err);
      }
    },
    [cloudUser]
  );

  const clearSecurityLogs = () => {
    setSecurityLogs([]);
  };

  const bulkImportStudents = (
    newStudentsData: Omit<Student, 'id'>[],
    options?: {
      mode?: 'append' | 'upsert' | 'replace';
      targetClassId?: string;
      targetClassIds?: string[];
      targetSection?: string;
    }
  ): number => {
    const mode = options?.mode || 'append';
    const targetClassId = options?.targetClassId;
    const targetClassIds = options?.targetClassIds;
    const targetSection = options?.targetSection;

    setStudents((prev) => {
      // Build relational photo lookup BEFORE mutating/replacing so Play..Class 8 photos are NEVER lost on re-import
      const relPhotoIndex = new Map<string, Partial<StudentPhotoRegistryEntry>>();
      for (const entry of Object.values(studentPhotoMapRef.current)) {
        const rk = buildStudentRelationKey({ classId: entry.classId, roll: entry.roll }, false);
        if (rk && (isValidImageReference(entry.avatarUrl) || isValidImageReference(entry.fatherAvatarUrl) || isValidImageReference(entry.motherAvatarUrl))) {
          relPhotoIndex.set(rk, entry);
        }
      }
      for (const existingStd of prev) {
        const rk = buildStudentRelationKey(existingStd, false);
        if (
          rk &&
          (isValidImageReference(existingStd.avatarUrl) ||
            isValidImageReference(existingStd.fatherAvatarUrl) ||
            isValidImageReference(existingStd.motherAvatarUrl))
        ) {
          relPhotoIndex.set(rk, {
            studentId: existingStd.id,
            classId: existingStd.classId,
            roll: existingStd.roll,
            section: existingStd.section,
            nameBn: existingStd.nameBn,
            avatarUrl: existingStd.avatarUrl,
            fatherAvatarUrl: existingStd.fatherAvatarUrl,
            motherAvatarUrl: existingStd.motherAvatarUrl,
            photoUpdatedAt: existingStd.photoUpdatedAt,
          });
        }
      }

      let baseList = [...prev];

      if (mode === 'replace') {
        const classesToRemove = new Set<string>();
        if (targetClassId) {
          classesToRemove.add(targetClassId);
        } else if (targetClassIds && targetClassIds.length > 0) {
          targetClassIds.forEach((id) => classesToRemove.add(id));
        } else {
          // Detect all classes present in incoming students
          newStudentsData.forEach((s) => {
            if (s.classId) classesToRemove.add(s.classId);
          });
        }

        if (classesToRemove.size > 0) {
          baseList = baseList.filter((s) => {
            if (classesToRemove.has(s.classId)) {
              if (targetSection) {
                return s.section !== targetSection;
              }
              return false;
            }
            return true;
          });
        }
      }

      if (mode === 'upsert') {
        const toAdd: Student[] = [];
        newStudentsData.forEach((item, idx) => {
          const existingIdx = baseList.findIndex(
            (s) =>
              s.classId === item.classId &&
              s.roll === item.roll &&
              (!item.section || !s.section || s.section === item.section)
          );
          if (existingIdx >= 0) {
            const existingRow = baseList[existingIdx];
            const rk = buildStudentRelationKey(existingRow, false);
            const regEntry = studentPhotoMapRef.current[existingRow.id] || (rk ? relPhotoIndex.get(rk) : undefined);
            baseList[existingIdx] = reconcileStudentPhotoReferences(
              { ...item, id: existingRow.id },
              existingRow,
              regEntry
            ).student;
          } else {
            const rk = buildStudentRelationKey(item, false);
            const regEntry = rk ? relPhotoIndex.get(rk) : undefined;
            const resolvedId = regEntry?.studentId || `std_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`;
            toAdd.push(
              reconcileStudentPhotoReferences({ ...item, id: resolvedId }, undefined, regEntry).student
            );
          }
        });
        const merged = [...baseList, ...toAdd];
        idbSet(`${STORAGE_KEY}_students`, merged);
        persistStudentPhotoMapToIdb(merged);
        return merged;
      }

      // Default append or replace: reconcile with relation registry if photos exist for (classId, roll)
      const created: Student[] = newStudentsData.map((data, idx) => {
        const rk = buildStudentRelationKey(data, false);
        const regEntry = rk ? relPhotoIndex.get(rk) : undefined;
        const resolvedId =
          mode === 'replace' && regEntry?.studentId
            ? regEntry.studentId
            : `std_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`;
        return reconcileStudentPhotoReferences({ ...data, id: resolvedId }, undefined, regEntry).student;
      });
      const next = [...baseList, ...created];
      idbSet(`${STORAGE_KEY}_students`, next);
      persistStudentPhotoMapToIdb(next);
      return next;
    });

    return newStudentsData.length;
  };

  const moveStudentsToClass = (studentIds: string[], targetClassId: string, targetSection?: string): number => {
    const idSet = new Set(studentIds);
    let count = 0;
    setStudents((prev) => {
      const next = prev.map((s) => {
        if (idSet.has(s.id)) {
          count++;
          const moved = reconcileStudentPhotoReferences(
            {
              ...s,
              classId: targetClassId,
              ...(targetSection !== undefined ? { section: targetSection } : {}),
            },
            s,
            studentPhotoMapRef.current[s.id]
          ).student;
          return moved;
        }
        return s;
      });
      idbSet(`${STORAGE_KEY}_students`, next);
      persistStudentPhotoMapToIdb(next);
      return next;
    });
    return count;
  };

  const deleteStudentsByClass = (classId: string, section?: string): number => {
    let count = 0;
    setStudents((prev) => {
      const remaining = prev.filter((s) => {
        const matches = s.classId === classId && (!section || s.section === section);
        if (matches) count++;
        return !matches;
      });
      return remaining;
    });
    return count;
  };

  const deleteMultipleStudents = (studentIds: string[]): number => {
    const idSet = new Set(studentIds);
    let count = 0;
    setStudents((prev) => {
      const remaining = prev.filter((s) => {
        if (idSet.has(s.id)) {
          count++;
          return false;
        }
        return true;
      });
      return remaining;
    });
    return count;
  };

  const saveMarkRecord = (
    studentId: string,
    examId: string,
    academicYear: string,
    classId: string,
    section: string,
    subjectId: string,
    markData: Partial<StudentSubjectMark>,
    meta?: { workingDays?: number; attendance?: number; teacherRemarks?: string }
  ) => {
    const recordId = `${studentId}_${examId}_${academicYear}`;
    setExamRecords((prev) => {
      const existing = prev[recordId] || {
        id: recordId,
        studentId,
        examId,
        academicYear,
        classId,
        section,
        marks: {},
        workingDays: 120,
        attendance: 110,
        teacherRemarks: '',
      };

      const currentSubjectMark = existing.marks[subjectId] || {
        subjectId,
        examMarks: null,
        calcMarks80: null,
        monthlyMarks20: null,
        totalMarks: null,
        letterGrade: '-',
        gradePoint: 0,
      };

      // Find subject for full mark calculation
      const currentClass = classes.find((c) => c.id === classId);
      const subject = currentClass?.defaultSubjects.find((s) => s.id === subjectId);
      const fullMarks = subject ? subject.fullMarks : 100;

      const updatedExamMarks = markData.examMarks !== undefined ? markData.examMarks : currentSubjectMark.examMarks;
      const updatedMonthlyMarks = markData.monthlyMarks20 !== undefined ? markData.monthlyMarks20 : currentSubjectMark.monthlyMarks20;

      let calcMarks80: number | null = null;
      let totalMarks: number | null = null;

      if (updatedExamMarks !== null && updatedExamMarks !== undefined) {
        if (subject && subject.hasMonthlyExam === false) {
          calcMarks80 = updatedExamMarks;
          totalMarks = updatedExamMarks;
        } else {
          // 80% of exam mark
          calcMarks80 = parseFloat(((updatedExamMarks * 80) / 100).toFixed(1));
          const monthly = updatedMonthlyMarks || 0;
          totalMarks = Math.round(calcMarks80 + monthly);
        }
      }

      const { letterGrade, gradePoint } = calculateGrade(totalMarks, fullMarks);

      const updatedMark: StudentSubjectMark = {
        ...currentSubjectMark,
        ...markData,
        examMarks: updatedExamMarks,
        calcMarks80,
        monthlyMarks20: updatedMonthlyMarks,
        totalMarks,
        letterGrade,
        gradePoint,
      };

      return {
        ...prev,
        [recordId]: {
          ...existing,
          workingDays: meta?.workingDays !== undefined ? meta.workingDays : existing.workingDays,
          attendance: meta?.attendance !== undefined ? meta.attendance : existing.attendance,
          teacherRemarks: meta?.teacherRemarks !== undefined ? meta.teacherRemarks : existing.teacherRemarks,
          marks: {
            ...existing.marks,
            [subjectId]: updatedMark,
          },
        },
      };
    });
  };

  const bulkSaveSubjectMarks = (
    examId: string,
    academicYear: string,
    classId: string,
    section: string,
    subjectId: string,
    studentMarks: { studentId: string; examMarks: number | null; monthlyMarks20: number | null }[]
  ) => {
    const currentClass = classes.find((c) => c.id === classId);
    const subject = currentClass?.defaultSubjects.find((s) => s.id === subjectId);
    const fullMarks = subject ? subject.fullMarks : 100;

    setExamRecords((prev) => {
      const nextRecords = { ...prev };

      studentMarks.forEach((sm) => {
        const recordId = `${sm.studentId}_${examId}_${academicYear}`;
        const existing = nextRecords[recordId] || {
          id: recordId,
          studentId: sm.studentId,
          examId,
          academicYear,
          classId,
          section,
          marks: {},
          workingDays: 120,
          attendance: 110,
          teacherRemarks: '',
        };

        let calcMarks80: number | null = null;
        let totalMarks: number | null = null;

        if (sm.examMarks !== null && sm.examMarks !== undefined && !isNaN(sm.examMarks)) {
          if (subject && subject.hasMonthlyExam === false) {
            calcMarks80 = sm.examMarks;
            totalMarks = sm.examMarks;
          } else {
            calcMarks80 = parseFloat(((sm.examMarks * 80) / 100).toFixed(1));
            const monthly = sm.monthlyMarks20 || 0;
            totalMarks = Math.round(calcMarks80 + monthly);
          }
        }

        const { letterGrade, gradePoint } = calculateGrade(totalMarks, fullMarks);

        const updatedSubjectMark: StudentSubjectMark = {
          subjectId,
          examMarks: sm.examMarks,
          calcMarks80,
          monthlyMarks20: sm.monthlyMarks20,
          totalMarks,
          letterGrade,
          gradePoint,
        };

        nextRecords[recordId] = {
          ...existing,
          marks: {
            ...existing.marks,
            [subjectId]: updatedSubjectMark,
          },
        };
      });

      return nextRecords;
    });
  };

  const calculateStudentAttendanceMetrics = (
    studentId: string,
    classId: string,
    academicYear: string
  ) => {
    let totalWorkingDays = 0;
    let presentDays = 0;
    let absentDays = 0;
    let lateDays = 0;
    let leaveDays = 0;

    Object.values(attendanceRecords).forEach((rec) => {
      if (rec.classId === classId && rec.academicYear === academicYear) {
        const studentRec = rec.records[studentId];
        if (studentRec) {
          totalWorkingDays++;
          if (studentRec.status === 'present') {
            presentDays++;
          } else if (studentRec.status === 'late') {
            lateDays++;
            presentDays++;
          } else if (studentRec.status === 'leave') {
            leaveDays++;
          } else if (studentRec.status === 'absent') {
            absentDays++;
          }
        }
      }
    });

    const percentage = totalWorkingDays > 0 ? parseFloat(((presentDays / totalWorkingDays) * 100).toFixed(1)) : 100;

    return {
      totalWorkingDays,
      presentDays,
      absentDays,
      lateDays,
      leaveDays,
      percentage,
    };
  };

  const saveDailyAttendance = (
    classId: string,
    section: string,
    date: string,
    academicYear: string,
    records: Record<string, { status: AttendanceStatus; remarks?: string }>
  ) => {
    const id = `${classId}_${section || 'all'}_${date}`;
    setAttendanceRecords((prev) => ({
      ...prev,
      [id]: {
        id,
        date,
        academicYear,
        classId,
        section: section || '',
        records,
        updatedAt: new Date().toISOString(),
      },
    }));
  };

  const upsertAttendanceRecordFromServer = useCallback(
    (incoming: DailyAttendanceRecord, options?: { suppressAutoPush?: boolean }) => {
      if (!incoming || !incoming.id || !incoming.records) return;
      if (options?.suppressAutoPush) {
        suppressNextAutoPushRef.current = true;
      }
      setAttendanceRecords((prev) => {
        const existing = prev[incoming.id];
        return {
          ...prev,
          [incoming.id]: {
            ...existing,
            ...incoming,
            records: {
              ...(existing?.records || {}),
              ...incoming.records,
            },
          },
        };
      });
    },
    []
  );

  const markStudentAttendanceFromScan = useCallback(
    (
      student: Pick<Student, 'id' | 'classId' | 'section' | 'academicYear'>,
      action: 'entry' | 'exit',
      timestampIso?: string
    ) => {
      const dt = timestampIso ? new Date(timestampIso) : new Date();
      let dateStr = '';
      try {
        dateStr = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Dhaka',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(dt);
      } catch {
        dateStr = dt.toISOString().split('T')[0];
      }
      let timeLabel = '';
      try {
        timeLabel = dt.toLocaleTimeString('bn-BD', {
          timeZone: 'Asia/Dhaka',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
      } catch {
        timeLabel = dt.toLocaleTimeString('bn-BD');
      }

      const sec = student.section || 'ক';
      const recId = `${student.classId}_${sec || 'all'}_${dateStr}`;
      const remarkText =
        action === 'exit'
          ? `গেটপাস স্ক্যান (প্রস্থান ${timeLabel})`
          : `ডিজিটাল গেটপাস স্ক্যান (উপস্থিত ${timeLabel})`;

      setAttendanceRecords((prev) => {
        const existing = prev[recId];
        const prevEntry = existing?.records?.[student.id];
        return {
          ...prev,
          [recId]: {
            id: recId,
            date: dateStr,
            academicYear: student.academicYear || '২০২৬',
            classId: student.classId,
            section: sec,
            records: {
              ...(existing?.records || {}),
              [student.id]: {
                status: prevEntry?.status === 'late' ? 'late' : 'present',
                remarks:
                  action === 'exit' && prevEntry?.remarks?.includes('উপস্থিত')
                    ? `${prevEntry.remarks} · প্রস্থান ${timeLabel}`
                    : remarkText,
              },
            },
            updatedAt: new Date().toISOString(),
          },
        };
      });

      return { date: dateStr, classId: student.classId, section: sec };
    },
    []
  );

  const getDailyAttendance = (classId: string, section: string, date: string): DailyAttendanceRecord | undefined => {
    if (!section) {
      const matching = Object.values(attendanceRecords).filter(
        (r) => r.classId === classId && r.date === date
      );
      if (matching.length === 0) return undefined;
      if (matching.length === 1) return matching[0];
      const mergedRecords: Record<string, { status: AttendanceStatus; remarks?: string }> = {};
      matching.forEach((rec) => {
        Object.assign(mergedRecords, rec.records || {});
      });
      return {
        ...matching[0],
        id: `${classId}_all_${date}`,
        section: '',
        records: mergedRecords,
      };
    }

    const mergedRecords: Record<string, { status: AttendanceStatus; remarks?: string }> = {};
    let baseRecord: DailyAttendanceRecord | undefined;

    const candidates = [
      attendanceRecords[`${classId}_all_${date}`],
      attendanceRecords[`${classId}__${date}`],
      attendanceRecords[`${classId}_${section}_${date}`],
      ...Object.values(attendanceRecords).filter(
        (r) => r.classId === classId && r.date === date && r.section === section
      ),
    ];

    candidates.forEach((rec) => {
      if (!rec) return;
      if (!baseRecord) baseRecord = rec;
      Object.assign(mergedRecords, rec.records || {});
    });

    if (!baseRecord) return undefined;
    return {
      ...baseRecord,
      records: mergedRecords,
    };
  };

  const getMonthlyAttendance = (
    classId: string,
    section: string,
    year: string,
    month: number
  ) => {
    const normalizedYear = year.replace(/[০-৯]/g, (d) => '০১২৩৪৫৬৭৮৯'.indexOf(d).toString());
    const yearNum = parseInt(normalizedYear, 10) || new Date().getFullYear();

    const daysInMonthCount = new Date(yearNum, month, 0).getDate();
    const daysInMonth = Array.from({ length: daysInMonthCount }, (_, i) => i + 1);

    const classStudents = students
      .filter((s) => s.classId === classId && (!section || s.section === section))
      .sort((a, b) => a.roll - b.roll);

    const monthStr = month < 10 ? `0${month}` : `${month}`;

    const recordsByDate: Record<string, DailyAttendanceRecord> = {};
    const workingDaysSet = new Set<string>();

    Object.values(attendanceRecords).forEach((rec) => {
      if (rec.classId === classId && (!section || !rec.section || rec.section === section)) {
        if (rec.date.startsWith(`${yearNum}-${monthStr}`)) {
          recordsByDate[rec.date] = rec;
          workingDaysSet.add(rec.date);
        }
      }
    });

    const totalWorkingDays = workingDaysSet.size;

    const summaries: StudentAttendanceSummary[] = classStudents.map((std) => {
      let present = 0;
      let absent = 0;
      let late = 0;
      let leave = 0;

      workingDaysSet.forEach((dateStr) => {
        const rec = recordsByDate[dateStr];
        const entry = rec?.records[std.id];
        if (entry) {
          if (entry.status === 'present') present++;
          else if (entry.status === 'late') {
            late++;
            present++;
          } else if (entry.status === 'leave') leave++;
          else if (entry.status === 'absent') absent++;
        } else {
          absent++;
        }
      });

      const percentage = totalWorkingDays > 0 ? parseFloat(((present / totalWorkingDays) * 100).toFixed(1)) : 100;

      return {
        studentId: std.id,
        student: std,
        totalWorkingDays,
        presentDays: present,
        absentDays: absent,
        lateDays: late,
        leaveDays: leave,
        percentage,
        isEligible: percentage >= 75,
      };
    });

    const classAvg = summaries.length > 0
      ? parseFloat((summaries.reduce((acc, s) => acc + s.percentage, 0) / summaries.length).toFixed(1))
      : 0;

    return {
      daysInMonth,
      recordsByDate,
      summaries,
      classAveragePercentage: classAvg,
      totalWorkingDays,
    };
  };

  const syncAttendanceToExamRecords = (
    classId: string,
    examId: string,
    academicYear: string,
    workingDaysOverride?: number
  ) => {
    let updatedCount = 0;
    setExamRecords((prev) => {
      const next = { ...prev };
      const classStudents = students.filter((s) => s.classId === classId);

      classStudents.forEach((std) => {
        const metrics = calculateStudentAttendanceMetrics(std.id, classId, academicYear);
        const recordId = `${std.id}_${examId}_${academicYear}`;
        const existing = next[recordId];

        const workingDays = workingDaysOverride ?? (metrics.totalWorkingDays > 0 ? metrics.totalWorkingDays : 120);
        const attendance = metrics.totalWorkingDays > 0 ? metrics.presentDays : (existing?.attendance ?? 110);

        if (existing) {
          next[recordId] = {
            ...existing,
            workingDays,
            attendance,
          };
          updatedCount++;
        } else {
          next[recordId] = {
            id: recordId,
            studentId: std.id,
            examId,
            academicYear,
            classId,
            section: std.section || 'ক',
            marks: {},
            workingDays,
            attendance,
            teacherRemarks: '',
          };
          updatedCount++;
        }
      });

      return next;
    });

    return { updatedCount };
  };

  const addCalendarEvent = (eventData: Omit<AcademicCalendarEvent, 'id'>): AcademicCalendarEvent => {
    const newEvent: AcademicCalendarEvent = {
      ...eventData,
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    };
    setCalendarEvents((prev) => [...prev, newEvent]);
    return newEvent;
  };

  const updateCalendarEvent = (updatedEvent: AcademicCalendarEvent) => {
    setCalendarEvents((prev) =>
      prev.map((e) => (e.id === updatedEvent.id ? updatedEvent : e))
    );
  };

  const deleteCalendarEvent = (eventId: string) => {
    setCalendarEvents((prev) => prev.filter((e) => e.id !== eventId));
  };

  const resetCalendarEvents = () => {
    setCalendarEvents(INITIAL_CALENDAR_EVENTS);
  };

  // ==================== STUDENT FEES & DUES IMPLEMENTATION ====================
  const updateFeeHeads = (heads: FeeHead[]) => {
    setFeeHeads(heads);
  };

  const createFeeInvoice = (
    invoiceData: Omit<FeeInvoice, 'id' | 'createdAt' | 'dueAmount' | 'status'> & { id?: string }
  ): FeeInvoice => {
    const id = invoiceData.id || `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const subtotal = invoiceData.items.reduce((sum, item) => sum + (item.netAmount ?? item.amount ?? 0), 0);
    const waiverTotal = invoiceData.waiverTotal || invoiceData.items.reduce((sum, item) => sum + (item.waiver || 0), 0);
    const fineAmount = invoiceData.fineAmount || 0;
    const previousDue = invoiceData.previousDue || 0;
    const totalPayable = invoiceData.totalPayable ?? (subtotal + previousDue + fineAmount);
    const paidAmount = invoiceData.paidAmount || 0;
    const dueAmount = Math.max(0, totalPayable - paidAmount);
    const status: FeeInvoiceStatus = dueAmount === 0 ? 'paid' : (paidAmount > 0 ? 'partial' : 'unpaid');

    const newInvoice: FeeInvoice = {
      ...invoiceData,
      id,
      subtotal,
      waiverTotal,
      fineAmount,
      previousDue,
      totalPayable,
      paidAmount,
      dueAmount,
      status,
      createdAt: new Date().toISOString().split('T')[0],
    };

    setFeeInvoices((prev) => [newInvoice, ...prev]);
    return newInvoice;
  };

  const updateFeeInvoice = (updatedInvoice: FeeInvoice) => {
    const totalPayable = (updatedInvoice.subtotal || 0) + (updatedInvoice.previousDue || 0) + (updatedInvoice.fineAmount || 0);
    const dueAmount = Math.max(0, totalPayable - (updatedInvoice.paidAmount || 0));
    const status: FeeInvoiceStatus = dueAmount === 0 ? 'paid' : ((updatedInvoice.paidAmount || 0) > 0 ? 'partial' : 'unpaid');

    const finalInvoice: FeeInvoice = {
      ...updatedInvoice,
      totalPayable,
      dueAmount,
      status,
    };

    setFeeInvoices((prev) => prev.map((inv) => (inv.id === finalInvoice.id ? finalInvoice : inv)));
  };

  const deleteFeeInvoice = (id: string) => {
    setFeeInvoices((prev) => prev.filter((inv) => inv.id !== id));
  };

  const generateClassMonthlyBill = (params: {
    classId: string;
    section?: string;
    academicYear: string;
    title: string;
    billMonthYear: string;
    headIds: string[];
    dueDate: string;
    customFine?: number;
  }): { createdCount: number } => {
    const classStudents = students.filter(
      (s) => s.classId === params.classId && (!params.section || s.section === params.section)
    );

    const selectedHeads = feeHeads.filter((h) => params.headIds.includes(h.id));
    if (classStudents.length === 0 || selectedHeads.length === 0) {
      return { createdCount: 0 };
    }

    const fine = params.customFine || 0;
    const newInvoices: FeeInvoice[] = [];

    classStudents.forEach((student, index) => {
      const priorInvoices = feeInvoices.filter((inv) => inv.studentId === student.id);
      const studentPreviousDue = priorInvoices.reduce((sum, inv) => sum + (inv.dueAmount || 0), 0);

      const items: StudentFeeBillItem[] = selectedHeads.map((head) => ({
        headId: head.id,
        nameBn: head.nameBn,
        month: head.isMonthly ? params.billMonthYear : undefined,
        amount: head.defaultAmount,
        waiver: 0,
        netAmount: head.defaultAmount,
      }));

      const subtotal = items.reduce((sum, it) => sum + it.netAmount, 0);
      const totalPayable = subtotal + studentPreviousDue + fine;
      const yrCode = params.academicYear.replace(/[^0-9]/g, '').slice(-2) || '26';
      const rollStr = student.roll < 10 ? `0${student.roll}` : `${student.roll}`;
      const invoiceNumber = `INV-${yrCode}-${rollStr}${String(index + 1).padStart(2, '0')}`;

      const newInv: FeeInvoice = {
        id: `inv_${Date.now()}_${student.id}_${index}`,
        invoiceNumber,
        studentId: student.id,
        studentNameBn: student.nameBn,
        studentRoll: student.roll,
        classId: student.classId,
        section: student.section,
        academicYear: params.academicYear,
        title: params.title,
        billMonthYear: params.billMonthYear,
        items,
        subtotal,
        previousDue: studentPreviousDue,
        waiverTotal: 0,
        fineAmount: fine,
        totalPayable,
        paidAmount: 0,
        dueAmount: totalPayable,
        status: 'unpaid',
        dueDate: params.dueDate,
        createdAt: new Date().toISOString().split('T')[0],
      };

      newInvoices.push(newInv);
    });

    setFeeInvoices((prev) => [...newInvoices, ...prev]);
    return { createdCount: newInvoices.length };
  };

  const collectFeePayment = (params: {
    studentId: string;
    invoiceId?: string;
    paidAmount: number;
    paymentMethod: PaymentMethod;
    transactionRef?: string;
    collectedBy: string;
    notes?: string;
    itemsBreakdown?: { nameBn: string; amount: number }[];
  }): PaymentRecord => {
    const student = students.find((s) => s.id === params.studentId);
    if (!student) {
      throw new Error('শিক্ষার্থী খুঁজে পাওয়া যায়নি');
    }

    const paymentAmount = Math.max(0, Number(params.paidAmount) || 0);
    const now = new Date();
    const paymentDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const studentInvoices = feeInvoices.filter((inv) => inv.studentId === params.studentId);
    const previousTotalDue = studentInvoices.reduce((sum, inv) => sum + (inv.dueAmount || 0), 0);

    let amountLeftToApply = paymentAmount;
    let updatedInvoices = [...feeInvoices];

    // Deduct from specified invoice first
    if (params.invoiceId) {
      updatedInvoices = updatedInvoices.map((inv) => {
        if (inv.id === params.invoiceId && amountLeftToApply > 0) {
          const deduction = Math.min(inv.dueAmount, amountLeftToApply);
          const newPaid = inv.paidAmount + deduction;
          const newDue = Math.max(0, inv.totalPayable - newPaid);
          amountLeftToApply -= deduction;
          return {
            ...inv,
            paidAmount: newPaid,
            dueAmount: newDue,
            status: newDue === 0 ? ('paid' as FeeInvoiceStatus) : ('partial' as FeeInvoiceStatus),
            lastPaymentDate: paymentDateStr,
          };
        }
        return inv;
      });
    }

    // Deduct remaining from any unpaid invoices of this student
    if (amountLeftToApply > 0) {
      updatedInvoices = updatedInvoices.map((inv) => {
        if (inv.studentId === params.studentId && inv.dueAmount > 0 && amountLeftToApply > 0) {
          const deduction = Math.min(inv.dueAmount, amountLeftToApply);
          const newPaid = inv.paidAmount + deduction;
          const newDue = Math.max(0, inv.totalPayable - newPaid);
          amountLeftToApply -= deduction;
          return {
            ...inv,
            paidAmount: newPaid,
            dueAmount: newDue,
            status: newDue === 0 ? ('paid' as FeeInvoiceStatus) : ('partial' as FeeInvoiceStatus),
            lastPaymentDate: paymentDateStr,
          };
        }
        return inv;
      });
    }

    setFeeInvoices(updatedInvoices);

    const studentInvoicesAfter = updatedInvoices.filter((inv) => inv.studentId === params.studentId);
    const remainingDue = studentInvoicesAfter.reduce((sum, inv) => sum + (inv.dueAmount || 0), 0);

    const receiptNum = `MR-26-${String(feeReceipts.length + 1001).padStart(4, '0')}`;
    const words = numberToBengaliWords(paymentAmount);

    const newReceipt: PaymentRecord = {
      id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      receiptNumber: receiptNum,
      invoiceId: params.invoiceId,
      studentId: student.id,
      studentNameBn: student.nameBn,
      studentRoll: student.roll,
      classId: student.classId,
      section: student.section,
      academicYear: student.academicYear || selectedYear,
      paidAmount: paymentAmount,
      amountInWordsBn: words,
      paymentDate: paymentDateStr,
      paymentMethod: params.paymentMethod,
      transactionRef: params.transactionRef,
      collectedBy: params.collectedBy || 'হিসাব সহকারী',
      previousTotalDue,
      remainingDue,
      itemsBreakdown: params.itemsBreakdown && params.itemsBreakdown.length > 0
        ? params.itemsBreakdown
        : [{ nameBn: 'মাসিক বেতন ও ফি বাবদ গ্রহণ', amount: paymentAmount }],
      notes: params.notes,
    };

    setFeeReceipts((prev) => [newReceipt, ...prev]);
    return newReceipt;
  };

  const deletePaymentReceipt = (id: string) => {
    setFeeReceipts((prev) => prev.filter((r) => r.id !== id));
  };

  const getStudentDueSummary = (studentId: string): StudentDueSummary | null => {
    const student = students.find((s) => s.id === studentId);
    if (!student) return null;

    const invoices = feeInvoices.filter((inv) => inv.studentId === studentId);
    const receipts = feeReceipts.filter((rec) => rec.studentId === studentId);

    const totalBilled = invoices.reduce((sum, inv) => sum + (inv.totalPayable || 0), 0);
    const totalPaid = invoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
    const totalDue = invoices.reduce((sum, inv) => sum + (inv.dueAmount || 0), 0);

    const status: FeeInvoiceStatus = totalDue === 0 ? 'paid' : (totalPaid > 0 ? 'partial' : 'unpaid');
    const lastPaymentDate = receipts.length > 0 ? receipts[0].paymentDate : undefined;

    return {
      student,
      totalBilled,
      totalPaid,
      totalDue,
      invoices,
      receipts,
      status,
      lastPaymentDate,
    };
  };

  const getClassDueOverview = (
    classId: string,
    section?: string
  ) => {
    const classStudents = students.filter(
      (s) => s.classId === classId && (!section || s.section === section)
    );
    const studentIds = new Set(classStudents.map((s) => s.id));

    const relevantInvoices = feeInvoices.filter((inv) => studentIds.has(inv.studentId));
    const totalBilled = relevantInvoices.reduce((sum, inv) => sum + (inv.totalPayable || 0), 0);
    const totalCollected = relevantInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
    const totalDue = relevantInvoices.reduce((sum, inv) => sum + (inv.dueAmount || 0), 0);
    const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 100;

    const dueStudents = new Set(
      relevantInvoices.filter((inv) => inv.dueAmount > 0).map((inv) => inv.studentId)
    );

    return {
      totalBilled,
      totalCollected,
      totalDue,
      collectionRate,
      studentCount: classStudents.length,
      dueStudentCount: dueStudents.size,
    };
  };

  const getCalculatedResultsForClass = (
    classId: string,
    section: string,
    examId: string,
    academicYear: string
  ): CalculatedStudentResult[] => {
    const currentClass = classes.find((c) => c.id === classId);
    if (!currentClass) return [];
    const subjects = currentClass.defaultSubjects || [];
    const examTerm = examTerms.find((e) => e.id === examId);
    const examTitle = examTerm ? examTerm.nameBn : 'পরীক্ষার ফলাফল';

    // Filter students belonging to this class & section
    const classStudents = students
      .filter((s) => s.classId === classId && (!section || s.section === section))
      .sort((a, b) => a.roll - b.roll);

    // First pass: Calculate class highest marks for each subject
    const subjectHighestMarks: Record<string, number> = {};
    subjects.forEach((sub) => {
      let maxMark = 0;
      classStudents.forEach((std) => {
        const recordId = `${std.id}_${examId}_${academicYear}`;
        const rec = examRecords[recordId];
        const m = rec?.marks[sub.id]?.totalMarks;
        if (m !== null && m !== undefined && m > maxMark) {
          maxMark = m;
        }
      });
      subjectHighestMarks[sub.id] = maxMark > 0 ? maxMark : sub.fullMarks;
    });

    // Second pass: Calculate each student's result
    const resultsWithoutMerit: Omit<CalculatedStudentResult, 'meritPosition' | 'meritPositionBn'>[] = classStudents.map(
      (student) => {
        const recordId = `${student.id}_${examId}_${academicYear}`;
        const record = examRecords[recordId];

        let totalFullMarks = 0;
        let grandTotalObtained = 0;
        let totalGradePoints = 0;
        let hasFailed = false;

        const subjectRows = subjects.map((sub) => {
          totalFullMarks += sub.fullMarks;
          const subjectMark = record?.marks[sub.id];

          const obtainedMarks = subjectMark?.examMarks ?? null;
          const marks80 = subjectMark?.calcMarks80 ?? null;
          const monthly20 = subjectMark?.monthlyMarks20 ?? null;
          const totalObtained = subjectMark?.totalMarks ?? null;
          const classHighest = subjectHighestMarks[sub.id] || sub.fullMarks;

          let letterGrade = '-';
          let gradePoint = 0;

          if (totalObtained !== null && totalObtained !== undefined) {
            grandTotalObtained += totalObtained;
            const res = calculateGrade(totalObtained, sub.fullMarks);
            letterGrade = res.letterGrade;
            gradePoint = res.gradePoint;
            if (res.letterGrade === 'F') {
              hasFailed = true;
            }
          }

          totalGradePoints += gradePoint;

          return {
            subject: sub,
            fullMarks: sub.fullMarks,
            obtainedMarks,
            marks80,
            monthly20,
            totalObtained,
            classHighest,
            letterGrade,
            gradePoint,
          };
        });

        const subjectCount = subjects.length || 1;
        const gpaValue = subjects.length > 0 ? parseFloat((totalGradePoints / subjectCount).toFixed(2)) : 0;
        const finalGpa = hasFailed ? 0.0 : gpaValue;
        const overallGrade = hasFailed ? 'F' : getOverallGradeFromGpa(finalGpa);
        const averageMarks = totalFullMarks > 0 ? parseFloat(((grandTotalObtained / totalFullMarks) * 100).toFixed(1)) : 0;

        const attMetrics = calculateStudentAttendanceMetrics(student.id, classId, academicYear);
        const totalWorkingDays =
          record?.workingDays !== undefined
            ? record.workingDays
            : attMetrics.totalWorkingDays > 0
            ? attMetrics.totalWorkingDays
            : 120;
        const attendanceDays =
          record?.attendance !== undefined
            ? record.attendance
            : attMetrics.totalWorkingDays > 0
            ? attMetrics.presentDays
            : 110;
        const absenceDays = Math.max(0, totalWorkingDays - attendanceDays);
        const teacherRemarks =
          record?.teacherRemarks ||
          (finalGpa >= 4.5
            ? 'অত্যন্ত প্রশংসনীয় ও চমৎকার ফলাফল। এই ধারাবাহিকতা ধরে রাখো।'
            : finalGpa >= 3.5
            ? 'ভালো ফলাফল হয়েছে। আরো নিয়মিত পাঠাভ্যাস করলে আরও ভালো করবে।'
            : 'পড়াশোনায় আরো যত্নবান ও ক্লাসে নিয়মিত হতে হবে।');

        return {
          student,
          examTitle,
          academicYear,
          subjectRows,
          totalFullMarks,
          grandTotalObtained,
          averageMarks,
          gpa: finalGpa,
          overallGrade,
          totalWorkingDays,
          attendanceDays,
          absenceDays,
          teacherRemarks,
          isPassed: !hasFailed,
        };
      }
    );

    // Third pass: Sort for merit position (Highest GPA, then Highest Grand Total, then Roll)
    const sortedForMerit = [...resultsWithoutMerit].sort((a, b) => {
      if (b.gpa !== a.gpa) return b.gpa - a.gpa;
      if (b.grandTotalObtained !== a.grandTotalObtained) return b.grandTotalObtained - a.grandTotalObtained;
      return a.student.roll - b.student.roll;
    });

    const meritMap = new Map<string, number>();
    sortedForMerit.forEach((res, index) => {
      meritMap.set(res.student.id, index + 1);
    });

    // Return in student roll order with merit positions attached
    return resultsWithoutMerit.map((res) => {
      const position = meritMap.get(res.student.id) || 1;
      return {
        ...res,
        meritPosition: position,
        meritPositionBn: toBengaliOrdinal(position),
      };
    });
  };

  const addSyllabus = (item: Omit<SyllabusItem, 'id' | 'createdAt'>) => {
    const newItem: SyllabusItem = {
      ...item,
      id: `syl_${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setSyllabi((prev) => [newItem, ...prev]);
  };

  const deleteSyllabus = (id: string) => {
    setSyllabi((prev) => prev.filter((s) => s.id !== id));
  };

  const addNote = (note: Omit<StudyNote, 'id' | 'createdAt'>) => {
    const newNote: StudyNote = {
      ...note,
      id: `note_${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setNotes((prev) => [newNote, ...prev]);
  };

  const deleteNote = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const addQuestionPaper = (paper: Omit<QuestionPaper, 'id' | 'createdAt'>) => {
    const newPaper: QuestionPaper = {
      ...paper,
      id: `qp_${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setQuestionPapers((prev) => [newPaper, ...prev]);
  };

  const deleteQuestionPaper = (id: string) => {
    setQuestionPapers((prev) => prev.filter((p) => p.id !== id));
  };

  const uploadLibraryMaterial = async (params: {
    title: string;
    description?: string;
    category: LibraryCategory;
    fileType: LibraryFileType;
    classId: string;
    subjectId?: string;
    subjectNameBn?: string;
    chapter?: string;
    fileName: string;
    mimeType: string;
    fileSizeBytes: number;
    fileDataUrl?: string;
    externalUrl?: string;
    uploadedBy: string;
    uploadedByRole?: 'official' | 'employee';
    academicYear: string;
  }): Promise<{ success: boolean; material?: LibraryMaterial; message?: string }> => {
    const newId = `lib_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const nowIso = new Date().toISOString();

    try {
      const res = await fetch('/api/library/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newId,
          ...params,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success || !json.material) {
        return {
          success: false,
          message: json?.message || 'সার্ভারে ফাইল আপলোড করতে সমস্যা হয়েছে।',
        };
      }
      const savedMaterial = json.material as LibraryMaterial;
      suppressNextAutoPushRef.current = true;
      setLibraryMaterials((prev) => [savedMaterial, ...prev.filter((m) => m.id !== savedMaterial.id)]);
      if (cloudUser && cloudUser.emailVerified) {
        syncLibraryMaterialToFirestore(savedMaterial, cloudUser, latestStateRef.current.schoolInfo).catch(() => {});
      }
      return { success: true, material: savedMaterial };
    } catch (err: any) {
      // Offline / serverless fallback when external URL is used or small local file
      if (params.externalUrl || (params.fileDataUrl && params.fileDataUrl.length < 300_000)) {
        const fallbackMaterial: LibraryMaterial = {
          id: newId,
          title: params.title.trim(),
          description: params.description?.trim() || '',
          category: params.category,
          fileType: params.fileType,
          classId: params.classId || 'all',
          subjectId: params.subjectId || '',
          subjectNameBn: params.subjectNameBn || '',
          chapter: params.chapter?.trim() || '',
          fileName: params.fileName,
          mimeType: params.mimeType,
          fileSizeBytes: params.fileSizeBytes,
          fileUrl: params.externalUrl || params.fileDataUrl || '',
          isExternalUrl: Boolean(params.externalUrl),
          uploadedBy: params.uploadedBy || 'শিক্ষক',
          uploadedByRole: params.uploadedByRole || 'employee',
          downloadsCount: 0,
          academicYear: params.academicYear || '২০২৬',
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        setLibraryMaterials((prev) => [fallbackMaterial, ...prev]);
        return { success: true, material: fallbackMaterial };
      }
      return {
        success: false,
        message: err?.message || 'ফাইল আপলোড সম্পন্ন করা যায়নি।',
      };
    }
  };

  const updateLibraryMaterial = async (
    id: string,
    updates: Partial<
      Pick<
        LibraryMaterial,
        'title' | 'description' | 'category' | 'classId' | 'subjectId' | 'subjectNameBn' | 'chapter' | 'academicYear'
      >
    >
  ): Promise<{ success: boolean; message?: string }> => {
    const nowIso = new Date().toISOString();
    let updatedMaterial: LibraryMaterial | null = null;
    setLibraryMaterials((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          updatedMaterial = { ...m, ...updates, updatedAt: nowIso };
          return updatedMaterial;
        }
        return m;
      })
    );
    try {
      const res = await fetch(`/api/library/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        suppressNextAutoPushRef.current = true;
      }
    } catch {
      // Auto-sync will persist state
    }
    if (updatedMaterial && cloudUser && cloudUser.emailVerified) {
      syncLibraryMaterialToFirestore(updatedMaterial, cloudUser, latestStateRef.current.schoolInfo).catch(() => {});
    }
    return { success: true };
  };

  const deleteLibraryMaterial = async (id: string): Promise<void> => {
    setLibraryMaterials((prev) => prev.filter((m) => m.id !== id));
    try {
      const res = await fetch(`/api/library/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.ok) {
        suppressNextAutoPushRef.current = true;
      }
    } catch {
      // Non-fatal
    }
    if (cloudUser && cloudUser.emailVerified) {
      deleteLibraryMaterialFromFirestore(id, cloudUser).catch(() => {});
    }
  };

  const trackLibraryDownload = async (id: string): Promise<void> => {
    let nextMat: LibraryMaterial | null = null;
    setLibraryMaterials((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          nextMat = { ...m, downloadsCount: (m.downloadsCount || 0) + 1 };
          return nextMat;
        }
        return m;
      })
    );
    try {
      const res = await fetch(`/api/library/${encodeURIComponent(id)}/download`, {
        method: 'POST',
      });
      if (res.ok) {
        suppressNextAutoPushRef.current = true;
      }
    } catch {
      // Non-fatal
    }
    if (nextMat && cloudUser && cloudUser.emailVerified) {
      syncLibraryMaterialToFirestore(nextMat, cloudUser, latestStateRef.current.schoolInfo).catch(() => {});
    }
  };

  const addSMSLog = (log: Omit<SMSLog, 'id' | 'sentAt'>) => {
    const newLog: SMSLog = {
      ...log,
      id: `sms_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sentAt: new Date().toLocaleString('bn-BD', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
    setSmsLogs((prev) => [newLog, ...prev]);
  };

  const deleteSMSLog = (id: string) => {
    setSmsLogs((prev) => prev.filter((l) => l.id !== id));
  };

  const clearSMSLogs = () => {
    setSmsLogs([]);
  };

  const updateSMSGatewayConfig = (cfg: Partial<SMSGatewayConfig>) => {
    setSmsGatewayConfig((prev) => ({ ...prev, ...cfg }));
  };

  const sendSingleSMS = async (
    phone: string,
    messageText: string,
    recipientName: string,
    meta?: {
      roll?: number;
      className?: string;
      messageType?: SMSLog['messageType'];
      channel?: SMSLog['channel'];
    }
  ): Promise<{ success: boolean; message: string }> => {
    const channel = meta?.channel || (smsGatewayConfig.provider === 'device_sms' ? 'device_sms' : 'gateway');
    const msgType = meta?.messageType || 'notice';

    if (channel === 'device_sms') {
      const cleanPhone = phone.replace(/[\s\-\+\(\)]/g, '');
      const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
      const smsUri = isIOS
        ? `sms:${cleanPhone}&body=${encodeURIComponent(messageText)}`
        : `sms:${cleanPhone}?body=${encodeURIComponent(messageText)}`;

      try {
        window.location.href = smsUri;
      } catch {
        // Fallback or preview
      }

      addSMSLog({
        recipientPhone: phone,
        recipientName,
        studentRoll: meta?.roll,
        className: meta?.className,
        messageType: msgType,
        messageText,
        status: 'sent',
        channel: 'device_sms',
      });

      return { success: true, message: 'ফোনের মেসেজিং অ্যাপ ওপেন করা হয়েছে' };
    }

    if (channel === 'whatsapp') {
      let cleanPhone = phone.replace(/[\s\-\+\(\)]/g, '');
      if (cleanPhone.startsWith('0')) cleanPhone = '88' + cleanPhone;
      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`, '_blank');

      addSMSLog({
        recipientPhone: phone,
        recipientName,
        studentRoll: meta?.roll,
        className: meta?.className,
        messageType: msgType,
        messageText,
        status: 'sent',
        channel: 'whatsapp',
      });

      return { success: true, message: 'হোয়াটসঅ্যাপে চ্যাট চালু করা হয়েছে' };
    }

    // Gateway mode
    try {
      if (smsGatewayConfig.webhookUrl) {
        await fetch(smsGatewayConfig.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: smsGatewayConfig.apiKey,
            senderId: smsGatewayConfig.senderId,
            to: phone,
            message: messageText,
          }),
        }).catch(() => {});
      }

      setSmsGatewayConfig((prev) => ({
        ...prev,
        balance: Math.max(0, (prev.balance || 0) - 1),
      }));

      addSMSLog({
        recipientPhone: phone,
        recipientName,
        studentRoll: meta?.roll,
        className: meta?.className,
        messageType: msgType,
        messageText,
        status: 'delivered',
        channel: 'gateway',
      });

      return { success: true, message: 'এসএমএস সফলভাবে প্রেরিত হয়েছে' };
    } catch {
      return { success: false, message: 'এসএমএস পাঠাতে সমস্যা হয়েছে' };
    }
  };

  const sendBatchSMS = async (
    items: {
      phone: string;
      text: string;
      recipientName: string;
      roll?: number;
      className?: string;
    }[],
    messageType: SMSLog['messageType']
  ): Promise<{ sentCount: number; failedCount: number }> => {
    let sentCount = 0;
    let failedCount = 0;
    const nowStr = new Date().toLocaleString('bn-BD', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const newLogs: SMSLog[] = [];

    for (const item of items) {
      if (!item.phone || item.phone.trim().length < 10) {
        failedCount++;
        continue;
      }

      newLogs.push({
        id: `sms_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        recipientPhone: item.phone,
        recipientName: item.recipientName,
        studentRoll: item.roll,
        className: item.className,
        messageType,
        messageText: item.text,
        sentAt: nowStr,
        status: 'delivered',
        channel: smsGatewayConfig.provider === 'device_sms' ? 'device_sms' : 'gateway',
      });
      sentCount++;
    }

    if (newLogs.length > 0) {
      setSmsLogs((prev) => [...newLogs, ...prev]);
      if (smsGatewayConfig.provider !== 'device_sms') {
        setSmsGatewayConfig((prev) => ({
          ...prev,
          balance: Math.max(0, (prev.balance || 0) - sentCount),
        }));
      }
    }

    return { sentCount, failedCount };
  };

  const exportDatabaseBackup = () => {
    const backupData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      schoolInfo,
      classes,
      examTerms,
      students,
      examRecords,
      syllabi,
      notes,
      questionPapers,
      libraryMaterials,
      smsLogs,
      smsGatewayConfig,
      attendanceRecords,
      calendarEvents,
      feeHeads,
      feeInvoices,
      feeReceipts,
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dlikon_academy_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const importDatabaseBackup = (jsonContent: string): { success: boolean; message: string } => {
    try {
      const data = JSON.parse(jsonContent);
      if (!data.schoolInfo && !data.students) {
        return { success: false, message: 'অকার্যকর ব্যাকআপ ফাইল। সঠিক ফাইল নির্বাচন করুন।' };
      }

      if (data.schoolInfo) setSchoolInfo(data.schoolInfo);
      if (Array.isArray(data.classes)) setClasses(data.classes);
      if (Array.isArray(data.students)) setStudents(data.students);
      if (data.examRecords) setExamRecords(data.examRecords);
      if (Array.isArray(data.syllabi)) setSyllabi(data.syllabi);
      if (Array.isArray(data.notes)) setNotes(data.notes);
      if (Array.isArray(data.questionPapers)) setQuestionPapers(data.questionPapers);
      if (Array.isArray(data.libraryMaterials)) setLibraryMaterials(data.libraryMaterials);
      if (Array.isArray(data.smsLogs)) setSmsLogs(data.smsLogs);
      if (data.smsGatewayConfig) setSmsGatewayConfig(data.smsGatewayConfig);
      if (data.attendanceRecords) setAttendanceRecords(data.attendanceRecords);
      if (Array.isArray(data.calendarEvents)) setCalendarEvents(data.calendarEvents);
      if (Array.isArray(data.feeHeads)) setFeeHeads(data.feeHeads);
      if (Array.isArray(data.feeInvoices)) setFeeInvoices(data.feeInvoices);
      if (Array.isArray(data.feeReceipts)) setFeeReceipts(data.feeReceipts);

      return { success: true, message: 'ডাটাবেস সফলভাবে রিস্টোর করা হয়েছে!' };
    } catch (e: any) {
      return { success: false, message: `ত্রুটি: ${e?.message || 'ব্যাকআপ ফাইলটি পড়তে ব্যর্থ হয়েছে'}` };
    }
  };

  const forceServerSync = async (): Promise<void> => {
    await pushToServer();
    await fetchFromServer({ force: true });
    if (cloudUser && cloudUser.emailVerified) {
      await syncAllPhotosToCloudWithUser(cloudUser).catch(() => {});
    }
  };

  const verifyAndRepairPhotoIntegrity = useCallback(async (): Promise<PhotoIntegrityReport> => {
    const currentStudents = latestStateRef.current.students;
    const currentClasses = latestStateRef.current.classes;

    // 1. Local audit & repair from IndexedDB photo map (by ID + (classId, roll) relation)
    const idbPhotoMap = await idbGet<Record<string, StudentPhotoRegistryEntry>>(
      `${STORAGE_KEY}_student_photos_map`
    ).catch(() => null);

    if (idbPhotoMap && typeof idbPhotoMap === 'object') {
      studentPhotoMapRef.current = { ...studentPhotoMapRef.current, ...idbPhotoMap };
    }

    const localAudit = auditAndRepairLocalStudentPhotos(
      currentStudents,
      currentClasses,
      studentPhotoMapRef.current
    );

    let mergedStudents = localAudit.repairedStudents;
    let totalRepaired = localAudit.repairedCount;
    let totalProtected = 0;
    let serverVerified = false;
    let totalRegistryEntries = Object.keys(studentPhotoMapRef.current).length;

    // 2. Push any locally repaired photos up, then run server-side relational verification/repair
    try {
      if (localAudit.repairedCount > 0) {
        const repairedItems = mergedStudents.filter(
          (s, idx) =>
            (s.avatarUrl || '') !== (currentStudents[idx]?.avatarUrl || '') ||
            (s.fatherAvatarUrl || '') !== (currentStudents[idx]?.fatherAvatarUrl || '') ||
            (s.motherAvatarUrl || '') !== (currentStudents[idx]?.motherAvatarUrl || '')
        );
        if (repairedItems.length > 0) {
          await pushPhotosInChunks(repairedItems).catch(() => {});
        }
      }

      const res = await fetch('/api/students/verify-photo-integrity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        serverVerified = true;
        const srvReport = await res.json();
        totalRepaired += Number(srvReport.repairedCount || 0);
        totalProtected += Number(srvReport.protectedCount || 0);
        totalRegistryEntries = Math.max(
          totalRegistryEntries,
          Number(srvReport.totalRegistryEntries || 0)
        );
      }

      // Pull fresh server student snapshot and merge safely without losing local photos
      const dbRes = await fetch('/api/school-data', { cache: 'no-store' });
      if (dbRes.ok) {
        const dbJson = await dbRes.json();
        const srvStudents: Student[] = Array.isArray(dbJson?.data?.students) ? dbJson.data.students : [];
        if (srvStudents.length > 0) {
          const srvById = new Map<string, Student>();
          const srvByRel = new Map<string, Student>();
          for (const ss of srvStudents) {
            if (ss?.id) srvById.set(ss.id, ss);
            const rk = buildStudentRelationKey(ss, false);
            if (rk) srvByRel.set(rk, ss);
          }
          mergedStudents = mergedStudents.map((loc) => {
            const srvMatch = srvById.get(loc.id) || srvByRel.get(buildStudentRelationKey(loc, false));
            const resRec = reconcileStudentPhotoReferences(loc, srvMatch, studentPhotoMapRef.current[loc.id]);
            if (resRec.protectedFields.length > 0 && (srvMatch?.avatarUrl || srvMatch?.fatherAvatarUrl || srvMatch?.motherAvatarUrl)) {
              totalProtected += resRec.protectedFields.length;
            }
            return resRec.student;
          });
        }
      }
    } catch {
      // Offline/local fallback still valid
    }

    const finalAudit = auditAndRepairLocalStudentPhotos(
      mergedStudents,
      currentClasses,
      studentPhotoMapRef.current
    );

    suppressNextAutoPushRef.current = true;
    setStudents(finalAudit.repairedStudents);
    await idbSet(`${STORAGE_KEY}_students`, finalAudit.repairedStudents);
    persistStudentPhotoMapToIdb(finalAudit.repairedStudents);

    const totalWithStudentPhoto = finalAudit.repairedStudents.filter((s) =>
      isValidImageReference(s.avatarUrl)
    ).length;
    const class1To8List = finalAudit.repairedStudents.filter((s) => CLASS_1_TO_8_IDS.has(s.classId));
    const class1To8WithStudentPhoto = class1To8List.filter((s) =>
      isValidImageReference(s.avatarUrl)
    ).length;

    const message = serverVerified
      ? `✓ ১ম–৮ম শ্রেণিসহ মোট ${toBengaliNumber(finalAudit.repairedStudents.length)} জন শিক্ষার্থীর ছবির ডাটাবেস সম্পর্ক যাচাই সম্পন্ন (${toBengaliNumber(class1To8WithStudentPhoto)}/${toBengaliNumber(class1To8List.length)} জন ১ম–৮ম শ্রেণির ছবি সুরক্ষিত${totalRepaired > 0 ? `, ${toBengaliNumber(totalRepaired)}টি পুনরুদ্ধার` : ''})।`
      : `লোকাল ইনডেক্সডডিবি থেকে ছবির সম্পর্ক যাচাই সম্পন্ন (${toBengaliNumber(class1To8WithStudentPhoto)}/${toBengaliNumber(class1To8List.length)} জন ১ম–৮ম শ্রেণির ছবি)।`;

    return {
      checkedAt: new Date().toISOString(),
      totalStudents: finalAudit.repairedStudents.length,
      totalWithStudentPhoto,
      totalRegistryEntries: Math.max(totalRegistryEntries, Object.keys(studentPhotoMapRef.current).length),
      repairedCount: totalRepaired,
      protectedCount: totalProtected,
      class1To8TotalStudents: class1To8List.length,
      class1To8WithStudentPhoto,
      perClass: finalAudit.perClass,
      serverVerified,
      message,
    };
  }, [persistStudentPhotoMapToIdb, pushPhotosInChunks]);

  const seedParentDetailsForClass = (classId: string): number => {
    const sampleParents = [
      { father: 'মোঃ আবুল কাশেম', fatherEn: 'Md. Abul Kashem', mother: 'নাসরিন জাহান', motherEn: 'Nasrin Jahan', phone: '01712345678', nid: '1984261529100012' },
      { father: 'আনিসুর রহমান', fatherEn: 'Anisur Rahman', mother: 'শাহানাজ পারভীন', motherEn: 'Shahanaj Parvin', phone: '01812345679', nid: '1982261529100088' },
      { father: 'মোঃ মোজাম্মেল হক', fatherEn: 'Md. Mozammel Haque', mother: 'রাবেয়া খাতুন', motherEn: 'Rabeya Khatun', phone: '01912345680', nid: '1985261529100091' },
      { father: 'মোঃ সেলিম হোসেন', fatherEn: 'Md. Selim Hossain', mother: 'শিরিনা আক্তার', motherEn: 'Shirina Akter', phone: '01734567890', nid: '1983261529100055' },
      { father: 'নুরুল ইসলাম', fatherEn: 'Nurul Islam', mother: 'জাহানারা বেগম', motherEn: 'Jahanara Begum', phone: '01623456781', nid: '1981261529100042' },
      { father: 'মোঃ আব্দুল বাতেন', fatherEn: 'Md. Abdul Baten', mother: 'খালেদা আক্তার', motherEn: 'Khaleda Akter', phone: '01512345682', nid: '1986261529100077' },
      { father: 'মোঃ সিরাজুল ইসলাম', fatherEn: 'Md. Sirajul Islam', mother: 'ফারহানা আক্তার', motherEn: 'Farhana Akter', phone: '01711223344', nid: '1987261529100033' },
      { father: 'জহিরুল ইসলাম', fatherEn: 'Zahirul Islam', mother: 'রোকেয়া বেগম', motherEn: 'Rokeya Begum', phone: '01811223355', nid: '1980261529100019' },
      { father: 'মোঃ রফিকুল ইসলাম', fatherEn: 'Md. Rafiqul Islam', mother: 'মরিয়ম আক্তার', motherEn: 'Morium Akter', phone: '01911223366', nid: '1988261529100064' },
      { father: 'কবীর হোসেন', fatherEn: 'Kabir Hossain', mother: 'তাসলিমা খাতুন', motherEn: 'Taslima Khatun', phone: '01611223377', nid: '1984261529100028' },
    ];

    let updatedCount = 0;
    setStudents((prev) => {
      const updated = prev.map((s, idx) => {
        if (s.classId === classId) {
          const sample = sampleParents[idx % sampleParents.length];
          const hasFather = Boolean(s.fatherNameBn?.trim() || s.fatherName?.trim());
          const hasMother = Boolean(s.motherNameBn?.trim() || s.motherName?.trim());
          const hasPhone = Boolean(s.fatherPhone?.trim() || s.guardianPhone?.trim());

          if (!hasFather || !hasMother || !hasPhone) {
            updatedCount++;
            const fName = s.fatherNameBn || s.fatherName || sample.father;
            const mName = s.motherNameBn || s.motherName || sample.mother;
            const phone = s.fatherPhone || s.guardianPhone || sample.phone;
            return reconcileStudentPhotoReferences(
              {
                ...s,
                fatherName: fName,
                fatherNameBn: fName,
                fatherNameEn: s.fatherNameEn || sample.fatherEn,
                fatherNid: s.fatherNid || sample.nid,
                fatherPhone: phone,
                motherName: mName,
                motherNameBn: mName,
                motherNameEn: s.motherNameEn || sample.motherEn,
                motherNid: s.motherNid || sample.nid.slice(0, -2) + '99',
                motherPhone: s.motherPhone || phone,
                guardianName: s.guardianName || fName,
                guardianPhone: phone,
                presentAddress: s.presentAddress || 'দক্ষিণগাঁও, সনমানিয়া, কাপাসিয়া, গাজীপুর।',
              },
              s,
              studentPhotoMapRef.current[s.id]
            ).student;
          }
        }
        return s;
      });
      idbSet(`${STORAGE_KEY}_students`, updated);
      persistStudentPhotoMapToIdb(updated);
      return updated;
    });

    return updatedCount;
  };

  const clearAllStudents = async () => {
    setStudents([]);
    setExamRecords({});
    setAttendanceRecords({});
    setFeeInvoices([]);
    setFeeReceipts([]);
    setSecurityLogs([]);

    try {
      localStorage.removeItem(`${STORAGE_KEY}_students`);
      localStorage.removeItem(`${STORAGE_KEY}_exam_records`);
      localStorage.removeItem(`${STORAGE_KEY}_attendance`);
      localStorage.removeItem(`${STORAGE_KEY}_fee_invoices`);
      localStorage.removeItem(`${STORAGE_KEY}_fee_receipts`);
      localStorage.removeItem(`${STORAGE_KEY}_security_logs`);
      await idbSet(`${STORAGE_KEY}_students`, []);
      await idbSet(`${STORAGE_KEY}_security_logs`, []);
    } catch (e) {
      console.warn('Error clearing local storage caches:', e);
    }

    try {
      await fetch('/api/students/clear-all', { method: 'POST' });
      setServerSyncStatus('synced');
      setLastSyncedTime(new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (e) {
      console.warn('Error calling /api/students/clear-all:', e);
    }
  };

  const scanAndRecoverBrowserData = async (): Promise<{ studentCount: number; recoveredPhotoCount?: number; message: string }> => {
    const candidates: Student[][] = [];

    const collectValidStudents = (rawList: any[]) => {
      const studentItems = rawList.filter(
        (item: any) => item && typeof item === 'object' && item.nameBn && (item.roll !== undefined || item.classId)
      );
      if (studentItems.length > 0) {
        const nonDemo = studentItems.filter(
          (s: Student) => !['std_4_01', 'std_4_02', 'std_4_03', 'std_4_04', 'std_4_05'].includes(s.id)
        );
        if (nonDemo.length > 0) candidates.push(nonDemo);
      }
    };

    // 1. Scan all localStorage keys
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        try {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) collectValidStudents(parsed);
        } catch {
          // Ignore non-JSON
        }
      }
    } catch (e) {
      console.warn('Error scanning localStorage:', e);
    }

    // 2. Scan IndexedDB
    try {
      const idbData = await idbGet<Student[]>(`${STORAGE_KEY}_students`);
      if (idbData && Array.isArray(idbData)) collectValidStudents(idbData);
    } catch (e) {
      console.warn('Error reading IndexedDB during recovery:', e);
    }

    // 3. Scan sessionStorage
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (!key) continue;
        try {
          const raw = sessionStorage.getItem(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) collectValidStudents(parsed);
        } catch {
          // Ignore
        }
      }
    } catch (e) {
      console.warn('Error scanning sessionStorage:', e);
    }

    if (candidates.length > 0) {
      // Merge recovered records + any cached photos with current students
      const currentList = latestStateRef.current.students;
      const baseMap = new Map<string, Student>();
      currentList.forEach((s) => baseMap.set(s.id, s));

      let recoveredPhotoCount = 0;
      let addedStudentCount = 0;

      for (const batch of candidates) {
        for (const item of batch) {
          const existing = baseMap.get(item.id);
          if (!existing) {
            baseMap.set(item.id, item);
            addedStudentCount++;
            if (item.avatarUrl || item.fatherAvatarUrl || item.motherAvatarUrl) {
              recoveredPhotoCount++;
            }
          } else {
            let photoFound = false;
            const nextAvatar = existing.avatarUrl || item.avatarUrl || '';
            const nextFather = existing.fatherAvatarUrl || item.fatherAvatarUrl || '';
            const nextMother = existing.motherAvatarUrl || item.motherAvatarUrl || '';
            if (
              (!existing.avatarUrl && item.avatarUrl) ||
              (!existing.fatherAvatarUrl && item.fatherAvatarUrl) ||
              (!existing.motherAvatarUrl && item.motherAvatarUrl)
            ) {
              photoFound = true;
              recoveredPhotoCount++;
            }
            if (photoFound) {
              baseMap.set(item.id, {
                ...existing,
                avatarUrl: nextAvatar,
                fatherAvatarUrl: nextFather,
                motherAvatarUrl: nextMother,
                photoUpdatedAt: existing.photoUpdatedAt || item.photoUpdatedAt || new Date().toISOString(),
              });
            }
          }
        }
      }

      const recovered = Array.from(baseMap.values());
      setStudents(recovered);
      await idbSet(`${STORAGE_KEY}_students`, recovered);
      await pushPhotosInChunks(recovered).catch(() => {});

      if (cloudUser && cloudUser.emailVerified && recoveredPhotoCount > 0) {
        batchPushStudentsToFirestore(recovered, cloudUser, latestStateRef.current.schoolInfo).catch(() => {});
      }

      return {
        studentCount: recovered.length,
        recoveredPhotoCount,
        message:
          recoveredPhotoCount > 0 || addedStudentCount > 0
            ? `ব্রাউজার ক্যাশ থেকে ${toBengaliNumber(recoveredPhotoCount)}টি হারানো ছবি ও ${toBengaliNumber(recovered.length)} জন শিক্ষার্থীর তথ্য উদ্ধার করে সার্ভারে সংরক্ষিত হয়েছে!`
            : `বর্তমানে ব্রাউজার ক্যাশে অতিরিক্ত কোনো হারানো ছবি পাওয়া যায়নি (সর্বমোট ${toBengaliNumber(recovered.length)} জন শিক্ষার্থী রয়েছে)।`,
      };
    }

    return {
      studentCount: 0,
      recoveredPhotoCount: 0,
      message: 'এই ব্রাউজারে পূর্বের সংরক্ষিত কোনো বাড়তি ছবি বা রেকর্ড পাওয়া যায়নি।',
    };
  };

  const resetToDefaultData = () => {
    setSchoolInfo(DEFAULT_SCHOOL_INFO);
    setClasses(DEFAULT_CLASSES);
    setStudents(INITIAL_STUDENTS);
    const initialMap: Record<string, StudentExamRecord> = {};
    INITIAL_EXAM_RECORDS.forEach((rec) => {
      initialMap[rec.id] = rec;
    });
    setExamRecords(initialMap);
    setSyllabi(INITIAL_SYLLABI);
    setNotes(INITIAL_NOTES);
    setQuestionPapers(INITIAL_QUESTION_PAPERS);
    setLibraryMaterials(INITIAL_LIBRARY_MATERIALS);
    setAttendanceRecords(INITIAL_ATTENDANCE_RECORDS);
    setCalendarEvents(INITIAL_CALENDAR_EVENTS);
    setFeeHeads(DEFAULT_FEE_HEADS);
    setFeeInvoices(INITIAL_FEE_INVOICES);
    setFeeReceipts(INITIAL_PAYMENT_RECEIPTS);
  };

  return (
    <SchoolContext.Provider
      value={{
        schoolInfo,
        updateSchoolInfo,
        classes,
        updateClasses,
        updateClassSubjects,
        addSubjectToClass,
        addSubjectToMultipleClasses,
        updateSubjectInClass,
        deleteSubjectFromClass,
        reorderClassSubjects,
        copySubjectsBetweenClasses,
        resetClassSubjectsToDefault,
        examTerms,
        students,
        addStudent,
        updateStudent,
        updateStudentPhoto,
        batchUpdateStudentPhotos,
        deleteStudent,
        bulkImportStudents,
        moveStudentsToClass,
        deleteStudentsByClass,
        deleteMultipleStudents,
        examRecords,
        saveMarkRecord,
        bulkSaveSubjectMarks,
        getCalculatedResultsForClass,
        syllabi,
        addSyllabus,
        deleteSyllabus,
        notes,
        addNote,
        deleteNote,
        questionPapers,
        addQuestionPaper,
        deleteQuestionPaper,
        libraryMaterials,
        uploadLibraryMaterial,
        updateLibraryMaterial,
        deleteLibraryMaterial,
        trackLibraryDownload,
        exportDatabaseBackup,
        importDatabaseBackup,
        resetToDefaultData,
        selectedYear,
        setSelectedYear,
        selectedExamId,
        setSelectedExamId,
        selectedClassId,
        setSelectedClassId,
        selectedSection,
        setSelectedSection,
        smsLogs,
        addSMSLog,
        deleteSMSLog,
        clearSMSLogs,
        smsGatewayConfig,
        updateSMSGatewayConfig,
        sendSingleSMS,
        sendBatchSMS,
        attendanceRecords,
        saveDailyAttendance,
        markStudentAttendanceFromScan,
        upsertAttendanceRecordFromServer,
        getDailyAttendance,
        getMonthlyAttendance,
        calculateStudentAttendanceMetrics,
        syncAttendanceToExamRecords,
        calendarEvents,
        addCalendarEvent,
        updateCalendarEvent,
        deleteCalendarEvent,
        resetCalendarEvents,
        feeHeads,
        updateFeeHeads,
        feeInvoices,
        createFeeInvoice,
        updateFeeInvoice,
        deleteFeeInvoice,
        generateClassMonthlyBill,
        feeReceipts,
        collectFeePayment,
        deletePaymentReceipt,
        getStudentDueSummary,
        getClassDueOverview,
        securityLogs,
        addSecurityLog,
        updateSecurityLogEtiquette,
        acknowledgeSecurityLog,
        clearSecurityLogs,
        isServerSyncing,
        serverSyncStatus,
        syncErrorMessage,
        lastSyncedTime,
        forceServerSync,
        seedParentDetailsForClass,
        clearAllStudents,
        scanAndRecoverBrowserData,
        verifyAndRepairPhotoIntegrity,
        cloudUser,
        cloudSyncError,
        cloudUnauthorizedDomain,
        isCloudPhotoSyncing,
        cloudPhotoSyncProgress,
        connectCloudSync,
        disconnectCloudSync,
        syncAllPhotosToCloud,
        broadcastSecurityLogToCloud,
      }}
    >
      {children}
    </SchoolContext.Provider>
  );
};

export const useSchool = () => {
  const context = useContext(SchoolContext);
  if (!context) {
    throw new Error('useSchool must be used within a SchoolProvider');
  }
  return context;
};
