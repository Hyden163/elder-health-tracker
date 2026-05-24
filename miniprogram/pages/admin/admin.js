const api = require('../../utils/api');

const STORAGE_KEY = 'health_admin_password';

function periodLabel(period) {
  return period === 'morning' ? '早晨' : '晚上';
}

function formatGlucose(value) {
  return value === null || value === undefined || value === '' ? '—' : value;
}

Page({
  data: {
    loggedIn: false,
    password: '',
    loginPassword: '',
    message: '',
    messageError: false,
    currentType: 'cardio',
    currentRange: '7',
    records: [],
    selectedIds: [],
    loading: false,
    showPasswordForm: false,
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  },

  onShow() {
    const saved = wx.getStorageSync(STORAGE_KEY);
    if (saved) {
      this.setData({ loggedIn: true, password: saved });
      this.loadRecords();
    }
  },

  onLoginInput(e) {
    this.setData({ loginPassword: e.detail.value });
  },

  async onLogin() {
    const { loginPassword } = this.data;
    if (!loginPassword) {
      this.setData({ message: '请输入管理员密码', messageError: true });
      return;
    }
    this.setData({ loading: true, message: '' });
    try {
      await api.adminLogin(loginPassword);
      wx.setStorageSync(STORAGE_KEY, loginPassword);
      this.setData({
        loggedIn: true,
        password: loginPassword,
        loading: false,
        message: '登录成功',
        messageError: false,
      });
      this.loadRecords();
    } catch (error) {
      this.setData({
        loading: false,
        message: error.message || '登录失败',
        messageError: true,
      });
    }
  },

  onLogout() {
    wx.removeStorageSync(STORAGE_KEY);
    this.setData({
      loggedIn: false,
      password: '',
      loginPassword: '',
      records: [],
      selectedIds: [],
    });
  },

  onTypeTap(e) {
    this.setData({ currentType: e.currentTarget.dataset.type, selectedIds: [] });
    this.loadRecords();
  },

  onRangeTap(e) {
    this.setData({ currentRange: e.currentTarget.dataset.range, selectedIds: [] });
    this.loadRecords();
  },

  onToggleSelect(e) {
    const id = Number(e.currentTarget.dataset.id);
    const selected = new Set(this.data.selectedIds);
    if (selected.has(id)) {
      selected.delete(id);
    } else {
      selected.add(id);
    }
    const selectedIds = [...selected];
    const records = this.data.records.map((item) => ({
      ...item,
      selected: selectedIds.includes(item.id),
    }));
    this.setData({ selectedIds, records });
  },

  formatRecord(item, type) {
    if (type === 'glucose') {
      return `${item.recordedAt}：空腹 ${formatGlucose(item.fasting)}，早餐后 ${formatGlucose(item.afterBreakfast)}，午餐后 ${formatGlucose(item.afterLunch)}，晚餐后 ${formatGlucose(item.afterDinner)}`;
    }
    return `${item.recordedAt} ${periodLabel(item.period)}：心率 ${item.heartRate}，血压 ${item.systolic}/${item.diastolic}，血氧 ${item.spo2}%`;
  },

  async loadRecords() {
    const { password, currentType, currentRange, loggedIn } = this.data;
    if (!loggedIn) {
      return;
    }
    this.setData({ loading: true });
    try {
      const res = await api.getAdminEntries(currentType, currentRange, password);
      const records = (res.entries || []).map((item) => ({
        ...item,
        label: this.formatRecord(item, currentType),
        selected: false,
      }));
      this.setData({ records, loading: false, selectedIds: [] });
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

  async onDelete() {
    const { selectedIds, password, currentType } = this.data;
    if (!selectedIds.length) {
      return;
    }
    const confirmed = await new Promise((resolve) => {
      wx.showModal({
        title: '确认删除',
        content: `确定删除选中的 ${selectedIds.length} 条记录吗？`,
        success: (res) => resolve(res.confirm),
      });
    });
    if (!confirmed) {
      return;
    }
    this.setData({ loading: true });
    try {
      await api.deleteAdminEntries(currentType, selectedIds, password);
      this.setData({ message: '删除成功', messageError: false });
      this.loadRecords();
    } catch (error) {
      this.setData({
        loading: false,
        message: error.message || '删除失败',
        messageError: true,
      });
    }
  },

  togglePasswordForm() {
    this.setData({ showPasswordForm: !this.data.showPasswordForm });
  },

  onPasswordInput(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value });
  },

  async onChangePassword() {
    const { oldPassword, newPassword, confirmPassword } = this.data;
    if (!oldPassword || !newPassword || !confirmPassword) {
      this.setData({ message: '请填写完整密码信息', messageError: true });
      return;
    }
    this.setData({ loading: true });
    try {
      await api.changeAdminPassword(oldPassword, newPassword, confirmPassword);
      wx.setStorageSync(STORAGE_KEY, newPassword);
      this.setData({
        password: newPassword,
        loading: false,
        showPasswordForm: false,
        oldPassword: '',
        newPassword: '',
        confirmPassword: '',
        message: '密码已修改',
        messageError: false,
      });
    } catch (error) {
      this.setData({
        loading: false,
        message: error.message || '修改失败',
        messageError: true,
      });
    }
  },
});
