import os
import shutil
import requests

from urllib.parse import urlencode
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from graph import app_graph
from utils import (
    extract_text_from_url,
    extract_text_from_pdf,
    extract_text_from_image,
    detect_ai_generated_image,
)

app = FastAPI(title="AI Fake News Detector")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

linkedin_sessions = {}


def save_uploaded_file(file: UploadFile) -> str:
    os.makedirs("uploads", exist_ok=True)
    file_path = f"uploads/{file.filename}"

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return file_path


def run_fake_news_graph(text: str):
    result = app_graph.invoke({
        "input_text": text,
        "extracted_text": "",
        "verification_result": "",
        "linkedin_post": "",
    })

    return result


@app.get("/")
def home():
    return {
        "message": "AI Fake News Detector Backend is running",
        "features": [
            "Text fake news detection",
            "URL fake news detection",
            "PDF fake news detection",
            "Image OCR fake news detection",
            "AI-generated image analysis",
            "LinkedIn post generation",
            "Optional LinkedIn OAuth Publisher"
        ]
    }


@app.post("/check-text")
def check_text(news_text: str = Form(...)):
    return run_fake_news_graph(news_text)


@app.post("/check-url")
def check_url(url: str = Form(...)):
    extracted_text = extract_text_from_url(url)
    return run_fake_news_graph(extracted_text)


@app.post("/check-pdf")
def check_pdf(file: UploadFile = File(...)):
    file_path = save_uploaded_file(file)
    extracted_text = extract_text_from_pdf(file_path)
    return run_fake_news_graph(extracted_text)


@app.post("/check-image")
def check_image(file: UploadFile = File(...)):
    file_path = save_uploaded_file(file)

    ocr_text = extract_text_from_image(file_path)
    ai_image_result = detect_ai_generated_image(file_path)
    fake_news_result = run_fake_news_graph(ocr_text)

    return {
        "ocr_text": ocr_text,
        "ai_image_detection": ai_image_result,
        "fake_news_analysis": fake_news_result
    }


@app.get("/linkedin/login")
def linkedin_login():
    params = {
        "response_type": "code",
        "client_id": os.getenv("LINKEDIN_CLIENT_ID"),
        "redirect_uri": os.getenv("LINKEDIN_REDIRECT_URI"),
        "scope": "openid profile w_member_social",
    }

    login_url = "https://www.linkedin.com/oauth/v2/authorization?" + urlencode(params)

    return {
        "login_url": login_url
    }


@app.get("/linkedin/callback")
def linkedin_callback(code: str):
    token_response = requests.post(
        "https://www.linkedin.com/oauth/v2/accessToken",
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": os.getenv("LINKEDIN_REDIRECT_URI"),
            "client_id": os.getenv("LINKEDIN_CLIENT_ID"),
            "client_secret": os.getenv("LINKEDIN_CLIENT_SECRET"),
        },
        headers={
            "Content-Type": "application/x-www-form-urlencoded"
        },
    )

    token_data = token_response.json()
    access_token = token_data.get("access_token")

    if not access_token:
        return {
            "error": "LinkedIn login failed",
            "details": token_data
        }

    profile_response = requests.get(
        "https://api.linkedin.com/v2/userinfo",
        headers={
            "Authorization": f"Bearer {access_token}"
        },
    )

    profile_data = profile_response.json()
    linkedin_user_id = profile_data.get("sub")

    if not linkedin_user_id:
        return {
            "error": "Could not get LinkedIn user ID",
            "details": profile_data
        }

    linkedin_sessions[linkedin_user_id] = {
        "access_token": access_token,
        "profile": profile_data,
    }

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")

    return RedirectResponse(
        url=f"{frontend_url}?linkedin_user_id={linkedin_user_id}&linkedin_login=success"
    )


def linkedin_publisher_agent(access_token: str, linkedin_user_id: str, post_text: str):
    payload = {
        "author": f"urn:li:person:{linkedin_user_id}",
        "lifecycleState": "PUBLISHED",
        "specificContent": {
            "com.linkedin.ugc.ShareContent": {
                "shareCommentary": {
                    "text": post_text
                },
                "shareMediaCategory": "NONE"
            }
        },
        "visibility": {
            "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
        }
    }

    response = requests.post(
        "https://api.linkedin.com/v2/ugcPosts",
        headers={
            "Authorization": f"Bearer {access_token}",
            "X-Restli-Protocol-Version": "2.0.0",
            "Content-Type": "application/json",
        },
        json=payload,
    )

    try:
        result = response.json()
    except Exception:
        result = response.text

    return response.status_code, result


@app.post("/linkedin/post")
def post_to_linkedin(
    linkedin_user_id: str = Form(...),
    post_text: str = Form(...)
):
    session = linkedin_sessions.get(linkedin_user_id)

    if not session:
        return {
            "success": False,
            "message": "User not logged in with LinkedIn"
        }

    status_code, result = linkedin_publisher_agent(
        access_token=session["access_token"],
        linkedin_user_id=linkedin_user_id,
        post_text=post_text,
    )

    return {
        "success": 200 <= status_code < 300,
        "status_code": status_code,
        "linkedin_response": result,
    }