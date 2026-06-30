<div align="center">

# EduLoom · 学织

**基于大模型多智能体协同的个性化学习资源生成与智能学习系统**

将零散的课程资料，编织成一张属于每位学生的个性化学习网络。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://www.python.org/)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-009688.svg)](https://fastapi.tiangolo.com/
</div>

---

## 📖 项目简介

**EduLoom（学织）** 是一款开源、本地优先、以隐私为核心的高等教育个性化学习系统。面对"学习资源繁杂无序、难以精准匹配个体需求、缺乏智能化指导"的真实痛点，EduLoom 以**多智能体（Multi-Agent）协同**为核心，把学生上传的课程文档、文献、网页等原始材料，自动编织成一整套**多模态、个性化、随学随新**的学习资源与学习路径。

系统名取自 **Edu**cation + **Loom**（织机）—— 像织机将散乱的丝线编织成布一样，由一组分工明确的智能体将零散知识编织成结构化、可推送、可评估的个性化学习网络，真正落地"因材施教"的数字化愿景。

> 本项目在开源项目 [Open Notebook](https://github.com/lfnovo/open-notebook)（MIT 协议）的三层架构基础上深度改造而来，新增了学习画像、多智能体资源生成、学习路径规划、智能辅导与学习效果评估等完整能力。详见 [开源依赖与协议](#-开源依赖与协议)。

---

## ✨ 核心能力（对应赛题五大功能）

EduLoom 由一层很薄的 **LearningCoordinator（协调器）** 调度多个角色清晰的专职智能体协作完成，每个智能体专注一项职责，对应赛题的核心功能需求：

### ① 对话式学习画像自主构建
摒弃繁琐表单，学生通过**自然语言对话**即可构建画像。`ProfileExtractor` 智能体从对话与学习行为中实时抽取特征，构建并维护一个包含 **6 个固定维度**的动态画像，支持**随学随新**：

| 维度 | 说明 |
| --- | --- |
| 知识基础 | 已掌握的知识与能力水平 |
| 认知风格 | 基于行为证据观察的学习风格（非主观问卷） |
| 易错点偏好 | 高频错误与薄弱环节 |
| 学习目标 | 短期 / 长期学习诉求 |
| 学习进度 | 当前所处的学习阶段 |
| 学习兴趣方向 | 偏好的主题与延伸方向 |

### ② 多智能体协同的资源生成（≥5 种多模态资源）
系统**明确体现多智能体架构**：`RecommenderAgent`（资源顾问）依据画像推荐最合适的生成预设，再由 5 个专职"创作智能体"分工产出多模态学习资源：

| 智能体 | 产出资源 | 关键技术 |
| --- | --- | --- |
| 📝 讲解撰稿人 ReportWriter | 专业课程讲解 / 摘要文档 | LLM + RAG 检索 |
| ❓ 命题官 QuizMaster | 多类型练习题库（含答案与解析） | 结构化生成 |
| 🧠 导图架构师 MindMapArchitect | 层级化知识点思维导图 | 结构化生成 |
| 🖼️ 课件设计师 SlideComposer | 多页要点学习 PPT | LLM + 豆包文生图 |
| 🎬 视频导演 VideoDirector | 多模态教学视频 / 动画 | 豆包 Seedance 视频 + TTS 配音 |

> 所有资源均支持**流式输出、Markdown 渲染、多模态卡片化展示**，并具备生成进度追踪，避免长时间白屏等待。

### ③ 个性化学习路径规划与资源推送
`PathPlanner`（路径规划师）结合课程内容与学习画像，规划循序渐进的学习路径；`ResourcePusher`（资源推送官）将已生成的多模态资源**精准匹配**到路径每个步骤，并自动标注**资源缺口**（缺什么、建议生成哪种类型），形成"规划—推送—补齐"的闭环。

### ④ 智能辅导（加分项）
`TutorAgent`（智能辅导员）提供即时多模态答疑：优先给出文字解答并推荐已有资源，必要时建议生成新资源（需用户确认），实现针对性学习引导。

### ⑤ 学习效果评估（加分项）
`AssessmentAnalyst`（评估分析师）基于画像、练习产物与学习进度进行**多维度评估**，给出动态调整建议，驱动学习资源推送策略与学习计划的持续优化。

---

## 🤖 多智能体协同架构

EduLoom 不堆砌重型编排框架（消息总线、注册中心等属过度工程），而是采用**"薄协调器 + 命名清晰的角色智能体"**路线——既保证实现简洁可维护，又让"多智能体协作"在 UI 与架构图中清晰可见。

```
                        ┌────────────────────────────┐
                        │   LearningCoordinator 协调器  │
                        └──────────────┬─────────────┘
        ┌──────────────┬──────────────┼──────────────┬──────────────┐
        ▼              ▼              ▼              ▼              ▼
  ProfileExtractor  Recommender    创作智能体群      PathPlanner    Assessment
   学习画像抽取      资源顾问     (5 种资源生成)     + ResourcePusher  Analyst
                                                    路径规划+推送     学习效果评估
        ▲                                                              │
        └───────────────  画像随学随新 · 评估反向优化  ◀───────────────┘
```

各智能体基于 **LangGraph 状态图**实现，通过统一的 `provision_langchain_model()` 智能选择模型；耗时的多模态生成（视频 / 播客 / 路径规划 / 评估）走 **Surreal-Commands 异步任务队列**，在后台 worker 进程执行，不阻塞 API。

---

## 🛠️ 技术栈

| 层 | 技术 |
| --- | --- |
| **前端** | Next.js 16 (React 19)、TypeScript、Zustand、TanStack Query、TailwindCSS、Shadcn/ui |
| **后端** | FastAPI、Python 3.11+、LangChain、LangGraph、Pydantic v2、Loguru |
| **数据库** | SurrealDB（图 + 向量混合存储，启动时自动迁移） |
| **多模态生成** | 豆包（火山引擎方舟 Ark）：Seedance 视频、Seedream 文生图、TTS 语音合成 |
| **异步任务** | Surreal-Commands（基于数据库的任务调度队列） |
| **多 Provider AI** | Esperanto 统一接口（OpenAI / Anthropic / Google / Groq / Ollama / Mistral / DeepSeek 等） |
| **内容处理** | content-core（50+ 文件类型抽取）、ai-prompter（Jinja2 模板）、podcast-creator |

### 三层架构

```
┌──────────────────────────────────────────────┐
│   前端  Next.js / React        :3000           │  画像对话 · 资源生成 · 路径 · 辅导 · 评估
├──────────────────────────────────────────────┤  ▲ HTTP REST
│   后端  FastAPI + LangGraph     :5055           │  多智能体编排 · 异步任务队列
├──────────────────────────────────────────────┤  ▲ SurrealQL
│   数据库  SurrealDB             :8000           │  画像 · 资源 · 路径 · 向量嵌入 · 图关系
└──────────────────────────────────────────────┘
```

---

## 🚀 快速开始

推荐使用极速包管理器 [`uv`](https://github.com/astral-sh/uv)。

### 1. 环境准备
- **Python** `>= 3.11, < 3.13`
- **Node.js** `>= 18`
- **SurrealDB**
  - macOS: `brew install surrealdb/tap/surreal`
  - Linux / WSL: `curl -sSf https://install.surrealdb.com | sh`
  - Windows: `winget install SurrealDB.SurrealDB`
- **uv**: `curl -LsSf https://astral.sh/uv/install.sh | sh`

### 2. 配置密钥
```bash
cp .env.example .env
```
按需填写 `.env`：豆包多模态能力需配置 `ARK_API_KEY`、`DOUBAO_VIDEO_MODEL`、`DOUBAO_IMAGE_MODEL`、`DOUBAO_TTS_MODEL`；语言模型可使用任意 Esperanto 支持的 Provider。所有 API 密钥在本地通过 **Fernet (AES-128-CBC)** 加密存储，不外泄。

### 3. 一键启动
```bash
chmod +x run-dev.sh
./run-dev.sh
```
脚本将并行拉起：
- **SurrealDB** —— `:8000`
- **FastAPI 后端**（含异步 worker）—— `:5055`
- **Next.js 前端** —— `:3000`

启动后访问 **[http://localhost:3000](http://localhost:3000)**。API 文档见 **[http://localhost:5055/docs](http://localhost:5055/docs)**。

---

## 📂 项目结构

```text
edu_loom/                  # Python 核心服务包
├── agents/                # LearningCoordinator + 角色智能体名册
├── ai/                    # 模型发现、密钥加密、Provider 接入
│   └── doubao/            # 豆包接入层（视频 / 图像 / TTS）
├── database/              # SurrealDB 操作与自动迁移
├── domain/                # 领域模型（画像 / 学习路径 / 资源 / 笔记本）
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

## 🛡️ 内容安全与防幻觉

- **检索增强（RAG）**：资源生成基于学生上传的知识库内容，以来源为依据降低事实性错误。
- **结构化输出校验**：智能体输出经 Pydantic 解析校验，异常自动分类与重试。
- **本地优先 / 隐私安全**：可与 Ollama 本地模型 + 本地 SurrealDB 完全离线运行，敏感数据不出本机。

---

## 📖 配置文档

- **[API 凭证配置指南](docs/3-USER-GUIDE/api-configuration.md)** —— 密钥加密保存、连接测试、模型导入
- **[AI 服务商配置指南](docs/5-CONFIGURATION/ai-providers.md)** —— 密钥获取与推荐 Provider 列表
- **[OpenAI 兼容接口配置](docs/5-CONFIGURATION/openai-compatible.md)** —— 接入 LM Studio / vLLM 等本地推理服务

---

## 🔗 开源依赖与协议

EduLoom 基于以下开源项目与前沿 AI 工具构建，谨致谢意：

| 项目 | 用途 | 协议 |
| --- | --- | --- |
| [Open Notebook](https://github.com/lfnovo/open-notebook) | 三层架构与多模态笔记基座 | MIT |
| [LangChain / LangGraph](https://github.com/langchain-ai/langgraph) | 多智能体状态图编排 | MIT |
| [SurrealDB](https://surrealdb.com/) | 图 + 向量混合数据库 | BSL 1.1 |
| [FastAPI](https://fastapi.tiangolo.com/) | 后端 Web 框架 | MIT |
| [Next.js](https://nextjs.org/) | 前端框架 | MIT |
| 豆包 / 火山引擎方舟 Ark | Seedance 视频、Seedream 图像、TTS | 商用 API 服务 |

> 开发过程中使用了 AI Coding 辅助工具，相关说明随项目文档一并提交。

---

## 📄 开源许可证

本项目采用 [MIT License](LICENSE) 开源。
