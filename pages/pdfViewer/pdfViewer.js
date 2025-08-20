const app = getApp();

Page({
  data: {
    // 基本状态
    loading: true,
    error: false,
    errorMsg: '',
    pdfUrl: '',
    reportId: '',
    
    // 在线预览相关
    viewMode: 'online', // 'online' 或 'download'
    webViewUrl: '',
    
    // 下载相关
    tempFilePath: '',
    downloadError: false,
    downloadErrorMsg: ''
  },

  onLoad(options) {
    // 检查登录状态
    if (!app.globalData.isLogin || !app.globalData.loginInfo?.token) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      setTimeout(() => {
        wx.redirectTo({ url: '/pages/login/login' });
      }, 1000);
      return;
    }

    // 获取PDF地址和报告ID
    const pdfUrl = decodeURIComponent(options.url || '');
    const reportId = options.id || '';
    
    if (!pdfUrl || !(pdfUrl.startsWith('http://') || pdfUrl.startsWith('https://'))) {
      this.setData({
        loading: false,
        error: true,
        errorMsg: '报告地址无效，请返回重新查询'
      });
      return;
    }

    this.setData({ 
      pdfUrl,
      reportId,
      // 创建在线预览URL（假设后端提供预览接口）
      webViewUrl: `${app.globalData.baseApiUrl}/preview?url=${encodeURIComponent(pdfUrl)}&token=${app.globalData.loginInfo.token}`
    });

    // 优先尝试在线预览
    this.loadOnlinePreview();
  },

  // 加载在线预览
  loadOnlinePreview() {
    this.setData({
      loading: true,
      error: false,
      errorMsg: ''
    });
  },

  // 切换查看模式
  switchViewMode() {
    if (this.data.viewMode === 'online') {
      this.switchToDownloadView();
    } else {
      this.switchToOnlineView();
    }
  },

  // 切换到在线预览
  switchToOnlineView() {
    this.setData({
      viewMode: 'online',
      loading: true,
      error: false,
      errorMsg: ''
    }, () => {
      this.loadOnlinePreview();
    });
  },

  // 切换到下载查看
  switchToDownloadView() {
    this.setData({
      viewMode: 'download',
      tempFilePath: '',
      downloadError: false,
      downloadErrorMsg: ''
    }, () => {
      this.downloadPdf();
    });
  },

  // 下载PDF文件
  downloadPdf() {
    if (!app.globalData.networkConnected) {
      this.setData({
        downloadError: true,
        downloadErrorMsg: '网络未连接，无法下载'
      });
      return;
    }

    const { pdfUrl } = this.data;
    const token = app.globalData.loginInfo.token;

    wx.downloadFile({
      url: pdfUrl,
      header: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/pdf'
      },
      timeout: 60000, // 60秒超时
      success: res => {
        if (res.statusCode === 200) {
          this.setData({ 
            tempFilePath: res.tempFilePath 
          }, () => {
            // 下载完成后自动打开
            this.openPdfFile(res.tempFilePath);
          });
        } else {
          this.setDownloadError(`下载失败 (${res.statusCode})`);
        }
      },
      fail: (err) => {
        console.error('PDF下载失败:', err);
        this.setDownloadError('网络错误，无法下载报告');
      }
    });
  },

  // 打开PDF文件
  openPdfFile(filePath) {
    wx.openDocument({
      filePath: filePath,
      fileType: 'pdf',
      showMenu: true, // 显示菜单，支持保存等操作
      success: () => {
        console.log('PDF打开成功');
      },
      fail: (err) => {
        console.error('PDF打开失败:', err);
        this.setDownloadError('无法打开报告文件，请重试');
      }
    });
  },

  // 设置下载错误状态
  setDownloadError(message) {
    this.setData({
      tempFilePath: '',
      downloadError: true,
      downloadErrorMsg: message
    });
  },

  // 重新加载报告
  reloadReport() {
    if (this.data.viewMode === 'online') {
      this.loadOnlinePreview();
    } else {
      this.setData({
        downloadError: false,
        downloadErrorMsg: ''
      }, () => {
        this.downloadPdf();
      });
    }
  },

  // WebView加载错误
  onWebViewError(e) {
    console.error('WebView加载错误:', e);
    this.setData({
      loading: false,
      error: true,
      errorMsg: '在线预览失败，请尝试下载查看'
    });
  },

  // WebView加载完成
  onWebViewLoad() {
    this.setData({ loading: false });
  },

  // 返回报告列表
  goBack() {
    wx.navigateBack();
  },

  // 显示操作菜单
  showMenu() {
    const { tempFilePath, pdfUrl } = this.data;
    const menuItems = [];

    // 如果已下载，添加保存选项
    if (tempFilePath) {
      menuItems.push('保存报告到手机');
    }

    // 添加分享选项
    menuItems.push('分享报告');

    wx.showActionSheet({
      itemList: menuItems,
      success: (res) => {
        if (res.tapIndex === 0) {
          if (tempFilePath) {
            this.savePdfToDisk(tempFilePath);
          } else {
            this.shareReport(pdfUrl);
          }
        } else if (res.tapIndex === 1) {
          this.shareReport(pdfUrl);
        }
      }
    });
  },

  // 保存PDF到本地
  savePdfToDisk(filePath) {
    wx.saveFileToDisk({
      filePath: filePath,
      success: () => {
        wx.showToast({ title: '保存成功', icon: 'none' });
      },
      fail: (err) => {
        console.error('保存失败:', err);
        wx.showToast({ title: '保存失败，请重试', icon: 'none' });
      }
    });
  },

  // 分享报告
  shareReport(url) {
    // 这里只是示例，实际分享需要后端支持生成分享链接
    wx.showModal({
      title: '分享报告',
      content: '报告链接已复制到剪贴板，可粘贴分享',
      showCancel: false
    });
    wx.setClipboardData({
      data: url
    });
  },

  // 页面卸载时清理临时文件
  onUnload() {
    const { tempFilePath } = this.data;
    if (tempFilePath) {
      wx.removeSavedFile({
        filePath: tempFilePath,
        fail: () => {} // 忽略清理失败
      });
    }
  }
});
