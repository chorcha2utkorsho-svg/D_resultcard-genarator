import React, { useRef, useState } from 'react';
import {
  GraduationCap,
  FileCheck2,
  TableProperties,
  User,
  Users,
  BookOpen,
  FileText,
  HelpCircle,
  Settings,
  Menu,
  X,
  Printer,
  Download,
  ShieldCheck,
  MessageSquare,
  CalendarCheck,
  CalendarDays,
  FileSpreadsheet,
  BookMarked,
  CreditCard,
  Receipt,
  ShieldAlert,
  LayoutGrid,
  FileBadge,
  RefreshCw,
  LogOut,
  Briefcase,
  QrCode,
  Cloud,
  CloudOff,
  Lock,
  Library,
  Timer,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { PortalAuthSession } from '../types';
import { SchoolLogo } from './SchoolLogo';
import { PWAInstallButton } from './PWAInstallButton';
import { resolveStaffCategoryKey } from '../utils/staffDesignations';

interface NavbarProps {
  session: PortalAuthSession;
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  isDeviceLocked?: boolean;
  alwaysLockDevices?: boolean;
  onAdminUnlockDevice?: (adminPin: string) => Promise<boolean>;
}

export const Navbar: React.FC<NavbarProps> = ({
  session,
  currentTab,
  setCurrentTab,
  onOpenSettings,
  onLogout,
  isDeviceLocked = false,
  alwaysLockDevices = true,
  onAdminUnlockDevice,
}) => {
  const {
    schoolInfo,
    exportDatabaseBackup,
    isServerSyncing,
    serverSyncStatus,
    forceServerSync,
    cloudUser,
    cloudSyncError,
    cloudUnauthorizedDomain,
    connectCloudSync,
    disconnectCloudSync,
  } = useSchool();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [showOfficeUnlockModal, setShowOfficeUnlockModal] = useState(false);
  const [officeUnlockPin, setOfficeUnlockPin] = useState('');
  const [officeUnlockError, setOfficeUnlockError] = useState<string | null>(null);
  const [isVerifyingUnlock, setIsVerifyingUnlock] = useState(false);
  const tapStateRef = useRef<{ count: number; timer: ReturnType<typeof setTimeout> | null }>({
    count: 0,
    timer: null,
  });

  const handleLockedIndicatorTap = () => {
    if (!onAdminUnlockDevice) return;
    if (tapStateRef.current.timer) {
      clearTimeout(tapStateRef.current.timer);
    }
    tapStateRef.current.count += 1;
    if (tapStateRef.current.count >= 5) {
      tapStateRef.current.count = 0;
      tapStateRef.current.timer = null;
      setOfficeUnlockPin('');
      setOfficeUnlockError(null);
      setShowOfficeUnlockModal(true);
      return;
    }
    tapStateRef.current.timer = setTimeout(() => {
      tapStateRef.current.count = 0;
      tapStateRef.current.timer = null;
    }, 3000);
  };

  const officialNavItems = [
    { id: 'dashboard', label: 'অফিসিয়াল ড্যাশবোর্ড', icon: GraduationCap },
    { id: 'my_dashboard', label: 'আমার ড্যাশবোর্ড ও বেতন', icon: Timer },
    { id: 'daily_report', label: 'দৈনিক আদায় রিপোর্ট', icon: Receipt },
    { id: 'fees', label: 'বকেয়া ও ফি আদায়', icon: CreditCard },
    { id: 'defaulters', label: 'খেলাপি তালিকা', icon: ShieldAlert },
    { id: 'staff_management', label: 'স্টাফ ও সাইন-আপ', icon: Briefcase },
    { id: 'digital_security', label: 'ডিজিটাল সিকিউরিটি', icon: ShieldCheck },
    { id: 'subjects', label: 'বিষয় ব্যবস্থাপনা', icon: BookMarked },
    { id: 'marks_entry', label: 'মার্ক এন্ট্রি', icon: FileCheck2 },
    { id: 'results', label: 'রেজাল্ট ও কার্ড', icon: Printer },
    { id: 'admit_card', label: 'এডমিট কার্ড', icon: FileBadge },
    { id: 'seat_plan', label: 'আসন বিন্যাস', icon: LayoutGrid },
    { id: 'tabulation', label: 'ট্যাবুল্যাশন শিট', icon: TableProperties },
    { id: 'attendance', label: 'উপস্থিতি ও হাজিরা', icon: CalendarCheck },
    { id: 'calendar', label: 'একাডেমিক ক্যালেন্ডার', icon: CalendarDays },
    { id: 'sms', label: 'এসএমএস নোটিশ', icon: MessageSquare },
    { id: 'students', label: 'শিক্ষার্থী তথ্য', icon: Users },
    { id: 'bulk_upload', label: 'বাল্ক আপলোড', icon: FileSpreadsheet },
    { id: 'syllabus', label: 'সিলেবাস', icon: BookOpen },
    { id: 'question_papers', label: 'প্রশ্নপত্র', icon: HelpCircle },
    { id: 'notes', label: 'ক্লাস নোট', icon: FileText },
    { id: 'digital_library', label: 'ডিজিটাল লাইব্রেরি', icon: Library },
  ];

  const employeeCategoryKey = resolveStaffCategoryKey(
    {
      categoryKey: session.categoryKey,
      designationBn: session.designationBn || session.subLabel,
      role: session.role === 'official' ? 'official' : 'employee',
    },
    session.designationBn || session.subLabel
  );

  const employeeNavItems =
    employeeCategoryKey === 'accountant_clerk'
      ? [
          { id: 'dashboard', label: 'একাউন্টস ড্যাশবোর্ড ও বেতন', icon: Briefcase },
          { id: 'fees', label: 'বকেয়া ও ফি আদায়', icon: CreditCard },
          { id: 'daily_report', label: 'দৈনিক আদায় রিপোর্ট', icon: Receipt },
          { id: 'defaulters', label: 'খেলাপি তালিকা', icon: ShieldAlert },
          { id: 'calendar', label: 'একাডেমিক ক্যালেন্ডার', icon: CalendarDays },
        ]
      : employeeCategoryKey === 'office_assistant' ||
        employeeCategoryKey === 'ayah' ||
        employeeCategoryKey === 'night_guard'
      ? [
          { id: 'dashboard', label: 'আমার ড্যাশবোর্ড ও বেতন', icon: Briefcase },
          { id: 'employee_scanner', label: 'গেটপাস স্ক্যানার', icon: QrCode },
          { id: 'calendar', label: 'একাডেমিক ক্যালেন্ডার', icon: CalendarDays },
        ]
      : [
          { id: 'dashboard', label: 'শিক্ষক ড্যাশবোর্ড ও বেতন', icon: Briefcase },
          { id: 'attendance', label: 'শিক্ষার্থী হাজিরা', icon: CalendarCheck },
          { id: 'marks_entry', label: 'মার্ক এন্ট্রি', icon: FileCheck2 },
          { id: 'employee_scanner', label: 'গেটপাস স্ক্যানার', icon: QrCode },
          { id: 'digital_library', label: 'ডিজিটাল লাইব্রেরি', icon: Library },
          { id: 'syllabus', label: 'সিলেবাস', icon: BookOpen },
          { id: 'question_papers', label: 'প্রশ্নপত্র', icon: HelpCircle },
          { id: 'notes', label: 'ক্লাস নোট', icon: FileText },
          { id: 'calendar', label: 'একাডেমিক ক্যালেন্ডার', icon: CalendarDays },
        ];

  const studentNavItems = [
    { id: 'dashboard', label: 'আমার ড্যাশবোর্ড ও গেটপাস', icon: User },
    { id: 'digital_library', label: 'ডিজিটাল লাইব্রেরি', icon: Library },
    { id: 'calendar', label: 'একাডেমিক ক্যালেন্ডার', icon: CalendarDays },
  ];

  const navItems =
    session.role === 'official'
      ? officialNavItems
      : session.role === 'employee'
      ? employeeNavItems
      : studentNavItems;

  const headerThemeClass =
    session.role === 'official'
      ? 'bg-gradient-to-r from-[#0B1733] via-indigo-950 to-blue-950 border-indigo-700/50'
      : session.role === 'employee'
      ? 'bg-gradient-to-r from-[#0A2E31] via-[#0F4347] to-[#0A2E31] border-teal-700/50'
      : 'bg-gradient-to-r from-[#093225] via-emerald-950 to-[#093225] border-emerald-700/50';

  const roleBadgeLabel =
    session.role === 'official'
      ? 'অফিসিয়াল পোর্টাল'
      : session.role === 'employee'
      ? 'এমপ্লয়ী পোর্টাল'
      : 'শিক্ষার্থী পোর্টাল';

  return (
    <header className={`no-print ${headerThemeClass} text-white shadow-lg sticky top-0 z-40 border-b`}>
      {/* Top Banner Bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-3">
          {/* Logo & School Title */}
          <div className="flex items-center space-x-3 cursor-pointer min-w-0" onClick={() => setCurrentTab('dashboard')}>
            <div className="bg-white p-1 rounded-full shadow-md shrink-0">
              <SchoolLogo customLogoUrl={schoolInfo.logoUrl} size={40} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-base sm:text-xl tracking-wide font-serif text-amber-300 truncate">
                  {schoolInfo.name || 'ডি-লিকন মডেল একাডেমী'}
                </span>
                <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-white/15 text-amber-200 border border-white/20 whitespace-nowrap shrink-0">
                  {roleBadgeLabel}
                </span>
              </div>
              <p className="text-xs text-slate-200/90 hidden sm:block truncate max-w-md">
                {session.displayName} · {session.subLabel}
              </p>
            </div>
          </div>

          {/* Right Quick Actions (Role-Scoped) */}
          <div className="hidden lg:flex items-center space-x-2 shrink-0">
            <PWAInstallButton variant="badge" />

            <button
              type="button"
              onClick={async () => {
                if (cloudUser) {
                  await disconnectCloudSync();
                  setSyncNotice('ক্লাউড সিঙ্ক বিচ্ছিন্ন করা হয়েছে।');
                } else {
                  const ok = await connectCloudSync();
                  if (ok) {
                    setSyncNotice('✓ রিয়েল-টাইম ক্লাউড সিঙ্ক (Firebase) সক্রিয় হয়েছে!');
                  }
                }
                setTimeout(() => setSyncNotice(null), 4500);
              }}
              title={
                cloudUser
                  ? `ক্লাউড সিঙ্ক সক্রিয় (${cloudUser.email}) — বিচ্ছিন্ন করতে ক্লিক করুন`
                  : 'সকল ডিভাইসে (Vercel / মোবাইল) লাইভ সিঙ্ক চালু করতে ক্লিক করুন'
              }
              className={`inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer whitespace-nowrap ${
                cloudUser
                  ? 'bg-emerald-950/75 text-emerald-300 border-emerald-500/50 hover:bg-emerald-900/80'
                  : 'bg-sky-950/70 text-sky-200 border-sky-400/50 hover:bg-sky-900/80'
              }`}
            >
              {cloudUser ? (
                <Cloud className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
              ) : (
                <CloudOff className="w-3.5 h-3.5 mr-1.5 text-sky-300" />
              )}
              <span>{cloudUser ? 'ক্লাউড সিঙ্ক সক্রিয়' : 'ক্লাউড সিঙ্ক চালু'}</span>
            </button>

            {session.role === 'official' && (
              <>
                <button
                  onClick={async () => {
                    await forceServerSync();
                    setSyncNotice('✓ কেন্দ্রীয় ডাটাবেজের সাথে তথ্য সিঙ্ক সম্পন্ন!');
                    setTimeout(() => setSyncNotice(null), 3500);
                  }}
                  title="সকল সংযুক্ত ডিভাইস ও কম্পিউটারের সাথে ডাটা সিঙ্ক করুন"
                  className={`inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer whitespace-nowrap ${
                    serverSyncStatus === 'synced'
                      ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/50 hover:bg-emerald-900/80'
                      : 'bg-amber-950/70 text-amber-300 border-amber-500/50 hover:bg-amber-900/80'
                  }`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isServerSyncing ? 'animate-spin text-amber-400' : 'text-emerald-400'}`} />
                  <span>{serverSyncStatus === 'synced' ? 'সিঙ্ক সংযুক্ত' : 'সিঙ্ক হচ্ছে...'}</span>
                </button>
                <button
                  onClick={exportDatabaseBackup}
                  title="সম্পূর্ণ ডাটাবেস ব্যাকআপ ডাউনলোড করুন"
                  className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-800/80 hover:bg-indigo-700 text-indigo-100 border border-indigo-600 transition cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                  ব্যাকআপ
                </button>
                <button
                  onClick={onOpenSettings}
                  className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition shadow-sm cursor-pointer whitespace-nowrap"
                >
                  <Settings className="w-3.5 h-3.5 mr-1 text-slate-950" />
                  সেটিংস
                </button>
              </>
            )}

            {isDeviceLocked ? (
              <button
                type="button"
                onClick={handleLockedIndicatorTap}
                className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-white/10 text-slate-200 border border-white/15 select-none whitespace-nowrap"
              >
                <Lock className="w-3.5 h-3.5 mr-1.5 text-amber-300" />
                লক্ড ড্যাশবোর্ড
              </button>
            ) : (
              <button
                onClick={onLogout}
                className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600/90 hover:bg-rose-600 text-white transition shadow-xs cursor-pointer whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5 mr-1.5" />
                সাইন আউট
              </button>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center lg:hidden space-x-2 shrink-0">
            <PWAInstallButton variant="badge" />
            {session.role === 'official' && (
              <button
                onClick={onOpenSettings}
                className="p-1.5 text-amber-300 hover:text-amber-200 rounded-lg hover:bg-white/10"
                title="সেটিংস"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}
            {isDeviceLocked ? (
              <button
                type="button"
                onClick={handleLockedIndicatorTap}
                className="px-2.5 py-1.5 rounded-lg bg-white/10 border border-white/15 text-slate-200 text-[11px] font-medium flex items-center gap-1 select-none"
              >
                <Lock className="w-3.5 h-3.5 text-amber-300" />
                <span>লক্ড</span>
              </button>
            ) : (
              <button
                onClick={onLogout}
                className="px-2.5 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold flex items-center gap-1"
                title="সাইন আউট"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">সাইন আউট</span>
              </button>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 focus:outline-none"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Desktop Navigation Links (Role-Scoped) */}
        <nav className="hidden lg:flex space-x-1 pb-2 pt-1 border-t border-white/10 overflow-x-auto scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`inline-flex items-center px-3.5 py-1.5 rounded-md text-sm font-medium transition whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-100 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 mr-1.5 ${isActive ? 'text-slate-950' : 'text-amber-300/90'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      {(syncNotice || cloudSyncError) && (
        <div
          className={`px-4 py-2 text-xs text-center font-medium border-t ${
            cloudSyncError
              ? 'bg-amber-950 text-amber-200 border-amber-700/60'
              : 'bg-emerald-950 text-emerald-200 border-emerald-700/60'
          }`}
        >
          <span>{cloudSyncError || syncNotice}</span>
          {cloudUnauthorizedDomain && (
            <span className="ml-2 underline font-mono">
              Firebase Console → Authentication → Settings → Authorized domains → Add "{cloudUnauthorizedDomain}"
            </span>
          )}
        </div>
      )}

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-slate-950/95 border-t border-white/10 px-3 pt-2 pb-4 space-y-2 shadow-2xl">
          <div className="px-2 py-1 text-xs text-amber-200 font-semibold border-b border-white/10 pb-2">
            {roleBadgeLabel}: {session.displayName} ({session.subLabel})
          </div>
          <div className="grid grid-cols-2 gap-1.5 pb-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center px-3 py-2.5 rounded-lg text-xs font-medium transition ${
                    isActive
                      ? 'bg-amber-400 text-slate-950 font-bold'
                      : 'bg-white/10 text-slate-100 hover:bg-white/15'
                  }`}
                >
                  <Icon className={`w-4 h-4 mr-2 shrink-0 ${isActive ? 'text-slate-950' : 'text-amber-400'}`} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={async () => {
                if (cloudUser) {
                  await disconnectCloudSync();
                } else {
                  await connectCloudSync();
                }
                setMobileMenuOpen(false);
              }}
              className={`w-full inline-flex items-center justify-center px-3 py-2 rounded-lg text-xs font-semibold border ${
                cloudUser
                  ? 'bg-emerald-900/80 text-emerald-200 border-emerald-500/50'
                  : 'bg-sky-800/80 text-white border-sky-500/50'
              }`}
            >
              {cloudUser ? (
                <Cloud className="w-3.5 h-3.5 mr-1.5 text-emerald-300" />
              ) : (
                <CloudOff className="w-3.5 h-3.5 mr-1.5 text-sky-200" />
              )}
              {cloudUser ? `ক্লাউড সিঙ্ক সক্রিয় (${cloudUser.email})` : 'ক্লাউড সিঙ্ক (Google / Vercel) চালু করুন'}
            </button>
            {session.role === 'official' && (
              <>
                <button
                  onClick={() => {
                    exportDatabaseBackup();
                    setMobileMenuOpen(false);
                  }}
                  className="flex-1 inline-flex items-center justify-center px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-700 text-white"
                >
                  <Download className="w-3.5 h-3.5 mr-1" />
                  ব্যাকআপ
                </button>
                <button
                  onClick={() => {
                    onOpenSettings();
                    setMobileMenuOpen(false);
                  }}
                  className="flex-1 inline-flex items-center justify-center px-3 py-2 rounded-lg text-xs font-semibold bg-amber-500 text-slate-950"
                >
                  <Settings className="w-3.5 h-3.5 mr-1" />
                  সেটিংস
                </button>
              </>
            )}
            {isDeviceLocked ? (
              <button
                type="button"
                onClick={handleLockedIndicatorTap}
                className="flex-1 inline-flex items-center justify-center px-3 py-2 rounded-lg text-[11px] font-medium bg-white/10 border border-white/15 text-slate-200 select-none"
              >
                <Lock className="w-3.5 h-3.5 mr-1.5 text-amber-300" />
                লক্ড ড্যাশবোর্ড · অফিসিয়াল নিয়ন্ত্রিত
              </button>
            ) : (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onLogout();
                }}
                className="flex-1 inline-flex items-center justify-center px-3 py-2 rounded-lg text-xs font-semibold bg-rose-600 text-white"
              >
                <LogOut className="w-3.5 h-3.5 mr-1" />
                সাইন আউট
              </button>
            )}
          </div>
          {!alwaysLockDevices && (
            <div className="text-[11px] text-amber-300/90 text-center pt-1">
              সাময়িক আনলক সময়সূচি সক্রিয় রয়েছে
            </div>
          )}
        </div>
      )}

      {/* Hidden In-Person Principal/Entrepreneur Unlock Verification Modal (5 taps on Locked badge) */}
      {showOfficeUnlockModal && onAdminUnlockDevice && (
        <div
          className="fixed inset-0 z-[9999] bg-slate-950/80 flex items-center justify-center p-4"
          onClick={() => setShowOfficeUnlockModal(false)}
        >
          <div
            className="bg-white text-slate-900 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#0F1E3D] text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-400 text-slate-950">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold font-serif">
                    অফিস প্রিন্সিপাল আনলক যাচাই
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    {session.displayName} ({session.subLabel})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowOfficeUnlockModal(false)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setOfficeUnlockError(null);
                setIsVerifyingUnlock(true);
                try {
                  const ok = await onAdminUnlockDevice(officeUnlockPin.trim());
                  if (ok) {
                    setShowOfficeUnlockModal(false);
                    setOfficeUnlockPin('');
                  } else {
                    setOfficeUnlockError('অফিস প্রিন্সিপাল বা শিক্ষা উদ্যোক্তার পাসওয়ার্ড সঠিক নয়!');
                  }
                } finally {
                  setIsVerifyingUnlock(false);
                }
              }}
              className="p-5 space-y-4 text-xs sm:text-sm"
            >
              <p className="text-slate-600 leading-relaxed">
                এই স্মার্টফোনটি বর্তমানে <strong>{session.displayName}</strong>-এর ড্যাশবোর্ডে লক করা আছে। আনলক করতে শুধুমাত্র প্রিন্সিপাল অথবা শিক্ষা উদ্যোক্তার দাপ্তরিক পাসওয়ার্ড দিন।
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  প্রিন্সিপাল / শিক্ষা উদ্যোক্তার পাসওয়ার্ড
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  value={officeUnlockPin}
                  onChange={(e) => setOfficeUnlockPin(e.target.value)}
                  placeholder="অফিস পাসওয়ার্ড লিখুন"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0F1E3D]"
                />
              </div>

              {officeUnlockError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800">
                  {officeUnlockError}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isVerifyingUnlock}
                  className="flex-1 py-2.5 px-4 bg-[#0F1E3D] hover:bg-[#172C57] text-white text-xs sm:text-sm font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isVerifyingUnlock ? 'যাচাই হচ্ছে...' : 'যাচাই করে আনলক করুন'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowOfficeUnlockModal(false)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-semibold rounded-xl transition cursor-pointer"
                >
                  বাতিল
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};

