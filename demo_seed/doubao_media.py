"""全豆包真实生成媒体资源：PPT(Seedream图像) / 视频(Seedance) / 播客(豆包TTS)。

不做任何本地合成，全部走真实豆包接口，与系统生产管线一致：
  * PPT  : LLM 生成分镜提示词 -> 豆包 Seedream 出图 -> python-pptx 打包 .pptx
  * 视频 : LLM 生成视频提示词 -> 豆包 Seedance 文生视频 mp4
  * 播客 : podcast-creator(豆包 LLM 出大纲/脚本 + 豆包 TTS 出语音) -> 拼接音频
"""

from __future__ import annotations

import time
from pathlib import Path
from typing import List

from loguru import logger

STUDIO_DIR = Path("data/studio")


def _restore_tts_key():
    """确保豆包 TTS 使用正确的 openspeech key，且不被 credential 的 ARK key 覆盖。

    根因：key_provider._provision_simple_provider('doubao') 在每次创建豆包模型时
    会把 credential 表里的 ARK key 写进 DOUBAO_TTS_API_KEY，而 TTS 用的是独立的
    openspeech key（非 ark- 开头）。播客生成时 outline/transcript LLM 先触发
    provision 覆盖了 key，导致随后的 TTS 401。

    修复：(1) 从 .env 恢复真实 TTS key；(2) monkeypatch provision，使其之后
    永远不再用 ark- 开头的 key 覆盖 DOUBAO_TTS_API_KEY。
    """
    import os
    from dotenv import dotenv_values

    vals = dotenv_values(".env")
    real = (vals.get("DOUBAO_TTS_API_KEY") or "").strip()
    if real and not real.startswith("ark-"):
        os.environ["DOUBAO_TTS_API_KEY"] = real

    # monkeypatch：包裹 _provision_simple_provider，调用后恢复正确的 TTS key
    from open_notebook.ai import key_provider as _kp

    if not getattr(_kp, "_tts_key_guarded", False) and real and not real.startswith("ark-"):
        _orig = _kp._provision_simple_provider

        async def _guarded(provider: str):
            result = await _orig(provider)
            cur = os.environ.get("DOUBAO_TTS_API_KEY", "")
            if cur.startswith("ark-") or not cur:
                os.environ["DOUBAO_TTS_API_KEY"] = real
            return result

        _kp._provision_simple_provider = _guarded
        _kp._tts_key_guarded = True
        logger.info("已加固豆包 TTS key，防止 credential 的 ARK key 覆盖")


# ---------------------------------------------------------------------------
# PPT：豆包 Seedream 真实出图
# ---------------------------------------------------------------------------
async def generate_ppt_real(artifact_id: str, system_prompt: str, content: str,
                            num_images: int, size: str, instructions=None) -> List[str]:
    """复刻 generate_ppt_command：LLM 出分镜 -> 豆包出图 -> 打包 pptx。返回 file_paths。"""
    from commands.studio_commands import (
        _run_llm, _parse_prompt_list, _build_pptx, _download, _artifact_dir,
    )
    from open_notebook.ai.doubao import DoubaoImageClient

    raw = await _run_llm(system_prompt, content, instructions)
    prompts = _parse_prompt_list(raw, num_images)

    client = DoubaoImageClient()
    out_dir = _artifact_dir(artifact_id)
    image_paths: List[str] = []
    for idx, prompt in enumerate(prompts):
        try:
            result = client.generate(prompt, size=size, response_format="url")
            if not result.url:
                logger.warning(f"slide {idx} no url, skip")
                continue
            dest = out_dir / f"img_{idx}.png"
            _download(result.url, dest)
            image_paths.append(str(dest))
        except Exception as e:
            logger.warning(f"slide {idx} failed: {e}")
    if not image_paths:
        raise RuntimeError("豆包未生成任何幻灯片图片")
    pptx_path = out_dir / "slides.pptx"
    _build_pptx(image_paths, pptx_path)
    return image_paths + [str(pptx_path)]


# ---------------------------------------------------------------------------
# 视频：豆包 Seedance 真实文生视频
# ---------------------------------------------------------------------------
async def generate_video_real(artifact_id: str, system_prompt: str, content: str,
                              resolution: str, ratio: str, duration: int,
                              instructions=None):
    """复刻 generate_video_command：LLM 出提示词 -> 豆包 Seedance mp4。返回 (file_path, script)。"""
    from commands.studio_commands import _run_llm, _strip_code_fence, _download, _artifact_dir
    from open_notebook.ai.doubao import DoubaoVideoClient

    video_prompt = _strip_code_fence(await _run_llm(system_prompt, content, instructions))
    client = DoubaoVideoClient()
    task_id = client.create_task(
        video_prompt, resolution=resolution, ratio=ratio, duration=duration
    )
    result = client.wait(task_id, max_wait_seconds=900.0)
    if not result.video_url:
        raise RuntimeError("豆包视频任务未返回 video_url")
    dest = _artifact_dir(artifact_id) / "video.mp4"
    _download(result.video_url, dest)
    return str(dest), video_prompt


# ---------------------------------------------------------------------------
# 播客：podcast-creator + 豆包 LLM/TTS 真实生成
# ---------------------------------------------------------------------------
async def configure_podcast_profiles_doubao(language_model_id: str, tts_model_id: str):
    """把内置 episode/speaker profile 的模型字段配置为豆包，speakers 改用豆包中文音色。

    幂等：每次按名覆盖。返回可用的 (episode_profile_name, speaker_profile_name)。
    """
    from open_notebook.database.repository import repo_query, ensure_record_id

    lm = ensure_record_id(language_model_id)
    tts = ensure_record_id(tts_model_id)

    # episode_profile: 配置 outline_llm / transcript_llm，并改用中文 briefing
    cn_briefing = (
        "请用简体中文，围绕所提供的计算机知识内容，创作一期生动、专业的双人技术对谈播客。"
        "两位主播一问一答、自然口语化，深入浅出地讲清核心概念、原理与实际应用，"
        "适合计算机专业学生与开发者收听。全程使用中文，避免中英夹杂。"
    )
    await repo_query(
        "UPDATE episode_profile SET outline_llm=$lm, transcript_llm=$lm, "
        "language='zh', default_briefing=$brief WHERE name='tech_discussion'",
        {"lm": lm, "brief": cn_briefing},
    )
    await repo_query(
        "UPDATE episode_profile SET outline_llm=$lm, transcript_llm=$lm",
        {"lm": lm},
    )

    # speaker_profile: 配置 voice_model + 豆包中文音色
    # 双人科技对话用一男一女专业音色
    tech_speakers = [
        {
            "name": "陈博士", "voice_id": "zh_female_zhixingnv_uranus_bigtts",
            "backstory": "资深 AI 研究员，擅长把复杂的技术概念讲得通俗易懂。",
            "personality": "分析力强、表达清晰，善于层层追问深入技术细节。",
        },
        {
            "name": "晓明",
            "voice_id": "zh_male_qingshuangnanda_uranus_bigtts",
            "backstory": "全栈工程师与技术创业者，热爱实际应用和工程落地。",
            "personality": "热情务实，擅长讲解实现细节与工程权衡。",
        },
    ]

    await repo_query(
        "UPDATE speaker_profile SET voice_model=$tts WHERE name='tech_experts'",
        {"tts": tts},
    )
    await repo_query(
        "UPDATE speaker_profile SET speakers=$spk WHERE name='tech_experts'",
        {"spk": tech_speakers},
    )
    # 其它 speaker profile 也指向豆包，避免 podcast-creator 校验全部 profile 时失败
    await repo_query("UPDATE speaker_profile SET voice_model=$tts", {"tts": tts})

    return "tech_discussion", "tech_experts"


async def generate_podcast_real(notebook_name: str, podcast_title: str,
                                content: str, episode_profile_name: str,
                                speaker_profile_name: str):
    """用 podcast-creator(豆包 LLM + 豆包 TTS) 真实生成播客。返回 PodcastEpisode。"""
    import uuid
    from podcast_creator import create_podcast, configure
    from open_notebook.config import DATA_FOLDER
    from open_notebook.database.repository import repo_query
    from open_notebook.podcasts.models import (
        EpisodeProfile, SpeakerProfile, PodcastEpisode,
    )
    from commands.podcast_commands import full_model_dump, _resolve_model_config

    # 关键修复：credential 表的 doubao 记录把 ARK key 误注入 TTS modality，
    # 会用 ARK key 覆盖 DOUBAO_TTS_API_KEY 导致 401。从 .env 恢复正确的
    # openspeech TTS key（ark- 开头是 ARK key，不能用于 TTS）。
    _restore_tts_key()

    episode_profile = await EpisodeProfile.get_by_name(episode_profile_name)
    speaker_profile = await SpeakerProfile.get_by_name(speaker_profile_name)

    # 解析所有 profile 的模型配置并注入（podcast-creator 会校验全部）
    episode_profiles = await repo_query("SELECT * FROM episode_profile")
    speaker_profiles = await repo_query("SELECT * FROM speaker_profile")
    ep_dict = {p["name"]: p for p in episode_profiles}
    sp_dict = {p["name"]: p for p in speaker_profiles}

    for name in list(ep_dict.keys()):
        d = ep_dict[name]
        try:
            if d.get("outline_llm"):
                prov, model, conf = await _resolve_model_config(str(d["outline_llm"]))
                d["outline_provider"], d["outline_model"], d["outline_config"] = prov, model, conf
            if d.get("transcript_llm"):
                prov, model, conf = await _resolve_model_config(str(d["transcript_llm"]))
                d["transcript_provider"], d["transcript_model"], d["transcript_config"] = prov, model, conf
        except Exception as e:
            logger.warning(f"episode profile {name} 解析失败，移除：{e}")
            del ep_dict[name]
    for name in list(sp_dict.keys()):
        d = sp_dict[name]
        if d.get("voice_model"):
            try:
                prov, model, conf = await _resolve_model_config(str(d["voice_model"]))
                d["tts_provider"], d["tts_model"], d["tts_config"] = prov, model, conf
            except Exception as e:
                logger.warning(f"speaker profile {name} TTS 解析失败，移除：{e}")
                del sp_dict[name]

    briefing = episode_profile.default_briefing

    episode = PodcastEpisode(
        name=f"{notebook_name} · {podcast_title}",
        episode_profile=full_model_dump(episode_profile.model_dump()),
        speaker_profile=full_model_dump(speaker_profile.model_dump()),
        briefing=briefing, content=content,
        audio_file=None, transcript=None, outline=None,
    )
    await episode.save()

    configure("speakers_config", {"profiles": sp_dict})
    configure("episode_config", {"profiles": ep_dict})

    episode_dir_name = str(uuid.uuid4())
    output_dir = Path(f"{DATA_FOLDER}/podcasts/episodes/{episode_dir_name}")
    output_dir.mkdir(parents=True, exist_ok=True)

    result = await create_podcast(
        content=content, briefing=briefing, episode_name=episode_dir_name,
        output_dir=str(output_dir), speaker_config=speaker_profile.name,
        episode_profile=episode_profile.name,
    )
    episode.audio_file = str(result.get("final_output_file_path")) if result else None
    episode.transcript = {"transcript": full_model_dump(result["transcript"])} if result and result.get("transcript") else None
    episode.outline = full_model_dump(result["outline"]) if result and result.get("outline") else None
    await episode.save()
    return episode
