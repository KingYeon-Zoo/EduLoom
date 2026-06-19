"""Unit tests for the tutoring generation-suggestion gate (Project E).

Verifies extract_generation_suggestion() correctly strips the SUGGEST_GENERATE
marker from the displayed reply and surfaces {type, prompt}, while leaving
ordinary replies untouched.
"""

from open_notebook.utils.text_utils import extract_generation_suggestion


def test_extracts_valid_suggestion():
    text = '这是讲解。<<SUGGEST_GENERATE type="video" prompt="用动画演示快速排序">>'
    cleaned, sug = extract_generation_suggestion(text)
    assert cleaned == "这是讲解。"
    assert sug == {"type": "video", "prompt": "用动画演示快速排序"}


def test_no_marker_returns_none():
    text = "这是一个普通的文字解答，没有任何建议。"
    cleaned, sug = extract_generation_suggestion(text)
    assert cleaned == text
    assert sug is None


def test_invalid_type_stripped_and_none():
    text = 'answer<<SUGGEST_GENERATE type="hologram" prompt="x">>tail'
    cleaned, sug = extract_generation_suggestion(text)
    assert "SUGGEST_GENERATE" not in cleaned
    assert sug is None


def test_marker_in_middle_is_stripped():
    text = 'before<<SUGGEST_GENERATE type="quiz" prompt="出5道选择题">>after'
    cleaned, sug = extract_generation_suggestion(text)
    assert "SUGGEST_GENERATE" not in cleaned
    assert "before" in cleaned and "after" in cleaned
    assert sug == {"type": "quiz", "prompt": "出5道选择题"}


def test_single_quotes_supported():
    text = "x<<SUGGEST_GENERATE type='mindmap' prompt='梳理知识结构'>>"
    cleaned, sug = extract_generation_suggestion(text)
    assert sug == {"type": "mindmap", "prompt": "梳理知识结构"}


def test_empty_prompt_returns_none():
    text = 'x<<SUGGEST_GENERATE type="video" prompt="">>'
    cleaned, sug = extract_generation_suggestion(text)
    assert sug is None


def test_non_string_input():
    cleaned, sug = extract_generation_suggestion(None)  # type: ignore[arg-type]
    assert cleaned == ""
    assert sug is None
