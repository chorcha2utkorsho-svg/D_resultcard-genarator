import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Printer,
  FileDown,
  Eye,
  Sparkles,
  School,
  Image as ImageIcon,
  FileText,
  CheckCircle2,
  Users,
  Layers,
  Upload,
  BookOpen,
  ShieldCheck,
  FileBadge,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { Student } from '../types';
import { AdmitCardSlip } from './AdmitCardSlip';
import { AdmitCardPreviewModal } from './AdmitCardPreviewModal';
import {
  downloadAdmitCardHtml,
  openAdmitCardInNewTab,
} from '../utils/admitCardExport';
import { toBengaliNumber } from '../utils/bengali';

export type PrintMode = 'duplex' | 'front_only' | 'back_only';

export const AdmitCardView: React.FC = () => {
  const { schoolInfo, classes, students, updateStudent } = useSchool();

  // 1. Exam Name
  const [examName, setExamName] = useState<string>('বার্ষিক পরীক্ষা - ২০২৬');

  // Handle Photo Upload for a specific student
  const handleStudentPhotoUpload = (studentId: string, base64: string) => {
    const student = students.find((s) => s.id === studentId);
    if (student) {
      updateStudent({
        ...student,
        avatarUrl: base64,
      });
    }
  };

  // 2. Class Selection
  const [selectedClassId, setSelectedClassId] = useState<string>(
    classes[0]?.id || 'class_play'
  );

  // 3. Motto & Room
  const [examMotto, setExamMotto] = useState<string>('শিক্ষা • মূল্যবোধ • সাফল্য');
  const [roomNo, setRoomNo] = useState<string>('১০১');

  // 4. Print Mode & Screen View Toggle
  const [printMode, setPrintMode] = useState<PrintMode>('duplex');
  const [screenSide, setScreenSide] = useState<'front' | 'back'>('front');

  // 5. Custom Logo & Signatures
  const [customLogo, setCustomLogo] = useState<string>(schoolInfo.logoUrl || '');
  const [principalSig, setPrincipalSig] = useState<string>(
    schoolInfo.principalSignatureUrl || ''
  );
  const [classTeacherSig, setClassTeacherSig] = useState<string>('');

  const logoInputRef = useRef<HTMLInputElement>(null);
  const prinSigInputRef = useRef<HTMLInputElement>(null);
  const teacherSigInputRef = useRef<HTMLInputElement>(null);

  // 6. Preview Modal
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);

  const printableContainerRef = useRef<HTMLDivElement>(null);

  // Current class
  const currentClass = useMemo(() => {
    return classes.find((c) => c.id === selectedClassId) || classes[0];
  }, [classes, selectedClassId]);

  // Students of selected class
  const classStudents = useMemo(() => {
    return students
      .filter((s) => s.classId === selectedClassId)
      .sort((a, b) => a.roll - b.roll);
  }, [students, selectedClassId]);

  // Group students in chunks of 4 (4 cards per A4 sheet)
  const groupedSheets = useMemo(() => {
    const chunks: Student[][] = [];
    for (let i = 0; i < classStudents.length; i += 4) {
      chunks.push(classStudents.slice(i, i + 4));
    }
    return chunks;
  }, [classStudents]);

  // Logo Upload
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setCustomLogo(base64);
    };
    reader.readAsDataURL(file);
  };

  // Principal Signature Upload
  const handlePrinSigUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setPrincipalSig(base64);
    };
    reader.readAsDataURL(file);
  };

  // Class Teacher Signature Upload
  const handleTeacherSigUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setClassTeacherSig(base64);
    };
    reader.readAsDataURL(file);
  };

  const getModeTitle = (mode: PrintMode): string => {
    if (mode === 'duplex') return 'এপিঠ ও ওপিঠ (উভয় পৃষ্ঠা - Duplex)';
    if (mode === 'front_only') return 'শুধু সামনের পিঠ (Front Side)';
    return 'শুধু পেছনের পিঠ (Back Side / নিয়মাবলী)';
  };

  // Download Offline HTML
  const handleDownloadHtml = () => {
    if (!printableContainerRef.current) return;
    downloadAdmitCardHtml(
      schoolInfo.name || 'ডি-লিকন মডেল একাডেমি',
      examName,
      currentClass?.nameBn || 'শ্রেণি',
      printableContainerRef.current.innerHTML,
      getModeTitle(printMode)
    );
  };

  // Direct Print via new tab (bypasses iframe restrictions)
  const handleTriggerPrint = () => {
    if (printableContainerRef.current) {
      openAdmitCardInNewTab(
        schoolInfo.name || 'ডি-লিকন মডেল একাডেমি',
        examName,
        currentClass?.nameBn || 'শ্রেণি',
        printableContainerRef.current.innerHTML,
        getModeTitle(printMode)
      );
    } else {
      window.print();
    }
  };

  // Exam Presets
  const examPresets = [
    'বার্ষিক পরীক্ষা - ২০২৬',
    '১ম সাময়িক পরীক্ষা - ২০২৬',
    '২য় সাময়িক পরীক্ষা - ২০২৬',
    '১ম টিউটোরিয়াল পরীক্ষা',
    '২য় টিউটোরিয়াল পরীক্ষা',
    'প্রাক-নির্বাচনী পরীক্ষা',
    'মডেল টেস্ট পরীক্ষা',
  ];

  return (
    <div
      className="space-y-6 pb-12"
      style={{ fontFamily: "'Kalpurush', 'Hind Siliguri', sans-serif" }}
    >
      {/* Print Styles for 4-up A4 Portrait */}
      <style>{`
        @media print {
          @page {
            size: 210mm 297mm !important;
            margin: 0 !important;
          }
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
            padding: 0 !important;
            margin: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            font-family: 'Kalpurush', 'Hind Siliguri', 'SolaimanLipi', sans-serif !important;
          }
          .no-print, nav, aside, header, footer, button, .control-bar-section, input {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
          }
          #admit-card-printable-area {
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .admit-card-a4-sheet {
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            clear: both !important;
            display: block !important;
            width: 210mm !important;
            height: 297mm !important;
            max-height: 297mm !important;
            padding: 8mm 8mm !important;
            box-shadow: none !important;
            border: none !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            background: #ffffff !important;
          }
          .admit-card-a4-sheet:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          .admit-card-grid-4 {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            grid-template-rows: repeat(2, 1fr) !important;
            gap: 5mm !important;
            width: 100% !important;
            height: 100% !important;
            box-sizing: border-box !important;
          }
          .admit-card-slip {
            border: 1.5px solid #0a1d4d !important;
            height: 100% !important;
            max-height: 136mm !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            background: #ffffff !important;
          }
        }
      `}</style>

      {/* Main Top Control Center */}
      <div className="control-bar-section bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Banner Header */}
        <div className="bg-gradient-to-r from-blue-950 via-indigo-950 to-slate-950 p-4 sm:p-5 text-white flex flex-wrap items-center justify-between gap-4 border-b border-indigo-900">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-amber-400 text-slate-950 rounded-xl shadow-md font-bold">
              <FileBadge className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                <span>পরীক্ষার এপিঠ-ওপিঠ এডমিট কার্ড প্রস্তুতকারক</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 font-sans font-bold">
                  ১ পাতায় ৪টি কার্ড (A4 Portrait)
                </span>
              </h1>
              <p className="text-xs text-indigo-200 mt-0.5">
                একই ডেটাবেজ থেকে স্বয়ংক্রিয়ভাবে প্রবেশপত্র তৈরি। সামনের পৃষ্ঠায় শিক্ষার্থীর তথ্য ও প্রবেশপত্র এবং অপর পৃষ্ঠায় পরীক্ষার সাধারণ নিয়মাবলী।
              </p>
            </div>
          </div>

          {/* Main Action Buttons */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsPreviewModalOpen(true)}
              className="px-4 py-2.5 bg-indigo-700 hover:bg-indigo-600 active:scale-95 text-white rounded-xl font-bold text-xs sm:text-sm flex items-center space-x-1.5 shadow-md cursor-pointer transition border border-indigo-400"
              title="A4 পেপারের বাস্তব প্রিভিউ দেখুন"
            >
              <Eye className="w-4 h-4 text-amber-300" />
              <span>👁️ প্রিন্ট প্রিভিউ দেখুন</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadHtml}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-xl font-bold text-xs sm:text-sm flex items-center space-x-1.5 shadow-md cursor-pointer transition ring-2 ring-blue-300"
              title="অফলাইন প্রিন্ট ফাইল ডাউনলোড করুন (HTML)"
            >
              <FileDown className="w-4 h-4 text-amber-300" />
              <span>📥 প্রিন্ট ফাইল ডাউনলোড</span>
            </button>

            <button
              type="button"
              onClick={handleTriggerPrint}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 rounded-xl font-bold text-xs sm:text-sm flex items-center space-x-1.5 shadow-md cursor-pointer transition ring-2 ring-amber-300"
              title="সরাসরি প্রিন্ট ডায়ালগ ওপেন করুন (নতুন ট্যাব)"
            >
              <Printer className="w-4 h-4 text-slate-950" />
              <span>🖨️ প্রিন্ট করুন (Ctrl + P)</span>
            </button>
          </div>
        </div>

        {/* Configuration Body */}
        <div className="p-4 sm:p-5 space-y-4 bg-slate-50/60">
          {/* Section 1: Exam Name Entry & Presets */}
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-indigo-100 shadow-2xs space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>বর্তমান পরীক্ষার নাম:</span>
              </label>
              <span className="text-[11px] text-slate-500">
                (এখানে টাইপ করলে প্রতিটি শিক্ষার্থীর এডমিট কার্ডে স্বয়ংক্রিয়ভাবে নাম চলে আসবে)
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                placeholder="যেমন: বার্ষিক পরীক্ষা - ২০২৬ বা ২য় সাময়িক পরীক্ষা"
                className="flex-1 px-3.5 py-2 text-sm font-bold bg-white border-2 border-indigo-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
              />
            </div>

            {/* Exam Presets */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] font-semibold text-slate-500">সহজ প্রিসেট:</span>
              {examPresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setExamName(preset)}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                    examName === preset
                      ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Section 2: Class Selection, Room No, Motto & Printing Mode Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            {/* Class Dropdown */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <School className="w-3.5 h-3.5 text-indigo-600" />
                <span>শ্রেণি নির্বাচন:</span>
              </label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full text-sm font-bold border-2 border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
              >
                {classes.map((cls) => {
                  const count = students.filter((s) => s.classId === cls.id).length;
                  return (
                    <option key={cls.id} value={cls.id}>
                      {cls.nameBn} ({toBengaliNumber(count)} জন)
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Room No */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <FileBadge className="w-3.5 h-3.5 text-indigo-600" />
                <span>কক্ষ নং (Room No):</span>
              </label>
              <input
                type="text"
                value={roomNo}
                onChange={(e) => setRoomNo(e.target.value)}
                placeholder="যেমন: ১০১"
                className="w-full text-sm font-bold border-2 border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            {/* School Motto */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                <span>মূলমন্ত্র / স্লোগান:</span>
              </label>
              <input
                type="text"
                value={examMotto}
                onChange={(e) => setExamMotto(e.target.value)}
                placeholder="যেমন: শিক্ষা • মূল্যবোধ • সাফল্য"
                className="w-full text-sm font-bold border-2 border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            {/* Printing Mode (Duplex / Front / Back) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <span>প্রিন্ট ফরম্যাট নির্বাচন:</span>
              </label>
              <div className="grid grid-cols-3 gap-1 p-0.5 bg-slate-100 rounded-lg border border-slate-300">
                <button
                  type="button"
                  onClick={() => setPrintMode('duplex')}
                  className={`py-1.5 text-[11px] font-bold rounded-md transition cursor-pointer text-center ${
                    printMode === 'duplex'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-700 hover:bg-slate-200'
                  }`}
                  title="এপিঠ ও ওপিঠ উভয় পৃষ্ঠা পর্যায়ক্রমে প্রিন্ট হবে"
                >
                  উভয় পিঠ
                </button>
                <button
                  type="button"
                  onClick={() => setPrintMode('front_only')}
                  className={`py-1.5 text-[11px] font-bold rounded-md transition cursor-pointer text-center ${
                    printMode === 'front_only'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-700 hover:bg-slate-200'
                  }`}
                  title="শুধুমাত্র কার্ডের সামনের অংশ প্রিন্ট হবে"
                >
                  সামনে
                </button>
                <button
                  type="button"
                  onClick={() => setPrintMode('back_only')}
                  className={`py-1.5 text-[11px] font-bold rounded-md transition cursor-pointer text-center ${
                    printMode === 'back_only'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-700 hover:bg-slate-200'
                  }`}
                  title="শুধুমাত্র পেছনের নিয়মাবলী অংশ প্রিন্ট হবে"
                >
                  পেছনে
                </button>
              </div>
            </div>
          </div>

          {/* Section 3: Signatures & Logo Upload Strip */}
          <div className="bg-slate-900 text-white p-3 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-4">
              {/* Logo */}
              <div className="flex items-center space-x-2">
                <span className="font-bold text-amber-300 flex items-center gap-1">
                  <ImageIcon className="w-3.5 h-3.5" /> লোগো:
                </span>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold border border-slate-600 flex items-center space-x-1 cursor-pointer transition"
                >
                  <Upload className="w-3 h-3 text-amber-400" />
                  <span>লোগো ব্রাউজ</span>
                </button>
                {customLogo && (
                  <span className="text-[10px] text-emerald-400 font-semibold">✓ সেট করা</span>
                )}
              </div>

              {/* Principal Signature */}
              <div className="flex items-center space-x-2">
                <span className="font-bold text-indigo-300 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" /> প্রধান শিক্ষকের স্বাক্ষর:
                </span>
                <input
                  ref={prinSigInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handlePrinSigUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => prinSigInputRef.current?.click()}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold border border-slate-600 flex items-center space-x-1 cursor-pointer transition"
                >
                  <Upload className="w-3 h-3 text-indigo-400" />
                  <span>স্বাক্ষর ব্রাউজ</span>
                </button>
                {principalSig && (
                  <span className="text-[10px] text-emerald-400 font-semibold">✓ সেট করা</span>
                )}
              </div>

              {/* Class Teacher Signature */}
              <div className="flex items-center space-x-2">
                <span className="font-bold text-emerald-300 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" /> শ্রেণি শিক্ষকের স্বাক্ষর:
                </span>
                <input
                  ref={teacherSigInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleTeacherSigUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => teacherSigInputRef.current?.click()}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold border border-slate-600 flex items-center space-x-1 cursor-pointer transition"
                >
                  <Upload className="w-3 h-3 text-emerald-400" />
                  <span>স্বাক্ষর ব্রাউজ</span>
                </button>
                {classTeacherSig && (
                  <span className="text-[10px] text-emerald-400 font-semibold">✓ সেট করা</span>
                )}
              </div>
            </div>

            {/* Screen Side Preview Toggle */}
            <div className="flex items-center space-x-1.5 bg-slate-800 px-2 py-1 rounded-lg border border-slate-700">
              <span className="text-[11px] text-slate-300 mr-1 font-semibold">স্ক্রিনে দেখুন:</span>
              <button
                type="button"
                onClick={() => setScreenSide('front')}
                className={`px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer ${
                  screenSide === 'front'
                    ? 'bg-amber-400 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                📄 এপিঠ (Front)
              </button>
              <button
                type="button"
                onClick={() => setScreenSide('back')}
                className={`px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer ${
                  screenSide === 'back'
                    ? 'bg-amber-400 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                📋 ওপিঠ (Back)
              </button>
            </div>
          </div>
        </div>

        {/* Paper & Student Calculation Bar */}
        <div className="bg-slate-950 border-t border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-indigo-200">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>
              শ্রেণি: <strong className="text-white">{currentClass?.nameBn}</strong> • মোট শিক্ষার্থী:{' '}
              <strong className="text-amber-300 font-bold">{toBengaliNumber(classStudents.length)}</strong> জন
            </span>
          </div>

          <div className="font-medium flex items-center space-x-3">
            <span>
              মোট A4 কাগজ লাগবে:{' '}
              <strong className="text-white bg-indigo-900 px-2.5 py-0.5 rounded font-bold border border-indigo-700">
                {toBengaliNumber(groupedSheets.length)} টি পাতা
              </strong>{' '}
              (প্রতি A4 পাতায় ৪টি করে এডমিট কার্ড)
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-amber-300 font-semibold">
              প্রিন্ট মোড: {getModeTitle(printMode)}
            </span>
          </div>
        </div>
      </div>

      {/* Printable Area with 4 Cards per A4 Sheet */}
      <div
        ref={printableContainerRef}
        id="admit-card-printable-area"
        className="space-y-8 print:space-y-0"
      >
        {groupedSheets.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 shadow-sm">
            <Users className="w-12 h-12 text-slate-400 mx-auto mb-2" />
            <h3 className="font-bold text-slate-800 text-base">
              {currentClass?.nameBn}-এ কোনো শিক্ষার্থী পাওয়া যায়নি।
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              অনুগ্রহ করে শিক্ষার্থী ব্যবস্থাপনা বা বাল্ক আপলোড থেকে শিক্ষার্থী যুক্ত করুন।
            </p>
          </div>
        ) : (
          groupedSheets.map((sheetStudents, sheetIdx) => {
            // Function to render a 2x2 grid of 4 cards
            const renderSheetGrid = (
              studentsList: Student[],
              sideToRender: 'front' | 'back',
              pageLabel: string
            ) => (
              <div key={`sheet_${sheetIdx}_${sideToRender}`} className="space-y-1">
                {/* Screen Indicator */}
                <div className="no-print print:hidden text-xs text-slate-600 font-semibold mb-1 flex justify-between bg-slate-200 px-3 py-1.5 rounded-lg max-w-[200mm] mx-auto border border-slate-300">
                  <span>
                    A4 পাতা {toBengaliNumber(sheetIdx + 1)} • {pageLabel} ({toBengaliNumber(studentsList.length)} জন শিক্ষার্থী)
                  </span>
                  <span className="text-indigo-800 font-bold">
                    {sideToRender === 'front' ? '📄 এপিঠ (প্রবেশপত্র)' : '📋 ওপিঠ (নিয়মাবলী)'} • ৪টি কার্ড
                  </span>
                </div>

                {/* A4 Sheet Container */}
                <div
                  className="admit-card-a4-sheet bg-white shadow-md max-w-[200mm] mx-auto border border-slate-300 rounded-sm print:shadow-none print:m-0 print:border-none"
                  style={{
                    width: '200mm',
                    height: '272mm',
                    maxHeight: '272mm',
                    padding: '6mm 7mm',
                    boxSizing: 'border-box',
                    background: '#ffffff',
                  }}
                >
                  {/* 2x2 Grid (4 Cards) */}
                  <div
                    className="admit-card-grid-4"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gridTemplateRows: 'repeat(2, 1fr)',
                      gap: '12px',
                      width: '100%',
                      height: '100%',
                      boxSizing: 'border-box',
                    }}
                  >
                    {Array.from({ length: 4 }).map((_, slotIdx) => {
                      // For back side duplex alignment:
                      // Slot 0 (top-left) mirrors with Slot 1 (top-right)
                      // Slot 2 (bottom-left) mirrors with Slot 3 (bottom-right)
                      let studentIdx = slotIdx;
                      if (sideToRender === 'back') {
                        if (slotIdx === 0) studentIdx = 1;
                        else if (slotIdx === 1) studentIdx = 0;
                        else if (slotIdx === 2) studentIdx = 3;
                        else if (slotIdx === 3) studentIdx = 2;
                      }

                      const student = studentsList[studentIdx];
                      if (!student) {
                        return (
                          <div
                            key={`empty_slot_${sheetIdx}_${slotIdx}`}
                            className="border border-dashed border-slate-300 rounded-md flex items-center justify-center text-slate-300 text-sm font-semibold bg-slate-50/40"
                            style={{
                              height: '100%',
                              maxHeight: '130mm',
                              boxSizing: 'border-box',
                            }}
                          >
                            <span>খালি এডমিট কার্ড</span>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={`admit_${student.id}_${sideToRender}`}
                          className="w-full relative"
                          style={{
                            height: '100%',
                            maxHeight: '130mm',
                            boxSizing: 'border-box',
                          }}
                        >
                          <AdmitCardSlip
                            student={student}
                            classNameBn={currentClass?.nameBn || 'শ্রেণি'}
                            examName={examName}
                            schoolInfo={schoolInfo}
                            side={sideToRender}
                            customLogoUrl={customLogo}
                            principalSignatureUrl={principalSig}
                            classTeacherSignatureUrl={classTeacherSig}
                            examMotto={examMotto}
                            roomNo={roomNo}
                            onPhotoUpload={handleStudentPhotoUpload}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );

            // In Duplex Mode:
            // Output Front Page, immediately followed by Back Page
            if (printMode === 'duplex') {
              return (
                <React.Fragment key={`duplex_group_${sheetIdx}`}>
                  {renderSheetGrid(sheetStudents, 'front', 'এপিঠ (প্রবেশপত্র)')}
                  {renderSheetGrid(sheetStudents, 'back', 'ওপিঠ (নিয়মাবলী)')}
                </React.Fragment>
              );
            }

            // In Single-Side Mode:
            // Check printMode or screenSide
            const activeSide = printMode === 'front_only' ? 'front' : printMode === 'back_only' ? 'back' : screenSide;
            return renderSheetGrid(
              sheetStudents,
              activeSide,
              activeSide === 'front' ? 'এপিঠ (প্রবেশপত্র)' : 'ওপিঠ (নিয়মাবলী)'
            );
          })
        )}
      </div>

      {/* Realistic A4 Preview Modal */}
      <AdmitCardPreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        schoolInfo={schoolInfo}
        classNameBn={currentClass?.nameBn || 'শ্রেণি'}
        examName={examName}
        groupedStudents={groupedSheets}
        onDownloadHtml={handleDownloadHtml}
        onTriggerPrint={() => {
          setIsPreviewModalOpen(false);
          handleTriggerPrint();
        }}
        customLogoUrl={customLogo}
        principalSignatureUrl={principalSig}
        classTeacherSignatureUrl={classTeacherSig}
        examMotto={examMotto}
        roomNo={roomNo}
        onPhotoUpload={handleStudentPhotoUpload}
      />
    </div>
  );
};
