/**
 * Bayan POS Security & Utility Module
 * تم إزالة فحص الديباجر وحظر أدوات المطورين لضمان تشغيل كافة السكربتات وسلاسة المعاينة والتطوير
 */
(function () {
    // 🛡️ حماية خفيفة للبيانات والجلسة دون التأثير على تشغيل السكربتات
    window.BayanSecurity = {
        // تشفير خفيف للبيانات الحساسة
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

    // فحص سلامة الجلسة دورياً
    setInterval(function () {
        if (window.BayanSecurity && typeof window.BayanSecurity.validateSession === 'function') {
            window.BayanSecurity.validateSession();
        }
    }, 10000);
})();
