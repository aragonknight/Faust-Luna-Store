// ==========================================================================
// LOGIN & SINKRONISASI OTOMATIS PER AKUN
// ==========================================================================
// Sebelumnya app ini "1 toko, 1 data lokal" — sekarang tiap orang login
// pakai akun Supabase-nya sendiri (dibikinkan manual lewat dashboard
// Supabase, bukan daftar sendiri di app ini), dan datanya otomatis
// kepisah total per akun karena baris di tabel faustluna_backup dikunci
// pakai ID akun (auth.uid()) masing-masing, bukan "main" kayak dulu.
//
// Alur singkatnya:
// 1. App baru dibuka -> initAuthGate() ngecek ada sesi login tersimpan atau
//    enggak (Supabase otomatis simpan sesi di localStorage sendiri).
// 2. Ada sesi -> langsung tarik data akun itu dari Supabase, baru masuk app.
// 3. Gak ada sesi -> munculin form login di landing page, tunggu submit.
// 4. Abis itu, TIAP kali saveState() kepanggil di manapun di kode, otomatis
//    ke-push juga ke Supabase beberapa detik kemudian (didebounce, biar gak
//    spam request tiap ketikan) -- makanya gak perlu klik "Backup" manual
//    lagi (tombolnya tetap ada buat jaga-jaga/testing).

let currentAuthUser = null; // { id, email } -- null kalau belum login
let autoSyncTimer = null;

function getAuthClient() {
    // Sengaja pisah dari getSupabaseClient() punya 03-settings.js karena itu
    // butuh state.settings udah ke-load duluan. Login-nya sendiri harus bisa
    // jalan SEBELUM state penuh ke-load, jadi langsung pakai default config.
    if (!window.supabase || !window.supabase.createClient) return null;
    if (!window._flAuthClient) {
        window._flAuthClient = window.supabase.createClient(DEFAULT_CONFIG.supabaseUrl, DEFAULT_CONFIG.supabaseKey);
    }
    return window._flAuthClient;
}

async function initAuthGate() {
    const client = getAuthClient();
    const form = document.getElementById('form-landing-login');
    const loadingEl = document.getElementById('landing-loading');

    // Isi otomatis email & password dari login terakhir yang berhasil (kalau
    // ada) -- sengaja TETAP nampilin form-nya (bukan langsung nyelonong masuk),
    // biar user masih lihat "login sebagai siapa" dan tinggal tap tombol sekali,
    // gak perlu ngetik ulang.
    const savedEmail = localStorage.getItem('fl_saved_email');
    const savedPassword = localStorage.getItem('fl_saved_password');
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    if (savedEmail && emailInput) emailInput.value = savedEmail;
    if (savedPassword && passwordInput) passwordInput.value = savedPassword;

    if (!client) {
        // Supabase gagal dimuat (misal gak ada internet) -- daripada nge-block
        // total, tetap izinkan masuk pakai data lokal yang ada di HP.
        if (form) form.classList.add('hidden');
        return;
    }
    // Sengaja TIDAK auto-masuk walau sesi tersimpan masih valid -- form dibiarkan
    // tampil (sudah keisi otomatis di atas), tinggal nunggu user tap tombol
    // "Masuk ke Toko", yang bakal diproses seperti biasa oleh handleLoginSubmit().
}

async function handleLoginSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('login-email')?.value.trim();
    const password = document.getElementById('login-password')?.value;
    const errEl = document.getElementById('login-error');
    const form = document.getElementById('form-landing-login');
    const loadingEl = document.getElementById('landing-loading');
    if (errEl) errEl.classList.add('hidden');

    const client = getAuthClient();
    if (!client) { if (errEl) { errEl.textContent = 'Gagal terhubung ke server login. Cek internet.'; errEl.classList.remove('hidden'); } return; }

    const submitBtn = document.getElementById('btn-enter-app');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Memeriksa...'; }

    const { data, error } = await client.auth.signInWithPassword({ email, password });

    if (error) {
        if (errEl) { errEl.textContent = '❌ Email atau password salah.'; errEl.classList.remove('hidden'); }
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '🚀 Masuk ke Toko'; }
        return;
    }

    // Simpan biar form login lain kali (buka app lagi) sudah keisi otomatis --
    // catatan: ini kesimpen apa adanya di localStorage HP, bukan dienkripsi.
    localStorage.setItem('fl_saved_email', email);
    localStorage.setItem('fl_saved_password', password);

    currentAuthUser = { id: data.user.id, email: data.user.email };
    await enterAppAfterLogin(loadingEl, form);
}

// Dipanggil abis login sukses (baik dari sesi tersimpan maupun submit manual):
// tarik data akun ini dari Supabase (kalau ada), baru tampilkan halaman utama.
async function enterAppAfterLogin(loadingEl, form) {
    if (form) form.classList.add('hidden');
    if (loadingEl) loadingEl.classList.remove('hidden');

    await pullStateForCurrentUser();

    if (loadingEl) loadingEl.classList.add('hidden');

    const landing = document.getElementById('landing-page');
    if (landing) {
        playSound('click');
        landing.classList.add('hide');
        initMascot();
    }
    renderAll(); renderHomeKeuangan(); buildCRMList();
    const emailLabel = document.getElementById('active-account-email');
    if (emailLabel) emailLabel.textContent = currentAuthUser?.email || '-';
}

// Versi silent dari pullStateFromSupabase (tanpa dialog konfirmasi timpa data,
// karena ini dipanggil otomatis pas login, bukan aksi manual user) -- pakai ID
// user yang login sebagai kunci baris, BUKAN "main" seperti versi lama.
async function pullStateForCurrentUser() {
    const client = getAuthClient();
    if (!client || !currentAuthUser) return;
    try {
        const { data, error } = await client.from('faustluna_backup').select('*').eq('id', currentAuthUser.id).single();
        if (error || !data || !data.data) return; // akun baru, belum ada data tersimpan -- biarin state default kosong
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
        saveStateLocal();
        initTheme();
    } catch (err) {
        console.error('Gagal tarik data akun saat login:', err);
    }
}

// Push otomatis ke baris milik user yang lagi login. Didebounce 3 detik biar
// gak nembak request tiap perubahan kecil (misal ketik di form input).
function scheduleAutoSync() {
    if (!currentAuthUser) return; // belum login (atau Supabase gagal dimuat) -- skip
    clearTimeout(autoSyncTimer);
    autoSyncTimer = setTimeout(pushStateForCurrentUser, 3000);
}

async function pushStateForCurrentUser() {
    const client = getAuthClient();
    if (!client || !currentAuthUser) return;
    const payload = {
        transactions: state.transactions, accounts: state.accounts, trash: state.trash, archivedTx: state.archivedTx,
        theme: state.theme, ledger: state.ledger, pengeluaran: state.pengeluaran,
        homeExpenses: state.homeExpenses, capitalPrices: state.capitalPrices,
        wdpPurchases: state.wdpPurchases, gachaLogs: state.gachaLogs, logs: state.logs,
        privacyMode: state.privacyMode, financeAdjustment: state.financeAdjustment
    };
    try {
        await client.from('faustluna_backup').upsert({
            id: currentAuthUser.id, data: payload, updated_at: new Date().toISOString()
        });
        const statusEl = document.getElementById('supabase-sync-status');
        if (statusEl) statusEl.textContent = `☁️ Tersinkron otomatis: ${new Date().toLocaleTimeString('id-ID')}`;
    } catch (err) {
        console.error('Auto-sync gagal:', err);
    }
}

async function handleLogout() {
    const client = getAuthClient();
    if (client) { try { await client.auth.signOut(); } catch (err) { console.error(err); } }
    currentAuthUser = null;
    localStorage.removeItem('fl_saved_email');
    localStorage.removeItem('fl_saved_password');
    // Reload total biar semua state kebersih-in dan balik ke layar login dari nol.
    window.location.reload();
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('form-landing-login')?.addEventListener('submit', handleLoginSubmit);
    document.getElementById('btn-logout')?.addEventListener('click', () => {
        showConfirm('Yakin mau keluar? Kamu perlu login lagi buat masuk ke toko.', handleLogout);
    });
    initAuthGate();
});
