const entryForm = document.getElementById('entry-form');
const messageEl = document.getElementById('message');
const rangeButtons = document.querySelectorAll('.range-btn');
const recordedAtInput = document.getElementById('recordedAt');
const wechatTip = document.getElementById('wechat-tip');
const summaryPanel = document.getElementById('summary-panel');
const summaryText = document.getElementById('summary-text');
const copySummaryBtn = document.getElementById('copy-summary-btn');
const toggleChartsBtn = document.getElementById('toggle-charts-btn');
const chartsBody = document.getElementById('charts-body');
const recentListEl = document.getElementById('recent-list');
const periodInput = document.getElementById('period');
const periodButtons = document.querySelectorAll('.period-btn');

const CHART_TEXT = '#475569';
const CHART_GRID = 'rgba(14, 116, 144, 0.12)';
const COLOR_HEART = '#0E7490';
const COLOR_SYSTOLIC = '#0891B2';
const COLOR_DIASTOLIC = '#67E8F9';
const COLOR_SPO2 = '#059669';

const heartRateCtx = document.getElementById('heartRateChart').getContext('2d');
const bloodPressureCtx = document.getElementById('bloodPressureChart').getContext('2d');
const spo2Ctx = document.getElementById('spo2Chart').getContext('2d');

const defaultDate = new Date().toISOString().slice(0, 10);
recordedAtInput.value = defaultDate;

const familyKey = new URLSearchParams(window.location.search).get('key') || '';
let currentRange = 7;
let heartRateChart;
let bloodPressureChart;
let spo2Chart;
let chartsLoaded = false;
let lastSummaryText = '';

function isWeChatBrowser() {
  return /MicroMessenger/i.test(navigator.userAgent);
}

function apiUrl(path) {
  const url = new URL(path, window.location.origin);
  if (familyKey) {
    url.searchParams.set('key', familyKey);
  }
  return url.toString();
}

function periodLabel(period) {
  return period === 'morning' ? '早晨' : '晚上';
}

function showMessage(text, isError = false) {
  messageEl.textContent = text;
  messageEl.classList.toggle('error', isError);
}

function buildSummaryText(payload) {
  const link = window.location.href.split('#')[0];
  return `${payload.recordedAt} ${periodLabel(payload.period)}：心率 ${payload.heartRate}，血压 ${payload.systolic}/${payload.diastolic}，血氧 ${payload.spo2}%。查看趋势：${link}`;
}

function showSummary(payload) {
  lastSummaryText = buildSummaryText(payload);
  summaryText.textContent = lastSummaryText;
  summaryPanel.classList.remove('hidden');
}

async function copySummary() {
  if (!lastSummaryText) {
    showMessage('请先完成一次录入。', true);
    return;
  }

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(lastSummaryText);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = lastSummaryText;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    showMessage('摘要已复制。请切换到微信群，长按输入框粘贴发送。');
  } catch (error) {
    showMessage('复制失败，请长按摘要文字手动复制。', true);
  }
}

async function fetchEntries(range = 7) {
  const response = await fetch(apiUrl(`/api/entries?range=${range}`));
  if (response.status === 401) {
    const result = await response.json();
    throw new Error(result.error || '访问密钥无效');
  }
  const result = await response.json();
  return result.entries || [];
}

function buildDatasets(entries) {
  const sorted = [...entries].sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt) || (a.period === 'morning' ? -1 : 1));
  const labels = [];
  const heartData = [];
  const systolicData = [];
  const diastolicData = [];
  const spo2Data = [];

  sorted.forEach((item) => {
    labels.push(`${item.recordedAt} ${item.period === 'morning' ? '早' : '晚'}`);
    heartData.push(item.heartRate);
    systolicData.push(item.systolic);
    diastolicData.push(item.diastolic);
    spo2Data.push(item.spo2);
  });

  return { labels, heartData, systolicData, diastolicData, spo2Data };
}

function renderRecentList(entries) {
  if (!entries.length) {
    recentListEl.innerHTML = '<div class="recent-empty">暂无记录，请先完成今天的录入。</div>';
    return;
  }

  const sorted = [...entries].sort((a, b) => {
    const timeA = new Date(a.recordedAt).getTime();
    const timeB = new Date(b.recordedAt).getTime();
    if (timeA !== timeB) return timeB - timeA;
    return a.period === 'evening' ? -1 : 1;
  });

  recentListEl.innerHTML = sorted.slice(0, 14).map((item) => `
    <article class="recent-item">
      <div class="recent-item-title">${item.recordedAt} · ${periodLabel(item.period)}</div>
      <div class="recent-item-meta">心率 ${item.heartRate} 次/分 · 血压 ${item.systolic}/${item.diastolic} · 血氧 ${item.spo2}%</div>
    </article>
  `).join('');
}

function resetPeriodToggle() {
  periodInput.value = 'morning';
  periodButtons.forEach((btn) => {
    const isMorning = btn.dataset.period === 'morning';
    btn.classList.toggle('active', isMorning);
    btn.setAttribute('aria-pressed', isMorning ? 'true' : 'false');
  });
}

periodButtons.forEach((button) => {
  button.addEventListener('click', () => {
    periodButtons.forEach((btn) => {
      btn.classList.remove('active');
      btn.setAttribute('aria-pressed', 'false');
    });
    button.classList.add('active');
    button.setAttribute('aria-pressed', 'true');
    periodInput.value = button.dataset.period;
  });
});

function renderCharts(entries) {
  const { labels, heartData, systolicData, diastolicData, spo2Data } = buildDatasets(entries);

  const config = {
    type: 'line',
    data: {
      labels,
      datasets: [],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: CHART_TEXT, font: { size: 14, family: "'Noto Sans SC', sans-serif" } },
        },
      },
      scales: {
        x: {
          ticks: { color: CHART_TEXT, maxRotation: 45, minRotation: 0, font: { size: 12 } },
          grid: { color: CHART_GRID },
        },
        y: {
          ticks: { color: CHART_TEXT, font: { size: 12 } },
          grid: { color: CHART_GRID },
        },
      },
    },
  };

  if (heartRateChart) heartRateChart.destroy();
  heartRateChart = new Chart(heartRateCtx, {
    ...config,
    data: {
      labels,
      datasets: [{
        label: '心率 (次/分钟)',
        data: heartData,
        borderColor: COLOR_HEART,
        backgroundColor: 'rgba(14, 116, 144, 0.15)',
        fill: true,
        tension: 0.3,
      }],
    },
  });

  if (bloodPressureChart) bloodPressureChart.destroy();
  bloodPressureChart = new Chart(bloodPressureCtx, {
    ...config,
    data: {
      labels,
      datasets: [
        {
          label: '高压 (mmHg)',
          data: systolicData,
          borderColor: COLOR_SYSTOLIC,
          backgroundColor: 'rgba(8, 145, 178, 0.15)',
          tension: 0.3,
        },
        {
          label: '低压 (mmHg)',
          data: diastolicData,
          borderColor: COLOR_DIASTOLIC,
          backgroundColor: 'rgba(103, 232, 249, 0.2)',
          tension: 0.3,
        },
      ],
    },
  });

  if (spo2Chart) spo2Chart.destroy();
  spo2Chart = new Chart(spo2Ctx, {
    ...config,
    data: {
      labels,
      datasets: [{
        label: '血氧 (%)',
        data: spo2Data,
        borderColor: COLOR_SPO2,
        backgroundColor: 'rgba(5, 150, 105, 0.15)',
        tension: 0.3,
      }],
    },
  });
}

async function refreshData() {
  try {
    const entries = await fetchEntries(currentRange);
    renderRecentList(entries);
    if (chartsLoaded || toggleChartsBtn.getAttribute('aria-expanded') === 'true') {
      renderCharts(entries);
      chartsLoaded = true;
      if (toggleChartsBtn.getAttribute('aria-expanded') === 'true') {
        resizeCharts();
      }
    }
    return entries;
  } catch (error) {
    showMessage(error.message || '加载数据失败，请稍后重试。', true);
    throw error;
  }
}

function resizeCharts() {
  requestAnimationFrame(() => {
    if (heartRateChart) heartRateChart.resize();
    if (bloodPressureChart) bloodPressureChart.resize();
    if (spo2Chart) spo2Chart.resize();
  });
}

async function ensureChartsLoaded() {
  if (chartsLoaded) {
    return;
  }
  const entries = await fetchEntries(currentRange);
  renderRecentList(entries);
  renderCharts(entries);
  chartsLoaded = true;
}

toggleChartsBtn.addEventListener('click', async () => {
  const expanded = toggleChartsBtn.getAttribute('aria-expanded') === 'true';
  toggleChartsBtn.setAttribute('aria-expanded', expanded ? 'false' : 'true');
  chartsBody.classList.toggle('collapsed', expanded);
  if (!expanded) {
    await ensureChartsLoaded();
    resizeCharts();
  }
});

entryForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = {
    recordedAt: document.getElementById('recordedAt').value,
    period: document.getElementById('period').value,
    heartRate: document.getElementById('heartRate').value,
    systolic: document.getElementById('systolic').value,
    diastolic: document.getElementById('diastolic').value,
    spo2: document.getElementById('spo2').value,
  };

  try {
    const response = await fetch(apiUrl('/api/entries'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(familyKey ? { 'x-family-key': familyKey } : {}),
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (response.status === 401) {
      showMessage(result.error || '访问密钥无效，请使用家人分享的完整链接。', true);
      return;
    }
    if (result.success) {
      showMessage('录入成功。可点下方按钮复制摘要发到微信群。');
      showSummary(payload);
      entryForm.reset();
      recordedAtInput.value = defaultDate;
      resetPeriodToggle();
      chartsLoaded = false;
      await refreshData();
    } else {
      showMessage(result.error || '保存失败，请检查数据后重试。', true);
    }
  } catch (error) {
    showMessage('网络异常，请稍后再试。', true);
  }
});

rangeButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    rangeButtons.forEach((btn) => btn.classList.remove('active'));
    button.classList.add('active');
    currentRange = Number(button.dataset.range);
    chartsLoaded = false;
    await refreshData();
  });
});

copySummaryBtn.addEventListener('click', copySummary);

if (isWeChatBrowser()) {
  wechatTip.classList.remove('hidden');
}

refreshData().catch(() => {
  recentListEl.innerHTML = '<div class="recent-empty">暂时无法加载记录，请检查网络或访问链接。</div>';
});
