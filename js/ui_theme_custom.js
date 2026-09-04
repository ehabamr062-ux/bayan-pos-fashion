// ============================================================
//  تخصيص المظهر والخلفيات وشعار المؤسسة (Theme & Customization)
// ============================================================
        window.openNewBayanWindow = function() {
    try {
        if (typeof require !== 'undefined') {
            const { ipcRenderer } = require('electron');
            if (ipcRenderer) {
                ipcRenderer.invoke('open-new-window');
                return;
            }
        }
    } catch (e) {
        console.warn("Electron IPC unavailable, opening fallback window:", e);
    }
    window.open(window.location.href, '_blank');
};

function updateSubscriptionUI(hwid, plan, daysLeft) {
            const hwidEl = document.getElementById('modalSubHwid');
            const planEl = document.getElementById('modalSubPlan');
            const countEl = document.getElementById('modalSubCountdown');
            const displayHwid = document.getElementById('displayHwid');

            const startDateEl = document.getElementById('modalSubStartDate');
            const daysUsedEl = document.getElementById('modalSubDaysUsed');
            const transferPhoneEl = document.getElementById('modalSubTransferPhone');

            if (displayHwid) displayHwid.innerText = hwid;

            // تمييز كارت الباقة النشط
            const oldPlan = window.currentBayanPlanUIState || 'باقة نسخة المجانية';
            window.currentBayanPlanUIState = plan;

            // إذا انتقل المستخدم من النسخة المجانية إلى باقة مدفوعة، نسجل تاريخ بداية الاشتراك الفعلي
            if (oldPlan === 'باقة نسخة المجانية' && plan !== 'باقة نسخة المجانية') {
                setStore('bayan_paid_start_date', new Date().toISOString());
            }
            // إذا كان المستخدم أصلاً على باقة مدفوعة ولم نسجل تاريخ البدء بعد
            if (plan !== 'باقة نسخة المجانية' && !getStore('bayan_paid_start_date')) {
                setStore('bayan_paid_start_date', new Date().toISOString());
            }

            document.querySelectorAll('.plan-card').forEach(card => card.classList.remove('active-plan'));
            const activeCard = document.getElementById('plan-' + plan);
            if (activeCard) activeCard.classList.add('active-plan');

            if (!hwidEl || !planEl || !countEl) return;

            // عرض أول 8 أرقام من HWID
            hwidEl.innerText = String(hwid).substring(0, 8);
            planEl.innerText = plan;

            // حساب تاريخ التفعيل والأيام المستخدمة
            const installDateStr = getStore('bayan_install_date');
            if (installDateStr) {
                const installDate = new Date(installDateStr);
                if (startDateEl) startDateEl.innerText = installDate.toLocaleDateString('ar-EG');

                const today = new Date();
                const diffTime = Math.abs(today - installDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (daysUsedEl) daysUsedEl.innerText = diffDays + " يوم";
            }

            // استرجاع رقم التحويل
            if (transferPhoneEl) {
                transferPhoneEl.value = getStore('bayan_sub_transfer_phone') || "";
            }

            if (daysLeft <= 0) {
                countEl.innerText = "🛑 انتهى الاشتراك";
                countEl.style.color = '#ef4444';
            } else {
                countEl.innerText = `متبقي ${daysLeft} يوم`;
                if (daysLeft < 7) {
                    countEl.style.color = '#ef4444'; 
                    countEl.innerHTML += ' <span style="animation: blinkingSub 1s infinite alternate; display: inline-block;">⚠️</span>';

                    // إظهار تنبيه في الإشعارات
                    if (daysLeft <= 3) {
                        showToast(`⚠️ تنبيه: اشتراكك (${plan}) سينتهي خلال ${daysLeft} أيام!`, "warning");
                    }
                } else {
                    countEl.style.color = '#10b981'; 
                }
            }
        }

        // إظهار نافذة باقتك المنبثقة
        window.showPackageFeatures = function(planName) {
            const modal = document.getElementById('packageFeaturesModal');
            const list = document.getElementById('featPlanList');
            const nameEl = document.getElementById('featPlanName');
            const iconEl = document.getElementById('featPlanIcon');
            const descEl = document.getElementById('featPlanDescription');

            if (!modal || !list) return;

            // إعادة ضبط التبويبات للوضع الافتراضي (المميزات)
            switchPackageTab('features');

            let icon = "🚀";
            let commonItems = [
                "إدارة مبيعات ومشتريات احترافية",
                "نظام مخازن وحسابات متكامل",
                "تقارير أرباح وخسائر دقيقة",
                "دعم فني وتحديثات مستمرة",
                "أرشفة وحماية بيانات"
            ];
            let extraItems = [];

            if (planName === 'باقة نسخة المجانية') {
                icon = "🌱";
                extraItems = ["<span style='color:#ef4444; font-weight:bold;'>✖ محدودة بـ 200 فاتورة فقط للتجربة</span>"];
            } else if (planName === 'الباقة الشهرية') {
                icon = "⚙️";
                extraItems = ["✔ عدد فواتير غير محدود", "✔ دعم فني متميز"];
            } else if (planName === 'الباقة السنوية') {
                icon = "🚀";
                extraItems = ["✔ نسخ احتياطي محلي تلقائي وآمن", "✔ دعم فني VIP وأولوية قصوى"];
            } else if (planName === 'الباقة مدى الحياة') {
                icon = "👑";
                extraItems = ["✔ امتلاك البرنامج للأبد", "✔ دعم فني شامل مدى الحياة"];
            }

            nameEl.innerText = planName;
            iconEl.innerText = icon;
            if (descEl) descEl.innerHTML = `باقة <b>${planName}</b> تمنحك الوصول للميزات التالية:`;

            list.innerHTML = '';
            [...commonItems, ...extraItems].forEach(item => {
                const li = document.createElement('li');
                li.style.display = "flex";
                li.style.alignItems = "center";
                li.style.gap = "10px";
                li.style.padding = "10px";
                li.style.background = "#f8fafc";
                li.style.borderRadius = "10px";
                li.style.fontSize = "0.9rem";
                li.style.border = "1px solid #e2e8f0";

                const isLimit = item.includes('✖');
                li.innerHTML = `<span style="color: ${isLimit ? '#ef4444' : '#3b82f6'}; font-size: 1.1rem; font-weight:bold;">${isLimit ? '✖' : '✔'}</span> ${item}`;
                list.appendChild(li);
            });

            // حساب الإحصائيات لتبويب الاستهلاك
            calculateUsageStats(planName);

            modal.classList.remove('hidden');
        };

        window.switchPackageTab = function(tab) {
            const btnFeat = document.getElementById('tabFeatures');
            const btnUsage = document.getElementById('tabUsage');
            const contentFeat = document.getElementById('contentFeatures');
            const contentUsage = document.getElementById('contentUsage');

            if (!btnFeat || !btnUsage) return;

            if (tab === 'features') {
                // تلوين تبويب المميزات بالأخضر (بناءً على طلبك الجديد)
                btnFeat.classList.add('active');
                btnFeat.style.background = "#10b981";
                btnFeat.style.color = "white";
                btnFeat.style.boxShadow = "0 4px 10px rgba(16, 185, 129, 0.3)";

                btnUsage.classList.remove('active');
                btnUsage.style.background = "transparent";
                btnUsage.style.color = "#64748b";
                btnUsage.style.boxShadow = "none";

                if(contentFeat) contentFeat.classList.remove('hidden');
                if(contentUsage) contentUsage.classList.add('hidden');
            } else {
                // تلوين تبويب الاستهلاك بالأزرق
                btnUsage.classList.add('active');
                btnUsage.style.background = "#3b82f6";
                btnUsage.style.color = "white";
                btnUsage.style.boxShadow = "0 4px 10px rgba(59, 130, 246, 0.3)";

                btnFeat.classList.remove('active');
                btnFeat.style.background = "transparent";
                btnFeat.style.color = "#64748b";
                btnFeat.style.boxShadow = "none";

                if(contentFeat) contentFeat.classList.add('hidden');
                if(contentUsage) contentUsage.classList.remove('hidden');
            }
        };

        function calculateUsageStats(planName) {
            if (typeof transactions === 'undefined') return;

            const paidStartDateStr = getStore('bayan_paid_start_date');
            let filteredTransactions = transactions;

            if (planName === 'باقة نسخة المجانية') {
                // للنسخة المجانية: نعرض العمليات التي تمت قبل بداية أي اشتراك مدفوع (إن وجد) لضمان استقلالها
                if (paidStartDateStr) {
                    const startDate = new Date(paidStartDateStr);
                    filteredTransactions = transactions.filter(t => {
                        const tDate = new Date(t.dateISO || t.date);
                        return tDate < startDate;
                    });
                }
            } else {
                // للباقات المدفوعة: نعرض فقط العمليات التي تمت منذ بداية الاشتراك الفعلي
                if (paidStartDateStr) {
                    const startDate = new Date(paidStartDateStr);
                    filteredTransactions = transactions.filter(t => {
                        const tDate = new Date(t.dateISO || t.date);
                        return tDate >= startDate;
                    });
                }
            }

            // تجميع الفواتير حسب النوع (معرف فريد لكل فاتورة) من القائمة المفلترة
            const salesInvoices = new Set(filteredTransactions.filter(t => t.type && t.type.includes('بيع') && !t.type.includes('مرتجع') && t.invoiceId).map(t => t.invoiceId)).size;
            const purchaseInvoices = new Set(filteredTransactions.filter(t => t.type && t.type.includes('شراء') && !t.type.includes('مرتجع') && t.invoiceId).map(t => t.invoiceId)).size;
            const returnInvoices = new Set(filteredTransactions.filter(t => t.type && t.type.includes('مرتجع') && t.invoiceId).map(t => t.invoiceId)).size;
            const financialOps = filteredTransactions.filter(t => (t.type && (t.type.includes('قبض') || t.type.includes('صرف'))) && t.invoiceId).length;
            const otherOps = filteredTransactions.filter(t => (t.type && (t.type.includes('تسوية') || t.type.includes('تحويل'))) && t.invoiceId).length;

            const totalUsed = salesInvoices + purchaseInvoices + returnInvoices + financialOps + otherOps;
            const limit = (planName === 'باقة نسخة المجانية') ? 200 : Infinity;

            if(document.getElementById('usageTotalCount')) document.getElementById('usageTotalCount').innerText = totalUsed;
            const remainEl = document.getElementById('usageRemaining');
            const percentText = document.getElementById('usagePercentText');
            const progressBar = document.getElementById('usageProgressBar');

            if (limit === Infinity) {
                if(remainEl) { remainEl.innerText = "∞ (غير محدود)"; remainEl.style.color = "#10b981"; }
                if(percentText) percentText.innerText = "0%";
                if(progressBar) progressBar.style.width = "0%";
            } else {
                const remaining = Math.max(0, limit - totalUsed);
                if(remainEl) {
                    remainEl.innerText = remaining;
                    remainEl.style.color = remaining > 10 ? "#10b981" : "#ef4444";
                }

                const percent = Math.min(100, Math.round((totalUsed / limit) * 100));
                if(percentText) percentText.innerText = percent + "%";
                if(progressBar) {
                    progressBar.style.width = percent + "%";
                    progressBar.style.background = percent > 90 ? "#ef4444" : (percent > 70 ? "#f59e0b" : "#3b82f6");
                }
            }

            // ملء الجدول التفصيلي
            const detailsBody = document.getElementById('usageDetailsBody');
            if(detailsBody) {
                detailsBody.innerHTML = `
                    <tr><td style="padding:10px; border-bottom:1px solid #eee;">🛒 فواتير المبيعات</td><td style="text-align:center; font-weight:bold;">${salesInvoices}</td></tr>
                    <tr><td style="padding:10px; border-bottom:1px solid #eee;">🧺 فواتير المشتريات</td><td style="text-align:center; font-weight:bold;">${purchaseInvoices}</td></tr>
                    <tr><td style="padding:10px; border-bottom:1px solid #eee;">🔄 المرتجعات</td><td style="text-align:center; font-weight:bold;">${returnInvoices}</td></tr>
                    <tr><td style="padding:10px; border-bottom:1px solid #eee;">💵 سندات (قبض/صرف)</td><td style="text-align:center; font-weight:bold;">${financialOps}</td></tr>
                    <tr><td style="padding:10px;">⚖️ عمليات أخرى</td><td style="text-align:center; font-weight:bold;">${otherOps}</td></tr>
                `;
            }
        }

        // دالة نسخ النصوص للحافظة
        function showPLReport() {
            let totalSales = 0;
            let totalCost = 0;
            let totalExpenses = 0;
            let totalReceiptsOther = 0;

            // 1. حساب المبيعات والتكلفة من العمليات
            transactions.forEach(t => {
                if (t.type && t.type.includes('بيع') && !t.type.includes('مرتجع')) {
                    totalSales += parseFloat(t.total) || 0;
                    // استخدام الربح المحفوظ مباشرةً إن وُجد (يراعي الوحدات الفرعية)
                    if (t.profit !== undefined && t.profit !== null && t.profit !== '') {
                        totalCost += (parseFloat(t.total) || 0) - (parseFloat(t.profit) || 0);
                    } else {
                        // احتياطي: حساب من تكلفة المنتج الأساسية
                        const p = productsDB.find(prod => prod.name === t.product);
                        const cost = p ? (parseFloat(p.cost) || 0) : 0;
                        totalCost += cost * (parseFloat(t.qty) || 0);
                    }
                }
                if (t.type === 'قبض' && !t.isSale) {
                    totalReceiptsOther += parseFloat(t.total) || 0;
                }
                if (t.type === 'صرف') {
                    totalExpenses += parseFloat(t.total) || 0;
                }
            });

            const grossProfit = totalSales - totalCost;
            const netProfit = grossProfit + totalReceiptsOther - totalExpenses;

            const html = `
                <div style="text-align:right; padding:10px;">
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-top:15px;">
                        <div style="padding:15px; background:#e8f5e9; border-radius:10px; border-right:5px solid #2e7d32;">
                            <label style="color:#2e7d32; display:block; margin-bottom:5px;">💰 إجمالي المبيعات</label>
                            <span style="font-size:1.5rem; font-weight:bold;">${totalSales.toLocaleString()} ج.م</span>
                        </div>
                        <div style="padding:15px; background:#fff3e0; border-radius:10px; border-right:5px solid #ef6c00;">
                            <label style="color:#ef6c00; display:block; margin-bottom:5px;">📉 إجمالي التكلفة</label>
                            <span style="font-size:1.5rem; font-weight:bold;">${totalCost.toLocaleString()} ج.م</span>
                        </div>
                        <div style="padding:15px; background:#ffebee; border-radius:10px; border-right:5px solid #c62828;">
                            <label style="color:#c62828; display:block; margin-bottom:5px;">💸 إجمالي المصروفات</label>
                            <span style="font-size:1.5rem; font-weight:bold;">${totalExpenses.toLocaleString()} ج.م</span>
                        </div>
                        <div style="padding:15px; background:#e3f2fd; border-radius:10px; border-right:5px solid #1565c0;">
                            <label style="color:#1565c0; display:block; margin-bottom:5px;">💵 مقبوضات أخرى</label>
                            <span style="font-size:1.5rem; font-weight:bold;">${totalReceiptsOther.toLocaleString()} ج.م</span>
                        </div>
                    </div>
                    <div style="margin-top:20px; padding:20px; background:linear-gradient(135deg, #c5a059, #8c6a24); color:white; border-radius:12px; text-align:center;">
                        <div style="font-size:1.1rem; opacity:0.9;">الربح الصافي النهائي</div>
                        <div style="font-size:2.5rem; font-weight:900;">${netProfit.toLocaleString()} ج.م</div>
                    </div>
                </div>
            `;

            showCustomAlert({
                title: "📊 تقرير تحليل المبيعات الشامل",
                message: html,
                icon: "💰",
                type: "info"
            });
        }

        function showInventoryBalanceReport() {
            let totalQty = 0;
            let totalValue = 0;
            let categories = {};

            productsDB.forEach(p => {
                const qty = parseFloat(p.qty) || 0;
                const cost = parseFloat(p.cost) || 0;
                totalQty += qty;
                totalValue += qty * cost;

                if (p.category) {
                    if (!categories[p.category]) categories[p.category] = { qty: 0, val: 0 };
                    categories[p.category].qty += qty;
                    categories[p.category].val += qty * cost;
                }
            });

            const html = `
                <div style="text-align:right;">
                    <div style="display:flex; justify-content:space-around; margin:20px 0; background:var(--bg-color); padding:15px; border-radius:10px;">
                        <div>
                            <div style="color:var(--text-secondary);">إجمالي القطع</div>
                            <div style="font-size:1.8rem; font-weight:bold; color:var(--accent-gold);">${totalQty.toLocaleString()}</div>
                        </div>
                        <div style="border-left:1px solid var(--border-color);"></div>
                        <div>
                            <div style="color:var(--text-secondary);">إجمالي القيمة المالية</div>
                            <div style="font-size:1.8rem; font-weight:bold; color:var(--main-green);">${totalValue.toLocaleString()} ج.م</div>
                        </div>
                    </div>
                    <h4 style="margin-bottom:10px;">🏠 أرصدة الفروع والمخازن المشتركة:</h4>
                    <div style="max-height:250px; overflow-y:auto; border:1px solid var(--border-color); border-radius:12px; margin-bottom:20px; box-shadow:0 4px 15px rgba(0,0,0,0.05);">
                        <table style="width:100%; border-collapse:collapse; background:#ffffff;">
                            <thead style="background:#f8fafc; border-bottom:2px solid var(--gold);">
                                <tr>
                                    <th style="padding:12px; text-align:right;">المخزن / الفرع</th>
                                    <th style="padding:12px;">الأصناف</th>
                                    <th style="padding:12px;">الكمية</th>
                                    <th style="padding:12px;">القيمة المالية (تكلفة)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${warehouses.map(w => {
                                    let iCount = 0, qSum = 0, vSum = 0;
                                    productsDB.forEach(p => {
                                        const wStock = getWarehouseStock(p.name, w.name);
                                        if (wStock !== 0) {
                                            iCount++; 
                                            qSum += wStock; 
                                            vSum += (wStock * (parseFloat(p.cost) || 0));
                                        }
                                    });
                                    return `
                                    <tr style="border-bottom:1px solid #f1f5f9; transition:0.3s; cursor:default;">
                                        <td style="padding:12px; font-weight:bold; color:#2c3e50;">${w.name} ${currentUser && currentUser.warehouseName === w.name ? '<span style="color:var(--main-green); font-size:0.75rem;">(نشط)</span>' : ''}</td>
                                        <td style="padding:12px; text-align:center;">${iCount}</td>
                                        <td style="padding:12px; text-align:center; color:var(--main-green); font-weight:bold;">${qSum}</td>
                                        <td style="padding:12px; text-align:center; color:var(--main-blue); font-weight:bold;">${vSum.toLocaleString()} ج.م</td>
                                    </tr>`;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>

                    <h4 style="margin-bottom:10px;">📦 تحليل المخزون الكلي حسب التصنيف:</h4>
                    <div style="max-height:200px; overflow-y:auto; border:1px solid var(--border-color); border-radius:8px;">
                        ${Object.keys(categories).length > 0 ?
                    `<table style="width:100%; border-collapse:collapse;">
                                <thead style="background:var(--table-header-bg);">
                                    <tr><th style="padding:8px; text-align:right;">التصنيف</th><th style="padding:8px;">الكمية</th><th style="padding:8px;">القيمة</th></tr>
                                </thead>
                                <tbody>
                                    ${Object.entries(categories).map(([name, data]) => `
                                        <tr style="border-bottom:1px solid var(--border-color);">
                                            <td style="padding:8px;">${name}</td>
                                            <td style="padding:8px; text-align:center;">${data.qty}</td>
                                            <td style="padding:8px; text-align:center;">${data.val.toLocaleString()}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>` :
                    `<p style="padding:15px; text-align:center;">لا توجد بيانات تصنيفات</p>`
                }
                    </div>
                </div>
            `;

            showCustomAlert({
                title: "🧱 تقرير رصيد المخزن الكلي",
                message: html,
                icon: "🧱",
                type: "success"
            });
        }

        function toggleSubscriptionModal(show) {
            const modal = document.getElementById('subscriptionModal');
            if (!modal) return;
            if (show) modal.classList.remove('hidden');
            else modal.classList.add('hidden');
        }

        // --- وظائف شعار المؤسسة (Logo System) ---
        function triggerLogoUpload() {
            document.getElementById('logoInputHidden').click();
        }

        function handleLogoUpload(input) {
            const file = input.files[0];
            if (!file) return;

            // التأكد من حجم الملف (اختياري)
            if (file.size > 2 * 1024 * 1024) {
                alert("حجم الصورة كبير جداً، يفضل أقل من 2 ميجابايت.");
                return;
            }

            const reader = new FileReader();
            reader.onload = function (e) {
                const base64 = e.target.result;
                try {
                    setStore('bayan_business_logo', base64);
                    updateLogoDisplays(base64);
                    // عرض تنبيه نجاح (إذا كانت الدالة موجودة)
                    if (typeof showToast === 'function') showToast("تم تحديث الشعار بنجاح ✅");
                    else alert("تم تحديث شعار المؤسسة بنجاح ✅");
                } catch (err) {
                    alert("عذراً، مساحة التخزين ممتلئة. حاول استخدام صورة أصغر حجماً.");
                }
            };
            reader.readAsDataURL(file);
        }

        function updateLogoDisplays(src) {
            const headerLogo = document.getElementById('headerLogo');
            const placeholder = document.getElementById('logoPlaceholder');
            const dashboardLogo = document.getElementById('dashboardLogoDisplay');
            const settingsPreview = document.getElementById('settingsLogoPreview');

            if (src) {
                if (headerLogo) {
                    headerLogo.src = src;
                    headerLogo.style.display = 'block';
                }
                if (placeholder) placeholder.style.display = 'none';

                if (dashboardLogo) {
                    dashboardLogo.style.backgroundImage = `url(${src})`;
                    dashboardLogo.innerHTML = '';
                }

                if (settingsPreview) {
                    settingsPreview.style.backgroundImage = `url(${src})`;
                    settingsPreview.innerHTML = '';
                }
            }
        }

        // --- نظام مغير الخلفيات (Wallpaper Logic) المطوّر ---
        function toggleWallpaperMenu() {
            const menu = document.getElementById('wallpaperMenu');
            if (!menu) return;

            const isVisible = menu.classList.contains('visible');

            if (!isVisible) {
                menu.classList.remove('hidden');
                menu.classList.add('visible');
                // التأكد من تطبيق الحالة النشطة وتحديث المعرض عند الفتح
                const saved = getStore('bayan_wallpaper') || 'media/wallpapers/mountains.jpg';
                updateWallpaperActiveState(saved);
                loadCustomWallpapersToGallery();
            } else {
                menu.classList.remove('visible');
                menu.classList.add('hidden');
            }
        }

        async function changeWallpaper(url, isCustom = false) {
            const body = document.body;

            if (!url || url === 'none') {
                body.style.backgroundImage = 'none';
                body.style.background = '';
                body.classList.remove('has-wallpaper');
                setStore('bayan_wallpaper', 'none');
                setStore('bayan_wallpaper_type', 'none');
            } else {
                if (url.startsWith('linear-gradient') || url.startsWith('radial-gradient')) {
                    body.style.backgroundImage = url;
                } else if (url.startsWith('custom_')) {
                    try {
                        const custom = await db.wallpapers.where('name').equals(url).first();
                        if (custom) body.style.backgroundImage = `url('${custom.data}')`;
                    } catch (e) { console.error(e); }
                } else {
                    body.style.backgroundImage = `url('${url}')`;
                }
                body.style.backgroundSize = 'cover';
                body.style.backgroundAttachment = 'fixed';
                body.style.backgroundPosition = 'center';
                body.classList.add('has-wallpaper');
                setStore('bayan_wallpaper', url);
                setStore('bayan_wallpaper_type', isCustom ? 'custom' : 'preset');
            }

            // إخفاء القائمة بعد الاختيار
            const menu = document.getElementById('wallpaperMenu');
            if (menu) {
                menu.classList.remove('visible');
                menu.classList.add('hidden');
            }

            // تنبيه نجاح
            if (typeof showToast === 'function') showToast("تم تحديث مظهر البرنامج بنجاح ✨", "success");

            // تحديث العلامة النشطة
            updateWallpaperActiveState(url);
        }

        function updateWallpaperActiveState(url) {
            const cleanUrl = String(url || 'none').trim();
            const noneBtn = document.getElementById('wp-btn-none');
            if (noneBtn) {
                if (cleanUrl === 'none' || !cleanUrl) {
                    noneBtn.style.borderColor = '#d4af37';
                    noneBtn.style.background = '#fff8e7';
                    noneBtn.style.boxShadow = '0 0 0 3px rgba(212, 175, 55, 0.4)';
                } else {
                    noneBtn.style.borderColor = '#999';
                    noneBtn.style.background = '#eee';
                    noneBtn.style.boxShadow = 'none';
                }
            }

            document.querySelectorAll('.wp-item-card').forEach(card => {
                card.classList.remove('active');
                const onclickAttr = card.getAttribute('onclick') || '';
                const bgStyle = card.style.backgroundImage || '';
                if (cleanUrl !== 'none') {
                    if (onclickAttr.includes(cleanUrl) || bgStyle.includes(cleanUrl)) {
                        card.classList.add('active');
                    }
                }
            });
        }

        async function loadCustomWallpapersToGallery() {
            const grid = document.getElementById('customWallpapersGrid');
            if (!grid) return;
            
            try {
                grid.innerHTML = '';
                const customWps = await db.wallpapers.where('name').startsWith('custom_').toArray();
                if (customWps.length === 0) {
                    grid.style.display = 'none';
                    return;
                }
                grid.style.display = 'grid';
                
                const currentSaved = getStore('bayan_wallpaper');
                customWps.forEach(wp => {
                    const div = document.createElement('div');
                    div.className = 'wp-item-card' + (currentSaved === wp.name ? ' active' : '');
                    div.style.background = `url('${wp.data}') center/cover`;
                    div.onclick = () => changeWallpaper(wp.name, true);
                    
                    const label = document.createElement('div');
                    label.className = 'wp-label';
                    label.style.background = 'rgba(0,0,0,0.6)';
                    label.innerHTML = `مخصصة <span onclick="event.stopPropagation(); deleteCustomWallpaper('${wp.name}')" style="color: #f43f5e; float: left; cursor: pointer; padding: 0 5px;">✖</span>`;
                    
                    div.appendChild(label);
                    grid.appendChild(div);
                });
            } catch (e) {
                console.error("Error loading custom wallpapers:", e);
            }
        }

        async function deleteCustomWallpaper(name) {
            try {
                await db.wallpapers.where('name').equals(name).delete();
                // If it was the current wallpaper, reset it
                if (getStore('bayan_wallpaper') === name) {
                    changeWallpaper('none');
                }
                await loadCustomWallpapersToGallery();
                if (typeof showToast === 'function') showToast("تم حذف الخلفية بنجاح", "success");
            } catch (e) {
                console.error("Error deleting custom wallpaper:", e);
            }
        }

        async function uploadCustomWallpaper(event) {
            const file = event.target.files[0];
            if (!file) return;

            // التحقق من حجم الملف (يفضل أقل من 2 ميجا لتجنب مشاكل الذاكرة)
            if (file.size > 2 * 1024 * 1024) {
                return showToast("⚠️ حجم الصورة كبير جداً، يرجى اختيار صورة أقل من 2 ميجابايت.", "error");
            }

            const reader = new FileReader();
            reader.onload = async (e) => {
                const base64Data = e.target.result;
                try {
                    // حفظ في IndexedDB مع الاحتفاظ بالخلفيات السابقة
                    const customId = 'custom_' + Date.now();
                    await db.wallpapers.add({ name: customId, data: base64Data });

                    // إضافة للمظهر فوراً باستخدام الـ ID وليس الـ Base64
                    changeWallpaper(customId, true);
                    
                    // تحديث قائمة الخلفيات المخصصة
                    await loadCustomWallpapersToGallery();
                    
                    showToast("✅ تم رفع وحفظ الخلفية المخصصة بنجاح", "success");
                } catch (err) {
                    console.error("فشل حفظ الخلفية:", err);
                    showToast("❌ حدث خطأ أثناء حفظ الصورة محلياً.", "error");
                }
            };
            reader.readAsDataURL(file);
        }

        async function loadWallpaper() {
            let type = getStore('bayan_wallpaper_type');
            let saved = getStore('bayan_wallpaper');

            // فحص احتياطي مباشر من IndexedDB إذا لم تكن الذاكرة ممتلئة بعد
            if ((saved === null || saved === undefined) && typeof window.bayanDB !== 'undefined' && window.bayanDB && window.bayanDB.settings) {
                try {
                    const row = await window.bayanDB.settings.get('bayan_wallpaper');
                    if (row && row.value !== undefined) {
                        saved = row.value;
                        if (!window.AppStore) window.AppStore = {};
                        window.AppStore['bayan_wallpaper'] = saved;
                    }
                    const rowType = await window.bayanDB.settings.get('bayan_wallpaper_type');
                    if (rowType && rowType.value !== undefined) {
                        type = rowType.value;
                        if (!window.AppStore) window.AppStore = {};
                        window.AppStore['bayan_wallpaper_type'] = type;
                    }
                } catch(e) {}
            }

            // 🌟 الإلزام التلقائي لأول مرة يفتح فيها البرنامج على الإطلاق فقط (First Launch Only):
            // إذا لم يسبق للمستخدم اختيار أي شيء قط (saved === null أو undefined)
            if (saved === null || saved === undefined) {
                saved = 'media/wallpapers/mountains.jpg';
                setStore('bayan_wallpaper', saved);
                setStore('bayan_wallpaper_type', 'preset');
            }

            // تحديث معرض الخلفيات المخصصة
            await loadCustomWallpapersToGallery();

            // 🚫 إذا اختار العميل صراحة "بدون خلفية":
            if (saved === 'none') {
                document.body.style.backgroundImage = 'none';
                document.body.style.background = '';
                document.body.classList.remove('has-wallpaper');
                updateWallpaperActiveState('none');
                return;
            }

            // 🖼️ إذا كانت خلفية مخصصة رفعها العميل:
            if (type === 'custom' && saved) {
                try {
                    const custom = await db.wallpapers.where('name').equals(saved).first();
                    if (custom) {
                        document.body.style.backgroundImage = `url('${custom.data}')`;
                        document.body.style.backgroundSize = 'cover';
                        document.body.style.backgroundAttachment = 'fixed';
                        document.body.style.backgroundPosition = 'center';
                        document.body.classList.add('has-wallpaper');
                        updateWallpaperActiveState(saved);
                        return;
                    } else if (saved.startsWith('data:image')) {
                        document.body.style.backgroundImage = `url('${saved}')`;
                        document.body.style.backgroundSize = 'cover';
                        document.body.style.backgroundAttachment = 'fixed';
                        document.body.style.backgroundPosition = 'center';
                        document.body.classList.add('has-wallpaper');
                        updateWallpaperActiveState(saved);
                        return;
                    }
                } catch(e) { console.error("Error loading custom wallpaper:", e); }
            }

            // 🏙️ في حالة الخلفيات الجاهزة (Preset) أو التدرجات:
            if (saved && saved !== 'none') {
                if (saved.startsWith('linear-gradient') || saved.startsWith('radial-gradient')) {
                    document.body.style.backgroundImage = saved;
                } else {
                    document.body.style.backgroundImage = `url('${saved}')`;
                }
                document.body.style.backgroundSize = 'cover';
                document.body.style.backgroundAttachment = 'fixed';
                document.body.style.backgroundPosition = 'center';
                document.body.classList.add('has-wallpaper');
                updateWallpaperActiveState(saved);
            }
        }

        async function initLicense() {
            if (!getStore('bayan_install_date')) {
                setStore('bayan_install_date', new Date().toISOString());
            }

            // تهيئة رقم الجهاز الحديث
            const hwid = await getUniqueHWID();

            // تحديث العرض في قسم "حول النظام" المطور
            const mainHwidEl = document.getElementById('displayHwid');
            if (mainHwidEl) mainHwidEl.innerText = hwid;

            // تحديث العرض القديم (Machine ID) للتوافق
            const display = document.getElementById('displayMachineId');
            if (display) display.innerText = hwid;

            // checkAccess(); removed redundant call

            // تحديث قائمة التصنيفات في المخزن عند البداية لضمان عمل الفلتر
            setTimeout(() => {
                if(typeof updateCategoryFilterOptions === 'function') updateCategoryFilterOptions();
            }, 1500);
        }

        // --- توليد رقم فريد للجهاز (Machine ID) ---
        function getMachineId() {
            return getStore('bayan_hwid') || 'LOCAL_DEVICE';
        }

        function requestActivation(plan, price) {
            const currentPlan = window.getBayanPlan();
            
            const tiers = { 'باقة نسخة المجانية': 0, 'الباقة الشهرية': 1, 'الباقة السنوية': 2, 'الباقة مدى الحياة': 3 };
            const curTier = tiers[currentPlan] || 0;
            const newTier = tiers[plan] || 0;

            if (curTier === 3) {
                if (typeof showToast === 'function') showToast("أنت تمتلك النسخة مدى الحياة بالفعل! لا حاجة للاشتراك.", "warning");
                else alert("أنت تمتلك النسخة مدى الحياة بالفعل! لا حاجة للاشتراك.");
                return;
            }

            if (newTier < curTier) {
                if (typeof showToast === 'function') showToast(`أنت مشترك حالياً في باقة أعلى (${currentPlan}). لا يمكن الرجوع لباقة أقل.`, "error");
                else alert(`أنت مشترك حالياً في باقة أعلى (${currentPlan}). لا يمكن الرجوع لباقة أقل.`);
                return;
            }

            if (newTier === curTier && curTier !== 0) {
                // If they try to subscribe to the same plan, ask for confirmation
                const conf = confirm(`أنت مشترك في "${currentPlan}" بالفعل. هل تريد تجديد الاشتراك أو الاشتراك مرة أخرى؟`);
                if (!conf) return;
            }

            const mId = getMachineId();
            const shopName = document.getElementById('shopName')?.value.trim();
            const phone = document.getElementById('shopPhone1')?.value.trim();
            
            if (!shopName || !phone) {
                if (typeof showToast === 'function') showToast("⚠️ روح سجل بيانات المحل (الاسم ورقم الهاتف) في قسم الإعدادات الأول عشان نقدر نرسل طلب الاشتراك.", "error");
                else alert("⚠️ روح سجل بيانات المحل (الاسم ورقم الهاتف) في قسم الإعدادات الأول عشان نقدر نرسل طلب الاشتراك.");
                return;
            }

            const version = window.appVersion || '1.0.3';

            const message = `السلام عليكم\nأريد الاشتراك في Bayan POS\n\nاسم المحل: ${shopName}\nMachine ID: ${mId}\nرقم الهاتف: ${phone}\nالباقة: ${plan}\nإصدار البرنامج: ${version}\n\nتم تحويل المبلغ.`;
            
            const whatsappUrl = `https://wa.me/201006825905?text=${encodeURIComponent(message)}`;

            // Populate Modal
            const elPlanName = document.getElementById('payModalPlanName');
            const elPrice = document.getElementById('payModalPrice');
            const elTransferPhone = document.getElementById('payModalTransferPhone');
            const btnProceed = document.getElementById('proceedToWhatsappBtn');
            
            if (elPlanName) elPlanName.innerText = plan;
            if (elPrice) elPrice.innerText = price;
            
            const transferPhone = getStore('bayan_sub_transfer_phone');
            if (elTransferPhone) {
                if (transferPhone) {
                    elTransferPhone.innerText = transferPhone;
                    elTransferPhone.style.color = '#10b981'; // green if registered
                } else {
                    elTransferPhone.innerText = 'غير مسجل';
                    elTransferPhone.style.color = '#ef4444'; // red if not
                }
            }

            if (btnProceed) {
                btnProceed.onclick = function() {
                    window.open(whatsappUrl, '_blank');
                    document.getElementById('paymentConfirmModal').classList.add('hidden');
                };
            }

            const payModal = document.getElementById('paymentConfirmModal');
            if (payModal) {
                payModal.classList.remove('hidden');
            } else {
                // Fallback
                if(confirm(`هل أنت متأكد من المتابعة للاشتراك في ${plan}؟`)) window.open(whatsappUrl, '_blank');
            }
        }

        // --- تبديل ستايلات الطباعة ---
        function setPrintStyle(style) {
            setStore('bayan_print_style', style);
            if (typeof showToast === 'function') showToast(`تم ضبط نمط الطباعة على: ${style} ✅`);
            else alert(`تم تغيير نمط الطباعة إلى ${style} بنجاح ✅`);
        }

        function savePrintSettings() {
            const printSettings = {
                paperSize: document.getElementById('printPaperSize').value,
                copies: document.getElementById('printCopies').value,
                showLogo: document.getElementById('printShowLogo').checked,
                showCompanyInfo: document.getElementById('printShowCompanyInfo').checked,
                showTaxID: document.getElementById('printShowTaxID').checked
            };
            setStore('bayan_print_settings', JSON.stringify(printSettings));
            if (typeof showToast === 'function') showToast("تم حفظ خيارات الطباعة والتصميم بنجاح 🖨️");
            else alert("تم حفظ خيارات الطباعة والتصميم بنجاح 🖨️");
        }

        function loadPrintSettings() {
            const saved = getStore('bayan_print_settings');
            if (saved) {
                const s = JSON.parse(saved);
                if (document.getElementById('printPaperSize')) document.getElementById('printPaperSize').value = s.paperSize || '80mm';
                if (document.getElementById('printCopies')) document.getElementById('printCopies').value = s.copies || 1;
                if (document.getElementById('printShowLogo')) document.getElementById('printShowLogo').checked = s.showLogo !== false;
                if (document.getElementById('printShowCompanyInfo')) document.getElementById('printShowCompanyInfo').checked = s.showCompanyInfo !== false;
                if (document.getElementById('printShowTaxID')) document.getElementById('printShowTaxID').checked = s.showTaxID || false;
            }
        }

        function updateActiveTabTitle(nameValue, baseLabel) {
            if (!activeTabId || activeTabId === 'dashboard') return;

            const tab = openTabs.find(t => t.id === activeTabId);
            if (!tab) return;

            const sectionType = activeTabId.split('_')[0];
            let icon = '';
            let labelText = '';

            // قاموس الأيقونات والتسميات المختصرة لضمان "شياكة" الواجهة
            const icons = {
                'sales': { icon: '🛒', labelText: 'بيع: ' },
                'purchase': { icon: '📦', labelText: 'شراء: ' },
                'sales-return': { icon: '🔄', labelText: 'م.بيع: ' },
                'purchase-return': { icon: '📤', labelText: 'م.شراء: ' },
                'receipt': { icon: '💵', labelText: 'قبض: ' },
                'disbursement': { icon: '💸', labelText: 'صرف: ' }
            };

            const config = icons[sectionType];
            if (config) {
                icon = config.icon;
                labelText = config.labelText;
            } else {
                // إذا لم يكن قسماً مدعوماً من الاختصارات، نخرج
                return;
            }

            // قص الاسم إذا زاد عن 10 حروف لاختصار المساحة بجودة عالية
            let name = (nameValue || '').trim();
            if (name.length > 10) name = name.substring(0, 10) + '..';

            if (name && name !== '---' && name !== 'عميل نقدي' && name !== 'مورد عام') {
                tab.label = `${icon} ${labelText}${name}`;
            } else {
                // العودة للحالة العادية مع رقم التبويب (مثل: بيع 1)
                const tabNum = tab.id.split('_')[1] ? (openTabs.filter(t => t.type === sectionType).indexOf(tab) + 1) : '';
                const defaultLabels = {
                    'sales': 'بيع', 'purchase': 'شراء', 'sales-return': 'مرتجع بيع', 
                    'purchase-return': 'مرتجع شراء', 'receipt': 'سند قبض', 'disbursement': 'سند صرف'
                };
                tab.label = `${icon} ${defaultLabels[sectionType] || sectionType} ${tabNum}`;
            }

            renderTabs();
        }

        // --- نظام تصميم نماذج الطباعة الاحترافي ---
        let currentSelectedTemplateType = 'فاتورة المبيعات';
        let currentSelectedTemplateId = '0010 - 80mm';

        function selectTemplateType(el, typeName) {
            document.querySelectorAll('.template-type-item').forEach(item => {
                item.classList.remove('active');
                item.style.background = 'transparent';
                item.style.color = 'inherit';
            });
            el.classList.add('active');
            el.style.background = '#3498db';
            el.style.color = 'white';
            currentSelectedTemplateType = typeName;
            updatePrintPreview();
        }

        function selectPrintTemplate(el, templateId) {
            document.querySelectorAll('.template-item').forEach(item => {
                item.classList.remove('active');
                item.style.background = 'transparent';
                item.style.color = 'inherit';
            });
            el.classList.add('active');
            el.style.background = '#3498db';
            el.style.color = 'white';
            currentSelectedTemplateId = templateId;
            updatePrintPreview();
        }

        function updatePrintPreview() {
            const preview = document.getElementById('invoiceLivePreview');
            if (!preview) return;

            // 1. تحديث مقاس المعاينة (العرض)
            const tid = currentSelectedTemplateId.toLowerCase();
            if (tid.includes('a4')) preview.style.width = '450px';
            else if (tid.includes('a5')) preview.style.width = '380px';
            else if (tid.includes('57mm')) preview.style.width = '240px';
            else preview.style.width = '320px'; // الافتراضي 80mm

            // 2. تطبيق سمات التصميم بناءاً على الرقم (0010, 0020, إلخ)
            preview.style.border = '1px solid #ddd'; // تصفير افتراضي
            preview.style.borderRadius = '0';
            preview.style.boxShadow = 'none';

            const headerBox = preview.querySelector('div[style*="border-bottom"]');
            if (currentSelectedTemplateId.includes('0020')) {
                preview.style.border = '2px double #333';
                if (headerBox) headerBox.style.borderBottom = '5px double #333';
            } else if (currentSelectedTemplateId.includes('0030')) {
                preview.style.padding = '8px 4px';
                if (headerBox) headerBox.style.borderBottom = '1px solid #999';
            } else if (currentSelectedTemplateId.includes('0050')) {
                preview.style.borderRadius = '15px';
                preview.style.boxShadow = '0 10px 30px rgba(0,0,0,0.1)';
                if (headerBox) headerBox.style.background = '#fcfcfc';
            }

            // 3. تحديث محتوى المعاينة حسب النوع
            const contentArea = preview.querySelector('div:last-child'); // منطقة المحتوى المتغيرة (فوق التذييل أو الجدول)
            const dynamicContent = preview.querySelector('div[style*="border-bottom-style: dashed"], table, div[style*="border-top: 1.5px solid"], div[style*="border-top: 1.5px solid #333"]');

            if (currentSelectedTemplateType === 'أرصدة المخازن') {
                // عرض معاينة مبسطة لتقرير المخازن
                preview.innerHTML = `
                    <div style="padding: 15px;">
                        <div style="border-bottom: 2px solid #5e3370; text-align: center; padding-bottom: 10px; margin-bottom: 15px;">
                            <h2 style="margin: 0; font-size: 1.2rem; color: #5e3370;" id="prevShopName">بَيَان POS</h2>
                            <div style="font-size: 0.8rem; opacity: 0.7;">🧱 تقرير أرصدة المخازن (معاينة)</div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr; gap: 10px; margin-bottom: 15px;">
                            <div style="border: 1px solid #eee; padding: 10px; border-radius: 8px; font-size: 0.8rem;">
                                🏠 المخزن الرئيسي<br>
                                📦 الأصناف: <b>25</b> | 🔢 الكمية: <b>1393</b><br>
                                <span style="font-weight: 900; color: #2c3e50;">22,704 ج.م</span>
                            </div>
                            <div style="border: 1px solid #eee; padding: 10px; border-radius: 8px; font-size: 0.8rem; background: #fbfbfb;">
                                🏠 مخزن الفرع 11<br>
                                📦 الأصناف: <b>0</b> | 🔢 الكمية: <b>0</b><br>
                                <span style="font-weight: 900; color: #2c3e50;">0 ج.م</span>
                            </div>
                        </div>

                        <div style="background: linear-gradient(135deg, #5e3370, #2c3e50); color: white; padding: 15px; border-radius: 12px; text-align: center; margin-bottom: 15px;">
                            <div style="font-size: 0.75rem; opacity: 0.9;">🌍 الإجمالي العام للبضاعة</div>
                            <div style="font-size: 1.5rem; font-weight: 900;">22,704 ج.م</div>
                        </div>

                        <div style="text-align: center; border-top: 1px dashed #ddd; padding-top: 10px;">
                            <div id="prevFooterMsg" style="font-size: 0.75rem; color: #555; white-space: pre-wrap;">رسالة تذييل التقرير...</div>
                            <img src="media/sample-qr.svg" style="margin-top: 10px; width: 50px;">
                        </div>
                    </div>
                `;
            } else {
                // استعادة شكل الفاتورة الافتراضي
                preview.innerHTML = `
                    <div style="padding: 15px;">
                        <div style="border-bottom: 2px solid #333; text-align: center; padding-bottom: 10px; margin-bottom: 15px;">
                            <h2 style="margin: 0; font-size: 1.2rem;" id="prevShopName">بَيَان POS</h2>
                            <div style="font-size: 0.8rem; opacity: 0.7;">نموذج معاينة المستندات</div>
                        </div>

                        <div style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 12px; border-bottom: 1px dashed #eee; padding-bottom: 8px;">
                            <div>التاريخ: 2024-03-25<br>الوقت: 04:23 PM</div>
                            <div style="text-align: left;">رقم المستند: 1001<br>المستخدم: مدير النظام</div>
                        </div>

                        <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; direction: rtl; text-align: right;">
                            <thead style="background: #f1f1f1;">
                                <tr>
                                    <th style="border: 1px solid #ccc; padding: 4px;">الصنف</th>
                                    <th style="border: 1px solid #ccc; padding: 4px; text-align: center;">ك</th>
                                    <th style="border: 1px solid #ccc; padding: 4px; text-align: left;">إجمالي</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style="border: 1px solid #eee; padding: 4px;">صنف تجريبي 1</td>
                                    <td style="border: 1px solid #eee; padding: 4px; text-align: center;">2</td>
                                    <td style="border: 1px solid #eee; padding: 4px; text-align: left;">100.0</td>
                                </tr>
                            </tbody>
                        </table>

                        <div style="margin-top: 12px; border-top: 1.5px solid #333; padding-top: 8px;">
                            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1rem; background: #f9f9f9; padding: 4px;">
                                <span>صافي المطلوب</span>
                                <span style="border-right: 3px solid #333; padding-right: 8px;">100.00 ج.م</span>
                            </div>
                        </div>

                        <div style="text-align: center; margin-top: 15px; border-top: 1px dashed #ddd; padding-top: 10px;">
                            <div id="prevFooterMsg" style="font-size: 0.75rem; color: #555; white-space: pre-wrap;">رسالة تذييل الفاتورة تظهر هنا...</div>
                            <img src="media/sample-qr.svg" style="margin-top: 10px; width: 50px;">
                        </div>
                    </div>
                `;
            }

            // 4. تحديث البيانات (الاسم والرسائل)
            const shopNameVal = document.getElementById('shopName') ? document.getElementById('shopName').value : '';
            const prevShopName = document.getElementById('prevShopName');
            if (prevShopName) prevShopName.innerText = shopNameVal || 'بَيَان POS لخدمات المنشآت';

            const footerVal = document.getElementById('printFooterMsg') ? document.getElementById('printFooterMsg').value : '';
            const prevFooter = document.getElementById('prevFooterMsg');
            if (prevFooter) prevFooter.innerText = footerVal || 'سيتم طباعة رسالتك هنا في تذييل الفاتورة';

            if (typeof showToast === 'function') showToast(`جاري معاينة: ${currentSelectedTemplateType} ✅`);
        }

        function refreshPinnedVisuals() {
            const saved = getStore('bayan_print_template_choice');
            let pinnedTemplate = '80mm Standard';
            if (saved) {
                const s = JSON.parse(saved);
                pinnedTemplate = s.template || '80mm Standard';
            }
            document.querySelectorAll('.template-item').forEach(item => {
                item.innerHTML = item.innerHTML.replace(' <span class="pinned-icon">📌</span>', '');
                const onclickAttr = item.getAttribute('onclick') || '';
                if (onclickAttr.includes("'" + pinnedTemplate + "'") || onclickAttr.includes('"' + pinnedTemplate + '"')) {
                    item.innerHTML += ' <span class="pinned-icon">📌</span>';
                }
            });
        }

        function savePrintTemplateSettings() {
            const settings = {
                type: currentSelectedTemplateType,
                template: currentSelectedTemplateId
            };
            setStore('bayan_print_template_choice', JSON.stringify(settings));
            refreshPinnedVisuals();
            if (typeof showToast === 'function') showToast("تم تثبيت التصميم المختار بنجاح 📌");
            else alert("تم تثبيت التصميم المختار بنجاح 📌");
        }

        // --- وظائف Sidebar التصميم ---

        function addToUserTemplates() {
            let userTemplates = JSON.parse(getStore('bayan_user_templates') || '[]');
            const exists = userTemplates.find(t => t.type === currentSelectedTemplateType && t.id === currentSelectedTemplateId);

            if (exists) {
                showToast("هذا التصميم موجود بالفعل في 'تصميماتي' ⚠️");
                return;
            }

            userTemplates.push({
                type: currentSelectedTemplateType,
                id: currentSelectedTemplateId,
                addedAt: new Date().toLocaleString('ar-EG')
            });

            setStore('bayan_user_templates', JSON.stringify(userTemplates));
            showToast("تمت الإضافة إلى 'تصميماتي' بنجاح! ➕");
        }

        function deleteSelectedTemplate() {
            let userTemplates = JSON.parse(getStore('bayan_user_templates') || '[]');
            const initialLength = userTemplates.length;

            userTemplates = userTemplates.filter(t => !(t.type === currentSelectedTemplateType && t.id === currentSelectedTemplateId));

            if (userTemplates.length === initialLength) {
                showToast("هذا التصميم ليس من ضمن 'تصميماتي' الخاصة ⚠️");
                return;
            }

            setStore('bayan_user_templates', JSON.stringify(userTemplates));
            showToast("تم حذف التصميم من 'تصميماتي' 🗑️");
        }

        function showTemplatesFolder() {
            const modal = document.getElementById('templatesFolderModal');
            const list = document.getElementById('userTemplatesList');
            const userTemplates = JSON.parse(getStore('bayan_user_templates') || '[]');

            list.innerHTML = '';

            if (userTemplates.length === 0) {
                list.innerHTML = '<div style="grid-column: 1/3; text-align: center; color: #666; padding: 20px;">لا توجد تصميمات مضافة حالياً 📂</div>';
            } else {
                userTemplates.forEach((t, index) => {
                    const card = document.createElement('div');
                    card.style.cssText = 'background: #f8f9fa; border: 1px solid #ddd; padding: 12px; border-radius: 8px; position: relative;';
                    card.innerHTML = `
                        <div style="font-weight: bold; font-size: 0.9rem; color: var(--main-blue);">${t.type}</div>
                        <div style="font-family: monospace; font-size: 0.8rem; margin: 4px 0;">ID: ${t.id}</div>
                        <div style="font-size: 0.7rem; color: #999;">أضيف في: ${t.addedAt}</div>
                        <button onclick="applySavedTemplate('${t.type}', '${t.id}')" style="margin-top: 8px; width: 100%; padding: 5px; background: #27ae60; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">تفعيل هذا التصميم</button>
                    `;
                    list.appendChild(card);
                });
            }

            modal.classList.remove('hidden');
        }

        function applySavedTemplate(type, id) {
            // محاكاة اختيار من القوائم
            currentSelectedTemplateType = type;
            currentSelectedTemplateId = id;
            updatePrintPreview();
            document.getElementById('templatesFolderModal').classList.add('hidden');
            showToast(`تم تفعيل التصميم المختار: ${type}`);
        }

        function toggleTemplateEditor(show) {
            const editor = document.getElementById('quickTemplateEditor');
            if (show) editor.classList.remove('hidden');
            else editor.classList.add('hidden');
        }

        window.registerOnCloud = async function() {
            const shopName = document.getElementById('shopName')?.value?.trim();
            const shopPhone = document.getElementById('shopPhone1')?.value?.trim() || document.getElementById('shopPhone')?.value?.trim();

            if(!shopName || !shopPhone) {
                return alert("❌ برجاء إدخال (اسم المحل) و (الموبايل الأساسي) في تبويب بيانات المؤسسة أولاً!");
            }

            try {
                if (typeof showToast === 'function') showToast("جاري التفعيل المحلي... ⏳", "info");

                const hwid = typeof getUniqueHWID === 'function' ? await getUniqueHWID() : 'BNC-LOCAL';
                if (typeof startFreeTrial === 'function') {
                    const success = await startFreeTrial(shopPhone, shopName, hwid);
                    if (success) {
                        if (typeof showToast === 'function') showToast("🎉 تم التفعيل محلياً بنجاح!", "success");
                        return true;
                    }
                }
            } catch (e) {
                console.error("❌ خطأ في التفعيل المحلي:", e);
                alert("❌ فشل التفعيل: " + e.message);
            }
            return false;
        };

        window.handleCloudRegistration = async function() {
            const name = document.getElementById('regShopName')?.value?.trim();
            const phone = document.getElementById('regShopPhone')?.value?.trim();

            if (!name || !phone) return alert("❌ يرجى إدخال الاسم ورقم الهاتف للمتابعة.");
            if (phone.length < 10) return alert("❌ يرجى إدخال رقم هاتف صحيح (10 أو 11 رقم).");

            if (typeof showToast === 'function') showToast("⏳ جاري التفعيل المحلي الشامل...", "info");

            const hwid = typeof getUniqueHWID === 'function' ? await getUniqueHWID() : 'BNC-LOCAL';
            if (typeof startFreeTrial === 'function') {
                const success = await startFreeTrial(phone, name, hwid);
                if (success) {
                    const regModal = document.getElementById('cloudRegistrationModal');
                    if (regModal) regModal.style.display = 'none';
                    if (document.getElementById('shopName')) document.getElementById('shopName').value = name;
                    if (document.getElementById('shopPhone1')) document.getElementById('shopPhone1').value = phone;
                    if (typeof saveData === 'function') saveData();
                    location.reload();
                }
            }
        };
