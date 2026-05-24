const config = require('../config');

const ADMIN_STORAGE_KEY = 'health_admin_key';

function withKey(path) {
  if (!config.familyAccessKey) {
    return path;
  }
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}key=${encodeURIComponent(config.familyAccessKey)}`;
}

function withAdminKey(path, adminPassword) {
  if (!adminPassword) {
    return path;
  }
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}key=${encodeURIComponent(adminPassword)}`;
}

function parseBody(data) {
  if (data === null || data === undefined || data === '') {
    return {};
  }
  if (typeof data === 'object') {
    return data;
  }
  try {
    return JSON.parse(data);
  } catch (error) {
    return { error: String(data), raw: String(data) };
  }
}

function callApi(path, method, data, options = {}) {
  if (!config.cloudEnv) {
    return Promise.reject(new Error('请先在 miniprogram/config.js 填写 cloudEnv（云托管环境 ID）'));
  }

  const adminPassword = options.adminPassword || '';
  let requestPath = withKey(path);
  if (adminPassword) {
    requestPath = withAdminKey(requestPath, adminPassword);
  }

  return new Promise((resolve, reject) => {
    const header = {
      'X-WX-SERVICE': config.serviceName,
      'content-type': 'application/json',
    };
    if (adminPassword) {
      header['x-admin-key'] = adminPassword;
    }

    const requestOptions = {
      config: { env: config.cloudEnv },
      path: requestPath,
      method,
      header,
      dataType: options.dataType || 'json',
    };

    if (data !== undefined && method !== 'GET') {
      requestOptions.data = data;
    }

    wx.cloud.callContainer({
      ...requestOptions,
      success(res) {
        if (options.dataType === 'text') {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(typeof res.data === 'string' ? res.data : String(res.data || ''));
            return;
          }
          const body = parseBody(res.data);
          reject(new Error(body.error || `请求失败 (${res.statusCode})`));
          return;
        }

        const body = parseBody(res.data);
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body);
          return;
        }
        reject(new Error(body.error || `请求失败 (${res.statusCode})`));
      },
      fail(err) {
        reject(new Error(err.errMsg || '网络请求失败'));
      },
    });
  });
}

function getStoredAdminPassword() {
  try {
    return wx.getStorageSync(ADMIN_STORAGE_KEY) || '';
  } catch (error) {
    return '';
  }
}

function setStoredAdminPassword(password) {
  wx.setStorageSync(ADMIN_STORAGE_KEY, password);
}

function clearStoredAdminPassword() {
  wx.removeStorageSync(ADMIN_STORAGE_KEY);
}

function getCardioEntries(range = '7') {
  return callApi(`/api/entries?range=${range}`, 'GET');
}

function postCardioEntry(payload) {
  return callApi('/api/entries', 'POST', payload);
}

function getGlucoseEntries(range = '7') {
  return callApi(`/api/glucose/entries?range=${range}`, 'GET');
}

function postGlucoseEntry(payload) {
  return callApi('/api/glucose/entries', 'POST', payload);
}

function adminLogin(password) {
  return callApi('/api/admin/login', 'POST', { password }).then((res) => {
    setStoredAdminPassword(password);
    return res;
  });
}

function adminChangePassword(adminPassword, payload) {
  return callApi('/api/admin/password', 'POST', payload, { adminPassword });
}

function adminGetEntries(type, range, adminPassword) {
  return callApi(`/api/admin/entries?type=${type}&range=${range}`, 'GET', undefined, { adminPassword });
}

function adminDeleteEntries(type, ids, adminPassword) {
  return callApi(`/api/admin/entries?type=${type}`, 'DELETE', { ids }, { adminPassword });
}

function adminExportCsv(type, range, adminPassword) {
  return callApi(`/api/admin/entries/export?type=${type}&range=${range}`, 'GET', undefined, {
    adminPassword,
    dataType: 'text',
  });
}

module.exports = {
  ADMIN_STORAGE_KEY,
  getStoredAdminPassword,
  setStoredAdminPassword,
  clearStoredAdminPassword,
  getCardioEntries,
  postCardioEntry,
  getGlucoseEntries,
  postGlucoseEntry,
  adminLogin,
  adminChangePassword,
  adminGetEntries,
  adminDeleteEntries,
  adminExportCsv,
};
