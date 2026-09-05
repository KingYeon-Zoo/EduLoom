"""安全版 Pillow 与当前 MoviePy 图像管线的兼容回归。"""
import numpy as np
from PIL import Image
from moviepy import ImageClip, CompositeVideoClip, vfx


def test_pillow_moviepy_image_pipeline(tmp_path):
    path = tmp_path / "图像.png"
    Image.new("RGB", (32, 24), (120, 30, 80)).save(path)
    with Image.open(path) as image:
        frame = np.array(image.convert("RGB"))
    clip = ImageClip(frame).with_duration(1)
    resized = clip.with_effects([vfx.Resize((64, 48)), vfx.Rotate(90)])
    assert resized.get_frame(0).shape == (64, 48, 3)
    composite = CompositeVideoClip([resized.with_position("center")], size=(80, 80))
    assert composite.get_frame(0).shape == (80, 80, 3)
    composite.save_frame(str(tmp_path / "结果.png"), t=0)
    with Image.open(tmp_path / "结果.png") as result:
        assert result.size == (80, 80)
    composite.close()
    resized.close()
    clip.close()
