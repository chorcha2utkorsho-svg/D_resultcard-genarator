import React, { useState, useMemo } from 'react';
import { Printer, X, Check, Edit2, RotateCcw, CreditCard, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { SchoolInfo, Student, FeeInvoice, PaymentRecord, SchoolClass, PaymentMethod } from '../types';
import { SchoolLogo } from './SchoolLogo';
import { toBengaliNumber, toBengaliRoll } from '../utils/bengali';
import { numberToBengaliWords } from '../utils/bengaliWords';
import { STANDARD_8_VOUCHER_HEADS } from '../data/defaultData';

export interface VoucherItemData {
  serialBn: string;
  nameBn: string;
  amount: number;
}

export interface PrintableOfficialVoucherProps {
  schoolInfo: SchoolInfo;
  student: Student;
  allStudents?: Student[];
  currentStudentIndex?: number;
  onNavigateStudent?: (index: number) => void;
  invoice?: FeeInvoice;
  receipt?: PaymentRecord;
  classes?: SchoolClass[];
  voucherType?: 'due_slip' | 'money_receipt';
  onClose: () => void;
  onCollectPayment?: (params: {
    studentId: string;
    invoiceId?: string;
    paidAmount: number;
    paymentMethod: PaymentMethod;
    transactionRef?: string;
    collectedBy: string;
    itemsBreakdown?: { nameBn: string; amount: number }[];
  }) => void;
}

export const PrintableOfficialVoucher: React.FC<PrintableOfficialVoucherProps> = ({
  schoolInfo,
  student,
  allStudents,
  currentStudentIndex = 0,
  onNavigateStudent,
  invoice,
  receipt,
  classes = [],
  voucherType: initialVoucherType = 'due_slip',
  onClose,
  onCollectPayment,
}) => {
  const [voucherType, setVoucherType] = useState<'due_slip' | 'money_receipt'>(
    receipt ? 'money_receipt' : initialVoucherType
  );
  const [customTitle, setCustomTitle] = useState('');
  const [isBlankSlip, setIsBlankSlip] = useState(false);
  const [isEditingAmounts, setIsEditingAmounts] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('নগদ');
  const [payCollector, setPayCollector] = useState('অফিস সহকারী');
  const [payTrxRef, setPayTrxRef] = useState('');

  // Class name resolution
  const classNameBn = useMemo(() => {
    const matchedClass = classes.find((c) => c.id === student.classId);
    if (matchedClass) return matchedClass.nameBn;
    const clean = student.classId.replace('class_', '');
    if (clean === 'play') return 'প্লে';
    if (clean === 'nursery') return 'নার্সারি';
    if (clean === 'kg') return 'কেজি';
    return `${toBengaliNumber(clean)}ম শ্রেণি`;
  }, [classes, student.classId]);

  // Derive initial 8 items from invoice, receipt, or default heads
  const initialBreakdown = useMemo(() => {
    // 1. If viewing a payment receipt
    if (receipt && receipt.itemsBreakdown && receipt.itemsBreakdown.length > 0) {
      return STANDARD_8_VOUCHER_HEADS.map((head) => {
        // match by name or fallback
        const found = receipt.itemsBreakdown.find((item) =>
          item.nameBn.includes(head.nameBn) || head.nameBn.includes(item.nameBn)
        );
        return {
          serialBn: head.serialBn,
          nameBn: head.nameBn,
          amount: found ? found.amount : 0,
        };
      });
    }

    // 2. If viewing an invoice
    if (invoice) {
      return STANDARD_8_VOUCHER_HEADS.map((head) => {
        let amount = 0;
        if (head.id === 'fh_arrears') {
          amount = invoice.previousDue || 0;
        } else {
          const match = invoice.items.find((item) =>
            item.headId === head.id ||
            item.nameBn.includes(head.nameBn) ||
            head.nameBn.includes(item.nameBn)
          );
          if (match) {
            amount = match.netAmount || match.amount || 0;
          }
        }
        return {
          serialBn: head.serialBn,
          nameBn: head.nameBn,
          amount,
        };
      });
    }

    // 3. Fallback to standard defaults
    return STANDARD_8_VOUCHER_HEADS.map((head) => ({
      serialBn: head.serialBn,
      nameBn: head.nameBn,
      amount: head.defaultAmount,
    }));
  }, [invoice, receipt]);

  const [items, setItems] = useState<VoucherItemData[]>(initialBreakdown);

  // Synchronize items when student/invoice changes
  React.useEffect(() => {
    setItems(initialBreakdown);
  }, [initialBreakdown]);

  // Grand total
  const grandTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [items]);

  // In Bengali words
  const grandTotalWords = useMemo(() => {
    if (receipt?.amountInWordsBn && voucherType === 'money_receipt') {
      return receipt.amountInWordsBn;
    }
    return numberToBengaliWords(grandTotal);
  }, [grandTotal, receipt, voucherType]);

  const handleAmountChange = (index: number, newAmount: number) => {
    setItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, amount: Math.max(0, newAmount) } : item))
    );
  };

  const handlePrint = () => {
    window.print();
  };

  // Title display
  const titleText = customTitle.trim() || (voucherType === 'due_slip' ? 'বকেয়া বেতনের রিসিট' : 'বেতনের রিসিট');

  // Handle instant payment collection
  const handleConfirmPayment = () => {
    if (!onCollectPayment) return;
    onCollectPayment({
      studentId: student.id,
      invoiceId: invoice?.id,
      paidAmount: grandTotal,
      paymentMethod: payMethod,
      transactionRef: payTrxRef,
      collectedBy: payCollector,
      itemsBreakdown: items.filter((i) => i.amount > 0).map((i) => ({ nameBn: i.nameBn, amount: i.amount })),
    });
    setShowPayModal(false);
    setVoucherType('money_receipt');
  };

  // Render one of the two A5 slips (Left: - অফিস কপি -, Right: - শিক্ষার্থী কপি -)
  const renderA5Slip = (copyType: '- অফিস কপি -' | '- শিক্ষার্থী কপি -') => (
    <div className="official-voucher-slip bg-white text-black p-3.5 sm:p-4.5 flex flex-col justify-between select-none relative box-border border-2 border-slate-900 rounded-xs min-h-[490px] text-xs">
      {/* Top Header */}
      <div>
        <div className="relative flex items-center justify-center pb-2 border-b border-black">
          {/* Logo on Left */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2">
            <SchoolLogo customLogoUrl={schoolInfo.logoUrl} size={48} className="border border-black/40 rounded-full p-0.5" />
          </div>

          {/* School Name & Subtitle */}
          <div className="text-center px-12">
            <h1 className="text-lg sm:text-xl font-bold font-serif tracking-tight text-black leading-tight">
              {schoolInfo.name || 'ডি-লিকন মডেল একাডেমী'}
            </h1>
            <p className="text-[11px] font-semibold text-slate-800 leading-tight mt-0.5">
              {schoolInfo.established || 'স্থাপিত: ২০১৮ ইং'}
            </p>
            <p className="text-[10px] text-slate-700 leading-tight mt-0.5">
              {schoolInfo.address || 'গনি মার্কেট, সনমানিয়া, কাপাসিয়া, গাজীপুর।'}
            </p>
          </div>
        </div>

        {/* Title Badge Box */}
        <div className="text-center my-2">
          <div className="inline-block px-5 py-0.5 border border-black rounded-md font-bold text-xs sm:text-sm tracking-wide bg-white text-black shadow-xs">
            {titleText}
          </div>
        </div>

        {/* Student Meta Details with Dotted Line Fill */}
        <div className="space-y-1.5 mb-2 text-[11px] sm:text-xs">
          {/* Row 1: নাম & শ্রেণি */}
          <div className="grid grid-cols-12 gap-2 items-baseline">
            <div className="col-span-7 flex items-baseline overflow-hidden">
              <span className="font-semibold whitespace-nowrap">নাম:</span>
              <span className="ml-1.5 font-bold text-black whitespace-nowrap">{student.nameBn}</span>
              <span className="flex-1 border-b border-dotted border-black ml-1 min-w-[20px]" />
            </div>
            <div className="col-span-5 flex items-baseline overflow-hidden">
              <span className="font-semibold whitespace-nowrap">শ্রেণি:</span>
              <span className="ml-1.5 font-bold text-black whitespace-nowrap">{classNameBn}</span>
              <span className="flex-1 border-b border-dotted border-black ml-1 min-w-[20px]" />
            </div>
          </div>

          {/* Row 2: শাখা & রোল */}
          <div className="grid grid-cols-12 gap-2 items-baseline">
            <div className="col-span-7 flex items-baseline overflow-hidden">
              <span className="font-semibold whitespace-nowrap">শাখা:</span>
              <span className="ml-1.5 font-bold text-black whitespace-nowrap">{student.section || 'ক'}</span>
              <span className="flex-1 border-b border-dotted border-black ml-1 min-w-[20px]" />
            </div>
            <div className="col-span-5 flex items-baseline overflow-hidden">
              <span className="font-semibold whitespace-nowrap">রোল:</span>
              <span className="ml-1.5 font-bold text-black whitespace-nowrap">{toBengaliRoll(student.roll)}</span>
              <span className="flex-1 border-b border-dotted border-black ml-1 min-w-[20px]" />
            </div>
          </div>
        </div>

        {/* 8-Row Breakdown Table */}
        <table className="w-full border-collapse border border-black text-[11px] sm:text-xs mb-2">
          <thead>
            <tr className="border-b border-black font-bold bg-slate-50/50">
              <th className="border border-black py-0.5 px-1.5 text-center w-8">ক্র.</th>
              <th className="border border-black py-0.5 px-2 text-center">বিবরণ</th>
              <th className="border border-black py-0.5 px-2 text-center w-28">টাকা</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="border-b border-black">
                <td className="border border-black py-0.5 px-1.5 text-center font-medium">
                  {item.serialBn}
                </td>
                <td className="border border-black py-0.5 px-2 text-left font-medium">
                  {item.nameBn}
                </td>
                <td className="border border-black py-0.5 px-2 text-right font-medium">
                  {!isBlankSlip && item.amount > 0 ? `${toBengaliNumber(item.amount)}/-` : ''}
                </td>
              </tr>
            ))}
            {/* Grand Total Row */}
            <tr className="border-t-2 border-black font-bold">
              <td colSpan={2} className="border border-black py-1 px-3 text-right pr-4 font-bold text-xs sm:text-sm">
                সর্বমোট টাকা =
              </td>
              <td className="border border-black py-1 px-2 text-right font-bold text-xs sm:text-sm font-mono">
                {!isBlankSlip && grandTotal > 0 ? `${toBengaliNumber(grandTotal)}/-` : <span className="text-transparent select-none">&nbsp;</span>}
              </td>
            </tr>
          </tbody>
        </table>

        {/* In Words Line */}
        <div className="flex items-baseline overflow-hidden text-[11px] sm:text-xs mb-4">
          <span className="font-semibold whitespace-nowrap">কথায়:</span>
          {!isBlankSlip && grandTotal > 0 && grandTotalWords ? (
            <span className="ml-1.5 font-bold text-black whitespace-nowrap">{grandTotalWords}</span>
          ) : (
            <span className="ml-1.5 text-transparent select-none whitespace-nowrap">&nbsp;</span>
          )}
          <span className="flex-1 border-b border-dotted border-black ml-1 min-w-[20px]" />
        </div>
      </div>

      {/* Footer Signatures & Copy Indicator */}
      <div className="pt-8">
        <div className="flex justify-between items-end px-3 mb-2 text-[11px] sm:text-xs">
          <div className="text-center">
            <div className="w-28 sm:w-36 border-t border-black mb-1 mx-auto" />
            <span className="font-medium text-black">অভিভাবকের স্বাক্ষর</span>
          </div>
          <div className="text-center">
            <div className="w-28 sm:w-36 border-t border-black mb-1 mx-auto" />
            <span className="font-medium text-black">অফিস সহকারী / প্রিন্সিপাল</span>
          </div>
        </div>

        {/* Center Bottom Copy Label */}
        <div className="text-center mt-1">
          <span className="text-[11px] font-bold text-slate-800 tracking-wider">
            {copyType}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs overflow-y-auto flex items-start justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static print:inset-auto">
      {/* Container wrapper */}
      <div className="bg-slate-100 rounded-xl shadow-2xl max-w-5xl w-full my-4 overflow-hidden border border-slate-300 print:shadow-none print:border-none print:m-0 print:max-w-none">
        {/* Top Control Bar (Hidden during Print) */}
        <div className="p-3 bg-slate-800 text-white flex flex-wrap items-center justify-between gap-2 print:hidden border-b border-slate-700">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-amber-400" />
            <span className="font-bold text-sm sm:text-base">
              অফিশিয়াল ভাউচার প্রিন্ট ভিউ (A4 পেপারে ২টি A5 পাশাপাশি)
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-amber-300 border border-slate-600 font-mono">
              {student.nameBn} (রোল: {toBengaliRoll(student.roll)})
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {/* Student Switcher if class provided */}
            {allStudents && allStudents.length > 1 && onNavigateStudent && (
              <div className="flex items-center space-x-1 bg-slate-700 px-2 py-1 rounded text-xs">
                <button
                  type="button"
                  onClick={() => onNavigateStudent(Math.max(0, currentStudentIndex - 1))}
                  disabled={currentStudentIndex === 0}
                  className="p-1 hover:bg-slate-600 rounded disabled:opacity-40"
                  title="পূর্ববর্তী শিক্ষার্থী"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-mono">
                  {toBengaliNumber(currentStudentIndex + 1)} / {toBengaliNumber(allStudents.length)}
                </span>
                <button
                  type="button"
                  onClick={() => onNavigateStudent(Math.min(allStudents.length - 1, currentStudentIndex + 1))}
                  disabled={currentStudentIndex === allStudents.length - 1}
                  className="p-1 hover:bg-slate-600 rounded disabled:opacity-40"
                  title="পরবর্তী শিক্ষার্থী"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium text-xs sm:text-sm flex items-center space-x-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>প্রিন্ট করুন (A4)</span>
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              title="বন্ধ করুন"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar Settings (Hidden in Print) */}
        <div className="p-3 bg-white border-b border-slate-200 text-xs flex flex-wrap items-center justify-between gap-3 print:hidden">
          {/* Voucher Mode Switcher */}
          <div className="flex items-center space-x-2">
            <span className="font-medium text-slate-700">রিসিপ্ট ধরন:</span>
            <div className="inline-flex rounded-lg border border-slate-300 p-0.5 bg-slate-50">
              <button
                type="button"
                onClick={() => {
                  setVoucherType('due_slip');
                  setCustomTitle('বকেয়া বেতনের রিসিট');
                }}
                className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                  voucherType === 'due_slip'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                বকেয়া বেতনের রিসিট
              </button>
              <button
                type="button"
                onClick={() => {
                  setVoucherType('money_receipt');
                  setCustomTitle('বেতনের রিসিট');
                }}
                className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                  voucherType === 'money_receipt'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                বেতন ও ফি রিসিট (মানি রিসিট)
              </button>
            </div>

            {/* Hand-written Blank Mode Button */}
            <button
              type="button"
              onClick={() => setIsBlankSlip(!isBlankSlip)}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center space-x-1.5 transition cursor-pointer border ${
                isBlankSlip
                  ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
              }`}
              title="টাকার ঘর ও সর্বমোট খালি রেখে প্রিন্ট করুন যেন হিসাবরক্ষক নিজে হাতে লিখে দিতে পারেন"
            >
              <span>{isBlankSlip ? '✓ হাতে লেখার ব্ল্যাঙ্ক মোড সক্রিয়' : 'হাতে লেখার ব্ল্যাঙ্ক মোড'}</span>
            </button>
          </div>

          {/* Quick Pay Action */}
          {onCollectPayment && voucherType === 'due_slip' && grandTotal > 0 && (
            <button
              type="button"
              onClick={() => setShowPayModal(true)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium flex items-center space-x-1.5 cursor-pointer shadow-xs"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>পেমেন্ট গ্রহণ ও রিসিট প্রদান</span>
            </button>
          )}

          {/* Edit amounts toggle */}
          <button
            type="button"
            onClick={() => setIsEditingAmounts(!isEditingAmounts)}
            className={`px-2.5 py-1.5 rounded font-medium flex items-center space-x-1 cursor-pointer border ${
              isEditingAmounts
                ? 'bg-amber-100 text-amber-900 border-amber-300'
                : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>{isEditingAmounts ? 'সম্পাদনা সম্পন্ন' : 'খাতের টাকা পরিবর্তন'}</span>
          </button>
        </div>

        {/* Amount Editor Form (if toggled) */}
        {isEditingAmounts && (
          <div className="p-3 bg-amber-50 border-b border-amber-200 print:hidden text-xs">
            <div className="font-bold text-amber-900 mb-2">৮টি খাতের টাকার পরিমাণ সরাসরি পরিবর্তন করুন:</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {items.map((item, idx) => (
                <div key={idx} className="bg-white p-2 rounded border border-amber-200">
                  <label className="block text-slate-700 font-semibold mb-0.5 truncate" title={item.nameBn}>
                    {item.serialBn}। {item.nameBn}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={item.amount || ''}
                    onChange={(e) => handleAmountChange(idx, Number(e.target.value) || 0)}
                    placeholder="০"
                    className="w-full px-2 py-1 border border-slate-300 rounded font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center mt-2 pt-2 border-t border-amber-200">
              <span className="font-bold text-amber-950">
                পরিবর্তিত সর্বমোট: {toBengaliNumber(grandTotal)}/- টাকা
              </span>
              <button
                type="button"
                onClick={() => setItems(initialBreakdown)}
                className="text-slate-600 hover:text-slate-900 flex items-center space-x-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>রিসেট করুন</span>
              </button>
            </div>
          </div>
        )}

        {/* Printable Area - The exact A4 sheet containing Two A5 slips side-by-side */}
        <div className="p-4 sm:p-6 bg-slate-200/60 flex justify-center print:p-0 print:bg-white">
          <div className="official-voucher-a4-sheet bg-white p-4 sm:p-5 shadow-lg max-w-[950px] w-full print:shadow-none print:p-0 print:m-0 print:w-full">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 print:grid-cols-2 print:gap-4">
              {/* Left A5 Slip: - অফিস কপি - */}
              {renderA5Slip('- অফিস কপি -')}

              {/* Right A5 Slip: - শিক্ষার্থী কপি - */}
              {renderA5Slip('- শিক্ষার্থী কপি -')}
            </div>
          </div>
        </div>

        {/* Print Note Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-500 print:hidden">
          * A4 সাইজের প্রিন্টারে Landscape মোডে প্রিন্ট করলে ঠিক মাঝখান দিয়ে কেটে ২টি পৃথক A5 সাইজের অফিস ও শিক্ষার্থী কপি তৈরি হবে।
        </div>
      </div>

      {/* Collect Payment Modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-4.5 border border-slate-300 text-xs">
            <div className="flex justify-between items-center border-b pb-2 mb-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-1.5">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                <span>বকেয়া ফি আদায় ও মানি রিসিট প্রস্তুতকরণ</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowPayModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-600">শিক্ষার্থী:</span>
                  <span className="font-bold text-slate-900">{student.nameBn}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-slate-600">শ্রেণি ও রোল:</span>
                  <span className="font-bold text-slate-800">{classNameBn}, রোল: {toBengaliRoll(student.roll)}</span>
                </div>
                <div className="flex justify-between mt-1 pt-1 border-t border-slate-200 text-emerald-800 font-bold">
                  <span>সর্বমোট প্রদেয় ফি:</span>
                  <span className="text-sm font-mono">{toBengaliNumber(grandTotal)}/- টাকা</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">পরিশোধের মাধ্যম:</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="নগদ">নগদ (Cash)</option>
                  <option value="বিকাশ">বিকাশ (bKash)</option>
                  <option value="নগদ/রকেট">নগদ / রকেট</option>
                  <option value="ব্যাংক">ব্যাংক জমা</option>
                  <option value="অন্যান্য">অন্যান্য</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">আদায়কারী / হিসাব সহকারী:</label>
                <input
                  type="text"
                  value={payCollector}
                  onChange={(e) => setPayCollector(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">ট্রানজেকশন রেফারেন্স (ঐচ্ছিক):</label>
                <input
                  type="text"
                  value={payTrxRef}
                  onChange={(e) => setPayTrxRef(e.target.value)}
                  placeholder="যেমন: BKASH-9901"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded font-medium"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPayment}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold flex items-center space-x-1"
                >
                  <Check className="w-4 h-4" />
                  <span>পেমেন্ট নিশ্চিত করুন ও রিসিট দেখুন</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
