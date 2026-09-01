
/**
 * نظام سلة المحذوفات الذكية - بَيَان POS
 * إدارة العناصر المحذوفة مؤقتاً وإمكانية استعادتها
 */

const trashManager = {
    // جلب كافة المحذوفات من قاعدة البيانات
    async loadTrash() {
        try {
            window.trashBin = await db.trash.toArray();
            // Parse originalData if it's stringified
            window.trashBin = window.trashBin.map(t => {
                if (typeof t.originalData === 'string') {
                    t.originalData = JSON.parse(t.originalData);
                }
                return t;
            });
            this.renderTrashTable();
        } catch (error) {
            console.error("خطأ في تحميل سلة المحذوفات:", error);
        }
    },

    /**
     * استخراج اسم المخزن المرتبط بالعنصر المحذوف
     */
    getItemWarehouse(item) {
        if (item.warehouse && String(item.warehouse).trim() !== '') return item.warehouse;
        let data = item.originalData;
        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch(e) {}
        }
        if (data) {
            if (Array.isArray(data) && data.length > 0) {
                const first = data[0];
                if (first.warehouse) return first.warehouse;
                if (first.sourceWarehouse) return first.sourceWarehouse;
            }
            if (data.warehouse) return data.warehouse;
            if (data.sourceWarehouse) return data.sourceWarehouse;
            if (item.type === 'warehouse' || item.type === 'مخزن') return data.name || (data.warehouse && data.warehouse.name) || 'مخزن';
            if (data.warehouseStocks && typeof data.warehouseStocks === 'object') {
                const whKeys = Object.keys(data.warehouseStocks).filter(k => parseFloat(data.warehouseStocks[k]) > 0);
                if (whKeys.length === 1) return whKeys[0];
                if (whKeys.length > 1) return whKeys.join(' ، ');
            }
        }
        if (item.type === 'product' || item.type === 'inventory') {
            return (typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'المخزن الرئيسي';
        }
        if (item.type === 'account') return 'كافة المخازن / عام';
        return (typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'المخزن الرئيسي';
    },

    /**
     * نقل عنصر إلى سلة المحذوفات
     */
    async moveToTrash(data, type, label, warehouse = null) {
        const activeWH = warehouse || (data && data.warehouse) || (data && data.sourceWarehouse) || ((typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'المخزن الرئيسي');
        const trashItem = {
            type: type,
            label: label,
            warehouse: (type === 'account') ? 'كافة المخازن / عام' : activeWH,
            originalData: data,
            deletedAt: new Date().toISOString(),
            deletedBy: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.name : 'نظام آلي'
        };

        try {
            await db.trash.add(trashItem);
            await this.loadTrash();
            showToast(`🗑️ تم نقل "${label}" إلى سلة المحذوفات`, "info");
        } catch (error) {
            console.error("فشل النقل للسلة:", error);
            showToast("❌ فشل نقل العنصر لسلة المحذوفات", "error");
        }
    },

    // عرض جدول المحذوفات في الإعدادات
    renderTrashTable() {
        const tbody = document.getElementById('trashTableBody');
        if (!tbody) return;

        tbody.innerHTML = '';
        
        const badge = document.getElementById('trashCountBadge');
        if (badge) {
            const count = (window.trashBin && Array.isArray(window.trashBin)) ? window.trashBin.length : 0;
            badge.innerText = `${count} عنصر محذوف`;
            badge.style.display = count > 0 ? 'inline-block' : 'none';
        }

        if (!window.trashBin || window.trashBin.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:35px; color:#94a3b8; font-weight:700;">📭 سلة المحذوفات فارغة حالياً</td></tr>`;
            return;
        }

        const query = (document.getElementById('trashSearchInput')?.value || '').trim().toLowerCase();
        let list = [...window.trashBin];

        if (query) {
            list = list.filter(item => {
                const lbl = String(item.label || '').toLowerCase();
                const wh = String(this.getItemWarehouse(item) || '').toLowerCase();
                const tp = String(item.type || '').toLowerCase();
                const by = String(item.deletedBy || '').toLowerCase();
                return lbl.includes(query) || wh.includes(query) || tp.includes(query) || by.includes(query);
            });
        }

        if (list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:#94a3b8; font-weight:bold;">🔍 لا توجد نتائج مطابقة لبحثك في السلة</td></tr>`;
            return;
        }

        // ترتيب من الأحدث للأقدم
        const sortedTrash = list.sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));

        sortedTrash.forEach(item => {
            const tr = document.createElement('tr');
            tr.style.cssText = "border-bottom: 1px solid #f1f5f9; transition: 0.2s;";
            tr.onmouseover = () => tr.style.background = '#f8fafc';
            tr.onmouseout = () => tr.style.background = 'transparent';
            
            let typeLabel = '';
            let icon = '';
            let typeBg = '#f1f5f9';
            let typeColor = '#475569';

            switch(item.type) {
                case 'product': case 'inventory': 
                    typeLabel = 'صنف / منتج'; icon = '📦'; typeBg = '#eff6ff'; typeColor = '#2563eb'; break;
                case 'transaction': case 'invoice': case 'sale': case 'purchase':
                    typeLabel = 'فاتورة / عملية'; icon = '📄'; typeBg = '#fdf2f8'; typeColor = '#db2777'; break;
                case 'account': 
                    typeLabel = 'حساب / عميل'; icon = '👤'; typeBg = '#f0fdf4'; typeColor = '#16a34a'; break;
                case 'warehouse': case 'مخزن': 
                    typeLabel = 'مخزن / فرع'; icon = '🏭'; typeBg = '#fefce8'; typeColor = '#ca8a04'; break;
                default: 
                    typeLabel = 'عنصر نظام'; icon = '📁';
            }

            const deleteDate = new Date(item.deletedAt).toLocaleString('ar-EG');
            const itemWarehouse = this.getItemWarehouse(item);

            tr.innerHTML = `
                <td style="padding: 10px 14px; font-weight: bold;">
                    <span style="background:${typeBg}; color:${typeColor}; padding:4px 10px; border-radius:8px; font-size:0.8rem; display:inline-flex; align-items:center; gap:4px; font-weight:800;">
                        ${icon} ${typeLabel}
                    </span>
                </td>
                <td style="padding: 10px 14px; font-weight: 800; color: #0f172a; font-size: 0.92rem;">
                    ${item.label || '---'}
                </td>
                <td style="padding: 10px 14px; text-align: center;">
                    <span style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; padding: 3px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: 800; display: inline-block;">
                        🏢 ${itemWarehouse}
                    </span>
                </td>
                <td style="padding: 10px 14px; font-weight: 700; color: #475569; font-size: 0.85rem;">
                    👤 ${item.deletedBy || 'غير معروف'}
                </td>
                <td style="padding: 10px 14px; color: #64748b; font-size: 0.8rem; font-weight: 600; direction: ltr; text-align: right;">
                    🕒 ${deleteDate}
                </td>
                <td style="padding: 8px 14px; text-align: center;">
                    <div style="display: flex; gap: 8px; justify-content: center; align-items: center;">
                        <button onclick="trashManager.restore(${item.id})" class="action-btn" style="background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; padding: 6px 12px; border-radius: 8px; font-size: 0.78rem; font-weight: 800; cursor: pointer; white-space: nowrap; box-shadow: 0 2px 6px rgba(16,185,129,0.3); transition: 0.2s;" title="استعادة إلى النظام">🔄 استعادة</button>
                        <button onclick="trashManager.permanentDelete(${item.id})" class="action-btn" style="background: #fee2e2; color: #dc2626; border: 1.5px solid #fca5a5; padding: 5px 12px; border-radius: 8px; font-size: 0.78rem; font-weight: 800; cursor: pointer; white-space: nowrap; transition: 0.2s;" title="حذف نهائي لا رجعة فيه">🗑️ حذف نهائي</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    /**
     * استعادة عنصر من سلة المحذوفات
     */
    async restore(id) {
        const item = window.trashBin.find(x => String(x.id) === String(id));
        if (!item) {
            alert("⚠️ لم يتم العثور على العنصر في السلة!");
            return;
        }

        try {
            let data = item.originalData;
            if (typeof data === 'string') {
                try { data = JSON.parse(data); } catch(e) {}
            }

            const itemType = String(item.type || '').toLowerCase();
            
            if (itemType === 'product' || itemType === 'inventory') {
                const itemsToRestore = Array.isArray(data) ? data : [data];
                for (const p of itemsToRestore) {
                    if (!p) continue;
                    const cleanP = typeof p === 'object' ? { ...p } : p;
                    await db.products.put(cleanP);
                }
                window.productsDB = await db.products.toArray();
                if (typeof renderInventoryTable === 'function') renderInventoryTable();
            } else if (itemType === 'transaction' || itemType === 'invoice' || itemType === 'sale' || itemType === 'purchase') {
                const itemsToRestore = Array.isArray(data) ? data : (data.items ? data.items : [data]);
                for (const t of itemsToRestore) {
                    if (!t) continue;
                    const cleanT = typeof t === 'object' ? { ...t } : t;
                    if (cleanT.id) delete cleanT.id;
                    await db.transactions.add(cleanT);

                    if (t.product && typeof productsDB !== 'undefined') {
                        const p = productsDB.find(prod => prod.name === t.product || prod.id === t.productId || prod.id === t.product);
                        if (p) {
                            let factor = parseFloat(t.unitFactor) || 1;
                            if (t.unit && p.units) {
                                const u = p.units.find(u => u.unitName === t.unit);
                                if (u) factor = parseFloat(u.factor) || 1;
                            }
                            const baseQty = (parseFloat(t.qty) || 0) * factor;
                            const activeWH = t.warehouse || ((typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'المخزن الرئيسي');
                            if (!p.warehouseStocks) p.warehouseStocks = {};
                            const tType = t.type || '';

                            if (tType.includes('مرتجع بيع')) {
                                p.stock = (parseFloat(p.stock) || 0) + baseQty;
                                p.warehouseStocks[activeWH] = (parseFloat(p.warehouseStocks[activeWH]) || 0) + baseQty;
                            } else if (tType.includes('مرتجع شراء')) {
                                p.stock = Math.max(0, (parseFloat(p.stock) || 0) - baseQty);
                                p.warehouseStocks[activeWH] = Math.max(0, (parseFloat(p.warehouseStocks[activeWH]) || 0) - baseQty);
                            } else if (tType.includes('بيع')) {
                                p.stock = Math.max(0, (parseFloat(p.stock) || 0) - baseQty);
                                p.warehouseStocks[activeWH] = Math.max(0, (parseFloat(p.warehouseStocks[activeWH]) || 0) - baseQty);
                            } else if (tType.includes('شراء')) {
                                p.stock = (parseFloat(p.stock) || 0) + baseQty;
                                p.warehouseStocks[activeWH] = (parseFloat(p.warehouseStocks[activeWH]) || 0) + baseQty;
                            } else if (tType.includes('تسوية')) {
                                p.stock = (parseFloat(p.stock) || 0) + baseQty;
                                p.warehouseStocks[activeWH] = (parseFloat(p.warehouseStocks[activeWH]) || 0) + baseQty;
                            } else if (tType.includes('تحويل')) {
                                const srcWH = t.sourceWarehouse || 'المخزن الرئيسي';
                                const dstWH = t.warehouse || '';
                                p.warehouseStocks[srcWH] = Math.max(0, (parseFloat(p.warehouseStocks[srcWH]) || 0) - baseQty);
                                if (dstWH) {
                                    p.warehouseStocks[dstWH] = (parseFloat(p.warehouseStocks[dstWH]) || 0) + baseQty;
                                }
                            }

                            // استعادة رصيد التشكيلة (المقاس واللون) بدقة
                            if (p.variants && Array.isArray(p.variants)) {
                                const sSize = String(t.selectedSize || t.size || '').trim();
                                const sColor = String(t.selectedColor || t.color || '').trim();
                                if (sSize || sColor) {
                                    const matchedVar = p.variants.find(v => 
                                        (!sSize || String(v.size || '').trim() === sSize) && 
                                        (!sColor || String(v.color || '').trim() === sColor)
                                    );
                                    if (matchedVar) {
                                        if (!matchedVar.warehouseStocks || typeof matchedVar.warehouseStocks !== 'object') matchedVar.warehouseStocks = {};
                                        if (tType.includes('مرتجع بيع')) {
                                            matchedVar.stock = (parseFloat(matchedVar.stock) || 0) + baseQty;
                                            matchedVar.warehouseStocks[activeWH] = (parseFloat(matchedVar.warehouseStocks[activeWH]) || 0) + baseQty;
                                        } else if (tType.includes('مرتجع شراء')) {
                                            matchedVar.stock = Math.max(0, (parseFloat(matchedVar.stock) || 0) - baseQty);
                                            matchedVar.warehouseStocks[activeWH] = Math.max(0, (parseFloat(matchedVar.warehouseStocks[activeWH]) || 0) - baseQty);
                                        } else if (tType.includes('بيع')) {
                                            matchedVar.stock = Math.max(0, (parseFloat(matchedVar.stock) || 0) - baseQty);
                                            matchedVar.warehouseStocks[activeWH] = Math.max(0, (parseFloat(matchedVar.warehouseStocks[activeWH]) || 0) - baseQty);
                                        } else if (tType.includes('شراء')) {
                                            matchedVar.stock = (parseFloat(matchedVar.stock) || 0) + baseQty;
                                            matchedVar.warehouseStocks[activeWH] = (parseFloat(matchedVar.warehouseStocks[activeWH]) || 0) + baseQty;
                                        } else if (tType.includes('تسوية')) {
                                            matchedVar.stock = (parseFloat(matchedVar.stock) || 0) + baseQty;
                                            matchedVar.warehouseStocks[activeWH] = (parseFloat(matchedVar.warehouseStocks[activeWH]) || 0) + baseQty;
                                        } else if (tType.includes('تحويل')) {
                                            const srcWH = t.sourceWarehouse || 'المخزن الرئيسي';
                                            const dstWH = t.warehouse || '';
                                            matchedVar.warehouseStocks[srcWH] = Math.max(0, (parseFloat(matchedVar.warehouseStocks[srcWH]) || 0) - baseQty);
                                            if (dstWH) matchedVar.warehouseStocks[dstWH] = (parseFloat(matchedVar.warehouseStocks[dstWH]) || 0) + baseQty;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                if (typeof db !== 'undefined' && db.products && typeof productsDB !== 'undefined' && productsDB.length > 0) {
                    await db.products.bulkPut(productsDB);
                }
                window.transactions = await db.transactions.toArray();
                if (typeof invalidateStockCache === 'function') invalidateStockCache();
                if (typeof renderInvoicesTable === 'function') renderInvoicesTable();
                if (typeof renderInventoryTable === 'function') renderInventoryTable();
                if (typeof renderAccountsTable === 'function') renderAccountsTable();
            } else if (itemType === 'account') {
                const itemsToRestore = Array.isArray(data) ? data : [data];
                for (const a of itemsToRestore) {
                    if (!a) continue;
                    const cleanA = typeof a === 'object' ? { ...a } : a;
                    await db.accounts.put(cleanA);
                }
                window.accounts = await db.accounts.toArray();
                if (typeof renderAccountsTable === 'function') renderAccountsTable();
            } else if (itemType === 'warehouse' || itemType === 'مخزن') {
                const savedWH = data.warehouse || data;
                const savedStock = data.stock || [];

                if (typeof warehouses !== 'undefined' && Array.isArray(warehouses)) {
                    if (!warehouses.some(w => w.name === savedWH.name)) {
                        warehouses.push(savedWH);
                        if (typeof saveData === 'function') saveData();
                    }
                }

                if (Array.isArray(savedStock) && savedStock.length > 0 && typeof productsDB !== 'undefined') {
                    savedStock.forEach(st => {
                        const p = productsDB.find(prod => prod.id === st.productId || prod.barcode === st.barcode);
                        if (p) {
                            if (!p.warehouseStocks) p.warehouseStocks = {};
                            p.warehouseStocks[savedWH.name] = st.quantity;
                        }
                    });
                    if (typeof db !== 'undefined' && db.products) {
                        await db.products.bulkPut(productsDB);
                    }
                }

                if (typeof renderWarehousesTable === 'function') renderWarehousesTable();
                if (typeof updateSettingsWarehouseSelect === 'function') updateSettingsWarehouseSelect();
                if (typeof renderInventoryTable === 'function') renderInventoryTable();
            } else {
                const itemsToRestore = Array.isArray(data) ? data : [data];
                for (const obj of itemsToRestore) {
                    if (!obj) continue;
                    const cleanObj = typeof obj === 'object' ? { ...obj } : obj;
                    if (cleanObj.id) delete cleanObj.id;
                    if (db[itemType + 's']) await db[itemType + 's'].add(cleanObj);
                    else if (db[itemType]) await db[itemType].add(cleanObj);
                }
            }

            // الحذف من السلة بعد الاستعادة الناجحة
            await db.trash.delete(Number(id) || id);
            window.trashBin = window.trashBin.filter(x => String(x.id) !== String(id));
            await this.loadTrash();

            showToast(`✅ تم استعادة "${item.label || 'العنصر'}" بنجاح`, "success");
        } catch (error) {
            console.error("فشل الاستعادة:", error);
            alert("❌ فشل استعادة العنصر: " + error.message);
        }
    },

    /**
     * حذف نهائي لعنصر واحد
     */
    async permanentDelete(id) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert({
                type: 'warning',
                titleText: '🗑️ تأكيد الحذف النهائي',
                msg: 'هل أنت متأكد من حذف هذا العنصر نهائياً؟ <b>لا يمكن الاستعادة بعدها!</b>',
                confirmText: 'نعم، حذف نهائي',
                cancelText: 'تراجع',
                showCancel: true,
                onConfirm: async () => {
                    try {
                        await db.trash.delete(id);
                        await this.loadTrash();
                        showToast("🗑️ تم الحذف النهائي بنجاح", "info");
                    } catch (error) {
                        console.error("فشل الحذف النهائي:", error);
                    }
                }
            });
        } else {
            if (!confirm("🚨 هل أنت متأكد من حذف هذا العنصر نهائياً؟ لا يمكن الاستعادة بعدها!")) return;
            try {
                await db.trash.delete(id);
                await this.loadTrash();
                showToast("🗑️ تم الحذف النهائي بنجاح", "info");
            } catch (error) {
                console.error("فشل الحذف النهائي:", error);
            }
        }
    },

    /**
     * إفراغ السلة بالكامل
     */
    async emptyTrash() {
        if (trashBin.length === 0) return showToast("السلة فارغة بالفعل", "info");
        
        if (typeof showCustomAlert === 'function') {
            showCustomAlert({
                type: 'error',
                titleText: '🚨 إفراغ السلة بالكامل',
                msg: '<p style="font-weight:bold; color:#b91c1c;">هل أنت متأكد من إفراغ سلة المحذوفات بالكامل؟</p><p style="font-size:0.9rem; margin-top:5px;">سيتم حذف كافة العناصر بشكل نهائي ولا يمكن التراجع عن هذه الخطوة.</p>',
                confirmText: 'نعم، إفراغ السلة 🧹',
                cancelText: 'إلغاء 🛡️',
                showCancel: true,
                onConfirm: async () => {
                    try {
                        await db.trash.clear();
                        window.trashBin = [];
                        await this.loadTrash();
                        showToast("🧹 تم إفراغ السلة بنجاح", "success");
                    } catch (error) {
                        console.error("فشل إفراغ السلة:", error);
                    }
                }
            });
        } else {
            if (!confirm("🚨 هل أنت متأكد من إفراغ سلة المحذوفات بالكامل؟\nسيتم حذف كافة العناصر نهائياً!")) return;
            try {
                await db.trash.clear();
                window.trashBin = [];
                await this.loadTrash();
                showToast("🧹 تم إفراغ السلة بنجاح", "success");
            } catch (error) {
                console.error("فشل إفراغ السلة:", error);
            }
        }
    }
};

// جعل الوظائف متاحة عالمياً للأزرار في HTML
window.emptyTrash = () => trashManager.emptyTrash();
window.renderTrashTable = () => trashManager.renderTrashTable();
window.trashManager = trashManager;

// تحميل البيانات عند بدء التشغيل
document.addEventListener('DOMContentLoaded', () => {
    // ننتظر قليلاً لضمان تحميل Dexie وقاعدة البيانات
    setTimeout(() => {
        if (typeof trashManager !== 'undefined') trashManager.loadTrash();
    }, 1000);
});
