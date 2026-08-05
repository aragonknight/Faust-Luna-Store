// ============================================================
// EVENT LISTENERS, DASHBOARD, TAMBAH TRANSAKSI/LEDGER, EXPORT-IMPORT, AKUN
// (bagian dari script.js asli - FaustLuna Store)
// ============================================================
function setupEventListeners() {
    document.addEventListener('click', (e) => {
        if(e.target.tagName === 'BUTTON' || e.target.classList.contains('menu-item')) {
            playSound('click');
        }
    });
    
    document.querySelectorAll('.product-card').forEach(card => {
        card.addEventListener('click', () => {
            const product = card.getAttribute('data-product');
            if (product) switchToProduct(product);
        });
    });

    document.getElementById('form-home-pengeluaran')?.addEventListener('submit', handleAddHomeExpense);

    const homeMenuToggle = document.getElementById('home-menu-toggle');
    const homeSidebar = document.getElementById('home-sidebar');
    const homeOverlay = document.getElementById('home-sidebar-overlay');
    homeMenuToggle?.addEventListener('click', () => { homeSidebar?.classList.toggle('open'); homeOverlay?.classList.toggle('show'); });
    homeOverlay?.addEventListener('click', () => { homeSidebar?.classList.remove('open'); homeOverlay?.classList.remove('show'); });

    document.querySelectorAll('.btn-fullscreen-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
                showToast("📺 Masuk Mode Layar Penuh", "success");
            } else {
                document.exitFullscreen();
                showToast("💻 Keluar Mode Layar Penuh");
            }
        });
    });

    document.getElementById('chat-parser')?.addEventListener('input', (e) => {
        const text = e.target.value;
        if(!text.trim()) return;
        const nameMatch = text.match(/(?:Nama|Name|Pembeli|User):\s*([^\n]+)/i);
        const idMatch = text.match(/(?:ID|Target|User\s*ID):\s*([^\n\s(]+)/i);
        const productMatch = text.match(/(?:Order|Produk|Product|Item|Variasi):\s*([^\n]+)/i);
        const priceMatch = text.match(/(?:Harga|Jual|Bayar):\s*(?:Rp\s*)?([\d.]+)/i);

        if (nameMatch && document.getElementById('buyer-name')) document.getElementById('buyer-name').value = nameMatch[1].trim();
        if (idMatch && document.getElementById('buyer-id')) document.getElementById('buyer-id').value = idMatch[1].trim();

        // Zone ID (ML, angka polos) vs Server region (Genshin/Wuthering, nama region)
        if (SERVER_REGIONS[currentProduct]) {
            const serverTextMatch = text.match(/(?:Server|Zone|Region):\s*([^\n]+)/i);
            const serverSelect = document.getElementById('buyer-server-select');
            if (serverTextMatch && serverSelect) {
                const wanted = serverTextMatch[1].trim().toLowerCase();
                const match = SERVER_REGIONS[currentProduct].find(r => r.toLowerCase().includes(wanted) || wanted.includes(r.toLowerCase()));
                if (match) serverSelect.value = match;
            }
        } else {
            const serverMatch = text.match(/(?:Server|Zone|Zone\s*ID):\s*(\d+)/i) || text.match(/\((\d+)\)/);
            if (serverMatch && document.getElementById('buyer-zone')) document.getElementById('buyer-zone').value = serverMatch[1].trim();
        }

        if (productMatch) {
            const prodText = productMatch[1].toLowerCase();
            const selectEl = document.getElementById('starlight-type');
            if (selectEl) {
                if (prodText.includes('basic')) selectEl.value = 'Basic';
                else if (prodText.includes('premium')) selectEl.value = 'Premium';
                else if (prodText.includes('wdp') || prodText.includes('weekly')) selectEl.value = 'WDP';
                else if (prodText.includes('twilight')) selectEl.value = 'Twilight';
                else if (prodText.includes('diamond')) selectEl.value = 'Diamond';
                else if (prodText.includes('custom') || prodText.includes('dm')) selectEl.value = 'Custom DM';
                else if (prodText.includes('genesis') || prodText.includes('crystal')) selectEl.value = 'Genesis Crystal';
                else if (prodText.includes('welkin') || prodText.includes('blessing')) selectEl.value = 'Blessing of the Welkin Moon';
                else if (prodText.includes('gnostic') || prodText.includes('battle pass')) selectEl.value = 'Battle Pass Gnostic Hymn';
                else if (prodText.includes('astrite')) selectEl.value = 'Astrite';
                else if (prodText.includes('radiant')) selectEl.value = 'Radiant Tide';
                else if (prodText.includes('pioneer') || prodText.includes('podcast')) selectEl.value = 'Pioneer Podcast';
                else if (prodText.includes('genshin')) selectEl.value = 'Genesis Crystal';
                else if (prodText.includes('wuthering')) selectEl.value = 'Astrite';
                updateSalesFormForType();
            }
        }
        if (priceMatch && document.getElementById('price-selling')) {
            const cleanPrice = priceMatch[1].replace(/\./g, '');
            document.getElementById('price-selling').value = cleanPrice;
        }
        
        document.getElementById('buyer-id')?.dispatchEvent(new Event('input'));
        updateSalesFormForType();
    });

    document.getElementById('starlight-type')?.addEventListener('change', updateSalesFormForType);

    document.getElementById('buyer-id')?.addEventListener('input', (e) => {
        const inputVal = e.target.value.trim();
        const match = inputVal.match(/\(([^)]+)\)/) || inputVal.match(/\s(\d{4,5})$/);
        if(match && document.getElementById('buyer-zone')) document.getElementById('buyer-zone').value = match[1];
        const baseId = inputVal.replace(/\([^)]*\)/g, "").trim();
        const isDuplicate = state.transactions.some(t => (t.buyerId || '').includes(baseId) && t.status !== 'Sudah Dikirim');
        document.getElementById('id-duplicate-warning')?.classList.toggle('hidden', !(baseId.length > 4 && isDuplicate));
    });

    document.getElementById('buyer-name')?.addEventListener('change', (e) => {
        const name = e.target.value.trim();
        const found = [...state.transactions].reverse().find(t => (t.buyerName || '').toLowerCase() === name.toLowerCase());
        if(found && document.getElementById('buyer-id')) {
            document.getElementById('buyer-id').value = found.buyerId || '';
            document.getElementById('buyer-id').dispatchEvent(new Event('input'));
            showToast(`🔄 Pelanggan lama terdeteksi! Auto-fill ID Berhasil.`);
        }
    });

    document.getElementById('btn-add-ledger')?.addEventListener('click', () => {
        const f = document.getElementById('form-ledger');
        if(f) f.style.display = f.style.display === 'none' ? 'block' : 'none';
    });
    
    document.getElementById('form-ledger')?.addEventListener('submit', handleAddLedger);
    document.getElementById('btn-clear-logs')?.addEventListener('click', () => {
        state.logs = []; saveState(); renderLogs(); showToast("Log dibersihkan");
    });
    
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    
    menuToggle?.addEventListener('click', () => { sidebar?.classList.toggle('open'); overlay?.classList.toggle('show'); });
    overlay?.addEventListener('click', () => { sidebar?.classList.remove('open'); overlay?.classList.remove('show'); });
    
    document.getElementById('btn-back-home')?.addEventListener('click', goHome);

    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', () => {
            const scope = item.closest('.app-view') || document;
            scope.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
            item.classList.add('active');
            const target = item.getAttribute('data-target');
            scope.querySelectorAll('.spa-page').forEach(page => page.classList.remove('active'));
            scope.querySelector(`#page-${target}`)?.classList.add('active');
            if (target === 'home-keuangan') renderHomeKeuangan();
            if (target === 'pengeluaran') renderPengeluaran();
            document.querySelectorAll('.sidebar').forEach(s => s.classList.remove('open'));
            document.querySelectorAll('.sidebar-overlay').forEach(o => o.classList.remove('show'));
        });
    });
    
    document.getElementById('theme-switch')?.addEventListener('click', toggleTheme);
    document.getElementById('privacy-toggle')?.addEventListener('click', togglePrivacy);
    document.getElementById('form-penjualan')?.addEventListener('submit', handleAddSale);
    document.getElementById('form-account')?.addEventListener('submit', handleSaveAccount);
    document.getElementById('search-buyer')?.addEventListener('input', renderPembeliGrid);
    document.getElementById('hide-delivered-check')?.addEventListener('change', renderPembeliGrid);
    document.getElementById('hide-acc-check')?.addEventListener('change', renderPembeliGrid);
    document.getElementById('rekap-month-filter')?.addEventListener('change', renderRekapPage);
    document.getElementById('close-invoice')?.addEventListener('click', () => document.getElementById('invoice-modal')?.classList.remove('open'));
    document.getElementById('btn-close-invoice-card')?.addEventListener('click', () => document.getElementById('invoice-modal')?.classList.remove('open'));
    document.getElementById('close-account-modal')?.addEventListener('click', () => document.getElementById('account-modal')?.classList.remove('open'));
    document.getElementById('btn-add-account')?.addEventListener('click', () => openAccountModal());

    // Pembelian WDP (modal Starlight ML per akun)
    document.getElementById('form-wdp-purchase')?.addEventListener('submit', handleAddWdpPurchase);
    document.getElementById('close-wdp-modal')?.addEventListener('click', () => document.getElementById('wdp-modal')?.classList.remove('open'));
    document.getElementById('close-wdp-history-modal')?.addEventListener('click', () => document.getElementById('wdp-history-modal')?.classList.remove('open'));
    // Catat hasil Gacha (stok Basic/Premium jalur Gacha per akun)
    document.getElementById('form-gacha-catat')?.addEventListener('submit', handleAddGachaLog);
    document.getElementById('close-gacha-modal')?.addEventListener('click', () => document.getElementById('gacha-modal')?.classList.remove('open'));
    // Update preview modal otomatis tiap ganti akun penjual di form Input Penjualan
    document.getElementById('seller-account')?.addEventListener('change', updateAutoCapitalPreview);
    
    document.getElementById('clear-trash-btn')?.addEventListener('click', () => {
        showConfirm("Hapus permanen semua isi kotak sampah?", () => {
            state.trash = []; saveState(); renderTrashBin(); showToast("🗑️ Kotak sampah dikosongkan!", "success");
        });
    });
    
    document.getElementById('export-csv-btn')?.addEventListener('click', exportDataToCSV);

    // Sorting
    document.getElementById('pembeli-sort-select')?.addEventListener('change', renderPembeliGrid);
    document.getElementById('stok-sort-select')?.addEventListener('change', renderAccountGrid);

    // Edit Transaksi
    document.getElementById('form-edit-tx')?.addEventListener('submit', handleEditTxSubmit);
    document.getElementById('close-edit-tx-modal')?.addEventListener('click', () => document.getElementById('edit-tx-modal')?.classList.remove('open'));

    // Pengaturan: WhatsApp, Notifikasi H-1, Supabase
    document.getElementById('set-wa-hmin')?.addEventListener('change', handleChangeHmin);
    document.getElementById('set-h1-notif-enabled')?.addEventListener('change', handleToggleH1Notif);
    document.getElementById('form-settings-supabase')?.addEventListener('submit', handleSaveSupabaseSettings);
    document.getElementById('btn-supabase-push')?.addEventListener('click', pushStateToSupabase);
    document.getElementById('btn-supabase-pull')?.addEventListener('click', pullStateFromSupabase);
}

function buildCRMList() {
    const listEl = document.getElementById('crm-buyer-list'); if(!listEl) return;
    const names = [...new Set(state.transactions.map(t => t.buyerName || 'Tanpa Nama'))];
    listEl.innerHTML = names.map(n => `<option value="${n}">`).join('');
}

function renderDashboard() {
    const todayStr = new Date().toISOString().split('T')[0];
    const totalBasic = state.accounts.reduce((sum, a) => sum + (parseInt(a.basic) || 0) + (parseInt(a.basicGacha) || 0), 0);
    const totalPremium = state.accounts.reduce((sum, a) => sum + (parseInt(a.premium) || 0) + (parseInt(a.premiumGacha) || 0), 0);
    const totalDm = state.accounts.reduce((sum, a) => sum + (parseInt(a.diamond) || 0), 0);
    
    if(document.getElementById('global-stock-basic')) document.getElementById('global-stock-basic').textContent = `${totalBasic} Pcs`;
    if(document.getElementById('global-stock-premium')) document.getElementById('global-stock-premium').textContent = `${totalPremium} Pcs`;
    
    // PELINDUNG DATA KOSONG UNTUK DASHBOARD DM
    if(document.getElementById('global-dm-pool')) {
        document.getElementById('global-dm-pool').textContent = `💎 ${(totalDm || 0).toLocaleString('id-ID')}`;
    }
    
    const todayTransactions = productTx().filter(t => t.purchaseDate === todayStr);
    const orderMasukCount = todayTransactions.length;
    const terkirimCount = todayTransactions.filter(t => t.status === 'Sudah Dikirim').length;
    const profitToday = todayTransactions.reduce((sum, t) => sum + (parseFloat(t.netProfit) || 0), 0);
    
    if(document.getElementById('today-orders-count')) document.getElementById('today-orders-count').textContent = orderMasukCount;
    if(document.getElementById('today-success-count')) document.getElementById('today-success-count').textContent = terkirimCount;
    
    // PELINDUNG DATA KOSONG UNTUK DASHBOARD PROFIT
    if(document.getElementById('today-profit-count')) {
        document.getElementById('today-profit-count').textContent = `Rp ${(profitToday || 0).toLocaleString('id-ID')}`;
    }
    
    const healthyAccount = [...state.accounts]
        .filter(a => (a.gift_slots || 0) > 0)
        .sort((a, b) => (b.diamond || 0) - (a.diamond || 0))[0];
    
    const alertEl = document.getElementById('smart-account-alert');
    if (alertEl) {
        if (healthyAccount) {
            alertEl.style.color = "var(--success-green)";
            alertEl.style.borderColor = "var(--success-green)";
            alertEl.style.backgroundColor = "rgba(46, 204, 113, 0.08)";
            alertEl.textContent = `✅ Rekomendasi Akun Siap Gas: "${healthyAccount.ign || 'No Name'}" (Sisa Slot: ${healthyAccount.gift_slots || 0}x | 💎 ${healthyAccount.diamond || 0})`;
        } else {
            alertEl.style.color = "var(--danger-red)";
            alertEl.style.borderColor = "var(--danger-red)";
            alertEl.style.backgroundColor = "rgba(231, 76, 60, 0.08)";
            alertEl.textContent = `⚠️ Peringatan: Semua akun kasir penjual sudah limit gift bulan ini!`;
        }
    }
    
    const pingContainer = document.getElementById('ping-action-list');
    if(pingContainer) {
        const activeToday = productTx().filter(t => t.estDeliveryDate === todayStr && t.status !== 'Sudah Dikirim');
        if(activeToday.length === 0) {
            pingContainer.innerHTML = maskotEmptyHTML('senang', '☕ Semua kontak bersih untuk hari ini.');
        } else {
            pingContainer.innerHTML = activeToday.map(t => `
                <div class="agenda-item">
                    <span style="font-family: monospace; font-weight:bold; word-break: break-all;">📞 ${t.buyerName || 'Tanpa Nama'}</span>
                    <button class="btn-mini-primary" style="padding: 4px 8px; font-size: 10px;" onclick="navigator.clipboard.writeText('${t.buyerName || ''}'); showToast('📋 Kontak berhasil disalin!', 'success');">📋 Salin</button>
                </div>
            `).join('');
        }
    }
    initPrivacy();
}

function renderAll() {
    renderAccountDropdown();
    renderAccountGrid();
    renderPembeliGrid();
    renderRekapPage();
    renderTrashBin();
    renderDailyAgenda();
    renderLedger();
    renderLogs();
    renderDashboard();
    renderKlaimWdpPage();
    renderPengeluaran();
    checkGlobalOverdueAlert();
    renderNotifBadge();
    scheduleNativeReminders();
    const dateInput = document.getElementById('pengeluaran-date');
    if(dateInput) dateInput.value = new Date().toISOString().split('T')[0];
}

function handleAddLedger(e) {
    e.preventDefault();
    const platform = document.getElementById('led-platform')?.value || 'Cash';
    const amount = parseFloat(document.getElementById('led-amount')?.value || 0);
    const desc = document.getElementById('led-desc')?.value || '';
    const time = new Date().toISOString().split('T')[0];
    state.ledger.unshift({ id: "led_"+Date.now(), platform, amount, desc, time });
    saveState(); e.target.reset(); e.target.style.display = 'none';
    renderLedger(); showToast("💰 Mutasi manual berhasil disimpan!", "success");
}

function handleAddSale(e) {
    e.preventDefault();
    const buyerName = document.getElementById('buyer-name')?.value || 'Tanpa Nama';
    const starlightType = document.getElementById('starlight-type')?.value || 'Basic';
    const needsAccount = usesSellerAccount(starlightType);
    const isManualQty = !!MANUAL_QTY_TYPES[starlightType];
    const accountId = needsAccount ? (document.getElementById('seller-account')?.value || '') : '';
    const dmPerUnit = DM_PER_TYPE[starlightType]; // undefined kalau bukan Basic/Premium
    let priceCapital = parseFloat(document.getElementById('price-capital')?.value || 0);
    const priceSelling = parseFloat(document.getElementById('price-selling')?.value || 0);
    const priceDiscount = parseFloat(document.getElementById('price-discount')?.value || 0);
    const purchaseDate = document.getElementById('purchase-date')?.value || new Date().toISOString().split('T')[0];
    const status = document.getElementById('transaction-status')?.value || 'Belum Dikirim';
    
    // Untuk item qty manual (Diamond/Genesis Crystal/Astrite), field ini berfungsi sebagai
    // jumlah currency (disimpan di 1 transaksi, bukan dikalikan jadi banyak baris transaksi
    // seperti Basic/Premium/WDP/Twilight).
    const qty = parseInt(document.getElementById('product-qty')?.value) || 1;

    let acc = null;
    const gachaInfo = GACHA_TYPE_MAP[starlightType]; // ada isinya kalau tipe "... Gacha"
    if (needsAccount) {
        acc = state.accounts.find(a => a.id === accountId);
        if(!acc) { showToast("❌ Akun penjual tidak ditemukan!", "error"); return; }

        if (status !== 'Booking') {
            if (starlightType === 'Basic' && (acc.basic || 0) < qty) { showToast(`❌ Stok Basic tidak cukup!`, "error"); return; }
            if (starlightType === 'Premium' && (acc.premium || 0) < qty) { showToast(`❌ Stok Premium tidak cukup!`, "error"); return; }
            if (gachaInfo && (acc[gachaInfo.stockField] || 0) < qty) { showToast(`❌ Stok ${starlightType} tidak cukup!`, "error"); return; }
            if ((acc.gift_slots || 0) < qty) { showToast(`❌ Slot gift tidak cukup!`, "error"); return; }
            // Stok DM cuma dicek buat jalur Biasa (dmPerUnit) — jalur Gacha DM-nya udah
            // dipotong sejak dicatat lewat "Catat Gacha", jadi gak dicek ulang di sini.
            if (dmPerUnit && (acc.diamond || 0) < dmPerUnit * qty) { showToast(`❌ Stok DM akun ini tidak cukup! Catat dulu pembelian WDP-nya.`, "error"); return; }
        }
        // Modal Starlight Basic/Premium (Biasa) SELALU otomatis dari rata-rata modal/DM
        // akun ini. Modal jalur Gacha otomatis dari rata-rata modal/item hasil gacha akun
        // ini (dihitung dari DM riil yang abis pas "Catat Gacha", bukan konversi fixed).
        if (dmPerUnit) priceCapital = Math.round((acc.avgDmCost || 0) * dmPerUnit);
        else if (gachaInfo) priceCapital = Math.round(acc[gachaInfo.avgCostField] || 0);
    }

    const rawId = document.getElementById('buyer-id')?.value.trim() || '';
    const zoneId = SERVER_REGIONS[currentProduct]
        ? (document.getElementById('buyer-server-select')?.value || '')
        : (document.getElementById('buyer-zone')?.value.trim() || '');
    // Jika ID kosong, kita beri tanda "-" jadi sistem tidak akan memblokir transaksi
    const finalId = rawId ? (zoneId ? `${rawId} (${zoneId})` : rawId) : "-";
    const targetIDs = [finalId];

    // Item qty manual = 1 transaksi per submit (qty jadi jumlah currency, bukan pengali baris transaksi)
    const loopCount = isManualQty ? 1 : qty;
    const finalSellingPerItem = priceSelling / loopCount;
    const finalDiscountPerItem = priceDiscount / loopCount;

    targetIDs.forEach((finalIdText, idx) => {
        for(let q = 0; q < loopCount; q++) {
            if (needsAccount && status !== 'Booking') {
                if (starlightType === 'Basic') acc.basic--;
                else if (starlightType === 'Premium') acc.premium--;
                else if (gachaInfo) acc[gachaInfo.stockField] = (acc[gachaInfo.stockField] || 0) - 1;
                acc.gift_slots--;
                // Diamond cuma dipotong buat jalur Biasa; jalur Gacha diamond-nya udah
                // dipotong dari awal pas dicatat lewat "Catat Gacha".
                if (dmPerUnit) acc.diamond = (acc.diamond || 0) - dmPerUnit;
            }
            const isStarlightProduct = starlightType === 'Basic' || starlightType === 'Premium' || !!gachaInfo;
                            let estDeliveryDate = purchaseDate;
            if (isStarlightProduct) {
                if (status === 'Booking') {
                    // Jika Booking, tanggal yang diinput langsung jadi target kirim
                    estDeliveryDate = purchaseDate;
                } else {
                    // Jika normal, ikuti aturan +7 Hari
                    let d = new Date(purchaseDate); d.setDate(d.getDate() + 7);
                    estDeliveryDate = d.toISOString().split('T')[0];
                }
            }

                
            state.transactions.push({
                id: "tx_" + (Date.now() + idx + "_" + q), buyerName, buyerId: finalIdText, accountId, accountName: needsAccount ? (acc.ign || acc.username) : '-',
                starlightType, priceCapital, priceSelling: finalSellingPerItem, priceDiscount: finalDiscountPerItem,
                diamondQty: isManualQty ? qty : undefined,
                netProfit: (finalSellingPerItem - finalDiscountPerItem) - priceCapital,
                purchaseDate, estDeliveryDate, status, friendshipChecked: false,
                nicknameHistory: []
            });
        }
    });

    // Modal Starlight Basic/Premium udah otomatis "kepotong" lewat stok DM akun (gak
    // perlu dicatat lagi di Pengeluaran, soalnya duitnya udah tercatat pas beli WDP).
    // Item lain (WDP/Twilight/Diamond/Genshin/Wuthering) modalnya fix per item & belum
    // pernah tercatat sebagai pengeluaran di manapun, jadi otomatis ditambahkan ke sini.
    if (!needsAccount && priceCapital > 0) {
        const totalModal = priceCapital * loopCount;
        state.homeExpenses.unshift({
            id: "hexp_auto_" + Date.now(),
            desc: `[Otomatis] Modal ${starlightType} — ${buyerName}`,
            amount: totalModal,
            date: purchaseDate,
            source: 'auto-modal'
        });
    }

    saveState(); renderAll(); buildCRMList();
    e.target.reset(); 
    if(document.getElementById('chat-parser')) document.getElementById('chat-parser').value = '';
    if(document.getElementById('product-qty')) document.getElementById('product-qty').value = 1;
    updateSalesFormForType();
    showToast(`🚀 ${targetIDs.length * loopCount} Item Sukses Dimasukkan Antrean!`, "success", "terimaKasih");

    // PELINDUNG DATA KOSONG UNTUK NOTIF WHATSAPP
    const textNotif = `*🛒 PESANAN BARU MASUK!*\n\n` +
                      `*Pembeli:* ${buyerName}\n` +
                      `*Item:* ${starlightType}\n` +
                      `*Harga Jual:* Rp ${(priceSelling || 0).toLocaleString('id-ID')}\n` +
                      `*Status:* ${status}\n` +
                      `*Akun Pengirim:* ${acc.ign || acc.username}`;
                               
    sendWhatsappNotification(textNotif);
    sendNativeInstantNotification('🛒 Pesanan Baru Masuk', `${buyerName} — ${starlightType} (Rp ${(priceSelling || 0).toLocaleString('id-ID')})`);
}

function renderLedger() {
    const container = document.getElementById('ledger-list-container'); if(!container) return;
    if(state.ledger.length === 0) { container.innerHTML = maskotEmptyHTML('kosong', 'Belum ada mutasi masuk.'); return;}
    
    // PELINDUNG DATA KOSONG UNTUK LEDGER
    container.innerHTML = state.ledger.map(l => `
        <div class="ledger-row">
            <span><strong>[${l.platform || 'Cash'}]</strong> ${l.desc || 'Tanpa Deskripsi'}</span>
            <span style="color:var(--success-green); font-weight:bold;">+Rp ${(l.amount || 0).toLocaleString('id-ID')}</span>
        </div>
    `).join('');
}

function autoCleanOldTrash() {
    const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
    state.trash = state.trash.filter(t => (parseInt(t.id.split('_')[1]) || Date.now()) > threeDaysAgo);
    saveState();
}

// Catatan: fitur Ekspor/Impor JSON manual sudah dihapus.
// Backup & restore data sekarang HANYA lewat Supabase (lihat pushStateToSupabase
// & pullStateFromSupabase di 03-settings.js), biar gak ada 2 sumber backup
// yang bisa bikin data konflik/bentrok.

function exportDataToCSV() {
    try {
        const headers = ['Tanggal Beli', 'Nama Pembeli', 'ID/Target', 'Item', 'Akun Penjual', 'Harga Jual', 'Diskon', 'Modal', 'Profit Bersih', 'Status', 'Estimasi Kirim'];
        const escapeCsv = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
        const rows = state.transactions.map(t => [
            t.purchaseDate || '', t.buyerName || '', t.buyerId || '', t.starlightType || '',
            t.accountName || '', t.priceSelling || 0, t.priceDiscount || 0, t.priceCapital || 0,
            t.netProfit || 0, t.status || '', t.estDeliveryDate || ''
        ].map(escapeCsv).join(','));

        const csvContent = "\uFEFF" + [headers.map(escapeCsv).join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Rekap_FaustLuna_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link); link.click(); link.remove();
        URL.revokeObjectURL(url);
        showToast('📊 Rekap berhasil diekspor ke CSV/Excel!', 'success');
    } catch (err) {
        console.error(err);
        showToast('❌ Gagal mengekspor ke CSV.', 'error');
    }
}

function renderAccountDropdown() {
    const select = document.getElementById('seller-account'); if(!select) return;
    select.innerHTML = '';
    let sorted = [...state.accounts].sort((a,b) => (b.gift_slots || 0) - (a.gift_slots || 0));
    sorted.forEach(acc => {
        const opt = document.createElement('option'); opt.value = acc.id;
        const isLimited = (acc.gift_slots || 0) <= 0;
        opt.textContent = `${acc.ign || 'No Name'} (${acc.username}) ${isLimited ? '[❌ LIMIT HABIS]' : `[Sisa Slot: ${acc.gift_slots || 0}x]`}`;
        if(isLimited) opt.style.color = 'var(--danger-red)';
        select.appendChild(opt);
    });
    updateAutoCapitalPreview();
}

function renderAccountGrid() {
    const container = document.getElementById('account-premium-grid'); if(!container) return;
    container.innerHTML = '';
    const sortMode = document.getElementById('stok-sort-select')?.value || 'default';
    let accountsToRender = [...state.accounts];
    if (sortMode === 'stok-terendah') {
        accountsToRender.sort((a, b) => ((a.basic || 0) + (a.premium || 0) + (a.basicGacha || 0) + (a.premiumGacha || 0)) - ((b.basic || 0) + (b.premium || 0) + (b.basicGacha || 0) + (b.premiumGacha || 0)));
    } else if (sortMode === 'gift-terendah') {
        accountsToRender.sort((a, b) => (a.gift_slots || 0) - (b.gift_slots || 0));
    }
    accountsToRender.forEach(acc => {
        const card = document.createElement('div'); card.className = `premium-card`;
        
        card.innerHTML = `
            <div class="card-header-title">🛡️ ${acc.ign || 'Tanpa IGN'}</div>
            <div class="invoice-divider"></div>
            <div class="premium-row"><span class="lbl">Username/Email:</span><span class="val highlight privacy-blur">${acc.username || '-'}</span></div>
            <div class="premium-row"><span class="lbl">Password:</span><span class="val highlight privacy-blur" style="font-family: monospace;">${acc.password || '-'}</span></div>
            <div class="premium-row"><span class="lbl">Cara Login:</span><span class="val" style="color:var(--text-gold); font-weight:bold;">${acc.login_method || 'Moonton'}</span></div>
            <div class="invoice-divider" style="margin: 8px 0; border-top: 1px dashed rgba(255,255,255,0.05);"></div>
            <div class="stok-tab-switch" style="display:flex; gap:6px; margin-bottom:8px;">
                <button type="button" id="tab-biasa-${acc.id}" class="stok-tab-btn active" onclick="switchStokTab('${acc.id}','biasa')" style="flex:1; padding:6px; border-radius:8px; border:none; font-size:11px; font-weight:bold; cursor:pointer; background:var(--text-gold); color:#000;">📦 Biasa</button>
                <button type="button" id="tab-gacha-${acc.id}" class="stok-tab-btn" onclick="switchStokTab('${acc.id}','gacha')" style="flex:1; padding:6px; border-radius:8px; border:none; font-size:11px; font-weight:bold; cursor:pointer; background:rgba(255,255,255,0.08); color:var(--text-muted);">🎰 Gacha</button>
            </div>
            <div id="stok-view-biasa-${acc.id}" class="stok-view">
                <div class="premium-row"><span class="lbl">Basic:</span><span class="val highlight">${acc.basic || 0} Pcs</span></div>
                <div class="premium-row"><span class="lbl">Premium:</span><span class="val highlight">${acc.premium || 0} Pcs</span></div>
            </div>
            <div id="stok-view-gacha-${acc.id}" class="stok-view" style="display:none;">
                <div class="premium-row"><span class="lbl">Basic (Gacha):</span><span class="val highlight">${acc.basicGacha || 0} Pcs</span></div>
                <div class="premium-row"><span class="lbl">Premium (Gacha):</span><span class="val highlight">${acc.premiumGacha || 0} Pcs</span></div>
                <div class="premium-row"><span class="lbl">Modal/Item Basic (Gacha):</span><span class="val" style="color:var(--text-gold);">Rp ${Math.round(acc.avgGachaCostBasic || 0).toLocaleString('id-ID')}</span></div>
                <div class="premium-row"><span class="lbl">Modal/Item Premium (Gacha):</span><span class="val" style="color:var(--text-gold);">Rp ${Math.round(acc.avgGachaCostPremium || 0).toLocaleString('id-ID')}</span></div>
            </div>
            <div class="invoice-divider" style="margin: 8px 0; border-top: 1px dashed rgba(255,255,255,0.05);"></div>
            <div class="premium-row"><span class="lbl">Batas Gift:</span><span class="val green-glow">${acc.gift_slots || 0} / 3</span></div>
            <div class="premium-row"><span class="lbl">Diamonds:</span><span class="val">💎 ${acc.diamond || 0}</span></div>
            <div class="premium-row"><span class="lbl">Rata-rata Modal/DM:</span><span class="val" style="color:var(--text-gold);">Rp ${Math.round(acc.avgDmCost || 0).toLocaleString('id-ID')}</span></div>
            <div class="card-action-footer">
                <button class="btn-mini-sec" onclick="openWdpModal('${acc.id}')">💰 Beli WDP</button>
                <button class="btn-mini-sec" onclick="openGachaModal('${acc.id}')">🎰 Catat Gacha</button>
                <button class="btn-mini-sec" onclick="renderWdpHistory('${acc.id}')">🧾 Riwayat</button>
                <button class="btn-mini-sec" onclick="openAccountModal('${acc.id}')">✏️ Edit</button>
                <button class="btn-mini-danger" onclick="deleteAccount('${acc.id}')">🗑️ Hapus</button>
            </div>
        `;
        container.appendChild(card);
    });
}

// Toggle tampilan kartu akun antara "Stok Biasa" dan "Stok Gacha" — cuma satu
// yang kelihatan sekaligus per akun, biar kartu gak kepanjangan.
function switchStokTab(accId, tab) {
    const viewBiasa = document.getElementById(`stok-view-biasa-${accId}`);
    const viewGacha = document.getElementById(`stok-view-gacha-${accId}`);
    const tabBiasa = document.getElementById(`tab-biasa-${accId}`);
    const tabGacha = document.getElementById(`tab-gacha-${accId}`);
    if (!viewBiasa || !viewGacha || !tabBiasa || !tabGacha) return;

    const activeStyle = 'background:var(--text-gold); color:#000;';
    const inactiveStyle = 'background:rgba(255,255,255,0.08); color:var(--text-muted);';
    const baseStyle = 'flex:1; padding:6px; border-radius:8px; border:none; font-size:11px; font-weight:bold; cursor:pointer;';

    if (tab === 'gacha') {
        viewBiasa.style.display = 'none';
        viewGacha.style.display = 'block';
        tabBiasa.style.cssText = baseStyle + inactiveStyle;
        tabGacha.style.cssText = baseStyle + activeStyle;
    } else {
        viewBiasa.style.display = 'block';
        viewGacha.style.display = 'none';
        tabBiasa.style.cssText = baseStyle + activeStyle;
        tabGacha.style.cssText = baseStyle + inactiveStyle;
    }
}

function openAccountModal(id = null) {
    const modal = document.getElementById('account-modal');
    document.getElementById('form-account')?.reset();
    if(id) {
        const acc = state.accounts.find(a => a.id === id);
        if(document.getElementById('account-id-edit')) document.getElementById('account-id-edit').value = acc.id || '';
        if(document.getElementById('acc-ign')) document.getElementById('acc-ign').value = acc.ign || '';
        if(document.getElementById('acc-username')) document.getElementById('acc-username').value = acc.username || '';
        if(document.getElementById('acc-password')) document.getElementById('acc-password').value = acc.password || '';
        if(document.getElementById('acc-login-method')) document.getElementById('acc-login-method').value = acc.login_method || 'Moonton';
        if(document.getElementById('acc-basic')) document.getElementById('acc-basic').value = acc.basic || 0;
        if(document.getElementById('acc-premium')) document.getElementById('acc-premium').value = acc.premium || 0;
        if(document.getElementById('acc-basic-gacha')) document.getElementById('acc-basic-gacha').value = acc.basicGacha || 0;
        if(document.getElementById('acc-premium-gacha')) document.getElementById('acc-premium-gacha').value = acc.premiumGacha || 0;
        if(document.getElementById('acc-gift')) document.getElementById('acc-gift').value = acc.gift_slots || 0;
        if(document.getElementById('acc-dm')) document.getElementById('acc-dm').value = acc.diamond || 0;
    } else { 
        if(document.getElementById('account-id-edit')) document.getElementById('account-id-edit').value = ''; 
    }
    if(modal) modal.classList.add('open');
}

function handleSaveAccount(e) {
    e.preventDefault();
    const id = document.getElementById('account-id-edit')?.value;
    const ign = document.getElementById('acc-ign')?.value || '';
    const username = document.getElementById('acc-username')?.value || '';
    const password = document.getElementById('acc-password')?.value || '';
    const login_method = document.getElementById('acc-login-method')?.value || 'Moonton';
    const basic = parseInt(document.getElementById('acc-basic')?.value || 0);
    const premium = parseInt(document.getElementById('acc-premium')?.value || 0);
    const basicGacha = parseInt(document.getElementById('acc-basic-gacha')?.value || 0);
    const premiumGacha = parseInt(document.getElementById('acc-premium-gacha')?.value || 0);
    const gift_slots = parseInt(document.getElementById('acc-gift')?.value || 0);
    const diamond = parseInt(document.getElementById('acc-dm')?.value || 0);
    
    if(id) {
        const acc = state.accounts.find(a => a.id === id);
        Object.assign(acc, { ign, username, password, login_method, basic, premium, gift_slots, diamond, basicGacha, premiumGacha });
    } else { state.accounts.push({ id: "acc_"+Date.now(), ign, username, password, login_method, basic, premium, gift_slots, diamond, basicGacha, premiumGacha, avgDmCost: 0, avgGachaCostBasic: 0, avgGachaCostPremium: 0 }); }
    saveState(); document.getElementById('account-modal')?.classList.remove('open'); renderAll(); showToast("✅ Akun kasir disimpan!", "success");
}

