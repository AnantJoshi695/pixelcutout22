import { useRef, useState, useEffect } from 'react';
import { Camera, SwitchCamera, X, Check } from 'lucide-react';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

export function CameraModal({ isOpen, onClose, onCapture }: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  useEffect(() => {
    if (isOpen) {
      startCamera();
      checkMultipleCameras();
    } else {
      stopCamera();
      setCapturedImage(null);
      setError(null);
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const checkMultipleCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setHasMultipleCameras(videoDevices.length > 1);
    } catch (err) {
      console.error('Error checking cameras:', err);
    }
  };

  const startCamera = async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: false,
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Camera error:', err);
      setError('Unable to access camera. Please check your permissions.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const imageUrl = canvas.toDataURL('image/jpeg', 0.95);
    setCapturedImage(imageUrl);
  };

  const handleRetake = () => {
    setCapturedImage(null);
  };

  const handleAccept = () => {
    if (!capturedImage) return;

    // Convert data URL to File
    fetch(capturedImage)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
        onCapture(file);
        onClose();
      });
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 animate-fade-in">
      <div className="relative w-full h-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-black/50 backdrop-blur-sm">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Camera size={24} />
            Take Photo
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Close camera"
          >
            <X size={24} className="text-white" />
          </button>
        </div>

        {/* Camera/Preview */}
        <div className="flex-1 relative bg-black flex items-center justify-center">
          {error ? (
            <div className="text-center p-8">
              <div className="text-red-400 mb-4">{error}</div>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          ) : capturedImage ? (
            <img
              src={capturedImage}
              alt="Captured"
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="max-w-full max-h-full object-contain"
            />
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 p-6 bg-black/50 backdrop-blur-sm">
          {capturedImage ? (
            <>
              <button
                onClick={handleRetake}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              >
                Retake
              </button>
              <button
                onClick={handleAccept}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                <Check size={20} />
                Accept
              </button>
            </>
          ) : (
            <>
              {hasMultipleCameras && (
                <button
                  onClick={toggleCamera}
                  className="p-4 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                  aria-label="Switch camera"
                  title="Switch camera"
                >
                  <SwitchCamera size={24} className="text-white" />
                </button>
              )}
              <button
                onClick={handleCapture}
                className="w-16 h-16 bg-white hover:bg-gray-200 rounded-full transition-colors shadow-lg"
                aria-label="Capture photo"
                disabled={!!error}
              >
                <div className="w-14 h-14 m-1 border-4 border-black rounded-full" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
