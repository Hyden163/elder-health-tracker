const STORAGE_KEY = 'health_admin_key';
const loginPanel = document.getElementById('login-panel');
const adminPanel = document.getElementById('admin-panel');
const loginForm = document.getElementById('login-form');
const loginMessage = document.getElementById('login-message');
const adminKeyInput = document.getElementById('admin-key');
const tableHead = document.getElementById('table-head');
const tableBody = document.getElementById('table-body');
const recordCountEl = document.getElementById('record-count');
const downloadBtn = document.getElementById('download-btn');
const rangeButtons = document.querySelectorAll('.admin-toolbar .range-btn');
const passwordForm = document.getElementById('password-form');
const passwordMessage = document.getElementById('password-message');
const oldPasswordInput = document.getElementById('old-password');
const newPasswordInput = document.getElementById('new-password');
const confirmPasswordInput = document.getElementById('confirm-password');
const typeTabs = document.querySelectorAll('.type-tab');

const urlParams = new URLSearchParams(window.location.search);
let currentRange = '90';
let currentType = urlParams.get('type') === 'glucose' ? 'glucose' : 'cardio';
let adminKey = sessionStorage.getItem(STORAGE_KEY) || '';
let columnCount = 7;

const TABLE_SCHEMA = {
  cardio: {
    headers: ['日期', '时段', '心率', '高压', '低压', '血氧', '录入时间'],
    colspan: 7,
  },
  glucose: {
    headers: ['日期', '空腹', '早餐后', '午餐后', '晚餐后', '录入时间'],
    colspan: 6,
  },
};

function periodLabel(period) {
  return period === 'morning' ? '早晨' : '晚上';
}

function formatCreatedAt(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('zh-CN', { hour12: false });
}

function formatGlucose(value) {
  return value === null || value === undefined ? '—' : value;
}

function apiUrl(path) {
  const url = new URL(path, window.location.origin);
  url.searchParams.set('key', adminKey);
  url.searchParams.set('type', currentType);
  return url.toString();
}

function showPasswordMessage(text, isError = false) {
  passwordMessage.textContent = text;
  passwordMessage.classList.remove('hidden', 'error');
  passwordMessage.classList.toggle('error', isError);
}

function showLoginMessage(text, isError = false) {
  loginMessage.textContent = text;
  loginMessage.classList.remove('hidden', 'error');
  loginMessage.classList.toggle('error', isError);
}

function showAdminView() {
  loginPanel.classList.add('hidden');
  adminPanel.classList.remove('hidden');
}

function showLoginView() {
  loginPanel.classList.remove('hidden');
  adminPanel.classList.add('hidden');
}

function renderTableHead() {
  const schema = TABLE_SCHEMA[currentType];
  columnCount = schema.colspan;
  tableHead.innerHTML = `<tr>${schema.headers.map((h) => `<th>${h}</th>`).join('')}</tr>`;
}

function setActiveTypeTab() {
  typeTabs.forEach((tab) => {
    const active = tab.dataset.type === currentType;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
  });
}

function renderTable(entries) {
  recordCountEl.textContent = `共 ${entries.length} 条记录`;

  if (!entries.length) {
    tableBody.innerHTML = `<tr><td colspan="${columnCount}" class="table-empty">该时间范围内暂无记录</td></tr>`;
    return;
  }

  if (currentType === 'glucose') {
    const sorted = [...entries].sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));
    tableBody.innerHTML = sorted.map((item) => `
      <tr>
        <td>${item.recordedAt}</td>
        <td>${formatGlucose(item.fasting)}</td>
        <td>${formatGlucose(item.afterBreakfast)}</td>
        <td>${formatGlucose(item.afterLunch)}</td>
        <td>${formatGlucose(item.afterDinner)}</td>
        <td>${formatCreatedAt(item.updatedAt || item.createdAt)}</td>
      </tr>
    `).join('');
    return;
  }

  const sorted = [...entries].sort((a, b) => {
    const timeA = new Date(a.recordedAt).getTime();
    const timeB = new Date(b.recordedAt).getTime();
    if (timeA !== timeB) return timeB - timeA;
    return a.period === 'evening' ? -1 : 1;
  });

  tableBody.innerHTML = sorted.map((item) => `
    <tr>
      <td>${item.recordedAt}</td>
      <td>${periodLabel(item.period)}</td>
      <td>${item.heartRate}</td>
      <td>${item.systolic}</td>
      <td>${item.diastolic}</td>
      <td>${item.spo2}%</td>
      <td>${formatCreatedAt(item.createdAt)}</td>
    </tr>
  `).join('');
}

async function loadEntries() {
  renderTableHead();
  tableBody.innerHTML = `<tr><td colspan="${columnCount}" class="table-empty">加载中…</td></tr>`;
  try {
    const response = await fetch(apiUrl(`/api/admin/entries?range=${currentRange}`), {
      headers: { 'x-admin-key': adminKey },
    });
    const result = await response.json();
    if (response.status === 401) {
      sessionStorage.removeItem(STORAGE_KEY);
      adminKey = '';
      showLoginView();
      showLoginMessage(result.error || '管理员密码无效，请重新登录。', true);
      return;
    }
    if (!response.ok) {
      throw new Error(result.error || '加载失败');
    }
    if (result.type === 'glucose' || result.type === 'cardio') {
      currentType = result.type;
      setActiveTypeTab();
      renderTableHead();
    }
    renderTable(result.entries || []);
  } catch (error) {
    tableBody.innerHTML = `<tr><td colspan="${columnCount}" class="table-empty">${error.message || '加载失败，请稍后重试'}</td></tr>`;
    recordCountEl.textContent = '共 0 条记录';
  }
}

function downloadCsv() {
  window.location.href = apiUrl(`/api/admin/entries/export?range=${currentRange}`);
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  adminKey = adminKeyInput.value;
  if (!adminKey) {
    showLoginMessage('请输入管理员密码。', true);
    return;
  }

  try {
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: adminKey }),
    });
    const result = await response.json();
    if (response.status === 401) {
      showLoginMessage(result.error || '管理员密码错误。', true);
      return;
    }
    if (!response.ok) {
      showLoginMessage(result.error || '登录失败。', true);
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, adminKey);
    showAdminView();
    currentRange = '90';
    rangeButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.range === '90'));
    setActiveTypeTab();
    await loadEntries();
  } catch (error) {
    showLoginMessage('网络异常，请稍后重试。', true);
  }
});

passwordForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const oldPassword = oldPasswordInput.value;
  const newPassword = newPasswordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  if (newPassword !== confirmPassword) {
    showPasswordMessage('两次输入的新密码不一致。', true);
    return;
  }

  try {
    const response = await fetch('/api/admin/password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': adminKey,
      },
      body: JSON.stringify({ oldPassword, newPassword, confirmPassword }),
    });
    const result = await response.json();
    if (response.status === 401) {
      if (result.error && result.error.includes('旧密码')) {
        showPasswordMessage(result.error, true);
        return;
      }
      sessionStorage.removeItem(STORAGE_KEY);
      adminKey = '';
      showLoginView();
      showLoginMessage(result.error || '登录已失效，请重新登录。', true);
      return;
    }
    if (!response.ok) {
      showPasswordMessage(result.error || '修改失败。', true);
      return;
    }
    adminKey = newPassword;
    sessionStorage.setItem(STORAGE_KEY, adminKey);
    passwordForm.reset();
    showPasswordMessage('密码已更新，请妥善记住新密码。');
  } catch (error) {
    showPasswordMessage('网络异常，请稍后重试。', true);
  }
});

rangeButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    rangeButtons.forEach((btn) => btn.classList.remove('active'));
    button.classList.add('active');
    currentRange = button.dataset.range;
    await loadEntries();
  });
});

typeTabs.forEach((tab) => {
  tab.addEventListener('click', async () => {
    currentType = tab.dataset.type === 'glucose' ? 'glucose' : 'cardio';
    setActiveTypeTab();
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('type', currentType);
    window.history.replaceState({}, '', nextUrl);
    await loadEntries();
  });
});

downloadBtn.addEventListener('click', downloadCsv);

const urlKey = urlParams.get('key');
if (urlKey) {
  adminKey = urlKey;
  sessionStorage.setItem(STORAGE_KEY, adminKey);
  adminKeyInput.value = urlKey;
}

setActiveTypeTab();

if (adminKey) {
  showAdminView();
  loadEntries();
} else {
  showLoginView();
}
