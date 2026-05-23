const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'health.json');
const FAMILY_ACCESS_KEY = process.env.FAMILY_ACCESS_KEY || '';
const ADMIN_KEY = process.env.ADMIN_KEY || '';

app.use(cors());
app.use(express.json());

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

function requireAdmin(req, res, next) {
  if (!ADMIN_KEY) {
    return res.status(503).json({ error: '服务器未配置 ADMIN_KEY，无法使用管理后台' });
  }
  const key = req.query.key || req.headers['x-admin-key'];
  if (key !== ADMIN_KEY) {
    return res.status(401).json({ error: '管理员密钥无效或缺失' });
  }
  return next();
}
app.use(express.static(path.join(__dirname, 'public')));

function loadDatabase() {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    return { entries: [] };
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
    saveDatabase({ entries: [] });
  }
}

function getStartDate(days) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  now.setDate(now.getDate() - days + 1);
  return now;
}

initDatabase();

function sortEntries(entries) {
  return [...entries].sort((a, b) => {
    const timeA = new Date(a.recordedAt).getTime();
    const timeB = new Date(b.recordedAt).getTime();
    if (timeA !== timeB) return timeA - timeB;
    return a.period === 'morning' ? -1 : 1;
  });
}

function filterEntriesByRange(entries, range) {
  if (range === 'all') {
    return sortEntries(entries);
  }
  const days = Number(range);
  if (![7, 30, 90].includes(days)) {
    return null;
  }
  const startDate = getStartDate(days);
  return sortEntries(entries.filter((item) => new Date(item.recordedAt) >= startDate));
}

function periodLabel(period) {
  return period === 'morning' ? '早晨' : '晚上';
}

function entriesToCsv(entries) {
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

app.get('/api/admin/entries', requireAdmin, (req, res) => {
  const range = req.query.range || '90';
  const db = loadDatabase();
  const entries = filterEntriesByRange(db.entries, range);
  if (!entries) {
    return res.status(400).json({ error: 'range 参数必须为 7、30、90 或 all' });
  }
  res.json({ entries });
});

app.get('/api/admin/entries/export', requireAdmin, (req, res) => {
  const range = req.query.range || 'all';
  const db = loadDatabase();
  const entries = filterEntriesByRange(db.entries, range);
  if (!entries) {
    return res.status(400).json({ error: 'range 参数必须为 7、30、90 或 all' });
  }
  const csv = entriesToCsv(entries);
  const suffix = range === 'all' ? 'all' : `${range}d`;
  res.header('Content-Type', 'text/csv; charset=utf-8');
  res.attachment(`health-records-${suffix}.csv`);
  res.send(csv);
});

app.use('/api', requireFamilyKey);

app.get('/api/entries', (req, res) => {
  const range = req.query.range || '7';
  const days = Number(range);
  if (![7, 30, 90].includes(days)) {
    return res.status(400).json({ error: 'range 参数必须为 7、30 或 90' });
  }

  const db = loadDatabase();
  const entries = filterEntriesByRange(db.entries, String(days));
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
  const entries = filterEntriesByRange(db.entries, String(days));

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

  db.entries.push(newEntry);
  saveDatabase(db);
  res.json({ success: true, id: newEntry.id });
});

app.get('*', (req, res, next) => {
  if (req.path === '/admin' || req.path.startsWith('/admin/')) {
    return res.sendFile(path.join(__dirname, 'public', 'admin.html'));
  }
  return res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
