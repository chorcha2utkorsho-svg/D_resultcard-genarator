import React, { useEffect, useState } from 'react';
import {
  Briefcase,
  CalendarCheck,
  FileCheck2,
  QrCode,
  BookOpen,
  FileText,
  HelpCircle,
  CalendarDays,
  Clock,
  CheckCircle2,
  ArrowRight,
  Users,
  ShieldCheck,
  LogIn,
  LogOut,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { PortalAuthSession, StaffAccount, StaffAttendanceRecord } from '../types';
import { toBengaliNumber } from '../utils/bengali';

interface EmployeeDashboardViewProps {
  session: PortalAuthSession;
  onNavigate: (tab: string) => void;
}

export const EmployeeDashboardView: React.FC<EmployeeDashboardViewProps> = ({
  session,
  onNavigate,
}) => {
  const { classes, students, syllabi, notes, questionPapers, calendarEvents } = useSchool();

  const [staffProfile, setStaffProfile] = useState<StaffAccount | null>(null);
  const [staffAttendance, setStaffAttendance] = useState<StaffAttendanceRecord[]>([]);
  const [isUpdatingAtt, setIsUpdatingAtt] = useState(false);
  const [attFeedback, setAttFeedback] = useState<string | null>(null);

  const todayIso = new Date().toISOString().split('T')[0];

  useEffect(() => {
    fetch('/api/staff/overview')
      .then((r) => r.json())
      .then((data) => {
        if (data?.success) {
          const accounts: StaffAccount[] = data.staffAccounts || [];
          const mine = accounts.find((a) => a.id === session.accountId) || null;
          setStaffProfile(mine);
          setStaffAttendance(data.staffAttendance || []);
        }
      })
      .catch(() => {});
  }, [session.accountId]);

  const myTodayAttendance = staffAttendance.find(
    (r) => r.staffId === session.accountId && r.date === todayIso
  );

  const myHistory = staffAttendance
    .filter((r) => r.staffId === session.accountId)
    .slice(0, 7);

  const handleSelfAttendance = async (action: 'checkin' | 'checkout') => {
    setIsUpdatingAtt(true);
    setAttFeedback(null);
    try {
      const res = await fetch('/api/staff/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: session.accountId,
          staffNameBn: session.displayName,
          designationBn: session.subLabel,
          action,
        }),
      });
      const data = await res.json();
      if (data?.success) {
        setStaffAttendance(data.staffAttendance || []);
        setAttFeedback(
          action === 'checkin'
            ? '✓ আজকের উপস্থিতি (চেক-ইন) সফলভাবে সংরক্ষিত হয়েছে!'
            : '✓ প্রস্থান (চেক-আউট) সময় সফলভাবে রেকর্ড হয়েছে!'
        );
        setTimeout(() => setAttFeedback(null), 4000);
      }
    } catch {
      setAttFeedback('নেটওয়ার্ক ত্রুটি! আবার চেষ্টা করুন।');
    } finally {
      setIsUpdatingAtt(false);
    }
  };

  const assignedClassIds = staffProfile?.assignedClassIds || classes.map((c) => c.id);
  const assignedClasses = classes.filter((c) => assignedClassIds.includes(c.id));
  const assignedStudentCount = students.filter((s) => assignedClassIds.includes(s.classId)).length;

  const employeeModules = [
    {
      id: 'attendance',
      title: 'শিক্ষার্থী উপস্থিতি ও হাজিরা',
      desc: 'প্রতিদিনের ক্লাস হাজিরা গ্রহণ ও মাসিক উপস্থিতির হার হালনাগাদ',
      icon: CalendarCheck,
      color: 'bg-teal-800 text-white',
    },
    {
      id: 'marks_entry',
      title: 'বিষয়ভিত্তিক মার্ক এন্ট্রি',
      desc: 'সাময়িক ও মাসিক পরীক্ষার নম্বর এন্ট্রি ও সংরক্ষণ',
      icon: FileCheck2,
      color: 'bg-emerald-800 text-white',
    },
    {
      id: 'employee_scanner',
      title: 'স্মার্ট গেটপাস স্ক্যানার',
      desc: 'শিক্ষার্থীর আইডি কার্ড স্ক্যান করে প্রবেশ ও প্রস্থান নিশ্চিতকরণ',
      icon: QrCode,
      color: 'bg-slate-800 text-white',
    },
    {
      id: 'syllabus',
      title: 'সিলেবাস ও মানবণ্টন',
      desc: 'শ্রেণি অনুযায়ী পাঠ্যক্রম নির্ধারণ ও হালনাগাদ',
      icon: BookOpen,
      color: 'bg-cyan-800 text-white',
    },
    {
      id: 'notes',
      title: 'ক্লাস নোট ও লেকচার',
      desc: 'অধ্যায়ভিত্তিক সংক্ষিপ্ত নোট তৈরি ও সংরক্ষণ',
      icon: FileText,
      color: 'bg-indigo-800 text-white',
    },
    {
      id: 'question_papers',
      title: 'প্রশ্নপত্র প্রস্তুতকারক',
      desc: 'সৃজনশীল ও বহুনির্বাচনী পরীক্ষার প্রশ্নপত্র তৈরি',
      icon: HelpCircle,
      color: 'bg-amber-700 text-white',
    },
    {
      id: 'calendar',
      title: 'একাডেমিক ক্যালেন্ডার',
      desc: 'ছুটি, পরীক্ষা ও একাডেমিক কর্মসূচির সময়সূচি',
      icon: CalendarDays,
      color: 'bg-stone-800 text-white',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Employee Identity & Live Daily Check-In Hero */}
      <div className="bg-gradient-to-br from-[#0B3235] via-[#0F4347] to-[#135257] rounded-2xl p-6 sm:p-8 text-white shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
              <Briefcase className="w-7 h-7 text-amber-300" />
            </div>
            <div>
              <div className="text-xs text-teal-200 font-medium">
                এমপ্লয়ী ও শিক্ষক ওয়ার্কস্পেস · আইডি: {session.staffCode || 'DL-EMP'}
              </div>
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white mt-1">
                {session.displayName}
              </h1>
              <p className="text-sm text-teal-100 mt-0.5">{session.subLabel}</p>
              <div className="mt-3 text-xs text-teal-200">
                দায়িত্বপ্রাপ্ত শ্রেণি: {assignedClasses.map((c) => c.nameBn).join(', ') || 'সকল শ্রেণি'}
              </div>
            </div>
          </div>

          {/* Self Attendance Check-in / Check-out Box */}
          <div className="bg-black/25 border border-white/15 rounded-2xl p-4 sm:p-5 min-w-[280px] space-y-3">
            <div className="flex items-center justify-between text-xs text-teal-100">
              <span className="font-semibold flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-300" />
                আমার আজকের স্টাফ হাজিরা
              </span>
              <span className="tabular-nums font-mono">{todayIso}</span>
            </div>

            {myTodayAttendance ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs bg-emerald-950/60 border border-emerald-400/30 rounded-xl px-3 py-2">
                  <span>প্রবেশ (Check-In):</span>
                  <span className="font-bold text-emerald-300 tabular-nums">
                    {myTodayAttendance.checkInTime}
                  </span>
                </div>
                {myTodayAttendance.checkOutTime ? (
                  <div className="flex items-center justify-between text-xs bg-teal-950/60 border border-teal-400/30 rounded-xl px-3 py-2">
                    <span>প্রস্থান (Check-Out):</span>
                    <span className="font-bold text-amber-300 tabular-nums">
                      {myTodayAttendance.checkOutTime}
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isUpdatingAtt}
                    onClick={() => handleSelfAttendance('checkout')}
                    className="w-full py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>ছুটি / চেক-আউট রেকর্ড করুন</span>
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                disabled={isUpdatingAtt}
                onClick={() => handleSelfAttendance('checkin')}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>{isUpdatingAtt ? 'সংরক্ষণ হচ্ছে...' : 'আজকের হাজিরা (Check-In) দিন'}</span>
              </button>
            )}

            {attFeedback && (
              <div className="text-[11px] font-semibold text-amber-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{attFeedback}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Academic & Duty KPI Strip (Non-financial only) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500">দায়িত্বপ্রাপ্ত শ্রেণি</div>
          <div className="text-2xl font-bold text-teal-900 mt-1 tabular-nums">
            {toBengaliNumber(assignedClasses.length)}টি
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500">অন্তর্ভুক্ত শিক্ষার্থী</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {toBengaliNumber(assignedStudentCount)} জন
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500">সিলেবাস ও নোট</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {toBengaliNumber(syllabi.length + notes.length)}টি
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500">প্রশ্নপত্র ও কর্মসূচি</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {toBengaliNumber(questionPapers.length + calendarEvents.length)}টি
          </div>
        </div>
      </div>

      {/* Academic & Gate Modules Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-serif font-bold text-slate-900">
            শিক্ষক ও এমপ্লয়ী কার্যাবলি
          </h2>
          <span className="text-xs text-slate-500">আর্থিক ও প্রশাসনিক রিপোর্ট অফিসিয়াল প্যানেলে সংরক্ষিত</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {employeeModules.map((mod) => {
            const Icon = mod.icon;
            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => onNavigate(mod.id)}
                className="text-left bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:shadow-md hover:border-teal-500/50 transition cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className={`w-10 h-10 rounded-xl ${mod.color} flex items-center justify-center mb-3`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-base text-slate-900 group-hover:text-teal-800 transition">
                    {mod.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{mod.desc}</p>
                </div>
                <div className="pt-4 mt-2 flex items-center text-xs font-bold text-teal-800 group-hover:translate-x-1 transition">
                  প্রবেশ করুন <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recent Self Attendance History + Isolation Note */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <h3 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-teal-700" />
            সাম্প্রতিক স্টাফ হাজিরা রেকর্ড
          </h3>
          {myHistory.length === 0 ? (
            <p className="text-xs text-slate-500 py-4">এখনো কোনো হাজিরা রেকর্ড জমা হয়নি। উপরের চেক-ইন বাটনে ক্লিক করুন।</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-3 font-semibold">তারিখ</th>
                    <th className="py-2 px-3 font-semibold">প্রবেশ</th>
                    <th className="py-2 px-3 font-semibold">প্রস্থান</th>
                    <th className="py-2 pl-3 font-semibold">অবস্থা</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {myHistory.map((row) => (
                    <tr key={row.id}>
                      <td className="py-2.5 pr-3 font-medium text-slate-800">{row.date}</td>
                      <td className="py-2.5 px-3 text-emerald-700 font-semibold">{row.checkInTime}</td>
                      <td className="py-2.5 px-3 text-slate-600">{row.checkOutTime || '—'}</td>
                      <td className="py-2.5 pl-3 text-teal-800 font-semibold">উপস্থিত</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-teal-50/70 rounded-xl border border-teal-200 p-5 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-teal-800 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-sm text-teal-950">ভূমিকা-ভিত্তিক নিরাপত্তা ও গোপনীয়তা</h4>
            <p className="text-xs text-teal-900 leading-relaxed">
              আপনার এমপ্লয়ী পোর্টালে কেবল শ্রেণি পরিচালনা, হাজিরা, নম্বর প্রদান, নোট, প্রশ্নপত্র ও গেটপাস স্ক্যানার সক্রিয় রয়েছে। দৈনিক ফি আদায়, বকেয়া তালিকা ও প্রশাসনিক ব্যাকআপ কেবল অফিসিয়াল অ্যাডমিনের জন্য সংরক্ষিত।
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
