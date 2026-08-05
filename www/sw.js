const CACHE_NAME = 'faustluna-store-v10.0';
const ASSETS = [
    './',
    './index.html',
    './css/base-theme.css',
    './css/navbar-widgets.css',
    './css/layout-components.css',
    './css/mascot-landing.css',
    './js/01-config.js',
    './js/02-ui-core.js',
    './js/03-settings.js',
    './js/04-dashboard-transaksi.js',
    './js/05-wdp-pembeli.js',
    './js/06-notif-search-reminder.js',
    './js/07-keuangan-laporan.js',
    './js/08-native-notif.js',
    './js/09-native-enhancements.js',
    './manifest.json',
    './logo.png',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-512-maskable.png',
    './assets/maskot/luna-hai.jpg',
    './assets/maskot/luna-selamat-datang.jpg',
    './assets/maskot/luna-berhasil.jpg',
    './assets/maskot/luna-data-kosong.jpg',
    './assets/maskot/luna-recycle-bin.jpg',
    './assets/maskot/luna-pengingat.jpg',
    './assets/maskot/luna-terima-kasih.jpg',
    './assets/maskot/luna-senang.jpg',
    './assets/maskot/luna-yeay.jpg',
    './assets/maskot/luna-hmm.jpg',
    './assets/maskot/luna-baca-buku.jpg',
    './assets/maskot/luna-tongkat.jpg',
    './assets/maskot/luna-peluk-bintang.jpg'
];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', e => {
    e.respondWith(
        fetch(e.request).catch(() => caches.match(e.request))
    );
});
