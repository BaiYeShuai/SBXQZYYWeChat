App({
  onLaunch() {
    // 初始化登录状态
    this.initLoginStatus();
    
    // 监听网络状态变化
    this.monitorNetworkStatus();
  },

  // 初始化登录状态
  initLoginStatus() {
    const loginInfo = wx.getStorageSync('loginInfo');
    if (loginInfo && loginInfo.expireTime && Date.now() < loginInfo.expireTime) {
      // 登录状态有效
      this.globalData.isLogin = true;
      this.globalData.loginInfo = loginInfo;
    } else {
      // 登录状态失效
      this.globalData.isLogin = false;
      this.globalData.loginInfo = null;
      wx.removeStorageSync('loginInfo');
    }
  },

  // 监听网络状态
  monitorNetworkStatus() {
    wx.onNetworkStatusChange(res => {
      this.globalData.networkConnected = res.isConnected;
      if (!res.isConnected) {
        wx.showToast({
          title: '网络已断开，请检查网络连接',
          icon: 'none',
          duration: 3000
        });
      }
    });
    
    // 初始检查
    wx.getNetworkType({
      success: (res) => {
        this.globalData.networkConnected = res.networkType !== 'none';
      }
    });
  },

  // 全局错误处理
  handleError(error, message = '操作失败，请重试') {
    console.error('全局错误捕获:', error);
    
    // 根据错误类型显示不同提示
    if (error.errMsg && error.errMsg.includes('network')) {
      message = '网络错误，请检查网络连接';
    } else if (error.statusCode === 401) {
      message = '登录已过期，请重新登录';
      // 清除登录状态
      this.globalData.isLogin = false;
      this.globalData.loginInfo = null;
      wx.removeStorageSync('loginInfo');
      // 跳转到登录页
      setTimeout(() => {
        wx.redirectTo({ url: '/pages/login/login' });
      }, 1000);
    } else if (error.statusCode === 500) {
      message = '服务器错误，请稍后再试';
    }
    
    wx.showToast({
      title: message,
      icon: 'none',
      duration: 3000
    });
    
    return {
      success: false,
      message,
      error
    };
  },

  globalData: {
    isLogin: false,
    loginInfo: null,
    baseApiUrl: 'http://localhost:10023/api', // 替换为你的API域名
    networkConnected: true,
    needRefreshReports: false // 标记是否需要刷新报告列表
  }
});
