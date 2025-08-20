const app = getApp();

Page({
  data: {
    userInfo: {},
    loading: true,
    error: false,
    errorMsg: '',
    cacheSize: '计算中...',
    
    // 性别选择
    genderOptions: ['男', '女', '保密'],
    genderIndex: 0,
    currentDate: ''
  },

  onLoad() {
    // 初始化当前日期
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    this.setData({
      currentDate: `${year}-${month}-${day}`
    });

    // 加载用户信息
    this.loadUserInfo();
    
    // 计算缓存大小
    this.calculateCacheSize();
  },

  // 加载用户信息
  loadUserInfo() {
    const token = app.globalData.loginInfo?.token;
    if (!token) {
      this.setData({
        loading: false,
        error: true,
        errorMsg: '登录状态失效，请重新登录'
      });
      return;
    }

    this.setData({
      loading: true,
      error: false
    });

    wx.request({
      url: `${app.globalData.baseApiUrl}/user/info`,
      method: 'GET',
      header: {
        'Authorization': `Bearer ${token}`
      },
      success: (res) => {
        this.setData({ loading: false });
        
        if (res.data && res.data.Success) {
          const userInfo = res.data.UserInfo || {};
          // 设置性别索引
          let genderIndex = 0;
          if (userInfo.gender === '女') {
            genderIndex = 1;
          } else if (userInfo.gender === '保密') {
            genderIndex = 2;
          }
          
          this.setData({
            userInfo,
            genderIndex
          });
        } else {
          this.setData({
            error: true,
            errorMsg: res.data?.Msg || '获取用户信息失败'
          });
        }
      },
      fail: (err) => {
        console.error('获取用户信息失败:', err);
        this.setData({
          loading: false,
          error: true,
          errorMsg: '网络错误，无法获取用户信息'
        });
      }
    });
  },

  // 计算缓存大小
  calculateCacheSize() {
    wx.getStorageInfo({
      success: (res) => {
        // 转换为MB
        const size = (res.currentSize / 1024).toFixed(2);
        this.setData({
          cacheSize: `${size}MB`
        });
      },
      fail: () => {
        this.setData({
          cacheSize: '获取失败'
        });
      }
    });
  },

  // 格式化身份证号（隐藏中间部分）
  formatIdCard(idCard) {
    if (!idCard) return '未设置';
    return idCard.replace(/^(.{6})(?:\d+)(.{4})$/, '$1********$2');
  },

  // 格式化手机号（隐藏中间部分）
  formatPhone(phone) {
    if (!phone) return '未设置';
    return phone.replace(/^(\d{3})(?:\d+)(\d{4})$/, '$1****$2');
  },

  // 选择头像
  chooseAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        // 上传头像到服务器
        this.uploadAvatar(tempFilePath);
      }
    });
  },

  // 上传头像
  uploadAvatar(tempFilePath) {
    const token = app.globalData.loginInfo?.token;
    if (!token) return;

    wx.showLoading({ title: '上传中...' });

    wx.uploadFile({
      url: `${app.globalData.baseApiUrl}/user/avatar`,
      filePath: tempFilePath,
      name: 'avatar',
      header: {
        'Authorization': `Bearer ${token}`
      },
      success: (res) => {
        wx.hideLoading();
        const data = JSON.parse(res.data);
        if (data && data.Success) {
          // 更新本地头像
          const userInfo = {...this.data.userInfo};
          userInfo.avatarUrl = data.AvatarUrl;
          this.setData({ userInfo });
          wx.showToast({ title: '头像更新成功', icon: 'none' });
        } else {
          wx.showToast({ title: data?.Msg || '上传失败', icon: 'none' });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('上传头像失败:', err);
        wx.showToast({ title: '上传失败，请重试', icon: 'none' });
      }
    });
  },

  // 姓名改变
  onNameChange(e) {
    const userInfo = {...this.data.userInfo};
    userInfo.name = e.detail.value.trim();
    this.setData({ userInfo });
  },

  // 性别改变
  onGenderChange(e) {
    const genderIndex = e.detail.value;
    const userInfo = {...this.data.userInfo};
    userInfo.gender = this.data.genderOptions[genderIndex];
    this.setData({ 
      genderIndex,
      userInfo
    });
  },

  // 出生日期改变
  onBirthdayChange(e) {
    const userInfo = {...this.data.userInfo};
    userInfo.birthday = e.detail.value;
    this.setData({ userInfo });
  },

  // 邮箱改变
  onEmailChange(e) {
    const userInfo = {...this.data.userInfo};
    userInfo.email = e.detail.value.trim();
    this.setData({ userInfo });
  },

  // 保存用户信息
  saveUserInfo() {
    const { userInfo } = this.data;
    const token = app.globalData.loginInfo?.token;
    if (!token) return;

    // 简单验证
    if (!userInfo.name || userInfo.name.trim() === '') {
      wx.showToast({ title: '请输入姓名', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中...' });

    wx.request({
      url: `${app.globalData.baseApiUrl}/user/info`,
      method: 'PUT',
      header: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        name: userInfo.name,
        gender: userInfo.gender,
        birthday: userInfo.birthday,
        email: userInfo.email
      },
      success: (res) => {
        wx.hideLoading();
        
        if (res.data && res.data.Success) {
          wx.showToast({ title: '信息保存成功', icon: 'none' });
          // 更新全局用户信息
          app.globalData.userInfo = userInfo;
        } else {
          wx.showToast({ title: res.data?.Msg || '保存失败', icon: 'none' });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('保存用户信息失败:', err);
        wx.showToast({ title: '网络错误，保存失败', icon: 'none' });
      }
    });
  },

  // 前往修改手机号
  goToChangePhone() {
    wx.navigateTo({
      url: '/pages/changePhone/changePhone'
    });
  },

  // 清除缓存
  clearCache() {
    wx.showModal({
      title: '清除缓存',
      content: '确定要清除所有缓存数据吗？',
      confirmText: '清除',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '清除中...' });
          wx.clearStorage({
            success: () => {
              wx.hideLoading();
              wx.showToast({ title: '缓存清除成功', icon: 'none' });
              this.calculateCacheSize();
            },
            fail: () => {
              wx.hideLoading();
              wx.showToast({ title: '清除失败', icon: 'none' });
            }
          });
        }
      }
    });
  },

  // 显示关于信息
  showAbout() {
    wx.showModal({
      title: '关于我们',
      content: '医疗报告查询系统 v1.0.0\n\n提供便捷的体检报告查询服务',
      showCancel: false,
      confirmText: '确定'
    });
  },

  // 退出登录
  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出当前登录吗？',
      confirmText: '退出',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          // 清除登录状态
          app.globalData.isLogin = false;
          app.globalData.loginInfo = null;
          app.globalData.userInfo = null;
          wx.removeStorageSync('loginInfo');
          
          // 跳回登录页
          wx.redirectTo({ url: '/pages/login/login' });
        }
      }
    });
  },

  // 返回报告列表
  goBack() {
    wx.navigateBack();
  }
});
    