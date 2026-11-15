import React, { useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  File,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Library,
  Link2,
  Plus,
  Presentation,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { LibraryCategory, LibraryFileType, LibraryMaterial } from '../types';
import { formatBengaliDate, toBengaliNumber } from '../utils/bengali';

interface DigitalLibraryViewProps {
  mode: 'manage' | 'student';
  defaultClassId?: string;
  uploaderName?: string;
  uploaderRole?: 'official' | 'employee';
  embedded?: boolean;
}

const LIBRARY_CATEGORIES: { id: LibraryCategory; label: string }[] = [
  { id: 'ebook', label: 'পাঠ্যবই ও ই-বুক' },
  { id: 'pdf_lecture', label: 'পিডিএফ লেকচার শিট' },
  { id: 'notes', label: 'অধ্যায়ভিত্তিক নোট' },
  { id: 'question_bank', label: 'প্রশ্নব্যাংক ও মডেল টেস্ট' },
  { id: 'guide', label: 'সহায়ক গাইড' },
];

const getCategoryLabel = (cat: LibraryCategory): string =>
  LIBRARY_CATEGORIES.find((c) => c.id === cat)?.label || 'অন্যান্য';

const formatFileSizeBn = (bytes: number): string => {
  if (!bytes || bytes <= 0) return 'লিংক';
  if (bytes < 1024) return `${toBengaliNumber(bytes)} বাইট`;
  if (bytes < 1024 * 1024) {
    return `${toBengaliNumber((bytes / 1024).toFixed(1))} KB`;
  }
  return `${toBengaliNumber((bytes / (1024 * 1024)).toFixed(2))} MB`;
};

const detectFileTypeFromNameAndMime = (fileName: string, mimeType: string): LibraryFileType => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf' || mimeType.includes('pdf')) return 'pdf';
  if (['epub', 'mobi', 'azw3', 'fb2'].includes(ext) || mimeType.includes('epub')) return 'ebook';
  if (['ppt', 'pptx', 'odp'].includes(ext) || mimeType.includes('presentation')) return 'presentation';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext) || mimeType.startsWith('image/')) return 'image';
  return 'document';
};

const getFileTypeMeta = (fileType: LibraryFileType, fileName: string) => {
  const ext = fileName.split('.').pop()?.toUpperCase() || '';
  switch (fileType) {
    case 'pdf':
      return { icon: FileText, label: 'PDF', iconWrap: 'bg-rose-50 text-rose-700 border-rose-200' };
    case 'ebook':
      return { icon: BookOpen, label: ext || 'E-BOOK', iconWrap: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'presentation':
      return { icon: Presentation, label: ext || 'SLIDES', iconWrap: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'image':
      return { icon: ImageIcon, label: ext || 'IMAGE', iconWrap: 'bg-sky-50 text-sky-700 border-sky-200' };
    case 'link':
      return { icon: Link2, label: 'WEB LINK', iconWrap: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    default:
      if (['XLS', 'XLSX', 'CSV'].includes(ext)) {
        return { icon: FileSpreadsheet, label: ext, iconWrap: 'bg-teal-50 text-teal-700 border-teal-200' };
      }
      return { icon: File, label: ext || 'DOC', iconWrap: 'bg-slate-100 text-slate-700 border-slate-200' };
  }
};

export const DigitalLibraryView: React.FC<DigitalLibraryViewProps> = ({
  mode,
  defaultClassId,
  uploaderName,
  uploaderRole = 'employee',
  embedded = false,
}) => {
  const {
    classes,
    selectedYear,
    libraryMaterials,
    uploadLibraryMaterial,
    updateLibraryMaterial,
    deleteLibraryMaterial,
    trackLibraryDownload,
  } = useSchool();

  const canManage = mode === 'manage';

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<'all' | LibraryCategory>('all');
  const [classFilter, setClassFilter] = useState<string>(
    mode === 'student' && defaultClassId ? `student_scope:${defaultClassId}` : 'all'
  );
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Upload / Edit Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [editingMaterial, setEditingMaterial] = useState<LibraryMaterial | null>(null);
  const [sourceMode, setSourceMode] = useState<'file' | 'link'>('file');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [formTitle, setFormTitle] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formCategory, setFormCategory] = useState<LibraryCategory>('pdf_lecture');
  const [formClassId, setFormClassId] = useState<string>(defaultClassId || classes[0]?.id || 'all');
  const [formSubjectId, setFormSubjectId] = useState<string>('');
  const [formCustomSubject, setFormCustomSubject] = useState<string>('');
  const [formChapter, setFormChapter] = useState<string>('');
  const [formUploadedBy, setFormUploadedBy] = useState<string>(uploaderName || 'শ্রেণি শিক্ষক');
  const [formExternalUrl, setFormExternalUrl] = useState<string>('');

  const [pickedFile, setPickedFile] = useState<{
    fileName: string;
    mimeType: string;
    fileSizeBytes: number;
    fileType: LibraryFileType;
    fileDataUrl: string;
  } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [previewMaterial, setPreviewMaterial] = useState<LibraryMaterial | null>(null);

  const classSubjects = useMemo(() => {
    if (formClassId === 'all') {
      const seen = new Map<string, string>();
      for (const cls of classes) {
        for (const sub of cls.defaultSubjects) {
          if (!seen.has(sub.nameBn)) {
            seen.set(sub.nameBn, sub.id);
          }
        }
      }
      return Array.from(seen.entries()).map(([nameBn, id]) => ({ id, nameBn }));
    }
    const cls = classes.find((c) => c.id === formClassId);
    return (cls?.defaultSubjects || []).map((s) => ({ id: s.id, nameBn: s.nameBn }));
  }, [classes, formClassId]);

  const availableSubjectFilters = useMemo(() => {
    const names = new Set<string>();
    for (const item of libraryMaterials) {
      if (item.subjectNameBn?.trim()) {
        names.add(item.subjectNameBn.trim());
      }
    }
    return Array.from(names).sort();
  }, [libraryMaterials]);

  const filteredMaterials = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return libraryMaterials.filter((item) => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;

      if (classFilter.startsWith('student_scope:')) {
        const targetClass = classFilter.replace('student_scope:', '');
        if (item.classId !== 'all' && item.classId !== targetClass) return false;
      } else if (classFilter !== 'all') {
        if (item.classId !== classFilter && item.classId !== 'all') return false;
      }

      if (subjectFilter !== 'all') {
        if ((item.subjectNameBn || '').trim() !== subjectFilter) return false;
      }

      if (q) {
        const hay = `${item.title} ${item.description || ''} ${item.subjectNameBn || ''} ${item.chapter || ''} ${item.uploadedBy} ${item.fileName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [libraryMaterials, selectedCategory, classFilter, subjectFilter, searchQuery]);

  const totalDownloads = useMemo(
    () => libraryMaterials.reduce((sum, m) => sum + (Number(m.downloadsCount) || 0), 0),
    [libraryMaterials]
  );

  const openCreateModal = () => {
    setEditingMaterial(null);
    setSourceMode('file');
    setFormTitle('');
    setFormDescription('');
    setFormCategory('pdf_lecture');
    setFormClassId(defaultClassId || 'all');
    setFormSubjectId('');
    setFormCustomSubject('');
    setFormChapter('');
    setFormUploadedBy(uploaderName || 'শ্রেণি শিক্ষক');
    setFormExternalUrl('');
    setPickedFile(null);
    setFormError(null);
    setIsUploadModalOpen(true);
  };

  const openEditModal = (material: LibraryMaterial) => {
    setEditingMaterial(material);
    setSourceMode(material.isExternalUrl ? 'link' : 'file');
    setFormTitle(material.title);
    setFormDescription(material.description || '');
    setFormCategory(material.category);
    setFormClassId(material.classId || 'all');
    setFormSubjectId(material.subjectId || '');
    setFormCustomSubject(material.subjectNameBn || '');
    setFormChapter(material.chapter || '');
    setFormUploadedBy(material.uploadedBy);
    setFormExternalUrl(material.isExternalUrl ? material.fileUrl : '');
    setPickedFile(null);
    setFormError(null);
    setIsUploadModalOpen(true);
  };

  const handleFileChosen = (file: File) => {
    setFormError(null);
    if (file.size > 40 * 1024 * 1024) {
      setFormError('ফাইলটি সর্বোচ্চ ৪০ মেগাবাইটের মধ্যে হতে হবে।');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) {
        setFormError('ফাইলটি পড়া সম্ভব হয়নি। পুনরায় চেষ্টা করুন।');
        return;
      }
      const mimeType = file.type || 'application/octet-stream';
      const detectedType = detectFileTypeFromNameAndMime(file.name, mimeType);
      setPickedFile({
        fileName: file.name,
        mimeType,
        fileSizeBytes: file.size,
        fileType: detectedType,
        fileDataUrl: dataUrl,
      });

      if (!formTitle.trim()) {
        const cleanTitle = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
        setFormTitle(cleanTitle);
      }
      if (detectedType === 'ebook') {
        setFormCategory('ebook');
      } else if (detectedType === 'pdf') {
        setFormCategory('pdf_lecture');
      }
    };
    reader.onerror = () => {
      setFormError('ফাইল লোড করতে ত্রুটি হয়েছে।');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formTitle.trim()) {
      setFormError('বই বা মেটেরিয়ালের শিরোনাম লিখুন।');
      return;
    }

    const chosenSub = classSubjects.find((s) => s.id === formSubjectId);
    const resolvedSubjectName = chosenSub?.nameBn || formCustomSubject.trim();

    setIsSubmitting(true);
    try {
      if (editingMaterial) {
        await updateLibraryMaterial(editingMaterial.id, {
          title: formTitle.trim(),
          description: formDescription.trim(),
          category: formCategory,
          classId: formClassId,
          subjectId: formSubjectId,
          subjectNameBn: resolvedSubjectName,
          chapter: formChapter.trim(),
          academicYear: selectedYear || '২০২৬',
        });
        setFeedbackBanner(`✓ "${formTitle.trim()}" তথ্য হালনাগাদ হয়েছে।`);
        setIsUploadModalOpen(false);
      } else {
        if (sourceMode === 'file' && !pickedFile) {
          setFormError('অনুগ্রহ করে একটি পিডিএফ, ই-বুক বা ডকুমেন্ট ফাইল নির্বাচন করুন।');
          setIsSubmitting(false);
          return;
        }
        if (sourceMode === 'link' && !/^https?:\/\//i.test(formExternalUrl.trim())) {
          setFormError('সঠিক http:// বা https:// লিংক প্রদান করুন।');
          setIsSubmitting(false);
          return;
        }

        const res = await uploadLibraryMaterial({
          title: formTitle.trim(),
          description: formDescription.trim(),
          category: formCategory,
          fileType: sourceMode === 'link' ? 'link' : pickedFile!.fileType,
          classId: formClassId,
          subjectId: formSubjectId,
          subjectNameBn: resolvedSubjectName,
          chapter: formChapter.trim(),
          fileName: sourceMode === 'link' ? `${formTitle.trim().slice(0, 40)}.url` : pickedFile!.fileName,
          mimeType: sourceMode === 'link' ? 'text/html' : pickedFile!.mimeType,
          fileSizeBytes: sourceMode === 'link' ? 0 : pickedFile!.fileSizeBytes,
          fileDataUrl: sourceMode === 'file' ? pickedFile!.fileDataUrl : undefined,
          externalUrl: sourceMode === 'link' ? formExternalUrl.trim() : undefined,
          uploadedBy: formUploadedBy.trim() || uploaderName || 'শিক্ষক',
          uploadedByRole: uploaderRole,
          academicYear: selectedYear || '২০২৬',
        });

        if (!res.success) {
          setFormError(res.message || 'আপলোড সম্পন্ন করা যায়নি।');
          setIsSubmitting(false);
          return;
        }
        setFeedbackBanner(`✓ "${formTitle.trim()}" ডিজিটাল লাইব্রেরিতে যুক্ত ও শিক্ষার্থীদের জন্য উন্মুক্ত হয়েছে।`);
        setIsUploadModalOpen(false);
      }
      setTimeout(() => setFeedbackBanner(null), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = async (material: LibraryMaterial) => {
    void trackLibraryDownload(material.id);

    if (material.isExternalUrl) {
      const link = document.createElement('a');
      link.href = material.fileUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    const downloadHref = material.fileUrl.startsWith('/api/library/file/')
      ? `${material.fileUrl}?download=1`
      : material.fileUrl;

    const link = document.createElement('a');
    link.href = downloadHref;
    link.download = material.fileName || 'study-material';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getClassName = (cId: string) => {
    if (!cId || cId === 'all') return 'সকল শ্রেণি';
    return classes.find((c) => c.id === cId)?.nameBn || cId;
  };

  const canInlinePreview = (material: LibraryMaterial) =>
    !material.isExternalUrl && (material.fileType === 'pdf' || material.fileType === 'image');

  return (
    <div className={embedded ? 'space-y-5' : 'space-y-6'}>
      {/* Clean Header Panel */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-xl bg-slate-900 text-amber-300 shrink-0">
              <Library className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-serif">
                ডিজিটাল লাইব্রেরি ও রিসোর্স ভান্ডার
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                {canManage
                  ? 'শিক্ষার্থীদের জন্য পাঠ্যবই (ই-বুক), পিডিএফ লেকচার শিট, নোট ও প্রশ্নব্যাংক আপলোড এবং শ্রেণিবিন্যাস করুন'
                  : 'তোমার শ্রেণির পাঠ্যবই (ই-বুক), লেকচার পিডিএফ, নোট ও প্রশ্নব্যাংক এখান থেকে সরাসরি পড়ো এবং ডাউনলোড করো'}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 tabular-nums">
                <span>মোট রিসোর্স: {toBengaliNumber(libraryMaterials.length)}টি</span>
                <span aria-hidden="true">·</span>
                <span>মোট ডাউনলোড: {toBengaliNumber(totalDownloads)} বার</span>
                <span aria-hidden="true">·</span>
                <span>শিক্ষাবর্ষ: {toBengaliNumber(selectedYear || '২০২৬')}</span>
              </div>
            </div>
          </div>

          {canManage && (
            <button
              type="button"
              onClick={openCreateModal}
              className="px-4 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>নতুন বই / পিডিএফ আপলোড</span>
            </button>
          )}
        </div>

        {feedbackBanner && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs sm:text-sm font-semibold flex items-center justify-between gap-2">
            <span>{feedbackBanner}</span>
            <button
              type="button"
              onClick={() => setFeedbackBanner(null)}
              className="p-1 text-emerald-700 hover:text-emerald-950 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Category Filter Tabs + Search & Class/Subject Selectors */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap shrink-0 cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            সকল ({toBengaliNumber(libraryMaterials.length)})
          </button>
          {LIBRARY_CATEGORIES.map((cat) => {
            const count = libraryMaterials.filter((m) => m.category === cat.id).length;
            const active = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {cat.label} ({toBengaliNumber(count)})
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="বইয়ের নাম, বিষয়, অধ্যায় বা শিক্ষক লিখে খুঁজুন..."
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="sm:col-span-3">
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {mode === 'student' && defaultClassId && (
                <option value={`student_scope:${defaultClassId}`}>
                  আমার শ্রেণি ({getClassName(defaultClassId)}) ও সাধারণ
                </option>
              )}
              <option value="all">সকল শ্রেণির রিসোর্স</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameBn}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-3">
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">সকল বিষয়</option>
              {availableSubjectFilters.map((subName) => (
                <option key={subName} value={subName}>
                  {subName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Materials Catalog Grid */}
      {filteredMaterials.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <FolderOpen className="w-12 h-12 mx-auto text-slate-300" />
          <div className="text-base font-bold text-slate-900 font-serif">
            এই ক্যাটাগরি বা শ্রেণিতে এখনো কোনো মেটেরিয়াল পাওয়া যায়নি
          </div>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
            {canManage
              ? 'উপরের "নতুন বই / পিডিএফ আপলোড" বাটনে ক্লিক করে প্রথম ই-বুক বা লেকচার পিডিএফ যুক্ত করুন।'
              : 'অন্য ক্যাটাগরি বা "সকল শ্রেণির রিসোর্স" নির্বাচন করে দেখুন।'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredMaterials.map((item) => {
            const typeMeta = getFileTypeMeta(item.fileType, item.fileName);
            const TypeIcon = typeMeta.icon;
            const isDeletingThis = confirmDeleteId === item.id;

            return (
              <article
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between gap-4 hover:border-slate-300 transition"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className={`w-11 h-11 rounded-xl border flex flex-col items-center justify-center shrink-0 ${typeMeta.iconWrap}`}>
                      <TypeIcon className="w-5 h-5" />
                      <span className="text-[9px] font-bold tracking-tight leading-none mt-0.5">
                        {typeMeta.label}
                      </span>
                    </div>

                    {canManage && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-700 hover:bg-slate-100 cursor-pointer"
                          title="তথ্য সম্পাদনা"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(isDeletingThis ? null : item.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                          title="মুছে ফেলুন"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Clean Zero-Pill Unboxed Metadata */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 font-medium">
                    <span className="text-indigo-700 font-semibold">{getCategoryLabel(item.category)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{getClassName(item.classId)}</span>
                    {item.subjectNameBn && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{item.subjectNameBn}</span>
                      </>
                    )}
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-900 font-serif leading-snug">
                      {item.title}
                    </h3>
                    {item.chapter && (
                      <div className="text-xs text-slate-600 mt-1">
                        অধ্যায়: {item.chapter}
                      </div>
                    )}
                    {item.description && (
                      <p className="text-xs text-slate-600 mt-1.5 leading-relaxed line-clamp-2">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 tabular-nums">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono">{formatFileSizeBn(item.fileSizeBytes)}</span>
                      <span aria-hidden="true">·</span>
                      <span>ডাউনলোড {toBengaliNumber(item.downloadsCount || 0)}</span>
                    </div>
                    <div className="truncate max-w-[160px]" title={item.uploadedBy}>
                      {item.uploadedBy} · {formatBengaliDate(item.createdAt.split('T')[0])}
                    </div>
                  </div>

                  {isDeletingThis ? (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-rose-900">স্থায়ীভাবে মুছে ফেলবেন?</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteLibraryMaterial(item.id);
                            setConfirmDeleteId(null);
                          }}
                          className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg cursor-pointer whitespace-nowrap"
                        >
                          হ্যাঁ, মুছুন
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2.5 py-1 bg-white border border-slate-300 text-slate-700 rounded-lg cursor-pointer whitespace-nowrap"
                        >
                          না
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      {canInlinePreview(item) && (
                        <button
                          type="button"
                          onClick={() => setPreviewMaterial(item)}
                          className="px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>প্রিভিউ</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDownload(item)}
                        className="flex-1 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-indigo-800 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        {item.isExternalUrl ? (
                          <>
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>বই / লিংক খুলুন</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5" />
                            <span>ডাউনলোড করুন</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Upload / Edit Material Modal (Teachers & Admins) */}
      {isUploadModalOpen && canManage && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => !isSubmitting && setIsUploadModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl border border-slate-200 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-400 text-slate-950 rounded-xl">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold font-serif">
                    {editingMaterial ? 'মেটেরিয়াল তথ্য সম্পাদনা' : 'নতুন ডিজিটাল লাইব্রেরি রিসোর্স আপলোড'}
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    পিডিএফ, ই-বুক (EPUB), ডকুমেন্ট, স্লাইড অথবা অনলাইন বইয়ের লিংক যুক্ত করুন
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-5 space-y-4 text-xs sm:text-sm max-h-[80vh] overflow-y-auto">
              {!editingMaterial && (
                <>
                  <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setSourceMode('file')}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                        sourceMode === 'file' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      ফাইল আপলোড (PDF / EPUB / DOC / PPT)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSourceMode('link')}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                        sourceMode === 'link' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      অনলাইন ই-বুক / ড্রাইভ লিংক
                    </button>
                  </div>

                  {sourceMode === 'file' ? (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                      }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        const dropped = e.dataTransfer.files?.[0];
                        if (dropped) handleFileChosen(dropped);
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition ${
                        isDragging
                          ? 'border-indigo-600 bg-indigo-50'
                          : pickedFile
                          ? 'border-emerald-400 bg-emerald-50/50'
                          : 'border-slate-300 bg-slate-50 hover:border-indigo-400'
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.epub,.mobi,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileChosen(file);
                        }}
                      />
                      {pickedFile ? (
                        <div className="space-y-1">
                          <div className="text-sm font-bold text-emerald-900">{pickedFile.fileName}</div>
                          <div className="text-xs text-emerald-700 font-mono">
                            {formatFileSizeBn(pickedFile.fileSizeBytes)} · ফাইল পরিবর্তন করতে ক্লিক করুন
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <Upload className="w-7 h-7 mx-auto text-indigo-600" />
                          <div className="text-xs sm:text-sm font-bold text-slate-800">
                            ফাইল এখানে ড্র্যাগ করুন অথবা ক্লিক করে নির্বাচন করুন
                          </div>
                          <div className="text-[11px] text-slate-500">
                            PDF, EPUB, DOCX, PPTX, XLSX, TXT বা ছবি (সর্বোচ্চ ৪০ MB)
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        ই-বুক বা পিডিএফের ওয়েব লিংক (URL)
                      </label>
                      <input
                        type="url"
                        value={formExternalUrl}
                        onChange={(e) => setFormExternalUrl(e.target.value)}
                        placeholder="https://drive.google.com/... অথবা NCTB ই-বুক লিংক"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">বই / মেটেরিয়ালের শিরোনাম *</label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="যেমন: চতুর্থ শ্রেণির বিজ্ঞান অধ্যায়-৩ লেকচার পিডিএফ"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">ক্যাটাগরি</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as LibraryCategory)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                  >
                    {LIBRARY_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">শ্রেণি নির্বাচন</label>
                  <select
                    value={formClassId}
                    onChange={(e) => {
                      setFormClassId(e.target.value);
                      setFormSubjectId('');
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="all">সকল শ্রেণির জন্য</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nameBn}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">বিষয় (ঐচ্ছিক)</label>
                  <select
                    value={formSubjectId}
                    onChange={(e) => {
                      setFormSubjectId(e.target.value);
                      const matched = classSubjects.find((s) => s.id === e.target.value);
                      if (matched) setFormCustomSubject(matched.nameBn);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="">সাধারণ / সকল বিষয়</option>
                    {classSubjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nameBn}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">অধ্যায় / টপিক</label>
                  <input
                    type="text"
                    value={formChapter}
                    onChange={(e) => setFormChapter(e.target.value)}
                    placeholder="যেমন: অধ্যায় ৫ বা ১ম সাময়িক"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">সংক্ষিপ্ত বিবরণ (ঐচ্ছিক)</label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="শিক্ষার্থীরা এই ফাইল থেকে কী শিখবে বা অনুশীলন করবে..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              {!editingMaterial && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">আপলোডকারী শিক্ষক / বিভাগ</label>
                  <input
                    type="text"
                    value={formUploadedBy}
                    onChange={(e) => setFormUploadedBy(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              )}

              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                  {formError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-700 hover:bg-indigo-800 disabled:opacity-60 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {isSubmitting
                      ? 'আপলোড হচ্ছে...'
                      : editingMaterial
                      ? 'তথ্য সংরক্ষণ করুন'
                      : 'লাইব্রেরিতে আপলোড করুন'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inline File Preview Modal (PDF / Image) */}
      {previewMaterial && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-3 sm:p-6"
          onClick={() => setPreviewMaterial(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-4xl w-full h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold font-serif truncate">
                  {previewMaterial.title}
                </h3>
                <p className="text-[11px] text-slate-300 truncate">
                  {getCategoryLabel(previewMaterial.category)} · {getClassName(previewMaterial.classId)} · {formatFileSizeBn(previewMaterial.fileSizeBytes)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownload(previewMaterial)}
                  className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>ডাউনলোড</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMaterial(null)}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-100 overflow-hidden flex items-center justify-center">
              {previewMaterial.fileType === 'image' ? (
                <img
                  src={previewMaterial.fileUrl}
                  alt={previewMaterial.title}
                  className="max-w-full max-h-full object-contain p-4"
                />
              ) : (
                <iframe
                  title={previewMaterial.title}
                  src={previewMaterial.fileUrl}
                  className="w-full h-full border-0 bg-white"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
