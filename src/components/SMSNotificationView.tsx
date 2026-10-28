import React, { useState, useMemo } from 'react';
import {
  MessageSquare,
  Send,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Clock,
  Settings,
  Filter,
  Users,
  Search,
  RefreshCw,
  Copy,
  ExternalLink,
  ShieldCheck,
  Check,
  Trash2,
  Download,
  Phone,
  FileText,
  HelpCircle,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import {
  calculateSMSLength,
  createDeviceSmsUrl,
  createWhatsAppUrl,
  formatPhoneNumber,
  generateResultSMS,
  isValidBDMobile,
  DEFAULT_SMS_TEMPLATES,
} from '../utils/smsHelper';
import { toBengaliNumber, toBengaliOrdinal, toBengaliRoll } from '../utils/bengali';
import { SMSLog } from '../types';

export const SMSNotificationView: React.FC = () => {
  const {
    schoolInfo,
    classes,
    examTerms,
    students,
    selectedYear,
    setSelectedYear,
    selectedExamId,
    setSelectedExamId,
    selectedClassId,
    setSelectedClassId,
    selectedSection,
    setSelectedSection,
    getCalculatedResultsForClass,
    smsLogs,
    addSMSLog,
    deleteSMSLog,
    clearSMSLogs,
    smsGatewayConfig,
    updateSMSGatewayConfig,
    sendSingleSMS,
    sendBatchSMS,
    updateStudent,
  } = useSchool();

  const [activeTab, setActiveTab] = useState<'results' | 'notices' | 'quick' | 'logs' | 'settings'>('results');

  // Notification / Alert Banner state
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Result SMS Tab state
  const [resultFilter, setResultFilter] = useState<'all' | 'passed' | 'failed' | 'hasPhone'>('all');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isSendingBatch, setIsSendingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [editingPhoneStudentId, setEditingPhoneStudentId] = useState<string | null>(null);
  const [tempPhoneInput, setTempPhoneInput] = useState('');
  const [previewStudentResult, setPreviewStudentResult] = useState<any | null>(null);

  // Notice Tab state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(DEFAULT_SMS_TEMPLATES[0].id);
  const [noticeText, setNoticeText] = useState<string>(DEFAULT_SMS_TEMPLATES[0].body);
  const [targetAudience, setTargetAudience] = useState<'all' | 'selected_class'>('selected_class');
  const [noticeSearch, setNoticeSearch] = useState('');

  // Quick SMS Tab state
  const [quickPhone, setQuickPhone] = useState('');
  const [quickName, setQuickName] = useState('');
  const [quickMessage, setQuickMessage] = useState('');

  // Settings Tab state
  const [gatewayProvider, setGatewayProvider] = useState(smsGatewayConfig.provider);
  const [gatewayApiKey, setGatewayApiKey] = useState(smsGatewayConfig.apiKey || '');
  const [gatewaySenderId, setGatewaySenderId] = useState(smsGatewayConfig.senderId || 'DLIKON_MA');
  const [gatewayWebhook, setGatewayWebhook] = useState(smsGatewayConfig.webhookUrl || '');
  const [testPhone, setTestPhone] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);

  // Logs Tab filter
  const [logFilterType, setLogFilterType] = useState<'all' | 'result' | 'notice' | 'custom'>('all');
  const [logSearchQuery, setLogSearchQuery] = useState('');

  // Calculate current class results
  const classResults = useMemo(() => {
    return getCalculatedResultsForClass(
      selectedClassId,
      selectedSection,
      selectedExamId,
      selectedYear
    );
  }, [selectedClassId, selectedSection, selectedExamId, selectedYear, getCalculatedResultsForClass]);

  const currentClass = classes.find((c) => c.id === selectedClassId) || classes[0];
  const currentExam = examTerms.find((e) => e.id === selectedExamId) || examTerms[0];

  // Filtered results
  const filteredResults = useMemo(() => {
    return classResults.filter((r) => {
      if (resultFilter === 'passed') return r.isPassed;
      if (resultFilter === 'failed') return !r.isPassed;
      if (resultFilter === 'hasPhone') return Boolean(r.student.guardianPhone && isValidBDMobile(r.student.guardianPhone));
      return true;
    });
  }, [classResults, resultFilter]);

  // Sync selectedStudentIds when class or filter changes
  React.useEffect(() => {
    setSelectedStudentIds(filteredResults.map((r) => r.student.id));
  }, [selectedClassId, selectedSection, selectedExamId, selectedYear, resultFilter, classResults.length]);

  const showAlert = (type: 'success' | 'error' | 'info', text: string) => {
    setAlertMsg({ type, text });
    setTimeout(() => {
      setAlertMsg(null);
    }, 4000);
  };

  // Select all or deselect all
  const handleSelectAllResults = (checked: boolean) => {
    if (checked) {
      setSelectedStudentIds(filteredResults.map((r) => r.student.id));
    } else {
      setSelectedStudentIds([]);
    }
  };

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  // Quick save inline phone number
  const handleSavePhone = (studentId: string) => {
    const student = students.find((s) => s.id === studentId);
    if (student) {
      updateStudent({
        ...student,
        guardianPhone: formatPhoneNumber(tempPhoneInput),
      });
      showAlert('success', 'অভিভাবকের মোবাইল নম্বর আপডেট করা হয়েছে!');
    }
    setEditingPhoneStudentId(null);
  };

  // Send Single Student Result SMS
  const handleSendSingleResultSMS = async (result: any, channel: 'device_sms' | 'whatsapp' | 'gateway') => {
    const phone = result.student.guardianPhone;
    if (!phone || !isValidBDMobile(phone)) {
      showAlert('error', `${result.student.nameBn}-এর সঠিক মোবাইল নম্বর পাওয়া যায়নি!`);
      return;
    }

    const messageText = generateResultSMS(
      result,
      schoolInfo,
      currentClass.nameBn,
      currentExam.nameBn
    );

    const res = await sendSingleSMS(phone, messageText, `${result.student.nameBn} (অভিভাবক)`, {
      roll: result.student.roll,
      className: currentClass.nameBn,
      messageType: 'result',
      channel,
    });

    if (res.success) {
      showAlert('success', res.message);
    } else {
      showAlert('error', res.message);
    }
  };

  // Send Batch Result SMS
  const handleSendBatchResultSMS = async () => {
    const selectedItems = classResults.filter((r) => selectedStudentIds.includes(r.student.id));
    const validItems = selectedItems.filter((r) => r.student.guardianPhone && isValidBDMobile(r.student.guardianPhone));

    if (validItems.length === 0) {
      showAlert('error', 'নির্বাচিত শিক্ষার্থীদের মধ্যে কোনো বৈধ অভিভাবক মোবাইল নম্বর পাওয়া যায়নি!');
      return;
    }

    if (smsGatewayConfig.provider === 'device_sms') {
      showAlert(
        'info',
        'স্মার্টফোন মোডে প্রতিটি এসএমএস ডিভাইসের নিজস্ব অ্যাপে খুলবে। সকল অভিভাবকের কাছে সরাসরি ব্যাকগ্রাউন্ডে পাঠাতে গেটওয়ে সেটিংস ব্যবহার করুন।'
      );
    }

    setIsSendingBatch(true);
    setBatchProgress({ current: 0, total: validItems.length });

    const batchData = validItems.map((r) => ({
      phone: r.student.guardianPhone!,
      text: generateResultSMS(r, schoolInfo, currentClass.nameBn, currentExam.nameBn),
      recipientName: `${r.student.nameBn} (অভিভাবক)`,
      roll: r.student.roll,
      className: currentClass.nameBn,
    }));

    const result = await sendBatchSMS(batchData, 'result');

    setIsSendingBatch(false);
    setBatchProgress(null);
    showAlert('success', `সফলভাবে ${toBengaliNumber(result.sentCount)} জন অভিভাবককে পরীক্ষার ফলাফল প্রেরণ করা হয়েছে!`);
  };

  // Send Notice Batch
  const handleSendNotice = async () => {
    if (!noticeText.trim()) {
      showAlert('error', 'অনুগ্রহ করে নোটিশের বার্তা লিখুন!');
      return;
    }

    let targetStudents = students;
    if (targetAudience === 'selected_class') {
      targetStudents = students.filter((s) => s.classId === selectedClassId);
    }

    const validStudents = targetStudents.filter((s) => s.guardianPhone && isValidBDMobile(s.guardianPhone));

    if (validStudents.length === 0) {
      showAlert('error', 'নির্বাচিত শ্রেণির কোনো শিক্ষার্থীর অভিভাবকের বৈধ মোবাইল নম্বর নেই!');
      return;
    }

    setIsSendingBatch(true);
    const batchData = validStudents.map((s) => {
      const className = classes.find((c) => c.id === s.classId)?.nameBn || '';
      const personalizedText = noticeText
        .replace('{STUDENT_NAME}', s.nameBn)
        .replace('{CLASS}', className)
        .replace('{ROLL}', toBengaliRoll(s.roll));

      return {
        phone: s.guardianPhone!,
        text: personalizedText,
        recipientName: `${s.nameBn} (অভিভাবক)`,
        roll: s.roll,
        className,
      };
    });

    const result = await sendBatchSMS(batchData, 'notice');
    setIsSendingBatch(false);
    showAlert('success', `সফলভাবে ${toBengaliNumber(result.sentCount)} জন অভিভাবকের কাছে নোটিশ প্রেরিত হয়েছে!`);
  };

  // Quick Direct SMS
  const handleSendQuickSMS = async (channel: 'device_sms' | 'whatsapp' | 'gateway') => {
    if (!quickPhone || !isValidBDMobile(quickPhone)) {
      showAlert('error', 'অনুগ্রহ করে সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন!');
      return;
    }
    if (!quickMessage.trim()) {
      showAlert('error', 'মেসেজের বিবরণ লিখুন!');
      return;
    }

    const res = await sendSingleSMS(quickPhone, quickMessage, quickName || 'অভিভাবক', {
      messageType: 'custom',
      channel,
    });

    if (res.success) {
      showAlert('success', res.message);
      setQuickMessage('');
      setQuickPhone('');
      setQuickName('');
    } else {
      showAlert('error', res.message);
    }
  };

  // Save Gateway Settings
  const handleSaveSettings = () => {
    updateSMSGatewayConfig({
      provider: gatewayProvider,
      apiKey: gatewayApiKey,
      senderId: gatewaySenderId,
      webhookUrl: gatewayWebhook,
    });
    showAlert('success', 'এসএমএস গেটওয়ে সেটিংস সফলভাবে সংরক্ষণ করা হয়েছে!');
  };

  // Test SMS Send
  const handleSendTestSMS = async () => {
    if (!testPhone || !isValidBDMobile(testPhone)) {
      showAlert('error', 'অনুগ্রহ করে পরীক্ষার জন্য একটি সঠিক মোবাইল নম্বর দিন!');
      return;
    }

    setIsSendingTest(true);
    const res = await sendSingleSMS(
      testPhone,
      `ডি-লিকন মডেল একাডেমী: এটি একটি টেস্ট এসএমএস। গেটওয়ে সক্রিয় আছে। ধন্যবাদ।`,
      'টেস্ট ইউজার',
      { messageType: 'custom', channel: gatewayProvider === 'device_sms' ? 'device_sms' : 'gateway' }
    );
    setIsSendingTest(false);
    if (res.success) {
      showAlert('success', res.message);
    } else {
      showAlert('error', res.message);
    }
  };

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return smsLogs.filter((log) => {
      if (logFilterType !== 'all' && log.messageType !== logFilterType) return false;
      if (logSearchQuery.trim()) {
        const q = logSearchQuery.toLowerCase();
        return (
          log.recipientPhone.includes(q) ||
          log.recipientName.toLowerCase().includes(q) ||
          log.messageText.toLowerCase().includes(q) ||
          (log.className && log.className.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [smsLogs, logFilterType, logSearchQuery]);

  // Export logs to CSV
  const handleExportLogsCSV = () => {
    const headers = ['Recipient Name', 'Phone', 'Class', 'Roll', 'Type', 'Message', 'Channel', 'Status', 'Date'];
    const rows = filteredLogs.map((l) => [
      `"${l.recipientName}"`,
      `"${l.recipientPhone}"`,
      `"${l.className || ''}"`,
      `"${l.studentRoll || ''}"`,
      `"${l.messageType}"`,
      `"${l.messageText.replace(/"/g, '""')}"`,
      `"${l.channel}"`,
      `"${l.status}"`,
      `"${l.sentAt}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `dlikon_sms_logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Notice length info
  const noticeLengthInfo = useMemo(() => calculateSMSLength(noticeText), [noticeText]);
  const quickLengthInfo = useMemo(() => calculateSMSLength(quickMessage), [quickMessage]);

  // Count parents with valid phone
  const totalStudentsWithPhone = students.filter((s) => s.guardianPhone && isValidBDMobile(s.guardianPhone)).length;

  return (
    <div className="space-y-6 pb-12">
      {/* Alert Notification Toast */}
      {alertMsg && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center p-4 rounded-xl shadow-2xl transition-all duration-300 border text-sm max-w-md ${
            alertMsg.type === 'success'
              ? 'bg-emerald-800 text-white border-emerald-600'
              : alertMsg.type === 'error'
              ? 'bg-rose-800 text-white border-rose-600'
              : 'bg-indigo-800 text-white border-indigo-600'
          }`}
        >
          {alertMsg.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 mr-3 flex-shrink-0 text-emerald-300" />
          ) : alertMsg.type === 'error' ? (
            <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0 text-rose-300" />
          ) : (
            <HelpCircle className="w-5 h-5 mr-3 flex-shrink-0 text-indigo-300" />
          )}
          <span className="font-medium">{alertMsg.text}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-indigo-950 rounded-2xl shadow-xl p-6 sm:p-8 text-white border border-indigo-700/50">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-400/20 text-amber-300 border border-amber-400/30">
              <Smartphone className="w-3.5 h-3.5 mr-1.5" />
              স্মার্ট অভিভাবক যোগাযোগ মডিউল
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-serif text-white">
              এসএমএস নোটিফিকেশন ও নোটিশ মডিউল
            </h1>
            <p className="text-indigo-200 text-sm max-w-2xl">
              পরীক্ষা শেষে শিক্ষকদের মার্ক এন্ট্রি অনুযায়ী স্বয়ংক্রিয়ভাবে তৈরি হওয়া ফলাফল সামারি ও জরুরি স্কুল নোটিশ সরাসরি অভিভাবকদের মোবাইল নম্বরে প্রেরণ করুন।
            </p>
          </div>

          {/* Quick Stats Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-indigo-950/60 p-4 rounded-xl border border-indigo-800/80 backdrop-blur-sm">
            <div className="text-center p-2">
              <span className="text-[11px] text-indigo-300 font-medium block">প্রেরিত এসএমএস</span>
              <span className="text-xl font-bold text-amber-300 font-serif">
                {toBengaliNumber(smsLogs.length)} টি
              </span>
            </div>
            <div className="text-center p-2 border-l border-indigo-800">
              <span className="text-[11px] text-indigo-300 font-medium block">অভিভাবক ফোন</span>
              <span className="text-xl font-bold text-emerald-300 font-serif">
                {toBengaliNumber(totalStudentsWithPhone)} / {toBengaliNumber(students.length)}
              </span>
            </div>
            <div className="text-center p-2 col-span-2 sm:col-span-1 border-t sm:border-t-0 sm:border-l border-indigo-800">
              <span className="text-[11px] text-indigo-300 font-medium block">গেটওয়ে মোড</span>
              <span className="text-xs font-semibold text-white px-2 py-0.5 rounded bg-indigo-700/60 inline-block mt-1">
                {smsGatewayConfig.provider === 'device_sms' ? '📱 মোবাইল SIM' : '🌐 API গেটওয়ে'}
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation Menu */}
        <div className="flex items-center space-x-2 mt-8 overflow-x-auto pb-1 scrollbar-none border-b border-indigo-800/60">
          <button
            onClick={() => setActiveTab('results')}
            className={`flex items-center px-4 py-2.5 rounded-t-xl text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'results'
                ? 'bg-white text-indigo-950 border-amber-400 shadow-lg'
                : 'text-indigo-200 hover:text-white hover:bg-indigo-800/40 border-transparent'
            }`}
          >
            <MessageSquare className="w-4 h-4 mr-2 text-amber-400" />
            ফলাফল সামারি এসএমএস
          </button>

          <button
            onClick={() => setActiveTab('notices')}
            className={`flex items-center px-4 py-2.5 rounded-t-xl text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'notices'
                ? 'bg-white text-indigo-950 border-amber-400 shadow-lg'
                : 'text-indigo-200 hover:text-white hover:bg-indigo-800/40 border-transparent'
            }`}
          >
            <FileText className="w-4 h-4 mr-2 text-blue-400" />
            স্কুল নোটিশ ও বিজ্ঞপ্তি
          </button>

          <button
            onClick={() => setActiveTab('quick')}
            className={`flex items-center px-4 py-2.5 rounded-t-xl text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'quick'
                ? 'bg-white text-indigo-950 border-amber-400 shadow-lg'
                : 'text-indigo-200 hover:text-white hover:bg-indigo-800/40 border-transparent'
            }`}
          >
            <Send className="w-4 h-4 mr-2 text-emerald-400" />
            তাৎক্ষণিক সরাসরি এসএমএস
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center px-4 py-2.5 rounded-t-xl text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'logs'
                ? 'bg-white text-indigo-950 border-amber-400 shadow-lg'
                : 'text-indigo-200 hover:text-white hover:bg-indigo-800/40 border-transparent'
            }`}
          >
            <Clock className="w-4 h-4 mr-2 text-purple-400" />
            এসএমএস লগ ({toBengaliNumber(smsLogs.length)})
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center px-4 py-2.5 rounded-t-xl text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'settings'
                ? 'bg-white text-indigo-950 border-amber-400 shadow-lg'
                : 'text-indigo-200 hover:text-white hover:bg-indigo-800/40 border-transparent'
            }`}
          >
            <Settings className="w-4 h-4 mr-2 text-slate-300" />
            গেটওয়ে ও সেটিংস
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: RESULT SUMMARY SMS                                                 */}
      {/* ========================================================================= */}
      {activeTab === 'results' && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">শিক্ষাবর্ষ</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="২০২৬">২০২৬</option>
                  <option value="২০২৫">২০২৫</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">পরীক্ষার নাম</label>
                <select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                >
                  {examTerms.map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.nameBn}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">শ্রেণি</label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                >
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.nameBn}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">শাখা</label>
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ক">শাখা: ক</option>
                  <option value="খ">শাখা: খ</option>
                  <option value="গ">শাখা: গ</option>
                </select>
              </div>
            </div>

            {/* Sub-Filters and Batch Actions */}
            <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-slate-500">ফিল্টার:</span>
                <div className="inline-flex bg-slate-100 p-0.5 rounded-lg text-xs">
                  <button
                    onClick={() => setResultFilter('all')}
                    className={`px-3 py-1.5 rounded-md font-medium transition ${
                      resultFilter === 'all' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    সকল ({toBengaliNumber(classResults.length)})
                  </button>
                  <button
                    onClick={() => setResultFilter('passed')}
                    className={`px-3 py-1.5 rounded-md font-medium transition ${
                      resultFilter === 'passed' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    উত্তীর্ণ
                  </button>
                  <button
                    onClick={() => setResultFilter('failed')}
                    className={`px-3 py-1.5 rounded-md font-medium transition ${
                      resultFilter === 'failed' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    অনুত্তীর্ণ
                  </button>
                  <button
                    onClick={() => setResultFilter('hasPhone')}
                    className={`px-3 py-1.5 rounded-md font-medium transition ${
                      resultFilter === 'hasPhone' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    মোবাইল নম্বর আছে
                  </button>
                </div>
              </div>

              {/* Batch Send Button */}
              <div className="flex items-center space-x-3">
                <button
                  disabled={isSendingBatch || selectedStudentIds.length === 0}
                  onClick={handleSendBatchResultSMS}
                  className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <Send className="w-4 h-4 mr-2" />
                  নির্বাচিত {toBengaliNumber(selectedStudentIds.length)} জনকে ফলাফল এসএমএস পাঠান
                </button>
              </div>
            </div>
          </div>

          {/* Result SMS Template Preview Card */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-200 text-amber-900">
                  স্বয়ংক্রিয় এসএমএস ফরম্যাট
                </span>
                <span className="text-xs text-amber-800 font-medium">
                  (প্রতিটি শিক্ষার্থীর রোল, মোট নম্বর, GPA, গ্রেড ও মেধাক্রম অনুযায়ী স্বয়ংক্রিয় পরিবর্তনশীল)
                </span>
              </div>
              <p className="text-xs text-slate-700 font-mono bg-white p-2.5 rounded-lg border border-amber-200/80">
                {schoolInfo.name}: প্রিয় অভিভাবক, আপনার সন্তান [নাম] (রোল: [রোল], {currentClass.nameBn}), {currentExam.nameBn}-এ মোট নম্বর: [মোট]/[পূর্ণমান], GPA: [জিপিএ] (গ্রেড: [গ্রেড]), মেধাক্রম: [মেধাক্রম] ([পাস/ফেল])। বিস্তারিত প্রোগ্রেস কার্ড স্কুলে সংরক্ষিত। - প্রধান শিক্ষক।
              </p>
            </div>
          </div>

          {/* Student List Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="select_all_results"
                  checked={selectedStudentIds.length === filteredResults.length && filteredResults.length > 0}
                  onChange={(e) => handleSelectAllResults(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                />
                <label htmlFor="select_all_results" className="text-sm font-bold text-slate-700 cursor-pointer">
                  {currentClass.nameBn} - শাখা: {selectedSection} ({toBengaliNumber(filteredResults.length)} জন শিক্ষার্থী)
                </label>
              </div>
              <span className="text-xs text-slate-500">
                নির্বাচিত: <strong className="text-indigo-600">{toBengaliNumber(selectedStudentIds.length)}</strong> জন
              </span>
            </div>

            {filteredResults.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Users className="w-12 h-12 mx-auto mb-2 opacity-40" />
                <p>এই ফিল্টারে কোনো শিক্ষার্থী পাওয়া যায়নি</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4 w-10"></th>
                      <th className="py-3 px-4">রোল</th>
                      <th className="py-3 px-4">শিক্ষার্থীর নাম</th>
                      <th className="py-3 px-4 text-center">মোট নম্বর</th>
                      <th className="py-3 px-4 text-center">GPA</th>
                      <th className="py-3 px-4 text-center">গ্রেড</th>
                      <th className="py-3 px-4 text-center">মেধাক্রম</th>
                      <th className="py-3 px-4">অভিভাবক ফোন নম্বর</th>
                      <th className="py-3 px-4 text-right">এসএমএস প্রেরণ অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredResults.map((result) => {
                      const isSelected = selectedStudentIds.includes(result.student.id);
                      const hasValidPhone = Boolean(
                        result.student.guardianPhone && isValidBDMobile(result.student.guardianPhone)
                      );
                      const isEditingPhone = editingPhoneStudentId === result.student.id;

                      return (
                        <tr key={result.student.id} className={`hover:bg-indigo-50/40 transition ${isSelected ? 'bg-indigo-50/20' : ''}`}>
                          <td className="py-3 px-4">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleStudentSelection(result.student.id)}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                            />
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-700">
                            {toBengaliRoll(result.student.roll)}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-900">
                            <div>{result.student.nameBn}</div>
                            {result.student.fatherName && (
                              <div className="text-[11px] text-slate-400">পিতা: {result.student.fatherName}</div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center font-semibold text-slate-800">
                            {toBengaliNumber(result.grandTotalObtained)}
                            <span className="text-[11px] text-slate-400 font-normal"> / {toBengaliNumber(result.totalFullMarks)}</span>
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-indigo-700">
                            {toBengaliNumber(result.gpa.toFixed(2))}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                                result.overallGrade === 'F'
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {result.overallGrade}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-medium text-amber-700">
                            {result.meritPositionBn || toBengaliOrdinal(result.meritPosition)}
                          </td>
                          <td className="py-3 px-4">
                            {isEditingPhone ? (
                              <div className="flex items-center space-x-1">
                                <input
                                  type="text"
                                  value={tempPhoneInput}
                                  onChange={(e) => setTempPhoneInput(e.target.value)}
                                  placeholder="01XXXXXXXXX"
                                  className="w-32 text-xs px-2 py-1 border border-indigo-400 rounded focus:ring-1 focus:ring-indigo-500"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleSavePhone(result.student.id)}
                                  className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                                  title="সংরক্ষণ"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2">
                                {hasValidPhone ? (
                                  <span className="font-mono text-xs text-slate-700 font-medium">
                                    {result.student.guardianPhone}
                                  </span>
                                ) : (
                                  <span className="text-xs text-rose-500 font-medium flex items-center">
                                    <AlertCircle className="w-3 h-3 mr-1" /> নম্বর নেই
                                  </span>
                                )}
                                <button
                                  onClick={() => {
                                    setEditingPhoneStudentId(result.student.id);
                                    setTempPhoneInput(result.student.guardianPhone || '');
                                  }}
                                  className="text-[11px] text-indigo-600 hover:underline"
                                >
                                  {hasValidPhone ? 'বদলান' : 'যোগ করুন'}
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              {/* Direct Mobile SMS link */}
                              <button
                                onClick={() => handleSendSingleResultSMS(result, 'device_sms')}
                                title="ফোনের মেসেজ অ্যাপে খুলুন"
                                className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition"
                              >
                                <Smartphone className="w-4 h-4" />
                              </button>

                              {/* WhatsApp link */}
                              <button
                                onClick={() => handleSendSingleResultSMS(result, 'whatsapp')}
                                title="হোয়াটসঅ্যাপে পাঠান"
                                className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
                              >
                                <Send className="w-4 h-4" />
                              </button>

                              {/* Preview Message Modal trigger */}
                              <button
                                onClick={() => setPreviewStudentResult(result)}
                                title="এসএমএস প্রিভিউ দেখুন"
                                className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                            </div>
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
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SCHOOL NOTICES & CIRCULARS                                         */}
      {/* ========================================================================= */}
      {activeTab === 'notices' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left / Main Composer */}
          <div className="lg:col-span-2 space-y-5 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div>
              <h2 className="text-lg font-bold text-slate-800 font-serif">স্কুল নোটিশ ও বিজ্ঞপ্তি প্রস্তুতকারক</h2>
              <p className="text-xs text-slate-500">
                অভিভাবক সমাবেশ, ফলাফল প্রকাশ, ছুটি বা ফি পরিশোধ সংক্রান্ত নোটিশ তৈরি করে সকল অভিভাবককে পাঠান
              </p>
            </div>

            {/* Template Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-2">রেডিমেড নোটিশ টেমপ্লেট নির্বাচন করুন</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {DEFAULT_SMS_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => {
                      setSelectedTemplateId(tpl.id);
                      setNoticeText(tpl.body);
                    }}
                    className={`text-left p-3 rounded-xl border text-xs font-medium transition ${
                      selectedTemplateId === tpl.id
                        ? 'border-indigo-500 bg-indigo-50/60 text-indigo-950 font-bold shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-slate-50/50'
                    }`}
                  >
                    <div className="font-semibold text-slate-900 mb-0.5">{tpl.title}</div>
                    <div className="text-[11px] text-slate-500 line-clamp-1">{tpl.body}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Target Audience */}
            <div className="pt-2">
              <label className="block text-xs font-bold text-slate-600 mb-2">প্রাপক নির্বাচন (Target Audience)</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center p-3 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer hover:bg-slate-100 transition">
                  <input
                    type="radio"
                    name="targetAudience"
                    value="all"
                    checked={targetAudience === 'all'}
                    onChange={() => setTargetAudience('all')}
                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="ml-3">
                    <span className="text-xs font-bold text-slate-800 block">সকল শ্রেণির সকল অভিভাবক</span>
                    <span className="text-[11px] text-slate-500">
                      স্কুলের মোট {toBengaliNumber(totalStudentsWithPhone)} জন অভিভাবক
                    </span>
                  </div>
                </label>

                <label className="flex items-center p-3 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer hover:bg-slate-100 transition">
                  <input
                    type="radio"
                    name="targetAudience"
                    value="selected_class"
                    checked={targetAudience === 'selected_class'}
                    onChange={() => setTargetAudience('selected_class')}
                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="ml-3">
                    <span className="text-xs font-bold text-slate-800 block">শুধুমাত্র নির্বাচিত শ্রেণি</span>
                    <span className="text-[11px] text-slate-500">{currentClass.nameBn}</span>
                  </div>
                </label>
              </div>

              {targetAudience === 'selected_class' && (
                <div className="mt-3">
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nameBn}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Message Body Input */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-600">নোটিশের বিবরণ (মেসেজ বডি)</label>
                <div className="flex items-center space-x-2 text-[11px]">
                  <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold">
                    {noticeLengthInfo.isUnicode ? 'বাংলা / ইউনিকোড' : 'ইংলিশ GSM'}
                  </span>
                  <span className="text-slate-500 font-medium">
                    অক্ষর: <strong className="text-slate-800">{toBengaliNumber(noticeLengthInfo.charCount)}</strong>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                    {toBengaliNumber(noticeLengthInfo.smsParts)} টি SMS
                  </span>
                </div>
              </div>
              <textarea
                rows={5}
                value={noticeText}
                onChange={(e) => setNoticeText(e.target.value)}
                placeholder="এখানে অভিভাবককে জানানোর বার্তাটি লিখুন..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white leading-relaxed"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                টিপস: ব্যক্তিগত বার্তা তৈরি করতে <code className="text-indigo-600">{'{STUDENT_NAME}'}</code>,{' '}
                <code className="text-indigo-600">{'{ROLL}'}</code> বা <code className="text-indigo-600">{'{CLASS}'}</code> ব্যবহার করতে পারেন।
              </p>
            </div>

            {/* Submit Batch Notice */}
            <div className="pt-2">
              <button
                disabled={isSendingBatch || !noticeText.trim()}
                onClick={handleSendNotice}
                className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-blue-700 to-indigo-800 hover:from-blue-800 hover:to-indigo-900 text-white shadow-lg disabled:opacity-50 transition flex items-center justify-center space-x-2"
              >
                <Send className="w-4 h-4" />
                <span>
                  {targetAudience === 'all'
                    ? `সকল অভিভাবককে (${toBengaliNumber(totalStudentsWithPhone)} জন) নোটিশ পাঠান`
                    : `${currentClass.nameBn}-এর অভিভাবকদের নোটিশ পাঠান`}
                </span>
              </button>
            </div>
          </div>

          {/* Right Phone Mockup Preview */}
          <div className="bg-slate-900 p-6 rounded-2xl shadow-xl text-white flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <Smartphone className="w-5 h-5 text-indigo-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    স্মার্টফোন প্রিভিউ
                  </span>
                </div>
                <span className="text-[10px] text-emerald-400 font-mono">লাইভ প্রিভিউ</span>
              </div>

              {/* Phone Frame */}
              <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 shadow-inner space-y-3">
                {/* Header in phone */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-700 pb-2">
                  <span className="font-semibold text-white">{smsGatewayConfig.senderId || 'DLIKON_MA'}</span>
                  <span>আজ {new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                {/* SMS Bubble */}
                <div className="bg-indigo-600 text-white p-3.5 rounded-2xl rounded-tl-sm text-xs leading-relaxed shadow">
                  {noticeText || 'এখানে আপনার নোটিশ টেক্সট প্রদর্শিত হবে...'}
                </div>

                <div className="text-[10px] text-right text-slate-400 font-mono">
                  ডেলিভার্ড ✓✓
                </div>
              </div>

              {/* Character Metrics */}
              <div className="bg-slate-800/80 rounded-xl p-3 text-xs space-y-1.5 border border-slate-700 text-slate-300">
                <div className="flex justify-between">
                  <span>মোট ক্যারেক্টার:</span>
                  <strong className="text-white">{toBengaliNumber(noticeLengthInfo.charCount)}</strong>
                </div>
                <div className="flex justify-between">
                  <span>বিলিং এসএমএস পার্ট:</span>
                  <strong className="text-amber-300">{toBengaliNumber(noticeLengthInfo.smsParts)} টি</strong>
                </div>
                <div className="flex justify-between">
                  <span>চলতি পার্টে বাকি:</span>
                  <strong className="text-emerald-400">{toBengaliNumber(noticeLengthInfo.remainingInPart)} টি অক্ষর</strong>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 text-center">
              বাংলা এসএমএস-এর ক্ষেত্রে প্রথম ৭০ অক্ষরে ১টি এবং পরবর্তী প্রতি ৬৭ অক্ষরে অতিরিক্ত ১টি পার্ট হিসাব হয়।
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: QUICK DIRECT SMS                                                   */}
      {/* ========================================================================= */}
      {activeTab === 'quick' && (
        <div className="max-w-2xl mx-auto bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200 space-y-5">
          <div>
            <h2 className="text-lg font-bold text-slate-800 font-serif">তাৎক্ষণিক সরাসরি এসএমএস</h2>
            <p className="text-xs text-slate-500">
              যেকোনো অভিভাবক বা মোবাইল নম্বরে বিশেষ বার্তা বা জরুরি নোটিশ সরাসরি পাঠিয়ে দিন
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">প্রাপকের নাম (ঐচ্ছিক)</label>
              <input
                type="text"
                value={quickName}
                onChange={(e) => setQuickName(e.target.value)}
                placeholder="যেমন: আফরিন জাহান নূহা (অভিভাবক)"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                মোবাইল নম্বর <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={quickPhone}
                  onChange={(e) => setQuickPhone(e.target.value)}
                  placeholder="017XXXXXXXX"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-3.5 py-2.5 text-sm font-mono focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-600">
                  মেসেজের বিষয়বস্তু <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-slate-400">
                  {toBengaliNumber(quickLengthInfo.charCount)} অক্ষর | {toBengaliNumber(quickLengthInfo.smsParts)} SMS
                </span>
              </div>
              <textarea
                rows={4}
                value={quickMessage}
                onChange={(e) => setQuickMessage(e.target.value)}
                placeholder="এখানে মেসেজ লিখুন..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3.5 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => handleSendQuickSMS('device_sms')}
                className="flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl font-semibold text-sm bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition"
              >
                <Smartphone className="w-4 h-4" />
                <span>ফোনে এসএমএস অ্যাপে খুলুন</span>
              </button>

              <button
                onClick={() => handleSendQuickSMS('whatsapp')}
                className="flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl font-semibold text-sm bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition"
              >
                <Send className="w-4 h-4" />
                <span>হোয়াটসঅ্যাপে পাঠান</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SMS LOGS & DELIVERY HISTORY                                        */}
      {/* ========================================================================= */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Search & Filter */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={logSearchQuery}
                  onChange={(e) => setLogSearchQuery(e.target.value)}
                  placeholder="নাম, ফোন বা বার্তা খুঁজুন..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <select
                value={logFilterType}
                onChange={(e) => setLogFilterType(e.target.value as any)}
                className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium"
              >
                <option value="all">সকল ধরন</option>
                <option value="result">পরীক্ষার ফলাফল</option>
                <option value="notice">স্কুল নোটিশ</option>
                <option value="custom">কাস্টম মেসেজ</option>
              </select>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2">
              <button
                onClick={handleExportLogsCSV}
                className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                CSV ডাউনলোড
              </button>
              <button
                onClick={() => {
                  if (confirm('আপনি কি নিশ্চিত যে সকল এসএমএস লগ মুছে ফেলতে চান?')) {
                    clearSMSLogs();
                    showAlert('info', 'সকল এসএমএস লগ মুছে ফেলা হয়েছে!');
                  }
                }}
                className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200 transition"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                লগ মুছুন
              </button>
            </div>
          </div>

          {/* Logs Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Clock className="w-12 h-12 mx-auto mb-2 opacity-40" />
                <p>কোনো এসএমএস হিস্ট্রি পাওয়া যায়নি</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">প্রাপকের নাম</th>
                      <th className="py-3 px-4">ফোন নম্বর</th>
                      <th className="py-3 px-4">শ্রেণি ও রোল</th>
                      <th className="py-3 px-4">মেসেজ প্রিভিউ</th>
                      <th className="py-3 px-4">মাধ্যম</th>
                      <th className="py-3 px-4">তারিখ ও সময়</th>
                      <th className="py-3 px-4 text-center">স্ট্যাটাস</th>
                      <th className="py-3 px-4 text-right">মুছুন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-semibold text-slate-800">{log.recipientName}</td>
                        <td className="py-3 px-4 font-mono text-slate-600">{log.recipientPhone}</td>
                        <td className="py-3 px-4 text-slate-500">
                          {log.className || '-'} {log.studentRoll ? `(রোল: ${toBengaliRoll(log.studentRoll)})` : ''}
                        </td>
                        <td className="py-3 px-4 max-w-xs truncate text-slate-600 font-mono text-[11px]" title={log.messageText}>
                          {log.messageText}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                            {log.channel === 'device_sms' ? '📱 মোবাইল' : log.channel === 'whatsapp' ? '💬 WhatsApp' : '🌐 গেটওয়ে'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{log.sentAt}</td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                              log.status === 'delivered'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            {log.status === 'delivered' ? 'ডেলিভার্ড' : 'প্রেরিত'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => deleteSMSLog(log.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 transition"
                            title="লগ ডিলিট"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: GATEWAY & SETTINGS                                                 */}
      {/* ========================================================================= */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gateway Setup */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-slate-800 font-serif">এসএমএস গেটওয়ে কনফিগারেশন</h2>
              <p className="text-xs text-slate-500">
                স্মার্টফোনের মেসেজ প্যাকেজ অথবা বাংলাদেশি বাল্ক এসএমএস গেটওয়ে সার্ভিস নির্বাচন করুন
              </p>
            </div>

            {/* Provider Options */}
            <div className="space-y-3">
              <label className="flex items-start p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/40 cursor-pointer">
                <input
                  type="radio"
                  name="provider"
                  value="device_sms"
                  checked={gatewayProvider === 'device_sms'}
                  onChange={() => setGatewayProvider('device_sms')}
                  className="w-4 h-4 mt-0.5 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="ml-3">
                  <span className="text-xs font-bold text-slate-900 block">
                    📱 মোবাইল ডিভাইস মোড (১০০% ফ্রি - কোনো API খরচ নেই)
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    শিক্ষক তার মোবাইল ফোন বা ট্যাবলেট থেকে সরাসরি ডিভাইসের নিজস্ব সিমকার্ডের এসএমএস প্যাকেজ ব্যবহার করে অভিভাবকদের কাছে পাঠাবেন।
                  </p>
                </div>
              </label>

              <label className="flex items-start p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer hover:bg-slate-100 transition">
                <input
                  type="radio"
                  name="provider"
                  value="greenweb"
                  checked={gatewayProvider === 'greenweb'}
                  onChange={() => setGatewayProvider('greenweb')}
                  className="w-4 h-4 mt-0.5 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="ml-3">
                  <span className="text-xs font-bold text-slate-900 block">
                    🌐 বাংলাদেশি বাল্ক এসএমএস গেটওয়ে (Greenweb / BulkSMS BD / Alpha SMS)
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    স্কুলের নির্ধারিত মাস্কিং নেম (Sender ID) এবং বাল্ক এসএমএস সার্ভিস প্রোভাইডারের API দিয়ে এক ক্লিকে শত শত এসএমএস স্বয়ংক্রিয় ব্যাকগ্রাউন্ডে যাবে।
                  </p>
                </div>
              </label>
            </div>

            {/* Fields if Gateway */}
            {gatewayProvider !== 'device_sms' && (
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    সেন্ডার আইডি / মাস্কিং নাম (Sender ID)
                  </label>
                  <input
                    type="text"
                    value={gatewaySenderId}
                    onChange={(e) => setGatewaySenderId(e.target.value)}
                    placeholder="DLIKON_MA"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">API Key / টোকেন</label>
                  <input
                    type="password"
                    value={gatewayApiKey}
                    onChange={(e) => setGatewayApiKey(e.target.value)}
                    placeholder="আপনার বাল্ক এসএমএস API টোকেন লিখুন..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">ওয়েবহুক / API URL (ঐচ্ছিক)</label>
                  <input
                    type="text"
                    value={gatewayWebhook}
                    onChange={(e) => setGatewayWebhook(e.target.value)}
                    placeholder="https://api.greenweb.com.bd/api.php"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>
            )}

            <button
              onClick={handleSaveSettings}
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow transition"
            >
              সেটিংস সংরক্ষণ করুন
            </button>
          </div>

          {/* Test SMS Box */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 font-serif">টেস্ট এসএমএস টেস্ট-ড্রাইভ</h2>
              <p className="text-xs text-slate-500">
                আপনার কনফিগার করা সেটিংস ঠিকমতো কাজ করছে কি না তা যাচাই করতে একটি টেস্ট এসএমএস পাঠান
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">পরীক্ষামূলক মোবাইল নম্বর</label>
                <input
                  type="text"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-600 font-mono">
                বার্তা: "ডি-লিকন মডেল একাডেমী: এটি একটি টেস্ট এসএমএস। গেটওয়ে সক্রিয় আছে। ধন্যবাদ।"
              </div>

              <button
                disabled={isSendingTest || !testPhone}
                onClick={handleSendTestSMS}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow disabled:opacity-50 transition"
              >
                {isSendingTest ? 'টেস্ট এসএমএস পাঠানো হচ্ছে...' : 'টেস্ট এসএমএস পাঠান'}
              </button>
            </div>

            <div className="pt-4 border-t border-slate-100 text-xs text-slate-500 space-y-2">
              <div className="flex items-center text-slate-700 font-semibold">
                <ShieldCheck className="w-4 h-4 mr-1.5 text-emerald-600" />
                নিরাপদ ও স্থানীয় ডাটাবেসে সংরক্ষিত
              </div>
              <p className="text-[11px] leading-relaxed">
                আপনার সকল এসএমএস লগ এবং সেটিংস সম্পূর্ণ ডাটাবেসে সংরক্ষিত থাকে এবং ডাটাবেস ব্যাকআপ ফাইলের মাধ্যমে যেকোনো সময় ডাউনলোড ও রিস্টোর করা যায়।
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Single Result SMS Preview Modal */}
      {previewStudentResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
            <div className="bg-indigo-950 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base font-serif">ফলাফল এসএমএস প্রিভিউ</h3>
                <p className="text-xs text-indigo-300">
                  {previewStudentResult.student.nameBn} (রোল: {toBengaliRoll(previewStudentResult.student.roll)})
                </p>
              </div>
              <button
                onClick={() => setPreviewStudentResult(null)}
                className="text-indigo-300 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 font-mono text-xs text-slate-800 leading-relaxed">
                {generateResultSMS(previewStudentResult, schoolInfo, currentClass.nameBn, currentExam.nameBn)}
              </div>

              <div className="text-xs text-slate-500 flex justify-between">
                <span>প্রাপক ফোন:</span>
                <strong className="text-slate-800 font-mono">
                  {previewStudentResult.student.guardianPhone || 'নম্বর যুক্ত নেই'}
                </strong>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => {
                    handleSendSingleResultSMS(previewStudentResult, 'device_sms');
                    setPreviewStudentResult(null);
                  }}
                  className="py-2.5 px-4 rounded-xl font-semibold text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition flex items-center justify-center space-x-2"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>ফোনের মেসেজ অ্যাপ</span>
                </button>

                <button
                  onClick={() => {
                    handleSendSingleResultSMS(previewStudentResult, 'whatsapp');
                    setPreviewStudentResult(null);
                  }}
                  className="py-2.5 px-4 rounded-xl font-semibold text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition flex items-center justify-center space-x-2"
                >
                  <Send className="w-4 h-4" />
                  <span>হোয়াটসঅ্যাপ</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
