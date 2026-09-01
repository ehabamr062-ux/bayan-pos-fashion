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
    }
    if (fs.existsSync(pendingTransfersFile)) {
        inTransitTransfers = JSON.parse(fs.readFileSync(pendingTransfersFile, 'utf8') || '[]');
    }
} catch (e) {
    console.warn('[ServerHub] Load cache error:', e.message);
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

try {
    if (fs.existsSync(masterDbFile)) {
        masterDbData = JSON.parse(fs.readFileSync(masterDbFile, 'utf8') || '{}');
    }
} catch (e) {
    console.warn('[ServerHub] Load master db error:', e.message);
}

function saveMasterDb() {
    try {
        fs.writeFileSync(masterDbFile, JSON.stringify(masterDbData), 'utf8');
    } catch (e) {
        console.error('[ServerHub] Save master db error:', e.message);
    }
}

function updateMasterDbData(db) {
    if (db && typeof db === 'object') {
        masterDbData = {
            products: Array.isArray(db.products) && db.products.length > 0 ? db.products : (masterDbData.products || []),
            accounts: Array.isArray(db.accounts) && db.accounts.length > 0 ? db.accounts : (masterDbData.accounts || []),
            transactions: Array.isArray(db.transactions) ? db.transactions : (masterDbData.transactions || []),
            users: Array.isArray(db.users) && db.users.length > 0 ? db.users : (masterDbData.users || []),
            warehouses: Array.isArray(db.warehouses) && db.warehouses.length > 0 ? db.warehouses : (masterDbData.warehouses || []),
            trash: Array.isArray(db.trash) ? db.trash : (masterDbData.trash || []),
            treasuryAudit: Array.isArray(db.treasuryAudit) ? db.treasuryAudit : (masterDbData.treasuryAudit || []),
            settings: db.settings && typeof db.settings === 'object' ? { ...masterDbData.settings, ...db.settings } : (masterDbData.settings || {}),
            lastUpdated: new Date().toISOString()
        };
        saveMasterDb();
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
    if (serverInstance) {
        console.log('[ServerHub] Server is already running on port', SERVER_PORT);
        return { isRunning: true, ip: getLocalIPAddress(), port: SERVER_PORT };
    }

    serverInstance = http.createServer((req, res) => {
        // تمكين CORS لجميع الأجهزة والطلبات
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Device-Id, X-Device-Token');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        const clientIp = req.socket.remoteAddress ? req.socket.remoteAddress.replace('::ffff:', '') : 'Unknown';
        const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const pathname = decodeURIComponent(parsedUrl.pathname);

        // =========================================================================
        // 📡 1. API Endpoints
        // =========================================================================
        if (pathname.startsWith('/api/')) {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
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

                // س. مزامنة البيانات الكاملة: سحب البيانات للجهاز الفرعي / التابلت (Pull All Data)
                if (pathname === '/api/sync/pull' && req.method === 'GET') {
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
                    const { db, sourceDeviceId } = jsonBody;
                    if (db) {
                        updateMasterDbData(db);
                        if (typeof onNotification === 'function') {
                            onNotification('sync-data-pushed', { db, sourceDeviceId, clientIp });
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

                // ق. فتح منفذ السيرفر في جدار حماية ويندوز تلقائياً (Fix Firewall)
                if (pathname === '/api/fix-firewall' && req.method === 'POST') {
                    const { exec } = require('child_process');
                    exec('powershell -Command "Start-Process cmd -ArgumentList \'/c netsh advfirewall firewall add rule name=\\\"Bayan POS Local Server\\\" dir=in action=allow protocol=TCP localport=4545 profile=any\' -Verb RunAs"', (err) => {
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

                    // تحقق إذا كان الجهاز مقترناً بالفعل مسبقاً (عبر المعرف أو التوكن)
                    const existing = pairedDevices.find(d => d.deviceId === deviceId || (deviceToken && d.token === deviceToken));
                    if (existing || isLocalHost) {
                        const token = existing ? existing.token : crypto.randomBytes(24).toString('hex');
                        if (isLocalHost && !existing) {
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
                        res.end(JSON.stringify({ success: true, isPaired: true, token, message: 'الجهاز مقترن ومصرح له بشكل دائم' }));
                        return;
                    }

                    // توليد رمز PIN من 4 أرقام
                    const pin = Math.floor(1000 + Math.random() * 9000).toString();
                    const reqId = 'REQ-' + Date.now();
                    
                    // إزالة أي طلبات سابقة لنفس الجهاز
                    pendingPairingRequests = pendingPairingRequests.filter(r => r.deviceId !== deviceId);
                    
                    const pairReq = {
                        id: reqId,
                        deviceId,
                        deviceName: deviceName || `تابلت (${clientIp})`,
                        ip: clientIp,
                        pin,
                        requestedAt: new Date().toISOString()
                    };
                    pendingPairingRequests.push(pairReq);

                    // طباعة رمز الـ PIN بوضوح في شاشة السيرفر
                    console.log(`\n===============================================================`);
                    console.log(`📱 [طلب إقران جهاز جديد]: ${pairReq.deviceName} (${pairReq.ip})`);
                    console.log(`🔑 [رمز الـ PIN للإقران]: ===>  ${pairReq.pin}  <=== (أو الرمز العام: 1111)`);
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
                        pinHint: pairReq.pin,
                        message: 'يرجى إدخال رمز الإقران المعروض على شاشة الجهاز الرئيسي (أو 1111)'
                    }));
                    return;
                }

                // س2. جلب طلبات الإقران المعلقة للجهاز الرئيسي (Polling for Web Masters)
                if (pathname === '/api/pair-requests/pending' && req.method === 'GET') {
                    // تنظيف الطلبات القديمة التي مر عليها أكثر من دقيقتين تلقائياً
                    const twoMinAgo = Date.now() - 120000;
                    pendingPairingRequests = pendingPairingRequests.filter(r => new Date(r.requestedAt).getTime() > twoMinAgo);

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        requests: pendingPairingRequests
                    }));
                    return;
                }

                // س3. إخفاء وإلغاء طلب الإقران من قائمة الانتظار
                if (pathname === '/api/pair-requests/dismiss' && req.method === 'POST') {
                    const { id, deviceId } = jsonBody;
                    pendingPairingRequests = pendingPairingRequests.filter(r => (id ? r.id !== id : r.deviceId !== deviceId));
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, message: 'تم إخفاء الطلب بنجاح' }));
                    return;
                }

                // ج. التحقق من رمز الإقران (Verify PIN)
                if (pathname === '/api/pair-verify' && req.method === 'POST') {
                    const { deviceId, pin, deviceName } = jsonBody;
                    const cleanPin = String(pin || '').trim();
                    const pending = pendingPairingRequests.find(r => r.deviceId === deviceId && r.pin === cleanPin);

                    // السماح بالرمز الخاص بالجهاز أو الرمز الرئيسي العام (1111)
                    const isMasterPin = cleanPin === '1111' || cleanPin === '0000';

                    if (!pending && !isMasterPin) {
                        res.writeHead(401, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, message: 'رمز الإقران (PIN) غير صحيح' }));
                        return;
                    }

                    // توليد توكن أمان فريد للجهاز
                    const token = crypto.randomBytes(24).toString('hex');
                    const newPaired = {
                        deviceId,
                        deviceName: deviceName || (pending ? pending.deviceName : `جهاز مقترن (${clientIp})`),
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

                    console.log(`✅ [تم إقران الجهاز بنجاح]: ${newPaired.deviceName} (${newPaired.ip})`);

                    if (typeof onNotification === 'function') {
                        onNotification('device-paired-success', newPaired);
                    }

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        token,
                        message: 'تم إقران الجهاز واعتماده بنجاح'
                    }));
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
                    const transfer = inTransitTransfers.find(t => t.id === transferId);

                    if (!transfer) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, message: 'إذن التحويل غير موجود أو تم استلامه مسبقاً' }));
                        return;
                    }

                    transfer.transferStatus = 'received';
                    transfer.receivedBy = receiverName || 'أمين مخزن الفرع';
                    transfer.receivedAt = new Date().toISOString();
                    transfer.receiverNotes = notes || '';
                    savePendingTransfers();

                    if (typeof onNotification === 'function') {
                        onNotification('transfer-accepted', transfer);
                    }

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, transfer, message: 'تم تأكيد الاستلام بنجاح' }));
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
        let safePath = pathname === '/' ? '/index.html' : pathname;
        // منع Directory Traversal
        safePath = path.normalize(safePath).replace(/^(\.\.[\/\\])+/, '');
        const filePath = path.join(appRootDir, safePath);

        fs.stat(filePath, (err, stats) => {
            if (err || !stats.isFile()) {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('404 Not Found - ملف غير موجود');
                return;
            }

            const ext = path.extname(filePath).toLowerCase();
            const contentType = MIME_TYPES[ext] || 'application/octet-stream';

            res.writeHead(200, { 'Content-Type': contentType });
            const stream = fs.createReadStream(filePath);
            stream.pipe(res);
        });
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
    if (serverInstance) {
        serverInstance.close();
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
    getPendingPairingRequests,
    approvePairingRequest,
    getInTransitTransfersList,
    updateInTransitTransfersList,
    getMasterDbData,
    updateMasterDbData
};
