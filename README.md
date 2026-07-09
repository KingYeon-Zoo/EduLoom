<div align="center">

<img src="./banner.png" alt="EduLoom · 学织" width="440" />

<br/>
<br/>

### 基于大模型多智能体协同的个性化学习系统

**把零散的课程资料，编织成一张属于每位学生的个性化学习网络。**

<br/>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB.svg?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000.svg?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-009688.svg?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![SurrealDB](https://img.shields.io/badge/SurrealDB-Graph_+_Vector-FF00A0.svg?style=for-the-badge&logo=surrealdb&logoColor=white)](https://surrealdb.com/)

<br/>

**[✨ 核心能力](#-核心能力)** · **[🤖 多智能体架构](#-多智能体协同架构)** · **[🏗️ 系统设计](#️-系统设计)** · **[🛠️ 技术栈](#️-技术栈)** · **[📂 项目结构](#-项目结构)**

</div>

---

<div align="center">

> _Edu·cation + Loom（织机）_ ——像织机把散乱的丝线织成布一样，
> 由一组分工明确的智能体，将零散知识编织成结构化、可推送、可评估的个性化学习网络。

</div>

---

## 📖 项目简介

**EduLoom（学织）** 是一款开源、本地优先、以隐私为核心的个性化学习系统。

在线课程与资料唾手可得，真正的难题从来不是"内容不够"，而是——**学习资源繁杂无序、难以精准匹配个体差异、缺乏贯穿始终的智能化指导**。同一份教材，对基础扎实的学生是复习提纲，对初学者却是天书。

EduLoom 以 **多智能体（Multi-Agent）协同** 为核心，把学生上传的课程文档、文献、网页等原始材料，自动编织成一整套 **多模态、个性化、随学随新** 的学习资源与学习路径，让"因材施教"从理念变成可运行的系统。

<table>
<tr>
<td width="33%" align="center">

### 🔒 隐私优先
所有 API 密钥经 **Fernet 加密** 落地本地存储；<br/>可搭配本地模型 + 本地数据库 **完全离线运行**，数据不出本机。

</td>
<td width="33%" align="center">

### 🧩 多智能体协同
**薄协调器 + 角色清晰的专职智能体**，<br/>让"多智能体协作"在架构与 UI 中 **清晰可见、可追溯**。

</td>
<td width="33%" align="center">

### 🎨 多模态生成
一次编织出 **5+ 种** 学习资源：<br/>讲解文档 · 题库 · 思维导图 · 课件 · 教学视频。

</td>
</tr>
</table>

---

## ✨ 核心能力

EduLoom 由一层很薄的 **`LearningCoordinator`（协调器）** 调度多个角色清晰的专职智能体协作完成，每个智能体只专注一项职责——从建立"学生是谁"，到"该学什么、怎么学"，再到"学得如何"，形成完整闭环。

### 🧭 对话式学习画像自主构建

摒弃繁琐表单，学生通过 **自然语言对话** 即可建立画像。`ProfileExtractor` 智能体从对话与学习行为中实时抽取特征，构建并维护一个包含 **6 个固定维度** 的动态画像，随学习进程 **随学随新**：

| 维度 | 说明 |
| :--- | :--- |
| 🧱 知识基础 | 已掌握的知识与能力水平 |
| 🧠 认知风格 | 基于 **行为证据观察** 的学习风格（而非主观问卷） |
| ⚠️ 易错点偏好 | 高频错误与薄弱环节 |
| 🎯 学习目标 | 短期 / 长期学习诉求 |
| 📈 学习进度 | 当前所处的学习阶段 |
| 🌱 学习兴趣方向 | 偏好的主题与延伸方向 |

> 认知风格维度刻意采用"观察到的行为证据"而非让用户填问卷——避免了自我报告偏差，让画像更贴近真实学习状态。

### 🎨 多智能体协同的多模态资源生成

`RecommenderAgent`（资源顾问）依据画像推荐最合适的生成预设与自定义指令，再由 5 个专职"创作智能体"分工产出多模态学习资源：

| 智能体 | 产出资源 | 关键技术 |
| :--- | :--- | :--- |
| 📝 **讲解撰稿人** `ReportWriter` | 专业课程讲解 / 摘要文档 | LLM + RAG 检索 |
| ❓ **命题官** `QuizMaster` | 多类型练习题库（含答案与解析） | 结构化生成 |
| 🧭 **导图架构师** `MindMapArchitect` | 层级化知识点思维导图 | 结构化生成 |
| 🖼️ **课件设计师** `SlideComposer` | 多页要点学习 PPT | LLM + 豆包文生图 |
| 🎬 **视频导演** `VideoDirector` | 多模态教学视频 / 动画 | 豆包 Seedance 视频 + TTS 配音 |

> 所有资源支持 **流式输出、Markdown 渲染、多模态卡片化展示**，并具备生成进度追踪，避免长时间白屏等待。

### 🛤️ 个性化学习路径规划与资源推送

`PathPlanner`（路径规划师）结合课程内容与学习画像，规划循序渐进的学习路径；`ResourcePusher`（资源推送官）将已生成的多模态资源 **精准匹配** 到路径每个步骤，并自动标注 **资源缺口**（缺什么、建议生成哪种类型），形成"规划 → 推送 → 补齐"的闭环。

### 💬 智能辅导

`TutorAgent`（智能辅导员）提供即时多模态答疑：优先给出文字解答并推荐已有资源，必要时建议生成新资源（需用户确认），实现针对性的学习引导，而非机械问答。

### 📊 学习效果评估

`AssessmentAnalyst`（评估分析师）基于画像、练习产物与学习进度进行 **多维度评估**，给出动态调整建议——评估结果反向驱动画像更新与推送策略，让整个系统越用越懂你。

---

## 🤖 多智能体协同架构

EduLoom 刻意 **不堆砌重型编排框架**（消息总线、注册中心等在此场景属过度工程），而是采用 **"薄协调器 + 命名清晰的角色智能体"** 路线——既保证实现简洁可维护，又让"多智能体协作"在 UI 与架构图中清晰可见。

```text
                        ┌────────────────────────────┐
                        │   LearningCoordinator 协调器  │  ← 无状态，只做编排 sequencing
                        └──────────────┬─────────────┘
        ┌──────────────┬──────────────┼──────────────┬──────────────┐
        ▼              ▼              ▼              ▼              ▼
  ProfileExtractor  Recommender    创作智能体群      PathPlanner    Assessment
   学习画像抽取      资源顾问     (5 种资源生成)     + ResourcePusher  Analyst
                                                    路径规划 + 推送    学习效果评估
        ▲                                                              │
        └───────────────  画像随学随新 · 评估反向优化  ◀───────────────┘
```

**三个值得展开的设计决策：**

- **单一事实源（Single Source of Truth）**：`AGENT_ROSTER` 是"谁在协作"的唯一定义，同时驱动前端"协作智能体"面板与架构文档——运行时行为与文档描述天然一致，杜绝了"文档与代码脱节"。
- **协调器无状态**：`LearningCoordinator` 不持有任何自身状态，只负责组装输入（笔记本内容 / 画像摘要 / 已有资源）并驱动对应的 LangGraph 状态图，返回纯数据交由服务层持久化——职责边界干净，易于测试与扩展。
- **重活异步化**：耗时的多模态生成（视频 / 播客 / 路径规划 / 评估）走 **Surreal-Commands 异步任务队列**，在后台 worker 进程执行，通过任务状态轮询暴露进度，绝不阻塞 API 主线程。

各智能体基于 **LangGraph 状态图** 实现，通过统一的 `provision_langchain_model()` 智能选择模型（自动识别长上下文场景、支持逐请求模型覆盖、主模型失败时回退）。

---

## 🏗️ 系统设计

### 三层架构

```text
┌──────────────────────────────────────────────┐
│   前端  Next.js / React        :3000           │  画像对话 · 资源生成 · 路径 · 辅导 · 评估
├──────────────────────────────────────────────┤  ▲ HTTP REST
│   后端  FastAPI + LangGraph     :5055           │  多智能体编排 · 异步任务队列
├──────────────────────────────────────────────┤  ▲ SurrealQL
│   数据库  SurrealDB             :8000           │  画像 · 资源 · 路径 · 向量嵌入 · 图关系
└──────────────────────────────────────────────┘
```

### 关键工程实践

| 主题 | 做法 |
| :--- | :--- |
| **异步优先** | 数据库查询、图调用、外部 API 全链路 `async/await`；SurrealDB 异步驱动 + 连接池，FastAPI 高并发处理 |
| **图 + 向量混合存储** | SurrealDB 单库同时承载图关系与向量嵌入，语义检索与关系查询无需跨库拼装 |
| **自动迁移** | `AsyncMigrationManager` 在 API 启动时按版本自动执行 SurrealQL 迁移，支持可选回滚脚本 |
| **多 Provider 抽象** | 基于 Esperanto 统一接口，一套代码对接 8+ AI 服务商，切换 Provider 无需改业务逻辑 |
| **密钥安全** | 每个 Provider 独立凭证记录，API 密钥经 **Fernet（AES-128-CBC）** 加密后落库，逐行解密并容错处理密钥轮换 |
| **结构化输出校验** | 智能体输出经 Pydantic v2 解析校验，异常自动分类（`error_classifier`）与重试 |
| **防幻觉** | 资源生成基于 RAG，以学生上传的知识库内容为事实依据，降低事实性错误 |

---

## 🛠️ 技术栈

| 层 | 技术 |
| :--- | :--- |
| **前端** | Next.js 16 (React 19)、TypeScript、Zustand、TanStack Query、TailwindCSS、Shadcn/ui |
| **后端** | FastAPI、Python 3.11+、LangChain、LangGraph、Pydantic v2、Loguru |
| **数据库** | SurrealDB（图 + 向量混合存储，启动时自动迁移） |
| **多模态生成** | 豆包 / 火山引擎方舟 Ark：Seedance 视频、Seedream 文生图、TTS 语音合成 |
| **异步任务** | Surreal-Commands（基于数据库的任务调度队列） |
| **多 Provider AI** | Esperanto 统一接口（OpenAI / Anthropic / Google / Groq / Ollama / Mistral / DeepSeek 等） |
| **内容处理** | content-core（50+ 文件类型抽取）、ai-prompter（Jinja2 模板）、podcast-creator |

---

## 📂 项目结构

```text
edu_loom/                  # Python 核心服务包
├── agents/                # LearningCoordinator + 角色智能体名册（单一事实源）
├── ai/                    # 模型发现、密钥加密、Provider 接入
│   └── doubao/            # 豆包接入层（视频 / 图像 / TTS / Esperanto 适配）
├── database/              # SurrealDB 操作与自动迁移
├── domain/                # 领域模型（画像 / 学习路径 / 资源 / 笔记本 / 凭证）
├── graphs/                # LangGraph 智能体状态图
│   ├── profile_extraction.py   # 画像抽取
│   ├── path_planning.py        # 路径规划 + 资源推送
│   ├── assessment.py           # 学习效果评估
│   └── chat.py / ask.py        # 对话 / 检索问答
└── utils/                 # 向量嵌入与文本分割
api/                       # FastAPI 路由与服务
commands/                  # Surreal-Commands 异步任务处理器
├── doubao_commands.py     # 视频 / 图像生成
├── learning_commands.py   # 路径规划 / 效果评估
├── profile_commands.py    # 画像抽取
└── studio_commands.py     # 资源生成
frontend/                  # Next.js 前端
run-dev.sh                 # 一键开发启动脚本
```

---

## 🚀 快速开始

项目采用标准三层架构，需依次启动 **SurrealDB → FastAPI 后端 → Next.js 前端**。

```bash
cp .env.example .env      # 填写 AI Provider 与豆包多模态密钥
./run-dev.sh              # 一键并行拉起数据库、后端、前端
```

启动后访问 **[http://localhost:3000](http://localhost:3000)**，API 文档见 **[http://localhost:5055/docs](http://localhost:5055/docs)**。详细的环境依赖、密钥获取与本地模型接入见 [配置文档](#-配置文档)。

---

## 📖 配置文档

- **[API 凭证配置指南](docs/3-USER-GUIDE/api-configuration.md)** —— 密钥加密保存、连接测试、模型导入
- **[AI 服务商配置指南](docs/5-CONFIGURATION/ai-providers.md)** —— 密钥获取与推荐 Provider 列表
- **[OpenAI 兼容接口配置](docs/5-CONFIGURATION/openai-compatible.md)** —— 接入 LM Studio / vLLM 等本地推理服务

---

## 🔗 开源依赖与致谢

EduLoom 在开源项目 [Open Notebook](https://github.com/lfnovo/open-notebook)（MIT）的三层架构基础上深度改造而来，并新增了学习画像、多智能体资源生成、学习路径规划、智能辅导与学习效果评估等完整能力。谨向以下开源项目致谢：

| 项目 | 用途 | 协议 |
| :--- | :--- | :--- |
| [Open Notebook](https://github.com/lfnovo/open-notebook) | 三层架构与多模态笔记基座 | MIT |
| [LangChain / LangGraph](https://github.com/langchain-ai/langgraph) | 多智能体状态图编排 | MIT |
| [SurrealDB](https://surrealdb.com/) | 图 + 向量混合数据库 | BSL 1.1 |
| [FastAPI](https://fastapi.tiangolo.com/) | 后端 Web 框架 | MIT |
| [Next.js](https://nextjs.org/) | 前端框架 | MIT |
| 豆包 / 火山引擎方舟 Ark | Seedance 视频、Seedream 图像、TTS | 商用 API 服务 |

---

## 📄 开源许可证

本项目采用 [MIT License](LICENSE) 开源。

<div align="center">

<br/>

<img src="./logo.png" alt="EduLoom" width="72" height="72" />

**EduLoom · 学织** —— 让每一份资料，都成为专属你的那一堂课。

<sub>Built with ❤️ · 因材施教的数字化实践</sub>

</div>
