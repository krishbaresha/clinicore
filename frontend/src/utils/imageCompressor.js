/**
 * High-Performance Client-Side Image Compressor & Secure Validator
 * Resizes large smartphone camera photos (e.g. 10MB 4000x3000) down to
 * crisp, readable medical documentation images (~100KB - 150KB)
 */

export const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
export const MAX_IMAGE_FILE_SIZE = 15 * 1024 * 1024; // 15MB

export function validateImageFile(file) {
  if (!file) return { valid: false, error: "No file provided" };
  if (typeof file === "object") {
    if (file.size && file.size > MAX_IMAGE_FILE_SIZE) {
      return { valid: false, error: `File exceeds maximum allowed size of 15MB (${(file.size / (1024 * 1024)).toFixed(1)}MB)` };
    }
    if (file.type && !ALLOWED_IMAGE_MIME_TYPES.includes(file.type.toLowerCase())) {
      return { valid: false, error: `Unsupported file format: ${file.type}. Allowed formats: JPEG, PNG, WEBP, AVIF` };
    }
  }
  return { valid: true, error: null };
}

export function compressImageFile(fileOrDataUrl, maxWidth = 1280, maxHeight = 1280, quality = 0.75) {
  return new Promise((resolve, reject) => {
    if (fileOrDataUrl instanceof File || fileOrDataUrl instanceof Blob) {
      const check = validateImageFile(fileOrDataUrl);
      if (!check.valid) {
        return reject(new Error(check.error));
      }
    }

    const img = new Image();

    img.onload = () => {
      let { width, height } = img;

      // Maintain aspect ratio while clamping to max dimensions
      if (width > maxWidth || height > maxHeight) {
        if (width > height) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      // Optional: fill background white to avoid PNG transparent black artifact
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      // Compress to high-efficiency JPEG
      const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
      resolve(compressedDataUrl);
    };

    img.onerror = (err) => reject(err);

    if (typeof fileOrDataUrl === "string") {
      img.src = fileOrDataUrl;
    } else if (fileOrDataUrl instanceof Blob || fileOrDataUrl instanceof File) {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target.result;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(fileOrDataUrl);
    } else {
      reject(new Error("Invalid image source provided"));
    }
  });
}

/**
 * Automatically detects and crops empty white/transparent margins around logos
 * and renders a tight, ultra-crisp, space-efficient image for 80mm thermal receipts.
 */
export function autoCropLogoImage(fileOrDataUrl, maxWidth = 300, maxHeight = 120) {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const origW = img.width;
      const origH = img.height;

      const scanCanvas = document.createElement("canvas");
      scanCanvas.width = origW;
      scanCanvas.height = origH;
      const sCtx = scanCanvas.getContext("2d");
      sCtx.drawImage(img, 0, 0);

      const imgData = sCtx.getImageData(0, 0, origW, origH);
      const data = imgData.data;

      let minX = origW;
      let minY = origH;
      let maxX = 0;
      let maxY = 0;
      let foundPixel = false;

      for (let y = 0; y < origH; y++) {
        for (let x = 0; x < origW; x++) {
          const idx = (y * origW + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const a = data[idx + 3];

          // If pixel is not transparent and not pure/near white
          const isWhite = r > 245 && g > 245 && b > 245;
          if (a > 20 && !isWhite) {
            foundPixel = true;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (!foundPixel) {
        minX = 0;
        minY = 0;
        maxX = origW;
        maxY = origH;
      } else {
        // Add tiny 4px safety buffer
        minX = Math.max(0, minX - 4);
        minY = Math.max(0, minY - 4);
        maxX = Math.min(origW, maxX + 4);
        maxY = Math.min(origH, maxY + 4);
      }

      const cropW = maxX - minX;
      const cropH = maxY - minY;

      // Scale to target max dimensions
      let finalW = cropW;
      let finalH = cropH;
      if (finalW > maxWidth || finalH > maxHeight) {
        if (finalW / maxWidth > finalH / maxHeight) {
          finalH = Math.round((finalH * maxWidth) / finalW);
          finalW = maxWidth;
        } else {
          finalW = Math.round((finalW * maxHeight) / finalH);
          finalH = maxHeight;
        }
      }

      const cropCanvas = document.createElement("canvas");
      cropCanvas.width = finalW;
      cropCanvas.height = finalH;
      const cCtx = cropCanvas.getContext("2d");

      // Draw cropped area directly to target dimension
      cCtx.drawImage(img, minX, minY, cropW, cropH, 0, 0, finalW, finalH);

      resolve(cropCanvas.toDataURL("image/png"));
    };

    img.onerror = (err) => reject(err);

    if (typeof fileOrDataUrl === "string") {
      img.src = fileOrDataUrl;
    } else if (fileOrDataUrl instanceof Blob || fileOrDataUrl instanceof File) {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target.result;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(fileOrDataUrl);
    } else {
      reject(new Error("Invalid image source"));
    }
  });
}

