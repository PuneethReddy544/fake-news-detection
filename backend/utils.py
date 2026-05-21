import os
import base64
import requests
from bs4 import BeautifulSoup
from pypdf import PdfReader
from groq import Groq


def limit_text(text: str, max_words: int = 1200) -> str:
    words = text.split()
    return " ".join(words[:max_words])


def extract_text_from_url(url: str) -> str:
    try:
        response = requests.get(
            url,
            timeout=10,
            headers={"User-Agent": "Mozilla/5.0"}
        )

        soup = BeautifulSoup(response.text, "html.parser")

        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()

        text = soup.get_text(separator=" ")
        text = " ".join(text.split())

        if not text:
            return "No readable text found from URL."

        return limit_text(text, 1200)

    except Exception as e:
        return f"URL extraction failed: {str(e)}"


def extract_text_from_pdf(file_path: str) -> str:
    try:
        reader = PdfReader(file_path)
        text = ""

        for page in reader.pages[:3]:
            text += page.extract_text() or ""

        text = text.strip()

        if not text:
            return "No readable text found in PDF."

        return limit_text(text, 1200)

    except Exception as e:
        return f"PDF extraction failed: {str(e)}"


def extract_text_from_image(file_path: str) -> str:
    try:
        api_key = os.getenv("OCR_SPACE_API_KEY", "helloworld")

        with open(file_path, "rb") as image_file:
            response = requests.post(
                "https://api.ocr.space/parse/image",
                files={"file": image_file},
                data={
                    "apikey": api_key,
                    "language": "eng",
                    "isOverlayRequired": False,
                },
                timeout=30,
            )

        result = response.json()

        if result.get("IsErroredOnProcessing"):
            return "No readable text found in image."

        parsed_results = result.get("ParsedResults", [])

        if not parsed_results:
            return "No readable text found in image."

        text = parsed_results[0].get("ParsedText", "").strip()

        if not text:
            return "No readable text found in image."

        return limit_text(text, 1000)

    except Exception as e:
        return f"Image OCR failed: {str(e)}"


def detect_ai_generated_image(file_path: str) -> str:
    try:
        client = Groq(api_key=os.getenv("GROQ_API_KEY"))

        with open(file_path, "rb") as image_file:
            encoded_image = base64.b64encode(image_file.read()).decode("utf-8")

        model = os.getenv(
            "GROQ_VISION_MODEL",
            "meta-llama/llama-4-scout-17b-16e-instruct"
        )

        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": """
Analyze this image.

Task:
Check whether the image looks AI-generated, edited, manipulated, or natural.

Return only this format:

AI Image Verdict: Likely AI-generated / Possibly edited / Possibly real / Unclear
Confidence: 0-100%
Reasons:
- 
- 
- 
Warning: This is visual AI analysis only, not forensic proof.
"""
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{encoded_image}"
                            }
                        }
                    ]
                }
            ],
            temperature=0.2,
            max_tokens=350
        )

        return response.choices[0].message.content

    except Exception as e:
        return f"AI image detection failed: {str(e)}"