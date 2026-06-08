<div align="center">
  <h1>🎮 悦伴 · YUE BAN</h1>
  <p>微信小程序 · 蓝牙智能玩具遥控器</p>
</div>

---

## ✨ 功能

- **本地模式控制** —— 10 种预设模式（温婉、触感、轻语、宇宙、星海、季风、震撼、纵横、微享、银河），一键切换
- **摇一摇遥控** —— 实时震动强度滑块，手持操控
- **远程遥控** —— WebSocket 房间系统，一部手机创建房间，另一部加入，跨设备远程控制
- **蓝牙自动连接** —— 首次进入首页自动搜索连接 YUE BAN 设备
- **智能断线恢复** —— 断开后自动重连一次

## 🏗 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | 微信小程序 (WeChat Mini Program) |
| 语言 | TypeScript |
| 样式 | SCSS |
| 云服务 | 微信云开发 (CloudBase) |
| 蓝牙 | 微信 BLE API (`wx.writeBLECharacteristicValue` 等) |
| 远程通信 | WebSocket (`wss://wss.nick9995403432.com.cn`) |

## 📁 项目结构

```
悦伴web/
├── miniprogram/
│   ├── app.ts                   # 入口，全局状态初始化
│   ├── app.json                 # 页面路由 & 窗口配置
│   ├── pages/
│   │   ├── index/               # 首页 · 功能入口
│   │   ├── my-Model/            # 我的模式 · 本地模式控制
│   │   ├── shake-page/          # 摇一摇 · 震动强度控制
│   │   ├── share/               # 分享 · 远程遥控房间
│   │   ├── instrutions/         # 使用教程
│   │   └── logo/                # 启动页
│   ├── components/
│   │   ├── navigation-header/   # 顶部导航 · 蓝牙开关
│   │   ├── navigation-btnList/  # 功能入口卡片
│   │   └── ...                  # 其他 UI 组件
│   └── utils/
│       ├── ble-service.ts       # 蓝牙单例 · 连接/发送/心跳/重连
│       ├── ble-helper.ts        # 蓝牙便捷方法封装
│       ├── globalData.ts        # 全局类型定义
│       └── util.ts              # 通用工具
├── cloudfunctions/              # 云函数
├── tsconfig.json
├── project.config.json          # 小程序项目配置
└── README.md
```

## 🔌 蓝牙架构

```
所有页面/组件
    ↓
ble-helper.ts  (sendBleHex / sendBleValue / ensureBleConnected)
    ↓
ble-service.ts (唯一蓝牙入口 · 单例)
    ↓
wx.* BLE API  (微信蓝牙原生接口)
```

**核心设计原则：**
- `ble-service.ts` 是唯一的蓝牙管理入口，全项目不直接调用 `wx.BLE*`
- `sendData()` 未连接时自动触发 `connect()`
- 心跳 3 秒检测，断开后自动重连一次（最多 1 次）
- 连接状态通过 `onStatusChange` 回调广播，全局同步

## 🚀 快速开始

```bash
# 1. 克隆项目
git clone <your-repo-url>
cd 悦伴web

# 2. 安装依赖
npm install

# 3. 用微信开发者工具打开项目根目录
#    导入后填写你自己的 AppID

# 4. 编译运行
#    微信开发者工具 → 编译 → 预览/真机调试
```

## 📡 蓝牙协议

| 项目 | 值 |
|------|-----|
| 设备名称 | `YUE BAN` |
| 服务 UUID | `0000AF30-0000-1000-8000-00805F9B34FB` |
| 数据格式 | `ArrayBuffer(2)` · 2 字节小端序 |

**指令表：**

| 指令 | 十六进制 | 说明 |
|------|---------|------|
| 温婉 | `0xF1` | 模式 1 |
| 触感 | `0xF2` | 模式 2 |
| 轻语 | `0xF3` | 模式 3 |
| 宇宙 | `0xF4` | 模式 4 |
| 星海 | `0xF5` | 模式 5 |
| 季风 | `0xF6` | 模式 6 |
| 震撼 | `0xF7` | 模式 7 |
| 纵横 | `0xF8` | 模式 8 |
| 微享 | `0xF9` | 模式 9 |
| 银河 | `0xFA` | 模式 10 |
| 开启 | `0xFB` | 启动设备 |
| 暂停 | `0xFD` | 暂停设备 |
| 停止震动 | `0xFC` | 摇一摇停止 |

## 🧪 开发

详细的架构设计、重连策略、连接门控规则见 [DEVELOPMENT.md](./DEVELOPMENT.md)。

## 📄 License

MIT
