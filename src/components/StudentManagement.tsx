import React, { useState } from 'react';
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
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { Student } from '../types';
import { toBengaliNumber, toBengaliRoll } from '../utils/bengali';

export const StudentManagement: React.FC = () => {
  const {
    students,
    classes,
    addStudent,
    updateStudent,
    deleteStudent,
    bulkImportStudents,
    selectedClassId,
    setSelectedClassId,
    selectedSection,
    setSelectedSection,
  } = useSchool();

  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

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

  // Filter students
  const filtered = students.filter((s) => {
    const matchClass = !selectedClassId || s.classId === selectedClassId;
    const matchSection = !selectedSection || s.section === selectedSection;
    const matchSearch =
      !searchTerm ||
      s.nameBn.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.nameEn && s.nameEn.toLowerCase().includes(searchTerm.toLowerCase())) ||
      String(s.roll).includes(searchTerm);
    return matchClass && matchSection && matchSearch;
  });

  const handleOpenAdd = () => {
    const classStudents = students.filter((s) => s.classId === selectedClassId);
    const nextRoll = classStudents.length > 0 ? Math.max(...classStudents.map((s) => s.roll)) + 1 : 1;
    setFormData({
      nameBn: '',
      nameEn: '',
      roll: nextRoll,
      classId: selectedClassId,
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

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      handleParseBulk(content);
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
    link.download = `students_list_${selectedClassId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Control bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 font-serif flex items-center">
              <Users className="w-5 h-5 mr-2 text-indigo-600" />
              সকল শ্রেণির শিক্ষার্থী তথ্য ও বাল্ক আপলোড
            </h2>
            <p className="text-xs text-slate-500">
              সকল শিক্ষার্থীর তথ্য পরিচালনা ও একসাথে এক্সেল বা সিএসভি থেকে সম্পূর্ণ তথ্য আপলোড করুন।
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 hover:bg-slate-50 text-slate-700 shadow-xs"
            >
              <Download className="w-3.5 h-3.5 mr-1 text-slate-500" />
              তালিকা ডাউনলোড
            </button>
            <button
              onClick={() => setIsBulkModalOpen(true)}
              className="inline-flex items-center px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-xs transition"
            >
              <Upload className="w-3.5 h-3.5 mr-1" />
              পূর্ণাঙ্গ তথ্য বাল্ক আপলোড
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

        {/* Filters and Search */}
        <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3">
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
            <label className="block text-xs font-bold text-slate-700 mb-1">শাখা</label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full text-sm font-medium border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
            >
              <option value="">সকল শাখা</option>
              <option value="ক">ক শাখা</option>
              <option value="খ">খ শাখা</option>
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
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between text-xs font-bold text-slate-600">
          <span>মোট শিক্ষার্থী: {toBengaliNumber(filtered.length)} জন</span>
          <span>শ্রেণি: {classes.find((c) => c.id === selectedClassId)?.nameBn}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 text-xs font-bold border-b border-slate-200 uppercase">
                <th className="py-3 px-3 text-center w-16">রোল</th>
                <th className="py-3 px-3">শিক্ষার্থীর নাম (বাংলা)</th>
                <th className="py-3 px-3">ইংরেজি নাম</th>
                <th className="py-3 px-2 text-center">শাখা</th>
                <th className="py-3 px-3">পিতার নাম</th>
                <th className="py-3 px-3">অভিভাবক ফোন</th>
                <th className="py-3 px-2 text-center">গ্রুপ</th>
                <th className="py-3 px-3 text-center w-24">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    কোন শিক্ষার্থী পাওয়া যায়নি। উপরের &quot;নতুন শিক্ষার্থী যুক্ত করুন&quot; অথবা &quot;বাল্ক আপলোড&quot; বোতাম ব্যবহার করুন।
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

      {/* FULL STUDENT BULK UPLOAD MODAL */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 max-h-[92vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-bold text-slate-900 font-serif flex items-center">
                  <FileSpreadsheet className="w-5 h-5 mr-2 text-amber-600" />
                  সকল শ্রেণির শিক্ষার্থীর পূর্ণাঙ্গ তথ্য বাল্ক আপলোড
                </h3>
                <p className="text-xs text-slate-500">
                  এক্সেল বা সিএসভি ফাইল থেকে এক ক্লিকে সকল শিক্ষার্থীর তথ্য ডাটাবেসে যুক্ত করুন।
                </p>
              </div>
              <button
                onClick={() => setIsBulkModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            {bulkSuccessMsg && (
              <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-lg text-sm font-semibold flex items-center">
                <CheckCircle className="w-5 h-5 mr-2 text-emerald-600" />
                {bulkSuccessMsg}
              </div>
            )}

            {/* Target Class Selection */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">টার্গেট শ্রেণি:</span>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="text-sm font-bold border border-indigo-300 rounded px-3 py-1 bg-white text-indigo-900"
              >
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.nameBn}
                  </option>
                ))}
              </select>
            </div>

            {/* Upload File or Paste Box */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">
                  CSV বা এক্সেল ডাটা পেস্ট করুন (অথবা ফাইল আপলোড করুন):
                </label>
                <button
                  type="button"
                  onClick={loadSampleBulkData}
                  className="text-xs font-bold text-indigo-600 hover:underline"
                >
                  + নমুনা ডাটা লোড করুন
                </button>
              </div>

              <div className="flex items-center space-x-2 pb-2">
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
              </div>

              <textarea
                rows={5}
                placeholder={`রোল, নাম (বাংলা), নাম (ইংরেজি), শাখা, ফোন, পিতার নাম, মাতার নাম, রক্তের গ্রুপ
১, জিসান আহমেদ নীরব, Zisan Ahmed, ক, ০১৭০০-xxxxxx, মোঃ পিতা, মোসাঃ মাতা, B+
২, সুমাইয়া জান্নাত, Sumaiya Jannat, ক, ০১৮০০-xxxxxx, মোঃ পিতা, মোসাঃ মাতা, A+`}
                value={bulkText}
                onChange={(e) => handleParseBulk(e.target.value)}
                className="w-full font-mono text-xs border border-slate-300 rounded-lg p-3 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-slate-500">
                ফরম্যাট: রোল, নাম (বাংলা), নাম (ইংরেজি), শাখা, অভিভাবক ফোন, পিতার নাম, মাতার নাম, রক্তের গ্রুপ
              </p>
            </div>

            {/* Preview of Parsed Data */}
            {bulkPreview.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    আপলোডের জন্য প্রস্তুত: {toBengaliNumber(bulkPreview.length)} জন শিক্ষার্থী
                  </span>
                  <span className="text-xs text-emerald-600 font-semibold flex items-center">
                    <CheckCircle className="w-3.5 h-3.5 mr-1" /> ডাটা যাচাইকৃত
                  </span>
                </div>

                <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0">
                      <tr>
                        <th className="p-2 text-center">রোল</th>
                        <th className="p-2">নাম</th>
                        <th className="p-2">শাখা</th>
                        <th className="p-2">ফোন</th>
                        <th className="p-2">গ্রুপ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {bulkPreview.map((s, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-1.5 text-center font-bold">{toBengaliRoll(s.roll)}</td>
                          <td className="p-1.5 font-medium">{s.nameBn}</td>
                          <td className="p-1.5">{s.section}</td>
                          <td className="p-1.5">{s.guardianPhone || '-'}</td>
                          <td className="p-1.5 text-red-600 font-bold">{s.bloodGroup || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 text-xs font-medium hover:bg-slate-50"
              >
                বাতিল
              </button>
              <button
                type="button"
                disabled={bulkPreview.length === 0}
                onClick={handleExecuteBulkImport}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm disabled:opacity-50 flex items-center"
              >
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                ডাটাবেসে আপলোড করুন ({toBengaliNumber(bulkPreview.length)} জন)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
