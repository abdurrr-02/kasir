/**
 * printer.js
 * Modul untuk menghubungkan ke printer thermal Bluetooth (BLE) generik
 * seperti EPPOS EP5813, dan mencetak struk dengan perintah ESC/POS mentah.
 *
 * Karena printer thermal BLE murah/generik tidak punya standar UUID resmi,
 * modul ini mencoba daftar UUID umum yang dipakai berbagai merek, lalu
 * secara otomatis mencari characteristic yang bisa ditulis (write).
 * Jika gagal, pengguna bisa mengisi UUID manual lewat menu Pengaturan.
 */

const ThermalPrinter = (() => {

  // Daftar UUID service/characteristic yang umum dipakai printer BLE generik
  // (SPP-over-BLE, Nordic UART, dan variannya). Ditambahkan sebagai optionalServices
  // supaya browser mengizinkan aplikasi mengaksesnya.
  const KNOWN_SERVICE_UUIDS = [
    '000018f0-0000-1000-8000-00805f9b34fb', // umum di printer mini Cina
    '0000ff00-0000-1000-8000-00805f9b34fb',
    '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10 / banyak modul BLE serial
    '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC / Microchip transparent UART
    '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service (NUS)
    '0000ffb0-0000-1000-8000-00805f9b34fb',
    '0000fee7-0000-1000-8000-00805f9b34fb',
  ];

  let device = null;
  let server = null;
  let writeChar = null;
  let onStatusChange = null;

  function setStatusCallback(fn){ onStatusChange = fn; }

  function notify(status, detail){
    if (onStatusChange) onStatusChange(status, detail);
  }

  function getOverrideUuids(){
    try{
      const raw = localStorage.getItem('pos_printer_uuids');
      return raw ? JSON.parse(raw) : null;
    }catch(e){ return null; }
  }

  function isWritable(characteristic){
    const p = characteristic.properties;
    return p && (p.write || p.writeWithoutResponse);
  }

  async function writeChunked(bytes){
    if (!writeChar) throw new Error('Printer belum terhubung');
    const CHUNK = 180; // aman untuk kebanyakan MTU BLE setelah negosiasi
    for (let i = 0; i < bytes.length; i += CHUNK){
      const slice = bytes.slice(i, i + CHUNK);
      if (writeChar.properties.writeWithoutResponse){
        await writeChar.writeValueWithoutResponse(slice);
      } else {
        await writeChar.writeValue(slice);
      }
      // jeda kecil supaya buffer printer tidak overrun
      await new Promise(r => setTimeout(r, 20));
    }
  }

  async function findWritableCharacteristic(gattServer){
    const override = getOverrideUuids();

    // 1) Coba UUID manual dari pengaturan lanjutan (jika diisi user)
    if (override && override.service && override.characteristic){
      try{
        const svc = await gattServer.getPrimaryService(override.service.toLowerCase());
        const ch = await svc.getCharacteristic(override.characteristic.toLowerCase());
        if (isWritable(ch)) return ch;
      }catch(e){
        console.warn('UUID manual gagal, lanjut ke deteksi otomatis:', e);
      }
    }

    // 2) Coba semua service yang diminta lewat optionalServices
    for (const svcUuid of KNOWN_SERVICE_UUIDS){
      try{
        const svc = await gattServer.getPrimaryService(svcUuid);
        const chars = await svc.getCharacteristics();
        const writable = chars.find(isWritable);
        if (writable) return writable;
      }catch(e){
        // service ini tidak ada di printer, lanjut coba yang lain
      }
    }

    // 3) Fallback terakhir: enumerasi semua primary services yang diizinkan
    try{
      const services = await gattServer.getPrimaryServices();
      for (const svc of services){
        const chars = await svc.getCharacteristics();
        const writable = chars.find(isWritable);
        if (writable) return writable;
      }
    }catch(e){ /* diabaikan */ }

    return null;
  }

  async function connect(){
    if (!navigator.bluetooth){
      throw new Error('Web Bluetooth tidak didukung di browser ini. Gunakan Chrome/Edge di Android.');
    }

    notify('connecting');

    device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: KNOWN_SERVICE_UUIDS,
    });

    device.addEventListener('gattserverdisconnected', () => {
      writeChar = null;
      notify('disconnected');
    });

    server = await device.gatt.connect();
    writeChar = await findWritableCharacteristic(server);

    if (!writeChar){
      notify('error', 'Characteristic tulis tidak ditemukan otomatis. Isi UUID manual di Pengaturan lanjutan.');
      throw new Error('Tidak ada characteristic yang bisa ditulis ditemukan.');
    }

    notify('connected', device.name || 'Printer');
    return device.name || 'Printer';
  }

  function disconnect(){
    if (device && device.gatt.connected){
      device.gatt.disconnect();
    }
    writeChar = null;
    notify('disconnected');
  }

  function isConnected(){
    return !!(device && device.gatt && device.gatt.connected && writeChar);
  }

  // ---------------- ESC/POS ENCODER ----------------
  // Perintah dasar ESC/POS dalam bentuk byte array.
  const CMD = {
    INIT: [0x1B, 0x40],
    ALIGN_LEFT: [0x1B, 0x61, 0x00],
    ALIGN_CENTER: [0x1B, 0x61, 0x01],
    ALIGN_RIGHT: [0x1B, 0x61, 0x02],
    BOLD_ON: [0x1B, 0x45, 0x01],
    BOLD_OFF: [0x1B, 0x45, 0x00],
    DOUBLE_ON: [0x1B, 0x21, 0x30],
    DOUBLE_OFF: [0x1B, 0x21, 0x00],
    FEED_LINE: [0x0A],
    CUT_FULL: [0x1D, 0x56, 0x00],
    CUT_PARTIAL: [0x1D, 0x56, 0x01],
  };

  function textToBytes(str){
    // Konversi teks ke bytes. Karakter di luar ASCII dasar disederhanakan
    // supaya kompatibel dengan codepage default printer (biasanya CP437).
    const normalized = str
      .replace(/[’‘]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/–|—/g, '-');
    const bytes = [];
    for (let i = 0; i < normalized.length; i++){
      const code = normalized.charCodeAt(i);
      bytes.push(code < 256 ? code : 0x3F); // '?' untuk karakter yang tidak didukung
    }
    return bytes;
  }

  function padLine(left, right, width){
    const space = Math.max(1, width - left.length - right.length);
    return left + ' '.repeat(space) + right;
  }

  function wrapText(str, width){
    const words = str.split(' ');
    const lines = [];
    let current = '';
    for (const w of words){
      if ((current + ' ' + w).trim().length > width){
        if (current) lines.push(current);
        current = w;
      } else {
        current = (current ? current + ' ' : '') + w;
      }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [''];
  }

  /**
   * Membangun byte array struk dari data transaksi.
   * @param {object} receipt {storeName, address, items:[{name, qty, price}], total, cash, change, footer, width}
   */
  function buildReceiptBytes(receipt){
    const width = receipt.width || 32;
    let out = [];
    const push = arr => { out = out.concat(arr); };
    const line = (s='') => push(textToBytes(s + '\n'));

    push(CMD.INIT);
    push(CMD.ALIGN_CENTER);
    push(CMD.BOLD_ON);
    push(CMD.DOUBLE_ON);
    line(receipt.storeName || 'Toko Saya');
    push(CMD.DOUBLE_OFF);
    push(CMD.BOLD_OFF);
    if (receipt.address) line(receipt.address);
    line('-'.repeat(width));

    push(CMD.ALIGN_LEFT);
    const dateStr = new Date(receipt.date || Date.now()).toLocaleString('id-ID');
    line(dateStr);
    line('-'.repeat(width));

    receipt.items.forEach(it => {
      wrapText(it.name, width).forEach((l, idx) => line(l));
      const qtyPrice = `${it.qty} x ${formatMoney(it.price)}`;
      const subtotal = formatMoney(it.qty * it.price);
      line(padLine(qtyPrice, subtotal, width));
    });

    line('-'.repeat(width));
    push(CMD.BOLD_ON);
    line(padLine('TOTAL', formatMoney(receipt.total), width));
    push(CMD.BOLD_OFF);

    if (typeof receipt.cash === 'number'){
      line(padLine('Tunai', formatMoney(receipt.cash), width));
      line(padLine('Kembali', formatMoney(receipt.change), width));
    }

    line('-'.repeat(width));
    push(CMD.ALIGN_CENTER);
    line(receipt.footer || 'Terima kasih!');
    push(CMD.FEED_LINE);
    push(CMD.FEED_LINE);
    push(CMD.FEED_LINE);
    push(CMD.CUT_PARTIAL);

    return new Uint8Array(out);
  }

  function formatMoney(n){
    return 'Rp' + Math.round(n).toLocaleString('id-ID');
  }

  async function printReceipt(receipt){
    if (!isConnected()) throw new Error('Printer belum terhubung.');
    const bytes = buildReceiptBytes(receipt);
    await writeChunked(bytes);
  }

  async function printTest(width){
    if (!isConnected()) throw new Error('Printer belum terhubung.');
    const bytes = buildReceiptBytes({
      storeName: 'TES CETAK',
      address: 'Koneksi printer berhasil',
      items: [{ name: 'Contoh item', qty: 1, price: 10000 }],
      total: 10000,
      width: width || 32,
      footer: 'Printer siap digunakan',
      date: Date.now(),
    });
    await writeChunked(bytes);
  }

  return {
    connect, disconnect, isConnected, setStatusCallback,
    printReceipt, printTest, buildReceiptBytes, formatMoney,
  };
})();