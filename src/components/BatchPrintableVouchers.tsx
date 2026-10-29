import React, { useState, useMemo, useRef } from 'react';
import {
  Printer,
  X,
  FileText,
  UserCheck,
  Scissors,
  CheckCircle2,
  Copy,
  Layers,
  Sparkles,
  ExternalLink,
  Download,
  FileDown,
  Info,
  Upload,
  FileCheck,
  Trash2,
  Image as ImageIcon,
} from 'lucide-react';
import { SchoolInfo, Student, FeeInvoice, SchoolClass } from '../types';
import { toBengaliNumber, toBengaliRoll } from '../utils/bengali';
import { numberToBengaliWords } from '../utils/bengaliWords';
import { STANDARD_8_VOUCHER_HEADS } from '../data/defaultData';
import { SingleReceiptSlip, PrintableReceiptData } from './PrintableReceiptLayout';
import { downloadPrintableHtml } from '../utils/voucherExport';

export type VoucherPrintMode = 'blank_students' | 'universal_blank' | 'with_amounts';
export type PaperSavingLayout =
  | 'two_students_landscape' // 1 A4 Landscape sheet with 2 slips SIDE-BY-SIDE (DEFAULT)
  | 'four_students_per_sheet' // 1 A4 sheet with 4 students in 2x2 grid
  | 'single_student_double_copy'; // 1 A4 Landscape sheet with 1 student (Office + Student copies)

export interface BatchPrintableVouchersProps {
  schoolInfo: SchoolInfo;
  students: Student[];
  invoices: FeeInvoice[];
  classes: SchoolClass[];
  initialClassId?: string;
  initialSection?: string;
  voucherType?: 'due_slip' | 'money_receipt';
  initialIsBlank?: boolean;
  onClose: () => void;
}

export const BatchPrintableVouchers: React.FC<BatchPrintableVouchersProps> = ({
  schoolInfo,
  students,
  invoices,
  classes,
  initialClassId,
  initialSection = 'all',
  voucherType = 'due_slip',
  initialIsBlank = true,
  onClose,
}) => {
  const defaultClassId =
    initialClassId && initialClassId !== 'all'
      ? initialClassId
      : classes.find((c) => students.some((s) => s.classId === c.id))?.id || classes[0]?.id || 'class_play';

  const [selectedClassId, setSelectedClassId] = useState<string>(defaultClassId);
  const [selectedSection, setSelectedSection] = useState<string>(initialSection);
  const [voucherMode, setVoucherMode] = useState<VoucherPrintMode>(
    initialIsBlank ? 'blank_students' : 'with_amounts'
  );

  // Custom Logo and Signatures state (Base64 data URLs for 100% offline reliability)
  const [customLogo, setCustomLogo] = useState<string>(schoolInfo.logoUrl || '');
  const [principalSig, setPrincipalSig] = useState<string>(schoolInfo.principalSignatureUrl || '');
  const [guardianSig, setGuardianSig] = useState<string>('');

  const logoInputRef = useRef<HTMLInputElement>(null);
  const principalSigInputRef = useRef<HTMLInputElement>(null);
  const guardianSigInputRef = useRef<HTMLInputElement>(null);

  // DEFAULT: 2 STUDENTS SIDE-BY-SIDE ON A4 LANDSCAPE
  const [paperLayout, setPaperLayout] = useState<PaperSavingLayout>('two_students_landscape');

  const [customTitle, setCustomTitle] = useState<string>(
    voucherType === 'due_slip' ? 'বকেয়া নোটিশ / বিল' : 'বেতনের রিসিট'
  );

  const [copyLabel, setCopyLabel] = useState<string>('- শিক্ষার্থী কপি (নোটিশ বিল) -');

  const [universalBlankCount, setUniversalBlankCount] = useState<number>(10);
  const printableAreaRef = useRef<HTMLDivElement>(null);

  const currentClass = useMemo(() => {
    return classes.find((c) => c.id === selectedClassId) || classes[0];
  }, [classes, selectedClassId]);

  const classStudents = useMemo(() => {
    let list = students.filter((s) => s.classId === selectedClassId);
    if (selectedSection !== 'all') {
      list = list.filter((s) => s.section === selectedSection);
    }
    return list.sort((a, b) => a.roll - b.roll);
  }, [students, selectedClassId, selectedSection]);

  const getStudentVoucherData = (student: Student | null): PrintableReceiptData => {
    const matchedClass = student ? classes.find((c) => c.id === student.classId) : null;
    const classNameBn = matchedClass ? matchedClass.nameBn : currentClass?.nameBn || 'শ্রেণি';

    if (voucherMode === 'blank_students' || voucherMode === 'universal_blank' || !student) {
      const blankItems = STANDARD_8_VOUCHER_HEADS.map((head) => ({
        serialBn: head.serialBn,
        nameBn: head.nameBn,
        amount: 0,
      }));
      return {
        classNameBn,
        items: blankItems,
        grandTotal: 0,
        grandTotalWords: '',
      };
    }

    const studentInvoice = invoices.find((inv) => inv.studentId === student.id);
    const items = STANDARD_8_VOUCHER_HEADS.map((head) => {
      let amount = 0;
      if (studentInvoice) {
        if (head.id === 'fh_arrears') {
          amount = studentInvoice.previousDue || 0;
        } else {
          const match = studentInvoice.items.find(
            (item) =>
              item.headId === head.id ||
              item.nameBn.includes(head.nameBn) ||
              head.nameBn.includes(item.nameBn)
          );
          if (match) {
            amount = match.netAmount || match.amount || 0;
          }
        }
      } else {
        amount = 0;
      }
      return {
        serialBn: head.serialBn,
        nameBn: head.nameBn,
        amount,
      };
    });

    const grandTotal = items.reduce((sum, i) => sum + i.amount, 0);
    const grandTotalWords = grandTotal > 0 ? numberToBengaliWords(grandTotal) : '';

    return {
      classNameBn,
      items,
      grandTotal,
      grandTotalWords,
    };
  };

  const groupedStudents = useMemo(() => {
    if (voucherMode === 'universal_blank') {
      const groups: (Student | null)[][] = [];
      const totalSheets = universalBlankCount || 5;
      for (let i = 0; i < totalSheets; i++) {
        if (paperLayout === 'four_students_per_sheet') {
          groups.push([null, null, null, null]);
        } else if (paperLayout === 'single_student_double_copy') {
          groups.push([null]);
        } else {
          groups.push([null, null]);
        }
      }
      return groups;
    }

    if (paperLayout === 'single_student_double_copy') {
      return classStudents.map((s) => [s]);
    }
    if (paperLayout === 'four_students_per_sheet') {
      const groups: (Student | null)[][] = [];
      for (let i = 0; i < classStudents.length; i += 4) {
        groups.push([
          classStudents[i] || null,
          classStudents[i + 1] || null,
          classStudents[i + 2] || null,
          classStudents[i + 3] || null,
        ]);
      }
      return groups;
    }
    // Default: 2 students side-by-side
    const groups: (Student | null)[][] = [];
    for (let i = 0; i < classStudents.length; i += 2) {
      groups.push([classStudents[i] || null, classStudents[i + 1] || null]);
    }
    return groups;
  }, [classStudents, paperLayout, voucherMode, universalBlankCount]);

  const calculatedPageCount = useMemo(() => {
    if (voucherMode === 'universal_blank') return universalBlankCount;
    if (paperLayout === 'four_students_per_sheet') {
      return Math.ceil(classStudents.length / 4);
    }
    return Math.ceil(classStudents.length / 2);
  }, [voucherMode, universalBlankCount, paperLayout, classStudents.length]);

  // Handle Logo Upload (Converts to Base64 data URL)
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
  const handlePrincipalSigUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setPrincipalSig(base64);
    };
    reader.readAsDataURL(file);
  };

  // Handle Guardian Signature Upload
  const handleGuardianSigUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setGuardianSig(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleDownloadHtml = () => {
    if (!printableAreaRef.current) return;
    downloadPrintableHtml(
      customTitle,
      currentClass?.nameBn || 'class',
      'landscape',
      printableAreaRef.current.innerHTML
    );
  };

  return (
    <div
      id="batch-printable-vouchers-modal"
      className="batch-voucher-modal-portal fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-xs overflow-y-auto flex items-start justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static print:inset-auto"
    >
      <style>{`
        @media print {
          @page {
            size: 297mm 210mm !important;
            margin: 5mm 5mm !important;
          }
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
            padding: 0 !important;
            margin: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print,
          .batch-voucher-control-bar,
          nav, aside, header, footer, button {
            display: none !important;
          }
          .official-voucher-sheet-wrapper,
          .official-voucher-a4-sheet {
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            clear: both !important;
            display: block !important;
            width: 100% !important;
          }
          .official-voucher-a4-sheet {
            margin: 0 auto !important;
            padding: 2mm 3mm !important;
            width: 287mm !important;
            max-width: 287mm !important;
            box-shadow: none !important;
            border: none !important;
            box-sizing: border-box !important;
          }
          .official-voucher-sheet-wrapper:last-child,
          .official-voucher-a4-sheet:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          .official-voucher-slip {
            border: 2px solid #000000 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            box-sizing: border-box !important;
          }
          .official-voucher-slip img {
            max-height: 26px !important;
            max-width: 90px !important;
            object-fit: contain !important;
          }
        }
      `}</style>

      <div className="bg-slate-100 rounded-2xl shadow-2xl max-w-6xl w-full my-3 overflow-hidden border border-slate-300 print:shadow-none print:border-none print:m-0 print:max-w-none">
        {/* Top Control Bar */}
        <div className="batch-voucher-control-bar p-3.5 sm:p-4 bg-slate-900 text-white flex flex-col gap-3 print:hidden border-b border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-amber-400" />
              <div>
                <h2 className="font-bold text-sm sm:text-base font-serif flex items-center gap-2">
                  <span>অভিভাবক নোটিশ ও মানি রিসিট প্রস্তুতকারক</span>
                  <span className="px-2.5 py-0.5 text-xs rounded-full bg-emerald-950 text-emerald-300 border border-emerald-600 font-sans font-bold">
                    ১ পাতায় পাশাপাশি ২টি স্লিপ (A4 Landscape - ৫০% কাগজ সাশ্রয়)
                  </span>
                </h2>
                <p className="text-[11px] text-slate-300">
                  ১টি A4 পাতায় বামে ১ জন ও ডানে ১ জন শিক্ষার্থীর স্লিপ পাশাপাশি থাকবে। মাঝখান দিয়ে কেটে ২ জনকে দিন।
                </p>
              </div>
            </div>

            {/* ACTION BUTTON: The single working, verified Blue Print File Download Button */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleDownloadHtml}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-xl font-bold text-sm sm:text-base flex items-center space-x-2 shadow-xl cursor-pointer transition ring-2 ring-blue-300"
                title="১ ক্লিকে সম্পূর্ণ প্রিন্ট ফাইল ডাউনলোড করুন (A4 Landscape - পাশাপাশি ২টি স্লিপ)"
              >
                <FileDown className="w-5 h-5 text-amber-300" />
                <span>🖨️ প্রিন্ট ফাইল ডাউনলোড করুন (HTML)</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl cursor-pointer transition"
                title="বন্ধ করুন"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* LOGO & DIGITAL SIGNATURE UPLOAD STRIP */}
          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              {/* Logo Upload Button */}
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
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold border border-slate-600 flex items-center space-x-1.5 cursor-pointer transition shadow-xs"
                >
                  <Upload className="w-3.5 h-3.5 text-amber-400" />
                  <span>লোগো ব্রাউজ করুন (Browse)</span>
                </button>
                {customLogo && (
                  <div className="flex items-center space-x-1.5 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                    <img
                      src={customLogo}
                      alt="Logo"
                      className="w-5 h-5 rounded-full border border-white/50 object-contain bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setCustomLogo('')}
                      className="text-[10px] text-rose-400 hover:text-rose-300 underline cursor-pointer"
                    >
                      রিমুভ
                    </button>
                  </div>
                )}
              </div>

              {/* Principal Signature Upload Button */}
              <div className="flex items-center space-x-2">
                <span className="font-bold text-emerald-300 flex items-center gap-1">
                  <FileCheck className="w-3.5 h-3.5" />
                  অফিস সহকারী/প্রিন্সিপাল স্বাক্ষর:
                </span>
                <input
                  ref={principalSigInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handlePrincipalSigUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => principalSigInputRef.current?.click()}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold border border-slate-600 flex items-center space-x-1.5 cursor-pointer transition shadow-xs"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-400" />
                  <span>স্বাক্ষর আপলোড (PNG)</span>
                </button>
                {principalSig && (
                  <div className="flex items-center space-x-1.5 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                    <img
                      src={principalSig}
                      alt="স্বাক্ষর"
                      className="h-5 max-w-[50px] object-contain bg-white/90 p-0.5 rounded"
                    />
                    <button
                      type="button"
                      onClick={() => setPrincipalSig('')}
                      className="text-[10px] text-rose-400 hover:text-rose-300 underline cursor-pointer"
                    >
                      রিমুভ
                    </button>
                  </div>
                )}
              </div>

              {/* Guardian Signature Upload Button (Optional) */}
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-400">অভিভাবক স্বাক্ষর (ঐচ্ছিক):</span>
                <input
                  ref={guardianSigInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleGuardianSigUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => guardianSigInputRef.current?.click()}
                  className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-lg text-xs border border-slate-700 flex items-center space-x-1 cursor-pointer transition"
                >
                  <span>স্বাক্ষর (PNG)</span>
                </button>
                {guardianSig && (
                  <div className="flex items-center space-x-1.5 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                    <img
                      src={guardianSig}
                      alt="স্বাক্ষর"
                      className="h-5 max-w-[45px] object-contain bg-white/90 p-0.5 rounded"
                    />
                    <button
                      type="button"
                      onClick={() => setGuardianSig('')}
                      className="text-[10px] text-rose-400 hover:text-rose-300 underline cursor-pointer"
                    >
                      রিমুভ
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="text-[11px] text-amber-200/90 font-medium">
              ✓ লোগো ও স্বাক্ষর অফলাইন ফাইলে স্থায়ীভাবে যুক্ত থাকবে
            </div>
          </div>

          {/* PRINTER SETTING INSTRUCTION NOTE */}
          <div className="bg-blue-950/70 border border-blue-500/50 p-2.5 rounded-xl flex items-center gap-2 text-xs text-blue-200">
            <Info className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <strong>প্রিন্ট নির্দেশনা:</strong> উপরের নীল বাটনটিতে ক্লিক করলেই প্রিন্টযোগ্য ফাইল ডাউনলোড হয়ে যাবে। ফাইলটি ওপেন করে কিবোর্ডে <strong>Ctrl + P</strong> চাপুন এবং প্রিন্টার ডায়ালগে <strong>Layout: Landscape (আড়াআড়ি)</strong> নিশ্চিত করুন। এতে বামে ও ডানে ২টি স্লিপ মার্জিন না কেটে নিখুঁতভাবে প্রিন্ট হবে।
            </div>
          </div>

          {/* Paper Savings & Layout Selector */}
          <div className="bg-emerald-950/70 border border-emerald-500/50 p-2.5 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-emerald-300 flex items-center gap-1">
                <Scissors className="w-4 h-4 text-emerald-400" />
                লেআউট:
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setPaperLayout('two_students_landscape')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    paperLayout === 'two_students_landscape'
                      ? 'bg-emerald-500 text-slate-950 shadow-md ring-2 ring-white'
                      : 'bg-slate-800 text-slate-200 hover:text-white'
                  }`}
                >
                  <span>১ পাতায় পাশাপাশি ২টি (Landscape - ৫০% সাশ্রয়ী)</span>
                  <span className="text-[10px] bg-emerald-900/80 text-emerald-200 px-1.5 py-0.2 rounded font-sans">
                    রেকমেন্ডেড
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaperLayout('four_students_per_sheet')}
                  className={`px-2.5 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                    paperLayout === 'four_students_per_sheet'
                      ? 'bg-amber-400 text-slate-950 shadow-md ring-2 ring-white'
                      : 'bg-slate-800 text-slate-200 hover:text-white'
                  }`}
                >
                  <span>১ পাতায় ৪ জন (৭৫% সাশ্রয়ী 2x2)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaperLayout('single_student_double_copy')}
                  className={`px-2.5 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                    paperLayout === 'single_student_double_copy'
                      ? 'bg-indigo-600 text-white shadow-md ring-2 ring-white'
                      : 'bg-slate-800 text-slate-200 hover:text-white'
                  }`}
                >
                  <span>১ পাতায় ১ জন (অফিস ও শিক্ষার্থী ডাবল)</span>
                </button>
              </div>
            </div>

            <div className="text-[11px] text-emerald-200 font-medium">
              মোট শিক্ষার্থী: <strong>{toBengaliNumber(classStudents.length)}</strong> জন • মোট কাগজ লাগবে:{' '}
              <strong className="text-amber-300">{toBengaliNumber(calculatedPageCount)}</strong> টি A4 পাতা
            </div>
          </div>

          {/* Config Bar */}
          <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-950/60 p-2.5 rounded-xl">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-amber-300">শ্রেণি:</span>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 font-bold focus:ring-1 focus:ring-amber-400 focus:outline-none"
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

              <div className="flex items-center space-x-1">
                <span className="font-semibold text-slate-400">শাখা:</span>
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-white rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-amber-400 focus:outline-none"
                >
                  <option value="all">সকল শাখা</option>
                  <option value="ক">ক শাখা</option>
                  <option value="খ">খ শাখা</option>
                </select>
              </div>
            </div>

            {/* Voucher Mode Pills */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setVoucherMode('blank_students')}
                className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer flex items-center space-x-1 ${
                  voucherMode === 'blank_students'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>নাম-রোলসহ ব্ল্যাঙ্ক স্লিপ</span>
              </button>

              <button
                type="button"
                onClick={() => setVoucherMode('universal_blank')}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition cursor-pointer flex items-center space-x-1 ${
                  voucherMode === 'universal_blank'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <span>সম্পূর্ণ খালি স্লিপ</span>
              </button>

              <button
                type="button"
                onClick={() => setVoucherMode('with_amounts')}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition cursor-pointer flex items-center space-x-1 ${
                  voucherMode === 'with_amounts'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <span>টাকাসহ ভাউচার</span>
              </button>
            </div>

            {/* Slip Title Pills */}
            <div className="flex items-center space-x-1">
              <span className="text-slate-400 font-semibold mr-1">শিরোনাম:</span>
              {(['বকেয়া নোটিশ / বিল', 'বকেয়া বেতনের রিসিট', 'বেতনের রিসিট', 'মানি রিসিট'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setCustomTitle(t)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                    customTitle === t
                      ? 'bg-amber-400 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Printable Sheets Container */}
        <div
          ref={printableAreaRef}
          id="batch-voucher-printable-content"
          className="p-3 sm:p-6 space-y-6 sm:space-y-8 bg-slate-200/50 print:p-0 print:space-y-0 print:bg-white"
        >
          {groupedStudents.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-xl border border-slate-300">
              <FileText className="w-12 h-12 text-slate-400 mx-auto mb-2" />
              <h3 className="font-bold text-slate-800 text-base">
                {voucherMode === 'universal_blank'
                  ? 'কোনো স্লিপ নির্বাচন করা হয়নি।'
                  : `${currentClass?.nameBn}-এ কোনো শিক্ষার্থী পাওয়া যায়নি।`}
              </h3>
            </div>
          ) : (
            groupedStudents.map((group, pageIdx) => {
              // CASE 1: 2 STUDENTS SIDE-BY-SIDE ON A4 LANDSCAPE (DEFAULT)
              if (paperLayout === 'two_students_landscape') {
                const student1 = group[0];
                const student2 = group[1] || null;
                const data1 = student1 ? getStudentVoucherData(student1) : getStudentVoucherData(null);
                const data2 = student2 ? getStudentVoucherData(student2) : getStudentVoucherData(null);

                return (
                  <div
                    key={`page_land_wrapper_${pageIdx}`}
                    className="official-voucher-sheet-wrapper space-y-1 print:space-y-0"
                    style={{
                      pageBreakAfter: pageIdx === groupedStudents.length - 1 ? 'auto' : 'always',
                      breakAfter: pageIdx === groupedStudents.length - 1 ? 'auto' : 'page',
                      pageBreakInside: 'avoid',
                      breakInside: 'avoid',
                      width: '100%',
                      display: 'block',
                      clear: 'both',
                    }}
                  >
                    {/* Screen Indicator (Never rendered in print or exported HTML) */}
                    <div className="no-print print:hidden text-xs text-slate-600 font-semibold mb-1 flex justify-between bg-slate-200/90 px-3 py-1.5 rounded-lg max-w-[950px] mx-auto border border-slate-300">
                      <span className="font-bold text-slate-800">
                        পাতা {toBengaliNumber(pageIdx + 1)} / {toBengaliNumber(calculatedPageCount)}: বামে {student1?.nameBn} (রোল: {student1 ? toBengaliRoll(student1.roll) : '-'}) ও ডানে {student2 ? `${student2.nameBn} (রোল: ${toBengaliRoll(student2.roll)})` : 'খালি স্লিপ'}
                      </span>
                      <span className="text-emerald-700 font-bold">১ পাতায় পাশাপাশি ২টি (A4 Landscape)</span>
                    </div>

                    <div
                      key={`page_land_${pageIdx}`}
                      className="official-voucher-a4-sheet bg-white p-2 sm:p-2.5 shadow-md max-w-[950px] mx-auto print:shadow-none print:p-0 print:m-0 print:w-full"
                      style={{
                        width: '100%',
                        maxWidth: '287mm',
                        boxSizing: 'border-box',
                        pageBreakAfter: pageIdx === groupedStudents.length - 1 ? 'auto' : 'always',
                        breakAfter: pageIdx === groupedStudents.length - 1 ? 'auto' : 'page',
                        pageBreakInside: 'avoid',
                        breakInside: 'avoid',
                      }}
                    >
                      {/* Side-by-side grid */}
                      <div
                        className="side-by-side-grid relative"
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: '5mm',
                          width: '100%',
                          position: 'relative',
                          boxSizing: 'border-box',
                        }}
                      >
                        {/* Left Slip: Student 1 */}
                        <div style={{ width: '100%', boxSizing: 'border-box' }}>
                          <SingleReceiptSlip
                            schoolInfo={schoolInfo}
                            student={student1}
                            data={data1}
                            voucherTitle={customTitle}
                            copyLabel={copyLabel}
                            isBlankAmounts={voucherMode === 'blank_students'}
                            customLogoUrl={customLogo}
                            principalSignatureUrl={principalSig}
                            guardianSignatureUrl={guardianSig}
                          />
                        </div>

                        {/* Scissor Cut Line in the Middle */}
                        <div
                          className="hidden print:flex absolute left-1/2 top-0 bottom-0 -translate-x-1/2 flex-col justify-between items-center py-2 z-10 pointer-events-none"
                          style={{ height: '100%' }}
                        >
                          <span className="text-[9px] font-bold text-slate-500 bg-white px-1">✂ কাটার দাগ</span>
                          <div className="w-0 flex-1 border-l-2 border-dashed border-slate-400 my-1" />
                          <span className="text-[9px] font-bold text-slate-500 bg-white px-1">✂</span>
                        </div>

                        {/* Right Slip: Student 2 */}
                        <div style={{ width: '100%', boxSizing: 'border-box' }}>
                          <SingleReceiptSlip
                            schoolInfo={schoolInfo}
                            student={student2}
                            data={data2}
                            voucherTitle={customTitle}
                            copyLabel={copyLabel}
                            isBlankAmounts={voucherMode === 'blank_students'}
                            customLogoUrl={customLogo}
                            principalSignatureUrl={principalSig}
                            guardianSignatureUrl={guardianSig}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              // CASE 2: 4 STUDENTS GRID
              if (paperLayout === 'four_students_per_sheet') {
                return (
                  <div
                    key={`page_four_${pageIdx}`}
                    className="official-voucher-a4-sheet bg-white p-3 shadow-md max-w-[950px] mx-auto print:shadow-none print:p-0 print:m-0 print:w-full page-break-after"
                    style={{ height: '284mm', maxHeight: '284mm', boxSizing: 'border-box' }}
                  >
                    <div className="grid grid-cols-2 gap-2.5 h-full" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '4mm', height: '100%' }}>
                      {group.map((stu, sIdx) => {
                        const stuData = stu ? getStudentVoucherData(stu) : getStudentVoucherData(null);
                        return (
                          <SingleReceiptSlip
                            key={stu ? stu.id : `blank_pad_${sIdx}`}
                            schoolInfo={schoolInfo}
                            student={stu}
                            data={stuData}
                            voucherTitle={customTitle}
                            copyLabel={copyLabel}
                            isBlankAmounts={voucherMode === 'blank_students'}
                            isCompact={true}
                            customLogoUrl={customLogo}
                            principalSignatureUrl={principalSig}
                            guardianSignatureUrl={guardianSig}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              }

              // CASE 3: DOUBLE COPY 1 STUDENT
              const student = group[0];
              if (!student) return null;
              const data = getStudentVoucherData(student);

              return (
                <div
                  key={`single_${student.id}`}
                  className="official-voucher-a4-sheet bg-white p-2 sm:p-2.5 shadow-md max-w-[950px] mx-auto print:shadow-none print:p-0 print:m-0 print:w-full page-break-after"
                  style={{
                    width: '100%',
                    maxWidth: '287mm',
                    boxSizing: 'border-box',
                  }}
                >
                  <div className="side-by-side-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5mm', width: '100%', boxSizing: 'border-box' }}>
                    <div style={{ width: '100%', boxSizing: 'border-box' }}>
                      <SingleReceiptSlip
                        schoolInfo={schoolInfo}
                        student={student}
                        data={data}
                        voucherTitle={customTitle}
                        copyLabel="- অফিস কপি -"
                        isBlankAmounts={voucherMode === 'blank_students'}
                        customLogoUrl={customLogo}
                        principalSignatureUrl={principalSig}
                        guardianSignatureUrl={guardianSig}
                      />
                    </div>
                    <div style={{ width: '100%', boxSizing: 'border-box' }}>
                      <SingleReceiptSlip
                        schoolInfo={schoolInfo}
                        student={student}
                        data={data}
                        voucherTitle={customTitle}
                        copyLabel="- শিক্ষার্থী কপি -"
                        isBlankAmounts={voucherMode === 'blank_students'}
                        customLogoUrl={customLogo}
                        principalSignatureUrl={principalSig}
                        guardianSignatureUrl={guardianSig}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
