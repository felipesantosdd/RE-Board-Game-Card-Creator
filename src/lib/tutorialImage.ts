/**
 * Converte arquivo de imagem para WebP (data URL) para economizar espaço no IndexedDB.
 * Redimensiona se passar de maxSizePx para evitar arquivos muito grandes.
 */
const DEFAULT_QUALITY = 0.85;
const DEFAULT_MAX_SIZE_PX = 1400;

export async function convertImageFileToWebPDataUrl(
  file: File,
  options?: { quality?: number; maxSizePx?: number }
): Promise<string> {
  const quality = options?.quality ?? DEFAULT_QUALITY;
  const maxSize = options?.maxSizePx ?? DEFAULT_MAX_SIZE_PX;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > maxSize || h > maxSize) {
        if (w > h) {
          h = Math.round((h * maxSize) / w);
          w = maxSize;
        } else {
          w = Math.round((w * maxSize) / h);
          h = maxSize;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas 2d não disponível"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Conversão para WebP falhou"));
            return;
          }
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        },
        "image/webp",
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Falha ao carregar imagem"));
    };
    img.src = objectUrl;
  });
}
