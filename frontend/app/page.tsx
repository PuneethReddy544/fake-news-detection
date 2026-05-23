"use client";

import { DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Copy,
  FileText,
  ImageIcon,
  Link2,
  Loader2,
  Search,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";


const BACKEND_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://fake-news-detection-bsys.onrender.com";


type InputMode = "text" | "url" | "pdf" | "image" | "news";

interface NewsAnalysis {
  verdict: string;
  confidence: number;
  reasoning: string;
  warnings: string[];
  suggestions: string[];
  linkedInPost: string;
  sources: string[];
  raw: string;
}

interface ImageAnalysis {
  ocrText: string;
  imageDetection: string;
  fakeNewsAnalysis: string;
  aiConfidence: number;
  highlights: string[];
  suggestions: string[];
  linkedInPost: string;
  raw: string;
}

interface FetchedArticle {
  title: string;
  description?: string;
  content?: string;
  url: string;
  published_at?: string;
  source?: string;
}


type ResultState =
  | { kind: "analysis"; data: NewsAnalysis }
  | { kind: "image"; data: ImageAnalysis }
  | null;

const tabs: Array<{
  id: InputMode;
  label: string;
  icon: typeof FileText;
  description: string;
  placeholder: string;
  accept: string;
}> = [
  {
    id: "text",
    label: "Text",
    icon: FileText,
    description: "Paste suspicious news copy for quick verification.",
    placeholder: "Enter the news text you want to verify...",
    accept: "",
  },
  {
    id: "url",
    label: "URL",
    icon: Link2,
    description: "Validate a news article link with AI context analysis.",
    placeholder: "Paste the article or social post URL...",
    accept: "",
  },
  {
    id: "news",
    label: "Latest News",
    icon: Search,
    description: "Fetch newest articles based on a topic and verify them.",
    placeholder: "Enter a topic like AI, politics, cricket, health...",
    accept: "",
  },
  {
    id: "pdf",
    label: "PDF",
    icon: Search,
    description: "Upload a PDF report or article to extract and verify claims.",
    placeholder: "Drag or upload a PDF document.",
    accept: ".pdf",
  },
  {
    id: "image",
    label: "Image",
    icon: ImageIcon,
    description: "Upload an image to run OCR and detect manipulated content.",
    placeholder: "Drag or upload a screenshot or news image.",
    accept: "image/*",
  },
];

function normalizeResponse(raw: string) {
  return raw.replace(/\r/g, "").trim();
}

function findSection(raw: string, keys: string[]) {
  const pattern = `(?:${keys.join("|")})[:\-]?\\s*([\\s\\S]+?)(?=\\n(?:Verdict|Decision|Confidence|Score|Reason|Reasoning|Warning|Warnings|Suggestion|Suggestions|LinkedIn|OCR|Image|Analysis|Detection|Sources|Source|$))`;
  const match = new RegExp(pattern, "i").exec(raw);
  return match?.[1]?.trim();
}

function splitList(raw?: string) {
  if (!raw) {
    return [];
  }
  return raw
    .split(/[\n;•\-]+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseConfidence(raw?: string) {
  const value = raw?.replace(/[^\d.]/g, "").trim();
  if (!value) {
    return 0;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return 0;
  }
  return Math.min(100, Math.max(0, parsed));
}
function parseNewsAnalysis(raw: string): NewsAnalysis {
  const normalized = normalizeResponse(raw);

  const verdictMatch =
    normalized.match(/Verdict:\s*(.*)/i);

  const confidenceMatch =
    normalized.match(/Confidence:\s*(\d+)%/i);

  const reasonMatch =
    normalized.match(
      /Reason:\s*([\s\S]*?)(Warning Signs:|What user should verify next:|LinkedIn Post:|$)/i
    );

  const warningMatch =
    normalized.match(
      /Warning Signs:\s*([\s\S]*?)(What user should verify next:|LinkedIn Post:|$)/i
    );

  const verifyMatch =
    normalized.match(
      /What user should verify next:\s*([\s\S]*?)(LinkedIn Post:|$)/i
    );

  const linkedinMatch =
    normalized.match(/LinkedIn Post:\s*([\s\S]*)/i);

  const verdict = verdictMatch?.[1]?.trim() || "Undetermined";

  const confidence = confidenceMatch
    ? Number(confidenceMatch[1])
    : 0;

  const reasoning =
    reasonMatch?.[1]?.trim() ||
    "No AI reasoning was provided.";

  const warnings = warningMatch?.[1]
    ? splitList(warningMatch[1])
    : [];

  const suggestions = verifyMatch?.[1]
    ? splitList(verifyMatch[1])
    : [];

  const linkedInPost =
    linkedinMatch?.[1]?.trim() ||
    "No LinkedIn post generated.";

  return {
    verdict,
    confidence,
    reasoning,
    warnings,
    suggestions,
    linkedInPost,
    sources: [],
    raw: normalized,
  };
}
// function parseNewsAnalysis(raw: string): NewsAnalysis {
//   const normalized = normalizeResponse(raw);
//   const verdict = findSection(normalized, ["verdict", "decision", "outcome", "result"]) || "Undetermined";
//   const confidence = parseConfidence(findSection(normalized, ["confidence", "score", "certainty"]));
//   const reasoning =
//     findSection(normalized, ["reasoning", "analysis", "explanation", "rationale"]) ||
//     findSection(normalized, ["reason"]) ||
//     "No AI reasoning was provided by the backend.";
//   const warnings = splitList(findSection(normalized, ["warning signs", "warnings", "red flags", "issues", "concerns"]));
//   const suggestions = splitList(findSection(normalized, ["suggestion", "recommendation", "next steps", "verify", "action items"]));
//   const linkedInPost =
//     findSection(normalized, ["linkedin generated post", "linkedin post", "social share", "post"]) ||
//     `AI says this news is ${verdict.toLowerCase()} with ${confidence}% confidence.`;
//   const sources = splitList(findSection(normalized, ["source verification", "sources", "origin", "reference"]));

//   return {
//     verdict,
//     confidence,
//     reasoning,
//     warnings,
//     suggestions,
//     linkedInPost,
//     sources,
//     raw: normalized,
//   };
// }

function parseImageAnalysis(raw: string): ImageAnalysis {
  const normalized = normalizeResponse(raw);
  const ocrText =
    findSection(normalized, ["ocr extracted text", "ocr text", "ocr", "extracted text"]) ||
    "No OCR text was extracted from the uploaded image.";
  const imageDetection =
    findSection(normalized, ["ai-generated image", "image detection", "image authenticity", "image analysis", "image classification"]) ||
    "No image authenticity summary was provided.";
  const fakeNewsAnalysis =
    findSection(normalized, ["fake news analysis", "fake news", "news analysis", "analysis"]) ||
    "No fake news reasoning was available.";
  const aiConfidence = parseConfidence(findSection(normalized, ["confidence", "score", "certainty"]));
  const highlights = splitList(findSection(normalized, ["highlights", "key findings", "takeaways", "observations"]));
  const suggestions = splitList(findSection(normalized, ["suggestion", "recommendation", "next steps", "action items"]));
  const linkedInPost =
    findSection(normalized, ["linkedin generated post", "linkedin post", "linkedin blog post", "social share", "post"]) ||
    "No LinkedIn post was returned.";

  return {
    ocrText,
    imageDetection,
    fakeNewsAnalysis,
    aiConfidence,
    highlights,
    suggestions,
    linkedInPost,
    raw: normalized,
  };
}

function statusTone(verdict: string) {
  const normalized = verdict.toLowerCase();
  if (normalized.includes("fake") || normalized.includes("false") || normalized.includes("manipulated")) {
    return "bg-rose-500/15 text-rose-200 border-rose-500/20";
  }
  if (normalized.includes("true") || normalized.includes("real") || normalized.includes("credible") || normalized.includes("trusted")) {
    return "bg-emerald-500/15 text-emerald-200 border-emerald-500/20";
  }
  return "bg-zinc-800/70 text-zinc-100 border-zinc-700";
}

function resultTone(verdict: string) {
  const normalized = verdict.toLowerCase();
  if (normalized.includes("fake") || normalized.includes("false") || normalized.includes("manipulated")) {
    return "text-rose-400";
  }
  if (normalized.includes("true") || normalized.includes("real") || normalized.includes("credible") || normalized.includes("trusted")) {
    return "text-emerald-300";
  }
  return "text-zinc-300";
}

function copyToClipboard(value: string, setMessage: (message: string) => void) {
  if (!navigator.clipboard) {
    setMessage("Clipboard access is unavailable.");
    return;
  }
  navigator.clipboard
    .writeText(value)
    .then(() => setMessage("Copied!"))
    .catch(() => setMessage("Unable to copy."));
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<InputMode>("text");
  const [textValue, setTextValue] = useState("");
  const [urlValue, setUrlValue] = useState("");
  const [newsTopic, setNewsTopic] = useState("");
  const [newsArticles, setNewsArticles] = useState<FetchedArticle[]>([]);
  const [fetchingNews, setFetchingNews] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<ResultState>(null);
  const [copyMessage, setCopyMessage] = useState<string>("");
  const [linkedinUserId, setLinkedinUserId] = useState<string>("");
  const [linkedinStatus, setLinkedinStatus] = useState<string>("");
  const [postingToLinkedIn, setPostingToLinkedIn] = useState(false);
  const [expandedPanel, setExpandedPanel] = useState<string>("ai");
  const dragRef = useRef<HTMLDivElement | null>(null);

  const activeTabConfig = useMemo(() => tabs.find((tab) => tab.id === activeTab) ?? tabs[0], [activeTab]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const userIdFromUrl = params.get("linkedin_user_id");
    const loginStatus = params.get("linkedin_login");

    if (userIdFromUrl) {
      localStorage.setItem("linkedin_user_id", userIdFromUrl);
      setLinkedinUserId(userIdFromUrl);
    } else {
      const storedUserId = localStorage.getItem("linkedin_user_id");
      if (storedUserId) {
        setLinkedinUserId(storedUserId);
      }
    }

    if (loginStatus === "success") {
      setLinkedinStatus("LinkedIn login successful. You can now post the generated blog.");
    }
  }, []);


  const handleSelectTab = (tabId: InputMode) => {
    setActiveTab(tabId);
    setErrorMessage(null);
    setResult(null);
    setCopyMessage("");
    setNewsArticles([]);
  };

  const handleFileChange = (file: File | null) => {
    setErrorMessage(null);
    if (file) {
      if (activeTab === "pdf" && file.type !== "application/pdf") {
        setErrorMessage("Please upload a valid PDF file.");
        return;
      }
      if (activeTab === "image" && !file.type.startsWith("image/")) {
        setErrorMessage("Please upload a valid image file.");
        return;
      }
    }
    if (activeTab === "pdf") {
      setPdfFile(file);
    }
    if (activeTab === "image") {
      setImageFile(file);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files[0];
    handleFileChange(droppedFile || null);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const buildFormData = (): FormData | null => {
    const formData = new FormData();
    if (activeTab === "text") {
      if (!textValue.trim()) {
        setErrorMessage("Enter a news text snippet to verify.");
        return null;
      }
      formData.append("news_text", textValue.trim());
    }
    if (activeTab === "url") {
      if (!urlValue.trim()) {
        setErrorMessage("Paste the URL you want to verify.");
        return null;
      }
      formData.append("url", urlValue.trim());
    }
    if (activeTab === "pdf") {
      if (!pdfFile) {
        setErrorMessage("Upload a PDF document before verifying.");
        return null;
      }
      formData.append("file", pdfFile);
    }
    if (activeTab === "image") {
      if (!imageFile) {
        setErrorMessage("Upload an image before verifying.");
        return null;
      }
      formData.append("file", imageFile);
    }
    return formData;
  };

  const handleVerify = async () => {
    setErrorMessage(null);
    setResult(null);
    setCopyMessage("");
    setLinkedinStatus("");

    if (activeTab === "news") {
      await handleFetchLatestNews();
      return;
    }

    const formData = buildFormData();
    if (!formData) {
      return;
    }

    const endpoint =
      activeTab === "text"
        ? "check-text"
        : activeTab === "url"
        ? "check-url"
        : activeTab === "pdf"
        ? "check-pdf"
        : "check-image";

    setLoading(true);

    try {
      const response = await fetch(`${BACKEND_BASE_URL}/${endpoint}`, {
        method: "POST",
        body: formData,
      });

      const rawBody = await response.text();
      let data: any = null;

      try {
        data = rawBody ? JSON.parse(rawBody) : null;
      } catch {
        data = rawBody;
      }

      if (!response.ok) {
        const backendError =
          typeof data === "object" && data !== null
            ? data.detail || data.message || JSON.stringify(data)
            : String(data || "Verification request failed.");

        throw new Error(backendError);
      }

      if (activeTab === "image") {
        const imageRaw = `
OCR Text:
${data?.ocr_text || "No OCR text was extracted."}

Image Detection:
${data?.ai_image_detection || "No image authenticity result was returned."}

Fake News Analysis:
${data?.fake_news_analysis?.verification_result || "No fake news analysis was returned."}
`;

        const parsedImage = parseImageAnalysis(imageRaw);

        setResult({
          kind: "image",
          data: {
            ...parsedImage,
            linkedInPost:
              data?.fake_news_analysis?.linkedin_post ||
              "No LinkedIn post was returned.",
          },
        });
      } else {
        const parsedAnalysis = parseNewsAnalysis(
          data?.verification_result || "No verification result was returned."
        );

        setResult({
          kind: "analysis",
          data: {
            ...parsedAnalysis,
            linkedInPost: data?.linkedin_post || "No LinkedIn post was returned.",
          },
        });
      }
    } catch (error) {
      setErrorMessage((error as Error)?.message || "Unable to verify news. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLinkedInLogin = async () => {
    setLinkedinStatus("Opening LinkedIn login...");
    console.log("LinkedIn login URL:", `${BACKEND_BASE_URL}/linkedin/login`);

    try {
      const response = await fetch(`${BACKEND_BASE_URL}/linkedin/login`);
      const data = await response.json();

      if (!response.ok || !data?.login_url) {
        throw new Error(data?.detail || "Could not start LinkedIn login.");
      }

      window.location.href = data.login_url;
    } catch (error) {
      setLinkedinStatus((error as Error)?.message || "LinkedIn login failed.");
    }
  };

  const handlePostToLinkedIn = async (linkedInPost: string) => {
    const finalUserId = linkedinUserId.trim() || localStorage.getItem("linkedin_user_id") || "";

    if (!finalUserId) {
      setLinkedinStatus("Please login with LinkedIn first, or paste the LinkedIn user ID returned after OAuth login.");
      return;
    }

    if (!linkedInPost || linkedInPost === "No LinkedIn post was returned.") {
      setLinkedinStatus("No LinkedIn blog post is available to publish.");
      return;
    }

    setPostingToLinkedIn(true);
    setLinkedinStatus("Publishing to LinkedIn...");

    try {
      const formData = new FormData();
      formData.append("linkedin_user_id", finalUserId);
      formData.append("post_text", linkedInPost);

      const response = await fetch(`${BACKEND_BASE_URL}/linkedin/post`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data?.success) {
        setLinkedinStatus("Posted to LinkedIn successfully.");
      } else {
        setLinkedinStatus(data?.message || "LinkedIn posting failed. Check backend logs.");
        console.log("LinkedIn post response:", data);
      }
    } catch (error) {
      setLinkedinStatus((error as Error)?.message || "LinkedIn posting failed.");
    } finally {
      setPostingToLinkedIn(false);
    }
  };

  const handleFetchLatestNews = async () => {
    setErrorMessage(null);
    setResult(null);
    setCopyMessage("");
    setLinkedinStatus("");

    if (!newsTopic.trim()) {
      setErrorMessage("Enter a topic to fetch latest news articles.");
      return;
    }

    setFetchingNews(true);
    setNewsArticles([]);

    try {
      const formData = new FormData();
      formData.append("topic", newsTopic.trim());

      const response = await fetch(`${BACKEND_BASE_URL}/fetch-news`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || data?.success === false) {
        throw new Error(data?.message || data?.detail || "Failed to fetch latest news.");
      }

      setNewsArticles(data?.articles || []);
      if (!data?.articles?.length) {
        setErrorMessage("No recent articles found for this topic.");
      }
    } catch (error) {
      setErrorMessage((error as Error)?.message || "Unable to fetch latest news.");
    } finally {
      setFetchingNews(false);
    }
  };

  const handleVerifyFetchedArticle = async (articleUrl: string) => {
    setErrorMessage(null);
    setResult(null);
    setCopyMessage("");
    setLinkedinStatus("");

    if (!articleUrl) {
      setErrorMessage("This article does not have a valid URL to verify.");
      return;
    }

    setActiveTab("url");
    setUrlValue(articleUrl);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("url", articleUrl);

      const response = await fetch(`${BACKEND_BASE_URL}/check-url`, {
        method: "POST",
        body: formData,
      });

      const rawBody = await response.text();
      let data: any = null;

      try {
        data = rawBody ? JSON.parse(rawBody) : null;
      } catch {
        data = rawBody;
      }

      if (!response.ok) {
        const backendError =
          typeof data === "object" && data !== null
            ? data.detail || data.message || JSON.stringify(data)
            : String(data || "Article verification failed.");

        throw new Error(backendError);
      }

      const parsedAnalysis = parseNewsAnalysis(
        data?.verification_result || "No verification result was returned."
      );

      setResult({
        kind: "analysis",
        data: {
          ...parsedAnalysis,
          linkedInPost: data?.linkedin_post || "No LinkedIn post was returned.",
        },
      });
    } catch (error) {
      setErrorMessage((error as Error)?.message || "Unable to verify selected article.");
    } finally {
      setLoading(false);
    }
  };

  const activeInput = () => {
    if (activeTab === "text") {
      return (
        <textarea
          value={textValue}
          onChange={(event) => setTextValue(event.target.value)}
          rows={8}
          className="min-h-[220px] w-full resize-none rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-zinc-100 outline-none transition focus:border-emerald-400/80 focus:ring-2 focus:ring-emerald-400/20"
          placeholder={activeTabConfig.placeholder}
        />
      );
    }

    if (activeTab === "url") {
      return (
        <input
          value={urlValue}
          onChange={(event) => setUrlValue(event.target.value)}
          type="url"
          className="w-full rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-zinc-100 outline-none transition focus:border-emerald-400/80 focus:ring-2 focus:ring-emerald-400/20"
          placeholder={activeTabConfig.placeholder}
        />
      );
    }

    if (activeTab === "news") {
      return (
        <div className="space-y-4">
          <input
            value={newsTopic}
            onChange={(event) => setNewsTopic(event.target.value)}
            type="text"
            className="w-full rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-zinc-100 outline-none transition focus:border-emerald-400/80 focus:ring-2 focus:ring-emerald-400/20"
            placeholder={activeTabConfig.placeholder}
          />
          <p className="text-sm text-zinc-400">
            This uses the News Fetcher Agent to collect recent articles for your topic. After fetching, choose any article to verify.
          </p>
        </div>
      );
    }

    return (
      <div
        ref={dragRef}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="group relative flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-white/15 bg-white/5 px-5 py-10 text-center transition hover:border-emerald-400/60 hover:bg-white/10"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/5 text-emerald-300 transition group-hover:bg-emerald-400/10">
          <Search className="h-6 w-6" />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-zinc-100">Drag and drop file here</p>
          <p className="max-w-xs text-sm text-zinc-400">Accepting {activeTabConfig.accept || "all file types"}.</p>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-100 transition hover:border-emerald-400/60 hover:bg-white/10">
            <span>{activeTab === "pdf" ? "Upload PDF" : "Upload Image"}</span>
            <input
              type="file"
              accept={activeTabConfig.accept}
              className="hidden"
              onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        {(activeTab === "pdf" && pdfFile) || (activeTab === "image" && imageFile) ? (
          <div className="mt-5 rounded-3xl border border-emerald-400/20 bg-black/20 px-4 py-3 text-left text-sm text-zinc-200">
            <p className="font-medium text-emerald-200">Selected file</p>
            <p className="truncate text-zinc-300">{activeTab === "pdf" ? pdfFile?.name : imageFile?.name}</p>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#060708] px-6 py-10 text-zinc-100 sm:px-8 lg:px-12">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] bg-[radial-gradient(circle_at_top,_rgba(52,211,153,0.16),_transparent_40%)]" />
      <div className="pointer-events-none absolute right-0 top-24 -z-10 h-[420px] w-[420px] rounded-full bg-gradient-to-br from-emerald-500/10 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute left-0 bottom-10 -z-10 h-[360px] w-[360px] rounded-full bg-gradient-to-tr from-zinc-500/10 to-transparent blur-3xl" />

      <section className="mx-auto flex max-w-7xl flex-col gap-10">
        <div className="grid gap-6 lg:grid-cols-[1.15fr,_0.85fr] lg:items-start">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/20 backdrop-blur-xl"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-emerald-300/80">AI News Verification</p>
                <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-zinc-100 sm:text-5xl">
                  Real-time fake news detection for text, links, PDFs, and images.
                </h1>
              </div>
              <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-2 text-sm text-emerald-100">
                Connected to FastAPI backend
              </div>
            </div>

            <p className="mt-6 max-w-3xl text-sm leading-7 text-zinc-400 sm:text-base">
              Submit your content and receive an AI-powered verdict, confidence score, verification suggestions,
              reasoning, and a premium multi-agent dashboard for every suspicious claim.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.75rem] border border-white/10 bg-zinc-950/50 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Best for</p>
                <p className="mt-2 text-sm text-zinc-100">Breaking news claims, social posts, and suspicious headlines.</p>
              </div>
              <div className="rounded-[1.75rem] border border-white/10 bg-zinc-950/50 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Output</p>
                <p className="mt-2 text-sm text-zinc-100">Verdict badge, confidence bar, reasoning, warnings, and share-ready content.</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
            className="rounded-[2rem] border border-white/10 bg-zinc-950/50 p-7 shadow-2xl shadow-black/20 backdrop-blur-xl"
          >
            <div className="mb-6 space-y-3">
              <p className="text-sm uppercase tracking-[0.28em] text-emerald-300/80">Workflow</p>
              <h2 className="text-2xl font-semibold text-zinc-100">Verification timeline</h2>
            </div>

            <div className="space-y-4">
              {[
                { step: "1", title: "Input capture", description: "Text, URL, PDF or image is normalized and protected." },
                { step: "2", title: "AI evaluation", description: "Multi-agent model evaluates claims, sources and image authenticity." },
                { step: "3", title: "Verification output", description: "Verdict, confidence and explanation delivered instantly." },
              ].map((item) => (
                <div key={item.step} className="group overflow-hidden rounded-3xl border border-white/10 bg-white/5 px-5 py-4 transition hover:border-emerald-400/30">
                  <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-zinc-900/80 text-emerald-300">
                      {item.step}
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-100">{item.title}</p>
                      <p className="mt-1 text-sm text-zinc-400">{item.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-[1.75rem] border border-emerald-400/20 bg-emerald-400/5 p-5 text-sm text-emerald-100">
              <div className="flex items-center gap-2 text-emerald-200">
                <ShieldCheck className="h-5 w-5" />
                <span>Designed for reliable evidence-first verification.</span>
              </div>
              <p className="mt-3 leading-6 text-zinc-300">
                Tailored for journalists, moderators, and decision-makers who need fast, high-fidelity truth signals.
              </p>
            </div>
          </motion.div>
        </div>

        <div className="grid gap-8 xl:grid-cols-[1.15fr,_0.9fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-7 shadow-2xl shadow-black/20 backdrop-blur-xl">
            <div className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-emerald-300/80">Select input</p>
                <h2 className="text-3xl font-semibold tracking-tight text-zinc-100">Choose your verification type</h2>
              </div>
              <div className="rounded-3xl border border-white/10 bg-zinc-950/70 px-4 py-2 text-sm text-zinc-300">
                Premium glassmorphism interface
              </div>
            </div>

            <div className="mb-6 grid gap-3 sm:grid-cols-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const selected = tab.id === activeTab;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleSelectTab(tab.id)}
                    className={`group flex items-center gap-3 rounded-[1.75rem] border px-4 py-3 text-left transition ${
                      selected
                        ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
                        : "border-white/10 bg-white/5 text-zinc-300 hover:border-emerald-400/30 hover:bg-white/10"
                    }`}
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-950/80 text-emerald-300 transition group-hover:text-emerald-200">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold">{tab.label}</p>
                      <p className="mt-1 text-xs text-zinc-400">{tab.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="space-y-4">
              <div className="rounded-[2rem] border border-white/10 bg-zinc-950/70 p-6">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.28em] text-emerald-300/80">Active mode</p>
                    <h3 className="mt-2 text-lg font-semibold text-zinc-100">{activeTabConfig.label} verification</h3>
                  </div>
                  <div className="rounded-full border border-white/10 bg-zinc-900/80 px-3 py-1 text-xs text-zinc-300">
                    {activeTabConfig.accept || "text / url"}
                  </div>
                </div>
                <div>{activeInput()}</div>

                {activeTab === "news" && newsArticles.length > 0 ? (
                  <div className="mt-6 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm font-semibold text-emerald-100">Latest articles found</p>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-400">
                        {newsArticles.length} articles
                      </span>
                    </div>
                    <div className="grid gap-4">
                      {newsArticles.map((article, index) => (
                        <div
                          key={`${article.url}-${index}`}
                          className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4"
                        >
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-zinc-100">{article.title || "Untitled article"}</p>
                              <p className="mt-2 text-sm leading-6 text-zinc-400">
                                {article.description || article.content || "No description available."}
                              </p>
                              <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
                                {article.source ? <span>{article.source}</span> : null}
                                {article.published_at ? <span>{article.published_at}</span> : null}
                              </div>
                            </div>
                            <button
                              onClick={() => handleVerifyFetchedArticle(article.url)}
                              disabled={loading}
                              className="inline-flex shrink-0 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Verify this article
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 rounded-[2rem] border border-emerald-400/10 bg-emerald-400/5 p-5">
                <div>
                  <p className="text-sm font-semibold text-emerald-100">Smart request preview</p>
                  <p className="mt-1 text-sm text-zinc-300">FormData is used for every request, including text, URL, PDF, and image submissions.</p>
                </div>
                <div className="rounded-3xl bg-zinc-950/80 px-4 py-2 text-sm text-zinc-300">FastAPI endpoint ready</div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-zinc-300">Verification engine</p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">AI reasoning</span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">Source audit</span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">Confidence score</span>
                </div>
              </div>
              <button
                onClick={handleVerify}
                disabled={loading || fetchingNews}
                className="inline-flex min-h-[54px] items-center justify-center rounded-full bg-emerald-400 px-6 py-4 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading || fetchingNews ? (
                  <>
                    <Loader2 className="mr-3 h-5 w-5 animate-spin" /> {activeTab === "news" ? "Fetching..." : "Verifying..."}
                  </>
                ) : (
                  <>
                    <Zap className="mr-3 h-5 w-5" /> {activeTab === "news" ? "Fetch Latest News" : "Verify News"}
                  </>
                )}
              </button>
            </div>

            {errorMessage ? (
              <div className="mt-5 rounded-3xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-100">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4" />
                  <p>{errorMessage}</p>
                </div>
              </div>
            ) : null}

            <div className="mt-5 rounded-[2rem] border border-white/10 bg-zinc-950/70 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-emerald-100">Optional LinkedIn Publisher</p>
                  <p className="mt-1 text-sm text-zinc-400">
                    Login with LinkedIn first. The ID is filled automatically after OAuth redirect. For backend-only testing, you can paste the returned LinkedIn user ID here.
                  </p>
                  <input
                    value={linkedinUserId}
                    onChange={(event) => setLinkedinUserId(event.target.value)}
                    className="mt-4 w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-emerald-400/80 focus:ring-2 focus:ring-emerald-400/20"
                    placeholder="LinkedIn user ID after login"
                  />
                  {linkedinStatus ? <p className="mt-3 text-sm text-emerald-300">{linkedinStatus}</p> : null}
                </div>
                <button
                  onClick={handleLinkedInLogin}
                  className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10 px-5 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/20"
                >
                  Login with LinkedIn
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur-xl">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.28em] text-emerald-300/80">Live insight</p>
                  <h3 className="text-2xl font-semibold text-zinc-100">Multi-agent analysis</h3>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-zinc-950/80 px-3 py-2 text-xs text-zinc-300">
                  <Sparkles className="h-4 w-4 text-emerald-300" /> premium SaaS feel
                </div>
              </div>
              <div className="grid gap-4">
                {[
                  { label: "Claim evaluation", value: "Semantic truth score" },
                  { label: "Source audit", value: "Origin validation" },
                  { label: "Risk posture", value: "Deep trust signal" },
                ].map((item) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45 }}
                    className="rounded-[1.75rem] border border-white/10 bg-zinc-950/80 p-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm text-zinc-400">{item.label}</p>
                      <p className="font-semibold text-zinc-100">{item.value}</p>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-emerald-400 to-teal-300" />
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur-xl">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.28em] text-emerald-300/80">Source verification</p>
                  <h3 className="text-2xl font-semibold text-zinc-100">Evidence signals</h3>
                </div>
                <div className="rounded-full border border-white/10 bg-zinc-950/80 px-3 py-2 text-xs text-zinc-300">live confidence</div>
              </div>
              <div className="grid gap-4">
                {[
                  { title: "Trusted publisher check", detail: "AI reviews authority and bias signals from the source." },
                  { title: "Historical context", detail: "Timeline cross-checks claims against prior reporting." },
                  { title: "Claim similarity", detail: "Matches content with known false narratives." },
                ].map((item) => (
                  <div key={item.title} className="rounded-[1.75rem] border border-white/10 bg-zinc-950/80 p-4">
                    <p className="font-semibold text-zinc-100">{item.title}</p>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.section
              key="loading"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="rounded-[2rem] border border-white/10 bg-zinc-950/70 p-8 shadow-2xl shadow-black/20 backdrop-blur-xl"
            >
              <div className="flex items-center gap-4 text-zinc-100">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-300" />
                <div>
                  <p className="text-lg font-semibold">Processing your verification request</p>
                  <p className="mt-1 text-sm text-zinc-400">AI agents are analyzing the content and verifying source signals.</p>
                </div>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {Array.from({ length: 3 }, (_, index) => (
                  <div key={index} className="rounded-[1.75rem] bg-zinc-900/70 p-5">
                    <div className="h-3 rounded-full bg-white/10">
                      <div className="h-3 w-[70%] animate-pulse rounded-full bg-emerald-400/70" />
                    </div>
                    <div className="mt-4 h-4 w-2/3 rounded-full bg-white/10 animate-pulse" />
                    <div className="mt-3 h-3 w-5/6 rounded-full bg-white/10 animate-pulse" />
                  </div>
                ))}
              </div>
            </motion.section>
          ) : result ? (
            <motion.section
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/20 backdrop-blur-xl"
            >
              {result.kind === "analysis" ? (
                <div className="space-y-8">
                  <div className="grid gap-6 xl:grid-cols-[0.95fr,_0.8fr]">
                    <div className="rounded-[1.75rem] border border-white/10 bg-zinc-950/80 p-6">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <p className="text-sm uppercase tracking-[0.28em] text-emerald-300/80">Verdict</p>
                          <h3 className="mt-3 text-3xl font-semibold text-zinc-100">{result.data.verdict}</h3>
                        </div>
                        <div className={`rounded-full border px-4 py-2 text-sm font-semibold ${statusTone(result.data.verdict)}`}>
                          {result.data.verdict}
                        </div>
                      </div>
                      <div className="mt-6 space-y-3">
                        <div className="flex items-center justify-between text-sm text-zinc-400">
                          <span>Confidence score</span>
                          <span>{result.data.confidence}%</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300"
                            style={{ width: `${result.data.confidence}%` }}
                          />
                        </div>
                      </div>
                      <div className="mt-6 rounded-[1.75rem] border border-white/10 bg-black/20 p-5 text-sm text-zinc-300">
                        <p className="font-semibold text-zinc-100">AI reasoning</p>
                        <p className="mt-3 leading-7">{result.data.reasoning}</p>
                      </div>
                    </div>

                    <div className="rounded-[1.75rem] border border-white/10 bg-zinc-950/80 p-6">
                      <div className="flex items-center gap-3 text-emerald-200">
                        <CheckCircle2 className="h-5 w-5" />
                        <p className="text-sm uppercase tracking-[0.28em]">Verification signals</p>
                      </div>
                      <div className="mt-6 space-y-4">
                        <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                          <p className="text-sm font-semibold text-zinc-100">Warning signs</p>
                          {result.data.warnings.length ? (
                            <ul className="mt-3 space-y-2 text-sm text-zinc-400">
                              {result.data.warnings.map((warning, idx) => (
                                <li key={idx}>• {warning}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-3 text-sm text-zinc-500">No explicit warning signs were found.</p>
                          )}
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                          <p className="text-sm font-semibold text-zinc-100">Verification suggestions</p>
                          {result.data.suggestions.length ? (
                            <ul className="mt-3 space-y-2 text-sm text-zinc-400">
                              {result.data.suggestions.map((suggestion, idx) => (
                                <li key={idx}>• {suggestion}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-3 text-sm text-zinc-500">No additional suggestions were returned.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-[1.15fr,_0.85fr]">
                    <div className="rounded-[1.75rem] border border-white/10 bg-zinc-950/80 p-6">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm uppercase tracking-[0.28em] text-emerald-300/80">LinkedIn copy</p>
                          <h3 className="mt-3 text-xl font-semibold text-zinc-100">Shareable AI summary</h3>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => copyToClipboard(result.data.linkedInPost, setCopyMessage)}
                            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300 transition hover:border-emerald-400/30 hover:bg-white/10"
                          >
                            <Copy className="h-4 w-4" /> Copy
                          </button>
                          <button
                            onClick={() => handlePostToLinkedIn(result.data.linkedInPost)}
                            disabled={postingToLinkedIn}
                            className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-100 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {postingToLinkedIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                            Post to LinkedIn
                          </button>
                        </div>
                      </div>
                      <div className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-5 text-sm leading-7 text-zinc-300 whitespace-pre-line">
                        {result.data.linkedInPost}
                      </div>
                      {copyMessage ? <p className="mt-3 text-sm text-emerald-300">{copyMessage}</p> : null}
                    {linkedinStatus ? <p className="mt-2 text-sm text-emerald-300">{linkedinStatus}</p> : null}
                    </div>

                    <div className="rounded-[1.75rem] border border-white/10 bg-zinc-950/80 p-6">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm uppercase tracking-[0.28em] text-emerald-300/80">Source cards</p>
                          <h3 className="mt-3 text-xl font-semibold text-zinc-100">Evidence overview</h3>
                        </div>
                        <ChevronDown className="h-4 w-4 text-zinc-500" />
                      </div>
                      <div className="mt-5 space-y-3">
                        {result.data.sources.length ? (
                          result.data.sources.map((source, index) => (
                            <div key={index} className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
                              {source}
                            </div>
                          ))
                        ) : (
                          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-500">
                            No source verification details were detected in the response.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="rounded-[1.75rem] border border-white/10 bg-zinc-950/80 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-sm uppercase tracking-[0.28em] text-emerald-300/80">OCR result</p>
                        <h3 className="mt-3 text-3xl font-semibold text-zinc-100">Extracted image text</h3>
                      </div>
                      <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-100">
                        Confidence {result.data.aiConfidence}%
                      </span>
                    </div>
                    <div className="mt-6 rounded-[1.75rem] border border-white/10 bg-black/20 p-5 text-sm leading-7 text-zinc-300">
                      {result.data.ocrText}
                    </div>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-2">
                    <div className="rounded-[1.75rem] border border-white/10 bg-zinc-950/80 p-6">
                      <p className="text-sm uppercase tracking-[0.28em] text-emerald-300/80">Image authenticity</p>
                      <h3 className="mt-3 text-xl font-semibold text-zinc-100">Detection summary</h3>
                      <p className="mt-4 text-sm leading-7 text-zinc-300">{result.data.imageDetection}</p>
                    </div>
                    <div className="rounded-[1.75rem] border border-white/10 bg-zinc-950/80 p-6">
                      <p className="text-sm uppercase tracking-[0.28em] text-emerald-300/80">Fake news analysis</p>
                      <h3 className="mt-3 text-xl font-semibold text-zinc-100">Claim intelligence</h3>
                      <p className="mt-4 text-sm leading-7 text-zinc-300">{result.data.fakeNewsAnalysis}</p>
                    </div>
                  </div>

                  <div className="rounded-[1.75rem] border border-white/10 bg-zinc-950/80 p-6">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm uppercase tracking-[0.28em] text-emerald-300/80">LinkedIn blog post</p>
                        <h3 className="mt-3 text-xl font-semibold text-zinc-100">Shareable AI summary</h3>
                      </div>
                      <button
                        onClick={() => copyToClipboard(result.data.linkedInPost, setCopyMessage)}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300 transition hover:border-emerald-400/30 hover:bg-white/10"
                      >
                        <Copy className="h-4 w-4" /> Copy
                      </button>
                    </div>
                    <div className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-5 text-sm leading-7 text-zinc-300 whitespace-pre-line">
                      {result.data.linkedInPost}
                    </div>
                    {copyMessage ? <p className="mt-3 text-sm text-emerald-300">{copyMessage}</p> : null}
                  </div>

                  <div className="grid gap-6 xl:grid-cols-[1.15fr,_0.85fr]">
                    <div className="rounded-[1.75rem] border border-white/10 bg-zinc-950/80 p-6">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm uppercase tracking-[0.28em] text-emerald-300/80">Highlights</p>
                          <h3 className="mt-3 text-xl font-semibold text-zinc-100">Critical findings</h3>
                        </div>
                        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                          AI overview
                        </div>
                      </div>
                      <div className="mt-5 space-y-3 text-sm text-zinc-300">
                        {result.data.highlights.length ? (
                          result.data.highlights.map((item, index) => (
                            <p key={index}>• {item}</p>
                          ))
                        ) : (
                          <p>No extracted highlights were available.</p>
                        )}
                      </div>
                    </div>
                    <div className="rounded-[1.75rem] border border-white/10 bg-zinc-950/80 p-6">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm uppercase tracking-[0.28em] text-emerald-300/80">Next actions</p>
                          <h3 className="mt-3 text-xl font-semibold text-zinc-100">Suggested follow-up</h3>
                        </div>
                        <button
                          onClick={() => copyToClipboard(result.data.raw, setCopyMessage)}
                          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300 transition hover:border-emerald-400/30 hover:bg-white/10"
                        >
                          <Copy className="h-4 w-4" /> Copy raw data
                        </button>
                      </div>
                      <div className="mt-5 space-y-3 text-sm text-zinc-300">
                        {result.data.suggestions.length ? (
                          result.data.suggestions.map((item, index) => (
                            <p key={index}>• {item}</p>
                          ))
                        ) : (
                          <p>No follow-up suggestions were provided.</p>
                        )}
                      </div>
                      {copyMessage ? <p className="mt-4 text-sm text-emerald-300">{copyMessage}</p> : null}
                    </div>
                  </div>
                </div>
              )}
            </motion.section>
          ) : null}
        </AnimatePresence>
      </section>
    </main>
  );
}
