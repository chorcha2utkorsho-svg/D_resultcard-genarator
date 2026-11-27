import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Activity,
  ShieldCheck,
  QrCode,
  Volume2,
  VolumeX,
  Send,
  UserCheck,
  Clock,
  Search,
  CheckCircle2,
  AlertTriangle,
  History,
  Phone,
  User,
  CreditCard,
  Printer,
  Sparkles,
  Camera,
  RefreshCw,
  Trash2,
  FileBadge,
  Lock,
  Unlock,
  LogIn,
  LogOut,
  Bell,
  BellRing,
  Heart,
  Smartphone,
  Radio,
  Layers,
  Eye,
  Download,
  Check,
  X,
  FlipHorizontal,
  Edit3,
  ExternalLink,
  Save,
  Zap,
  Share2,
  Copy,
  MessageSquare,
  CheckCheck,
  Calendar,
  Globe,
  ClipboardList,
  ShieldAlert,
  XCircle,
  Settings,
  RotateCcw,
  Mic,
  MicOff,
  Wifi,
} from 'lucide-react';
import jsQR from 'jsqr';
import QRCode from 'qrcode';
import { useSchool } from '../context/SchoolContext';
import {
  Student,
  SecurityGatepassLog,
  ScannerAuditEvent,
  ScannerAuditSource,
  ScannerAuditOutcome,
} from '../types';
import { toBengaliNumber, toBengaliRoll, formatBengaliDate, getStudentPortalId } from '../utils/bengali';
import { matchStudentByQrOrQuery, describeMatchRuleBn } from '../utils/gatepassQrMatcher';
import { SchoolLogo } from './SchoolLogo';
import { StudentIDCardSlip } from './StudentIDCardSlip';
import { compressImageBase64 } from '../utils/imageCompressor';
import { openIdCardsInNewTab, downloadIdCardsHtml } from '../utils/idCardExport';
import { PWAInstallButton } from './PWAInstallButton';
import { StudentPersonalDashboard } from './StudentPersonalDashboard';
import { clearExplicitUnlockFlag } from '../utils/deviceLock';
import {
  buildGuardianVoiceMessage as buildGuardianVoiceMsgShared,
  buildScannerVoiceMessage,
  DEFAULT_DAILY_SCHEDULE,
  DEFAULT_SCANNER_VOICE_SETTINGS,
  getGuardianAudioStatus,
  getPendingBlockedSpeech,
  getSharedAudioContext,
  playAlarmChime,
  playScannerBeep,
  playSilentAudioTrack,
  prewarmGuardianVoiceCache,
  recordAudioEngineDiagnostic,
  replayPendingBlockedSpeech,
  requestGuardianNotificationPermission,
  setGuardianLiveWatchActive,
  setPendingBlockedSpeech,
  showGuardianSystemNotification,
  speakBengaliSpeech,
  speakRepeatedGuardianAlert,
  stopBengaliSpeech,
  subscribeGuardianAudioStatus,
  subscribeSpeechPlayback,
  triggerDummySpeechSynthesisTest,
  unlockMobileAudioAndSpeech,
} from '../utils/gatepassAudio';
import {
  broadcastLocalGatepassScan,
  GatepassRealtimeDiagnostics,
  hasPlayedGuardianVoiceLog,
  isGuardianAudioEnabledPref,
  markGatepassLogSeen,
  markGuardianVoiceLogPlayed,
  RealtimeSyncHealth,
  RealtimeTransportMode,
  setGuardianAudioEnabledPref,
  useGatepassRealtime,
} from '../hooks/useGatepassRealtime';
import { parseJsonApiResponse } from '../utils/apiResponse';

interface DigitalSecurityGatepassViewProps {
  initialTab?:
    | 'guardian_portal'
    | 'barcode_scanner'
    | 'idcard_generator'
    | 'audit_logs'
    | 'scanner_audit';
  restrictedMode?: 'full' | 'student_only' | 'employee_scanner';
  forcedStudentId?: string;
  externalLiveRingingAlert?: { log: SecurityGatepassLog; message: string } | null;
  onDismissExternalRingingAlert?: () => void;
  realtimeTransport?: RealtimeTransportMode;
  realtimeSyncHealth?: RealtimeSyncHealth;
  onForceCheckRealtime?: () => Promise<{ foundCount: number; latestLog: SecurityGatepassLog | null }>;
  realtimeDiagnostics?: GatepassRealtimeDiagnostics;
  onSendDiagnosticPing?: () => Promise<number | null>;
  onReconnectRealtime?: () => void;
  onClearDiagnosticLogs?: () => void;
  onRoleLogout?: () => void;
  isDeviceLocked?: boolean;
  onInstallLockedDashboard?: (student: Student) => Promise<void> | void;
  onAdminUnlockDevice?: (adminPin: string) => Promise<boolean>;
}

export const DigitalSecurityGatepassView: React.FC<DigitalSecurityGatepassViewProps> = ({
  initialTab,
  restrictedMode = 'full',
  forcedStudentId,
  externalLiveRingingAlert,
  onDismissExternalRingingAlert,
  realtimeTransport,
  realtimeSyncHealth,
  onForceCheckRealtime,
  realtimeDiagnostics,
  onSendDiagnosticPing,
  onReconnectRealtime,
  onClearDiagnosticLogs,
  onRoleLogout,
  isDeviceLocked = false,
  onInstallLockedDashboard,
}) => {
  const {
    schoolInfo,
    updateSchoolInfo,
    classes,
    students,
    updateStudent,
    updateStudentPhoto,
    batchUpdateStudentPhotos,
    securityLogs,
    addSecurityLog,
    updateSecurityLogEtiquette,
    acknowledgeSecurityLog,
    clearSecurityLogs,
    markStudentAttendanceFromScan,
    upsertAttendanceRecordFromServer,
    selectedClassId,
    selectedYear,
    isServerSyncing,
    serverSyncStatus,
    syncErrorMessage,
    lastSyncedTime,
    forceServerSync,
    seedParentDetailsForClass,
    cloudUser,
    cloudSyncError,
    cloudPushAuthorized,
    connectCloudSync,
    authorizeScannerUid,
    broadcastSecurityLogToCloud,
  } = useSchool();
  const [scannerCloudConnecting, setScannerCloudConnecting] = useState(false);
  const [copiedScannerUid, setCopiedScannerUid] = useState(false);
  const [showScannerAllowBox, setShowScannerAllowBox] = useState(false);
  const [allowScannerUidInput, setAllowScannerUidInput] = useState('');
  const [allowScannerEmailInput, setAllowScannerEmailInput] = useState('');
  const [allowScannerResult, setAllowScannerResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isAuthorizingScanner, setIsAuthorizingScanner] = useState(false);

  const initialUrlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const urlGuardianParam = initialUrlParams?.get('guardian') || '';
  const urlTabParam = initialUrlParams?.get('tab') || '';
  const hasSavedGuardianSession =
    typeof window !== 'undefined' &&
    localStorage.getItem('dlikon_pwa_guardian_mode') === 'true' &&
    Boolean(localStorage.getItem('dlikon_guardian_paired_student_id'));

  // Top-Level Active Tab for the 3 core parts mandated by user:
  // Part 1: guardian_portal (শিক্ষার্থী ও অভিভাবক ড্যাশবোর্ড)
  // Part 2: barcode_scanner (স্মার্ট ফোনের মাধ্যমে বারকোড স্ক্যানার)
  // Part 3: idcard_generator (কিউআর কোড যুক্ত এপিঠ ওপিঠ আইডিকার্ড জেনারেটর)
  // Part 4: audit_logs (গেটপাস অডিট ও অ্যাক্সেস লগ)
  // Part 5: scanner_audit (স্ক্যানার লগ অডিট - প্রতিটি QR স্ক্যান ও রেজাল্ট ম্যাপিং রেকর্ড)
  const [activeTab, setActiveTab] = useState<
    'guardian_portal' | 'barcode_scanner' | 'idcard_generator' | 'audit_logs' | 'scanner_audit'
  >(
    restrictedMode === 'student_only'
      ? 'guardian_portal'
      : restrictedMode === 'employee_scanner'
      ? 'barcode_scanner'
      : initialTab ||
        (urlGuardianParam || urlTabParam === 'guardian_portal' || hasSavedGuardianSession
          ? 'guardian_portal'
          : 'barcode_scanner')
  );

  useEffect(() => {
    if (restrictedMode === 'student_only') {
      setActiveTab('guardian_portal');
    } else if (restrictedMode === 'employee_scanner') {
      setActiveTab('barcode_scanner');
    } else if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, restrictedMode]);

  // =========================================================================
  // PART 2: SMARTPHONE SCANNER & GATE AUTOMATION STATES
  // =========================================================================
  const [gateAction, setGateAction] = useState<'entry' | 'exit'>('entry');
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const [soundBeepEnabled, setSoundBeepEnabled] = useState<boolean>(true);
  const [smsSimulationEnabled, setSmsSimulationEnabled] = useState<boolean>(true);
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const [recentScannedStudent, setRecentScannedStudent] = useState<Student | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>('');
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [scannerFeedback, setScannerFeedback] = useState<string | null>(null);
  const [scanSuccessToast, setScanSuccessToast] = useState<{
    id: string;
    studentNameBn: string;
    classNameBn: string;
    roll: number;
    portalId: string;
    avatarUrl?: string;
    action: 'entry' | 'exit';
    dispatchPhase: 'starting' | 'delivered' | 'saved_no_online' | 'error';
    deliveredCount: number;
    recognizedAt: string;
  } | null>(null);
  const scanToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lastScanDispatchInfo, setLastScanDispatchInfo] = useState<{
    student: Student;
    deliveredCount: number;
    serverHost: string;
    serverInstanceId?: string;
    verifiedAt: string;
    logPayload?: SecurityGatepassLog;
    syncError?: 'auth_redirect' | 'static_host' | 'network_error' | 'cloud_permission_denied' | null;
    isSending?: boolean;
  } | null>(null);
  const [ambiguousCandidates, setAmbiguousCandidates] = useState<Student[]>([]);
  const lastAmbiguousQueryRef = useRef<string>('');
  const [autoInstantScanGreeting, setAutoInstantScanGreeting] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('dlikon_auto_instant_scan_greeting_v2') !== 'false';
  });
  const [liveServerHealth, setLiveServerHealth] = useState<{
    reachable: boolean;
    authRedirected?: boolean;
    staticHostNoBackend?: boolean;
    serverInstanceId?: string;
    onlineGuardians: {
      studentId: string;
      portalId: string;
      classId?: string;
      roll?: number | null;
      transport: string;
    }[];
  }>({ reachable: true, serverInstanceId: '', onlineGuardians: [] });
  const [showGuardianQrBridge, setShowGuardianQrBridge] = useState<boolean>(false);
  const [bridgeTargetStudentId, setBridgeTargetStudentId] = useState<string>('');
  const [bridgeQrDataUrl, setBridgeQrDataUrl] = useState<string>('');
  const [bridgeOriginMode, setBridgeOriginMode] = useState<'same' | 'pre'>('same');
  const [siblingPreStatus, setSiblingPreStatus] = useState<{
    checked: boolean;
    reachable: boolean;
    onlineCount: number;
  }>({ checked: false, reachable: false, onlineCount: 0 });
  const [lastScanEtiquette, setLastScanEtiquette] = useState<{
    logId: string;
    studentId: string;
    studentNameBn: string;
    salamText: string;
    replied: boolean;
    replyText?: string;
    attendanceSaved?: boolean;
  } | null>(null);
  const [isListeningEtiquette, setIsListeningEtiquette] = useState<boolean>(false);
  const [etiquetteSpeechError, setEtiquetteSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const [pendingScanConfirmation, setPendingScanConfirmation] = useState<{
    student: Student;
    classNameBn: string;
    matchedBy: string;
    source: ScannerAuditSource;
    rawPayload: string;
  } | null>(null);
  const pendingScanConfirmationRef = useRef<{
    student: Student;
    classNameBn: string;
    matchedBy: string;
    source: ScannerAuditSource;
    rawPayload: string;
  } | null>(null);

  useEffect(() => {
    pendingScanConfirmationRef.current = pendingScanConfirmation;
  }, [pendingScanConfirmation]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        'dlikon_auto_instant_scan_greeting_v2',
        autoInstantScanGreeting ? 'true' : 'false'
      );
    }
  }, [autoInstantScanGreeting]);

  // Probe sibling Shared App (ais-pre-) backend health when running on ais-dev-
  useEffect(() => {
    if (typeof window === 'undefined' || !window.location.origin.includes('://ais-dev-')) return;
    if (activeTab !== 'barcode_scanner' && !showGuardianQrBridge) return;
    let active = true;
    const preOrigin = window.location.origin.replace('://ais-dev-', '://ais-pre-');
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const tId = ctrl ? setTimeout(() => ctrl.abort(), 3500) : null;
    fetch(`${preOrigin}/api/security/health`, { cache: 'no-store', signal: ctrl?.signal })
      .then((res) => parseJsonApiResponse<any>(res))
      .then((parsed) => {
        if (!active) return;
        const ok = Boolean(parsed.ok && parsed.data && parsed.data.success !== false);
        const onlineCount = Array.isArray(parsed.data?.onlineGuardians)
          ? parsed.data.onlineGuardians.length
          : 0;
        setSiblingPreStatus({ checked: true, reachable: ok, onlineCount });
        if (ok && onlineCount > 0) {
          setBridgeOriginMode('pre');
        }
      })
      .catch(() => {
        if (active) {
          setSiblingPreStatus({ checked: true, reachable: false, onlineCount: 0 });
        }
      })
      .finally(() => {
        if (tId) clearTimeout(tId);
      });
    return () => {
      active = false;
      if (tId) clearTimeout(tId);
      ctrl?.abort();
    };
  }, [activeTab, showGuardianQrBridge]);

  useEffect(() => {
    if (!showGuardianQrBridge || typeof window === 'undefined') return;
    const defaultStd =
      recentScannedStudent ||
      students.find((s) => s.classId === 'class_4' && Number(s.roll) === 1) ||
      students[0];
    const targetId = bridgeTargetStudentId || defaultStd?.id || '';
    if (targetId && !bridgeTargetStudentId) {
      setBridgeTargetStudentId(targetId);
    }
    const isDev = window.location.origin.includes('://ais-dev-');
    const bridgeOrigin =
      isDev && bridgeOriginMode === 'pre'
        ? window.location.origin.replace('://ais-dev-', '://ais-pre-')
        : window.location.origin;
    const shareUrl = targetId
      ? `${bridgeOrigin}/?tab=security&guardian=${encodeURIComponent(targetId)}`
      : bridgeOrigin;
    QRCode.toDataURL(shareUrl, {
      width: 240,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#091e42', light: '#ffffff' },
    })
      .then(setBridgeQrDataUrl)
      .catch(() => setBridgeQrDataUrl(''));
  }, [showGuardianQrBridge, bridgeTargetStudentId, bridgeOriginMode, recentScannedStudent, students]);

  useEffect(() => {
    return () => {
      if (scanToastTimerRef.current) {
        clearTimeout(scanToastTimerRef.current);
      }
    };
  }, []);

  // QR Scanner Event Audit State
  const [scannerAuditLogs, setScannerAuditLogs] = useState<ScannerAuditEvent[]>([]);
  const [scannerAuditLoading, setScannerAuditLoading] = useState<boolean>(false);
  const [scannerAuditOutcomeFilter, setScannerAuditOutcomeFilter] = useState<
    'all' | ScannerAuditOutcome
  >('all');
  const [scannerAuditSourceFilter, setScannerAuditSourceFilter] = useState<
    'all' | ScannerAuditSource
  >('all');
  const [scannerAuditSearchQuery, setScannerAuditSearchQuery] = useState<string>('');
  const [copiedAuditTokenId, setCopiedAuditTokenId] = useState<string | null>(null);

  // Live Camera stream for smartphone simulation
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hasTorchSupport, setHasTorchSupport] = useState<boolean>(false);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [scanSuccessPulse, setScanSuccessPulse] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const lastScannedPayloadRef = useRef<string>('');
  const lastScannedTimeRef = useRef<number>(0);
  const scanAnimationFrameRef = useRef<number | null>(null);

  // Time state for live security clock
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('bn-BD', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Toggle torch / flashlight if supported on device
  const toggleTorch = async () => {
    if (!mediaStreamRef.current) return;
    const track = mediaStreamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        const nextState = !isTorchOn;
        await (track.applyConstraints as any)({ advanced: [{ torch: nextState }] });
        setIsTorchOn(nextState);
      } catch (err) {
        console.warn('Torch toggle error:', err);
      }
    }
  };

  // Handle camera start/stop
  const startCamera = async () => {
    setCameraError(null);
    unlockMobileAudioAndSpeech(true);
    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: cameraFacingMode },
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
        },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setIsCameraActive(true);

      const track = stream.getVideoTracks()[0];
      if (track) {
        const caps = (track.getCapabilities && (track.getCapabilities() as any)) || {};
        setHasTorchSupport(Boolean(caps.torch));
        if (track.applyConstraints && caps.focusMode?.includes?.('continuous')) {
          void (track.applyConstraints as any)({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
        }
      }
    } catch (err: any) {
      console.warn('Camera access issue, trying fallback:', err);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: cameraFacingMode },
          audio: false,
        }).catch(() =>
          navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          })
        );
        mediaStreamRef.current = fallbackStream;
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          await videoRef.current.play().catch(() => {});
        }
        setIsCameraActive(true);
      } catch {
        setCameraError('ক্যামেরা চালু করা যায়নি বা অনুমতি দেওয়া হয়নি। আপনি নিচের বারকোড ইনপুট বক্স ব্যবহার করে সরাসরি স্ক্যান করতে পারেন।');
        setIsCameraActive(false);
      }
    }
  };

  // Ensure video element ALWAYS receives active MediaStream even on first mount when isCameraActive transitions false -> true
  useEffect(() => {
    if (!isCameraActive || !mediaStreamRef.current || !videoRef.current) return;
    const videoEl = videoRef.current;
    if (videoEl.srcObject !== mediaStreamRef.current) {
      videoEl.srcObject = mediaStreamRef.current;
    }
    void videoEl.play().catch(() => {});
  }, [isCameraActive, activeTab]);

  const stopCamera = () => {
    if (scanAnimationFrameRef.current) {
      cancelAnimationFrame(scanAnimationFrameRef.current);
      scanAnimationFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setIsTorchOn(false);
  };

  useEffect(() => {
    return () => {
      if (scanAnimationFrameRef.current) {
        cancelAnimationFrame(scanAnimationFrameRef.current);
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (isCameraActive) {
      startCamera();
    }
  }, [cameraFacingMode]);

  // Default & Dynamic Daily School Schedule + Welcome Audio Settings
  const activeDailySchedule = useMemo(
    () => schoolInfo.dailySchedule || DEFAULT_DAILY_SCHEDULE,
    [schoolInfo.dailySchedule]
  );

  const activeScannerVoiceSettings = useMemo(
    () => schoolInfo.scannerVoiceSettings || DEFAULT_SCANNER_VOICE_SETTINGS,
    [schoolInfo.scannerVoiceSettings]
  );

  const [showWelcomeAudioEditor, setShowWelcomeAudioEditor] = useState<boolean>(false);
  const [welcomeVoiceDraft, setWelcomeVoiceDraft] = useState({
    entryMessageTemplate: activeScannerVoiceSettings.entryMessageTemplate,
    exitMessageTemplate: activeScannerVoiceSettings.exitMessageTemplate,
  });
  const [welcomeVoiceSaveNotice, setWelcomeVoiceSaveNotice] = useState<string | null>(null);

  useEffect(() => {
    setWelcomeVoiceDraft({
      entryMessageTemplate: activeScannerVoiceSettings.entryMessageTemplate,
      exitMessageTemplate: activeScannerVoiceSettings.exitMessageTemplate,
    });
  }, [activeScannerVoiceSettings]);

  const buildGuardianVoiceMessage = (student: Student, action: 'entry' | 'exit') =>
    buildGuardianVoiceMsgShared(student, action, activeDailySchedule);

  // Android/iOS-safe Bengali Voice Synthesis helper (forceSpeak=true allows guardian phone playback independent of gate mute)
  const speakBengali = (
    text: string,
    forceSpeak: boolean = false,
    options: { delayMs?: number; logId?: string; studentNameBn?: string; action?: 'entry' | 'exit' } = {}
  ) => {
    if (!forceSpeak && !voiceEnabled) {
      return;
    }
    speakBengaliSpeech(text, {
      delayMs: options.delayMs || 0,
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
      onBlocked: options.logId
        ? () => {
            setIsSpeaking(false);
            setPendingBlockedSpeech({
              message: text,
              logId: options.logId!,
              studentNameBn: options.studentNameBn,
              action: options.action,
            });
          }
        : () => setIsSpeaking(false),
    });
  };

  // Perform Gate Verification, Main-DB Attendance Sync, Warm Salam Greeting, and Guardian Push
  const handleVerifyStudent = (
    student: Student,
    options: { skipBeep?: boolean; forceVoice?: boolean } = {}
  ) => {
    unlockMobileAudioAndSpeech(true);
    const studentClass = classes.find((c) => c.id === student.classId);
    const classNameBn = studentClass?.nameBn || 'শ্রেণি';
    const actionLabel = gateAction === 'entry' ? 'বিদ্যালয়ে প্রবেশ' : 'বিদ্যালয় থেকে প্রস্থান';
    const nowIso = new Date().toISOString();
    const portalIdCode = getStudentPortalId(student);

    const voiceMsg = buildScannerVoiceMessage(
      student,
      classNameBn,
      gateAction,
      activeScannerVoiceSettings
    );
    const guardianPhone =
      student.guardianPhone || student.fatherPhone || student.motherPhone || '০১৭০০-০০০০০০';

    // 1. Play barcode scanner beep tone unless already played on scan detection
    if (soundBeepEnabled && !options.skipBeep) {
      playScannerBeep();
    }

    const newLogRecord: SecurityGatepassLog = {
      id: `sec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      studentId: student.id,
      portalUserId: portalIdCode,
      classId: student.classId,
      section: student.section || 'ক',
      studentNameBn: student.nameBn,
      studentRoll: student.roll,
      classNameBn,
      action: gateAction,
      timestamp: nowIso,
      guardianPhone,
      voiceDispatched: Boolean(voiceEnabled || options.forceVoice),
      smsDispatched: smsSimulationEnabled,
      status: 'verified',
      operatorNote: `${actionLabel} সফল হয়েছে · দৈনিক হাজিরা সংরক্ষিত`,
    };

    // 2. Immediately surface floating visual toast confirming ID recognition + alert start
    if (scanToastTimerRef.current) {
      clearTimeout(scanToastTimerRef.current);
    }
    const toastId = newLogRecord.id;
    const recognizedTimeLabel = new Date().toLocaleTimeString('bn-BD', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
    setScanSuccessToast({
      id: toastId,
      studentNameBn: student.nameBn,
      classNameBn,
      roll: student.roll,
      portalId: portalIdCode,
      avatarUrl: student.avatarUrl,
      action: gateAction,
      dispatchPhase: 'starting',
      deliveredCount: 0,
      recognizedAt: recognizedTimeLabel,
    });
    scanToastTimerRef.current = setTimeout(() => {
      setScanSuccessToast((prev) => (prev?.id === toastId ? null : prev));
    }, 7000);

    // 2a. Immediately persist today's attendance in Main DB / SchoolContext & notify Attendance app
    markStudentAttendanceFromScan(student, gateAction, nowIso);

    // 2b. Add security log locally & notify same-browser tabs
    addSecurityLog(newLogRecord);
    broadcastLocalGatepassScan(newLogRecord);

    // 2c. Broadcast to central server (WebSocket + SSE push + authoritative main-DB attendance record) + Cloud Firestore
    const cloudPushPromise: Promise<{ ok: boolean; guardianCount?: number; error?: string }> =
      broadcastSecurityLogToCloud(newLogRecord).catch(() => ({
        ok: false,
        guardianCount: 0,
        error: 'Google ক্লাউডে স্ক্যান পাঠাতে ব্যর্থ হয়েছে।',
      }));
    const currentServerHost = typeof window !== 'undefined' ? window.location.host : '';
    const siblingPreOrigin =
      typeof window !== 'undefined' && window.location.origin.includes('://ais-dev-')
        ? window.location.origin.replace('://ais-dev-', '://ais-pre-')
        : null;

    setLastScanDispatchInfo({
      student,
      deliveredCount: 0,
      serverHost: currentServerHost,
      verifiedAt: nowIso,
      logPayload: newLogRecord,
      syncError: null,
      isSending: true,
    });

    const mirrorScanToSiblingOrigin = async (): Promise<number> => {
      if (!siblingPreOrigin) return 0;
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const tId = ctrl ? setTimeout(() => ctrl.abort(), 4500) : null;
      try {
        const resPre = await fetch(`${siblingPreOrigin}/api/security/scan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ log: newLogRecord }),
          signal: ctrl?.signal,
        });
        const parsedPre = await parseJsonApiResponse<any>(resPre);
        if (parsedPre.ok && parsedPre.data && typeof parsedPre.data.deliveredLiveSubscribers === 'number') {
          return parsedPre.data.deliveredLiveSubscribers;
        }
        return 0;
      } catch {
        return 0;
      } finally {
        if (tId) clearTimeout(tId);
      }
    };

    const dispatchScanToServer = async (attempt = 0): Promise<void> => {
      try {
        const [res, mirrorDelivered, cloudRes] = await Promise.all([
          fetch('/api/security/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            keepalive: true,
            cache: 'no-store',
            body: JSON.stringify({ log: newLogRecord }),
          }),
          attempt === 0 ? mirrorScanToSiblingOrigin() : Promise.resolve(0),
          attempt === 0 ? cloudPushPromise : Promise.resolve({ ok: false, guardianCount: 0 } as { ok: boolean; guardianCount?: number; error?: string }),
        ]);
        const parsed = await parseJsonApiResponse<any>(res);
        const cloudGuardianCount = cloudRes.ok ? (cloudRes.guardianCount || 0) : 0;
        const cloudDenied = Boolean(cloudUser?.emailVerified && !cloudRes.ok);

        if (parsed.staticHostNoBackend) {
          const deliveredAny = Math.max(mirrorDelivered, cloudGuardianCount);
          setLastScanDispatchInfo({
            student,
            deliveredCount: deliveredAny,
            serverHost: currentServerHost,
            verifiedAt: nowIso,
            logPayload: newLogRecord,
            syncError: cloudDenied
              ? 'cloud_permission_denied'
              : cloudRes.ok || mirrorDelivered > 0
              ? null
              : 'static_host',
          });
          setScanSuccessToast((prev) =>
            prev?.id === toastId
              ? {
                  ...prev,
                  dispatchPhase: deliveredAny > 0 ? 'delivered' : cloudRes.ok ? 'saved_no_online' : 'error',
                  deliveredCount: deliveredAny,
                }
              : prev
          );
          return;
        }
        if (parsed.authRedirected) {
          const deliveredAny = Math.max(mirrorDelivered, cloudGuardianCount);
          setLastScanDispatchInfo({
            student,
            deliveredCount: deliveredAny,
            serverHost: currentServerHost,
            verifiedAt: nowIso,
            logPayload: newLogRecord,
            syncError: cloudDenied
              ? 'cloud_permission_denied'
              : cloudRes.ok || mirrorDelivered > 0
              ? null
              : 'auth_redirect',
          });
          setScanSuccessToast((prev) =>
            prev?.id === toastId
              ? {
                  ...prev,
                  dispatchPhase: deliveredAny > 0 ? 'delivered' : cloudRes.ok ? 'saved_no_online' : 'error',
                  deliveredCount: deliveredAny,
                }
              : prev
          );
          return;
        }
        if (!parsed.ok || !parsed.data) {
          if (attempt === 0) {
            await new Promise((r) => setTimeout(r, 650));
            return dispatchScanToServer(1);
          }
          const deliveredAny = Math.max(mirrorDelivered, cloudGuardianCount);
          setLastScanDispatchInfo({
            student,
            deliveredCount: deliveredAny,
            serverHost: currentServerHost,
            verifiedAt: nowIso,
            logPayload: newLogRecord,
            syncError: cloudDenied
              ? 'cloud_permission_denied'
              : cloudRes.ok || mirrorDelivered > 0
              ? null
              : 'network_error',
          });
          setScanSuccessToast((prev) =>
            prev?.id === toastId
              ? {
                  ...prev,
                  dispatchPhase: deliveredAny > 0 ? 'delivered' : cloudRes.ok ? 'saved_no_online' : 'error',
                  deliveredCount: deliveredAny,
                }
              : prev
          );
          return;
        }
        const data = parsed.data;
        if (data?.log) {
          addSecurityLog(data.log, { suppressAutoPush: true });
        }
        if (data?.attendanceRecord) {
          upsertAttendanceRecordFromServer(data.attendanceRecord, { suppressAutoPush: true });
        }
        const localDelivered =
          typeof data?.deliveredLiveSubscribers === 'number' ? data.deliveredLiveSubscribers : 0;
        const totalDelivered = Math.max(localDelivered + mirrorDelivered, cloudGuardianCount);
        setLastScanDispatchInfo({
          student,
          deliveredCount: totalDelivered,
          serverHost: currentServerHost,
          serverInstanceId: typeof data?.serverInstanceId === 'string' ? data.serverInstanceId : undefined,
          verifiedAt: nowIso,
          logPayload: data?.log || newLogRecord,
          syncError: cloudDenied && totalDelivered === 0 ? 'cloud_permission_denied' : null,
        });
        setScanSuccessToast((prev) =>
          prev?.id === toastId
            ? {
                ...prev,
                dispatchPhase:
                  totalDelivered > 0
                    ? 'delivered'
                    : cloudDenied
                    ? 'error'
                    : 'saved_no_online',
                deliveredCount: totalDelivered,
              }
            : prev
        );
      } catch (err) {
        console.warn('Gate log sync error:', err);
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 650));
          return dispatchScanToServer(1);
        }
        const cloudRes = await cloudPushPromise;
        const cloudGuardianCount = cloudRes.ok ? (cloudRes.guardianCount || 0) : 0;
        const cloudDenied = Boolean(cloudUser?.emailVerified && !cloudRes.ok);
        setLastScanDispatchInfo({
          student,
          deliveredCount: cloudGuardianCount,
          serverHost: currentServerHost,
          verifiedAt: nowIso,
          logPayload: newLogRecord,
          syncError: cloudDenied
            ? 'cloud_permission_denied'
            : cloudRes.ok
            ? null
            : 'network_error',
        });
        setScanSuccessToast((prev) =>
          prev?.id === toastId
            ? {
                ...prev,
                dispatchPhase:
                  cloudGuardianCount > 0 ? 'delivered' : cloudRes.ok ? 'saved_no_online' : 'error',
                deliveredCount: cloudGuardianCount,
              }
            : prev
        );
      }
    };
    void dispatchScanToServer(0);

    setAmbiguousCandidates([]);
    setRecentScannedStudent(student);
    setLiveAnnouncement(voiceMsg);
    setLastScanEtiquette({
      logId: newLogRecord.id,
      studentId: student.id,
      studentNameBn: student.nameBn,
      salamText: voiceMsg,
      replied: false,
      attendanceSaved: true,
    });
    setEtiquetteSpeechError(null);
    setScannerFeedback(
      `✓ ${student.nameBn} (${classNameBn}, রোল ${toBengaliRoll(student.roll)}) — সালাম জানানো হয়েছে ও আজকের হাজিরা এটেনডেন্স এপে সংরক্ষিত!`
    );

    // 3. Play Bengali Warm Salam & Good Wishes Announcement on School Scanner Device
    if (options.forceVoice || voiceEnabled) {
      speakBengali(voiceMsg, Boolean(options.forceVoice), {
        delayMs: soundBeepEnabled && !options.skipBeep ? 120 : 0,
      });
    }

    // Clear input
    setBarcodeInput('');

    setTimeout(() => {
      setScannerFeedback(null);
    }, 5000);
  };

  // Student Etiquette Practice Handler ("ওয়ালাইকুমুস সালাম ওয়া রাহমাতুল্লাহ")
  const handleStudentEtiquetteReply = (replyPhrase = 'ওয়ালাইকুমুস সালাম ওয়া রাহমাতুল্লাহ') => {
    if (!lastScanEtiquette) return;
    unlockMobileAudioAndSpeech(true);
    setIsListeningEtiquette(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setLastScanEtiquette((prev) =>
      prev ? { ...prev, replied: true, replyText: replyPhrase } : prev
    );
    void updateSecurityLogEtiquette(lastScanEtiquette.logId, replyPhrase);
    const praiseMsg = `মাশাআল্লাহ ${lastScanEtiquette.studentNameBn}! তোমার চমৎকার সালাম ও শিষ্টাচারিতার জন্য অনেক ধন্যবাদ। ক্লাসে মনোযোগী হও।`;
    speakBengali(praiseMsg, true, { delayMs: 80 });
  };

  const handleListenStudentEtiquetteVoice = () => {
    if (!lastScanEtiquette) return;
    setEtiquetteSpeechError(null);
    const SpeechRec =
      typeof window !== 'undefined'
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;
    if (!SpeechRec) {
      setEtiquetteSpeechError('এই ব্রাউজারে মাইক্রোফোন ভয়েস শনাক্তকরণ নেই — পাশের সবুজ বাটনে ট্যাপ করুন।');
      return;
    }
    if (isListeningEtiquette && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      setIsListeningEtiquette(false);
      return;
    }
    try {
      const rec = new SpeechRec();
      rec.lang = 'bn-BD';
      rec.interimResults = true;
      rec.maxAlternatives = 3;
      recognitionRef.current = rec;
      setIsListeningEtiquette(true);

      rec.onresult = (event: any) => {
        const transcript = Array.from(event.results || [])
          .map((r: any) => r[0]?.transcript || '')
          .join(' ')
          .toLowerCase();
        if (
          transcript.includes('ওয়ালাইকুম') ||
          transcript.includes('আলাইকুম') ||
          transcript.includes('সালাম') ||
          transcript.includes('walaikum') ||
          transcript.includes('salam') ||
          event.results?.[0]?.isFinal
        ) {
          handleStudentEtiquetteReply('ওয়ালাইকুমুস সালাম ওয়া রাহমাতুল্লাহ (কণ্ঠে উচ্চারিত)');
        }
      };

      rec.onerror = () => {
        setIsListeningEtiquette(false);
        setEtiquetteSpeechError('মাইক্রোফোনে স্পষ্ট শোনা যায়নি — সরাসরি বোতামে ট্যাপ করে উত্তর সম্পন্ন করুন।');
      };

      rec.onend = () => {
        setIsListeningEtiquette(false);
      };

      rec.start();
    } catch {
      setIsListeningEtiquette(false);
      setEtiquetteSpeechError('মাইক্রোফোন চালু করা যায়নি — সরাসরি বোতামে ট্যাপ করুন।');
    }
  };

  // Open confirmation modal OR trigger immediate auto-salam greeting after a scan/match
  const openScanConfirmationModal = (
    student: Student,
    matchedBy: string,
    source: ScannerAuditSource,
    rawPayload: string
  ) => {
    const classNameBn = classes.find((c) => c.id === student.classId)?.nameBn || 'শ্রেণি';
    if (soundBeepEnabled) {
      playScannerBeep();
    }
    if (autoInstantScanGreeting) {
      lastScannedPayloadRef.current = rawPayload;
      lastScannedTimeRef.current = Date.now();
      pendingScanConfirmationRef.current = null;
      setPendingScanConfirmation(null);
      handleVerifyStudent(student, { skipBeep: true, forceVoice: true });
      return;
    }
    const nextPending = {
      student,
      classNameBn,
      matchedBy,
      source,
      rawPayload,
    };
    pendingScanConfirmationRef.current = nextPending;
    setPendingScanConfirmation(nextPending);
    setAmbiguousCandidates([]);
    setBarcodeInput('');
  };

  const handleConfirmPendingScan = () => {
    const pending = pendingScanConfirmationRef.current || pendingScanConfirmation;
    if (!pending) return;
    lastScannedPayloadRef.current = pending.rawPayload;
    lastScannedTimeRef.current = Date.now();
    pendingScanConfirmationRef.current = null;
    setPendingScanConfirmation(null);
    handleVerifyStudent(pending.student, { skipBeep: true, forceVoice: true });
  };

  const handleCancelPendingScan = () => {
    const pending = pendingScanConfirmationRef.current || pendingScanConfirmation;
    if (pending) {
      lastScannedPayloadRef.current = pending.rawPayload;
      lastScannedTimeRef.current = Date.now();
    }
    pendingScanConfirmationRef.current = null;
    setPendingScanConfirmation(null);
    setScannerFeedback('স্ক্যান নিশ্চিতকরণ বাতিল করা হয়েছে — পুনরায় সঠিক কিউআর কোড স্ক্যান করুন।');
    setTimeout(() => setScannerFeedback(null), 3500);
  };

  useEffect(() => {
    if (!pendingScanConfirmation) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancelPendingScan();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pendingScanConfirmation]);

  // Record every scan / search attempt for administrative root-cause diagnostics
  const recordScannerAuditEvent = (
    params: Omit<ScannerAuditEvent, 'id' | 'timestamp'>
  ) => {
    const newEvent: ScannerAuditEvent = {
      ...params,
      id: `scanaudit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
    };
    setScannerAuditLogs((prev) => [newEvent, ...prev.filter((e) => e.id !== newEvent.id)].slice(0, 500));
    try {
      fetch('/api/security/scanner-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: newEvent }),
      }).catch(() => {});
    } catch {
      // Non-fatal
    }
  };

  const handleAmbiguousCandidatePick = (cand: Student) => {
    const clsName = classes.find((c) => c.id === cand.classId)?.nameBn || cand.classId;
    const prevQuery = lastAmbiguousQueryRef.current || getStudentPortalId(cand);
    recordScannerAuditEvent({
      source: 'disambiguation_pick',
      gateAction,
      rawPayload: prevQuery,
      extractedToken: getStudentPortalId(cand),
      outcome: 'matched',
      matchRuleOrReason: 'manual_candidate_selected',
      diagnosticNote: `${describeMatchRuleBn('manual_candidate_selected')} (${cand.nameBn}, ${clsName})`,
      resolvedStudentId: cand.id,
      resolvedStudentNameBn: cand.nameBn,
      resolvedPortalId: getStudentPortalId(cand),
      resolvedClassNameBn: clsName,
      resolvedRoll: cand.roll,
    });
    lastAmbiguousQueryRef.current = '';
    openScanConfirmationModal(cand, 'manual_candidate_selected', 'disambiguation_pick', prevQuery);
  };

  const handleQuickSimulationVerify = (std: Student) => {
    const clsName = classes.find((c) => c.id === std.classId)?.nameBn || std.classId;
    const token = std.securityQrCode || getStudentPortalId(std);
    recordScannerAuditEvent({
      source: 'quick_button',
      gateAction,
      rawPayload: token,
      extractedToken: token,
      outcome: 'matched',
      matchRuleOrReason: 'quick_simulation',
      diagnosticNote: describeMatchRuleBn('quick_simulation'),
      resolvedStudentId: std.id,
      resolvedStudentNameBn: std.nameBn,
      resolvedPortalId: getStudentPortalId(std),
      resolvedClassNameBn: clsName,
      resolvedRoll: std.roll,
    });
    openScanConfirmationModal(std, 'quick_simulation', 'quick_button', token);
  };

  // Filter and match students strictly by unique QR token, student ID, portal ID, birth reg, phone, or unambiguous roll/name
  const handleBarcodeSearchSubmit = (
    inputQuery: string,
    source: 'camera_qr' | 'manual_input' = 'manual_input'
  ) => {
    const trimmedQuery = (inputQuery || '').trim();
    if (!trimmedQuery) return;

    const result = matchStudentByQrOrQuery(trimmedQuery, students, classes);
    const extracted = result.extractedToken || trimmedQuery;

    if (result.student) {
      const clsName =
        classes.find((c) => c.id === result.student!.classId)?.nameBn || result.student.classId;
      const ruleCode = result.matchedBy || 'security_qr';
      recordScannerAuditEvent({
        source,
        gateAction,
        rawPayload: trimmedQuery,
        extractedToken: extracted,
        outcome: 'matched',
        matchRuleOrReason: ruleCode,
        diagnosticNote: describeMatchRuleBn(ruleCode),
        resolvedStudentId: result.student.id,
        resolvedStudentNameBn: result.student.nameBn,
        resolvedPortalId: getStudentPortalId(result.student),
        resolvedClassNameBn: clsName,
        resolvedRoll: result.student.roll,
      });
      lastAmbiguousQueryRef.current = '';
      openScanConfirmationModal(result.student, ruleCode, source, trimmedQuery);
    } else {
      const candidates = result.ambiguousMatches ? result.ambiguousMatches.slice(0, 8) : [];
      const isAmbiguous = candidates.length > 0;
      const reasonCode = result.reason || 'not_found';
      if (isAmbiguous) {
        lastAmbiguousQueryRef.current = trimmedQuery;
      }
      recordScannerAuditEvent({
        source,
        gateAction,
        rawPayload: trimmedQuery,
        extractedToken: extracted,
        outcome: isAmbiguous ? 'ambiguous' : 'rejected',
        matchRuleOrReason: reasonCode,
        diagnosticNote: result.errorMessage || describeMatchRuleBn(reasonCode),
        ambiguousCandidates: isAmbiguous
          ? candidates.slice(0, 6).map((c) => ({
              id: c.id,
              nameBn: c.nameBn,
              classNameBn: classes.find((cls) => cls.id === c.classId)?.nameBn || c.classId,
              roll: c.roll,
              portalId: getStudentPortalId(c),
            }))
          : undefined,
      });

      // Clear stale previous profile so operator never mistakes old profile for failed/ambiguous scan
      setRecentScannedStudent(null);
      setLiveAnnouncement('');
      setAmbiguousCandidates(candidates);
      setScannerFeedback(
        result.errorMessage || `❌ "${trimmedQuery}" কিউআর কোড বা নম্বরে কোনো শিক্ষার্থীর তথ্য পাওয়া যায়নি।`
      );
      setTimeout(() => setScannerFeedback(null), 6500);
    }
  };

  const handleBarcodeSearchSubmitRef = useRef(handleBarcodeSearchSubmit);
  useEffect(() => {
    handleBarcodeSearchSubmitRef.current = handleBarcodeSearchSubmit;
  });

  // Real-Time Camera QR Code Frame Processing Loop (Runs on Mobile Phone Camera)
  useEffect(() => {
    if (!isCameraActive) {
      if (scanAnimationFrameRef.current) {
        cancelAnimationFrame(scanAnimationFrameRef.current);
        scanAnimationFrameRef.current = null;
      }
      return;
    }

    let isRunning = true;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    let barcodeDetector: any = null;
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        // Restrict strictly to QR codes so 1D borders/text lines can never misfire as Roll "1"
        barcodeDetector = new (window as any).BarcodeDetector({
          formats: ['qr_code'],
        });
      } catch {
        barcodeDetector = null;
      }
    }

    const pickBestQrCode = (barcodes: any[], targetW: number, targetH: number): string | null => {
      if (!Array.isArray(barcodes) || barcodes.length === 0) return null;
      const qrOnly = barcodes.filter((b) => {
        const fmt = (b?.format || 'qr_code').toLowerCase();
        const val = typeof b?.rawValue === 'string' ? b.rawValue.trim() : '';
        return fmt === 'qr_code' && val.length >= 4;
      });
      if (qrOnly.length === 0) return null;
      // Prefer school-formatted tokens (DLIKON-*, std_*, guardian=*) if non-school QR codes are in frame
      const schoolQrs = qrOnly.filter((b) => /(DLIKON-|std_|guardian=)/i.test(b.rawValue || ''));
      const pool = schoolQrs.length > 0 ? schoolQrs : qrOnly;
      if (pool.length === 1) return pool[0].rawValue.trim();
      const cx = targetW / 2;
      const cy = targetH / 2;
      let best = pool[0];
      let bestDist = Infinity;
      for (const b of pool) {
        const box = b.boundingBox;
        if (!box) continue;
        const bx = box.x + box.width / 2;
        const by = box.y + box.height / 2;
        const dist = (bx - cx) * (bx - cx) + (by - cy) * (by - cy);
        if (dist < bestDist) {
          bestDist = dist;
          best = b;
        }
      }
      return best.rawValue.trim();
    };

    let lastScanTime = 0;

    const processFrame = async () => {
      if (!isRunning) return;

      const video = videoRef.current;
      const now = Date.now();

      if (
        !pendingScanConfirmationRef.current &&
        video &&
        video.readyState >= 2 &&
        video.videoWidth > 0 &&
        video.videoHeight > 0 &&
        now - lastScanTime >= 100
      ) {
        lastScanTime = now;

        try {
          let detectedCode: string | null = null;
          const vw = video.videoWidth;
          const vh = video.videoHeight;

          // Pass A: Center Viewfinder ROI at FULL 1:1 Camera Resolution (keeps nearby cards out of focus)
          if (ctx) {
            const cropSize = Math.floor(Math.min(vw, vh) * 0.68);
            const cropX = Math.floor((vw - cropSize) / 2);
            const cropY = Math.floor((vh - cropSize) / 2);

            if (canvas.width !== cropSize || canvas.height !== cropSize) {
              canvas.width = cropSize;
              canvas.height = cropSize;
            }

            ctx.drawImage(video, cropX, cropY, cropSize, cropSize, 0, 0, cropSize, cropSize);

            if (barcodeDetector) {
              try {
                const centerBarcodes = await barcodeDetector.detect(canvas);
                detectedCode = pickBestQrCode(centerBarcodes, cropSize, cropSize);
              } catch {
                // Fallback to jsQR
              }
            }

            if (!detectedCode) {
              const centerImgData = ctx.getImageData(0, 0, cropSize, cropSize);
              const qrResult = jsQR(centerImgData.data, cropSize, cropSize, {
                inversionAttempts: 'attemptBoth',
              });
              if (qrResult && qrResult.data && qrResult.data.trim().length >= 4) {
                detectedCode = qrResult.data.trim();
              }
            }
          }

          // Pass B: Full frame fallback (closest QR to center) if center ROI didn't lock
          if (!detectedCode && ctx) {
            const scale = Math.min(1, 800 / Math.max(vw, vh));
            const cw = Math.floor(vw * scale);
            const ch = Math.floor(vh * scale);

            if (canvas.width !== cw || canvas.height !== ch) {
              canvas.width = cw;
              canvas.height = ch;
            }

            ctx.drawImage(video, 0, 0, cw, ch);

            if (barcodeDetector) {
              try {
                const fullBarcodes = await barcodeDetector.detect(canvas);
                detectedCode = pickBestQrCode(fullBarcodes, cw, ch);
              } catch {
                // Fallback to jsQR
              }
            }

            if (!detectedCode) {
              const fullImgData = ctx.getImageData(0, 0, cw, ch);
              const fullResult = jsQR(fullImgData.data, cw, ch, {
                inversionAttempts: 'attemptBoth',
              });
              if (fullResult && fullResult.data && fullResult.data.trim().length >= 4) {
                detectedCode = fullResult.data.trim();
              }
            }
          }

          if (detectedCode && detectedCode.trim()) {
            const trimmed = detectedCode.trim();
            const timeSinceLast = Date.now() - lastScannedTimeRef.current;

            if (trimmed !== lastScannedPayloadRef.current || timeSinceLast > 2500) {
              lastScannedPayloadRef.current = trimmed;
              lastScannedTimeRef.current = Date.now();

              if (typeof navigator !== 'undefined' && navigator.vibrate) {
                try {
                  navigator.vibrate([80, 40, 80]);
                } catch {}
              }

              setScanSuccessPulse(true);
              setTimeout(() => setScanSuccessPulse(false), 900);

              handleBarcodeSearchSubmitRef.current(trimmed, 'camera_qr');
            }
          }
        } catch (err) {
          console.warn('QR scan processing error:', err);
        }
      }

      if (isRunning) {
        scanAnimationFrameRef.current = requestAnimationFrame(processFrame);
      }
    };

    scanAnimationFrameRef.current = requestAnimationFrame(processFrame);

    return () => {
      isRunning = false;
      if (scanAnimationFrameRef.current) {
        cancelAnimationFrame(scanAnimationFrameRef.current);
        scanAnimationFrameRef.current = null;
      }
    };
  }, [isCameraActive]);

  // =========================================================================
  // PART 1: GUARDIAN ACCOUNT LOGIN & PRIVATE DASHBOARD STATES
  // =========================================================================
  const [guardianLoginClassId, setGuardianLoginClassId] = useState<string>('all');
  const [guardianLoginIdentifier, setGuardianLoginIdentifier] = useState<string>('');
  const [guardianLoginPin, setGuardianLoginPin] = useState<string>('');
  const [loggedInGuardianStudent, setLoggedInGuardianStudent] = useState<Student | null>(null);
  const [guardianLoginError, setGuardianLoginError] = useState<string | null>(null);

  // Guardian Response / Acknowledgement & Admin Pairing Link States
  const [guardianReplyText, setGuardianReplyText] = useState<string>('');
  const [isSubmittingAck, setIsSubmittingAck] = useState<boolean>(false);
  const [ackSuccessFeedback, setAckSuccessFeedback] = useState<string | null>(null);
  const [guardianShareClassId, setGuardianShareClassId] = useState<string>('class_4');
  const [copiedGuardianLinkId, setCopiedGuardianLinkId] = useState<string | null>(null);
  const [showAdminPairingPanel, setShowAdminPairingPanel] = useState<boolean>(false);
  const [showScheduleEditor, setShowScheduleEditor] = useState<boolean>(false);
  const [scheduleDraft, setScheduleDraft] = useState({
    ptStartTimeBn: activeDailySchedule.ptStartTimeBn,
    classStartTimeBn: activeDailySchedule.classStartTimeBn,
    breakTimeBn: activeDailySchedule.breakTimeBn,
    dismissalTimeBn: activeDailySchedule.dismissalTimeBn,
  });

  useEffect(() => {
    setScheduleDraft(activeDailySchedule);
  }, [activeDailySchedule]);

  // Auto-restore paired guardian session ONLY when operating as guardian portal or explicit forcedStudentId
  useEffect(() => {
    if (students.length === 0) return;
    if (restrictedMode === 'employee_scanner') return;

    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const urlGuardian = params?.get('unlock') !== '1' ? params?.get('guardian') : null;
    const isGuardianView =
      restrictedMode === 'student_only' || activeTab === 'guardian_portal' || Boolean(forcedStudentId || urlGuardian);
    if (!isGuardianView) return;

    const savedPairedId =
      typeof window !== 'undefined' ? localStorage.getItem('dlikon_guardian_paired_student_id') : null;
    const targetId = forcedStudentId || urlGuardian || savedPairedId;

    if (targetId && (!loggedInGuardianStudent || (forcedStudentId && loggedInGuardianStudent.id !== forcedStudentId) || (urlGuardian && loggedInGuardianStudent.id !== urlGuardian))) {
      const found = students.find(
        (s) =>
          s.id === targetId ||
          (s.securityQrCode && s.securityQrCode.toLowerCase() === targetId.toLowerCase())
      );
      if (found) {
        if (urlGuardian) {
          clearExplicitUnlockFlag();
        }
        setLoggedInGuardianStudent(found);
        setGuardianLoginClassId(found.classId);
        setGuardianLoginIdentifier(String(found.roll));
        if (typeof window !== 'undefined') {
          localStorage.setItem('dlikon_guardian_paired_student_id', found.id);
          if (urlGuardian || forcedStudentId) {
            localStorage.setItem('dlikon_pwa_guardian_mode', 'true');
          }
        }
      }
    }
  }, [students, loggedInGuardianStudent, forcedStudentId]);

  // Helper to convert Bengali numerals to English digits for reliable matching
  const normalizeDigits = (val: string) => {
    const bnMap: Record<string, string> = {
      '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
      '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
    };
    return val.replace(/[০-৯]/g, (d) => bnMap[d] || d);
  };

  // Always keep signed-in student object synced with live updates (photo, futurePlan, achievements, PIN)
  const activeSignedInStudent = useMemo(() => {
    if (!loggedInGuardianStudent) return null;
    return students.find((s) => s.id === loggedInGuardianStudent.id) || loggedInGuardianStudent;
  }, [loggedInGuardianStudent, students]);

  // Fallback realtime telemetry when Official previews a Guardian Dashboard (no external App-level hook passed)
  const previewRealtime = useGatepassRealtime({
    role: 'student',
    studentId: activeSignedInStudent?.id || null,
    portalId: activeSignedInStudent ? getStudentPortalId(activeSignedInStudent) : null,
    classId: activeSignedInStudent?.classId || null,
    roll: activeSignedInStudent?.roll || null,
    enabled: !realtimeDiagnostics && activeTab === 'guardian_portal' && Boolean(activeSignedInStudent),
  });

  const effectiveRealtimeTransport = realtimeTransport ?? previewRealtime.connectionTransport;
  const effectiveRealtimeSyncHealth = realtimeSyncHealth ?? previewRealtime.syncHealth;
  const effectiveForceCheckRealtime = onForceCheckRealtime ?? previewRealtime.forceCheckNow;
  const effectiveRealtimeDiagnostics = realtimeDiagnostics ?? previewRealtime.diagnostics;
  const effectiveSendDiagnosticPing = onSendDiagnosticPing ?? previewRealtime.sendDiagnosticPing;
  const effectiveReconnectRealtime = onReconnectRealtime ?? previewRealtime.reconnectRealtime;
  const effectiveClearDiagnosticLogs = onClearDiagnosticLogs ?? previewRealtime.clearDiagnosticLogs;
  const effectiveLiveRingingAlert = externalLiveRingingAlert ?? previewRealtime.liveRingingAlert;
  const effectiveDismissLiveRingingAlert =
    onDismissExternalRingingAlert ?? previewRealtime.dismissLiveRingingAlert;

  // Authenticate Guardian/Student (Strictly isolated per student via Portal ID, Class+Roll, or Phone + Password)
  const handleGuardianLogin = (identifier: string, pin: string, classIdFilter: string = guardianLoginClassId) => {
    setGuardianLoginError(null);
    const rawTrim = identifier.trim();
    const cleanId = normalizeDigits(rawTrim).toLowerCase();
    const cleanPin = normalizeDigits(pin.trim());

    if (!cleanId) {
      setGuardianLoginError('অনুগ্রহ করে শিক্ষার্থীর ইউনিক আইডি (যেমন: DL-C4-01), রোল অথবা মোবাইল নম্বর লিখুন।');
      return;
    }

    const pool =
      classIdFilter && classIdFilter !== 'all'
        ? students.filter((s) => s.classId === classIdFilter)
        : students;

    const cleanDigits = cleanId.replace(/\D/g, '');
    const isLikelyRoll = cleanDigits.length > 0 && cleanDigits.length <= 3 && !cleanId.includes('-');

    // First check exact unique matches (Portal ID like DL-C4-01 / Student ID / QR Code / Phone number)
    const cleanUpper = rawTrim.toUpperCase();
    let matched: Student | undefined = students.find((s) => {
      const portalCode = getStudentPortalId(s).toUpperCase();
      return portalCode === cleanUpper || s.id.toLowerCase() === cleanId || (s.securityQrCode && s.securityQrCode.toLowerCase() === cleanId);
    });

    if (!matched) {
      matched = pool.find((s) => {
        const matchPhone =
          cleanDigits.length >= 6 &&
          ((s.guardianPhone && normalizeDigits(s.guardianPhone).replace(/\D/g, '').endsWith(cleanDigits.slice(-8))) ||
            (s.fatherPhone && normalizeDigits(s.fatherPhone).replace(/\D/g, '').endsWith(cleanDigits.slice(-8))) ||
            (s.motherPhone && normalizeDigits(s.motherPhone).replace(/\D/g, '').endsWith(cleanDigits.slice(-8))) ||
            (s.emergencyPhone && normalizeDigits(s.emergencyPhone).replace(/\D/g, '').endsWith(cleanDigits.slice(-8))));
        return matchPhone;
      });
    }

    if (!matched && isLikelyRoll) {
      const rollMatches = pool.filter((s) => String(s.roll) === String(Number(cleanDigits)));
      if (rollMatches.length > 1 && (!classIdFilter || classIdFilter === 'all')) {
        setGuardianLoginError(
          `রোল নম্বর ${toBengaliRoll(Number(cleanDigits))} একাধিক শ্রেণিতে রয়েছে (${rollMatches.length} জন)! অনুগ্রহ করে উপর থেকে আপনার সন্তানের নির্দিষ্ট "শ্রেণি" নির্বাচন করুন অথবা ইউনিক আইডি (যেমন: DL-C4-01) দিন।`
        );
        return;
      }
      matched = rollMatches[0];
    }

    if (!matched) {
      // Fallback exact name match within selected class
      if (classIdFilter && classIdFilter !== 'all') {
        matched = pool.find((s) => s.nameBn.toLowerCase().includes(rawTrim.toLowerCase()));
      }
    }

    if (!matched) {
      setGuardianLoginError('প্রদত্ত ইউনিক আইডি, শ্রেণি, রোল বা মোবাইল নম্বরের কোনো শিক্ষার্থী পাওয়া যায়নি।');
      return;
    }

    // Strict Password/PIN check (falls back to '1234' only if custom password hasn't been set yet)
    const expectedPin = normalizeDigits((matched.guardianPin || '1234').trim()).toLowerCase();
    if (!cleanPin || cleanPin.toLowerCase() !== expectedPin) {
      setGuardianLoginError('ভুল পাসওয়ার্ড/পিন কোড! সঠিক ব্যক্তিগত পাসওয়ার্ড দিন (প্রথমবার হলে ডিফল্ট পিন: 1234)।');
      return;
    }

    setLoggedInGuardianStudent(matched);
    if (typeof window !== 'undefined') {
      localStorage.setItem('dlikon_guardian_paired_student_id', matched.id);
      localStorage.setItem('dlikon_pwa_guardian_mode', 'true');
    }
    unlockMobileAudioAndSpeech();
    playAlarmChime();
  };

  // Logout & Clear Guardian Device Pairing
  const handleGuardianLogout = () => {
    setGuardianLiveWatchActive(false);
    setLoggedInGuardianStudent(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('dlikon_guardian_paired_student_id');
      localStorage.removeItem('dlikon_pwa_guardian_mode');
    }
  };

  // Quick 1-click test login for user convenience
  const handleQuickTestGuardianLogin = (std: Student) => {
    setLoggedInGuardianStudent(std);
    setGuardianLoginClassId(std.classId);
    setGuardianLoginIdentifier(std.guardianPhone || String(std.roll));
    setGuardianLoginPin(std.guardianPin || '');
    if (typeof window !== 'undefined') {
      localStorage.setItem('dlikon_guardian_paired_student_id', std.id);
      localStorage.setItem('dlikon_pwa_guardian_mode', 'true');
    }
    unlockMobileAudioAndSpeech();
    playAlarmChime();
  };

  // Build Personal Guardian Direct Pairing URL matching active bridge selection or same live origin
  const getGuardianDirectUrl = (student: Student, preferSharedPre = false) => {
    if (typeof window === 'undefined') return '';
    const isDev = window.location.origin.includes('://ais-dev-');
    const usePre = isDev && (preferSharedPre || bridgeOriginMode === 'pre' || siblingPreStatus.reachable);
    const origin = usePre
      ? window.location.origin.replace('://ais-dev-', '://ais-pre-')
      : window.location.origin;
    return `${origin}/?tab=security&guardian=${encodeURIComponent(student.id)}`;
  };

  const handleCopyGuardianLink = (student: Student) => {
    const url = getGuardianDirectUrl(student);
    if (navigator.clipboard && url) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
    setCopiedGuardianLinkId(student.id);
    setTimeout(() => setCopiedGuardianLinkId(null), 2500);
  };

  // Filter logs strictly for logged in guardian's child (matches ID, Portal ID, or Class+Roll)
  const guardianChildLogs = useMemo(() => {
    if (!loggedInGuardianStudent) return [];
    const targetPortalId = getStudentPortalId(loggedInGuardianStudent).toUpperCase();
    return securityLogs.filter(
      (log) =>
        log.studentId === loggedInGuardianStudent.id ||
        (log.portalUserId && log.portalUserId.toUpperCase() === targetPortalId) ||
        (log.classId === loggedInGuardianStudent.classId &&
          Number(log.studentRoll) === Number(loggedInGuardianStudent.roll))
    );
  }, [securityLogs, loggedInGuardianStudent]);

  const latestChildAlarm = guardianChildLogs[0] || null;

  // Guardian Response Counts across all security logs (counted in DB)
  const guardianResponseStats = useMemo(() => {
    const totalScans = securityLogs.length;
    const totalResponded = securityLogs.filter((l) => l.guardianAcknowledged).length;
    const pendingCount = totalScans - totalResponded;
    return { totalScans, totalResponded, pendingCount };
  }, [securityLogs]);

  // Handle Guardian Acknowledgement / Response to Voice Message
  const handleGuardianAcknowledge = async (log: SecurityGatepassLog, customResponseText?: string) => {
    if (!loggedInGuardianStudent) return;
    setIsSubmittingAck(true);
    const responder =
      loggedInGuardianStudent.fatherNameBn ||
      loggedInGuardianStudent.guardianName ||
      loggedInGuardianStudent.motherNameBn ||
      'অভিভাবক';
    const text =
      (customResponseText || guardianReplyText).trim() || 'মেসেজ শুনেছি ও নিশ্চিত করলাম (ধন্যবাদ)';
    await acknowledgeSecurityLog(log.id, text, responder);
    playScannerBeep(1400, 100);
    setGuardianReplyText('');
    setIsSubmittingAck(false);
    setAckSuccessFeedback('✓ আপনার রেসপন্স স্কুলের ডাটাবেজে সফলভাবে কাউন্ট ও সংরক্ষিত হয়েছে!');
    setTimeout(() => setAckSuccessFeedback(null), 4000);
  };

  // Guardian Real-Time Live Audio Alarm & Background Sync (Shared Preference + Deduplicated)
  const [guardianAudioEnabled, setGuardianAudioEnabledState] = useState<boolean>(() =>
    isGuardianAudioEnabledPref()
  );
  const setGuardianAudioEnabled = (val: boolean) => {
    setGuardianAudioEnabledState(val);
    setGuardianAudioEnabledPref(val);
  };
  const [guardianAudioTested, setGuardianAudioTested] = useState<boolean>(false);
  const [isGuardianAlarmRinging, setIsGuardianAlarmRinging] = useState<boolean>(false);
  const [isSpeechStreamActive, setIsSpeechStreamActive] = useState<boolean>(false);
  const [audioHardwareStatus, setAudioHardwareStatus] = useState(() => getGuardianAudioStatus());
  const [wakeAudioFeedback, setWakeAudioFeedback] = useState<'idle' | 'waking' | 'awake'>('idle');

  useEffect(() => {
    return subscribeGuardianAudioStatus(setAudioHardwareStatus);
  }, []);

  useEffect(() => {
    return subscribeSpeechPlayback(setIsSpeechStreamActive);
  }, []);

  const handleWakeAudio = async () => {
    setWakeAudioFeedback('waking');
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis) {
      try {
        window.speechSynthesis.resume();
      } catch {
        // Non-fatal
      }
    }
    if (activeTab === 'guardian_portal' || restrictedMode === 'student_only') {
      setGuardianLiveWatchActive(true);
    }
    const result = await playSilentAudioTrack();
    logGuardianAudioEngineDiagnostics('persistent_wake_audio_button');
    if (getPendingBlockedSpeech()) {
      replayPendingBlockedSpeech();
    }
    setWakeAudioFeedback(result.ok ? 'awake' : 'idle');
    setTimeout(() => {
      setWakeAudioFeedback((prev) => (prev === 'awake' ? 'idle' : prev));
    }, 3500);
  };

  const logGuardianAudioEngineDiagnostics = (triggerSource: string) => {
    if (typeof window === 'undefined') return null;

    const AudioCtxCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    const sharedCtx = getSharedAudioContext();
    const hwStatus = getGuardianAudioStatus();

    const speechSupported = 'speechSynthesis' in window && Boolean(window.speechSynthesis);
    const voices = speechSupported ? window.speechSynthesis.getVoices() : [];
    const bengaliVoices = voices.filter((v) =>
      /^(bn|ben)/i.test(v.lang) || /bengali|bangla|বাংলা/i.test(`${v.name} ${v.lang}`)
    );

    const userActivation = (navigator as Navigator & {
      userActivation?: { isActive?: boolean; hasBeenActive?: boolean };
    }).userActivation;

    const diagnosticSnapshot = {
      timestamp: new Date().toISOString(),
      triggerSource,
      studentId: activeSignedInStudent?.id || loggedInGuardianStudent?.id || null,
      audioContext: {
        constructorSupported: Boolean(AudioCtxCtor),
        sharedInstanceState: sharedCtx ? sharedCtx.state : 'unavailable',
        sampleRate: sharedCtx?.sampleRate ?? null,
        baseLatency: sharedCtx && 'baseLatency' in sharedCtx ? sharedCtx.baseLatency : null,
      },
      speechSynthesis: {
        supported: speechSupported,
        speaking: speechSupported ? window.speechSynthesis.speaking : false,
        pending: speechSupported ? window.speechSynthesis.pending : false,
        paused: speechSupported ? window.speechSynthesis.paused : false,
        totalVoices: voices.length,
        bengaliVoicesCount: bengaliVoices.length,
        bengaliVoices: bengaliVoices.map((v) => ({
          name: v.name,
          lang: v.lang,
          localService: v.localService,
          default: v.default,
        })),
        sampleVoices: voices.slice(0, 12).map((v) => ({
          name: v.name,
          lang: v.lang,
          localService: v.localService,
        })),
      },
      guardianAudioHardware: {
        ...hwStatus,
        guardianAudioEnabled,
      },
      environment: {
        visibilityState: typeof document !== 'undefined' ? document.visibilityState : 'unknown',
        onLine: typeof navigator !== 'undefined' ? navigator.onLine : true,
        notificationPermission:
          typeof window !== 'undefined' && 'Notification' in window
            ? Notification.permission
            : 'unsupported',
        userActivationIsActive: userActivation?.isActive ?? null,
        userActivationHasBeenActive: userActivation?.hasBeenActive ?? null,
      },
    };

    console.info('[GuardianAudioDiagnostic]', diagnosticSnapshot);

    const diagLevel =
      !sharedCtx || sharedCtx.state !== 'running'
        ? 'warn'
        : voices.length === 0 || bengaliVoices.length === 0
        ? 'warn'
        : 'ok';

    recordAudioEngineDiagnostic(
      diagLevel,
      `Audio Engine Snapshot (${triggerSource}): AudioContext='${diagnosticSnapshot.audioContext.sharedInstanceState}', Voices=${voices.length} (bn=${bengaliVoices.length})`,
      `speechSpeaking=${diagnosticSnapshot.speechSynthesis.speaking}, paused=${diagnosticSnapshot.speechSynthesis.paused}, unlocked=${hwStatus.unlocked}, engine=${hwStatus.lastEngineUsed}, err=${hwStatus.lastPlaybackError || 'none'}`
    );

    return diagnosticSnapshot;
  };

  const handleTestGuardianAudio = (playDemo: boolean = false) => {
    logGuardianAudioEngineDiagnostics(
      playDemo ? 'guardian_demo_test_button' : 'guardian_activate_audio_button'
    );
    const existingPending = getPendingBlockedSpeech();
    const targetStudent = activeSignedInStudent || loggedInGuardianStudent;

    // Synchronously resume AudioContext inside the tap gesture before any async TTS network fetch
    const sharedCtx = getSharedAudioContext();
    if (sharedCtx && sharedCtx.state !== 'running' && sharedCtx.state !== 'closed') {
      void sharedCtx.resume().catch(() => {});
    }

    // Preserve and immediately replay a real pending arrival/exit alert instead of silently discarding it
    if (!playDemo && existingPending) {
      setGuardianLiveWatchActive(true);
      void requestGuardianNotificationPermission();
      setGuardianAudioTested(true);
      setGuardianAudioEnabled(true);
      setIsGuardianAlarmRinging(true);
      if (targetStudent) {
        void prewarmGuardianVoiceCache(targetStudent, activeDailySchedule);
      }
      replayPendingBlockedSpeech();
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate([150, 60, 150]);
        } catch {}
      }
      setTimeout(() => setIsGuardianAlarmRinging(false), 18000);
      return;
    }

    setPendingBlockedSpeech(null);
    unlockMobileAudioAndSpeech(false);
    setGuardianLiveWatchActive(true);
    void requestGuardianNotificationPermission();
    setGuardianAudioTested(true);
    setGuardianAudioEnabled(true);
    setIsGuardianAlarmRinging(true);
    playScannerBeep(1046.5, 90);

    if (playDemo) {
      const demoStudent = targetStudent || ({ id: forcedStudentId || 'demo', nameBn: 'আপনার সন্তান' } as Student);
      recordAudioEngineDiagnostic(
        'info',
        `নাম ধরে ডেমো ভয়েস টেস্ট শুরু হয়েছে (${demoStudent.nameBn})`
      );
      speakRepeatedGuardianAlert(demoStudent, 'entry', activeDailySchedule, {
        repeatCount: 3,
        delayMs: 0,
        onBlocked: () => {
          setIsGuardianAlarmRinging(false);
          recordAudioEngineDiagnostic(
            'warn',
            `ডেমো ভয়েস টেস্ট অটোপ্লে/ভয়েস ইঞ্জিন বাধাপ্রাপ্ত হয়েছে (${demoStudent.nameBn})`
          );
        },
      });
    } else {
      const msg = targetStudent
        ? `${targetStudent.nameBn}-এর লাইভ ভয়েস এলার্ম সক্রিয় হয়েছে। এখন স্কুলে কার্ড স্ক্যান হলেই এই ফোনে ${targetStudent.nameBn}-এর নাম ধরে বার্তা বেজে উঠবে।`
        : `লাইভ অভিভাবক অডিও এলার্ম সক্রিয় হয়েছে।`;
      speakBengali(msg, true, { delayMs: 0, studentNameBn: targetStudent?.nameBn });
    }
    if (targetStudent) {
      setTimeout(() => {
        void prewarmGuardianVoiceCache(targetStudent, activeDailySchedule);
      }, 3200);
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([150, 60, 150]);
      } catch {}
    }
    setTimeout(() => setIsGuardianAlarmRinging(false), playDemo ? 18000 : 8000);
  };

  // Keep latest signed-in student ref synced without resetting listeners on profile edits
  const activeSignedInStudentRef = useRef<Student | null>(null);
  activeSignedInStudentRef.current = activeSignedInStudent || loggedInGuardianStudent;

  // Real-time Firestore listener alarm (deduplicated via shared seenGatepassLogIds)
  const hasSeededCloudLogsRef = useRef<boolean>(false);
  useEffect(() => {
    hasSeededCloudLogsRef.current = false;
  }, [loggedInGuardianStudent?.id]);

  useEffect(() => {
    const signedStudent = activeSignedInStudentRef.current;
    if (
      !signedStudent ||
      !cloudUser ||
      Boolean(forcedStudentId) ||
      restrictedMode === 'employee_scanner' ||
      activeTab !== 'guardian_portal'
    ) {
      return;
    }

    const targetPortal = getStudentPortalId(signedStudent).toUpperCase();
    const childLogs = securityLogs.filter(
      (l) =>
        l.studentId === signedStudent.id ||
        (l.portalUserId && l.portalUserId.toUpperCase() === targetPortal) ||
        (l.classId === signedStudent.classId &&
          Number(l.studentRoll) === Number(signedStudent.roll))
    );
    if (!hasSeededCloudLogsRef.current) {
      hasSeededCloudLogsRef.current = true;
      const nowMs = Date.now();
      let recentLog: SecurityGatepassLog | null = null;
      for (const l of childLogs) {
        const logTimeMs = l.serverTimestamp || new Date(l.timestamp).getTime() || 0;
        markGatepassLogSeen(l.id);
        if (!hasPlayedGuardianVoiceLog(l.id)) {
          if (!recentLog && nowMs - logTimeMs <= 45000 && nowMs - logTimeMs >= -5000 && !l.guardianAcknowledged) {
            recentLog = l;
          } else {
            markGuardianVoiceLogPlayed(l.id);
          }
        }
      }
      if (recentLog && guardianAudioEnabled) {
        markGuardianVoiceLogPlayed(recentLog.id);
        setIsGuardianAlarmRinging(true);
        playAlarmChime();
        const act: 'entry' | 'exit' = recentLog.action === 'exit' ? 'exit' : 'entry';
        const announcement = buildGuardianVoiceMessage(signedStudent, act);
        speakRepeatedGuardianAlert(signedStudent, act, activeDailySchedule, {
          repeatCount: 3,
          delayMs: 240,
          onBlocked: () => {
            setPendingBlockedSpeech({
              message: announcement,
              logId: recentLog.id,
              studentNameBn: signedStudent.nameBn,
              action: act,
              dailySchedule: activeDailySchedule,
            });
          },
        });
        setTimeout(() => setIsGuardianAlarmRinging(false), 26000);
      }
      return;
    }

    let freshCloudLog: SecurityGatepassLog | null = null;
    for (const l of childLogs) {
      markGatepassLogSeen(l.id);
      if (!hasPlayedGuardianVoiceLog(l.id)) {
        markGuardianVoiceLogPlayed(l.id);
        if (!freshCloudLog) {
          freshCloudLog = l;
        }
      }
    }
    if (freshCloudLog && guardianAudioEnabled) {
      setIsGuardianAlarmRinging(true);
      playAlarmChime();
      const act: 'entry' | 'exit' = freshCloudLog.action === 'exit' ? 'exit' : 'entry';
      const announcement = buildGuardianVoiceMessage(signedStudent, act);
      showGuardianSystemNotification(
        `${schoolInfo.name} • লাইভ গেটপাস`,
        announcement
      );
      speakRepeatedGuardianAlert(signedStudent, act, activeDailySchedule, {
        repeatCount: 3,
        delayMs: 240,
        onBlocked: () => {
          setPendingBlockedSpeech({
            message: announcement,
            logId: freshCloudLog!.id,
            studentNameBn: signedStudent.nameBn,
            action: act,
            dailySchedule: activeDailySchedule,
          });
        },
      });
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate([200, 100, 200, 100, 400]);
        } catch {}
      }
      setTimeout(() => setIsGuardianAlarmRinging(false), 26000);
    }
  }, [securityLogs, cloudUser, restrictedMode, activeTab, loggedInGuardianStudent?.id, guardianAudioEnabled, schoolInfo.name, activeDailySchedule]);

  // Fetch & poll persistent QR scanner audit events when viewing Scanner or Scanner Audit tab
  const fetchScannerAuditLogsFromServer = async (showSpinner = false) => {
    if (restrictedMode !== 'full') return;
    if (showSpinner) setScannerAuditLoading(true);
    try {
      const res = await fetch('/api/security/scanner-audit?limit=300');
      if (!res.ok) return;
      const data = await res.json();
      if (data && Array.isArray(data.logs)) {
        setScannerAuditLogs(data.logs);
      }
    } catch {
      // Non-fatal
    } finally {
      if (showSpinner) setScannerAuditLoading(false);
    }
  };

  useEffect(() => {
    if (restrictedMode !== 'full') return;
    if (activeTab !== 'barcode_scanner' && activeTab !== 'scanner_audit') return;

    fetchScannerAuditLogsFromServer(activeTab === 'scanner_audit');
    const timer = setInterval(() => {
      fetchScannerAuditLogsFromServer(false);
    }, 4000);

    return () => clearInterval(timer);
  }, [activeTab, restrictedMode]);

  // Also poll server every 3.5 seconds when school staff is viewing Scanner or Audit Logs
  // so guardian responses & live online guardian connection telemetry stay real-time!
  useEffect(() => {
    if (activeTab !== 'barcode_scanner' && activeTab !== 'audit_logs') return;

    let isSubscribed = true;
    const syncLogsFromServer = async () => {
      try {
        const res = await fetch('/api/security/latest-logs', { cache: 'no-store' });
        const parsed = await parseJsonApiResponse<any>(res);
        if (!isSubscribed) return;
        if (parsed.staticHostNoBackend) {
          setLiveServerHealth((prev) => ({
            ...prev,
            reachable: false,
            authRedirected: false,
            staticHostNoBackend: true,
          }));
          return;
        }
        if (parsed.authRedirected) {
          setLiveServerHealth((prev) => ({
            ...prev,
            reachable: false,
            authRedirected: true,
            staticHostNoBackend: false,
          }));
          return;
        }
        if (parsed.ok && parsed.data && Array.isArray(parsed.data.logs)) {
          for (const serverLog of parsed.data.logs.slice(0, 50)) {
            addSecurityLog(serverLog, { suppressAutoPush: true });
          }
        }
      } catch {
        // Non-fatal
      }

      if (activeTab === 'barcode_scanner') {
        try {
          const hRes = await fetch('/api/security/health', { cache: 'no-store' });
          const hParsed = await parseJsonApiResponse<any>(hRes);
          if (!isSubscribed) return;
          if (hParsed.staticHostNoBackend) {
            setLiveServerHealth({
              reachable: false,
              authRedirected: false,
              staticHostNoBackend: true,
              serverInstanceId: '',
              onlineGuardians: [],
            });
          } else if (hParsed.authRedirected) {
            setLiveServerHealth({
              reachable: false,
              authRedirected: true,
              staticHostNoBackend: false,
              serverInstanceId: '',
              onlineGuardians: [],
            });
          } else if (hParsed.ok && hParsed.data) {
            setLiveServerHealth({
              reachable: true,
              authRedirected: false,
              staticHostNoBackend: false,
              serverInstanceId:
                typeof hParsed.data.serverInstanceId === 'string' ? hParsed.data.serverInstanceId : '',
              onlineGuardians: Array.isArray(hParsed.data.onlineGuardians)
                ? hParsed.data.onlineGuardians
                : [],
            });
          } else {
            setLiveServerHealth((prev) => ({ ...prev, reachable: false }));
          }
        } catch {
          if (isSubscribed) {
            setLiveServerHealth((prev) => ({ ...prev, reachable: false }));
          }
        }
      }
    };

    syncLogsFromServer();
    const timer = setInterval(syncLogsFromServer, 3500);

    return () => {
      isSubscribed = false;
      clearInterval(timer);
    };
  }, [activeTab, addSecurityLog]);

  // =========================================================================
  // PART 3: DOUBLE-SIDED ID CARD GENERATOR STATES
  // =========================================================================
  const [idCardClassFilter, setIdCardClassFilter] = useState<string>(selectedClassId || 'all');
  const [idCardSideView, setIdCardSideView] = useState<'both' | 'front' | 'back'>('both');
  const [idCardOrientation, setIdCardOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [selectedStudentForIdCard, setSelectedStudentForIdCard] = useState<Student | null>(null);
  const [photoTargetStudentId, setPhotoTargetStudentId] = useState<string>('');
  const [photoUploadStatus, setPhotoUploadStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [isLoadingSamplePhotos, setIsLoadingSamplePhotos] = useState<boolean>(false);

  // Print & Quick Edit States
  const printSheetsContainerRef = useRef<HTMLDivElement>(null);
  const [idCardDisplayMode, setIdCardDisplayMode] = useState<'cards' | 'sheets'>('cards');
  const [quickEditStudent, setQuickEditStudent] = useState<Student | null>(null);

  const idCardFilteredStudents = useMemo(() => {
    if (idCardClassFilter === 'all') return students;
    return students.filter((s) => s.classId === idCardClassFilter);
  }, [students, idCardClassFilter]);

  // Compute exact 4-cards-per-A4-page chunks (2x2 grid layout OR 2 fold-units for duplex)
  interface IdCardPrintSlot {
    student: Student;
    side: 'front' | 'back';
    studentIndex: number;
  }

  interface IdCardPrintSheet {
    sheetIndex: number;
    students: Student[];
    slots: IdCardPrintSlot[];
  }

  const idCardPrintSheets = useMemo<IdCardPrintSheet[]>(() => {
    const sheets: IdCardPrintSheet[] = [];

    if (idCardSideView === 'both') {
      // Both sides: 2 students per A4 sheet (2 front + 2 back = 4 cards per sheet)
      // Front and Back touch side-by-side with zero gap (fold layout)
      for (let i = 0; i < idCardFilteredStudents.length; i += 2) {
        const slots: IdCardPrintSlot[] = [];
        const sheetStudents: Student[] = [];
        const std1 = idCardFilteredStudents[i];
        if (std1) {
          sheetStudents.push(std1);
          slots.push({ student: std1, side: 'front', studentIndex: i });
          slots.push({ student: std1, side: 'back', studentIndex: i });
        }
        const std2 = idCardFilteredStudents[i + 1];
        if (std2) {
          sheetStudents.push(std2);
          slots.push({ student: std2, side: 'front', studentIndex: i + 1 });
          slots.push({ student: std2, side: 'back', studentIndex: i + 1 });
        }
        sheets.push({
          sheetIndex: sheets.length,
          students: sheetStudents,
          slots,
        });
      }
    } else {
      // Single side (front or back): 4 students per A4 sheet in standard 2x2 grid
      const side = idCardSideView;
      for (let i = 0; i < idCardFilteredStudents.length; i += 4) {
        const slots: IdCardPrintSlot[] = [];
        const sheetStudents: Student[] = [];
        for (let j = 0; j < 4; j++) {
          const std = idCardFilteredStudents[i + j];
          if (std) {
            sheetStudents.push(std);
            slots.push({ student: std, side, studentIndex: i + j });
          }
        }
        sheets.push({
          sheetIndex: sheets.length,
          students: sheetStudents,
          slots,
        });
      }
    }

    return sheets;
  }, [idCardFilteredStudents, idCardSideView]);

  // Clean print triggers that bypass iframe sandboxing and use pristine A4 sheets
  const handleOpenPrintTab = () => {
    const targetClass = classes.find((c) => c.id === idCardClassFilter);
    const classNameBn = targetClass ? targetClass.nameBn : 'সকল শ্রেণি';
    const container = printSheetsContainerRef.current;
    if (!container || !container.innerHTML.trim()) {
      alert('প্রিন্ট করার মতো কোনো কার্ড পাওয়া যায়নি।');
      return;
    }
    const modeDesc =
      idCardSideView === 'both'
        ? `এপিঠ ও ওপিঠ স্পর্শমান ভাজ মোড (প্রতি পাতায় ২ জনের স্পর্শমান এপিঠ-ওপিঠ = ৪টি কার্ড, মোট ${toBengaliNumber(idCardPrintSheets.length)} পাতা)`
        : idCardSideView === 'front'
        ? `১ম পৃষ্ঠা (প্রতি পাতায় ৪ জন, মোট ${toBengaliNumber(idCardPrintSheets.length)} পাতা)`
        : `২য় পৃষ্ঠা (প্রতি পাতায় ৪ জন, মোট ${toBengaliNumber(idCardPrintSheets.length)} পাতা)`;
    openIdCardsInNewTab(schoolInfo.name, classNameBn, container.innerHTML, modeDesc);
  };

  const handleDownloadOfflinePrintHtml = () => {
    const targetClass = classes.find((c) => c.id === idCardClassFilter);
    const classNameBn = targetClass ? targetClass.nameBn : 'সকল শ্রেণি';
    const container = printSheetsContainerRef.current;
    if (!container || !container.innerHTML.trim()) {
      alert('ডাউনলোড করার মতো কোনো কার্ড পাওয়া যায়নি।');
      return;
    }
    const modeDesc =
      idCardSideView === 'both'
        ? `এপিঠ ও ওপিঠ স্পর্শমান ভাজ মোড (প্রতি পাতায় ২ জনের স্পর্শমান এপিঠ-ওপিঠ = ৪টি কার্ড, মোট ${toBengaliNumber(idCardPrintSheets.length)} পাতা)`
        : idCardSideView === 'front'
        ? `১ম পৃষ্ঠা (প্রতি পাতায় ৪ জন, মোট ${toBengaliNumber(idCardPrintSheets.length)} পাতা)`
        : `২য় পৃষ্ঠা (প্রতি পাতায় ৪ জন, মোট ${toBengaliNumber(idCardPrintSheets.length)} পাতা)`;
    downloadIdCardsHtml(schoolInfo.name, classNameBn, container.innerHTML, modeDesc);
  };

  const handleSaveQuickEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickEditStudent) return;
    const father = (quickEditStudent.fatherNameBn || quickEditStudent.fatherName || '').trim();
    const mother = (quickEditStudent.motherNameBn || quickEditStudent.motherName || '').trim();
    const phone = (quickEditStudent.fatherPhone || quickEditStudent.guardianPhone || '').trim();

    const updated: Student = {
      ...quickEditStudent,
      fatherName: father,
      fatherNameBn: father,
      motherName: mother,
      motherNameBn: mother,
      fatherPhone: phone,
      guardianPhone: phone,
    };
    const ok = await updateStudent(updated);
    setQuickEditStudent(null);
    setPhotoUploadStatus({
      ok,
      message: ok
        ? `✓ "${updated.nameBn}"-এর তথ্য সার্ভারে সংরক্ষিত হয়েছে`
        : `⚠ "${updated.nameBn}"-এর তথ্য সার্ভারে সংরক্ষণ ব্যর্থ হয়েছে`,
    });
    setTimeout(() => {
      setPhotoUploadStatus((prev) => (prev?.message.includes(updated.nameBn) ? null : prev));
    }, 4500);
  };

  // Handle uploading photos directly from ID card component (atomic photo update)
  const handleIdCardPhotoUpload = async (
    studentId: string,
    role: 'student' | 'father' | 'mother',
    base64: string
  ) => {
    setPhotoUploadStatus({ ok: true, message: 'ছবি প্রক্রিয়াকরণ ও সার্ভারে সংরক্ষণ করা হচ্ছে...' });
    const res = await updateStudentPhoto(studentId, role, base64);
    setPhotoUploadStatus({ ok: res.ok, message: res.message });
    setTimeout(() => {
      setPhotoUploadStatus((prev) => (prev?.message === res.message ? null : prev));
    }, 5000);
  };

  // Generate realistic student passport illustration for quick demo loading
  const createDemoStudentPhoto = (seed: number, isGirl = false) => {
    const shirtColor = '#1e3a8a'; // Navy school uniform
    const tieColor = seed % 2 === 0 ? '#dc2626' : '#b91c1c';
    const bgGrad = seed % 2 === 0 ? '#e0f2fe' : '#ede9fe';
    const skin = '#fcd34d';
    const hair = '#1e293b';

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 200" width="160" height="200">
      <defs>
        <linearGradient id="bg_${seed}" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${bgGrad}" />
          <stop offset="100%" stop-color="#cbd5e1" />
        </linearGradient>
      </defs>
      <rect width="160" height="200" fill="url(#bg_${seed})" />
      <path d="M 15 200 C 15 150, 45 142, 80 142 C 115 142, 145 150, 145 200 Z" fill="${shirtColor}" />
      <polygon points="62,144 80,170 98,144 80,150" fill="#ffffff" />
      <polygon points="76,168 80,195 84,168 80,162" fill="${tieColor}" />
      <rect x="70" y="122" width="20" height="26" fill="${skin}" rx="4" />
      <ellipse cx="80" cy="94" rx="35" ry="40" fill="${skin}" />
      ${isGirl 
        ? `<path d="M 42 94 C 40 58, 60 40, 80 40 C 100 40, 120 58, 118 94 C 122 130, 112 142, 110 148 C 115 105, 112 70, 80 62 C 48 70, 45 105, 50 148 C 48 142, 38 130, 42 94 Z" fill="${hair}" />`
        : `<path d="M 44 82 C 44 54, 60 44, 80 44 C 100 44, 116 54, 116 82 C 108 65, 96 60, 80 62 C 64 60, 52 65, 44 82 Z" fill="${hair}" />`
      }
      <ellipse cx="68" cy="94" rx="3.5" ry="4.5" fill="#0f172a" />
      <ellipse cx="92" cy="94" rx="3.5" ry="4.5" fill="#0f172a" />
      <circle cx="69" cy="92.5" r="1.2" fill="#ffffff" />
      <circle cx="93" cy="92.5" r="1.2" fill="#ffffff" />
      <path d="M 62 86 Q 68 83 74 85" stroke="#0f172a" stroke-width="2" fill="none" stroke-linecap="round" />
      <path d="M 86 85 Q 92 83 98 86" stroke="#0f172a" stroke-width="2" fill="none" stroke-linecap="round" />
      <path d="M 80 96 L 78 104 L 82 104" stroke="#d97706" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M 70 113 Q 80 123 90 113" stroke="#b91c1c" stroke-width="2.5" fill="none" stroke-linecap="round" />
      <ellipse cx="60" cy="106" rx="5" ry="3" fill="#f87171" opacity="0.4" />
      <ellipse cx="100" cy="106" rx="5" ry="3" fill="#f87171" opacity="0.4" />
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  };

  // Populate sample student photos for selected class (atomic batch upload)
  const handleLoadSamplePhotosForPlayClass = async () => {
    const targetClassId = idCardClassFilter !== 'all' ? idCardClassFilter : 'class_play';
    const classStds = students.filter((s) => s.classId === targetClassId);
    if (classStds.length === 0) return;

    setIsLoadingSamplePhotos(true);
    setPhotoUploadStatus({
      ok: true,
      message: `${toBengaliNumber(classStds.length)} জন শিক্ষার্থীর ছবি সার্ভারে সংরক্ষণ করা হচ্ছে...`,
    });
    try {
      const nowIso = new Date().toISOString();
      const items = classStds.map((std, idx) => {
        const isGirl =
          std.gender === 'ছাত্রী' ||
          std.nameBn.includes('আক্তার') ||
          std.nameBn.includes('বেগম') ||
          std.nameBn.includes('খাতুন');
        return {
          id: std.id,
          avatarUrl: createDemoStudentPhoto(idx + 1, isGirl),
          photoUpdatedAt: nowIso,
        };
      });
      const res = await batchUpdateStudentPhotos(items);
      setPhotoUploadStatus({ ok: res.ok, message: res.message });
      setTimeout(() => {
        setPhotoUploadStatus((prev) => (prev?.message === res.message ? null : prev));
      }, 5000);
    } finally {
      setIsLoadingSamplePhotos(false);
    }
  };

  return (
    <div
      className="space-y-6 pb-16"
      style={{ fontFamily: "'Kalpurush', 'Hind Siliguri', sans-serif" }}
    >
      {/* Floating Scan Recognition & Alert Start Toast Indicator */}
      {scanSuccessToast && (
        <div
          role="status"
          aria-live="polite"
          data-testid="scan-success-toast"
          className="fixed top-4 right-4 z-50 w-[calc(100vw-2rem)] max-w-sm rounded-xl bg-slate-900 text-white border border-emerald-500/80 shadow-lg p-3.5 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="w-10 h-10 rounded-lg bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0 overflow-hidden border border-emerald-400">
            {scanSuccessToast.avatarUrl ? (
              <img
                src={scanSuccessToast.avatarUrl}
                alt={scanSuccessToast.studentNameBn}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <CheckCircle2 className="w-5 h-5" />
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>আইডি শনাক্ত সম্পন্ন ✓</span>
              </span>
              <span className="text-[10px] font-mono tabular-nums text-slate-400">
                {scanSuccessToast.recognizedAt}
              </span>
            </div>

            <div className="text-sm font-bold text-white leading-snug truncate">
              {scanSuccessToast.studentNameBn}
            </div>
            <div className="text-[11px] text-slate-300 tabular-nums">
              {scanSuccessToast.classNameBn} · রোল {toBengaliRoll(scanSuccessToast.roll)} ·{' '}
              <span className="font-mono text-amber-300">{scanSuccessToast.portalId}</span>
            </div>

            <div
              className={`pt-1 text-[11px] font-medium flex items-center gap-1.5 ${
                scanSuccessToast.dispatchPhase === 'error'
                  ? 'text-rose-300'
                  : scanSuccessToast.dispatchPhase === 'delivered'
                  ? 'text-emerald-300'
                  : 'text-amber-200'
              }`}
            >
              {scanSuccessToast.dispatchPhase === 'starting' ? (
                <>
                  <Radio className="w-3.5 h-3.5 text-amber-300 animate-pulse shrink-0" />
                  <span>অভিভাবক এলার্ম ও হাজিরা প্রক্রিয়া শুরু হয়েছে...</span>
                </>
              ) : scanSuccessToast.dispatchPhase === 'delivered' ? (
                <>
                  <BellRing className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>
                    অভিভাবক ফোনে লাইভ এলার্ম পাঠানো হয়েছে ({toBengaliNumber(scanSuccessToast.deliveredCount)}টি অনলাইন)
                  </span>
                </>
              ) : scanSuccessToast.dispatchPhase === 'saved_no_online' ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  <span>
                    {cloudUser?.emailVerified
                      ? 'হাজিরা সংরক্ষিত ও ক্লাউড সিঙ্কে পাঠানো হয়েছে'
                      : 'হাজিরা সংরক্ষিত (অভিভাবক ফোন যুক্ত হলে বেজে উঠবে)'}
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>আইডি যাচাই হয়েছে (সার্ভার সিঙ্ক ত্রুটি)</span>
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (scanToastTimerRef.current) clearTimeout(scanToastTimerRef.current);
              setScanSuccessToast(null);
            }}
            aria-label="নোটিফিকেশন বন্ধ করুন"
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. Header Hero Banner (Hidden in student_only mode for clean personal experience) */}
      {restrictedMode === 'full' && (
      <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-blue-950 rounded-2xl shadow-md border border-slate-800 text-white p-4 sm:p-6 overflow-hidden relative">
        <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-emerald-500 text-slate-950 rounded-2xl shadow-lg shrink-0">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-serif">
                  ডিজিটাল সিকিউরিটি ও স্মার্ট আইডি কার্ড সিস্টেম
                </h1>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  ● ৩টি পার্ট সক্রিয়
                </span>
              </div>
              <p className="text-xs sm:text-sm text-indigo-200 mt-1 max-w-3xl leading-relaxed">
                ১. অভিভাবকের আইডি-পাসওয়ার্ড ও লাইভ এলার্ম ড্যাশবোর্ড • ২. স্মার্টফোনের মাধ্যমে বারকোড স্ক্যানার • ৩. কিউআর কোডযুক্ত এপিঠ-ওপিঠ স্মার্ট আইডিকার্ড জেনারেটর
              </p>
            </div>
          </div>

          {/* Clock & Date Badge */}
          <div className="flex items-center gap-2.5">
            <div className="bg-slate-900/90 border border-slate-700/80 px-3.5 py-2 rounded-xl text-right">
              <div className="text-[10px] text-slate-400 flex items-center justify-end gap-1">
                <Clock className="w-3 h-3 text-amber-400" /> বর্তমান সময়:
              </div>
              <div className="text-sm font-bold text-amber-300 font-mono tracking-wider">
                {currentTime || '১২:০০:০০ PM'}
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-700/80 px-3 py-2 rounded-xl text-center">
              <div className="text-[10px] text-slate-400">তারিখ:</div>
              <div className="text-xs font-bold text-slate-200">
                {formatBengaliDate(new Date().toISOString().split('T')[0])}
              </div>
            </div>
          </div>
        </div>

        {/* 3 Main Parts Navigation Pills Bar */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex flex-wrap items-center gap-2">
          {/* Part 2: Scanner */}
          <button
            type="button"
            onClick={() => setActiveTab('barcode_scanner')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer shadow-sm ${
              activeTab === 'barcode_scanner'
                ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>পার্ট ২: স্মার্টফোন ক্যামেরা ও বারকোড স্ক্যানার</span>
          </button>

          {/* Part 1: Student & Guardian Portal */}
          <button
            type="button"
            onClick={() => setActiveTab('guardian_portal')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer shadow-sm ${
              activeTab === 'guardian_portal'
                ? 'bg-amber-400 text-slate-950 font-black shadow-md'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>পার্ট ১: শিক্ষার্থী ও অভিভাবক ড্যাশবোর্ড</span>
            {latestChildAlarm && activeSignedInStudent && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            )}
          </button>

          {/* Part 3: ID Card Generator */}
          <button
            type="button"
            onClick={() => setActiveTab('idcard_generator')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer shadow-sm ${
              activeTab === 'idcard_generator'
                ? 'bg-indigo-500 text-white font-black shadow-md'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>পার্ট ৩: এপিঠ-ওপিঠ স্মার্ট আইডিকার্ড জেনারেটর</span>
          </button>

          {/* Audit Logs */}
          <button
            type="button"
            onClick={() => setActiveTab('audit_logs')}
            className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'audit_logs'
                ? 'bg-slate-100 text-slate-900 font-bold'
                : 'bg-slate-900/60 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>গেটপাস লগ ({toBengaliNumber(securityLogs.length)})</span>
          </button>

          {/* Scanner Event Audit Logs */}
          <button
            type="button"
            onClick={() => setActiveTab('scanner_audit')}
            className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'scanner_audit'
                ? 'bg-cyan-400 text-slate-950 font-black shadow-md'
                : 'bg-slate-900/60 hover:bg-slate-800 text-cyan-200 border border-slate-700'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>স্ক্যানার লগ অডিট ({toBengaliNumber(scannerAuditLogs.length)})</span>
          </button>
        </div>
      </div>
      )}

      {restrictedMode === 'employee_scanner' && (
        <div className="bg-teal-950 rounded-2xl border border-teal-800 text-white p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500 text-slate-950 shrink-0">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-lg text-white">
                এমপ্লয়ী গেটপাস ক্যামেরা স্ক্যানার
              </h2>
              <p className="text-xs text-teal-200">
                আইডি কার্ডের QR কোড স্ক্যান করে শিক্ষার্থীদের বিদ্যালয়ে প্রবেশ ও প্রস্থান নিশ্চিত করুন
              </p>
            </div>
          </div>
          <div className="text-xs font-mono text-amber-300 bg-black/30 px-3 py-1.5 rounded-lg">
            {currentTime}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PART 2: SMARTPHONE CAMERA & BARCODE SCANNER VIEW                          */}
      {/* ========================================================================= */}
      {activeTab === 'barcode_scanner' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column (5/12): Smartphone Viewfinder Simulation */}
            <div className="lg:col-span-5 flex flex-col items-center">
              <div className="w-full max-w-[340px] bg-slate-950 rounded-[40px] p-3 shadow-2xl border-4 border-slate-800 relative">
                {/* Smartphone Speaker & Notch */}
                <div className="flex justify-center items-center pb-2">
                  <div className="w-16 h-4 bg-slate-900 rounded-full flex items-center justify-center space-x-1.5 border border-slate-800">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-950 border border-slate-800" />
                    <div className="w-8 h-1 rounded-full bg-slate-800" />
                  </div>
                </div>

                {/* Viewfinder Screen */}
                <div className="relative bg-slate-900 rounded-[28px] overflow-hidden aspect-[9/16] border border-slate-800 flex flex-col justify-between p-3">
                  {/* Top Status inside Phone */}
                  <div className="flex items-center justify-between text-[11px] text-white/90 z-20 px-1 font-mono">
                    <span className="flex items-center gap-1 font-bold text-emerald-400">
                      <Radio className="w-3 h-3 animate-pulse" /> SCANNER ON
                    </span>
                    <span className="text-[10px] bg-slate-800/80 px-2 py-0.5 rounded-full">
                      {gateAction === 'entry' ? '↓ এন্ট্রি গেট' : '↑ এক্সিট গেট'}
                    </span>
                  </div>

                  {/* Camera Video Stream OR Mock Target Viewfinder (Always mount <video> so videoRef never stays null on first click) */}
                  <div className="absolute inset-0 z-0 bg-slate-950 flex items-center justify-center overflow-hidden">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className={isCameraActive ? 'w-full h-full object-cover' : 'hidden'}
                    />
                    {!isCameraActive && (
                      <div className="text-center p-6 space-y-3 z-10 text-slate-300">
                        <Camera className="w-12 h-12 mx-auto text-indigo-400 animate-pulse" />
                        <div className="text-xs font-bold text-white">
                          ক্যামেরা ভিউফাইন্ডার স্ট্যান্ডবাই
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          মোবাইলের ব্যাক ক্যামেরা চালু করে আইডিকার্ডের বারকোড বা কিউআর কোডের সামনে ধরুন।
                        </p>
                        {cameraError && (
                          <div className="text-[11px] bg-rose-950/90 border border-rose-500/60 text-rose-200 p-2 rounded-lg">
                            {cameraError}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={startCamera}
                          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl transition shadow-lg inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Camera className="w-4 h-4" />
                          <span>ক্যামেরা চালু করুন</span>
                        </button>
                      </div>
                    )}

                    {/* Animated Laser Scanning Line & Real-Time QR Detection Focus */}
                    <div className={`absolute inset-x-4 top-1/5 bottom-1/5 border-2 border-dashed ${scanSuccessPulse ? 'border-emerald-400 bg-emerald-500/25 ring-4 ring-emerald-400/50' : 'border-emerald-400/80'} rounded-2xl pointer-events-none flex flex-col justify-center items-center transition-all duration-200`}>
                      {scanSuccessPulse ? (
                        <div className="bg-emerald-600 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xl flex items-center gap-1.5 animate-bounce">
                          <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                          <span>যাচাই ও গেটপাস সম্পন্ন!</span>
                        </div>
                      ) : (
                        <>
                          <div className="w-full h-0.5 bg-rose-500 shadow-[0_0_12px_#ef4444] animate-bounce" />
                          <div className="text-[10px] font-mono text-emerald-300 bg-slate-950/85 px-3 py-1.5 rounded-lg mt-2 tracking-wider flex items-center gap-1.5 shadow-md border border-emerald-500/40">
                            <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                            <span>[ কার্ডের কিউআর কোড এই সবুজ বক্সে রাখুন • ১০-১৫ সেমি দূরত্বে ধরুন ]</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Camera Control Overlays at bottom */}
                  <div className="relative z-20 space-y-2 pt-2">
                    {lastScanDispatchInfo && (() => {
                      const liveLog = lastScanDispatchInfo.logPayload
                        ? securityLogs.find((l) => l.id === lastScanDispatchInfo.logPayload?.id) ||
                          lastScanDispatchInfo.logPayload
                        : null;
                      return (
                        <div
                          className={`px-2.5 py-2 rounded-xl border text-[10.5px] font-bold leading-snug shadow-lg backdrop-blur-sm ${
                            lastScanDispatchInfo.isSending
                              ? 'bg-slate-900/90 border-indigo-400/70 text-indigo-100'
                              : lastScanDispatchInfo.syncError
                              ? 'bg-rose-950/95 border-rose-400 text-rose-100'
                              : liveLog?.guardianAcknowledged
                              ? 'bg-emerald-900/95 border-emerald-300 text-white'
                              : lastScanDispatchInfo.deliveredCount > 0
                              ? 'bg-emerald-950/95 border-emerald-400 text-emerald-100'
                              : 'bg-amber-950/95 border-amber-400 text-amber-100'
                          }`}
                        >
                          {lastScanDispatchInfo.isSending
                            ? `⏳ ${lastScanDispatchInfo.student.nameBn}-এর এলার্ম সার্ভারে পাঠানো হচ্ছে...`
                            : lastScanDispatchInfo.syncError === 'cloud_permission_denied'
                            ? `⚠ এই ফোনের Gmail (${cloudUser?.email}) অনুমোদিত স্ক্যানার নয় — ক্লাউড মেসেজ যায়নি!`
                            : lastScanDispatchInfo.syncError === 'static_host'
                            ? `⚠ ব্যাকএন্ড সার্ভার নেই — এই হোস্টিংয়ে কেবল ফ্রন্টএন্ড ফাইল চলছে, অন্য ফোনে এলার্ম যাবে না!`
                            : lastScanDispatchInfo.syncError === 'auth_redirect'
                            ? `⚠ সেশন ব্লক! পেজ রিলোড করে আবার স্ক্যান করুন।`
                            : lastScanDispatchInfo.syncError === 'network_error'
                            ? `⚠ সার্ভার সংযোগ ব্যর্থ — নিচে গিয়ে "পুনরায় সার্ভারে পাঠান" দিন।`
                            : liveLog?.guardianAcknowledged
                            ? `✓ অভিভাবকের উত্তর এসেছে (${liveLog.acknowledgedBy || 'অভিভাবক'}): "${liveLog.guardianResponse || 'নিশ্চিত'}"`
                            : lastScanDispatchInfo.deliveredCount > 0
                            ? `✓ ${lastScanDispatchInfo.student.nameBn}-এর ফোনে লাইভ এলার্ম পাঠানো হয়েছে (${toBengaliNumber(lastScanDispatchInfo.deliveredCount)} জন অনলাইন)!`
                            : `⚠ সার্ভারে সেভ হয়েছে — তবে এই সার্ভারে ${lastScanDispatchInfo.student.nameBn}-এর ফোন অনলাইন নেই!`}
                        </div>
                      );
                    })()}
                    {isCameraActive && (
                      <div className="flex items-center justify-between gap-1.5 bg-slate-950/85 backdrop-blur-sm p-2 rounded-xl border border-slate-800">
                        <button
                          type="button"
                          onClick={() => {
                            setCameraFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
                          }}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-[10.5px] font-bold flex items-center gap-1 cursor-pointer"
                          title="সামনে বা পেছনের ক্যামেরা বদলান"
                        >
                          <FlipHorizontal className="w-3.5 h-3.5" />
                          <span>ক্যামেরা</span>
                        </button>

                        {hasTorchSupport && (
                          <button
                            type="button"
                            onClick={toggleTorch}
                            className={`px-2.5 py-1.5 rounded-lg text-[10.5px] font-bold flex items-center gap-1 transition cursor-pointer ${
                              isTorchOn ? 'bg-amber-400 text-slate-950 font-black' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                            }`}
                            title="ফ্ল্যাশ লাইট চালু/বন্ধ করুন"
                          >
                            <Zap className="w-3.5 h-3.5" />
                            <span>{isTorchOn ? 'লাইট অন' : 'লাইট'}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={stopCamera}
                          className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10.5px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>বন্ধ করুন</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Smartphone Home Indicator Bar */}
                <div className="flex justify-center pt-2">
                  <div className="w-24 h-1 bg-slate-700 rounded-full" />
                </div>
              </div>
            </div>

            {/* Right Column (7/12): Scanner Console, Sound, Voice & Barcode Inputs */}
            <div className="lg:col-span-7 space-y-5">
              {/* Live Server & Connected Guardian Smartphone Telemetry Strip */}
              <div className="space-y-2">
                {typeof window !== 'undefined' && window.location.host.startsWith('ais-dev-') && (
                  <div className="rounded-xl border border-amber-400 bg-amber-50 text-amber-950 p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>ডেভ প্রিভিউ মোড (<code className="font-mono">ais-dev-</code>):</strong>{' '}
                        {siblingPreStatus.reachable
                          ? `Shared App (ais-pre-) চালু আছে (${toBengaliNumber(siblingPreStatus.onlineCount)} জন অভিভাবক অনলাইন)। এখন এই স্ক্যানার থেকে স্ক্যান করলে উভয় সার্ভারেই স্বয়ংক্রিয়ভাবে এলার্ম পাঠানো হবে।`
                          : `দুই ফোনে একই লিংক (এই ঠিকানা অথবা Shared App URL) ব্যবহার করুন। এই প্রিভিউ লিংকে অভিভাবক ফোন খুলতে পাশের "অভিভাবক ফোনে খোলার QR" ব্যবহার করুন।`}
                      </div>
                    </div>
                    {siblingPreStatus.reachable && (
                      <a
                        href={window.location.origin.replace('://ais-dev-', '://ais-pre-')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] flex items-center gap-1.5 shrink-0 whitespace-nowrap"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-amber-300" />
                        <span>Shared App এ খুলুন</span>
                      </a>
                    )}
                  </div>
                )}
                <div
                  className={`rounded-2xl border p-3.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                    liveServerHealth.staticHostNoBackend || liveServerHealth.authRedirected || !liveServerHealth.reachable
                      ? 'bg-rose-950 text-white border-rose-500'
                      : liveServerHealth.onlineGuardians.length > 0
                      ? 'bg-emerald-950 text-white border-emerald-500/70'
                      : 'bg-slate-900 text-slate-100 border-slate-700'
                  }`}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 font-bold">
                      <Wifi
                        className={`w-4 h-4 shrink-0 ${
                          liveServerHealth.staticHostNoBackend || liveServerHealth.authRedirected || !liveServerHealth.reachable
                            ? 'text-rose-400'
                            : liveServerHealth.onlineGuardians.length > 0
                            ? 'text-emerald-400 animate-pulse'
                            : 'text-amber-300'
                        }`}
                      />
                      <span>
                        {liveServerHealth.staticHostNoBackend
                          ? 'সতর্কতা: এই হোস্টিংয়ে ব্যাকএন্ড সার্ভার (server.ts) চালু নেই! অভিভাবক ফোনে এলার্ম যাবে না'
                          : liveServerHealth.authRedirected
                          ? 'সার্ভার সেশন ব্লক! পেজ রিলোড করে পুনরায় সংযোগ দিন'
                          : !liveServerHealth.reachable
                          ? 'সার্ভার সংযোগ পাওয়া যাচ্ছে না'
                          : liveServerHealth.onlineGuardians.length > 0
                          ? `✓ ${toBengaliNumber(liveServerHealth.onlineGuardians.length)}টি অভিভাবক ফোন এই সার্ভারে লাইভ অনলাইন (${liveServerHealth.onlineGuardians
                              .slice(0, 3)
                              .map((g) => g.portalId || g.studentId)
                              .join(', ')})`
                          : 'এই সার্ভারে এখনো কোনো অভিভাবক ফোন যুক্ত নেই (স্ট্যান্ডবাই)'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300 font-mono truncate">
                      সার্ভার ঠিকানা: <strong className="text-amber-300">{typeof window !== 'undefined' ? window.location.host : ''}</strong>
                      {liveServerHealth.serverInstanceId ? (
                        <>
                          {' '}· ইনস্ট্যান্স: <strong className="text-emerald-300">{liveServerHealth.serverInstanceId}</strong>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {liveServerHealth.authRedirected && (
                      <button
                        type="button"
                        onClick={() => {
                          const p = `${window.location.pathname || '/'}${window.location.search || ''}`;
                          window.location.assign(`/api/security/refresh-session?redirect=${encodeURIComponent(p)}`);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>সেশন সক্রিয় করুন</span>
                      </button>
                    )}
                    {cloudUser && cloudUser.emailVerified ? (
                      cloudPushAuthorized === false ? (
                        <button
                          type="button"
                          disabled={scannerCloudConnecting}
                          onClick={async () => {
                            setScannerCloudConnecting(true);
                            try {
                              await connectCloudSync();
                            } finally {
                              setScannerCloudConnecting(false);
                            }
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-rose-700 hover:bg-rose-600 border border-rose-400 text-white font-bold text-[11px] flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                          title={`এই Gmail (${cloudUser.email}) এখনো স্ক্যানার হিসেবে অনুমোদিত নয়`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-300" />
                          <span>ক্লাউড পুশ অননুমোদিত · Gmail বদলান</span>
                        </button>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className="px-2.5 py-1.5 rounded-xl bg-emerald-900/90 border border-emerald-500/50 text-emerald-200 font-semibold text-[11px] flex items-center gap-1.5 whitespace-nowrap"
                            title={`অফিস স্ক্যান রিয়েলটাইম Google ক্লাউড সিঙ্কে যাচ্ছে (${cloudUser.email})`}
                          >
                            <Globe className="w-3.5 h-3.5 text-emerald-400" />
                            <span>
                              {cloudPushAuthorized === null ? 'ক্লাউড যাচাই হচ্ছে...' : 'ক্লাউড পুশ সক্রিয়'}
                            </span>
                          </span>
                          {cloudUser.email === 'chorcho2utkosho@gmail.com' && (
                            <button
                              type="button"
                              onClick={() => setShowScannerAllowBox((v) => !v)}
                              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-amber-200 font-semibold text-[11px] flex items-center gap-1 cursor-pointer whitespace-nowrap"
                              title="অন্য গেটকিপার বা শিক্ষকের ফোনের Gmail UID অনুমোদন করুন"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>অন্য স্ক্যানার অনুমোদন</span>
                            </button>
                          )}
                        </div>
                      )
                    ) : (
                      <button
                        type="button"
                        disabled={scannerCloudConnecting}
                        onClick={async () => {
                          setScannerCloudConnecting(true);
                          try {
                            await connectCloudSync();
                          } finally {
                            setScannerCloudConnecting(false);
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                        title="অন্য নেটওয়ার্ক বা ভিন্ন সার্ভার লিংকের অভিভাবক ফোনে লাইভ এলার্ম পাঠাতে Google ক্লাউড পুশ চালু করুন"
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span>
                          {scannerCloudConnecting ? 'যুক্ত হচ্ছে...' : 'Google ক্লাউড পুশ চালু করুন'}
                        </span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowGuardianQrBridge(true)}
                      className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
                      title="দ্বিতীয় ফোনে ঠিক এই সার্ভারের অভিভাবক ড্যাশবোর্ড খুলতে QR কোড দেখুন"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>অভিভাবক ফোনে খোলার QR</span>
                    </button>
                  </div>
                </div>
                {cloudUser?.emailVerified && cloudPushAuthorized === false && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 text-amber-950 px-3.5 py-2.5 text-xs space-y-2">
                    <div className="font-bold flex items-center gap-1.5 text-rose-800">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>
                        এই ফোনের Gmail ({cloudUser.email}) এখনো অনুমোদিত স্ক্যানার নয় — তাই অভিভাবকের ফোনে ক্লাউড মেসেজ যাবে না!
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-900 leading-relaxed">
                      সমাধান (যেকোনো ১টি): মূল অ্যাডমিন Gmail (<strong>chorcho2utkosho@gmail.com</strong>) দিয়ে এখানে সাইন-ইন করুন, অথবা নিচ থেকে এই ফোনের <strong>UID কপি করে</strong> মূল অ্যাডমিনের ড্যাশবোর্ডে <strong>"অন্য স্ক্যানার অনুমোদন"</strong>-এ দিয়ে একবার অনুমোদন করিয়ে নিন।
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (typeof navigator !== 'undefined' && navigator.clipboard) {
                            navigator.clipboard.writeText(cloudUser.uid).then(() => {
                              setCopiedScannerUid(true);
                              setTimeout(() => setCopiedScannerUid(false), 3000);
                            }).catch(() => {});
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] flex items-center gap-1.5 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>{copiedScannerUid ? 'UID কপি সম্পন্ন ✓' : `এই ফোনের UID কপি (${cloudUser.uid.slice(0, 8)}...)`}</span>
                      </button>
                      <button
                        type="button"
                        disabled={scannerCloudConnecting}
                        onClick={async () => {
                          setScannerCloudConnecting(true);
                          try {
                            await connectCloudSync();
                          } finally {
                            setScannerCloudConnecting(false);
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-white font-bold text-[11px] flex items-center gap-1.5 cursor-pointer"
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span>মূল অ্যাডমিন Gmail দিয়ে সাইন-ইন</span>
                      </button>
                    </div>
                  </div>
                )}
                {showScannerAllowBox && cloudUser?.email === 'chorcho2utkosho@gmail.com' && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setIsAuthorizingScanner(true);
                      setAllowScannerResult(null);
                      try {
                        const res = await authorizeScannerUid(allowScannerUidInput, allowScannerEmailInput);
                        setAllowScannerResult(res);
                        if (res.ok) {
                          setAllowScannerUidInput('');
                          setAllowScannerEmailInput('');
                        }
                      } finally {
                        setIsAuthorizingScanner(false);
                      }
                    }}
                    className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs space-y-2"
                  >
                    <div className="font-bold text-indigo-950">
                      অন্য গেটকিপার / শিক্ষকের ফোনের Google UID অনুমোদন করুন
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        required
                        value={allowScannerUidInput}
                        onChange={(e) => setAllowScannerUidInput(e.target.value)}
                        placeholder="স্ক্যানার ফোনের Google UID পেস্ট করুন"
                        className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg border border-indigo-300 bg-white font-mono text-xs"
                      />
                      <input
                        type="email"
                        value={allowScannerEmailInput}
                        onChange={(e) => setAllowScannerEmailInput(e.target.value)}
                        placeholder="ইমেইল (ঐচ্ছিক)"
                        className="w-48 px-3 py-1.5 rounded-lg border border-indigo-300 bg-white text-xs"
                      />
                      <button
                        type="submit"
                        disabled={isAuthorizingScanner}
                        className="px-3.5 py-1.5 rounded-lg bg-indigo-700 hover:bg-indigo-800 disabled:opacity-60 text-white font-bold text-xs cursor-pointer"
                      >
                        {isAuthorizingScanner ? 'অনুমোদন হচ্ছে...' : 'অনুমোদন করুন'}
                      </button>
                    </div>
                    {allowScannerResult && (
                      <div className={`font-semibold text-[11px] ${allowScannerResult.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {allowScannerResult.message}
                      </div>
                    )}
                  </form>
                )}
                {cloudSyncError && !cloudUser?.emailVerified && (
                  <div className="rounded-xl border border-rose-300 bg-rose-50 text-rose-900 px-3 py-2 text-xs font-medium">
                    <strong>ক্লাউড পুশ সতর্কতা:</strong> {cloudSyncError}
                  </div>
                )}
              </div>

              {/* Action Bar (Entry vs Exit + Audio Controls) */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      গেটপাস মুভমেন্ট নির্বাচন:
                    </span>
                    <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setGateAction('entry')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                          gateAction === 'entry'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <UserCheck className="w-4 h-4" />
                        <span>বিদ্যালয়ে প্রবেশ (Entry Gate)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setGateAction('exit')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                          gateAction === 'exit'
                            ? 'bg-amber-600 text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <User className="w-4 h-4" />
                        <span>বিদ্যালয় থেকে প্রস্থান (Exit Gate)</span>
                      </button>
                    </div>
                  </div>

                  {/* Sound, Voice & Customizable Welcome Audio Settings */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSoundBeepEnabled(!soundBeepEnabled)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                        soundBeepEnabled
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                          : 'bg-slate-100 border-slate-200 text-slate-500'
                      }`}
                      title="স্ক্যানার বিপ সাউন্ড"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>বিপ সাউন্ড {soundBeepEnabled ? 'চালু' : 'বন্ধ'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setVoiceEnabled(!voiceEnabled)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                        voiceEnabled
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-900'
                          : 'bg-slate-100 border-slate-200 text-slate-500'
                      }`}
                      title="স্বয়ংক্রিয় বাংলা ভয়েস এনাউন্সমেন্ট"
                    >
                      {voiceEnabled ? (
                        <Volume2 className="w-3.5 h-3.5 text-indigo-600" />
                      ) : (
                        <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                      )}
                      <span>বাংলা ভয়েস {voiceEnabled ? 'চালু' : 'বন্ধ'}</span>
                    </button>

                    {/* Scanner Audio Activity Indicator */}
                    <div
                      data-testid="scanner-audio-activity-indicator"
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-2 transition ${
                        isSpeechStreamActive || isSpeaking
                          ? 'bg-emerald-950 text-emerald-100 border-emerald-400 shadow-sm'
                          : 'bg-slate-50 text-slate-500 border-slate-200'
                      }`}
                      title="ব্রাউজার স্পিচ ও অডিও স্ট্রিমের রিয়েল-টাইম অ্যাক্টিভিটি"
                    >
                      <span className="relative flex h-2.5 w-2.5 shrink-0">
                        {(isSpeechStreamActive || isSpeaking) && (
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80" />
                        )}
                        <span
                          className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                            isSpeechStreamActive || isSpeaking ? 'bg-emerald-400' : 'bg-slate-300'
                          }`}
                        />
                      </span>
                      <Activity
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isSpeechStreamActive || isSpeaking
                            ? 'text-emerald-300 animate-pulse'
                            : 'text-slate-400'
                        }`}
                      />
                      <span>
                        {isSpeechStreamActive || isSpeaking
                          ? 'Audio Activity · স্পিচ চলছে'
                          : 'Audio Activity · প্রস্তুত'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        void handleWakeAudio();
                      }}
                      data-testid="persistent-wake-audio-btn"
                      aria-label="Wake Audio"
                      className="px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition flex items-center gap-1.5 cursor-pointer"
                      title="ব্রাউজার অডিও ইঞ্জিন সজাগ করুন"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-amber-600" />
                      <span>
                        {wakeAudioFeedback === 'waking'
                          ? 'Wake Audio...'
                          : wakeAudioFeedback === 'awake'
                          ? 'Wake Audio ✓'
                          : 'Wake Audio'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAutoInstantScanGreeting((prev) => !prev)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                        autoInstantScanGreeting
                          ? 'bg-emerald-600 border-emerald-700 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                      }`}
                      title="স্ক্যান হওয়া মাত্রই নিশ্চিতকরণ ছাড়াই সরাসরি সালাম, হাজিরা ও অভিভাবক ভয়েস পাঠান"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>তাৎক্ষণিক অটো-সালাম {autoInstantScanGreeting ? 'চালু ✓' : 'বন্ধ'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowWelcomeAudioEditor(!showWelcomeAudioEditor)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                        showWelcomeAudioEditor
                          ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                          : 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-950'
                      }`}
                      title="স্ক্যান সফল হওয়ার পর বাজানো সালাম/স্বাগতম/বিদায় অডিও বার্তার টেক্সট পরিবর্তন করুন"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>সালাম ও স্বাগতম অডিও সেটিংস</span>
                    </button>
                  </div>
                </div>

                {/* Collapsible Customizable 'Welcome' Audio Message Settings Menu */}
                {showWelcomeAudioEditor && (
                  <div className="bg-slate-50 border-2 border-indigo-200 rounded-xl p-4 space-y-3.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                          <Volume2 className="w-4 h-4 text-indigo-600" />
                          <span>স্ক্যানার 'স্বাগতম' ও 'বিদায়' অডিও বার্তা সেটিংস</span>
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          শিক্ষক বা অ্যাডমিন চাইলে স্ক্যান নিশ্চিত করার পর বাজানো অডিও বার্তার টেক্সট পরিবর্তন করতে পারবেন। শিক্ষার্থীর নামের জায়গায় <code className="bg-indigo-100 text-indigo-900 px-1 rounded font-mono">{'{name}'}</code> ব্যবহার করুন।
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowWelcomeAudioEditor(false)}
                        className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                        aria-label="সেটিংস মেনু বন্ধ করুন"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {welcomeVoiceSaveNotice && (
                      <div className="p-2.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg font-bold text-xs flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{welcomeVoiceSaveNotice}</span>
                      </div>
                    )}

                    <div className="space-y-3">
                      {/* Entry Welcome Message */}
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <label className="font-bold text-emerald-900">
                            বিদ্যালয়ে প্রবেশের ('স্বাগতম') অডিও বার্তা:
                          </label>
                          <div className="flex items-center gap-1">
                            {[
                              { token: '{name}', label: '+ নাম' },
                              { token: '{class}', label: '+ শ্রেণি' },
                              { token: '{roll}', label: '+ রোল' },
                            ].map((chip) => (
                              <button
                                key={`entry-${chip.token}`}
                                type="button"
                                onClick={() =>
                                  setWelcomeVoiceDraft((prev) => ({
                                    ...prev,
                                    entryMessageTemplate: `${prev.entryMessageTemplate} ${chip.token}`.trim(),
                                  }))
                                }
                                className="px-2 py-0.5 bg-white hover:bg-indigo-50 border border-slate-300 rounded text-[10.5px] font-bold text-indigo-900 cursor-pointer"
                              >
                                {chip.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <textarea
                          rows={2}
                          value={welcomeVoiceDraft.entryMessageTemplate}
                          onChange={(e) =>
                            setWelcomeVoiceDraft((prev) => ({
                              ...prev,
                              entryMessageTemplate: e.target.value,
                            }))
                          }
                          placeholder={DEFAULT_SCANNER_VOICE_SETTINGS.entryMessageTemplate}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none leading-relaxed"
                        />
                      </div>

                      {/* Exit Message */}
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <label className="font-bold text-amber-900">
                            বিদ্যালয় থেকে প্রস্থানের ('বিদায়') অডিও বার্তা:
                          </label>
                          <div className="flex items-center gap-1">
                            {[
                              { token: '{name}', label: '+ নাম' },
                              { token: '{class}', label: '+ শ্রেণি' },
                              { token: '{roll}', label: '+ রোল' },
                            ].map((chip) => (
                              <button
                                key={`exit-${chip.token}`}
                                type="button"
                                onClick={() =>
                                  setWelcomeVoiceDraft((prev) => ({
                                    ...prev,
                                    exitMessageTemplate: `${prev.exitMessageTemplate} ${chip.token}`.trim(),
                                  }))
                                }
                                className="px-2 py-0.5 bg-white hover:bg-indigo-50 border border-slate-300 rounded text-[10.5px] font-bold text-indigo-900 cursor-pointer"
                              >
                                {chip.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <textarea
                          rows={2}
                          value={welcomeVoiceDraft.exitMessageTemplate}
                          onChange={(e) =>
                            setWelcomeVoiceDraft((prev) => ({
                              ...prev,
                              exitMessageTemplate: e.target.value,
                            }))
                          }
                          placeholder={DEFAULT_SCANNER_VOICE_SETTINGS.exitMessageTemplate}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none leading-relaxed"
                        />
                      </div>

                      {/* Live Preview */}
                      <div className="bg-white border border-slate-200 rounded-lg p-2.5 text-[11px] text-slate-700">
                        <span className="font-bold text-indigo-900 block mb-0.5">
                          লাইভ প্রিভিউ ({gateAction === 'entry' ? 'প্রবেশ' : 'প্রস্থান'}):
                        </span>
                        <span className="text-slate-800">
                          "
                          {buildScannerVoiceMessage(
                            recentScannedStudent || { nameBn: 'সিলমি আক্তার', roll: 1 },
                            (recentScannedStudent &&
                              classes.find((c) => c.id === recentScannedStudent.classId)?.nameBn) ||
                              'প্রথম শ্রেণি',
                            gateAction,
                            welcomeVoiceDraft
                          )}
                          "
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setWelcomeVoiceDraft({ ...DEFAULT_SCANNER_VOICE_SETTINGS });
                          setWelcomeVoiceSaveNotice('ডিফল্ট টেক্সট লোড করা হয়েছে — সংরক্ষণ করতে "সেভ করুন" ক্লিক করুন।');
                          setTimeout(() => setWelcomeVoiceSaveNotice(null), 3500);
                        }}
                        className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>ডিফল্ট রিসেট</span>
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            unlockMobileAudioAndSpeech(true);
                            const sample = buildScannerVoiceMessage(
                              recentScannedStudent || { nameBn: 'সিলমি আক্তার', roll: 1 },
                              (recentScannedStudent &&
                                classes.find((c) => c.id === recentScannedStudent.classId)?.nameBn) ||
                                'প্রথম শ্রেণি',
                              gateAction,
                              welcomeVoiceDraft
                            );
                            speakBengali(sample, true);
                          }}
                          className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-950 font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>টেস্ট শুনুন</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const cleanedSettings = {
                              entryMessageTemplate:
                                welcomeVoiceDraft.entryMessageTemplate.trim() ||
                                DEFAULT_SCANNER_VOICE_SETTINGS.entryMessageTemplate,
                              exitMessageTemplate:
                                welcomeVoiceDraft.exitMessageTemplate.trim() ||
                                DEFAULT_SCANNER_VOICE_SETTINGS.exitMessageTemplate,
                              updatedAt: new Date().toISOString(),
                            };
                            setWelcomeVoiceDraft({
                              entryMessageTemplate: cleanedSettings.entryMessageTemplate,
                              exitMessageTemplate: cleanedSettings.exitMessageTemplate,
                            });
                            updateSchoolInfo({ scannerVoiceSettings: cleanedSettings });
                            setWelcomeVoiceSaveNotice('✓ স্বাগতম ও বিদায় অডিও বার্তা স্থায়ীভাবে সংরক্ষিত হয়েছে!');
                            setTimeout(() => setWelcomeVoiceSaveNotice(null), 3500);
                          }}
                          className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer shadow-xs"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>সেভ করুন</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Barcode Scanner Gun / Keyboard Input */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <QrCode className="w-4 h-4 text-indigo-600" />
                      <span>বারকোড স্ক্যানার গান বা কিবোর্ডে রোল / জন্ম নিবন্ধন নম্বর লিখুন:</span>
                    </span>
                    <span className="text-[11px] text-emerald-700 font-bold">
                      (স্ক্যানার গান দিয়ে ট্রিগার চাপলেই স্বয়ংক্রিয় যাচাই হবে)
                    </span>
                  </label>

                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="w-5 h-5 absolute left-3.5 top-3 text-slate-400" />
                      <input
                        type="text"
                        value={barcodeInput}
                        onChange={(e) => setBarcodeInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleBarcodeSearchSubmit(barcodeInput, 'manual_input');
                          }
                        }}
                        placeholder="ইউনিক আইডি (যেমন: DL-C1-01), QR কোড, বাংলা নাম বা জন্ম নিবন্ধন লিখুন..."
                        className="w-full text-sm pl-11 pr-4 py-2.5 border-2 border-indigo-200 rounded-xl focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 font-medium text-slate-900 bg-white placeholder-slate-400 transition"
                        autoFocus
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleBarcodeSearchSubmit(barcodeInput, 'manual_input')}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0"
                    >
                      <Check className="w-4 h-4" />
                      <span>যাচাই ও গেটপাস</span>
                    </button>
                  </div>
                </div>

                {/* Live Feedback Banner */}
                {scannerFeedback && (
                  <div
                    className={`p-3.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-between border ${
                      scannerFeedback.includes('✓')
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                        : 'bg-rose-50 border-rose-300 text-rose-950'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {scannerFeedback.includes('✓') ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                      )}
                      <span>{scannerFeedback}</span>
                    </span>
                    {liveAnnouncement && (
                      <button
                        type="button"
                        onClick={() => speakBengali(liveAnnouncement)}
                        className="px-2.5 py-1 bg-white border border-emerald-300 rounded-lg text-xs font-bold text-emerald-900 hover:bg-emerald-100 flex items-center gap-1 cursor-pointer"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>ভয়েস পুনরায় শুনুন</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Truthful Live Dispatch Confirmation to Guardian Phone */}
                {lastScanDispatchInfo && (() => {
                  const liveMatchedLog = lastScanDispatchInfo.logPayload
                    ? securityLogs.find((l) => l.id === lastScanDispatchInfo.logPayload?.id) ||
                      lastScanDispatchInfo.logPayload
                    : null;
                  const isAcked = Boolean(liveMatchedLog?.guardianAcknowledged);
                  return (
                    <div
                      className={`p-3.5 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                        lastScanDispatchInfo.syncError
                          ? 'bg-rose-950 text-white border-rose-500'
                          : isAcked || lastScanDispatchInfo.deliveredCount > 0
                          ? 'bg-emerald-900 text-white border-emerald-700'
                          : 'bg-amber-50 text-amber-950 border-amber-300'
                      }`}
                    >
                      <div className="flex items-start sm:items-center gap-2">
                        {lastScanDispatchInfo.syncError ? (
                          <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5 sm:mt-0" />
                        ) : isAcked ? (
                          <CheckCheck className="w-4 h-4 text-amber-300 shrink-0 mt-0.5 sm:mt-0" />
                        ) : lastScanDispatchInfo.deliveredCount > 0 ? (
                          <Radio className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5 sm:mt-0 animate-pulse" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5 sm:mt-0" />
                        )}
                        <div className="space-y-0.5">
                          {lastScanDispatchInfo.isSending ? (
                            <div className="font-bold">
                              ⏳ {lastScanDispatchInfo.student.nameBn}-এর স্ক্যান কেন্দ্রীয় সার্ভারে পাঠানো হচ্ছে...
                            </div>
                          ) : lastScanDispatchInfo.syncError === 'static_host' ? (
                            <>
                              <div className="font-bold text-amber-200">
                                ⚠ সতর্কতা: {lastScanDispatchInfo.student.nameBn}-এর এলার্ম অভিভাবক ফোনে যায়নি (ব্যাকএন্ড সার্ভার অনুপস্থিত)!
                              </div>
                              <div className="text-[11px] text-rose-100">
                                এই ডোমেইনটি ({lastScanDispatchInfo.serverHost}) কেবল স্ট্যাটিক HTML চালাচ্ছে — Node সার্ভার (server.ts / WebSocket) চালু না থাকায় স্ক্যান তথ্য অন্য ফোনে পৌঁছাতে পারছে না। Render/Railway বা full-stack Node সার্ভারে চালু করুন।
                              </div>
                            </>
                          ) : lastScanDispatchInfo.syncError === 'auth_redirect' ? (
                            <>
                              <div className="font-bold text-amber-200">
                                ⚠ সতর্কতা: {lastScanDispatchInfo.student.nameBn}-এর স্ক্যান কেন্দ্রীয় সার্ভারে পৌঁছায়নি (সেশন/ভেরিফিকেশন ব্লক)!
                              </div>
                              <div className="text-[11px] text-rose-100">
                                এই ব্রাউজারে সেশন যাচাই বাকি থাকায় অভিভাবক ফোনে এলার্ম যায়নি। নিচের "পেজ রিলোড করুন" বাটনে ক্লিক করে আবার স্ক্যান করুন।
                              </div>
                            </>
                          ) : lastScanDispatchInfo.syncError === 'cloud_permission_denied' ? (
                            <>
                              <div className="font-bold text-amber-200">
                                ⚠ সতর্কতা: {lastScanDispatchInfo.student.nameBn}-এর স্ক্যান Google ক্লাউডে পাঠানো যায়নি (অননুমোদিত স্ক্যানার Gmail)!
                              </div>
                              <div className="text-[11px] text-rose-100">
                                এই ফোনের Gmail ({cloudUser?.email}) অনুমোদিত স্ক্যানার নয়। মূল অ্যাডমিন Gmail দিয়ে সাইন-ইন করুন অথবা উপরের "UID কপি" করে মূল অ্যাডমিনে অনুমোদন দিন।
                              </div>
                            </>
                          ) : lastScanDispatchInfo.syncError === 'network_error' ? (
                            <>
                              <div className="font-bold text-amber-200">
                                ⚠ সতর্কতা: সার্ভারে স্ক্যান সংরক্ষণ ব্যর্থ হয়েছে ({lastScanDispatchInfo.student.nameBn})
                              </div>
                              <div className="text-[11px] text-rose-100">
                                ইন্টারনেট বা সার্ভার সংযোগ বিচ্ছিন্ন। "পুনরায় সার্ভারে পাঠান" ক্লিক করুন।
                              </div>
                            </>
                          ) : isAcked ? (
                            <>
                              <div className="font-bold text-amber-200">
                                ✓ অভিভাবকের লাইভ রেসপন্স এসেছে ({liveMatchedLog?.acknowledgedBy || 'অভিভাবক'}):
                              </div>
                              <div className="text-xs text-white font-medium">
                                "{liveMatchedLog?.guardianResponse || 'মেসেজ শুনেছি ও নিশ্চিত করলাম'}"
                              </div>
                            </>
                          ) : lastScanDispatchInfo.deliveredCount > 0 ? (
                            <div className="font-bold">
                              ✓ {toBengaliNumber(lastScanDispatchInfo.deliveredCount)}টি সংযুক্ত অভিভাবক ড্যাশবোর্ডে লাইভ এলার্ম পাঠানো হয়েছে — অভিভাবকের উত্তরের অপেক্ষায়...
                            </div>
                          ) : (
                            <>
                              <div className="font-bold">
                                সার্ভারে স্ক্যান ও হাজিরা সেভ হয়েছে — তবে এই সার্ভারে ({lastScanDispatchInfo.serverHost}
                                {lastScanDispatchInfo.serverInstanceId || liveServerHealth.serverInstanceId
                                  ? ` • ${lastScanDispatchInfo.serverInstanceId || liveServerHealth.serverInstanceId}`
                                  : ''}) {lastScanDispatchInfo.student.nameBn}-এর কোনো অভিভাবক ফোন অনলাইন নেই
                              </div>
                              <div className="text-[11px] opacity-90">
                                অভিভাবকের স্মার্টফোনটি ঠিক একই ঠিকানায় ({lastScanDispatchInfo.serverHost}) সাইন-ইন থাকা অবস্থায় খোলা রাখুন এবং "ভয়েস এলার্ম চালু করুন" বাটনে ট্যাপ করুন। প্রয়োজনে নিচের QR বাটন থেকে সরাসরি লিংক দিন।
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {lastScanDispatchInfo.syncError ? (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleVerifyStudent(lastScanDispatchInfo.student, { skipBeep: true, forceVoice: false })}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer"
                          >
                            পুনরায় সার্ভারে পাঠান
                          </button>
                          <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-amber-300 hover:bg-amber-200 text-slate-950 cursor-pointer"
                          >
                            পেজ রিলোড করুন
                          </button>
                        </div>
                      ) : !isAcked && lastScanDispatchInfo.deliveredCount === 0 ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setBridgeTargetStudentId(lastScanDispatchInfo.student.id);
                              setShowGuardianQrBridge(true);
                            }}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1.5 cursor-pointer"
                          >
                            <QrCode className="w-3.5 h-3.5 text-amber-300" />
                            <span>QR দেখুন</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyGuardianLink(lastScanDispatchInfo.student)}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition ${
                              copiedGuardianLinkId === lastScanDispatchInfo.student.id
                                ? 'bg-emerald-600 text-white'
                                : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                            }`}
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span>
                              {copiedGuardianLinkId === lastScanDispatchInfo.student.id
                                ? 'লিংক কপি হয়েছে ✓'
                                : 'লিংক কপি'}
                            </span>
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })()}

                {/* Disambiguation Candidate Selector (prevents loading wrong student on duplicate name/roll/phone) */}
                {ambiguousCandidates.length > 0 && (
                  <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-950">
                        সঠিক শিক্ষার্থী নির্বাচন করুন ({toBengaliNumber(ambiguousCandidates.length)} জন মিলেছে):
                      </span>
                      <button
                        type="button"
                        onClick={() => setAmbiguousCandidates([])}
                        className="text-xs text-amber-800 hover:text-amber-950 font-bold cursor-pointer"
                      >
                        বাতিল
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {ambiguousCandidates.map((cand) => {
                        const clsName = classes.find((c) => c.id === cand.classId)?.nameBn || cand.classId;
                        return (
                          <button
                            key={cand.id}
                            type="button"
                            onClick={() => handleAmbiguousCandidatePick(cand)}
                            className="flex items-center gap-2.5 p-2 bg-white hover:bg-amber-100 border border-amber-200 rounded-lg text-left transition cursor-pointer"
                          >
                            <div className="w-9 h-10 rounded border border-slate-300 bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                              {cand.avatarUrl ? (
                                <img src={cand.avatarUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <User className="w-4 h-4 text-slate-400" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-slate-900 truncate">{cand.nameBn}</div>
                              <div className="text-[11px] text-slate-600">
                                {clsName} • রোল {toBengaliRoll(cand.roll)}
                              </div>
                              <div className="text-[10px] font-mono font-bold text-indigo-800">
                                {getStudentPortalId(cand)}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Quick Simulation Barcode Buttons */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-700">
                      দ্রুত স্ক্যান সিমুলেশন (১-ক্লিক গেট স্ক্যান টেস্ট):
                    </span>
                    <div className="flex items-center gap-2">
                      <select
                        value={guardianShareClassId}
                        onChange={(e) => setGuardianShareClassId(e.target.value)}
                        className="text-[11px] font-bold bg-white border border-slate-300 rounded-lg px-2 py-1 text-slate-800"
                      >
                        <option value="all">সকল শ্রেণি</option>
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nameBn}
                          </option>
                        ))}
                      </select>
                      <span className="text-[10px] text-slate-500 font-bold">
                        ({toBengaliNumber(students.filter((s) => guardianShareClassId === 'all' || s.classId === guardianShareClassId).length)} জন)
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                    {students
                      .filter((s) => guardianShareClassId === 'all' || s.classId === guardianShareClassId)
                      .slice(0, 18)
                      .map((std) => (
                        <button
                          key={std.id}
                          type="button"
                          onClick={() => handleQuickSimulationVerify(std)}
                          className="px-2.5 py-1.5 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-lg text-xs text-slate-800 transition flex items-center gap-1.5 cursor-pointer shadow-2xs font-medium"
                        >
                          <span className="font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
                            {toBengaliRoll(std.roll)}
                          </span>
                          <span>{std.nameBn.split(' ')[0]}</span>
                        </button>
                      ))}
                  </div>
                </div>

                {/* Live Guardian Response Counter & Daily School Schedule Config */}
                <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3.5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-950">
                      <CheckCheck className="w-4 h-4 text-emerald-600" />
                      <span>অভিভাবক রেসপন্স কাউন্ট (ডাটাবেজ):</span>
                      <span className="bg-emerald-600 text-white px-2.5 py-0.5 rounded-full font-mono text-[11px]">
                        সাড়া দিয়েছেন: {toBengaliNumber(guardianResponseStats.totalResponded)} / {toBengaliNumber(guardianResponseStats.totalScans)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowScheduleEditor(!showScheduleEditor)}
                      className="px-2.5 py-1 bg-white hover:bg-indigo-100 border border-indigo-300 rounded-lg text-[11px] font-bold text-indigo-900 flex items-center gap-1 cursor-pointer"
                    >
                      <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{showScheduleEditor ? 'সময়সূচি লুকান' : 'ভয়েস সময়সূচি সেটিংস'}</span>
                    </button>
                  </div>

                  {showScheduleEditor && (
                    <div className="bg-white rounded-xl p-3 border border-indigo-200 space-y-2.5 text-xs">
                      <div className="font-bold text-slate-800">
                        অভিভাবকের স্মার্টফোনে প্রচারিতব্য দৈনিক স্কুল সময়সূচি (বাংলা ভয়েস টেমপ্লেট):
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10.5px] font-bold text-slate-600 mb-0.5">পিটি শুরু:</label>
                          <input
                            type="text"
                            value={scheduleDraft.ptStartTimeBn}
                            onChange={(e) => setScheduleDraft({ ...scheduleDraft, ptStartTimeBn: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10.5px] font-bold text-slate-600 mb-0.5">ক্লাস শুরু:</label>
                          <input
                            type="text"
                            value={scheduleDraft.classStartTimeBn}
                            onChange={(e) => setScheduleDraft({ ...scheduleDraft, classStartTimeBn: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10.5px] font-bold text-slate-600 mb-0.5">প্রথমবার বিরতি:</label>
                          <input
                            type="text"
                            value={scheduleDraft.breakTimeBn}
                            onChange={(e) => setScheduleDraft({ ...scheduleDraft, breakTimeBn: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10.5px] font-bold text-slate-600 mb-0.5">ছুটি:</label>
                          <input
                            type="text"
                            value={scheduleDraft.dismissalTimeBn}
                            onChange={(e) => setScheduleDraft({ ...scheduleDraft, dismissalTimeBn: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            updateSchoolInfo({ dailySchedule: scheduleDraft });
                            setShowScheduleEditor(false);
                          }}
                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>সময়সূচি সেভ করুন</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Scanned Profile Verification Dossier */}
              {recentScannedStudent && (
                <div className="bg-white rounded-2xl shadow-sm border-2 border-indigo-200 p-5 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <div className="flex items-center space-x-2">
                      <div className="p-1.5 bg-indigo-100 rounded-lg text-indigo-700">
                        <FileBadge className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-slate-900 font-serif">
                          শিক্ষার্থীর ডিজিটাল সিকিউরিটি প্রোফাইল
                        </h3>
                        <p className="text-xs text-slate-500">
                          গেটে স্ক্যানকৃত শিক্ষার্থীর পিতা-মাতার পরিচয় ও জরুরি ঠিকানা
                        </p>
                      </div>
                    </div>

                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold border ${
                        gateAction === 'entry'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      {gateAction === 'entry' ? '✓ প্রবেশের অনুমতিপ্রাপ্ত' : '✓ প্রস্থানের অনুমতিপ্রাপ্ত'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Student Photo */}
                    <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
                      <div className="w-24 h-28 rounded-lg border-2 border-indigo-900 bg-white overflow-hidden shadow-sm flex items-center justify-center mb-2">
                        {recentScannedStudent.avatarUrl ? (
                          <img
                            src={recentScannedStudent.avatarUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-center text-slate-400">
                            <User className="w-10 h-10 mx-auto" />
                            <span className="text-[10px] font-bold block mt-1">ছবি সংরক্ষিত নেই</span>
                          </div>
                        )}
                      </div>
                      <div className="font-bold text-slate-900 text-sm">{recentScannedStudent.nameBn}</div>
                      <div className="text-xs text-slate-500 font-sans">{recentScannedStudent.nameEn || 'Student'}</div>
                      <div className="mt-2 text-[11px] font-mono font-bold text-indigo-800 bg-indigo-100/70 px-2 py-0.5 rounded border border-indigo-200">
                        {getStudentPortalId(recentScannedStudent)} • #{recentScannedStudent.id.slice(-4).toUpperCase()}
                      </div>
                    </div>

                    {/* Details */}
                    <div className="sm:col-span-2 space-y-2.5 text-xs">
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                          <span className="text-slate-500 block text-[11px]">শ্রেণি ও শাখা:</span>
                          <strong className="text-slate-900 font-bold text-sm">
                            {classes.find((c) => c.id === recentScannedStudent.classId)?.nameBn} ({recentScannedStudent.section || 'ক'})
                          </strong>
                        </div>

                        <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                          <span className="text-slate-500 block text-[11px]">রোল নম্বর:</span>
                          <strong className="text-slate-900 font-bold text-sm">
                            {toBengaliRoll(recentScannedStudent.roll)}
                          </strong>
                        </div>
                      </div>

                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="text-slate-500 block text-[11px]">পিতার নাম ও এনআইডি:</span>
                        <div className="text-slate-900 font-bold">
                          {recentScannedStudent.fatherNameBn || recentScannedStudent.fatherName || '-'}
                        </div>
                        <div className="text-slate-500 text-[10px] font-mono mt-0.5">
                          NID: {recentScannedStudent.fatherNid || 'এনআইডি সংরক্ষিত নেই'}
                        </div>
                      </div>

                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="text-slate-500 block text-[11px]">মাতার নাম ও এনআইডি:</span>
                        <div className="text-slate-900 font-bold">
                          {recentScannedStudent.motherNameBn || recentScannedStudent.motherName || '-'}
                        </div>
                        <div className="text-slate-500 text-[10px] font-mono mt-0.5">
                          NID: {recentScannedStudent.motherNid || 'এনআইডি সংরক্ষিত নেই'}
                        </div>
                      </div>

                      <div className="p-2.5 bg-indigo-50/70 rounded-lg border border-indigo-200 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-bold text-indigo-950">
                          <Phone className="w-4 h-4 text-indigo-600" />
                          <span>অভিভাবক মোবাইল: {recentScannedStudent.guardianPhone || recentScannedStudent.fatherPhone || '-'}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-emerald-700 font-bold text-[11px]">✓ হাজিরা ও লাইভ এলার্ম প্রেরিত</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Interactive Islamic Salam & Student Etiquette Practice ("শিষ্টাচারিতার অনুশীলন") */}
                  {lastScanEtiquette && lastScanEtiquette.studentId === recentScannedStudent.id && (
                    <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-emerald-700 shrink-0" />
                          <span className="text-xs sm:text-sm font-bold text-emerald-950">
                            সালাম বিনিময় ও শিষ্টাচারিতা অনুশীলন (School Gate Etiquette)
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-emerald-800 bg-white px-2.5 py-0.5 rounded-full border border-emerald-200">
                          ✓ এটেনডেন্স এপে উপস্থিতি সংরক্ষিত
                        </span>
                      </div>

                      <div className="bg-white/90 rounded-lg p-3 border border-emerald-200 text-xs text-slate-800 space-y-1">
                        <div className="font-bold text-indigo-900">বিদ্যালয়ের ডিভাইস শিক্ষার্থীকে বলছে:</div>
                        <p className="leading-relaxed text-slate-900">"{lastScanEtiquette.salamText}"</p>
                      </div>

                      {lastScanEtiquette.replied ? (
                        <div className="bg-emerald-700 text-white rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2 font-bold">
                            <CheckCircle2 className="w-4 h-4 text-amber-300 shrink-0" />
                            <span>
                              মাশাআল্লাহ! {lastScanEtiquette.studentNameBn} উত্তর দিয়েছে: "{lastScanEtiquette.replyText}"
                            </span>
                          </div>
                          <span className="text-[11px] text-emerald-100">শিষ্টাচার অনুশীলন সম্পন্ন ও লগে যুক্ত ✓</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="text-xs font-bold text-emerald-950">
                            এবার শিক্ষার্থী সালামের জবাব বলবে (১ ক্লিক বা কণ্ঠে):
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleStudentEtiquetteReply('ওয়ালাইকুমুস সালাম ওয়া রাহমাতুল্লাহ')}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                            >
                              <Check className="w-4 h-4" />
                              <span>শিক্ষার্থী বলছে: ওয়ালাইকুমুস সালাম ওয়া রাহমাতুল্লাহ ✓</span>
                            </button>

                            <button
                              type="button"
                              onClick={handleListenStudentEtiquetteVoice}
                              className={`px-3.5 py-2 rounded-xl font-bold text-xs border transition flex items-center gap-1.5 cursor-pointer ${
                                isListeningEtiquette
                                  ? 'bg-rose-600 text-white border-rose-700 animate-pulse'
                                  : 'bg-white hover:bg-emerald-100 text-emerald-900 border-emerald-300'
                              }`}
                            >
                              {isListeningEtiquette ? (
                                <MicOff className="w-4 h-4" />
                              ) : (
                                <Mic className="w-4 h-4 text-emerald-700" />
                              )}
                              <span>
                                {isListeningEtiquette ? 'শুনছি... "ওয়ালাইকুম" বলুন' : 'মাইক্রোফোনে জবাব শুনুন'}
                              </span>
                            </button>
                          </div>
                          {etiquetteSpeechError && (
                            <p className="text-[11px] text-amber-800 font-medium">{etiquetteSpeechError}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PART 1: GUARDIAN ACCOUNT LOGIN & PRIVATE DASHBOARD VIEW                   */}
      {/* ========================================================================= */}
      {activeTab === 'guardian_portal' && (
        <div className="space-y-6">
          <button
            type="button"
            onClick={() => {
              logGuardianAudioEngineDiagnostics('hidden_test_audio_button');
              void triggerDummySpeechSynthesisTest().then(() => {
                logGuardianAudioEngineDiagnostics('hidden_test_audio_post_speech');
              });
            }}
            aria-label="Test Audio"
            data-testid="guardian-hidden-test-audio"
            className="sr-only"
          >
            Test Audio
          </button>
          {!activeSignedInStudent ? (
            /* STUDENT & GUARDIAN LOGIN SCREEN */
            <div className="space-y-6">
              <div className="max-w-xl mx-auto bg-white rounded-3xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-5">
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 bg-amber-100 text-amber-800 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                    <Lock className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 font-serif">
                    শিক্ষার্থী ও অভিভাবক ব্যক্তিগত ড্যাশবোর্ড লগইন
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                    প্রতিটি শিক্ষার্থীর জন্য রয়েছে স্বতন্ত্র <strong>ইউনিক আইডি (যেমন: DL-C4-01)</strong> ও পাসওয়ার্ড। সাইন-ইন করলে ছবিযুক্ত ব্যক্তিগত ড্যাশবোর্ড, একাডেমিক প্রগ্রেস, ভবিষ্যৎ পরিকল্পনা, কৃতিত্বের স্মৃতি এবং লাইভ গেটপাস অডিও নোটিফিকেশন পাবেন।
                  </p>
                </div>

                {guardianLoginError && (
                  <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-rose-950 text-xs font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{guardianLoginError}</span>
                  </div>
                )}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleGuardianLogin(guardianLoginIdentifier, guardianLoginPin, guardianLoginClassId);
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      ১. সন্তানের শ্রেণি নির্বাচন করুন (শুধুমাত্র রোল দিয়ে লগইন করলে আবশ্যক)
                    </label>
                    <select
                      value={guardianLoginClassId}
                      onChange={(e) => setGuardianLoginClassId(e.target.value)}
                      className="w-full text-sm p-3 border-2 border-slate-200 rounded-xl focus:border-amber-500 focus:ring-2 focus:ring-amber-100 font-bold bg-white text-slate-800"
                    >
                      <option value="all">-- শ্রেণি নির্বাচন করুন (অথবা নিচে ইউনিক আইডি / ফোন দিন) --</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nameBn}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      ২. ইউনিক লগইন আইডি (যেমন: DL-C4-01), রোল নম্বর অথবা মোবাইল নম্বর *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="যেমন: DL-C4-01 অথবা ১ অথবা 01700-xxxxxx"
                      value={guardianLoginIdentifier}
                      onChange={(e) => setGuardianLoginIdentifier(e.target.value)}
                      className="w-full text-sm p-3 border-2 border-slate-200 rounded-xl focus:border-amber-500 focus:ring-2 focus:ring-amber-100 font-medium"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">৩. ব্যক্তিগত পাসওয়ার্ড / পিন কোড *</label>
                      <span className="text-[11px] text-slate-400">প্রথমবার হলে ডিফল্ট পিন: 1234</span>
                    </div>
                    <input
                      type="password"
                      required
                      placeholder="পাসওয়ার্ড / পিন দিন (প্রথমবার হলে 1234)"
                      value={guardianLoginPin}
                      onChange={(e) => setGuardianLoginPin(e.target.value)}
                      className="w-full text-sm p-3 border-2 border-slate-200 rounded-xl focus:border-amber-500 focus:ring-2 focus:ring-amber-100 font-mono tracking-widest"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-sm rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>ব্যক্তিগত ড্যাশবোর্ডে সাইন-ইন করুন</span>
                  </button>
                </form>

                {/* Admin Helper: Individual Guardian Link & PIN Generator */}
                <div className="pt-4 border-t border-slate-200 space-y-3">
                  <button
                    type="button"
                    onClick={() => setShowAdminPairingPanel(!showAdminPairingPanel)}
                    className="w-full py-2.5 px-4 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-900 flex items-center justify-between cursor-pointer transition"
                  >
                    <span className="flex items-center gap-2">
                      <Share2 className="w-4 h-4 text-indigo-600" />
                      <span>স্কুল অ্যাডমিন টুল: প্রতিটি শিক্ষার্থীর ইউনিক আইডি, পাসওয়ার্ড ও ডাইরেক্ট লিংক</span>
                    </span>
                    <span>{showAdminPairingPanel ? '▲ বন্ধ করুন' : '▼ দেখুন'}</span>
                  </button>

                  {showAdminPairingPanel && (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs font-bold text-slate-800">
                          প্রবাসী বা দূরবর্তী অভিভাবক ও শিক্ষার্থীকে নিজস্ব আইডি-পিন বা লিংক পাঠান:
                        </div>
                        <select
                          value={guardianShareClassId}
                          onChange={(e) => setGuardianShareClassId(e.target.value)}
                          className="text-xs font-bold bg-white border border-slate-300 rounded-lg px-2.5 py-1"
                        >
                          {classes.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nameBn}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-[11.5px] text-amber-950 space-y-1 leading-relaxed">
                        <div className="font-bold flex items-center gap-1.5">
                          <Wifi className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                          <span>দুটি আলাদা ফোনে লাইভ পরীক্ষা করার জরুরি নির্দেশনা:</span>
                        </div>
                        <p>
                          স্কুল স্ক্যানার ফোন ও অভিভাবকের স্মার্টফোন <strong>অবশ্যই একই ওয়েবসাইট ঠিকানায়</strong> (নিচের কপি করা লিংক) চালু রাখতে হবে এবং অভিভাবকের ড্যাশবোর্ডে ঢুকে একবার <strong>"ভয়েস এলার্ম চালু করুন"</strong> বাটনে ট্যাপ করতে হবে। তাহলে স্ক্যান হওয়া মাত্রই নাম ধরে স্পষ্ট বাংলা ভয়েস এলার্ম বাজবে।
                        </p>
                      </div>

                      <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                        {students
                          .filter((s) => s.classId === guardianShareClassId)
                          .sort((a, b) => a.roll - b.roll)
                          .map((std) => {
                            const portalId = getStudentPortalId(std);
                            return (
                              <div
                                key={std.id}
                                className="bg-white p-2.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs"
                              >
                                <div>
                                  <div className="font-bold text-slate-900">
                                    রোল {toBengaliRoll(std.roll)}: {std.nameBn}
                                  </div>
                                  <div className="text-[11px] text-slate-600 font-mono mt-0.5 tabular-nums">
                                    ইউনিক আইডি: <strong className="text-indigo-800">{portalId}</strong> · পাসওয়ার্ড: <strong>{std.guardianPin || '—'}</strong> · ফোন: {std.guardianPhone || std.fatherPhone || 'নেই'}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleCopyGuardianLink(std)}
                                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition ${
                                      copiedGuardianLinkId === std.id
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-indigo-100 hover:bg-indigo-200 text-indigo-900'
                                    }`}
                                  >
                                    <Copy className="w-3 h-3" />
                                    <span>{copiedGuardianLinkId === std.id ? 'কপি হয়েছে!' : 'লিংক কপি'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleQuickTestGuardianLogin(std)}
                                    className="px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-950 rounded-lg text-[11px] font-bold cursor-pointer"
                                  >
                                    ড্যাশবোর্ড প্রিভিউ
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <StudentPersonalDashboard
              student={activeSignedInStudent}
              portalId={getStudentPortalId(activeSignedInStudent)}
              latestChildAlarm={latestChildAlarm}
              guardianChildLogs={guardianChildLogs}
              guardianAudioEnabled={guardianAudioEnabled}
              setGuardianAudioEnabled={(val) => {
                if (val) {
                  unlockMobileAudioAndSpeech(false);
                  setGuardianLiveWatchActive(true);
                  void requestGuardianNotificationPermission();
                  void prewarmGuardianVoiceCache(activeSignedInStudent, activeDailySchedule);
                } else {
                  setGuardianLiveWatchActive(false);
                }
                setGuardianAudioEnabled(val);
              }}
              guardianAudioTested={guardianAudioTested}
              isGuardianAlarmRinging={isGuardianAlarmRinging || Boolean(effectiveLiveRingingAlert)}
              externalLiveRingingAlert={effectiveLiveRingingAlert}
              onDismissExternalRingingAlert={effectiveDismissLiveRingingAlert}
              realtimeTransport={effectiveRealtimeTransport}
              realtimeSyncHealth={effectiveRealtimeSyncHealth}
              onForceCheckRealtime={effectiveForceCheckRealtime}
              realtimeDiagnostics={effectiveRealtimeDiagnostics}
              onSendDiagnosticPing={effectiveSendDiagnosticPing}
              onReconnectRealtime={effectiveReconnectRealtime}
              onClearDiagnosticLogs={effectiveClearDiagnosticLogs}
              onWakeAudio={handleWakeAudio}
              wakeAudioFeedback={wakeAudioFeedback}
              isSpeechStreamActive={isSpeechStreamActive || isSpeaking}
              ackSuccessFeedback={ackSuccessFeedback}
              isSubmittingAck={isSubmittingAck}
              guardianReplyText={guardianReplyText}
              setGuardianReplyText={setGuardianReplyText}
              onTestAudio={handleTestGuardianAudio}
              onStopAudio={() => {
                stopBengaliSpeech();
                setIsGuardianAlarmRinging(false);
                effectiveDismissLiveRingingAlert?.();
              }}
              onReplayAlarm={(log) => {
                setPendingBlockedSpeech(null);
                unlockMobileAudioAndSpeech(true);
                setIsGuardianAlarmRinging(true);
                playScannerBeep(1046.5, 90);
                speakRepeatedGuardianAlert(
                  activeSignedInStudent,
                  log.action === 'exit' ? 'exit' : 'entry',
                  activeDailySchedule,
                  { repeatCount: 6, delayMs: 0 }
                );
              }}
              onAcknowledgeAlarm={handleGuardianAcknowledge}
              buildGuardianVoiceMessage={buildGuardianVoiceMessage}
              onLogout={() => {
                handleGuardianLogout();
                if (onRoleLogout) onRoleLogout();
              }}
              isDeviceLocked={isDeviceLocked}
              onInstallLockedDashboard={
                onInstallLockedDashboard
                  ? () => onInstallLockedDashboard(activeSignedInStudent)
                  : undefined
              }
            />
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* PART 3: DOUBLE-SIDED ID CARD GENERATOR VIEW                               */}
      {/* ========================================================================= */}
      {activeTab === 'idcard_generator' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-lg text-slate-900 font-serif flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-indigo-600" />
                  <span>কিউআর কোড যুক্ত এপিঠ ওপিঠ আইডি কার্ড জেনারেটর (Double-Sided ID Cards)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  প্রথম পৃষ্ঠায় (এপিঠ) শিক্ষার্থীর আত্মবিশ্বাসী ছবি ও কিউআর কোড • অপর পৃষ্ঠায় (ওপিঠ) পিতা-মাতার ছবিসহ পূর্ণ পরিচয় ও এনআইডি।
                </p>
              </div>

              {/* Print Batch & Cloud Sync Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenPrintTab}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 shadow-md cursor-pointer hover:shadow-lg"
                  title="A4 পেপারে কার্ডসমূহ সরাসরি প্রিন্ট করুন (নতুন ট্যাবে প্রিন্ট উইন্ডো ওপেন হবে)"
                >
                  <Printer className="w-4 h-4 text-white" />
                  <div className="text-left">
                    <span className="block leading-tight font-black">A4 পেপারে প্রিন্ট করুন (Print A4)</span>
                    <span className="text-[10px] text-indigo-200 font-normal">
                      প্রতি পাতায় ৪টি • মোট {toBengaliNumber(idCardPrintSheets.length)} পাতা
                    </span>
                  </div>
                </button>

                {/* View Mode Toggle: Card Editor vs A4 Sheet Preview */}
                <div className="inline-flex rounded-xl p-0.5 bg-slate-100 border border-slate-200 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setIdCardDisplayMode('cards')}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                      idCardDisplayMode === 'cards'
                        ? 'bg-white text-indigo-900 shadow-2xs font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5 text-amber-500" />
                    <span>কার্ড ও ফটো এডিটর</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIdCardDisplayMode('sheets')}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                      idCardDisplayMode === 'sheets'
                        ? 'bg-white text-indigo-900 shadow-2xs font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    <span>A4 পেজ ভিউ ({toBengaliNumber(idCardPrintSheets.length)} পাতা)</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadOfflinePrintHtml}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                  title="অফলাইনে যেকোনো ডিভাইসে প্রিন্ট করার জন্য A4 HTML ডাউনলোড করুন"
                >
                  <Download className="w-4 h-4 text-amber-400" />
                  <span className="hidden sm:inline">অফলাইন ফাইল (.html)</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    await forceServerSync();
                    alert('কেন্দ্রীয় ক্লাউড সার্ভারের সাথে সকল ডিভাইসের তথ্য সফলভাবে সিঙ্ক হয়েছে!');
                  }}
                  className={`px-2.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer border ${
                    serverSyncStatus === 'synced'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-amber-50 text-amber-800 border-amber-300'
                  }`}
                  title="অন্যান্য ডিভাইসের ডেটার সাথে সিঙ্ক করুন"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isServerSyncing ? 'animate-spin text-amber-600' : 'text-emerald-600'}`} />
                  <span className="hidden sm:inline">
                    {serverSyncStatus === 'synced' ? 'ক্লাউড সিঙ্কড' : 'সিঙ্ক করুন'}
                  </span>
                </button>
              </div>
            </div>

            {/* Controls Bar: Class Filter + Orientation Selector + Front/Back Toggle */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
              {/* 1. Class Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 shrink-0">শ্রেণি:</span>
                <select
                  value={idCardClassFilter}
                  onChange={(e) => setIdCardClassFilter(e.target.value)}
                  className="w-full text-xs font-bold border-2 border-indigo-200 rounded-lg px-2.5 py-1.5 bg-indigo-50/50 text-indigo-950 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">সকল শ্রেণি (মোট {toBengaliNumber(students.length)} জন)</option>
                  {classes.map((cls) => {
                    const count = students.filter((s) => s.classId === cls.id).length;
                    return (
                      <option key={cls.id} value={cls.id}>
                        {cls.nameBn} ({toBengaliNumber(count)} জন)
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* 2. Standard ID Card Sizing & Orientation Selector */}
              <div className="flex items-center gap-1.5 justify-center">
                <span className="text-xs font-bold text-slate-700 shrink-0">সাইজ:</span>
                <div className="inline-flex rounded-xl p-0.5 bg-slate-100 border border-slate-200 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setIdCardOrientation('portrait')}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                      idCardOrientation === 'portrait'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="স্ট্যান্ডার্ড পোর্ট্রেট ল্যানিয়ার্ড ফিতা ও প্লাস্টিক পাউচ সাইজ (৫৪ × ৮৬ মিমি)"
                  >
                    <span>📱 পোর্ট্রেট (৫৪×৮৬ মিমি)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIdCardOrientation('landscape')}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                      idCardOrientation === 'landscape'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="স্ট্যান্ডার্ড ল্যান্ডস্কেপ আড়াআড়ি ওয়ালেট সাইজ (৮৬ × ৫৪ মিমি)"
                  >
                    <span>💳 ল্যান্ডস্কেপ (৮৬×৫৪ মিমি)</span>
                  </button>
                </div>
              </div>

              {/* 3. Front / Back / Both Toggle */}
              <div className="flex items-center justify-end">
                <div className="inline-flex rounded-xl p-0.5 bg-slate-100 border border-slate-200 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setIdCardSideView('both')}
                    className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                      idCardSideView === 'both' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    উভয় পিঠ
                  </button>
                  <button
                    type="button"
                    onClick={() => setIdCardSideView('front')}
                    className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                      idCardSideView === 'front' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    ১ম পৃষ্ঠা (এপিঠ)
                  </button>
                  <button
                    type="button"
                    onClick={() => setIdCardSideView('back')}
                    className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                      idCardSideView === 'back' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    ২য় পৃষ্ঠা (ওপিঠ)
                  </button>
                </div>
              </div>
            </div>

            {/* Direct Photo Upload & Management Bar for Selected Class */}
            <div className="p-3.5 bg-gradient-to-r from-indigo-50 to-blue-50 border-2 border-indigo-200 rounded-xl space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-600 text-white rounded-lg">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-indigo-950 block">
                      শিক্ষার্থীর ছবি দ্রুত আপলোড ও ফটো ম্যানেজার:
                    </span>
                    <span className="text-[11px] text-slate-500">
                      যেকোনো শিক্ষার্থীর ছবি নির্বাচন করুন অথবা এক ক্লিকে প্লে শ্রেণির ডেমো পাসপোর্ট ছবি লোড করুন।
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const targetClassId = idCardClassFilter !== 'all' ? idCardClassFilter : 'class_play';
                      const count = seedParentDetailsForClass(targetClassId);
                      alert(`${toBengaliNumber(count)} জন শিক্ষার্থীর পিতা-মাতার নাম, মোবাইল ও এনআইডি যুক্ত করা হয়েছে এবং সার্ভারে সংরক্ষিত হয়েছে!`);
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-lg transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    title="নির্বাচিত শ্রেণির শিক্ষার্থীদের পিতা-মাতার নাম, মোবাইল নম্বর ও এনআইডি পূরণ করুন"
                  >
                    <Heart className="w-3.5 h-3.5" />
                    <span>পিতা-মাতার পূর্ণ তথ্য পূরণ করুন</span>
                  </button>

                  <button
                    type="button"
                    disabled={isLoadingSamplePhotos}
                    onClick={handleLoadSamplePhotosForPlayClass}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-lg transition flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-60"
                    title="নির্বাচিত শ্রেণির সকল শিক্ষার্থীর জন্য পাসপোর্ট সাইজ ডেমো ছবি সেট করুন"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{isLoadingSamplePhotos ? 'সংরক্ষণ হচ্ছে...' : 'প্লে শ্রেণির ডেমো পাসপোর্ট ছবি লোড করুন'}</span>
                  </button>
                </div>
              </div>

              {/* Student Quick Selector for Upload */}
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-indigo-100">
                <span className="text-xs font-bold text-slate-700">শিক্ষার্থী নির্বাচন:</span>
                <select
                  value={photoTargetStudentId}
                  onChange={(e) => setPhotoTargetStudentId(e.target.value)}
                  className="text-xs font-medium border border-slate-300 rounded-lg px-2.5 py-1 bg-white text-slate-800"
                >
                  <option value="">-- শিক্ষার্থী বাছাই করুন --</option>
                  {idCardFilteredStudents.map((std) => (
                    <option key={std.id} value={std.id}>
                      রোল {toBengaliRoll(std.roll)}: {std.nameBn} {std.avatarUrl ? '✓ (ছবি আছে)' : '(ছবি নেই)'}
                    </option>
                  ))}
                </select>

                <label className="cursor-pointer">
                  <span className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs transition">
                    <Camera className="w-3.5 h-3.5" />
                    <span>নির্বাচিত শিক্ষার্থীর ছবি আপলোড</span>
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file) return;
                      const targetId = photoTargetStudentId || idCardFilteredStudents[0]?.id;
                      if (!targetId) {
                        alert('প্রথমে একজন শিক্ষার্থী নির্বাচন করুন');
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = async (ev) => {
                        const base64 = ev.target?.result as string;
                        if (base64) {
                          await handleIdCardPhotoUpload(targetId, 'student', base64);
                        }
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>

                <span className="text-[11px] text-slate-500">
                  (অথবা নিচের প্রতিটি কার্ডের ছবির উপরে সরাসরি ক্লিক করেও ছবি বদলানো যাবে)
                </span>
              </div>

              {(photoUploadStatus || syncErrorMessage) && (
                <div
                  className={`px-3 py-2 rounded-lg text-xs font-bold border flex items-center gap-2 ${
                    (photoUploadStatus && !photoUploadStatus.ok) || syncErrorMessage
                      ? 'bg-rose-50 border-rose-300 text-rose-800'
                      : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  }`}
                >
                  {(photoUploadStatus && !photoUploadStatus.ok) || syncErrorMessage ? (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  )}
                  <span>{photoUploadStatus?.message || syncErrorMessage}</span>
                </div>
              )}
            </div>
          </div>

          {/* ID Cards Display: Either Card Editor Grid OR A4 Sheets Preview */}
          {idCardFilteredStudents.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
              <CreditCard className="w-12 h-12 mx-auto text-slate-300 mb-2" />
              <div className="font-bold text-slate-700">এই শ্রেণিতে কোনো শিক্ষার্থীর তথ্য পাওয়া যায়নি।</div>
              <p className="text-xs text-slate-400 mt-1">শিক্ষার্থী ম্যানেজমেন্ট থেকে শিক্ষার্থী যুক্ত করুন।</p>
            </div>
          ) : idCardDisplayMode === 'sheets' ? (
            /* A4 Sheets Page Preview (Exact 4 Cards per Page) */
            <div className="space-y-8">
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-indigo-950 font-medium">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>
                    <strong>এ৪ পেপার প্রিভিউ মোড:</strong> প্রতি পৃষ্ঠায় ৪টি করে কার্ড সাজানো হয়েছে। ৫ম থেকে ৮ম কার্ড পরবর্তী পৃষ্ঠায় স্বয়ংক্রিয়ভাবে সেট হবে।
                  </span>
                </div>
                <div className="flex items-center gap-2 font-bold">
                  <span className="bg-white px-2.5 py-1 rounded-lg border border-indigo-200 text-indigo-900 shadow-2xs">
                    মোট শিক্ষার্থী: {toBengaliNumber(idCardFilteredStudents.length)} জন
                  </span>
                  <span className="bg-indigo-600 text-white px-2.5 py-1 rounded-lg shadow-2xs">
                    মোট এ৪ পৃষ্ঠা: {toBengaliNumber(idCardPrintSheets.length)} টি
                  </span>
                </div>
              </div>

              {idCardPrintSheets.map((sheet) => {
                const sheetNumber = sheet.sheetIndex + 1;
                const startCardIdx = sheet.sheetIndex * 4 + 1;
                const endCardIdx = sheet.sheetIndex * 4 + sheet.slots.length;

                return (
                  <div
                    key={`preview-sheet-${sheet.sheetIndex}`}
                    className="bg-white rounded-2xl border-2 border-indigo-100 shadow-sm p-4 sm:p-6 space-y-4"
                  >
                    {/* Sheet Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="bg-indigo-600 text-white font-mono font-bold px-3 py-1 rounded-xl text-xs shadow-2xs">
                          এ৪ পৃষ্ঠা নং: {toBengaliNumber(sheetNumber)}
                        </span>
                        <span className="text-xs font-bold text-slate-800">
                          {idCardSideView === 'both'
                            ? `২ জন শিক্ষার্থীর এপিঠ ও ওপিঠ (কার্ড ${toBengaliNumber(startCardIdx)} - ${toBengaliNumber(endCardIdx)})`
                            : `কার্ড ${toBengaliNumber(startCardIdx)} থেকে ${toBengaliNumber(endCardIdx)} (মোট ৪টি)`}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>স্ট্যান্ডার্ড A4 (210×297 মিমি)</span>
                        <span>•</span>
                        <span className="text-emerald-700 font-bold">কাটিং রেডি</span>
                      </div>
                    </div>

                    {/* Sheet Content: Either 2 folding units touching seamlessly or 2x2 grid */}
                    {idCardSideView === 'both' ? (
                      <div className="flex flex-col items-center gap-6 py-4 bg-slate-50/70 rounded-xl p-4 border border-dashed border-slate-300">
                        {sheet.students.map((student, sIdx) => {
                          const cls = classes.find((c) => c.id === student.classId);
                          const classNameBn = cls?.nameBn || 'শ্রেণি';
                          return (
                            <div key={`sheet-fold-${student.id}-${sIdx}`} className="flex flex-col items-center">
                              <div className="text-[10.5px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-0.5 rounded-full mb-1 flex items-center gap-1.5 shadow-2xs">
                                <FlipHorizontal className="w-3 h-3 text-indigo-600" />
                                <span>
                                  শিক্ষার্থী {toBengaliNumber(sIdx + 1)}: {student.nameBn} (রোল {toBengaliRoll(student.roll)}) • স্পর্শমান এপিঠ-ওপিঠ ভাজ ইউনিট
                                </span>
                              </div>
                              <div className="relative inline-flex items-center justify-center p-0.5 border-2 border-dashed border-slate-500 rounded-2xl bg-white shadow-sm overflow-hidden">
                                <div className="absolute top-1 left-1/2 -translate-x-1/2 z-20 bg-slate-900 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow pointer-events-none">
                                  ▼ ভাঁজ রেখা (Fold Line) ▼
                                </div>
                                <div className="shrink-0">
                                  <StudentIDCardSlip
                                    student={student}
                                    classNameBn={classNameBn}
                                    schoolInfo={schoolInfo}
                                    side="front"
                                    orientation={idCardOrientation}
                                    academicYear={selectedYear || '২০২৬'}
                                  />
                                </div>
                                <div className="w-0 self-stretch border-r-2 border-dashed border-slate-400 z-10 mx-0 my-1 pointer-events-none" />
                                <div className="shrink-0">
                                  <StudentIDCardSlip
                                    student={student}
                                    classNameBn={classNameBn}
                                    schoolInfo={schoolInfo}
                                    side="back"
                                    orientation={idCardOrientation}
                                    academicYear={selectedYear || '২০২৬'}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 justify-items-center items-center py-2 bg-slate-50/60 rounded-xl p-4 border border-dashed border-slate-200">
                        {sheet.slots.map((slot, sIdx) => {
                          const cls = classes.find((c) => c.id === slot.student.classId);
                          const classNameBn = cls?.nameBn || 'শ্রেণি';

                          return (
                            <div
                              key={`preview-slot-${slot.student.id}-${slot.side}-${sIdx}`}
                              className="flex flex-col items-center p-2 rounded-xl border border-dashed border-slate-300 bg-white shadow-2xs relative group"
                            >
                              <div className="text-[10px] font-bold text-slate-400 mb-1 flex items-center justify-between w-full px-1">
                                <span>
                                  {slot.side === 'front' ? '১ম পৃষ্ঠা (এপিঠ)' : '২য় পৃষ্ঠা (ওপিঠ)'}
                                </span>
                                <span className="font-mono text-indigo-800">
                                  রোল: {toBengaliRoll(slot.student.roll)}
                                </span>
                              </div>

                              <StudentIDCardSlip
                                student={slot.student}
                                classNameBn={classNameBn}
                                schoolInfo={schoolInfo}
                                side={slot.side}
                                orientation={idCardOrientation}
                                academicYear={selectedYear || '২০২৬'}
                                onPhotoUpload={handleIdCardPhotoUpload}
                                onEditDetails={(target) => setQuickEditStudent(target)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Traditional Card List & Photo/Details Editor Grid */
            <div
              className={`grid gap-6 ${
                idCardOrientation === 'portrait'
                  ? idCardSideView === 'both'
                    ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-2'
                    : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4'
                  : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-2'
              }`}
            >
              {idCardFilteredStudents.map((std) => {
                const cls = classes.find((c) => c.id === std.classId);
                const classNameBn = cls?.nameBn || 'শ্রেণি';

                return (
                  <div
                    key={std.id}
                    className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3 transition hover:shadow-md flex flex-col justify-between"
                  >
                    {/* Student Info Top Banner */}
                    <div className="no-print flex items-center justify-between pb-2 border-b border-slate-100 text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900 font-serif text-sm">{std.nameBn}</span>
                        <span className="bg-indigo-100 text-indigo-900 font-mono font-bold px-2 py-0.2 rounded text-[11px]">
                          রোল: {toBengaliRoll(std.roll)}
                        </span>
                        <span className="text-slate-500 font-medium">({classNameBn})</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setQuickEditStudent(std)}
                          className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[10.5px] rounded-lg transition flex items-center gap-1 shadow-2xs cursor-pointer"
                          title="পিতা ও মাতার নাম, ফোন নম্বর ও এনআইডি এডিট করুন"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>পিতা-মাতার তথ্য এডিট</span>
                        </button>
                        <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-500">
                          <Phone className="w-3 h-3 text-emerald-600" />
                          <span>{std.guardianPhone || std.fatherPhone || '-'}</span>
                        </div>
                      </div>
                    </div>

                    {/* RENDER SIDES BASED ON TOGGLE & ORIENTATION */}
                    {idCardSideView === 'both' ? (
                      <div className="flex flex-col items-center">
                        <div className="no-print text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full mb-2 flex items-center gap-1.5 shadow-2xs">
                          <FlipHorizontal className="w-3.5 h-3.5 text-indigo-600" />
                          <span>স্পর্শমান এপিঠ-ওপিঠ (Zero-Gap) • প্রিন্ট করে মাঝের দাগে ভাঁজ করলেই লেমিনেটিং রেডি</span>
                        </div>

                        {/* Touching Pair Unit */}
                        <div className="relative inline-flex flex-row items-center justify-center p-0.5 border-2 border-dashed border-slate-500 rounded-2xl bg-white shadow-md overflow-hidden">
                          {/* Top Fold Indicator Badge */}
                          <div className="no-print absolute top-1 left-1/2 -translate-x-1/2 z-20 bg-slate-900 text-white text-[9.5px] font-bold px-2 py-0.5 rounded shadow pointer-events-none">
                            ▼ ভাঁজ রেখা (Fold Line) ▼
                          </div>

                          {/* Front Side */}
                          <div className="shrink-0 flex flex-col items-center">
                            <span className="no-print text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 pt-0.5">
                              ১ম পৃষ্ঠা (এপিঠ)
                            </span>
                            <StudentIDCardSlip
                              student={std}
                              classNameBn={classNameBn}
                              schoolInfo={schoolInfo}
                              side="front"
                              orientation={idCardOrientation}
                              academicYear={selectedYear || '২০২৬'}
                              onPhotoUpload={handleIdCardPhotoUpload}
                              onEditDetails={(target) => setQuickEditStudent(target)}
                            />
                          </div>

                          {/* Center Fold Line */}
                          <div className="w-0 self-stretch border-r-2 border-dashed border-slate-400 z-10 mx-0 my-1 pointer-events-none" />

                          {/* Back Side */}
                          <div className="shrink-0 flex flex-col items-center">
                            <span className="no-print text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 pt-0.5">
                              ২য় পৃষ্ঠা (ওপিঠ)
                            </span>
                            <StudentIDCardSlip
                              student={std}
                              classNameBn={classNameBn}
                              schoolInfo={schoolInfo}
                              side="back"
                              orientation={idCardOrientation}
                              academicYear={selectedYear || '২০২৬'}
                              onPhotoUpload={handleIdCardPhotoUpload}
                              onEditDetails={(target) => setQuickEditStudent(target)}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-center gap-4 flex-1">
                        <div className="flex flex-col items-center">
                          <span className="no-print text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            {idCardSideView === 'front' ? '১ম পৃষ্ঠা • এপিঠ (FRONT)' : '২য় পৃষ্ঠা • ওপিঠ (BACK)'}
                          </span>
                          <StudentIDCardSlip
                            student={std}
                            classNameBn={classNameBn}
                            schoolInfo={schoolInfo}
                            side={idCardSideView}
                            orientation={idCardOrientation}
                            academicYear={selectedYear || '২০২৬'}
                            onPhotoUpload={handleIdCardPhotoUpload}
                            onEditDetails={(target) => setQuickEditStudent(target)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 
            Dedicated Hidden Print Source Container:
            Pre-chunked into exact 4-card A4 Sheets (2x2 grid) for the print engine.
            Contains only pure StudentIDCardSlip cards wrapped in .id-card-a4-sheet,
            with no screen headers, phone banners, or edit buttons.
          */}
          <div
            ref={printSheetsContainerRef}
            id="id-card-print-sheets-source"
            className="hidden"
            aria-hidden="true"
          >
            {idCardPrintSheets.map((sheet) => (
              idCardSideView === 'both' ? (
                <div
                  key={`print-sheet-${sheet.sheetIndex}`}
                  className="id-card-a4-sheet fold-layout"
                >
                  {sheet.students.map((student, sIdx) => {
                    const cls = classes.find((c) => c.id === student.classId);
                    const classNameBn = cls?.nameBn || 'শ্রেণি';
                    return (
                      <div
                        key={`fold-unit-${student.id}-${sIdx}`}
                        className="id-card-fold-unit"
                      >
                        <div className="fold-badge-top">▼ ভাজ রেখা (Fold Line) ▼</div>
                        <div className="id-card-fold-half">
                          <StudentIDCardSlip
                            student={student}
                            classNameBn={classNameBn}
                            schoolInfo={schoolInfo}
                            side="front"
                            orientation={idCardOrientation}
                            academicYear={selectedYear || '২০২৬'}
                          />
                        </div>
                        <div className="id-card-fold-center-line"></div>
                        <div className="id-card-fold-half">
                          <StudentIDCardSlip
                            student={student}
                            classNameBn={classNameBn}
                            schoolInfo={schoolInfo}
                            side="back"
                            orientation={idCardOrientation}
                            academicYear={selectedYear || '২০২৬'}
                          />
                        </div>
                      </div>
                    );
                  })}
                  <div className="sheet-watermark">
                    পাতা: {toBengaliNumber(sheet.sheetIndex + 1)} / {toBengaliNumber(idCardPrintSheets.length)} • {schoolInfo.name}
                  </div>
                </div>
              ) : (
                <div
                  key={`print-sheet-${sheet.sheetIndex}`}
                  className="id-card-a4-sheet grid-layout"
                >
                  {sheet.slots.map((slot, sIdx) => {
                    const cls = classes.find((c) => c.id === slot.student.classId);
                    const classNameBn = cls?.nameBn || 'শ্রেণি';
                    return (
                      <div
                        key={`slot-${slot.student.id}-${slot.side}-${sIdx}`}
                        className="id-card-print-slot"
                      >
                        <div className="id-card-slot-wrapper">
                          <StudentIDCardSlip
                            student={slot.student}
                            classNameBn={classNameBn}
                            schoolInfo={schoolInfo}
                            side={slot.side}
                            orientation={idCardOrientation}
                            academicYear={selectedYear || '২০২৬'}
                          />
                        </div>
                      </div>
                    );
                  })}
                  <div className="sheet-watermark">
                    পাতা: {toBengaliNumber(sheet.sheetIndex + 1)} / {toBengaliNumber(idCardPrintSheets.length)} • {schoolInfo.name}
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PART 4: AUDIT LOGS & GATEPASS HISTORY VIEW                                */}
      {/* ========================================================================= */}
      {activeTab === 'audit_logs' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden space-y-4">
          <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70">
            <div className="flex items-center space-x-2">
              <History className="w-5 h-5 text-indigo-600" />
              <div>
                <h3 className="font-bold text-base text-slate-900 font-serif">
                  গেটপাস অডিট ও অভিভাবক রেসপন্স কাউন্ট (Database Count)
                </h3>
                <p className="text-xs text-slate-500">
                  সকল শিক্ষার্থী প্রবেশ ও প্রস্থানের সময় এবং গার্ডিয়ান মেসেজ শোনার পর প্রদত্ত রেসপন্স কাউন্ট
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-bold">
                মোট স্ক্যান: {toBengaliNumber(guardianResponseStats.totalScans)}
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-black flex items-center gap-1">
                <CheckCheck className="w-3.5 h-3.5 text-emerald-700" />
                <span>অভিভাবক রেসপন্স কাউন্ট: {toBengaliNumber(guardianResponseStats.totalResponded)}</span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold">
                অপেক্ষমাণ: {toBengaliNumber(guardianResponseStats.pendingCount)}
              </div>

              {securityLogs.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('আপনি কি গেটপাসের সকল পূর্ববর্তী লগ মুছে ফেলতে চান?')) {
                      clearSecurityLogs();
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>লগ পরিষ্কার করুন</span>
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-100/80 text-slate-800 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 text-center w-12">ক্র.</th>
                  <th className="py-2.5 px-3 text-center w-28">সময় ও তারিখ</th>
                  <th className="py-2.5 px-3">শিক্ষার্থীর নাম</th>
                  <th className="py-2.5 px-3 text-center w-20">রোল</th>
                  <th className="py-2.5 px-3 text-center w-28">শ্রেণি</th>
                  <th className="py-2.5 px-3 text-center w-24">মুভমেন্ট</th>
                  <th className="py-2.5 px-3">অভিভাবক ফোন</th>
                  <th className="py-2.5 px-3">অভিভাবকের সাড়া (Response Count)</th>
                  <th className="py-2.5 px-3 text-center w-20">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {securityLogs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <ShieldCheck className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                      <div className="font-bold text-slate-700">আজকের কোনো গেটপাস লগ পাওয়া যায়নি।</div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        পার্ট ২-এ স্মার্টফোন স্ক্যানার দিয়ে এন্ট্রি/এক্সিট অনুমোদন করলে এখানে রিয়েল-টাইম লগ যুক্ত হবে।
                      </p>
                    </td>
                  </tr>
                ) : (
                  securityLogs.map((log, idx) => {
                    const logDate = new Date(log.timestamp);
                    const formattedTime = logDate.toLocaleTimeString('bn-BD', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: true,
                    });

                    return (
                      <tr key={log.id} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-500">
                          {toBengaliNumber(idx + 1)}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-700">
                          {formattedTime}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {log.studentNameBn}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-indigo-700">
                          {toBengaliRoll(log.studentRoll)}
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-700 font-medium">
                          {log.classNameBn}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              log.action === 'entry'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}
                          >
                            {log.action === 'entry' ? '↓ প্রবেশ' : '↑ প্রস্থান'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-700 text-[11px]">
                          {toBengaliNumber(log.guardianPhone)}
                        </td>
                        <td className="py-2.5 px-3">
                          {log.guardianAcknowledged ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 text-[11px] font-bold">
                                <CheckCheck className="w-3 h-3 text-emerald-700" />
                                <span>সাড়া দিয়েছেন ({log.acknowledgedBy || 'অভিভাবক'})</span>
                              </span>
                              {log.guardianResponse && (
                                <div className="text-[11px] text-slate-600 font-medium">
                                  "{log.guardianResponse}"
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[11px] font-semibold">
                              ⏳ অপেক্ষমাণ
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              const targetStd = students.find((s) => s.id === log.studentId);
                              const replayMsg = targetStd
                                ? buildGuardianVoiceMessage(targetStd, log.action)
                                : `শিক্ষার্থী ${log.studentNameBn}, ${log.classNameBn}, রোল নম্বর ${toBengaliNumber(log.studentRoll)}, ${log.action === 'entry' ? 'নিরাপদে বিদ্যালয়ে প্রবেশ করেছে' : 'বিদ্যালয় থেকে সফলভাবে প্রস্থান করেছে'}।`;
                              speakBengali(replayMsg, true);
                            }}
                            className="p-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition cursor-pointer"
                            title="ভয়েস ঘোষণা শুনুন"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PART 5: QR SCANNER DIAGNOSTIC AUDIT LOGS VIEW (স্ক্যানার লগ অডিট)        */}
      {/* ========================================================================= */}
      {activeTab === 'scanner_audit' && (() => {
        const totalEvents = scannerAuditLogs.length;
        const matchedCount = scannerAuditLogs.filter((e) => e.outcome === 'matched').length;
        const ambiguousCount = scannerAuditLogs.filter((e) => e.outcome === 'ambiguous').length;
        const rejectedCount = scannerAuditLogs.filter((e) => e.outcome === 'rejected').length;

        const searchLower = scannerAuditSearchQuery.trim().toLowerCase();
        const filteredAuditLogs = scannerAuditLogs.filter((entry) => {
          if (scannerAuditOutcomeFilter !== 'all' && entry.outcome !== scannerAuditOutcomeFilter) {
            return false;
          }
          if (scannerAuditSourceFilter !== 'all' && entry.source !== scannerAuditSourceFilter) {
            return false;
          }
          if (searchLower) {
            const haystack = [
              entry.rawPayload,
              entry.extractedToken,
              entry.matchRuleOrReason,
              entry.diagnosticNote,
              entry.resolvedStudentNameBn,
              entry.resolvedPortalId,
              entry.resolvedStudentId,
              entry.resolvedClassNameBn,
              ...(entry.ambiguousCandidates || []).map(
                (c) => `${c.nameBn} ${c.portalId} ${c.classNameBn}`
              ),
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();
            if (!haystack.includes(searchLower)) return false;
          }
          return true;
        });

        const sourceLabelBn = (src: ScannerAuditSource) => {
          switch (src) {
            case 'camera_qr':
              return 'ক্যামেরা QR';
            case 'manual_input':
              return 'ম্যানুয়াল ইনপুট';
            case 'disambiguation_pick':
              return 'তালিকা নির্বাচন';
            case 'quick_button':
              return '১-ক্লিক টেস্ট';
          }
        };

        const exportAuditCsv = () => {
          const escapeCsv = (val: string) =>
            `"${String(val || '').replace(/"/g, '""')}"`;
          const headers = [
            'Timestamp',
            'Source',
            'GateAction',
            'Outcome',
            'MatchRuleOrReason',
            'RawPayload',
            'ExtractedToken',
            'ResolvedStudentName',
            'ResolvedClass',
            'ResolvedRoll',
            'ResolvedPortalID',
            'ResolvedStudentID',
            'DiagnosticNote',
          ];
          const rows = filteredAuditLogs.map((e) => [
            e.timestamp,
            e.source,
            e.gateAction,
            e.outcome,
            e.matchRuleOrReason,
            e.rawPayload,
            e.extractedToken,
            e.resolvedStudentNameBn || '',
            e.resolvedClassNameBn || '',
            e.resolvedRoll !== undefined ? String(e.resolvedRoll) : '',
            e.resolvedPortalId || '',
            e.resolvedStudentId || '',
            e.diagnosticNote,
          ]);
          const csv =
            '\uFEFF' +
            [headers.map(escapeCsv).join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join(
              '\n'
            );
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `scanner-audit-${new Date().toISOString().slice(0, 10)}.csv`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        };

        return (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Header Strip */}
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/80 flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-slate-900 text-cyan-300 shrink-0">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-slate-900 font-serif">
                    স্ক্যানার লগ অডিট ও প্রোফাইল ম্যাপিং ডায়াগনস্টিকস
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5 max-w-2xl leading-relaxed">
                    গেট স্ক্যানারের প্রতিটি ক্যামেরা QR স্ক্যান, ম্যানুয়াল সার্চ, মূল পেলোড, এক্সট্র্যাক্টকৃত টোকেন, ম্যাপিং রুল এবং ভুল/দ্বিধাগ্রস্ত স্ক্যান আটকানোর পূর্ণাঙ্গ অডিট রেকর্ড।
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => fetchScannerAuditLogsFromServer(true)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${scannerAuditLoading ? 'animate-spin' : ''}`} />
                  <span>রিফ্রেশ</span>
                </button>

                {filteredAuditLogs.length > 0 && (
                  <button
                    type="button"
                    onClick={exportAuditCsv}
                    className="px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>CSV ডাউনলোড</span>
                  </button>
                )}

                {scannerAuditLogs.length > 0 && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm('আপনি কি সকল স্ক্যানার অডিট লগ মুছে ফেলতে চান?')) return;
                      try {
                        await fetch('/api/security/scanner-audit', { method: 'DELETE' });
                      } catch {}
                      setScannerAuditLogs([]);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>লগ পরিষ্কার</span>
                  </button>
                )}
              </div>
            </div>

            {/* 4-Column Interactive Summary Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 sm:px-5 border-b border-slate-200 bg-white">
              <button
                type="button"
                onClick={() => setScannerAuditOutcomeFilter('all')}
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  scannerAuditOutcomeFilter === 'all'
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900'
                }`}
              >
                <div
                  className={`text-[11px] font-bold ${
                    scannerAuditOutcomeFilter === 'all' ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  মোট স্ক্যান ইভেন্ট
                </div>
                <div className="text-xl font-bold font-mono tabular-nums mt-0.5">
                  {toBengaliNumber(totalEvents)}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setScannerAuditOutcomeFilter('matched')}
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  scannerAuditOutcomeFilter === 'matched'
                    ? 'border-emerald-700 bg-emerald-700 text-white'
                    : 'border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/70 text-emerald-950'
                }`}
              >
                <div
                  className={`text-[11px] font-bold flex items-center gap-1 ${
                    scannerAuditOutcomeFilter === 'matched' ? 'text-emerald-100' : 'text-emerald-700'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>সঠিক প্রোফাইল ম্যাপিং</span>
                </div>
                <div className="text-xl font-bold font-mono tabular-nums mt-0.5">
                  {toBengaliNumber(matchedCount)}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setScannerAuditOutcomeFilter('ambiguous')}
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  scannerAuditOutcomeFilter === 'ambiguous'
                    ? 'border-amber-600 bg-amber-600 text-white'
                    : 'border-amber-200 bg-amber-50/70 hover:bg-amber-100/70 text-amber-950'
                }`}
              >
                <div
                  className={`text-[11px] font-bold flex items-center gap-1 ${
                    scannerAuditOutcomeFilter === 'ambiguous' ? 'text-amber-100' : 'text-amber-700'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>দ্বিধা / একাধিক মিল (আটকানো)</span>
                </div>
                <div className="text-xl font-bold font-mono tabular-nums mt-0.5">
                  {toBengaliNumber(ambiguousCount)}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setScannerAuditOutcomeFilter('rejected')}
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  scannerAuditOutcomeFilter === 'rejected'
                    ? 'border-rose-700 bg-rose-700 text-white'
                    : 'border-rose-200 bg-rose-50/70 hover:bg-rose-100/70 text-rose-950'
                }`}
              >
                <div
                  className={`text-[11px] font-bold flex items-center gap-1 ${
                    scannerAuditOutcomeFilter === 'rejected' ? 'text-rose-100' : 'text-rose-700'
                  }`}
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>প্রত্যাখ্যাত / অকার্যকর টোকেন</span>
                </div>
                <div className="text-xl font-bold font-mono tabular-nums mt-0.5">
                  {toBengaliNumber(rejectedCount)}
                </div>
              </button>
            </div>

            {/* Filter & Search Toolbar */}
            <div className="p-4 sm:px-5 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg p-1 bg-slate-100 border border-slate-200">
                  {(
                    [
                      { id: 'all', label: 'সকল' },
                      { id: 'matched', label: 'সফল' },
                      { id: 'ambiguous', label: 'দ্বিধা' },
                      { id: 'rejected', label: 'ত্রুটি' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setScannerAuditOutcomeFilter(item.id)}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0 ${
                        scannerAuditOutcomeFilter === item.id
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <select
                  value={scannerAuditSourceFilter}
                  onChange={(e) => setScannerAuditSourceFilter(e.target.value as 'all' | ScannerAuditSource)}
                  className="text-xs font-bold bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800"
                >
                  <option value="all">সকল স্ক্যান উৎস</option>
                  <option value="camera_qr">ক্যামেরা QR স্ক্যান</option>
                  <option value="manual_input">ম্যানুয়াল ইনপুট / স্ক্যানার গান</option>
                  <option value="disambiguation_pick">তালিকা থেকে নির্বাচন</option>
                  <option value="quick_button">১-ক্লিক টেস্ট বাটন</option>
                </select>
              </div>

              <div className="relative flex-1 min-w-[220px] max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-2 text-slate-400" />
                <input
                  type="text"
                  value={scannerAuditSearchQuery}
                  onChange={(e) => setScannerAuditSearchQuery(e.target.value)}
                  placeholder="QR টোকেন, শিক্ষার্থীর নাম বা পোর্টাল আইডি..."
                  className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:border-indigo-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Diagnostic Audit Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-12">ক্র.</th>
                    <th className="py-2.5 px-3 w-36">সময় ও তারিখ</th>
                    <th className="py-2.5 px-3 w-36">স্ক্যান উৎস / গেট</th>
                    <th className="py-2.5 px-3 min-w-[210px]">স্ক্যানকৃত ডেটা ও এক্সট্র্যাক্ট টোকেন</th>
                    <th className="py-2.5 px-3 min-w-[230px]">ম্যাপিং রেজাল্ট ও কারণ</th>
                    <th className="py-2.5 px-3 min-w-[220px]">লোডকৃত প্রোফাইল / সম্ভাব্য তালিকা</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500">
                        <QrCode className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                        <div className="font-bold text-slate-700">
                          {scannerAuditLogs.length === 0
                            ? 'এখনও কোনো কিউআর স্ক্যান ইভেন্ট রেকর্ড হয়নি।'
                            : 'নির্বাচিত ফিল্টারে কোনো স্ক্যান ইভেন্ট পাওয়া যায়নি।'}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          পার্ট ২ স্ক্যানারে ক্যামেরা বা ইনপুট দিয়ে স্ক্যান করলেই প্রতিটি রেজাল্ট ম্যাপিং এখানে স্বয়ংক্রিয়ভাবে অডিট হবে।
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredAuditLogs.map((entry, idx) => {
                      const dt = new Date(entry.timestamp);
                      const timeStr = Number.isNaN(dt.getTime())
                        ? entry.timestamp
                        : dt.toLocaleTimeString('bn-BD', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: true,
                          });
                      const dateStr = Number.isNaN(dt.getTime())
                        ? ''
                        : dt.toLocaleDateString('bn-BD', {
                            day: '2-digit',
                            month: 'short',
                          });
                      const resolvedStudentObj = entry.resolvedStudentId
                        ? students.find((s) => s.id === entry.resolvedStudentId)
                        : undefined;
                      const showDistinctExtracted =
                        Boolean(entry.extractedToken) &&
                        entry.extractedToken.trim() !== entry.rawPayload.trim();

                      return (
                        <tr key={entry.id} className="hover:bg-slate-50/90 align-top transition">
                          <td className="py-3 px-3 text-center font-mono tabular-nums font-bold text-slate-500">
                            {toBengaliNumber(idx + 1)}
                          </td>

                          <td className="py-3 px-3 whitespace-nowrap">
                            <div className="font-mono tabular-nums font-bold text-slate-900">
                              {timeStr}
                            </div>
                            {dateStr && (
                              <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
                                {dateStr}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900 flex items-center gap-1">
                              {entry.source === 'camera_qr' ? (
                                <Camera className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                              ) : entry.source === 'manual_input' ? (
                                <Search className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                              ) : (
                                <Zap className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              )}
                              <span>{sourceLabelBn(entry.source)}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              গেট: {entry.gateAction === 'entry' ? 'প্রবেশ (Entry)' : 'প্রস্থান (Exit)'}
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <div className="flex items-start gap-1.5 max-w-[280px]">
                              <code className="font-mono text-[11px] bg-slate-100 border border-slate-200 text-slate-900 px-2 py-1 rounded break-all flex-1">
                                {entry.rawPayload}
                              </code>
                              <button
                                type="button"
                                onClick={() => {
                                  if (navigator.clipboard) {
                                    navigator.clipboard.writeText(entry.rawPayload).catch(() => {});
                                  }
                                  setCopiedAuditTokenId(entry.id);
                                  setTimeout(() => setCopiedAuditTokenId(null), 1500);
                                }}
                                className="p-1 rounded border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-900 shrink-0 cursor-pointer"
                                title="স্ক্যানকৃত ডেটা কপি করুন"
                              >
                                {copiedAuditTokenId === entry.id ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                            {showDistinctExtracted && (
                              <div className="mt-1 text-[10.5px] text-indigo-800 font-mono break-all">
                                টোকেন: <span className="font-bold">{entry.extractedToken}</span>
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-3">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {entry.outcome === 'matched' ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  সফল ম্যাপিং
                                </span>
                              ) : entry.outcome === 'ambiguous' ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                                  দ্বিধা / আটকানো
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                                  <XCircle className="w-3 h-3 text-rose-600" />
                                  প্রত্যাখ্যাত
                                </span>
                              )}

                              <code className="text-[10px] font-mono font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                {entry.matchRuleOrReason}
                              </code>
                            </div>

                            <div className="text-[11px] text-slate-700 mt-1 leading-snug">
                              {entry.diagnosticNote}
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            {entry.resolvedStudentNameBn ? (
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-9 rounded border border-slate-300 bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                                  {resolvedStudentObj?.avatarUrl ? (
                                    <img
                                      src={resolvedStudentObj.avatarUrl}
                                      alt={entry.resolvedStudentNameBn}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <User className="w-4 h-4 text-slate-400" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-900 truncate">
                                    {entry.resolvedStudentNameBn}
                                  </div>
                                  <div className="text-[11px] text-slate-600">
                                    {entry.resolvedClassNameBn || '-'} • রোল{' '}
                                    {entry.resolvedRoll !== undefined
                                      ? toBengaliRoll(entry.resolvedRoll)
                                      : '-'}
                                  </div>
                                  <div className="text-[10px] font-mono tabular-nums font-bold text-indigo-700">
                                    {entry.resolvedPortalId || '-'}
                                    {entry.resolvedStudentId
                                      ? ` • #${entry.resolvedStudentId.slice(-4).toUpperCase()}`
                                      : ''}
                                  </div>
                                </div>
                              </div>
                            ) : entry.ambiguousCandidates && entry.ambiguousCandidates.length > 0 ? (
                              <div className="space-y-1">
                                <div className="text-[10.5px] font-bold text-amber-900">
                                  মিল পাওয়া {toBengaliNumber(entry.ambiguousCandidates.length)} জন শিক্ষার্থী:
                                </div>
                                <div className="space-y-0.5">
                                  {entry.ambiguousCandidates.map((cand) => (
                                    <div
                                      key={cand.id}
                                      className="text-[11px] text-slate-700 bg-amber-50/70 border border-amber-200/80 rounded px-2 py-0.5"
                                    >
                                      <span className="font-bold">{cand.nameBn}</span> •{' '}
                                      {cand.classNameBn} (রোল {toBengaliRoll(cand.roll)}){' '}
                                      <span className="font-mono text-[10px] text-indigo-800">
                                        {cand.portalId}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="text-[11px] font-semibold text-rose-700">
                                কোনো প্রোফাইল লোড হয়নি (নিরাপদভাবে ব্লকড)
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* QUICK EDIT STUDENT & PARENT DETAILS MODAL                                 */}
      {/* ========================================================================= */}
      {quickEditStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border-2 border-indigo-900 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#091e42] to-indigo-900 text-white p-4 flex items-center justify-between border-b-2 border-amber-500">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-400 text-slate-950 rounded-xl">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white font-serif">
                    অভিভাবক ও শিক্ষার্থীর তথ্য এডিট
                  </h3>
                  <div className="text-xs text-amber-300 font-medium">
                    {quickEditStudent.nameBn} • রোল: {toBengaliRoll(quickEditStudent.roll)}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setQuickEditStudent(null)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveQuickEdit} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
              {/* Father Section */}
              <div className="border border-indigo-200 rounded-xl p-3 bg-indigo-50/40 space-y-2.5">
                <div className="flex items-center gap-1.5 text-indigo-950 font-bold border-b border-indigo-100 pb-1.5">
                  <User className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs uppercase tracking-wide">পিতার তথ্য (Father Details)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      পিতার নাম (বাংলা) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={quickEditStudent.fatherNameBn || quickEditStudent.fatherName || ''}
                      onChange={(e) =>
                        setQuickEditStudent({
                          ...quickEditStudent,
                          fatherNameBn: e.target.value,
                          fatherName: e.target.value,
                        })
                      }
                      placeholder="উদা: মোঃ আবুল কাশেম"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      পিতার নাম (English)
                    </label>
                    <input
                      type="text"
                      value={quickEditStudent.fatherNameEn || ''}
                      onChange={(e) =>
                        setQuickEditStudent({
                          ...quickEditStudent,
                          fatherNameEn: e.target.value,
                        })
                      }
                      placeholder="e.g. Md. Abul Kashem"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      পিতার মোবাইল নম্বর <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={quickEditStudent.fatherPhone || quickEditStudent.guardianPhone || ''}
                      onChange={(e) =>
                        setQuickEditStudent({
                          ...quickEditStudent,
                          fatherPhone: e.target.value,
                          guardianPhone: e.target.value,
                        })
                      }
                      placeholder="উদা: 01712345678"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      পিতার জাতীয় পরিচয়পত্র (NID)
                    </label>
                    <input
                      type="text"
                      value={quickEditStudent.fatherNid || ''}
                      onChange={(e) =>
                        setQuickEditStudent({
                          ...quickEditStudent,
                          fatherNid: e.target.value,
                        })
                      }
                      placeholder="উদা: 1984261529100012"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Mother Section */}
              <div className="border border-rose-200 rounded-xl p-3 bg-rose-50/40 space-y-2.5">
                <div className="flex items-center gap-1.5 text-rose-950 font-bold border-b border-rose-100 pb-1.5">
                  <Heart className="w-4 h-4 text-rose-600" />
                  <span className="text-xs uppercase tracking-wide">মাতার তথ্য (Mother Details)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      মাতার নাম (বাংলা) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={quickEditStudent.motherNameBn || quickEditStudent.motherName || ''}
                      onChange={(e) =>
                        setQuickEditStudent({
                          ...quickEditStudent,
                          motherNameBn: e.target.value,
                          motherName: e.target.value,
                        })
                      }
                      placeholder="উদা: নাসরিন জাহান"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-rose-500 focus:outline-none font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      মাতার নাম (English)
                    </label>
                    <input
                      type="text"
                      value={quickEditStudent.motherNameEn || ''}
                      onChange={(e) =>
                        setQuickEditStudent({
                          ...quickEditStudent,
                          motherNameEn: e.target.value,
                        })
                      }
                      placeholder="e.g. Nasrin Jahan"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      মাতার মোবাইল নম্বর
                    </label>
                    <input
                      type="tel"
                      value={quickEditStudent.motherPhone || ''}
                      onChange={(e) =>
                        setQuickEditStudent({
                          ...quickEditStudent,
                          motherPhone: e.target.value,
                        })
                      }
                      placeholder="উদা: 01812345679"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-rose-500 focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      মাতার জাতীয় পরিচয়পত্র (NID)
                    </label>
                    <input
                      type="text"
                      value={quickEditStudent.motherNid || ''}
                      onChange={(e) =>
                        setQuickEditStudent({
                          ...quickEditStudent,
                          motherNid: e.target.value,
                        })
                      }
                      placeholder="উদা: 1987261529100045"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-rose-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Address & Emergency Info */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      রক্তের গ্রুপ (Blood Group)
                    </label>
                    <select
                      value={quickEditStudent.bloodGroup || 'A+'}
                      onChange={(e) =>
                        setQuickEditStudent({
                          ...quickEditStudent,
                          bloodGroup: e.target.value,
                        })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-bold"
                    >
                      {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((bg) => (
                        <option key={bg} value={bg}>
                          {bg}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      জরুরি যোগাযোগ ফোন নম্বর
                    </label>
                    <input
                      type="tel"
                      value={quickEditStudent.emergencyPhone || quickEditStudent.guardianPhone || ''}
                      onChange={(e) =>
                        setQuickEditStudent({
                          ...quickEditStudent,
                          emergencyPhone: e.target.value,
                        })
                      }
                      placeholder="উদা: 01712345678"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      বর্তমান ঠিকানা (ঠিকানা কার্ডের পেছনে মুদ্রিত হবে)
                    </label>
                    <input
                      type="text"
                      value={quickEditStudent.presentAddress || ''}
                      onChange={(e) =>
                        setQuickEditStudent({
                          ...quickEditStudent,
                          presentAddress: e.target.value,
                        })
                      }
                      placeholder="উদা: দক্ষিণগাঁও, সনমানিয়া, কাপাসিয়া, গাজীপুর।"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-indigo-900 font-bold mb-1">
                      শিক্ষার্থীর ইউনিক লগইন আইডি (Portal ID)
                    </label>
                    <input
                      type="text"
                      value={quickEditStudent.portalUserId ?? getStudentPortalId(quickEditStudent)}
                      onChange={(e) =>
                        setQuickEditStudent({
                          ...quickEditStudent,
                          portalUserId: e.target.value.trim().toUpperCase(),
                        })
                      }
                      placeholder="উদা: DL-C4-01"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-indigo-300 bg-indigo-50/50 font-mono font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-indigo-900 font-bold mb-1">
                      ব্যক্তিগত পাসওয়ার্ড / পিন (Portal PIN)
                    </label>
                    <input
                      type="text"
                      value={quickEditStudent.guardianPin || ''}
                      onChange={(e) =>
                        setQuickEditStudent({
                          ...quickEditStudent,
                          guardianPin: e.target.value.trim(),
                        })
                      }
                      placeholder="উদা: 482913"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-indigo-300 bg-indigo-50/50 font-mono font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-slate-600 font-bold mb-1">
                      অভিভাবক Google Cloud UID (ভিন্ন জিমেইলের ক্লাউড এলার্মের জন্য — ঐচ্ছিক)
                    </label>
                    <input
                      type="text"
                      value={quickEditStudent.guardianUid || ''}
                      onChange={(e) =>
                        setQuickEditStudent({
                          ...quickEditStudent,
                          guardianUid: e.target.value.trim(),
                        })
                      }
                      placeholder="অভিভাবকের 'আইডি কার্ড ও পাসওয়ার্ড' ট্যাব থেকে কপি করা UID বসান"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono text-[11px] text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setQuickEditStudent(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold transition cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>সংরক্ষণ ও আপডেট করুন</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* QR SCAN CONFIRMATION MODAL (PHOTO, NAME, CLASS + WELCOME AUDIO TRIGGER)  */}
      {/* ========================================================================= */}
      {pendingScanConfirmation && (() => {
        const pendingStd = pendingScanConfirmation.student;
        const previewAudioText = buildScannerVoiceMessage(
          pendingStd,
          pendingScanConfirmation.classNameBn,
          gateAction,
          activeScannerVoiceSettings
        );
        const guardianPhoneDisplay =
          pendingStd.guardianPhone || pendingStd.fatherPhone || pendingStd.motherPhone || '-';

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs"
            role="dialog"
            aria-modal="true"
            aria-labelledby="scan-confirm-modal-title"
          >
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              {/* Top Bar */}
              <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500 text-slate-950 shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 id="scan-confirm-modal-title" className="text-base font-bold text-white font-serif">
                      কিউআর স্ক্যান সফল — শিক্ষার্থী নিশ্চিত করুন
                    </h3>
                    <div className="text-[11px] text-slate-300 mt-0.5">
                      {gateAction === 'entry' ? 'প্রবেশ যাচাই (Entry Gate)' : 'প্রস্থান যাচাই (Exit Gate)'} ·{' '}
                      {describeMatchRuleBn(pendingScanConfirmation.matchedBy)}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCancelPendingScan}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
                  aria-label="মোডাল বন্ধ করুন"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Student Identity Body */}
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <div className="w-24 h-28 rounded-xl border-2 border-indigo-900 bg-white overflow-hidden shadow-xs flex items-center justify-center shrink-0">
                    {pendingStd.avatarUrl ? (
                      <img
                        src={pendingStd.avatarUrl}
                        alt={pendingStd.nameBn}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center text-slate-400 px-1">
                        <User className="w-9 h-9 mx-auto" />
                        <span className="text-[10px] font-bold block mt-1">ছবি নেই</span>
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="text-lg font-bold text-slate-900 leading-snug">
                      {pendingStd.nameBn}
                    </div>
                    {pendingStd.nameEn && (
                      <div className="text-xs text-slate-500 font-sans truncate">
                        {pendingStd.nameEn}
                      </div>
                    )}

                    <div className="pt-1 space-y-1 text-xs">
                      <div className="font-bold text-indigo-900">
                        শ্রেণি: {pendingScanConfirmation.classNameBn}
                        {pendingStd.section ? ` (${pendingStd.section})` : ''}
                      </div>
                      <div className="text-slate-700 font-medium font-mono tabular-nums">
                        রোল: {toBengaliRoll(pendingStd.roll)} · {getStudentPortalId(pendingStd)}
                      </div>
                      <div className="text-[11px] text-slate-600 truncate">
                        অভিভাবক: {pendingStd.fatherNameBn || pendingStd.guardianName || '-'} · {guardianPhoneDisplay}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Audio Announcement Preview */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                    <Volume2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>
                      {gateAction === 'entry'
                        ? "নিশ্চিত করলে সালাম বাজবে, হাজিরা সেভ হবে এবং অভিভাবক ফোনে লাইভ ভয়েস এলার্ম যাবে:"
                        : "নিশ্চিত করলে বিদায় সালাম বাজবে এবং অভিভাবক ফোনে লাইভ ভয়েস এলার্ম যাবে:"}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-950 leading-relaxed font-medium">
                    "{previewAudioText}"
                  </p>
                </div>

                {/* Live Target Guardian Online Status Inside Confirmation Modal */}
                {(() => {
                  const targetPortalId = getStudentPortalId(pendingStd).trim().toUpperCase();
                  const matchedGuardian = liveServerHealth.onlineGuardians.find(
                    (g) =>
                      (g.studentId && g.studentId === pendingStd.id) ||
                      (g.portalId && g.portalId.toUpperCase() === targetPortalId) ||
                      (g.classId &&
                        g.roll &&
                        g.classId === pendingStd.classId &&
                        Number(g.roll) === Number(pendingStd.roll))
                  );
                  if (liveServerHealth.staticHostNoBackend) {
                    return (
                      <div className="px-3.5 py-2.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-[11px] font-bold flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <span>
                          সতর্কতা: এই হোস্টিংয়ে ব্যাকএন্ড সার্ভার (server.ts) নেই! নিশ্চিত করলে কেবল এই ডিভাইসে অডিও বাজবে — অভিভাবকের ফোনে যাবে না।
                        </span>
                      </div>
                    );
                  }
                  if (liveServerHealth.authRedirected || !liveServerHealth.reachable) {
                    return (
                      <div className="px-3.5 py-2.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-[11px] font-bold flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <span>
                          {liveServerHealth.authRedirected
                            ? 'সতর্কতা: সার্ভার সেশন ব্লক — পেজ রিলোড না করলে অভিভাবক ফোনে এলার্ম যাবে না!'
                            : 'সতর্কতা: কেন্দ্রীয় সার্ভারের সাথে সংযোগ বিচ্ছিন্ন! অভিভাবক ফোনে সিগন্যাল পাঠাতে সমস্যা হতে পারে।'}
                        </span>
                      </div>
                    );
                  }
                  if (matchedGuardian) {
                    return (
                      <div className="px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-[11px] font-bold flex items-center gap-2">
                        <Radio className="w-4 h-4 text-emerald-600 shrink-0 animate-pulse" />
                        <span>
                          ✓ {pendingStd.nameBn}-এর অভিভাবক ফোন এই সার্ভারে লাইভ যুক্ত আছে ({matchedGuardian.transport.toUpperCase()}) — নিশ্চিত করলেই বেজে উঠবে!
                        </span>
                      </div>
                    );
                  }
                  return (
                    <div className="px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-[11px] font-medium flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>
                        এই মুহূর্তে {pendingStd.nameBn}-এর অভিভাবক ফোন ({targetPortalId}) এই সার্ভারে
                        {liveServerHealth.serverInstanceId ? ` (${liveServerHealth.serverInstanceId})` : ''} লাইভ দেখাচ্ছে না। অভিভাবকের ফোন একই লিংকে
                        {typeof window !== 'undefined' && window.location.host.startsWith('ais-dev-')
                          ? ' (দুই ফোনেই Shared App URL অর্থাৎ ais-pre-...)'
                          : ''}{' '}
                        খোলা আছে কিনা দেখুন।
                      </span>
                    </div>
                  );
                })()}

                {/* Action Buttons */}
                <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={handleCancelPendingScan}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition cursor-pointer whitespace-nowrap shrink-0"
                  >
                    বাতিল / পুনরায় স্ক্যান
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirmPendingScan}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-sm cursor-pointer whitespace-nowrap shrink-0"
                    autoFocus
                  >
                    <Volume2 className="w-4 h-4 shrink-0" />
                    <span>
                      {gateAction === 'entry'
                        ? "নিশ্চিত করুন, সালাম বলুন ও হাজিরা দিন"
                        : "নিশ্চিত করুন ও সালামসহ 'বিদায়' বলুন"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Same-Server Guardian Phone Direct Pairing QR Modal */}
      {showGuardianQrBridge && (() => {
        const selectedStd =
          students.find((s) => s.id === bridgeTargetStudentId) ||
          recentScannedStudent ||
          students.find((s) => s.classId === 'class_4' && Number(s.roll) === 1) ||
          students[0];
        const isDevHost =
          typeof window !== 'undefined' && window.location.origin.includes('://ais-dev-');
        const preOrigin =
          typeof window !== 'undefined'
            ? window.location.origin.replace('://ais-dev-', '://ais-pre-')
            : '';
        const bridgeOrigin =
          typeof window !== 'undefined'
            ? isDevHost && bridgeOriginMode === 'pre'
              ? preOrigin
              : window.location.origin
            : '';
        const shareUrl =
          bridgeOrigin && selectedStd
            ? `${bridgeOrigin}/?tab=security&guardian=${encodeURIComponent(selectedStd.id)}`
            : '';
        return (
          <div
            className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setShowGuardianQrBridge(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-[#091e42] text-white px-5 py-4 flex items-center justify-between border-b-2 border-amber-400">
                <div className="flex items-center gap-2.5">
                  <QrCode className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <h3 className="text-sm sm:text-base font-bold font-serif">
                      অভিভাবক ফোনে ঠিক এই সার্ভার খুলুন
                    </h3>
                    <p className="text-[11px] text-slate-300">
                      দুই ফোনে একই ঠিকানা থাকলে ১ সেকেন্ডে ভয়েস বাজবে
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGuardianQrBridge(false)}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                {isDevHost && (
                  <div className="bg-amber-50 border border-amber-300 text-amber-950 rounded-xl p-3 text-[11px] leading-relaxed space-y-2">
                    <div>
                      <strong>সার্ভার নির্বাচন ({siblingPreStatus.reachable ? 'Shared App সচল' : 'প্রিভিউ মোড'}):</strong>{' '}
                      {siblingPreStatus.reachable
                        ? `দুটি ফোনেই Shared App URL (ais-pre-) ব্যবহার করা উত্তম। বর্তমানে এই স্ক্যানার থেকে দুই সার্ভারেই স্ক্যান পাঠানো হয়।`
                        : `Shared App URL (ais-pre-) এই মুহূর্তে চালু নেই — তাই একই প্রিভিউ লিংক (Same Server) ব্যবহার করুন।`}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setBridgeOriginMode('same')}
                        className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer border ${
                          bridgeOriginMode === 'same'
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-800 border-slate-300'
                        }`}
                      >
                        এই একই সার্ভার (Same Host)
                      </button>
                      <button
                        type="button"
                        onClick={() => setBridgeOriginMode('pre')}
                        className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer border ${
                          bridgeOriginMode === 'pre'
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-slate-800 border-slate-300'
                        }`}
                      >
                        Shared App (ais-pre-) {siblingPreStatus.reachable ? '✓' : ''}
                      </button>
                      {siblingPreStatus.reachable && (
                        <a
                          href={preOrigin}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 rounded-lg font-bold bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>স্ক্যানার ais-pre- এ খুলুন</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    যে শিক্ষার্থীর ড্যাশবোর্ড অভিভাবক ফোনে খুলবেন:
                  </label>
                  <select
                    value={selectedStd?.id || ''}
                    onChange={(e) => setBridgeTargetStudentId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-slate-900 font-bold"
                  >
                    {students.slice(0, 200).map((s) => {
                      const clsName = classes.find((c) => c.id === s.classId)?.nameBn || s.classId;
                      return (
                        <option key={s.id} value={s.id}>
                          {clsName} • রোল {toBengaliRoll(s.roll)} • {s.nameBn} ({getStudentPortalId(s)})
                        </option>
                      );
                    })}
                  </select>
                </div>

                {bridgeQrDataUrl && (
                  <div className="flex flex-col items-center bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                    <img
                      src={bridgeQrDataUrl}
                      alt="Guardian Direct Link QR"
                      className="w-48 h-48 rounded-lg border border-slate-300 bg-white"
                    />
                    <p className="text-[11px] text-slate-600 text-center">
                      অভিভাবকের স্মার্টফোন ক্যামেরা দিয়ে এই QR কোড স্ক্যান করুন অথবা নিচের লিংক কপি করে পাঠান
                    </p>
                  </div>
                )}

                {shareUrl && (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={shareUrl}
                      className="flex-1 px-2.5 py-2 border border-slate-300 rounded-lg font-mono text-[11px] text-slate-700 bg-slate-50"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedStd && shareUrl) {
                          if (navigator.clipboard) {
                            navigator.clipboard.writeText(shareUrl).catch(() => {});
                          }
                          setCopiedGuardianLinkId(selectedStd.id);
                          setTimeout(() => setCopiedGuardianLinkId(null), 2500);
                        }
                      }}
                      className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>
                        {selectedStd && copiedGuardianLinkId === selectedStd.id ? 'কপি হয়েছে ✓' : 'কপি'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};
