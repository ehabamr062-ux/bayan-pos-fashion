/**
 * Bayan POS Security & Utility Module
 * تم إزالة فحص الديباجر وحظر أدوات المطورين لضمان تشغيل كافة السكربتات وسلاسة المعاينة والتطوير
 */
(function () {
    // 🛡️ حماية خفيفة للبيانات والجلسة دون التأثير على تشغيل السكربتات
    window.BayanSecurity = {
        // تشفير خفيف للبيانات الحساسة (Legacy Obfuscation)
        obfuscate: function (str) {
            if (!str) return '';
            try {
                return btoa(encodeURIComponent(str).split('').reverse().join(''));
            } catch (e) {
                return str;
            }
        },
        // فك التشفير (Legacy Deobfuscation)
        deobfuscate: function (str) {
            if (!str) return '';
            try {
                return decodeURIComponent(atob(str).split('').reverse().join(''));
            } catch (e) {
                return str;
            }
        },
        // 🔒 خوارزمية تشفير محسنة (Multi-layer Protected Masking)
        _secureTransform: function(str, key = 0x5A) {
            if (!str) return '';
            let out = '';
            for (let i = 0; i < str.length; i++) {
                out += String.fromCharCode(str.charCodeAt(i) ^ (key + (i % 7)));
            }
            return btoa(encodeURIComponent(out));
        },
        _secureRestore: function(b64, key = 0x5A) {
            if (!b64) return '';
            try {
                const str = decodeURIComponent(atob(b64));
                let out = '';
                for (let i = 0; i < str.length; i++) {
                    out += String.fromCharCode(str.charCodeAt(i) ^ (key + (i % 7)));
                }
                return out;
            } catch(e) {
                return '';
            }
        },
        // 🔒 تشفير آمن لرمز PIN لحفظه في قاعدة البيانات والنسخ الاحتياطية
        encryptPin: function (pin) {
            if (pin === null || pin === undefined || pin === '') return '';
            const sPin = String(pin).trim();
            if (sPin.startsWith('ENC:v2:') || sPin.startsWith('ENC:')) return sPin; // مشفر بالفعل
            try {
                const PIN_SALT = "B@Y4N_SEC_2026_#";
                return 'ENC:v2:' + this._secureTransform(PIN_SALT + sPin);
            } catch (e) {
                return 'ENC:' + this.obfuscate("B@Y4N_2026_" + sPin);
            }
        },

        // 🔓 فك تشفير رمز PIN للتحقق في الذاكرة (يدعم الإصدارين الجديد والقديم 100%)
        decryptPin: function (encPin) {
            if (!encPin) return '';
            const sEnc = String(encPin).trim();
            if (!sEnc.startsWith('ENC:')) return sEnc; // غير مشفر، قيمة قديمة بنص صريح
            
            // الإصدار المطور ENC:v2:
            if (sEnc.startsWith('ENC:v2:')) {
                try {
                    const raw = sEnc.substring(7);
                    const PIN_SALT = "B@Y4N_SEC_2026_#";
                    const restored = this._secureRestore(raw);
                    if (restored.startsWith(PIN_SALT)) {
                        return restored.substring(PIN_SALT.length);
                    }
                    return restored;
                } catch(e) {
                    return sEnc;
                }
            }

            // دعم التوافقية العكسية للرموز القديمة المشفرة بـ ENC:
            try {
                const PIN_SALT = "B@Y4N_2026_";
                const raw = sEnc.substring(4);
                const decrypted = this.deobfuscate(raw);
                if (decrypted.startsWith(PIN_SALT)) {
                    return decrypted.substring(PIN_SALT.length);
                }
                return decrypted;
            } catch (e) {
                return sEnc;
            }
        },

        // ✅ دالة التحقق المباشر الآمن من صحة الـ PIN
        verifyPin: function (enteredPin, storedPin) {
            if (enteredPin === null || enteredPin === undefined || storedPin === null || storedPin === undefined) return false;
            const cleanEntered = String(enteredPin).trim();
            const cleanStored = String(storedPin).trim();
            if (cleanStored === cleanEntered) return true;
            const plain = this.decryptPin(cleanStored);
            return String(plain).trim() === cleanEntered;
        },

        // التحقق من سلامة الجلسة وصلاحية المستخدم
        validateSession: function () {
            const user = window.currentUser;
            if (!user && document.getElementById('loginModal') && document.getElementById('loginModal').style.display === 'none') {
                if (typeof window.showLoginScreen === 'function') window.showLoginScreen();
            }
        }
    };

    // فحص سلامة الجلسة دورياً
    setInterval(function () {
        if (window.BayanSecurity && typeof window.BayanSecurity.validateSession === 'function') {
            window.BayanSecurity.validateSession();
        }
    }, 10000);
})();
