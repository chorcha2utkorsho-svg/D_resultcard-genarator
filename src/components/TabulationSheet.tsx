import React, { useState } from 'react';
import { Printer, Download, TableProperties, Award, FileSpreadsheet, Check, Loader2, BookMarked } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useSchool } from '../context/SchoolContext';
import { toBengaliNumber, toBengaliRoll } from '../utils/bengali';
import { SchoolLogo } from './SchoolLogo';
import { exportElementToPDF } from '../utils/pdfExport';

interface TabulationSheetProps {
  onNavigate?: (tab: string) => void;
}

export const TabulationSheet: React.FC<TabulationSheetProps> = ({ onNavigate }) => {
  const {
    schoolInfo,
    classes,
    examTerms,
    selectedYear,
    setSelectedYear,
    selectedExamId,
    setSelectedExamId,
    selectedClassId,
    setSelectedClassId,
    selectedSection,
    setSelectedSection,
    getCalculatedResultsForClass,
  } = useSchool();

  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  const currentClass = classes.find((c) => c.id === selectedClassId) || classes[0];
  const subjects = currentClass?.defaultSubjects || [];
  const classResults = getCalculatedResultsForClass(
    selectedClassId,
    selectedSection,
    selectedExamId,
    selectedYear
  );

  const examTerm = examTerms.find((e) => e.id === selectedExamId);

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = async () => {
    const element = document.getElementById('tabulation-sheet-printable');
    if (!element) return;

    setIsExportingPdf(true);
    try {
      const cleanExamName = (examTerm?.nameBn || 'exam').replace(/\s+/g, '_');
      const cleanClassName = currentClass.nameBn.replace(/\s+/g, '_');
      const fileName = `ট্যাবুল্যাশন_শিট_${cleanClassName}_${cleanExamName}_${selectedYear}.pdf`;

      await exportElementToPDF(element, {
        fileName,
        quality: 2.0,
        orientation: 'landscape',
        format: 'a4',
        margin: 5,
      });

      setExportSuccessMsg(`ট্যাবুল্যাশন শিট PDF ফাইল (${fileName}) সফলভাবে ডাউনলোড হয়েছে!`);
      setTimeout(() => setExportSuccessMsg(null), 4000);
    } catch (err) {
      console.error(err);
      setExportSuccessMsg('PDF ডাউনলোডে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
      setTimeout(() => setExportSuccessMsg(null), 4000);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportExcel = () => {
    const passedCount = classResults.filter((r) => r.isPassed).length;
    const failedCount = classResults.length - passedCount;
    const passRate = classResults.length > 0 ? ((passedCount / classResults.length) * 100).toFixed(1) : '0';

    // Build worksheet data rows (Array of Arrays)
    const rows: (string | number)[][] = [];

    // Title & School Information
    rows.push([schoolInfo.name]);
    rows.push([schoolInfo.address]);
    rows.push([
      `ট্যাবুল্যাশন শিট (Tabulation Sheet) - ${examTerm?.nameBn || ''} (${selectedYear} ইং)`,
    ]);
    rows.push([
      `শ্রেণি: ${currentClass.nameBn} | শাখা: ${selectedSection || 'সকল শাখা'} | মোট শিক্ষার্থী: ${classResults.length} জন | পাসের হার: ${passRate}%`,
    ]);
    rows.push([]); // empty spacer row

    // Table Header Row
    const headerRow: string[] = [
      'মেধাক্রম',
      'রোল',
      'শিক্ষার্থীর নাম',
      'পিতা/অভিভাবক',
      'শাখা',
      'মোবাইল নম্বর',
    ];

    subjects.forEach((sub) => {
      headerRow.push(`${sub.nameBn} (${sub.fullMarks})`);
    });

    headerRow.push(
      'সর্বমোট প্রাপ্ত নম্বর',
      'মোট পূর্ণমান',
      'শতকরা (%)',
      'জিপিএ (GPA)',
      'লেটার গ্রেড',
      'ফলাফল (স্ট্যাটাস)'
    );

    rows.push(headerRow);

    // Student Data Rows
    classResults.forEach((res) => {
      const percentage =
        res.totalFullMarks > 0
          ? ((res.grandTotalObtained / res.totalFullMarks) * 100).toFixed(1)
          : '0';

      const row: (string | number)[] = [
        res.meritPositionBn || res.meritPosition,
        res.student.roll,
        res.student.nameBn,
        res.student.fatherName || res.student.motherName || '',
        res.student.section || selectedSection || '',
        res.student.guardianPhone || '',
      ];

      // Subject-wise marks
      res.subjectRows.forEach((sRow) => {
        if (sRow.totalObtained !== null && sRow.totalObtained !== undefined) {
          row.push(`${sRow.totalObtained} (${sRow.letterGrade})`);
        } else {
          row.push('-');
        }
      });

      row.push(
        res.grandTotalObtained,
        res.totalFullMarks,
        `${percentage}%`,
        Number(res.gpa.toFixed(2)),
        res.overallGrade,
        res.isPassed ? 'উত্তীর্ণ' : 'অনুত্তীর্ণ'
      );

      rows.push(row);
    });

    // Summary Statistics Rows
    rows.push([]);
    rows.push([
      'সারসংক্ষেপ:',
      `মোট শিক্ষার্থী: ${classResults.length} জন`,
      `উত্তীর্ণ: ${passedCount} জন`,
      `অনুত্তীর্ণ: ${failedCount} জন`,
      `পাসের হার: ${passRate}%`,
    ]);

    // Create Worksheet
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Calculate Column Widths dynamically
    const colWidths = [
      { wch: 10 }, // Merit
      { wch: 8 },  // Roll
      { wch: 25 }, // Name
      { wch: 20 }, // Father/Guardian
      { wch: 8 },  // Section
      { wch: 15 }, // Phone
    ];

    subjects.forEach(() => {
      colWidths.push({ wch: 16 });
    });

    colWidths.push(
      { wch: 18 }, // Total Obtained
      { wch: 14 }, // Full Marks
      { wch: 12 }, // Percentage
      { wch: 12 }, // GPA
      { wch: 12 }, // Grade
      { wch: 16 }  // Status
    );

    ws['!cols'] = colWidths;

    // Create Workbook and append sheet
    const wb = XLSX.utils.book_new();
    const sheetName = `${currentClass.nameBn}`.substring(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // Clean filename
    const cleanExamName = (examTerm?.nameBn || 'exam').replace(/\s+/g, '_');
    const cleanClassName = currentClass.nameBn.replace(/\s+/g, '_');
    const fileName = `ট্যাবুল্যাশন_শিট_${cleanClassName}_${cleanExamName}_${selectedYear}.xlsx`;

    // Download .xlsx file
    XLSX.writeFile(wb, fileName);

    setExportSuccessMsg(`এক্সেল ফাইল (${fileName}) সফলভাবে ডাউনলোড হয়েছে!`);
    setTimeout(() => setExportSuccessMsg(null), 4000);
  };

  const handleExportCSV = () => {
    let csv = `রোলা,নাম,শাখা,`;
    subjects.forEach((s) => {
      csv += `"${s.nameBn} (${s.fullMarks})",`;
    });
    csv += `মোট নম্বর,জিপিএ,গ্রেড,মেধাক্রম\n`;

    classResults.forEach((res) => {
      csv += `${res.student.roll},"${res.student.nameBn}","${res.student.section || ''}",`;
      res.subjectRows.forEach((row) => {
        csv += `${row.totalObtained ?? ''},`;
      });
      csv += `${res.grandTotalObtained},${res.gpa.toFixed(2)},${res.overallGrade},"${res.meritPositionBn}"\n`;
    });

    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tabulation_sheet_${currentClass.nameBn}_${selectedYear}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Non-print control bar */}
      <div className="no-print bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 font-serif flex items-center">
              <TableProperties className="w-5 h-5 mr-2 text-indigo-600" />
              ট্যাবুল্যাশন শিট (Tabulation Sheet)
            </h2>
            <p className="text-xs text-slate-500">
              সকল শিক্ষার্থীর বিষয়ভিত্তিক নম্বর, সর্বমোট নম্বর, জিপিএ ও মেধাক্রমের পূর্ণাঙ্গ মাস্টার শিট।
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportPDF}
              disabled={isExportingPdf || classResults.length === 0}
              className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-bold border border-indigo-600 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition disabled:opacity-50"
              title="ট্যাবুল্যাশন শিট হাই-কোয়ালিটি PDF ফরম্যাটে ডাউনলোড করুন"
            >
              {isExportingPdf ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-1.5" />
              )}
              PDF ডাউনলোড
            </button>
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-bold border border-emerald-600 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition"
              title="মাইক্রোসফট এক্সেল (.xlsx) ফরম্যাটে ডাউনলোড করুন"
            >
              <FileSpreadsheet className="w-4 h-4 mr-1.5" />
              Excel (.xlsx) ডাউনলোড
            </button>
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center px-3.5 py-2 rounded-lg text-xs font-bold border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-xs transition"
              title="সাধারণ CSV ফরম্যাটে ডাউনলোড করুন"
            >
              <Download className="w-4 h-4 mr-1.5 text-slate-600" />
              CSV ফাইল
            </button>
            {onNavigate && (
              <button
                onClick={() => onNavigate('subjects')}
                className="inline-flex items-center px-3.5 py-2 rounded-lg text-xs font-bold border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 shadow-xs transition cursor-pointer"
                title="শ্রেণির বিষয়সমূহ পরিচালনা বা নতুন বিষয় যোগ করুন"
              >
                <BookMarked className="w-4 h-4 mr-1.5 text-indigo-600" />
                বিষয় ব্যবস্থাপনা
              </button>
            )}
            <button
              onClick={handlePrint}
              className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white shadow-xs transition"
            >
              <Printer className="w-4 h-4 mr-1.5" />
              প্রিন্ট করুন
            </button>
          </div>
        </div>

        {exportSuccessMsg && (
          <div className="mb-4 bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-2.5 rounded-lg text-xs font-bold flex items-center shadow-xs animate-in fade-in">
            <Check className="w-4 h-4 mr-2 text-emerald-600" />
            {exportSuccessMsg}
          </div>
        )}

        {/* Filter Controls */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">পরীক্ষা</label>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="w-full text-sm font-medium border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none"
            >
              {examTerms.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.nameBn}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">শিক্ষাবর্ষ</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full text-sm font-medium border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none"
            >
              <option value="২০২৬">২০২৬</option>
              <option value="২০২৫">২০২৫</option>
              <option value="২০২৭">২০২৭</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">শ্রেণি</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full text-sm font-bold border border-indigo-300 rounded-lg px-2.5 py-1.5 bg-indigo-50/50 text-indigo-900 focus:outline-none"
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
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full text-sm font-medium border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none"
            >
              <option value="">সকল শাখা</option>
              <option value="ক">ক শাখা</option>
              <option value="খ">খ শাখা</option>
            </select>
          </div>
        </div>
      </div>

      {/* TABULATION SHEET PRINTABLE CANVAS */}
      <div
        id="tabulation-sheet-printable"
        className="printable-area bg-white p-6 rounded-xl border border-slate-300 shadow-sm overflow-x-auto text-black"
      >
        {/* School Header */}
        <div className="text-center pb-4 border-b-2 border-black mb-4 flex items-center justify-between">
          <div className="w-20">
            <SchoolLogo customLogoUrl={schoolInfo.logoUrl} size={70} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-serif">{schoolInfo.name}</h1>
            <p className="text-xs sm:text-sm font-medium">{schoolInfo.address}</p>
            <h2 className="text-lg font-bold font-serif mt-1">
              ট্যাবুল্যাশন শিট (Tabulation Sheet) - {examTerm?.nameBn} ({toBengaliNumber(selectedYear)} ইং)
            </h2>
            <p className="text-sm font-semibold">
              শ্রেণি: {currentClass.nameBn} {selectedSection && `| শাখা: ${selectedSection}`} | মোট শিক্ষার্থী: {toBengaliNumber(classResults.length)} জন
            </p>
          </div>
          <div className="w-20"></div>
        </div>

        {/* Tabulation Table */}
        <table className="w-full text-xs border-collapse border border-black text-center">
          <thead>
            <tr className="bg-slate-100 font-bold border-b border-black">
              <th className="border-r border-black py-2 px-1 w-12">মেধা</th>
              <th className="border-r border-black py-2 px-1 w-12">রোল</th>
              <th className="border-r border-black py-2 px-2 text-left min-w-[130px]">শিক্ষার্থীর নাম</th>
              {subjects.map((sub) => (
                <th key={sub.id} className="border-r border-black py-2 px-1">
                  <div className="truncate max-w-[85px] mx-auto">{sub.nameBn}</div>
                  <div className="text-[10px] text-slate-600 font-normal">({toBengaliNumber(sub.fullMarks)})</div>
                </th>
              ))}
              <th className="border-r border-black py-2 px-1 font-bold bg-slate-200/50">মোট নম্বর</th>
              <th className="border-r border-black py-2 px-1 font-bold">জিপিএ</th>
              <th className="border-r border-black py-2 px-1 font-bold">গ্রেড</th>
              <th className="py-2 px-1">ফলাফল</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black">
            {classResults.map((res) => (
              <tr key={res.student.id} className="hover:bg-slate-50">
                <td className="border-r border-black py-2 px-1 font-bold bg-amber-50/30">
                  {res.meritPositionBn}
                </td>
                <td className="border-r border-black py-2 px-1 font-bold">
                  {toBengaliRoll(res.student.roll)}
                </td>
                <td className="border-r border-black py-2 px-2 text-left font-medium">
                  {res.student.nameBn}
                </td>
                {res.subjectRows.map((row) => (
                  <td key={row.subject.id} className="border-r border-black py-2 px-1">
                    {row.totalObtained !== null ? (
                      <span className={row.letterGrade === 'F' ? 'text-red-600 font-bold' : ''}>
                        {toBengaliNumber(row.totalObtained)}
                        <span className="text-[10px] text-slate-500 ml-0.5">({row.letterGrade})</span>
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                ))}
                <td className="border-r border-black py-2 px-1 font-bold bg-slate-100/50">
                  {toBengaliNumber(res.grandTotalObtained)}
                </td>
                <td className="border-r border-black py-2 px-1 font-bold">
                  {toBengaliNumber(res.gpa.toFixed(2))}
                </td>
                <td className="border-r border-black py-2 px-1 font-bold">
                  <span className={res.overallGrade === 'F' ? 'text-red-600' : 'text-emerald-800'}>
                    {res.overallGrade}
                  </span>
                </td>
                <td className="py-2 px-1 font-semibold">
                  {res.isPassed ? (
                    <span className="text-emerald-700">উত্তীর্ণ</span>
                  ) : (
                    <span className="text-red-700">অনুত্তীর্ণ</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Tabulation Footer Signatures */}
        <div className="pt-16 mt-8 flex justify-between items-center text-xs font-bold text-center px-8">
          <div>
            <div className="w-36 border-b border-dotted border-black mb-1"></div>
            <span>শ্রেণি শিক্ষক</span>
          </div>
          <div>
            <div className="w-36 border-b border-dotted border-black mb-1"></div>
            <span>পরীক্ষা নিয়ন্ত্রক</span>
          </div>
          <div>
            <div className="w-36 border-b border-dotted border-black mb-1"></div>
            <span>প্রধান শিক্ষক / অধ্যক্ষ</span>
          </div>
        </div>
      </div>
    </div>
  );
};
