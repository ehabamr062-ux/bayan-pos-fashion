/**
 * Bayan POS - Store Manager (SQLite Pure System)
 * نظام وسيط لإدارة الإعدادات والبيانات في الذاكرة ومزامنتها لحظياً ومباشرة مع محرك SQLite
 */

window.AppStore = {};
window.bayanDB = null;
let isAppStoreInitialized = false;

let _initAppStorePromise = null;

// دالة التهيئة الأولية (تستدعى عند بدء التطبيق لتحميل كافة الإعدادات من SQLite إلى الذاكرة)
function initAppStore() {
    if (isAppStoreInitialized && window.bayanDB) return Promise.resolve();
    if (_initAppStorePromise) return _initAppStorePromise;

    _initAppStorePromise = (async () => {
        console.log("🔄 جاري تهيئة نظام Store عبر محرك SQLite...");
        
        // ضمان وجود الداتابيز وتوحيد المرجع مع window.BayanDBAdapter / window.db (محرك SQLite)
        if (typeof window !== 'undefined' && window.BayanDBAdapter) {
            window.db = window.BayanDBAdapter;
            window.bayanDB = window.BayanDBAdapter;
        } else if (typeof window.db !== 'undefined' && window.db) {
            window.bayanDB = window.db;
        }

        if (window.bayanDB && typeof window.bayanDB.open === 'function') {
            try {
                await window.bayanDB.open();
            } catch (e) {}
        }

        if (window.bayanDB && window.bayanDB.settings) {
            try {
                // جلب كافة الإعدادات المحفوظة من SQLite إلى الذاكرة السريعة
                const allSettings = await window.bayanDB.settings.toArray();
                allSettings.forEach(item => {
                    if (item && item.id) {
                        window.AppStore[item.id] = item.value;
                    }
                });

                // مزامنة واستيراد ذكي للإعدادات والتراخيص من localStorage إن كانت غير مسجلة في SQLite بعد
                try {
                    if (typeof localStorage !== 'undefined') {
                        const legacyKeys = [
                            'bayan_hwid', 'hwid', 'bayan_current_plan', 'bayan_has_subscribed_paid', 'bayan_expiry_date',
                            'bayan_activation_date', 'bayan_install_date', 'bayan_subscription_history',
                            'license_info', 'bayan_used_license_codes', 'bayan_trial_consumed',
                            'bayan_trial_final_count', 'bayan_active', 'bayan_master_license',
                            'bayan_remote_extra_trial_limit', 'bayan_drawer_closures'
                        ];
                        legacyKeys.forEach(k => {
                            if (!window.AppStore[k]) {
                                const lVal = localStorage.getItem(k);
                                if (lVal !== null && lVal !== undefined && lVal !== '') {
                                    window.AppStore[k] = lVal;
                                    window.bayanDB.settings.put({ id: k, value: String(lVal) }).catch(() => {});
                                }
                            }
                        });
                    }
                } catch (migErr) {}

                isAppStoreInitialized = true;
                console.log("✅ تم تجهيز الـ Store عبر محرك SQLite بنجاح:", Object.keys(window.AppStore).length, "عنصر محمل.");
            } catch (error) {
                console.error("❌ خطأ أثناء تهيئة الـ Store:", error);
            }
        } else {
            console.error("❌ جدول settings في SQLite غير متوفر.");
        }
    })();

    return _initAppStorePromise;
}

// دالة قراءة متزامنة فائقة السرعة من الذاكرة مع حماية وتوافق تلقائي من localStorage
function getStore(key) {
    if (window.AppStore && window.AppStore.hasOwnProperty(key) && window.AppStore[key] !== null && window.AppStore[key] !== undefined) {
        return window.AppStore[key];
    }
    // 🛡️ التوافق العكسي: إذا لم يكن في الذاكرة/SQLite، يتم جلبه فوراً من localStorage ومزامنته
    try {
        if (typeof localStorage !== 'undefined') {
            const localVal = localStorage.getItem(key);
            if (localVal !== null && localVal !== undefined && localVal !== '') {
                if (!window.AppStore) window.AppStore = {};
                window.AppStore[key] = localVal;
                const dbInstance = window.bayanDB || window.db;
                if (dbInstance && dbInstance.settings) {
                    dbInstance.settings.put({ id: key, value: String(localVal) }).catch(() => {});
                }
                return localVal;
            }
        }
    } catch (e) {}
    return null;
}

// دالة كتابة (تحفظ في الذاكرة فوراً وتُسجّل في قاعدة بيانات SQLite مباشرة مع نسخة احتياطية في localStorage)
function setStore(key, value) {
    if (!window.AppStore) window.AppStore = {};
    window.AppStore[key] = value;
    
    const storedVal = (typeof value === 'object' && value !== null) ? JSON.stringify(value) : String(value);
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(key, storedVal);
        }
    } catch (e) {}

    const dbInstance = window.bayanDB || window.db;
    if (dbInstance && dbInstance.settings) {
        dbInstance.settings.put({ id: key, value: storedVal }).catch(err => {
            console.error(`❌ خطأ في حفظ الإعداد [${key}] داخل SQLite:`, err);
        });
    }
}

// دالة مسح إعداد من SQLite والذاكرة
function removeStore(key) {
    if (window.AppStore && window.AppStore.hasOwnProperty(key)) {
        delete window.AppStore[key];
    }
    
    const dbInstance = window.bayanDB || window.db;
    if (dbInstance && dbInstance.settings) {
        dbInstance.settings.delete(key).catch(err => {
            console.error(`❌ خطأ في حذف الإعداد [${key}] من SQLite:`, err);
        });
    }
}

// دالة تنظيف كاملة للإعدادات من SQLite
async function clearStore() {
    window.AppStore = {};
    const dbInstance = window.bayanDB || window.db;
    if (dbInstance && dbInstance.settings) {
        try {
            await dbInstance.settings.clear();
            console.log("🗑️ تم مسح كافة الإعدادات من SQLite بنجاح.");
        } catch (error) {
            console.error("❌ خطأ في مسح الإعدادات من SQLite:", error);
        }
    }
}

if (typeof window !== 'undefined') {
    window.initAppStore = initAppStore;
    window.getStore = getStore;
    window.setStore = setStore;
    window.removeStore = removeStore;
    window.clearStore = clearStore;
}
