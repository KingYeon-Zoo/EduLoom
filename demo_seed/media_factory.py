"""本地媒体合成工具：PPT 幻灯片图、知识点视频、播客音频。

不依赖任何外部 AI / 付费接口，全部用 PIL + imageio(ffmpeg) + macOS `say` 在本机合成，
产出与真实生成管线一致的文件结构：
  * PPT  : data/studio/<artifact_id>/img_*.png  + slides.pptx
  * 视频 : data/studio/<artifact_id>/video.mp4
  * 播客 : 音频文件 + transcript dict
所有幻灯片/视频帧均为精心排版的中文设计稿，演示效果美观。
"""

from __future__ import annotations

import math
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import List, Optional, Tuple

from PIL import Image, ImageDraw, ImageFont

# ---------------------------------------------------------------------------
# 字体（macOS 自带中文字体；PingFang.ttc 无法被 PIL 读取，改用黑体/宋体）
# ---------------------------------------------------------------------------
_FONT_BOLD = "/System/Library/Fonts/Hiragino Sans GB.ttc"   # 冬青黑体（粗）
_FONT_HEI = "/System/Library/Fonts/STHeiti Medium.ttc"      # 华文黑体
_FONT_LIGHT = "/System/Library/Fonts/STHeiti Light.ttc"     # 华文黑体（细）
_FONT_SONG = "/System/Library/Fonts/Supplemental/Songti.ttc"  # 宋体


def _font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def f_title(size: int) -> ImageFont.FreeTypeFont:
    return _font(_FONT_BOLD, size)


def f_body(size: int) -> ImageFont.FreeTypeFont:
    return _font(_FONT_HEI, size)


def f_light(size: int) -> ImageFont.FreeTypeFont:
    return _font(_FONT_LIGHT, size)


# ---------------------------------------------------------------------------
# 配色主题（每个笔记本一套，演示更丰富）
# ---------------------------------------------------------------------------
THEMES = {
    "blue": {  # 数据结构与算法
        "bg_top": (16, 32, 72), "bg_bottom": (8, 16, 40),
        "accent": (64, 156, 255), "accent2": (130, 200, 255),
        "text": (236, 244, 255), "sub": (150, 178, 220), "card": (28, 48, 92),
    },
    "teal": {  # 计算机网络
        "bg_top": (10, 48, 56), "bg_bottom": (6, 26, 32),
        "accent": (38, 200, 190), "accent2": (120, 235, 220),
        "text": (230, 250, 248), "sub": (140, 196, 192), "card": (16, 64, 72),
    },
    "violet": {  # 操作系统
        "bg_top": (40, 22, 72), "bg_bottom": (22, 12, 44),
        "accent": (168, 120, 255), "accent2": (208, 176, 255),
        "text": (240, 236, 255), "sub": (180, 162, 220), "card": (58, 36, 100),
    },
    "amber": {  # 机器学习
        "bg_top": (64, 38, 12), "bg_bottom": (36, 20, 8),
        "accent": (255, 176, 64), "accent2": (255, 212, 130),
        "text": (255, 246, 232), "sub": (216, 188, 150), "card": (92, 56, 20),
    },
}


# ---------------------------------------------------------------------------
# 绘图基元
# ---------------------------------------------------------------------------
def _vertical_gradient(size: Tuple[int, int], top, bottom) -> Image.Image:
    w, h = size
    base = Image.new("RGB", size, top)
    grad = Image.new("L", (1, h))
    for y in range(h):
        grad.putpixel((0, y), int(255 * y / max(1, h - 1)))
    grad = grad.resize(size)
    bottom_img = Image.new("RGB", size, bottom)
    return Image.composite(bottom_img, base, grad)


def _wrap(draw, text, font, max_w):
    """按像素宽度对中文文本换行。"""
    lines, cur = [], ""
    for ch in text:
        if ch == "\n":
            lines.append(cur)
            cur = ""
            continue
        test = cur + ch
        if draw.textlength(test, font=font) <= max_w:
            cur = test
        else:
            lines.append(cur)
            cur = ch
    if cur:
        lines.append(cur)
    return lines


def _draw_dots(draw, w, h, color, alpha_step=1):
    """背景装饰：稀疏网点。"""
    for x in range(0, w, 64):
        for y in range(0, h, 64):
            draw.ellipse([x - 1, y - 1, x + 1, y + 1], fill=color)


# ---------------------------------------------------------------------------
# 幻灯片渲染（2560x1440，与真实管线一致的高清比例）
# ---------------------------------------------------------------------------
SLIDE_W, SLIDE_H = 2560, 1440


def render_cover_slide(theme_key, title, subtitle, tag) -> Image.Image:
    t = THEMES[theme_key]
    img = _vertical_gradient((SLIDE_W, SLIDE_H), t["bg_top"], t["bg_bottom"])
    d = ImageDraw.Draw(img, "RGBA")
    _draw_dots(d, SLIDE_W, SLIDE_H, (*t["accent"], 22))
    # 左侧强调竖条
    d.rectangle([0, 0, 24, SLIDE_H], fill=t["accent"])
    # 顶部标签
    tag_font = f_body(44)
    tag_w = d.textlength(tag, font=tag_font)
    d.rounded_rectangle([180, 360, 180 + tag_w + 80, 360 + 92], radius=46,
                        outline=t["accent"], width=3)
    d.text((220, 384), tag, font=tag_font, fill=t["accent2"])
    # 主标题（可多行）
    title_font = f_title(150)
    lines = _wrap(d, title, title_font, SLIDE_W - 360)
    y = 520
    for ln in lines:
        d.text((180, y), ln, font=title_font, fill=t["text"])
        y += 180
    # 副标题
    sub_font = f_light(56)
    for ln in _wrap(d, subtitle, sub_font, SLIDE_W - 400):
        d.text((184, y + 40), ln, font=sub_font, fill=t["sub"])
        y += 78
    # 底部署名条
    d.line([180, SLIDE_H - 160, SLIDE_W - 180, SLIDE_H - 160], fill=(*t["accent"], 90), width=2)
    d.text((180, SLIDE_H - 130), "个性化资源生成与学习多智能体系统  ·  EduLoom", font=f_body(40), fill=t["sub"])
    return img


def render_content_slide(theme_key, index, total, heading, bullets: List[Tuple[str, str]]) -> Image.Image:
    """正文页：标题 + 若干「要点：说明」卡片。"""
    t = THEMES[theme_key]
    img = _vertical_gradient((SLIDE_W, SLIDE_H), t["bg_top"], t["bg_bottom"])
    d = ImageDraw.Draw(img, "RGBA")
    _draw_dots(d, SLIDE_W, SLIDE_H, (*t["accent"], 18))
    # 页眉
    d.rectangle([0, 0, SLIDE_W, 12], fill=t["accent"])
    d.text((180, 96), f"{index:02d}", font=f_title(96), fill=t["accent"])
    head_font = f_title(76)
    d.text((320, 110), heading, font=head_font, fill=t["text"])
    d.line([180, 240, SLIDE_W - 180, 240], fill=(*t["accent"], 120), width=3)
    # 卡片
    n = len(bullets)
    top = 320
    gap = 36
    card_h = int((SLIDE_H - top - 160 - gap * (n - 1)) / max(1, n))
    card_h = min(card_h, 230)
    y = top
    for i, (key, desc) in enumerate(bullets):
        d.rounded_rectangle([180, y, SLIDE_W - 180, y + card_h], radius=28,
                            fill=(*t["card"], 235))
        d.rounded_rectangle([180, y, 196, y + card_h], radius=8, fill=t["accent"])
        # 序号圆
        cx, cy = 280, y + card_h // 2
        d.ellipse([cx - 44, cy - 44, cx + 44, cy + 44], fill=t["accent"])
        num = str(i + 1)
        nf = f_title(52)
        nw = d.textlength(num, font=nf)
        d.text((cx - nw / 2, cy - 36), num, font=nf, fill=t["bg_bottom"])
        # 要点标题
        kf = f_title(56)
        d.text((376, y + 36), key, font=kf, fill=t["accent2"])
        # 说明
        df = f_body(40)
        dlines = _wrap(d, desc, df, SLIDE_W - 376 - 220)[:2]
        dy = y + 110
        for ln in dlines:
            d.text((376, dy), ln, font=df, fill=t["text"])
            dy += 54
        y += card_h + gap
    # 页脚进度
    d.text((180, SLIDE_H - 96), f"{index} / {total}", font=f_body(40), fill=t["sub"])
    bar_x = 360
    bar_w = SLIDE_W - 360 - 180
    d.rounded_rectangle([bar_x, SLIDE_H - 84, bar_x + bar_w, SLIDE_H - 70], radius=7, fill=(*t["sub"], 60))
    fill_w = int(bar_w * index / total)
    d.rounded_rectangle([bar_x, SLIDE_H - 84, bar_x + fill_w, SLIDE_H - 70], radius=7, fill=t["accent"])
    return img


def render_closing_slide(theme_key, takeaways: List[str]) -> Image.Image:
    t = THEMES[theme_key]
    img = _vertical_gradient((SLIDE_W, SLIDE_H), t["bg_top"], t["bg_bottom"])
    d = ImageDraw.Draw(img, "RGBA")
    _draw_dots(d, SLIDE_W, SLIDE_H, (*t["accent"], 22))
    d.rectangle([0, 0, 24, SLIDE_H], fill=t["accent"])
    d.text((180, 220), "本章小结", font=f_title(120), fill=t["text"])
    d.line([180, 400, 900, 400], fill=t["accent"], width=6)
    y = 520
    for tk in takeaways:
        d.ellipse([180, y + 18, 212, y + 50], outline=t["accent"], width=5)
        d.line([188, y + 34, 204, y + 34], fill=t["accent"], width=5)
        for j, ln in enumerate(_wrap(d, tk, f_body(54), SLIDE_W - 320)):
            d.text((260, y), ln, font=f_body(54), fill=t["text"])
            y += 72
        y += 28
    return img


def build_ppt(out_dir: Path, theme_key: str, deck: dict) -> List[str]:
    """根据 deck 描述渲染整套幻灯片图片并打包 .pptx。

    deck = {title, subtitle, tag, slides: [{heading, bullets:[(k,v)]}], takeaways:[...]}
    返回 file_paths（图片在前，.pptx 在后），与真实管线一致。
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    images: List[Image.Image] = []
    images.append(render_cover_slide(theme_key, deck["title"], deck["subtitle"], deck["tag"]))
    total = len(deck["slides"])
    for i, s in enumerate(deck["slides"], 1):
        images.append(render_content_slide(theme_key, i, total, s["heading"], s["bullets"]))
    images.append(render_closing_slide(theme_key, deck["takeaways"]))

    paths: List[str] = []
    for idx, im in enumerate(images):
        p = out_dir / f"img_{idx}.png"
        im.save(p, "PNG")
        paths.append(str(p))

    # 复用真实管线的 .pptx 打包逻辑
    from commands.studio_commands import _build_pptx
    pptx_path = out_dir / "slides.pptx"
    _build_pptx(paths, pptx_path)
    paths.append(str(pptx_path))
    return paths


# ---------------------------------------------------------------------------
# 视频合成：用 PIL 逐帧渲染 + imageio(ffmpeg) 编码 mp4
# ---------------------------------------------------------------------------
VID_W, VID_H = 1280, 720
FPS = 24


def _ease(t: float) -> float:
    return 0.5 - 0.5 * math.cos(math.pi * max(0.0, min(1.0, t)))


def _frame_base(theme_key):
    t = THEMES[theme_key]
    img = _vertical_gradient((VID_W, VID_H), t["bg_top"], t["bg_bottom"])
    return img, t


def _render_title_scene(theme_key, title, subtitle, prog):
    img, t = _frame_base(theme_key)
    d = ImageDraw.Draw(img, "RGBA")
    a = int(255 * _ease(prog * 1.6))
    tf = f_title(72)
    lines = _wrap(d, title, tf, VID_W - 160)
    total_h = len(lines) * 88
    y = (VID_H - total_h) // 2 - 30
    slide = int(40 * (1 - _ease(min(1, prog * 1.6))))
    for ln in lines:
        w = d.textlength(ln, font=tf)
        d.text(((VID_W - w) / 2, y + slide), ln, font=tf, fill=(*t["text"], a))
        y += 88
    sa = int(255 * _ease(max(0, prog - 0.3) * 1.6))
    sf = f_light(34)
    sw = d.textlength(subtitle, font=sf)
    d.text(((VID_W - sw) / 2, y + 24), subtitle, font=sf, fill=(*t["sub"], sa))
    # 强调线由中心展开
    lw = int((VID_W - 320) * _ease(prog))
    d.rounded_rectangle([(VID_W - lw) // 2, y - total_h - 40, (VID_W + lw) // 2, y - total_h - 32],
                        radius=4, fill=t["accent"])
    return img


def _render_point_scene(theme_key, index, total, heading, points: List[str], prog):
    img, t = _frame_base(theme_key)
    d = ImageDraw.Draw(img, "RGBA")
    d.rectangle([0, 0, VID_W, 8], fill=t["accent"])
    d.text((64, 54), f"{index:02d}", font=f_title(60), fill=t["accent"])
    d.text((150, 64), heading, font=f_title(48), fill=t["text"])
    d.line([64, 150, VID_W - 64, 150], fill=(*t["accent"], 150), width=2)
    # 要点逐条淡入（打字机式逐行出现）
    reveal = prog * (len(points) + 0.5)
    y = 220
    for i, p in enumerate(points):
        local = max(0.0, min(1.0, reveal - i))
        if local <= 0:
            break
        a = int(255 * _ease(local))
        dot_c = (*t["accent"], a)
        d.ellipse([64, y + 12, 84, y + 32], fill=dot_c)
        slide = int(30 * (1 - _ease(local)))
        for ln in _wrap(d, p, f_body(38), VID_W - 180):
            d.text((110 + slide, y), ln, font=f_body(38), fill=(*t["text"], a))
            y += 52
        y += 26
    d.text((64, VID_H - 50), f"{index} / {total}", font=f_body(28), fill=t["sub"])
    return img


def build_video(out_dir: Path, theme_key: str, storyboard: dict) -> str:
    """合成知识点讲解视频 mp4。

    storyboard = {title, subtitle, scenes:[{heading, points:[...], seconds}], duration}
    返回 video.mp4 路径。
    """
    import imageio.v2 as imageio

    out_dir.mkdir(parents=True, exist_ok=True)
    dest = out_dir / "video.mp4"
    writer = imageio.get_writer(
        str(dest), fps=FPS, codec="libx264", quality=8,
        macro_block_size=8, ffmpeg_log_level="error",
    )
    try:
        # 标题场景
        title_sec = 3.0
        for fr in range(int(title_sec * FPS)):
            prog = fr / (title_sec * FPS)
            frame = _render_title_scene(theme_key, storyboard["title"], storyboard["subtitle"], prog)
            writer.append_data(_to_np(frame))
        total = len(storyboard["scenes"])
        for idx, sc in enumerate(storyboard["scenes"], 1):
            sec = sc.get("seconds", 5.0)
            for fr in range(int(sec * FPS)):
                prog = fr / (sec * FPS)
                frame = _render_point_scene(theme_key, idx, total, sc["heading"], sc["points"], prog)
                writer.append_data(_to_np(frame))
        # 结尾定格
        end = _render_title_scene(theme_key, "感谢观看", storyboard.get("subtitle", ""), 1.0)
        for _ in range(int(2.0 * FPS)):
            writer.append_data(_to_np(end))
    finally:
        writer.close()
    return str(dest)


def _to_np(img: Image.Image):
    import numpy as np
    return np.asarray(img.convert("RGB"))


# ---------------------------------------------------------------------------
# 播客音频合成：macOS `say` 双人对话 -> 拼接为单个音频
# ---------------------------------------------------------------------------
def synth_podcast_audio(out_path: Path, turns: List[Tuple[str, str]],
                        voice_a="Tingting", voice_b="Sinji") -> Optional[str]:
    """用 macOS say 合成双人播客音频。

    turns = [(speaker, text), ...]，speaker 为 'host' / 'guest'。
    生成每段 aiff 再用 ffmpeg 拼接为 m4a。失败返回 None（不阻塞其他数据）。
    """
    say_bin = shutil.which("say")
    if not say_bin:
        return None
    out_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        ffmpeg = _ffmpeg_bin()
    except Exception:
        ffmpeg = None

    tmpdir = Path(tempfile.mkdtemp(prefix="podcast_"))
    seg_files: List[Path] = []
    try:
        for i, (speaker, text) in enumerate(turns):
            voice = voice_a if speaker == "host" else voice_b
            seg = tmpdir / f"seg_{i:03d}.aiff"
            subprocess.run([say_bin, "-v", voice, "-r", "180", "-o", str(seg), text],
                          check=True, capture_output=True)
            seg_files.append(seg)
        if not seg_files:
            return None
        if ffmpeg:
            # 用 concat 协议拼接并转码为 m4a
            listf = tmpdir / "list.txt"
            listf.write_text("".join(f"file '{p}'\n" for p in seg_files))
            dest = out_path.with_suffix(".m4a")
            subprocess.run(
                [ffmpeg, "-y", "-f", "concat", "-safe", "0", "-i", str(listf),
                 "-c:a", "aac", "-b:a", "128k", str(dest)],
                check=True, capture_output=True,
            )
            return str(dest)
        else:
            # 退化：仅保留第一段 aiff
            dest = out_path.with_suffix(".aiff")
            shutil.copy(seg_files[0], dest)
            return str(dest)
    except Exception:
        return None
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def _ffmpeg_bin() -> str:
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()
