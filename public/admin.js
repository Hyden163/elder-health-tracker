const STORAGE_KEY = 'health_admin_key';
const loginPanel = document.getElementById('login-panel');
const adminPanel = document.getElementById('admin-panel');
const loginForm = document.getElementById('login-form');
const loginMessage = document.getElementById('login-message');
const adminKeyInput = document.getElementById('admin-key');
const tableBody = document.getElementById('table-body');
const recordCountEl = document.getElementById('record-count');
const downloadBtn = document.getElementById('download-btn');
const rangeButtons = document.querySelectorAll('.range-btn');

let currentRange = '90';
let adminKey = sessionStorage.getItem(STORAGE_KEY) || '';

function periodLabel(period) {
  return period === 'morning' ? '早晨' : '晚上';
}

function formatCreatedAt(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('zh-CN', { hour12: false });
}

function apiUrl(path) {
  const url = new URL(path, window.location.origin);
  url.searchParams.set('key', adminKey);
  return url.toString();
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

function renderTable(entries) {
  recordCountEl.textContent = `共 ${entries.length} 条记录`;

  if (!entries.length) {
    tableBody.innerHTML = '<tr><td colspan="7" class="table-empty">该时间范围内暂无记录</td></tr>';
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
  tableBody.innerHTML = '<tr><td colspan="7" class="table-empty">加载中…</td></tr>';
  try {
    const response = await fetch(apiUrl(`/api/admin/entries?range=${currentRange}`), {
      headers: { 'x-admin-key': adminKey },
    });
    const result = await response.json();
    if (response.status === 401) {
      sessionStorage.removeItem(STORAGE_KEY);
      adminKey = '';
      showLoginView();
      showLoginMessage(result.error || '管理员密钥无效，请重新登录。', true);
      return;
    }
    if (response.status === 503) {
      showLoginMessage(result.error || '服务器未配置管理员密钥。', true);
      return;
    }
    if (!response.ok) {
      throw new Error(result.error || '加载失败');
    }
    renderTable(result.entries || []);
  } catch (error) {
    tableBody.innerHTML = `<tr><td colspan="7" class="table-empty">${error.message || '加载失败，请稍后重试'}</td></tr>`;
    recordCountEl.textContent = '共 0 条记录';
  }
}

function downloadCsv() {
  const url = apiUrl(`/api/admin/entries/export?range=${currentRange}`);
  window.location.href = url;
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  adminKey = adminKeyInput.value.trim();
  if (!adminKey) {
    showLoginMessage('请输入管理员密钥。', true);
    return;
  }

  try {
    const response = await fetch(apiUrl('/api/admin/entries?range=7'), {
      headers: { 'x-admin-key': adminKey },
    });
    const result = await response.json();
    if (response.status === 401) {
      showLoginMessage(result.error || '管理员密钥错误。', true);
      return;
    }
    if (response.status === 503) {
      showLoginMessage(result.error || '服务器未配置 ADMIN_KEY。', true);
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
    await loadEntries();
  } catch (error) {
    showLoginMessage('网络异常，请稍后重试。', true);
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

downloadBtn.addEventListener('click', downloadCsv);

const urlKey = new URLSearchParams(window.location.search).get('key');
if (urlKey) {
  adminKey = urlKey;
  sessionStorage.setItem(STORAGE_KEY, adminKey);
  adminKeyInput.value = urlKey;
}

if (adminKey) {
  showAdminView();
  loadEntries();
} else {
  showLoginView();
}
