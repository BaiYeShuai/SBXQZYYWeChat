const app = getApp();

Page({
  data: {
    // 报告数据
    reports: [],
    filteredReports: [],
    isEmpty: false,
    loading: true,
    refreshing: false,
    
    // 搜索和筛选
    searchKeyword: '',
    timeFilter: 'all',
    timeFilterText: '时间筛选',
    typeFilter: 'all',
    typeFilterText: '类型筛选',
    isFilterApplied: false,
    
    // 筛选弹窗状态
    showTimeFilterPopup: false,
    showTypeFilterPopup: false
  },

  onLoad() {
    // 检查登录状态
    if (!app.globalData.isLogin) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }

    // 接收初始报告数据
    const eventChannel = this.getOpenerEventChannel();
    eventChannel.on('acceptReports', (data) => {
      const reports = data.reports || [];
      this.processReports(reports);
    });

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
    wx.onAppShow(() => {
      if (app.globalData.needRefreshReports) {
        that.refreshReports();
        app.globalData.needRefreshReports = false;
      }
    });
  },

  // 处理报告数据
  processReports(reports) {
    // 过滤有效报告（带HTTP/HTTPS地址）
    const validReports = reports.filter(item => 
      item.Url && (item.Url.startsWith('http://') || item.Url.startsWith('https://'))
    );

    // 按时间排序（最新的在前）
    validReports.sort((a, b) => {
      return new Date(b.Time).getTime() - new Date(a.Time).getTime();
    });

    this.setData({
      reports: validReports,
      loading: false
    }, () => {
      // 应用筛选条件
      this.applyFilters();
    });
  },

  // 刷新报告列表
  refreshReports() {
    if (!app.globalData.networkConnected) {
      wx.showToast({ title: '网络未连接，无法刷新', icon: 'none' });
      if (this.data.refreshing) {
        wx.stopPullDownRefresh();
        this.setData({ refreshing: false });
      }
      return;
    }

    // 显示刷新状态
    this.setData({ 
      refreshing: true,
      loading: true 
    });

    // 从接口获取最新报告
    wx.request({
      url: `${app.globalData.baseApiUrl}/reports/latest`,
      method: 'GET',
      header: {
        'Authorization': `Bearer ${app.globalData.loginInfo.token}`
      },
      success: (res) => {
        if (res.data && res.data.Success) {
          this.processReports(res.data.Reports || []);
          wx.showToast({ title: '刷新成功', icon: 'none' });
        } else {
          app.handleError(res.data || {}, '刷新失败');
        }
      },
      fail: (err) => {
        app.handleError(err, '刷新失败');
      },
      complete: () => {
        this.setData({ 
          refreshing: false,
          loading: false 
        });
        wx.stopPullDownRefresh();
      }
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
        item.Name.toLowerCase().includes(keyword)
      );
    }

    // 时间筛选
    if (timeFilter !== 'all') {
      const now = new Date();
      let startTime;

      switch (timeFilter) {
        case 'week':
          startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'quarter':
          startTime = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          startTime = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
      }

      result = result.filter(item => {
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
      isEmpty: reports.length === 0,
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

  // 搜索确认
  onSearchConfirm() {
    this.applyFilters();
  },

  // 清除搜索
  clearSearch() {
    this.setData({ searchKeyword: '' }, () => {
      this.applyFilters();
    });
  },

  // 显示时间筛选
  showTimeFilter() {
    this.setData({ showTimeFilterPopup: true });
  },

  // 隐藏时间筛选
  hideTimeFilter() {
    this.setData({ showTimeFilterPopup: false });
  },

  // 选择时间筛选
  selectTimeFilter(e) {
    const value = e.currentTarget.dataset.value;
    this.setData({ timeFilter: value });
  },

  // 确认时间筛选
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

  // 显示类型筛选
  showTypeFilter() {
    this.setData({ showTypeFilterPopup: true });
  },

  // 隐藏类型筛选
  hideTypeFilter() {
    this.setData({ showTypeFilterPopup: false });
  },

  // 选择类型筛选
  selectTypeFilter(e) {
    const value = e.currentTarget.dataset.value;
    this.setData({ typeFilter: value });
  },

  // 确认类型筛选
  confirmTypeFilter() {
    const textMap = {
      'all': '类型筛选',
      'physical': '体检报告',
      'test': '检验报告',
      'imaging': '影像报告',
      'consultation': '会诊报告'
    };

    this.setData({
      typeFilterText: textMap[this.data.typeFilter],
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
    const { url, id } = e.currentTarget.dataset;
    if (!url) {
      wx.showToast({ title: '报告地址无效', icon: 'none' });
      return;
    }

    wx.navigateTo({
      url: `/pages/pdfViewer/pdfViewer?url=${encodeURIComponent(url)}&id=${id}`
    });
  },

  // 返回登录页重新查询
  goBack() {
    wx.navigateBack({ delta: 1 });
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.refreshReports();
  },

  // 页面卸载时移除事件监听
  onUnload() {
    wx.offAppShow();
  }
});
