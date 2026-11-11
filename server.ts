import express from 'express';
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
      }

      const payload = {
        ...incoming,
        students: studentsToSave,
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

      const existingLogs = Array.isArray(memoryDb?.securityLogs) ? memoryDb.securityLogs : [];
      // Prepend new log and keep latest 1000 logs
      const updatedLogs = [log, ...existingLogs.slice(0, 999)];

      const updatedDb = {
        ...(memoryDb || {}),
        securityLogs: updatedLogs,
        _lastSecurityEvent: log,
        _lastUpdated: new Date().toISOString(),
      };

      saveDatabaseToFile(updatedDb);

      return res.json({
        success: true,
        message: 'Gatepass scan logged and synced across all devices',
        log,
      });
    } catch (err: any) {
      console.error('[Server API] Security scan log error:', err);
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
        const logTime = typeof l.timestamp === 'number' ? l.timestamp : new Date(l.timestamp).getTime() || 0;
        const matchesTime = since > 0 ? logTime > since : true;
        const matchesStudent = studentId ? l.studentId === studentId : true;
        return matchesTime && matchesStudent;
      });

      return res.json({
        success: true,
        logs: filtered,
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
  // VITE DEV MIDDLEWARE / STATIC PROD SERVING
  // =========================================================================
  if (!IS_PROD) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: PORT,
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] D-Likon Model Academy full-stack server running on http://0.0.0.0:${PORT}`);
    console.log(`[Server] Database file location: ${DB_FILE}`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
