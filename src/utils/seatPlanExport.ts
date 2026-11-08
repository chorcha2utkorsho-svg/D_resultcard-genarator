/**
 * Generates and downloads a self-contained offline HTML file for Exam Seat Plan Slips.
 * Strictly configured for A4 Portrait with 8 slips (2 columns x 4 rows) per sheet.
 * Uses 'Kalpurush' Bengali font and incorporates student photo, exam name, and room/bench numbers.
 */

export function cleanSeatPlanHtml(rawHtml: string): string {
  // Strip all file input elements and no-print elements from raw HTML to ensure no browser widget artifacts
  let cleaned = rawHtml
    .replace(/<input[^>]*>/gi, '')
    .replace(/<div class="[^"]*no-print[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
  return cleaned;
}

export function generateSeatPlanFullHtml(
  schoolName: string,
  examName: string,
  classNameBn: string,
  contentHtml: string,
  autoPrint: boolean = true
): string {
  const cleanedContent = cleanSeatPlanHtml(contentHtml);

  return `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>আসন বিন্যাস - ${examName} - ${classNameBn}</title>
  
  <!-- Bengali Fonts: Kalpurush and Hind Siliguri -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.maateen.me/kalpurush/font.css" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap" rel="stylesheet">
  
  <!-- Tailwind CSS CDN for 100% utility fidelity -->
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
      size: 210mm 297mm !important; /* Exact A4 Portrait */
      margin: 0 !important; /* Zero margin so sheet fills exactly 1 page */
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

    /* Screen-only top utility bar */
    .screen-control-bar {
      position: sticky;
      top: 0;
      background: #0f172a;
      color: #ffffff;
      padding: 12px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #3b82f6;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
      z-index: 9999;
    }

    /* Strict A4 Sheet: 210mm width x 297mm height */
    .seat-plan-a4-sheet {
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

    .seat-plan-a4-sheet:last-child {
      page-break-after: avoid !important;
      break-after: avoid !important;
      margin-bottom: 20px !important;
    }

    /* 2 Columns x 4 Rows = 8 Cards */
    .seat-plan-grid-8 {
      display: grid !important;
      grid-template-columns: repeat(2, 1fr) !important;
      grid-template-rows: repeat(4, 1fr) !important;
      gap: 3.5mm !important;
      width: 100% !important;
      height: 100% !important;
      box-sizing: border-box !important;
    }

    /* Individual Seat Plan Slip */
    .seat-plan-slip {
      border: 1.5px solid #000000 !important;
      background: #ffffff !important;
      width: 100% !important;
      height: 100% !important;
      max-height: 66mm !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: space-between !important;
      padding: 5px 7px !important;
      box-sizing: border-box !important;
      border-radius: 3px !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      overflow: hidden !important;
      position: relative !important;
      font-family: 'Kalpurush', 'Hind Siliguri', sans-serif !important;
    }

    /* Header Row */
    .seat-plan-header-row {
      display: flex !important;
      flex-direction: row !important;
      align-items: center !important;
      justify-content: space-between !important;
      width: 100% !important;
      border-bottom: 1px solid #000000 !important;
      padding-bottom: 3px !important;
      box-sizing: border-box !important;
    }

    .school-logo-img {
      width: 26px !important;
      height: 26px !important;
      object-fit: contain !important;
      border-radius: 50% !important;
      display: block !important;
    }

    .seat-plan-photo-container {
      width: 44px !important;
      min-width: 44px !important;
      max-width: 44px !important;
      flex-shrink: 0 !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
    }

    .student-photo-box {
      width: 42px !important;
      height: 48px !important;
      border: 1.2px solid #000000 !important;
      border-radius: 2px !important;
      background: #f8fafc !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      overflow: hidden !important;
      box-sizing: border-box !important;
    }

    .student-photo-img {
      width: 100% !important;
      height: 100% !important;
      object-fit: cover !important;
      display: block !important;
    }

    /* Student Info Body */
    .seat-plan-student-body {
      display: flex !important;
      flex-direction: column !important;
      justify-content: center !important;
      gap: 3px !important;
      margin: 2px 0 !important;
      padding: 0 2px !important;
      flex: 1 1 auto !important;
    }

    .student-roll-badge {
      background-color: #fef08a !important;
      border: 1px solid #facc15 !important;
      color: #000000 !important;
      font-weight: 900 !important;
      font-size: 13px !important;
      padding: 1px 6px !important;
      border-radius: 2px !important;
      display: inline-block !important;
      line-height: 1 !important;
    }

    .room-seat-box {
      background-color: #f8fafc !important;
      border: 1px solid #cbd5e1 !important;
      border-radius: 3px !important;
      padding: 2px 6px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      width: 100% !important;
      box-sizing: border-box !important;
      font-size: 8.5px !important;
    }

    /* Footer Row */
    .seat-plan-footer-row {
      display: flex !important;
      flex-direction: row !important;
      align-items: flex-end !important;
      justify-content: space-between !important;
      width: 100% !important;
      border-top: 1px solid #000000 !important;
      padding-top: 3px !important;
      margin-top: 2px !important;
      font-size: 8px !important;
      box-sizing: border-box !important;
    }

    .principal-sig-img {
      max-height: 14px !important;
      max-width: 55px !important;
      object-fit: contain !important;
      display: block !important;
    }

    /* Print-specific Rules */
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
      .seat-plan-a4-sheet {
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
      .seat-plan-a4-sheet:last-child {
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
        ${schoolName} - পরীক্ষার আসন বিন্যাস (${examName})
      </h2>
      <p style="margin: 3px 0 0; font-size: 11.5px; color: #94a3b8;">
        ১ পাতায় ৮টি স্লিপ (A4 Portrait) • শ্রেণি: ${classNameBn} • ফন্ট: কালপুরুষ
      </p>
    </div>
    <div style="display: flex; gap: 10px; align-items: center;">
      <span style="font-size: 11.5px; font-weight: bold; color: #fbbf24; background: rgba(245, 158, 11, 0.15); border: 1px solid #f59e0b; padding: 5px 10px; border-radius: 6px;">
        💡 প্রিন্ট সেটিং: Margins "None" বা "Default" এবং Paper "A4" রাখুন
      </span>
      <button onclick="window.print()" style="background: #059669; hover: background: #047857; color: white; border: none; padding: 8px 18px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 13px; box-shadow: 0 4px 6px rgba(0,0,0,0.2);">
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

export function downloadSeatPlanHtml(
  schoolName: string,
  examName: string,
  classNameBn: string,
  contentHtml: string
): void {
  const html = generateSeatPlanFullHtml(schoolName, examName, classNameBn, contentHtml, false);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  const sanitizedExam = examName.replace(/[/\\?%*:|"<>]/g, '_');
  a.download = `আসন_বিন্যাস_${sanitizedExam}_${classNameBn}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

export function openSeatPlanInNewTab(
  schoolName: string,
  examName: string,
  classNameBn: string,
  contentHtml: string
): void {
  const html = generateSeatPlanFullHtml(schoolName, examName, classNameBn, contentHtml, true);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);
  const newWin = window.open(blobUrl, '_blank');
  
  if (!newWin) {
    // If popup is blocked by the browser, fallback to downloading or direct window.print
    const fallbackLink = document.createElement('a');
    fallbackLink.href = blobUrl;
    fallbackLink.target = '_blank';
    document.body.appendChild(fallbackLink);
    fallbackLink.click();
    document.body.removeChild(fallbackLink);
  }
}
