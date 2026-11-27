import React, { useEffect, useMemo, useState } from 'react';
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
  Wallet,
  CalendarCheck,
  Pencil,
  Save,
  X,
  Lock,
  Unlock,
  RefreshCw,
  Printer,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { AdmissionSignupRequest, StaffAccount, StaffAttendanceRecord } from '../types';
import { toBengaliNumber } from '../utils/bengali';
import { SchoolLogo } from './SchoolLogo';
import {
  getLocalStaffAccounts,
  getLocalStaffAttendance,
  safeFetchJson,
  saveLocalStaffAccounts,
} from '../utils/portalAuthFallback';
import { syncStaffAccountToFirestore } from '../services/firestoreSyncService';
import {
  STAFF_DESIGNATIONS,
  computeStaffWorkedMinutes,
  formatWorkedDurationBn,
  getDesignationMeta,
  getDesignationOrder,
  normalizeStaffDesignation,
} from '../utils/staffDesignations';
import { mergeCanonicalStaffRoster } from '../utils/staffDirectorySeed';
import { generateStaffPassword } from '../utils/credentialGenerator';

export const StaffManagementView: React.FC = () => {
  const {
    schoolInfo,
    classes,
    forceServerSync,
    cloudUser,
    staffAccounts: ctxStaffAccounts,
    staffAttendance: ctxStaffAttendance,
    staffLeaves,
    setStaffAccountsList,
    setStaffAttendanceList,
    reviewStaffLeave,
    updateStaffAccountConfig,
    toggleGlobalDeviceLock,
    remoteUnlockAccount,
    regenerateStaffPasswords,
  } = useSchool();

  const [staffAccounts, setStaffAccounts] = useState<StaffAccount[]>(() =>
    mergeCanonicalStaffRoster(ctxStaffAccounts)
  );
  const [staffAttendance, setStaffAttendance] = useState<StaffAttendanceRecord[]>(
    () => ctxStaffAttendance
  );
  const [admissionRequests, setAdmissionRequests] = useState<AdmissionSignupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isTogglingLock, setIsTogglingLock] = useState(false);
  const [confirmRegenAllStaff, setConfirmRegenAllStaff] = useState(false);
  const [showPrintStaffCards, setShowPrintStaffCards] = useState(false);
  const [busyStaffId, setBusyStaffId] = useState<string | null>(null);

  // New staff form
  const [role, setRole] = useState<'employee' | 'official'>('employee');
  const [nameBn, setNameBn] = useState('');
  const [designationBn, setDesignationBn] = useState('শিক্ষক');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState(() => generateStaffPassword('ST'));

  // Inline salary / shift edit state
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [editSalary, setEditSalary] = useState<string>('');
  const [editShiftHours, setEditShiftHours] = useState<string>('');
  const [editOtRate, setEditOtRate] = useState<string>('');
  const [editPassword, setEditPassword] = useState<string>('');

  const loadOverview = async () => {
    setLoading(true);
    try {
      const res = await safeFetchJson('/api/staff/overview');
      if (res.reachable && res.ok && res.data?.success) {
        const accounts = mergeCanonicalStaffRoster(res.data.staffAccounts || []);
        const att: StaffAttendanceRecord[] = res.data.staffAttendance || [];
        setStaffAccounts(accounts);
        setStaffAccountsList(accounts);
        setStaffAttendance(att);
        setStaffAttendanceList(att);
        setAdmissionRequests(res.data.admissionRequests || []);
        if (cloudUser?.emailVerified) {
          for (const acc of accounts) {
            void syncStaffAccountToFirestore(acc, cloudUser, schoolInfo).catch(() => {});
          }
        }
      } else {
        setStaffAccounts(
          mergeCanonicalStaffRoster(
            ctxStaffAccounts.length > 0 ? ctxStaffAccounts : getLocalStaffAccounts()
          )
        );
        setStaffAttendance(
          ctxStaffAttendance.length > 0 ? ctxStaffAttendance : getLocalStaffAttendance()
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOverview();
  }, []);

  useEffect(() => {
    if (ctxStaffAccounts.length > 0) {
      setStaffAccounts(mergeCanonicalStaffRoster(ctxStaffAccounts));
    }
  }, [ctxStaffAccounts]);

  useEffect(() => {
    if (ctxStaffAttendance.length > 0) {
      setStaffAttendance(ctxStaffAttendance);
    }
  }, [ctxStaffAttendance]);

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
        setPassword(
          generateStaffPassword(
            role === 'official' ? 'OF' : 'ST',
            new Set(staffAccounts.map((s) => String(s.password || '').trim()))
          )
        );
        await loadOverview();
        showToast(`নতুন অ্যাকাউন্ট (${res.data.staff?.staffCode}) তৈরি হয়েছে!`);
      } else {
        showToast(res.data?.message || 'অ্যাকাউন্ট তৈরি করা যায়নি');
      }
      return;
    }

    const current = getLocalStaffAccounts();
    const prefix = role === 'official' ? 'DL-OFF' : 'DL-EMP';
    const nextNum = current.filter((a) => a.role === role).length + 1;
    const staffCode = `${prefix}-${String(nextNum).padStart(2, '0')}`;
    const meta = getDesignationMeta(designationBn);
    const newStaff: StaffAccount = {
      id: `staff_${Date.now()}`,
      staffCode,
      role,
      categoryKey: meta.key,
      nameBn: nameBn.trim(),
      designationBn: meta.labelBn,
      phone: phone.trim(),
      password: password.trim(),
      department: meta.defaultDepartment,
      baseMonthlySalary: meta.defaultBaseSalary,
      dailyShiftHours: meta.defaultShiftHours,
      overtimeHourlyRate: meta.defaultOvertimeRatePerHour,
      unlockEpoch: 0,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    const nextList = mergeCanonicalStaffRoster([...current, newStaff]);
    saveLocalStaffAccounts(nextList);
    setStaffAccounts(nextList);
    setStaffAccountsList(nextList);
    if (cloudUser?.emailVerified) {
      void syncStaffAccountToFirestore(newStaff, cloudUser, schoolInfo).catch(() => {});
    }
    setNameBn('');
    setPhone('');
    setPassword(
      generateStaffPassword(
        role === 'official' ? 'OF' : 'ST',
        new Set(nextList.map((s) => String(s.password || '').trim()))
      )
    );
    showToast(`নতুন অ্যাকাউন্ট (${staffCode}) স্থানীয়ভাবে তৈরি হয়েছে!`);
  };

  const handleToggleStatus = async (staff: StaffAccount) => {
    const nextStatus: 'active' | 'pending' = staff.status === 'active' ? 'pending' : 'active';
    await updateStaffAccountConfig(staff.id, { status: nextStatus });
    showToast(`${staff.nameBn}-এর অবস্থা হালনাগাদ হয়েছে।`);
  };

  const handleDeleteStaff = async (staff: StaffAccount) => {
    if (staff.staffCode === 'DL-PRN-01' || staff.staffCode === 'DL-ADMIN') {
      showToast('প্রিন্সিপাল মূল অ্যাকাউন্ট মুছে ফেলা যাবে না।');
      return;
    }
    const res = await safeFetchJson('/api/staff/manage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'delete_staff', payload: { id: staff.id } }),
    });
    if (res.reachable && res.ok && res.data?.success) {
      const accounts = mergeCanonicalStaffRoster(res.data.staffAccounts || []);
      setStaffAccounts(accounts);
      setStaffAccountsList(accounts);
      showToast('স্টাফ অ্যাকাউন্ট অপসারণ করা হয়েছে।');
    } else if (!res.reachable) {
      const updated = staffAccounts.filter((s) => s.id !== staff.id);
      setStaffAccounts(updated);
      setStaffAccountsList(updated);
      showToast('স্টাফ অ্যাকাউন্ট অপসারণ করা হয়েছে।');
    }
  };

  const startEditPayroll = (st: StaffAccount) => {
    const meta = getDesignationMeta(st.designationBn);
    setEditingStaffId(st.id);
    setEditSalary(String(st.baseMonthlySalary ?? meta.defaultBaseSalary));
    setEditShiftHours(String(st.dailyShiftHours ?? meta.defaultShiftHours));
    setEditOtRate(String(st.overtimeHourlyRate ?? meta.defaultOvertimeRatePerHour));
    setEditPassword(st.password || generateStaffPassword(st));
  };

  const handleToggleAlwaysLockPolicy = async () => {
    setIsTogglingLock(true);
    try {
      const currentLocked = schoolInfo.alwaysLockDevices !== false;
      const nextVal = await toggleGlobalDeviceLock(!currentLocked);
      showToast(
        nextVal
          ? 'সকল এমপ্লয়ী ও শিক্ষার্থীর স্মার্টফোনে স্থায়ী ড্যাশবোর্ড লক চালু করা হয়েছে।'
          : 'সাময়িক আনলক মোড ("স্টে") চালু হয়েছে — লগইনকৃত ডিভাইসগুলো স্বয়ংক্রিয়ভাবে আনলক হবে।'
      );
    } finally {
      setIsTogglingLock(false);
    }
  };

  const handleRemoteUnlockStaff = async (st: StaffAccount) => {
    setBusyStaffId(st.id);
    try {
      const nextEpoch = await remoteUnlockAccount('staff', st.id);
      if (nextEpoch !== null) {
        showToast(
          `${st.nameBn} (${st.staffCode})-এর ডিভাইসে রিমোট আনলক সিগন্যাল (ধাপ ${toBengaliNumber(nextEpoch)}) পাঠানো হয়েছে।`
        );
      }
    } finally {
      setBusyStaffId(null);
    }
  };

  const handleRegenerateSingleStaffPassword = async (st: StaffAccount) => {
    setBusyStaffId(st.id);
    try {
      const updated = await regenerateStaffPasswords(st.id);
      setStaffAccounts(updated);
      const target = updated.find((u) => u.id === st.id);
      showToast(
        `${st.nameBn}-এর নতুন পাসওয়ার্ড: ${target?.password || ''} নির্ধারিত হয়েছে।`
      );
    } finally {
      setBusyStaffId(null);
    }
  };

  const handleRegenerateAllStaffPasswords = async () => {
    setConfirmRegenAllStaff(false);
    const updated = await regenerateStaffPasswords();
    setStaffAccounts(updated);
    showToast('প্রিন্সিপাল ব্যতীত সকল ১৯টি স্টাফ অ্যাকাউন্টের নতুন স্বতন্ত্র পাসওয়ার্ড জেনারেট হয়েছে।');
  };

  const saveEditPayroll = async (st: StaffAccount) => {
    const baseMonthlySalary = Math.max(0, Number(editSalary) || 0);
    const dailyShiftHours = Math.max(1, Number(editShiftHours) || 8);
    const overtimeHourlyRate = Math.max(0, Number(editOtRate) || 0);
    const updated = await updateStaffAccountConfig(st.id, {
      baseMonthlySalary,
      dailyShiftHours,
      overtimeHourlyRate,
      password: editPassword.trim() || st.password,
    });
    if (updated) {
      setEditingStaffId(null);
      showToast(`${st.nameBn}-এর বেতন, শিফট ও পাসওয়ার্ড হালনাগাদ হয়েছে।`);
    }
  };

  const handleLeaveDecision = async (leaveId: string, decision: 'approved' | 'rejected') => {
    const updated = await reviewStaffLeave(leaveId, decision, 'প্রিন্সিপাল');
    if (updated) {
      showToast(
        decision === 'approved'
          ? `${updated.staffNameBn}-এর ছুটির আবেদন অনুমোদিত হয়েছে।`
          : `${updated.staffNameBn}-এর ছুটির আবেদন বাতিল করা হয়েছে।`
      );
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
        showToast(`শিক্ষার্থী অনুমোদিত ও পোর্টাল আইডি (${res.data.student?.portalUserId}) সক্রিয় হয়েছে!`);
      } else {
        showToast('আবেদন বাতিল করা হয়েছে।');
      }
    } else if (!res.reachable) {
      showToast('সার্ভারের সাথে সংযুক্ত হলে অনলাইন ভর্তি আবেদন অনুমোদন করা যাবে।');
    }
  };

  const sortedFilteredStaff = useMemo(() => {
    const sorted = [...staffAccounts].sort(
      (a, b) =>
        getDesignationOrder(a.designationBn) - getDesignationOrder(b.designationBn) ||
        a.staffCode.localeCompare(b.staffCode)
    );
    if (categoryFilter === 'all') return sorted;
    return sorted.filter(
      (st) => normalizeStaffDesignation(st.designationBn) === categoryFilter
    );
  }, [staffAccounts, categoryFilter]);

  const pendingRequests = admissionRequests.filter((r) => r.status === 'pending');
  const pendingLeaves = staffLeaves.filter((l) => l.status === 'pending');
  const recentReviewedLeaves = staffLeaves.filter((l) => l.status !== 'pending').slice(0, 6);

  const isGlobalDeviceLockOn = schoolInfo.alwaysLockDevices !== false;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-serif font-bold text-[#0F1E3D] flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-amber-600" />
            <span>৮ ক্যাটাগরির স্টাফ তালিকা, বেতন কনফিগারেশন ও ছুটি অনুমোদন</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            প্রতিষ্ঠানের সকল ২০ জন দায়িত্বশীল ব্যক্তি ও শিক্ষকের স্বতন্ত্র আইডি, পাসওয়ার্ড, ডিভাইস লক নিয়ন্ত্রণ, বেতন ও ছুটির আবেদন ব্যবস্থাপনা।
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPrintStaffCards(true)}
            className="px-3.5 py-2 rounded-lg bg-[#0F1E3D] hover:bg-[#172C57] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-amber-300" />
            <span>সকল স্টাফ আইডি-পাসওয়ার্ড কার্ড প্রিন্ট</span>
          </button>
          {!confirmRegenAllStaff ? (
            <button
              type="button"
              onClick={() => setConfirmRegenAllStaff(true)}
              className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-indigo-700" />
              <span>সকল স্টাফের নতুন পাসওয়ার্ড জেনারেট</span>
            </button>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-xs">
              <span className="font-bold text-amber-950">১৯ স্টাফের পাসওয়ার্ড বদলাবেন?</span>
              <button
                type="button"
                onClick={handleRegenerateAllStaffPasswords}
                className="px-2 py-0.5 rounded bg-amber-700 hover:bg-amber-800 text-white font-bold cursor-pointer"
              >
                হ্যাঁ
              </button>
              <button
                type="button"
                onClick={() => setConfirmRegenAllStaff(false)}
                className="px-2 py-0.5 rounded border border-slate-300 bg-white text-slate-700 font-semibold cursor-pointer"
              >
                না
              </button>
            </div>
          )}
        </div>
        {feedback && (
          <div className="w-full px-3.5 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
            {feedback}
          </div>
        )}
      </div>

      {/* Global Always-Lock Smartphone Control Bar */}
      <div
        className={`rounded-xl border p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 ${
          isGlobalDeviceLockOn
            ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
            : 'bg-amber-50 border-amber-300 text-amber-950'
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              isGlobalDeviceLockOn
                ? 'bg-emerald-700 text-white'
                : 'bg-amber-600 text-white'
            }`}
          >
            {isGlobalDeviceLockOn ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
          </div>
          <div>
            <div className="text-sm font-bold flex flex-wrap items-center gap-2">
              <span>
                {isGlobalDeviceLockOn
                  ? 'সকল স্মার্টফোন ড্যাশবোর্ড লক্ড (স্থায়ী মোড)'
                  : 'সাময়িক আনলকড মোড ("স্টে" — অস্থায়ীভাবে খোলা আছে)'}
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 border border-current/25 rounded bg-white/75">
                {isGlobalDeviceLockOn ? 'ALWAYS_LOCKED = ON' : 'TEMP_UNLOCK = ON'}
              </span>
            </div>
            <p className="text-xs opacity-85 mt-1 leading-relaxed">
              {isGlobalDeviceLockOn
                ? 'এমপ্লয়ী ও শিক্ষার্থীরা নিজস্ব স্মার্টফোনে লগইন করলেই ড্যাশবোর্ড স্থায়ীভাবে লক থাকবে—অন্য কোনো একাউন্টে ঢোকার বা সাইন-আউট করার সুযোগ পাবে না।'
                : 'বর্তমানে সাময়িকভাবে লক খোলা রয়েছে। প্রয়োজন শেষ হলে পুনরায় "স্থায়ী লক চালু করুন" চাপলে সব স্মার্টফোন আবার লক মোডে ফিরে যাবে।'}
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={isTogglingLock}
          onClick={handleToggleAlwaysLockPolicy}
          className={`px-4 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60 transition ${
            isGlobalDeviceLockOn
              ? 'bg-amber-700 hover:bg-amber-800 text-white'
              : 'bg-emerald-700 hover:bg-emerald-800 text-white'
          }`}
        >
          {isGlobalDeviceLockOn ? (
            <>
              <Unlock className="w-3.5 h-3.5" />
              <span>সাময়িক আনলক ("স্টে" মোড চালু)</span>
            </>
          ) : (
            <>
              <Lock className="w-3.5 h-3.5" />
              <span>পুনরায় স্থায়ী লক চালু করুন</span>
            </>
          )}
        </button>
      </div>

      {/* Add New Official / Employee Form */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6">
        <h3 className="font-bold text-sm text-slate-900 mb-4 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-indigo-700" />
          নতুন অফিসিয়াল বা এমপ্লয়ী অ্যাকাউন্ট তৈরি করুন
        </h3>
        <form
          onSubmit={handleCreateStaff}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">পোর্টাল ভূমিকা</label>
            <select
              value={role}
              onChange={(e) => {
                const r = e.target.value as 'employee' | 'official';
                setRole(r);
                const currentMeta = getDesignationMeta(designationBn);
                if (!currentMeta || currentMeta.defaultRole !== r) {
                  setDesignationBn(r === 'official' ? 'প্রিন্সিপাল' : 'শিক্ষক');
                }
              }}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
            >
              <option value="employee">এমপ্লয়ী / শিক্ষক</option>
              <option value="official">অফিসিয়াল প্রশাসন</option>
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
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">ক্যাটাগরি (১–৮) *</label>
            <select
              value={normalizeStaffDesignation(designationBn)}
              onChange={(e) => {
                const val = e.target.value;
                setDesignationBn(val);
                const meta = getDesignationMeta(val);
                if (meta) {
                  setRole(meta.defaultRole);
                }
              }}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
            >
              {STAFF_DESIGNATIONS.map((d) => (
                <option key={d.key} value={d.labelBn}>
                  {toBengaliNumber(d.order)}। {d.labelBn}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">মোবাইল নম্বর *</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01XXXXXXXXX"
              required
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">পাসওয়ার্ড *</label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
            />
          </div>
          <button
            type="submit"
            className="py-2 px-4 rounded-lg bg-[#0F1E3D] hover:bg-[#172C57] text-white text-xs font-bold transition cursor-pointer h-[34px]"
          >
            অ্যাকাউন্ট যোগ করুন
          </button>
        </form>
      </div>

      {/* Staff Directory Table with 1-8 Category Filter & Inline Salary/Shift Config */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-teal-700" />
            নিবন্ধিত অফিসিয়াল ও এমপ্লয়ী তালিকা ({toBengaliNumber(sortedFilteredStaff.length)} জন)
          </h3>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold border cursor-pointer ${
                categoryFilter === 'all'
                  ? 'bg-[#0F1E3D] text-white border-[#0F1E3D]'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              সকল ({toBengaliNumber(staffAccounts.length)})
            </button>
            {STAFF_DESIGNATIONS.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => setCategoryFilter(d.labelBn)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold border cursor-pointer whitespace-nowrap ${
                  categoryFilter === d.labelBn
                    ? 'bg-[#0F1E3D] text-white border-[#0F1E3D]'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {toBengaliNumber(d.order)}। {d.labelBn}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="text-xs text-slate-500 py-4">লোড হচ্ছে...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3 font-semibold">আইডি কোড</th>
                  <th className="py-2 px-3 font-semibold">নাম ও ক্যাটাগরি</th>
                  <th className="py-2 px-3 font-semibold">পাসওয়ার্ড</th>
                  <th className="py-2 px-3 font-semibold">মূল বেতন</th>
                  <th className="py-2 px-3 font-semibold">শিফট / OT রেট</th>
                  <th className="py-2 px-3 font-semibold">অবস্থা</th>
                  <th className="py-2 pl-3 font-semibold text-right">নিয়ন্ত্রণ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {sortedFilteredStaff.map((st) => {
                  const meta = getDesignationMeta(st.designationBn);
                  const isEditing = editingStaffId === st.id;
                  const salaryVal = st.baseMonthlySalary ?? meta.defaultBaseSalary;
                  const shiftVal = st.dailyShiftHours ?? meta.defaultShiftHours;
                  const otRateVal = st.overtimeHourlyRate ?? meta.defaultOvertimeRatePerHour;

                  return (
                    <tr key={st.id} className="hover:bg-slate-50/70">
                      <td className="py-3 pr-3 font-mono font-bold text-[#0F1E3D] whitespace-nowrap">
                        {st.staffCode}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{st.nameBn}</div>
                        <div className="text-[11px] text-slate-500">
                          {toBengaliNumber(meta.order)}। {meta.labelBn} ·{' '}
                          {st.role === 'official' ? 'অফিসিয়াল পোর্টাল' : 'এমপ্লয়ী পোর্টাল'}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-700">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editPassword}
                            onChange={(e) => setEditPassword(e.target.value)}
                            className="w-24 px-2 py-1 rounded border border-slate-300 text-xs font-mono"
                          />
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <KeyRound className="w-3 h-3 text-slate-400" />
                            <span>{st.password}</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-semibold text-emerald-800 whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editSalary}
                            onChange={(e) => setEditSalary(e.target.value)}
                            className="w-24 px-2 py-1 rounded border border-slate-300 text-xs"
                          />
                        ) : (
                          <span>৳{toBengaliNumber(salaryVal)}</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-700 whitespace-nowrap">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              value={editShiftHours}
                              onChange={(e) => setEditShiftHours(e.target.value)}
                              title="দৈনিক শিফট ঘণ্টা"
                              className="w-14 px-1.5 py-1 rounded border border-slate-300 text-xs"
                            />
                            <span className="text-[11px]">ঘণ্টা /</span>
                            <input
                              type="number"
                              value={editOtRate}
                              onChange={(e) => setEditOtRate(e.target.value)}
                              title="ওভারটাইম রেট"
                              className="w-16 px-1.5 py-1 rounded border border-slate-300 text-xs"
                            />
                          </div>
                        ) : (
                          <span>
                            {toBengaliNumber(shiftVal)} ঘণ্টা · OT ৳{toBengaliNumber(otRateVal)}/ঘণ্টা
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-semibold whitespace-nowrap">
                        <span className={st.status === 'active' ? 'text-emerald-700' : 'text-amber-700'}>
                          {st.status === 'active' ? 'সক্রিয়' : 'স্থগিত'}
                        </span>
                      </td>
                      <td className="py-3 pl-3 text-right space-x-1.5 whitespace-nowrap">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => saveEditPayroll(st)}
                              className="px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Save className="w-3 h-3" /> সংরক্ষণ
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingStaffId(null)}
                              className="p-1 rounded border border-slate-200 hover:bg-slate-100 text-slate-600 inline-flex items-center cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => startEditPayroll(st)}
                              className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-100 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                              title="বেতন, শিফট ও পাসওয়ার্ড সম্পাদনা"
                            >
                              <Pencil className="w-3 h-3 text-indigo-700" />
                              বেতন/শিফট
                            </button>
                            <button
                              type="button"
                              disabled={busyStaffId === st.id}
                              onClick={() => handleRemoteUnlockStaff(st)}
                              className="px-2 py-1 rounded border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              title="এই স্টাফের স্মার্টফোনে রিমোট আনলক সিগন্যাল পাঠান"
                            >
                              <Unlock className="w-3 h-3" />
                              রিমোট আনলক
                              {(st.unlockEpoch || 0) > 0 && (
                                <span className="font-mono text-[10px] text-amber-800">
                                  ({toBengaliNumber(st.unlockEpoch || 0)})
                                </span>
                              )}
                            </button>
                            {st.staffCode !== 'DL-PRN-01' && st.staffCode !== 'DL-ADMIN' && (
                              <>
                                <button
                                  type="button"
                                  disabled={busyStaffId === st.id}
                                  onClick={() => handleRegenerateSingleStaffPassword(st)}
                                  className="px-2 py-1 rounded border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-900 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                  title="স্বতন্ত্র নতুন পাসওয়ার্ড জেনারেট করুন"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                  পিন
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleStatus(st)}
                                  className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-100 text-[11px] font-semibold cursor-pointer"
                                >
                                  {st.status === 'active' ? 'স্থগিত' : 'সক্রিয়'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteStaff(st)}
                                  className="p-1.5 rounded text-rose-600 hover:bg-rose-50 cursor-pointer inline-flex items-center"
                                  title="মুছে ফেলুন"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Leave Approval Queue + Pending Student Signups + Staff Attendance Log */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leave Approval Queue */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-teal-700" />
            স্টাফ ছুটির আবেদন অনুমোদন ({toBengaliNumber(pendingLeaves.length)}টি)
          </h3>
          {pendingLeaves.length === 0 ? (
            <p className="text-xs text-slate-500 py-3">কোনো অপেক্ষমান ছুটির আবেদন নেই।</p>
          ) : (
            <div className="space-y-2.5">
              {pendingLeaves.map((lr) => (
                <div
                  key={lr.id}
                  className="p-3 rounded-lg border border-slate-200 space-y-2 text-xs"
                >
                  <div>
                    <div className="font-bold text-slate-900">
                      {lr.staffNameBn} · {normalizeStaffDesignation(lr.designationBn)}
                    </div>
                    <div className="text-slate-600 tabular-nums mt-0.5">
                      {lr.startDate} থেকে {lr.endDate} ({toBengaliNumber(lr.daysCount)} দিন) —{' '}
                      {lr.reason}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleLeaveDecision(lr.id, 'approved')}
                      className="px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3 h-3" /> অনুমোদন
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLeaveDecision(lr.id, 'rejected')}
                      className="px-2.5 py-1 rounded border border-rose-200 text-rose-700 hover:bg-rose-50 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <XCircle className="w-3 h-3" /> বাতিল
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {recentReviewedLeaves.length > 0 && (
            <div className="pt-2 border-t border-slate-100 space-y-1.5">
              <div className="text-[11px] font-semibold text-slate-500">সাম্প্রতিক সিদ্ধান্ত</div>
              {recentReviewedLeaves.map((lr) => (
                <div key={lr.id} className="flex items-center justify-between gap-2 text-[11px] text-slate-600">
                  <span className="truncate">
                    {lr.staffNameBn} ({toBengaliNumber(lr.daysCount)} দিন)
                    {lr.reviewNote ? ` · ${lr.reviewNote}` : ''}
                  </span>
                  <span
                    className={
                      lr.status === 'approved'
                        ? 'text-emerald-700 font-semibold shrink-0'
                        : 'text-rose-700 font-semibold shrink-0'
                    }
                  >
                    {lr.status === 'approved' ? 'অনুমোদিত' : 'বাতিল'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Student Signups */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            নতুন শিক্ষার্থী সাইন-আপ আবেদন ({toBengaliNumber(pendingRequests.length)}টি)
          </h3>
          {pendingRequests.length === 0 ? (
            <p className="text-xs text-slate-500 py-3">কোনো অপেক্ষমান শিক্ষার্থী সাইন-আপ আবেদন নেই।</p>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((req) => {
                const clsName = classes.find((c) => c.id === req.classId)?.nameBn || req.classId;
                return (
                  <div
                    key={req.id}
                    className="p-3 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="text-xs space-y-0.5">
                      <div className="font-bold text-slate-900">{req.studentNameBn}</div>
                      <div className="text-slate-600">
                        {clsName} · অভিভাবক: {req.guardianNameBn} · {req.guardianPhone}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAdmissionAction(req.id, true)}
                        className="px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3 h-3" /> অনুমোদন
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdmissionAction(req.id, false)}
                        className="px-2.5 py-1 rounded border border-rose-200 text-rose-700 hover:bg-rose-50 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <XCircle className="w-3 h-3" /> বাতিল
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Staff Attendance Log */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-700" />
            স্টাফ দৈনিক হাজিরা লগ
          </h3>
          {staffAttendance.length === 0 ? (
            <p className="text-xs text-slate-500 py-3">এখনো কোনো স্টাফ চেক-ইন করেননি।</p>
          ) : (
            <div className="overflow-x-auto max-h-64">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-2 font-semibold">নাম ও ক্যাটাগরি</th>
                    <th className="py-2 px-2 font-semibold">তারিখ</th>
                    <th className="py-2 px-2 font-semibold">প্রবেশ</th>
                    <th className="py-2 pl-2 font-semibold">মোট সময়</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {staffAttendance.slice(0, 15).map((att) => {
                    const calc = computeStaffWorkedMinutes(att);
                    const durationText =
                      att.workedDurationBn || formatWorkedDurationBn(calc.minutes);
                    return (
                      <tr key={att.id}>
                        <td className="py-2 pr-2">
                          <div className="font-semibold text-slate-900">{att.staffNameBn}</div>
                          <div className="text-[11px] text-slate-500">
                            {normalizeStaffDesignation(att.designationBn)}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-slate-600">{att.date}</td>
                        <td className="py-2 px-2 text-emerald-700 font-semibold">{att.checkInTime}</td>
                        <td className="py-2 pl-2 font-semibold text-[#0F1E3D]">
                          {durationText}
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

      {/* A4 Printable Staff ID & Password Credential Cards Modal */}
      {showPrintStaffCards && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[95vh] flex flex-col overflow-hidden">
            <div className="no-print p-4 bg-[#0F1E3D] text-white flex flex-wrap items-center justify-between gap-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <Printer className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-sm sm:text-base font-serif">
                    দাপ্তরিক স্টাফ ও শিক্ষক আইডি-পাসওয়ার্ড কার্ড ({toBengaliNumber(sortedFilteredStaff.length)} জন)
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    কর্মচারী ও কর্মকর্তাদের স্মার্টফোনে লগইন করিয়ে লক্ড ড্যাশবোর্ড সেটআপ করার জন্য প্রিন্ট বা PDF সেভ করুন।
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>প্রিন্ট / PDF সেভ</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintStaffCards(false)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto printable-area bg-white text-slate-900">
              <div className="text-center pb-4 border-b-2 border-slate-900 mb-5">
                <div className="flex items-center justify-center gap-3">
                  <SchoolLogo customLogoUrl={schoolInfo?.logoUrl} size={42} />
                  <div>
                    <h1 className="text-xl font-extrabold text-slate-950 font-serif">
                      {schoolInfo?.name || 'ডি-লিকন মডেল একাডেমী'}
                    </h1>
                    <p className="text-xs text-slate-600">
                      দাপ্তরিক পোর্টাল আইডি ও পাসওয়ার্ড কার্ড — স্মার্টফোন ড্যাশবোর্ড লগইন শিট
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 tabular-nums">
                {sortedFilteredStaff.map((st) => {
                  const meta = getDesignationMeta(st.designationBn);
                  return (
                    <div
                      key={st.id}
                      className="border border-slate-300 rounded-lg p-3.5 bg-white break-inside-avoid flex flex-col justify-between gap-2"
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-2">
                        <div>
                          <div className="font-bold text-sm text-slate-950">{st.nameBn}</div>
                          <div className="text-[11px] text-slate-600">
                            {toBengaliNumber(meta.order)}। {meta.labelBn}
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 border border-slate-300 rounded text-slate-700">
                          {st.role === 'official' ? 'অফিসিয়াল' : 'এমপ্লয়ী'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                        <div className="bg-slate-50 border border-slate-200 rounded p-2">
                          <div className="text-[10px] text-slate-500 font-semibold">পোর্টাল আইডি</div>
                          <div className="font-mono font-bold text-[#0F1E3D] text-xs mt-0.5 select-all">
                            {st.staffCode}
                          </div>
                        </div>
                        <div className="bg-slate-50 border border-slate-200 rounded p-2">
                          <div className="text-[10px] text-slate-500 font-semibold">পাসওয়ার্ড</div>
                          <div className="font-mono font-bold text-emerald-900 text-xs mt-0.5 select-all">
                            {st.password}
                          </div>
                        </div>
                      </div>

                      <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                        <span>মোবাইল: {st.phone || '-'}</span>
                        <span>লক নীতি: {isGlobalDeviceLockOn ? 'স্থায়ী লক্ড' : 'সাময়িক খোলা'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
