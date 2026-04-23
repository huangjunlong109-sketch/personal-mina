# LoG记账 - 数据库设计

> 使用微信云开发「云数据库」（类 MongoDB），不是关系型 SQL。
> 用户数据通过 `openid` 隔离，集合权限统一设置为「仅创建者可读写」，云函数操作时使用服务端 SDK（忽略权限）。

---

## 集合总览

| 集合名 | 说明 |
|--------|------|
| `ledger_records` | 记账记录 |
| `ledger_categories` | 分类配置（含系统默认 + 用户自定义）|
| `ledger_settings` | 用户设置 |

---

## 一、ledger_records（记账记录）

每条记录对应一笔收入或支出。

### 字段定义

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `_id` | string | 自动 | 云数据库自动生成 |
| `_openid` | string | 自动 | 云函数自动注入，用于数据隔离 |
| `type` | string | ✅ | `'expense'`（支出）/ `'income'`（收入）|
| `amount` | number | ✅ | 金额，单位为**分**（整数），例如 9800 = ¥98.00 |
| `category_id` | string | ✅ | 关联 `ledger_categories._id` |
| `category_name` | string | ✅ | 冗余存储分类名，防止分类删除后丢失展示 |
| `category_icon` | string | ✅ | 冗余存储图标标识 |
| `note` | string | ❌ | 备注，最长100字，默认空字符串 |
| `record_date` | string | ✅ | 记账日期，格式 `'YYYY-MM-DD'`，用于分组和统计 |
| `record_month` | string | ✅ | 账期月份，格式 `'YYYY-MM'`，**按账期起始日计算**，非自然月 |
| `created_at` | date | ✅ | 创建时间（`new Date()`）|
| `updated_at` | date | ✅ | 最后更新时间 |
| `is_deleted` | boolean | ✅ | 软删除标记，默认 `false` |

### 索引建议

```
{ _openid: 1, record_month: 1, is_deleted: 1 }   // 查询某月账单
{ _openid: 1, record_date: 1, is_deleted: 1 }     // 图表按天聚合
```

### 示例文档

```json
{
  "_id": "abc123",
  "_openid": "oXXXX_user_openid",
  "type": "expense",
  "amount": 9800,
  "category_id": "cat_builtin_food",
  "category_name": "餐饮",
  "category_icon": "icon-food",
  "note": "和朋友吃火锅",
  "record_date": "2026-03-24",
  "record_month": "2026-03",
  "created_at": "2026-03-24T09:30:00.000Z",
  "updated_at": "2026-03-24T09:30:00.000Z",
  "is_deleted": false
}
```

---

## 二、ledger_categories（分类配置）

存储系统内置分类和用户自定义分类，每个用户有自己的一份（初始化时从内置模板复制）。

### 字段定义

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `_id` | string | 自动 | 云数据库自动生成 |
| `_openid` | string | 自动 | 用户标识 |
| `type` | string | ✅ | `'expense'` / `'income'` |
| `name` | string | ✅ | 分类名称，最长10字 |
| `icon` | string | ✅ | 图标标识（映射前端图标组件）|
| `sort_order` | number | ✅ | 显示排序，越小越靠前 |
| `is_builtin` | boolean | ✅ | 是否为内置分类（内置分类不可删除）|
| `is_hidden` | boolean | ✅ | 是否在记账页隐藏，默认 `false` |
| `created_at` | date | ✅ | 创建时间 |
| `updated_at` | date | ✅ | 最后更新时间 |

### 说明

- 用户首次进入小程序时，云函数自动初始化一份内置分类到该用户名下（`is_builtin: true`）
- 用户新增自定义分类时，写入 `is_builtin: false` 的记录
- 用户隐藏分类时，更新 `is_hidden: true`，历史记录中该分类数据不受影响
- 用户删除自定义分类时，直接删除该文档（`is_builtin: false` 才允许删除）

### 内置分类种子数据（支出，部分示例）

| name | icon | sort_order |
|------|------|-----------|
| 餐饮 | icon-food | 1 |
| 住房 | icon-home | 2 |
| 汽车 | icon-car | 3 |
| 孩子 | icon-child | 4 |
| 娱乐 | icon-entertainment | 5 |
| 人情 | icon-gift | 6 |
| 运动 | icon-sport | 7 |
| 通讯 | icon-phone | 8 |
| 社交 | icon-social | 9 |
| 旅行 | icon-travel | 10 |
| 医疗 | icon-medical | 11 |
| 礼金 | icon-present | 12 |
| 办公 | icon-office | 13 |
| 主机 | icon-game | 14 |
| 家用 | icon-household | 15 |
| 露营 | icon-camping | 16 |
| 现金 | icon-cash | 17 |
| 交通 | icon-transport | 18 |
| 新年 | icon-newyear | 19 |

### 内置分类种子数据（收入）

| name | icon | sort_order |
|------|------|-----------|
| 工资 | icon-salary | 1 |
| 兼职 | icon-parttime | 2 |
| 理财 | icon-invest | 3 |
| 礼金 | icon-present | 4 |
| 其它 | icon-other | 5 |

---

## 三、ledger_settings（用户设置）

每个用户一条记录，存储个人偏好配置。

### 字段定义

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `_id` | string | 自动 | — | 云数据库自动生成 |
| `_openid` | string | 自动 | — | 用户标识 |
| `cycle_start_day` | number | ✅ | `1` | 每月账期起始日，范围 1-28 |
| `default_type` | string | ✅ | `'expense'` | 记账页默认选中支出还是收入 |
| `created_at` | date | ✅ | — | 创建时间 |
| `updated_at` | date | ✅ | — | 最后更新时间 |

### 账期计算逻辑

`cycle_start_day` 影响 `record_month` 的写入逻辑：

```javascript
/**
 * 根据记账日期和账期起始日，计算该记录归属的账期月份
 * @param {string} recordDate - 'YYYY-MM-DD'
 * @param {number} cycleStartDay - 1~28
 * @returns {string} - 'YYYY-MM'
 */
function calcRecordMonth(recordDate, cycleStartDay) {
  const date = new Date(recordDate);
  const day = date.getDate();
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12

  if (day >= cycleStartDay) {
    // 当日 >= 起始日，归属本自然月
    return `${year}-${String(month).padStart(2, '0')}`;
  } else {
    // 当日 < 起始日，归属上一个自然月
    const prevDate = new Date(year, month - 2, 1); // 上个月1日
    const prevYear = prevDate.getFullYear();
    const prevMonth = prevDate.getMonth() + 1;
    return `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
  }
}

// 示例：cycle_start_day = 25
// 2026-03-25 → '2026-03'（3月账期开始）
// 2026-04-01 → '2026-03'（还在3月账期内）
// 2026-04-25 → '2026-04'（4月账期开始）
```

---

## 四、云函数规划

| 云函数 | 职责 |
|--------|------|
| `record_save` | 新增/编辑记账记录，写入时计算 `record_month` |
| `record_list` | 查询某账期月份的记录列表 |
| `record_delete` | 软删除记录 |
| `category_init` | 首次登录时初始化内置分类 |
| `category_list` | 获取用户分类列表 |
| `category_save` | 新增/编辑/隐藏/排序分类 |
| `category_delete` | 删除自定义分类 |
| `settings_get` | 获取用户设置 |
| `settings_save` | 保存用户设置 |
| `stats_query` | 聚合统计（按周/月/年，按分类汇总）|
