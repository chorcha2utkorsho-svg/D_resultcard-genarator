import React, { useState } from 'react';
import {
  Printer,
  FileDown,
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Layers,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import { SchoolInfo, Student } from '../types';
import { AdmitCardSlip } from './AdmitCardSlip';
import { toBengaliNumber } from '../utils/bengali';

interface AdmitCardPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolInfo: SchoolInfo;
  classNameBn: string;
  examName: string;
  groupedStudents: Student[][];
  onDownloadHtml: () => void;
  onTriggerPrint: () => void;
  customLogoUrl?: string;
  principalSignatureUrl?: string;
  classTeacherSignatureUrl?: string;
  examMotto?: string;
  roomNo?: string;
  onPhotoUpload?: (studentId: string, base64: string) => void;
}

export const AdmitCardPreviewModal: React.FC<AdmitCardPreviewModalProps> = ({
  isOpen,
  onClose,
  schoolInfo,
  classNameBn,
  examName,
  groupedStudents,
  onDownloadHtml,
  onTriggerPrint,
  customLogoUrl,
  principalSignatureUrl,
  classTeacherSignatureUrl,
  examMotto,
  roomNo = '১০১',
  onPhotoUpload,
}) => {
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [previewSide, setPreviewSide] = useState<'front' | 'back'>('front');
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  if (!isOpen) return null;

  const totalPages = Math.max(1, groupedStudents.length);
  const safePageIdx = Math.min(currentPage, totalPages - 1);
  const currentStudents = groupedStudents[safePageIdx] || [];

  const handlePrev = () => {
    setCurrentPage((p) => Math.max(0, p - 1));
  };

  const handleNext = () => {
    setCurrentPage((p) => Math.min(totalPages - 1, p + 1));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 backdrop-blur-md overflow-hidden"
      style={{ fontFamily: "'Kalpurush', 'Hind Siliguri', sans-serif" }}
    >
      {/* Top Header / Control Toolbar */}
      <div className="bg-slate-900 border-b border-slate-800 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-lg shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="font-bold text-sm sm:text-base leading-tight">
                এডমিট কার্ড A4 প্রিভিউ (১ পাতায় ৪টি - এপিঠ ও ওপিঠ)
              </h2>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                {examName}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">
              শ্রেণি: <span className="text-amber-300 font-semibold">{classNameBn}</span> • মোড:{' '}
              <span className="text-emerald-400 font-bold">
                {previewSide === 'front' ? '📄 সামনের পিঠ (প্রবেশপত্র)' : '📋 পেছনের পিঠ (নিয়মাবলী)'}
              </span>
            </p>
          </div>
        </div>

        {/* Middle: Side Switcher & Pagination */}
        <div className="flex items-center space-x-2 bg-slate-950/80 px-2.5 py-1 rounded-xl border border-slate-800 text-xs">
          {/* Side Toggle */}
          <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700">
            <button
              type="button"
              onClick={() => setPreviewSide('front')}
              className={`px-2.5 py-1 rounded-md font-bold text-xs transition cursor-pointer ${
                previewSide === 'front'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              📄 এপিঠ (Front)
            </button>
            <button
              type="button"
              onClick={() => setPreviewSide('back')}
              className={`px-2.5 py-1 rounded-md font-bold text-xs transition cursor-pointer ${
                previewSide === 'back'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              📋 ওপিঠ (Back)
            </button>
          </div>

          <div className="h-4 w-px bg-slate-700 mx-1" />

          {/* Pagination */}
          <button
            type="button"
            onClick={handlePrev}
            disabled={safePageIdx === 0}
            className={`p-1 rounded-md transition cursor-pointer ${
              safePageIdx === 0
                ? 'text-slate-600 cursor-not-allowed'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
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
              safePageIdx >= totalPages - 1
                ? 'text-slate-600 cursor-not-allowed'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="পরবর্তী পাতা"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-slate-700 mx-1" />

          {/* Zoom Controls */}
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.max(70, z - 10))}
            className="p-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition cursor-pointer"
            title="জুম কমান"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoomLevel(100)}
            className="font-mono text-[11px] font-semibold text-amber-300 hover:text-white px-1"
            title="রিসেট জুম (১০০%)"
          >
            {zoomLevel}%
          </button>
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.min(130, z + 10))}
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

      {/* Realistic A4 Portrait Paper Stage */}
      <div className="flex-1 overflow-auto p-4 sm:p-8 flex items-center justify-center bg-slate-900/95 relative">
        <div
          className="transition-transform duration-200 ease-out origin-center"
          style={{ transform: `scale(${zoomLevel / 100})` }}
        >
          {/* A4 Sheet (210mm x 297mm proportion: 742px x 1050px) */}
          <div
            className="bg-white text-black shadow-2xl relative border border-slate-300 flex flex-col justify-between"
            style={{
              width: '742px',
              height: '1050px',
              padding: '16px 18px',
              boxSizing: 'border-box',
              boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(0, 0, 0, 0.08)',
              borderRadius: '2px',
              position: 'relative',
              overflow: 'hidden',
              fontFamily: "'Kalpurush', 'Hind Siliguri', sans-serif",
            }}
          >
            {/* Sheet Tag */}
            <div className="absolute top-1 right-2 text-[9px] font-sans text-slate-400 select-none pointer-events-none">
              A4 Portrait (210mm × 297mm) • পাতা {toBengaliNumber(safePageIdx + 1)} /{' '}
              {toBengaliNumber(totalPages)} • {previewSide === 'front' ? 'সামনের পিঠ' : 'পেছনের পিঠ (নিয়মাবলী)'}
            </div>

            {/* 4 Cards Grid: 2 columns x 2 rows */}
            <div
              className="grid grid-cols-2 grid-rows-2 gap-3.5 h-full w-full"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gridTemplateRows: 'repeat(2, 1fr)',
                gap: '12px',
                height: '100%',
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              {Array.from({ length: 4 }).map((_, slotIdx) => {
                // When previewing the back side, if duplex long-edge flip:
                // Column 0 mirrors to Column 1, and Column 1 mirrors to Column 0
                let studentIdx = slotIdx;
                if (previewSide === 'back') {
                  if (slotIdx === 0) studentIdx = 1;
                  else if (slotIdx === 1) studentIdx = 0;
                  else if (slotIdx === 2) studentIdx = 3;
                  else if (slotIdx === 3) studentIdx = 2;
                }

                const student = currentStudents[studentIdx];
                if (!student) {
                  return (
                    <div
                      key={`empty_admit_${slotIdx}`}
                      className="border border-dashed border-slate-300 rounded-md flex items-center justify-center text-slate-300 text-sm font-semibold bg-slate-50/50 h-full w-full"
                    >
                      <span>খালি এডমিট কার্ড</span>
                    </div>
                  );
                }

                return (
                  <div key={student.id} className="h-full w-full relative">
                    <AdmitCardSlip
                      student={student}
                      classNameBn={classNameBn}
                      examName={examName}
                      schoolInfo={schoolInfo}
                      side={previewSide}
                      customLogoUrl={customLogoUrl}
                      principalSignatureUrl={principalSignatureUrl}
                      classTeacherSignatureUrl={classTeacherSignatureUrl}
                      examMotto={examMotto}
                      roomNo={roomNo}
                      onPhotoUpload={onPhotoUpload}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info Strip */}
      <div className="bg-slate-900 border-t border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between text-xs text-slate-400 shrink-0">
        <div className="flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>
            প্রতিটি A4 পাতায় ৪ জন শিক্ষার্থীর এপিঠ-ওপিঠ এডমিট কার্ড নিখুঁতভাবে ফিট হবে। প্রিন্ট করে কেটে শিক্ষার্থীদের বিতরণ করুন।
          </span>
        </div>
        <div className="flex items-center space-x-3 text-[11px]">
          <span>
            চলতি পাতায় শিক্ষার্থী: <strong className="text-white">{toBengaliNumber(currentStudents.length)}</strong> জন
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-amber-300 font-semibold">
            {previewSide === 'front' ? 'প্রবেশপত্রের সামনের অংশ' : 'পরীক্ষার সাধারণ নিয়মাবলী (পেছনের অংশ)'}
          </span>
        </div>
      </div>
    </div>
  );
};
