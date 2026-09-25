// ============================================================
//  Service Worker - نظام بيان المحاسبي (Bayan POS)
//  النسخة المطورة للعمل أوفلاين 100%
// ============================================================

const CACHE_NAME = 'bayan-pos-v3.2.0';
const STATIC_CACHE = 'bayan-static-v3.2.0';
const DYNAMIC_CACHE = 'bayan-dynamic-v3.2.0';

// كافة ملفات النظام الأساسية المتوفرة محلياً (بدون تكرار لتفادي خطأ Entry already exists على GitHub Pages)
const STATIC_FILES = [
    './index.html',
    './manifest.json',
    './version.txt',
    './version.json',
    './fonts/cairo.css',
    './css/theme_base.css',
    './css/sales_pos.css',
    './css/inventory_products.css',
    './css/accounts_reports.css',
    './css/ui_modals.css',
    './css/scrollbars.css',
    './css/premium.css',
    './css/treasury_audit.css',
    './css/barcode_print.css',
    './mobile/index.html',
    './mobile/css/mobile_fashion.css',
    './mobile/js/mobile_fashion.js',
    './js/store.js',
    './js/barcode_print.js',
    './js/core.js',
    './js/utils_helpers.js',
    './js/app_units_payments.js',
    './js/app_backup.js',
    './js/app_license.js',
    './js/cloud_telemetry.js',
    './js/app_export_share.js',
    './js/security.js',
    './js/ui_theme_custom.js',
    './js/ui_tabs.js',
    './js/ui_modals_notifications.js',
    './js/ui_auth.js',
    './js/ui_calculator.js',
    './js/inv_core.js',
    './js/inv_products.js',
    './js/inv_variants.js',
    './js/inv_adjustments.js',
    './js/sales_purchases.js',
    './js/sales_pos.js',
    './js/sales_fashion_picker.js',
    './js/sales_returns.js',
    './js/sales_history_view.js',
    './js/sales_inquiry_modal.js',
    './js/inv_transfers.js',
    './js/acc_invoices.js',
    './js/acc_vouchers.js',
    './js/acc_reports.js',
    './js/acc_partners.js',
    './js/receipt_disburse_fixes.js',
    './js/history_enhancements.js',
    './js/barcode.js',
    './js/settings.js',
    './js/trash.js',
    './js/treasury_audit.js',
    './js/init.js',
    './js/print.js',
    './js/updater.js',
    './js/local_network_hub.js',
    './lib/html2canvas.min.js',
    './lib/sql-wasm-binary.js',
    './lib/sql-wasm.js',
    './js/sqlite_manager.js',
    './js/db_adapter.js',
    './js/engine_invoices.js',
    './lib/xlsx.full.min.js',
    './lib/JsBarcode.all.min.js',
    './lib/Sortable.min.js',
    './lib/chart.min.js',
    './lib/qrcode.min.js',
    './media/bayan_logo.png',
    './media/logo.ico',
    './media/wallpapers/fashion_boutique.jpg',
    './media/wallpapers/royal_gold.png',
    './media/wallpapers/neon_abstract.jpg',
    './media/wallpapers/deep_space.png',
    './media/wallpapers/emerald_3d.png',
    './media/wallpapers/cyber_tech.png',
    './media/wallpapers/mountains.jpg',
    './media/wallpapers/burj.jpg',
    './media/wallpapers/beach.jpg',
    './media/wallpapers/night.jpg',
    './media/wallpapers/office.jpg',
    './media/wallpapers/relax.jpg'
];

// تثبيت السيرفس ووركر وتخزين الملفات الأساسية بأمان دون توقف
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE).then(async (cache) => {
            console.log('[SW] 🚀 جاري تخزين الملفات الأساسية للعمل أوفلاين...');
            for (const file of STATIC_FILES) {
                try {
                    const response = await fetch(file, { cache: 'no-cache' });
                    if (response && response.status === 200) {
                        await cache.put(file, response);
                    }
                } catch (err) {
                    // تجاهل الملفات غير المتوفرة بهدوء
                }
            }
        }).then(() => self.skipWaiting())
    );
});

// تفعيل السيرفس ووركر وحذف الكاش القديم
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== STATIC_CACHE && cache !== DYNAMIC_CACHE) {
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// استراتيجية التحكم في الطلبات (Cache First with Network Fallback)
self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (!request || request.method !== 'GET') return;
    if (!request.url.startsWith('http://') && !request.url.startsWith('https://')) return;

    const url = new URL(request.url);
    if (url.pathname.includes('socket.io') || url.pathname.includes('/api/')) return;

    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(request).then((networkResponse) => {
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'error') {
                    return networkResponse;
                }

                const responseToCache = networkResponse.clone();
                caches.open(DYNAMIC_CACHE).then((cache) => {
                    cache.put(request, responseToCache).catch(() => {});
                }).catch(() => {});

                return networkResponse;
            }).catch(() => {
                if (request.destination === 'document' || request.mode === 'navigate') {
                    return caches.match('./index.html') || caches.match('./');
                }

                if (request.destination === 'image') {
                    return new Response(
                        '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#eee"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="12">Bayan POS</text></svg>',
                        { headers: { 'Content-Type': 'image/svg+xml' } }
                    );
                }

                return new Response('', { status: 408, statusText: 'Offline mode active' });
            });
        })
    );
});

// المزامنة في الخلفية (لو عادت الشبكة)
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-data') {
        console.log('[SW] 🔄 جاري مزامنة البيانات المتأخرة...');
    }
});
