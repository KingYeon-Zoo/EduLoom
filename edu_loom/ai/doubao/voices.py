"""Built-in Doubao 2.0 voice catalog (seed-tts-2.0).

All voices are '*_uranus_bigtts' (required by seed-tts-2.0). The list is
curated for blog/podcast narration — general / conversational / reading
voices only; short-video character voices are intentionally excluded.

This is the single source of truth for the voice picker (frontend dropdown)
and is served verbatim by the GET /doubao/voices endpoint.
"""

from dataclasses import dataclass

DEFAULT_VOICE_ID = "zh_female_shuangkuaisisi_uranus_bigtts"


@dataclass(frozen=True)
class Voice:
    """A selectable Doubao voice."""

    id: str  # voice_type, e.g. zh_female_vv_uranus_bigtts
    name: str  # Chinese display name
    gender: str  # "female" | "male"


# Curated narration voices, in display order (default first).
BUILTIN_VOICES: list[Voice] = [
    Voice("zh_female_shuangkuaisisi_uranus_bigtts", "爽快思思", "female"),
    Voice("zh_female_tianmeixiaoyuan_uranus_bigtts", "甜美小源", "female"),
    Voice("zh_female_vv_uranus_bigtts", "Vivi", "female"),
    Voice("zh_female_xiaohe_uranus_bigtts", "小何", "female"),
    Voice("zh_female_cancan_uranus_bigtts", "知性灿灿", "female"),
    Voice("zh_male_m191_uranus_bigtts", "云舟", "male"),
    Voice("zh_male_taocheng_uranus_bigtts", "小天", "male"),
    Voice("zh_female_kefunvsheng_uranus_bigtts", "暖阳女声", "female"),
]


def list_voices() -> list[Voice]:
    """Return the built-in voice catalog."""
    return list(BUILTIN_VOICES)


def is_builtin(voice_id: str) -> bool:
    """Whether ``voice_id`` is one of the built-in voices."""
    return any(v.id == voice_id for v in BUILTIN_VOICES)
