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
    let selectedInquiryWarehouse = 'all'; // 'all' | warehouseName (تحديد المخزن لعرض تفاصيل أرصدته بالجدول أدناه)
    let isColCustomizerOpen = false;

    let inquiryViewMode = (typeof getStore === 'function' ? getStore('pos_inquiry_view_mode') : null) || 'horizontal';

    // الإعدادات الافتراضية لأعمدة جدول التشكيلات التفصيلي (اللون أولاً ثم المقاس)
    const defaultInquiryCols = {
        index: true,          // # (م)
        color: true,          // اللون (العمود الأول)
        size: true,           // المقاس (العمود الثاني)
        whStock: true,        // رصيد المخزن المحدد / المخازن
        branchesTotal: true,  // إجمالي الفروع
        totalStock: true,     // الرصيد الكلي
        retailPrice: true,    // سعر القطاعي
        wholesalePrice: true, // سعر الجملة
        barcode: true,        // الباركود الفريد
        action: true          // إضافة
    };

    /**
     * جلب إعدادات رؤية الأعمدة المحفوظة
     */
    function getInquiryColsSettings() {
        try {
            const raw = (typeof getStore === 'function') ? getStore('pos_inquiry_variants_cols') : null;
            if (raw && raw !== 'undefined' && raw !== 'null') {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    return Object.assign({}, defaultInquiryCols, parsed);
                }
            }
        } catch (e) {}
        return Object.assign({}, defaultInquiryCols);
    }

    /**
     * حفظ إعدادات رؤية الأعمدة في النظام عبر SQLite
     */
    function saveInquiryColsSettings(settings) {
        try {
            const raw = JSON.stringify(settings);
            if (typeof setStore === 'function') {
                setStore('pos_inquiry_variants_cols', raw);
            }
        } catch (e) {}
    }

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
     * ترتيب منطقي وذكي للمقاسات (حسب الأحرف والأرقام)
     */
    function getInquirySizeWeight(s) {
        if (typeof getSizeWeight === 'function') return getSizeWeight(s);
        if (typeof window.getSizeWeight === 'function') return window.getSizeWeight(s);
        if (!s) return 999;
        let str = String(s).toUpperCase().trim();
        if (str === 'XXS') return 0;
        if (str === 'XS') return 1;
        if (str === 'S' || str === 'SMALL') return 2;
        if (str === 'M' || str === 'MEDIUM') return 3;
        if (str === 'L' || str === 'LARGE') return 4;
        if (str === 'XL') return 5;
        if (str === 'XXL' || str === '2XL') return 6;
        if (str === 'XXXL' || str === '3XL') return 7;
        if (str === '4XL') return 8;
        if (str === '5XL') return 9;
        if (str === '6XL') return 10;
        let num = parseFloat(str);
        if (!isNaN(num)) return 100 + num;
        return 900;
    }

    /**
     * معالج النصوص والبحث العربي المرن والذكي (تطابق أ/إ/آ و ة/ه و ي/ى وتحويل الأرقام الهندية)
     */
    const cleanArabic = (str) => String(str || '').trim().toLowerCase()
        .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
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

        selectedInquiryWarehouse = 'all';
        isColCustomizerOpen = false;

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
                background: rgba(15, 23, 42, 0.8);
                display: flex; align-items: center; justify-content: center;
                direction: rtl; font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
                animation: fadeIn 0.15s ease-out;
            `;
            document.body.appendChild(modal);
        }

        const prevScroll = document.getElementById('inquiryTabContentContainer')?.scrollTop || 0;

        // 🌟 في حالة عدم اختيار صنف مسبقاً (فتح شاشة البحث الفوري الخضراء الأنيقة)
        if (!currentInquiryProduct) {
            modal.innerHTML = `
                <div style="background: #ffffff; width: 95%; max-width: 680px; max-height: 88vh; border-radius: 24px; box-shadow: 0 30px 70px rgba(0,0,0,0.4); border: 2.5px solid #059669; animation: slideUp 0.3s ease-out; display: flex; flex-direction: column; overflow: hidden;">
                    <!-- هيدر البحث الأخضر الزاهي -->
                    <div style="background: linear-gradient(135deg, #065f46 0%, #047857 50%, #059669 100%); padding: 16px 24px; color: white; border-bottom: 3px solid #10b981; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
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

                    <div style="padding: 18px 24px; text-align: center; display: flex; flex-direction: column; flex: 1; min-height: 0;">
                        <p style="color: #000000; font-size: 1.05rem; font-weight: 900; margin: 0 0 12px; flex-shrink: 0;">
                            🔎 اكتب اسم الصنف، كود الموديل، المقاس، أو امسح الباركود بالسكانر:
                        </p>

                        <!-- شارات توضيح طرق البحث الأربعة بوضوح فائق وحبر أسود تقيل -->
                        <div style="display: flex; justify-content: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; flex-shrink: 0;">
                            <span style="background: #f0fdf4; color: #000000; border: 2px solid #059669; padding: 4px 12px; border-radius: 8px; font-size: 0.82rem; font-weight: 900;">🏷️ 1. اسم الصنف</span>
                            <span style="background: #eff6ff; color: #000000; border: 2px solid #2563eb; padding: 4px 12px; border-radius: 8px; font-size: 0.82rem; font-weight: 900;">🔢 2. كود الموديل</span>
                            <span style="background: #faf5ff; color: #000000; border: 2px solid #7e22ce; padding: 4px 12px; border-radius: 8px; font-size: 0.82rem; font-weight: 900;">📏 3. مقاس الموديل (مثل: 38)</span>
                            <span style="background: #fffbeb; color: #000000; border: 2px solid #d97706; padding: 4px 12px; border-radius: 8px; font-size: 0.82rem; font-weight: 900;">⚡ 4. مسح الباركود بالسكانر</span>
                        </div>

                        <div style="margin-bottom: 12px; flex-shrink: 0;">
                            <input type="text" id="inquiryLiveSearch" placeholder="🔍 اكتب اسم الصنف، كود الموديل، المقاس (مثل: 38)، أو امسح الباركود..."
                                style="width: 100%; height: 50px; border-radius: 14px; border: 3px solid #047857; padding: 0 20px; font-size: 1.1rem; font-weight: 900; color: #000000; outline: none; box-sizing: border-box; background: #ffffff; box-shadow: inset 0 2px 6px rgba(0,0,0,0.05);"
                                oninput="window.handleInquiryLiveSearch(this.value)"
                                onkeydown="window.handleInquirySearchKeyDown(event)"
                                autocomplete="off">
                        </div>

                        <!-- حاوية النتائج التدفقية الداخلية لمنع أي قص إطلاقاً -->
                        <div id="inquirySearchDropdown" style="display: none; flex: 1; max-height: 380px; overflow-y: auto; background: #ffffff; border: 2.5px solid #047857; border-radius: 14px; box-shadow: 0 6px 20px rgba(0,0,0,0.15); margin-bottom: 12px;" class="fast-scrollbar"></div>

                        <!-- التوجيه الذكي عند عدم وجود كتابة -->
                        <div id="inquirySearchGuide" style="background: #f8fafc; border: 2px dashed #475569; border-radius: 14px; padding: 12px; margin-bottom: 15px; color: #000000; font-size: 0.92rem; font-weight: 900; display: flex; align-items: center; justify-content: center; gap: 8px; flex-shrink: 0;">
                            <span>💡</span> يمكنك استخدام قارئ الباركود أو الأسهم ⬇️ ⬆️ من لوحة المفاتيح والضغط على Enter للاختيار
                        </div>

                        <!-- زر الإلغاء الثابت في أسفل الكارت دائماً -->
                        <div style="flex-shrink: 0;">
                            <button onclick="window.closeFastItemInquiryModal()" style="padding: 10px 40px; background: #1e293b; color: #ffffff; border: 2px solid #0f172a; border-radius: 12px; font-weight: 900; font-size: 1rem; cursor: pointer; transition: 0.2s;"
                                onmouseover="this.style.background='#0f172a';" onmouseout="this.style.background='#1e293b';">إلغاء ✕</button>
                        </div>
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

        // استخراج المقاسات والألوان المتاحة وترتيب المقاسات منطقياً
        const allSizes = [...new Set(variants.map(v => v.size).filter(s => s && String(s).trim() !== '' && String(s).trim() !== '-'))];
        allSizes.sort((a, b) => getInquirySizeWeight(a) - getInquirySizeWeight(b));
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
                                <div style="font-size: 0.9rem; color: #ffffff; margin-top: 3px; font-weight: 900;">
                                    باركود: <b style="color: #000000; font-family: monospace; background: #ffffff; padding: 2px 8px; border-radius: 6px; font-weight: 900;">${p.barcode || '-'}</b>
                                    ${(p.barcode && p.barcode !== '-') ? `
                                        <button type="button" onclick="event.stopPropagation(); window.copyInquiryBarcode('${String(p.barcode).replace(/'/g, "\\'")}', this);" 
                                            title="نسخ باركود الصنف"
                                            style="background: #ffffff; border: 1.5px solid #000000; border-radius: 6px; padding: 2px 8px; cursor: pointer; font-size: 0.78rem; font-weight: 900; color: #000000; line-height: 1.2; vertical-align: middle; margin-right: 4px; transition: 0.15s;"
                                            onmouseover="this.style.background='#dcfce7';"
                                            onmouseout="this.style.background='#ffffff';">
                                            📋 نسخ
                                        </button>
                                    ` : ''} | 
                                    التصنيف: <b style="color: #000000; background: #fed7aa; padding: 2px 8px; border-radius: 6px; font-weight: 900;">${p.category || 'عام'}</b> | 
                                    الوحدة: <b style="color: #000000; background: #a7f3d0; padding: 2px 8px; border-radius: 6px; font-weight: 900;">${p.unit || 'قطعة'}</b>
                                </div>
                            </div>
                        </div>

                        <!-- شريط البحث السريع باللون الأبيض عالي التباين مع دعم الكيبورد -->
                        <div style="position: relative; width: 280px; max-width: 42%;">
                            <input type="text" id="inquiryLiveSearch" placeholder="🔍 تبديل صنف (بحث/سكانر)..."
                                style="width: 100%; height: 38px; border-radius: 10px; border: 2.5px solid #047857; background: #ffffff; color: #000000; padding: 0 12px; font-size: 0.95rem; font-weight: 900; outline: none; box-sizing: border-box; box-shadow: 0 2px 8px rgba(0,0,0,0.15);"
                                oninput="window.handleInquiryLiveSearch(this.value)"
                                onkeydown="window.handleInquirySearchKeyDown(event)"
                                autocomplete="off">
                            <div id="inquirySearchDropdown" style="position: absolute; top: 44px; right: 0; left: 0; background: #ffffff; border: 2.5px solid #047857; border-radius: 12px; max-height: 240px; overflow-y: auto; z-index: 100; display: none; box-shadow: 0 12px 30px rgba(0,0,0,0.3);" class="fast-scrollbar"></div>
                        </div>

                        <!-- زر الإغلاق الأبيض الأنيق -->
                        <button onclick="window.closeFastItemInquiryModal()" style="background: rgba(255, 255, 255, 0.2); color: #ffffff; border: 1.5px solid rgba(255, 255, 255, 0.4); border-radius: 10px; width: 36px; height: 36px; font-size: 1.2rem; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold; transition: 0.2s;"
                            onmouseover="this.style.background='#ef4444'; this.style.borderColor='#ef4444';" onmouseout="this.style.background='rgba(255, 255, 255, 0.2)'; this.style.borderColor='rgba(255, 255, 255, 0.4)';">✕</button>
                    </div>

                    <!-- التبويبات الثلاثة عالية التباين والوضوح بحبر أسود تقيل ونصوص بارزة -->
                    <div style="display: flex; gap: 10px; margin-top: 4px;">
                        <button type="button" onclick="window.setInquiryTab('general')"
                            style="padding: 8px 24px; border-radius: 10px; font-weight: 900; font-size: 0.95rem; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 7px; ${currentInquiryTab === 'general' ? 'background: #ffffff; color: #000000; box-shadow: 0 4px 12px rgba(0,0,0,0.3); border: 2.5px solid #000000;' : 'background: rgba(255,255,255,0.25); color: #ffffff; border: 2px solid rgba(255,255,255,0.5);'}">
                            <span>🏢</span> عام والأرصدة
                        </button>
                        <button type="button" onclick="window.setInquiryTab('history')"
                            style="padding: 8px 24px; border-radius: 10px; font-weight: 900; font-size: 0.95rem; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 7px; ${currentInquiryTab === 'history' ? 'background: #ffffff; color: #000000; box-shadow: 0 4px 12px rgba(0,0,0,0.3); border: 2.5px solid #000000;' : 'background: rgba(255,255,255,0.25); color: #ffffff; border: 2px solid rgba(255,255,255,0.5);'}">
                            <span>📜</span> حركة الصنف
                        </button>
                        <button type="button" onclick="window.setInquiryTab('specs')"
                            style="padding: 8px 24px; border-radius: 10px; font-weight: 900; font-size: 0.95rem; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 7px; ${currentInquiryTab === 'specs' ? 'background: #ffffff; color: #000000; box-shadow: 0 4px 12px rgba(0,0,0,0.3); border: 2.5px solid #000000;' : 'background: rgba(255,255,255,0.25); color: #ffffff; border: 2px solid rgba(255,255,255,0.5);'}">
                            <span>📋</span> مواصفات
                        </button>
                    </div>
                </div>

                <!-- 2. محتوى التبويب النشط -->
                <div id="inquiryTabContentContainer" style="flex: 1; min-height: 380px; max-height: calc(92vh - 170px); overflow-y: auto; overflow-x: hidden; padding: 16px 20px;" class="fast-scrollbar">
                    ${getInquiryTabContent(p, variants, allSizes, allColors)}
                </div>

                <!-- 3. الفوتر وأزرار التحكم -->
                <div style="background: #ffffff; padding: 12px 20px; border-top: 2px solid #cbd5e1; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                    <div style="display: flex; gap: 10px;">
                        <button type="button" onclick="window.addInquiryProductToCart()"
                            style="padding: 10px 26px; border-radius: 10px; border: 2px solid #047857; background: linear-gradient(135deg, #10b981, #059669); color: #ffffff; font-weight: 900; font-size: 1rem; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(16,185,129,0.3); transition: 0.2s;"
                            onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='none'">
                            <span>🛒</span> إضافة للفاتورة الحالية
                        </button>
                        ${canUserEditProducts() ? `
                            <button type="button" onclick="window.editInquiryProduct()"
                                style="padding: 10px 20px; border-radius: 10px; border: 2px solid #000000; background: #ffffff; color: #000000; font-weight: 900; font-size: 0.95rem; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: 0.2s;"
                                onmouseover="this.style.background='#f1f5f9';" onmouseout="this.style.background='#ffffff';">
                                <span>✏️</span> تعديل بيانات الصنف
                            </button>
                        ` : ''}
                    </div>

                    <button type="button" onclick="window.closeFastItemInquiryModal()"
                        style="padding: 10px 26px; border-radius: 10px; border: 2px solid #000000; background: #ffffff; color: #000000; font-weight: 900; font-size: 0.95rem; cursor: pointer; transition: 0.2s;"
                        onmouseover="this.style.background='#fee2e2';" onmouseout="this.style.background='#ffffff';">
                        إغلاق ✕
                    </button>
                </div>

            </div>
        `;

        modal.style.display = 'flex';
        const curScroll = document.getElementById('inquiryTabContentContainer');
        if (curScroll && prevScroll > 0) {
            curScroll.scrollTop = prevScroll;
        }
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
                    } else if (whName === 'المخزن الرئيسي') {
                        st = parseFloat(v.stock) || 0;
                    }
                    availQty += st;
                });
            } else {
                if (typeof getWarehouseStock === 'function') {
                    availQty = getWarehouseStock(p.name, whName);
                } else if (p.warehouseStocks && p.warehouseStocks[whName] !== undefined) {
                    availQty = parseFloat(p.warehouseStocks[whName]) || 0;
                } else if (whName === 'المخزن الرئيسي') {
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

        // بناء صفوف جدول المخازن مع عمود التحديد
        const whTableRowsHtml = whRowsData.map((row, idx) => {
            const hasPositiveStock = row.qty > 0;
            const bgBadge = hasPositiveStock ? '#ecfdf5' : '#f8fafc';
            const colorBadge = hasPositiveStock ? '#047857' : '#94a3b8';
            const borderBadge = hasPositiveStock ? '#a7f3d0' : '#e2e8f0';
            const hasReserved = row.reservedQty > 0;
            const isSelected = selectedInquiryWarehouse === row.warehouse;
            const safeWh = String(row.warehouse || '').replace(/'/g, "\\'");

            return `
                <tr onclick="window.setInquirySelectedWarehouse('${safeWh}')"
                    title="انقر لتحديد (${row.warehouse}) وعرض أرصدته بالجدول أدناه"
                    style="border-bottom: 1.5px solid #e2e8f0; cursor: pointer; transition: all 0.15s; ${isSelected ? 'background: #ecfdf5; outline: 2.5px solid #059669;' : (idx % 2 === 1 ? 'background: #f8fafc;' : 'background: #ffffff;')}"
                    onmouseover="if(!${isSelected}) this.style.background='#f0fdf4';"
                    onmouseout="if(!${isSelected}) this.style.background='${idx % 2 === 1 ? '#f8fafc' : '#ffffff'}';">
                    <td style="padding: 10px 6px; text-align: center;" onclick="event.stopPropagation(); window.setInquirySelectedWarehouse('${safeWh}');">
                        <input type="radio" name="inquiryWarehouseRadio" value="${safeWh}" 
                            ${isSelected ? 'checked' : ''} 
                            style="cursor: pointer; width: 18px; height: 18px; accent-color: #059669; vertical-align: middle;">
                    </td>
                    <td style="padding: 10px 10px; font-weight: 900; color: #000000; text-align: center; font-size: 0.95rem;">${idx + 1}</td>
                    <td style="padding: 10px 14px; font-weight: 900; color: #000000; text-align: right; font-size: 1rem;">
                        🏢 ${row.warehouse} ${isSelected ? '<span style="color: #000000; font-size: 0.8rem; font-weight: 900; background: #86efac; border: 1.5px solid #16a34a; padding: 2px 8px; border-radius: 6px; margin-right: 6px;">✓ محدد</span>' : ''}
                    </td>
                    <td style="padding: 10px 12px; text-align: center; font-weight: 900; font-size: 1.1rem;">
                        <span style="background: ${hasPositiveStock ? '#dcfce7' : '#f8fafc'}; color: #000000; border: 2px solid ${hasPositiveStock ? '#16a34a' : '#cbd5e1'}; padding: 4px 14px; border-radius: 8px; display: inline-block; min-width: 65px; font-weight: 900;">
                            ${row.qty.toFixed(2).replace(/\.00$/, '')} ${p.unit || 'قطعة'}
                        </span>
                    </td>
                    <td style="padding: 10px 12px; text-align: center; font-weight: 900;">
                        ${hasReserved 
                            ? `<span style="background: #fef08a; color: #000000; border: 2px solid #ca8a04; padding: 3px 10px; border-radius: 8px; font-weight: 900; display: inline-block; font-size: 0.95rem;">🛒 ${row.reservedQty.toFixed(2).replace(/\.00$/, '')}</span>` 
                            : `<span style="color: #000000; font-weight: 900; font-size: 0.95rem;">0</span>`}
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

        // شريط فلاتر المقاس واللون السريع والتفاعلي (Pills Ribbon & Dropdowns)
        let filterSectionHtml = '';
        if (hasVariants && (allSizes.length > 0 || allColors.length > 0)) {
            const sizePillsHtml = allSizes.map(s => {
                const isSel = selectedInquirySize === s;
                const sStock = variants.filter(v => String(v.size || '').trim() === s)
                    .reduce((sum, v) => {
                        let st = 0;
                        if (v.warehouseStocks && typeof v.warehouseStocks === 'object' && Object.keys(v.warehouseStocks).length > 0) {
                            st = Object.values(v.warehouseStocks).reduce((sAcc, val) => sAcc + (parseFloat(val) || 0), 0);
                        } else {
                            st = parseFloat(v.stock) || 0;
                        }
                        return sum + st;
                    }, 0);
                const isOutOfStock = sStock <= 0;
                return `
                    <button type="button" onclick="window.setInquiryVariantFilter('size', '${s.replace(/'/g, "\\'")}')"
                        style="padding: 5px 12px; border-radius: 8px; font-weight: 900; font-size: 0.88rem; cursor: pointer; transition: all 0.15s; flex-shrink: 0; display: inline-flex; align-items: center; gap: 5px; ${isSel ? 'background: #059669; color: #ffffff; border: 2px solid #000000; box-shadow: 0 2px 8px rgba(0,0,0,0.3); transform: scale(1.05);' : (isOutOfStock ? 'background: #f1f5f9; color: #000000; border: 1.5px solid #000000;' : 'background: #ffffff; color: #000000; border: 2px solid #059669;')}"
                        title="مقاس ${s} [الرصيد الكلي: ${sStock}]">
                        <span>${isSel ? '✓ ' : ''}${s}</span>
                        <span style="font-size: 0.76rem; font-weight: 900; font-family: monospace; background: rgba(0,0,0,0.12); color: ${isSel ? '#ffffff' : '#000000'}; padding: 1px 6px; border-radius: 4px;">${sStock}</span>
                    </button>
                `;
            }).join('');

            const colorPillsHtml = allColors.map(c => {
                const isSel = selectedInquiryColor === c;
                return `
                    <button type="button" onclick="window.setInquiryVariantFilter('color', '${c.replace(/'/g, "\\'")}')"
                        style="padding: 5px 12px; border-radius: 8px; font-weight: 900; font-size: 0.88rem; cursor: pointer; transition: all 0.15s; flex-shrink: 0; ${isSel ? 'background: #2563eb; color: #ffffff; border: 2px solid #000000; box-shadow: 0 2px 8px rgba(0,0,0,0.3); transform: scale(1.05);' : 'background: #ffffff; color: #000000; border: 2px solid #2563eb;'}"
                        title="لون ${c}">
                        ${isSel ? '✓ ' : ''}${c}
                    </button>
                `;
            }).join('');

            filterSectionHtml = `
                <div style="background: #ffffff; border: 2px solid #cbd5e1; border-radius: 14px; padding: 12px 16px; margin-bottom: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.03); display: flex; flex-direction: column; gap: 10px;">
                    
                    <!-- شريط المقاسات السريع بأسلوب الكبسولات القابلة للتمرير الأفقي -->
                    ${allSizes.length > 0 ? `
                    <div style="display: flex; align-items: center; gap: 8px; overflow-x: auto; padding-bottom: 3px;" class="fast-scrollbar">
                        <span style="font-weight: 900; color: #000000; font-size: 0.92rem; display: flex; align-items: center; gap: 5px; flex-shrink: 0;">
                            <span>📏</span> المقاس (${allSizes.length}):
                        </span>
                        <button type="button" onclick="window.setInquiryVariantFilter('size', 'all')"
                            style="padding: 5px 12px; border-radius: 8px; font-weight: 900; font-size: 0.88rem; cursor: pointer; transition: all 0.15s; flex-shrink: 0; ${selectedInquirySize === 'all' ? 'background: #000000; color: #ffffff; border: 2px solid #000000;' : 'background: #ffffff; color: #000000; border: 2px solid #059669;'}">
                            الكل (${allSizes.length})
                        </button>
                        ${sizePillsHtml}
                    </div>
                    ` : ''}

                    <!-- شريط الألوان السريع بأسلوب الكبسولات -->
                    ${allColors.length > 0 ? `
                    <div style="display: flex; align-items: center; gap: 8px; overflow-x: auto; padding-bottom: 2px;" class="fast-scrollbar">
                        <span style="font-weight: 900; color: #000000; font-size: 0.92rem; display: flex; align-items: center; gap: 5px; flex-shrink: 0;">
                            <span>🎨</span> اللون (${allColors.length}):
                        </span>
                        <button type="button" onclick="window.setInquiryVariantFilter('color', 'all')"
                            style="padding: 5px 12px; border-radius: 8px; font-weight: 900; font-size: 0.88rem; cursor: pointer; transition: all 0.15s; flex-shrink: 0; ${selectedInquiryColor === 'all' ? 'background: #000000; color: #ffffff; border: 2px solid #000000;' : 'background: #ffffff; color: #000000; border: 2px solid #2563eb;'}">
                            الكل (${allColors.length})
                        </button>
                        ${colorPillsHtml}
                    </div>
                    ` : ''}

                    ${(selectedInquirySize !== 'all' || selectedInquiryColor !== 'all') ? `
                    <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 6px; border-top: 1.5px dashed #cbd5e1; flex-wrap: wrap; gap: 6px;">
                        <span style="font-size: 0.88rem; color: #000000; font-weight: 900;">
                            ⚡ معروض الآن: ${selectedInquirySize !== 'all' ? 'مقاس (' + selectedInquirySize + ')' : ''} ${selectedInquiryColor !== 'all' ? 'لون (' + selectedInquiryColor + ')' : ''} (${matchedVars.length} تشكيلة)
                        </span>
                        <button onclick="window.setInquiryVariantFilter('reset')"
                            style="background: #fee2e2; color: #991b1b; border: 2px solid #ef4444; padding: 4px 14px; border-radius: 8px; font-weight: 900; font-size: 0.84rem; cursor: pointer; transition: 0.15s;"
                            onmouseover="this.style.background='#fecaca'" onmouseout="this.style.background='#fee2e2'">
                            ✕ إعادة ضبط (عرض كل المقاسات والألوان)
                        </button>
                    </div>
                    ` : ''}

                </div>
            `;
        }

        let variantsTableHtml = '';
        if (hasVariants) {
            const cols = getInquiryColsSettings();
            const isSingleWh = selectedInquiryWarehouse !== 'all';
            const mainStoreName = 'المخزن الرئيسي';
            const branches = whList.filter(w => w !== mainStoreName);
            const showCost = shouldShowInquiryCostsAndWholesale();
            const targetWh = isSingleWh ? selectedInquiryWarehouse : (currentUserWh || mainStoreName);

            // =========================================================
            // 1. الوضع الرأسي (Detailed Table View): اللون أولاً ثم المقاس
            // =========================================================
            let thHtml = '<tr>';
            if (cols.index) {
                thHtml += `<th style="padding: 10px 6px; width: 40px; text-align: center; color: #000000; font-weight: 900; font-size: 0.9rem;">#</th>`;
            }
            // ✅ اللون أولاً بحجم ملموم ومضبوط وحبر أسود تقيل
            if (cols.color && allColors.length > 0) {
                thHtml += `<th style="padding: 10px 6px; text-align: center; width: 90px; max-width: 100px; color: #000000; background: #dbeafe; font-weight: 900; font-size: 0.95rem; border-left: 1.5px solid #93c5fd; border-right: 1.5px solid #93c5fd;">اللون</th>`;
            }
            // ✅ المقاس ثانياً بعد اللون
            if (cols.size && allSizes.length > 0) {
                thHtml += `<th style="padding: 10px 6px; text-align: center; width: 90px; max-width: 100px; color: #000000; background: #d1fae5; font-weight: 900; font-size: 0.95rem; border-left: 1.5px solid #6ee7b7; border-right: 1.5px solid #6ee7b7;">المقاس</th>`;
            }

            if (cols.whStock) {
                if (isSingleWh) {
                    thHtml += `<th style="padding: 10px 10px; text-align: center; background: #fef08a; color: #000000; font-weight: 900; font-size: 0.95rem; border-right: 2px solid #fde047; border-left: 2px solid #fde047;">رصيد (${selectedInquiryWarehouse})</th>`;
                } else {
                    thHtml += `<th style="padding: 10px 6px; text-align: center; background: #f1f5f9; color: #000000; font-weight: 900; font-size: 0.9rem;">${mainStoreName}</th>`;
                    branches.forEach(b => {
                        thHtml += `<th style="padding: 10px 6px; text-align: center; background: #f8fafc; color: #000000; font-weight: 900; font-size: 0.9rem;">${b}</th>`;
                    });
                }
            }

            if (cols.branchesTotal && !isSingleWh && branches.length > 0) {
                thHtml += `<th style="padding: 10px 6px; text-align: center; background: #e0f2fe; color: #000000; font-weight: 900; font-size: 0.9rem;">إجمالي الفروع</th>`;
            }

            if (cols.totalStock) {
                thHtml += `<th style="padding: 10px 6px; text-align: center; background: #dcfce7; color: #000000; font-weight: 900; font-size: 0.95rem;">الرصيد الكلي</th>`;
            }

            if (cols.retailPrice) {
                thHtml += `<th style="padding: 10px 6px; text-align: center; color: #000000; font-weight: 900; font-size: 0.9rem;">سعر القطاعي</th>`;
            }

            if (cols.wholesalePrice && showCost) {
                thHtml += `<th style="padding: 10px 6px; text-align: center; color: #000000; font-weight: 900; font-size: 0.9rem;">سعر الجملة</th>`;
            }

            if (cols.barcode) {
                thHtml += `<th style="padding: 10px 6px; text-align: center; color: #000000; font-weight: 900; font-size: 0.9rem;">الباركود الفريد</th>`;
            }

            if (cols.action) {
                thHtml += `<th style="padding: 10px 6px; text-align: center; width: 80px; color: #000000; font-weight: 900; font-size: 0.9rem;">إضافة</th>`;
            }

            thHtml += '</tr>';

            let trsHtml = '';
            if (matchedVars.length === 0) {
                trsHtml = `<tr><td colspan="15" style="padding: 24px; text-align: center; color: #000000; font-weight: 900; font-size: 1rem;">لا توجد تشكيلات مطابقة للمقاس واللون المحددين</td></tr>`;
            } else {
                trsHtml = matchedVars.map((v, idx) => {
                    let mainStock = 0;
                    let branchesStockTotal = 0;
                    let totalStock = 0;
                    let branchesCells = '';
                    let selectedWhStock = 0;
                    
                    if (v.warehouseStocks && typeof v.warehouseStocks === 'object') {
                        mainStock = parseFloat(v.warehouseStocks[mainStoreName]) || 0;
                        branches.forEach(b => {
                            const bStock = parseFloat(v.warehouseStocks[b]) || 0;
                            branchesStockTotal += bStock;
                            const isCurrent = b === currentUserWh;
                            const cellBg = isCurrent ? '#fef08a' : (bStock > 0 ? '#f8fafc' : '#ffffff');
                            branchesCells += `<td style="padding: 8px 6px; text-align: center; font-weight: 900; font-size: 0.95rem; background: ${cellBg}; color: #000000;">${bStock > 0 ? bStock : '-'}</td>`;
                        });
                        totalStock = mainStock + branchesStockTotal;

                        if (isSingleWh) {
                            if (v.warehouseStocks[selectedInquiryWarehouse] !== undefined) {
                                selectedWhStock = parseFloat(v.warehouseStocks[selectedInquiryWarehouse]) || 0;
                            } else if (selectedInquiryWarehouse === mainStoreName) {
                                selectedWhStock = parseFloat(v.stock !== undefined ? v.stock : 0) || 0;
                            }
                        }
                    } else {
                        totalStock = parseFloat(v.stock !== undefined ? v.stock : 0);
                        mainStock = totalStock; 
                        branches.forEach(b => {
                            const isCurrent = b === currentUserWh;
                            branchesCells += `<td style="padding: 8px 6px; text-align: center; font-weight: 900; font-size: 0.95rem; color: #000000; background: ${isCurrent ? '#fef08a' : '#ffffff'};">-</td>`;
                        });

                        if (isSingleWh) {
                            selectedWhStock = (selectedInquiryWarehouse === mainStoreName) ? totalStock : 0;
                        }
                    }

                    const formatStockBadge = (qty) => {
                        if (qty <= 0) return `<span style="background: #fee2e2; color: #000000; border: 1.5px solid #dc2626; padding: 2px 8px; border-radius: 8px; font-weight: 900; font-size: 0.88rem;">0</span>`;
                        return `<span style="background: #dcfce7; color: #000000; border: 2px solid #16a34a; padding: 3px 10px; border-radius: 8px; font-weight: 900; font-size: 0.95rem;">${qty}</span>`;
                    };

                    const mainIsCurrent = mainStoreName === currentUserWh;

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

                    const isWhMatchCart = isSingleWh ? (selectedInquiryWarehouse === currentUserWh) : mainIsCurrent;
                    const vInCartBadge = (vInCart > 0 && isWhMatchCart)
                        ? `<div style="font-size: 0.76rem; color: #000000; font-weight: 900; margin-top: 2px;">(بالسلة: ${vInCart})</div>`
                        : '';
                    
                    // أسعار وباركود التشكيلة
                    const vRetail = parseFloat(v.price !== undefined ? v.price : retailPrice) || 0;
                    const vWs = parseFloat(v.wholesale !== undefined ? v.wholesale : wholesalePrice) || 0;
                    const vBarcode = v.barcode || '---';

                    const actualVariantIndex = (p.variants && Array.isArray(p.variants)) ? p.variants.indexOf(v) : -1;
                    let addBtn = '';
                    if (totalStock > 0 || (v.allowOversell)) {
                        addBtn = `<button onclick="window.addInquiryVariantByIndex(${actualVariantIndex})" style="background: #059669; color: #ffffff; border: 1.5px solid #047857; border-radius: 8px; padding: 5px 12px; cursor: pointer; font-size: 0.88rem; font-weight: 900; box-shadow: 0 2px 6px rgba(0,0,0,0.15); transition: 0.2s;" onmouseover="this.style.background='#047857'" onmouseout="this.style.background='#059669'">➕ سلة</button>`;
                    } else {
                        addBtn = `<button disabled style="background: #e2e8f0; color: #475569; border: 1px solid #cbd5e1; border-radius: 8px; padding: 5px 12px; font-size: 0.85rem; font-weight: 900; cursor: not-allowed;">نفذ</button>`;
                    }

                    let rowTds = '';
                    if (cols.index) {
                        rowTds += `<td style="padding: 8px 6px; text-align: center; color: #000000; font-weight: 900; font-size: 0.95rem; width: 40px;">${idx + 1}</td>`;
                    }
                    // ✅ اللون أولاً بحجم ملموم ومضبوط وحبر أسود تقيل
                    if (cols.color && allColors.length > 0) {
                        rowTds += `<td style="padding: 8px 6px; text-align: center; width: 90px; max-width: 100px;">
                            <span style="background: #eff6ff; border: 2px solid #2563eb; color: #000000; font-weight: 900; font-size: 0.95rem; padding: 3px 10px; border-radius: 8px; display: inline-block; max-width: 85px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${v.color || 'موحد'}">${v.color || 'موحد'}</span>
                        </td>`;
                    }
                    // ✅ المقاس ثانياً بعد اللون وحبر أسود تقيل
                    if (cols.size && allSizes.length > 0) {
                        rowTds += `<td style="padding: 8px 6px; text-align: center; width: 90px; max-width: 100px;">
                            <span style="background: #ecfdf5; border: 2px solid #059669; color: #000000; font-weight: 900; font-size: 0.95rem; padding: 3px 10px; border-radius: 8px; display: inline-block; max-width: 85px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${v.size || 'قياسي'}">${v.size || 'قياسي'}</span>
                        </td>`;
                    }

                    if (cols.whStock) {
                        if (isSingleWh) {
                            rowTds += `<td style="padding: 8px 6px; text-align: center; font-weight: 900; background: #fef9c3; border-right: 2px solid #fde047; border-left: 2px solid #fde047;">${formatStockBadge(selectedWhStock)}${vInCartBadge}</td>`;
                        } else {
                            rowTds += `<td style="padding: 8px 6px; text-align: center; background: ${mainIsCurrent ? '#fef08a' : 'rgba(0,0,0,0.02)'};">${formatStockBadge(mainStock)}${vInCartBadge}</td>`;
                            rowTds += branchesCells;
                        }
                    }

                    if (cols.branchesTotal && !isSingleWh && branches.length > 0) {
                        rowTds += `<td style="padding: 8px 6px; text-align: center; font-weight: 900; color: #000000; background: #f0f9ff; font-size: 0.95rem;">${branchesStockTotal > 0 ? branchesStockTotal : '-'}</td>`;
                    }

                    if (cols.totalStock) {
                        rowTds += `<td style="padding: 8px 6px; text-align: center; background: #f0fdf4;">${formatStockBadge(totalStock)}</td>`;
                    }

                    if (cols.retailPrice) {
                        rowTds += `<td style="padding: 8px 6px; text-align: center; font-weight: 900; color: #000000; font-size: 0.95rem; font-family: monospace;">${vRetail.toFixed(2)}</td>`;
                    }

                    if (cols.wholesalePrice && showCost) {
                        rowTds += `<td style="padding: 8px 6px; text-align: center; font-weight: 900; color: #000000; font-size: 0.95rem; font-family: monospace;">${vWs.toFixed(2)}</td>`;
                    }

                    if (cols.barcode) {
                        const safeBarcode = String(v.barcode || '').replace(/'/g, "\\'");
                        const hasBarcode = Boolean(v.barcode && String(v.barcode).trim() && v.barcode !== '---');
                        const barcodeHtml = `
                            <div style="display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
                                <span style="font-family: monospace; font-size: 0.88rem; font-weight: 900; color: #000000; background: #ffffff; padding: 2px 8px; border-radius: 6px; border: 1.5px solid #000000;">
                                    ${vBarcode}
                                </span>
                                ${hasBarcode ? `
                                    <button type="button" onclick="event.stopPropagation(); window.copyInquiryBarcode('${safeBarcode}', this);" 
                                        title="نسخ الباركود"
                                        style="background: #ffffff; border: 1.5px solid #000000; border-radius: 6px; padding: 2px 6px; cursor: pointer; font-size: 0.82rem; line-height: 1; color: #000000; transition: all 0.15s; display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"
                                        onmouseover="this.style.borderColor='#059669'; this.style.color='#047857'; this.style.background='#ecfdf5';"
                                        onmouseout="this.style.borderColor='#000000'; this.style.color='#000000'; this.style.background='#ffffff';">
                                        📋
                                    </button>
                                ` : ''}
                            </div>
                        `;
                        rowTds += `<td style="padding: 8px 6px; text-align: center;">${barcodeHtml}</td>`;
                    }

                    if (cols.action) {
                        rowTds += `<td style="padding: 8px 6px; text-align: center;">${addBtn}</td>`;
                    }

                    return `<tr data-variant-row="true" style="border-bottom: 1.5px solid #cbd5e1; transition: background 0.1s;">${rowTds}</tr>`;
                }).join('');
            }

            // =========================================================
            // 2. الوضع الأفقي (Horizontal Matrix View): الألوان ثم المقاسات أفقياً بحبر أسود تقيل
            // =========================================================
            let matrixHtml = '';
            if (inquiryViewMode === 'horizontal') {
                const matrixSizes = (allSizes.length > 0) ? allSizes : ['عام'];
                const matrixColors = (allColors.length > 0) ? allColors : ['موحد'];

                let matrixTh = `
                    <tr style="background: #f1f5f9; color: #000000; font-size: 0.95rem; border-bottom: 2px solid #cbd5e1;">
                        <th style="padding: 10px 10px; width: 110px; max-width: 120px; text-align: center; color: #000000; background: #dbeafe; font-weight: 900; border-left: 2px solid #93c5fd; border-right: 2px solid #93c5fd;">الألوان</th>
                        ${matrixSizes.map(s => `
                            <th style="padding: 10px 8px; text-align: center; color: #000000; background: #d1fae5; font-weight: 900; border-left: 1.5px solid #6ee7b7; min-width: 55px; font-size: 0.95rem;">
                                ${s}
                            </th>
                        `).join('')}
                    </tr>
                `;

                let matrixRows = matrixColors.map(c => {
                    let sizeCells = matrixSizes.map(s => {
                        // البحث عن التشكيلة المطابقة للون والمقاس
                        const vMatch = variants.find(vr => {
                            const matchColor = (allColors.length > 0) ? (vr.color || '').trim() === c.trim() : true;
                            const matchSize = (allSizes.length > 0) ? (vr.size || '').trim() === s.trim() : true;
                            return matchColor && matchSize;
                        });

                        if (vMatch) {
                            const vIdx = variants.indexOf(vMatch);
                            let sQty = 0;
                            if (vMatch.warehouseStocks && typeof vMatch.warehouseStocks === 'object' && vMatch.warehouseStocks[targetWh] !== undefined) {
                                sQty = parseFloat(vMatch.warehouseStocks[targetWh]) || 0;
                            } else if (targetWh === mainStoreName || !vMatch.warehouseStocks) {
                                sQty = parseFloat(vMatch.stock !== undefined ? vMatch.stock : 0) || 0;
                            }

                            if (sQty > 0) {
                                return `
                                    <td style="padding: 8px 4px; text-align: center; border-left: 1.5px solid #e2e8f0; min-width: 55px;" data-variant-row="true">
                                        <button type="button" onclick="window.addInquiryVariantByIndex(${vIdx})" 
                                            title="انقر لإضافة (${c !== 'موحد' ? c + ' - ' : ''}مقاس ${s}) للسلة [المتاح بمخزن ${targetWh}: ${sQty}]"
                                            style="background: #dcfce7; color: #000000; border: 2px solid #059669; border-radius: 8px; padding: 4px 8px; font-weight: 900; font-size: 0.95rem; cursor: pointer; transition: all 0.15s; min-width: 46px; box-shadow: 0 1px 4px rgba(0,0,0,0.15);"
                                            onmouseover="this.style.background='#059669'; this.style.color='#ffffff'; this.style.transform='scale(1.08)';"
                                            onmouseout="this.style.background='#dcfce7'; this.style.color='#000000'; this.style.transform='scale(1)';">
                                            <span style="font-size: 0.75rem; margin-left: 2px;">🛒</span><b style="font-size: 1rem;">${sQty}</b>
                                        </button>
                                    </td>
                                `;
                            } else {
                                return `
                                    <td style="padding: 8px 4px; text-align: center; border-left: 1.5px solid #e2e8f0; min-width: 55px; color: #64748b; font-weight: 900; font-size: 0.9rem;" data-variant-row="true">-</td>
                                `;
                            }
                        } else {
                            return `<td style="padding: 8px 4px; text-align: center; border-left: 1.5px solid #e2e8f0; min-width: 55px; color: #64748b; font-weight: 900; font-size: 0.9rem;" data-variant-row="true">-</td>`;
                        }
                    }).join('');

                    return `
                        <tr data-variant-row="true" style="border-bottom: 1.5px solid #cbd5e1; transition: background 0.15s;" onmouseover="this.style.background='#f1f5f9';" onmouseout="this.style.background='#ffffff';">
                            <td style="padding: 10px 10px; text-align: center; width: 110px; max-width: 120px; background: #fafafa; border-left: 2px solid #93c5fd; border-right: 2px solid #93c5fd;">
                                <span style="background: #eff6ff; border: 2px solid #1e40af; color: #000000; font-weight: 900; font-size: 0.95rem; padding: 4px 12px; border-radius: 8px; display: inline-block; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${c}">${c}</span>
                            </td>
                            ${sizeCells}
                        </tr>
                    `;
                }).join('');

                matrixHtml = `
                    <div style="max-height: 280px; overflow-y: auto; overflow-x: auto; border-radius: 0 0 14px 14px;" class="fast-scrollbar">
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem; white-space: nowrap;">
                            <thead style="background: #f8fafc; color: #000000; position: sticky; top: 0; z-index: 2;">
                                ${matrixTh}
                            </thead>
                            <tbody>
                                ${matrixRows}
                            </tbody>
                        </table>
                    </div>
                `;
            }

            let verticalTableHtml = `
                <div style="max-height: 260px; overflow-y: auto; overflow-x: auto; border-radius: 0 0 14px 14px;" class="fast-scrollbar">
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.88rem; white-space: nowrap;">
                        <thead style="background: #f8fafc; color: #000000; position: sticky; top: 0; z-index: 2; border-bottom: 1.5px solid #cbd5e1; font-size: 0.88rem;">
                            ${thHtml}
                        </thead>
                        <tbody>
                            ${trsHtml}
                        </tbody>
                    </table>
                </div>
            `;

            const renderColCheckbox = (key, label, isChecked) => `
                <label style="display: flex; align-items: center; gap: 10px; font-size: 0.90rem; font-weight: 900; color: #000000; cursor: pointer; padding: 6px 10px; border-radius: 8px; transition: 0.15s; user-select: none;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
                    <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="window.toggleInquiryColVisibility('${key}', this.checked)" style="width: 18px; height: 18px; accent-color: #059669; cursor: pointer; flex-shrink: 0;">
                    <span style="color: #000000; font-weight: 900;">${label}</span>
                </label>
            `;

            variantsTableHtml = `
                <!-- 1.5 جدول التشكيلات للفاشون مع دعم العرض الأفقي والرأسي وتخصيص الأعمدة وتحديد المخزن -->
                <div style="background: #ffffff; border: 2px solid #cbd5e1; border-radius: 14px; overflow: visible; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                    <div style="background: linear-gradient(135deg, #f1f5f9, #e2e8f0); padding: 10px 16px; border-bottom: 1.5px solid #cbd5e1; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; border-radius: 14px 14px 0 0; position: relative;">
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <span style="font-weight: 900; color: #000000; font-size: 1rem; display: flex; align-items: center; gap: 6px;">
                                <span>👕</span> تفاصيل الأرصدة للمقاسات والألوان
                            </span>

                            <!-- حقل فلترة فورية وسريعة داخل الجدول -->
                            <div style="position: relative;">
                                <input type="text" id="inquiryVariantLiveFilter"
                                    placeholder="🔍 فلترة سريعة (اكتب: 38)..."
                                    oninput="window.filterInquiryVariantsLive(this.value)"
                                    style="height: 32px; border-radius: 8px; border: 2px solid #059669; padding: 0 10px; font-size: 0.85rem; font-weight: 900; outline: none; background: #ffffff; color: #000000; width: 180px; box-shadow: inset 0 1px 3px rgba(0,0,0,0.05);"
                                    title="فلترة فورية لصفوف المقاسات والألوان داخل الجدول">
                            </div>

                            <!-- أزرار التبديل الذكية بين العرض الأفقي والرأسي -->
                            <div style="display: inline-flex; align-items: center; background: #e2e8f0; padding: 2px; border-radius: 8px; border: 1.5px solid #cbd5e1; gap: 2px;">
                                <button type="button" onclick="window.setInquiryViewMode('horizontal')" 
                                    title="عرض المقاسات أفقياً بجانب كل لون"
                                    style="background: ${inquiryViewMode === 'horizontal' ? '#059669' : '#ffffff'}; color: ${inquiryViewMode === 'horizontal' ? '#ffffff' : '#000000'}; border: 1.5px solid #000000; border-radius: 6px; padding: 5px 12px; font-weight: 900; font-size: 0.82rem; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: 0.15s;">
                                    <span>📊</span> المقاسات أفقي
                                </button>
                                <button type="button" onclick="window.setInquiryViewMode('vertical')" 
                                    title="عرض تفصيلي رأسي مع خيارات تخصيص الأعمدة"
                                    style="background: ${inquiryViewMode === 'vertical' ? '#059669' : '#ffffff'}; color: ${inquiryViewMode === 'vertical' ? '#ffffff' : '#000000'}; border: 1.5px solid #000000; border-radius: 6px; padding: 5px 12px; font-weight: 900; font-size: 0.82rem; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: 0.15s;">
                                    <span>📑</span> تفصيلي رأسي
                                </button>
                            </div>

                            ${isSingleWh ? `
                                <span style="background: #fef08a; color: #000000; border: 2px solid #fde047; padding: 3px 12px; border-radius: 8px; font-weight: 900; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 6px;">
                                    🏢 المخزن المحدد: ${selectedInquiryWarehouse}
                                    <button type="button" onclick="window.setInquirySelectedWarehouse('all')" title="إلغاء التحديد وعرض كل المخازن" style="background: #ffffff; border: 1.5px solid #000000; color: #000000; font-weight: 900; cursor: pointer; border-radius: 4px; padding: 0 6px; font-size: 0.74rem; line-height: 1.4;">✕ إظهار الكل</button>

                                </span>
                            ` : `
                                <span style="background: #e0f2fe; color: #000000; border: 2px solid #7dd3fc; padding: 3px 12px; border-radius: 8px; font-weight: 900; font-size: 0.85rem;">
                                    🏢 المخزن المعروض: ${targetWh} (انقر أي مخزن بالأعلى للتغيير)
                                </span>
                            `}
                        </div>

                        ${inquiryViewMode === 'vertical' ? `
                            <!-- زر وقائمة تخصيص الأعمدة في الوضع الرأسي -->
                            <div style="position: relative;">
                                <button type="button" id="inquiryColCustomizerBtn" onclick="window.toggleInquiryColCustomizer(event)" 
                                    style="background: #ffffff; color: #000000; border: 2px solid #000000; padding: 6px 14px; border-radius: 8px; font-weight: 900; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); transition: 0.2s;"
                                    onmouseover="this.style.background='#f1f5f9';"
                                    onmouseout="this.style.background='#ffffff';">
                                    <span>⚙️</span> تخصيص الأعمدة
                                </button>

                                <div id="inquiryColDropdown" style="display: ${isColCustomizerOpen ? 'block' : 'none'}; position: absolute; right: 0; left: auto; top: 40px; background: #ffffff; border: 2.5px solid #000000; border-radius: 12px; box-shadow: 0 15px 35px rgba(0,0,0,0.3); padding: 12px 14px; min-width: 250px; width: max-content; max-width: 290px; z-index: 10000; text-align: right;" onclick="event.stopPropagation();">
                                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #cbd5e1; padding-bottom: 8px; margin-bottom: 8px;">
                                        <span style="font-weight: 900; color: #000000; font-size: 0.95rem; display: flex; align-items: center; gap: 6px;">
                                            <span>⚙️</span> تخصيص الأعمدة
                                        </span>
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <button type="button" onclick="window.resetInquiryColsToDefault()" style="background: #ecfdf5; border: 1.5px solid #059669; color: #047857; font-size: 0.78rem; font-weight: 900; cursor: pointer; padding: 2px 8px; border-radius: 6px; transition: 0.15s;">الافتراضي</button>
                                            <button type="button" onclick="window.toggleInquiryColCustomizer(event)" style="background: #f1f5f9; border: 1.5px solid #000000; color: #000000; font-size: 1rem; font-weight: 900; cursor: pointer; width: 26px; height: 26px; border-radius: 6px; display: flex; align-items: center; justify-content: center; line-height: 1;">✕</button>
                                        </div>
                                    </div>
                                    <div style="display: flex; flex-direction: column; gap: 3px; max-height: 270px; overflow-y: auto; padding-right: 2px;" class="fast-scrollbar">
                                        ${renderColCheckbox('index', 'م (#)', cols.index)}
                                        ${allColors.length > 0 ? renderColCheckbox('color', 'اللون (العمود الأول)', cols.color) : ''}
                                        ${allSizes.length > 0 ? renderColCheckbox('size', 'المقاس (العمود الثاني)', cols.size) : ''}
                                        ${renderColCheckbox('whStock', 'رصيد المخزن المحدد / المخازن', cols.whStock)}
                                        ${!isSingleWh ? renderColCheckbox('branchesTotal', 'إجمالي الفروع', cols.branchesTotal) : ''}
                                        ${renderColCheckbox('totalStock', 'الرصيد الكلي', cols.totalStock)}
                                        ${renderColCheckbox('retailPrice', 'سعر القطاعي', cols.retailPrice)}
                                        ${showCost ? renderColCheckbox('wholesalePrice', 'سعر الجملة', cols.wholesalePrice) : ''}
                                        ${renderColCheckbox('barcode', 'الباركود الفريد', cols.barcode)}
                                        ${renderColCheckbox('action', 'زر الإضافة (سلة)', cols.action)}
                                    </div>
                                </div>
                            </div>
                        ` : `
                            <span style="font-size: 0.78rem; color: #065f46; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 4px 10px; border-radius: 8px; font-weight: 800;">
                                💡 انقر على المقاس المتوفر لإضافته للسلة فوراً
                            </span>
                        `}
                    </div>

                    ${inquiryViewMode === 'horizontal' ? matrixHtml : verticalTableHtml}
                </div>
            `;
        }

        return `
            ${filterSectionHtml}

            <div style="display: grid; grid-template-columns: minmax(0, 1fr) 260px; gap: 16px; align-items: start; width: 100%; box-sizing: border-box;">
                
                <!-- العمود الأيمن: جدول كمية الصنف في المخازن وبلوكات الأسعار -->
                <div style="display: flex; flex-direction: column; gap: 16px; min-width: 0; width: 100%; box-sizing: border-box;">
                    
                    <!-- 1. جدول كمية الصنف في المخازن (مطابق للصورة 3) -->
                    <div style="background: #ffffff; border: 2px solid #cbd5e1; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                        <div style="background: linear-gradient(135deg, #f1f5f9, #e2e8f0); padding: 10px 16px; border-bottom: 2px solid #cbd5e1; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-weight: 900; color: #000000; font-size: 1rem; display: flex; align-items: center; gap: 6px;">
                                    <span>🏢</span> كمية الصنف في المخازن (مرتبة بالأعلى رصيداً)
                                </span>
                                ${selectedInquiryWarehouse !== 'all' ? `
                                    <button type="button" onclick="window.setInquirySelectedWarehouse('all')" 
                                        title="إلغاء تحديد المخزن وإظهار كافة المخازن بالجدول التفصيلي"
                                        style="background: #fee2e2; color: #991b1b; border: 2px solid #ef4444; padding: 3px 10px; border-radius: 6px; font-weight: 900; font-size: 0.8rem; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                                        ✕ إظهار كل المخازن
                                    </button>
                                ` : ''}
                            </div>
                            <span style="background: #000000; color: #fbbf24; border: 1.5px solid #000000; padding: 3px 12px; border-radius: 8px; font-weight: 900; font-size: 0.88rem;">
                                إجمالي كل الفروع: ${grandTotalStock.toFixed(2).replace(/\.00$/, '')} ${p.unit || 'قطعة'}
                            </span>
                        </div>

                        <div style="max-height: 220px; overflow-y: auto;" class="fast-scrollbar">
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.92rem;">
                                <thead style="background: #e2e8f0; color: #000000; position: sticky; top: 0; z-index: 2; border-bottom: 2px solid #cbd5e1;">
                                    <tr>
                                        <th style="padding: 10px 6px; width: 60px; text-align: center; color: #000000; font-weight: 900; font-size: 0.95rem;">تحديد</th>
                                        <th style="padding: 10px 12px; width: 40px; text-align: center; color: #000000; font-weight: 900; font-size: 0.95rem;">م</th>
                                        <th style="padding: 10px 14px; text-align: right; color: #000000; font-weight: 900; font-size: 0.95rem;">المخزن / الفرع</th>
                                        <th style="padding: 10px 12px; text-align: center; width: 140px; color: #000000; font-weight: 900; font-size: 0.95rem;">الكمية المتاحة</th>
                                        <th style="padding: 10px 12px; text-align: center; width: 100px; color: #000000; font-weight: 900; font-size: 0.95rem;">كمية حجز</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${whTableRowsHtml}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    ${variantsTableHtml}
                    <!-- 2. بلوك وشبكة أسعار البيع وتكاليف الشراء (مع حماية الخصوصية وحبر أسود تقيل) -->
                    <div style="background: #ffffff; border: 2px solid #cbd5e1; border-radius: 14px; padding: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                        <div style="font-weight: 900; color: #000000; font-size: 0.95rem; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
                            <span style="display: flex; align-items: center; gap: 6px;">
                                <span>💰</span> ${shouldShowInquiryCostsAndWholesale() ? 'أسعار البيع والتكلفة الحالية:' : 'سعر البيع المعتمد:'}
                            </span>
                            ${!shouldShowInquiryCostsAndWholesale() ? `
                                <span style="background: #f1f5f9; color: #000000; font-size: 0.76rem; font-weight: 900; padding: 3px 10px; border-radius: 6px; border: 1.5px solid #cbd5e1;">
                                    🔒 أسعار الجملة والتكلفة محمية
                                </span>
                            ` : ''}
                        </div>

                        ${shouldShowInquiryCostsAndWholesale() ? `
                            <!-- الصف الأول: أسعار البيع بالكامل -->
                            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                                <div style="background: #f0fdf4; border: 2px solid #86efac; border-radius: 10px; padding: 8px 12px; text-align: center;">
                                    <div style="font-size: 0.85rem; font-weight: 900; color: #000000;">بيع القطاعي</div>
                                    <div style="font-size: 1.3rem; font-weight: 900; color: #000000; font-family: monospace; margin-top: 2px;">
                                        ${retailPrice.toFixed(2)}
                                    </div>
                                </div>
                                <div style="background: #eff6ff; border: 2px solid #93c5fd; border-radius: 10px; padding: 8px 12px; text-align: center;">
                                    <div style="font-size: 0.85rem; font-weight: 900; color: #000000;">بيع جملة</div>
                                    <div style="font-size: 1.3rem; font-weight: 900; color: #000000; font-family: monospace; margin-top: 2px;">
                                        ${wholesalePrice.toFixed(2)}
                                    </div>
                                </div>
                                <div style="background: #faf5ff; border: 2px solid #d8b4fe; border-radius: 10px; padding: 8px 12px; text-align: center;">
                                    <div style="font-size: 0.85rem; font-weight: 900; color: #000000;">نصف جملة</div>
                                    <div style="font-size: 1.3rem; font-weight: 900; color: #000000; font-family: monospace; margin-top: 2px;">
                                        ${halfWholesalePrice.toFixed(2)}
                                    </div>
                                </div>
                            </div>

                            <!-- الصف الثاني: أسعار وتكاليف الشراء -->
                            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
                                <div style="background: #f8fafc; border: 2px solid #cbd5e1; border-radius: 10px; padding: 8px 12px; text-align: center;">
                                    <div style="font-size: 0.82rem; font-weight: 900; color: #000000;">متوسط سعر الشراء</div>
                                    <div style="font-size: 1.2rem; font-weight: 900; color: #000000; font-family: monospace; margin-top: 2px;">
                                        ${avgPurchasePrice.toFixed(2)}
                                    </div>
                                </div>
                                <div style="background: #f8fafc; border: 2px solid #cbd5e1; border-radius: 10px; padding: 8px 12px; text-align: center;">
                                    <div style="font-size: 0.82rem; font-weight: 900; color: #000000;">آخر سعر شراء</div>
                                    <div style="font-size: 1.2rem; font-weight: 900; color: #000000; font-family: monospace; margin-top: 2px;">
                                        ${lastPurchasePrice.toFixed(2)}
                                    </div>
                                </div>
                                <div style="background: #fef2f2; border: 2px solid #fca5a5; border-radius: 10px; padding: 8px 12px; text-align: center;">
                                    <div style="font-size: 0.82rem; font-weight: 900; color: #000000;">آخر سعر شراء صافي</div>
                                    <div style="font-size: 1.2rem; font-weight: 900; color: #000000; font-family: monospace; margin-top: 2px;">
                                        ${costPrice.toFixed(2)}
                                    </div>
                                </div>
                            </div>
                        ` : `
                            <!-- كارت سعر القطاعي الوحيد الفاخر والمحمي عند إخفاء التكلفة -->
                            <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 2.5px solid #16a34a; border-radius: 12px; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
                                <div>
                                    <div style="font-size: 0.95rem; font-weight: 900; color: #000000; display: flex; align-items: center; gap: 6px;">
                                        <span>🏷️</span> سعر بيع المستهلك (قطاعي):
                                    </div>
                                    <div style="font-size: 0.82rem; color: #000000; font-weight: 800; margin-top: 2px;">السعر الرسمي المعتمد للفاتورة</div>
                                </div>
                                <div style="font-size: 1.8rem; font-weight: 900; color: #000000; font-family: monospace;">
                                    ${retailPrice.toFixed(2)} <span style="font-size: 1rem; font-family: 'Cairo'; font-weight: 900;">ج.م</span>
                                </div>
                            </div>
                        `}

                    </div>

                </div>

                <!-- العمود الأيسر: صورة الموديل والكارت الجانبي (مطابق للصورة 3) -->
                <div style="display: flex; flex-direction: column; gap: 14px; width: 260px; flex-shrink: 0; box-sizing: border-box;">
                    
                    <!-- كارت صورة الموديل -->
                    <div style="background: #ffffff; border: 2px solid #cbd5e1; border-radius: 14px; padding: 14px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.03); width: 100%; box-sizing: border-box;">
                        <div style="font-weight: 900; font-size: 0.92rem; color: #000000; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; gap: 6px;">
                            <span>📸</span> صورة الموديل / الصنف
                        </div>
                        <div style="height: 190px; background: #f8fafc; border: 2px dashed #94a3b8; border-radius: 12px; display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative; padding: 4px; box-sizing: border-box;">
                            ${p.image ? `
                                <img src="${p.image}" alt="${p.name}" style="max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain; border-radius: 8px;">
                            ` : `
                                <div style="display: flex; flex-direction: column; align-items: center; color: #475569;">
                                    <span style="font-size: 3.5rem;">👗</span>
                                    <span style="font-size: 0.85rem; font-weight: 900; color: #000000; margin-top: 4px;">لا توجد صورة مسجلة</span>
                                </div>
                            `}
                        </div>
                    </div>

                    <!-- كارت ملخص تشكيلات الفاشون السريع -->
                    <div style="background: linear-gradient(135deg, #1e293b, #0f172a); color: white; border-radius: 14px; padding: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); border: 1.5px solid #334155;">
                        <div style="font-size: 0.88rem; font-weight: 900; color: #fbbf24; margin-bottom: 8px;">
                            ✨ ملخص التشكيلات (Variants):
                        </div>
                        <div style="font-size: 0.88rem; color: #ffffff; line-height: 1.7; font-weight: 800;">
                            <div>• المقاسات: <b style="color: #6ee7b7; font-weight: 900;">${allSizes.length > 0 ? allSizes.join(' | ') : 'عام'}</b></div>
                            <div>• الألوان: <b style="color: #93c5fd; font-weight: 900;">${allColors.length > 0 ? allColors.join(' | ') : 'عام'}</b></div>
                            <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.2); color: #fbbf24; font-weight: 900; font-size: 0.95rem;">
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
            ? transactions.filter(t => (t.product === p.name || t.productName === p.name || t.id == p.id || t.productId == p.id) && !(t.type && t.type.includes('تحويل') && t.transferStatus === 'rejected'))
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

            if (rawType.includes('مرتجع') || rawType.includes('return')) {
                const isPurRet = rawType.includes('شراء') || rawType.includes('purchase');
                typeLabel = isPurRet ? 'مرتجع شراء' : 'مرتجع بيع';
                typeBg = '#fff7ed';
                typeColor = '#c2410c';
            } else if (rawType.includes('شراء') || rawType.includes('purchase')) {
                typeLabel = 'شراء';
                typeBg = '#eff6ff';
                typeColor = '#1d4ed8';
            } else if (rawType.includes('تحويل') || rawType.includes('transfer')) {
                if (tx.transferStatus === 'pending') {
                    typeLabel = 'تحويل مخزن (معلق ⏳)';
                    typeBg = '#fef3c7';
                    typeColor = '#b45309';
                } else if (tx.transferStatus === 'rejected') {
                    typeLabel = 'تحويل مخزن (مرفوض ❌)';
                    typeBg = '#fee2e2';
                    typeColor = '#b91c1c';
                } else {
                    typeLabel = 'تحويل مخزن (مستلم ✅)';
                    typeBg = '#dcfce7';
                    typeColor = '#15803d';
                }
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

            const isPurchase = (rawType.includes('شراء') || rawType.includes('purchase')) && !rawType.includes('مرتجع بيع');
            const canViewCost = shouldShowInquiryCostsAndWholesale();
            const displayPrice = (isPurchase && !canViewCost)
                ? `<span style="color: #94a3b8; font-size: 0.75rem; font-weight: 800;">🔒 محجوب</span>`
                : price.toFixed(2);
            const displayTotal = (isPurchase && !canViewCost)
                ? `<span style="color: #94a3b8; font-size: 0.75rem; font-weight: 800;">🔒 محجوب</span>`
                : total.toFixed(2);

            const hasInv = tx.invoiceId && String(tx.invoiceId) !== '-';

            return `
                <tr style="border-bottom: 1.5px solid #cbd5e1; ${idx % 2 === 1 ? 'background: #f8fafc;' : 'background: #ffffff;'} ${hasInv ? 'cursor: pointer;' : ''}"
                    ${hasInv ? `title="اضغط لعرض أو طباعة الفاتورة #${tx.invoiceId}" onclick="if(typeof viewInvoiceItems==='function') viewInvoiceItems('${tx.invoiceId}', '${tx.type}')"` : ''}>
                    <td style="padding: 10px 10px; font-weight: 900; text-align: center; color: #000000; font-size: 0.95rem;">${idx + 1}</td>
                    <td style="padding: 10px 12px; font-weight: 900; color: #000000; font-size: 0.88rem; white-space: nowrap;">
                        ${tx.date || tx.dateISO || '-'}
                    </td>
                    <td style="padding: 10px 10px; text-align: center;">
                        <span style="background: ${typeBg}; color: #000000; border: 1.5px solid #000000; padding: 3px 10px; border-radius: 6px; font-weight: 900; font-size: 0.82rem;">
                            ${typeLabel}
                        </span>
                    </td>
                    <td style="padding: 10px 10px; text-align: center; font-weight: 900; color: #000000; font-size: 0.95rem;">${sSize}</td>
                    <td style="padding: 10px 10px; text-align: center; font-weight: 900; color: #000000; font-size: 0.95rem;">${sColor}</td>
                    <td style="padding: 10px 10px; text-align: center; font-weight: 900; color: #000000; font-size: 1rem;">${qty}</td>
                    <td style="padding: 10px 10px; text-align: center; color: #000000; font-weight: 900; font-size: 0.88rem;">${tx.unit || p.unit || 'قطعة'}</td>
                    <td style="padding: 10px 10px; text-align: center; font-weight: 900; font-family: monospace; color: #000000; font-size: 0.95rem;">${displayPrice}</td>
                    <td style="padding: 10px 10px; text-align: center; color: #000000; font-weight: 900; font-size: 0.95rem;">${parseFloat(tx.discount || 0).toFixed(2)}</td>
                    <td style="padding: 10px 12px; text-align: center; font-weight: 900; color: #000000; font-family: monospace; font-size: 1rem;">${displayTotal}</td>
                    <td style="padding: 10px 14px; text-align: right; font-weight: 900; color: #000000; font-size: 0.95rem;">${partner}</td>
                </tr>
            `;
        }).join('');

        return `
            <div style="background: #ffffff; border: 2px solid #cbd5e1; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                <div style="background: linear-gradient(135deg, #f1f5f9, #e2e8f0); padding: 10px 16px; border-bottom: 2px solid #cbd5e1; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: 900; color: #000000; font-size: 1rem; display: flex; align-items: center; gap: 6px;">
                        <span>📜</span> سجل حركة الصنف التفصيلية (أحدث ${pTx.length} حركة ${allTx.length > 50 ? `من إجمالي ${allTx.length}` : ''})
                    </span>
                </div>

                <div style="max-height: 380px; overflow-y: auto;" class="fast-scrollbar">
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                        <thead style="background: #e2e8f0; color: #000000; position: sticky; top: 0; z-index: 2; border-bottom: 2px solid #cbd5e1;">
                            <tr>
                                <th style="padding: 10px 10px; text-align: center; color: #000000; font-weight: 900; font-size: 0.92rem;">م</th>
                                <th style="padding: 10px 12px; text-align: right; color: #000000; font-weight: 900; font-size: 0.92rem;">التاريخ</th>
                                <th style="padding: 10px 10px; text-align: center; color: #000000; font-weight: 900; font-size: 0.92rem;">الحركة</th>
                                <th style="padding: 10px 10px; text-align: center; color: #000000; font-weight: 900; font-size: 0.92rem;">المقاس</th>
                                <th style="padding: 10px 10px; text-align: center; color: #000000; font-weight: 900; font-size: 0.92rem;">اللون</th>
                                <th style="padding: 10px 10px; text-align: center; color: #000000; font-weight: 900; font-size: 0.92rem;">الكمية</th>
                                <th style="padding: 10px 10px; text-align: center; color: #000000; font-weight: 900; font-size: 0.92rem;">الوحدة</th>
                                <th style="padding: 10px 10px; text-align: center; color: #000000; font-weight: 900; font-size: 0.92rem;">السعر</th>
                                <th style="padding: 10px 10px; text-align: center; color: #000000; font-weight: 900; font-size: 0.92rem;">الخصم</th>
                                <th style="padding: 10px 12px; text-align: center; color: #000000; font-weight: 900; font-size: 0.92rem;">الإجمالي</th>
                                <th style="padding: 10px 14px; text-align: right; color: #000000; font-weight: 900; font-size: 0.92rem;">الحساب / الطرف الثاني</th>
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
            <div style="background: #ffffff; border: 2px solid #cbd5e1; border-radius: 14px; padding: 22px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                <h4 style="margin: 0 0 16px; color: #000000; font-weight: 900; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
                    <span>📋</span> المواصفات والبيانات الأساسية للصنف
                </h4>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 12px 16px;">
                        <span style="font-size: 0.85rem; color: #000000; font-weight: 900;">اسم الصنف التجاري:</span>
                        <div style="font-size: 1.05rem; font-weight: 900; color: #000000; margin-top: 4px;">${p.name}</div>
                    </div>

                    <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 12px 16px;">
                        <span style="font-size: 0.85rem; color: #000000; font-weight: 900;">كود الصنف الداخلي:</span>
                        <div style="font-size: 1.05rem; font-weight: 900; color: #000000; font-family: monospace; margin-top: 4px;">${p.code || p.id}</div>
                    </div>

                    <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 12px 16px;">
                        <span style="font-size: 0.85rem; color: #000000; font-weight: 900;">الباركود الدولي:</span>
                        <div style="font-size: 1.05rem; font-weight: 900; color: #000000; font-family: monospace; margin-top: 4px; display: flex; align-items: center; justify-content: space-between;">
                            <span>${p.barcode || 'غير مسجل'}</span>
                            ${(p.barcode && p.barcode !== 'غير مسجل') ? `
                                <button type="button" onclick="event.stopPropagation(); window.copyInquiryBarcode('${String(p.barcode).replace(/'/g, "\\'")}', this);" 
                                    title="نسخ الباركود"
                                    style="background: #ffffff; border: 1.5px solid #000000; border-radius: 6px; padding: 2px 8px; cursor: pointer; font-size: 0.82rem; font-weight: 900; color: #000000; display: inline-flex; align-items: gap: 4px; transition: 0.15s;"
                                    onmouseover="this.style.background='#dcfce7';"
                                    onmouseout="this.style.background='#ffffff';">
                                    <span>📋</span> نسخ
                                </button>
                            ` : ''}
                        </div>
                    </div>

                    <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 12px 16px;">
                        <span style="font-size: 0.85rem; color: #000000; font-weight: 900;">التصنيف والقسم:</span>
                        <div style="font-size: 1.05rem; font-weight: 900; color: #000000; margin-top: 4px;">${p.category || 'عام'}</div>
                    </div>

                    <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 12px 16px;">
                        <span style="font-size: 0.85rem; color: #000000; font-weight: 900;">الوحدة الأساسية:</span>
                        <div style="font-size: 1.05rem; font-weight: 900; color: #000000; margin-top: 4px;">${p.unit || 'قطعة'}</div>
                    </div>

                    <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 12px 16px;">
                        <span style="font-size: 0.85rem; color: #000000; font-weight: 900;">حد إعادة الطلب (الأمان):</span>
                        <div style="font-size: 1.05rem; font-weight: 900; color: #000000; margin-top: 4px;">${p.minStock || p.min_stock || 0} ${p.unit || 'قطعة'}</div>
                    </div>

                    <div style="background: #ecfdf5; border: 1.5px solid #86efac; border-radius: 10px; padding: 12px 16px;">
                        <span style="font-size: 0.85rem; color: #000000; font-weight: 900;">📍 موقع الرف / الاستند:</span>
                        <div style="font-size: 1.05rem; font-weight: 900; color: #000000; margin-top: 4px;">${p.shelf || p.location || p.shelfLocation || 'غير محدد'}</div>
                    </div>

                    <div style="background: #fefce8; border: 1.5px solid #fde047; border-radius: 10px; padding: 12px 16px;">
                        <span style="font-size: 0.85rem; color: #000000; font-weight: 900;">⚖️ كود الميزان (PLU):</span>
                        <div style="font-size: 1.05rem; font-weight: 900; color: #000000; margin-top: 4px;">${p.scalePlu || p.scale_plu || 'غير مسجل'}</div>
                    </div>
                </div>

                ${p.notes ? `
                    <div style="margin-top: 15px; background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 10px; padding: 12px 16px;">
                        <span style="font-size: 0.85rem; color: #000000; font-weight: 900;">📝 ملاحظات الصنف:</span>
                        <div style="font-size: 0.95rem; color: #000000; font-weight: 800; margin-top: 4px; line-height: 1.6;">${p.notes}</div>
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
     * ⚡ فلترة فورية وحية لصفوف جدول التشكيلات عند كتابة مقاس أو لون أو باركود
     */
    window.filterInquiryVariantsLive = function (val) {
        const q = cleanArabic(val);
        const container = document.getElementById('inquiryTabContentContainer');
        if (!container) return;
        const rows = container.querySelectorAll('tr[data-variant-row="true"]');
        rows.forEach(r => {
            if (!q) {
                r.style.display = '';
            } else {
                const text = cleanArabic(r.textContent || '');
                r.style.display = text.includes(q) ? '' : 'none';
            }
        });
    };

    /**
     * تحديد المخزن لعرض أرصدته بالجدول التفصيلي أدناه
     */
    window.setInquirySelectedWarehouse = function (whName) {
        if (selectedInquiryWarehouse === whName) {
            selectedInquiryWarehouse = 'all';
        } else {
            selectedInquiryWarehouse = whName;
        }
        renderInquiryModal();
    };

    /**
     * تبديل وضع عرض المقاسات (أفقي مصفوفة أو رأسي تفصيلي) مع الحفظ التلقائي
     */
    window.setInquiryViewMode = function (mode) {
        inquiryViewMode = mode;
        try {
            if (typeof setStore === 'function') {
                setStore('pos_inquiry_view_mode', mode);
            }
        } catch (e) {}
        renderInquiryModal();
    };

    /**
     * فتح وإغلاق قائمة تخصيص الأعمدة
     */
    window.toggleInquiryColCustomizer = function (e) {
        if (e) e.stopPropagation();
        isColCustomizerOpen = !isColCustomizerOpen;
        const dropdown = document.getElementById('inquiryColDropdown');
        if (dropdown) {
            dropdown.style.display = isColCustomizerOpen ? 'block' : 'none';
        }
    };

    /**
     * إظهار أو إخفاء عمود معين وحفظه في الإعدادات
     */
    window.toggleInquiryColVisibility = function (colKey, isChecked) {
        const cols = getInquiryColsSettings();
        cols[colKey] = !!isChecked;
        saveInquiryColsSettings(cols);
        renderInquiryModal();
        setTimeout(() => {
            isColCustomizerOpen = true;
            const dropdown = document.getElementById('inquiryColDropdown');
            if (dropdown) dropdown.style.display = 'block';
        }, 10);
    };

    /**
     * استعادة الأعمدة الافتراضية بالكامل
     */
    window.resetInquiryColsToDefault = function () {
        saveInquiryColsSettings(defaultInquiryCols);
        renderInquiryModal();
        setTimeout(() => {
            isColCustomizerOpen = true;
            const dropdown = document.getElementById('inquiryColDropdown');
            if (dropdown) dropdown.style.display = 'block';
        }, 10);
    };

    /**
     * 📋 نسخ باركود الصنف أو التشكيلة إلى الحافظة مع إشعار وتأكيد فوري
     */
    window.copyInquiryBarcode = function (barcodeText, btnElement) {
        if (!barcodeText || barcodeText === '---') return;
        const textToCopy = String(barcodeText).trim();

        const onSuccess = () => {
            if (btnElement) {
                const originalHtml = btnElement.innerHTML;
                btnElement.innerHTML = '✅';
                btnElement.style.borderColor = '#10b981';
                btnElement.style.background = '#dcfce7';
                setTimeout(() => {
                    btnElement.innerHTML = originalHtml;
                    btnElement.style.borderColor = '#cbd5e1';
                    btnElement.style.background = '#ffffff';
                }, 1200);
            }
            if (typeof showToast === 'function') {
                showToast(`📋 تم نسخ الباركود (${textToCopy}) بنجاح!`, 'success');
            }
        };

        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(textToCopy).then(onSuccess).catch(() => {
                fallbackCopy(textToCopy, onSuccess);
            });
        } else {
            fallbackCopy(textToCopy, onSuccess);
        }

        function fallbackCopy(text, cb) {
            try {
                const tempInput = document.createElement('textarea');
                tempInput.value = text;
                tempInput.style.position = 'fixed';
                tempInput.style.left = '-9999px';
                tempInput.style.top = '0';
                document.body.appendChild(tempInput);
                tempInput.focus();
                tempInput.select();
                document.execCommand('copy');
                document.body.removeChild(tempInput);
                if (cb) cb();
            } catch (e) {
                if (typeof showToast === 'function') {
                    showToast(`الباركود: ${text}`, 'info');
                }
            }
        }
    };

    /**
     * 🚀 البحث الحي الفوري متعدد المعايير مع الترتيب الذكي وتجميع المقاسات
     */
    window.handleInquiryLiveSearch = function (query) {
        const dropdown = document.getElementById('inquirySearchDropdown');
        const guideEl = document.getElementById('inquirySearchGuide');
        if (!dropdown) return;

        const raw = String(query || '').trim();
        if (!raw || typeof productsDB === 'undefined' || !Array.isArray(productsDB)) {
            dropdown.style.display = 'none';
            dropdown.innerHTML = '';
            if (guideEl) guideEl.style.display = 'flex';
            inquirySearchResults = [];
            inquirySearchActiveIndex = -1;
            return;
        }

        if (guideEl) guideEl.style.display = 'none';

        const normalizeDigits = (str) => String(str || '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
        const qNorm = normalizeDigits(raw).toLowerCase();
        const qClean = cleanArabic(qNorm);

        // 🧠 استخراج ذكي للبادئات في حالة كتابة: "مقاس 38"، "كود 38"، "سايز 38"، "نمرة 38"، "لون أحمر"
        let explicitMode = null; // 'size' | 'code' | 'barcode' | 'color'
        let extractedQuery = qClean;

        const sizePrefixRegex = /^(?:مقاس|سايز|نمرة|م)\s*[:=\-]?\s*(.+)$/i;
        const codePrefixRegex = /^(?:كود|ك|رمز|رقم|موديل)\s*[:=\-]?\s*(.+)$/i;
        const barcodePrefixRegex = /^(?:باركود|بار|سكانر)\s*[:=\-]?\s*(.+)$/i;
        const colorPrefixRegex = /^(?:لون)\s*[:=\-]?\s*(.+)$/i;

        if (sizePrefixRegex.test(qClean)) {
            explicitMode = 'size';
            extractedQuery = qClean.match(sizePrefixRegex)[1].trim();
        } else if (codePrefixRegex.test(qClean)) {
            explicitMode = 'code';
            extractedQuery = qClean.match(codePrefixRegex)[1].trim();
        } else if (barcodePrefixRegex.test(qClean)) {
            explicitMode = 'barcode';
            extractedQuery = qClean.match(barcodePrefixRegex)[1].trim();
        } else if (colorPrefixRegex.test(qClean)) {
            explicitMode = 'color';
            extractedQuery = qClean.match(colorPrefixRegex)[1].trim();
        }

        const effectiveQuery = extractedQuery || qClean;
        const effectiveNorm = normalizeDigits(effectiveQuery).trim().toLowerCase();
        const tokens = effectiveQuery.split(/\s+/).filter(t => t.length > 0);

        const results = [];

        for (const p of productsDB) {
            if (!p) continue;
            const pName = cleanArabic(p.name);
            const pCode = normalizeDigits(String(p.code || '')).trim().toLowerCase();
            const pSysCode = normalizeDigits(String(p.sysCode || '')).trim().toLowerCase();
            const pId = String(p.id || '').trim();
            const pBarcode = normalizeDigits(String(p.barcode || '')).trim().toLowerCase();
            const pScale = String(p.scalePlu || '').trim();

            let isMatch = false;
            let matchType = ''; // 'code' | 'size' | 'barcode' | 'color' | 'name' | 'compound'
            let matchedDetail = '';
            let matchedBarcode = '';
            let matchedSize = '';
            let matchedColor = '';
            let isExactCode = false;
            let isExactSize = false;
            let isCompoundMatch = false;

            // 1. مسح الباركود بالسكانر أو كتابة الباركود المباشر
            if (pBarcode && (pBarcode === qNorm || pBarcode === effectiveNorm || pBarcode.includes(effectiveNorm))) {
                isMatch = true;
                matchType = 'barcode';
                matchedBarcode = p.barcode;
                matchedDetail = `${p.barcode}`;
            }

            // فحص باركود الوحدات
            if (!isMatch && p.units && Array.isArray(p.units)) {
                const uMatch = p.units.find(u => u.unitBarcode && normalizeDigits(String(u.unitBarcode)).trim().toLowerCase().includes(effectiveNorm));
                if (uMatch) {
                    isMatch = true;
                    matchType = 'barcode';
                    matchedBarcode = uMatch.unitBarcode;
                    matchedDetail = `وحدة (${uMatch.unitName}): ${uMatch.unitBarcode}`;
                }
            }

            // 2. كود الموديل / الصنف (Code / SysCode)
            if (!isMatch && (pCode || pSysCode || pId || pScale)) {
                if (pCode && (pCode === effectiveNorm || pCode === qNorm || pCode.includes(effectiveNorm))) {
                    isMatch = true;
                    matchType = 'code';
                    isExactCode = (pCode === effectiveNorm || pCode === qNorm);
                    matchedDetail = `كود الموديل: ${p.code}`;
                } else if (pSysCode && (pSysCode === effectiveNorm || pSysCode === qNorm || pSysCode.includes(effectiveNorm))) {
                    isMatch = true;
                    matchType = 'code';
                    isExactCode = (pSysCode === effectiveNorm || pSysCode === qNorm);
                    matchedDetail = `كود النظام: ${p.sysCode}`;
                } else if (pId && (pId === effectiveNorm || pId === qNorm)) {
                    isMatch = true;
                    matchType = 'code';
                    isExactCode = true;
                    matchedDetail = `رقم الصنف: ${p.id}`;
                } else if (pScale && pScale === effectiveNorm) {
                    isMatch = true;
                    matchType = 'code';
                    isExactCode = true;
                    matchedDetail = `ميزان PLU: ${p.scalePlu}`;
                }
            }

            // 3. المقاسات والألوان والباركود الفرعي للتشكيلة
            const variants = (p.variants && Array.isArray(p.variants)) ? p.variants : [];
            if (variants.length > 0) {
                // فحص باركود الفارينت
                const vBarMatch = variants.find(v => v.barcode && normalizeDigits(String(v.barcode)).trim().toLowerCase() === effectiveNorm);
                if (vBarMatch) {
                    isMatch = true;
                    matchType = 'barcode';
                    matchedBarcode = vBarMatch.barcode;
                    matchedSize = vBarMatch.size || '';
                    matchedColor = vBarMatch.color || '';
                    matchedDetail = `باركود مقاس [${vBarMatch.size || '-'}] لون [${vBarMatch.color || '-'}]: ${vBarMatch.barcode}`;
                }

                // فحص المقاس الدقيق أو المطابق للمدخل (مثال: 38 أو L أو مقاس 38)
                if (!isMatch) {
                    // تطابق تام أولاً
                    const vExactSize = variants.find(v => {
                        const vs = normalizeDigits(String(v.size || '')).trim().toLowerCase();
                        return vs && (vs === effectiveNorm || cleanArabic(vs) === effectiveQuery);
                    });

                    if (vExactSize) {
                        isMatch = true;
                        matchType = 'size';
                        isExactSize = true;
                        matchedSize = vExactSize.size;
                        const availColors = [...new Set(variants.filter(v => v.size === matchedSize).map(v => v.color).filter(c => c && c !== '-'))];
                        const totalStockForSize = variants.filter(v => v.size === matchedSize).reduce((sum, v) => {
                            let st = 0;
                            if (v.warehouseStocks && typeof v.warehouseStocks === 'object' && Object.keys(v.warehouseStocks).length > 0) {
                                st = Object.values(v.warehouseStocks).reduce((sAcc, val) => sAcc + (parseFloat(val) || 0), 0);
                            } else {
                                st = parseFloat(v.stock) || 0;
                            }
                            return sum + st;
                        }, 0);
                        matchedDetail = `المقاس: ${matchedSize}` + (availColors.length > 0 ? ` (ألوان: ${availColors.join('، ')})` : '') + ` - الرصيد: ${totalStockForSize}`;
                        matchedBarcode = vExactSize.barcode || '';
                        matchedColor = availColors.length === 1 ? availColors[0] : '';
                    } else {
                        // تطابق جزئي بالمقاس
                        const vSizeMatches = variants.filter(v => {
                            const vs = normalizeDigits(String(v.size || '')).trim().toLowerCase();
                            return vs && vs.includes(effectiveNorm);
                        });
                        if (vSizeMatches.length > 0) {
                            isMatch = true;
                            matchType = 'size';
                            matchedSize = vSizeMatches[0].size;
                            const availColors = [...new Set(vSizeMatches.map(v => v.color).filter(c => c && c !== '-'))];
                            const totalStockForSize = vSizeMatches.reduce((sum, v) => {
                                let st = 0;
                                if (v.warehouseStocks && typeof v.warehouseStocks === 'object' && Object.keys(v.warehouseStocks).length > 0) {
                                    st = Object.values(v.warehouseStocks).reduce((sAcc, val) => sAcc + (parseFloat(val) || 0), 0);
                                } else {
                                    st = parseFloat(v.stock) || 0;
                                }
                                return sum + st;
                            }, 0);
                            matchedDetail = `المقاس: ${matchedSize}` + (availColors.length > 0 ? ` (ألوان: ${availColors.join('، ')})` : '') + ` - الرصيد: ${totalStockForSize}`;
                            matchedBarcode = vSizeMatches[0].barcode || '';
                            matchedColor = availColors.length === 1 ? availColors[0] : '';
                        }
                    }
                }

                // فحص الألوان
                if (!isMatch) {
                    const vColorMatches = variants.filter(v => {
                        const vc = cleanArabic(v.color);
                        return vc && (vc === effectiveQuery || vc.includes(effectiveQuery));
                    });
                    if (vColorMatches.length > 0) {
                        isMatch = true;
                        matchType = 'color';
                        matchedColor = vColorMatches[0].color;
                        const availSizes = [...new Set(vColorMatches.map(v => v.size).filter(s => s && s !== '-'))];
                        matchedDetail = `اللون: ${matchedColor}` + (availSizes.length > 0 ? ` (مقاسات: ${availSizes.join('، ')})` : '');
                        matchedBarcode = vColorMatches[0].barcode || '';
                        matchedSize = availSizes.length === 1 ? availSizes[0] : '';
                    }
                }
            }

            // 4. تطابق اسم الصنف
            if (!isMatch) {
                if (tokens.every(t => pName.includes(t))) {
                    isMatch = true;
                    matchType = 'name';
                    matchedDetail = `تطابق بالاسم`;
                }
            }

            // 5. بحث ذكي مركب فائق (اسم + كود أو اسم + مقاس مثل: "شنطة 38" أو "فستان 38")
            if (!isMatch && tokens.length > 1) {
                const nameMatchedTokens = tokens.filter(t => pName.includes(t));
                const otherTokens = tokens.filter(t => !pName.includes(t));

                if (nameMatchedTokens.length > 0 && otherTokens.length > 0) {
                    const subQuery = otherTokens.join(' ');
                    const subNorm = normalizeDigits(subQuery).trim().toLowerCase();
                    const codeMatches = (pCode && (pCode === subNorm || pCode.includes(subNorm))) || 
                                        (pSysCode && (pSysCode === subNorm || pSysCode.includes(subNorm)));
                    
                    const sizeMatchV = variants.find(v => {
                        const vs = normalizeDigits(String(v.size || '')).trim().toLowerCase();
                        return vs && (vs === subNorm || cleanArabic(vs) === cleanArabic(subQuery));
                    });

                    if (codeMatches) {
                        isMatch = true;
                        isCompoundMatch = true;
                        matchType = 'code';
                        isExactCode = (pCode === subNorm);
                        matchedDetail = `اسم: ${p.name} + كود: ${p.code || p.sysCode}`;
                    } else if (sizeMatchV) {
                        isMatch = true;
                        isCompoundMatch = true;
                        matchType = 'size';
                        isExactSize = true;
                        matchedSize = sizeMatchV.size;
                        matchedBarcode = sizeMatchV.barcode || '';
                        matchedDetail = `اسم: ${p.name} + مقاس: ${matchedSize}`;
                    }
                }
            }

            if (isMatch) {
                results.push({
                    product: p,
                    matchType,
                    matchedDetail,
                    matchedBarcode,
                    matchedSize,
                    matchedColor,
                    isExactCode,
                    isExactSize,
                    isCompoundMatch
                });
            }
        }

        // 🥇 ترتيب فائق الذكاء: التطابق التام للكود أو المقاس يوضع في قمة النتائج مباشرة (Rank #1)
        results.sort((a, b) => {
            const getScore = item => {
                const p = item.product;
                const pCode = normalizeDigits(String(p.code || '')).trim().toLowerCase();
                const pBarcode = normalizeDigits(String(p.barcode || '')).trim().toLowerCase();
                const mSize = normalizeDigits(String(item.matchedSize || '')).trim().toLowerCase();

                // 1. تطابق مركب خارق: الاسم مطابق والمقاس أو الكود مطابق (مثل: شنطة 38)
                if (item.isCompoundMatch) return 1;

                if (explicitMode === 'size') {
                    // إذا كان البحث صريحاً بالمقاس (مثل: "مقاس 38")، فالمقاس يسبق الكود
                    if (item.isExactSize || (item.matchType === 'size' && (mSize === effectiveNorm || mSize === qNorm))) return 2;
                    if (item.isExactCode || pCode === effectiveNorm || pCode === qNorm) return 3;
                } else {
                    // إذا كان البحث عن "38" أو "كود 38"، كود الموديل أولاً ثم مقاس الموديل
                    if (item.isExactCode || pCode === effectiveNorm || pCode === qNorm) return 2;
                    if (item.isExactSize || (item.matchType === 'size' && (mSize === effectiveNorm || mSize === qNorm))) return 3;
                }

                // 4. الباركود مطابق تماماً للمدخل
                if (pBarcode === effectiveNorm || pBarcode === qNorm || (item.matchType === 'barcode' && normalizeDigits(String(item.matchedBarcode || '')).trim().toLowerCase() === effectiveNorm)) return 4;

                // 5. كود الموديل يبدأ بالمدخل
                if (pCode && pCode.startsWith(effectiveNorm)) return 5;
                if (item.matchType === 'code') return 6;

                // 6. المقاس يحتوي على المدخل
                if (item.matchType === 'size') return 7;

                // 7. الباركود يحتوي على المدخل
                if (item.matchType === 'barcode') return 8;

                // 8. تطابق باللون
                if (item.matchType === 'color') return 9;

                // 9. اسم الصنف يبدأ بالمدخل
                if (cleanArabic(p.name).startsWith(effectiveQuery)) return 10;

                // 10. تطابق عام بالاسم
                return 11;
            };
            return getScore(a) - getScore(b);
        });

        inquirySearchResults = results.slice(0, 30);
        inquirySearchActiveIndex = -1;

        if (inquirySearchResults.length === 0) {
            dropdown.style.display = 'block';
            const safeRaw = (window.escapeHtml ? window.escapeHtml(raw) : raw);
            dropdown.innerHTML = `<div style="padding: 16px; color: #000000; text-align: center; font-size: 0.95rem; font-weight: 900;">لا توجد أصناف أو مقاسات مطابقة لـ "${safeRaw}"</div>`;
            return;
        }

        dropdown.innerHTML = `
            <div>
                ${inquirySearchResults.map((res, idx) => {
                    const p = res.product;
                    const variants = (p.variants && Array.isArray(p.variants)) ? p.variants : [];

                    // استخراج كل المقاسات المتوفرة وتجميعها
                    const distinctSizes = [...new Set(variants.map(v => String(v.size || '').trim()).filter(s => s && s !== '-'))];
                    distinctSizes.sort((a, b) => getInquirySizeWeight(a) - getInquirySizeWeight(b));

                    const safeDetail = (window.escapeHtml ? window.escapeHtml(res.matchedDetail || '') : (res.matchedDetail || ''));
                    let badgeHtml = '';
                    if (res.matchType === 'code') {
                        badgeHtml = `<span style="background: #dbeafe; color: #000000; border: 2px solid #1d4ed8; padding: 2px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 900;">🔢 ${safeDetail}</span>`;
                    } else if (res.matchType === 'size') {
                        badgeHtml = `<span style="background: #dcfce7; color: #000000; border: 2px solid #047857; padding: 2px 9px; border-radius: 6px; font-size: 0.76rem; font-weight: 900; box-shadow: 0 1px 4px rgba(16,185,129,0.25);">📏 ${safeDetail} 👈</span>`;
                    } else if (res.matchType === 'color') {
                        badgeHtml = `<span style="background: #fae8ff; color: #000000; border: 2px solid #c026d3; padding: 2px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 900;">🎨 ${safeDetail}</span>`;
                    } else if (res.matchType === 'barcode') {
                        badgeHtml = `<span style="background: #fef3c7; color: #000000; border: 2px solid #b45309; padding: 2px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 900;">⚡ باركود: ${safeDetail}</span>`;
                    } else {
                        badgeHtml = `<span style="background: #f0fdf4; color: #000000; border: 2px solid #059669; padding: 2px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 900;">🏷️ صنف</span>`;
                    }

                    let totalStock = 0;
                    if (p.variants && Array.isArray(p.variants) && p.variants.length > 0) {
                        totalStock = p.variants.reduce((sum, v) => {
                            let vSt = 0;
                            if (v.warehouseStocks && typeof v.warehouseStocks === 'object' && Object.keys(v.warehouseStocks).length > 0) {
                                vSt = Object.values(v.warehouseStocks).reduce((s, val) => s + (parseFloat(val) || 0), 0);
                            } else {
                                vSt = parseFloat(v.stock) || 0;
                            }
                            return sum + vSt;
                        }, 0);
                    } else if (p.warehouseStocks && typeof p.warehouseStocks === 'object' && Object.keys(p.warehouseStocks).length > 0) {
                        totalStock = Object.values(p.warehouseStocks).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
                    } else {
                        totalStock = parseFloat(p.stock) || 0;
                    }
                    totalStock = Number(totalStock.toFixed(2));

                    const safeBarcode = String(res.matchedBarcode || '').replace(/'/g, "\\'");
                    const safeSize = String(res.matchedSize || '').replace(/'/g, "\\'");
                    const safeColor = String(res.matchedColor || '').replace(/'/g, "\\'");

                    // تجميع شريط أزرار المقاسات المتوفرة (كاملة بدون قص بأسلوب شريط كبسولات ممتد)
                    let sizeChipsHtml = '';
                    if (distinctSizes.length > 0) {
                        sizeChipsHtml = `
                            <div style="display: flex; align-items: center; gap: 5px; margin-top: 6px; overflow-x: auto; max-width: 100%; padding: 2px 0;" class="fast-scrollbar" onclick="event.stopPropagation();">
                                <span style="font-size: 0.76rem; font-weight: 900; color: #000000; flex-shrink: 0;">المقاسات (${distinctSizes.length}):</span>
                                ${distinctSizes.map(s => {
                                    const isSelected = (res.matchedSize && String(res.matchedSize).trim().toLowerCase() === String(s).toLowerCase());
                                    return `
                                        <button type="button" 
                                            onclick="event.stopPropagation(); window.selectInquiryProduct(${p.id}, '', '${s.replace(/'/g, "\\'")}', '');"
                                            style="flex-shrink: 0; padding: 2px 9px; border-radius: 6px; font-size: 0.76rem; font-weight: 900; cursor: pointer; transition: 0.15s; ${isSelected ? 'border: 2px solid #059669; background: #dcfce7; color: #000000; box-shadow: 0 0 6px rgba(5,150,105,0.4); transform: scale(1.05);' : 'border: 1.5px solid #000000; background: #ffffff; color: #000000;'}"
                                            title="فتح الصنف مفلتر مباشرة على مقاس ${s}">
                                            ${isSelected ? '✓ ' : ''}${s}
                                        </button>
                                    `;
                                }).join('')}
                            </div>
                        `;
                    }

                    return `
                    <div id="inquirySearchRow_${idx}"
                        onclick="window.selectInquiryProduct(${p.id}, '${safeBarcode}', '${safeSize}', '${safeColor}')"
                        style="padding: 10px 14px; border-bottom: 1px solid #cbd5e1; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: 0.15s; background: #ffffff;"
                        onmouseover="window.highlightInquirySearchRow(${idx});" onmouseout="this.style.background='#ffffff';">
                        <div style="text-align: right; flex: 1; min-width: 0;">
                            <div style="font-weight: 900; color: #000000; font-size: 0.98rem; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                <span>${(window.escapeHtml ? window.escapeHtml(p.name) : p.name)}</span>
                                ${badgeHtml}
                            </div>
                            <div style="font-size: 0.82rem; color: #000000; font-weight: 900; margin-top: 4px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                <span>كود: <b style="color: #000000; font-family: monospace; font-weight: 900;">${(window.escapeHtml ? window.escapeHtml(p.code || p.id) : (p.code || p.id))}</b></span>
                                <span>|</span>
                                <span>باركود: <b style="color: #000000; font-family: monospace; font-weight: 900;">${(window.escapeHtml ? window.escapeHtml(res.matchedBarcode || p.barcode || '-') : (res.matchedBarcode || p.barcode || '-'))}</b></span>
                                <span>|</span>
                                <span>التصنيف: <b style="color: #000000; font-weight: 900;">${(window.escapeHtml ? window.escapeHtml(p.category || 'عام') : (p.category || 'عام'))}</b></span>
                                <span>|</span>
                                <span>الرصيد: <b style="color: #000000; background: ${totalStock > 0 ? '#bbf7d0' : '#fecaca'}; border: 1.5px solid ${totalStock > 0 ? '#15803d' : '#b91c1c'}; padding: 1px 8px; border-radius: 5px; font-family: monospace; font-weight: 900;">${totalStock} ${(window.escapeHtml ? window.escapeHtml(p.unit || 'قطعة') : (p.unit || 'قطعة'))}</b></span>
                            </div>
                            ${sizeChipsHtml}
                        </div>
                        <div style="text-align: left; padding-right: 12px; flex-shrink: 0;">
                            <span style="background: #047857; color: #ffffff; padding: 4px 10px; border-radius: 8px; font-weight: 900; font-size: 0.95rem; font-family: monospace; border: 1.5px solid #000000; box-shadow: 0 2px 6px rgba(0,0,0,0.15);">
                                ${(parseFloat(p.price) || 0).toFixed(2)} ج.م
                            </span>
                        </div>
                    </div>
                    `;
                }).join('')}
            </div>
            <div style="padding: 8px 14px; background: #f1f5f9; color: #000000; font-size: 0.82rem; font-weight: 900; text-align: center; border-top: 2px solid #cbd5e1; position: sticky; bottom: 0; z-index: 5;">
                🔍 تم العثور على (${inquirySearchResults.length}) صنف | يمكنك التمرير بالماوس أو التنقل بالأسهم ⬇️ ⬆️ أو PgDn/PgUp والضغط على Enter
            </div>
        `;

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
     * التحكم بالكيبورد (الأسهم للأعلى والأسفل، PgDn/PgUp، Home/End، زر Enter و Escape ومسح السكانر المباشر)
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
        } else if (e.key === 'PageDown') {
            if (!isDropdownOpen) return;
            e.preventDefault();
            inquirySearchActiveIndex = Math.min(inquirySearchResults.length - 1, inquirySearchActiveIndex + 5);
            window.highlightInquirySearchRow(inquirySearchActiveIndex);
            const activeEl = document.getElementById(`inquirySearchRow_${inquirySearchActiveIndex}`);
            if (activeEl) activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else if (e.key === 'PageUp') {
            if (!isDropdownOpen) return;
            e.preventDefault();
            inquirySearchActiveIndex = Math.max(0, inquirySearchActiveIndex - 5);
            window.highlightInquirySearchRow(inquirySearchActiveIndex);
            const activeEl = document.getElementById(`inquirySearchRow_${inquirySearchActiveIndex}`);
            if (activeEl) activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else if (e.key === 'Home') {
            if (!isDropdownOpen) return;
            e.preventDefault();
            inquirySearchActiveIndex = 0;
            window.highlightInquirySearchRow(inquirySearchActiveIndex);
            const activeEl = document.getElementById(`inquirySearchRow_0`);
            if (activeEl) activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else if (e.key === 'End') {
            if (!isDropdownOpen) return;
            e.preventDefault();
            inquirySearchActiveIndex = inquirySearchResults.length - 1;
            window.highlightInquirySearchRow(inquirySearchActiveIndex);
            const activeEl = document.getElementById(`inquirySearchRow_${inquirySearchActiveIndex}`);
            if (activeEl) activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const val = (document.getElementById('inquiryLiveSearch')?.value || '').trim();
            if (!val) return;

            if (isDropdownOpen && inquirySearchResults.length > 0) {
                const targetRes = (inquirySearchActiveIndex >= 0 && inquirySearchActiveIndex < inquirySearchResults.length)
                    ? inquirySearchResults[inquirySearchActiveIndex]
                    : inquirySearchResults[0];
                if (targetRes) {
                    const p = targetRes.product || targetRes;
                    window.selectInquiryProduct(
                        p.id,
                        targetRes.matchedBarcode || '',
                        targetRes.matchedSize || '',
                        targetRes.matchedColor || ''
                    );
                    return;
                }
            }

            // مسح سريع بالباركود بالسكانر في حالة لم تكن القائمة مفتوحة
            if (typeof productsDB !== 'undefined' && Array.isArray(productsDB)) {
                window.handleInquiryLiveSearch(val);
                if (inquirySearchResults.length > 0) {
                    const firstRes = inquirySearchResults[0];
                    const p = firstRes.product || firstRes;
                    window.selectInquiryProduct(
                        p.id,
                        firstRes.matchedBarcode || '',
                        firstRes.matchedSize || '',
                        firstRes.matchedColor || ''
                    );
                }
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
     * اختيار صنف من قائمة البحث مع دعم التحديد الذكي للمقاس واللون الممسوح أو المبحوث عنه
     */
    window.selectInquiryProduct = function (productId, variantBarcode = '', targetSize = '', targetColor = '') {
        const prod = productsDB.find(p => p.id === productId || p.id == productId);
        if (prod) {
            currentInquiryProduct = prod;
            selectedInquirySize = 'all';
            selectedInquiryColor = 'all';
            selectedInquiryWarehouse = 'all';
            isColCustomizerOpen = false;

            // 1. إذا تم تحديد باركود تشكيلة (من السكانر أو قارئ الباركود)
            if (variantBarcode && prod.variants && prod.variants.length > 0) {
                const cleanVBar = String(variantBarcode).trim().toLowerCase();
                const matchedV = prod.variants.find(v => v.barcode && String(v.barcode).trim().toLowerCase() === cleanVBar);
                if (matchedV) {
                    if (matchedV.size && String(matchedV.size).trim()) selectedInquirySize = String(matchedV.size).trim();
                    if (matchedV.color && String(matchedV.color).trim()) selectedInquiryColor = String(matchedV.color).trim();
                }
            }

            // 2. إذا تم تمرير مقاس مستهدف (من البحث بالمقاس مثل 38)
            if (selectedInquirySize === 'all' && targetSize && prod.variants && prod.variants.length > 0) {
                const cleanTSize = cleanArabic(targetSize);
                const normTSize = cleanTSize.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
                const matchedV = prod.variants.find(v => {
                    const vsClean = cleanArabic(v.size || '');
                    const vsNorm = vsClean.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
                    return vsClean === cleanTSize || vsNorm === normTSize;
                });
                if (matchedV) {
                    selectedInquirySize = String(matchedV.size).trim();
                    if (targetColor) selectedInquiryColor = String(targetColor).trim();
                } else {
                    selectedInquirySize = String(targetSize).trim();
                }
            }

            // 3. إذا تم تمرير لون مستهدف
            if (selectedInquiryColor === 'all' && targetColor && prod.variants && prod.variants.length > 0) {
                const cleanTColor = cleanArabic(targetColor);
                const matchedV = prod.variants.find(v => v.color && cleanArabic(v.color) === cleanTColor);
                if (matchedV) {
                    selectedInquiryColor = String(matchedV.color).trim();
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
            if (isColCustomizerOpen) {
                e.preventDefault();
                isColCustomizerOpen = false;
                const dropdown = document.getElementById('inquiryColDropdown');
                if (dropdown) dropdown.style.display = 'none';
                return;
            }
            const modal = document.getElementById('bayanFastInquiryModal');
            if (modal && modal.style.display === 'flex') {
                e.preventDefault();
                window.closeFastItemInquiryModal();
            }
        }
    });

    // 🎯 إغلاق قائمة تخصيص الأعمدة تلقائياً عند النقر في أي مكان خارجها
    document.addEventListener('click', function (e) {
        if (!isColCustomizerOpen) return;
        const dropdown = document.getElementById('inquiryColDropdown');
        const btn = document.getElementById('inquiryColCustomizerBtn');
        if (dropdown && !dropdown.contains(e.target) && btn && !btn.contains(e.target)) {
            isColCustomizerOpen = false;
            dropdown.style.display = 'none';
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
