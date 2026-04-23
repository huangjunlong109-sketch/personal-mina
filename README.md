# personal-mina

个人微信小程序 Monorepo

## 项目列表

| 目录 | 名称 | AppID |
|------|------|-------|
| apps/log-ledger | LoG记账 | wx845125f549ba80b4 |
| apps/log-fuel | LoG油耗 | wx363f64461a92eee2 |

## 目录结构

```
apps/
├── log-ledger/
│   ├── miniprogram/       # 前端代码（TypeScript）
│   ├── cloudfunctions/    # 云函数（Node.js）
│   └── project.config.json
└── log-fuel/
    ├── miniprogram/
    ├── cloudfunctions/
    └── project.config.json
```

## 开发

用微信开发者工具分别打开 `apps/log-ledger` 和 `apps/log-fuel` 目录即可。
