// ============================================================
// NOTIFIKASI NATIVE (CAPACITOR LOCAL NOTIFICATIONS)
// Notifikasi ini muncul di status bar Android seperti WA, dan TETAP jalan
// walau aplikasi FaustLuna Store sudah ditutup/di-kill dari recent apps —
// beda dengan notifikasi browser biasa (Notification API) yang cuma jalan
// selama aplikasinya masih kebuka.
//
// Cuma aktif kalau aplikasi ini dijalankan sebagai APK Android (dibungkus
// Capacitor). Kalau dibuka lewat browser/PWA biasa, semua fungsi di sini
// otomatis gak ngapa-ngapain (fallback ke notifikasi browser yang sudah ada).
// ============================================================

function isNativeApp() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

function getLocalNotifPlugin() {
    if (!isNativeApp()) return null;
    return (window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) || null;
}

async function requestNativeNotifPermission() {
    const plugin = getLocalNotifPlugin();
    if (!plugin) return false;
    try {
        const current = await plugin.checkPermissions();
        if (current.display === 'granted') return true;
        const req = await plugin.requestPermissions();
        return req.display === 'granted';
    } catch (err) {
        console.error('Gagal minta izin notifikasi native:', err);
        return false;
    }
}

async function cancelAllNativeReminders() {
    const plugin = getLocalNotifPlugin();
    if (!plugin) return;
    try {
        const pending = await plugin.getPending();
        if (pending.notifications.length > 0) {
            await plugin.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) });
        }
    } catch (err) { console.error('Gagal membatalkan notifikasi native lama:', err); }
}

// Kirim SATU notifikasi native langsung/instan (bukan dijadwalkan ke masa depan
// kayak reminder H-N) — dipakai buat event yang terjadi sekarang juga: pesanan
// baru masuk, atau pengiriman sukses. ID-nya dibikin unik pakai timestamp biar
// gak bentrok/ketimpa sama notifikasi reminder yang lain.
async function sendNativeInstantNotification(title, body) {
    const plugin = getLocalNotifPlugin();
    if (!plugin) return;
    const granted = await requestNativeNotifPermission();
    if (!granted) return;
    try {
        await plugin.schedule({
            notifications: [{
                id: Math.floor(Date.now() % 2147483647),
                title,
                body,
                schedule: { at: new Date(Date.now() + 1000) }
            }]
        });
    } catch (err) { console.error('Gagal kirim notifikasi native instan:', err); }
}
// data transaksi & akun TERKINI. Dipanggil ulang tiap ada perubahan data (renderAll)
// supaya jadwalnya selalu sinkron — notifikasi lama otomatis dibatalkan & diganti baru.
async function scheduleNativeReminders() {
    if (!state.settings.h1NotifEnabled) return; // hormati saklar "Aktifkan pengingat H-1 di HP" yang sudah ada
    const plugin = getLocalNotifPlugin();
    if (!plugin) return;

    const granted = await requestNativeNotifPermission();
    if (!granted) return;

    await cancelAllNativeReminders();

    const now = new Date();
    const notifications = [];
    let idCounter = 1;

    getAllActiveDeliverableTx().forEach(t => {
        if (!t.estDeliveryDate) return;
        const deliveryDate = new Date(`${t.estDeliveryDate}T09:00:00`);
        const h1Date = new Date(deliveryDate);
        h1Date.setDate(h1Date.getDate() - 1);

        if (h1Date > now) {
            notifications.push({
                id: idCounter++,
                title: '🌙 FaustLuna Store',
                body: `Besok jatuh tempo kirim: ${t.buyerName || 'Tanpa Nama'} (${t.starlightType || '-'})`,
                schedule: { at: h1Date },
            });
        }
        if (deliveryDate > now) {
            notifications.push({
                id: idCounter++,
                title: '🌙 FaustLuna Store',
                body: `HARI INI jatuh tempo kirim: ${t.buyerName || 'Tanpa Nama'} (${t.starlightType || '-'})`,
                schedule: { at: deliveryDate },
            });
        }
    });

    if (notifications.length > 0) {
        try {
            await plugin.schedule({ notifications });
        } catch (err) { console.error('Gagal menjadwalkan notifikasi native:', err); }
    }
}
