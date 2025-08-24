const app = getApp();

/**
 * 简化的请求函数，不进行加密解密处理
 */
function request(options) {
  // 显示加载提示
  if (options.showLoading !== false) {
    wx.showLoading({
      title: options.loadingText || '加载中...',
      mask: true
    });
  }

  // 处理请求数据（直接使用明文）
  const requestData = options.data || {};

  // 处理请求头
  const header = {
    'Content-Type': 'application/json',
    ...options.header
  };

  // 如果有token，添加到请求头
  if (app.globalData.loginInfo?.token) {
    header['Authorization'] = `Bearer ${app.globalData.loginInfo.token}`;
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: options.url,
      method: options.method || 'GET',
      data: requestData, // 直接传递明文数据
      header: header,
      timeout: options.timeout || 15000,
      success: (res) => {
        // 隐藏加载提示
        if (options.showLoading !== false) {
          wx.hideLoading();
        }

        // 处理业务错误
        if (res.data.Success !== undefined && !res.data.Success) {
          wx.showToast({
            title: res.data.Msg || '操作失败',
            icon: 'none'
          });
          reject(res.data);
          return;
        }

        resolve(res.data);
      },
      fail: (err) => {
        // 隐藏加载提示
        if (options.showLoading !== false) {
          wx.hideLoading();
        }

        console.error('请求失败:', err);
        wx.showToast({
          title: options.errorMsg || '网络错误，请重试',
          icon: 'none'
        });
        reject(err);
      }
    });
  });
}

// 封装常用请求方法
module.exports = {
  request,
  get: (url, data, options = {}) => {
    return request({ url, data, method: 'GET', ...options });
  },
  post: (url, data, options = {}) => {
    return request({ url, data, method: 'POST', ...options });
  },
  put: (url, data, options = {}) => {
    return request({ url, data, method: 'PUT', ...options });
  },
  delete: (url, data, options = {}) => {
    return request({ url, data, method: 'DELETE', ...options });
  }
};
