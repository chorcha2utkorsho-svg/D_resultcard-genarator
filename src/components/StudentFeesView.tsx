import React, { useState, useMemo } from 'react';
import {
  CreditCard,
  Receipt,
  FileText,
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  Printer,
  PlusCircle,
  Search,
  Filter,
  MessageSquare,
  ArrowRight,
  Send,
  Calendar,
  Layers,
  Sparkles,
  Download,
  Trash2,
  Check,
  Percent,
  History,
  ShieldAlert,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import {
  FeeInvoice,
  PaymentRecord,
  FeeHead,
  Student,
  PaymentMethod,
  FeeInvoiceStatus,
  StudentFeeBillItem,
} from '../types';
import { toBengaliNumber, toBengaliRoll } from '../utils/bengali';
import { PrintableDueSlip } from './PrintableDueSlip';
import { PrintableMoneyReceipt } from './PrintableMoneyReceipt';
import { PrintableOfficialVoucher } from './PrintableOfficialVoucher';
import { BatchPrintableVouchers } from './BatchPrintableVouchers';
import { StudentPaymentHistoryView } from './StudentPaymentHistoryView';
import { DefaulterListView } from './DefaulterListView';

interface StudentFeesViewProps {
  onNavigateToTab?: (tab: string) => void;
}

export const StudentFeesView: React.FC<StudentFeesViewProps> = ({ onNavigateToTab }) => {
  const {
    schoolInfo,
    classes,
    students,
    selectedYear,
    setSelectedYear,
    selectedClassId,
    setSelectedClassId,
    selectedSection,
    setSelectedSection,
    feeHeads,
    updateFeeHeads,
    feeInvoices,
    createFeeInvoice,
    deleteFeeInvoice,
    generateClassMonthlyBill,
    feeReceipts,
    collectFeePayment,
    deletePaymentReceipt,
    getStudentDueSummary,
    sendSingleSMS,
  } = useSchool();

  // Active view tab
  const [activeTab, setActiveTab] = useState<'students_due' | 'invoices' | 'receipts' | 'fee_heads' | 'payment_history' | 'defaulters'>('students_due');
  const [historyStudentId, setHistoryStudentId] = useState<string | undefined>(undefined);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'due' | 'partial' | 'paid'>('all');

  // Modals state
  const [payModalStudent, setPayModalStudent] = useState<Student | null>(null);
  const [payModalInvoice, setPayModalInvoice] = useState<FeeInvoice | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('নগদ');
  const [transactionRef, setTransactionRef] = useState('');
  const [collectedBy, setCollectedBy] = useState('হিসাব সহকারী');
  const [payNotes, setPayNotes] = useState('');

  // Printable modals
  const [viewingDueSlip, setViewingDueSlip] = useState<{ student: Student; invoice: FeeInvoice } | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<PaymentRecord | null>(null);
  const [viewingOfficialVoucher, setViewingOfficialVoucher] = useState<{
    student: Student;
    invoice?: FeeInvoice;
    receipt?: PaymentRecord;
    voucherType: 'due_slip' | 'money_receipt';
  } | null>(null);
  const [isBatchPrintingDueSlips, setIsBatchPrintingDueSlips] = useState(false);
  const [batchPrintIsBlank, setBatchPrintIsBlank] = useState(true);

  // Bill Generation Modal
  const [isGeneratingBills, setIsGeneratingBills] = useState(false);
  const [billGenClassId, setBillGenClassId] = useState(selectedClassId);
  const [billGenSection, setBillGenSection] = useState(selectedSection || 'সকল');
  const [billGenMonth, setBillGenMonth] = useState('নভেম্বর ২০২৬');
  const [billGenTitle, setBillGenTitle] = useState('নভেম্বর ২০২৬ মাসিক বেতন ও পরীক্ষার ফি বিল');
  const [billGenDueDate, setBillGenDueDate] = useState('2026-11-20');
  const [billGenFine, setBillGenFine] = useState(0);
  const [billGenSelectedHeads, setBillGenSelectedHeads] = useState<string[]>([
    'fh_tuition',
    'fh_midterm',
    'fh_electricity',
  ]);

  // SMS Modal
  const [smsModalStudent, setSmsModalStudent] = useState<{ student: Student; dueAmount: number } | null>(null);
  const [smsFeedback, setSmsFeedback] = useState<string | null>(null);

  // New Fee Head Modal
  const [isAddingHead, setIsAddingHead] = useState(false);
  const [newHeadName, setNewHeadName] = useState('');
  const [newHeadAmount, setNewHeadAmount] = useState<number>(300);
  const [newHeadIsMonthly, setNewHeadIsMonthly] = useState(false);

  // Filter students based on selection
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

  // Aggregate student dues summary
  const studentDueOverviews = useMemo(() => {
    return filteredStudents.map((student) => {
      const summary = getStudentDueSummary(student.id);
      return {
        student,
        totalBilled: summary ? summary.totalBilled : 0,
        totalPaid: summary ? summary.totalPaid : 0,
        totalDue: summary ? summary.totalDue : 0,
        status: summary ? summary.status : 'paid',
        invoices: summary ? summary.invoices : [],
        receipts: summary ? summary.receipts : [],
        lastPaymentDate: summary ? summary.lastPaymentDate : undefined,
      };
    }).filter((item) => {
      if (statusFilter === 'due') return item.totalDue > 0;
      if (statusFilter === 'partial') return item.status === 'partial';
      if (statusFilter === 'paid') return item.totalDue === 0 && item.totalBilled > 0;
      return true;
    });
  }, [filteredStudents, getStudentDueSummary, statusFilter]);

  // Overall KPI Cards
  const kpis = useMemo(() => {
    const relevantInvoices = selectedClassId === 'all'
      ? feeInvoices
      : feeInvoices.filter((inv) => {
          const matchCls = inv.classId === selectedClassId;
          const matchSec = selectedSection === 'all' || !selectedSection || inv.section === selectedSection;
          return matchCls && matchSec;
        });

    const totalBilled = relevantInvoices.reduce((sum, inv) => sum + (inv.totalPayable || 0), 0);
    const totalCollected = relevantInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
    const totalDue = relevantInvoices.reduce((sum, inv) => sum + (inv.dueAmount || 0), 0);
    const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 100;

    const dueStudentsSet = new Set(
      relevantInvoices.filter((inv) => inv.dueAmount > 0).map((inv) => inv.studentId)
    );

    return {
      totalBilled,
      totalCollected,
      totalDue,
      collectionRate,
      dueStudentCount: dueStudentsSet.size,
      totalInvoices: relevantInvoices.length,
    };
  }, [feeInvoices, selectedClassId, selectedSection]);

  // Quick Open Pay Modal for a student
  const openPaymentModal = (student: Student, invoice?: FeeInvoice) => {
    setPayModalStudent(student);
    const studentInvoices = feeInvoices.filter((inv) => inv.studentId === student.id);
    const currentInvoice = invoice || studentInvoices.find((inv) => inv.dueAmount > 0) || studentInvoices[0] || null;
    setPayModalInvoice(currentInvoice);

    const totalDue = studentInvoices.reduce((sum, inv) => sum + (inv.dueAmount || 0), 0);
    setPayAmount(currentInvoice ? currentInvoice.dueAmount : totalDue);
    setPaymentMethod('নগদ');
    setTransactionRef('');
    setPayNotes('');
  };

  // Submit Payment with instant deduction
  const handleExecutePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payModalStudent) return;
    if (payAmount <= 0) {
      alert('অনুগ্রহ করে সঠিক টাকার পরিমাণ দিন');
      return;
    }

    try {
      const receipt = collectFeePayment({
        studentId: payModalStudent.id,
        invoiceId: payModalInvoice?.id,
        paidAmount: payAmount,
        paymentMethod,
        transactionRef: transactionRef.trim() || undefined,
        collectedBy,
        notes: payNotes.trim() || undefined,
        itemsBreakdown: payModalInvoice
          ? [
              {
                nameBn: `${payModalInvoice.title || payModalInvoice.billMonthYear} (আদায়)`,
                amount: payAmount,
              },
            ]
          : [{ nameBn: 'মাসিক বেতন ও বকেয়া ফি আদায়', amount: payAmount }],
      });

      // Close pay modal and immediately open Money Receipt for printing!
      setPayModalStudent(null);
      setPayModalInvoice(null);
      setViewingReceipt(receipt);
    } catch (err: any) {
      alert(`পেমেন্ট সম্পন্ন করতে সমস্যা হয়েছে: ${err.message}`);
    }
  };

  // Handle Generate Monthly Bills
  const handleBatchGenerateBills = (e: React.FormEvent) => {
    e.preventDefault();
    if (billGenSelectedHeads.length === 0) {
      alert('কমপক্ষে একটি ফি খাত নির্বাচন করুন');
      return;
    }

    const res = generateClassMonthlyBill({
      classId: billGenClassId,
      section: billGenSection === 'সকল' ? undefined : billGenSection,
      academicYear: selectedYear,
      title: billGenTitle,
      billMonthYear: billGenMonth,
      headIds: billGenSelectedHeads,
      dueDate: billGenDueDate,
      customFine: billGenFine > 0 ? billGenFine : undefined,
    });

    setIsGeneratingBills(false);
    alert(`সফলভাবে ${res.createdCount} জন শিক্ষার্থীর জন্য নতুন বিল তৈরি করা হয়েছে!`);
  };

  // Quick Open Official 8-Head Due Slip Voucher (A4 with 2 A5 copies)
  const openDueSlip = (student: Student, invoice?: FeeInvoice) => {
    const studentInvs = feeInvoices.filter((inv) => inv.studentId === student.id);
    const targetInv = invoice || studentInvs.find((inv) => inv.dueAmount > 0) || studentInvs[0];
    setViewingOfficialVoucher({
      student,
      invoice: targetInv,
      voucherType: 'due_slip',
    });
  };

  // Open Latest Official Money Receipt Voucher
  const openLatestReceipt = (student: Student, receiptRecord?: PaymentRecord) => {
    const studentReceipts = feeReceipts.filter((r) => r.studentId === student.id);
    const targetReceipt = receiptRecord || studentReceipts[0];
    const studentInvs = feeInvoices.filter((inv) => inv.studentId === student.id);
    setViewingOfficialVoucher({
      student,
      receipt: targetReceipt,
      invoice: studentInvs[0],
      voucherType: 'money_receipt',
    });
  };

  // Open Student Payment History View
  const openStudentPaymentHistory = (student: Student) => {
    setHistoryStudentId(student.id);
    setActiveTab('payment_history');
  };

  // Send Due Notice SMS
  const handleSendDueSMS = async () => {
    if (!smsModalStudent || !smsModalStudent.student.guardianPhone) {
      alert('অভিভাবকের মোবাইল নম্বর পাওয়া যায়নি');
      return;
    }

    const std = smsModalStudent.student;
    const clsName = classes.find((c) => c.id === std.classId)?.nameBn || std.classId;
    const msg = `ডি-লিকন মডেল একাডেমী: প্রিয় অভিভাবক, আপনার সন্তান ${std.nameBn} (রোল: ${toBengaliRoll(std.roll)}, ${clsName}), শিক্ষাবর্ষ ${toBengaliNumber(selectedYear)}-এ মোট বকেয়া ৳ ${toBengaliNumber(smsModalStudent.dueAmount)}/- টাকা। দ্রুত বকেয়া পরিশোধ করে রসিদ সংগ্রহ করার অনুরোধ করা হলো। - প্রধান শিক্ষক।`;

    const res = await sendSingleSMS(
      std.guardianPhone!,
      msg,
      `${std.nameBn} (অভিভাবক)`,
      {
        roll: std.roll,
        className: clsName,
        messageType: 'fees',
        channel: 'device_sms',
      }
    );

    setSmsFeedback(res.message);
    setTimeout(() => {
      setSmsFeedback(null);
      setSmsModalStudent(null);
    }, 2000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner / Title */}
      <div className="no-print bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 sm:p-6 shadow-xl border border-indigo-900/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 bg-amber-500/20 text-amber-400 rounded-lg border border-amber-400/30">
              <CreditCard className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold font-serif text-white flex items-center gap-2">
                সকল শিক্ষার্থীর বকেয়া ও ফি আদায় ব্যবস্থাপনা
              </h1>
              <p className="text-xs sm:text-sm text-indigo-200">
                তাৎক্ষণিক বকেয়া কর্তন • অফিশিয়াল মানি রিসিট প্রদান • ডিউ স্লিপ প্রিন্ট ও হিসাব সংরক্ষণ
              </p>
            </div>
          </div>
        </div>

        {/* Global Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {onNavigateToTab && (
            <button
              onClick={() => onNavigateToTab('daily_report')}
              className="inline-flex items-center px-3.5 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm"
              title="আজকের এবং যেকোনো তারিখের ফি আদায় ও খতিয়ান দেখুন"
            >
              <Receipt className="w-4 h-4 mr-1.5" />
              দৈনিক আদায় ও খতিয়ান রিপোর্ট
            </button>
          )}
          <button
            onClick={() => setActiveTab('defaulters')}
            className="inline-flex items-center px-3.5 py-2 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition shadow-sm"
            title="৩০ দিনের অধিক সময়ের বকেয়াদার ও খেলাপি তালিকা দেখুন"
          >
            <ShieldAlert className="w-4 h-4 mr-1.5" />
            খেলাপি তালিকা (৩০+ দিন)
          </button>
          <button
            onClick={() => {
              setBatchPrintIsBlank(true);
              setIsBatchPrintingDueSlips(true);
            }}
            className="inline-flex items-center px-3.5 py-2 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition shadow-sm cursor-pointer"
            title="বর্তমান শ্রেণির শিক্ষার্থীদের নাম ও রোলসহ হাতে লেখার ব্ল্যাঙ্ক মানি রিসিট প্রস্তুত করুন"
          >
            <Printer className="w-4 h-4 mr-1.5" />
            পুরো শ্রেণির ব্ল্যাঙ্ক মানি রিসিট (হাতে লেখার জন্য)
          </button>
          <button
            onClick={() => {
              setBatchPrintIsBlank(false);
              setIsBatchPrintingDueSlips(true);
            }}
            className="inline-flex items-center px-3.5 py-2 rounded-lg text-xs font-bold bg-indigo-700 hover:bg-indigo-600 text-white border border-indigo-500 transition shadow-sm cursor-pointer"
            title="ধার্যকৃত বকেয়াসহ পুরো ক্লাসের ডিউ স্লিপ প্রিন্ট"
          >
            <FileText className="w-4 h-4 mr-1.5 text-amber-300" />
            ধার্যকৃত ডিউ স্লিপ
          </button>
          <button
            onClick={() => setIsGeneratingBills(true)}
            className="inline-flex items-center px-3.5 py-2 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition shadow-sm cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 mr-1.5" />
            নতুন বিল তৈরি
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="no-print grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Billed */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">সর্বমোট প্রদেয় ফি (দাবি)</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-bold font-mono text-slate-900">
              ৳ {toBengaliNumber(kpis.totalBilled)}
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              {toBengaliNumber(kpis.totalInvoices)}টি ইনভয়েস
            </span>
          </div>
        </div>

        {/* Card 2: Total Collected */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">মোট আদায়কৃত অর্থ (জমা)</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-bold font-mono text-emerald-700">
              ৳ {toBengaliNumber(kpis.totalCollected)}
            </span>
            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
              আদায়: {toBengaliNumber(kpis.collectionRate)}%
            </span>
          </div>
        </div>

        {/* Card 3: Total Outstanding Due */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">মোট বকেয়া টাকা</span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-bold font-mono text-rose-600">
              ৳ {toBengaliNumber(kpis.totalDue)}
            </span>
            <span className="text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
              বকেয়া রয়েছে
            </span>
          </div>
        </div>

        {/* Card 4: Due Students Count */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">বকেয়াদার শিক্ষার্থী</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-bold font-mono text-amber-900">
              {toBengaliNumber(kpis.dueStudentCount)} <span className="text-sm font-normal">জন</span>
            </span>
            <span className="text-[11px] text-slate-500">
              মোট {toBengaliNumber(filteredStudents.length)} জনে
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="no-print bg-white p-1.5 rounded-xl border border-slate-200 shadow-xs flex flex-wrap gap-1">
        <button
          onClick={() => setActiveTab('students_due')}
          className={`flex-1 min-w-[140px] px-3 py-2 rounded-lg text-xs sm:text-sm font-bold transition flex items-center justify-center space-x-1.5 ${
            activeTab === 'students_due'
              ? 'bg-indigo-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>শিক্ষার্থীদের বকেয়া তালিকা</span>
        </button>
        <button
          onClick={() => setActiveTab('invoices')}
          className={`flex-1 min-w-[140px] px-3 py-2 rounded-lg text-xs sm:text-sm font-bold transition flex items-center justify-center space-x-1.5 ${
            activeTab === 'invoices'
              ? 'bg-indigo-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>বিল ও ইনভয়েস খতিয়ান ({toBengaliNumber(feeInvoices.length)})</span>
        </button>
        <button
          onClick={() => setActiveTab('receipts')}
          className={`flex-1 min-w-[140px] px-3 py-2 rounded-lg text-xs sm:text-sm font-bold transition flex items-center justify-center space-x-1.5 ${
            activeTab === 'receipts'
              ? 'bg-indigo-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>আদায়কৃত মানি রিসিট ({toBengaliNumber(feeReceipts.length)})</span>
        </button>
        <button
          onClick={() => setActiveTab('payment_history')}
          className={`flex-1 min-w-[140px] px-3 py-2 rounded-lg text-xs sm:text-sm font-bold transition flex items-center justify-center space-x-1.5 ${
            activeTab === 'payment_history'
              ? 'bg-indigo-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <History className="w-4 h-4" />
          <span>পেমেন্ট হিস্ট্রি ও লেজার</span>
        </button>
        <button
          onClick={() => setActiveTab('defaulters')}
          className={`flex-1 min-w-[140px] px-3 py-2 rounded-lg text-xs sm:text-sm font-bold transition flex items-center justify-center space-x-1.5 ${
            activeTab === 'defaulters'
              ? 'bg-rose-900 text-white shadow-sm'
              : 'text-rose-700 hover:bg-rose-50 hover:text-rose-900'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>খেলাপি তালিকা (৩০+ দিন)</span>
        </button>
        <button
          onClick={() => setActiveTab('fee_heads')}
          className={`flex-1 min-w-[140px] px-3 py-2 rounded-lg text-xs sm:text-sm font-bold transition flex items-center justify-center space-x-1.5 ${
            activeTab === 'fee_heads'
              ? 'bg-indigo-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>ফি কাঠামো সেটিংস</span>
        </button>
      </div>

      {/* Main Filter Bar */}
      <div className="no-print bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Class, Section, Year Filters */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Year */}
            <div className="flex items-center space-x-1">
              <span className="text-slate-500 font-medium">বছর:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="২০২৫">২০২৫</option>
                <option value="২০২৬">২০২৬</option>
                <option value="২০২৭">২০২৭</option>
              </select>
            </div>

            {/* Class */}
            <div className="flex items-center space-x-1">
              <span className="text-slate-500 font-medium">শ্রেণি:</span>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">সকল শ্রেণি</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameBn}
                  </option>
                ))}
              </select>
            </div>

            {/* Section */}
            <div className="flex items-center space-x-1">
              <span className="text-slate-500 font-medium">শাখা:</span>
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">সকল শাখা</option>
                <option value="ক">ক শাখা</option>
                <option value="খ">খ শাখা</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center space-x-1">
              <span className="text-slate-500 font-medium">অবস্থা:</span>
              <select
                value={statusFilter}
                onChange={(e: any) => setStatusFilter(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">সকল অবস্থা</option>
                <option value="due">বকেয়া রয়েছে (Due)</option>
                <option value="partial">আংশিক পরিশোধিত (Partial)</option>
                <option value="paid">সম্পূর্ণ পরিশোধিত (Paid)</option>
              </select>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="নাম বা রোল দিয়ে খুঁজুন..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
            />
          </div>
        </div>
      </div>

      {/* TAB 1: STUDENTS DUE & LEDGER */}
      {activeTab === 'students_due' && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div>
              <h2 className="font-bold text-slate-800 text-sm sm:text-base">
                শিক্ষার্থীদের বকেয়া খতিয়ান ও রসিদ ব্যবস্থাপনা
              </h2>
              <p className="text-xs text-slate-500">
                যেকোনো শিক্ষার্থীর &apos;ফি জমা নিন&apos; চাপলে তাৎক্ষণিক বকেয়া কেটে আপডেট হবে এবং অফিশিয়াল মানি রিসিট প্রস্তুত হবে
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
              মোট শিক্ষার্থী: {toBengaliNumber(studentDueOverviews.length)} জন
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 text-slate-700 uppercase tracking-wider font-semibold border-b border-slate-200">
                  <th className="px-3 py-3 w-12 text-center">রোল</th>
                  <th className="px-3 py-3">শিক্ষার্থীর নাম</th>
                  <th className="px-3 py-3">শ্রেণি ও শাখা</th>
                  <th className="px-3 py-3">অভিভাবক ফোন</th>
                  <th className="px-3 py-3 text-right">মোট ধার্য</th>
                  <th className="px-3 py-3 text-right">পরিশোধিত</th>
                  <th className="px-3 py-3 text-right font-bold">অবশিষ্ট বকেয়া</th>
                  <th className="px-3 py-3 text-center">অবস্থা</th>
                  <th className="px-3 py-3 text-right w-64">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {studentDueOverviews.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      কোনো শিক্ষার্থীর তথ্য পাওয়া যায়নি। ফিল্টার পরিবর্তন করে পুনরায় চেষ্টা করুন।
                    </td>
                  </tr>
                ) : (
                  studentDueOverviews.map(({ student, totalBilled, totalPaid, totalDue, status, invoices, receipts }) => {
                    const clsName = classes.find((c) => c.id === student.classId)?.nameBn || student.classId;
                    return (
                      <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-3 py-3 text-center font-bold text-indigo-950 font-mono">
                          {toBengaliRoll(student.roll)}
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-bold text-slate-900">{student.nameBn}</div>
                          {student.nameEn && <div className="text-[10px] text-slate-400">{student.nameEn}</div>}
                        </td>
                        <td className="px-3 py-3 text-slate-700">
                          {clsName} ({student.section} শাখা)
                        </td>
                        <td className="px-3 py-3 font-mono text-slate-600">
                          {student.guardianPhone ? toBengaliNumber(student.guardianPhone) : '-'}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-slate-700">
                          ৳ {toBengaliNumber(totalBilled)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-medium text-emerald-700">
                          ৳ {toBengaliNumber(totalPaid)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-bold">
                          <span
                            className={
                              totalDue > 0
                                ? 'text-rose-600 font-bold px-1.5 py-0.5 rounded bg-rose-50'
                                : 'text-emerald-700 font-semibold'
                            }
                          >
                            ৳ {toBengaliNumber(totalDue)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          {totalDue === 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> পরিশোধিত
                            </span>
                          ) : status === 'partial' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              <Clock className="w-3 h-3 mr-1" /> আংশিক
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                              <AlertCircle className="w-3 h-3 mr-1" /> বকেয়া
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            {/* Pay Button */}
                            <button
                              onClick={() => openPaymentModal(student)}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold transition shadow-2xs flex items-center"
                              title="ফি জমা নিন ও মানি রিসিট প্রস্তুত করুন"
                            >
                              <CreditCard className="w-3 h-3 mr-1" />
                              জমা নিন
                            </button>

                            {/* Due Slip Print */}
                            <button
                              onClick={() => openDueSlip(student)}
                              className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded text-[11px] font-bold transition shadow-2xs flex items-center"
                              title="ডিউ স্লিপ প্রিন্ট প্রিভিউ"
                            >
                              <FileText className="w-3 h-3 mr-1" />
                              ডিউ স্লিপ
                            </button>

                            {/* View Latest Receipt if paid */}
                            {receipts.length > 0 && (
                              <button
                                onClick={() => openLatestReceipt(student)}
                                className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[11px] font-medium transition flex items-center"
                                title="সর্বশেষ মানি রিসিট দেখুন"
                              >
                                <Receipt className="w-3 h-3 mr-1" />
                                রসিদ
                              </button>
                            )}

                            {/* View Payment History & Ledger */}
                            <button
                              onClick={() => openStudentPaymentHistory(student)}
                              className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-[11px] font-semibold transition flex items-center"
                              title="সম্পূর্ণ পেমেন্ট হিস্ট্রি ও লেজার খতিয়ান দেখুন"
                            >
                              <History className="w-3 h-3 mr-1" />
                              হিস্ট্রি
                            </button>

                            {/* SMS Notice Button if due */}
                            {totalDue > 0 && student.guardianPhone && (
                              <button
                                onClick={() => setSmsModalStudent({ student, dueAmount: totalDue })}
                                className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                                title="বকেয়ার নোটিশ এসএমএস পাঠান"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: INVOICES LIST */}
      {activeTab === 'invoices' && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div>
              <h2 className="font-bold text-slate-800 text-sm sm:text-base">
                সকল বিল ও ইনভয়েস তালিকা
              </h2>
              <p className="text-xs text-slate-500">
                শিক্ষার্থীদের ধার্যকৃত প্রতিটি বিলের বিস্তারিত বিবরণ ও পেমেন্ট হিস্ট্রি
              </p>
            </div>
            <button
              onClick={() => setIsGeneratingBills(true)}
              className="inline-flex items-center px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition"
            >
              <PlusCircle className="w-3.5 h-3.5 mr-1" />
              নতুন বিল যোগ করুন
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 text-slate-700 uppercase tracking-wider font-semibold border-b border-slate-200">
                  <th className="px-3 py-3">বিল নং</th>
                  <th className="px-3 py-3">শিক্ষার্থী ও রোল</th>
                  <th className="px-3 py-3">শ্রেণি</th>
                  <th className="px-3 py-3">বিলের শিরোনাম</th>
                  <th className="px-3 py-3 text-right">মোট দাবি</th>
                  <th className="px-3 py-3 text-right">পরিশোধিত</th>
                  <th className="px-3 py-3 text-right">বকেয়া</th>
                  <th className="px-3 py-3 text-center">শেষ তারিখ</th>
                  <th className="px-3 py-3 text-center">অবস্থা</th>
                  <th className="px-3 py-3 text-right">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {feeInvoices.map((inv) => {
                  const student = students.find((s) => s.id === inv.studentId);
                  const clsName = classes.find((c) => c.id === inv.classId)?.nameBn || inv.classId;
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/80">
                      <td className="px-3 py-3 font-mono font-bold text-indigo-900">{inv.invoiceNumber}</td>
                      <td className="px-3 py-3">
                        <div className="font-bold text-slate-900">{inv.studentNameBn}</div>
                        <div className="text-[10px] text-slate-500">রোল: {toBengaliRoll(inv.studentRoll)}</div>
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        {clsName} ({inv.section})
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-slate-800 font-medium">{inv.title}</div>
                        <div className="text-[10px] text-slate-500">{inv.billMonthYear}</div>
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-slate-800 font-medium">
                        ৳ {toBengaliNumber(inv.totalPayable)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-emerald-700 font-medium">
                        ৳ {toBengaliNumber(inv.paidAmount)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-bold text-rose-600">
                        ৳ {toBengaliNumber(inv.dueAmount)}
                      </td>
                      <td className="px-3 py-3 text-center font-mono text-slate-600">
                        {toBengaliNumber(inv.dueDate)}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            inv.status === 'paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : inv.status === 'partial'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {inv.status === 'paid' ? 'পরিশোধিত' : inv.status === 'partial' ? 'আংশিক' : 'বকেয়া'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right space-x-1">
                        {inv.dueAmount > 0 && student && (
                          <button
                            onClick={() => openPaymentModal(student, inv)}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold"
                            title="পেমেন্ট জমা নিন"
                          >
                            জমা
                          </button>
                        )}
                        {student && (
                          <button
                            onClick={() => openDueSlip(student, inv)}
                            className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded text-[11px] font-bold"
                            title="ডিউ স্লিপ প্রিন্ট"
                          >
                            স্লিপ
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (confirm('আপনি কি নিশ্চিতভাবে এই ইনভয়েসটি মুছে ফেলতে চান?')) {
                              deleteFeeInvoice(inv.id);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600"
                          title="মুছে ফেলুন"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PAYMENT RECEIPTS */}
      {activeTab === 'receipts' && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div>
              <h2 className="font-bold text-slate-800 text-sm sm:text-base">
                আদায়কৃত মানি রিসিট ও ট্রানজেকশন খতিয়ান
              </h2>
              <p className="text-xs text-slate-500">
                সকল অফিশিয়াল রসিদের রেকর্ড, আদায়ের মাধ্যম এবং পুনরায় প্রিন্ট সুবিধা
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
              মোট রসিদ: {toBengaliNumber(feeReceipts.length)}টি
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 text-slate-700 uppercase tracking-wider font-semibold border-b border-slate-200">
                  <th className="px-3 py-3">রসিদ নং</th>
                  <th className="px-3 py-3">তারিখ</th>
                  <th className="px-3 py-3">শিক্ষার্থী ও রোল</th>
                  <th className="px-3 py-3">শ্রেণি</th>
                  <th className="px-3 py-3">পেমেন্ট মাধ্যম</th>
                  <th className="px-3 py-3 text-right">আদায়কৃত টাকা</th>
                  <th className="px-3 py-3 text-right">অবশিষ্ট বকেয়া</th>
                  <th className="px-3 py-3">আদায়কারী</th>
                  <th className="px-3 py-3 text-right">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {feeReceipts.map((rec) => {
                  const clsName = classes.find((c) => c.id === rec.classId)?.nameBn || rec.classId;
                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/80">
                      <td className="px-3 py-3 font-mono font-bold text-emerald-900">{rec.receiptNumber}</td>
                      <td className="px-3 py-3 font-mono text-slate-600">{toBengaliNumber(rec.paymentDate)}</td>
                      <td className="px-3 py-3">
                        <div className="font-bold text-slate-900">{rec.studentNameBn}</div>
                        <div className="text-[10px] text-slate-500">রোল: {toBengaliRoll(rec.studentRoll)}</div>
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        {clsName} ({rec.section})
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                          {rec.paymentMethod}
                        </span>
                        {rec.transactionRef && (
                          <div className="text-[9px] font-mono text-slate-500 mt-0.5">{rec.transactionRef}</div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-bold text-emerald-700 text-sm">
                        ৳ {toBengaliNumber(rec.paidAmount)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono">
                        {rec.remainingDue > 0 ? (
                          <span className="text-amber-700 font-semibold">৳ {toBengaliNumber(rec.remainingDue)}</span>
                        ) : (
                          <span className="text-emerald-600 font-bold">পরিশোধিত (০)</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-slate-600">{rec.collectedBy}</td>
                      <td className="px-3 py-3 text-right space-x-1">
                        <button
                          onClick={() => {
                            const student = students.find((s) => s.id === rec.studentId) || {
                              id: rec.studentId,
                              nameBn: rec.studentNameBn,
                              roll: rec.studentRoll,
                              classId: rec.classId,
                              section: rec.section,
                              academicYear: rec.academicYear,
                            };
                            setViewingOfficialVoucher({
                              student,
                              receipt: rec,
                              voucherType: 'money_receipt',
                            });
                          }}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold inline-flex items-center"
                          title="অফিশিয়াল মানি রিসিট ভাউচার প্রিন্ট করুন"
                        >
                          <Printer className="w-3 h-3 mr-1" />
                          অফিশিয়াল রসিদ (A4/A5)
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('আপনি কি নিশ্চিতভাবে এই রসিদ রেকর্ডটি মুছে ফেলতে চান?')) {
                              deletePaymentReceipt(rec.id);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600"
                          title="মুছে ফেলুন"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: FEE HEADS CONFIGURATION */}
      {activeTab === 'fee_heads' && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div>
              <h2 className="font-bold text-slate-900 text-base">ফি কাঠামো ও খাত সেটিংস</h2>
              <p className="text-xs text-slate-500">
                বিদ্যালয়ের মাসিক বেতন, সেশন ফি, পরীক্ষার ফি ও অন্যান্য খাতের স্ট্যান্ডার্ড রেট নির্ধারণ করুন
              </p>
            </div>
            <button
              onClick={() => setIsAddingHead(true)}
              className="inline-flex items-center px-3.5 py-1.5 bg-indigo-900 hover:bg-indigo-800 text-white rounded-lg text-xs font-bold transition shadow-xs"
            >
              <PlusCircle className="w-3.5 h-3.5 mr-1 text-amber-300" />
              নতুন ফি খাত যোগ করুন
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {feeHeads.map((head) => (
              <div key={head.id} className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 flex flex-col justify-between hover:shadow-sm transition">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs sm:text-sm">{head.nameBn}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-white border border-slate-200 text-slate-600">
                      {head.isMonthly ? 'প্রতি মাসে' : 'এককালীন / বার্ষিক'}
                    </span>
                  </div>
                  <div className="mt-2 text-xl font-bold font-mono text-indigo-950">
                    ৳ {toBengaliNumber(head.defaultAmount)}/-
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-500">
                  <span>ক্যাটাগরি: {head.category}</span>
                  <button
                    onClick={() => {
                      const newAmt = prompt(`"${head.nameBn}" এর নতুন পরিমাণ (টাকা):`, String(head.defaultAmount));
                      if (newAmt && !isNaN(Number(newAmt))) {
                        updateFeeHeads(feeHeads.map((h) => (h.id === head.id ? { ...h, defaultAmount: Number(newAmt) } : h)));
                      }
                    }}
                    className="text-indigo-600 hover:text-indigo-800 font-bold underline"
                  >
                    ফি পরিবর্তন করুন
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: STUDENT PAYMENT HISTORY & LEDGER VIEW */}
      {activeTab === 'payment_history' && (
        <StudentPaymentHistoryView
          initialStudentId={historyStudentId}
          onOpenPaymentModal={(std, inv) => {
            setPayModalStudent(std);
            setPayModalInvoice(inv || null);
            setPayAmount(inv ? inv.dueAmount : getStudentDueSummary(std.id)?.totalDue || 500);
          }}
          onOpenDueSlip={(std, inv) => {
            openDueSlip(std, inv);
          }}
          onOpenOfficialVoucher={({ student, receipt, invoice, voucherType }) => {
            setViewingOfficialVoucher({
              student,
              receipt,
              invoice,
              voucherType,
            });
          }}
          onOpenSMSModal={(std, due) => {
            setSmsModalStudent({ student: std, dueAmount: due });
          }}
        />
      )}

      {/* TAB 6: DEFAULTER LIST (30+ DAYS OVERDUE DEBT) */}
      {activeTab === 'defaulters' && (
        <DefaulterListView
          onNavigate={onNavigateToTab}
          onOpenStudentHistory={(studentId) => {
            setHistoryStudentId(studentId);
            setActiveTab('payment_history');
          }}
        />
      )}

      {/* QUICK PAYMENT MODAL WITH INSTANT REAL-TIME DEDUCTION */}
      {payModalStudent && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-900 to-indigo-950 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CreditCard className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-base">ফি জমা গ্রহণ ও রসিদ তৈরি</h3>
                  <p className="text-xs text-emerald-200">
                    পেমেন্ট সাথে সাথে বকেয়া থেকে কর্তন হয়ে রসিদ তৈরি হবে
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPayModalStudent(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleExecutePayment} className="p-5 space-y-4">
              {/* Student Info Card */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-slate-900">{payModalStudent.nameBn}</div>
                  <div className="text-slate-500">
                    রোল: <span className="font-bold text-indigo-900 font-mono">{toBengaliRoll(payModalStudent.roll)}</span> | শ্রেণি:{' '}
                    {classes.find((c) => c.id === payModalStudent.classId)?.nameBn} ({payModalStudent.section})
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-500">সর্বমোট বকেয়া</div>
                  <div className="text-base font-bold font-mono text-rose-600">
                    ৳ {toBengaliNumber(getStudentDueSummary(payModalStudent.id)?.totalDue || 0)}/-
                  </div>
                </div>
              </div>

              {/* Amount to pay */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-700">আদায়কৃত টাকার পরিমাণ (৳):</label>
                  <button
                    type="button"
                    onClick={() => {
                      const totalDue = getStudentDueSummary(payModalStudent.id)?.totalDue || 0;
                      setPayAmount(totalDue);
                    }}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline"
                  >
                    সম্পূর্ণ বকেয়া পরিশোধ করুন
                  </button>
                </div>
                <input
                  type="number"
                  min="1"
                  required
                  value={payAmount || ''}
                  onChange={(e) => setPayAmount(Math.max(0, Number(e.target.value)))}
                  className="w-full text-lg font-bold font-mono px-3 py-2 border-2 border-indigo-200 rounded-lg focus:outline-none focus:border-indigo-600 text-slate-900 bg-white"
                  placeholder="0"
                />
              </div>

              {/* Instant Deduction Preview Box */}
              {payAmount > 0 && (
                <div className="bg-emerald-50/80 border border-emerald-200 rounded-lg p-2.5 text-xs space-y-1">
                  <div className="font-bold text-emerald-950 flex items-center">
                    <Sparkles className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                    তাৎক্ষণিক হিসাব সমন্বয় (Real-Time Deduction):
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>পূর্ববর্তী মোট বকেয়া:</span>
                    <span className="font-mono">৳ {toBengaliNumber(getStudentDueSummary(payModalStudent.id)?.totalDue || 0)}/-</span>
                  </div>
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>এখন জমা হচ্ছে:</span>
                    <span className="font-mono">- ৳ {toBengaliNumber(payAmount)}/-</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-emerald-200 font-bold">
                    <span>জমা পরবর্তী নতুন বকেয়া:</span>
                    <span className="font-mono text-emerald-900">
                      ৳ {toBengaliNumber(Math.max(0, (getStudentDueSummary(payModalStudent.id)?.totalDue || 0) - payAmount))}/-
                    </span>
                  </div>
                </div>
              )}

              {/* Payment Method Selector */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">পেমেন্ট মাধ্যম:</label>
                  <select
                    value={paymentMethod}
                    onChange={(e: any) => setPaymentMethod(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-800"
                  >
                    <option value="নগদ">নগদ (Cash)</option>
                    <option value="বিকাশ">বিকাশ (bKash)</option>
                    <option value="নগদ/রকেট">নগদ / রকেট</option>
                    <option value="ব্যাংক">ব্যাংক জমা</option>
                    <option value="অন্যান্য">অন্যান্য</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ট্রানজেকশন আইডি (ঐচ্ছিক):
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. TrxID / স্লিপ নং"
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none text-slate-800"
                  />
                </div>
              </div>

              {/* Collected By & Notes */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">আদায়কারী / হিসাব শাখা:</label>
                  <input
                    type="text"
                    value={collectedBy}
                    onChange={(e) => setCollectedBy(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">মন্তব্য (রসিদে মুদ্রণ হবে):</label>
                  <input
                    type="text"
                    placeholder="বিশেষ দ্রষ্টব্য..."
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none text-slate-800"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setPayModalStudent(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-md transition flex items-center space-x-1"
                >
                  <Check className="w-4 h-4 mr-1" />
                  ফি গ্রহণ করুন ও মানি রিসিট প্রস্তুত করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GENERATE BATCH BILLS MODAL */}
      {isGeneratingBills && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <PlusCircle className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base">ক্লাস ভিত্তিক নতুন ফি বিল তৈরি</h3>
              </div>
              <button
                onClick={() => setIsGeneratingBills(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleBatchGenerateBills} className="p-5 space-y-4">
              {/* Class and Section */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">শ্রেণি নির্বাচন:</label>
                  <select
                    value={billGenClassId}
                    onChange={(e) => setBillGenClassId(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nameBn}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">শাখা:</label>
                  <select
                    value={billGenSection}
                    onChange={(e) => setBillGenSection(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                  >
                    <option value="সকল">সকল শাখা</option>
                    <option value="ক">ক শাখা</option>
                    <option value="খ">খ শাখা</option>
                  </select>
                </div>
              </div>

              {/* Month and Title */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">বিলের মাস/সেশন:</label>
                  <input
                    type="text"
                    value={billGenMonth}
                    onChange={(e) => setBillGenMonth(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">পরিশোধের শেষ তারিখ:</label>
                  <input
                    type="date"
                    value={billGenDueDate}
                    onChange={(e) => setBillGenDueDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">বিলের পূর্ণ বিবরণ:</label>
                <input
                  type="text"
                  value={billGenTitle}
                  onChange={(e) => setBillGenTitle(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>

              {/* Select Fee Heads */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  অত্র বিলে অন্তর্ভুক্ত ফি খাতসমূহ:
                </label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto border border-slate-200 p-2 rounded-lg bg-slate-50">
                  {feeHeads.map((head) => (
                    <label
                      key={head.id}
                      className="flex items-center justify-between p-1.5 rounded hover:bg-white cursor-pointer text-xs"
                    >
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={billGenSelectedHeads.includes(head.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setBillGenSelectedHeads([...billGenSelectedHeads, head.id]);
                            } else {
                              setBillGenSelectedHeads(billGenSelectedHeads.filter((id) => id !== head.id));
                            }
                          }}
                          className="rounded text-indigo-600"
                        />
                        <span className="font-medium text-slate-800">{head.nameBn}</span>
                      </div>
                      <span className="font-mono text-slate-600 font-bold">
                        ৳ {toBengaliNumber(head.defaultAmount)}/-
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="text-[11px] text-slate-500 bg-amber-50 p-2 rounded border border-amber-200">
                * দ্রষ্টব্য: কোনো শিক্ষার্থীর পূর্বের কোনো বকেয়া থাকলে তা স্বয়ংক্রিয়ভাবে এই বিলে যুক্ত হয়ে মোট প্রদেয় হিসাব হবে।
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsGeneratingBills(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-indigo-900 hover:bg-indigo-800 text-white rounded-lg shadow-sm"
                >
                  বিল প্রস্তুত করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BATCH PRINT DUE SLIPS MODAL (Prints 8-head A4 landscape side-by-side vouchers for whole class) */}
      {isBatchPrintingDueSlips && (
        <BatchPrintableVouchers
          schoolInfo={schoolInfo}
          students={filteredStudents}
          invoices={feeInvoices}
          classes={classes}
          voucherType="due_slip"
          onClose={() => setIsBatchPrintingDueSlips(false)}
        />
      )}

      {/* DUE NOTICE SMS MODAL */}
      {smsModalStudent && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 p-5 space-y-4">
            <div className="flex items-center space-x-2 text-indigo-900 font-bold text-base">
              <MessageSquare className="w-5 h-5 text-indigo-600" />
              <span>বকেয়া তাগাদা এসএমএস পাঠান</span>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1">
              <div>
                শিক্ষার্থী: <strong>{smsModalStudent.student.nameBn}</strong> (রোল:{' '}
                {toBengaliRoll(smsModalStudent.student.roll)})
              </div>
              <div>
                প্রাপক মোবাইল:{' '}
                <strong className="font-mono text-slate-900">
                  {smsModalStudent.student.guardianPhone || 'নম্বর পাওয়া যায়নি'}
                </strong>
              </div>
              <div className="text-rose-700 font-bold">
                বকেয়া টাকা: ৳ {toBengaliNumber(smsModalStudent.dueAmount)}/-
              </div>
            </div>

            <div className="text-xs text-slate-700 bg-amber-50 p-3 rounded-lg border border-amber-200 font-serif">
              &quot;ডি-লিকন মডেল একাডেমী: প্রিয় অভিভাবক, আপনার সন্তান {smsModalStudent.student.nameBn} (রোল:{' '}
              {toBengaliRoll(smsModalStudent.student.roll)}), শিক্ষাবর্ষ {toBengaliNumber(selectedYear)}-এ মোট বকেয়া ৳{' '}
              {toBengaliNumber(smsModalStudent.dueAmount)}/- টাকা। দ্রুত বকেয়া পরিশোধ করে রসিদ সংগ্রহ করার অনুরোধ করা
              হলো। - প্রধান শিক্ষক।&quot;
            </div>

            {smsFeedback && (
              <div className="text-xs font-bold text-emerald-700 bg-emerald-50 p-2 rounded text-center">
                {smsFeedback}
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
              <button
                onClick={() => setSmsModalStudent(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
              >
                বাতিল
              </button>
              <button
                onClick={handleSendDueSMS}
                className="px-4 py-1.5 text-xs font-bold bg-indigo-900 text-white hover:bg-indigo-800 rounded flex items-center"
              >
                <Send className="w-3.5 h-3.5 mr-1" />
                এসএমএস পাঠান
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW FEE HEAD MODAL */}
      {isAddingHead && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 space-y-3">
            <h3 className="font-bold text-slate-900 text-sm">নতুন ফি খাত যুক্ত করুন</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">খাতের নাম (বাংলায়):</label>
              <input
                type="text"
                placeholder="e.g. পরিবহন ফি / ল্যাব ফি"
                value={newHeadName}
                onChange={(e) => setNewHeadName(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">স্ট্যান্ডার্ড ফি (টাকা):</label>
              <input
                type="number"
                value={newHeadAmount || ''}
                onChange={(e) => setNewHeadAmount(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded font-mono text-slate-900"
              />
            </div>
            <label className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={newHeadIsMonthly}
                onChange={(e) => setNewHeadIsMonthly(e.target.checked)}
                className="rounded text-indigo-600"
              />
              <span>এটি কি মাসিক ফি? (প্রতি মাসে প্রযোজ্য)</span>
            </label>
            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
              <button
                onClick={() => setIsAddingHead(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
              >
                বাতিল
              </button>
              <button
                onClick={() => {
                  if (!newHeadName.trim()) return;
                  const newHead: FeeHead = {
                    id: `fh_${Date.now()}`,
                    nameBn: newHeadName.trim(),
                    category: 'other',
                    defaultAmount: newHeadAmount,
                    isMonthly: newHeadIsMonthly,
                  };
                  updateFeeHeads([...feeHeads, newHead]);
                  setIsAddingHead(false);
                  setNewHeadName('');
                }}
                className="px-4 py-1.5 text-xs font-bold bg-indigo-900 text-white rounded"
              >
                সংরক্ষণ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BATCH PRINTABLE VOUCHERS MODAL (ALL STUDENTS IN SELECTED CLASS / BLANK SLIPS) */}
      {isBatchPrintingDueSlips && (
        <BatchPrintableVouchers
          schoolInfo={schoolInfo}
          students={students}
          invoices={feeInvoices}
          classes={classes}
          initialClassId={selectedClassId === 'all' ? undefined : selectedClassId}
          initialSection={selectedSection}
          voucherType="due_slip"
          initialIsBlank={batchPrintIsBlank}
          onClose={() => setIsBatchPrintingDueSlips(false)}
        />
      )}

      {/* OFFICIAL 8-HEAD A4/A5 PRINTABLE VOUCHER MODAL (Exact match to scan) */}
      {viewingOfficialVoucher && (
        <PrintableOfficialVoucher
          schoolInfo={schoolInfo}
          student={viewingOfficialVoucher.student}
          allStudents={filteredStudents}
          currentStudentIndex={Math.max(
            0,
            filteredStudents.findIndex((s) => s.id === viewingOfficialVoucher.student.id)
          )}
          onNavigateStudent={(idx) => {
            const targetStudent = filteredStudents[idx];
            if (targetStudent) {
              const studentInvs = feeInvoices.filter((inv) => inv.studentId === targetStudent.id);
              const targetInv = studentInvs.find((inv) => inv.dueAmount > 0) || studentInvs[0];
              const studentReceipts = feeReceipts.filter((r) => r.studentId === targetStudent.id);
              setViewingOfficialVoucher({
                student: targetStudent,
                invoice: targetInv,
                receipt: studentReceipts[0],
                voucherType: viewingOfficialVoucher.voucherType,
              });
            }
          }}
          invoice={viewingOfficialVoucher.invoice}
          receipt={viewingOfficialVoucher.receipt}
          classes={classes}
          voucherType={viewingOfficialVoucher.voucherType}
          onClose={() => setViewingOfficialVoucher(null)}
          onCollectPayment={(params) => {
            collectFeePayment(params);
          }}
        />
      )}

      {/* Legacy/Detailed Due Slip Modal */}
      {viewingDueSlip && (
        <PrintableDueSlip
          schoolInfo={schoolInfo}
          student={viewingDueSlip.student}
          invoice={viewingDueSlip.invoice}
          onClose={() => setViewingDueSlip(null)}
        />
      )}

      {/* Legacy/Detailed Money Receipt Modal */}
      {viewingReceipt && (
        <PrintableMoneyReceipt
          schoolInfo={schoolInfo}
          receipt={viewingReceipt}
          onClose={() => setViewingReceipt(null)}
        />
      )}
    </div>
  );
};
