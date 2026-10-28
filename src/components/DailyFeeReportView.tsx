import React, { useState, useMemo } from 'react';
import {
  Calendar,
  CalendarDays,
  Receipt,
  CreditCard,
  TrendingUp,
  DollarSign,
  Printer,
  Download,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  X,
  FileText,
  Check,
  Users,
  PieChart,
  Building,
  Clock,
  Sparkles,
  Phone,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import {
  PaymentRecord,
  FeeInvoice,
  Student,
  PaymentMethod,
  FeeHead,
} from '../types';
import { STANDARD_8_VOUCHER_HEADS } from '../data/defaultData';
import { toBengaliNumber, toBengaliRoll, formatBengaliDate } from '../utils/bengali';
import { numberToBengaliWords } from '../utils/bengaliWords';
import { SchoolLogo } from './SchoolLogo';
import { PrintableOfficialVoucher } from './PrintableOfficialVoucher';

interface DailyFeeReportViewProps {
  onNavigate?: (tab: string) => void;
}

export const DailyFeeReportView: React.FC<DailyFeeReportViewProps> = ({ onNavigate }) => {
  const {
    schoolInfo,
    classes,
    students,
    feeReceipts,
    feeInvoices,
    feeHeads,
    collectFeePayment,
    deletePaymentReceipt,
    sendSingleSMS,
  } = useSchool();

  // Selected date (Defaults to today in YYYY-MM-DD)
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  
  // Find the most recent date that actually has receipts in the database
  const latestReceiptDate = useMemo(() => {
    if (!feeReceipts || feeReceipts.length === 0) return todayStr;
    const sorted = [...feeReceipts].sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
    return sorted[0].paymentDate;
  }, [feeReceipts, todayStr]);

  // Initial date: use today if it has receipts, otherwise default to latest receipt date or today
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const hasToday = feeReceipts.some((r) => r.paymentDate === todayStr);
    return hasToday ? todayStr : (latestReceiptDate || todayStr);
  });

  // Active view tab inside daily report
  const [activeTab, setActiveTab] = useState<'transactions' | 'analysis' | 'pending_dues'>('transactions');

  // Filters
  const [classFilter, setClassFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [isPrintLedgerOpen, setIsPrintLedgerOpen] = useState(false);
  const [viewingVoucher, setViewingVoucher] = useState<{
    student: Student;
    receipt?: PaymentRecord;
    invoice?: FeeInvoice;
    voucherType: 'money_receipt' | 'due_slip';
  } | null>(null);

  // Quick Pay Modal
  const [isQuickPayOpen, setIsQuickPayOpen] = useState(false);
  const [quickPayStudentId, setQuickPayStudentId] = useState<string>('');
  const [quickPayAmount, setQuickPayAmount] = useState<number>(500);
  const [quickPayMethod, setQuickPayMethod] = useState<PaymentMethod>('নগদ');
  const [quickPayRef, setQuickPayRef] = useState<string>('');
  const [quickPayCollector, setQuickPayCollector] = useState<string>('হিসাব সহকারী');
  const [quickPayNotes, setQuickPayNotes] = useState<string>('');
  const [quickPaySuccessMsg, setQuickPaySuccessMsg] = useState<string | null>(null);

  // Student map for fast lookup
  const studentMap = useMemo(() => {
    const map = new Map<string, Student>();
    students.forEach((s) => map.set(s.id, s));
    return map;
  }, [students]);

  // Class map for fast lookup
  const classMap = useMemo(() => {
    const map = new Map<string, string>();
    classes.forEach((c) => map.set(c.id, c.nameBn));
    return map;
  }, [classes]);

  // All receipts collected on the chosen date
  const dateReceipts = useMemo(() => {
    return feeReceipts.filter((r) => r.paymentDate === selectedDate);
  }, [feeReceipts, selectedDate]);

  // Filtered receipts based on class, method, and search
  const filteredReceipts = useMemo(() => {
    return dateReceipts.filter((rec) => {
      const matchClass = classFilter === 'all' || rec.classId === classFilter;
      const matchMethod = methodFilter === 'all' || rec.paymentMethod === methodFilter;
      const matchSearch =
        !searchQuery ||
        rec.studentNameBn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(rec.studentRoll).includes(searchQuery) ||
        rec.receiptNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (rec.transactionRef && rec.transactionRef.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchClass && matchMethod && matchSearch;
    });
  }, [dateReceipts, classFilter, methodFilter, searchQuery]);

  // Total daily income collected on selected date (across all filtered receipts)
  const totalDailyIncome = useMemo(() => {
    return filteredReceipts.reduce((sum, r) => sum + (r.paidAmount || 0), 0);
  }, [filteredReceipts]);

  // Overall total daily income on that date (unfiltered, for KPI)
  const overallDailyIncome = useMemo(() => {
    return dateReceipts.reduce((sum, r) => sum + (r.paidAmount || 0), 0);
  }, [dateReceipts]);

  // Cash collection vs digital collection on selected date
  const paymentMethodSummary = useMemo(() => {
    const summary: Record<string, { count: number; total: number }> = {
      নগদ: { count: 0, total: 0 },
      বিকাশ: { count: 0, total: 0 },
      'নগদ/রকেট': { count: 0, total: 0 },
      ব্যাংক: { count: 0, total: 0 },
      অন্যান্য: { count: 0, total: 0 },
    };

    dateReceipts.forEach((r) => {
      const method = r.paymentMethod || 'নগদ';
      if (!summary[method]) {
        summary[method] = { count: 0, total: 0 };
      }
      summary[method].count += 1;
      summary[method].total += r.paidAmount || 0;
    });

    return summary;
  }, [dateReceipts]);

  const cashIncome = paymentMethodSummary['নগদ']?.total || 0;
  const digitalIncome =
    (paymentMethodSummary['বিকাশ']?.total || 0) +
    (paymentMethodSummary['নগদ/রকেট']?.total || 0) +
    (paymentMethodSummary['ব্যাংক']?.total || 0) +
    (paymentMethodSummary['অন্যান্য']?.total || 0);

  // Breakdown across the 8 standard voucher heads for this date
  const headWiseIncome = useMemo(() => {
    const headTotals: Record<string, { serialBn: string; nameBn: string; amount: number; count: number }> = {};

    STANDARD_8_VOUCHER_HEADS.forEach((h) => {
      headTotals[h.nameBn] = {
        serialBn: h.serialBn,
        nameBn: h.nameBn,
        amount: 0,
        count: 0,
      };
    });

    dateReceipts.forEach((r) => {
      if (r.itemsBreakdown && r.itemsBreakdown.length > 0) {
        r.itemsBreakdown.forEach((item) => {
          // Match by name or category
          let matched = false;
          for (const h of STANDARD_8_VOUCHER_HEADS) {
            if (item.nameBn.includes(h.nameBn) || h.nameBn.includes(item.nameBn)) {
              headTotals[h.nameBn].amount += item.amount;
              headTotals[h.nameBn].count += 1;
              matched = true;
              break;
            }
          }
          if (!matched) {
            // Check if it's tuition or exam
            if (item.nameBn.includes('বেতন') || item.nameBn.includes('টিউশন')) {
              headTotals['মাসিক বেতন'].amount += item.amount;
              headTotals['মাসিক বেতন'].count += 1;
            } else if (item.nameBn.includes('কোচিং')) {
              headTotals['কোচিং'].amount += item.amount;
              headTotals['কোচিং'].count += 1;
            } else if (item.nameBn.includes('মিডটার্ম')) {
              headTotals['মিডটার্ম ফি'].amount += item.amount;
              headTotals['মিডটার্ম ফি'].count += 1;
            } else if (item.nameBn.includes('সেমিস্টার') || item.nameBn.includes('সাময়িক') || item.nameBn.includes('পরীক্ষা')) {
              headTotals['সেমিস্টার ফি'].amount += item.amount;
              headTotals['সেমিস্টার ফি'].count += 1;
            } else if (item.nameBn.includes('বিদ্যুৎ') || item.nameBn.includes('চার্জ')) {
              headTotals['আদার্স চার্জ/বিদ্যুৎ বিল'].amount += item.amount;
              headTotals['আদার্স চার্জ/বিদ্যুৎ বিল'].count += 1;
            } else if (item.nameBn.includes('বই') || item.nameBn.includes('ডায়েরী') || item.nameBn.includes('ব্যাজ')) {
              headTotals['বই/ডায়েরী/বেতন বই/ব্যাজ'].amount += item.amount;
              headTotals['বই/ডায়েরী/বেতন বই/ব্যাজ'].count += 1;
            } else {
              headTotals['অন্যান্য'].amount += item.amount;
              headTotals['অন্যান্য'].count += 1;
            }
          }
        });
      } else {
        // Fallback: allocate to monthly tuition or arrears
        headTotals['মাসিক বেতন'].amount += r.paidAmount || 0;
        headTotals['মাসিক বেতন'].count += 1;
      }
    });

    return Object.values(headTotals);
  }, [dateReceipts]);

  // Class-wise collection breakdown for this date
  const classWiseIncome = useMemo(() => {
    return classes.map((cls) => {
      const classReceipts = dateReceipts.filter((r) => r.classId === cls.id);
      const totalCollected = classReceipts.reduce((sum, r) => sum + (r.paidAmount || 0), 0);
      const studentIdsPaid = new Set(classReceipts.map((r) => r.studentId));

      // Calculate class pending dues up to this date
      const classInvoices = feeInvoices.filter((inv) => inv.classId === cls.id);
      const pendingDueInClass = classInvoices.reduce((sum, inv) => sum + (inv.dueAmount || 0), 0);
      const dueStudentsCount = new Set(
        classInvoices.filter((inv) => (inv.dueAmount || 0) > 0).map((inv) => inv.studentId)
      ).size;

      return {
        classId: cls.id,
        classNameBn: cls.nameBn,
        receiptCount: classReceipts.length,
        studentCountPaid: studentIdsPaid.size,
        totalCollected,
        pendingDue: pendingDueInClass,
        dueStudentsCount,
      };
    });
  }, [classes, dateReceipts, feeInvoices]);

  // Pending dues calculation as of the selected date:
  // Invoices that were due on or before selectedDate and still have dueAmount > 0
  const pendingInvoices = useMemo(() => {
    return feeInvoices.filter((inv) => {
      const isDue = (inv.dueAmount || 0) > 0;
      const isDueOnOrBeforeDate = inv.dueDate <= selectedDate || inv.createdAt <= selectedDate;
      const matchClass = classFilter === 'all' || inv.classId === classFilter;
      return isDue && isDueOnOrBeforeDate && matchClass;
    });
  }, [feeInvoices, selectedDate, classFilter]);

  const totalPendingDueAmount = useMemo(() => {
    return pendingInvoices.reduce((sum, inv) => sum + (inv.dueAmount || 0), 0);
  }, [pendingInvoices]);

  const uniqueDueStudentsCount = useMemo(() => {
    return new Set(pendingInvoices.map((inv) => inv.studentId)).size;
  }, [pendingInvoices]);

  // Overall pending due across ALL active invoices in the school for context
  const totalSchoolPendingDue = useMemo(() => {
    return feeInvoices.reduce((sum, inv) => sum + (inv.dueAmount || 0), 0);
  }, [feeInvoices]);

  // Navigation handlers for date
  const handlePrevDay = () => {
    try {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() - 1);
      setSelectedDate(d.toISOString().split('T')[0]);
    } catch {}
  };

  const handleNextDay = () => {
    try {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() + 1);
      setSelectedDate(d.toISOString().split('T')[0]);
    } catch {}
  };

  const handleSetToday = () => {
    setSelectedDate(todayStr);
  };

  const handleSetYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleSetLatestReceiptDate = () => {
    setSelectedDate(latestReceiptDate);
  };

  // Export Daily Report to CSV
  const handleExportCSV = () => {
    if (filteredReceipts.length === 0) {
      alert('এক্সপোর্ট করার জন্য নির্বাচিত তারিখে কোনো লেনদেন পাওয়া যায়নি।');
      return;
    }

    const headers = [
      'রসিদ নং',
      'শিক্ষার্থীর নাম',
      'রোল',
      'শ্রেণি',
      'শাখা',
      'পেমেন্ট মাধ্যম',
      'ট্রানজেকশন আইডি',
      'আদায়কারী',
      'আদায়কৃত টাকা',
      'অবশিষ্ট বকেয়া',
      'তারিখ',
    ];

    const rows = filteredReceipts.map((r) => [
      `"${r.receiptNumber}"`,
      `"${r.studentNameBn}"`,
      r.studentRoll,
      `"${classMap.get(r.classId) || r.classId}"`,
      `"${r.section}"`,
      `"${r.paymentMethod}"`,
      `"${r.transactionRef || '-'}"`,
      `"${r.collectedBy}"`,
      r.paidAmount,
      r.remainingDue,
      `"${r.paymentDate}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `daily_fee_report_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle Quick Pay submission
  const handleQuickPaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPayStudentId) {
      alert('অনুগ্রহ করে একজন শিক্ষার্থী নির্বাচন করুন।');
      return;
    }
    if (quickPayAmount <= 0) {
      alert('সঠিক টাকার পরিমাণ দিন।');
      return;
    }

    const std = studentMap.get(quickPayStudentId);
    if (!std) return;

    // Find student's unpaid invoices
    const studentInvoices = feeInvoices.filter(
      (inv) => inv.studentId === quickPayStudentId && (inv.dueAmount || 0) > 0
    );
    const targetInvoice = studentInvoices[0];

    collectFeePayment({
      studentId: quickPayStudentId,
      invoiceId: targetInvoice?.id,
      paidAmount: quickPayAmount,
      paymentMethod: quickPayMethod,
      transactionRef: quickPayRef || undefined,
      collectedBy: quickPayCollector || 'হিসাব সহকারী',
      notes: quickPayNotes || `দৈনিক খতিয়ান এন্ট্রি (${selectedDate})`,
      itemsBreakdown: [
        { nameBn: 'মাসিক বেতন ও বকেয়া ফি', amount: quickPayAmount },
      ],
    });

    setQuickPaySuccessMsg(`${std.nameBn}-এর ${toBengaliNumber(quickPayAmount)}/- টাকা সফলভাবে গ্রহণ করা হয়েছে।`);
    setTimeout(() => {
      setQuickPaySuccessMsg(null);
      setIsQuickPayOpen(false);
      setQuickPayStudentId('');
      setQuickPayAmount(500);
      setQuickPayRef('');
      setQuickPayNotes('');
    }, 1500);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Title */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 transition">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                <Receipt className="w-6 h-6" />
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-serif flex items-center gap-2">
                  <span>দৈনিক ফি আদায় ও বকেয়া খতিয়ান</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-sans font-medium">
                    Daily Fee Ledger
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-600">
                  {schoolInfo.name || 'ডি-লিকন মডেল একাডেমী'} • প্রতিদিনের ফি আদায়, খাতওয়ারী আয় ও অবশিষ্ট বকেয়ার সমন্বিত রিপোর্ট
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsPrintLedgerOpen(true)}
              className="inline-flex items-center px-3.5 py-2 rounded-xl text-sm font-bold bg-indigo-900 hover:bg-indigo-800 text-white shadow-sm transition"
              title="আজকের সমাপনী খতিয়ান এ৪ প্রিন্ট করুন"
            >
              <Printer className="w-4 h-4 mr-1.5 text-amber-300" />
              দৈনিক খতিয়ান প্রিন্ট
            </button>

            <button
              onClick={handleExportCSV}
              className="inline-flex items-center px-3 py-2 rounded-xl text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition"
              title="CSV ফাইলে এক্সপোর্ট করুন"
            >
              <Download className="w-4 h-4 mr-1.5 text-slate-600" />
              এক্সপোর্ট
            </button>

            <button
              onClick={() => setIsQuickPayOpen(true)}
              className="inline-flex items-center px-3.5 py-2 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition"
            >
              <PlusCircle className="w-4 h-4 mr-1.5" />
              নতুন ফি আদায়
            </button>

            {onNavigate && (
              <button
                onClick={() => onNavigate('fees')}
                className="inline-flex items-center px-3 py-2 rounded-xl text-sm font-medium bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 transition"
              >
                বকেয়া মডিউলে যান
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </button>
            )}
          </div>
        </div>

        {/* Date Selector Bar */}
        <div className="mt-5 pt-4 border-t border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/80 -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 p-4 rounded-b-2xl">
          {/* Quick Date Presets & Date Picker */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-700 flex items-center">
              <Calendar className="w-4 h-4 mr-1 text-indigo-700" />
              তারিখ নির্বাচন:
            </span>

            <div className="inline-flex items-center bg-white border border-slate-300 rounded-lg shadow-xs overflow-hidden">
              <button
                type="button"
                onClick={handlePrevDay}
                title="পূর্ববর্তী দিন"
                className="p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border-r border-slate-200 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-2.5 py-1 text-xs sm:text-sm font-semibold text-slate-900 bg-transparent border-0 focus:ring-0 focus:outline-none cursor-pointer"
              />
              <button
                type="button"
                onClick={handleNextDay}
                title="পরবর্তী দিন"
                className="p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border-l border-slate-200 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={handleSetToday}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition ${
                  selectedDate === todayStr
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                আজ
              </button>
              <button
                type="button"
                onClick={handleSetYesterday}
                className="px-2.5 py-1 rounded-md text-xs font-medium bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition"
              >
                গতকাল
              </button>
              {latestReceiptDate !== todayStr && (
                <button
                  type="button"
                  onClick={handleSetLatestReceiptDate}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                    selectedDate === latestReceiptDate
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'bg-white border border-slate-300 text-indigo-700 hover:bg-indigo-50'
                  }`}
                  title="সর্বশেষ লেনদেনের তারিখে যান"
                >
                  সর্বশেষ লেনদেন ({toBengaliNumber(latestReceiptDate)})
                </button>
              )}
            </div>
          </div>

          {/* Formatted Date Display */}
          <div className="text-xs sm:text-sm font-bold text-indigo-950 flex items-center bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200/80">
            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
            <span>{formatBengaliDate(selectedDate)}</span>
          </div>
        </div>
      </div>

      {/* Top 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Daily Income */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-800 text-white p-5 rounded-2xl shadow-md border border-emerald-500/30 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute right-2 -bottom-2 opacity-15 pointer-events-none">
            <DollarSign className="w-24 h-24" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-emerald-100 font-semibold">
                আজকের মোট ফি আদায়
              </span>
              <span className="p-1.5 bg-emerald-500/40 rounded-lg">
                <Receipt className="w-4 h-4 text-emerald-100" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-1">
              <span className="text-3xl font-extrabold tracking-tight font-mono">
                ৳ {toBengaliNumber(overallDailyIncome)}
              </span>
              <span className="text-xs text-emerald-200">/- টাকা</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-emerald-500/40 flex items-center justify-between text-xs text-emerald-100">
            <span>মোট আদায়কৃত রসিদ:</span>
            <span className="font-bold text-white font-mono bg-emerald-900/50 px-2 py-0.5 rounded">
              {toBengaliNumber(dateReceipts.length)} টি
            </span>
          </div>
        </div>

        {/* Cash in Hand */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                নগদ আদায় (ক্যাশ)
              </span>
              <span className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                <DollarSign className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-1">
              <span className="text-2xl font-bold text-slate-900 font-mono">
                ৳ {toBengaliNumber(cashIncome)}
              </span>
              <span className="text-xs text-slate-500">/-</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>ক্যাশ ট্রানজেকশন:</span>
            <span className="font-bold text-blue-800 font-mono">
              {toBengaliNumber(paymentMethodSummary['নগদ']?.count || 0)} টি
            </span>
          </div>
        </div>

        {/* Digital / Mobile Banking */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                অনলাইন / ডিজিটাল আদায়
              </span>
              <span className="p-1.5 bg-purple-100 text-purple-700 rounded-lg">
                <CreditCard className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-1">
              <span className="text-2xl font-bold text-slate-900 font-mono">
                ৳ {toBengaliNumber(digitalIncome)}
              </span>
              <span className="text-xs text-slate-500">/-</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>বিকাশ, রকেট ও ব্যাংক:</span>
            <span className="font-bold text-purple-800 font-mono">
              {toBengaliNumber(
                (paymentMethodSummary['বিকাশ']?.count || 0) +
                  (paymentMethodSummary['নগদ/রকেট']?.count || 0) +
                  (paymentMethodSummary['ব্যাংক']?.count || 0) +
                  (paymentMethodSummary['অন্যান্য']?.count || 0)
              )}{' '}
              টি
            </span>
          </div>
        </div>

        {/* Pending Dues Snapshot */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                আজকের অবশিষ্ট বকেয়া
              </span>
              <span className="p-1.5 bg-rose-100 text-rose-700 rounded-lg">
                <AlertCircle className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-1">
              <span className="text-2xl font-bold text-rose-600 font-mono">
                ৳ {toBengaliNumber(totalPendingDueAmount)}
              </span>
              <span className="text-xs text-slate-500">/-</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>বকেয়াদার শিক্ষার্থী:</span>
            <span className="font-bold text-rose-700 font-mono">
              {toBengaliNumber(uniqueDueStudentsCount)} জন
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs & Filter Controls */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Main Subtabs */}
          <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('transactions')}
              className={`flex items-center px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition ${
                activeTab === 'transactions'
                  ? 'bg-white text-indigo-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Receipt className="w-4 h-4 mr-1.5 text-indigo-600" />
              আজকের আদায় খতিয়ান ({toBengaliNumber(dateReceipts.length)})
            </button>

            <button
              onClick={() => setActiveTab('analysis')}
              className={`flex items-center px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition ${
                activeTab === 'analysis'
                  ? 'bg-white text-indigo-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PieChart className="w-4 h-4 mr-1.5 text-indigo-600" />
              খাত ও শ্রেণিভিত্তিক হিসাব
            </button>

            <button
              onClick={() => setActiveTab('pending_dues')}
              className={`flex items-center px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition ${
                activeTab === 'pending_dues'
                  ? 'bg-white text-rose-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <AlertCircle className="w-4 h-4 mr-1.5 text-rose-600" />
              আজকের পেন্ডিং বকেয়া ({toBengaliNumber(pendingInvoices.length)})
            </button>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Class Filter */}
            <div className="flex items-center space-x-1">
              <label className="text-xs font-semibold text-slate-600">শ্রেণি:</label>
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">সকল শ্রেণি</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameBn}
                  </option>
                ))}
              </select>
            </div>

            {/* Method Filter (for transactions) */}
            {activeTab === 'transactions' && (
              <div className="flex items-center space-x-1">
                <label className="text-xs font-semibold text-slate-600">মাধ্যম:</label>
                <select
                  value={methodFilter}
                  onChange={(e) => setMethodFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">সকল মাধ্যম</option>
                  <option value="নগদ">নগদ (Cash)</option>
                  <option value="বিকাশ">বিকাশ (bKash)</option>
                  <option value="নগদ/রকেট">নগদ / রকেট</option>
                  <option value="ব্যাংক">ব্যাংক জমা</option>
                </select>
              </div>
            )}

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="রোল, নাম বা রসিদ নং..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-40 sm:w-48"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tab 1: Detailed Transactions Table */}
        {activeTab === 'transactions' && (
          <div className="p-4 sm:p-6 space-y-4">
            {filteredReceipts.length === 0 ? (
              <div className="text-center py-12 px-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <div className="w-12 h-12 mx-auto bg-amber-50 rounded-full flex items-center justify-center text-amber-600 mb-3">
                  <Receipt className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-800">
                  নির্বাচিত তারিখে কোনো ফি আদায় পাওয়া যায়নি
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  {formatBengaliDate(selectedDate)}-এ এখনো কোনো পেমেন্ট রেকর্ড নেই।
                  আপনি উপরে অন্য কোনো তারিখ নির্বাচন করতে পারেন অথবা সরাসরি নতুন ফি আদায় করতে পারেন।
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {latestReceiptDate !== selectedDate && (
                    <button
                      onClick={handleSetLatestReceiptDate}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition"
                    >
                      সর্বশেষ লেনদেনের তারিখ দেখুন ({toBengaliNumber(latestReceiptDate)})
                    </button>
                  )}
                  <button
                    onClick={() => setIsQuickPayOpen(true)}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition"
                  >
                    <PlusCircle className="w-3.5 h-3.5 mr-1 inline" />
                    এখনই ফি গ্রহণ করুন
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 font-bold uppercase text-[11px] tracking-wider">
                      <th className="py-2.5 px-3">ক্রমিক</th>
                      <th className="py-2.5 px-3">রসিদ নম্বর</th>
                      <th className="py-2.5 px-3">শিক্ষার্থীর নাম ও রোল</th>
                      <th className="py-2.5 px-3">শ্রেণি ও শাখা</th>
                      <th className="py-2.5 px-3">আদায়ের বিবরণ / খাতসমূহ</th>
                      <th className="py-2.5 px-3">মাধ্যম ও ট্রানজেকশন</th>
                      <th className="py-2.5 px-3">আদায়কারী</th>
                      <th className="py-2.5 px-3 text-right">আদায়কৃত টাকা</th>
                      <th className="py-2.5 px-3 text-right">অবশিষ্ট বকেয়া</th>
                      <th className="py-2.5 px-3 text-center">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {filteredReceipts.map((rec, idx) => {
                      const std = studentMap.get(rec.studentId);
                      const classNameBn = classMap.get(rec.classId) || rec.classId;

                      return (
                        <tr
                          key={rec.id}
                          className="hover:bg-indigo-50/40 transition duration-150"
                        >
                          <td className="py-2.5 px-3 font-mono font-medium text-slate-600">
                            {toBengaliNumber(idx + 1)}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-indigo-900 whitespace-nowrap">
                            {rec.receiptNumber}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900">{rec.studentNameBn}</div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              রোল: {toBengaliRoll(rec.studentRoll)}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                            <span className="font-medium">{classNameBn}</span>
                            <span className="text-slate-400 text-xs"> ({rec.section})</span>
                          </td>
                          <td className="py-2.5 px-3 max-w-xs">
                            {rec.itemsBreakdown && rec.itemsBreakdown.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {rec.itemsBreakdown.map((item, i) => (
                                  <span
                                    key={i}
                                    className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-medium"
                                  >
                                    {item.nameBn}: ৳{toBengaliNumber(item.amount)}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-600 text-xs">মাসিক টিউশন ফি ও বকেয়া</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                                rec.paymentMethod === 'নগদ'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-purple-50 text-purple-700 border border-purple-200'
                              }`}
                            >
                              {rec.paymentMethod}
                            </span>
                            {rec.transactionRef && (
                              <span className="block text-[10px] text-slate-400 font-mono mt-0.5">
                                {rec.transactionRef}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 text-xs whitespace-nowrap">
                            {rec.collectedBy || 'হিসাব সহকারী'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 text-sm whitespace-nowrap">
                            ৳ {toBengaliNumber(rec.paidAmount)}/-
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-xs whitespace-nowrap">
                            {rec.remainingDue > 0 ? (
                              <span className="text-rose-600 font-bold">
                                ৳ {toBengaliNumber(rec.remainingDue)}/-
                              </span>
                            ) : (
                              <span className="text-emerald-600 font-medium">০/- (পরিশোধিত)</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <div className="inline-flex items-center space-x-1">
                              <button
                                onClick={() => {
                                  if (std) {
                                    setViewingVoucher({
                                      student: std,
                                      receipt: rec,
                                      voucherType: 'money_receipt',
                                    });
                                  } else {
                                    // Create a minimal fallback student object
                                    const fallbackStd: Student = {
                                      id: rec.studentId,
                                      nameBn: rec.studentNameBn,
                                      nameEn: '',
                                      roll: rec.studentRoll,
                                      classId: rec.classId,
                                      section: rec.section,
                                      academicYear: rec.academicYear,
                                      fatherName: '',
                                      motherName: '',
                                      guardianPhone: '',
                                      gender: 'ছাত্র',
                                    };
                                    setViewingVoucher({
                                      student: fallbackStd,
                                      receipt: rec,
                                      voucherType: 'money_receipt',
                                    });
                                  }
                                }}
                                className="inline-flex items-center px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold transition"
                                title="অফিশিয়াল ৮-খাত মানি রিসিট ভাউচার প্রিন্ট করুন"
                              >
                                <Printer className="w-3.5 h-3.5 mr-1" />
                                ভাউচার প্রিন্ট
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Table Footer with Summary */}
                  <tfoot>
                    <tr className="bg-slate-50 font-bold text-slate-900 border-t-2 border-slate-300">
                      <td colSpan={7} className="py-3 px-3 text-right text-xs">
                        মোট আদায় (নির্বাচিত {toBengaliNumber(filteredReceipts.length)} টি রসিদ):
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-emerald-800 text-base">
                        ৳ {toBengaliNumber(totalDailyIncome)}/-
                      </td>
                      <td colSpan={2} className="py-3 px-3"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Head-wise & Class-wise Analysis */}
        {activeTab === 'analysis' && (
          <div className="p-4 sm:p-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 8 Standard Fee Heads Breakdown */}
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200">
                  <h3 className="font-bold text-slate-800 text-sm flex items-center">
                    <PieChart className="w-4 h-4 mr-1.5 text-indigo-700" />
                    খাতওয়ারী দৈনিক আদায়ের হিসাব (৮টি নির্ধারিত খাত)
                  </h3>
                  <span className="text-xs font-bold text-indigo-700 font-mono">
                    মোট: ৳ {toBengaliNumber(overallDailyIncome)}/-
                  </span>
                </div>

                <div className="space-y-3">
                  {headWiseIncome.map((head) => {
                    const percentage =
                      overallDailyIncome > 0
                        ? Math.round((head.amount / overallDailyIncome) * 100)
                        : 0;

                    return (
                      <div key={head.nameBn} className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <div className="flex items-center space-x-1.5">
                            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 font-bold flex items-center justify-center text-[10px] font-mono">
                              {head.serialBn}
                            </span>
                            <span className="font-semibold text-slate-800">{head.nameBn}</span>
                            {head.count > 0 && (
                              <span className="text-[10px] text-slate-400">
                                ({toBengaliNumber(head.count)} টি পেমেন্ট)
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-slate-900">
                              ৳ {toBengaliNumber(head.amount)}/-
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono w-8 text-right">
                              {toBengaliNumber(percentage)}%
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Payment Method Distribution */}
              <div className="space-y-6">
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                  <h3 className="font-bold text-slate-800 text-sm mb-4 pb-2 border-b border-slate-200 flex items-center">
                    <CreditCard className="w-4 h-4 mr-1.5 text-emerald-700" />
                    পেমেন্ট মেথড ভিত্তিক আদায়ের হিসাব
                  </h3>

                  <div className="space-y-3">
                    {Object.entries(paymentMethodSummary).map(([method, data]) => {
                      const percentage =
                        overallDailyIncome > 0
                          ? Math.round((data.total / overallDailyIncome) * 100)
                          : 0;

                      return (
                        <div key={method} className="space-y-1">
                          <div className="flex justify-between items-center text-xs">
                            <div className="flex items-center space-x-1.5">
                              <span className="font-bold text-slate-800">{method}</span>
                              <span className="text-[10px] text-slate-400">
                                ({toBengaliNumber(data.count)} টি রসিদ)
                              </span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="font-mono font-bold text-slate-900">
                                ৳ {toBengaliNumber(data.total)}/-
                              </span>
                              <span className="text-[11px] text-slate-500 font-mono w-8 text-right">
                                {toBengaliNumber(percentage)}%
                              </span>
                            </div>
                          </div>

                          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-emerald-600 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Day-close quick stats */}
                <div className="bg-amber-50/60 rounded-xl p-4 border border-amber-200 text-xs text-amber-900 space-y-1.5">
                  <div className="font-bold flex items-center text-amber-950">
                    <Clock className="w-4 h-4 mr-1 text-amber-700" />
                    ক্যাশ সমাপনী নোট:
                  </div>
                  <p>
                    আজকের মোট নগদ আদায় <strong>৳ {toBengaliNumber(cashIncome)}/-</strong> টাকা।
                    দিনশেষে অফিস সহকারী এবং প্রধান হিসাবরক্ষক ক্যাশ সমাপনী সিগনেচার শিটে স্বাক্ষর গ্রহণ করে
                    প্রিন্সিপাল বরাবরে দৈনিক খতিয়ান জমা দিন।
                  </p>
                </div>
              </div>
            </div>

            {/* Class-wise Collection Table */}
            <div className="pt-2">
              <h3 className="font-bold text-slate-800 text-sm mb-3 flex items-center">
                <Building className="w-4 h-4 mr-1.5 text-blue-700" />
                শ্রেণিভিত্তিক দৈনিক আদায় ও বর্তমান বকেয়া পরিস্থিতি
              </h3>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs sm:text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px] uppercase">
                      <th className="py-2.5 px-3">শ্রেণি</th>
                      <th className="py-2.5 px-3 text-center">আজকের রসিদ সংখ্যা</th>
                      <th className="py-2.5 px-3 text-center">পরিশোধকারী শিক্ষার্থী</th>
                      <th className="py-2.5 px-3 text-right">আজকের মোট আদায়</th>
                      <th className="py-2.5 px-3 text-center">বকেয়াদার শিক্ষার্থী</th>
                      <th className="py-2.5 px-3 text-right">শ্রেণির বর্তমান বকেয়া</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {classWiseIncome.map((item) => (
                      <tr key={item.classId} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 px-3 font-bold text-slate-800">
                          {item.classNameBn}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">
                          {toBengaliNumber(item.receiptCount)} টি
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">
                          {toBengaliNumber(item.studentCountPaid)} জন
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                          ৳ {toBengaliNumber(item.totalCollected)}/-
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-rose-600 font-bold">
                          {toBengaliNumber(item.dueStudentsCount)} জন
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-rose-700 font-bold">
                          ৳ {toBengaliNumber(item.pendingDue)}/-
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                      <td className="py-2.5 px-3">সর্বমোট:</td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        {toBengaliNumber(dateReceipts.length)} টি
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        {toBengaliNumber(new Set(dateReceipts.map((r) => r.studentId)).size)} জন
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-800 text-sm">
                        ৳ {toBengaliNumber(overallDailyIncome)}/-
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-rose-700">
                        {toBengaliNumber(uniqueDueStudentsCount)} জন
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-rose-800 text-sm">
                        ৳ {toBengaliNumber(totalSchoolPendingDue)}/-
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Pending Dues as of Date */}
        {activeTab === 'pending_dues' && (
          <div className="p-4 sm:p-6 space-y-4">
            <div className="bg-rose-50/70 border border-rose-200 p-3.5 rounded-xl flex items-center justify-between text-xs text-rose-900">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <div>
                  <span className="font-bold">
                    {formatBengaliDate(selectedDate)} তারিখ বা তার পূর্বের অনিষ্পন্ন বকেয়া ইনভয়েস:
                  </span>{' '}
                  মোট {toBengaliNumber(pendingInvoices.length)} টি বিলে{' '}
                  <span className="font-mono font-bold">
                    ৳ {toBengaliNumber(totalPendingDueAmount)}/-
                  </span>{' '}
                  টাকা অপরিশোধিত রয়েছে।
                </div>
              </div>
            </div>

            {pendingInvoices.length === 0 ? (
              <div className="text-center py-12 px-4 bg-emerald-50/50 rounded-xl border border-dashed border-emerald-200">
                <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-600 mb-2" />
                <h4 className="text-sm font-bold text-emerald-900">
                  নির্বাচিত তারিখ পর্যন্ত কোনো অপরিশোধিত বকেয়া নেই!
                </h4>
                <p className="text-xs text-emerald-700 mt-1">
                  সকল শিক্ষার্থীর বকেয়া সম্পূর্ণভাবে পরিশোধিত রয়েছে।
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 text-[11px] uppercase tracking-wider">
                      <th className="py-2.5 px-3">ইনভয়েস নং</th>
                      <th className="py-2.5 px-3">শিক্ষার্থী ও রোল</th>
                      <th className="py-2.5 px-3">শ্রেণি ও শাখা</th>
                      <th className="py-2.5 px-3">বিলের শিরোনাম</th>
                      <th className="py-2.5 px-3 text-center">নির্ধারিত শেষ তারিখ</th>
                      <th className="py-2.5 px-3 text-right">মোট বিল</th>
                      <th className="py-2.5 px-3 text-right">পরিশোধিত</th>
                      <th className="py-2.5 px-3 text-right">বকেয়া টাকা</th>
                      <th className="py-2.5 px-3 text-center">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {pendingInvoices.map((inv) => {
                      const std = studentMap.get(inv.studentId);
                      const classNameBn = classMap.get(inv.classId) || inv.classId;

                      return (
                        <tr key={inv.id} className="hover:bg-rose-50/30 transition">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                            {inv.invoiceNumber}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900">{inv.studentNameBn}</div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              রোল: {toBengaliRoll(inv.studentRoll)}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                            <span className="font-medium">{classNameBn}</span>
                            <span className="text-slate-400 text-xs"> ({inv.section})</span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 max-w-xs truncate">
                            {inv.title}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-xs whitespace-nowrap">
                            {toBengaliNumber(inv.dueDate)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600 whitespace-nowrap">
                            ৳ {toBengaliNumber(inv.totalPayable)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-emerald-600 whitespace-nowrap">
                            ৳ {toBengaliNumber(inv.paidAmount)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600 text-sm whitespace-nowrap">
                            ৳ {toBengaliNumber(inv.dueAmount)}/-
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <div className="inline-flex items-center space-x-1">
                              <button
                                onClick={() => {
                                  setQuickPayStudentId(inv.studentId);
                                  setQuickPayAmount(inv.dueAmount);
                                  setIsQuickPayOpen(true);
                                }}
                                className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition"
                                title="তাৎক্ষণিক ফি গ্রহণ করুন"
                              >
                                ফি গ্রহণ
                              </button>
                              <button
                                onClick={() => {
                                  if (std) {
                                    setViewingVoucher({
                                      student: std,
                                      invoice: inv,
                                      voucherType: 'due_slip',
                                    });
                                  }
                                }}
                                className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-semibold transition"
                                title="অফিশিয়াল ৮-খাত ডিউ স্লিপ প্রিন্ট"
                              >
                                ডিউ স্লিপ
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-rose-50/50 font-bold text-slate-900 border-t-2 border-slate-300">
                      <td colSpan={7} className="py-3 px-3 text-right text-xs">
                        মোট পেন্ডিং বকেয়া:
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-rose-700 text-base">
                        ৳ {toBengaliNumber(totalPendingDueAmount)}/-
                      </td>
                      <td className="py-3 px-3"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* PRINTABLE DAILY DAY-CLOSE SHEET MODAL (A4 Format)                         */}
      {/* ========================================================================= */}
      {isPrintLedgerOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[96vh] flex flex-col overflow-hidden">
            {/* Modal Header (Hidden during print) */}
            <div className="no-print p-4 bg-indigo-950 text-white flex items-center justify-between border-b border-indigo-800">
              <div className="flex items-center space-x-2">
                <Printer className="w-5 h-5 text-amber-300" />
                <h3 className="font-bold text-base font-serif">
                  দৈনিক ফি আদায় ও ক্যাশ সমাপনী বিবরণী (A4 প্রিন্ট প্রিভিউ)
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
                  onClick={() => setIsPrintLedgerOpen(false)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Area */}
            <div className="p-6 overflow-y-auto printable-area bg-white text-slate-900 font-serif">
              {/* Official School Header */}
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
                  দৈনিক ফি আদায় ও ক্যাশ সমাপনী খতিয়ান (Daily Collection Sheet)
                </div>
                <div className="mt-1 text-xs text-slate-600 font-sans">
                  হিসাবের তারিখ: <span className="font-bold font-serif">{formatBengaliDate(selectedDate)}</span> | 
                  রিপোর্ট তৈরির সময়: {toBengaliNumber(new Date().toLocaleTimeString('bn-BD'))}
                </div>
              </div>

              {/* Box 1: Financial Summary Cards in Print */}
              <div className="grid grid-cols-4 gap-2 mb-4 text-xs font-sans">
                <div className="p-2 border border-slate-400 rounded bg-slate-50 text-center">
                  <div className="text-[11px] text-slate-600 font-medium">আজকের মোট আদায়</div>
                  <div className="text-sm font-bold font-mono text-slate-950">
                    ৳ {toBengaliNumber(overallDailyIncome)}/-
                  </div>
                </div>
                <div className="p-2 border border-slate-400 rounded bg-slate-50 text-center">
                  <div className="text-[11px] text-slate-600 font-medium">নগদ আদায় (Cash)</div>
                  <div className="text-sm font-bold font-mono text-slate-950">
                    ৳ {toBengaliNumber(cashIncome)}/-
                  </div>
                </div>
                <div className="p-2 border border-slate-400 rounded bg-slate-50 text-center">
                  <div className="text-[11px] text-slate-600 font-medium">ডিজিটাল আদায়</div>
                  <div className="text-sm font-bold font-mono text-slate-950">
                    ৳ {toBengaliNumber(digitalIncome)}/-
                  </div>
                </div>
                <div className="p-2 border border-slate-400 rounded bg-slate-50 text-center">
                  <div className="text-[11px] text-slate-600 font-medium">মোট রসিদ সংখ্যা</div>
                  <div className="text-sm font-bold font-mono text-slate-950">
                    {toBengaliNumber(dateReceipts.length)} টি
                  </div>
                </div>
              </div>

              {/* Box 2: 8 Standard Heads Breakdown Table */}
              <div className="mb-4">
                <div className="text-xs font-bold uppercase mb-1 border-b border-slate-300 pb-0.5">
                  খাতওয়ারী আদায় বিবরণী (৮টি নির্ধারিত খাত):
                </div>
                <table className="w-full text-xs border border-slate-800 border-collapse font-sans">
                  <thead>
                    <tr className="bg-slate-100 font-bold border-b border-slate-800 text-[11px]">
                      <th className="p-1 border-r border-slate-800 text-center w-10">ক্র.</th>
                      <th className="p-1 border-r border-slate-800 text-left">খাতের বিবরণ</th>
                      <th className="p-1 border-r border-slate-800 text-center w-24">পেমেন্ট সংখ্যা</th>
                      <th className="p-1 border-slate-800 text-right w-32">আদায়কৃত টাকা</th>
                    </tr>
                  </thead>
                  <tbody>
                    {headWiseIncome.map((head) => (
                      <tr key={head.nameBn} className="border-b border-slate-400">
                        <td className="p-1 border-r border-slate-800 text-center font-mono">
                          {head.serialBn}
                        </td>
                        <td className="p-1 border-r border-slate-800 font-medium">{head.nameBn}</td>
                        <td className="p-1 border-r border-slate-800 text-center font-mono">
                          {toBengaliNumber(head.count)}
                        </td>
                        <td className="p-1 border-slate-800 text-right font-mono font-bold">
                          {head.amount > 0 ? `${toBengaliNumber(head.amount)}/-` : '-'}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-100 font-bold border-t-2 border-slate-800">
                      <td colSpan={3} className="p-1 text-right border-r border-slate-800">
                        খাতওয়ারী সর্বমোট আদায় =
                      </td>
                      <td className="p-1 text-right font-mono">
                        ৳ {toBengaliNumber(overallDailyIncome)}/-
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Box 3: All Receipts Detail Table for the Day */}
              <div className="mb-6">
                <div className="text-xs font-bold uppercase mb-1 border-b border-slate-300 pb-0.5">
                  আজকের আদায়কৃত রসিদসমূহের পূর্ণাঙ্গ তালিকা:
                </div>
                {dateReceipts.length === 0 ? (
                  <div className="text-center py-4 text-xs text-slate-500 italic">
                    এই তারিখে কোনো লেনদেন সম্পন্ন হয়নি।
                  </div>
                ) : (
                  <table className="w-full text-[11px] border border-slate-800 border-collapse font-sans">
                    <thead>
                      <tr className="bg-slate-100 font-bold border-b border-slate-800">
                        <th className="p-1 border-r border-slate-800 text-center w-8">ক্র.</th>
                        <th className="p-1 border-r border-slate-800 text-left">রসিদ নং</th>
                        <th className="p-1 border-r border-slate-800 text-left">শিক্ষার্থীর নাম</th>
                        <th className="p-1 border-r border-slate-800 text-center w-12">রোল</th>
                        <th className="p-1 border-r border-slate-800 text-left">শ্রেণি</th>
                        <th className="p-1 border-r border-slate-800 text-center">মাধ্যম</th>
                        <th className="p-1 border-r border-slate-800 text-right">আদায় (৳)</th>
                        <th className="p-1 border-slate-800 text-right">বকেয়া (৳)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dateReceipts.map((r, i) => (
                        <tr key={r.id} className="border-b border-slate-300">
                          <td className="p-1 border-r border-slate-800 text-center font-mono">
                            {toBengaliNumber(i + 1)}
                          </td>
                          <td className="p-1 border-r border-slate-800 font-mono font-bold">
                            {r.receiptNumber}
                          </td>
                          <td className="p-1 border-r border-slate-800 font-medium">
                            {r.studentNameBn}
                          </td>
                          <td className="p-1 border-r border-slate-800 text-center font-mono">
                            {toBengaliRoll(r.studentRoll)}
                          </td>
                          <td className="p-1 border-r border-slate-800">
                            {classMap.get(r.classId) || r.classId}
                          </td>
                          <td className="p-1 border-r border-slate-800 text-center">
                            {r.paymentMethod}
                          </td>
                          <td className="p-1 border-r border-slate-800 text-right font-mono font-bold">
                            {toBengaliNumber(r.paidAmount)}
                          </td>
                          <td className="p-1 border-slate-800 text-right font-mono text-slate-700">
                            {r.remainingDue > 0 ? toBengaliNumber(r.remainingDue) : '০'}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-slate-100 font-bold border-t-2 border-slate-800">
                        <td colSpan={6} className="p-1 text-right border-r border-slate-800">
                          সর্বমোট আদায় =
                        </td>
                        <td className="p-1 text-right font-mono text-slate-950 font-bold">
                          ৳ {toBengaliNumber(overallDailyIncome)}
                        </td>
                        <td className="p-1"></td>
                      </tr>
                    </tbody>
                  </table>
                )}
                <div className="mt-2 text-xs font-serif">
                  <span className="font-bold">কথায়: </span>
                  <span className="italic underline">{numberToBengaliWords(overallDailyIncome)}</span>
                </div>
              </div>

              {/* Official Signature Blocks */}
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

      {/* ========================================================================= */}
      {/* QUICK PAY MODAL                                                           */}
      {/* ========================================================================= */}
      {isQuickPayOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
            <button
              onClick={() => setIsQuickPayOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2 mb-4 pb-3 border-b border-slate-200">
              <span className="p-2 bg-emerald-100 text-emerald-800 rounded-lg">
                <Receipt className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-bold text-slate-900 text-base">দ্রুত ফি গ্রহণ ফরম</h3>
                <p className="text-xs text-slate-500">
                  তারিখ: {formatBengaliDate(selectedDate)}
                </p>
              </div>
            </div>

            {quickPaySuccessMsg ? (
              <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 text-center font-bold text-sm">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-1 text-emerald-600" />
                {quickPaySuccessMsg}
              </div>
            ) : (
              <form onSubmit={handleQuickPaySubmit} className="space-y-3 text-xs sm:text-sm">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    শিক্ষার্থী নির্বাচন করুন:
                  </label>
                  <select
                    value={quickPayStudentId}
                    onChange={(e) => {
                      setQuickPayStudentId(e.target.value);
                      const std = studentMap.get(e.target.value);
                      if (std) {
                        // Find due
                        const dues = feeInvoices
                          .filter((inv) => inv.studentId === std.id)
                          .reduce((sum, inv) => sum + (inv.dueAmount || 0), 0);
                        if (dues > 0) setQuickPayAmount(dues);
                      }
                    }}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">-- শিক্ষার্থী বাছাই করুন --</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nameBn} - রোল: {toBengaliRoll(s.roll)} ({classMap.get(s.classId) || s.classId})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    আদায়কৃত টাকার পরিমাণ (৳):
                  </label>
                  <input
                    type="number"
                    value={quickPayAmount || ''}
                    onChange={(e) => setQuickPayAmount(Number(e.target.value))}
                    required
                    min={1}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-bold font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      পেমেন্ট মাধ্যম:
                    </label>
                    <select
                      value={quickPayMethod}
                      onChange={(e) => setQuickPayMethod(e.target.value as PaymentMethod)}
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                    >
                      <option value="নগদ">নগদ</option>
                      <option value="বিকাশ">বিকাশ</option>
                      <option value="নগদ/রকেট">নগদ / রকেট</option>
                      <option value="ব্যাংক">ব্যাংক</option>
                      <option value="অন্যান্য">অন্যান্য</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      আদায়কারী:
                    </label>
                    <input
                      type="text"
                      value={quickPayCollector}
                      onChange={(e) => setQuickPayCollector(e.target.value)}
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    ট্রানজেকশন রেফারেন্স (ঐচ্ছিক):
                  </label>
                  <input
                    type="text"
                    placeholder="যেমন: CASH-101 / TrxID"
                    value={quickPayRef}
                    onChange={(e) => setQuickPayRef(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    মন্তব্য / নোট (ঐচ্ছিক):
                  </label>
                  <input
                    type="text"
                    placeholder="বিশেষ দ্রষ্টব্য..."
                    value={quickPayNotes}
                    onChange={(e) => setQuickPayNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="pt-3 flex justify-end space-x-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsQuickPayOpen(false)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl font-medium transition"
                  >
                    বাতিল
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-sm transition"
                  >
                    পেমেন্ট নিশ্চিত করুন
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8-HEAD OFFICIAL MONEY RECEIPT / DUE SLIP VOUCHER MODAL                     */}
      {/* ========================================================================= */}
      {viewingVoucher && (
        <PrintableOfficialVoucher
          schoolInfo={schoolInfo}
          student={viewingVoucher.student}
          invoice={viewingVoucher.invoice}
          receipt={viewingVoucher.receipt}
          classes={classes}
          voucherType={viewingVoucher.voucherType}
          onClose={() => setViewingVoucher(null)}
          onCollectPayment={({ studentId, invoiceId, paidAmount, paymentMethod, transactionRef, collectedBy, itemsBreakdown }) => {
            collectFeePayment({
              studentId,
              invoiceId,
              paidAmount,
              paymentMethod,
              transactionRef,
              collectedBy,
              itemsBreakdown,
            });
            setViewingVoucher(null);
          }}
        />
      )}
    </div>
  );
};
