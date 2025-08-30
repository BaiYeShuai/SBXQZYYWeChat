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

    // 接收初始报告数据 - 加固版
    this.receiveReportData();

    // 监听全局刷新事件
    this.watchRefreshEvent();
  },

  // 接收报告数据的统一方法，增加多重保障
  receiveReportData() {
    // 方式1：尝试从eventChannel接收数据
    const eventChannel = this.getOpenerEventChannel();
    if (eventChannel) {
      eventChannel.on('acceptReports', (data) => {
        console.log('从eventChannel接收报告数据:', data);
        // 严格验证数据类型
        const validReports = this.validateArray(data?.reports);
        this.processReports(validReports);
      });
    } 
    // 方式2：降级从globalData接收临时数据
    else if (app.globalData.tempReports) {
      console.log('从globalData接收报告数据:', app.globalData.tempReports);
      const validReports = this.validateArray(app.globalData.tempReports);
      this.processReports(validReports);
      // 清空临时数据，避免重复使用
      app.globalData.tempReports = null;
    }
    // 方式3：如果都没有数据，尝试主动刷新
    else {
      console.log('未接收到初始报告数据，尝试主动刷新');
      this.refreshReports();
    }
  },

  // 核心工具函数：确保返回值一定是数组
  validateArray(data) {
    if (data === null || data === undefined) {
      console.warn('数据为null/undefined，已转为空数组');
      return [];
    }
    if (!Array.isArray(data)) {
      console.warn('数据不是数组，已转为空数组', data);
      return [];
    }
    return data;
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
    // 确保输入是数组
    if (!Array.isArray(reports)) {
      console.warn('处理报告数据时发现非数组数据，已自动修正');
      reports = [];
    }

    // 过滤有效报告（带HTTP/HTTPS地址）
    // 同时处理可能的字段名大小写问题
    const validReports = reports.filter(item => {
      // 确保item是对象
      if (!item || typeof item !== 'object') return false;
      
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
      this.handleRefreshComplete();
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
        'Authorization': `Bearer ${app.globalData.loginInfo?.token || ''}`
      },
      success: (res) => {
        if (res.data && res.data.Success) {
          const newReports = this.validateArray(res.data.Data);
          this.processReports(newReports);
          wx.showToast({ title: '刷新成功', icon: 'none' });
        } else {
          app.handleError(res.data || {}, '刷新失败');
          this.processReports([]);
        }
      },
      fail: (err) => {
        app.handleError(err, '刷新失败');
        this.processReports([]);
      },
      complete: () => {
        this.handleRefreshComplete();
      }
    });
  },

  handleRefreshComplete() {
    this.setData({ refreshing: false, loading: false });
    wx.stopPullDownRefresh();
  },

  // 应用筛选条件
  applyFilters() {
    const { reports, searchKeyword, timeFilter, typeFilter } = this.data;
    // 确保数据源是数组
    let result = [...this.validateArray(reports)];

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
      filteredReports: result, // result必然是数组
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

  // 返回登录页重新查询 - 核心修改：返回原登录页并清除登录状态
  goBack() {
    // 1. 清除登录状态
    app.globalData.isLogin = false;
    app.globalData.loginInfo = null;
    app.globalData.tempReports = null; // 清除临时报告数据
    wx.removeStorageSync('loginInfo'); // 清除本地存储
    
    // 2. 尝试返回之前的登录页面（页面栈中的上一页）
    wx.navigateBack({
      delta: 1, // 返回一层
      fail: () => {
        // 如果返回失败（登录页不在页面栈中），则重定向到登录页
        wx.redirectTo({ url: '/pages/login/login' });
      }
    });
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
