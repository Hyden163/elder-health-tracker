function niceMinMax(values) {
  const nums = values.filter((v) => v !== null && v !== undefined && Number.isFinite(Number(v))).map(Number);
  if (!nums.length) {
    return { min: 0, max: 100 };
  }
  let min = Math.min(...nums);
  let max = Math.max(...nums);
  if (min === max) {
    min -= 5;
    max += 5;
  } else {
    const pad = (max - min) * 0.1;
    min -= pad;
    max += pad;
  }
  return { min, max };
}

function drawLineChart(ctx, width, height, labels, series) {
  const padding = { top: 28, right: 16, bottom: 44, left: 44 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  if (!labels.length || !series.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px sans-serif';
    ctx.fillText('暂无数据', width / 2 - 28, height / 2);
    return;
  }

  const allValues = series.flatMap((s) => s.data);
  const { min, max } = niceMinMax(allValues);
  const range = max - min || 1;

  ctx.strokeStyle = 'rgba(14, 116, 144, 0.12)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = padding.top + (chartH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }

  ctx.fillStyle = '#64748b';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i += 1) {
    const val = max - (range * i) / 4;
    const y = padding.top + (chartH * i) / 4;
    ctx.fillText(String(Math.round(val)), padding.left - 6, y + 4);
  }

  const step = labels.length > 1 ? chartW / (labels.length - 1) : 0;
  const xAt = (index) => padding.left + step * index;

  series.forEach((s) => {
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    let started = false;
    s.data.forEach((val, index) => {
      if (val === null || val === undefined || !Number.isFinite(Number(val))) {
        started = false;
        return;
      }
      const x = xAt(index);
      const y = padding.top + chartH - ((Number(val) - min) / range) * chartH;
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    s.data.forEach((val, index) => {
      if (val === null || val === undefined || !Number.isFinite(Number(val))) return;
      const x = xAt(index);
      const y = padding.top + chartH - ((Number(val) - min) / range) * chartH;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  });

  ctx.fillStyle = '#64748b';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  const labelStep = labels.length > 6 ? Math.ceil(labels.length / 6) : 1;
  labels.forEach((label, index) => {
    if (index % labelStep !== 0 && index !== labels.length - 1) return;
    const x = xAt(index);
    const short = label.length > 8 ? `${label.slice(5)}` : label;
    ctx.save();
    ctx.translate(x, height - 8);
    ctx.rotate(-0.4);
    ctx.fillText(short, 0, 0);
    ctx.restore();
  });

  let legendX = padding.left;
  const legendY = 12;
  series.forEach((s) => {
    ctx.fillStyle = s.color;
    ctx.fillRect(legendX, legendY - 8, 12, 3);
    ctx.fillStyle = '#475569';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(s.name, legendX + 16, legendY);
    legendX += ctx.measureText(s.name).width + 36;
  });
}

module.exports = {
  drawLineChart,
};
