/**
 * Generates and downloads a self-contained offline HTML file.
 * Strictly configured for A4 Landscape with 2 slips SIDE-BY-SIDE.
 * Uses fine delicate handwriting dots and positions the logo on the left.
 */
export function downloadPrintableHtml(
  title: string,
  classNameBn: string,
  orientation: 'landscape' | 'portrait',
  contentHtml: string
): void {
  const html = `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - ${classNameBn}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    @page {
      size: 297mm 210mm !important;
      margin: 5mm 5mm !important;
    }
    * {
      box-sizing: border-box !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Hind Siliguri', system-ui, -apple-system, sans-serif;
      background: #e2e8f0;
      margin: 0;
      padding: 12px;
      color: #000000;
    }
    .no-print, .print-hidden, [class*="print:hidden"] {
      display: none !important;
      height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
    }
    .official-voucher-a4-sheet {
      page-break-after: always !important;
      break-after: page !important;
      width: 287mm !important;
      max-width: 287mm !important;
      margin: 0 auto 16px auto;
      background: #ffffff;
      padding: 2mm 3mm;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
      box-sizing: border-box !important;
    }
    .official-voucher-a4-sheet:last-child {
      page-break-after: avoid !important;
      break-after: avoid !important;
      margin-bottom: 0;
    }
    .side-by-side-grid {
      display: grid !important;
      grid-template-columns: 1fr 1fr !important;
      gap: 5mm !important;
      width: 100% !important;
      position: relative !important;
      box-sizing: border-box !important;
    }
    .official-voucher-slip {
      border: 2px solid #000000 !important;
      background: #ffffff !important;
      width: 100% !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: space-between !important;
      padding: 6px 10px !important;
      box-sizing: border-box !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    table {
      border-collapse: collapse !important;
      width: 100% !important;
      border: 2px solid #000000 !important;
    }
    th {
      border-bottom: 2px solid #000000 !important;
      border-right: 1px dashed #cbd5e1 !important;
      background-color: #f1f5f9 !important;
      font-weight: bold !important;
      padding: 3px 6px !important;
    }
    th:last-child {
      border-right: none !important;
    }
    td {
      border-bottom: 1px dashed #cbd5e1 !important;
      border-right: 1px dashed #cbd5e1 !important;
      padding: 2.5px 6px !important;
    }
    td:last-child {
      border-right: none !important;
    }
    .grid-cols-12 {
      display: grid !important;
      grid-template-columns: repeat(12, minmax(0, 1fr)) !important;
      gap: 6px !important;
    }
    .col-span-7 { grid-column: span 7 / span 7 !important; }
    .col-span-5 { grid-column: span 5 / span 5 !important; }
    .flex { display: flex !important; }
    .flex-col { flex-direction: column !important; }
    .flex-1 { flex: 1 1 0% !important; }
    .justify-between { justify-content: space-between !important; }
    .justify-center { justify-content: center !important; }
    .items-center { align-items: center !important; }
    .items-baseline { align-items: baseline !important; }
    .items-end { align-items: flex-end !important; }
    .text-center { text-align: center !important; }
    .text-right { text-align: right !important; }
    .text-left { text-align: left !important; }
    .font-bold { font-weight: 700 !important; }
    .font-semibold { font-weight: 600 !important; }
    .font-medium { font-weight: 500 !important; }
    .border-b-2 { border-bottom: 2px solid #000000 !important; }
    .border-t-2 { border-top: 2px solid #000000 !important; }
    .relative { position: relative !important; }
    .absolute { position: absolute !important; }
    .w-full { width: 100% !important; }
    
    @media print {
      body {
        background: #ffffff !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      .no-print, .print-hidden, [class*="print:hidden"] {
        display: none !important;
        height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .official-voucher-a4-sheet {
        margin: 0 auto !important;
        padding: 0 !important;
        box-shadow: none !important;
        width: 100% !important;
        max-width: 100% !important;
        page-break-after: always !important;
        break-after: page !important;
      }
      .official-voucher-a4-sheet:last-child {
        page-break-after: avoid !important;
        break-after: avoid !important;
      }
      .official-voucher-slip {
        border: 2px solid #000000 !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
    }
  </style>
</head>
<body>
  <div class="no-print" style="position: sticky; top: 0; background: #0f172a; color: white; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3); z-index: 100; border: 1px solid #334155;">
    <div>
      <h2 style="margin: 0; font-size: 17px; font-weight: bold; color: #f8fafc;">${title} (${classNameBn})</h2>
      <p style="margin: 4px 0 0; font-size: 12px; color: #94a3b8;">
        কাগজ সাশ্রয়ী ফরম্যাট: ১টি A4 পাতায় পাশাপাশি ২টি স্লিপ • ৫০% কাগজ সাশ্রয়ী
      </p>
    </div>
    <div style="display: flex; gap: 12px; align-items: center;">
      <span style="font-size: 12px; font-weight: bold; color: #fbbf24; background: rgba(245, 158, 11, 0.15); border: 1px solid #f59e0b; padding: 6px 12px; border-radius: 6px;">
        ⚠️ প্রিন্ট নির্দেশিকা: Print ডায়ালগে Layout "Landscape" (আড়াআড়ি) ও Paper size "A4" নিশ্চিত করুন
      </span>
      <button onclick="window.print()" style="background: #059669; color: white; border: none; padding: 10px 22px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 14px; box-shadow: 0 4px 6px rgba(0,0,0,0.2); transition: background 0.2s;">
        🖨 এখনই প্রিন্ট করুন (Ctrl + P)
      </button>
    </div>
  </div>
  ${contentHtml}
  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.print();
      }, 500);
    });
  </script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = `${title}_${classNameBn}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}
