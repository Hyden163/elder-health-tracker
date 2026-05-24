const api = require('../../utils/api');

const RANGE_OPTIONS = [
  { value: '7', label: '近7天' },
  { value: '30', label: '近30天' },
  { value: '90', label: '近90天' },
  { value: 'all', label: '全部' },
];

function periodLabel(period) {
  return period === 'morning' ? '早晨' : '晚上';
}

function formatGlucose(value) {
  return value === null || value === undefined ? '—' : value;
}

function formatCreatedAt(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

Page({
  data: {
    loggedIn: false,
    password: '',
    adminPassword: '',
    dataType: 'cardio',
    currentRange: '90',
    rangeOptions: RANGE_OPTIONS,
    entries: [],
    selectedIds: [],
    selectedCount: 0,
    loading: false,
    loggingIn: false,
    message: '',
    messageError: false,
    showPasswordForm: false,
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  },

  onShow() {
    const stored = api.getStoredAdminPassword();
    if (stored) {
      this.setData({ loggedIn: true, adminPassword: stored });
      this.loadEntries();
    }
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },

  onPwdInput(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value });
  },

  async onLogin() {
    const { password } = this.data;
    if (!password) {
      this.setData({ message: '请输入密码', messageError: true });
      return;
    }
    this.setData({ loggingIn: true, message: '', messageError: false });
    try {
      await api.adminLogin(password);
      this.setData({
        loggingIn: false,
        loggedIn: true,
        adminPassword: password,
        password: '',
      });
      this.loadEntries();
    } catch (error) {
      this.setData({
        loggingIn: false,
        message: error.message || '登录失败',
        messageError: true,
      });
    }
  },

  onLogout() {
    api.clearStoredAdminPassword();
    this.setData({
      loggedIn: false,
      adminPassword: '',
      entries: [],
      selectedIds: [],
      selectedCount: 0,
    });
  },

  onTypeTap(e) {
    this.setData({ dataType: e.currentTarget.dataset.type, selectedIds: [], selectedCount: 0 });
    this.loadEntries();
  },

  onRangeTap(e) {
    this.setData({ currentRange: e.currentTarget.dataset.range, selectedIds: [], selectedCount: 0 });
    this.loadEntries();
  },

  onTogglePassword() {
    this.setData({ showPasswordForm: !this.data.showPasswordForm });
  },

  mapEntries(entries) {
    const { dataType } = this.data;
    const selectedSet = new Set(this.data.selectedIds.map(Number));
    if (dataType === 'glucose') {
      return entries.map((item) => ({
        ...item,
        checked: selectedSet.has(Number(item.id)),
        displayText: `${item.recordedAt} | 空腹 ${formatGlucose(item.fasting)} | 早餐后 ${formatGlucose(item.afterBreakfast)} | 午餐后 ${formatGlucose(item.afterLunch)} | 晚餐后 ${formatGlucose(item.afterDinner)} | ${formatCreatedAt(item.updatedAt || item.createdAt)}`,
      }));
    }
    return entries.map((item) => ({
      ...item,
      checked: selectedSet.has(Number(item.id)),
      displayText: `${item.recordedAt} ${periodLabel(item.period)} | 心率 ${item.heartRate} | 血压 ${item.systolic}/${item.diastolic} | 血氧 ${item.spo2}% | ${formatCreatedAt(item.createdAt)}`,
    }));
  },

  async loadEntries() {
    const { adminPassword, dataType, currentRange } = this.data;
    if (!adminPassword) return;
    this.setData({ loading: true, message: '', messageError: false });
    try {
      const res = await api.adminGetEntries(dataType, currentRange, adminPassword);
      this.setData({
        entries: this.mapEntries(res.entries || []),
        loading: false,
      });
    } catch (error) {
      this.setData({
        loading: false,
        message: error.message || '加载失败',
        messageError: true,
      });
      if ((error.message || '').includes('401') || (error.message || '').includes('密码')) {
        this.onLogout();
      }
    }
  },

  onSelectChange(e) {
    const selectedIds = (e.detail.value || []).map(Number);
    this.setData({
      selectedIds,
      selectedCount: selectedIds.length,
      entries: this.data.entries.map((item) => ({
        ...item,
        checked: selectedIds.includes(Number(item.id)),
      })),
    });
  },

  onDelete() {
    const { selectedIds, dataType, adminPassword } = this.data;
    if (!selectedIds.length) return;
    wx.showModal({
      title: '确认删除',
      content: `确定删除选中的 ${selectedIds.length} 条记录吗？`,
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await api.adminDeleteEntries(dataType, selectedIds, adminPassword);
          wx.showToast({ title: '已删除', icon: 'success' });
          this.setData({ selectedIds: [], selectedCount: 0 });
          this.loadEntries();
        } catch (error) {
          this.setData({ message: error.message || '删除失败', messageError: true });
        }
      },
    });
  },

  async onExport() {
    const { dataType, currentRange, adminPassword } = this.data;
    try {
      const csv = await api.adminExportCsv(dataType, currentRange, adminPassword);
      wx.setClipboardData({
        data: csv,
        success: () => wx.showToast({ title: 'CSV 已复制', icon: 'success' }),
      });
    } catch (error) {
      this.setData({ message: error.message || '导出失败', messageError: true });
    }
  },

  async onChangePassword() {
    const { adminPassword, oldPassword, newPassword, confirmPassword } = this.data;
    try {
      await api.adminChangePassword(adminPassword, { oldPassword, newPassword, confirmPassword });
      api.setStoredAdminPassword(newPassword);
      this.setData({
        adminPassword: newPassword,
        oldPassword: '',
        newPassword: '',
        confirmPassword: '',
        showPasswordForm: false,
        message: '密码已更新',
        messageError: false,
      });
      wx.showToast({ title: '密码已更新', icon: 'success' });
    } catch (error) {
      this.setData({ message: error.message || '修改失败', messageError: true });
    }
  },
});
