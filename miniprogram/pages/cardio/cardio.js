const api = require('../../utils/api');

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
  },

  onShow() {
    this.loadRecords();
  },

  onDateChange(e) {
    this.setData({ recordedAt: e.detail.value });
  },

  onPeriodTap(e) {
    this.setData({ period: e.detail.dataset.period });
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [field]: e.detail.value });
  },

  buildSummary(payload) {
    return `${payload.recordedAt} ${periodLabel(payload.period)}：心率 ${payload.heartRate}，血压 ${payload.systolic}/${payload.diastolic}，血氧 ${payload.spo2}%。（打开小程序「老人健康记录」可查看趋势）`;
  },

  async loadRecords() {
    this.setData({ loadingList: true });
    try {
      const res = await api.getCardioEntries('7');
      const records = (res.entries || []).slice(0, 20).map((item) => ({
        ...item,
        periodLabel: periodLabel(item.period),
      }));
      this.setData({ records, loadingList: false });
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
    if (!summaryText) {
      return;
    }
    wx.setClipboardData({
      data: summaryText,
      success: () => {
        wx.showToast({ title: '已复制', icon: 'success' });
      },
    });
  },
});
