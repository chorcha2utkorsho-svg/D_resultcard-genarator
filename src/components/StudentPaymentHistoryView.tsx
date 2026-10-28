import React, { useState, useMemo } from 'react';
import {
  Search,
  Users,
  CreditCard,
  Receipt,
  FileText,
  Printer,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Phone,
  User,
  Sparkles,
  Download,
  Percent,
  PlusCircle,
  MessageSquare,
  X,
  BookOpen,
  ArrowDownRight,
  ArrowUpRight,
  Building,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { Student, FeeInvoice, PaymentRecord, PaymentMethod } from '../types';
import { toBengaliNumber, toBengaliRoll, formatBengaliDate } from '../utils/bengali';
import { numberToBengaliWords } from '../utils/bengaliWords';
import { SchoolLogo } from './SchoolLogo';

interface StudentPaymentHistoryViewProps {
  initialStudentId?: string;
  onOpenPaymentModal?: (student: Student, invoice?: FeeInvoice) => void;
  onOpenDueSlip?: (student: Student, invoice?: FeeInvoice) => void;
  onOpenOfficialVoucher?: (params: {
    student: Student;
    receipt?: PaymentRecord;
    invoice?: FeeInvoice;
    voucherType: 'money_receipt' | 'due_slip';
  }) => void;
  onOpenSMSModal?: (student: Student, dueAmount: number) => void;
}

interface LedgerEntry {
  id: string;
  date: string;
  type: 'invoice' | 'payment';
  voucherNo: string;
  title: string;
  particulars: string;
  debit: number; // Bill amount
  credit: number; // Paid amount
  balance: number; // Running balance after this entry
  method?: string;
  collector?: string;
  rawInvoice?: FeeInvoice;
  rawReceipt?: PaymentRecord;
}

export const StudentPaymentHistoryView: React.FC<StudentPaymentHistoryViewProps> = ({
  initialStudentId,
  onOpenPaymentModal,
  onOpenDueSlip,
  onOpenOfficialVoucher,
  onOpenSMSModal,
}) => {
  const {
    schoolInfo,
    classes,
    students,
    feeInvoices,
    feeReceipts,
    getStudentDueSummary,
  } = useSchool();

  // Search & Filter state
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected Student
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    initialStudentId || (students.length > 0 ? students[0].id : '')
  );

  // Sync selectedStudentId and class filter when initialStudentId prop changes
  React.useEffect(() => {
    if (initialStudentId) {
      setSelectedStudentId(initialStudentId);
      const targetStd = students.find((s) => s.id === initialStudentId);
      if (targetStd) {
        setSelectedClassId(targetStd.classId);
      }
    }
  }, [initialStudentId, students]);

  // Active view tab inside ledger
  const [activeLedgerTab, setActiveLedgerTab] = useState<'combined' | 'invoices' | 'receipts'>('combined');

  // Print Statement Modal
  const [isPrintStatementOpen, setIsPrintStatementOpen] = useState(false);

  // Filtered students list for dropdown / picker
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchClass = selectedClassId === 'all' || s.classId === selectedClassId;
      const matchSection = selectedSection === 'all' || !selectedSection || s.section === selectedSection;
      const matchSearch =
        searchQuery.trim() === '' ||
        s.nameBn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.nameEn && s.nameEn.toLowerCase().includes(searchQuery.toLowerCase())) ||
        String(s.roll).includes(searchQuery) ||
        (s.guardianPhone && s.guardianPhone.includes(searchQuery));
      return matchClass && matchSection && matchSearch;
    });
  }, [students, selectedClassId, selectedSection, searchQuery]);

  // The active student object
  const currentStudent = useMemo(() => {
    return students.find((s) => s.id === selectedStudentId) || (filteredStudents.length > 0 ? filteredStudents[0] : null);
  }, [students, selectedStudentId, filteredStudents]);

  // Current student class name
  const studentClassName = useMemo(() => {
    if (!currentStudent) return '';
    return classes.find((c) => c.id === currentStudent.classId)?.nameBn || currentStudent.classId;
  }, [classes, currentStudent]);

  // Financial summary of selected student
  const studentSummary = useMemo(() => {
    if (!currentStudent) return null;
    return getStudentDueSummary(currentStudent.id);
  }, [currentStudent, getStudentDueSummary]);

  // Student's all invoices
  const studentInvoices = useMemo(() => {
    if (!currentStudent) return [];
    return feeInvoices
      .filter((inv) => inv.studentId === currentStudent.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [feeInvoices, currentStudent]);

  // Student's all receipts
  const studentReceipts = useMemo(() => {
    if (!currentStudent) return [];
    return feeReceipts
      .filter((rec) => rec.studentId === currentStudent.id)
      .sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));
  }, [feeReceipts, currentStudent]);

  // Combined chronological ledger with running balance
  const ledgerEntries = useMemo(() => {
    if (!currentStudent) return [];

    type RawEvent = {
      id: string;
      date: string;
      type: 'invoice' | 'payment';
      data: FeeInvoice | PaymentRecord;
    };

    const events: RawEvent[] = [];

    studentInvoices.forEach((inv) => {
      events.push({
        id: `inv_${inv.id}`,
        date: inv.createdAt,
        type: 'invoice',
        data: inv,
      });
    });

    studentReceipts.forEach((rec) => {
      events.push({
        id: `rec_${rec.id}`,
        date: rec.paymentDate,
        type: 'payment',
        data: rec,
      });
    });

    // Sort chronologically by date
    events.sort((a, b) => {
      const cmp = a.date.localeCompare(b.date);
      if (cmp !== 0) return cmp;
      // If same date, show invoice first, then payment
      return a.type === 'invoice' ? -1 : 1;
    });

    let runningBalance = 0;
    const entries: LedgerEntry[] = [];

    events.forEach((ev) => {
      if (ev.type === 'invoice') {
        const inv = ev.data as FeeInvoice;
        const debitAmount = inv.totalPayable;
        runningBalance += debitAmount;

        const headsText =
          inv.items && inv.items.length > 0
            ? inv.items.map((it) => `${it.nameBn}: ৳${toBengaliNumber(it.netAmount)}`).join(', ')
            : 'মাসিক ফি ও চার্জ';

        entries.push({
          id: ev.id,
          date: inv.createdAt,
          type: 'invoice',
          voucherNo: inv.invoiceNumber,
          title: inv.title,
          particulars: headsText,
          debit: debitAmount,
          credit: 0,
          balance: runningBalance,
          rawInvoice: inv,
        });
      } else {
        const rec = ev.data as PaymentRecord;
        const creditAmount = rec.paidAmount;
        runningBalance -= creditAmount;

        const particulars =
          rec.itemsBreakdown && rec.itemsBreakdown.length > 0
            ? rec.itemsBreakdown.map((it) => `${it.nameBn}: ৳${toBengaliNumber(it.amount)}`).join(', ')
            : 'ফি আদায় জমা';

        entries.push({
          id: ev.id,
          date: rec.paymentDate,
          type: 'payment',
          voucherNo: rec.receiptNumber,
          title: 'ফি পরিশোধ / মানি রিসিট',
          particulars,
          debit: 0,
          credit: creditAmount,
          balance: runningBalance,
          method: rec.paymentMethod,
          collector: rec.collectedBy,
          rawReceipt: rec,
        });
      }
    });

    return entries;
  }, [currentStudent, studentInvoices, studentReceipts]);

  // Overall financial totals
  const totalBilled = studentSummary?.totalBilled || 0;
  const totalPaid = studentSummary?.totalPaid || 0;
  const totalDue = studentSummary?.totalDue || 0;
  const collectionPercentage =
    totalBilled > 0 ? Math.min(100, Math.round((totalPaid / totalBilled) * 100)) : 100;

  // Previous and next student navigation
  const currentStudentIndex = useMemo(() => {
    if (!currentStudent) return -1;
    return filteredStudents.findIndex((s) => s.id === currentStudent.id);
  }, [filteredStudents, currentStudent]);

  const handlePrevStudent = () => {
    if (currentStudentIndex > 0) {
      setSelectedStudentId(filteredStudents[currentStudentIndex - 1].id);
    }
  };

  const handleNextStudent = () => {
    if (currentStudentIndex < filteredStudents.length - 1) {
      setSelectedStudentId(filteredStudents[currentStudentIndex + 1].id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search & Student Selector Header Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 transition">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-xl font-bold font-serif text-slate-900 flex items-center gap-2">
              <span className="p-2 bg-indigo-100 text-indigo-800 rounded-xl">
                <BookOpen className="w-5 h-5" />
              </span>
              <span>শিক্ষার্থী পেমেন্ট হিস্ট্রি ও লেজার খতিয়ান</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              যেকোনো শিক্ষার্থীর অতীত পরিশোধিত ফি, বকেয়া এবং সম্পূর্ণ আর্থিক লেনদেনের খতিয়ান বিবরণী
            </p>
          </div>

          {/* Action buttons */}
          {currentStudent && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setIsPrintStatementOpen(true)}
                className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-900 hover:bg-indigo-800 text-white shadow-sm transition"
              >
                <Printer className="w-4 h-4 mr-1.5 text-amber-300" />
                খতিয়ান স্টেটমেন্ট প্রিন্ট
              </button>

              {totalDue > 0 && onOpenPaymentModal && (
                <button
                  onClick={() => onOpenPaymentModal(currentStudent)}
                  className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition"
                >
                  <PlusCircle className="w-4 h-4 mr-1.5" />
                  তাৎক্ষণিক ফি গ্রহণ
                </button>
              )}

              {totalDue > 0 && currentStudent.guardianPhone && onOpenSMSModal && (
                <button
                  onClick={() => onOpenSMSModal(currentStudent, totalDue)}
                  className="inline-flex items-center px-3 py-2 rounded-xl text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition"
                  title="অভিভাবককে বকেয়ার এসএমএস পাঠান"
                >
                  <MessageSquare className="w-4 h-4 mr-1.5 text-slate-600" />
                  এসএমএস নোটিশ
                </button>
              )}
            </div>
          )}
        </div>

        {/* Filter & Live Search Bar */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
          {/* Class selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">শ্রেণি নির্বাচন:</label>
            <select
              value={selectedClassId}
              onChange={(e) => {
                setSelectedClassId(e.target.value);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="all">সকল শ্রেণি</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.nameBn}
                </option>
              ))}
            </select>
          </div>

          {/* Section selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">শাখা নির্বাচন:</label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="all">সকল শাখা</option>
              <option value="ক">ক শাখা</option>
              <option value="খ">খ শাখা</option>
              <option value="গ">গ শাখা</option>
            </select>
          </div>

          {/* Student Search text */}
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              শিক্ষার্থী সার্চ (নাম, রোল বা মোবাইল):
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="শিক্ষার্থীর নাম, রোল বা অভিভাবকের ফোন লিখুন..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-8 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Quick Student Selector Carousel / Dropdown */}
        <div className="mt-3 flex items-center justify-between gap-2 overflow-x-auto pt-1">
          <div className="flex items-center space-x-1.5">
            <button
              onClick={handlePrevStudent}
              disabled={currentStudentIndex <= 0}
              className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition"
              title="পূর্ববর্তী শিক্ষার্থী"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-slate-500 font-mono">
              {toBengaliNumber(currentStudentIndex + 1)} / {toBengaliNumber(filteredStudents.length)}
            </span>
            <button
              onClick={handleNextStudent}
              disabled={currentStudentIndex >= filteredStudents.length - 1}
              className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition"
              title="পরবর্তী শিক্ষার্থী"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Dropdown Picker */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-600 hidden sm:inline">নির্বাচিত শিক্ষার্থী:</span>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="px-3 py-1.5 text-xs bg-indigo-50 border border-indigo-200 rounded-lg font-bold text-indigo-950 focus:ring-1 focus:ring-indigo-500 focus:outline-none max-w-xs truncate"
            >
              {filteredStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  রোল {toBengaliRoll(s.roll)} - {s.nameBn} ({classes.find((c) => c.id === s.classId)?.nameBn || s.classId})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {!currentStudent ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700">কোনো শিক্ষার্থী পাওয়া যায়নি</h3>
          <p className="text-xs text-slate-500 mt-1">
            অনুগ্রহ করে উপরের ফিল্টারে শ্রেণি বা নাম পরিবর্তন করে শিক্ষার্থী নির্বাচন করুন।
          </p>
        </div>
      ) : (
        <>
          {/* Student Profile Card & Financial Balance KPI Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Student Profile Card */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-700 to-indigo-900 text-white font-bold text-lg flex items-center justify-center font-serif shadow-sm">
                      {currentStudent.nameBn.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-slate-900 font-serif leading-tight">
                        {currentStudent.nameBn}
                      </h3>
                      {currentStudent.nameEn && (
                        <p className="text-[11px] text-slate-500">{currentStudent.nameEn}</p>
                      )}
                      <span className="inline-block mt-1 px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 font-mono">
                        রোল: {toBengaliRoll(currentStudent.roll)}
                      </span>
                    </div>
                  </div>

                  {/* Payment status badge */}
                  <div>
                    {totalDue === 0 && totalBilled > 0 ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> পরিশোধিত
                      </span>
                    ) : totalPaid > 0 && totalDue > 0 ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        <Clock className="w-3.5 h-3.5 mr-1" /> আংশিক পরিশোধ
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                        <AlertCircle className="w-3.5 h-3.5 mr-1" /> অপরিশোধিত
                      </span>
                    )}
                  </div>
                </div>

                {/* Details info */}
                <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                  <div className="flex justify-between py-0.5 border-b border-slate-50">
                    <span className="text-slate-400">শ্রেণি ও শাখা:</span>
                    <span className="font-bold text-slate-800">
                      {studentClassName} ({currentStudent.section} শাখা)
                    </span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-slate-50">
                    <span className="text-slate-400">শিক্ষাবর্ষ:</span>
                    <span className="font-mono text-slate-800">{currentStudent.academicYear}</span>
                  </div>
                  {currentStudent.fatherName && (
                    <div className="flex justify-between py-0.5 border-b border-slate-50">
                      <span className="text-slate-400">পিতার নাম:</span>
                      <span className="text-slate-800">{currentStudent.fatherName}</span>
                    </div>
                  )}
                  {currentStudent.motherName && (
                    <div className="flex justify-between py-0.5 border-b border-slate-50">
                      <span className="text-slate-400">মাতার নাম:</span>
                      <span className="text-slate-800">{currentStudent.motherName}</span>
                    </div>
                  )}
                  {currentStudent.guardianPhone && (
                    <div className="flex justify-between py-0.5 border-b border-slate-50">
                      <span className="text-slate-400">অভিভাবক ফোন:</span>
                      <span className="font-mono font-bold text-indigo-700">
                        {toBengaliNumber(currentStudent.guardianPhone)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4 pt-3 border-t border-slate-100">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500 font-medium">ফি পরিশোধের অগ্রগতি:</span>
                  <span className="font-bold font-mono text-indigo-900">
                    {toBengaliNumber(collectionPercentage)}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${
                      collectionPercentage === 100
                        ? 'bg-emerald-600'
                        : collectionPercentage > 50
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${collectionPercentage}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Financial Balance Summary Cards (2 Columns) */}
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Card 1: Total Invoiced */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      সর্বমোট প্রদেয় ফি (দাবি)
                    </span>
                    <span className="p-2 bg-blue-50 text-blue-700 rounded-lg">
                      <FileText className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="mt-3 flex items-baseline space-x-1">
                    <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono">
                      ৳ {toBengaliNumber(totalBilled)}
                    </span>
                    <span className="text-xs text-slate-500">/-</span>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>মোট বিল সংখ্যা:</span>
                  <span className="font-bold font-mono text-slate-800">
                    {toBengaliNumber(studentInvoices.length)} টি
                  </span>
                </div>
              </div>

              {/* Card 2: Total Paid */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      সর্বমোট পরিশোধিত (জমা)
                    </span>
                    <span className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
                      <CheckCircle2 className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="mt-3 flex items-baseline space-x-1">
                    <span className="text-2xl sm:text-3xl font-extrabold text-emerald-700 font-mono">
                      ৳ {toBengaliNumber(totalPaid)}
                    </span>
                    <span className="text-xs text-slate-500">/-</span>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>পরিশোধিত রসিদ:</span>
                  <span className="font-bold font-mono text-emerald-700">
                    {toBengaliNumber(studentReceipts.length)} টি
                  </span>
                </div>
              </div>

              {/* Card 3: Outstanding Due */}
              <div
                className={`rounded-2xl p-5 shadow-sm border flex flex-col justify-between ${
                  totalDue > 0
                    ? 'bg-rose-50/60 border-rose-200 text-rose-900'
                    : 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider">
                      বর্তমান অবশিষ্ট বকেয়া
                    </span>
                    <span
                      className={`p-2 rounded-lg ${
                        totalDue > 0 ? 'bg-rose-200 text-rose-800' : 'bg-emerald-200 text-emerald-800'
                      }`}
                    >
                      <AlertCircle className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="mt-3 flex items-baseline space-x-1">
                    <span
                      className={`text-2xl sm:text-3xl font-extrabold font-mono ${
                        totalDue > 0 ? 'text-rose-700' : 'text-emerald-700'
                      }`}
                    >
                      ৳ {toBengaliNumber(totalDue)}
                    </span>
                    <span className="text-xs">/-</span>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-current/20 flex items-center justify-between text-xs">
                  <span>হিসাব স্ট্যাটাস:</span>
                  <span className="font-bold">
                    {totalDue === 0 ? 'সম্পূর্ণ পরিশোধিত' : 'বকেয়া প্রযোজ্য'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Ledger Navigation Tabs */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-3 sm:p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50">
              <div className="flex space-x-1 bg-slate-200/70 p-1 rounded-xl">
                <button
                  onClick={() => setActiveLedgerTab('combined')}
                  className={`flex items-center px-4 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition ${
                    activeLedgerTab === 'combined'
                      ? 'bg-white text-indigo-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BookOpen className="w-4 h-4 mr-1.5 text-indigo-600" />
                  সম্মিলিত খতিয়ান লেজার ({toBengaliNumber(ledgerEntries.length)})
                </button>

                <button
                  onClick={() => setActiveLedgerTab('invoices')}
                  className={`flex items-center px-4 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition ${
                    activeLedgerTab === 'invoices'
                      ? 'bg-white text-indigo-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="w-4 h-4 mr-1.5 text-blue-600" />
                  সকল ইনভয়েস ও বিল ({toBengaliNumber(studentInvoices.length)})
                </button>

                <button
                  onClick={() => setActiveLedgerTab('receipts')}
                  className={`flex items-center px-4 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition ${
                    activeLedgerTab === 'receipts'
                      ? 'bg-white text-indigo-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Receipt className="w-4 h-4 mr-1.5 text-emerald-600" />
                  পরিশোধের মানি রিসিট ({toBengaliNumber(studentReceipts.length)})
                </button>
              </div>

              {/* Subtotal note */}
              <div className="text-xs font-semibold text-slate-600">
                শিক্ষার্থী: <strong className="text-slate-900">{currentStudent.nameBn}</strong> (রোল: {toBengaliRoll(currentStudent.roll)})
              </div>
            </div>

            {/* TAB 1: COMBINED CHRONOLOGICAL LEDGER */}
            {activeLedgerTab === 'combined' && (
              <div className="p-4 sm:p-6">
                {ledgerEntries.length === 0 ? (
                  <div className="text-center py-10 text-slate-400">
                    এই শিক্ষার্থীর জন্য এখনো কোনো ইনভয়েস বা পেমেন্ট রেকর্ড নেই।
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 text-[11px] uppercase tracking-wider">
                          <th className="py-2.5 px-3 text-center w-10">ক্র.</th>
                          <th className="py-2.5 px-3">তারিখ</th>
                          <th className="py-2.5 px-3">ভাউচার / রসিদ নং</th>
                          <th className="py-2.5 px-3">বিবরণ ও ফি খাত</th>
                          <th className="py-2.5 px-3 text-center">লেনদেনের ধরন</th>
                          <th className="py-2.5 px-3 text-right">দাবি / ধার্য (Debit)</th>
                          <th className="py-2.5 px-3 text-right">আদায় / জমা (Credit)</th>
                          <th className="py-2.5 px-3 text-right font-bold">অবশিষ্ট জের (Balance)</th>
                          <th className="py-2.5 px-3 text-center">অ্যাকশন</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {ledgerEntries.map((entry, idx) => (
                          <tr
                            key={entry.id}
                            className={`hover:bg-slate-50 transition duration-150 ${
                              entry.type === 'invoice' ? 'bg-white' : 'bg-emerald-50/20'
                            }`}
                          >
                            <td className="py-2.5 px-3 text-center font-mono text-slate-500">
                              {toBengaliNumber(idx + 1)}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-700 whitespace-nowrap">
                              {toBengaliNumber(entry.date)}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                              {entry.voucherNo}
                            </td>
                            <td className="py-2.5 px-3 max-w-sm">
                              <div className="font-bold text-slate-900">{entry.title}</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">{entry.particulars}</div>
                              {entry.method && (
                                <div className="text-[10px] text-indigo-700 font-medium mt-0.5">
                                  মাধ্যম: {entry.method} {entry.collector ? `(${entry.collector})` : ''}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              {entry.type === 'invoice' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                                  <ArrowDownRight className="w-3 h-3 mr-0.5 text-blue-600" />
                                  বিল ধার্য (দাবি)
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  <ArrowUpRight className="w-3 h-3 mr-0.5 text-emerald-600" />
                                  ফি আদায় (জমা)
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-800 font-semibold whitespace-nowrap">
                              {entry.debit > 0 ? `৳ ${toBengaliNumber(entry.debit)}` : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-bold whitespace-nowrap">
                              {entry.credit > 0 ? `৳ ${toBengaliNumber(entry.credit)}` : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap">
                              <span
                                className={
                                  entry.balance > 0 ? 'text-rose-600 font-bold' : 'text-emerald-700'
                                }
                              >
                                ৳ {toBengaliNumber(entry.balance)}/-
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              {entry.type === 'invoice' && entry.rawInvoice && onOpenDueSlip && (
                                <button
                                  onClick={() => onOpenDueSlip(currentStudent, entry.rawInvoice)}
                                  className="inline-flex items-center px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold border border-slate-300 transition"
                                  title="ডিউ স্লিপ প্রিন্ট"
                                >
                                  <Printer className="w-3 h-3 mr-1" />
                                  ডিউ স্লিপ
                                </button>
                              )}
                              {entry.type === 'payment' && entry.rawReceipt && onOpenOfficialVoucher && (
                                <button
                                  onClick={() =>
                                    onOpenOfficialVoucher({
                                      student: currentStudent,
                                      receipt: entry.rawReceipt,
                                      voucherType: 'money_receipt',
                                    })
                                  }
                                  className="inline-flex items-center px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold border border-indigo-200 transition"
                                  title="অফিশিয়াল ৮-খাত মানি রিসিট প্রিন্ট"
                                >
                                  <Printer className="w-3 h-3 mr-1" />
                                  মানি রিসিট
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      {/* Footer Totals */}
                      <tfoot>
                        <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                          <td colSpan={5} className="py-3 px-3 text-right text-xs">
                            সর্বমোট খতিয়ান জের:
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-950">
                            ৳ {toBengaliNumber(totalBilled)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-emerald-700">
                            ৳ {toBengaliNumber(totalPaid)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-rose-700 text-sm">
                            ৳ {toBengaliNumber(totalDue)}/-
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: INVOICES BREAKDOWN */}
            {activeLedgerTab === 'invoices' && (
              <div className="p-4 sm:p-6 space-y-3">
                {studentInvoices.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">কোনো ইনভয়েস তৈরি করা হয়নি।</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 text-[11px] uppercase">
                          <th className="py-2.5 px-3">বিল নম্বর</th>
                          <th className="py-2.5 px-3">শিরোনাম ও বিবরণ</th>
                          <th className="py-2.5 px-3">বিল তৈরির তারিখ</th>
                          <th className="py-2.5 px-3">নির্ধারিত শেষ তারিখ</th>
                          <th className="py-2.5 px-3 text-right">মোট দাবি</th>
                          <th className="py-2.5 px-3 text-right">পরিশোধিত</th>
                          <th className="py-2.5 px-3 text-right">অবশিষ্ট বকেয়া</th>
                          <th className="py-2.5 px-3 text-center">অবস্থা</th>
                          <th className="py-2.5 px-3 text-center">অ্যাকশন</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {studentInvoices.map((inv) => (
                          <tr key={inv.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-mono font-bold text-indigo-900">
                              {inv.invoiceNumber}
                            </td>
                            <td className="py-2.5 px-3 max-w-xs">
                              <div className="font-bold text-slate-900">{inv.title}</div>
                              <div className="text-[11px] text-slate-500">
                                {inv.items.map((i) => `${i.nameBn}: ৳${toBengaliNumber(i.netAmount)}`).join(' • ')}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-600">
                              {toBengaliNumber(inv.createdAt)}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-600">
                              {toBengaliNumber(inv.dueDate)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                              ৳ {toBengaliNumber(inv.totalPayable)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-bold">
                              ৳ {toBengaliNumber(inv.paidAmount)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold">
                              <span className={inv.dueAmount > 0 ? 'text-rose-600' : 'text-emerald-700'}>
                                ৳ {toBengaliNumber(inv.dueAmount)}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {inv.status === 'paid' ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  পরিশোধিত
                                </span>
                              ) : inv.status === 'partial' ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                  আংশিক
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                                  অপরিশোধিত
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap space-x-1">
                              {onOpenDueSlip && (
                                <button
                                  onClick={() => onOpenDueSlip(currentStudent, inv)}
                                  className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-semibold text-[11px]"
                                >
                                  ডিউ স্লিপ
                                </button>
                              )}
                              {inv.dueAmount > 0 && onOpenPaymentModal && (
                                <button
                                  onClick={() => onOpenPaymentModal(currentStudent, inv)}
                                  className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px]"
                                >
                                  জমা নিন
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: RECEIPTS BREAKDOWN */}
            {activeLedgerTab === 'receipts' && (
              <div className="p-4 sm:p-6 space-y-3">
                {studentReceipts.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">কোনো ফি পরিশোধের রেকর্ড পাওয়া যায়নি।</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 text-[11px] uppercase">
                          <th className="py-2.5 px-3">রসিদ নম্বর</th>
                          <th className="py-2.5 px-3">পরিশোধের তারিখ</th>
                          <th className="py-2.5 px-3">আদায়কৃত খাতের বিবরণ</th>
                          <th className="py-2.5 px-3">পেমেন্ট মাধ্যম</th>
                          <th className="py-2.5 px-3">আদায়কারী</th>
                          <th className="py-2.5 px-3 text-right">আদায়কৃত টাকা</th>
                          <th className="py-2.5 px-3 text-right">তৎকালীন বকেয়া</th>
                          <th className="py-2.5 px-3 text-center">অ্যাকশন</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {studentReceipts.map((rec) => (
                          <tr key={rec.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-mono font-bold text-emerald-900">
                              {rec.receiptNumber}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-600">
                              {toBengaliNumber(rec.paymentDate)}
                            </td>
                            <td className="py-2.5 px-3 max-w-xs">
                              {rec.itemsBreakdown && rec.itemsBreakdown.length > 0 ? (
                                <div className="space-y-0.5">
                                  {rec.itemsBreakdown.map((it, idx) => (
                                    <span
                                      key={idx}
                                      className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] mr-1"
                                    >
                                      {it.nameBn}: ৳{toBengaliNumber(it.amount)}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-600">মাসিক বেতন ও বকেয়া ফি</span>
                              )}
                              {rec.notes && <div className="text-[10px] text-slate-400 mt-0.5">{rec.notes}</div>}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                                {rec.paymentMethod}
                              </span>
                              {rec.transactionRef && (
                                <div className="text-[9px] font-mono text-slate-400 mt-0.5">
                                  {rec.transactionRef}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">{rec.collectedBy}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 text-sm">
                              ৳ {toBengaliNumber(rec.paidAmount)}/-
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-xs">
                              {rec.remainingDue > 0 ? (
                                <span className="text-rose-600 font-bold">
                                  ৳ {toBengaliNumber(rec.remainingDue)}/-
                                </span>
                              ) : (
                                <span className="text-emerald-600 font-medium">০/- (পরিশোধিত)</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {onOpenOfficialVoucher && (
                                <button
                                  onClick={() =>
                                    onOpenOfficialVoucher({
                                      student: currentStudent,
                                      receipt: rec,
                                      voucherType: 'money_receipt',
                                    })
                                  }
                                  className="inline-flex items-center px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold border border-indigo-200 transition"
                                  title="অফিশিয়াল ৮-খাত মানি রিসিট প্রিন্ট"
                                >
                                  <Printer className="w-3.5 h-3.5 mr-1" />
                                  ভাউচার প্রিন্ট
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* PRINTABLE OFFICIAL STUDENT LEDGER STATEMENT (A4 Format)                   */}
      {/* ========================================================================= */}
      {isPrintStatementOpen && currentStudent && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[96vh] flex flex-col overflow-hidden">
            {/* Header (Hidden in print) */}
            <div className="no-print p-4 bg-indigo-950 text-white flex items-center justify-between border-b border-indigo-800">
              <div className="flex items-center space-x-2">
                <Printer className="w-5 h-5 text-amber-300" />
                <h3 className="font-bold text-base font-serif">
                  শিক্ষার্থী ফি ও বকেয়া হিসাব খতিয়ান (A4 স্টেটমেন্ট প্রিন্ট প্রিভিউ)
                </h3>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm flex items-center space-x-1 shadow"
                >
                  <Printer className="w-4 h-4 mr-1" />
                  <span>প্রিন্ট করুন</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintStatementOpen(false)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Statement Sheet */}
            <div className="p-6 overflow-y-auto printable-area bg-white text-slate-900 font-serif">
              {/* Institutional Header */}
              <div className="text-center pb-3 border-b-2 border-slate-900 mb-4">
                <div className="flex items-center justify-center space-x-3 mb-1">
                  <SchoolLogo customLogoUrl={schoolInfo.logoUrl} size={48} />
                  <h1 className="text-2xl font-extrabold tracking-wide text-slate-950">
                    {schoolInfo.name || 'ডি-লিকন মডেল একাডেমী'}
                  </h1>
                </div>
                <p className="text-xs text-slate-700">
                  {schoolInfo.address || 'দক্ষিণগাঁও, গণি মার্কেট, সনমানিয়া, কাপাসিয়া, গাজীপুর।'}
                  {schoolInfo.phone ? ` • মোবাইল: ${toBengaliNumber(schoolInfo.phone)}` : ''}
                </p>
                <div className="mt-2 inline-block px-4 py-1 border-2 border-slate-900 rounded font-bold text-sm bg-slate-100 uppercase tracking-wide">
                  শিক্ষার্থী ফি ও বকেয়া হিসাব খতিয়ান (Student Fee Ledger Statement)
                </div>
                <div className="mt-1 text-xs text-slate-600 font-sans">
                  রিপোর্ট প্রিন্টের তারিখ: {formatBengaliDate(new Date().toISOString().split('T')[0])}
                </div>
              </div>

              {/* Student Profile Info Grid */}
              <div className="p-3 border border-slate-400 rounded bg-slate-50 mb-4 text-xs font-sans grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <span className="text-slate-500">শিক্ষার্থীর নাম:</span>
                  <div className="font-bold text-slate-900 text-sm font-serif">{currentStudent.nameBn}</div>
                </div>
                <div>
                  <span className="text-slate-500">শ্রেণি ও শাখা:</span>
                  <div className="font-bold text-slate-900">
                    {studentClassName} ({currentStudent.section} শাখা)
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">রোল নম্বর:</span>
                  <div className="font-bold text-slate-900 font-mono text-sm">
                    {toBengaliRoll(currentStudent.roll)}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">শিক্ষাবর্ষ:</span>
                  <div className="font-bold text-slate-900 font-mono">{currentStudent.academicYear}</div>
                </div>
                <div>
                  <span className="text-slate-500">পিতার নাম:</span>
                  <div className="text-slate-900 font-medium">{currentStudent.fatherName || '-'}</div>
                </div>
                <div>
                  <span className="text-slate-500">মাতার নাম:</span>
                  <div className="text-slate-900 font-medium">{currentStudent.motherName || '-'}</div>
                </div>
                <div>
                  <span className="text-slate-500">অভিভাবকের ফোন:</span>
                  <div className="text-slate-900 font-mono font-bold">
                    {currentStudent.guardianPhone ? toBengaliNumber(currentStudent.guardianPhone) : '-'}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">বর্তমান স্ট্যাটাস:</span>
                  <div className="font-bold">
                    {totalDue === 0 ? 'পরিশোধিত (০ বকেয়া)' : `বকেয়া: ৳ ${toBengaliNumber(totalDue)}/-`}
                  </div>
                </div>
              </div>

              {/* Financial KPI Summary Table in Print */}
              <div className="grid grid-cols-3 gap-2 mb-4 text-xs font-sans">
                <div className="p-2 border border-slate-400 rounded text-center bg-slate-50">
                  <div className="text-slate-600 text-[11px]">সর্বমোট প্রদেয় বিল (দাবি)</div>
                  <div className="font-bold font-mono text-slate-950 text-sm">
                    ৳ {toBengaliNumber(totalBilled)}/-
                  </div>
                </div>
                <div className="p-2 border border-slate-400 rounded text-center bg-slate-50">
                  <div className="text-slate-600 text-[11px]">সর্বমোট পরিশোধিত (জমা)</div>
                  <div className="font-bold font-mono text-slate-950 text-sm">
                    ৳ {toBengaliNumber(totalPaid)}/-
                  </div>
                </div>
                <div className="p-2 border border-slate-400 rounded text-center bg-slate-50">
                  <div className="text-slate-600 text-[11px]">বর্তমান মোট বকেয়া (জের)</div>
                  <div className="font-bold font-mono text-slate-950 text-sm">
                    ৳ {toBengaliNumber(totalDue)}/-
                  </div>
                </div>
              </div>

              {/* Chronological Ledger Table */}
              <div className="mb-6">
                <div className="text-xs font-bold uppercase mb-1 border-b border-slate-300 pb-0.5">
                  আর্থিক লেনদেন ও জের বিবরণী (Chronological Account Transactions):
                </div>
                <table className="w-full text-xs border border-slate-800 border-collapse font-sans">
                  <thead>
                    <tr className="bg-slate-100 font-bold border-b border-slate-800 text-[11px]">
                      <th className="p-1 border-r border-slate-800 text-center w-8">ক্র.</th>
                      <th className="p-1 border-r border-slate-800 text-center w-20">তারিখ</th>
                      <th className="p-1 border-r border-slate-800 text-left w-24">ভাউচার নং</th>
                      <th className="p-1 border-r border-slate-800 text-left">বিবরণ / খাত</th>
                      <th className="p-1 border-r border-slate-800 text-right w-20">দাবি (৳)</th>
                      <th className="p-1 border-r border-slate-800 text-right w-20">জমা (৳)</th>
                      <th className="p-1 border-slate-800 text-right w-24">অবশিষ্ট জের (৳)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerEntries.map((entry, i) => (
                      <tr key={entry.id} className="border-b border-slate-300">
                        <td className="p-1 border-r border-slate-800 text-center font-mono">
                          {toBengaliNumber(i + 1)}
                        </td>
                        <td className="p-1 border-r border-slate-800 text-center font-mono">
                          {toBengaliNumber(entry.date)}
                        </td>
                        <td className="p-1 border-r border-slate-800 font-mono font-bold">
                          {entry.voucherNo}
                        </td>
                        <td className="p-1 border-r border-slate-800">
                          <div className="font-medium">{entry.title}</div>
                          <div className="text-[10px] text-slate-500">{entry.particulars}</div>
                        </td>
                        <td className="p-1 border-r border-slate-800 text-right font-mono">
                          {entry.debit > 0 ? toBengaliNumber(entry.debit) : '-'}
                        </td>
                        <td className="p-1 border-r border-slate-800 text-right font-mono font-bold">
                          {entry.credit > 0 ? toBengaliNumber(entry.credit) : '-'}
                        </td>
                        <td className="p-1 border-slate-800 text-right font-mono font-bold">
                          {toBengaliNumber(entry.balance)}/-
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-100 font-bold border-t-2 border-slate-800">
                      <td colSpan={4} className="p-1 text-right border-r border-slate-800">
                        সর্বমোট হিসাব সমাপনী =
                      </td>
                      <td className="p-1 text-right font-mono border-r border-slate-800">
                        ৳ {toBengaliNumber(totalBilled)}
                      </td>
                      <td className="p-1 text-right font-mono border-r border-slate-800">
                        ৳ {toBengaliNumber(totalPaid)}
                      </td>
                      <td className="p-1 text-right font-mono text-slate-950">
                        ৳ {toBengaliNumber(totalDue)}/-
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Amount in Words */}
                <div className="mt-2 text-xs font-serif">
                  <span className="font-bold">কথায় (বর্তমান বকেয়া): </span>
                  <span className="italic underline">
                    {totalDue > 0 ? numberToBengaliWords(totalDue) : 'কোনো বকেয়া নেই (সম্পূর্ণ পরিশোধিত)'}
                  </span>
                </div>
              </div>

              {/* Signature Block */}
              <div className="pt-12 grid grid-cols-3 gap-6 text-center text-xs font-serif border-t border-slate-300 mt-8">
                <div>
                  <div className="border-t border-slate-800 pt-1.5 w-3/4 mx-auto font-bold text-slate-900">
                    আদায়কারী / হিসাব সহকারী
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">স্বাক্ষর ও তারিখ</div>
                </div>

                <div>
                  <div className="border-t border-slate-800 pt-1.5 w-3/4 mx-auto font-bold text-slate-900">
                    প্রধান হিসাবরক্ষক
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">স্বাক্ষর ও সিল</div>
                </div>

                <div>
                  <div className="border-t border-slate-800 pt-1.5 w-3/4 mx-auto font-bold text-slate-900">
                    অধ্যক্ষ / প্রধান শিক্ষক
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">ডি-লিকন মডেল একাডেমী</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
