const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'health.json');

app.use(cors());
app.use(express.json());
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

app.get('/api/entries', (req, res) => {
  const range = req.query.range || '7';
  const days = Number(range);
  if (![7, 30, 90].includes(days)) {
    return res.status(400).json({ error: 'range 参数必须为 7、30 或 90' });
  }

  const db = loadDatabase();
  const startDate = getStartDate(days);
  const entries = db.entries
    .filter((item) => new Date(item.recordedAt) >= startDate)
    .sort((a, b) => {
      const timeA = new Date(a.recordedAt).getTime();
      const timeB = new Date(b.recordedAt).getTime();
      if (timeA !== timeB) return timeA - timeB;
      return a.period === 'morning' ? -1 : 1;
    });

  res.json({ entries });
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

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
