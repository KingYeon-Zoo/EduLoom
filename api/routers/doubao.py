from fastapi import APIRouter
from pydantic import BaseModel

from open_notebook.ai.doubao.voices import DEFAULT_VOICE_ID, list_voices

router = APIRouter()


class VoiceResponse(BaseModel):
    id: str
    name: str
    gender: str


class VoiceListResponse(BaseModel):
    default: str
    voices: list[VoiceResponse]


@router.get("/doubao/voices", response_model=VoiceListResponse)
async def list_doubao_voices():
    """List the built-in Doubao 2.0 narration voices for the voice picker."""
    return VoiceListResponse(
        default=DEFAULT_VOICE_ID,
        voices=[
            VoiceResponse(id=v.id, name=v.name, gender=v.gender)
            for v in list_voices()
        ],
    )
