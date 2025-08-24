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
    showProgress: false
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

      this.setData({ pdfUrl: validUrl, reportId });
      
      // 直接进入"在线预览"流程（实际是下载后预览）
      this.startPreview();
    } catch (err) {
      console.error('初始化失败:', err);
      this.setData({
        loading: false,
        error: true,
        errorMsg: '报告地址无效，请返回'
      });
    }
  },

  // 核心逻辑：直接下载并预览，模拟在线查看
  startPreview() {
    this.setData({
      loading: true,
      error: false,
      showProgress: true,
      progress: 0
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
          // 下载成功后直接用微信内置能力打开
          this.openPdf(res.tempFilePath);
        } else {
          this.handleError(`加载失败（状态码：${res.statusCode}）`);
        }
      },
      fail: (err) => {
        this.setData({ showProgress: false });
        console.error('下载失败:', err);
        
        // 详细错误分类
        if (err.errMsg.includes('timeout')) {
          this.handleError('加载超时，请检查网络后重试');
        } else if (err.errMsg.includes('fail')) {
          this.handleError('网络错误，无法连接到服务器');
        } else {
          this.handleError('加载失败，请稍后重试');
        }
      }
    });

    // 监听下载进度，提升用户体验
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

  // 初始化超时计时器
  initTimeout() {
    this.timeoutTimer = setTimeout(() => {
      // 如果有进度则不超时，否则判定为超时
      if (this.data.progress === 0) {
        wx.showToast({ title: '加载缓慢，正在努力...', icon: 'none' });
        // 再延长30秒超时
        this.extendTimeout(30000);
      }
    }, 30000);
  },

  // 延长超时时间
  extendTimeout(ms = 30000) {
    if (this.timeoutTimer) clearTimeout(this.timeoutTimer);
    this.timeoutTimer = setTimeout(() => {
      this.handleError('加载超时，请重试');
    }, ms);
  },

  // 用微信内置能力打开PDF（稳定可靠）
  openPdf(filePath) {
    if (this.timeoutTimer) clearTimeout(this.timeoutTimer);
    
    this.setData({
      tempFilePath: filePath,
      loading: false
    });

    wx.openDocument({
      filePath: filePath,
      fileType: 'pdf',
      showMenu: true, // 支持保存、分享等功能
      success: () => {
        console.log('PDF打开成功');
      },
      fail: (err) => {
        console.error('打开PDF失败:', err);
        this.handleError('无法打开报告，请尝试重新加载');
      }
    });
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

  // 重新加载
  reloadReport() {
    this.startPreview();
  },

  // 返回列表
  goBack() {
    if (this.timeoutTimer) clearTimeout(this.timeoutTimer);
    wx.navigateBack();
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
