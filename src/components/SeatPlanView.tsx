import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Printer,
  FileDown,
  Eye,
  Settings,
  Upload,
  UserCheck,
  FileText,
  CheckCircle2,
  Image as ImageIcon,
  HelpCircle,
  Hash,
  School,
  Sparkles,
  Camera,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { Student } from '../types';
import { SeatPlanSlip } from './SeatPlanSlip';
import { SeatPlanPreviewModal } from './SeatPlanPreviewModal';
import { downloadSeatPlanHtml, openSeatPlanInNewTab } from '../utils/seatPlanExport';
import { toBengaliNumber } from '../utils/bengali';

export const SeatPlanView: React.FC = () => {
  const { schoolInfo, classes, students, updateStudent } = useSchool();

  // 1. Manual Exam Name State (User can freely type or click presets)
  const [examName, setExamName] = useState<string>('বার্ষিক পরীক্ষা - ২০২৬');

  // 2. Class & Section Selection
  const [selectedClassId, setSelectedClassId] = useState<string>(
    classes[0]?.id || 'class_play'
  );
  const [selectedSection, setSelectedSection] = useState<string>('all');

  // 3. Room & Bench Configuration
  const [roomNo, setRoomNo] = useState<string>('১০১');
  const [seatPrefix, setSeatPrefix] = useState<string>('B-');

  // 4. Custom Logo & Signature Upload
  const [customLogo, setCustomLogo] = useState<string>(schoolInfo.logoUrl || '');
  const [principalSig, setPrincipalSig] = useState<string>(
    schoolInfo.principalSignatureUrl || ''
  );
  const logoInputRef = useRef<HTMLInputElement>(null);
  const sigInputRef = useRef<HTMLInputElement>(null);

  // 5. Modal State
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);

  const printableContainerRef = useRef<HTMLDivElement>(null);

  // Current selected class object
  const currentClass = useMemo(() => {
    return classes.find((c) => c.id === selectedClassId) || classes[0];
  }, [classes, selectedClassId]);

  // Students of selected class & section
  const classStudents = useMemo(() => {
    let list = students.filter((s) => s.classId === selectedClassId);
    if (selectedSection !== 'all') {
      list = list.filter((s) => s.section === selectedSection);
    }
    return list.sort((a, b) => a.roll - b.roll);
  }, [students, selectedClassId, selectedSection]);

  // Group students in chunks of 8 (8 slips per A4 sheet)
  const groupedSheets = useMemo(() => {
    const chunks: Student[][] = [];
    for (let i = 0; i < classStudents.length; i += 8) {
      chunks.push(classStudents.slice(i, i + 8));
    }
    return chunks;
  }, [classStudents]);

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

  // Handle Logo Upload
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

  // Handle Principal Signature Upload
  const handleSigUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setPrincipalSig(base64);
    };
    reader.readAsDataURL(file);
  };

  // Handle Offline HTML Download
  const handleDownloadHtml = () => {
    if (!printableContainerRef.current) return;
    downloadSeatPlanHtml(
      schoolInfo.name || 'ডি-লিকন মডেল একাডেমী',
      examName,
      currentClass?.nameBn || 'শ্রেণি',
      printableContainerRef.current.innerHTML
    );
  };

  // Handle print lifecycle to isolate #seat-plan-printable-area
  useEffect(() => {
    const handleBeforePrint = () => {
      document.body.classList.add('printing-seat-plan');
    };
    const handleAfterPrint = () => {
      document.body.classList.remove('printing-seat-plan');
    };
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
      document.body.classList.remove('printing-seat-plan');
    };
  }, []);

  // Handle Direct Browser Print via New Tab (Bypasses iframe sandboxes completely)
  const handleTriggerPrint = () => {
    if (printableContainerRef.current) {
      openSeatPlanInNewTab(
        schoolInfo.name || 'ডি-লিকন মডেল একাডেমী',
        examName,
        currentClass?.nameBn || 'শ্রেণি',
        printableContainerRef.current.innerHTML
      );
    } else {
      document.body.classList.add('printing-seat-plan');
      window.focus();
      setTimeout(() => {
        window.print();
      }, 50);
    }
  };

  // Exam Name Presets
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
      {/* Print-specific Styles for 8-up A4 Portrait */}
      <style>{`
        @media print {
          @page {
            size: 210mm 297mm !important; /* Standard A4 Portrait */
            margin: 4mm 5mm 6mm 5mm !important; /* Safe printable margins */
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
          /* Strictly hide application frame and control center */
          body.printing-seat-plan #root > div > *:not(main),
          body.printing-seat-plan main > *:not(#seat-plan-printable-area),
          .no-print,
          nav, aside, header, footer, button, .control-bar-section,
          input, input[type="file"], input[type="file"]::file-selector-button {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            width: 0 !important;
            opacity: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          #seat-plan-printable-area {
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .seat-plan-a4-sheet {
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            clear: both !important;
            display: block !important;
            width: 200mm !important;
            max-width: 200mm !important;
            min-width: 200mm !important;
            height: 270mm !important;
            max-height: 270mm !important;
            min-height: 270mm !important;
            margin: 0 auto !important;
            padding: 2mm 2.5mm !important;
            box-shadow: none !important;
            border: none !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            background: #ffffff !important;
            font-family: 'Kalpurush', 'Hind Siliguri', 'SolaimanLipi', sans-serif !important;
          }
          .seat-plan-a4-sheet:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          .seat-plan-grid-8 {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            grid-template-rows: repeat(4, 1fr) !important;
            gap: 2mm !important;
            width: 100% !important;
            height: 100% !important;
            box-sizing: border-box !important;
          }
          .seat-plan-slip {
            height: 100% !important;
            max-height: 64.5mm !important;
            min-height: 0 !important;
            border: 1.5px solid #000000 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            box-sizing: border-box !important;
            overflow: visible !important;
            font-family: 'Kalpurush', 'Hind Siliguri', 'SolaimanLipi', sans-serif !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            padding: 3px 5px !important;
            background: #ffffff !important;
          }
          .seat-plan-header-row {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            justify-content: space-between !important;
            width: 100% !important;
          }
          .seat-plan-photo-container {
            width: 42px !important;
            min-width: 42px !important;
            max-width: 42px !important;
            flex-shrink: 0 !important;
          }
          .student-photo-box {
            width: 40px !important;
            height: 46px !important;
            border: 1.2px solid #000000 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
          }
          .student-photo-img {
            width: 100% !important;
            height: 100% !important;
            object-fit: cover !important;
            display: block !important;
          }
          .school-logo-img {
            width: 24px !important;
            height: 24px !important;
            object-fit: contain !important;
            display: block !important;
          }
          .principal-sig-img {
            max-height: 14px !important;
            max-width: 55px !important;
            object-fit: contain !important;
            display: block !important;
          }
        }
      `}</style>

      {/* Main Top Control Center */}
      <div className="control-bar-section bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Banner Header */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-indigo-950 p-4 sm:p-5 text-white flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-amber-400 text-slate-950 rounded-xl shadow-md font-bold">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                <span>পরীক্ষার আসন বিন্যাস স্লিপ প্রস্তুতকারক</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-sans font-bold">
                  ১ পাতায় ৮টি স্লিপ (A4 Portrait)
                </span>
              </h1>
              <p className="text-xs text-indigo-200 mt-0.5">
                শিক্ষার্থীদের ছবি সহ আসন স্লিপ। পরীক্ষার নাম একবার ম্যানুয়ালি লিখুন এবং শ্রেণি সিলেক্ট করে ১ ক্লিকে প্রিন্ট দিন।
              </p>
            </div>
          </div>

          {/* Main Action Buttons */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsPreviewModalOpen(true)}
              className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 active:scale-95 text-white rounded-xl font-bold text-xs sm:text-sm flex items-center space-x-1.5 shadow-md cursor-pointer transition border border-emerald-400"
              title="A4 পেপারের বাস্তব প্রিভিউ দেখুন"
            >
              <Eye className="w-4 h-4 text-emerald-200" />
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
              title="সরাসরি প্রিন্ট ডায়ালগ ওপেন করুন"
            >
              <Printer className="w-4 h-4 text-slate-950" />
              <span>🖨️ প্রিন্ট করুন (Ctrl + P)</span>
            </button>
          </div>
        </div>

        {/* Configuration Body */}
        <div className="p-4 sm:p-5 space-y-4 bg-slate-50/60">
          {/* Section 1: Manual Exam Name Entry & Presets */}
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-indigo-100 shadow-2xs space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>বর্তমান পরীক্ষার নাম (ম্যানুয়ালি লিখুন বা সিলেক্ট করুন):</span>
              </label>
              <span className="text-[11px] text-slate-500">
                (এখানে একবার যা লিখবেন তা প্রতিটি শিক্ষার্থীর স্লিপে অটোমেটিকভাবে আপডেট হবে)
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

          {/* Section 2: Class, Room No & Seat Prefix Controls (Branch removed as requested) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
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

            {/* Room Number */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Hash className="w-3.5 h-3.5 text-indigo-600" />
                <span>কক্ষ নং (Room No):</span>
              </label>
              <input
                type="text"
                value={roomNo}
                onChange={(e) => setRoomNo(e.target.value)}
                placeholder="যেমন: ১০১ বা রুম-২"
                className="w-full text-sm font-bold border-2 border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            {/* Seat Prefix */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                আসন নং প্রিফিক্স:
              </label>
              <input
                type="text"
                value={seatPrefix}
                onChange={(e) => setSeatPrefix(e.target.value)}
                placeholder="যেমন: B- বা A-"
                className="w-full text-sm font-bold border-2 border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Section 3: Logo & Principal Signature Upload Strip */}
          <div className="bg-slate-900 text-white p-3 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              {/* Logo Upload */}
              <div className="flex items-center space-x-2">
                <span className="font-bold text-amber-300 flex items-center gap-1">
                  <ImageIcon className="w-3.5 h-3.5" />
                  লোগো:
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

              {/* Principal Signature Upload */}
              <div className="flex items-center space-x-2">
                <span className="font-bold text-indigo-300 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" />
                  অধ্যক্ষের স্বাক্ষর:
                </span>
                <input
                  ref={sigInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleSigUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => sigInputRef.current?.click()}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold border border-slate-600 flex items-center space-x-1 cursor-pointer transition"
                >
                  <Upload className="w-3 h-3 text-indigo-400" />
                  <span>স্বাক্ষর ব্রাউজ</span>
                </button>
                {principalSig && (
                  <span className="text-[10px] text-emerald-400 font-semibold">✓ সেট করা</span>
                )}
              </div>
            </div>

            {/* Instruction Tip */}
            <div className="text-[11px] text-slate-300 flex items-center gap-1">
              <Camera className="w-3.5 h-3.5 text-amber-400" />
              <span>টিপস: যেকোনো শিক্ষার্থীর ছবিতে ক্লিক করে সরাসরি ছবি আপলোড করা যাবে</span>
            </div>
          </div>
        </div>

        {/* Paper & Student Calculation Bar */}
        <div className="bg-emerald-950/80 border-t border-emerald-800/60 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-200">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>
              শ্রেণি: <strong className="text-white">{currentClass?.nameBn}</strong> • মোট শিক্ষার্থী:{' '}
              <strong className="text-amber-300 font-bold">{toBengaliNumber(classStudents.length)}</strong> জন
            </span>
          </div>

          <div className="font-medium">
            মোট A4 কাগজ লাগবে:{' '}
            <strong className="text-white bg-emerald-800 px-2 py-0.5 rounded font-bold">
              {toBengaliNumber(groupedSheets.length)} টি পাতা
            </strong>{' '}
            (প্রতি A4 পাতায় ৮ টি করে আসন স্লিপ)
          </div>
        </div>
      </div>

      {/* Printable Area with 8 Slips per Sheet */}
      <div
        ref={printableContainerRef}
        id="seat-plan-printable-area"
        className="space-y-8 print:space-y-0"
      >
        {groupedSheets.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 shadow-sm">
            <UserCheck className="w-12 h-12 text-slate-400 mx-auto mb-2" />
            <h3 className="font-bold text-slate-800 text-base">
              {currentClass?.nameBn}-এ কোনো শিক্ষার্থী পাওয়া যায়নি।
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              অনুগ্রহ করে শিক্ষার্থী ব্যবস্থাপনা বা বাল্ক আপলোড থেকে শিক্ষার্থী যুক্ত করুন।
            </p>
          </div>
        ) : (
          groupedSheets.map((sheetStudents, sheetIdx) => (
            <div key={`sheet_wrapper_${sheetIdx}`} className="space-y-1">
              {/* Screen Indicator */}
              <div className="no-print print:hidden text-xs text-slate-600 font-semibold mb-1 flex justify-between bg-slate-200 px-3 py-1.5 rounded-lg max-w-[200mm] mx-auto border border-slate-300">
                <span>
                  A4 পাতা {toBengaliNumber(sheetIdx + 1)} / {toBengaliNumber(groupedSheets.length)} ({toBengaliNumber(sheetStudents.length)} জন শিক্ষার্থী)
                </span>
                <span className="text-indigo-700 font-bold">১ পাতায় ৮টি স্লিপ (Portrait)</span>
              </div>

              {/* A4 Sheet Container */}
              <div
                className="seat-plan-a4-sheet bg-white shadow-md max-w-[200mm] mx-auto border border-slate-300 rounded-sm print:shadow-none print:m-0 print:border-none"
                style={{
                  width: '200mm',
                  height: '268mm',
                  maxHeight: '268mm',
                  padding: '3mm 4mm',
                  boxSizing: 'border-box',
                  background: '#ffffff',
                }}
              >
                {/* 2x4 Grid (8 Slips) */}
                <div
                  className="seat-plan-grid-8"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gridTemplateRows: 'repeat(4, 1fr)',
                    gap: '6px',
                    width: '100%',
                    height: '100%',
                    boxSizing: 'border-box',
                  }}
                >
                  {Array.from({ length: 8 }).map((_, slotIdx) => {
                    const student = sheetStudents[slotIdx];
                    if (!student) {
                      return (
                        <div
                          key={`empty_slot_${sheetIdx}_${slotIdx}`}
                          className="border border-dashed border-slate-300 rounded-xs flex items-center justify-center text-slate-300 text-xs font-semibold bg-slate-50/40"
                          style={{
                            height: '100%',
                            maxHeight: '64mm',
                            boxSizing: 'border-box',
                          }}
                        >
                          <span>খালি স্লিপ</span>
                        </div>
                      );
                    }

                    const seatNo = `${seatPrefix}${student.roll}`;

                    return (
                      <div
                        key={student.id}
                        className="w-full relative"
                        style={{
                          height: '100%',
                          maxHeight: '64mm',
                          boxSizing: 'border-box',
                        }}
                      >
                        <SeatPlanSlip
                          student={student}
                          classNameBn={currentClass?.nameBn || 'শ্রেণি'}
                          examName={examName}
                          schoolInfo={schoolInfo}
                          roomNo={roomNo}
                          seatNo={seatNo}
                          onPhotoUpload={handleStudentPhotoUpload}
                          customLogoUrl={customLogo}
                          principalSignatureUrl={principalSig}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Realistic A4 Portrait Preview Modal */}
      <SeatPlanPreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        schoolInfo={schoolInfo}
        classNameBn={currentClass?.nameBn || 'শ্রেণি'}
        examName={examName}
        roomNo={roomNo}
        seatPrefix={seatPrefix}
        groupedStudents={groupedSheets}
        onPhotoUpload={handleStudentPhotoUpload}
        onDownloadHtml={handleDownloadHtml}
        onTriggerPrint={() => {
          setIsPreviewModalOpen(false);
          handleTriggerPrint();
        }}
        customLogoUrl={customLogo}
        principalSignatureUrl={principalSig}
      />
    </div>
  );
};
