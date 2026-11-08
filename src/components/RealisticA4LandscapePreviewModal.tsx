import React, { useState } from 'react';
import {
  Printer,
  FileDown,
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Scissors,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { SchoolInfo, Student } from '../types';
import { SingleReceiptSlip, PrintableReceiptData } from './PrintableReceiptLayout';
import { toBengaliNumber, toBengaliRoll } from '../utils/bengali';

interface RealisticA4LandscapePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolInfo: SchoolInfo;
  students: Student[];
  groupedStudents: (Student | null)[][];
  getStudentVoucherData: (student: Student | null) => PrintableReceiptData;
  voucherTitle: string;
  copyLabel: string;
  voucherMode: 'blank_students' | 'universal_blank' | 'with_amounts';
  customLogoUrl?: string;
  principalSignatureUrl?: string;
  guardianSignatureUrl?: string;
  onDownloadHtml: () => void;
  onTriggerPrint: () => void;
  classNameBn: string;
}

export const RealisticA4LandscapePreviewModal: React.FC<RealisticA4LandscapePreviewModalProps> = ({
  isOpen,
  onClose,
  schoolInfo,
  groupedStudents,
  getStudentVoucherData,
  voucherTitle,
  copyLabel,
  voucherMode,
  customLogoUrl,
  principalSignatureUrl,
  guardianSignatureUrl,
  onDownloadHtml,
  onTriggerPrint,
  classNameBn,
}) => {
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  if (!isOpen) return null;

  const totalPages = Math.max(1, groupedStudents.length);
  const safePageIdx = Math.min(currentPage, totalPages - 1);
  const currentPair = groupedStudents[safePageIdx] || [null, null];
  const studentLeft = currentPair[0] || null;
  const studentRight = currentPair[1] || null;

  const dataLeft = getStudentVoucherData(studentLeft);
  const dataRight = getStudentVoucherData(studentRight);

  const handlePrev = () => {
    setCurrentPage((p) => Math.max(0, p - 1));
  };

  const handleNext = () => {
    setCurrentPage((p) => Math.min(totalPages - 1, p + 1));
  };

  const handleZoomIn = () => {
    setZoomLevel((z) => Math.min(130, z + 10));
  };

  const handleZoomOut = () => {
    setZoomLevel((z) => Math.max(70, z - 10));
  };

  const handleResetZoom = () => {
    setZoomLevel(100);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 backdrop-blur-md overflow-hidden"
      style={{ fontFamily: "'Kalpurush', 'Hind Siliguri', sans-serif" }}
    >
      {/* Top Header / Control Toolbar */}
      <div className="bg-slate-900 border-b border-slate-800 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-lg shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-600/30 border border-emerald-500/50 flex items-center justify-center text-emerald-400 font-bold">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="font-bold text-sm sm:text-base leading-tight">
                রিয়েলিস্টিক A4 ল্যান্ডস্কেপ প্রিন্ট প্রিভিউ
              </h2>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                হুবহু তোশিবা প্রিন্ট রেজাল্ট
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">
              শ্রেণি: <span className="text-amber-300 font-semibold">{classNameBn}</span> • ফন্ট: <span className="text-emerald-400 font-bold">কালপুরুষ</span> • ২১০মিমি × ২৯৭মিমি বাউন্ডারি
            </p>
          </div>
        </div>

        {/* Middle Pagination & Zoom Controls */}
        <div className="flex items-center space-x-2 bg-slate-950/80 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs">
          <button
            type="button"
            onClick={handlePrev}
            disabled={safePageIdx === 0}
            className={`p-1 rounded-md transition cursor-pointer ${
              safePageIdx === 0 ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="পূর্ববর্তী পাতা"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-bold px-1.5 min-w-[70px] text-center text-slate-200">
            পাতা {toBengaliNumber(safePageIdx + 1)} / {toBengaliNumber(totalPages)}
          </span>
          <button
            type="button"
            onClick={handleNext}
            disabled={safePageIdx >= totalPages - 1}
            className={`p-1 rounded-md transition cursor-pointer ${
              safePageIdx >= totalPages - 1 ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="পরবর্তী পাতা"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-slate-700 mx-1" />

          {/* Zoom controls */}
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition cursor-pointer"
            title="জুম কমান"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            className="font-mono text-[11px] font-semibold text-amber-300 hover:text-white px-1"
            title="রিসেট জুম (১০০%)"
          >
            {zoomLevel}%
          </button>
          <button
            type="button"
            onClick={handleZoomIn}
            className="p-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition cursor-pointer"
            title="জুম বাড়ান"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={onDownloadHtml}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs flex items-center space-x-1.5 shadow-md transition cursor-pointer"
            title="অফলাইন প্রিন্ট ফাইল ডাউনলোড করুন (HTML)"
          >
            <FileDown className="w-3.5 h-3.5 text-amber-300" />
            <span>প্রিন্ট ফাইল ডাউনলোড</span>
          </button>

          <button
            type="button"
            onClick={onTriggerPrint}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs flex items-center space-x-1.5 shadow-md transition cursor-pointer ring-1 ring-emerald-400"
            title="সরাসরি প্রিন্ট ডায়ালগ ওপেন করুন"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>প্রিন্ট করুন (Ctrl + P)</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
            title="বন্ধ করুন"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Realistic Paper Stage Background */}
      <div className="flex-1 overflow-auto p-4 sm:p-8 flex items-center justify-center bg-slate-900/95 relative">
        <div
          className="transition-transform duration-200 ease-out origin-center"
          style={{ transform: `scale(${zoomLevel / 100})` }}
        >
          {/* Realistic A4 Landscape Sheet (Dimensions proportional to 297mm x 210mm) */}
          <div
            className="bg-white text-black shadow-2xl relative border border-slate-300 flex flex-col justify-between"
            style={{
              width: '1050px',
              height: '742px', // Aspect ratio exactly ~1.414 : 1 (297mm : 210mm)
              padding: '16px 20px',
              boxSizing: 'border-box',
              boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(0, 0, 0, 0.08)',
              borderRadius: '2px',
              position: 'relative',
              overflow: 'hidden',
              fontFamily: "'Kalpurush', 'Hind Siliguri', sans-serif",
            }}
          >
            {/* Top Sheet Margin Indicator Tag */}
            <div className="absolute top-1 right-2 text-[9px] font-sans text-slate-400 select-none pointer-events-none">
              A4 Landscape (297mm × 210mm) • পাতা {toBengaliNumber(safePageIdx + 1)} / {toBengaliNumber(totalPages)}
            </div>

            {/* Side-by-side 2 Vouchers Grid (Exactly matching printable CSS) */}
            <div
              className="relative grid grid-cols-2 gap-4 h-full"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
                height: '100%',
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              {/* Left Slip */}
              <div className="h-full flex flex-col justify-between" style={{ height: '100%', overflow: 'hidden' }}>
                <SingleReceiptSlip
                  schoolInfo={schoolInfo}
                  student={studentLeft}
                  data={dataLeft}
                  voucherTitle={voucherTitle}
                  copyLabel={copyLabel}
                  isBlankAmounts={voucherMode === 'blank_students'}
                  customLogoUrl={customLogoUrl}
                  principalSignatureUrl={principalSignatureUrl}
                  guardianSignatureUrl={guardianSignatureUrl}
                />
              </div>

              {/* Scissor Cut Line in Middle */}
              <div
                className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 flex flex-col justify-between items-center py-1 z-20 pointer-events-none"
                style={{ height: '100%' }}
              >
                <div className="flex items-center space-x-0.5 text-[9px] font-bold text-slate-500 bg-white/95 px-1 py-0.5 rounded border border-slate-200 shadow-2xs">
                  <Scissors className="w-2.5 h-2.5 text-slate-600 rotate-90" />
                  <span>কাটার দাগ</span>
                </div>
                <div className="w-0 flex-1 border-l-2 border-dashed border-slate-400 my-1" />
                <div className="flex items-center space-x-0.5 text-[9px] font-bold text-slate-500 bg-white/95 px-1 py-0.5 rounded border border-slate-200 shadow-2xs">
                  <Scissors className="w-2.5 h-2.5 text-slate-600 -rotate-90" />
                  <span>কাটার দাগ</span>
                </div>
              </div>

              {/* Right Slip */}
              <div className="h-full flex flex-col justify-between" style={{ height: '100%', overflow: 'hidden' }}>
                <SingleReceiptSlip
                  schoolInfo={schoolInfo}
                  student={studentRight}
                  data={dataRight}
                  voucherTitle={voucherTitle}
                  copyLabel={copyLabel}
                  isBlankAmounts={voucherMode === 'blank_students'}
                  customLogoUrl={customLogoUrl}
                  principalSignatureUrl={principalSignatureUrl}
                  guardianSignatureUrl={guardianSignatureUrl}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info Strip */}
      <div className="bg-slate-900 border-t border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between text-xs text-slate-400 shrink-0">
        <div className="flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>
            নিচের স্বাক্ষর ও বাউন্ডারি ফ্রেমের ভেতরে নিরাপদ মার্জিন বজায় রয়েছে। অতিরিক্ত স্পেস বা পরবর্তী পাতার কোনো দাগ আসবে না।
          </span>
        </div>
        <div className="flex items-center space-x-3 text-[11px]">
          <span>
            বামে: <strong className="text-white">{studentLeft?.nameBn || 'খালি স্লিপ'}</strong> (রোল: {studentLeft ? toBengaliRoll(studentLeft.roll) : '-'})
          </span>
          <span className="text-slate-600">•</span>
          <span>
            ডানে: <strong className="text-white">{studentRight?.nameBn || 'খালি স্লিপ'}</strong> (রোল: {studentRight ? toBengaliRoll(studentRight.roll) : '-'})
          </span>
        </div>
      </div>
    </div>
  );
};
