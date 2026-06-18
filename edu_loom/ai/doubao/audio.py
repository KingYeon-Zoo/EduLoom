"""Doubao audio/video understanding client (seed-2.0-lite, via Ark chat).

Unlike a plain speech-to-text model, seed-2.0-lite is a full-modal model: fed
audio (and video frames) it returns a transcription *plus* understanding in one
call. We therefore do NOT implement Esperanto's narrow SpeechToTextModel
interface (it only yields ``.text``); this is a standalone capability client,
symmetric with ``video.py`` / ``image.py``.

Verified: chat/completions accepts a base64 ``input_audio`` part with
``{"data": <b64>, "format": "mp3"}`` for ``doubao-seed-2-0-lite-260428`` (see
scripts/doubao_audio_smoke_test.py). Local files are encoded directly — no
object storage needed.

ffmpeg is provided by the ``imageio-ffmpeg`` package (a content-core
dependency), so it works without a system ffmpeg on PATH.
"""

import base64
import subprocess
from dataclasses import dataclass
from pathlib import Path

from loguru import logger

from open_notebook.ai.doubao.client import build_ark_client
from open_notebook.ai.doubao.config import DoubaoConfig, get_config
from open_notebook.ai.doubao.exceptions import DoubaoError

# File types we route to Doubao instead of content-core. Lowercase, with dot.
AUDIO_EXTENSIONS = frozenset({".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg"})
VIDEO_EXTENSIONS = frozenset({".mp4", ".mov", ".mkv", ".webm", ".avi"})

# Video sampling: a uniform sweep of frames feeds the visual channel alongside
# the audio track. Capped so the base64 request body stays bounded regardless
# of video length.
MAX_VIDEO_FRAMES = 16

# Audio is normalised to mp3 16k mono to shrink the base64 payload.
_AUDIO_SAMPLE_RATE = "16000"
_AUDIO_CHANNELS = "1"

DEFAULT_PROMPT = (
    "请先完整、逐字转写这段音频的内容；如果还提供了视频画面，请结合画面信息。"
    "转写之后，另起一段，用简洁的中文概括其核心要点。"
    "输出将作为学习资料的正文，请保证转写部分忠实于原内容。"
)


def is_media_file(file_path: str | Path | None) -> bool:
    """True if the path's extension is an audio or video type we handle."""
    if not file_path:
        return False
    suffix = Path(file_path).suffix.lower()
    return suffix in AUDIO_EXTENSIONS or suffix in VIDEO_EXTENSIONS


def _ffmpeg_exe() -> str:
    """Resolve the ffmpeg binary from imageio-ffmpeg (no system PATH needed)."""
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception as e:  # noqa: BLE001
        raise DoubaoError(
            "ffmpeg is unavailable. Install the 'imageio-ffmpeg' package "
            "(a content-core dependency) or a system ffmpeg."
        ) from e


def _run_ffmpeg(args: list[str]) -> None:
    """Run ffmpeg with the given args; raise DoubaoError on failure."""
    cmd = [_ffmpeg_exe(), "-y", "-loglevel", "error", *args]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise DoubaoError(f"ffmpeg failed: {proc.stderr.strip() or 'unknown error'}")


@dataclass
class AudioResult:
    """Outcome of an audio/video understanding call."""

    text: str  # transcription + understanding
    model: str  # the model id actually used


class DoubaoAudioClient:
    """Transcribe + understand a local audio/video file via seed-2.0-lite."""

    def __init__(self, config: DoubaoConfig | None = None):
        self._config = config or get_config()
        self._client = build_ark_client(self._config)

    async def understand(
        self,
        media_path: str | Path,
        prompt: str | None = None,
    ) -> AudioResult:
        """Read a local audio/video file and return transcription + understanding."""
        path = Path(media_path)
        if not path.exists():
            raise DoubaoError(f"Media file not found: {path}")

        suffix = path.suffix.lower()
        if suffix not in AUDIO_EXTENSIONS and suffix not in VIDEO_EXTENSIONS:
            raise DoubaoError(f"Unsupported media type for Doubao: {suffix}")

        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_dir = Path(tmp)
            audio_b64 = self._extract_audio_b64(path, tmp_dir)
            frame_b64s: list[str] = []
            if suffix in VIDEO_EXTENSIONS:
                frame_b64s = self._extract_frames_b64(path, tmp_dir)

        content: list[dict] = [
            {"type": "input_audio", "input_audio": {"data": audio_b64, "format": "mp3"}}
        ]
        for frame in frame_b64s:
            content.append(
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{frame}"},
                }
            )
        content.append({"type": "text", "text": prompt or DEFAULT_PROMPT})

        model = self._config.llm_model
        logger.info(
            f"Doubao understand: {path.name} "
            f"(audio + {len(frame_b64s)} frames, model={model})"
        )
        try:
            resp = self._client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": content}],
            )
        except Exception as e:  # noqa: BLE001 — wrapped for uniform handling
            raise DoubaoError(f"Doubao audio understanding failed: {e}") from e

        text = resp.choices[0].message.content or ""
        if not text.strip():
            raise DoubaoError("Doubao returned empty content for the media file.")
        return AudioResult(text=text, model=model)

    def _extract_audio_b64(self, path: Path, tmp_dir: Path) -> str:
        """Transcode the file's audio to mp3 16k mono and base64-encode it."""
        out = tmp_dir / "audio.mp3"
        _run_ffmpeg(
            [
                "-i", str(path),
                "-vn",  # drop video stream
                "-ar", _AUDIO_SAMPLE_RATE,
                "-ac", _AUDIO_CHANNELS,
                "-f", "mp3",
                str(out),
            ]
        )
        if not out.exists() or out.stat().st_size == 0:
            raise DoubaoError("No audio track could be extracted from the file.")
        return base64.b64encode(out.read_bytes()).decode("ascii")

    def _extract_frames_b64(self, path: Path, tmp_dir: Path) -> list[str]:
        """Sample up to MAX_VIDEO_FRAMES uniformly spaced JPEG frames."""
        duration = self._probe_duration(path)
        # Uniform sampling: one frame every (duration / MAX_VIDEO_FRAMES) seconds.
        # fps filter expression must be a rate; guard against zero-length probes.
        if duration and duration > 0:
            rate = MAX_VIDEO_FRAMES / duration
            vf = f"fps={rate:.6f}"
        else:
            vf = "fps=1"  # fallback: 1 frame/sec, capped by -frames:v below

        pattern = str(tmp_dir / "frame_%03d.jpg")
        _run_ffmpeg(
            [
                "-i", str(path),
                "-vf", vf,
                "-frames:v", str(MAX_VIDEO_FRAMES),
                "-q:v", "5",
                pattern,
            ]
        )
        frames = sorted(tmp_dir.glob("frame_*.jpg"))
        if not frames:
            logger.warning(f"No frames extracted from {path.name}; audio-only.")
        return [base64.b64encode(f.read_bytes()).decode("ascii") for f in frames]

    def _probe_duration(self, path: Path) -> float | None:
        """Return media duration in seconds via ffmpeg, or None if unknown."""
        cmd = [_ffmpeg_exe(), "-i", str(path), "-hide_banner"]
        proc = subprocess.run(cmd, capture_output=True, text=True)
        # ffmpeg prints "Duration: HH:MM:SS.xx" to stderr.
        for line in proc.stderr.splitlines():
            line = line.strip()
            if line.startswith("Duration:"):
                ts = line.split("Duration:")[1].split(",")[0].strip()
                try:
                    h, m, s = ts.split(":")
                    return int(h) * 3600 + int(m) * 60 + float(s)
                except ValueError:
                    return None
        return None
