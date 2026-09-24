import React, { useState } from 'react';
import { BookOpen, Plus, Printer, Trash2, Calendar, FileText, CheckCircle } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { SyllabusItem } from '../types';
import { SchoolLogo } from './SchoolLogo';
import { toBengaliNumber } from '../utils/bengali';

export const SyllabusView: React.FC = () => {
  const { schoolInfo, classes, examTerms, syllabi, addSyllabus, deleteSyllabus, selectedClassId, setSelectedClassId } = useSchool();
  const [selectedTermId, setSelectedTermId] = useState<string>('term_2');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [printingSyllabus, setPrintingSyllabus] = useState<SyllabusItem | null>(null);

  const currentClass = classes.find((c) => c.id === selectedClassId) || classes[0];
  const subjects = currentClass?.defaultSubjects || [];

  const [formData, setFormData] = useState({
    classId: selectedClassId,
    subjectId: subjects[0]?.id || '',
    examId: 'term_2',
    title: '',
    chaptersText: '',
    description: '',
    referenceBooks: '',
    marksDistribution: '',
  });

  const filteredSyllabi = syllabi.filter(
    (s) => (!selectedClassId || s.classId === selectedClassId) && (!selectedTermId || s.examId === selectedTermId)
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    const chapters = formData.chaptersText
      .split('\n')
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    addSyllabus({
      classId: formData.classId,
      subjectId: formData.subjectId,
      examId: formData.examId,
      title: formData.title,
      chapters,
      description: formData.description,
      referenceBooks: formData.referenceBooks,
      marksDistribution: formData.marksDistribution,
    });

    setIsCreateOpen(false);
    setFormData({
      classId: selectedClassId,
      subjectId: subjects[0]?.id || '',
      examId: 'term_2',
      title: '',
      chaptersText: '',
      description: '',
      referenceBooks: '',
      marksDistribution: '',
    });
  };

  const handlePrint = (item: SyllabusItem) => {
    setPrintingSyllabus(item);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  return (
    <div className="space-y-6">
      {/* Control bar */}
      <div className="no-print bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 font-serif flex items-center">
              <BookOpen className="w-5 h-5 mr-2 text-indigo-600" />
              সিলেবাস প্রণয়ন ও ব্যবস্থাপনা
            </h2>
            <p className="text-xs text-slate-500">
              সকল শ্রেণি ও বিষয়ের সাময়িক ও বার্ষিক পরীক্ষার সিলেবাস তৈরি, সম্পাদন ও প্রিন্ট করুন।
            </p>
          </div>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            নতুন সিলেবাস তৈরি করুন
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">শ্রেণি নির্বাচন</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full text-sm font-bold border border-indigo-300 rounded-lg px-2.5 py-1.5 bg-indigo-50/40 text-indigo-900"
            >
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.nameBn}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">পরীক্ষা</label>
            <select
              value={selectedTermId}
              onChange={(e) => setSelectedTermId(e.target.value)}
              className="w-full text-sm font-medium border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
            >
              <option value="">সকল পরীক্ষা</option>
              {examTerms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nameBn}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Syllabus Cards List */}
      <div className="no-print grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredSyllabi.length === 0 ? (
          <div className="col-span-2 bg-white p-8 text-center rounded-xl border border-slate-200 text-slate-500">
            এই শ্রেণির জন্য কোনো সিলেবাস পাওয়া যায়নি। নতুন সিলেবাস যুক্ত করতে উপরের বোতামটি ব্যবহার করুন।
          </div>
        ) : (
          filteredSyllabi.map((item) => {
            const cls = classes.find((c) => c.id === item.classId);
            const sub = cls?.defaultSubjects.find((s) => s.id === item.subjectId);
            const term = examTerms.find((t) => t.id === item.examId);

            return (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-100 text-indigo-800">
                      {cls?.nameBn} • {term?.nameBn}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 mt-1 font-serif">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      বিষয়: {sub?.nameBn || 'সাধারণ বিষয়'} (পূর্ণমান: {toBengaliNumber(sub?.fullMarks || 100)})
                    </p>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handlePrint(item)}
                      className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded"
                      title="সিলেবাস প্রিন্ট করুন"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('আপনি কি এই সিলেবাসটি মুছে ফেলতে চান?')) {
                          deleteSyllabus(item.id);
                        }
                      }}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded"
                      title="মুছুন"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Chapters list */}
                {item.chapters.length > 0 && (
                  <div>
                    <div className="text-xs font-bold text-slate-700 mb-1">অধ্যায় / পাঠসমূহ:</div>
                    <ul className="text-xs text-slate-600 space-y-0.5 list-disc list-inside bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      {item.chapters.map((ch, idx) => (
                        <li key={idx} className="truncate">
                          {ch}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {item.description && (
                  <p className="text-xs text-slate-600 line-clamp-2">{item.description}</p>
                )}

                {item.marksDistribution && (
                  <div className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded">
                    মানবণ্টন: {item.marksDistribution}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* CREATE SYLLABUS MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 font-serif mb-4 pb-2 border-b border-slate-200">
              নতুন সিলেবাস তৈরি করুন
            </h3>

            <form onSubmit={handleCreate} className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">শ্রেণি</label>
                  <select
                    value={formData.classId}
                    onChange={(e) => {
                      const newClassId = e.target.value;
                      const newCls = classes.find((c) => c.id === newClassId);
                      setFormData({
                        ...formData,
                        classId: newClassId,
                        subjectId: newCls?.defaultSubjects[0]?.id || '',
                      });
                    }}
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">পরীক্ষা</label>
                  <select
                    value={formData.examId}
                    onChange={(e) => setFormData({ ...formData, examId: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  >
                    {examTerms.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nameBn}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">বিষয়</label>
                <select
                  value={formData.subjectId}
                  onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2"
                >
                  {classes
                    .find((c) => c.id === formData.classId)
                    ?.defaultSubjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nameBn} ({toBengaliNumber(s.fullMarks)} নম্বর)
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">সিলেবাসের শিরোনাম *</label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: বাংলা ২য় সাময়িক সিলেবাস ২০২৬"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  অধ্যায় / পাঠসমূহ (প্রতি লাইনে একটি করে)
                </label>
                <textarea
                  rows={3}
                  placeholder={`অধ্যায় ১: পাখিপ্রেমী\nঅধ্যায় ২: হাত ধুয়ে নাও\nব্যাকরণ: পদ প্রকরণ`}
                  value={formData.chaptersText}
                  onChange={(e) => setFormData({ ...formData, chaptersText: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">মানবণ্টন</label>
                <input
                  type="text"
                  placeholder="যেমন: রচনামূলক ৬০, বহুনির্বাচনী ২০, মাসিক ২০ = মোট ১০০"
                  value={formData.marksDistribution}
                  onChange={(e) => setFormData({ ...formData, marksDistribution: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">পাঠ্যবই ও বিবরণ</label>
                <textarea
                  rows={2}
                  placeholder="পাঠ্যপুস্তকের নাম ও বিশেষ নির্দেশনা..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-bold"
                >
                  সিলেবাস তৈরি করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINTABLE SYLLABUS SHEET (Active during print) */}
      {printingSyllabus && (
        <div className="printable-area hidden print:block bg-white p-6 text-black">
          <div className="text-center pb-3 border-b-2 border-black mb-4 flex items-center justify-between">
            <SchoolLogo customLogoUrl={schoolInfo.logoUrl} size={80} />
            <div>
              <h1 className="text-2xl font-bold font-serif">{schoolInfo.name}</h1>
              <p className="text-xs">{schoolInfo.address}</p>
              <h2 className="text-lg font-bold font-serif mt-1">অফিসিয়াল সিলেবাস ২০২৬</h2>
            </div>
            <div className="w-16"></div>
          </div>

          <div className="space-y-4">
            <div className="border border-black p-3 bg-slate-50 font-bold text-sm flex justify-between">
              <span>{printingSyllabus.title}</span>
              <span>
                শ্রেণি: {classes.find((c) => c.id === printingSyllabus.classId)?.nameBn}
              </span>
            </div>

            <div className="border border-black p-4">
              <h4 className="font-bold border-b border-black pb-1 mb-2">নির্ধারিত অধ্যায় ও পাঠসমূহ:</h4>
              <ul className="list-decimal list-inside space-y-1 text-sm">
                {printingSyllabus.chapters.map((ch, idx) => (
                  <li key={idx}>{ch}</li>
                ))}
              </ul>
            </div>

            {printingSyllabus.marksDistribution && (
              <div className="border border-black p-3">
                <h4 className="font-bold mb-1 text-sm">পরীক্ষার নম্বর বণ্টন:</h4>
                <p className="text-sm">{printingSyllabus.marksDistribution}</p>
              </div>
            )}

            {printingSyllabus.description && (
              <div className="border border-black p-3 text-sm">
                <h4 className="font-bold mb-1">বিশেষ নির্দেশনা:</h4>
                <p>{printingSyllabus.description}</p>
              </div>
            )}

            <div className="pt-20 flex justify-between text-xs font-bold text-center px-8">
              <div>
                <div className="w-36 border-b border-dotted border-black mb-1"></div>
                <span>বিষয় শিক্ষক</span>
              </div>
              <div>
                <div className="w-36 border-b border-dotted border-black mb-1"></div>
                <span>প্রধান শিক্ষক</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
