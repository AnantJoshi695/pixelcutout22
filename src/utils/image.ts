import type { ExportFormat } from '../types';

/**
 * Download a canvas.
 *
 * Note the MIME type must be `image/jpeg` — `image/jpg` is not a valid type,
 * and passing it to `canvas.toBlob` silently falls back to PNG, which is why
 * JPG exports previously produced a PNG file with a `.jpg` name.
 */
export function downloadImage(
  canvas: HTMLCanvasElement,
  fileName: string,
  format: ExportFormat = 'png',
  quality: number = 0.95,
): void {
  const mimeType = `image/${format}`;
  const extension = format === 'jpeg' ? 'jpg' : format;

  // Reject an empty/failed render rather than downloading a blank file.
  if (!canvas || canvas.width === 0 || canvas.height === 0) {
    throw new Error('Nothing to export yet.');
  }

  canvas.toBlob(
    (blob) => {
      if (!blob) {
        console.error('Failed to create blob');
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${fileName}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },
    mimeType,
    format === 'png' ? undefined : quality,
  );
}


export function loadImage(src: string | File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));

    if (typeof src === 'string') {
      img.src = src;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(src);
    }
  });
}

export function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image from blob'));
    };

    img.src = url;
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export function isValidImageFile(file: File): boolean {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'];
  return validTypes.includes(file.type);
}

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!isValidImageFile(file)) {
    return {
      valid: false,
      error: 'Unsupported file format. Please use JPG, PNG, WEBP, or HEIC.',
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: 'File is too large. Maximum size is 10MB.',
    };
  }

  return { valid: true };
}
