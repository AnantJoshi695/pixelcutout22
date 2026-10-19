import type { ProcessingStep } from '../types';

interface ProcessingOverlayProps {
  step: ProcessingStep;
}

export function ProcessingOverlay({ step }: ProcessingOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
        {/* Animation */}
        <div className="mb-6 flex justify-center">
          <div className="relative">
            <div className="w-24 h-24 rounded-full border-4 border-primary-200 dark:border-primary-900" />
            <div className="absolute inset-0 w-24 h-24 rounded-full border-4 border-t-primary-600 border-r-primary-600 border-b-transparent border-l-transparent animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 animate-pulse-slow" />
            </div>
          </div>
        </div>

        {/* Message */}
        <div className="text-center">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {step.message}
          </h3>
          {step.progress !== undefined && (
            <div className="mt-4">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary-600 to-purple-600 transition-all duration-300"
                  style={{ width: `${step.progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                {step.progress}%
              </p>
            </div>
          )}
        </div>

        {/* Tips */}
        <div className="mt-6 p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
          <p className="text-sm text-gray-700 dark:text-gray-300 text-center">
            💡 Tip: Use the Recover brush to restore any accidentally removed areas
          </p>
        </div>
      </div>
    </div>
  );
}
