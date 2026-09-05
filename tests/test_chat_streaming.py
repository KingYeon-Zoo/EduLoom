from langchain_core.messages import AIMessage, HumanMessage

from api.routers.chat import _get_new_ai_messages


def test_get_new_ai_messages_excludes_session_history():
    previous = [
        HumanMessage(content="旧问题"),
        AIMessage(content="旧回答"),
        HumanMessage(content="新问题"),
    ]
    result = [*previous, AIMessage(content="新回答")]

    new_messages = _get_new_ai_messages(result, previous_ai_count=1)

    assert [message.content for message in new_messages] == ["新回答"]


def test_get_new_ai_messages_keeps_multiple_new_ai_messages():
    result = [
        AIMessage(content="旧回答"),
        HumanMessage(content="新问题"),
        AIMessage(content="新回答第一段"),
        AIMessage(content="新回答第二段"),
    ]

    new_messages = _get_new_ai_messages(result, previous_ai_count=1)

    assert [message.content for message in new_messages] == [
        "新回答第一段",
        "新回答第二段",
    ]
