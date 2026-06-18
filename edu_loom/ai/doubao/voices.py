"""Built-in Doubao 2.0 voice catalog (seed-tts-2.0).

All voices are '*_uranus_bigtts' (required by seed-tts-2.0). The list is
curated for blog/podcast narration — general / conversational / reading
voices only; short-video character voices are intentionally excluded.

This is the single source of truth for the voice picker (frontend dropdown)
and is served verbatim by the GET /doubao/voices endpoint.
"""

from dataclasses import dataclass

DEFAULT_VOICE_ID = "zh_female_yingyujiaoxue_uranus_bigtts"


@dataclass(frozen=True)
class Voice:
    """A selectable Doubao voice."""

    id: str  # voice_type, e.g. zh_female_vv_uranus_bigtts
    name: str  # Chinese display name
    gender: str  # "female" | "male"
    description: str  # Description of the voice


# Curated narration voices, in display order (default first).
BUILTIN_VOICES: list[Voice] = [
    # 女性音色
    Voice("zh_female_yingyujiaoxue_uranus_bigtts", "Tina老师 2.0", "female", "磁性知性的青年讲师，温柔耐心，专业靠谱"),
    Voice("zh_female_vv_uranus_bigtts", "Vivi 2.0 🌸", "female", "语调平稳、咬字柔和、自带治愈安抚力的女声音色"),
    Voice("zh_female_xinlingjitang_uranus_bigtts", "心灵鸡汤 2.0", "female", "语调温暖、语气治愈，充满正能量的女声"),
    Voice("zh_female_zhixingnv_uranus_bigtts", "知性女声 2.0", "female", "语调沉稳、咬字清晰，气质知性的成熟女声"),
    Voice("zh_female_linxiao_uranus_bigtts", "林潇 2.0", "female", "声线清冷干净、语调沉稳，气质清冷的青年女声"),
    Voice("ICL_uranus_zh_female_nuanxinxuejie_tob", "暖心学姐 2.0", "female", "温暖明亮的知性学姐，阳光热情，坦诚直率"),
    Voice("zh_female_kailangjiejie_uranus_bigtts", "开朗姐姐 2.0", "female", "语调明快、声线爽朗，阳光开朗的大姐姐音"),
    Voice("zh_female_jitangmei_uranus_bigtts", "鸡汤妹妹/Hope 2.0", "female", "语调温暖、语气治愈，充满正能量的甜妹音"),
    Voice("zh_female_liuchangnv_uranus_bigtts", "流畅女声 2.0", "female", "温暖爽朗的小妹，阳光热情，性格直爽好相处"),
    Voice("ICL_uranus_zh_female_tianmeixiaoju_tob", "甜美小橘 2.0", "female", "温柔知性的辅导员，善解人意超会疏导学生"),

    # 男性音色
    Voice("zh_male_jieshuoxiaoming_uranus_bigtts", "解说小明 2.0", "male", "语速明快、中气十足，充满激情与感染力的解说男声"),
    Voice("zh_male_dayi_uranus_bigtts", "大壹 2.0", "male", "历经世事的沉稳大叔，果敢可靠，让人安心信赖"),
    Voice("zh_male_wenrouxiaoge_uranus_bigtts", "温柔小哥 2.0", "male", "语调温柔、声线干净，气质谦和的青年男声"),
    Voice("zh_male_cixingjieshuonan_uranus_bigtts", "磁性解说男声/Morgan 2.0", "male", "声线磁性浑厚、语调沉稳，专业感拉满的解说男声"),
    Voice("zh_male_qingshuangnanda_uranus_bigtts", "清爽男大 2.0", "male", "声线干净清爽、语气阳光，元气满满的大学生音"),
    Voice("zh_male_youyoujunzi_uranus_bigtts", "悠悠君子 2.0", "male", "语调温润、声线清雅，书卷气十足的君子音"),
    Voice("zh_male_kailangxuezhang_uranus_bigtts", "开朗学长 2.0", "male", "声线阳光、语气爽朗，阳光开朗的学长音"),
    Voice("zh_male_ruyaqingnian_uranus_bigtts", "儒雅青年 2.0", "male", "语调温润、咬字文雅，书卷气十足的知性男声"),
    Voice("ICL_uranus_zh_male_zifuqingnian_tob", "自负青年 2.0", "male", "张扬明亮的富家公子哥，性格傲慢嚣张，自带强势气场"),
    Voice("ICL_uranus_zh_male_zhongerqingnian_tob", "中二青年 2.0", "male", "张扬清亮的自信青年，性格自信傲慢，行事格外张扬"),
]


def list_voices() -> list[Voice]:
    """Return the built-in voice catalog."""
    return list(BUILTIN_VOICES)


def is_builtin(voice_id: str) -> bool:
    """Whether ``voice_id`` is one of the built-in voices."""
    return any(v.id == voice_id for v in BUILTIN_VOICES)
