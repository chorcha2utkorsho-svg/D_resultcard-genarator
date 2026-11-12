import React, { useState } from 'react';
import {
  ShieldCheck,
  GraduationCap,
  Briefcase,
  Lock,
  UserPlus,
  LogIn,
  ArrowRight,
  Calendar,
  BookOpen,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Building2,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { PortalAuthSession, PortalRole, Student } from '../types';
import { SchoolLogo } from './SchoolLogo';
import { PWAInstallButton } from './PWAInstallButton';
import { getStudentPortalId, toBengaliNumber, toBengaliRoll } from '../utils/bengali';

interface PortalHomeViewProps {
  onLoginSuccess: (session: PortalAuthSession, matchedStudent?: Student | null) => void;
  initialPortal?: PortalRole;
}

export const PortalHomeView: React.FC<PortalHomeViewProps> = ({
  onLoginSuccess,
  initialPortal = 'student',
}) => {
  const { schoolInfo, classes, students, updateStudent } = useSchool();

  const [selectedPortal, setSelectedPortal] = useState<PortalRole>(initialPortal);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // Sign-In Form States
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [studentLoginClassId, setStudentLoginClassId] = useState('all');

  // Official / Employee Sign-Up States
  const [staffNameBn, setStaffNameBn] = useState('');
  const [staffDesignationBn, setStaffDesignationBn] = useState('সহকারী শিক্ষক');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [officialVerifyCode, setOfficialVerifyCode] = useState('');
  const [assignedClassIds, setAssignedClassIds] = useState<string[]>(['class_4', 'class_5']);

  // Student Sign-Up / Activation States
  const [studentSignupMode, setStudentSignupMode] = useState<'activate' | 'new_admission'>('activate');
  const [actClassId, setActClassId] = useState('class_4');
  const [actRoll, setActRoll] = useState('');
  const [actPhone, setActPhone] = useState('');
  const [actNewPin, setActNewPin] = useState('');
  const [admStudentName, setAdmStudentName] = useState('');
  const [admGuardianName, setAdmGuardianName] = useState('');

  const switchPortal = (portal: PortalRole) => {
    setSelectedPortal(portal);
    setAuthMode('signin');
    setFeedback(null);
    setIdentifier('');
    setPassword('');
    setShowPassword(false);
    if (portal === 'official') {
      setStaffDesignationBn('অফিস প্রশাসক');
    } else if (portal === 'employee') {
      setStaffDesignationBn('সহকারী শিক্ষক');
    }
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: selectedPortal,
          identifier,
          password,
          classId: studentLoginClassId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setFeedback({ type: 'error', text: data.message || 'সাইন ইন সফল হয়নি। তথ্য যাচাই করুন।' });
        setIsLoading(false);
        return;
      }

      if (data.student) {
        updateStudent(data.student);
      }
      onLoginSuccess(data.session, data.student || null);
    } catch {
      setFeedback({ type: 'error', text: 'সার্ভারের সাথে সংযোগ পাওয়া যায়নি। আবার চেষ্টা করুন।' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStaffSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/register-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: selectedPortal === 'official' ? 'official' : 'employee',
          nameBn: staffNameBn,
          designationBn: staffDesignationBn,
          phone: staffPhone,
          email: staffEmail,
          password: staffPassword,
          assignedClassIds,
          officialInviteCode: officialVerifyCode,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setFeedback({ type: 'error', text: data.message || 'নিবন্ধন সম্পন্ন করা যায়নি।' });
        setIsLoading(false);
        return;
      }
      onLoginSuccess(data.session, null);
    } catch {
      setFeedback({ type: 'error', text: 'নেটওয়ার্ক ত্রুটি! অনুগ্রহ করে আবার চেষ্টা করুন।' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStudentSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setIsLoading(true);
    try {
      if (studentSignupMode === 'activate') {
        const res = await fetch('/api/auth/activate-student', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            classId: actClassId,
            roll: actRoll,
            guardianPhone: actPhone,
            newPassword: actNewPin,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setFeedback({ type: 'error', text: data.message || 'অ্যাকাউন্ট সক্রিয় করা যায়নি।' });
          setIsLoading(false);
          return;
        }
        if (data.student) updateStudent(data.student);
        onLoginSuccess(data.session, data.student || null);
      } else {
        const res = await fetch('/api/auth/request-student-signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentNameBn: admStudentName,
            classId: actClassId,
            desiredRoll: actRoll || undefined,
            guardianNameBn: admGuardianName,
            guardianPhone: actPhone,
            password: actNewPin,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setFeedback({ type: 'error', text: data.message || 'আবেদন পাঠানো যায়নি।' });
          setIsLoading(false);
          return;
        }
        setFeedback({ type: 'success', text: data.message });
        setAdmStudentName('');
        setAdmGuardianName('');
        setActRoll('');
        setActNewPin('');
      }
    } catch {
      setFeedback({ type: 'error', text: 'সার্ভারের সাথে সংযোগে সমস্যা হয়েছে।' });
    } finally {
      setIsLoading(false);
    }
  };

  const fillQuickDemo = () => {
    setAuthMode('signin');
    setFeedback(null);
    if (selectedPortal === 'official') {
      setIdentifier('DL-ADMIN');
      setPassword('admin123');
    } else if (selectedPortal === 'employee') {
      setIdentifier('DL-EMP-01');
      setPassword('emp123');
    } else {
      const sample =
        students.find((s) => s.classId === 'class_4' && s.roll === 1) ||
        students[0];
      if (sample) {
        setStudentLoginClassId(sample.classId);
        setIdentifier(getStudentPortalId(sample));
        setPassword(sample.guardianPin || '1234');
      } else {
        setIdentifier('DL-C4-01');
        setPassword('1234');
      }
    }
  };

  const toggleClassAssignment = (cid: string) => {
    setAssignedClassIds((prev) =>
      prev.includes(cid) ? prev.filter((c) => c !== cid) : [...prev, cid]
    );
  };

  const portalMeta: Record<
    PortalRole,
    {
      title: string;
      subtitle: string;
      accentBg: string;
      accentText: string;
      buttonClass: string;
      idLabel: string;
      idPlaceholder: string;
      demoHint: string;
    }
  > = {
    official: {
      title: 'অফিসিয়াল সাইন ইন',
      subtitle: 'অধ্যক্ষ, পরিচালক ও অফিস প্রশাসন — সম্পূর্ণ আর্থিক ও প্রাতিষ্ঠানিক নিয়ন্ত্রণ',
      accentBg: 'bg-[#0F1E3D]',
      accentText: 'text-[#0F1E3D]',
      buttonClass: 'bg-[#0F1E3D] hover:bg-[#172C57] text-white',
      idLabel: 'অফিসিয়াল আইডি / ই-মেইল / মোবাইল',
      idPlaceholder: 'যেমন: DL-ADMIN অথবা মোবাইল নম্বর',
      demoHint: 'ডিফল্ট আইডি: DL-ADMIN · পাসওয়ার্ড: admin123',
    },
    student: {
      title: 'শিক্ষার্থী ও অভিভাবক সাইন ইন',
      subtitle: 'নিজস্ব প্রোফাইল, ফলাফল, ভবিষ্যৎ পরিকল্পনা ও লাইভ গেটপাস ভয়েস এলার্ম',
      accentBg: 'bg-emerald-900',
      accentText: 'text-emerald-900',
      buttonClass: 'bg-emerald-800 hover:bg-emerald-900 text-white',
      idLabel: 'শিক্ষার্থী ইউনিক আইডি / রোল / মোবাইল',
      idPlaceholder: 'যেমন: DL-C4-01 অথবা রোল নম্বর',
      demoHint: 'নমুনা আইডি: DL-C4-01 (অথবা শ্রেণি ও রোল) · ডিফল্ট পিন: 1234',
    },
    employee: {
      title: 'এমপ্লয়ী ও শিক্ষক সাইন ইন',
      subtitle: 'শিক্ষক হাজিরা, ক্লাস উপস্থিতি, মার্ক এন্ট্রি, নোট, সিলেবাস ও গেট স্ক্যানার',
      accentBg: 'bg-teal-900',
      accentText: 'text-teal-900',
      buttonClass: 'bg-teal-800 hover:bg-teal-900 text-white',
      idLabel: 'এমপ্লয়ী আইডি / মোবাইল / ই-মেইল',
      idPlaceholder: 'যেমন: DL-EMP-01 অথবা মোবাইল নম্বর',
      demoHint: 'ডিফল্ট আইডি: DL-EMP-01 · পাসওয়ার্ড: emp123',
    },
  };

  const activeMeta = portalMeta[selectedPortal];

  return (
    <div className="min-h-screen bg-[#F7F6F2] text-stone-900 flex flex-col">
      {/* Clean 3-Zone Editorial Top Bar (No exposed internal buttons) */}
      <header className="sticky top-0 z-30 bg-[#F7F6F2]/95 backdrop-blur-md border-b border-stone-200/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-6">
          {/* Zone 1: Academy Wordmark */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-white p-1 rounded-full border border-stone-200 shadow-xs shrink-0">
              <SchoolLogo customLogoUrl={schoolInfo.logoUrl} size={40} />
            </div>
            <span className="font-serif font-bold text-lg sm:text-xl text-[#0F1E3D] tracking-tight truncate">
              {schoolInfo.name || 'ডি-লিকন মডেল একাডেমী'}
            </span>
          </div>

          {/* Zone 2: Clean Single-Line Nav Links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-stone-600">
            <a href="#campus-overview" className="hover:text-[#0F1E3D] transition-colors whitespace-nowrap shrink-0">
              প্রতিষ্ঠান পরিচিতি
            </a>
            <a href="#portal-roles" className="hover:text-[#0F1E3D] transition-colors whitespace-nowrap shrink-0">
              পোর্টাল সুবিধাসমূহ
            </a>
            <a href="#academy-security" className="hover:text-[#0F1E3D] transition-colors whitespace-nowrap shrink-0">
              নিরাপত্তা ব্যবস্থা
            </a>
          </nav>

          {/* Zone 3: Single Clean Action */}
          <div className="flex items-center gap-2.5 shrink-0">
            <PWAInstallButton variant="badge" />
            <a
              href="#portal-auth-box"
              className="px-4 py-2 rounded-lg bg-[#0F1E3D] hover:bg-[#172C57] text-white text-xs sm:text-sm font-semibold transition whitespace-nowrap shrink-0 shadow-xs"
            >
              পোর্টাল প্রবেশ
            </a>
          </div>
        </div>
      </header>

      {/* Main Split Institutional Hero + 3-Portal Sign-In Gateway */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-12">
        <section id="campus-overview" className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Column (7/12): Official School Cover Photo & Institutional Presentation */}
          <div className="lg:col-span-7 flex flex-col justify-between bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
            {/* Official Cover Banner (Uncropped & unobstructed so all banner details stay crystal clear) */}
            <div className="w-full bg-stone-100 border-b border-stone-200">
              <img
                src="/assets/aistudio/Building_Bright_Futures_at_D-Likon_Academy_b591078e.jpg"
                alt={schoolInfo.name || 'ডি-লিকন মডেল একাডেমী কভার ফটো'}
                referrerPolicy="no-referrer"
                className="w-full h-auto object-contain block"
              />
            </div>

            {/* Institutional Editorial Narrative & Public Highlights (NO Financial/Internal Numbers) */}
            <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <div className="text-xs font-semibold text-amber-800 tracking-wide">
                  নিরাপদ শিক্ষাঙ্গন · স্বচ্ছ একাডেমিক পোর্টাল
                </div>
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#0F1E3D] leading-snug text-balance">
                  শিক্ষা, শৃঙ্খলা ও প্রযুক্তির সমন্বয়ে একটি আধুনিক একাডেমিক পরিবেশ
                </h2>
                <p className="text-sm sm:text-[15px] text-stone-600 leading-relaxed max-w-2xl">
                  অফিস প্রশাসন, শিক্ষক-কর্মচারী এবং শিক্ষার্থী-অভিভাবকদের জন্য সম্পূর্ণ আলাদা ও সুরক্ষিত তিনটি ডিজিটাল পোর্টাল। প্রবাসী ও স্থানীয় অভিভাবকগণ কেবল নিজ সন্তানের একান্ত ড্যাশবোর্ডে প্রবেশ করে পড়াশোনার অগ্রগতি এবং গেটপাস ভয়েস নোটিফিকেশন পাবেন।
                </p>
              </div>

              {/* Clean Hairline Separated Public Info Strip */}
              <div className="pt-5 border-t border-stone-200 grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div>
                  <div className="text-xs text-stone-500">শ্রেণি কার্যক্রম</div>
                  <div className="text-base sm:text-lg font-bold text-[#0F1E3D] mt-0.5 tabular-nums">
                    {toBengaliNumber(classes.length)}টি শ্রেণি
                  </div>
                  <div className="text-xs text-stone-500 mt-0.5">প্লে থেকে প্রাথমিক স্তর</div>
                </div>
                <div>
                  <div className="text-xs text-stone-500">গেট নিরাপত্তা</div>
                  <div className="text-base sm:text-lg font-bold text-emerald-800 mt-0.5">
                    লাইভ ভয়েস গেটপাস
                  </div>
                  <div className="text-xs text-stone-500 mt-0.5">কিউআর কার্ড ও তাৎক্ষণিক অ্যালার্ট</div>
                </div>
                <div>
                  <div className="text-xs text-stone-500">অফিস যোগাযোগ</div>
                  <div className="text-base sm:text-lg font-bold text-[#0F1E3D] mt-0.5 tabular-nums">
                    {toBengaliNumber(schoolInfo.phone || '01313159459')}
                  </div>
                  <div className="text-xs text-stone-500 mt-0.5">সকাল ৮:৩০ – বিকাল ৪:০০</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (5/12): Unified 3-Portal Sign-In & Sign-Up Panel */}
          <div id="portal-auth-box" className="lg:col-span-5 flex flex-col bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            {/* 3 Role Selector Tabs */}
            <div className="bg-stone-100 p-2 border-b border-stone-200 grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => switchPortal('official')}
                className={`py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer ${
                  selectedPortal === 'official'
                    ? 'bg-[#0F1E3D] text-white shadow-xs'
                    : 'text-stone-700 hover:bg-white/80'
                }`}
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap">অফিসিয়াল</span>
              </button>

              <button
                type="button"
                onClick={() => switchPortal('student')}
                className={`py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer ${
                  selectedPortal === 'student'
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'text-stone-700 hover:bg-white/80'
                }`}
              >
                <GraduationCap className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap">শিক্ষার্থী</span>
              </button>

              <button
                type="button"
                onClick={() => switchPortal('employee')}
                className={`py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer ${
                  selectedPortal === 'employee'
                    ? 'bg-teal-800 text-white shadow-xs'
                    : 'text-stone-700 hover:bg-white/80'
                }`}
              >
                <Briefcase className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap">এমপ্লয়ী</span>
              </button>
            </div>

            {/* Active Portal Form Container */}
            <div className="p-5 sm:p-7 flex-1 flex flex-col justify-between space-y-5">
              <div className="space-y-4">
                {/* Role Title + Sign In / Sign Up Switch */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className={`text-lg sm:text-xl font-serif font-bold ${activeMeta.accentText}`}>
                      {activeMeta.title}
                    </h2>
                    <p className="text-xs text-stone-500 mt-1 leading-relaxed">{activeMeta.subtitle}</p>
                  </div>
                </div>

                {/* Sign In vs Sign Up Segmented Bar */}
                <div className="grid grid-cols-2 bg-stone-100 p-1 rounded-xl border border-stone-200">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('signin');
                      setFeedback(null);
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      authMode === 'signin'
                        ? 'bg-white text-stone-900 shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>সাইন ইন (Sign In)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('signup');
                      setFeedback(null);
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      authMode === 'signup'
                        ? 'bg-white text-stone-900 shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>সাইন আপ (Sign Up)</span>
                  </button>
                </div>

                {/* Feedback Banner */}
                {feedback && (
                  <div
                    className={`p-3 rounded-xl text-xs font-medium flex items-start gap-2 border ${
                      feedback.type === 'error'
                        ? 'bg-rose-50 border-rose-200 text-rose-800'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    }`}
                  >
                    {feedback.type === 'error' ? (
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    )}
                    <span>{feedback.text}</span>
                  </div>
                )}

                {/* ---------------- SIGN IN FORM ---------------- */}
                {authMode === 'signin' && (
                  <form onSubmit={handleSignInSubmit} className="space-y-4">
                    {selectedPortal === 'student' && (
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                          শ্রেণি নির্বাচন করুন (রোল নম্বর দিলে আবশ্যক)
                        </label>
                        <select
                          value={studentLoginClassId}
                          onChange={(e) => setStudentLoginClassId(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-700"
                        >
                          <option value="all">সকল শ্রেণি (ইউনিক আইডি বা মোবাইল দিন)</option>
                          {classes.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nameBn}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                        {activeMeta.idLabel}
                      </label>
                      <input
                        type="text"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder={activeMeta.idPlaceholder}
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0F1E3D]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                        পাসওয়ার্ড / গোপন পিন
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="আপনার পাসওয়ার্ড লিখুন"
                          required
                          className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-stone-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0F1E3D]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
                          aria-label="পাসওয়ার্ড দেখুন"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className={`w-full py-3 px-4 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-60 ${activeMeta.buttonClass}`}
                    >
                      <Lock className="w-4 h-4" />
                      <span>{isLoading ? 'যাচাই করা হচ্ছে...' : `${activeMeta.title} সম্পন্ন করুন`}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>

                    {/* Helpful Starter Info & 1-Click Test Autofill */}
                    <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-2 text-[11px] text-stone-500">
                      <span>{activeMeta.demoHint}</span>
                      <button
                        type="button"
                        onClick={fillQuickDemo}
                        className="text-[#0F1E3D] font-bold hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        অটো-ফিল
                      </button>
                    </div>
                  </form>
                )}

                {/* ---------------- SIGN UP: OFFICIAL OR EMPLOYEE ---------------- */}
                {authMode === 'signup' && (selectedPortal === 'official' || selectedPortal === 'employee') && (
                  <form onSubmit={handleStaffSignUpSubmit} className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        পূর্ণ নাম *
                      </label>
                      <input
                        type="text"
                        value={staffNameBn}
                        onChange={(e) => setStaffNameBn(e.target.value)}
                        placeholder={selectedPortal === 'official' ? 'যেমন: মোঃ কামরুল ইসলাম' : 'যেমন: নুসরাত জাহান'}
                        required
                        className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F1E3D]"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                          পদবি *
                        </label>
                        <select
                          value={staffDesignationBn}
                          onChange={(e) => setStaffDesignationBn(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                        >
                          {selectedPortal === 'official' ? (
                            <>
                              <option value="প্রধান শিক্ষক">প্রধান শিক্ষক</option>
                              <option value="পরিচালক">পরিচালক</option>
                              <option value="অফিস প্রশাসক">অফিস প্রশাসক</option>
                              <option value="হিসাব রক্ষক">হিসাব রক্ষক</option>
                            </>
                          ) : (
                            <>
                              <option value="সহকারী শিক্ষক">সহকারী শিক্ষক</option>
                              <option value="শ্রেণি শিক্ষক">শ্রেণি শিক্ষক</option>
                              <option value="গেট সিকিউরিটি">গেট সিকিউরিটি</option>
                              <option value="অফিস সহকারী">অফিস সহকারী</option>
                            </>
                          )}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                          মোবাইল নম্বর *
                        </label>
                        <input
                          type="tel"
                          value={staffPhone}
                          onChange={(e) => setStaffPhone(e.target.value)}
                          placeholder="01XXXXXXXXX"
                          required
                          className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                          ই-মেইল (ঐচ্ছিক)
                        </label>
                        <input
                          type="email"
                          value={staffEmail}
                          onChange={(e) => setStaffEmail(e.target.value)}
                          placeholder="name@school.com"
                          className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                          নতুন পাসওয়ার্ড *
                        </label>
                        <input
                          type="password"
                          value={staffPassword}
                          onChange={(e) => setStaffPassword(e.target.value)}
                          placeholder="কমপক্ষে ৪ অক্ষর"
                          required
                          className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-sm"
                        />
                      </div>
                    </div>

                    {selectedPortal === 'official' ? (
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                          প্রতিষ্ঠানের অফিসিয়াল ভেরিফিকেশন কোড *
                        </label>
                        <input
                          type="text"
                          value={officialVerifyCode}
                          onChange={(e) => setOfficialVerifyCode(e.target.value)}
                          placeholder="কোড দিন (প্রথমবার: DL-ADMIN)"
                          required
                          className="w-full px-3.5 py-2 rounded-xl border border-amber-300 bg-amber-50/40 text-sm"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                          দায়িত্বপ্রাপ্ত শ্রেণিসমূহ
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {classes.map((c) => {
                            const active = assignedClassIds.includes(c.id);
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => toggleClassAssignment(c.id)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                                  active
                                    ? 'bg-teal-800 text-white border-teal-800'
                                    : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                                }`}
                              >
                                {c.nameBn}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isLoading}
                      className={`w-full py-2.5 px-4 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 ${activeMeta.buttonClass}`}
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>
                        {isLoading
                          ? 'সংরক্ষণ হচ্ছে...'
                          : selectedPortal === 'official'
                          ? 'অফিসিয়াল অ্যাকাউন্ট তৈরি ও প্রবেশ'
                          : 'এমপ্লয়ী নিবন্ধন ও ড্যাশবোর্ডে প্রবেশ'}
                      </span>
                    </button>
                  </form>
                )}

                {/* ---------------- SIGN UP / ACTIVATE: STUDENT & GUARDIAN ---------------- */}
                {authMode === 'signup' && selectedPortal === 'student' && (
                  <form onSubmit={handleStudentSignUpSubmit} className="space-y-3.5">
                    <div className="grid grid-cols-2 gap-1.5 bg-emerald-50/70 p-1 rounded-xl border border-emerald-200/80">
                      <button
                        type="button"
                        onClick={() => setStudentSignupMode('activate')}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                          studentSignupMode === 'activate'
                            ? 'bg-emerald-800 text-white'
                            : 'text-emerald-900 hover:bg-white'
                        }`}
                      >
                        পাসওয়ার্ড সেট (নিবন্ধিত শিক্ষার্থী)
                      </button>
                      <button
                        type="button"
                        onClick={() => setStudentSignupMode('new_admission')}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                          studentSignupMode === 'new_admission'
                            ? 'bg-emerald-800 text-white'
                            : 'text-emerald-900 hover:bg-white'
                        }`}
                      >
                        নতুন শিক্ষার্থী আবেদন
                      </button>
                    </div>

                    {studentSignupMode === 'new_admission' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-stone-700 mb-1">
                            শিক্ষার্থীর নাম *
                          </label>
                          <input
                            type="text"
                            value={admStudentName}
                            onChange={(e) => setAdmStudentName(e.target.value)}
                            placeholder="পূর্ণ বাংলা নাম"
                            required
                            className="w-full px-3 py-2 rounded-xl border border-stone-300 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-stone-700 mb-1">
                            পিতা / অভিভাবকের নাম *
                          </label>
                          <input
                            type="text"
                            value={admGuardianName}
                            onChange={(e) => setAdmGuardianName(e.target.value)}
                            placeholder="অভিভাবকের নাম"
                            required
                            className="w-full px-3 py-2 rounded-xl border border-stone-300 text-sm"
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">শ্রেণি *</label>
                        <select
                          value={actClassId}
                          onChange={(e) => setActClassId(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                        >
                          {classes.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nameBn}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                          {studentSignupMode === 'activate' ? 'রোল নম্বর *' : 'প্রত্যাশিত রোল'}
                        </label>
                        <input
                          type="text"
                          value={actRoll}
                          onChange={(e) => setActRoll(e.target.value)}
                          placeholder="যেমন: 1"
                          required={studentSignupMode === 'activate'}
                          className="w-full px-3 py-2 rounded-xl border border-stone-300 text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                          অভিভাবকের মোবাইল *
                        </label>
                        <input
                          type="tel"
                          value={actPhone}
                          onChange={(e) => setActPhone(e.target.value)}
                          placeholder="01XXXXXXXXX"
                          required
                          className="w-full px-3 py-2 rounded-xl border border-stone-300 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                          নতুন পাসওয়ার্ড / পিন *
                        </label>
                        <input
                          type="password"
                          value={actNewPin}
                          onChange={(e) => setActNewPin(e.target.value)}
                          placeholder="কমপক্ষে ৪ অক্ষর"
                          required
                          className="w-full px-3 py-2 rounded-xl border border-stone-300 text-sm"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-2.5 px-4 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>
                        {isLoading
                          ? 'প্রক্রিয়া চলছে...'
                          : studentSignupMode === 'activate'
                          ? 'পাসওয়ার্ড সেট করুন ও ড্যাশবোর্ডে প্রবেশ'
                          : 'অ্যাকাউন্ট আবেদন জমা দিন'}
                      </span>
                    </button>
                  </form>
                )}
              </div>

              {/* Clean Footer Note inside Auth Card */}
              <div className="pt-3 border-t border-stone-100 text-[11px] text-stone-500 flex items-center justify-between">
                <span>প্রত্যেক ব্যবহারকারীর ড্যাশবোর্ড সম্পূর্ণ পৃথক ও সুরক্ষিত</span>
                <span className="font-semibold text-stone-700 tabular-nums">
                  {students.length > 0 ? `${toBengaliRoll(students.length)} জন` : '২০২৬'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Three Dedicated Portal Architecture Overview (Clean Editorial Comparison) */}
        <section id="portal-roles" className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-3 border-b border-stone-200">
            <div>
              <p className="text-xs font-semibold text-stone-500 tracking-wide">স্বতন্ত্র পোর্টাল কাঠামো</p>
              <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#0F1E3D]">
                তিনটি ভূমিকা, তিনটি সম্পূর্ণ আলাদা ও সুরক্ষিত ড্যাশবোর্ড
              </h2>
            </div>
            <p className="text-xs text-stone-500">গোপনীয় আর্থিক ও প্রশাসনিক তথ্য সর্বদা সংরক্ষিত</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <button
              type="button"
              onClick={() => {
                switchPortal('official');
                document.getElementById('portal-auth-box')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-left bg-white p-6 rounded-2xl border border-stone-200 hover:border-[#0F1E3D]/40 transition shadow-xs flex flex-col justify-between space-y-4 cursor-pointer group"
            >
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-[#0F1E3D] text-white flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-serif font-bold text-[#0F1E3D]">
                  ০১. অফিসিয়াল প্রশাসন পোর্টাল
                </h3>
                <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                  দৈনিক ফি আদায় রিপোর্ট, বকেয়া ও খেলাপি তালিকা, স্টাফ ও অ্যাকাউন্ট অনুমোদন, রেজাল্ট ও ট্যাবুল্যাশন, বাল্ক আপলোড এবং সার্ভার ব্যাকআপ নিয়ন্ত্রণ।
                </p>
              </div>
              <span className="text-xs font-bold text-[#0F1E3D] inline-flex items-center gap-1 group-hover:translate-x-1 transition">
                অফিসিয়াল সাইন ইন করুন <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                switchPortal('student');
                document.getElementById('portal-auth-box')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-left bg-white p-6 rounded-2xl border border-stone-200 hover:border-emerald-700/40 transition shadow-xs flex flex-col justify-between space-y-4 cursor-pointer group"
            >
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-800 text-white flex items-center justify-center">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-serif font-bold text-emerald-950">
                  ০২. শিক্ষার্থী ও অভিভাবক পোর্টাল
                </h3>
                <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                  নিজস্ব ছবিযুক্ত ড্যাশবোর্ড, পরীক্ষার অগ্রগতি চার্ট, ভবিষ্যৎ পরিকল্পনা ও কৃতিত্বের গ্যালারি, এবং গেট স্ক্যান হওয়া মাত্রই বাংলা ভয়েস এলার্ম।
                </p>
              </div>
              <span className="text-xs font-bold text-emerald-800 inline-flex items-center gap-1 group-hover:translate-x-1 transition">
                শিক্ষার্থী সাইন ইন করুন <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                switchPortal('employee');
                document.getElementById('portal-auth-box')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-left bg-white p-6 rounded-2xl border border-stone-200 hover:border-teal-700/40 transition shadow-xs flex flex-col justify-between space-y-4 cursor-pointer group"
            >
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-teal-800 text-white flex items-center justify-center">
                  <Briefcase className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-serif font-bold text-teal-950">
                  ০৩. এমপ্লয়ী ও শিক্ষক পোর্টাল
                </h3>
                <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                  দৈনিক স্টাফ হাজিরা চেক-ইন, শ্রেণিভিত্তিক শিক্ষার্থী উপস্থিতি ও মার্ক এন্ট্রি, সিলেবাস, ক্লাস নোট, প্রশ্নপত্র তৈরি ও গেট ক্যামেরা স্ক্যানার।
                </p>
              </div>
              <span className="text-xs font-bold text-teal-800 inline-flex items-center gap-1 group-hover:translate-x-1 transition">
                এমপ্লয়ী সাইন ইন করুন <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </button>
          </div>
        </section>

        {/* Campus Safety & Academic Highlights */}
        <section
          id="academy-security"
          className="bg-white rounded-2xl border border-stone-200 p-6 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-6 shadow-xs"
        >
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-stone-100 text-[#0F1E3D] shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-stone-900">স্মার্ট কিউআর গেটপাস নিরাপত্তা</h4>
              <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                বিদ্যালয়ে প্রবেশ ও প্রস্থানের সময় কার্ড স্ক্যান হলেই কেবল সাইন-ইন থাকা অভিভাবকের ফোনে ভয়েস বার্তা পৌঁছে যায়।
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-stone-100 text-emerald-800 shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-stone-900">ডিজিটাল সিলেবাস ও প্রোগ্রেস</h4>
              <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                বিষয়ভিত্তিক নম্বর বিশ্লেষণ, উপস্থিতির শতকরা হার ও পরীক্ষার ফলাফল শিক্ষার্থী পোর্টালে সংরক্ষিত থাকে।
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-stone-100 text-amber-800 shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-stone-900">সমন্বিত একাডেমিক ক্যালেন্ডার</h4>
              <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                সরকারি ছুটি, সাময়িক পরীক্ষার তারিখ এবং বিশেষ অনুষ্ঠানের সময়সূচি সারাবছর হালনাগাদ রাখা হয়।
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
