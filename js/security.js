/**
 * Bayan POS Security Enhancements
 * Anti-Inspect, Anti-Copy, Anti-DevTools
 */
(function () {
    // 1. منع قائمة السياق (كليك يمين)
    document.addEventListener('contextmenu', function (e) {
        // السماح بها فقط داخل حقول الإدخال
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
        }
    });

    // 2. منع اختصارات لوحة المفاتيح
    document.addEventListener('keydown', function (e) {
        // F12
        if (e.keyCode === 123) {
            e.preventDefault();
            return false;
        }

        // Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
        if (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) {
            e.preventDefault();
            return false;
        }

        // Ctrl+U (View Source)
        if (e.ctrlKey && e.keyCode === 85) {
            e.preventDefault();
            return false;
        }

        // Ctrl+S (Save As)
        if (e.ctrlKey && e.keyCode === 83) {
            e.preventDefault();
            return false;
        }

        // Ctrl+P (Print) - نمنع الطباعة من الكيبورد إذا لم تكن مقصودة من النظام
        if (e.ctrlKey && e.keyCode === 80) {
            e.preventDefault();
            return false;
        }

        // منع التحديد (Ctrl+A) والنسخ (Ctrl+C) إلا داخل حقول الإدخال
        if (e.ctrlKey && (e.keyCode === 65 || e.keyCode === 67)) {
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                return false;
            }
        }
    });

    // 3. منع التحديد بالماوس (CSS)
    const style = document.createElement('style');
    style.innerHTML = `
        body, .main-content, .sidebar, .card, .btn, span, p, h1, h2, h3, h4, h5, h6, label, div {
            -webkit-user-select: none !important;
            -moz-user-select: none !important;
            -ms-user-select: none !important;
            user-select: none !important;
        }
        
        /* استثناء حقول الإدخال لكي يستطيع الكتابة وتحديد النص داخلها */
        input, textarea, select {
            -webkit-user-select: auto !important;
            -moz-user-select: auto !important;
            -ms-user-select: auto !important;
            user-select: auto !important;
        }
    `;
    document.head.appendChild(style);



    // 4. تصفير وتعطيل الكونسول بالكامل لمنع كشف أي بيانات أو أوامر
    (function () {
        const noop = function () {};
        const methods = ['log', 'debug', 'info', 'warn', 'error', 'table', 'trace', 'dir', 'dirxml', 'group', 'groupCollapsed', 'groupEnd', 'time', 'timeEnd', 'profile', 'profileEnd', 'count'];
        for (let i = 0; i < methods.length; i++) {
            try {
                window.console[methods[i]] = noop;
            } catch (e) {}
        }
    })();

    // 5. مصيدة إيقاف فوري لمن يفتح أدوات المطورين (Anti-DevTools & Debugger Trap)
    (function () {
        let devtoolsOpen = false;
        const element = new Image();
        Object.defineProperty(element, 'id', {
            get: function () {
                devtoolsOpen = true;
                handleDevToolsDetected();
            }
        });

        function handleDevToolsDetected() {
            try {
                console.clear();
                // إظهار شاشة الحظر التلقائي
                let lockOverlay = document.getElementById('bayanSecurityLockOverlay');
                if (!lockOverlay) {
                    lockOverlay = document.createElement('div');
                    lockOverlay.id = 'bayanSecurityLockOverlay';
                    lockOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:#0f172a;z-index:99999999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;text-align:center;font-family:sans-serif;direction:rtl;';
                    lockOverlay.innerHTML = `
                        <div style="font-size:4rem;margin-bottom:15px;">🛡️</div>
                        <h1 style="color:#ef4444;font-size:1.8rem;margin-bottom:10px;font-weight:900;">⚠️ تم حظر الوصول لأدوات المطورين</h1>
                        <p style="color:#94a3b8;font-size:1.1rem;max-width:500px;line-height:1.6;margin-bottom:20px;">
                            نظام بَيَان POS محمي بالكامل. تم إيقاف وتجميد الشاشة لحماية أمان وتراخيص النظام.
                        </p>
                        <button onclick="location.reload()" style="background:#22c55e;color:#fff;border:none;padding:12px 25px;border-radius:12px;font-size:1rem;font-weight:bold;cursor:pointer;">
                            إعادة تحميل النظام 🔄
                        </button>
                    `;
                    document.body.appendChild(lockOverlay);
                }
            } catch (e) {}
        }

        // فحص دوري خفيف لاستهلاك صفر موارد
        setInterval(function () {
            // فحص عبر أبعاد الشاشة
            const threshold = 160;
            const widthThreshold = window.outerWidth - window.innerWidth > threshold;
            const heightThreshold = window.outerHeight - window.innerHeight > threshold;
            if (widthThreshold || heightThreshold) {
                handleDevToolsDetected();
            }
            // فحص عبر التمرير على الكونسول
            try {
                console.log(element);
            } catch (e) {}
        }, 1500);
    })();

    // 6. منع سحب وإسقاط الصور والنصوص
    document.addEventListener('dragstart', function (e) {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
        }
    });

    // 7. طبقة تشفير وتأمين التخزين المحلي والجلسة (Secure Storage Shield)
    window.BayanSecurity = {
        // تشفير خفيف وسريع للبيانات الحساسة
        obfuscate: function (str) {
            if (!str) return '';
            try {
                return btoa(encodeURIComponent(str).split('').reverse().join(''));
            } catch (e) {
                return str;
            }
        },
        // فك التشفير
        deobfuscate: function (str) {
            if (!str) return '';
            try {
                return decodeURIComponent(atob(str).split('').reverse().join(''));
            } catch (e) {
                return str;
            }
        },
        // التحقق من سلامة الجلسة وصلاحية المستخدم
        validateSession: function () {
            const user = window.currentUser;
            if (!user && document.getElementById('loginModal') && document.getElementById('loginModal').style.display === 'none') {
                if (typeof window.showLoginScreen === 'function') window.showLoginScreen();
            }
        }
    };

    // مراقبة أمان الجلسة دورياً
    setInterval(function () {
        if (window.BayanSecurity && typeof window.BayanSecurity.validateSession === 'function') {
            window.BayanSecurity.validateSession();
        }
    }, 5000);

})();
