import React, { useEffect, useMemo, useState } from 'react';
import { Printer, X, ArrowLeft, Columns, Square } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { SingleReceiptSlip, PrintableReceiptData } from './PrintableReceiptLayout';
import { STANDARD_8_VOUCHER_HEADS } from '../data/defaultData';
import { toBengaliNumber, toBengaliRoll } from '../utils/bengali';
import { numberToBengaliWords } from '../utils/bengaliWords';
import { Student } from '../types';

type LayoutMode = 'two_receipts' | 'single_receipt';

export const StandaloneVoucherPrintView: React.FC = () => {
  const { schoolInfo, students, feeInvoices, classes } = useSchool();

  const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const classId = urlParams.get('classId') || classes[0]?.id || 'class_play';
  const section = urlParams.get('section') || 'all';
  const initialLayout = urlParams.get('layout');
  const voucherMode = urlParams.get('voucherMode') || 'blank_students';
  const customTitle = urlParams.get('title') || 'বকেয়া নোটিশ / বিল';
  const copyLabel = urlParams.get('copyLabel') || '- শিক্ষার্থী কপি (নোটিশ বিল) -';

  // Toggle state: 'two_receipts' (split A4 landscape) or 'single_receipt' (A4 centered portrait)
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(
    initialLayout === 'single_student_double_copy' || initialLayout === 'single_receipt'
      ? 'single_receipt'
      : 'two_receipts'
  );

  const [hasAutoPrinted, setHasAutoPrinted] = useState(false);

  const currentClass = useMemo(() => {
    return classes.find((c) => c.id === classId) || classes[0];
  }, [classes, classId]);

  const classStudents = useMemo(() => {
    let list = students.filter((s) => s.classId === classId);
    if (section !== 'all') {
      list = list.filter((s) => s.section === section);
    }
    return list.sort((a, b) => a.roll - b.roll);
  }, [students, classId, section]);

  const getStudentVoucherData = (student: Student | null): PrintableReceiptData => {
    const matchedClass = student ? classes.find((c) => c.id === student.classId) : null;
    const classNameBn = matchedClass ? matchedClass.nameBn : currentClass?.nameBn || 'শ্রেণি';

    if (voucherMode === 'blank_students' || voucherMode === 'universal_blank' || !student) {
      const blankItems = STANDARD_8_VOUCHER_HEADS.map((head) => ({
        serialBn: head.serialBn,
        nameBn: head.nameBn,
        amount: 0,
      }));
      return {
        classNameBn,
        items: blankItems,
        grandTotal: 0,
        grandTotalWords: '',
      };
    }

    const studentInvoice = feeInvoices.find((inv) => inv.studentId === student.id);
    const items = STANDARD_8_VOUCHER_HEADS.map((head) => {
      let amount = 0;
      if (studentInvoice) {
        if (head.id === 'fh_arrears') {
          amount = studentInvoice.previousDue || 0;
        } else {
          const match = studentInvoice.items.find(
            (item) =>
              item.headId === head.id ||
              item.nameBn.includes(head.nameBn) ||
              head.nameBn.includes(item.nameBn)
          );
          if (match) {
            amount = match.netAmount || match.amount || 0;
          }
        }
      } else {
        amount = 0;
      }
      return {
        serialBn: head.serialBn,
        nameBn: head.nameBn,
        amount,
      };
    });

    const grandTotal = items.reduce((sum, i) => sum + i.amount, 0);
    const grandTotalWords = grandTotal > 0 ? numberToBengaliWords(grandTotal) : '';

    return {
      classNameBn,
      items,
      grandTotal,
      grandTotalWords,
    };
  };

  const groupedStudents = useMemo(() => {
    if (layoutMode === 'single_receipt') {
      return classStudents.map((s) => [s]);
    }
    // Two Receipts side-by-side
    const groups: (Student | null)[][] = [];
    for (let i = 0; i < classStudents.length; i += 2) {
      groups.push([classStudents[i] || null, classStudents[i + 1] || null]);
    }
    return groups;
  }, [classStudents, layoutMode]);

  const calculatedPageCount = useMemo(() => {
    if (layoutMode === 'single_receipt') {
      return classStudents.length;
    }
    return Math.ceil(classStudents.length / 2);
  }, [layoutMode, classStudents.length]);

  useEffect(() => {
    if (!hasAutoPrinted) {
      const timer = setTimeout(() => {
        window.focus();
        window.print();
        setHasAutoPrinted(true);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [hasAutoPrinted]);

  const handleManualPrint = () => {
    window.focus();
    window.print();
  };

  const orientation = layoutMode === 'single_receipt' ? 'portrait' : 'landscape';

  return (
    <div className="min-h-screen bg-slate-200 text-black print:bg-white p-0">
      <style>{`
        @page {
          size: ${orientation === 'landscape' ? '297mm 210mm' : '210mm 297mm'} !important;
          margin: ${layoutMode === 'single_receipt' ? '6mm 6mm' : '5mm 5mm'} !important;
        }
        body {
          background: #ffffff !important;
          color: #000000 !important;
          margin: 0 !important;
          padding: 0 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .no-print {
          display: none !important;
        }
        .official-voucher-a4-sheet {
          page-break-after: always !important;
          break-after: page !important;
          margin: 0 auto !important;
          box-shadow: none !important;
          border: none !important;
          width: 100% !important;
          box-sizing: border-box !important;
        }
        .official-voucher-a4-sheet:last-child {
          page-break-after: avoid !important;
          break-after: avoid !important;
        }
        .official-voucher-slip {
          border: 2px solid #000000 !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          box-sizing: border-box !important;
        }
      `}</style>

      {/* Floating Action Bar with Layout Toggle */}
      <div className="no-print sticky top-0 z-50 bg-slate-900 text-white p-3 shadow-xl border-b border-slate-700 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => window.history.back()}
            className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition"
            title="ফিরে যান"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-sm sm:text-base font-bold font-serif flex items-center gap-2">
              <span>{schoolInfo.name || 'ডি-লিকন মডেল একাডেমী'}</span>
              <span className="text-amber-400 font-sans">• {customTitle}</span>
              <span className="px-2 py-0.5 text-xs bg-emerald-800 text-emerald-200 rounded-full font-sans">
                {currentClass?.nameBn} ({toBengaliNumber(classStudents.length)} জন)
              </span>
            </h1>
            <p className="text-[11px] text-slate-300">
              {layoutMode === 'two_receipts'
                ? `১ পাতায় পাশাপাশি ২টি স্লিপ (A4 Landscape) • মোট পাতা: ${toBengaliNumber(calculatedPageCount)} টি (৫০% কাগজ সাশ্রয়)`
                : `১ পাতায় ১টি পূর্ণাঙ্গ রিসিট (A4 Portrait সেন্টার্ড) • মোট পাতা: ${toBengaliNumber(calculatedPageCount)} টি`}
            </p>
          </div>
        </div>

        {/* Layout Mode Toggle Buttons */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700 shadow-inner">
            <button
              type="button"
              onClick={() => setLayoutMode('two_receipts')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer ${
                layoutMode === 'two_receipts'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
              title="১টি A4 পাতায় পাশাপাশি ২টি স্লিপ (Landscape)"
            >
              <Columns className="w-4 h-4" />
              <span>২টি রিসিট (A4 স্প্লিট)</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('single_receipt')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer ${
                layoutMode === 'single_receipt'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
              title="১টি A4 পাতায় ১টি পূর্ণাঙ্গ রিসিট (Portrait Centered)"
            >
              <Square className="w-4 h-4" />
              <span>১টি রিসিট (A4 সেন্টার্ড)</span>
            </button>
          </div>

          <button
            onClick={handleManualPrint}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm flex items-center space-x-2 shadow-lg cursor-pointer transition active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>🖨 এখনই প্রিন্ট করুন (Ctrl + P)</span>
          </button>
          <button
            onClick={() => window.close()}
            className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition cursor-pointer"
            title="ট্যাব বন্ধ করুন"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Print Container */}
      <div className="p-3 sm:p-6 space-y-6 max-w-6xl mx-auto print:p-0 print:space-y-0 print:m-0 print:max-w-none">
        {classStudents.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-xl shadow-md">
            <h2 className="text-lg font-bold text-slate-800">
              {currentClass?.nameBn}-এ কোনো শিক্ষার্থী পাওয়া যায়নি।
            </h2>
          </div>
        ) : (
          groupedStudents.map((group, pageIdx) => {
            // OPTION 1: SINGLE RECEIPT (A4 CENTERED PORTRAIT)
            if (layoutMode === 'single_receipt') {
              const student = group[0];
              const data = student ? getStudentVoucherData(student) : getStudentVoucherData(null);

              return (
                <div key={`standalone_single_wrap_${pageIdx}`} className="space-y-1">
                  <div className="no-print text-xs text-slate-500 font-semibold mb-1 print:hidden flex justify-between bg-slate-200/90 px-3 py-1.5 rounded-lg max-w-[950px] mx-auto border border-slate-300">
                    <span>
                      পাতা {toBengaliNumber(pageIdx + 1)} / {toBengaliNumber(calculatedPageCount)}: {student?.nameBn} (রোল: {student ? toBengaliRoll(student.roll) : '-'})
                    </span>
                    <span className="text-blue-700 font-bold">১ পাতায় ১টি রিসিট (A4 Centered Portrait)</span>
                  </div>

                  <div
                    key={`standalone_single_sheet_${pageIdx}`}
                    className="official-voucher-a4-sheet bg-white p-4 sm:p-6 shadow-lg max-w-[210mm] mx-auto print:shadow-none print:p-0 print:m-0 print:w-full page-break-after flex items-center justify-center"
                    style={{
                      width: '100%',
                      maxWidth: '210mm',
                      minHeight: '270mm',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div className="w-full max-w-[190mm] mx-auto my-auto">
                      <SingleReceiptSlip
                        schoolInfo={schoolInfo}
                        student={student}
                        data={data}
                        voucherTitle={customTitle}
                        copyLabel={copyLabel}
                        isBlankAmounts={voucherMode === 'blank_students'}
                        isSingleReceiptFullA4={true}
                      />
                    </div>
                  </div>
                </div>
              );
            }

            // OPTION 2: TWO RECEIPTS (SPLIT A4 LANDSCAPE)
            const student1 = group[0];
            const student2 = group[1] || null;
            const data1 = student1 ? getStudentVoucherData(student1) : getStudentVoucherData(null);
            const data2 = student2 ? getStudentVoucherData(student2) : getStudentVoucherData(null);

            return (
              <div key={`standalone_wrapper_${pageIdx}`} className="space-y-1">
                <div className="no-print text-xs text-slate-500 font-semibold mb-1 print:hidden flex justify-between bg-slate-200/90 px-3 py-1.5 rounded-lg max-w-[950px] mx-auto border border-slate-300">
                  <span>
                    পাতা {toBengaliNumber(pageIdx + 1)} / {toBengaliNumber(calculatedPageCount)}: বামে {student1?.nameBn} (রোল: {student1 ? toBengaliRoll(student1.roll) : '-'}) & ডানে {student2 ? `${student2.nameBn} (রোল: ${toBengaliRoll(student2.roll)})` : 'খালি স্লিপ'}
                  </span>
                  <span className="text-emerald-700 font-bold">১ পাতায় পাশাপাশি ২টি (Landscape)</span>
                </div>

                <div
                  key={`standalone_land_${pageIdx}`}
                  className="official-voucher-a4-sheet bg-white p-2 sm:p-2.5 shadow-lg max-w-[950px] mx-auto print:shadow-none print:p-0 print:m-0 print:w-full page-break-after"
                  style={{
                    width: '100%',
                    maxWidth: '287mm',
                    boxSizing: 'border-box',
                  }}
                >
                  <div
                    className="relative grid grid-cols-2 gap-4"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '5mm',
                      width: '100%',
                      position: 'relative',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div style={{ width: '100%', boxSizing: 'border-box' }}>
                      <SingleReceiptSlip
                        schoolInfo={schoolInfo}
                        student={student1}
                        data={data1}
                        voucherTitle={customTitle}
                        copyLabel={copyLabel}
                        isBlankAmounts={voucherMode === 'blank_students'}
                        isSingleReceiptFullA4={false}
                      />
                    </div>

                    <div
                      className="hidden print:flex absolute left-1/2 top-0 bottom-0 -translate-x-1/2 flex-col justify-between items-center py-2 z-10 pointer-events-none"
                      style={{ height: '100%' }}
                    >
                      <span className="text-[9px] font-bold text-slate-500 bg-white px-1">✂ কাটার দাগ</span>
                      <div className="w-0 flex-1 border-l-2 border-dashed border-slate-400 my-1" />
                      <span className="text-[9px] font-bold text-slate-500 bg-white px-1">✂</span>
                    </div>

                    <div style={{ width: '100%', boxSizing: 'border-box' }}>
                      <SingleReceiptSlip
                        schoolInfo={schoolInfo}
                        student={student2}
                        data={data2}
                        voucherTitle={customTitle}
                        copyLabel={copyLabel}
                        isBlankAmounts={voucherMode === 'blank_students'}
                        isSingleReceiptFullA4={false}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
