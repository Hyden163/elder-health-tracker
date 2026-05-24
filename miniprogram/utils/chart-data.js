function periodShort(period) {
  return period === 'morning' ? '早' : '晚';
}

function sortCardio(entries) {
  return [...entries].sort((a, b) => {
    const ta = new Date(a.recordedAt).getTime();
    const tb = new Date(b.recordedAt).getTime();
    if (ta !== tb) return ta - tb;
    return a.period === 'morning' ? -1 : 1;
  });
}

function sortGlucose(entries) {
  return [...entries].sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
}

function buildCardioCharts(entries) {
  const sorted = sortCardio(entries);
  const labels = sorted.map((item) => `${item.recordedAt} ${periodShort(item.period)}`);
  return {
    labels,
    heart: {
      title: '心率 (次/分)',
      series: [{ name: '心率', color: '#0E7490', data: sorted.map((i) => i.heartRate) }],
    },
    bloodPressure: {
      title: '血压 (mmHg)',
      series: [
        { name: '高压', color: '#0891B2', data: sorted.map((i) => i.systolic) },
        { name: '低压', color: '#67E8F9', data: sorted.map((i) => i.diastolic) },
      ],
    },
    spo2: {
      title: '血氧 (%)',
      series: [{ name: '血氧', color: '#059669', data: sorted.map((i) => i.spo2) }],
    },
  };
}

function buildGlucoseChart(entries) {
  const sorted = sortGlucose(entries);
  const labels = sorted.map((item) => item.recordedAt);
  const pick = (key) => sorted.map((item) => (item[key] === null || item[key] === undefined ? null : item[key]));
  return {
    labels,
    title: '血糖 (mmol/L)',
    series: [
      { name: '空腹', color: '#0E7490', data: pick('fasting') },
      { name: '早餐后', color: '#059669', data: pick('afterBreakfast') },
      { name: '午餐后', color: '#D97706', data: pick('afterLunch') },
      { name: '晚餐后', color: '#7C3AED', data: pick('afterDinner') },
    ],
  };
}

module.exports = {
  buildCardioCharts,
  buildGlucoseChart,
};
