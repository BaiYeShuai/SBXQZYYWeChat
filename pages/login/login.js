const app = getApp();

Page({
  data: {
    // 表单数据
    idCard: '',        // 身份证号
    phoneNumber: '',   // 手机号
    verifyCode: '',    // 验证码
    
    // 按钮状态 - 初始设置为false
    canGetCode: false, // 是否可以获取验证码
    canLogin: false,   // 是否可以登录
    codeText: '获取验证码', // 验证码按钮文本
    isCodeLoading: false, // 获取验证码是否加载中
    
    // 错误提示
    errorTips: '',     // 错误提示信息
    
    // 加载状态
    isLoading: false   // 登录是否加载中
  },

  // 监听输入变化 - 确保每次输入都触发验证
  onInputChange(e) {
    const { field } = e.currentTarget.dataset;
    // 实时更新输入值
    this.setData({
      [field]: e.detail.value
    }, () => {
      // 输入完成后立即检查表单有效性
      this.checkFormValidity();
    });
  },

  // 检查表单有效性 - 修复核心验证逻辑
  checkFormValidity() {
    const { idCard, phoneNumber, verifyCode } = this.data;
    
    // 验证身份证号 (严格验证18位，最后一位可以是X/x)
    const isIdCardValid = /(^\d{18}$)|(^\d{17}(\d|X|x)$)/.test(idCard);
    
    // 验证手机号 (严格验证11位数字，以13-19开头)
    const isPhoneValid = /^1[3-9]\d{9}$/.test(phoneNumber);
    
    // 验证验证码 (严格验证6位数字)
    const isCodeValid = /^\d{6}$/.test(verifyCode);
    
    // 强制更新按钮状态 - 关键修复
    this.setData({
      canGetCode: isIdCardValid && isPhoneValid,
      canLogin: isIdCardValid && isPhoneValid && isCodeValid,
      errorTips: ''
    });
  },

  // 获取验证码
  getVerifyCode() {
    // 双重检查，防止意外点击
    if (!this.data.canGetCode || this.data.isCodeLoading) {
      return;
    }

    const { phoneNumber } = this.data;
    
    // 显示加载状态
    this.setData({ isCodeLoading: true, codeText: '发送中...' });
    
    // 调用后端获取验证码接口
    wx.request({
      url: `${app.globalData.baseApiUrl}/verification/sendcode`,
      method: 'POST',
      data: {
        PhoneNumber: phoneNumber  // 确保参数名正确
      },
      success: (res) => {
        if (res.data && res.data.Success) {
          wx.showToast({ title: '验证码已发送', icon: 'none' });
          this.startCountdown();  // 开始倒计时
        } else {
          this.setData({
            errorTips: res.data?.Message || '获取验证码失败，请重试',
            codeText: '获取验证码'
          });
        }
      },
      fail: (err) => {
        console.error('获取验证码失败:', err);
        this.setData({
          errorTips: '网络错误，获取验证码失败',
          codeText: '获取验证码'
        });
      },
      complete: () => {
        this.setData({ isCodeLoading: false });
      }
    });
  },

  // 倒计时功能
  startCountdown() {
    let countdown = 60;
    this.setData({ codeText: `${countdown}s后重新获取` });
    
    const timer = setInterval(() => {
      countdown--;
      if (countdown <= 0) {
        clearInterval(timer);
        this.setData({ 
          codeText: '获取验证码',
          // 倒计时结束后重新检查状态，确保按钮可用
          canGetCode: /(^\d{18}$)|(^\d{17}(\d|X|x)$)/.test(this.data.idCard) && 
                      /^1[3-9]\d{9}$/.test(this.data.phoneNumber)
        });
      } else {
        this.setData({ codeText: `${countdown}s后重新获取` });
      }
    }, 1000);
  },

  // 登录 - 恢复原始逻辑，从login接口获取报告数据
  login() {
    // 双重检查，防止意外点击
    if (!this.data.canLogin || this.data.isLoading) {
      return;
    }

    const { idCard, phoneNumber, verifyCode } = this.data;
    
    // 显示加载状态
    this.setData({ isLoading: true, errorTips: '' });
    wx.showLoading({ title: '登录中...', mask: true });
    
    // 调用登录接口 - 登录成功后直接返回报告数据
    wx.request({
      url: `${app.globalData.baseApiUrl}/verification/verify`,
      method: 'POST',
      data: {
        IdCard: idCard,
        PhoneNumber: phoneNumber,  // 确保参数名正确
        Code: verifyCode
      },
      success: (res) => {
        if (res.data && res.data.Success) {
          // 登录成功，保存登录信息和报告数据
          app.globalData.isLogin = true;
          app.globalData.loginInfo = res.data.Data;
          
          // 从登录接口返回数据中获取报告列表
          const reports = res.data.Reports || [];
          
          // 跳转到报告列表页并传递报告数据
          wx.hideLoading();
          this.setData({ isLoading: false });
          
          wx.navigateTo({
            url: '/pages/reportList/reportList',
            events: {},
            success: (res) => {
              res.eventChannel.emit('acceptReports', { reports });
            }
          });
        } else {
          wx.hideLoading();
          this.setData({
            errorTips: res.data?.Message || '登录失败，请检查信息',
            isLoading: false
          });
        }
      },
      // 找到登录失败的fail回调，修改为：
fail: (err) => {
  console.error('登录失败:', err);
  
  // 针对连接错误的具体提示
  let errorMsg = '网络错误，登录失败';
  if (err.errMsg.includes('ERR_CONNECTION_REFUSED')) {
    errorMsg = '无法连接到服务器，请检查网络或服务器地址';
  } else if (err.errMsg.includes('timeout')) {
    errorMsg = '连接超时，请稍后重试';
  } else if (err.errMsg.includes('network')) {
    errorMsg = '网络未连接，请检查网络设置';
  }
  
  wx.hideLoading();
  this.setData({
    errorTips: errorMsg,
    isLoading: false
  });
}
    });
  }
});
