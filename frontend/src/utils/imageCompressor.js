/**
 * High-Performance Client-Side Image Compressor
 * Resizes large smartphone camera photos (e.g. 10MB 4000x3000) down to
 * crisp, readable medical documentation images (~100KB - 150KB)
 */

export function compressImageFile(fileOrDataUrl, maxWidth = 1280, maxHeight = 1280, quality = 0.75) {
  return new Promise((resolve, reject) => {
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
