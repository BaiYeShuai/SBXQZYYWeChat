// pages/pdfViewer/pdfViewer.js
const app = getApp();

Page({
  data: {
    pdfUrl: '',
    reportId: '',
    tempFilePath: '', // 临时文件路径
    error: false,
    errorMsg: ''
  },

  onLoad(options) {
    // 登录检查
    if (!app.globalData.isLogin) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      setTimeout(() => wx.redirectTo({ url: '/pages/login/login' }), 1000);
      return;
    }

    try {
      // 获取报告URL和ID
      const pdfUrl = decodeURIComponent(options.url || '');
      const reportId = options.id || '';
      
      if (!pdfUrl) throw new Error('报告地址无效');

      // 处理URL协议
      let validUrl = pdfUrl;
      if (!(validUrl.startsWith('http://') || validUrl.startsWith('https://'))) {
        validUrl = 'https://' + validUrl;
      }

      this.setData({ pdfUrl: validUrl, reportId });
      
      // 直接开始预览
      this.startDirectPreview();
    } catch (err) {
      console.error('初始化失败:', err);
      this.setData({
        error: true,
        errorMsg: err.message || '无法加载报告'
      });
    }
  },

  // 直接预览报告
  startDirectPreview() {
    const { pdfUrl } = this.data;
    
    // 设置请求头（如需要认证）
    const header = app.globalData.loginInfo?.token ? {
      'Authorization': `Bearer ${app.globalData.loginInfo.token}`
    } : {};

    // 显示加载提示
    wx.showLoading({
      title: '加载报告中...',
      mask: true
    });

    // 下载文件并预览
    const downloadTask = wx.downloadFile({
      url: pdfUrl,
      header: header,
      timeout: 60000,
      success: (res) => {
        wx.hideLoading();
        
        if (res.statusCode === 200) {
          // 保存临时文件路径
          this.setData({ tempFilePath: res.tempFilePath });
          
          // 打开文档预览
          this.openDocument(res.tempFilePath);
        } else {
          this.handleError(`加载失败（状态码：${res.statusCode}）`);
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('下载失败:', err);
        
        // 错误分类提示
        if (err.errMsg.includes('timeout')) {
          this.handleError('加载超时，请检查网络');
        } else if (err.errMsg.includes('fail')) {
          this.handleError('网络错误，无法连接到服务器');
        } else {
          this.handleError('加载失败，请稍后重试');
        }
      }
    });

    // 显示下载进度
    downloadTask.onProgressUpdate((res) => {
      if (res.progress > 0 && res.progress < 100) {
        wx.showLoading({
          title: `加载中...${res.progress}%`,
          mask: true
        });
      }
    });
  },

  // 打开文档
  openDocument(filePath) {
    wx.openDocument({
      filePath: filePath,
      fileType: 'pdf',
      showMenu: true,
      success: () => {
        console.log('文档打开成功');
        // 文档关闭后返回上一页
        setTimeout(() => {
          this.goBack();
        }, 500);
      },
      fail: (err) => {
        console.error('打开文档失败:', err);
        this.handleError('无法打开报告，请重试');
      }
    });
  },

  // 处理错误
  handleError(message) {
    this.setData({
      error: true,
      errorMsg: message
    });
  },

  // 重试预览
  retryPreview() {
    this.setData({ error: false, errorMsg: '' });
    this.startDirectPreview();
  },

  // 返回上一页
  goBack() {
    wx.navigateBack({
      delta: 1
    });
  },

  // 页面卸载时不需要处理临时文件，微信会自动清理
  onUnload() {
    // 移除临时文件清理代码，避免报错
    console.log('页面关闭，临时文件将由微信自动管理');
  }
});
    