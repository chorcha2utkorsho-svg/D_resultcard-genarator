import React from 'react';
import { Printer, Download, TableProperties, Award } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { toBengaliNumber, toBengaliRoll } from '../utils/bengali';
import { SchoolLogo } from './SchoolLogo';

export const TabulationSheet: React.FC = () => {
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

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center px-3.5 py-2 rounded-lg text-xs font-bold border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-xs transition"
            >
              <Download className="w-4 h-4 mr-1.5 text-emerald-600" />
              CSV / Excel ডাউনলোড
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition"
            >
              <Printer className="w-4 h-4 mr-1.5" />
              ট্যাবুল্যাশন শিট প্রিন্ট করুন
            </button>
          </div>
        </div>

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
      <div className="printable-area bg-white p-6 rounded-xl border border-slate-300 shadow-sm overflow-x-auto text-black">
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
