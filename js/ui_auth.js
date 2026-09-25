// ============================================================
//  تسجيل الدخول، الصلاحيات، NFC والإعداد الأولي (Auth & Login Engine)
// ============================================================
        function updateLoginClock() {
            const timeEl = document.getElementById('loginTime');
            const dateEl = document.getElementById('loginDate');
            if(timeEl && dateEl) {
                const now = new Date();
                timeEl.textContent = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });
                dateEl.textContent = now.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            }
        }

        function updateLoginUsersList() {
            const uSelect = document.getElementById('loginUsernameInput');
            if (!uSelect) return;
            const currentUsers = (window.users && Array.isArray(window.users) && window.users.length > 0)
                ? window.users
                : ((typeof users !== 'undefined' && Array.isArray(users)) ? users : []);
            const prevSelectedUser = uSelect.value;
            uSelect.innerHTML = '<option value="" disabled selected>-- اختر مستخدم --</option>' + 
                currentUsers.map(u => '<option value="' + u.name + '">' + u.name + ' (' + (u.role === 'admin' ? 'مدير' : 'كاشير') + ')</option>').join('');
            if (prevSelectedUser && currentUsers.some(x => x.name === prevSelectedUser)) {
                uSelect.value = prevSelectedUser;
            }
        }
        window.updateLoginUsersList = updateLoginUsersList;

        function initLogin() {
            if (loginClockInterval) clearInterval(loginClockInterval);
            updateLoginClock();
            loginClockInterval = setInterval(updateLoginClock, 1000);
            
            document.body.classList.add('is-logged-out'); // إخفاء عناصر النظام
            const modal = document.getElementById('loginModal');
            const uSelect = document.getElementById('loginUsernameInput');
            const wSelect = document.getElementById('loginWarehouseSelect');
            const standardForm = document.getElementById('standardLoginForm');
            const setupForm = document.getElementById('firstTimeSetupForm');



            // إخفاء كافة الأقسام تماماً لحماية الخصوصية قبل تسجيل الدخول
            document.querySelectorAll('.section-view').forEach(s => s.classList.add('hidden'));

            // إخفاء نافذة إدارة وصلاحيات الموظف تماماً قبل تسجيل الدخول
            const uFormCard = document.getElementById('userFormCard');
            if (uFormCard) {
                uFormCard.classList.add('hidden');
                uFormCard.style.setProperty('display', 'none', 'important');
            }

            // إظهار شريط الخلفيات والويدجت فقط في شاشة تسجيل الدخول
            const wpBar = document.getElementById('quickWpBar');
            const infoWidget = document.getElementById('quickInfoWidget');
            if (wpBar) wpBar.classList.remove('hidden');
            if (infoWidget) infoWidget.classList.remove('hidden');

            const currentUsers = (window.users && Array.isArray(window.users) && window.users.length > 0) ? window.users : ((typeof users !== 'undefined' && Array.isArray(users)) ? users : []);
            const currentWarehouses = (window.warehouses && Array.isArray(window.warehouses) && window.warehouses.length > 0) ? window.warehouses : ((typeof warehouses !== 'undefined' && Array.isArray(warehouses)) ? warehouses : [{ id: 1, name: 'المخزن الرئيسي', address: 'المقر الرئيسي' }]);

            if (typeof users !== 'undefined') users = currentUsers;
            window.users = currentUsers;
            if (typeof warehouses !== 'undefined') warehouses = currentWarehouses;
            window.warehouses = currentWarehouses;

            if (currentUsers.length === 0) {
                // شاشة إعداد المالك لأول مرة
                if (standardForm) standardForm.classList.add('hidden');
                if (setupForm) setupForm.classList.remove('hidden');
                setTimeout(() => {
                    const setupInput = document.getElementById('setupAdminName');
                    if (setupInput) setupInput.focus();
                }, 200);
            } else {
                // شاشة تسجيل الدخول المعتادة
                if (standardForm) standardForm.classList.remove('hidden');
                if (setupForm) setupForm.classList.add('hidden');

                if (uSelect) {
                    const prevSelectedUser = uSelect.value;
                    uSelect.innerHTML = '<option value="" disabled selected>-- اختر مستخدم --</option>' + 
                        currentUsers.map(u => '<option value="' + u.name + '">' + u.name + ' (' + (u.role === 'admin' ? 'مدير' : 'كاشير') + ')</option>').join('');

                    if (prevSelectedUser && currentUsers.some(x => x.name === prevSelectedUser)) {
                        uSelect.value = prevSelectedUser;
                    }

                    uSelect.onchange = () => {
                        const selectedName = uSelect.value;
                        const u = currentUsers.find(x => x.name === selectedName);
                        if (u && wSelect) {
                            if (u.warehouseScope === 'main') {
                                wSelect.value = 'المخزن الرئيسي';
                                wSelect.disabled = true;
                                wSelect.title = '🔒 هذا الحساب مقيد بالمخزن الرئيسي فقط';
                                wSelect.style.background = '#f1f5f9';
                                wSelect.style.cursor = 'not-allowed';
                            } else if (u.warehouseScope === 'specific' && u.assignedWarehouse) {
                                if (!Array.from(wSelect.options).some(opt => opt.value === u.assignedWarehouse)) {
                                    wSelect.innerHTML += `<option value="${u.assignedWarehouse}">${u.assignedWarehouse}</option>`;
                                }
                                wSelect.value = u.assignedWarehouse;
                                wSelect.disabled = true;
                                wSelect.title = `🔒 هذا الحساب مقيد بـ (${u.assignedWarehouse})`;
                                wSelect.style.background = '#f1f5f9';
                                wSelect.style.cursor = 'not-allowed';
                            } else {
                                wSelect.disabled = false;
                                wSelect.title = '';
                                wSelect.style.background = '';
                                wSelect.style.cursor = '';
                                const savedWH = (typeof getStore === 'function') ? getStore('bayan_terminal_warehouse') : null;
                                if (savedWH && currentWarehouses.some(w => w.name === savedWH)) {
                                    wSelect.value = savedWH;
                                }
                            }
                        }
                        const pInp = document.getElementById('loginPinInput');
                        if (pInp) pInp.focus();
                    };
                }
            }

            if (wSelect) {
                const prevWH = wSelect.value;
                wSelect.innerHTML = currentWarehouses.map(w => '<option value="' + w.name + '">' + w.name + '</option>').join('');
                const savedTerminalWH = (typeof getStore === 'function') ? getStore('bayan_terminal_warehouse') : null;
                if (prevWH && currentWarehouses.some(w => w.name === prevWH)) {
                    wSelect.value = prevWH;
                } else if (savedTerminalWH && currentWarehouses.some(w => w.name === savedTerminalWH)) {
                    wSelect.value = savedTerminalWH;
                }
            }

            modal.classList.remove('hidden'); 
            modal.style.display = 'flex';

            // إضافة مستمع لزر الإنتر في كافة خانات الدخول لسرعة العمل
            [uSelect, wSelect, document.getElementById('loginPinInput')].forEach(el => {
                if (el) {
                    el.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            attemptLogin();
                        }
                    });
                }
            });
        }

        function toggleLoginPassword() {
            togglePinVisibility('loginPinInput', document.getElementById('eyeIcon'));
        }

        function togglePinVisibility(inputId, btn) {
            const input = document.getElementById(inputId);
            if (!input) return;

            if (input.type === 'password') {
                input.type = 'text';
                input.style.letterSpacing = '2px';
                if (btn) btn.innerText = '🙈';
            } else {
                input.type = 'password';
                input.style.letterSpacing = inputId === 'loginPinInput' ? '5px' : '10px';
                if (btn) btn.innerText = '👁️';
            }
        }

        function getLoginLockoutState() {
            try {
                const until = parseInt((typeof getStore === 'function' ? getStore('bayan_login_lockout_until') : null) || '0', 10) || 0;
                const attempts = parseInt((typeof getStore === 'function' ? getStore('bayan_login_failed_attempts') : null) || '0', 10) || 0;
                return { until, attempts };
            } catch(e) {
                return { until: 0, attempts: 0 };
            }
        }

        function setLoginLockoutState(until, attempts) {
            try {
                if (typeof setStore === 'function') {
                    setStore('bayan_login_lockout_until', String(until || 0));
                    setStore('bayan_login_failed_attempts', String(attempts || 0));
                }
            } catch(e) {}
        }

        async function attemptLogin() {
            try {
                const now = Date.now();
                const errorMsgEl = document.getElementById('loginErrorMsg');
                let { until: loginLockoutUntil, attempts: failedLoginAttempts } = getLoginLockoutState();

                if (now < loginLockoutUntil) {
                    const remainingSec = Math.ceil((loginLockoutUntil - now) / 1000);
                    const lockMsg = `⏳ تسجيل الدخول مقفل مؤقتاً لحماية النظام بسبب تكرار المحاولات الخاطئة. يرجى الانتظار (${remainingSec}) ثانية.`;
                    if (errorMsgEl) {
                        errorMsgEl.innerText = lockMsg;
                        errorMsgEl.style.display = 'block';
                    } else {
                        alert(lockMsg);
                    }
                    return;
                }

                const username = document.getElementById('loginUsernameInput').value.trim();
                const pin = document.getElementById('loginPinInput').value;

                if (errorMsgEl) {
                    errorMsgEl.innerText = '';
                    errorMsgEl.style.display = 'none';
                }

                if (!username) {
                    if (errorMsgEl) {
                        errorMsgEl.innerText = "⚠️ يرجى اختيار مستخدم أو كتابة الاسم يدوياً";
                        errorMsgEl.style.display = 'block';
                    } else {
                        alert("يرجى اختيار مستخدم أو كتابة الاسم يدوياً");
                    }
                    return;
                }

                // البحث عن المستخدم بالاسم في قاعدة البيانات
                const foundUser = (typeof users !== 'undefined' && Array.isArray(users)) 
                    ? users.find(u => u.name === username) 
                    : null;

                if (!foundUser) {
                    if (errorMsgEl) {
                        errorMsgEl.innerText = "❌ اسم المستخدم غير موجود بالنظام!";
                        errorMsgEl.style.display = 'block';
                    } else {
                        alert("❌ اسم المستخدم غير موجود بالنظام!");
                    }
                    return;
                }

                if (foundUser.isFrozen) {
                    const frozenMsg = `🚫 تم تجميد حساب الموظف (${foundUser.name}) من قبل مدير النظام. يرجى مراجعته.`;
                    if (errorMsgEl) {
                        errorMsgEl.innerText = frozenMsg;
                        errorMsgEl.style.display = 'block';
                    }
                    if (typeof showCustomAlert === 'function') {
                        showCustomAlert({
                            type: 'error',
                            titleText: '❄️ الحساب مجمّد',
                            msg: frozenMsg
                        });
                    }
                    return;
                }

                const expectedPin = (window.BayanSecurity && typeof window.BayanSecurity.decryptPin === 'function')
                    ? window.BayanSecurity.decryptPin(foundUser.pin)
                    : foundUser.pin;

                const isPinValid = (pin === foundUser.pin || pin === expectedPin || (window.BayanSecurity && typeof window.BayanSecurity.verifyPin === 'function' && window.BayanSecurity.verifyPin(pin, foundUser.pin)));

                if (isPinValid) {
                    // 🚀 ضمان اكتمال تحميل كافة بيانات النظام في الخلفية قبل فتح واجهة المبيعات
                    if (window.loadDataPromise) {
                        try { await window.loadDataPromise; } catch(e) { console.warn("loadData await:", e); }
                    }

                    // نجاح الدخول: إعادة تعيين عداد المحاولات الخاطئة وحفظها دائماً
                    setLoginLockoutState(0, 0);

                    let whName = document.getElementById('loginWarehouseSelect').value || 'المخزن الرئيسي';
                    // ✅ أمان صارم: فرض المخزن المصرح به للموظف بناءً على إعدادات المدير
                    if (foundUser.warehouseScope === 'main') {
                        whName = 'المخزن الرئيسي';
                    } else if (foundUser.warehouseScope === 'specific' && foundUser.assignedWarehouse) {
                        whName = foundUser.assignedWarehouse;
                    }
                    if (typeof setStore === 'function') {
                        setStore('bayan_terminal_warehouse', whName);
                    }

                    // ✅ أمان: نحفظ في SQLite حصراً - الدور والصلاحيات تُحمَّل من DB
                    currentUser = { ...foundUser, warehouseName: whName };
                    window.currentUser = currentUser;
                    // 🔒 تشفير رمز PIN قبل حفظه في الجلسة المحلية لمنع ظهوره كنص صريح
                    const encPin = (window.BayanSecurity && typeof window.BayanSecurity.encryptPin === 'function')
                        ? window.BayanSecurity.encryptPin(foundUser.pin)
                        : foundUser.pin;
                    if (typeof setStore === 'function') {
                        setStore('pos_session_user', JSON.stringify({ pin: encPin, warehouseName: whName }));
                    }

                    document.getElementById('loginModal').classList.add('hidden');
                    document.body.classList.remove('is-logged-out'); // إظهار عناصر البرنامج
                    document.getElementById('currentUserDisplay').innerHTML = `<span style="opacity: 0.8;">👤</span><span>${currentUser.name} (${currentUser.role === 'admin' ? 'مدير' : 'موظف'})</span>`;
                    document.getElementById('currentWarehouseName').innerText = `📦 ${whName}`;
                    if (typeof window.updateHeaderWarehouseSelect === 'function') window.updateHeaderWarehouseSelect();
                    document.getElementById('loginUsernameInput').value = '';
                    document.getElementById('loginPinInput').value = '';
                    selectedLoginUser = null;

                    // إخفاء أدوات شاشة تسجيل الدخول بعد النجاح في الدخول
                    const wpBar = document.getElementById('quickWpBar');
                    const infoWidget = document.getElementById('quickInfoWidget');
                    if (wpBar) wpBar.classList.add('hidden');
                    if (infoWidget) infoWidget.classList.add('hidden');

                    const settingsObj = JSON.parse(getStore('pos_settings') || '{}');
                    const bType = settingsObj.businessType || 'clothing';
                    const shouldGoSales = (settingsObj.directToSalesOnLogin !== undefined)
                        ? !!settingsObj.directToSalesOnLogin
                        : (bType === 'clothing');

                    if (shouldGoSales && typeof switchSection === 'function') {
                        switchSection('sales');
                        setTimeout(() => {
                            const searchEl = document.getElementById('itemSearch') || document.getElementById('salesSearch');
                            if (searchEl) searchEl.focus();
                        }, 250);
                    } else if (typeof switchSection === 'function') {
                        switchSection('dashboard');
                    }
                    if (typeof applyPermissions === 'function') applyPermissions();
                    if (typeof updateDashboardPermissions === 'function') updateDashboardPermissions();
                    updateNotifications();
                } else {
                    failedLoginAttempts++;
                    if (failedLoginAttempts >= 5) {
                        const lockoutUntil = Date.now() + 45000; // قفل مؤقت 45 ثانية وحفظه بالقرص
                        setLoginLockoutState(lockoutUntil, 0);
                        const lockoutMsg = "⏳ تم قفل محاولات الدخول مؤقتاً لمدة 45 ثانية بسبب إدخال رمز PIN غير صحيح 5 مرات متتالية!";
                        if (errorMsgEl) {
                            errorMsgEl.innerText = lockoutMsg;
                            errorMsgEl.style.display = 'block';
                        } else {
                            alert(lockoutMsg);
                        }
                    } else {
                        setLoginLockoutState(0, failedLoginAttempts);
                        const remaining = 5 - failedLoginAttempts;
                        const failMsg = `❌ رمز المرور غير صحيح! (متبقي ${remaining} محاولات قبل القفل المؤقت)`;
                        if (errorMsgEl) {
                            errorMsgEl.innerText = failMsg;
                            errorMsgEl.style.display = 'block';
                        } else {
                            alert(failMsg);
                        }
                    }
                    document.getElementById('loginPinInput').value = '';
                }
            } catch (err) {
                console.error("Error during attemptLogin:", err);
                const errorMsgEl = document.getElementById('loginErrorMsg');
                if (errorMsgEl) {
                    errorMsgEl.innerText = "❌ حدث خطأ غير متوقع أثناء تسجيل الدخول!";
                    errorMsgEl.style.display = 'block';
                }
            }
        }

        // =========================================================================
        // 💾 النسخ الاحتياطي الطارئ المباشر من شاشة تسجيل الدخول
        // =========================================================================
        window.executeLoginEmergencyBackup = async function() {
            const card = document.getElementById('loginEmergencyBackupCard');
            const title = document.getElementById('loginBackupTitle');
            const iconBox = document.getElementById('loginBackupIconBox');
            
            // تغيير الحالة المرئية أثناء التجهيز
            if (card) {
                card.style.pointerEvents = 'none';
                card.style.opacity = '0.75';
            }
            if (title) {
                title.innerHTML = '<span>جاري إنشاء النسخة... ⏳</span>';
            }
            if (iconBox) {
                iconBox.innerHTML = '🔄';
            }

            try {
                let success = false;
                if (typeof window.executeAutoBackupToFile === 'function') {
                    // تشغيل النسخ الاحتياطي اليدوي الكامل (يحفظ في مجلد النظام وينزل الملف للمتصفح)
                    success = await window.executeAutoBackupToFile(false, true);
                } else if (typeof backupData === 'function') {
                    await backupData();
                    success = true;
                }

                if (typeof showToast === 'function') {
                    showToast("✅ تم حفظ وتأمين النسخة الاحتياطية بنجاح على جهازك!", "success");
                }
            } catch (err) {
                console.error("Login emergency backup error:", err);
                if (typeof showToast === 'function') {
                    showToast("❌ تعذر إتمام النسخ الاحتياطي، يرجى المحاولة مرة أخرى.", "error");
                }
            } finally {
                setTimeout(() => {
                    if (card) {
                        card.style.pointerEvents = 'auto';
                        card.style.opacity = '1';
                    }
                    if (title) {
                        title.innerHTML = '<span>نسخة احتياطية سريعة</span><span id="loginBackupArrow" class="login-backup-arrow">⬇️</span>';
                    }
                    if (iconBox) {
                        iconBox.innerHTML = '💾';
                    }
                }, 1000);
            }
        };

        // تنبيه ذكي لتوجيه المستخدم لأخذ نسخة احتياطية في حال توفر تحديث جديد للنظام
        window.notifyLoginBackupForUpdate = function(newVer) {
            const card = document.getElementById('loginEmergencyBackupCard');
            const sub = document.getElementById('loginBackupSubtitle');
            const tag = document.getElementById('loginBackupTag');
            if (card) {
                card.classList.add('login-backup-updating');
            }
            if (sub) {
                sub.innerHTML = `<b style="color: #fde047;">تحديث متوفر (v${newVer || ''})! احفظ بياناتك الآن</b>`;
            }
            if (tag) {
                tag.innerText = "هام ⚠️";
                tag.style.background = "rgba(234, 179, 8, 0.25)";
                tag.style.borderColor = "#eab308";
                tag.style.color = "#facc15";
            }
        };

        // =========================================================================
        // 📥 استرداد نسخة احتياطية طارئ مباشر من شاشة تسجيل الدخول (يفتح مجلد النسخ في Roaming مباشرة)
        // =========================================================================
        window.triggerLoginEmergencyRestore = async function() {
            let ipc = null;
            try {
                if (typeof window !== 'undefined' && window.require) {
                    ipc = window.require('electron').ipcRenderer;
                } else if (typeof require !== 'undefined') {
                    ipc = require('electron').ipcRenderer;
                }
            } catch(e) {}

            if (ipc) {
                const card = document.getElementById('loginEmergencyRestoreCard');
                const title = document.getElementById('loginRestoreTitle');
                if (card) {
                    card.style.pointerEvents = 'none';
                    card.style.opacity = '0.85';
                }
                if (title) {
                    title.innerHTML = '<span>جاري فتح مجلد النسخ الاحتياطية... 📁</span>';
                }

                try {
                    const res = await ipc.invoke('select-backup-file');
                    if (!res || res.canceled) {
                        if (typeof window.resetLoginEmergencyRestoreCard === 'function') {
                            window.resetLoginEmergencyRestoreCard();
                        }
                        return;
                    }
                    if (res.error) {
                        if (typeof window.resetLoginEmergencyRestoreCard === 'function') {
                            window.resetLoginEmergencyRestoreCard();
                        }
                        return alert("❌ خطأ في فتح الملف: " + res.error);
                    }

                    const sizeMb = res.fileSize ? (res.fileSize / (1024 * 1024)).toFixed(1) : '0';
                    if (title) {
                        title.innerHTML = `<span>جاري قراءة النسخة (${sizeMb} MB)... ⏳</span>`;
                    }
                    const sub = document.getElementById('loginRestoreSubtitle');
                    if (sub && parseFloat(sizeMb) > 10) {
                        sub.innerHTML = `ملف كبير (${sizeMb} MB)، جاري القراءة والتحليل...`;
                    }

                    if (typeof window.restoreDataFromContent === 'function') {
                        return await window.restoreDataFromContent(res.content, res.fileName, true, null);
                    } else if (typeof restoreDataFromContent === 'function') {
                        return await restoreDataFromContent(res.content, res.fileName, true, null);
                    }
                } catch(e) {
                    console.warn("Fallback to file input in login restore:", e);
                    if (typeof window.resetLoginEmergencyRestoreCard === 'function') {
                        window.resetLoginEmergencyRestoreCard();
                    }
                }
            }

            const input = document.getElementById('loginEmergencyRestoreInput');
            if (input) {
                input.value = '';
                input.click();
            }
        };

        window.resetLoginEmergencyRestoreCard = function() {
            const card = document.getElementById('loginEmergencyRestoreCard');
            const title = document.getElementById('loginRestoreTitle');
            const iconBox = document.getElementById('loginRestoreIconBox');
            const input = document.getElementById('loginEmergencyRestoreInput');
            if (input) input.value = '';
            if (card) {
                card.style.pointerEvents = 'auto';
                card.style.opacity = '1';
            }
            if (title) {
                title.innerHTML = '<span>استرداد نسخة احتياطية</span><span id="loginRestoreArrow" class="login-restore-arrow">🔄</span>';
            }
            if (iconBox) {
                iconBox.innerHTML = '📥';
            }
        };

        window.executeLoginEmergencyRestore = async function(input) {
            if (!input || !input.files || input.files.length === 0) return;
            const card = document.getElementById('loginEmergencyRestoreCard');
            const title = document.getElementById('loginRestoreTitle');
            const iconBox = document.getElementById('loginRestoreIconBox');

            const file = input.files[0];
            const sizeMb = file ? (file.size / (1024 * 1024)).toFixed(1) : 0;

            if (card) {
                card.style.pointerEvents = 'none';
                card.style.opacity = '0.85';
            }
            if (title) {
                title.innerHTML = `<span>جاري قراءة النسخة (${sizeMb} MB)... ⏳</span>`;
            }
            const sub = document.getElementById('loginRestoreSubtitle');
            if (sub && sizeMb > 10) {
                sub.innerHTML = `ملف كبير (${sizeMb} MB)، جاري القراءة والتحليل...`;
            }
            if (iconBox) {
                iconBox.innerHTML = '🔄';
            }

            try {
                if (typeof restoreData === 'function') {
                    await restoreData(input, true); // true = isEmergencyBypass
                } else if (typeof window.restoreData === 'function') {
                    await window.restoreData(input, true);
                } else {
                    alert("❌ محرك استعادة البيانات غير جاهز، يرجى المحاولة بعد قليل.");
                    window.resetLoginEmergencyRestoreCard();
                }
            } catch (err) {
                console.error("Emergency restore error:", err);
                window.resetLoginEmergencyRestoreCard();
            }
        };

        // =========================================================================
        // 💳 محرك تسجيل الدخول الفوري بكروت NFC / RFID
        // =========================================================================
        function attemptNfcLogin(cardUid) {
            if (!cardUid) return false;
            const uid = String(cardUid).trim();
            if (!uid) return false;

            // البحث عن الموظف المرتبط بهذا الكارت
            const foundUser = (typeof users !== 'undefined' && Array.isArray(users)) 
                ? users.find(u => u.nfcUid && String(u.nfcUid).trim().toLowerCase() === uid.toLowerCase()) 
                : null;

            const errorMsgEl = document.getElementById('loginErrorMsg');

            if (!foundUser) {
                if (errorMsgEl) {
                    errorMsgEl.innerText = `❌ كارت NFC (${uid}) غير مسجل لأي موظف بالنظام!`;
                    errorMsgEl.style.display = 'block';
                }
                if (typeof showToast === 'function') showToast(`❌ كارت NFC غير مسجل: ${uid}`, 'error');
                return false;
            }

            if (foundUser.isFrozen) {
                const frozenMsg = `🚫 تم تجميد حساب الموظف (${foundUser.name}) من قبل مدير النظام. يرجى مراجعته.`;
                if (errorMsgEl) {
                    errorMsgEl.innerText = frozenMsg;
                    errorMsgEl.style.display = 'block';
                }
                if (typeof showCustomAlert === 'function') {
                    showCustomAlert({
                        type: 'error',
                        titleText: '❄️ الحساب مجمّد',
                        msg: frozenMsg
                    });
                }
                return false;
            }

            let whName = (document.getElementById('loginWarehouseSelect') && document.getElementById('loginWarehouseSelect').value) 
                ? document.getElementById('loginWarehouseSelect').value 
                : 'المخزن الرئيسي';

            // ✅ أمان صارم: فرض المخزن المصرح به للموظف عند الدخول بكارت NFC
            if (foundUser.warehouseScope === 'main') {
                whName = 'المخزن الرئيسي';
            } else if (foundUser.warehouseScope === 'specific' && foundUser.assignedWarehouse) {
                whName = foundUser.assignedWarehouse;
            }
            if (typeof setStore === 'function') {
                setStore('bayan_terminal_warehouse', whName);
            }

            currentUser = { ...foundUser, warehouseName: whName };
            window.currentUser = currentUser;
            const encNfcPin = (window.BayanSecurity && typeof window.BayanSecurity.encryptPin === 'function')
                ? window.BayanSecurity.encryptPin(foundUser.pin)
                : foundUser.pin;
            if (typeof setStore === 'function') {
                setStore('pos_session_user', JSON.stringify({ pin: encNfcPin, warehouseName: whName }));
            }

            const loginModal = document.getElementById('loginModal');
            if (loginModal) loginModal.classList.add('hidden');
            document.body.classList.remove('is-logged-out');
            
            const userDisplay = document.getElementById('currentUserDisplay');
            if (userDisplay) {
                userDisplay.innerHTML = `<span style="opacity: 0.8;">👤</span><span>${currentUser.name} (${currentUser.role === 'admin' ? 'مدير' : 'موظف'})</span>`;
            }
            const whDisplay = document.getElementById('currentWarehouseName');
            if (whDisplay) whDisplay.innerText = `📦 ${whName}`;
            if (typeof window.updateHeaderWarehouseSelect === 'function') window.updateHeaderWarehouseSelect();

            if (document.getElementById('loginUsernameInput')) document.getElementById('loginUsernameInput').value = '';
            if (document.getElementById('loginPinInput')) document.getElementById('loginPinInput').value = '';

            const wpBar = document.getElementById('quickWpBar');
            const infoWidget = document.getElementById('quickInfoWidget');
            if (wpBar) wpBar.classList.add('hidden');
            if (infoWidget) infoWidget.classList.add('hidden');

            const settingsObjNfc = JSON.parse(getStore('pos_settings') || '{}');
            const bTypeNfc = settingsObjNfc.businessType || 'clothing';
            const shouldGoSalesNfc = (settingsObjNfc.directToSalesOnLogin !== undefined)
                ? !!settingsObjNfc.directToSalesOnLogin
                : (bTypeNfc === 'clothing');

            if (shouldGoSalesNfc && typeof switchSection === 'function') {
                switchSection('sales');
                setTimeout(() => {
                    const searchEl = document.getElementById('itemSearch') || document.getElementById('salesSearch');
                    if (searchEl) searchEl.focus();
                }, 250);
            } else if (typeof switchSection === 'function') {
                switchSection('dashboard');
            }
            if (typeof applyPermissions === 'function') applyPermissions();
            if (typeof updateDashboardPermissions === 'function') updateDashboardPermissions();
            if (typeof updateNotifications === 'function') updateNotifications();

            if (typeof showToast === 'function') showToast(`💳 أهلاً بك: ${currentUser.name} (تم الدخول بكارت NFC ✨)`, 'success');
            if (typeof logAuditAction === 'function') logAuditAction('تسجيل دخول NFC', `الموظف: ${currentUser.name}, UID: ${uid}`);
            return true;
        }

        // دالة فتح نافذة تسجيل الدخول السريع بكارت NFC
        function openQuickNfcLoginModal() {
            const modal = document.getElementById('nfcRegistrationModal');
            if (!modal) return;
            
            // تغيير النصوص لتكون مخصصة لتسجيل الدخول
            const titleEl = modal.querySelector('h3');
            const descEl = modal.querySelector('p');
            const inputEl = document.getElementById('nfcManualUidInput');
            const confirmBtn = modal.querySelector('button[onclick*="saveManualNfcUid"]');

            if (titleEl) titleEl.innerText = "⚡ الدخول الفوري بكارت NFC";
            if (descEl) descEl.innerText = "مرر كارت الموظف أمام قارئ الجهاز الآن، أو اكتب رمز الكارت ثم اضغط دخول.";
            if (inputEl) {
                inputEl.value = '';
                inputEl.placeholder = "مرر الكارت أو اكتب UID هنا...";
            }

            modal.classList.remove('hidden');
            modal.style.display = 'flex';
            setTimeout(() => { if (inputEl) inputEl.focus(); }, 150);
        }

        window.openQuickNfcLoginModal = openQuickNfcLoginModal;
        let nfcGlobalBuffer = '';
        let lastNfcKeyTimestamp = 0;

        window.addEventListener('keydown', (e) => {
            const currentTime = Date.now();
            const isLoginOpen = document.getElementById('loginModal') && !document.getElementById('loginModal').classList.contains('hidden');
            const isNfcModalOpen = document.getElementById('nfcRegistrationModal') && !document.getElementById('nfcRegistrationModal').classList.contains('hidden');

            // إذا كان المستخدم يكتب ببطء شديد يتم تصفير البافر (لقراءة الكروت السريعة من القارئ)
            if (currentTime - lastNfcKeyTimestamp > 120) {
                nfcGlobalBuffer = '';
            }
            lastNfcKeyTimestamp = currentTime;

            if (e.key === 'Enter') {
                if (nfcGlobalBuffer.length >= 3) {
                    const scannedUid = nfcGlobalBuffer.trim();
                    nfcGlobalBuffer = '';

                    // 1. إذا كانت نافذة تسجيل كارت موظف مفتوحة
                    if (isNfcModalOpen || window.isListeningForNfcRegistration) {
                        e.preventDefault();
                        if (typeof saveManualNfcUid === 'function') saveManualNfcUid(scannedUid);
                        return;
                    }

                    // 2. إذا كانت شاشة تسجيل الدخول مفتوحة
                    if (isLoginOpen) {
                        e.preventDefault();
                        attemptNfcLogin(scannedUid);
                        return;
                    }
                }
                nfcGlobalBuffer = '';
                return;
            }

            if (e.key && e.key.length === 1) {
                nfcGlobalBuffer += e.key;
            }
        }, true);

        function logout() {
            const unsaved = (typeof window.checkUnsavedDataInAllTabs === 'function') 
                ? window.checkUnsavedDataInAllTabs() 
                : null;

            if (unsaved && unsaved.hasUnsaved) {
                // التنقل والرجوع التلقائي للتبويب المعلق
                switchSection(unsaved.tabType, true, unsaved.tabId);

                if (typeof showCustomAlert === 'function') {
                    showCustomAlert({
                        titleText: '⚠️ تنبيه أمان: بيانات غير محفوظة!',
                        msg: `تنبيه: لا يمكن تسجيل الخروج لأن هناك بيانات غير محفوظة في (${unsaved.tabLabel}).\n\n📌 السبب: ${unsaved.reason}.\n\nيرجى حفظ الفاتورة/المستند أولاً أو إفراغ البيانات قبل تسجيل الخروج.`,
                        type: 'warning'
                    });
                } else {
                    alert(`⚠️ تنبيه أمان: توجد بيانات غير محفوظة في (${unsaved.tabLabel}).\n${unsaved.reason}.\n\nيرجى حفظ البيانات أولاً.`);
                }
                return;
            }

            performLogout();
        }

        async function performLogout() {
            const settings = JSON.parse(getStore('pos_settings') || '{}');
            const isAutoBackupEnabled = (settings.autoBackup === true || settings.autoBackup === 'true');
            if (isAutoBackupEnabled) {
                if (typeof window.executeAutoBackupToFile === 'function') {
                    await window.executeAutoBackupToFile(false);
                }
            }

            // ✅ أمان صارم: تفريغ وإغلاق كافة التبويبات المفتوحة فوراً لمنع تسريب بيانات المدير للموظفين
            if (typeof window.resetAllTabsForLogout === 'function') {
                window.resetAllTabsForLogout();
            }

            currentUser = null;
            window.currentUser = null;
            removeStore('pos_session_user');
            document.body.classList.add('is-logged-out'); // إخفاء كافة العناصر
            document.querySelectorAll('[data-perm]').forEach(t => t.style.display = '');
            document.getElementById('loginModal').classList.remove('hidden');
            initLogin();
        }

        /**
         * تحديث ظهور العناصر في لوحة التحكم بناءً على الصلاحيات
         */
        function updateDashboardPermissions() {
            if (typeof applyPermissions === 'function') {
                applyPermissions();
            }
            const tiles = document.querySelectorAll('[data-perm]');
            tiles.forEach(tile => {
                const perm = tile.getAttribute('data-perm');
                if (typeof hasPermission === 'function' && hasPermission(perm)) {
                    tile.style.display = '';
                } else {
                    tile.style.display = 'none';
                }
            });
        }
        window.updateDashboardPermissions = updateDashboardPermissions;

        // Consolidated Wallpaper Function (Moved to line 1392)

        // --- نظام اختصارات الكيبورد الموحد (Unified Global Keyboard Shortcuts) ---
        window.addEventListener('keydown', function(event) {
            // 0. التنقل السريع بين الأصناف بـ Ctrl + السهم (داخل كارت الصنف)
            const itemModal = document.getElementById('newItemModal');
            if (itemModal && !itemModal.classList.contains('hidden') && event.ctrlKey) {
                if (event.key === 'ArrowRight') {
                    event.preventDefault();
                    if (typeof navigateProduct === 'function') navigateProduct(1);
                    return;
                } else if (event.key === 'ArrowLeft') {
                    event.preventDefault();
                    if (typeof navigateProduct === 'function') navigateProduct(-1);
                    return;
                }
            }

            // 1. منطق زر ESC الذكي (إغلاق النوافذ أو الأقسام)
            if (event.key === 'Escape') {
                // فحص النوافذ المنبثقة المفتوحة والظاهرة فعلياً (Modals & Menus) لإغلاقها
                const modals = [
                    'royalCalculator', 'confirmModal', 'alertModal', 'newItemModal', 'newAccountModal', 
                    'quickNavModal', 'profitModal', 'priceAdjustmentModal', 
                    'wallpaperMenu', 'subscriptionModal', 'cloudRegistrationModal',
                    'transferModal', 'loginModal', 'searchInvoiceModal', 'selectReturnItemsModal',
                    'statementModal', 'dailyReportModal', 'inventoryModal', 'permissionsModal',
                    'unitSelectionModal', 'invoiceShareMenu', 'stmtShareMenu', 
                    'salesInvoiceShareMenu', 'salesShareMenu', 'purShareMenu', 'invoiceItemsModal',
                    'trashModal', 'backupModal', 'settingsModal', 'expenseModal', 'revenueModal',
                    'userFormCard'
                ];

                let modalClosed = false;
                for (const modalId of modals) {
                    const el = document.getElementById(modalId);
                    // فحص دقيق: هل العنصر موجود، وهل هو ظاهر فعلياً للمستخدم؟
                    if (el && (el.offsetWidth > 0 || el.offsetHeight > 0 || el.classList.contains('visible'))) {
                        if (!el.classList.contains('hidden') && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden') {

                            // إغلاق المودال مع مراعاة الحالة الخاصة لمنع إغلاق شاشة الدخول الإجبارية
                            if (modalId === 'loginModal') return; 

                            if (modalId === 'royalCalculator') {
                                if (typeof toggleCalculator === 'function') toggleCalculator();
                            }
                            else if (modalId === 'confirmModal') {
                                if (typeof hideCloseWarning === 'function') hideCloseWarning();
                                else el.classList.add('hidden');
                            }
                            else if (modalId === 'alertModal') el.classList.add('hidden');
                            else if (modalId === 'wallpaperMenu' || modalId.includes('ShareMenu') || modalId === 'subscriptionModal') {
                                el.classList.remove('visible');
                                el.classList.add('hidden');
                            }
                            else if (modalId === 'userFormCard') {
                                if (typeof hideUserFormCard === 'function') hideUserFormCard();
                                else {
                                    el.classList.add('hidden');
                                    el.style.setProperty('display', 'none', 'important');
                                }
                            }
                            else el.classList.add('hidden');

                            modalClosed = true;
                            break; 
                        }
                    }
                }

                if (modalClosed) return;

                // إذا لم يكن هناك مودال مفتوح، نقوم بإغلاق التبويب النشط (القسم الحالي)
                if (typeof activeTabId !== 'undefined' && activeTabId && activeTabId !== 'dashboard') {
                    if (typeof closeTab === 'function') {
                        closeTab(activeTabId);
                        event.preventDefault(); 
                    }
                }
                return;
            }

            // --- أزرار الاختصارات الوظيفية (F-Keys) ---
            if (!currentUser) return; // منع الاختصارات قبل تسجيل الدخول

            // الحصول على القسم النشط حالياً لضمان توجيه الاختصار للمكان الصحيح
            const activeSection = document.querySelector('.section-view:not(.hidden)');
            const activeSectionId = activeSection ? activeSection.id : 'dashboard';

            // تجميع وتوحيد كافة الاختصارات من أقسام النظام المختلفة
            if (event.key === 'F1') {
                event.preventDefault();
                if (typeof switchSection === 'function') switchSection('dashboard');
            } else if (event.key === 'F2') {
                event.preventDefault();
                if (typeof switchSection === 'function') switchSection('sales');
            } else if (event.key === 'F3') {
                event.preventDefault();
                if (typeof switchSection === 'function') switchSection('purchase');
            } else if (event.key === 'F4') {
                event.preventDefault();
                if (activeSectionId === 'sales-section') {
                    if (typeof printBill === 'function') printBill();
                } else if (activeSectionId === 'purchase-section') {
                    if (typeof printPurchaseBill === 'function') printPurchaseBill();
                } else if (activeSectionId === 'sales-return-section') {
                    if (typeof printReturnReceipt === 'function') printReturnReceipt('sales');
                } else if (activeSectionId === 'purchase-return-section') {
                    if (typeof printReturnReceipt === 'function') printReturnReceipt('purchase');
                } else {
                    window.print();
                }
            } else if (event.key === 'F6') {
                event.preventDefault();
                if (typeof switchSection === 'function') switchSection('settings');
                setTimeout(() => {
                    if (typeof openSettingsTab === 'function') openSettingsTab('business-profile');
                }, 100);
            } else if (event.key === 'F7') {
                event.preventDefault();
                if (typeof toggleCalculator === 'function') toggleCalculator();
            } else if (event.key === 'F9') {
                event.preventDefault();
                const isAccountModal = !document.getElementById('newAccountModal')?.classList.contains('hidden');
                const isItemModal = !document.getElementById('newItemModal')?.classList.contains('hidden');
                const isTransferModal = !document.getElementById('transferModal')?.classList.contains('hidden');

                if (isAccountModal) {
                    if (typeof saveAccount === 'function') saveAccount(false);
                } else if (isItemModal) {
                    if (typeof saveNewItem === 'function') saveNewItem('save');
                } else if (isTransferModal) {
                    if (typeof processBatchTransfer === 'function') processBatchTransfer();
                } else if (activeSectionId === 'sales-section') {
                    if (typeof saveBill === 'function') saveBill();
                } else if (activeSectionId === 'purchase-section') {
                    if (typeof savePurchase === 'function') savePurchase();
                } else if (activeSectionId === 'sales-return-section') {
                    if (typeof saveSalesReturn === 'function') saveSalesReturn();
                } else if (activeSectionId === 'purchase-return-section') {
                    if (typeof savePurchaseReturn === 'function') savePurchaseReturn();
                } else if (activeSectionId === 'receipt-section') {
                    if (typeof saveReceipt === 'function') saveReceipt(true);
                } else if (activeSectionId === 'disbursement-section') {
                    if (typeof saveDisbursement === 'function') saveDisbursement(true);
                } else if (activeSectionId === 'adjustment-section') {
                    if (typeof saveAdjustment === 'function') saveAdjustment();
                }
            } else if (event.key === 'F10') {
                event.preventDefault();
                const isAccountModal = !document.getElementById('newAccountModal')?.classList.contains('hidden');
                const isItemModal = !document.getElementById('newItemModal')?.classList.contains('hidden');

                if (isAccountModal) {
                    if (typeof closeNewAccountModal === 'function') closeNewAccountModal();
                    else document.getElementById('newAccountModal').classList.add('hidden');
                } else if (isItemModal) {
                    if (typeof closeNewItemModal === 'function') closeNewItemModal();
                    else document.getElementById('newItemModal').classList.add('hidden');
                } else if (activeSectionId === 'sales-section') {
                    if (typeof resetBill === 'function') resetBill();
                } else if (activeSectionId === 'purchase-section') {
                    if (typeof resetPurchase === 'function') resetPurchase();
                } else if (activeSectionId === 'sales-return-section') {
                    if (typeof resetReturn === 'function') resetReturn();
                } else if (activeSectionId === 'purchase-return-section') {
                    if (typeof resetPurReturn === 'function') resetPurReturn();
                } else if (activeSectionId === 'receipt-section') {
                    if (typeof resetReceipt === 'function') resetReceipt();
                } else if (activeSectionId === 'disbursement-section') {
                    if (typeof resetDisbursement === 'function') resetDisbursement();
                }
            } else if (event.key === 'F12') {
                event.preventDefault();
                if (activeSectionId === 'receipt-section') {
                    if (typeof saveReceipt === 'function') saveReceipt(true);
                } else if (activeSectionId === 'disbursement-section') {
                    if (typeof saveDisbursement === 'function') saveDisbursement(true);
                } else if (activeSectionId === 'adjustment-section') {
                    if (typeof saveAdjustment === 'function') saveAdjustment();
                }
            }
        });

    // ================= الآلة الحاسبة الملكية (Bayan Royal Calculator Logic) =================
    let calcExpression = "";
    let calcHistory = [];
    let isCalcHistoryLoaded = false; // تتبع حالة التحميل

        window.executeFirstTimeSetup = async function() {
            const name = document.getElementById('setupAdminName').value.trim();
            const pin = document.getElementById('setupAdminPin').value.trim();
            const pinConfirm = document.getElementById('setupAdminPinConfirm').value.trim();

            if (!name) return alert("❌ يرجى إدخال اسم المدير المسؤول!");
            if (!pin) return alert("❌ يرجى إدخال رمز المرور السري!");
            if (pin.length < 4) return alert("❌ يجب أن يتكون رمز المرور من 4 أرقام على الأقل!");
            if (pin !== pinConfirm) return alert("❌ رمز المرور غير متطابق!");

            try {
                // تثبيت نوع النشاط في إعدادات النظام pos_settings ليكون فاشون ومقاسات وألوان دائماً
                let posSettings = {};
                try {
                    posSettings = JSON.parse(getStore('pos_settings') || '{}');
                } catch(e) {}

                posSettings.businessType = 'clothing';
                posSettings.enableVariantsMatrix = true;

                setStore('pos_settings', JSON.stringify(posSettings));

                // إضافة المستخدم الأول كأدمن مع تشفير PIN في قاعدة البيانات
                const encPin = (window.BayanSecurity && typeof window.BayanSecurity.encryptPin === 'function')
                    ? window.BayanSecurity.encryptPin(pin)
                    : pin;
                const dbUser = { id: 1, name: name, pin: encPin, role: 'admin' };
                await db.users.add(dbUser);
                const memUser = { id: 1, name: name, pin: pin, role: 'admin' };
                users.push(memUser);

                // إتمام تسجيل الدخول للمستخدم الجديد
                currentUser = { ...memUser, warehouseName: 'المخزن الرئيسي' };
                window.currentUser = currentUser;
                setStore('pos_session_user', JSON.stringify({ pin: encPin, warehouseName: 'المخزن الرئيسي' }));

                // تعبئة بيانات كارت النجاح
                document.getElementById('displayAdminName').innerText = name;
                document.getElementById('displayAdminPin').innerText = pin;
                const displayBizEl = document.getElementById('displayAdminBusinessType');
                if (displayBizEl) displayBizEl.innerText = 'ملابس وأحذية وموضة 👕';

                document.getElementById('currentUserDisplay').innerHTML = `<span style="opacity: 0.8;">👤</span><span>${currentUser.name} (مدير)</span>`;
                document.getElementById('currentWarehouseName').innerText = `📦 المخزن الرئيسي`;

                // إظهار نافذة النجاح
                const successModal = document.getElementById('setupSuccessModal');
                if (successModal) {
                    successModal.classList.remove('hidden');
                } else {
                    alert("🎉 تم إنشاء حساب المالك وتفعيل نظام بَيَان بنجاح!\nالاسم: " + name + "\nرمز المرور: " + pin + "\nنوع النشاط: " + (bizNames[selectedBizType] || selectedBizType));
                    closeSetupSuccessAndEnter();
                }
            } catch (e) {
                console.error(e);
                alert("❌ حدث خطأ أثناء تفعيل النظام!");
            }
        };

        window.toggleSetupPassword = function(inputId, btn) {
            const input = document.getElementById(inputId);
            if (!input) return;
            if (input.type === 'password') {
                input.type = 'text';
                input.style.letterSpacing = 'normal';
                btn.innerText = '🙈';
            } else {
                input.type = 'password';
                input.style.letterSpacing = '2px';
                btn.innerText = '👁️';
            }
        };

        window.downloadCredentialsImage = function() {
            try {
                const adminName = document.getElementById('displayAdminName')?.innerText?.trim() || document.getElementById('setupAdminName')?.value?.trim() || 'المدير المسؤول';
                const bizType = document.getElementById('displayAdminBusinessType')?.innerText?.trim() || 'ملابس وأحذية وموضة 👕';
                const adminPin = document.getElementById('displayAdminPin')?.innerText?.trim() || document.getElementById('setupAdminPin')?.value?.trim() || '----';

                const canvas = document.createElement('canvas');
                canvas.width = 680;
                canvas.height = 540;
                const ctx = canvas.getContext('2d');

                // دالة مساعدة لرسم مستطيل بحواف دائرية ناعمة
                const drawRoundedRect = (x, y, w, h, r) => {
                    ctx.beginPath();
                    if (ctx.roundRect) {
                        ctx.roundRect(x, y, w, h, r);
                    } else {
                        ctx.moveTo(x + r, y);
                        ctx.lineTo(x + w - r, y);
                        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
                        ctx.lineTo(x + w, y + h - r);
                        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
                        ctx.lineTo(x + r, y + h);
                        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
                        ctx.lineTo(x, y + r);
                        ctx.quadraticCurveTo(x, y, x + r, y);
                        ctx.closePath();
                    }
                };

                // 1. خلفية متدرجة داكنة فائقة الفخامة
                const bgGrad = ctx.createLinearGradient(0, 0, 680, 540);
                bgGrad.addColorStop(0, '#1e293b');
                bgGrad.addColorStop(1, '#0b1329');
                ctx.fillStyle = bgGrad;
                drawRoundedRect(10, 10, 660, 520, 24);
                ctx.fill();

                // 2. إطار خارجي نيون أخضر زمردي
                ctx.lineWidth = 3;
                ctx.strokeStyle = '#22c55e';
                drawRoundedRect(10, 10, 660, 520, 24);
                ctx.stroke();

                // 3. الأيقونة والعناوين
                ctx.textAlign = 'center';
                ctx.fillStyle = '#ffffff';
                ctx.font = '48px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
                ctx.fillText('🎉', 340, 75);

                ctx.fillStyle = '#22c55e';
                ctx.font = 'bold 26px "Cairo", "Segoe UI", Tahoma, sans-serif';
                ctx.fillText('تم تفعيل نظام بَيَان POS بنجاح!', 340, 120);

                ctx.fillStyle = '#94a3b8';
                ctx.font = 'bold 15px "Cairo", "Segoe UI", Tahoma, sans-serif';
                ctx.fillText('كارت بيانات الدخول والاعتماد السري للمدير المسؤول', 340, 150);

                // 4. صندوق البيانات الزجاجي الداخلي
                ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
                drawRoundedRect(40, 175, 600, 240, 16);
                ctx.fill();
                ctx.lineWidth = 1;
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
                drawRoundedRect(40, 175, 600, 240, 16);
                ctx.stroke();

                // خطوط تقسيم داخلية ناعمة
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
                ctx.beginPath();
                ctx.moveTo(60, 255);
                ctx.lineTo(620, 255);
                ctx.moveTo(60, 335);
                ctx.lineTo(620, 335);
                ctx.stroke();

                // نصوص البيانات (تنسيق عربي احترافي)
                // سطر 1: اسم المستخدم
                ctx.textAlign = 'right';
                ctx.fillStyle = '#94a3b8';
                ctx.font = 'bold 17px "Cairo", "Segoe UI", Tahoma, sans-serif';
                ctx.fillText('👤  اسم المدير المسؤول:', 600, 225);

                ctx.textAlign = 'left';
                ctx.fillStyle = '#ffffff';
                ctx.font = '900 20px "Cairo", "Segoe UI", Tahoma, sans-serif';
                ctx.fillText(adminName, 70, 225);

                // سطر 2: نوع النشاط
                ctx.textAlign = 'right';
                ctx.fillStyle = '#94a3b8';
                ctx.font = 'bold 17px "Cairo", "Segoe UI", Tahoma, sans-serif';
                ctx.fillText('🏢  نوع النشاط التجاري:', 600, 305);

                ctx.textAlign = 'left';
                ctx.fillStyle = '#38bdf8';
                ctx.font = 'bold 18px "Cairo", "Segoe UI", Tahoma, sans-serif';
                ctx.fillText(bizType, 70, 305);

                // سطر 3: رمز المرور PIN
                ctx.textAlign = 'right';
                ctx.fillStyle = '#94a3b8';
                ctx.font = 'bold 17px "Cairo", "Segoe UI", Tahoma, sans-serif';
                ctx.fillText('🔑  رمز المرور السري (PIN):', 600, 385);

                ctx.textAlign = 'left';
                ctx.fillStyle = '#4ade80';
                ctx.font = '900 26px "Cairo", monospace, Tahoma, sans-serif';
                ctx.fillText(adminPin, 70, 388);

                // 5. شريط التذييل والتوثيق
                ctx.textAlign = 'center';
                ctx.fillStyle = '#64748b';
                ctx.font = 'bold 13px "Cairo", "Segoe UI", Tahoma, sans-serif';
                const todayStr = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
                ctx.fillText(`⚡ نظام بَيَان POS (Fashion Edition v${window.appVersion || '3.1.2'}) | تاريخ التفعيل: ${todayStr}`, 340, 460);

                ctx.fillStyle = '#f59e0b';
                ctx.font = 'bold 12px "Cairo", "Segoe UI", Tahoma, sans-serif';
                ctx.fillText('🔒 تنبيه أمني: يرجى الاحتفاظ بهذه الصورة في مكان آمن وعدم مشاركة الرمز مع أي شخص', 340, 485);

                // 6. تحميل فوري ولحظي بدون أي انتظار
                const link = document.createElement('a');
                const cleanName = String(adminName).replace(/[^a-zA-Z0-9\u0621-\u064A_-]/g, '_');
                link.download = `Bayan_POS_Admin_${cleanName || 'Credentials'}.png`;
                link.href = canvas.toDataURL('image/png');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                if (typeof showToast === 'function') {
                    showToast('✅ تم حفظ كارت بيانات الدخول كصورة فورية بنجاح!', 'success');
                }
                if (typeof BayanBarcode !== 'undefined' && typeof BayanBarcode.playBeep === 'function') {
                    BayanBarcode.playBeep(true);
                }
            } catch (e) {
                console.error('Canvas credentials export error:', e);
                const card = document.getElementById('setupSuccessCard');
                if (typeof html2canvas === 'function' && card) {
                    html2canvas(card, { backgroundColor: '#0f172a', scale: 2 }).then(canvas => {
                        const link = document.createElement('a');
                        link.download = 'Bayan_POS_Credentials.png';
                        link.href = canvas.toDataURL('image/png');
                        link.click();
                    });
                }
            }
        };

        window.closeSetupSuccessAndEnter = function() {
            const successModal = document.getElementById('setupSuccessModal');
            if (successModal) successModal.classList.add('hidden');
            
            document.getElementById('loginModal').classList.add('hidden');
            document.body.classList.remove('is-logged-out');
            
            // إخفاء ويدجت الخلفية
            const wpBar = document.getElementById('quickWpBar');
            const infoWidget = document.getElementById('quickInfoWidget');
            if (wpBar) wpBar.classList.add('hidden');
            if (infoWidget) infoWidget.classList.add('hidden');

            switchSection('dashboard');
            updateNotifications();
        };

        // ================= ربط مستمعات الفلاتر الزمنية لحفظ حالة التصفية التلقائية للأقسام =================
        const bindDateFilterListeners = function() {
            const configs = [
                { type: 'invoices', periodId: 'invoicesPeriodFilter', fromId: 'invoicesDateFrom', toId: 'invoicesDateTo' },
                { type: 'analysis', periodId: 'anPeriodFilter', fromId: 'anDateFrom', toId: 'anDateTo' },
                { type: 'history', periodId: 'historyPeriodFilter', fromId: 'historyDateFrom', toId: 'historyDateTo' },
                { type: 'warehouse-report', periodId: 'wrPeriodFilter', fromId: 'wrStartDate', toId: 'wrEndDate' },
                { type: 'daily-report', periodId: 'dailyReportPeriodFilter', fromId: 'reportDateFrom', toId: 'reportDateTo' },
                { type: 'statement', periodId: 'stmtPeriodFilter', fromId: 'stmtDateFrom', toId: 'stmtDateTo' }
            ];

            const saveState = (cfg) => {
                const p = document.getElementById(cfg.periodId)?.value || null;
                const f = document.getElementById(cfg.fromId)?.value || null;
                const t = document.getElementById(cfg.toId)?.value || null;
                if (!window.savedSectionDateFilters) window.savedSectionDateFilters = {};
                window.savedSectionDateFilters[cfg.type] = { periodFilter: p, dateFrom: f, dateTo: t };
            };

            configs.forEach(cfg => {
                [cfg.periodId, cfg.fromId, cfg.toId].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) {
                        el.addEventListener('change', () => saveState(cfg));
                    }
                });
            });
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', bindDateFilterListeners);
        } else {
            bindDateFilterListeners();
        }

