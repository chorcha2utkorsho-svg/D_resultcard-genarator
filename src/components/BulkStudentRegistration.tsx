import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  Trash2,
  RefreshCw,
  Info,
  Users,
  Sparkles,
  ArrowRight,
  Filter,
  Check,
  FileCheck,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useSchool } from '../context/SchoolContext';
import {
  downloadStudentCSVTemplate,
  downloadStudentExcelTemplate,
  parseStudentData,
  detectClassFromFilename,
  ParsedStudentRow,
  SAMPLE_STUDENTS_DATA,
} from '../utils/studentBulkImport';
import { toBengaliNumber, toBengaliRoll } from '../utils/bengali';

interface BulkStudentRegistrationProps {
  onSuccessNavigate?: () => void;
  isModal?: boolean;
  onCloseModal?: () => void;
}

export interface UploadedFileItem {
  id: string;
  name: string;
  detectedClassId: string;
  detectedClassName: string;
  studentCount: number;
  rows: ParsedStudentRow[];
}

export const BulkStudentRegistration: React.FC<BulkStudentRegistrationProps> = ({
  onSuccessNavigate,
  isModal = false,
  onCloseModal,
}) => {
  const {
    classes,
    students,
    selectedClassId,
    setSelectedClassId,
    selectedSection,
    setSelectedSection,
    selectedYear,
    bulkImportStudents,
  } = useSchool();

  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(2);
  const [pasteContent, setPasteContent] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileItem[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedStudentRow[]>([]);
  const [registrationMode, setRegistrationMode] = useState<'append' | 'upsert' | 'replace'>('upsert');
  const [filterType, setFilterType] = useState<'all' | 'valid' | 'warnings' | 'errors'>('all');
  const [filterClassId, setFilterClassId] = useState<string>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ count: number; mode: string } | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentClass = classes.find((c) => c.id === selectedClassId) || classes[0];
  const existingClassStudents = students.filter(
    (s) => s.classId === selectedClassId && (!selectedSection || s.section === selectedSection)
  );

  const rebuildParsedRows = (filesList: UploadedFileItem[]) => {
    let all: ParsedStudentRow[] = [];
    filesList.forEach((f) => {
      all = all.concat(f.rows);
    });
    const reindexed = all.map((r, i) => ({ ...r, index: i + 1 }));
    setParsedRows(reindexed);
  };

  // Trigger parsing from text
  const handleParseText = (text: string) => {
    setPasteContent(text);
    if (!text.trim()) {
      setParsedRows([]);
      setUploadedFiles([]);
      return;
    }
    const result = parseStudentData(
      text,
      selectedClassId,
      selectedSection || 'ক',
      selectedYear,
      classes
    );
    setParsedRows(result);
    setUploadedFiles([
      {
        id: 'paste_content',
        name: 'সরাসরি পেস্টকৃত ডাটা',
        detectedClassId: selectedClassId,
        detectedClassName: currentClass?.nameBn || 'শ্রেণি',
        studentCount: result.length,
        rows: result,
      },
    ]);
    if (result.length > 0 && activeStep !== 3) {
      setActiveStep(3);
    }
  };

  // Parse a single file
  const readAndParseSingleFile = (file: File): Promise<UploadedFileItem> => {
    return new Promise((resolve) => {
      const isExcel =
        file.name.endsWith('.xlsx') ||
        file.name.endsWith('.xls') ||
        file.type.includes('spreadsheet') ||
        file.type.includes('excel');

      const detectedCls = detectClassFromFilename(file.name, classes);
      const defaultClsId = detectedCls?.classId || selectedClassId;

      if (isExcel) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonRows = XLSX.utils.sheet_to_json<(string | number)[]>(worksheet, {
              header: 1,
              defval: '',
            });

            const rows = parseStudentData(
              jsonRows,
              defaultClsId,
              selectedSection || 'ক',
              selectedYear,
              classes,
              { fileName: file.name, sheetName: firstSheetName }
            );

            const finalClassId = rows[0]?.classId || defaultClsId;
            const finalClassName =
              rows[0]?.classNameDisplay ||
              classes.find((c) => c.id === finalClassId)?.nameBn ||
              'শ্রেণি';

            resolve({
              id: `${file.name}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              name: file.name,
              detectedClassId: finalClassId,
              detectedClassName: finalClassName,
              studentCount: rows.length,
              rows,
            });
          } catch (err) {
            console.error('Failed to parse excel file', file.name, err);
            resolve({
              id: `${file.name}_${Date.now()}`,
              name: file.name,
              detectedClassId: defaultClsId,
              detectedClassName: 'ত্রুটি',
              studentCount: 0,
              rows: [],
            });
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const text = (e.target?.result as string) || '';
            const rows = parseStudentData(
              text,
              defaultClsId,
              selectedSection || 'ক',
              selectedYear,
              classes,
              { fileName: file.name }
            );
            const finalClassId = rows[0]?.classId || defaultClsId;
            const finalClassName =
              rows[0]?.classNameDisplay ||
              classes.find((c) => c.id === finalClassId)?.nameBn ||
              'শ্রেণি';

            resolve({
              id: `${file.name}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              name: file.name,
              detectedClassId: finalClassId,
              detectedClassName: finalClassName,
              studentCount: rows.length,
              rows,
            });
          } catch (err) {
            console.error('Failed to parse csv file', file.name, err);
            resolve({
              id: `${file.name}_${Date.now()}`,
              name: file.name,
              detectedClassId: defaultClsId,
              detectedClassName: 'ত্রুটি',
              studentCount: 0,
              rows: [],
            });
          }
        };
        reader.readAsText(file);
      }
    });
  };

  // Process multiple files in batch
  const processFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setIsSubmitting(true);
    try {
      const items = await Promise.all(files.map(readAndParseSingleFile));
      const validItems = items.filter((it) => it.rows.length > 0);

      if (validItems.length === 0) {
        alert('নির্বাচিত ফাইলগুলো থেকে কোনো শিক্ষার্থীর তথ্য শনাক্ত করা যায়নি। ফাইল ফরম্যাট ও কলামগুলো যাচাই করুন।');
        return;
      }

      setUploadedFiles((prev) => {
        const nextList = [...prev, ...validItems];
        rebuildParsedRows(nextList);
        return nextList;
      });

      if (validItems.length === 1) {
        setUploadedFileName(validItems[0].name);
      } else {
        setUploadedFileName(`${toBengaliNumber(validItems.length)}টি শ্রেণি ফাইল লোড করা হয়েছে`);
      }

      setActiveStep(3);
    } catch (err) {
      console.error('Batch file reading error:', err);
      alert('ফাইল প্রসেসিংয়ে সমস্যা হয়েছে।');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    processFiles(e.target.files);
  };

  const handleRemoveFile = (fileId: string) => {
    setUploadedFiles((prev) => {
      const remaining = prev.filter((f) => f.id !== fileId);
      rebuildParsedRows(remaining);
      if (remaining.length === 0) {
        setUploadedFileName(null);
      }
      return remaining;
    });
  };

  const handleChangeFileClass = (fileId: string, newClassId: string) => {
    const targetClass = classes.find((c) => c.id === newClassId);
    setUploadedFiles((prev) => {
      const nextList = prev.map((f) => {
        if (f.id === fileId) {
          const updatedRows = f.rows.map((r) => ({
            ...r,
            classId: newClassId,
            classNameDisplay: targetClass?.nameBn || r.classNameDisplay,
          }));
          return {
            ...f,
            detectedClassId: newClassId,
            detectedClassName: targetClass?.nameBn || f.detectedClassName,
            rows: updatedRows,
          };
        }
        return f;
      });
      rebuildParsedRows(nextList);
      return nextList;
    });
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  // Sample data quick loader
  const handleLoadSample = () => {
    setUploadedFileName('নমুনা_শিক্ষার্থী_তালিকা.csv');
    const rows = SAMPLE_STUDENTS_DATA.map(
      (s) =>
        `${s.roll},"${s.nameBn}","${s.nameEn}","${currentClass?.nameBn || 'চতুর্থ শ্রেণি'}","${
          s.section
        }","${s.gender}","${s.guardianPhone}","${s.fatherName}","${s.motherName}","${
          s.bloodGroup
        }","${s.academicYear}"`
    );
    const text = [
      'রোল,নাম (বাংলা),নাম (ইংরেজি),শ্রেণি,শাখা,লিঙ্গ,অভিভাবক মোবাইল,পিতার নাম,মাতার নাম,রক্তের গ্রুপ,শিক্ষাবর্ষ',
      ...rows,
    ].join('\n');
    handleParseText(text);
  };

  // Row update in preview
  const handleUpdateRow = (index: number, field: keyof ParsedStudentRow, value: any) => {
    setParsedRows((prev) => {
      const next = [...prev];
      const target = { ...next[index], [field]: value };

      // Re-validate
      const errors: string[] = [];
      const warnings: string[] = [];
      if (!target.nameBn.trim()) {
        errors.push('শিক্ষার্থীর নাম (বাংলা) আবশ্যক');
      }
      if (target.guardianPhone && target.guardianPhone.length !== 11) {
        warnings.push('মোবাইল নম্বরটি ১১ ডিজিটের নয়');
      }
      target.isValid = errors.length === 0;
      target.errors = errors;
      target.warnings = warnings;

      next[index] = target;
      return next;
    });
  };

  // Delete row from preview
  const handleDeleteRow = (index: number) => {
    setParsedRows((prev) => prev.filter((_, i) => i !== index));
  };

  // Filtered rows for review table
  const displayedRows = parsedRows.filter((r) => {
    if (filterClassId !== 'all' && r.classId !== filterClassId) return false;
    if (filterType === 'valid') return r.isValid && r.warnings.length === 0;
    if (filterType === 'warnings') return r.warnings.length > 0;
    if (filterType === 'errors') return !r.isValid;
    return true;
  });

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const warningCount = parsedRows.filter((r) => r.warnings.length > 0).length;
  const errorCount = parsedRows.filter((r) => !r.isValid).length;

  // Execute bulk import
  const handleCommitRegistration = () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      alert('নিবন্ধন করার মতো কোনো সঠিক শিক্ষার্থী তথ্য নেই। অনুগ্রহ করে ত্রুটি সংশোধন করুন।');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = validRows.map((r) => ({
        roll: r.roll,
        nameBn: r.nameBn,
        nameEn: r.nameEn || '',
        classId: r.classId || selectedClassId,
        section: r.section || selectedSection || 'ক',
        gender: r.gender,
        guardianPhone: r.guardianPhone || '',
        fatherName: r.fatherName || '',
        motherName: r.motherName || '',
        bloodGroup: r.bloodGroup || '',
        academicYear: r.academicYear || selectedYear,
      }));

      const distinctClassIds = Array.from(new Set(payload.map((s) => s.classId)));

      const count = bulkImportStudents(payload, {
        mode: registrationMode,
        targetClassId: distinctClassIds.length === 1 ? distinctClassIds[0] : undefined,
        targetClassIds: distinctClassIds,
        targetSection: selectedSection || undefined,
      });

      const modeText =
        registrationMode === 'replace'
          ? distinctClassIds.length > 1
            ? `${toBengaliNumber(distinctClassIds.length)}টি শ্রেণির পুরাতন তালিকা প্রতিস্থাপন`
            : 'নতুন তালিকা দিয়ে প্রতিস্থাপন'
          : registrationMode === 'upsert'
          ? 'রোল অনুযায়ী হালনাগাদ ও সংযোজন'
          : 'নতুন শিক্ষার্থী হিসেবে সংযোজন';

      setSuccessInfo({
        count,
        mode: modeText,
      });
    } catch (err) {
      console.error('Bulk registration error:', err);
      alert('নিবন্ধনে সমস্যা হয়েছে। অনুগ্রহ করে ডাটা ফরম্যাট যাচাই করুন।');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setParsedRows([]);
    setUploadedFiles([]);
    setPasteContent('');
    setUploadedFileName(null);
    setSuccessInfo(null);
    setActiveStep(2);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`space-y-6 ${isModal ? 'p-1' : ''}`}>
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-blue-900 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-indigo-700/40 relative overflow-hidden">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-700/60 border border-indigo-500/50 text-indigo-200 text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              শিক্ষক ও অ্যাডমিনদের জন্য এক ক্লিকে বাল্ক রেজিস্ট্রেশন
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-serif text-white tracking-wide flex items-center">
              <FileSpreadsheet className="w-6 h-6 mr-2 text-amber-400" />
              শিক্ষার্থী বাল্ক আপলোড ও সিএসভি রেজিস্ট্রেশন
            </h2>
            <p className="text-xs sm:text-sm text-indigo-100 mt-1 leading-relaxed">
              এক্সেল বা সিএসভি ফাইল ব্যবহার করে একসাথে সম্পূর্ণ শ্রেণির শিক্ষার্থীদের নাম, রোল,
              অভিভাবকের মোবাইল ও ব্যক্তিগত তথ্য দ্রুত এবং নির্ভুলভাবে সিস্টেমে নিবন্ধন করুন।
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveStep(1)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center shadow-xs cursor-pointer ${
                activeStep === 1
                  ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300'
                  : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
              }`}
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              টেমপ্লেট সংগ্রহ (Templates)
            </button>
            <button
              onClick={() => setActiveStep(2)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center shadow-xs cursor-pointer ${
                activeStep === 2
                  ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300'
                  : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
              }`}
            >
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              ফাইল আপলোড / পেস্ট
            </button>
            {parsedRows.length > 0 && (
              <button
                onClick={() => setActiveStep(3)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center shadow-xs cursor-pointer ${
                  activeStep === 3
                    ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300'
                    : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-300" />
                যাচাই ও প্রিভিউ ({toBengaliNumber(parsedRows.length)})
              </button>
            )}
          </div>
        </div>

        {/* Step Progression Indicators */}
        <div className="mt-5 pt-4 border-t border-indigo-700/50 grid grid-cols-3 gap-2 text-center text-xs">
          <div
            onClick={() => setActiveStep(1)}
            className={`cursor-pointer p-2 rounded-lg transition ${
              activeStep === 1
                ? 'bg-white/20 text-amber-300 font-bold'
                : 'text-indigo-200 hover:bg-white/10'
            }`}
          >
            <span className="hidden sm:inline">১. </span>টেমপ্লেট ডাউনলোড
          </div>
          <div
            onClick={() => setActiveStep(2)}
            className={`cursor-pointer p-2 rounded-lg transition ${
              activeStep === 2
                ? 'bg-white/20 text-amber-300 font-bold'
                : 'text-indigo-200 hover:bg-white/10'
            }`}
          >
            <span className="hidden sm:inline">২. </span>আপলোড ও ডাটা পেস্ট
          </div>
          <div
            onClick={() => parsedRows.length > 0 && setActiveStep(3)}
            className={`p-2 rounded-lg transition ${
              parsedRows.length === 0
                ? 'opacity-40 cursor-not-allowed text-indigo-300'
                : activeStep === 3
                ? 'bg-white/20 text-amber-300 font-bold cursor-pointer'
                : 'text-indigo-200 hover:bg-white/10 cursor-pointer'
            }`}
          >
            <span className="hidden sm:inline">৩. </span>যাচাই ও চূড়ান্ত নিবন্ধন
          </div>
        </div>
      </div>

      {/* Target Class Selection & Existing Count Bar */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              টার্গেট শ্রেণি নির্বাচন করুন:
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="text-sm font-bold border border-indigo-300 rounded-lg px-3 py-1.5 bg-indigo-50/50 text-indigo-950 focus:ring-2 focus:ring-indigo-500"
            >
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.nameBn}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">ডিফল্ট শাখা:</label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="text-sm font-medium border border-slate-300 rounded-lg px-3 py-1.5 bg-white text-slate-800"
            >
              <option value="">সকল শাখা (ফাইল অনুযায়ী)</option>
              <option value="ক">ক শাখা</option>
              <option value="খ">খ শাখা</option>
              <option value="গ">গ শাখা</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">শিক্ষাবর্ষ:</label>
            <span className="inline-block text-sm font-bold px-3 py-1.5 bg-slate-100 border border-slate-300 rounded-lg text-slate-700">
              {toBengaliNumber(selectedYear)}
            </span>
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs text-slate-500">বর্তমান ডাটাবেসে এই শ্রেণিতে:</div>
          <div className="text-sm font-bold text-slate-800 flex items-center justify-end">
            <Users className="w-4 h-4 mr-1 text-indigo-600" />
            {toBengaliNumber(existingClassStudents.length)} জন নিবন্ধিত শিক্ষার্থী আছে
          </div>
        </div>
      </div>

      {/* STEP 1: DOWNLOAD OFFICIAL TEMPLATES */}
      {activeStep === 1 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6 animate-in fade-in-50 duration-200">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center">
                <Download className="w-5 h-5 mr-2 text-indigo-600" />
                ধাপ ১: স্ট্যান্ডার্ড সিএসভি ও এক্সেল টেমপ্লেট সংগ্রহ করুন
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                শিক্ষার্থীদের তথ্য নির্ভুলভাবে ইনপুট দেওয়ার জন্য নিচের যেকোনো ফরম্যাটে টেমপ্লেট ডাউনলোড করুন।
              </p>
            </div>
            <button
              onClick={() => setActiveStep(2)}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              ফাইল পূরণ হয়ে গেছে? আপলোড ধাপে যান <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Template Card 1: Sample CSV */}
            <div className="border border-indigo-200 bg-indigo-50/40 rounded-xl p-5 hover:shadow-md transition flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center mb-3 shadow-xs">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <h4 className="text-base font-bold text-slate-900">
                  নমুনাসহ সিএসভি টেমপ্লেট (.csv)
                </h4>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  কলাম পরিচিতি এবং ৬ জন ডেমো শিক্ষার্থীর উদাহরণসহ প্রস্তুতকৃত CSV ফাইল (UTF-8
                  এনকোডেড)।
                </p>
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
                className="mt-4 w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition flex items-center justify-center cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                নমুনাসহ CSV ডাউনলোড
              </button>
            </div>

            {/* Template Card 2: Blank CSV */}
            <div className="border border-slate-200 bg-slate-50/60 rounded-xl p-5 hover:shadow-md transition flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-slate-700 text-white flex items-center justify-center mb-3 shadow-xs">
                  <FileText className="w-5 h-5" />
                </div>
                <h4 className="text-base font-bold text-slate-900">
                  খালি সিএসভি টেমপ্লেট (Blank CSV)
                </h4>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  শুধুমাত্র হেডার কলাম এবং ইনপুট নির্দেশনাসহ ফাঁকা CSV টেমপ্লেট। নতুন ব্যাচের ডাটা
                  ইনপুট দিতে উপযোগী।
                </p>
              </div>
              <button
                onClick={() =>
                  downloadStudentCSVTemplate(
                    false,
                    currentClass?.nameBn || 'চতুর্থ শ্রেণি',
                    selectedSection || 'ক',
                    selectedYear
                  )
                }
                className="mt-4 w-full py-2 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold shadow-xs transition flex items-center justify-center cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                খালি CSV ডাউনলোড
              </button>
            </div>

            {/* Template Card 3: Excel XLSX */}
            <div className="border border-emerald-200 bg-emerald-50/40 rounded-xl p-5 hover:shadow-md transition flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center mb-3 shadow-xs">
                  <FileCheck className="w-5 h-5" />
                </div>
                <h4 className="text-base font-bold text-slate-900">
                  এক্সেল টেমপ্লেট (.xlsx)
                </h4>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  মাইক্রোসফট এক্সেলে সহজে বাংলা লেখার উপযোগী ফরমেটেড ওয়ার্কবুক এবং ব্যবহার
                  নির্দেশিকা শিটসহ।
                </p>
              </div>
              <button
                onClick={() =>
                  downloadStudentExcelTemplate(
                    true,
                    currentClass?.nameBn || 'চতুর্থ শ্রেণি',
                    selectedSection || 'ক',
                    selectedYear
                  )
                }
                className="mt-4 w-full py-2 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs transition flex items-center justify-center cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                এক্সেল (.xlsx) ডাউনলোড
              </button>
            </div>
          </div>

          {/* Quick Guide on Columns */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <h5 className="text-xs font-bold text-slate-800 flex items-center mb-2">
              <Info className="w-4 h-4 mr-1.5 text-indigo-600" />
              টেমপ্লেটের কলাম বিন্যাস ও নির্দেশনা:
            </h5>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-600">
              <div className="p-2 bg-white rounded border border-slate-200">
                <span className="font-bold text-indigo-900">১. রোল (Roll):</span> ১, ২ বা 1, 2
              </div>
              <div className="p-2 bg-white rounded border border-slate-200">
                <span className="font-bold text-red-600">২. নাম (বাংলা) *:</span> আবশ্যক
              </div>
              <div className="p-2 bg-white rounded border border-slate-200">
                <span className="font-bold text-slate-700">৩. ইংরেজি নাম:</span> ঐচ্ছিক
              </div>
              <div className="p-2 bg-white rounded border border-slate-200">
                <span className="font-bold text-slate-700">৪. শ্রেণি ও শাখা:</span> ক/খ বা ফাঁকা
              </div>
              <div className="p-2 bg-white rounded border border-slate-200">
                <span className="font-bold text-slate-700">৫. লিঙ্গ:</span> ছাত্র অথবা ছাত্রী
              </div>
              <div className="p-2 bg-white rounded border border-slate-200">
                <span className="font-bold text-emerald-700">৬. মোবাইল:</span> ১১ ডিজিট (017...)
              </div>
              <div className="p-2 bg-white rounded border border-slate-200">
                <span className="font-bold text-slate-700">৭. পিতা ও মাতার নাম:</span> ঐচ্ছিক
              </div>
              <div className="p-2 bg-white rounded border border-slate-200">
                <span className="font-bold text-red-700">৮. রক্তের গ্রুপ:</span> A+, B+, O+ ইত্যাদি
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: FILE UPLOAD OR PASTE DATA */}
      {activeStep === 2 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6 animate-in fade-in-50 duration-200">
          <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-4 gap-2">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center">
                <Upload className="w-5 h-5 mr-2 text-indigo-600" />
                ধাপ ২: সিএসভি/এক্সেল ফাইল আপলোড করুন অথবা কপি-পেস্ট করুন
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                কম্পিউটার বা মোবাইল থেকে ফাইল আপলোড করুন, অথবা সরাসরি এক্সেল থেকে কপি করে পেস্ট করুন।
              </p>
            </div>

            <button
              onClick={handleLoadSample}
              className="inline-flex items-center px-3 py-1.5 rounded-lg border border-amber-400 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold shadow-2xs transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
              টেস্ট করতে নমুনা ডাটা লোড করুন
            </button>
          </div>

          {/* Drag & Drop Upload Zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-6 text-center transition cursor-pointer ${
              dragActive
                ? 'border-indigo-600 bg-indigo-50/80 scale-[1.01]'
                : 'border-slate-300 hover:border-indigo-400 bg-slate-50/50'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".csv,.xlsx,.xls,.tsv,.txt"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-3">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-800">
              ফাইল নির্বাচন করতে এখানে ক্লিক করুন অথবা এক বা একাধিক এক্সেল ফাইল টেনে আনুন (Drag & Drop)
            </p>
            <p className="text-xs text-slate-500 mt-1">
              একসাথে সকল শ্রেণির ফাইল (যেমন Play, Nursery, Class 1 থেকে 8) সিলেক্ট করলে ফাইলনেম অনুযায়ী স্বয়ংক্রিয় শ্রেণি নির্ধারণ হবে।
            </p>

            {uploadedFileName && (
              <div className="mt-3 inline-flex items-center px-3.5 py-1.5 rounded-full bg-indigo-100 border border-indigo-300 text-indigo-900 text-xs font-bold">
                <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-indigo-700" />
                {uploadedFileName}
              </div>
            )}
          </div>

          {/* Uploaded Files Multi-List Card */}
          {uploadedFiles.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between text-xs font-bold text-slate-800 gap-2">
                <span className="flex items-center text-indigo-900">
                  <FileSpreadsheet className="w-4 h-4 mr-1.5 text-indigo-600" />
                  শনাক্তকৃত ফাইল তালিকা ({toBengaliNumber(uploadedFiles.length)}টি ফাইল):
                </span>
                <span className="text-slate-500 font-normal">
                  প্রতিটি ফাইলের বিপরীতে স্বয়ংক্রিয় শ্রেণি নির্ধারিত হয়েছে। প্রয়োজনে ড্রপডাউন থেকে পরিবর্তন করতে পারেন:
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {uploadedFiles.map((fileItem) => (
                  <div
                    key={fileItem.id}
                    className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between shadow-2xs gap-3 hover:border-indigo-300 transition"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 truncate" title={fileItem.name}>
                        {fileItem.name}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <span>শিক্ষার্থী: <strong className="text-indigo-900 font-bold">{toBengaliNumber(fileItem.studentCount)}</strong> জন</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={fileItem.detectedClassId}
                        onChange={(e) => handleChangeFileClass(fileItem.id, e.target.value)}
                        className="text-xs font-bold border border-indigo-300 rounded-lg px-2.5 py-1 bg-indigo-50/70 text-indigo-950 focus:ring-2 focus:ring-indigo-500"
                        title="এই ফাইলের জন্য শ্রেণি নির্বাচন করুন"
                      >
                        {classes.map((cls) => (
                          <option key={cls.id} value={cls.id}>
                            {cls.nameBn}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(fileItem.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="ফাইলটি বাদ দিন"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Direct Text / Sheet Paste Option */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center">
                <FileText className="w-4 h-4 mr-1 text-slate-500" />
                অথবা সরাসরি ডাটা পেস্ট করুন (কপি-পেস্ট সাপোর্ট):
              </label>
              {pasteContent && (
                <button
                  onClick={() => handleParseText('')}
                  className="text-xs text-rose-600 hover:underline"
                >
                  ক্লিয়ার করুন
                </button>
              )}
            </div>

            <textarea
              rows={5}
              placeholder={`রোল, নাম (বাংলা), নাম (ইংরেজি), শ্রেণি, শাখা, লিঙ্গ, অভিভাবক মোবাইল, পিতার নাম, মাতার নাম, রক্তের গ্রুপ
১, আফরিন জাহান নুহা, Afrin Jahan Nuha, ${currentClass?.nameBn || 'চতুর্থ শ্রেণি'}, ক, ছাত্রী, 01712345678, মোঃ আবুল কাশেম, নাসরিন জাহান, A+
২, তানভীর আহমেদ মাহিন, Tanvir Ahmed Mahin, ${currentClass?.nameBn || 'চতুর্থ শ্রেণি'}, ক, ছাত্র, 01812345679, আনিসুর রহমান, শাহানাজ পারভীন, B+`}
              value={pasteContent}
              onChange={(e) => handleParseText(e.target.value)}
              className="w-full font-mono text-xs border border-slate-300 rounded-xl p-3 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            <p className="text-[11px] text-slate-500">
              টিপস: গুগল শিট বা এক্সেলের কলাম কপি করে সরাসরি এই বক্সে পেস্ট করলেই স্বয়ংক্রিয়ভাবে
              শনাক্ত হবে।
            </p>
          </div>

          {/* Action to proceed to Step 3 */}
          {parsedRows.length > 0 && (
            <div className="pt-2 flex items-center justify-between">
              <div className="text-xs text-slate-600">
                শনাক্তকৃত শিক্ষার্থী সংখ্যা:{' '}
                <span className="font-bold text-indigo-900 text-sm">
                  {toBengaliNumber(parsedRows.length)} জন
                </span>
              </div>
              <button
                onClick={() => setActiveStep(3)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center cursor-pointer transition"
              >
                পরবর্তী ধাপ: ডাটা যাচাই ও প্রিভিউ <ArrowRight className="w-4 h-4 ml-1.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP 3: PREVIEW, EDIT & COMMIT REGISTRATION */}
      {activeStep === 3 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6 animate-in fade-in-50 duration-200">
          <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-4 gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center">
                <CheckCircle2 className="w-5 h-5 mr-2 text-emerald-600" />
                ধাপ ৩: শিক্ষার্থী তথ্য যাচাই, সংশোধন ও চূড়ান্ত নিবন্ধন
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                নিচে আপলোডকৃত শিক্ষার্থীদের তালিকা প্রদর্শিত হচ্ছে। কোনো তথ্যে ভুল থাকলে টেবিলে সরাসরি
                ক্লিক করে এডিট করুন।
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveStep(2)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                নতুন ফাইল আপলোড
              </button>
              <button
                onClick={handleReset}
                className="px-3 py-1.5 border border-rose-300 rounded-lg text-xs font-bold text-rose-700 hover:bg-rose-50"
              >
                তালিকা রিসেট
              </button>
            </div>
          </div>

          {/* Validation Metrics Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              onClick={() => setFilterType('all')}
              className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                filterType === 'all'
                  ? 'border-indigo-600 bg-indigo-50/70 ring-1 ring-indigo-500'
                  : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
              }`}
            >
              <div className="text-xs font-medium text-slate-500">মোট আপলোড</div>
              <div className="text-lg font-bold text-indigo-900">
                {toBengaliNumber(parsedRows.length)} জন
              </div>
            </button>

            <button
              onClick={() => setFilterType('valid')}
              className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                filterType === 'valid'
                  ? 'border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-500'
                  : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
              }`}
            >
              <div className="text-xs font-medium text-emerald-700 flex items-center">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> সঠিক এন্ট্রি
              </div>
              <div className="text-lg font-bold text-emerald-800">
                {toBengaliNumber(validCount)} জন
              </div>
            </button>

            <button
              onClick={() => setFilterType('warnings')}
              className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                filterType === 'warnings'
                  ? 'border-amber-500 bg-amber-50/70 ring-1 ring-amber-500'
                  : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
              }`}
            >
              <div className="text-xs font-medium text-amber-700 flex items-center">
                <AlertTriangle className="w-3.5 h-3.5 mr-1" /> সতর্কবার্তা
              </div>
              <div className="text-lg font-bold text-amber-900">
                {toBengaliNumber(warningCount)} জন
              </div>
            </button>

            <button
              onClick={() => setFilterType('errors')}
              className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                filterType === 'errors'
                  ? 'border-rose-600 bg-rose-50/70 ring-1 ring-rose-500'
                  : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
              }`}
            >
              <div className="text-xs font-medium text-rose-700 flex items-center">
                <XCircle className="w-3.5 h-3.5 mr-1" /> সংশোধন আবশ্যক
              </div>
              <div className="text-lg font-bold text-rose-800">
                {toBengaliNumber(errorCount)} জন
              </div>
            </button>
          </div>

          {/* Interactive Editable Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="bg-slate-100 px-4 py-2.5 flex items-center justify-between text-xs font-bold text-slate-700 border-b border-slate-200">
              <span className="flex items-center">
                <Filter className="w-3.5 h-3.5 mr-1 text-slate-500" />
                প্রদর্শিত হচ্ছে: {toBengaliNumber(displayedRows.length)} জন (
                {filterType === 'all'
                  ? 'সকল'
                  : filterType === 'valid'
                  ? 'সঠিক এন্ট্রি'
                  : filterType === 'warnings'
                  ? 'সতর্কবার্তা'
                  : 'ত্রুটিযুক্ত'}
                )
              </span>
              <div className="flex flex-wrap items-center gap-3">
                {Array.from(new Set(parsedRows.map((r) => r.classId))).length > 1 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-600 font-bold">শ্রেণি ফিল্টার:</span>
                    <select
                      value={filterClassId}
                      onChange={(e) => setFilterClassId(e.target.value)}
                      className="text-[11px] font-bold border border-slate-300 rounded-md px-2 py-0.5 bg-white text-indigo-900"
                    >
                      <option value="all">সকল শ্রেণি ({toBengaliNumber(parsedRows.length)} জন)</option>
                      {Array.from(new Set(parsedRows.map((r) => r.classId))).map((cId) => {
                        const cName = classes.find((c) => c.id === cId)?.nameBn || cId;
                        const count = parsedRows.filter((r) => r.classId === cId).length;
                        return (
                          <option key={cId} value={cId}>
                            {cName} ({toBengaliNumber(count)} জন)
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}
                <span className="text-[11px] text-slate-500">
                  নাম, রোল বা শ্রেণিতে ক্লিক করে সরাসরি সংশোধন করুন
                </span>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-200 text-slate-800 font-bold sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-16">রোল</th>
                    <th className="py-2.5 px-3 min-w-[150px]">শিক্ষার্থীর নাম (বাংলা) *</th>
                    <th className="py-2.5 px-3 min-w-[130px]">ইংরেজি নাম</th>
                    <th className="py-2.5 px-2 text-center w-20">শ্রেণি</th>
                    <th className="py-2.5 px-2 text-center w-16">শাখা</th>
                    <th className="py-2.5 px-2 text-center w-16">লিঙ্গ</th>
                    <th className="py-2.5 px-3 min-w-[120px]">অভিভাবক মোবাইল</th>
                    <th className="py-2.5 px-3 min-w-[130px]">পিতার নাম</th>
                    <th className="py-2.5 px-2 text-center w-16">ব্লাড</th>
                    <th className="py-2.5 px-3 text-center w-28">অবস্থা</th>
                    <th className="py-2.5 px-2 text-center w-12">বাদ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {displayedRows.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-slate-500">
                        এই ফিল্টারে কোনো শিক্ষার্থী নেই।
                      </td>
                    </tr>
                  ) : (
                    displayedRows.map((row) => {
                      const actualIdx = parsedRows.findIndex((r) => r.index === row.index);
                      return (
                        <tr
                          key={row.index}
                          className={`hover:bg-slate-50 transition ${
                            !row.isValid
                              ? 'bg-rose-50/50'
                              : row.warnings.length > 0
                              ? 'bg-amber-50/40'
                              : ''
                          }`}
                        >
                          {/* Roll (Editable) */}
                          <td className="py-2 px-2 text-center">
                            <input
                              type="number"
                              value={row.roll}
                              onChange={(e) =>
                                handleUpdateRow(
                                  actualIdx,
                                  'roll',
                                  parseInt(e.target.value, 10) || 1
                                )
                              }
                              className="w-12 text-center font-bold text-slate-900 border border-slate-300 rounded px-1 py-0.5 bg-white"
                            />
                          </td>

                          {/* Bangla Name (Editable) */}
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={row.nameBn}
                              onChange={(e) =>
                                handleUpdateRow(actualIdx, 'nameBn', e.target.value)
                              }
                              placeholder="নাম লিখুন..."
                              className={`w-full font-semibold border rounded px-2 py-0.5 bg-white ${
                                !row.nameBn.trim()
                                  ? 'border-rose-400 bg-rose-50 text-rose-900'
                                  : 'border-slate-300 text-slate-900'
                              }`}
                            />
                          </td>

                          {/* English Name (Editable) */}
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={row.nameEn}
                              onChange={(e) =>
                                handleUpdateRow(actualIdx, 'nameEn', e.target.value)
                              }
                              placeholder="Name in English"
                              className="w-full text-slate-700 border border-slate-300 rounded px-2 py-0.5 bg-white text-xs"
                            />
                          </td>

                          {/* Class (Editable) */}
                          <td className="py-2 px-2 text-center">
                            <select
                              value={row.classId}
                              onChange={(e) => {
                                const newCId = e.target.value;
                                const cObj = classes.find((c) => c.id === newCId);
                                handleUpdateRow(actualIdx, 'classId', newCId);
                                handleUpdateRow(actualIdx, 'classNameDisplay', cObj?.nameBn || '');
                              }}
                              className="text-[11px] font-bold border border-indigo-200 rounded px-1.5 py-0.5 bg-indigo-50/60 text-indigo-950 focus:ring-1 focus:ring-indigo-500"
                            >
                              {classes.map((cls) => (
                                <option key={cls.id} value={cls.id}>
                                  {cls.nameBn}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Section */}
                          <td className="py-2 px-2 text-center">
                            <input
                              type="text"
                              value={row.section}
                              onChange={(e) =>
                                handleUpdateRow(actualIdx, 'section', e.target.value)
                              }
                              className="w-10 text-center border border-slate-300 rounded px-1 py-0.5 bg-white"
                            />
                          </td>

                          {/* Gender */}
                          <td className="py-2 px-2 text-center">
                            <select
                              value={row.gender}
                              onChange={(e) =>
                                handleUpdateRow(actualIdx, 'gender', e.target.value)
                              }
                              className="text-[11px] font-bold border border-slate-300 rounded px-1 py-0.5 bg-white"
                            >
                              <option value="ছাত্র">ছাত্র</option>
                              <option value="ছাত্রী">ছাত্রী</option>
                            </select>
                          </td>

                          {/* Guardian Phone */}
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={row.guardianPhone}
                              onChange={(e) =>
                                handleUpdateRow(actualIdx, 'guardianPhone', e.target.value)
                              }
                              placeholder="017xxxxxxxx"
                              className={`w-full font-mono text-xs border rounded px-2 py-0.5 bg-white ${
                                row.guardianPhone && row.guardianPhone.length !== 11
                                  ? 'border-amber-400 bg-amber-50 text-amber-900'
                                  : 'border-slate-300 text-slate-900'
                              }`}
                            />
                          </td>

                          {/* Father Name */}
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={row.fatherName}
                              onChange={(e) =>
                                handleUpdateRow(actualIdx, 'fatherName', e.target.value)
                              }
                              placeholder="পিতার নাম"
                              className="w-full text-slate-700 border border-slate-300 rounded px-2 py-0.5 bg-white text-xs"
                            />
                          </td>

                          {/* Blood Group */}
                          <td className="py-2 px-2 text-center">
                            <span className="font-bold text-rose-700 text-xs">
                              {row.bloodGroup || '-'}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-2 px-2 text-center">
                            {!row.isValid ? (
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold"
                                title={row.errors.join(', ')}
                              >
                                <XCircle className="w-3 h-3 mr-1" /> ত্রুটি
                              </span>
                            ) : row.warnings.length > 0 ? (
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold"
                                title={row.warnings.join(', ')}
                              >
                                <AlertTriangle className="w-3 h-3 mr-1" /> সতর্কতা
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                <CheckCircle2 className="w-3 h-3 mr-1" /> প্রস্তুত
                              </span>
                            )}
                          </td>

                          {/* Delete row */}
                          <td className="py-2 px-2 text-center">
                            <button
                              onClick={() => handleDeleteRow(actualIdx)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded"
                              title="এই সারিটি মুছে ফেলুন"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

          {/* Registration Mode Selection Options */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-slate-900 flex items-center">
              <Info className="w-4 h-4 mr-1.5 text-indigo-600" />
              নিবন্ধন মোড ও ডাটাবেস সমন্বয় পদ্ধতি নির্ধারণ করুন:
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Option 1: Upsert / Merge */}
              <label
                className={`p-3 rounded-xl border cursor-pointer transition flex items-start space-x-2.5 ${
                  registrationMode === 'upsert'
                    ? 'border-indigo-600 bg-white ring-2 ring-indigo-500/20 shadow-xs'
                    : 'border-slate-200 bg-white/70 hover:bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="reg_mode"
                  checked={registrationMode === 'upsert'}
                  onChange={() => setRegistrationMode('upsert')}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    রোল অনুযায়ী আপডেট ও মার্জ (প্রস্তাবিত)
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    একই রোল নম্বর থাকলে তথ্য হালনাগাদ হবে এবং নতুন রোল থাকলে তালিকায় যুক্ত হবে।
                  </div>
                </div>
              </label>

              {/* Option 2: Append */}
              <label
                className={`p-3 rounded-xl border cursor-pointer transition flex items-start space-x-2.5 ${
                  registrationMode === 'append'
                    ? 'border-indigo-600 bg-white ring-2 ring-indigo-500/20 shadow-xs'
                    : 'border-slate-200 bg-white/70 hover:bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="reg_mode"
                  checked={registrationMode === 'append'}
                  onChange={() => setRegistrationMode('append')}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    নতুন শিক্ষার্থী হিসেবে সংযোজন (Append)
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    পূর্বের শিক্ষার্থীদের অক্ষত রেখে নতুন এন্ট্রি হিসেবে যোগ করা হবে।
                  </div>
                </div>
              </label>

              {/* Option 3: Replace Class */}
              <label
                className={`p-3 rounded-xl border cursor-pointer transition flex items-start space-x-2.5 ${
                  registrationMode === 'replace'
                    ? 'border-rose-600 bg-white ring-2 ring-rose-500/20 shadow-xs'
                    : 'border-slate-200 bg-white/70 hover:bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="reg_mode"
                  checked={registrationMode === 'replace'}
                  onChange={() => setRegistrationMode('replace')}
                  className="mt-0.5 text-rose-600 focus:ring-rose-500"
                />
                <div>
                  <div className="text-xs font-bold text-rose-900">
                    শ্রেণির পুরাতন তালিকা সম্পূর্ণ প্রতিস্থাপন
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    নির্বাচিত শ্রেণির পুরাতন তালিকা মুছে শুধুমাত্র এই নতুন আপলোড তালিকা সংরক্ষণ করা
                    হবে।
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Submission and Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-200">
            <div className="text-xs text-slate-600">
              {Array.from(new Set(parsedRows.map((r) => r.classId))).length > 1 ? (
                <span>
                  অন্তর্ভুক্ত শ্রেণি:{' '}
                  <span className="font-bold text-indigo-900">
                    {Array.from(new Set(parsedRows.map((r) => r.classId)))
                      .map((cId) => classes.find((c) => c.id === cId)?.nameBn || cId)
                      .join(', ')}
                  </span>{' '}
                  |
                </span>
              ) : (
                <span>
                  টার্গেট শ্রেণি:{' '}
                  <span className="font-bold text-indigo-900">
                    {classes.find((c) => c.id === (parsedRows[0]?.classId || selectedClassId))?.nameBn || currentClass?.nameBn}
                  </span>{' '}
                  |
                </span>
              )}
              <span className="ml-1">
                নিবন্ধনের জন্য প্রস্তুত:{' '}
                <span className="font-bold text-emerald-700">{toBengaliNumber(validCount)} জন</span>
              </span>
              {errorCount > 0 && (
                <span className="text-rose-600 ml-2 font-medium">
                  ({toBengaliNumber(errorCount)} জন ত্রুটির কারণে বাদ যাবে)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 text-xs font-bold hover:bg-slate-50"
              >
                বাতিল
              </button>

              <button
                type="button"
                disabled={validCount === 0 || isSubmitting}
                onClick={handleCommitRegistration}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white rounded-xl text-xs font-bold shadow-md disabled:opacity-50 flex items-center cursor-pointer transition transform active:scale-95"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-1.5" />
                )}
                ডাটাবেসে নিবন্ধন চূড়ান্ত করুন ({toBengaliNumber(validCount)} জন)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS CONFIRMATION MODAL */}
      {successInfo && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 text-center space-y-5 animate-in zoom-in-95">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-slate-900 font-serif">
                অভিনন্দন! বাল্ক নিবন্ধন সম্পন্ন হয়েছে
              </h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                <span className="font-bold text-emerald-800">
                  {toBengaliNumber(successInfo.count)} জন শিক্ষার্থীর
                </span>{' '}
                তথ্য সফলভাবে {currentClass?.nameBn}-এর ডাটাবেসে নিবন্ধিত করা হয়েছে।
              </p>
              <div className="mt-2 inline-block px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                পদ্ধতি: {successInfo.mode}
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={() => {
                  setSuccessInfo(null);
                  if (onSuccessNavigate) {
                    onSuccessNavigate();
                  } else if (onCloseModal) {
                    onCloseModal();
                  } else {
                    handleReset();
                  }
                }}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition cursor-pointer"
              >
                শিক্ষার্থী তালিকা দেখুন (Student List)
              </button>

              <button
                onClick={() => {
                  setSuccessInfo(null);
                  handleReset();
                }}
                className="w-full py-2 text-slate-600 hover:text-slate-900 text-xs font-semibold"
              >
                আরও শিক্ষার্থী আপলোড করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
