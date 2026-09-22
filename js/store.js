/**
 * Bayan POS - Store Manager (IndexedDB Pure System)
 * نظام وسيط لإدارة الإعدادات والبيانات في الذاكرة ومزامنتها لحظياً ومباشرة مع IndexedDB (Dexie)
 * تم إلغاء localStorage بالكامل والاعتماد بنسبة 100% على IndexedDB.
 */

window.AppStore = {};
window.bayanDB = null;
let isAppStoreInitialized = false;

let _initAppStorePromise = null;

// دالة التهيئة الأولية (تستدعى عند بدء التطبيق لتحميل كافة الإعدادات من IndexedDB إلى الذاكرة)
function initAppStore() {
    if (isAppStoreInitialized && window.bayanDB) return Promise.resolve();
    if (_initAppStorePromise) return _initAppStorePromise;

    _initAppStorePromise = (async () => {
        console.log("🔄 جاري تهيئة نظام Store عبر IndexedDB...");
        
        // ضمان وجود الداتابيز أو إنشائها وتوحيد المرجع مع window.db
        if (typeof window.db !== 'undefined' && window.db) {
            window.bayanDB = window.db;
        } else if (typeof Dexie !== 'undefined') {
            window.bayanDB = new Dexie("BayanDatabase");
            window.bayanDB.version(101).stores({
                products: "++id, name, barcode, category",
                transactions: "++id, dateISO, type, partner, invoiceId",
                accounts: "++id, name, type, code",
                settings: "id",
                trash: "++id, type, deletedAt",
                users: "++id, name, pin",
                auditLogs: "++id, timestamp, action",
                backups: "++id, timestamp",
                wallpapers: "name",
                treasuryAudit: "++id, date, category",
                syncQueue: "++id, timestamp, action, type, status",
                warehouses: "++id, name"
            });

            try {
                await window.bayanDB.open();
                window.db = window.bayanDB;
            } catch (openError) {
                console.error("⚠️ خطأ في فتح قاعدة البيانات IndexedDB:", openError);
            }
        }

        if (window.bayanDB && window.bayanDB.settings) {
            try {
                // جلب كافة الإعدادات المحفوظة من IndexedDB إلى الذاكرة السريعة
                const allSettings = await window.bayanDB.settings.toArray();
                allSettings.forEach(item => {
                    if (item && item.id) {
                        window.AppStore[item.id] = item.value;
                    }
                });

                // تفريغ وترحيل أي بيانات متبقية قديمة من localStorage إلى IndexedDB لمرة واحدة دفعة واحدة
                if (typeof localStorage !== 'undefined' && Object.keys(localStorage).length > 0) {
                    const toMigrate = [];
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        const value = localStorage.getItem(key);
                        if (key && window.AppStore[key] === undefined) {
                            window.AppStore[key] = value;
                            toMigrate.push({ id: key, value: value });
                        }
                    }
                    if (toMigrate.length > 0) {
                        await window.bayanDB.settings.bulkPut(toMigrate);
                    }
                    try {
                        localStorage.clear();
                    } catch (e) {}
                }

                isAppStoreInitialized = true;
                console.log("✅ تم تجهيز الـ Store عبر IndexedDB بنجاح:", Object.keys(window.AppStore).length, "عنصر محمل.");
            } catch (error) {
                console.error("❌ خطأ أثناء تهيئة الـ Store من IndexedDB:", error);
            }
        } else {
            console.error("❌ جدول settings في IndexedDB غير متوفر.");
        }
    })();

    return _initAppStorePromise;
}

// دالة قراءة متزامنة فائقة السرعة من الذاكرة (المحمّلة والمطابقة 100% مع IndexedDB)
function getStore(key) {
    if (window.AppStore && window.AppStore.hasOwnProperty(key) && window.AppStore[key] !== null && window.AppStore[key] !== undefined) {
        return window.AppStore[key];
    }
    return null;
}

// دالة كتابة (تحفظ في الذاكرة فوراً وتُسجّل في قاعدة بيانات IndexedDB دون لمس localStorage مطلقاً)
function setStore(key, value) {
    if (!window.AppStore) window.AppStore = {};
    window.AppStore[key] = value;
    
    const dbInstance = window.bayanDB || window.db;
    if (dbInstance && dbInstance.settings) {
        const storedVal = (typeof value === 'object' && value !== null) ? JSON.stringify(value) : String(value);
        dbInstance.settings.put({ id: key, value: storedVal }).catch(err => {
            console.error(`❌ خطأ في حفظ الإعداد [${key}] داخل IndexedDB:`, err);
        });
    }
}

// دالة مسح إعداد من IndexedDB والذاكرة
function removeStore(key) {
    if (window.AppStore && window.AppStore.hasOwnProperty(key)) {
        delete window.AppStore[key];
    }
    
    const dbInstance = window.bayanDB || window.db;
    if (dbInstance && dbInstance.settings) {
        dbInstance.settings.delete(key).catch(err => {
            console.error(`❌ خطأ في حذف الإعداد [${key}] من IndexedDB:`, err);
        });
    }
}

// دالة تنظيف كاملة للإعدادات من IndexedDB
async function clearStore() {
    window.AppStore = {};
    const dbInstance = window.bayanDB || window.db;
    if (dbInstance && dbInstance.settings) {
        try {
            await dbInstance.settings.clear();
            console.log("🗑️ تم مسح كافة الإعدادات من IndexedDB بنجاح.");
        } catch (error) {
            console.error("❌ خطأ في مسح الإعدادات من IndexedDB:", error);
        }
    }
}
