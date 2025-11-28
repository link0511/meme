
// Declare JSZip from global scope (loaded via CDN)
declare var JSZip: any;

// --- Helper: Fetch & Proxy ---

const imageUrlToBlob = async (url: string): Promise<Blob> => {
  if (url.startsWith('data:')) {
    const arr = url.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  }

  const fetchBlob = async (targetUrl: string): Promise<Blob> => {
      const response = await fetch(targetUrl, { 
          mode: 'cors',
          cache: 'no-cache',
          credentials: 'omit'
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.blob();
  };

  try {
    return await fetchBlob(url);
  } catch (directError) {
    console.warn("Direct fetch failed, trying proxy...", directError);
  }

  try {
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    return await fetchBlob(proxyUrl);
  } catch (proxyError) {
    console.error("Proxy fetch failed:", proxyError);
    throw new Error("无法下载图片数据。请尝试手动下载原图。");
  }
};

export const downloadSingleImage = async (imageSrc: string, filename: string) => {
  try {
    const blob = await imageUrlToBlob(imageSrc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e: any) {
    console.error("Download failed:", e);
    const openSucceeded = window.open(imageSrc, '_blank');
    if (!openSucceeded) throw new Error("下载失败，请尝试右键另存为。");
  }
};

// --- Main Function ---

export const sliceAndZipImage = async (
  imageSrc: string,
  targetRows: number,
  targetCols: number
): Promise<Blob> => {
  if (typeof JSZip === 'undefined') throw new Error("JSZip not loaded.");

  // 1. Load Image securely
  let safeImageUrl: string;
  let cleanUpUrl = false;
  try {
    const blob = await imageUrlToBlob(imageSrc);
    safeImageUrl = URL.createObjectURL(blob);
    cleanUpUrl = true;
  } catch (error: any) {
    throw new Error(`无法加载图片: ${error.message}`);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = async () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error("Canvas init failed");

        // Use natural dimensions
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0);

        // --- Grid Slicing Logic ---
        // Strictly cut based on rows and cols
        const cellW = width / targetCols;
        const cellH = height / targetRows;

        // --- Generate Zip ---
        const zip = new JSZip();
        const folder = zip.folder("stickers");
        let count = 0;

        for (let r = 0; r < targetRows; r++) {
            for (let c = 0; c < targetCols; c++) {
                const x = Math.floor(c * cellW);
                const y = Math.floor(r * cellH);
                // Ensure we don't go out of bounds (floor vs float)
                const w = Math.min(Math.floor(cellW), width - x);
                const h = Math.min(Math.floor(cellH), height - y);

                const cropCanvas = document.createElement('canvas');
                cropCanvas.width = w;
                cropCanvas.height = h;
                const cropCtx = cropCanvas.getContext('2d');
                
                if (cropCtx) {
                    cropCtx.drawImage(
                        canvas, 
                        x, y, w, h, // Source
                        0, 0, w, h // Dest
                    );
                    
                    const blob = await new Promise<Blob | null>(res => cropCanvas.toBlob(res, 'image/png'));
                    if (blob) {
                        count++;
                        const fileName = `sticker_${count.toString().padStart(2, '0')}.png`;
                        folder.file(fileName, blob);
                    }
                }
            }
        }

        const zipContent = await zip.generateAsync({ type: "blob" });
        resolve(zipContent);

      } catch (e: any) {
        reject(e);
      } finally {
        if (cleanUpUrl) URL.revokeObjectURL(safeImageUrl);
      }
    };
    img.onerror = () => reject(new Error("Image corrupted"));
    img.src = safeImageUrl;
  });
};
