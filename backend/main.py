import os
import shutil

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware

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
            "LinkedIn post generation"
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