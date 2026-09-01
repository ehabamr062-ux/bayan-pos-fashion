/**
 * =========================================================================
 * 🚀 نظام التحديث التلقائي الشامل المربوط بـ GitHub Releases - Bayan POS System
 * =========================================================================
 * يدعم الربط المباشر مع GitHub Releases API + Electron Auto Updater
 * يظهر إشعار تنبيه تلقائي في كل مرة يفتح فيها المستخدم التطبيق (حال توفر نت)
 * يتيح خيارات: "تحديث الآن" أو "لاحقاً" (مع تكرار التنبيه في الفتح التالي)
 * =========================================================================
 */

(function initAutoUpdater() {
    if (typeof window === 'undefined') return;

    // 🛑 مفتاح التحديثات: معطل مؤقتاً لتفادي التقاط إصدارات السوبرماركت (v1.0.8) حتى تجهيز سيرفر الفاشون الجديد
    const IS_UPDATER_ENABLED = false;

    // بيانات المستودع المربوط على GitHub Releases والرسائل السحابية
    const GITHUB_REPO_OWNER = 'ehabamr062-ux';
    const GITHUB_REPO_NAME = 'Bayan-Pos-Fashion';
    const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest`;
    const GITHUB_RELEASES_PAGE = `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest`;
    const GITHUB_BROADCAST_URL = `https://raw.githubusercontent.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/main/announcements.json`;

    let ipcRenderer = null;
    try {
        if (typeof window.require !== 'undefined') {
            const electron = window.require('electron');
            if (electron && electron.ipcRenderer) {
                ipcRenderer = electron.ipcRenderer;
            }
        }
    } catch (e) {
        console.log('[Updater] Not running in Electron IPC context. Using Web Fallback mode.');
    }

    // =========================================================================
    // حقن CSS المودرن الفاخر لنافذة التحديث والتنبيهات (Ultra Premium UI)
    // =========================================================================
    if (!document.getElementById('bayan-updater-styles')) {
        const style = document.createElement('style');
        style.id = 'bayan-updater-styles';
        style.textContent = `
            #bayan-update-overlay {
                position: fixed;
                inset: 0;
                background: rgba(10, 10, 24, 0.85);
                
                -webkit-
                z-index: 9999999;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: updaterFadeIn 0.35s ease;
                font-family: 'Cairo', 'Segoe UI', sans-serif;
            }
            @keyframes updaterFadeIn {
                from { opacity: 0; }
                to   { opacity: 1; }
            }
            #bayan-update-modal {
                background: linear-gradient(150deg, #1e113a 0%, #130a24 50%, #0f172a 100%);
                border: 2px solid rgba(212, 175, 55, 0.5);
                border-radius: 28px;
                padding: 35px 38px;
                width: 550px;
                max-width: 95vw;
                box-shadow: 0 30px 70px rgba(0,0,0,0.8), 0 0 40px rgba(147, 51, 234, 0.3), 0 0 25px rgba(212, 175, 55, 0.25);
                direction: rtl;
                animation: updaterSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                position: relative;
                overflow: hidden;
            }
            #bayan-update-modal::before {
                content: '';
                position: absolute;
                top: 0; left: 0; right: 0;
                height: 4px;
                background: linear-gradient(90deg, #10b981, #d4af37, #8b5cf6, #10b981);
                background-size: 200% 100%;
                animation: shimmerBar 2.5s linear infinite;
            }
            @keyframes shimmerBar {
                0%   { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }
            @keyframes updaterSlideUp {
                from { opacity: 0; transform: translateY(30px) scale(0.95); }
                to   { opacity: 1; transform: translateY(0) scale(1); }
            }
            .upd-header { display: flex; align-items: center; gap: 16px; margin-bottom: 22px; }
            .upd-icon { 
                width: 58px; 
                height: 58px; 
                background: linear-gradient(135deg, #10b981, #059669); 
                border-radius: 18px; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                font-size: 28px; 
                box-shadow: 0 8px 24px rgba(16, 185, 129, 0.4), 0 0 15px rgba(16, 185, 129, 0.3); 
                border: 1.5px solid rgba(255, 255, 255, 0.3);
                flex-shrink: 0; 
            }
            .upd-title h3 { 
                margin: 0 0 4px; 
                font-size: 1.35rem; 
                font-weight: 900; 
                color: #ffffff; 
                letter-spacing: 0.5px;
                text-shadow: 0 2px 10px rgba(0,0,0,0.5);
            }
            .upd-title p { 
                margin: 0; 
                font-size: 0.86rem; 
                color: #cbd5e1; 
                font-weight: 800; 
            }
            .upd-ver-row { 
                display: flex; 
                align-items: center; 
                justify-content: space-between;
                gap: 14px; 
                margin-bottom: 22px; 
                background: rgba(255, 255, 255, 0.05); 
                border: 1.5px solid rgba(212, 175, 55, 0.3); 
                border-radius: 18px; 
                padding: 16px 22px; 
                box-shadow: inset 0 2px 10px rgba(0,0,0,0.25), 0 4px 15px rgba(0,0,0,0.15);
            }
            .upd-ver { flex: 1; text-align: center; }
            .upd-ver .lbl { font-size: 0.8rem; color: #94a3b8; margin-bottom: 5px; font-weight: 800; }
            .upd-ver .val { 
                font-size: 1.3rem; 
                font-weight: 900; 
                font-family: 'Cairo', monospace; 
                letter-spacing: 1px;
            }
            .upd-ver.cur .val { color: #cbd5e1; text-shadow: 0 0 8px rgba(255,255,255,0.2); }
            .upd-ver.nw  .val { 
                color: #34d399; 
                text-shadow: 0 0 12px rgba(52, 211, 153, 0.5); 
            }
            .upd-arrow { 
                font-size: 1.8rem; 
                font-weight: 900;
                color: #d4af37; 
                text-shadow: 0 0 10px rgba(212, 175, 55, 0.6);
                flex-shrink: 0; 
                animation: arrowGlow 1.5s infinite alternate ease-in-out;
            }
            @keyframes arrowGlow {
                from { transform: scale(1); opacity: 0.85; }
                to { transform: scale(1.15); opacity: 1; }
            }
            .upd-notes { 
                background: rgba(15, 23, 42, 0.6); 
                border: 1.5px solid rgba(255, 255, 255, 0.1); 
                border-radius: 16px; 
                padding: 16px 20px; 
                margin-bottom: 22px; 
                max-height: 160px; 
                overflow-y: auto; 
                box-shadow: inset 0 2px 8px rgba(0,0,0,0.3);
            }
            .upd-notes::-webkit-scrollbar { width: 5px; } 
            .upd-notes::-webkit-scrollbar-thumb { background: #64748b; border-radius: 6px; }
            .upd-notes h4 { 
                margin: 0 0 10px; 
                font-size: 0.86rem; 
                font-weight: 900; 
                color: #38bdf8; 
                text-transform: uppercase; 
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .upd-notes-body { font-size: 0.9rem; color: #e2e8f0; line-height: 1.75; font-weight: 700; }
            .upd-prog { margin-bottom: 20px; display: none; }
            .upd-prog.vis { display: block; }
            .upd-prog-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
            .upd-prog-lbl { font-size: 0.88rem; color: #cbd5e1; font-weight: 800; }
            .upd-prog-pct { font-size: 1.05rem; font-weight: 900; color: #10b981; text-shadow: 0 0 10px rgba(16,185,129,0.5); }
            .upd-track { background: rgba(255, 255, 255, 0.1); border-radius: 100px; height: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.15); }
            .upd-fill { height: 100%; border-radius: 100px; background: linear-gradient(90deg, #10b981, #059669, #06b6d4, #10b981); background-size: 200% 100%; animation: progressShimmer 1.5s linear infinite; transition: width .3s ease; width: 0%; box-shadow: 0 0 12px rgba(16,185,129,0.7); }
            @keyframes progressShimmer { 0%{background-position:100% 0} 100%{background-position:-100% 0} }
            .upd-speed { font-size: 0.8rem; color: #94a3b8; margin-top: 6px; text-align: left; font-weight: 800; }
            .upd-actions { display: flex; gap: 14px; }
            .upd-btn { 
                flex: 1; 
                padding: 14px 22px; 
                border-radius: 14px; 
                border: none; 
                cursor: pointer; 
                font-size: 1rem; 
                font-weight: 900; 
                font-family: inherit; 
                transition: all .25s cubic-bezier(0.16, 1, 0.3, 1); 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                gap: 8px; 
            }
            .upd-btn:hover { transform: translateY(-2px); }
            .upd-btn:disabled { opacity: .55; cursor: not-allowed; transform: none !important; }
            .upd-btn-primary { 
                background: linear-gradient(135deg, #10b981, #059669); 
                color: #ffffff; 
                box-shadow: 0 8px 24px rgba(16, 185, 129, 0.45); 
                border: 1.5px solid rgba(255, 255, 255, 0.2);
            }
            .upd-btn-primary:hover {
                background: linear-gradient(135deg, #059669, #047857);
                box-shadow: 0 10px 28px rgba(16, 185, 129, 0.6);
            }
            .upd-btn-secondary { 
                background: rgba(255, 255, 255, 0.08); 
                color: #cbd5e1; 
                border: 1.5px solid rgba(255, 255, 255, 0.15); 
            }
            .upd-btn-secondary:hover { 
                background: rgba(255, 255, 255, 0.15); 
                color: #ffffff; 
                border-color: rgba(255, 255, 255, 0.25);
            }
            .upd-btn-success { 
                background: linear-gradient(135deg, #059669, #10b981); 
                color: #fff; 
                box-shadow: 0 8px 24px rgba(16, 185, 129, 0.45); 
            }
        `;
        document.head.appendChild(style);
    }

    // =========================================================================
    // حالة نظام التحديث
    // =========================================================================
    const state = {
        currentVersion: window.appVersion || '1.0.2',
        latestVersion: null,
        releaseNotes: '',
        downloadUrl: '',
        isDownloading: false,
        isDownloaded: false
    };

    // =========================================================================
    // دالة مقارنة أرقام الإصدارات (SemVer Comparison)
    // =========================================================================
    function parseVer(v) {
        if (!v) return [0, 0, 0];
        return String(v).replace(/^v/i, '').trim().split('.').map(n => parseInt(n, 10) || 0);
    }

    function isNewerVersion(latestTag, currentVer) {
        const l = parseVer(latestTag);
        const c = parseVer(currentVer);
        for (let i = 0; i < Math.max(l.length, c.length); i++) {
            const lNum = l[i] || 0;
            const cNum = c[i] || 0;
            if (lNum > cNum) return true;
            if (lNum < cNum) return false;
        }
        return false;
    }

    function getCurrentAppVersion() {
        return window.appVersion || '1.0.2';
    }

    function fmtNotes(notes) {
        if (!notes) return 'تحسينات جديدة وإصلاحات مستقرة في هذا الإصدار.';
        return String(notes)
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/^#{1,3}\s+(.+)$/gm, '<strong style="color:#10b981">$1</strong>')
            .replace(/^[-*]\s+(.+)$/gm, '• $1')
            .replace(/\r?\n/g, '<br>');
    }

    // =========================================================================
    // فتح واجهة التحديث المودرن (Modal Window)
    // =========================================================================
    function openModal() {
        const old = document.getElementById('bayan-update-overlay');
        if (old) old.remove();

        const div = document.createElement('div');
        div.id = 'bayan-update-overlay';
        div.innerHTML = `
            <div id="bayan-update-modal" role="dialog" aria-modal="true">
                <div class="upd-header">
                    <div class="upd-icon">🚀</div>
                    <div class="upd-title">
                        <h3>تحديث برمجي جديد متاح!</h3>
                        <p>نظام بَيَان POS - تحديثات GitHub Releases المباشرة</p>
                    </div>
                </div>
                <div class="upd-ver-row">
                    <div class="upd-ver cur">
                        <div class="lbl">الإصدار الحالي لديك</div>
                        <div class="val">v${state.currentVersion}</div>
                    </div>
                    <div class="upd-arrow" title="ترقية إلى الإصدار الأحدث">←</div>
                    <div class="upd-ver nw">
                        <div class="lbl">الإصدار الأحدث المتوفر</div>
                        <div class="val">v${state.newVersion}</div>
                    </div>
                </div>
                <div class="upd-notes">
                    <h4>📋 ملخص التحسينات في الإصدار الجديد</h4>
                    <div class="upd-notes-body">${fmtNotes(state.releaseNotes)}</div>
                </div>
                <div class="upd-prog" id="upd-prog">
                    <div class="upd-prog-top">
                        <span class="upd-prog-lbl" id="upd-lbl">جاري التنزيل...</span>
                        <span class="upd-prog-pct" id="upd-pct">0%</span>
                    </div>
                    <div class="upd-track"><div class="upd-fill" id="upd-fill"></div></div>
                    <div class="upd-speed" id="upd-speed"></div>
                </div>
                <div class="upd-actions" id="upd-actions">
                    <button class="upd-btn upd-btn-primary" id="upd-btn-now" onclick="window.__bayanUpdDownload()">⬇️ تحديث الآن</button>
                    <button class="upd-btn upd-btn-secondary" id="upd-btn-later" onclick="window.__bayanUpdLater()">لاحقًا</button>
                </div>
            </div>`;

        document.body.appendChild(div);
        div.addEventListener('click', e => { if (e.target === div) window.__bayanUpdLater(); });
    }

    // =========================================================================
    // إجراءات زر التحديث والإغلاق
    // =========================================================================
    // إجراءات زر التحديث والإغلاق
    // =========================================================================
    let downloadStartTimeout = null;

    window.__bayanUpdDownload = async function () {
        if (state.isDownloading) return;
        state.isDownloading = true;
        console.log('[Updater] Download started by user interaction.');

        const btnNow   = document.getElementById('upd-btn-now');
        const btnLater = document.getElementById('upd-btn-later');
        const prog     = document.getElementById('upd-prog');

        if (btnNow)   { btnNow.disabled = true; btnNow.textContent = '⏳ جاري بدء التحميل بالخلفية...'; }
        if (btnLater) {
            btnLater.disabled = false;
            btnLater.textContent = 'إلغاء';
            btnLater.onclick = window.__bayanUpdLater;
        }
        if (prog)     prog.classList.add('vis');

        // مؤقت أمان لمدة 10 ثوانٍ للتحقق من بدء التحميل فعلياً
        if (downloadStartTimeout) clearTimeout(downloadStartTimeout);
        downloadStartTimeout = setTimeout(() => {
            if (state.isDownloading && (!state.transferred || state.transferred === 0)) {
                console.warn('[Updater] Download progress timeout: No progress events received within 10 seconds.');
                const speedEl = document.getElementById('upd-speed');
                const lbl = document.getElementById('upd-lbl');
                if (lbl) {
                    lbl.textContent = '⚠️ تعذر بدء التنزيل التلقائي';
                    lbl.style.color = '#ef4444';
                }
                if (speedEl) {
                    speedEl.innerHTML = `<span style="color:#f87171">يرجى التأكد من توفر ملف <strong>latest.yml</strong> المرفق مع Release على GitHub والاتصال بالإنترنت.</span>`;
                }
                if (btnNow) {
                    btnNow.disabled = false;
                    btnNow.textContent = '🔄 إعادة محاولة التحميل';
                }
            }
        }, 10000);

        // 1. الوضع الأول: التشغيل داخل تطبيق Electron الفعلي (التحميل بالخلفية 100%)
        if (ipcRenderer) {
            try {
                const res = await ipcRenderer.invoke('start-download-update');
                if (res && res.success) {
                    console.log('[Updater] IPC start-download-update call succeeded.');
                    return;
                }
            } catch (err) {
                console.error('[Updater] IPC start-download-update error:', err);
            }
        }

        // 2. الوضع الثاني: التشغيل المباشر داخل المتصفح (Fallback for Browser Mode)
        console.log('[Updater] Web Browser environment detected (No Electron IPC). Triggering direct download.');
        if (downloadStartTimeout) clearTimeout(downloadStartTimeout);
        
        const downloadTarget = state.downloadUrl || GITHUB_RELEASES_PAGE;
        if (typeof showToast === 'function') {
            showToast("🚀 جاري بدء تنزيل أحدث ملف مثبت من GitHub Releases...");
        }

        const a = document.createElement('a');
        a.href = downloadTarget;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        a.remove();

        setTimeout(() => {
            window.__bayanUpdLater();
        }, 1500);
    };

    window.__bayanUpdLater = function () {
        console.log('[Updater] Modal closed by user.');
        if (downloadStartTimeout) clearTimeout(downloadStartTimeout);
        const ov = document.getElementById('bayan-update-overlay');
        if (ov) {
            ov.style.animation = 'updaterFadeIn 0.22s ease reverse';
            setTimeout(() => ov.remove(), 230);
        }
        state.isDownloading = false;
    };

    window.__bayanUpdInstall = async function () {
        console.log('[Updater] User clicked Restart and Install update.');
        const btnSuccess = document.querySelector('.upd-btn-success');
        if (btnSuccess) {
            btnSuccess.disabled = true;
            btnSuccess.textContent = '🔄 جاري إنشاء نسخة احتياطية إجبارية وتجهيز التثبيت...';
        }

        // إنشاء نسخة احتياطية شاملة وفورية لكافة البيانات قبل إغلاق وتحديث البرنامج
        try {
            if (typeof window.executeAutoBackupToFile === 'function') {
                await window.executeAutoBackupToFile(true, false);
                console.log('✅ Pre-update mandatory backup successfully created!');
            }
        } catch(e) { 
            console.warn('[Updater] Pre-update backup notice:', e); 
        }

        if (ipcRenderer) {
            try {
                await ipcRenderer.invoke('quit-and-install-update');
                return;
            } catch (e) {
                console.error('[Updater] Install update failed:', e);
            }
        }
    };

    // =========================================================================
    // 🌐 دالة الفحص الرئيسي المباشر عبر GitHub Releases API / Electron AutoUpdater
    // =========================================================================
    window.checkGitHubReleases = async function (isManual = false) {
        state.currentVersion = getCurrentAppVersion();
        
        // التحقق الفوري من حالة الاتصال بالإنترنت
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            if (isManual) {
                if (typeof showCustomAlert === 'function') {
                    showCustomAlert({
                        titleText: '⚠️ لا يوجد اتصال بالإنترنت',
                        msg: 'تحتاج اتصال بالإنترنت لإتمام فحص التحديثات الجديدة.',
                        type: 'warning'
                    });
                } else if (typeof showToast === 'function') {
                    showToast("⚠️ تحتاج اتصال بالإنترنت لإتمام فحص التحديثات", "warning");
                }
            }
            return { hasUpdate: false, error: 'offline' };
        }

        if (!IS_UPDATER_ENABLED) {
            console.log(`[Updater] Updater is currently paused for Fashion edition. Current version: v${state.currentVersion}`);
            if (isManual) {
                if (typeof showCustomAlert === 'function') {
                    showCustomAlert({
                        titleText: '✅ نظامك محدث بالكامل',
                        msg: `أنت تستخدم حالياً أحدث إصدار مستقر من بَيَان POS (نسخة الفاشون).\nرقم الإصدار المثبت لديك: v${state.currentVersion}`,
                        type: 'success'
                    });
                } else if (typeof showToast === 'function') {
                    showToast(`✅ أنت تستخدم أحدث إصدار مثبت v${state.currentVersion}`, 'success');
                }
            }
            return { hasUpdate: false, version: state.currentVersion };
        }

        console.log(`[Updater] Checking for updates. Current version: v${state.currentVersion}`);

        if (ipcRenderer) {
            try {
                if (isManual && typeof showToast === 'function') {
                    showToast("🔍 جاري التحقق من وجود تحديثات جديدة عبر السيرفر...");
                }
                const res = await ipcRenderer.invoke('check-for-updates');
                if (res && res.success) {
                    if (res.updateInfo) {
                        const newVer = (res.updateInfo.version || '').replace(/^v+/i, '');
                        if (isNewerVersion(newVer, state.currentVersion)) {
                            return res;
                        }
                    }
                    // إذا كان أحدث إصدار مسجل
                    if (isManual) {
                        if (typeof showCustomAlert === 'function') {
                            showCustomAlert({
                                titleText: '✅ نظامك محدث بالكامل',
                                msg: `أنت تستخدم حالياً أحدث إصدار مستقر من بَيَان POS.\nرقم الإصدار المثبت لديك: v${state.currentVersion}`,
                                type: 'success'
                            });
                        } else if (typeof showToast === 'function') {
                            showToast(`✅ أنت تستخدم أحدث إصدار مثبت v${state.currentVersion}`, 'success');
                        }
                    }
                    return res;
                }
            } catch (ipcErr) {
                console.warn("[Updater] IPC check-for-updates warning:", ipcErr);
            }
        }

        if (isManual && typeof showToast === 'function') {
            showToast("🔍 جاري التحقق من وجود تحديثات جديدة عبر GitHub Releases...");
        }

        try {
            let response;
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 12000);

                response = await fetch(GITHUB_API_URL, {
                    headers: { 'Accept': 'application/vnd.github.v3+json' },
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
            } catch (fetchErr) {
                if (fetchErr.name === 'AbortError' || (fetchErr.message && fetchErr.message.includes('aborted'))) {
                    if (isManual && typeof showToast === 'function') {
                        showToast("⚠️ انتهت مهلة الاتصال بسيرفر GitHub. يرجى التحقق من اتصال الإنترنت.");
                    }
                    return { hasUpdate: false, error: 'timeout' };
                }
                throw fetchErr;
            }

            if (!response.ok) {
                throw new Error(`GitHub API returned status ${response.status}`);
            }

            const release = await response.json();
            const rawTag = release.tag_name || release.name || '';
            const cleanTag = rawTag.replace(/^v+/i, '');

            if (isNewerVersion(cleanTag, state.currentVersion)) {
                console.log(`[Updater] Newer version found: v${cleanTag}`);
                state.newVersion = cleanTag;
                state.releaseNotes = release.body || 'تحسينات وإصلاحات جديدة في هذا الإصدار.';

                if (release.assets && release.assets.length > 0) {
                    const exeAsset = release.assets.find(a => a.name.endsWith('.exe')) || release.assets[0];
                    state.downloadUrl = exeAsset.browser_download_url || release.html_url;
                } else {
                    state.downloadUrl = release.html_url || GITHUB_RELEASES_PAGE;
                }

                openModal();
                return { hasUpdate: true, version: cleanTag };
            } else {
                console.log(`[Updater] App is up to date: v${state.currentVersion}`);
                if (isManual) {
                    if (typeof showCustomAlert === 'function') {
                        showCustomAlert({
                            titleText: '✅ نظامك محدث بالكامل',
                            msg: `أنت تستخدم حالياً أحدث إصدار مستقر من بَيَان POS.\nرقم الإصدار المثبت لديك: v${state.currentVersion}`,
                            type: 'success'
                        });
                    } else if (typeof showToast === 'function') {
                        showToast(`✅ أنت تستخدم أحدث إصدار مثبت v${state.currentVersion}`);
                    }
                }
                return { hasUpdate: false, version: state.currentVersion };
            }

        } catch (err) {
            console.error('[Updater] Error checking updates:', err.message);
            if (isManual && typeof showToast === 'function') {
                showToast("⚠️ تعذر الاتصال بـ GitHub Releases. يرجى التحقق من اتصالك بالإنترنت.");
            }
            return { hasUpdate: false, error: err.message };
        }
    };

    window.checkForBayanUpdatesManual = function () {
        return window.checkGitHubReleases(true);
    };

    window.checkUpdates = function (isManual = true) {
        return window.checkGitHubReleases(isManual);
    };

    window.checkForUpdates = function (isManual = true) {
        return window.checkGitHubReleases(isManual);
    };

    window.bayanCheckForUpdates = function () {
        return window.checkGitHubReleases(true);
    };

    // =========================================================================
    // 🎧 مستمعو أحداث IPC الخاصة بـ Electron (التحديث بالخلفية وإظهار التقدم)
    // =========================================================================
    if (ipcRenderer) {
        ipcRenderer.on('trigger-auto-backup-before-update', async () => {
            console.log("[Updater] Automatic pre-update backup triggered...");
            if (typeof createAutomaticBackup === 'function') {
                try { await createAutomaticBackup(false); } catch(e) { console.warn("[Updater] Auto backup notice:", e); }
            }
        });

        ipcRenderer.on('update-checking', () => {
            console.log('[Updater] Event: checking-for-update');
        });

        ipcRenderer.on('update-available', (_e, info) => {
            console.log('[Updater] Event: update-available', info);
            state.currentVersion = info.currentVersion || getCurrentAppVersion();
            state.newVersion     = info.newVersion || '';
            state.releaseNotes   = info.releaseNotes || '';
            state.isDownloaded   = false;
            state.isDownloading  = false;
            openModal();
        });

        ipcRenderer.on('update-not-available', () => {
            console.log('[Updater] Event: update-not-available');
        });

        ipcRenderer.on('update-error', (_e, errorMsg) => {
            console.error('[Updater] Event: update-error', errorMsg);
            if (downloadStartTimeout) clearTimeout(downloadStartTimeout);
            const lbl = document.getElementById('upd-lbl');
            const speedEl = document.getElementById('upd-speed');
            const btnNow = document.getElementById('upd-btn-now');

            if (lbl) {
                lbl.textContent = '⚠️ خطأ أثناء التحديث';
                lbl.style.color = '#ef4444';
            }
            if (speedEl) {
                speedEl.innerHTML = `<span style="color:#f87171">السبب: ${errorMsg || 'تعذر الاتصال بالسيرفر'}</span>`;
            }
            if (btnNow) {
                btnNow.disabled = false;
                btnNow.textContent = '🔄 إعادة المحاولة';
            }
        });

        ipcRenderer.on('update-download-progress', (_e, prog) => {
            if (downloadStartTimeout) clearTimeout(downloadStartTimeout);

            state.isDownloading = true;
            state.transferred = prog.transferred || 0;
            const pct = Math.round(prog.percent || 0);
            console.log(`[Updater] Event: download-progress: ${pct}%`);

            const fill = document.getElementById('upd-fill');
            const pctEl = document.getElementById('upd-pct');
            const lbl = document.getElementById('upd-lbl');
            const speedEl = document.getElementById('upd-speed');
            const progDiv = document.getElementById('upd-prog');

            if (progDiv) progDiv.classList.add('vis');
            if (fill) fill.style.width = pct + '%';
            if (pctEl) pctEl.textContent = pct + '%';
            if (lbl) {
                lbl.textContent = `جاري تنزيل التحديث في الخلفية... (${pct}%)`;
                lbl.style.color = '#94a3b8';
            }

            const mbTrans = ((prog.transferred || 0) / (1024 * 1024)).toFixed(1);
            const mbTotal = ((prog.total || 0) / (1024 * 1024)).toFixed(1);
            const mbSpeed = ((prog.bytesPerSecond || 0) / (1024 * 1024)).toFixed(2);
            
            const remainingBytes = (prog.total || 0) - (prog.transferred || 0);
            let etaText = '';
            if (remainingBytes > 0 && prog.bytesPerSecond > 0) {
                const etaSec = Math.round(remainingBytes / prog.bytesPerSecond);
                if (etaSec > 60) {
                    etaText = ` | المتبقي: ${Math.floor(etaSec / 60)} دقيقة و ${etaSec % 60} ثانية`;
                } else {
                    etaText = ` | المتبقي: ${etaSec} ثانية`;
                }
            }

            if (speedEl) {
                speedEl.textContent = `الحجم: ${mbTrans} MB / ${mbTotal} MB | السرعة: ${mbSpeed} MB/s${etaText}`;
            }
            document.title = `⬇️ ${pct}% - تنزيل التحديث في الخلفية`;
        });

        ipcRenderer.on('update-downloaded', (_e, info) => {
            if (downloadStartTimeout) clearTimeout(downloadStartTimeout);
            console.log('[Updater] Event: update-downloaded successfully', info);

            state.isDownloaded  = true;
            state.isDownloading = false;
            document.title = 'Bayan POS';

            const fill  = document.getElementById('upd-fill');
            const pctEl = document.getElementById('upd-pct');
            const lbl   = document.getElementById('upd-lbl');
            const acts  = document.getElementById('upd-actions');
            const speedEl = document.getElementById('upd-speed');

            if (fill)  fill.style.width = '100%';
            if (pctEl) pctEl.textContent = '100%';
            if (lbl)   { lbl.textContent = '🎉 تم تنزيل التحديث بنجاح ومحفوظ بأمان!'; lbl.style.color = '#34d399'; }
            if (speedEl) speedEl.textContent = 'التحديث جاهز للتثبيت فوراً دون فقدان أي بيانات.';

            if (acts) {
                acts.innerHTML = `
                    <button class="upd-btn upd-btn-success" onclick="window.__bayanUpdInstall()">🔄 إعادة التشغيل والتثبيت الآن</button>
                    <button class="upd-btn upd-btn-secondary" onclick="window.__bayanUpdLater()">لاحقًا</button>`;
            }
        });
    }

    // =========================================================================
    // 📢 نظام الإشعارات والرسائل السحابية الحية (Live Cloud Announcements)
    // =========================================================================
    window.latestCloudAnnouncement = null;
    window.cloudAnnouncementsHistory = [];

    // تحميل سجل الإشعارات السحابية السابقة
    const storedAnn = getStore('bayan_cloud_announcements_history');
    if (storedAnn) {
        try {
            window.cloudAnnouncementsHistory = JSON.parse(storedAnn) || [];
        } catch (e) { }
    }

    window.checkCloudAnnouncements = async function () {
        try {
            const url = 'https://raw.githubusercontent.com/ehabamr062-ux/Bayan-Pos-System/main/announcements.json?t=' + Date.now();
            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) return;
            const data = await res.json();
            if (!Array.isArray(data)) return;

            let hasNewActive = false;

            data.forEach(item => {
                const itemId = String(item.id || item.title || '').trim();
                if (!itemId) return;

                const formattedItem = {
                    id: itemId,
                    title: item.title || 'تنبيه من إدارة بيان POS',
                    message: item.message || '',
                    date: item.date || new Date().toISOString(),
                    type: item.type || 'info',
                    link: item.link || '',
                    linkText: item.linkText || 'معرفة المزيد 🔗',
                    maxViews: item.maxViews !== undefined ? item.maxViews : 1,
                    alwaysShow: !!item.alwaysShow,
                    active: item.active !== undefined ? !!item.active : true
                };

                const existingIndex = window.cloudAnnouncementsHistory.findIndex(h => h.id === itemId);
                if (existingIndex !== -1) {
                    window.cloudAnnouncementsHistory[existingIndex] = formattedItem;
                } else {
                    window.cloudAnnouncementsHistory.unshift(formattedItem);
                }

                if (formattedItem.active) {
                    hasNewActive = true;

                    const seenKey = 'bayan_seen_count_' + itemId;
                    const viewCount = parseInt(getStore(seenKey) || '0', 10);
                    const maxViews = formattedItem.alwaysShow ? Infinity : (formattedItem.maxViews !== undefined ? parseInt(formattedItem.maxViews, 10) : 1);

                    if (viewCount < maxViews) {
                        setTimeout(() => {
                            showCloudBroadcastModal(formattedItem, seenKey, viewCount);
                        }, 2500);
                    }
                }
            });

            const historyStr = JSON.stringify(window.cloudAnnouncementsHistory);
            setStore('bayan_cloud_announcements_history', historyStr);

            if (typeof updateNotifications === 'function') {
                updateNotifications();
            }
        } catch (e) {
        }
    };

    function showCloudBroadcastModal(item, seenKey, currentCount) {
        if (document.getElementById('bayan-broadcast-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'bayan-broadcast-overlay';
        overlay.style.cssText = `
            position: fixed; inset: 0; z-index: 99999;
            background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(8px);
            display: flex; align-items: center; justify-content: center;
            direction: rtl; font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
            animation: fadeIn 0.3s ease-out;
        `;

        const title = item.title || '📢 إشعار هام من إدارة نظام بيان POS';
        const message = item.message || '';
        const link = item.link || '';
        const linkText = item.linkText || 'معرفة المزيد 🔗';

        overlay.innerHTML = `
            <div style="background: linear-gradient(135deg, #0f172a, #1e293b); border: 2px solid rgba(212, 175, 55, 0.5); border-radius: 24px; padding: 28px; width: 90%; max-width: 480px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); text-align: center; color: white;">
                <div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 16px;">
                    <div style="font-size: 2.2rem;">📢</div>
                    <div>
                        <div style="font-weight: 900; font-size: 1.2rem; color: #fbbf24;">${title}</div>
                        <p style="margin: 4px 0 0; font-size: 0.8rem; color: #cbd5e1; font-weight: 700;">رسالة مباشرة من فريق التطوير</p>
                    </div>
                </div>

                <div style="background: rgba(255,255,255,0.06); border-radius: 16px; padding: 18px 20px; font-size: 0.95rem; font-weight: 700; line-height: 1.8; color: #f8fafc; margin-bottom: 22px; border: 1px solid rgba(255,255,255,0.1); white-space: pre-line;">
                    ${message}
                </div>

                <div style="display: flex; gap: 12px;">
                    ${link ? `<button onclick="window.open('${link}', '_blank'); document.getElementById('bayan-broadcast-overlay').remove(); setStore('${seenKey}', '${currentCount + 1}');" style="flex:1; padding: 12px; background: linear-gradient(135deg, #10b981, #059669); color:white; border:none; border-radius:12px; font-weight:900; cursor:pointer; font-size:0.95rem;">${linkText}</button>` : ''}
                    <button onclick="document.getElementById('bayan-broadcast-overlay').remove(); setStore('${seenKey}', '${currentCount + 1}');" style="flex:1; padding: 12px; background: rgba(255,255,255,0.15); color:white; border:1px solid rgba(255,255,255,0.25); border-radius:12px; font-weight:900; cursor:pointer; font-size:0.95rem;">إغلاق ✅</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
    }

    // =========================================================================
    // 🔔 التشغيل التلقائي عند فتح التطبيق (Auto Check on Startup)
    // =========================================================================
    const autoCheck = () => {
        setTimeout(() => {
            window.checkGitHubReleases(false);
            window.checkCloudAnnouncements();
        }, 3000);
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        autoCheck();
    } else {
        document.addEventListener('DOMContentLoaded', autoCheck);
    }

    console.log('✅ Bayan Auto Updater & Cloud Announcements (GitHub Releases Integrated): Loaded successfully.');
})();
