"""演示数据主脚本：一键生成完整、丰富、美观的演示数据。

运行： .venv/bin/python -m demo_seed.seed_demo   （在项目根目录）

流程：
  0. 注册豆包 provider、配置默认模型（幂等）
  1. 清理旧的演示数据（按名称匹配，幂等可重复运行）
  2. 创建 4 个计算机主题笔记本 + 多模态来源（提交向量化与洞察任务）
  3. 真实调用豆包 LLM 生成：报告 / 测验 / 思维导图
  4. 本地合成媒体：PPT（精美幻灯片 + .pptx）/ 视频 mp4 / 播客音频
  5. 写入学习路径、能力评估、全局学习者画像、聊天会话

文本类走真实大模型，媒体类本地合成，全程打印进度。
"""

import asyncio
import os
import sys
import time
from pathlib import Path

# 确保本地 SurrealDB 不走代理 + 加载 .env
os.environ.setdefault("NO_PROXY", "*")
os.environ.setdefault("no_proxy", "*")

from dotenv import load_dotenv  # noqa: E402

load_dotenv(".env")

from loguru import logger  # noqa: E402

# 降低噪声日志
logger.remove()
logger.add(sys.stderr, level="WARNING")

from demo_seed import content_ds, content_net, content_os, content_ml  # noqa: E402
from demo_seed import content_presets  # noqa: E402

NOTEBOOK_MODULES = [content_ds, content_net, content_os, content_ml]

STUDIO_DIR = Path("data/studio")


def log(msg: str):
    print(msg, flush=True)


# ---------------------------------------------------------------------------
# 0. 环境准备
# ---------------------------------------------------------------------------
async def setup_models():
    from open_notebook.ai.doubao.register import register_doubao_providers
    from open_notebook.ai.doubao.seed import (
        ensure_doubao_embedding_default,
        ensure_doubao_llm_default,
        ensure_doubao_tts_default,
    )

    register_doubao_providers()
    await ensure_doubao_embedding_default()
    await ensure_doubao_llm_default()
    await ensure_doubao_tts_default()
    log("✓ 豆包 provider 已注册，默认模型已配置")


async def ensure_schema_flexible():
    """修正迁移 20 的 schema 缺陷：steps/dimensions 的数组元素需 FLEXIBLE，
    否则 SCHEMAFULL 下嵌套字段会被拒绝。对已迁移的库用 OVERWRITE 立即生效。
    """
    from open_notebook.database.repository import db_connection

    async with db_connection() as db:
        await db.query(
            "DEFINE FIELD OVERWRITE steps.* ON learning_path TYPE object FLEXIBLE;"
        )
        await db.query(
            "DEFINE FIELD OVERWRITE dimensions.* ON learning_assessment TYPE object FLEXIBLE;"
        )
    log("✓ 学习路径/评估 schema 已修正（嵌套对象 FLEXIBLE）")


# ---------------------------------------------------------------------------
# 1. 清理旧演示数据（幂等）
# ---------------------------------------------------------------------------
async def cleanup_old():
    from open_notebook.database.repository import repo_query

    names = [m.NOTEBOOK["name"] for m in NOTEBOOK_MODULES]
    # 找到同名笔记本
    nbs = await repo_query("SELECT id, name FROM notebook")
    target_ids = [str(n["id"]) for n in nbs if n.get("name") in names]
    if not target_ids:
        # 仍清理孤立的全局画像与（按名）资源，保证可重复
        await _wipe_global_artifacts(names)
        log("✓ 无旧笔记本，已清理可能的孤立演示资源")
        return

    for nb_id in target_ids:
        # 删除该笔记本的来源（含 embedding/insight）
        srcs = await repo_query(
            "SELECT VALUE in FROM reference WHERE out = $nb", {"nb": _rid(nb_id)}
        )
        for s in srcs or []:
            sid = str(s)
            await repo_query("DELETE source_embedding WHERE source = $s", {"s": _rid(sid)})
            await repo_query("DELETE source_insight WHERE source = $s", {"s": _rid(sid)})
            await repo_query("DELETE $s", {"s": _rid(sid)})
        # 删除笔记内容
        notes = await repo_query(
            "SELECT VALUE in FROM artifact WHERE out = $nb", {"nb": _rid(nb_id)}
        )
        for nt in notes or []:
            await repo_query("DELETE $n", {"n": _rid(str(nt))})
        await repo_query("DELETE reference WHERE out = $nb", {"nb": _rid(nb_id)})
        await repo_query("DELETE artifact WHERE out = $nb", {"nb": _rid(nb_id)})
        # 删除关联会话
        sessions = await repo_query(
            "SELECT VALUE in FROM refers_to WHERE out = $nb", {"nb": _rid(nb_id)}
        )
        for ses in sessions or []:
            await repo_query("DELETE refers_to WHERE in = $s", {"s": _rid(str(ses))})
            await repo_query("DELETE $s", {"s": _rid(str(ses))})
        # 删除该笔记本的 studio_artifact / 学习路径 / 评估
        await repo_query("DELETE studio_artifact WHERE notebook_id = $nb", {"nb": _rid(nb_id)})
        await repo_query("DELETE learning_path WHERE notebook_id = $nb", {"nb": _rid(nb_id)})
        await repo_query("DELETE learning_assessment WHERE notebook_id = $nb", {"nb": _rid(nb_id)})
        await repo_query("DELETE $nb", {"nb": _rid(nb_id)})

    # 删除演示播客 episode（按名称前缀匹配笔记本名）
    for nm in names:
        await repo_query(
            "DELETE episode WHERE string::starts_with(name, $p)", {"p": nm + " · "}
        )

    await _wipe_global_artifacts(names)
    log(f"✓ 已清理 {len(target_ids)} 个旧笔记本及其全部关联数据")


async def _wipe_global_artifacts(names):
    """清理可能残留的演示 studio_artifact 磁盘目录。"""
    # 磁盘上的 studio 目录在重新生成时会被新 artifact 覆盖，这里不强删，
    # 避免误删用户自己的产物。仅依赖 DB 级清理。
    return


def _rid(id_str):
    from open_notebook.database.repository import ensure_record_id

    return ensure_record_id(id_str)


async def embed_source_direct(src):
    """直接为来源生成分块向量并写入 source_embedding（复刻 embed_source 命令逻辑）。"""
    from open_notebook.database.repository import ensure_record_id, repo_insert, repo_query
    from open_notebook.utils.chunking import detect_content_type, chunk_text
    from open_notebook.utils.embedding import generate_embeddings

    if not src.full_text or not src.full_text.strip():
        return
    await repo_query(
        "DELETE source_embedding WHERE source = $sid", {"sid": ensure_record_id(src.id)}
    )
    content_type = detect_content_type(src.full_text)
    chunks = chunk_text(src.full_text, content_type=content_type)
    if not chunks:
        return
    embeddings = await generate_embeddings(chunks)
    records = [
        {
            "source": ensure_record_id(src.id),
            "order": idx,
            "content": chunk,
            "embedding": emb,
        }
        for idx, (chunk, emb) in enumerate(zip(chunks, embeddings))
    ]
    await repo_insert("source_embedding", records)


# ---------------------------------------------------------------------------
# 2. 创建笔记本 + 多模态来源
# ---------------------------------------------------------------------------
async def create_notebooks_and_sources():
    from open_notebook.domain.notebook import Notebook, Source, Asset

    created = {}
    for mod in NOTEBOOK_MODULES:
        nb = Notebook(name=mod.NOTEBOOK["name"], description=mod.NOTEBOOK["description"])
        await nb.save()
        log(f"\n📓 创建笔记本：{nb.name}")
        sources = []
        for sdef in mod.SOURCES:
            asset = None
            if sdef.get("url"):
                asset = Asset(url=sdef["url"])
            src = Source(
                title=sdef["title"],
                topics=sdef.get("topics", []),
                full_text=sdef["full_text"],
                asset=asset,
            )
            await src.save()
            await src.add_to_notebook(str(nb.id))
            sources.append(src)
            # 直接生成向量（不走命令队列，本进程未启动 worker）
            try:
                await embed_source_direct(src)
            except Exception as e:
                log(f"  ! 向量化失败（不影响演示）：{e}")
            log(f"  + 来源[{sdef['source_type']}]：{sdef['title']}")
        created[mod.NOTEBOOK["name"]] = {"notebook": nb, "sources": sources}
    return created


# ---------------------------------------------------------------------------
# 3. 真实 LLM 生成文本类资源
# ---------------------------------------------------------------------------
async def _run_llm(system_prompt: str, content: str) -> str:
    from commands.studio_commands import _run_llm as run
    return await run(system_prompt, content, None)


async def _save_artifact(name, resource_type, notebook_id, content=None,
                         file_paths=None, profile_snapshot=None):
    from open_notebook.domain.artifact import StudioArtifact

    art = StudioArtifact(
        name=name,
        resource_type=resource_type,
        notebook_id=notebook_id,
        content=content,
        file_paths=file_paths or [],
        profile_snapshot=profile_snapshot or {},
    )
    await art.save()
    return art


async def generate_text_artifacts(ctx):
    """报告 / 测验 / 思维导图——真实调用豆包 LLM。"""
    from open_notebook.domain.studio_profile import StudioProfile

    profiles = {p.name: p for p in await StudioProfile.get_all()}

    for nb_name, data in ctx.items():
        nb = data["notebook"]
        # 拼接来源正文作为生成素材
        material = "\n\n".join(
            f"## 来源：{s.title}\n{s.full_text}" for s in data["sources"]
        )
        log(f"\n🧠 [{nb_name}] 真实生成文本资源（豆包大模型）")

        plan = [
            ("report", "考点精讲报告", f"{nb_name} · 考点精讲报告"),
            ("report", "综合摘要报告", f"{nb_name} · 综合摘要"),
            ("quiz", "综合自测题", f"{nb_name} · 综合自测题"),
            ("mindmap", "知识结构导图", f"{nb_name} · 知识结构导图"),
        ]
        for rtype, profile_name, art_name in plan:
            prof = profiles.get(profile_name)
            if not prof:
                continue
            t0 = time.time()
            try:
                raw = await _run_llm(prof.default_prompt, material)
                from commands.studio_commands import _strip_code_fence
                content = _strip_code_fence(raw) if rtype == "mindmap" else raw
                await _save_artifact(
                    art_name, rtype, str(nb.id), content=content,
                    profile_snapshot=prof.model_dump(),
                )
                log(f"  ✓ {rtype:8s} {art_name}  ({time.time()-t0:.0f}s, {len(content)} 字)")
            except Exception as e:
                log(f"  ✗ {rtype} 生成失败：{e}")


# ---------------------------------------------------------------------------
# 4. 豆包真实生成媒体类资源（PPT / 视频 / 播客）
# ---------------------------------------------------------------------------
async def generate_media_artifacts(ctx):
    """PPT(Seedream出图) / 视频(Seedance) / 播客(豆包TTS) 全部走真实豆包接口。"""
    from open_notebook.domain.studio_profile import StudioProfile
    from open_notebook.ai.models import DefaultModels
    from demo_seed import doubao_media as dm

    profiles = {p.name: p for p in await StudioProfile.get_all()}

    # 配置播客 profile 使用豆包模型与中文音色
    defaults = await DefaultModels.get_instance()
    ep_name = sp_name = None
    if defaults.default_chat_model and defaults.default_text_to_speech_model:
        ep_name, sp_name = await dm.configure_podcast_profiles_doubao(
            defaults.default_chat_model, defaults.default_text_to_speech_model
        )
        log(f"✓ 播客 profile 已配置豆包模型（{ep_name} / {sp_name}）")

    for nb_name, data in ctx.items():
        nb = data["notebook"]
        material = "\n\n".join(
            f"## 来源：{s.title}\n{s.full_text}" for s in data["sources"]
        )
        log(f"\n🎬 [{nb_name}] 豆包真实生成媒体资源")

        # ---- PPT：豆包 Seedream 出图 ----
        ppt_prof = profiles.get("知识要点幻灯")
        if ppt_prof:
            t0 = time.time()
            try:
                art = await _save_artifact(
                    f"{nb_name} · 知识要点幻灯", "ppt", str(nb.id),
                    profile_snapshot=ppt_prof.model_dump(),
                )
                cfg = ppt_prof.config or {}
                num_images = int(cfg.get("num_images", 4))
                size = cfg.get("size", "1280x720")
                paths = await dm.generate_ppt_real(
                    str(art.id), ppt_prof.default_prompt, material, num_images, size
                )
                art.file_paths = paths
                await art.save()
                log(f"  ✓ PPT   {len(paths)-1} 页豆包配图 + .pptx ({time.time()-t0:.0f}s)")
            except Exception as e:
                log(f"  ✗ PPT 生成失败：{e}")

        # ---- 视频：豆包 Seedance 文生视频 ----
        vid_prof = profiles.get("知识点快讲")
        if vid_prof:
            t0 = time.time()
            try:
                art = await _save_artifact(
                    f"{nb_name} · 知识点快讲", "video", str(nb.id),
                    profile_snapshot=vid_prof.model_dump(),
                )
                cfg = vid_prof.config or {}
                vp, script = await dm.generate_video_real(
                    str(art.id), vid_prof.default_prompt, material,
                    cfg.get("resolution", "720p"), cfg.get("ratio", "16:9"),
                    int(cfg.get("duration", 5)),
                )
                art.file_paths = [vp]
                art.content = script
                await art.save()
                log(f"  ✓ 视频  豆包 Seedance mp4 ({time.time()-t0:.0f}s)")
            except Exception as e:
                log(f"  ✗ 视频 生成失败：{e}")

        # ---- 播客：豆包 LLM 大纲/脚本 + 豆包 TTS ----
        if ep_name and sp_name:
            t0 = time.time()
            try:
                ep = await dm.generate_podcast_real(
                    nb_name, f"{nb_name}深度漫谈", material, ep_name, sp_name
                )
                if ep.audio_file:
                    log(f"  ✓ 播客  豆包 TTS 音频 ({time.time()-t0:.0f}s) → {Path(ep.audio_file).name}")
                else:
                    log(f"  ! 播客  生成完成但无音频文件 ({time.time()-t0:.0f}s)")
            except Exception as e:
                log(f"  ✗ 播客 生成失败：{e}")


# ---------------------------------------------------------------------------
# 5. 学习路径 / 能力评估 / 画像 / 会话
# ---------------------------------------------------------------------------
async def create_paths_and_assessments(ctx):
    from open_notebook.domain.learning_path import (
        LearningPath, LearningAssessment, ASSESSMENT_DIMENSIONS,
    )

    for nb_name, data in ctx.items():
        nb = data["notebook"]
        # 学习路径
        pdef = content_presets.LEARNING_PATHS.get(nb_name)
        if pdef:
            steps = []
            for i, s in enumerate(pdef["steps"]):
                steps.append({
                    "title": s["title"], "description": s["description"],
                    "order": i, "status": s["status"],
                    "objectives": s["objectives"],
                    "recommended_artifacts": [], "resource_gap": None,
                    "gap_resource_type": None,
                })
            lp = LearningPath(
                name=pdef["name"], notebook_id=str(nb.id),
                summary=pdef["summary"], steps=steps,
                profile_snapshot={"source": "demo_seed"},
            )
            await lp.save()
        # 能力评估
        adef = content_presets.ASSESSMENTS.get(nb_name)
        if adef:
            dims = [{
                "name": name, "label": ASSESSMENT_DIMENSIONS.get(name, name),
                "score": score, "comment": comment, "evidence": evidence,
            } for (name, score, comment, evidence) in adef["dimensions"]]
            la = LearningAssessment(
                notebook_id=str(nb.id), dimensions=dims,
                overall_comment=adef["overall"],
                suggestions=[
                    "优先攻克评分最低的维度，配合对应自测题巩固。",
                    "保持当前学习投入节奏，定期复习已生成的报告与导图。",
                    "完成学习路径中进行中的步骤后及时重新评估。",
                ],
                profile_snapshot={"source": "demo_seed"},
            )
            await la.save()
        log(f"  ✓ [{nb_name}] 学习路径 + 6 维能力评估")


async def create_learner_profile():
    from open_notebook.domain.learner_profile import LearnerProfile, ProfileEntry

    profile = await LearnerProfile.get_instance()
    for dim, entries in content_presets.LEARNER_PROFILE.items():
        coerced = [
            ProfileEntry(content=c, confidence=conf, provenance=prov)
            for (c, conf, prov) in entries
        ]
        object.__setattr__(profile, dim, coerced)
    await profile.update()
    total = sum(len(v) for v in content_presets.LEARNER_PROFILE.values())
    log(f"\n👤 全局学习者画像已写入：6 维度 / {total} 条观察")


async def create_chat_sessions(ctx):
    from open_notebook.domain.notebook import ChatSession

    count = 0
    for nb_name, data in ctx.items():
        nb = data["notebook"]
        for title in content_presets.CHAT_SESSIONS.get(nb_name, []):
            cs = ChatSession(title=title)
            await cs.save()
            await cs.relate_to_notebook(str(nb.id))
            count += 1
    log(f"💬 已创建 {count} 个聊天会话")


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------
async def main():
    start = time.time()
    log("=" * 60)
    log("EduLoom 演示数据生成开始")
    log("=" * 60)

    await setup_models()
    await ensure_schema_flexible()
    await cleanup_old()

    ctx = await create_notebooks_and_sources()
    await generate_text_artifacts(ctx)
    await generate_media_artifacts(ctx)
    await create_paths_and_assessments(ctx)
    await create_learner_profile()
    await create_chat_sessions(ctx)

    log("\n" + "=" * 60)
    log(f"✅ 演示数据生成完成！总耗时 {time.time()-start:.0f}s")
    log("=" * 60)
    await print_summary()


async def print_summary():
    from open_notebook.database.repository import repo_query

    async def cnt(t, where=""):
        q = f"SELECT count() FROM {t} {where} GROUP ALL"
        r = await repo_query(q)
        return r[0]["count"] if r else 0

    def rt(v):
        return "WHERE resource_type='" + v + "'"

    log("\n📊 数据总览：")
    log(f"  笔记本     : {await cnt('notebook')}")
    log(f"  来源       : {await cnt('source')}")
    log(f"  生成资源   : {await cnt('studio_artifact')}")
    log(f"    · 报告   : {await cnt('studio_artifact', rt('report'))}")
    log(f"    · 测验   : {await cnt('studio_artifact', rt('quiz'))}")
    log(f"    · 导图   : {await cnt('studio_artifact', rt('mindmap'))}")
    log(f"    · PPT    : {await cnt('studio_artifact', rt('ppt'))}")
    log(f"    · 视频   : {await cnt('studio_artifact', rt('video'))}")
    log(f"  播客       : {await cnt('episode')}")
    log(f"  学习路径   : {await cnt('learning_path')}")
    log(f"  能力评估   : {await cnt('learning_assessment')}")
    log(f"  聊天会话   : {await cnt('chat_session')}")


if __name__ == "__main__":
    asyncio.run(main())
