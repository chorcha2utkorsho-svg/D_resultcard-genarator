import React, { createContext, useContext, useState, useEffect } from 'react';
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
} from '../types';
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
} from '../data/defaultData';
import { calculateGrade, formatGpa, getOverallGradeFromGpa, toBengaliOrdinal } from '../utils/bengali';
import { numberToBengaliWords } from '../utils/bengaliWords';

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
  updateStudent: (student: Student) => void;
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
      return saved ? JSON.parse(saved) : INITIAL_STUDENTS;
    } catch {
      return INITIAL_STUDENTS;
    }
  });

  const [examRecords, setExamRecords] = useState<Record<string, StudentExamRecord>>(() => {
    try {
      const initialMap: Record<string, StudentExamRecord> = {};
      INITIAL_EXAM_RECORDS.forEach((rec) => {
        initialMap[rec.id] = rec;
      });
      const saved = localStorage.getItem(`${STORAGE_KEY}_exam_records`);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...initialMap, ...parsed };
      }
      return initialMap;
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

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_students`, JSON.stringify(students));
    } catch (e) {
      console.error('Failed to save students', e);
    }
  }, [students]);

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
    const newStudent: Student = { ...studentData, id: newId };
    setStudents((prev) => [...prev, newStudent]);
    return newStudent;
  };

  const updateStudent = (student: Student) => {
    setStudents((prev) => prev.map((s) => (s.id === student.id ? student : s)));
  };

  const deleteStudent = (studentId: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== studentId));
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
            baseList[existingIdx] = {
              ...baseList[existingIdx],
              ...item,
            };
          } else {
            toAdd.push({
              ...item,
              id: `std_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
            });
          }
        });
        return [...baseList, ...toAdd];
      }

      // Default: append
      const created: Student[] = newStudentsData.map((data, idx) => ({
        ...data,
        id: `std_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      }));
      return [...baseList, ...created];
    });

    return newStudentsData.length;
  };

  const moveStudentsToClass = (studentIds: string[], targetClassId: string, targetSection?: string): number => {
    const idSet = new Set(studentIds);
    let count = 0;
    setStudents((prev) =>
      prev.map((s) => {
        if (idSet.has(s.id)) {
          count++;
          return {
            ...s,
            classId: targetClassId,
            ...(targetSection !== undefined ? { section: targetSection } : {}),
          };
        }
        return s;
      })
    );
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

  const getDailyAttendance = (classId: string, section: string, date: string): DailyAttendanceRecord | undefined => {
    const idWithSec = `${classId}_${section || 'all'}_${date}`;
    if (attendanceRecords[idWithSec]) return attendanceRecords[idWithSec];
    const idWithBlank = `${classId}__${date}`;
    if (attendanceRecords[idWithBlank]) return attendanceRecords[idWithBlank];
    return Object.values(attendanceRecords).find(
      (r) => r.classId === classId && r.date === date && (!section || r.section === section)
    );
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
