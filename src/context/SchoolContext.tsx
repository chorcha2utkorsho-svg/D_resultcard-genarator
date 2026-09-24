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
} from '../data/defaultData';
import { calculateGrade, formatGpa, getOverallGradeFromGpa, toBengaliOrdinal } from '../utils/bengali';

interface SchoolContextType {
  schoolInfo: SchoolInfo;
  updateSchoolInfo: (info: Partial<SchoolInfo>) => void;
  classes: SchoolClass[];
  updateClasses: (classes: SchoolClass[]) => void;
  updateClassSubjects: (classId: string, subjects: Subject[]) => void;
  examTerms: ExamTerm[];
  students: Student[];
  addStudent: (student: Omit<Student, 'id'>) => Student;
  updateStudent: (student: Student) => void;
  deleteStudent: (studentId: string) => void;
  bulkImportStudents: (students: Omit<Student, 'id'>[]) => number;
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
      const saved = localStorage.getItem(`${STORAGE_KEY}_exam_records`);
      if (saved) return JSON.parse(saved);
      const initialMap: Record<string, StudentExamRecord> = {};
      INITIAL_EXAM_RECORDS.forEach((rec) => {
        initialMap[rec.id] = rec;
      });
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

  // Global Filter selections
  const [selectedYear, setSelectedYear] = useState<string>('২০২৬');
  const [selectedExamId, setSelectedExamId] = useState<string>('term_2');
  const [selectedClassId, setSelectedClassId] = useState<string>('class_4');
  const [selectedSection, setSelectedSection] = useState<string>('ক');

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

  const bulkImportStudents = (newStudentsData: Omit<Student, 'id'>[]): number => {
    const created: Student[] = newStudentsData.map((data, idx) => ({
      ...data,
      id: `std_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
    }));
    setStudents((prev) => [...prev, ...created]);
    return created.length;
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
        // 80% of exam mark
        calcMarks80 = parseFloat(((updatedExamMarks * 80) / 100).toFixed(1));
        const monthly = updatedMonthlyMarks || 0;
        totalMarks = Math.round(calcMarks80 + monthly);
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
          calcMarks80 = parseFloat(((sm.examMarks * 80) / 100).toFixed(1));
          const monthly = sm.monthlyMarks20 || 0;
          totalMarks = Math.round(calcMarks80 + monthly);
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

        const totalWorkingDays = record?.workingDays || 120;
        const attendanceDays = record?.attendance !== undefined ? record.attendance : 110;
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
  };

  return (
    <SchoolContext.Provider
      value={{
        schoolInfo,
        updateSchoolInfo,
        classes,
        updateClasses,
        updateClassSubjects,
        examTerms,
        students,
        addStudent,
        updateStudent,
        deleteStudent,
        bulkImportStudents,
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
