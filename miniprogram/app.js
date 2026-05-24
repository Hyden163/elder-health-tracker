const config = require('./config');

App({
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用基础库 2.2.3 及以上版本');
      return;
    }

    if (config.cloudEnv) {
      wx.cloud.init({
        env: config.cloudEnv,
        traceUser: true,
      });
    }
  },
});
