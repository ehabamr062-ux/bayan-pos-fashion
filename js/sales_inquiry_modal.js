/**
 * =========================================================================
 * 🔍 مودال الاستعلام السريع عن أرصدة الأصناف والفروع وحركة الصنف (POS Fast Inquiry)
 * =========================================================================
 * - استعلام لحظي عن أرصدة المخازن مرتبة تنازلياً من الأعلى رصيداً إلى الأقل.
 * - فلترة دقيقة حسب المقاس واللون في تشكيلات الفاشون.
 * - كروت تفصيلية لأسعار البيع والتكلفة وحركة الصنف التاريخية.
 * =========================================================================
 */

(function () {
    'use strict';

    let currentInquiryProduct = null;
    let currentInquiryTab = 'general'; // 'general' | 'history' | 'specs'
    let selectedInquirySize = 'all';
    let selectedInquiryColor = 'all';

    let inquirySearchResults = [];
    let inquirySearchActiveIndex = -1;

    /**
     * التحقق من صلاحية وإعداد إظهار أسعار التكلفة والجملة في الاستعلام
     */
    function shouldShowInquiryCostsAndWholesale() {
        try {
            const posSettings = JSON.parse(getStore('pos_settings') || '{}');
            // إذا كان خيار إظهار التكلفة والجملة بالاستعلام غير مفعل
            if (posSettings.showInquiryCostPrice === false || posSettings.showInquiryCostPrice === undefined) {
                return false;
            }
            // التحقق من صلاحية أسعار الشراء والتقارير
            if (typeof checkPermission === 'function') {
                return checkPermission('docs_purchase_price');
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * التحقق من صلاحية تعديل بيانات الأصناف للمستخدم الحالي
     */
    function canUserEditProducts() {
        try {
            if (typeof currentUser === 'undefined' || !currentUser) return false;
            if (currentUser.role === 'admin') return true;
            if (typeof hasPermission === 'function') {
                return hasPermission('items_edit') || hasPermission('stock_edit') || hasPermission('products_edit');
            }
            return false;
        } catch (e) {
            return false;
        }
    }

    /**
     * معالج النصوص والبحث العربي المرن والذكي (تطابق أ/إ/آ و ة/ه و ي/ى)
     */
    const cleanArabic = (str) => String(str || '').trim().toLowerCase()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/[ىي]/g, 'ي')
        .replace(/\s+/g, ' ');

    /**
     * فتح مودال الاستعلام السريع
     */
    window.openFastItemInquiryModal = function (productId = null, targetVariant = null) {
        // 1. تحديد الصنف المستهدف بدقة
        if (productId) {
            currentInquiryProduct = (typeof productsDB !== 'undefined' && Array.isArray(productsDB))
                ? productsDB.find(p => p.id === productId || p.id == productId)
                : null;
        } else {
            // محاولة جلب الصنف المكتوب أو المحدد حالياً في شاشة البيع فقط
            currentInquiryProduct = null;
            if (typeof currentHeaderProductId !== 'undefined' && currentHeaderProductId) {
                currentInquiryProduct = productsDB.find(p => p.id === currentHeaderProductId || p.id == currentHeaderProductId);
            }
            if (!currentInquiryProduct) {
                const searchVal = (document.getElementById('productSearch')?.value || '').trim().toLowerCase();
                const searchClean = cleanArabic(searchVal);
                if (searchClean && typeof productsDB !== 'undefined') {
                    for (const p of productsDB) {
                        if (p.variants && p.variants.length > 0) {
                            const matchedV = p.variants.find(v => 
                                (v.barcode && String(v.barcode).trim().toLowerCase() === searchVal) ||
                                (v.barcode && cleanArabic(v.barcode) === searchClean)
                            );
                            if (matchedV) {
                                currentInquiryProduct = p;
                                targetVariant = matchedV;
                                break;
                            }
                        }
                        if (cleanArabic(p.name) === searchClean ||
                            (p.barcode && String(p.barcode).trim().toLowerCase() === searchVal) ||
                            (p.code && String(p.code).trim().toLowerCase() === searchVal)) {
                            currentInquiryProduct = p;
                            break;
                        }
                    }
                    if (!currentInquiryProduct) {
                        currentInquiryProduct = productsDB.find(p => cleanArabic(p.name).includes(searchClean));
                    }
                }
            }
            // 🛑 إذا لم يتم اختيار أو كتابة أي صنف، يبقى null ليفتح شاشة البحث النظيفة فوراً
        }

        // إذا تم تمرير أو اكتشاف Variant معين
        if (targetVariant) {
            selectedInquirySize = (targetVariant.size && String(targetVariant.size).trim()) ? String(targetVariant.size).trim() : 'all';
            selectedInquiryColor = (targetVariant.color && String(targetVariant.color).trim()) ? String(targetVariant.color).trim() : 'all';
        } else {
            selectedInquirySize = 'all';
            selectedInquiryColor = 'all';
        }

        currentInquiryTab = 'general';
        renderInquiryModal();
    };

    /**
     * بناء وهيكلة نافذة المودال بالكامل بتصميم أخضر زاهي وواضح 100%
     */
    function renderInquiryModal() {
        let modal = document.getElementById('bayanFastInquiryModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'bayanFastInquiryModal';
            modal.className = 'confirm-modal-overlay';
            modal.style.cssText = `
                position: fixed; inset: 0; z-index: 99999999;
                background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(6px);
                display: flex; align-items: center; justify-content: center;
                direction: rtl; font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
                animation: fadeIn 0.25s ease-out;
            `;
            document.body.appendChild(modal);
        }

        // 🌟 في حالة عدم اختيار صنف مسبقاً (فتح شاشة البحث الفوري الخضراء الأنيقة)
        if (!currentInquiryProduct) {
            modal.innerHTML = `
                <div style="background: #ffffff; width: 95%; max-width: 650px; border-radius: 24px; overflow: hidden; box-shadow: 0 30px 70px rgba(0,0,0,0.4); border: 2.5px solid #059669; animation: slideUp 0.3s ease-out;">
                    <!-- هيدر البحث الأخضر الزاهي -->
                    <div style="background: linear-gradient(135deg, #065f46 0%, #047857 50%, #059669 100%); padding: 18px 24px; color: white; border-bottom: 3px solid #10b981; display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="background: #ffffff; color: #047857; width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 900; box-shadow: 0 4px 10px rgba(0,0,0,0.15);">
                                ❓
                            </div>
                            <div>
                                <h3 style="margin: 0; font-size: 1.25rem; font-weight: 900; color: #ffffff;">استعلام الأصناف والأرصدة</h3>
                                <p style="margin: 2px 0 0; font-size: 0.82rem; color: #a7f3d0; font-weight: 700;">فحص فوري لأرصدة وتفاصيل أي صنف بكافة المخازن والفروع</p>
                            </div>
                        </div>
                        <button onclick="window.closeFastItemInquiryModal()" style="background: rgba(255, 255, 255, 0.2); color: #ffffff; border: 1.5px solid rgba(255, 255, 255, 0.4); border-radius: 10px; width: 34px; height: 34px; font-size: 1.1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold; transition: 0.2s;"
                            onmouseover="this.style.background='#ef4444'; this.style.borderColor='#ef4444';" onmouseout="this.style.background='rgba(255, 255, 255, 0.2)'; this.style.borderColor='rgba(255, 255, 255, 0.4)';">✕</button>
                    </div>

                    <div style="padding: 24px; text-align: center;">
                        <p style="color: #334155; font-size: 0.95rem; font-weight: 800; margin-bottom: 15px;">
                            🔎 اكتب اسم الصنف، كوده، أو امسح الباركود مباشرة لعرض أرصدته وأسعاره:
                        </p>

                        <div style="position: relative; margin-bottom: 20px;">
                            <input type="text" id="inquiryLiveSearch" placeholder="🔍 اكتب اسم الصنف أو امسح الباركود بالسكانر..."
                                style="width: 100%; height: 50px; border-radius: 14px; border: 2.5px solid #059669; padding: 0 20px; font-size: 1.1rem; font-weight: 900; color: #0f172a; outline: none; box-sizing: border-box; background: #f0fdf4; box-shadow: inset 0 2px 6px rgba(0,0,0,0.05);"
                                oninput="window.handleInquiryLiveSearch(this.value)"
                                onkeydown="window.handleInquirySearchKeyDown(event)"
                                autocomplete="off">
                            <div id="inquirySearchDropdown" style="position: absolute; top: 56px; right: 0; left: 0; background: #ffffff; border: 2px solid #10b981; border-radius: 14px; max-height: 280px; overflow-y: auto; z-index: 100; display: none; box-shadow: 0 15px 35px rgba(0,0,0,0.2);" class="fast-scrollbar"></div>
                        </div>

                        <div style="background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 14px; padding: 15px; margin-bottom: 20px; color: #64748b; font-size: 0.88rem; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px;">
                            <span>💡</span> يمكنك استخدام قارئ الباركود أو الأسهم ⬇️ ⬆️ من لوحة المفاتيح والضغط على Enter للاختيار
                        </div>

                        <button onclick="window.closeFastItemInquiryModal()" style="padding: 10px 35px; background: #64748b; color: white; border: none; border-radius: 12px; font-weight: 900; font-size: 0.95rem; cursor: pointer; transition: 0.2s;">إلغاء ✕</button>
                    </div>
                </div>
            `;
            modal.style.display = 'flex';
            setTimeout(() => document.getElementById('inquiryLiveSearch')?.focus(), 100);
            return;
        }

        const p = currentInquiryProduct;
        const variants = (p.variants && Array.isArray(p.variants)) ? p.variants : [];
        const hasVariants = variants.length > 0;

        // استخراج المقاسات والألوان المتاحة
        const allSizes = [...new Set(variants.map(v => v.size).filter(s => s && String(s).trim() !== '' && String(s).trim() !== '-'))];
        const allColors = [...new Set(variants.map(v => v.color).filter(c => c && String(c).trim() !== '' && String(c).trim() !== '-'))];

        modal.innerHTML = `
            <div style="background: #f8fafc; width: 96%; max-width: 1180px; max-height: 92vh; border-radius: 20px; box-shadow: 0 25px 60px rgba(0,0,0,0.4); border: 2px solid #059669; display: flex; flex-direction: column; overflow: hidden; position: relative;">
                
                <!-- 1. الهيدر الأخضر الزاهي الفاخر وشريط البحث والتبويبات الواضحة -->
                <div style="background: linear-gradient(135deg, #064e3b 0%, #047857 50%, #059669 100%); padding: 14px 20px; color: white; border-bottom: 3px solid #10b981; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 4px 15px rgba(4, 120, 87, 0.3);">
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 15px;">
                        
                        <!-- عنوان الصنف وكوده بتصميم ناصع البياض وواضح -->
                        <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;">
                            <div style="background: #ffffff; color: #047857; width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 900; box-shadow: 0 4px 12px rgba(0,0,0,0.2); flex-shrink: 0;">
                                ❓
                            </div>
                            <div style="min-width: 0;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <h3 style="margin: 0; font-size: 1.35rem; font-weight: 900; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                                        ${p.name}
                                    </h3>
                                    <span style="background: #022c22; color: #6ee7b7; border: 1.5px solid #34d399; padding: 2px 10px; border-radius: 8px; font-size: 0.82rem; font-weight: 900; font-family: monospace; letter-spacing: 0.5px;">
                                        كود: ${p.code || p.id}
                                    </span>
                                </div>
                                <div style="font-size: 0.84rem; color: #f0fdf4; margin-top: 3px; font-weight: 700;">
                                    باركود: <b style="color: #ffffff; font-family: monospace; background: rgba(0,0,0,0.25); padding: 1px 6px; border-radius: 4px;">${p.barcode || '-'}</b> | 
                                    التصنيف: <b style="color: #fed7aa; background: rgba(0,0,0,0.2); padding: 1px 6px; border-radius: 4px;">${p.category || 'عام'}</b> | 
                                    الوحدة: <b style="color: #a7f3d0; background: rgba(0,0,0,0.2); padding: 1px 6px; border-radius: 4px;">${p.unit || 'قطعة'}</b>
                                </div>
                            </div>
                        </div>

                        <!-- شريط البحث السريع باللون الأبيض عالي التباين مع دعم الكيبورد -->
                        <div style="position: relative; width: 280px; max-width: 42%;">
                            <input type="text" id="inquiryLiveSearch" placeholder="🔍 تبديل صنف (بحث/سكانر)..."
                                style="width: 100%; height: 38px; border-radius: 10px; border: 2px solid #34d399; background: #ffffff; color: #0f172a; padding: 0 12px; font-size: 0.9rem; font-weight: 800; outline: none; box-sizing: border-box; box-shadow: 0 2px 8px rgba(0,0,0,0.15);"
                                oninput="window.handleInquiryLiveSearch(this.value)"
                                onkeydown="window.handleInquirySearchKeyDown(event)"
                                autocomplete="off">
                            <div id="inquirySearchDropdown" style="position: absolute; top: 44px; right: 0; left: 0; background: #ffffff; border: 2px solid #10b981; border-radius: 12px; max-height: 240px; overflow-y: auto; z-index: 100; display: none; box-shadow: 0 12px 30px rgba(0,0,0,0.3);" class="fast-scrollbar"></div>
                        </div>

                        <!-- زر الإغلاق الأبيض الأنيق -->
                        <button onclick="window.closeFastItemInquiryModal()" style="background: rgba(255, 255, 255, 0.2); color: #ffffff; border: 1.5px solid rgba(255, 255, 255, 0.4); border-radius: 10px; width: 36px; height: 36px; font-size: 1.2rem; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold; transition: 0.2s;"
                            onmouseover="this.style.background='#ef4444'; this.style.borderColor='#ef4444';" onmouseout="this.style.background='rgba(255, 255, 255, 0.2)'; this.style.borderColor='rgba(255, 255, 255, 0.4)';">✕</button>
                    </div>

                    <!-- التبويبات الثلاثة عالية التباين والوضوح -->
                    <div style="display: flex; gap: 10px; margin-top: 4px;">
                        <button type="button" onclick="window.setInquiryTab('general')"
                            style="padding: 7px 22px; border-radius: 10px; font-weight: 900; font-size: 0.92rem; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 7px; ${currentInquiryTab === 'general' ? 'background: #ffffff; color: #064e3b; box-shadow: 0 4px 12px rgba(0,0,0,0.25); border: 2px solid #34d399;' : 'background: rgba(255,255,255,0.18); color: #ffffff; border: 1.5px solid rgba(255,255,255,0.3);'}">
                            <span>🏢</span> عام والأرصدة
                        </button>
                        <button type="button" onclick="window.setInquiryTab('history')"
                            style="padding: 7px 22px; border-radius: 10px; font-weight: 900; font-size: 0.92rem; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 7px; ${currentInquiryTab === 'history' ? 'background: #ffffff; color: #064e3b; box-shadow: 0 4px 12px rgba(0,0,0,0.25); border: 2px solid #34d399;' : 'background: rgba(255,255,255,0.18); color: #ffffff; border: 1.5px solid rgba(255,255,255,0.3);'}">
                            <span>📜</span> حركة الصنف
                        </button>
                        <button type="button" onclick="window.setInquiryTab('specs')"
                            style="padding: 7px 22px; border-radius: 10px; font-weight: 900; font-size: 0.92rem; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 7px; ${currentInquiryTab === 'specs' ? 'background: #ffffff; color: #064e3b; box-shadow: 0 4px 12px rgba(0,0,0,0.25); border: 2px solid #34d399;' : 'background: rgba(255,255,255,0.18); color: #ffffff; border: 1.5px solid rgba(255,255,255,0.3);'}">
                            <span>📋</span> مواصفات
                        </button>
                    </div>
                </div>

                <!-- 2. محتوى التبويب النشط -->
                <div style="flex: 1; min-height: 380px; max-height: calc(92vh - 170px); overflow-y: auto; overflow-x: hidden; padding: 16px 20px;" class="fast-scrollbar">
                    ${getInquiryTabContent(p, variants, allSizes, allColors)}
                </div>

                <!-- 3. الفوتر وأزرار التحكم -->
                <div style="background: #ffffff; padding: 12px 20px; border-top: 1.5px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                    <div style="display: flex; gap: 10px;">
                        <button type="button" onclick="window.addInquiryProductToCart()"
                            style="padding: 10px 24px; border-radius: 10px; border: none; background: linear-gradient(135deg, #10b981, #059669); color: white; font-weight: 900; font-size: 0.95rem; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(16,185,129,0.3); transition: 0.2s;"
                            onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='none'">
                            <span>🛒</span> إضافة للفاتورة الحالية
                        </button>
                        ${canUserEditProducts() ? `
                            <button type="button" onclick="window.editInquiryProduct()"
                                style="padding: 10px 20px; border-radius: 10px; border: 1.5px solid #cbd5e1; background: #f8fafc; color: #334155; font-weight: 800; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: 0.2s;"
                                onmouseover="this.style.borderColor='#059669'; this.style.color='#047857';" onmouseout="this.style.borderColor='#cbd5e1'; this.style.color='#334155';">
                                <span>✏️</span> تعديل بيانات الصنف
                            </button>
                        ` : ''}
                    </div>

                    <button type="button" onclick="window.closeFastItemInquiryModal()"
                        style="padding: 10px 24px; border-radius: 10px; border: 1.5px solid #cbd5e1; background: #ffffff; color: #64748b; font-weight: 800; font-size: 0.9rem; cursor: pointer; transition: 0.2s;">
                        إغلاق ✕
                    </button>
                </div>

            </div>
        `;

        modal.style.display = 'flex';
    }

    /**
     * تجهيز محتوى التبويبات المختلفة
     */
    function getInquiryTabContent(p, variants, allSizes, allColors) {
        if (currentInquiryTab === 'history') {
            return renderHistoryTabContent(p);
        } else if (currentInquiryTab === 'specs') {
            return renderSpecsTabContent(p);
        } else {
            return renderGeneralTabContent(p, variants, allSizes, allColors);
        }
    }

    /**
     * محتوى تبويب [ عام والأرصدة ] (مطابق للصورة 3)
     */
    function renderGeneralTabContent(p, variants, allSizes, allColors) {
        const currentUserWh = ((typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : ((window.currentUser && window.currentUser.warehouseName) ? window.currentUser.warehouseName : 'المخزن الرئيسي')).trim();

        // قائمة المخازن (الاعتماد على إعدادات النظام لجلب كافة المخازن حتى وإن كان رصيدها صفراً)
        let whList = [];
        if (typeof warehouses !== 'undefined' && Array.isArray(warehouses) && warehouses.length > 0) {
            whList = warehouses.map(w => w.name);
        } else if (window.warehouses && Array.isArray(window.warehouses) && window.warehouses.length > 0) {
            whList = window.warehouses.map(w => w.name);
        } else if (typeof getStore === 'function' && getStore('pos_warehouses')) {
            try {
                const storedWh = JSON.parse(getStore('pos_warehouses'));
                if (Array.isArray(storedWh)) whList = storedWh.map(w => w.name);
            } catch(e) {}
        }
        if (whList.length === 0) {
            if (p.warehouseStocks) Object.keys(p.warehouseStocks).forEach(k => { if (!whList.includes(k)) whList.push(k); });
            if (variants && variants.length > 0) {
                variants.forEach(v => {
                    if (v.warehouseStocks) Object.keys(v.warehouseStocks).forEach(k => { if (!whList.includes(k)) whList.push(k); });
                });
            }
        }
        if (!whList.includes('المخزن الرئيسي')) whList.unshift('المخزن الرئيسي');

        const hasVariants = variants && variants.length > 0;

        // تصفية التشكيلات حسب المقاس واللون المختار (مرفوعة لتشمل أرصدة الفروع والجدول التفصيلي)
        let matchedVars = variants || [];
        if (hasVariants) {
            matchedVars = variants.filter(v => 
                (selectedInquirySize === 'all' || String(v.size || '').trim() === selectedInquirySize) &&
                (selectedInquiryColor === 'all' || String(v.color || '').trim() === selectedInquiryColor)
            );
        }

        // 🛒 فحص الكميات المحجوزة بالفعل داخل سلة البيع الحالية
        const cartItemsForProduct = (typeof cart !== 'undefined' && Array.isArray(cart))
            ? cart.filter(item => (item.id === p.id || item.productId === p.id || item.name === p.name))
            : [];
        const totalInCartForProduct = cartItemsForProduct.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0);

        // تجميع أرصدة كل مخزن مع مراعاة فلتر المقاس واللون
        let whRowsData = [];
        let grandTotalStock = 0;

        whList.forEach(whName => {
            let availQty = 0;
            if (hasVariants) {
                matchedVars.forEach(v => {
                    let st = 0;
                    if (v.warehouseStocks && typeof v.warehouseStocks === 'object' && v.warehouseStocks[whName] !== undefined) {
                        st = parseFloat(v.warehouseStocks[whName]) || 0;
                    } else if (whName === 'المخزن الرئيسي' || !v.warehouseStocks) {
                        st = parseFloat(v.stock) || 0;
                    }
                    availQty += st;
                });
            } else {
                if (typeof getWarehouseStock === 'function') {
                    availQty = getWarehouseStock(p.name, whName);
                } else if (p.warehouseStocks && p.warehouseStocks[whName] !== undefined) {
                    availQty = parseFloat(p.warehouseStocks[whName]) || 0;
                } else if (whName === 'المخزن الرئيسي' || !p.warehouseStocks) {
                    availQty = parseFloat(p.stock) || 0;
                }
            }

            grandTotalStock += availQty;
            const isCurrentWh = whName === currentUserWh;
            whRowsData.push({
                warehouse: whName,
                qty: availQty,
                reservedQty: isCurrentWh ? totalInCartForProduct : 0
            });
        });

        // 🌟 الترتيب التنازلي الحاسم: المخزن صاحب أعلى كمية يظهر في البداية
        whRowsData.sort((a, b) => b.qty - a.qty);

        // بناء صفوف جدول المخازن
        const whTableRowsHtml = whRowsData.map((row, idx) => {
            const hasPositiveStock = row.qty > 0;
            const bgBadge = hasPositiveStock ? '#ecfdf5' : '#f8fafc';
            const colorBadge = hasPositiveStock ? '#047857' : '#94a3b8';
            const borderBadge = hasPositiveStock ? '#a7f3d0' : '#e2e8f0';
            const hasReserved = row.reservedQty > 0;

            return `
                <tr style="border-bottom: 1px solid #f1f5f9; ${idx % 2 === 1 ? 'background: #fafafa;' : ''}">
                    <td style="padding: 10px 12px; font-weight: 800; color: #64748b; text-align: center;">${idx + 1}</td>
                    <td style="padding: 10px 14px; font-weight: 900; color: #1e293b; text-align: right;">
                        🏢 ${row.warehouse}
                    </td>
                    <td style="padding: 10px 12px; text-align: center; font-weight: 900; font-size: 1.05rem;">
                        <span style="background: ${bgBadge}; color: ${colorBadge}; border: 1.5px solid ${borderBadge}; padding: 3px 14px; border-radius: 8px; display: inline-block; min-width: 60px;">
                            ${row.qty.toFixed(2).replace(/\.00$/, '')} ${p.unit || 'قطعة'}
                        </span>
                    </td>
                    <td style="padding: 10px 12px; text-align: center; font-weight: 800;">
                        ${hasReserved 
                            ? `<span style="background: #fffbeb; color: #b45309; border: 1px solid #fde68a; padding: 2px 10px; border-radius: 8px; font-weight: 900; display: inline-block;">🛒 ${row.reservedQty.toFixed(2).replace(/\.00$/, '')}</span>` 
                            : `<span style="color: #94a3b8;">0</span>`}
                    </td>
                </tr>
            `;
        }).join('');

        // أسعار الصنف
        const retailPrice = parseFloat(p.price || p.salePrice || 0);
        const wholesalePrice = parseFloat(p.wholesalePrice || p.wholesale_price || retailPrice);
        const halfWholesalePrice = parseFloat(p.halfWholesalePrice || p.half_wholesale_price || retailPrice);
        const costPrice = parseFloat(p.costPrice || p.cost || p.purchasePrice || 0);
        const avgPurchasePrice = parseFloat(p.avgPurchasePrice || p.averageCost || costPrice);
        const lastPurchasePrice = parseFloat(p.lastPurchasePrice || costPrice);

        // شريط فلاتر المقاس واللون
        let filterSectionHtml = '';
        if (hasVariants && (allSizes.length > 0 || allColors.length > 0)) {
            const sizeOptions = allSizes.map(s => `<option value="${s}" ${selectedInquirySize === s ? 'selected' : ''}>مقاس: ${s}</option>`).join('');
            const colorOptions = allColors.map(c => `<option value="${c}" ${selectedInquiryColor === c ? 'selected' : ''}>لون: ${c}</option>`).join('');

            filterSectionHtml = `
                <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 10px 15px; margin-bottom: 15px; display: flex; align-items: center; gap: 15px; flex-wrap: wrap; box-shadow: 0 2px 6px rgba(0,0,0,0.02);">
                    <span style="font-weight: 900; color: #0f172a; font-size: 0.9rem; display: flex; align-items: center; gap: 6px;">
                        <span>👗</span> فلترة الأرصدة:
                    </span>
                    
                    ${allSizes.length > 0 ? `
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <label style="font-weight: 800; font-size: 0.82rem; color: #047857;">المقاس:</label>
                        <select onchange="window.setInquiryVariantFilter('size', this.value)"
                            style="padding: 6px 12px; border-radius: 8px; border: 1.5px solid #a7f3d0; background: #ecfdf5; color: #047857; font-weight: 900; font-size: 0.85rem; outline: none; cursor: pointer;">
                            <option value="all" ${selectedInquirySize === 'all' ? 'selected' : ''}>كل المقاسات (${allSizes.length})</option>
                            ${sizeOptions}
                        </select>
                    </div>
                    ` : ''}

                    ${allColors.length > 0 ? `
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <label style="font-weight: 800; font-size: 0.82rem; color: #1d4ed8;">اللون:</label>
                        <select onchange="window.setInquiryVariantFilter('color', this.value)"
                            style="padding: 6px 12px; border-radius: 8px; border: 1.5px solid #bfdbfe; background: #eff6ff; color: #1d4ed8; font-weight: 900; font-size: 0.85rem; outline: none; cursor: pointer;">
                            <option value="all" ${selectedInquiryColor === 'all' ? 'selected' : ''}>كل الألوان (${allColors.length})</option>
                            ${colorOptions}
                        </select>
                    </div>
                    ` : ''}

                    ${(selectedInquirySize !== 'all' || selectedInquiryColor !== 'all') ? `
                        <button onclick="window.setInquiryVariantFilter('reset')"
                            style="background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; padding: 5px 12px; border-radius: 6px; font-weight: bold; font-size: 0.78rem; cursor: pointer;">
                            ✕ إظهار الكل
                        </button>
                    ` : ''}
                </div>
            `;
        }

        let variantsTableHtml = '';
        if (hasVariants) {
            const mainStoreName = 'المخزن الرئيسي';
            const branches = whList.filter(w => w !== mainStoreName);
            const showCost = shouldShowInquiryCostsAndWholesale();
            
            let thHtml = `
                <tr>
                    <th style="padding: 8px 6px; width: 35px; text-align: center;">#</th>
                    ${allSizes.length > 0 ? `<th style="padding: 8px 6px; text-align: center;">المقاس</th>` : ''}
                    ${allColors.length > 0 ? `<th style="padding: 8px 6px; text-align: center;">اللون</th>` : ''}
                    <th style="padding: 8px 6px; text-align: center; background: rgba(0,0,0,0.03);">${mainStoreName}</th>
            `;
            branches.forEach(b => {
                thHtml += `<th style="padding: 8px 6px; text-align: center; background: rgba(0,0,0,0.02);">${b}</th>`;
            });
            thHtml += `
                    <th style="padding: 8px 6px; text-align: center; background: #e0f2fe; color: #0369a1;">إجمالي الفروع</th>
                    <th style="padding: 8px 6px; text-align: center; background: #f0fdf4; color: #166534;">الرصيد الكلي</th>
                    <th style="padding: 8px 6px; text-align: center;">سعر القطاعي</th>
                    ${showCost ? `<th style="padding: 8px 6px; text-align: center;">سعر الجملة</th>` : ''}
                    <th style="padding: 8px 6px; text-align: center;">الباركود الفريد</th>
                    <th style="padding: 8px 6px; text-align: center; width: 75px;">إضافة</th>
                </tr>
            `;

            const trsHtml = matchedVars.map((v, idx) => {
                let mainStock = 0;
                let branchesStockTotal = 0;
                let totalStock = 0;
                let branchesCells = '';
                
                if (v.warehouseStocks && typeof v.warehouseStocks === 'object') {
                    mainStock = parseFloat(v.warehouseStocks[mainStoreName]) || 0;
                    branches.forEach(b => {
                        const bStock = parseFloat(v.warehouseStocks[b]) || 0;
                        branchesStockTotal += bStock;
                        const isCurrent = b === currentUserWh;
                        const cellBg = isCurrent ? '#fef08a' : (bStock > 0 ? '#f8fafc' : '#ffffff');
                        branchesCells += `<td style="padding: 6px; text-align: center; font-weight: 800; background: ${cellBg}; color: ${bStock > 0 ? '#0f766e' : '#94a3b8'};">${bStock > 0 ? bStock : '-'}</td>`;
                    });
                    totalStock = mainStock + branchesStockTotal;
                } else {
                    totalStock = parseFloat(v.stock !== undefined ? v.stock : 0);
                    mainStock = totalStock; 
                    branches.forEach(b => {
                        const isCurrent = b === currentUserWh;
                        branchesCells += `<td style="padding: 6px; text-align: center; font-weight: 800; color: #94a3b8; background: ${isCurrent ? '#fef08a' : '#ffffff'};">-</td>`;
                    });
                }

                const formatStockBadge = (qty) => {
                    if (qty <= 0) return `<span style="background: #fee2e2; color: #ef4444; padding: 2px 6px; border-radius: 8px; font-weight: 900; font-size: 0.8rem;">0</span>`;
                    return `<span style="background: #dcfce7; color: #15803d; padding: 2px 6px; border-radius: 8px; font-weight: 900; font-size: 0.85rem;">${qty}</span>`;
                };

                const mainIsCurrent = mainStoreName === currentUserWh;
                
                const safeSize = (v.size || 'قياسي').replace(/'/g, "\\'");
                const safeColor = (v.color || 'موحد').replace(/'/g, "\\'");

                // حساب الكمية المحجوزة في السلة لهذا المقاس واللون تحديداً
                const vInCart = cartItemsForProduct
                    .filter(item => {
                        const itemSize = item.selectedVariant ? item.selectedVariant.size : (item.selectedSize || '');
                        const itemColor = item.selectedVariant ? item.selectedVariant.color : (item.selectedColor || '');
                        const cleanVSize = (v.size === 'قياسي') ? '' : (v.size || '');
                        const cleanVColor = (v.color === 'موحد') ? '' : (v.color || '');
                        const sizeOk = !cleanVSize || itemSize === cleanVSize;
                        const colorOk = !cleanVColor || itemColor === cleanVColor;
                        return sizeOk && colorOk;
                    })
                    .reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0);

                const vInCartBadge = (vInCart > 0 && mainIsCurrent)
                    ? `<div style="font-size: 0.72rem; color: #b45309; font-weight: 800; margin-top: 2px;">(بالسلة: ${vInCart})</div>`
                    : '';
                
                // حساب أسعار وباركود التشكيلة
                const vRetail = parseFloat(v.price !== undefined ? v.price : retailPrice) || 0;
                const vWs = parseFloat(v.wholesale !== undefined ? v.wholesale : wholesalePrice) || 0;
                const vBarcode = v.barcode || '---';

                const actualVariantIndex = (p.variants && Array.isArray(p.variants)) ? p.variants.indexOf(v) : -1;
                let addBtn = '';
                if (totalStock > 0 || (v.allowOversell)) {
                    addBtn = `<button onclick="window.addInquiryVariantByIndex(${actualVariantIndex})" style="background: #10b981; color: white; border: none; border-radius: 6px; padding: 4px 10px; cursor: pointer; font-size: 0.82rem; font-weight: bold; box-shadow: 0 2px 6px rgba(16,185,129,0.3); transition: 0.2s;" onmouseover="this.style.background='#059669'" onmouseout="this.style.background='#10b981'">➕ سلة</button>`;
                } else {
                    addBtn = `<button disabled style="background: #e2e8f0; color: #94a3b8; border: none; border-radius: 6px; padding: 4px 10px; font-size: 0.82rem; font-weight: bold; cursor: not-allowed;">نفذ</button>`;
                }

                return `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 6px; text-align: center; color: #64748b; font-weight: bold;">${idx + 1}</td>
                        ${allSizes.length > 0 ? `<td style="padding: 6px; text-align: center; font-weight: 900; color: #047857;"><span style="background: #ecfdf5; border: 1px solid #a7f3d0; padding: 1px 6px; border-radius: 6px;">${v.size || 'قياسي'}</span></td>` : ''}
                        ${allColors.length > 0 ? `<td style="padding: 6px; text-align: center; font-weight: 900; color: #1d4ed8;"><span style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 1px 6px; border-radius: 6px;">${v.color || 'موحد'}</span></td>` : ''}
                        <td style="padding: 6px; text-align: center; background: ${mainIsCurrent ? '#fef08a' : 'rgba(0,0,0,0.02)'};">${formatStockBadge(mainStock)}${vInCartBadge}</td>
                        ${branchesCells}
                        <td style="padding: 6px; text-align: center; font-weight: 900; color: #0369a1; background: #f0f9ff;">${branchesStockTotal > 0 ? branchesStockTotal : '-'}</td>
                        <td style="padding: 6px; text-align: center; background: #f0fdf4;">${formatStockBadge(totalStock)}</td>
                        <td style="padding: 6px; text-align: center; font-weight: bold; color: #15803d;">${vRetail.toFixed(2)}</td>
                        ${showCost ? `<td style="padding: 6px; text-align: center; font-weight: bold; color: #1d4ed8;">${vWs.toFixed(2)}</td>` : ''}
                        <td style="padding: 6px; text-align: center; font-size: 0.8rem; font-family: monospace; color: #475569;">${vBarcode}</td>
                        <td style="padding: 6px; text-align: center;">${addBtn}</td>
                    </tr>
                `;
            }).join('');

            variantsTableHtml = `
                <!-- 1.5 جدول التشكيلات التفصيلي للفاشون -->
                <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                    <div style="background: linear-gradient(135deg, #f1f5f9, #e2e8f0); padding: 10px 16px; border-bottom: 1.5px solid #cbd5e1; display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: 900; color: #0f172a; font-size: 0.95rem; display: flex; align-items: center; gap: 6px;">
                            <span>👕</span> تفاصيل الأرصدة ${matchedVars.length !== variants.length ? '(المفلترة)' : ''} للمقاسات والألوان (المخزن الحالي مميز بالأصفر)
                        </span>
                    </div>
                    <div style="max-height: 260px; overflow-y: auto; overflow-x: auto;" class="fast-scrollbar">
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; min-width: 650px; white-space: nowrap;">
                            <thead style="background: #f8fafc; color: #475569; position: sticky; top: 0; z-index: 2; border-bottom: 1px solid #e2e8f0; font-size: 0.85rem;">
                                ${thHtml}
                            </thead>
                            <tbody>
                                ${trsHtml}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }

        return `
            ${filterSectionHtml}

            <div style="display: grid; grid-template-columns: minmax(0, 1fr) 260px; gap: 16px; align-items: start; width: 100%; box-sizing: border-box;">
                
                <!-- العمود الأيمن: جدول كمية الصنف في المخازن وبلوكات الأسعار -->
                <div style="display: flex; flex-direction: column; gap: 16px; min-width: 0; width: 100%; box-sizing: border-box;">
                    
                    <!-- 1. جدول كمية الصنف في المخازن (مطابق للصورة 3) -->
                    <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                        <div style="background: linear-gradient(135deg, #f1f5f9, #e2e8f0); padding: 10px 16px; border-bottom: 1.5px solid #cbd5e1; display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-weight: 900; color: #0f172a; font-size: 0.95rem; display: flex; align-items: center; gap: 6px;">
                                <span>🏢</span> كمية الصنف في المخازن (مرتبة بالأعلى رصيداً)
                            </span>
                            <span style="background: #0f172a; color: #fbbf24; padding: 2px 10px; border-radius: 6px; font-weight: 900; font-size: 0.8rem;">
                                إجمالي كل الفروع: ${grandTotalStock.toFixed(2).replace(/\.00$/, '')} ${p.unit || 'قطعة'}
                            </span>
                        </div>

                        <div style="max-height: 220px; overflow-y: auto;" class="fast-scrollbar">
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                                <thead style="background: #f8fafc; color: #475569; position: sticky; top: 0; z-index: 2; border-bottom: 1px solid #e2e8f0;">
                                    <tr>
                                        <th style="padding: 8px 12px; width: 40px; text-align: center;">م</th>
                                        <th style="padding: 8px 14px; text-align: right;">المخزن / الفرع</th>
                                        <th style="padding: 8px 12px; text-align: center; width: 140px;">الكمية المتاحة</th>
                                        <th style="padding: 8px 12px; text-align: center; width: 100px;">كمية حجز</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${whTableRowsHtml}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    ${variantsTableHtml}
                    <!-- 2. بلوك وشبكة أسعار البيع وتكاليف الشراء (مع حماية الخصوصية) -->
                    <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                        <div style="font-weight: 900; color: #0f172a; font-size: 0.88rem; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;">
                            <span style="display: flex; align-items: center; gap: 6px;">
                                <span>💰</span> ${shouldShowInquiryCostsAndWholesale() ? 'أسعار البيع والتكلفة الحالية:' : 'سعر البيع المعتمد:'}
                            </span>
                            ${!shouldShowInquiryCostsAndWholesale() ? `
                                <span style="background: #f1f5f9; color: #64748b; font-size: 0.72rem; font-weight: 800; padding: 2px 8px; border-radius: 6px; border: 1px solid #e2e8f0;">
                                    🔒 أسعار الجملة والتكلفة محمية
                                </span>
                            ` : ''}
                        </div>

                        ${shouldShowInquiryCostsAndWholesale() ? `
                            <!-- الصف الأول: أسعار البيع بالكامل -->
                            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                                <div style="background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 10px; padding: 8px 12px; text-align: center;">
                                    <div style="font-size: 0.78rem; font-weight: 800; color: #15803d;">بيع القطاعي</div>
                                    <div style="font-size: 1.15rem; font-weight: 900; color: #166534; font-family: monospace; margin-top: 2px;">
                                        ${retailPrice.toFixed(2)}
                                    </div>
                                </div>
                                <div style="background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 10px; padding: 8px 12px; text-align: center;">
                                    <div style="font-size: 0.78rem; font-weight: 800; color: #1d4ed8;">بيع جملة</div>
                                    <div style="font-size: 1.15rem; font-weight: 900; color: #1e40af; font-family: monospace; margin-top: 2px;">
                                        ${wholesalePrice.toFixed(2)}
                                    </div>
                                </div>
                                <div style="background: #faf5ff; border: 1.5px solid #e9d5ff; border-radius: 10px; padding: 8px 12px; text-align: center;">
                                    <div style="font-size: 0.78rem; font-weight: 800; color: #7e22ce;">نصف جملة</div>
                                    <div style="font-size: 1.15rem; font-weight: 900; color: #6b21a8; font-family: monospace; margin-top: 2px;">
                                        ${halfWholesalePrice.toFixed(2)}
                                    </div>
                                </div>
                            </div>

                            <!-- الصف الثاني: أسعار وتكاليف الشراء -->
                            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
                                <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 8px 12px; text-align: center;">
                                    <div style="font-size: 0.75rem; font-weight: 800; color: #475569;">متوسط سعر الشراء</div>
                                    <div style="font-size: 1.05rem; font-weight: 900; color: #0f172a; font-family: monospace; margin-top: 2px;">
                                        ${avgPurchasePrice.toFixed(2)}
                                    </div>
                                </div>
                                <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 8px 12px; text-align: center;">
                                    <div style="font-size: 0.75rem; font-weight: 800; color: #475569;">آخر سعر شراء</div>
                                    <div style="font-size: 1.05rem; font-weight: 900; color: #0f172a; font-family: monospace; margin-top: 2px;">
                                        ${lastPurchasePrice.toFixed(2)}
                                    </div>
                                </div>
                                <div style="background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 10px; padding: 8px 12px; text-align: center;">
                                    <div style="font-size: 0.75rem; font-weight: 800; color: #b91c1c;">آخر سعر شراء صافي</div>
                                    <div style="font-size: 1.05rem; font-weight: 900; color: #991b1b; font-family: monospace; margin-top: 2px;">
                                        ${costPrice.toFixed(2)}
                                    </div>
                                </div>
                            </div>
                        ` : `
                            <!-- كارت سعر القطاعي الوحيد الفاخر والمحمي عند إخفاء التكلفة -->
                            <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 2px solid #86efac; border-radius: 12px; padding: 12px 18px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 8px rgba(16,185,129,0.1);">
                                <div>
                                    <div style="font-size: 0.85rem; font-weight: 900; color: #166534; display: flex; align-items: center; gap: 6px;">
                                        <span>🏷️</span> سعر بيع المستهلك (قطاعي):
                                    </div>
                                    <div style="font-size: 0.75rem; color: #15803d; font-weight: 700; margin-top: 2px;">السعر الرسمي المعتمد للفاتورة</div>
                                </div>
                                <div style="font-size: 1.6rem; font-weight: 900; color: #14532d; font-family: monospace;">
                                    ${retailPrice.toFixed(2)} <span style="font-size: 0.9rem; font-family: 'Cairo';">ج.م</span>
                                </div>
                            </div>
                        `}

                    </div>

                </div>

                <!-- العمود الأيسر: صورة الموديل والكارت الجانبي (مطابق للصورة 3) -->
                <div style="display: flex; flex-direction: column; gap: 14px; width: 260px; flex-shrink: 0; box-sizing: border-box;">
                    
                    <!-- كارت صورة الموديل -->
                    <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 14px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.03); width: 100%; box-sizing: border-box;">
                        <div style="font-weight: 900; font-size: 0.85rem; color: #0f172a; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; gap: 6px;">
                            <span>📸</span> صورة الموديل / الصنف
                        </div>
                        <div style="height: 190px; background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative; padding: 4px; box-sizing: border-box;">
                            ${p.image ? `
                                <img src="${p.image}" alt="${p.name}" style="max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain; border-radius: 8px;">
                            ` : `
                                <div style="display: flex; flex-direction: column; align-items: center; color: #94a3b8;">
                                    <span style="font-size: 3.5rem;">👗</span>
                                    <span style="font-size: 0.78rem; font-weight: bold; margin-top: 4px;">لا توجد صورة مسجلة</span>
                                </div>
                            `}
                        </div>
                    </div>

                    <!-- كارت ملخص تشكيلات الفاشون السريع -->
                    <div style="background: linear-gradient(135deg, #1e293b, #0f172a); color: white; border-radius: 14px; padding: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                        <div style="font-size: 0.82rem; font-weight: 800; color: #fbbf24; margin-bottom: 8px;">
                            ✨ ملخص التشكيلات (Variants):
                        </div>
                        <div style="font-size: 0.84rem; color: #cbd5e1; line-height: 1.6;">
                            <div>• المقاسات: <b style="color: #34d399;">${allSizes.length > 0 ? allSizes.join(' | ') : 'عام'}</b></div>
                            <div>• الألوان: <b style="color: #60a5fa;">${allColors.length > 0 ? allColors.join(' | ') : 'عام'}</b></div>
                            <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.1); color: #fbbf24; font-weight: 900;">
                                إجمالي التشكيلات: ${variants.length} تشكيلة
                            </div>
                        </div>
                    </div>

                </div>

            </div>
        `;
    }
    /**
     * محتوى تبويب [ حركة الصنف ] (مطابق للصورة 1)
     */
    function renderHistoryTabContent(p) {
        const allTx = (typeof transactions !== 'undefined' && Array.isArray(transactions))
            ? transactions.filter(t => t.product === p.name || t.productName === p.name || t.id == p.id || t.productId == p.id)
            : [];

        if (allTx.length === 0) {
            return `
                <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 40px; text-align: center; color: #64748b;">
                    <div style="font-size: 3rem; margin-bottom: 10px;">📜</div>
                    <h4 style="margin: 0 0 6px; color: #0f172a; font-weight: 900;">لا توجد حركات مسجلة لهذا الصنف حتى الآن</h4>
                    <p style="margin: 0; font-size: 0.88rem;">ستظهر هنا كافة عمليات البيع، الشراء، التحويل المخزني، والتسويات فور إجرائها.</p>
                </div>
            `;
        }

        // 🌟 الترتيب التنازلي الحاسم: من الأحدث إلى الأقدم مع حصر أحدث 50 حركة لحماية أداء وسرعة المتصفح
        allTx.sort((a, b) => {
            const timeA = new Date(a.dateISO || a.date || 0).getTime();
            const timeB = new Date(b.dateISO || b.date || 0).getTime();
            return timeB - timeA;
        });

        const pTx = allTx.slice(0, 50);

        const rowsHtml = pTx.map((tx, idx) => {
            const rawType = String(tx.type || '').toLowerCase();
            let typeLabel = 'بيع';
            let typeBg = '#ecfdf5';
            let typeColor = '#047857';

            if (rawType.includes('شراء') || rawType.includes('purchase')) {
                typeLabel = 'شراء';
                typeBg = '#eff6ff';
                typeColor = '#1d4ed8';
            } else if (rawType.includes('مرتجع') || rawType.includes('return')) {
                typeLabel = 'مرتجع';
                typeBg = '#fff7ed';
                typeColor = '#c2410c';
            } else if (rawType.includes('تحويل') || rawType.includes('transfer')) {
                typeLabel = 'تحويل مخزن';
                typeBg = '#faf5ff';
                typeColor = '#7e22ce';
            } else if (rawType.includes('تسوية') || rawType.includes('adjustment')) {
                typeLabel = 'تسوية مخزن';
                typeBg = '#fefce8';
                typeColor = '#a16207';
            }

            const qty = parseFloat(tx.qty || tx.quantity || 0);
            const price = parseFloat(tx.price || 0);
            const total = parseFloat(tx.total != null ? tx.total : (qty * price));
            const partner = tx.customer || tx.partner || tx.supplier || tx.client || '-';
            const sSize = tx.size || tx.selectedSize || '-';
            const sColor = tx.color || tx.selectedColor || '-';

            const isPurchase = rawType.includes('شراء') || rawType.includes('purchase');
            const canViewCost = shouldShowInquiryCostsAndWholesale();
            const displayPrice = (isPurchase && !canViewCost)
                ? `<span style="color: #94a3b8; font-size: 0.75rem; font-weight: 800;">🔒 محجوب</span>`
                : price.toFixed(2);
            const displayTotal = (isPurchase && !canViewCost)
                ? `<span style="color: #94a3b8; font-size: 0.75rem; font-weight: 800;">🔒 محجوب</span>`
                : total.toFixed(2);

            return `
                <tr style="border-bottom: 1px solid #f1f5f9; ${idx % 2 === 1 ? 'background: #fafafa;' : ''}">
                    <td style="padding: 8px 10px; font-weight: 800; text-align: center; color: #64748b;">${idx + 1}</td>
                    <td style="padding: 8px 12px; font-weight: 800; color: #334155; font-size: 0.82rem; white-space: nowrap;">
                        ${tx.date || tx.dateISO || '-'}
                    </td>
                    <td style="padding: 8px 10px; text-align: center;">
                        <span style="background: ${typeBg}; color: ${typeColor}; padding: 2px 8px; border-radius: 6px; font-weight: 900; font-size: 0.78rem;">
                            ${typeLabel}
                        </span>
                    </td>
                    <td style="padding: 8px 10px; text-align: center; font-weight: 800; color: #047857;">${sSize}</td>
                    <td style="padding: 8px 10px; text-align: center; font-weight: 800; color: #1d4ed8;">${sColor}</td>
                    <td style="padding: 8px 10px; text-align: center; font-weight: 900; color: #0f172a;">${qty}</td>
                    <td style="padding: 8px 10px; text-align: center; color: #64748b; font-size: 0.82rem;">${tx.unit || p.unit || 'قطعة'}</td>
                    <td style="padding: 8px 10px; text-align: center; font-weight: 800; font-family: monospace;">${displayPrice}</td>
                    <td style="padding: 8px 10px; text-align: center; color: #dc2626; font-weight: 800;">${parseFloat(tx.discount || 0).toFixed(2)}</td>
                    <td style="padding: 8px 12px; text-align: center; font-weight: 900; color: #047857; font-family: monospace;">${displayTotal}</td>
                    <td style="padding: 8px 14px; text-align: right; font-weight: 800; color: #1e293b;">${partner}</td>
                </tr>
            `;
        }).join('');

        return `
            <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                <div style="background: linear-gradient(135deg, #f1f5f9, #e2e8f0); padding: 10px 16px; border-bottom: 1.5px solid #cbd5e1; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: 900; color: #0f172a; font-size: 0.95rem; display: flex; align-items: center; gap: 6px;">
                        <span>📜</span> سجل حركة الصنف التفصيلية (أحدث ${pTx.length} حركة ${allTx.length > 50 ? `من إجمالي ${allTx.length}` : ''})
                    </span>
                </div>

                <div style="max-height: 380px; overflow-y: auto;" class="fast-scrollbar">
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.88rem;">
                        <thead style="background: #f8fafc; color: #475569; position: sticky; top: 0; z-index: 2; border-bottom: 1.5px solid #cbd5e1;">
                            <tr>
                                <th style="padding: 8px 10px; text-align: center;">م</th>
                                <th style="padding: 8px 12px; text-align: right;">التاريخ</th>
                                <th style="padding: 8px 10px; text-align: center;">الحركة</th>
                                <th style="padding: 8px 10px; text-align: center;">المقاس</th>
                                <th style="padding: 8px 10px; text-align: center;">اللون</th>
                                <th style="padding: 8px 10px; text-align: center;">الكمية</th>
                                <th style="padding: 8px 10px; text-align: center;">الوحدة</th>
                                <th style="padding: 8px 10px; text-align: center;">السعر</th>
                                <th style="padding: 8px 10px; text-align: center;">الخصم</th>
                                <th style="padding: 8px 12px; text-align: center;">الإجمالي</th>
                                <th style="padding: 8px 14px; text-align: right;">الحساب / الطرف الثاني</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    /**
     * محتوى تبويب [ مواصفات ]
     */
    function renderSpecsTabContent(p) {
        return `
            <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 22px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                <h4 style="margin: 0 0 16px; color: #0f172a; font-weight: 900; font-size: 1.05rem; display: flex; align-items: center; gap: 8px;">
                    <span>📋</span> المواصفات والبيانات الأساسية للصنف
                </h4>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px;">
                        <span style="font-size: 0.8rem; color: #64748b; font-weight: 800;">اسم الصنف التجاري:</span>
                        <div style="font-size: 1rem; font-weight: 900; color: #0f172a; margin-top: 4px;">${p.name}</div>
                    </div>

                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px;">
                        <span style="font-size: 0.8rem; color: #64748b; font-weight: 800;">كود الصنف الداخلي:</span>
                        <div style="font-size: 1rem; font-weight: 900; color: #2563eb; font-family: monospace; margin-top: 4px;">${p.code || p.id}</div>
                    </div>

                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px;">
                        <span style="font-size: 0.8rem; color: #64748b; font-weight: 800;">الباركود الدولي:</span>
                        <div style="font-size: 1rem; font-weight: 900; color: #0f172a; font-family: monospace; margin-top: 4px;">${p.barcode || 'غير مسجل'}</div>
                    </div>

                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px;">
                        <span style="font-size: 0.8rem; color: #64748b; font-weight: 800;">التصنيف والقسم:</span>
                        <div style="font-size: 1rem; font-weight: 900; color: #0891b2; margin-top: 4px;">${p.category || 'عام'}</div>
                    </div>

                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px;">
                        <span style="font-size: 0.8rem; color: #64748b; font-weight: 800;">الوحدة الأساسية:</span>
                        <div style="font-size: 1rem; font-weight: 900; color: #059669; margin-top: 4px;">${p.unit || 'قطعة'}</div>
                    </div>

                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px;">
                        <span style="font-size: 0.8rem; color: #64748b; font-weight: 800;">حد إعادة الطلب (الأمان):</span>
                        <div style="font-size: 1rem; font-weight: 900; color: #d97706; margin-top: 4px;">${p.minStock || p.min_stock || 0} ${p.unit || 'قطعة'}</div>
                    </div>

                    <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 12px 16px;">
                        <span style="font-size: 0.8rem; color: #047857; font-weight: 800;">📍 موقع الرف / الاستند:</span>
                        <div style="font-size: 1rem; font-weight: 900; color: #065f46; margin-top: 4px;">${p.shelf || p.location || p.shelfLocation || 'غير محدد'}</div>
                    </div>

                    <div style="background: #fefce8; border: 1px solid #fef08a; border-radius: 10px; padding: 12px 16px;">
                        <span style="font-size: 0.8rem; color: #854d0e; font-weight: 800;">⚖️ كود الميزان (PLU):</span>
                        <div style="font-size: 1rem; font-weight: 900; color: #b45309; margin-top: 4px;">${p.scalePlu || p.scale_plu || 'غير مسجل'}</div>
                    </div>
                </div>

                ${p.notes ? `
                    <div style="margin-top: 15px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 10px; padding: 12px 16px;">
                        <span style="font-size: 0.8rem; color: #b45309; font-weight: 800;">📝 ملاحظات الصنف:</span>
                        <div style="font-size: 0.92rem; color: #78350f; font-weight: 700; margin-top: 4px; line-height: 1.6;">${p.notes}</div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * تغيير التبويب النشط
     */
    window.setInquiryTab = function (tabName) {
        currentInquiryTab = tabName;
        renderInquiryModal();
    };

    /**
     * فلترة المقاس أو اللون
     */
    window.setInquiryVariantFilter = function (type, value) {
        if (type === 'reset') {
            selectedInquirySize = 'all';
            selectedInquiryColor = 'all';
        } else if (type === 'size') {
            selectedInquirySize = value;
        } else if (type === 'color') {
            selectedInquiryColor = value;
        }
        renderInquiryModal();
    };

    /**
     * البحث الحي داخل المودال لتبديل الصنف
     */
    window.handleInquiryLiveSearch = function (query) {
        const dropdown = document.getElementById('inquirySearchDropdown');
        if (!dropdown) return;

        const qRaw = String(query || '').trim().toLowerCase();
        const qClean = cleanArabic(query);
        if (!qClean || typeof productsDB === 'undefined' || !Array.isArray(productsDB)) {
            dropdown.style.display = 'none';
            dropdown.innerHTML = '';
            inquirySearchResults = [];
            inquirySearchActiveIndex = -1;
            return;
        }

        inquirySearchResults = productsDB.filter(p => {
            const nameClean = cleanArabic(p.name);
            const barcodeClean = cleanArabic(p.barcode);
            const codeClean = cleanArabic(p.code);

            const nameMatch = nameClean.includes(qClean);
            const barcodeMatch = barcodeClean.includes(qClean) || String(p.barcode || '').toLowerCase().includes(qRaw);
            const codeMatch = codeClean.includes(qClean) || String(p.code || '').toLowerCase().includes(qRaw);
            const variantMatch = p.variants && p.variants.some(v => 
                String(v.barcode || '').trim().toLowerCase().includes(qRaw) ||
                cleanArabic(v.barcode).includes(qClean) ||
                (cleanArabic(v.size) + ' ' + cleanArabic(v.color)).includes(qClean)
            );

            return nameMatch || barcodeMatch || codeMatch || variantMatch;
        }).slice(0, 25);

        inquirySearchActiveIndex = -1;

        if (inquirySearchResults.length === 0) {
            dropdown.style.display = 'block';
            dropdown.innerHTML = `<div style="padding: 12px; color: #94a3b8; text-align: center; font-size: 0.88rem; font-weight: 700;">لا توجد أصناف مطابقة</div>`;
            return;
        }

        dropdown.innerHTML = inquirySearchResults.map((p, idx) => {
            let matchedV = null;
            if (p.variants && p.variants.length > 0) {
                matchedV = p.variants.find(v => 
                    (v.barcode && String(v.barcode).trim().toLowerCase() === qRaw) ||
                    (v.barcode && cleanArabic(v.barcode) === qClean)
                );
            }
            const matchedBarcode = matchedV ? String(matchedV.barcode).trim() : '';
            const variantBadge = matchedV ? `<span style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; padding: 1px 6px; border-radius: 4px; font-size: 0.72rem; font-weight: 800; margin-right: 6px;">مقاس/لون: ${[matchedV.size, matchedV.color].filter(Boolean).join(' - ')}</span>` : '';

            return `
            <div id="inquirySearchRow_${idx}"
                onclick="window.selectInquiryProduct(${p.id}, '${matchedBarcode}')"
                style="padding: 10px 15px; border-bottom: 1px solid #f1f5f9; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: 0.15s; background: #ffffff;"
                onmouseover="window.highlightInquirySearchRow(${idx});" onmouseout="this.style.background='#ffffff';">
                <div style="text-align: right;">
                    <div style="font-weight: 900; color: #0f172a; font-size: 0.95rem; display: flex; align-items: center;">
                        ${p.name}
                        ${variantBadge}
                    </div>
                    <div style="font-size: 0.78rem; color: #64748b; margin-top: 2px;">
                        كود: <b style="color: #2563eb; font-family: monospace;">${p.code || p.id}</b> | 
                        باركود: <b style="color: #475569; font-family: monospace;">${matchedBarcode || p.barcode || '-'}</b> | 
                        التصنيف: <b style="color: #059669;">${p.category || 'عام'}</b>
                    </div>
                </div>
                <div style="text-align: left;">
                    <span style="background: #10b981; color: white; padding: 4px 10px; border-radius: 8px; font-weight: 900; font-size: 0.88rem; font-family: monospace;">
                        ${(parseFloat(p.price) || 0).toFixed(2)}
                    </span>
                </div>
            </div>
            `;
        }).join('');

        dropdown.style.display = 'block';
    };

    /**
     * تلوين وتحديد الصف النشط عند التنقل بالأسهم أو الماوس
     */
    window.highlightInquirySearchRow = function (idx) {
        inquirySearchActiveIndex = idx;
        const dropdown = document.getElementById('inquirySearchDropdown');
        if (!dropdown) return;
        const rows = dropdown.querySelectorAll('[id^="inquirySearchRow_"]');
        rows.forEach((r, i) => {
            if (i === idx) {
                r.style.background = '#dcfce7';
                r.style.borderRight = '5px solid #059669';
            } else {
                r.style.background = '#ffffff';
                r.style.borderRight = 'none';
            }
        });
    };

    /**
     * التحكم بالكيبورد (الأسهم للأعلى والأسفل وزر Enter و Escape) في شاشة الاستعلام
     */
    window.handleInquirySearchKeyDown = function (e) {
        const dropdown = document.getElementById('inquirySearchDropdown');
        const isDropdownOpen = dropdown && dropdown.style.display !== 'none' && inquirySearchResults.length > 0;

        if (e.key === 'ArrowDown') {
            if (!isDropdownOpen) return;
            e.preventDefault();
            inquirySearchActiveIndex = (inquirySearchActiveIndex + 1) % inquirySearchResults.length;
            window.highlightInquirySearchRow(inquirySearchActiveIndex);
            const activeEl = document.getElementById(`inquirySearchRow_${inquirySearchActiveIndex}`);
            if (activeEl) activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else if (e.key === 'ArrowUp') {
            if (!isDropdownOpen) return;
            e.preventDefault();
            inquirySearchActiveIndex = (inquirySearchActiveIndex - 1 + inquirySearchResults.length) % inquirySearchResults.length;
            window.highlightInquirySearchRow(inquirySearchActiveIndex);
            const activeEl = document.getElementById(`inquirySearchRow_${inquirySearchActiveIndex}`);
            if (activeEl) activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else if (e.key === 'Enter') {
            if (!isDropdownOpen) return;
            e.preventDefault();
            const targetP = (inquirySearchActiveIndex >= 0 && inquirySearchActiveIndex < inquirySearchResults.length)
                ? inquirySearchResults[inquirySearchActiveIndex]
                : inquirySearchResults[0];
            if (targetP) {
                const searchInputVal = (document.getElementById('inquiryLiveSearch')?.value || '').trim().toLowerCase();
                let matchedBarcode = '';
                if (searchInputVal && targetP.variants) {
                    const mv = targetP.variants.find(v => v.barcode && String(v.barcode).trim().toLowerCase() === searchInputVal);
                    if (mv) matchedBarcode = mv.barcode;
                }
                window.selectInquiryProduct(targetP.id, matchedBarcode);
            }
        } else if (e.key === 'Escape') {
            if (isDropdownOpen) {
                e.preventDefault();
                dropdown.style.display = 'none';
            } else {
                window.closeFastItemInquiryModal();
            }
        }
    };

    /**
     * اختيار صنف من قائمة البحث مع دعم التحديد الذكي للمقاس/اللون الممسوح
     */
    window.selectInquiryProduct = function (productId, variantBarcode = '') {
        const prod = productsDB.find(p => p.id === productId || p.id == productId);
        if (prod) {
            currentInquiryProduct = prod;
            selectedInquirySize = 'all';
            selectedInquiryColor = 'all';

            // 🎯 إذا تم تحديد باركود تشكيلة، نقوم بفلترة المقاس واللون تلقائياً
            if (variantBarcode && prod.variants && prod.variants.length > 0) {
                const matchedV = prod.variants.find(v => v.barcode && String(v.barcode).trim() === String(variantBarcode).trim());
                if (matchedV) {
                    if (matchedV.size && String(matchedV.size).trim()) selectedInquirySize = String(matchedV.size).trim();
                    if (matchedV.color && String(matchedV.color).trim()) selectedInquiryColor = String(matchedV.color).trim();
                }
            }

            inquirySearchResults = [];
            inquirySearchActiveIndex = -1;
            renderInquiryModal();
        }
    };

    /**
     * إضافة تشكيلة محددة مباشرة برقمها التسلسلي لضمان الدقة وتفادي أي خطأ نصي
     */
    window.addInquiryVariantByIndex = function (vIndex) {
        if (!currentInquiryProduct) return;
        const variants = currentInquiryProduct.variants || [];
        const variant = (vIndex >= 0 && vIndex < variants.length) ? variants[vIndex] : null;

        if (variant) {
            const prevCartTotalQty = (typeof cart !== 'undefined' && Array.isArray(cart))
                ? cart.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0)
                : 0;

            if (typeof addToCart === 'function') {
                addToCart(currentInquiryProduct.id, null, variant);
            } else if (typeof completeAddToCart === 'function') {
                completeAddToCart(currentInquiryProduct, null, variant);
            }

            const newCartTotalQty = (typeof cart !== 'undefined' && Array.isArray(cart))
                ? cart.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0)
                : 0;

            // 🎯 التأكد الفعلي من زيادة كمية السلة قبل إطلاق رسالة وصوت النجاح
            if (newCartTotalQty > prevCartTotalQty) {
                if (typeof BayanBarcode !== 'undefined' && BayanBarcode.playBeep) {
                    BayanBarcode.playBeep(true);
                }
                if (typeof showToast === 'function') {
                    const vLabel = [variant.size, variant.color].filter(s => s && s !== 'قياسي' && s !== 'موحد').join(' - ');
                    showToast(`🛒 تمت إضافة (${currentInquiryProduct.name} ${vLabel ? '(' + vLabel + ')' : ''}) للسلة!`, 'success');
                }
                window.closeFastItemInquiryModal();
            }
        } else {
            window.addInquiryProductToCart();
        }
    };

    /**
     * إضافة الصنف المفتوح في المودال مباشرة إلى سلة البيع
     */
    window.addInquiryProductToCart = function () {
        if (!currentInquiryProduct) return;

        let effVariant = null;
        if (currentInquiryProduct.variants && currentInquiryProduct.variants.length > 0) {
            if (selectedInquirySize !== 'all' || selectedInquiryColor !== 'all') {
                effVariant = currentInquiryProduct.variants.find(v => {
                    const vSize = String(v.size || '').trim();
                    const vColor = String(v.color || '').trim();
                    const sizeMatch = selectedInquirySize === 'all' || vSize === selectedInquirySize;
                    const colorMatch = selectedInquiryColor === 'all' || vColor === selectedInquiryColor;
                    return sizeMatch && colorMatch;
                });
            }
        }

        const prevCartTotalQty = (typeof cart !== 'undefined' && Array.isArray(cart))
            ? cart.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0)
            : 0;

        // إذا كان الصنف يحتاج فتح نافذة اختيار مقاس أو وحدة، نغلق الاستعلام لإتاحة نافذة الاختيار
        const willOpenSelectionModal = (!effVariant && currentInquiryProduct.variants && currentInquiryProduct.variants.length > 0) ||
                                       (currentInquiryProduct.units && currentInquiryProduct.units.length > 1);

        if (willOpenSelectionModal) {
            window.closeFastItemInquiryModal();
        }

        if (typeof addToCart === 'function') {
            addToCart(currentInquiryProduct.id, null, effVariant);
        } else if (typeof completeAddToCart === 'function') {
            completeAddToCart(currentInquiryProduct, null, effVariant);
        }

        const newCartTotalQty = (typeof cart !== 'undefined' && Array.isArray(cart))
            ? cart.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0)
            : 0;

        // 🎯 التأكد الفعلي من نزول الصنف في السلة قبل إطلاق رسالة وصوت النجاح
        if (newCartTotalQty > prevCartTotalQty) {
            if (typeof BayanBarcode !== 'undefined' && BayanBarcode.playBeep) {
                BayanBarcode.playBeep(true);
            }
            if (typeof showToast === 'function') {
                showToast(`🛒 تمت إضافة (${currentInquiryProduct.name}) للسلة بنجاح!`, 'success');
            }
            window.closeFastItemInquiryModal();
        }
    };

    /**
     * تعديل بيانات الصنف (محمي بالصلاحيات لعدم طرد الكاشير بالخطأ)
     */
    window.editInquiryProduct = function () {
        if (!currentInquiryProduct) return;
        if (!canUserEditProducts()) {
            if (typeof showToast === 'function') {
                showToast('🚫 عذراً، ليس لديك صلاحية لتعديل بيانات الأصناف!', 'error');
            }
            return;
        }
        const p = currentInquiryProduct;
        window.closeFastItemInquiryModal();

        if (typeof openNewItemModal === 'function') {
            openNewItemModal(p);
        } else if (typeof editProduct === 'function') {
            editProduct(p.id);
        } else if (typeof openEditItemModal === 'function') {
            openEditItemModal(p.id);
        }
    };

    /**
     * إغلاق نافذة الاستعلام مع إعادة مؤشر الكيبورد لحقل باركود شاشة البيع
     */
    window.closeFastItemInquiryModal = function () {
        const modal = document.getElementById('bayanFastInquiryModal');
        if (modal) {
            modal.style.display = 'none';
        }
        // 🎯 إعادة التركيز التلقائي فوراً لحقل باركود شاشة البيع
        setTimeout(() => {
            const searchInput = document.getElementById('productSearch') || 
                                document.getElementById('barcodeInput');
            if (searchInput) {
                searchInput.focus();
                if (typeof searchInput.select === 'function') searchInput.select();
            }
        }, 80);
    };

    // ⌨️ الاستماع لاختصارات الكيبورد (F2 لفتح الاستعلام و Escape للإغلاق)
    window.addEventListener('keydown', function (e) {
        if (e.key === 'F2') {
            // 🛡️ فحص ومنع تداخل النوافذ إذا كانت شاشة الدفع أو أي نافذة منبثقة نشطة
            const payModal = document.getElementById('checkoutModal') || document.getElementById('quickPaymentModal') || document.getElementById('paymentModal');
            const discountModal = document.getElementById('discountModal') || document.getElementById('invoiceDiscountModal');
            const otherActiveModal = document.querySelector('.confirm-modal-overlay:not(#bayanFastInquiryModal)');
            
            const isPayActive = payModal && !payModal.classList.contains('hidden') && payModal.style.display !== 'none';
            const isDiscActive = discountModal && !discountModal.classList.contains('hidden') && discountModal.style.display !== 'none';
            const isOtherActive = otherActiveModal && !otherActiveModal.classList.contains('hidden') && otherActiveModal.style.display !== 'none';

            if (isPayActive || isDiscActive || isOtherActive) {
                return; // منع فتح الاستعلام فوق شاشات الدفع أو التأكيد
            }

            e.preventDefault();
            window.openFastItemInquiryModal();
        } else if (e.key === 'Escape') {
            const modal = document.getElementById('bayanFastInquiryModal');
            if (modal && modal.style.display === 'flex') {
                e.preventDefault();
                window.closeFastItemInquiryModal();
            }
        }
    });

    /**
     * إضافة مقاس ولون محدد من جدول التشكيلات (متوافق وذكي)
     */
    window.addInquiryVariantToCart = function(size, color) {
        if (!currentInquiryProduct || !currentInquiryProduct.variants) {
            window.addInquiryProductToCart();
            return;
        }
        const cleanSize = (size === 'قياسي' || size === 'all') ? '' : String(size || '').trim();
        const cleanColor = (color === 'موحد' || color === 'all') ? '' : String(color || '').trim();
        
        const matched = currentInquiryProduct.variants.find(v => {
            const vSize = String(v.size || '').trim();
            const vColor = String(v.color || '').trim();
            const sizeOk = !cleanSize || vSize === cleanSize;
            const colorOk = !cleanColor || vColor === cleanColor;
            return sizeOk && colorOk;
        });

        if (matched) {
            const idx = currentInquiryProduct.variants.indexOf(matched);
            window.addInquiryVariantByIndex(idx);
        } else {
            window.addInquiryProductToCart();
        }
    };

})();
