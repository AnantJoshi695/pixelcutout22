import { useCallback, useRef, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { UploadZone } from '../components/UploadZone';
import { CameraModal } from '../components/CameraModal';
import { ProcessingOverlay } from '../components/ProcessingOverlay';
import { ImageEditor } from '../components/ImageEditor';
import { FeaturesSection } from '../components/FeaturesSection';
import { HowItWorksSection } from '../components/HowItWorksSection';
import { Footer } from '../components/Footer';
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
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900">
          <section id="home" className="px-4 pb-20 pt-32">
            <div className="mx-auto max-w-7xl">
              <div className="mb-8 flex justify-center animate-slide-up">
                <div className="inline-flex items-center gap-2 rounded-full bg-primary-100 px-4 py-2 text-sm font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-500"></span>
                  </span>
                  On-device AI — nothing leaves your browser
                </div>
              </div>

              <div className="mb-12 text-center animate-slide-up">
                <h1 className="mb-6 text-5xl font-bold leading-tight text-gray-900 dark:text-white md:text-7xl">
                  Remove backgrounds.
                  <br />
                  <span className="bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent">
                    Keep what matters.
                  </span>
                </h1>
                <p className="mx-auto max-w-3xl text-xl text-gray-600 dark:text-gray-400 md:text-2xl">
                  AI-powered background removal with precise manual control.
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  className="mx-auto mb-8 flex max-w-2xl items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
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
              )}

              <div className="mb-12 animate-fade-in">
                <UploadZone
                  onFileSelect={handleFileSelect}
                  onCameraClick={() => setCameraOpen(true)}
                  quality={quality}
                  onQualityChange={setQuality}
                  disabled={processing}
                />
              </div>

              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                🔒 Your images are processed securely and privately
              </p>
            </div>
          </section>

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
