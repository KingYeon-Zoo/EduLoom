# API 配置指南

您可以通过系统的前端设置界面（Settings UI）来配置 AI 服务商的凭证，无需手动编辑任何配置文件。

> **凭证系统说明**：EduLoom 使用加密的凭证并将其安全地存储在数据库中。每个凭证对应一个 AI 服务商，使您能够自动发现、注册并测试相关的模型。

---

## 概述

EduLoom 通过**凭证系统**管理对各大 AI 服务商的访问：

1. 您可以为每个服务商创建一个**凭证**（包含 API 密钥与相关配置）
2. 凭证会在数据库中被**加密**存储
3. 您可以**测试连接**以验证凭证的有效性
4. 您可以从每个凭证中**自动发现并注册模型**
5. 注册后的模型将与凭证绑定，可供您在系统中直接调用

---

<a id="encryption-setup"></a>
## 加密设置

在存储任何 API 凭证之前，您必须配置一个主加密密钥。

### 设置加密密钥

在您的 `docker-compose.yml` 中添加 `OPEN_NOTEBOOK_ENCRYPTION_KEY` 环境变量：

```yaml
environment:
  - OPEN_NOTEBOOK_ENCRYPTION_KEY=your-secret-passphrase
```

任何字符串都可以作为密钥 —— 系统内部会使用 SHA-256 安全地派生实际的加密密钥。

> **警告**：如果您更改或丢失了此加密密钥，**所有已存储的 API 凭证都将无法读取并失效**。请务必安全地备份您的加密密钥，并将其与数据库备份分开存放。

### 支持 Docker Secrets

密码和加密密钥均支持通过 Docker Secrets 进行配置：

```yaml
# docker-compose.yml
services:
  edu_loom:
    environment:
      - OPEN_NOTEBOOK_PASSWORD_FILE=/run/secrets/app_password
      - OPEN_NOTEBOOK_ENCRYPTION_KEY_FILE=/run/secrets/encryption_key
    secrets:
      - app_password
      - encryption_key

secrets:
  app_password:
    file: ./secrets/password.txt
  encryption_key:
    file: ./secrets/encryption_key.txt
```

### 加密技术细节

存储在数据库中的 API 密钥采用 Fernet（AES-128-CBC + HMAC-SHA256）算法进行加密。

| 配置状态 | 行为表现 |
|---------------|----------|
| 已设置加密密钥 | API 密钥将被安全加密后存入数据库 |
| 未设置加密密钥 | 系统将禁用存储凭证功能 |

---

## 进入凭据配置界面

1. 点击左侧导航栏中的 **设置 (Settings)**
2. 选择 **API 密钥 (API Keys)** 标签页
3. 您将在此处看到现有凭证，并可以通过点击 **添加凭据 (Add Credential)** 按钮来添加新凭证

```
导航路径：设置 → API 密钥
```

---

## 支持的服务商

### 云端服务商

| 服务商 | 必填字段 | 选填字段 |
|----------|-----------------|-----------------|
| OpenAI | API Key | — |
| DeepSeek | API Key | — |
| DashScope (通义千问) | API Key | — |

### 本地/自托管

| 服务商 | 必填字段 | 备注说明 |
|----------|-----------------|-------|
| Ollama | Base URL | 通常为 `http://localhost:11434` 或 `http://ollama:11434` |

### 企业级与自定义

| 服务商 | 必填字段 | 选填字段与备注 |
|----------|-----------------|-----------------|
| Azure OpenAI | API Key, URL Base | 特定服务的端点（LLM, Embedding, STT, TTS） |
| OpenAI-Compatible | Base URL | API Key, 各项服务的特定配置 |

---

## 创建凭据步骤

### 第一步：添加凭据

1. 前往 **设置** → **API 密钥**
2. 点击 **添加凭据** 按钮
3. 选择您想配置的 AI 服务商
4. 为该凭据起一个易懂的名字（例如：“我的 OpenAI 密钥”、“开发环境 DeepSeek”）
5. 填写对应的必填字段（API 密钥、基础 URL 等）
6. 点击 **保存**

### 第二步：测试连接

1. 在新创建的凭证卡片上，点击 **测试连接 (Test Connection)**
2. 等待连接测试结果：

| 测试结果 | 说明 | 解决方案 |
|--------|---------|---|
| **成功 (Success)** | 密钥有效，且能正常连接到该服务商 | 无需处理，即可进行下一步 |
| **无效的 API 密钥** | API 密钥格式或内容错误 | 请检查并重新复制密钥 |
| **连接失败** | 无法访问服务商的 API 地址 | 请检查网络、防火墙、或 Base URL 配置 |

### 第三步：自动发现模型

1. 点击凭证卡片上的 **发现模型 (Discover Models)**
2. 系统将向对应的 API 端点发送查询请求，获取可用的模型列表
3. 在弹出的对话框中浏览并确认获取到的模型

### 第四步：注册模型

1. 勾选您希望在系统里启用的模型
2. 点击 **注册模型 (Register Models)**
3. 这些模型即成功注册，并可在 EduLoom 的各个会话和工作流中直接选择使用

---

## 多凭据支持

EduLoom 允许您为同一个 AI 服务商配置**多个凭据**。这在以下场景非常实用：
- 不同的项目使用不同的 API 密钥和计费账号
- 需要测试同一个服务商下的不同自定义 API 端点
- 多个团队成员需要独立的凭证进行隔离

### 如何创建并关联

- 您只需再次点击 **添加凭据**，选择相同的服务商，并填入不同的 API 密钥即可。
- 每个模型都与发现它的凭证相绑定。如果删除凭证，与之关联的所有已注册模型也将自动从系统模型列表中移除。

---

## 针对特定服务商的配置建议

### 简单服务商（仅需 API 密钥）

对于 OpenAI、DeepSeek、DashScope 等服务商：
1. 填入 API 密钥并保存凭据。
2. 测试连接。
3. 发现并注册您所需的模型。

### Ollama（本地运行）

1. 在凭证页面选择 **Ollama**。
2. 输入您的本地 Ollama 服务地址（例如：`http://host.docker.internal:11434` 或 `http://localhost:11434`）。
3. 测试连接、发现并注册模型。
*(注意：请确保本地 Ollama 服务已启动，且已提前拉取过对应模型，如 `ollama pull qwen2.5`)*

### OpenAI-Compatible (自定义 OpenAI 兼容接口)

对于 LM Studio、vLLM、或其他提供 OpenAI 格式接口的第三方大模型 API：
1. 在凭据页面选择 **OpenAI-Compatible**。
2. 输入其 API 基础路径 (Base URL)，例如 `http://localhost:1234/v1`。
3. 填入 API 密钥（如无需密钥，可填入任意占位符如 `not-needed`）。
4. （可选）为 LLM（对话）、Embedding（向量）、TTS（语音合成）、STT（语音识别）配置各自独立的端点。

---

## 从环境变量迁移 (如果您之前配置过)

如果您曾在旧版本的环境变量中直接指定过 API 密钥：

1. 打开 **设置 → API 密钥**
2. 页面顶部会显示一个提示横幅：“检测到环境变量”
3. 点击 **迁移到数据库 (Migrate to Database)**
4. 这些密钥将被安全地加密并导入数据库凭证中
5. 导入完成后，您可以安全地将旧环境变量从 `docker-compose.yml` 中删去。请务必保持 `OPEN_NOTEBOOK_ENCRYPTION_KEY` 环境变量的设置。

---

## 安全与存储

### 加密机制

EduLoom 数据库中的敏感字段（如 API Key）全部经过 Fernet 加密。若未设置 `OPEN_NOTEBOOK_ENCRYPTION_KEY` 环境变量，数据库加密功能将无法启用，系统也无法保存凭证。

### 默认账户安全

在生产环境部署时，建议通过 `OPEN_NOTEBOOK_PASSWORD` 环境变量为系统设置复杂的自定义访问密码，替换默认的密码以防未授权访问。

---

## 常见问题排查 (Troubleshooting)

### 凭证无法保存
- **原因 1**：没有填写完整必填字段。请检查输入。
- **原因 2**：后台容器未配置 `OPEN_NOTEBOOK_ENCRYPTION_KEY`。请在您的 `docker-compose.yml` 中配置该环境变量并重启容器。

### 测试连接失败
- **原因 1**：API 密钥不正确或余额不足。请前往服务商后台确认。
- **原因 2**：国内访问限制或代理网络不通。如果您在容器内运行，请确保容器具有外网访问权限，或者配置了适当的 HTTP 代理。

---

## 关联文档
- **[AI 服务商配置](../5-CONFIGURATION/ai-providers.md)** —— 常见大模型服务商的密钥获取方法与推荐机型
- **[OpenAI 兼容接口配置](../5-CONFIGURATION/openai-compatible.md)** —— 如何接入 LM Studio、vLLM 等本地或自定义服务
