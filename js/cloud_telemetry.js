// ==============================================================================
//  نظام المراقبة والرصد الصامت والتحكم عن بُعد (Silent Cloud Telemetry & Remote Control)
//  Bayan POS Fashion - Background Telemetry & Remote Management Module
// ==============================================================================

(function () {
    // الرابط الافتراضي لتطبيق Google Apps Script Web App الخاص بالمطور
    // يمكن تغييره هنا مباشرة أو حفظه في المخزن المحلي 'bayan_telemetry_url'
    const DEFAULT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwVhB9z3O87FZbW6N5AZYYafHBwGWQxirrkpQAW9mm1iCzZ4HzsyJ4nI_8d7GyQmZaurw/exec";

    window.CloudTelemetry = {
        _lastPingCount: -1,
        _lastPingTime: 0,
        _isSending: false,

        getUrl: function () {
            try {
                if (typeof getStore === 'function') {
                    const custom = getStore('bayan_telemetry_url');
                    if (custom && custom.startsWith('http')) return custom;
                }
                const local = localStorage.getItem('bayan_telemetry_url');
                if (local && local.startsWith('http')) return local;
            } catch (e) {}
            return DEFAULT_WEB_APP_URL;
        },

        setUrl: function (newUrl) {
            if (newUrl && typeof newUrl === 'string' && newUrl.startsWith('http')) {
                try {
                    if (typeof setStore === 'function') setStore('bayan_telemetry_url', newUrl);
                    localStorage.setItem('bayan_telemetry_url', newUrl);
                    console.log("✅ Cloud Telemetry URL updated successfully.");
                } catch (e) {}
            }
        },

        // جمع كافة بيانات المحل والجهاز والاستهلاك بصمت
        collectPayload: async function (triggerSource = 'periodic') {
            let mId = 'UNKNOWN-HWID';
            try {
                if (typeof getUniqueHWID === 'function') {
                    mId = await getUniqueHWID();
                } else if (typeof getMachineId === 'function') {
                    mId = getMachineId();
                } else {
                    const el = document.getElementById('displayMachineId');
                    if (el && el.innerText) mId = el.innerText.trim();
                }
            } catch (e) {}

            let shopName = 'غير محدد';
            let phone = '---';
            try {
                const elName = document.getElementById('shopName');
                if (elName && elName.value) shopName = elName.value.trim();
                const elPhone = document.getElementById('shopPhone1');
                if (elPhone && elPhone.value) phone = elPhone.value.trim();
                
                if (shopName === 'غير محدد' && typeof getStore === 'function') {
                    const sName = getStore('shopName');
                    if (sName) shopName = sName;
                }
            } catch (e) {}

            let trialCount = 0;
            try {
                if (typeof getEffectiveTrialInvoicesCount === 'function') {
                    trialCount = getEffectiveTrialInvoicesCount();
                }
            } catch (e) {}

            let maxLimit = 200;
            try {
                if (typeof getTrialInvoicesMaxLimit === 'function') {
                    maxLimit = getTrialInvoicesMaxLimit();
                }
            } catch (e) {}

            let currentPlan = 'باقة نسخة المجانية';
            try {
                if (typeof window.getBayanPlan === 'function') {
                    currentPlan = window.getBayanPlan();
                }
            } catch (e) {}

            let installDate = '';
            try {
                if (typeof getStore === 'function') {
                    installDate = getStore('bayan_install_date') || '';
                }
            } catch (e) {}

            return {
                machineId: mId,
                shopName: shopName,
                phone: phone,
                trialCount: trialCount,
                maxLimit: maxLimit,
                currentPlan: currentPlan,
                triggerSource: triggerSource,
                installDate: installDate ? new Date(installDate).toLocaleDateString('ar-EG') : '---',
                lastActive: new Date().toLocaleString('ar-EG'),
                appVersion: window.appVersion || 'V3.1.1'
            };
        },

        // إرسال التقرير واستقبال أوامر الإدارة في الخلفية
        postPayload: function (targetUrl, payload) {
            return new Promise((resolve) => {
                // 1. في بيئة Electron: نستخدم وحدة https التابعة لـ Node.js لتجاوز قيود CORS وقراءة رد الخادم فوراً
                if (typeof window !== 'undefined' && typeof window.require === 'function') {
                    try {
                        const https = window.require('https');
                        const urlModule = window.require('url');
                        
                        const executeRequest = (currentUrl, redirectCount = 0) => {
                            if (redirectCount > 5) return resolve(null);
                            const parsed = new urlModule.URL(currentUrl);
                            const isRedirect = redirectCount > 0;
                            const dataStr = JSON.stringify(payload);
                            
                            const options = {
                                hostname: parsed.hostname,
                                port: parsed.port || 443,
                                path: parsed.pathname + parsed.search,
                                method: isRedirect ? 'GET' : 'POST',
                                headers: isRedirect ? {} : {
                                    'Content-Type': 'text/plain;charset=utf-8',
                                    'Content-Length': Buffer.byteLength(dataStr)
                                },
                                timeout: 2500
                            };
                            
                            const req = https.request(options, (res) => {
                                // تتبع التحويل التلقائي (Google Apps Script Redirect 302 -> GET)
                                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                                    return executeRequest(res.headers.location, redirectCount + 1);
                                }
                                let rawData = '';
                                res.setEncoding('utf8');
                                res.on('data', (chunk) => { rawData += chunk; });
                                res.on('end', () => {
                                    try {
                                        const json = JSON.parse(rawData);
                                        resolve(json);
                                    } catch(e) {
                                        resolve(null);
                                    }
                                });
                            });
                            
                            req.on('error', () => resolve(null));
                            req.on('timeout', () => { req.destroy(); resolve(null); });
                            if (!isRedirect) {
                                req.write(dataStr);
                            }
                            req.end();
                        };
                        
                        executeRequest(targetUrl, 0);
                        return;
                    } catch(e) {
                        // الانتقال للمتصفح العادي كـ Fallback
                    }
                }

                // 2. في بيئة المتصفح العادي (PWA / Browser)
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2500);
                
                fetch(targetUrl, {
                    method: 'POST',
                    mode: 'no-cors',
                    cache: 'no-cache',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                }).then(async () => {
                    clearTimeout(timeoutId);
                    // في المتصفح نطلب doGet للتحقق من الأوامر لأن no-cors تخفي محتوى رد الـ POST
                    try {
                        const checkUrl = targetUrl + (targetUrl.includes('?') ? '&' : '?') + 'action=check_command&machineId=' + encodeURIComponent(payload.machineId);
                        const cmdCtrl = new AbortController();
                        const cmdTid = setTimeout(() => cmdCtrl.abort(), 2000);
                        const cmdRes = await fetch(checkUrl, { method: 'GET', cache: 'no-cache', signal: cmdCtrl.signal });
                        clearTimeout(cmdTid);
                        const cmdJson = await cmdRes.json();
                        resolve(cmdJson);
                    } catch(e) {
                        resolve(null);
                    }
                }).catch(() => {
                    clearTimeout(timeoutId);
                    resolve(null);
                });
            });
        },

        // فحص الأوامر عن بُعد فوراً وإرجاع النتيجة
        checkRemoteCommandNow: async function () {
            if (typeof navigator !== 'undefined' && !navigator.onLine) return null;
            const url = this.getUrl();
            if (!url || url.includes('placeholder')) return null;
            
            let mId = '';
            try {
                if (typeof getUniqueHWID === 'function') mId = await getUniqueHWID();
                else if (typeof getMachineId === 'function') mId = getMachineId();
            } catch(e) {}
            if (!mId) return null;

            let result = null;

            // في Electron:
            if (typeof window !== 'undefined' && typeof window.require === 'function') {
                try {
                    const https = window.require('https');
                    const urlModule = window.require('url');
                    const checkUrl = urlModule.format(new urlModule.URL(url + (url.includes('?') ? '&' : '?') + 'action=check_command&machineId=' + encodeURIComponent(mId)));
                    
                    result = await new Promise((resolve) => {
                        const doCheck = (target, redirects = 0) => {
                            if (redirects > 5) return resolve(null);
                            const p = new urlModule.URL(target);
                            https.get(p, { timeout: 2500 }, (res) => {
                                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                                    return doCheck(res.headers.location, redirects + 1);
                                }
                                let raw = '';
                                res.setEncoding('utf8');
                                res.on('data', c => raw += c);
                                res.on('end', () => {
                                    try {
                                        const json = JSON.parse(raw);
                                        resolve(json);
                                    } catch(e) { resolve(null); }
                                });
                            }).on('error', () => resolve(null)).on('timeout', function() { this.destroy(); resolve(null); });
                        };
                        doCheck(checkUrl, 0);
                    });
                } catch(e) {}
            }

            // Fallback في المتصفح:
            if (!result) {
                try {
                    const checkUrl = url + (url.includes('?') ? '&' : '?') + 'action=check_command&machineId=' + encodeURIComponent(mId);
                    const fbCtrl = new AbortController();
                    const fbTid = setTimeout(() => fbCtrl.abort(), 2000);
                    const resp = await fetch(checkUrl, { method: 'GET', cache: 'no-cache', signal: fbCtrl.signal });
                    clearTimeout(fbTid);
                    result = await resp.json();
                } catch(e) {}
            }

            if (result && result.command && typeof window.applyRemoteAdminCommand === 'function') {
                window.applyRemoteAdminCommand(result);
            }
            return result;
        },

        // فحص الأوامر عن بُعد الدوري
        checkRemoteCommand: async function () {
            return await this.checkRemoteCommandNow();
        },

        // إرسال التقرير الصامت إلى Google Sheets وتطبيق أي أمر وارد من الإدارة
        ping: async function (triggerSource = 'periodic') {
            // 1. الخروج الفوري إذا كان الجهاز غير متصل بالإنترنت (صفر استهلاك للموارد وأداء أوفلاين فوري)
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                return;
            }

            // منع التداخل المتزامن
            if (this._isSending) return;

            const url = this.getUrl();
            if (!url || url.includes('placeholder')) {
                return;
            }

            let trialCount = 0;
            try {
                if (typeof getEffectiveTrialInvoicesCount === 'function') {
                    trialCount = getEffectiveTrialInvoicesCount();
                }
            } catch (e) {}

            const now = Date.now();
            // تقليل معدل الإرسال (Throttling): لا داعي للإرسال إذا كان نفس العدد وتم الإرسال خلال آخر 10 دقائق إلا عند انتهاء التجربة أو أمر قسري أو فاتورة فورية
            if (triggerSource !== 'trial_expired' && triggerSource !== 'force' && triggerSource !== 'realtime_invoice') {
                if (this._lastPingCount === trialCount && (now - this._lastPingTime) < (10 * 60 * 1000)) {
                    return;
                }
            }

            this._isSending = true;

            try {
                const payload = await this.collectPayload(triggerSource);
                const response = await this.postPayload(url, payload);

                // تطبيق أمر الإدارة عن بُعد إذا كان الرد يحتوي على أمر صالح
                if (response && response.command && typeof window.applyRemoteAdminCommand === 'function') {
                    window.applyRemoteAdminCommand(response);
                }

                this._lastPingCount = trialCount;
                this._lastPingTime = now;
            } catch (e) {
                // صمت تام لضمان عدم توقف الكاشير إطلاقاً
            } finally {
                this._isSending = false;
            }
        },

        // فحص ذكي عند إصدار فاتورة جديدة لتحديد هل تستدعي إرسال تقرير أم لا
        onInvoiceCreated: function (currentInvoiceCount) {
            let maxLimit = 200;
            try {
                if (typeof getTrialInvoicesMaxLimit === 'function') {
                    maxLimit = getTrialInvoicesMaxLimit();
                }
            } catch(e) {}

            // محطات استهلاك يتم عندها إرسال التقرير:
            const milestones = [1, 5, 10, 25, 50, 75, 100, 125, 150, 175, (maxLimit - 20), (maxLimit - 10), (maxLimit - 5), (maxLimit - 2), (maxLimit - 1), maxLimit];
            const isMilestone = milestones.includes(currentInvoiceCount);
            const isEvery10 = (currentInvoiceCount > 0 && currentInvoiceCount % 10 === 0);

            // بعد الفاتورة 175 (أو آخر 25 فاتورة للتجربة)، يتم الإرسال مع كــل فاتورة جديدة فوراً وبلا أي انتظار!
            const isNearEnd = currentInvoiceCount >= (maxLimit - 25);

            if (isMilestone || isEvery10 || isNearEnd || currentInvoiceCount >= maxLimit) {
                setTimeout(() => {
                    this.ping(currentInvoiceCount >= maxLimit ? 'trial_expired' : (isNearEnd ? 'realtime_invoice' : 'milestone'));
                }, 800);
            }
        },

        // بدء تشغيل الرصد الصامت بهدوء في الخلفية
        init: function () {
            // فحص الأوامر بهدوء بعد 15 ثانية من تشغيل البرنامج لضمان اكتمال ظهور واجهة الدخول دون أي تأخير
            setTimeout(() => {
                this.checkRemoteCommandNow();
            }, 15000);

            // إرسال التقرير الأولي بالخلفية بعد 25 ثانية
            setTimeout(() => {
                this.ping('app_start');
            }, 25000);

            // استماع لعودة الإنترنت في حال كان الجهاز أوفلاين ثم اتصل بالنت
            if (typeof window !== 'undefined') {
                window.addEventListener('online', () => {
                    setTimeout(() => {
                        this.checkRemoteCommandNow();
                        this.ping('network_reconnected');
                    }, 2500);
                });

                // فحص فوري عند عودة التركيز على نافذة البرنامج (Window Focus) بمعدل ذكي (مرة كل 30 ثانية كحد أقصى)
                let lastFocusCheck = 0;
                window.addEventListener('focus', () => {
                    const now = Date.now();
                    if (now - lastFocusCheck > 30000) {
                        lastFocusCheck = now;
                        this.checkRemoteCommandNow();
                    }
                });
            }

            // فحص دوري سريع للأوامر الصادرة من Google Sheets وتحديث الرصيد كل دقيقة واحدة
            setInterval(() => {
                if (typeof navigator !== 'undefined' && navigator.onLine) {
                    this.checkRemoteCommand();
                }
            }, 60 * 1000);

            // تقرير استهلاك دوري كل 10 دقائق
            setInterval(() => {
                if (typeof navigator !== 'undefined' && navigator.onLine) {
                    this.ping('periodic');
                }
            }, 10 * 60 * 1000);
        }
    };

    // تشغيل تلقائي
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => window.CloudTelemetry.init());
    } else {
        window.CloudTelemetry.init();
    }
})();

