import React, { useEffect, useState } from 'react';
import { SchoolProvider, useSchool } from './context/SchoolContext';
import { Navbar } from './components/Navbar';
import { PortalHomeView } from './components/PortalHomeView';
import { DashboardView } from './components/DashboardView';
import { EmployeeDashboardView } from './components/EmployeeDashboardView';
import { CategoryStaffDashboardView } from './components/CategoryStaffDashboardView';
import { StaffManagementView } from './components/StaffManagementView';
import { MarkEntryView } from './components/MarkEntryView';
import { ResultsView } from './components/ResultsView';
import { TabulationSheet } from './components/TabulationSheet';
import { StudentManagement } from './components/StudentManagement';
import { BulkStudentRegistration } from './components/BulkStudentRegistration';
import { SubjectManagementView } from './components/SubjectManagementView';
import { SyllabusView } from './components/SyllabusView';
import { QuestionPaperGenerator } from './components/QuestionPaperGenerator';
import { NotesView } from './components/NotesView';
import { SMSNotificationView } from './components/SMSNotificationView';
import { AttendanceView } from './components/AttendanceView';
import { AcademicCalendarView } from './components/AcademicCalendarView';
import { StudentFeesView } from './components/StudentFeesView';
import { DailyFeeReportView } from './components/DailyFeeReportView';
import { DefaulterListView } from './components/DefaulterListView';
import { BackupSettingsModal } from './components/BackupSettingsModal';
import { StandaloneVoucherPrintView } from './components/StandaloneVoucherPrintView';
import { SeatPlanView } from './components/SeatPlanView';
import { AdmitCardView } from './components/AdmitCardView';
import { DigitalSecurityGatepassView } from './components/DigitalSecurityGatepassView';
import { DigitalLibraryView } from './components/DigitalLibraryView';
import { PortalAuthSession, Student } from './types';
import { getStudentPortalId } from './utils/bengali';
import {
  clearExplicitUnlockFlag,
  getLockedDeviceSnapshotSync,
  getLockedStudentIdSync,
  loadLockedDeviceFromStorage,
  lockDeviceToSession,
  lockDeviceToStudent,
  unlockDeviceFromAccount,
} from './utils/deviceLock';
import {
  applyStudentPassportAppIcon,
  resetStudentAppIcon,
} from './utils/studentAppIcon';
import { getLocalStaffAccounts, safeFetchJson } from './utils/portalAuthFallback';
import { isOfficialAuthorizerAccount, resolveStaffCategoryKey } from './utils/staffDesignations';
import { useGatepassRealtime } from './hooks/useGatepassRealtime';
import {
  playAlarmChime,
  replayPendingBlockedSpeech,
  setGuardianLiveWatchActive,
  speakRepeatedGuardianAlert,
  stopBengaliSpeech,
  subscribePendingBlockedSpeech,
  subscribeSpeechPlayback,
  unlockMobileAudioAndSpeech,
} from './utils/gatepassAudio';
import { BellRing, Volume2, VolumeX, X } from 'lucide-react';

const SESSION_STORAGE_KEY = 'dlikon_portal_auth_session_v1';

function MainContent() {
  const urlParams = new URLSearchParams(window.location.search);
  const isStandalonePrint = urlParams.get('mode') === 'print_vouchers';

  if (isStandalonePrint) {
    return <StandaloneVoucherPrintView />;
  }

  const { schoolInfo, students, classes, staffAccounts } = useSchool();
  const alwaysLockDevices = schoolInfo.alwaysLockDevices !== false;
  const urlGuardianParam = urlParams.get('guardian') || '';
  const isSavedGuardianMode =
    typeof window !== 'undefined' &&
    localStorage.getItem('dlikon_pwa_guardian_mode') === 'true' &&
    Boolean(localStorage.getItem('dlikon_guardian_paired_student_id'));

  const [isDeviceLocked, setIsDeviceLocked] = useState<boolean>(() =>
    Boolean(getLockedDeviceSnapshotSync() || getLockedStudentIdSync())
  );

  const [preferStudentPortalOnLogin, setPreferStudentPortalOnLogin] = useState<boolean>(() =>
    Boolean(urlGuardianParam)
  );

  const [authSession, setAuthSession] = useState<PortalAuthSession | null>(() => {
    if (typeof window === 'undefined') return null;
    const lockedSnap = getLockedDeviceSnapshotSync();
    if (lockedSnap?.session) {
      return lockedSnap.session;
    }
    try {
      const saved = localStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // Ignore corrupt session
    }
    return null;
  });

  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  const signedInStudentObj =
    authSession?.role === 'student'
      ? students.find(
          (s) =>
            s.id === authSession.accountId ||
            (authSession.staffCode && getStudentPortalId(s).toUpperCase() === authSession.staffCode.toUpperCase())
        )
      : undefined;

  const {
    liveRingingAlert,
    dismissLiveRingingAlert,
    connectionTransport,
    syncHealth,
    forceCheckNow,
    diagnostics,
    sendDiagnosticPing,
    reconnectRealtime,
    clearDiagnosticLogs,
  } = useGatepassRealtime({
    role: authSession?.role,
    studentId: authSession?.role === 'student' ? authSession.accountId : null,
    portalId: authSession?.role === 'student' ? authSession.staffCode : null,
    classId: signedInStudentObj?.classId || null,
    roll: signedInStudentObj?.roll || null,
    enabled: Boolean(authSession),
  });

  const [pendingBlockedAlert, setPendingBlockedAlert] = useState<{
    message: string;
    logId: string;
    studentNameBn?: string;
    action?: 'entry' | 'exit';
  } | null>(null);
  const [isVoiceActivelyPlaying, setIsVoiceActivelyPlaying] = useState<boolean>(false);

  useEffect(() => {
    const unsubBlocked = subscribePendingBlockedSpeech(setPendingBlockedAlert);
    const unsubSpeech = subscribeSpeechPlayback(setIsVoiceActivelyPlaying);
    return () => {
      unsubBlocked();
      unsubSpeech();
    };
  }, []);

  // Permanent multi-role device lock restore from IndexedDB / localStorage
  useEffect(() => {
    let active = true;
    loadLockedDeviceFromStorage().then((snap) => {
      if (!active || !snap) return;
      setIsDeviceLocked(true);
      setAuthSession((prev) => {
        if (prev && prev.role === snap.role && prev.accountId === snap.accountId) {
          return {
            ...prev,
            lockVersion: typeof prev.lockVersion === 'number' ? prev.lockVersion : snap.lockVersion,
          };
        }
        return snap.session;
      });
    });
    return () => {
      active = false;
    };
  }, []);

  // Seamless support for ?guardian=... direct pairing links, locked device IDs, or saved Guardian PWA smartphone sessions
  useEffect(() => {
    if (students.length === 0) return;
    const lockedSnap = getLockedDeviceSnapshotSync();
    const lockedId = getLockedStudentIdSync();

    // If device is already locked to another role or another student, never let ?guardian=... overwrite it
    if (lockedSnap && (lockedSnap.role !== 'student' || (urlGuardianParam && lockedSnap.accountId !== urlGuardianParam))) {
      return;
    }
    if (authSession && !lockedId && !urlGuardianParam) return;

    const savedPairedId =
      typeof window !== 'undefined' ? localStorage.getItem('dlikon_guardian_paired_student_id') : null;
    const targetId = lockedId || urlGuardianParam || (isSavedGuardianMode ? savedPairedId : '');
    if (targetId) {
      const matched = students.find(
        (s) =>
          s.id === targetId ||
          (s.securityQrCode && s.securityQrCode.toLowerCase() === targetId.toLowerCase())
      );
      if (matched) {
        const clsName = classes.find((c) => c.id === matched.classId)?.nameBn || matched.classId;
        const matchedLockVersion = typeof matched.unlockEpoch === 'number' ? matched.unlockEpoch : 0;
        const autoSession: PortalAuthSession = {
          role: 'student',
          accountId: matched.id,
          displayName: matched.nameBn,
          subLabel: `${clsName} • রোল ${matched.roll}`,
          staffCode: getStudentPortalId(matched),
          lockVersion: matchedLockVersion,
        };
        if (urlGuardianParam) {
          clearExplicitUnlockFlag();
        }
        if (
          !authSession ||
          authSession.role !== 'student' ||
          authSession.accountId !== matched.id ||
          authSession.displayName !== matched.nameBn
        ) {
          setAuthSession(autoSession);
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(autoSession));
          setCurrentTab('dashboard');
        }
        if (lockedId || (urlGuardianParam && alwaysLockDevices)) {
          setIsDeviceLocked(true);
          document.title = `${matched.nameBn} · ডি-লিকন ড্যাশবোর্ড`;
          if (!lockedId && urlGuardianParam && alwaysLockDevices) {
            void lockDeviceToStudent(matched, getStudentPortalId(matched), clsName);
          }
        }
      }
    }
    if (authSession?.role === 'student' && students.length > 0) {
      const matched = students.find((s) => s.id === authSession.accountId);
      if (matched) {
        void applyStudentPassportAppIcon(matched);
      }
    }
  }, [authSession, students, classes, urlGuardianParam, isSavedGuardianMode, alwaysLockDevices]);

  const handleUnlockDeviceNow = async () => {
    const prevRole = authSession?.role;
    setGuardianLiveWatchActive(false);
    await unlockDeviceFromAccount();
    resetStudentAppIcon();
    setIsDeviceLocked(false);
    setAuthSession(null);
    setPreferStudentPortalOnLogin(prevRole === 'student');
    setCurrentTab('dashboard');
    setIsSettingsOpen(false);
  };

  // Remote & global auto-unlock monitor:
  // 1) Reactive check from SchoolContext (global alwaysLockDevices === false OR remote unlockEpoch > local lockVersion)
  useEffect(() => {
    if (!isDeviceLocked || !authSession) return;
    if (authSession.role !== 'student' && authSession.role !== 'employee') return;

    if (!alwaysLockDevices) {
      void handleUnlockDeviceNow();
      return;
    }

    const localVersion = typeof authSession.lockVersion === 'number' ? authSession.lockVersion : 0;
    if (authSession.role === 'student') {
      const matchedStd = students.find((s) => s.id === authSession.accountId);
      if (matchedStd && typeof matchedStd.unlockEpoch === 'number' && matchedStd.unlockEpoch > localVersion) {
        void handleUnlockDeviceNow();
      }
    } else if (authSession.role === 'employee') {
      const matchedStaff = staffAccounts.find((a) => a.id === authSession.accountId);
      if (matchedStaff && typeof matchedStaff.unlockEpoch === 'number' && matchedStaff.unlockEpoch > localVersion) {
        void handleUnlockDeviceNow();
      }
    }
  }, [isDeviceLocked, authSession, alwaysLockDevices, students, staffAccounts]);

  // 2) Lightweight server poll every 20s + window focus/visibility check for instant remote unlock from Principal dashboard
  useEffect(() => {
    if (!isDeviceLocked || !authSession) return;
    if (authSession.role !== 'student' && authSession.role !== 'employee') return;

    let cancelled = false;
    const localVersion = typeof authSession.lockVersion === 'number' ? authSession.lockVersion : 0;

    const checkLockStatus = async () => {
      if (cancelled) return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      const res = await safeFetchJson(
        `/api/auth/device-lock-status?role=${encodeURIComponent(authSession.role)}&accountId=${encodeURIComponent(authSession.accountId)}`
      );
      if (cancelled || !res.reachable || !res.ok || !res.data?.success) return;
      if (res.data.alwaysLockDevices === false || Number(res.data.unlockEpoch || 0) > localVersion) {
        await handleUnlockDeviceNow();
      }
    };

    void checkLockStatus();
    const timer = setInterval(() => {
      void checkLockStatus();
    }, 20000);

    const onFocusOrVisible = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        void checkLockStatus();
      }
    };
    window.addEventListener('focus', onFocusOrVisible);
    document.addEventListener('visibilitychange', onFocusOrVisible);

    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener('focus', onFocusOrVisible);
      document.removeEventListener('visibilitychange', onFocusOrVisible);
    };
  }, [isDeviceLocked, authSession?.role, authSession?.accountId, authSession?.lockVersion]);

  const handleLoginSuccess = (session: PortalAuthSession, matchedStudent?: Student | null) => {
    clearExplicitUnlockFlag();
    const matchedStaff =
      session.role !== 'student' ? staffAccounts.find((a) => a.id === session.accountId) : undefined;
    const resolvedLockVersion =
      typeof session.lockVersion === 'number'
        ? session.lockVersion
        : session.role === 'student'
        ? matchedStudent?.unlockEpoch ?? 0
        : matchedStaff?.unlockEpoch ?? 0;

    const sessionWithVersion: PortalAuthSession = {
      ...session,
      lockVersion: resolvedLockVersion,
    };

    setAuthSession(sessionWithVersion);
    setCurrentTab('dashboard');
    if (typeof window !== 'undefined') {
      if (window.location.search.includes('guardian=') || window.location.search.includes('locked=') || window.location.search.includes('unlock=')) {
        window.history.replaceState({}, '', window.location.pathname);
      }
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionWithVersion));
      if (session.role === 'student' && matchedStudent) {
        localStorage.setItem('dlikon_guardian_paired_student_id', matchedStudent.id);
        localStorage.setItem('dlikon_pwa_guardian_mode', 'true');
        void applyStudentPassportAppIcon(matchedStudent);
      } else {
        localStorage.removeItem('dlikon_guardian_paired_student_id');
        localStorage.removeItem('dlikon_pwa_guardian_mode');
        resetStudentAppIcon();
      }
    }

    // Automatically lock smartphone for Student & Employee logins when global Always-Lock policy is active
    if ((sessionWithVersion.role === 'student' || sessionWithVersion.role === 'employee') && alwaysLockDevices) {
      setIsDeviceLocked(true);
      void lockDeviceToSession(sessionWithVersion, {
        student: matchedStudent || null,
        lockVersion: resolvedLockVersion,
      }).then((lockedSession) => {
        setAuthSession(lockedSession);
      });
    }
  };

  const handleInstallLockedDashboard = async (student: Student) => {
    const clsName = classes.find((c) => c.id === student.classId)?.nameBn || student.classId;
    const lockedSession = await lockDeviceToStudent(student, getStudentPortalId(student), clsName);
    await applyStudentPassportAppIcon(student);
    setIsDeviceLocked(true);
    setAuthSession(lockedSession);
    setCurrentTab('dashboard');
  };

  const handleAdminUnlockDevice = async (adminPin: string): Promise<boolean> => {
    const cleanPin = adminPin.trim();
    if (!cleanPin) return false;

    const serverCheck = await safeFetchJson('/api/auth/verify-office-unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: cleanPin }),
    });

    let isValidOfficial = false;
    if (serverCheck.reachable) {
      isValidOfficial = Boolean(serverCheck.ok && serverCheck.data?.success);
    } else {
      const candidateAccounts = staffAccounts.length > 0 ? staffAccounts : getLocalStaffAccounts();
      isValidOfficial = candidateAccounts.some(
        (acc) =>
          acc.role === 'official' &&
          acc.status !== 'pending' &&
          isOfficialAuthorizerAccount(acc) &&
          String(acc.password || '').trim() === cleanPin
      );
    }

    if (!isValidOfficial) return false;
    await handleUnlockDeviceNow();
    return true;
  };

  const handleLogout = () => {
    if (isDeviceLocked) return;
    setGuardianLiveWatchActive(false);
    resetStudentAppIcon();
    setAuthSession(null);
    setCurrentTab('dashboard');
    setIsSettingsOpen(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      localStorage.removeItem('dlikon_guardian_paired_student_id');
      localStorage.removeItem('dlikon_pwa_guardian_mode');
      if (window.location.search.includes('guardian=') || window.location.search.includes('tab=')) {
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  };

  // PUBLIC GATEWAY: Clean aesthetic Home Page with 3 Portal Sign-In & Sign-Up options
  if (!authSession) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F7F6F2]">
        <PortalHomeView
          onLoginSuccess={handleLoginSuccess}
          initialPortal={preferStudentPortalOnLogin ? 'student' : 'official'}
        />
        <footer className="no-print bg-white border-t border-stone-200 py-6 text-center text-xs text-stone-500">
          <div className="max-w-7xl mx-auto px-4 space-y-1">
            <p className="font-bold text-[#0F1E3D] font-serif">
              {schoolInfo.name || 'ডি-লিকন মডেল একাডেমী'}
            </p>
            <p>{schoolInfo.address} | হটলাইন: {schoolInfo.phone}</p>
            <p className="text-[11px] text-stone-400 pt-1">
              সুরক্ষিত একাডেমিক, অফিসিয়াল ও অভিভাবক পোর্টাল · ডেস্কটপ ও স্মার্টফোন কম্প্যাটিবল
            </p>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-800">
      {/* Role-Scoped Navbar */}
      <Navbar
        session={authSession}
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onLogout={handleLogout}
        isDeviceLocked={isDeviceLocked}
        alwaysLockDevices={alwaysLockDevices}
        onAdminUnlockDevice={handleAdminUnlockDevice}
      />

      {/* Strictly Role-Isolated Workspace Views */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 lg:p-8">
        {/* ================= 1. STUDENT & GUARDIAN WORKSPACE ================= */}
        {authSession.role === 'student' && (
          <>
            {(liveRingingAlert || pendingBlockedAlert) && currentTab !== 'dashboard' && (
              <div className="mb-4 bg-slate-900 text-white rounded-2xl p-4 border-2 border-amber-400 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-sm font-bold text-amber-300 flex items-center gap-2">
                    <BellRing className="w-4 h-4 shrink-0" />
                    <span>লাইভ স্কুল গেটপাস নোটিফিকেশন</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-100 leading-relaxed">
                    {(pendingBlockedAlert || liveRingingAlert)?.message}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {isVoiceActivelyPlaying && (
                    <button
                      type="button"
                      onClick={() => {
                        stopBengaliSpeech();
                        dismissLiveRingingAlert();
                      }}
                      className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                    >
                      <VolumeX className="w-4 h-4" />
                      <span>ভয়েস থামান ✓</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (pendingBlockedAlert) {
                        replayPendingBlockedSpeech();
                      } else if (liveRingingAlert) {
                        unlockMobileAudioAndSpeech(true);
                        const matchedStd =
                          students.find((s) => s.id === authSession.accountId) ||
                          ({
                            id: authSession.accountId,
                            nameBn:
                              liveRingingAlert.log.studentNameBn || authSession.displayName,
                          } as Student);
                        speakRepeatedGuardianAlert(
                          matchedStd,
                          liveRingingAlert.log.action === 'exit' ? 'exit' : 'entry',
                          schoolInfo.dailySchedule,
                          { repeatCount: 6, delayMs: 0 }
                        );
                      }
                    }}
                    className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>ভয়েস শুনুন (নাম ধরে)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      stopBengaliSpeech();
                      dismissLiveRingingAlert();
                    }}
                    aria-label="বন্ধ করুন"
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
            {currentTab === 'calendar' ? (
              <AcademicCalendarView />
            ) : currentTab === 'digital_library' ? (
              <DigitalLibraryView
                mode="student"
                defaultClassId={students.find((s) => s.id === authSession.accountId)?.classId}
              />
            ) : (
              <DigitalSecurityGatepassView
                initialTab="guardian_portal"
                restrictedMode="student_only"
                forcedStudentId={authSession.accountId}
                externalLiveRingingAlert={liveRingingAlert}
                onDismissExternalRingingAlert={dismissLiveRingingAlert}
                realtimeTransport={connectionTransport}
                realtimeSyncHealth={syncHealth}
                onForceCheckRealtime={forceCheckNow}
                realtimeDiagnostics={diagnostics}
                onSendDiagnosticPing={sendDiagnosticPing}
                onReconnectRealtime={reconnectRealtime}
                onClearDiagnosticLogs={clearDiagnosticLogs}
                onRoleLogout={handleLogout}
                isDeviceLocked={isDeviceLocked}
                onInstallLockedDashboard={handleInstallLockedDashboard}
                onAdminUnlockDevice={handleAdminUnlockDevice}
              />
            )}
          </>
        )}

        {/* ================= 2. EMPLOYEE / TEACHER WORKSPACE ================= */}
        {authSession.role === 'employee' && (
          <>
            {currentTab === 'dashboard' && (
              <EmployeeDashboardView
                session={authSession}
                onNavigate={(tab) => setCurrentTab(tab)}
              />
            )}
            {currentTab === 'attendance' && (
              <AttendanceView onNavigateToResults={() => setCurrentTab('marks_entry')} />
            )}
            {currentTab === 'marks_entry' && (
              <MarkEntryView onNavigate={(tab) => setCurrentTab(tab)} />
            )}
            {currentTab === 'employee_scanner' && (
              <DigitalSecurityGatepassView
                initialTab="barcode_scanner"
                restrictedMode="employee_scanner"
              />
            )}
            {resolveStaffCategoryKey(
              {
                categoryKey: authSession.categoryKey,
                designationBn: authSession.designationBn || authSession.subLabel,
                role: 'employee',
              },
              authSession.designationBn || authSession.subLabel
            ) === 'accountant_clerk' && (
              <>
                {currentTab === 'fees' && (
                  <StudentFeesView onNavigateToTab={(tab) => setCurrentTab(tab)} />
                )}
                {currentTab === 'daily_report' && (
                  <DailyFeeReportView onNavigate={(tab) => setCurrentTab(tab)} />
                )}
                {currentTab === 'defaulters' && (
                  <DefaulterListView
                    onNavigate={(tab) => setCurrentTab(tab)}
                    onOpenStudentHistory={() => setCurrentTab('fees')}
                  />
                )}
              </>
            )}
            {currentTab === 'syllabus' && <SyllabusView />}
            {currentTab === 'question_papers' && <QuestionPaperGenerator />}
            {currentTab === 'notes' && <NotesView />}
            {currentTab === 'digital_library' && (
              <DigitalLibraryView
                mode="manage"
                uploaderName={authSession.displayName}
                uploaderRole="employee"
              />
            )}
            {currentTab === 'calendar' && <AcademicCalendarView />}
          </>
        )}

        {/* ================= 3. OFFICIAL EXECUTIVE WORKSPACE ================= */}
        {authSession.role === 'official' && (
          <>
            {currentTab === 'dashboard' && (
              <DashboardView
                onNavigate={(tab) => setCurrentTab(tab)}
                onOpenSettings={() => setIsSettingsOpen(true)}
                reviewerNameBn={
                  authSession.displayName
                    ? `${authSession.displayName}${
                        authSession.designationBn ? ` (${authSession.designationBn})` : ''
                      }`
                    : 'প্রিন্সিপাল'
                }
              />
            )}
            {currentTab === 'my_dashboard' && (
              <CategoryStaffDashboardView
                session={authSession}
                onNavigate={(tab) => setCurrentTab(tab)}
              />
            )}
            {currentTab === 'staff_management' && <StaffManagementView />}
            {currentTab === 'subjects' && (
              <SubjectManagementView onNavigate={(tab) => setCurrentTab(tab)} />
            )}
            {currentTab === 'marks_entry' && (
              <MarkEntryView onNavigate={(tab) => setCurrentTab(tab)} />
            )}
            {currentTab === 'results' && <ResultsView />}
            {currentTab === 'admit_card' && <AdmitCardView />}
            {currentTab === 'seat_plan' && <SeatPlanView />}
            {currentTab === 'digital_security' && <DigitalSecurityGatepassView />}
            {currentTab === 'student_portal' && (
              <DigitalSecurityGatepassView initialTab="guardian_portal" />
            )}
            {currentTab === 'tabulation' && (
              <TabulationSheet onNavigate={(tab) => setCurrentTab(tab)} />
            )}
            {currentTab === 'fees' && (
              <StudentFeesView onNavigateToTab={(tab) => setCurrentTab(tab)} />
            )}
            {currentTab === 'daily_report' && (
              <DailyFeeReportView onNavigate={(tab) => setCurrentTab(tab)} />
            )}
            {currentTab === 'defaulters' && (
              <DefaulterListView
                onNavigate={(tab) => setCurrentTab(tab)}
                onOpenStudentHistory={() => setCurrentTab('fees')}
              />
            )}
            {currentTab === 'attendance' && (
              <AttendanceView onNavigateToResults={() => setCurrentTab('results')} />
            )}
            {currentTab === 'calendar' && <AcademicCalendarView />}
            {currentTab === 'sms' && <SMSNotificationView />}
            {currentTab === 'students' && <StudentManagement />}
            {currentTab === 'bulk_upload' && (
              <BulkStudentRegistration onSuccessNavigate={() => setCurrentTab('students')} />
            )}
            {currentTab === 'syllabus' && <SyllabusView />}
            {currentTab === 'question_papers' && <QuestionPaperGenerator />}
            {currentTab === 'notes' && <NotesView />}
            {currentTab === 'digital_library' && (
              <DigitalLibraryView
                mode="manage"
                uploaderName={authSession.displayName}
                uploaderRole="official"
              />
            )}
          </>
        )}
      </main>

      {/* Settings & Backup Modal (Official Admin Only) */}
      {authSession.role === 'official' && (
        <BackupSettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {/* Responsive Footer */}
      <footer className="no-print bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 space-y-1">
          <p className="font-bold text-slate-700 font-serif">
            {schoolInfo.name || 'ডি-লিকন মডেল একাডেমী'}
          </p>
          <p>{schoolInfo.address} | হটলাইন: {schoolInfo.phone}</p>
          <p className="text-[11px] text-slate-400 pt-1">
            ডিজিটাল রেজাল্ট প্রসেসিং ও স্কুল ম্যানেজমেন্ট সিস্টেম • ডেস্কটপ ও স্মার্টফোন কম্প্যাটিবল
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <SchoolProvider>
      <MainContent />
    </SchoolProvider>
  );
}
