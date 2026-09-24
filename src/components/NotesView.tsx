import React, { useState } from 'react';
import { FileText, Plus, Printer, Trash2, Search, BookOpen, User } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { StudyNote } from '../types';
import { SchoolLogo } from './SchoolLogo';

export const NotesView: React.FC = () => {
  const { schoolInfo, classes, notes, addNote, deleteNote, selectedClassId, setSelectedClassId } = useSchool();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeNote, setActiveNote] = useState<StudyNote | null>(notes[0] || null);
  const [printingNote, setPrintingNote] = useState<StudyNote | null>(null);

  const currentClass = classes.find((c) => c.id === selectedClassId) || classes[0];
  const subjects = currentClass?.defaultSubjects || [];

  const [formData, setFormData] = useState({
    classId: selectedClassId,
    subjectId: subjects[0]?.id || '',
    chapter: '',
    title: '',
    content: '',
    authorTeacher: 'সহকারী শিক্ষক',
  });

  const filteredNotes = notes.filter((n) => {
    const matchClass = !selectedClassId || n.classId === selectedClassId;
    const matchSearch =
      !searchTerm ||
      n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.chapter.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.content.toLowerCase().includes(searchTerm.toLowerCase());
    return matchClass && matchSearch;
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    addNote({
      classId: formData.classId,
      subjectId: formData.subjectId,
      chapter: formData.chapter,
      title: formData.title,
      content: formData.content,
      authorTeacher: formData.authorTeacher,
      tags: [classes.find((c) => c.id === formData.classId)?.nameBn || '', formData.chapter],
    });

    setIsAddModalOpen(false);
    setFormData({
      classId: selectedClassId,
      subjectId: subjects[0]?.id || '',
      chapter: '',
      title: '',
      content: '',
      authorTeacher: 'সহকারী শিক্ষক',
    });
  };

  const handlePrint = (note: StudyNote) => {
    setPrintingNote(note);
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
              <FileText className="w-5 h-5 mr-2 text-indigo-600" />
              ক্লাস নোট ও স্টাডি মেটেরিয়ালস
            </h2>
            <p className="text-xs text-slate-500">
              শিক্ষার্থীদের জন্য বিষয়ভিত্তিক পাঠ্য নোট, গুরুত্বপূর্ণ প্রশ্নোত্তর ও লেকচার শিট প্রস্তুত করুন।
            </p>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            নতুন নোট লিখুন
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">শ্রেণি নির্বাচন</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full text-sm font-bold border border-indigo-300 rounded-lg px-2.5 py-1.5 bg-indigo-50/40 text-indigo-900"
            >
              <option value="">সকল শ্রেণি</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.nameBn}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">নোট খুঁজুন</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="শিরোনাম বা অধ্যায় লিখে খুঁজুন..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-sm pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Notes Layout: List on left, details on right */}
      <div className="no-print grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Note cards */}
        <div className="space-y-3">
          {filteredNotes.length === 0 ? (
            <div className="bg-white p-8 text-center rounded-xl border border-slate-200 text-slate-500 text-sm">
              কোন নোট পাওয়া যায়নি।
            </div>
          ) : (
            filteredNotes.map((note) => {
              const cls = classes.find((c) => c.id === note.classId);
              const isSelected = activeNote?.id === note.id;

              return (
                <div
                  key={note.id}
                  onClick={() => setActiveNote(note)}
                  className={`p-4 rounded-xl border cursor-pointer transition ${
                    isSelected
                      ? 'bg-indigo-50/80 border-indigo-400 shadow-sm'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-[11px] font-bold text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded">
                      {cls?.nameBn || 'শ্রেণি'}
                    </span>
                    <span className="text-[11px] text-slate-400">{note.createdAt}</span>
                  </div>
                  <h3 className="font-bold text-slate-900 mt-1.5 font-serif text-sm">
                    {note.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{note.chapter}</p>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Note Reader View */}
        <div className="lg:col-span-2">
          {activeNote ? (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <span className="text-xs font-bold text-indigo-600">
                    {classes.find((c) => c.id === activeNote.classId)?.nameBn} • {activeNote.chapter}
                  </span>
                  <h2 className="text-xl font-bold text-slate-900 font-serif mt-1">
                    {activeNote.title}
                  </h2>
                  {activeNote.authorTeacher && (
                    <div className="text-xs text-slate-500 flex items-center mt-1">
                      <User className="w-3.5 h-3.5 mr-1 text-slate-400" />
                      শিক্ষক: {activeNote.authorTeacher}
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handlePrint(activeNote)}
                    className="inline-flex items-center px-3.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                  >
                    <Printer className="w-3.5 h-3.5 mr-1" /> প্রিন্ট করুন
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('আপনি কি এই নোটটি মুছে ফেলতে চান?')) {
                        deleteNote(activeNote.id);
                        setActiveNote(null);
                      }
                    }}
                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"
                    title="মুছুন"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Note Content */}
              <div className="text-slate-800 leading-relaxed font-sans whitespace-pre-line text-sm bg-slate-50/60 p-4 rounded-xl border border-slate-100">
                {activeNote.content}
              </div>
            </div>
          ) : (
            <div className="bg-white p-12 text-center rounded-xl border border-slate-200 text-slate-500">
              বাম পাশের তালিকা থেকে একটি নোট নির্বাচন করুন অথবা নতুন নোট তৈরি করুন।
            </div>
          )}
        </div>
      </div>

      {/* CREATE NOTE MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 font-serif mb-4 pb-2 border-b border-slate-200">
              নতুন স্টাডি নোট লিখুন
            </h3>

            <form onSubmit={handleCreate} className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">শ্রেণি</label>
                  <select
                    value={formData.classId}
                    onChange={(e) => {
                      const newCls = classes.find((c) => c.id === e.target.value);
                      setFormData({
                        ...formData,
                        classId: e.target.value,
                        subjectId: newCls?.defaultSubjects[0]?.id || '',
                      });
                    }}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  >
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.nameBn}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">অধ্যায় / পরিচ্ছেদ</label>
                  <input
                    type="text"
                    required
                    placeholder="যেমন: অধ্যায় ৭: গুণিতক ও গুণনীয়ক"
                    value={formData.chapter}
                    onChange={(e) => setFormData({ ...formData, chapter: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">নোটের শিরোনাম *</label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: লসাগু ও গসাগু নির্ণয়ের সহজ নিয়ম ও সূত্রাবলী"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">নোটের পূর্ণ বিবরণ *</label>
                <textarea
                  rows={8}
                  required
                  placeholder="এখানে নোটের বিস্তারিত প্রশ্নোত্তর, সংজ্ঞা বা বিশ্লেষণ লিখুন..."
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">শিক্ষকের নাম</label>
                <input
                  type="text"
                  value={formData.authorTeacher}
                  onChange={(e) => setFormData({ ...formData, authorTeacher: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-bold"
                >
                  সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINTABLE NOTE VIEW */}
      {printingNote && (
        <div className="printable-area hidden print:block bg-white p-8 text-black">
          <div className="text-center pb-3 border-b-2 border-black mb-4 flex items-center justify-between">
            <SchoolLogo customLogoUrl={schoolInfo.logoUrl} size={80} />
            <div>
              <h1 className="text-2xl font-bold font-serif">{schoolInfo.name}</h1>
              <p className="text-xs">{schoolInfo.address}</p>
              <h2 className="text-base font-bold font-serif mt-1">অফিসিয়াল স্টাডি নোট</h2>
            </div>
            <div className="w-16"></div>
          </div>

          <div className="border border-black p-3 mb-4 bg-slate-50 flex justify-between text-sm font-bold">
            <span>{printingNote.title}</span>
            <span>
              শ্রেণি: {classes.find((c) => c.id === printingNote.classId)?.nameBn} ({printingNote.chapter})
            </span>
          </div>

          <div className="text-sm leading-relaxed whitespace-pre-line border border-black p-4 min-h-[500px]">
            {printingNote.content}
          </div>

          <div className="pt-12 flex justify-between text-xs font-bold px-8">
            <span>প্রস্তুতকারী: {printingNote.authorTeacher}</span>
            <span>ডি-লিকন মডেল একাডেমী</span>
          </div>
        </div>
      )}
    </div>
  );
};
