// دالة لفتح الروابط الخارجية بأمان (خاصة ببيئة Electron)
function openExternalUrl(url) {
    // التحقق من وجود بيئة Electron
    if (typeof require !== 'undefined' && typeof require('electron') !== 'undefined') {
        const { shell } = require('electron');
        shell.openExternal(url);
    } else {
        // فتح الرابط في نافذة جديدة كحل بديل للمتصفح العادي
        window.open(url, '_blank');
    }
}


// حل مشكلة تعريف مكتبة XLSX في بيئة Electron وحمايتها من الضياع
(function initXLSX() {
    if (typeof window.XLSX !== 'undefined' && window.XLSX && window.XLSX.utils) {
        return;
    }
    if (typeof XLSX !== 'undefined' && XLSX && XLSX.utils) {
        window.XLSX = XLSX;
        return;
    }
    if (typeof globalThis !== 'undefined' && globalThis.XLSX && globalThis.XLSX.utils) {
        window.XLSX = globalThis.XLSX;
        return;
    }
    if (typeof require !== 'undefined') {
        try {
            const path = require('path');
            const fs = require('fs');
            const xlsxPath = path.join(__dirname, '..', 'lib', 'xlsx.full.min.js');
            if (fs.existsSync(xlsxPath)) {
                window.XLSX = require(xlsxPath);
            }
        } catch (e) { }
    }
})();

// =========================================================================
// 🔢 المزامنة التلقائية لرقم الإصدار الموحد (Single Source of Truth Unification)
// المصدر الرسمي الوحيد هو package.json عبر app.getVersion()
// =========================================================================
window.appVersion = '1.0.1';
window.APP_VERSION = '1.0.1';

async function fetchAppVersion() {
    let version = '1.0.1';
    try {
        if (typeof window !== 'undefined' && window.require) {
            const electron = window.require('electron');
            if (electron && electron.ipcRenderer) {
                const ver = await electron.ipcRenderer.invoke('get-app-version');
                if (ver) version = ver;
            }
        }
    } catch (e) { }
    return version;
}

function syncAppVersionUI(version) {
    if (!version) version = window.appVersion || '1.0.1';
    window.appVersion = version;
    window.APP_VERSION = version;

    // 1. تحديث كافة العناصر التي تحمل الأصناف أو الخصائص المخصصة لرقم الإصدار
    document.querySelectorAll('.dynamic-app-version, .app-version, [data-app-version]').forEach(el => {
        el.innerText = `v${version}`;
    });

    // 2. تحديث شاشة "حول البرنامج" ومركز التحديثات
    const aboutBadge = document.getElementById('aboutAppVersionBadge');
    if (aboutBadge) aboutBadge.innerText = `الإصدار الرسمي v${version} ⚡`;

    const label = document.getElementById('updateCurrentVerLabel');
    if (label) label.innerText = `v${version}`;

    const badge = document.getElementById('updateCurrentVerBadge');
    if (badge) badge.innerText = `v${version} ⚡`;

    const changelogBadge = document.getElementById('updateChangelogCurrentVer');
    if (changelogBadge) changelogBadge.innerText = `(v${version})`;
}

window.syncAppVersionUI = syncAppVersionUI;
window.fetchAppVersion = fetchAppVersion;

(async function initAppVersion() {
    const ver = await fetchAppVersion();
    window.appVersion = ver;
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => syncAppVersionUI(ver));
    } else {
        syncAppVersionUI(ver);
    }
})();

if ('serviceWorker' in navigator && window.location.protocol !== 'file:' && !navigator.userAgent.includes('Electron')) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
            .then(reg => {
                console.log('Service Worker: Registered ✅');
                // فحص وجود تحديثات جديدة بشكل دوري تلقائي
                setInterval(() => {
                    reg.update();
                }, 1000 * 60 * 30); // كل 30 دقيقة
            })
            .catch(err => console.log('Service Worker: Failed ❌', err));
    });

    // إعادة تحميل الصفحة فوراً عند تحديث ملفات النظام في الخلفية وتنشيط SW الجديد
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
    });
}

// Supabase Configuration - Disconnected for local offline usage
const SUPABASE_URL = '';
const SUPABASE_KEY = '';
let supabaseClient = null;

// Cloud initialization disabled for offline mode

// تم إزالة نظام درع بَيَان (حماية السورس كود) لفتح النسخة تجارياً

// --- 🛡️ نظام درع بَيَان السحابي (Bayan Shield Cloud Logic) ---

// تم نقل التهيئة للأعلى لضمان التوفر الشامل

const CLOUD_TABLES = ['users_subscriptions', 'users', 'المستخدمين_عام'];

const PRIMARY_TABLE = 'users_subscriptions';

// تم إزالة تشفير هوية الجهاز (HWID Encryption) لفتح النسخة تجارياً

async function checkSubscriptionStatus() {
    if (typeof checkLicenseAndLockApp === 'function') {
        return await checkLicenseAndLockApp();
    }
    return true;
}

// دالة فحص التحديثات الجديدة

// تهيئة قاعدة بيانات IndexedDB بشكل كامل (Dexie)
const db = new Dexie("BayanDatabase");
db.version(100).stores({
    products: "++id, name, barcode, category",
    transactions: "++id, dateISO, type, partner, invoiceId",
    accounts: "++id, name, type, code",
    settings: "id",
    trash: "++id, type, deletedAt",
    users: "++id, name, pin",
    auditLogs: "++id, timestamp, action",
    backups: "++id, timestamp",
    wallpapers: "name",
    treasuryAudit: "++id, date, category"
});
window.db = db;
if (typeof window.bayanDB === 'undefined' || !window.bayanDB) {
    window.bayanDB = db;
}

// قاعدة بيانات وهمية للأصناف (سيتم استبدالها لاحقاً ببيانات من DB)

let initialProducts = [];

window.productsDB = [];

let isEditMode = false;

let editingInvoiceId = null;

let editingOriginalDate = null;

let editingOriginalItems = []; // لحساب فرق المخزون والمديونية

let selectedInvoiceIndex = null;

let selectedHistoryIndex = null;

let currentQuickAddContext = null;

let currentSessionSelectedAddress = ''; // تتبع العنوان المختار للطباعة حالياً

// --- التبديل بين الأقسام ---

// --- نظام المختبر المتعدد المطوّر (Multi-Instance Tab Logic) ---

let openTabs = [{ id: 'dashboard', type: 'dashboard', label: '🏠 الرئيسية' }];

let activeTabId = 'dashboard';

let pendingCloseSection = null;

let tabStates = {};

let tabCounters = {};

// --- تهيئة أزرار نافذة التأكيد (Unsaved Changes Modal) ---

async function checkAccess() {
    try {
        const isAllowed = await checkSubscriptionStatus();
        if (!isAllowed) {
            console.warn("⚠️ Access Denied: Subscription status check failed.");
            return false;
        }
        return true;
    } catch (e) {
        console.error("❌ Error in checkAccess:", e);
        return true;
    }
}

window.cart = [];

window.currentTotal = 0; // الصافي النهائي

window.transactions = []; // سجل العمليات العام (إجمالي الحركة)

window.currentInvoicesView = 'operation'; // وضع العرض: operation (تجميع) أو items (تفصيلي)

window.currentFontSize = 16; // حجم الخط الافتراضي

window.users = [];

window.currentUser = null;

window.selectedLoginUser = null;

window.warehouses = []; // مصفوفة المخازن

window.accounts = []; // مصفوفة الحسابات العامة (العملاء والموردين)

window.trashBin = []; // سلة المحذوفات

window.auditLogs = []; // سجل التدقيق للعمليات الحساسة

window.selectedAccountID = null; // الحساب المحدد في الجدول

/**

 * دالة تسجيل العمليات الحساسة (Audit Logger)

 */

let currentLanguage = 'ar'; // اللغة الافتراضية

// --- نظام تخصيص أعمدة المخزن (Inventory Column Visibility) ---

let inventoryColumnVisibility = JSON.parse(getStore('pos_inv_cols') || '{"0":true,"1":true,"2":true,"3":true,"4":true,"5":true,"6":true,"7":true,"8":true,"9":true,"10":true,"11":true,"12":true,"13":true,"margin":true,"detailed":true}');

// قوائم أسباب الخصم والإضافة (للحفظ الذكي)

let discountReasons = ['خصم عام', 'خصم عميل مميز', 'خصم تجاري', 'تعويض شكوى'];

let taxReasons = ['ضريبة (VAT)', 'خدمة توصيل', 'مصاريف إضافية'];

let purchaseDiscountReasons = ['خصم توريد', 'خصم كمية', 'تعجيل دفع'];

let purchaseTaxReasons = ['ضريبة مشتريات', 'نقل ومشال', 'تغليف / إضافات'];

window.inventoryCategories = ['عام'];

if (getStore('bayan_inventory_categories')) {

    window.inventoryCategories = JSON.parse(getStore('bayan_inventory_categories'));

}

// --- نظام الحفظ والاسترجاع (LocalStorage) ---

// --- نظام الحسابات والديناميكية ---

async function loadData() {
    // 0. تهيئة نظام التخزين الوسيط والمزامنة مع IndexedDB
    if (typeof initAppStore === 'function') {
        await initAppStore();
    }

    // تطبيق وتفعيل تخصيص الأعمدة المحفوظة فور تحميل الـ Store
    if (typeof applyInventoryColumnVisibility === 'function') {
        applyInventoryColumnVisibility();
    }

    // 📡 التحقق من ترخيص الاشتراك محلياً بطريقة مؤمنة
    try {
        if (typeof LicenseService !== 'undefined' && LicenseService.verifyLicense) {
            await LicenseService.verifyLicense();
            setInterval(() => LicenseService.verifyLicense(), 5 * 60 * 1000);
        }
    } catch(err) {
        console.warn("⚠️ LicenseService verify notice:", err);
    }

    // جلب الإعلانات وتحديثها كل 10 دقائق

    fetchAdminAnnouncements();

    setInterval(fetchAdminAnnouncements, 10 * 60 * 1000);

    const savedSession = getStore('pos_session_user');

    try {
        await db.open();
    } catch (openError) {
        console.error("⚠️ خطأ في فتح قاعدة البيانات في core.js:", openError);
        // تم إزالة Dexie.delete("BayanDatabase") لحماية قاعدة البيانات من الحذف التلقائي
    }

    try {
        // 1. تحميل كافة البيانات من IndexedDB بالتوازي لتسريع بدء التشغيل والتحميل 100%
        const [pData, tData, aData, uData, trData, logData] = await Promise.all([
            db.products.toArray(),
            db.transactions.toArray(),
            db.accounts.toArray(),
            db.users.toArray(),
            db.trash.toArray(),
            db.auditLogs.toArray()
        ]);

        productsDB = pData || [];
        transactions = tData || [];
        accounts = aData || [];
        users = uData || [];
        trashBin = trData || [];
        auditLogs = logData || [];

        // تنظيف أي أرصدة سالبة قديمة ومزامنة رصيد الصنف الأساسي مع مجموع تشكيلاته
        if (Array.isArray(productsDB)) {
            productsDB.forEach(p => {
                if (p.variants && Array.isArray(p.variants) && p.variants.length > 0) {
                    p.variants.forEach(v => {
                        if (v.stock !== undefined && (parseFloat(v.stock) < 0 || isNaN(parseFloat(v.stock)))) {
                            v.stock = 0;
                        }
                    });
                    const vSum = p.variants.reduce((sum, v) => sum + (parseFloat(v.stock) || 0), 0);
                    p.stock = vSum;
                }
            });
        }

        console.log("✅ Data successfully loaded and synchronized from IndexedDB.");
    } catch (err) {
        console.error("❌ Failed to load data from IndexedDB:", err);
        users = [];
        trashBin = [];
        auditLogs = [];
    }

    if (getStore('pos_warehouses')) {

        warehouses = JSON.parse(getStore('pos_warehouses'));

    } else {

        warehouses = [{ id: 1, name: 'المخزن الرئيسي', address: 'المقر الرئيسي' }];

    }

    // تحميل أسباب الخصم والإضافة التلقائية (من localStorage للمحافظة على التوافق حالياً)

    if (getStore('pos_discount_reasons')) discountReasons = JSON.parse(getStore('pos_discount_reasons'));

    if (getStore('pos_tax_reasons')) taxReasons = JSON.parse(getStore('pos_tax_reasons'));

    if (getStore('pos_p_discount_reasons')) purchaseDiscountReasons = JSON.parse(getStore('pos_p_discount_reasons'));

    if (getStore('pos_p_tax_reasons')) purchaseTaxReasons = JSON.parse(getStore('pos_p_tax_reasons'));

    // دمج التصنيفات الموجودة في المنتجات مع القائمة الدائمة لضمان عدم ضياع أي تصنيف قديم

    if (window.productsDB && window.productsDB.length > 0) {

        const existingCats = [...new Set(window.productsDB.map(p => p.category).filter(c => c))];


        existingCats.forEach(cat => {

            if (!window.inventoryCategories.includes(cat)) {

                window.inventoryCategories.push(cat);

            }

        });

    }

    updateDatalists();

    const mainSettings = (await db.settings.get('main')) || {};

    // تطبيق الثيم

    if (mainSettings.theme === 'dark' || getStore('pos_theme') === 'dark') {

        document.body.classList.add('dark-mode');

        const themeBtn = document.querySelector('.theme-toggle-btn');

        if (themeBtn) themeBtn.innerText = '☀️';

    }

    // إعدادات الخط

    if (mainSettings.fontSize) {

        currentFontSize = mainSettings.fontSize;

        document.documentElement.style.setProperty('--app-font-size', currentFontSize + 'px');

    }

    if (mainSettings.name) document.getElementById('appTitle').innerText = '🚀 ' + mainSettings.name;

    if (mainSettings.language) {

        currentLanguage = mainSettings.language;

        changeLanguage(currentLanguage);

    }

    if (mainSettings.mainColor) document.documentElement.style.setProperty('--main-green', mainSettings.mainColor);

    const todayISO = new Date().toLocaleDateString('en-CA');

    document.getElementById('reportDateFrom').value = todayISO;

    document.getElementById('reportDateTo').value = todayISO;

    document.getElementById('invoicesDateFrom').value = todayISO;

    document.getElementById('invoicesDateTo').value = todayISO;

    document.getElementById('historyDateFrom').value = todayISO;

    document.getElementById('historyDateTo').value = todayISO;

    // ضبط القيمة الافتراضية للفلاتر لتكون "الكل" عند التحميل

    if (document.getElementById('invoicesSearchMethod')) document.getElementById('invoicesSearchMethod').value = 'all';

    if (document.getElementById('anMethod')) document.getElementById('anMethod').value = 'all';

    if (document.getElementById('historyMethodFilter')) document.getElementById('historyMethodFilter').value = 'all';

    initConfirmModal();

    // إجبار تسجيل الدخول عند كل تحميل للمتصفح بناءً على طلب المستخدم

    initLogin();

    // ✅ أمان: استعادة الجلسة من IndexedDB عبر PIN فقط (لا نثق بالبيانات المخزنة في localStorage)
    if (savedSession) {

        try {

            const sessionData = JSON.parse(savedSession);
            const savedPin = sessionData.pin;
            const savedWarehouse = sessionData.warehouseName || 'المخزن الرئيسي';

            // نبحث عن المستخدم في IndexedDB بالـ PIN (لا نثق بالبيانات المكتوبة في localStorage)
            if (savedPin) {
                const realUser = users.find(u => u.pin === savedPin);
                if (realUser) {
                    // نملأ اسم المستخدم مسبقاً في شاشة تسجيل الدخول للراحة
                    const userSelect = document.getElementById('loginUsernameInput');
                    if (userSelect) {
                        userSelect.value = realUser.name;
                        setTimeout(() => {
                            const pinInput = document.getElementById('loginPinInput');
                            if (pinInput) pinInput.focus();
                        }, 500);
                    }
                } else {
                    // الـ PIN لا يطابق أي مستخدم حقيقي - نحذف الجلسة
                    removeStore('pos_session_user');
                }
            }

        } catch (e) {
            removeStore('pos_session_user');
        }

    }

    updateConnectionStatus();

    // ✅ تطبيق صلاحيات وإعدادات التاريخ فور تحميل البيانات
    setTimeout(() => {
        if (typeof applyPermissions === 'function') applyPermissions();
    }, 300);

    // تشغيل النسخ الاحتياطي التلقائي عند التحميل
    setTimeout(() => {
        if (typeof BackupService !== 'undefined') BackupService.createAutoBackup();
    }, 2000);

    // تشغيل النسخ الاحتياطي التلقائي عند إغلاق البرنامج
    window.addEventListener('beforeunload', () => {
        if (typeof BackupService !== 'undefined') {
            // استخدام التزامن أو الحفظ المباشر
            BackupService.createAutoBackup();
        }
    });

}

window.deletedItemIds = {
    transactions: [],
    products: [],
    accounts: []
};

let isSavingDbData = false;
let pendingSaveDbRequest = false;

async function saveData() {
    if (isSavingDbData) {
        pendingSaveDbRequest = true;
        return;
    }
    isSavingDbData = true;

    try {
        await db.transaction('rw', [db.products, db.accounts, db.transactions, db.users, db.trash, db.auditLogs, db.settings, db.treasuryAudit], async () => {
            // 1. حفظ وتحديث الأصناف
            if (Array.isArray(productsDB)) {
                if (window.deletedItemIds.products && window.deletedItemIds.products.length > 0) {
                    await db.products.bulkDelete(window.deletedItemIds.products);
                    window.deletedItemIds.products = [];
                }
                if (productsDB.length > 0) {
                    const keys = await db.products.bulkPut(productsDB, {allKeys: true});
                    if (keys && keys.length === productsDB.length) {
                        productsDB.forEach((p, i) => { if (!p.id) p.id = keys[i]; });
                    }
                }
            }

            // 2. حفظ وتحديث الحسابات (عملاء وموردين)
            if (Array.isArray(accounts)) {
                if (window.deletedItemIds.accounts && window.deletedItemIds.accounts.length > 0) {
                    await db.accounts.bulkDelete(window.deletedItemIds.accounts);
                    window.deletedItemIds.accounts = [];
                }
                if (accounts.length > 0) {
                    const keys = await db.accounts.bulkPut(accounts, {allKeys: true});
                    if (keys && keys.length === accounts.length) {
                        accounts.forEach((a, i) => { if (!a.id) a.id = keys[i]; });
                    }
                }
            }

            // 3. حفظ وتحديث العمليات والفواتير
            if (Array.isArray(transactions)) {
                if (window.deletedItemIds.transactions && window.deletedItemIds.transactions.length > 0) {
                    await db.transactions.bulkDelete(window.deletedItemIds.transactions);
                    window.deletedItemIds.transactions = [];
                }
                if (transactions.length > 0) {
                    const keys = await db.transactions.bulkPut(transactions, {allKeys: true});
                    if (keys && keys.length === transactions.length) {
                        transactions.forEach((t, i) => { if (!t.id) t.id = keys[i]; });
                    }
                }
            }

            // 4. حفظ المستخدمين
            if (Array.isArray(users)) {
                await db.users.clear();
                if (users.length > 0) {
                    await db.users.bulkPut(users);
                }
            }

            // 5. حفظ المهملات
            if (Array.isArray(trashBin)) {
                await db.trash.clear();
                if (trashBin.length > 0) {
                    await db.trash.bulkPut(trashBin);
                }
            }

            // 6. حفظ سجل النظام
            if (Array.isArray(auditLogs)) {
                await db.auditLogs.clear();
                if (auditLogs.length > 0) {
                    await db.auditLogs.bulkPut(auditLogs);
                }
            }

            // 7. حفظ الإعدادات
            const settings = JSON.parse(getStore('pos_settings') || '{}');
            await db.settings.put({ id: 'main', ...settings });
        });

        console.log("✅ Data successfully saved atomically to IndexedDB.");
    } catch (err) {
        console.error("❌ Failed to save data to IndexedDB:", err);
    } finally {
        window.accountBalancesCache = {}; // Invalidate balance cache
        isSavingDbData = false;
        if (pendingSaveDbRequest) {
            pendingSaveDbRequest = false;
            saveData();
        }
    }

    // استمرار دعم localStorage لبعض الإعدادات السريعة
    setStore('pos_warehouses', JSON.stringify(warehouses));
    setStore('pos_discount_reasons', JSON.stringify(discountReasons));
    setStore('pos_tax_reasons', JSON.stringify(taxReasons));
    setStore('pos_p_discount_reasons', JSON.stringify(purchaseDiscountReasons));
    setStore('pos_p_tax_reasons', JSON.stringify(purchaseTaxReasons));
    setStore('bayan_inventory_categories', JSON.stringify(window.inventoryCategories));

    // تحديث وتفريغ كاش أرصدة المخازن فورياً
    if (typeof invalidateStockCache === 'function') {
        invalidateStockCache();
    }
    if (typeof window.invalidateStockCache === 'function') {
        window.invalidateStockCache();
    }

    updateNotifications();
}

// تحديث القوائم المنسدلة الذكية لدعم الأنواع الجديدة (Select)

async function wipeAllSystemData() {

    if (!confirm("⚠️ تنبيه خطير جداً!\n\nأنت على وشك مسح كافة بيانات النظام (الأصناف، الفواتير، الحسابات، الإعدادات).\n\nهل أنت متأكد تماماً من هذه الخطوة؟ لا يمكن التراجع عنها!")) {

        return;

    }

    const confirmSecond = confirm("⚠️ تأكيد أخير:\n\nسيتم حذف كل شيء والبدء من جديد. هل أنت متأكد؟");

    if (!confirmSecond) return;

    try {

        // مسح كافة الجداول في IndexedDB

        await Promise.all([

            db.products.clear(),

            db.transactions.clear(),

            db.accounts.clear(),

            db.users.clear(),

            db.settings.clear(),

            db.trash.clear(),

            db.auditLogs.clear()

        ]);

        // مسح البيانات من LocalStorage

        const keysToRemove = [

            'pos_products', 'pos_transactions', 'pos_accounts', 'pos_users',

            'pos_settings', 'pos_theme', 'pos_session_user', 'pos_warehouses',

            'bayan_install_date', 'bayan_active'

        ];

        keysToRemove.forEach(key => removeStore(key));

        alert("✅ تمت عملية تصفير النظام بنجاح! سيتم إعادة تحميل البرنامج الآن.");

        location.reload();

    } catch (error) {

        console.error("Error wiping data:", error);

        alert("❌ حدث خطأ أثناء مسح البيانات: " + error.message);

    }

}

window.wipeAllSystemData = wipeAllSystemData;

// PWA Install Prompt Logic
let deferredPrompt;
const installAppContainer = document.getElementById('installAppContainer');
const installAppBtn = document.getElementById('installAppBtn');
const closeInstallBtn = document.getElementById('closeInstallBtn');

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    // Update UI notify the user they can install the PWA
    if (installAppContainer) {
        installAppContainer.style.display = 'flex';
        // Add a smooth slide up animation
        installAppContainer.style.animation = 'slideUpFade 0.5s ease-out forwards';
    }
});

if (installAppBtn) {
    installAppBtn.addEventListener('click', async () => {
        if (installAppContainer) {
            installAppContainer.style.display = 'none';
        }
        if (deferredPrompt) {
            // Show the install prompt
            deferredPrompt.prompt();
            // Wait for the user to respond to the prompt
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User response to the install prompt: ${outcome}`);
            // We've used the prompt, and can't use it again, throw it away
            deferredPrompt = null;
        }
    });
}

if (closeInstallBtn) {
    closeInstallBtn.addEventListener('click', () => {
        if (installAppContainer) {
            installAppContainer.style.animation = 'slideDownFade 0.5s ease-in forwards';
            setTimeout(() => {
                installAppContainer.style.display = 'none';
            }, 500);
        }
    });
}

// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}
