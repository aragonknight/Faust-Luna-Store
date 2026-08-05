// ============================================================
// PENGELUARAN & LAPORAN KEUANGAN HOME
// (bagian dari script.js asli - FaustLuna Store)
// ============================================================
// --- LOGIKA PENGELUARAN & LAPORAN KEUANGAN --- //
document.getElementById('form-pengeluaran')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const desc = document.getElementById('pengeluaran-desc').value;
    const amount = parseFloat(document.getElementById('pengeluaran-amount').value);
    const date = document.getElementById('pengeluaran-date').value;
    
    state.pengeluaran.unshift({ id: "exp_"+Date.now(), desc, amount, date, product: currentProduct });
    saveState();
    e.target.reset();
    document.getElementById('pengeluaran-date').value = new Date().toISOString().split('T')[0]; 
    
    showToast("💸 Pengeluaran berhasil disimpan!", "success");
    renderPengeluaran();
});

function renderPengeluaran() {
    const listEl = document.getElementById('pengeluaran-list');
    const myExpenses = productPengeluaran();
    if (listEl) {
        if (myExpenses.length === 0) {
            listEl.innerHTML = maskotEmptyHTML('kosong', 'Belum ada data pengeluaran.');
        } else {
            listEl.innerHTML = myExpenses.map(p => `
                <div class="agenda-item" style="justify-content: space-between; align-items: center; display: flex; padding: 10px; border-bottom: 1px solid var(--accent-alpha);">
                    <div>
                        <div style="font-weight:bold; font-size: 13px;">${p.desc}</div>
                        <div style="font-size:10px; color:var(--text-muted);">${p.date}</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="color:var(--danger-red); font-weight:bold; font-size: 13px;">- Rp ${p.amount.toLocaleString('id-ID')}</div>
                        <button class="btn-mini-danger" onclick="deletePengeluaran('${p.id}')">Hapus</button>
                    </div>
                </div>
            `).join('');
        }
    }

    let totalPemasukan = 0;
    let totalProfitKotor = 0; 
    
    const transaksiSelesai = productTx().filter(t => t.status === 'Sudah Dikirim');
    
    transaksiSelesai.forEach(t => {
        const gross = (parseFloat(t.priceSelling) || 0) - (parseFloat(t.priceDiscount) || 0);
        totalPemasukan += gross;
        totalProfitKotor += (parseFloat(t.netProfit) || 0);
    });

    // Tambahin transaksi selesai yang UDAH DIHAPUS tapi diarsipkan (lihat
    // state.archivedTx) — angkanya tetap kehitung walau kartunya udah gak ada.
    const archived = getArchivedTotals(currentProduct);
    totalPemasukan += archived.omset;
    totalProfitKotor += archived.profit;

    const totalPengeluaran = myExpenses.reduce((sum, p) => sum + (p.amount || 0), 0);
    const keuntunganBersih = totalProfitKotor - totalPengeluaran;

    if(document.getElementById('laporan-pemasukan')) document.getElementById('laporan-pemasukan').textContent = `Rp ${totalPemasukan.toLocaleString('id-ID')}`;
    if(document.getElementById('laporan-pengeluaran')) document.getElementById('laporan-pengeluaran').textContent = `Rp ${totalPengeluaran.toLocaleString('id-ID')}`;
    
    const profitEl = document.getElementById('laporan-keuntungan');
    if(profitEl) {
        profitEl.textContent = `Rp ${keuntunganBersih.toLocaleString('id-ID')}`;
        profitEl.style.color = keuntunganBersih >= 0 ? "var(--success-green)" : "var(--danger-red)";
    }
}

function deletePengeluaran(id) {
    showConfirm("Hapus data pengeluaran ini?", () => {
        state.pengeluaran = state.pengeluaran.filter(p => p.id !== id);
        saveState();
        renderPengeluaran();
        showToast("Pengeluaran dihapus", "success");
    });
}

// --- CATATAN KEUANGAN GABUNGAN (HOME) --- //
function handleAddHomeExpense(e) {
    e.preventDefault();
    const desc = document.getElementById('home-peng-desc')?.value || '';
    const amount = parseFloat(document.getElementById('home-peng-amount')?.value || 0);
    const date = document.getElementById('home-peng-date')?.value || new Date().toISOString().split('T')[0];

    state.homeExpenses.unshift({ id: "hexp_" + Date.now(), desc, amount, date });
    saveState();
    e.target.reset();
    document.getElementById('home-peng-date').value = new Date().toISOString().split('T')[0];

    showToast("💸 Pengeluaran berhasil dicatat!", "success");
    renderHomeKeuangan();
}

function deleteHomeExpense(id) {
    showConfirm("Hapus data pengeluaran ini?", () => {
        state.homeExpenses = state.homeExpenses.filter(p => p.id !== id);
        saveState();
        renderHomeKeuangan();
        showToast("Pengeluaran dihapus", "success");
    });
}

function renderHomeCombinedSummary() {
    const container = document.getElementById('home-combined-summary');
    if (!container) return;

    let grandOmset = 0, grandProfit = 0;
    const rowsHtml = Object.keys(PRODUCT_CONFIG).map(key => {
        const cfg = PRODUCT_CONFIG[key];
        const txs = state.transactions.filter(t => TYPE_TO_PRODUCT[t.starlightType] === key);
        let omset = 0, profit = 0;
        txs.forEach(t => {
            omset += (parseFloat(t.priceSelling) || 0) - (parseFloat(t.priceDiscount) || 0);
            profit += (parseFloat(t.netProfit) || 0);
        });
        grandOmset += omset; grandProfit += profit;
        const archived = getArchivedTotals(key);
        omset += archived.omset; profit += archived.profit;
        grandOmset += archived.omset; grandProfit += archived.profit;
        return `
            <div class="premium-row">
                <span class="lbl">${cfg.icon} ${cfg.label}</span>
                <span class="val">Omset: Rp ${(omset || 0).toLocaleString('id-ID')} <span class="privacy-hide" style="color:var(--success-green); margin-left:6px;">(Profit: Rp ${(profit || 0).toLocaleString('id-ID')})</span></span>
            </div>`;
    }).join('');

    container.innerHTML = rowsHtml;
    if (document.getElementById('combined-total-omset')) document.getElementById('combined-total-omset').textContent = `Rp ${(grandOmset || 0).toLocaleString('id-ID')}`;
    if (document.getElementById('combined-total-profit')) document.getElementById('combined-total-profit').textContent = `Rp ${(grandProfit || 0).toLocaleString('id-ID')}`;
    initPrivacy();
}

function renderHomeKeuangan() {
    renderHomeCombinedSummary();
    const listEl = document.getElementById('home-pengeluaran-list');
    if (listEl) {
        if (state.homeExpenses.length === 0) {
            listEl.innerHTML = maskotEmptyHTML('kosong', 'Belum ada pengeluaran dicatat.');
        } else {
            listEl.innerHTML = state.homeExpenses.map(p => `
                <div class="agenda-item" style="justify-content: space-between; align-items: center; display: flex; padding: 10px; border-bottom: 1px solid var(--accent-alpha);">
                    <div>
                        <div style="font-weight:bold; font-size: 13px;">${p.desc} ${p.source ? '<span style="font-size:9px; font-weight:normal; color:var(--text-gold); border:1px solid var(--text-gold); border-radius:4px; padding:1px 4px; margin-left:4px;">OTOMATIS</span>' : ''}</div>
                        <div style="font-size:10px; color:var(--text-muted);">${p.date}</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="color:var(--danger-red); font-weight:bold; font-size: 13px;">- Rp ${(p.amount||0).toLocaleString('id-ID')}</div>
                        <button class="btn-mini-danger" onclick="deleteHomeExpense('${p.id}')">Hapus</button>
                    </div>
                </div>
            `).join('');
        }
    }

    const autoPemasukan = state.transactions.reduce((sum, t) => sum + ((parseFloat(t.priceSelling) || 0) - (parseFloat(t.priceDiscount) || 0)), 0) + getArchivedTotals().omset;
    const totalPengeluaran = state.homeExpenses.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const totalPemasukan = autoPemasukan + (state.financeAdjustment.pemasukan || 0);
    const saldo = (totalPemasukan - totalPengeluaran) + (state.financeAdjustment.saldo || 0);

    if (document.getElementById('keuangan-pemasukan')) document.getElementById('keuangan-pemasukan').textContent = `Rp ${totalPemasukan.toLocaleString('id-ID')}`;
    if (document.getElementById('keuangan-pengeluaran')) document.getElementById('keuangan-pengeluaran').textContent = `Rp ${totalPengeluaran.toLocaleString('id-ID')}`;
    const saldoEl = document.getElementById('keuangan-saldo');
    if (saldoEl) {
        saldoEl.textContent = `Rp ${saldo.toLocaleString('id-ID')}`;
        saldoEl.style.color = saldo >= 0 ? "#060b14" : "var(--danger-red)";
    }
}
