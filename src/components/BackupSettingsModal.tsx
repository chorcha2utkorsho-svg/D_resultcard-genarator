import React, { useState } from 'react';
import {
  Settings,
  Upload,
  Download,
  ShieldCheck,
  Image,
  PenTool,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  Layers,
  Plus,
  Trash2,
  BookOpen,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { SchoolLogo } from './SchoolLogo';
import { Subject } from '../types';
import { toBengaliNumber } from '../utils/bengali';

interface BackupSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BackupSettingsModal: React.FC<BackupSettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    schoolInfo,
    updateSchoolInfo,
    classes,
    updateClassSubjects,
    exportDatabaseBackup,
    importDatabaseBackup,
    resetToDefaultData,
  } = useSchool();

  const [activeTab, setActiveTab] = useState<'profile' | 'subjects' | 'backup'>('profile');
  const [infoForm, setInfoForm] = useState({ ...schoolInfo });
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[3]?.id || classes[0]?.id || '');
  const [restoreStatus, setRestoreStatus] = useState<{ success: boolean; message: string } | null>(null);

  // New subject form for active class
  const [newSubName, setNewSubName] = useState('');
  const [newSubMarks, setNewSubMarks] = useState<number>(100);

  if (!isOpen) return null;

  const currentClass = classes.find((c) => c.id === selectedClassId) || classes[0];

  const handleSaveInfo = (e: React.FormEvent) => {
    e.preventDefault();
    updateSchoolInfo(infoForm);
    alert('স্কুলের তথ্য সফলভাবে সংরক্ষিত হয়েছে!');
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      setInfoForm((prev) => ({ ...prev, logoUrl: dataUrl }));
      updateSchoolInfo({ logoUrl: dataUrl });
    };
    reader.readAsDataURL(file);
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      setInfoForm((prev) => ({ ...prev, principalSignatureUrl: dataUrl }));
      updateSchoolInfo({ principalSignatureUrl: dataUrl });
    };
    reader.readAsDataURL(file);
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      const res = importDatabaseBackup(content);
      setRestoreStatus(res);
      setTimeout(() => setRestoreStatus(null), 3000);
    };
    reader.readAsText(file);
  };

  const handleAddSubjectToClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubName.trim()) return;

    const newSub: Subject = {
      id: `sub_${currentClass.id}_${Date.now()}`,
      nameBn: newSubName.trim(),
      classId: currentClass.id,
      fullMarks: newSubMarks || 100,
      hasMonthlyExam: true,
    };

    updateClassSubjects(currentClass.id, [...currentClass.defaultSubjects, newSub]);
    setNewSubName('');
    setNewSubMarks(100);
  };

  const handleDeleteSubject = (subjectId: string) => {
    if (confirm('আপনি কি এই বিষয়টি শ্রেণি থেকে মুছে ফেলতে চান?')) {
      const filtered = currentClass.defaultSubjects.filter((s) => s.id !== subjectId);
      updateClassSubjects(currentClass.id, filtered);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 max-h-[92vh] overflow-y-auto space-y-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div>
            <h3 className="text-xl font-bold text-slate-900 font-serif flex items-center">
              <Settings className="w-5 h-5 mr-2 text-indigo-600" />
              সেটিংস, লোগো, স্বাক্ষর ও ডাটাবেস ব্যাকআপ
            </h3>
            <p className="text-xs text-slate-500">
              ডি-লিকন মডেল একাডেমীর প্রশাসনিক তথ্য, লোগো, প্রিন্সিপালের স্বাক্ষর ও ব্যাকআপ ম্যানেজমেন্ট।
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 space-x-2">
          <button
            onClick={() => setActiveTab('profile')}
            className={`pb-2 text-xs font-bold transition border-b-2 ${
              activeTab === 'profile'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            স্কুল তথ্য, লোগো ও স্বাক্ষর
          </button>
          <button
            onClick={() => setActiveTab('subjects')}
            className={`pb-2 text-xs font-bold transition border-b-2 ${
              activeTab === 'subjects'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            শ্রেণিভিত্তিক বিষয় কনফিগারেশন
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`pb-2 text-xs font-bold transition border-b-2 ${
              activeTab === 'backup'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            ডাটাবেস ব্যাকআপ ও নিরাপত্তা
          </button>
        </div>

        {/* TAB 1: SCHOOL INFO, LOGO & PRINCIPAL SIGNATURE */}
        {activeTab === 'profile' && (
          <form onSubmit={handleSaveInfo} className="space-y-4 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  স্কুলের নাম (বাংলায়)
                </label>
                <input
                  type="text"
                  value={infoForm.name}
                  onChange={(e) => setInfoForm({ ...infoForm, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">স্থাপিত সাল</label>
                <input
                  type="text"
                  value={infoForm.established}
                  onChange={(e) => setInfoForm({ ...infoForm, established: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">ঠিকানা</label>
                <input
                  type="text"
                  value={infoForm.address}
                  onChange={(e) => setInfoForm({ ...infoForm, address: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">মোবাইল নম্বর</label>
                <input
                  type="text"
                  value={infoForm.phone}
                  onChange={(e) => setInfoForm({ ...infoForm, phone: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ই-মেইল</label>
                <input
                  type="email"
                  value={infoForm.email}
                  onChange={(e) => setInfoForm({ ...infoForm, email: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>
            </div>

            {/* Logo & Signature Upload Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Logo Upload */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex flex-col items-center text-center space-y-2">
                <span className="text-xs font-bold text-slate-800 flex items-center">
                  <Image className="w-3.5 h-3.5 mr-1 text-indigo-600" /> স্কুল লোগো
                </span>
                <div className="p-2 bg-white rounded-full shadow-sm border border-slate-200">
                  <SchoolLogo customLogoUrl={infoForm.logoUrl} size={64} />
                </div>
                <div className="text-[11px] text-slate-500">
                  ডিফল্ট অফিসিয়াল ভেক্টর লোগো সক্রিয়। চাইলে নতুন ছবি আপলোড করতে পারেন।
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700"
                />
                {infoForm.logoUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setInfoForm((prev) => ({ ...prev, logoUrl: undefined }));
                      updateSchoolInfo({ logoUrl: undefined });
                    }}
                    className="text-[11px] text-rose-600 hover:underline"
                  >
                    ডিফল্ট লোগোতে ফিরিয়ে নিন
                  </button>
                )}
              </div>

              {/* Principal Signature Upload */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex flex-col items-center text-center space-y-2">
                <span className="text-xs font-bold text-slate-800 flex items-center">
                  <PenTool className="w-3.5 h-3.5 mr-1 text-indigo-600" /> প্রধান শিক্ষকের স্বাক্ষর
                </span>
                <div className="h-16 w-36 border border-dashed border-slate-300 rounded-lg bg-white flex items-center justify-center p-1">
                  {infoForm.principalSignatureUrl ? (
                    <img
                      src={infoForm.principalSignatureUrl}
                      alt="Signature"
                      className="max-h-14 object-contain"
                    />
                  ) : (
                    <span className="text-xs text-slate-400">স্বাক্ষর নেই</span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500">
                  স্বাক্ষরের স্বচ্ছ ব্যাকগ্রাউন্ড (PNG) ছবি রেজাল্ট কার্ডে প্রিন্ট হবে।
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleSignatureUpload}
                  className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700"
                />
                {infoForm.principalSignatureUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setInfoForm((prev) => ({ ...prev, principalSignatureUrl: undefined }));
                      updateSchoolInfo({ principalSignatureUrl: undefined });
                    }}
                    className="text-[11px] text-rose-600 hover:underline"
                  >
                    স্বাক্ষর মুছে ফেলুন
                  </button>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-sm"
              >
                স্কুলের তথ্য সংরক্ষণ করুন
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: SUBJECTS CONFIGURATION PER CLASS */}
        {activeTab === 'subjects' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-700">শ্রেণি নির্বাচন:</span>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="text-sm font-bold border border-indigo-300 rounded-lg px-3 py-1.5 bg-white text-indigo-950"
              >
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.nameBn}
                  </option>
                ))}
              </select>
            </div>

            {/* List of current subjects for this class */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                <span>
                  {currentClass.nameBn} এর বিষয়সমূহ (মোট{' '}
                  {toBengaliNumber(currentClass.defaultSubjects.length)}টি):
                </span>
                <span>
                  সর্বমোট নম্বর:{' '}
                  {toBengaliNumber(
                    currentClass.defaultSubjects.reduce((sum, s) => sum + s.fullMarks, 0)
                  )}
                </span>
              </div>

              <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                {currentClass.defaultSubjects.map((sub, idx) => (
                  <div
                    key={sub.id}
                    className="p-2.5 flex items-center justify-between hover:bg-slate-50 text-sm"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="w-5 text-center text-xs text-slate-400 font-bold">
                        {toBengaliNumber(idx + 1)}
                      </span>
                      <span className="font-semibold text-slate-800">{sub.nameBn}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        পূর্ণমান: {toBengaliNumber(sub.fullMarks)}
                      </span>
                      <button
                        onClick={() => handleDeleteSubject(sub.id)}
                        className="text-rose-500 hover:text-rose-700 p-1"
                        title="বিষয় মুছুন"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Add new subject form */}
            <form
              onSubmit={handleAddSubjectToClass}
              className="bg-indigo-50/50 border border-indigo-200 rounded-xl p-3 flex flex-wrap items-end gap-3"
            >
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs font-bold text-indigo-900 mb-1">
                  নতুন বিষয়ের নাম (বাংলায়)
                </label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: কৃষিশিক্ষা"
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  className="w-full text-sm border border-indigo-300 rounded-lg p-1.5 bg-white"
                />
              </div>

              <div className="w-24">
                <label className="block text-xs font-bold text-indigo-900 mb-1">পূর্ণমান</label>
                <input
                  type="number"
                  required
                  value={newSubMarks}
                  onChange={(e) => setNewSubMarks(parseInt(e.target.value, 10) || 100)}
                  className="w-full text-sm border border-indigo-300 rounded-lg p-1.5 bg-white font-bold text-center"
                />
              </div>

              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> বিষয় যুক্ত করুন
              </button>
            </form>
          </div>
        )}

        {/* TAB 3: BACKUP AND RESTORE */}
        {activeTab === 'backup' && (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start space-x-3">
              <ShieldCheck className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-emerald-950 text-sm">
                  সুরক্ষিত ও নির্ভরযোগ্য ডাটাবেস
                </h4>
                <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
                  আপনার সকল শিক্ষার্থীর তথ্য, মার্ক এন্ট্রি, সিলেবাস ও প্রশ্নপত্র স্বয়ংক্রিয়ভাবে সংরক্ষিত থাকে। নিয়মিত ব্যাকআপ ফাইল ডাউনলোড করে আপনার পেনড্রাইভ, গুগল ড্রাইভ অথবা কম্পিউটারে সংরক্ষণ করুন।
                </p>
              </div>
            </div>

            {restoreStatus && (
              <div
                className={`p-3 rounded-lg text-xs font-semibold flex items-center ${
                  restoreStatus.success
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-rose-100 text-rose-800 border border-rose-300'
                }`}
              >
                {restoreStatus.success ? (
                  <CheckCircle className="w-4 h-4 mr-1.5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 mr-1.5 text-rose-600" />
                )}
                {restoreStatus.message}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Export Backup Card */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50">
                <h4 className="font-bold text-slate-900 text-sm flex items-center">
                  <Download className="w-4 h-4 mr-1.5 text-emerald-600" /> ডাটাবেস ব্যাকআপ ডাউনলোড
                </h4>
                <p className="text-xs text-slate-600">
                  এক ক্লিকে সকল শিক্ষার্থী, পরীক্ষার নম্বর ও কনফিগারেশন JSON ফাইল হিসেবে ডাউনলোড করুন।
                </p>
                <button
                  type="button"
                  onClick={exportDatabaseBackup}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
                >
                  ব্যাকআপ ফাইল ডাউনলোড করুন (.json)
                </button>
              </div>

              {/* Import Restore Card */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50">
                <h4 className="font-bold text-slate-900 text-sm flex items-center">
                  <Upload className="w-4 h-4 mr-1.5 text-indigo-600" /> ডাটাবেস রিস্টোর
                </h4>
                <p className="text-xs text-slate-600">
                  পূর্বে সেভ করা ব্যাকআপ JSON ফাইল সিলেক্ট করে ডাটা রিস্টোর করুন।
                </p>
                <label className="block w-full text-center py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold cursor-pointer shadow-xs transition">
                  ব্যাকআপ ফাইল আপলোড করুন
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleRestoreFile}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Reset data */}
            <div className="pt-4 border-t border-slate-200 flex justify-between items-center text-xs">
              <span className="text-slate-500">প্রয়োজনে ডেমো ডাটাবেসে রিসেট করুন:</span>
              <button
                type="button"
                onClick={() => {
                  if (confirm('আপনি কি নিশ্চিত যে সকল ডাটা রিসেট করে ডিফল্ট অবস্থায় ফিরিয়ে নিতে চান?')) {
                    resetToDefaultData();
                    alert('ডাটা সফলভাবে রিসেট করা হয়েছে!');
                  }
                }}
                className="text-rose-600 hover:underline flex items-center font-semibold"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                ফ্যাক্টরি রিসেট
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
