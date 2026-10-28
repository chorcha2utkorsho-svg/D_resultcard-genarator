import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Users,
  UserPlus,
  Upload,
  Download,
  Trash2,
  Edit2,
  Search,
  Filter,
  CheckCircle,
  FileSpreadsheet,
  AlertCircle,
  AlertTriangle,
  ArrowRightLeft,
  CheckSquare,
  Square,
  RefreshCw,
  Sparkles,
  List,
  Printer,
  FileText,
  ChevronDown,
  X,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { Student } from '../types';
import { toBengaliNumber, toBengaliRoll, formatBengaliDate } from '../utils/bengali';
import { SchoolLogo } from './SchoolLogo';
import { BulkStudentRegistration } from './BulkStudentRegistration';
import {
  downloadStudentCSVTemplate,
  downloadStudentExcelTemplate,
  parseStudentData,
  detectClassFromFilename,
} from '../utils/studentBulkImport';

export const StudentManagement: React.FC = () => {
  const {
    schoolInfo,
    students,
    classes,
    addStudent,
    updateStudent,
    deleteStudent,
    bulkImportStudents,
    moveStudentsToClass,
    deleteStudentsByClass,
    deleteMultipleStudents,
    selectedClassId,
    setSelectedClassId,
    selectedSection,
    setSelectedSection,
    selectedYear,
  } = useSchool();

  const [activeView, setActiveView] = useState<'list' | 'bulk_upload'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [classFilter, setClassFilter] = useState<string>(selectedClassId || 'all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = useState(false);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const [isPrintDirectoryOpen, setIsPrintDirectoryOpen] = useState(false);

  // Form state for single student
  const [formData, setFormData] = useState({
    nameBn: '',
    nameEn: '',
    roll: 1,
    classId: selectedClassId,
    section: selectedSection || 'ক',
    academicYear: '২০২৬',
    fatherName: '',
    motherName: '',
    guardianPhone: '',
    gender: 'ছাত্র' as 'ছাত্র' | 'ছাত্রী',
    bloodGroup: '',
  });

  // Bulk Upload state
  const [bulkText, setBulkText] = useState('');
  const [bulkPreview, setBulkPreview] = useState<Omit<Student, 'id'>[]>([]);
  const [bulkSuccessMsg, setBulkSuccessMsg] = useState<string | null>(null);

  // Emergency Class Fix / Cleanup Modal states
  const [isFixModalOpen, setIsFixModalOpen] = useState(false);
  const [fixSourceClassId, setFixSourceClassId] = useState(selectedClassId || 'class_play');
  const [selectedFixStudentIds, setSelectedFixStudentIds] = useState<string[]>([]);
  const [targetMoveClassId, setTargetMoveClassId] = useState<string>('class_7');
  const [fixSearch, setFixSearch] = useState('');
  const [fixSuccessMsg, setFixSuccessMsg] = useState<string | null>(null);
  const [isConfirmWipeOpen, setIsConfirmWipeOpen] = useState(false);

  // Handle moving selected students to another class
  const handleExecuteMove = () => {
    if (selectedFixStudentIds.length === 0) {
      alert('স্থানান্তর করার জন্য কমপক্ষে একজন শিক্ষার্থী নির্বাচন করুন।');
      return;
    }
    const targetClass = classes.find((c) => c.id === targetMoveClassId);
    const count = moveStudentsToClass(selectedFixStudentIds, targetMoveClassId);
    setFixSuccessMsg(`${toBengaliNumber(count)} জন শিক্ষার্থীকে সফলভাবে ${targetClass?.nameBn || 'নতুন শ্রেণিতে'} স্থানান্তর করা হয়েছে!`);
    setSelectedFixStudentIds([]);
    setTimeout(() => {
      setFixSuccessMsg(null);
    }, 3500);
  };

  // Handle wiping all students in a class
  const handleExecuteWipeClass = (classIdToWipe: string) => {
    const targetCls = classes.find((c) => c.id === classIdToWipe);
    const count = deleteStudentsByClass(classIdToWipe);
    setIsConfirmWipeOpen(false);
    setSelectedFixStudentIds([]);
    setFixSuccessMsg(`${targetCls?.nameBn || 'শ্রেণি'} থেকে সর্বমোট ${toBengaliNumber(count)} জন শিক্ষার্থীর ডাটা মুছে ফেলা হয়েছে। এখন আপনি পরিষ্কারভাবে নতুন ফাইল আপলোড দিতে পারেন।`);
    setTimeout(() => {
      setFixSuccessMsg(null);
    }, 4500);
  };

  // Filter students based on classFilter
  const filtered = students.filter((s) => {
    const matchClass = classFilter === 'all' ? true : s.classId === classFilter;
    const matchSection = !selectedSection || s.section === selectedSection;
    const matchSearch =
      !searchTerm ||
      s.nameBn.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.nameEn && s.nameEn.toLowerCase().includes(searchTerm.toLowerCase())) ||
      String(s.roll).includes(searchTerm);
    return matchClass && matchSection && matchSearch;
  });

  const handleOpenAdd = () => {
    const activeClassId = classFilter !== 'all' ? classFilter : selectedClassId || 'class_play';
    const classStudents = students.filter((s) => s.classId === activeClassId);
    const nextRoll = classStudents.length > 0 ? Math.max(...classStudents.map((s) => s.roll)) + 1 : 1;
    setFormData({
      nameBn: '',
      nameEn: '',
      roll: nextRoll,
      classId: activeClassId,
      section: selectedSection || 'ক',
      academicYear: '২০২৬',
      fatherName: '',
      motherName: '',
      guardianPhone: '',
      gender: 'ছাত্র',
      bloodGroup: '',
    });
    setEditingStudent(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      nameBn: student.nameBn,
      nameEn: student.nameEn || '',
      roll: student.roll,
      classId: student.classId,
      section: student.section,
      academicYear: student.academicYear,
      fatherName: student.fatherName || '',
      motherName: student.motherName || '',
      guardianPhone: student.guardianPhone || '',
      gender: student.gender || 'ছাত্র',
      bloodGroup: student.bloodGroup || '',
    });
    setIsAddModalOpen(true);
  };

  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nameBn.trim()) {
      alert('শিক্ষার্থীর নাম (বাংলায়) আবশ্যক');
      return;
    }

    if (editingStudent) {
      updateStudent({
        ...editingStudent,
        ...formData,
      });
    } else {
      addStudent(formData);
    }

    setIsAddModalOpen(false);
  };

  // Parse bulk text (CSV / TSV)
  const handleParseBulk = (text: string) => {
    setBulkText(text);
    if (!text.trim()) {
      setBulkPreview([]);
      return;
    }

    const lines = text.trim().split('\n');
    const parsed: Omit<Student, 'id'>[] = [];

    lines.forEach((line) => {
      // Remove commas or tabs
      const delimiter = line.includes('\t') ? '\t' : ',';
      const cols = line.split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ''));
      if (cols.length >= 2) {
        // Roll, NameBn, NameEn, Section, Phone, Father, Mother, Blood
        const rollNum = parseInt(cols[0], 10) || parsed.length + 1;
        const nameBn = cols[1];
        const nameEn = cols[2] || '';
        const section = cols[3] || selectedSection || 'ক';
        const phone = cols[4] || '';
        const father = cols[5] || '';
        const mother = cols[6] || '';
        const blood = cols[7] || '';

        if (nameBn) {
          parsed.push({
            roll: rollNum,
            nameBn,
            nameEn,
            classId: selectedClassId,
            section,
            academicYear: '২০২৬',
            guardianPhone: phone,
            fatherName: father,
            motherName: mother,
            bloodGroup: blood,
            gender: 'ছাত্র',
          });
        }
      }
    });

    setBulkPreview(parsed);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const detected = detectClassFromFilename(file.name, classes);
    const targetCls = detected?.classId || selectedClassId;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = (evt.target?.result as string) || '';
      const parsedRows = parseStudentData(
        content,
        targetCls,
        selectedSection || 'ক',
        selectedYear,
        classes,
        { fileName: file.name }
      );
      const studentsData: Omit<Student, 'id'>[] = parsedRows.map((r) => ({
        roll: r.roll,
        nameBn: r.nameBn,
        nameEn: r.nameEn || '',
        classId: r.classId,
        section: r.section || selectedSection || 'ক',
        gender: r.gender,
        guardianPhone: r.guardianPhone || '',
        fatherName: r.fatherName || '',
        motherName: r.motherName || '',
        bloodGroup: r.bloodGroup || '',
        academicYear: r.academicYear || selectedYear,
      }));
      setBulkPreview(studentsData);
    };
    reader.readAsText(file);
  };

  const handleExecuteBulkImport = () => {
    if (bulkPreview.length === 0) return;
    const count = bulkImportStudents(bulkPreview);
    setBulkSuccessMsg(`${toBengaliNumber(count)} জন শিক্ষার্থীর তথ্য সফলভাবে ডাটাবেসে আপলোড করা হয়েছে!`);
    setTimeout(() => {
      setBulkSuccessMsg(null);
      setIsBulkModalOpen(false);
      setBulkText('');
      setBulkPreview([]);
    }, 1800);
  };

  const loadSampleBulkData = () => {
    const sample = `১,আহমেদ হাসান,Ahmed Hasan,ক,০১৭০০-১২২৩৩৪,মোঃ শহীদুল ইসলাম,সুলতানা বেগম,A+
২,ফারহানা আক্তার,Farhana Akter,ক,০১৮১১-২২৩৩৪৪,মোঃ দেলোয়ার হোসেন,রোকেয়া খাতুন,O+
৩,সাকিব আল মামুন,Sakib Al Mamun,ক,০১৯২২-৩৩৪৪৫৫,মোঃ আব্দুল গফুর,শিরীন আক্তার,B+
৪,তাসনিয়া রহমান,Tasnia Rahman,ক,০১৩৩৩-৪৫৫৫৬৬,মোঃ হাবিবুর রহমান,নাসিমা বেগম,AB+
৫,তাহমিদ ইসলাম,Tahmid Islam,ক,০১৭৪৪-৫৫৬৬৭৭,মোঃ জিয়াউল হক,পারভীন আক্তার,O+`;
    handleParseBulk(sample);
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const currentClassName =
      classFilter === 'all'
        ? 'সকল শ্রেণির শিক্ষার্থী'
        : classes.find((c) => c.id === classFilter)?.nameBn || 'শিক্ষার্থী';

    const todayStr = new Date().toISOString().split('T')[0];

    const dataRows: (string | number)[][] = [
      ['ডি-লিকন মডেল একাডেমী'],
      [`শিক্ষার্থী তথ্য তালিকা ও রেজিস্টার: ${currentClassName}`],
      [
        `শিক্ষাবর্ষ: ${selectedYear || '২০২৬'} | শাখা: ${selectedSection || 'সকল শাখা'} | মোট শিক্ষার্থী: ${filtered.length} জন | ডাউনলোড তারিখ: ${todayStr}`,
      ],
      [''],
      [
        'ক্রমিক',
        'রোল',
        'শিক্ষার্থীর নাম (বাংলা)',
        'শিক্ষার্থীর নাম (ইংরেজি)',
        'শ্রেণি',
        'শাখা',
        'লিঙ্গ',
        'রক্তের গ্রুপ',
        'অভিভাবক মোবাইল',
        'পিতার নাম',
        'মাতার নাম',
        'শিক্ষাবর্ষ',
      ],
    ];

    filtered.forEach((s, idx) => {
      const clsName = classes.find((c) => c.id === s.classId)?.nameBn || s.classId;
      dataRows.push([
        idx + 1,
        s.roll,
        s.nameBn,
        s.nameEn || '',
        clsName,
        s.section || 'ক',
        s.gender || 'ছাত্র',
        s.bloodGroup || '',
        s.guardianPhone || '',
        s.fatherName || '',
        s.motherName || '',
        s.academicYear || selectedYear || '২০২৬',
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(dataRows);
    ws['!cols'] = [
      { wch: 8 },  // ক্রমিক
      { wch: 8 },  // রোল
      { wch: 25 }, // নাম (বাংলা)
      { wch: 22 }, // নাম (ইংরেজি)
      { wch: 14 }, // শ্রেণি
      { wch: 8 },  // শাখা
      { wch: 10 }, // লিঙ্গ
      { wch: 12 }, // রক্তের গ্রুপ
      { wch: 18 }, // অভিভাবক ফোন
      { wch: 22 }, // পিতার নাম
      { wch: 22 }, // মাতার নাম
      { wch: 12 }, // শিক্ষাবর্ষ
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'শিক্ষার্থী_তালিকা');

    const cleanClassName = currentClassName.replace(/[\s\/\\]+/g, '_');
    const fileName = `student_list_${cleanClassName}_${todayStr}.xlsx`;
    XLSX.writeFile(wb, fileName);
    setIsExportDropdownOpen(false);
  };

  const handleExportCSV = () => {
    let csv = `রোল,নাম (বাংলা),নাম (ইংরেজি),শ্রেণি,শাখা,পিতার নাম,মাতার নাম,অভিভাবক ফোন,রক্তের গ্রুপ\n`;
    filtered.forEach((s) => {
      const cls = classes.find((c) => c.id === s.classId)?.nameBn || s.classId;
      csv += `${s.roll},"${s.nameBn}","${s.nameEn || ''}","${cls}","${s.section || ''}","${s.fatherName || ''}","${s.motherName || ''}","${s.guardianPhone || ''}","${s.bloodGroup || ''}"\n`;
    });

    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const currentClassName =
      classFilter === 'all'
        ? 'all_classes'
        : classes.find((c) => c.id === classFilter)?.nameBn || classFilter;
    link.download = `students_list_${currentClassName.replace(/\s+/g, '_')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setIsExportDropdownOpen(false);
  };

  const currentClass = classes.find((c) => c.id === selectedClassId) || classes[0];

  return (
    <div className="space-y-6">
      {/* Control bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 font-serif flex items-center">
              <Users className="w-5 h-5 mr-2 text-indigo-600" />
              সকল শ্রেণির শিক্ষার্থী তথ্য ও সিএসভি বাল্ক রেজিস্ট্রেশন
            </h2>
            <p className="text-xs text-slate-500">
              শিক্ষার্থীদের তথ্য পরিচালনা, নতুন ভর্তি এবং সিএসভি বা এক্সেল টেমপ্লেট দিয়ে একসাথে সম্পূর্ণ শ্রেণির তথ্য আপলোড করুন।
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Template Download Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsTemplateDropdownOpen(!isTemplateDropdownOpen)}
                className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 shadow-2xs transition"
                title="রেজিস্ট্রেশনের জন্য প্রস্তুতকৃত স্ট্যান্ডার্ড সিএসভি বা এক্সেল টেমপ্লেট ডাউনলোড করুন"
              >
                <Download className="w-3.5 h-3.5 mr-1 text-emerald-700" />
                টেমপ্লেট ডাউনলোড
              </button>

              {isTemplateDropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-30 animate-in fade-in-50"
                  onClick={() => setIsTemplateDropdownOpen(false)}
                >
                  <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    রেজিস্ট্রেশন টেমপ্লেট ফাইল
                  </div>
                  <button
                    onClick={() =>
                      downloadStudentCSVTemplate(
                        true,
                        currentClass?.nameBn || 'চতুর্থ শ্রেণি',
                        selectedSection || 'ক',
                        selectedYear
                      )
                    }
                    className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-900 flex items-center"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 mr-2 text-indigo-600" />
                    নমুনাসহ সিএসভি (.csv)
                  </button>
                  <button
                    onClick={() =>
                      downloadStudentCSVTemplate(
                        false,
                        currentClass?.nameBn || 'চতুর্থ শ্রেণি',
                        selectedSection || 'ক',
                        selectedYear
                      )
                    }
                    className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-900 flex items-center"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 mr-2 text-slate-500" />
                    খালি সিএসভি টেমপ্লেট (.csv)
                  </button>
                  <button
                    onClick={() =>
                      downloadStudentExcelTemplate(
                        true,
                        currentClass?.nameBn || 'চতুর্থ শ্রেণি',
                        selectedSection || 'ক',
                        selectedYear
                      )
                    }
                    className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 flex items-center"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 mr-2 text-emerald-600" />
                    এক্সেল টেমপ্লেট (.xlsx)
                  </button>
                </div>
              )}
            </div>

            {/* Export to PDF / Excel Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 shadow-2xs transition cursor-pointer"
                title="শিক্ষার্থীদের ডাটা PDF অথবা Excel ফাইলে ডাউনলোড করুন"
              >
                <Download className="w-3.5 h-3.5 mr-1.5 text-emerald-700" />
                Export to PDF/Excel
                <ChevronDown className="w-3 h-3 ml-1 text-emerald-700" />
              </button>

              {isExportDropdownOpen && (
                <div
                  className="absolute right-0 mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1 overflow-hidden"
                  onMouseLeave={() => setIsExportDropdownOpen(false)}
                >
                  <div className="px-3 py-1.5 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    শিক্ষার্থী ডাটা এক্সপোর্ট ফরম্যাট
                  </div>
                  <button
                    onClick={handleExportExcel}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-950 flex items-center transition cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 mr-2.5 text-emerald-600 flex-shrink-0" />
                    <div>
                      <div className="font-bold text-slate-900">এক্সেল ফাইল (.xlsx)</div>
                      <div className="text-[10px] text-slate-500 font-normal">সম্পূর্ণ তথ্যসহ স্প্রেডশিট ডাউনলোড</div>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setIsExportDropdownOpen(false);
                      setIsPrintDirectoryOpen(true);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-rose-50 hover:text-rose-950 flex items-center transition cursor-pointer"
                  >
                    <FileText className="w-4 h-4 mr-2.5 text-rose-600 flex-shrink-0" />
                    <div>
                      <div className="font-bold text-slate-900">পিডিএফ / প্রিন্ট শিট (.pdf)</div>
                      <div className="text-[10px] text-slate-500 font-normal">অফিসিয়াল A4 সাইজ রেজিস্টার ও ডিরেক্টরি</div>
                    </div>
                  </button>
                  <button
                    onClick={handleExportCSV}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-950 flex items-center transition cursor-pointer"
                  >
                    <Download className="w-4 h-4 mr-2.5 text-slate-500 flex-shrink-0" />
                    <div>
                      <div className="font-bold text-slate-900">সিএসভি ফাইল (.csv)</div>
                      <div className="text-[10px] text-slate-500 font-normal">কমা-সেপারেটেড ফাইল ডাউনলোড</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setFixSourceClassId(selectedClassId || 'class_play');
                setSelectedFixStudentIds([]);
                setFixSuccessMsg(null);
                setIsFixModalOpen(true);
              }}
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-800 shadow-2xs transition cursor-pointer"
              title="অন্য শ্রেণির শিক্ষার্থী এই ক্লাসে ঢুকে গেলে দ্রুত সঠিক ক্লাসে স্থানান্তর করুন"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 mr-1 text-rose-600" />
              শ্রেণি পুনর্বিন্যাস ও ফিক্স
            </button>

            <button
              onClick={() => setActiveView('bulk_upload')}
              className={`inline-flex items-center px-3.5 py-1.5 rounded-lg text-xs font-bold transition shadow-xs ${
                activeView === 'bulk_upload'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-500 hover:bg-amber-600 text-slate-950'
              }`}
            >
              <Upload className="w-3.5 h-3.5 mr-1" />
              বাল্ক সিএসভি আপলোড
            </button>

            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center px-4 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition"
            >
              <UserPlus className="w-3.5 h-3.5 mr-1" />
              নতুন শিক্ষার্থী যুক্ত করুন
            </button>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center space-x-2 pt-1">
          <button
            onClick={() => setActiveView('list')}
            className={`inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer ${
              activeView === 'list'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <List className="w-3.5 h-3.5 mr-1.5" />
            শিক্ষার্থী ডিরেক্টরি ও তালিকা ({toBengaliNumber(filtered.length)} জন)
          </button>

          <button
            onClick={() => setActiveView('bulk_upload')}
            className={`inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer ${
              activeView === 'bulk_upload'
                ? 'bg-indigo-600 text-white'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
            বাল্ক সিএসভি রেজিস্ট্রেশন মডিউল (Bulk CSV Upload)
          </button>
        </div>
      </div>

      {/* Conditionally Render Bulk Upload View OR Student Directory */}
      {activeView === 'bulk_upload' ? (
        <BulkStudentRegistration onSuccessNavigate={() => setActiveView('list')} />
      ) : (
        <div className="space-y-6">
          {/* Filters and Search Bar */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center">
                    <Filter className="w-3.5 h-3.5 mr-1 text-indigo-600" />
                    শ্রেণিভিত্তিক ফিল্টারিং (Class Filter)
                  </span>
                  {classFilter !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setClassFilter('all')}
                      className="text-[11px] text-indigo-600 hover:underline font-normal cursor-pointer"
                    >
                      সকল শ্রেণি
                    </button>
                  )}
                </label>
                <select
                  value={classFilter}
                  onChange={(e) => {
                    const val = e.target.value;
                    setClassFilter(val);
                    if (val !== 'all') {
                      setSelectedClassId(val);
                    }
                  }}
                  className="w-full text-sm font-bold border-2 border-indigo-300 rounded-lg px-2.5 py-1.5 bg-indigo-50/50 text-indigo-950 focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                >
                  <option value="all">
                    🏫 সকল শ্রেণি (মোট {toBengaliNumber(students.length)} জন)
                  </option>
                  {classes.map((cls) => {
                    const count = students.filter((s) => s.classId === cls.id).length;
                    return (
                      <option key={cls.id} value={cls.id}>
                        {cls.nameBn} ({toBengaliNumber(count)} জন শিক্ষার্থী)
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">শাখা নির্বাচন</label>
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="w-full text-sm font-medium border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-800"
                >
                  <option value="">সকল শাখা</option>
                  <option value="ক">ক শাখা</option>
                  <option value="খ">খ শাখা</option>
                  <option value="গ">গ শাখা</option>
                </select>
              </div>

              <div className="sm:col-span-1 md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">শিক্ষার্থী খুঁজুন</label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="নাম বা রোল লিখে খুঁজুন..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full text-sm pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Quick Grade Level Chips Bar */}
            <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto scrollbar-thin">
              <span className="text-[11px] font-bold text-slate-500 shrink-0 mr-1">
                শ্রেণি বাছাই:
              </span>
              <button
                type="button"
                onClick={() => setClassFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition flex items-center gap-1 cursor-pointer ${
                  classFilter === 'all'
                    ? 'bg-indigo-600 text-white shadow-xs ring-1 ring-indigo-400'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <span>সকল শ্রেণি</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    classFilter === 'all'
                      ? 'bg-indigo-800 text-indigo-100'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {toBengaliNumber(students.length)}
                </span>
              </button>
              {classes.map((cls) => {
                const count = students.filter((s) => s.classId === cls.id).length;
                const isActive = classFilter === cls.id;
                return (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => {
                      setClassFilter(cls.id);
                      setSelectedClassId(cls.id);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition flex items-center gap-1 cursor-pointer ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs ring-1 ring-indigo-400'
                        : count > 0
                        ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200'
                    }`}
                  >
                    <span>{cls.nameBn}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                        isActive
                          ? 'bg-indigo-800 text-indigo-100'
                          : count > 0
                          ? 'bg-indigo-200/80 text-indigo-900'
                          : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {toBengaliNumber(count)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Emergency Alert & Class Reassignment Banner */}
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 text-amber-950 text-xs shadow-xs">
            <div className="flex items-start gap-2.5 max-w-2xl">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-sm text-amber-900">
                  {selectedClassId === 'class_play' ? 'প্লে শ্রেণিতে' : 'এই শ্রেণিতে'} অন্য শ্রেণির শিক্ষার্থী ঢুকে গেছে?
                </div>
                <div className="text-amber-800 mt-0.5 leading-relaxed">
                  বাল্ক আপলোডের সময় ফাইলগুলো যদি একসাথে ঢুকে গিয়ে থাকে, তবে <strong>&quot;শ্রেণি পুনর্বিন্যাস ও ফিক্স টুল&quot;</strong> দিয়ে শিক্ষার্থীদের বাছাই করে তাদের সঠিক ক্লাসে (যেমন ৭ম, ৫ম, ৩য় শ্রেণি) স্থানান্তর করুন অথবা এই শ্রেণির ডাটা ক্লিন করে নতুন মাল্টি-ফাইল আপলোড দিন।
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setFixSourceClassId(selectedClassId || 'class_play');
                  setSelectedFixStudentIds([]);
                  setFixSuccessMsg(null);
                  setIsFixModalOpen(true);
                }}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shadow-xs transition flex items-center cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" />
                জরুরি শ্রেণি স্থানান্তর ও ফিক্স
              </button>
              <button
                onClick={() => setActiveView('bulk_upload')}
                className="px-3.5 py-2 bg-amber-200 hover:bg-amber-300 text-amber-950 rounded-lg font-bold shadow-xs transition flex items-center cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                অটো-শনাক্তকরণ আপলোড
              </button>
            </div>
          </div>

      {/* Students Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between text-xs font-bold text-slate-700 gap-2">
          <div className="flex items-center gap-2">
            <span>মোট শিক্ষার্থী: <strong className="text-indigo-900">{toBengaliNumber(filtered.length)} জন</strong></span>
            {filtered.length > 0 && students.length !== filtered.length && (
              <span className="text-slate-500 font-normal">
                (সর্বমোট {toBengaliNumber(students.length)} জনের মধ্যে)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">শ্রেণি ক্যাটাগরি:</span>
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-900 font-bold border border-indigo-300">
              {classFilter === 'all'
                ? 'সকল শ্রেণি'
                : classes.find((c) => c.id === classFilter)?.nameBn || 'শ্রেণি'}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 text-xs font-bold border-b border-slate-200 uppercase">
                <th className="py-3 px-3 text-center w-16">রোল</th>
                <th className="py-3 px-3">শিক্ষার্থীর নাম (বাংলা)</th>
                <th className="py-3 px-3">ইংরেজি নাম</th>
                <th className="py-3 px-3 text-center w-28">শ্রেণি (Grade)</th>
                <th className="py-3 px-2 text-center w-16">শাখা</th>
                <th className="py-3 px-3">পিতার নাম</th>
                <th className="py-3 px-3">অভিভাবক ফোন</th>
                <th className="py-3 px-2 text-center w-16">গ্রুপ</th>
                <th className="py-3 px-3 text-center w-24">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 space-y-2">
                    <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                      <Users className="w-6 h-6" />
                    </div>
                    <div className="font-bold text-slate-700">
                      {classFilter === 'all'
                        ? 'কোনো শিক্ষার্থী পাওয়া যায়নি।'
                        : `"${classes.find((c) => c.id === classFilter)?.nameBn || 'নির্বাচিত শ্রেণি'}"-এ কোনো শিক্ষার্থী পাওয়া যায়নি।`}
                    </div>
                    <p className="text-xs text-slate-400">
                      উপরের &quot;নতুন শিক্ষার্থী যুক্ত করুন&quot; অথবা &quot;বাল্ক সিএসভি আপলোড&quot; বোতাম ব্যবহার করে শিক্ষার্থী যুক্ত করুন।
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((std) => (
                  <tr key={std.id} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                      {toBengaliRoll(std.roll)}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{std.nameBn}</td>
                    <td className="py-2.5 px-3 text-slate-600 text-xs">{std.nameEn || '-'}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                        {classes.find((c) => c.id === std.classId)?.nameBn || std.classId}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-center text-xs font-medium">
                      {std.section ? (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {std.section}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 text-xs">{std.fatherName || '-'}</td>
                    <td className="py-2.5 px-3 text-slate-600 text-xs">
                      {std.guardianPhone ? toBengaliNumber(std.guardianPhone) : '-'}
                    </td>
                    <td className="py-2.5 px-2 text-center text-xs font-bold text-red-600">
                      {std.bloodGroup || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          onClick={() => handleOpenEdit(std)}
                          className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                          title="সম্পাদনা করুন"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`আপনি কি "${std.nameBn}" কে ডিলিট করতে চান?`)) {
                              deleteStudent(std.id);
                            }
                          }}
                          className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                          title="মুছে ফেলুন"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SINGLE STUDENT ADD/EDIT MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 font-serif mb-4 pb-2 border-b border-slate-200">
              {editingStudent ? 'শিক্ষার্থীর তথ্য সম্পাদনা' : 'নতুন শিক্ষার্থী যুক্ত করুন'}
            </h3>

            <form onSubmit={handleSaveStudent} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    শিক্ষার্থীর নাম (বাংলায়) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="যেমন: জিসান আহমেদ নীরব"
                    value={formData.nameBn}
                    onChange={(e) => setFormData({ ...formData, nameBn: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    নাম (ইংরেজিতে)
                  </label>
                  <input
                    type="text"
                    placeholder="যেমন: Zisan Ahmed"
                    value={formData.nameEn}
                    onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">রোল নম্বর *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.roll}
                    onChange={(e) => setFormData({ ...formData, roll: parseInt(e.target.value, 10) || 1 })}
                    className="w-full border border-slate-300 rounded-lg p-2 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">শ্রেণি</label>
                  <select
                    value={formData.classId}
                    onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 font-medium"
                  >
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.nameBn}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">শাখা</label>
                  <select
                    value={formData.section}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  >
                    <option value="ক">ক শাখা</option>
                    <option value="খ">খ শাখা</option>
                    <option value="সাধারণ">সাধারণ</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">পিতার নাম</label>
                  <input
                    type="text"
                    placeholder="পিতার নাম"
                    value={formData.fatherName}
                    onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">মাতার নাম</label>
                  <input
                    type="text"
                    placeholder="মাতার নাম"
                    value={formData.motherName}
                    onChange={(e) => setFormData({ ...formData, motherName: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    অভিভাবকের মোবাইল নম্বর
                  </label>
                  <input
                    type="text"
                    placeholder="০১৭১২-xxxxxx"
                    value={formData.guardianPhone}
                    onChange={(e) => setFormData({ ...formData, guardianPhone: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">রক্তের গ্রুপ</label>
                  <select
                    value={formData.bloodGroup}
                    onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  >
                    <option value="">নির্বাচন করুন</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-sm"
                >
                  সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

        </div>
      )}

      {/* EMERGENCY CLASS REORGANIZATION & CLEANUP MODAL */}
      {isFixModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full p-5 sm:p-7 max-h-[95vh] overflow-y-auto relative border border-slate-200 animate-in zoom-in-95 space-y-5">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shadow-xs">
                  <ArrowRightLeft className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold font-serif text-slate-900 flex items-center gap-2">
                    শ্রেণি পুনর্বিন্যাস ও ডেটা শুদ্ধিকরণ টুল
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    ভুলবশত প্লে বা অন্য কোনো শ্রেণিতে ঢুকে যাওয়া শিক্ষার্থীদের সহজেই বাছাই করে তাদের সঠিক ক্লাসে স্থানান্তর করুন অথবা শ্রেণি রিসেট করুন।
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsFixModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm cursor-pointer transition"
              >
                ✕
              </button>
            </div>

            {/* Success Feedback Alert */}
            {fixSuccessMsg && (
              <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in-50">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{fixSuccessMsg}</span>
              </div>
            )}

            {/* Source Class & Search Controls */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  যে শ্রেণির তালিকা ঠিক করতে চান:
                </label>
                <select
                  value={fixSourceClassId}
                  onChange={(e) => {
                    setFixSourceClassId(e.target.value);
                    setSelectedFixStudentIds([]);
                  }}
                  className="w-full text-xs font-bold border border-indigo-300 rounded-xl px-3 py-2 bg-white text-indigo-950 focus:ring-2 focus:ring-indigo-500"
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

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  শিক্ষার্থী খুঁজুন (নাম বা রোল):
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="যেমন: আফরিন, সাকিব, বা রোল নম্বর..."
                    value={fixSearch}
                    onChange={(e) => setFixSearch(e.target.value)}
                    className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Reassignment Action Bar */}
            {(() => {
              const currentList = students.filter((s) => {
                const matchClass = s.classId === fixSourceClassId;
                const matchSearch =
                  !fixSearch ||
                  s.nameBn.toLowerCase().includes(fixSearch.toLowerCase()) ||
                  (s.nameEn && s.nameEn.toLowerCase().includes(fixSearch.toLowerCase())) ||
                  String(s.roll).includes(fixSearch);
                return matchClass && matchSearch;
              });

              const isAllSelected =
                currentList.length > 0 &&
                currentList.every((s) => selectedFixStudentIds.includes(s.id));

              const toggleSelectAll = () => {
                if (isAllSelected) {
                  setSelectedFixStudentIds([]);
                } else {
                  setSelectedFixStudentIds(currentList.map((s) => s.id));
                }
              };

              const toggleSelectStudent = (id: string) => {
                setSelectedFixStudentIds((prev) =>
                  prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
                );
              };

              return (
                <div className="space-y-3">
                  <div className="bg-indigo-50/80 border border-indigo-200 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-indigo-900 bg-white border border-slate-300 px-3 py-1.5 rounded-lg shadow-2xs cursor-pointer"
                      >
                        {isAllSelected ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                        <span>
                          {isAllSelected ? 'সকল নির্বাচন বাতিল' : 'সবাইকে নির্বাচন করুন'}
                        </span>
                      </button>

                      <span className="text-xs font-bold text-indigo-950 px-2 py-1 bg-white rounded-lg border border-indigo-200">
                        নির্বাচিত: {toBengaliNumber(selectedFixStudentIds.length)} জন
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-700">স্থানান্তর করুন:</span>
                      <select
                        value={targetMoveClassId}
                        onChange={(e) => setTargetMoveClassId(e.target.value)}
                        className="text-xs font-bold border border-indigo-300 rounded-lg px-3 py-1.5 bg-white text-indigo-950 focus:ring-2 focus:ring-indigo-500"
                      >
                        {classes
                          .filter((c) => c.id !== fixSourceClassId)
                          .map((cls) => (
                            <option key={cls.id} value={cls.id}>
                              🎯 {cls.nameBn}
                            </option>
                          ))}
                      </select>

                      <button
                        type="button"
                        disabled={selectedFixStudentIds.length === 0}
                        onClick={handleExecuteMove}
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs disabled:opacity-40 flex items-center cursor-pointer transition"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" />
                        স্থানান্তর সম্পন্ন করুন
                      </button>
                    </div>
                  </div>

                  {/* Student Selection Table */}
                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                    <div className="max-h-72 overflow-y-auto">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead className="bg-slate-100 text-slate-800 font-bold sticky top-0 z-10 border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-3 text-center w-10">বাছাই</th>
                            <th className="py-2 px-3 text-center w-16">রোল</th>
                            <th className="py-2 px-3">শিক্ষার্থীর নাম</th>
                            <th className="py-2 px-3">ইংরেজি নাম</th>
                            <th className="py-2 px-3">পিতার নাম</th>
                            <th className="py-2 px-3 text-center">শাখা</th>
                            <th className="py-2 px-3 text-center w-28">দ্রুত এক ক্লিকে মুভ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {currentList.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-8 text-center text-slate-500">
                                এই শ্রেণির তালিকায় কোনো শিক্ষার্থী পাওয়া যায়নি।
                              </td>
                            </tr>
                          ) : (
                            currentList.map((std) => {
                              const isSelected = selectedFixStudentIds.includes(std.id);
                              return (
                                <tr
                                  key={std.id}
                                  onClick={() => toggleSelectStudent(std.id)}
                                  className={`cursor-pointer transition ${
                                    isSelected ? 'bg-indigo-50/80 font-medium' : 'hover:bg-slate-50'
                                  }`}
                                >
                                  <td className="py-2 px-3 text-center">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleSelectStudent(std.id)}
                                      className="rounded text-indigo-600 focus:ring-indigo-500"
                                    />
                                  </td>
                                  <td className="py-2 px-3 text-center font-bold text-slate-900">
                                    {toBengaliRoll(std.roll)}
                                  </td>
                                  <td className="py-2 px-3 font-semibold text-slate-900">
                                    {std.nameBn}
                                  </td>
                                  <td className="py-2 px-3 text-slate-600">{std.nameEn || '-'}</td>
                                  <td className="py-2 px-3 text-slate-600">
                                    {std.fatherName || '-'}
                                  </td>
                                  <td className="py-2 px-3 text-center">{std.section || 'ক'}</td>
                                  <td
                                    className="py-2 px-3 text-center"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const count = moveStudentsToClass([std.id], targetMoveClassId);
                                        const tCls = classes.find((c) => c.id === targetMoveClassId);
                                        setFixSuccessMsg(`${std.nameBn}-কে ${tCls?.nameBn || 'নতুন শ্রেণিতে'} স্থানান্তর করা হয়েছে!`);
                                        setTimeout(() => setFixSuccessMsg(null), 3000);
                                      }}
                                      className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-bold shadow-2xs transition"
                                      title="সিলেক্টেড ক্লাসে মুভ করুন"
                                    >
                                      মুভ করুন →
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Danger Zone: Wipe Corrupted Class */}
            <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="max-w-xl">
                <div className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  এই শ্রেণির তালিকা কি সম্পূর্ণ রিসেট বা পরিষ্কার করতে চান?
                </div>
                <p className="text-[11px] text-rose-700 mt-0.5 leading-relaxed">
                  যদি {classes.find((c) => c.id === fixSourceClassId)?.nameBn}-এর ডাটা বেশি গোলমেলে হয়ে থাকে এবং আপনি আপনার মূল ফাইলগুলো দিয়ে নতুন করে অটো-ক্লাস বাল্ক আপলোড দিতে চান, তবে এই শ্রেণির সকল শিক্ষার্থী মুছে ফ্রেশ করতে পারেন।
                </p>
              </div>

              <div>
                {!isConfirmWipeOpen ? (
                  <button
                    type="button"
                    onClick={() => setIsConfirmWipeOpen(true)}
                    className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    {classes.find((c) => c.id === fixSourceClassId)?.nameBn}-এর তালিকা মুছুন
                  </button>
                ) : (
                  <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-rose-300 shadow-sm animate-in fade-in-50">
                    <span className="text-xs font-bold text-rose-800">সত্যিই মুছবেন?</span>
                    <button
                      type="button"
                      onClick={() => handleExecuteWipeClass(fixSourceClassId)}
                      className="px-3 py-1 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-bold"
                    >
                      হ্যাঁ, নিশ্চিত
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsConfirmWipeOpen(false)}
                      className="px-2.5 py-1 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      না
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-between border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => {
                  setIsFixModalOpen(false);
                  setActiveView('bulk_upload');
                }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs shadow-xs flex items-center transition"
              >
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                অটো-শনাক্তকরণ বাল্ক আপলোড স্ক্রিনে যান
              </button>

              <button
                type="button"
                onClick={() => setIsFixModalOpen(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs shadow-xs transition"
              >
                সম্পন্ন / বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL STUDENT BULK UPLOAD MODAL */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-100 rounded-3xl shadow-2xl max-w-5xl w-full p-4 sm:p-6 max-h-[96vh] overflow-y-auto relative">
            <button
              onClick={() => setIsBulkModalOpen(false)}
              className="absolute top-4 right-4 z-20 text-slate-400 hover:text-slate-700 bg-white/80 rounded-full w-8 h-8 flex items-center justify-center font-bold text-lg shadow-sm cursor-pointer"
            >
              ✕
            </button>
            <BulkStudentRegistration
              isModal
              onCloseModal={() => setIsBulkModalOpen(false)}
              onSuccessNavigate={() => {
                setIsBulkModalOpen(false);
                setActiveView('list');
              }}
            />
          </div>
        </div>
      )}

      {/* PRINTABLE STUDENT DIRECTORY / ROLL SHEET MODAL (PDF / A4 PRINT) */}
      {isPrintDirectoryOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[96vh] flex flex-col overflow-hidden">
            {/* Modal Controls (Hidden in print) */}
            <div className="no-print p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Printer className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-sm sm:text-base font-serif">
                    শিক্ষার্থী তথ্য তালিকা ও রেজিস্টার (PDF / A4 প্রিন্ট প্রিভিউ)
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    ব্রাউজারের প্রিন্ট ডায়ালগে "Save as PDF" নির্বাচন করে পিডিএফ ফাইল হিসেবে সেভ করুন।
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center space-x-1 shadow-sm cursor-pointer transition"
                  title="এক্সেল ফাইলে ডাউনলোড করুন"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 mr-1" />
                  <span>এক্সেল (.xlsx)</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm flex items-center space-x-1 shadow-sm cursor-pointer transition"
                  title="PDF সংরক্ষণ বা প্রিন্ট করুন"
                >
                  <Printer className="w-4 h-4 mr-1.5" />
                  <span>PDF সংরক্ষণ / প্রিন্ট</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintDirectoryOpen(false)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Area */}
            <div className="p-6 overflow-y-auto printable-area bg-white text-slate-900 font-serif">
              {/* School Header */}
              <div className="text-center pb-3 border-b-2 border-slate-900 mb-4">
                <div className="flex items-center justify-center space-x-3 mb-1">
                  <SchoolLogo customLogoUrl={schoolInfo?.logoUrl} size={48} />
                  <div>
                    <h1 className="text-2xl font-extrabold tracking-wide text-slate-950 font-serif">
                      {schoolInfo?.name || 'ডি-লিকন মডেল একাডেমী'}
                    </h1>
                    <p className="text-xs text-slate-700 font-sans">
                      {schoolInfo?.address || 'দক্ষিণগাঁও, গণি মার্কেট, সনমানিয়া, কাপাসিয়া, গাজীপুর।'}
                      {schoolInfo?.phone ? ` • মোবাইল: ${toBengaliNumber(schoolInfo.phone)}` : ''}
                    </p>
                  </div>
                </div>
                <div className="mt-2 inline-block px-4 py-1 border-2 border-slate-900 rounded font-bold text-sm bg-slate-100 uppercase tracking-wide">
                  শিক্ষার্থী তথ্য তালিকা ও রেজিস্টার (Student Directory & Class Roll Sheet)
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-xs font-sans text-slate-800 bg-slate-50 py-1.5 px-3 border border-slate-200 rounded-lg">
                  <span>
                    <strong>শ্রেণি:</strong>{' '}
                    {classFilter === 'all'
                      ? 'সকল শ্রেণি'
                      : classes.find((c) => c.id === classFilter)?.nameBn || classFilter}
                  </span>
                  <span>•</span>
                  <span><strong>শাখা:</strong> {selectedSection || 'সকল শাখা'}</span>
                  <span>•</span>
                  <span><strong>শিক্ষাবর্ষ:</strong> {toBengaliNumber(selectedYear || '২০২৬')}</span>
                  <span>•</span>
                  <span>
                    <strong>মোট শিক্ষার্থী:</strong> {toBengaliNumber(filtered.length)} জন (ছাত্র:{' '}
                    {toBengaliNumber(filtered.filter((s) => s.gender === 'ছাত্র').length)}, ছাত্রী:{' '}
                    {toBengaliNumber(filtered.filter((s) => s.gender === 'ছাত্রী').length)})
                  </span>
                  <span>•</span>
                  <span><strong>তারিখ:</strong> {formatBengaliDate(new Date().toISOString().split('T')[0])}</span>
                </div>
              </div>

              {/* Students Table */}
              <div className="mb-6">
                <table className="w-full text-xs border border-slate-800 border-collapse font-sans">
                  <thead>
                    <tr className="bg-slate-100 font-bold border-b border-slate-800 text-[11px]">
                      <th className="p-1 border-r border-slate-800 text-center w-8">ক্র.</th>
                      <th className="p-1 border-r border-slate-800 text-center w-12">রোল</th>
                      <th className="p-1 border-r border-slate-800 text-left">শিক্ষার্থীর নাম</th>
                      <th className="p-1 border-r border-slate-800 text-left w-20">শ্রেণি ও শাখা</th>
                      <th className="p-1 border-r border-slate-800 text-center w-12">লিঙ্গ</th>
                      <th className="p-1 border-r border-slate-800 text-left">অভিভাবক ও ফোন নম্বর</th>
                      <th className="p-1 border-r border-slate-800 text-left">পিতা ও মাতার নাম</th>
                      <th className="p-1 border-r border-slate-800 text-center w-14">রক্তের গ্রুপ</th>
                      <th className="p-1 border-slate-800 text-center w-20">স্বাক্ষর / মন্তব্য</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s, idx) => {
                      const clsName = classes.find((c) => c.id === s.classId)?.nameBn || s.classId;
                      return (
                        <tr key={s.id} className="border-b border-slate-300">
                          <td className="p-1 border-r border-slate-800 text-center font-mono">
                            {toBengaliNumber(idx + 1)}
                          </td>
                          <td className="p-1 border-r border-slate-800 text-center font-mono font-bold">
                            {toBengaliRoll(s.roll)}
                          </td>
                          <td className="p-1 border-r border-slate-800 font-medium">
                            <div>{s.nameBn}</div>
                            {s.nameEn && <div className="text-[10px] text-slate-500 font-sans">{s.nameEn}</div>}
                          </td>
                          <td className="p-1 border-r border-slate-800">
                            {clsName} ({s.section})
                          </td>
                          <td className="p-1 border-r border-slate-800 text-center text-[11px]">
                            {s.gender || 'ছাত্র'}
                          </td>
                          <td className="p-1 border-r border-slate-800 text-[11px]">
                            <div className="font-mono font-bold text-slate-800">
                              {s.guardianPhone ? toBengaliNumber(s.guardianPhone) : '-'}
                            </div>
                          </td>
                          <td className="p-1 border-r border-slate-800 text-[11px]">
                            <div>পিতা: {s.fatherName || '-'}</div>
                            <div className="text-slate-600">মাতা: {s.motherName || '-'}</div>
                          </td>
                          <td className="p-1 border-r border-slate-800 text-center font-bold text-rose-800">
                            {s.bloodGroup || '-'}
                          </td>
                          <td className="p-1 border-slate-800 text-center"></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Signatures */}
              <div className="pt-10 grid grid-cols-3 gap-6 text-center text-xs font-serif border-t border-slate-300 mt-8">
                <div>
                  <div className="border-t border-slate-800 pt-1.5 w-3/4 mx-auto font-bold text-slate-900">
                    শ্রেণি শিক্ষক
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">স্বাক্ষর ও তারিখ</div>
                </div>

                <div>
                  <div className="border-t border-slate-800 pt-1.5 w-3/4 mx-auto font-bold text-slate-900">
                    প্রধান হিসাব সহকারী
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">স্বাক্ষর ও তারিখ</div>
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
