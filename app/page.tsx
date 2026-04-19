"use client";

import { useState, useCallback } from "react";

/* ──────────────────────────────────────────────
   Razorpay Checkout type (loaded via script tag)
   ────────────────────────────────────────────── */
interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  modal?: { ondismiss?: () => void };
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => { open: () => void };
  }
}

/* ──────────────────────────────────────────────
   Spinner Component
   ────────────────────────────────────────────── */
function Spinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dims = { sm: "h-5 w-5", md: "h-8 w-8", lg: "h-12 w-12" }[size];
  return (
    <div className="flex items-center justify-center" role="status">
      <div
        className={`${dims} rounded-full border-2 border-white/10 border-t-amber-500 animate-spin-smooth`}
      />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Error Banner Component
   ────────────────────────────────────────────── */
function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="animate-fade-in-up w-full max-w-2xl mx-auto mt-6 px-5 py-4 rounded-xl bg-red-500/10 border border-red-500/30 backdrop-blur-sm flex items-start gap-3">
      <svg
        className="w-5 h-5 text-red-400 mt-0.5 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
        />
      </svg>
      <p className="text-sm text-red-300 leading-relaxed flex-1">{message}</p>
      <button
        onClick={onDismiss}
        className="text-red-400 hover:text-red-300 transition-colors p-0.5"
        aria-label="Dismiss error"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Result Card Shell
   ────────────────────────────────────────────── */
function ResultCard({
  title,
  icon,
  children,
  delay = 0,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <div
      className="animate-fade-in-up rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-md overflow-hidden"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-white/[0.06]">
        <span className="text-amber-400">{icon}</span>
        <h3 className="text-sm font-semibold tracking-wide uppercase text-white/80">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Main Page
   ────────────────────────────────────────────── */
export default function HomePage() {
  const [idea, setIdea] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ script: string } | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [paid, setPaid] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  /* ── Reset everything ──────────────────────────────── */
  const handleReset = useCallback(() => {
    setIdea("");
    setLoading(false);
    setError(null);
    setResult(null);
    setVideoUrl(null);
    setVideoLoading(false);
    setVideoError(null);
    setElapsed(0);
    setPaid(false);
    setPaymentLoading(false);
    setPaymentError(null);
  }, []);

  /* ── Download video helper ─────────────────────────── */
  const handleDownload = useCallback(async () => {
    if (!videoUrl) return;
    try {
      const res = await fetch(videoUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hookgen-video-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: open in new tab
      window.open(videoUrl, "_blank");
    }
  }, [videoUrl]);

  /* ── Load Razorpay checkout.js ─────────────────────── */
  const loadRazorpayScript = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      if (typeof window !== "undefined" && window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }, []);

  /* ── Start video generation (called after payment) ─── */
  const startVideoGeneration = useCallback(async (hook: string) => {
    setVideoLoading(true);
    setVideoError(null);
    setElapsed(0);

    const timerStart = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - timerStart) / 1000));
    }, 1000);

    try {
      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hook }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate video.");
      }

      setVideoUrl(data.videoUrl);
    } catch (err) {
      setVideoError(
        err instanceof Error
          ? err.message
          : "Video generation failed. You can still use the hook script above."
      );
    } finally {
      clearInterval(timer);
      setVideoLoading(false);
    }
  }, []);

  /* ── Handle Razorpay payment ───────────────────────── */
  const handlePayment = useCallback(async () => {
    if (!result) return;

    setPaymentLoading(true);
    setPaymentError(null);

    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error("Failed to load payment gateway. Please refresh and try again.");

      const orderRes = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 9900 }),
      });

      const orderData = await orderRes.json();

      if (!orderRes.ok) {
        throw new Error(orderData.error || "Failed to create payment order.");
      }

      const options: RazorpayOptions = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "HookGen",
        description: "Unlock Your Hook Video",
        order_id: orderData.orderId,
        handler: async (response) => {
          try {
            const verifyRes = await fetch("/api/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json();

            if (!verifyRes.ok || !verifyData.success) {
              throw new Error(verifyData.error || "Payment verification failed.");
            }

            setPaid(true);
            setPaymentLoading(false);
            startVideoGeneration(result.script);
          } catch (err) {
            setPaymentError(
              err instanceof Error ? err.message : "Payment verification failed."
            );
            setPaymentLoading(false);
          }
        },
        prefill: {},
        theme: { color: "#F59E0B" },
        modal: {
          ondismiss: () => {
            setPaymentLoading(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      setPaymentError(
        err instanceof Error ? err.message : "Payment failed. Please try again."
      );
      setPaymentLoading(false);
    }
  }, [result, loadRazorpayScript, startVideoGeneration]);

  /* ── Generate hook text (Phase 1 only) ─────────────── */
  const handleGenerate = async () => {
    if (!idea.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setVideoUrl(null);
    setVideoLoading(false);
    setVideoError(null);
    setPaid(false);
    setPaymentError(null);
    setElapsed(0);

    try {
      const res = await fetch("/api/generate-hook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: idea.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate hook.");
      }

      setResult({ script: data.hook });
      
      // Temporarily bypass payment gate for testing
      setPaid(true);
      startVideoGeneration(data.hook);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while generating your hook. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  /* ── Has video completed successfully? ─────────────── */
  const videoReady = !!videoUrl && !videoLoading;

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* ── Background ─────────────────────────── */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a1a] via-[#0d0d1f] to-[#0a0a0f]" />
        <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-amber-500/[0.04] blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-purple-600/[0.05] blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")" }} />
      </div>

      {/* ── Header ──────────────────────────────── */}
      <header className="relative z-10 w-full px-4 sm:px-6 lg:px-8 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-amber-400 text-xl">⚡</span>
            <span className="text-base font-bold tracking-tight text-white">HookGen</span>
          </div>
          <p className="hidden sm:block text-xs text-white/30 tracking-wide">
            Viral hooks in 60 seconds
          </p>
        </div>
      </header>

      {/* ── Content ─────────────────────────────── */}
      <div className="relative z-10 flex flex-col items-center px-4 sm:px-6 lg:px-8 pt-8 sm:pt-16 pb-8">
        {/* ── Heading ──────────────────────────── */}
        <h1
          className="animate-fade-in-up text-center text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.08] tracking-tight max-w-4xl"
        >
          <span className="text-white">Turn Your Idea Into a</span>{" "}
          <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent">
            Viral Hook Video
          </span>
        </h1>

        <p
          className="animate-fade-in-up mt-5 text-center text-base sm:text-lg text-white/40 max-w-xl leading-relaxed"
          style={{ animationDelay: "100ms" }}
        >
          Paste your content idea and let AI craft an attention-grabbing hook
          script with a ready-to-publish video.
        </p>

        {/* ── Input Section ────────────────────── */}
        <div
          className="animate-fade-in-up mt-10 w-full max-w-2xl"
          style={{ animationDelay: "180ms" }}
        >
          <div className="relative rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md p-1.5 transition-all duration-300 focus-within:border-amber-500/40 focus-within:shadow-[0_0_40px_rgba(245,158,11,0.08)]">
            <textarea
              id="idea-input"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="Paste your content idea here..."
              rows={5}
              className="w-full min-h-[160px] bg-transparent rounded-xl px-5 py-4 text-white/90 text-base placeholder:text-white/25 resize-none focus:outline-none leading-relaxed"
            />
            <div className="flex items-center justify-between px-4 pb-3">
              <span className="text-xs text-white/20">
                {idea.length > 0 ? `${idea.length} chars` : ""}
              </span>
              <span className="text-xs text-white/20">
                {idea.length > 0 && idea.length < 20 ? "Add more detail for better results" : ""}
              </span>
            </div>
          </div>

          {/* ── CTA Button ──────────────────────── */}
          <button
            id="generate-btn"
            onClick={handleGenerate}
            disabled={loading || !idea.trim()}
            className={`
              mt-5 w-full py-4 px-8 rounded-xl text-base font-semibold tracking-wide
              transition-all duration-300 ease-out
              flex items-center justify-center gap-3
              ${
                loading || !idea.trim()
                  ? "bg-white/[0.06] text-white/30 cursor-not-allowed border border-white/[0.06]"
                  : "bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 hover:scale-[1.01] active:scale-[0.99] animate-glow-pulse"
              }
            `}
          >
            {loading ? (
              <>
                <Spinner size="sm" />
                <span>Writing your viral hook...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
                </svg>
                <span>Generate Hook + Video</span>
              </>
            )}
          </button>
        </div>

        {/* ── Error Message ─────────────────────── */}
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        {/* ── Loading State (Hook generation) ───── */}
        {loading && (
          <div className="animate-fade-in-up mt-16 flex flex-col items-center gap-4">
            <Spinner size="lg" />
            <p className="text-sm text-white/40 tracking-wide">Writing your viral hook...</p>
            <div className="mt-8 w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-5">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3"
                >
                  <div className="h-4 w-1/3 rounded-full animate-shimmer" />
                  <div className="h-3 w-full rounded-full animate-shimmer" />
                  <div className="h-3 w-5/6 rounded-full animate-shimmer" />
                  <div className="h-3 w-4/6 rounded-full animate-shimmer" />
                  <div className="h-24 w-full rounded-xl animate-shimmer mt-2" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Results Section ──────────────────── */}
        {result && !loading && (
          <>
            {/* Success banner when video is ready */}
            {videoReady && (
              <div className="animate-fade-in-up mt-10 mb-2 inline-flex items-center px-5 py-2.5 rounded-full border border-green-500/20 bg-green-500/[0.08] backdrop-blur-sm">
                <span className="text-sm font-medium text-green-300">Your hook video is ready! 🎉</span>
              </div>
            )}

            <div className={`${videoReady ? "mt-4" : "mt-16"} w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-5`}>
              {/* Hook Script Card */}
              <ResultCard
                title="Your Hook Script"
                delay={0}
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                }
              >
                <pre className="whitespace-pre-wrap text-sm text-white/70 leading-relaxed font-[inherit] max-h-[400px] overflow-y-auto pr-2">
                  {result.script}
                </pre>
                <button
                  onClick={() => navigator.clipboard.writeText(result.script)}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-white/[0.06] text-white/50 border border-white/[0.08] hover:bg-white/[0.1] hover:text-white/70 transition-all duration-200"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                  </svg>
                  Copy Script
                </button>
              </ResultCard>

              {/* Hook Video Card */}
              <ResultCard
                title="Your Hook Video"
                delay={150}
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                }
              >
                {/* ── Video: Loading state ── */}
                {videoLoading && (
                  <div className="relative aspect-[9/16] max-h-[360px] w-full rounded-xl bg-gradient-to-b from-white/[0.04] to-white/[0.01] border border-white/[0.06] flex flex-col items-center justify-center gap-5 overflow-hidden">
                    <Spinner size="lg" />
                    <div className="text-center space-y-1.5">
                      <p className="text-sm text-white/50 font-medium">Creating your video (takes 1-3 minutes)...</p>
                      <p className="text-xs text-amber-400/60 font-mono tabular-nums mt-2">
                        {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")} elapsed
                      </p>
                    </div>
                    <div className="absolute bottom-4 left-4 right-4">
                      <div className="h-1 w-full rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-500/60 to-orange-500/60 transition-all duration-1000 ease-linear"
                          style={{ width: `${Math.min((elapsed / 180) * 100, 95)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Video: Error state ── */}
                {videoError && !videoLoading && (
                  <div className="relative aspect-[9/16] max-h-[360px] w-full rounded-xl bg-red-500/[0.04] border border-red-500/20 flex flex-col items-center justify-center gap-3 px-6">
                    <svg className="w-8 h-8 text-red-400/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                    </svg>
                    <p className="text-xs text-red-300/70 text-center leading-relaxed">{videoError}</p>
                  </div>
                )}

                {/* ── Video: Ready — HTML5 player + download ── */}
                {videoUrl && !videoLoading && (
                  <div className="space-y-4">
                    <div className="relative aspect-[9/16] max-h-[360px] w-full rounded-xl overflow-hidden border border-white/[0.06]">
                      <video
                        src={videoUrl}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-cover rounded-xl"
                      />
                    </div>
                    {/* Download button */}
                    <button
                      id="download-btn"
                      onClick={handleDownload}
                      className="w-full py-3 px-4 rounded-xl text-sm font-semibold tracking-wide bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      Download Video
                    </button>
                  </div>
                )}

                {/* ── Video: Payment gate (before payment) ── */}
                {/* TEMPORARILY DISABLED FOR TESTING
                {!paid && !videoLoading && !videoUrl && !videoError && (
                  <div className="relative aspect-[9/16] max-h-[400px] w-full rounded-xl bg-gradient-to-b from-amber-500/[0.04] via-white/[0.02] to-white/[0.01] border border-amber-500/[0.15] flex flex-col items-center justify-center gap-5 px-6 overflow-hidden">
                    <div className="w-14 h-14 rounded-full bg-amber-500/[0.1] border border-amber-500/20 flex items-center justify-center">
                      <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                      </svg>
                    </div>
                    <div className="text-center space-y-1.5">
                      <p className="text-lg font-semibold text-white/80">Unlock your video for ₹99</p>
                      <p className="text-xs text-white/30 leading-relaxed">AI-generated cinematic video<br />ready for Instagram & YouTube</p>
                    </div>
                    {paymentError && (
                      <p className="text-xs text-red-400 text-center">{paymentError}</p>
                    )}
                    <button
                      id="pay-now-btn"
                      onClick={handlePayment}
                      disabled={paymentLoading}
                      className={`
                        w-full max-w-[200px] py-3 px-6 rounded-xl text-sm font-semibold tracking-wide
                        transition-all duration-300 ease-out
                        flex items-center justify-center gap-2
                        ${paymentLoading
                          ? "bg-white/[0.06] text-white/30 cursor-not-allowed border border-white/[0.06]"
                          : "bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 hover:scale-[1.02] active:scale-[0.98]"
                        }
                      `}
                    >
                      {paymentLoading ? (
                        <>
                          <Spinner size="sm" />
                          <span>Processing…</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
                          </svg>
                          <span>Pay Now</span>
                        </>
                      )}
                    </button>
                    <p className="text-[10px] text-white/15">Secured by Razorpay</p>
                  </div>
                )}
                */}
              </ResultCard>
            </div>

            {/* ── Generate Another ──────────────── */}
            <button
              id="reset-btn"
              onClick={handleReset}
              className="animate-fade-in-up mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-white/40 border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:text-white/60 transition-all duration-200"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
              </svg>
              Generate Another
            </button>
          </>
        )}
      </div>

      {/* ── Footer ───────────────────────────── */}
      <footer className="relative z-10 w-full border-t border-white/[0.04] mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 text-sm">⚡</span>
            <span className="text-sm font-semibold text-white/50">HookGen</span>
          </div>
          <p className="text-xs text-white/20 text-center">
            Made with ❤️ in India · ₹99 per video · Contact:{" "}
            <a
              href="mailto:hello@hookgen.in"
              className="text-amber-400/50 hover:text-amber-400/80 transition-colors underline underline-offset-2"
            >
              hello@hookgen.in
            </a>
          </p>
          <p className="text-xs text-white/15">
            © {new Date().getFullYear()} HookGen
          </p>
        </div>
      </footer>
    </main>
  );
}
