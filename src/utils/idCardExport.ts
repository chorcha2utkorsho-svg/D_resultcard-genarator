/**
 * ID Card A4 Export & Print Engine
 * Optimized for standard CR80 ID cards (54mm x 85.6mm) on A4 sheet.
 * Supports:
 *  - Both sides paired side-by-side (for folding into plastic pouches / lanyard holders)
 *  - Front-only batch
 *  - Back-only batch
 *  - Direct Browser Tab Open & Print (bypasses iframe restrictions)
 *  - Offline Standalone HTML Download
 */

export function cleanIdCardHtml(rawHtml: string): string {
  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(rawHtml, 'text/html');
      doc.querySelectorAll('.no-print, button, input, .screen-only').forEach((el) => el.remove());
      return doc.body.innerHTML;
    } catch {
      // Fallback if parsing fails
    }
  }
  return rawHtml
    .replace(/<button[^>]*>[\s\S]*?<\/button>/gi, '')
    .replace(/<input[^>]*>/gi, '')
    .replace(/<div class="[^"]*no-print[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
}

export function generateIdCardsFullHtml(
  schoolName: string,
  classNameBn: string,
  contentHtml: string,
  autoPrint: boolean = true,
  modeDescription: string = 'এপিঠ ও ওপিঠ (উভয় পৃষ্ঠা)'
): string {
  const cleanedContent = cleanIdCardHtml(contentHtml);

  return `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ডিজিটাল স্মার্ট আইডি কার্ড - ${schoolName} (${classNameBn})</title>
  
  <!-- Bengali Fonts: Kalpurush and Hind Siliguri -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.maateen.me/kalpurush/font.css" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap" rel="stylesheet">
  
  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  
  <style>
    @font-face {
      font-family: 'Kalpurush';
      src: url('https://fonts.maateen.me/kalpurush/font.woff2') format('woff2'),
           url('https://fonts.maateen.me/kalpurush/font.woff') format('woff');
      font-weight: normal;
      font-style: normal;
      font-display: swap;
    }

    @page {
      size: 210mm 297mm portrait !important; /* Standard A4 */
      margin: 8mm 6mm !important;
    }

    * {
      box-sizing: border-box !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #f1f5f9;
      font-family: 'Kalpurush', 'Hind Siliguri', 'SolaimanLipi', system-ui, -apple-system, sans-serif !important;
      color: #000000;
      -webkit-font-smoothing: antialiased;
    }

    .screen-control-bar {
      position: sticky;
      top: 0;
      background: #091e42;
      color: #ffffff;
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 3px solid #d97706;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
      z-index: 9999;
    }

    /* A4 Print Sheet Container: Exact 4-Cards (2x2 Grid) */
    .id-card-a4-sheet {
      width: 210mm !important;
      max-width: 210mm !important;
      min-width: 210mm !important;
      height: 297mm !important;
      max-height: 297mm !important;
      min-height: 297mm !important;
      padding: 10mm 8mm !important;
      margin: 20px auto !important;
      background: #ffffff !important;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      box-sizing: border-box !important;
      display: grid !important;
      grid-template-columns: repeat(2, 1fr) !important;
      grid-template-rows: repeat(2, 1fr) !important;
      gap: 6mm !important;
      justify-items: center !important;
      align-items: center !important;
      page-break-after: always !important;
      break-after: page !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      position: relative !important;
      overflow: hidden !important;
    }

    .id-card-a4-sheet:last-of-type {
      page-break-after: avoid !important;
      break-after: avoid !important;
    }

    .id-card-print-slot {
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      width: 100% !important;
      height: 100% !important;
      box-sizing: border-box !important;
      position: relative !important;
    }

    /* Subtle trim/cutting guide wrapper around each card */
    .id-card-slot-wrapper {
      position: relative !important;
      display: inline-block !important;
      padding: 2px !important;
      border: 1px dashed #cbd5e1 !important;
      border-radius: 14px !important;
      background: #ffffff !important;
      box-sizing: border-box !important;
    }

    .sheet-watermark {
      position: absolute !important;
      bottom: 3.5mm !important;
      right: 8mm !important;
      font-size: 8.5px !important;
      color: #94a3b8 !important;
      font-weight: bold !important;
    }

    @media print {
      body {
        background: #ffffff !important;
      }
      .screen-control-bar {
        display: none !important;
      }
      .id-card-a4-sheet {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        height: 280mm !important;
        max-height: 280mm !important;
        min-height: 280mm !important;
        padding: 4mm 2mm !important;
        margin: 0 !important;
        box-shadow: none !important;
        page-break-after: always !important;
        break-after: page !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        overflow: hidden !important;
      }
      .id-card-a4-sheet:last-of-type {
        page-break-after: avoid !important;
        break-after: avoid !important;
      }
    }
  </style>
</head>
<body>
  <!-- Sticky Control Bar for User Experience -->
  <div class="screen-control-bar">
    <div class="flex items-center gap-3">
      <div style="background: #ffffff; border-radius: 8px; padding: 4px 8px; font-weight: bold; color: #091e42; font-size: 14px;">
        ডি-লিকন মডেল একাডেমী
      </div>
      <div>
        <h1 class="text-sm font-bold text-white tracking-wide">
          স্মার্ট ডিজিটাল আইডি কার্ড প্রিন্ট ভিউ (${classNameBn})
        </h1>
        <p class="text-[11px] text-amber-300">
          প্রিন্ট মোড: ${modeDescription} • এ৪ পেপারে ৪টি কার্ড (2x2 গ্রিড) • নিখুঁত কাটিং গাইড
        </p>
      </div>
    </div>
    
    <div class="flex items-center gap-3">
      <button 
        onclick="window.print()" 
        style="background: #d97706; hover:background: #b45309; color: #ffffff; font-weight: bold; font-size: 13px; padding: 8px 18px; border-radius: 8px; cursor: pointer; border: none; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.2);">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
        প্রিন্ট করুন (Print Now)
      </button>
      <button 
        onclick="window.close()" 
        style="background: #334155; color: #ffffff; font-size: 12px; padding: 8px 14px; border-radius: 8px; cursor: pointer; border: none;">
        বন্ধ করুন
      </button>
    </div>
  </div>

  <!-- Cards Container -->
  <div id="print-content" class="py-4">
    ${cleanedContent}
  </div>

  ${
    autoPrint
      ? `<script>
    window.addEventListener('DOMContentLoaded', () => {
      // Allow fonts and images to load fully
      setTimeout(() => {
        window.print();
      }, 700);
    });
  </script>`
      : ''
  }
</body>
</html>`;
}

export function openIdCardsInNewTab(
  schoolName: string,
  classNameBn: string,
  contentHtml: string,
  modeDescription: string = 'এপিঠ ও ওপিঠ'
): void {
  const html = generateIdCardsFullHtml(
    schoolName,
    classNameBn,
    contentHtml,
    true,
    modeDescription
  );
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);
  const newWin = window.open(blobUrl, '_blank');

  if (!newWin) {
    const fallbackLink = document.createElement('a');
    fallbackLink.href = blobUrl;
    fallbackLink.target = '_blank';
    document.body.appendChild(fallbackLink);
    fallbackLink.click();
    document.body.removeChild(fallbackLink);
  }
}

export function downloadIdCardsHtml(
  schoolName: string,
  classNameBn: string,
  contentHtml: string,
  modeDescription: string = 'এপিঠ ও ওপিঠ'
): void {
  const html = generateIdCardsFullHtml(
    schoolName,
    classNameBn,
    contentHtml,
    false,
    modeDescription
  );
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  const sanitizedClass = classNameBn.replace(/[/\\?%*:|"<>]/g, '_');
  a.download = `আইডি_কার্ড_${schoolName}_${sanitizedClass}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}
