const app = getApp();

Page({
  data: {
    // 报告数据
    reports: [],
    filteredReports: [],
    isEmpty: false,
    loading: true,
    refreshing: false,
    error: false,
    errorMsg: '',
    
    // 搜索和筛选
    searchKeyword: '',
    timeFilter: 'all',
    timeFilterText: '时间筛选',
    typeFilter: 'all',
    typeFilterText: '类型筛选',
    isFilterApplied: false,
    
    // 筛选弹窗状态
    showTimeFilterPopup: false,
    showTypeFilterPopup: false,
    
    // 报告类型列表（从数据中提取）
    availableTypes: []
  },

  onLoad() {
    // 检查登录状态
    if (!app.globalData.isLogin) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }

    // 接收初始报告数据
    const eventChannel = this.getOpenerEventChannel();
    if (eventChannel) {
      eventChannel.on('acceptReports', (data) => {
        const reports = data.reports || [];
        this.processReports(reports);
      });
    } else {
      // 如果没有从登录页获取数据，主动加载
      this.refreshReports();
    }

    // 监听全局刷新事件
    this.watchRefreshEvent();
  },

  onShow() {
    // 如果需要刷新，重新加载数据
    if (app.globalData.needRefreshReports) {
      this.refreshReports();
      app.globalData.needRefreshReports = false;
    }
  },

  // 监听全局刷新事件
  watchRefreshEvent() {
    const that = this;
    this.appShowListener = () => {
      if (app.globalData.needRefreshReports) {
        that.refreshReports();
        app.globalData.needRefreshReports = false;
      }
    };
    wx.onAppShow(this.appShowListener);
  },

  // 处理报告数据
  processReports(reports) {
    // 过滤有效报告（带HTTP/HTTPS地址）
    const validReports = reports.filter(item => {
      if (!item.Url) return false;
      // 处理可能缺少协议的地址
      if (!item.Url.startsWith('http://') && !item.Url.startsWith('https://')) {
        item.Url = 'https://' + item.Url; // 自动补全协议
      }
      return true;
    });

    // 按时间排序（最新的在前）
    validReports.sort((a, b) => {
      return new Date(b.Time || '').getTime() - new Date(a.Time || '').getTime();
    });

    // 提取可用的报告类型（用于筛选）
    const availableTypes = [...new Set(validReports.map(item => item.Type).filter(Boolean))];

    this.setData({
      reports: validReports,
      availableTypes,
      loading: false,
      error: false
    }, () => {
      // 应用筛选条件
      this.applyFilters();
    });
  },

  // 刷新报告列表
  refreshReports() {
    if (!app.globalData.networkConnected) {
      wx.showToast({ title: '网络未连接，无法刷新', icon: 'none' });
      this.handleRefreshComplete();
      return;
    }

    // 显示刷新状态
    this.setData({ 
      refreshing: true,
      loading: true,
      error: false
    });

    // 直接使用wx.request调用API，不依赖request.js
    wx.request({
      url: `${app.globalData.baseApiUrl}/reports/latest`,
      method: 'GET',
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${app.globalData.loginInfo?.token || ''}`
      },
      timeout: 15000,
      success: (res) => {
        // 检查HTTP请求是否成功
        if (res.statusCode !== 200) {
          this.setErrorState(`请求失败，状态码: ${res.statusCode}`);
          return;
        }

        // 处理业务逻辑
        const responseData = res.data || {};
        if (responseData.Success) {
          this.processReports(responseData.Reports || []);
          wx.showToast({ title: '刷新成功', icon: 'none' });
        } else {
          this.setErrorState(responseData.Msg || '刷新失败');
        }
      },
      fail: (err) => {
        console.error('刷新报告失败:', err);
        this.setErrorState(err.errMsg || '网络错误，刷新失败');
      },
      complete: () => {
        this.handleRefreshComplete();
      }
    });
  },

  // 处理刷新完成
  handleRefreshComplete() {
    this.setData({ 
      refreshing: false,
      loading: false 
    });
    wx.stopPullDownRefresh();
  },

  // 设置错误状态
  setErrorState(message) {
    this.setData({
      error: true,
      errorMsg: message,
      loading: false,
      refreshing: false
    });
  },

  // 应用筛选条件
  applyFilters() {
    const { reports, searchKeyword, timeFilter, typeFilter } = this.data;
    let result = [...reports];

    // 搜索筛选
    if (searchKeyword) {
      const keyword = searchKeyword.toLowerCase();
      result = result.filter(item => 
        (item.Name || '').toLowerCase().includes(keyword)
      );
    }

    // 时间筛选
    if (timeFilter !== 'all') {
      const now = new Date();
      let startTime;
      const daysMap = {
        'week': 7,
        'month': 30,
        'quarter': 90,
        'year': 365
      };

      startTime = new Date(now.getTime() - daysMap[timeFilter] * 24 * 60 * 60 * 1000);
      result = result.filter(item => {
        if (!item.Time) return false;
        const reportTime = new Date(item.Time);
        return reportTime >= startTime;
      });
    }

    // 类型筛选
    if (typeFilter !== 'all') {
      result = result.filter(item => item.Type === typeFilter);
    }

    // 更新筛选状态
    const isFilterApplied = searchKeyword || timeFilter !== 'all' || typeFilter !== 'all';
    
    this.setData({
      filteredReports: result,
      isEmpty: result.length === 0 && reports.length > 0,
      isFilterApplied
    });
  },

  // 搜索输入
  onSearchInput(e) {
    const keyword = e.detail.value.trim();
    this.setData({ searchKeyword: keyword }, () => {
      this.applyFilters();
    });
  },

  // 清除搜索
  clearSearch() {
    this.setData({ searchKeyword: '' }, () => {
      this.applyFilters();
    });
  },

  // 时间筛选相关方法
  showTimeFilter() {
    this.setData({ showTimeFilterPopup: true });
  },

  hideTimeFilter() {
    this.setData({ showTimeFilterPopup: false });
  },

  selectTimeFilter(e) {
    const value = e.currentTarget.dataset.value;
    this.setData({ timeFilter: value });
  },

  confirmTimeFilter() {
    const textMap = {
      'all': '时间筛选',
      'week': '近一周',
      'month': '近一个月',
      'quarter': '近三个月',
      'year': '近一年'
    };

    this.setData({
      timeFilterText: textMap[this.data.timeFilter],
      showTimeFilterPopup: false
    }, () => {
      this.applyFilters();
    });
  },

  // 类型筛选相关方法
  showTypeFilter() {
    this.setData({ showTypeFilterPopup: true });
  },

  hideTypeFilter() {
    this.setData({ showTypeFilterPopup: false });
  },

  selectTypeFilter(e) {
    const value = e.currentTarget.dataset.value;
    this.setData({ typeFilter: value });
  },

  confirmTypeFilter() {
    // 构建动态类型文本映射（结合预设和实际数据）
    const baseTextMap = {
      'all': '类型筛选',
      'physical': '体检报告',
      'test': '检验报告',
      'imaging': '影像报告',
      'consultation': '会诊报告'
    };
    
    // 为数据中存在但未预设的类型创建映射
    this.data.availableTypes.forEach(type => {
      if (!baseTextMap[type]) {
        // 首字母大写作为默认显示文本
        baseTextMap[type] = type.charAt(0).toUpperCase() + type.slice(1);
      }
    });

    this.setData({
      typeFilterText: baseTextMap[this.data.typeFilter],
      showTypeFilterPopup: false
    }, () => {
      this.applyFilters();
    });
  },

  // 重置筛选条件
  resetFilters() {
    this.setData({
      searchKeyword: '',
      timeFilter: 'all',
      timeFilterText: '时间筛选',
      typeFilter: 'all',
      typeFilterText: '类型筛选'
    }, () => {
      this.applyFilters();
    });
  },

  // 查看报告详情
  viewReport(e) {
    const { url, id, name } = e.currentTarget.dataset;
    
    if (!url) {
      wx.showToast({ title: '报告地址无效', icon: 'none' });
      return;
    }

    try {
      // 处理地址编码，确保中文等特殊字符正确传递
      let processedUrl = url;
      // 确保地址有正确的协议
      if (!processedUrl.startsWith('http://') && !processedUrl.startsWith('https://')) {
        processedUrl = 'https://' + processedUrl;
      }
      
      const encodedUrl = encodeURIComponent(processedUrl);
      const encodedName = encodeURIComponent(name || '体检报告');
      
      wx.navigateTo({
        url: `/pages/pdfViewer/pdfViewer?url=${encodedUrl}&id=${id}&name=${encodedName}`,
        fail: (err) => {
          console.error('跳转PDF查看器失败:', err);
          wx.showToast({ title: '打开报告失败', icon: 'none' });
        }
      });
    } catch (e) {
      console.error('地址处理失败:', e);
      wx.showToast({ title: '报告地址格式错误', icon: 'none' });
    }
  },

  // 返回上一页
  goBack() {
    wx.navigateBack({ delta: 1 });
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.refreshReports();
  },

  // 重试加载
  retryLoad() {
    this.refreshReports();
  },

  // 页面卸载时清理
  onUnload() {
    if (this.appShowListener) {
      wx.offAppShow(this.appShowListener);
    }
  }
});
