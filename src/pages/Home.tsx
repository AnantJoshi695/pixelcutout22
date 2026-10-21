import { useCallback, useRef, useState } from 'react';
import { Shield, Lock, Zap, AlertCircle, X, ArrowRight } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { UploadZone } from '../components/UploadZone';
import { CameraModal } from '../components/CameraModal';
import { ProcessingOverlay } from '../components/ProcessingOverlay';
import { ImageEditor } from '../components/ImageEditor';
import { FeaturesSection } from '../components/FeaturesSection';
import { HowItWorksSection } from '../components/HowItWorksSection';
import { Footer } from '../components/Footer';
import { BeforeAfter } from '../components/BeforeAfter';
import type { ImageData, ProcessingQuality, ProcessingStep } from '../types';
import { loadImage, blobToImage, validateImageFile } from '../utils/image';
import { processImageWithSteps } from '../services/backgroundRemoval';
import { DEFAULT_QUALITY } from '../services/backgroundRemovalService';

/** Above this many pixels the browser canvas starts to struggle. */
const MAX_PIXELS = 60_000_000;

export function Home() {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<ProcessingStep>({ message: 'Processing…' });
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quality, setQuality] = useState<ProcessingQuality>(DEFAULT_QUALITY);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    // Reset so selecting the same file again still fires a change event.
    e.target.value = '';
  };

  const handleFileSelect = useCallback(
    async (file: File) => {
      setError(null);

      const validation = validateImageFile(file);
      if (!validation.valid) {
        setError(validation.error ?? 'That file could not be used.');
        return;
      }

      try {
        setProcessing(true);
        setProcessingStep({ message: 'Reading image…', progress: 0 });

        const originalImage = await loadImage(file);
        const width = originalImage.naturalWidth || originalImage.width;
        const height = originalImage.naturalHeight || originalImage.height;

        if (width * height > MAX_PIXELS) {
          setError(
            `That image is ${width}×${height} (${Math.round((width * height) / 1_000_000)}MP), which is too large to edit reliably. Please use an image under 60MP.`,
          );
          return;
        }

        // Real segmentation at the chosen quality: the service returns the
        // cut-out subject plus the refined alpha mask it was cut with, so the
        // editor can always restore pixels.
        const result = await processImageWithSteps(file, quality, (step) => {
          setProcessingStep(step);
        });

        const processedImage = await blobToImage(result.foreground);
        const aiMask = await blobToImage(result.alphaMask);

        setImageData({
          original: originalImage,
          processed: processedImage,
          aiMask,
          fileName: file.name,
          fileSize: file.size,
          dimensions: { width, height },
        });
        setShowEditor(true);
      } catch (err) {
        console.error('Error processing image:', err);
        const message =
          err instanceof Error && 'userMessage' in err
            ? String((err as { userMessage?: string }).userMessage)
            : 'Something went wrong while processing that image. Please try again.';
        setError(message);
      } finally {
        setProcessing(false);
      }
    },
    [quality],
  );

  const handleCameraCapture = (file: File) => {
    setCameraOpen(false);
    void handleFileSelect(file);
  };

  const handleCloseEditor = () => {
    setShowEditor(false);
    setImageData(null);
  };

  const scrollToHowItWorks = () => {
    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      {/* Always mounted so the navbar button can always open the picker. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/heic"
        onChange={handleFileInput}
        className="hidden"
      />

      <Navbar onUploadClick={() => fileInputRef.current?.click()} />

      {showEditor && imageData ? (
        <ImageEditor imageData={imageData} onClose={handleCloseEditor} />
      ) : (
        <div className="min-h-screen bg-surface dark:bg-[#101713]">
          {/* ── Hero Section ─────────────────────────────────────────── */}
          <section id="home" className="relative px-4 pt-16 pb-20 overflow-hidden">
            {/* Decorative background lighting & curved lines */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
              {/* Large soft green glow — top-left area */}
              <div className="absolute -top-20 -left-20 w-[600px] h-[600px] rounded-full opacity-30 dark:opacity-40"
                style={{
                  background: 'radial-gradient(circle, rgba(45,190,127,0.45) 0%, rgba(45,190,127,0) 70%)',
                  filter: 'blur(60px)',
                }}
              />
              {/* Medium green glow — bottom-right area */}
              <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full opacity-25 dark:opacity-35"
                style={{
                  background: 'radial-gradient(circle, rgba(33,131,74,0.50) 0%, rgba(33,131,74,0) 70%)',
                  filter: 'blur(70px)',
                }}
              />
              {/* Small bright accent glow — center-right */}
              <div className="absolute top-1/3 right-1/4 w-[280px] h-[280px] rounded-full opacity-20 dark:opacity-30"
                style={{
                  background: 'radial-gradient(circle, rgba(85,217,154,0.55) 0%, rgba(85,217,154,0) 70%)',
                  filter: 'blur(50px)',
                }}
              />
              {/* Thin curved decorative lines */}
              <svg className="absolute inset-0 w-full h-full opacity-[0.12] dark:opacity-[0.18]"
                viewBox="0 0 1440 800" preserveAspectRatio="none" fill="none" aria-hidden="true">
                {/* Curve 1 — sweeping arc from top-left toward center */}
                <path d="M-50 200 C200 50, 400 250, 600 180 S900 80, 1100 150"
                  stroke="rgba(45,190,127,0.7)" strokeWidth="1" fill="none" />
                {/* Curve 2 — wide arc across lower portion */}
                <path d="M100 650 C350 500, 550 700, 800 600 S1100 480, 1400 550"
                  stroke="rgba(45,190,127,0.5)" strokeWidth="1" fill="none" />
                {/* Curve 3 — subtle arc near top-right */}
                <path d="M900 100 C1000 200, 1100 80, 1300 120"
                  stroke="rgba(45,190,127,0.5)" strokeWidth="0.8" fill="none" />
                {/* Curve 4 — gentle wave bottom-left */}
                <path d="M-30 700 C150 600, 300 750, 500 680"
                  stroke="rgba(45,190,127,0.4)" strokeWidth="0.8" fill="none" />
              </svg>
              {/* Additional delicate ring decoration */}
              <div className="absolute top-10 right-[35%] w-64 h-64 rounded-full border border-green-400/10 dark:border-green-400/15 pointer-events-none" aria-hidden="true" />
              <div className="absolute top-16 right-[37%] w-48 h-48 rounded-full border border-green-400/8 dark:border-green-400/12 pointer-events-none" aria-hidden="true" />
            </div>

            <div className="relative z-10 mx-auto max-w-7xl">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center min-h-[520px]">

                {/* ── Left column: text, CTAs, indicators ── */}
                <div className="flex flex-col gap-6">
                  {/* Badge */}
                  <div className="inline-flex w-fit mt-6 animate-slide-up">
                    <div className="inline-flex items-center gap-2 rounded-full bg-green-100 px-4 py-1.5 text-sm font-semibold text-green-700 dark:bg-dark-card dark:text-green-300 border border-frame dark:border-dark-border">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-green-600"></span>
                      </span>
                      On-device AI — nothing leaves your browser
                    </div>
                  </div>

                  {/* Headline */}
                  <h1 className="text-4xl font-extrabold leading-tight text-ink dark:text-green-50 md:text-5xl lg:text-6xl animate-slide-up">
                    Remove backgrounds.
                    <br />
                    <span className="bg-gradient-to-r from-green-600 to-green-400 bg-clip-text text-transparent">
                      Keep what matters.
                    </span>
                  </h1>

                  {/* Subtitle */}
                  <p className="text-lg text-mute dark:text-green-300 md:text-xl max-w-lg animate-slide-up">
                    AI-powered background removal with precise manual control.
                  </p>

                  {/* Buttons */}
                  <div className="flex flex-wrap items-center gap-3 pt-2 animate-fade-in">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={processing}
                      className="flex items-center gap-2 rounded-xl bg-green-600 px-6 py-3 text-base font-semibold text-white transition-all hover:bg-green-700 shadow-lg shadow-green-600/25 hover:shadow-green-600/40 active:scale-[0.97] disabled:opacity-60"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      Upload Image
                    </button>
                    <button
                      type="button"
                      onClick={scrollToHowItWorks}
                      className="flex items-center gap-2 rounded-xl border border-frame bg-paper/80 backdrop-blur-sm px-6 py-3 text-base font-semibold text-ink dark:text-green-200 dark:border-dark-border dark:bg-dark-card/60 transition-all hover:border-green-400 dark:hover:border-green-600 hover:bg-paper dark:hover:bg-dark-elevated active:scale-[0.97]"
                    >
                      See How It Works
                      <ArrowRight size={16} />
                    </button>
                  </div>

                  {/* Privacy / feature indicators */}
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-3 animate-fade-in">
                    {[
                      { icon: Shield, label: '100% Private', desc: 'All processing happens locally' },
                      { icon: Lock, label: 'No Sign Up', desc: 'Start editing instantly' },
                      { icon: Zap, label: 'Works Offline', desc: 'No internet required' },
                    ].map(({ icon: Icon, label, desc }) => (
                      <div key={label} className="flex items-center gap-2">
                        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-green-100 dark:bg-dark-card border border-frame dark:border-dark-border">
                          <Icon size={14} className="text-green-700 dark:text-green-400" />
                        </div>
                        <div>
                          <span className="text-sm font-semibold text-ink dark:text-green-200">{label}</span>
                          <span className="hidden sm:inline text-mute dark:text-green-400/70 ml-1.5 text-xs">· {desc}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Right column: dog before/after comparison ── */}
                <div className="flex justify-center lg:justify-end animate-fade-in">
                  <div className="w-full max-w-lg">
                    <BeforeAfter />
                  </div>
                </div>

              </div>
            </div>
          </section>

          {/* ── Error alert (below hero) ── */}
          {error && (
            <div className="px-4 pb-4">
              <div
                role="alert"
                className="mx-auto flex max-w-2xl items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
              >
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <p className="flex-1">{error}</p>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="rounded p-1 hover:bg-red-100 dark:hover:bg-red-900/40"
                  aria-label="Dismiss error"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ── Upload Zone (mobile-only; hidden on desktop when hero is shown) ── */}
          <div className="px-4 pb-12">
            <UploadZone
              onFileSelect={handleFileSelect}
              onCameraClick={() => setCameraOpen(true)}
              quality={quality}
              onQualityChange={setQuality}
              disabled={processing}
            />
          </div>

          {/* ── Two info boxes side by side ── */}
          <div className="px-4 pb-8">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-2xl mx-auto">
              <div className="flex items-center gap-2.5 rounded-xl border border-frame dark:border-dark-border bg-paper dark:bg-dark-card px-4 py-2.5 text-sm text-mute dark:text-green-300 w-full sm:w-auto">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-green-600 dark:text-green-400">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                <span>You can also paste an image directly (Ctrl+V / Cmd+V)</span>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl border border-frame dark:border-dark-border bg-paper dark:bg-dark-card px-4 py-2.5 text-sm text-mute dark:text-green-300 w-full sm:w-auto">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-green-600 dark:text-green-400">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <span>Your images are processed securely and privately</span>
              </div>
            </div>
          </div>

          <FeaturesSection />
          <HowItWorksSection />
          <Footer />

          <CameraModal
            isOpen={cameraOpen}
            onClose={() => setCameraOpen(false)}
            onCapture={handleCameraCapture}
          />

          {processing && <ProcessingOverlay step={processingStep} />}
        </div>
      )}
    </>
  );
}
