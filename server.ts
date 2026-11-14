import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'school_database.json');
const DB_BAK_FILE = path.join(DATA_DIR, 'school_database.json.bak');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-memory cache for fast response and concurrency safety
let memoryDb: any = null;

function loadDatabaseFromFile(): any {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      if (raw && raw.trim().length > 0) {
        memoryDb = JSON.parse(raw);
        return memoryDb;
      }
    }
  } catch (err) {
    console.error('[Server DB] Error reading database file:', err);
    try {
      if (fs.existsSync(DB_BAK_FILE)) {
        const rawBak = fs.readFileSync(DB_BAK_FILE, 'utf-8');
        memoryDb = JSON.parse(rawBak);
        return memoryDb;
      }
    } catch {
      // Ignore
    }
  }
  return null;
}

const BACKUP_DIR = path.join(DATA_DIR, 'backups');
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function createTimestampedBackup(data: any) {
  try {
    if (!data || !Array.isArray(data.students) || data.students.length === 0) return;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `school_db_${timestamp}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(data, null, 2), 'utf-8');

    // Keep only last 30 backups
    const files = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith('school_db_') && f.endsWith('.json'))
      .sort();
    if (files.length > 30) {
      files.slice(0, files.length - 30).forEach((f) => {
        try {
          fs.unlinkSync(path.join(BACKUP_DIR, f));
        } catch {
          // Ignore
        }
      });
    }
  } catch (e) {
    console.warn('[Server Backup] Could not create timestamped backup:', e);
  }
}

function saveDatabaseToFile(data: any): boolean {
  try {
    memoryDb = data;
    const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
    const serialized = JSON.stringify(data, null, 2);

    fs.writeFileSync(tempFile, serialized, 'utf-8');

    // Backup current before replacing
    if (fs.existsSync(DB_FILE)) {
      try {
        fs.copyFileSync(DB_FILE, DB_BAK_FILE);
      } catch {
        // Non-fatal
      }
    }

    fs.renameSync(tempFile, DB_FILE);

    // Create timestamped snapshot if there are students
    if (Array.isArray(data.students) && data.students.length > 0) {
      createTimestampedBackup(data);
    }

    return true;
  } catch (err) {
    console.error('[Server DB] Error writing database file:', err);
    return false;
  }
}

// Initial load
loadDatabaseFromFile();

async function startServer() {
  const app = express();

  // Support large payloads (for passport photos, signatures, and batch student records)
  app.use(express.json({ limit: '60mb' }));
  app.use(express.urlencoded({ extended: true, limit: '60mb' }));

  // Privacy Protection: Prevent search engine crawlers from indexing student or guardian data
  app.use((_req, res, next) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    next();
  });

  // =========================================================================
  // API ROUTES
  // =========================================================================

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      time: new Date().toISOString(),
      studentCount: memoryDb?.students?.length ?? 0,
      hasSavedData: !!memoryDb,
    });
  });

  // GET complete school database
  app.get('/api/school-data', (_req, res) => {
    if (!memoryDb) {
      loadDatabaseFromFile();
    }
    if (memoryDb) {
      return res.json({
        success: true,
        exists: true,
        data: memoryDb,
        lastUpdated: memoryDb._lastUpdated || null,
      });
    }
    return res.json({
      success: true,
      exists: false,
      data: null,
    });
  });

  // POST save / synchronize complete school database
  app.post('/api/school-data', (req, res) => {
    try {
      const incoming = req.body;
      if (!incoming || typeof incoming !== 'object') {
        return res.status(400).json({ success: false, message: 'Invalid payload' });
      }

      // Protection: If incoming students is empty, but server already has students,
      // DO NOT erase server students unless explicitly requested via clear-all endpoint!
      let studentsToSave = incoming.students;
      if (
        (!Array.isArray(studentsToSave) || studentsToSave.length === 0) &&
        Array.isArray(memoryDb?.students) &&
        memoryDb.students.length > 0 &&
        !incoming.isExplicitClear
      ) {
        console.warn('[Server DB Safeguard] Preserved existing students against accidental empty sync');
        studentsToSave = memoryDb.students;
      } else if (Array.isArray(studentsToSave) && Array.isArray(memoryDb?.students) && !incoming.isExplicitClear) {
        // Smart merge per-student personal dashboard fields so mobile edits aren't overwritten by stale clients
        const serverStdMap = new Map<string, any>();
        for (const s of memoryDb.students) {
          if (s && s.id) serverStdMap.set(s.id, s);
        }
        studentsToSave = studentsToSave.map((incStd: any) => {
          if (!incStd || !incStd.id) return incStd;
          const srvStd = serverStdMap.get(incStd.id);
          if (!srvStd) return incStd;
          const mergedFuturePlan =
            incStd.futurePlan && srvStd.futurePlan
              ? new Date(srvStd.futurePlan.updatedAt || 0).getTime() > new Date(incStd.futurePlan.updatedAt || 0).getTime()
                ? srvStd.futurePlan
                : incStd.futurePlan
              : incStd.futurePlan || srvStd.futurePlan;
          const mergedAchievements =
            Array.isArray(incStd.achievements) && incStd.achievements.length > 0
              ? incStd.achievements
              : Array.isArray(srvStd.achievements)
              ? srvStd.achievements
              : undefined;
          const mergedDreamGallery =
            Array.isArray(incStd.dreamGallery)
              ? incStd.dreamGallery
              : Array.isArray(srvStd.dreamGallery)
              ? srvStd.dreamGallery
              : undefined;
          const mergedMonerBari =
            incStd.monerBari && srvStd.monerBari
              ? new Date(srvStd.monerBari.updatedAt || 0).getTime() > new Date(incStd.monerBari.updatedAt || 0).getTime()
                ? srvStd.monerBari
                : incStd.monerBari
              : incStd.monerBari || srvStd.monerBari;
          const mergedTimeManagement =
            incStd.timeManagement && srvStd.timeManagement
              ? new Date(srvStd.timeManagement.updatedAt || 0).getTime() > new Date(incStd.timeManagement.updatedAt || 0).getTime()
                ? srvStd.timeManagement
                : incStd.timeManagement
              : incStd.timeManagement || srvStd.timeManagement;
          return {
            ...incStd,
            futurePlan: mergedFuturePlan,
            achievements: mergedAchievements,
            dreamGallery: mergedDreamGallery,
            monerBari: mergedMonerBari,
            timeManagement: mergedTimeManagement,
            portalUserId: incStd.portalUserId || srvStd.portalUserId,
            guardianPin: incStd.guardianPin || srvStd.guardianPin,
          };
        });
      }

      // Smart merge securityLogs so guardian responses and new scans from other devices are never lost
      const serverLogs: any[] = Array.isArray(memoryDb?.securityLogs) ? memoryDb.securityLogs : [];
      const incomingLogs: any[] = Array.isArray(incoming.securityLogs) ? incoming.securityLogs : [];
      let mergedSecurityLogs = incomingLogs;

      if (!incoming.isExplicitClearLogs) {
        const logMap = new Map<string, any>();
        for (const sl of serverLogs) {
          if (sl && sl.id) logMap.set(sl.id, sl);
        }
        for (const il of incomingLogs) {
          if (il && il.id) {
            const existing = logMap.get(il.id);
            if (existing) {
              logMap.set(il.id, {
                ...il,
                ...existing,
                guardianAcknowledged: Boolean(existing.guardianAcknowledged || il.guardianAcknowledged),
                acknowledgedAt: existing.acknowledgedAt || il.acknowledgedAt,
                guardianResponse: existing.guardianResponse || il.guardianResponse,
                acknowledgedBy: existing.acknowledgedBy || il.acknowledgedBy,
              });
            } else {
              logMap.set(il.id, il);
            }
          }
        }
        mergedSecurityLogs = Array.from(logMap.values())
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 1000);
      }

      const existingStaffAccounts = Array.isArray(memoryDb?.staffAccounts) ? memoryDb.staffAccounts : [];
      const incomingStaffAccounts = Array.isArray(incoming.staffAccounts) ? incoming.staffAccounts : existingStaffAccounts;

      const existingStaffAttendance = Array.isArray(memoryDb?.staffAttendance) ? memoryDb.staffAttendance : [];
      const incomingStaffAttendance = Array.isArray(incoming.staffAttendance) ? incoming.staffAttendance : existingStaffAttendance;

      const existingAdmissionReqs = Array.isArray(memoryDb?.admissionRequests) ? memoryDb.admissionRequests : [];
      const incomingAdmissionReqs = Array.isArray(incoming.admissionRequests) ? incoming.admissionRequests : existingAdmissionReqs;

      const payload = {
        ...incoming,
        students: studentsToSave,
        securityLogs: mergedSecurityLogs,
        staffAccounts: incomingStaffAccounts.length > 0 ? incomingStaffAccounts : existingStaffAccounts,
        staffAttendance: incomingStaffAttendance.length > 0 ? incomingStaffAttendance : existingStaffAttendance,
        admissionRequests: incomingAdmissionReqs.length > 0 ? incomingAdmissionReqs : existingAdmissionReqs,
        _lastUpdated: new Date().toISOString(),
      };

      const saved = saveDatabaseToFile(payload);
      if (saved) {
        return res.json({
          success: true,
          message: 'Saved to central school database',
          lastUpdated: payload._lastUpdated,
          studentCount: payload.students?.length ?? 0,
        });
      } else {
        return res.status(500).json({ success: false, message: 'Failed to write to disk' });
      }
    } catch (err: any) {
      console.error('[Server API] Save error:', err);
      return res.status(500).json({ success: false, message: err?.message || 'Server error' });
    }
  });

  // Quick endpoint to update students specifically
  app.post('/api/students/bulk', (req, res) => {
    try {
      const { students, mode, classId } = req.body;
      if (!Array.isArray(students)) {
        return res.status(400).json({ success: false, message: 'Students array required' });
      }

      if (!memoryDb) {
        loadDatabaseFromFile();
      }

      let currentStudents = Array.isArray(memoryDb?.students) ? memoryDb.students : [];

      if (mode === 'replace') {
        if (classId) {
          currentStudents = currentStudents.filter((s: any) => s.classId !== classId);
        } else {
          currentStudents = [];
        }
        currentStudents = [...currentStudents, ...students];
      } else if (mode === 'upsert') {
        const studentMap = new Map();
        currentStudents.forEach((s: any) => studentMap.set(s.id, s));
        students.forEach((s: any) => studentMap.set(s.id, s));
        currentStudents = Array.from(studentMap.values());
      } else {
        // Append
        currentStudents = [...currentStudents, ...students];
      }

      const updatedDb = {
        ...(memoryDb || {}),
        students: currentStudents,
        _lastUpdated: new Date().toISOString(),
      };

      saveDatabaseToFile(updatedDb);
      return res.json({
        success: true,
        count: currentStudents.length,
        message: 'Students synced to central database',
      });
    } catch (err: any) {
      console.error('[Server API] Students bulk error:', err);
      return res.status(500).json({ success: false, message: err?.message || 'Server error' });
    }
  });

  // Update individual student profile / futurePlan / achievements / password from Personal Dashboard
  app.post('/api/student/profile-update', (req, res) => {
    try {
      const { studentId, updates } = req.body;
      if (!studentId || !updates || typeof updates !== 'object') {
        return res.status(400).json({ success: false, message: 'studentId and updates required' });
      }

      if (!memoryDb) {
        loadDatabaseFromFile();
      }

      const currentStudents: any[] = Array.isArray(memoryDb?.students) ? memoryDb.students : [];
      let updatedStudent: any = null;
      const nextStudents = currentStudents.map((s) => {
        if (s.id === studentId) {
          updatedStudent = {
            ...s,
            ...updates,
            id: s.id,
          };
          return updatedStudent;
        }
        return s;
      });

      if (!updatedStudent) {
        return res.status(404).json({ success: false, message: 'Student not found' });
      }

      const updatedDb = {
        ...(memoryDb || {}),
        students: nextStudents,
        _lastUpdated: new Date().toISOString(),
      };

      saveDatabaseToFile(updatedDb);
      return res.json({
        success: true,
        message: 'শিক্ষার্থীর প্রোফাইল সফলভাবে সংরক্ষিত হয়েছে',
        student: updatedStudent,
      });
    } catch (err: any) {
      console.error('[Server API] Student profile update error:', err);
      return res.status(500).json({ success: false, message: err?.message || 'Server error' });
    }
  });

  // Dedicated endpoint to clear all student records (for preparing fresh imports)
  app.post('/api/students/clear-all', (_req, res) => {
    try {
      if (!memoryDb) {
        loadDatabaseFromFile();
      }
      const updatedDb = {
        ...(memoryDb || {}),
        students: [],
        examRecords: {},
        attendanceRecords: {},
        feeInvoices: [],
        feeReceipts: [],
        securityLogs: [],
        _lastUpdated: new Date().toISOString(),
      };

      saveDatabaseToFile(updatedDb);
      return res.json({
        success: true,
        message: 'সকল ডেমো শিক্ষার্থী ও সংশ্লিষ্ট রেকর্ড সফলভাবে মুছে ফেলা হয়েছে',
        studentCount: 0,
      });
    } catch (err: any) {
      console.error('[Server API] Clear all students error:', err);
      return res.status(500).json({ success: false, message: err?.message || 'Server error' });
    }
  });

  // =========================================================================
  // REAL-TIME SECURITY GATEPASS & GUARDIAN AUDIO ALARM ENDPOINTS
  // =========================================================================

  // POST new scan event from school gate (broadcasts immediately across devices)
  app.post('/api/security/scan', (req, res) => {
    try {
      const { log } = req.body;
      if (!log || !log.studentId) {
        return res.status(400).json({ success: false, message: 'Valid gatepass log required' });
      }

      if (!memoryDb) {
        loadDatabaseFromFile();
      }

      const savedLog = {
        ...log,
        serverTimestamp: Date.now(),
      };

      const existingLogs: any[] = Array.isArray(memoryDb?.securityLogs) ? memoryDb.securityLogs : [];
      const withoutDup = existingLogs.filter((l) => l.id !== savedLog.id);
      // Prepend new log and keep latest 1000 logs
      const updatedLogs = [savedLog, ...withoutDup].slice(0, 1000);

      const updatedDb = {
        ...(memoryDb || {}),
        securityLogs: updatedLogs,
        _lastSecurityEvent: savedLog,
        _lastUpdated: new Date().toISOString(),
      };

      saveDatabaseToFile(updatedDb);

      return res.json({
        success: true,
        message: 'Gatepass scan logged and synced across all devices',
        log: savedLog,
      });
    } catch (err: any) {
      console.error('[Server API] Security scan log error:', err);
      return res.status(500).json({ success: false, message: err?.message || 'Server error' });
    }
  });

  // POST guardian acknowledgement / response (counted in central database)
  app.post('/api/security/acknowledge', (req, res) => {
    try {
      const { logId, studentId, guardianResponse, acknowledgedBy } = req.body;
      if (!logId && !studentId) {
        return res.status(400).json({ success: false, message: 'logId or studentId required' });
      }

      if (!memoryDb) {
        loadDatabaseFromFile();
      }

      const existingLogs: any[] = Array.isArray(memoryDb?.securityLogs) ? memoryDb.securityLogs : [];
      let updatedTarget: any = null;
      const ackTime = new Date().toISOString();
      const responseText = (guardianResponse && String(guardianResponse).trim()) || 'মেসেজ শুনেছি ও নিশ্চিত করলাম';

      const updatedLogs = existingLogs.map((l) => {
        if (!updatedTarget && ((logId && l.id === logId) || (!logId && studentId && l.studentId === studentId))) {
          updatedTarget = {
            ...l,
            guardianAcknowledged: true,
            acknowledgedAt: ackTime,
            guardianResponse: responseText,
            acknowledgedBy: acknowledgedBy || 'অভিভাবক',
          };
          return updatedTarget;
        }
        return l;
      });

      if (!updatedTarget) {
        return res.status(404).json({ success: false, message: 'Target security log not found' });
      }

      const updatedDb = {
        ...(memoryDb || {}),
        securityLogs: updatedLogs,
        _lastUpdated: ackTime,
      };

      saveDatabaseToFile(updatedDb);

      const totalAcknowledgedCount = updatedLogs.filter((l) => l.guardianAcknowledged).length;

      return res.json({
        success: true,
        message: 'Guardian response recorded in school database',
        log: updatedTarget,
        totalAcknowledgedCount,
      });
    } catch (err: any) {
      console.error('[Server API] Security acknowledge error:', err);
      return res.status(500).json({ success: false, message: err?.message || 'Server error' });
    }
  });

  // GET latest security logs since a timestamp, optionally filtered for a student
  app.get('/api/security/latest-logs', (req, res) => {
    try {
      if (!memoryDb) {
        loadDatabaseFromFile();
      }

      const since = Number(req.query.since) || 0;
      const studentId = (req.query.studentId as string) || '';

      const logs: any[] = Array.isArray(memoryDb?.securityLogs) ? memoryDb.securityLogs : [];

      const filtered = logs.filter((l) => {
        const logTime =
          typeof l.serverTimestamp === 'number'
            ? l.serverTimestamp
            : typeof l.timestamp === 'number'
            ? l.timestamp
            : new Date(l.timestamp).getTime() || 0;
        const matchesTime = since > 0 ? logTime > since : true;
        const matchesStudent = studentId ? l.studentId === studentId : true;
        return matchesTime && matchesStudent;
      });

      const totalAcknowledgedCount = logs.filter((l) => l.guardianAcknowledged).length;

      return res.json({
        success: true,
        logs: filtered,
        allLogsCount: logs.length,
        totalAcknowledgedCount,
        serverTime: Date.now(),
        lastEvent: memoryDb?._lastSecurityEvent || null,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message });
    }
  });

  // GET list of available server backups
  app.get('/api/backups/list', (_req, res) => {
    try {
      if (!fs.existsSync(BACKUP_DIR)) {
        return res.json({ success: true, backups: [] });
      }
      const files = fs
        .readdirSync(BACKUP_DIR)
        .filter((f) => f.startsWith('school_db_') && f.endsWith('.json'))
        .sort()
        .reverse()
        .map((f) => {
          const stats = fs.statSync(path.join(BACKUP_DIR, f));
          return {
            filename: f,
            createdAt: stats.mtime.toISOString(),
            size: stats.size,
          };
        });
      return res.json({ success: true, backups: files });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message });
    }
  });

  // POST restore from a server backup
  app.post('/api/backups/restore', (req, res) => {
    try {
      const { filename } = req.body;
      if (!filename || typeof filename !== 'string') {
        return res.status(400).json({ success: false, message: 'Filename required' });
      }
      const safeFilename = path.basename(filename);
      const targetPath = path.join(BACKUP_DIR, safeFilename);
      if (!fs.existsSync(targetPath)) {
        return res.status(404).json({ success: false, message: 'Backup file not found' });
      }
      const raw = fs.readFileSync(targetPath, 'utf-8');
      const data = JSON.parse(raw);
      saveDatabaseToFile(data);
      return res.json({
        success: true,
        message: 'সফলভাবে ব্যাকআপ থেকে ডেটা পুনরুদ্ধার করা হয়েছে',
        studentCount: data.students?.length ?? 0,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message });
    }
  });

  // =========================================================================
  // 3-PORTAL ROLE AUTHENTICATION, SIGN-UP & STAFF WORKSPACE ENDPOINTS
  // =========================================================================

  const normalizeDigitsServer = (val: any): string => {
    if (val === null || val === undefined) return '';
    const map: Record<string, string> = {
      '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
      '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
    };
    return String(val).replace(/[০-৯]/g, (d) => map[d] || d).trim();
  };

  const getStudentPortalIdServer = (student: any): string => {
    if (student?.portalUserId && String(student.portalUserId).trim()) {
      return String(student.portalUserId).trim().toUpperCase();
    }
    const classCodeMap: Record<string, string> = {
      class_play: 'PL',
      class_nursery: 'NU',
      class_kg: 'KG',
      class_1: 'C1',
      class_2: 'C2',
      class_3: 'C3',
      class_4: 'C4',
      class_5: 'C5',
      class_6: 'C6',
      class_7: 'C7',
      class_8: 'C8',
      class_9: 'C9',
      class_10: 'C10',
    };
    const cls = String(student?.classId || '');
    const clsCode = classCodeMap[cls] || cls.replace('class_', '').toUpperCase().slice(0, 3) || 'ST';
    const rollStr = String(student?.roll || 0).padStart(2, '0');
    return `DL-${clsCode}-${rollStr}`;
  };

  const ensureStarterStaffAccounts = (db: any): any[] => {
    const existing: any[] = Array.isArray(db?.staffAccounts) ? db.staffAccounts : [];
    if (existing.length > 0) return existing;
    const now = new Date().toISOString();
    return [
      {
        id: 'staff_admin_default',
        staffCode: 'DL-ADMIN',
        role: 'official',
        nameBn: 'প্রধান প্রশাসক ও অধ্যক্ষ',
        designationBn: 'প্রধান শিক্ষক / পরিচালক',
        phone: db?.schoolInfo?.phone || '01313159459',
        email: db?.schoolInfo?.email || 'contact.dlikonmodelacademy@gmail.com',
        password: 'admin123',
        department: 'administration',
        status: 'active',
        createdAt: now,
      },
      {
        id: 'staff_emp_default',
        staffCode: 'DL-EMP-01',
        role: 'employee',
        nameBn: 'সহকারী শিক্ষক (একাডেমিক ও গেট)',
        designationBn: 'সহকারী শিক্ষক',
        phone: '01711000001',
        email: 'teacher@dlikon.edu.bd',
        password: 'emp123',
        department: 'academic',
        assignedClassIds: ['class_play', 'class_nursery', 'class_kg', 'class_1', 'class_2', 'class_3', 'class_4', 'class_5'],
        status: 'active',
        createdAt: now,
      },
    ];
  };

  // POST login for Official / Employee / Student
  app.post('/api/auth/login', (req, res) => {
    try {
      if (!memoryDb) loadDatabaseFromFile();
      const { role, identifier, password, classId } = req.body || {};
      const rawId = String(identifier || '').trim();
      const normId = normalizeDigitsServer(rawId).toLowerCase();
      const normPass = normalizeDigitsServer(String(password || '')).trim();

      if (!rawId || !normPass) {
        return res.status(400).json({ success: false, message: 'ইউজার আইডি/মোবাইল এবং পাসওয়ার্ড দিন।' });
      }

      if (role === 'official' || role === 'employee') {
        const accounts = ensureStarterStaffAccounts(memoryDb);
        if (!Array.isArray(memoryDb?.staffAccounts) || memoryDb.staffAccounts.length === 0) {
          saveDatabaseToFile({ ...(memoryDb || {}), staffAccounts: accounts });
        }
        const matched = accounts.find((acc: any) => {
          if (acc.role !== role) return false;
          const codeMatch = String(acc.staffCode || '').toLowerCase() === normId;
          const emailMatch = acc.email && String(acc.email).toLowerCase() === normId;
          const phoneMatch =
            normId.replace(/\D/g, '').length >= 6 &&
            normalizeDigitsServer(acc.phone || '').replace(/\D/g, '').endsWith(normId.replace(/\D/g, '').slice(-8));
          const adminAlias = role === 'official' && normId === 'admin' && String(acc.staffCode).toLowerCase() === 'dl-admin';
          return codeMatch || emailMatch || phoneMatch || adminAlias;
        });

        if (!matched) {
          return res.status(401).json({
            success: false,
            message: role === 'official'
              ? 'সঠিক অফিসিয়াল আইডি বা মোবাইল পাওয়া যায়নি।'
              : 'সঠিক এমপ্লয়ী আইডি বা মোবাইল পাওয়া যায়নি। নতুন হলে সাইন আপ করুন।',
          });
        }
        if (matched.status === 'pending') {
          return res.status(403).json({
            success: false,
            message: 'আপনার অ্যাকাউন্টটি অফিসিয়াল অনুমোদনের অপেক্ষায় রয়েছে।',
          });
        }
        const expected = normalizeDigitsServer(matched.password || '').trim();
        if (normPass !== expected && normPass.toLowerCase() !== expected.toLowerCase()) {
          return res.status(401).json({ success: false, message: 'পাসওয়ার্ড সঠিক নয়!' });
        }

        const safeStaff = { ...matched };
        delete safeStaff.password;
        return res.json({
          success: true,
          session: {
            role: matched.role,
            accountId: matched.id,
            displayName: matched.nameBn,
            subLabel: matched.designationBn,
            staffCode: matched.staffCode,
          },
          staff: safeStaff,
        });
      }

      if (role === 'student') {
        const studentsList: any[] = Array.isArray(memoryDb?.students) ? memoryDb.students : [];
        const pool = classId && classId !== 'all'
          ? studentsList.filter((s) => s.classId === classId)
          : studentsList;

        const cleanDigits = normId.replace(/\D/g, '');
        const upperRaw = rawId.toUpperCase();

        let matchedStudent = studentsList.find((s) => {
          const pCode = getStudentPortalIdServer(s).toUpperCase();
          return (
            pCode === upperRaw ||
            String(s.id).toLowerCase() === normId ||
            (s.securityQrCode && String(s.securityQrCode).toLowerCase() === normId)
          );
        });

        if (!matchedStudent && cleanDigits.length >= 6) {
          matchedStudent = pool.find((s) =>
            [s.guardianPhone, s.fatherPhone, s.motherPhone, s.emergencyPhone].some(
              (ph) => ph && normalizeDigitsServer(ph).replace(/\D/g, '').endsWith(cleanDigits.slice(-8))
            )
          );
        }

        if (!matchedStudent && cleanDigits.length > 0 && cleanDigits.length <= 3 && !normId.includes('-')) {
          const rollMatches = pool.filter((s) => String(s.roll) === String(Number(cleanDigits)));
          if (rollMatches.length > 1 && (!classId || classId === 'all')) {
            return res.status(400).json({
              success: false,
              message: `রোল ${cleanDigits} একাধিক শ্রেণিতে রয়েছে! অনুগ্রহ করে আপনার সন্তানের নির্দিষ্ট শ্রেণি সিলেক্ট করুন অথবা ইউনিক আইডি (যেমন: DL-C4-01) দিন।`,
            });
          }
          matchedStudent = rollMatches[0];
        }

        if (!matchedStudent) {
          return res.status(404).json({
            success: false,
            message: 'প্রদত্ত ইউনিক আইডি, শ্রেণি, রোল বা মোবাইল নম্বরের কোনো শিক্ষার্থী পাওয়া যায়নি।',
          });
        }

        const expectedPin = normalizeDigitsServer(matchedStudent.guardianPin || '1234').toLowerCase();
        if (normPass.toLowerCase() !== expectedPin) {
          return res.status(401).json({
            success: false,
            message: 'ভুল পাসওয়ার্ড/পিন কোড! প্রথমবার হলে ডিফল্ট পিন 1234 দিন অথবা "সাইন আপ / পাসওয়ার্ড সেট" ট্যাবে পিন তৈরি করুন।',
          });
        }

        const classesList: any[] = Array.isArray(memoryDb?.classes) ? memoryDb.classes : [];
        const clsObj = classesList.find((c) => c.id === matchedStudent.classId);

        return res.json({
          success: true,
          session: {
            role: 'student',
            accountId: matchedStudent.id,
            displayName: matchedStudent.nameBn,
            subLabel: `${clsObj?.nameBn || matchedStudent.classId} • রোল ${matchedStudent.roll}`,
            staffCode: getStudentPortalIdServer(matchedStudent),
          },
          student: matchedStudent,
        });
      }

      return res.status(400).json({ success: false, message: 'অবৈধ পোর্টাল ভূমিকা।' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Login error' });
    }
  });

  // POST Sign Up new Official or Employee account
  app.post('/api/auth/register-staff', (req, res) => {
    try {
      if (!memoryDb) loadDatabaseFromFile();
      const { role, nameBn, designationBn, phone, email, password, department, assignedClassIds, officialInviteCode } = req.body || {};

      if (!nameBn || !phone || !password) {
        return res.status(400).json({ success: false, message: 'নাম, মোবাইল নম্বর ও পাসওয়ার্ড আবশ্যক।' });
      }
      if (String(password).trim().length < 4) {
        return res.status(400).json({ success: false, message: 'পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে।' });
      }

      const accounts = ensureStarterStaffAccounts(memoryDb);

      if (role === 'official') {
        const officialAdmins = accounts.filter((a: any) => a.role === 'official');
        const inviteNorm = normalizeDigitsServer(officialInviteCode || '');
        const validCode =
          inviteNorm.toUpperCase() === 'DL-ADMIN' ||
          officialAdmins.some((adm: any) => normalizeDigitsServer(adm.password) === inviteNorm);
        if (!validCode) {
          return res.status(403).json({
            success: false,
            message: 'অফিসিয়াল সাইন আপের জন্য সঠিক প্রতিষ্ঠানের ভেরিফিকেশন কোড (ডিফল্ট: DL-ADMIN) প্রয়োজন।',
          });
        }
      }

      const cleanPhone = normalizeDigitsServer(phone).replace(/\D/g, '');
      const duplicate = accounts.find(
        (a: any) =>
          a.role === role &&
          ((cleanPhone.length >= 6 && normalizeDigitsServer(a.phone || '').replace(/\D/g, '').endsWith(cleanPhone.slice(-8))) ||
            (email && a.email && String(a.email).toLowerCase() === String(email).trim().toLowerCase()))
      );
      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: `এই মোবাইল বা ই-মেইল দিয়ে ইতিমধ্যেই একটি অ্যাকাউন্ট (${duplicate.staffCode}) রয়েছে! সাইন ইন করুন।`,
        });
      }

      const countForRole = accounts.filter((a: any) => a.role === role).length + 1;
      const prefix = role === 'official' ? 'DL-OFF' : 'DL-EMP';
      const staffCode = `${prefix}-${String(countForRole).padStart(2, '0')}`;

      const newStaff = {
        id: `staff_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        staffCode,
        role: role === 'official' ? 'official' : 'employee',
        nameBn: String(nameBn).trim(),
        designationBn: String(designationBn || (role === 'official' ? 'অফিস প্রশাসক' : 'সহকারী শিক্ষক')).trim(),
        phone: String(phone).trim(),
        email: email ? String(email).trim() : '',
        password: String(password).trim(),
        department: department || (role === 'official' ? 'administration' : 'academic'),
        assignedClassIds: Array.isArray(assignedClassIds) && assignedClassIds.length > 0
          ? assignedClassIds
          : ['class_play', 'class_nursery', 'class_kg', 'class_1', 'class_2', 'class_3', 'class_4', 'class_5'],
        status: 'active',
        createdAt: new Date().toISOString(),
      };

      const nextAccounts = [...accounts, newStaff];
      saveDatabaseToFile({
        ...(memoryDb || {}),
        staffAccounts: nextAccounts,
        _lastUpdated: new Date().toISOString(),
      });

      const safeStaff = { ...newStaff };
      delete (safeStaff as any).password;

      return res.json({
        success: true,
        message: 'নিবন্ধন সফলভাবে সম্পন্ন হয়েছে!',
        session: {
          role: newStaff.role,
          accountId: newStaff.id,
          displayName: newStaff.nameBn,
          subLabel: newStaff.designationBn,
          staffCode: newStaff.staffCode,
        },
        staff: safeStaff,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Registration error' });
    }
  });

  // POST Activate Student Account / Set Personal Password
  app.post('/api/auth/activate-student', (req, res) => {
    try {
      if (!memoryDb) loadDatabaseFromFile();
      const { classId, roll, guardianPhone, newPassword } = req.body || {};
      if (!classId || !roll || !newPassword || String(newPassword).trim().length < 4) {
        return res.status(400).json({
          success: false,
          message: 'শ্রেণি, রোল নম্বর এবং কমপক্ষে ৪ অক্ষরের নতুন পাসওয়ার্ড দিন।',
        });
      }

      const studentsList: any[] = Array.isArray(memoryDb?.students) ? memoryDb.students : [];
      const rollNum = Number(normalizeDigitsServer(roll));
      const idx = studentsList.findIndex(
        (s) => s.classId === classId && Number(s.roll) === rollNum
      );

      if (idx === -1) {
        return res.status(404).json({
          success: false,
          message: 'উক্ত শ্রেণি ও রোলের কোনো নিবন্ধিত শিক্ষার্থী পাওয়া যায়নি। নতুন শিক্ষার্থী হলে নিচের ভর্তি আবেদন ফর্ম পূরণ করুন।',
        });
      }

      const student = studentsList[idx];
      const cleanInputPhone = normalizeDigitsServer(guardianPhone || '').replace(/\D/g, '');
      const knownPhones = [student.guardianPhone, student.fatherPhone, student.motherPhone, student.emergencyPhone]
        .filter(Boolean)
        .map((p: string) => normalizeDigitsServer(p).replace(/\D/g, ''));

      if (knownPhones.length > 0 && cleanInputPhone.length >= 6) {
        const phoneMatched = knownPhones.some((kp: string) => kp.endsWith(cleanInputPhone.slice(-8)));
        if (!phoneMatched) {
          return res.status(403).json({
            success: false,
            message: 'অভিভাবকের মোবাইল নম্বর শিক্ষার্থীর রেকর্ডের সাথে মেলেনি! সঠিক নম্বর দিন অথবা অফিস থেকে যাচাই করুন।',
          });
        }
      }

      const portalCode = getStudentPortalIdServer(student);
      const updatedStudent = {
        ...student,
        portalUserId: portalCode,
        guardianPin: String(newPassword).trim(),
        guardianPhone: student.guardianPhone || (guardianPhone ? String(guardianPhone).trim() : ''),
      };

      const nextStudents = [...studentsList];
      nextStudents[idx] = updatedStudent;

      saveDatabaseToFile({
        ...(memoryDb || {}),
        students: nextStudents,
        _lastUpdated: new Date().toISOString(),
      });

      const classesList: any[] = Array.isArray(memoryDb?.classes) ? memoryDb.classes : [];
      const clsObj = classesList.find((c) => c.id === updatedStudent.classId);

      return res.json({
        success: true,
        message: 'শিক্ষার্থীর পোর্টাল অ্যাকাউন্ট সক্রিয় ও পাসওয়ার্ড সেট হয়েছে!',
        session: {
          role: 'student',
          accountId: updatedStudent.id,
          displayName: updatedStudent.nameBn,
          subLabel: `${clsObj?.nameBn || updatedStudent.classId} • রোল ${updatedStudent.roll}`,
          staffCode: portalCode,
        },
        student: updatedStudent,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Activation error' });
    }
  });

  // POST New Student Admission Signup Request (for unregistered students)
  app.post('/api/auth/request-student-signup', (req, res) => {
    try {
      if (!memoryDb) loadDatabaseFromFile();
      const { studentNameBn, classId, desiredRoll, guardianNameBn, guardianPhone, password } = req.body || {};
      if (!studentNameBn || !classId || !guardianNameBn || !guardianPhone || !password) {
        return res.status(400).json({ success: false, message: 'শিক্ষার্থীর নাম, শ্রেণি, অভিভাবকের নাম, মোবাইল ও পাসওয়ার্ড দিন।' });
      }

      const existingReqs: any[] = Array.isArray(memoryDb?.admissionRequests) ? memoryDb.admissionRequests : [];
      const newReq = {
        id: `adm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        studentNameBn: String(studentNameBn).trim(),
        classId: String(classId),
        desiredRoll: desiredRoll ? Number(normalizeDigitsServer(desiredRoll)) : undefined,
        guardianNameBn: String(guardianNameBn).trim(),
        guardianPhone: String(guardianPhone).trim(),
        password: String(password).trim(),
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      saveDatabaseToFile({
        ...(memoryDb || {}),
        admissionRequests: [newReq, ...existingReqs],
        _lastUpdated: new Date().toISOString(),
      });

      return res.json({
        success: true,
        message: 'ভর্তি ও অ্যাকাউন্ট আবেদন জমা হয়েছে! অফিসিয়াল অ্যাডমিন অনুমোদন করলে লগইন করতে পারবেন।',
        request: newReq,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Signup request error' });
    }
  });

  // GET Staff accounts, staff attendance & pending admission requests (for Official & Employee dashboards)
  app.get('/api/staff/overview', (_req, res) => {
    try {
      if (!memoryDb) loadDatabaseFromFile();
      const accounts = ensureStarterStaffAccounts(memoryDb);
      if (!Array.isArray(memoryDb?.staffAccounts) || memoryDb.staffAccounts.length === 0) {
        saveDatabaseToFile({ ...(memoryDb || {}), staffAccounts: accounts });
      }
      const staffAttendance: any[] = Array.isArray(memoryDb?.staffAttendance) ? memoryDb.staffAttendance : [];
      const admissionRequests: any[] = Array.isArray(memoryDb?.admissionRequests) ? memoryDb.admissionRequests : [];
      return res.json({
        success: true,
        staffAccounts: accounts,
        staffAttendance,
        admissionRequests,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Error fetching staff overview' });
    }
  });

  // POST Record Employee Self Check-in / Check-out
  app.post('/api/staff/attendance', (req, res) => {
    try {
      if (!memoryDb) loadDatabaseFromFile();
      const { staffId, staffNameBn, designationBn, action, note } = req.body || {};
      if (!staffId) {
        return res.status(400).json({ success: false, message: 'staffId required' });
      }

      const today = new Date().toISOString().split('T')[0];
      const nowTime = new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit', hour12: true });
      const recordId = `${staffId}_${today}`;

      const list: any[] = Array.isArray(memoryDb?.staffAttendance) ? memoryDb.staffAttendance : [];
      const existingIdx = list.findIndex((r) => r.id === recordId);

      let savedRecord: any;
      let nextList = [...list];

      if (existingIdx !== -1) {
        savedRecord = {
          ...list[existingIdx],
          ...(action === 'checkout' ? { checkOutTime: nowTime } : { checkInTime: list[existingIdx].checkInTime || nowTime }),
          note: note || list[existingIdx].note,
        };
        nextList[existingIdx] = savedRecord;
      } else {
        savedRecord = {
          id: recordId,
          staffId,
          staffNameBn: staffNameBn || 'এমপ্লয়ী',
          designationBn: designationBn || 'শিক্ষক/স্টাফ',
          date: today,
          checkInTime: nowTime,
          status: 'present',
          note: note || '',
        };
        nextList = [savedRecord, ...nextList];
      }

      saveDatabaseToFile({
        ...(memoryDb || {}),
        staffAttendance: nextList.slice(0, 500),
        _lastUpdated: new Date().toISOString(),
      });

      return res.json({
        success: true,
        record: savedRecord,
        staffAttendance: nextList.slice(0, 500),
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Attendance error' });
    }
  });

  // POST Official Management of Staff Accounts & Admission Requests
  app.post('/api/staff/manage', (req, res) => {
    try {
      if (!memoryDb) loadDatabaseFromFile();
      const { type, payload } = req.body || {};
      const accounts = ensureStarterStaffAccounts(memoryDb);
      const requests: any[] = Array.isArray(memoryDb?.admissionRequests) ? memoryDb.admissionRequests : [];

      if (type === 'upsert_staff') {
        const idx = accounts.findIndex((a: any) => a.id === payload.id);
        const nextAccounts = idx !== -1
          ? accounts.map((a: any, i: number) => (i === idx ? { ...a, ...payload } : a))
          : [...accounts, payload];
        saveDatabaseToFile({ ...(memoryDb || {}), staffAccounts: nextAccounts, _lastUpdated: new Date().toISOString() });
        return res.json({ success: true, staffAccounts: nextAccounts });
      }

      if (type === 'delete_staff') {
        const nextAccounts = accounts.filter((a: any) => a.id !== payload.id);
        saveDatabaseToFile({ ...(memoryDb || {}), staffAccounts: nextAccounts, _lastUpdated: new Date().toISOString() });
        return res.json({ success: true, staffAccounts: nextAccounts });
      }

      if (type === 'approve_admission') {
        const targetReq = requests.find((r) => r.id === payload.requestId);
        if (!targetReq) {
          return res.status(404).json({ success: false, message: 'Request not found' });
        }
        const studentsList: any[] = Array.isArray(memoryDb?.students) ? memoryDb.students : [];
        const classStudents = studentsList.filter((s) => s.classId === targetReq.classId);
        const maxRoll = classStudents.reduce((max, s) => Math.max(max, Number(s.roll) || 0), 0);
        const assignedRoll = targetReq.desiredRoll || maxRoll + 1;

        const newStudent: any = {
          id: `std_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          nameBn: targetReq.studentNameBn,
          roll: assignedRoll,
          classId: targetReq.classId,
          section: 'ক',
          academicYear: '২০২৬',
          fatherNameBn: targetReq.guardianNameBn,
          guardianName: targetReq.guardianNameBn,
          guardianPhone: targetReq.guardianPhone,
          fatherPhone: targetReq.guardianPhone,
          guardianPin: targetReq.password || '1234',
        };
        newStudent.portalUserId = getStudentPortalIdServer(newStudent);

        const nextStudents = [...studentsList, newStudent];
        const nextRequests = requests.map((r) => (r.id === payload.requestId ? { ...r, status: 'approved' } : r));

        saveDatabaseToFile({
          ...(memoryDb || {}),
          students: nextStudents,
          admissionRequests: nextRequests,
          _lastUpdated: new Date().toISOString(),
        });

        return res.json({ success: true, student: newStudent, admissionRequests: nextRequests });
      }

      if (type === 'reject_admission') {
        const nextRequests = requests.map((r) => (r.id === payload.requestId ? { ...r, status: 'rejected' } : r));
        saveDatabaseToFile({ ...(memoryDb || {}), admissionRequests: nextRequests, _lastUpdated: new Date().toISOString() });
        return res.json({ success: true, admissionRequests: nextRequests });
      }

      return res.status(400).json({ success: false, message: 'Unknown staff management action' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Staff management error' });
    }
  });

  // =========================================================================
  const httpServer = http.createServer(app);

  // =========================================================================
  // VITE DEV MIDDLEWARE / STATIC PROD SERVING
  // =========================================================================
  if (!IS_PROD) {
    const isHmrDisabled = process.env.DISABLE_HMR === 'true' || process.env.ENABLE_HMR !== 'true';

    // When HMR is disabled, Vite still injects /@vite/client which attempts a WebSocket handshake
    // that fails behind preview reverse-proxies ("WebSocket closed without opened.").
    // Serve a compatible no-WebSocket client shim so CSS/module helpers work with zero WS errors.
    if (isHmrDisabled) {
      app.get('/@vite/client', (_req, res) => {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.send(`
const sheetsMap = new Map();
export function updateStyle(id, content) {
  if (typeof document === 'undefined') return;
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    document.head.appendChild(style);
    sheetsMap.set(id, style);
  } else {
    style.textContent = content;
  }
}
export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style && style.parentNode) {
    style.parentNode.removeChild(style);
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
export function injectQuery(url, queryToInject) {
  if (!url || (url[0] !== '.' && url[0] !== '/')) return url;
  const pathname = url.replace(/[?#].*$/, '');
  const { search, hash } = new URL(url, 'http://vite.dev');
  return pathname + '?' + queryToInject + (search ? '&' + search.slice(1) : '') + (hash || '');
}
export class ErrorOverlay {}
`);
      });
    }

    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] D-Likon Model Academy full-stack server running on http://0.0.0.0:${PORT}`);
    console.log(`[Server] Database file location: ${DB_FILE}`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
