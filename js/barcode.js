/**
 * ====================================================================
 * BAYAN POS - BARCODE ENGINE & FAST SCAN-AND-ADD (js/barcode.js)
 * ====================================================================
 * محرك الباركود الذكي والمسح السريع المتطور:
 * 1. دعم كامل لأجهزة قراءة الباركود اللاسلكية والسلكية (HID Scanners).
 * 2. قياس سرعة الإدخال الفائقة (<50ms بين الأحرف) لتمييز السكانر عن الكتابة اليدوية.
 * 3. مطابقة دقيقة وفورية بنسبة 100% لباركود الـ Variant (مقاس ولون) قبل الصنف الأب.
 * 4. إضافة تلقائية فورية ومباشرة في جداول الشاشات الأربعة المستهدفة حصراً:
 *    - 🛒 شاشة البيع (Sales POS)
 *    - 📦 شاشة الشراء (Purchases)
 *    - ⚖️ شاشة تسوية المخزون (Stock Adjustments)
 *    - 🚚 شاشة تحويل المخازن (Warehouse Transfers)
 * 5. استبعاد كامل لشاشات المرتجعات، سندات القبض، والصرف، والتقارير.
 * 6. إصدار صوت تأكيد (Beep 1800Hz) عند النجاح، وصوت خطأ (Beep 350Hz) مع تنبيه "باركود غير مسجل" عند الفشل.
 * 7. دعم مسح الباركود بالكاميرا (Offline Camera Scanner).
 * 8. إدارة التركيز التلقائي الذكي (Auto-Focus Management).
 * ====================================================================
 */

const BayanBarcode = (function () {
    'use strict';

    // متغيرات التقاط الباركود من لوحة المفاتيح والسكانر
    let buffer = '';
    let lastKeyTime = 0;
    let keyIntervals = [];
    const SCAN_THRESHOLD_MS = 50; // الفارق الزمني الأقصى بين ضغطات مفاتيح السكانر
    let isListening = false;
    let scanCallback = null;

    // متغيرات الكاميرا والصوت (Web Audio API Synth)
    let videoStream = null;
    let cameraAnimationId = null;
    let audioCtx = null;

    function getAudioContext() {
        if (!audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                audioCtx = new AudioContextClass();
            }
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume().catch(e => console.warn('AudioContext resume blocked:', e));
        }
        return audioCtx;
    }

    /**
     * تشغيل نغمة صوتية محلياً (Web Audio API)
     * @param {boolean} success نغمة نجاح أو نغمة خطأ
     */
    function playBeep(success = true) {
        try {
            const ctx = getAudioContext();
            if (!ctx) return;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            if (success) {
                // نغمة نجاح واضحة وقصيرة (1800Hz)
                osc.type = 'sine';
                osc.frequency.setValueAtTime(1800, ctx.currentTime);
                gain.gain.setValueAtTime(0.25, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.12);
            } else {
                // نغمة خطأ منخفضة ومميزة (350Hz)
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(350, ctx.currentTime);
                gain.gain.setValueAtTime(0.35, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.35);
            }
        } catch (e) {
            console.warn('⚠️ تعذر تشغيل النغمة الصوتية:', e);
        }
    }

    /**
     * التحقق من سلامة نص الباركود
     */
    function validate(barcode) {
        if (!barcode || typeof barcode !== 'string') {
            return { isValid: false, message: 'الباركود فارغ' };
        }

        const trimmed = barcode.trim();
        if (trimmed.length < 2 || trimmed.length > 60) {
            return { isValid: false, message: 'طول الباركود يجب أن يكون بين 2 و 60 رمزاً' };
        }

        // فحص الرموز غير المقبولة
        if (/[\x00-\x1F\x7F]/.test(trimmed)) {
            return { isValid: false, message: 'الباركود يحتوي على رموز غير صالحة' };
        }

        return { isValid: true, barcode: trimmed, message: 'باركود صالح' };
    }

    /**
     * فحص تكرار الباركود في قاعدة البيانات
     */
    function isDuplicate(barcode, excludeProductId = null) {
        if (!barcode) return false;
        const targetBc = String(barcode).trim();
        const list = (typeof productsDB !== 'undefined' && Array.isArray(productsDB)) ? productsDB : [];

        return list.some(p => {
            if (excludeProductId && String(p.id) === String(excludeProductId)) return false;
            if (String(p.barcode || '').trim() === targetBc) return true;
            if (p.variants && Array.isArray(p.variants)) {
                if (p.variants.some(v => String(v.barcode || '').trim() === targetBc)) return true;
            }
            return false;
        });
    }

    /**
     * البحث الدقيق 100% عن الصنف أو الـ Variant بواسطة الباركود
     * الأولوية المطلقة لباركود التشكيلات (المقاس واللون)
     */
    function findProductAndVariantByBarcode(scannedBarcode) {
        if (!scannedBarcode) return null;
        const clean = String(scannedBarcode).trim();
        if (!clean) return null;

        const list = (typeof productsDB !== 'undefined' && Array.isArray(productsDB))
            ? productsDB
            : ((typeof getStore === 'function') ? (getStore('bayan_products') || []) : []);

        // 1. أولوية مطلقة للبحث في باركود التشكيلات الفريدة (Variant Barcode Match)
        for (const p of list) {
            if (p.variants && Array.isArray(p.variants)) {
                const vFound = p.variants.find(v => v.barcode && String(v.barcode).trim() === clean);
                if (vFound) {
                    return {
                        product: p,
                        variant: vFound,
                        unit: null,
                        matchType: 'variant'
                    };
                }
            }
        }

        // 2. البحث في باركود الوحدات المتعددة (Unit Barcode Match)
        for (const p of list) {
            if (p.units && Array.isArray(p.units)) {
                const uFound = p.units.find(u => String(u.unitBarcode || '').trim() === clean);
                if (uFound) {
                    return {
                        product: p,
                        variant: null,
                        unit: uFound,
                        matchType: 'unit'
                    };
                }
            }
        }

        // 3. البحث في باركود الصنف الرئيسي أو الكود (Parent Barcode / Code Match)
        for (const p of list) {
            if (String(p.barcode || '').trim() === clean || String(p.code || '').trim() === clean) {
                return {
                    product: p,
                    variant: null,
                    unit: null,
                    matchType: 'parent'
                };
            }
        }

        return null;
    }

    /**
     * تحديد الشاشة النشطة حالياً لتوجيه الصنف للجدول المناسب
     * (مقتصرة حصرياً على: البيع، الشراء، التسوية، تحويل المخزن، وكارت الصنف)
     */
    function getActiveScanTarget() {
        // 1. شاشة تحويل المخزن (إذا كان مودال التحويل مفتوحاً)
        const transferModal = document.getElementById('transferModal');
        if (transferModal && !transferModal.classList.contains('hidden') && transferModal.style.display !== 'none') {
            return 'transfer';
        }

        // 2. كارت الصنف (إذا كانت نافذة إضافة/تعديل صنف مفتوحة)
        const productModal = document.getElementById('newItemModal') || document.getElementById('productModal');
        if (productModal && !productModal.classList.contains('hidden') && productModal.style.display !== 'none') {
            return 'productModal';
        }

        // 3. التحقق من التبويب النشط الرئيسي المعروض بالواجهة
        const activeSection = document.querySelector('.section-view:not(.hidden)');
        if (!activeSection) return null;

        const secId = activeSection.id;
        if (secId === 'sales-section') return 'sales';
        if (secId === 'purchase-section') return 'purchase';
        if (secId === 'adjustment-section') return 'adjustment';

        // باقي الشاشات مستبعدة (مرتجعات، سندات، حسابات، تقارير...)
        return null;
    }

    /**
     * تنظيف حقل البحث وإعادة التركيز
     */
    function clearAndFocusSearch(inputId) {
        const el = document.getElementById(inputId);
        if (el) {
            el.value = '';
            el.focus();
        }
    }

    /**
     * تحليل وفك تشفير باركود الموازين الإلكترونية (EAN-13 Scale Barcode Parser)
     * يدعم فك شفرة الباركودات مثل 2000003002207
     * @param {string} cleanCode
     * @returns {object|null}
     */
    function parseScaleBarcode(cleanCode) {
        if (!cleanCode || typeof cleanCode !== 'string') return null;
        cleanCode = cleanCode.trim();
        if (cleanCode.length !== 13 || !/^\d{13}$/.test(cleanCode)) return null;

        const s = typeof getBarcodeLabelSettings === 'function' ? getBarcodeLabelSettings() : {
            scaleEnabled: true,
            scalePrefix: '2',
            scaleType: 'weight',
            scalePluLength: 6,
            scaleValueLength: 5
        };

        if (s.scaleEnabled === false) return null;

        const prefix = String(s.scalePrefix || '2').trim();
        if (!cleanCode.startsWith(prefix)) return null;

        const pluLen = parseInt(s.scalePluLength, 10) || 6;
        const valLen = parseInt(s.scaleValueLength, 10) || 5;
        const prefLen = prefix.length;

        // استخراج كود الصنف
        const rawPlu = cleanCode.substring(prefLen, prefLen + pluLen);
        const pluInt = parseInt(rawPlu, 10);
        const pluStr = isNaN(pluInt) ? rawPlu : String(pluInt);

        // استخراج قيمة الوزن أو السعر
        const rawVal = cleanCode.substring(prefLen + pluLen, prefLen + pluLen + valLen);
        const numVal = parseFloat(rawVal) || 0;

        // البحث عن الصنف المطابق بكود الميزان أو كود النظام أو الكود الداخلي أو المعرف
        if (typeof productsDB === 'undefined' || !Array.isArray(productsDB)) return null;

        const product = productsDB.find(p => {
            if (p.scalePlu && (String(p.scalePlu).trim() === pluStr || String(p.scalePlu).trim() === rawPlu)) return true;
            if (p.sysCode && (String(p.sysCode).trim() === pluStr || String(p.sysCode).trim() === rawPlu)) return true;
            if (p.code && (String(p.code).trim() === pluStr || String(p.code).trim() === rawPlu)) return true;
            if (p.id && (String(p.id).trim() === pluStr || String(p.id).trim() === rawPlu)) return true;
            if (p.barcode && (String(p.barcode).trim() === pluStr || String(p.barcode).trim() === rawPlu)) return true;
            return false;
        });

        if (!product) return null;

        let weight = 0;
        let totalPrice = 0;
        const unitPrice = parseFloat(product.price) || 0;

        if (s.scaleType === 'price') {
            totalPrice = numVal / 100;
            weight = unitPrice > 0 ? parseFloat((totalPrice / unitPrice).toFixed(3)) : 1;
        } else {
            weight = numVal / 1000;
            totalPrice = parseFloat((weight * unitPrice).toFixed(2));
        }

        return {
            isScale: true,
            product: product,
            plu: pluStr,
            rawPlu: rawPlu,
            weight: weight,
            unitPrice: unitPrice,
            totalPrice: totalPrice
        };
    }

    /**
     * المعالج المركزي لمسح الباركود والإضافة المباشرة للجداول
     * @param {string} code 
     * @param {string} source 
     */
    function handleScan(code, source = 'hardware_scanner') {
        const valRes = validate(code);
        if (!valRes.isValid) {
            playBeep(false);
            if (typeof showToast === 'function') showToast(valRes.message, 'warning');
            return;
        }

        const cleanCode = valRes.barcode;
        console.log(`📡 [BayanBarcode Engine] Scanned: "${cleanCode}" from source: ${source}`);

        // إذا كان هناك Callback مخصص مفعل
        if (typeof scanCallback === 'function') {
            playBeep(true);
            scanCallback(cleanCode, source);
            return;
        }

        const targetScreen = getActiveScanTarget();
        if (!targetScreen) {
            console.log('ℹ️ المسح في شاشة غير مستهدفة للإضافة المباشرة.');
            return;
        }

        // معالجة خاصة لكارت الصنف
        if (targetScreen === 'productModal') {
            const activeEl = document.activeElement;
            if (activeEl && activeEl.classList.contains('var-barcode-input')) {
                activeEl.value = cleanCode;
                playBeep(true);
                if (typeof showToast === 'function') showToast('✅ تم ملء باركود التشكيلة', 'success');
                return;
            }
            const bcInp = document.getElementById('newItemBarcode') || document.getElementById('productBarcode');
            if (bcInp) {
                const curEditId = typeof currentEditingProductId !== 'undefined' ? currentEditingProductId : null;
                if (isDuplicate(cleanCode, curEditId)) {
                    playBeep(false);
                    if (typeof showToast === 'function') showToast('⚠️ هذا الباركود مستخدم بالفعل لصنف آخر!', 'error');
                } else {
                    bcInp.value = cleanCode;
                    playBeep(true);
                    if (typeof showToast === 'function') showToast('✅ تم ملء الباركود في كارت الصنف', 'success');
                }
            }
            return;
        }

        // ⚖️ فحص باركود موازين الوزن الإلكترونية (Scale Barcodes)
        const scaleMatch = parseScaleBarcode(cleanCode);
        if (scaleMatch) {
            if (targetScreen === 'sales') {
                let added = false;
                if (typeof completeAddToCart === 'function') {
                    added = completeAddToCart(scaleMatch.product, null, null, scaleMatch.weight, scaleMatch.unitPrice);
                } else if (typeof addToCart === 'function') {
                    addToCart(scaleMatch.product.id, null, null, scaleMatch.weight);
                    added = true;
                }
                if (added !== false) {
                    playBeep(true);
                    if (typeof showToast === 'function') {
                        showToast(`⚖️ [ميزان] +${scaleMatch.weight} كجم ${scaleMatch.product.name} (${scaleMatch.totalPrice} ج.م)`, 'success');
                    }
                }
                clearAndFocusSearch('productSearch');
                return;
            } else if (targetScreen === 'purchase') {
                if (typeof addToPurchaseCart === 'function') {
                    addToPurchaseCart(scaleMatch.product.id, null, null, null);
                    const pRows = document.getElementById('purchaseTableBody')?.rows || [];
                    if (pRows.length > 0) {
                        const lastQtyInp = pRows[pRows.length - 1].querySelector('.purchase-qty-input') || pRows[pRows.length - 1].querySelector('input[type=number]');
                        if (lastQtyInp) {
                            lastQtyInp.value = scaleMatch.weight;
                            if (typeof updatePurchaseTotals === 'function') updatePurchaseTotals();
                        }
                    }
                }
                playBeep(true);
                if (typeof showToast === 'function') {
                    showToast(`⚖️ [توريد ميزان] +${scaleMatch.weight} كجم ${scaleMatch.product.name}`, 'success');
                }
                clearAndFocusSearch('purchaseSearch');
                return;
            }
        }

        // البحث الدقيق عن الصنف أو الـ Variant
        const match = findProductAndVariantByBarcode(cleanCode);

        // 🚨 إذا كان الباركود غير مسجل إطلاقاً
        if (!match) {
            playBeep(false);
            if (typeof showToast === 'function') {
                showToast(`⚠️ باركود غير مسجل: (${cleanCode})`, 'error');
            }
            // لا يتم إضافة أي بيانات خاطئة أو تقريبية
            return;
        }

        const product = match.product;
        const variant = match.variant;
        const unit = match.unit;

        // ══════════════════════════════════════════════════════════
        // 1. شاشة المبيعات (Sales POS)
        // ══════════════════════════════════════════════════════════
        if (targetScreen === 'sales') {
            if (variant) {
                let added = false;
                if (typeof completeAddToCart === 'function') {
                    added = completeAddToCart(product, null, variant);
                } else if (typeof addToCart === 'function') {
                    addToCart(product.id, null, variant);
                    added = true;
                }
                if (added !== false) {
                    playBeep(true);
                    const vDetails = (variant.size ? `مقاس: ${variant.size}` : '') + (variant.color ? ` - لون: ${variant.color}` : '');
                    if (typeof showToast === 'function') {
                        showToast(`✅ [مسح سريع] +1 ${product.name} (${vDetails})`, 'success');
                    }
                }
                clearAndFocusSearch('productSearch');
                return;
            } else if (unit) {
                let added = false;
                if (typeof completeAddToCart === 'function') {
                    added = completeAddToCart(product, unit, null);
                }
                if (added !== false) {
                    playBeep(true);
                    if (typeof showToast === 'function') {
                        showToast(`✅ [مسح سريع] +1 ${product.name} (${unit.unitName})`, 'success');
                    }
                }
                clearAndFocusSearch('productSearch');
                return;
            } else {
                // الصنف الأب
                if (product.variants && Array.isArray(product.variants) && product.variants.length > 0) {
                    if (typeof showVariantSelectionModal === 'function') {
                        showVariantSelectionModal(product, 'sales');
                    }
                    playBeep(true);
                } else {
                    let added = false;
                    if (typeof completeAddToCart === 'function') {
                        added = completeAddToCart(product, null, null);
                    } else if (typeof addToCart === 'function') {
                        addToCart(product.id);
                        added = true;
                    }
                    if (added !== false) {
                        playBeep(true);
                        if (typeof showToast === 'function') {
                            showToast(`✅ [مسح سريع] +1 ${product.name}`, 'success');
                        }
                    }
                }
                clearAndFocusSearch('productSearch');
                return;
            }
        }

        // ══════════════════════════════════════════════════════════
        // 2. شاشة المشتريات والتوريد (Purchases)
        // ══════════════════════════════════════════════════════════
        if (targetScreen === 'purchase') {
            if (variant) {
                if (typeof addToPurchaseCart === 'function') {
                    addToPurchaseCart(product.id, null, null, variant);
                }
                playBeep(true);
                const vDetails = (variant.size ? `مقاس: ${variant.size}` : '') + (variant.color ? ` - لون: ${variant.color}` : '');
                if (typeof showToast === 'function') {
                    showToast(`✅ [توريد سريع] +1 ${product.name} (${vDetails})`, 'success');
                }
                clearAndFocusSearch('purchaseSearch');
                return;
            } else if (unit) {
                if (typeof addToPurchaseCart === 'function') {
                    addToPurchaseCart(product.id, unit, null, null);
                }
                playBeep(true);
                if (typeof showToast === 'function') {
                    showToast(`✅ [توريد سريع] +1 ${product.name} (${unit.unitName})`, 'success');
                }
                clearAndFocusSearch('purchaseSearch');
                return;
            } else {
                if (product.variants && Array.isArray(product.variants) && product.variants.length > 0) {
                    if (typeof showVariantSelectionModal === 'function') {
                        showVariantSelectionModal(product, 'purchase');
                    }
                    playBeep(true);
                } else {
                    if (typeof addToPurchaseCart === 'function') {
                        addToPurchaseCart(product.id);
                    }
                    playBeep(true);
                    if (typeof showToast === 'function') {
                        showToast(`✅ [توريد سريع] +1 ${product.name}`, 'success');
                    }
                }
                clearAndFocusSearch('purchaseSearch');
                return;
            }
        }

        // ══════════════════════════════════════════════════════════
        // 3. شاشة تسوية المخزون (Stock Adjustments)
        // ══════════════════════════════════════════════════════════
        if (targetScreen === 'adjustment') {
            if (product.variants && Array.isArray(product.variants) && product.variants.length > 0 && !variant) {
                if (typeof showVariantSelectionModal === 'function') {
                    showVariantSelectionModal(product, 'adj');
                }
                playBeep(true);
                clearAndFocusSearch('adjSearch');
                return;
            }

            if (!window.adjCart) window.adjCart = [];

            const vSize = variant ? (variant.size || '') : '';
            const vColor = variant ? (variant.color || '') : '';
            const pId = product.id;

            // البحث عن صنف مطابق بالجدول لزيادة الكمية
            const existing = window.adjCart.find(it =>
                it.id === pId &&
                ((it.size || it.selectedSize || '') === vSize) &&
                ((it.color || it.selectedColor || '') === vColor)
            );

            if (existing) {
                existing.qty = (parseFloat(existing.qty) || 0) + 1;
            } else {
                const vCost = variant ? (parseFloat(variant.cost) || parseFloat(product.cost) || 0) : (parseFloat(product.cost) || 0);
                const vStock = variant && variant.stock !== undefined ? variant.stock : (parseFloat(product.stock) || 0);
                const factor = unit ? (parseFloat(unit.factor) || 1) : 1;

                window.adjCart.push({
                    ...product,
                    id: product.id,
                    name: product.name,
                    code: (variant && variant.barcode) ? variant.barcode : ((unit && unit.unitBarcode) ? unit.unitBarcode : (product.code || product.id)),
                    selectedSize: vSize,
                    selectedColor: vColor,
                    size: vSize,
                    color: vColor,
                    stock: vStock,
                    qty: 1,
                    price: vCost,
                    notes: '',
                    unitFactor: factor,
                    selectedUnit: unit || null
                });
            }

            if (typeof renderAdjTable === 'function') renderAdjTable();
            playBeep(true);
            const vDetails = variant ? ` (${vSize ? 'مقاس: ' + vSize : ''}${vColor ? ' - لون: ' + vColor : ''})` : (unit ? ` (${unit.unitName})` : '');
            if (typeof showToast === 'function') {
                showToast(`✅ [تسوية سريعة] +1 ${product.name}${vDetails}`, 'success');
            }
            clearAndFocusSearch('adjSearch');
            return;
        }

        // ══════════════════════════════════════════════════════════
        // 4. شاشة تحويل المخازن (Warehouse Transfers)
        // ══════════════════════════════════════════════════════════
        if (targetScreen === 'transfer') {
            if (!window.transferItemsBatch) window.transferItemsBatch = [];

            const vSize = variant ? (variant.size || '') : '';
            const vColor = variant ? (variant.color || '') : '';
            const pId = product.id;

            const existing = window.transferItemsBatch.find(it =>
                it.id === pId &&
                ((it.size || it.selectedSize || '') === vSize) &&
                ((it.color || it.selectedColor || '') === vColor)
            );

            if (existing) {
                existing.qty = (parseFloat(existing.qty) || 0) + 1;
            } else {
                const vCost = variant ? (parseFloat(variant.cost) || parseFloat(product.cost) || 0) : (parseFloat(product.cost) || 0);
                const fromWh = document.getElementById('transferFrom') ? document.getElementById('transferFrom').value : (typeof getStore === 'function' ? getStore('activeWarehouse') : 'المخزن الرئيسي') || 'المخزن الرئيسي';
                let currentWhStock = (typeof getWarehouseStock === 'function') ? getWarehouseStock(product.name, fromWh) : (parseFloat(product.stock) || 0);
                if (variant) {
                    if (variant.warehouseStocks && variant.warehouseStocks[fromWh] !== undefined) {
                        currentWhStock = parseFloat(variant.warehouseStocks[fromWh]) || 0;
                    } else if (variant.stock !== undefined) {
                        currentWhStock = parseFloat(variant.stock) || 0;
                    }
                }

                window.transferItemsBatch.push({
                    id: product.id,
                    name: product.name,
                    code: (variant && variant.barcode) ? variant.barcode : (product.code || product.id),
                    selectedSize: vSize,
                    selectedColor: vColor,
                    size: vSize,
                    color: vColor,
                    stock: currentWhStock,
                    qty: 1,
                    price: vCost
                });
            }

            if (typeof renderTransferTable === 'function') renderTransferTable();
            playBeep(true);
            const vDetails = variant ? ` (${vSize ? 'مقاس: ' + vSize : ''}${vColor ? ' - لون: ' + vColor : ''})` : '';
            if (typeof showToast === 'function') {
                showToast(`✅ [تحويل سريع] +1 ${product.name}${vDetails}`, 'success');
            }
            clearAndFocusSearch('transferProductSearch');
            return;
        }
    }

    /**
     * مستمع لوحة المفاتيح الفائق لمدخلات السكانر (Global KeyDown Listener)
     */
    function onGlobalKeyDown(e) {
        const currentTime = performance.now();
        const timeDiff = currentTime - lastKeyTime;
        lastKeyTime = currentTime;

        const activeElem = document.activeElement;
        const isStandardInput = activeElem && (
            activeElem.tagName === 'INPUT' ||
            activeElem.tagName === 'TEXTAREA' ||
            activeElem.isContentEditable
        );

        // عند الضغط على Enter أو Tab (إشارة اكتمال مسح السكانر)
        if (e.key === 'Enter' || e.key === 'Tab') {
            if (buffer.length >= 2) {
                // حساب متوسط الفارق الزمني بين الحروف
                const avgInterval = keyIntervals.length > 0
                    ? (keyIntervals.reduce((a, b) => a + b, 0) / keyIntervals.length)
                    : 100;

                const isFastScanner = avgInterval < SCAN_THRESHOLD_MS || buffer.length >= 8;

                const scanned = buffer;
                buffer = '';
                keyIntervals = [];

                if (isFastScanner) {
                    e.preventDefault();
                    e.stopPropagation();
                    handleScan(scanned, 'hardware_scanner');
                    return;
                }
            }
            buffer = '';
            keyIntervals = [];
            return;
        }

        // تجميع أحرف الباركود
        if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
            if (timeDiff < SCAN_THRESHOLD_MS || buffer.length === 0) {
                buffer += e.key;
                if (buffer.length > 1) keyIntervals.push(timeDiff);
            } else if (timeDiff > 250) {
                // إعادة تعيين المخزن المؤقت عند التوقف الطويل
                buffer = e.key;
                keyIntervals = [];
            } else {
                buffer += e.key;
                keyIntervals.push(timeDiff);
            }
        }
    }

    /**
     * تشغيل مستمع أجهزة الباركود
     */
    function startHardwareListener(customCallback = null) {
        if (customCallback) scanCallback = customCallback;
        if (!isListening) {
            document.removeEventListener('keydown', onGlobalKeyDown, true);
            document.addEventListener('keydown', onGlobalKeyDown, true);
            isListening = true;
            console.log('📡 [BayanBarcode] تم تفعيل مستمع السكانر اللاسلكي والسلكي بنجاح');
        }
    }

    /**
     * إيقاف الاستماع
     */
    function stopHardwareListener() {
        if (isListening) {
            document.removeEventListener('keydown', onGlobalKeyDown, true);
            isListening = false;
            buffer = '';
            keyIntervals = [];
            console.log('🛑 [BayanBarcode] تم إيقاف مستمع الباركود');
        }
    }

    /**
     * تشغيل قراءة الباركود عبر الكاميرا (Offline Camera Scanner)
     */
    async function startCameraScanner(videoElementId = 'barcodeCameraVideo', canvasElementId = 'barcodeCameraCanvas') {
        const video = document.getElementById(videoElementId);
        const canvas = document.getElementById(canvasElementId);

        if (!video || !canvas) {
            console.error('❌ عناصر فيديو أو كانفاس الكاميرا غير موجودة في الصفحة');
            if (typeof showToast === 'function') showToast('⚠️ تعذر العثور على شاشة الكاميرا', 'error');
            return false;
        }

        try {
            stopCameraScanner();

            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
            });

            videoStream = stream;
            video.srcObject = stream;
            await video.play();

            const ctx = canvas.getContext('2d', { willReadFrequently: true });

            const checkBarcodeFrame = () => {
                if (!videoStream || video.paused || video.ended) return;

                if (video.videoWidth > 0 && video.videoHeight > 0) {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                    if ('BarcodeDetector' in window) {
                        const detector = new window.BarcodeDetector();
                        detector.detect(canvas)
                            .then(barcodes => {
                                if (barcodes && barcodes.length > 0) {
                                    const detectedCode = barcodes[0].rawValue;
                                    stopCameraScanner();
                                    closeCameraModal();
                                    handleScan(detectedCode, 'camera');
                                } else {
                                    cameraAnimationId = requestAnimationFrame(checkBarcodeFrame);
                                }
                            })
                            .catch(() => {
                                cameraAnimationId = requestAnimationFrame(checkBarcodeFrame);
                            });
                    } else {
                        stopCameraScanner();
                        closeCameraModal();
                        if (typeof showToast === 'function') showToast('⚠️ متصفحك لا يدعم قراءة الباركود بالكاميرا', 'error');
                        console.error('BarcodeDetector API is not supported by this browser.');
                    }
                } else {
                    cameraAnimationId = requestAnimationFrame(checkBarcodeFrame);
                }
            };

            cameraAnimationId = requestAnimationFrame(checkBarcodeFrame);
            if (typeof showToast === 'function') showToast('📷 تم تشغيل الكاميرا لقراءة الباركود', 'info');
            return true;
        } catch (err) {
            console.error('❌ خطأ في تشغيل كاميرا الباركود:', err);
            if (typeof showToast === 'function') showToast('⚠️ تعذر الوصول إلى الكاميرا: ' + err.message, 'error');
            return false;
        }
    }

    function stopCameraScanner() {
        if (cameraAnimationId) {
            cancelAnimationFrame(cameraAnimationId);
            cameraAnimationId = null;
        }
        if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());
            videoStream = null;
        }
        const video = document.getElementById('barcodeCameraVideo');
        if (video) video.srcObject = null;
    }

    function openCameraModal() {
        const modal = document.getElementById('bayanCameraModal');
        if (!modal) return;
        modal.style.display = 'flex';
        modal.classList.remove('hidden');
        startCameraScanner();
    }

    function closeCameraModal() {
        const modal = document.getElementById('bayanCameraModal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.add('hidden');
        }
        stopCameraScanner();
    }

    function autoFocusActiveInput() {
        const target = getActiveScanTarget();
        if (target === 'sales') {
            const el = document.getElementById('productSearch');
            if (el) el.focus();
        } else if (target === 'purchase') {
            const el = document.getElementById('purchaseSearch');
            if (el) el.focus();
        } else if (target === 'adjustment') {
            const el = document.getElementById('adjSearch');
            if (el) el.focus();
        } else if (target === 'transfer') {
            const el = document.getElementById('transferProductSearch');
            if (el) el.focus();
        }
    }

    function init() {
        startHardwareListener();
        console.log('🚀 [BayanBarcode Engine Activated 100%]');
    }

    return {
        init,
        playBeep,
        validate,
        isDuplicate,
        findProductAndVariantByBarcode,
        parseScaleBarcode,
        getActiveScanTarget,
        handleScan,
        startHardwareListener,
        stopHardwareListener,
        startCameraScanner,
        stopCameraScanner,
        openCameraModal,
        closeCameraModal,
        autoFocusActiveInput
    };
})();

// تصدير عالمي
window.BayanBarcode = BayanBarcode;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => BayanBarcode.init());
} else {
    BayanBarcode.init();
}
