/**
 * Compresses an image data URL (Base64) to an optimized passport/badge resolution
 * to prevent localStorage QuotaExceededError and ensure fast loading.
 */
export async function compressImageBase64(
  base64Str: string,
  maxWidth = 360,
  maxHeight = 450,
  quality = 0.8
): Promise<string> {
  // If not a data URL or very short, return as is
  if (!base64Str || !base64Str.startsWith('data:image/')) {
    return base64Str;
  }

  // If already small (< 50KB), return as is
  if (base64Str.length < 50000) {
    return base64Str;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Calculate aspect ratio preserving dimensions
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Str);
        return;
      }

      // Smooth resizing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // Export as WebP or JPEG
      try {
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      } catch {
        resolve(base64Str);
      }
    };

    img.onerror = () => {
      resolve(base64Str);
    };

    img.src = base64Str;
  });
}
