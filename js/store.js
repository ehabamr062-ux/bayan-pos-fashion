/**
 * Bayan POS - Store Manager (100% IndexedDB Powered)
 * نظام إدارة الإعدادات والبيانات في الذاكرة ومزامنتها لحظياً مع IndexedDB (Dexie)
 * استبدالاً كاملاً لـ localStorage بدون أي اعتماد على مساحة المتصفح المؤقتة.
 */

window.AppStore = {};
window.bayanDB = null;

// دالة التهيئة الأولية (تستدعى مرة واحدة عند بدء التطبيق)
async function initAppStore() {
    console.log("🔄 جاري تهيئة نظام Store المرتبط بـ IndexedDB...");
    
    // ضمان وجود الداتابيز أو إنشائها وتوحيد المرجع مع window.db
    if (typeof window.db !== 'undefined' && window.db) {
        window.bayanDB = window.db;
    } else if (typeof Dexie !== 'undefined') {
        window.bayanDB = new Dexie("BayanDatabase");
        window.bayanDB.version(100).stores({
            products: "++id, name, barcode, category",
            transactions: "++id, dateISO, type, partner, invoiceId",
            accounts: "++id, name, type, code",
            settings: "id", // سيتم حفظ المفاتيح هنا كـ id والقيمة في حقل value
            trash: "++id, type, deletedAt",
            users: "++id, name, pin",
            auditLogs: "++id, timestamp, action",
            backups: "++id, timestamp",
            wallpapers: "name",
            treasuryAudit: "++id, date, category"
        });

        try {
            await window.bayanDB.open();
            window.db = window.bayanDB;
        } catch (openError) {
            console.error("⚠️ خطأ في فتح قاعدة البيانات IndexedDB:", openError);
        }
    }

    if (window.bayanDB) {
        try {
            // جلب كافة الإعدادات المحفوظة من IndexedDB إلى الذاكرة
            const allSettings = await window.bayanDB.settings.toArray();
            let hasMigrated = false;

            allSettings.forEach(item => {
                let parsedVal = item.value;
                if (typeof item.value === 'string' && (item.value.startsWith('{') || item.value.startsWith('['))) {
                    try {
                        parsedVal = JSON.parse(item.value);
                    } catch(e) {
                        parsedVal = item.value;
                    }
                }
                window.AppStore[item.id] = parsedVal;
            });

            // عملية التهجير الشامل (Migration) من localStorage إلى IndexedDB لمرة واحدة
            if (typeof localStorage !== 'undefined' && Object.keys(localStorage).length > 0) {
                console.log("📦 يتم الآن نقل البيانات المتبقية من localStorage إلى IndexedDB...");
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    const rawVal = localStorage.getItem(key);
                    let valToSave = rawVal;
                    if (typeof rawVal === 'string' && (rawVal.startsWith('{') || rawVal.startsWith('['))) {
                        try { valToSave = JSON.parse(rawVal); } catch(e) { valToSave = rawVal; }
                    }
                    
                    window.AppStore[key] = valToSave; // إضافتها للذاكرة
                    
                    // حفظها في IndexedDB
                    await window.bayanDB.settings.put({ 
                        id: key, 
                        value: typeof valToSave === 'object' ? JSON.stringify(valToSave) : String(valToSave) 
                    });
                    hasMigrated = true;
                }
                
                // تنظيف localStorage بعد التهجير لتوفير المساحة ومنع استخدامه نهائياً
                if (hasMigrated) {
                    localStorage.clear();
                    console.log("✅ تم تفريغ وحذف localStorage بالكامل.");
                }
            }

            console.log("✅ تم تجهيز الـ Store بنجاح من IndexedDB:", Object.keys(window.AppStore).length, "عنصر محمل.");
        } catch (error) {
            console.error("❌ خطأ أثناء تهيئة الـ Store أو تهجير البيانات:", error);
        }
    } else {
        console.error("❌ مكتبة Dexie غير متوفرة. الـ Store لن يعمل بشكل صحيح.");
    }
}

// دالة قراءة (متزامنة فائقة السرعة من الذاكرة)
function getStore(key) {
    if (!key) return null;
    if (window.AppStore.hasOwnProperty(key)) {
        const val = window.AppStore[key];
        // إذا كانت القيمة نصية مصفوفة أو كائن بصيغة JSON نرجعها كما هي لضمان التوافق التام
        if (typeof val === 'object' && val !== null) {
            return JSON.stringify(val);
        }
        return val;
    }
    return null;
}

// دالة قراءة كائن مفكك مباشرة (Parsed Object/Array)
function getStoreObject(key, defaultValue = null) {
    if (!key || !window.AppStore.hasOwnProperty(key)) return defaultValue;
    const val = window.AppStore[key];
    if (typeof val === 'object' && val !== null) return val;
    if (typeof val === 'string') {
        try { return JSON.parse(val); } catch(e) { return defaultValue; }
    }
    return val !== undefined ? val : defaultValue;
}

// دالة كتابة (تحفظ في الذاكرة فوراً وتحدث IndexedDB لحظياً)
function setStore(key, value) {
    if (!key) return;
    
    let storedVal = value;
    let dbValue = value;

    if (typeof value === 'object' && value !== null) {
        dbValue = JSON.stringify(value);
        storedVal = value;
    } else {
        dbValue = String(value);
        if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
            try { storedVal = JSON.parse(value); } catch(e) { storedVal = value; }
        }
    }

    // 1. التحديث اللحظي في الذاكرة لسرعة 0ms للواجهات
    window.AppStore[key] = storedVal;
    
    // 2. الحفظ في IndexedDB مباشرة
    if (window.bayanDB) {
        window.bayanDB.settings.put({ id: key, value: dbValue }).catch(err => {
            console.error(`❌ خطأ في حفظ الإعداد في IndexedDB [${key}]:`, err);
        });
    }
}

// دالة مسح إعداد
function removeStore(key) {
    if (!key) return;
    
    // 1. المسح من الذاكرة
    if (window.AppStore.hasOwnProperty(key)) {
        delete window.AppStore[key];
    }
    
    // 2. المسح من IndexedDB
    if (window.bayanDB) {
        window.bayanDB.settings.delete(key).catch(err => {
            console.error(`❌ خطأ في حذف الإعداد من IndexedDB [${key}]:`, err);
        });
    }
}

// دالة تنظيف كاملة للإعدادات
async function clearStore() {
    window.AppStore = {};
    if (window.bayanDB) {
        try {
            await window.bayanDB.settings.clear();
            console.log("🗑️ تم مسح كافة الإعدادات من IndexedDB بنجاح.");
        } catch (error) {
            console.error("❌ خطأ في مسح الإعدادات من IndexedDB:", error);
        }
    }
}

// توفير وصول عام للدوال
window.initAppStore = initAppStore;
window.getStore = getStore;
window.getStoreObject = getStoreObject;
window.setStore = setStore;
window.removeStore = removeStore;
window.clearStore = clearStore;
