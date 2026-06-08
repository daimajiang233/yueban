# 悦伴 开发文档

> 最后更新：2026-06-03 · 重构版本

---

## 1. 项目概述

微信小程序蓝牙遥控玩具应用。核心功能：蓝牙连接控制设备、模式切换、摇一摇震动控制、WebSocket 远程分享遥控。

**技术栈**：微信小程序 + TypeScript + SCSS + WebSocket + BLE

---

## 2. 架构总览

```
┌─────────────────────────────────────────────────┐
│                    app.ts                        │
│              globalData.userInfo                 │
│          (全局状态中枢，bleService 自动同步)        │
└────────────┬────────────────────────────────────┘
             │ onStatusChange 监听
┌────────────▼────────────────────────────────────┐
│              utils/ble-service.ts                │
│            (唯一蓝牙管理器 · 单例)                 │
│                                                  │
│  connect()       扫描+连接目标设备                 │
│  sendData()      写入 BLE 数据（自动确保连接）      │
│  ensureConnected()  返回 bool 表示是否已连接       │
│  disconnect()    主动断开 + 清理适配器             │
│  onStatusChange()  订阅状态变更                   │
│  isConnected     当前连接状态 getter               │
│                                                  │
│  内部机制：                                       │
│  ├── 心跳检测   每 3 秒检查连接状态                │
│  ├── 断线重连   断开后最多重连 1 次               │
│  ├── 直连优先   重连时先用已知 deviceId 直连       │
│  └── 扫描回退   直连失败则重新扫描                 │
└────────────┬────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────┐
│            utils/ble-helper.ts                   │
│              (薄封装，供页面使用)                   │
│                                                  │
│  sendBleHex(hex)    发送十六进制字符串             │
│  sendBleValue(num)  发送原始数值                  │
│  ensureBleConnected()  确保已连接                 │
│  isBleConnected()   获取连接状态                  │
└─────────────────────────────────────────────────┘
```

### 页面调用关系

```
pages/index/index.ts
  └── onShow -> bleService.connect() (首次自动连接)

components/navigation-header
  └── toggleScan -> bleService.connect() / bleService.disconnect()

components/navigation-btnList
  └── 点击 -> requireBle 为 true 且未连接时先连接再跳转；requireBle 为 false 直接跳转（如分享）

pages/my-Model/my-Model.ts
  └── 模式按钮 -> sendBleHex("0xF1"~"0xFA")
      开关键   -> sendBleHex("0xFB") / sendBleHex("0xFD")

pages/shake-page/shake-page.ts
  └── slider  -> sendBleValue(number)
      圆形按钮 -> sendBleValue() / sendBleHex("0xFC")

pages/share/share.ts
  └── WebSocket 房间 + sendBleHex()
```

---

## 3. 蓝牙服务 (ble-service.ts)

### 3.1 不变量

以下值**严禁修改**：

| 项目 | 值 | 用途 |
|------|-----|------|
| 目标设备名 | `YUE BAN` | 扫描时匹配的设备名称 |
| 服务 UUID | `0000AF30-0000-1000-8000-00805F9B34FB` | BLE 服务筛选 |
| 数据格式 | `ArrayBuffer(2)` + `DataView.setUint16(0, val, true)` | 2 字节小端序 |

### 3.2 连接流程

```
connect()
  |
  +-- 1. 已连接？ -> return true
  +-- 2. 正在连接？ -> return false（防重入）
  |
  +-- 3. _initAdapter()     打开蓝牙适配器
  +-- 4. _startDiscovery()  扫描设备 (filter: targetServiceUuid)
  +-- 5. _findDevice()      匹配设备名 "YUE BAN" (10s 超时)
  +-- 6. _createConn()      建立 BLE 连接 (10s 超时)
  +-- 7. _getServices()     获取主服务
  +-- 8. _getChars()        获取 notify + write 特征值
  +-- 9. _listenConnChange() 监听连接状态变化
  |
  +-- 10. _startHeartbeat()  启动心跳
```

### 3.3 心跳与重连

```
_startHeartbeat()
  |
  +-- setInterval(3000ms)
       +--- getConnectedBluetoothDevices(services: [targetServiceUuid])
       +--- 设备在线？ -> 标记 connected=true
       +--- 设备离线？ -> _stopHeartbeat() -> _tryReconnectOnce()

_tryReconnectOnce()
  |
  +-- 重连次数 >= MAX_RECONNECT(1)？ -> 放弃，提示手动连接
  |
  +-- Step 1: 关闭适配器 -> 重新初始化
  +-- Step 2: 用已知 deviceId 直连
  |   +--- 成功 -> done
  |   +--- 失败 -+
  +-- Step 3: 重新扫描 -> 发现 -> 连接
  |
  +-- 成功 -> _startHeartbeat() 恢复心跳
      失败 -> 放弃，提示手动连接
```

### 3.4 状态同步

bleService 内部状态变化时自动调用 `_syncGlobalData()`，写入 `app.globalData.userInfo`：

```typescript
// globalData.userInfo 字段
{
  name:           "YUE BAN"
  status:         boolean  // 连接状态
  isScanning:     boolean  // 兼容旧代码，同 isConnected
  isConnected:    boolean  // 是否已连接
  deviceId:       string   // BLE 设备 ID
  serviceId:      string   // 服务 UUID
  writeCharacteristicId: string
  notifyCharacteristicId: string
  modelInfo: {
    startPause: boolean         // 开启/暂停状态
    buttons:   boolean[10]      // 当前选中的模式按钮
  }
}
```

---

## 4. 连接策略

### 自动连接

| 场景 | 行为 |
|------|------|
| 打开小程序首次进入首页 | 自动连接一次（显示 loading） |
| 后续进入首页 | 不再自动连接 |
| 首页点击「我的模式」「摇一摇」「使用教程」 | 未连接时先连接（显示 loading），再跳转 |
| 首页点击「分享」 | 直接进入，不检查连接（加入房间不需要蓝牙） |
| 在我的模式中点击模式/开关按钮 | `sendData()` 内部自动触发连接（无感） |
| 在摇一摇中滑动滑块 / 点击按钮 | `sendData()` 内部自动触发连接（无感） |
| 在分享中创建房间（房主） | 先触发连接（无感），再创建 WS 房间 |
| 在分享中加入房间（被控端） | 不检查蓝牙，直接通过 WS 通信 |
| 在分享中点击触感/开关按钮（房主） | `sendData()` 内部自动触发连接（无感） |

### Loading 策略

| 页面 | 点击连接 | 心跳重连 | 自动连接 |
|------|:---:|:---:|:---:|
| 首页 (index) | ✅ 显示 loading | ✅ 显示 loading | ✅ 显示 loading |
| 我的模式 (my-Model) | ❌ 无感 | ❌ 无感 | N/A |
| 摇一摇 (shake-page) | ❌ 无感 | ❌ 无感 | N/A |
| 分享 (share) | ❌ 无感 | ❌ 无感 | N/A |

> 实现：`ble-service.ts` 通过 `getCurrentPages()` 动态检测当前可见页面是否为首页，仅首页显示 loading/Toast。

### 实现位置

- **首次自动连接**：`pages/index/index.ts` -> `onShow()` 检查 `hasAutoConnected` 标志
- **发送数据自动连接**：`utils/ble-service.ts` -> `sendData()` 内部调用 `connect()`
- **创建房间自动连接**：`pages/share/share.ts` -> `createRoom()` 前置 connect()

---

## 5. 蓝牙发送值定义

### 我的模式 (my-Model)

| 按钮 | 中文 | Hex 值 |
|------|------|--------|
| 按钮 0 | 温婉 | `0xF1` |
| 按钮 1 | 触感 | `0xF2` |
| 按钮 2 | 轻语 | `0xF3` |
| 按钮 3 | 宇宙 | `0xF4` |
| 按钮 4 | 星海 | `0xF5` |
| 按钮 5 | 季风 | `0xF6` |
| 按钮 6 | 震撼 | `0xF7` |
| 按钮 7 | 纵横 | `0xF8` |
| 按钮 8 | 微享 | `0xF9` |
| 按钮 9 | 银河 | `0xFA` |

| 操作 | Hex 值 |
|------|--------|
| 开启玩具 | `0xFB` |
| 暂停玩具 | `0xFD` |

这些值定义在 WXML 的 data-value 属性中，经组件 triggerEvent 传到页面逻辑。

### 摇一摇 (shake-page)

| 操作 | 值类型 |
|------|--------|
| slider 滑动 | 数字 (20-100)，调用 sendBleValue(number) |
| 停止 | 0xFC，调用 sendBleHex("0xFC") |

---

## 6. WebSocket 远程分享

### 连接信息

| 项目 | 值 |
|------|-----|
| URL | wss://wss.nick9995403432.com.cn |
| 协议 | JSON 文本帧 |

### 消息结构

```typescript
// 客户端 -> 服务器
{ type: "create" }                              // 创建房间
{ type: "join",   roomId: string }              // 加入房间
{ type: "data",   payload: RemotePayload }      // 发送遥控数据

// 服务器 -> 客户端
{ type: "roomCreated", roomId: string, message: string }
{ type: "joined",      roomId: string, message: string }
{ type: "userJoined",  message: string }
{ type: "userLeft",    message: string }
{ type: "data",        message: string, payload: RemotePayload }
{ type: "error",       message: string }

// RemotePayload 结构
{
  newButtons:   boolean[]       // 按钮选中状态
  value:        string | null   // 蓝牙 hex 值（房主发 null，被控端发实际值）
  startPause:   boolean         // 是否开启
  moduleStatus: boolean         // 是否模式切换（true=模式按钮，false=开关按钮）
}
```

### 房主 vs 被控端

```
房主 (creatStatus=true):
  ┌──────────┐     WS (value=null)     ┌──────────┐
  │  房主设备  │ ----------------------> │  被控端   │
  │  手机     │                         │  手机    │
  │          │ <--- WS (value=实际hex) --│          │
  │  发送 BLE │                         │  (不连BLE)│
  │  到玩具   │                         │          │
  └──────────┘                         └──────────┘

被控端 (creatStatus=false):
  - 从分享链接进入，携带 roomId
  - 不直接操作蓝牙，通过 WS 把指令发给房主
  - 房主收到后执行 BLE 写入
```

---

## 7. 目录结构

```
miniprogram/
├── app.ts                          # 入口，初始化 BLE 状态监听
├── app.json
├── app.scss
│
├── utils/
│   ├── ble-service.ts              # 唯一蓝牙管理器（单例）
│   ├── ble-helper.ts               # 页面用 BLE 辅助函数
│   ├── globalData.ts               # 全局类型定义
│   └── util.ts                     # 通用工具
│
├── components/
│   ├── navigation-header/          # Banner + 蓝牙连接/断开按钮
│   ├── navigation-btnList/         # 首页功能卡片（含门控）
│   ├── my-models/                  # 模式按钮子组件
│   ├── model-title/                # "本地/远程控制模式"标题
│   └── navigation-bar/             # 通用导航栏
│
├── pages/
│   ├── index/index                 # 首页（onShow 自动连接）
│   ├── my-Model/my-Model           # 我的模式（10 种模式选择）
│   ├── shake-page/shake-page       # 摇一摇（滑块震动）
│   ├── share/share                 # 分享遥控（WS 房间）
│   ├── instrutions/instrutions     # 使用教程（静态页）
│   ├── logo/index                  # 登录页
│   └── logs/logs                   # 日志页
```

---

## 8. 开发注意事项

### 添加新功能需要 BLE 时

1. 页面中引入 `import { sendBleHex } from "../../utils/ble-helper"`
2. 调用 `await sendBleHex("你的hex值")` 即可
3. 无需自己处理连接逻辑——sendData() 内部会自动确保连接

### 添加需要蓝牙的页面入口

在 `pages/index/index.wxml` 中给该入口的 `navigation-btnList` 设置 `requireBle="{{true}}"`（默认已是 true）。
若页面不需要蓝牙（如分享页——加入房间无需蓝牙），设置 `requireBle="{{false}}"`。

### BLE 数据格式

所有 BLE 写入统一为 2 字节小端序 (ArrayBuffer(2) + DataView.setUint16(0, val, true))。新增发送逻辑必须保持一致。

### 调试

- BLE 连接/断开/心跳日志通过 console.log 输出
- WebSocket 消息日志存储在页面的 logs[] 数组中
- 蓝牙适配器状态变化通过 bleService.onStatusChange() 订阅

### 恢复备份

如果重构出现问题，可以恢复完整备份：
D:\Dev\develop\yueban_code\悦伴web_backup

