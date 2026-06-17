# 子项目 A:豆包模型接入层 — 设计文档

> 软件杯 A03 赛题改造 · 总特性分支 `feature/edu-loom-competition` · 第一个子项目

## 背景与上下文

当前项目 `edu_loom`(基于 open-notebook 改造)是一个 NotebookLM 克隆:Next.js + FastAPI + SurrealDB 三层架构,已有来源上传、embedding、语义检索、RAG 对话、笔记、播客(音频概览)等功能。AI 能力统一走 Esperanto 多 provider 库 + 数据库 credential 系统,模型类型仅有 `language / embedding / speech_to_text / text_to_speech`。

赛题要求生成多模态学习资源,其中**视频概览为必做**,并需 **TTS** 支撑音视频配音。用户已确定使用**豆包(火山引擎方舟 Ark)**作为视频生成、图像生成与 TTS 模型。

本子项目(A)是整个赛题改造的前置基础设施:打通豆包三类能力(TTS / 视频 / 图像)的后端调用,供后续子项目 C(资源生成器)直接复用。

## 整体子项目拆分(背景)

本次大改拆为 5 个子项目,各自独立走 spec → plan → 实现:

- **A. 豆包模型接入**(本文档)— 一切的前置
- **B. 对话式学习画像**(赛题①,≥6 维,随学随新)
- **C. 资源生成器集合**(赛题②,≥5 种,含视频概览;把现有播客重构为其中一个;挂到薄 Coordinator + 角色 agent 命名体系下)— 依赖 A
- **D. 学习路径规划与推送**(赛题③)— 依赖 B + C
- **E. 智能辅导 + 学习效果评估**(加分④⑤)— 依赖 B + C + D

关于"多智能体":不建重型编排框架(消息总线/注册中心等属过度工程)。采用折中路线——**实现从简,但显式可见地多智能体化**:保留一层很薄的 Coordinator + 命名清晰的角色 agent,使"多智能体协作"在 UI 和文档架构图中可见,以满足赛题"须体现多智能体架构"的硬性评分项。该折中在子项目 C 落地,A 不涉及。

## 关键技术事实(已核实)

经 context7 查证火山引擎官方 Python SDK `volcenginesdkarkruntime`:

- 提供 `ArkRuntime` / `AsyncArk` 客户端。
- **视频/图像生成是异步任务制**:`content_generation.tasks.create(model=, content=, ...)` 返回 task_id → 轮询 `tasks.get(task_id)` 直到终态 → 拿到产物 URL。与 Esperanto"一次调用返回"的抽象不兼容。
- **图像**亦支持 `images.generate(model=, prompt=, size=, ...)`。
- **TTS** 为豆包独立语音合成接口。
- SDK 自带 `wait_for_processing(id, poll_interval, max_wait_seconds)` 轮询范式(默认超时 10 分钟,终态集合 `{active, failed}`)。

结论:豆包视频/图像无法塞进 Esperanto,需新建独立接入层;接入层天然适配现有 surreal-commands 异步任务队列(播客即用此机制)。

## 决策记录(brainstorm 结论)

1. **接入方式**:方案 1 — 新建独立 `edu_loom/ai/doubao/` 接入层,直接用官方 `volcenginesdkarkruntime` SDK,绕开 Esperanto。视频/图像的"提交→轮询"接现有 job 队列。
2. **本期范围**:范围选项 1 — A 子项目 = 纯基础设施层。封装三个 client + 配置 + 异步 command,用测试脚本验收(图像/视频/语音各产出一个产物文件)。**前端不动**;设置页可视化配置留待后续统一做。
3. **凭证**:本期从 `.env` 读取(pydantic 校验),不接数据库 credential 系统。
4. **多智能体折中**:接受"薄 Coordinator + 角色 agent 命名",但在 C 落地,A 不涉及。

## 模块结构与职责边界

新建 `edu_loom/ai/doubao/`:

```
edu_loom/ai/doubao/
├── __init__.py        # 导出三个 client + 异常
├── config.py          # 读取并校验 Ark API Key / base_url / 模型 ID(从 .env)
├── client.py          # ArkRuntime 客户端工厂(同步+异步),统一鉴权与重试
├── tts.py             # DoubaoTTSClient.synthesize(text, voice) -> 音频文件路径
├── video.py           # DoubaoVideoClient.create_task(...) / poll(task_id) -> 视频 URL
├── image.py           # DoubaoImageClient.generate(prompt, size) -> 图像 URL/文件
└── exceptions.py      # DoubaoError / DoubaoTaskFailed / DoubaoTimeout,映射 Ark 错误码
```

每个 client 的契约:

- **输入**:纯 Python 参数(文本、prompt、voice、分辨率等),不依赖 FastAPI / SurrealDB。
- **输出**:本地产物文件路径或远端 URL + 元数据(task_id、耗时、用量)。
- **依赖**:仅依赖 `config.py` 拿到的凭证 + 官方 SDK。

设计目标:三个 client 可脱离整个系统单独测试;子项目 C 直接 `from edu_loom.ai.doubao import DoubaoVideoClient`。

## 视频/图像异步任务接入 job 队列

豆包视频/图像为任务制(提交 → 轮询数十秒至数分钟 → 取结果),对应现有 surreal-commands 异步任务队列(播客同机制)。两层分工:

- **Client 层(`video.py` / `image.py`)**:只懂"调豆包"。提供 `create_task()` 返回 Ark task_id,`poll(task_id)` 返回状态/结果 URL。无状态、可单测,不碰数据库。
- **Command 层(`commands/doubao_commands.py`)**:新建,套用 `commands/podcast_commands.py` 模式。一个 `@command` 函数负责:调 `create_task` → 循环 `poll` 至完成 → 下载产物到 `data/doubao/<task_id>/` → 返回产物路径。耗时阻塞均发生在 worker 进程,不卡 API。

分层理由:轮询可能耗时数分钟,必须在后台 worker 跑(job 队列的意义);client 保持无状态可单测,编排交给 command 层——与播客中 client 被库调用的分层哲学一致。

## 凭证配置(本期从简,放 `.env`)

```
ARK_API_KEY=xxx                      # 火山方舟 API Key
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
DOUBAO_TTS_MODEL=xxx                 # TTS 模型/音色 endpoint
DOUBAO_VIDEO_MODEL=...-seedance-...  # Seedance 视频模型 ID
DOUBAO_IMAGE_MODEL=...-seedream-...  # Seedream 图像模型 ID
```

`config.py` 用 pydantic 读取并校验,缺 key 时给出清晰报错。`.env.example` 同步补充上述键(占位值)。

## 错误处理

- `exceptions.py` 定义 `DoubaoError` / `DoubaoTaskFailed` / `DoubaoTimeout`,把 Ark SDK 抛出的异常和错误码包装为项目内统一异常。
- 视频/图像轮询设超时上限(默认 10 分钟,与 SDK `wait_for_processing` 一致),超时抛 `DoubaoTimeout`;command 层捕获后将 job 标记为 failed。
- 网络/限流错误:client 内做有限次重试(指数退避),仍失败则上抛。

## 验收测试(A 期"完成"的判定标准)

`tests/test_doubao.py`,分两档:

1. **单元测试(默认跑)**:mock Ark SDK,验证参数拼装、轮询逻辑、超时、异常映射正确。
2. **集成测试(标记 `@pytest.mark.integration`,需真 key 手动跑)**:`scripts/doubao_smoke_test.py` 真实生成图像/视频/语音各一个,确认产物文件落地到 `data/doubao/`。

**A 期验收 = 单测全绿 + 用户本地用真 key 跑一次 smoke test,看到三个产物文件。**

## 不在本期范围(YAGNI)

- 设置页可视化配置豆包 provider(留待后续统一做)。
- 把豆包接入数据库 credential 系统(本期用 `.env`)。
- 任何生成 UI / 演示界面(属子项目 C)。
- 把豆包语言模型作为 language provider 接入(本期不接 LLM)。
