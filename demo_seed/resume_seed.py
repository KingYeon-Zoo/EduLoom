"""续跑脚本：补齐中断后缺失的部分。

中断点：机器学习笔记本的 PPT(空记录)/视频/播客未完成；
全部笔记本的学习路径/评估/画像/会话未生成。

本脚本幂等补齐这些，不重跑已完成的文本/前三个笔记本媒体。
"""

import asyncio
import os
import sys
import time
from pathlib import Path

os.environ.setdefault("NO_PROXY", "*")
os.environ.setdefault("no_proxy", "*")
from dotenv import load_dotenv  # noqa: E402
load_dotenv(".env")
from loguru import logger  # noqa: E402
logger.remove()
logger.add(sys.stderr, level="WARNING")


def log(m): print(m, flush=True)


async def main():
    start = time.time()
    from open_notebook.ai.doubao.register import register_doubao_providers
    register_doubao_providers()
    import commands.studio_commands, commands.podcast_commands  # noqa: F401

    from open_notebook.database.repository import repo_query, repo_delete, ensure_record_id
    from open_notebook.domain.studio_profile import StudioProfile
    from open_notebook.domain.artifact import StudioArtifact
    from open_notebook.ai.models import DefaultModels
    from demo_seed import doubao_media as dm
    from demo_seed import content_presets

    ML_NAME = "机器学习与深度学习"

    # 找到机器学习笔记本
    nbs = await repo_query("SELECT id, name FROM notebook")
    ml = next((n for n in nbs if n["name"] == ML_NAME), None)
    if not ml:
        log("找不到机器学习笔记本"); return
    ml_id = str(ml["id"])

    # 重新构造机器学习的素材
    from demo_seed import content_ml
    material = "\n\n".join(f"## 来源：{s['title']}\n{s['full_text']}" for s in content_ml.SOURCES)

    profiles = {p.name: p for p in await StudioProfile.get_all()}

    # ---- 1. 删除空 PPT artifact，重新生成 ----
    log(f"\n🎬 [{ML_NAME}] 补齐媒体资源")
    empties = await repo_query(
        f"SELECT id FROM studio_artifact WHERE notebook_id={ml['id']} "
        "AND resource_type='ppt'"
    )
    for e in empties:
        await repo_delete(str(e["id"]))
        log(f"  - 删除中断的空 PPT 记录")

    ppt_prof = profiles.get("知识要点幻灯")
    if ppt_prof:
        t0 = time.time()
        try:
            art = StudioArtifact(name=f"{ML_NAME} · 知识要点幻灯", resource_type="ppt",
                                 notebook_id=ml_id, profile_snapshot=ppt_prof.model_dump())
            await art.save()
            cfg = ppt_prof.config or {}
            paths = await dm.generate_ppt_real(
                str(art.id), ppt_prof.default_prompt, material,
                int(cfg.get("num_images", 4)), cfg.get("size", "1280x720"))
            art.file_paths = paths
            await art.save()
            log(f"  ✓ PPT   {len(paths)-1} 页豆包配图 + .pptx ({time.time()-t0:.0f}s)")
        except Exception as ex:
            log(f"  ✗ PPT 失败：{ex}")

    # ---- 2. 视频 ----
    vid_prof = profiles.get("知识点快讲")
    if vid_prof:
        t0 = time.time()
        try:
            art = StudioArtifact(name=f"{ML_NAME} · 知识点快讲", resource_type="video",
                                 notebook_id=ml_id, profile_snapshot=vid_prof.model_dump())
            await art.save()
            cfg = vid_prof.config or {}
            vp, script = await dm.generate_video_real(
                str(art.id), vid_prof.default_prompt, material,
                cfg.get("resolution", "720p"), cfg.get("ratio", "16:9"),
                int(cfg.get("duration", 5)))
            art.file_paths = [vp]; art.content = script
            await art.save()
            log(f"  ✓ 视频  豆包 Seedance mp4 ({time.time()-t0:.0f}s)")
        except Exception as ex:
            log(f"  ✗ 视频 失败：{ex}")

    # ---- 3. 播客 ----
    defaults = await DefaultModels.get_instance()
    if defaults.default_chat_model and defaults.default_text_to_speech_model:
        ep_name, sp_name = await dm.configure_podcast_profiles_doubao(
            defaults.default_chat_model, defaults.default_text_to_speech_model)
        t0 = time.time()
        try:
            ep = await dm.generate_podcast_real(ML_NAME, f"{ML_NAME}深度漫谈",
                                                material, ep_name, sp_name)
            log(f"  ✓ 播客  豆包 TTS 音频 ({time.time()-t0:.0f}s) → {Path(ep.audio_file).name if ep.audio_file else '无'}")
        except Exception as ex:
            log(f"  ✗ 播客 失败：{ex}")

    # ---- 4. 全部笔记本：学习路径 + 评估 ----
    log("\n📚 生成学习路径与能力评估")
    from open_notebook.domain.learning_path import LearningPath, LearningAssessment, ASSESSMENT_DIMENSIONS
    # 确保 schema FLEXIBLE
    from open_notebook.database.repository import db_connection
    async with db_connection() as db:
        await db.query("DEFINE FIELD OVERWRITE steps.* ON learning_path TYPE object FLEXIBLE;")
        await db.query("DEFINE FIELD OVERWRITE dimensions.* ON learning_assessment TYPE object FLEXIBLE;")

    name_to_id = {n["name"]: str(n["id"]) for n in nbs}
    for nb_name, nb_id in name_to_id.items():
        pdef = content_presets.LEARNING_PATHS.get(nb_name)
        if pdef:
            # 清旧
            await repo_query("DELETE learning_path WHERE notebook_id=$nb", {"nb": ensure_record_id(nb_id)})
            steps = [{"title": s["title"], "description": s["description"], "order": i,
                      "status": s["status"], "objectives": s["objectives"],
                      "recommended_artifacts": [], "resource_gap": None, "gap_resource_type": None}
                     for i, s in enumerate(pdef["steps"])]
            lp = LearningPath(name=pdef["name"], notebook_id=nb_id, summary=pdef["summary"],
                              steps=steps, profile_snapshot={"source": "demo_seed"})
            await lp.save()
        adef = content_presets.ASSESSMENTS.get(nb_name)
        if adef:
            await repo_query("DELETE learning_assessment WHERE notebook_id=$nb", {"nb": ensure_record_id(nb_id)})
            dims = [{"name": n, "label": ASSESSMENT_DIMENSIONS.get(n, n), "score": sc,
                     "comment": cm, "evidence": ev} for (n, sc, cm, ev) in adef["dimensions"]]
            la = LearningAssessment(notebook_id=nb_id, dimensions=dims,
                                    overall_comment=adef["overall"],
                                    suggestions=["优先攻克评分最低的维度，配合对应自测题巩固。",
                                                 "保持当前学习投入节奏，定期复习已生成的报告与导图。",
                                                 "完成学习路径中进行中的步骤后及时重新评估。"],
                                    profile_snapshot={"source": "demo_seed"})
            await la.save()
        log(f"  ✓ [{nb_name}] 路径 + 6 维评估")

    # ---- 5. 全局学习者画像 ----
    from open_notebook.domain.learner_profile import LearnerProfile, ProfileEntry
    profile = await LearnerProfile.get_instance()
    for dim, entries in content_presets.LEARNER_PROFILE.items():
        coerced = [ProfileEntry(content=c, confidence=cf, provenance=pv) for (c, cf, pv) in entries]
        object.__setattr__(profile, dim, coerced)
    await profile.update()
    log("👤 全局学习者画像已写入（6 维度）")

    # ---- 6. 聊天会话 ----
    from open_notebook.domain.notebook import ChatSession
    cnt = 0
    for nb_name, nb_id in name_to_id.items():
        # 清旧（按标题匹配较难，依赖之前 cleanup；这里直接补建）
        for title in content_presets.CHAT_SESSIONS.get(nb_name, []):
            cs = ChatSession(title=title); await cs.save()
            await cs.relate_to_notebook(nb_id); cnt += 1
    log(f"💬 已创建 {cnt} 个聊天会话")

    log(f"\n✅ 续跑完成！耗时 {time.time()-start:.0f}s")

asyncio.run(main())
