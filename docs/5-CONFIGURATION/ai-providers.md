# AI 服务商配置指南

本指南将为您介绍如何在 EduLoom 系统中通过**设置界面**配置各个 AI 服务商的 API 密钥及参数。

> **提示**：所有 AI 服务商凭证均已迁移至前端设置界面中进行可视化管理。为了保障系统安全，建议不要使用废弃的环境变量来直接硬编码 API 密钥。

---

## 凭证管理工作流

在 EduLoom 中启用一个 AI 服务商，通常包含以下几步：

1. **获取 API 密钥**：前往对应服务商的开放平台申请 API Key。
2. **添加凭据**：在系统内打开 **设置 (Settings)** → **API 密钥 (API Keys)** → 点击 **添加凭据 (Add Credential)**。
3. **测试连接**：保存凭据后，点击 **测试连接**，系统将自动验证接口是否畅通。
4. **发现并注册模型**：点击 **发现模型** 获取该服务商提供的可用模型列表，并勾选注册。注册成功后即可在聊天会话中直接调用。

> **前提条件**：在保存任何密钥前，您必须在 `docker-compose.yml` 中配置好 `OPEN_NOTEBOOK_ENCRYPTION_KEY` 环境变量（用于凭证的加密存储）。详情请参阅 [API 配置指南](../3-USER-GUIDE/api-configuration.md#加密设置)。

---

## 国内主流 AI 服务商（推荐）

### DeepSeek (深度求索)

国内极具性价比且性能强劲的 AI 模型服务商。

**获取 API 密钥：**
1. 访问 [DeepSeek 开放平台](https://platform.deepseek.com/) 注册并登录。
2. 导航至 API Keys 页面，创建一个新的 API 密钥。

**在 EduLoom 中配置：**
1. 前往 **设置** → **API 密钥**，点击 **添加凭据**。
2. 选择服务商：**DeepSeek**。
3. 填入凭证名称及您的 API 密钥。
4. 点击 **保存** 并 **测试连接**。
5. 点击 **发现模型** 并选择需要的模型进行 **注册**（如 `deepseek-chat` 或 `deepseek-reasoner`）。

---

### DashScope (阿里通义千问)

阿里云提供的模型服务平台，拥有非常出色的中文处理和长文本处理能力。

**获取 API 密钥：**
1. 访问 [阿里云百炼平台/DashScope 控制台](https://dashscope.console.aliyun.com/)。
2. 创建或登录您的阿里云账号，并开通 DashScope 服务。
3. 导航至 API-KEY 管理页面，创建并复制您的 API 密钥。

**在 EduLoom 中配置：**
1. 前往 **设置** → **API 密钥**，点击 **添加凭据**。
2. 选择服务商：**DashScope (Qwen)**。
3. 填入您的 API 密钥，保存并测试。
4. 点击 **发现模型** 并选择您需要的模型（如 `qwen-max`、`qwen-plus` 等）进行注册。

---

## 本地部署与自托管（免 API 密钥）

### Ollama (推荐本地运行)

非常适合在本地电脑上部署开源大模型，完全免费且保障隐私。

**安装与配置 Ollama：**
1. 下载并安装 [Ollama 官方客户端](https://ollama.com/)。
2. 启动 Ollama 服务。
3. 在终端中拉取您想要使用的模型（例如：`ollama pull qwen2.5` 或 `ollama pull llama3`）。

**在 EduLoom 中接入：**
1. 前往 **设置** → **API 密钥**，点击 **添加凭据**，选择 **Ollama**。
2. 输入您的 Ollama 服务地址 (Base URL)：
   - 若 EduLoom 在 Docker 中运行，且 Ollama 在宿主机上：`http://host.docker.internal:11434`
   - 若均为本地直接运行：`http://localhost:11434`
3. 保存并测试连接。
4. 点击 **发现模型**，系统会自动列出本地 Ollama 中已下载的所有模型，勾选并注册即可。

> **上下文窗口配置 (`num_ctx`)**：Ollama 默认的上下文窗口通常为 8192 token。如果您需要处理较长的文档，可以在编辑 Ollama 凭证时，在可选的“上下文窗口 (num_ctx)”字段里输入更大的值（例如 `32768`），系统在发起请求时会自动应用此设置。

---

## 国外主流 AI 服务商

### OpenAI

全球顶尖的 AI 模型服务商，支持文本、向量化、语音等多模态输入。

**获取 API 密钥：**
1. 访问 [OpenAI 开发者平台](https://platform.openai.com/) 并登录。
2. 前往 API Keys 页面创建新的密钥（以 `sk-proj-` 开头）。
3. 确保您的 OpenAI 账户中存有足够的余额。

**在 EduLoom 中配置：**
1. 前往 **设置** → **API 密钥**，点击 **添加凭据**。
2. 选择服务商：**OpenAI**。
3. 输入您的 API 密钥，保存并测试连接。
4. 发现并注册您需要的模型（如 `gpt-4o`、`gpt-4o-mini` 等）。

---

## 接入其他自定义或兼容平台

### OpenAI-Compatible (OpenAI 兼容接口)

如果您使用的是其他第三方中转 API、本地的 LM Studio、vLLM 或 LocalAI 等工具，可以通过此选项进行灵活配置。

1. 在 **添加凭据** 中选择 **OpenAI-Compatible**。
2. 填入目标的 API 基础地址（Base URL），例如 `https://api.your-provider.com/v1` 或本地的 `http://localhost:1234/v1`。
3. 填入 API 密钥（如无需密钥则可填写任意占位符）。
4. 保存并测试连接，进行模型自动发现与注册。

具体配置详情及 Docker 网络调试方法，请参阅 **[OpenAI 兼容接口配置](openai-compatible.md)**。

---

## 常见选择建议

1. **希望设置最简单，且需要极高的中文理解和逻辑推理能力：**
   - 推荐使用 **DeepSeek**（性价比极高，中文推理效果拔群）或 阿里 **DashScope (Qwen)**。
2. **由于网络或隐私原因，不希望任何数据上传至公网：**
   - 推荐在本地电脑运行 **Ollama**（运行 Qwen、Llama 等开源模型），所有数据在本地处理，完全免费。
3. **已拥有成熟的第三方大模型 API 中转或自建的推理集群：**
   - 推荐使用 **OpenAI-Compatible**，可自由配置 LLM、Embedding、语音合成等服务的独立端点。

---

## 关联文档
- **[API 凭证配置指南](../3-USER-GUIDE/api-configuration.md)** —— 系统凭证加密、添加及测试的详细步骤说明
- **[OpenAI 兼容接口配置](openai-compatible.md)** —— 如何接入 LM Studio、vLLM 等本地或自定义服务
