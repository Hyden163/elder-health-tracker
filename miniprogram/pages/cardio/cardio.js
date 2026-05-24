const api = require('../../utils/api');
const { buildCardioCharts } = require('../../utils/chart-data');

const RANGE_OPTIONS = [
  { value: '7', label: '近7天' },
  { value: '30', label: '近30天' },
  { value: '90', label: '近90天' },
];

function todayString() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function periodLabel(period) {
  return period === 'morning' ? '早晨' : '晚上';
}

Page({
  data: {
    recordedAt: todayString(),
    period: 'morning',
    heartRate: '',
    systolic: '',
    diastolic: '',
    spo2: '',
    message: '',
    messageError: false,
    submitting: false,
    summaryText: '',
    records: [],
    loadingList: true,
    currentRange: '7',
    rangeOptions: RANGE_OPTIONS,
    chartsExpanded: false,
    chartLabels: [],
    heartChart: { title: '', series: [] },
    bpChart: { title: '', series: [] },
    spo2Chart: { title: '', series: [] },
  },

  onShow() {
    this.loadRecords();
  },

  onDateChange(e) {
    this.setData({ recordedAt: e.detail.value });
  },

  onPeriodTap(e) {
    this.setData({ period: e.currentTarget.dataset.period });
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [field]: e.detail.value });
  },

  onRangeTap(e) {
    this.setData({ currentRange: e.currentTarget.dataset.range });
    this.loadRecords();
  },

  onToggleCharts() {
    this.setData({ chartsExpanded: !this.data.chartsExpanded });
  },

  buildSummary(payload) {
    return `${payload.recordedAt} ${periodLabel(payload.period)}：心率 ${payload.heartRate}，血压 ${payload.systolic}/${payload.diastolic}，血氧 ${payload.spo2}%。（打开小程序「老人健康记录」可查看趋势）`;
  },

  applyCharts(entries) {
    const charts = buildCardioCharts(entries);
    this.setData({
      chartLabels: charts.labels,
      heartChart: charts.heart,
      bpChart: charts.bloodPressure,
      spo2Chart: charts.spo2,
    });
  },

  async loadRecords() {
    const { currentRange } = this.data;
    this.setData({ loadingList: true });
    try {
      const res = await api.getCardioEntries(currentRange);
      const entries = res.entries || [];
      const records = [...entries]
        .sort((a, b) => {
          const ta = new Date(a.recordedAt).getTime();
          const tb = new Date(b.recordedAt).getTime();
          if (ta !== tb) return tb - ta;
          return a.period === 'evening' ? -1 : 1;
        })
        .slice(0, 30)
        .map((item) => ({
          ...item,
          periodLabel: periodLabel(item.period),
        }));
      this.applyCharts(entries);
      this.setData({ records, loadingList: false, messageError: false });
    } catch (error) {
      this.setData({
        loadingList: false,
        message: error.message || '加载记录失败',
        messageError: true,
      });
    }
  },

  async onSubmit() {
    const { recordedAt, period, heartRate, systolic, diastolic, spo2 } = this.data;

    if (!recordedAt || !heartRate || !systolic || !diastolic || !spo2) {
      this.setData({ message: '请填写完整数据', messageError: true });
      return;
    }

    const payload = {
      recordedAt,
      period,
      heartRate: Number(heartRate),
      systolic: Number(systolic),
      diastolic: Number(diastolic),
      spo2: Number(spo2),
    };

    this.setData({ submitting: true, message: '', messageError: false });

    try {
      await api.postCardioEntry(payload);
      this.setData({
        submitting: false,
        summaryText: this.buildSummary(payload),
        message: '保存成功',
        messageError: false,
      });
      this.loadRecords();
    } catch (error) {
      this.setData({
        submitting: false,
        message: error.message || '保存失败',
        messageError: true,
      });
    }
  },

  onCopySummary() {
    const { summaryText } = this.data;
    if (!summaryText) return;
    wx.setClipboardData({
      data: summaryText,
      success: () => wx.showToast({ title: '已复制', icon: 'success' }),
    });
  },
});
