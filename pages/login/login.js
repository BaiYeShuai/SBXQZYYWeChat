const app = getApp();

Page({
  data: {
    // 表单数据
    IdCard: '',
    PhoneNumber: '',
    Code: '',
    
    // 验证码按钮状态
    countdown: 0,
    codeText: '获取验证码',
    codeDisabled: false,
    
    // 搜索按钮状态
    searchDisabled: true
  },

  onLoad() {
    // 检查登录状态，已登录则直接进入报告列表
    // if (app.globalData.isLogin) {
    //   wx.navigateTo({ url: '/pages/reportList/reportList' });
    // }
  },

  // 输入身份证号
  inputIdCard(e) {
    const value = e.detail.value.trim();
    this.setData({ IdCard: value });
    this.checkFormComplete();
  },

  // 输入手机号
  inputPhone(e) {
    const value = e.detail.value.trim();
    this.setData({ PhoneNumber: value });
    this.checkFormComplete();
  },

  // 输入验证码
  inputCode(e) {
    const value = e.detail.value.trim();
    this.setData({ Code: value });
    this.checkFormComplete();
  },

  // 检查表单是否填写完整
  checkFormComplete() {
    const { IdCard, PhoneNumber, Code } = this.data;
    const isComplete = IdCard && PhoneNumber && Code;
    this.setData({ searchDisabled: !isComplete });
  },

  // 验证身份证号格式
  validateIdCard(idCard) {
    const reg = /(^\d{18}$)|(^\d{17}(\d|X|x)$)/;
    return reg.test(idCard);
  },

  // 验证手机号格式
  validatePhone(phone) {
    const reg = /^1[3-9]\d{9}$/;
    return reg.test(phone);
  },

  // 获取验证码
  getCode() {
    const { IdCard, PhoneNumber, countdown } = this.data;
    
    // 倒计时中不允许重复点击
    if (countdown > 0) return;
    
    // 验证身份证号
    if (!this.validateIdCard(IdCard)) {
      wx.showToast({ title: '请输入正确的18位身份证号', icon: 'none' });
      return;
    }
    
    // 验证手机号
    if (!this.validatePhone(PhoneNumber)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
      return;
    }
    
    // 禁用按钮防止重复请求
    this.setData({ codeDisabled: true });
    
    // 发送验证码请求
    wx.request({
      url: `${app.globalData.baseApiUrl}/verification/sendcode`,
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: { IdCard, PhoneNumber },
      success: (res) => {
        if (res.data && res.data.Success) {
          wx.showToast({ title: res.data.Msg || '验证码发送成功', icon: 'none' });
          this.startCountdown();
        } else {
          wx.showToast({ title: res.data?.Msg || '发送失败，请重试', icon: 'none' });
        }
      },
      fail: (err) => {
        console.error('发送验证码失败:', err);
        wx.showToast({ title: '网络错误，请检查连接', icon: 'none' });
      },
      complete: () => {
        // 恢复按钮状态
        this.setData({ codeDisabled: false });
      }
    });
  },

  // 开始倒计时
  startCountdown() {
    let countdown = 60;
    this.setData({ countdown, codeText: `${countdown}s后重发` });
    
    const timer = setInterval(() => {
      countdown--;
      if (countdown <= 0) {
        clearInterval(timer);
        this.setData({ countdown: 0, codeText: '获取验证码' });
      } else {
        this.setData({ countdown, codeText: `${countdown}s后重发` });
      }
    }, 1000);
  },

  // 搜索报告（验证并查询）
  searchReport() {
    const { IdCard, PhoneNumber, Code } = this.data;
    
    // 再次验证表单
    if (!this.validateIdCard(IdCard)) {
      wx.showToast({ title: '请输入正确的身份证号', icon: 'none' });
      return;
    }
    
    if (!this.validatePhone(PhoneNumber)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
      return;
    }
    
    if (Code.length !== 6) {
      wx.showToast({ title: '请输入6位验证码', icon: 'none' });
      return;
    }
    
    // 显示加载中
    wx.showLoading({ title: '查询中...', mask: true });
    this.setData({ searchDisabled: true });
    
    // 调用验证接口
    wx.request({
      url: `${app.globalData.baseApiUrl}/verification/verify`,
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: { IdCard, PhoneNumber, Code },
      success: (res) => {
        wx.hideLoading();
        this.setData({ searchDisabled: false });
        
        if (res.data && res.data.Success) {
          // 保存登录状态（有效期7天）
          const expireTime = Date.now() + 7 * 24 * 60 * 60 * 1000;
          const loginInfo = {
            IdCard,
            PhoneNumber,
            token: res.data.Token,
            expireTime
          };
          
          wx.setStorageSync('loginInfo', loginInfo);
          app.globalData.isLogin = true;
          app.globalData.loginInfo = loginInfo;
          
          // 跳转到报告列表页，并携带报告数据
          wx.navigateTo({
            url: '/pages/reportList/reportList',
            success: (navRes) => {
              navRes.eventChannel.emit('acceptReports', {
                reports: res.data.Reports || []
              });
            }
          });
        } else {
          wx.showToast({ title: res.data?.Msg || '验证失败，请检查信息', icon: 'none' });
        }
      },
      fail: (err) => {
        console.error('验证接口请求失败:', err);
        wx.hideLoading();
        this.setData({ searchDisabled: false });
        wx.showToast({ title: '网络错误，查询失败', icon: 'none' });
      }
    });
  }
});
