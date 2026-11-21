import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';

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

let lastBackupTimeMs = 0;
let lastBackupSignature = '';

function countStudentsWithPhotos(students: any[]): number {
  if (!Array.isArray(students)) return 0;
  let count = 0;
  for (const s of students) {
    if (s && (isValidImageRef(s.avatarUrl) || isValidImageRef(s.fatherAvatarUrl) || isValidImageRef(s.motherAvatarUrl))) {
      count++;
    }
  }
  return count;
}

function isValidImageRef(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('data:image/')) {
    if (trimmed.startsWith('data:image/svg+xml')) return trimmed.length >= 30;
    const commaIdx = trimmed.indexOf(',');
    if (commaIdx === -1) return false;
    return trimmed.slice(commaIdx + 1).length >= 24;
  }
  return (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('blob:')
  ) && trimmed.length >= 5;
}

function buildRelationKey(student: any): string {
  if (!student) return '';
  const cls = String(student.classId || '').trim().toLowerCase();
  const roll = Number(student.roll ?? 0);
  if (!cls || !Number.isFinite(roll) || roll <= 0) return '';
  return `${cls}::${roll}`;
}

function syncStudentPhotoRegistry(
  students: any[],
  existingRegistry?: Record<string, any>
): Record<string, any> {
  const registry: Record<string, any> =
    existingRegistry && typeof existingRegistry === 'object' ? { ...existingRegistry } : {};
  const nowIso = new Date().toISOString();

  if (!Array.isArray(students)) return registry;
  for (const s of students) {
    if (!s || !s.id) continue;
    const hasAvatar = isValidImageRef(s.avatarUrl);
    const hasFather = isValidImageRef(s.fatherAvatarUrl);
    const hasMother = isValidImageRef(s.motherAvatarUrl);
    if (hasAvatar || hasFather || hasMother) {
      const prevEntry = registry[s.id] || {};
      registry[s.id] = {
        studentId: s.id,
        classId: s.classId || prevEntry.classId || '',
        roll: Number(s.roll ?? prevEntry.roll ?? 0),
        section: s.section || prevEntry.section || '',
        nameBn: s.nameBn || prevEntry.nameBn || '',
        avatarUrl: hasAvatar ? s.avatarUrl : '',
        fatherAvatarUrl: hasFather ? s.fatherAvatarUrl : '',
        motherAvatarUrl: hasMother ? s.motherAvatarUrl : '',
        photoUpdatedAt: s.photoUpdatedAt || prevEntry.photoUpdatedAt || nowIso,
        updatedAt: nowIso,
      };
    } else if (registry[s.id] && s._explicitPhotoClear === true) {
      delete registry[s.id];
    }
  }
  return registry;
}

function reconcileStudentWithRegistry(
  incStd: any,
  srvStd: any | undefined,
  registry: Record<string, any>,
  relationMap?: Map<string, any>,
  explicitClearOverride?: any
): { student: any; protectedCount: number } {
  if (!incStd || !incStd.id) return { student: incStd, protectedCount: 0 };
  const relKey = buildRelationKey(incStd);
  const regEntry = registry[incStd.id] || (relKey && relationMap ? relationMap.get(relKey) : undefined);
  const explicitClear = explicitClearOverride ?? incStd._explicitPhotoClear;
  const isStripped = Boolean(incStd._photosStripped);

  const incTime = new Date(incStd.photoUpdatedAt || 0).getTime() || 0;
  const srvTime =
    Math.max(
      new Date(srvStd?.photoUpdatedAt || 0).getTime() || 0,
      new Date(regEntry?.photoUpdatedAt || 0).getTime() || 0
    ) || 0;

  let protectedCount = 0;

  const isFieldCleared = (field: 'avatarUrl' | 'fatherAvatarUrl' | 'motherAvatarUrl'): boolean => {
    if (explicitClear === true) return true;
    if (explicitClear && typeof explicitClear === 'object') {
      return Boolean(explicitClear[field]);
    }
    return false;
  };

  const resolveField = (field: 'avatarUrl' | 'fatherAvatarUrl' | 'motherAvatarUrl'): string => {
    const incVal = isValidImageRef(incStd[field]) ? String(incStd[field]).trim() : '';
    const srvVal = isValidImageRef(srvStd?.[field]) ? String(srvStd[field]).trim() : '';
    const regVal = isValidImageRef(regEntry?.[field]) ? String(regEntry[field]).trim() : '';
    const existingBest = srvVal || regVal;

    if (isFieldCleared(field)) {
      if (regEntry && registry[incStd.id]) {
        registry[incStd.id] = { ...registry[incStd.id], [field]: '' };
      }
      return '';
    }

    if (isStripped && !incVal && existingBest) {
      protectedCount++;
      return existingBest;
    }

    if (!incVal && existingBest) {
      protectedCount++;
      return existingBest;
    }

    if (incVal && existingBest && srvTime > incTime && incTime > 0) {
      protectedCount++;
      return existingBest;
    }

    return incVal || existingBest || '';
  };

  const mergedAvatar = resolveField('avatarUrl');
  const mergedFather = resolveField('fatherAvatarUrl');
  const mergedMother = resolveField('motherAvatarUrl');
  const mergedPhotoUpdatedAt =
    incTime > srvTime
      ? incStd.photoUpdatedAt
      : srvStd?.photoUpdatedAt || regEntry?.photoUpdatedAt || incStd.photoUpdatedAt;

  const mergedDreamGallery =
    Array.isArray(incStd.dreamGallery) && incStd.dreamGallery.length > 0
      ? incStd.dreamGallery
      : Array.isArray(srvStd?.dreamGallery) && srvStd.dreamGallery.length > 0
      ? srvStd.dreamGallery
      : incStd.dreamGallery || srvStd?.dreamGallery;

  const clean = { ...(srvStd || {}), ...incStd };
  delete clean._photosStripped;
  delete clean._explicitPhotoClear;

  const finalStd = {
    ...clean,
    avatarUrl: mergedAvatar,
    fatherAvatarUrl: mergedFather,
    motherAvatarUrl: mergedMother,
    ...(mergedDreamGallery !== undefined ? { dreamGallery: mergedDreamGallery } : {}),
    ...(mergedPhotoUpdatedAt ? { photoUpdatedAt: mergedPhotoUpdatedAt } : {}),
    portalUserId: incStd.portalUserId || srvStd?.portalUserId,
    guardianPin: incStd.guardianPin || srvStd?.guardianPin,
    securityQrCode:
      incStd.securityQrCode ||
      srvStd?.securityQrCode ||
      `DLIKON-SEC-${String(clean.classId || 'CLS').toUpperCase()}-${clean.roll ?? 0}-${String(clean.id).slice(-4).toUpperCase()}`,
  };

  return { student: finalStd, protectedCount };
}

let backupDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastBackupPhotoCount = -1;

function createTimestampedBackup(data: any) {
  try {
    if (!data || !Array.isArray(data.students) || data.students.length === 0) return;

    const photoCount = countStudentsWithPhotos(data.students);
    const totalAvatarBytes = data.students.reduce(
      (sum: number, s: any) =>
        sum +
        (s?.avatarUrl?.length || 0) +
        (s?.fatherAvatarUrl?.length || 0) +
        (s?.motherAvatarUrl?.length || 0),
      0
    );
    const signature = `${data.students.length}:${photoCount}:${totalAvatarBytes}:${Object.keys(data.examRecords || {}).length}:${(data.feeReceipts || []).length}`;
    const now = Date.now();

    // Prevent 15-second sync polling from overwriting all 40 backup slots in 10 minutes
    const signatureChanged = signature !== lastBackupSignature;
    const elapsedMs = now - lastBackupTimeMs;
    if (!signatureChanged && elapsedMs < 10 * 60 * 1000) {
      return;
    }

    lastBackupSignature = signature;
    lastBackupTimeMs = now;
    lastBackupPhotoCount = photoCount;

    const timestamp = new Date(now).toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `school_db_${timestamp}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(data), 'utf-8');

    // Keep last 40 backups
    const files = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith('school_db_') && f.endsWith('.json'))
      .sort();
    if (files.length > 40) {
      files.slice(0, files.length - 40).forEach((f) => {
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

function scheduleTimestampedBackup(immediate = false) {
  if (!memoryDb || !Array.isArray(memoryDb.students) || memoryDb.students.length === 0) return;
  const currentPhotoCount = countStudentsWithPhotos(memoryDb.students);
  const bigJump = lastBackupPhotoCount >= 0 && Math.abs(currentPhotoCount - lastBackupPhotoCount) >= 10;
  if (immediate || bigJump) {
    if (backupDebounceTimer) {
      clearTimeout(backupDebounceTimer);
      backupDebounceTimer = null;
    }
    createTimestampedBackup(memoryDb);
    return;
  }
  if (backupDebounceTimer) clearTimeout(backupDebounceTimer);
  backupDebounceTimer = setTimeout(() => {
    backupDebounceTimer = null;
    if (memoryDb) createTimestampedBackup(memoryDb);
  }, 2500);
}

function saveDatabaseToFile(data: any, options?: { skipBackup?: boolean; immediateBackup?: boolean }): boolean {
  try {
    memoryDb = data;
    const tempFile = `${DB_FILE}.tmp.${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
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

    // Create timestamped snapshot (throttled during rapid sequential photo chunks)
    if (!options?.skipBackup && Array.isArray(data.students) && data.students.length > 0) {
      scheduleTimestampedBackup(Boolean(options?.immediateBackup));
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
  app.set('trust proxy', 1);

  // Allow cross-origin / reverse-proxied requests to Gatepass & School APIs without CORS friction
  app.use('/api', (req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    next();
  });

  // Support large payloads (for passport photos, signatures, and batch student records)
  app.use(express.json({ limit: '60mb' }));
  app.use(express.urlencoded({ extended: true, limit: '60mb' }));

  // Privacy Protection: Prevent search engine crawlers from indexing student or guardian data
  app.use((_req, res, next) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    next();
  });

  // =========================================================================
  // REAL-TIME GATEPASS MULTI-DEVICE PUSH HUB (WebSocket + SSE)
  // =========================================================================
  const SERVER_INSTANCE_ID = `srv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  interface GatepassWsClient {
    ws: WebSocket;
    studentId: string;
    portalId: string;
    classId: string;
    roll: number | null;
    role: string;
    isAlive: boolean;
  }
  interface GatepassSseClient {
    res: express.Response;
    studentId: string;
    portalId: string;
    classId: string;
    roll: number | null;
    role: string;
  }

  const gatepassWsClients = new Set<GatepassWsClient>();
  const gatepassSseClients = new Set<GatepassSseClient>();
  const recentGuardianPolls = new Map<
    string,
    { studentId: string; portalId: string; classId: string; roll: number | null; lastSeenMs: number }
  >();

  const pruneRecentGuardianPolls = () => {
    const cutoff = Date.now() - 28000;
    for (const [k, entry] of recentGuardianPolls.entries()) {
      if (entry.lastSeenMs < cutoff) {
        recentGuardianPolls.delete(k);
      }
    }
  };

  const countActiveGuardianSubscribers = (log: any): number => {
    if (!log) return 0;
    pruneRecentGuardianPolls();
    let count = 0;
    const matchedKeys = new Set<string>();

    for (const client of gatepassWsClients) {
      if (
        client.ws.readyState === WebSocket.OPEN &&
        client.role === 'student' &&
        shouldDeliverToSubscriber(client, log)
      ) {
        count++;
        matchedKeys.add(
          `${client.studentId}|${client.portalId}|${client.classId}|${client.roll ?? ''}`
        );
      }
    }

    for (const sseClient of gatepassSseClients) {
      if (sseClient.role === 'student' && shouldDeliverToSubscriber(sseClient, log)) {
        const key = `${sseClient.studentId}|${sseClient.portalId}|${sseClient.classId}|${sseClient.roll ?? ''}`;
        if (!matchedKeys.has(key)) {
          count++;
          matchedKeys.add(key);
        }
      }
    }

    for (const [pollKey, entry] of recentGuardianPolls.entries()) {
      if (
        !matchedKeys.has(pollKey) &&
        logMatchesTargetStudent(log, entry.studentId, entry.portalId, entry.classId, entry.roll)
      ) {
        count++;
        matchedKeys.add(pollKey);
      }
    }

    return count;
  };

  const computePortalIdQuick = (s: any): string => {
    if (s?.portalUserId && String(s.portalUserId).trim()) {
      return String(s.portalUserId).trim().toUpperCase();
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
    const cls = String(s?.classId || '');
    const clsCode = classCodeMap[cls] || cls.replace('class_', '').toUpperCase().slice(0, 3) || 'ST';
    const rollStr = String(s?.roll ?? s?.studentRoll ?? 0).padStart(2, '0');
    return `DL-${clsCode}-${rollStr}`;
  };

  const getSchoolTodayDateStr = (isoTimestamp?: string): string => {
    const dt = isoTimestamp ? new Date(isoTimestamp) : new Date();
    const safeDt = Number.isNaN(dt.getTime()) ? new Date() : dt;
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Dhaka',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(safeDt);
      const y = parts.find((p) => p.type === 'year')?.value;
      const m = parts.find((p) => p.type === 'month')?.value;
      const d = parts.find((p) => p.type === 'day')?.value;
      if (y && m && d) return `${y}-${m}-${d}`;
    } catch {
      // Fallback
    }
    return safeDt.toISOString().split('T')[0];
  };

  const getSchoolTimeLabelBn = (isoTimestamp?: string): string => {
    const dt = isoTimestamp ? new Date(isoTimestamp) : new Date();
    const safeDt = Number.isNaN(dt.getTime()) ? new Date() : dt;
    try {
      return safeDt.toLocaleTimeString('bn-BD', {
        timeZone: 'Asia/Dhaka',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return safeDt.toTimeString().slice(0, 5);
    }
  };

  const logMatchesTargetStudent = (
    log: any,
    targetStudentId?: string,
    targetPortalId?: string,
    targetClassId?: string,
    targetRoll?: number | null
  ): boolean => {
    if (!log) return false;
    const cleanStdId = (targetStudentId || '').trim();
    const cleanPortal = (targetPortalId || '').trim().toUpperCase();
    const cleanClassId = (targetClassId || '').trim();
    const hasRoll = typeof targetRoll === 'number' && !Number.isNaN(targetRoll) && targetRoll > 0;
    if (!cleanStdId && !cleanPortal && !(cleanClassId && hasRoll)) return true;
    if (cleanStdId && log.studentId === cleanStdId) return true;
    if (cleanPortal) {
      const logPortal = (log.portalUserId || computePortalIdQuick(log)).trim().toUpperCase();
      if (logPortal && logPortal === cleanPortal) return true;
    }
    if (cleanClassId && hasRoll && log.classId === cleanClassId && Number(log.studentRoll) === Number(targetRoll)) {
      return true;
    }
    return false;
  };

  const shouldDeliverToSubscriber = (
    sub: { studentId: string; portalId?: string; classId?: string; roll?: number | null; role: string },
    log: any
  ): boolean => {
    if (!log || !log.studentId) return false;
    if (
      sub.role === 'official' ||
      sub.role === 'employee' ||
      (!sub.studentId && !sub.portalId && !(sub.classId && sub.roll))
    ) {
      return true;
    }
    return logMatchesTargetStudent(log, sub.studentId, sub.portalId, sub.classId, sub.roll);
  };

  const broadcastGatepassEvent = (
    eventType: 'gatepass:scan' | 'gatepass:acknowledge',
    log: any,
    extra: Record<string, any> = {}
  ) => {
    const payloadObj = {
      type: eventType,
      log,
      serverTime: Date.now(),
      serverInstanceId: SERVER_INSTANCE_ID,
      ...extra,
    };
    const serialized = JSON.stringify(payloadObj);

    for (const client of gatepassWsClients) {
      if (client.ws.readyState === WebSocket.OPEN && shouldDeliverToSubscriber(client, log)) {
        try {
          client.ws.send(serialized);
        } catch {
          // Ignore broken socket; heartbeat cleans it up
        }
      }
    }

    for (const sseClient of gatepassSseClients) {
      if (shouldDeliverToSubscriber(sseClient, log)) {
        try {
          sseClient.res.write(`event: gatepass\ndata: ${serialized}\n\n`);
        } catch {
          gatepassSseClients.delete(sseClient);
        }
      }
    }
  };

  // =========================================================================
  // API ROUTES
  // =========================================================================

  // Never cache real-time security gatepass responses across mobile proxies
  app.use('/api/security', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  // Security WebSocket/SSE/Polling diagnostic health endpoint
  app.get('/api/security/health', (_req, res) => {
    pruneRecentGuardianPolls();
    const onlineGuardianMap = new Map<string, { studentId: string; portalId: string; classId?: string; roll?: number | null; transport: string }>();
    const makeGuardianKey = (c: { studentId?: string; portalId?: string; classId?: string; roll?: number | null }) =>
      c.studentId || c.portalId || (c.classId && c.roll ? `${c.classId}::${c.roll}` : '');

    for (const c of gatepassWsClients) {
      const key = makeGuardianKey(c);
      if (c.ws.readyState === WebSocket.OPEN && c.role === 'student' && key) {
        onlineGuardianMap.set(key, {
          studentId: c.studentId,
          portalId: c.portalId,
          classId: c.classId,
          roll: c.roll,
          transport: 'ws',
        });
      }
    }
    for (const c of gatepassSseClients) {
      const key = makeGuardianKey(c);
      if (c.role === 'student' && key && !onlineGuardianMap.has(key)) {
        onlineGuardianMap.set(key, {
          studentId: c.studentId,
          portalId: c.portalId,
          classId: c.classId,
          roll: c.roll,
          transport: 'sse',
        });
      }
    }
    for (const p of recentGuardianPolls.values()) {
      const key = makeGuardianKey(p);
      if (key && !onlineGuardianMap.has(key)) {
        onlineGuardianMap.set(key, {
          studentId: p.studentId,
          portalId: p.portalId,
          classId: p.classId,
          roll: p.roll,
          transport: 'poll',
        });
      }
    }
    res.json({
      success: true,
      serverTime: Date.now(),
      serverInstanceId: SERVER_INSTANCE_ID,
      activeWsClients: gatepassWsClients.size,
      activeSseClients: gatepassSseClients.size,
      recentPollersCount: recentGuardianPolls.size,
      onlineGuardians: Array.from(onlineGuardianMap.values()),
    });
  });

  // Health check
  app.get('/api/health', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    const studentsList = Array.isArray(memoryDb?.students) ? memoryDb.students : [];
    res.json({
      status: 'ok',
      time: new Date().toISOString(),
      serverInstanceId: SERVER_INSTANCE_ID,
      studentCount: studentsList.length,
      photoCount: countStudentsWithPhotos(studentsList),
      hasSavedData: !!memoryDb,
    });
  });

  // GET complete school database
  app.get('/api/school-data', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
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

      const existingRegistry: Record<string, any> =
        memoryDb?.studentPhotoRegistry && typeof memoryDb.studentPhotoRegistry === 'object'
          ? { ...memoryDb.studentPhotoRegistry }
          : {};
      const registryRelationMap = new Map<string, any>();
      for (const entry of Object.values(existingRegistry)) {
        const rk = buildRelationKey(entry);
        if (rk && (isValidImageRef(entry?.avatarUrl) || isValidImageRef(entry?.fatherAvatarUrl) || isValidImageRef(entry?.motherAvatarUrl))) {
          registryRelationMap.set(rk, entry);
        }
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
        // Smart merge per-student personal dashboard fields + relational photo registry protection
        const serverStdMap = new Map<string, any>();
        const serverRelMap = new Map<string, any>();
        for (const s of memoryDb.students) {
          if (s && s.id) {
            serverStdMap.set(s.id, s);
            const rk = buildRelationKey(s);
            if (rk && (isValidImageRef(s.avatarUrl) || isValidImageRef(s.fatherAvatarUrl) || isValidImageRef(s.motherAvatarUrl))) {
              serverRelMap.set(rk, s);
            }
          }
        }
        studentsToSave = studentsToSave.map((incStd: any) => {
          if (!incStd || !incStd.id) return incStd;
          const rk = buildRelationKey(incStd);
          const srvStd = serverStdMap.get(incStd.id) || (rk ? serverRelMap.get(rk) : undefined);

          const mergedFuturePlan =
            incStd.futurePlan && srvStd?.futurePlan
              ? new Date(srvStd.futurePlan.updatedAt || 0).getTime() > new Date(incStd.futurePlan.updatedAt || 0).getTime()
                ? srvStd.futurePlan
                : incStd.futurePlan
              : incStd.futurePlan || srvStd?.futurePlan;
          const mergedAchievements =
            Array.isArray(incStd.achievements) && incStd.achievements.length > 0
              ? incStd.achievements
              : Array.isArray(srvStd?.achievements)
              ? srvStd.achievements
              : undefined;
          const mergedMonerBari =
            incStd.monerBari && srvStd?.monerBari
              ? new Date(srvStd.monerBari.updatedAt || 0).getTime() > new Date(incStd.monerBari.updatedAt || 0).getTime()
                ? srvStd.monerBari
                : incStd.monerBari
              : incStd.monerBari || srvStd?.monerBari;
          const mergedTimeManagement =
            incStd.timeManagement && srvStd?.timeManagement
              ? new Date(srvStd.timeManagement.updatedAt || 0).getTime() > new Date(incStd.timeManagement.updatedAt || 0).getTime()
                ? srvStd.timeManagement
                : incStd.timeManagement
              : incStd.timeManagement || srvStd?.timeManagement;
          const mergedAcademicRoadmap =
            incStd.academicRoadmap && srvStd?.academicRoadmap
              ? new Date(srvStd.academicRoadmap.updatedAt || 0).getTime() > new Date(incStd.academicRoadmap.updatedAt || 0).getTime()
                ? srvStd.academicRoadmap
                : incStd.academicRoadmap
              : incStd.academicRoadmap || srvStd?.academicRoadmap;

          const { student: reconciled } = reconcileStudentWithRegistry(
            incStd,
            srvStd,
            existingRegistry,
            registryRelationMap
          );

          return {
            ...reconciled,
            futurePlan: mergedFuturePlan,
            achievements: mergedAchievements,
            monerBari: mergedMonerBari,
            timeManagement: mergedTimeManagement,
            academicRoadmap: mergedAcademicRoadmap,
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

      // Smart merge libraryMaterials so uploaded files & download counters from other clients are preserved
      const serverLib: any[] = Array.isArray(memoryDb?.libraryMaterials) ? memoryDb.libraryMaterials : [];
      const incomingLib: any[] = Array.isArray(incoming.libraryMaterials) ? incoming.libraryMaterials : [];
      const libMap = new Map<string, any>();
      for (const sl of serverLib) {
        if (sl && sl.id) libMap.set(sl.id, sl);
      }
      for (const il of incomingLib) {
        if (il && il.id) {
          const ex = libMap.get(il.id);
          if (ex) {
            const exUpdated = new Date(ex.updatedAt || 0).getTime();
            const ilUpdated = new Date(il.updatedAt || 0).getTime();
            const chosen = ilUpdated >= exUpdated ? il : ex;
            libMap.set(il.id, {
              ...chosen,
              downloadsCount: Math.max(Number(ex.downloadsCount) || 0, Number(il.downloadsCount) || 0),
            });
          } else {
            libMap.set(il.id, il);
          }
        }
      }
      const mergedLibraryMaterials = Array.from(libMap.values()).sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );

      const existingScannerAuditLogs: any[] = Array.isArray(memoryDb?.scannerAuditLogs)
        ? memoryDb.scannerAuditLogs
        : [];

      const updatedPhotoRegistry = syncStudentPhotoRegistry(studentsToSave, existingRegistry);

      const payload = {
        ...incoming,
        students: studentsToSave,
        studentPhotoRegistry: updatedPhotoRegistry,
        securityLogs: mergedSecurityLogs,
        scannerAuditLogs: incoming.isExplicitClearScannerAudit
          ? []
          : existingScannerAuditLogs,
        libraryMaterials:
          incomingLib.length === 0 && serverLib.length > 0 && !incoming.isExplicitClearLibrary
            ? serverLib
            : mergedLibraryMaterials,
        staffAccounts: incomingStaffAccounts.length > 0 ? incomingStaffAccounts : existingStaffAccounts,
        staffAttendance: incomingStaffAttendance.length > 0 ? incomingStaffAttendance : existingStaffAttendance,
        admissionRequests: incomingAdmissionReqs.length > 0 ? incomingAdmissionReqs : existingAdmissionReqs,
        _lastUpdated: new Date().toISOString(),
      };

      const saved = saveDatabaseToFile(payload);
      if (saved) {
        // Also push any brand-new security scan logs merged during general DB sync
        const existingLogIds = new Set(serverLogs.map((l: any) => l?.id).filter(Boolean));
        const newlyMergedLogs = (payload.securityLogs || []).filter(
          (l: any) => l && l.id && !existingLogIds.has(l.id)
        );
        for (const freshLog of newlyMergedLogs) {
          broadcastGatepassEvent('gatepass:scan', freshLog);
        }

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

  // Quick endpoint to update students specifically (relational image preservation across upsert/replace)
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
      const existingRegistry: Record<string, any> =
        memoryDb?.studentPhotoRegistry && typeof memoryDb.studentPhotoRegistry === 'object'
          ? { ...memoryDb.studentPhotoRegistry }
          : syncStudentPhotoRegistry(currentStudents);

      const relMap = new Map<string, any>();
      const idMap = new Map<string, any>();
      for (const cs of currentStudents) {
        if (!cs) continue;
        if (cs.id) idMap.set(cs.id, cs);
        const rk = buildRelationKey(cs);
        if (rk && (isValidImageRef(cs.avatarUrl) || isValidImageRef(cs.fatherAvatarUrl) || isValidImageRef(cs.motherAvatarUrl))) {
          relMap.set(rk, cs);
        }
      }
      for (const entry of Object.values(existingRegistry)) {
        const rk = buildRelationKey(entry);
        if (rk && !relMap.has(rk) && (isValidImageRef(entry?.avatarUrl) || isValidImageRef(entry?.fatherAvatarUrl) || isValidImageRef(entry?.motherAvatarUrl))) {
          relMap.set(rk, entry);
        }
      }

      const reconciledIncoming = students.map((inc: any) => {
        if (!inc) return inc;
        const rk = buildRelationKey(inc);
        const srvMatch = (inc.id && idMap.get(inc.id)) || (rk ? relMap.get(rk) : undefined);
        return reconcileStudentWithRegistry(inc, srvMatch, existingRegistry, relMap).student;
      });

      if (mode === 'replace') {
        if (classId) {
          currentStudents = currentStudents.filter((s: any) => s.classId !== classId);
        } else {
          currentStudents = [];
        }
        currentStudents = [...currentStudents, ...reconciledIncoming];
      } else if (mode === 'upsert') {
        const studentMap = new Map();
        currentStudents.forEach((s: any) => studentMap.set(s.id, s));
        reconciledIncoming.forEach((s: any) => studentMap.set(s.id, s));
        currentStudents = Array.from(studentMap.values());
      } else {
        // Append
        currentStudents = [...currentStudents, ...reconciledIncoming];
      }

      const updatedDb = {
        ...(memoryDb || {}),
        students: currentStudents,
        studentPhotoRegistry: syncStudentPhotoRegistry(currentStudents, existingRegistry),
        _lastUpdated: new Date().toISOString(),
      };

      saveDatabaseToFile(updatedDb);
      return res.json({
        success: true,
        count: currentStudents.length,
        photoCount: countStudentsWithPhotos(currentStudents),
        message: 'Students synced to central database with image integrity preserved',
      });
    } catch (err: any) {
      console.error('[Server API] Students bulk error:', err);
      return res.status(500).json({ success: false, message: err?.message || 'Server error' });
    }
  });

  // Update individual student profile / photos / futurePlan / achievements / password
  app.post('/api/student/profile-update', (req, res) => {
    try {
      const { studentId, updates, explicitPhotoClear } = req.body;
      if (!studentId || !updates || typeof updates !== 'object') {
        return res.status(400).json({ success: false, message: 'studentId and updates required' });
      }

      if (!memoryDb) {
        loadDatabaseFromFile();
      }

      const hasPhotoUpdate =
        Object.prototype.hasOwnProperty.call(updates, 'avatarUrl') ||
        Object.prototype.hasOwnProperty.call(updates, 'fatherAvatarUrl') ||
        Object.prototype.hasOwnProperty.call(updates, 'motherAvatarUrl');

      const effectiveExplicitClear = explicitPhotoClear ?? updates._explicitPhotoClear;
      const stampedUpdates: Record<string, any> = hasPhotoUpdate
        ? { ...updates, photoUpdatedAt: updates.photoUpdatedAt || new Date().toISOString() }
        : { ...updates };
      delete stampedUpdates._photosStripped;
      delete stampedUpdates._explicitPhotoClear;

      const existingRegistry: Record<string, any> =
        memoryDb?.studentPhotoRegistry && typeof memoryDb.studentPhotoRegistry === 'object'
          ? { ...memoryDb.studentPhotoRegistry }
          : {};
      const currentStudents: any[] = Array.isArray(memoryDb?.students) ? memoryDb.students : [];
      let updatedStudent: any = null;
      let protectedFieldsCount = 0;

      const nextStudents = currentStudents.map((s) => {
        if (s.id === studentId) {
          const { student: mergedStd, protectedCount } = reconcileStudentWithRegistry(
            { ...s, ...stampedUpdates, id: s.id },
            s,
            existingRegistry,
            undefined,
            effectiveExplicitClear
          );
          protectedFieldsCount += protectedCount;
          updatedStudent = mergedStd;
          return updatedStudent;
        }
        return s;
      });

      // Upsert if student was just added on client before 1s debounced sync arrived
      if (!updatedStudent && stampedUpdates.nameBn && stampedUpdates.classId) {
        const { student: mergedNew } = reconcileStudentWithRegistry(
          { ...stampedUpdates, id: studentId },
          undefined,
          existingRegistry,
          undefined,
          effectiveExplicitClear
        );
        updatedStudent = mergedNew;
        nextStudents.push(updatedStudent);
      }

      if (!updatedStudent) {
        return res.status(404).json({ success: false, message: 'Student not found' });
      }

      const updatedRegistry = syncStudentPhotoRegistry([updatedStudent], existingRegistry);

      const updatedDb = {
        ...(memoryDb || {}),
        students: nextStudents,
        studentPhotoRegistry: updatedRegistry,
        _lastUpdated: new Date().toISOString(),
      };

      const saved = saveDatabaseToFile(updatedDb);
      if (!saved) {
        return res.status(500).json({ success: false, message: 'Failed to persist student profile to disk' });
      }
      return res.json({
        success: true,
        message: 'শিক্ষার্থীর প্রোফাইল ও ছবি সফলভাবে সংরক্ষিত হয়েছে',
        student: updatedStudent,
        photoCount: countStudentsWithPhotos(nextStudents),
        protectedFieldsCount,
      });
    } catch (err: any) {
      console.error('[Server API] Student profile update error:', err);
      return res.status(500).json({ success: false, message: err?.message || 'Server error' });
    }
  });

  // Chunked batch photo upload endpoint (avoids HTTP proxy payload size limits when uploading 176+ photos)
  app.post('/api/students/batch-photos', (req, res) => {
    try {
      const { items } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: 'Photo items array required' });
      }

      if (!memoryDb) {
        loadDatabaseFromFile();
      }

      const existingRegistry: Record<string, any> =
        memoryDb?.studentPhotoRegistry && typeof memoryDb.studentPhotoRegistry === 'object'
          ? { ...memoryDb.studentPhotoRegistry }
          : {};

      const itemMap = new Map<string, any>();
      for (const it of items) {
        if (it && it.id) {
          itemMap.set(it.id, it);
        }
      }

      let updatedCount = 0;
      const currentStudents: any[] = Array.isArray(memoryDb?.students) ? memoryDb.students : [];
      const seenIds = new Set<string>();
      const nextStudents = currentStudents.map((s) => {
        if (s?.id) seenIds.add(s.id);
        const inc = itemMap.get(s.id);
        if (!inc) return s;

        const { student: reconciled } = reconcileStudentWithRegistry(
          {
            ...s,
            ...(inc.avatarUrl !== undefined ? { avatarUrl: inc.avatarUrl } : {}),
            ...(inc.fatherAvatarUrl !== undefined ? { fatherAvatarUrl: inc.fatherAvatarUrl } : {}),
            ...(inc.motherAvatarUrl !== undefined ? { motherAvatarUrl: inc.motherAvatarUrl } : {}),
            photoUpdatedAt: inc.photoUpdatedAt || s.photoUpdatedAt || new Date().toISOString(),
          },
          s,
          existingRegistry,
          undefined,
          inc.explicitClear ?? inc._explicitPhotoClear
        );

        if (
          reconciled.avatarUrl !== s.avatarUrl ||
          reconciled.fatherAvatarUrl !== s.fatherAvatarUrl ||
          reconciled.motherAvatarUrl !== s.motherAvatarUrl
        ) {
          updatedCount++;
        }
        return reconciled;
      });

      // Also upsert any newly created student with photos if missing on server
      for (const inc of items) {
        if (inc && inc.id && !seenIds.has(inc.id) && inc.studentRecord && inc.studentRecord.nameBn && inc.studentRecord.classId) {
          const cleanRec = reconcileStudentWithRegistry(
            { ...inc.studentRecord, id: inc.id },
            undefined,
            existingRegistry
          ).student;
          nextStudents.push(cleanRec);
          updatedCount++;
        }
      }

      const updatedRegistry = syncStudentPhotoRegistry(nextStudents, existingRegistry);

      const updatedDb = {
        ...(memoryDb || {}),
        students: nextStudents,
        studentPhotoRegistry: updatedRegistry,
        _lastUpdated: new Date().toISOString(),
      };

      const saved = saveDatabaseToFile(updatedDb);
      if (!saved) {
        return res.status(500).json({ success: false, message: 'Failed to persist chunked photos' });
      }

      return res.json({
        success: true,
        updatedCount,
        photoCount: countStudentsWithPhotos(nextStudents),
        lastUpdated: updatedDb._lastUpdated,
      });
    } catch (err: any) {
      console.error('[Server API] Batch photo upload error:', err);
      return res.status(500).json({ success: false, message: err?.message || 'Server error' });
    }
  });

  // Audit & Repair Relational Photo Integrity (Play..Class 8 focus)
  const buildPhotoIntegrityAudit = (repair = false) => {
    if (!memoryDb) {
      loadDatabaseFromFile();
    }
    const classesList: any[] = Array.isArray(memoryDb?.classes) ? memoryDb.classes : [];
    const currentStudents: any[] = Array.isArray(memoryDb?.students) ? memoryDb.students : [];
    const existingRegistry: Record<string, any> =
      memoryDb?.studentPhotoRegistry && typeof memoryDb.studentPhotoRegistry === 'object'
        ? { ...memoryDb.studentPhotoRegistry }
        : {};

    const relationMap = new Map<string, any>();
    for (const entry of Object.values(existingRegistry)) {
      const rk = buildRelationKey(entry);
      if (rk && (isValidImageRef(entry?.avatarUrl) || isValidImageRef(entry?.fatherAvatarUrl) || isValidImageRef(entry?.motherAvatarUrl))) {
        relationMap.set(rk, entry);
      }
    }

    let repairedCount = 0;
    let protectedCount = 0;
    const repairedStudents = currentStudents.map((s) => {
      const { student: reconciled, protectedCount: pCount } = reconcileStudentWithRegistry(
        s,
        s,
        existingRegistry,
        relationMap
      );
      if (pCount > 0) {
        repairedCount++;
        protectedCount += pCount;
      }
      return reconciled;
    });

    const syncedRegistry = syncStudentPhotoRegistry(repairedStudents, existingRegistry);

    if (repair && (repairedCount > 0 || !memoryDb?.studentPhotoRegistry)) {
      const updatedDb = {
        ...(memoryDb || {}),
        students: repairedStudents,
        studentPhotoRegistry: syncedRegistry,
        _lastUpdated: new Date().toISOString(),
      };
      saveDatabaseToFile(updatedDb, { skipBackup: repairedCount === 0 });
    }

    const activeList = repair ? repairedStudents : currentStudents;
    const perClass = classesList.map((cls: any) => {
      const list = activeList.filter((s: any) => s.classId === cls.id);
      return {
        classId: cls.id,
        classNameBn: cls.nameBn || cls.id,
        totalStudents: list.length,
        withStudentPhoto: list.filter((s: any) => isValidImageRef(s.avatarUrl)).length,
        withFatherPhoto: list.filter((s: any) => isValidImageRef(s.fatherAvatarUrl)).length,
        withMotherPhoto: list.filter((s: any) => isValidImageRef(s.motherAvatarUrl)).length,
      };
    });

    const class1To8Ids = new Set(['class_1', 'class_2', 'class_3', 'class_4', 'class_5', 'class_6', 'class_7', 'class_8']);
    const class1To8List = activeList.filter((s: any) => class1To8Ids.has(s.classId));

    return {
      success: true,
      checkedAt: new Date().toISOString(),
      totalStudents: activeList.length,
      totalWithStudentPhoto: activeList.filter((s: any) => isValidImageRef(s.avatarUrl)).length,
      totalRegistryEntries: Object.keys(syncedRegistry).length,
      repairedCount,
      protectedCount,
      class1To8TotalStudents: class1To8List.length,
      class1To8WithStudentPhoto: class1To8List.filter((s: any) => isValidImageRef(s.avatarUrl)).length,
      perClass,
    };
  };

  app.get('/api/students/photo-integrity', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    try {
      return res.json(buildPhotoIntegrityAudit(false));
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Integrity check failed' });
    }
  });

  app.post('/api/students/verify-photo-integrity', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    try {
      return res.json(buildPhotoIntegrityAudit(true));
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Integrity repair failed' });
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

  // POST new scan event from school gate (logs scan + marks today's attendance present + broadcasts live)
  app.post('/api/security/scan', (req, res) => {
    try {
      const { log } = req.body;
      if (!log || !log.studentId) {
        return res.status(400).json({ success: false, message: 'Valid gatepass log required' });
      }

      if (!memoryDb) {
        loadDatabaseFromFile();
      }

      const studentsList: any[] = Array.isArray(memoryDb?.students) ? memoryDb.students : [];
      const matchedStudent =
        studentsList.find((s) => s && s.id === log.studentId) ||
        (log.portalUserId
          ? studentsList.find(
              (s) => s && computePortalIdQuick(s) === String(log.portalUserId).trim().toUpperCase()
            )
          : undefined) ||
        (log.securityQrCode
          ? studentsList.find(
              (s) =>
                s &&
                s.securityQrCode &&
                String(s.securityQrCode).trim().toUpperCase() === String(log.securityQrCode).trim().toUpperCase()
            )
          : undefined) ||
        (log.classId && log.studentRoll !== undefined
          ? studentsList.find(
              (s) => s && s.classId === log.classId && Number(s.roll) === Number(log.studentRoll)
            )
          : undefined);

      const resolvedStudentId = matchedStudent?.id || log.studentId;
      const resolvedClassId = matchedStudent?.classId || log.classId || '';
      const resolvedSection = matchedStudent?.section || log.section || 'ক';
      const resolvedAcademicYear = matchedStudent?.academicYear || '২০২৬';
      const resolvedPortalId =
        log.portalUserId ||
        (matchedStudent ? computePortalIdQuick(matchedStudent) : computePortalIdQuick(log));

      const resolvedRollNum =
        matchedStudent?.roll !== undefined
          ? Number(matchedStudent.roll)
          : log.studentRoll !== undefined && log.studentRoll !== null
          ? Number(log.studentRoll)
          : log.studentRoll;

      const scanIso = log.timestamp || new Date().toISOString();
      const savedLog = {
        ...log,
        studentId: resolvedStudentId,
        portalUserId: resolvedPortalId,
        ...(Number.isFinite(resolvedRollNum) ? { studentRoll: resolvedRollNum } : {}),
        ...(resolvedClassId ? { classId: resolvedClassId } : {}),
        ...(resolvedSection ? { section: resolvedSection } : {}),
        serverTimestamp: Date.now(),
      };

      const existingLogs: any[] = Array.isArray(memoryDb?.securityLogs) ? memoryDb.securityLogs : [];
      const withoutDup = existingLogs.filter((l) => l.id !== savedLog.id);
      // Prepend new log and keep latest 1000 logs
      const updatedLogs = [savedLog, ...withoutDup].slice(0, 1000);

      // Automatically persist daily attendance ('present') into main DB attendanceRecords
      const currentAttendance: Record<string, any> =
        memoryDb?.attendanceRecords && typeof memoryDb.attendanceRecords === 'object'
          ? { ...memoryDb.attendanceRecords }
          : {};
      let updatedAttendanceRecord: any = null;

      if (resolvedClassId) {
        const todayDate = getSchoolTodayDateStr(scanIso);
        const timeLabel = getSchoolTimeLabelBn(scanIso);
        const actionTag = savedLog.action === 'exit' ? 'প্রস্থান স্ক্যান' : 'ডিজিটাল গেটপাস স্ক্যান';
        const candidateKeys = [
          `${resolvedClassId}_${resolvedSection || 'all'}_${todayDate}`,
          `${resolvedClassId}_${resolvedSection}_${todayDate}`,
          `${resolvedClassId}__${todayDate}`,
          `${resolvedClassId}_all_${todayDate}`,
        ];
        const existingKey =
          candidateKeys.find((k) => Boolean(currentAttendance[k])) ||
          Object.keys(currentAttendance).find((k) => {
            const r = currentAttendance[k];
            return (
              r &&
              r.classId === resolvedClassId &&
              r.date === todayDate &&
              (!r.section || r.section === resolvedSection)
            );
          }) ||
          candidateKeys[0];

        const existingRec = currentAttendance[existingKey] || {
          id: existingKey,
          date: todayDate,
          academicYear: resolvedAcademicYear,
          classId: resolvedClassId,
          section: resolvedSection,
          records: {},
          updatedAt: scanIso,
        };

        const prevEntry = existingRec.records?.[resolvedStudentId];
        const nextStatus =
          prevEntry && (prevEntry.status === 'late' || prevEntry.status === 'leave')
            ? prevEntry.status
            : 'present';
        const scanRemark = `${actionTag} • ${timeLabel}`;
        const nextRemarks =
          prevEntry?.remarks && prevEntry.remarks.includes('স্ক্যান')
            ? `${prevEntry.remarks.split('|')[0].trim()} | ${scanRemark}`
            : prevEntry?.remarks
            ? `${scanRemark} (${prevEntry.remarks})`
            : scanRemark;

        updatedAttendanceRecord = {
          ...existingRec,
          records: {
            ...(existingRec.records || {}),
            [resolvedStudentId]: {
              status: nextStatus,
              remarks: nextRemarks,
            },
          },
          updatedAt: new Date().toISOString(),
        };
        currentAttendance[existingKey] = updatedAttendanceRecord;
      }

      const updatedDb = {
        ...(memoryDb || {}),
        securityLogs: updatedLogs,
        attendanceRecords: currentAttendance,
        _lastSecurityEvent: savedLog,
        _lastUpdated: new Date().toISOString(),
      };

      saveDatabaseToFile(updatedDb);
      broadcastGatepassEvent('gatepass:scan', savedLog, {
        ...(updatedAttendanceRecord ? { attendanceRecord: updatedAttendanceRecord } : {}),
      });
      const deliveredLiveSubscribers = countActiveGuardianSubscribers(savedLog);

      return res.json({
        success: true,
        message: 'Gatepass scan logged, attendance saved, and synced across all devices',
        log: savedLog,
        attendanceRecord: updatedAttendanceRecord,
        deliveredLiveSubscribers,
        serverInstanceId: SERVER_INSTANCE_ID,
      });
    } catch (err: any) {
      console.error('[Server API] Security scan log error:', err);
      return res.status(500).json({ success: false, message: err?.message || 'Server error' });
    }
  });

  // POST record student Salam etiquette response ('ওয়ালাইকুমুস সালাম') on scan log
  app.post('/api/security/etiquette', (req, res) => {
    try {
      const { logId, studentId, replyText } = req.body || {};
      if (!logId && !studentId) {
        return res.status(400).json({ success: false, message: 'logId or studentId required' });
      }
      if (!memoryDb) {
        loadDatabaseFromFile();
      }
      const existingLogs: any[] = Array.isArray(memoryDb?.securityLogs) ? memoryDb.securityLogs : [];
      const reply = String(replyText || 'ওয়ালাইকুমুস সালাম ওয়া রাহমাতুল্লাহ').trim();
      let updatedTarget: any = null;
      const updatedLogs = existingLogs.map((l) => {
        if (!updatedTarget && ((logId && l.id === logId) || (!logId && studentId && l.studentId === studentId))) {
          updatedTarget = {
            ...l,
            studentEtiquetteReply: reply,
            updatedServerTimestamp: Date.now(),
          };
          return updatedTarget;
        }
        return l;
      });
      if (!updatedTarget) {
        return res.json({ success: true, message: 'Etiquette noted locally' });
      }
      saveDatabaseToFile({
        ...(memoryDb || {}),
        securityLogs: updatedLogs,
        _lastUpdated: new Date().toISOString(),
      });
      return res.json({ success: true, log: updatedTarget });
    } catch (err: any) {
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
      const ackNowMs = Date.now();
      const ackTime = new Date(ackNowMs).toISOString();
      const responseText = (guardianResponse && String(guardianResponse).trim()) || 'মেসেজ শুনেছি ও নিশ্চিত করলাম';

      const updatedLogs = existingLogs.map((l) => {
        if (!updatedTarget && ((logId && l.id === logId) || (!logId && studentId && l.studentId === studentId))) {
          updatedTarget = {
            ...l,
            guardianAcknowledged: true,
            acknowledgedAt: ackTime,
            guardianResponse: responseText,
            acknowledgedBy: acknowledgedBy || 'অভিভাবক',
            updatedServerTimestamp: ackNowMs,
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
      broadcastGatepassEvent('gatepass:acknowledge', updatedTarget, { totalAcknowledgedCount });

      return res.json({
        success: true,
        message: 'Guardian response recorded in school database',
        log: updatedTarget,
        totalAcknowledgedCount,
        serverInstanceId: SERVER_INSTANCE_ID,
      });
    } catch (err: any) {
      console.error('[Server API] Security acknowledge error:', err);
      return res.status(500).json({ success: false, message: err?.message || 'Server error' });
    }
  });

  // Real-time Server-Sent Events (SSE) stream fallback for gatepass notifications
  app.get('/api/security/stream', (req, res) => {
    const studentId = String(req.query.studentId || '').trim();
    const portalId = String(req.query.portalId || '').trim().toUpperCase();
    const classId = String(req.query.classId || '').trim();
    const rollRaw = Number(req.query.roll);
    const roll = !Number.isNaN(rollRaw) && rollRaw > 0 ? rollRaw : null;
    const role = String(req.query.role || 'student').trim();

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }

    const clientEntry: GatepassSseClient = { res, studentId, portalId, classId, roll, role };
    gatepassSseClients.add(clientEntry);

    if (!memoryDb) {
      loadDatabaseFromFile();
    }
    const logs: any[] = Array.isArray(memoryDb?.securityLogs) ? memoryDb.securityLogs : [];
    const recentLogs =
      studentId || portalId || (classId && roll)
        ? logs.filter((l) => logMatchesTargetStudent(l, studentId, portalId, classId, roll)).slice(0, 10)
        : logs.slice(0, 20);

    try {
      res.write(
        `event: gatepass\ndata: ${JSON.stringify({
          type: 'gatepass:init',
          serverTime: Date.now(),
          serverInstanceId: SERVER_INSTANCE_ID,
          logs: recentLogs,
        })}\n\n`
      );
    } catch {
      gatepassSseClients.delete(clientEntry);
      return;
    }

    const heartbeat = setInterval(() => {
      try {
        res.write(`: ping ${Date.now()}\n\n`);
      } catch {
        clearInterval(heartbeat);
        gatepassSseClients.delete(clientEntry);
      }
    }, 20000);

    req.on('close', () => {
      clearInterval(heartbeat);
      gatepassSseClients.delete(clientEntry);
    });
  });

  // GET latest security logs since a timestamp, optionally filtered for a student
  app.get('/api/security/latest-logs', (req, res) => {
    try {
      if (!memoryDb) {
        loadDatabaseFromFile();
      }

      const since = Number(req.query.since) || 0;
      const studentId = String(req.query.studentId || '').trim();
      const portalId = String(req.query.portalId || '').trim().toUpperCase();
      const classId = String(req.query.classId || '').trim();
      const rollRaw = Number(req.query.roll);
      const roll = !Number.isNaN(rollRaw) && rollRaw > 0 ? rollRaw : null;
      const role = String(req.query.role || '').trim();

      if (role === 'student' && (studentId || portalId || (classId && roll))) {
        const pollKey = `${studentId}|${portalId}|${classId}|${roll ?? ''}`;
        recentGuardianPolls.set(pollKey, {
          studentId,
          portalId,
          classId,
          roll,
          lastSeenMs: Date.now(),
        });
      }

      const logs: any[] = Array.isArray(memoryDb?.securityLogs) ? memoryDb.securityLogs : [];

      const filtered = logs.filter((l) => {
        const logTime =
          typeof l.serverTimestamp === 'number'
            ? l.serverTimestamp
            : typeof l.timestamp === 'number'
            ? l.timestamp
            : new Date(l.timestamp).getTime() || 0;
        const updatedTime = typeof l.updatedServerTimestamp === 'number' ? l.updatedServerTimestamp : 0;
        const effectiveTime = Math.max(logTime, updatedTime);
        const matchesTime = since > 0 ? effectiveTime > since : true;
        const matchesStudent =
          studentId || portalId || (classId && roll)
            ? logMatchesTargetStudent(l, studentId, portalId, classId, roll)
            : true;
        return matchesTime && matchesStudent;
      });

      const totalAcknowledgedCount = logs.filter((l) => l.guardianAcknowledged).length;

      return res.json({
        success: true,
        logs: filtered,
        allLogsCount: logs.length,
        totalAcknowledgedCount,
        serverTime: Date.now(),
        serverInstanceId: SERVER_INSTANCE_ID,
        lastEvent: memoryDb?._lastSecurityEvent || null,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message });
    }
  });

  // GET persistent QR scanner audit events (all matched, ambiguous, and rejected scans)
  app.get('/api/security/scanner-audit', (req, res) => {
    try {
      if (!memoryDb) {
        loadDatabaseFromFile();
      }

      const allLogs: any[] = Array.isArray(memoryDb?.scannerAuditLogs)
        ? memoryDb.scannerAuditLogs
        : [];
      const outcome = String(req.query.outcome || 'all').trim();
      const source = String(req.query.source || 'all').trim();
      const q = String(req.query.q || '').trim().toLowerCase();
      const limit = Math.min(Math.max(Number(req.query.limit) || 250, 1), 500);

      const stats = {
        total: allLogs.length,
        matched: allLogs.filter((l) => l?.outcome === 'matched').length,
        ambiguous: allLogs.filter((l) => l?.outcome === 'ambiguous').length,
        rejected: allLogs.filter((l) => l?.outcome === 'rejected').length,
      };

      const filtered = allLogs.filter((entry) => {
        if (outcome !== 'all' && entry?.outcome !== outcome) return false;
        if (source !== 'all' && entry?.source !== source) return false;
        if (q) {
          const hay = [
            entry?.rawPayload,
            entry?.extractedToken,
            entry?.matchRuleOrReason,
            entry?.diagnosticNote,
            entry?.resolvedStudentNameBn,
            entry?.resolvedStudentId,
            entry?.resolvedPortalId,
            entry?.resolvedClassNameBn,
            ...(Array.isArray(entry?.ambiguousCandidates)
              ? entry.ambiguousCandidates.map((c: any) => `${c?.nameBn || ''} ${c?.portalId || ''}`)
              : []),
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });

      return res.json({
        success: true,
        logs: filtered.slice(0, limit),
        totalCount: allLogs.length,
        filteredCount: filtered.length,
        stats,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Server error' });
    }
  });

  // POST a new QR scanner audit event (matched, ambiguous, or rejected)
  app.post('/api/security/scanner-audit', (req, res) => {
    try {
      const event = req.body?.event;
      if (!event || typeof event !== 'object' || !event.outcome || typeof event.rawPayload !== 'string') {
        return res.status(400).json({ success: false, message: 'Valid scanner audit event required' });
      }

      if (!memoryDb) {
        loadDatabaseFromFile();
      }

      const savedEvent = {
        ...event,
        id:
          event.id ||
          `scanaudit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: event.timestamp || new Date().toISOString(),
        serverTimestamp: Date.now(),
      };

      const existingLogs: any[] = Array.isArray(memoryDb?.scannerAuditLogs)
        ? memoryDb.scannerAuditLogs
        : [];
      const withoutDup = existingLogs.filter((l) => l?.id !== savedEvent.id);
      const updatedLogs = [savedEvent, ...withoutDup].slice(0, 500);

      const updatedDb = {
        ...(memoryDb || {}),
        scannerAuditLogs: updatedLogs,
        _lastUpdated: new Date().toISOString(),
      };

      saveDatabaseToFile(updatedDb);

      return res.json({
        success: true,
        event: savedEvent,
        totalCount: updatedLogs.length,
      });
    } catch (err: any) {
      console.error('[Server API] Scanner audit log error:', err);
      return res.status(500).json({ success: false, message: err?.message || 'Server error' });
    }
  });

  // DELETE all recorded QR scanner audit events
  app.delete('/api/security/scanner-audit', (_req, res) => {
    try {
      if (!memoryDb) {
        loadDatabaseFromFile();
      }
      const updatedDb = {
        ...(memoryDb || {}),
        scannerAuditLogs: [],
        _lastUpdated: new Date().toISOString(),
      };
      saveDatabaseToFile(updatedDb);
      return res.json({ success: true, message: 'Scanner audit logs cleared' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Server error' });
    }
  });

  // Bengali TTS audio endpoint (MP3) for reliable mobile Chrome / iOS Safari HTML5 <audio> playback
  const ttsAudioCache = new Map<string, Buffer>();
  const splitBengaliTtsChunks = (input: string, maxLen = 155): string[] => {
    const cleaned = input.replace(/\s+/g, ' ').trim();
    if (!cleaned) return [];
    const sentences = cleaned
      .split(/(?<=[।?!.])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const result: string[] = [];
    for (const sentence of sentences) {
      if (sentence.length <= maxLen) {
        result.push(sentence);
        continue;
      }
      const words = sentence.split(/\s+/);
      let current = '';
      for (const word of words) {
        if ((current + ' ' + word).trim().length <= maxLen) {
          current = (current + ' ' + word).trim();
        } else {
          if (current) result.push(current);
          current = word.length > maxLen ? word.slice(0, maxLen) : word;
        }
      }
      if (current) result.push(current);
    }
    return result.length > 0 ? result : [cleaned.slice(0, maxLen)];
  };

  const inFlightTtsRequests = new Map<string, Promise<Buffer>>();

  app.get('/api/tts/bn', async (req, res) => {
    try {
      const rawText = typeof req.query.text === 'string' ? req.query.text : '';
      const cleaned = rawText.replace(/\s+/g, ' ').trim().slice(0, 1500);
      if (!cleaned) {
        return res.status(400).json({ success: false, message: 'text parameter required' });
      }

      const cached = ttsAudioCache.get(cleaned);
      if (cached && cached.length > 0) {
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Length', String(cached.length));
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.send(cached);
      }

      let synthesisPromise = inFlightTtsRequests.get(cleaned);
      if (!synthesisPromise) {
        synthesisPromise = (async (): Promise<Buffer> => {
          const chunks = splitBengaliTtsChunks(cleaned, 155);
          const fetchChunkWithRetry = async (chunk: string): Promise<Buffer> => {
            const urls = [
              `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=bn&q=${encodeURIComponent(chunk)}`,
              `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=bn&q=${encodeURIComponent(chunk)}`,
            ];
            let lastErr: any = null;
            for (const ttsUrl of urls) {
              for (let attempt = 0; attempt < 2; attempt++) {
                try {
                  const upstream = await fetch(ttsUrl, {
                    headers: {
                      'User-Agent':
                        'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
                    },
                  });
                  if (!upstream.ok) {
                    throw new Error(`TTS upstream HTTP ${upstream.status}`);
                  }
                  const arrBuf = await upstream.arrayBuffer();
                  const buf = Buffer.from(arrBuf);
                  if (buf.length > 0) return buf;
                  throw new Error('Empty upstream TTS chunk');
                } catch (err) {
                  lastErr = err;
                  if (attempt === 0) {
                    await new Promise((r) => setTimeout(r, 200));
                  }
                }
              }
            }
            throw lastErr || new Error('TTS chunk fetch failed');
          };

          const audioBuffers = await Promise.all(chunks.map((chunk) => fetchChunkWithRetry(chunk)));

          const stripLeadingId3v2 = (buf: Buffer): Buffer => {
            if (buf.length >= 10 && buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
              const tagSize =
                ((buf[6] & 0x7f) << 21) |
                ((buf[7] & 0x7f) << 14) |
                ((buf[8] & 0x7f) << 7) |
                (buf[9] & 0x7f);
              const totalHeader = 10 + tagSize;
              if (totalHeader < buf.length) {
                return buf.subarray(totalHeader);
              }
            }
            return buf;
          };

          const cleanedAudioBuffers = audioBuffers.map((buf, idx) =>
            idx === 0 ? buf : stripLeadingId3v2(buf)
          );
          const mergedAudio = Buffer.concat(cleanedAudioBuffers);
          if (mergedAudio.length === 0) {
            throw new Error('Empty TTS response');
          }

          if (ttsAudioCache.size >= 200) {
            const oldestKey = ttsAudioCache.keys().next().value;
            if (oldestKey) ttsAudioCache.delete(oldestKey);
          }
          ttsAudioCache.set(cleaned, mergedAudio);
          return mergedAudio;
        })();
        inFlightTtsRequests.set(cleaned, synthesisPromise);
        synthesisPromise.finally(() => {
          inFlightTtsRequests.delete(cleaned);
        });
      }

      const mergedAudio = await synthesisPromise;
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', String(mergedAudio.length));
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(mergedAudio);
    } catch (err: any) {
      console.warn('[TTS BN] Upstream fetch failed:', err?.message || err);
      return res.status(502).json({ success: false, message: 'TTS synthesis unavailable' });
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
  // DYNAMIC PER-STUDENT PWA APP ICON & MANIFEST ENDPOINTS
  // Allows a student's passport-size photo to serve as smartphone home icon
  // =========================================================================
  const PWA_ICON_DIR = path.join(DATA_DIR, 'pwa-icons');
  if (!fs.existsSync(PWA_ICON_DIR)) {
    fs.mkdirSync(PWA_ICON_DIR, { recursive: true });
  }

  const sanitizeStudentPathId = (rawId: string): string =>
    rawId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'student';

  const decodeDataUrlBuffer = (dataUrl: string): { mime: string; buffer: Buffer } | null => {
    if (typeof dataUrl !== 'string') return null;
    const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (!match) return null;
    try {
      return {
        mime: match[1],
        buffer: Buffer.from(match[2], 'base64'),
      };
    } catch {
      return null;
    }
  };

  app.post('/api/student-icon/:studentId', (req, res) => {
    try {
      const studentId = req.params.studentId;
      const safeId = sanitizeStudentPathId(studentId);
      const { icon192, icon512, maskable512, apple180 } = req.body || {};

      const studentDir = path.join(PWA_ICON_DIR, safeId);
      if (!fs.existsSync(studentDir)) {
        fs.mkdirSync(studentDir, { recursive: true });
      }

      const targets: { dataUrl: unknown; fileName: string }[] = [
        { dataUrl: icon192, fileName: '192.png' },
        { dataUrl: icon512, fileName: '512.png' },
        { dataUrl: maskable512, fileName: 'maskable-512.png' },
        { dataUrl: apple180, fileName: 'apple-touch-icon.png' },
      ];

      let written = 0;
      for (const item of targets) {
        if (typeof item.dataUrl !== 'string') continue;
        const decoded = decodeDataUrlBuffer(item.dataUrl);
        if (decoded && decoded.buffer.length > 0 && decoded.buffer.length <= 5 * 1024 * 1024) {
          fs.writeFileSync(path.join(studentDir, item.fileName), decoded.buffer);
          written += 1;
        }
      }

      return res.json({ success: true, written });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Icon save failed' });
    }
  });

  app.get('/api/student-icon/:studentId/:fileName', (req, res) => {
    const allowedFiles = new Set(['192.png', '512.png', 'maskable-512.png', 'apple-touch-icon.png']);
    const fileName = req.params.fileName;
    if (!allowedFiles.has(fileName)) {
      return res.status(404).end();
    }

    const studentId = req.params.studentId;
    const safeId = sanitizeStudentPathId(studentId);
    const cachedFile = path.join(PWA_ICON_DIR, safeId, fileName);

    res.setHeader('Cache-Control', 'no-cache, max-age=0');

    if (fs.existsSync(cachedFile)) {
      res.setHeader('Content-Type', 'image/png');
      return res.sendFile(cachedFile);
    }

    // Fallback to raw student passport avatar stored in memoryDb if present
    if (!memoryDb) {
      loadDatabaseFromFile();
    }
    const matchedStudent = Array.isArray(memoryDb?.students)
      ? memoryDb.students.find((s: any) => s && s.id === studentId)
      : null;

    if (matchedStudent?.avatarUrl) {
      const decoded = decodeDataUrlBuffer(matchedStudent.avatarUrl);
      if (decoded) {
        res.setHeader('Content-Type', decoded.mime);
        return res.send(decoded.buffer);
      }
    }

    // Final fallback to academy default PNG icon
    const publicFallbackName =
      fileName === '192.png'
        ? 'pwa-192x192.png'
        : fileName === 'maskable-512.png'
        ? 'pwa-maskable-512x512.png'
        : fileName === 'apple-touch-icon.png'
        ? 'apple-touch-icon.png'
        : 'pwa-512x512.png';

    const publicFile = path.join(__dirname, 'public', publicFallbackName);
    if (fs.existsSync(publicFile)) {
      res.setHeader('Content-Type', 'image/png');
      return res.sendFile(publicFile);
    }

    return res.status(404).end();
  });

  app.get('/api/student-manifest/:studentId', (req, res) => {
    if (!memoryDb) {
      loadDatabaseFromFile();
    }
    const studentId = req.params.studentId;
    const matchedStudent = Array.isArray(memoryDb?.students)
      ? memoryDb.students.find((s: any) => s && s.id === studentId)
      : null;

    const studentName = (matchedStudent?.nameBn || '').trim();
    let shortName = 'ডি-লিকন';
    if (studentName) {
      if (studentName.length <= 12) {
        shortName = studentName;
      } else {
        const parts = studentName.split(/\s+/);
        if (parts[0] && parts[0].length <= 12) {
          shortName =
            parts[1] && `${parts[0]} ${parts[1]}`.length <= 12
              ? `${parts[0]} ${parts[1]}`
              : parts[0];
        } else {
          shortName = studentName.slice(0, 12);
        }
      }
    }

    const versionQuery = typeof req.query.v === 'string' && req.query.v ? `?v=${encodeURIComponent(req.query.v)}` : '';
    const encodedId = encodeURIComponent(studentId);
    const startUrl = `/?guardian=${encodedId}&locked=1`;

    const manifestPayload = {
      id: startUrl,
      name: studentName ? `${studentName} — ডি-লিকন ড্যাশবোর্ড` : 'ডি-লিকন মডেল একাডেমী',
      short_name: shortName,
      description: studentName
        ? `${studentName}-এর ব্যক্তিগত শিক্ষার্থী ও অভিভাবক ড্যাশবোর্ড`
        : 'ডি-লিকন মডেল একাডেমী - ডিজিটাল রেজাল্ট ও অভিভাবক পোর্টাল',
      theme_color: '#091e42',
      background_color: '#091e42',
      display: 'standalone',
      start_url: startUrl,
      scope: '/',
      icons: [
        {
          src: `/api/student-icon/${encodedId}/192.png${versionQuery}`,
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: `/api/student-icon/${encodedId}/512.png${versionQuery}`,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: `/api/student-icon/${encodedId}/maskable-512.png${versionQuery}`,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    };

    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.json(manifestPayload);
  });

  // =========================================================================
  // DIGITAL LIBRARY FILE UPLOAD, STREAMING, DOWNLOAD & METADATA ENDPOINTS
  // Stores uploaded PDFs, e-books, docs, slides & images safely on server disk
  // =========================================================================
  const LIBRARY_DIR = path.join(DATA_DIR, 'library_files');
  if (!fs.existsSync(LIBRARY_DIR)) {
    fs.mkdirSync(LIBRARY_DIR, { recursive: true });
  }

  const sanitizeLibraryId = (raw: string): string =>
    raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 96) || `lib_${Date.now()}`;

  const sanitizeLibraryFileName = (raw: string): string => {
    const base = path.basename(raw || 'material.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
    return base.slice(0, 120) || 'material.pdf';
  };

  const decodeGenericDataUrl = (dataUrl: string): { mime: string; buffer: Buffer } | null => {
    if (typeof dataUrl !== 'string') return null;
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;
    try {
      return {
        mime: match[1].trim(),
        buffer: Buffer.from(match[2], 'base64'),
      };
    } catch {
      return null;
    }
  };

  const buildStarterPdfBuffer = (heading: string, lines: string[]): Buffer => {
    const escapePdfText = (txt: string) =>
      txt.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

    const textOps: string[] = [
      'BT',
      '/F1 18 Tf',
      '50 760 Td',
      `(${escapePdfText('D-Likon Model Academy - Digital Library')}) Tj`,
      '/F1 13 Tf',
      '0 -28 Td',
      `(${escapePdfText(heading)}) Tj`,
      '/F1 11 Tf',
      '0 -24 Td',
    ];
    for (const line of lines) {
      textOps.push(`(${escapePdfText(line)}) Tj`);
      textOps.push('0 -18 Td');
    }
    textOps.push('ET');
    const streamContent = textOps.join('\n');

    const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
    const obj2 = '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';
    const obj3 =
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n';
    const obj4 = `4 0 obj\n<< /Length ${Buffer.byteLength(streamContent, 'utf8')} >>\nstream\n${streamContent}\nendstream\nendobj\n`;
    const obj5 = '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n';

    const header = '%PDF-1.4\n';
    const offsets: number[] = [0];
    let body = header;
    for (const obj of [obj1, obj2, obj3, obj4, obj5]) {
      offsets.push(Buffer.byteLength(body, 'utf8'));
      body += obj;
    }
    const xrefStart = Buffer.byteLength(body, 'utf8');
    let xref = `xref\n0 6\n0000000000 65535 f \n`;
    for (let i = 1; i <= 5; i++) {
      xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
    return Buffer.from(body + xref + trailer, 'utf8');
  };

  const STARTER_PDF_CONTENT: Record<string, { fileName: string; heading: string; lines: string[] }> = {
    lib_starter_bangla_4: {
      fileName: 'bangla-class-4-ebook.pdf',
      heading: 'Class 4 Bangla E-Book & Study Guide (2026)',
      lines: [
        'Subject: Bangla | Class: Class 4 | Academic Year: 2026',
        'Includes chapter summaries, vocabulary exercises, and creative questions.',
        '1. Read each chapter carefully and practice word meanings.',
        '2. Complete all short questions and grammar exercises in your notebook.',
        'Uploaded by: Head Teacher, D-Likon Model Academy',
      ],
    },
    lib_starter_math_guide: {
      fileName: 'math-fraction-lecture.pdf',
      heading: 'Primary Mathematics Lecture Sheet - Fractions & Geometry',
      lines: [
        'Subject: Mathematics | Class: Class 4 | Chapter: Fractions, HCF & LCM',
        'Key Topics Covered:',
        '- Proper, Improper, and Mixed Fractions conversion',
        '- Addition and Subtraction of Fractions with Step-by-Step Examples',
        '- Prime Factorization Method for HCF and LCM',
        '- Practice Worksheet for Term Exam Preparation',
      ],
    },
    lib_starter_english_grammar: {
      fileName: 'english-grammar-handbook.pdf',
      heading: 'English Grammar & Vocabulary Handbook (All Classes)',
      lines: [
        'Subject: English | Scope: All Classes | Academic Year: 2026',
        'Essential Grammar Checklist:',
        '1. Parts of Speech (Noun, Pronoun, Verb, Adjective, Adverb)',
        '2. 12 Basic Tenses with Affirmative, Negative & Interrogative Forms',
        '3. Sentence Structure & Punctuation Rules',
        '4. Daily Vocabulary & Short Paragraph Templates',
      ],
    },
  };

  const findLibraryDiskFile = (materialId: string): string | null => {
    const safeId = sanitizeLibraryId(materialId);
    const prefix = `${safeId}__`;
    try {
      const files = fs.readdirSync(LIBRARY_DIR);
      const match = files.find((f) => f.startsWith(prefix));
      if (match) {
        return path.join(LIBRARY_DIR, path.basename(match));
      }
    } catch {
      // Ignore
    }
    return null;
  };

  const inferMimeFromExt = (fileName: string): string => {
    const ext = path.extname(fileName).toLowerCase();
    if (ext === '.pdf') return 'application/pdf';
    if (ext === '.epub') return 'application/epub+zip';
    if (ext === '.mobi') return 'application/x-mobipocket-ebook';
    if (ext === '.doc') return 'application/msword';
    if (ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (ext === '.ppt') return 'application/vnd.ms-powerpoint';
    if (ext === '.pptx') return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    if (ext === '.xls') return 'application/vnd.ms-excel';
    if (ext === '.xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (ext === '.txt') return 'text/plain; charset=utf-8';
    if (ext === '.png') return 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.webp') return 'image/webp';
    return 'application/octet-stream';
  };

  app.get('/api/library', (_req, res) => {
    if (!memoryDb) {
      loadDatabaseFromFile();
    }
    const items = Array.isArray(memoryDb?.libraryMaterials) ? memoryDb.libraryMaterials : [];
    return res.json({ success: true, items });
  });

  app.post('/api/library/upload', (req, res) => {
    try {
      if (!memoryDb) {
        loadDatabaseFromFile();
      }
      const {
        id,
        title,
        description,
        category,
        fileType,
        classId,
        subjectId,
        subjectNameBn,
        chapter,
        fileName,
        mimeType,
        fileSizeBytes,
        fileDataUrl,
        externalUrl,
        uploadedBy,
        uploadedByRole,
        academicYear,
      } = req.body || {};

      if (!title || typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ success: false, message: 'মেটেরিয়ালের শিরোনাম আবশ্যক' });
      }

      const materialId = sanitizeLibraryId(id || `lib_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
      const nowIso = new Date().toISOString();

      let finalFileName = sanitizeLibraryFileName(fileName || 'resource.pdf');
      let finalMime = typeof mimeType === 'string' && mimeType ? mimeType : inferMimeFromExt(finalFileName);
      let finalSize = Number(fileSizeBytes) || 0;
      let finalUrl = '';
      let isExternalUrl = false;

      if (typeof fileDataUrl === 'string' && fileDataUrl.startsWith('data:')) {
        const decoded = decodeGenericDataUrl(fileDataUrl);
        if (!decoded || decoded.buffer.length === 0) {
          return res.status(400).json({ success: false, message: 'ফাইল ডেটা সঠিকভাবে পড়া যায়নি' });
        }
        if (decoded.buffer.length > 42 * 1024 * 1024) {
          return res.status(413).json({ success: false, message: 'ফাইলটি ৪২ মেগাবাইটের বেশি হতে পারবে না' });
        }

        const diskFilePath = path.join(LIBRARY_DIR, `${materialId}__${finalFileName}`);
        fs.writeFileSync(diskFilePath, decoded.buffer);
        finalMime = decoded.mime || finalMime;
        finalSize = decoded.buffer.length;
        finalUrl = `/api/library/file/${encodeURIComponent(materialId)}/${encodeURIComponent(finalFileName)}`;
      } else if (typeof externalUrl === 'string' && externalUrl.trim()) {
        const trimmedUrl = externalUrl.trim();
        if (!/^https?:\/\//i.test(trimmedUrl)) {
          return res.status(400).json({ success: false, message: 'সঠিক http:// বা https:// লিংক দিন' });
        }
        finalUrl = trimmedUrl;
        isExternalUrl = true;
        finalFileName = sanitizeLibraryFileName(fileName || 'external-link');
        finalMime = mimeType || 'text/html';
      } else {
        return res.status(400).json({ success: false, message: 'অনুগ্রহ করে একটি ফাইল আপলোড করুন অথবা লিংক দিন' });
      }

      const material = {
        id: materialId,
        title: title.trim().slice(0, 240),
        description: typeof description === 'string' ? description.trim().slice(0, 1500) : '',
        category: category || 'pdf_lecture',
        fileType: fileType || (isExternalUrl ? 'link' : 'pdf'),
        classId: classId || 'all',
        subjectId: typeof subjectId === 'string' ? subjectId : '',
        subjectNameBn: typeof subjectNameBn === 'string' ? subjectNameBn : '',
        chapter: typeof chapter === 'string' ? chapter.trim().slice(0, 160) : '',
        fileName: finalFileName,
        mimeType: finalMime,
        fileSizeBytes: finalSize,
        fileUrl: finalUrl,
        isExternalUrl,
        uploadedBy: typeof uploadedBy === 'string' && uploadedBy.trim() ? uploadedBy.trim() : 'শিক্ষক',
        uploadedByRole: uploadedByRole === 'employee' ? 'employee' : 'official',
        downloadsCount: 0,
        academicYear: academicYear || '২০২৬',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const currentItems: any[] = Array.isArray(memoryDb?.libraryMaterials) ? memoryDb.libraryMaterials : [];
      const nextItems = [material, ...currentItems.filter((item) => item && item.id !== materialId)];

      saveDatabaseToFile({
        ...(memoryDb || {}),
        libraryMaterials: nextItems,
        _lastUpdated: nowIso,
      });

      return res.json({ success: true, material });
    } catch (err: any) {
      console.error('[Library Upload Error]:', err);
      return res.status(500).json({ success: false, message: err?.message || 'Library upload error' });
    }
  });

  app.put('/api/library/:id', (req, res) => {
    try {
      if (!memoryDb) {
        loadDatabaseFromFile();
      }
      const targetId = req.params.id;
      const updates = req.body || {};
      const currentItems: any[] = Array.isArray(memoryDb?.libraryMaterials) ? memoryDb.libraryMaterials : [];
      let updatedItem: any = null;
      const nowIso = new Date().toISOString();

      const nextItems = currentItems.map((item) => {
        if (item && item.id === targetId) {
          updatedItem = {
            ...item,
            ...(typeof updates.title === 'string' && updates.title.trim() ? { title: updates.title.trim().slice(0, 240) } : {}),
            ...(typeof updates.description === 'string' ? { description: updates.description.trim().slice(0, 1500) } : {}),
            ...(typeof updates.category === 'string' ? { category: updates.category } : {}),
            ...(typeof updates.classId === 'string' ? { classId: updates.classId } : {}),
            ...(typeof updates.subjectId === 'string' ? { subjectId: updates.subjectId } : {}),
            ...(typeof updates.subjectNameBn === 'string' ? { subjectNameBn: updates.subjectNameBn } : {}),
            ...(typeof updates.chapter === 'string' ? { chapter: updates.chapter.trim().slice(0, 160) } : {}),
            ...(typeof updates.academicYear === 'string' ? { academicYear: updates.academicYear } : {}),
            updatedAt: nowIso,
          };
          return updatedItem;
        }
        return item;
      });

      if (!updatedItem) {
        return res.status(404).json({ success: false, message: 'Material not found' });
      }

      saveDatabaseToFile({
        ...(memoryDb || {}),
        libraryMaterials: nextItems,
        _lastUpdated: nowIso,
      });

      return res.json({ success: true, material: updatedItem });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Update failed' });
    }
  });

  app.post('/api/library/:id/download', (req, res) => {
    try {
      if (!memoryDb) {
        loadDatabaseFromFile();
      }
      const targetId = req.params.id;
      const currentItems: any[] = Array.isArray(memoryDb?.libraryMaterials) ? memoryDb.libraryMaterials : [];
      let found: any = null;

      const nextItems = currentItems.map((item) => {
        if (item && item.id === targetId) {
          found = {
            ...item,
            downloadsCount: (Number(item.downloadsCount) || 0) + 1,
          };
          return found;
        }
        return item;
      });

      if (found) {
        saveDatabaseToFile({
          ...(memoryDb || {}),
          libraryMaterials: nextItems,
          _lastUpdated: new Date().toISOString(),
        });
        return res.json({ success: true, downloadsCount: found.downloadsCount });
      }

      return res.json({ success: true, downloadsCount: 1 });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Download count failed' });
    }
  });

  app.delete('/api/library/:id', (req, res) => {
    try {
      if (!memoryDb) {
        loadDatabaseFromFile();
      }
      const targetId = req.params.id;
      const safeId = sanitizeLibraryId(targetId);

      // Delete matching files from disk
      try {
        const files = fs.readdirSync(LIBRARY_DIR);
        for (const f of files) {
          if (f.startsWith(`${safeId}__`)) {
            fs.unlinkSync(path.join(LIBRARY_DIR, f));
          }
        }
      } catch {
        // Non-fatal
      }

      const currentItems: any[] = Array.isArray(memoryDb?.libraryMaterials) ? memoryDb.libraryMaterials : [];
      const nextItems = currentItems.filter((item) => item && item.id !== targetId);

      saveDatabaseToFile({
        ...(memoryDb || {}),
        libraryMaterials: nextItems,
        _lastUpdated: new Date().toISOString(),
      });

      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Delete failed' });
    }
  });

  app.get('/api/library/file/:id/:fileName', (req, res) => {
    try {
      const materialId = req.params.id;
      const reqFileName = sanitizeLibraryFileName(req.params.fileName);
      let diskFile = findLibraryDiskFile(materialId);

      // Lazy-create starter curriculum PDF on disk if requested
      if (!diskFile && STARTER_PDF_CONTENT[materialId]) {
        const starter = STARTER_PDF_CONTENT[materialId];
        const safeId = sanitizeLibraryId(materialId);
        const generatedPath = path.join(LIBRARY_DIR, `${safeId}__${starter.fileName}`);
        const pdfBuf = buildStarterPdfBuffer(starter.heading, starter.lines);
        fs.writeFileSync(generatedPath, pdfBuf);
        diskFile = generatedPath;
      }

      if (!diskFile || !fs.existsSync(diskFile)) {
        return res.status(404).json({ success: false, message: 'File not found on server' });
      }

      if (!memoryDb) {
        loadDatabaseFromFile();
      }
      const meta = Array.isArray(memoryDb?.libraryMaterials)
        ? memoryDb.libraryMaterials.find((item: any) => item && item.id === materialId)
        : null;

      const contentType = meta?.mimeType || inferMimeFromExt(diskFile);
      const isDownload = req.query.download === '1' || req.query.download === 'true';
      const cleanDownloadName = sanitizeLibraryFileName(meta?.fileName || reqFileName);

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.setHeader(
        'Content-Disposition',
        `${isDownload ? 'attachment' : 'inline'}; filename="${cleanDownloadName}"`
      );
      return res.sendFile(diskFile);
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'File serve error' });
    }
  });

  // =========================================================================
  const httpServer = http.createServer(app);

  // Attach dedicated WebSocket server on /ws/gatepass for instant cross-device gatepass voice alerts
  const gatepassWss = new WebSocketServer({ noServer: true });

  gatepassWss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
    let urlObj: URL | null = null;
    try {
      urlObj = new URL(req.url || '/ws/gatepass', 'http://localhost');
    } catch {
      urlObj = null;
    }

    const rawRoll = Number(urlObj?.searchParams.get('roll'));
    const clientEntry: GatepassWsClient = {
      ws,
      studentId: urlObj?.searchParams.get('studentId')?.trim() || '',
      portalId: urlObj?.searchParams.get('portalId')?.trim().toUpperCase() || '',
      classId: urlObj?.searchParams.get('classId')?.trim() || '',
      roll: !Number.isNaN(rawRoll) && rawRoll > 0 ? rawRoll : null,
      role: urlObj?.searchParams.get('role')?.trim() || 'student',
      isAlive: true,
    };
    gatepassWsClients.add(clientEntry);

    if (!memoryDb) {
      loadDatabaseFromFile();
    }
    const logs: any[] = Array.isArray(memoryDb?.securityLogs) ? memoryDb.securityLogs : [];
    const recentLogs =
      clientEntry.studentId || clientEntry.portalId || (clientEntry.classId && clientEntry.roll)
        ? logs
            .filter((l) =>
              logMatchesTargetStudent(
                l,
                clientEntry.studentId,
                clientEntry.portalId,
                clientEntry.classId,
                clientEntry.roll
              )
            )
            .slice(0, 10)
        : logs.slice(0, 20);

    try {
      ws.send(
        JSON.stringify({
          type: 'gatepass:init',
          serverTime: Date.now(),
          serverInstanceId: SERVER_INSTANCE_ID,
          logs: recentLogs,
        })
      );
    } catch {
      // Ignore send error
    }

    ws.on('pong', () => {
      clientEntry.isAlive = true;
    });

    ws.on('message', (rawMsg) => {
      clientEntry.isAlive = true;
      try {
        const parsed = JSON.parse(String(rawMsg));
        if (parsed && parsed.type === 'subscribe') {
          clientEntry.studentId = String(parsed.studentId || '').trim();
          clientEntry.portalId = String(parsed.portalId || '').trim().toUpperCase();
          clientEntry.classId = String(parsed.classId || '').trim();
          const pRoll = Number(parsed.roll);
          clientEntry.roll = !Number.isNaN(pRoll) && pRoll > 0 ? pRoll : null;
          clientEntry.role = String(parsed.role || clientEntry.role).trim();
          const currentLogs: any[] = Array.isArray(memoryDb?.securityLogs) ? memoryDb.securityLogs : [];
          const subLogs =
            clientEntry.studentId || clientEntry.portalId || (clientEntry.classId && clientEntry.roll)
              ? currentLogs
                  .filter((l) =>
                    logMatchesTargetStudent(
                      l,
                      clientEntry.studentId,
                      clientEntry.portalId,
                      clientEntry.classId,
                      clientEntry.roll
                    )
                  )
                  .slice(0, 10)
              : currentLogs.slice(0, 20);
          ws.send(
            JSON.stringify({
              type: 'gatepass:init',
              serverTime: Date.now(),
              serverInstanceId: SERVER_INSTANCE_ID,
              logs: subLogs,
            })
          );
        } else if (parsed && parsed.type === 'ping') {
          ws.send(
            JSON.stringify({
              type: 'pong',
              serverTime: Date.now(),
              serverInstanceId: SERVER_INSTANCE_ID,
              clientSentAt: typeof parsed.clientSentAt === 'number' ? parsed.clientSentAt : null,
            })
          );
        }
      } catch {
        // Ignore malformed WS message
      }
    });

    ws.on('close', () => {
      gatepassWsClients.delete(clientEntry);
    });
    ws.on('error', () => {
      gatepassWsClients.delete(clientEntry);
    });
  });

  const wsHeartbeatTimer = setInterval(() => {
    for (const client of gatepassWsClients) {
      if (!client.isAlive) {
        try {
          client.ws.terminate();
        } catch {}
        gatepassWsClients.delete(client);
        continue;
      }
      client.isAlive = false;
      try {
        client.ws.ping();
      } catch {
        gatepassWsClients.delete(client);
      }
    }
  }, 25000);
  wsHeartbeatTimer.unref?.();

  httpServer.on('upgrade', (request, socket, head) => {
    try {
      const reqUrl = new URL(request.url || '/', 'http://localhost');
      if (reqUrl.pathname === '/ws/gatepass') {
        gatepassWss.handleUpgrade(request, socket, head, (ws) => {
          gatepassWss.emit('connection', ws, request);
        });
      }
    } catch {
      socket.destroy();
    }
  });

  // =========================================================================
  // VITE DEV MIDDLEWARE / STATIC PROD SERVING
  // =========================================================================
  const distPath = path.join(__dirname, 'dist');
  const hasDistBuild = fs.existsSync(path.join(distPath, 'index.html'));
  let useViteDev = !IS_PROD;
  let viteCreateServer: ((opts: any) => Promise<any>) | null = null;

  if (useViteDev) {
    try {
      const vitePkg = await import('vite');
      viteCreateServer = vitePkg.createServer;
    } catch {
      useViteDev = false;
    }
  }

  if (useViteDev && viteCreateServer) {
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

    const vite = await viteCreateServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use((req, res, next) => {
      if (
        req.method === 'GET' &&
        !req.path.startsWith('/api/') &&
        !req.path.startsWith('/ws/') &&
        (req.path === '/' || !req.path.includes('.'))
      ) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      }
      next();
    });
    app.use(vite.middlewares);
  } else {
    if (!hasDistBuild) {
      console.warn('[Server] Warning: dist/index.html not found in production/static mode.');
    }
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          if (
            filePath.endsWith('index.html') ||
            filePath.endsWith('sw.js') ||
            filePath.endsWith('sw-student-icon.js') ||
            filePath.endsWith('.webmanifest')
          ) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
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
