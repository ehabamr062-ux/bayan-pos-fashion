// ============================================================
//  نظام التراخيص وخطط الاشتراك وحماية الأجهزة (License & Plans)
// ============================================================
        function showSubscription() {
            const modal = document.getElementById('subscriptionModal');
            if(modal) modal.classList.remove('hidden');
            const closeBtn = document.getElementById('closeSubBtn');
            if (closeBtn) closeBtn.style.display = 'flex';

            const currentPlan = window.getBayanPlan();
            const currentPlanEl = document.getElementById('currentPlanText');
            if (currentPlanEl) {
                currentPlanEl.innerText = currentPlan;
            }

            // Calculate Trial Invoices
            let invoiceCount = 0;
            if (typeof transactions !== 'undefined') {
                const ops = transactions.filter(t => t.type && (t.type.includes('بيع') || t.type.includes('شراء')) && !t.type.includes('مرتجع') && t.invoiceId);
                const uniqueIds = new Set(ops.map(t => t.invoiceId));
                invoiceCount = uniqueIds.size;
            }
            
            const trialCountEl = document.getElementById('trialInvoicesCount');
            if (trialCountEl) trialCountEl.innerText = invoiceCount;
            
            const trialStatusEl = document.getElementById('trialStatusText');
            if (trialStatusEl) {
                if (currentPlan === 'باقة نسخة المجانية') {
                    if (invoiceCount >= 200) {
                        trialStatusEl.innerText = 'الحالة: انتهت';
                        trialStatusEl.style.color = '#ef4444'; // Red
                    } else {
                        trialStatusEl.innerText = 'الحالة: نشطة';
                        trialStatusEl.style.color = '#10b981'; // Green
                    }
                } else {
                    trialStatusEl.innerText = 'الحالة: تم استهلاك خطة النسخة التجريبية';
                    trialStatusEl.style.color = '#64748b'; // Gray
                }
            }

            // Inject animation styles if not present
            if (!document.getElementById('dynamic-plan-animations')) {
                const style = document.createElement('style');
                style.id = 'dynamic-plan-animations';
                style.textContent = `
                    @keyframes purplePulseGlow {
                        0% { border-color: #4c1d95; box-shadow: 0 0 5px rgba(76,29,149,0.4); }
                        50% { border-color: #a855f7; box-shadow: 0 0 25px rgba(168,85,247,0.8); }
                        100% { border-color: #4c1d95; box-shadow: 0 0 5px rgba(76,29,149,0.4); }
                    }
                    .plan-active-purple {
                        border: 3px solid #4c1d95 !important;
                        animation: purplePulseGlow 1.5s infinite alternate !important;
                        transform: scale(1.04) !important;
                        z-index: 10;
                        position: relative;
                    }
                `;
                document.head.appendChild(style);
            }

            // Reset all cards styling
            const allCards = document.querySelectorAll('.plan-card');
            allCards.forEach(card => {
                card.classList.remove('plan-active-purple');
                card.style.border = ''; // Revert to CSS default
                card.style.boxShadow = '';
                card.style.transform = '';
                const marker = card.querySelector('.active-marker');
                if(marker) marker.style.display = 'none';
                
                const subBtn = card.querySelector('.sub-btn');
                if (subBtn && card.id !== 'plan-باقة نسخة المجانية') {
                    subBtn.innerText = 'اشترك الآن';
                    subBtn.style.background = ''; // Revert to CSS default
                    subBtn.style.cursor = 'pointer';
                    subBtn.disabled = false;
                }
            });

            // Highlight the currently active plan
            let cardId = '';
            if (currentPlan === 'باقة نسخة المجانية') cardId = 'plan-باقة نسخة المجانية';
            else if (currentPlan === 'الباقة الشهرية') cardId = 'plan-الباقة الأساسية';
            else if (currentPlan === 'الباقة السنوية') cardId = 'plan-الباقة المتقدمة';
            else if (currentPlan === 'الباقة مدى الحياة') cardId = 'plan-الباقة الاحترافية';

            if (cardId) {
                const activeCard = document.getElementById(cardId);
                if (activeCard) {
                    activeCard.classList.add('plan-active-purple');
                    
                    const marker = activeCard.querySelector('.active-marker');
                    if(marker) {
                        marker.style.display = 'block';
                        marker.style.background = '#4c1d95'; // Dark Purple
                    }

                    const subBtn = activeCard.querySelector('.sub-btn');
                    if (subBtn && cardId !== 'plan-باقة نسخة المجانية') {
                        subBtn.innerText = 'أنت مشترك بالفعل ✓';
                        subBtn.style.background = '#4c1d95';
                        subBtn.style.cursor = 'not-allowed';
                        subBtn.disabled = true;
                    }
                }
            }
        }

        function activateFreeMonth() {
            const alreadyUsed = getStore('bayan_free_month_used');
            if (alreadyUsed === 'true') {
                alert('⚠️ تم استخدام الشهر المجاني مسبقاً على هذا الجهاز.\nللاستمرار يرجى الاشتراك في إحدى الباقات.');
                return;
            }
            const fakeStart = new Date();
            fakeStart.setDate(fakeStart.getDate() - (7 - 30));
            setStore('bayan_install_date', fakeStart.toISOString());
            setStore('bayan_free_month_used', 'true');
            const modal = document.getElementById('subscriptionModal');
            if(modal) modal.classList.add('hidden');
            setTimeout(() => {
                alert('🎉 تم تفعيل نسخة الشهر المجاني بنجاح!\n✅ لديك الآن 30 يوماً كاملاً لتجربة كامل مميزات نظام بَيَان المتكامل.\nاستمتع ونورنا! 🚀');
                location.reload();
            }, 300);
        }

        function showMyPlanDetails() {
            const modal = document.getElementById('myPlanModal');
            if(!modal) return;
            
            const hwid = getStore('bayan_hwid') || getStore('bayan_machine_id') || 'غير محدد';
            const hwidEl = document.getElementById('modalSubHwid');
            if(hwidEl) hwidEl.innerText = hwid;
            
            const currentPlan = window.getBayanPlan();
            const planEl = document.getElementById('modalSubPlan');
            if(planEl) planEl.innerText = currentPlan;
            
            const expiryDateStr = window.getBayanExpiry();
            const installDateStr = (window.activeLicense && window.activeLicense.activationDate) || getStore('bayan_install_date') || new Date().toISOString();
            const startDate = new Date(installDateStr);
            
            const startEl = document.getElementById('modalSubStartDate');
            const usedEl = document.getElementById('modalSubDaysUsed');
            const countdownEl = document.getElementById('modalSubCountdown');
            const lblUsed = document.getElementById('lblUsed');
            const lblRemaining = document.getElementById('lblRemaining');

            if (currentPlan === 'باقة نسخة المجانية') {
                if(startEl) startEl.innerText = startDate.toLocaleDateString('ar-EG');
                let invoiceCount = 0;
                if (typeof transactions !== 'undefined') {
                    const ops = transactions.filter(t => t.type && (t.type.includes('بيع') || t.type.includes('شراء')) && !t.type.includes('مرتجع') && t.invoiceId);
                    const uniqueIds = new Set(ops.map(t => t.invoiceId));
                    invoiceCount = uniqueIds.size;
                }
                if (lblUsed) lblUsed.innerHTML = '🧾 الفواتير المستخدمة';
                if (lblRemaining) lblRemaining.innerHTML = '⏳ الفواتير المتبقية';
                if (usedEl) usedEl.innerText = invoiceCount + ' فاتورة';
                if (countdownEl) {
                    const left = Math.max(0, 200 - invoiceCount);
                    countdownEl.innerText = left + ' فاتورة متبقية';
                    countdownEl.style.color = left > 50 ? 'var(--primary-color)' : 'red';
                }
            } else if (expiryDateStr) {
                const expDate = new Date(expiryDateStr);
                if(startEl) startEl.innerText = 'تاريخ الانتهاء: ' + expDate.toLocaleDateString('ar-EG');
                if (lblUsed) lblUsed.innerHTML = '⏳ حالة الباقة';
                if (lblRemaining) lblRemaining.innerHTML = '🔄 الأيام المتبقية';
                
                const diffTime = expDate - new Date();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (usedEl) usedEl.innerText = diffDays > 0 ? 'نشطة' : 'منتهية';
                
                if (countdownEl) {
                    if (diffDays <= 0) {
                        countdownEl.innerText = 'منتهي الصلاحية';
                        countdownEl.style.color = 'red';
                    } else if (diffDays > 3650) {
                        countdownEl.innerText = 'نسخة مرخصة للأبد ♾️';
                        countdownEl.style.color = 'var(--accent-gold)';
                    } else {
                        countdownEl.innerText = diffDays + ' يوم متبقي';
                        countdownEl.style.color = diffDays > 5 ? 'var(--primary-color)' : 'red';
                    }
                }
            } else {
                if(startEl) startEl.innerText = startDate.toLocaleDateString('ar-EG');
                if (lblUsed) lblUsed.innerHTML = '⏳ الأيام المستخدمة';
                if (lblRemaining) lblRemaining.innerHTML = '🔄 الأيام المتبقية';
                const diffTime = Math.abs(new Date() - startDate);
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                if (usedEl) usedEl.innerText = diffDays + ' يوم';
                if(countdownEl) {
                    if(currentPlan === 'الباقة الأساسية' || currentPlan === 'الباقة الشهرية') {
                        const left = Math.max(0, 30 - diffDays);
                        countdownEl.innerText = left + ' يوم متبقي';
                        countdownEl.style.color = left > 5 ? 'var(--primary-color)' : 'red';
                    } else if(currentPlan === 'الباقة المتقدمة' || currentPlan === 'الباقة السنوية') {
                        const left = Math.max(0, 365 - diffDays);
                        countdownEl.innerText = left + ' يوم متبقي';
                        countdownEl.style.color = left > 30 ? 'var(--primary-color)' : 'red';
                    } else if(currentPlan === 'الباقة الاحترافية' || currentPlan === 'الباقة مدى الحياة') {
                        countdownEl.innerText = 'نسخة مرخصة للأبد ♾️';
                        countdownEl.style.color = 'var(--accent-gold)';
                    }
                }
            }
            
            const transferPhone = getStore('bayan_sub_transfer_phone') || '';
            const phoneInput = document.getElementById('modalSubTransferPhone');
            if(phoneInput) phoneInput.value = transferPhone;

            modal.classList.remove('hidden');
        }

        async function verifyAndActivateLicense() {
            const inputEl = document.getElementById('activationCodeInput');
            if(!inputEl) return;
            let code = inputEl.value.trim().toUpperCase();
            if(!code) {
                if (typeof showToast === 'function') showToast("⚠️ الرجاء إدخال كود التفعيل", "warning");
                else alert("الرجاء إدخال كود التفعيل");
                return;
            }

            // فحص منع تكرار تفعيل نفس الكود
            let currentLicense = null;
            try {
                currentLicense = JSON.parse(getStore('license_info'));
            } catch(e) {}

            let usedCodes = [];
            try {
                usedCodes = JSON.parse(getStore('bayan_used_license_codes') || '[]');
            } catch(e) {}

            // إذا كان نفس الكود مفعلاً وسارياً بالفعل حالياً
            if (currentLicense && currentLicense.code === code && currentLicense.expiry) {
                const curExp = new Date(currentLicense.expiry);
                if (curExp > new Date()) {
                    const expFormatted = curExp.toLocaleDateString('ar-EG');
                    const msg = `⚠️ هذا الكود مفعّل وسارٍ بالفعل على هذا الجهاز (${currentLicense.plan}) حتى تاريخ ${expFormatted}، ولا حاجة لإعادة تفعيله!`;
                    if (typeof showToast === 'function') showToast(msg, 'warning');
                    else alert(msg);
                    return;
                }
            }

            // إذا كان الكود تم استخدامه واستهلاكه مسبقاً
            if (usedCodes.includes(code)) {
                const msg = "❌ عذراً، هذا الكود تم استخدامه واستهلاكه مسبقاً على هذا الجهاز! يرجى تجديد الاشتراك للحصول على كود جديد.";
                if (typeof showToast === 'function') showToast(msg, 'error');
                else alert(msg);
                return;
            }

            const mId = getStore('bayan_hwid') || getStore('bayan_machine_id') || '';
            const secret = atob("QkFZQU5fUE9TX1NFQ1JFVF9LRVlfMjAyNg=="); // مفتاح مشفر لمنع الفحص النصي البسيط في المتصفح

            const plans = [
                { name: "الباقة الشهرية", id: "MONTHLY" },
                { name: "الباقة السنوية", id: "ANNUAL" },
                { name: "الباقة مدى الحياة", id: "LIFETIME" }
            ];

            let matchedPlan = null;
            let hashGenerator;

            try {
                if (typeof require !== "undefined") {
                    const { ipcRenderer } = require('electron');
                    hashGenerator = async (dataStr) => {
                        return await ipcRenderer.invoke('hash-activation-payload', dataStr);
                    };
                }
            } catch(e) {}

            if (!hashGenerator && window.crypto && window.crypto.subtle) {
                try {
                    const msgEncoder = new TextEncoder();
                    const keyData = msgEncoder.encode(secret);
                    const cryptoKey = await window.crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
                    hashGenerator = async (dataStr) => {
                        const data = msgEncoder.encode(dataStr);
                        const signature = await window.crypto.subtle.sign("HMAC", cryptoKey, data);
                        const hashArray = Array.from(new Uint8Array(signature));
                        const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
                        return hashHex.substring(0, 16);
                    };
                } catch(e) {}
            }

            if (!hashGenerator) {
                try {
                    const sha256=function(r){function n(r,n){return r>>>n|r<<32-n}for(var t,e,o=Math.pow,f=o(2,32),h="length",a="",u=[],c=8*r[h],v=sha256.h=sha256.h||[],i=sha256.k=sha256.k||[],l=i[h],s={},C=2;64>l;C++)if(!s[C]){for(t=0;313>t;t+=C)s[t]=C;v[l]=o(C,.5)*f|0,i[l++]=o(C,1/3)*f|0}for(r+="\x80";r[h]%64-56;)r+="\x00";for(t=0;t<r[h];t++){if(e=r.charCodeAt(t),e>>8)return;u[t>>2]|=e<<24-t%4*8}for(u[u[h]]=c/f|0,u[u[h]]=c,e=0;e<u[h];){var g=u.slice(e,e+=16),d=v;for(v=v.slice(0,8),t=0;64>t;t++){var w=g[t-15],A=g[t-2],p=v[0],m=v[4],S=v[7]+(n(m,6)^n(m,11)^n(m,25))+(m&v[5]^~m&v[6])+i[t]+(g[t]=16>t?g[t]:g[t-16]+(n(w,7)^n(w,18)^w>>>3)+g[t-7]+(n(A,17)^n(A,19)^A>>>10)|0),b=(n(p,2)^n(p,13)^n(p,22))+(p&v[1]^p&v[2]^v[1]&v[2]);v=[S+b|0].concat(v),v[4]=v[4]+S|0}for(t=0;8>t;t++)v[t]=v[t]+d[t]|0}for(t=0;8>t;t++)for(e=3;e+1;e--){var y=v[t]>>8*e&255;a+=(16>y?0:"")+y.toString(16)}return a};
                    const hmacSha256 = (key, msg) => {
                        const blockSize = 64;
                        let keyBytes = [];
                        for(let i=0;i<key.length;i++) keyBytes.push(key.charCodeAt(i));
                        if(keyBytes.length > blockSize) {
                            const h = sha256(key);
                            keyBytes = [];
                            for(let i=0;i<h.length;i+=2) keyBytes.push(parseInt(h.substr(i,2), 16));
                        }
                        while(keyBytes.length < blockSize) keyBytes.push(0);
                        let o_key_pad = "", i_key_pad = "";
                        for(let i=0;i<blockSize;i++) {
                            o_key_pad += String.fromCharCode(keyBytes[i] ^ 0x5c);
                            i_key_pad += String.fromCharCode(keyBytes[i] ^ 0x36);
                        }
                        const hexToBin = (h) => { let s=""; for(let i=0;i<h.length;i+=2) s+=String.fromCharCode(parseInt(h.substr(i,2),16)); return s; };
                        return sha256(o_key_pad + hexToBin(sha256(i_key_pad + msg))).toUpperCase();
                    };
                    hashGenerator = async (dataStr) => hmacSha256(secret, dataStr).substring(0, 16);
                } catch(e) {}
            }

            if (!hashGenerator) {
                if (typeof showToast === "function") showToast("❌ عذراً، وظيفة التفعيل غير متاحة في هذه البيئة.", "error");
                else alert("عذراً، وظيفة التفعيل غير متاحة في هذه البيئة.");
                return;
            }

            // New Time-based Expiry Logic
            const parts = code.split("-");
            if (parts.length === 4 && parts[0] === "BYN") {
                const dateStr = parts[1]; // DDMMYY
                const planChar = parts[2]; // M, A, L
                const providedHash = parts[3]; // HASH8

                const payload = dateStr + planChar;
                const expectedHashFull = await hashGenerator(mId + payload);
                const expectedHash = expectedHashFull.substring(0, 8);
                
                console.log("=== BYN LICENSE DEBUG ===", {
                    mId: mId,
                    payload: payload,
                    expectedHashFull: expectedHashFull,
                    expectedHash: expectedHash,
                    providedHash: providedHash
                });

                if (providedHash === expectedHash) {
                    let planName = "الباقة الشهرية";
                    if (planChar === "A") planName = "الباقة السنوية";
                    if (planChar === "L") planName = "الباقة مدى الحياة";

                    // Parse Date
                    const dd = parseInt(dateStr.substring(0, 2), 10);
                    const mm = parseInt(dateStr.substring(2, 4), 10) - 1;
                    const yy = parseInt("20" + dateStr.substring(4, 6), 10);
                    const expiryDate = new Date(yy, mm, dd);
                    expiryDate.setHours(23, 59, 59, 999);

                    if (new Date() > expiryDate) {
                        if (typeof showToast === "function") showToast("❌ هذا الكود منتهي الصلاحية.", "error");
                        else alert("❌ هذا الكود منتهي الصلاحية.");
                        return;
                    }

                    await LicenseService.saveLicenseLocally(planName, expiryDate.toISOString(), code);

                    // إضافة الكود لقائمة الأكواد المستهلكة
                    if (!usedCodes.includes(code)) {
                        usedCodes.push(code);
                        setStore('bayan_used_license_codes', JSON.stringify(usedCodes));
                    }
                    
                    if (typeof showToast === "function") showToast(`🎉 تم التفعيل بنجاح! أهلاً بك في ${planName}`, "success");
                    else alert(`تم التفعيل بنجاح! 🎉\nأهلاً بك في ${planName}.`);
                    
                    const modal = document.getElementById("subscriptionModal");
                    if(modal) modal.classList.add("hidden");
                    
                    const currentPlanEl = document.getElementById("currentPlanText");
                    if(currentPlanEl) currentPlanEl.innerText = planName;
                    
                    setTimeout(() => location.reload(), 1500);
                    return;
                }
            }

            // Fallback for old codes
            for (let p of plans) {
                const dataStr = mId + p.id;
                const hash16 = await hashGenerator(dataStr);
                
                const expectedCode1 = `BYN-${hash16.substring(0,4)}-${hash16.substring(4,8)}-${hash16.substring(8,12)}-${hash16.substring(12,16)}`;
                const expectedCode2 = hash16;

                if (code === expectedCode1 || code === expectedCode2 || code === `BYN-${expectedCode2}`) {
                    matchedPlan = p.name;
                    break;
                }
            }

            if (matchedPlan) {
                setStore("bayan_current_plan", matchedPlan);
                setStore("bayan_install_date", new Date().toISOString());
                setStore("bayan_active", "true");
                
                if (typeof showToast === "function") showToast(`🎉 تم التفعيل بنجاح! أهلاً بك في ${matchedPlan}`, "success");
                else alert(`تم التفعيل بنجاح! 🎉\nأهلاً بك في ${matchedPlan}.`);
                
                const modal = document.getElementById("subscriptionModal");
                if(modal) modal.classList.add("hidden");
                
                const currentPlanEl = document.getElementById("currentPlanText");
                if(currentPlanEl) currentPlanEl.innerText = matchedPlan;
                setTimeout(() => location.reload(), 1500);
            } else {
                if (typeof showToast === "function") showToast("❌ كود التفعيل غير صحيح، يرجى التأكد من كتابته بشكل سليم.", "error");
                else alert("كود التفعيل غير صحيح، يرجى التأكد من كتابته بشكل سليم.");
            }
        }
        window.verifyAndActivateLicense = verifyAndActivateLicense;

        // دالة توليد أكواد التفعيل الرسمية للإدارة
        window.generateBayanLicenseKey = async function(machineId, plan = 'الباقة الشهرية', customExpiryDate = null) {
            if (!machineId) return { success: false, message: "يرجى تحديد Machine ID" };
            
            let planChar = "M";
            let expiryDate = new Date();
            
            if (plan.includes("سنة") || plan.includes("سنوية") || plan === "A") {
                planChar = "A";
                expiryDate.setDate(expiryDate.getDate() + 365);
            } else if (plan.includes("حياة") || plan.includes("احترافية") || plan === "L") {
                planChar = "L";
                expiryDate = new Date(2099, 11, 31);
            } else {
                planChar = "M";
                expiryDate.setDate(expiryDate.getDate() + 30);
            }
            
            if (customExpiryDate instanceof Date && !isNaN(customExpiryDate)) {
                expiryDate = customExpiryDate;
            }
            
            const dd = String(expiryDate.getDate()).padStart(2, '0');
            const mm = String(expiryDate.getMonth() + 1).padStart(2, '0');
            const yy = String(expiryDate.getFullYear()).slice(-2);
            const dateStr = dd + mm + yy;
            
            const payload = dateStr + planChar;
            const secret = atob("QkFZQU5fUE9TX1NFQ1JFVF9LRVlfMjAyNg==");
            
            let hashGenerator;
            if (typeof require !== "undefined") {
                try {
                    const { ipcRenderer } = require('electron');
                    hashGenerator = async (dataStr) => await ipcRenderer.invoke('hash-activation-payload', dataStr);
                } catch(e) {}
            }
            
            if (!hashGenerator && window.crypto && window.crypto.subtle) {
                try {
                    const msgEncoder = new TextEncoder();
                    const keyData = msgEncoder.encode(secret);
                    const cryptoKey = await window.crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
                    hashGenerator = async (dataStr) => {
                        const data = msgEncoder.encode(dataStr);
                        const signature = await window.crypto.subtle.sign("HMAC", cryptoKey, data);
                        const hashArray = Array.from(new Uint8Array(signature));
                        return hashArray.map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase().substring(0, 16);
                    };
                } catch(e) {}
            }
            
            if (!hashGenerator) {
                return { success: false, message: "تعذر تشغيل التشفير" };
            }
            
            const expectedHashFull = await hashGenerator(machineId.trim().toUpperCase() + payload);
            const hash8 = expectedHashFull.substring(0, 8);
            const activationKey = `BYN-${dateStr}-${planChar}-${hash8}`;
            
            return {
                success: true,
                activationKey: activationKey,
                plan: plan,
                expiryDate: expiryDate.toLocaleDateString('ar-EG'),
                machineId: machineId
            };
        };

        function closeSubscription() {
            document.getElementById('subscriptionModal').classList.add('hidden');
        }

window.isSubscriptionValid = function(actionType = 'invoice') {
    // 🛡️ حماية أمنية ضد التلاعب وتغيير ساعة/تاريخ الجهاز للخلف
    const nowTime = Date.now();
    const maxSeenTimeStr = getStore('bayan_max_seen_timestamp');
    let maxSeenTime = maxSeenTimeStr ? parseInt(maxSeenTimeStr, 10) : 0;

    // إذا تم تأخير ساعة الجهاز للخلف بأكثر من 5 دقائق (300000 مللي ثانية)
    if (maxSeenTime > 0 && nowTime < (maxSeenTime - 300000)) {
        window.clockTampered = true;
        return false;
    } else {
        window.clockTampered = false;
        if (nowTime > maxSeenTime) {
            setStore('bayan_max_seen_timestamp', nowTime.toString());
        }
    }

    const activeLic = window.activeLicense || { plan: 'باقة نسخة المجانية', isValid: true };
    if (!activeLic.isValid) return false;
    const currentPlan = activeLic.plan;
    
    // 1. باقة نسخة المجانية (Trial Version)
    if (currentPlan === 'باقة نسخة المجانية') {
        let count = 0;
        if (typeof transactions !== 'undefined') {
            const ops = transactions.filter(t => t.type && (t.type.includes('بيع') || t.type.includes('شراء')) && !t.type.includes('مرتجع') && t.invoiceId);
            const uniqueIds = new Set(ops.map(t => t.invoiceId));
            count = uniqueIds.size;
        }
        
        // إذا تم استهلاك 200 فاتورة، يتم قفل الفواتير والعمليات
        if (count >= 200) return false;
        
        if (actionType === 'receipt') {
            const rCount = transactions.filter(t => t.type && t.type.includes('قبض') && t.invoiceId).length;
            if (rCount >= 75) return false;
        } else if (actionType === 'disbursement') {
            const dCount = transactions.filter(t => t.type && t.type.includes('صرف') && t.invoiceId).length;
            if (dCount >= 75) return false;
        }
        
        return true; 
    }
    
    // 2. الباقات مدى الحياة (Lifetime Packages)
    if (currentPlan === 'الباقة مدى الحياة' || currentPlan === 'الباقة الاحترافية') {
        return true;
    }
    
    // 3. الباقات الزمنية (Monthly, Annual, etc.)
    const expiryDateStr = activeLic.expiry || getStore('bayan_expiry_date');
    if (expiryDateStr) {
        const expDate = new Date(expiryDateStr);
        if (new Date() > expDate) {
            return false;
        }
    } else {
        const installDateStr = getStore('bayan_install_date');
        if (installDateStr) {
            const startDate = new Date(installDateStr);
            const diffTime = Math.abs(new Date() - startDate);
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            
            if ((currentPlan === 'الباقة الشهرية' || currentPlan === 'الباقة الأساسية') && diffDays > 30) return false;
            if ((currentPlan === 'الباقة السنوية' || currentPlan === 'الباقة المتقدمة') && diffDays > 365) return false;
        }
    }
    
    return true;
};

window.enforceSubscriptionCheck = function(actionType = 'invoice') {
    if (window.clockTampered) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert({
                type: 'error',
                titleText: '🛑 تحذير أمني: تم رصد تغيير في تاريخ الجهاز!',
                msg: 'تم رصد إرجاع تاريخ أو ساعة الكمبيوتر للخلف برمجياً.\n\nلحماية أمان المنظومة والسجلات المالية، يرجى ضبط تاريخ وساعة الجهاز بالشكل الصحيح للاستمرار في إجراء وحفظ العمليات والفواتير.',
                confirmText: 'تعديل التاريخ ⚙️'
            });
        } else {
            alert("🛑 تحذير أمني: يرجى ضبط تاريخ وساعة جهاز الكمبيوتر بشكل صحيح.");
        }
        return false;
    }

    if (!window.isSubscriptionValid(actionType)) {
        const activeLic = window.activeLicense || { plan: 'باقة نسخة المجانية', isValid: true };
        const currentPlan = activeLic.plan;
        let msg = 'لقد انتهت صلاحية باقتك الحالية أو استهلكت رصيد الفواتير المجانية.\n\nيمكنك إدخال وتعديل الأصناف والحسابات بحرية، ولكن لحفظ الفواتير والعمليات الجديدة يرجى تجديد الاشتراك.';
        
        if (currentPlan === 'باقة نسخة المجانية') {
            msg = 'لقد استهلكت كامل رصيدك في النسخة التجريبية المجانية (200 فاتورة).\n\nحفظ الفواتير الجديدة مقفل حالياً. يمكنك تصفح البيانات كالمعتاد، ولفتح حفظ الفواتير يرجى الترقية لإحدى باقات بَيَان POS.';
        } else {
            msg = `لقد انتهت فترة صلاحية باقتك الحالية (${currentPlan}).\n\nيمكنك تصفح التقارير وطباعة السجلات وإدخال الأصناف والحسابات عادي، ولكن لحفظ فواتير جديدة يرجى تجديد الاشتراك.`;
        }

        if (typeof showCustomAlert === 'function') {
            showCustomAlert({
                type: 'error',
                titleText: '🛑 انتهت صلاحية الاشتراك الحالي',
                msg: msg,
                confirmText: 'عرض الباقات والاشتراك 💎',
                onConfirm: () => {
                    if (typeof toggleSubscriptionModal === 'function') toggleSubscriptionModal(true);
                }
            });
        } else {
            alert("انتهت صلاحية الباقة: " + msg);
            if (typeof toggleSubscriptionModal === 'function') toggleSubscriptionModal(true);
        }
        return false;
    }
    return true;
};

// ================= خدمة التراخيص المحمية (LicenseService) =================
// ✅ أمان: حماية window.activeLicense من التعديل المباشر عبر الكونسول
// يستخدم Object.defineProperty لجعل الخاصية للقراءة فقط من الخارج
(function() {
    let _licenseData = { plan: 'باقة نسخة المجانية', expiry: '', isValid: false };
    Object.defineProperty(window, 'activeLicense', {
        get: function() { return Object.assign({}, _licenseData); }, // إرجاع نسخة مجمّدة
        set: function(val) {
            // السماح بالتعيين فقط من داخل LicenseService (يُتحقق منه بالـ call stack)
            // اي محاولة خارجية ستُسجَّل وتُتجاهل بصمت
            const stack = new Error().stack || '';
            if (stack.includes('verifyLicense') || stack.includes('saveLicenseLocally') || stack.includes('LicenseService')) {
                _licenseData = val;
            } else {
                console.warn('🛑 محاولة تعديل الترخيص من مصدر غير مصرح!');
            }
        },
        configurable: false
    });
})();

window.LicenseService = {
    generateLicenseSignature: async function(plan, expiry, machineId) {
        if (typeof require !== 'undefined') {
            try {
                const { ipcRenderer } = require('electron');
                const sig = await ipcRenderer.invoke('generate-license-signature', plan, expiry, machineId);
                if (sig) return sig;
            } catch(e) {
                console.warn("Secure Main Process IPC not available, trying local fallback", e);
            }
        }
        
        // Local Fallback signature (without using the actual secure Main Process key)
        const dataString = `${plan}_${expiry}_${machineId}`;
        const secret = atob("QkFZQU5fUE9TX1NFQ1JFVF9LRVlfMjAyNg=="); // مفتاح مشفر لمنع الفحص النصي البسيط في المتصفح
        let hash = 0;
        for (let i = 0; i < dataString.length; i++) {
            const char = dataString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        let secretHash = 0;
        for (let i = 0; i < secret.length; i++) {
            const char = secret.charCodeAt(i);
            secretHash = ((secretHash << 5) - secretHash) + char;
            secretHash = secretHash & secretHash;
        }
        return Math.abs(hash ^ secretHash).toString(16).toUpperCase();
    },

    saveLicenseLocally: async function(plan, expiry, code = '') {
        const machineId = (window.getUniqueHWID ? await window.getUniqueHWID() : '') || getStore('bayan_hwid') || getStore('bayan_machine_id') || 'LOCAL_DEVICE';
        const signature = await this.generateLicenseSignature(plan, expiry, machineId);
        
        const licenseInfo = {
            id: 'license_info',
            plan: plan,
            expiry: expiry,
            code: code,
            machineId: machineId,
            signature: signature,
            activationDate: new Date().toISOString(),
            lastValidation: new Date().toISOString()
        };

        setStore('license_info', JSON.stringify(licenseInfo));
        window.activeLicense = {
            plan: plan,
            expiry: expiry,
            code: code,
            isValid: true
        };
    },

    verifyLicense: async function() {
        const machineId = (window.getUniqueHWID ? await window.getUniqueHWID() : '') || getStore('bayan_hwid') || getStore('bayan_machine_id') || 'LOCAL_DEVICE';
        
        let licenseInfo = null;
        try {
            licenseInfo = JSON.parse(getStore('license_info'));
        } catch(e) {}


        if (!licenseInfo) {
            const freePlan = 'باقة نسخة المجانية';
            const freeExpiry = '';
            const sig = await this.generateLicenseSignature(freePlan, freeExpiry, machineId);
            
            licenseInfo = {
                id: 'license_info',
                plan: freePlan,
                expiry: freeExpiry,
                machineId: machineId,
                signature: sig,
                activationDate: new Date().toISOString(),
                lastValidation: new Date().toISOString()
            };
            setStore('license_info', JSON.stringify(licenseInfo));
        }

        let expectedSig = await this.generateLicenseSignature(licenseInfo.plan, licenseInfo.expiry, machineId);
        
        if (licenseInfo.signature !== expectedSig || licenseInfo.machineId !== machineId) {
            // إذا كان الترخيص غير متطابق ولكنه الباقة المجانية أو محظور بسبب انتقال كود الجهاز القديم، نقوم بإصلاحه وتجديده تلقائياً للجهاز الحالي
            if (licenseInfo.plan === 'باقة نسخة المجانية' || !licenseInfo.plan || licenseInfo.plan === 'Blocked') {
                console.log("🛠️ Auto-repairing free trial license...");
                const freePlan = 'باقة نسخة المجانية';
                const freeExpiry = '';
                const sig = await this.generateLicenseSignature(freePlan, freeExpiry, machineId);
                
                licenseInfo = {
                    id: 'license_info',
                    plan: freePlan,
                    expiry: freeExpiry,
                    machineId: machineId,
                    signature: sig,
                    activationDate: licenseInfo.activationDate || new Date().toISOString(),
                    lastValidation: new Date().toISOString()
                };
                setStore('license_info', JSON.stringify(licenseInfo));
                expectedSig = sig; // تحديث التوقيع المتوقع ليطابق الجديد
            } else {
                console.error("🛑 License tampered or machine ID mismatch!");
                window.activeLicense = {
                    plan: 'Blocked',
                    expiry: '',
                    isValid: false
                };
                return false;
            }
        }

        if (licenseInfo.expiry && licenseInfo.plan !== 'باقة نسخة المجانية') {
            const expDate = new Date(licenseInfo.expiry);
            if (new Date() > expDate) {
                window.activeLicense = {
                    plan: licenseInfo.plan,
                    expiry: licenseInfo.expiry,
                    isValid: false
                };
                return false;
            }
        }

        window.activeLicense = {
            plan: licenseInfo.plan,
            expiry: licenseInfo.expiry,
            isValid: true
        };
        
        return true;
    }
};

// ================= خدمة النسخ الاحتياطي التلقائي المطور (BackupService) =================
window.BackupService = {
    createAutoBackup: async function() {
        try {
            console.log("⏳ Starting automated local database backup...");
            const products = await db.products.toArray();
            const transactions = await db.transactions.toArray();
            const accounts = await db.accounts.toArray();
            const users = await db.users.toArray();
            
            const backupRecord = {
                timestamp: new Date().toISOString(),
                products: products,
                transactions: transactions,
                accounts: accounts,
                users: users
            };
            
            await db.backups.add(backupRecord);
            console.log("✅ Automated backup created successfully!");
            await this.rotateBackups();
        } catch(e) {
            console.error("❌ Failed to create auto backup:", e);
        }
    },
    
    rotateBackups: async function() {
        try {
            const allBackups = await db.backups.toArray();
            allBackups.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            
            if (allBackups.length > 20) {
                const toDeleteCount = allBackups.length - 20;
                const deletePromises = [];
                for (let i = 0; i < toDeleteCount; i++) {
                    deletePromises.push(db.backups.delete(allBackups[i].id));
                }
                await Promise.all(deletePromises);
                console.log(`🧹 Rotated backups: Removed ${toDeleteCount} oldest backup(s).`);
            }
        } catch(e) {
            console.error("❌ Failed to rotate backups:", e);
        }
    }
};

window.getBayanPlan = function() {
    return (window.activeLicense && window.activeLicense.plan) || 'باقة نسخة المجانية';
};

window.getBayanExpiry = function() {
    return (window.activeLicense && window.activeLicense.expiry) || '';
};


function showBayanLicenseLockModal(reasonText) {
    let modal = document.getElementById('bayanLicenseLockModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'bayanLicenseLockModal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(15, 23, 42, 0.96); 
            z-index: 99999999; display: flex; align-items: center; justify-content: center;
            direction: rtl; font-family: 'Cairo', sans-serif; padding: 20px; box-sizing: border-box;
        `;
        modal.innerHTML = `
            <div style="background: #ffffff; width: 100%; max-width: 580px; border-radius: 24px; padding: 40px 30px; text-align: center; box-shadow: 0 25px 60px rgba(0,0,0,0.5); border: 2px solid #ef4444;">
                <div style="width: 80px; height: 80px; background: #fee2e2; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto;">
                    <span style="font-size: 40px; color: #ef4444;">🔒</span>
                </div>
                <h2 style="color: #991b1b; font-size: 1.8rem; font-weight: 900; margin: 0 0 15px 0;">تنبيه: انتهت فترة التجربة / الاشتراك</h2>
                <p id="bayanLockReasonText" style="color: #374151; font-size: 1.1rem; line-height: 1.7; margin: 0 0 25px 0; font-weight: 600;">${reasonText}</p>
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; margin-bottom: 25px;">
                    <div style="color: #64748b; font-size: 0.95rem; font-weight: 700; margin-bottom: 8px;">📞 لتفعيل/تجديد الاشتراك اتصل أو تواصل عبر واتساب:</div>
                    <div style="color: #064e3b; font-size: 1.6rem; font-weight: 900; letter-spacing: 1px;">01006825905</div>
                </div>
                <a href="https://wa.me/201006825905" target="_blank" style="display: inline-flex; align-items: center; justify-content: center; gap: 10px; background: #25d366; color: white; text-decoration: none; padding: 14px 30px; font-size: 1.1rem; font-weight: 800; border-radius: 14px; box-shadow: 0 8px 20px rgba(37, 211, 102, 0.3);">
                    💬 التواصل مباشرة عبر واتساب (01006825905)
                </a>
            </div>
        `;
        document.body.appendChild(modal);
    } else {
        const p = document.getElementById('bayanLockReasonText');
        if (p) p.innerText = reasonText;
        modal.style.display = 'flex';
    }
}
window.showBayanLicenseLockModal = showBayanLicenseLockModal;

function hideBayanLicenseLockModal() {
    const modal = document.getElementById('bayanLicenseLockModal');
    if (modal) modal.style.display = 'none';
}
window.hideBayanLicenseLockModal = hideBayanLicenseLockModal;

// ================= استعلام الأصناف المطور (Product Inquiry Logic) =================