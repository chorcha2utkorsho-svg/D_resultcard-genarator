import React, { useState } from 'react';
import {
  GraduationCap,
  FileCheck2,
  TableProperties,
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
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { SchoolLogo } from './SchoolLogo';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenSettings: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setCurrentTab, onOpenSettings }) => {
  const { schoolInfo, exportDatabaseBackup } = useSchool();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'ড্যাশবোর্ড', icon: GraduationCap },
    { id: 'subjects', label: 'বিষয় ব্যবস্থাপনা', icon: BookMarked },
    { id: 'marks_entry', label: 'মার্ক এন্ট্রি', icon: FileCheck2 },
    { id: 'results', label: 'রেজাল্ট ও কার্ড', icon: Printer },
    { id: 'tabulation', label: 'ট্যাবুল্যাশন শিট', icon: TableProperties },
    { id: 'fees', label: 'বকেয়া ও ফি আদায়', icon: CreditCard },
    { id: 'daily_report', label: 'দৈনিক রিপোর্ট', icon: Receipt },
    { id: 'defaulters', label: 'খেলাপি তালিকা', icon: ShieldAlert },
    { id: 'attendance', label: 'উপস্থিতি ও হাজিরা', icon: CalendarCheck },
    { id: 'calendar', label: 'একাডেমিক ক্যালেন্ডার', icon: CalendarDays },
    { id: 'sms', label: 'এসএমএস নোটিশ', icon: MessageSquare },
    { id: 'students', label: 'শিক্ষার্থী তথ্য', icon: Users },
    { id: 'bulk_upload', label: 'বাল্ক আপলোড', icon: FileSpreadsheet },
    { id: 'syllabus', label: 'সিলেবাস', icon: BookOpen },
    { id: 'question_papers', label: 'প্রশ্নপত্র', icon: HelpCircle },
    { id: 'notes', label: 'ক্লাস নোট', icon: FileText },
  ];

  return (
    <header className="no-print bg-gradient-to-r from-blue-900 via-indigo-900 to-indigo-950 text-white shadow-lg sticky top-0 z-40 border-b border-indigo-700/50">
      {/* Top Banner Bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo & School Title */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setCurrentTab('dashboard')}>
            <div className="bg-white p-1 rounded-full shadow-md">
              <SchoolLogo customLogoUrl={schoolInfo.logoUrl} size={42} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg sm:text-2xl tracking-wide font-serif text-amber-300 drop-shadow-sm">
                  {schoolInfo.name || 'ডি-লিকন মডেল একাডেমী'}
                </span>
                <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-600/80 text-emerald-100 border border-emerald-400/30">
                  <ShieldCheck className="w-3 h-3 mr-1" /> সুরক্ষিত
                </span>
              </div>
              <p className="text-xs text-indigo-200 hidden sm:block truncate max-w-md">
                {schoolInfo.address || 'দক্ষিণগাঁও, গণি মার্কেট, সনমানিয়া, কাপাসিয়া, গাজীপুর।'}
              </p>
            </div>
          </div>

          {/* Quick Actions (Backup & Settings) on Desktop */}
          <div className="hidden lg:flex items-center space-x-2">
            <button
              onClick={exportDatabaseBackup}
              title="সম্পূর্ণ ডাটাবেস ব্যাকআপ ডাউনলোড করুন"
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-800/80 hover:bg-indigo-700 text-indigo-100 border border-indigo-600 transition"
            >
              <Download className="w-3.5 h-3.5 mr-1 text-emerald-400" />
              ব্যাকআপ
            </button>
            <button
              onClick={onOpenSettings}
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold transition shadow-sm"
            >
              <Settings className="w-3.5 h-3.5 mr-1 text-slate-950" />
              সেটিংস ও লোগো
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center lg:hidden space-x-2">
            <button
              onClick={onOpenSettings}
              className="p-1.5 text-amber-300 hover:text-amber-200 rounded-lg hover:bg-indigo-800"
              title="সেটিংস"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-indigo-200 hover:text-white hover:bg-indigo-800 focus:outline-none"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex space-x-1 pb-2 pt-1 border-t border-indigo-800/60 overflow-x-auto scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`inline-flex items-center px-3.5 py-1.5 rounded-md text-sm font-medium transition whitespace-nowrap ${
                  isActive
                    ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                    : 'text-indigo-100 hover:bg-indigo-800/70 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 mr-1.5 ${isActive ? 'text-slate-950' : 'text-indigo-300'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-indigo-950 border-t border-indigo-800 px-3 pt-2 pb-4 space-y-1 shadow-2xl">
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
                      : 'bg-indigo-900/60 text-indigo-100 hover:bg-indigo-800'
                  }`}
                >
                  <Icon className={`w-4 h-4 mr-2 ${isActive ? 'text-slate-950' : 'text-amber-400'}`} />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-indigo-800/80 flex items-center justify-between">
            <button
              onClick={() => {
                exportDatabaseBackup();
                setMobileMenuOpen(false);
              }}
              className="flex-1 mr-2 inline-flex items-center justify-center px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-700 text-white"
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              ব্যাকআপ ডাউনলোড
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
          </div>
        </div>
      )}
    </header>
  );
};
