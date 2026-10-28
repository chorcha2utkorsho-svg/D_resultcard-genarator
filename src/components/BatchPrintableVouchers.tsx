import React, { useState, useMemo } from 'react';
import { Printer, X, FileText, CheckCircle2, ChevronDown, Check, Layers, UserCheck } from 'lucide-react';
import { SchoolInfo, Student, FeeInvoice, SchoolClass } from '../types';
import { SchoolLogo } from './SchoolLogo';
import { toBengaliNumber, toBengaliRoll } from '../utils/bengali';
import { numberToBengaliWords } from '../utils/bengaliWords';
import { STANDARD_8_VOUCHER_HEADS } from '../data/defaultData';

export type VoucherPrintMode = 'blank_students' | 'universal_blank' | 'with_amounts';

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
  // Active class filter: ensure it strictly filters by class!
  const defaultClassId =
    initialClassId && initialClassId !== 'all'
      ? initialClassId
      : classes.find((c) => students.some((s) => s.classId === c.id))?.id || classes[0]?.id || 'class_play';

  const [selectedClassId, setSelectedClassId] = useState<string>(defaultClassId);
  const [selectedSection, setSelectedSection] = useState<string>(initialSection);
  const [voucherMode, setVoucherMode] = useState<VoucherPrintMode>(
    initialIsBlank ? 'blank_students' : 'with_amounts'
  );
  const [customTitle, setCustomTitle] = useState<string>(
    voucherType === 'due_slip' ? 'বকেয়া বেতনের রিসিট' : 'বেতনের রিসিট'
  );
  const [universalBlankCount, setUniversalBlankCount] = useState<number>(10);

  const handlePrint = () => {
    window.print();
  };

  // Currently selected class object
  const currentClass = useMemo(() => {
    return classes.find((c) => c.id === selectedClassId) || classes[0];
  }, [classes, selectedClassId]);

  // Filter students strictly by selectedClassId and sort ascending by roll
  const classStudents = useMemo(() => {
    let list = students.filter((s) => s.classId === selectedClassId);
    if (selectedSection !== 'all') {
      list = list.filter((s) => s.section === selectedSection);
    }
    return list.sort((a, b) => a.roll - b.roll);
  }, [students, selectedClassId, selectedSection]);

  // Helper to get 8 items for a student
  const getStudentVoucherData = (student: Student) => {
    const matchedClass = classes.find((c) => c.id === student.classId);
    const classNameBn = matchedClass ? matchedClass.nameBn : currentClass?.nameBn || 'শ্রেণি';

    // In blank mode: amounts are 0 and will be rendered completely blank (no text, no 0/-)
    if (voucherMode === 'blank_students' || voucherMode === 'universal_blank') {
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

    // With amounts mode: look up student invoice
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
        amount = 0; // if no invoice, keep blank
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

  // Render Single A5 slip
  const renderSingleA5Slip = (
    student: Student | null,
    data: ReturnType<typeof getStudentVoucherData>,
    copyType: '- অফিস কপি -' | '- শিক্ষার্থী কপি -'
  ) => {
    const isUniversalBlank = voucherMode === 'universal_blank' || !student;
    const isBlankAmounts = voucherMode !== 'with_amounts' || data.grandTotal === 0;

    return (
      <div className="official-voucher-slip bg-white text-black p-3.5 flex flex-col justify-between select-none relative box-border border-2 border-slate-900 rounded-xs min-h-[485px] text-xs">
        <div>
          {/* School Header */}
          <div className="relative flex items-center justify-center pb-2 border-b border-black">
            <div className="absolute left-0 top-1/2 -translate-y-1/2">
              <SchoolLogo
                customLogoUrl={schoolInfo.logoUrl}
                size={44}
                className="border border-black/40 rounded-full p-0.5"
              />
            </div>
            <div className="text-center px-10">
              <h1 className="text-lg font-bold font-serif text-black leading-tight">
                {schoolInfo.name || 'ডি-লিকন মডেল একাডেমী'}
              </h1>
              <p className="text-[11px] font-semibold text-slate-800 leading-tight mt-0.5">
                {schoolInfo.established || 'স্থাপিত: ২০১৮ ইং'}
              </p>
              <p className="text-[10px] text-slate-700 leading-tight mt-0.5">
                {schoolInfo.address || 'গনি মার্কেট, সনমানিয়া, কাপাসিয়া, গাজীপুর।'}
              </p>
            </div>
          </div>

          {/* Voucher Title */}
          <div className="text-center my-1.5">
            <div className="inline-block px-4 py-0.5 border border-black rounded-md font-bold text-xs tracking-wide bg-white text-black">
              {customTitle}
            </div>
          </div>

          {/* Student Meta Details */}
          <div className="space-y-1 mb-2 text-[11px]">
            {/* Row 1: নাম & শ্রেণি */}
            <div className="grid grid-cols-12 gap-2 items-baseline">
              <div className="col-span-7 flex items-baseline overflow-hidden">
                <span className="font-semibold whitespace-nowrap">নাম:</span>
                {!isUniversalBlank && student ? (
                  <span className="ml-1 font-bold text-black whitespace-nowrap">{student.nameBn}</span>
                ) : (
                  <span className="ml-1 text-transparent select-none whitespace-nowrap">...........</span>
                )}
                <span className="flex-1 border-b border-dotted border-black ml-1 min-w-[20px]" />
              </div>
              <div className="col-span-5 flex items-baseline overflow-hidden">
                <span className="font-semibold whitespace-nowrap">শ্রেণি:</span>
                <span className="ml-1 font-bold text-black whitespace-nowrap">
                  {currentClass?.nameBn || data.classNameBn}
                </span>
                <span className="flex-1 border-b border-dotted border-black ml-1 min-w-[20px]" />
              </div>
            </div>

            {/* Row 2: শাখা & রোল */}
            <div className="grid grid-cols-12 gap-2 items-baseline">
              <div className="col-span-7 flex items-baseline overflow-hidden">
                <span className="font-semibold whitespace-nowrap"> শাখা:</span>
                {!isUniversalBlank && student ? (
                  <span className="ml-1 font-bold text-black whitespace-nowrap">
                    {student.section || 'ক'}
                  </span>
                ) : (
                  <span className="ml-1 text-transparent select-none whitespace-nowrap">.....</span>
                )}
                <span className="flex-1 border-b border-dotted border-black ml-1 min-w-[20px]" />
              </div>
              <div className="col-span-5 flex items-baseline overflow-hidden">
                <span className="font-semibold whitespace-nowrap">রোল:</span>
                {!isUniversalBlank && student ? (
                  <span className="ml-1 font-bold text-black whitespace-nowrap font-mono">
                    {toBengaliRoll(student.roll)}
                  </span>
                ) : (
                  <span className="ml-1 text-transparent select-none whitespace-nowrap">.....</span>
                )}
                <span className="flex-1 border-b border-dotted border-black ml-1 min-w-[20px]" />
              </div>
            </div>
          </div>

          {/* 8-Row Breakdown Table */}
          <table className="w-full border-collapse border border-black text-[11px] mb-2">
            <thead>
              <tr className="border-b border-black font-bold bg-slate-50">
                <th className="border border-black py-0.5 px-1 text-center w-7">ক্র.</th>
                <th className="border border-black py-0.5 px-2 text-center">বিবরণ</th>
                <th className="border border-black py-0.5 px-2 text-center w-24">টাকা</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, idx) => (
                <tr key={idx} className="border-b border-black">
                  <td className="border border-black py-0.5 px-1 text-center font-medium">
                    {item.serialBn}
                  </td>
                  <td className="border border-black py-0.5 px-2 text-left font-medium">
                    {item.nameBn}
                  </td>
                  <td className="border border-black py-0.5 px-2 text-right font-medium font-mono min-h-[20px]">
                    {item.amount > 0 ? `${toBengaliNumber(item.amount)}/-` : ''}
                  </td>
                </tr>
              ))}
              {/* Grand Total Row */}
              <tr className="border-t-2 border-black font-bold">
                <td
                  colSpan={2}
                  className="border border-black py-1 px-3 text-right pr-3 font-bold text-xs"
                >
                  সর্বমোট টাকা =
                </td>
                <td className="border border-black py-1 px-2 text-right font-bold text-xs font-mono">
                  {/* NEVER print ০/- when blank mode or 0 amount! Leave empty for hand-writing */}
                  {data.grandTotal > 0 && !isBlankAmounts ? (
                    `${toBengaliNumber(data.grandTotal)}/-`
                  ) : (
                    <span className="text-transparent select-none">&nbsp;</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>

          {/* In Words */}
          <div className="flex items-baseline overflow-hidden text-[11px] mb-3">
            <span className="font-semibold whitespace-nowrap">কথায়:</span>
            {data.grandTotalWords && !isBlankAmounts ? (
              <span className="ml-1 font-bold text-black whitespace-nowrap">
                {data.grandTotalWords}
              </span>
            ) : (
              <span className="ml-1 text-transparent select-none whitespace-nowrap">&nbsp;</span>
            )}
            <span className="flex-1 border-b border-dotted border-black ml-1 min-w-[20px]" />
          </div>
        </div>

        {/* Footer Signatures */}
        <div className="pt-6">
          <div className="flex justify-between items-end px-2 mb-2 text-[11px]">
            <div className="text-center">
              <div className="w-28 border-t border-black mb-1 mx-auto" />
              <span className="font-medium text-black">অভিভাবকের স্বাক্ষর</span>
            </div>
            <div className="text-center">
              <div className="w-28 border-t border-black mb-1 mx-auto" />
              <span className="font-medium text-black">অফিস সহকারী / প্রিন্সিপাল</span>
            </div>
          </div>
          <div className="text-center mt-0.5">
            <span className="text-[10px] font-bold text-slate-800 tracking-wider">
              {copyType}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/85 backdrop-blur-xs overflow-y-auto flex items-start justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static print:inset-auto">
      <div className="bg-slate-100 rounded-2xl shadow-2xl max-w-5xl w-full my-4 overflow-hidden border border-slate-300 print:shadow-none print:border-none print:m-0 print:max-w-none">
        {/* Sticky Control Bar (Hidden during Print) */}
        <div className="p-3.5 bg-slate-900 text-white flex flex-col gap-3 print:hidden border-b border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-amber-400" />
              <div>
                <h2 className="font-bold text-sm sm:text-base font-serif flex items-center">
                  <span>অফিশিয়াল মানি রিসিট / ডিউ স্লিপ প্রিন্ট ভিউ</span>
                  <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-emerald-950 text-emerald-300 border border-emerald-600 font-sans">
                    A4 পেপারে ২টি A5 পাশাপাশি
                  </span>
                </h2>
                <p className="text-[11px] text-slate-300">
                  বাম পাশে অফিস কপি ও ডান পাশে শিক্ষার্থী কপি প্রিন্ট হবে।
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs sm:text-sm flex items-center space-x-1.5 cursor-pointer shadow-md transition"
              >
                <Printer className="w-4 h-4" />
                <span>প্রিন্ট করুন (A4 Landscape)</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl cursor-pointer transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Class, Section, Voucher Mode & Title Configuration Strip */}
          <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-950/60 p-2.5 rounded-xl">
            {/* Class Selector Dropdown */}
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

              {/* Section Selector */}
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
                title="শিক্ষার্থীর নাম ও রোল প্রিন্ট হবে, টাকার ঘরগুলো হাতে লেখার জন্য ফাঁকা থাকবে"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>নাম-রোলসহ ব্ল্যাঙ্ক রিসিট ({toBengaliNumber(classStudents.length)})</span>
              </button>

              <button
                type="button"
                onClick={() => setVoucherMode('universal_blank')}
                className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer flex items-center space-x-1 ${
                  voucherMode === 'universal_blank'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="নাম ও রোল ছাড়া সম্পূর্ণ খালি ফরম্যাট প্রিন্ট করুন"
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
                title="সফটওয়্যারের হিসাবকৃত টাকার অংকসহ প্রিন্ট"
              >
                <span>টাকাসহ ভাউচার</span>
              </button>
            </div>

            {/* Slip Title Pills */}
            <div className="flex items-center space-x-1">
              <span className="text-slate-400 font-semibold mr-1">শিরোনাম:</span>
              {(['বকেয়া বেতনের রিসিট', 'বেতনের রিসিট', 'মানি রিসিট'] as const).map((t) => (
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

          {/* Quick Notice Banner based on Mode */}
          <div className="text-[11px] text-amber-200/90 bg-amber-950/40 px-3 py-1.5 rounded-lg border border-amber-900/50 flex items-center justify-between">
            {voucherMode === 'blank_students' && (
              <span>
                ✓ <strong>{currentClass?.nameBn}</strong>-এর মোট{' '}
                <strong>{toBengaliNumber(classStudents.length)}</strong> জন শিক্ষার্থীর নাম, রোল ও শ্রেণি
                প্রিন্ট হবে। টাকার ঘর, সর্বমোট ও কথায় সম্পূর্ণ খালি থাকবে যা হিসাবরক্ষক নিজে হাতে লিখে দিতে
                পারবেন।
              </span>
            )}
            {voucherMode === 'universal_blank' && (
              <div className="flex items-center space-x-3 w-full justify-between">
                <span>
                  ✓ নাম ও রোল ছাড়া <strong>{currentClass?.nameBn}</strong>-এর সম্পূর্ণ খালি স্লিপ তৈরি হচ্ছে।
                </span>
                <div className="flex items-center space-x-1">
                  <span>কপির সংখ্যা:</span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={universalBlankCount}
                    onChange={(e) => setUniversalBlankCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-14 px-1.5 py-0.5 text-center bg-slate-800 border border-slate-700 text-white rounded font-mono font-bold"
                  />
                  <span>পাতা</span>
                </div>
              </div>
            )}
            {voucherMode === 'with_amounts' && (
              <span>
                ✓ ডাটাবেজে এন্ট্রি করা ইনভয়েস ও বকেয়া টাকার পরিমাণসহ ভাউচার তৈরি হচ্ছে।
              </span>
            )}
          </div>
        </div>

        {/* All Students Voucher Sheets */}
        <div className="p-4 sm:p-6 space-y-8 bg-slate-200/50 print:p-0 print:space-y-0 print:bg-white">
          {/* Universal Blank Mode: print requested number of blank sheets */}
          {voucherMode === 'universal_blank' && (
            <>
              {Array.from({ length: universalBlankCount }).map((_, idx) => {
                const blankData = getStudentVoucherData({
                  id: `blank_${idx}`,
                  roll: 0,
                  nameBn: '',
                  classId: selectedClassId,
                  section: selectedSection === 'all' ? 'ক' : selectedSection,
                  academicYear: '২০২৬',
                });

                return (
                  <div
                    key={`universal_page_${idx}`}
                    className="official-voucher-a4-sheet bg-white p-4 sm:p-5 shadow-md max-w-[950px] mx-auto print:shadow-none print:p-0 print:m-0 print:w-full page-break-after"
                  >
                    <div className="text-xs text-slate-500 font-semibold mb-2 print:hidden flex justify-between">
                      <span>
                        পাতা {toBengaliNumber(idx + 1)}: {currentClass?.nameBn} (সম্পূর্ণ খালি স্লিপ)
                      </span>
                      <span className="text-slate-400">হাতে লিখে দেয়ার জন্য</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 print:grid-cols-2 print:gap-4">
                      {renderSingleA5Slip(null, blankData, '- অফিস কপি -')}
                      {renderSingleA5Slip(null, blankData, '- শিক্ষার্থী কপি -')}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* Student Specific Mode (Blank or With Amounts) */}
          {voucherMode !== 'universal_blank' && (
            <>
              {classStudents.length === 0 ? (
                <div className="bg-white p-12 text-center rounded-xl border border-slate-300">
                  <FileText className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                  <h3 className="font-bold text-slate-800 text-base">
                    {currentClass?.nameBn}-এ কোনো শিক্ষার্থী পাওয়া যায়নি।
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    দয়া করে উপরের শ্রেণি ড্রপডাউন থেকে অন্য কোনো শ্রেণি নির্বাচন করুন অথবা
                    'সম্পূর্ণ খালি স্লিপ' মোড ব্যবহার করুন।
                  </p>
                </div>
              ) : (
                classStudents.map((student, sIdx) => {
                  const data = getStudentVoucherData(student);
                  return (
                    <div
                      key={student.id}
                      className="official-voucher-a4-sheet bg-white p-4 sm:p-5 shadow-md max-w-[950px] mx-auto print:shadow-none print:p-0 print:m-0 print:w-full page-break-after"
                    >
                      <div className="text-xs text-slate-500 font-semibold mb-2 print:hidden flex justify-between">
                        <span>
                          পাতা {toBengaliNumber(sIdx + 1)} / {toBengaliNumber(classStudents.length)}: {student.nameBn} (রোল: {toBengaliRoll(student.roll)}, {currentClass?.nameBn})
                        </span>
                        <span className="text-emerald-700 font-bold">
                          {voucherMode === 'blank_students' ? 'ব্ল্যাঙ্ক টাকার ঘর (হাতে লেখার জন্য প্রস্তুত)' : 'টাকাসহ'}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 print:grid-cols-2 print:gap-4">
                        {renderSingleA5Slip(student, data, '- অফিস কপি -')}
                        {renderSingleA5Slip(student, data, '- শিক্ষার্থী কপি -')}
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
