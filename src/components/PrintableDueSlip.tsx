import React from 'react';
import { Printer, X, FileText, CheckCircle2 } from 'lucide-react';
import { SchoolInfo, Student, FeeInvoice } from '../types';
import { SchoolLogo } from './SchoolLogo';
import { toBengaliNumber, toBengaliRoll } from '../utils/bengali';

interface PrintableDueSlipProps {
  schoolInfo: SchoolInfo;
  student: Student;
  invoice: FeeInvoice;
  onClose: () => void;
}

export const PrintableDueSlip: React.FC<PrintableDueSlipProps> = ({
  schoolInfo,
  student,
  invoice,
  onClose,
}) => {
  const handlePrint = () => {
    window.print();
  };

  const renderSlipSide = (copyType: 'শিক্ষার্থী কপি' | 'অফিস কপি') => (
    <div className="border border-slate-800 p-4 bg-white rounded-sm shadow-sm flex flex-col justify-between text-slate-900 text-xs font-sans">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between border-b pb-2 mb-2 border-slate-300">
          <div className="flex items-center space-x-2">
            <SchoolLogo customLogoUrl={schoolInfo.logoUrl} size={36} />
            <div>
              <h2 className="font-bold text-sm font-serif text-slate-900 leading-tight">
                {schoolInfo.name || 'ডি-লিকন মডেল একাডেমী'}
              </h2>
              <p className="text-[10px] text-slate-600 leading-tight">{schoolInfo.address}</p>
              <p className="text-[10px] text-slate-500">ফোন: {toBengaliNumber(schoolInfo.phone)}</p>
            </div>
          </div>
          <div className="text-right">
            <span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 rounded">
              {copyType}
            </span>
            <div className="text-[10px] text-slate-600 mt-1 font-mono">
              বিল নং: <span className="font-bold text-slate-900">{invoice.invoiceNumber}</span>
            </div>
          </div>
        </div>

        {/* Title Badge */}
        <div className="text-center my-1.5">
          <span className="inline-block px-3 py-0.5 text-xs font-bold bg-slate-900 text-white rounded">
            বকেয়া ও ফি আদায় স্লিপ (ডিউ স্লিপ)
          </span>
          <p className="text-[10px] text-slate-600 mt-0.5">{invoice.billMonthYear || invoice.title}</p>
        </div>

        {/* Student Meta Details */}
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 bg-slate-50 p-2 rounded border border-slate-200 text-[11px] mb-2">
          <div>
            <span className="text-slate-500">শিক্ষার্থীর নাম:</span>{' '}
            <strong className="text-slate-900 font-bold">{student.nameBn}</strong>
          </div>
          <div>
            <span className="text-slate-500">রোল নং:</span>{' '}
            <strong className="text-indigo-900 font-bold">{toBengaliRoll(student.roll)}</strong>
          </div>
          <div>
            <span className="text-slate-500">শ্রেণি:</span>{' '}
            <span className="font-semibold text-slate-800">{invoice.classId.replace('class_', '') === 'play' ? 'প্লে' : invoice.classId.replace('class_', '') === 'nursery' ? 'নার্সারি' : invoice.classId.replace('class_', '') === 'kg' ? 'কেজি' : `${toBengaliNumber(invoice.classId.replace('class_', ''))}ম শ্রেণি`}</span>{' '}
            ({invoice.section} শাখা)
          </div>
          <div>
            <span className="text-slate-500">শিক্ষাবর্ষ:</span>{' '}
            <span className="font-semibold text-slate-800">{toBengaliNumber(invoice.academicYear)}</span>
          </div>
          {student.guardianPhone && (
            <div className="col-span-2">
              <span className="text-slate-500">অভিভাবক ফোন:</span>{' '}
              <span className="font-mono text-slate-800">{toBengaliNumber(student.guardianPhone)}</span>
            </div>
          )}
        </div>

        {/* Items Table */}
        <table className="w-full border-collapse border border-slate-300 text-[11px] mb-2">
          <thead>
            <tr className="bg-slate-100 text-slate-800 border-b border-slate-300">
              <th className="border border-slate-300 px-1.5 py-1 text-center w-7">নং</th>
              <th className="border border-slate-300 px-2 py-1 text-left">ফি/বকেয়ার বিবরণ</th>
              <th className="border border-slate-300 px-2 py-1 text-right w-16">ধার্য (৳)</th>
              <th className="border border-slate-300 px-2 py-1 text-right w-16">মওকুফ (৳)</th>
              <th className="border border-slate-300 px-2 py-1 text-right w-20">প্রদেয় (৳)</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, idx) => (
              <tr key={idx} className="border-b border-slate-200">
                <td className="border border-slate-300 px-1.5 py-0.5 text-center font-mono">{toBengaliNumber(idx + 1)}</td>
                <td className="border border-slate-300 px-2 py-0.5">
                  <div className="font-medium text-slate-900">{item.nameBn}</div>
                  {item.month && <span className="text-[10px] text-slate-500">({item.month})</span>}
                </td>
                <td className="border border-slate-300 px-2 py-0.5 text-right font-mono">{toBengaliNumber(item.amount)}/-</td>
                <td className="border border-slate-300 px-2 py-0.5 text-right font-mono text-slate-500">{toBengaliNumber(item.waiver || 0)}/-</td>
                <td className="border border-slate-300 px-2 py-0.5 text-right font-mono font-semibold text-slate-900">{toBengaliNumber(item.netAmount)}/-</td>
              </tr>
            ))}
            {invoice.previousDue > 0 && (
              <tr className="bg-amber-50/50">
                <td className="border border-slate-300 px-1.5 py-0.5 text-center font-mono">{toBengaliNumber(invoice.items.length + 1)}</td>
                <td className="border border-slate-300 px-2 py-0.5 font-medium text-amber-900">পূর্বের অবশিষ্ট বকেয়া</td>
                <td className="border border-slate-300 px-2 py-0.5 text-right font-mono text-amber-900">{toBengaliNumber(invoice.previousDue)}/-</td>
                <td className="border border-slate-300 px-2 py-0.5 text-right font-mono">-</td>
                <td className="border border-slate-300 px-2 py-0.5 text-right font-mono font-semibold text-amber-900">{toBengaliNumber(invoice.previousDue)}/-</td>
              </tr>
            )}
            {invoice.fineAmount > 0 && (
              <tr className="bg-rose-50/50">
                <td className="border border-slate-300 px-1.5 py-0.5 text-center font-mono">{toBengaliNumber(invoice.items.length + (invoice.previousDue > 0 ? 2 : 1))}</td>
                <td className="border border-slate-300 px-2 py-0.5 text-rose-800">বিলম্ব ফি / জরিমানা</td>
                <td className="border border-slate-300 px-2 py-0.5 text-right font-mono text-rose-800">{toBengaliNumber(invoice.fineAmount)}/-</td>
                <td className="border border-slate-300 px-2 py-0.5 text-right font-mono">-</td>
                <td className="border border-slate-300 px-2 py-0.5 text-right font-mono font-semibold text-rose-800">{toBengaliNumber(invoice.fineAmount)}/-</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Calculation summary block */}
        <div className="bg-slate-50 p-2 rounded border border-slate-300 space-y-1 text-[11px] mb-2">
          <div className="flex justify-between text-slate-700">
            <span>সর্বমোট প্রদেয় ফি:</span>
            <span className="font-bold text-slate-900 font-mono">৳ {toBengaliNumber(invoice.totalPayable)}/-</span>
          </div>
          <div className="flex justify-between text-emerald-700 font-medium">
            <span>পরিশোধিত অর্থ (জমা):</span>
            <span className="font-mono">৳ {toBengaliNumber(invoice.paidAmount)}/-</span>
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-slate-300 font-bold">
            <span className={invoice.dueAmount > 0 ? 'text-rose-700 text-xs' : 'text-emerald-700 text-xs'}>
              {invoice.dueAmount > 0 ? 'অবশিষ্ট বকেয়া টাকা:' : 'পরিশোধের অবস্থা:'}
            </span>
            <span className={`text-sm font-mono px-2 py-0.5 rounded ${invoice.dueAmount > 0 ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'}`}>
              {invoice.dueAmount > 0 ? `৳ ${toBengaliNumber(invoice.dueAmount)}/-` : 'সম্পূর্ণ পরিশোধিত'}
            </span>
          </div>
        </div>

        {/* Payment Deadline and note */}
        <div className="text-[10px] text-slate-600 bg-amber-50 border border-amber-200 p-1.5 rounded mb-4">
          <p className="font-semibold text-amber-900">
            পরিশোধের শেষ তারিখ: <span className="underline font-bold">{toBengaliNumber(invoice.dueDate)}</span>
          </p>
          <p className="text-[9px] text-amber-800 mt-0.5">
            * নির্ধারিত তারিখের মধ্যে বিদ্যালয় অফিসে ফি পরিশোধ করে মানি রিসিট গ্রহণ করার অনুরোধ করা হচ্ছে।
          </p>
        </div>
      </div>

      {/* Signature area */}
      <div className="pt-6 border-t border-slate-200 flex justify-between items-end text-[10px] text-slate-700">
        <div className="text-center">
          <div className="w-24 border-b border-slate-400 mb-1"></div>
          <span>আদায়কারীর স্বাক্ষর</span>
        </div>
        <div className="text-center">
          <div className="w-28 border-b border-slate-400 mb-1"></div>
          <span className="font-bold text-slate-800">প্রধান শিক্ষক</span>
          <div className="text-[9px] text-slate-500">(সিলসহ)</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full border border-slate-300 overflow-hidden flex flex-col max-h-[96vh]">
        {/* Action Header - hidden during print */}
        <div className="no-print bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-sm sm:text-base">
              ডিউ স্লিপ প্রিন্ট প্রিভিউ (শিক্ষার্থী কপি ও অফিস কপি)
            </h3>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-sm"
            >
              <Printer className="w-4 h-4 mr-1.5" />
              প্রিন্ট করুন (Print Slip)
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              title="বন্ধ করুন"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Paper Canvas */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-200 flex justify-center">
          <div className="printable-slip-wrapper bg-white p-4 sm:p-6 shadow-md max-w-4xl w-full">
            {/* 2-Column layout: Student Copy on left, Office Copy on right with scissor dashed line */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
              {renderSlipSide('শিক্ষার্থী কপি')}

              {/* Perforation Line for desktop / print */}
              <div className="hidden md:block absolute left-1/2 top-0 bottom-0 -ml-[1px] border-l-2 border-dashed border-slate-400 pointer-events-none z-10">
                <span className="absolute top-1/2 -left-2.5 -translate-y-1/2 bg-white px-0.5 text-[9px] text-slate-400 rotate-90 font-mono">
                  ✂ কেটে আলাদা করুন
                </span>
              </div>

              {renderSlipSide('অফিস কপি')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
