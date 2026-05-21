import os
from typing import TypedDict

from dotenv import load_dotenv
from langgraph.graph import StateGraph, START, END
from langchain_groq import ChatGroq

load_dotenv()


class NewsState(TypedDict):
    input_text: str
    extracted_text: str
    verification_result: str
    linkedin_post: str


llm = ChatGroq(
    model=os.getenv("GROQ_TEXT_MODEL", "llama-3.1-8b-instant"),
    temperature=0.2,
    api_key=os.getenv("GROQ_API_KEY"),
)


def input_agent(state: NewsState):
    text = state["input_text"]

    if not text or text.strip() == "":
        text = "No readable news text was provided."

    return {
        "extracted_text": text[:5000]
    }


def verification_agent(state: NewsState):
    prompt = f"""
You are an AI fake news verification assistant.

Analyze the given news content.

Important:
- Do not claim something is true without evidence.
- If content is too short or unclear, say verification is limited.
- Give practical next verification steps.

Return only this format:

Verdict: Real / Partly Real / Misleading / Fake / Unclear
Confidence: 0-100%
Reason:
Warning Signs:
What user should verify next:

News Content:
{state["extracted_text"]}
"""

    response = llm.invoke(prompt)

    return {
        "verification_result": response.content
    }


def content_agent(state: NewsState):
    prompt = f"""
Create a professional LinkedIn post based on this fake news analysis.

Rules:
- Keep it short and clear.
- Do not make unsupported claims.
- Mention that users should verify before sharing.
- Add 3 to 5 hashtags.

Fake News Analysis:
{state["verification_result"]}
"""

    response = llm.invoke(prompt)

    return {
        "linkedin_post": response.content
    }


workflow = StateGraph(NewsState)

workflow.add_node("input_agent", input_agent)
workflow.add_node("verification_agent", verification_agent)
workflow.add_node("content_agent", content_agent)

workflow.add_edge(START, "input_agent")
workflow.add_edge("input_agent", "verification_agent")
workflow.add_edge("verification_agent", "content_agent")
workflow.add_edge("content_agent", END)

app_graph = workflow.compile()