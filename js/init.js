
// ================= نظام بَيَان POS - نقطة الانطلاق (Initialization) =================
// يتم استدعاء هذه الدالة بعد تحميل كافة الملفات المعيارية (Modules)

loadData().then(async () => {
    // 0. فحص واستعادة رتبة المدير الأساسي وصمام الأمان التلقائي
    try {
        if (typeof users !== 'undefined' && Array.isArray(users) && users.length > 0) {
            let primaryAdmin = users.find(u => u.id === 1 || u.id === '1') || users[0];
            if (primaryAdmin && primaryAdmin.role !== 'admin') {
                console.log("🛡️ [Safety Restore] استعادة رتبة المدير الأساسي كاملة تلقائياً...");
                primaryAdmin.role = 'admin';
                primaryAdmin.isFrozen = false;
                if (!primaryAdmin.permissions) primaryAdmin.permissions = {};
                if (!primaryAdmin.permissions.general) primaryAdmin.permissions.general = {};
                primaryAdmin.permissions.general.settings = true;
                primaryAdmin.permissions.general.users = true;
                primaryAdmin.permissions.general.reports = true;
                primaryAdmin.permissions.general.profits = true;
                if (typeof saveData === 'function') saveData();
                if (currentUser && (currentUser.id === primaryAdmin.id || currentUser.pin === primaryAdmin.pin)) {
                    currentUser.role = 'admin';
                    currentUser.permissions = primaryAdmin.permissions;
                }
            }
        }
    } catch(e) { console.warn("Admin auto-heal notice:", e); }

    // 0.1 تحميل الإعدادات والشعار بعد اكتمال جلب البيانات من IndexedDB
    if (typeof loadSettings === 'function') loadSettings();
    if (typeof applyBusinessTypeUI === 'function') applyBusinessTypeUI();
    if (typeof populatePaymentMethodSelects === 'function') populatePaymentMethodSelects();
    if (typeof populateWarehouseDropdowns === 'function') populateWarehouseDropdowns();
    let savedLogo = getStore('bayan_business_logo');
    // تنظيف الشعار التجريبي القديم غير المرغوب فيه واستعادة واجهة بيان الأصلية
    if (savedLogo && typeof savedLogo === 'string' && (savedLogo.startsWith('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgA') || !getStore('bayan_user_confirmed_custom_logo'))) {
        if (typeof removeStore === 'function') removeStore('bayan_business_logo');
        if (window.AppStore) delete window.AppStore['bayan_business_logo'];
        savedLogo = null;
    }
    if (typeof updateLogoDisplays === 'function') {
        updateLogoDisplays(savedLogo || null);
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
        const curVer = window.appVersion || '1.0.5';
        if (lastVer && lastVer !== curVer) {
            console.log(`🛡️ [Safety Shield] Version upgrade detected (${lastVer} ➔ ${curVer}). Creating automatic background backup...`);
            if (typeof window.executeAutoBackupToFile === 'function') {
                window.executeAutoBackupToFile(true, false).then(() => {
                    console.log('✅ Post-upgrade background safety backup created successfully.');
                }).catch(err => console.warn('Post-upgrade backup notice:', err));
            }
        }
        setStore('bayan_last_run_version', curVer);
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

// =========================================================================
// 🗝️ اختصار الطوارئ السري لفتح الإعدادات واستعادة رتبة المدير (Emergency Override)
// يدعم الضغط على [Ctrl] مع الحروف (D + F + G) معاً أو بالتعاقب السريع
// =========================================================================
(function initEmergencySettingsShortcut() {
    const activeKeys = new Set();

    function triggerEmergencySettings() {
        console.log("⚡ [Emergency Bypass] تفعيل اختصار الطوارئ السري للإعدادات!");

        // 1. استعادة صلاحيات المدير الحالي وفك أي تجميد
        if (typeof users !== 'undefined' && Array.isArray(users) && users.length > 0) {
            let adminUser = users.find(u => u.id === 1 || u.id === '1') || users[0];
            if (adminUser) {
                adminUser.role = 'admin';
                adminUser.isFrozen = false;
                if (!adminUser.permissions) adminUser.permissions = {};
                if (!adminUser.permissions.general) adminUser.permissions.general = {};
                adminUser.permissions.general.settings = true;
                adminUser.permissions.general.users = true;
                adminUser.permissions.general.reports = true;
                adminUser.permissions.general.profits = true;
            }
            if (currentUser) {
                currentUser.role = 'admin';
                currentUser.isFrozen = false;
                if (!currentUser.permissions) currentUser.permissions = {};
                if (!currentUser.permissions.general) currentUser.permissions.general = {};
                currentUser.permissions.general.settings = true;
                currentUser.permissions.general.users = true;
            }
            if (typeof saveData === 'function') saveData();
        }

        // 2. إغلاق شاشة الدخول إذا كانت مفتوحة
        const loginModal = document.getElementById('loginModal');
        if (loginModal) {
            loginModal.classList.add('hidden');
            loginModal.style.display = 'none';
        }
        document.body.classList.remove('is-logged-out');

        // 3. فتح شاشة الإعدادات وتبويب المستخدمين مباشرة
        if (typeof switchSection === 'function') {
            switchSection('settings');
        } else {
            document.querySelectorAll('.section-view').forEach(s => s.classList.add('hidden'));
            const setSec = document.getElementById('settings-section');
            if (setSec) setSec.classList.remove('hidden');
        }

        if (typeof openSettingsTab === 'function') {
            setTimeout(() => openSettingsTab('users'), 150);
        }

        if (typeof showToast === 'function') {
            showToast("🔓 تم فتح قسم الإعدادات بنجاح واستعادة صلاحيات المدير!", "success");
        } else {
            alert("🔓 تم فتح قسم الإعدادات بنجاح واستعادة صلاحيات المدير!");
        }
    }

    // رصد الضغط المتزامن
    window.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        activeKeys.add(key);

        const hasCtrl = e.ctrlKey || activeKeys.has('control');
        const hasD = activeKeys.has('d') || activeKeys.has('ي'); // يدعم العربي والإنجليزي
        const hasF = activeKeys.has('f') || activeKeys.has('ب');
        const hasG = activeKeys.has('g') || activeKeys.has('ل');

        if (hasCtrl && hasD && hasF && hasG) {
            e.preventDefault();
            activeKeys.clear();
            triggerEmergencySettings();
        }
    });

    window.addEventListener('keyup', (e) => {
        activeKeys.delete(e.key.toLowerCase());
    });

    // إتاحة استدعاء يدوي في الكونسول أيضاً إن لزم
    window.emergencyOpenSettings = triggerEmergencySettings;
})();

