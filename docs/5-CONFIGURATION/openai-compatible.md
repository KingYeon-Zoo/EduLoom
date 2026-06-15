# OpenAI 兼容接口配置指南

EduLoom 允许您接入任何实现了 OpenAI 标准 API 格式的自建模型服务器或第三方 API，例如 LM Studio、vLLM、Text Generation WebUI 等。

---

## 什么是 OpenAI 兼容接口？

大多数现代大模型工具和平台都实现了与 OpenAI 标准一致的 API 路由结构：

```
POST /v1/chat/completions   (对话接口)
POST /v1/embeddings         (向量化接口)
POST /v1/audio/speech       (语音合成 TTS)
```

EduLoom 可以直接无缝对接任意采用此格式的 API 端点。

---

## 常见的兼容模型服务器

| 服务器名称 | 适用场景 | 官方网站/开源地址 |
|--------|----------|-----|
| **LM Studio** | 带有图形界面的本地模型运行工具（推荐个人桌面端使用） | [lmstudio.ai](https://lmstudio.ai) |
| **vLLM** | 高性能、吞吐量极佳的生产级大模型推理框架 | [GitHub vLLM](https://github.com/vllm-project/vllm) |
| **Text Generation WebUI** | 功能全面的本地推理 Web 界面 | [GitHub WebUI](https://github.com/oobabooga/text-generation-webui) |
| **Ollama** | 极简的本地模型管理工具 | *(建议使用 EduLoom 原生的 Ollama 凭证配置)* |
| **llama.cpp** | 轻量化的本地推理服务，资源占用低 | [GitHub llama.cpp](https://github.com/ggerganov/llama.cpp) |

---

## 快速上手：LM Studio 接入指南

### 第一步：安装并启动 LM Studio

1. 从官方网站 [lmstudio.ai](https://lmstudio.ai) 下载并安装适用于您系统的版本。
2. 启动 LM Studio 并搜索下载一个模型（例如 `Qwen2.5`）。
3. 导航到 **Local Server** 标签页，并点击 **Start Server** 按钮（默认运行在本地的 `1234` 端口）。

### 第二步：在 EduLoom 设置界面进行配置（推荐）

1. 打开 EduLoom 系统，前往 **设置 (Settings)** → **API 密钥 (API Keys)**。
2. 点击 **添加凭据 (Add Credential)** → 在下拉列表中选择 **OpenAI-Compatible**。
3. 填写 **Base URL (基础 API 地址)**：
   - 如果您使用的是 Docker 容器版 EduLoom，且 LM Studio 运行在宿主机上，请填写：`http://host.docker.internal:1234/v1`
   - 如果您是本地非 Docker 方式直接运行，请填写：`http://localhost:1234/v1`
4. 填写 **API Key**：LM Studio 默认不需要密钥，可填入 `lm-studio` 作为占位符。
5. 点击 **保存 (Save)** 之后，点击 **测试连接 (Test Connection)**。

### 第三步：注册并导入模型

1. 前往 **设置** → **模型管理**（或在当前的凭证卡片上点击 **发现模型**）。
2. 添加您的自定义模型：
   - **Provider (服务商)**：选择 `openai_compatible`
   - **Model Name (模型名称)**：输入您在 LM Studio 中加载的模型的**精确标识符**
   - **Display Name (显示名称)**：设置一个友好的名字（例如 `LM Studio - Qwen 7B`）
3. 保存后，即可在聊天中选择并使用该模型。

---

## 针对 Docker 容器的网络配置说明

当 EduLoom 运行在 Docker 容器中，而您的兼容接口服务器运行在宿主机上时，请使用正确的 Base URL 格式：

### macOS / Windows
- **Base URL**: `http://host.docker.internal:端口号/v1`

### Linux
- **方案 A (Docker Bridge 网桥 IP)**: `http://172.17.0.1:端口号/v1`
- **方案 B (主机网络模式)**: 使用 `docker run --network host ...` 启动 EduLoom，然后在配置里直接使用 `http://localhost:端口号/v1`

---

## vLLM 部署与对接示例

### 1. 启动 vLLM 模型服务

```bash
python -m vllm.entrypoints.openai.api_server \
  --model Qwen/Qwen2.5-7B-Instruct \
  --port 8000
```

### 2. 在 EduLoom 中配置

在 **设置** → **API 密钥** 中，添加 **OpenAI-Compatible** 凭证：
- **Base URL**: `http://localhost:8000/v1` (如在 Docker 容器中运行则调整为对应的容器间网络名或网关 IP)。
- 测试连接并进行模型发现。

---

## 多端点独立配置支持

您可以为不同的服务（如对话模型、Embedding 向量化、TTS 语音合成等）配置完全不同的自定义接口地址。

在添加 **OpenAI-Compatible** 凭证时，您可以选择性展开服务详情，为每个服务指定单独的 API 地址：
- **LLM Base URL**: 例如 `http://localhost:1234/v1` (用于对话聊天)
- **Embedding Base URL**: 例如 `http://localhost:8080/v1` (使用专门的向量模型服务)
- **TTS Base URL**: 例如语音合成端点地址
- **STT Base URL**: 例如语音转文字端点地址

如果不单独配置，系统将默认采用您填写的统一 **Base URL**。

---

## 常见问题与解决方案 (Troubleshooting)

### 1. 提示 "Connection Refused (拒绝连接)"
- **检查项**：请确认您的模型服务器已成功启动并正在监听正确的端口。
- **Docker 场景**：在 Docker 容器内部无法通过 `localhost` 访问宿主机的服务，请确认已使用 `host.docker.internal` 或正确的宿主机内网 IP。

### 2. 提示 "Model Not Found (未找到模型)"
- **检查项**：某些第三方接口在发起对话请求时，必须在 `model` 参数中带上精确的名称。请确认您在 EduLoom 注册该模型时填写的 **Model Name** 与模型服务器暴露的名称完全一致（可以通过访问 `http://localhost:端口/v1/models` 进行查询）。

---

## 关联文档
- **[AI 服务商配置](ai-providers.md)** —— 常见大模型服务商的密钥获取方法与推荐机型
- **[API 凭证配置指南](../3-USER-GUIDE/api-configuration.md)** —— 系统凭证加密、添加及测试的详细步骤说明
