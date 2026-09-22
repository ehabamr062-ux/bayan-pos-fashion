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

    // قفل الحماية من القراءة المزدوجة وتصفية لواحق السكانر (CR/LF)
    let lastScanTime = 0;
    let lastScanCode = '';
    let lastSuccessfulScanTime = 0;
    const SCAN_COOLDOWN_MS = 400; // منع القراءة المزدوجة لنفس الباركود خلال 400ms

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

        let matchedUnitResult = null;
        let matchedParentResult = null;

        // فحص مدمج فائق السرعة بدورة واحدة فقط Single Pass بدلاً من الدوران 3 مرات
        for (let i = 0; i < list.length; i++) {
            const p = list[i];
            if (!p) continue;

            // 1. الأولوية المطلقة لباركود التشكيلات (المقاسات والألوان)
            if (p.variants && Array.isArray(p.variants)) {
                for (let j = 0; j < p.variants.length; j++) {
                    const v = p.variants[j];
                    if (v && v.barcode && String(v.barcode).trim() === clean) {
                        return {
                            product: p,
                            variant: v,
                            unit: null,
                            matchType: 'variant'
                        };
                    }
                }
            }

            // 2. باركود الوحدات المتعددة
            if (!matchedUnitResult && p.units && Array.isArray(p.units)) {
                for (let k = 0; k < p.units.length; k++) {
                    const u = p.units[k];
                    if (u && String(u.unitBarcode || '').trim() === clean) {
                        matchedUnitResult = {
                            product: p,
                            variant: null,
                            unit: u,
                            matchType: 'unit'
                        };
                        break;
                    }
                }
            }

            // 3. باركود أو كود الصنف الأساسي
            if (!matchedParentResult) {
                if (String(p.barcode || '').trim() === clean || String(p.code || '').trim() === clean) {
                    matchedParentResult = {
                        product: p,
                        variant: null,
                        unit: null,
                        matchType: 'parent'
                    };
                }
            }
        }

        return matchedUnitResult || matchedParentResult || null;
    }

    /**
     * تحديد الشاشة النشطة حالياً لتوجيه الصنف للجدول المناسب
     * (مقتصرة حصرياً على: البيع، الشراء، التسوية، تحويل المخزن، وكارت الصنف)
     */
    function getActiveScanTarget() {
        // 1. شاشة تحويل المخزن (إذا كان مودال التحويل مفتوحاً أو حقل البحث نشط)
        const activeElem = document.activeElement;
        if (activeElem && (activeElem.id === 'transferProductSearch' || (typeof activeElem.closest === 'function' && activeElem.closest('#transferModal')))) {
            return 'transfer';
        }
        const transferModal = document.getElementById('transferModal');
        if (transferModal && !transferModal.classList.contains('hidden')) {
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
        if (secId === 'sales-return-section') return 'salesReturn';
        if (secId === 'purchase-return-section') return 'purchaseReturn';
        if (secId === 'adjustment-section') return 'adjustment';

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

        // فحص قفل الحماية من القراءة المزدوجة اللحظية
        const now = performance.now();
        if (cleanCode === lastScanCode && (now - lastScanTime) < SCAN_COOLDOWN_MS) {
            console.warn(`⚠️ [BayanBarcode Engine] تم حظر قراءة مزدوجة مكررة للباركود: "${cleanCode}" (${Math.round(now - lastScanTime)}ms)`);
            return;
        }
        lastScanTime = now;
        lastScanCode = cleanCode;
        lastSuccessfulScanTime = now;

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
                const vPrice = (typeof window.getEffectiveAdjustmentPrice === 'function')
                    ? window.getEffectiveAdjustmentPrice(product, variant, unit)
                    : (variant ? (parseFloat(variant.cost) || parseFloat(product.cost) || 0) : (parseFloat(product.cost) || 0));
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
                    price: vPrice,
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
            if (product.variants && Array.isArray(product.variants) && product.variants.length > 0 && !variant) {
                if (typeof showVariantSelectionModal === 'function') {
                    showVariantSelectionModal(product, 'transfer');
                }
                playBeep(true);
                clearAndFocusSearch('transferProductSearch');
                return;
            }

            if (!window.transferItemsBatch) window.transferItemsBatch = [];

            const vSize = variant ? (variant.size || '') : '';
            const vColor = variant ? (variant.color || '') : '';
            const pId = product.id;

            const fromWh = (document.getElementById('transferFrom')?.value || 'المخزن الرئيسي').trim();
            let currentWhStock = (typeof getWarehouseStock === 'function') ? getWarehouseStock(product.name, fromWh) : (parseFloat(product.stock) || 0);
            if (variant) {
                if (variant.warehouseStocks && typeof variant.warehouseStocks === 'object' && variant.warehouseStocks[fromWh] !== undefined) {
                    currentWhStock = parseFloat(variant.warehouseStocks[fromWh]) || 0;
                } else if (fromWh === 'المخزن الرئيسي' || !variant.warehouseStocks || Object.keys(variant.warehouseStocks).length === 0) {
                    currentWhStock = parseFloat(variant.stock) || 0;
                } else {
                    currentWhStock = (variant.warehouseStocks && variant.warehouseStocks[fromWh] !== undefined)
                        ? (parseFloat(variant.warehouseStocks[fromWh]) || 0)
                        : (parseFloat(variant.stock) || parseFloat(product.stock) || 0);
                }
            }

            const existing = window.transferItemsBatch.find(it =>
                it.id === pId &&
                ((it.size || it.selectedSize || '') === vSize) &&
                ((it.color || it.selectedColor || '') === vColor)
            );
            const currentBatchQty = existing ? (parseFloat(existing.qty) || 0) : 0;

            if (currentWhStock <= 0 || (currentBatchQty + 1) > currentWhStock) {
                playBeep(false);
                const vDetails = variant ? ` (${vSize ? 'مقاس: ' + vSize : ''}${vColor ? ' - لون: ' + vColor : ''})` : '';
                if (typeof showToast === 'function') {
                    showToast(`🚫 لا يمكن التحويل: رصيد الصنف [${product.name}${vDetails}] في مخزن (${fromWh}) هو (${currentWhStock}) فقط!`, 'error');
                }
                clearAndFocusSearch('transferProductSearch');
                return;
            }

            if (existing) {
                existing.qty = (parseFloat(existing.qty) || 0) + 1;
            } else {
                const effPrice = (typeof window.getEffectiveTransferPrice === 'function')
                    ? window.getEffectiveTransferPrice(product, variant)
                    : (variant ? (parseFloat(variant.cost) || parseFloat(product.cost) || 0) : (parseFloat(product.cost) || 0));

                window.transferItemsBatch.push({
                    id: product.id,
                    name: product.name,
                    code: (variant && variant.barcode) ? variant.barcode : (product.code || product.id),
                    selectedSize: vSize,
                    selectedColor: vColor,
                    size: vSize,
                    color: vColor,
                    stock: currentWhStock,
                    sourceStock: currentWhStock,
                    qty: 1,
                    price: effPrice,
                    unitName: (unit && unit.unitName) ? unit.unitName : (product.unit || 'قطعة'),
                    unitFactor: (unit && unit.factor) ? (parseFloat(unit.factor) || 1) : 1
                });
            }

            if (typeof transferItemsBatch !== 'undefined') transferItemsBatch = window.transferItemsBatch;
            if (typeof renderTransferTable === 'function') renderTransferTable();
            playBeep(true);
            const vDetails = variant ? ` (${vSize ? 'مقاس: ' + vSize : ''}${vColor ? ' - لون: ' + vColor : ''})` : '';
            if (typeof showToast === 'function') {
                showToast(`✅ [تحويل سريع] +1 ${product.name}${vDetails}`, 'success');
            }
            clearAndFocusSearch('transferProductSearch');
            return;
        }

        // ══════════════════════════════════════════════════════════
        // 5. شاشة مرتجع المبيعات (Sales Returns)
        // ══════════════════════════════════════════════════════════
        if (targetScreen === 'salesReturn') {
            if (product.variants && Array.isArray(product.variants) && product.variants.length > 0 && !variant) {
                if (typeof showVariantSelectionModal === 'function') {
                    showVariantSelectionModal(product, 'salesReturn');
                }
                playBeep(true);
                clearAndFocusSearch('returnProductSearch');
                return;
            }

            const vSize = variant ? (variant.size || '') : '';
            const vColor = variant ? (variant.color || '') : '';
            const pPrice = variant ? (parseFloat(variant.price) || parseFloat(product.price) || 0) : (parseFloat(product.price) || 0);

            if (typeof returnCart !== 'undefined' && Array.isArray(returnCart)) {
                const existing = returnCart.find(it =>
                    it.id === product.id &&
                    ((it.size || it.selectedSize || '') === vSize) &&
                    ((it.color || it.selectedColor || '') === vColor)
                );

                if (existing) {
                    existing.qty = (parseFloat(existing.qty) || 0) + 1;
                } else {
                    returnCart.push({
                        id: product.id,
                        name: product.name,
                        code: (variant && variant.barcode) ? variant.barcode : (product.code || product.id),
                        price: pPrice,
                        qty: 1,
                        maxQty: 9999,
                        selectedSize: vSize,
                        selectedColor: vColor,
                        selectedVariant: variant,
                        selectedUnit: unit,
                        unitFactor: unit ? (unit.factor || 1) : 1
                    });
                }

                if (typeof renderReturnCart === 'function') renderReturnCart();
                playBeep(true);
                const vDetails = variant ? ` (${vSize ? 'مقاس: ' + vSize : ''}${vColor ? ' - لون: ' + vColor : ''})` : '';
                if (typeof showToast === 'function') {
                    showToast(`✅ [مرتجع مبيعات] +1 ${product.name}${vDetails}`, 'success');
                }
                clearAndFocusSearch('returnProductSearch');
            }
            return;
        }

        // ══════════════════════════════════════════════════════════
        // 6. شاشة مرتجع المشتريات (Purchase Returns)
        // ══════════════════════════════════════════════════════════
        if (targetScreen === 'purchaseReturn') {
            if (product.variants && Array.isArray(product.variants) && product.variants.length > 0 && !variant) {
                if (typeof showVariantSelectionModal === 'function') {
                    showVariantSelectionModal(product, 'purReturn');
                }
                playBeep(true);
                clearAndFocusSearch('purReturnProductSearch');
                return;
            }

            const vSize = variant ? (variant.size || '') : '';
            const vColor = variant ? (variant.color || '') : '';
            const pCost = variant ? (parseFloat(variant.cost) || parseFloat(product.cost) || 0) : (parseFloat(product.cost) || 0);

            if (typeof purReturnCart !== 'undefined' && Array.isArray(purReturnCart)) {
                const existing = purReturnCart.find(it =>
                    it.id === product.id &&
                    ((it.size || it.selectedSize || '') === vSize) &&
                    ((it.color || it.selectedColor || '') === vColor)
                );

                if (existing) {
                    existing.qty = (parseFloat(existing.qty) || 0) + 1;
                } else {
                    purReturnCart.push({
                        id: product.id,
                        name: product.name,
                        code: (variant && variant.barcode) ? variant.barcode : (product.code || product.id),
                        price: pCost,
                        qty: 1,
                        maxQty: 9999,
                        selectedSize: vSize,
                        selectedColor: vColor,
                        selectedVariant: variant,
                        selectedUnit: unit,
                        unitFactor: unit ? (unit.factor || 1) : 1
                    });
                }

                if (typeof renderPurReturnCart === 'function') renderPurReturnCart();
                playBeep(true);
                const vDetails = variant ? ` (${vSize ? 'مقاس: ' + vSize : ''}${vColor ? ' - لون: ' + vColor : ''})` : '';
                if (typeof showToast === 'function') {
                    showToast(`✅ [مرتجع شراء] +1 ${product.name}${vDetails}`, 'success');
                }
                clearAndFocusSearch('purReturnProductSearch');
            }
            return;
        }
    }

    /**
     * مستمع لوحة المفاتيح الفائق لمدخلات السكانر (Global KeyDown Listener)
     */
    function onGlobalKeyDown(e) {
        if (!e || typeof e.key !== 'string') return;
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
            // تصفية أي Enter لاحقة ترسلها أجهزة السكانر (CR/LF suffix) خلال 350ms من المسح الناجح
            if (performance.now() - lastSuccessfulScanTime < 350) {
                e.preventDefault();
                e.stopPropagation();
                buffer = '';
                keyIntervals = [];
                return;
            }

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
                    lastSuccessfulScanTime = performance.now();
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

    function isRecentScan() {
        return (performance.now() - lastSuccessfulScanTime) < 450;
    }

    return {
        init,
        playBeep,
        validate,
        isRecentScan,
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
window.isBayanRecentScan = () => (typeof BayanBarcode !== 'undefined' && typeof BayanBarcode.isRecentScan === 'function') ? BayanBarcode.isRecentScan() : false;

/**
 * المعالج الشامل والمباشر لباركودات مربعات البحث (Paste & Enter Auto-Dispatcher)
 * يعمل في كل الأقسام: بيع، شراء، تسوية، تحويل، مرتجع بيع، مرتجع شراء
 * @param {string} code 
 * @param {string} context ('sales' | 'purchase' | 'adj' | 'transfer' | 'salesReturn' | 'purReturn')
 * @returns {boolean} true إذا تم التعامل مع الباركود بنجاح
 */
window.dispatchSearchBarcode = function(code, context) {
    if (!code) return false;
    const clean = String(code).trim();
    if (!clean || clean.length < 3) return false;

    // البحث الدقيق بواسطة محرك الباركود
    let match = null;
    if (typeof BayanBarcode !== 'undefined' && typeof BayanBarcode.findProductAndVariantByBarcode === 'function') {
        match = BayanBarcode.findProductAndVariantByBarcode(clean);
    } else {
        const list = (typeof productsDB !== 'undefined' && Array.isArray(productsDB)) ? productsDB : [];
        for (const p of list) {
            if (p.variants && Array.isArray(p.variants)) {
                const v = p.variants.find(x => x.barcode && String(x.barcode).trim() === clean);
                if (v) { match = { product: p, variant: v, matchType: 'variant' }; break; }
            }
        }
        if (!match) {
            for (const p of list) {
                if (String(p.barcode || '').trim() === clean || String(p.code || '').trim() === clean) {
                    match = { product: p, variant: null, matchType: 'parent' }; break;
                }
            }
        }
    }

    if (!match) return false;

    const product = match.product;
    const variant = match.variant;
    const unit = match.unit;

    const cleanSearchUI = (inputId, resultsId) => {
        const inp = document.getElementById(inputId);
        if (inp) inp.value = '';
        const res = document.getElementById(resultsId);
        if (res) {
            res.style.display = 'none';
            res.innerHTML = '';
            res.classList.remove('hidden');
        }
    };

    // 1. إذا كان الباركود دولي عام للموديل وله مقاسات وألوان:
    // تفتح نافذة المقاسات والألوان فوراً وتلقائياً دون عرض قائمة نتائج البحث
    if (!variant && product.variants && Array.isArray(product.variants) && product.variants.length > 0) {
        if (context === 'sales') cleanSearchUI('productSearch', 'searchResults');
        else if (context === 'purchase') cleanSearchUI('purchaseSearch', 'purchaseSearchResults');
        else if (context === 'adj') cleanSearchUI('adjSearch', 'adjSearchResults');
        else if (context === 'transfer') cleanSearchUI('transferProductSearch', 'transferSearchResults');
        else if (context === 'salesReturn') cleanSearchUI('returnProductSearch', 'returnSearchResults');
        else if (context === 'purReturn') cleanSearchUI('purReturnProductSearch', 'purReturnSearchResults');

        if (typeof showVariantSelectionModal === 'function') {
            showVariantSelectionModal(product, context);
        }
        if (typeof BayanBarcode !== 'undefined') BayanBarcode.playBeep(true);
        return true;
    }

    // 2. إذا كان الباركود فريداً لمقاس ولون محدد:
    // ينزل فوراً في الفاتورة/الجدول بالمقاس واللون دون فتح أي نافذة
    const vSize = variant ? (variant.size || '') : '';
    const vColor = variant ? (variant.color || '') : '';
    const vDetails = variant ? ` (مقاس: ${vSize || '---'} - لون: ${vColor || '---'})` : '';

    if (context === 'sales') {
        cleanSearchUI('productSearch', 'searchResults');
        let added = false;
        const defU = (product.units && product.units.length > 0) ? (product.units.find(u => u.isBaseUnit) || product.units[0]) : null;
        if (variant) {
            if (typeof completeAddToCart === 'function') {
                added = completeAddToCart(product, defU, variant);
            } else if (typeof addToCart === 'function') {
                added = addToCart(product.id, defU, variant);
            }
        } else {
            if (typeof completeAddToCart === 'function') {
                added = completeAddToCart(product, unit || defU, null);
            } else if (typeof addToCart === 'function') {
                added = addToCart(product.id);
            }
        }
        // إذا فشلت الإضافة (مثل عدم توفر الرصيد أو رصيد صفر)، لا نطلق صوت النجاح ولا الإشعار الأخضر
        if (added !== false) {
            if (typeof BayanBarcode !== 'undefined') BayanBarcode.playBeep(true);
            if (typeof showToast === 'function') showToast(`✅ +1 ${product.name}${vDetails}`, 'success');
            return true;
        }
        return false;
    }

    // دالة مساعدة لمعايرة المقاسات والألوان وتوحيد القيم الافتراضية
    const cleanAttr = (val) => {
        const s = String(val || '').trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/[ىي]/g, 'ي').replace(/\s+/g, ' ');
        if (!s || s === 'قياسي' || s === 'موحد' || s === 'عام' || s === '-') return '';
        return s;
    };
    const cSize = cleanAttr(vSize);
    const cColor = cleanAttr(vColor);
    const vBarcode = variant && variant.barcode ? String(variant.barcode).trim() : '';

    if (context === 'purchase') {
        cleanSearchUI('purchaseSearch', 'purchaseSearchResults');
        if (typeof addToPurchaseCart === 'function') {
            const uName = unit ? (unit.unitName || unit) : null;
            addToPurchaseCart(product.id, uName, null, null, variant);
        }
        if (typeof BayanBarcode !== 'undefined') BayanBarcode.playBeep(true);
        if (typeof showToast === 'function') showToast(`✅ [توريد] +1 ${product.name}${vDetails}`, 'success');
        return true;
    }

    if (context === 'adj') {
        cleanSearchUI('adjSearch', 'adjSearchResults');
        if (!window.adjCart) window.adjCart = [];
        const existing = window.adjCart.find(it => {
            if (vBarcode && String(it.code || '').trim() === vBarcode) return true;
            const isSame = (it.id === product.id || String(it.id) === String(product.id) || it.name === product.name);
            if (!isSame) return false;
            return cleanAttr(it.size || it.selectedSize || '') === cSize && cleanAttr(it.color || it.selectedColor || '') === cColor;
        });
        if (existing) {
            existing.qty = (parseFloat(existing.qty) || 0) + 1;
        } else {
            const activeWH = ((typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'المخزن الرئيسي').trim();
            let liveStock = 0;
            if (variant) {
                if (variant.warehouseStocks && typeof variant.warehouseStocks === 'object' && variant.warehouseStocks[activeWH] !== undefined) {
                    liveStock = parseFloat(variant.warehouseStocks[activeWH]) || 0;
                } else if (activeWH === 'المخزن الرئيسي' || !variant.warehouseStocks) {
                    liveStock = parseFloat(variant.stock) || 0;
                }
            } else {
                if (product.warehouseStocks && typeof product.warehouseStocks === 'object' && product.warehouseStocks[activeWH] !== undefined) {
                    liveStock = parseFloat(product.warehouseStocks[activeWH]) || 0;
                } else if (activeWH === 'المخزن الرئيسي' || !product.warehouseStocks) {
                    liveStock = parseFloat(product.stock) || 0;
                }
            }

            const vPrice = (typeof window.getEffectiveAdjustmentPrice === 'function')
                ? window.getEffectiveAdjustmentPrice(product, variant, unit)
                : (variant ? (parseFloat(variant.cost) || parseFloat(product.cost) || 0) : (parseFloat(product.cost) || 0));
            window.adjCart.push({
                ...product,
                id: product.id,
                name: product.name,
                code: (variant && variant.barcode) ? variant.barcode : (product.code || product.id),
                selectedSize: vSize,
                selectedColor: vColor,
                size: vSize,
                color: vColor,
                stock: liveStock,
                qty: 1,
                price: vPrice,
                notes: '',
                unitFactor: unit ? (unit.factor || 1) : 1,
                selectedUnit: unit || null
            });
        }
        if (typeof renderAdjTable === 'function') renderAdjTable();
        if (typeof BayanBarcode !== 'undefined') BayanBarcode.playBeep(true);
        if (typeof showToast === 'function') showToast(`✅ [جرد وتسويه] +1 ${product.name}${vDetails}`, 'success');
        return true;
    }

    if (context === 'transfer') {
        cleanSearchUI('transferProductSearch', 'transferSearchResults');
        if (!window.transferItemsBatch) window.transferItemsBatch = [];
        const fromWh = (document.getElementById('transferFrom')?.value || 'المخزن الرئيسي').trim();
        let currentWhStock = (typeof getWarehouseStock === 'function') ? getWarehouseStock(product.name, fromWh) : (parseFloat(product.stock) || 0);
        if (variant) {
            if (variant.warehouseStocks && typeof variant.warehouseStocks === 'object' && variant.warehouseStocks[fromWh] !== undefined) {
                currentWhStock = parseFloat(variant.warehouseStocks[fromWh]) || 0;
            } else if (fromWh === 'المخزن الرئيسي' || !variant.warehouseStocks || Object.keys(variant.warehouseStocks).length === 0) {
                currentWhStock = parseFloat(variant.stock) || 0;
            } else {
                currentWhStock = (variant.warehouseStocks && variant.warehouseStocks[fromWh] !== undefined)
                    ? (parseFloat(variant.warehouseStocks[fromWh]) || 0)
                    : (parseFloat(variant.stock) || parseFloat(product.stock) || 0);
            }
        }

        const existing = window.transferItemsBatch.find(it => {
            if (vBarcode && String(it.code || '').trim() === vBarcode) return true;
            const isSame = (it.id === product.id || String(it.id) === String(product.id) || it.name === product.name);
            if (!isSame) return false;
            return cleanAttr(it.size || it.selectedSize || '') === cSize && cleanAttr(it.color || it.selectedColor || '') === cColor;
        });

        // 🛡️ الحراسة التراكمية الفورية للتحويل المخزني
        let currentBatchBaseQty = 0;
        window.transferItemsBatch.forEach(it => {
            let isMatch = false;
            if (vBarcode && String(it.code || '').trim() === vBarcode) isMatch = true;
            if (!isMatch) {
                const isSame = (it.id === product.id || String(it.id) === String(product.id) || it.name === product.name);
                if (isSame && cleanAttr(it.size || it.selectedSize || '') === cSize && cleanAttr(it.color || it.selectedColor || '') === cColor) {
                    isMatch = true;
                }
            }
            if (isMatch) {
                const itFactor = parseFloat(it.unitFactor) || 1;
                currentBatchBaseQty += (parseFloat(it.qty) || 0) * itFactor;
            }
        });

        const newTransferFactor = (unit && unit.factor) ? (parseFloat(unit.factor) || 1) : 1;
        const totalRequestedTransferQty = currentBatchBaseQty + (1 * newTransferFactor);

        if (currentWhStock <= 0 || totalRequestedTransferQty > currentWhStock) {
            if (typeof BayanBarcode !== 'undefined') BayanBarcode.playBeep(false);
            if (typeof showToast === 'function') {
                const currDisplay = (currentBatchBaseQty / newTransferFactor).toFixed(2).replace(/\.?0+$/, '');
                showToast(`🚫 لا يمكن التحويل: متاح بمخزن (${fromWh}) للصنف [${product.name}${vDetails}] هو (${currentWhStock}) فقط، وموجود بقائمة التحويل حالياً (${currDisplay})!`, 'error', 5000);
            }
            return false;
        }

        if (existing) {
            existing.qty = (parseFloat(existing.qty) || 0) + 1;
        } else {
            const effPrice = (typeof window.getEffectiveTransferPrice === 'function')
                ? window.getEffectiveTransferPrice(product, variant)
                : (variant ? (parseFloat(variant.cost) || parseFloat(product.cost) || 0) : (parseFloat(product.cost) || 0));

            window.transferItemsBatch.push({
                id: product.id,
                name: product.name,
                code: (variant && variant.barcode) ? variant.barcode : (product.code || product.id),
                selectedSize: vSize,
                selectedColor: vColor,
                size: vSize,
                color: vColor,
                stock: currentWhStock,
                sourceStock: currentWhStock,
                qty: 1,
                price: effPrice,
                unitName: (unit && unit.unitName) ? unit.unitName : (product.unit || 'قطعة'),
                unitFactor: (unit && unit.factor) ? (parseFloat(unit.factor) || 1) : 1
            });
        }
        if (typeof transferItemsBatch !== 'undefined') transferItemsBatch = window.transferItemsBatch;
        if (typeof renderTransferTable === 'function') renderTransferTable();
        if (typeof BayanBarcode !== 'undefined') BayanBarcode.playBeep(true);
        if (typeof showToast === 'function') showToast(`✅ [تحويل] +1 ${product.name}${vDetails}`, 'success');
        return true;
    }

    if (context === 'salesReturn') {
        cleanSearchUI('returnProductSearch', 'returnSearchResults');
        const pPrice = variant ? (parseFloat(variant.price) || parseFloat(product.price) || 0) : (parseFloat(product.price) || 0);
        if (typeof returnCart !== 'undefined' && Array.isArray(returnCart)) {
            const existing = returnCart.find(it => {
                if (vBarcode && String(it.code || '').trim() === vBarcode) return true;
                const isSame = (it.id === product.id || String(it.id) === String(product.id) || it.name === product.name);
                if (!isSame) return false;
                return cleanAttr(it.size || it.selectedSize || '') === cSize && cleanAttr(it.color || it.selectedColor || '') === cColor;
            });
            if (existing) {
                existing.qty = (parseFloat(existing.qty) || 0) + 1;
            } else {
                returnCart.push({
                    id: product.id,
                    name: product.name,
                    code: (variant && variant.barcode) ? variant.barcode : (product.code || product.id),
                    price: pPrice,
                    qty: 1,
                    maxQty: 9999,
                    selectedSize: vSize,
                    selectedColor: vColor,
                    selectedVariant: variant,
                    selectedUnit: unit,
                    unitFactor: unit ? (unit.factor || 1) : 1
                });
            }
            if (typeof renderReturnCart === 'function') renderReturnCart();
            if (typeof BayanBarcode !== 'undefined') BayanBarcode.playBeep(true);
            if (typeof showToast === 'function') showToast(`✅ [مرتجع بيع] +1 ${product.name}${vDetails}`, 'success');
            return true;
        }
    }

    if (context === 'purReturn') {
        cleanSearchUI('purReturnProductSearch', 'purReturnSearchResults');
        const pCost = variant ? (parseFloat(variant.cost) || parseFloat(product.cost) || 0) : (parseFloat(product.cost) || 0);
        if (typeof purReturnCart !== 'undefined' && Array.isArray(purReturnCart)) {
            const existing = purReturnCart.find(it => {
                if (vBarcode && String(it.code || '').trim() === vBarcode) return true;
                const isSame = (it.id === product.id || String(it.id) === String(product.id) || it.name === product.name);
                if (!isSame) return false;
                return cleanAttr(it.size || it.selectedSize || '') === cSize && cleanAttr(it.color || it.selectedColor || '') === cColor;
            });
            if (existing) {
                existing.qty = (parseFloat(existing.qty) || 0) + 1;
            } else {
                purReturnCart.push({
                    id: product.id,
                    name: product.name,
                    code: (variant && variant.barcode) ? variant.barcode : (product.code || product.id),
                    price: pCost,
                    qty: 1,
                    maxQty: 9999,
                    selectedSize: vSize,
                    selectedColor: vColor,
                    selectedVariant: variant,
                    selectedUnit: unit,
                    unitFactor: unit ? (unit.factor || 1) : 1
                });
            }
            if (typeof renderPurReturnCart === 'function') renderPurReturnCart();
            if (typeof BayanBarcode !== 'undefined') BayanBarcode.playBeep(true);
            if (typeof showToast === 'function') showToast(`✅ [مرتجع شراء] +1 ${product.name}${vDetails}`, 'success');
            return true;
        }
    }

    return false;
};

// الاستماع الفوري لحدث اللصق (Paste Event) عبر كافة حقول البحث في الأقسام الستة
document.addEventListener('paste', function(e) {
    const target = e.target;
    if (!target) return;
    const id = target.id;
    let context = null;
    if (id === 'productSearch') context = 'sales';
    else if (id === 'purchaseSearch') context = 'purchase';
    else if (id === 'adjSearch') context = 'adj';
    else if (id === 'transferProductSearch') context = 'transfer';
    else if (id === 'returnProductSearch') context = 'salesReturn';
    else if (id === 'purReturnProductSearch') context = 'purReturn';

    if (context) {
        const pastedText = (e.clipboardData || window.clipboardData)?.getData('text');
        if (pastedText && pastedText.trim().length >= 3) {
            const handled = window.dispatchSearchBarcode(pastedText.trim(), context);
            if (handled) {
                e.preventDefault();
                e.stopPropagation();
                target.value = '';
            }
        }
    }
}, true);

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => BayanBarcode.init());
} else {
    BayanBarcode.init();
}
