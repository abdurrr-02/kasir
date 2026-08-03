/**
 * printer.js
 * Modul cetak struk sebagai PDF menggunakan window.print().
 * Menggantikan printer Bluetooth thermal — tidak memerlukan perangkat keras,
 * cukup buka dialog cetak browser dan pilih "Simpan sebagai PDF".
 *
 * API publik dipertahankan agar app.js tidak banyak berubah:
 *   ReceiptPrinter.printReceipt(options)
 *   ReceiptPrinter.printTest(options)
 *   ReceiptPrinter.setStatusCallback(fn)   ← tidak‑op, disimpan untuk kompatibilitas
 */

const ReceiptPrinter = (() => {

  // ── Callback status (dipertahankan agar bindPrinterStatus tidak error) ──
  let _statusCb = null;
  function setStatusCallback(fn) { _statusCb = fn; }

  // ── Pemformat uang ──
  function formatMoney(n) {
    return 'Rp' + Math.round(n).toLocaleString('id-ID');
  }

  // ── Buat markup HTML struk ──
  function buildReceiptHTML(receipt) {
    const {
      storeName  = 'Toko Saya',
      address    = '',
      footer     = 'Terima kasih!',
      items      = [],
      total      = 0,
      cash,
      change,
      date       = Date.now(),
    } = receipt;

    const dateStr = new Date(date).toLocaleString('id-ID', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });

    const itemRows = items.map(it => `
      <tr class="item-row">
        <td class="item-name">${escSafe(it.name)}</td>
        <td class="item-qty">${it.qty}×</td>
        <td class="item-price">${formatMoney(it.qty * it.price)}</td>
      </tr>
      <tr class="item-unit-row">
        <td colspan="3" class="item-unit">${formatMoney(it.price)} / item</td>
      </tr>`).join('');

    const paymentRows = (typeof cash === 'number') ? `
      <tr><td>Tunai</td><td></td><td>${formatMoney(cash)}</td></tr>
      <tr class="change-row"><td>Kembalian</td><td></td><td>${formatMoney(change)}</td></tr>` : '';

    return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Struk — ${escSafe(storeName)}</title>
  <style>
    /* ===== RECEIPT PRINT STYLES ===== */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', sans-serif;
      background: #f5f5f5;
      display: flex;
      justify-content: center;
      padding: 24px 12px;
      min-height: 100vh;
    }

    .receipt-wrapper {
      background: #fff;
      width: 320px;
      padding: 24px 20px 32px;
      border-radius: 12px;
      box-shadow: 0 4px 32px rgba(0,0,0,0.12);
      position: relative;
    }

    /* Sawtooth edge atas dan bawah */
    .receipt-wrapper::before,
    .receipt-wrapper::after {
      content: '';
      display: block;
      height: 12px;
      background:
        radial-gradient(circle at 6px -6px, #f5f5f5 8px, transparent 0),
        radial-gradient(circle at 18px -6px, #f5f5f5 8px, transparent 0);
      background-size: 24px 12px;
      position: absolute;
      left: 0; right: 0;
    }
    .receipt-wrapper::before { top: 0; }
    .receipt-wrapper::after  {
      bottom: 0;
      background:
        radial-gradient(circle at 6px 18px, #f5f5f5 8px, transparent 0),
        radial-gradient(circle at 18px 18px, #f5f5f5 8px, transparent 0);
      background-size: 24px 12px;
    }

    .header { text-align: center; margin-bottom: 16px; padding-top: 8px; }

    .store-name {
      font-size: 17px;
      font-weight: 800;
      color: #111;
      line-height: 1.3;
      margin-bottom: 4px;
    }

    .store-address {
      font-size: 11px;
      color: #777;
      line-height: 1.5;
    }

    .divider {
      border: none;
      border-top: 1.5px dashed #ddd;
      margin: 12px 0;
    }

    .date-row {
      font-size: 11px;
      color: #888;
      text-align: center;
      margin-bottom: 12px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    .item-row td {
      padding: 5px 0 2px;
      vertical-align: top;
    }
    .item-name  { color: #222; font-weight: 600; width: 55%; }
    .item-qty   { color: #555; text-align: center; width: 12%; }
    .item-price { text-align: right; font-weight: 700; color: #111; width: 33%; }

    .item-unit-row td { padding: 0 0 6px; }
    .item-unit { font-size: 11px; color: #aaa; }

    .total-section { margin-top: 4px; }

    .total-row-main td {
      padding: 8px 0 4px;
      font-size: 16px;
      font-weight: 800;
      border-top: 2px solid #111;
      color: #111;
    }
    .total-row-main td:last-child { text-align: right; color: #1a7d3e; }

    .change-row td { color: #1a7d3e; font-weight: 700; }
    .change-row td:last-child { text-align: right; }

    table .payment tr td:last-child { text-align: right; }
    table td { vertical-align: middle; }

    .footer-section {
      text-align: center;
      margin-top: 20px;
      padding-top: 12px;
      border-top: 1.5px dashed #ddd;
    }

    .footer-text {
      font-size: 12px;
      color: #888;
      line-height: 1.6;
      font-style: italic;
    }

    .barcode-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin: 14px 0 4px;
      gap: 4px;
    }
    .barcode-lines {
      display: flex;
      gap: 2px;
      height: 36px;
      align-items: flex-end;
    }
    .barcode-lines span {
      display: block;
      width: 2px;
      background: #111;
      border-radius: 1px;
    }
    .barcode-num { font-size: 9px; color: #bbb; letter-spacing: 2px; }

    /* ===== PRINT RULES ===== */
    @media print {
      body {
        background: white;
        padding: 0;
        justify-content: flex-start;
      }
      .receipt-wrapper {
        box-shadow: none;
        border-radius: 0;
        width: 100%;
        max-width: 100%;
      }
      .receipt-wrapper::before,
      .receipt-wrapper::after { display: none; }
      .no-print { display: none !important; }

      @page {
        margin: 8mm;
        size: 80mm auto;
      }
    }
  </style>
</head>
<body>
  <div class="receipt-wrapper">

    <div class="header">
      <div class="store-name">${escSafe(storeName)}</div>
      ${address ? `<div class="store-address">${escSafe(address)}</div>` : ''}
    </div>

    <hr class="divider">
    <div class="date-row">📅 ${dateStr}</div>
    <hr class="divider">

    <table>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <hr class="divider">

    <table class="total-section">
      <tbody>
        <tr class="total-row-main">
          <td>TOTAL</td>
          <td></td>
          <td style="text-align:right">${formatMoney(total)}</td>
        </tr>
        ${paymentRows}
      </tbody>
    </table>

    <div class="barcode-placeholder">
      <div class="barcode-lines">
        ${generateBarcodeSVG()}
      </div>
      <div class="barcode-num">${Date.now().toString().slice(-10)}</div>
    </div>

    <div class="footer-section">
      <div class="footer-text">${escSafe(footer)}</div>
    </div>

  </div>

  <script>
    // Auto-buka dialog cetak setelah font dimuat
    window.addEventListener('load', () => {
      setTimeout(() => window.print(), 400);
    });
  <\/script>
</body>
</html>`;
  }

  // ── Barcode dekoratif sederhana ──
  function generateBarcodeSVG() {
    const heights = [28,20,36,24,32,18,30,22,36,16,28,36,20,30,24,36,18,28,32,20,36,24,16,30];
    return heights.map(h =>
      `<span style="height:${h}px"></span>`
    ).join('');
  }

  // ── Escape HTML ──
  function escSafe(str) {
    return String(str || '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  // ── Cetak struk utama ──
  async function printReceipt(receipt) {
    const html = buildReceiptHTML(receipt);
    openPrintWindow(html);
  }

  // ── Cetak tes ──
  async function printTest() {
    await printReceipt({
      storeName: 'TES CETAK',
      address:   'Koneksi berhasil — siap cetak PDF',
      items:     [{ name: 'Contoh Produk', qty: 1, price: 10000 }],
      total:     10000,
      cash:      10000,
      change:    0,
      footer:    'Printer PDF siap digunakan 🎉',
      date:      Date.now(),
    });
  }

  // ── Buka jendela cetak ──
  function openPrintWindow(html) {
    const win = window.open('', '_blank', 'width=480,height=700,menubar=no,toolbar=no');
    if (!win) {
      alert('Popup diblokir! Mohon izinkan popup untuk situs ini agar struk bisa dicetak.');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  // ── API Publik ──
  return {
    setStatusCallback,
    printReceipt,
    printTest,
    formatMoney,
    // Alias agar app.js yang masih pakai nama "ThermalPrinter" tetap berfungsi
    connect:      () => Promise.resolve('PDF'),
    disconnect:   () => {},
    isConnected:  () => true,
  };

})();

// Alias global agar kode lama (ThermalPrinter.xxx) tetap berjalan
const ThermalPrinter = ReceiptPrinter;
