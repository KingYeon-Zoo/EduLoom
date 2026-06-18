# 学习画像系统设计（项目 B）

**日期**: 2026-06-18
**赛题需求**: A03 基本功能需求 #1 —— 对话式学习画像自主构建
**作者**: EduLoom 团队

---

## 1. 背景与目标

赛题要求：摒弃传统繁琐表单，支持通过自然语言对话，结合学生的专业、学习目标、学习历史等信息，**自动抽取特征，构建动态学生画像**。画像需包含**不少于 6 个维度**，并支持**画像的随学随新**。

本设计在现有 EduLoom（基于 open-notebook 的多智能体学习系统）三层架构上，新增一个完整的"学习画像"垂直切片，覆盖：数据模型与存储、对话抽取与调和引擎、API 端点、前端画像页面。

### 设计原则

- **参考主流实现，不臆想**：抽取/调和/检索流水线对齐 Mem0、LangMem、Letta(MemGPT)、ChatGPT Memory 等生产级方案；知识维度参考 Open Learner Model / 知识组件(Knowledge Components) 思路。
- **复用现有架构**：RecordModel 单例、`@command` fire-and-forget 任务队列、LangGraph 图、repository 模式、SurrealQL 迁移，全部沿用仓库既有约定。
- **YAGNI**：初赛核心交付聚焦"抽取 + 调和 + 展示/编辑"，定期整合/衰减逻辑留接口、作可选第二阶段。

### 关键决策（已与用户确认）

| 决策点 | 选择 | 理由 |
| --- | --- | --- |
| 范围 | 数据模型+存储、抽取+调和引擎、API、前端画像页 全栈切片 | 完整可演示 |
| 画像归属 | 全局单一画像（单例） | 当前系统无真正多用户，本地优先场景；最简且贴合架构 |
| 对话来源 | 复用现有 chat | 学生正常聊天时画像随之更新，无需新建对话界面 |
| 认知风格维度 | 保留"认知风格"名称，但存证据驱动的观察到的交互偏好，**不做 VARK 类型定位** | VARK 学习风格"匹配假设"为已被证伪的 neuromyth（Frontiers 2023、Educational Psychology Review 2025、Yale Poorvu Center）；主流改为建模先验知识、误解、自我调节、观察到的交互偏好 |
| 存储结构 | 单一 SurrealDB 记录，固定 6 维字段，每维为带 confidence/provenance/timestamp 的条目数组 | 最易展示/编辑（OLM），贴合 RecordModel 单例 |
| 抽取引擎 | 方案 A：后台 fire-and-forget 抽取/调和；整合逻辑留接口 | 零热路径延迟，满足"避免白屏"非功能性需求；最贴合本仓库 fire-and-forget 架构 |

---

## 2. 架构总览

```
chat 对话(现有 graphs/chat.py) ──每轮回复后 fire-and-forget──▶ extract_profile 命令(新)
                                                                  │
                                          ┌───────────────────────┤
                                          ▼                        ▼
                                  ① 抽取节点(LLM)           ② 调和节点(LLM)
                                  6 维结构化候选事实     比对现有条目 → ADD/UPDATE/DELETE/NOOP
                                          │                        │
                                          └──────────┬─────────────┘
                                                     ▼
                                  LearnerProfile 单例(SurrealDB, 固定 6 维 + 条目数组)
                                                     │
                                  ┌──────────────────┼──────────────────┐
                                  ▼                  ▼                   ▼
                            GET 画像 API       PUT 手动编辑 API     POST 重抽取 API
                                  │            (Open Learner Model)
                                  ▼
                            前端画像页面(6 维卡片 + 置信度 + 来源 + 编辑)
```

**单元划分理由**：抽取与调和是两个独立 LLM 步骤（Mem0 模式），各自可单测；画像存储是单一职责领域模型；API 与前端是薄层。每个单元边界清晰，可独立理解、独立测试、独立替换内部实现而不破坏消费方。

---

## 3. 数据模型（固定 6 维 + 条目数组）

新建文件 `edu_loom/domain/learner_profile.py`。

### ProfileEntry（单条画像事实）

```python
class ProfileEntry(BaseModel):
    content: str          # 一条事实，如 "偏好先看 worked example 再听讲解"
    confidence: float     # 0–1，调和节点由 LLM 给出
    provenance: str       # 来源 chat_session id（可追溯）
    created: str          # ISO 时间字符串
    updated: str          # ISO 时间字符串，每次 UPDATE 刷新
```

### LearnerProfile（单例画像）

继承 `RecordModel`（沿用 `ContentSettings` / `DefaultPrompts` 的单例模式），`record_id = "learner_profile:singleton"`。6 个固定维度，每个是 `list[ProfileEntry]`：

```python
class LearnerProfile(RecordModel):
    record_id: ClassVar[str] = "learner_profile:singleton"
    table_name: ClassVar[str] = "learner_profile"

    knowledge_base:     list[ProfileEntry] = []   # 知识基础
    cognitive_style:    list[ProfileEntry] = []   # 认知风格（证据驱动：观察到的交互偏好，非 VARK 类型）
    error_prone:        list[ProfileEntry] = []   # 易错点偏好
    learning_goals:     list[ProfileEntry] = []   # 学习目标
    learning_progress:  list[ProfileEntry] = []   # 学习进度
    learning_interests: list[ProfileEntry] = []   # 学习兴趣方向
```

**6 个维度直接对应赛题示例的 6 维**，满足"不少于 6 个维度"。

### 维度常量

定义 `PROFILE_DIMENSIONS`（字段名 → 中文显示名）单一事实来源，供抽取 prompt、API、前端共享，避免三处各写一份。

### 数据库迁移

新建 `edu_loom/database/migrations/16.surrealql` 与 `16_down.surrealql`：

```surql
-- 16.surrealql
DEFINE TABLE IF NOT EXISTS learner_profile SCHEMALESS;
-- 单例记录在首次写入时由 RecordModel.update() 经 UPSERT 创建，无需预置行
```

```surql
-- 16_down.surrealql
REMOVE TABLE IF EXISTS learner_profile;
```

在 `edu_loom/database/async_migrate.py` 的 `AsyncMigrationManager.__init__` 硬编码列表中注册 migration 16 的 up/down（按 database/CLAUDE.md 约定，迁移非自动发现）。采用 SCHEMALESS：条目数组结构由 Pydantic 层校验，DB 层保持灵活，与现有 notebook/source 表风格一致。

---

## 4. 抽取 + 调和引擎

### 触发点

在 `edu_loom/graphs/chat.py` 的 `call_model_with_messages` 节点末尾、生成回复之后，fire-and-forget 提交命令：

```python
submit_command(
    "open_notebook",
    "extract_profile",
    {"session_id": <当前会话 id>, "recent_messages": <最近窗口对话文本>},
)
```

不阻塞对话返回（满足非功能性需求"避免长时间白屏等待"）。提交失败仅记 warning，不影响对话（参考 `Source.add_insight` 的容错写法）。

> **会话 id 的获取**：`chat.py` 现有节点签名为 `(state, config)`，`session_id` 通过 `config["configurable"]["thread_id"]`（LangGraph checkpoint thread）或 state 注入获取。实现时优先复用 LangGraph 已有的 `thread_id`；若不可得则以 `"unknown"` 占位（provenance 容许）。

### 抽取图

新建 `edu_loom/graphs/profile_extraction.py`，LangGraph 两节点状态机：

**① 抽取节点 `extract_facts`**
- 输入：最近窗口对话文本。
- 用 `provision_langchain_model()` 选模型（沿用 chat 图的 sync-node / async-bridge 写法）。
- Jinja 模板 `prompts/profile/extract.jinja`（ai_prompter）渲染 system prompt，要求 LLM 按 6 维输出结构化候选事实 JSON，形如：
  ```json
  {"candidates": [{"dimension": "knowledge_base", "content": "...", "confidence": 0.8}, ...]}
  ```
- **认知风格约束**：prompt 中明确"`cognitive_style` 维度只记录对话中可观察、有证据的交互偏好（如'偏好先看代码示例''反复要求类比解释''倾向自底向上'），禁止输出 VARK 类型标签或任何未经证据支撑的学习者类型推断"。
- **防幻觉约束**：prompt 要求所有事实必须能从对话中找到直接依据；无依据则不输出；无可抽取内容时返回空数组。

**② 调和节点 `reconcile`**
- 输入：候选事实列表 + 当前 `LearnerProfile`。
- 对每条候选，与同维度现有条目比对，LLM（Jinja 模板 `prompts/profile/reconcile.jinja`）输出操作（Mem0 四操作）：
  ```json
  {"op": "ADD|UPDATE|DELETE|NOOP", "dimension": "...", "target_index": <int?>, "content": "...", "confidence": <float>}
  ```
  - **ADD**：新事实 → 追加 ProfileEntry（created=updated=now）。
  - **UPDATE**：增强/修正已有条目 → 更新 content/confidence，刷新 updated。
  - **DELETE**：被新证据矛盾 → 移除该条目（倾向保留最新证据）。
  - **NOOP**：无新信息 → 跳过。
- 应用全部操作后 `await profile.update()` 持久化。

### 命令封装

新建 `commands/profile_commands.py`，`extract_profile_command`：
- `@command("extract_profile", app="open_notebook", retry={...})`，重试配置对齐 `embedding_commands`：`max_attempts=5`、`exponential_jitter`、`wait_min=1`、`wait_max=60`、`stop_on=[ValueError, ConfigurationError]`、`retry_log_level="debug"`。
- 流程：加载 `LearnerProfile` 单例 → 调用 `profile_extraction` 图 → 持久化 → 返回 `CommandOutput`（success、各维度变更计数、processing_time）。
- LLM 返回非法 JSON / 解析失败 → 抛 `ValueError`（永久失败，不重试），跳过本轮，不污染画像。

### 整合/衰减（方案 C，留接口不实现）

调和节点写成可独立调用的纯函数（输入候选+现有画像，输出操作列表）。后续如需"随学随新"的定期反思（跨 session 摘要、兴趣泛化、低置信/过期条目衰减），新增 `consolidate_profile_command` 直接复用该函数，无需改动本期代码。本期不实现，spec 中标注为第二阶段可选增强。

---

## 5. API 端点

新建 `api/routers/learner_profile.py` + `api/learner_profile_service.py`，在 `api/main.py` 注册路由。Schema 定义在 `api/models.py`。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/learner-profile` | 读取画像单例，返回 6 维及各维条目（前端展示） |
| PUT | `/learner-profile` | 手动编辑/增删条目（Open Learner Model：学生可纠正画像） |
| POST | `/learner-profile/extract` | 手动触发一次重抽取（演示/冷启动），body 传一段对话或 session_id，返回 command_id |
| DELETE | `/learner-profile` | 清空重置画像 |

服务层薄封装领域模型方法（沿用现有 `*_service.py` 模式）。`POST .../extract` 用 `submit_command` 提交后立即返回 command_id，前端经现有 `/commands/{id}` 端点轮询状态。

---

## 6. 前端画像页面

新建 `frontend/src/app/(dashboard)/profile/page.tsx` + `frontend/src/lib/hooks/use-learner-profile.ts`（TanStack Query）+ `frontend/src/lib/api/learner-profile.ts`（API client）+ 类型 `frontend/src/lib/types/learner-profile.ts`。

布局：6 个维度卡片化展示（贴合非功能性需求"多模态内容卡片化展示"），每条事实显示 内容 + 置信度（进度条或标签）+ 来源 + 时间，支持内联编辑/删除，顶部提供"重新分析""重置"按钮。

```
┌─ 学习画像 ──────────────────[重新分析] [重置]─┐
│ ┌─知识基础─────────┐ ┌─认知风格──────────┐  │
│ │ • 熟悉 Python 基础│ │ • 偏好先看代码示例 │  │
│ │   置信0.8 来源... │ │   置信0.6 来源...  │  │
│ └──────────[编辑]──┘ └──────────[编辑]───┘  │
│ ┌─易错点───┐┌─学习目标─┐┌─进度─┐┌─兴趣─┐    │
│ └──────────┘└──────────┘└──────┘└──────┘    │
└────────────────────────────────────────────┘
```

i18n：新增 key 同时补 `frontend/src/lib/locales/zh-CN` 与 `en-US`（遵循 frontend/CLAUDE.md 的 i18n 约定）。在 dashboard 导航中加入"学习画像"入口。

---

## 7. 错误处理

- **对话不受影响**：抽取为 fire-and-forget，命令提交失败仅 warning；命令内部失败由 surreal-commands 重试机制处理。
- **图节点异常**：用 `open_notebook.utils.error_classifier.classify_error()` 包装 LLM 异常为友好的 `OpenNotebookError`（沿用 chat 图写法）。
- **非法 LLM 输出**：JSON 解析失败抛 `ValueError`（`stop_on` 中，不重试），跳过本轮，画像保持不变。
- **空画像**：首次读取时单例尚未写入 DB，`RecordModel._load_from_db` 容许记录不存在，返回 6 个空数组。
- **防幻觉**：抽取 prompt 强约束"事实须有对话直接依据"，满足非功能性需求的"防幻觉"要求。

---

## 8. 测试策略

沿用现有 pytest 模式（`tests/`）：

- `tests/test_learner_profile.py`：领域模型 —— ProfileEntry 校验（confidence 范围、必填字段）、LearnerProfile 单例行为（`clear_instance` 后重建）、6 维默认空数组、`update()` 往返持久化。
- `tests/test_profile_extraction.py`：抽取/调和图 —— mock LLM 返回，验证 ADD/UPDATE/DELETE/NOOP 四种操作正确应用到画像；验证非法 JSON 抛 ValueError 且画像不变；验证 cognitive_style 不产生 VARK 标签（prompt 约束的回归测试）。
- `tests/test_learner_profile_api.py`：端点 —— GET/PUT/DELETE 往返、POST extract 返回 command_id。

运行：`uv run pytest tests/test_learner_profile.py tests/test_profile_extraction.py tests/test_learner_profile_api.py`。

---

## 9. 新增/改动文件清单

**后端新增**
- `edu_loom/domain/learner_profile.py` —— LearnerProfile / ProfileEntry / PROFILE_DIMENSIONS
- `edu_loom/graphs/profile_extraction.py` —— 抽取+调和两节点图
- `commands/profile_commands.py` —— extract_profile_command
- `edu_loom/database/migrations/16.surrealql` + `16_down.surrealql`
- `prompts/profile/extract.jinja` + `prompts/profile/reconcile.jinja`
- `api/routers/learner_profile.py` + `api/learner_profile_service.py`

**后端改动**
- `edu_loom/graphs/chat.py` —— 回复后 fire-and-forget 提交 extract_profile
- `edu_loom/database/async_migrate.py` —— 注册 migration 16
- `api/main.py` —— 注册 learner_profile 路由
- `api/models.py` —— 画像相关请求/响应 schema
- `commands/__init__.py` —— 注册 profile_commands（如需）

**前端新增**
- `frontend/src/app/(dashboard)/profile/page.tsx`
- `frontend/src/lib/hooks/use-learner-profile.ts`
- `frontend/src/lib/api/learner-profile.ts`
- `frontend/src/lib/types/learner-profile.ts`

**前端改动**
- `frontend/src/lib/locales/zh-CN/*` + `en-US/*` —— i18n key
- dashboard 导航 —— 加入"学习画像"入口

**测试新增**
- `tests/test_learner_profile.py`
- `tests/test_profile_extraction.py`
- `tests/test_learner_profile_api.py`

---

## 10. 参考来源（主流实现依据）

- Mem0 / Mem0g（extract→reconcile，ADD/UPDATE/DELETE/NOOP，矛盾取最新）: https://arxiv.org/html/2504.19413
- LangMem（profile vs collection，hot-path vs background）: https://github.com/langchain-ai/langmem
- Letta / MemGPT（核心记忆块、sleep-time 整合）: https://docs.letta.com/guides/core-concepts/memory/memory-blocks/
- OpenAI ChatGPT Memory（带 Confidence 的 out-of-band 画像）: https://help.openai.com/en/articles/8590148
- 学习风格 neuromyth（VARK 匹配假设被证伪）: https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2023.1147498/full ; https://link.springer.com/article/10.1007/s10648-025-10002-w ; https://poorvucenter.yale.edu/teaching/teaching-resource-library/learning-styles-as-a-myth
- Open Learner Models（画像对学习者可见/可编辑）: https://link.springer.com/chapter/10.1007/978-1-4419-5546-3_23
- BKT / DKT（知识掌握建模，可作知识维度后续增强）: https://link.springer.com/article/10.1007/s11257-023-09389-4 ; https://proceedings.neurips.cc/paper/2015/file/bac9162b47c56fc8a4d2a519803d51b3-Paper.pdf
