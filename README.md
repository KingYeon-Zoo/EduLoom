# EduLoom (学织)

EduLoom 是一款开源、本地优先、以用户隐私为核心的个性化学习资源生成与智能辅助系统。项目基于多智能体（Multi-Agent）协同架构与混合图-向量数据库构建，能够将复杂的输入材料（文档、网页等）自动转化为定制化的讲解文档、多角色音频播客、结构化思维导图以及针对性练习题库。

---

## 🌟 核心特性

- **🤖 多智能体协同 (LangGraph)**：基于 LangGraph 状态图设计并实现了多智能体协同工作流，智能体之间分工协作（如提纲起草、内容润色、剧本创作），协同生成高质量个性化资源。
- **🎙️ 多模态音频播客生成 (Podcast-Creator)**：集成 `podcast-creator` 引擎，一键将长文本输入转化为生动、口语化的多角色对话式讲解音频（播客），支持多角色声音配置及本地分批 TTS 合成。
- **🔒 本地优先与隐私安全**：支持与 Ollama 本地模型生态以及本地 SurrealDB 数据库无缝结合。API 密钥均在本地通过 Fernet (AES-128-CBC) 进行加密存储，保护敏感数据不外泄。
- **📁 混合图-向量存储 (SurrealDB)**：利用 SurrealDB 的向量搜索（Vector Search）及图关系检索（Graph Database）能力，高效管理知识点库、用户动态画像与资源关联。
- **🎨 现代交互前端**：基于 Next.js 与 React 构建的单页交互界面，支持流式 Markdown 输出、多模态卡片渲染以及完全自主控制的模型与密钥发现/管理。

---

## 🛠️ 技术栈

* **前端 (Frontend)**: Next.js (React), TailwindCSS, TypeScript, Lucide Icons
* **后端 (Backend)**: FastAPI (Python), LangChain, LangGraph, SurrealDB
* **异步任务**: Surreal-Commands (基于数据库的任务调度队列)

---

## 📂 项目结构

```text
├── edu_loom/               # Python 核心服务包
│   ├── ai/                 # 模型发现、连接测试与密钥安全机制
│   ├── database/           # SurrealDB 数据库操作与迁移
│   ├── domain/             # 系统核心领域模型
│   ├── graphs/             # LangGraph 智能体状态图定义
│   └── utils/              # 向量嵌入与文本分割工具
├── api/                    # FastAPI 路由、服务与路由端点
├── commands/               # Surreal-Commands 异步任务处理器 (如播客生成等)
├── frontend/               # Next.js 独立前端开发目录
├── run_api.py              # FastAPI 启动脚本
└── run-dev.sh              # 一键开发环境启动脚本
```

---

## 🚀 快速开始

本项目推荐使用高效的 `uv` 包管理器进行依赖安装和运行。

### 1. 准备依赖
- **Python**: `>= 3.10`
- **Node.js**: `>= 18`
- **SurrealDB**: 需在本地安装并配置。
  - macOS (Homebrew): `brew install surrealdb/tap/surreal`
  - Windows: `iwr -useb https://install.surrealdb.com | iex`
- **uv (推荐)**: 安装极速包管理器：
  ```bash
  curl -LsSf https://astral.sh/uv/install.sh | sh
  ```

### 2. 启动服务
我们提供了一键开发启动脚本，运行它将自动在后台启动数据库、后端服务和前端界面：

```bash
# 赋予脚本可执行权限并运行
chmod +x run-dev.sh
./run-dev.sh
```

该脚本将并行拉起以下服务：
- **SurrealDB 数据库**：监听端口 `8000`
- **FastAPI 后端服务**：监听端口 `5055`
- **Next.js 前端开发服务器**：监听端口 `3000`

启动完成后，请在浏览器中访问：**[http://localhost:3000](http://localhost:3000)**。

---

## 📖 配置指南

详细的使用与集成配置，请参阅以下官方文档：
- **[API 凭证配置指南](docs/3-USER-GUIDE/api-configuration.md)** —— 介绍系统密钥加密保存、连接测试及模型导入步骤。
- **[AI 服务商配置指南](docs/5-CONFIGURATION/ai-providers.md)** —— 密钥获取方法及推荐的大模型供应商列表。
- **[OpenAI 兼容接口配置指南](docs/5-CONFIGURATION/openai-compatible.md)** —— 如何接入本地的 LM Studio、vLLM 推理服务或其他兼容 OpenAI 标准的第三方中转 API。

---

## 📄 开源许可证

本项目采用 [MIT License](LICENSE) 许可协议开源。
