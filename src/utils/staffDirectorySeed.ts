import { StaffAccount } from '../types';
import { getDesignationMeta, normalizeStaffDesignation, resolveStaffCategoryKey } from './staffDesignations';
import { generateStaffPassword } from './credentialGenerator';

const ALL_CLASS_IDS = [
  'class_play',
  'class_nursery',
  'class_kg',
  'class_1',
  'class_2',
  'class_3',
  'class_4',
  'class_5',
];

const SEED_CREATED_AT = '2026-11-27T00:00:00.000Z';

export const CANONICAL_STAFF_ROSTER: StaffAccount[] = [
  // ১। শিক্ষা উদ্যোক্তা (৪ জন)
  {
    id: 'staff_ent_didar',
    staffCode: 'DL-DIR-01',
    role: 'official',
    categoryKey: 'education_entrepreneur',
    nameBn: 'দিদার',
    designationBn: 'শিক্ষা উদ্যোক্তা',
    phone: '01710000101',
    password: 'DR4829',
    department: 'administration',
    baseMonthlySalary: 25000,
    dailyShiftHours: 6,
    overtimeHourlyRate: 250,
    status: 'active',
    unlockEpoch: 0,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'staff_ent_mosharraf',
    staffCode: 'DL-DIR-02',
    role: 'official',
    categoryKey: 'education_entrepreneur',
    nameBn: 'মোশাররফ',
    designationBn: 'শিক্ষা উদ্যোক্তা',
    phone: '01710000102',
    password: 'DR7391',
    department: 'administration',
    baseMonthlySalary: 25000,
    dailyShiftHours: 6,
    overtimeHourlyRate: 250,
    status: 'active',
    unlockEpoch: 0,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'staff_ent_mokhles',
    staffCode: 'DL-DIR-03',
    role: 'official',
    categoryKey: 'education_entrepreneur',
    nameBn: 'মোখলেছ',
    designationBn: 'শিক্ষা উদ্যোক্তা',
    phone: '01710000103',
    password: 'DR5614',
    department: 'administration',
    baseMonthlySalary: 25000,
    dailyShiftHours: 6,
    overtimeHourlyRate: 250,
    status: 'active',
    unlockEpoch: 0,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'staff_ent_prince',
    staffCode: 'DL-DIR-04',
    role: 'official',
    categoryKey: 'education_entrepreneur',
    nameBn: 'প্রিন্স',
    designationBn: 'শিক্ষা উদ্যোক্তা',
    phone: '01710000104',
    password: 'DR8942',
    department: 'administration',
    baseMonthlySalary: 25000,
    dailyShiftHours: 6,
    overtimeHourlyRate: 250,
    status: 'active',
    unlockEpoch: 0,
    createdAt: SEED_CREATED_AT,
  },

  // ২। প্রিন্সিপাল (১ জন)
  {
    id: 'staff_principal_mitu',
    staffCode: 'DL-PRN-01',
    role: 'official',
    categoryKey: 'principal',
    nameBn: 'মিতু আক্তার',
    designationBn: 'প্রিন্সিপাল',
    phone: '01313159459',
    email: 'contact.dlikonmodelacademy@gmail.com',
    password: 'admin123',
    department: 'administration',
    baseMonthlySalary: 28000,
    dailyShiftHours: 8,
    overtimeHourlyRate: 250,
    status: 'active',
    unlockEpoch: 0,
    createdAt: SEED_CREATED_AT,
  },

  // ৩। সহ অধ্যক্ষ (১ জন)
  {
    id: 'staff_vp_sojib',
    staffCode: 'DL-VP-01',
    role: 'official',
    categoryKey: 'vice_principal',
    nameBn: 'সজীব',
    designationBn: 'সহ অধ্যক্ষ',
    phone: '01710000301',
    password: 'VP6382',
    department: 'administration',
    baseMonthlySalary: 22000,
    dailyShiftHours: 8,
    overtimeHourlyRate: 200,
    status: 'active',
    unlockEpoch: 0,
    createdAt: SEED_CREATED_AT,
  },

  // ৪। একাউন্টেন্ট কম কেরানী (১ জন)
  {
    id: 'staff_acc_clerk',
    staffCode: 'DL-ACC-01',
    role: 'employee',
    categoryKey: 'accountant_clerk',
    nameBn: 'একাউন্টেন্ট কম কেরানী',
    designationBn: 'একাউন্টেন্ট কম কেরানী',
    phone: '01710000401',
    password: 'AC5194',
    department: 'accounts',
    baseMonthlySalary: 16000,
    dailyShiftHours: 8,
    overtimeHourlyRate: 150,
    status: 'active',
    unlockEpoch: 0,
    createdAt: SEED_CREATED_AT,
  },

  // ৫। শিক্ষক মণ্ডলী (১০ জন)
  {
    id: 'staff_tch_mazharul',
    staffCode: 'DL-TCH-01',
    role: 'employee',
    categoryKey: 'teacher',
    nameBn: 'মাজহারুল',
    designationBn: 'শিক্ষক',
    phone: '01710000501',
    password: 'TC4182',
    department: 'academic',
    assignedClassIds: ALL_CLASS_IDS,
    baseMonthlySalary: 14000,
    dailyShiftHours: 7,
    overtimeHourlyRate: 150,
    status: 'active',
    unlockEpoch: 0,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'staff_tch_monir',
    staffCode: 'DL-TCH-02',
    role: 'employee',
    categoryKey: 'teacher',
    nameBn: 'মনির হোসেন',
    designationBn: 'শিক্ষক',
    phone: '01710000502',
    password: 'TC7539',
    department: 'academic',
    assignedClassIds: ALL_CLASS_IDS,
    baseMonthlySalary: 14000,
    dailyShiftHours: 7,
    overtimeHourlyRate: 150,
    status: 'active',
    unlockEpoch: 0,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'staff_tch_mokhles',
    staffCode: 'DL-TCH-03',
    role: 'employee',
    categoryKey: 'teacher',
    nameBn: 'মোখলেস',
    designationBn: 'শিক্ষক',
    phone: '01710000503',
    password: 'TC2964',
    department: 'academic',
    assignedClassIds: ALL_CLASS_IDS,
    baseMonthlySalary: 14000,
    dailyShiftHours: 7,
    overtimeHourlyRate: 150,
    status: 'active',
    unlockEpoch: 0,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'staff_tch_mahbub',
    staffCode: 'DL-TCH-04',
    role: 'employee',
    categoryKey: 'teacher',
    nameBn: 'মাহবুব এলাহী',
    designationBn: 'শিক্ষক',
    phone: '01710000504',
    password: 'TC8417',
    department: 'academic',
    assignedClassIds: ALL_CLASS_IDS,
    baseMonthlySalary: 14000,
    dailyShiftHours: 7,
    overtimeHourlyRate: 150,
    status: 'active',
    unlockEpoch: 0,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'staff_tch_khadiza',
    staffCode: 'DL-TCH-05',
    role: 'employee',
    categoryKey: 'teacher',
    nameBn: 'খাদিজা',
    designationBn: 'শিক্ষক',
    phone: '01710000505',
    password: 'TC6358',
    department: 'academic',
    assignedClassIds: ALL_CLASS_IDS,
    baseMonthlySalary: 14000,
    dailyShiftHours: 7,
    overtimeHourlyRate: 150,
    status: 'active',
    unlockEpoch: 0,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'staff_tch_mita',
    staffCode: 'DL-TCH-06',
    role: 'employee',
    categoryKey: 'teacher',
    nameBn: 'মিতা',
    designationBn: 'শিক্ষক',
    phone: '01710000506',
    password: 'TC9124',
    department: 'academic',
    assignedClassIds: ALL_CLASS_IDS,
    baseMonthlySalary: 14000,
    dailyShiftHours: 7,
    overtimeHourlyRate: 150,
    status: 'active',
    unlockEpoch: 0,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'staff_tch_salma',
    staffCode: 'DL-TCH-07',
    role: 'employee',
    categoryKey: 'teacher',
    nameBn: 'সালমা',
    designationBn: 'শিক্ষক',
    phone: '01710000507',
    password: 'TC3785',
    department: 'academic',
    assignedClassIds: ALL_CLASS_IDS,
    baseMonthlySalary: 14000,
    dailyShiftHours: 7,
    overtimeHourlyRate: 150,
    status: 'active',
    unlockEpoch: 0,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'staff_tch_shahnaz',
    staffCode: 'DL-TCH-08',
    role: 'employee',
    categoryKey: 'teacher',
    nameBn: 'শাহনাজ',
    designationBn: 'শিক্ষক',
    phone: '01710000508',
    password: 'TC5496',
    department: 'academic',
    assignedClassIds: ALL_CLASS_IDS,
    baseMonthlySalary: 14000,
    dailyShiftHours: 7,
    overtimeHourlyRate: 150,
    status: 'active',
    unlockEpoch: 0,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'staff_tch_runa',
    staffCode: 'DL-TCH-09',
    role: 'employee',
    categoryKey: 'teacher',
    nameBn: 'রুনা',
    designationBn: 'শিক্ষক',
    phone: '01710000509',
    password: 'TC6843',
    department: 'academic',
    assignedClassIds: ALL_CLASS_IDS,
    baseMonthlySalary: 14000,
    dailyShiftHours: 7,
    overtimeHourlyRate: 150,
    status: 'active',
    unlockEpoch: 0,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'staff_tch_shanta',
    staffCode: 'DL-TCH-10',
    role: 'employee',
    categoryKey: 'teacher',
    nameBn: 'শান্তা',
    designationBn: 'শিক্ষক',
    phone: '01710000510',
    password: 'TC8271',
    department: 'academic',
    assignedClassIds: ALL_CLASS_IDS,
    baseMonthlySalary: 14000,
    dailyShiftHours: 7,
    overtimeHourlyRate: 150,
    status: 'active',
    unlockEpoch: 0,
    createdAt: SEED_CREATED_AT,
  },

  // ৬। দপ্তরী (১ জন)
  {
    id: 'staff_dpt_sohel',
    staffCode: 'DL-DPT-01',
    role: 'employee',
    categoryKey: 'office_assistant',
    nameBn: 'সোয়েল',
    designationBn: 'দপ্তরী',
    phone: '01710000601',
    password: 'DP4739',
    department: 'office',
    baseMonthlySalary: 10000,
    dailyShiftHours: 8,
    overtimeHourlyRate: 100,
    status: 'active',
    unlockEpoch: 0,
    createdAt: SEED_CREATED_AT,
  },

  // ৭। আয়া (১ জন)
  {
    id: 'staff_aya_khala',
    staffCode: 'DL-AYA-01',
    role: 'employee',
    categoryKey: 'ayah',
    nameBn: 'খালা',
    designationBn: 'আয়া',
    phone: '01710000701',
    password: 'AY5826',
    department: 'office',
    baseMonthlySalary: 8500,
    dailyShiftHours: 8,
    overtimeHourlyRate: 80,
    status: 'active',
    unlockEpoch: 0,
    createdAt: SEED_CREATED_AT,
  },

  // ৮। নৈশ প্রহরী (১ জন)
  {
    id: 'staff_ng_bobul',
    staffCode: 'DL-NG-01',
    role: 'employee',
    categoryKey: 'night_guard',
    nameBn: 'বোবুল হোসেন',
    designationBn: 'নৈশ প্রহরী',
    phone: '01710000801',
    password: 'NG7195',
    department: 'security',
    baseMonthlySalary: 10500,
    dailyShiftHours: 10,
    overtimeHourlyRate: 90,
    status: 'active',
    unlockEpoch: 0,
    createdAt: SEED_CREATED_AT,
  },
];

const LEGACY_PLACEHOLDER_IDS = new Set(['staff_admin_default', 'staff_emp_default']);

export function mergeCanonicalStaffRoster(existingAccounts?: StaffAccount[] | null): StaffAccount[] {
  const existing = Array.isArray(existingAccounts) ? existingAccounts : [];
  const filteredExisting = existing.filter((a) => a && a.id && !LEGACY_PLACEHOLDER_IDS.has(a.id));

  const byId = new Map<string, StaffAccount>();
  for (const item of filteredExisting) {
    byId.set(item.id, item);
  }

  const merged: StaffAccount[] = [];
  const seenIds = new Set<string>();

  for (const seed of CANONICAL_STAFF_ROSTER) {
    const prev =
      byId.get(seed.id) ||
      filteredExisting.find((e) => e.staffCode && e.staffCode === seed.staffCode);
    const prevPwd = typeof prev?.password === 'string' ? prev.password.trim() : '';
    const resolvedPassword =
      !prevPwd || prevPwd === '123456' ? seed.password : prevPwd;
    const mergedItem: StaffAccount = prev
      ? {
          ...seed,
          ...prev,
          id: prev.id || seed.id,
          staffCode: prev.staffCode || seed.staffCode,
          password: resolvedPassword,
          unlockEpoch:
            typeof prev.unlockEpoch === 'number' && Number.isFinite(prev.unlockEpoch)
              ? Math.floor(prev.unlockEpoch)
              : 0,
          designationBn: normalizeStaffDesignation(prev.designationBn || seed.designationBn),
          categoryKey: resolveStaffCategoryKey(prev, seed.designationBn),
          baseMonthlySalary:
            typeof prev.baseMonthlySalary === 'number'
              ? prev.baseMonthlySalary
              : seed.baseMonthlySalary,
          dailyShiftHours:
            typeof prev.dailyShiftHours === 'number'
              ? prev.dailyShiftHours
              : seed.dailyShiftHours,
          overtimeHourlyRate:
            typeof prev.overtimeHourlyRate === 'number'
              ? prev.overtimeHourlyRate
              : seed.overtimeHourlyRate,
        }
      : { ...seed };

    merged.push(mergedItem);
    seenIds.add(mergedItem.id);
  }

  const usedPasswords = new Set(merged.map((m) => m.password.trim().toUpperCase()));

  // Keep any extra staff accounts added later by admin
  for (const extra of filteredExisting) {
    if (seenIds.has(extra.id)) continue;
    const normalizedDes = normalizeStaffDesignation(extra.designationBn);
    const meta = getDesignationMeta(normalizedDes);
    const extraPwd = typeof extra.password === 'string' ? extra.password.trim() : '';
    const safeExtraPwd =
      !extraPwd || extraPwd === '123456'
        ? generateStaffPassword(extra.staffCode || 'ST', usedPasswords)
        : extraPwd;
    usedPasswords.add(safeExtraPwd.toUpperCase());

    merged.push({
      ...extra,
      password: safeExtraPwd,
      unlockEpoch:
        typeof extra.unlockEpoch === 'number' && Number.isFinite(extra.unlockEpoch)
          ? Math.floor(extra.unlockEpoch)
          : 0,
      designationBn: normalizedDes,
      categoryKey: resolveStaffCategoryKey(extra, normalizedDes),
      baseMonthlySalary:
        typeof extra.baseMonthlySalary === 'number'
          ? extra.baseMonthlySalary
          : meta.defaultBaseSalary,
      dailyShiftHours:
        typeof extra.dailyShiftHours === 'number'
          ? extra.dailyShiftHours
          : meta.defaultShiftHours,
      overtimeHourlyRate:
        typeof extra.overtimeHourlyRate === 'number'
          ? extra.overtimeHourlyRate
          : meta.defaultOvertimeRatePerHour,
    });
    seenIds.add(extra.id);
  }

  return merged;
}
