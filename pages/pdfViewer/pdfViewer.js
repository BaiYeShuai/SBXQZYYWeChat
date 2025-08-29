const app = getApp();

Page({
  data: {
    // 状态管理
    loading: true,
    error: false,
    errorMsg: '',
    pdfUrl: '',
    reportId: '',
    tempFilePath: '', // 下载后的临时路径
    
    // 进度提示
    progress: 0,
    showProgress: false,
    
    // 预览模式 - 默认在线预览
    isOnlineViewing: true,
    timeoutTimer: null
  },

  onLoad(options) {
    // 登录检查
    if (!app.globalData.isLogin) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      setTimeout(() => wx.redirectTo({ url: '/pages/login/login' }), 1000);
      return;
    }

    try {
      const pdfUrl = decodeURIComponent(options.url || '');
      const reportId = options.id || '';
      
      if (!pdfUrl) throw new Error('报告地址为空');

      // 处理URL协议
      let validUrl = pdfUrl;
      if (!(validUrl.startsWith('http://') || validUrl.startsWith('https://'))) {
        validUrl = 'https://' + validUrl;
      }

      this.setData({ 
        pdfUrl: validUrl, 
        reportId,
        loading: false  // 加载完成，直接进入在线预览
      });
    } catch (err) {
      console.error('初始化失败:', err);
      this.setData({
        loading: false,
        error: true,
        errorMsg: '报告地址无效，请返回'
      });
    }
  },

  // 切换到在线预览
  switchToOnline() {
    this.setData({
      isOnlineViewing: true,
      error: false,
      loading: false
    });
  },

  // 切换到下载查看
  switchToDownload() {
    this.setData({
      isOnlineViewing: false,
      error: false
    });
  },

  // 重新加载在线预览
  reloadOnline() {
    this.setData({
      error: false,
      loading: true
    }, () => {
      // 简单延迟后重新加载web-view
      setTimeout(() => {
        this.setData({ loading: false });
      }, 500);
    });
  },

  // 开始下载
  startDownload() {
    this.setData({
      showProgress: true,
      progress: 0,
      error: false,
      tempFilePath: ''
    });

    const { pdfUrl } = this.data;
    const header = app.globalData.loginInfo?.token ? {
      'Authorization': `Bearer ${app.globalData.loginInfo.token}`
    } : {};

    // 开始下载（带认证信息）
    const downloadTask = wx.downloadFile({
      url: pdfUrl,
      header: header,
      timeout: 60000, // 延长超时到60秒
      success: (res) => {
        this.setData({ showProgress: false });
        
        if (res.statusCode === 200) {
          // 下载成功
          this.setData({ tempFilePath: res.tempFilePath });
          wx.showToast({ title: '下载完成', icon: 'success' });
        } else {
          this.handleError(`下载失败（状态码：${res.statusCode}）`);
        }
      },
      fail: (err) => {
        this.setData({ showProgress: false });
        console.error('下载失败:', err);
        
        // 详细错误分类
        if (err.errMsg.includes('timeout')) {
          this.handleError('下载超时，请检查网络后重试');
        } else if (err.errMsg.includes('fail')) {
          this.handleError('网络错误，无法连接到服务器');
        } else {
          this.handleError('下载失败，请稍后重试');
        }
      }
    });

    // 监听下载进度
    downloadTask.onProgressUpdate((res) => {
      this.setData({ progress: res.progress });
      // 超过30秒但有进度，延长等待时间
      if (res.progress > 0 && res.progress < 100) {
        this.extendTimeout();
      }
    });

    // 初始超时控制
    this.initTimeout();
  },

  // 重试下载
  retryDownload() {
    this.startDownload();
  },

  // 打开已下载的文件
  openDownloadedFile() {
    const { tempFilePath } = this.data;
    if (!tempFilePath) return;

    wx.openDocument({
      filePath: tempFilePath,
      fileType: 'pdf',
      showMenu: true, // 支持保存、分享等功能
      success: () => {
        console.log('PDF打开成功');
      },
      fail: (err) => {
        console.error('打开PDF失败:', err);
        this.handleError('无法打开报告，请尝试重新下载');
      }
    });
  },

  // WebView错误处理
  onWebViewError(e) {
    console.error('在线预览错误:', e.detail);
    this.setData({
      error: true,
      errorMsg: '在线预览失败，请尝试下载查看',
      loading: false
    });
  },

  // 初始化超时计时器
  initTimeout() {
    if (this.timeoutTimer) clearTimeout(this.timeoutTimer);
    
    this.timeoutTimer = setTimeout(() => {
      // 如果有进度则不超时，否则判定为超时
      if (this.data.progress === 0) {
        wx.showToast({ title: '下载缓慢，正在努力...', icon: 'none' });
        // 再延长30秒超时
        this.extendTimeout(30000);
      }
    }, 30000);
  },

  // 延长超时时间
  extendTimeout(ms = 30000) {
    if (this.timeoutTimer) clearTimeout(this.timeoutTimer);
    this.timeoutTimer = setTimeout(() => {
      this.handleError('下载超时，请重试');
    }, ms);
  },

  // 错误处理
  handleError(message) {
    if (this.timeoutTimer) clearTimeout(this.timeoutTimer);
    
    this.setData({
      loading: false,
      error: true,
      errorMsg: message,
      showProgress: false
    });
  },

  // 返回列表
  goBack() {
    if (this.timeoutTimer) clearTimeout(this.timeoutTimer);
    wx.navigateBack();
  },

  // 显示菜单
  showMenu() {
    const { pdfUrl, tempFilePath } = this.data;
    
    // 菜单选项
    const menuItems = [];
    
    // 添加在线预览选项（如果当前不是在线预览）
    if (!this.data.isOnlineViewing) {
      menuItems.push({
        itemList: ['切换到在线预览'],
        success: () => {
          this.switchToOnline();
        }
      });
    }
    
    // 添加下载选项（如果当前不是下载模式或未下载）
    if (this.data.isOnlineViewing || !tempFilePath) {
      menuItems.push({
        itemList: ['下载报告'],
        success: () => {
          this.switchToDownload();
          if (!tempFilePath) {
            this.startDownload();
          }
        }
      });
    } else {
      // 已下载，添加打开选项
      menuItems.push({
        itemList: ['打开已下载报告'],
        success: () => {
          this.openDownloadedFile();
        }
      });
    }
    
    // 显示菜单
    if (menuItems.length > 0) {
      wx.showActionSheet(menuItems[0]);
    }
  },

  // 页面卸载清理
  onUnload() {
    if (this.timeoutTimer) clearTimeout(this.timeoutTimer);
    // 清理临时文件
    if (this.data.tempFilePath) {
      wx.removeSavedFile({ filePath: this.data.tempFilePath, fail: () => {} });
    }
  }
});
