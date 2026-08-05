// ============================================================
// PEMBELIAN WDP, GRID PEMBELI, EDIT/HAPUS TRANSAKSI, NOTA & TESTIMONI
// (bagian dari script.js asli - FaustLuna Store)
// ============================================================
// --- PEMBELIAN WDP (MODAL STARLIGHT ML, PER AKUN) --- //
// Total DM 1 pass WDP (fixed, sesuai jatah asli di game): 80 DM langsung masuk
// otomatis pas beli + 20 DM/hari selama 7 hari via klaim manual = 220 DM.
const WDP_INSTANT_DM_PER_UNIT = 80;
const WDP_DAILY_CLAIM_DM = 20;
const WDP_TOTAL_DM_PER_UNIT = WDP_INSTANT_DM_PER_UNIT + WDP_DAILY_CLAIM_DM * 7; // 220

function openWdpModal(accountId) {
    const acc = state.accounts.find(a => a.id === accountId);
    if (!acc) return;
    document.getElementById('form-wdp-purchase')?.reset();
    document.getElementById('wdp-account-id').value = accountId;
    document.getElementById('wdp-account-label').textContent = `${acc.ign || acc.username} (Sisa DM saat ini: 💎 ${acc.diamond || 0}, rata-rata modal/DM: Rp ${Math.round(acc.avgDmCost || 0).toLocaleString('id-ID')})`;
    document.getElementById('wdp-date').value = new Date().toISOString().split('T')[0];
    updateWdpDmPreview();
    document.getElementById('wdp-modal')?.classList.add('open');
}

// Update tampilan "Total DM (otomatis)" tiap "Jumlah WDP Dibeli" diubah.
function updateWdpDmPreview() {
    const el = document.getElementById('wdp-dm-preview');
    if (!el) return;
    const wdpCount = Math.max(1, parseInt(document.getElementById('wdp-count')?.value || 1));
    el.value = `${wdpCount * WDP_TOTAL_DM_PER_UNIT} DM`;
}

function handleAddWdpPurchase(e) {
    e.preventDefault();
    const accountId = document.getElementById('wdp-account-id')?.value;
    const acc = state.accounts.find(a => a.id === accountId);
    if (!acc) { showToast("❌ Akun tidak ditemukan!", "error"); return; }

    const wdpCount = Math.max(1, parseInt(document.getElementById('wdp-count')?.value || 0));
    const totalPrice = parseFloat(document.getElementById('wdp-price')?.value || 0);
    const date = document.getElementById('wdp-date')?.value || new Date().toISOString().split('T')[0];
    if (totalPrice <= 0) { showToast("❌ Isi harga beli dengan benar!", "error"); return; }

    // DM total per pass WDP FIXED 220 (80 instan + 7×20 klaim harian), dikali
    // jumlah WDP yang dibeli sekaligus — bukan input manual lagi, biar gak
    // pernah salah ketik & selalu sinkron sama jatah asli di game.
    const dmReceived = wdpCount * WDP_TOTAL_DM_PER_UNIT;
    const costPerDm = totalPrice / dmReceived;

    // Bagian "instan": 80 DM × jumlah WDP langsung masuk ke akun SEKARANG juga
    // (gak perlu diklaim dulu), pakai rumus rata-rata tertimbang yang sama kayak
    // pembelian DM biasa. Sisanya (7×20 DM per WDP) baru cair bertahap tiap
    // ditandai klaim harian — lihat toggleWdpClaim() & getWdpDailyChunk().
    const instantDm = wdpCount * WDP_INSTANT_DM_PER_UNIT;
    const instantCost = instantDm * costPerDm;
    const oldStock = acc.diamond || 0;
    const oldAvgCost = acc.avgDmCost || 0;
    const oldValue = oldStock * oldAvgCost;
    const newStock = oldStock + instantDm;
    const newValue = oldValue + instantCost;
    acc.diamond = newStock;
    acc.avgDmCost = newStock > 0 ? newValue / newStock : 0;

    // purchasedAt = jam beli yang sebenarnya, dipakai buat nentuin reset 16:00
    // pertama (lihat getWdpClaimUnlockDates). Kalau tanggal yang diisi di form
    // BEDA dari hari ini (misal lagi input data lawas/backfill), jam aslinya gak
    // diketahui — dianggap dibeli jam 00:00 di tanggal itu (asumsi paling aman:
    // sebelum jam 16:00, jadi hari ke-2 kebuka 16:00 di tanggal yang sama).
    const todayStr = new Date().toISOString().split('T')[0];
    const purchasedAt = (date === todayStr) ? new Date().toISOString() : `${date}T00:00:00`;

    state.wdpPurchases.unshift({
        id: "wdp_" + Date.now(), accountId, accountName: acc.ign || acc.username,
        wdpCount, totalPrice, dmReceived, date, dmPending: true,
        purchasedAt,
        instantDm, instantCredited: true,
        // Tracker klaim harian WDP: 1 WDP = 7 hari klaim @20 DM, jadi kalau beli
        // beberapa WDP SEKALIGUS (wdpCount > 1) totalnya dikali (2 WDP = 14 hari
        // klaim, dst). Array boolean sepanjang wdpCount*7, index 0 = hari pertama
        // (tanggal beli, langsung bisa diklaim tanpa nunggu jam reset).
        claims: Array(wdpCount * 7).fill(false)
    });

    // Auto-catat sebagai Pengeluaran di Catatan Keuangan Gabungan, biar Saldo/kas
    // tetap akurat (uang beli WDP ini nyata-nyata keluar dari kantong) — ini tetap
    // dicatat penuh langsung, karena uangnya emang beneran keluar pas beli, beda
    // sama DM yang cairnya bertahap.
    state.homeExpenses.unshift({
        id: "hexp_auto_" + Date.now(),
        desc: `[Otomatis] Beli WDP — ${acc.ign || acc.username} (${wdpCount} WDP, ${dmReceived} DM)`,
        amount: totalPrice,
        date,
        source: 'auto-wdp'
    });

    saveState();
    document.getElementById('wdp-modal')?.classList.remove('open');
    renderAll(); renderHomeKeuangan();
    showToast(`✅ Pembelian WDP dicatat! 💎 +${instantDm} DM langsung masuk. Sisanya (${dmReceived - instantDm} DM) cair bertahap tiap kamu tandai klaim harian di menu 🎁 Klaim WDP.`, "success");
}

function renderWdpHistory(accountId) {
    const acc = state.accounts.find(a => a.id === accountId);
    const modal = document.getElementById('wdp-history-modal');
    const listEl = document.getElementById('wdp-history-list');
    const titleEl = document.getElementById('wdp-history-title');
    if (!modal || !listEl) return;
    if (titleEl) titleEl.textContent = `🧾 Riwayat Beli WDP — ${acc ? (acc.ign || acc.username) : ''}`;

    const purchases = state.wdpPurchases.filter(p => p.accountId === accountId);
    if (purchases.length === 0) {
        listEl.innerHTML = maskotEmptyHTML('kosong', 'Belum ada riwayat pembelian WDP untuk akun ini.');
    } else {
        listEl.innerHTML = purchases.map(p => {
            // Purchase model baru (dmPending): DM cair bertahap tiap klaim, jadi
            // ditampilin progress klaimnya, bukan "rata-rata modal setelah ini"
            // (nilai itu gak relevan lagi karena modalnya nambah dikit-dikit).
            // Purchase lama (belum ada dmPending): tetap tampilkan avgCostAfter asli.
            const statusLine = p.dmPending
                ? `${p.date} • 💎 ${p.instantDm || 0} DM instan${p.instantCredited ? ' (sudah masuk)' : ''} + ${(ensureWdpClaimsField(p).filter(c => c).length)}/${getWdpTotalDays(p)} hari klaim harian`
                : `${p.date} • Rata-rata modal/DM setelah ini: Rp ${Math.round(p.avgCostAfter || 0).toLocaleString('id-ID')}`;
            return `
            <div class="agenda-item" style="justify-content: space-between; align-items: center; display: flex; padding: 10px; border-bottom: 1px solid var(--accent-alpha);">
                <div>
                    <div style="font-weight:bold; font-size: 13px;">${p.wdpCount} WDP → 💎 ${p.dmReceived} DM</div>
                    <div style="font-size:10px; color:var(--text-muted);">${statusLine}</div>
                </div>
                <div style="color:var(--danger-red); font-weight:bold; font-size: 13px;">- Rp ${(p.totalPrice||0).toLocaleString('id-ID')}</div>
            </div>
        `;
        }).join('');
    }
    modal.classList.add('open');
}

// --- KLAIM HARIAN WDP (WEEKLY DIAMOND PASS) --- //
// 1 pass WDP aktif 7 hari sejak tanggal beli. Tiap hari jatahnya baru bisa
// diklaim manual (di game) mulai jam 16:00 — kalau lupa, jatah hari itu bisa
// hangus. Fitur ini murni pengingat/checklist, TIDAK memotong/menambah DM akun
// (perhitungan modal DM tetap dari handleAddWdpPurchase di atas).
const WDP_CLAIM_HOUR = 16; // jam 16:00 (4 sore)

// 1 WDP = 7 hari klaim. Kalau beli beberapa WDP SEKALIGUS dalam satu pembelian,
// totalnya dikali jumlah WDP-nya (2 WDP = 14 hari, 3 WDP = 21 hari, dst) — bukan
// jalan paralel/numpuk di 7 hari yang sama.
function getWdpTotalDays(purchase) {
    return Math.max(1, parseInt(purchase.wdpCount) || 1) * 7;
}

function ensureWdpClaimsField(purchase) {
    const totalDays = getWdpTotalDays(purchase);
    if (!Array.isArray(purchase.claims) || purchase.claims.length !== totalDays) {
        // Kalau sebelumnya udah ada progress klaim (array beda panjang, misal dari
        // versi lama yang selalu 7), pertahankan status yang udah ke-centang sejauh
        // index-nya masih pas, sisanya default belum diklaim.
        const old = Array.isArray(purchase.claims) ? purchase.claims : [];
        purchase.claims = Array.from({ length: totalDays }, (_, i) => !!old[i]);
    }
    return purchase.claims;
}

// Tanggal+jam "buka klaim" untuk tiap hari pass ini — ngikutin jam reset asli di
// game (16:00 tiap hari), BUKAN "24 jam dari waktu beli". Jatah HARI PERTAMA
// (index 0) LANGSUNG bisa diklaim begitu dibeli, jam berapa pun. Jatah hari
// ke-2 dst kebuka di reset 16:00 BERIKUTNYA setelah waktu beli — jadi kalau beli
// sebelum jam 16:00, hari ke-2 udah kebuka jam 16:00 di HARI YANG SAMA; kalau
// beli setelah jam 16:00, hari ke-2 baru kebuka jam 16:00 besoknya. Tiap hari
// setelahnya tinggal +1 hari dari titik itu.
function getWdpClaimUnlockDates(purchase) {
    // purchasedAt = waktu submit form yang sebenarnya (buat nentuin reset 16:00
    // pertama yang relevan). Data lama yang belum punya field ini dianggap
    // dibeli jam 00:00 di tanggal `date`-nya (paling aman: anggap sebelum jam 16:00).
    const purchasedAt = purchase.purchasedAt ? new Date(purchase.purchasedAt) : new Date(`${purchase.date}T00:00:00`);
    const totalDays = getWdpTotalDays(purchase);
    const dates = [];

    // Cari reset 16:00 pertama SETELAH waktu beli.
    const firstReset = new Date(purchasedAt);
    firstReset.setHours(WDP_CLAIM_HOUR, 0, 0, 0);
    if (purchasedAt.getHours() >= WDP_CLAIM_HOUR) {
        firstReset.setDate(firstReset.getDate() + 1);
    }

    for (let i = 0; i < totalDays; i++) {
        if (i === 0) {
            // Hari pertama pass ini — langsung terbuka begitu dibeli.
            dates.push(new Date(purchasedAt));
        } else {
            const d = new Date(firstReset);
            d.setDate(d.getDate() + (i - 1));
            dates.push(d);
        }
    }
    return dates;

}

function getWdpClaimStatusList(purchase) {
    const now = new Date();
    const claims = ensureWdpClaimsField(purchase);
    return getWdpClaimUnlockDates(purchase).map((unlockAt, dayIndex) => ({
        dayIndex, unlockAt,
        claimed: !!claims[dayIndex],
        unlocked: now >= unlockAt
    }));
}

// Jatah DM tiap hari klaim: FIXED 20 DM/hari (sesuai jatah asli WDP di game —
// 80 DM-nya udah masuk otomatis pas beli, lihat handleAddWdpPurchase & instantDm).
// Modal (Rupiah)-nya ikut proporsi: costPerDm = totalPrice / dmReceived (220 per
// WDP), jadi total semua bagian (instan 80 + 7×20 klaim) dijumlah = persis
// totalPrice aslinya, gak ada yang hilang/nambah.
function getWdpDailyChunk(purchase, dayIndex) {
    const dmReceived = purchase.dmReceived || (Math.max(1, parseInt(purchase.wdpCount) || 1) * WDP_TOTAL_DM_PER_UNIT);
    const totalPrice = purchase.totalPrice || 0;
    const costPerDm = dmReceived > 0 ? totalPrice / dmReceived : 0;
    const dm = WDP_DAILY_CLAIM_DM;
    const cost = dm * costPerDm;
    return { dm, cost };
}

function isWdpPassFullyClaimed(purchase) {
    return ensureWdpClaimsField(purchase).every(c => c === true);
}

// Pass yang masih ditampilkan di halaman Klaim WDP: yang masih ada jatah belum diklaim.
function getActiveWdpPurchases() {
    return state.wdpPurchases.filter(p => !isWdpPassFullyClaimed(p));
}

// Semua jatah klaim yang sudah "kebuka" (lewat jam 16:00 hari itu) tapi belum
// dicentang diklaim — ini yang dipakai buat badge notif & notifikasi native.
function getPendingWdpClaims() {
    const pending = [];
    state.wdpPurchases.forEach(p => {
        getWdpClaimStatusList(p).forEach(s => {
            if (s.unlocked && !s.claimed) pending.push({ purchase: p, ...s });
        });
    });
    return pending;
}

function toggleWdpClaim(purchaseId, dayIndex) {
    const p = state.wdpPurchases.find(w => w.id === purchaseId);
    if (!p) return;
    const claims = ensureWdpClaimsField(p);
    const unlockDates = getWdpClaimUnlockDates(p);
    if (new Date() < unlockDates[dayIndex]) {
        const unlockLabel = unlockDates[dayIndex].toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        showToast(`⏳ Belum waktunya, jatah hari ke-${dayIndex + 1} baru aktif ${unlockLabel} jam ${WDP_CLAIM_HOUR}:00.`, "error");
        return;
    }
    const willClaim = !claims[dayIndex];
    claims[dayIndex] = willClaim;

    // Purchase model baru (dmPending): jatah DM & modal hari ini baru dimasukkan
    // (atau ditarik lagi kalau centangnya dilepas) ke akun sekarang, pakai rumus
    // rata-rata tertimbang yang sama kayak pembelian WDP biasa — cuma dicicil per
    // hari. Purchase lama (gak ada dmPending) dibiarkan seperti semula: DM-nya
    // sudah kepotong penuh pas beli dulu, jadi centang di sini murni checklist,
    // TIDAK ikut ubah DM lagi (biar gak dobel keitung).
    let dmInfo = null;
    if (p.dmPending) {
        const acc = state.accounts.find(a => a.id === p.accountId);
        if (acc) {
            const chunk = getWdpDailyChunk(p, dayIndex);
            dmInfo = chunk;
            const sign = willClaim ? 1 : -1;
            const oldStock = acc.diamond || 0;
            const oldAvgCost = acc.avgDmCost || 0;
            const oldValue = oldStock * oldAvgCost;
            const newStock = Math.max(0, oldStock + sign * chunk.dm);
            const newValue = Math.max(0, oldValue + sign * chunk.cost);
            acc.diamond = newStock;
            acc.avgDmCost = newStock > 0 ? newValue / newStock : 0;
        }
    }

    saveState();
    renderAll();
    renderNotifDropdown();
    if (willClaim) {
        const dmText = dmInfo ? ` 💎 +${dmInfo.dm} DM masuk ke akun.` : '';
        showToast(`✅ Klaim WDP hari ke-${dayIndex + 1} dicatat!${dmText}`, "success");
    } else {
        showToast("↩️ Ditandai belum diklaim lagi." + (dmInfo ? ` 💎 -${dmInfo.dm} DM ditarik dari akun.` : ''), "success");
    }
}

function renderKlaimWdpPage() {
    const container = document.getElementById('klaim-wdp-list');
    if (!container) return;
    const active = getActiveWdpPurchases();
    if (active.length === 0) {
        container.innerHTML = maskotEmptyHTML('kosong', 'Belum ada WDP aktif yang perlu diklaim. Beli WDP dulu lewat kartu akun di menu Info Stok Akun.');
        return;
    }
    container.innerHTML = active.map(p => {
        const acc = state.accounts.find(a => a.id === p.accountId);
        const statuses = getWdpClaimStatusList(p);
        const claimedCount = statuses.filter(s => s.claimed).length;
        const dayDots = statuses.map(s => {
            let cls = 'wdp-day-locked', label = s.dayIndex + 1;
            const chunk = getWdpDailyChunk(p, s.dayIndex);
            if (s.claimed) { cls = 'wdp-day-claimed'; label = '✅'; }
            else if (s.unlocked) { cls = 'wdp-day-ready'; label = '⏰'; }
            const title = `Hari ke-${s.dayIndex + 1} — buka ${s.unlockAt.toLocaleDateString('id-ID')} jam ${WDP_CLAIM_HOUR}:00 • 💎 ${chunk.dm} DM`;
            return `<button type="button" class="wdp-day-dot ${cls}" title="${title}" onclick="toggleWdpClaim('${p.id}', ${s.dayIndex})">${label}</button>`;
        }).join('');
        const dmClaimedFromClaims = statuses.filter(s => s.claimed).reduce((sum, s) => sum + getWdpDailyChunk(p, s.dayIndex).dm, 0);
        const dmMasukAkun = (p.instantCredited ? (p.instantDm || 0) : 0) + dmClaimedFromClaims;
        return `
            <div class="premium-card" style="margin-bottom:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <div class="card-header-title" style="font-size:13px;">${acc ? (acc.ign || acc.username) : 'Akun tidak ditemukan'}</div>
                    <div style="font-size:11px; color:var(--text-muted);">${claimedCount}/${getWdpTotalDays(p)} diklaim</div>
                </div>
                <div style="font-size:10px; color:var(--text-muted); margin-bottom:10px;">Dibeli ${p.date} • ${p.wdpCount} WDP • 💎 ${dmMasukAkun}/${p.dmReceived} DM sudah masuk akun ${p.instantCredited ? `(termasuk ${p.instantDm} DM instan)` : ''}</div>
                <div style="display:flex; gap:6px; flex-wrap:wrap;">${dayDots}</div>
            </div>
        `;
    }).join('');
}

// --- CATAT HASIL GACHA (STOK BASIC/PREMIUM JALUR GACHA, PER AKUN) --- //
function openGachaModal(accountId) {
    const acc = state.accounts.find(a => a.id === accountId);
    if (!acc) return;
    document.getElementById('form-gacha-catat')?.reset();
    document.getElementById('gacha-account-id').value = accountId;
    document.getElementById('gacha-account-label').textContent = `${acc.ign || acc.username} (Sisa DM saat ini: 💎 ${acc.diamond || 0})`;
    document.getElementById('gacha-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('gacha-modal')?.classList.add('open');
}

function handleAddGachaLog(e) {
    e.preventDefault();
    const accountId = document.getElementById('gacha-account-id')?.value;
    const acc = state.accounts.find(a => a.id === accountId);
    if (!acc) { showToast("❌ Akun tidak ditemukan!", "error"); return; }

    const baseType = document.getElementById('gacha-type')?.value || 'Basic';
    const mapping = GACHA_TYPE_MAP[`${baseType} Gacha`];
    const qty = parseInt(document.getElementById('gacha-qty')?.value || 0);
    const dmUsed = parseInt(document.getElementById('gacha-dm-used')?.value || 0);
    const date = document.getElementById('gacha-date')?.value || new Date().toISOString().split('T')[0];
    if (!mapping) { showToast("❌ Tipe gacha tidak dikenal!", "error"); return; }
    if (qty <= 0 || dmUsed <= 0) { showToast("❌ Isi jumlah item & DM yang abis dengan benar!", "error"); return; }
    if ((acc.diamond || 0) < dmUsed) { showToast("❌ Sisa DM akun ini nggak cukup buat DM segitu! Catat dulu pembelian WDP-nya.", "error"); return; }

    // Modal batch ini (Rupiah) = DM riil yang abis x rata-rata modal/DM akun (bukan
    // konversi fixed 300/750), lalu dirata-rata tertimbang per item ke stok Gacha yang
    // sudah ada sebelumnya — mirip logika WDP, tapi per-item, bukan per-DM.
    const batchCost = dmUsed * (acc.avgDmCost || 0);
    const oldStock = acc[mapping.stockField] || 0;
    const oldAvgCost = acc[mapping.avgCostField] || 0;
    const oldValue = oldStock * oldAvgCost;
    const newStock = oldStock + qty;
    const newAvgCost = newStock > 0 ? (oldValue + batchCost) / newStock : 0;

    acc[mapping.stockField] = newStock;
    acc[mapping.avgCostField] = newAvgCost;
    // DM langsung dipotong sekarang (saat gacha beneran kejadian), bukan nanti pas dijual.
    acc.diamond = (acc.diamond || 0) - dmUsed;

    state.gachaLogs.unshift({
        id: "gacha_" + Date.now(), accountId, accountName: acc.ign || acc.username,
        baseType, qty, dmUsed, batchCost, avgCostAfter: newAvgCost, date
    });

    saveState();
    document.getElementById('gacha-modal')?.classList.remove('open');
    renderAll();
    showToast(`✅ Hasil gacha dicatat! Modal rata-rata ${baseType} (Gacha) sekarang: Rp ${Math.round(newAvgCost).toLocaleString('id-ID')}/item`, "success");
}

function deleteAccount(id) {
    showConfirm("Apakah Anda yakin ingin menghapus akun penjual ini?", () => {
        state.accounts = state.accounts.filter(a => a.id !== id); saveState(); renderAll(); showToast("🗑️ Akun berhasil dihapus", "success");
    });
}

function renderPembeliGrid() {
    const container = document.getElementById('pembeli-premium-grid'); if(!container) return;
    container.innerHTML = '';
    const searchVal = document.getElementById('search-buyer')?.value.toLowerCase() || '';
    const hideDelivered = document.getElementById('hide-delivered-check')?.checked;
    const hideAcc = document.getElementById('hide-acc-check')?.checked;
    
    let filtered = productTx().filter(t => (t.buyerName || '').toLowerCase().includes(searchVal));
    if (hideDelivered) filtered = filtered.filter(t => t.status !== 'Sudah Dikirim');
    if (hideAcc) filtered = filtered.filter(t => t.friendshipChecked !== true);

    const sortMode = document.getElementById('pembeli-sort-select')?.value || 'default';
    if (sortMode === 'due-asc') {
        filtered = [...filtered].sort((a, b) => (a.estDeliveryDate || '9999-99-99').localeCompare(b.estDeliveryDate || '9999-99-99'));
    } else if (sortMode === 'due-desc') {
        filtered = [...filtered].sort((a, b) => (b.estDeliveryDate || '').localeCompare(a.estDeliveryDate || ''));
    } else if (sortMode === 'name-az') {
        filtered = [...filtered].sort((a, b) => (a.buyerName || '').localeCompare(b.buyerName || ''));
    }

    if(filtered.length === 0) {
        container.innerHTML = maskotEmptyHTML('kosong', 'Kosong / Tidak ditemukan.'); return;
    }
    filtered.forEach(t => {
        const card = document.createElement('div'); card.className = 'premium-card';
        let badgeType = t.status === 'Sudah Dikirim' ? 'status-sudah' : (t.status === 'Booking' ? 'status-booking' : 'status-belum');
        const isStarlightProduct = t.starlightType === 'Basic' || t.starlightType === 'Premium';
        let countdownText = "";
        
        if (isStarlightProduct && t.estDeliveryDate) {
            const daysLeft = getDaysRemaining(t.estDeliveryDate);
            countdownText = `(H-${daysLeft} Hari)`;
            if(daysLeft === 0) countdownText = `🔥 HARI INI!`;
            if(daysLeft < 0) countdownText = `⚠️ TERLAMBAT ${Math.abs(daysLeft)} HARI`;
            if(t.status === 'Sudah Dikirim') countdownText = `✅ Selesai`;
            if((t.status === 'Belum Dikirim' || t.status === 'Booking') && daysLeft === 1) card.style.borderColor = '#ffaa00';

        } else {
            countdownText = t.status === 'Sudah Dikirim' ? `✅ Selesai` : `⚡ (Proses Instan)`;
        }

        let nickHistoryHtml = "";
        if(t.nicknameHistory && t.nicknameHistory.length > 0) {
            nickHistoryHtml = `<div class="nickname-history-box">🔄 Histori Nick: ${t.nicknameHistory.join(' ➡️ ')}</div>`;
        }

        const estRowHtml = isStarlightProduct ? `<div class="premium-row"><span class="lbl">Estimasi Kirim:</span><span class="val" style="color:#ffdf7a; font-weight:bold;">${t.estDeliveryDate || '-'}</span></div>` : '';
        const friendshipRowHtml = isStarlightProduct ? `
            <div class="premium-row">
                <span class="lbl">Pertemanan H+7:</span>
                <span class="val"><input type="checkbox" ${t.friendshipChecked ? 'checked' : ''} onclick="toggleFriendship('${t.id}')"> Terbaca Acc</span>
            </div>
        ` : '';

        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div class="card-header-title">${t.buyerName || 'Tanpa Nama'} <span style="font-size:10px; color:var(--text-gold);">${countdownText}</span></div>
                <span class="pill-badge ${badgeType}" style="cursor:pointer;" onclick="toggleDeliveryStatus('${t.id}')">${t.status || '-'}</span>
            </div>
            <div class="invoice-divider"></div>
            ${nickHistoryHtml}
            <div class="premium-row">
                <span class="lbl">ID / Target:</span>
                <span class="val highlight">
                    ${t.buyerId || '-'} 
                    <button class="live-hide" style="padding:1px 4px; font-size:9px; background:none; border:1px solid var(--text-gold); color:var(--text-gold); cursor:pointer;" onclick="navigator.clipboard.writeText('${t.buyerId || ''}'); showToast('📋 ID Berhasil Disalin!', 'success');">📋 Salin</button>
                </span>
            </div>
            <div class="premium-row"><span class="lbl">Akun Penjual:</span><span class="val" style="color:var(--text-muted);">${t.accountName || '-'}</span></div>
            <div class="premium-row"><span class="lbl">Produk Item:</span><span class="pill-badge">${formatItemLabel(t)}</span></div>
            ${estRowHtml}
            ${friendshipRowHtml}
            <div class="card-action-footer">
                <button class="btn-mini-sec" style="border-color:#e67e22; color:#e67e22;" onclick="addNicknameHistory('${t.id}')">🔄 Nick</button>
                <button class="btn-mini-sec" style="border-color:#2ecc71; color:#2ecc71;" onclick="generateTestimonialImage('${t.id}')">📸 Testimoni</button>
                <button class="btn-mini-sec btn-copy-text" onclick="copyInvoiceText('${t.id}')">📋 Salin Teks</button>
                <button class="btn-mini-sec" onclick="openEditTxModal('${t.id}')">✏️ Edit</button>
                <button class="btn-mini-primary" onclick="generateInvoiceModal('${t.id}')">Nota</button>
                <button class="btn-mini-danger" onclick="moveTxToTrash('${t.id}')">🗑️</button>
            </div>
        `;
        container.appendChild(card);
    });
}

function getDaysRemaining(dateStr) {
    if(!dateStr) return 0;
    const target = new Date(dateStr);
    const today = new Date();
    target.setHours(0,0,0,0); today.setHours(0,0,0,0);
    return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

function openEditTxModal(id) {
    const tx = state.transactions.find(t => t.id === id);
    if (!tx) return;
    const modal = document.getElementById('edit-tx-modal');

    document.getElementById('edit-tx-id').value = tx.id;
    document.getElementById('edit-tx-buyer-name').value = tx.buyerName || '';
    document.getElementById('edit-tx-buyer-id').value = tx.buyerId || '';

    const typeSelect = document.getElementById('edit-tx-type');
    const cfg = PRODUCT_CONFIG[TYPE_TO_PRODUCT[tx.starlightType] || currentProduct];
    typeSelect.innerHTML = cfg.variations.map(v => `<option value="${v.value}">${v.text}</option>`).join('');
    typeSelect.value = tx.starlightType || cfg.variations[0].value;

    // Harga jual & diskon disimpan per-item, tampilkan total kembali biar konsisten dengan tampilan awal
    document.getElementById('edit-tx-price-capital').value = tx.priceCapital || 0;
    document.getElementById('edit-tx-price-selling').value = tx.priceSelling || 0;
    document.getElementById('edit-tx-price-discount').value = tx.priceDiscount || 0;
    document.getElementById('edit-tx-purchase-date').value = tx.purchaseDate || '';
    document.getElementById('edit-tx-est-delivery').value = tx.estDeliveryDate || '';
    document.getElementById('edit-tx-status').value = tx.status || 'Belum Dikirim';

    if (modal) modal.classList.add('open');
}

function handleEditTxSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('edit-tx-id')?.value;
    const tx = state.transactions.find(t => t.id === id);
    if (!tx) return;

    tx.buyerName = document.getElementById('edit-tx-buyer-name')?.value || tx.buyerName;
    tx.buyerId = document.getElementById('edit-tx-buyer-id')?.value || tx.buyerId;
    tx.starlightType = document.getElementById('edit-tx-type')?.value || tx.starlightType;
    tx.priceCapital = parseFloat(document.getElementById('edit-tx-price-capital')?.value) || 0;
    tx.priceSelling = parseFloat(document.getElementById('edit-tx-price-selling')?.value) || 0;
    tx.priceDiscount = parseFloat(document.getElementById('edit-tx-price-discount')?.value) || 0;
    tx.purchaseDate = document.getElementById('edit-tx-purchase-date')?.value || tx.purchaseDate;
    tx.estDeliveryDate = document.getElementById('edit-tx-est-delivery')?.value || tx.estDeliveryDate;
    tx.status = document.getElementById('edit-tx-status')?.value || tx.status;
    tx.netProfit = (tx.priceSelling - tx.priceDiscount) - tx.priceCapital;

    saveState();
    document.getElementById('edit-tx-modal')?.classList.remove('open');
    renderAll(); buildCRMList();
    showToast('✅ Transaksi berhasil diperbarui!', 'success');
}

function addNicknameHistory(id) {
    const tx = state.transactions.find(t => t.id === id);
    showPrompt("Masukkan Nickname lama / perubahan baru pembeli:", "", (oldNick) => {
        if (oldNick && oldNick.trim() !== "") {
            if(!tx.nicknameHistory) tx.nicknameHistory = [];
            tx.nicknameHistory.push(oldNick.trim());
            saveState(); renderPembeliGrid();
            showToast("✅ Riwayat perubahan Nickname berhasil dicatat!");
        }
    });
}

function generateTestimonialImage(id) {
    const tx = state.transactions.find(t => t.id === id);
    const canvas = document.getElementById('testimonial-canvas'); 
    if(!canvas) return showToast("❌ Error: Canvas tidak ditemukan", "error");
    const ctx = canvas.getContext('2d');
    const customColor = state.theme === 'faust-gold' ? '#d4af37' : '#00e5ff';

    ctx.fillStyle = '#060b14'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(214, 175, 55, 0.05)'; ctx.lineWidth = 2;
    for(let i=0; i<canvas.width; i+=40) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,canvas.height); ctx.stroke(); }
    for(let j=0; j<canvas.height; j+=40) { ctx.beginPath(); ctx.moveTo(0,j); ctx.lineTo(canvas.width,j); ctx.stroke(); }
    
    ctx.strokeStyle = customColor; ctx.lineWidth = 6; ctx.strokeRect(30, 30, canvas.width - 60, canvas.height - 60);
    
    ctx.fillStyle = customColor; ctx.font = 'bold 42px Arial'; ctx.textAlign = 'center';
    ctx.fillText('FAUSTLUNA STORE', canvas.width / 2, 160);
    ctx.fillStyle = '#8899a6'; ctx.font = '20px Arial';
    ctx.fillText('🌟 OFFICIAL TESTIMONIAL RECEIPT 🌟', canvas.width / 2, 210);
    
    ctx.fillStyle = '#091124'; ctx.fillRect(80, 280, canvas.width - 160, 200);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 2; ctx.strokeRect(80, 280, canvas.width - 160, 200);
    
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 36px Arial';
    ctx.fillText('THANK YOU FOR ORDERING!', canvas.width / 2, 370);
    ctx.fillStyle = customColor; ctx.font = '20px Arial';
    ctx.fillText('Pesanan Berhasil Diproses Selaras Antrean', canvas.width / 2, 420);
    
    let startY = 580;
    const rows = [
        { lbl: 'PELANGGAN', val: (tx.buyerName || 'Tanpa Nama').toUpperCase() },
        { lbl: 'TARGET ID GAME', val: tx.buyerId || '-' },
        { lbl: 'PRODUK GAME', val: formatItemLabel(tx).toUpperCase() },
        { lbl: 'TANGGAL ORDER', val: tx.purchaseDate || '-' },
        { lbl: 'STATUS SISTEM', val: 'SUDAH DIKIRIM (DONE) ✅' }
    ];
    
    rows.forEach(row => {
        ctx.textAlign = 'left'; ctx.fillStyle = '#8899a6'; ctx.font = 'bold 20px Arial';
        ctx.fillText(row.lbl, 90, startY);
        ctx.textAlign = 'right'; ctx.fillStyle = row.lbl.includes('STATUS') ? '#2ecc71' : '#ffffff';
        ctx.font = 'bold 22px Arial'; ctx.fillText(row.val, canvas.width - 90, startY);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(80, startY + 25); ctx.lineTo(canvas.width - 80, startY + 25); ctx.stroke();
        startY += 85;
    });
    
    ctx.textAlign = 'center'; ctx.fillStyle = '#8899a6'; ctx.font = 'italic 18px Arial';
    ctx.fillText('Follow us for more premium gaming top up services: @faustluna.store', canvas.width / 2, canvas.height - 100);
    
    const link = document.createElement('a'); link.download = `Testi-FaustLuna-${tx.buyerName || 'user'}.png`; link.href = canvas.toDataURL('image/png'); link.click();
    showToast("📸 Gambar testimoni Story (9:16) berhasil diunduh!", "success");
}

function copyInvoiceText(id) {
    const t = state.transactions.find(tx => tx.id === id);
    let textFormat = "";
    
    const isStarlightProduct = t.starlightType === 'Basic' || t.starlightType === 'Premium';

    if (isStarlightProduct) {
        if (t.status === 'Sudah Dikirim') {
            textFormat = `🎉 *BUKTI PENGIRIMAN FAUSTLUNA STORE* 🎉\n==================================\n\nHalo Kak *${t.buyerName}*, terima kasih banyak telah bersabar menunggu antrean! Pesanan top up game kamu telah berhasil dikirim oleh tim kami. Berikut detailnya:\n\n👤 Pembeli : *${t.buyerName}*\n💎 Produk : ${formatItemLabel(t)}\n🎯 Target ID : *${t.buyerId}*\n✅ Status :   *SUDAH DIKIRIM (SELESAI)*\n\n📌 *Catatan:* Silakan cek pesan masuk (in-game mail) atau sistem gift di dalam game kamu sekarang untuk mengklaim produknya ya Kak! 🎮\n\n----------------------------------\n⚡ *Butuh Top Up Instan & Hemat Lainnya?*\nKunjungi web top up resmi kami untuk proses otomatis 24 jam masuk dalam hitungan detik tanpa antre:\n🌐 https://faustluna.my.id/\n\nJangan lupa berikan testimoni terbaikmu ya, Kak! Have a nice day! ✨`;
        } else {
            textFormat = `🧾 *NOTA PESANAN FAUSTLUNA STORE* 🧾\n==================================\n\nHalo Kak *${t.buyerName}*, terima kasih telah mempercayakan top up game kamu di toko kami! Berikut adalah detail pesananmu:\n\n👤 Pembeli : *${t.buyerName}*\n💎 Produk : ${formatItemLabel(t)}\n🗓️ Est. Kirim: *${t.estDeliveryDate}* (Proses Antrean H+7/8)\n\n⚠️ *Catatan Penting:* Mohon pertemanan akun dengan akun penjual tetap aktif dan jangan mengganti Nickname MLBB kamu selama masa tunggu ya agar proses pengiriman lancar tanpa kendala! 🛡️\n\n----------------------------------\n⚡ *Mau Top Up Lebih Cepat & Hemat?*\nKunjungi web top up resmi kami untuk harga diskon harian termurah dan proses otomatis 24 jam di:\n🌐 https://faustluna.my.id/\n\nDitunggu orderan selanjutnya ya, Kak! Have a nice day! ✨`;
        }
    } else {
        if (t.status === 'Sudah Dikirim') {
            textFormat = `🎉 *BUKTI PENGIRIMAN FAUSTLUNA STORE* 🎉\n==================================\n\nHalo Kak *${t.buyerName}*, terima kasih banyak telah berbelanja di toko kami! Pesanan produk game kamu telah berhasil diproses dan sukses masuk ke akunmu. Berikut detailnya:\n\n👤 Pembeli : *${t.buyerName}*\n💎 Produk : ${formatItemLabel(t)}\n🎯 Target ID : *${t.buyerId}*\n✅ Status :   *SUDAH DIKIRIM (SELESAI)*\n\n📌 *Catatan:* Silakan buka game kamu dan cek langsung item/diamond kamu sekarang ya Kak!\n\n----------------------------------\n⚡ *Butuh Top Up Instan & Hemat Lainnya?*\nKunjungi web top up resmi kami untuk proses otomatis 24 jam masuk dalam hitungan detik tanpa antre:\n🌐 https://faustluna.my.id/\n\nJangan lupa berikan testimoni terbaikmu ya, Kak! Have a nice day! ✨`;
        } else {
            textFormat = `🧾 *NOTA PESANAN FAUSTLUNA STORE* 🧾\n==================================\n\nHalo Kak *${t.buyerName}*, terima kasih telah mempercayakan top up game kamu di toko kami! Pesananmu saat ini sudah masuk antrean sistem proses cepat kami. Berikut detailnya:\n\n👤 Pembeli : *${t.buyerName}*\n💎 Produk : ${formatItemLabel(t)}\n🎯 Target ID : *${t.buyerId}*\n⏳ Status :   *SEDANG DIPROSES (CEPAT/INSTAN)*\n\n⚠️ *Catatan Penting:* Produk ini diproses langsung tanpa perlu menunggu waktu pertemanan 7 hari. Mohon ditunggu beberapa saat sementara tim kami menyelesaikan pengiriman ya Kak!\n\n----------------------------------\n⚡ *Mau Top Up Lebih Cepat & Hemat?*\nKunjungi web top up resmi kami untuk harga diskon harian termurah dan proses otomatis 24 jam di:\n🌐 https://faustluna.my.id/\n\nDitunggu orderan selanjutnya ya, Kak! Have a nice day! ✨`;
        }
    }
    
    navigator.clipboard.writeText(textFormat)
        .then(() => { showToast(`📋 Teks nota (${t.status}) ${t.buyerName} berhasil disalin!`, "success"); })
        .catch(() => { showToast("❌ Gagal menyalin teks nota.", "error"); });
}

function toggleFriendship(id) {
    const tx = state.transactions.find(t => t.id === id);
    if(tx) {
        tx.friendshipChecked = !tx.friendshipChecked;
        saveState(); showToast("✅ Status pertemanan diperbarui", "success");
    }
}

function toggleDeliveryStatus(id) {
    const tx = state.transactions.find(t => t.id === id);
    if(!tx) return;
    const needsAccount = usesSellerAccount(tx.starlightType);
    const acc = needsAccount ? state.accounts.find(a => a.id === tx.accountId) : null;
    // WDP, Twilight, dan Diamond tidak punya akun penjual, jadi lewati penyesuaian stok akun
    if (needsAccount && !acc) return;
    const gachaInfo = GACHA_TYPE_MAP[tx.starlightType];
    const dmPerUnit = DM_PER_TYPE[tx.starlightType]; // undefined kalau bukan Basic/Premium (gacha gak dipotong DM di sini)

    if (tx.status === 'Booking') {
        if (tx.starlightType === 'Basic') { if ((acc.basic || 0) <= 0) return; acc.basic--; }
        else if (tx.starlightType === 'Premium') { if ((acc.premium || 0) <= 0) return; acc.premium--; }
        // Jalur Gacha: yang ditahan cuma stok itemnya, DM-nya udah kepotong dari awal
        // (sejak dicatat lewat "Catat Gacha"), jadi diamond gak disentuh di sini.
        else if (gachaInfo) { if ((acc[gachaInfo.stockField] || 0) <= 0) return; acc[gachaInfo.stockField]--; }
        // Slot gift & DM ikut kepotong di sini juga (dulu kelewat, cuma stok starlight
        // yang kepotong) — samain dengan jalur input transaksi langsung non-Booking.
        if (needsAccount) {
            acc.gift_slots = (acc.gift_slots || 0) - 1;
            if (dmPerUnit) acc.diamond = (acc.diamond || 0) - dmPerUnit;
        }
        tx.status = 'Belum Dikirim';
    } else if (tx.status === 'Belum Dikirim') {
        tx.status = 'Sudah Dikirim';
        // Genshin Impact & Wuthering Waves diproses instan (gak ada estimasi H+7 kayak
        // ML), jadi biar tetap ada kabar ke penjual, kirim notif pas statusnya baru aja
        // ditandai "Sudah Dikirim" (bukan pengingat H-N kayak produk ML).
        const prodKeyInstan = TYPE_TO_PRODUCT[tx.starlightType];
        if (prodKeyInstan === 'genshin' || prodKeyInstan === 'wuthering') {
            notifyInstantDeliverySuccess(tx, prodKeyInstan);
        }
    }
    else {
        tx.status = 'Booking';
        if (tx.starlightType === 'Basic') acc.basic++;
        else if (tx.starlightType === 'Premium') acc.premium++;
        else if (gachaInfo) acc[gachaInfo.stockField] = (acc[gachaInfo.stockField] || 0) + 1;
        // Balikin lagi slot gift & DM yang tadi dipotong, karena batal lagi ke Booking.
        if (needsAccount) {
            acc.gift_slots = (acc.gift_slots || 0) + 1;
            if (dmPerUnit) acc.diamond = (acc.diamond || 0) + dmPerUnit;
        }
    }
    saveState(); renderAll(); showToast(`✅ Status: ${tx.status}`, "success");
}

// Notif "pengiriman sukses" khusus produk instan (Genshin Impact & Wuthering Waves).
// Dikirim lewat WhatsApp (kalau sudah disetting) dan notifikasi browser (kalau izinnya
// sudah "granted"), persis polanya reminder H-1 tapi dipicu begitu status berubah,
// bukan berdasarkan hitung mundur tanggal.
function notifyInstantDeliverySuccess(tx, prodKey) {
    const productLabel = PRODUCT_CONFIG[prodKey]?.label || prodKey;
    const textNotif = `*✅ PENGIRIMAN SUKSES!*\n\n` +
        `*Pembeli:* ${tx.buyerName || '-'}\n` +
        `*Produk:* ${productLabel}\n` +
        `*Item:* ${formatItemLabel(tx)}\n\n` +
        `Pesanan sudah berhasil dikirim ke pembeli. 🌙`;
    sendWhatsappNotification(textNotif);
    sendNativeInstantNotification('✅ Pengiriman Sukses', `${tx.buyerName || '-'} — ${productLabel} (${formatItemLabel(tx)})`);

    if ('Notification' in window && Notification.permission === 'granted') {
        try {
            new Notification('🌙 FaustLuna Store', {
                body: `Pengiriman sukses: ${tx.buyerName || 'Tanpa Nama'} — ${productLabel} (${formatItemLabel(tx)})`,
                icon: 'logo.png'
            });
        } catch (err) { console.error('Gagal menampilkan notifikasi browser pengiriman sukses:', err); }
    }
}

function checkGlobalOverdueAlert() {
    const todayStr = new Date().toISOString().split('T')[0];
    const hasUrgent = productTx().some(t => (t.status === 'Belum Dikirim' || t.status === 'Booking') && (t.estDeliveryDate || '') <= todayStr);
    const alertBox = document.getElementById('urgent-alert-container'); 
    const alertText = document.getElementById('alert-zone-text');
    
    if(!alertBox || !alertText) return;
    
    if(hasUrgent) {
        alertBox.classList.remove('hidden');
        alertText.innerHTML = `<strong>Alarm Pengiriman Mendesak!</strong> Ada pesanan menunggak hari ini! Silakan cek menu Info Pembeli.`;
        setMascotMood('pengingat', '⚠️ Ada pesanan menunggak, cek Info Pembeli ya!', 6000);
    } else { alertBox.classList.add('hidden'); }
}

function renderDailyAgenda() {
    const container = document.getElementById('daily-schedule-list'); if(!container) return;
    container.innerHTML = '';
    const todayStr = new Date().toISOString().split('T')[0];
    const todayOrders = productTx().filter(t => t.estDeliveryDate === todayStr && t.status !== 'Sudah Dikirim');
    
    if(todayOrders.length === 0) {
        container.innerHTML = maskotEmptyHTML('peluk', '☕ Santai! Tidak ada jadwal kirim hari ini.'); return;
    }
    todayOrders.forEach(t => {
        const div = document.createElement('div'); div.className = 'agenda-item';
        div.innerHTML = `<div><strong>${t.buyerName || 'Tanpa Nama'}</strong><br><small style="color:var(--text-muted);">${t.accountName || '-'} | ${t.starlightType || '-'}</small></div>
                         <button class="btn-mini-primary" style="padding:4px 8px;" onclick="toggleDeliveryStatus('${t.id}')">🚀 Kirim</button>`;
        container.appendChild(div);
    });
}

function renderRekapPage() {
    const filter = document.getElementById('rekap-month-filter'); if(!filter) return;
    const selectedMonth = filter.value;
    const myTx = productTx();
    const months = [...new Set(myTx.map(t => (t.purchaseDate || '').substring(0, 7)))].filter(Boolean).sort();
    
    filter.innerHTML = '<option value="all">Semua Bulan</option>';
    months.forEach(m => { const opt = document.createElement('option'); opt.value = m; opt.textContent = m; filter.appendChild(opt); });
    filter.value = months.includes(selectedMonth) ? selectedMonth : 'all';

    let txList = filter.value === 'all' ? myTx : myTx.filter(t => (t.purchaseDate || '').startsWith(filter.value));
    let omset = 0, modal = 0, profit = 0;
    
    const container = document.getElementById('rekap-premium-grid'); if(!container) return;
    container.innerHTML = '';
    
    // PELINDUNG DATA KOSONG UNTUK HALAMAN REKAP PEMBUKUAN
    txList.forEach(t => {
        const gross = (parseFloat(t.priceSelling) || 0) - (parseFloat(t.priceDiscount) || 0); 
        omset += gross; 
        modal += (parseFloat(t.priceCapital) || 0); 
        profit += (parseFloat(t.netProfit) || 0);
        
        const card = document.createElement('div'); card.className = 'premium-card'; card.style.padding = '12px 15px';
        card.innerHTML = `
            <div class="premium-row"><span class="lbl" style="font-weight:bold; color:var(--text-gold);">${t.buyerName || 'Tanpa Nama'}</span><span class="val" style="font-size:11px; opacity:0.6;">${t.purchaseDate || '-'}</span></div>
            <div class="premium-row"><span class="lbl">Item & Sumber:</span><span class="val">${formatItemLabel(t)} (${t.accountName || '-'})</span></div>
            <div class="premium-row"><span class="lbl">Omset Bersih:</span><span class="val">Rp ${(gross || 0).toLocaleString('id-ID')}</span></div>
            <div class="premium-row"><span class="lbl">Keuntungan:</span><span class="val privacy-hide" style="color:var(--success-green); font-weight:bold;">Rp ${(parseFloat(t.netProfit) || 0).toLocaleString('id-ID')}</span></div>
            <div style="display:flex; justify-content:flex-end; margin-top:5px;"><button class="btn-mini-danger" style="font-size:10px; padding:2px 8px;" onclick="moveTxToTrash('${t.id}')">Hapus</button></div>
        `;
        container.appendChild(card);
    });
    
    if(document.getElementById('stat-omset')) document.getElementById('stat-omset').textContent = `Rp ${((omset + getArchivedTotals(currentProduct).omset) || 0).toLocaleString('id-ID')}`;
    if(document.getElementById('stat-modal')) document.getElementById('stat-modal').textContent = `Rp ${((modal + getArchivedTotals(currentProduct).modal) || 0).toLocaleString('id-ID')}`;
    if(document.getElementById('stat-profit')) document.getElementById('stat-profit').textContent = `Rp ${((profit + getArchivedTotals(currentProduct).profit) || 0).toLocaleString('id-ID')}`;
    initPrivacy();
}

function moveTxToTrash(id) {
    showConfirm("Pindahkan transaksi ini ke kotak sampah?", () => {
        const idx = state.transactions.findIndex(t => t.id === id);
        const item = state.transactions.splice(idx, 1)[0];

        // Kalau statusnya udah "Sudah Dikirim" pas dihapus, duitnya kan udah
        // beneran cair — arsipin omset/modal/profit-nya PERMANEN ke
        // state.archivedTx biar Pemasukan/Omset/Rekap Pembukuan gak ikut turun,
        // walau kartunya udah gak ada / kotak sampah dikosongin nanti.
        if (item.status === 'Sudah Dikirim') {
            state.archivedTx.push({
                id: item.id,
                productKey: TYPE_TO_PRODUCT[item.starlightType] || currentProduct,
                omset: (parseFloat(item.priceSelling) || 0) - (parseFloat(item.priceDiscount) || 0),
                modal: parseFloat(item.priceCapital) || 0,
                profit: parseFloat(item.netProfit) || 0
            });
        }

        state.trash.push({ id: "trash_" + Date.now(), type: "Transaksi", meta: `Pembeli: ${item.buyerName || '-'} | ${item.starlightType || '-'}`, rawData: item });
        saveState(); renderAll(); buildCRMList(); showToast("🗑️ ...Terbuang ke Kotak Sampah", "success");
    });
}

function renderTrashBin() {
    const container = document.getElementById('trash-premium-grid'); if(!container) return;
    container.innerHTML = '';
    if(state.trash.length === 0) { container.innerHTML = maskotEmptyHTML('recycle', 'Kotak sampah kosong.'); return; }
    state.trash.forEach(item => {
        const card = document.createElement('div'); card.className = 'premium-card';
        card.innerHTML = `
            <div class="card-header-title" style="font-size:13px; color:var(--danger-red);">${item.type || 'Data'}</div>
            <div class="invoice-divider"></div>
            <p style="font-size:12px; opacity:0.8; margin-bottom:10px;">${item.meta || '-'}</p>
            <button class="btn-mini-sec" style="width:100%;" onclick="restoreTrash('${item.id}')">♻️ Pulihkan Data</button>
        `;
        container.appendChild(card);
    });
}

function restoreTrash(id) {
    const idx = state.trash.findIndex(t => t.id === id);
    const restored = state.trash.splice(idx, 1)[0].rawData;
    state.transactions.push(restored);
    // Kalau transaksi ini sebelumnya sempat diarsipkan (lihat moveTxToTrash),
    // hapus dulu entri arsipnya — sekarang udah aktif lagi di transactions,
    // jadi bakal kehitung dari situ. Kalau gak dihapus, nanti dobel kehitung.
    state.archivedTx = state.archivedTx.filter(a => a.id !== restored.id);
    saveState(); renderAll(); buildCRMList(); showToast("♻️ Data berhasil dipulihkan!", "success");
}

function generateInvoiceModal(id) {
    const tx = state.transactions.find(t => t.id === id);
    if(!tx) return;
    
    // PELINDUNG DATA KOSONG UNTUK INVOICE
    const totalClean = (parseFloat(tx.priceSelling) || 0) - (parseFloat(tx.priceDiscount) || 0);
    const itemText = (tx.starlightType || '').includes('Basic') || (tx.starlightType || '').includes('Premium') ? `Starlight ${tx.starlightType}` : formatItemLabel(tx);
    const isStarlightProduct = (tx.starlightType || '') === 'Basic' || (tx.starlightType || '') === 'Premium';
    
    if(document.getElementById('inv-buyer-name')) document.getElementById('inv-buyer-name').textContent = tx.buyerName || 'Tanpa Nama';
    if(document.getElementById('inv-buyer-id')) document.getElementById('inv-buyer-id').textContent = tx.buyerId || '-';
    if(document.getElementById('inv-item-type')) document.getElementById('inv-item-type').textContent = itemText;
    if(document.getElementById('inv-purchase-date')) document.getElementById('inv-purchase-date').textContent = tx.purchaseDate || '-';
    
    const deliveryDateEl = document.getElementById('inv-delivery-date');
    if (deliveryDateEl) {
        const rowEl = deliveryDateEl.closest('.invoice-row');
        if (isStarlightProduct) { rowEl.style.display = 'flex'; deliveryDateEl.textContent = tx.estDeliveryDate || '-'; } else { rowEl.style.display = 'none'; }
    }
    
    if(document.getElementById('inv-total-price')) document.getElementById('inv-total-price').textContent = `Rp ${(totalClean || 0).toLocaleString('id-ID')}`;
    
    const picker = document.getElementById('invoice-theme-picker');
    const customColor = picker ? picker.value : '#d4af37';
    
    const canvas = document.getElementById('invoice-canvas'); 
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#091124'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = customColor; ctx.lineWidth = 3; ctx.setLineDash([6, 6]);
    ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36); ctx.setLineDash([]);
    
    ctx.fillStyle = customColor; ctx.font = 'bold 22px Arial'; ctx.textAlign = 'center';
    ctx.fillText('FAUSTLUNA STORE', canvas.width / 2, 65);
    ctx.fillStyle = '#8899a6'; ctx.font = '12px Arial';
    ctx.fillText('Official Game Gifting Invoice Receipt', canvas.width / 2, 88);
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(40, 115); ctx.lineTo(canvas.width - 40, 115); ctx.stroke(); ctx.setLineDash([]);
    
    const startX = 40; const endX = canvas.width - 40; let currentY = 155;
    const rows = [
        { label: 'Nama Pembeli:', value: tx.buyerName || '-', color: '#ffffff', isBadge: false },
        { label: 'Target Akun:', value: tx.buyerId || '-', color: '#ffffff', isBadge: false },
        { label: 'Produk Item:', value: itemText, color: '#091124', isBadge: true },
        { label: 'Tanggal Beli:', value: tx.purchaseDate || '-', color: '#ffffff', isBadge: false }
    ];
    if (isStarlightProduct) rows.push({ label: 'Estimasi Kirim:', value: tx.estDeliveryDate || '-', color: '#ffdf7a', isBadge: false, isBold: true });
    
    rows.forEach(row => {
        ctx.textAlign = 'left'; ctx.fillStyle = '#ffffff'; ctx.font = '14px Arial';
        ctx.fillText(row.label, startX, currentY); ctx.textAlign = 'right';
        if(row.isBadge) {
            ctx.font = 'bold 12px Arial'; const textWidth = ctx.measureText(row.value).width;
            ctx.fillStyle = customColor; ctx.fillRect(endX - textWidth - 16, currentY - 14, textWidth + 16, 22);
            ctx.fillStyle = '#091124'; ctx.fillText(row.value, endX - 8, currentY + 2);
        } else { ctx.font = row.isBold ? 'bold 14px Arial' : '14px Arial'; ctx.fillStyle = row.color; ctx.fillText(row.value, endX, currentY); }
        currentY += 36;
    });
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(40, currentY); ctx.lineTo(canvas.width - 40, currentY); ctx.stroke(); ctx.setLineDash([]);
    currentY += 35;
    
    ctx.textAlign = 'left'; ctx.fillStyle = '#ffffff'; ctx.font = 'bold 16px Arial'; ctx.fillText('Total Bersih:', startX, currentY);
    ctx.textAlign = 'right'; ctx.fillStyle = '#2ecc71'; ctx.font = 'bold 19px Arial';
    ctx.fillText(`Rp ${(totalClean || 0).toLocaleString('id-ID')}`, endX, currentY);
    
    ctx.textAlign = 'center'; ctx.fillStyle = '#8899a6'; ctx.font = '11px Arial';
    ctx.fillText('Nota Resmi Faustluna Store | Terima kasih atas kepercayaan Anda!', canvas.width / 2, canvas.height - 45);
    
    const invModal = document.getElementById('invoice-modal');
    if(invModal) invModal.classList.add('open');
    
    const downloadBtn = document.getElementById('download-invoice-btn');
    if(downloadBtn) {
        downloadBtn.onclick = () => {
            const link = document.createElement('a'); link.download = `Nota-${tx.buyerName || 'user'}.png`; link.href = canvas.toDataURL('image/png'); link.click();
        };
    }
}

if ('serviceWorker' in window.navigator) {
    const registerSW = () => {
        window.navigator.serviceWorker.register('./sw.js', { scope: './' })
            .then(reg => console.log('Service Worker terdaftar:', reg.scope))
            .catch(err => console.error('Gagal daftar Service Worker:', err));
    };
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        registerSW();
    } else {
        document.addEventListener('DOMContentLoaded', registerSW);
    }
}

// Notifikasi WhatsApp sudah dihapus dari aplikasi — notifikasi toko sekarang
// murni lewat notifikasi native (status bar HP) dan notifikasi browser. Fungsi
// ini sengaja dibiarkan sebagai no-op (bukan dihapus total) supaya pemanggilan
// lama yang mungkin masih ada di kode lain tetap aman, tidak error.
async function sendWhatsappNotification(message) {
    // sengaja kosong — notifikasi WA sudah tidak dipakai lagi.
}

function sendTelegramNotification(message) {
    // sengaja kosong — notifikasi Telegram sudah tidak dipakai lagi.
}


