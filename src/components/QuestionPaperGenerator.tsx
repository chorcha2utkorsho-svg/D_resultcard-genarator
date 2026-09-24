import React, { useState } from 'react';
import { HelpCircle, Plus, Printer, Trash2, Edit3, BookOpen, Layers, Clock } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { QuestionPaper, QuestionPaperQuestion } from '../types';
import { SchoolLogo } from './SchoolLogo';
import { toBengaliNumber } from '../utils/bengali';

export const QuestionPaperGenerator: React.FC = () => {
  const { schoolInfo, classes, questionPapers, addQuestionPaper, deleteQuestionPaper, selectedClassId, setSelectedClassId } = useSchool();
  const [activePaperId, setActivePaperId] = useState<string>(questionPapers[0]?.id || '');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const activePaper = questionPapers.find((p) => p.id === activePaperId) || questionPapers[0];

  // State for new question paper form
  const [formData, setFormData] = useState({
    title: '২য় সাময়িক পরীক্ষা - ২০২৬',
    classId: selectedClassId,
    subjectName: 'বাংলা',
    timeAllowed: '২ ঘণ্টা ৩০ মিনিট',
    fullMarks: 100,
    generalInstructions: 'দ্রষ্টব্য: সকল প্রশ্নের উত্তর ক্রমানুসারে লিখতে হবে। ডানপাশের সংখ্যা প্রশ্নের পূর্ণমান জ্ঞাপক।',
  });

  const handleCreatePaper = (e: React.FormEvent) => {
    e.preventDefault();
    addQuestionPaper({
      title: formData.title,
      classId: formData.classId,
      subjectId: 'sub_custom',
      subjectName: formData.subjectName,
      academicYear: '২০২৬',
      timeAllowed: formData.timeAllowed,
      fullMarks: formData.fullMarks,
      generalInstructions: formData.generalInstructions,
      sections: [
        {
          sectionTitle: 'ক-বিভাগ (সৃজনশীল / বর্ণনামূলক প্রশ্ন)',
          instructions: 'যেকোনো ৪টি প্রশ্নের উত্তর দাও:',
          questions: [
            {
              id: 'q_cq_1',
              type: 'creative',
              questionText: 'নিচের উদ্দীপকটি পড় এবং সংশ্লিষ্ট প্রশ্নগুলোর উত্তর দাও:',
              marks: 10,
              stimulus: 'গ্রামের মেঠোপথ ধরে হেঁটে যাচ্ছিল রাফি ও তার বন্ধুরা। হঠাৎ তারা দেখল একটি আহত বক রাস্তার পাশে ছটফট করছে। তারা দ্রুত এগিয়ে গিয়ে বকটির ডানা বেঁধে দিল এবং স্থানীয় পশু চিকিৎসালয়ে নিয়ে গেল।',
              subQuestions: [
                { label: 'ক', text: 'পাখিরা আমাদের কী ধরনের উপকার করে?', marks: 1 },
                { label: 'খ', text: 'বকটির অবস্থা দেখে রাফিদের মনোভাব কেমন ছিল?', marks: 2 },
                { label: 'গ', text: 'উদ্দীপকের ঘটনাটি তোমার পাঠ্যবইয়ের কোন গল্পের সাথে সাদৃশ্যপূর্ণ? ব্যাখ্যা কর।', marks: 3 },
                { label: 'ঘ', text: '"জীবপ্রেমই প্রকৃত মনুষ্যত্ব" - রাফিদের কাজের আলোকে বিশ্লেষণ কর।', marks: 4 },
              ],
            },
            {
              id: 'q_cq_2',
              type: 'short',
              questionText: 'সংক্ষেপে উত্তর দাও: (১) বেগম রোকেয়া কোথায় জন্মগ্রহণ করেন? (২) পাখিদের বাসস্থান ধ্বংসের কারণ কী?',
              marks: 5,
            },
          ],
        },
        {
          sectionTitle: 'খ-বিভাগ (ব্যাকরণ ও নির্মিতি)',
          instructions: 'সকল প্রশ্নের উত্তর আবশ্যক:',
          questions: [
            {
              id: 'q_mcq_1',
              type: 'short',
              questionText: 'যুক্তবর্ণ ভেঙে শব্দ ও বাক্য তৈরি কর (যেকোনো ৫টি): ক্ত, ঙ্গ, ত্র, ষ্ণ, ণ্ড।',
              marks: 10,
            },
            {
              id: 'q_essay',
              type: 'broad',
              questionText: 'যেকোনো একটি বিষয়ে প্রবন্ধ রচনা লেখ: (ক) আমাদের প্রিয় বাংলাদেশ (খ) ডিজিটাল শিক্ষা ব্যবস্থা।',
              marks: 15,
            },
          ],
        },
      ],
    });

    setIsCreateModalOpen(false);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Control bar */}
      <div className="no-print bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 font-serif flex items-center">
              <HelpCircle className="w-5 h-5 mr-2 text-indigo-600" />
              প্রশ্নপত্র প্রস্তুতকারক (Question Paper Builder)
            </h2>
            <p className="text-xs text-slate-500">
              অফিসিয়াল স্কুল স্ট্যান্ডার্ড ফরমেটে সাময়িক ও বার্ষিক পরীক্ষার প্রশ্নপত্র তৈরি ও প্রিন্ট করুন।
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center px-3.5 py-2 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-xs transition"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              নতুন প্রশ্নপত্র তৈরি করুন
            </button>
            <button
              onClick={handlePrint}
              disabled={!activePaper}
              className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition disabled:opacity-50"
            >
              <Printer className="w-4 h-4 mr-1.5" />
              প্রশ্নপত্র প্রিন্ট করুন (A4)
            </button>
          </div>
        </div>

        {/* Paper selector list */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-700">সংরক্ষিত প্রশ্নপত্রসমূহ:</span>
          {questionPapers.map((p) => (
            <button
              key={p.id}
              onClick={() => setActivePaperId(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                activePaper?.id === p.id
                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              {p.subjectName} ({classes.find((c) => c.id === p.classId)?.nameBn || 'শ্রেণি'})
            </button>
          ))}
        </div>
      </div>

      {/* QUESTION PAPER PRINTABLE CANVAS */}
      {activePaper ? (
        <div className="printable-area bg-white p-6 sm:p-10 rounded-xl border border-slate-300 shadow-sm max-w-4xl mx-auto text-black">
          {/* Official School Header */}
          <div className="text-center pb-3 border-b-2 border-black mb-4">
            <div className="flex items-center justify-center space-x-3 mb-1">
              <SchoolLogo customLogoUrl={schoolInfo.logoUrl} size={64} />
              <h1 className="text-2xl sm:text-3xl font-bold font-serif">{schoolInfo.name}</h1>
            </div>
            <p className="text-xs">{schoolInfo.address}</p>
            <h2 className="text-lg font-bold font-serif mt-1">{activePaper.title}</h2>

            {/* Exam Meta info */}
            <div className="flex justify-between items-center text-sm font-bold border-y border-black py-1.5 mt-3 px-2">
              <span>
                শ্রেণি: {classes.find((c) => c.id === activePaper.classId)?.nameBn || '৪র্থ শ্রেণি'}
              </span>
              <span>বিষয়: {activePaper.subjectName}</span>
              <span>সময়: {activePaper.timeAllowed}</span>
              <span>পূর্ণমান: {toBengaliNumber(activePaper.fullMarks)}</span>
            </div>
          </div>

          {/* General instructions */}
          {activePaper.generalInstructions && (
            <div className="text-xs italic text-center mb-6 font-serif">
              [{activePaper.generalInstructions}]
            </div>
          )}

          {/* Sections & Questions */}
          <div className="space-y-6">
            {activePaper.sections.map((section, sIdx) => (
              <div key={sIdx} className="space-y-4">
                <div className="text-center">
                  <span className="font-bold text-sm sm:text-base border-b-2 border-black pb-0.5 inline-block font-serif">
                    {section.sectionTitle}
                  </span>
                  {section.instructions && (
                    <div className="text-xs font-semibold mt-1">({section.instructions})</div>
                  )}
                </div>

                <div className="space-y-5">
                  {section.questions.map((q, qIdx) => (
                    <div key={q.id} className="text-sm">
                      <div className="flex items-start justify-between font-medium">
                        <div className="flex-1">
                          <span className="font-bold mr-2">{toBengaliNumber(qIdx + 1)}।</span>
                          <span>{q.questionText}</span>
                        </div>
                        <span className="font-bold text-xs ml-3 whitespace-nowrap">
                          {toBengaliNumber(q.marks)}
                        </span>
                      </div>

                      {/* Stimulus for creative questions */}
                      {q.stimulus && (
                        <div className="my-2 p-3 bg-slate-50 border-l-4 border-black text-xs leading-relaxed italic">
                          &quot;{q.stimulus}&quot;
                        </div>
                      )}

                      {/* Sub-questions (ক, খ, গ, ঘ) */}
                      {q.subQuestions && q.subQuestions.length > 0 && (
                        <div className="space-y-1.5 pl-6 mt-2">
                          {q.subQuestions.map((subQ, subIdx) => (
                            <div key={subIdx} className="flex justify-between items-start text-xs sm:text-sm">
                              <div>
                                <span className="font-bold mr-2">({subQ.label})</span>
                                <span>{subQ.text}</span>
                              </div>
                              <span className="font-bold text-xs ml-2">
                                {toBengaliNumber(subQ.marks)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white p-12 text-center rounded-xl border border-slate-200 text-slate-500">
          কোন প্রশ্নপত্র তৈরি করা নেই।
        </div>
      )}

      {/* CREATE QUESTION PAPER MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 font-serif mb-4 pb-2 border-b border-slate-200">
              নতুন পরীক্ষার প্রশ্নপত্র তৈরি
            </h3>

            <form onSubmit={handleCreatePaper} className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">পরীক্ষার নাম *</label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: ২য় সাময়িক পরীক্ষা - ২০২৬"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">বিষয়ের নাম</label>
                  <input
                    type="text"
                    required
                    placeholder="যেমন: প্রাথমিক গণিত"
                    value={formData.subjectName}
                    onChange={(e) => setFormData({ ...formData, subjectName: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">সময়</label>
                  <input
                    type="text"
                    placeholder="যেমন: ২ ঘণ্টা ৩০ মিনিট"
                    value={formData.timeAllowed}
                    onChange={(e) => setFormData({ ...formData, timeAllowed: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">পূর্ণমান</label>
                  <input
                    type="number"
                    value={formData.fullMarks}
                    onChange={(e) => setFormData({ ...formData, fullMarks: parseInt(e.target.value, 10) || 100 })}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">সাধারণ নির্দেশনা</label>
                <input
                  type="text"
                  value={formData.generalInstructions}
                  onChange={(e) => setFormData({ ...formData, generalInstructions: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-bold"
                >
                  প্রশ্নপত্র তৈরি করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
