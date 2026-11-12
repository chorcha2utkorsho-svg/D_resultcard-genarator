import React, { useEffect, useState } from 'react';
import { SchoolProvider, useSchool } from './context/SchoolContext';
import { Navbar } from './components/Navbar';
import { PortalHomeView } from './components/PortalHomeView';
import { DashboardView } from './components/DashboardView';
import { EmployeeDashboardView } from './components/EmployeeDashboardView';
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
import { PortalAuthSession, Student } from './types';
import { getStudentPortalId } from './utils/bengali';

const SESSION_STORAGE_KEY = 'dlikon_portal_auth_session_v1';

function MainContent() {
  const urlParams = new URLSearchParams(window.location.search);
  const isStandalonePrint = urlParams.get('mode') === 'print_vouchers';

  if (isStandalonePrint) {
    return <StandaloneVoucherPrintView />;
  }

  const { schoolInfo, students, classes } = useSchool();
  const urlGuardianParam = urlParams.get('guardian') || '';
  const isSavedGuardianMode =
    typeof window !== 'undefined' &&
    localStorage.getItem('dlikon_pwa_guardian_mode') === 'true' &&
    Boolean(localStorage.getItem('dlikon_guardian_paired_student_id'));

  const [authSession, setAuthSession] = useState<PortalAuthSession | null>(() => {
    if (typeof window === 'undefined') return null;
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

  // Seamless support for ?guardian=... direct pairing links or saved Guardian PWA smartphone sessions
  useEffect(() => {
    if (authSession || students.length === 0) return;
    const savedPairedId =
      typeof window !== 'undefined' ? localStorage.getItem('dlikon_guardian_paired_student_id') : null;
    const targetId = urlGuardianParam || (isSavedGuardianMode ? savedPairedId : '');
    if (targetId) {
      const matched = students.find(
        (s) =>
          s.id === targetId ||
          (s.securityQrCode && s.securityQrCode.toLowerCase() === targetId.toLowerCase())
      );
      if (matched) {
        const clsName = classes.find((c) => c.id === matched.classId)?.nameBn || matched.classId;
        const autoSession: PortalAuthSession = {
          role: 'student',
          accountId: matched.id,
          displayName: matched.nameBn,
          subLabel: `${clsName} • রোল ${matched.roll}`,
          staffCode: getStudentPortalId(matched),
        };
        setAuthSession(autoSession);
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(autoSession));
        setCurrentTab('dashboard');
      }
    }
  }, [authSession, students, classes, urlGuardianParam, isSavedGuardianMode]);

  const handleLoginSuccess = (session: PortalAuthSession, matchedStudent?: Student | null) => {
    setAuthSession(session);
    setCurrentTab('dashboard');
    if (typeof window !== 'undefined') {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      if (session.role === 'student' && matchedStudent) {
        localStorage.setItem('dlikon_guardian_paired_student_id', matchedStudent.id);
        localStorage.setItem('dlikon_pwa_guardian_mode', 'true');
      }
    }
  };

  const handleLogout = () => {
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
          initialPortal={urlGuardianParam ? 'student' : 'official'}
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
      />

      {/* Strictly Role-Isolated Workspace Views */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 lg:p-8">
        {/* ================= 1. STUDENT & GUARDIAN WORKSPACE ================= */}
        {authSession.role === 'student' && (
          <>
            {currentTab === 'calendar' ? (
              <AcademicCalendarView />
            ) : (
              <DigitalSecurityGatepassView
                initialTab="guardian_portal"
                restrictedMode="student_only"
                forcedStudentId={authSession.accountId}
                onRoleLogout={handleLogout}
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
            {currentTab === 'syllabus' && <SyllabusView />}
            {currentTab === 'question_papers' && <QuestionPaperGenerator />}
            {currentTab === 'notes' && <NotesView />}
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
