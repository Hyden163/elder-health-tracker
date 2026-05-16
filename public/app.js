const entryForm = document.getElementById('entry-form');
const messageEl = document.getElementById('message');
const rangeButtons = document.querySelectorAll('.range-btn');
const recordedAtInput = document.getElementById('recordedAt');
const exportBtn = document.getElementById('export-btn');

const heartRateCtx = document.getElementById('heartRateChart').getContext('2d');
const bloodPressureCtx = document.getElementById('bloodPressureChart').getContext('2d');
const spo2Ctx = document.getElementById('spo2Chart').getContext('2d');

const defaultDate = new Date().toISOString().slice(0, 10);
recordedAtInput.value = defaultDate;

let currentRange = 7;
let heartRateChart;
let bloodPressureChart;
let spo2Chart;

async function fetchEntries(range = 7) {
  const response = await fetch(`/api/entries?range=${range}`);
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
  const mapByDate = {};

  sorted.forEach((item) => {
    const label = `${item.recordedAt} ${item.period === 'morning' ? '早' : '晚'}`;
    labels.push(label);
    heartData.push(item.heartRate);
    systolicData.push(item.systolic);
    diastolicData.push(item.diastolic);
    spo2Data.push(item.spo2);
    if (!mapByDate[item.recordedAt]) {
      mapByDate[item.recordedAt] = [];
    }
    mapByDate[item.recordedAt].push(item);
  });

  return { labels, heartData, systolicData, diastolicData, spo2Data, mapByDate };
}

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
          labels: { color: '#33415a' },
        },
      },
      scales: {
        x: {
          ticks: { color: '#4b607b' },
          grid: { color: 'rgba(90,150,255,0.12)' },
        },
        y: {
          ticks: { color: '#4b607b' },
          grid: { color: 'rgba(90,150,255,0.12)' },
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
        borderColor: '#5a96ff',
        backgroundColor: 'rgba(90,150,255,0.18)',
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
          borderColor: '#3974d3',
          backgroundColor: 'rgba(57,116,211,0.18)',
          tension: 0.3,
        },
        {
          label: '低压 (mmHg)',
          data: diastolicData,
          borderColor: '#82b1ff',
          backgroundColor: 'rgba(130,177,255,0.18)',
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
        borderColor: '#43b56b',
        backgroundColor: 'rgba(67,181,107,0.18)',
        tension: 0.3,
      }],
    },
  });
}

function escapeXml(value) {
  return value
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildXml(entries) {
  const rows = entries.map((item) => `  <entry>\n    <id>${escapeXml(item.id)}</id>\n    <recordedAt>${escapeXml(item.recordedAt)}</recordedAt>\n    <period>${escapeXml(item.period)}</period>\n    <heartRate>${escapeXml(item.heartRate)}</heartRate>\n    <systolic>${escapeXml(item.systolic)}</systolic>\n    <diastolic>${escapeXml(item.diastolic)}</diastolic>\n    <spo2>${escapeXml(item.spo2)}</spo2>\n    <createdAt>${escapeXml(item.createdAt)}</createdAt>\n  </entry>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<healthEntries>\n${rows}\n</healthEntries>`;
}

async function exportXml() {
  try {
    const response = await fetch(`/api/entries/xml?range=${currentRange}`);
    if (!response.ok) {
      throw new Error('导出失败');
    }
    const text = await response.text();
    const blob = new Blob([text], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `health-records-${currentRange}d.xml`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    messageEl.textContent = 'XML 已生成，请检查下载文件。';
  } catch (error) {
    messageEl.textContent = '导出 XML 失败，请稍后重试。';
  }
}

async function refreshCharts() {
  const entries = await fetchEntries(currentRange);
  renderCharts(entries);
}

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
    const response = await fetch('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (result.success) {
      messageEl.textContent = '录入成功，图表已更新。';
      entryForm.reset();
      recordedAtInput.value = defaultDate;
      refreshCharts();
    } else {
      messageEl.textContent = result.error || '保存失败，请检查数据后重试。';
    }
  } catch (error) {
    messageEl.textContent = '网络异常，请稍后再试。';
  }
});

rangeButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    rangeButtons.forEach((btn) => btn.classList.remove('active'));
    button.classList.add('active');
    currentRange = Number(button.dataset.range);
    await refreshCharts();
  });
});

exportBtn.addEventListener('click', exportXml);

refreshCharts();
