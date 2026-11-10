import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
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
} from 'lucide-react';
import jsQR from 'jsqr';
import { useSchool } from '../context/SchoolContext';
import { Student, SecurityGatepassLog } from '../types';
import { toBengaliNumber, toBengaliRoll, formatBengaliDate } from '../utils/bengali';
import { SchoolLogo } from './SchoolLogo';
import { StudentIDCardSlip } from './StudentIDCardSlip';
import { compressImageBase64 } from '../utils/imageCompressor';
import { openIdCardsInNewTab, downloadIdCardsHtml } from '../utils/idCardExport';

// Web Audio API beep sound generator for realistic barcode scanner beep
const playScannerBeep = (freq = 1900, durationMs = 120) => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
  } catch (err) {
    // Audio might be blocked until user gesture
  }
};

// Play siren / alarm chime for guardian alert
const playAlarmChime = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc1.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, ctx.currentTime);
    osc2.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.15); // D6

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start();
    osc2.start();
    osc1.stop(ctx.currentTime + 0.45);
    osc2.stop(ctx.currentTime + 0.45);
  } catch {
    // Ignore
  }
};

export const DigitalSecurityGatepassView: React.FC = () => {
  const {
    schoolInfo,
    classes,
    students,
    updateStudent,
    securityLogs,
    addSecurityLog,
    clearSecurityLogs,
    selectedClassId,
    selectedYear,
    isServerSyncing,
    serverSyncStatus,
    lastSyncedTime,
    forceServerSync,
    seedParentDetailsForClass,
  } = useSchool();

  // Top-Level Active Tab for the 3 core parts mandated by user:
  // Part 1: guardian_portal (অভিভাবক একাউন্ট ও ড্যাশবোর্ড)
  // Part 2: barcode_scanner (স্মার্ট ফোনের মাধ্যমে বারকোড স্ক্যানার)
  // Part 3: idcard_generator (কিউআর কোড যুক্ত এপিঠ ওপিঠ আইডিকার্ড জেনারেটর)
  // Part 4: audit_logs (গেটপাস অডিট ও অ্যাক্সেস লগ)
  const [activeTab, setActiveTab] = useState<'guardian_portal' | 'barcode_scanner' | 'idcard_generator' | 'audit_logs'>('barcode_scanner');

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
    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: cameraFacingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCameraActive(true);

      const track = stream.getVideoTracks()[0];
      if (track) {
        const caps = (track.getCapabilities && (track.getCapabilities() as any)) || {};
        setHasTorchSupport(Boolean(caps.torch));
      }
    } catch (err: any) {
      console.warn('Camera access issue, trying fallback:', err);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        mediaStreamRef.current = fallbackStream;
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          await videoRef.current.play();
        }
        setIsCameraActive(true);
      } catch (fErr) {
        setCameraError('ক্যামেরা চালু করা যায়নি বা অনুমতি দেওয়া হয়নি। আপনি নিচের বারকোড ইনপুট বক্স ব্যবহার করে সরাসরি স্ক্যান করতে পারেন।');
        setIsCameraActive(false);
      }
    }
  };

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

  // Bengali Voice Synthesis helper
  const speakBengali = (text: string) => {
    if (!voiceEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.05;
      utterance.lang = 'bn-BD';

      const voices = window.speechSynthesis.getVoices();
      const bnVoice = voices.find(
        (v) => v.lang.startsWith('bn') || v.lang.includes('Bengali') || v.lang.includes('Bangla')
      );
      if (bnVoice) {
        utterance.voice = bnVoice;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Speech synthesis error:', err);
      setIsSpeaking(false);
    }
  };

  // Perform Gate Verification and Broadcast
  const handleVerifyStudent = (student: Student) => {
    const studentClass = classes.find((c) => c.id === student.classId);
    const classNameBn = studentClass?.nameBn || 'শ্রেণি';
    const actionLabel = gateAction === 'entry' ? 'বিদ্যালয়ে প্রবেশ' : 'বিদ্যালয় থেকে প্রস্থান';
    const actionVerb =
      gateAction === 'entry' ? 'নিরাপদে বিদ্যালয়ে প্রবেশ করেছে' : 'বিদ্যালয় থেকে সফলভাবে প্রস্থান করেছে';

    const voiceMsg = `শিক্ষার্থী ${student.nameBn}, ${classNameBn}, রোল নম্বর ${toBengaliNumber(student.roll)}, ${actionVerb}।`;
    const guardianPhone =
      student.guardianPhone || student.fatherPhone || student.motherPhone || '০১৭০০-০০০০০০';

    // 1. Play barcode scanner beep tone
    if (soundBeepEnabled) {
      playScannerBeep();
    }

    // 2. Add security log
    addSecurityLog({
      studentId: student.id,
      studentNameBn: student.nameBn,
      studentRoll: student.roll,
      classNameBn,
      action: gateAction,
      guardianPhone,
      voiceDispatched: voiceEnabled,
      smsDispatched: smsSimulationEnabled,
      status: 'verified',
      operatorNote: `${actionLabel} সফলভাবে সম্পন্ন হয়েছে`,
    });

    setRecentScannedStudent(student);
    setLiveAnnouncement(voiceMsg);
    setScannerFeedback(`✓ ${student.nameBn} (${toBengaliRoll(student.roll)}) — ${actionLabel} অনুমোদিত!`);

    // 3. Play Bengali Voice Announcement
    if (voiceEnabled) {
      speakBengali(voiceMsg);
    }

    // Clear input
    setBarcodeInput('');

    setTimeout(() => {
      setScannerFeedback(null);
    }, 4500);
  };

  // Filter and match students based on scanned QR code, barcode, roll, or phone
  const handleBarcodeSearchSubmit = (inputQuery: string) => {
    if (!inputQuery.trim()) return;
    const q = inputQuery.toLowerCase().trim();
    const cleanDigitsQ = q.replace(/\D/g, '');

    const matched = students.find((s) => {
      const rollStr = String(s.roll).trim();
      const rollBn = toBengaliNumber(s.roll).trim();
      const matchRoll = rollStr === q || rollBn === q;

      const sBirthDigits = s.birthRegNo ? s.birthRegNo.replace(/\D/g, '') : '';
      const matchBirth = Boolean(sBirthDigits && cleanDigitsQ && sBirthDigits === cleanDigitsQ);

      const sIdLower = s.id.toLowerCase();
      const matchId = sIdLower === q || sIdLower.endsWith(q) || q.includes(sIdLower);

      const matchQr = Boolean(
        s.securityQrCode &&
          (s.securityQrCode.toLowerCase().includes(q) || q.includes(s.securityQrCode.toLowerCase()))
      );

      const sClassStr = (s.classId || '').toLowerCase();
      const defaultQr = `dlikon-sec-${sClassStr}-${s.roll}-${s.id.slice(-4)}`.toLowerCase();
      const matchDefaultQr = defaultQr === q || q.includes(defaultQr) || defaultQr.includes(q);

      const hasRollSegment =
        q.includes(`-${rollStr}-`) ||
        q.endsWith(`-${rollStr}`) ||
        q.startsWith(`${rollStr}-`) ||
        q.includes(`_${rollStr}_`) ||
        q.endsWith(`_${rollStr}`) ||
        (q.includes(s.id.toLowerCase().slice(-4)) && q.includes(rollStr));

      const matchClassAndRoll = Boolean(sClassStr && q.includes(sClassStr) && q.includes(rollStr));

      const matchName = s.nameBn.toLowerCase().includes(q) || (s.nameEn && s.nameEn.toLowerCase().includes(q));

      const sFatherPhoneDigits = s.fatherPhone ? s.fatherPhone.replace(/\D/g, '') : '';
      const sGuardianPhoneDigits = s.guardianPhone ? s.guardianPhone.replace(/\D/g, '') : '';
      const matchPhone = Boolean(
        (cleanDigitsQ.length >= 6 && sFatherPhoneDigits && sFatherPhoneDigits.includes(cleanDigitsQ)) ||
          (cleanDigitsQ.length >= 6 && sGuardianPhoneDigits && sGuardianPhoneDigits.includes(cleanDigitsQ))
      );

      return (
        matchRoll ||
        matchBirth ||
        matchId ||
        matchQr ||
        matchDefaultQr ||
        hasRollSegment ||
        matchClassAndRoll ||
        matchName ||
        matchPhone
      );
    });

    if (matched) {
      handleVerifyStudent(matched);
    } else {
      setScannerFeedback(`❌ "${inputQuery}" কিউআর কোড বা নম্বরে কোনো শিক্ষার্থীর তথ্য পাওয়া যায়নি।`);
      setTimeout(() => setScannerFeedback(null), 3500);
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
        barcodeDetector = new (window as any).BarcodeDetector({
          formats: ['qr_code', 'code_128', 'ean_13', 'code_39', 'data_matrix'],
        });
      } catch {
        barcodeDetector = null;
      }
    }

    let lastScanTime = 0;

    const processFrame = async () => {
      if (!isRunning) return;

      const video = videoRef.current;
      const now = Date.now();

      if (
        video &&
        video.readyState >= 2 &&
        video.videoWidth > 0 &&
        video.videoHeight > 0 &&
        now - lastScanTime >= 100
      ) {
        lastScanTime = now;

        try {
          let detectedCode: string | null = null;

          // 1. Try native BarcodeDetector on Chrome Android first
          if (barcodeDetector) {
            try {
              const barcodes = await barcodeDetector.detect(video);
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                detectedCode = barcodes[0].rawValue;
              }
            } catch {
              // Fallback to jsQR
            }
          }

          // 2. Fallback to jsQR decoder
          if (!detectedCode && ctx) {
            const vw = video.videoWidth;
            const vh = video.videoHeight;
            const scale = Math.min(1, 640 / Math.max(vw, vh));
            const cw = Math.floor(vw * scale);
            const ch = Math.floor(vh * scale);

            if (canvas.width !== cw || canvas.height !== ch) {
              canvas.width = cw;
              canvas.height = ch;
            }

            ctx.drawImage(video, 0, 0, cw, ch);
            const imgData = ctx.getImageData(0, 0, cw, ch);
            const qrResult = jsQR(imgData.data, cw, ch, {
              inversionAttempts: 'attemptBoth',
            });

            if (qrResult && qrResult.data) {
              detectedCode = qrResult.data;
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

              handleBarcodeSearchSubmitRef.current(trimmed);
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
  const [guardianLoginIdentifier, setGuardianLoginIdentifier] = useState<string>('');
  const [guardianLoginPin, setGuardianLoginPin] = useState<string>('');
  const [loggedInGuardianStudent, setLoggedInGuardianStudent] = useState<Student | null>(null);
  const [guardianLoginError, setGuardianLoginError] = useState<string | null>(null);
  const [guardianLeaveNote, setGuardianLeaveNote] = useState<string>('');
  const [guardianLeaveSubmitted, setGuardianLeaveSubmitted] = useState<boolean>(false);

  // Authenticate Guardian
  const handleGuardianLogin = (identifier: string, pin: string) => {
    setGuardianLoginError(null);
    const cleanId = identifier.trim().toLowerCase();
    const cleanPin = pin.trim();

    if (!cleanId) {
      setGuardianLoginError('অনুগ্রহ করে শিক্ষার্থীর রোল অথবা অভিভাবকের মোবাইল নম্বর লিখুন।');
      return;
    }

    // Match student
    const matched = students.find((s) => {
      const matchRoll = String(s.roll) === cleanId || toBengaliNumber(s.roll) === cleanId;
      const matchPhone =
        (s.guardianPhone && s.guardianPhone.replace(/\D/g, '').includes(cleanId.replace(/\D/g, ''))) ||
        (s.fatherPhone && s.fatherPhone.replace(/\D/g, '').includes(cleanId.replace(/\D/g, ''))) ||
        (s.motherPhone && s.motherPhone.replace(/\D/g, '').includes(cleanId.replace(/\D/g, '')));
      const matchId = s.id.toLowerCase() === cleanId;
      return matchRoll || matchPhone || matchId;
    });

    if (!matched) {
      setGuardianLoginError('প্রদত্ত রোল বা মোবাইল নম্বরের কোনো শিক্ষার্থী পাওয়া যায়নি।');
      return;
    }

    // Default PIN is '1234' if none set
    const expectedPin = matched.guardianPin || '1234';
    if (cleanPin && cleanPin !== expectedPin && cleanPin !== '1234') {
      setGuardianLoginError('ভুল পিন কোড! ডিফল্ট পিন: 1234');
      return;
    }

    setLoggedInGuardianStudent(matched);
    playAlarmChime();
  };

  // Quick 1-click test login for user convenience
  const handleQuickTestGuardianLogin = (std: Student) => {
    setLoggedInGuardianStudent(std);
    setGuardianLoginIdentifier(std.guardianPhone || String(std.roll));
    setGuardianLoginPin(std.guardianPin || '1234');
    playAlarmChime();
  };

  // Filter logs strictly for logged in guardian's child
  const guardianChildLogs = useMemo(() => {
    if (!loggedInGuardianStudent) return [];
    return securityLogs.filter((log) => log.studentId === loggedInGuardianStudent.id);
  }, [securityLogs, loggedInGuardianStudent]);

  const latestChildAlarm = guardianChildLogs[0] || null;

  // =========================================================================
  // PART 3: DOUBLE-SIDED ID CARD GENERATOR STATES
  // =========================================================================
  const [idCardClassFilter, setIdCardClassFilter] = useState<string>(selectedClassId || 'all');
  const [idCardSideView, setIdCardSideView] = useState<'both' | 'front' | 'back'>('both');
  const [idCardOrientation, setIdCardOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [selectedStudentForIdCard, setSelectedStudentForIdCard] = useState<Student | null>(null);
  const [photoTargetStudentId, setPhotoTargetStudentId] = useState<string>('');

  // Print & Quick Edit States
  const printSheetsContainerRef = useRef<HTMLDivElement>(null);
  const [idCardDisplayMode, setIdCardDisplayMode] = useState<'cards' | 'sheets'>('cards');
  const [quickEditStudent, setQuickEditStudent] = useState<Student | null>(null);

  const idCardFilteredStudents = useMemo(() => {
    if (idCardClassFilter === 'all') return students;
    return students.filter((s) => s.classId === idCardClassFilter);
  }, [students, idCardClassFilter]);

  // Compute exact 4-cards-per-A4-page chunks (2x2 grid layout)
  interface IdCardPrintSlot {
    student: Student;
    side: 'front' | 'back';
    studentIndex: number;
  }

  interface IdCardPrintSheet {
    sheetIndex: number;
    slots: IdCardPrintSlot[];
  }

  const idCardPrintSheets = useMemo<IdCardPrintSheet[]>(() => {
    const sheets: IdCardPrintSheet[] = [];

    if (idCardSideView === 'both') {
      // Both sides: 2 students per A4 sheet (2 front + 2 back = 4 cards per sheet)
      for (let i = 0; i < idCardFilteredStudents.length; i += 2) {
        const slots: IdCardPrintSlot[] = [];
        const std1 = idCardFilteredStudents[i];
        if (std1) {
          slots.push({ student: std1, side: 'front', studentIndex: i });
          slots.push({ student: std1, side: 'back', studentIndex: i });
        }
        const std2 = idCardFilteredStudents[i + 1];
        if (std2) {
          slots.push({ student: std2, side: 'front', studentIndex: i + 1 });
          slots.push({ student: std2, side: 'back', studentIndex: i + 1 });
        }
        sheets.push({
          sheetIndex: sheets.length,
          slots,
        });
      }
    } else {
      // Single side (front or back): 4 students per A4 sheet
      const side = idCardSideView;
      for (let i = 0; i < idCardFilteredStudents.length; i += 4) {
        const slots: IdCardPrintSlot[] = [];
        for (let j = 0; j < 4; j++) {
          const std = idCardFilteredStudents[i + j];
          if (std) {
            slots.push({ student: std, side, studentIndex: i + j });
          }
        }
        sheets.push({
          sheetIndex: sheets.length,
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
        ? `এপিঠ ও ওপিঠ (প্রতি পাতায় ২ জন = ৪টি কার্ড, মোট ${toBengaliNumber(idCardPrintSheets.length)} পাতা)`
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
        ? `এপিঠ ও ওপিঠ (প্রতি পাতায় ২ জন = ৪টি কার্ড, মোট ${toBengaliNumber(idCardPrintSheets.length)} পাতা)`
        : idCardSideView === 'front'
        ? `১ম পৃষ্ঠা (প্রতি পাতায় ৪ জন, মোট ${toBengaliNumber(idCardPrintSheets.length)} পাতা)`
        : `২য় পৃষ্ঠা (প্রতি পাতায় ৪ জন, মোট ${toBengaliNumber(idCardPrintSheets.length)} পাতা)`;
    downloadIdCardsHtml(schoolInfo.name, classNameBn, container.innerHTML, modeDesc);
  };

  const handleSaveQuickEdit = (e: React.FormEvent) => {
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
    updateStudent(updated);
    setQuickEditStudent(null);
  };

  // Handle uploading photos directly from ID card component
  const handleIdCardPhotoUpload = async (
    studentId: string,
    role: 'student' | 'father' | 'mother',
    base64: string
  ) => {
    const target = students.find((s) => s.id === studentId);
    if (!target) return;

    const compressed = await compressImageBase64(base64, 240, 300, 0.75);

    if (role === 'student') {
      updateStudent({ ...target, avatarUrl: compressed });
    } else if (role === 'father') {
      updateStudent({ ...target, fatherAvatarUrl: compressed });
    } else if (role === 'mother') {
      updateStudent({ ...target, motherAvatarUrl: compressed });
    }
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

  // Populate sample student photos for selected class
  const handleLoadSamplePhotosForPlayClass = () => {
    const targetClassId = idCardClassFilter !== 'all' ? idCardClassFilter : 'class_play';
    const classStds = students.filter((s) => s.classId === targetClassId);

    classStds.forEach((std, idx) => {
      const isGirl = std.gender === 'ছাত্রী' || std.nameBn.includes('আক্তার') || std.nameBn.includes('বেগম') || std.nameBn.includes('খাতুন');
      const demoPhoto = createDemoStudentPhoto(idx + 1, isGirl);
      updateStudent({ ...std, avatarUrl: demoPhoto });
    });
  };

  return (
    <div
      className="space-y-6 pb-16"
      style={{ fontFamily: "'Kalpurush', 'Hind Siliguri', sans-serif" }}
    >
      {/* 1. Header Hero Banner */}
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

          {/* Part 1: Guardian Portal */}
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
            <span>পার্ট ১: অভিভাবক একাউন্ট ও এলার্ম ড্যাশবোর্ড</span>
            {latestChildAlarm && loggedInGuardianStudent && (
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
            className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'audit_logs'
                ? 'bg-slate-100 text-slate-900 font-bold'
                : 'bg-slate-900/60 hover:bg-slate-800 text-slate-400 border border-slate-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>গেটপাস লগ ({toBengaliNumber(securityLogs.length)})</span>
          </button>
        </div>
      </div>

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

                  {/* Camera Video Stream OR Mock Target Viewfinder */}
                  <div className="absolute inset-0 z-0 bg-slate-950 flex items-center justify-center overflow-hidden">
                    {isCameraActive ? (
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center p-6 space-y-3 z-10 text-slate-300">
                        <Camera className="w-12 h-12 mx-auto text-indigo-400 animate-pulse" />
                        <div className="text-xs font-bold text-white">
                          ক্যামেরা ভিউফাইন্ডার স্ট্যান্ডবাই
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          মোবাইলের ব্যাক ক্যামেরা চালু করে আইডিকার্ডের বারকোড বা কিউআর কোডের সামনে ধরুন।
                        </p>
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
                          <div className="text-[9.5px] font-mono text-emerald-300 bg-slate-950/85 px-2.5 py-1 rounded-md mt-2 tracking-wider flex items-center gap-1.5 shadow-md">
                            <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                            <span>[ কার্ডের কিউআর কোড ফোকাস করুন ]</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Camera Control Overlays at bottom */}
                  <div className="relative z-20 space-y-2 pt-2">
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

                  {/* Sound & Voice Toggles */}
                  <div className="flex items-center gap-2">
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
                  </div>
                </div>

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
                            handleBarcodeSearchSubmit(barcodeInput);
                          }
                        }}
                        placeholder="শিক্ষার্থীর রোল নম্বর, বাংলা নাম বা ১৭ ডিজিটের জন্ম নিবন্ধন নম্বর লিখুন..."
                        className="w-full text-sm pl-11 pr-4 py-2.5 border-2 border-indigo-200 rounded-xl focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 font-medium text-slate-900 bg-white placeholder-slate-400 transition"
                        autoFocus
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleBarcodeSearchSubmit(barcodeInput)}
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
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
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

                {/* Quick Simulation Barcode Buttons */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      দ্রুত স্ক্যান সিমুলেশন (শিক্ষার্থীদের ১-ক্লিক গেট স্ক্যান টেস্ট):
                    </span>
                    <span className="text-[10px] text-slate-500">মোট {toBengaliNumber(students.length)} জন শিক্ষার্থী</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {students.slice(0, 15).map((std) => (
                      <button
                        key={std.id}
                        type="button"
                        onClick={() => handleVerifyStudent(std)}
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
                        ID: {recentScannedStudent.id.slice(-6).toUpperCase()}
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

                      <div className="p-2.5 bg-indigo-50/70 rounded-lg border border-indigo-200 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-indigo-950">
                          <Phone className="w-4 h-4 text-indigo-600" />
                          <span>অভিভাবক মোবাইল: {recentScannedStudent.guardianPhone || recentScannedStudent.fatherPhone || '-'}</span>
                        </div>
                        <span className="text-emerald-700 font-bold text-[11px]">✓ লাইভ এলার্ম প্রেরিত</span>
                      </div>
                    </div>
                  </div>
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
          {!loggedInGuardianStudent ? (
            /* GUARDIAN LOGIN SCREEN */
            <div className="max-w-xl mx-auto bg-white rounded-3xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-amber-100 text-amber-800 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                  <Lock className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 font-serif">
                  অভিভাবক একাউন্ট লগইন পোর্টাল
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                  আপনার সন্তানের আইডি/রোল এবং গোপন পিন দিয়ে লগইন করুন। এখানে আপনি শুধুমাত্র আপনার সন্তানের বিদ্যালয়ে আসা-যাওয়ার লাইভ এলার্ম ও গেটপাস নোটিশ পাবেন।
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
                  handleGuardianLogin(guardianLoginIdentifier, guardianLoginPin);
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    শিক্ষার্থীর রোল নম্বর অথবা অভিভাবকের মোবাইল নম্বর *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="যেমন: ০১ অথবা ০১৭০০-xxxxxx"
                    value={guardianLoginIdentifier}
                    onChange={(e) => setGuardianLoginIdentifier(e.target.value)}
                    className="w-full text-sm p-3 border-2 border-slate-200 rounded-xl focus:border-amber-500 focus:ring-2 focus:ring-amber-100 font-medium"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">গোপন পিন কোড (Security PIN) *</label>
                    <span className="text-[11px] text-slate-400">ডিফল্ট পিন: 1234</span>
                  </div>
                  <input
                    type="password"
                    required
                    placeholder="৪ ডিজিটের পিন (ডিফল্ট: 1234)"
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
                  <span>অভিভাবক একাউন্টে প্রবেশ করুন</span>
                </button>
              </form>

              {/* 1-Click Fast Login for Testing (No typing needed!) */}
              <div className="pt-4 border-t border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                  <span>বা এক ক্লিকে যেকোনো শিক্ষার্থীর অভিভাবক হিসেবে টেস্ট করুন:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {students.slice(0, 8).map((std) => (
                    <button
                      key={std.id}
                      type="button"
                      onClick={() => handleQuickTestGuardianLogin(std)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-amber-100 border border-slate-200 hover:border-amber-300 rounded-lg text-xs font-semibold text-slate-800 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <User className="w-3.5 h-3.5 text-amber-600" />
                      <span>{std.nameBn}</span>
                      <span className="text-[10px] text-slate-500 font-mono">({toBengaliRoll(std.roll)})</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* GUARDIAN DASHBOARD VIEW */
            <div className="space-y-6">
              {/* Guardian Top Bar */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800 font-bold shrink-0">
                    <UserCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                        অভিভাবক পোর্টাল • স্বাগতম
                      </span>
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.2 rounded-full border border-emerald-300">
                        লগইন সক্রিয়
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-slate-900 font-serif">
                      {loggedInGuardianStudent.fatherNameBn || loggedInGuardianStudent.motherNameBn || 'সম্মানিত অভিভাবক'} (সন্তান: {loggedInGuardianStudent.nameBn})
                    </h2>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setLoggedInGuardianStudent(null)}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>লগআউট ও সন্তান পরিবর্তন</span>
                  </button>
                </div>
              </div>

              {/* Live Alarm / Alert Status Card for Guardian */}
              <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 rounded-3xl p-6 text-white shadow-lg border border-slate-800 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 bg-rose-500 text-white rounded-xl shadow-md animate-bounce">
                      <BellRing className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white font-serif">
                        সন্তানের রিয়েল-টাইম গেটপাস ও নিরাপত্তা এলার্ম (Live Alarm)
                      </h3>
                      <p className="text-xs text-slate-400">
                        বিদ্যালয়ের প্রধান ফটকে কার্ড স্ক্যান করলেই এখানে স্বয়ংক্রিয় এলার্ম ও ভয়েস বাজবে
                      </p>
                    </div>
                  </div>

                  <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full text-xs font-bold">
                    ● লাইভ কানেক্টেড
                  </span>
                </div>

                {latestChildAlarm ? (
                  <div className="bg-slate-800/90 rounded-2xl p-5 border-2 border-emerald-500/60 space-y-4 shadow-md">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                            latestChildAlarm.action === 'entry'
                              ? 'bg-emerald-500 text-slate-950'
                              : 'bg-amber-500 text-slate-950'
                          }`}
                        >
                          {latestChildAlarm.action === 'entry' ? '↓ বিদ্যালয়ে প্রবেশ সম্পন্ন' : '↑ বিদ্যালয় থেকে প্রস্থান সম্পন্ন'}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          সময়: {new Date(latestChildAlarm.timestamp).toLocaleTimeString('bn-BD')}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          playAlarmChime();
                          const msg = `সম্মানিত অভিভাবক, আপনার সন্তান ${loggedInGuardianStudent.nameBn}, ${latestChildAlarm.action === 'entry' ? 'নিরাপদে বিদ্যালয়ে প্রবেশ করেছে' : 'বিদ্যালয় থেকে নিরাপদে প্রস্থান করেছে'}।`;
                          speakBengali(msg);
                        }}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <Volume2 className="w-4 h-4 text-amber-300" />
                        <span>ভয়েস এলার্ম পুনরায় শুনুন</span>
                      </button>
                    </div>

                    <div className="text-sm sm:text-base font-medium text-slate-100 leading-relaxed bg-slate-900/80 p-4 rounded-xl border border-slate-700">
                      প্রিয় অভিভাবক, আপনার সন্তান <strong>{loggedInGuardianStudent.nameBn}</strong> (শ্রেণি: {classes.find((c) => c.id === loggedInGuardianStudent.classId)?.nameBn}, রোল: {toBengaliRoll(loggedInGuardianStudent.roll)}) আজ{' '}
                      <span className="text-emerald-400 font-bold font-mono">
                        {new Date(latestChildAlarm.timestamp).toLocaleTimeString('bn-BD')}
                      </span>{' '}
                      মিনিটে {latestChildAlarm.action === 'entry' ? 'নিরাপদে বিদ্যালয়ে প্রবেশ করেছে' : 'বিদ্যালয় হতে নিরাপদে প্রস্থান করেছে'}।
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-2">
                    <ShieldCheck className="w-10 h-10 mx-auto text-emerald-400" />
                    <div className="text-sm font-bold text-white">আজকের কোনো নতুন গেটপাস এলার্ম নেই</div>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      শিক্ষার্থী বিদ্যালয়ের ফটকে আইডি কার্ড স্ক্যান করলেই মুহূর্তের মধ্যে আপনার এই পোর্টালে নোটিফিকেশন ও অডিও এলার্ম পৌঁছে যাবে।
                    </p>
                  </div>
                )}

                {/* All Alarm History for Child */}
                {guardianChildLogs.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <div className="text-xs font-bold text-slate-300">
                      পূর্ববর্তী এলার্ম হিস্ট্রি ({toBengaliNumber(guardianChildLogs.length)} টি):
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                      {guardianChildLogs.map((log) => (
                        <div
                          key={log.id}
                          className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center space-x-2">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                log.action === 'entry' ? 'bg-emerald-400' : 'bg-amber-400'
                              }`}
                            />
                            <span className="font-bold text-slate-200">
                              {log.action === 'entry' ? 'বিদ্যালয়ে প্রবেশ' : 'বিদ্যালয় হতে প্রস্থান'}
                            </span>
                            <span className="text-slate-400 font-mono text-[11px]">
                              {new Date(log.timestamp).toLocaleTimeString('bn-BD')}
                            </span>
                          </div>
                          <span className="text-emerald-400 text-[11px] font-bold">✓ ডেলিভার্ড</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Child's ID Card & Family Verification Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Child ID Badge (Front) */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3 flex flex-col items-center">
                  <div className="w-full flex items-center justify-between pb-2 border-b border-slate-200">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-indigo-600" />
                      <span>সন্তানের আইডি কার্ড (এপিঠ)</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      ROLL: {toBengaliRoll(loggedInGuardianStudent.roll)}
                    </span>
                  </div>

                  <StudentIDCardSlip
                    student={loggedInGuardianStudent}
                    classNameBn={classes.find((c) => c.id === loggedInGuardianStudent.classId)?.nameBn || 'শ্রেণি'}
                    schoolInfo={schoolInfo}
                    side="front"
                    academicYear={selectedYear || '২০২৬'}
                    onPhotoUpload={handleIdCardPhotoUpload}
                  />
                </div>

                {/* Parents Identity Card (Back) */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3 flex flex-col items-center">
                  <div className="w-full flex items-center justify-between pb-2 border-b border-slate-200">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Heart className="w-4 h-4 text-rose-600" />
                      <span>পিতা-মাতার পরিচয় কার্ড (ওপিঠ)</span>
                    </span>
                    <span className="text-[10px] text-slate-500">জরুরি যোগাযোগ কার্ড</span>
                  </div>

                  <StudentIDCardSlip
                    student={loggedInGuardianStudent}
                    classNameBn={classes.find((c) => c.id === loggedInGuardianStudent.classId)?.nameBn || 'শ্রেণি'}
                    schoolInfo={schoolInfo}
                    side="back"
                    academicYear={selectedYear || '২০২৬'}
                    onPhotoUpload={handleIdCardPhotoUpload}
                  />
                </div>
              </div>

              {/* Guardian Leave / Permission Message Form */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-3">
                <h4 className="font-bold text-sm text-slate-900 font-serif flex items-center gap-1.5">
                  <Send className="w-4 h-4 text-emerald-600" />
                  <span>বিদ্যালয় কর্তৃপক্ষ বরাবর ছুটি বা জরুরি বার্তা পাঠান</span>
                </h4>
                <p className="text-xs text-slate-500">
                  সন্তানের অসুস্থতা বা অগ্রিম ছুটির আবেদন সরাসরি প্রধান শিক্ষকের কাছে জমা দিন।
                </p>

                {guardianLeaveSubmitted ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-950 text-xs font-bold flex items-center justify-between">
                    <span>✓ আপনার বার্তাটি প্রধান শিক্ষকের ডেস্কে সফলভাবে পাঠানো হয়েছে!</span>
                    <button
                      type="button"
                      onClick={() => setGuardianLeaveSubmitted(false)}
                      className="text-emerald-800 underline text-[11px]"
                    >
                      নতুন বার্তা
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <textarea
                      rows={2}
                      value={guardianLeaveNote}
                      onChange={(e) => setGuardianLeaveNote(e.target.value)}
                      placeholder="ছুটির কারণ বা জরুরি বার্তা লিখুন..."
                      className="w-full text-sm border border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!guardianLeaveNote.trim()) return;
                        setGuardianLeaveSubmitted(true);
                        setGuardianLeaveNote('');
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>প্রধান শিক্ষককে বার্তা প্রেরণ করুন</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
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
                    onClick={handleLoadSamplePhotosForPlayClass}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-lg transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    title="প্লে শ্রেণির সকল শিক্ষার্থীর জন্য পাসপোর্ট সাইজ ডেমো ছবি সেট করুন"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>প্লে শ্রেণির ডেমো পাসপোর্ট ছবি লোড করুন</span>
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
                          handleIdCardPhotoUpload(targetId, 'student', base64);
                        }
                      };
                      reader.readAsDataURL(file);
                      e.target.value = '';
                    }}
                  />
                </label>

                <span className="text-[11px] text-slate-500">
                  (অথবা নিচের প্রতিটি কার্ডের ছবির উপরে সরাসরি ক্লিক করেও ছবি বদলানো যাবে)
                </span>
              </div>
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

                    {/* 2x2 Grid of 4 Cards */}
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
                    <div className="flex flex-wrap items-center justify-center gap-4 flex-1">
                      {/* Front Side */}
                      {(idCardSideView === 'both' || idCardSideView === 'front') && (
                        <div className="flex flex-col items-center">
                          <span className="no-print text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            ১ম পৃষ্ঠা • এপিঠ (FRONT)
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
                      )}

                      {/* Back Side */}
                      {(idCardSideView === 'both' || idCardSideView === 'back') && (
                        <div className="flex flex-col items-center">
                          <span className="no-print text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            ২য় পৃষ্ঠা • ওপিঠ (BACK)
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
                      )}
                    </div>
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
              <div
                key={`print-sheet-${sheet.sheetIndex}`}
                className="id-card-a4-sheet"
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
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PART 4: AUDIT LOGS & GATEPASS HISTORY VIEW                                */}
      {/* ========================================================================= */}
      {activeTab === 'audit_logs' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden space-y-3">
          <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70">
            <div className="flex items-center space-x-2">
              <History className="w-5 h-5 text-indigo-600" />
              <div>
                <h3 className="font-bold text-base text-slate-900 font-serif">
                  গেটপাস অডিট ও অ্যাক্সেস লগ (Gatepass Access Log)
                </h3>
                <p className="text-xs text-slate-500">
                  সকল শিক্ষার্থী প্রবেশ ও প্রস্থানের সময়, অভিভাবক নোটিফিকেশন ও ভেরিফিকেশন রেকর্ড
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
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
                  <th className="py-2.5 px-3 text-center w-28">মুভমেন্ট</th>
                  <th className="py-2.5 px-3">অভিভাবক ফোন</th>
                  <th className="py-2.5 px-3 text-center w-24">ভয়েস ঘোষণা</th>
                  <th className="py-2.5 px-3 text-center w-24">মেসেজ স্ট্যাটাস</th>
                  <th className="py-2.5 px-3 text-center w-20">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {securityLogs.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
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
                        <td className="py-2.5 px-3 text-center">
                          {log.voiceDispatched ? (
                            <span className="text-indigo-600 font-bold text-[11px]">✓ ঘোষিত</span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">নিষ্ক্রিয়</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {log.smsDispatched ? (
                            <span className="text-emerald-600 font-bold text-[11px]">✓ প্রেরিত</span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">নিষ্ক্রিয়</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              const replayMsg = `শিক্ষার্থী ${log.studentNameBn}, ${log.classNameBn}, রোল নম্বর ${toBengaliNumber(log.studentRoll)}, ${log.action === 'entry' ? 'নিরাপদে বিদ্যালয়ে প্রবেশ করেছে' : 'বিদ্যালয় থেকে সফলভাবে প্রস্থান করেছে'}।`;
                              speakBengali(replayMsg);
                            }}
                            className="p-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition"
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
    </div>
  );
};
