import React, { useMemo, useRef, useState } from 'react';
import {
  Award,
  BellRing,
  BookOpen,
  Calendar,
  Camera,
  Check,
  CheckCheck,
  CheckCircle2,
  Circle,
  Clock,
  Compass,
  CreditCard,
  Edit3,
  Globe,
  GraduationCap,
  Heart,
  Image as ImageIcon,
  KeyRound,
  Lock,
  LogOut,
  Maximize2,
  MessageSquare,
  Plus,
  Save,
  Send,
  Share2,
  ShieldCheck,
  Target,
  Trash2,
  TrendingUp,
  Trophy,
  User,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useSchool } from '../context/SchoolContext';
import {
  SecurityGatepassLog,
  Student,
  StudentAchievement,
  StudentFuturePlan,
  StudentMilestone,
} from '../types';
import {
  formatBengaliDate,
  formatGpa,
  toBengaliNumber,
  toBengaliOrdinal,
  toBengaliRoll,
} from '../utils/bengali';
import { compressImageBase64 } from '../utils/imageCompressor';
import { StudentIDCardSlip } from './StudentIDCardSlip';
import { PWAInstallButton } from './PWAInstallButton';

interface StudentPersonalDashboardProps {
  student: Student;
  portalId: string;
  latestChildAlarm: SecurityGatepassLog | null;
  guardianChildLogs: SecurityGatepassLog[];
  guardianAudioEnabled: boolean;
  setGuardianAudioEnabled: (val: boolean) => void;
  guardianAudioTested: boolean;
  isGuardianAlarmRinging: boolean;
  ackSuccessFeedback: string | null;
  isSubmittingAck: boolean;
  guardianReplyText: string;
  setGuardianReplyText: (val: string) => void;
  onTestAudio: () => void;
  onReplayAlarm: (log: SecurityGatepassLog) => void;
  onAcknowledgeAlarm: (log: SecurityGatepassLog, customText?: string) => void;
  buildGuardianVoiceMessage: (student: Student, action: 'entry' | 'exit') => string;
  copiedLink: boolean;
  onCopyDirectLink: () => void;
  onLogout: () => void;
  onPhotoUpload: (studentId: string, role: 'student' | 'father' | 'mother', base64: string) => Promise<void>;
}

const CAREER_SUGGESTIONS = [
  'চিকিৎসক (ডাক্তার)',
  'প্রকৌশলী (ইঞ্জিনিয়ার)',
  'সফটওয়্যার নির্মাতা ও বিজ্ঞানী',
  'আদর্শ শিক্ষক ও গবেষক',
  'বিসিএস ক্যাডার ও প্রশাসক',
  'হাফেজে কুরআন ও ইসলামিক স্কলার',
  'বৈমানিক (পাইলট)',
  'ব্যবসায়ী ও উদ্যোক্তা',
];

const MILESTONE_CATEGORIES: { id: StudentMilestone['category']; label: string }[] = [
  { id: 'academic', label: 'পড়াশোনা ও পরীক্ষা' },
  { id: 'character', label: 'চরিত্র ও নৈতিকতা' },
  { id: 'skill', label: 'দক্ষতা ও প্রযুক্তি' },
  { id: 'sports', label: 'ক্রীড়া ও সহ-শিক্ষা' },
  { id: 'other', label: 'অন্যান্য লক্ষ্য' },
];

const ACHIEVEMENT_CATEGORIES: { id: StudentAchievement['category']; label: string }[] = [
  { id: 'academic', label: 'একাডেমিক সাফল্য' },
  { id: 'sports', label: 'ক্রীড়া ও প্রতিযোগিতা' },
  { id: 'cultural', label: 'সাহিত্য ও সংস্কৃতি' },
  { id: 'character', label: 'নৈতিকতা ও শৃঙ্খলা' },
  { id: 'memory', label: 'বিদ্যালয়ের স্মরণীয় দিন' },
];

export const StudentPersonalDashboard: React.FC<StudentPersonalDashboardProps> = ({
  student,
  portalId,
  latestChildAlarm,
  guardianChildLogs,
  guardianAudioEnabled,
  setGuardianAudioEnabled,
  guardianAudioTested,
  isGuardianAlarmRinging,
  ackSuccessFeedback,
  isSubmittingAck,
  guardianReplyText,
  setGuardianReplyText,
  onTestAudio,
  onReplayAlarm,
  onAcknowledgeAlarm,
  buildGuardianVoiceMessage,
  copiedLink,
  onCopyDirectLink,
  onLogout,
  onPhotoUpload,
}) => {
  const {
    schoolInfo,
    classes,
    examTerms,
    selectedYear,
    getCalculatedResultsForClass,
    calculateStudentAttendanceMetrics,
    getStudentDueSummary,
    updateStudent,
    syllabi,
    calendarEvents,
  } = useSchool();

  const [dashboardSection, setDashboardSection] = useState<
    'overview' | 'future_plan' | 'achievements' | 'id_and_contact'
  >('overview');

  const classObj = useMemo(
    () => classes.find((c) => c.id === student.classId),
    [classes, student.classId]
  );
  const classNameBn = classObj?.nameBn || 'শ্রেণি';

  // Academic Progress across terms
  const [selectedTermId, setSelectedTermId] = useState<string>(
    examTerms.find((t) => t.id === 'term_2')?.id || examTerms[0]?.id || 'term_2'
  );

  const termResult = useMemo(() => {
    const classResults = getCalculatedResultsForClass(
      student.classId,
      student.section || '',
      selectedTermId,
      student.academicYear || selectedYear || '২০২৬'
    );
    const exact = classResults.find((r) => r.student.id === student.id);
    if (exact) return exact;
    const allSecResults = getCalculatedResultsForClass(
      student.classId,
      '',
      selectedTermId,
      student.academicYear || selectedYear || '২০২৬'
    );
    return allSecResults.find((r) => r.student.id === student.id) || null;
  }, [getCalculatedResultsForClass, student, selectedTermId, selectedYear]);

  const hasEnteredMarks = useMemo(
    () => Boolean(termResult && termResult.subjectRows.some((r) => r.totalObtained !== null)),
    [termResult]
  );

  const subjectChartData = useMemo(() => {
    if (!termResult) return [];
    return termResult.subjectRows.map((row) => ({
      name: row.subject.nameBn.length > 10 ? `${row.subject.nameBn.slice(0, 10)}…` : row.subject.nameBn,
      fullName: row.subject.nameBn,
      প্রাপ্ত: row.totalObtained ?? 0,
      সর্বোচ্চ: row.classHighest ?? row.fullMarks,
      পূর্ণমান: row.fullMarks,
    }));
  }, [termResult]);

  const attendanceMetrics = useMemo(
    () =>
      calculateStudentAttendanceMetrics(
        student.id,
        student.classId,
        student.academicYear || selectedYear || '২০২৬'
      ),
    [calculateStudentAttendanceMetrics, student, selectedYear]
  );

  const dueSummary = useMemo(() => getStudentDueSummary(student.id), [getStudentDueSummary, student.id]);

  const classSyllabi = useMemo(
    () => syllabi.filter((s) => s.classId === student.classId),
    [syllabi, student.classId]
  );

  const upcomingEvents = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return calendarEvents
      .filter(
        (ev) =>
          (ev.endDate || ev.startDate) >= today &&
          (!ev.applicableClasses || ev.applicableClasses.length === 0 || ev.applicableClasses.includes(student.classId))
      )
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .slice(0, 4);
  }, [calendarEvents, student.classId]);

  // Student Photo Quick Update
  const studentPhotoInputRef = useRef<HTMLInputElement>(null);
  const handleStudentAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      if (base64) {
        await onPhotoUpload(student.id, 'student', base64);
      }
    };
    reader.readAsDataURL(file);
  };

  // =========================================================================
  // FUTURE PLAN & MILESTONES STATE
  // =========================================================================
  const existingPlan: StudentFuturePlan = useMemo(
    () =>
      student.futurePlan || {
        dreamCareer: 'চিকিৎসক (ডাক্তার)',
        motto: 'প্রতিদিন নিয়মিত পড়াশোনা, সততা ও মা-বাবার দোয়া নিয়ে এগিয়ে যাব।',
        focusSubjects: ['গণিত', 'ইংরেজি', 'বিজ্ঞান'],
        dailyStudyHoursGoal: 3,
        milestones: [
          {
            id: `ms-default-${student.id}-1`,
            title: 'বার্ষিক পরীক্ষায় শ্রেণিতে শীর্ষ ৩-এ স্থান অর্জন করা',
            targetYear: '২০২৬',
            category: 'academic',
            status: 'in_progress',
            note: 'প্রতিদিন ক্লাসের পড়া বাসায় অনুশীলন করা',
          },
          {
            id: `ms-default-${student.id}-2`,
            title: 'নিয়মিত বিদ্যালয়ে উপস্থিত থাকা ও শিক্ষকদের নির্দেশনা মানা',
            targetYear: '২০২৬',
            category: 'character',
            status: 'in_progress',
          },
        ],
      },
    [student.futurePlan, student.id]
  );

  const [isEditingVision, setIsEditingVision] = useState(false);
  const [visionDraft, setVisionDraft] = useState<StudentFuturePlan>(existingPlan);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneYear, setNewMilestoneYear] = useState('২০২৬');
  const [newMilestoneCategory, setNewMilestoneCategory] =
    useState<StudentMilestone['category']>('academic');
  const [newMilestoneNote, setNewMilestoneNote] = useState('');
  const [planSaveNotice, setPlanSaveNotice] = useState<string | null>(null);

  const saveFuturePlan = (nextPlan: StudentFuturePlan, noticeText = '✓ ভবিষ্যৎ পরিকল্পনা সংরক্ষিত হয়েছে') => {
    const payload: StudentFuturePlan = {
      ...nextPlan,
      updatedAt: new Date().toISOString(),
    };
    updateStudent({ ...student, futurePlan: payload });
    setVisionDraft(payload);
    setPlanSaveNotice(noticeText);
    setTimeout(() => setPlanSaveNotice(null), 3000);
  };

  const handleAddMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMilestoneTitle.trim()) return;
    const item: StudentMilestone = {
      id: `ms-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: newMilestoneTitle.trim(),
      targetYear: newMilestoneYear.trim() || '২০২৬',
      category: newMilestoneCategory,
      status: 'planned',
      note: newMilestoneNote.trim() || undefined,
    };
    const nextPlan: StudentFuturePlan = {
      ...existingPlan,
      milestones: [item, ...(existingPlan.milestones || [])],
    };
    saveFuturePlan(nextPlan, '✓ নতুন লক্ষ্য ও মাইলফলক যুক্ত হয়েছে!');
    setNewMilestoneTitle('');
    setNewMilestoneNote('');
  };

  const handleCycleMilestoneStatus = (msId: string) => {
    const order: StudentMilestone['status'][] = ['planned', 'in_progress', 'achieved'];
    const nextMilestones = (existingPlan.milestones || []).map((m) => {
      if (m.id !== msId) return m;
      const nextStatus = order[(order.indexOf(m.status) + 1) % order.length];
      return { ...m, status: nextStatus };
    });
    saveFuturePlan({ ...existingPlan, milestones: nextMilestones }, '✓ মাইলফলকের অগ্রগতি আপডেট হয়েছে');
  };

  const handleDeleteMilestone = (msId: string) => {
    const nextMilestones = (existingPlan.milestones || []).filter((m) => m.id !== msId);
    saveFuturePlan({ ...existingPlan, milestones: nextMilestones }, '✓ লক্ষ্য তালিকা থেকে সরানো হয়েছে');
  };

  const milestoneProgress = useMemo(() => {
    const list = existingPlan.milestones || [];
    if (list.length === 0) return { total: 0, achieved: 0, percent: 0 };
    const achieved = list.filter((m) => m.status === 'achieved').length;
    return {
      total: list.length,
      achieved,
      percent: Math.round((achieved / list.length) * 100),
    };
  }, [existingPlan.milestones]);

  // =========================================================================
  // ACHIEVEMENTS & MEMORIES STATE
  // =========================================================================
  const achievementsList = useMemo(() => student.achievements || [], [student.achievements]);
  const [showAddAchievement, setShowAddAchievement] = useState(false);
  const [achTitle, setAchTitle] = useState('');
  const [achDate, setAchDate] = useState(new Date().toISOString().split('T')[0]);
  const [achCategory, setAchCategory] = useState<StudentAchievement['category']>('academic');
  const [achAwardedBy, setAchAwardedBy] = useState('');
  const [achDescription, setAchDescription] = useState('');
  const [achPhotoUrl, setAchPhotoUrl] = useState<string>('');
  const [achSaving, setAchSaving] = useState(false);
  const [lightboxAchievement, setLightboxAchievement] = useState<StudentAchievement | null>(null);

  const handleAchievementPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const raw = ev.target?.result as string;
      if (raw) {
        const compressed = await compressImageBase64(raw, 720, 540, 0.78);
        setAchPhotoUrl(compressed);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddAchievement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!achTitle.trim()) return;
    setAchSaving(true);
    const newItem: StudentAchievement = {
      id: `ach-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: achTitle.trim(),
      date: achDate,
      category: achCategory,
      awardedBy: achAwardedBy.trim() || schoolInfo.name,
      description: achDescription.trim() || 'বিদ্যালয়ের স্মরণীয় অর্জন ও কৃতিত্ব।',
      photoUrl: achPhotoUrl || undefined,
      createdAt: new Date().toISOString(),
    };
    updateStudent({
      ...student,
      achievements: [newItem, ...achievementsList],
    });
    setAchTitle('');
    setAchAwardedBy('');
    setAchDescription('');
    setAchPhotoUrl('');
    setShowAddAchievement(false);
    setAchSaving(false);
  };

  const handleDeleteAchievement = (achId: string) => {
    updateStudent({
      ...student,
      achievements: achievementsList.filter((a) => a.id !== achId),
    });
    if (lightboxAchievement?.id === achId) {
      setLightboxAchievement(null);
    }
  };

  // =========================================================================
  // PASSWORD / PIN & LEAVE MESSAGE STATE
  // =========================================================================
  const [newPinInput, setNewPinInput] = useState(student.guardianPin || '1234');
  const [pinSavedFeedback, setPinSavedFeedback] = useState<string | null>(null);
  const [leaveNote, setLeaveNote] = useState('');
  const [leaveSubmitted, setLeaveSubmitted] = useState(false);

  const handleUpdatePersonalPin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newPinInput.trim();
    if (cleaned.length < 4) return;
    updateStudent({
      ...student,
      portalUserId: portalId,
      guardianPin: cleaned,
    });
    setPinSavedFeedback('✓ আপনার ব্যক্তিগত ড্যাশবোর্ড পাসওয়ার্ড (পিন) সফলভাবে পরিবর্তিত হয়েছে!');
    setTimeout(() => setPinSavedFeedback(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* =================================================================== */}
      {/* PERSONAL PHOTO-CENTERED HERO HEADER                                 */}
      {/* =================================================================== */}
      <section className="bg-[#091e42] text-white rounded-2xl border border-slate-800 shadow-lg overflow-hidden">
        <div className="p-5 sm:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Left: Portrait Photo + Student & Guardian Identity */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="relative group shrink-0 self-start sm:self-auto">
              <div className="w-28 h-32 sm:w-32 sm:h-36 rounded-xl border-2 border-amber-400/90 bg-slate-900 overflow-hidden shadow-md flex items-center justify-center">
                {student.avatarUrl ? (
                  <img
                    src={student.avatarUrl}
                    alt={`${student.nameBn}-এর ছবি`}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                    <User className="w-10 h-10 text-amber-300/80 mb-1" />
                    <span className="text-[11px] font-medium text-slate-300">ছবি যুক্ত করুন</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => studentPhotoInputRef.current?.click()}
                className="mt-2 w-full py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition cursor-pointer whitespace-nowrap"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>ছবি পরিবর্তন</span>
              </button>
              <input
                ref={studentPhotoInputRef}
                type="file"
                accept="image/*"
                onChange={handleStudentAvatarChange}
                className="hidden"
              />
            </div>

            <div className="space-y-2.5">
              {/* Quiet metadata line (Zero-pill discipline) */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-amber-300 font-medium">
                <span>ব্যক্তিগত শিক্ষার্থী ও অভিভাবক ড্যাশবোর্ড</span>
                <span aria-hidden="true" className="text-slate-500">·</span>
                <span className="font-mono tabular-nums text-emerald-300">
                  আইডি: {portalId}
                </span>
                <span aria-hidden="true" className="text-slate-500">·</span>
                <span className="text-emerald-300 font-semibold">সাইন-ইন সক্রিয়</span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-bold font-serif text-white tracking-tight">
                {student.nameBn}
              </h2>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-slate-200 tabular-nums">
                <span>{classNameBn}</span>
                <span aria-hidden="true" className="text-slate-500">·</span>
                <span>শাখা: {student.section || 'ক'}</span>
                <span aria-hidden="true" className="text-slate-500">·</span>
                <span className="font-semibold text-amber-300">
                  রোল নম্বর: {toBengaliRoll(student.roll)}
                </span>
                <span aria-hidden="true" className="text-slate-500">·</span>
                <span>শিক্ষাবর্ষ: {student.academicYear || selectedYear || '২০২৬'}</span>
              </div>

              <div className="pt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
                <span>
                  পিতা: <strong className="text-white">{student.fatherNameBn || student.fatherName || 'তথ্য সংযুক্ত হচ্ছে'}</strong>
                </span>
                <span aria-hidden="true" className="text-slate-600">/</span>
                <span>
                  মাতা: <strong className="text-white">{student.motherNameBn || student.motherName || 'তথ্য সংযুক্ত হচ্ছে'}</strong>
                </span>
              </div>

              <p className="text-xs text-emerald-200/90 pt-0.5 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  আপনি সাইন-ইন থাকা অবস্থায় শুধুমাত্র {student.nameBn}-এর গেটপাস নোটিফিকেশন ও অডিও এলার্ম পাবেন; সাইন-আউট করলে নোটিফিকেশন বন্ধ থাকবে।
                </span>
              </p>
            </div>
          </div>

          {/* Right: Session & Direct Link Actions */}
          <div className="flex flex-wrap lg:flex-col items-stretch lg:items-end justify-between gap-2.5 shrink-0 border-t lg:border-t-0 lg:border-l border-slate-800 pt-4 lg:pt-0 lg:pl-6">
            <button
              type="button"
              onClick={onTestAudio}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
                isGuardianAlarmRinging
                  ? 'bg-rose-600 text-white'
                  : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
              }`}
            >
              <BellRing className="w-4 h-4" />
              <span>{guardianAudioTested ? 'ভয়েস ও এলার্ম সক্রিয়' : 'ভয়েস এলার্ম চালু করুন'}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onCopyDirectLink}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  copiedLink
                    ? 'bg-emerald-600 border-emerald-500 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                }`}
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>{copiedLink ? 'লিংক কপি হয়েছে' : 'ড্যাশবোর্ড লিংক কপি'}</span>
              </button>

              <button
                type="button"
                onClick={onLogout}
                className="px-3.5 py-2 bg-slate-800/80 hover:bg-rose-950/90 hover:text-rose-200 border border-slate-700 hover:border-rose-700/60 text-slate-200 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>সাইন আউট</span>
              </button>
            </div>
          </div>
        </div>

        {/* Clean Segmented Sub-Navigation */}
        <div className="bg-slate-900/90 border-t border-slate-800 px-4 sm:px-7 py-2.5 flex items-center gap-2 overflow-x-auto">
          {[
            { id: 'overview' as const, label: 'পড়াশোনা ও প্রগ্রেস', icon: TrendingUp },
            { id: 'future_plan' as const, label: 'ভবিষ্যৎ পরিকল্পনা', icon: Compass },
            {
              id: 'achievements' as const,
              label: `কৃতিত্বের স্মৃতি (${toBengaliNumber(achievementsList.length)})`,
              icon: Trophy,
            },
            { id: 'id_and_contact' as const, label: 'আইডি কার্ড ও পাসওয়ার্ড', icon: KeyRound },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = dashboardSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDashboardSection(tab.id)}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* PWA Install Notice */}
      <PWAInstallButton variant="banner" />

      {/* =================================================================== */}
      {/* SECTION 1: PROGRESS & LIVE GATEPASS NOTIFICATIONS                   */}
      {/* =================================================================== */}
      {dashboardSection === 'overview' && (
        <div className="space-y-6">
          {/* 4-Column Tabular Academic Summary Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
              <div className="text-xs font-medium text-slate-500">পরীক্ষার গড় জিপিএ</div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums font-mono">
                {hasEnteredMarks && termResult ? `${formatGpa(termResult.gpa)} (${termResult.overallGrade})` : 'অপেক্ষমাণ'}
              </div>
              <div className="text-xs text-slate-500">{termResult?.examTitle || 'মূল্যায়ন চলমান'}</div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
              <div className="text-xs font-medium text-slate-500">শ্রেণি মেধাক্রম</div>
              <div className="text-2xl font-bold text-indigo-900 tabular-nums">
                {hasEnteredMarks && termResult ? termResult.meritPositionBn : '-'}
              </div>
              <div className="text-xs text-slate-500 tabular-nums">
                মোট নম্বর: {hasEnteredMarks && termResult ? `${toBengaliNumber(termResult.grandTotalObtained)} / ${toBengaliNumber(termResult.totalFullMarks)}` : 'নম্বর এন্ট্রি হয়নি'}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
              <div className="text-xs font-medium text-slate-500">উপস্থিতির হার</div>
              <div className="text-2xl font-bold text-emerald-700 tabular-nums font-mono">
                {attendanceMetrics.totalWorkingDays > 0
                  ? `${toBengaliNumber(attendanceMetrics.percentage)}%`
                  : termResult && termResult.totalWorkingDays > 0
                  ? `${toBengaliNumber(Math.round((termResult.attendanceDays / termResult.totalWorkingDays) * 100))}%`
                  : '১০০%'}
              </div>
              <div className="text-xs text-slate-500 tabular-nums">
                {attendanceMetrics.totalWorkingDays > 0
                  ? `উপস্থিত ${toBengaliNumber(attendanceMetrics.presentDays)} / ${toBengaliNumber(attendanceMetrics.totalWorkingDays)} দিন`
                  : 'দৈনিক হাজিরার ভিত্তিতে হালনাগাদ'}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
              <div className="text-xs font-medium text-slate-500">লক্ষ্য ও কৃতিত্ব</div>
              <div className="text-2xl font-bold text-amber-700 tabular-nums font-mono">
                {toBengaliNumber(achievementsList.length)}টি স্মৃতি
              </div>
              <div className="text-xs text-slate-500 tabular-nums">
                {toBengaliNumber(milestoneProgress.achieved)}/{toBengaliNumber(milestoneProgress.total)}টি লক্ষ্য অর্জিত
              </div>
            </div>
          </div>

          {/* Live Gatepass Audio Notification Card */}
          <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-400 text-slate-950 rounded-xl">
                  <BellRing className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-serif">
                    লাইভ স্কুল গেটপাস অডিও ও নোটিফিকেশন
                  </h3>
                  <p className="text-xs text-slate-300">
                    বিদ্যালয়ের ফটকে {student.nameBn}-এর আইডি কার্ড স্ক্যান হলেই এখানে অডিও মেসেজ বেজে ওঠে
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setGuardianAudioEnabled(!guardianAudioEnabled)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    guardianAudioEnabled
                      ? 'bg-slate-800 border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  {guardianAudioEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                  <span>{guardianAudioEnabled ? 'অডিও চালু' : 'মিউট'}</span>
                </button>
                <span className="text-xs font-medium text-emerald-300 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" />
                  <span>লাইভ সিঙ্ক</span>
                </span>
              </div>
            </div>

            {ackSuccessFeedback && (
              <div className="p-3 bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-2">
                <CheckCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{ackSuccessFeedback}</span>
              </div>
            )}

            {latestChildAlarm ? (
              <div className="bg-slate-950/70 rounded-xl p-4 sm:p-5 border border-slate-800 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3 text-xs">
                    <span
                      className={`font-bold ${
                        latestChildAlarm.action === 'entry' ? 'text-emerald-400' : 'text-amber-300'
                      }`}
                    >
                      {latestChildAlarm.action === 'entry' ? 'বিদ্যালয়ে প্রবেশ সম্পন্ন' : 'বিদ্যালয় থেকে প্রস্থান সম্পন্ন'}
                    </span>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span className="text-slate-300 font-mono tabular-nums">
                      সময়: {new Date(latestChildAlarm.timestamp).toLocaleTimeString('bn-BD')}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onReplayAlarm(latestChildAlarm)}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Volume2 className="w-4 h-4 text-amber-300" />
                    <span>অডিও বার্তা শুনুন</span>
                  </button>
                </div>

                <p className="text-sm sm:text-base text-slate-100 leading-relaxed bg-slate-900 p-4 rounded-xl border border-slate-800">
                  {buildGuardianVoiceMessage(student, latestChildAlarm.action)}
                </p>

                {latestChildAlarm.guardianAcknowledged ? (
                  <div className="p-3 bg-emerald-950/60 border border-emerald-700/50 rounded-xl text-xs text-emerald-200 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>
                        প্রদত্ত রেসপন্স: "{latestChildAlarm.guardianResponse || 'মেসেজ শুনেছি ও নিশ্চিত করলাম'}"
                      </span>
                    </div>
                    <span className="text-emerald-300 font-mono text-[11px]">ডেটাবেজে কাউন্ট হয়েছে</span>
                  </div>
                ) : (
                  <div className="space-y-2.5 pt-1">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={isSubmittingAck}
                        onClick={() => onAcknowledgeAlarm(latestChildAlarm, 'মেসেজ শুনেছি ও নিশ্চিত করলাম')}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCheck className="w-4 h-4" />
                        <span>মেসেজ শুনেছি ও নিশ্চিত করলাম</span>
                      </button>

                      <button
                        type="button"
                        disabled={isSubmittingAck}
                        onClick={() => onAcknowledgeAlarm(latestChildAlarm, 'আলহামদুলিল্লাহ, ভালোভাবে ক্লাস করুক')}
                        className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-lg border border-slate-700 transition cursor-pointer"
                      >
                        আলহামদুলিল্লাহ, ধন্যবাদ
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={guardianReplyText}
                        onChange={(e) => setGuardianReplyText(e.target.value)}
                        placeholder="অভিভাবকের নিজস্ব উত্তর বা মন্তব্য লিখুন..."
                        className="flex-1 text-xs px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:border-amber-400 focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={isSubmittingAck || !guardianReplyText.trim()}
                        onClick={() => onAcknowledgeAlarm(latestChildAlarm)}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-lg transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>পাঠান</span>
                      </button>
                    </div>
                  </div>
                )}

                {guardianChildLogs.length > 1 && (
                  <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span className="font-semibold text-slate-300">
                      মোট গেটপাস রেকর্ড: {toBengaliNumber(guardianChildLogs.length)}টি
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      সর্বশেষ: {new Date(latestChildAlarm.timestamp).toLocaleDateString('bn-BD')}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-sm font-bold text-white">আজকের নতুন কোনো গেটপাস এলার্ম নেই</div>
                  <p className="text-xs text-slate-400">
                    বিদ্যালয়ের ফটকে {student.nameBn}-এর আইডি কার্ড স্ক্যান হওয়া মাত্রই এখানে তাৎক্ষণিক অডিও বার্তা ও সময়সূচি বাজবে।
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onTestAudio}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap self-start sm:self-auto"
                >
                  স্যাম্পল অডিও শুনুন
                </button>
              </div>
            )}
          </div>

          {/* Academic Progress Analytics & Subject Marks */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 8/12: Term Switcher + Subject Performance Chart & Table */}
            <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-serif">
                    বিষয়ভিত্তিক একাডেমিক প্রগ্রেস ও ফলাফল
                  </h3>
                  <p className="text-xs text-slate-500">
                    প্রতিটি বিষয়ে প্রাপ্ত নম্বর ও শ্রেণি সর্বোচ্চ নম্বরের তুলনামূলক চিত্র
                  </p>
                </div>

                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  {examTerms.map((term) => (
                    <button
                      key={term.id}
                      type="button"
                      onClick={() => setSelectedTermId(term.id)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition whitespace-nowrap cursor-pointer ${
                        selectedTermId === term.id
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {term.nameBn}
                    </button>
                  ))}
                </div>
              </div>

              {hasEnteredMarks && termResult ? (
                <div className="space-y-5">
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={subjectChartData} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: '10px',
                            border: '1px solid #cbd5e1',
                            fontSize: '12px',
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        <Bar dataKey="প্রাপ্ত" fill="#1e3a8a" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="সর্বোচ্চ" fill="#cbd5e1" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-600 font-semibold">
                          <th className="py-2.5 px-2">বিষয়ের নাম</th>
                          <th className="py-2.5 px-2 text-center">পূর্ণমান</th>
                          <th className="py-2.5 px-2 text-center">প্রাপ্ত নম্বর</th>
                          <th className="py-2.5 px-2 text-center">শ্রেণি সর্বোচ্চ</th>
                          <th className="py-2.5 px-2 text-center">গ্রেড</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 tabular-nums">
                        {termResult.subjectRows.map((row) => (
                          <tr key={row.subject.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-2 font-semibold text-slate-900">{row.subject.nameBn}</td>
                            <td className="py-2.5 px-2 text-center font-mono text-slate-600">
                              {toBengaliNumber(row.fullMarks)}
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono font-bold text-indigo-900">
                              {row.totalObtained !== null ? toBengaliNumber(row.totalObtained) : '-'}
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono text-slate-500">
                              {row.classHighest !== null ? toBengaliNumber(row.classHighest) : '-'}
                            </td>
                            <td className="py-2.5 px-2 text-center font-bold text-emerald-700">
                              {row.letterGrade}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700">
                    <strong className="text-slate-900">শ্রেণি শিক্ষকের মন্তব্য: </strong>
                    {termResult.teacherRemarks}
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center space-y-2 bg-slate-50 rounded-xl border border-slate-200">
                  <BookOpen className="w-9 h-9 mx-auto text-slate-400" />
                  <div className="text-sm font-bold text-slate-800">
                    {termResult?.examTitle || 'এই পরীক্ষার'} নম্বর এখনো প্রকাশিত হয়নি
                  </div>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    শিক্ষক মার্ক এন্ট্রি সম্পন্ন করলেই এখানে বিষয়ভিত্তিক প্রগ্রেস চার্ট, প্রাপ্ত নম্বর এবং মেধাক্রম স্বয়ংক্রিয়ভাবে প্রদর্শিত হবে।
                  </p>
                </div>
              )}
            </div>

            {/* Right 4/12: Vision Snapshot, Syllabus, Events & Fee Status */}
            <div className="lg:col-span-4 space-y-5">
              {/* Future Career Snapshot */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-slate-500">স্বপ্ন ও ভবিষ্যৎ লক্ষ্য</div>
                  <button
                    type="button"
                    onClick={() => setDashboardSection('future_plan')}
                    className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 cursor-pointer"
                  >
                    পরিকল্পনা দেখুন →
                  </button>
                </div>
                <div className="text-lg font-bold text-slate-900 font-serif">{existingPlan.dreamCareer}</div>
                <p className="text-xs text-slate-600 leading-relaxed">"{existingPlan.motto}"</p>
                <div className="pt-2 space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-600 tabular-nums">
                    <span>মাইলফলক অর্জন</span>
                    <span className="font-bold text-slate-900">
                      {toBengaliNumber(milestoneProgress.achieved)} / {toBengaliNumber(milestoneProgress.total)} ({toBengaliNumber(milestoneProgress.percent)}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                      style={{ width: `${milestoneProgress.percent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Fee & Accounts Status */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2.5">
                <div className="text-xs font-semibold text-slate-500">বিদ্যালয়ের বেতন ও ফি স্ট্যাটাস</div>
                {dueSummary ? (
                  <div className="space-y-1.5 text-xs tabular-nums">
                    <div className="flex justify-between text-slate-600">
                      <span>মোট প্রদেয় বিল:</span>
                      <span className="font-mono font-semibold text-slate-900">
                        ৳{toBengaliNumber(dueSummary.totalBilled)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>পরিশোধিত:</span>
                      <span className="font-mono font-semibold text-emerald-700">
                        ৳{toBengaliNumber(dueSummary.totalPaid)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1.5 border-t border-slate-100">
                      <span className="font-semibold text-slate-800">অবশিষ্ট বকেয়া:</span>
                      <span
                        className={`font-mono font-bold ${
                          dueSummary.totalDue > 0 ? 'text-rose-700' : 'text-emerald-700'
                        }`}
                      >
                        {dueSummary.totalDue > 0 ? `৳${toBengaliNumber(dueSummary.totalDue)}` : 'পরিশোধিত'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">কোনো বকেয়া বিল তৈরি হয়নি।</p>
                )}
              </div>

              {/* Upcoming Events & Syllabus */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                <div className="text-xs font-semibold text-slate-500">আসন্ন একাডেমিক সূচি ও সিলেবাস</div>
                {upcomingEvents.length > 0 ? (
                  <ul className="space-y-2.5 text-xs">
                    {upcomingEvents.map((ev) => (
                      <li key={ev.id} className="pb-2 border-b border-slate-100 last:border-b-0 last:pb-0">
                        <div className="font-semibold text-slate-900">{ev.title}</div>
                        <div className="text-slate-500 mt-0.5 tabular-nums">
                          {formatBengaliDate(ev.startDate)}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500">
                    শ্রেণির {toBengaliNumber(classSyllabi.length)}টি বিষয়ের সিলেবাস সংরক্ষিত আছে।
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* SECTION 2: FUTURE PLAN & MILESTONES ROADMAP                         */}
      {/* =================================================================== */}
      {dashboardSection === 'future_plan' && (
        <div className="space-y-6">
          {planSaveNotice && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{planSaveNotice}</span>
            </div>
          )}

          {/* Vision Statement Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-800 rounded-xl">
                  <Compass className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 font-serif">
                    {student.nameBn}-এর ভবিষ্যৎ লক্ষ্য ও জীবন পরিকল্পনা
                  </h3>
                  <p className="text-xs text-slate-500">
                    শিক্ষার্থী ও অভিভাবক যৌথভাবে জীবনের স্বপ্ন, অধ্যয়নের লক্ষ্য ও মাইলফলক নির্ধারণ করতে পারবেন
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setVisionDraft(existingPlan);
                  setIsEditingVision(!isEditingVision);
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{isEditingVision ? 'বাতিল করুন' : 'স্বপ্ন ও লক্ষ্য সম্পাদনা'}</span>
              </button>
            </div>

            {isEditingVision ? (
              <div className="space-y-4 text-xs sm:text-sm">
                <div>
                  <label className="block font-semibold text-slate-800 mb-1.5">
                    বড় হয়ে কী হতে চাই (ভবিষ্যৎ পেশা ও লক্ষ্য):
                  </label>
                  <input
                    type="text"
                    value={visionDraft.dreamCareer}
                    onChange={(e) => setVisionDraft({ ...visionDraft, dreamCareer: e.target.value })}
                    placeholder="যেমন: চিকিৎসক, প্রকৌশলী, হাফেজে কুরআন বা আদর্শ শিক্ষক"
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none font-semibold text-slate-900"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {CAREER_SUGGESTIONS.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setVisionDraft({ ...visionDraft, dreamCareer: item })}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer ${
                          visionDraft.dreamCareer === item
                            ? 'bg-indigo-900 text-white border-indigo-900'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-800 mb-1.5">
                      প্রতিদিন পড়াশোনার লক্ষ্য (ঘণ্টা):
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={visionDraft.dailyStudyHoursGoal || 3}
                      onChange={(e) =>
                        setVisionDraft({
                          ...visionDraft,
                          dailyStudyHoursGoal: Number(e.target.value) || 3,
                        })
                      }
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-mono font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-800 mb-1.5">
                      বিশেষ মনোযোগের বিষয়সমূহ (কমা দিয়ে লিখুন):
                    </label>
                    <input
                      type="text"
                      value={(visionDraft.focusSubjects || []).join(', ')}
                      onChange={(e) =>
                        setVisionDraft({
                          ...visionDraft,
                          focusSubjects: e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="যেমন: গণিত, ইংরেজি, বিজ্ঞান"
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 mb-1.5">
                    জীবনের অনুপ্রেরণামূলক অঙ্গীকার / আদর্শ বাক্য:
                  </label>
                  <textarea
                    rows={2}
                    value={visionDraft.motto}
                    onChange={(e) => setVisionDraft({ ...visionDraft, motto: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-900"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      saveFuturePlan(visionDraft, '✓ ভবিষ্যৎ লক্ষ্য ও অধ্যয়ন পরিকল্পনা সংরক্ষিত হয়েছে!');
                      setIsEditingVision(false);
                    }}
                    className="px-5 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>পরিকল্পনা সেভ করুন</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="md:col-span-2 bg-slate-50 rounded-xl border border-slate-200 p-5 space-y-2.5">
                  <div className="text-xs font-semibold text-indigo-800">ভবিষ্যৎ জীবনের স্বপ্ন</div>
                  <div className="text-2xl font-bold text-slate-900 font-serif">{existingPlan.dreamCareer}</div>
                  <p className="text-sm text-slate-600 leading-relaxed">"{existingPlan.motto}"</p>
                  {existingPlan.focusSubjects && existingPlan.focusSubjects.length > 0 && (
                    <div className="pt-2 text-xs text-slate-600">
                      <strong className="text-slate-800">বিশেষ গুরুত্বের বিষয়: </strong>
                      {existingPlan.focusSubjects.join(' · ')}
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="text-xs font-semibold text-slate-500">দৈনিক অধ্যয়নের লক্ষ্য</div>
                    <div className="text-2xl font-bold text-slate-900 tabular-nums mt-1">
                      দৈনিক {toBengaliNumber(existingPlan.dailyStudyHoursGoal || 3)} ঘণ্টা
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-slate-600 mb-1 tabular-nums">
                      <span>মাইলফলক অগ্রগতি</span>
                      <span className="font-bold text-emerald-700">{toBengaliNumber(milestoneProgress.percent)}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full transition-all"
                        style={{ width: `${milestoneProgress.percent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Add Milestone + Roadmap List */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form
              onSubmit={handleAddMilestone}
              className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 space-y-3.5 h-fit"
            >
              <h4 className="text-base font-bold text-slate-900 font-serif flex items-center gap-2">
                <Target className="w-4 h-4 text-indigo-700" />
                <span>নতুন লক্ষ্য ও মাইলফলক যুক্ত করুন</span>
              </h4>
              <p className="text-xs text-slate-500">
                আসন্ন পরীক্ষা, হিফজ, হাতের লেখা বা দক্ষতা অর্জনের ছোট ছোট ধাপ লিখে রাখুন।
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">লক্ষ্যের বিবরণ *</label>
                <input
                  type="text"
                  required
                  value={newMilestoneTitle}
                  onChange={(e) => setNewMilestoneTitle(e.target.value)}
                  placeholder="যেমন: গণিতে ৯৫+ নম্বর অর্জন করা"
                  className="w-full text-xs sm:text-sm px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">লক্ষ্যমাত্রার বছর</label>
                  <input
                    type="text"
                    value={newMilestoneYear}
                    onChange={(e) => setNewMilestoneYear(e.target.value)}
                    placeholder="২০২৬"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">বিভাগ</label>
                  <select
                    value={newMilestoneCategory}
                    onChange={(e) => setNewMilestoneCategory(e.target.value as StudentMilestone['category'])}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl bg-white"
                  >
                    {MILESTONE_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">করণীয় নোট (ঐচ্ছিক)</label>
                <input
                  type="text"
                  value={newMilestoneNote}
                  onChange={(e) => setNewMilestoneNote(e.target.value)}
                  placeholder="যেমন: প্রতিদিন ১ ঘণ্টা বেশি অনুশীলন"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>লক্ষ্য তালিকাভুক্ত করুন</span>
              </button>
            </form>

            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h4 className="text-base font-bold text-slate-900 font-serif">
                  নির্ধারিত মাইলফলক তালিকা ({toBengaliNumber((existingPlan.milestones || []).length)})
                </h4>
                <span className="text-xs text-slate-500">অবস্থা বদলাতে বাম পাশের আইকনে ক্লিক করুন</span>
              </div>

              {(existingPlan.milestones || []).length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500">
                  এখনো কোনো মাইলফলক যুক্ত করা হয়নি। বাম পাশের ফর্ম থেকে প্রথম লক্ষ্য যুক্ত করুন।
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {(existingPlan.milestones || []).map((ms) => {
                    const catLabel =
                      MILESTONE_CATEGORIES.find((c) => c.id === ms.category)?.label || 'লক্ষ্য';
                    return (
                      <li key={ms.id} className="py-3.5 flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() => handleCycleMilestoneStatus(ms.id)}
                            title="অবস্থা পরিবর্তন করুন"
                            className="mt-0.5 cursor-pointer shrink-0"
                          >
                            {ms.status === 'achieved' ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                            ) : ms.status === 'in_progress' ? (
                              <Clock className="w-5 h-5 text-amber-600" />
                            ) : (
                              <Circle className="w-5 h-5 text-slate-400 hover:text-indigo-600" />
                            )}
                          </button>

                          <div>
                            <div
                              className={`text-sm font-semibold ${
                                ms.status === 'achieved' ? 'text-slate-500 line-through' : 'text-slate-900'
                              }`}
                            >
                              {ms.title}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
                              <span>{catLabel}</span>
                              <span aria-hidden="true">·</span>
                              <span className="tabular-nums">লক্ষ্য: {ms.targetYear}</span>
                              <span aria-hidden="true">·</span>
                              <span
                                className={`font-semibold ${
                                  ms.status === 'achieved'
                                    ? 'text-emerald-700'
                                    : ms.status === 'in_progress'
                                    ? 'text-amber-700'
                                    : 'text-slate-600'
                                }`}
                              >
                                {ms.status === 'achieved'
                                  ? 'অর্জিত'
                                  : ms.status === 'in_progress'
                                  ? 'চলমান'
                                  : 'পরিকল্পিত'}
                              </span>
                            </div>
                            {ms.note && <p className="text-xs text-slate-600 mt-1">{ms.note}</p>}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteMilestone(ms.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition cursor-pointer shrink-0"
                          title="মুছে ফেলুন"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* SECTION 3: ACHIEVEMENTS & MEMORIES GALLERY                          */}
      {/* =================================================================== */}
      {dashboardSection === 'achievements' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 text-amber-700 rounded-xl">
                <Trophy className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 font-serif">
                  {student.nameBn}-এর কৃতিত্ব, পুরস্কার ও স্মৃতির অ্যালবাম
                </h3>
                <p className="text-xs text-slate-500">
                  স্কুল জীবনের মেডেল, সনদপত্র, প্রতিযোগিতার বিজয় ও প্রিয় মুহূর্তের ছবি চিরস্থায়ীভাবে সংরক্ষণ করুন
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAddAchievement(!showAddAchievement)}
              className="px-4 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              {showAddAchievement ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{showAddAchievement ? 'ফর্ম বন্ধ করুন' : 'নতুন কৃতিত্ব / স্মৃতি যোগ করুন'}</span>
            </button>
          </div>

          {showAddAchievement && (
            <form
              onSubmit={handleAddAchievement}
              className="bg-white rounded-2xl border border-indigo-200 p-5 sm:p-6 space-y-4 text-xs sm:text-sm"
            >
              <div className="font-bold text-slate-900 font-serif text-base pb-2 border-b border-slate-200">
                নতুন অর্জন বা স্মৃতির বিবরণ লিখুন
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    কৃতিত্ব বা স্মৃতির শিরোনাম *
                  </label>
                  <input
                    type="text"
                    required
                    value={achTitle}
                    onChange={(e) => setAchTitle(e.target.value)}
                    placeholder="যেমন: বার্ষিক ক্রীড়া প্রতিযোগিতায় ১ম স্থান বা শ্রেণিতে সেরা উপস্থিতি"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">তারিখ</label>
                  <input
                    type="date"
                    value={achDate}
                    onChange={(e) => setAchDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">বিভাগ</label>
                  <select
                    value={achCategory}
                    onChange={(e) => setAchCategory(e.target.value as StudentAchievement['category'])}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                  >
                    {ACHIEVEMENT_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">প্রদানকারী / আয়োজক</label>
                  <input
                    type="text"
                    value={achAwardedBy}
                    onChange={(e) => setAchAwardedBy(e.target.value)}
                    placeholder={schoolInfo.name}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">স্মৃতির গল্প ও বিবরণ</label>
                <textarea
                  rows={2}
                  value={achDescription}
                  onChange={(e) => setAchDescription(e.target.value)}
                  placeholder="এই অর্জনের দিনের বিশেষ স্মৃতি বা অনুভূতি লিখে রাখুন..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                <div className="flex items-center gap-3">
                  <label className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-semibold text-xs rounded-xl cursor-pointer flex items-center gap-1.5 transition">
                    <ImageIcon className="w-4 h-4 text-indigo-700" />
                    <span>{achPhotoUrl ? 'ছবি পরিবর্তন করুন' : 'পুরস্কার বা স্মৃতির ছবি আপলোড'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAchievementPhotoSelect}
                      className="hidden"
                    />
                  </label>
                  {achPhotoUrl && (
                    <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-300">
                      <img src={achPhotoUrl} alt="সংযুক্ত ছবি" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={achSaving}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{achSaving ? 'সংরক্ষণ হচ্ছে...' : 'অ্যালবামে সেভ করুন'}</span>
                </button>
              </div>
            </form>
          )}

          {achievementsList.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
              <Award className="w-12 h-12 mx-auto text-amber-500" />
              <div className="text-base font-bold text-slate-900 font-serif">
                এখনো কোনো কৃতিত্বের স্মৃতি সংরক্ষিত হয়নি
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                পুরস্কার প্রাপ্তির মুহূর্ত, সনদপত্র, সাংস্কৃতিক অনুষ্ঠান কিংবা পরীক্ষায় ভালো ফলাফলের ছবি ও গল্প এখানে সংরক্ষণ করে রাখুন যাতে শিক্ষার্থী ও অভিভাবক সবসময় দেখতে পারেন।
              </p>
              <button
                type="button"
                onClick={() => setShowAddAchievement(true)}
                className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs rounded-xl transition inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>প্রথম কৃতিত্ব যোগ করুন</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {achievementsList.map((ach) => {
                const catLabel =
                  ACHIEVEMENT_CATEGORIES.find((c) => c.id === ach.category)?.label || 'কৃতিত্ব';
                return (
                  <article
                    key={ach.id}
                    className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      <div
                        onClick={() => setLightboxAchievement(ach)}
                        className="relative aspect-[4/3] bg-slate-100 overflow-hidden cursor-pointer group"
                      >
                        {ach.photoUrl ? (
                          <img
                            src={ach.photoUrl}
                            alt={ach.title}
                            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-slate-800 to-indigo-950 flex flex-col items-center justify-center p-4 text-center text-white">
                            <Award className="w-10 h-10 text-amber-400 mb-2" />
                            <span className="text-xs font-medium text-slate-200 line-clamp-2">{ach.title}</span>
                          </div>
                        )}
                        <div className="absolute top-2.5 right-2.5 p-1.5 bg-slate-950/70 text-white rounded-lg opacity-0 group-hover:opacity-100 transition">
                          <Maximize2 className="w-3.5 h-3.5" />
                        </div>
                      </div>

                      <div className="p-4 space-y-2">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span>{catLabel}</span>
                          <span aria-hidden="true">·</span>
                          <span>{formatBengaliDate(ach.date)}</span>
                        </div>
                        <h4 className="text-base font-bold text-slate-900 font-serif">{ach.title}</h4>
                        <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">{ach.description}</p>
                      </div>
                    </div>

                    <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <span className="truncate">{ach.awardedBy || schoolInfo.name}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteAchievement(ach.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded cursor-pointer"
                        title="মুছে ফেলুন"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* SECTION 4: DIGITAL ID CARD, PASSWORD & SCHOOL MESSAGE               */}
      {/* =================================================================== */}
      {dashboardSection === 'id_and_contact' && (
        <div className="space-y-6">
          {/* Student ID Cards Front & Back */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-3 flex flex-col items-center">
              <div className="w-full flex items-center justify-between pb-2 border-b border-slate-200 text-xs">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-indigo-700" />
                  <span>স্মার্ট আইডি কার্ড (এপিঠ)</span>
                </span>
                <span className="text-slate-500 font-mono tabular-nums">আইডি: {portalId}</span>
              </div>

              <StudentIDCardSlip
                student={student}
                classNameBn={classNameBn}
                schoolInfo={schoolInfo}
                side="front"
                academicYear={selectedYear || '২০২৬'}
                onPhotoUpload={onPhotoUpload}
              />
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-3 flex flex-col items-center">
              <div className="w-full flex items-center justify-between pb-2 border-b border-slate-200 text-xs">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Heart className="w-4 h-4 text-rose-600" />
                  <span>পিতা-মাতার পরিচয় কার্ড (ওপিঠ)</span>
                </span>
                <span className="text-slate-500">জরুরি যোগাযোগ</span>
              </div>

              <StudentIDCardSlip
                student={student}
                classNameBn={classNameBn}
                schoolInfo={schoolInfo}
                side="back"
                academicYear={selectedYear || '২০২৬'}
                onPhotoUpload={onPhotoUpload}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Password / Security PIN Update */}
            <form
              onSubmit={handleUpdatePersonalPin}
              className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3.5"
            >
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm font-serif">
                <Lock className="w-4 h-4 text-indigo-700" />
                <span>নিজস্ব ইউনিক আইডি ও পাসওয়ার্ড (পিন) পরিচালনা</span>
              </div>
              <p className="text-xs text-slate-500">
                আপনার ইউনিক লগইন আইডি <strong className="font-mono text-slate-800">{portalId}</strong>। নিরাপত্তার জন্য নিজের পছন্দমতো গোপন পাসওয়ার্ড/পিন (কমপক্ষে ৪ ডিজিট) সেট করতে পারেন।
              </p>

              {pinSavedFeedback && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-semibold text-emerald-900">
                  {pinSavedFeedback}
                </div>
              )}

              <div className="flex gap-2">
                <input
                  type="text"
                  minLength={4}
                  required
                  value={newPinInput}
                  onChange={(e) => setNewPinInput(e.target.value)}
                  placeholder="নতুন পাসওয়ার্ড বা পিন (কমপক্ষে ৪ অক্ষর)"
                  className="flex-1 text-sm px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold text-slate-900"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs rounded-xl transition cursor-pointer whitespace-nowrap"
                >
                  পাসওয়ার্ড আপডেট
                </button>
              </div>
            </form>

            {/* Leave / Message to Headmaster */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm font-serif">
                <Send className="w-4 h-4 text-emerald-600" />
                <span>প্রধান শিক্ষকের নিকট ছুটি বা জরুরি বার্তা</span>
              </div>
              <p className="text-xs text-slate-500">
                অসুস্থতা, অগ্রিম ছুটি বা জরুরি বিষয়ে সরাসরি বিদ্যালয় কর্তৃপক্ষকে জানান।
              </p>

              {leaveSubmitted ? (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-950 text-xs font-semibold flex items-center justify-between">
                  <span>✓ আপনার বার্তাটি প্রধান শিক্ষকের ডেস্কে পাঠানো হয়েছে!</span>
                  <button
                    type="button"
                    onClick={() => setLeaveSubmitted(false)}
                    className="text-emerald-800 underline text-xs cursor-pointer"
                  >
                    নতুন বার্তা
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <textarea
                    rows={2}
                    value={leaveNote}
                    onChange={(e) => setLeaveNote(e.target.value)}
                    placeholder="ছুটির কারণ বা জরুরি বার্তা লিখুন..."
                    className="w-full text-xs sm:text-sm border border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!leaveNote.trim()) return;
                      setLeaveSubmitted(true);
                      setLeaveNote('');
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>বার্তা প্রেরণ করুন</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Lightbox for Achievement Memories */}
      {lightboxAchievement && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4"
          onClick={() => setLightboxAchievement(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
              <div className="text-sm font-bold text-slate-900 font-serif">{lightboxAchievement.title}</div>
              <button
                type="button"
                onClick={() => setLightboxAchievement(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {lightboxAchievement.photoUrl && (
              <div className="bg-slate-950 max-h-[60vh] flex items-center justify-center overflow-hidden">
                <img
                  src={lightboxAchievement.photoUrl}
                  alt={lightboxAchievement.title}
                  className="max-h-[60vh] w-auto object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}
            <div className="p-5 space-y-2 text-xs sm:text-sm">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>{formatBengaliDate(lightboxAchievement.date)}</span>
                <span aria-hidden="true">·</span>
                <span>{lightboxAchievement.awardedBy || schoolInfo.name}</span>
              </div>
              <p className="text-slate-700 leading-relaxed">{lightboxAchievement.description}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
