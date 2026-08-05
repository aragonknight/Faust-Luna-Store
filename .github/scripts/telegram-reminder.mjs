// ============================================================
// CRON REMINDER TELEGRAM (jalan via GitHub Actions terjadwal)
// Baca data transaksi dari Supabase, kirim reminder H-N pengiriman ke
// Telegram TANPA butuh aplikasi FaustLuna Store dibuka atau HP nyala.
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const HMIN = parseInt(process.env.TELEGRAM_HMIN || '2');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('❌ Ada secret yang belum diisi (SUPABASE_URL / SUPABASE_ANON_KEY / TELEGRAM_TOKEN / TELEGRAM_CHAT_ID).');
    process.exit(1);
}

const sbHeaders = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json'
};

// Tanggal hari ini menurut kalender WIB (Asia/Jakarta), bukan UTC server GitHub Actions
function todayJakartaStr() {
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' });
    return fmt.format(new Date()); // YYYY-MM-DD
}

function daysRemaining(dateStr, todayStr) {
    const target = new Date(`${dateStr}T00:00:00Z`);
    const today = new Date(`${todayStr}T00:00:00Z`);
    return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

async function main() {
    // 1) Ambil data backup transaksi dari Supabase
    const backupRes = await fetch(`${SUPABASE_URL}/rest/v1/faustluna_backup?id=eq.main&select=data`, { headers: sbHeaders });
    if (!backupRes.ok) {
        console.error('❌ Gagal ambil data faustluna_backup:', await backupRes.text());
        process.exit(1);
    }
    const backupRows = await backupRes.json();
    if (!backupRows.length) {
        console.log('⚠️ Belum ada data backup di Supabase, skip.');
        return;
    }
    const transactions = backupRows[0].data?.transactions || [];

    // 2) Ambil daftar transaksi yang SUDAH pernah dinotif sebelumnya
    const notifiedRes = await fetch(`${SUPABASE_URL}/rest/v1/faustluna_telegram_notified?select=tx_id`, { headers: sbHeaders });
    if (!notifiedRes.ok) {
        console.error('❌ Gagal ambil data faustluna_telegram_notified:', await notifiedRes.text());
        process.exit(1);
    }
    const notifiedIds = new Set((await notifiedRes.json()).map(r => r.tx_id));

    const todayStr = todayJakartaStr();
    const dueList = transactions.filter(t => {
        if (t.status === 'Sudah Dikirim' || !t.estDeliveryDate) return false;
        if (notifiedIds.has(t.id)) return false;
        return daysRemaining(t.estDeliveryDate, todayStr) <= HMIN;
    });

    if (dueList.length === 0) {
        console.log('✅ Tidak ada reminder baru yang perlu dikirim hari ini.');
        return;
    }

    for (const t of dueList) {
        const daysLeft = daysRemaining(t.estDeliveryDate, todayStr);
        const label = daysLeft < 0 ? `TELAT ${Math.abs(daysLeft)} hari` : (daysLeft === 0 ? 'HARI INI' : `H-${daysLeft}`);
        const text = `<b>⏰ PENGINGAT ${label} PENGIRIMAN!</b>\n\n` +
            `<b>Pembeli:</b> ${t.buyerName || '-'}\n` +
            `<b>Item:</b> ${t.starlightType || '-'}\n` +
            `<b>Estimasi Kirim:</b> ${t.estDeliveryDate}\n` +
            `<b>Status:</b> ${t.status}\n\n` +
            `Dikirim otomatis oleh cron — gak butuh app dibuka! 🌙`;

        const tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'HTML' })
        });

        if (!tgRes.ok) {
            console.error(`❌ Gagal kirim Telegram untuk transaksi ${t.id}:`, await tgRes.text());
            continue; // jangan ditandai notified kalau gagal kirim, biar dicoba lagi run berikutnya
        }

        // Tandai sudah dinotif biar gak dikirim ulang di run berikutnya
        const markRes = await fetch(`${SUPABASE_URL}/rest/v1/faustluna_telegram_notified`, {
            method: 'POST',
            headers: { ...sbHeaders, Prefer: 'resolution=merge-duplicates' },
            body: JSON.stringify({ tx_id: t.id, notified_at: new Date().toISOString() })
        });
        if (!markRes.ok) {
            console.error(`⚠️ Terkirim ke Telegram tapi gagal tandai notified untuk ${t.id}:`, await markRes.text());
        } else {
            console.log(`✅ Reminder terkirim untuk: ${t.buyerName || t.id}`);
        }
    }
}

main().catch(err => {
    console.error('❌ Error tak terduga:', err);
    process.exit(1);
});
