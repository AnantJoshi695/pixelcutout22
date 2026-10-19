import type { ProcessingQuality, ProcessingStep } from '../types';
import {
  removeBackground as runRemoval,
  BackgroundRemovalError,
  DEFAULT_QUALITY,
  type RemovalResult,
} from './backgroundRemovalService';

export { BackgroundRemovalError };

/**
 * Remove the background from an image and report progress along the way.
 *
 * This is a thin orchestration layer over `backgroundRemovalService`; all of
 * the actual segmentation and mask-refinement work lives in the service so the
 * engine can be swapped (local ONNX model vs. remote API) without touching the
 * UI.
 *
 * `quality` selects the model precision and how much edge refinement the mask
 * gets — see `QUALITY_OPTIONS` in the service for what each level does.
 */
export async function processImageWithSteps(
  imageFile: File,
  quality: ProcessingQuality = DEFAULT_QUALITY,
  onProgress?: (step: ProcessingStep) => void,
): Promise<RemovalResult> {
  onProgress?.({ message: 'Preparing image…', progress: 0 });

  try {
    const result = await runRemoval(imageFile, quality, (p) => {
      onProgress?.({ message: p.message, progress: p.progress });
    });
    onProgress?.({ message: 'Done', progress: 100 });
    return result;
  } catch (error) {
    if (error instanceof BackgroundRemovalError) throw error;
    throw new BackgroundRemovalError(
      `Unexpected background removal failure: ${(error as Error).message}`,
      'Background removal failed unexpectedly. Please try again.',
    );
  }
}
