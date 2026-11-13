import React, { useEffect, useState } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  KeyRound,
  Trash2,
  Briefcase,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { AdmissionSignupRequest, StaffAccount, StaffAttendanceRecord } from '../types';
import { toBengaliNumber } from '../utils/bengali';
import {
  getLocalStaffAccounts,
  getLocalStaffAttendance,
  safeFetchJson,
  saveLocalStaffAccounts,
} from '../utils/portalAuthFallback';

export const StaffManagementView: React.FC = () => {
  const { classes, forceServerSync } = useSchool();
  const [staffAccounts, setStaffAccounts] = useState<StaffAccount[]>([]);
  const [staffAttendance, setStaffAttendance] = useState<StaffAttendanceRecord[]>([]);
  const [admissionRequests, setAdmissionRequests] = useState<AdmissionSignupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  // New staff form
  const [role, setRole] = useState<'employee' | 'official'>('employee');
  const [nameBn, setNameBn] = useState('');
  const [designationBn, setDesignationBn] = useState('সহকারী শিক্ষক');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('123456');

  const loadOverview = async () => {
    setLoading(true);
    try {
      const res = await safeFetchJson('/api/staff/overview');
      if (res.reachable && res.ok && res.data?.success) {
        const accounts = res.data.staffAccounts || [];
        setStaffAccounts(accounts);
        saveLocalStaffAccounts(accounts);
        setStaffAttendance(res.data.staffAttendance || []);
        setAdmissionRequests(res.data.admissionRequests || []);
      } else {
        setStaffAccounts(getLocalStaffAccounts());
        setStaffAttendance(getLocalStaffAttendance());
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  const showToast = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await safeFetchJson('/api/auth/register-staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role,
        nameBn,
        designationBn,
        phone,
        password,
        officialInviteCode: 'DL-ADMIN',
      }),
    });
    if (res.reachable) {
      if (res.ok && res.data?.success) {
        setNameBn('');
        setPhone('');
        setPassword('123456');
        await loadOverview();
        showToast(`✓ নতুন অ্যাকাউন্ট (${res.data.staff?.staffCode}) তৈরি হয়েছে!`);
      } else {
        showToast(`❌ ${res.data?.message || 'অ্যাকাউন্ট তৈরি করা যায়নি'}`);
      }
      return;
    }

    const current = getLocalStaffAccounts();
    const prefix = role === 'official' ? 'DL-ADM' : 'DL-EMP';
    const nextNum = current.filter((a) => a.role === role).length + 1;
    const staffCode = `${prefix}-${String(nextNum).padStart(2, '0')}`;
    const newStaff: StaffAccount = {
      id: `staff_${Date.now()}`,
      staffCode,
      role,
      nameBn: nameBn.trim(),
      designationBn: designationBn.trim() || (role === 'official' ? 'অফিস প্রশাসক' : 'সহকারী শিক্ষক'),
      phone: phone.trim(),
      password: password.trim(),
      department: role === 'official' ? 'administration' : 'academic',
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    const nextList = [...current, newStaff];
    saveLocalStaffAccounts(nextList);
    setStaffAccounts(nextList);
    setNameBn('');
    setPhone('');
    setPassword('123456');
    showToast(`✓ নতুন অ্যাকাউন্ট (${staffCode}) স্থানীয়ভাবে তৈরি হয়েছে!`);
  };

  const handleToggleStatus = async (staff: StaffAccount) => {
    const nextStatus: 'active' | 'pending' = staff.status === 'active' ? 'pending' : 'active';
    const res = await safeFetchJson('/api/staff/manage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'upsert_staff',
        payload: { ...staff, status: nextStatus },
      }),
    });
    if (res.reachable && res.ok && res.data?.success) {
      const accounts = res.data.staffAccounts || [];
      setStaffAccounts(accounts);
      saveLocalStaffAccounts(accounts);
      showToast(`✓ ${staff.nameBn}-এর অবস্থা হালনাগাদ হয়েছে।`);
    } else if (!res.reachable) {
      const updated = staffAccounts.map((s) => (s.id === staff.id ? { ...s, status: nextStatus } : s));
      setStaffAccounts(updated);
      saveLocalStaffAccounts(updated);
      showToast(`✓ ${staff.nameBn}-এর অবস্থা হালনাগাদ হয়েছে।`);
    }
  };

  const handleDeleteStaff = async (staff: StaffAccount) => {
    if (staff.staffCode === 'DL-ADMIN') {
      showToast('মূল অ্যাডমিন অ্যাকাউন্ট মুছে ফেলা যাবে না।');
      return;
    }
    const res = await safeFetchJson('/api/staff/manage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'delete_staff', payload: { id: staff.id } }),
    });
    if (res.reachable && res.ok && res.data?.success) {
      const accounts = res.data.staffAccounts || [];
      setStaffAccounts(accounts);
      saveLocalStaffAccounts(accounts);
      showToast('✓ স্টাফ অ্যাকাউন্ট অপসারণ করা হয়েছে।');
    } else if (!res.reachable) {
      const updated = staffAccounts.filter((s) => s.id !== staff.id);
      setStaffAccounts(updated);
      saveLocalStaffAccounts(updated);
      showToast('✓ স্টাফ অ্যাকাউন্ট অপসারণ করা হয়েছে।');
    }
  };

  const handleAdmissionAction = async (requestId: string, approve: boolean) => {
    const res = await safeFetchJson('/api/staff/manage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: approve ? 'approve_admission' : 'reject_admission',
        payload: { requestId },
      }),
    });
    if (res.reachable && res.ok && res.data?.success) {
      setAdmissionRequests(res.data.admissionRequests || []);
      if (approve) {
        await forceServerSync();
        showToast(`✓ শিক্ষার্থী অনুমোদিত ও পোর্টাল আইডি (${res.data.student?.portalUserId}) সক্রিয় হয়েছে!`);
      } else {
        showToast('আবেদন বাতিল করা হয়েছে।');
      }
    } else if (!res.reachable) {
      showToast('সার্ভারের সাথে সংযুক্ত হলে অনলাইন ভর্তি আবেদন অনুমোদন করা যাবে।');
    }
  };

  const pendingRequests = admissionRequests.filter((r) => r.status === 'pending');

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-serif font-bold text-[#0F1E3D] flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-amber-600" />
            <span>অফিসিয়াল, এমপ্লয়ী ও সাইন-আপ অ্যাকাউন্ট ব্যবস্থাপনা</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            নতুন শিক্ষক/কর্মচারী যোগ, পাসওয়ার্ড পর্যালোচনা, স্টাফ হাজিরা এবং নতুন শিক্ষার্থীর সাইন-আপ আবেদন অনুমোদন করুন।
          </p>
        </div>
        {feedback && (
          <div className="px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
            {feedback}
          </div>
        )}
      </div>

      {/* Add New Official / Employee Form */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
        <h3 className="font-bold text-sm text-slate-900 mb-4 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-indigo-700" />
          নতুন অফিসিয়াল বা এমপ্লয়ী অ্যাকাউন্ট তৈরি করুন
        </h3>
        <form onSubmit={handleCreateStaff} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">পোর্টাল ভূমিকা</label>
            <select
              value={role}
              onChange={(e) => {
                const r = e.target.value as 'employee' | 'official';
                setRole(r);
                setDesignationBn(r === 'official' ? 'অফিস প্রশাসক' : 'সহকারী শিক্ষক');
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
            >
              <option value="employee">এমপ্লয়ী / শিক্ষক</option>
              <option value="official">অফিসিয়াল অ্যাডমিন</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">পূর্ণ নাম *</label>
            <input
              type="text"
              value={nameBn}
              onChange={(e) => setNameBn(e.target.value)}
              placeholder="নাম লিখুন"
              required
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">পদবি</label>
            <input
              type="text"
              value={designationBn}
              onChange={(e) => setDesignationBn(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">মোবাইল নম্বর *</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01XXXXXXXXX"
              required
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">পাসওয়ার্ড *</label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
            />
          </div>
          <button
            type="submit"
            className="py-2 px-4 rounded-xl bg-[#0F1E3D] hover:bg-[#172C57] text-white text-xs font-bold transition cursor-pointer h-[34px]"
          >
            অ্যাকাউন্ট যোগ করুন
          </button>
        </form>
      </div>

      {/* Staff Directory Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-teal-700" />
            নিবন্ধিত অফিসিয়াল ও এমপ্লয়ী তালিকা ({toBengaliNumber(staffAccounts.length)} জন)
          </h3>
        </div>

        {loading ? (
          <p className="text-xs text-slate-500 py-4">লোড হচ্ছে...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3 font-semibold">আইডি কোড</th>
                  <th className="py-2 px-3 font-semibold">নাম ও পদবি</th>
                  <th className="py-2 px-3 font-semibold">ধরন</th>
                  <th className="py-2 px-3 font-semibold">মোবাইল</th>
                  <th className="py-2 px-3 font-semibold">পাসওয়ার্ড</th>
                  <th className="py-2 px-3 font-semibold">অবস্থা</th>
                  <th className="py-2 pl-3 font-semibold text-right">নিয়ন্ত্রণ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {staffAccounts.map((st) => (
                  <tr key={st.id}>
                    <td className="py-3 pr-3 font-mono font-bold text-[#0F1E3D]">{st.staffCode}</td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{st.nameBn}</div>
                      <div className="text-[11px] text-slate-500">{st.designationBn}</div>
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-700">
                      {st.role === 'official' ? 'অফিসিয়াল অ্যাডমিন' : 'এমপ্লয়ী / শিক্ষক'}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-700">{st.phone}</td>
                    <td className="py-3 px-3 font-mono text-slate-600 flex items-center gap-1 mt-1">
                      <KeyRound className="w-3 h-3 text-slate-400" />
                      <span>{st.password}</span>
                    </td>
                    <td className="py-3 px-3 font-semibold">
                      <span className={st.status === 'active' ? 'text-emerald-700' : 'text-amber-700'}>
                        {st.status === 'active' ? 'সক্রিয়' : 'স্থগিত'}
                      </span>
                    </td>
                    <td className="py-3 pl-3 text-right space-x-2">
                      {st.staffCode !== 'DL-ADMIN' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(st)}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-[11px] font-semibold cursor-pointer"
                          >
                            {st.status === 'active' ? 'স্থগিত' : 'সক্রিয়'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteStaff(st)}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer inline-flex items-center"
                            title="মুছে ফেলুন"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bottom Grid: Pending Student Signups & Staff Attendance Log */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <h3 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            নতুন শিক্ষার্থী সাইন-আপ আবেদন ({toBengaliNumber(pendingRequests.length)}টি)
          </h3>
          {pendingRequests.length === 0 ? (
            <p className="text-xs text-slate-500 py-4">কোনো অপেক্ষমান শিক্ষার্থী সাইন-আপ আবেদন নেই।</p>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((req) => {
                const clsName = classes.find((c) => c.id === req.classId)?.nameBn || req.classId;
                return (
                  <div
                    key={req.id}
                    className="p-3.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="text-xs space-y-0.5">
                      <div className="font-bold text-slate-900 text-sm">{req.studentNameBn}</div>
                      <div className="text-slate-600">
                        {clsName} · অভিভাবক: {req.guardianNameBn} · {req.guardianPhone}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAdmissionAction(req.id, true)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> অনুমোদন
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdmissionAction(req.id, false)}
                        className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" /> বাতিল
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <h3 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-700" />
            এমপ্লয়ী দৈনিক হাজিরা লগ
          </h3>
          {staffAttendance.length === 0 ? (
            <p className="text-xs text-slate-500 py-4">এখনো কোনো এমপ্লয়ী চেক-ইন করেননি।</p>
          ) : (
            <div className="overflow-x-auto max-h-64">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-2 font-semibold">নাম</th>
                    <th className="py-2 px-2 font-semibold">তারিখ</th>
                    <th className="py-2 px-2 font-semibold">চেক-ইন</th>
                    <th className="py-2 pl-2 font-semibold">চেক-আউট</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {staffAttendance.slice(0, 15).map((att) => (
                    <tr key={att.id}>
                      <td className="py-2 pr-2">
                        <div className="font-semibold text-slate-900">{att.staffNameBn}</div>
                        <div className="text-[11px] text-slate-500">{att.designationBn}</div>
                      </td>
                      <td className="py-2 px-2 text-slate-600">{att.date}</td>
                      <td className="py-2 px-2 text-emerald-700 font-semibold">{att.checkInTime}</td>
                      <td className="py-2 pl-2 text-slate-600">{att.checkOutTime || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
