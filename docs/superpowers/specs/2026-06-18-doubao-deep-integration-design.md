# 豆包深度集成 + 多音色 + 前端 — 设计文档

> 软件杯 A03 · 分支 `feature/edu-loom-competition` · 子项目 A 的延伸(A2)

## 背景

子项目 A 已完成豆包底层接入层(`edu_loom/ai/doubao/`:TTS/视频/图像 client + 异步视频 command),smoke test 三类产物全部跑通(speech.mp3 / image.png / video.mp4)。

但底层 client 还没接进系统的实际功能。本阶段(A2)把豆包接入到用户可见的三处,并补齐多音色能力,目标是"豆包作为主模型,真正驱动播客音频":

1. 模型配置(API Keys)界面加入豆包 provider,排在最前。
2. 播客生成界面默认 TTS 显示并使用豆包。
3. 多音色:内置 8 个豆包 2.0 音色 + 自定义音色,在"单集生成"和"播客智能体(speaker profile)"两处均可选。

## 关键技术现实(已核实)

- 播客音频由外部库 **podcast-creator** 生成,其 `nodes.py` 通过 `esperanto.AIFactory.create_text_to_speech(provider, ...)` 按 `speaker_profile.tts_provider` 字符串选 TTS provider。
- **Esperanto 不支持豆包 TTS provider**。因此"豆包真正出声"必须解决 podcast-creator → 豆包 的桥接。
- speaker profile 现有结构:`voice_model`(选 TTS 模型,走 ModelSelector) + 每个 speaker 的 `voice_id`(当前是**手填文本框**,placeholder `voice_123`)。多音色 = 把 `voice_id` 从手填变为"下拉内置音色 + 自定义输入"。
- credential/model 系统:provider 列表硬编码在前端 `ALL_PROVIDERS`(`openai_compatible/deepseek/dashscope/ollama`)和后端 `key_provider.py` 的 `PROVIDER_CONFIG`。
- 豆包凭证当前在 `.env`(`ARK_API_KEY` / `DOUBAO_TTS_API_KEY` / 模型 ID / `DOUBAO_TTS_SPEAKER`)。

## 决策记录(brainstorm 结论)

- **Q1 = A(深度集成)**:豆包真正驱动播客音频,而非仅前端展示。
- **Q2 音色**:用下方内置 8 个 2.0 音色清单(均 `*_uranus_bigtts`,适合博客/播客旁白);支持自定义音色 ID 输入。

## 内置音色清单(豆包 2.0,`seed-tts-2.0`)

| 中文名 | voice_type ID |
|---|---|
| 爽快思思(默认) | `zh_female_shuangkuaisisi_uranus_bigtts` |
| 甜美小源 | `zh_female_tianmeixiaoyuan_uranus_bigtts` |
| Vivi | `zh_female_vv_uranus_bigtts` |
| 小何 | `zh_female_xiaohe_uranus_bigtts` |
| 知性灿灿 | `zh_female_cancan_uranus_bigtts` |
| 云舟(男) | `zh_male_m191_uranus_bigtts` |
| 小天(男) | `zh_male_taocheng_uranus_bigtts` |
| 暖阳女声(客服) | `zh_female_kefunvsheng_uranus_bigtts` |

清单来自公开文档镜像(非控制台热度排序);已排除短视频配音类(如"小猪佩奇"),全部为通用/对话/阅读类旁白音。清单集中定义在一处常量,后续可增删。

## 架构:豆包 TTS 如何驱动播客(A 方案核心)

**桥接策略:在豆包 TTS 节点拦截,不改 podcast-creator 源码。**

podcast-creator 的 TTS 走 `speaker_profile.tts_provider` + Esperanto。我们引入一个"豆包 TTS provider"标识,并在播客生成路径上把豆包语音段的合成改由 `DoubaoTTSClient` 完成:

- speaker profile 的 `voice_model` 选中"豆包 TTS 模型"时,`resolve_tts_config()` 解析出 `provider="doubao"`。
- 在 `commands/podcast_commands.py` 调 `create_podcast` 之前,检测 provider 是否为 `doubao`;若是,走我们自己的豆包音频生成路径(用 `DoubaoTTSClient.synthesize` 按 transcript 逐段合成 + 拼接),绕过 podcast-creator 内部的 Esperanto TTS;其余 provider 维持原 podcast-creator 流程。
- 每段语音用该 speaker 的 `voice_id`(= 选中的豆包音色 ID,如 `zh_female_vv_uranus_bigtts`)作为 `DoubaoTTSClient.synthesize(speaker=...)` 的音色参数。

这样豆包真正出声,且不 fork 外部库。封装为一个独立模块 `edu_loom/ai/doubao/podcast_tts.py`(职责:给定 transcript 段落 + 每段音色 → 调豆包 → 输出音频片段路径列表),可单测。

## 组件改动清单

### 后端

1. **`open_notebook/ai/key_provider.py`**:`PROVIDER_CONFIG` 加 `doubao`(env 映射到 `DOUBAO_TTS_API_KEY` / `ARK_API_KEY`)。
2. **`edu_loom/ai/doubao/voices.py`(新)**:内置音色清单常量 + 取用函数。
3. **`edu_loom/ai/doubao/podcast_tts.py`(新)**:豆包播客音频合成桥接,逐段合成+拼接,返回片段路径。
4. **`commands/podcast_commands.py`**:TTS provider 为 `doubao` 时走豆包桥接路径。
5. **API 端点**:新增 `GET /doubao/voices` 返回内置音色清单(供前端下拉)。放在 `api/routers/` 下新 router 或并入现有 models router。

### 前端

6. **`settings/api-keys/page.tsx`**:`ALL_PROVIDERS` 把 `doubao` 放在数组**第一位**(在 `openai_compatible` 之前);补 `PROVIDER_DISPLAY_NAMES` / `PROVIDER_MODALITIES`(doubao: language/text_to_speech)/ `PROVIDER_DOCS`。
7. **播客生成 / speaker profile 表单**:`voice_id` 手填框 → 音色选择器(下拉内置 8 音色 + "自定义"选项可手填任意 ID)。改动落在 `SpeakerProfileFormDialog.tsx`(profile 级,单集生成复用同组件/同选择器)。新建可复用 `VoiceSelector` 组件。
8. **i18n**:`zh-CN` / `en-US` 增补音色选择、豆包 provider 相关文案 key。

## 数据流

```
用户选音色(VoiceSelector, 内置/自定义)
  → speaker.voice_id = 音色ID 存入 speaker_profile
  → 生成播客时 podcast_commands 检测 tts_provider=doubao
  → podcast_tts.synthesize_transcript(transcript, voice_map)
  → DoubaoTTSClient.synthesize(text, speaker=voice_id) 逐段
  → 拼接为整段音频 → episode.audio_file
```

## 错误处理

- 豆包 TTS 段合成失败:记录该段错误,整体 job 失败并附原因(不静默吞掉),与现有播客失败处理一致(job 标 failed + error_message)。
- 音色 ID 非法(用户自定义乱填):豆包返回错误 → 包装为 `DoubaoError` 上抛,job failed。
- `/doubao/voices` 端点不依赖外部网络(返回本地常量),不会超时。

## 测试

- **`tests/test_doubao_podcast_tts.py`(新)**:mock `DoubaoTTSClient`,验证 transcript 逐段合成、音色映射、拼接、失败传播。
- **`tests/test_doubao.py`**:补 voices 清单的基本断言(数量、ID 格式均以 `_uranus_bigtts` 结尾)。
- 前端:VoiceSelector 渲染内置项 + 自定义切换(若现有前端测试框架就绪)。
- 验收:配置页见到豆包居首;新建 speaker profile 能下拉选音色;真实生成一期播客,音频为所选豆包音色发声。

## 不在本阶段范围(YAGNI)

- 把豆包语言模型(LLM)/视频/图像也接进 credential 系统的完整建模(本阶段聚焦 TTS 驱动播客 + 配置页可见;视频/图像留待子项目 C)。
- 音色试听(在线播放 sample)——后续可加。
- 控制台真实"热度排序"抓取(无法登录控制台;用内置清单)。
- 把豆包凭证从 `.env` 迁到数据库 credential 加密存储(本阶段配置页可填,但底层仍可读 `.env`;完整迁移后续做)。
