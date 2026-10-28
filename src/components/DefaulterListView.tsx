import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  AlertOctagon,
  Clock,
  CreditCard,
  Download,
  Filter,
  MessageSquare,
  Phone,
  Printer,
  Receipt,
  Search,
  Send,
  ShieldAlert,
  Users,
  CheckCircle2,
  X,
  FileText,
  FileSpreadsheet,
  ChevronDown,
  Building,
  Check,
  ChevronRight,
  TrendingDown,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { Student, FeeInvoice, PaymentRecord, PaymentMethod } from '../types';
import { toBengaliNumber, toBengaliRoll, formatBengaliDate } from '../utils/bengali';
import { numberToBengaliWords } from '../utils/bengaliWords';
import { SchoolLogo } from './SchoolLogo';
import { PrintableOfficialVoucher } from './PrintableOfficialVoucher';

interface DefaulterListViewProps {
  onNavigate?: (tab: string) => void;
  onOpenStudentHistory?: (studentId: string) => void;
}

export interface DefaulterStudentData {
  student: Student;
  classNameBn: string;
  invoices: FeeInvoice[];
  totalOverdueDue: number;
  totalSchoolDue: number;
  maxDaysOverdue: number;
  oldestDueDate: string;
  oldestCreatedDate: string;
  unpaidHeads: string[];
  severity: 'moderate' | 'high' | 'critical';
}

export const DefaulterListView: React.FC<DefaulterListViewProps> = ({
  onNavigate,
  onOpenStudentHistory,
}) => {
  const {
    schoolInfo,
    classes,
    students,
    feeInvoices,
    collectFeePayment,
    sendSingleSMS,
    sendBatchSMS,
  } = useSchool();

  // Current date (defaults to today)
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const todayDate = useMemo(() => new Date(todayStr), [todayStr]);

  // Aging threshold filter: default 30 days
  const [agingThreshold, setAgingThreshold] = useState<number>(30);

  // Filters
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<'all' | 'moderate' | 'high' | 'critical'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected students for bulk SMS
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  // Modals
  const [isPrintReportOpen, setIsPrintReportOpen] = useState(false);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const [isBulkSMSModalOpen, setIsBulkSMSModalOpen] = useState(false);
  const [bulkSMSText, setBulkSMSText] = useState(
    'ডি-লিকন মডেল একাডেমী: বিশেষ তাগাদা নোটিশ। প্রিয় অভিভাবক, আপনার সন্তানের বিদ্যালয়ে ৩০ দিনের অধিক সময়ের ফি বকেয়া রয়েছে। বকেয়া পরিশোধ করে রসিদ সংগ্রহ করার জন্য বিশেষভাবে অনুরোধ করা হলো। - প্রধান শিক্ষক।'
  );
  const [bulkSMSStatus, setBulkSMSStatus] = useState<string | null>(null);

  // Single SMS Modal
  const [singleSMSStudent, setSingleSMSStudent] = useState<DefaulterStudentData | null>(null);
  const [singleSMSText, setSingleSMSText] = useState('');
  const [singleSMSStatus, setSingleSMSStatus] = useState<string | null>(null);

  // Quick Pay Modal
  const [quickPayStudent, setQuickPayStudent] = useState<DefaulterStudentData | null>(null);
  const [quickPayAmount, setQuickPayAmount] = useState<number>(0);
  const [quickPayMethod, setQuickPayMethod] = useState<PaymentMethod>('নগদ');
  const [quickPayCollector, setQuickPayCollector] = useState<string>('হিসাব সহকারী');
  const [quickPayRef, setQuickPayRef] = useState<string>('');
  const [quickPaySuccess, setQuickPaySuccess] = useState<string | null>(null);

  // Printable Official 8-Head Voucher Modal
  const [viewingVoucher, setViewingVoucher] = useState<{
    student: Student;
    invoice?: FeeInvoice;
    receipt?: PaymentRecord;
    voucherType: 'due_slip' | 'money_receipt';
  } | null>(null);

  // Class Map for quick name lookup
  const classMap = useMemo(() => {
    const map = new Map<string, string>();
    classes.forEach((c) => map.set(c.id, c.nameBn));
    return map;
  }, [classes]);

  // Calculate Defaulter Data across all students
  const allDefaulters = useMemo(() => {
    const results: DefaulterStudentData[] = [];

    students.forEach((student) => {
      // Find all invoices with dueAmount > 0
      const unpaidInvoices = feeInvoices.filter(
        (inv) => inv.studentId === student.id && (inv.dueAmount || 0) > 0
      );

      if (unpaidInvoices.length === 0) return;

      // Calculate overdue days for each invoice based on dueDate or createdAt
      let maxOverdueDays = 0;
      let oldestDueDate = '';
      let oldestCreatedDate = '';
      let totalOverdueDue = 0;
      let totalSchoolDue = 0;
      const headsSet = new Set<string>();

      unpaidInvoices.forEach((inv) => {
        totalSchoolDue += inv.dueAmount;

        // Effective overdue calculation:
        // Difference between today and dueDate (or createdAt if dueDate is missing)
        const refDateStr = inv.dueDate || inv.createdAt;
        const refDate = new Date(refDateStr);
        const diffMs = todayDate.getTime() - refDate.getTime();
        const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

        // Also check creation age
        const createdMs = todayDate.getTime() - new Date(inv.createdAt).getTime();
        const createdDays = Math.max(0, Math.floor(createdMs / (1000 * 60 * 60 * 24)));
        const effectiveDays = Math.max(diffDays, createdDays);

        if (effectiveDays > maxOverdueDays) {
          maxOverdueDays = effectiveDays;
        }

        if (!oldestDueDate || refDateStr < oldestDueDate) {
          oldestDueDate = refDateStr;
        }
        if (!oldestCreatedDate || inv.createdAt < oldestCreatedDate) {
          oldestCreatedDate = inv.createdAt;
        }

        // If this specific invoice has been pending for >= agingThreshold
        if (effectiveDays >= agingThreshold) {
          totalOverdueDue += inv.dueAmount;
        }

        // Collect unpaid fee heads names
        if (inv.items && inv.items.length > 0) {
          inv.items.forEach((it) => headsSet.add(it.nameBn));
        } else {
          headsSet.add('মাসিক বেতন ও বকেয়া');
        }
      });

      // Filter condition: student must have pending payment for >= agingThreshold days
      if (maxOverdueDays >= agingThreshold) {
        // Determine severity
        let severity: 'moderate' | 'high' | 'critical' = 'moderate';
        if (maxOverdueDays >= 90) {
          severity = 'critical';
        } else if (maxOverdueDays >= 60) {
          severity = 'high';
        }

        results.push({
          student,
          classNameBn: classMap.get(student.classId) || student.classId,
          invoices: unpaidInvoices,
          totalOverdueDue: totalOverdueDue > 0 ? totalOverdueDue : totalSchoolDue,
          totalSchoolDue,
          maxDaysOverdue: maxOverdueDays,
          oldestDueDate: oldestDueDate || oldestCreatedDate,
          oldestCreatedDate,
          unpaidHeads: Array.from(headsSet),
          severity,
        });
      }
    });

    // Sort descending by maxDaysOverdue, then by totalOverdueDue
    results.sort((a, b) => {
      if (b.maxDaysOverdue !== a.maxDaysOverdue) {
        return b.maxDaysOverdue - a.maxDaysOverdue;
      }
      return b.totalOverdueDue - a.totalOverdueDue;
    });

    return results;
  }, [students, feeInvoices, todayDate, agingThreshold, classMap]);

  // Filtered defaulters based on class, section, severity, and search
  const filteredDefaulters = useMemo(() => {
    return allDefaulters.filter((d) => {
      const matchClass = selectedClassId === 'all' || d.student.classId === selectedClassId;
      const matchSection = selectedSection === 'all' || !selectedSection || d.student.section === selectedSection;
      const matchSeverity = selectedSeverity === 'all' || d.severity === selectedSeverity;
      const matchSearch =
        searchQuery.trim() === '' ||
        d.student.nameBn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.student.nameEn && d.student.nameEn.toLowerCase().includes(searchQuery.toLowerCase())) ||
        String(d.student.roll).includes(searchQuery) ||
        (d.student.guardianPhone && d.student.guardianPhone.includes(searchQuery));
      return matchClass && matchSection && matchSeverity && matchSearch;
    });
  }, [allDefaulters, selectedClassId, selectedSection, selectedSeverity, searchQuery]);

  // Top KPIs
  const totalOverdueDebt = useMemo(() => {
    return filteredDefaulters.reduce((sum, d) => sum + d.totalOverdueDue, 0);
  }, [filteredDefaulters]);

  const totalDefaultersCount = filteredDefaulters.length;

  const avgOverdueDays = useMemo(() => {
    if (filteredDefaulters.length === 0) return 0;
    const sum = filteredDefaulters.reduce((acc, d) => acc + d.maxDaysOverdue, 0);
    return Math.round(sum / filteredDefaulters.length);
  }, [filteredDefaulters]);

  const criticalDefaultersCount = useMemo(() => {
    return filteredDefaulters.filter((d) => d.severity === 'critical' || d.severity === 'high').length;
  }, [filteredDefaulters]);

  // Class-wise debt breakdown for quick chips
  const classDebtSummary = useMemo(() => {
    const summary: Record<string, { classNameBn: string; count: number; totalDebt: number }> = {};
    classes.forEach((c) => {
      summary[c.id] = { classNameBn: c.nameBn, count: 0, totalDebt: 0 };
    });

    filteredDefaulters.forEach((d) => {
      if (summary[d.student.classId]) {
        summary[d.student.classId].count += 1;
        summary[d.student.classId].totalDebt += d.totalOverdueDue;
      }
    });

    return Object.values(summary).filter((item) => item.count > 0);
  }, [classes, filteredDefaulters]);

  // Handle select all / deselect all
  const handleToggleSelectAll = () => {
    if (selectedStudentIds.size === filteredDefaulters.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(filteredDefaulters.map((d) => d.student.id)));
    }
  };

  const handleToggleStudent = (studentId: string) => {
    const next = new Set(selectedStudentIds);
    if (next.has(studentId)) {
      next.delete(studentId);
    } else {
      next.add(studentId);
    }
    setSelectedStudentIds(next);
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredDefaulters.length === 0) {
      alert('এক্সপোর্ট করার মতো কোনো খেলাপি তথ্য নেই।');
      return;
    }
    const wb = XLSX.utils.book_new();
    const classNameDisplay =
      selectedClassId === 'all'
        ? 'সকল শ্রেণি'
        : classMap.get(selectedClassId) || selectedClassId;

    const dataRows: (string | number)[][] = [
      ['ডি-লিকন মডেল একাডেমী'],
      ['ফি খেলাপি ও দীর্ঘমেয়াদী ঋণ পুনরুদ্ধার খতিয়ান (Fee Defaulter Statement)'],
      [
        `বকেয়া শর্ত: ${agingThreshold > 0 ? `${agingThreshold}+ দিন খেলাপি` : 'সকল বকেয়া'} | শ্রেণি: ${classNameDisplay} | শাখা: ${selectedSection === 'all' ? 'সকল শাখা' : selectedSection} | হিসাবের তারিখ: ${todayStr}`,
      ],
      [
        `মোট খেলাপি শিক্ষার্থী: ${filteredDefaulters.length} জন | সর্বমোট খেলাপি ঋণ: ৳ ${totalOverdueDebt}/- (${numberToBengaliWords(totalOverdueDebt)})`,
      ],
      [''],
      [
        'ক্রমিক',
        'রোল',
        'শিক্ষার্থীর নাম',
        'শ্রেণি',
        ' শাখা',
        'পিতা / অভিভাবক',
        'অভিভাবক মোবাইল',
        'বকেয়ার সময়কাল (দিন)',
        'বকেয়া শুরুর তারিখ',
        'বকেয়া খাতসমূহ',
        'খেলাপি টাকার পরিমাণ (৳)',
        'সর্বমোট বকেয়া (৳)',
        'ঝুঁকি মাত্রা',
      ],
    ];

    filteredDefaulters.forEach((d, idx) => {
      dataRows.push([
        idx + 1,
        d.student.roll,
        d.student.nameBn,
        d.classNameBn,
        d.student.section,
        d.student.fatherName || d.student.motherName || '-',
        d.student.guardianPhone || '-',
        d.maxDaysOverdue,
        d.oldestDueDate,
        d.unpaidHeads.join(', '),
        d.totalOverdueDue,
        d.totalSchoolDue,
        d.severity === 'critical' ? 'গুরুতর (Critical)' : d.severity === 'high' ? 'উচ্চ (High)' : 'মাঝারি (Moderate)',
      ]);
    });

    dataRows.push([
      'সর্বমোট',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'সর্বমোট খেলাপি ঋণ =',
      totalOverdueDebt,
      '',
      '',
    ]);

    const ws = XLSX.utils.aoa_to_sheet(dataRows);
    ws['!cols'] = [
      { wch: 8 },  // ক্র
      { wch: 8 },  // রোল
      { wch: 25 }, // নাম
      { wch: 15 }, // শ্রেণি
      { wch: 8 },  // শাখা
      { wch: 22 }, // পিতা/অভিভাবক
      { wch: 18 }, // মোবাইল
      { wch: 18 }, // বকেয়া দিন
      { wch: 16 }, // শুরুর তারিখ
      { wch: 25 }, // খাতসমূহ
      { wch: 20 }, // খেলাপি টাকা
      { wch: 18 }, // সর্বমোট বকেয়া
      { wch: 16 }, // ঝুঁকি মাত্রা
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'খেলাপি_খতিয়ান');
    const fileName = `fee_defaulters_${agingThreshold}days_${classNameDisplay.replace(/[\s\/\\]+/g, '_')}_${todayStr}.xlsx`;
    XLSX.writeFile(wb, fileName);
    setIsExportDropdownOpen(false);
  };

  const handleExportCSV = () => {
    const headers = [
      'রোল',
      'শিক্ষার্থীর নাম',
      'শ্রেণি',
      'শাখা',
      'অভিভাবকের নাম',
      'অভিভাবকের ফোন',
      'সর্বোচ্চ খেলাপি দিন',
      'প্রাচীনতম বকেয়ার তারিখ',
      'বকেয়া খাতসমূহ',
      'মোট খেলাপি ঋণ (টাকা)',
      'ঝুঁকি মাত্রা',
    ];

    const rows = filteredDefaulters.map((d) => [
      d.student.roll,
      `"${d.student.nameBn}"`,
      `"${d.classNameBn}"`,
      `"${d.student.section}"`,
      `"${d.student.fatherName || d.student.motherName || '-'}"`,
      `"${d.student.guardianPhone || '-'}"`,
      d.maxDaysOverdue,
      `"${d.oldestDueDate}"`,
      `"${d.unpaidHeads.join(', ')}"`,
      d.totalOverdueDue,
      d.severity === 'critical' ? 'গুরুতর' : d.severity === 'high' ? 'উচ্চ' : 'মাঝারি',
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `fee_defaulters_list_${agingThreshold}days_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsExportDropdownOpen(false);
  };

  // Bulk SMS Dispatch
  const handleSendBulkSMS = async () => {
    const targetStudents = filteredDefaulters.filter(
      (d) =>
        (selectedStudentIds.size === 0 || selectedStudentIds.has(d.student.id)) &&
        d.student.guardianPhone
    );

    if (targetStudents.length === 0) {
      alert('এসএমএস পাঠানোর জন্য কোনো অভিভাবকের ফোন নম্বর পাওয়া যায়নি।');
      return;
    }

    const items = targetStudents.map((d) => {
      const personalizedMsg = `ডি-লিকন মডেল একাডেমী: বিশেষ তাগাদা নোটিশ। প্রিয় অভিভাবক, আপনার সন্তান ${d.student.nameBn} (রোল: ${toBengaliRoll(d.student.roll)}, ${d.classNameBn})-এর ${toBengaliNumber(d.maxDaysOverdue)} দিনের বকেয়া ৳ ${toBengaliNumber(d.totalOverdueDue)}/- টাকা দ্রুত পরিশোধ করার অনুরোধ করা হলো। - প্রধান শিক্ষক।`;
      return {
        phone: d.student.guardianPhone!,
        text: bulkSMSText ? bulkSMSText.replace(/\[নাম\]/g, d.student.nameBn) : personalizedMsg,
        recipientName: `${d.student.nameBn} (অভিভাবক)`,
        roll: d.student.roll,
        className: d.classNameBn,
      };
    });

    const res = await sendBatchSMS(items, 'fees');
    setBulkSMSStatus(`${res.sentCount} জন অভিভাবকের কাছে সফলভাবে বকেয়া তাগাদা এসএমএস পাঠানো হয়েছে!`);
    setTimeout(() => {
      setBulkSMSStatus(null);
      setIsBulkSMSModalOpen(false);
      setSelectedStudentIds(new Set());
    }, 2000);
  };

  // Single SMS Dispatch
  const handleSendSingleSMS = async () => {
    if (!singleSMSStudent || !singleSMSStudent.student.guardianPhone) {
      alert('অভিভাবকের মোবাইল নম্বর পাওয়া যায়নি।');
      return;
    }

    const std = singleSMSStudent.student;
    const msg =
      singleSMSText.trim() ||
      `ডি-লিকন মডেল একাডেমী: বকেয়া ফি তাগাদা নোটিশ। প্রিয় অভিভাবক, আপনার সন্তান ${std.nameBn} (রোল: ${toBengaliRoll(std.roll)}, ${singleSMSStudent.classNameBn})-এর বিগত ${toBengaliNumber(singleSMSStudent.maxDaysOverdue)} দিন ধরে সর্বমোট ৳ ${toBengaliNumber(singleSMSStudent.totalOverdueDue)}/- টাকা ফি বকেয়া রয়েছে। দ্রুত বিদ্যালয় অফিসে যোগাযোগ করে ফি পরিশোধের অনুরোধ করা হলো। - হিসাব শাখা।`;

    const res = await sendSingleSMS(std.guardianPhone!, msg, `${std.nameBn} (অভিভাবক)`, {
      roll: std.roll,
      className: singleSMSStudent.classNameBn,
      messageType: 'fees',
      channel: 'device_sms',
    });

    setSingleSMSStatus(res.message);
    setTimeout(() => {
      setSingleSMSStatus(null);
      setSingleSMSStudent(null);
    }, 2000);
  };

  // Quick Pay Submit
  const handleQuickPaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPayStudent) return;
    if (quickPayAmount <= 0) {
      alert('সঠিক টাকার পরিমাণ লিখুন।');
      return;
    }

    const std = quickPayStudent.student;
    const oldestInvoice = quickPayStudent.invoices[0];

    collectFeePayment({
      studentId: std.id,
      invoiceId: oldestInvoice?.id,
      paidAmount: quickPayAmount,
      paymentMethod: quickPayMethod,
      transactionRef: quickPayRef || undefined,
      collectedBy: quickPayCollector || 'হিসাব সহকারী',
      notes: `খেলাপি ঋণ আদায় (${toBengaliNumber(quickPayStudent.maxDaysOverdue)} দিন বকেয়া)`,
      itemsBreakdown: [
        { nameBn: 'বকেয়া ফি ঋণ আদায়', amount: quickPayAmount },
      ],
    });

    setQuickPaySuccess(`${std.nameBn}-এর ৳ ${toBengaliNumber(quickPayAmount)}/- টাকা সফলভাবে গ্রহণ করা হয়েছে।`);
    setTimeout(() => {
      setQuickPaySuccess(null);
      setQuickPayStudent(null);
      setQuickPayAmount(0);
      setQuickPayRef('');
    }, 1500);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Title Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 transition">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="p-2 bg-rose-100 text-rose-800 rounded-xl">
                <ShieldAlert className="w-6 h-6" />
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-serif flex items-center gap-2">
                  <span>ফি খেলাপি ও দীর্ঘমেয়াদী বকেয়া তালিকা (Defaulter List)</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-sans font-bold">
                    ৩০+ দিনের বকেয়া
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-600">
                  {schoolInfo.name || 'ডি-লিকন মডেল একাডেমী'} • দীর্ঘমেয়াদী খেলাপি শিক্ষার্থীদের ঋণ পুনরুদ্ধার, বকেয়া ব্যবস্থাপনা ও তাগাদা কার্যক্রম
                </p>
              </div>
            </div>
          </div>

          {/* Top Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Export to PDF / Excel Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition cursor-pointer"
                title="খেলাপি তালিকা Excel অথবা PDF ফাইলে ডাউনলোড করুন"
              >
                <Download className="w-4 h-4 mr-1.5 text-white" />
                <span>Export to PDF/Excel</span>
                <ChevronDown className="w-3.5 h-3.5 ml-1.5 text-white" />
              </button>

              {isExportDropdownOpen && (
                <div
                  className="absolute left-0 sm:left-auto sm:right-0 mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1 overflow-hidden"
                  onMouseLeave={() => setIsExportDropdownOpen(false)}
                >
                  <div className="px-3 py-1.5 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    খেলাপি খতিয়ান এক্সপোর্ট
                  </div>
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-950 flex items-center transition cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 mr-2.5 text-emerald-600 flex-shrink-0" />
                    <div>
                      <div className="font-bold text-slate-900">এক্সেল রিপোর্ট (.xlsx)</div>
                      <div className="text-[10px] text-slate-500 font-normal">সম্পূর্ণ বকেয়া ও খেলাপি দিনসহ এক্সেল শিট</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsExportDropdownOpen(false);
                      setIsPrintReportOpen(true);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-rose-50 hover:text-rose-950 flex items-center transition cursor-pointer"
                  >
                    <FileText className="w-4 h-4 mr-2.5 text-rose-600 flex-shrink-0" />
                    <div>
                      <div className="font-bold text-slate-900">পিডিএফ খতিয়ান ও প্রিন্ট (.pdf)</div>
                      <div className="text-[10px] text-slate-500 font-normal">অফিসিয়াল A4 সাইজ খেলাপি খতিয়ান</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-950 flex items-center transition cursor-pointer"
                  >
                    <Download className="w-4 h-4 mr-2.5 text-slate-500 flex-shrink-0" />
                    <div>
                      <div className="font-bold text-slate-900">সিএসভি ফাইল (.csv)</div>
                      <div className="text-[10px] text-slate-500 font-normal">সহজ কমা-সেপারেটেড টেক্সট ফাইল</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => setIsPrintReportOpen(true)}
              className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-900 hover:bg-indigo-800 text-white shadow-sm transition cursor-pointer"
              title="এ৪ সাইজে খেলাপি তালিকা প্রিন্ট করুন"
            >
              <Printer className="w-4 h-4 mr-1.5 text-amber-300" />
              খেলাপি খতিয়ান প্রিন্ট
            </button>

            <button
              onClick={() => setIsBulkSMSModalOpen(true)}
              className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-sm transition cursor-pointer"
              title="নির্বাচিত শিক্ষার্থীদের অভিভাবকদের এক ক্লিকে তাগাদা এসএমএস পাঠান"
            >
              <MessageSquare className="w-4 h-4 mr-1.5 text-slate-950" />
              বাল্ক তাগাদা নোটিশ
              {selectedStudentIds.size > 0 && ` (${toBengaliNumber(selectedStudentIds.size)})`}
            </button>

            {onNavigate && (
              <button
                onClick={() => onNavigate('fees')}
                className="inline-flex items-center px-3 py-2 rounded-xl text-xs font-medium bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 transition"
              >
                বকেয়া ড্যাশবোর্ড
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </button>
            )}
          </div>
        </div>

        {/* Quick Filter & Aging Selection Strip */}
        <div className="mt-5 pt-4 border-t border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/80 -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 p-4 rounded-b-2xl">
          {/* Aging Threshold Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-700 flex items-center">
              <Clock className="w-4 h-4 mr-1 text-rose-700" />
              বকেয়ার সময়কাল (Aging):
            </span>

            <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setAgingThreshold(30)}
                className={`px-3 py-1 rounded-md text-xs font-bold transition ${
                  agingThreshold === 30
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                ৩০+ দিন (খেলাপি)
              </button>
              <button
                type="button"
                onClick={() => setAgingThreshold(60)}
                className={`px-3 py-1 rounded-md text-xs font-bold transition ${
                  agingThreshold === 60
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                ৬০+ দিন (উচ্চ খেলাপি)
              </button>
              <button
                type="button"
                onClick={() => setAgingThreshold(90)}
                className={`px-3 py-1 rounded-md text-xs font-bold transition ${
                  agingThreshold === 90
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                ৯০+ দিন (গুরুতর)
              </button>
              <button
                type="button"
                onClick={() => setAgingThreshold(0)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                  agingThreshold === 0
                    ? 'bg-slate-800 text-white font-bold'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                সকল বকেয়া
              </button>
            </div>
          </div>

          {/* Today Date Badge */}
          <div className="text-xs sm:text-sm font-bold text-rose-950 flex items-center bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200">
            <AlertTriangle className="w-4 h-4 mr-1.5 text-rose-600" />
            <span>হিসাবের তারিখ: {formatBengaliDate(todayStr)}</span>
          </div>
        </div>
      </div>

      {/* Top 4 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Overdue Debt */}
        <div className="bg-gradient-to-br from-rose-700 to-rose-900 text-white p-5 rounded-2xl shadow-md border border-rose-600/40 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute right-2 -bottom-2 opacity-15 pointer-events-none">
            <TrendingDown className="w-24 h-24" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-rose-200 font-semibold">
                মোট খেলাপি ঋণ ({toBengaliNumber(agingThreshold)}+ দিন)
              </span>
              <span className="p-1.5 bg-rose-600/60 rounded-lg">
                <AlertOctagon className="w-4 h-4 text-white" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-1">
              <span className="text-3xl font-extrabold tracking-tight font-mono">
                ৳ {toBengaliNumber(totalOverdueDebt)}
              </span>
              <span className="text-xs text-rose-200">/- টাকা</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-rose-600/40 flex items-center justify-between text-xs text-rose-100">
            <span>রিকভারি টার্গেট:</span>
            <span className="font-bold text-white font-mono bg-rose-950/60 px-2 py-0.5 rounded">
              ১০০% তাগাদা
            </span>
          </div>
        </div>

        {/* Defaulter Student Count */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                খেলাপি শিক্ষার্থীর সংখ্যা
              </span>
              <span className="p-1.5 bg-amber-100 text-amber-800 rounded-lg">
                <Users className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-1">
              <span className="text-3xl font-extrabold text-slate-900 font-mono">
                {toBengaliNumber(totalDefaultersCount)}
              </span>
              <span className="text-xs text-slate-500 font-medium">জন শিক্ষার্থী</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>মোট শিক্ষার্থীর:</span>
            <span className="font-bold text-rose-700 font-mono">
              {students.length > 0
                ? toBengaliNumber(Math.round((totalDefaultersCount / students.length) * 100))
                : '০'}
              %
            </span>
          </div>
        </div>

        {/* Average Overdue Days */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                গড় খেলাপি সময়কাল (Aging)
              </span>
              <span className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                <Clock className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-1">
              <span className="text-3xl font-extrabold text-slate-900 font-mono">
                {toBengaliNumber(avgOverdueDays)}
              </span>
              <span className="text-xs text-slate-500 font-medium">দিন ধরে বকেয়া</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>সর্বোচ্চ বকেয়া কাল:</span>
            <span className="font-bold text-indigo-800 font-mono">
              {filteredDefaulters.length > 0
                ? `${toBengaliNumber(filteredDefaulters[0].maxDaysOverdue)} দিন`
                : '০ দিন'}
            </span>
          </div>
        </div>

        {/* High & Critical Defaulters Count */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                উচ্চ ও গুরুতর খেলাপি (৬০+ দিন)
              </span>
              <span className="p-1.5 bg-rose-100 text-rose-700 rounded-lg">
                <AlertTriangle className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-1">
              <span className="text-3xl font-extrabold text-rose-600 font-mono">
                {toBengaliNumber(criticalDefaultersCount)}
              </span>
              <span className="text-xs text-slate-500 font-medium">জন শিক্ষার্থী</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>জরুরি তাগাদা নোটিশ:</span>
            <span className="font-bold text-rose-800">অব্যবহিত আবশ্যক</span>
          </div>
        </div>
      </div>

      {/* Class-wise Debt Breakdown Chips */}
      {classDebtSummary.length > 0 && (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-2">
          <div className="text-xs font-bold text-slate-700 flex items-center">
            <Building className="w-4 h-4 mr-1.5 text-indigo-700" />
            শ্রেণিভিত্তিক খেলাপি ঋণের বণ্টন:
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {classDebtSummary.map((item) => (
              <div
                key={item.classNameBn}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs flex items-center space-x-2"
              >
                <span className="font-bold text-slate-900">{item.classNameBn}:</span>
                <span className="text-slate-600">{toBengaliNumber(item.count)} জন</span>
                <span className="font-mono font-bold text-rose-700">
                  ৳ {toBengaliNumber(item.totalDebt)}/-
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Defaulters Table Card with Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Table Controls Bar */}
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/70">
          <div className="flex flex-wrap items-center gap-3">
            {/* Class Filter */}
            <div className="flex items-center space-x-1.5">
              <label className="text-xs font-bold text-slate-700">শ্রেণি:</label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 font-medium focus:ring-1 focus:ring-rose-500 focus:outline-none"
              >
                <option value="all">সকল শ্রেণি</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameBn}
                  </option>
                ))}
              </select>
            </div>

            {/* Section Filter */}
            <div className="flex items-center space-x-1.5">
              <label className="text-xs font-bold text-slate-700">শাখা:</label>
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 font-medium focus:ring-1 focus:ring-rose-500 focus:outline-none"
              >
                <option value="all">সকল শাখা</option>
                <option value="ক">ক শাখা</option>
                <option value="খ">খ শাখা</option>
                <option value="গ">গ শাখা</option>
              </select>
            </div>

            {/* Severity Filter */}
            <div className="flex items-center space-x-1.5">
              <label className="text-xs font-bold text-slate-700">ঝুঁকি মাত্রা:</label>
              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value as any)}
                className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 font-medium focus:ring-1 focus:ring-rose-500 focus:outline-none"
              >
                <option value="all">সকল মাত্রা</option>
                <option value="critical">গুরুতর (৯০+ দিন)</option>
                <option value="high">উচ্চ (৬০-৯০ দিন)</option>
                <option value="moderate">মাঝারি (৩০-৬০ দিন)</option>
              </select>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="শিক্ষার্থীর নাম, রোল বা ফোন..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-8 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-rose-500 focus:outline-none"
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

        {/* Selection summary bar */}
        {selectedStudentIds.size > 0 && (
          <div className="bg-amber-50 px-4 py-2 border-b border-amber-200 flex items-center justify-between text-xs text-amber-900 font-medium">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-amber-600" />
              <span>
                <strong>{toBengaliNumber(selectedStudentIds.size)}</strong> জন শিক্ষার্থী নির্বাচিত হয়েছে।
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsBulkSMSModalOpen(true)}
                className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg shadow-2xs transition"
              >
                নির্বাচিতদের তাগাদা এসএমএস পাঠান
              </button>
              <button
                onClick={() => setSelectedStudentIds(new Set())}
                className="px-2 py-1 text-slate-600 hover:text-slate-900 underline"
              >
                নির্বাচন বাতিল
              </button>
            </div>
          </div>
        )}

        {/* Defaulter Table */}
        <div className="overflow-x-auto">
          {filteredDefaulters.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-14 h-14 mx-auto bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-3">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                নির্বাচিত শর্তে কোনো ফি খেলাপি শিক্ষার্থী নেই!
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                {agingThreshold > 0
                  ? `বিগত ${toBengaliNumber(agingThreshold)} দিনের অধিক সময় ধরে বকেয়া রয়েছে এমন কোনো শিক্ষার্থী পাওয়া যায়নি।`
                  : 'সকল শিক্ষার্থীর বকেয়া পরিশোধিত।'}
              </p>
              {agingThreshold > 0 && (
                <button
                  onClick={() => setAgingThreshold(0)}
                  className="mt-4 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition"
                >
                  সকল বকেয়াদার তালিকা দেখুন
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 text-[11px] uppercase tracking-wider">
                  <th className="py-2.5 px-3 w-8 text-center">
                    <input
                      type="checkbox"
                      checked={
                        selectedStudentIds.size === filteredDefaulters.length &&
                        filteredDefaulters.length > 0
                      }
                      onChange={handleToggleSelectAll}
                      className="rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                    />
                  </th>
                  <th className="py-2.5 px-3 text-center w-12">রোল</th>
                  <th className="py-2.5 px-3">শিক্ষার্থীর নাম</th>
                  <th className="py-2.5 px-3">শ্রেণি ও শাখা</th>
                  <th className="py-2.5 px-3">অভিভাবক ও মোবাইল</th>
                  <th className="py-2.5 px-3 text-center">বকেয়ার বয়স (দিন)</th>
                  <th className="py-2.5 px-3">বকেয়া বিল ও খাতসমূহ</th>
                  <th className="py-2.5 px-3 text-right">মোট খেলাপি ঋণ</th>
                  <th className="py-2.5 px-3 text-center">ঝুঁকি মাত্রা</th>
                  <th className="py-2.5 px-3 text-center w-48">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredDefaulters.map((item, idx) => {
                  const isSelected = selectedStudentIds.has(item.student.id);

                  return (
                    <tr
                      key={item.student.id}
                      className={`hover:bg-rose-50/30 transition duration-150 ${
                        isSelected ? 'bg-amber-50/40' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleStudent(item.student.id)}
                          className="rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900">
                        {toBengaliRoll(item.student.roll)}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900">{item.student.nameBn}</div>
                        {item.student.nameEn && (
                          <div className="text-[10px] text-slate-400">{item.student.nameEn}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                        <span className="font-medium">{item.classNameBn}</span>
                        <span className="text-slate-400 text-xs"> ({item.student.section})</span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="text-slate-800 text-xs">
                          {item.student.fatherName || item.student.motherName || 'অভিভাবক'}
                        </div>
                        {item.student.guardianPhone ? (
                          <div className="text-[11px] font-mono text-indigo-700 font-semibold flex items-center">
                            <Phone className="w-3 h-3 mr-1 text-slate-400" />
                            {toBengaliNumber(item.student.guardianPhone)}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400">ফোন নম্বর নেই</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center px-2 py-0.5 rounded-full font-mono font-bold text-xs bg-rose-100 text-rose-800 border border-rose-300">
                          <Clock className="w-3 h-3 mr-1 text-rose-600" />
                          {toBengaliNumber(item.maxDaysOverdue)} দিন
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                          শুরু: {toBengaliNumber(item.oldestDueDate)}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 max-w-xs">
                        <div className="flex flex-wrap gap-1">
                          {item.unpaidHeads.map((head, hIdx) => (
                            <span
                              key={hIdx}
                              className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium"
                            >
                              {head}
                            </span>
                          ))}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                          মোট {toBengaliNumber(item.invoices.length)}টি ইনভয়েসে বকেয়া
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700 text-sm whitespace-nowrap">
                        ৳ {toBengaliNumber(item.totalOverdueDue)}/-
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {item.severity === 'critical' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                            গুরুতর (৯০+)
                          </span>
                        ) : item.severity === 'high' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            উচ্চ (৬০+)
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-300">
                            মাঝারি (৩০+)
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center space-x-1">
                          {/* Quick Pay Button */}
                          <button
                            onClick={() => {
                              setQuickPayStudent(item);
                              setQuickPayAmount(item.totalOverdueDue);
                            }}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold transition shadow-2xs"
                            title="বকেয়া ঋণ আদায় করুন"
                          >
                            ফি আদায়
                          </button>

                          {/* Due Slip Voucher Print */}
                          <button
                            onClick={() => {
                              setViewingVoucher({
                                student: item.student,
                                invoice: item.invoices[0],
                                voucherType: 'due_slip',
                              });
                            }}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded text-[11px] font-semibold transition"
                            title="৮-খাত অফিসিয়াল ডিউ স্লিপ প্রিন্ট"
                          >
                            ডিউ স্লিপ
                          </button>

                          {/* Send Single Recovery SMS */}
                          {item.student.guardianPhone && (
                            <button
                              onClick={() => {
                                setSingleSMSStudent(item);
                                setSingleSMSText(
                                  `ডি-লিকন মডেল একাডেমী: বকেয়া ফি তাগাদা নোটিশ। প্রিয় অভিভাবক, আপনার সন্তান ${item.student.nameBn} (রোল: ${toBengaliRoll(item.student.roll)}, ${item.classNameBn})-এর বিগত ${toBengaliNumber(item.maxDaysOverdue)} দিন ধরে সর্বমোট ৳ ${toBengaliNumber(item.totalOverdueDue)}/- টাকা ফি বকেয়া রয়েছে। দ্রুত বিদ্যালয় অফিসে যোগাযোগ করে ফি পরিশোধের অনুরোধ করা হলো। - প্রধান শিক্ষক।`
                                );
                              }}
                              className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded"
                              title="অভিভাবককে তাগাদা নোটিশ এসএমএস পাঠান"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Jump to Student Ledger */}
                          {onOpenStudentHistory && (
                            <button
                              onClick={() => onOpenStudentHistory(item.student.id)}
                              className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[11px] font-medium transition"
                              title="শিক্ষার্থীর পূর্ণ পেমেন্ট খতিয়ান দেখুন"
                            >
                              লেজার
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Table Footer */}
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                  <td colSpan={7} className="py-3 px-3 text-right text-xs">
                    মোট খেলাপি ঋণ ({toBengaliNumber(filteredDefaulters.length)} জন শিক্ষার্থী):
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-rose-800 text-base">
                    ৳ {toBengaliNumber(totalOverdueDebt)}/-
                  </td>
                  <td colSpan={2} className="py-3 px-3"></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PRINTABLE OFFICIAL DEFAULTER LIST REPORT (A4 Format)                      */}
      {/* ========================================================================= */}
      {isPrintReportOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[96vh] flex flex-col overflow-hidden">
            {/* Modal Controls (Hidden in print) */}
            <div className="no-print p-4 bg-rose-950 text-white flex flex-wrap items-center justify-between gap-3 border-b border-rose-800">
              <div className="flex items-center space-x-2">
                <Printer className="w-5 h-5 text-amber-300" />
                <div>
                  <h3 className="font-bold text-sm sm:text-base font-serif">
                    ফি খেলাপি ও দীর্ঘমেয়াদী বকেয়া খতিয়ান (PDF / A4 প্রিন্ট প্রিভিউ)
                  </h3>
                  <p className="text-[11px] text-rose-200">
                    ব্রাউজার প্রিন্ট ডায়ালগে "Save as PDF" নির্বাচন করে পিডিএফ সংরক্ষণ অথবা সরাসরি প্রিন্ট করুন।
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center space-x-1 shadow-sm transition cursor-pointer"
                  title="এক্সেল ফাইলে ডাউনলোড করুন"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 mr-1" />
                  <span>এক্সেল (.xlsx)</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs sm:text-sm flex items-center space-x-1 shadow transition cursor-pointer"
                  title="PDF হিসেবে সংরক্ষণ অথবা প্রিন্ট করুন"
                >
                  <Printer className="w-4 h-4 mr-1.5 text-slate-950" />
                  <span>PDF সংরক্ষণ / প্রিন্ট</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintReportOpen(false)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Report Sheet */}
            <div className="p-6 overflow-y-auto printable-area bg-white text-slate-900 font-serif">
              {/* School Header */}
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
                  ফি খেলাপি ও ঋণ পুনরুদ্ধার খতিয়ান (Fee Defaulter Statement)
                </div>
                <div className="mt-1 text-xs text-slate-600 font-sans">
                  খেলাপি শর্ত: {toBengaliNumber(agingThreshold)} দিনের অধিক বকেয়া | হিসাবের তারিখ: {formatBengaliDate(todayStr)}
                </div>
              </div>

              {/* KPI Summary Cards in Print */}
              <div className="grid grid-cols-4 gap-2 mb-4 text-xs font-sans">
                <div className="p-2 border border-slate-400 rounded bg-slate-50 text-center">
                  <div className="text-[11px] text-slate-600 font-medium">মোট খেলাপি ঋণ</div>
                  <div className="text-sm font-bold font-mono text-slate-950">
                    ৳ {toBengaliNumber(totalOverdueDebt)}/-
                  </div>
                </div>
                <div className="p-2 border border-slate-400 rounded bg-slate-50 text-center">
                  <div className="text-[11px] text-slate-600 font-medium">খেলাপি শিক্ষার্থী</div>
                  <div className="text-sm font-bold font-mono text-slate-950">
                    {toBengaliNumber(totalDefaultersCount)} জন
                  </div>
                </div>
                <div className="p-2 border border-slate-400 rounded bg-slate-50 text-center">
                  <div className="text-[11px] text-slate-600 font-medium">গড় খেলাপি দিন</div>
                  <div className="text-sm font-bold font-mono text-slate-950">
                    {toBengaliNumber(avgOverdueDays)} দিন
                  </div>
                </div>
                <div className="p-2 border border-slate-400 rounded bg-slate-50 text-center">
                  <div className="text-[11px] text-slate-600 font-medium">উচ্চ ঝুঁকি (৬০+ দিন)</div>
                  <div className="text-sm font-bold font-mono text-slate-950">
                    {toBengaliNumber(criticalDefaultersCount)} জন
                  </div>
                </div>
              </div>

              {/* Defaulters Table */}
              <div className="mb-6">
                <table className="w-full text-xs border border-slate-800 border-collapse font-sans">
                  <thead>
                    <tr className="bg-slate-100 font-bold border-b border-slate-800 text-[11px]">
                      <th className="p-1 border-r border-slate-800 text-center w-8">ক্র.</th>
                      <th className="p-1 border-r border-slate-800 text-center w-12">রোল</th>
                      <th className="p-1 border-r border-slate-800 text-left">শিক্ষার্থীর নাম</th>
                      <th className="p-1 border-r border-slate-800 text-left w-20">শ্রেণি</th>
                      <th className="p-1 border-r border-slate-800 text-left">অভিভাবক ও ফোন</th>
                      <th className="p-1 border-r border-slate-800 text-center w-16">বকেয়া দিন</th>
                      <th className="p-1 border-r border-slate-800 text-left">খাতসমূহ</th>
                      <th className="p-1 border-slate-800 text-right w-24">খেলাপি টাকা</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDefaulters.map((item, idx) => (
                      <tr key={item.student.id} className="border-b border-slate-300">
                        <td className="p-1 border-r border-slate-800 text-center font-mono">
                          {toBengaliNumber(idx + 1)}
                        </td>
                        <td className="p-1 border-r border-slate-800 text-center font-mono font-bold">
                          {toBengaliRoll(item.student.roll)}
                        </td>
                        <td className="p-1 border-r border-slate-800 font-medium">
                          {item.student.nameBn}
                        </td>
                        <td className="p-1 border-r border-slate-800">
                          {item.classNameBn} ({item.student.section})
                        </td>
                        <td className="p-1 border-r border-slate-800 text-[11px]">
                          <div>{item.student.fatherName || item.student.motherName || '-'}</div>
                          <div className="font-mono text-slate-600">
                            {item.student.guardianPhone ? toBengaliNumber(item.student.guardianPhone) : '-'}
                          </div>
                        </td>
                        <td className="p-1 border-r border-slate-800 text-center font-mono font-bold">
                          {toBengaliNumber(item.maxDaysOverdue)} দিন
                        </td>
                        <td className="p-1 border-r border-slate-800 text-[10px]">
                          {item.unpaidHeads.join(', ')}
                        </td>
                        <td className="p-1 border-slate-800 text-right font-mono font-bold">
                          {toBengaliNumber(item.totalOverdueDue)}/-
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-100 font-bold border-t-2 border-slate-800">
                      <td colSpan={7} className="p-1 text-right border-r border-slate-800">
                        সর্বমোট খেলাপি ঋণ =
                      </td>
                      <td className="p-1 text-right font-mono text-slate-950 font-bold">
                        ৳ {toBengaliNumber(totalOverdueDebt)}/-
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* In words */}
                <div className="mt-2 text-xs font-serif">
                  <span className="font-bold">কথায়: </span>
                  <span className="italic underline">{numberToBengaliWords(totalOverdueDebt)}</span>
                </div>
              </div>

              {/* Signatures */}
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
      {/* BULK SMS DISPATCH MODAL                                                   */}
      {/* ========================================================================= */}
      {isBulkSMSModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 relative">
            <button
              onClick={() => setIsBulkSMSModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2 mb-4 pb-3 border-b border-slate-200">
              <span className="p-2 bg-amber-100 text-amber-800 rounded-lg">
                <MessageSquare className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-bold text-slate-900 text-base">বাল্ক তাগাদা নোটিশ পাঠান</h3>
                <p className="text-xs text-slate-500">
                  {selectedStudentIds.size > 0
                    ? `নির্বাচিত ${toBengaliNumber(selectedStudentIds.size)} জন অভিভাবকের নম্বরে পাঠানো হবে`
                    : `সকল ${toBengaliNumber(filteredDefaulters.length)} জন খেলাপি শিক্ষার্থীর অভিভাবকদের কাছে পাঠানো হবে`}
                </p>
              </div>
            </div>

            {bulkSMSStatus ? (
              <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 text-center font-bold text-sm">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-1 text-emerald-600" />
                {bulkSMSStatus}
              </div>
            ) : (
              <div className="space-y-4 text-xs sm:text-sm">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    এসএমএস বার্তার খসড়া:
                  </label>
                  <textarea
                    rows={4}
                    value={bulkSMSText}
                    onChange={(e) => setBulkSMSText(e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-xl text-slate-800 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    টিপস: প্রতিটি এসএমএসে শিক্ষার্থীর নাম, রোল ও বকেয়া টাকার পরিমাণ স্বয়ংক্রিয়ভাবে পারসোনালাইজ হয়ে যাবে।
                  </p>
                </div>

                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900">
                  <span className="font-bold">সতর্কতা:</span> অভিভাবকের ফোন নম্বরে তাত্ক্ষণিকভাবে তাগাদা নোটিশ প্রেরিত হবে।
                </div>

                <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsBulkSMSModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl font-medium"
                  >
                    বাতিল
                  </button>
                  <button
                    type="button"
                    onClick={handleSendBulkSMS}
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl font-bold flex items-center space-x-1.5 shadow-sm"
                  >
                    <Send className="w-4 h-4" />
                    <span>এসএমএস পাঠিয়ে দিন</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SINGLE SMS MODAL                                                          */}
      {/* ========================================================================= */}
      {singleSMSStudent && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
            <button
              onClick={() => setSingleSMSStudent(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2 mb-3 pb-2 border-b border-slate-200">
              <span className="p-2 bg-rose-100 text-rose-800 rounded-lg">
                <MessageSquare className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-bold text-slate-900 text-base">তাগাদা এসএমএস পাঠান</h3>
                <p className="text-xs text-slate-500">
                  {singleSMSStudent.student.nameBn} (রোল: {toBengaliRoll(singleSMSStudent.student.roll)})
                </p>
              </div>
            </div>

            {singleSMSStatus ? (
              <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 text-center font-bold text-sm">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-1 text-emerald-600" />
                {singleSMSStatus}
              </div>
            ) : (
              <div className="space-y-3 text-xs sm:text-sm">
                <div className="p-2 bg-slate-50 rounded border border-slate-200 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">অভিভাবকের ফোন:</span>
                    <span className="font-mono font-bold text-indigo-700">
                      {toBengaliNumber(singleSMSStudent.student.guardianPhone || '')}
                    </span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-slate-500">মোট বকেয়া:</span>
                    <span className="font-mono font-bold text-rose-700">
                      ৳ {toBengaliNumber(singleSMSStudent.totalOverdueDue)}/-
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    এসএমএস টেক্সট:
                  </label>
                  <textarea
                    rows={4}
                    value={singleSMSText}
                    onChange={(e) => setSingleSMSText(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-1 focus:ring-rose-500 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setSingleSMSStudent(null)}
                    className="px-3 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg font-medium"
                  >
                    বাতিল
                  </button>
                  <button
                    type="button"
                    onClick={handleSendSingleSMS}
                    className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold flex items-center space-x-1 shadow-sm"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>পাঠান</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* QUICK PAY MODAL                                                           */}
      {/* ========================================================================= */}
      {quickPayStudent && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
            <button
              onClick={() => setQuickPayStudent(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2 mb-3 pb-2 border-b border-slate-200">
              <span className="p-2 bg-emerald-100 text-emerald-800 rounded-lg">
                <CreditCard className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-bold text-slate-900 text-base">খেলাপি ফি ঋণ আদায়</h3>
                <p className="text-xs text-slate-500">
                  {quickPayStudent.student.nameBn} • রোল: {toBengaliRoll(quickPayStudent.student.roll)} ({quickPayStudent.classNameBn})
                </p>
              </div>
            </div>

            {quickPaySuccess ? (
              <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 text-center font-bold text-sm">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-1 text-emerald-600" />
                {quickPaySuccess}
              </div>
            ) : (
              <form onSubmit={handleQuickPaySubmit} className="space-y-3 text-xs sm:text-sm">
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex justify-between items-center text-xs">
                  <span className="text-rose-900 font-semibold">
                    বিগত {toBengaliNumber(quickPayStudent.maxDaysOverdue)} দিনের মোট বকেয়া:
                  </span>
                  <span className="font-mono font-bold text-rose-700 text-sm">
                    ৳ {toBengaliNumber(quickPayStudent.totalOverdueDue)}/-
                  </span>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    আদায়কৃত টাকার পরিমাণ (৳):
                  </label>
                  <input
                    type="number"
                    value={quickPayAmount || ''}
                    onChange={(e) => setQuickPayAmount(Number(e.target.value))}
                    required
                    min={1}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-bold font-mono focus:ring-1 focus:ring-emerald-500 focus:outline-none"
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
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="নগদ">নগদ</option>
                      <option value="বিকাশ">বিকাশ</option>
                      <option value="নগদ/রকেট">নগদ / রকেট</option>
                      <option value="ব্যাংক">ব্যাংক</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      আদায়কারী:
                    </label>
                    <input
                      type="text"
                      value={quickPayCollector}
                      onChange={(e) => setQuickPayCollector(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    ট্রানজেকশন রেফারেন্স (ঐচ্ছিক):
                  </label>
                  <input
                    type="text"
                    placeholder="যেমন: CASH-DEBT-01"
                    value={quickPayRef}
                    onChange={(e) => setQuickPayRef(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 font-mono focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setQuickPayStudent(null)}
                    className="px-3 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg font-medium"
                  >
                    বাতিল
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm"
                  >
                    পেমেন্ট সম্পন্ন করুন
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
