import type { ProcessingStep } from '../types';

interface ProcessingOverlayProps {
  step: ProcessingStep;
}

export function ProcessingOverlay({ step }: ProcessingOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-paper rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl shadow-green-900/15 border border-frame dark:bg-dark-surface dark:border-green-900">
        {/* Animation */}
        <div className="mb-6 flex justify-center">
          <div className="relative">
            <div className="w-24 h-24 rounded-full border-4 border-green-100 dark:border-green-900" />
            <div className="absolute inset-0 w-24 h-24 rounded-full border-4 border-t-green-500 border-r-green-500 border-b-transparent border-l-transparent animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-green-500 animate-pulse-slow shadow-lg shadow-green-600/25" />
            </div>
          </div>
        </div>

        {/* Message */}
        <div className="text-center">
          <h3 className="text-xl font-bold text-ink dark:text-green-50 mb-2">
            {step.message}
          </h3>
          {step.progress !== undefined && (
            <div className="mt-4">
              <div className="w-full bg-green-100 dark:bg-dark-elevated rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all duration-300 rounded-full"
                  style={{ width: `${step.progress}%` }}
                />
              </div>
              <p className="text-sm text-mute dark:text-green-300 mt-2">
                {step.progress}%
              </p>
            </div>
          )}
        </div>

        {/* Tips */}
        <div className="mt-6 p-4 bg-green-50 dark:bg-green-950 rounded-xl border border-green-100 dark:border-green-900">
          <p className="text-sm text-mute dark:text-green-200 text-center">
            💡 Tip: Use the Recover brush to restore any accidentally removed areas
          </p>
        </div>
      </div>
    </div>
  );
}
