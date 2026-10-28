import React from 'react';
import { Printer, X, Receipt, CheckCircle, ShieldCheck } from 'lucide-react';
import { SchoolInfo, PaymentRecord } from '../types';
import { SchoolLogo } from './SchoolLogo';
import { toBengaliNumber, toBengaliRoll } from '../utils/bengali';

interface PrintableMoneyReceiptProps {
  schoolInfo: SchoolInfo;
  receipt: PaymentRecord;
  onClose: () => void;
}

export const PrintableMoneyReceipt: React.FC<PrintableMoneyReceiptProps> = ({
  schoolInfo,
  receipt,
  onClose,
}) => {
  const handlePrint = () => {
    window.print();
  };

  const renderReceiptSide = (copyType: 'গ্রাহক / শিক্ষার্থী কপি' | 'অফিস কপি') => (
    <div className="border-2 border-emerald-900/40 p-4 bg-emerald-50/20 rounded shadow-sm flex flex-col justify-between text-slate-900 text-xs font-sans relative">
      {/* Paid Watermark */}
      <div className="absolute right-6 top-24 pointer-events-none opacity-10 select-none">
        <span className="text-6xl font-black text-emerald-900 tracking-widest uppercase border-4 border-emerald-900 px-4 py-2 rotate-[-20deg] inline-block">
          PAID
        </span>
      </div>

      <div>
        {/* School Header */}
        <div className="flex items-center justify-between border-b pb-2 mb-2 border-emerald-200">
          <div className="flex items-center space-x-2">
            <SchoolLogo customLogoUrl={schoolInfo.logoUrl} size={38} />
            <div>
              <h2 className="font-bold text-sm font-serif text-emerald-950 leading-tight">
                {schoolInfo.name || 'ডি-লিকন মডেল একাডেমী'}
              </h2>
              <p className="text-[10px] text-slate-600 leading-tight">{schoolInfo.address}</p>
              <p className="text-[10px] text-slate-500">ফোন: {toBengaliNumber(schoolInfo.phone)}</p>
            </div>
          </div>
          <div className="text-right">
            <span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-emerald-700 text-white rounded">
              {copyType}
            </span>
            <div className="text-[11px] text-slate-700 mt-1 font-mono">
              রসিদ নং: <span className="font-bold text-emerald-900">{receipt.receiptNumber}</span>
            </div>
            <div className="text-[10px] text-slate-500">
              তারিখ: <span className="font-semibold text-slate-800">{toBengaliNumber(receipt.paymentDate)}</span>
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="text-center my-1.5">
          <span className="inline-block px-3 py-0.5 text-xs font-bold bg-emerald-900 text-amber-300 rounded shadow-sm">
            ফি আদায়ের অফিশিয়াল মানি রিসিট (MONEY RECEIPT)
          </span>
        </div>

        {/* Student Meta Details */}
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 bg-white p-2.5 rounded border border-emerald-200 text-[11px] mb-2.5 shadow-xs">
          <div>
            <span className="text-slate-500">শিক্ষার্থীর নাম:</span>{' '}
            <strong className="text-slate-900 font-bold">{receipt.studentNameBn}</strong>
          </div>
          <div>
            <span className="text-slate-500">রোল নং:</span>{' '}
            <strong className="text-indigo-900 font-bold">{toBengaliRoll(receipt.studentRoll)}</strong>
          </div>
          <div>
            <span className="text-slate-500">শ্রেণি:</span>{' '}
            <span className="font-semibold text-slate-800">
              {receipt.classId.replace('class_', '') === 'play' ? 'প্লে' : receipt.classId.replace('class_', '') === 'nursery' ? 'নার্সারি' : receipt.classId.replace('class_', '') === 'kg' ? 'কেজি' : `${toBengaliNumber(receipt.classId.replace('class_', ''))}ম শ্রেণি`}
            </span>{' '}
            ({receipt.section} শাখা)
          </div>
          <div>
            <span className="text-slate-500">শিক্ষাবর্ষ:</span>{' '}
            <span className="font-semibold text-slate-800">{toBengaliNumber(receipt.academicYear)}</span>
          </div>
          <div>
            <span className="text-slate-500">পরিশোধের মাধ্যম:</span>{' '}
            <span className="font-semibold text-emerald-800">{receipt.paymentMethod}</span>
          </div>
          {receipt.transactionRef && (
            <div>
              <span className="text-slate-500">ট্রানজেকশন আইডি:</span>{' '}
              <span className="font-mono text-slate-800 font-semibold">{receipt.transactionRef}</span>
            </div>
          )}
        </div>

        {/* Items Breakdown Table */}
        <table className="w-full border-collapse border border-slate-300 text-[11px] mb-2">
          <thead>
            <tr className="bg-emerald-100/60 text-slate-900 border-b border-emerald-200">
              <th className="border border-slate-300 px-2 py-1 text-center w-8">ক্র.</th>
              <th className="border border-slate-300 px-2 py-1 text-left">আদায়কৃত খাতের বিবরণ</th>
              <th className="border border-slate-300 px-2 py-1 text-right w-24">টাকার পরিমাণ (৳)</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {receipt.itemsBreakdown && receipt.itemsBreakdown.length > 0 ? (
              receipt.itemsBreakdown.map((item, idx) => (
                <tr key={idx} className="border-b border-slate-200">
                  <td className="border border-slate-300 px-2 py-0.5 text-center font-mono">{toBengaliNumber(idx + 1)}</td>
                  <td className="border border-slate-300 px-2 py-0.5 text-slate-800 font-medium">{item.nameBn}</td>
                  <td className="border border-slate-300 px-2 py-0.5 text-right font-mono font-semibold text-slate-900">
                    {toBengaliNumber(item.amount)}/-
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="border border-slate-300 px-2 py-0.5 text-center font-mono">১</td>
                <td className="border border-slate-300 px-2 py-0.5 text-slate-800">মাসিক বেতন ও বিবিধ ফি বাবদ গ্রহণ</td>
                <td className="border border-slate-300 px-2 py-0.5 text-right font-mono font-semibold">
                  {toBengaliNumber(receipt.paidAmount)}/-
                </td>
              </tr>
            )}
            {/* Grand Total Row */}
            <tr className="bg-emerald-50 font-bold border-t-2 border-emerald-300">
              <td colSpan={2} className="border border-slate-300 px-2 py-1 text-right text-emerald-950">
                মোট আদায়কৃত টাকা (Total Paid):
              </td>
              <td className="border border-slate-300 px-2 py-1 text-right text-emerald-900 font-mono text-xs">
                ৳ {toBengaliNumber(receipt.paidAmount)}/-
              </td>
            </tr>
          </tbody>
        </table>

        {/* Bengali Words Block */}
        <div className="bg-emerald-50/80 p-2 rounded border border-emerald-200 text-[11px] mb-2 text-slate-800">
          <span className="text-slate-600 font-medium">কথায়:</span>{' '}
          <strong className="text-emerald-900 font-bold">{receipt.amountInWordsBn}</strong>
        </div>

        {/* Real-Time Deduction & Remaining Balance Box */}
        <div className="bg-white p-2.5 rounded border border-slate-300 space-y-1 text-[11px] mb-2 shadow-xs">
          <div className="flex justify-between text-slate-600">
            <span>পেমেন্ট গ্রহণের পূর্বে মোট বকেয়া:</span>
            <span className="font-mono text-slate-800 font-semibold">৳ {toBengaliNumber(receipt.previousTotalDue)}/-</span>
          </div>
          <div className="flex justify-between text-emerald-700">
            <span>অত্র রসিদে কর্তন/আদায়:</span>
            <span className="font-mono font-semibold">- ৳ {toBengaliNumber(receipt.paidAmount)}/-</span>
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-slate-200 font-bold">
            <span className={receipt.remainingDue > 0 ? 'text-amber-800' : 'text-emerald-700'}>
              বর্তমানে অবশিষ্ট মোট বকেয়া (Balance Due):
            </span>
            <span
              className={`font-mono text-xs px-2 py-0.5 rounded ${
                receipt.remainingDue > 0
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              }`}
            >
              {receipt.remainingDue > 0 ? `৳ ${toBengaliNumber(receipt.remainingDue)}/-` : 'সম্পূর্ণ পরিশোধিত (০/-)'}
            </span>
          </div>
        </div>

        {receipt.notes && (
          <div className="text-[10px] text-slate-600 italic mb-2">
            <strong>মন্তব্য:</strong> {receipt.notes}
          </div>
        )}
      </div>

      {/* Signatures & Collector */}
      <div className="pt-6 border-t border-slate-200 flex justify-between items-end text-[10px] text-slate-700">
        <div>
          <div className="text-[9px] text-slate-500 mb-0.5">আদায়কারী: {receipt.collectedBy}</div>
          <div className="w-24 border-b border-slate-400 mb-1"></div>
          <span>হিসাব সহকারী / ক্যাশিয়ার</span>
        </div>
        <div className="text-center">
          <div className="w-28 border-b border-slate-400 mb-1"></div>
          <span className="font-bold text-slate-800">প্রধান শিক্ষক</span>
          <div className="text-[9px] text-slate-500">(সিলমোহর)</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full border border-slate-300 overflow-hidden flex flex-col max-h-[96vh]">
        {/* Action Header - hidden during print */}
        <div className="no-print bg-emerald-950 text-white px-4 py-3 flex items-center justify-between border-b border-emerald-800">
          <div className="flex items-center space-x-2">
            <Receipt className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-sm sm:text-base">
              মানি রিসিট প্রিন্ট প্রিভিউ (রসিদ নং: {receipt.receiptNumber})
            </h3>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-sm"
            >
              <Printer className="w-4 h-4 mr-1.5" />
              প্রিন্ট করুন (Print Receipt)
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-emerald-900 transition"
              title="বন্ধ করুন"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Paper Canvas */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-200 flex justify-center">
          <div className="printable-receipt-wrapper bg-white p-4 sm:p-6 shadow-md max-w-4xl w-full">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
              {renderReceiptSide('গ্রাহক / শিক্ষার্থী কপি')}

              {/* Perforation Line */}
              <div className="hidden md:block absolute left-1/2 top-0 bottom-0 -ml-[1px] border-l-2 border-dashed border-emerald-300 pointer-events-none z-10">
                <span className="absolute top-1/2 -left-2.5 -translate-y-1/2 bg-white px-0.5 text-[9px] text-emerald-600 rotate-90 font-mono">
                  ✂ কাউন্টারফয়েল
                </span>
              </div>

              {renderReceiptSide('অফিস কপি')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
