const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'health.json');
const FAMILY_ACCESS_KEY = process.env.FAMILY_ACCESS_KEY || '';
const DEFAULT_ADMIN_PASSWORD = '123456';
const ADMIN_PASSWORD_MIN_LENGTH = 6;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function requireFamilyKey(req, res, next) {
  if (!FAMILY_ACCESS_KEY) {
    return next();
  }
  const key = req.query.key || req.headers['x-family-key'];
  if (key !== FAMILY_ACCESS_KEY) {
    return res.status(401).json({ error: '访问密钥无效或缺失，请使用家人分享的完整链接' });
  }
  return next();
}

function hashAdminPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function createAdminAuth(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return {
    salt,
    hash: hashAdminPassword(password, salt),
    updatedAt: new Date().toISOString(),
  };
}

function verifyAdminPassword(password, adminAuth) {
  if (!adminAuth || !adminAuth.salt || !adminAuth.hash) {
    return false;
  }
  const hash = hashAdminPassword(password, adminAuth.salt);
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(adminAuth.hash, 'hex'));
  } catch (error) {
    return false;
  }
}

function ensureAdminAuth(data) {
  if (!data.admin || !data.admin.salt || !data.admin.hash) {
    data.admin = createAdminAuth(DEFAULT_ADMIN_PASSWORD);
    return true;
  }
  return false;
}

function getAdminCredential(req) {
  return req.query.key || req.headers['x-admin-key'] || req.body?.password;
}

function requireAdmin(req, res, next) {
  const password = getAdminCredential(req);
  if (!password) {
    return res.status(401).json({ error: '请输入管理员密码' });
  }
  const db = loadDatabase();
  if (!verifyAdminPassword(password, db.admin)) {
    return res.status(401).json({ error: '管理员密码错误' });
  }
  return next();
}

function loadDatabase() {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    const data = JSON.parse(raw);
    if (!data.cardioEntries) {
      data.cardioEntries = data.entries || [];
    }
    if (!data.glucoseEntries) {
      data.glucoseEntries = [];
    }
    if (ensureAdminAuth(data)) {
      saveDatabase(data);
    }
    return data;
  } catch (error) {
    const data = { cardioEntries: [], glucoseEntries: [] };
    ensureAdminAuth(data);
    saveDatabase(data);
    return data;
  }
}

function saveDatabase(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function initDatabase() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    const data = { cardioEntries: [], glucoseEntries: [] };
    ensureAdminAuth(data);
    saveDatabase(data);
  }
}

function getStartDate(days) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  now.setDate(now.getDate() - days + 1);
  return now;
}

function sortCardioEntries(entries) {
  return [...entries].sort((a, b) => {
    const timeA = new Date(a.recordedAt).getTime();
    const timeB = new Date(b.recordedAt).getTime();
    if (timeA !== timeB) return timeA - timeB;
    return a.period === 'morning' ? -1 : 1;
  });
}

function sortGlucoseEntries(entries) {
  return [...entries].sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
}

function filterByRange(entries, range, sorter) {
  if (range === 'all') {
    return sorter(entries);
  }
  const days = Number(range);
  if (![7, 30, 90].includes(days)) {
    return null;
  }
  const startDate = getStartDate(days);
  return sorter(entries.filter((item) => new Date(item.recordedAt) >= startDate));
}

function periodLabel(period) {
  return period === 'morning' ? '早晨' : '晚上';
}

function parseOptionalNumber(value) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function formatGlucoseCell(value) {
  return value === null || value === undefined ? '' : value;
}

function cardioToCsv(entries) {
  const header = ['日期', '时段', '心率(次/分)', '高压(mmHg)', '低压(mmHg)', '血氧(%)', '录入时间'];
  const rows = entries.map((item) => [
    item.recordedAt,
    periodLabel(item.period),
    item.heartRate,
    item.systolic,
    item.diastolic,
    item.spo2,
    item.createdAt,
  ]);
  return rowsToCsv(header, rows);
}

function glucoseToCsv(entries) {
  const header = ['日期', '空腹(mmol/L)', '早餐后(mmol/L)', '午餐后(mmol/L)', '晚餐后(mmol/L)', '录入时间'];
  const rows = entries.map((item) => [
    item.recordedAt,
    formatGlucoseCell(item.fasting),
    formatGlucoseCell(item.afterBreakfast),
    formatGlucoseCell(item.afterLunch),
    formatGlucoseCell(item.afterDinner),
    item.updatedAt || item.createdAt,
  ]);
  return rowsToCsv(header, rows);
}

function rowsToCsv(header, rows) {
  const escapeCell = (value) => {
    const text = String(value ?? '');
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };
  const lines = [header, ...rows].map((row) => row.map(escapeCell).join(','));
  return `\uFEFF${lines.join('\n')}`;
}

function entriesToXml(entries) {
  const escape = (value) => value
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  const rows = entries.map((item) => `  <entry>\n    <id>${escape(item.id)}</id>\n    <recordedAt>${escape(item.recordedAt)}</recordedAt>\n    <period>${escape(item.period)}</period>\n    <heartRate>${escape(item.heartRate)}</heartRate>\n    <systolic>${escape(item.systolic)}</systolic>\n    <diastolic>${escape(item.diastolic)}</diastolic>\n    <spo2>${escape(item.spo2)}</spo2>\n    <createdAt>${escape(item.createdAt)}</createdAt>\n  </entry>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<healthEntries>\n${rows}\n</healthEntries>`;
}

function getAdminType(req) {
  const type = req.query.type || 'cardio';
  return type === 'glucose' ? 'glucose' : 'cardio';
}

initDatabase();

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (!password) {
    return res.status(400).json({ error: '请输入管理员密码' });
  }
  const db = loadDatabase();
  if (!verifyAdminPassword(password, db.admin)) {
    return res.status(401).json({ error: '管理员密码错误' });
  }
  res.json({ success: true });
});

app.post('/api/admin/password', requireAdmin, (req, res) => {
  const { oldPassword, newPassword, confirmPassword } = req.body || {};
  if (!oldPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ error: '请填写旧密码、新密码和确认密码' });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: '两次输入的新密码不一致' });
  }
  if (newPassword.length < ADMIN_PASSWORD_MIN_LENGTH) {
    return res.status(400).json({ error: `新密码至少需要 ${ADMIN_PASSWORD_MIN_LENGTH} 位` });
  }
  if (oldPassword === newPassword) {
    return res.status(400).json({ error: '新密码不能与旧密码相同' });
  }

  const db = loadDatabase();
  if (!verifyAdminPassword(oldPassword, db.admin)) {
    return res.status(401).json({ error: '旧密码不正确' });
  }

  db.admin = createAdminAuth(newPassword);
  saveDatabase(db);
  res.json({ success: true });
});

app.get('/api/admin/entries', requireAdmin, (req, res) => {
  const range = req.query.range || '90';
  const type = getAdminType(req);
  const db = loadDatabase();
  const source = type === 'glucose' ? db.glucoseEntries : db.cardioEntries;
  const sorter = type === 'glucose' ? sortGlucoseEntries : sortCardioEntries;
  const entries = filterByRange(source, range, sorter);
  if (!entries) {
    return res.status(400).json({ error: 'range 参数必须为 7、30、90 或 all' });
  }
  res.json({ entries, type });
});

app.get('/api/admin/entries/export', requireAdmin, (req, res) => {
  const range = req.query.range || 'all';
  const type = getAdminType(req);
  const db = loadDatabase();
  const source = type === 'glucose' ? db.glucoseEntries : db.cardioEntries;
  const sorter = type === 'glucose' ? sortGlucoseEntries : sortCardioEntries;
  const entries = filterByRange(source, range, sorter);
  if (!entries) {
    return res.status(400).json({ error: 'range 参数必须为 7、30、90 或 all' });
  }
  const csv = type === 'glucose' ? glucoseToCsv(entries) : cardioToCsv(entries);
  const prefix = type === 'glucose' ? 'glucose-records' : 'cardio-records';
  const suffix = range === 'all' ? 'all' : `${range}d`;
  res.header('Content-Type', 'text/csv; charset=utf-8');
  res.attachment(`${prefix}-${suffix}.csv`);
  res.send(csv);
});

app.delete('/api/admin/entries', requireAdmin, (req, res) => {
  const type = getAdminType(req);
  const ids = req.body?.ids;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: '请选择要删除的记录' });
  }

  const idSet = new Set(ids.map((id) => Number(id)).filter((id) => Number.isFinite(id)));
  if (!idSet.size) {
    return res.status(400).json({ error: '请选择要删除的记录' });
  }

  const db = loadDatabase();
  const key = type === 'glucose' ? 'glucoseEntries' : 'cardioEntries';
  const beforeCount = db[key].length;
  db[key] = db[key].filter((item) => !idSet.has(Number(item.id)));
  const deleted = beforeCount - db[key].length;

  if (deleted === 0) {
    return res.status(404).json({ error: '未找到要删除的记录' });
  }

  saveDatabase(db);
  res.json({ success: true, deleted });
});

app.use('/api', requireFamilyKey);

app.get('/api/entries', (req, res) => {
  const range = req.query.range || '7';
  const db = loadDatabase();
  const entries = filterByRange(db.cardioEntries, String(Number(range)), sortCardioEntries);
  if (!entries) {
    return res.status(400).json({ error: 'range 参数必须为 7、30 或 90' });
  }
  res.json({ entries });
});

app.get('/api/glucose/entries', (req, res) => {
  const range = req.query.range || '7';
  const db = loadDatabase();
  const entries = filterByRange(db.glucoseEntries, String(Number(range)), sortGlucoseEntries);
  if (!entries) {
    return res.status(400).json({ error: 'range 参数必须为 7、30 或 90' });
  }
  res.json({ entries });
});

app.get('/api/entries/xml', (req, res) => {
  const range = req.query.range || '7';
  const days = Number(range);
  if (![7, 30, 90].includes(days)) {
    return res.status(400).json({ error: 'range 参数必须为 7、30 或 90' });
  }
  const db = loadDatabase();
  const entries = filterByRange(db.cardioEntries, String(days), sortCardioEntries);
  const xml = entriesToXml(entries);
  res.header('Content-Type', 'application/xml');
  res.attachment(`health-records-${days}d.xml`);
  res.send(xml);
});

app.post('/api/entries', (req, res) => {
  const { recordedAt, period, heartRate, systolic, diastolic, spo2 } = req.body;
  if (!recordedAt || !period || !heartRate || !systolic || !diastolic || !spo2) {
    return res.status(400).json({ error: '请提供完整的录入数据' });
  }

  const db = loadDatabase();
  const newEntry = {
    id: Date.now(),
    recordedAt,
    period,
    heartRate: Number(heartRate),
    systolic: Number(systolic),
    diastolic: Number(diastolic),
    spo2: Number(spo2),
    createdAt: new Date().toISOString(),
  };

  db.cardioEntries.push(newEntry);
  saveDatabase(db);
  res.json({ success: true, id: newEntry.id });
});

app.post('/api/glucose/entries', (req, res) => {
  const { recordedAt, fasting, afterBreakfast, afterLunch, afterDinner } = req.body;
  if (!recordedAt) {
    return res.status(400).json({ error: '请提供日期' });
  }

  const values = {
    fasting: parseOptionalNumber(fasting),
    afterBreakfast: parseOptionalNumber(afterBreakfast),
    afterLunch: parseOptionalNumber(afterLunch),
    afterDinner: parseOptionalNumber(afterDinner),
  };

  if (Object.values(values).every((v) => v === null)) {
    return res.status(400).json({ error: '请至少填写一项血糖数值' });
  }

  const db = loadDatabase();
  const index = db.glucoseEntries.findIndex((item) => item.recordedAt === recordedAt);
  const now = new Date().toISOString();

  if (index >= 0) {
    const existing = db.glucoseEntries[index];
    db.glucoseEntries[index] = {
      ...existing,
      ...Object.fromEntries(Object.entries(values).filter(([, v]) => v !== null)),
      updatedAt: now,
    };
    saveDatabase(db);
    return res.json({ success: true, id: db.glucoseEntries[index].id, updated: true });
  }

  const newEntry = {
    id: Date.now(),
    recordedAt,
    fasting: values.fasting,
    afterBreakfast: values.afterBreakfast,
    afterLunch: values.afterLunch,
    afterDinner: values.afterDinner,
    createdAt: now,
    updatedAt: now,
  };

  db.glucoseEntries.push(newEntry);
  saveDatabase(db);
  res.json({ success: true, id: newEntry.id, updated: false });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
