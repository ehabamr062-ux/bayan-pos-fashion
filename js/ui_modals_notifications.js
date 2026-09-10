// ============================================================
//  النوافذ المنبثقة، الإشعارات، ومعاينة الفواتير (Modals & Notifications)
// ============================================================
        window.showNotificationsModal = function(activeTab = null) {
            // 1. استدعاء الإحصائيات الشاملة من المصدر الموحد للحقيقة (Single Source of Truth)
            const stats = (typeof window.getSystemNotificationsStats === 'function') 
                ? window.getSystemNotificationsStats() 
                : {
                    allLowStock: [], activeLowStock: [], archivedLowStock: [],
                    allExpiring: [], activeExpiring: [], archivedExpiring: [],
                    allDebtAccounts: [], activeDebt: [], archivedDebt: [],
                    allDelayed: [], activeDelayed: [], archivedDelayed: [],
                    pendingTransfersList: [], activeTransfers: [], activeTransfersCount: 0,
                    cloudHistory: [], activeCloud: [], activeCloudCount: 0,
                    activeProductsTotal: 0, activeAccountsTotal: 0,
                    totalActiveCount: 0, totalReceiptCount: 0,
                    activeWH: 'المخزن الرئيسي'
                };

            const {
                activeLowStock, archivedLowStock,
                activeExpiring, archivedExpiring,
                activeDebt, archivedDebt,
                activeDelayed, archivedDelayed,
                pendingTransfersList, activeTransfers, activeTransfersCount,
                cloudHistory, activeCloud, activeCloudCount,
                activeProductsTotal, activeAccountsTotal,
                totalActiveCount, activeWH, canViewAccounts
            } = stats;

            const receiptLog = (window.bayanReceiptLog && Array.isArray(window.bayanReceiptLog)) ? window.bayanReceiptLog : [];
            const totalReceiptCount = receiptLog.length;

            // 2. التحديد الذكي للتبويب الافتراضي مع احترام الصلاحيات
            if (!activeTab) {
                if (activeTransfersCount > 0) activeTab = 'transfers';
                else if (activeProductsTotal > 0) activeTab = 'products';
                else if (canViewAccounts && activeAccountsTotal > 0) activeTab = 'accounts';
                else if (activeCloudCount > 0) activeTab = 'cloud';
                else activeTab = 'products';
            }
            if (activeTab === 'accounts' && !canViewAccounts) {
                activeTab = 'products';
            }

            // 3. تحديث شارة الجرس في الهيدر فوراً وبدقة تامة لمنع أي التباس في الأرقام
            const topBell = document.getElementById('bellBadge') || document.getElementById('notificationsBadge');
            if (topBell) {
                topBell.innerText = totalActiveCount > 99 ? '99+' : totalActiveCount;
                topBell.style.display = totalActiveCount > 0 ? 'flex' : 'none';
            }

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // دوال مساعدة لإنشاء صفوف الجداول بتصميم حديث وفخم
            const escapeStr = (str) => String(str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');

            const modalContent = `
                <div class="glass-card-premium" style="background: #ffffff; border: 1px solid rgba(226, 232, 240, 0.95); padding: 0; border-radius: 24px; width: 960px; max-width: 96vw; max-height: 90vh; overflow: hidden; box-shadow: 0 35px 80px rgba(15, 23, 42, 0.28), 0 0 0 1px rgba(255,255,255,0.2); display: flex; flex-direction: column; direction: rtl; font-family: inherit;">

                    <!-- Header بتدرج داكن وعصري مع ملخص ذكي -->
                    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%); padding: 18px 26px; display: flex; justify-content: space-between; align-items: center; color: white; border-bottom: 1px solid rgba(255,255,255,0.1); position: relative;">
                        <div style="display:flex; align-items:center; gap:14px;">
                            <div style="width: 44px; height: 44px; border-radius: 14px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); display: flex; align-items: center; justify-content: center; font-size: 1.35rem; box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);">
                                🔔
                            </div>
                            <div>
                                <h3 style="margin: 0; font-size: 1.28rem; font-weight: 900; color: #f8fafc; letter-spacing: -0.3px; display:flex; align-items:center; gap:8px;">
                                    مركز إدارة التنبيهات وسجل الاستلام
                                    ${totalActiveCount > 0 ? `<span style="background: #ef4444; color: #fff; font-size: 0.72rem; font-weight: 900; padding: 2px 8px; border-radius: 12px; box-shadow: 0 2px 6px rgba(239, 68, 68, 0.4);">${totalActiveCount} تنبيه نشط</span>` : '<span style="background: #10b981; color: #fff; font-size: 0.72rem; font-weight: 900; padding: 2px 8px; border-radius: 12px;">مستقر ومكتمل ✔️</span>'}
                                </h3>
                                <div style="font-size: 0.78rem; color: #94a3b8; font-weight: 700; margin-top: 3px; display: flex; gap: 14px; align-items: center; flex-wrap: wrap;">
                                    <span>🏬 المخزن الحالي: <b style="color: #60a5fa;">${escapeStr(activeWH)}</b></span>
                                    <span>•</span>
                                    <span>📋 التنبيهات الموثقة بالسجل: <b style="color: #fbbf24;">${totalReceiptCount}</b></span>
                                </div>
                            </div>
                        </div>

                        <div style="display: flex; align-items: center; gap: 10px;">
                            ${(totalActiveCount > 0 && activeTab !== 'transfers') ? `
                                <button onclick="acknowledgeAllNotifications('${activeTab}')" style="background: rgba(16, 185, 129, 0.18); border: 1.5px solid #10b981; color: #a7f3d0; padding: 7px 16px; border-radius: 11px; cursor: pointer; font-size: 0.84rem; font-weight: 900; display: flex; align-items: center; gap: 6px; transition: 0.2s;" onmouseover="this.style.background='rgba(16, 185, 129, 0.35)'" onmouseout="this.style.background='rgba(16, 185, 129, 0.18)'">
                                    <span>✔️</span> استلام وتوثيق الكل
                                </button>
                            ` : ''}
                            <button onclick="document.getElementById('notifyModal').remove()" style="background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.25); color: #fff; width: 34px; height: 34px; border-radius: 50%; cursor: pointer; font-size: 1.25rem; display: flex; align-items: center; justify-content: center; font-weight: bold; transition: 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.25)'" onmouseout="this.style.background='rgba(255,255,255,0.12)'">&times;</button>
                        </div>
                    </div>

                    <!-- Custom Tabs Bar (5 تبويبات أنيقة وواسعة) -->
                    <div style="display: flex; background: #f8fafc; border-bottom: 2px solid #e2e8f0; overflow-x: auto; gap: 4px; padding: 6px 12px 0 12px;">
                        <!-- تبويب البضاعة والصلاحية -->
                        <div onclick="showNotificationsModal('products')" style="flex: 1; min-width: 155px; padding: 12px 10px; text-align: center; cursor: pointer; font-weight: 900; font-size: 0.9rem; transition: 0.2s; border-radius: 12px 12px 0 0; border-bottom: 3.5px solid ${activeTab === 'products' ? '#10b981' : 'transparent'}; color: ${activeTab === 'products' ? '#047857' : '#64748b'}; background: ${activeTab === 'products' ? '#ffffff' : 'transparent'}; box-shadow: ${activeTab === 'products' ? '0 -2px 10px rgba(0,0,0,0.04)' : 'none'}; display: flex; align-items: center; justify-content: center; gap: 6px;">
                            <span>📦 البضاعة والصلاحية</span>
                            <span style="background: ${activeProductsTotal > 0 ? '#ef4444' : '#e2e8f0'}; color: ${activeProductsTotal > 0 ? '#ffffff' : '#64748b'}; font-size: 0.72rem; font-weight: 900; padding: 2px 7px; border-radius: 12px;">${activeProductsTotal}</span>
                        </div>

                        <!-- تبويب التحويلات الواردة -->
                        <div onclick="showNotificationsModal('transfers')" style="flex: 1; min-width: 155px; padding: 12px 10px; text-align: center; cursor: pointer; font-weight: 900; font-size: 0.9rem; transition: 0.2s; border-radius: 12px 12px 0 0; border-bottom: 3.5px solid ${activeTab === 'transfers' ? '#059669' : 'transparent'}; color: ${activeTab === 'transfers' ? '#047857' : '#64748b'}; background: ${activeTab === 'transfers' ? '#ffffff' : 'transparent'}; box-shadow: ${activeTab === 'transfers' ? '0 -2px 10px rgba(0,0,0,0.04)' : 'none'}; display: flex; align-items: center; justify-content: center; gap: 6px;">
                            <span>🚚 تحويلات واردة</span>
                            <span style="background: ${activeTransfersCount > 0 ? '#059669' : '#e2e8f0'}; color: ${activeTransfersCount > 0 ? '#ffffff' : '#64748b'}; font-size: 0.72rem; font-weight: 900; padding: 2px 7px; border-radius: 12px;">${activeTransfersCount}</span>
                        </div>

                        <!-- تبويب الحسابات والديون (محمي بصلاحيات الحسابات) -->
                        ${canViewAccounts ? `
                        <div onclick="showNotificationsModal('accounts')" style="flex: 1; min-width: 155px; padding: 12px 10px; text-align: center; cursor: pointer; font-weight: 900; font-size: 0.9rem; transition: 0.2s; border-radius: 12px 12px 0 0; border-bottom: 3.5px solid ${activeTab === 'accounts' ? '#3b82f6' : 'transparent'}; color: ${activeTab === 'accounts' ? '#1d4ed8' : '#64748b'}; background: ${activeTab === 'accounts' ? '#ffffff' : 'transparent'}; box-shadow: ${activeTab === 'accounts' ? '0 -2px 10px rgba(0,0,0,0.04)' : 'none'}; display: flex; align-items: center; justify-content: center; gap: 6px;">
                            <span>💳 تنبيهات الحسابات</span>
                            <span style="background: ${activeAccountsTotal > 0 ? '#ef4444' : '#e2e8f0'}; color: ${activeAccountsTotal > 0 ? '#ffffff' : '#64748b'}; font-size: 0.72rem; font-weight: 900; padding: 2px 7px; border-radius: 12px;">${activeAccountsTotal}</span>
                        </div>
                        ` : ''}

                        <!-- تبويب سجل الاستلام الموثق -->
                        <div onclick="showNotificationsModal('archived')" style="flex: 1; min-width: 165px; padding: 12px 10px; text-align: center; cursor: pointer; font-weight: 900; font-size: 0.9rem; transition: 0.2s; border-radius: 12px 12px 0 0; border-bottom: 3.5px solid ${activeTab === 'archived' ? '#d97706' : 'transparent'}; color: ${activeTab === 'archived' ? '#b45309' : '#64748b'}; background: ${activeTab === 'archived' ? '#ffffff' : 'transparent'}; box-shadow: ${activeTab === 'archived' ? '0 -2px 10px rgba(0,0,0,0.04)' : 'none'}; display: flex; align-items: center; justify-content: center; gap: 6px;">
                            <span>📋 سجل الاستلام والتدقيق</span>
                            <span style="background: #fef3c7; color: #b45309; border: 1px solid #fde68a; font-size: 0.72rem; font-weight: 900; padding: 2px 7px; border-radius: 12px;">${totalReceiptCount}</span>
                        </div>

                        <!-- تبويب الإشعارات السحابية -->
                        <div onclick="showNotificationsModal('cloud')" style="flex: 1; min-width: 155px; padding: 12px 10px; text-align: center; cursor: pointer; font-weight: 900; font-size: 0.9rem; transition: 0.2s; border-radius: 12px 12px 0 0; border-bottom: 3.5px solid ${activeTab === 'cloud' ? '#8b5cf6' : 'transparent'}; color: ${activeTab === 'cloud' ? '#6d28d9' : '#64748b'}; background: ${activeTab === 'cloud' ? '#ffffff' : 'transparent'}; box-shadow: ${activeTab === 'cloud' ? '0 -2px 10px rgba(0,0,0,0.04)' : 'none'}; display: flex; align-items: center; justify-content: center; gap: 6px;">
                            <span>☁️ الإشعارات السحابية</span>
                            ${activeCloudCount > 0 ? `<span style="background: #8b5cf6; color: #fff; font-size: 0.72rem; font-weight: 900; padding: 2px 7px; border-radius: 12px;">${activeCloudCount}</span>` : ''}
                        </div>
                    </div>

                    <!-- Content Area -->
                    <div style="padding: 22px 26px; flex: 1; overflow-y: auto; background: #ffffff; min-height: 320px;" class="fast-scrollbar">

                        <!-- 1. تبويب التحويلات الواردة -->
                        ${activeTab === 'transfers' ? `
                            ${(activeTransfersCount === 0) ? `
                                <div style="text-align: center; padding: 50px 20px; color: #64748b;">
                                    <div style="font-size: 3.5rem; margin-bottom: 12px;">🚚✨</div>
                                    <div style="font-weight: 900; font-size: 1.2rem; color: #0f172a;">لا توجد أذونات تحويل واردة بانتظار الاستلام!</div>
                                    <div style="font-size: 0.9rem; margin-top: 6px; color: #64748b;">جميع الشحنات المحولة إلى (<b style="color:#059669;">${escapeStr(activeWH)}</b>) تم فحصها واستلامها واعتمادها بنجاح.</div>
                                </div>
                            ` : `
                                <div style="margin-bottom: 16px; display:flex; justify-content:space-between; align-items:center;">
                                    <span style="font-size:0.92rem; font-weight:900; color:#1e293b;">
                                        📦 أذونات التحويل الواردة بانتظار المراجعة والاستلام المخزني (<b style="color:#059669;">${activeTransfersCount}</b>):
                                    </span>
                                </div>
                                <div style="display:flex; flex-direction:column; gap:16px;">
                                    ${pendingTransfersList.map(tr => `
                                        <div style="background:#f8fafc; border:2px solid #a7f3d0; border-radius:18px; padding:18px 22px; box-shadow:0 4px 18px rgba(0,0,0,0.04);">
                                            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1.5px dashed #cbd5e1; padding-bottom:12px; margin-bottom:14px; flex-wrap:wrap; gap:8px;">
                                                <div>
                                                    <span style="background:#047857; color:#fff; font-weight:900; font-size:0.85rem; padding:4px 14px; border-radius:20px;">إذن تحويل #${escapeStr(tr.id)}</span>
                                                    <span style="color:#0f172a; font-weight:900; font-size:0.95rem; margin-right:10px;">من: <b style="color:#2563eb;">${escapeStr(tr.sourceWarehouse)}</b> ⬅️ إلى مخزنك: <b style="color:#059669;">${escapeStr(tr.warehouse)}</b></span>
                                                </div>
                                                <div style="font-size:0.82rem; color:#64748b; font-weight:bold;">
                                                    🕒 ${escapeStr(tr.date || '')} | 👤 المرسل: <b style="color:#334155;">${escapeStr(tr.user)}</b>
                                                </div>
                                            </div>

                                            <div style="background:#fff; border-radius:12px; border:1px solid #e2e8f0; overflow:hidden; margin-bottom:14px;">
                                                <table style="width:100%; border-collapse:collapse; font-size:0.88rem; text-align:center;">
                                                    <thead style="background:#f1f5f9; color:#475569; font-weight:900;">
                                                        <tr>
                                                            <th style="padding:8px 14px; text-align:right;">الصنف المحول</th>
                                                            <th style="padding:8px 10px;">المقاس</th>
                                                            <th style="padding:8px 10px;">اللون</th>
                                                            <th style="padding:8px 14px;">الكمية</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        ${tr.items.map(it => `
                                                            <tr style="border-top:1px solid #f1f5f9;">
                                                                <td style="padding:10px 14px; font-weight:900; color:#0f172a; text-align:right;">${escapeStr(it.product)}</td>
                                                                <td style="padding:10px 10px; color:#475569; font-weight:bold;">${escapeStr(it.selectedSize || it.size || '-')}</td>
                                                                <td style="padding:10px 10px; color:#475569; font-weight:bold;">${escapeStr(it.selectedColor || it.color || '-')}</td>
                                                                <td style="padding:10px 14px; font-weight:900; color:#047857; font-size:1.02rem;">${it.qty} ${escapeStr(it.unit || 'قطعة')}</td>
                                                            </tr>
                                                        `).join('')}
                                                    </tbody>
                                                </table>
                                            </div>

                                            ${tr.notes ? `<div style="font-size:0.85rem; color:#475569; margin-bottom:14px; background:#ffffff; padding:8px 14px; border-radius:10px; border:1px solid #e2e8f0; font-weight:bold;">📝 ملاحظات المرسل: ${escapeStr(tr.notes)}</div>` : ''}

                                            <div style="display:flex; justify-content:flex-end; gap:12px;">
                                                <button onclick="if(confirm('هل أنت متأكد من رفض إذن التحويل #${escapeStr(tr.id)}؟ تظل البضاعة مسجلة بالكامل برصيد المخزن المصدر.')) window.rejectTransferFromNotify('${escapeStr(tr.id)}')" style="background:#fee2e2; color:#dc2626; border:1.5px solid #fca5a5; border-radius:10px; padding:9px 18px; font-weight:900; font-size:0.86rem; cursor:pointer; transition:0.2s;">
                                                    ❌ رفض التحويل
                                                </button>
                                                <button onclick="window.acceptTransferFromNotify('${escapeStr(tr.id)}')" style="background:linear-gradient(135deg, #10b981, #047857); color:#fff; border:none; border-radius:10px; padding:9px 24px; font-weight:900; font-size:0.92rem; cursor:pointer; box-shadow:0 3px 10px rgba(16,185,129,0.35); transition:0.2s;">
                                                    ✅ موافقة واستلام البضاعة بالمخزن
                                                </button>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            `}
                        ` : activeTab === 'products' ? `
                            <!-- 2. تبويب البضاعة والصلاحية -->
                            ${(activeProductsTotal === 0) ? `
                                <div style="text-align: center; padding: 50px 20px; color: #64748b;">
                                    <div style="font-size: 3.5rem; margin-bottom: 12px;">🎉📦</div>
                                    <div style="font-weight: 900; font-size: 1.25rem; color: #0f172a;">مخزون البضاعة والصلاحيات مستقر ومكتمل!</div>
                                    <div style="font-size: 0.9rem; margin-top: 6px; color: #64748b;">لا توجد أصناف وصلت لحد النواقص الأدنى أو اقتربت تواريخ صلاحيتها.</div>
                                </div>
                            ` : `
                                <div style="margin-bottom: 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                                    <span style="font-size:0.9rem; font-weight:900; color:#334155;">
                                        الأصناف المطلوب متابعتها (${activeProductsTotal}): <span style="color:#ef4444; font-weight:900;">(${activeLowStock.length} نواقص)</span> • <span style="color:#d97706; font-weight:900;">(${activeExpiring.length} صلاحيات)</span>
                                    </span>
                                    <button onclick="acknowledgeAllProductsNotifications()" style="padding: 7px 16px; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; border-radius: 9px; font-weight: 900; font-size: 0.84rem; cursor: pointer; box-shadow:0 2px 8px rgba(16,185,129,0.3);">
                                        ✔️ استلام وتوثيق كل تنبيهات البضاعة
                                    </button>
                                </div>

                                <div style="border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.02);">
                                    <table style="width:100%; border-collapse:collapse; font-size:0.88rem; text-align:right;">
                                        <thead>
                                            <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0; color: #475569; font-weight: 900;">
                                                <th style="padding:12px 16px;">الصنف والبيان</th>
                                                <th style="padding:12px 16px; text-align:center;">المخزون / تاريخ الصلاحية</th>
                                                <th style="padding:12px 16px; text-align:center;">مستوى التنبيه</th>
                                                <th style="padding:12px 16px; text-align:center; width:140px;">الإجراء</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <!-- أصناف النواقص -->
                                            ${activeLowStock.map(p => {
                                                const curStock = parseFloat(p.stock) || 0;
                                                const minStock = parseFloat(p.minStock) || 5;
                                                const isZero = curStock <= 0;
                                                const pDetails = `الرصيد: ${curStock} (حد الأمان: ${minStock})`;
                                                return `
                                                <tr style="border-bottom: 1px solid #f1f5f9; transition: 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                                                    <td style="padding: 12px 16px;">
                                                        <div style="display:flex; align-items:center; gap:10px;">
                                                            <div style="width:34px; height:34px; border-radius:10px; background:#fee2e2; color:#dc2626; display:flex; align-items:center; justify-content:center; font-size:1.1rem; flex-shrink:0;">
                                                                📦
                                                            </div>
                                                            <div>
                                                                <div style="font-weight:900; color:#0f172a; font-size:0.92rem;">${escapeStr(p.name)}</div>
                                                                ${p.barcode ? `<div style="font-size:0.75rem; color:#64748b; font-family:monospace;">كود: ${escapeStr(p.barcode)}</div>` : ''}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style="padding: 12px 16px; text-align:center;">
                                                        <span style="font-size:1.1rem; font-weight:900; color:#ef4444; direction:ltr; display:inline-block;">${curStock}</span>
                                                        <span style="font-size:0.78rem; color:#64748b; margin-right:4px;">(حد الأمان: ${minStock})</span>
                                                    </td>
                                                    <td style="padding: 12px 16px; text-align:center;">
                                                        ${isZero ? `
                                                            <span style="background:#fee2e2; color:#b91c1c; font-size:0.75rem; font-weight:900; padding:4px 10px; border-radius:20px; border:1px solid #fca5a5;">❌ نفد تماماً (0)</span>
                                                        ` : `
                                                            <span style="background:#fef3c7; color:#b45309; font-size:0.75rem; font-weight:900; padding:4px 10px; border-radius:20px; border:1px solid #fde68a;">⚠️ قارب على النفاد</span>
                                                        `}
                                                    </td>
                                                    <td style="padding: 12px 16px; text-align:center;">
                                                        <button onclick="window.acknowledgeNotification('low-stock', '${escapeStr(p.id)}', { name: '${escapeStr(p.name)}', details: '${escapeStr(pDetails)}', typeLabel: 'نواقص بضاعة' }, 'products')" 
                                                            style="background:linear-gradient(135deg, #10b981, #059669); color:white; border:none; border-radius:9px; padding:7px 14px; font-size:0.82rem; font-weight:900; cursor:pointer; display:inline-flex; align-items:center; gap:5px; box-shadow:0 2px 6px rgba(16,185,129,0.3); transition:0.2s;"
                                                            title="تأكيد الاستلام ونقله لسجل الاستلام الموثق">
                                                            <span>✔️</span> استلام
                                                        </button>
                                                    </td>
                                                </tr>`;
                                            }).join('')}

                                            <!-- أصناف الصلاحية -->
                                            ${activeExpiring.map(p => {
                                                const exp = new Date(p.expiry);
                                                exp.setHours(0, 0, 0, 0);
                                                const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
                                                const isExpired = diffDays <= 0;
                                                const pDetails = isExpired ? `منتهي بتاريخ ${p.expiry} (منذ ${Math.abs(diffDays)} يوم)` : `ينتهي في ${diffDays} يوم (${p.expiry})`;
                                                return `
                                                <tr style="border-bottom: 1px solid #f1f5f9; transition: 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                                                    <td style="padding: 12px 16px;">
                                                        <div style="display:flex; align-items:center; gap:10px;">
                                                            <div style="width:34px; height:34px; border-radius:10px; background:#fef3c7; color:#d97706; display:flex; align-items:center; justify-content:center; font-size:1.1rem; flex-shrink:0;">
                                                                📅
                                                            </div>
                                                            <div>
                                                                <div style="font-weight:900; color:#0f172a; font-size:0.92rem;">${escapeStr(p.name)}</div>
                                                                <div style="font-size:0.75rem; color:#64748b;">تاريخ الصلاحية: <b style="color:#0f172a;">${escapeStr(p.expiry)}</b></div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style="padding: 12px 16px; text-align:center;">
                                                        ${isExpired ? `
                                                            <span style="font-size:0.85rem; font-weight:900; color:#dc2626; background:#fee2e2; padding:3px 10px; border-radius:8px; border:1px solid #fca5a5;">❌ منتهي منذ ${Math.abs(diffDays)} يوم</span>
                                                        ` : `
                                                            <span style="font-size:0.85rem; font-weight:900; color:#d97706; background:#fef3c7; padding:3px 10px; border-radius:8px; border:1px solid #fde68a;">⏳ ينتهي خلال ${diffDays} يوم</span>
                                                        `}
                                                    </td>
                                                    <td style="padding: 12px 16px; text-align:center;">
                                                        <span style="background:${isExpired ? '#fee2e2' : '#fef3c7'}; color:${isExpired ? '#dc2626' : '#d97706'}; font-size:0.75rem; font-weight:900; padding:4px 10px; border-radius:20px;">
                                                            ${isExpired ? 'صلاحية منتهية ❌' : 'صلاحية وشيكة ⚠️'}
                                                        </span>
                                                    </td>
                                                    <td style="padding: 12px 16px; text-align:center;">
                                                        <button onclick="window.acknowledgeNotification('expiry', '${escapeStr(p.id)}', { name: '${escapeStr(p.name)}', details: '${escapeStr(pDetails)}', typeLabel: 'صلاحية قريبة/منتهية' }, 'products')" 
                                                            style="background:linear-gradient(135deg, #10b981, #059669); color:white; border:none; border-radius:9px; padding:7px 14px; font-size:0.82rem; font-weight:900; cursor:pointer; display:inline-flex; align-items:center; gap:5px; box-shadow:0 2px 6px rgba(16,185,129,0.3); transition:0.2s;"
                                                            title="تأكيد الاستلام ونقله لسجل الاستلام الموثق">
                                                            <span>✔️</span> استلام
                                                        </button>
                                                    </td>
                                                </tr>`;
                                            }).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            `}
                        ` : activeTab === 'accounts' ? `
                            <!-- 3. تبويب الحسابات والديون -->
                            ${(activeAccountsTotal === 0) ? `
                                <div style="text-align: center; padding: 50px 20px; color: #64748b;">
                                    <div style="font-size: 3.5rem; margin-bottom: 12px;">✅💳</div>
                                    <div style="font-weight: 900; font-size: 1.25rem; color: #0f172a;">حسابات العملاء منتظمة بالكامل!</div>
                                    <div style="font-size: 0.9rem; margin-top: 6px; color: #64748b;">لا توجد مديونيات نشطة أو حسابات متأخرة عن السداد بانتظار التذكير.</div>
                                </div>
                            ` : `
                                <div style="margin-bottom: 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                                    <span style="font-size:0.9rem; font-weight:900; color:#334155;">
                                        تنبيهات الحسابات النشطة (${activeAccountsTotal}): <span style="color:#ef4444; font-weight:900;">(${activeDebt.length} مديونية)</span> • <span style="color:#b45309; font-weight:900;">(${activeDelayed.length} متأخر سداد)</span>
                                    </span>
                                    <button onclick="acknowledgeAllAccountsNotifications()" style="padding: 7px 16px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; border: none; border-radius: 9px; font-weight: 900; font-size: 0.84rem; cursor: pointer; box-shadow:0 2px 8px rgba(59,130,246,0.3);">
                                        ✔️ استلام وتوثيق كل تنبيهات الحسابات
                                    </button>
                                </div>

                                <div style="border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.02);">
                                    <table style="width:100%; border-collapse:collapse; font-size:0.88rem; text-align:right;">
                                        <thead>
                                            <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0; color: #475569; font-weight: 900;">
                                                <th style="padding:12px 16px;">اسم العميل / الحساب</th>
                                                <th style="padding:12px 16px; text-align:center;">المبلغ المستحق</th>
                                                <th style="padding:12px 16px; text-align:center;">حالة السداد والتأخير</th>
                                                <th style="padding:12px 16px; text-align:center; width:190px;">الإجراءات</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <!-- ديون العملاء -->
                                            ${activeDebt.map(a => {
                                                const debit = parseFloat(a.debit) || 0;
                                                const credit = parseFloat(a.credit) || 0;
                                                const balance = debit - credit;
                                                const detailsText = `المبلغ المستحق: ${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م`;
                                                return `
                                                <tr style="border-bottom: 1px solid #f1f5f9; transition: 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                                                    <td style="padding: 12px 16px;">
                                                        <div style="display:flex; align-items:center; gap:10px;">
                                                            <div style="width:34px; height:34px; border-radius:10px; background:#eff6ff; color:#2563eb; display:flex; align-items:center; justify-content:center; font-size:1.1rem; flex-shrink:0;">
                                                                💳
                                                            </div>
                                                            <div>
                                                                <div style="font-weight:900; color:#0f172a; font-size:0.92rem;">${escapeStr(a.name)}</div>
                                                                ${a.phone ? `<div style="font-size:0.75rem; color:#64748b;">📞 ${escapeStr(a.phone)}</div>` : ''}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style="padding: 12px 16px; text-align:center;">
                                                        <span style="font-size:1.08rem; font-weight:900; color:#e11d48; direction:ltr; display:inline-block;">${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                                        <span style="font-size:0.78rem; color:#64748b; margin-right:4px;">ج.م</span>
                                                    </td>
                                                    <td style="padding: 12px 16px; text-align:center;">
                                                        <span style="background:#fee2e2; color:#be123c; font-size:0.75rem; font-weight:900; padding:4px 10px; border-radius:20px; border:1px solid #fecdd3;">مديونية مستحقة للتذكير</span>
                                                    </td>
                                                    <td style="padding: 12px 16px; text-align:center;">
                                                        <div style="display:flex; gap:6px; justify-content:center; align-items:center;">
                                                            <button class="tool-btn" style="background:#3b82f6; color:white; border-radius:8px; border:none; padding: 6px 12px; font-weight:800; font-size:0.8rem; cursor:pointer;" onclick="openStatementFromNotify('${escapeStr(a.id)}')" title="عرض كشف حساب العميل">📄 كشف</button>
                                                            <button class="tool-btn" style="background:linear-gradient(135deg, #10b981, #059669); color:white; border-radius:8px; padding: 6px 14px; font-size: 0.8rem; font-weight: 900; border: none; cursor: pointer; display:flex; align-items:center; gap:4px; box-shadow:0 2px 6px rgba(16,185,129,0.3);" 
                                                                onclick="window.acknowledgeNotification('debt', '${escapeStr(a.id)}', { name: '${escapeStr(a.name)}', details: '${escapeStr(detailsText)}', typeLabel: 'مديونية عميل' }, 'accounts')" title="تأكيد الاستلام ونقله لسجل الاستلام">
                                                                <span style="font-size:0.85rem;">✔️</span> استلام
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>`;
                                            }).join('')}

                                            <!-- العملاء المتأخرين عن السداد -->
                                            ${activeDelayed.map(a => {
                                                const debit = parseFloat(a.debit) || 0;
                                                const credit = parseFloat(a.credit) || 0;
                                                const balance = debit - credit;
                                                const lastTrans = (typeof transactions !== 'undefined' && Array.isArray(transactions))
                                                    ? transactions.filter(t => t.partnerId === a.id || t.account === a.name || t.partner === a.name).sort((x, y) => new Date(y.date || y.timestamp) - new Date(x.date || x.timestamp))[0]
                                                    : null;
                                                let delayNote = "متأخر عن السداد (لا توجد دفعات مسجلة)";
                                                if (lastTrans) {
                                                    const lastDate = new Date(lastTrans.date || lastTrans.timestamp);
                                                    const diffDays = Math.ceil((today - lastDate) / (1000 * 60 * 60 * 24));
                                                    delayNote = `متأخر منذ ${diffDays} يوم (آخر حركة: ${lastTrans.date || ''})`;
                                                }
                                                const detailsText = `المبلغ: ${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م (${delayNote})`;
                                                return `
                                                <tr style="border-bottom: 1px solid #f1f5f9; transition: 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                                                    <td style="padding: 12px 16px;">
                                                        <div style="display:flex; align-items:center; gap:10px;">
                                                            <div style="width:34px; height:34px; border-radius:10px; background:#fef3c7; color:#d97706; display:flex; align-items:center; justify-content:center; font-size:1.1rem; flex-shrink:0;">
                                                                ⏳
                                                            </div>
                                                            <div>
                                                                <div style="font-weight:900; color:#0f172a; font-size:0.92rem;">${escapeStr(a.name)}</div>
                                                                ${a.phone ? `<div style="font-size:0.75rem; color:#64748b;">📞 ${escapeStr(a.phone)}</div>` : ''}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style="padding: 12px 16px; text-align:center;">
                                                        <span style="font-size:1.08rem; font-weight:900; color:#b45309; direction:ltr; display:inline-block;">${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                                        <span style="font-size:0.78rem; color:#64748b; margin-right:4px;">ج.م</span>
                                                    </td>
                                                    <td style="padding: 12px 16px; text-align:center;">
                                                        <span style="background:#fffbeb; color:#b45309; font-size:0.75rem; font-weight:900; padding:4px 10px; border-radius:20px; border:1px solid #fde68a;">⏳ ${escapeStr(delayNote)}</span>
                                                    </td>
                                                    <td style="padding: 12px 16px; text-align:center;">
                                                        <div style="display:flex; gap:6px; justify-content:center; align-items:center;">
                                                            <button class="tool-btn" style="background:#3b82f6; color:white; border-radius:8px; border:none; padding: 6px 12px; font-weight:800; font-size:0.8rem; cursor:pointer;" onclick="openStatementFromNotify('${escapeStr(a.id)}')" title="عرض كشف حساب العميل">📄 كشف</button>
                                                            <button class="tool-btn" style="background:linear-gradient(135deg, #10b981, #059669); color:white; border-radius:8px; padding: 6px 14px; font-size: 0.8rem; font-weight: 900; border: none; cursor: pointer; display:flex; align-items:center; gap:4px; box-shadow:0 2px 6px rgba(16,185,129,0.3);" 
                                                                onclick="window.acknowledgeNotification('delayed', '${escapeStr(a.id)}', { name: '${escapeStr(a.name)}', details: '${escapeStr(detailsText)}', typeLabel: 'متأخر عن السداد' }, 'accounts')" title="تأكيد الاستلام ونقله لسجل الاستلام">
                                                                <span style="font-size:0.85rem;">✔️</span> استلام
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>`;
                                            }).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            `}
                        ` : activeTab === 'archived' ? `
                            <!-- 4. تبويب سجل الاستلام والتدقيق الموثق (Audit & Receipt Log) -->
                            <div style="display:flex; flex-direction:column; gap:16px;">
                                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; background:#f8fafc; padding:12px 16px; border-radius:14px; border:1px solid #e2e8f0;">
                                    <div>
                                        <span style="font-weight:900; color:#0f172a; font-size:0.95rem;">📋 سجل الاستلام والتدقيق الموثق:</span>
                                        <span style="font-size:0.82rem; color:#64748b; margin-right:8px;">توثيق رسمي لجميع التنبيهات المستلمة بالوقت واسم المستلم والمخزن.</span>
                                    </div>
                                    <div style="display:flex; gap:8px;">
                                        ${totalReceiptCount > 0 ? `
                                            <button onclick="window.resetAcknowledgedNotifications()" style="padding:6px 14px; background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; border-radius:8px; font-weight:900; font-size:0.8rem; cursor:pointer; transition:0.2s;" title="إعادة كافة التنبيهات للقوائم النشطة">
                                                🔄 استعادة الكل للنشط
                                            </button>
                                            <button onclick="window.clearReceiptLog()" style="padding:6px 14px; background:#f1f5f9; color:#64748b; border:1px solid #cbd5e1; border-radius:8px; font-weight:900; font-size:0.8rem; cursor:pointer; transition:0.2s;" title="مسح بيانات السجل نهائياً">
                                                🗑️ مسح السجل
                                            </button>
                                        ` : ''}
                                    </div>
                                </div>

                                ${(totalReceiptCount === 0) ? `
                                    <div style="text-align: center; padding: 50px 20px; color: #64748b;">
                                        <div style="font-size: 3.5rem; margin-bottom: 12px;">📁📋</div>
                                        <div style="font-weight: 900; font-size: 1.25rem; color: #0f172a;">سجل الاستلام فارغ حالياً</div>
                                        <div style="font-size: 0.9rem; margin-top: 6px; color: #64748b;">عند النقر على زر <b>(✔️ استلام)</b> في أي تنبيه، سيتم توثيق اسم المستلم والمخزن وتوقيت الاستلام هنا فوراً.</div>
                                    </div>
                                ` : `
                                    <div style="border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.02);">
                                        <table style="width:100%; border-collapse:collapse; font-size:0.86rem; text-align:right;">
                                            <thead>
                                                <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0; color: #475569; font-weight: 900;">
                                                    <th style="padding:12px 14px; width:130px; text-align:center;">نوع التنبيه</th>
                                                    <th style="padding:12px 14px;">البيان المستلم</th>
                                                    <th style="padding:12px 14px;">التفاصيل والرصيد</th>
                                                    <th style="padding:12px 14px; text-align:center; width:110px;">👤 المستلم</th>
                                                    <th style="padding:12px 14px; text-align:center; width:110px;">🏬 المخزن</th>
                                                    <th style="padding:12px 14px; text-align:center; width:130px;">🕒 التوقيت</th>
                                                    <th style="padding:12px 14px; text-align:center; width:95px;">إجراء</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${receiptLog.map((log) => {
                                                    const badgeColor = (log.type === 'low-stock') ? '#ef4444' 
                                                        : (log.type === 'expiry' ? '#d97706' 
                                                        : (log.type === 'debt' ? '#2563eb' 
                                                        : (log.type === 'delayed' ? '#b45309' 
                                                        : (log.type === 'transfer' ? '#059669' : '#8b5cf6'))));
                                                    
                                                    const badgeBg = (log.type === 'low-stock') ? '#fee2e2' 
                                                        : (log.type === 'expiry' ? '#fef3c7' 
                                                        : (log.type === 'debt' ? '#eff6ff' 
                                                        : (log.type === 'delayed' ? '#fffbeb' 
                                                        : (log.type === 'transfer' ? '#ecfdf5' : '#f5f3ff'))));

                                                    const icon = (log.type === 'low-stock') ? '📦' 
                                                        : (log.type === 'expiry' ? '📅' 
                                                        : (log.type === 'debt' ? '💳' 
                                                        : (log.type === 'delayed' ? '⚠️' 
                                                        : (log.type === 'transfer' ? '🚚' : '☁️'))));

                                                    return `
                                                    <tr style="border-bottom: 1px solid #f1f5f9; transition: 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                                                        <td style="padding: 10px 12px; text-align:center;">
                                                            <span style="background:${badgeBg}; color:${badgeColor}; font-weight:900; font-size:0.75rem; padding:4px 9px; border-radius:14px; display:inline-flex; align-items:center; gap:4px; border:1px solid ${badgeColor}33;">
                                                                <span>${icon}</span> ${escapeStr(log.typeLabel || log.type)}
                                                            </span>
                                                        </td>
                                                        <td style="padding: 10px 12px; font-weight:900; color:#0f172a;">
                                                            ${escapeStr(log.name)}
                                                        </td>
                                                        <td style="padding: 10px 12px; color:#475569; font-weight:bold; font-size:0.82rem;">
                                                            ${escapeStr(log.details || '-')}
                                                        </td>
                                                        <td style="padding: 10px 12px; text-align:center; font-weight:900; color:#1e293b; font-size:0.82rem;">
                                                            <span style="background:#f1f5f9; padding:3px 8px; border-radius:6px;">👤 ${escapeStr(log.user || 'المدير')}</span>
                                                        </td>
                                                        <td style="padding: 10px 12px; text-align:center; color:#047857; font-weight:bold; font-size:0.8rem;">
                                                            ${escapeStr(log.warehouse || 'الرئيسي')}
                                                        </td>
                                                        <td style="padding: 10px 12px; text-align:center; color:#64748b; font-size:0.78rem; font-weight:bold;">
                                                            <div>${escapeStr(log.date || '')}</div>
                                                            <div style="color:#0f172a;">${escapeStr(log.time || '')}</div>
                                                        </td>
                                                        <td style="padding: 10px 12px; text-align:center;">
                                                            <button onclick="window.unacknowledgeNotification('${escapeStr(log.type)}', '${escapeStr(log.targetId)}', '${escapeStr(log.logId)}')" 
                                                                style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; border-radius:8px; padding:4px 10px; font-size:0.75rem; font-weight:900; cursor:pointer; display:inline-flex; align-items:center; gap:4px; transition:0.2s;"
                                                                onmouseover="this.style.background='#fee2e2'; this.style.color='#dc2626'; this.style.borderColor='#fca5a5';"
                                                                onmouseout="this.style.background='#f1f5f9'; this.style.color='#475569'; this.style.borderColor='#cbd5e1';"
                                                                title="استعادة هذا التنبيه وإلغاء استلامه وإرجاعه للقائمة النشطة">
                                                                <span>🔄</span> استعادة
                                                            </button>
                                                        </td>
                                                    </tr>`;
                                                }).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                `}
                            </div>
                        ` : `
                            <!-- 5. تبويب الإشعارات والرسائل السحابية -->
                            <div style="display:flex; flex-direction:column; gap:16px;">
                                ${(window.cloudAnnouncementsHistory && window.cloudAnnouncementsHistory.length > 0) ? `
                                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; flex-wrap:wrap; gap:8px;">
                                        <span style="font-size:0.88rem; font-weight:900; color:#334155;">سجل الرسائل والتحديثات السحابية الواردة (${window.cloudAnnouncementsHistory.length}):</span>
                                        <button onclick="if (typeof window.checkCloudAnnouncements === 'function') { window.checkCloudAnnouncements(); setTimeout(() => showNotificationsModal('cloud'), 800); }" style="padding: 6px 14px; background: #8b5cf6; color: white; border: none; border-radius: 9px; font-weight: 900; font-size: 0.8rem; cursor: pointer; box-shadow: 0 2px 6px rgba(139, 92, 246, 0.3);">
                                            🔄 فحص الرسائل السحابية الآن
                                        </button>
                                    </div>
                                    ${window.cloudAnnouncementsHistory.map((item, idx) => {
                                        const annNumber = item.id ? item.id : (idx + 1);
                                        const dateFormatted = item.receivedAt ? new Date(item.receivedAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
                                        return `
                                        <div style="background: linear-gradient(135deg, #1e113a, #0f172a); border: 2px solid ${item.active ? 'rgba(212, 175, 55, 0.7)' : 'rgba(255, 255, 255, 0.15)'}; border-radius: 20px; padding: 22px 25px; color: white; box-shadow: 0 10px 25px rgba(0,0,0,0.25); position:relative;">
                                            <div style="position:absolute; top:18px; left:20px; display:flex; gap:8px; align-items:center;">
                                                <span style="background: rgba(255,255,255,0.15); color: #fde047; font-size: 0.75rem; font-weight: 900; padding: 3px 10px; border-radius: 20px; border: 1px solid rgba(253, 224, 71, 0.4);">
                                                    #${annNumber}
                                                </span>
                                                ${item.active ? '<span style="background:#10b981; color:#fff; font-size:0.75rem; font-weight:900; padding:3px 10px; border-radius:20px; box-shadow: 0 2px 6px rgba(16,185,129,0.3);">نشط حالياً ⚡</span>' : '<span style="background:rgba(255,255,255,0.12); color:#cbd5e1; font-size:0.72rem; font-weight:700; padding:3px 10px; border-radius:20px;">أرشيف سابق 📁</span>'}
                                            </div>
                                            
                                            <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px;">
                                                <div style="width: 46px; height: 46px; background: linear-gradient(135deg, #d4af37, #b45309); border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 24px; box-shadow: 0 4px 12px rgba(212, 175, 55, 0.35);">
                                                    ${item.icon || '📢'}
                                                </div>
                                                <div>
                                                    <h4 style="margin: 0; font-size: 1.18rem; font-weight: 900; color: #fde047;">${escapeStr(item.title || 'إشعار سحابي')}</h4>
                                                    <p style="margin: 3px 0 0; font-size: 0.78rem; color: #94a3b8; font-weight: bold;">
                                                        رسالة مباشرة من فريق التطوير ${dateFormatted ? `• 📅 ${dateFormatted}` : ''}
                                                    </p>
                                                </div>
                                            </div>

                                            <div style="background: rgba(255,255,255,0.06); border-radius: 14px; padding: 16px 18px; font-size: 0.95rem; line-height: 1.8; font-weight: 700; color: #f8fafc; margin-bottom: 14px; border: 1px solid rgba(255,255,255,0.08); white-space: pre-line;">
                                                ${escapeStr(item.message || 'لا توجد تفاصيل.')}
                                            </div>

                                            ${item.link ? `
                                                <div style="text-align:left;">
                                                    <button onclick="window.open('${escapeStr(item.link)}', '_blank')" style="padding: 8px 18px; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; border-radius: 10px; font-weight: 900; font-size:0.85rem; cursor: pointer; box-shadow: 0 3px 8px rgba(16,185,129,0.3);">
                                                        ${escapeStr(item.linkText || 'معرفة التفاصيل 🔗')}
                                                    </button>
                                                </div>
                                            ` : ''}
                                        </div>`;
                                    }).join('')}
                                ` : `
                                    <div style="text-align: center; padding: 50px 20px; color: #64748b;">
                                        <div style="font-size: 3.5rem; margin-bottom: 12px;">☁️</div>
                                        <div style="font-weight: 900; font-size: 1.2rem; color: #0f172a;">لا توجد رسائل سحابية حالياً</div>
                                        <div style="font-size: 0.9rem; margin-top: 6px; color: #64748b;">جميع التحديثات والتهاني المباشرة من فريق التطوير ستظهر لك وتتراكم هنا فور نشرها.</div>
                                        <button onclick="if (typeof window.checkCloudAnnouncements === 'function') { window.checkCloudAnnouncements(); setTimeout(() => showNotificationsModal('cloud'), 1000); }" style="margin-top: 15px; padding: 9px 20px; background: #8b5cf6; color: white; border: none; border-radius: 10px; font-weight: 900; cursor: pointer; box-shadow:0 3px 10px rgba(139,92,246,0.3);">
                                            🔄 فحص وتحديث الرسائل السحابية الآن
                                        </button>
                                    </div>
                                `}
                            </div>
                        `}
                    </div>

                    <!-- Footer مع أزرار سريعة وإغلاق -->
                    <div style="padding: 14px 26px; background: #f8fafc; border-top: 1.5px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                        <div>
                            ${(activeTab === 'products' && activeProductsTotal > 0) ? `
                                <button onclick="acknowledgeAllProductsNotifications()" style="padding: 9px 20px; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; border-radius: 10px; font-weight: 900; cursor: pointer; font-size:0.86rem; box-shadow:0 2px 8px rgba(16,185,129,0.3);">
                                    <span>✔️</span> استلام وتوثيق كل تنبيهات البضاعة والصلاحية
                                </button>
                            ` : (activeTab === 'accounts' && activeAccountsTotal > 0) ? `
                                <button onclick="acknowledgeAllAccountsNotifications()" style="padding: 9px 20px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; border: none; border-radius: 10px; font-weight: 900; cursor: pointer; font-size:0.86rem; box-shadow:0 2px 8px rgba(59,130,246,0.3);">
                                    <span>✔️</span> استلام وتوثيق كل تنبيهات الحسابات
                                </button>
                            ` : (activeTab === 'archived' && totalReceiptCount > 0) ? `
                                <button onclick="window.resetAcknowledgedNotifications()" style="padding: 9px 20px; background: #fee2e2; color: #dc2626; border: 1.5px solid #fca5a5; border-radius: 10px; font-weight: 900; cursor: pointer; font-size:0.86rem;">
                                    <span>🔄</span> استعادة جميع التنبيهات المستلمة للقوائم النشطة
                                </button>
                            ` : ''}
                        </div>
                        <button onclick="document.getElementById('notifyModal').remove()" style="padding: 10px 32px; background: #0f172a; color: white; border: none; border-radius: 10px; font-weight: 900; font-size:0.9rem; cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='#1e293b'" onmouseout="this.style.background='#0f172a'">إغلاق</button>
                    </div>
                </div>
            `;

            const existingModal = document.getElementById('notifyModal');
            if (existingModal) {
                existingModal.innerHTML = modalContent;
            } else {
                const fullModal = `<div id="notifyModal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.75); display:flex; align-items:center; justify-content:center; z-index:99999; animation: fadeIn 0.2s ease;">${modalContent}</div>`;
                document.body.insertAdjacentHTML('beforeend', fullModal);
            }
        };

        window.openStatementFromNotify = function(accountId) {
            const canView = (typeof currentUser !== 'undefined' && currentUser && (currentUser.role === 'admin' || (typeof hasPermission === 'function' && (hasPermission('accounts_statement') || hasPermission('accounts_view')))));
            if (!canView) {
                if (typeof showToast === 'function') showToast('⛔ عذراً، لا تمتلك صلاحية لعرض كشف حساب العملاء', 'error');
                return;
            }

            const notifyModal = document.getElementById('notifyModal');
            if (notifyModal) notifyModal.remove();

            if (typeof switchSection === 'function') {
                switchSection('accounts');
            }

            window.selectedAccountID = accountId;
            if (typeof renderAccountsTable === 'function') {
                renderAccountsTable();
            }
            if (typeof generateAccountStatement === 'function') {
                generateAccountStatement();
            }
        };

        function adjustInvoiceFont(part, val) {
            const preview = document.getElementById('invoiceLivePreview');
            if (!preview) return;

            if (part === 'header') {
                const header = preview.querySelector('div[style*="font-weight: 900"]');
                if (header) header.style.fontSize = (val/10) + 'rem';
            } else if (part === 'table') {
                const table = preview.querySelector('table');
                if (table) table.style.fontSize = (val/16) + 'rem';
            }
        }

        function loadPrintTemplateChoice() {
            const saved = getStore('bayan_print_template_choice');
            if (saved) {
                const s = JSON.parse(saved);
                currentSelectedTemplateType = s.type || 'فاتورة المبيعات';
                currentSelectedTemplateId = s.template || '0010 - 80mm';
            }
            // تمييز العناصر المختارة في القوائم
            document.querySelectorAll('.template-type-item').forEach(item => {
                if (item.innerText === currentSelectedTemplateType) {
                    item.classList.add('active');
                    item.style.background = '#3498db';
                    item.style.color = 'white';
                } else {
                    item.classList.remove('active');
                    item.style.background = 'transparent';
                    item.style.color = 'inherit';
                }
            });
            document.querySelectorAll('.template-item').forEach(item => {
                const onclickAttr = item.getAttribute('onclick') || '';
                if (onclickAttr.includes("'" + currentSelectedTemplateId + "'")) {
                    item.classList.add('active');
                    item.style.background = '#3498db';
                    item.style.color = 'white';
                } else {
                    item.classList.remove('active');
                    item.style.background = 'transparent';
                    item.style.color = 'inherit';
                }
            });
            refreshPinnedVisuals();
            updatePrintPreview();
        }
        // تكرار الحماية السحابية (تم النقل للأعلى للتوحيد)
        function showLockScreen(message) {
            let lockOverlay = document.getElementById('bayanLockScreen');
            if (!lockOverlay) {
                lockOverlay = document.createElement('div');
                lockOverlay.id = 'bayanLockScreen';
                lockOverlay.style.cssText = `
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(0,0,0,0.9); 
                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                    z-index: 1000000; color: white; text-align: center; font-family: 'Cairo', sans-serif;
                `;
                document.body.appendChild(lockOverlay);
            }

            lockOverlay.innerHTML = `
                <div style="background: white; color: #333; padding: 40px; border-radius: 20px; box-shadow: 0 0 50px rgba(0,0,0,0.5); border-top: 5px solid #c0392b;">
                    <div style="font-size: 5rem; margin-bottom: 20px;">🛡️</div>
                    <h2 style="margin-bottom: 20px; font-weight: 900;">بَيَان - حماية النظام</h2>
                    <p style="font-size: 1.2rem; margin-bottom: 30px; line-height: 1.6;">${message}</p>
                    <button onclick="location.reload()" style="background: #27ae60; color: white; border: none; padding: 12px 30px; border-radius: 10px; font-size: 1.1rem; font-weight: bold; cursor: pointer;">🔄 تحديث الحالة</button>
                    <div style="margin-top: 20px; font-size: 0.8rem; color: #888;">Hardware ID: <span id="lock-hwid">---</span></div>
                </div>
            `;
            getUniqueHWID().then(id => {
                const idEl = document.getElementById('lock-hwid');
                if (idEl) idEl.innerText = id;
            });
        }

        function checkLocalAccess() {
            const isSubscribed = window.activeLicense && window.activeLicense.isValid && window.activeLicense.plan !== 'باقة نسخة المجانية';
            const trialBanner = document.getElementById('trialBanner');
            const subModal = document.getElementById('subscriptionModal');
            const closeBtn = document.getElementById('closeSubBtn');

            if (isSubscribed) {
                if (trialBanner) trialBanner.classList.add('hidden');
                if (subModal) subModal.classList.add('hidden');
                return true;
            }

            const installDateStr = getStore('bayan_install_date');
            if (!installDateStr) {
                setStore('bayan_install_date', new Date().toISOString());
                return true;
            }

            const diffDays = Math.floor((new Date() - new Date(installDateStr)) / (1000 * 60 * 60 * 24));
            const timeExpired = diffDays >= 30;

            if (timeExpired) {
                showLockScreen("انتهت الفترة التجريبية.. تواصل مع عمرو إيهاب 01006825905");
                return false;
            } else {
                if (trialBanner) {
                    trialBanner.classList.remove('hidden');
                    const label = document.getElementById('trialDaysLeft');
                    if (label) {
                        label.innerHTML = `⏳ باقي لك <strong style="color:var(--accent-gold);">${Math.max(0, 30 - diffDays)}</strong> يوم في الفترة التجريبية المجانية.`;
                    }
                }
                return true;
            }
        }


        // تم حذف الدوال المكررة لضمان عمل النسخة الذهبية الجديدة

        // --- دالة جلب التاريخ والوقت للعملية ---
        function showProfessionalModal(content, maxWidth = '950px') {
            let modal = document.getElementById('detailsOverlay');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'detailsOverlay';
                modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:12000; display:flex; align-items:center; justify-content:center;";
                document.body.appendChild(modal);
            }
            modal.innerHTML = `
                <div class="modal-draggable-content" style="background:white; width:95%; max-width:${maxWidth}; border-radius:15px; overflow:hidden; box-shadow:0 15px 50px rgba(0,0,0,0.3); animation: slideUp 0.3s ease-out; position: relative;">
                    ${content}
                </div>
            `;
            modal.classList.remove('hidden');

            // تفعيل السحب للنافذة الجديدة
            const contentDiv = modal.querySelector('.modal-draggable-content');
            if (contentDiv) makeElementDraggable(contentDiv);
        }

        function makeElementDraggable(el) {
            let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
            // البحث عن الهيدر (أول ديف داخلي غالباً يكون هو الهيدر الملون)
            const header = el.querySelector('div[style*="background"]');
            if (header) {
                header.style.cursor = 'move';
                header.onmousedown = dragMouseDown;
            } else {
                el.onmousedown = dragMouseDown;
            }

            function dragMouseDown(e) {
                e = e || window.event;
                if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

                e.preventDefault();
                pos3 = e.clientX;
                pos4 = e.clientY;
                document.onmouseup = closeDragElement;
                document.onmousemove = elementDrag;

                const parent = el.parentElement;
                if (parent && parent.style.display === 'flex') {
                    parent.style.display = 'block';
                    el.style.position = 'absolute';
                    const rect = el.getBoundingClientRect();
                    el.style.top = rect.top + 'px';
                    el.style.left = rect.left + 'px';
                    el.style.transform = 'none';
                    el.style.margin = '0';
                }
            }

            function elementDrag(e) {
                e = e || window.event;
                e.preventDefault();
                pos1 = pos3 - e.clientX;
                pos2 = pos4 - e.clientY;
                pos3 = e.clientX;
                pos4 = e.clientY;
                el.style.top = (el.offsetTop - pos2) + "px";
                el.style.left = (el.offsetLeft - pos1) + "px";
            }

            function closeDragElement() {
                document.onmouseup = null;
                document.onmousemove = null;
            }
        }
        window.makeElementDraggable = makeElementDraggable;

        function closeCustomModal() {
            const modal = document.getElementById('detailsOverlay');
            if (modal) modal.classList.add('hidden');
        }

        async function printBillFromData(invoiceId, type = '') {
            if (typeof viewInvoiceItems === 'function') {
                viewInvoiceItems(invoiceId, type, true);
            } else if (typeof printInvoice === 'function') {
                const items = transactions.filter(t => t.invoiceId == invoiceId);
                if (items.length === 0) return alert("لا تتوفر بيانات لهذه الفاتورة.");
                const head = items[0];
                let partnerName = head.partner || head.customer || '';
                let prevBal = 0;
                if (partnerName && !window.isGenericCashPartner(partnerName)) {
                    if (typeof getHistoricalPartnerBalance === 'function') {
                        prevBal = getHistoricalPartnerBalance(partnerName, head.invoiceId || head.id);
                    } else if (typeof getAccountBalance === 'function') {
                        prevBal = getAccountBalance(partnerName, head.invoiceId || head.id);
                    }
                }
                const totalAmt = parseFloat(head.total || 0);
                const paidAmt = parseFloat(head.paidAmount || head.paid || 0);
                const deferredAmt = parseFloat(head.deferred !== undefined ? head.deferred : (totalAmt - paidAmt));
                const hType = String(head.type || '');
                const isRet = hType.includes('مرتجع') || hType.includes('return');
                const isPur = hType.includes('شراء') || hType.includes('مشتريات') || hType.includes('purchase');
                const pDocType = isRet ? (isPur ? 'return_purchase' : 'return_sales') : (isPur ? 'purchase' : 'sales');
                const pDocTitle = isRet ? (isPur ? 'مرتجع مشتريات' : 'مرتجع مبيعات') : (isPur ? 'فاتورة شراء' : 'فاتورة مبيعات');

                printInvoice({
                    invoiceNumber: head.invoiceId || head.id,
                    invoiceType: isRet ? (isPur ? 'مرتجع مشتريات' : 'مرتجع مبيعات') : (head.type || 'بيع'),
                    paymentMethod: head.method || head.paymentMethod || 'نقدي',
                    isReturn: isRet,
                    isPurchase: isPur,
                    docTitle: pDocTitle,
                    date: head.dateISO || head.date || '',
                    time: head.timeISO || '',
                    cashier: head.user || head.cashier || '',
                    customer: partnerName || 'عميل نقدي',
                    items: items.map(it => ({
                        name: it.product || it.name,
                        qty: parseFloat(it.qty || 1),
                        price: parseFloat(it.price || 0),
                        unit: it.unit || 'قطعة',
                        size: it.size || it.selectedSize || '',
                        color: it.color || it.selectedColor || ''
                    })),
                    totalAmount: totalAmt,
                    paid: paidAmt,
                    deferred: deferredAmt,
                    prevBalance: prevBal,
                    currentBalance: prevBal + deferredAmt,
                    docType: pDocType
                });
            }
            if (typeof closeCustomModal === 'function') closeCustomModal();
        }


        // دالة كشف الحساب السريع من شاشة البيع بدون مغادرة الصفحة
        async function openQuickCustomerInfo() {
            const customerNameInput = document.getElementById('customerName');
            const name = customerNameInput ? customerNameInput.value.trim() : '';

            if (!name || name === '---' || name === 'عميل نقدي') {
                return showCustomAlert({
                    type: 'warning',
                    titleText: '⚠️ تنبيه',
                    msg: 'يرجى اختيار عميل أولاً لعرض كشف الحساب السريع.'
                });
            }

            const acc = accounts.find(a => a.name === name);
            if (!acc) return alert("العميل غير موجود في سجل الحسابات.");

            const bal = getAccountBalance(name);
            const lastTrans = transactions.filter(t => t.partner === name).reverse().slice(0, 5);

            let transRows = lastTrans.map(t => `
                <tr style="font-size: 0.85rem;">
                    <td>${t.date}</td>
                    <td>${t.type}</td>
                    <td style="font-weight:bold;">${(parseFloat(t.total) || parseFloat(t.price) || 0).toFixed(2)}</td>
                    <td style="color: ${t.paidAmount > 0 ? 'green' : 'red'};">${(parseFloat(t.paidAmount) || 0).toFixed(2)}</td>
                </tr>
            `).join('');

            if (transRows === '') transRows = '<tr><td colspan="4" style="text-align:center; padding:10px;">لا توجد حركات سابقة</td></tr>';

            // معالجة العناوين والهواتف المتعددة (إذا وجد فاصل | أو ,)
            const addresses = acc.address ? acc.address.split(/[|,]/).map(s => s.trim()).filter(s => s) : [];
            const mobiles = acc.mobile ? acc.mobile.split(/[|,]/).map(s => s.trim()).filter(s => s) : [];

            let multiInfo = '';
            if (addresses.length > 1 || mobiles.length > 1) {
                multiInfo = `
                <div style="background:#fff3e0; padding:10px; border-radius:8px; margin-bottom:15px; border:1px solid #ffe0b2;">
                    <label style="font-size:0.8rem; font-weight:bold; color:#e67e22;">📍 اختر العنوان/الهاتف للطباعة:</label>
                    <select id="selectedAddress" onchange="currentSessionSelectedAddress = this.value" style="width:100%; margin-top:5px; padding:5px; border:1px solid #ddd; border-radius:4px;">
                        <option value="">-- اختر عنواناً للطباعة --</option>
                        ${addresses.map(addr => `<option value="${addr}" ${currentSessionSelectedAddress === addr ? 'selected' : ''}>${addr}</option>`).join('')}
                        ${mobiles.map(m => `<option value="${m}" ${currentSessionSelectedAddress === m ? 'selected' : ''}>هاتف: ${m}</option>`).join('')}
                    </select>
                </div>`;
            }

            const content = `
                <div style="direction:rtl; text-align:right; padding:15px; font-family:sans-serif;">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid var(--main-blue); padding-bottom:10px; margin-bottom:15px;">
                        <h2 style="margin:0; color:var(--main-blue);">👤 ملف العميل السريع</h2>
                        <span style="background:var(--box-red); color:white; padding:4px 12px; border-radius:15px; font-weight:bold; font-size:1.1rem;">${bal.toFixed(2)} ج.م</span>
                    </div>

                    ${multiInfo}

                    <p style="margin-bottom:10px; font-weight:bold; color:#555;">📋 آخر 5 حركات مسجلة:</p>
                    <table style="width:100%; border-collapse:collapse; margin-bottom:20px; text-align:center;">
                        <thead style="background:#eee;">
                            <tr><th style="padding:6px; border:1px solid #ddd;">التاريخ</th><th style="padding:6px; border:1px solid #ddd;">العملية</th><th style="padding:6px; border:1px solid #ddd;">المبلغ</th><th style="padding:6px; border:1px solid #ddd;">مدفوع</th></tr>
                        </thead>
                        <tbody>${transRows}</tbody>
                    </table>

                    <div style="display:flex; gap:10px; justify-content:center;">
                        <button onclick="closeCustomModal()" style="padding:8px 30px; background:#636e72; color:white; border:none; border-radius:8px; cursor:pointer;">إغلاق</button>
                        <button onclick="switchSection('accounts'); document.getElementById('accountsSearch').value='${name}'; renderAccountsTable(); closeCustomModal();" 
                            style="padding:8px 30px; background:var(--main-blue); color:white; border:none; border-radius:8px; cursor:pointer;">📂 ملف العميل الكامل</button>
                    </div>
                </div>
            `;

            showProfessionalModal(content);
        }

        window.renderCustomInvoiceModal = function(tx, autoPrint = false) {
            let typeName = 'فاتورة مبيعات';
            let typeColor = '#27ae60';
            let isTransfer = false, isReturn = false, isPurchase = false, isAdjustment = false;
            let isReceipt = false, isDisburse = false;
            
            let tType = String(tx.type || '').toLowerCase();
            if (tType === 'sale_return' || tType.includes('مرتجع بيع') || tType.includes('مرتجع مبيعات')) {
                typeName = 'مرتجع مبيعات'; typeColor = '#e67e22'; isReturn = true;
            } else if (tType === 'purchase_return' || tType.includes('مرتجع شراء') || tType.includes('مرتجع مشتريات')) {
                typeName = 'مرتجع مشتريات'; typeColor = '#d35400'; isReturn = true; isPurchase = true;
            } else if (tType === 'sale' || tType === 'بيع' || (tType.includes('بيع') && !tType.includes('مرتجع'))) {
                typeName = 'فاتورة مبيعات'; typeColor = '#27ae60';
            } else if (tType === 'purchase' || tType === 'شراء' || (tType.includes('شراء') && !tType.includes('مرتجع')) || (tType.includes('مشتريات') && !tType.includes('مرتجع'))) {
                typeName = 'فاتورة مشتريات'; typeColor = '#2980b9'; isPurchase = true;
            } else if (tType.includes('transfer') || tType.includes('تحويل') || tType === 'stock') {
                if (tx.transferStatus === 'rejected') {
                    typeName = 'إذن تحويل مخزني (❌ ملغي ومرفوض)';
                    typeColor = '#dc2626';
                } else if (tx.transferStatus === 'pending') {
                    typeName = 'إذن تحويل مخزني (⏳ معلق بانتظار الاستلام)';
                    typeColor = '#d97706';
                } else {
                    typeName = 'إذن تحويل مخزني';
                    typeColor = '#16a085';
                }
                isTransfer = true;
            } else if (tType.includes('adjustment') || tType.includes('تسوية') || tType.includes('جرد')) {
                typeName = 'محضر تسوية مخزنية'; typeColor = '#d97706'; isAdjustment = true;
            } else if (tType === 'receipt' || tType.includes('قبض')) {
                typeName = 'سند استلام نقدية (قبض)'; typeColor = '#8e44ad'; isReceipt = true;
            } else if (tType === 'payment' || tType === 'disburse' || tType.includes('صرف') || tType.includes('دفع')) {
                typeName = 'سند صرف نقدية'; typeColor = '#c0392b'; isDisburse = true;
            }
            
            let isFinancial = isReceipt || isDisburse;
            let items = tx.items || tx.products || tx.cart || tx.details || [];

            // تصفية أسطر الهيدر المالي الوهمية الخالية من أسماء الأصناف
            if (Array.isArray(items) && items.length > 1) {
                items = items.filter(i => {
                    const n = (i.name || i.product || i.productName || '').trim();
                    const q = parseFloat(i.qty || i.quantity || 0);
                    if ((!n || n === 'صنف غير محدد') && q === 0) return false;
                    return true;
                });
            }

            const hasVariants = !isFinancial && (
                items.some(i => (i.size || i.selectedSize || i.color || i.selectedColor)) ||
                (typeof document !== 'undefined' && document.body.classList.contains('bayan-variants-enabled'))
            );

            let itemsHtml = '';
            let rawSubTotal = 0;
            let grandTotal = 0;
            let totalItemsDiscount = 0;
            let totalItemsAddition = 0;
            
            items.forEach(item => {
                let name = item.name || item.product || item.productName || 'صنف غير محدد';
                let qty = parseFloat(item.qty != null ? item.qty : (item.quantity || 0));
                let unit = item.selectedUnit ? (typeof item.selectedUnit === 'object' ? item.selectedUnit.unitName : item.selectedUnit) : (item.unit || '');
                let price = parseFloat(item.price != null ? item.price : (item.costPrice || item.purchasePrice || 0));
                let lineGross = qty * price;
                rawSubTotal += lineGross;

                let itemDisc = parseFloat(item.discount != null ? item.discount : (item.itemDiscount != null ? item.itemDiscount : 0)) || 0;
                let itemDiscType = item.discountType || item.itemDiscountType || 'val';
                let discAmount = (itemDiscType === 'perc' && itemDisc > 0) ? (lineGross * itemDisc / 100) : itemDisc;
                
                let itemAdd = parseFloat(item.addition != null ? item.addition : (item.extra != null ? item.extra : 0)) || 0;
                
                let total = parseFloat(item.total != null ? item.total : (lineGross - discAmount + itemAdd));
                grandTotal += total;
                totalItemsDiscount += discAmount;
                totalItemsAddition += itemAdd;
                
                let itemSize = item.size || item.selectedSize || '';
                let itemColor = item.color || item.selectedColor || '';
                let sizeBadge = itemSize ? `<span style="background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; padding:2px 8px; border-radius:6px; font-weight:900; font-size:0.82rem;">${itemSize}</span>` : `<span style="color:#cbd5e1;">-</span>`;
                let colorBadge = itemColor ? `<span style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; padding:2px 8px; border-radius:6px; font-weight:900; font-size:0.82rem;">${itemColor}</span>` : `<span style="color:#cbd5e1;">-</span>`;

                let discAddBadge = '';
                if (discAmount > 0.001 && itemAdd > 0.001) {
                    discAddBadge = `
                        <div style="display:flex; flex-direction:column; gap:2px; align-items:center;">
                            <span style="background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5; padding:1px 6px; border-radius:5px; font-weight:900; font-size:0.75rem;">خصم -${discAmount.toFixed(2)}</span>
                            <span style="background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; padding:1px 6px; border-radius:5px; font-weight:900; font-size:0.75rem;">إضافة +${itemAdd.toFixed(2)}</span>
                        </div>
                    `;
                } else if (discAmount > 0.001) {
                    const percLabel = (itemDiscType === 'perc' && itemDisc > 0) ? ` (${itemDisc}%)` : '';
                    discAddBadge = `<span style="background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5; padding:2px 8px; border-radius:6px; font-weight:900; font-size:0.8rem; display:inline-block;" title="خصم على الصنف">-${discAmount.toFixed(2)}${percLabel}</span>`;
                } else if (itemAdd > 0.001) {
                    discAddBadge = `<span style="background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; padding:2px 8px; border-radius:6px; font-weight:900; font-size:0.8rem; display:inline-block;" title="إضافة على الصنف">+${itemAdd.toFixed(2)} ج.م</span>`;
                } else {
                    discAddBadge = `<span style="color:#cbd5e1; font-weight:700;">-</span>`;
                }

                let method = tx.method || tx.paymentMethod || 'نقدي';
                let cashier = tx.user || tx.cashier || '-';
                
                itemsHtml += `
                    <tr style="border-bottom:1px solid #f1f5f9; transition: 0.15s;" onmouseover="this.style.background='#f8fafc';" onmouseout="this.style.background='#ffffff';">
                        <td style="padding:10px 12px; text-align:right; font-weight:bold; color:#334155;">${name}</td>
                        ${!isFinancial ? `
                            ${hasVariants ? `
                                <td style="padding:10px; text-align:center;">${sizeBadge}</td>
                                <td style="padding:10px; text-align:center;">${colorBadge}</td>
                            ` : ''}
                            <td style="padding:10px; text-align:center; color:#475569; font-weight:bold;">${qty} ${unit}</td>
                            <td style="padding:10px; text-align:center; color:#475569; font-weight:700;">${price.toFixed(2)} ج.م</td>
                            <td style="padding:10px; text-align:center;">${discAddBadge}</td>
                        ` : `
                            <td style="padding:10px; text-align:center; color:#475569;">${method}</td>
                            <td style="padding:10px; text-align:center; color:#475569;">${cashier}</td>
                        `}
                        <td style="padding:10px; text-align:center; font-weight:900; color:#1e293b;">${total.toFixed(2)} ج.م</td>
                    </tr>
                `;
            });
            
            let existing = document.getElementById('customViewModalOverlay');
            if (existing) existing.remove();
            
            let modal = document.createElement('div');
            modal.id = 'customViewModalOverlay';
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(15, 23, 42, 0.6); 
                z-index: 11000; display: flex; align-items: center; justify-content: center;
                direction: rtl; font-family: 'Cairo', sans-serif;
            `;

            // خصم وإضافة الفاتورة العامة
            let invDiscountVal = parseFloat(tx.invoiceDiscount != null ? tx.invoiceDiscount : (tx.discount != null ? tx.discount : (tx.discountAmount || 0))) || 0;
            let invDiscountType = tx.invoiceDiscountType || tx.discountType || 'val';
            let invDiscountAmount = (invDiscountType === 'perc' && invDiscountVal > 0) ? (rawSubTotal * invDiscountVal / 100) : invDiscountVal;

            let invTaxVal = parseFloat(tx.invoiceTax != null ? tx.invoiceTax : (tx.tax != null ? tx.tax : (tx.extra || tx.addition || 0))) || 0;
            let invTaxType = tx.invoiceTaxType || tx.taxType || 'val';
            let invTaxAmount = (invTaxType === 'perc' && invTaxVal > 0) ? (rawSubTotal * invTaxVal / 100) : invTaxVal;

            // حساب الخصم والإضافة الإجمالية بدقة لمنع التكرار (Double Counting) في حال كان الخصم موزعاً سلفاً على أسطر الأصناف
            let totalDiscountDisplay = 0;
            if (invDiscountAmount > 0.001 && Math.abs(totalItemsDiscount - invDiscountAmount) < 0.15) {
                totalDiscountDisplay = invDiscountAmount;
            } else if (invDiscountAmount > 0.001 && totalItemsDiscount > 0.001) {
                if (Math.abs(grandTotal - (rawSubTotal - totalItemsDiscount)) < 0.15) {
                    totalDiscountDisplay = totalItemsDiscount + invDiscountAmount;
                } else {
                    totalDiscountDisplay = Math.max(totalItemsDiscount, invDiscountAmount);
                }
            } else {
                totalDiscountDisplay = totalItemsDiscount > 0 ? totalItemsDiscount : invDiscountAmount;
            }

            let totalAdditionDisplay = 0;
            if (invTaxAmount > 0.001 && Math.abs(totalItemsAddition - invTaxAmount) < 0.15) {
                totalAdditionDisplay = invTaxAmount;
            } else if (invTaxAmount > 0.001 && totalItemsAddition > 0.001) {
                if (Math.abs(grandTotal - (rawSubTotal + totalItemsAddition)) < 0.15) {
                    totalAdditionDisplay = totalItemsAddition + invTaxAmount;
                } else {
                    totalAdditionDisplay = Math.max(totalItemsAddition, invTaxAmount);
                }
            } else {
                totalAdditionDisplay = totalItemsAddition > 0 ? totalItemsAddition : invTaxAmount;
            }

            let invoiceFinalTotal = 0;
            if (tx.invoiceGrandTotal && parseFloat(tx.invoiceGrandTotal) > 0) {
                invoiceFinalTotal = parseFloat(tx.invoiceGrandTotal);
            } else if (tx.finalTotal && parseFloat(tx.finalTotal) > 0) {
                invoiceFinalTotal = parseFloat(tx.finalTotal);
            } else if (tx.grandTotal && parseFloat(tx.grandTotal) > 0) {
                invoiceFinalTotal = parseFloat(tx.grandTotal);
            } else {
                invoiceFinalTotal = Math.max(0, rawSubTotal - totalDiscountDisplay + totalAdditionDisplay);
            }
            if (invoiceFinalTotal <= 0 && grandTotal > 0) {
                invoiceFinalTotal = grandTotal;
            }
            
            let methodVal = String(tx.method || tx.paymentMethod || '').trim();
            let paidVal = parseFloat(tx.paidAmount != null ? tx.paidAmount : (tx.paid != null ? tx.paid : 0));
            if (isNaN(paidVal)) paidVal = 0;
            
            // التحقق من الآجل سواء من اسم طريقة الدفع أو من وجود دين ومتبقي حقيقي
            let isDeferred = methodVal.includes('آجل') || methodVal.includes('أجل') || methodVal.includes('ذمم') || methodVal.includes('deferred') || methodVal.includes('credit');
            let remainingVal = 0;

            if (isDeferred) {
                remainingVal = parseFloat(tx.deferred != null ? tx.deferred : (tx.remaining != null ? tx.remaining : (invoiceFinalTotal - paidVal)));
                if (isNaN(remainingVal) || remainingVal < 0) remainingVal = Math.max(0, invoiceFinalTotal - paidVal);
            } else {
                let recordedRemaining = parseFloat(tx.deferred != null ? tx.deferred : (tx.remaining != null ? tx.remaining : 0));
                if (recordedRemaining > 0.001) {
                    isDeferred = true;
                    remainingVal = recordedRemaining;
                } else if (paidVal > 0 && invoiceFinalTotal > paidVal && (invoiceFinalTotal - paidVal) > 0.001) {
                    isDeferred = true;
                    remainingVal = invoiceFinalTotal - paidVal;
                } else {
                    remainingVal = 0;
                    paidVal = invoiceFinalTotal; // نقدي خالص
                }
            }

            let displayMethod = '';
            if (isDeferred) {
                if (paidVal > 0.001 && remainingVal > 0.001) {
                    displayMethod = '⏳ آجل (سداد جزئي)';
                } else {
                    displayMethod = '⏳ آجل (ذمم)';
                }
            } else if (methodVal.includes('حساب') || methodVal.includes('خصم من حساب') || methodVal.includes('رصيد')) {
                displayMethod = '👤 خصم من الحساب';
            } else if (methodVal.includes('تحويل') || methodVal.includes('بنك') || methodVal.includes('شبكة') || methodVal.includes('فيزا') || methodVal.includes('شيك')) {
                displayMethod = methodVal.includes('شيك') ? '🏦 شيك بنكي' : '🏦 بنك / تحويل';
            } else {
                displayMethod = '💵 نقدي (كاش)';
            }
            
            let modalWidth = hasVariants ? '880px' : '780px';
            let modalContent = `
                <div style="background: white; width: ${modalWidth}; max-width: 96vw; max-height: 90vh; border-radius: 24px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); display: flex; flex-direction: column; overflow: hidden; border: 1px solid rgba(255,255,255,0.4);">
                    <div style="background: linear-gradient(135deg, ${typeColor}, #2c3e50); padding: 20px 25px; color: white; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h3 style="margin: 0; font-size: 1.3rem; font-weight: 900;">${typeName} #${tx.invoiceId || tx.invoiceNumber || tx.id}</h3>
                            <p style="margin: 5px 0 0; font-size: 0.85rem; opacity: 0.85;">📅 التاريخ والوقت: ${tx.date || tx.timestamp || '-'}</p>
                        </div>
                        <button onclick="document.getElementById('customViewModalOverlay').remove()" style="background: rgba(0,0,0,0.2); border: none; color: white; font-size: 1.5rem; cursor: pointer; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight:bold;">&times;</button>
                    </div>
                    
                    <div style="padding: 22px 25px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 18px;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #f8fafc; padding: 14px 18px; border-radius: 16px; border: 1px solid #e2e8f0; font-size:0.88rem;">
                            ${isTransfer ? `
                                <div><b style="color: #64748b; font-size: 0.82rem;">📦 مخزن المصدر:</b> <span style="font-weight: 800; color: #1e293b;">${tx.sourceWarehouse || tx.fromWarehouse || tx.from || '-'}</span></div>
                                <div><b style="color: #64748b; font-size: 0.82rem;">🏁 مخزن الوجهة:</b> <span style="font-weight: 800; color: #1e293b;">${tx.warehouse || tx.toWarehouse || tx.to || '-'}</span></div>
                            ` : isAdjustment ? `
                                <div><b style="color: #64748b; font-size: 0.82rem;">⚖️ نوع العملية:</b> <span style="font-weight: 800; color: #1e293b;">تسوية مخزن</span></div>
                                <div><b style="color: #64748b; font-size: 0.82rem;">👤 الطرف/الجهة:</b> <span style="font-weight: 800; color: #1e293b;">${tx.customer || tx.partner || tx.account || 'جرد مخزني'}</span></div>
                            ` : `
                                <div><b style="color: #64748b; font-size: 0.82rem;">👤 ${isPurchase ? 'المورد/الحساب' : 'العميل/الحساب'}:</b> <span style="font-weight: 800; color: #1e293b;">${tx.customer || tx.partner || tx.account || tx.supplier || (isPurchase ? 'مورد نقدي' : 'عميل نقدي')}</span></div>
                                <div><b style="color: #64748b; font-size: 0.82rem;">💳 طريقة الدفع:</b> <span style="font-weight: 800; color: #1e293b;">${displayMethod}</span></div>
                            `}
                            <div><b style="color: #64748b; font-size: 0.82rem;">👤 المستخدم المسؤول:</b> <span style="font-weight: 800; color: #1e293b;">${tx.cashier || tx.user || '-'}</span></div>
                            <div><b style="color: #64748b; font-size: 0.82rem;">🏢 المخزن / الفرع:</b> <span style="font-weight: 800; color: #1e293b;">${tx.warehouse || 'المخزن الرئيسي'}</span></div>
                            <div>
                                <b style="color: #64748b; font-size: 0.82rem;">💻 جهاز الإصدار:</b> 
                                <span style="font-weight: 800; color: #1e293b; display: inline-flex; align-items: center; gap: 5px;">
                                    <span>${tx.terminal || 'الجهاز الرئيسي 💻'}</span>
                                    <button type="button" onclick="if(window.showTerminalInfoModal) window.showTerminalInfoModal('${tx.invoiceId || tx.id}')" 
                                        style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; border-radius:50%; width:18px; height:18px; font-size:0.68rem; font-weight:900; display:inline-flex; align-items:center; justify-content:center; cursor:pointer; padding:0; line-height:1;" 
                                        title="تفاصيل جهاز البيع والمزامنة">❓</button>
                                </span>
                            </div>
                            ${tx.notes ? `<div style="grid-column: span 2;"><b style="color: #64748b; font-size: 0.82rem;">📝 ملاحظات:</b> <span style="font-weight: 800; color: #1e293b;">${tx.notes}</span></div>` : ''}
                        </div>
                        
                        <div style="border: 1px solid #e2e8f0; border-radius: 16px; overflow-y: auto; max-height: 270px; background: white;">
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.88rem;">
                                <thead style="background: #f1f5f9; position: sticky; top: 0; z-index: 5;">
                                    <tr>
                                        <th style="padding:12px; text-align:right; font-size:0.82rem; color:#475569; font-weight:900;">${isFinancial ? 'البيان' : 'الصنف'}</th>
                                        ${!isFinancial ? `
                                            ${hasVariants ? `
                                                <th style="padding:12px; text-align:center; font-size:0.82rem; color:#475569; width:80px; font-weight:900;">المقاس</th>
                                                <th style="padding:12px; text-align:center; font-size:0.82rem; color:#475569; width:80px; font-weight:900;">اللون</th>
                                            ` : ''}
                                            <th style="padding:12px; text-align:center; font-size:0.82rem; color:#475569; width:95px; font-weight:900;">الكمية</th>
                                            <th style="padding:12px; text-align:center; font-size:0.82rem; color:#475569; width:110px; font-weight:900;">السعر</th>
                                            <th style="padding:12px; text-align:center; font-size:0.82rem; color:#b91c1c; width:120px; font-weight:900; background:#fef2f2;">الخصم / الإضافة</th>
                                        ` : `
                                            <th style="padding:12px; text-align:center; font-size:0.82rem; color:#475569; width:150px; font-weight:900;">طريقة الدفع</th>
                                            <th style="padding:12px; text-align:center; font-size:0.82rem; color:#475569; width:150px; font-weight:900;">بواسطة</th>
                                        `}
                                        <th style="padding:12px; text-align:center; font-size:0.82rem; color:#475569; width:130px; font-weight:900;">${isFinancial ? 'المبلغ' : 'الإجمالي'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${itemsHtml || '<tr><td colspan="' + (!isFinancial ? (hasVariants ? '7' : '5') : '4') + '" style="text-align:center; padding:20px; color:#94a3b8;">لا توجد أصناف</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                        
                        <!-- شريط الملخص المالي المحاسبي الشامل للخصومات والإجماليات -->
                        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; padding: 14px 18px; border-top: 1.5px solid #e2e8f0; background: #f8fafc; border-radius: 14px;">
                            ${(() => {
                                let pName = tx.customer || tx.partner || tx.account || tx.supplier || '';
                                if (pName && !window.isGenericCashPartner(pName) && typeof getAccountBalance === 'function') {
                                    const curBal = getAccountBalance(pName);
                                    const balColor = curBal > 0.01 ? '#e74c3c' : (curBal < -0.01 ? '#27ae60' : '#475569');
                                    const balLabel = curBal > 0.01 ? `مديونية عليه (${curBal.toFixed(2)} ج.م)` : (curBal < -0.01 ? `رصيد له (${Math.abs(curBal).toFixed(2)} ج.م)` : 'خالص (0.00 ج.م)');
                                    return `
                                        <div style="background: #ffffff; border: 1.5px dashed ${balColor}; padding: 8px 16px; border-radius: 12px; display: flex; flex-direction: column; justify-content: center;">
                                            <span style="font-size:0.76rem; color:#64748b; font-weight:bold;">👤 رصيد الحساب الإجمالي المتبقي:</span>
                                            <div style="font-size:1.05rem; font-weight:900; color:${balColor};">${balLabel}</div>
                                        </div>
                                    `;
                                }
                                return '<div></div>';
                            })()}
                            <div style="display: flex; justify-content: flex-end; gap: 16px; align-items: center; flex-wrap: wrap;">
                                ${(totalDiscountDisplay > 0.001 || totalAdditionDisplay > 0.001) ? `
                                    <div style="text-align:center;">
                                        <span style="font-size:0.75rem; color:#64748b; font-weight:bold;">المجموع قبل الخصم:</span>
                                        <div style="font-size:1.05rem; font-weight:800; color:#475569;">${rawSubTotal.toFixed(2)} ج.م</div>
                                    </div>
                                ` : ''}
                                ${totalDiscountDisplay > 0.001 ? `
                                    <div style="text-align:center;">
                                        <span style="font-size:0.75rem; color:#dc2626; font-weight:bold;">إجمالي الخصم:</span>
                                        <div style="font-size:1.15rem; font-weight:900; color:#dc2626;">-${totalDiscountDisplay.toFixed(2)} ج.م</div>
                                    </div>
                                ` : ''}
                                ${totalAdditionDisplay > 0.001 ? `
                                    <div style="text-align:center;">
                                        <span style="font-size:0.75rem; color:#0284c7; font-weight:bold;">إضافات / ضريبة:</span>
                                        <div style="font-size:1.15rem; font-weight:900; color:#0284c7;">+${totalAdditionDisplay.toFixed(2)} ج.م</div>
                                    </div>
                                ` : ''}
                                <div style="text-align:center; background: #ffffff; padding: 6px 14px; border-radius: 10px; border: 1.5px solid #cbd5e1; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                                    <span style="font-size:0.75rem; color:#475569; font-weight:900;">${isFinancial ? 'إجمالي المبلغ:' : 'صافي الفاتورة:'}</span>
                                    <div style="font-size:1.28rem; font-weight:900; color:#0f172a;">${invoiceFinalTotal.toFixed(2)} ج.م</div>
                                </div>
                                ${!isTransfer && !isAdjustment && !isFinancial ? `
                                    <div style="text-align:center;">
                                        <span style="font-size:0.75rem; color:#059669; font-weight:bold;">${isReturn ? 'المبلغ المرتجع:' : 'المدفوع:'}</span>
                                        <div style="font-size:1.25rem; font-weight:900; color:#059669;">${paidVal.toFixed(2)} ج.م</div>
                                    </div>
                                    ${!isReturn && isDeferred ? `
                                        <div style="text-align:center;">
                                            <span style="font-size:0.75rem; color:#dc2626; font-weight:bold;">المتبقي:</span>
                                            <div style="font-size:1.25rem; font-weight:900; color:#dc2626;">${remainingVal.toFixed(2)} ج.م</div>
                                        </div>
                                    ` : ''}
                                ` : ''}
                            </div>
                        </div>
                    </div>
                    
                    <!-- Footer Actions -->
                    <div style="padding: 20px 25px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                        <button onclick="document.getElementById('customViewModalOverlay').remove()" style="padding: 10px 25px; background: white; border: 2px solid #cbd5e1; border-radius: 12px; font-weight: bold; color: #64748b; cursor: pointer; transition: 0.2s;">إغلاق ❌</button>
                        <div style="display: flex; gap: 10px;">
                            <button id="customPrintBtn" style="padding: 10px 25px; background: #3b82f6; border: none; border-radius: 12px; font-weight: 900; color: white; cursor: pointer; transition: 0.2s; display: flex; align-items: center; gap: 8px;">🖨️ طباعة المستند</button>
                        </div>
                    </div>
                </div>
            `;
            
            modal.innerHTML = modalContent;
            document.body.appendChild(modal);
            
            const executePrint = function() {
                if (isTransfer) {
                    const shopName    = document.getElementById('shopName')?.value || 'بـيـان POS';
                    const shopAddress = document.getElementById('shopAddress')?.value || '';
                    const shopPhone   = document.getElementById('shopPhone1')?.value || '';
                    const footerMsg   = document.getElementById('printFooterMsg')?.value || 'شكراً لزيارتكم!';
                    
                    let wFrom = 'المخزن الرئيسي';
                    let wTo = 'مخزن فرعي';
                    if (tx.partner && tx.partner.includes('->')) {
                        const parts = tx.partner.split('->');
                        wFrom = parts[0].trim();
                        wTo = parts[1].trim();
                    }
                    
                    let date = tx.dateISO ? (tx.dateISO + ' ' + (tx.timeISO || '')) : (tx.date || '-');
                    
                    let rowsHtml = '';
                    let totalValue = 0;
                    items.forEach((item, idx) => {
                        const qty = parseFloat(item.qty || item.quantity || 0);
                        const price = parseFloat(item.price || item.costPrice || item.purchasePrice || 0);
                        const total = qty * price;
                        totalValue += total;
                        let sSize = item.size || item.selectedSize || '';
                        let sColor = item.color || item.selectedColor || '';

                        if (!sSize && item.name) {
                            const pInfo = (typeof productsDB !== 'undefined' && Array.isArray(productsDB)) ? productsDB.find(p => p.id === item.id || p.name === item.name) : null;
                            if (pInfo && pInfo.variants && pInfo.variants.length > 0) {
                                sSize = pInfo.variants[0].size || '';
                                sColor = pInfo.variants[0].color || '';
                            }
                        }

                        const displaySize = (sSize && sSize !== '-') ? sSize : 'عام';
                        const displayColor = (sColor && sColor !== '-') ? sColor : 'عام';

                        rowsHtml += `
                            <tr>
                                <td style="padding: 6px 8px; border: 1px solid #000;">${idx + 1}</td>
                                <td style="text-align:right; padding: 6px 10px; border: 1px solid #000; font-weight:bold;">${item.name}</td>
                                <td style="padding: 6px 8px; border: 1px solid #000; font-weight:bold; color:#047857;">${displaySize}</td>
                                <td style="padding: 6px 8px; border: 1px solid #000; font-weight:bold; color:#1d4ed8;">${displayColor}</td>
                                <td style="padding: 6px 8px; border: 1px solid #000; font-weight:bold;">${qty} ${item.unit || ''}</td>
                                <td style="padding: 6px 8px; border: 1px solid #000;">${price.toFixed(2)}</td>
                                <td style="padding: 6px 8px; border: 1px solid #000; font-weight:bold;">${total.toFixed(2)}</td>
                            </tr>
                        `;
                    });

                    const content = `
                        <div class="print-container" style="direction:rtl; font-family:Cairo, sans-serif; padding: 20px;">
                            <div style="text-align:center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px;">
                                <h1 style="margin:0;">${shopName}</h1>
                                ${shopAddress ? `<div style="font-size:12px; color:#555; margin-top:2px;">${shopAddress}</div>` : ''}
                                ${shopPhone ? `<div style="font-size:12px; color:#555; margin-top:2px;">هاتف: ${shopPhone}</div>` : ''}
                                <h2 style="margin:5px 0; background:#000; color:#fff; display:inline-block; padding:5px 20px; border-radius:5px;">إذن تحويل مخزني</h2>
                            </div>
                            <div style="display:flex; justify-content:space-between; margin-bottom: 20px; font-weight:bold;">
                                <div>من مخزن: <span style="text-decoration:underline;">${wFrom}</span></div>
                                <div>إلى مخزن: <span style="text-decoration:underline;">${wTo}</span></div>
                                <div>التاريخ: ${date}</div>
                            </div>
                            <table style="width:100%; border-collapse:collapse; text-align:center;" border="1">
                                <thead>
                                    <tr style="background:#f0f0f0;">
                                        <th style="padding: 8px; border: 1px solid #000;">م</th>
                                        <th style="padding: 8px; border: 1px solid #000; text-align:right;">الصنف</th>
                                        <th style="padding: 8px; border: 1px solid #000;">المقاس</th>
                                        <th style="padding: 8px; border: 1px solid #000;">اللون</th>
                                        <th style="padding: 8px; border: 1px solid #000;">الكمية</th>
                                        <th style="padding: 8px; border: 1px solid #000;">سعر التحويل</th>
                                        <th style="padding: 8px; border: 1px solid #000;">الإجمالي</th>
                                    </tr>
                                </thead>
                                <tbody>${rowsHtml}</tbody>
                                <tfoot>
                                    <tr style="font-weight:bold; background:#f0f0f0;">
                                        <td colspan="6" style="padding: 8px; border: 1px solid #000;">إجمالي قيمة التحويل</td>
                                        <td style="padding: 8px; border: 1px solid #000;">${totalValue.toFixed(2)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                            <div style="margin-top:50px; display:flex; justify-content:space-between;">
                                <div style="text-align:center;">توقيع أمين المخزن (المصدر)<br><br>...........................</div>
                                <div style="text-align:center;">توقيع المستلم (الوجهة)<br><br>...........................</div>
                            </div>
                            <div style="text-align:center; margin-top:30px; border-top:1px dashed #000; padding-top:10px; font-size:12px;">
                                <div style="font-weight:bold;">${footerMsg}</div>
                                <div>نظام بيان POS - مبيعات متكامل</div>
                            </div>
                        </div>
                    `;
                    
                    let receiptArea = document.getElementById('receipt-area');
                    if (!receiptArea) {
                        receiptArea = document.createElement('div');
                        receiptArea.id = 'receipt-area';
                        document.body.appendChild(receiptArea);
                    }
                    receiptArea.innerHTML = content;
                    window.print();
                } else if (isAdjustment) {
                    const shopName    = document.getElementById('shopName')?.value || 'بـيـان POS';
                    const shopAddress = document.getElementById('shopAddress')?.value || '';
                    const shopPhone   = document.getElementById('shopPhone1')?.value || '';
                    const footerMsg   = document.getElementById('printFooterMsg')?.value || 'شكراً لزيارتكم!';
                    
                    let date = tx.dateISO ? (tx.dateISO + ' ' + (tx.timeISO || '')) : (tx.date || '-');
                    
                    let rowsHtml = '';
                    let totalQty = 0;
                    let totalValue = 0;
                    items.forEach((item, idx) => {
                        const qty = parseFloat(item.qty || item.quantity || 0);
                        const price = parseFloat(item.price || item.costPrice || item.purchasePrice || 0);
                        const total = qty * price;
                        totalQty += qty;
                        totalValue += total;
                        const sSize = item.size || item.selectedSize || '-';
                        const sColor = item.color || item.selectedColor || '-';
                        rowsHtml += `
                            <tr>
                                <td style="padding: 6px 8px; border: 1px solid #000;">${idx + 1}</td>
                                <td style="text-align:right; padding: 6px 10px; border: 1px solid #000; font-weight:bold;">${item.name}</td>
                                <td style="padding: 6px 8px; border: 1px solid #000; font-weight:bold; color:#047857;">${sSize}</td>
                                <td style="padding: 6px 8px; border: 1px solid #000; font-weight:bold; color:#1d4ed8;">${sColor}</td>
                                <td style="padding: 6px 8px; border: 1px solid #000; font-weight:bold;">${qty} ${item.unit || ''}</td>
                                <td style="padding: 6px 8px; border: 1px solid #000;">${price.toFixed(2)}</td>
                                <td style="padding: 6px 8px; border: 1px solid #000; font-weight:bold;">${total.toFixed(2)}</td>
                            </tr>
                        `;
                    });

                    const content = `
                        <div class="print-container" style="direction:rtl; font-family:Cairo, sans-serif; padding: 20px;">
                            <div style="text-align:center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px;">
                                <h1 style="margin:0;">${shopName}</h1>
                                ${shopAddress ? `<div style="font-size:12px; color:#555; margin-top:2px;">${shopAddress}</div>` : ''}
                                ${shopPhone ? `<div style="font-size:12px; color:#555; margin-top:2px;">هاتف: ${shopPhone}</div>` : ''}
                                <h2 style="margin:5px 0; background:#000; color:#fff; display:inline-block; padding:5px 20px; border-radius:5px;">إذن تسوية مخزنية</h2>
                            </div>
                            <div style="display:flex; justify-content:space-between; margin-bottom: 20px; font-weight:bold;">
                                <div>المخزن: <span style="text-decoration:underline;">${tx.warehouse || 'المخزن الرئيسي'}</span></div>
                                <div>التاريخ: ${date}</div>
                            </div>
                            <table style="width:100%; border-collapse:collapse; text-align:center; margin-bottom:20px;" border="1">
                                <thead>
                                    <tr style="background:#f0f0f0;">
                                        <th style="padding: 8px; border: 1px solid #000;">م</th>
                                        <th style="padding: 8px; border: 1px solid #000; text-align:right;">الصنف</th>
                                        <th style="padding: 8px; border: 1px solid #000;">المقاس</th>
                                        <th style="padding: 8px; border: 1px solid #000;">اللون</th>
                                        <th style="padding: 8px; border: 1px solid #000;">الكمية الفعلية</th>
                                        <th style="padding: 8px; border: 1px solid #000;">السعر</th>
                                        <th style="padding: 8px; border: 1px solid #000;">الإجمالي</th>
                                    </tr>
                                </thead>
                                <tbody>${rowsHtml}</tbody>
                                <tfoot>
                                    <tr style="font-weight:bold; background:#f0f0f0;">
                                        <td colspan="4" style="padding: 8px; border: 1px solid #000;">الإجمالي الكلي</td>
                                        <td style="padding: 8px; border: 1px solid #000;">${totalQty}</td>
                                        <td style="padding: 8px; border: 1px solid #000;">-</td>
                                        <td style="padding: 8px; border: 1px solid #000;">${totalValue.toFixed(2)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                            <div style="margin-top:50px; display:flex; justify-content:space-between;">
                                <div style="text-align:center;">توقيع المسؤول:<br><br>...........................</div>
                                <div style="text-align:center;">توقيع أمين المخزن:<br><br>...........................</div>
                            </div>
                            <div style="text-align:center; margin-top:30px; border-top:1px dashed #000; padding-top:10px; font-size:12px;">
                                <div style="font-weight:bold;">${footerMsg}</div>
                                <div>نظام بيان POS - مبيعات متكامل</div>
                            </div>
                        </div>
                    `;
                    
                    let receiptArea = document.getElementById('receipt-area');
                    if (!receiptArea) {
                        receiptArea = document.createElement('div');
                        receiptArea.id = 'receipt-area';
                        document.body.appendChild(receiptArea);
                    }
                    receiptArea.innerHTML = content;
                    window.print();
                } else if (tx.type.includes('قبض') || tx.type.includes('صرف')) {
                    const isReceipt = tx.type.includes('قبض');
                    let savedPosSettings = {};
                    try { savedPosSettings = JSON.parse(getStore('pos_settings') || '{}'); } catch(e) {}
                    const shopName = savedPosSettings.name || (document.getElementById('shopName') ? document.getElementById('shopName').value : 'مؤسستي');
                    const footerMsg = savedPosSettings.printFooterMsg || (document.getElementById('printFooterMsg') ? document.getElementById('printFooterMsg').value : 'شكراً لتعاملكم معنا!');
                    const id = tx.invoiceId || tx.id || '-';
                    const date = tx.dateISO || (tx.date ? tx.date.split(' ')[0] : new Date().toLocaleDateString('en-CA'));
                    const partnerName = tx.partner || 'غير محدد';
                    const amount = parseFloat(tx.total || tx.paidAmount || tx.price) || 0;

                    let balBefore = 0, balAfter = 0;
                    if (typeof window.getAccountBalance === 'function') {
                        const currentBalance = window.getAccountBalance(partnerName);
                        // الحركة محفوظة مسبقاً فالرصيد الحالي هو الرصيد بعد الحركة
                        balAfter = currentBalance;
                        if (isReceipt) {
                            balBefore = currentBalance + amount;
                        } else {
                            balBefore = currentBalance - amount;
                        }
                    }

                    const formatMoney = (num) => {
                        const isNeg = num < 0;
                        const formatted = Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        return isNeg ? `-${formatted}` : formatted;
                    };

                    const title = isReceipt ? 'سند قبض نقدية' : 'سند صرف نقدية';
                    const actionLabel = isReceipt ? 'وصلنا من السيد:' : 'صرف للسيد:';
                    const amountLabel = isReceipt ? 'المبلغ المقبوض:' : 'المبلغ المنصرف:';
                    const col1Label = isReceipt ? 'الرصيد السابق' : 'كان له';
                    const col2Label = isReceipt ? 'المبلغ المقبوض' : 'المنصرف';
                    const col3Label = isReceipt ? 'المتبقي عليه' : 'المتبقي له';
                    const sign2Label = isReceipt ? 'الختم والاعتماد' : 'المدير المالي';
                    
                    const htmlContent = `
                        <html dir="rtl" lang="ar">
                        <head>
                            <meta charset="utf-8">
                            <title>${title} #${id} - ${shopName}</title>
                            <style>
                                @page { margin: 0; size: 80mm auto; }
                                *, *::before, *::after { box-sizing: border-box !important; }
                                html, body {
                                    margin: 0 !important;
                                    padding: 0 !important;
                                    width: 100% !important;
                                    max-width: 80mm !important;
                                    background: #fff !important;
                                    color: #000 !important;
                                    font-family: 'Cairo', 'Segoe UI', Arial, sans-serif !important;
                                    -webkit-print-color-adjust: exact !important;
                                    print-color-adjust: exact !important;
                                }
                                .receipt-card {
                                    width: 72mm;
                                    margin: 0 auto;
                                    padding: 3mm 2mm;
                                    text-align: center;
                                }
                                .shop-header {
                                    font-size: 19px;
                                    font-weight: 900;
                                    margin-bottom: 5px;
                                    color: #000;
                                }
                                .doc-badge {
                                    font-size: 14px;
                                    font-weight: 900;
                                    border: 2px solid #000;
                                    display: inline-block;
                                    padding: 2px 14px;
                                    border-radius: 4px;
                                    margin-bottom: 8px;
                                }
                                .meta-row {
                                    display: flex;
                                    justify-content: space-between;
                                    font-size: 12px;
                                    font-weight: 800;
                                    border-bottom: 1.5px solid #000;
                                    padding-bottom: 5px;
                                    margin-bottom: 8px;
                                }
                                .box-info {
                                    border: 1.5px solid #000;
                                    border-radius: 6px;
                                    padding: 8px;
                                    margin-bottom: 10px;
                                    text-align: right;
                                    font-size: 13px;
                                    font-weight: 700;
                                }
                                .amount-container {
                                    margin-top: 6px;
                                    text-align: center;
                                    font-size: 13px;
                                    font-weight: 900;
                                }
                                .amount-val {
                                    font-size: 22px;
                                    font-weight: 900;
                                    border: 2px solid #000;
                                    display: inline-block;
                                    padding: 2px 12px;
                                    border-radius: 6px;
                                    margin-top: 3px;
                                    font-family: 'Segoe UI', Arial, sans-serif;
                                    direction: ltr !important;
                                }
                                .summary-table {
                                    width: 100%;
                                    border-collapse: collapse;
                                    margin-bottom: 12px;
                                    border: 1.5px solid #000;
                                }
                                .summary-table th {
                                    border: 1px solid #000;
                                    padding: 4px 2px;
                                    font-size: 10px;
                                    font-weight: 900;
                                    background: #f1f5f9;
                                }
                                .summary-table td {
                                    border: 1px solid #000;
                                    padding: 6px 2px;
                                    font-size: 12px;
                                    font-weight: 900;
                                    text-align: center;
                                    font-family: 'Segoe UI', Arial, sans-serif;
                                    direction: ltr !important;
                                    white-space: nowrap;
                                }
                                .sign-grid {
                                    display: grid;
                                    grid-template-columns: 1fr 1fr;
                                    gap: 15px;
                                    margin-top: 20px;
                                    font-size: 12px;
                                    font-weight: 800;
                                }
                                .sign-line {
                                    border-top: 1.5px solid #000;
                                    padding-top: 4px;
                                    text-align: center;
                                }
                                .footer-text {
                                    margin-top: 15px;
                                    border-top: 1px dashed #000;
                                    padding-top: 8px;
                                    font-size: 11px;
                                    font-weight: 700;
                                    color: #333;
                                }
                            </style>
                        </head>
                        <body>
                            <div class="receipt-card">
                                <div class="shop-header">${shopName}</div>
                                <div class="doc-badge">${title}</div>
                                <div class="meta-row">
                                    <span>رقم: ${id}</span>
                                    <span>التاريخ: ${date}</span>
                                </div>

                                <div class="box-info">
                                    <div>${actionLabel} <b style="font-size:14px; font-weight:900;">${partnerName}</b></div>
                                    <div class="amount-container">
                                        <div>${amountLabel}</div>
                                        <div class="amount-val">${formatMoney(amount)}</div>
                                    </div>
                                </div>

                                <table class="summary-table">
                                    <thead>
                                        <tr>
                                            <th style="width:33%;">${col1Label}</th>
                                            <th style="width:34%;">${col2Label}</th>
                                            <th style="width:33%;">${col3Label}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td>${formatMoney(balBefore)}</td>
                                            <td>${formatMoney(amount)}</td>
                                            <td>${formatMoney(balAfter)}</td>
                                        </tr>
                                    </tbody>
                                </table>

                                <div class="sign-grid">
                                    <div class="sign-line">توقيع المستلم</div>
                                    <div class="sign-line">${sign2Label}</div>
                                </div>

                                <div class="footer-text">
                                    <div>${footerMsg}</div>
                                    <div style="font-size:9px; color:#666; margin-top:3px;">نظام بَيَان POS المتكامل</div>
                                </div>
                            </div>
                            <script>
                                window.onload = function() {
                                    window.focus();
                                    setTimeout(function() {
                                        window.print();
                                        setTimeout(function() { window.close(); }, 500);
                                    }, 200);
                                };
                            <\/script>
                        </body>
                        </html>
                    `;

                    const printWindow = window.open('', '_blank');
                    if (printWindow) {
                        printWindow.document.write(htmlContent);
                        printWindow.document.close();
                    } else {
                        let receiptArea = document.getElementById('receipt-area');
                        if (!receiptArea) {
                            receiptArea = document.createElement('div');
                            receiptArea.id = 'receipt-area';
                            document.body.appendChild(receiptArea);
                        }
                        receiptArea.innerHTML = htmlContent;
                        window.print();
                    }
                } else {
                    if (typeof printInvoice === 'function') {
                        let printType = tx.type || 'بيع';
                        if (printType === 'sale') printType = 'بيع';
                        if (printType === 'purchase') printType = 'شراء';
                        
                        let printDocType = isPurchase ? 'purchase' : 'sales';
                        if (isReturn) {
                            printDocType = isPurchase ? 'return_purchase' : 'return_sales';
                            printType = isPurchase ? 'مرتجع مشتريات' : 'مرتجع مبيعات';
                        }
                        const printDocTitle = isReturn ? (isPurchase ? 'مرتجع مشتريات' : 'مرتجع مبيعات') : (isPurchase ? 'فاتورة مشتريات' : 'فاتورة مبيعات');

                        // فصل التاريخ والوقت بدقة وبصيغة سليمة
                        let printDate = '';
                        let printTime = '';
                        if (tx.dateISO) {
                            printDate = tx.dateISO;
                            printTime = tx.timeISO || '';
                        } else if (tx.date) {
                            if (tx.date.includes(' ')) {
                                const parts = tx.date.split(' ');
                                printDate = parts[0];
                                printTime = parts[1] ? parts[1].substring(0, 5) : '';
                            } else {
                                printDate = tx.date;
                            }
                        }

                        let prevBal = 0;
                        let partnerName = tx.customer || tx.partner || '';
                        if (partnerName && !window.isGenericCashPartner(partnerName)) {
                            if (typeof getHistoricalPartnerBalance === 'function') {
                                prevBal = getHistoricalPartnerBalance(partnerName, tx.invoiceId || tx.invoiceNumber || tx.id);
                            } else if (typeof getAccountBalance === 'function') {
                                prevBal = getAccountBalance(partnerName, tx.invoiceId || tx.invoiceNumber || tx.id);
                            }
                        }

                        printInvoice({
                            invoiceNumber: tx.invoiceId || tx.invoiceNumber || tx.id,
                            invoiceType: isReturn ? (isPurchase ? 'مرتجع مشتريات' : 'مرتجع مبيعات') : printType,
                            paymentMethod: tx.method || tx.paymentMethod || 'نقدي',
                            isReturn: isReturn,
                            isPurchase: isPurchase,
                            docTitle: printDocTitle,
                            date: printDate,
                            time: printTime,
                            cashier: tx.cashier || tx.user || '',
                            customer: tx.customer || tx.partner || 'عميل نقدي',
                            items: items,
                            totalAmount: invoiceFinalTotal,
                            paid: paidVal,
                            deferred: isDeferred ? remainingVal : 0,
                            prevBalance: prevBal,
                            currentBalance: prevBal + (invoiceFinalTotal - paidVal),
                            docType: printDocType
                        });
                    } else {
                        alert('خطأ: محرك الطباعة غير متوفر!');
                    }
                }
            };

            if (autoPrint) {
                executePrint();
                return;
            }

            existing = document.getElementById('customViewModalOverlay');
            if (existing) existing.remove();
            
            modal = document.createElement('div');
            modal.id = 'customViewModalOverlay';
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(15, 23, 42, 0.6); 
                z-index: 11000; display: flex; align-items: center; justify-content: center;
            `;
            
            modal.innerHTML = modalContent;
            document.body.appendChild(modal);
            
            document.getElementById('customPrintBtn').onclick = executePrint;
        };

        function selectHistoryRow(idx) {
            selectedHistoryIndex = idx;
            const tbody = document.getElementById('historyTableBody');
            if (!tbody) return;
            tbody.querySelectorAll('tr').forEach(tr => {
                tr.classList.remove('selected-row');
                const rad = tr.querySelector('input[type="radio"]');
                if (rad) rad.checked = false;
            });
            const targetRow = tbody.querySelector(`tr[data-orig-index="${idx}"]`);
            if (targetRow) {
                targetRow.classList.add('selected-row');
                const rad = targetRow.querySelector('input[type="radio"]');
                if (rad) rad.checked = true;
            }
        }

        function selectInvoiceRow(idx, rowEl) {
            selectedInvoiceIndex = idx;
            const tbody = document.getElementById('invoicesTableBody');
            if (tbody) {
                tbody.querySelectorAll('tr.selected-row').forEach(r => r.classList.remove('selected-row'));
                tbody.querySelectorAll('input[name="invRad"]').forEach(rad => rad.checked = false);
                const tr = rowEl || tbody.querySelector(`tr[data-orig-index="${idx}"]`);
                if (tr) {
                    tr.classList.add('selected-row');
                    const rad = tr.querySelector('input[name="invRad"]');
                    if (rad) rad.checked = true;
                }
            }
        }
        window.selectInvoiceRow = selectInvoiceRow;

        function shareSelectedInvoice(platform) {
            const activeIdx = (activeTabId && activeTabId.startsWith('invoices') ? selectedInvoiceIndex : selectedHistoryIndex);

            if (activeIdx === null || activeIdx === undefined) {
                return showCustomAlert({
                    type: 'warning',
                    titleText: '⚠️ تنبيه',
                    msg: 'يرجى تحديد العملية من الجدول أولاً للمشاركة.'
                });
            }

            const t = transactions[activeIdx];
            const text = `📄 تفاصيل ${t.type}\n🔢 رقم العملية: ${t.invoiceId || '-'}\n📅 التاريخ: ${t.date}\n👤 الطرف: ${t.partner || 'بدون'}\n💰 المبلغ: ${parseFloat(t.total || t.price || 0).toFixed(2)} ج.م\n📝 البيان: ${t.product || '-'}\n\nتم الإرسال عبر تطبيق بيان POS ✨`;

            let url = '';
            if (platform === 'wa') {
                url = `https://wa.me/?text=${encodeURIComponent(text)}`;
            } else if (platform === 'tg') {
                url = `https://t.me/share/url?url=${encodeURIComponent('https://t.me')}&text=${encodeURIComponent(text)}`;
            }

            if (url) window.open(url, '_blank');
            try { toggleShareMenu('invoicesShareMenu'); } catch(e){}
        }

        function printSelectedInvoice() {
            const activeIdx = (activeTabId && activeTabId.startsWith('invoices') ? selectedInvoiceIndex : selectedHistoryIndex);

            if (activeIdx === null || activeIdx === undefined) {
                return showCustomAlert({
                    type: 'warning',
                    titleText: '⚠️ تنبيه',
                    msg: 'يرجى تحديد (الضغط على) العملية من الجدول أولاً لطباعتها.'
                });
            }
            
            const t = transactions[activeIdx];
            if (t.invoiceId) {
                if (typeof viewInvoiceItems === 'function') {
                    // Pass autoPrint = true
                    viewInvoiceItems(t.invoiceId, t.type, true);
                }
            } else {
                // Single transaction (Receipt, Disbursement, etc.)
                window.renderCustomInvoiceModal({
                    ...t,
                    id: t.id || t.invoiceId || Math.floor(Math.random() * 10000),
                    items: [{
                        name: t.product || t.type,
                        qty: 1,
                        unit: '-',
                        price: t.total || t.price || 0,
                        total: t.total || t.price || 0
                    }],
                    paid: t.paidAmount || t.total || 0,
                    partner: t.partner || '-'
                }, true);
            }
            
            try { toggleShareMenu('invoicesShareMenu'); } catch(e){}
        }

        function viewSelectedInvoice() {
            const activeIdx = (activeTabId && activeTabId.startsWith('invoices') ? selectedInvoiceIndex : selectedHistoryIndex);

            if (activeIdx === null || activeIdx === undefined) {
                return showCustomAlert({
                    type: 'warning',
                    titleText: '⚠️ تنبيه',
                    msg: 'يرجى تحديد (الضغط على) العملية من الجدول أولاً لعرضها.'
                });
            }
            const t = transactions[activeIdx];
            if (t.invoiceId) {
                if (typeof viewInvoiceItems === 'function') {
                    viewInvoiceItems(t.invoiceId, t.type);
                }
            } else {
                // لو عملية مالية بدون رقم فاتورة (حركة فردية)
                window.renderCustomInvoiceModal({
                    ...t,
                    id: t.id || t.invoiceId || Math.floor(Math.random() * 10000),
                    items: [{
                        name: t.product || t.type,
                        qty: 1,
                        unit: '-',
                        price: t.total || t.price || 0,
                        total: t.total || t.price || 0
                    }],
                    paid: t.paidAmount || t.total || 0,
                    partner: t.partner || '-'
                });
            }
        }

        // دالة التعديل السريع برقم الفاتورة
        window.quickEditByNumber = function() {
            const settings = JSON.parse(getStore('pos_settings') || '{}');
            const canEditHistory = !!settings.allowHistoryEdit;
            if (!canEditHistory) {
                return showCustomAlert({
                    type: 'error',
                    titleText: '🚫 صلاحية ملغاة',
                    msg: 'عذراً، صلاحية تعديل السجل (Edit History) غير مفعلة في الإعدادات.'
                });
            }

            const input = document.getElementById('quickEditInvoiceId');
            if (!input) return;
            const invId = input.value.trim();

            if (!invId) {
                showToast("⚠️ يرجى إدخال رقم الفاتورة أولاً", "warning");
                input.focus();
                return;
            }

            // البحث عن الفاتورة في قاعدة البيانات
            const found = transactions.find(t => t.invoiceId == invId);

            if (found) {
                let cleanType = '';
                const typeStr = found.type;
                if (typeStr.includes('بيع') && !typeStr.includes('مرتجع')) cleanType = 'بيع';
                else if (typeStr.includes('شراء') && !typeStr.includes('مرتجع')) cleanType = 'شراء';
                else if (typeStr.includes('مرتجع بيع')) cleanType = 'مرتجع بيع';
                else if (typeStr.includes('مرتجع شراء')) cleanType = 'مرتجع شراء';
                else if (typeStr.includes('قبض')) cleanType = 'قبض';
                else if (typeStr.includes('صرف')) cleanType = 'صرف';

                if (window.editTransaction) {
                    window.editTransaction(invId, cleanType);
                    input.value = '';
                }
            } else {
                showCustomAlert({
                    type: 'error',
                    titleText: '❌ غير موجود',
                    msg: `لم يتم العثور على فاتورة بالرقم (#${invId}).`
                });
            }
        };

        function editSelectedInvoice() {
            const isInv = (typeof activeTabId === 'string' && activeTabId.startsWith('invoices'));
            const activeIdx = isInv ? selectedInvoiceIndex : selectedHistoryIndex;

            if (activeIdx === null || activeIdx === undefined || activeIdx === -1) {
                return showCustomAlert({
                    type: 'warning',
                    titleText: '⚠️ تنبيه',
                    msg: 'يرجى تحديد (الضغط على) العملية من الجدول أولاً لبدء التعديل.'
                });
            }

            const t = transactions[activeIdx];
            if (!t || (!t.invoiceId && !t.id)) {
                showToast("⚠️ لا يمكن تعديل هذه الحركة مباشرة", "error");
                return;
            }

            let cleanType = '';
            const typeStr = t.type || '';
            if (typeStr.includes('بيع') && !typeStr.includes('مرتجع')) cleanType = 'بيع';
            else if (typeStr.includes('شراء') && !typeStr.includes('مرتجع')) cleanType = 'شراء';
            else if (typeStr.includes('مرتجع بيع')) cleanType = 'مرتجع بيع';
            else if (typeStr.includes('مرتجع شراء')) cleanType = 'مرتجع شراء';
            else if (typeStr.includes('تسوية')) cleanType = 'تسوية';
            else if (typeStr.includes('قبض')) cleanType = 'قبض';
            else if (typeStr.includes('صرف')) cleanType = 'صرف';
            else if (typeStr.includes('تحويل')) cleanType = 'تحويل';

            if (window.editTransaction) {
                window.editTransaction(t.invoiceId || t.id, cleanType);
            }
        }

        function deleteSelectedInvoice() {
            const isInv = (typeof activeTabId === 'string' && activeTabId.startsWith('invoices'));
            const activeIdx = isInv ? selectedInvoiceIndex : selectedHistoryIndex;

            if (activeIdx === null || activeIdx === undefined || activeIdx === -1) {
                return showCustomAlert({
                    type: 'warning',
                    titleText: '⚠️ تنبيه',
                    msg: 'يرجى تحديد (الضغط على) العملية من الجدول أولاً لتتمكن من حذفها.'
                });
            }

            deleteTransaction(activeIdx);
        }

        function printIndividualTransaction(idx) {
            const t = transactions[idx];
            if (!t) return;
            if (t.type.includes('بيع') || t.type.includes('شراء') || t.type.includes('مرتجع')) {
                if (t.invoiceId && typeof viewInvoiceItems === 'function') {
                    viewInvoiceItems(t.invoiceId, t.type, true);
                } else if (t.invoiceId && typeof printBillFromData === 'function') {
                    printBillFromData(t.invoiceId, t.type);
                } else {
                    alert("لا يمكن طباعة هذا البند بشكل مستقل (لا يوجد رقم فاتورة)");
                }
            } else if (t.type.includes('قبض')) {
                document.getElementById('receiptID').value = t.invoiceId || '-';
                document.getElementById('receiptDate').value = t.dateISO;
                document.getElementById('receiptCustomer').value = t.partner;
                document.getElementById('receiptAmount').value = t.price;
                document.getElementById('receiptNotes').value = t.product;
                printReceiptData();
            } else if (t.type.includes('صرف')) {
                document.getElementById('disburseID').value = t.invoiceId || '-';
                document.getElementById('disburseDate').value = t.dateISO;
                document.getElementById('disbursePayee').value = t.partner;
                document.getElementById('disburseAmount').value = t.price;
                document.getElementById('disburseNotes').value = t.product;
                printDisbursementData();
            } else {
                if (typeof showToast === 'function') {
                    showToast("تم إرسال طلب الطباعة للطابعة الافتراضية...", "success");
                }
            }
        }

        let loginClockInterval = null;