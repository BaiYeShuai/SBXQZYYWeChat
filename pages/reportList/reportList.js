// pages/reportList/reportList.js
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

  // 处理报告数据 - 修复可能的字段名不匹配问题
  processReports(reports) {
    // 过滤有效报告（带HTTP/HTTPS地址）
    // 同时处理可能的字段名大小写问题
    const validReports = reports.filter(item => {
      // 尝试多种可能的URL字段名
      const url = item.Url || item.url || item.reportUrl || '';
      return url && (url.startsWith('http://') || url.startsWith('https://'));
    }).map(item => {
      // 统一URL字段为Url，确保前端使用一致
      return {
        ...item,
        Url: item.Url || item.url || item.reportUrl || '',
        // 格式化日期显示
        Time: this.formatDate(item.Time || item.time)
      };
    });

    // 按时间排序（最新的在前）
    validReports.sort((a, b) => {
      return new Date(b.Time || b.time).getTime() - new Date(a.Time || a.time).getTime();
    });

    this.setData({
      reports: validReports,
      loading: false
    }, () => {
      // 应用筛选条件
      this.applyFilters();
    });
  },

  // 格式化日期
  formatDate(dateStr) {
    if (!dateStr) return '';
    
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    return `${year}-${month}-${day}`;
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
          this.processReports(res.data.Data || []);
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
        (item.Name || item.name || '').toLowerCase().includes(keyword) ||
        (item.Hospital || '').toLowerCase().includes(keyword)
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
        const reportTime = new Date(item.Time || item.time);
        return reportTime >= startTime;
      });
    }

    // 类型筛选
    if (typeFilter !== 'all') {
      result = result.filter(item => (item.Type || item.type) === typeFilter);
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

  // 查看报告详情 - 修复地址无效问题
  viewReport(e) {
    // 获取报告数据
    const { url, id } = e.currentTarget.dataset;
    
    // 增强的URL验证
    if (!url || !(url.startsWith('http://') || url.startsWith('https://'))) {
      wx.showToast({ 
        title: '报告地址无效', 
        icon: 'none',
        duration: 2000
      });
      console.error('无效的报告URL:', url);
      return;
    }

    try {
      // 确保URL正确编码
      const encodedUrl = encodeURIComponent(url);
      wx.navigateTo({
        url: `/pages/pdfViewer/pdfViewer?url=${encodedUrl}&id=${id}`
      });
    } catch (err) {
      console.error('URL编码失败:', err);
      wx.showToast({ 
        title: '处理报告地址失败', 
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 返回登录页重新查询
  goBack() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  // 退出登录
  logout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      confirmText: '退出',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          // 清除登录信息
          app.globalData.isLogin = false;
          app.globalData.loginInfo = null;
          wx.removeStorageSync('loginInfo');
          
          // 跳转到登录页
          wx.redirectTo({ url: '/pages/login/login' });
        }
      }
    });
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
