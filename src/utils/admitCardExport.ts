/**
 * Generates and downloads a self-contained offline HTML file for Admit Cards.
 * Strictly configured for A4 Portrait with 4 cards (2 columns x 2 rows) per sheet.
 * Supports both Double-Sided (Duplex / এপিঠ ও ওপিঠ), Front-only, and Back-only printing.
 * Uses 'Kalpurush' Bengali font and incorporates official school branding.
 */

export function cleanAdmitCardHtml(rawHtml: string): string {
  return rawHtml
    .replace(/<input[^>]*>/gi, '')
    .replace(/<div class="[^"]*no-print[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
}

export function generateAdmitCardFullHtml(
  schoolName: string,
  examName: string,
  classNameBn: string,
  contentHtml: string,
  autoPrint: boolean = true,
  modeDescription: string = 'এপিঠ ও ওপিঠ (উভয় পৃষ্ঠা)'
): string {
  const cleanedContent = cleanAdmitCardHtml(contentHtml);

  return `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>এডমিট কার্ড - ${examName} - ${classNameBn}</title>
  
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
      size: 210mm 297mm !important; /* Standard A4 Portrait */
      margin: 0 !important; /* Zero margin so sheets align perfectly */
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
      background: #0f172a;
      color: #ffffff;
      padding: 12px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #f59e0b;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
      z-index: 9999;
    }

    /* A4 Sheet Container (210mm x 297mm) */
    .admit-card-a4-sheet {
      width: 210mm !important;
      max-width: 210mm !important;
      min-width: 210mm !important;
      height: 297mm !important;
      max-height: 297mm !important;
      min-height: 297mm !important;
      padding: 8mm 8mm !important;
      margin: 15px auto !important;
      background: #ffffff !important;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
      box-sizing: border-box !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: space-between !important;
      page-break-after: always !important;
      break-after: page !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      overflow: hidden !important;
      position: relative !important;
    }

    .admit-card-a4-sheet:last-child {
      page-break-after: avoid !important;
      break-after: avoid !important;
      margin-bottom: 20px !important;
    }

    /* 2 Columns x 2 Rows = 4 Cards */
    .admit-card-grid-4 {
      display: grid !important;
      grid-template-columns: repeat(2, 1fr) !important;
      grid-template-rows: repeat(2, 1fr) !important;
      gap: 5mm !important;
      width: 100% !important;
      height: 100% !important;
      box-sizing: border-box !important;
    }

    .admit-card-slip {
      border: 1.5px solid #0a1d4d !important;
      background: #ffffff !important;
      width: 100% !important;
      height: 100% !important;
      max-height: 136mm !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: space-between !important;
      box-sizing: border-box !important;
      border-radius: 4px !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      overflow: hidden !important;
      position: relative !important;
    }

    @media print {
      body {
        background: #ffffff !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .no-print, .screen-control-bar, input, button {
        display: none !important;
        visibility: hidden !important;
      }
      .admit-card-a4-sheet {
        margin: 0 !important;
        padding: 8mm 8mm !important;
        box-shadow: none !important;
        border: none !important;
        width: 210mm !important;
        height: 297mm !important;
        page-break-after: always !important;
        break-after: page !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      .admit-card-a4-sheet:last-child {
        page-break-after: avoid !important;
        break-after: avoid !important;
      }
    }
  </style>
</head>
<body>
  <div class="screen-control-bar no-print">
    <div>
      <h2 style="margin: 0; font-size: 16px; font-weight: bold; color: #f8fafc;">
        ${schoolName} - পরীক্ষার এডমিট কার্ড (${examName})
      </h2>
      <p style="margin: 3px 0 0; font-size: 11.5px; color: #94a3b8;">
        ১টি A4 পাতায় ৪টি কার্ড • মোড: <span style="color: #fde047; font-weight: bold;">${modeDescription}</span> • শ্রেণি: ${classNameBn}
      </p>
    </div>
    <div style="display: flex; gap: 10px; align-items: center;">
      <span style="font-size: 11px; font-weight: bold; color: #fbbf24; background: rgba(245, 158, 11, 0.15); border: 1px solid #f59e0b; padding: 5px 10px; border-radius: 6px;">
        💡 এপিঠ-ওপিঠ প্রিন্ট দিতে প্রিন্টার সেটিংসে 'Two-Sided (Duplex) - Flip on Long Edge' নির্বাচন করুন
      </span>
      <button onclick="window.print()" style="background: #059669; color: white; border: none; padding: 8px 18px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 13px; box-shadow: 0 4px 6px rgba(0,0,0,0.2);">
        🖨 এখনই প্রিন্ট করুন (Ctrl + P)
      </button>
    </div>
  </div>

  <div style="padding-bottom: 20px;">
    ${cleanedContent}
  </div>

  ${
    autoPrint
      ? `<script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.focus();
        window.print();
      }, 400);
    });
  </script>`
      : ''
  }
</body>
</html>`;
}

export function downloadAdmitCardHtml(
  schoolName: string,
  examName: string,
  classNameBn: string,
  contentHtml: string,
  modeDescription: string = 'এপিঠ ও ওপিঠ'
): void {
  const html = generateAdmitCardFullHtml(
    schoolName,
    examName,
    classNameBn,
    contentHtml,
    false,
    modeDescription
  );
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  const sanitizedExam = examName.replace(/[/\\?%*:|"<>]/g, '_');
  a.download = `এডমিট_কার্ড_${sanitizedExam}_${classNameBn}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

export function openAdmitCardInNewTab(
  schoolName: string,
  examName: string,
  classNameBn: string,
  contentHtml: string,
  modeDescription: string = 'এপিঠ ও ওপিঠ'
): void {
  const html = generateAdmitCardFullHtml(
    schoolName,
    examName,
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
