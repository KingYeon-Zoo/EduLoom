# SSE Streaming Migration & Performance Fix

> **日期**: 2026-06-23
> **分支**: `feature/chinese-localization`
> **作者**: Leslie

## 概述

本次改动解决了两个核心问题：

1. **页面卡顿/冻结**：侧边栏默认预取行为 + 激进轮询 + 低 `staleTime` + 多重试叠加，导致进入 AI 问答页面时洪水式级联请求，阻塞 Next.js 服务器。
2. **架构不一致**：Notebook Chat 使用同步阻塞 POST（用户干等数十秒），文件处理状态使用轮询（99% 的请求是浪费），而 Source Chat 和 Ask 已有 SSE 流式基础设施。

## 改动文件

| 文件 | 行数变化 | 说明 |
|------|----------|------|
| `api/routers/chat.py` | +153 | 新增 SSE 流式端点 + 修复事件循环阻塞 |
| `api/routers/sources.py` | +85 | 新增 SSE 状态流端点 |
| `frontend/src/lib/api/chat.ts` | +66 | 新增 `sendMessageStream()` SSE 解析函数 |
| `frontend/src/lib/hooks/useNotebookChat.ts` | +85 | `sendMessage` 改为 SSE 流式消费 |
| `frontend/src/lib/hooks/use-sources.ts` | +141 | 新增 `useSourceStatusStream` SSE hook |
| `frontend/src/components/sources/SourceCard.tsx` | +12 | SSE 优先 + 轮询兜底双轨制 |
| `frontend/src/components/layout/AppSidebar.tsx` | +43 | 所有 `<Link>` 添加 `prefetch={false}` + Logo 样式调整 |
| `frontend/src/lib/api/query-client.ts` | +4 | 降低全局重试次数 |
| `frontend/src/lib/hooks/use-learning.ts` | +21 | 修复 `setTimeout` 内存泄漏 |
| `frontend/src/components/layout/AppSidebar.test.tsx` | +3 | 测试适配 |

**总计：10 个文件，+555 行，-58 行**

---

## 一、Notebook Chat → SSE 流式

### 架构变化

```
修改前：POST /chat/execute → 同步阻塞 → 等 LLM 全部生成完 → 一次性返回
修改后：POST /chat/execute/stream → SSE 事件流 → 逐条推送 AI 消息
```

### 后端（`api/routers/chat.py`）

**新增端点**：`POST /chat/execute/stream`

- 接受与 `/chat/execute` 相同的 `ExecuteChatRequest` 请求体
- 返回 `StreamingResponse`（`text/plain; charset=utf-8`）
- 使用 `asyncio.to_thread` 包装同步 `chat_graph.invoke()`，避免阻塞事件循环

**SSE 事件格式**：

```
data: {"type":"user_message","content":"你好","timestamp":null}

data: {"type":"ai_message","content":"你好！有什么可以帮你的？","timestamp":null}

data: {"type":"generation_suggestion","data":{...}}

data: {"type":"complete"}

data: {"type":"error","message":"错误描述"}
```

**已修复的原有问题**：
- 原 `/chat/execute` 端点 `chat_graph.invoke()` 直接调用阻塞事件循环 → 改为 `await asyncio.to_thread(chat_graph.invoke, ...)`
- 清理重复的 `from langchain_core.messages import HumanMessage` 内联导入

### 前端

**`lib/api/chat.ts`** — 新增 `sendMessageStream()`：

- 使用原生 `fetch()` + `ReadableStream` 解析 SSE（与 Axios 客户端并行）
- 从 `localStorage['auth-storage']` 提取 Bearer token（与 Axios 拦截器逻辑一致）
- 返回 `AsyncGenerator`，逐条 `yield` 解析后的 JSON 事件

**`lib/hooks/useNotebookChat.ts`** — `sendMessage` 改为 SSE 流式：

- 使用 `for await...of` 消费 `sendMessageStream()` 生成器
- 增量更新消息列表：收到 `ai_message` 事件立即追加到 UI
- 收到 `complete` 事件后调用 `refetchCurrentSession()` 同步最终状态
- `activeStreamRef` 防止并发发送（在第一个 `await` 之前设置 guard）

---

## 二、文件处理状态 → SSE

### 架构变化

```
修改前：useSourceStatus → 5 秒轮询 → 每次 HTTP 请求 → 99% 返回 "仍在处理中"
修改后：useSourceStatusStream → SSE 长连接 → 仅状态变更时推送
```

### 后端（`api/routers/sources.py`）

**新增端点**：`GET /sources/{source_id}/status/stream`

- 服务端内部每秒检查状态，**仅变更时**向客户端推送 SSE 事件
- **10 分钟全局超时**：防止源状态卡在 `running` 导致连接泄漏
- **连续错误指数退避**：5 次连续失败后自动关闭连接（1s → 2s → 4s → 8s）
- **正常退出**：`asyncio.CancelledError`（客户端断开）时静默清理

**SSE 事件格式**：

```
data: {"type":"status_update","status":"running","processing_info":{...},"command_id":"..."}

data: {"type":"complete","status":"completed"}
```

### 前端

**`lib/hooks/use-sources.ts`** — 新增 `useSourceStatusStream()`：

- `useEffect` 管理 SSE 连接生命周期
- `AbortController` + `AbortSignal` 确保组件卸载时自动断开
- 收到终端状态（`completed`/`failed`）时自动关闭
- 返回 `{ data, isStreaming }` 接口

**`components/sources/SourceCard.tsx`** — 双轨制：

- SSE 流优先（`useSourceStatusStream`）
- 轮询兜底（`useSourceStatus`，仅 SSE 未激活时启用）
- 降级路径：SSE 连接失败 → 自动回退到轮询

---

## 三、性能修复（页面卡顿根因）

### 问题根因链

```
侧边栏 13 个 <Link> 默认 prefetch={true}
    ↓ 进入任意页面预取 13 个路由
    ↓ Next.js 单线程处理 13 个页面渲染
    ↓ 页面渲染触发 useSourceStatus 2s 轮询
    ↓ 轮询返回 → React re-render → 侧边栏 re-render → 再次触发 prefetch
    ↓ 源列表 refetchOnWindowFocus + staleTime:5s + 全局 retry:2
    ↓ 请求风暴 → Next.js 服务器饱和 → 页面卡死
```

### 修复措施

| 问题 | 修改前 | 修改后 | 文件 |
|------|--------|--------|------|
| 侧边栏预取 | 默认 `prefetch={true}` | `prefetch={false}`（13 处） | `AppSidebar.tsx` |
| 源状态轮询 | 2 秒 | **改为 SSE 推送** | `use-sources.ts` |
| 全局查询重试 | `retry: 2`（3 次尝试） | `retry: 1`（2 次尝试） | `query-client.ts` |
| 全局变更重试 | `retry: 1` | `retry: 0`（不重试） | `query-client.ts` |
| 源数据 staleTime | 5 秒 | 30 秒 | `use-sources.ts` |
| refetchOnWindowFocus | 强制 `true` | 移除（使用全局默认 `false`） | `use-sources.ts` |
| 源状态轮询重试 | `failureCount < 3`（4 次尝试） | `failureCount < 1`（2 次尝试） | `use-sources.ts` |

---

## 四、Logo 与侧边栏样式调整

- **折叠态**：显示 `logo.png`（28×28），hover 渐隐显示菜单按钮
- **展开态**：显示 `pure_logo.png`（填满侧边栏宽度，`max-h-14`），容器 `flex-1` 居中
- **模式标签**（学习前台/管理后台）：
  - `text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60`
  - `p-0.5`（2px 内边距），单层 div（去除嵌套）
  - 背景透明，深色/浅色主题自动跟随

---

## 五、代码审查修复

审查发现了 **5 critical + 14 medium + 11 low** 问题。本次改动已修复全部 **critical** 问题：

| 严重度 | 问题 | 修复方式 |
|--------|------|----------|
| 🔴 | `sendMessage` 竞态：guard 在 await 之后才设置 | 移到第一个 `await` 之前 |
| 🔴 | 源状态 SSE 无超时，可能无限泄漏连接 | 添加 10 分钟全局超时 + 连续错误指数退避 |
| 🔴 | 聊天 SSE 错误后缺少 `complete` 事件，导致前端悬挂 | 错误后立即 `yield complete` |
| 🔴 | 原 `execute_chat` 直接调用同步 `invoke()` 阻塞事件循环 | 改为 `await asyncio.to_thread(invoke, ...)` |
| 🔴 | `sendMessage` 缺少 `pendingReasoningEffort` 依赖 | 补全到 `useCallback` 依赖数组 |

### 已知历史问题（非本次引入，建议后续处理）

- 🟡 多个端点错误信息泄露内部细节（`str(e)` 直接返回 HTTP 客户端）
- 🟡 文件上传无大小限制（DoS 风险）
- 🟡 `asyncio.get_event_loop()` 已弃用
- 🟡 消息内容无长度校验
- 🟡 LangGraph 状态读写未加锁（并发请求可能丢失消息）
- 🟡 `contextSelections` 每次渲染创建新对象导致 `buildContext` 重复调用

---

## 六、测试验证

- ✅ 前端 TypeScript 编译零错误
- ✅ 后端 Python 模块导入成功
- ✅ `AppSidebar.test.tsx` 适配（`getByText` → `getByAltText`）

---

## 七、向后兼容性

| 端点 | 状态 |
|------|------|
| `POST /chat/execute` | ✅ 保留（同步阻塞，内部修复事件循环） |
| `POST /chat/execute/stream` | 🆕 新增（SSE 流式） |
| `GET /sources/{id}/status` | ✅ 保留（传统轮询端点） |
| `GET /sources/{id}/status/stream` | 🆕 新增（SSE 推送） |
| `useSourceStatus()` | ✅ 保留（轮询兜底） |
| `useSourceStatusStream()` | 🆕 新增（SSE 优先） |
