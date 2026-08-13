#!/usr/bin/env python3
"""EduLoom macOS 可执行版的后端入口。"""

import os

import uvicorn

from api.main import app


if __name__ == "__main__":
    uvicorn.run(
        app,
        host=os.getenv("API_HOST", "127.0.0.1"),
        port=int(os.getenv("API_PORT", "5055")),
        reload=False,
        log_level=os.getenv("API_LOG_LEVEL", "info"),
    )
