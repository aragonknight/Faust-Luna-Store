// ============================================================
// FITUR NATIVE TAMBAHAN — biar app kerasa kayak app asli
// (splash screen, status bar, haptic, tombol back Android,
//  pull-to-refresh, offline detection, skeleton loading)
// ============================================================

(function () {
    // Plugin Capacitor cuma aktif kalau app jalan di dalam wrapper native
    // (bukan dibuka lewat browser biasa), jadi semua dicek aman dulu.
    const Cap = window.Capacitor;
    const isNative = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());

    // ---------- 1. SPLASH SCREEN ----------
    // launchAutoHide di-set false di config, jadi splash sengaja ditahan
    // manual di sini sampai app beneran siap (data awal kebaca dll),
    // biar gak ada "kedip" blank putih sebelum splash muncul.
    async function hideSplashWhenReady() {
        if (!isNative || !Cap.Plugins?.SplashScreen) return;
        try {
            // kasih jeda dikit biar transisi splash->app halus, bukan getok kasar
            await new Promise(r => setTimeout(r, 400));
            await Cap.Plugins.SplashScreen.hide();
        } catch (err) {
            console.warn('SplashScreen hide gagal (mungkin lagi di browser):', err);
        }
    }

    // ---------- 2. STATUS BAR THEMING ----------
    async function setupStatusBar() {
        if (!isNative || !Cap.Plugins?.StatusBar) return;
        try {
            await Cap.Plugins.StatusBar.setOverlaysWebView({ overlay: false });
            await Cap.Plugins.StatusBar.setBackgroundColor({ color: '#0a0f1d' });
            await Cap.Plugins.StatusBar.setStyle({ style: 'DARK' }); // ikon status bar putih, cocok buat bg gelap
        } catch (err) {
            console.warn('StatusBar setup gagal:', err);
        }
    }

    // ---------- 3. HAPTIC FEEDBACK ----------
    // window.flHaptic('light'|'medium'|'heavy'|'success'|'warning'|'error')
    // dipanggil dari kode lain kamu di titik-titik penting (simpan transaksi,
    // hapus data, dll), dan otomatis nempel ke semua tombol utama di bawah.
    window.flHaptic = async function (type = 'light') {
        if (!isNative || !Cap.Plugins?.Haptics) return;
        const H = Cap.Plugins.Haptics;
        try {
            if (type === 'success' || type === 'warning' || type === 'error') {
                await H.notification({ type: type.toUpperCase() });
            } else {
                const styleMap = { light: 'LIGHT', medium: 'MEDIUM', heavy: 'HEAVY' };
                await H.impact({ style: styleMap[type] || 'LIGHT' });
            }
        } catch (err) {
            // diam aja, haptic bukan fitur kritis
        }
    };

    // Getar halus otomatis tiap tap tombol/menu-item/aksi utama,
    // tanpa perlu edit ulang tiap tombol satu-satu di HTML.
    function attachAutoHaptic() {
        document.addEventListener('click', (e) => {
            const target = e.target.closest(
                'button, .btn-premium-action, .menu-item, .nav-tab, [data-haptic]'
            );
            if (target) window.flHaptic('light');
        }, { passive: true });
    }

    // ---------- 4. TOMBOL BACK ANDROID ----------
    // Urutan prioritas saat back ditekan:
    // 1) Tutup modal yang lagi kebuka (.modal.open)
    // 2) Tutup sidebar yang lagi kebuka (.sidebar-overlay.show)
    // 3) Tutup search overlay kalau lagi kebuka
    // 4) Kalau di halaman selain dashboard, balik ke dashboard
    // 5) Kalau udah di dashboard/halaman utama, tekan back sekali lagi
    //    dalam 2 detik buat keluar app (mencegah kepencet gak sengaja)
    let backPressedOnce = false;
    function setupBackButton() {
        if (!isNative || !Cap.Plugins?.App) return;

        Cap.Plugins.App.addListener('backButton', () => {
            // 1) modal terbuka?
            const openModal = document.querySelector('.modal.open');
            if (openModal) {
                openModal.classList.remove('open');
                window.flHaptic('light');
                return;
            }

            // 2) sidebar terbuka?
            const openSidebar = document.querySelector('.sidebar-overlay.show');
            if (openSidebar) {
                document.querySelectorAll('.sidebar-overlay').forEach(o => o.classList.remove('show'));
                window.flHaptic('light');
                return;
            }

            // 3) search overlay terbuka?
            const searchOverlay = document.getElementById('search-overlay');
            if (searchOverlay && !searchOverlay.classList.contains('hidden')) {
                searchOverlay.classList.add('hidden');
                return;
            }

            // 4) belum di dashboard? balik ke dashboard dulu
            const dashboardPage = document.getElementById('page-dashboard');
            const isOnDashboard = dashboardPage && dashboardPage.classList.contains('active');
            if (!isOnDashboard) {
                const dashMenuItem = document.querySelector('#view-product .menu-item[data-target="dashboard"]');
                if (dashMenuItem) {
                    dashMenuItem.click();
                    return;
                }
            }

            // 5) double-tap back buat keluar
            if (backPressedOnce) {
                Cap.Plugins.App.exitApp();
            } else {
                backPressedOnce = true;
                if (typeof showToast === 'function') {
                    showToast('Tekan sekali lagi untuk keluar', 'info');
                } else {
                    console.log('Tekan sekali lagi untuk keluar');
                }
                setTimeout(() => { backPressedOnce = false; }, 2000);
            }
        });
    }

    // ---------- 5. OFFLINE DETECTION ----------
    function setupOfflineBanner() {
        const banner = document.createElement('div');
        banner.id = 'fl-offline-banner';
        banner.textContent = '📡 Tidak ada koneksi internet — data mungkin tidak ter-update';
        Object.assign(banner.style, {
            position: 'fixed', top: '0', left: '0', right: '0',
            background: '#c0392b', color: '#fff', textAlign: 'center',
            fontSize: '12px', padding: '6px 12px', zIndex: '99999',
            transform: 'translateY(-100%)', transition: 'transform 0.25s ease',
        });
        document.body.appendChild(banner);

        function updateStatus() {
            if (navigator.onLine) {
                banner.style.transform = 'translateY(-100%)';
            } else {
                banner.style.transform = 'translateY(0)';
            }
        }
        window.addEventListener('online', updateStatus);
        window.addEventListener('offline', updateStatus);
        updateStatus();
    }

    // ---------- 6. PULL-TO-REFRESH ----------
    // Gesture tarik ke bawah di halaman utama buat reload data dari Supabase.
    // Cuma aktif kalau posisi scroll udah di paling atas (biar gak nabrak
    // scroll biasa di tengah halaman).
    function setupPullToRefresh() {
        const container = document.scrollingElement || document.documentElement;
        const indicator = document.createElement('div');
        indicator.id = 'fl-ptr-indicator';
        indicator.textContent = '⬇️ Tarik untuk refresh';
        Object.assign(indicator.style, {
            position: 'fixed', top: '0', left: '0', right: '0',
            textAlign: 'center', fontSize: '12px', color: 'var(--text-muted, #999)',
            padding: '8px', transform: 'translateY(-100%)', transition: 'transform 0.2s ease',
            zIndex: '9998', pointerEvents: 'none',
        });
        document.body.appendChild(indicator);

        let startY = 0, pulling = false;

        document.addEventListener('touchstart', (e) => {
            if (container.scrollTop <= 0) {
                startY = e.touches[0].clientY;
                pulling = true;
            }
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            if (!pulling) return;
            const diff = e.touches[0].clientY - startY;
            if (diff > 0 && diff < 120) {
                indicator.style.transform = `translateY(${Math.min(diff - 40, 0)}px)`;
                if (diff > 70) indicator.textContent = '🔄 Lepas untuk refresh';
                else indicator.textContent = '⬇️ Tarik untuk refresh';
            }
        }, { passive: true });

        document.addEventListener('touchend', (e) => {
            if (!pulling) return;
            pulling = false;
            const diff = e.changedTouches[0].clientY - startY;
            if (diff > 70) {
                indicator.textContent = '🔄 Memuat ulang...';
                window.flHaptic('medium');
                setTimeout(() => {
                    if (typeof loadDataFromSupabase === 'function') {
                        loadDataFromSupabase();
                    } else {
                        location.reload();
                    }
                    indicator.style.transform = 'translateY(-100%)';
                }, 300);
            } else {
                indicator.style.transform = 'translateY(-100%)';
            }
        }, { passive: true });
    }

    // ---------- 7. SKELETON LOADING HELPER ----------
    // Panggil window.flShowSkeleton(container, jumlahBaris) sebelum fetch data,
    // dan window.flHideSkeleton(container) setelah data selesai dirender.
    window.flShowSkeleton = function (container, rows = 4) {
        if (!container) return;
        container.dataset.flOriginal = container.innerHTML;
        let html = '';
        for (let i = 0; i < rows; i++) {
            html += '<div class="fl-skeleton-row"><div class="fl-skeleton-bar"></div></div>';
        }
        container.innerHTML = html;
    };
    window.flHideSkeleton = function (container) {
        if (!container || container.dataset.flOriginal === undefined) return;
        // Cuma dipakai kalau caller LUPA render ulang manual; biasanya
        // caller udah timpa innerHTML sendiri pas render data asli.
        delete container.dataset.flOriginal;
    };

    // ---------- INIT ----------
    document.addEventListener('DOMContentLoaded', () => {
        setupStatusBar();
        setupBackButton();
        attachAutoHaptic();
        setupOfflineBanner();
        setupPullToRefresh();
        hideSplashWhenReady();
    });
})();
