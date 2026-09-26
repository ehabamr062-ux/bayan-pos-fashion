// =========================================================================
// 🌐 BAYAN POS - Embedded Local Network Server & Device Hub
// =========================================================================
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

let serverInstance = null;
const SERVER_PORT = 4545;
let pairedDevices = []; // [{ deviceId, deviceName, ip, pairedAt, token, status }]
let pendingPairingRequests = []; // [{ id, deviceId, deviceName, ip, requestedAt, pin }]
let inTransitTransfers = []; // Shared in-memory and persisted pending transfers cache

// 📡 اتصالات البث الحي الفوري المفتوحة (Server-Sent Events) لجميع الأجهزة المتصلة
const liveStreamClients = new Set();

function broadcastLiveStreamEvent(eventName, payload) {
    if (!liveStreamClients || liveStreamClients.size === 0) return;
    const msg = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of Array.from(liveStreamClients)) {
        try {
            client.res.write(msg);
        } catch (e) {
            liveStreamClients.delete(client);
        }
    }
}

// 🛡️ جداول الحماية من هجمات التخمين وتتبع أمان رمز الـ PIN
const pinFailedAttempts = new Map(); // ip -> failed attempts count
const pinLockouts = new Map(); // ip -> lockout expiry timestamp

function cleanExpiredPairingRequests() {
    const fiveMinAgo = Date.now() - 300000; // صلاحية رمز الـ PIN 5 دقائق كاملة لمنح المستخدم وقتاً كافياً ومريحاً
    pendingPairingRequests = pendingPairingRequests.filter(r => new Date(r.requestedAt).getTime() > fiveMinAgo);
}

// مسار حفظ بيانات الأجهزة المقترنة محلياً
const appDataPath = path.join(os.homedir(), '.bayan_pos');
const pairedDevicesFile = path.join(appDataPath, 'paired_devices.json');
const pendingTransfersFile = path.join(appDataPath, 'pending_transfers.json');

// تأكد من وجود مجلد البيانات
try {
    if (!fs.existsSync(appDataPath)) {
        fs.mkdirSync(appDataPath, { recursive: true });
    }
    if (fs.existsSync(pairedDevicesFile)) {
        pairedDevices = JSON.parse(fs.readFileSync(pairedDevicesFile, 'utf8') || '[]');
        ensureDeviceLettering();
    }
    if (fs.existsSync(pendingTransfersFile)) {
        inTransitTransfers = JSON.parse(fs.readFileSync(pendingTransfersFile, 'utf8') || '[]');
    }
} catch (e) {
    console.warn('[ServerHub] Load cache error:', e.message);
}

// 🏷️ ضمان وجود حروف أبجدية وترتيب تسلسلي دائم لجميع الأجهزة المقترنة (A, B, C, D...)
function ensureDeviceLettering() {
    const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let letterIdx = 0;
    let order = 1;
    let changed = false;
    pairedDevices.forEach(d => {
        if (d.deviceId === 'DEV-HOST') {
            if (!d.terminalLetter) { d.terminalLetter = 'MASTER'; changed = true; }
            if (d.pairingOrder !== 0) { d.pairingOrder = 0; changed = true; }
            return;
        }
        if (!d.terminalLetter) {
            d.terminalLetter = LETTERS[letterIdx % LETTERS.length];
            changed = true;
        }
        if (!d.pairingOrder) {
            d.pairingOrder = order;
            changed = true;
        }
        if (!d.deviceName || d.deviceName.startsWith('تابلت') || d.deviceName.startsWith('جهاز فرعي') || d.deviceName === 'جهاز مقترن') {
            d.deviceName = `كاشير فرعي (${d.terminalLetter}) 📱`;
            changed = true;
        }
        letterIdx++;
        order++;
    });
    if (changed) {
        savePairedDevices();
    }
}

function updatePairedDeviceName(deviceId, newName) {
    const dev = pairedDevices.find(d => d.deviceId === deviceId);
    if (dev) {
        dev.deviceName = (newName || '').trim() || `كاشير فرعي (${dev.terminalLetter || 'A'}) 📱`;
        savePairedDevices();
        return true;
    }
    return false;
}

function savePairedDevices() {
    try {
        fs.writeFileSync(pairedDevicesFile, JSON.stringify(pairedDevices, null, 2), 'utf8');
    } catch (e) {
        console.error('[ServerHub] Save paired devices error:', e.message);
    }
}

function savePendingTransfers() {
    try {
        fs.writeFileSync(pendingTransfersFile, JSON.stringify(inTransitTransfers, null, 2), 'utf8');
    } catch (e) {
        console.error('[ServerHub] Save pending transfers error:', e.message);
    }
}

function getLocalIPAddress() {
    const interfaces = os.networkInterfaces();
    const validIPs = [];
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                const ip = iface.address;
                // استبعاد عناوين الـ APIPA التلقائية غير المتصلة بالراوتر
                if (!ip.startsWith('169.254.')) {
                    if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
                        return ip;
                    }
                    validIPs.push(ip);
                }
            }
        }
    }
    return validIPs.length > 0 ? validIPs[0] : '127.0.0.1';
}

let masterDbData = {
    products: [],
    accounts: [],
    transactions: [],
    settings: {},
    users: [],
    trash: [],
    treasuryAudit: [],
    lastUpdated: new Date().toISOString()
};
const masterDbFile = path.join(appDataPath, 'master_sync_db.json');

// 🚀 تحميل غير متزامن في الخلفية لضمان عدم حجز أو تجميد ثواني تشغيل البرنامج الأولى
function loadMasterDbAsync() {
    fs.readFile(masterDbFile, 'utf8', (err, data) => {
        if (!err && data) {
            try {
                masterDbData = JSON.parse(data || '{}');
            } catch (e) {
                console.warn('[ServerHub] Parse master db error:', e.message);
            }
        }
    });
}
if (typeof setImmediate === 'function') {
    setImmediate(loadMasterDbAsync);
} else {
    setTimeout(loadMasterDbAsync, 50);
}

let isSavingMasterDb = false;
let pendingSaveMasterDb = false;
let saveMasterDbDebounceTimer = null;
let masterDbIsDirty = false;

// 🛡️ حفظ هادئ في الخلفية يحمي القرص الصلب من الكتابة المتكررة مع كل فاتورة صغيرة
function saveMasterDb(immediate = false) {
    masterDbIsDirty = true;
    if (immediate) {
        if (saveMasterDbDebounceTimer) clearTimeout(saveMasterDbDebounceTimer);
        _doSaveMasterDb();
        return;
    }
    if (saveMasterDbDebounceTimer) {
        clearTimeout(saveMasterDbDebounceTimer);
    }
    // مهلة 5 ثوانٍ لتجميع الحركات بهدوء تام دون أي ضغط على I/O أو الرامات
    saveMasterDbDebounceTimer = setTimeout(() => {
        if (masterDbIsDirty) {
            _doSaveMasterDb();
        }
    }, 5000);
}

function _doSaveMasterDb() {
    if (isSavingMasterDb) {
        pendingSaveMasterDb = true;
        return;
    }
    isSavingMasterDb = true;
    masterDbIsDirty = false;
    try {
        const jsonStr = JSON.stringify(masterDbData);
        fs.writeFile(masterDbFile, jsonStr, 'utf8', (err) => {
            isSavingMasterDb = false;
            if (err) {
                console.error('[ServerHub] Save master db error:', err.message);
            }
            if (pendingSaveMasterDb) {
                pendingSaveMasterDb = false;
                _doSaveMasterDb();
            }
        });
    } catch (e) {
        isSavingMasterDb = false;
        console.error('[ServerHub] Save master db sync error:', e.message);
    }
}

const DEVICE_LOCAL_SETTINGS_KEYS = new Set([
    'bayan_terminal_role',
    'bayan_client_device_id',
    'bayan_client_device_token',
    'bayan_client_is_paired',
    'bayan_local_server_url',
    'bayan_is_master_terminal',
    'bayan_hwid',
    'hwid',
    'bayan_device_prefix',
    'bayan_user_name',
    'bayan_user_warehouse',
    'pos_session_user',
    'bayan_install_date',
    'bayan_paid_start_date',
    'bayan_sub_transfer_phone',
    'bayan_purged_trash_ids',
    'license_info',
    'bayan_license_info',
    'bayan_active_license',
    'bayan_master_license',
    'bayan_master_hwid',
    'bayan_machine_id',
    'bayan_max_seen_timestamp',
    'bayan_expiry_date'
]);

function getTerminalKey(t) {
    if (!t) return 'HOST';
    return String(t.terminalId || t.terminalLetter || t.terminal || 'HOST').trim();
}

function getDetailedInvoiceType(typeStr) {
    const s = String(typeStr || '').toLowerCase();
    if (s.includes('مرتجع شراء') || s.includes('purchase_return')) return 'purchase_return';
    if (s.includes('مرتجع') || s.includes('sales_return') || s.includes('return')) return 'sales_return';
    if (s.includes('شراء') || s.includes('purchase')) return 'purchase';
    if (s.includes('بيع') || s.includes('sale')) return 'sale';
    if (s.includes('قبض') || s.includes('receipt')) return 'receipt';
    if (s.includes('صرف') || s.includes('payment') || s.includes('disbursement')) return 'disbursement';
    if (s.includes('تحويل') || s.includes('transfer')) return 'transfer';
    if (s.includes('تسوية') || s.includes('adjustment')) return 'adjustment';
    if (s.includes('رصيد اول') || s.includes('opening')) return 'opening';
    return s.trim() || 'other';
}

function getTrashedTransactionKeys(trashList = []) {
    const keySet = new Set();
    const invIdSet = new Set();
    if (!Array.isArray(trashList)) return { keySet, invIdSet };

    trashList.forEach(t => {
        if (!t) return;
        const tp = String(t.type || '').toLowerCase();
        if (tp.includes('transaction') || tp.includes('invoice') || tp.includes('فاتورة') || tp.includes('حركة') || tp.includes('sale') || tp.includes('purchase')) {
            const data = t.originalData || t;
            const items = Array.isArray(data) ? data : (data.items ? data.items : [data]);
            items.forEach(it => {
                if (!it) return;
                const term = getTerminalKey(it);
                const dType = getDetailedInvoiceType(it.type);
                if (it.id) {
                    keySet.add(`term_${term}_id_${it.id}`);
                    keySet.add(`id_${it.id}`);
                    keySet.add(String(it.id));
                }
                if (it.invoiceId != null && it.invoiceId !== '') {
                    invIdSet.add(`${term}__${dType}__${it.invoiceId}`);
                    if (!it.terminalId && !it.terminalLetter) {
                        invIdSet.add(`${dType}__${it.invoiceId}`);
                    }
                }
                const inv = it.invoiceId || '';
                const prod = it.product || it.productName || '';
                const s = it.size || it.selectedSize || '';
                const c = it.color || it.selectedColor || '';
                const d = it.dateISO || it.date || '';
                const tm = it.timeISO || it.time || '';
                const wh = it.warehouse || '';
                const qty = it.qty || 0;
                keySet.add(`tx_${term}_${dType}_${inv}_${prod}_${s}_${c}_${d}_${tm}_${wh}_${qty}`);
                keySet.add(`tx_${inv}_${prod}_${s}_${c}_${d}_${tm}_${wh}_${qty}`);
            });
        }
    });
    return { keySet, invIdSet };
}

function mergeTransactions(existingList = [], incomingList = [], trashList = [], isMasterPush = false, isDelta = false) {
    const { keySet: trashedKeys, invIdSet: trashedInvIds } = getTrashedTransactionKeys(trashList);

    const isTrashed = (t) => {
        if (!t) return true;
        const term = getTerminalKey(t);
        const dType = getDetailedInvoiceType(t.type);
        if (t.id && (trashedKeys.has(`term_${term}_id_${t.id}`) || trashedKeys.has(`id_${t.id}`) || trashedKeys.has(String(t.id)))) return true;
        if (t.invoiceId != null && t.invoiceId !== '') {
            if (trashedInvIds.has(`${term}__${dType}__${t.invoiceId}`) || trashedInvIds.has(`${dType}__${t.invoiceId}`)) {
                return true;
            }
        }
        const inv = t.invoiceId || '';
        const prod = t.product || t.productName || '';
        const s = t.size || t.selectedSize || '';
        const c = t.color || t.selectedColor || '';
        const d = t.dateISO || t.date || '';
        const tm = t.timeISO || t.time || '';
        const wh = t.warehouse || '';
        const qty = t.qty || 0;
        const compKey = `tx_${term}_${dType}_${inv}_${prod}_${s}_${c}_${d}_${tm}_${wh}_${qty}`;
        const legacyCompKey = `tx_${inv}_${prod}_${s}_${c}_${d}_${tm}_${wh}_${qty}`;
        return trashedKeys.has(compKey) || trashedKeys.has(legacyCompKey);
    };

    const cleanIncoming = (Array.isArray(incomingList) ? incomingList : []).filter(t => !isTrashed(t));

    // ⚡ تسريع فائق: إذا كان الماستر يقوم بدفع كامل قاعدة بياناته، نعتمد حركاته المعتمدة مباشرة في O(N)
    if (isMasterPush && !isDelta && Array.isArray(incomingList)) {
        return cleanIncoming;
    }

    const cleanExisting = (Array.isArray(existingList) ? existingList : []).filter(t => !isTrashed(t));

    if (cleanExisting.length === 0) return cleanIncoming;
    if (cleanIncoming.length === 0) return cleanExisting;

    // 1. تحديد أرقام الفواتير الواردة مفصولة بالطرف المصدر (الجهاز) ونوع الفاتورة الدقيق
    const incomingInvoiceKeys = new Set();
    cleanIncoming.forEach(t => {
        if (t && t.invoiceId != null && t.invoiceId !== '') {
            const term = getTerminalKey(t);
            const dType = getDetailedInvoiceType(t.type);
            incomingInvoiceKeys.add(`${term}__${dType}__${t.invoiceId}`);
        }
    });

    const map = new Map();
    const getKey = (t) => {
        if (!t) return '';
        const term = getTerminalKey(t);
        const dType = getDetailedInvoiceType(t.type);
        if (t.id && t.invoiceId != null && t.invoiceId !== '') {
            return `term_${term}_type_${dType}_inv_${t.invoiceId}_id_${t.id}`;
        }
        if (t.id) {
            return `term_${term}_type_${dType}_id_${t.id}`;
        }
        const inv = t.invoiceId || '';
        const prod = t.product || t.productName || '';
        const s = t.size || t.selectedSize || '';
        const c = t.color || t.selectedColor || '';
        const d = t.dateISO || t.date || '';
        const tm = t.timeISO || t.time || '';
        const wh = t.warehouse || '';
        const qty = t.qty || 0;
        return `tx_${term}_${dType}_${inv}_${prod}_${s}_${c}_${d}_${tm}_${wh}_${qty}`;
    };

    // 2. إضافة حركات القائمة السابقة مع حجب النسخ القديمة لنفس الفاتورة من نفس الجهاز ونفس النوع عند ورود تحديث لها
    cleanExisting.forEach(t => {
        if (!t) return;
        if (t.invoiceId != null && t.invoiceId !== '') {
            const term = getTerminalKey(t);
            const dType = getDetailedInvoiceType(t.type);
            if (incomingInvoiceKeys.has(`${term}__${dType}__${t.invoiceId}`)) {
                // الفاتورة وردت بنسخة أحدث من نفس الجهاز ونفس النوع، نستبعد النسخة القديمة لصالح الأحدث
                return;
            }
        }
        const k = getKey(t);
        if (k) map.set(k, t);
    });

    // 3. إضافة كافة الحركات الواردة
    cleanIncoming.forEach(t => {
        const k = getKey(t);
        if (!k) return;
        if (!map.has(k)) {
            map.set(k, t);
        } else {
            const existing = map.get(k);
            map.set(k, { ...existing, ...t });
        }
    });

    return Array.from(map.values()).filter(t => !isTrashed(t));
}

function getTrashedProductKeys(trashList = []) {
    const set = new Set();
    if (!Array.isArray(trashList)) return set;
    trashList.forEach(t => {
        if (!t) return;
        const tp = String(t.type || '').toLowerCase();
        if (tp.includes('product') || tp.includes('inventory') || tp.includes('صنف') || tp.includes('بضاعة')) {
            const d = t.originalData || t;
            const items = Array.isArray(d) ? d : [d];
            items.forEach(it => {
                if (!it) return;
                if (it.id) set.add(String(it.id));
                if (it.barcode) set.add(String(it.barcode).trim());
            });
        }
    });
    return set;
}

function mergeProducts(existingList = [], incomingList = [], trashList = [], isMasterPush = false) {
    const trashedKeys = getTrashedProductKeys(trashList);

    if (!Array.isArray(existingList) || existingList.length === 0) {
        return (Array.isArray(incomingList) ? incomingList : []).filter(p => p && !trashedKeys.has(String(p.id)) && !trashedKeys.has(String(p.barcode || '').trim()));
    }
    if (!Array.isArray(incomingList) || incomingList.length === 0) {
        return existingList.filter(p => p && !trashedKeys.has(String(p.id)) && !trashedKeys.has(String(p.barcode || '').trim()));
    }

    const map = new Map();
    const getKey = (p) => p.id || p.barcode || p.name;

    existingList.forEach(p => {
        const k = getKey(p);
        if (k && !trashedKeys.has(String(k))) map.set(String(k), p);
    });

    incomingList.forEach(p => {
        const k = getKey(p);
        if (!k || trashedKeys.has(String(k))) return;
        const sKey = String(k);
        if (!map.has(sKey)) {
            map.set(sKey, p);
        } else {
            const existing = map.get(sKey);

            // دمج أرصدة المخازن لكل مخزن على حدة بدقة
            const mergedWhStocks = { ...(existing.warehouseStocks || {}) };
            if (p.warehouseStocks && typeof p.warehouseStocks === 'object') {
                Object.keys(p.warehouseStocks).forEach(wh => {
                    const incQty = parseFloat(p.warehouseStocks[wh]);
                    if (!isNaN(incQty)) {
                        mergedWhStocks[wh] = incQty;
                    }
                });
            }

            // دمج تشكيلات المقاسات والألوان وتكلفة وأرصدة كل تشكيلة
            let mergedVariants = p.variants || existing.variants;
            if (Array.isArray(existing.variants) && Array.isArray(p.variants)) {
                const varMap = new Map();
                existing.variants.forEach(v => varMap.set(`${v.size}_${v.color}`, v));
                p.variants.forEach(v => {
                    const vk = `${v.size}_${v.color}`;
                    if (!varMap.has(vk)) {
                        varMap.set(vk, v);
                    } else {
                        const ev = varMap.get(vk);
                        const vWhStocks = { ...(ev.warehouseStocks || {}) };
                        if (v.warehouseStocks && typeof v.warehouseStocks === 'object') {
                            Object.keys(v.warehouseStocks).forEach(wh => {
                                const iq = parseFloat(v.warehouseStocks[wh]);
                                if (!isNaN(iq)) {
                                    vWhStocks[wh] = iq;
                                }
                            });
                        }
                        const vTotalStock = Object.keys(vWhStocks).length > 0
                            ? Object.values(vWhStocks).reduce((sum, q) => sum + (parseFloat(q) || 0), 0)
                            : (v.stock !== undefined ? v.stock : ev.stock);

                        varMap.set(vk, { 
                            ...ev, 
                            ...v, 
                            warehouseStocks: vWhStocks,
                            stock: vTotalStock,
                            cost: v.cost !== undefined ? v.cost : ev.cost
                        });
                    }
                });
                mergedVariants = Array.from(varMap.values());
            }

            // حساب الرصيد الإجمالي للصنف عبر جميع المخازن
            const totalStock = Object.keys(mergedWhStocks).length > 0
                ? Object.values(mergedWhStocks).reduce((sum, q) => sum + (parseFloat(q) || 0), 0)
                : (p.stock !== undefined ? p.stock : existing.stock);

            if (isMasterPush) {
                map.set(sKey, {
                    ...existing,
                    ...p,
                    stock: totalStock,
                    warehouseStocks: mergedWhStocks,
                    variants: mergedVariants
                });
            } else {
                map.set(sKey, {
                    ...existing,
                    stock: totalStock,
                    warehouseStocks: mergedWhStocks,
                    variants: mergedVariants
                });
            }
        }
    });

    return Array.from(map.values()).filter(p => p && !trashedKeys.has(String(p.id)) && !trashedKeys.has(String(p.barcode || '').trim()));
}

function getTrashedAccountKeys(trashList = []) {
    const set = new Set();
    if (!Array.isArray(trashList)) return set;
    trashList.forEach(t => {
        if (!t) return;
        const tType = String(t.type || '').toLowerCase();
        if (tType.includes('account') || tType.includes('عميل') || tType.includes('مورد') || tType.includes('حساب')) {
            const d = t.originalData || t;
            const items = Array.isArray(d) ? d : [d];
            items.forEach(it => {
                if (!it) return;
                if (it.id) set.add(String(it.id));
                if (it.name) set.add(String(it.name).trim());
            });
        }
    });
    return set;
}

function mergeAccounts(existingList = [], incomingList = [], trashList = [], isMasterPush = false, isDelta = false) {
    const trashedKeys = getTrashedAccountKeys(trashList);

    if (isMasterPush && !isDelta && Array.isArray(incomingList)) {
        return incomingList.filter(a => a && !trashedKeys.has(String(a.id)) && !trashedKeys.has(String(a.name || '').trim()));
    }

    if (!Array.isArray(existingList) || existingList.length === 0) {
        return (Array.isArray(incomingList) ? incomingList : []).filter(a => a && !trashedKeys.has(String(a.id)) && !trashedKeys.has(String(a.name || '').trim()));
    }
    if (!Array.isArray(incomingList) || incomingList.length === 0) {
        return existingList.filter(a => a && !trashedKeys.has(String(a.id)) && !trashedKeys.has(String(a.name || '').trim()));
    }

    const map = new Map();
    const getKey = (a) => a.id || a.code || a.name;

    existingList.forEach(a => {
        const k = getKey(a);
        if (k && !trashedKeys.has(String(k))) map.set(String(k), a);
    });

    incomingList.forEach(a => {
        const k = getKey(a);
        if (!k || trashedKeys.has(String(k))) return;
        const sKey = String(k);
        if (!map.has(sKey)) {
            map.set(sKey, a);
        } else {
            const existing = map.get(sKey);
            map.set(sKey, { ...existing, ...a });
        }
    });

    return Array.from(map.values()).filter(a => a && !trashedKeys.has(String(a.id)) && !trashedKeys.has(String(a.name || '').trim()));
}

function mergeTrash(existingList = [], incomingList = [], purgedTrashIds = [], isMasterPush = false) {
    const purgedSet = new Set((Array.isArray(purgedTrashIds) ? purgedTrashIds : []).map(id => String(id)));

    // إذا كان الماستر يرسل سلة فارغة ومعه purgedTrashIds أو تأكيد مسح الماستر
    if (isMasterPush && Array.isArray(incomingList)) {
        return incomingList.filter(it => it && !purgedSet.has(String(it.id)) && !purgedSet.has(`${it.type}_${it.label}_${it.deletedAt}`));
    }

    const map = new Map();
    const getKey = (item) => item.id || `${item.type}_${item.label}_${item.deletedAt}`;

    (Array.isArray(existingList) ? existingList : []).forEach(it => {
        const k = getKey(it);
        if (k && !purgedSet.has(String(k)) && !purgedSet.has(String(it.id))) {
            map.set(String(k), it);
        }
    });

    (Array.isArray(incomingList) ? incomingList : []).forEach(it => {
        const k = getKey(it);
        if (!k || purgedSet.has(String(k)) || purgedSet.has(String(it.id))) return;
        const sKey = String(k);
        if (!map.has(sKey)) {
            map.set(sKey, it);
        }
    });

    return Array.from(map.values()).filter(it => it && !purgedSet.has(String(it.id)) && !purgedSet.has(String(getKey(it))));
}

function getTrashedUserKeys(trashList = []) {
    const set = new Set();
    if (!Array.isArray(trashList)) return set;
    trashList.forEach(t => {
        if (!t) return;
        const tp = String(t.type || '').toLowerCase();
        if (tp.includes('user') || tp.includes('مستخدم')) {
            const d = t.originalData || t;
            if (d.id) set.add(String(d.id));
            if (d.name) set.add(String(d.name).trim());
            if (d.pin) set.add(String(d.pin).trim());
        }
    });
    return set;
}

function mergeUsers(existingList = [], incomingList = [], trashList = [], isMasterPush = false) {
    const trashedKeys = getTrashedUserKeys(trashList);

    if (isMasterPush && Array.isArray(incomingList) && incomingList.length > 0) {
        return incomingList.filter(u => u && (u.id === 1 || (!trashedKeys.has(String(u.id)) && !trashedKeys.has(String(u.name || '').trim()))));
    }

    const map = new Map();
    const getKey = (u) => u.id ? `id_${u.id}` : (u.name || u.pin);

    (Array.isArray(existingList) ? existingList : []).forEach(u => {
        if (!u) return;
        if (u.id !== 1 && (trashedKeys.has(String(u.id)) || trashedKeys.has(String(u.name || '').trim()))) return;
        const k = getKey(u);
        if (k) map.set(k, u);
    });

    (Array.isArray(incomingList) ? incomingList : []).forEach(u => {
        if (!u) return;
        if (u.id !== 1 && (trashedKeys.has(String(u.id)) || trashedKeys.has(String(u.name || '').trim()))) return;
        // صمام أمان حديدي: حماية حساب المدير (ID: 1) من التعديل أو التجميد بواسطة أي جهاز فرعي
        if (!isMasterPush && (u.id === 1 || u.name === 'المدير' || u.role === 'admin')) {
            return;
        }
        const k = getKey(u);
        if (!k) return;
        if (!map.has(k)) {
            map.set(k, u);
        } else {
            const existing = map.get(k);
            map.set(k, { ...existing, ...u });
        }
    });

    const result = Array.from(map.values()).filter(u => u && (u.id === 1 || (!trashedKeys.has(String(u.id)) && !trashedKeys.has(String(u.name || '').trim()))));
    return result.length > 0 ? result : (existingList || []);
}

function getTrashedWarehouseKeys(trashList = []) {
    const set = new Set();
    if (!Array.isArray(trashList)) return set;
    trashList.forEach(t => {
        if (!t) return;
        const tp = String(t.type || '').toLowerCase();
        if (tp.includes('warehouse') || tp.includes('مخزن')) {
            const d = t.originalData || t;
            const w = d.warehouse || d;
            if (w.id) set.add(String(w.id));
            if (w.name) set.add(String(w.name).trim());
        }
    });
    return set;
}

function mergeWarehouses(existingList = [], incomingList = [], trashList = [], isMasterPush = false) {
    const trashedKeys = getTrashedWarehouseKeys(trashList);

    if (isMasterPush && Array.isArray(incomingList) && incomingList.length > 0) {
        return incomingList.filter(w => w && !trashedKeys.has(String(w.id)) && !trashedKeys.has(String(w.name || '').trim()));
    }

    const map = new Map();
    const getKey = (w) => w.name ? String(w.name).trim() : (w.id ? String(w.id) : '');

    (Array.isArray(existingList) ? existingList : []).forEach(w => {
        if (!w) return;
        const k = getKey(w);
        if (k && !trashedKeys.has(k) && !trashedKeys.has(String(w.id))) {
            map.set(k, w);
        }
    });

    (Array.isArray(incomingList) ? incomingList : []).forEach(w => {
        if (!w) return;
        const k = getKey(w);
        if (!k || trashedKeys.has(k) || trashedKeys.has(String(w.id))) return;
        if (!map.has(k)) {
            map.set(k, w);
        } else {
            const existing = map.get(k);
            map.set(k, { ...existing, ...w });
        }
    });

    const result = Array.from(map.values()).filter(w => w && !trashedKeys.has(String(w.name || '').trim()));
    if (result.length === 0) {
        result.push({ id: 1, name: 'المخزن الرئيسي', address: 'المقر الرئيسي' });
    }
    return result;
}

function mergeTreasuryAudit(existingList = [], incomingList = []) {
    if (!Array.isArray(existingList) || existingList.length === 0) return Array.isArray(incomingList) ? incomingList : [];
    if (!Array.isArray(incomingList) || incomingList.length === 0) return existingList;

    const map = new Map();
    const getKey = (item) => item.id || `${item.date}_${item.category}_${item.amount}_${item.time}`;

    existingList.forEach(it => {
        const k = getKey(it);
        if (k) map.set(String(k), it);
    });

    incomingList.forEach(it => {
        const k = getKey(it);
        if (!k) return;
        map.set(String(k), it);
    });

    return Array.from(map.values());
}

function syncInTransitFromTransactions(transactions = []) {
    if (!Array.isArray(transactions)) return;
    const resolvedInvIds = new Set();
    const pendingMap = new Map();

    transactions.forEach(t => {
        if (!t || !t.type || !String(t.type).includes('تحويل')) return;
        const invId = String(t.invoiceId || t.id || '');
        if (!invId) return;

        if (t.transferStatus === 'received' || t.transferStatus === 'rejected') {
            resolvedInvIds.add(invId);
        } else if (t.transferStatus === 'pending') {
            if (!pendingMap.has(invId)) {
                pendingMap.set(invId, {
                    id: invId,
                    invoiceId: invId,
                    sourceWarehouse: t.sourceWarehouse || 'المخزن الرئيسي',
                    warehouse: t.warehouse || '',
                    toWarehouse: t.warehouse || '',
                    date: t.date || '',
                    dateISO: t.dateISO || '',
                    timeISO: t.timeISO || '',
                    transferStatus: 'pending',
                    items: [],
                    itemsCount: 0,
                    totalValue: 0
                });
            }
            const grp = pendingMap.get(invId);
            grp.items.push({
                product: t.product || t.productName,
                size: t.size || t.selectedSize || '',
                color: t.color || t.selectedColor || '',
                qty: parseFloat(t.qty) || 1,
                unit: t.unit || 'قطعة',
                price: parseFloat(t.price) || 0
            });
            grp.itemsCount = grp.items.length;
            grp.totalValue += (parseFloat(t.qty) || 1) * (parseFloat(t.price) || 0);
        }
    });

    let changed = false;

    // 1. إزالة أي تحويلات معلقة تم استلامها أو رفضها
    const prevCount = inTransitTransfers.length;
    inTransitTransfers = inTransitTransfers.filter(t => {
        const id = String(t.id || t.invoiceId || '');
        return !resolvedInvIds.has(id);
    });
    if (inTransitTransfers.length !== prevCount) changed = true;

    // 2. تحديث أو إضافة التحويلات المعلقة
    pendingMap.forEach((tr, invId) => {
        const existingIdx = inTransitTransfers.findIndex(x => String(x.id || x.invoiceId || '') === invId);
        if (existingIdx >= 0) {
            inTransitTransfers[existingIdx] = { ...inTransitTransfers[existingIdx], ...tr };
        } else {
            inTransitTransfers.push(tr);
            changed = true;
        }
    });

    if (changed) {
        savePendingTransfers();
    }
}

function updateMasterDbData(db, sourceDeviceId = null, isMasterServer = false) {
    if (db && typeof db === 'object') {
        const isMaster = (isMasterServer === true || sourceDeviceId === 'DEV-HOST' || db.isMasterServer);
        const isDelta = (db.syncMode === 'delta' || db.isDelta === true);
        const purgedTrashIds = Array.isArray(db.purgedTrashIds) ? db.purgedTrashIds : [];
        const mergedTrash = isDelta 
            ? (masterDbData.trash || []) 
            : mergeTrash(masterDbData.trash || [], db.trash || [], purgedTrashIds, isMaster);

        // تصفية الإعدادات لحجب أي مفاتيح محلية خاصة بالجهاز (Device Local Blacklist)
        const cleanIncomingSettings = {};
        if (db.settings && typeof db.settings === 'object') {
            Object.keys(db.settings).forEach(k => {
                if (!DEVICE_LOCAL_SETTINGS_KEYS.has(k)) {
                    cleanIncomingSettings[k] = db.settings[k];
                }
            });
            // مشاركة ترخيص وكود جهاز الماستر: إذا كان التحديث قادماً من الماستر المعتمد حصرياً، يُحفظ في إعدادات السيرفر ليتم سحبه للتابلت
            if (isMaster && db.settings.bayan_master_license) {
                cleanIncomingSettings['bayan_master_license'] = db.settings.bayan_master_license;
            }
            if (isMaster && db.settings.bayan_master_hwid) {
                cleanIncomingSettings['bayan_master_hwid'] = db.settings.bayan_master_hwid;
            }
        }

        masterDbData = {
            trash: mergedTrash,
            products: mergeProducts(masterDbData.products || [], db.products || [], mergedTrash, isMaster),
            accounts: mergeAccounts(masterDbData.accounts || [], db.accounts || [], mergedTrash, isMaster, isDelta),
            transactions: mergeTransactions(masterDbData.transactions || [], db.transactions || [], mergedTrash, isMaster, isDelta),
            users: (isDelta && (!db.users || db.users.length === 0)) ? (masterDbData.users || []) : mergeUsers(masterDbData.users || [], db.users || [], mergedTrash, isMaster),
            warehouses: (isDelta && (!db.warehouses || db.warehouses.length === 0)) ? (masterDbData.warehouses || []) : mergeWarehouses(masterDbData.warehouses || [], db.warehouses || [], mergedTrash, isMaster),
            treasuryAudit: (isDelta && (!db.treasuryAudit || db.treasuryAudit.length === 0)) ? (masterDbData.treasuryAudit || []) : mergeTreasuryAudit(masterDbData.treasuryAudit || [], db.treasuryAudit || []),
            settings: (isDelta && Object.keys(cleanIncomingSettings).length === 0) ? (masterDbData.settings || {}) : { ...masterDbData.settings, ...cleanIncomingSettings },
            lastUpdated: new Date().toISOString()
        };
        const hasCriticalData = (Array.isArray(db.transactions) && db.transactions.length > 0) || (Array.isArray(db.treasuryAudit) && db.treasuryAudit.length > 0);
        saveMasterDb(hasCriticalData);
        syncInTransitFromTransactions(masterDbData.transactions);
        // بث التحديث الجزئي اللحظي فوراً لجميع الأجهزة المتصلة بدون انتظار
        broadcastLiveStreamEvent('DELTA_UPDATE', {
            db: db,
            sourceDeviceId: sourceDeviceId || 'DEV-HOST',
            lastUpdated: masterDbData.lastUpdated
        });
    }
    return masterDbData;
}

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf'
};

function startServer(appRootDir, onNotification) {
    const rootDir = (typeof appRootDir === 'string' && appRootDir.trim()) ? appRootDir : __dirname;
    if (serverInstance) {
        console.log('[ServerHub] Server is already running on port', SERVER_PORT);
        return { isRunning: true, ip: getLocalIPAddress(), port: SERVER_PORT };
    }

    serverInstance = http.createServer((req, res) => {
        try {
        const clientIp = req.socket.remoteAddress ? req.socket.remoteAddress.replace('::ffff:', '') : 'Unknown';
        const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const pathname = decodeURIComponent(parsedUrl.pathname);
        const origin = req.headers.origin;

        // التحقق من أن مصدر الطلب محلي وموثوق (Localhost, Private IPs, or Official Demo)
        // 🔒 تم استبعاد origin === 'null' لمنع أي صفحة ويب خبيثة من تنفيذ طلبات عبر iframes مجهولة
        const isTrustedOrigin = !origin || 
            /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin) ||
            /^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/i.test(origin) ||
            origin === 'https://ehabamr062-ux.github.io';

        // ضبط رؤوس CORS بحسب المصدر الموثوق
        if (origin) {
            if (isTrustedOrigin) {
                res.setHeader('Access-Control-Allow-Origin', origin);
            }
        } else {
            res.setHeader('Access-Control-Allow-Origin', '*');
        }
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Device-Id, X-Device-Token');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        // 🛡️ صمام الأمان: حظر أي طلب API خارجي قادم من موقع إنترنت غير موثوق لمنع هجمات CSRF وسحب البيانات
        if (pathname.startsWith('/api/') && origin && !isTrustedOrigin) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: '403 Forbidden: تم حظر الوصول من نطاق ويب غير مصرح به' }));
            return;
        }

        // دالة التحقق من مصادقة الأجهزة المتصلة عبر الشبكة المحلية
        function isAuthorizedDevice(req, clientIp) {
            const isLocal = (clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === 'localhost') && isTrustedOrigin;
            if (isLocal) return true;
            const token = req.headers['x-device-token'] || (parsedUrl ? parsedUrl.searchParams.get('token') : null);
            const deviceId = req.headers['x-device-id'] || (parsedUrl ? parsedUrl.searchParams.get('deviceId') : null);
            if (!token) return false;
            return pairedDevices.some(d => d.token === token && (!deviceId || d.deviceId === deviceId) && d.status === 'active');
        }

        // =========================================================================
        // 📡 1. API Endpoints
        // =========================================================================
        if (pathname.startsWith('/api/')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            let body = '';
            let bodyTooLarge = false;

            req.on('data', chunk => {
                if (bodyTooLarge) return;
                body += chunk;
                // صمام أمان لحماية الرامات والسيرفر من هجمات الإغراق (Max 50MB)
                if (body.length > 50 * 1024 * 1024) {
                    bodyTooLarge = true;
                    res.writeHead(413, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: '413 Payload Too Large: حجم البيانات المرسلة كبير جداً' }));
                    req.destroy();
                }
            });

            req.on('end', () => {
                if (bodyTooLarge) return;
                let jsonBody = {};
                try { if (body) jsonBody = JSON.parse(body); } catch (e) {}

                // أ. معلومات السيرفر
                if (pathname === '/api/server-info' && req.method === 'GET') {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        status: 'online',
                        serverName: 'Bayan POS Master Server',
                        ip: getLocalIPAddress(),
                        port: SERVER_PORT,
                        pairedCount: pairedDevices.length,
                        pendingTransfersCount: inTransitTransfers.filter(t => t.transferStatus === 'pending').length,
                        lastDbUpdate: masterDbData.lastUpdated
                    }));
                    return;
                }

                // ⚡ بث الأحداث الحية الفورية (Server-Sent Events - Live Stream)
                if (pathname === '/api/sync/live-stream' && req.method === 'GET') {
                    if (!isAuthorizedDevice(req, clientIp)) {
                        res.writeHead(401, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, message: 'غير مصرح: يجب إقران الجهاز أولاً' }));
                        return;
                    }
                    res.writeHead(200, {
                        'Content-Type': 'text/event-stream; charset=utf-8',
                        'Cache-Control': 'no-cache, no-transform',
                        'Connection': 'keep-alive',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.write(`event: connected\ndata: ${JSON.stringify({ message: 'Live stream connected successfully', timestamp: Date.now() })}\n\n`);

                    const clientObj = { req, res, clientIp };
                    liveStreamClients.add(clientObj);

                    req.on('close', () => {
                        liveStreamClients.delete(clientObj);
                    });
                    return;
                }

                // س. مزامنة البيانات الكاملة: سحب البيانات للجهاز الفرعي / التابلت (Pull All Data)
                if (pathname === '/api/sync/pull' && req.method === 'GET') {
                    if (!isAuthorizedDevice(req, clientIp)) {
                        res.writeHead(401, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, message: 'غير مصرح: يجب إقران الجهاز أولاً واعتماده من الجهاز الرئيسي' }));
                        return;
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        db: masterDbData,
                        inTransitTransfers
                    }));
                    return;
                }

                // ص. مزامنة البيانات الكاملة: إرسال تحديثات التابلت للسيرفر الرئيسي (Push Data)
                if (pathname === '/api/sync/push' && req.method === 'POST') {
                    if (!isAuthorizedDevice(req, clientIp)) {
                        res.writeHead(401, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, message: 'غير مصرح: يجب إقران الجهاز أولاً واعتماده من الجهاز الرئيسي' }));
                        return;
                    }
                    const { db, sourceDeviceId, isMasterServer } = jsonBody;

                    // 🛡️ صمام أمان حاسم: حظر انتحال صفة الجهاز الرئيسي (Master Spoofing Protection)
                    // لا يُعامل أي جهاز كماستر إلا إذا كان الاتصال قادماً حصرياً من الجهاز المحلي (Localhost)
                    const isLocalHost = (clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === 'localhost');
                    const trustedIsMaster = isLocalHost && (isMasterServer === true || sourceDeviceId === 'DEV-HOST');
                    const trustedDeviceId = trustedIsMaster ? 'DEV-HOST' : (sourceDeviceId === 'DEV-HOST' ? 'DEV-CLIENT' : (sourceDeviceId || 'DEV-CLIENT'));

                    if (db) {
                        updateMasterDbData(db, trustedDeviceId, trustedIsMaster);
                        if (typeof onNotification === 'function') {
                            onNotification('sync-data-pushed', { db: db, fullDb: masterDbData, sourceDeviceId: trustedDeviceId, clientIp });
                        }
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        lastUpdated: masterDbData.lastUpdated,
                        message: 'تمت مزامنة البيانات مع السيرفر الرئيسي بنجاح'
                    }));
                    return;
                }

                // ق1. فحص حالة منفذ جدار الحماية (Check Firewall Status)
                if (pathname === '/api/check-firewall' && req.method === 'GET') {
                    const { exec } = require('child_process');
                    exec('netsh advfirewall firewall show rule name="Bayan POS Local Server"', (err, stdout) => {
                        const isOpen = !err && stdout && stdout.includes('Enabled:') && stdout.includes('Yes') && stdout.includes('4545');
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, isOpen: !!isOpen }));
                    });
                    return;
                }

                // ق2. فتح منفذ السيرفر في جدار حماية ويندوز تلقائياً (Fix Firewall) - مقصور على الماستر محلياً
                if (pathname === '/api/fix-firewall' && req.method === 'POST') {
                    const isLocal = (clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === 'localhost') && isTrustedOrigin;
                    if (!isLocal) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, message: 'ممنوع: لا يمكن تنفيذ هذا الإجراء إلا من الجهاز الرئيسي محلياً عبر نطاق موثوق' }));
                        return;
                    }
                    const { exec } = require('child_process');
                    const cmd = 'powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd -ArgumentList \'/c netsh advfirewall firewall delete rule name=\\\"Bayan POS Local Server\\\" & netsh advfirewall firewall add rule name=\\\"Bayan POS Local Server\\\" dir=in action=allow protocol=TCP localport=4545 profile=any\' -Verb RunAs"';
                    exec(cmd, (err) => {
                        if (err) {
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: false, message: err.message }));
                        } else {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: true, message: 'تم إرسال أمر فتح جدار الحماية بنجاح' }));
                        }
                    });
                    return;
                }

                // ب. طلب إقران جهاز تابلت جديد (Pairing Request)
                if (pathname === '/api/pair-request' && req.method === 'POST') {
                    const { deviceId, deviceName, deviceToken } = jsonBody;
                    if (!deviceId) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, message: 'معرف الجهاز مفقود' }));
                        return;
                    }

                    // تحقق إذا كان الجهاز هو نفسه اللاب توب الماستر (Localhost / Local IP)
                    const isLocalHost = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === 'localhost';

                    // تحقق إذا كان الجهاز مقترناً بالفعل مسبقاً عبر التوكن فقط (صمام أمان: لا يُسلّم التوكن بمجرد إرسال deviceId)
                    const existing = (deviceToken && typeof deviceToken === 'string') 
                        ? pairedDevices.find(d => d.token === deviceToken && (!deviceId || d.deviceId === deviceId) && d.status === 'active') 
                        : null;

                    if (existing) {
                        if (!existing.terminalLetter) {
                            ensureDeviceLettering();
                        }
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ 
                            success: true, 
                            isPaired: true, 
                            token: existing.token, 
                            terminalLetter: existing.terminalLetter || 'A',
                            deviceName: existing.deviceName || `كاشير فرعي (${existing.terminalLetter || 'A'}) 📱`,
                            pairingOrder: existing.pairingOrder || 1,
                            masterHwid: masterDbData.settings?.bayan_master_hwid || '',
                            masterLicense: masterDbData.settings?.bayan_master_license || null,
                            message: 'الجهاز مقترن ومصرح له بشكل دائم' 
                        }));
                        return;
                    }

                    if (isLocalHost) {
                        let localMaster = pairedDevices.find(d => (deviceToken && d.token === deviceToken) || d.deviceId === deviceId);
                        const token = localMaster ? localMaster.token : crypto.randomBytes(24).toString('hex');
                        if (!localMaster) {
                            pairedDevices.push({
                                deviceId,
                                deviceName: 'الجهاز الرئيسي (Master)',
                                ip: clientIp,
                                token,
                                pairedAt: new Date().toISOString(),
                                status: 'active'
                            });
                            savePairedDevices();
                        }
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ 
                            success: true, 
                            isPaired: true, 
                            token, 
                            masterHwid: masterDbData.settings?.bayan_master_hwid || '',
                            masterLicense: masterDbData.settings?.bayan_master_license || null,
                            message: 'الجهاز مقترن ومصرح له بشكل دائم' 
                        }));
                        return;
                    }

                    // التحقق من الحظر المؤقت بسبب المحاولات الخاطئة
                    const lockUntil = pinLockouts.get(clientIp);
                    if (lockUntil && Date.now() < lockUntil) {
                        const remMin = Math.ceil((lockUntil - Date.now()) / 60000);
                        res.writeHead(429, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ 
                            success: false, 
                            message: `تم حظر هذا الجهاز مؤقتاً بسبب تكرار إدخال رمز خاطئ. يرجى الانتظار ${remMin} دقيقة.` 
                        }));
                        return;
                    }

                    // تنظيف الطلبات القديمة المنتهية الصلاحية
                    cleanExpiredPairingRequests();

                    // منع إغراق السيرفر بطلبات متعددة من نفس الـ IP
                    const ipPendingCount = pendingPairingRequests.filter(r => r.ip === clientIp).length;
                    if (ipPendingCount >= 3) {
                        res.writeHead(429, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ 
                            success: false, 
                            message: 'توجد طلبات إقران معلقة بالفعل قيد الانتظار لهذا الجهاز. يرجى إدخال الرمز المعروض على شاشة الماستر.' 
                        }));
                        return;
                    }

                    // إذا كان هناك طلب نشط وساري المفعول لنفس الجهاز، نثبت نفس رمز الـ PIN حتى لا يتغير على الشاشة
                    let pairReq = pendingPairingRequests.find(r => r.deviceId === deviceId);
                    if (pairReq) {
                        pairReq.requestedAt = new Date().toISOString(); // تجديد الصلاحية 5 دقائق أخرى
                        if (deviceName) pairReq.deviceName = deviceName;
                        pairReq.ip = clientIp;
                    } else {
                        // توليد رمز PIN عشوائي ومحمي تشفيرياً من 4 أرقام
                        const pin = crypto.randomInt(1000, 10000).toString();
                        const reqId = 'REQ-' + Date.now();
                        pairReq = {
                            id: reqId,
                            deviceId,
                            deviceName: deviceName || `تابلت (${clientIp})`,
                            ip: clientIp,
                            pin,
                            requestedAt: new Date().toISOString()
                        };
                        pendingPairingRequests.push(pairReq);

                        // الحفاظ على حجم القائمة لمنع استهلاك الذاكرة
                        if (pendingPairingRequests.length > 15) {
                            pendingPairingRequests.shift();
                        }
                    }

                    // طباعة رمز الـ PIN بوضوح في شاشة السيرفر
                    console.log(`\n===============================================================`);
                    console.log(`📱 [طلب إقران جهاز جديد]: ${pairReq.deviceName} (${pairReq.ip})`);
                    console.log(`🔑 [رمز الـ PIN للإقران]: ===>  ${pairReq.pin}  <===`);
                    console.log(`===============================================================\n`);

                    // إرسال تنبيه فوري للشاشة الرئيسية على الكمبيوتر
                    if (typeof onNotification === 'function') {
                        onNotification('device-pairing-request', pairReq);
                    }

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        isPaired: false,
                        requiresPin: true,
                        message: 'يرجى إدخال رمز الإقران المعروض على شاشة الجهاز الرئيسي'
                    }));
                    return;
                }

                // س2. جلب طلبات الإقران المعلقة للجهاز الرئيسي (Polling for Web Masters)
                if (pathname === '/api/pair-requests/pending' && req.method === 'GET') {
                    // 🛡️ صمام أمان حاسم: منع أي جهاز عبر الشبكة من قراءة رموز الـ PIN المعلقة
                    const isLocal = (clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === 'localhost');
                    if (!isLocal) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, message: '403 Forbidden: لا يمكن الاطلاع على طلبات الإقران إلا من الجهاز الرئيسي محلياً' }));
                        return;
                    }

                    // تنظيف الطلبات القديمة التي مر عليها أكثر من دقيقتين تلقائياً
                    cleanExpiredPairingRequests();

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        requests: pendingPairingRequests
                    }));
                    return;
                }

                // س3. إخفاء أو رفض طلب الإقران
                if (pathname === '/api/pair-requests/dismiss' && req.method === 'POST') {
                    const { id, deviceId, action } = jsonBody;
                    // لا يتم حذف الرمز إلا في حالة الرفض الصريح فقط! مجرد إغلاق النافذة على الماستر يترك الرمز نشطاً للسماح بإدخاله
                    if (action === 'reject') {
                        pendingPairingRequests = pendingPairingRequests.filter(r => (id ? r.id !== id : r.deviceId !== deviceId));
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, message: 'تم رفض وإلغاء طلب الإقران بنجاح' }));
                        return;
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, message: 'تم إخفاء التنبيه من الشاشة مع بقاء الرمز نشطاً للاستخدام' }));
                    return;
                }

                // ج. التحقق من رمز الإقران (Verify PIN)
                if (pathname === '/api/pair-verify' && req.method === 'POST') {
                    const { deviceId, pin, deviceName } = jsonBody;
                    const cleanPin = String(pin || '').trim();

                    // التحقق من الحظر المؤقت للـ IP
                    const lockUntil = pinLockouts.get(clientIp);
                    if (lockUntil && Date.now() < lockUntil) {
                        const remMin = Math.ceil((lockUntil - Date.now()) / 60000);
                        res.writeHead(429, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ 
                            success: false, 
                            message: `تم حظر هذا الجهاز مؤقتاً بسبب تكرار إدخال رمز خاطئ 5 مرات. متبقي ${remMin} دقيقة لفك الحظر.` 
                        }));
                        return;
                    }

                    // تنظيف الطلبات المنتهية
                    cleanExpiredPairingRequests();

                    if (!deviceId || !cleanPin || !/^\d{4}$/.test(cleanPin)) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, message: 'رمز الإقران يجب أن يتكون من 4 أرقام عددية صحيحة' }));
                        return;
                    }

                    const pending = pendingPairingRequests.find(r => r.deviceId === deviceId);

                    // التحقق الصارم من وجود الطلب وصلاحيته الزمنية
                    if (!pending) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ 
                            success: false, 
                            message: 'لا يوجد طلب إقران نشط لهذا الجهاز أو انتهت صلاحية الرمز (مدتها 5 دقائق). يرجى الضغط على اتصال مجدداً.' 
                        }));
                        return;
                    }

                    // مقارنة مشفرة وآمنة زمنياً لمنع هجمات التوقيت Side-Channel Timing Attacks
                    const isPinValid = (pending.pin.length === cleanPin.length) && 
                        crypto.timingSafeEqual(Buffer.from(pending.pin), Buffer.from(cleanPin));

                    if (!isPinValid) {
                        const attempts = (pinFailedAttempts.get(clientIp) || 0) + 1;
                        if (attempts >= 5) {
                            pinLockouts.set(clientIp, Date.now() + 5 * 60 * 1000); // حظر 5 دقائق
                            pinFailedAttempts.delete(clientIp);
                            // إلغاء الطلب فوراً بعد استنفاذ المحاولات
                            pendingPairingRequests = pendingPairingRequests.filter(r => r.deviceId !== deviceId);
                            res.writeHead(429, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ 
                                success: false, 
                                message: '429 Too Many Attempts: تم تجميد وحظر المحاولات لمدة 5 دقائق بعد 5 محاولات خاطئة لمنع التخمين.' 
                            }));
                            return;
                        }
                        pinFailedAttempts.set(clientIp, attempts);
                        res.writeHead(401, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ 
                            success: false, 
                            message: `رمز الإقران غير صحيح (متبقي ${5 - attempts} محاولات قبل الحظر المؤقت)` 
                        }));
                        return;
                    }

                    // نجاح التحقق: تفريغ عداد المحاولات الفاشلة والحظر
                    pinFailedAttempts.delete(clientIp);
                    pinLockouts.delete(clientIp);

                    // احتساب الحرف الأبجدي التالي للأجهزة الفرعية (A, B, C, D...)
                    const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
                    const otherClients = pairedDevices.filter(d => d.deviceId !== deviceId && d.deviceId !== 'DEV-HOST');
                    const usedLetters = otherClients.map(d => d.terminalLetter).filter(Boolean);
                    let assignedLetter = 'A';
                    for (let i = 0; i < LETTERS.length; i++) {
                        if (!usedLetters.includes(LETTERS[i])) {
                            assignedLetter = LETTERS[i];
                            break;
                        }
                    }
                    const pairingOrder = otherClients.length + 1;
                    const defaultDeviceName = `كاشير فرعي (${assignedLetter}) 📱`;

                    // توليد توكن أمان فريد قوي للجهاز
                    const token = crypto.randomBytes(32).toString('hex');
                    const newPaired = {
                        deviceId,
                        deviceName: (deviceName && !deviceName.startsWith('تابلت') && !deviceName.startsWith('جهاز فرعي'))
                            ? `${deviceName} (${assignedLetter}) 📱`
                            : defaultDeviceName,
                        terminalLetter: assignedLetter,
                        pairingOrder: pairingOrder,
                        ip: clientIp,
                        token,
                        pairedAt: new Date().toISOString(),
                        status: 'active'
                    };

                    pairedDevices = pairedDevices.filter(d => d.deviceId !== deviceId);
                    pairedDevices.push(newPaired);
                    savePairedDevices();

                    // إزالة الطلب من قائمة الانتظار
                    pendingPairingRequests = pendingPairingRequests.filter(r => r.deviceId !== deviceId);

                    console.log(`✅ [تم إقران الجهاز بنجاح]: ${newPaired.deviceName} (الرمز: ${assignedLetter}) [ترتيب: ${pairingOrder}] (${newPaired.ip})`);

                    if (typeof onNotification === 'function') {
                        onNotification('device-paired-success', newPaired);
                    }

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        token,
                        terminalLetter: assignedLetter,
                        deviceName: newPaired.deviceName,
                        pairingOrder: pairingOrder,
                        masterHwid: masterDbData.settings?.bayan_master_hwid || '',
                        masterLicense: masterDbData.settings?.bayan_master_license || null,
                        message: 'تم إقران الجهاز واعتماده بنجاح'
                    }));
                    return;
                }

                // ج2. تعديل اسم وقسم الجهاز المقترن (Update Paired Device Name) - متاح للماستر
                if (pathname === '/api/paired-device/update-name' && req.method === 'POST') {
                    const isLocal = (clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === 'localhost');
                    if (!isLocal) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, message: 'ممنوع: تعديل أسماء الأجهزة متاح للماستر فقط' }));
                        return;
                    }
                    const { deviceId, newName } = jsonBody;
                    const ok = updatePairedDeviceName(deviceId, newName);
                    res.writeHead(ok ? 200 : 404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: !!ok, message: ok ? 'تم تحديث اسم الجهاز بنجاح' : 'الجهاز غير موجود' }));
                    return;
                }

                // ج3. جلب قائمة الأجهزة المقترنة (Get Paired Devices)
                if (pathname === '/api/paired-devices' && req.method === 'GET') {
                    ensureDeviceLettering();
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, devices: pairedDevices }));
                    return;
                }

                // د. جلب التحويلات بانتظار الاستلام (Get In-Transit Transfers)
                if (pathname === '/api/transfers/pending' && req.method === 'GET') {
                    const targetWh = parsedUrl.searchParams.get('warehouse') || '';
                    let list = inTransitTransfers.filter(t => t.transferStatus === 'pending');
                    if (targetWh) {
                        list = list.filter(t => t.toWarehouse === targetWh || t.warehouse === targetWh);
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, transfers: list }));
                    return;
                }

                // هـ. حفظ إذن تحويل جديد في حالة الانتظار (Create Pending Transfer)
                if (pathname === '/api/transfers/create' && req.method === 'POST') {
                    const transferData = jsonBody;
                    transferData.transferStatus = 'pending';
                    transferData.createdAt = new Date().toISOString();
                    
                    inTransitTransfers = inTransitTransfers.filter(t => t.id !== transferData.id);
                    inTransitTransfers.push(transferData);
                    savePendingTransfers();

                    if (typeof onNotification === 'function') {
                        onNotification('new-pending-transfer', transferData);
                    }

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, transfer: transferData, message: 'تم إرسال إذن التحويل لساحة الانتظار' }));
                    return;
                }

                // و. تأكيد واستلام إذن التحويل (Accept Transfer)
                if (pathname === '/api/transfers/accept' && req.method === 'POST') {
                    const { transferId, receiverName, notes } = jsonBody;
                    let transfer = inTransitTransfers.find(t => String(t.id) === String(transferId) || String(t.invoiceId) === String(transferId));

                    if (transfer) {
                        transfer.transferStatus = 'received';
                        transfer.receivedBy = receiverName || 'أمين مخزن الفرع';
                        transfer.receivedAt = new Date().toISOString();
                        transfer.receiverNotes = notes || '';
                        savePendingTransfers();
                    }

                    // تحديث الحالة في masterDbData.transactions لضمان المزامنة التامة لكافة الأجهزة
                    let txUpdated = false;
                    if (Array.isArray(masterDbData.transactions)) {
                        masterDbData.transactions.forEach(t => {
                            if (String(t.invoiceId) === String(transferId) || String(t.id) === String(transferId)) {
                                t.transferStatus = 'received';
                                t.receivedBy = receiverName || 'أمين مخزن الفرع';
                                t.receivedAt = new Date().toLocaleString('ar-EG');
                                txUpdated = true;
                            }
                        });
                        if (txUpdated) {
                            masterDbData.lastUpdated = new Date().toISOString();
                            saveMasterDb();
                        }
                    }

                    if (typeof onNotification === 'function') {
                        onNotification('transfer-accepted', transfer || { id: transferId, transferStatus: 'received' });
                    }

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, transfer: transfer || { id: transferId, transferStatus: 'received' }, message: 'تم تأكيد الاستلام بنجاح' }));
                    return;
                }

                // ز. رفض إذن التحويل (Reject Transfer)
                if (pathname === '/api/transfers/reject' && req.method === 'POST') {
                    const { transferId, rejectorName, notes } = jsonBody;
                    let transfer = inTransitTransfers.find(t => String(t.id) === String(transferId) || String(t.invoiceId) === String(transferId));

                    if (transfer) {
                        transfer.transferStatus = 'rejected';
                        transfer.rejectedBy = rejectorName || 'أمين مخزن الفرع';
                        transfer.rejectedAt = new Date().toISOString();
                        transfer.rejectorNotes = notes || '';
                        savePendingTransfers();
                    }

                    // تحديث الحالة في masterDbData.transactions لضمان المزامنة التامة لكافة الأجهزة
                    let txUpdated = false;
                    if (Array.isArray(masterDbData.transactions)) {
                        masterDbData.transactions.forEach(t => {
                            if (String(t.invoiceId) === String(transferId) || String(t.id) === String(transferId)) {
                                t.transferStatus = 'rejected';
                                t.rejectedBy = rejectorName || 'أمين مخزن الفرع';
                                t.rejectedAt = new Date().toLocaleString('ar-EG');
                                txUpdated = true;
                            }
                        });
                        if (txUpdated) {
                            masterDbData.lastUpdated = new Date().toISOString();
                            saveMasterDb();
                        }
                    }

                    if (typeof onNotification === 'function') {
                        onNotification('transfer-rejected', transfer || { id: transferId, transferStatus: 'rejected' });
                    }

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, transfer: transfer || { id: transferId, transferStatus: 'rejected' }, message: 'تم رفض إذن التحويل بنجاح' }));
                    return;
                }

                // Endpoint غير معروف
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Endpoint not found' }));
            });
            return;
        }

        // =========================================================================
        // 📁 2. Static File Serving (HTML, CSS, JS, Images)
        // =========================================================================
        // توجيه مسار الموبايل لمجلده المستقل تماماً
        if (pathname === '/mobile') {
            res.writeHead(302, { 'Location': '/mobile/' });
            res.end();
            return;
        }

        let safePath = pathname === '/' ? '/index.html' : pathname;
        if (safePath === '/mobile/' || safePath === '/mobile.html') {
            safePath = '/mobile/index.html';
        }
        // منع التسلل للمجلدات وحماية الملفات الحساسة (Path Traversal Protection)
        const normalizedRoot = path.resolve(rootDir);
        const cleanRelPath = path.normalize(safePath).replace(/^(\.\.[\/\\])+/, '').replace(/^[\/\\]+/, '');
        const resolvedPath = path.resolve(normalizedRoot, cleanRelPath);

        // صمام الأمان الفولاذي: التأكد بنسبة 100% أن الملف المطلوب يقع حصرياً داخل مجلد التطبيق
        if (!resolvedPath.startsWith(normalizedRoot + path.sep) && resolvedPath !== normalizedRoot && resolvedPath !== path.join(normalizedRoot, 'index.html')) {
            res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('403 Forbidden - محاولة وصول غير مصرح بها خارج مجلد النظام');
            return;
        }

        // حظر الوصول المباشر للمجلدات الداخلية والملفات الحساسة الخاصة بالباك إند
        const normalizedRel = path.relative(normalizedRoot, resolvedPath).replace(/\\/g, '/').toLowerCase();
        const ext = path.extname(resolvedPath).toLowerCase();

        // 🔒 السماح حصرياً بالامتدادات الخاصة بأصول الويب وتطبيقات التابلت فقط
        const ALLOWED_EXTENSIONS = new Set(['.html', '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.woff', '.woff2', '.ttf', '.eot', '.mp3', '.wav']);
        if (!ALLOWED_EXTENSIONS.has(ext)) {
            res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('403 Forbidden - نوع الملف غير مسموح بالوصول إليه عبر الشبكة');
            return;
        }

        // 🔒 حظر المجلدات الحساسة نهائياً (node_modules, .git, .agents, backups, etc.)
        if (
            normalizedRel.startsWith('node_modules/') || 
            normalizedRel.startsWith('.git') || 
            normalizedRel.startsWith('.agents') || 
            normalizedRel.startsWith('.gemini') || 
            normalizedRel.startsWith('backups/') ||
            path.basename(resolvedPath).startsWith('.')
        ) {
            res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('403 Forbidden - مسار نظام محمي');
            return;
        }

        // حظر الوصول المباشر للملفات الحساسة الخاصة بالباك إند وقواعد البيانات
        const forbiddenFiles = new Set(['.env', 'package.json', 'package-lock.json', '.git', 'server_hub.js', 'main.js', 'master_sync_db.json', 'paired_devices.json']);
        const baseFileName = path.basename(resolvedPath).toLowerCase();
        if (forbiddenFiles.has(baseFileName) || baseFileName.startsWith('.')) {
            res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('403 Forbidden - ملف نظام محمي');
            return;
        }

        fs.stat(resolvedPath, (err, stats) => {
            if (err || !stats.isFile()) {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('404 Not Found - ملف غير موجود');
                return;
            }

            const contentType = MIME_TYPES[ext] || 'application/octet-stream';
            const headers = { 'Content-Type': contentType };

            // تحسين سرعة المتصفح والتابلت: كاش للملفات الثابتة والصور، وعدم تخزين HTML الرئيسي
            if (ext === '.html') {
                headers['Cache-Control'] = 'no-cache';
            } else if (['.js', '.css', '.woff', '.woff2', '.ttf', '.png', '.jpg', '.jpeg', '.svg', '.ico'].includes(ext)) {
                headers['Cache-Control'] = 'public, max-age=86400';
            }

            res.writeHead(200, headers);
            const stream = fs.createReadStream(resolvedPath);
            stream.on('error', (streamErr) => {
                if (!res.headersSent) {
                    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                }
                res.end('500 Error reading file');
            });
            stream.pipe(res);
        });
        } catch (serverErr) {
            console.error('[ServerHub] Request error:', serverErr);
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
            }
            res.end(JSON.stringify({ error: 'Internal Server Error', message: serverErr.message }));
        }
    });

    serverInstance.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.warn(`⚠️ [ServerHub] Port ${SERVER_PORT} is already in use by another instance.`);
        } else {
            console.warn('[ServerHub] Server error:', err.message);
        }
    });

    serverInstance.listen(SERVER_PORT, '0.0.0.0', () => {
        console.log(`🚀 [ServerHub] Bayan POS Local Server is running on http://${getLocalIPAddress()}:${SERVER_PORT}`);
    });

    return {
        isRunning: true,
        ip: getLocalIPAddress(),
        port: SERVER_PORT
    };
}

function stopServer() {
    if (liveStreamClients && liveStreamClients.size > 0) {
        for (const client of Array.from(liveStreamClients)) {
            try { client.res.end(); } catch (e) {}
        }
        liveStreamClients.clear();
    }
    if (serverInstance) {
        try {
            serverInstance.close();
        } catch (e) {}
        serverInstance = null;
        console.log('[ServerHub] Server stopped.');
    }
}

function getPairedDevicesList() {
    return pairedDevices;
}

function removePairedDevice(deviceId) {
    pairedDevices = pairedDevices.filter(d => d.deviceId !== deviceId);
    savePairedDevices();
    return pairedDevices;
}

function getPendingPairingRequests() {
    return pendingPairingRequests;
}

function approvePairingRequest(requestId) {
    const req = pendingPairingRequests.find(r => r.id === requestId);
    if (!req) return null;
    return req.pin;
}

function getInTransitTransfersList() {
    return inTransitTransfers;
}

function updateInTransitTransfersList(list) {
    if (Array.isArray(list)) {
        inTransitTransfers = list;
        savePendingTransfers();
    }
    return inTransitTransfers;
}

function getMasterDbData() {
    return masterDbData;
}

module.exports = {
    startServer,
    stopServer,
    getLocalIPAddress,
    SERVER_PORT,
    getPairedDevicesList,
    removePairedDevice,
    updatePairedDeviceName,
    getPendingPairingRequests,
    approvePairingRequest,
    getInTransitTransfersList,
    updateInTransitTransfersList,
    getMasterDbData,
    updateMasterDbData
};

if (require.main === module) {
    startServer(__dirname);
}
