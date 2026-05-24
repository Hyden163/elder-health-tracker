const api = require('../../utils/api');

function todayString() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function formatValue(value) {
  return value === null || value === undefined || value === '' ? '—' : value;
}

Page({
  data: {
    recordedAt: todayString(),
    fasting: '',
    afterBreakfast: '',
    afterLunch: '',
    afterDinner: '',
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

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [field]: e.detail.value });
  },

  buildSummary(payload) {
    return `${payload.recordedAt} 血糖：空腹 ${formatValue(payload.fasting)}，早餐后 ${formatValue(payload.afterBreakfast)}，午餐后 ${formatValue(payload.afterLunch)}，晚餐后 ${formatValue(payload.afterDinner)} mmol/L。（打开小程序「老人健康记录」可查看记录）`;
  },

  parseOptionalNumber(value) {
    if (value === '' || value === null || value === undefined) {
      return null;
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  },

  async loadRecords() {
    this.setData({ loadingList: true });
    try {
      const res = await api.getGlucoseEntries('7');
      const records = (res.entries || []).slice(0, 20).map((item) => ({
        ...item,
        fasting: formatValue(item.fasting),
        afterBreakfast: formatValue(item.afterBreakfast),
        afterLunch: formatValue(item.afterLunch),
        afterDinner: formatValue(item.afterDinner),
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
    const { recordedAt, fasting, afterBreakfast, afterLunch, afterDinner } = this.data;
    const values = {
      fasting: this.parseOptionalNumber(fasting),
      afterBreakfast: this.parseOptionalNumber(afterBreakfast),
      afterLunch: this.parseOptionalNumber(afterLunch),
      afterDinner: this.parseOptionalNumber(afterDinner),
    };

    if (!recordedAt || Object.values(values).every((v) => v === null)) {
      this.setData({ message: '请至少填写一项血糖数值', messageError: true });
      return;
    }

    const payload = { recordedAt, ...values };
    this.setData({ submitting: true, message: '', messageError: false });

    try {
      await api.postGlucoseEntry(payload);
      this.setData({
        submitting: false,
        summaryText: this.buildSummary({
          recordedAt,
          fasting: values.fasting ?? '—',
          afterBreakfast: values.afterBreakfast ?? '—',
          afterLunch: values.afterLunch ?? '—',
          afterDinner: values.afterDinner ?? '—',
        }),
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
