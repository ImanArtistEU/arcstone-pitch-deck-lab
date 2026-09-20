import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

/**
 * Result of rendering a single PDF slide page into a high-DPI image data URL.
 */
export interface RenderedSlideImage {
  pageNumber: number;
  dataUrl: string; // "data:image/jpeg;base64,..."
  width: number;
  height: number;
}

/**
 * Renders a single PDF page onto an HTML Canvas and exports it as a JPEG Data URL.
 * Designed for optimal multimodal vision model consumption (~1600px target width).
 * 
 * @param pdfDoc Loaded PDFDocumentProxy from pdfjsLib
 * @param pageNum Page number (1-indexed)
 * @returns Promise<RenderedSlideImage>
 */
export async function renderSlideToImage(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageNum: number
): Promise<RenderedSlideImage> {
  const page = await pdfDoc.getPage(pageNum);

  // Determine optimal scale targeting ~1600px width for multimodal legibility
  const unscaledViewport = page.getViewport({ scale: 1.0 });
  const targetWidth = 1600;
  const scale = Math.max(1.0, Math.min(2.5, targetWidth / unscaledViewport.width));
  const viewport = page.getViewport({ scale });

  // Create offscreen canvas element
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: false });

  if (!context) {
    throw new Error(`Failed to obtain 2D canvas rendering context for Slide ${pageNum}`);
  }

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  // Render page onto canvas
  const renderContext = {
    canvasContext: context,
    canvas: canvas,
    viewport: viewport,
  };

  await page.render(renderContext).promise;

  // Export as high-quality JPEG Data URL (0.85 balance of resolution and payload size)
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

  // Clean up canvas memory
  canvas.width = 0;
  canvas.height = 0;

  return {
    pageNumber: pageNum,
    dataUrl,
    width: Math.floor(viewport.width),
    height: Math.floor(viewport.height),
  };
}

/**
 * Renders all pages in a PDF document sequentially with memory cleanup.
 * 
 * @param pdfDoc Loaded PDFDocumentProxy from pdfjsLib
 * @param onProgress Optional progress callback (page, total)
 * @returns Promise<RenderedSlideImage[]>
 */
export async function renderAllSlides(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  onProgress?: (page: number, total: number) => void
): Promise<RenderedSlideImage[]> {
  const totalPages = pdfDoc.numPages;
  const renderedImages: RenderedSlideImage[] = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    try {
      const slideImg = await renderSlideToImage(pdfDoc, pageNum);
      renderedImages.push(slideImg);
      if (onProgress) {
        onProgress(pageNum, totalPages);
      }
    } catch (err) {
      console.error(`[pdf-renderer] Failed to render slide ${pageNum}:`, err);
    }
  }

  return renderedImages;
}

