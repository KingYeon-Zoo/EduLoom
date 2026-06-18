# 豆包音视频理解（全模态 source 摄取）— 设计文档

日期：2026-06-18
状态：已通过 brainstorm，待 review

## 背景

`source.py` 的 `content_process` 节点把所有内容摄取交给 content-core。content-core 处理音频时走 `AIFactory.create_speech_to_text(...).atranscribe()`，只返回 `.text`——这是一个纯 STT 契约（音频→逐字稿）。

豆包 `seed-2.0-lite`（`doubao-seed-2-0-lite-260428`）是全模态理解模型，官方支持文本/图像/音频/视频四种输入，含 19 语种语音转写 + 跨模态理解。把它硬塞进 content-core 那个只吐 `.text` 的 STT 接口，会把全模态优势降级成普通 whisper。

因此本设计**不复用** STT 槽位，而是在摄取阶段拦截音视频文件，直接喂给豆包，返回带理解的文本。

## 产品决策（brainstorm 结论）

- 用户会上传音视频文件（mp3/mp4/播客/无字幕视频）作为学习资源（source）。
- 必须用豆包做，统一到豆包一个家族。
- 输出形态：**转写 + 理解混存一份**——豆包返回的「逐字转写 + 内容理解」整段写入 `source.full_text`，下游检索/问答/摘要直接消费。不单独拆出 insight。
- 接口路线：**chat/completions + base64**——本地文件读字节直接编码，零对象存储依赖。
- 视频处理：**音轨 + 关键帧采样**——抽音轨给语音、均匀抽帧给视觉，在一个请求里联合理解。不整段喂视频（base64 会撑爆请求体）。

## 关键技术现实（已核实）

- `seed-2.0-lite` 官方支持音频输入与全模态理解。来源：[seed-2.0-lite 全模态升级](https://developer.volcengine.com/articles/7636596381943070763)、[音频理解文档](https://www.volcengine.com/docs/82379/2377589)。
- chat/completions 接受 `data:` base64 前缀；Responses API 拒绝 `data:` 前缀、需要公网 URL。来源：[eino-ext PR #819](https://github.com/cloudwego/eino-ext/pull/819) 的代码审查记录。
- content-core 音频转录通过 `AIFactory.create_speech_to_text` + `atranscribe()`，只返回 `.text`。见 `.venv/.../content_core/processors/audio.py`。
- ffmpeg 已是 content-core 的依赖，运行环境大概率已安装（实现时确认一次）。

**唯一未验证点**：`doubao-seed-2-0-lite-260428` 在 chat/completions 下确实接受 base64 的 `input_audio` part 与 image part。实现的第一步必须用真 `ARK_API_KEY` 烟测验证；不通则当场暴露，回头评估 TOS + Responses API 路线。

## 架构与定位

```
用户上传 mp3/mp4/...           source.py content_process()
        │                              │
        ▼                              ▼
   API 存文件 ──► source_id ──► ┌─ 是音视频文件? ─┐
                                │                  │
                          是 ▼                  ▼ 否
                  ┌──────────────────┐   ┌─────────────────┐
                  │ DoubaoAudioClient │   │ content-core    │
                  │ 采样→base64       │   │ extract_content │
                  │ chat/completions  │   │ (PDF/URL/文本)  │
                  │ input_audio+帧    │   └─────────────────┘
                  │ +理解prompt       │           │
                  └──────────────────┘           │
                          │                       │
                          └──► 转写+理解文本 ◄────┘
                                    │
                                    ▼
                       content_state.content → save_source
                       → source.full_text → 向量化/问答/摘要
```

**设计原则**：豆包音频路径不实现 esperanto 的 `SpeechToTextModel` 接口（只吐 `.text`，会丢理解层），而是作为独立能力客户端直接调用——对称于现有的 `video.py` / `image.py` / `tts.py`。

## 组件改动清单

### 新增

**`edu_loom/ai/doubao/audio.py`** — `DoubaoAudioClient`，doubao 模块下第四个能力客户端。

```python
@dataclass
class AudioResult:
    text: str          # 豆包返回的转写+理解文本
    model: str         # 实际使用的模型ID

class DoubaoAudioClient:
    def __init__(self, config: DoubaoConfig | None = None): ...

    async def understand(
        self,
        media_path: str | Path,
        prompt: str | None = None,
    ) -> AudioResult:
        """读本地音视频文件 → 采样 → base64 → chat/completions → 转写+理解文本。"""
```

内部流程：
1. 按扩展名判定音频还是视频。
2. 音频：ffmpeg 统一转 mp3 16k mono → base64。
3. 视频：ffmpeg 抽音轨（同上）+ 均匀抽关键帧（≤16 帧）→ 各自 base64。
4. 组 `messages`：一个 `input_audio` part（`data` + `format`）+ 视频时附 N 个 image part + 一个 text part（理解指令 prompt）。
5. 调 Ark `/chat/completions`，模型用 `config.llm_model`（已是 `doubao-seed-2-0-lite-260428`）。
6. 取 `choices[0].message.content` 返回。

默认 prompt（对应「转写+理解混存」）：一句中文指令，要求模型先完整转写音频内容、再补一段对内容的理解/要点，合成一段适合作学习资料正文的文本。措辞放模块常量，可调。

配置复用现有 `DoubaoConfig`，不新增环境变量——音频理解与 LLM 共用 `ARK_API_KEY` + `llm_model`。

**`scripts/doubao_audio_smoke_test.py`** — 手动烟测，用真凭证验证 chat/completions 接受 base64 `input_audio` + image part。不进 pytest（花钱）。

### 修改

**`edu_loom/graphs/source.py`** 的 `content_process`：在调 content-core 之前，判断 `content_state` 的文件路径是否音视频；是则走 `DoubaoAudioClient.understand()`，把返回文本写入 `content_state.content` 并跳过 content-core；否则维持原逻辑。

## 采样参数（模块常量，可调）

- 抽帧：均匀采样，默认上限 16 帧（无论视频多长都均匀取，不截断）。
- 音轨：统一转 mp3 16k mono（对齐主流做法，压体积）。
- 纯音频文件：只走 `input_audio`，不抽帧。

## 文件类型判定

模块常量集中维护扩展名清单：
- 音频：`.mp3 .wav .m4a .aac .flac .ogg`
- 视频：`.mp4 .mov .mkv .webm .avi`

命中走豆包，否则走 content-core。

## 上传限制（兜底安全网）

- 前端 + 后端双重校验：单文件大小上限、视频时长上限。
- 即使在限制内仍走采样而非整段——限制只防极端情况撑爆 base64 请求体，不是主防线。

## 数据流

1. API 接收上传，存文件，建 source 占位，触发 `source_graph`。
2. `content_process` 判定音视频 → `DoubaoAudioClient.understand()` → 采样 + base64 + chat/completions → 转写+理解文本。
3. 文本写入 `content_state.content`。
4. `save_source` 把 `content_state.content` 存入 `source.full_text`，按现有逻辑向量化。
5. 下游问答/检索/摘要消费 `full_text`，与其他来源一致。

## 错误处理

沿用仓库 `classify_error` 模式（见 `graphs/CLAUDE.md`）。`DoubaoAudioClient` 内部抛 `DoubaoError` 子类（复用 `exceptions.py`）；`content_process` 捕获后用 `classify_error` 转用户友好消息。明确区分：

- ffmpeg 缺失 → 提示安装 ffmpeg。
- 文件损坏/无音轨 → 提示文件不可用。
- API 调用失败（鉴权/限流/模型不存在）→ 经 `classify_error` 映射为对应 `OpenNotebookError` 子类。

## 测试

- 单测：mock Ark 客户端，对齐 `tests/test_doubao.py` 现有风格。验采样逻辑（帧数上限、音频格式归一）、请求组装（content 数组结构）、错误分类。不发真请求。
- 手动烟测：`scripts/doubao_audio_smoke_test.py` 用真凭证验证端到端，含 base64 `input_audio` 与 image part 是否被 seed-2.0-lite 接受。

## 实现顺序

1. **先跑烟测**验证 base64 `input_audio` + image part 被接受（地基，不通则停下评估 TOS 路线）。
2. 实现 `DoubaoAudioClient`（音频路径 → 视频采样 → 请求组装）。
3. 改 `content_process` 接入。
4. 单测 + 上传限制校验。

## 不在本阶段范围（YAGNI）

- 拆分 insight（已选混存一份）。
- 复用/实现 esperanto `SpeechToTextModel` 适配器。
- TOS 对象存储 + Responses API 路线（仅在烟测证明 base64 不可行时回退）。
- 音频分段转写（超长文件）：先设保守上限、超限报清晰错误，分段作后续增强。
