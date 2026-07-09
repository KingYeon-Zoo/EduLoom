"""
Authentication router for Open Notebook API.
Provides endpoints to check authentication status, handle registration, login, and captcha.
"""

import hashlib
import random
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, status
from loguru import logger
from pydantic import BaseModel

from api.auth import generate_token
from open_notebook.database.repository import repo_create, repo_query

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str
    captcha_key: str
    captcha_code: str


class RegisterRequest(BaseModel):
    username: str
    password: str


def generate_captcha_svg(code: str) -> str:
    """Generate a simple, dependency-free SVG captcha image."""
    width = 120
    height = 40
    
    # Random background noise lines
    lines = []
    for _ in range(4):
        x1 = random.randint(0, width)
        y1 = random.randint(0, height)
        x2 = random.randint(0, width)
        y2 = random.randint(0, height)
        lines.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="gray" stroke-width="1" opacity="0.3" />')
        
    # Random noise dots
    dots = []
    for _ in range(30):
        cx = random.randint(0, width)
        cy = random.randint(0, height)
        r = random.randint(1, 2)
        dots.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="gray" opacity="0.2" />')
    
    # Text characters rendering with random rotation and font color
    chars = []
    font_size = 24
    for i, char in enumerate(code):
        x = 15 + i * 25 + random.randint(-3, 3)
        y = 28 + random.randint(-4, 4)
        angle = random.randint(-15, 15)
        color = random.choice(["#2c3e50", "#16a085", "#27ae60", "#2980b9", "#8e44ad", "#d35400"])
        chars.append(
            f'<text x="{x}" y="{y}" font-family="monospace" font-weight="bold" font-size="{font_size}" fill="{color}" transform="rotate({angle} {x} {y})">{char}</text>'
        )
        
    svg_content = f"""<svg width="{width}" height="{height}" xmlns="http://www.w3.org/2000/svg" style="background: #f8f9fa; border-radius: 4px; border: 1px solid #dee2e6; user-select: none;">
        {"".join(lines)}
        {"".join(dots)}
        {"".join(chars)}
    </svg>"""
    return svg_content


@router.get("/status")
async def get_auth_status():
    """
    Check if authentication is enabled.
    Returns whether authentication is required to access the API.
    Always returns true to show login screen for EduLoom.
    """
    return {
        "auth_enabled": True,
        "message": "Authentication is required",
    }


@router.get("/captcha")
async def get_captcha():
    """Generate a captcha code and return the SVG image and captcha key."""
    # Clean up expired captchas first
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        await repo_query("DELETE captcha WHERE expires_at < $now", {"now": now_iso})
    except Exception as e:
        logger.warning(f"Failed to clean expired captchas: {e}")
        
    # Generate 4 characters (excluding confusing characters like 0, O, 1, I, l)
    chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
    code = "".join(random.choice(chars) for _ in range(4))
    captcha_key = str(uuid.uuid4())
    
    svg = generate_captcha_svg(code)
    
    # Store captcha in SurrealDB with 2 minutes expiry
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=2)).isoformat()
    await repo_create("captcha", {
        "key": captcha_key,
        "code": code.lower(),
        "expires_at": expires_at
    })
    
    return {
        "captcha_key": captcha_key,
        "captcha_svg": svg
    }


@router.post("/register")
async def register(req: RegisterRequest):
    """Register a new user account."""
    username = req.username.strip()
    password = req.password
    
    if not username or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username and password are required"
        )
        
    # Check if username exists with table presence check
    try:
        existing = await repo_query("SELECT * FROM user WHERE username = $username", {"username": username})
    except RuntimeError as e:
        if "does not exist" in str(e):
            existing = []
        else:
            raise

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )
        
    # Hash password using sha256
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    # Store in database
    await repo_create("user", {
        "username": username,
        "password": password_hash,
        "role": "user"
    })
    
    return {"message": "User registered successfully"}


@router.post("/login")
async def login(req: LoginRequest):
    """Authenticate credentials and return a token."""
    username = req.username.strip()
    password = req.password
    captcha_key = req.captcha_key
    captcha_code = req.captcha_code.strip().lower()
    
    if not username or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username and password are required"
        )
        
    # 1. Verify captcha
    try:
        captcha_records = await repo_query(
            "SELECT * FROM captcha WHERE key = $key", 
            {"key": captcha_key}
        )
    except RuntimeError as e:
        if "does not exist" in str(e):
            captcha_records = []
        else:
            raise

    if not captcha_records:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Captcha not found or expired"
        )
        
    captcha_rec = captcha_records[0]
    
    # Delete captcha immediately after retrieve using key query to avoid RecordID deletion issues
    try:
        await repo_query("DELETE captcha WHERE key = $key", {"key": captcha_key})
    except Exception as e:
        logger.warning(f"Failed to delete verified captcha record: {e}")
        
    # Verify code
    if captcha_rec.get("code") != captcha_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid captcha code"
        )
        
    # Verify expiration
    expires_at_str = captcha_rec.get("expires_at")
    if expires_at_str:
        try:
            expires_at = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
            if datetime.now(timezone.utc) > expires_at:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Captcha code expired"
                )
        except ValueError:
            pass
            
    # 2. Verify user credentials
    try:
        user_records = await repo_query(
            "SELECT * FROM user WHERE username = $username", 
            {"username": username}
        )
    except RuntimeError as e:
        if "does not exist" in str(e):
            user_records = []
        else:
            raise

    if not user_records:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
        
    user_rec = user_records[0]
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    if user_rec.get("password") != password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
        
    # 3. Generate token
    token = generate_token(username)
    return {
        "token": token,
        "username": username
    }