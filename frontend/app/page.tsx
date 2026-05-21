"use client";

import { DragEvent, useMemo, useRef, useState } from "react";
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

const BACKEND_BASE_URL = "http://127.0.0.1:8000";

type InputMode = "text" | "url" | "pdf" | "image";

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
  raw: string;
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
  const verdict = findSection(normalized, ["verdict", "decision", "outcome", "result"]) || "Undetermined";
  const confidence = parseConfidence(findSection(normalized, ["confidence", "score", "certainty"]));
  const reasoning =
    findSection(normalized, ["reasoning", "analysis", "explanation", "rationale"]) ||
    findSection(normalized, ["reason"]) ||
    "No AI reasoning was provided by the backend.";
  const warnings = splitList(findSection(normalized, ["warning signs", "warnings", "red flags", "issues", "concerns"]));
  const suggestions = splitList(findSection(normalized, ["suggestion", "recommendation", "next steps", "verify", "action items"]));
  const linkedInPost =
    findSection(normalized, ["linkedin generated post", "linkedin post", "social share", "post"]) ||
    `AI says this news is ${verdict.toLowerCase()} with ${confidence}% confidence.`;
  const sources = splitList(findSection(normalized, ["source verification", "sources", "origin", "reference"]));

  return {
    verdict,
    confidence,
    reasoning,
    warnings,
    suggestions,
    linkedInPost,
    sources,
    raw: normalized,
  };
}

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

  return {
    ocrText,
    imageDetection,
    fakeNewsAnalysis,
    aiConfidence,
    highlights,
    suggestions,
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
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<ResultState>(null);
  const [copyMessage, setCopyMessage] = useState<string>("");
  const [expandedPanel, setExpandedPanel] = useState<string>("ai");
  const dragRef = useRef<HTMLDivElement | null>(null);

  const activeTabConfig = useMemo(() => tabs.find((tab) => tab.id === activeTab) ?? tabs[0], [activeTab]);

  const previewUrl = useMemo(() => {
    if (!imageFile) {
      return "";
    }
    return URL.createObjectURL(imageFile);
  }, [imageFile]);

  const handleSelectTab = (tabId: InputMode) => {
    setActiveTab(tabId);
    setErrorMessage(null);
    setResult(null);
    setCopyMessage("");
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
      setImagePreview(file ? URL.createObjectURL(file) : "");
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
      if (!response.ok) {
        throw new Error(rawBody || "Verification request failed.");
      }

      let parsedBody: unknown;
      try {
        parsedBody = JSON.parse(rawBody);
      } catch {
        parsedBody = rawBody;
      }

      const responseText =
        typeof parsedBody === "string"
          ? parsedBody
          : parsedBody && typeof parsedBody === "object"
          ? (parsedBody as Record<string, unknown>).result ||
            (parsedBody as Record<string, unknown>).detail ||
            (parsedBody as Record<string, unknown>).message ||
            JSON.stringify(parsedBody, null, 2)
          : rawBody;

      if (activeTab === "image") {
        setResult({ kind: "image", data: parseImageAnalysis(String(responseText)) });
      } else {
        setResult({ kind: "analysis", data: parseNewsAnalysis(String(responseText)) });
      }
    } catch (error) {
      setErrorMessage((error as Error)?.message || "Unable to verify news. Try again.");
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
                disabled={loading}
                className="inline-flex min-h-[54px] items-center justify-center rounded-full bg-emerald-400 px-6 py-4 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-3 h-5 w-5 animate-spin" /> Verifying...
                  </>
                ) : (
                  <>
                    <Zap className="mr-3 h-5 w-5" /> Verify News
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
                        <button
                          onClick={() => copyToClipboard(result.data.linkedInPost, setCopyMessage)}
                          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300 transition hover:border-emerald-400/30 hover:bg-white/10"
                        >
                          <Copy className="h-4 w-4" /> Copy
                        </button>
                      </div>
                      <div className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-5 text-sm leading-7 text-zinc-300">
                        {result.data.linkedInPost}
                      </div>
                      {copyMessage ? <p className="mt-3 text-sm text-emerald-300">{copyMessage}</p> : null}
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
