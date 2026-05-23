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

const CHART_TEXT = '#475569';
const CHART_GRID = 'rgba(14, 116, 144, 0.12)';
const COLOR_FASTING = '#0E7490';
const COLOR_BREAKFAST = '#059669';
const COLOR_LUNCH = '#D97706';
const COLOR_DINNER = '#7C3AED';

const glucoseCtx = document.getElementById('glucoseChart').getContext('2d');

const defaultDate = new Date().toISOString().slice(0, 10);
recordedAtInput.value = defaultDate;

const familyKey = new URLSearchParams(window.location.search).get('key') || '';
let currentRange = 7;
let glucoseChart;
let chartsLoaded = false;
let lastSummaryText = '';

const GLUCOSE_FIELDS = [
  { key: 'fasting', label: '空腹' },
  { key: 'afterBreakfast', label: '早餐后' },
  { key: 'afterLunch', label: '午餐后' },
  { key: 'afterDinner', label: '晚餐后' },
];

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

function formatGlucose(value) {
  return value === null || value === undefined || value === '' ? '—' : `${value}`;
}

function showMessage(text, isError = false) {
  messageEl.textContent = text;
  messageEl.classList.toggle('error', isError);
}

function buildSummaryText(payload) {
  const link = window.location.href.split('#')[0];
  const parts = GLUCOSE_FIELDS
    .filter(({ key }) => payload[key] !== '' && payload[key] != null)
    .map(({ key, label }) => `${label} ${payload[key]}`);
  return `${payload.recordedAt} 血糖：${parts.join('，')} mmol/L。查看趋势：${link}`;
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
  const response = await fetch(apiUrl(`/api/glucose/entries?range=${range}`));
  if (response.status === 401) {
    const result = await response.json();
    throw new Error(result.error || '访问密钥无效');
  }
  const result = await response.json();
  return result.entries || [];
}

function buildDatasets(entries) {
  const sorted = [...entries].sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
  const labels = sorted.map((item) => item.recordedAt);
  return {
    labels,
    fasting: sorted.map((item) => item.fasting ?? null),
    afterBreakfast: sorted.map((item) => item.afterBreakfast ?? null),
    afterLunch: sorted.map((item) => item.afterLunch ?? null),
    afterDinner: sorted.map((item) => item.afterDinner ?? null),
  };
}

function glucoseSummaryLine(item) {
  return GLUCOSE_FIELDS
    .filter(({ key }) => item[key] != null)
    .map(({ key, label }) => `${label} ${item[key]}`)
    .join(' · ') || '暂无数值';
}

function renderRecentList(entries) {
  if (!entries.length) {
    recentListEl.innerHTML = '<div class="recent-empty">暂无记录，请先完成今天的录入。</div>';
    return;
  }

  const sorted = [...entries].sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));

  recentListEl.innerHTML = sorted.slice(0, 14).map((item) => `
    <article class="recent-item">
      <div class="recent-item-title">${item.recordedAt}</div>
      <div class="recent-item-meta">${glucoseSummaryLine(item)} mmol/L</div>
    </article>
  `).join('');
}

function renderCharts(entries) {
  const { labels, fasting, afterBreakfast, afterLunch, afterDinner } = buildDatasets(entries);

  const config = {
    type: 'line',
    options: {
      responsive: true,
      maintainAspectRatio: false,
      spanGaps: true,
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
          title: {
            display: true,
            text: 'mmol/L',
            color: CHART_TEXT,
            font: { size: 13, family: "'Noto Sans SC', sans-serif" },
          },
          ticks: { color: CHART_TEXT, font: { size: 12 } },
          grid: { color: CHART_GRID },
        },
      },
    },
  };

  if (glucoseChart) glucoseChart.destroy();
  glucoseChart = new Chart(glucoseCtx, {
    ...config,
    data: {
      labels,
      datasets: [
        {
          label: '空腹',
          data: fasting,
          borderColor: COLOR_FASTING,
          backgroundColor: 'rgba(14, 116, 144, 0.12)',
          tension: 0.3,
        },
        {
          label: '早餐后',
          data: afterBreakfast,
          borderColor: COLOR_BREAKFAST,
          backgroundColor: 'rgba(5, 150, 105, 0.12)',
          tension: 0.3,
        },
        {
          label: '午餐后',
          data: afterLunch,
          borderColor: COLOR_LUNCH,
          backgroundColor: 'rgba(217, 119, 6, 0.12)',
          tension: 0.3,
        },
        {
          label: '晚餐后',
          data: afterDinner,
          borderColor: COLOR_DINNER,
          backgroundColor: 'rgba(124, 58, 237, 0.12)',
          tension: 0.3,
        },
      ],
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
    if (glucoseChart) glucoseChart.resize();
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
    fasting: document.getElementById('fasting').value,
    afterBreakfast: document.getElementById('afterBreakfast').value,
    afterLunch: document.getElementById('afterLunch').value,
    afterDinner: document.getElementById('afterDinner').value,
  };

  const hasValue = GLUCOSE_FIELDS.some(({ key }) => payload[key] !== '');
  if (!hasValue) {
    showMessage('请至少填写一项血糖数值。', true);
    return;
  }

  try {
    const response = await fetch(apiUrl('/api/glucose/entries'), {
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
      showMessage(result.updated ? '已更新今日记录。可点下方按钮复制摘要发到微信群。' : '录入成功。可点下方按钮复制摘要发到微信群。');
      showSummary(payload);
      entryForm.reset();
      recordedAtInput.value = defaultDate;
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
