// ============================================================
// UI CORE: form produk, mascot, init halaman, toast/confirm/prompt, tema, privasi
// (bagian dari script.js asli - FaustLuna Store)
// ============================================================
function usesSellerAccount(type) {
    return type === 'Basic' || type === 'Premium' || !!GACHA_TYPE_MAP[type];
}

function updateSalesFormForType() {
    const typeSelect = document.getElementById('starlight-type');
    const type = typeSelect?.value;
    const needsAccount = usesSellerAccount(type);
    const manualQtyLabel = MANUAL_QTY_TYPES[type];
    const sellerGroup = document.getElementById('seller-account-group');
    const sellerSelect = document.getElementById('seller-account');
    const qtyLabel = document.getElementById('product-qty-label');
    if (sellerGroup) sellerGroup.classList.toggle('hidden', !needsAccount);
    if (sellerSelect) sellerSelect.required = needsAccount;
    if (qtyLabel) qtyLabel.textContent = manualQtyLabel || 'Jumlah (Qty)';

    // Starlight Basic/Premium (ML) = modal otomatis dari rata-rata modal/DM akun
    // penjual yang dipilih (gak bisa diketik manual, karena diambil dari stok DM).
    // Item lain = modal tetap manual, cuma di-default-in dari harga modal per jenis
    // (capitalPrices) biar gampang, tapi tetap bisa diedit kalau harga lagi berubah.
    const capitalGroup = document.getElementById('capital-field-group');
    const capitalInput = document.getElementById('price-capital');
    const capitalAutoInfo = document.getElementById('capital-auto-info');
    if (capitalGroup) capitalGroup.classList.toggle('hidden', needsAccount);
    if (capitalInput) capitalInput.required = !needsAccount;
    if (capitalAutoInfo) capitalAutoInfo.classList.toggle('hidden', !needsAccount);
    if (needsAccount) {
        updateAutoCapitalPreview();
    } else if (capitalInput) {
        capitalInput.value = state.capitalPrices[type] || 0;
    }
}

// Tampilkan preview modal otomatis (per 1 item) buat Starlight Basic/Premium,
// berdasarkan rata-rata modal/DM akun penjual yang lagi dipilih di form.
function updateAutoCapitalPreview() {
    const capitalAutoInfo = document.getElementById('capital-auto-info');
    if (!capitalAutoInfo) return;
    const type = document.getElementById('starlight-type')?.value;
    const dmPerUnit = DM_PER_TYPE[type];
    const gachaInfo = GACHA_TYPE_MAP[type];
    if (!dmPerUnit && !gachaInfo) { capitalAutoInfo.textContent = ''; return; }
    const accId = document.getElementById('seller-account')?.value;
    const acc = state.accounts.find(a => a.id === accId);
    if (!acc) { capitalAutoInfo.textContent = `💎 Pilih akun penjual dulu untuk lihat estimasi modal otomatis.`; return; }
    if (dmPerUnit) {
        const avgCost = acc.avgDmCost || 0;
        const modalPerItem = Math.round(avgCost * dmPerUnit);
        capitalAutoInfo.textContent = `💎 Modal otomatis: Rp ${modalPerItem.toLocaleString('id-ID')}/item (dari rata-rata modal DM akun "${acc.ign || acc.username}", sisa ${acc.diamond || 0} DM)`;
    } else if (gachaInfo) {
        const modalPerItem = Math.round(acc[gachaInfo.avgCostField] || 0);
        capitalAutoInfo.textContent = `🎰 Modal otomatis: Rp ${modalPerItem.toLocaleString('id-ID')}/item (rata-rata modal hasil gacha akun "${acc.ign || acc.username}", stok tersisa ${acc[gachaInfo.stockField] || 0} pcs)`;
    }
}


// Tampilkan dropdown region resmi (Asia/America/dst) kalau game-nya pakai sistem region,
// atau balik ke input Zone ID numerik biasa (perilaku asli) kalau enggak (misal Mobile Legends).
function renderServerField(product) {
    const label = document.getElementById('buyer-zone-label');
    const zoneInput = document.getElementById('buyer-zone');
    const serverSelect = document.getElementById('buyer-server-select');
    if (!label || !zoneInput || !serverSelect) return;

    const regions = SERVER_REGIONS[product];
    if (regions) {
        label.textContent = 'Server';
        zoneInput.classList.add('hidden');
        serverSelect.classList.remove('hidden');
        serverSelect.innerHTML = `<option value="">Pilih Server</option>` +
            regions.map(r => `<option value="${r}">${r}</option>`).join('');
    } else {
        label.textContent = 'Zone ID (Server)';
        serverSelect.classList.add('hidden');
        zoneInput.classList.remove('hidden');
    }
}

function switchToProduct(product) {
    if (!PRODUCT_CONFIG[product]) return;
    currentProduct = product;
    const cfg = PRODUCT_CONFIG[product];

    const headerTitle = document.getElementById('product-header-title');
    if (headerTitle) headerTitle.textContent = `FAUSTLUNA STORE — ${cfg.icon} ${cfg.label.toUpperCase()}`;
    const brand = document.getElementById('product-sidebar-brand');
    if (brand) brand.textContent = `faustluna • ${cfg.label.toLowerCase()}`;
    const heroTitle = document.getElementById('dashboard-hero-title');
    if (heroTitle) heroTitle.textContent = `Halo, Owner FaustLuna! ${cfg.icon}`;
    const heroText = document.getElementById('dashboard-hero-text');
    if (heroText) heroText.textContent = cfg.heroText;

    // Reset ke halaman Dashboard tiap ganti produk
    document.querySelectorAll('#view-product .menu-item').forEach(m => m.classList.remove('active'));
    document.querySelector('#view-product .menu-item[data-target="dashboard"]')?.classList.add('active');
    document.querySelectorAll('#view-product .spa-page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-dashboard')?.classList.add('active');

    // Menu "Info Stok Akun" & kartu dashboard terkait (stok Basic/Premium/Diamond Pool,
    // rekomendasi akun kasir) hanya relevan untuk Mobile Legends — game lain top up
    // langsung ke UID pembeli, jadi gak butuh konsep akun kasir/rotasi sama sekali.
    const isMobileLeg = product === 'mobileleg';
    document.getElementById('menu-item-stok')?.classList.toggle('hidden', !isMobileLeg);
    document.getElementById('menu-item-klaim-wdp')?.classList.toggle('hidden', !isMobileLeg);
    document.getElementById('ml-only-stock-summary')?.classList.toggle('hidden', !isMobileLeg);
    document.getElementById('smart-account-alert')?.classList.toggle('hidden', !isMobileLeg);
    renderServerField(product);

    renderVariationOptions();
    renderAll();
    buildCRMList();

    document.getElementById('view-home')?.classList.add('hidden');
    document.getElementById('view-product')?.classList.remove('hidden');
}

function goHome() {
    document.getElementById('view-product')?.classList.add('hidden');
    document.getElementById('view-home')?.classList.remove('hidden');
    document.querySelectorAll('.sidebar').forEach(s => s.classList.remove('open'));
    document.querySelectorAll('.sidebar-overlay').forEach(o => o.classList.remove('show'));
    renderHomeKeuangan();
}

// --- SISTEM MASKOT LUNA ---
const MASKOT = {
    hai: 'assets/maskot/luna-hai.jpg',
    selamatDatang: 'assets/maskot/luna-selamat-datang.jpg',
    berhasil: 'assets/maskot/luna-berhasil.jpg',
    kosong: 'assets/maskot/luna-data-kosong.jpg',
    recycle: 'assets/maskot/luna-recycle-bin.jpg',
    pengingat: 'assets/maskot/luna-pengingat.jpg',
    terimaKasih: 'assets/maskot/luna-terima-kasih.jpg',
    senang: 'assets/maskot/luna-senang.jpg',
    yeay: 'assets/maskot/luna-yeay.jpg',
    hmm: 'assets/maskot/luna-hmm.jpg',
    bacaBuku: 'assets/maskot/luna-baca-buku.jpg',
    tongkat: 'assets/maskot/luna-tongkat.jpg',
    peluk: 'assets/maskot/luna-peluk-bintang.jpg'
};
let maskotIdleTimer = null;

function setMascotMood(mood, message, duration = 4000) {
    const avatar = document.getElementById('maskot-avatar');
    const bubble = document.getElementById('maskot-bubble');
    if (!avatar || !MASKOT[mood]) return;
    avatar.src = MASKOT[mood];
    if (bubble) {
        if (message) {
            bubble.textContent = message;
            bubble.classList.add('show');
        } else {
            bubble.classList.remove('show');
        }
    }
    if (maskotIdleTimer) clearTimeout(maskotIdleTimer);
    if (duration) {
        maskotIdleTimer = setTimeout(() => {
            avatar.src = MASKOT.hai;
            if (bubble) bubble.classList.remove('show');
        }, duration);
    }
}

function maskotEmptyHTML(mood, text) {
    return `<div class="maskot-empty-state"><img src="${MASKOT[mood] || MASKOT.kosong}" alt="Luna"><span>${text}</span></div>`;
}

function initMascot() {
    const widget = document.getElementById('maskot-widget');
    if (!widget) return;
    widget.addEventListener('click', () => {
        setMascotMood('senang', 'Hai! Ada yang bisa aku bantu? 🌙', 3500);
    });
    const alreadyVisited = localStorage.getItem('fl_visited');
    if (!alreadyVisited) {
        localStorage.setItem('fl_visited', '1');
        setMascotMood('selamatDatang', 'Selamat datang di FaustLuna Store! ✨', 5000);
    } else {
        setMascotMood('hai', 'Hai lagi! Semangat jualan hari ini~ 🌟', 4000);
    }
}

function initLandingPage() {
    const landing = document.getElementById('landing-page');
    if (!landing) { initMascot(); return; }
    // Landing page sekarang isinya form login. Kapan dia ketutup murni
    // ditentukan status login (lihat initAuthGate/enterAppAfterLogin di
    // 10-auth-sync.js) -- bukan lagi flag sessionStorage kayak dulu, supaya
    // orang yang belum/sudah logout tetap ketemu form login, bukan ke-skip.
}

document.addEventListener("DOMContentLoaded", () => {
    // Tampilkan versi aplikasi (dari APP_VERSION di 01-config.js) di sidebar.
    const appVersionLabel = document.getElementById('app-version-label');
    if (appVersionLabel) appVersionLabel.textContent = `🔒 Secure v${APP_VERSION}`;

    // Tombol landing dulu langsung nutup landing page pas diklik (gak ada
    // login). Sekarang landing page isinya form login (lihat 10-auth-sync.js:
    // handleLoginSubmit & enterAppAfterLogin) -- landing cuma ditutup SETELAH
    // login berhasil, bukan langsung pas tombolnya diklik.
    initLandingPage();

    try {
        initTheme();
        initPrivacy();
        setupEventListeners();
        checkResetMonthlySlots();
        autoCleanOldTrash();
        
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }
        
        checkGlobalOverdueAlert();
        const dateInput = document.getElementById('pengeluaran-date');
        if(dateInput) dateInput.value = new Date().toISOString().split('T')[0];
        const homeDateInput = document.getElementById('home-peng-date');
        if(homeDateInput) homeDateInput.value = new Date().toISOString().split('T')[0];
        renderVariationOptions();
        renderAll();
        renderHomeKeuangan();
        buildCRMList();
        renderSettingsForm();
        runAllReminderChecks();
        setInterval(runAllReminderChecks, 30 * 60 * 1000); // cek ulang tiap 30 menit selama app terbuka

        // --- NAVBAR BARU: JAM, SEARCH, NOTIF, AVATAR LUNA ---
        updateHeaderClock();
        setInterval(updateHeaderClock, 1000);
        renderNotifDropdown();

        document.getElementById('btn-search-toggle')?.addEventListener('click', () => {
            document.getElementById('notif-dropdown')?.classList.add('hidden');
            document.getElementById('luna-popup')?.classList.add('hidden');
            const overlay = document.getElementById('search-overlay');
            overlay?.classList.toggle('hidden');
            if (overlay && !overlay.classList.contains('hidden')) {
                document.getElementById('search-input')?.focus();
            }
        });
        document.getElementById('btn-search-close')?.addEventListener('click', () => {
            document.getElementById('search-overlay')?.classList.add('hidden');
        });
        document.getElementById('search-input')?.addEventListener('input', (e) => {
            renderSearchResults(e.target.value);
        });

        document.getElementById('btn-notif-toggle')?.addEventListener('click', () => {
            document.getElementById('search-overlay')?.classList.add('hidden');
            document.getElementById('luna-popup')?.classList.add('hidden');
            renderNotifDropdown();
            document.getElementById('notif-dropdown')?.classList.toggle('hidden');
        });

        document.getElementById('btn-luna-avatar')?.addEventListener('click', () => {
            document.getElementById('search-overlay')?.classList.add('hidden');
            document.getElementById('notif-dropdown')?.classList.add('hidden');
            playSound('click');
            showLunaPopup();
        });

        // Klik di luar panel navbar (search/notif/luna) otomatis menutup panel yang terbuka
        document.addEventListener('click', (e) => {
            const isNavBtn = e.target.closest('#btn-search-toggle, #btn-notif-toggle, #btn-luna-avatar');
            const isPanel = e.target.closest('#search-overlay, #notif-dropdown, #luna-popup');
            if (!isNavBtn && !isPanel) {
                document.getElementById('search-overlay')?.classList.add('hidden');
                document.getElementById('notif-dropdown')?.classList.add('hidden');
                document.getElementById('luna-popup')?.classList.add('hidden');
            }
        });

        pushLog("Sistem FaustLuna berhasil dimuat.");
    } catch (err) {
        console.error('FaustLuna init error:', err);
        showToast('⚠️ Terjadi kendala saat memuat data, coba refresh halaman.', 'error');
    }
});

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById('btn-install-pwa');
    if (installBtn) installBtn.classList.remove('hidden');
});

// Nama asli fungsi ini "saveState" (nyimpen ke localStorage doang). Sekarang
// dipecah: saveStateLocal() = kerjaan lama (nyimpen lokal), sementara
// saveState() jadi wrapper yang SELALU dipanggil kode lain (nama & pemakaian
// gak berubah di tempat lain), tapi tambahin auto-sync ke Supabase abis nyimpen
// lokal -- jadi gak perlu ubah ratusan pemanggilan saveState() yang udah ada.
function saveStateLocal() {
    localStorage.setItem('fl_transactions', JSON.stringify(state.transactions));
    localStorage.setItem('fl_accounts', JSON.stringify(state.accounts));
    localStorage.setItem('fl_trash', JSON.stringify(state.trash));
    localStorage.setItem('fl_archived_tx', JSON.stringify(state.archivedTx));
    localStorage.setItem('fl_logs', JSON.stringify(state.logs));
    localStorage.setItem('fl_ledger', JSON.stringify(state.ledger));
    localStorage.setItem('fl_wdp_purchases', JSON.stringify(state.wdpPurchases));
    localStorage.setItem('fl_pengeluaran', JSON.stringify(state.pengeluaran));
    localStorage.setItem('fl_home_expenses', JSON.stringify(state.homeExpenses));
    localStorage.setItem('fl_capital_prices', JSON.stringify(state.capitalPrices));
    localStorage.setItem('fl_settings', JSON.stringify(state.settings));
    localStorage.setItem('fl_finance_adjustment', JSON.stringify(state.financeAdjustment));
}

function saveState() {
    saveStateLocal();
    if (typeof scheduleAutoSync === 'function') scheduleAutoSync();
}

// Ubah manual nominal Pemasukan atau Saldo. Nilai ini ditambahkan (boleh minus)
// di atas hasil hitung otomatis, jadi hitungan otomatis tetap jalan seperti biasa.
function editFinanceAdjustment(type) {
    const label = type === 'pemasukan' ? 'Pemasukan' : 'Saldo';
    const current = state.financeAdjustment[type] || 0;
    showPrompt(`Masukkan nominal penyesuaian manual untuk ${label} (boleh minus untuk mengurangi). Nilai ini akan ditambahkan ke hasil hitungan otomatis.\n\nPenyesuaian saat ini: ${current}`, current, (input) => {
        const val = parseFloat(String(input).replace(/[^0-9.-]/g, ''));
        if (isNaN(val)) { showToast('❌ Nominal tidak valid.', 'error'); return; }
        state.financeAdjustment[type] = val;
        saveState();
        renderHomeKeuangan();
    });
}

function playSound(type) {
    try {
        const snd = document.getElementById(`snd-${type}`);
        if(snd) { snd.currentTime = 0; snd.play(); }
    } catch(e) {}
}


function pushLog(message) {
    const time = new Date().toLocaleTimeString('id-ID');
    state.logs.unshift(`[${time}] ${message}`);
    if(state.logs.length > 80) state.logs.pop();
    saveState();
    renderLogs();
}

function renderLogs() {
    const area = document.getElementById('log-console-area');
    if(area) area.innerHTML = state.logs.map(l => `<div>${l}</div>`).join('');
}

function showToast(message, type = 'info', mascotMood = null) {
    const container = document.getElementById('toast-container');
    if(!container) return;
    const toast = document.createElement('div');
    toast.className = `custom-toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    
    if(type === 'success') playSound('success');
    if(type === 'error') playSound('alert');

    const autoMood = mascotMood || (type === 'success' ? 'berhasil' : type === 'error' ? 'hmm' : null);
    if (autoMood) setMascotMood(autoMood, message, 3500);
    
    setTimeout(() => { toast.remove(); }, 3000);
}

function showConfirm(message, onConfirmCallback) {
    playSound('alert');
    const modal = document.getElementById('confirm-modal');
    const msgText = document.getElementById('confirm-message');
    const btnOk = document.getElementById('btn-confirm-ok');
    const btnCancel = document.getElementById('btn-confirm-cancel');
    
    if(!modal || !msgText || !btnOk || !btnCancel) return;
    msgText.textContent = message;
    modal.classList.add('open');
    
    const cleanBtnOk = btnOk.cloneNode(true);
    const cleanBtnCancel = btnCancel.cloneNode(true);
    btnOk.parentNode.replaceChild(cleanBtnOk, btnOk);
    btnCancel.parentNode.replaceChild(cleanBtnCancel, btnCancel);
    
    cleanBtnOk.addEventListener('click', () => {
        modal.classList.remove('open');
        if(onConfirmCallback) onConfirmCallback();
    });
    cleanBtnCancel.addEventListener('click', () => {
        modal.classList.remove('open');
    });
}

// Pengganti native prompt() browser, pakai modal custom senada tema aplikasi.
// onConfirmCallback dipanggil dengan nilai input (string) kalau user menekan OKE,
// dan tidak dipanggil sama sekali kalau user menekan BATAL / tutup modal.
function showPrompt(message, defaultValue, onConfirmCallback) {
    playSound('alert');
    const modal = document.getElementById('prompt-modal');
    const msgText = document.getElementById('prompt-message');
    const input = document.getElementById('prompt-input');
    const btnOk = document.getElementById('btn-prompt-ok');
    const btnCancel = document.getElementById('btn-prompt-cancel');

    if(!modal || !msgText || !input || !btnOk || !btnCancel) return;
    msgText.textContent = message;
    input.value = defaultValue !== undefined && defaultValue !== null ? defaultValue : '';
    modal.classList.add('open');
    setTimeout(() => { input.focus(); input.select(); }, 50);

    const cleanBtnOk = btnOk.cloneNode(true);
    const cleanBtnCancel = btnCancel.cloneNode(true);
    btnOk.parentNode.replaceChild(cleanBtnOk, btnOk);
    btnCancel.parentNode.replaceChild(cleanBtnCancel, btnCancel);

    const submit = () => {
        modal.classList.remove('open');
        if(onConfirmCallback) onConfirmCallback(input.value);
    };

    cleanBtnOk.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    cleanBtnCancel.addEventListener('click', () => {
        modal.classList.remove('open');
    });
}

function initTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
}

function toggleTheme() {
    state.theme = state.theme === 'faust-gold' ? 'luna-neon' : 'faust-gold';
    localStorage.setItem('fl_theme', state.theme);
    initTheme();
    showToast(`🎨 Tema berganti ke ${state.theme === 'faust-gold' ? 'Faust Gold' : 'Luna Neon'}`, "success");
}

function initPrivacy() {
    if (state.privacyMode) {
        document.body.classList.add('privacy-active');
        document.querySelectorAll('.privacy-hide').forEach(el => el.classList.add('privacy-blur'));
    } else {
        document.body.classList.remove('privacy-active');
        document.querySelectorAll('.privacy-hide').forEach(el => el.classList.remove('privacy-blur'));
    }
}

function togglePrivacy() {
    state.privacyMode = !state.privacyMode;
    localStorage.setItem('fl_privacy', state.privacyMode);
    initPrivacy();
    renderAll();
}

function checkResetMonthlySlots() {
    const lastReset = localStorage.getItem('fl_last_reset_month');
    const currentMonth = new Date().getMonth();
    if (lastReset === null || parseInt(lastReset) !== currentMonth) {
        state.accounts.forEach(acc => { acc.gift_slots = 3; });
        localStorage.setItem('fl_last_reset_month', currentMonth);
        saveState();
    }
}

