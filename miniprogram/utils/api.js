const config = require('../config');

function withKey(path) {
  if (!config.familyAccessKey) {
    return path;
  }
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}key=${encodeURIComponent(config.familyAccessKey)}`;
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
    return { error: String(data) };
  }
}

function callApi(path, method, data) {
  if (!config.cloudEnv) {
    return Promise.reject(new Error('请先在 miniprogram/config.js 填写 cloudEnv（云托管环境 ID）'));
  }

  return new Promise((resolve, reject) => {
    const options = {
      config: { env: config.cloudEnv },
      path: withKey(path),
      method,
      header: {
        'X-WX-SERVICE': config.serviceName,
        'content-type': 'application/json',
      },
    };

    if (data !== undefined && method !== 'GET') {
      options.data = data;
    }

    wx.cloud.callContainer({
      ...options,
      success(res) {
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

module.exports = {
  getCardioEntries,
  postCardioEntry,
  getGlucoseEntries,
  postGlucoseEntry,
};
