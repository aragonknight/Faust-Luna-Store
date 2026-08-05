// ============================================================
// HALAMAN PENGATURAN: WhatsApp & Supabase
// (bagian dari script.js asli - FaustLuna Store)
// ============================================================
// --- HALAMAN PENGATURAN --- //
function renderSettingsForm() {
    if(document.getElementById('set-wa-hmin')) document.getElementById('set-wa-hmin').value = state.settings.waHmin || 2;
    if(document.getElementById('set-h1-notif-enabled')) document.getElementById('set-h1-notif-enabled').checked = !!state.settings.h1NotifEnabled;
    if(document.getElementById('set-supabase-url')) document.getElementById('set-supabase-url').value = state.settings.supabaseUrl || '';
    if(document.getElementById('set-supabase-key')) document.getElementById('set-supabase-key').value = state.settings.supabaseKey || '';
}

// Dipanggil begitu dropdown H-min diganti — langsung simpan tanpa perlu tombol submit
// terpisah, karena kartu WhatsApp (yang dulu punya tombol simpan sendiri) sudah dihapus.
function handleChangeHmin(e) {
    state.settings.waHmin = parseInt(e.target.value) || 2;
    saveState();
    showToast('⚙️ Pengaturan pengingat disimpan!', 'success');
    if (isNativeApp() && state.settings.h1NotifEnabled) scheduleNativeReminders();
}

function handleToggleH1Notif(e) {
    const enabled = e.target.checked;
    if (enabled) {
        if (isNativeApp()) {
            requestNativeNotifPermission().then(granted => {
                if (!granted) {
                    e.target.checked = false;
                    showToast('❌ Izin notifikasi ditolak. Aktifkan manual di Pengaturan HP > Aplikasi > FaustLuna > Izin > Notifikasi.', 'error');
                    return;
                }
                state.settings.h1NotifEnabled = true;
                saveState();
                showToast('🔔 Pengingat H-1 di HP diaktifkan!', 'success');
                scheduleNativeReminders();
            });
            return;
        }
        if (!('Notification' in window) || Notification.permission !== 'granted') {
            if ('Notification' in window) {
                Notification.requestPermission().then(perm => {
                    if (perm !== 'granted') {
                        e.target.checked = false;
                        showToast('❌ Izin notifikasi browser ditolak.', 'error');
                        return;
                    }
                    state.settings.h1NotifEnabled = true;
                    saveState();
                    showToast('🔔 Pengingat H-1 di HP diaktifkan!', 'success');
                });
                return;
            }
        }
    } else if (isNativeApp()) {
        cancelAllNativeReminders();
    }
    state.settings.h1NotifEnabled = enabled;
    saveState();
    showToast(enabled ? '🔔 Pengingat H-1 di HP diaktifkan!' : 'Pengingat H-1 di HP dimatikan', 'success');
}

function handleSaveSupabaseSettings(e) {
    e.preventDefault();
    state.settings.supabaseUrl = document.getElementById('set-supabase-url')?.value.trim() || '';
    state.settings.supabaseKey = document.getElementById('set-supabase-key')?.value.trim() || '';
    supabaseClient = null; // reset supaya dibuat ulang dengan config baru
    saveState();
    showToast('☁️ Pengaturan Supabase disimpan!', 'success');
}

function getSupabaseClient() {
    if (!state.settings.supabaseUrl || !state.settings.supabaseKey) return null;
    if (!window.supabase || !window.supabase.createClient) {
        showToast('❌ Library Supabase gagal dimuat (cek koneksi internet).', 'error');
        return null;
    }
    if (!supabaseClient) {
        supabaseClient = window.supabase.createClient(state.settings.supabaseUrl, state.settings.supabaseKey);
    }
    return supabaseClient;
}

async function pushStateToSupabase() {
    const client = getSupabaseClient();
    const statusEl = document.getElementById('supabase-sync-status');
    if (!client) { showToast('❌ Isi dulu Project URL & Anon Key Supabase di atas.', 'error'); return; }

    const payload = {
        transactions: state.transactions, accounts: state.accounts, trash: state.trash, archivedTx: state.archivedTx,
        theme: state.theme, ledger: state.ledger, pengeluaran: state.pengeluaran,
        homeExpenses: state.homeExpenses, capitalPrices: state.capitalPrices,
        wdpPurchases: state.wdpPurchases, gachaLogs: state.gachaLogs, logs: state.logs,
        privacyMode: state.privacyMode, financeAdjustment: state.financeAdjustment
    };

    // Kalau lagi login, data disimpan di baris milik akun itu (kepisah per
    // akun). Kalau belum login (misal Supabase gagal dimuat), fallback ke
    // baris "main" lama biar tombol manual ini tetap bisa dipakai.
    const rowId = (typeof currentAuthUser !== 'undefined' && currentAuthUser) ? currentAuthUser.id : 'main';

    try {
        const { error } = await client.from('faustluna_backup').upsert({
            id: rowId, data: payload, updated_at: new Date().toISOString()
        });
        if (error) throw error;
        showToast('☁️ Backup ke Supabase berhasil!', 'success');
        if (statusEl) statusEl.textContent = `Terakhir backup: ${new Date().toLocaleString('id-ID')}`;
    } catch (err) {
        console.error('Supabase push error:', err);
        showToast('❌ Gagal backup ke Supabase. Cek URL/Key & tabelnya.', 'error');
    }
}

async function pullStateFromSupabase() {
    const client = getSupabaseClient();
    if (!client) { showToast('❌ Isi dulu Project URL & Anon Key Supabase di atas.', 'error'); return; }

    const rowId = (typeof currentAuthUser !== 'undefined' && currentAuthUser) ? currentAuthUser.id : 'main';

    try {
        const { data, error } = await client.from('faustluna_backup').select('*').eq('id', rowId).single();
        if (error) throw error;
        if (!data || !data.data) { showToast('⚠️ Belum ada data backup di Supabase.', 'error'); return; }

        showConfirm('PERINGATAN! Data dari Supabase akan menimpa data di perangkat ini. Tetap lanjutkan?', () => {
            const cloud = data.data;
            state.transactions = cloud.transactions || [];
            state.accounts = cloud.accounts || [];
            state.trash = cloud.trash || [];
            state.archivedTx = cloud.archivedTx || [];
            state.ledger = cloud.ledger || [];
            state.pengeluaran = cloud.pengeluaran || [];
            state.homeExpenses = cloud.homeExpenses || [];
            state.capitalPrices = cloud.capitalPrices || state.capitalPrices;
            state.wdpPurchases = cloud.wdpPurchases || [];
            state.gachaLogs = cloud.gachaLogs || [];
            state.logs = cloud.logs || [];
            state.privacyMode = cloud.privacyMode || false;
            state.financeAdjustment = cloud.financeAdjustment || { pemasukan: 0, saldo: 0 };
            if (cloud.theme) state.theme = cloud.theme;
            saveState(); initTheme(); renderAll(); renderHomeKeuangan(); buildCRMList();
            showToast('✅ Data berhasil ditarik dari Supabase!', 'success', 'yeay');
            const statusEl = document.getElementById('supabase-sync-status');
            if (statusEl) statusEl.textContent = `Terakhir tarik data: ${new Date().toLocaleString('id-ID')}`;
        });
    } catch (err) {
        console.error('Supabase pull error:', err);
        showToast('❌ Gagal mengambil data dari Supabase.', 'error');
    }
}

