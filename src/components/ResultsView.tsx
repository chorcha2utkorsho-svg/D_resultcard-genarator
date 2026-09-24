import React, { useState } from 'react';
import {
  Printer,
  User,
  Users,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Trophy,
  Award,
  CheckCircle,
  Share2,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { MarksheetCard } from './MarksheetCard';
import { toBengaliNumber, toBengaliRoll } from '../utils/bengali';

export const ResultsView: React.FC = () => {
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

  const [printMode, setPrintMode] = useState<'single' | 'batch'>('single');
  const [selectedStudentIndex, setSelectedStudentIndex] = useState<number>(0);
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);

  const currentClass = classes.find((c) => c.id === selectedClassId) || classes[0];

  // Calculate full results for the class
  const classResults = getCalculatedResultsForClass(
    selectedClassId,
    selectedSection,
    selectedExamId,
    selectedYear
  );

  const activeResult = classResults[selectedStudentIndex] || classResults[0];

  // Initialize batch selection when results change
  React.useEffect(() => {
    if (classResults.length > 0) {
      setSelectedBatchIds(classResults.map((r) => r.student.id));
    }
  }, [selectedClassId, selectedSection, selectedExamId, selectedYear, classResults.length]);

  const handlePrint = () => {
    window.print();
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedBatchIds(classResults.map((r) => r.student.id));
    } else {
      setSelectedBatchIds([]);
    }
  };

  const toggleStudentSelection = (id: string) => {
    setSelectedBatchIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Stats calculation
  const totalStudents = classResults.length;
  const passedStudents = classResults.filter((r) => r.isPassed).length;
  const topStudent = classResults.find((r) => r.meritPosition === 1);
  const avgGpa =
    totalStudents > 0
      ? (classResults.reduce((sum, r) => sum + r.gpa, 0) / totalStudents).toFixed(2)
      : '0.00';

  return (
    <div className="space-y-6">
      {/* Non-print control bar */}
      <div className="no-print space-y-4">
        {/* Top Control Header */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 mb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 font-serif flex items-center">
                <Printer className="w-5 h-5 mr-2 text-indigo-600" />
                ফলাফল ও প্রোগ্রেস কার্ড প্রিন্ট
              </h2>
              <p className="text-xs text-slate-500">
                সংযুক্ত অফিসিয়াল ফরম্যাটে একক অথবা একসাথে সকল শিক্ষার্থীর রেজাল্ট কার্ড প্রিন্ট করুন।
              </p>
            </div>

            {/* Print Mode Switcher */}
            <div className="flex items-center space-x-2">
              <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                <button
                  onClick={() => setPrintMode('single')}
                  className={`inline-flex items-center px-3 py-1.5 rounded-md text-xs font-bold transition ${
                    printMode === 'single'
                      ? 'bg-white shadow text-indigo-700'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <User className="w-3.5 h-3.5 mr-1" />
                  একক রেজাল্ট কার্ড
                </button>
                <button
                  onClick={() => setPrintMode('batch')}
                  className={`inline-flex items-center px-3 py-1.5 rounded-md text-xs font-bold transition ${
                    printMode === 'batch'
                      ? 'bg-white shadow text-indigo-700'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 mr-1" />
                  একসাথে সকল রেজাল্ট প্রিন্ট
                </button>
              </div>

              {/* Action Print Button */}
              <button
                onClick={handlePrint}
                className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition"
              >
                <Printer className="w-4 h-4 mr-1.5" />
                {printMode === 'single' ? 'এই কার্ডটি প্রিন্ট করুন' : 'নির্বাচিত সকল কার্ড প্রিন্ট করুন'}
              </button>
            </div>
          </div>

          {/* Filter Row */}
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

        {/* Quick Result Stats Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
            <div className="p-2.5 bg-blue-50 text-blue-700 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">মোট শিক্ষার্থী</div>
              <div className="text-lg font-bold text-slate-900">
                {toBengaliNumber(totalStudents)} জন
              </div>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-lg">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">উত্তীর্ণের সংখ্যা</div>
              <div className="text-lg font-bold text-emerald-700">
                {toBengaliNumber(passedStudents)} জন (
                {totalStudents > 0 ? toBengaliNumber(Math.round((passedStudents / totalStudents) * 100)) : 0}%)
              </div>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
            <div className="p-2.5 bg-amber-50 text-amber-700 rounded-lg">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">গড় জিপিএ (GPA)</div>
              <div className="text-lg font-bold text-slate-900">
                {toBengaliNumber(avgGpa)}
              </div>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
            <div className="p-2.5 bg-purple-50 text-purple-700 rounded-lg">
              <Trophy className="w-5 h-5" />
            </div>
            <div className="truncate">
              <div className="text-xs text-slate-500 font-medium">১ম স্থান (মেধাক্রম ১)</div>
              <div className="text-sm font-bold text-purple-900 truncate">
                {topStudent ? `${topStudent.student.nameBn}` : '-'}
              </div>
            </div>
          </div>
        </div>

        {/* Single Student Selector Navigation */}
        {printMode === 'single' && classResults.length > 0 && (
          <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-indigo-900">শিক্ষার্থী নির্বাচন:</span>
              <select
                value={selectedStudentIndex}
                onChange={(e) => setSelectedStudentIndex(parseInt(e.target.value, 10))}
                className="text-sm font-bold border border-indigo-300 rounded-lg px-3 py-1.5 bg-white text-indigo-950 focus:outline-none"
              >
                {classResults.map((res, idx) => (
                  <option key={res.student.id} value={idx}>
                    রোল {toBengaliRoll(res.student.roll)}: {res.student.nameBn} (জিপিএ: {res.gpa.toFixed(2)}, {res.meritPositionBn})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <button
                disabled={selectedStudentIndex <= 0}
                onClick={() => setSelectedStudentIndex((prev) => Math.max(0, prev - 1))}
                className="inline-flex items-center px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> পূর্ববর্তী
              </button>
              <span className="text-xs font-semibold text-slate-600">
                {toBengaliNumber(selectedStudentIndex + 1)} / {toBengaliNumber(classResults.length)}
              </span>
              <button
                disabled={selectedStudentIndex >= classResults.length - 1}
                onClick={() =>
                  setSelectedStudentIndex((prev) => Math.min(classResults.length - 1, prev + 1))
                }
                className="inline-flex items-center px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                পরবর্তী <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        )}

        {/* Batch Print Student Checklist Selector */}
        {printMode === 'batch' && (
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between pb-3 border-b border-amber-200/80 mb-3 gap-2">
              <div>
                <h4 className="text-sm font-bold text-amber-950">
                  একসাথে সকল রেজাল্ট প্রিন্ট চেকলিস্ট
                </h4>
                <p className="text-xs text-amber-800">
                  নিচের যেসকল শিক্ষার্থীর পাশে টিক চিহ্ন রয়েছে তাদের রেজাল্ট কার্ড প্রিন্ট হবে।
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <label className="inline-flex items-center text-xs font-bold text-amber-950 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedBatchIds.length === classResults.length && classResults.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 mr-1.5 h-4 w-4"
                  />
                  সবাইকে নির্বাচন করুন ({toBengaliNumber(selectedBatchIds.length)} জন)
                </label>
                <button
                  onClick={handlePrint}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5 inline mr-1" /> এখনই প্রিন্ট দিন
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 max-h-48 overflow-y-auto pr-1">
              {classResults.map((res) => {
                const isSelected = selectedBatchIds.includes(res.student.id);
                return (
                  <label
                    key={res.student.id}
                    className={`flex items-center p-2 rounded-lg border text-xs cursor-pointer transition ${
                      isSelected
                        ? 'bg-white border-indigo-400 font-semibold text-indigo-950 shadow-xs'
                        : 'bg-amber-100/40 border-amber-200 text-slate-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleStudentSelection(res.student.id)}
                      className="rounded text-indigo-600 mr-2 h-3.5 w-3.5"
                    />
                    <span className="truncate">
                      রোল {toBengaliRoll(res.student.roll)}: {res.student.nameBn}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* RESULT CARDS RENDERING (PRINTABLE AREA) */}
      <div className="printable-area">
        {classResults.length === 0 ? (
          <div className="no-print bg-white p-12 text-center rounded-xl border border-slate-200 text-slate-500">
            এই শ্রেণিতে এখনো কোনো ফলাফল প্রস্তুত নেই। &quot;মার্ক এন্ট্রি&quot; থেকে নম্বর এন্ট্রি সম্পন্ন করুন।
          </div>
        ) : printMode === 'single' ? (
          /* Single Card View */
          activeResult && (
            <MarksheetCard
              result={activeResult}
              schoolInfo={schoolInfo}
              classNameTitle={currentClass.nameBn}
              isPrintMode={false}
            />
          )
        ) : (
          /* Batch Cards View - Each will break onto its own A4 page in print! */
          <div className="space-y-8 print:space-y-0">
            {classResults
              .filter((res) => selectedBatchIds.includes(res.student.id))
              .map((res) => (
                <MarksheetCard
                  key={res.student.id}
                  result={res}
                  schoolInfo={schoolInfo}
                  classNameTitle={currentClass.nameBn}
                  isPrintMode={true}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
};
