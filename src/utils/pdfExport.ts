import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface PDFExportOptions {
  fileName?: string;
  quality?: number; // scale factor, default 2 (high DPI)
  orientation?: 'portrait' | 'landscape';
  format?: 'a4' | 'legal' | 'letter';
  margin?: number; // in mm, default 8
  onProgress?: (current: number, total: number, message: string) => void;
}

/**
 * Downloads a single HTML element as a high-quality PDF.
 */
export async function exportElementToPDF(
  element: HTMLElement,
  options: PDFExportOptions = {}
): Promise<void> {
  const {
    fileName = 'document.pdf',
    quality = 2.5,
    orientation = 'portrait',
    format = 'a4',
    margin = 8,
  } = options;

  // Clone or capture styles safely
  const originalWidth = element.style.width;
  const originalMaxWidth = element.style.maxWidth;

  try {
    const canvas = await html2canvas(element, {
      scale: quality,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: orientation === 'landscape' ? 1440 : 1024,
      ignoreElements: (el) => el.classList?.contains('no-print'),
    });

    const imgData = canvas.toDataURL('image/png', 1.0);

    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format,
      compress: true,
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    const usableWidth = pdfWidth - margin * 2;
    const usableHeight = pdfHeight - margin * 2;

    const imgProps = pdf.getImageProperties(imgData);
    const imgRatio = imgProps.height / imgProps.width;

    let renderWidth = usableWidth;
    let renderHeight = usableWidth * imgRatio;

    // Scale to fit on single page if needed
    if (renderHeight > usableHeight) {
      renderHeight = usableHeight;
      renderWidth = usableHeight / imgRatio;
    }

    const xOffset = (pdfWidth - renderWidth) / 2;
    const yOffset = margin;

    pdf.addImage(imgData, 'PNG', xOffset, yOffset, renderWidth, renderHeight, undefined, 'FAST');
    pdf.save(fileName);
  } finally {
    element.style.width = originalWidth;
    element.style.maxWidth = originalMaxWidth;
  }
}

/**
 * Exports multiple HTML elements as a combined multi-page PDF document.
 */
export async function exportMultipleElementsToPDF(
  elements: HTMLElement[],
  options: PDFExportOptions = {}
): Promise<void> {
  if (elements.length === 0) return;

  const {
    fileName = 'batch-documents.pdf',
    quality = 2.0,
    orientation = 'portrait',
    format = 'a4',
    margin = 8,
    onProgress,
  } = options;

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format,
    compress: true,
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const usableWidth = pdfWidth - margin * 2;
  const usableHeight = pdfHeight - margin * 2;

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (onProgress) {
      onProgress(i + 1, elements.length, `পিডিএফ তৈরি হচ্ছে (${i + 1}/${elements.length})...`);
    }

    // Capture each element
    const canvas = await html2canvas(el, {
      scale: quality,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: orientation === 'landscape' ? 1440 : 1024,
      ignoreElements: (element) => element.classList?.contains('no-print'),
    });

    const imgData = canvas.toDataURL('image/png', 0.95);
    const imgProps = pdf.getImageProperties(imgData);
    const imgRatio = imgProps.height / imgProps.width;

    let renderWidth = usableWidth;
    let renderHeight = usableWidth * imgRatio;

    if (renderHeight > usableHeight) {
      renderHeight = usableHeight;
      renderWidth = usableHeight / imgRatio;
    }

    const xOffset = (pdfWidth - renderWidth) / 2;
    const yOffset = margin;

    if (i > 0) {
      pdf.addPage(format, orientation);
    }

    pdf.addImage(imgData, 'PNG', xOffset, yOffset, renderWidth, renderHeight, undefined, 'FAST');
  }

  if (onProgress) {
    onProgress(elements.length, elements.length, 'পিডিএফ ফাইল ডাউনলোড হচ্ছে...');
  }

  pdf.save(fileName);
}
