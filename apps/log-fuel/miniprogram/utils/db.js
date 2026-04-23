/**
 * 云函数调用封装
 * type: 操作类型；data: 额外参数（会被展开到 event 顶层）
 */
const callFn = (type, data = {}) =>
  wx.cloud.callFunction({
    name: 'quickstartFunctions',
    data: { type, ...data },
  }).then(res => res.result)
    .catch((err) => {
      if (err && err.errMsg && err.errMsg.includes('timeout')) {
        console.warn(`[cloud timeout] ${type}`, err)
      }
      throw err
    })

module.exports = { callFn }
