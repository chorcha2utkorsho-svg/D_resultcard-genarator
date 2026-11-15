import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Save,
  CheckCircle2,
  Users,
  BookOpen,
  Calendar,
  Layers,
  ArrowRight,
  Mic,
  MicOff,
  Volume2,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { AttendanceStatus } from '../types';
import { calculateGrade, toBengaliNumber, toBengaliRoll } from '../utils/bengali';
import {
  BrowserSpeechRecognition,
  getSpeechRecognitionConstructor,
  parseClassroomVoiceCommands,
} from '../utils/voiceCommandParser';

interface MarkEntryViewProps {
  onNavigate?: (tab: string) => void;
}

export const MarkEntryView: React.FC<MarkEntryViewProps> = ({ onNavigate }) => {
  const {
    classes,
    examTerms,
    students,
    examRecords,
    saveMarkRecord,
    bulkSaveSubjectMarks,
    saveDailyAttendance,
    getDailyAttendance,
    selectedYear,
    setSelectedYear,
    selectedExamId,
    setSelectedExamId,
    selectedClassId,
    setSelectedClassId,
    selectedSection,
    setSelectedSection,
  } = useSchool();

  // Active Subject selection
  const currentClass = classes.find((c) => c.id === selectedClassId) || classes[0];
  const subjects = useMemo(() => currentClass?.defaultSubjects || [], [currentClass]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(subjects[0]?.id || '');

  // Keep subject in sync when class changes
  useEffect(() => {
    if (subjects.length > 0 && !subjects.find((s) => s.id === selectedSubjectId)) {
      setSelectedSubjectId(subjects[0].id);
    }
  }, [selectedClassId, subjects, selectedSubjectId]);

  const activeSubject = subjects.find((s) => s.id === selectedSubjectId) || subjects[0];
  const fullMarks = activeSubject?.fullMarks || 100;

  // Filter students for selected class and section
  const filteredStudents = students
    .filter((s) => s.classId === selectedClassId && (!selectedSection || s.section === selectedSection))
    .sort((a, b) => a.roll - b.roll);

  // Local state for fast input editing
  const [localMarks, setLocalMarks] = useState<
    Record<
      string,
      {
        examMarks: string;
        monthly20: string;
        workingDays: string;
        attendance: string;
        remarks: string;
      }
    >
  >({});

  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [entryMode, setEntryMode] = useState<'subject_wise' | 'student_wise'>('subject_wise');
  const [activeStudentId, setActiveStudentId] = useState<string>(filteredStudents[0]?.id || '');

  // Initialize local marks from context exam records
  useEffect(() => {
    const newLocalMarks: Record<
      string,
      { examMarks: string; monthly20: string; workingDays: string; attendance: string; remarks: string }
    > = {};

    filteredStudents.forEach((student) => {
      const recordId = `${student.id}_${selectedExamId}_${selectedYear}`;
      const record = examRecords[recordId];
      const subjectMark = record?.marks[selectedSubjectId];

      newLocalMarks[student.id] = {
        examMarks: subjectMark?.examMarks !== null && subjectMark?.examMarks !== undefined ? String(subjectMark.examMarks) : '',
        monthly20: subjectMark?.monthlyMarks20 !== null && subjectMark?.monthlyMarks20 !== undefined ? String(subjectMark.monthlyMarks20) : '',
        workingDays: record?.workingDays ? String(record.workingDays) : '120',
        attendance: record?.attendance ? String(record.attendance) : '110',
        remarks: record?.teacherRemarks || '',
      };
    });

    setLocalMarks(newLocalMarks);
  }, [selectedExamId, selectedYear, selectedClassId, selectedSection, selectedSubjectId, examRecords]);

  // Handle single input change with instant auto-save to context
  const handleExamMarkChange = (studentId: string, value: string) => {
    setLocalMarks((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        examMarks: value,
      },
    }));

    const numValue = value === '' ? null : Math.min(fullMarks, Math.max(0, parseFloat(value) || 0));
    const monthlyNum = localMarks[studentId]?.monthly20 === '' ? null : parseFloat(localMarks[studentId]?.monthly20) || 0;

    saveMarkRecord(
      studentId,
      selectedExamId,
      selectedYear,
      selectedClassId,
      selectedSection,
      selectedSubjectId,
      { examMarks: numValue, monthlyMarks20: monthlyNum }
    );

    triggerSavedFeedback();
  };

  const handleMonthlyMarkChange = (studentId: string, value: string) => {
    setLocalMarks((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        monthly20: value,
      },
    }));

    const examNum = localMarks[studentId]?.examMarks === '' ? null : parseFloat(localMarks[studentId]?.examMarks) || 0;
    const monthlyNum = value === '' ? null : Math.min(20, Math.max(0, parseFloat(value) || 0));

    saveMarkRecord(
      studentId,
      selectedExamId,
      selectedYear,
      selectedClassId,
      selectedSection,
      selectedSubjectId,
      { examMarks: examNum, monthlyMarks20: monthlyNum }
    );

    triggerSavedFeedback();
  };

  const handleRemarksChange = (studentId: string, text: string) => {
    setLocalMarks((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        remarks: text,
      },
    }));

    saveMarkRecord(
      studentId,
      selectedExamId,
      selectedYear,
      selectedClassId,
      selectedSection,
      selectedSubjectId,
      {},
      { teacherRemarks: text }
    );
  };

  const triggerSavedFeedback = () => {
    setSaveStatus('সংরক্ষিত');
    setTimeout(() => {
      setSaveStatus(null);
    }, 2000);
  };

  // Today's daily roll-call attendance map for quick voice & table entry
  const todayIso = useMemo(() => {
    const now = new Date();
    const tzOffsetMs = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - tzOffsetMs).toISOString().split('T')[0];
  }, []);

  const todayAttendanceRecord = useMemo(
    () => getDailyAttendance(selectedClassId, selectedSection || '', todayIso),
    [getDailyAttendance, selectedClassId, selectedSection, todayIso]
  );

  const todayAttendanceMap = todayAttendanceRecord?.records || {};

  const handleDailyAttendanceToggle = (studentId: string, status: AttendanceStatus) => {
    const nextRecords = {
      ...todayAttendanceMap,
      [studentId]: { status },
    };
    saveDailyAttendance(
      selectedClassId,
      selectedSection || '',
      todayIso,
      selectedYear,
      nextRecords
    );
    triggerSavedFeedback();
  };

  // Web Speech API state & continuous command processing
  const speechSupported = useMemo(() => Boolean(getSpeechRecognitionConstructor()), []);
  const [speechLang, setSpeechLang] = useState<'bn-BD' | 'en-US'>('bn-BD');
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceInterim, setVoiceInterim] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [lastHighlightedStudentId, setLastHighlightedStudentId] = useState<string | null>(null);
  const [voiceHistory, setVoiceHistory] = useState<
    { id: string; time: string; transcript: string; summary: string; ok: boolean; undo?: () => void }[]
  >([]);

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const isListeningIntentRef = useRef(false);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const executeVoiceRef = useRef<(transcript: string) => void>(() => {});

  const highlightStudentRow = (studentId: string) => {
    setLastHighlightedStudentId(studentId);
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = setTimeout(() => {
      setLastHighlightedStudentId(null);
    }, 3500);
  };

  const executeVoiceTranscript = (rawText: string) => {
    const commands = parseClassroomVoiceCommands(rawText, subjects);
    const timeLabel = new Date().toLocaleTimeString('bn-BD', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    if (commands.length === 0) {
      setVoiceHistory((prev) => [
        {
          id: `v_${Date.now()}_${Math.random()}`,
          time: timeLabel,
          transcript: rawText,
          summary: 'কমান্ড বোঝা যায়নি — "রোল ৫ নম্বর ৮৫" বা "রোল ৩ উপস্থিত" বলুন',
          ok: false,
        },
        ...prev.slice(0, 4),
      ]);
      return;
    }

    const appliedSummaries: string[] = [];
    const undoCallbacks: (() => void)[] = [];

    for (const cmd of commands) {
      if (cmd.type === 'navigate_student') {
        const idx = filteredStudents.findIndex((s) => s.id === activeStudentId);
        const safeIdx = idx >= 0 ? idx : 0;
        const targetIdx =
          cmd.direction === 'next'
            ? Math.min(filteredStudents.length - 1, safeIdx + 1)
            : Math.max(0, safeIdx - 1);
        const nextStudent = filteredStudents[targetIdx];
        if (nextStudent) {
          const prevActiveId = activeStudentId;
          setActiveStudentId(nextStudent.id);
          highlightStudentRow(nextStudent.id);
          appliedSummaries.push(`রোল ${toBengaliRoll(nextStudent.roll)} (${nextStudent.nameBn})-এ স্থানান্তর`);
          undoCallbacks.push(() => setActiveStudentId(prevActiveId));
        }
        continue;
      }

      const targetStudent =
        cmd.roll !== undefined
          ? filteredStudents.find((s) => s.roll === cmd.roll)
          : entryMode === 'student_wise'
          ? filteredStudents.find((s) => s.id === activeStudentId)
          : (lastHighlightedStudentId && filteredStudents.find((s) => s.id === lastHighlightedStudentId)) ||
            filteredStudents[0];

      if (!targetStudent) {
        appliedSummaries.push(
          cmd.roll !== undefined
            ? `রোল ${toBengaliRoll(cmd.roll)} এই শ্রেণিতে পাওয়া যায়নি`
            : 'লক্ষ্য শিক্ষার্থী নির্বাচন করা যায়নি'
        );
        continue;
      }

      const recId = `${targetStudent.id}_${selectedExamId}_${selectedYear}`;
      const existingRec = examRecords[recId];

      if (cmd.type === 'daily_attendance') {
        const prevStatus = todayAttendanceMap[targetStudent.id]?.status;
        handleDailyAttendanceToggle(targetStudent.id, cmd.status);
        highlightStudentRow(targetStudent.id);
        const statusLabel =
          cmd.status === 'present' ? 'উপস্থিত' : cmd.status === 'absent' ? 'অনুপস্থিত' : 'বিলম্ব';
        appliedSummaries.push(
          `রোল ${toBengaliRoll(targetStudent.roll)} (${targetStudent.nameBn}): আজকের হাজিরা → ${statusLabel}`
        );
        undoCallbacks.push(() => {
          const next = { ...todayAttendanceMap };
          if (prevStatus) {
            next[targetStudent.id] = { status: prevStatus };
          } else {
            delete next[targetStudent.id];
          }
          saveDailyAttendance(selectedClassId, selectedSection || '', todayIso, selectedYear, next);
        });
        continue;
      }

      if (cmd.type === 'attendance_days') {
        const maxDays = existingRec?.workingDays || 120;
        const clampedDays = Math.min(maxDays, Math.max(0, cmd.value));
        const prevDays = existingRec?.attendance ?? 110;
        saveMarkRecord(
          targetStudent.id,
          selectedExamId,
          selectedYear,
          selectedClassId,
          selectedSection,
          selectedSubjectId || subjects[0]?.id || '',
          {},
          { attendance: clampedDays }
        );
        setLocalMarks((prev) => ({
          ...prev,
          [targetStudent.id]: {
            ...(prev[targetStudent.id] || { examMarks: '', monthly20: '', workingDays: '120', attendance: '110', remarks: '' }),
            attendance: String(clampedDays),
          },
        }));
        highlightStudentRow(targetStudent.id);
        triggerSavedFeedback();
        appliedSummaries.push(
          `রোল ${toBengaliRoll(targetStudent.roll)}: উপস্থিতির দিন → ${toBengaliNumber(clampedDays)}`
        );
        undoCallbacks.push(() => {
          saveMarkRecord(
            targetStudent.id,
            selectedExamId,
            selectedYear,
            selectedClassId,
            selectedSection,
            selectedSubjectId || subjects[0]?.id || '',
            {},
            { attendance: prevDays }
          );
        });
        continue;
      }

      const targetSubId = cmd.subjectId || selectedSubjectId || subjects[0]?.id || '';
      const targetSub = subjects.find((s) => s.id === targetSubId);
      const subFull = targetSub?.fullMarks || fullMarks;
      const existingSubMark = existingRec?.marks[targetSubId];

      if (cmd.type === 'monthly_mark') {
        if (targetSub?.hasMonthlyExam === false) {
          appliedSummaries.push(`${targetSub.nameBn} বিষয়ে মাসিক ২০% প্রযোজ্য নয়`);
          continue;
        }
        const clampedMonthly = Math.min(20, Math.max(0, cmd.value));
        const prevMonthly = existingSubMark?.monthlyMarks20 ?? null;
        const examNum = existingSubMark?.examMarks ?? null;
        saveMarkRecord(
          targetStudent.id,
          selectedExamId,
          selectedYear,
          selectedClassId,
          selectedSection,
          targetSubId,
          { examMarks: examNum, monthlyMarks20: clampedMonthly }
        );
        if (targetSubId === selectedSubjectId) {
          setLocalMarks((prev) => ({
            ...prev,
            [targetStudent.id]: {
              ...(prev[targetStudent.id] || { examMarks: '', monthly20: '', workingDays: '120', attendance: '110', remarks: '' }),
              monthly20: String(clampedMonthly),
            },
          }));
        }
        highlightStudentRow(targetStudent.id);
        triggerSavedFeedback();
        appliedSummaries.push(
          `রোল ${toBengaliRoll(targetStudent.roll)} (${targetSub?.nameBn || 'বিষয়'}): মাসিক ২০% → ${toBengaliNumber(clampedMonthly)}`
        );
        undoCallbacks.push(() => {
          saveMarkRecord(
            targetStudent.id,
            selectedExamId,
            selectedYear,
            selectedClassId,
            selectedSection,
            targetSubId,
            { examMarks: examNum, monthlyMarks20: prevMonthly }
          );
        });
        continue;
      }

      if (cmd.type === 'exam_mark') {
        const clampedExam = Math.min(subFull, Math.max(0, cmd.value));
        const prevExam = existingSubMark?.examMarks ?? null;
        const monthlyNum = existingSubMark?.monthlyMarks20 ?? null;
        saveMarkRecord(
          targetStudent.id,
          selectedExamId,
          selectedYear,
          selectedClassId,
          selectedSection,
          targetSubId,
          { examMarks: clampedExam, monthlyMarks20: monthlyNum }
        );
        if (targetSubId === selectedSubjectId) {
          setLocalMarks((prev) => ({
            ...prev,
            [targetStudent.id]: {
              ...(prev[targetStudent.id] || { examMarks: '', monthly20: '', workingDays: '120', attendance: '110', remarks: '' }),
              examMarks: String(clampedExam),
            },
          }));
        }
        highlightStudentRow(targetStudent.id);
        triggerSavedFeedback();
        appliedSummaries.push(
          `রোল ${toBengaliRoll(targetStudent.roll)} (${targetSub?.nameBn || 'বিষয়'}): প্রাপ্ত নম্বর → ${toBengaliNumber(clampedExam)}`
        );
        undoCallbacks.push(() => {
          saveMarkRecord(
            targetStudent.id,
            selectedExamId,
            selectedYear,
            selectedClassId,
            selectedSection,
            targetSubId,
            { examMarks: prevExam, monthlyMarks20: monthlyNum }
          );
        });
      }
    }

    setVoiceHistory((prev) => [
      {
        id: `v_${Date.now()}_${Math.random()}`,
        time: timeLabel,
        transcript: rawText,
        summary: appliedSummaries.join(' • '),
        ok: undoCallbacks.length > 0,
        undo:
          undoCallbacks.length > 0
            ? () => {
                undoCallbacks.forEach((fn) => fn());
              }
            : undefined,
      },
      ...prev.slice(0, 4),
    ]);
  };

  executeVoiceRef.current = executeVoiceTranscript;

  const stopVoiceListening = () => {
    isListeningIntentRef.current = false;
    setIsListening(false);
    setVoiceInterim('');
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {
        // ignore stop errors
      }
      recognitionRef.current = null;
    }
  };

  const startVoiceListening = (overrideLang?: 'bn-BD' | 'en-US') => {
    const RecognitionCtor = getSpeechRecognitionConstructor();
    if (!RecognitionCtor) {
      setVoiceError('এই ব্রাউজারে Web Speech API সাপোর্ট করে না। অনুগ্রহ করে Chrome বা Edge ব্রাউজার ব্যবহার করুন।');
      return;
    }

    stopVoiceListening();
    setVoiceError(null);
    const activeLang = overrideLang || speechLang;

    try {
      const rec = new RecognitionCtor();
      rec.lang = activeLang;
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      isListeningIntentRef.current = true;
      recognitionRef.current = rec;

      rec.onstart = () => {
        setIsListening(true);
        setVoiceError(null);
      };

      rec.onresult = (event) => {
        let interimBuffer = '';
        let finalBuffer = '';

        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const res = event.results[i];
          const text = res[0]?.transcript || '';
          if (res.isFinal) {
            finalBuffer += `${text} `;
          } else {
            interimBuffer += text;
          }
        }

        setVoiceInterim(interimBuffer.trim());

        if (finalBuffer.trim()) {
          const finalText = finalBuffer.trim();
          setVoiceTranscript(finalText);
          executeVoiceRef.current(finalText);
        }
      };

      rec.onerror = (ev) => {
        if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
          setVoiceError('মাইক্রোফোনের অনুমতি পাওয়া যায়নি। ব্রাউজার অ্যাড্রেস বার থেকে Microphone Allow করুন।');
          isListeningIntentRef.current = false;
          setIsListening(false);
        } else if (ev.error === 'audio-capture') {
          setVoiceError('কোনো মাইক্রোফোন পাওয়া যায়নি।');
          isListeningIntentRef.current = false;
          setIsListening(false);
        } else if (ev.error !== 'no-speech' && ev.error !== 'aborted') {
          setVoiceError(`ভয়েস ত্রুটি: ${ev.error}`);
        }
      };

      rec.onend = () => {
        if (isListeningIntentRef.current) {
          try {
            rec.start();
          } catch {
            setIsListening(false);
            isListeningIntentRef.current = false;
          }
        } else {
          setIsListening(false);
        }
      };

      rec.start();
    } catch {
      setVoiceError('ভয়েস রেকগনিশন চালু করা যায়নি।');
      setIsListening(false);
      isListeningIntentRef.current = false;
    }
  };

  useEffect(() => {
    return () => {
      isListeningIntentRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onend = null;
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  // Quick fill monthly assessment
  const handleBulkFillMonthly = (val: number) => {
    const updates = filteredStudents.map((std) => ({
      studentId: std.id,
      examMarks: localMarks[std.id]?.examMarks !== '' ? parseFloat(localMarks[std.id]?.examMarks) : null,
      monthlyMarks20: val,
    }));

    bulkSaveSubjectMarks(selectedExamId, selectedYear, selectedClassId, selectedSection, selectedSubjectId, updates);
    triggerSavedFeedback();
  };

  return (
    <div className="space-y-6">
      {/* Top Filter Selection Panel */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 mb-4">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-700">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 font-serif">
                মার্ক এন্ট্রি ফরম (বিষয় ও শ্রেণিভিত্তিক)
              </h2>
              <p className="text-xs text-slate-500">
                খাতা দেখার পর সরাসরি প্রাপ্ত নম্বর এন্ট্রি করুন। ৮০% ও ২০% অটোমেটিক হিসাব হয়ে যাবে।
              </p>
            </div>
          </div>

          {/* Save status badge */}
          <div className="flex items-center space-x-2">
            {saveStatus ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                {saveStatus}
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                <Save className="w-3.5 h-3.5 mr-1" /> রিয়েল-টাইম অটো সেভ
              </span>
            )}

            {/* Mode switch */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              <button
                onClick={() => setEntryMode('subject_wise')}
                className={`px-3 py-1.5 rounded-md font-medium transition ${
                  entryMode === 'subject_wise' ? 'bg-white shadow text-indigo-700 font-bold' : 'text-slate-600'
                }`}
              >
                বিষয়ভিত্তিক এন্ট্রি
              </button>
              <button
                onClick={() => setEntryMode('student_wise')}
                className={`px-3 py-1.5 rounded-md font-medium transition ${
                  entryMode === 'student_wise' ? 'bg-white shadow text-indigo-700 font-bold' : 'text-slate-600'
                }`}
              >
                শিক্ষার্থীভিত্তিক এন্ট্রি
              </button>
            </div>
          </div>
        </div>

        {/* Filter Dropdowns Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Exam */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              <Calendar className="w-3.5 h-3.5 inline mr-1 text-slate-500" />
              পরীক্ষার নাম
            </label>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="w-full text-sm font-medium border border-slate-300 rounded-lg px-2.5 py-2 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              {examTerms.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.nameBn}
                </option>
              ))}
            </select>
          </div>

          {/* Academic Year */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">শিক্ষাবর্ষ</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full text-sm font-medium border border-slate-300 rounded-lg px-2.5 py-2 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="২০২৬">২০২৬ ইং</option>
              <option value="২০২৫">২০২৫ ইং</option>
              <option value="২০২৭">২০২৭ ইং</option>
            </select>
          </div>

          {/* Class */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              <Layers className="w-3.5 h-3.5 inline mr-1 text-slate-500" />
              শ্রেণি
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full text-sm font-semibold border border-indigo-300 rounded-lg px-2.5 py-2 bg-indigo-50/50 text-indigo-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.nameBn}
                </option>
              ))}
            </select>
          </div>

          {/* Section */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">শাখা</label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full text-sm font-medium border border-slate-300 rounded-lg px-2.5 py-2 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="">সকল শাখা</option>
              <option value="ক">ক শাখা</option>
              <option value="খ">খ শাখা</option>
              <option value="সাধারণ">সাধারণ</option>
            </select>
          </div>

          {/* Subject (if subject-wise mode) */}
          {entryMode === 'subject_wise' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  <BookOpen className="w-3.5 h-3.5 inline mr-1 text-indigo-600" />
                  বিষয় নির্বাচন
                </label>
                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => onNavigate('subjects')}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer"
                    title="বিষয় যোগ বা পরিমার্জন করুন"
                  >
                    + বিষয় ব্যবস্থাপনা
                  </button>
                )}
              </div>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="w-full text-sm font-bold border border-amber-400 rounded-lg px-2.5 py-2 bg-amber-50 text-amber-950 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              >
                {subjects.length === 0 ? (
                  <option value="">কোনো বিষয় নেই</option>
                ) : (
                  subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.nameBn} (পূর্ণমান {toBengaliNumber(sub.fullMarks)}{sub.hasMonthlyExam === false ? ' • ১০০% পরীক্ষা' : ''})
                    </option>
                  ))
                )}
              </select>
            </div>
          )}

          {/* Student (if student-wise mode) */}
          {entryMode === 'student_wise' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                <Users className="w-3.5 h-3.5 inline mr-1 text-indigo-600" />
                শিক্ষার্থী নির্বাচন
              </label>
              <select
                value={activeStudentId}
                onChange={(e) => setActiveStudentId(e.target.value)}
                className="w-full text-sm font-bold border border-indigo-300 rounded-lg px-2.5 py-2 bg-white text-indigo-950 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                {filteredStudents.map((std) => (
                  <option key={std.id} value={std.id}>
                    রোল {toBengaliRoll(std.roll)} - {std.nameBn}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* WEB SPEECH API: VOICE ATTENDANCE & MARK ENTRY DOCK */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition ${
                isListening
                  ? 'bg-rose-600 text-white'
                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
              }`}
            >
              {isListening ? <Volume2 className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 font-serif">
                  ভয়েস কমান্ড এন্ট্রি (হাজিরা ও নম্বর)
                </h3>
                {isListening ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                    মাইক্রোফোন সক্রিয় — কথা বলুন
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">
                    Web Speech API
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                ক্লাসরুমে বসে মুখে বললেই রোল নম্বর অনুযায়ী হাজিরা ও পরীক্ষার নম্বর স্বয়ংক্রিয়ভাবে এন্ট্রি হয়ে যাবে।
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Speech Recognition Language Selector */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => {
                  setSpeechLang('bn-BD');
                  if (isListening) startVoiceListening('bn-BD');
                }}
                className={`px-2.5 py-1.5 rounded-md font-semibold transition cursor-pointer ${
                  speechLang === 'bn-BD' ? 'bg-white text-indigo-800 shadow-sm font-bold' : 'text-slate-600'
                }`}
              >
                বাংলা
              </button>
              <button
                type="button"
                onClick={() => {
                  setSpeechLang('en-US');
                  if (isListening) startVoiceListening('en-US');
                }}
                className={`px-2.5 py-1.5 rounded-md font-semibold transition cursor-pointer ${
                  speechLang === 'en-US' ? 'bg-white text-indigo-800 shadow-sm font-bold' : 'text-slate-600'
                }`}
              >
                English
              </button>
            </div>

            {isListening ? (
              <button
                type="button"
                onClick={stopVoiceListening}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer"
              >
                <MicOff className="w-4 h-4" />
                <span>ভয়েস বন্ধ করুন</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={!speechSupported}
                onClick={() => startVoiceListening()}
                className="px-4 py-2 rounded-xl bg-indigo-700 hover:bg-indigo-800 disabled:bg-slate-300 disabled:text-slate-500 text-white text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer"
              >
                <Mic className="w-4 h-4" />
                <span>ভয়েস এন্ট্রি চালু করুন</span>
              </button>
            )}
          </div>
        </div>

        {!speechSupported && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-700" />
            <span>
              আপনার বর্তমান ব্রাউজার Web Speech Recognition সাপোর্ট করে না। ভয়েস এন্ট্রি ব্যবহারের জন্য Google Chrome বা Microsoft Edge ব্যবহার করুন। তবে নিচের উদাহরণগুলোতে ক্লিক করে দ্রুত পরীক্ষা করতে পারবেন।
            </span>
          </div>
        )}

        {voiceError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{voiceError}</span>
          </div>
        )}

        {/* Live Transcript + Clickable Command Samples */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 pt-1">
          <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 flex flex-col justify-center">
            <div className="text-[11px] font-semibold text-slate-500 mb-1">লাইভ শ্রুত কমান্ড:</div>
            <div className="text-xs sm:text-sm font-medium text-slate-900 min-h-[20px]">
              {voiceInterim ? (
                <span className="text-indigo-700 italic">{voiceInterim}...</span>
              ) : voiceTranscript ? (
                <span>&ldquo;{voiceTranscript}&rdquo;</span>
              ) : (
                <span className="text-slate-400">
                  যেমন বলুন: &ldquo;রোল ১ নম্বর ৮৮&rdquo; অথবা &ldquo;রোল ২ উপস্থিত&rdquo;
                </span>
              )}
            </div>
          </div>

          <div className="lg:col-span-7 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500 mr-1">নমুনা কমান্ড (ক্লিকেও চলবে):</span>
            {[
              'রোল ১ নম্বর ৮৫',
              'রোল ১ মাসিক ১৮',
              'রোল ১ উপস্থিত',
              'রোল ২ অনুপস্থিত',
              'রোল ৩ উপস্থিতি ১১৪',
            ].map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => {
                  setVoiceTranscript(sample);
                  executeVoiceTranscript(sample);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-800 border border-slate-200 hover:border-indigo-200 text-xs font-medium text-slate-700 transition cursor-pointer"
              >
                {sample}
              </button>
            ))}
          </div>
        </div>

        {/* Recent Voice Actions Log with 1-click Undo */}
        {voiceHistory.length > 0 && (
          <div className="border-t border-slate-100 pt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-500">সর্বশেষ কমান্ড:</span>
              <span
                className={`px-2.5 py-1 rounded-lg font-medium border ${
                  voiceHistory[0].ok
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                    : 'bg-amber-50 text-amber-900 border-amber-200'
                }`}
              >
                {voiceHistory[0].summary}
              </span>
              <span className="text-[11px] text-slate-400 tabular-nums">{voiceHistory[0].time}</span>
            </div>

            {voiceHistory[0].undo && (
              <button
                type="button"
                onClick={() => {
                  const fn = voiceHistory[0].undo;
                  if (fn) {
                    fn();
                    setVoiceHistory((prev) => prev.slice(1));
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>পূর্বাবস্থায় ফিরুন</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* SUBJECT-WISE ENTRY TABLE (All Students of this Class for Selected Subject) */}
      {entryMode === 'subject_wise' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Header Bar with quick tools */}
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-800 text-sm sm:text-base">
                {currentClass.nameBn} &gt; {activeSubject?.nameBn}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">
                পূর্ণমান: {toBengaliNumber(fullMarks)}
              </span>
              <span className="text-xs text-slate-500">
                (শিক্ষার্থী সংখ্যা: {toBengaliNumber(filteredStudents.length)})
              </span>
            </div>

            {/* Quick bulk fill helper */}
            <div className="flex items-center space-x-2 text-xs">
              <span className="text-slate-600 font-medium hidden sm:inline">
                মাসিক ২০% কুইক ফিল:
              </span>
              <button
                onClick={() => handleBulkFillMonthly(18)}
                className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded text-slate-700 font-semibold"
              >
                ১৮
              </button>
              <button
                onClick={() => handleBulkFillMonthly(17)}
                className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded text-slate-700 font-semibold"
              >
                ১৭
              </button>
              <button
                onClick={() => handleBulkFillMonthly(16)}
                className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded text-slate-700 font-semibold"
              >
                ১৬
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100/80 text-slate-700 text-xs font-bold border-b border-slate-200 uppercase tracking-wider">
                  <th className="py-3 px-3 text-center w-16">রোল</th>
                  <th className="py-3 px-3">শিক্ষার্থীর নাম</th>
                  <th className="py-3 px-2 text-center w-36 bg-emerald-50/40">
                    আজকের হাজিরা
                    <div className="text-[10px] text-slate-500 font-normal">(ভয়েস / ক্লিক)</div>
                  </th>
                  <th className="py-3 px-2 text-center w-32 bg-amber-50/60">
                    প্রাপ্ত নম্বর
                    <div className="text-[10px] text-amber-800 font-normal">
                      (পূর্ণমান {toBengaliNumber(fullMarks)})
                    </div>
                  </th>
                  <th className="py-3 px-2 text-center w-28 bg-slate-50">
                    {activeSubject?.hasMonthlyExam === false ? 'প্রাপ্ত মূল নম্বর' : '৮০% হিসাব'}
                    <div className="text-[10px] text-slate-500 font-normal">
                      {activeSubject?.hasMonthlyExam === false ? '(১০০% চূড়ান্ত)' : '(অটোমেটিক)'}
                    </div>
                  </th>
                  <th className="py-3 px-2 text-center w-28 bg-blue-50/60">
                    মাসিক ২০%
                    <div className="text-[10px] text-blue-800 font-normal">
                      {activeSubject?.hasMonthlyExam === false ? '(প্রযোজ্য নয়)' : '(ধারাবাহিক)'}
                    </div>
                  </th>
                  <th className="py-3 px-2 text-center w-28 bg-emerald-50/60 font-bold">
                    মোট প্রাপ্ত নম্বর
                  </th>
                  <th className="py-3 px-2 text-center w-24">গ্রেড / পয়েন্ট</th>
                  <th className="py-3 px-3 w-48">শিক্ষকের মন্তব্য / নোট</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-500 font-medium">
                      এই শ্রেণি ও শাখায় কোন শিক্ষার্থী পাওয়া যায়নি। &quot;শিক্ষার্থী তথ্য&quot; ট্যাব থেকে শিক্ষার্থী যুক্ত করুন।
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((std, index) => {
                    const examVal = localMarks[std.id]?.examMarks || '';
                    const monthlyVal = localMarks[std.id]?.monthly20 || '';
                    const remarksVal = localMarks[std.id]?.remarks || '';

                    const numExam = examVal !== '' ? parseFloat(examVal) : null;
                    const numMonthly = monthlyVal !== '' ? parseFloat(monthlyVal) : null;

                    let calc80: number | null = null;
                    let totalObtained: number | null = null;

                    if (numExam !== null) {
                      if (activeSubject?.hasMonthlyExam === false) {
                        calc80 = numExam;
                        totalObtained = Math.round(numExam);
                      } else {
                        calc80 = parseFloat(((numExam * 80) / 100).toFixed(1));
                        totalObtained = Math.round(calc80 + (numMonthly || 0));
                      }
                    }

                    const grade = calculateGrade(totalObtained, fullMarks);
                    const todayStatus = todayAttendanceMap[std.id]?.status;
                    const isVoiceHighlighted = lastHighlightedStudentId === std.id;

                    return (
                      <tr
                        key={std.id}
                        className={`transition ${
                          isVoiceHighlighted
                            ? 'bg-indigo-50 ring-1 ring-inset ring-indigo-300'
                            : `hover:bg-indigo-50/30 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`
                        }`}
                      >
                        {/* Roll */}
                        <td className="py-2.5 px-3 text-center font-bold text-slate-900 tabular-nums">
                          {toBengaliRoll(std.roll)}
                        </td>

                        {/* Name */}
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900">{std.nameBn}</div>
                          {std.section && (
                            <span className="text-[11px] text-slate-500">শাখা: {std.section}</span>
                          )}
                        </td>

                        {/* Today's Roll-call Attendance Quick Toggle */}
                        <td className="py-2.5 px-2 text-center bg-emerald-50/20">
                          <div className="inline-flex items-center gap-1">
                            {(
                              [
                                { id: 'present' as const, label: 'উপস্থিত', active: 'bg-emerald-600 text-white border-emerald-600' },
                                { id: 'absent' as const, label: 'অনু.', active: 'bg-rose-600 text-white border-rose-600' },
                                { id: 'late' as const, label: 'দেরি', active: 'bg-amber-500 text-slate-950 border-amber-500' },
                              ]
                            ).map((st) => (
                              <button
                                key={st.id}
                                type="button"
                                onClick={() => handleDailyAttendanceToggle(std.id, st.id)}
                                className={`px-1.5 py-1 rounded text-[11px] font-bold border transition cursor-pointer ${
                                  todayStatus === st.id
                                    ? st.active
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                                }`}
                              >
                                {st.label}
                              </button>
                            ))}
                          </div>
                        </td>

                        {/* Exam Marks Input */}
                        <td className="py-2.5 px-2 text-center bg-amber-50/40">
                          <input
                            type="number"
                            min="0"
                            max={fullMarks}
                            step="any"
                            placeholder="০-১০০"
                            value={examVal}
                            onChange={(e) => handleExamMarkChange(std.id, e.target.value)}
                            className="w-24 text-center font-bold text-base border-2 border-amber-300 rounded-lg py-1 px-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none bg-white text-slate-950"
                          />
                        </td>

                        {/* 80% auto mark */}
                        <td className="py-2.5 px-2 text-center font-bold text-slate-700 bg-slate-50">
                          {calc80 !== null ? toBengaliNumber(calc80) : '-'}
                        </td>

                        {/* Monthly 20% mark Input */}
                        <td className="py-2.5 px-2 text-center bg-blue-50/40">
                          {activeSubject?.hasMonthlyExam === false ? (
                            <span className="text-[11px] text-slate-400 font-medium italic">
                              প্রযোজ্য নয়
                            </span>
                          ) : (
                            <input
                              type="number"
                              min="0"
                              max="20"
                              step="any"
                              placeholder="০-২০"
                              value={monthlyVal}
                              onChange={(e) => handleMonthlyMarkChange(std.id, e.target.value)}
                              className="w-20 text-center font-semibold text-sm border border-blue-300 rounded-lg py-1 px-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-blue-950"
                            />
                          )}
                        </td>

                        {/* Total Obtained */}
                        <td className="py-2.5 px-2 text-center font-bold text-base text-emerald-800 bg-emerald-50/40">
                          {totalObtained !== null ? toBengaliNumber(totalObtained) : '-'}
                        </td>

                        {/* Grade & Point */}
                        <td className="py-2.5 px-2 text-center">
                          {totalObtained !== null ? (
                            <div className="inline-flex flex-col items-center">
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-bold ${
                                  grade.letterGrade === 'F'
                                    ? 'bg-rose-100 text-rose-800'
                                    : grade.letterGrade === 'A+'
                                    ? 'bg-emerald-100 text-emerald-800 font-extrabold'
                                    : 'bg-indigo-100 text-indigo-800'
                                }`}
                              >
                                {grade.letterGrade}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                {grade.gradePoint.toFixed(2)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* Remarks */}
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            placeholder="মন্তব্য লিখুন..."
                            value={remarksVal}
                            onChange={(e) => handleRemarksChange(std.id, e.target.value)}
                            className="w-full text-xs border border-slate-300 rounded-md py-1 px-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* STUDENT-WISE ENTRY (All Subjects for One Student) */}
      {entryMode === 'student_wise' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <span className="text-xs text-indigo-600 font-bold uppercase tracking-wider">
                একক শিক্ষার্থী এন্ট্রি মোড
              </span>
              <h3 className="text-xl font-bold text-slate-900 font-serif">
                {filteredStudents.find((s) => s.id === activeStudentId)?.nameBn || 'শিক্ষার্থী'} (রোল:{' '}
                {toBengaliRoll(filteredStudents.find((s) => s.id === activeStudentId)?.roll || 1)})
              </h3>
            </div>

            {/* Today's attendance + Quick Next/Prev student navigation */}
            <div className="flex flex-wrap items-center gap-2">
              {activeStudentId && (
                <div className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                  <span className="text-[11px] font-semibold text-slate-600 mr-1">আজকের হাজিরা:</span>
                  {(
                    [
                      { id: 'present' as const, label: 'উপস্থিত', active: 'bg-emerald-600 text-white border-emerald-600' },
                      { id: 'absent' as const, label: 'অনুপস্থিত', active: 'bg-rose-600 text-white border-rose-600' },
                      { id: 'late' as const, label: 'বিলম্ব', active: 'bg-amber-500 text-slate-950 border-amber-500' },
                    ]
                  ).map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => handleDailyAttendanceToggle(activeStudentId, st.id)}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold border transition cursor-pointer ${
                        todayAttendanceMap[activeStudentId]?.status === st.id
                          ? st.active
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              )}
              <button
                disabled={filteredStudents.findIndex((s) => s.id === activeStudentId) <= 0}
                onClick={() => {
                  const idx = filteredStudents.findIndex((s) => s.id === activeStudentId);
                  if (idx > 0) setActiveStudentId(filteredStudents[idx - 1].id);
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                পূর্ববর্তী
              </button>
              <button
                disabled={filteredStudents.findIndex((s) => s.id === activeStudentId) >= filteredStudents.length - 1}
                onClick={() => {
                  const idx = filteredStudents.findIndex((s) => s.id === activeStudentId);
                  if (idx < filteredStudents.length - 1) setActiveStudentId(filteredStudents[idx + 1].id);
                }}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-40 flex items-center cursor-pointer"
              >
                পরবর্তী শিক্ষার্থী <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </button>
            </div>
          </div>

          {/* Subjects Table for this student */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 text-xs font-bold border-b border-slate-200">
                  <th className="py-2.5 px-3">বিষয়</th>
                  <th className="py-2.5 px-2 text-center w-24">মোট নম্বর</th>
                  <th className="py-2.5 px-2 text-center w-32 bg-amber-50">প্রাপ্ত নম্বর</th>
                  <th className="py-2.5 px-2 text-center w-28">৮০% নম্বর</th>
                  <th className="py-2.5 px-2 text-center w-28 bg-blue-50">মাসিক ২০%</th>
                  <th className="py-2.5 px-2 text-center w-28 bg-emerald-50">মোট প্রাপ্ত</th>
                  <th className="py-2.5 px-2 text-center w-24">গ্রেড / পয়েন্ট</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {subjects.map((sub) => {
                  const recordId = `${activeStudentId}_${selectedExamId}_${selectedYear}`;
                  const rec = examRecords[recordId];
                  const subMark = rec?.marks[sub.id];

                  const examMarks = subMark?.examMarks !== null && subMark?.examMarks !== undefined ? subMark.examMarks : '';
                  const monthly20 = subMark?.monthlyMarks20 !== null && subMark?.monthlyMarks20 !== undefined ? subMark.monthlyMarks20 : '';
                  const calc80 = subMark?.calcMarks80 !== null && subMark?.calcMarks80 !== undefined ? subMark.calcMarks80 : null;
                  const totalMarks = subMark?.totalMarks !== null && subMark?.totalMarks !== undefined ? subMark.totalMarks : null;
                  const grade = calculateGrade(totalMarks, sub.fullMarks);

                  return (
                    <tr key={sub.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-semibold text-slate-800">{sub.nameBn}</td>
                      <td className="py-2 px-2 text-center font-bold text-slate-600">
                        {toBengaliNumber(sub.fullMarks)}
                      </td>
                      <td className="py-2 px-2 text-center bg-amber-50/50">
                        <input
                          type="number"
                          min="0"
                          max={sub.fullMarks}
                          placeholder="০"
                          value={examMarks}
                          onChange={(e) => {
                            const val = e.target.value === '' ? null : parseFloat(e.target.value);
                            saveMarkRecord(
                              activeStudentId,
                              selectedExamId,
                              selectedYear,
                              selectedClassId,
                              selectedSection,
                              sub.id,
                              { examMarks: val }
                            );
                          }}
                          className="w-20 text-center font-bold text-sm border-2 border-amber-300 rounded py-1 px-1 bg-white"
                        />
                      </td>
                      <td className="py-2 px-2 text-center font-bold text-slate-700">
                        {calc80 !== null ? toBengaliNumber(calc80) : '-'}
                      </td>
                      <td className="py-2 px-2 text-center bg-blue-50/50">
                        {sub.hasMonthlyExam === false ? (
                          <span className="text-[11px] text-slate-400 font-medium italic">
                            প্রযোজ্য নয়
                          </span>
                        ) : (
                          <input
                            type="number"
                            min="0"
                            max="20"
                            placeholder="০"
                            value={monthly20}
                            onChange={(e) => {
                              const val = e.target.value === '' ? null : parseFloat(e.target.value);
                              saveMarkRecord(
                                activeStudentId,
                                selectedExamId,
                                selectedYear,
                                selectedClassId,
                                selectedSection,
                                sub.id,
                                { monthlyMarks20: val }
                              );
                            }}
                            className="w-16 text-center font-semibold text-sm border border-blue-300 rounded py-1 px-1 bg-white"
                          />
                        )}
                      </td>
                      <td className="py-2 px-2 text-center font-bold text-emerald-800 bg-emerald-50/40">
                        {totalMarks !== null ? toBengaliNumber(totalMarks) : '-'}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {totalMarks !== null ? (
                          <span className="font-bold text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                            {grade.letterGrade} ({grade.gradePoint.toFixed(1)})
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Student's Attendance and Remarks Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">মোট কার্য দিবস</label>
              <input
                type="number"
                value={examRecords[`${activeStudentId}_${selectedExamId}_${selectedYear}`]?.workingDays || 120}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10) || 120;
                  saveMarkRecord(
                    activeStudentId,
                    selectedExamId,
                    selectedYear,
                    selectedClassId,
                    selectedSection,
                    subjects[0]?.id || '',
                    {},
                    { workingDays: val }
                  );
                }}
                className="w-full text-sm border border-slate-300 rounded-lg p-2"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">উপস্থিতির দিন</label>
              <input
                type="number"
                value={examRecords[`${activeStudentId}_${selectedExamId}_${selectedYear}`]?.attendance || 110}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10) || 0;
                  saveMarkRecord(
                    activeStudentId,
                    selectedExamId,
                    selectedYear,
                    selectedClassId,
                    selectedSection,
                    subjects[0]?.id || '',
                    {},
                    { attendance: val }
                  );
                }}
                className="w-full text-sm border border-slate-300 rounded-lg p-2"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">শিক্ষকের মন্তব্য</label>
              <input
                type="text"
                placeholder="লেখাপড়ায় মনোযোগী..."
                value={examRecords[`${activeStudentId}_${selectedExamId}_${selectedYear}`]?.teacherRemarks || ''}
                onChange={(e) => {
                  saveMarkRecord(
                    activeStudentId,
                    selectedExamId,
                    selectedYear,
                    selectedClassId,
                    selectedSection,
                    subjects[0]?.id || '',
                    {},
                    { teacherRemarks: e.target.value }
                  );
                }}
                className="w-full text-sm border border-slate-300 rounded-lg p-2"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
