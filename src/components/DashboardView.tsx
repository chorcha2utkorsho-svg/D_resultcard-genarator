import React from 'react';
import {
  GraduationCap,
  FileCheck2,
  Printer,
  TableProperties,
  Users,
  BookOpen,
  HelpCircle,
  FileText,
  Download,
  ShieldCheck,
  Award,
  ArrowRight,
  TrendingUp,
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
import { DashboardWidget } from './DashboardWidget';
import { toBengaliNumber } from '../utils/bengali';

interface DashboardViewProps {
  onNavigate: (tab: string) => void;
  onOpenSettings: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate, onOpenSettings }) => {
  const {
    schoolInfo,
    classes,
    students,
    examTerms,
    syllabi,
    questionPapers,
    notes,
    exportDatabaseBackup,
    selectedYear,
    smsLogs,
    feeInvoices,
    feeReceipts,
  } = useSchool();

  const totalStudents = students.length;
  const totalClasses = classes.length;
  const totalSyllabi = syllabi.length;
  const totalNotes = notes.length;
  const totalQuestionPapers = questionPapers.length;
  const totalDueAmount = feeInvoices.reduce((sum, inv) => sum + (inv.dueAmount || 0), 0);

  const quickActions = [
    {
      id: 'defaulters',
      title: 'ফি খেলাপি তালিকা (৩০+ দিন বকেয়া)',
      desc: 'দীর্ঘমেয়াদী বকেয়া ঋণ পর্যবেক্ষণ, খেলাপি নোটিশ এসএমএস ও ঋণ রিকভারি খতিয়ান',
      icon: ShieldAlert,
      color: 'bg-rose-700 text-white',
      badge: '৩০+ দিন খেলাপি',
    },
    {
      id: 'daily_report',
      title: 'দৈনিক ফি আদায় ও বকেয়া খতিয়ান',
      desc: 'আজকের মোট ফি আদায়, নগদ ও অনলাইন জমার হিসাব, খাতভিত্তিক আয় ও এ৪ সমাপনী প্রিন্ট',
      icon: Receipt,
      color: 'bg-teal-700 text-white',
      badge: 'দৈনিক রিপোর্ট ও ক্যাশ',
    },
    {
      id: 'fees',
      title: 'বকেয়া ও ফি আদায় (মানি রিসিট ও ডিউ স্লিপ)',
      desc: 'শিক্ষার্থীদের বকেয়া তথ্য, তাৎক্ষণিক পেমেন্ট কর্তন, অফিশিয়াল মানি রিসিট ও ডিউ স্লিপ প্রিন্ট',
      icon: CreditCard,
      color: 'bg-emerald-600 text-white',
      badge: 'বকেয়া ও মানি রিসিট',
    },
    {
      id: 'subjects',
      title: 'বিষয় ব্যবস্থাপনা',
      desc: 'শ্রেণি অনুযায়ী বিষয় যোগ, সম্পাদনা, পূর্ণমান ও ২০% মাসিক পরীক্ষা নির্ধারণ',
      icon: BookMarked,
      color: 'bg-blue-600 text-white',
      badge: 'ডায়নামিক সিঙ্ক',
    },
    {
      id: 'marks_entry',
      title: 'মার্ক এন্ট্রি ফরম',
      desc: 'পরীক্ষার খাতা দেখার পর বিষয়ভিত্তিক নম্বর এন্ট্রি করুন',
      icon: FileCheck2,
      color: 'bg-indigo-600 text-white',
      badge: '৮০% ও ২০% হিসাব',
    },
    {
      id: 'results',
      title: 'রেজাল্ট কার্ড ও পারফরম্যান্স চার্ট',
      desc: 'একক বা সকল কার্ড প্রিন্ট এবং ড্যাশবোর্ড চার্টে বিষয়ভিত্তিক পারফরম্যান্স বিশ্লেষণ',
      icon: Printer,
      color: 'bg-emerald-600 text-white',
      badge: 'কার্ড ও ডেটা ভিজ্যুয়ালাইজেশন',
    },
    {
      id: 'sms',
      title: 'এসএমএস নোটিফিকেশন',
      desc: 'অভিভাবকদের কাছে পরীক্ষার ফলাফল সামারি ও নোটিশ সরাসরি পাঠান',
      icon: MessageSquare,
      color: 'bg-teal-600 text-white',
      badge: 'স্বয়ংক্রিয় ফলাফল এসএমএস',
    },
    {
      id: 'tabulation',
      title: 'ট্যাবুল্যাশন শিট',
      desc: 'সকল শিক্ষার্থীর বিষয়ভিত্তিক নম্বর ও মেধাক্রম মাস্টার শিট',
      icon: TableProperties,
      color: 'bg-purple-600 text-white',
      badge: 'Excel (.xlsx) ও প্রিন্ট',
    },
    {
      id: 'attendance',
      title: 'শিক্ষার্থী হাজিরা ও পারফরম্যান্স মেট্রিক্স',
      desc: 'দৈনিক ডিজিটাল হাজিরা এন্ট্রি, মাসিক শিট এবং প্রোগ্রেস কার্ডে উপস্থিতির স্বয়ংক্রিয় মেট্রিক্স',
      icon: CalendarCheck,
      color: 'bg-teal-600 text-white',
      badge: 'দৈনিক ও মাসিক রিপোর্ট',
    },
    {
      id: 'calendar',
      title: 'একাডেমিক ক্যালেন্ডার ও শিক্ষাপঞ্জি',
      desc: 'পরীক্ষার সময়সূচি, সরকারি ও ধর্মীয় ছুটি, ফলাফল প্রকাশ এবং বার্ষিক অনুষ্ঠান ব্যবস্থাপনা',
      icon: CalendarDays,
      color: 'bg-indigo-700 text-white',
      badge: 'গ্রিড ও সময়সূচি',
    },
    {
      id: 'students',
      title: 'শিক্ষার্থী তথ্য ও বাল্ক আপলোড',
      desc: 'এক্সেল/সিএসভি থেকে সকল শ্রেণির তথ্য এক ক্লিকে আপলোড',
      icon: Users,
      color: 'bg-amber-600 text-white',
      badge: 'এক্সেল সাপোর্ট',
    },
    {
      id: 'question_papers',
      title: 'প্রশ্নপত্র প্রস্তুতকারক',
      desc: 'সৃজনশীল, বহুনির্বাচনী ও সংক্ষিপ্ত প্রশ্নপত্র জেনারেট করুন',
      icon: HelpCircle,
      color: 'bg-blue-600 text-white',
      badge: 'স্কুল স্ট্যান্ডার্ড',
    },
    {
      id: 'syllabus',
      title: 'সিলেবাস ও মানবণ্টন',
      desc: 'সাময়িক ও বার্ষিক পরীক্ষার বিষয়ভিত্তিক পাঠ্যক্রম ও মানবণ্টন',
      icon: BookOpen,
      color: 'bg-rose-600 text-white',
      badge: 'প্রিন্ট উপযোগী',
    },
  ];

  return (
    <div className="space-y-6">
      {/* School Welcome Hero Card */}
      <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-blue-950 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <div className="bg-white p-2 rounded-full shadow-lg flex-shrink-0">
            <SchoolLogo customLogoUrl={schoolInfo.logoUrl} size={100} />
          </div>

          <div className="text-center sm:text-left space-y-1.5 flex-1">
            <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-400 text-slate-950 mb-1">
              {schoolInfo.established || 'স্থাপিত:২০১৮'} • শিক্ষাবর্ষ {toBengaliNumber(selectedYear)} ইং
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-serif text-amber-300">
              {schoolInfo.name || 'ডি-লিকন মডেল একাডেমী'}
            </h1>
            <p className="text-sm text-indigo-200">
              {schoolInfo.address || 'দক্ষিণগাঁও, গণি মার্কেট, সনমানিয়া, কাপাসিয়া, গাজীপুর।'}
            </p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-indigo-200 pt-1">
              <span>মোবাইল: {toBengaliNumber(schoolInfo.phone)}</span>
              <span>•</span>
              <span>ই-মেইল: {schoolInfo.email}</span>
            </div>

            <div className="pt-4 flex flex-wrap gap-2.5 justify-center sm:justify-start">
              <button
                onClick={() => onNavigate('daily_report')}
                className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition"
              >
                <Receipt className="w-4 h-4 mr-1.5 text-amber-300" />
                দৈনিক আদায় রিপোর্ট
              </button>
              <button
                onClick={() => onNavigate('marks_entry')}
                className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-md transition"
              >
                <FileCheck2 className="w-4 h-4 mr-1.5" />
                মার্ক এন্ট্রি শুরু করুন
              </button>
              <button
                onClick={() => onNavigate('results')}
                className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition backdrop-blur-sm"
              >
                <Printer className="w-4 h-4 mr-1.5 text-amber-400" />
                রেজাল্ট কার্ড দেখুন
              </button>
              <button
                onClick={() => onNavigate('bulk_upload')}
                className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition backdrop-blur-sm cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 mr-1.5 text-amber-300" />
                বাল্ক শিক্ষার্থী আপলোড
              </button>
              <button
                onClick={exportDatabaseBackup}
                className="inline-flex items-center px-3.5 py-2 rounded-lg text-xs font-medium bg-emerald-700/80 hover:bg-emerald-600 text-white transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                ডাটাবেস ব্যাকআপ
              </button>
            </div>
          </div>
        </div>

        {/* Decorative backdrop shapes */}
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute right-1/4 -top-12 w-48 h-48 bg-blue-500/20 rounded-full blur-2xl pointer-events-none"></div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3.5">
          <div className="p-3 bg-blue-50 text-blue-700 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">নিবন্ধিত শিক্ষার্থী</div>
            <div className="text-2xl font-bold text-slate-900 font-serif">
              {toBengaliNumber(totalStudents)} জন
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3.5">
          <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">মোট শ্রেণি</div>
            <div className="text-2xl font-bold text-slate-900 font-serif">
              {toBengaliNumber(totalClasses)}টি
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3.5">
          <div className="p-3 bg-purple-50 text-purple-700 rounded-xl">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">নির্ধারিত সিলেবাস</div>
            <div className="text-2xl font-bold text-slate-900 font-serif">
              {toBengaliNumber(totalSyllabi)}টি
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3.5">
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">তৈরিকৃত প্রশ্নপত্র</div>
            <div className="text-2xl font-bold text-slate-900 font-serif">
              {toBengaliNumber(totalQuestionPapers)}টি
            </div>
          </div>
        </div>
      </div>

      {/* Student Performance Trends Widget (Recharts) */}
      <DashboardWidget onNavigate={onNavigate} />

      {/* Main Core Modules Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900 font-serif flex items-center">
            <Award className="w-5 h-5 mr-2 text-indigo-600" />
            প্রধান কার্যাবলি ও ফিচারসমূহ
          </h2>
          <span className="text-xs text-slate-500">ডেস্কটপ ও মোবাইল উভয় প্লাটফর্মেই সমান উপযোগী</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <div
                key={action.id}
                onClick={() => onNavigate(action.id)}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-indigo-300 transition cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2.5 rounded-xl ${action.color} shadow-sm`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {action.badge}
                    </span>
                  </div>
                  <h3 className="font-bold text-base text-slate-900 group-hover:text-indigo-600 transition font-serif">
                    {action.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{action.desc}</p>
                </div>

                <div className="pt-4 mt-2 flex items-center text-xs font-bold text-indigo-600 group-hover:translate-x-1 transition">
                  প্রবেশ করুন <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Database Security & How-to Box */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-5 border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-start space-x-3.5">
          <div className="p-2.5 bg-emerald-600 text-white rounded-xl flex-shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-emerald-950 text-sm">
              ডাটাবেসের নিরাপত্তা ও স্বয়ংক্রিয় ব্যাকআপ ব্যবস্থা
            </h4>
            <p className="text-xs text-emerald-800 mt-0.5">
              সকল ডাটা অফলাইনে সম্পূর্ণ নিরাপদে সংরক্ষিত থাকে। প্রতি সপ্তাহ বা পরীক্ষার পর &quot;ব্যাকআপ ডাউনলোড&quot; বাটনে ক্লিক করে ব্যাকআপ ফাইলটি সংরক্ষণ করে রাখুন।
            </p>
          </div>
        </div>

        <button
          onClick={onOpenSettings}
          className="whitespace-nowrap px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-xs transition"
        >
          সেটিংস ও স্বাক্ষর কনফিগার করুন
        </button>
      </div>
    </div>
  );
};
