import React, { useState } from 'react';
import {
  BookOpen,
  Plus,
  Edit2,
  Trash2,
  ArrowUp,
  ArrowDown,
  Copy,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Layers,
  FileCheck2,
  TableProperties,
  Award,
  Sparkles,
  Search,
  ExternalLink,
  ShieldCheck,
  Check,
  X,
  HelpCircle,
  GraduationCap,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { Subject, SchoolClass } from '../types';
import { toBengaliNumber } from '../utils/bengali';

interface SubjectManagementViewProps {
  onNavigate?: (tab: string, extra?: { classId?: string; subjectId?: string }) => void;
}

// Common NCTB standard subject suggestions
const COMMON_SUBJECT_SUGGESTIONS = [
  { nameBn: 'বাংলা', nameEn: 'Bangla', code: 'BAN-101', defaultFullMarks: 100, hasMonthly: true },
  { nameBn: 'ইংরেজি', nameEn: 'English', code: 'ENG-102', defaultFullMarks: 100, hasMonthly: true },
  { nameBn: 'গণিত', nameEn: 'Mathematics', code: 'MATH-103', defaultFullMarks: 100, hasMonthly: true },
  { nameBn: 'প্রাথমিক বিজ্ঞান', nameEn: 'Elementary Science', code: 'SCI-104', defaultFullMarks: 100, hasMonthly: true },
  { nameBn: 'বাংলাদেশ ও বিশ্বপরিচয়', nameEn: 'Bangladesh & Global Studies', code: 'BGS-105', defaultFullMarks: 100, hasMonthly: true },
  { nameBn: 'ইসলাম ও নৈতিক শিক্ষা', nameEn: 'Islam & Moral Education', code: 'REL-106', defaultFullMarks: 100, hasMonthly: true },
  { nameBn: 'হিন্দুধর্ম ও নৈতিক শিক্ষা', nameEn: 'Hindu & Moral Education', code: 'REL-107', defaultFullMarks: 100, hasMonthly: true },
  { nameBn: 'তথ্য ও যোগাযোগ প্রযুক্তি (ICT)', nameEn: 'Information & Communication Technology', code: 'ICT-108', defaultFullMarks: 50, hasMonthly: false },
  { nameBn: 'শারীরিক শিক্ষা ও স্বাস্থ্য', nameEn: 'Physical Education & Health', code: 'PEH-109', defaultFullMarks: 50, hasMonthly: false },
  { nameBn: 'চারু ও কারুকলা', nameEn: 'Arts & Crafts', code: 'ART-110', defaultFullMarks: 50, hasMonthly: false },
  { nameBn: 'সাধারণ জ্ঞান ও মৌখিক', nameEn: 'General Knowledge & Oral', code: 'GK-111', defaultFullMarks: 50, hasMonthly: false },
  { nameBn: 'ড্রয়িং ও চিত্রাঙ্কন', nameEn: 'Drawing', code: 'DRW-112', defaultFullMarks: 50, hasMonthly: false },
  { nameBn: 'কুরআন মাজীদ ও তাজবীদ', nameEn: 'Quran Mazid & Tajweed', code: 'QRN-113', defaultFullMarks: 100, hasMonthly: true },
  { nameBn: 'কৃষি শিক্ষা', nameEn: 'Agriculture Studies', code: 'AGR-114', defaultFullMarks: 100, hasMonthly: true },
  { nameBn: 'গার্হস্থ্য বিজ্ঞান', nameEn: 'Home Science', code: 'HMS-115', defaultFullMarks: 100, hasMonthly: true },
];

export const SubjectManagementView: React.FC<SubjectManagementViewProps> = ({ onNavigate }) => {
  const {
    classes,
    selectedClassId,
    setSelectedClassId,
    selectedExamId,
    selectedYear,
    examTerms,
    students,
    examRecords,
    addSubjectToClass,
    addSubjectToMultipleClasses,
    updateSubjectInClass,
    deleteSubjectFromClass,
    reorderClassSubjects,
    copySubjectsBetweenClasses,
    resetClassSubjectsToDefault,
  } = useSchool();

  // Selected Class
  const currentClass = classes.find((c) => c.id === selectedClassId) || classes[0] || {
    id: 'class_1',
    nameBn: '১ম শ্রেণি',
    nameEn: 'Class 1',
    numericOrder: 1,
    defaultSubjects: [],
  };

  const subjects = currentClass.defaultSubjects || [];

  // Filter/Search within subjects of active class
  const [searchTerm, setSearchTerm] = useState('');
  const [viewLayout, setViewLayout] = useState<'cards' | 'table'>('table');

  // Success / Feedback notification
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'info' | 'warning'; text: string } | null>(null);

  const showFeedback = (text: string, type: 'success' | 'info' | 'warning' = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  // Form State
  const [formNameBn, setFormNameBn] = useState('');
  const [formNameEn, setFormNameEn] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formFullMarks, setFormFullMarks] = useState<number>(100);
  const [formPassMarks, setFormPassMarks] = useState<number>(33);
  const [formHasMonthly, setFormHasMonthly] = useState<boolean>(true);
  const [formIsOptional, setFormIsOptional] = useState<boolean>(false);
  const [formSelectedClasses, setFormSelectedClasses] = useState<string[]>([currentClass.id]);

  // Copy Modal State
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [copySourceClassId, setCopySourceClassId] = useState<string>(
    classes.find((c) => c.id !== currentClass.id)?.id || ''
  );
  const [copyMode, setCopyMode] = useState<'replace' | 'append'>('replace');

  // Delete Confirmation Modal State
  const [deleteTargetSubject, setDeleteTargetSubject] = useState<Subject | null>(null);

  // Reset to Default Confirmation Modal
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // Open modal to add new subject
  const handleOpenAddModal = (preset?: typeof COMMON_SUBJECT_SUGGESTIONS[0]) => {
    setEditingSubject(null);
    if (preset) {
      setFormNameBn(preset.nameBn);
      setFormNameEn(preset.nameEn);
      setFormCode(preset.code);
      setFormFullMarks(preset.defaultFullMarks);
      setFormPassMarks(Math.round(preset.defaultFullMarks * 0.33));
      setFormHasMonthly(preset.hasMonthly);
    } else {
      setFormNameBn('');
      setFormNameEn('');
      setFormCode('');
      setFormFullMarks(100);
      setFormPassMarks(33);
      setFormHasMonthly(true);
    }
    setFormIsOptional(false);
    setFormSelectedClasses([currentClass.id]);
    setIsModalOpen(true);
  };

  // Open modal to edit existing subject
  const handleOpenEditModal = (sub: Subject) => {
    setEditingSubject(sub);
    setFormNameBn(sub.nameBn);
    setFormNameEn(sub.nameEn || '');
    setFormCode(sub.code || '');
    setFormFullMarks(sub.fullMarks);
    setFormPassMarks(sub.passMarks !== undefined ? sub.passMarks : Math.round(sub.fullMarks * 0.33));
    setFormHasMonthly(sub.hasMonthlyExam);
    setFormIsOptional(!!sub.isOptional);
    setFormSelectedClasses([currentClass.id]);
    setIsModalOpen(true);
  };

  // Handle Full Marks change with automatic pass marks suggestion (33%)
  const handleFullMarksChange = (val: number) => {
    const marks = Math.max(10, val || 100);
    setFormFullMarks(marks);
    // suggest 33% rounded
    setFormPassMarks(Math.round(marks * 0.33));
  };

  // Save Subject (Add or Update)
  const handleSaveSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNameBn.trim()) {
      alert('অনুগ্রহ করে বিষয়ের বাংলা নাম প্রদান করুন।');
      return;
    }

    if (editingSubject) {
      // Update existing subject in current class
      const updated: Subject = {
        ...editingSubject,
        nameBn: formNameBn.trim(),
        nameEn: formNameEn.trim() || undefined,
        code: formCode.trim() || undefined,
        fullMarks: formFullMarks,
        passMarks: formPassMarks,
        hasMonthlyExam: formHasMonthly,
        isOptional: formIsOptional,
      };
      updateSubjectInClass(currentClass.id, updated);
      showFeedback(`"${updated.nameBn}" বিষয়ের তথ্য সফলভাবে হালনাগাদ করা হয়েছে। মার্ক এন্ট্রি ও ট্যাবুল্যাশন শিট স্বয়ংক্রিয়ভাবে সিঙ্ক হয়েছে।`);
    } else {
      // Add new subject
      const subjectData: Omit<Subject, 'id' | 'classId'> = {
        nameBn: formNameBn.trim(),
        nameEn: formNameEn.trim() || undefined,
        code: formCode.trim() || undefined,
        fullMarks: formFullMarks,
        passMarks: formPassMarks,
        hasMonthlyExam: formHasMonthly,
        isOptional: formIsOptional,
      };

      if (formSelectedClasses.length > 1) {
        addSubjectToMultipleClasses(formSelectedClasses, subjectData);
        showFeedback(
          `"${subjectData.nameBn}" বিষয়টি নির্বাচিত ${toBengaliNumber(
            formSelectedClasses.length
          )}টি শ্রেণিতে সফলভাবে যুক্ত করা হয়েছে!`
        );
      } else {
        addSubjectToClass(currentClass.id, subjectData);
        showFeedback(`"${subjectData.nameBn}" বিষয়টি ${currentClass.nameBn} এ সফলভাবে যুক্ত করা হয়েছে!`);
      }
    }

    setIsModalOpen(false);
  };

  // Delete subject handler
  const handleConfirmDelete = () => {
    if (!deleteTargetSubject) return;
    deleteSubjectFromClass(currentClass.id, deleteTargetSubject.id);
    showFeedback(`"${deleteTargetSubject.nameBn}" বিষয়টি সফলভাবে মুছে ফেলা হয়েছে।`, 'info');
    setDeleteTargetSubject(null);
  };

  // Move subject up / down
  const handleMoveSubject = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= subjects.length) return;

    const newSubjects = [...subjects];
    const [moved] = newSubjects.splice(index, 1);
    newSubjects.splice(targetIndex, 0, moved);

    reorderClassSubjects(currentClass.id, newSubjects);
    showFeedback(`বিষয়ের ক্রম পরিবর্তিত হয়েছে। ট্যাবুল্যাশন শিট ও মার্ক এন্ট্রি তালিকায় নতুন ক্রম দৃশ্যমান।`);
  };

  // Copy subjects from another class
  const handleExecuteCopy = () => {
    if (!copySourceClassId) return;
    const source = classes.find((c) => c.id === copySourceClassId);
    if (!source) return;

    copySubjectsBetweenClasses(copySourceClassId, currentClass.id, copyMode);
    setIsCopyModalOpen(false);
    showFeedback(
      `"${source.nameBn}" থেকে ${toBengaliNumber(
        source.defaultSubjects.length
      )}টি বিষয় "${currentClass.nameBn}" এ সফলভাবে অনুলিপি করা হয়েছে।`
    );
  };

  // Reset to default
  const handleExecuteReset = () => {
    resetClassSubjectsToDefault(currentClass.id);
    setIsResetConfirmOpen(false);
    showFeedback(`"${currentClass.nameBn}" এর বিষয়সমূহ স্ট্যান্ডার্ড কারিকুলাম অনুযায়ী সফলভাবে রিসেট করা হয়েছে।`);
  };

  // Metrics for current class
  const totalSubjects = subjects.length;
  const totalFullMarks = subjects.reduce((sum, s) => sum + s.fullMarks, 0);
  const continuousSubjectsCount = subjects.filter((s) => s.hasMonthlyExam).length;
  const directSubjectsCount = subjects.filter((s) => !s.hasMonthlyExam).length;

  // Filtered list
  const filteredSubjects = subjects.filter(
    (s) =>
      s.nameBn.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.nameEn && s.nameEn.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.code && s.code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Check how many students have marks entered in active term
  const countStudentsWithMarksForSubject = (subjectId: string): number => {
    let count = 0;
    const classStudents = students.filter((std) => std.classId === currentClass.id);
    classStudents.forEach((std) => {
      const recordId = `${std.id}_${selectedExamId}_${selectedYear}`;
      const rec = examRecords[recordId];
      if (rec?.marks[subjectId]?.examMarks !== null && rec?.marks[subjectId]?.examMarks !== undefined) {
        count++;
      }
    });
    return count;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl shadow-xl p-5 sm:p-6 text-white border border-indigo-700/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 bg-indigo-500/20 text-indigo-300 text-xs font-bold px-3 py-1 rounded-full border border-indigo-400/30 mb-2">
              <BookOpen className="w-3.5 h-3.5 mr-1" />
              একাডেমিক কারিকুলাম ও বিষয় কনফিগারেশন
            </div>
            <h1 className="text-xl sm:text-2xl font-bold font-serif tracking-tight">
              বিষয় ব্যবস্থাপনা (Subject Management)
            </h1>
            <p className="text-xs sm:text-sm text-indigo-200 mt-1 max-w-3xl leading-relaxed">
              শ্রেণি অনুযায়ী নতুন বিষয় তৈরি করুন, পূর্ণমান ও পাস নম্বর নির্ধারণ করুন এবং ধারাবাহিক মূল্যায়ন (৮০%+২০%)
              কনফিগার করুন। এখানে যেকোনো পরিবর্তন মার্ক এন্ট্রি ফর্ম ও ট্যাবুল্যাশন শিটে রিয়েল-টাইমে স্বয়ংক্রিয়ভাবে সিঙ্ক হবে।
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start md:self-center">
            {onNavigate && (
              <>
                <button
                  onClick={() => onNavigate('marks_entry', { classId: currentClass.id })}
                  className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition shadow-xs cursor-pointer backdrop-blur-sm"
                  title="মার্ক এন্ট্রি ফর্মে যান"
                >
                  <FileCheck2 className="w-3.5 h-3.5 mr-1.5 text-amber-300" />
                  মার্ক এন্ট্রিতে যান
                </button>
                <button
                  onClick={() => onNavigate('tabulation', { classId: currentClass.id })}
                  className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition shadow-xs cursor-pointer backdrop-blur-sm"
                  title="ট্যাবুল্যাশন শিট দেখুন"
                >
                  <TableProperties className="w-3.5 h-3.5 mr-1.5 text-emerald-300" />
                  ট্যাবুল্যাশন শিট
                </button>
              </>
            )}
            <button
              onClick={() => handleOpenAddModal()}
              className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold bg-indigo-500 hover:bg-indigo-400 text-white shadow-md transition cursor-pointer"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              নতুন বিষয় যোগ করুন
            </button>
          </div>
        </div>

        {/* Dynamic Metric Stats for Selected Class */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-indigo-700/40">
          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/10">
            <span className="text-[11px] font-medium text-indigo-200 block">বর্তমান শ্রেণি</span>
            <span className="text-base font-bold text-white font-serif">{currentClass.nameBn}</span>
          </div>

          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/10">
            <span className="text-[11px] font-medium text-indigo-200 block">মোট বিষয় সংখ্যা</span>
            <span className="text-base font-bold text-amber-300">{toBengaliNumber(totalSubjects)} টি</span>
          </div>

          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/10">
            <span className="text-[11px] font-medium text-indigo-200 block">শ্রেণির সর্বমোট পূর্ণমান</span>
            <span className="text-base font-bold text-emerald-300">{toBengaliNumber(totalFullMarks)} নম্বর</span>
          </div>

          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/10">
            <span className="text-[11px] font-medium text-indigo-200 block">মূল্যায়ন কাঠামো</span>
            <span className="text-xs font-semibold text-white">
              {toBengaliNumber(continuousSubjectsCount)}টি ৮০%+২০% | {toBengaliNumber(directSubjectsCount)}টি সরাসরি
            </span>
          </div>
        </div>
      </div>

      {/* Feedback Toast Notification */}
      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-bold shadow-sm transition-all duration-300 ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : feedbackMsg.type === 'warning'
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : 'bg-indigo-50 border-indigo-300 text-indigo-900'
          }`}
        >
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{feedbackMsg.text}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>
      )}

      {/* Class Selection Navigation Pills */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center">
            <GraduationCap className="w-4 h-4 mr-1.5 text-indigo-600" />
            শ্রেণি নির্বাচন করুন:
          </label>
          <div className="text-xs text-slate-500 font-medium">
            যেকোনো শ্রেণিতে ক্লিক করে তার পাঠ্যক্রম ও বিষয় তালিকা পরিচালনা করুন
          </div>
        </div>

        <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-thin">
          {classes.map((cls) => {
            const isSelected = cls.id === currentClass.id;
            const subCount = cls.defaultSubjects?.length || 0;
            const marksSum = cls.defaultSubjects?.reduce((acc, s) => acc + s.fullMarks, 0) || 0;

            return (
              <button
                key={cls.id}
                onClick={() => setSelectedClassId(cls.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center space-x-2 cursor-pointer border ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-200'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                <span>{cls.nameBn}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    isSelected ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {toBengaliNumber(subCount)}টি ({toBengaliNumber(marksSum)})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Controls Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/60">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder={`${currentClass.nameBn} এর বিষয় খুঁজুন...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center space-x-1 border border-slate-200 rounded-lg p-0.5 bg-white">
              <button
                onClick={() => setViewLayout('table')}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${
                  viewLayout === 'table' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                তালিকা ভিউ
              </button>
              <button
                onClick={() => setViewLayout('cards')}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${
                  viewLayout === 'cards' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                কার্ড ভিউ
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Copy from other class */}
            <button
              onClick={() => {
                setCopySourceClassId(classes.find((c) => c.id !== currentClass.id)?.id || '');
                setIsCopyModalOpen(true);
              }}
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
              title="অন্য কোনো শ্রেণির বিষয় তালিকা হুবহু কপি করে এখানে আনুন"
            >
              <Copy className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
              অন্য শ্রেণি থেকে কপি
            </button>

            {/* Reset to standard curriculum */}
            <button
              onClick={() => setIsResetConfirmOpen(true)}
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition shadow-2xs cursor-pointer"
              title="ডিফল্ট স্ট্যান্ডার্ড কারিকুলামে বিষয়সমূহ পুনর্বহাল করুন"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5 text-rose-600" />
              কারিকুলাম রিসেট
            </button>

            {/* Add Subject button */}
            <button
              onClick={() => handleOpenAddModal()}
              className="inline-flex items-center px-3.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              + বিষয় যোগ করুন
            </button>
          </div>
        </div>

        {/* Quick Suggestion Chips for Fast Adding */}
        <div className="p-3.5 bg-indigo-50/40 border-b border-slate-200 flex items-center space-x-2 overflow-x-auto text-xs">
          <span className="font-bold text-indigo-900 whitespace-nowrap flex items-center">
            <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-500" />
            দ্রুত যুক্ত করুন:
          </span>
          <div className="flex items-center space-x-1.5 overflow-x-auto py-0.5 scrollbar-thin">
            {COMMON_SUBJECT_SUGGESTIONS.map((preset, idx) => {
              const alreadyExists = subjects.some((s) => s.nameBn.trim() === preset.nameBn.trim());
              return (
                <button
                  key={idx}
                  onClick={() => handleOpenAddModal(preset)}
                  disabled={alreadyExists}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition whitespace-nowrap flex items-center space-x-1 cursor-pointer ${
                    alreadyExists
                      ? 'bg-slate-200/70 text-slate-400 cursor-not-allowed border border-slate-200'
                      : 'bg-white hover:bg-indigo-100 text-indigo-800 border border-indigo-200 shadow-2xs hover:border-indigo-300'
                  }`}
                  title={alreadyExists ? 'এই বিষয়টি ইতিমধ্যে এই শ্রেণিতে আছে' : `এক ক্লিকে ${preset.nameBn} যোগ করুন`}
                >
                  <span>{preset.nameBn}</span>
                  <span className="text-[10px] text-slate-500">({toBengaliNumber(preset.defaultFullMarks)})</span>
                  {alreadyExists && <Check className="w-3 h-3 text-slate-400 ml-0.5" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Subjects Content */}
        {filteredSubjects.length === 0 ? (
          <div className="text-center py-16 px-4">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-700">কোনো বিষয় পাওয়া যায়নি</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              {searchTerm
                ? `"${searchTerm}" এর সাথে মিলে এমন কোনো বিষয় খুঁজে পাওয়া যায়নি।`
                : `${currentClass.nameBn} এ এখনো কোনো বিষয় যুক্ত করা হয়নি। উপরে থাকা বোতাম বা কুইক চিপস ব্যবহার করে বিষয় যুক্ত করুন।`}
            </p>
            <div className="mt-4 flex justify-center space-x-2">
              <button
                onClick={() => handleOpenAddModal()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm"
              >
                + নতুন বিষয় যুক্ত করুন
              </button>
              <button
                onClick={() => handleExecuteReset()}
                className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold"
              >
                ডিফল্ট বিষয় লোড করুন
              </button>
            </div>
          </div>
        ) : viewLayout === 'table' ? (
          /* TABLE VIEW */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <th className="py-3 px-3 text-center w-14">ক্রম / সিরিয়াল</th>
                  <th className="py-3 px-4">বিষয়ের নাম</th>
                  <th className="py-3 px-3 text-center w-28">বিষয় কোড</th>
                  <th className="py-3 px-3 text-center w-28">পূর্ণমান</th>
                  <th className="py-3 px-3 text-center w-24">পাস মার্ক</th>
                  <th className="py-3 px-3">মূল্যায়ন পদ্ধতি</th>
                  <th className="py-3 px-3 text-center w-32">মার্ক এন্ট্রি স্ট্যাটাস</th>
                  <th className="py-3 px-4 text-center w-40">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredSubjects.map((sub, index) => {
                  const marksCount = countStudentsWithMarksForSubject(sub.id);
                  const isFirst = index === 0;
                  const isLast = index === subjects.length - 1;

                  return (
                    <tr key={sub.id} className="hover:bg-indigo-50/30 transition group">
                      {/* Order Controls */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <span className="font-bold text-slate-600 w-4 text-center">
                            {toBengaliNumber(index + 1)}
                          </span>
                          <div className="flex flex-col">
                            <button
                              disabled={isFirst}
                              onClick={() => handleMoveSubject(index, 'up')}
                              className="p-0.5 text-slate-400 hover:text-indigo-600 disabled:opacity-20 cursor-pointer"
                              title="উপরে তুলুন"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              disabled={isLast}
                              onClick={() => handleMoveSubject(index, 'down')}
                              className="p-0.5 text-slate-400 hover:text-indigo-600 disabled:opacity-20 cursor-pointer"
                              title="নিচে নামান"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Subject Name */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-sm">{sub.nameBn}</div>
                        {sub.nameEn && (
                          <div className="text-[11px] text-slate-500 font-sans">{sub.nameEn}</div>
                        )}
                        {sub.isOptional && (
                          <span className="inline-block mt-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                            ঐচ্ছিক বিষয়
                          </span>
                        )}
                      </td>

                      {/* Subject Code */}
                      <td className="py-3 px-3 text-center">
                        {sub.code ? (
                          <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                            {sub.code}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Full Marks */}
                      <td className="py-3 px-3 text-center">
                        <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 border border-indigo-200 text-indigo-900">
                          {toBengaliNumber(sub.fullMarks)} নম্বর
                        </span>
                      </td>

                      {/* Pass Marks */}
                      <td className="py-3 px-3 text-center">
                        <span className="text-xs font-bold text-slate-700">
                          {toBengaliNumber(sub.passMarks || Math.round(sub.fullMarks * 0.33))}
                        </span>
                      </td>

                      {/* Assessment Type */}
                      <td className="py-3 px-3">
                        {sub.hasMonthlyExam ? (
                          <div className="flex items-center space-x-1.5 text-xs text-indigo-900 font-medium">
                            <span className="w-2 h-2 rounded-full bg-indigo-600 flex-shrink-0" />
                            <span>৮০% সাময়িক + ২০% ধারাবাহিক</span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-1.5 text-xs text-emerald-800 font-medium">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                            <span>১০০% সরাসরি লিখিত/মৌখিক</span>
                          </div>
                        )}
                      </td>

                      {/* Marks Status */}
                      <td className="py-3 px-3 text-center">
                        {marksCount > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Check className="w-3 h-3 mr-1 text-emerald-600" />
                            {toBengaliNumber(marksCount)} জনের এন্ট্রি
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">এন্ট্রি হয়নি</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          {onNavigate && (
                            <button
                              onClick={() => onNavigate('marks_entry', { classId: currentClass.id, subjectId: sub.id })}
                              className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-100 transition cursor-pointer"
                              title="এই বিষয়ের মার্ক এন্ট্রিতে যান"
                            >
                              <FileCheck2 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenEditModal(sub)}
                            className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-100 transition cursor-pointer"
                            title="বিষয় তথ্য সম্পাদনা করুন"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTargetSubject(sub)}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-100 transition cursor-pointer"
                            title="বিষয়টি মুছে ফেলুন"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* CARD GRID VIEW */
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSubjects.map((sub, index) => {
              const marksCount = countStudentsWithMarksForSubject(sub.id);
              const isFirst = index === 0;
              const isLast = index === subjects.length - 1;

              return (
                <div
                  key={sub.id}
                  className="bg-white rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition p-4 relative flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-xs flex items-center justify-center">
                          {toBengaliNumber(index + 1)}
                        </span>
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm font-serif">{sub.nameBn}</h4>
                          {sub.nameEn && <span className="text-[11px] text-slate-500">{sub.nameEn}</span>}
                        </div>
                      </div>

                      {/* Order buttons */}
                      <div className="flex items-center space-x-0.5 bg-slate-50 rounded-lg p-0.5 border border-slate-200">
                        <button
                          disabled={isFirst}
                          onClick={() => handleMoveSubject(index, 'up')}
                          className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-20 cursor-pointer"
                          title="উপরে তুলুন"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          disabled={isLast}
                          onClick={() => handleMoveSubject(index, 'down')}
                          className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-20 cursor-pointer"
                          title="নিচে নামান"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-900 font-bold text-xs">
                        পূর্ণমান: {toBengaliNumber(sub.fullMarks)}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-xs">
                        পাস: {toBengaliNumber(sub.passMarks || Math.round(sub.fullMarks * 0.33))}
                      </span>
                      {sub.code && (
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]">
                          {sub.code}
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      {sub.hasMonthlyExam ? (
                        <span className="text-indigo-900 font-semibold flex items-center">
                          <Check className="w-3.5 h-3.5 mr-1 text-indigo-600" />
                          ৮০% সাময়িক পরীক্ষা + ২০% ধারাবাহিক মূল্যায়ন
                        </span>
                      ) : (
                        <span className="text-emerald-800 font-semibold flex items-center">
                          <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                          ১০০% সরাসরি লিখিত/মৌখিক পরীক্ষা
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      {marksCount > 0 ? (
                        <span className="text-[11px] text-emerald-700 font-bold">
                          {toBengaliNumber(marksCount)} জনের নম্বর এন্ট্রি আছে
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">নম্বর এন্ট্রি বাকি</span>
                      )}
                    </div>

                    <div className="flex items-center space-x-1">
                      {onNavigate && (
                        <button
                          onClick={() => onNavigate('marks_entry', { classId: currentClass.id, subjectId: sub.id })}
                          className="px-2 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-50 rounded"
                        >
                          মার্ক এন্ট্রি
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenEditModal(sub)}
                        className="p-1 text-amber-600 hover:bg-amber-50 rounded"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTargetSubject(sub)}
                        className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Synchronized Integration Notice */}
      <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 sm:p-5 flex items-start space-x-3 text-emerald-950">
        <ShieldCheck className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
        <div className="space-y-1 text-xs">
          <div className="font-bold text-emerald-900 text-sm">
            মার্ক এন্ট্রি ও ট্যাবুল্যাশন শিটের সাথে লাইভ অটো-সিঙ্ক সক্রিয়
          </div>
          <p className="text-emerald-800 leading-relaxed">
            এখানে যেকোনো বিষয় যুক্ত, সংশোধন বা মুছলে তা স্বয়ংক্রিয়ভাবে{' '}
            <strong className="font-bold">মার্ক এন্ট্রি ফর্ম (Mark Entry)</strong> এর ড্রপডাউন এবং{' '}
            <strong className="font-bold">ট্যাবুল্যাশন শিট (Tabulation Sheet)</strong> এর কলামে প্রদর্শিত হবে। কোনো রিলোড
            বা অতিরিক্ত ম্যানুয়াল কনফিগারেশনের প্রয়োজন নেই।
          </p>
        </div>
      </div>

      {/* ADD / EDIT SUBJECT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 max-h-[94vh] overflow-y-auto relative animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-serif">
                    {editingSubject ? 'বিষয় তথ্য সংশোধন করুন' : 'নতুন বিষয় যুক্ত করুন'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    শ্রেণি: <span className="font-bold text-indigo-900">{currentClass.nameBn}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSubject} className="space-y-4">
              {/* Subject Name Bengali */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  বিষয়ের নাম (বাংলায়) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: তথ্য ও যোগাযোগ প্রযুক্তি (ICT)"
                  value={formNameBn}
                  onChange={(e) => setFormNameBn(e.target.value)}
                  className="w-full text-sm font-semibold border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Subject Name English & Subject Code */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">বিষয়ের নাম (ইংরেজিতে)</label>
                  <input
                    type="text"
                    placeholder="e.g. Information Technology"
                    value={formNameEn}
                    onChange={(e) => setFormNameEn(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none font-sans"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">বিষয় কোড (Subject Code)</label>
                  <input
                    type="text"
                    placeholder="e.g. ICT-105"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Full Marks & Quick presets */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  পূর্ণমান (Full Marks) <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="10"
                    max="200"
                    required
                    value={formFullMarks}
                    onChange={(e) => handleFullMarksChange(parseInt(e.target.value, 10) || 100)}
                    className="w-32 text-sm font-bold text-center border border-indigo-300 rounded-lg p-2 bg-indigo-50/30 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex items-center space-x-1">
                    {[100, 50, 75, 25].map((marks) => (
                      <button
                        type="button"
                        key={marks}
                        onClick={() => handleFullMarksChange(marks)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition ${
                          formFullMarks === marks
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {toBengaliNumber(marks)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Pass Marks */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">পাস নম্বর (Pass Marks)</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="1"
                    max={formFullMarks}
                    required
                    value={formPassMarks}
                    onChange={(e) => setFormPassMarks(parseInt(e.target.value, 10) || 33)}
                    className="w-32 text-sm font-bold text-center border border-slate-300 rounded-lg p-2 bg-white focus:ring-1 focus:ring-indigo-500"
                  />
                  <span className="text-xs text-slate-500">
                    (সাধারণত পূর্ণমানের ৩৩% হিসেবে নির্ধারিত হয়)
                  </span>
                </div>
              </div>

              {/* Assessment Type Radio Options */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <label className="block text-xs font-bold text-slate-800">
                  মূল্যায়ন পদ্ধতি ও কাঠামো (Evaluation System):
                </label>

                <div
                  onClick={() => setFormHasMonthly(true)}
                  className={`p-3 rounded-xl border cursor-pointer transition flex items-start space-x-3 ${
                    formHasMonthly
                      ? 'bg-indigo-50/70 border-indigo-400 ring-1 ring-indigo-300'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    checked={formHasMonthly}
                    onChange={() => setFormHasMonthly(true)}
                    className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      ৮০% সাময়িক পরীক্ষা + ২০% ধারাবাহিক/মাসিক মূল্যায়ন (স্ট্যান্ডার্ড)
                    </span>
                    <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                      মার্ক এন্ট্রি ফর্মে লিখিত পরীক্ষা ও মাসিক ২০% নম্বরের পৃথক ইনপুট থাকবে। মোট প্রাপ্ত নম্বর
                      হিসেব হবে: (লিখিত×৮০%) + মাসিক ২০%।
                    </span>
                  </div>
                </div>

                <div
                  onClick={() => setFormHasMonthly(false)}
                  className={`p-3 rounded-xl border cursor-pointer transition flex items-start space-x-3 ${
                    !formHasMonthly
                      ? 'bg-indigo-50/70 border-indigo-400 ring-1 ring-indigo-300'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    checked={!formHasMonthly}
                    onChange={() => setFormHasMonthly(false)}
                    className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      ১০০% সরাসরি চূড়ান্ত পরীক্ষা (মাসিক মূল্যায়ন প্রযোজ্য নয়)
                    </span>
                    <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                      ব্যবহারিক, ড্রয়িং বা বিশেষ বিষয়ের জন্য যেখানে ধারাবাহিক মাসিক ২০% নেই; সরাসরি মোট নম্বর
                      ইনপুট করা হয়।
                    </span>
                  </div>
                </div>
              </div>

              {/* Multi-class batch assignment (Only shown when adding a new subject) */}
              {!editingSubject && (
                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800">
                      অন্যান্য শ্রেণিতেও একসাথে যুক্ত করুন (ঐচ্ছিক):
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (formSelectedClasses.length === classes.length) {
                          setFormSelectedClasses([currentClass.id]);
                        } else {
                          setFormSelectedClasses(classes.map((c) => c.id));
                        }
                      }}
                      className="text-[11px] font-bold text-indigo-600 hover:underline"
                    >
                      {formSelectedClasses.length === classes.length ? 'কেবল বর্তমান শ্রেণি' : 'সকল শ্রেণি নির্বাচন'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 max-h-36 overflow-y-auto">
                    {classes.map((cls) => {
                      const isChecked = formSelectedClasses.includes(cls.id);
                      return (
                        <label
                          key={cls.id}
                          className="flex items-center space-x-2 text-xs font-medium text-slate-700 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormSelectedClasses((prev) => [...prev, cls.id]);
                              } else {
                                if (formSelectedClasses.length > 1) {
                                  setFormSelectedClasses((prev) => prev.filter((id) => id !== cls.id));
                                }
                              }
                            }}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>{cls.nameBn}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center"
                >
                  <Check className="w-4 h-4 mr-1.5" />
                  {editingSubject ? 'হালনাগাদ সংরক্ষণ করুন' : 'বিষয় সংরক্ষণ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COPY SUBJECTS FROM ANOTHER CLASS MODAL */}
      {isCopyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Copy className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-serif">অন্য শ্রেণি থেকে বিষয় অনুলিপি</h3>
                  <p className="text-xs text-slate-500">টার্গেট শ্রেণি: {currentClass.nameBn}</p>
                </div>
              </div>
              <button
                onClick={() => setIsCopyModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  যে শ্রেণি থেকে কপি করবেন (উৎস শ্রেণি):
                </label>
                <select
                  value={copySourceClassId}
                  onChange={(e) => setCopySourceClassId(e.target.value)}
                  className="w-full text-sm font-bold border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white"
                >
                  {classes
                    .filter((c) => c.id !== currentClass.id)
                    .map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.nameBn} ({toBengaliNumber(cls.defaultSubjects.length)}টি বিষয়)
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">অনুলিপির ধরন (Copy Mode):</label>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 text-xs text-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      checked={copyMode === 'replace'}
                      onChange={() => setCopyMode('replace')}
                      className="text-indigo-600"
                    />
                    <span>
                      <strong>সম্পূর্ণ প্রতিস্থাপন (Replace):</strong> {currentClass.nameBn} এর বিদ্যমান বিষয় সরিয়ে
                      নতুনগুলো সেট হবে
                    </span>
                  </label>
                  <label className="flex items-center space-x-2 text-xs text-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      checked={copyMode === 'append'}
                      onChange={() => setCopyMode('append')}
                      className="text-indigo-600"
                    />
                    <span>
                      <strong>যুক্ত করুন (Append):</strong> বর্তমান বিষয়ের সাথে অতিরিক্ত হিসেবে যুক্ত হবে
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCopyModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  onClick={handleExecuteCopy}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center"
                >
                  <Copy className="w-3.5 h-3.5 mr-1.5" />
                  বিষয়সমূহ কপি করুন
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTargetSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 sm:p-6 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">বিষয় মুছে ফেলা নিশ্চিতকরণ</h3>
                <p className="text-xs text-slate-500">শ্রেণি: {currentClass.nameBn}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              আপনি কি নিশ্চিতভাবে <strong className="text-slate-900">"{deleteTargetSubject.nameBn}"</strong> বিষয়টি মুছে
              ফেলতে চান? এর ফলে এই বিষয়ের সমস্ত এন্ট্রি ও ট্যাবুল্যাশন শিটের সংশ্লিষ্ট কলাম বাদ যাবে।
            </p>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setDeleteTargetSubject(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm"
              >
                হ্যাঁ, মুছে ফেলুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESET TO DEFAULT CURRICULUM CONFIRMATION MODAL */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 sm:p-6 space-y-4">
            <div className="flex items-center space-x-3 text-amber-600">
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                <RotateCcw className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">ডিফল্ট কারিকুলামে রিসেট নিশ্চিতকরণ</h3>
                <p className="text-xs text-slate-500">শ্রেণি: {currentClass.nameBn}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              আপনি কি <strong className="text-slate-900">{currentClass.nameBn}</strong> এর বর্তমান বিষয় তালিকা মুছে
              স্ট্যান্ডার্ড জাতীয় শিক্ষাক্রম (NCTB / ডি-লিকন মডেল একাডেমী) অনুযায়ী ডিফল্ট বিষয়সমূহ পুনর্বহাল করতে চান?
            </p>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={handleExecuteReset}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm"
              >
                হ্যাঁ, কারিকুলাম রিসেট করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
