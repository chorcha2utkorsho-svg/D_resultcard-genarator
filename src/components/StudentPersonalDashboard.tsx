import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Award,
  BellRing,
  BookOpen,
  Calendar,
  Check,
  CheckCheck,
  CheckCircle2,
  Circle,
  Clock,
  Compass,
  Copy,
  CreditCard,
  Edit3,
  Globe,
  GraduationCap,
  Heart,
  Home,
  Image as ImageIcon,
  KeyRound,
  Library,
  Lock,
  LogOut,
  Map as MapIcon,
  Maximize2,
  MessageSquare,
  Plus,
  Radio,
  RefreshCw,
  Rocket,
  Save,
  Send,
  ShieldCheck,
  Smartphone,
  Target,
  Terminal,
  Trash2,
  TrendingUp,
  Trophy,
  Unlock,
  User,
  Volume2,
  VolumeX,
  Wifi,
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
  CalculatedStudentResult,
  SecurityGatepassLog,
  Student,
  StudentAchievement,
  StudentFuturePlan,
  StudentMilestone,
} from '../types';
import { usePWAInstall } from '../hooks/usePWAInstall';
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
import { HowToInstallModal } from './HowToInstallModal';
import { EcheDanaGallery } from './EcheDanaGallery';
import { MonerBariView } from './MonerBariView';
import { TimeManagementView } from './TimeManagementView';
import { ExamCountdownWidget } from './ExamCountdownWidget';
import { StudentBadgesPanel } from './StudentBadgesPanel';
import { AcademicMilestoneRoadmap } from './AcademicMilestoneRoadmap';
import { DigitalLibraryView } from './DigitalLibraryView';
import {
  applyStudentPassportAppIcon,
  getShortStudentAppName,
} from '../utils/studentAppIcon';
import {
  getGuardianAudioStatus,
  getSharedAudioContext,
  GuardianAudioHardwareStatus,
  isMobileAudioUnlocked,
  PendingBlockedSpeechAlert,
  replayPendingBlockedSpeech,
  resumeAudioContextDiagnostic,
  setGuardianLiveWatchActive,
  stopBengaliSpeech,
  subscribeGuardianAudioStatus,
  subscribeMobileAudioUnlock,
  subscribePendingBlockedSpeech,
  subscribeSpeechPlayback,
} from '../utils/gatepassAudio';
import {
  GatepassRealtimeDiagnostics,
  RealtimeSyncHealth,
  RealtimeTransportMode,
} from '../hooks/useGatepassRealtime';

interface StudentPersonalDashboardProps {
  student: Student;
  portalId: string;
  latestChildAlarm: SecurityGatepassLog | null;
  guardianChildLogs: SecurityGatepassLog[];
  guardianAudioEnabled: boolean;
  setGuardianAudioEnabled: (val: boolean) => void;
  guardianAudioTested: boolean;
  isGuardianAlarmRinging: boolean;
  externalLiveRingingAlert?: { log: SecurityGatepassLog; message: string } | null;
  onDismissExternalRingingAlert?: () => void;
  realtimeTransport?: RealtimeTransportMode;
  realtimeSyncHealth?: RealtimeSyncHealth;
  onForceCheckRealtime?: () => Promise<{ foundCount: number; latestLog: SecurityGatepassLog | null }>;
  realtimeDiagnostics?: GatepassRealtimeDiagnostics;
  onSendDiagnosticPing?: () => Promise<number | null>;
  onReconnectRealtime?: () => void;
  onClearDiagnosticLogs?: () => void;
  ackSuccessFeedback: string | null;
  isSubmittingAck: boolean;
  guardianReplyText: string;
  setGuardianReplyText: (val: string) => void;
  onTestAudio: (playDemo?: boolean) => void;
  onStopAudio?: () => void;
  onReplayAlarm: (log: SecurityGatepassLog) => void;
  onAcknowledgeAlarm: (log: SecurityGatepassLog, customText?: string) => void;
  buildGuardianVoiceMessage: (student: Student, action: 'entry' | 'exit') => string;
  onLogout: () => void;
  isDeviceLocked?: boolean;
  onInstallLockedDashboard?: () => Promise<void> | void;
  onAdminUnlockDevice?: (adminPin: string) => Promise<boolean>;
  onUnlockDevice?: () => Promise<void> | void;
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
  externalLiveRingingAlert,
  onDismissExternalRingingAlert,
  realtimeTransport,
  realtimeSyncHealth,
  onForceCheckRealtime,
  realtimeDiagnostics,
  onSendDiagnosticPing,
  onReconnectRealtime,
  onClearDiagnosticLogs,
  ackSuccessFeedback,
  isSubmittingAck,
  guardianReplyText,
  setGuardianReplyText,
  onTestAudio,
  onStopAudio,
  onReplayAlarm,
  onAcknowledgeAlarm,
  buildGuardianVoiceMessage,
  onLogout,
  isDeviceLocked = false,
  onInstallLockedDashboard,
  onAdminUnlockDevice,
  onUnlockDevice,
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
    libraryMaterials,
    cloudUser,
  } = useSchool();

  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  const [mobileAudioUnlocked, setMobileAudioUnlocked] = useState<boolean>(() => isMobileAudioUnlocked());
  const [audioHardwareStatus, setAudioHardwareStatus] = useState<GuardianAudioHardwareStatus>(() =>
    getGuardianAudioStatus()
  );
  const [isVoiceCurrentlyPlaying, setIsVoiceCurrentlyPlaying] = useState<boolean>(false);
  const [pendingBlockedAlert, setPendingBlockedAlert] = useState<PendingBlockedSpeechAlert | null>(null);
  const [isManualChecking, setIsManualChecking] = useState<boolean>(false);
  const [manualCheckStatus, setManualCheckStatus] = useState<string | null>(null);
  const [copiedSameServerLink, setCopiedSameServerLink] = useState<boolean>(false);

  const currentServerHost = typeof window !== 'undefined' ? window.location.host : '';

  const handleCopySameServerLink = () => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/?tab=security&guardian=${encodeURIComponent(student.id)}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
    setCopiedSameServerLink(true);
    setTimeout(() => setCopiedSameServerLink(false), 2500);
  };

  const handleManualForceCheck = async () => {
    onTestAudio(false);
    if (!onForceCheckRealtime) return;
    setIsManualChecking(true);
    setManualCheckStatus(null);
    try {
      const prevLatestId = latestChildAlarm?.id || '';
      const result = await onForceCheckRealtime();
      if (result.latestLog && result.latestLog.id !== prevLatestId) {
        setManualCheckStatus('✓ নতুন গেটপাস বার্তা পাওয়া গেছে!');
      } else {
        setManualCheckStatus('✓ সর্বশেষ তথ্য হালনাগাদ হয়েছে');
      }
      setTimeout(() => setManualCheckStatus(null), 4000);
    } finally {
      setIsManualChecking(false);
    }
  };

  useEffect(() => {
    getSharedAudioContext();
    setAudioHardwareStatus(getGuardianAudioStatus());
    const unsubUnlock = subscribeMobileAudioUnlock(setMobileAudioUnlocked);
    const unsubHw = subscribeGuardianAudioStatus(setAudioHardwareStatus);
    const unsubPending = subscribePendingBlockedSpeech(setPendingBlockedAlert);
    const unsubSpeech = subscribeSpeechPlayback(setIsVoiceCurrentlyPlaying);
    return () => {
      unsubUnlock();
      unsubHw();
      unsubPending();
      unsubSpeech();
    };
  }, []);

  const [testAudioStatusNote, setTestAudioStatusNote] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const isHardwareAudioTrulyActive =
    guardianAudioEnabled &&
    (guardianAudioTested || mobileAudioUnlocked) &&
    audioHardwareStatus.audioContextState === 'running';

  const isServerSyncConnected =
    realtimeSyncHealth === 'verified_ws' ||
    realtimeSyncHealth === 'verified_sse' ||
    realtimeSyncHealth === 'verified_polling';

  const isServerBlockedOrMissing =
    realtimeSyncHealth === 'static_host' ||
    realtimeSyncHealth === 'auth_redirect' ||
    realtimeSyncHealth === 'unreachable';

  const isFullyReadyForLiveAlerts = isHardwareAudioTrulyActive && isServerSyncConnected;

  const handleTestNameVoiceClick = () => {
    onTestAudio(true);
    if (realtimeSyncHealth === 'static_host') {
      setTestAudioStatusNote({
        ok: false,
        text: `⚠ ${student.nameBn}-এর টেস্ট বাজানো হচ্ছে — তবে এই ডোমেইনে server.ts ব্যাকএন্ড না থাকায় /api/tts/bn পাওয়া যাচ্ছে না`,
      });
    } else {
      setTestAudioStatusNote({
        ok: true,
        text: `🔊 "${student.nameBn}"-এর নাম ধরে বাংলা ভয়েস মেসেজ টেস্ট চলছে...`,
      });
    }
    setTimeout(() => {
      setTestAudioStatusNote(null);
    }, 6500);
  };

  const [diagnosticFilter, setDiagnosticFilter] = useState<
    'all' | 'network' | 'signal' | 'audio' | 'issues'
  >('all');
  const [isDiagnosticPinging, setIsDiagnosticPinging] = useState<boolean>(false);
  const [isResumingAudioCtx, setIsResumingAudioCtx] = useState<boolean>(false);
  const [audioResumeFeedback, setAudioResumeFeedback] = useState<string | null>(null);
  const [copiedDiagnosticReport, setCopiedDiagnosticReport] = useState<boolean>(false);

  const handleDiagnosticPingClick = async () => {
    if (!onSendDiagnosticPing) return;
    setIsDiagnosticPinging(true);
    try {
      await onSendDiagnosticPing();
    } finally {
      setIsDiagnosticPinging(false);
    }
  };

  const handleDiagnosticResumeAudio = async () => {
    setIsResumingAudioCtx(true);
    setAudioResumeFeedback(null);
    try {
      if (!guardianAudioEnabled) {
        setGuardianAudioEnabled(true);
      }
      setGuardianLiveWatchActive(true);
      const result = await resumeAudioContextDiagnostic();
      setAudioHardwareStatus(result);
      onTestAudio(false);
      if (result.resumedOk) {
        setAudioResumeFeedback(
          `✓ '${result.previousState}' → 'running' (${result.latencyMs}ms)`
        );
      } else {
        setAudioResumeFeedback(
          `অবস্থা: '${result.audioContextState}'${result.lastPlaybackError ? ` (${result.lastPlaybackError})` : ''}`
        );
      }
    } finally {
      setIsResumingAudioCtx(false);
    }
  };

  const handleCopyDiagnosticReport = () => {
    if (typeof window === 'undefined' || !navigator.clipboard) return;
    const report = {
      capturedAt: new Date().toISOString(),
      studentNameBn: student.nameBn,
      portalId,
      host: window.location.host,
      wsReadyState: realtimeDiagnostics?.wsReadyState ?? 'UNINITIALIZED',
      realtimeTransport: realtimeTransport ?? 'connecting',
      realtimeSyncHealth: realtimeSyncHealth ?? 'connecting',
      lastSignalLatencyMs: realtimeDiagnostics?.lastSignalLatencyMs ?? null,
      lastScanLatencyMs: realtimeDiagnostics?.lastScanLatencyMs ?? null,
      lastPingRttMs: realtimeDiagnostics?.lastPingRttMs ?? null,
      clockOffsetMs: realtimeDiagnostics?.clockOffsetMs ?? null,
      audioContextState: audioHardwareStatus.audioContextState,
      audioUnlockedInSession: audioHardwareStatus.unlocked,
      liveWatchActive: audioHardwareStatus.liveWatchActive,
      wakeLockActive: audioHardwareStatus.wakeLockActive,
      lastEngineUsed: audioHardwareStatus.lastEngineUsed,
      lastPlaybackError: audioHardwareStatus.lastPlaybackError,
      notificationPermission: realtimeDiagnostics?.notificationPermission ?? 'unsupported',
      recentLogs: (realtimeDiagnostics?.logs || []).slice(0, 30),
    };
    navigator.clipboard.writeText(JSON.stringify(report, null, 2)).catch(() => {});
    setCopiedDiagnosticReport(true);
    setTimeout(() => setCopiedDiagnosticReport(false), 2500);
  };

  const [dashboardSection, setDashboardSection] = useState<
    | 'overview'
    | 'diagnostics'
    | 'digital_library'
    | 'academic_roadmap'
    | 'moner_bari'
    | 'icche_dana'
    | 'time_management'
    | 'future_plan'
    | 'achievements'
    | 'id_and_contact'
  >('overview');

  useEffect(() => {
    if (dashboardSection === 'diagnostics') {
      getSharedAudioContext();
      setAudioHardwareStatus(getGuardianAudioStatus());
    }
  }, [dashboardSection]);

  const classLibraryCount = useMemo(
    () => libraryMaterials.filter((m) => m.classId === 'all' || m.classId === student.classId).length,
    [libraryMaterials, student.classId]
  );

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

  const allTermResults = useMemo(() => {
    return examTerms
      .map((term) => {
        const classRes = getCalculatedResultsForClass(
          student.classId,
          student.section || '',
          term.id,
          student.academicYear || selectedYear || '২০২৬'
        );
        let found = classRes.find((r) => r.student.id === student.id) || null;
        if (!found) {
          const allSec = getCalculatedResultsForClass(
            student.classId,
            '',
            term.id,
            student.academicYear || selectedYear || '২০২৬'
          );
          found = allSec.find((r) => r.student.id === student.id) || null;
        }
        const hasMarks = Boolean(found && found.subjectRows.some((sr) => sr.totalObtained !== null));
        return found && hasMarks
          ? { termId: term.id, termName: term.nameBn, result: found }
          : null;
      })
      .filter((item): item is { termId: string; termName: string; result: CalculatedStudentResult } => Boolean(item));
  }, [examTerms, getCalculatedResultsForClass, student, selectedYear]);

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

  // Permanent Dashboard Install & Visual 'How to Install' Modal state
  const [showInstallLockModal, setShowInstallLockModal] = useState(false);
  const [showUnlockConfirmModal, setShowUnlockConfirmModal] = useState(false);
  const [adminUnlockPin, setAdminUnlockPin] = useState('');
  const [adminUnlockError, setAdminUnlockError] = useState<string | null>(null);
  const [showAdminUnlockBox, setShowAdminUnlockBox] = useState(false);
  const [customAppIconPreview, setCustomAppIconPreview] = useState<string>(
    student.avatarUrl || '/pwa-192x192.png'
  );

  React.useEffect(() => {
    let active = true;
    applyStudentPassportAppIcon(student).then((res) => {
      if (active && res.previewIconUrl) {
        setCustomAppIconPreview(res.previewIconUrl);
      }
    });
    return () => {
      active = false;
    };
  }, [student]);

  const handleInstallDashboardClick = async () => {
    const isFirstClick =
      typeof window !== 'undefined' &&
      localStorage.getItem('dlikon_pwa_install_guide_seen') !== '1';

    // Ensure student's passport photo PNG icon & manifest are active before native prompt
    void applyStudentPassportAppIcon(student);

    // Trigger browser PWA prompt immediately within the click gesture
    const installPromise = isInstallable ? install() : Promise.resolve(false);
    const lockPromise = onInstallLockedDashboard
      ? Promise.resolve(onInstallLockedDashboard())
      : Promise.resolve();

    const [accepted] = await Promise.all([installPromise, lockPromise]);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('dlikon_pwa_install_guide_seen', '1');
      } catch {
        // Ignore storage write error
      }
    }

    // Open the visual Android & iOS 'How to Install' modal on first click, or when manual instructions are needed
    if (isFirstClick || (!accepted && !isInstalled)) {
      setShowInstallLockModal(true);
    }
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
          {/* Left: Passport Photo + Moner Bari / Icche Dana beside Photo + Student Identity */}
          <div className="flex flex-col sm:flex-row sm:items-start gap-5 flex-1 min-w-0">
            <div className="flex items-start gap-3.5 shrink-0">
              {/* Student Official Passport-Size Photo (Managed Exclusively by School Office / Developer Station) */}
              <div className="w-28 h-34 sm:w-32 sm:h-38 rounded-xl border-2 border-amber-400/90 bg-slate-900 overflow-hidden shadow-md flex items-center justify-center shrink-0">
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
                    <span className="text-[11px] font-medium text-slate-300 leading-tight">
                      অফিস থেকে ছবি সংযুক্ত হবে
                    </span>
                  </div>
                )}
              </div>

              {/* Right beside the passport photo: মনের বাড়ি ও ইচ্ছে ডানা */}
              <div className="flex flex-col gap-2.5 justify-center self-center">
                <button
                  type="button"
                  onClick={() => setDashboardSection('moner_bari')}
                  className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap shadow-sm border ${
                    dashboardSection === 'moner_bari'
                      ? 'bg-emerald-400 text-slate-950 border-emerald-300'
                      : 'bg-emerald-950/90 hover:bg-emerald-900 text-emerald-100 border-emerald-500/50'
                  }`}
                >
                  <Home className="w-4 h-4 shrink-0" />
                  <span>মনের বাড়ি</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDashboardSection('icche_dana')}
                  className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap shadow-sm border ${
                    dashboardSection === 'icche_dana'
                      ? 'bg-amber-400 text-slate-950 border-amber-300'
                      : 'bg-indigo-900/90 hover:bg-indigo-800 text-amber-200 border-amber-400/50'
                  }`}
                >
                  <Rocket className="w-4 h-4 shrink-0" />
                  <span>ইচ্ছে ডানা</span>
                </button>
              </div>
            </div>

            <div className="space-y-2.5 min-w-0">
              {/* Quiet metadata line (Zero-pill discipline) */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-amber-300 font-medium">
                <span>ব্যক্তিগত শিক্ষার্থী ও অভিভাবক ড্যাশবোর্ড</span>
                <span aria-hidden="true" className="text-slate-500">·</span>
                <span className="font-mono tabular-nums text-emerald-300">
                  আইডি: {portalId}
                </span>
                <span aria-hidden="true" className="text-slate-500">·</span>
                <span className="text-emerald-300 font-semibold">
                  {isDeviceLocked ? 'স্থায়ী ডিভাইস লক সক্রিয়' : 'সাইন-ইন সক্রিয়'}
                </span>
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
                  {isDeviceLocked
                    ? `এই ফোনটি স্থায়ীভাবে ${student.nameBn}-এর ড্যাশবোর্ডের সাথে যুক্ত। গেট স্ক্যান হলেই সরাসরি ভয়েস এলার্ম আসবে।`
                    : `আপনি সাইন-ইন থাকা অবস্থায় শুধুমাত্র ${student.nameBn}-এর গেটপাস নোটিফিকেশন ও অডিও এলার্ম পাবেন।`}
                </span>
              </p>
            </div>
          </div>

          {/* Right: Voice Alarm & Permanent Dashboard Install Actions */}
          <div className="flex flex-wrap lg:flex-col items-stretch lg:items-end justify-between gap-2.5 shrink-0 border-t lg:border-t-0 lg:border-l border-slate-800 pt-4 lg:pt-0 lg:pl-6">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onTestAudio(false)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
                  isGuardianAlarmRinging
                    ? 'bg-rose-600 text-white'
                    : isServerBlockedOrMissing
                    ? 'bg-rose-500 hover:bg-rose-400 text-white'
                    : isFullyReadyForLiveAlerts
                    ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950'
                    : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                }`}
              >
                <BellRing className="w-4 h-4" />
                <span>
                  {isGuardianAlarmRinging
                    ? 'লাইভ এলার্ম বাজছে!'
                    : realtimeSyncHealth === 'static_host'
                    ? 'ব্যাকএন্ড সার্ভার নেই!'
                    : realtimeSyncHealth === 'auth_redirect'
                    ? 'সেশন ব্লক — রিলোড দিন'
                    : realtimeSyncHealth === 'unreachable'
                    ? 'সার্ভার সংযোগ বিচ্ছিন্ন!'
                    : isFullyReadyForLiveAlerts
                    ? 'ভয়েস ও এলার্ম সক্রিয় (লাইভ)'
                    : isHardwareAudioTrulyActive
                    ? 'স্পিকার প্রস্তুত · সার্ভার যুক্ত হচ্ছে...'
                    : 'ভয়েস এলার্ম চালু করুন'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleTestNameVoiceClick}
                className="px-3 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-amber-200 border border-slate-700 transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                title="আপনার সন্তানের নাম ধরে বাংলা ভয়েস এলার্ম টেস্ট শুনুন"
              >
                <Volume2 className="w-3.5 h-3.5 text-amber-300" />
                <span>টেস্ট (নাম ধরে)</span>
              </button>
            </div>

            <div className="w-full lg:w-auto flex flex-wrap items-center justify-start lg:justify-end gap-x-2.5 gap-y-1 text-[10.5px] font-mono text-slate-300">
              <span>
                সার্ভার:{' '}
                <strong className="text-slate-100">{currentServerHost || 'local'}</strong>
              </span>
              <span className="text-slate-600">·</span>
              <span>
                ইনস্ট্যান্স:{' '}
                <strong className={realtimeDiagnostics?.serverInstanceId ? 'text-amber-300' : 'text-rose-300'}>
                  {realtimeDiagnostics?.serverInstanceId || 'নেই'}
                </strong>
              </span>
              <span className="text-slate-600">·</span>
              <span
                className={
                  realtimeDiagnostics?.wsReadyState === 'OPEN'
                    ? 'text-emerald-300 font-bold'
                    : isServerSyncConnected
                    ? 'text-amber-300 font-bold'
                    : 'text-rose-300 font-bold'
                }
              >
                {realtimeDiagnostics?.wsReadyState === 'OPEN'
                  ? 'WS: OPEN'
                  : realtimeTransport === 'sse'
                  ? 'SSE: LIVE'
                  : realtimeTransport === 'polling'
                  ? 'POLL: LIVE'
                  : `WS: ${realtimeDiagnostics?.wsReadyState || 'CONNECTING'}`}
              </span>
            </div>

            {testAudioStatusNote && (
              <div
                className={`w-full lg:max-w-sm px-2.5 py-1.5 rounded-lg text-[11px] font-medium border ${
                  testAudioStatusNote.ok
                    ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
                    : 'bg-rose-950/90 border-rose-500/60 text-rose-200'
                }`}
              >
                {testAudioStatusNote.text}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleInstallDashboardClick}
                aria-label="Install App"
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                  isInstalled
                    ? 'bg-emerald-700/80 border-emerald-400 text-white'
                    : isDeviceLocked
                    ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400 text-white'
                    : 'bg-emerald-500 hover:bg-emerald-400 border-emerald-400 text-slate-950'
                }`}
              >
                {student.avatarUrl ? (
                  <img
                    src={customAppIconPreview}
                    alt=""
                    className="w-4 h-4 rounded object-cover border border-amber-300 shrink-0"
                  />
                ) : isInstalled ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <Smartphone className="w-3.5 h-3.5" />
                )}
                <span>
                  {isInstalled
                    ? 'অ্যাপ ইনস্টল সম্পন্ন'
                    : isInstallable
                    ? 'Install App · ড্যাশবোর্ড ইনস্টল'
                    : isDeviceLocked
                    ? 'ছবিসহ হোম আইকন সেট করুন'
                    : 'Install App · ড্যাশবোর্ড ইনস্টল'}
                </span>
              </button>

              {isDeviceLocked && onUnlockDevice ? (
                <button
                  type="button"
                  onClick={() => setShowUnlockConfirmModal(true)}
                  className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 border border-amber-300 text-slate-950 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>লক সরান / অন্য শিক্ষার্থী</span>
                </button>
              ) : !isDeviceLocked ? (
                <button
                  type="button"
                  onClick={onLogout}
                  className="px-3.5 py-2 bg-slate-800/80 hover:bg-rose-950/90 hover:text-rose-200 border border-slate-700 hover:border-rose-700/60 text-slate-200 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>সাইন আউট</span>
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Clean Segmented Sub-Navigation */}
        <div className="bg-slate-900/90 border-t border-slate-800 px-4 sm:px-7 py-2.5 flex items-center gap-2 overflow-x-auto">
          {[
            { id: 'overview' as const, label: 'পড়াশোনা ও প্রগ্রেস', icon: TrendingUp },
            {
              id: 'diagnostics' as const,
              label: 'সংযোগ ও অডিও ডায়াগনস্টিক',
              icon: Activity,
            },
            {
              id: 'digital_library' as const,
              label: `ডিজিটাল লাইব্রেরি (${toBengaliNumber(classLibraryCount)})`,
              icon: Library,
            },
            { id: 'academic_roadmap' as const, label: 'একাডেমিক রোডম্যাপ', icon: MapIcon },
            { id: 'moner_bari' as const, label: 'মনের বাড়ি', icon: Home },
            { id: 'icche_dana' as const, label: 'ইচ্ছে ডানা', icon: Rocket },
            { id: 'time_management' as const, label: 'সময় ব্যবস্থাপনা ও রুটিন', icon: Clock },
            { id: 'future_plan' as const, label: 'ভবিষ্যৎ পরিকল্পনা', icon: Compass },
            {
              id: 'achievements' as const,
              label: `ব্যাজ ও কৃতিত্ব (${toBengaliNumber(achievementsList.length)})`,
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

      {/* Top-Level Critical Backend / Session Alert (Always visible across ALL dashboard tabs) */}
      {isServerBlockedOrMissing && (
        <div className="bg-rose-950 text-white rounded-2xl p-4 border-2 border-rose-500 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 text-xs">
            <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-sm text-amber-200">
                {realtimeSyncHealth === 'static_host'
                  ? 'সতর্কতা: এই ঠিকানায় Node ব্যাকএন্ড সার্ভার (server.ts) চালু নেই!'
                  : realtimeSyncHealth === 'auth_redirect'
                  ? 'সতর্কতা: এই ব্রাউজারে সার্ভার সিগন্যাল সেশন/অথেনটিকেশনে আটকে আছে!'
                  : 'সতর্কতা: কেন্দ্রীয় গেটপাস সার্ভারের সাথে এই ফোনের সংযোগ বিচ্ছিন্ন!'}
              </div>
              <p className="text-rose-100 leading-relaxed">
                {realtimeSyncHealth === 'static_host'
                  ? `ডোমেইন (${currentServerHost}) কেবল স্ট্যাটিক HTML চালাচ্ছে — তাই স্কুলে আইডিকার্ড স্ক্যান করলে এই ফোনে কোনো মেসেজ বা ভয়েস পৌঁছাবে না। অনুগ্রহ করে স্কুলের ফুল-স্ট্যাক Node সার্ভার URL দিয়ে ওপেন করুন।`
                  : realtimeSyncHealth === 'auth_redirect'
                  ? `ডোমেইন (${currentServerHost}) লগইন রিডাইরেক্ট দিচ্ছে। পেজটি রিলোড করুন অথবা অফিসিয়াল স্ক্যানারের একই Shared URL খুলুন।`
                  : `এই মুহূর্তে (${currentServerHost}) সার্ভার থেকে লাইভ সিগন্যাল আসছে না। ইন্টারনেট যাচাই করে পুনরায় সংযোগ দিন।`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onReconnectRealtime && (
              <button
                type="button"
                onClick={onReconnectRealtime}
                className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-950 font-bold text-xs rounded-xl cursor-pointer"
              >
                পুনরায় সংযোগ দিন
              </button>
            )}
            <button
              type="button"
              onClick={() => setDashboardSection('diagnostics')}
              className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl cursor-pointer"
            >
              ডায়াগনস্টিক দেখুন
            </button>
          </div>
        </div>
      )}

      {/* Active Voice Playing Banner OR Pending Autoplay-Blocked Voice Alert */}
      {(isVoiceCurrentlyPlaying || isGuardianAlarmRinging || Boolean(externalLiveRingingAlert)) &&
        (externalLiveRingingAlert?.log || latestChildAlarm) &&
        !pendingBlockedAlert && (() => {
          const activeLog = externalLiveRingingAlert?.log || latestChildAlarm!;
          const activeMsg =
            externalLiveRingingAlert?.message || buildGuardianVoiceMessage(student, activeLog.action);
          return (
            <div className="bg-emerald-950 text-white rounded-2xl p-4 sm:p-5 shadow-lg border-2 border-emerald-400 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-sm sm:text-base font-bold text-emerald-300 flex items-center gap-2">
                  <Volume2 className="w-5 h-5 text-amber-300 shrink-0 animate-pulse" />
                  <span>লাইভ ভয়েস এলার্ম বাজছে — {student.nameBn}</span>
                </div>
                <p className="text-xs sm:text-sm text-emerald-50 leading-relaxed">
                  {activeMsg}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onReplayAlarm(activeLog)}
                  className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Volume2 className="w-4 h-4 text-amber-300" />
                  <span>পুনরায় শুনুন</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopBengaliSpeech();
                    onStopAudio?.();
                    onDismissExternalRingingAlert?.();
                    if (!activeLog.guardianAcknowledged) {
                      onAcknowledgeAlarm(activeLog, 'মেসেজ শুনেছি ও নিশ্চিত করলাম');
                    }
                  }}
                  className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs sm:text-sm rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <CheckCheck className="w-4 h-4" />
                  <span>শুনেছি ও এলার্ম থামান ✓</span>
                </button>
              </div>
            </div>
          );
        })()}

      {pendingBlockedAlert && (
        <div className="bg-rose-600 text-white rounded-2xl p-4 sm:p-5 shadow-md border-2 border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="text-sm sm:text-base font-bold flex items-center gap-2">
              <BellRing className="w-5 h-5 text-amber-300 shrink-0" />
              <span>নতুন গেটপাস ভয়েস মেসেজ এসেছে — শুনতে ট্যাপ করুন</span>
            </div>
            <p className="text-xs sm:text-sm text-rose-50 leading-relaxed">{pendingBlockedAlert.message}</p>
          </div>
          <button
            type="button"
            onClick={() => replayPendingBlockedSpeech()}
            className="px-4 py-2.5 bg-amber-300 hover:bg-amber-200 text-slate-950 font-black text-xs sm:text-sm rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shrink-0 shadow-sm"
          >
            <Volume2 className="w-4 h-4" />
            <span>এখনই ভয়েস শুনুন (নাম ধরে)</span>
          </button>
        </div>
      )}

      {/* One-Tap Mobile Audio Unlock Prompt (shown until hardware AudioContext is truly running) */}
      {!isHardwareAudioTrulyActive && guardianAudioEnabled && !pendingBlockedAlert && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-2.5 text-xs sm:text-sm text-amber-950">
            <Volume2 className="w-5 h-5 text-amber-700 shrink-0 mt-0.5 sm:mt-0" />
            <span>
              <strong>অটোমেটিক গেটপাস ভয়েস এলার্ম:</strong> স্কুলের গেটে আইডি কার্ড স্ক্যান হওয়া মাত্রই এই ফোনে সরাসরি {student.nameBn}-এর নাম ধরে বাংলা ভয়েস মেসেজ শুনতে নিচের বাটনে একবার ট্যাপ করুন।
            </span>
          </div>
          <button
            type="button"
            onClick={() => onTestAudio(false)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition cursor-pointer whitespace-nowrap self-start sm:self-auto"
          >
            ভয়েস এলার্ম সক্রিয় করুন
          </button>
        </div>
      )}

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

          {/* Upcoming Exam Countdown Widget (pulled from Academic Calendar) */}
          <ExamCountdownWidget
            calendarEvents={calendarEvents}
            studentClassId={student.classId}
            classNameBn={classNameBn}
            syllabusCount={classSyllabi.length}
            onOpenTimeManagement={() => setDashboardSection('time_management')}
          />

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

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestNameVoiceClick}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  title="আপনার সন্তানের নাম ধরে গেটপাস ভয়েস মেসেজ টেস্ট শুনুন"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>টেস্ট (নাম ধরে)</span>
                </button>
                {onForceCheckRealtime && (
                  <button
                    type="button"
                    disabled={isManualChecking}
                    onClick={handleManualForceCheck}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    title="সার্ভার থেকে তাৎক্ষণিক নতুন গেটপাস স্ক্যান পরীক্ষা করুন"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isManualChecking ? 'animate-spin' : ''}`} />
                    <span>{isManualChecking ? 'চেক হচ্ছে...' : 'এখনই চেক'}</span>
                  </button>
                )}
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
                <span
                  className={`text-xs font-medium flex items-center gap-1.5 ${
                    realtimeSyncHealth === 'static_host' ||
                    realtimeSyncHealth === 'auth_redirect' ||
                    realtimeSyncHealth === 'unreachable'
                      ? 'text-rose-300'
                      : realtimeSyncHealth === 'connecting' ||
                        (!realtimeSyncHealth && (!realtimeTransport || realtimeTransport === 'connecting'))
                      ? 'text-amber-300'
                      : 'text-emerald-300'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>
                    {realtimeSyncHealth === 'static_host'
                      ? 'ব্যাকএন্ড সার্ভার নেই (Static)'
                      : realtimeSyncHealth === 'auth_redirect'
                      ? 'সেশন যাচাই প্রয়োজন'
                      : realtimeSyncHealth === 'unreachable'
                      ? 'সার্ভার সংযোগ বিচ্ছিন্ন'
                      : realtimeSyncHealth === 'verified_ws'
                      ? 'লাইভ সিঙ্ক সক্রিয় (WS)'
                      : realtimeSyncHealth === 'verified_sse'
                      ? 'লাইভ সিঙ্ক সক্রিয় (SSE)'
                      : realtimeSyncHealth === 'verified_polling'
                      ? 'লাইভ সিঙ্ক সক্রিয় (Poll)'
                      : !realtimeTransport || realtimeTransport === 'connecting'
                      ? 'লাইভ সংযোগ যুক্ত হচ্ছে...'
                      : 'লাইভ সিঙ্ক সক্রিয়'}
                  </span>
                </span>
              </div>
            </div>

            {(realtimeSyncHealth === 'static_host' ||
              realtimeSyncHealth === 'auth_redirect' ||
              realtimeSyncHealth === 'unreachable') && (
              <div className="px-3.5 py-2.5 bg-rose-950/90 border border-rose-500/70 text-rose-100 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-start sm:items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5 sm:mt-0" />
                  <span>
                    {realtimeSyncHealth === 'static_host'
                      ? 'সতর্কতা: এই হোস্টিং ডোমেইনে Node ব্যাকএন্ড সার্ভার (server.ts) চালু নেই, কেবল স্ট্যাটিক HTML ফাইল চলছে। তাই অন্য ফোনে স্ক্যান করলে এলার্ম এখানে আসবে না।'
                      : realtimeSyncHealth === 'auth_redirect'
                      ? 'এই ব্রাউজারে সার্ভার সিগন্যাল আটকে আছে (সেশন/গুগল ভেরিফিকেশন প্রয়োজন)। পেজ রিলোড করে পুনরায় সংযোগ দিন, নতুবা গেট স্ক্যানের এলার্ম আসবে না।'
                      : 'এই মুহূর্তে কেন্দ্রীয় সার্ভারের সাথে সংযোগ পাওয়া যাচ্ছে না। ইন্টারনেট বা একই সার্ভার ঠিকানা যাচাই করুন।'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      window.location.reload();
                    }
                  }}
                  className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-lg text-xs cursor-pointer shrink-0 self-start sm:self-auto"
                >
                  পুনরায় সংযোগ দিন (Reload)
                </button>
              </div>
            )}

            {manualCheckStatus && (
              <div className="px-3 py-2 bg-indigo-950/80 border border-indigo-500/50 text-indigo-200 rounded-xl text-xs font-semibold">
                {manualCheckStatus}
              </div>
            )}

            <div className="text-[11px] text-slate-300 bg-slate-950/50 border border-slate-800 rounded-lg px-3 py-2.5 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="inline-flex items-center gap-1.5 font-mono">
                    <span className="text-slate-400">audioContext.state:</span>
                    <strong
                      className={`px-2 py-0.5 rounded border text-[11px] font-bold ${
                        audioHardwareStatus.audioContextState === 'running'
                          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
                          : audioHardwareStatus.audioContextState === 'suspended'
                          ? 'bg-amber-950/80 text-amber-300 border-amber-500/50'
                          : 'bg-rose-950/80 text-rose-300 border-rose-500/50'
                      }`}
                    >
                      '{audioHardwareStatus.audioContextState}'
                    </strong>
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono">
                    <span className="text-slate-400">WS:</span>
                    <strong
                      className={`px-1.5 py-0.5 rounded border text-[10.5px] font-bold ${
                        realtimeDiagnostics?.wsReadyState === 'OPEN'
                          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
                          : realtimeTransport === 'sse' || realtimeTransport === 'polling'
                          ? 'bg-amber-950/80 text-amber-300 border-amber-500/50'
                          : 'bg-rose-950/80 text-rose-300 border-rose-500/50'
                      }`}
                    >
                      {realtimeDiagnostics?.wsReadyState || 'CONNECTING'}
                    </strong>
                  </span>
                  {realtimeDiagnostics?.serverInstanceId && (
                    <span className="inline-flex items-center gap-1 font-mono text-slate-300">
                      <span className="text-slate-400">ইনস্ট্যান্স:</span>
                      <strong className="text-amber-300">{realtimeDiagnostics.serverInstanceId}</strong>
                    </span>
                  )}
                  {audioResumeFeedback && (
                    <span className="font-mono text-[10.5px] text-emerald-300">
                      {audioResumeFeedback}
                    </span>
                  )}
                  {currentServerHost && (
                    <span className="text-slate-400 font-mono truncate max-w-xs sm:max-w-sm">
                      সার্ভার: <strong className="text-slate-200">{currentServerHost}</strong>
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={isResumingAudioCtx}
                    onClick={handleDiagnosticResumeAudio}
                    className={`px-2.5 py-1 rounded-md text-[10.5px] font-bold font-mono flex items-center gap-1 cursor-pointer transition border ${
                      audioHardwareStatus.audioContextState === 'running'
                        ? 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-200 border-emerald-500/60'
                        : 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-300'
                    }`}
                    title="AudioContext.resume() সরাসরি কল করে অডিও আনলক যাচাই করুন"
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>
                      {isResumingAudioCtx
                        ? 'Resuming...'
                        : audioHardwareStatus.audioContextState === 'running'
                        ? 'AudioContext.resume() ✓'
                        : 'Force-Unlock: AudioContext.resume()'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDashboardSection('diagnostics')}
                    className="px-2.5 py-1 rounded-md text-[10.5px] font-bold flex items-center gap-1 cursor-pointer transition bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700"
                  >
                    <Activity className="w-3 h-3" />
                    <span>ডায়াগনস্টিক লগ</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopySameServerLink}
                    className={`px-2.5 py-1 rounded-md text-[10.5px] font-bold flex items-center gap-1 cursor-pointer transition ${
                      copiedSameServerLink
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700'
                    }`}
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedSameServerLink ? 'লিংক কপি ✓' : 'লিংক কপি'}</span>
                  </button>
                </div>
              </div>
              {currentServerHost.startsWith('ais-dev-') && (
                <div className="text-[10.5px] text-amber-200/90 border-t border-slate-800/80 pt-1.5">
                  নোট: দুই ফোনে রিয়েল-টাইম ভয়েস পেতে স্ক্যানার ফোন ও অভিভাবক ফোন দুটোতেই একই <span className="font-mono font-bold">Shared App URL (ais-pre-...)</span> অথবা একই <span className="font-mono font-bold">ইনস্ট্যান্স আইডি</span> খোলা থাকতে হবে (কোড আপডেটের পর Shared App পুনরায় শেয়ার/পাবলিশ করুন)।
                </div>
              )}
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

                  <div className="flex flex-wrap items-center gap-2">
                    {isVoiceCurrentlyPlaying && (
                      <button
                        type="button"
                        onClick={() => {
                          stopBengaliSpeech();
                          if (onStopAudio) onStopAudio();
                        }}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <VolumeX className="w-4 h-4" />
                        <span>থামান</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onReplayAlarm(latestChildAlarm)}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <Volume2 className="w-4 h-4 text-amber-300" />
                      <span>নাম ধরে শুনুন (৬ বার)</span>
                    </button>
                  </div>
                </div>

                <p className="text-sm sm:text-base text-slate-100 leading-relaxed bg-slate-900 p-4 rounded-xl border border-slate-800">
                  {buildGuardianVoiceMessage(student, latestChildAlarm.action)}
                </p>

                {latestChildAlarm.studentEtiquetteReply && (
                  <div className="px-3.5 py-2 bg-emerald-950/50 border border-emerald-600/40 rounded-lg text-xs text-emerald-200 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      বিদ্যালয় গেটে শিষ্টাচার অনুশীলন: {student.nameBn} সালামের জবাবে বলেছে "{latestChildAlarm.studentEtiquetteReply}"
                    </span>
                  </div>
                )}

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
                  onClick={() => onTestAudio(true)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap self-start sm:self-auto"
                >
                  ডেমো ভয়েস টেস্ট
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
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-slate-500">আসন্ন একাডেমিক সূচি ও সিলেবাস</div>
                  <button
                    type="button"
                    onClick={() => setDashboardSection('academic_roadmap')}
                    className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 cursor-pointer whitespace-nowrap"
                  >
                    একাডেমিক রোডম্যাপ →
                  </button>
                </div>
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

          {/* Virtual Badges & Performance Recognition Showcase */}
          <StudentBadgesPanel
            student={student}
            allTermResults={allTermResults}
            attendanceMetrics={attendanceMetrics}
            latestTermResult={termResult}
            variant="summary"
            onViewAllBadges={() => setDashboardSection('achievements')}
          />
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
      {/* SECTION 3: VIRTUAL BADGES & ACHIEVEMENT MEMORIES GALLERY            */}
      {/* =================================================================== */}
      {dashboardSection === 'achievements' && (
        <div className="space-y-6">
          <StudentBadgesPanel
            student={student}
            allTermResults={allTermResults}
            attendanceMetrics={attendanceMetrics}
            latestTermResult={termResult}
            variant="full"
          />

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
      {/* SECTION 5: MONER BARI (মনের বাড়ি — আত্মবিশ্বাস ও মনন চর্চা)        */}
      {/* =================================================================== */}
      {dashboardSection === 'moner_bari' && (
        <MonerBariView
          student={student}
          dreamCareer={existingPlan.dreamCareer}
          dailyStudyHoursGoal={existingPlan.dailyStudyHoursGoal}
          onSaveMonerBari={(nextData) =>
            updateStudent({
              ...student,
              monerBari: nextData,
            })
          }
          onOpenIccheDana={() => setDashboardSection('icche_dana')}
        />
      )}

      {/* =================================================================== */}
      {/* SECTION 1B: DIGITAL LIBRARY (ডিজিটাল লাইব্রেরি — বই ও পিডিএফ ডাউনলোড) */}
      {/* =================================================================== */}
      {dashboardSection === 'digital_library' && (
        <DigitalLibraryView
          mode="student"
          defaultClassId={student.classId}
          embedded
        />
      )}

      {/* =================================================================== */}
      {/* SECTION 6: ICCHE DANA (ইচ্ছে ডানা — AI স্বপ্নের ফটো গ্যালারি)       */}
      {/* =================================================================== */}
      {dashboardSection === 'icche_dana' && (
        <EcheDanaGallery
          student={student}
          classNameBn={classNameBn}
          schoolName={schoolInfo.name || 'ডি-লিকন মডেল একাডেমী'}
          dreamCareer={existingPlan.dreamCareer}
          dailyStudyHoursGoal={existingPlan.dailyStudyHoursGoal}
          planSaveNotice={planSaveNotice}
          onSelectDreamCareer={(careerTag) =>
            saveFuturePlan(
              { ...existingPlan, dreamCareer: careerTag },
              `✓ "${careerTag}" আপনার প্রধান স্বপ্ন হিসেবে সেট হয়েছে!`
            )
          }
          onOpenMonerBari={() => setDashboardSection('moner_bari')}
        />
      )}

      {/* =================================================================== */}
      {/* SECTION 7: TIME MANAGEMENT (সময় ব্যবস্থাপনা ও দৈনিক রুটিন)         */}
      {/* =================================================================== */}
      {dashboardSection === 'time_management' && (
        <TimeManagementView
          student={student}
          dailyStudyHoursGoal={existingPlan.dailyStudyHoursGoal}
          onSaveTimeManagement={(nextData) =>
            updateStudent({
              ...student,
              timeManagement: nextData,
            })
          }
          onOpenMonerBari={() => setDashboardSection('moner_bari')}
          onOpenIccheDana={() => setDashboardSection('icche_dana')}
        />
      )}

      {/* =================================================================== */}
      {/* SECTION 8: ACADEMIC MILESTONE ROADMAP (সিলেবাস ও পাঠ্যক্রম রোডম্যাপ) */}
      {/* =================================================================== */}
      {dashboardSection === 'academic_roadmap' && (
        <AcademicMilestoneRoadmap
          student={student}
          classNameBn={classNameBn}
          subjects={classObj?.defaultSubjects || []}
          examTerms={examTerms}
          syllabi={classSyllabi}
          onSaveRoadmap={(nextData) =>
            updateStudent({
              ...student,
              academicRoadmap: nextData,
            })
          }
          onOpenTimeManagement={() => setDashboardSection('time_management')}
        />
      )}

      {/* =================================================================== */}
      {/* SECTION 9: REAL-TIME DIAGNOSTIC LOG PAGE                            */}
      {/* =================================================================== */}
      {dashboardSection === 'diagnostics' && (() => {
        const wsState = realtimeDiagnostics?.wsReadyState ?? 'UNINITIALIZED';
        const audioCtxState = audioHardwareStatus.audioContextState;
        const latencyMs = realtimeDiagnostics?.lastSignalLatencyMs ?? null;
        const allLogs = realtimeDiagnostics?.logs || [];

        const filteredLogs = allLogs.filter((entry) => {
          if (diagnosticFilter === 'network') {
            return entry.source === 'WS' || entry.source === 'SSE' || entry.source === 'POLL';
          }
          if (diagnosticFilter === 'signal') {
            return entry.source === 'SIGNAL' || entry.source === 'TRIGGER' || entry.source === 'BC';
          }
          if (diagnosticFilter === 'audio') {
            return entry.source === 'AUDIO';
          }
          if (diagnosticFilter === 'issues') {
            return entry.level === 'warn' || entry.level === 'error';
          }
          return true;
        });

        const wsStatusHealthy = wsState === 'OPEN';
        const fallbackActive =
          !wsStatusHealthy &&
          (realtimeSyncHealth === 'verified_sse' || realtimeSyncHealth === 'verified_polling');
        const audioCtxRunning = audioCtxState === 'running';
        const isLatencySlow = typeof latencyMs === 'number' && latencyMs > 1500;

        const formatPreciseTime = (ms: number | null | undefined) => {
          if (!ms) return '—';
          const d = new Date(ms);
          const hh = String(d.getHours()).padStart(2, '0');
          const mm = String(d.getMinutes()).padStart(2, '0');
          const ss = String(d.getSeconds()).padStart(2, '0');
          const millis = String(d.getMilliseconds()).padStart(3, '0');
          return `${hh}:${mm}:${ss}.${millis}`;
        };

        return (
          <div className="space-y-5">
            {/* Top Diagnostic Header Bar */}
            <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-sky-300 font-medium">
                  <Terminal className="w-4 h-4 shrink-0" />
                  <span>অভিভাবক ডিভাইস রিয়েল-টাইম ডায়াগনস্টিক</span>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span className="font-mono tabular-nums text-slate-300">
                    আইডি: {portalId}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold font-serif text-white">
                  সংযোগ অবস্থা, সিগন্যাল ল্যাটেন্সি ও অডিও ডায়াগনস্টিক লগ
                </h3>
                <p className="text-xs text-slate-300">
                  স্ক্যান করার পর ভয়েস এলার্ম না বাজলে নিচের ৩টি লাইভ মিটার ও ইভেন্ট লগ থেকে তাৎক্ষণিক কারণ শনাক্ত করুন।
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={isResumingAudioCtx}
                  onClick={handleDiagnosticResumeAudio}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold font-mono transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    audioCtxRunning
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                      : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                  }`}
                >
                  <Volume2 className="w-4 h-4" />
                  <span>
                    {isResumingAudioCtx
                      ? 'Running AudioContext.resume()...'
                      : audioCtxRunning
                      ? "AudioContext.resume() ('running') ✓"
                      : "Force-Unlock: AudioContext.resume()"}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={isDiagnosticPinging || !onSendDiagnosticPing}
                  onClick={handleDiagnosticPingClick}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isDiagnosticPinging ? 'animate-spin' : ''}`} />
                  <span>{isDiagnosticPinging ? 'পিং চলছে...' : 'পিং ও ল্যাটেন্সি টেস্ট'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyDiagnosticReport}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  {copiedDiagnosticReport ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-slate-300" />
                  )}
                  <span>{copiedDiagnosticReport ? 'রিপোর্ট কপি ✓' : 'রিপোর্ট কপি'}</span>
                </button>
              </div>
            </div>

            {audioResumeFeedback && (
              <div className="px-4 py-2.5 bg-slate-900 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-mono flex items-center justify-between gap-2">
                <span>AudioContext.resume() ফলাফল: {audioResumeFeedback}</span>
                <span className="text-slate-300">audioContext.state = '{audioCtxState}'</span>
              </div>
            )}

            {/* Automated Plain-Language Root-Cause Callout */}
            {realtimeSyncHealth === 'static_host' ? (
              <div className="bg-rose-50 border border-rose-300 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-950">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="font-bold text-sm">কারণ শনাক্ত: এই হোস্টিংয়ে ব্যাকএন্ড সার্ভার (server.ts) চালু নেই</div>
                    <p className="leading-relaxed">
                      <span className="font-mono">/api/security/*</span> কল করলে সার্ভারের বদলে স্ট্যাটিক HTML পেজ পাওয়া যাচ্ছে। Vercel/Netlify/GitHub Pages-এর মতো স্ট্যাটিক হোস্টিংয়ে কেবল ফ্রন্টএন্ড চলে, ক্রস-ডিভাইস সিগন্যাল যায় না — অনুগ্রহ করে ফুল-স্ট্যাক Node সার্ভারে (Render / Railway / Cloud Run / VPS) হোস্ট করুন।
                    </p>
                  </div>
                </div>
              </div>
            ) : realtimeSyncHealth === 'auth_redirect' ? (
              <div className="bg-rose-50 border border-rose-300 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-950">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="font-bold text-sm">কারণ শনাক্ত: সার্ভার সিগন্যাল লগইন রিডাইরেক্টে আটকে আছে</div>
                    <p className="leading-relaxed">
                      এই ব্রাউজার থেকে API/WebSocket অনুরোধ অথেনটিকেশন পেজে রিডাইরেক্ট হচ্ছে। পেজটি একবার রিলোড করুন অথবা অফিসিয়াল স্ক্যানারের একই লিংকে খুলুন।
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined') window.location.reload();
                  }}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shrink-0 cursor-pointer"
                >
                  রিলোড করুন
                </button>
              </div>
            ) : !audioCtxRunning ? (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="font-bold text-sm">
                      কারণ শনাক্ত: AudioContext বর্তমানে <span className="font-mono">'{audioCtxState}'</span> অবস্থায় আছে
                    </div>
                    <p className="leading-relaxed">
                      মোবাইল ব্রাউজার (Chrome / Safari) নিরাপত্তা নীতির কারণে স্পিকার স্থগিত (suspended) রেখেছে। এই অবস্থায় গেটপাস সিগন্যাল এলেও ব্যাকগ্রাউন্ডে ভয়েস বাজবে না — পাশের বাটনে ট্যাপ করে <span className="font-mono font-bold">'running'</span> করুন।
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDiagnosticResumeAudio}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg shrink-0 cursor-pointer"
                >
                  এখনই 'running' করুন
                </button>
              </div>
            ) : !wsStatusHealthy && !fallbackActive ? (
              <div className="bg-rose-50 border border-rose-300 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-950">
                <div className="flex items-start gap-2.5">
                  <Wifi className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="font-bold text-sm">
                      সতর্কতা: WebSocket সংযোগ বিচ্ছিন্ন ({wsState})
                    </div>
                    <p className="leading-relaxed">
                      সার্ভারের সাথে রিয়েল-টাইম চ্যানেল এখনো স্থাপিত হয়নি। ফোনের ইন্টারনেট পরীক্ষা করুন এবং পুনরায় সংযুক্ত করুন।
                    </p>
                  </div>
                </div>
                {onReconnectRealtime && (
                  <button
                    type="button"
                    onClick={onReconnectRealtime}
                    className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shrink-0 cursor-pointer"
                  >
                    পুনরায় সংযুক্ত করুন
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 flex items-start sm:items-center gap-2.5 text-xs text-emerald-950">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
                <div>
                  <span className="font-bold">সিস্টেম সম্পূর্ণ প্রস্তুত:</span>{' '}
                  WebSocket অবস্থা <span className="font-mono font-bold">{wsState}</span> এবং AudioContext{' '}
                  <span className="font-mono font-bold">'running'</span> অবস্থায় আছে। গেটপাস স্ক্যান হলেই তাৎক্ষণিক ভয়েস এলার্ম বাজবে।
                </div>
              </div>
            )}

            {/* 3 Primary Single-Elevation Telemetry Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* CARD 1: Real-time WebSocket Connection State */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <Radio className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>WebSocket সংযোগ অবস্থা</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${
                      wsStatusHealthy
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : fallbackActive
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    {wsState}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                    {wsState}
                  </div>
                  <div className="text-xs text-slate-600">
                    {wsStatusHealthy
                      ? 'প্রাইমারি WebSocket পুশ চ্যানেল সরাসরি চালু'
                      : fallbackActive
                      ? `WS বন্ধ — ${realtimeTransport?.toUpperCase() || 'ফ্যালব্যাক'} চ্যানেলে সিগন্যাল আসছে`
                      : 'সার্ভারের সাথে WebSocket সংযোগ চেষ্টা চলছে'}
                  </div>
                </div>

                <dl className="pt-2 border-t border-slate-100 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-500">সক্রিয় ট্রান্সপোর্ট</dt>
                    <dd className="font-mono font-semibold text-slate-900">
                      {(realtimeTransport || 'connecting').toUpperCase()}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-500">SSE ফ্যালব্যাক</dt>
                    <dd className="font-mono text-slate-800">
                      {realtimeDiagnostics?.sseReadyState ?? 'UNINITIALIZED'}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-500">রিকানেক্ট চেষ্টা</dt>
                    <dd className="font-mono tabular-nums text-slate-800">
                      {realtimeDiagnostics?.wsReconnectAttempts ?? 0} বার
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-500">সার্ভার হোস্ট</dt>
                    <dd className="font-mono text-[11px] text-slate-800 truncate max-w-[165px]" title={realtimeDiagnostics?.connectedHost || currentServerHost}>
                      {realtimeDiagnostics?.connectedHost || currentServerHost || '—'}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-500">ইনস্ট্যান্স আইডি</dt>
                    <dd className="font-mono text-[11px] text-slate-700 truncate max-w-[155px]">
                      {realtimeDiagnostics?.serverInstanceId || 'অপেক্ষমাণ'}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* CARD 2: Last Received Signal Latency */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>সর্বশেষ সিগন্যাল ল্যাটেন্সি</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${
                      latencyMs === null
                        ? 'bg-slate-100 text-slate-600 border-slate-200'
                        : isLatencySlow
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    {latencyMs === null ? 'WAIT' : isLatencySlow ? 'SLOW' : 'FAST'}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                    {latencyMs !== null ? `${latencyMs} ms` : 'অপেক্ষমাণ'}
                  </div>
                  <div className="text-xs text-slate-600">
                    {realtimeDiagnostics?.lastSignalType
                      ? `সর্বশেষ: ${realtimeDiagnostics.lastSignalType}`
                      : 'এখনো কোনো সিগন্যাল বা পিং পাওয়া যায়নি'}
                  </div>
                </div>

                <dl className="pt-2 border-t border-slate-100 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-500">স্ক্যান ডেলিভারি</dt>
                    <dd className="font-mono tabular-nums font-semibold text-slate-900">
                      {realtimeDiagnostics?.lastScanLatencyMs !== null &&
                      realtimeDiagnostics?.lastScanLatencyMs !== undefined
                        ? `${realtimeDiagnostics.lastScanLatencyMs} ms`
                        : 'স্ক্যান আসেনি'}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-500">পিং RTT</dt>
                    <dd className="font-mono tabular-nums text-slate-800">
                      {realtimeDiagnostics?.lastPingRttMs !== null &&
                      realtimeDiagnostics?.lastPingRttMs !== undefined
                        ? `${realtimeDiagnostics.lastPingRttMs} ms`
                        : 'অপেক্ষমাণ'}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-500">ঘড়ির ব্যবধান (Offset)</dt>
                    <dd className="font-mono tabular-nums text-slate-800">
                      {realtimeDiagnostics?.clockOffsetMs !== null &&
                      realtimeDiagnostics?.clockOffsetMs !== undefined
                        ? `${realtimeDiagnostics.clockOffsetMs >= 0 ? '+' : ''}${realtimeDiagnostics.clockOffsetMs} ms`
                        : '—'}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-500">প্রাপ্তির সময়</dt>
                    <dd className="font-mono tabular-nums text-slate-800">
                      {formatPreciseTime(realtimeDiagnostics?.lastSignalAt)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-500">সিগন্যাল মাধ্যম</dt>
                    <dd className="font-mono text-slate-800">
                      {realtimeDiagnostics?.lastSignalTransport?.toUpperCase() || '—'}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* CARD 3: AudioContext State ('suspended' vs 'running') */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <Volume2 className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>AudioContext অবস্থা</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${
                      audioCtxRunning
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : audioCtxState === 'suspended'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    {audioCtxState}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="text-2xl font-bold font-mono text-slate-900">
                    '{audioCtxState}'
                  </div>
                  <div className="text-xs text-slate-600">
                    {audioCtxRunning
                      ? 'স্পিকার চলমান (running) — অটো এলার্ম বাজতে প্রস্তুত'
                      : audioCtxState === 'suspended'
                      ? 'স্থগিত (suspended) — আনলক করতে বাটনে ট্যাপ করুন'
                      : 'অডিও কনটেক্সট এখনো তৈরি হয়নি'}
                  </div>
                </div>

                <dl className="pt-2 border-t border-slate-100 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-500">সেশন আনলক</dt>
                    <dd className={`font-semibold ${audioHardwareStatus.unlocked ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {audioHardwareStatus.unlocked ? 'হ্যাঁ (Unlocked)' : 'না (Locked)'}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-500">কিপ-অ্যালাইভ অসিলেটর</dt>
                    <dd className="font-mono text-slate-800">
                      {audioHardwareStatus.liveWatchActive ? 'ACTIVE' : 'INACTIVE'}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-500">স্ক্রিন Wake Lock</dt>
                    <dd className="font-mono text-slate-800">
                      {audioHardwareStatus.wakeLockActive ? 'LOCKED' : 'RELEASED'}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-500">সর্বশেষ ইঞ্জিন</dt>
                    <dd className="font-mono text-slate-800">
                      {audioHardwareStatus.lastEngineUsed}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-500">নোটিফিকেশন</dt>
                    <dd className="font-mono text-slate-800">
                      {realtimeDiagnostics?.notificationPermission ?? 'unsupported'}
                    </dd>
                  </div>
                </dl>

                {audioHardwareStatus.lastPlaybackError && (
                  <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-[11px] font-mono text-rose-800 break-words">
                    Error: {audioHardwareStatus.lastPlaybackError}
                  </div>
                )}
              </div>
            </div>

            {/* Action & Event Stream Container */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              {/* Filter + Quick Actions Bar */}
              <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { id: 'all' as const, label: `সব লগ (${toBengaliNumber(allLogs.length)})` },
                    { id: 'network' as const, label: 'WS / SSE / পোলিং' },
                    { id: 'signal' as const, label: 'স্ক্যান সিগন্যাল' },
                    { id: 'audio' as const, label: 'AudioContext' },
                    { id: 'issues' as const, label: 'ত্রুটি ও সতর্কতা' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setDiagnosticFilter(f.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                        diagnosticFilter === f.id
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onTestAudio(true)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>ভয়েস টেস্ট</span>
                  </button>

                  {onForceCheckRealtime && (
                    <button
                      type="button"
                      disabled={isManualChecking}
                      onClick={handleManualForceCheck}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isManualChecking ? 'animate-spin' : ''}`} />
                      <span>স্ক্যান সিঙ্ক চেক</span>
                    </button>
                  )}

                  {onReconnectRealtime && (
                    <button
                      type="button"
                      onClick={onReconnectRealtime}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Wifi className="w-3.5 h-3.5 text-indigo-600" />
                      <span>WS রিকানেক্ট</span>
                    </button>
                  )}

                  {onClearDiagnosticLogs && (
                    <button
                      type="button"
                      onClick={onClearDiagnosticLogs}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>পরিষ্কার</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Event Log Table / Stream */}
              {filteredLogs.length === 0 ? (
                <div className="p-8 text-center space-y-3">
                  <div className="text-sm font-bold text-slate-800">
                    এই ফিল্টারে এখনো কোনো ডায়াগনস্টিক ইভেন্ট রেকর্ড হয়নি
                  </div>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    সংযোগ ল্যাটেন্সি ও অডিও অবস্থা তাৎক্ষণিকভাবে যাচাই করতে নিচের বাটনে চাপ দিন অথবা গেটে একটি আইডি কার্ড স্ক্যান করুন।
                  </p>
                  <button
                    type="button"
                    onClick={handleDiagnosticPingClick}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>প্রথম পিং পরীক্ষা চালান</span>
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                        <th className="py-2.5 px-3 whitespace-nowrap">সময়</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">উৎস</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">অবস্থা</th>
                        <th className="py-2.5 px-3">ইভেন্ট ও বিবরণ</th>
                        <th className="py-2.5 px-3 text-right whitespace-nowrap">ল্যাটেন্সি</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredLogs.map((entry) => {
                        const badgeClass =
                          entry.level === 'ok'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : entry.level === 'warn'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : entry.level === 'error'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200';
                        const levelText =
                          entry.level === 'ok'
                            ? 'OK'
                            : entry.level === 'warn'
                            ? 'WARN'
                            : entry.level === 'error'
                            ? 'ERR'
                            : 'INFO';

                        return (
                          <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3 font-mono tabular-nums text-slate-500 whitespace-nowrap align-top">
                              {formatPreciseTime(entry.at)}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-700 whitespace-nowrap align-top">
                              {entry.source}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap align-top">
                              <span
                                className={`inline-block px-1.5 py-0.5 rounded border font-mono text-[10.5px] font-bold ${badgeClass}`}
                              >
                                {levelText}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-800 align-top">
                              <div className="font-medium">{entry.message}</div>
                              {entry.detail && (
                                <div className="text-[11px] font-mono text-slate-500 mt-0.5 break-all">
                                  {entry.detail}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap align-top">
                              {typeof entry.latencyMs === 'number' ? `${entry.latencyMs} ms` : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* =================================================================== */}
      {/* SECTION 4: DIGITAL ID CARD, PASSWORD & SCHOOL MESSAGE               */}
      {/* =================================================================== */}
      {dashboardSection === 'id_and_contact' && (
        <div className="space-y-6">
          {/* Student ID Cards Front & Back (Official photos locked from student edits) */}
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

          {/* Official Admin or Direct Device Unlock (When phone is locked) */}
          {isDeviceLocked && (onUnlockDevice || onAdminUnlockDevice) && (
            <div className="bg-amber-50/70 rounded-2xl border border-amber-200 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-slate-700 flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  <span>
                    এই ডিভাইসটি বর্তমানে <strong>{student.nameBn}</strong>-এর ড্যাশবোর্ডে লক করা আছে।
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {onUnlockDevice && (
                    <button
                      type="button"
                      onClick={() => setShowUnlockConfirmModal(true)}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      <span>লক সরান ও অন্য শিক্ষার্থীতে লগইন</span>
                    </button>
                  )}
                  {onAdminUnlockDevice && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAdminUnlockBox((v) => !v);
                        setAdminUnlockError(null);
                      }}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline cursor-pointer"
                    >
                      {showAdminUnlockBox ? 'বন্ধ করুন' : 'পিন দিয়ে আনলক'}
                    </button>
                  )}
                </div>
              </div>

              {showAdminUnlockBox && onAdminUnlockDevice && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setAdminUnlockError(null);
                    const ok = await onAdminUnlockDevice(adminUnlockPin.trim());
                    if (!ok) {
                      setAdminUnlockError('ভুল পাসওয়ার্ড/পিন! শিক্ষার্থীর পিন (যেমন 1234) অথবা অ্যাডমিন পিন দিন।');
                    }
                  }}
                  className="flex flex-wrap items-center gap-2 pt-2 border-t border-amber-200"
                >
                  <input
                    type="password"
                    required
                    value={adminUnlockPin}
                    onChange={(e) => setAdminUnlockPin(e.target.value)}
                    placeholder="শিক্ষার্থীর পিন (1234) বা অ্যাডমিন পিন লিখুন"
                    className="flex-1 min-w-[200px] px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>ডিভাইস আনলক করুন</span>
                  </button>
                  {adminUnlockError && (
                    <div className="w-full text-xs font-semibold text-rose-700">{adminUnlockError}</div>
                  )}
                </form>
              )}
            </div>
          )}
        </div>
      )}

      {/* Visual 'How to Install' Modal (Android & iOS Home Screen Guide) */}
      <HowToInstallModal
        isOpen={showInstallLockModal}
        onClose={() => setShowInstallLockModal(false)}
        studentName={student.nameBn}
        studentShortName={getShortStudentAppName(student.nameBn)}
        studentAvatarUrl={student.avatarUrl ? customAppIconPreview : undefined}
        portalId={portalId}
        defaultPlatform={isIOS ? 'ios' : 'android'}
        isDeviceLocked={isDeviceLocked}
        isInstallable={isInstallable}
        isInstalled={isInstalled}
        onTriggerNativeInstall={install}
        onUnlockDevice={onUnlockDevice ? () => setShowUnlockConfirmModal(true) : undefined}
      />

      {/* Device Unlock & Switch Student Modal */}
      {showUnlockConfirmModal && onUnlockDevice && (
        <div
          className="fixed inset-0 z-[9999] bg-slate-950/80 flex items-center justify-center p-4"
          onClick={() => setShowUnlockConfirmModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#091e42] text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-400 text-slate-950 rounded-xl">
                  <Unlock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold font-serif">
                    ড্যাশবোর্ড লক সরান ও শিক্ষার্থী পরিবর্তন
                  </h3>
                  <p className="text-[11px] text-slate-300">{student.nameBn}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowUnlockConfirmModal(false)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs sm:text-sm">
              <p className="text-slate-700 leading-relaxed">
                <strong>{student.nameBn}</strong>-এর স্থায়ী ড্যাশবোর্ড লক সরিয়ে দিলে আপনি সাথে সাথে সাইন-ইন স্ক্রিনে ফিরে যাবেন এবং অন্য যেকোনো শিক্ষার্থীর রোল, ইউনিক আইডি বা মোবাইল নম্বর দিয়ে লগইন করতে পারবেন।
              </p>

              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 space-y-1.5">
                <div className="font-bold">হোম স্ক্রিন অ্যাপ আইকন পরিবর্তন করতে চাইলে:</div>
                <p className="leading-relaxed">
                  আগে থেকে ফোনের হোম স্ক্রিনে এই শিক্ষার্থীর আইকন ইনস্টল করা থাকলে আইকনের ওপর চেপে ধরে <strong>Uninstall / Remove</strong> করুন। এরপর নতুন শিক্ষার্থীতে সাইন ইন করে পুনরায় <strong>Install App</strong> চাপলে নতুন শিক্ষার্থীর পাসপোর্ট ছবিসহ আইকন যুক্ত হবে।
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  type="button"
                  onClick={async () => {
                    setShowUnlockConfirmModal(false);
                    await onUnlockDevice();
                  }}
                  className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Unlock className="w-4 h-4" />
                  <span>হ্যাঁ, বর্তমান লক সরিয়ে সাইন-ইন পেজে যান</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowUnlockConfirmModal(false)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-semibold rounded-xl transition cursor-pointer"
                >
                  বাতিল
                </button>
              </div>
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
