const app = getApp();

Page({
  data: {
    // 表单数据
    idCard: '',        // 身份证号
    phoneNumber: '',   // 手机号
    verifyCode: '',    // 验证码
    
    // 按钮状态
    canGetCode: false, // 是否可以获取验证码
    canLogin: false,   // 是否可以登录
    codeText: '获取验证码', // 验证码按钮文本
    isCodeLoading: false, // 获取验证码是否加载中
    
    // 错误提示
    errorTips: '',     // 错误提示信息
    
    // 加载状态
    isLoading: false   // 登录是否加载中
  },

  // Base64解码函数，替代atob（兼容真机环境）
  base64Decode(str) {
    const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';
    let chr1, chr2, chr3;
    let enc1, enc2, enc3, enc4;
    let i = 0;

    // 清除非Base64字符
    str = str.replace(/[^A-Za-z0-9+/=]/g, '');

    while (i < str.length) {
      enc1 = base64Chars.indexOf(str.charAt(i++));
      enc2 = base64Chars.indexOf(str.charAt(i++));
      enc3 = base64Chars.indexOf(str.charAt(i++));
      enc4 = base64Chars.indexOf(str.charAt(i++));

      chr1 = (enc1 << 2) | (enc2 >> 4);
      chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      chr3 = ((enc3 & 3) << 6) | enc4;

      output = output + String.fromCharCode(chr1);

      if (enc3 !== 64) {
        output = output + String.fromCharCode(chr2);
      }
      if (enc4 !== 64) {
        output = output + String.fromCharCode(chr3);
      }
    }

    return output;
  },

  // 监听输入变化
  onInputChange(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({
      [field]: e.detail.value
    }, () => {
      this.checkFormValidity();
    });
  },

  // 检查表单有效性
  checkFormValidity() {
    const { idCard, phoneNumber, verifyCode } = this.data;
    
    // 验证身份证号 (严格验证18位，最后一位可以是X/x)
    const isIdCardValid = /(^\d{18}$)|(^\d{17}(\d|X|x)$)/.test(idCard);
    
    // 验证手机号 (严格验证11位数字，以13-19开头)
    const isPhoneValid = /^1[3-9]\d{9}$/.test(phoneNumber);
    
    // 验证验证码 (严格验证6位数字)
    const isCodeValid = /^\d{6}$/.test(verifyCode);
    
    // 更新按钮状态
    this.setData({
      canGetCode: isIdCardValid && isPhoneValid,
      canLogin: isIdCardValid && isPhoneValid && isCodeValid,
      errorTips: ''
    });
  },

  // 获取验证码
  getVerifyCode() {
    if (!this.data.canGetCode || this.data.isCodeLoading) {
      return;
    }

    const { phoneNumber } = this.data;
    
    this.setData({ isCodeLoading: true, codeText: '发送中...' });
    
    // 调用后端获取验证码接口（使用自定义的base64Decode替代atob）
    wx.request({
      url: `${this.base64Decode(app.globalData.baseApiUrl)}/verification/sendcode`,
      method: 'POST',
      data: {
        PhoneNumber: phoneNumber
      },
      success: (res) => {
        if (res.data && res.data.Success) {
          wx.showToast({ title: '验证码已发送', icon: 'none' });
          this.startCountdown();
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
          canGetCode: /(^\d{18}$)|(^\d{17}(\d|X|x)$)/.test(this.data.idCard) && 
                      /^1[3-9]\d{9}$/.test(this.data.phoneNumber)
        });
      } else {
        this.setData({ codeText: `${countdown}s后重新获取` });
      }
    }, 1000);
  },

  // 登录
  login() {
    if (!this.data.canLogin || this.data.isLoading) {
      return;
    }

    const { idCard, phoneNumber, verifyCode } = this.data;
    
    this.setData({ isLoading: true, errorTips: '' });
    wx.showLoading({ title: '登录中...', mask: true });
    
    // 调用登录接口（使用自定义的base64Decode替代atob）
    wx.request({
      url: `${this.base64Decode(app.globalData.baseApiUrl)}/verification/verify`,
      method: 'POST',
      data: {
        IdCard: idCard,
        PhoneNumber: phoneNumber,
        Code: verifyCode
      },
      success: (res) => {
        if (res.data && res.data.Success) {
          // 登录成功，保存登录信息
          app.globalData.isLogin = true;
          app.globalData.loginInfo = res.data.Data || {};
          
          // 获取报告列表
          const reports = res.data.Reports ? this.validateArray(res.data.Reports) : [];
          
          wx.hideLoading();
          this.setData({ isLoading: false });
          
          wx.navigateTo({
            url: '/pages/reportList/reportList',
            events: {},
            success: (navRes) => {
              if (navRes.eventChannel) {
                navRes.eventChannel.emit('acceptReports', { reports });
              } else {
                // 降级方案：使用globalData传递
                app.globalData.tempReports = reports;
              }
            },
            fail: (err) => {
              console.error('跳转报告列表失败:', err);
              wx.showToast({ title: '登录成功，但跳转失败', icon: 'none' });
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
      fail: (err) => {
        console.error('登录失败:', err);
        
        let errorMsg = '网络错误，登录失败';
        if (err.errMsg.includes('ERR_CONNECTION_REFUSED')) {
          errorMsg = '无法连接到服务器，请检查网络';
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
  },

  // 验证数组工具函数
  validateArray(data) {
    if (data === null || data === undefined) return [];
    return Array.isArray(data) ? data : [];
  }
});
