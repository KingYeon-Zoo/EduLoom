"""重新生成 PPT(8页) 与视频(10秒)，替换旧的 4页/5秒版本。

读取已更新的 studio_profile 配置（num_images=8, duration=10），删除每个笔记本
现有的 ppt/video artifact 及其磁盘文件，再用豆包真实管线重新生成。
报告/测验/导图/播客/路径/评估/画像/会话均保持不变。
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

# 笔记本名 -> 素材模块
CONTENT_MODULES = {
    "数据结构与算法": "content_ds",
    "计算机网络": "content_net",
    "操作系统": "content_os",
    "机器学习与深度学习": "content_ml",
}


async def main():
    start = time.time()
    from open_notebook.ai.doubao.register import register_doubao_providers
    register_doubao_providers()
    import commands.studio_commands  # noqa: F401

    from open_notebook.database.repository import repo_query, repo_delete
    from open_notebook.domain.studio_profile import StudioProfile
    from open_notebook.domain.artifact import StudioArtifact
    from demo_seed import doubao_media as dm
    import importlib

    profiles = {p.name: p for p in await StudioProfile.get_all()}
    ppt_prof = profiles.get("知识要点幻灯")
    vid_prof = profiles.get("知识点快讲")

    nbs = await repo_query("SELECT id, name FROM notebook")

    for nb in nbs:
        nb_name = nb["name"]
        nb_id = str(nb["id"])
        mod_name = CONTENT_MODULES.get(nb_name)
        if not mod_name:
            continue
        mod = importlib.import_module(f"demo_seed.{mod_name}")
        material = "\n\n".join(
            f"## 来源：{s['title']}\n{s['full_text']}" for s in mod.SOURCES
        )
        log(f"\n🎬 [{nb_name}] 重新生成 PPT(8页) 与视频(10秒)")

        # 删除旧 ppt/video（含磁盘文件）
        olds = await repo_query(
            f"SELECT id, file_paths FROM studio_artifact WHERE notebook_id={nb['id']} "
            "AND (resource_type='ppt' OR resource_type='video')"
        )
        for o in olds:
            for fp in (o.get("file_paths") or []):
                try:
                    p = Path(fp)
                    if p.exists():
                        p.unlink()
                except Exception:
                    pass
            await repo_delete(str(o["id"]))
        log(f"  - 已删除 {len(olds)} 个旧媒体资源")

        # 重新生成 PPT（8页）
        if ppt_prof:
            t0 = time.time()
            try:
                art = StudioArtifact(name=f"{nb_name} · 知识要点幻灯", resource_type="ppt",
                                     notebook_id=nb_id, profile_snapshot=ppt_prof.model_dump())
                await art.save()
                cfg = ppt_prof.config or {}
                paths = await dm.generate_ppt_real(
                    str(art.id), ppt_prof.default_prompt, material,
                    int(cfg.get("num_images", 8)), cfg.get("size", "1280x720"))
                art.file_paths = paths
                await art.save()
                log(f"  ✓ PPT   {len(paths)-1} 页豆包配图 + .pptx ({time.time()-t0:.0f}s)")
            except Exception as ex:
                log(f"  ✗ PPT 失败：{ex}")

        # 重新生成视频（10秒）
        if vid_prof:
            t0 = time.time()
            try:
                art = StudioArtifact(name=f"{nb_name} · 知识点快讲", resource_type="video",
                                     notebook_id=nb_id, profile_snapshot=vid_prof.model_dump())
                await art.save()
                cfg = vid_prof.config or {}
                vp, script = await dm.generate_video_real(
                    str(art.id), vid_prof.default_prompt, material,
                    cfg.get("resolution", "720p"), cfg.get("ratio", "16:9"),
                    int(cfg.get("duration", 10)))
                art.file_paths = [vp]; art.content = script
                await art.save()
                log(f"  ✓ 视频  豆包 Seedance 10秒 mp4 ({time.time()-t0:.0f}s)")
            except Exception as ex:
                log(f"  ✗ 视频 失败：{ex}")

    log(f"\n✅ 重生成完成！耗时 {time.time()-start:.0f}s")

asyncio.run(main())
