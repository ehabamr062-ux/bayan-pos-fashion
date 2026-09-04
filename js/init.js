
// ================= نظام بَيَان POS - نقطة الانطلاق (Initialization) =================
// يتم استدعاء هذه الدالة بعد تحميل كافة الملفات المعيارية (Modules)

loadData().then(async () => {
    // 0. تحميل الإعدادات والشعار بعد اكتمال جلب البيانات من IndexedDB
    if (typeof loadSettings === 'function') loadSettings();
    if (typeof applyBusinessTypeUI === 'function') applyBusinessTypeUI();
    if (typeof populatePaymentMethodSelects === 'function') populatePaymentMethodSelects();
    const savedLogo = getStore('bayan_business_logo');
    if (savedLogo && typeof updateLogoDisplays === 'function') {
        updateLogoDisplays(savedLogo);
    }

    // 1. تحديث التوجيهات وشاشة تسجيل الدخول فوراً وبأقصى سرعة (0ms)
    if (currentUser) {
        console.log(`👤 أهلاً بك مجدداً: ${currentUser.name}`);
        if (typeof updateNotifications === 'function') updateNotifications();
        if (typeof window.updateHeaderWarehouseSelect === 'function') window.updateHeaderWarehouseSelect();
    } else if (typeof initLogin === 'function') {
        initLogin();
    }

    // 2. تحميل الخلفية في الخلفية بشكل غير معطل للواجهة
    if (typeof loadWallpaper === 'function') {
        loadWallpaper().catch(e => console.warn("Wallpaper load:", e));
    }

    // 3. تسجيل Service Worker للتشغيل الأوفلاين 100% ودعم التثبيت المباشر على الأندرويد (يتطلب خادم http/https)
    if ('serviceWorker' in navigator && !window.require && (location.protocol === 'http:' || location.protocol === 'https:')) {
        navigator.serviceWorker.register('./service-worker.js')
            .then(reg => console.log('📱 Service Worker registered for Android/Web Offline Mode:', reg.scope))
            .catch(err => console.warn('SW registration failed:', err));
    }

    // 4. صمام الأمان الفولاذي: إنشاء نسخة احتياطية تلقائية وفورية في الخلفية عند الترقية لإصدار جديد
    try {
        const lastVer = getStore('bayan_last_run_version');
        const curVer = window.appVersion || '1.0.3';
        if (lastVer && lastVer !== curVer) {
            console.log(`🛡️ [Safety Shield] Version upgrade detected (${lastVer} ➔ ${curVer}). Creating automatic background backup...`);
            if (typeof window.executeAutoBackupToFile === 'function') {
                window.executeAutoBackupToFile(true, false).then(() => {
                    console.log('✅ Post-upgrade background safety backup created successfully.');
                }).catch(err => console.warn('Post-upgrade backup notice:', err));
            }
        }
    } catch (e) { }

    // 5. تشغيل مزامنة الشبكة المحلية والتابلت
    if (window.BayanNetworkHub && typeof window.BayanNetworkHub.init === 'function') {
        window.BayanNetworkHub.init().catch(e => console.warn('[NetworkHub] Init error:', e));
    }

    console.log("🚀 نظام بَيَان المتكامل جاهز للعمل بنجاح!");
});

// =========================================================================
// 📱 معالج تثبيت تطبيق الأندرويد والهواتف الذكية (PWA Install Prompt)
// =========================================================================
let deferredPwaPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPwaPrompt = e;
    console.log('📱 PWA Install Prompt captured.');

    // إظهار كارت تنبيه التثبيت للأندرويد بعد ثانيتين
    setTimeout(() => {
        if (!document.getElementById('pwa-android-install-banner') && !sessionStorage.getItem('pwa_banner_dismissed')) {
            const banner = document.createElement('div');
            banner.id = 'pwa-android-install-banner';
            banner.style.cssText = `
                position: fixed; bottom: 20px; right: 20px; left: 20px; max-width: 460px; margin: 0 auto;
                background: linear-gradient(145deg, #1e113a, #0f172a); border: 2px solid rgba(212, 175, 55, 0.6);
                border-radius: 20px; padding: 18px 22px; color: white; z-index: 999999;
                box-shadow: 0 20px 50px rgba(0,0,0,0.6), 0 0 30px rgba(147, 51, 234, 0.3);
                display: flex; align-items: center; justify-content: space-between; gap: 14px;
                direction: rtl; font-family: 'Cairo', sans-serif; animation: pwaSlideUp 0.4s ease;
            `;
            banner.innerHTML = `
                <div style="display:flex; align-items:center; gap:12px;">
                    <img src="media/logo.png" style="width:48px; height:48px; border-radius:12px; border:1.5px solid rgba(255,255,255,0.2); box-shadow:0 4px 12px rgba(0,0,0,0.3);" alt="Logo">
                    <div>
                        <div style="font-weight:900; font-size:1rem; color:#ffffff;">تثبيت تطبيق بَيَان POS 📱</div>
                        <div style="font-size:0.78rem; color:#cbd5e1; font-weight:700;">ثبّت التطبيق ليعمل بدون إنترنت كبرنامج أندرويد أصلي</div>
                    </div>
                </div>
                <div style="display:flex; gap:8px; align-items:center;">
                    <button id="btnPwaInstallNow" style="padding:10px 18px; border-radius:12px; background:linear-gradient(135deg, #10b981, #059669); color:white; border:none; font-weight:900; font-size:0.88rem; cursor:pointer; font-family:'Cairo',sans-serif; box-shadow:0 4px 15px rgba(16,185,129,0.4); transition:0.2s;">
                        تثبيت الآن
                    </button>
                    <button id="btnPwaDismiss" style="background:transparent; border:none; color:#94a3b8; font-size:1.2rem; cursor:pointer; padding:4px;">✕</button>
                </div>
            `;
            document.body.appendChild(banner);

            document.getElementById('btnPwaInstallNow').addEventListener('click', async () => {
                if (deferredPwaPrompt) {
                    deferredPwaPrompt.prompt();
                    const { outcome } = await deferredPwaPrompt.userChoice;
                    console.log(`PWA user response: ${outcome}`);
                    deferredPwaPrompt = null;
                    banner.remove();
                }
            });

            document.getElementById('btnPwaDismiss').addEventListener('click', () => {
                sessionStorage.setItem('pwa_banner_dismissed', 'true');
                banner.remove();
            });
        }
    }, 2000);
});
