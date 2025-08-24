const app = getApp();

Page({
  data: {
    // 报告数据（仅从登录页获取）
    reports: [],
    filteredReports: [],
    isEmpty: false,
    loading: true,  // 仅用于初始加载状态
    
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

    // 接收登录页传递的报告数据（唯一数据来源）
    const eventChannel = this.getOpenerEventChannel();
    if (eventChannel) {
      eventChannel.on('acceptReports', (data) => {
        const reports = data.reports || [];
        this.processReports(reports);
      });
    } else {
      // 如果没有从登录页获取到数据，显示空状态
      this.setData({
        reports: [],
        loading: false,
        isEmpty: true
      });
      wx.showToast({ title: '未获取到报告数据', icon: 'none' });
    }
  },

  // 处理报告数据（仅来自登录页）
  processReports(reports) {
    // 过滤并处理有效报告地址
    const validReports = reports.filter(item => {
      if (!item.Url) return false;
      // 补全协议头
      if (!item.Url.startsWith('http://') && !item.Url.startsWith('https://')) {
        item.Url = 'https://' + item.Url;
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
      isEmpty: validReports.length === 0
    }, () => {
      this.applyFilters();
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
      const daysMap = {
        'week': 7,
        'month': 30,
        'quarter': 90,
        'year': 365
      };
      const startTime = new Date(now.getTime() - daysMap[timeFilter] * 24 * 60 * 60 * 1000);
      
      result = result.filter(item => {
        if (!item.Time) return false;
        return new Date(item.Time) >= startTime;
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

  // 搜索输入处理
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
    this.setData({ timeFilter: e.currentTarget.dataset.value });
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
    this.setData({ typeFilter: e.currentTarget.dataset.value });
  },

  confirmTypeFilter() {
    const baseTextMap = {
      'all': '类型筛选',
      'physical': '体检报告',
      'test': '检验报告',
      'imaging': '影像报告',
      'consultation': '会诊报告'
    };
    
    // 动态添加数据中的类型
    this.data.availableTypes.forEach(type => {
      if (!baseTextMap[type]) {
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
      // 处理地址确保正确性
      let processedUrl = url;
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

  // 返回登录页
  goBack() {
    wx.navigateBack({ delta: 1 });
  },

  // 页面卸载时清理
  onUnload() {
    // 移除可能的事件监听
    const eventChannel = this.getOpenerEventChannel();
    if (eventChannel) {
      eventChannel.off('acceptReports');
    }
  }
});
