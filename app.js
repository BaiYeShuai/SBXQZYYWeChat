// app.js
App({
  onLaunch() {
    // 初始化网络状态监听
    this.checkNetworkStatus();
    
    // 初始化存储
    this.initStorage();
    
    // 检查是否有登录信息
    this.checkLoginStatus();
  },

  globalData: {
    isLogin: false,
    loginInfo: null,
    baseApiUrl: 'http://120.46.192.145:806/api', // 替换为实际API地址
    networkConnected: true,
    needRefreshReports: false
  },

  // 检查网络状态
  checkNetworkStatus() {
    const that = this;
    wx.getNetworkType({
      success(res) {
        that.globalData.networkConnected = res.networkType !== 'none';
      }
    });

    wx.onNetworkStatusChange(function(res) {
      that.globalData.networkConnected = res.isConnected;
      if (!res.isConnected) {
        wx.showToast({
          title: '网络已断开',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  // 初始化本地存储
  initStorage() {
    if (!wx.getStorageSync('hasInit')) {
      wx.setStorageSync('loginHistory', []);
      wx.setStorageSync('hasInit', true);
    }
  },

  // 检查登录状态
  checkLoginStatus() {
    const loginInfo = wx.getStorageSync('loginInfo');
    if (loginInfo && loginInfo.token && this.isTokenValid(loginInfo.expireTime)) {
      this.globalData.isLogin = true;
      this.globalData.loginInfo = loginInfo;
    }
  },

  // 检查token是否有效
  isTokenValid(expireTime) {
    if (!expireTime) return false;
    return new Date().getTime() < new Date(expireTime).getTime();
  },

  // 处理错误信息
  handleError(error, defaultMsg) {
    console.error(error);
    let message = defaultMsg || '操作失败，请重试';
    
    if (typeof error === 'object') {
      if (error.errMsg) message = error.errMsg;
      if (error.Message) message = error.Message;
      if (error.statusCode === 401) {
        // 登录过期，需要重新登录
        message = '登录已过期，请重新登录';
        this.globalData.isLogin = false;
        this.globalData.loginInfo = null;
        wx.removeStorageSync('loginInfo');
        wx.navigateTo({ url: '/pages/login/login' });
      }
    }
    
    wx.showToast({
      title: message,
      icon: 'none',
      duration: 3000
    });
  }
});
