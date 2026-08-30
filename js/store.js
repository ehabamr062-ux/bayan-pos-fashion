/**
 * Bayan POS - Store Manager
 * نظام وسيط لإدارة الإعدادات والبيانات الخفيفة في الذاكرة ومزامنتها مع IndexedDB (Dexie)
 * استبدالاً لـ localStorage لتحسين الأداء وتوحيد قاعدة البيانات.
 */

window.AppStore = {};
window.bayanDB = null;

// دالة التهيئة الأولية (تستدعى مرة واحدة عند بدء التطبيق)
async function initAppStore() {
    console.log("🔄 جاري تهيئة نظام Store...");
    
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
                window.AppStore[item.id] = item.value;
            });

            // عملية التهجير (Migration) من localStorage إلى IndexedDB لمرة واحدة
            if (Object.keys(localStorage).length > 0) {
                console.log("📦 يتم الآن نقل البيانات من localStorage إلى IndexedDB...");
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    const value = localStorage.getItem(key);
                    
                    window.AppStore[key] = value; // إضافتها للذاكرة
                    
                    // حفظها في IndexedDB
                    await window.bayanDB.settings.put({ id: key, value: value });
                    hasMigrated = true;
                }
                
                // تنظيف localStorage بعد التهجير لتوفير المساحة
                if (hasMigrated) {
                    localStorage.clear();
                    console.log("✅ تم تفريغ localStorage بنجاح.");
                }
            }

            console.log("✅ تم تجهيز الـ Store بنجاح:", Object.keys(window.AppStore).length, "عنصر محمل.");
        } catch (error) {
            console.error("❌ خطأ أثناء تهيئة الـ Store أو تهجير البيانات:", error);
        }
    } else {
        console.error("❌ مكتبة Dexie غير متوفرة. الـ Store لن يعمل بشكل صحيح.");
    }
}

// دالة قراءة (متزامنة)
function getStore(key) {
    return window.AppStore.hasOwnProperty(key) ? window.AppStore[key] : null;
}

// دالة كتابة (تحفظ في الذاكرة فوراً وفي IndexedDB في الخلفية)
function setStore(key, value) {
    // 1. التحديث اللحظي في الذاكرة لضمان سرعة الواجهة
    window.AppStore[key] = value;
    
    // 2. الحفظ غير المتزامن في القاعدة
    if (window.bayanDB) {
        window.bayanDB.settings.put({ id: key, value: String(value) }).catch(err => {
            console.error(`❌ خطأ في حفظ الإعداد [${key}]:`, err);
        });
    }
}

// دالة مسح إعداد
function removeStore(key) {
    // 1. المسح من الذاكرة
    if (window.AppStore.hasOwnProperty(key)) {
        delete window.AppStore[key];
    }
    
    // 2. المسح من القاعدة
    if (window.bayanDB) {
        window.bayanDB.settings.delete(key).catch(err => {
            console.error(`❌ خطأ في حذف الإعداد [${key}]:`, err);
        });
    }
}

// دالة تنظيف كاملة للإعدادات
async function clearStore() {
    window.AppStore = {};
    if (window.bayanDB) {
        try {
            await window.bayanDB.settings.clear();
            console.log("🗑️ تم مسح كافة الإعدادات بنجاح.");
        } catch (error) {
            console.error("❌ خطأ في مسح الإعدادات:", error);
        }
    }
}
