// ============================================================
// JAM NAVBAR, NOTIFIKASI, SEARCH, POPUP LUNA, PENGINGAT WHATSAPP/BROWSER
// (bagian dari script.js asli - FaustLuna Store)
// ============================================================
// --- JAM DIGITAL NAVBAR --- //
function updateHeaderClock() {
    const el = document.getElementById('header-clock');
    if (!el) return;
    const now = new Date();
    const jam = String(now.getHours()).padStart(2, '0');
    const menit = String(now.getMinutes()).padStart(2, '0');
    el.textContent = `${jam}:${menit}`;
}

// --- NOTIFIKASI: BADGE + DROPDOWN --- //
function getLowStockAccounts() {
    return state.accounts.filter(a => (a.gift_slots || 0) <= 0);
}

function renderNotifBadge() {
    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    const dueSoon = getAllActiveDeliverableTx().filter(t => {
        const d = getDaysRemaining(t.estDeliveryDate);
        return d <= 1;
    });
    const lowStock = getLowStockAccounts();
    const pendingWdp = getPendingWdpClaims();
    const total = dueSoon.length + lowStock.length + pendingWdp.length;

    if (total > 0) {
        badge.textContent = total > 9 ? '9+' : total;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function renderNotifDropdown() {
    const list = document.getElementById('notif-list');
    if (!list) return;

    const dueSoon = getAllActiveDeliverableTx()
        .filter(t => getDaysRemaining(t.estDeliveryDate) <= 1)
        .sort((a, b) => getDaysRemaining(a.estDeliveryDate) - getDaysRemaining(b.estDeliveryDate));
    const lowStock = getLowStockAccounts();
    const pendingWdp = getPendingWdpClaims();

    let html = '';
    pendingWdp.forEach(pw => {
        const acc = state.accounts.find(a => a.id === pw.purchase.accountId);
        html += `<div class="notif-item"><span class="notif-icon">🎁</span><span class="notif-text">WDP <b>${acc ? (acc.ign || acc.username) : '-'}</b> — Hari ke-${pw.dayIndex + 1}/${getWdpTotalDays(pw.purchase)} belum diklaim (aktif sejak jam ${WDP_CLAIM_HOUR}:00)</span></div>`;
    });
    dueSoon.forEach(t => {
        const d = getDaysRemaining(t.estDeliveryDate);
        const label = d < 0 ? `Telat ${Math.abs(d)} hari` : (d === 0 ? 'Jatuh tempo hari ini' : 'Jatuh tempo besok');
        html += `<div class="notif-item"><span class="notif-icon">📦</span><span class="notif-text"><b>${t.buyerName || 'Tanpa Nama'}</b> — ${t.starlightType || '-'}<br>${label}</span></div>`;
    });
    lowStock.forEach(a => {
        html += `<div class="notif-item"><span class="notif-icon">⚠️</span><span class="notif-text">Akun kasir <b>${a.ign || a.username}</b> limit gift bulan ini</span></div>`;
    });

    list.innerHTML = html || `<div class="notif-empty">🌙 Aman, tidak ada notifikasi baru.</div>`;
    renderNotifBadge();
}

// --- SEARCH TRANSAKSI CEPAT --- //
function renderSearchResults(query) {
    const container = document.getElementById('search-results');
    if (!container) return;
    const q = query.trim().toLowerCase();
    if (!q) { container.innerHTML = ''; return; }

    const results = state.transactions.filter(t =>
        (t.buyerName || '').toLowerCase().includes(q) ||
        (t.buyerId || '').toLowerCase().includes(q) ||
        (t.starlightType || '').toLowerCase().includes(q)
    ).slice(0, 15);

    if (results.length === 0) {
        container.innerHTML = `<div class="search-empty">Tidak ada transaksi yang cocok.</div>`;
        return;
    }

    container.innerHTML = results.map(t => `
        <div class="search-result-item">
            <b>${t.buyerName || 'Tanpa Nama'}</b> — ${t.starlightType || '-'}<br>
            Rp ${(t.priceSelling || 0).toLocaleString('id-ID')} · ${t.status || '-'} · ${t.purchaseDate || '-'}
        </div>
    `).join('');
}

// --- POPUP AVATAR LUNA (SAPAAN/TIPS ACAK) --- //
const LUNA_TIPS = [
    { img: 'luna-hai.jpg', text: 'Hai Owner! Jangan lupa cek jadwal kirim hari ini ya~ 🌙' },
    { img: 'luna-senang.jpg', text: 'Cek menu Log Aktivitas kalau mau lihat riwayat semua tindakan di app ini.' },
    { img: 'luna-yeay.jpg', text: 'Rajin backup data lewat Supabase biar aman kalau ganti HP!' },
    { img: 'luna-baca-buku.jpg', text: 'Tips: pakai fitur cari 🔍 buat nemuin transaksi pembeli dengan cepat.' },
    { img: 'luna-peluk-bintang.jpg', text: 'Semangat jualan hari ini, semoga omset makin cuan! ✨' },
    { img: 'luna-pengingat.jpg', text: 'Jangan lupa cek notifikasi 🔔 buat lihat pengiriman yang mau jatuh tempo.' },
    { img: 'luna-terima-kasih.jpg', text: 'Makasih udah pakai FaustLuna Store buat kelola tokomu!' }
];

function showLunaPopup() {
    const popup = document.getElementById('luna-popup');
    const img = document.getElementById('luna-popup-img');
    const text = document.getElementById('luna-popup-text');
    if (!popup || !img || !text) return;

    const tip = LUNA_TIPS[Math.floor(Math.random() * LUNA_TIPS.length)];
    img.src = `assets/maskot/${tip.img}`;
    text.textContent = tip.text;
    popup.classList.remove('hidden');

    clearTimeout(window._lunaPopupTimeout);
    window._lunaPopupTimeout = setTimeout(() => popup.classList.add('hidden'), 5000);
}

// --- PENGINGAT OTOMATIS: WHATSAPP (H-N) & NOTIFIKASI BROWSER (H-1) --- //
function getAllActiveDeliverableTx() {
    // Semua produk (bukan cuma currentProduct) yang masih menunggu kirim dan punya tanggal estimasi kirim
    return state.transactions.filter(t => t.status !== 'Sudah Dikirim' && t.estDeliveryDate);
}

function checkWhatsappDueReminder() {
    const hmin = parseInt(state.settings.waHmin) || 2;
    const notifiedKey = 'fl_wa_notified';
    const notified = safeParse(notifiedKey, {});
    const todayStr = new Date().toISOString().split('T')[0];

    getAllActiveDeliverableTx().forEach(t => {
        const daysLeft = getDaysRemaining(t.estDeliveryDate);
        // Pakai <= (bukan ===) biar tetap kekejar meski app gak sempat dibuka pas
        // hari H-nya persis — flag dikunci per transaksi (bukan per tanggal) supaya
        // notifnya cuma dikirim SEKALI per transaksi, gak diulang tiap hari.
        if (daysLeft <= hmin) {
            const flag = `${t.id}`;
            if (!notified[flag]) {
                sendNativeInstantNotification(
                    `⏰ Pengingat H-${hmin} Pengiriman`,
                    `${t.buyerName || '-'} — ${t.starlightType || '-'} (estimasi kirim: ${t.estDeliveryDate})`
                );
                notified[flag] = true;
            }
        }
    });
    localStorage.setItem(notifiedKey, JSON.stringify(notified));
}

function checkH1BrowserReminders() {
    if (!state.settings.h1NotifEnabled) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const notifiedKey = 'fl_h1_browser_notified';
    const notified = safeParse(notifiedKey, {});
    const todayStr = new Date().toISOString().split('T')[0];

    getAllActiveDeliverableTx().forEach(t => {
        const daysLeft = getDaysRemaining(t.estDeliveryDate);
        if (daysLeft === 1 || daysLeft === 0) {
            const flag = `${t.id}_${todayStr}`;
            if (!notified[flag]) {
                try {
                    const n = new Notification('🌙 FaustLuna Store', {
                        body: `${daysLeft === 0 ? 'HARI INI' : 'Besok'} jatuh tempo kirim: ${t.buyerName || 'Tanpa Nama'} (${t.starlightType || '-'})`,
                        icon: 'logo.png'
                    });
                    notified[flag] = true;
                } catch (err) { console.error('Gagal menampilkan notifikasi browser:', err); }
            }
        }
    });
    localStorage.setItem(notifiedKey, JSON.stringify(notified));
}

// --- PENGINGAT OTOMATIS: KLAIM WDP HARIAN (JAM 16:00) --- //
function checkWdpClaimReadyReminder() {
    const notifiedKey = 'fl_wdp_notified';
    const notified = safeParse(notifiedKey, {});

    getPendingWdpClaims().forEach(pw => {
        // Flag dikunci per pass+hari (bukan per tanggal kalender) supaya notif
        // cuma dikirim SEKALI per jatah, walau app baru dibuka beberapa hari kemudian.
        const flag = `${pw.purchase.id}_${pw.dayIndex}`;
        if (!notified[flag]) {
            const acc = state.accounts.find(a => a.id === pw.purchase.accountId);
            sendNativeInstantNotification(
                '🎁 WDP Siap Diklaim!',
                `${acc ? (acc.ign || acc.username) : 'Akun'} — Hari ke-${pw.dayIndex + 1}/${getWdpTotalDays(pw.purchase)}, jangan lupa klaim sekarang.`
            );
            notified[flag] = true;
        }
    });
    localStorage.setItem(notifiedKey, JSON.stringify(notified));
}

function runAllReminderChecks() {
    checkWhatsappDueReminder();
    checkH1BrowserReminders();
    checkWdpClaimReadyReminder();
}

