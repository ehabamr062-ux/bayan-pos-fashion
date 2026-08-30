// ============================================================
//  شاشة ونقاط البيع، الكاشير، وحساب الفواتير (POS & Cashier Engine)
// ============================================================
function handleGeneralAccountSearch(query, inputId, resultsId) {

    const resultsDiv = document.getElementById(resultsId);

    resultsDiv.innerHTML = '';

    // إظهار/إخفاء زر الحذف (X)

    const clearBtn = document.getElementById(inputId + 'Clear');

    if (clearBtn) clearBtn.style.display = query ? 'block' : 'none';

    if (!query) {

        resultsDiv.style.display = 'none';

        // تصفير الرصيد عند مسح الاسم

        const balId = (inputId === 'receiptCustomer') ? 'receiptAccountBalance' : 'disburseAccountBalance';

        const balEl = document.getElementById(balId);

        if (balEl) balEl.innerText = '0.00';

        return;

    }

    // البحث بالاسم أو الكود
    const queryLower = query.toLowerCase();
    const filtered = accounts.filter(a => (a.name && a.name.toLowerCase().includes(queryLower)) || (a.code && a.code.toString().includes(query)));

    // إذا تم كتابة اسم حساب مطابق تماماً، يتم حديث الرصيد فوراً
    const exactMatch = accounts.find(a => a.name.trim().toLowerCase() === query.trim().toLowerCase());
    if (exactMatch && (inputId === 'receiptCustomer' || inputId === 'disbursePayee')) {
        const bal = typeof getAccountBalance === 'function' ? getAccountBalance(exactMatch.name) : (exactMatch.balance || 0);
        const formattedBal = (bal < 0 ? '-' : '') + Math.abs(bal).toLocaleString('en-US', { minimumFractionDigits: 2 });
        const balId = (inputId === 'receiptCustomer') ? 'receiptAccountBalance' : 'disburseAccountBalance';
        const balEl = document.getElementById(balId);
        if (balEl) balEl.innerText = formattedBal;
    }

    if (filtered.length > 0) {

        resultsDiv.style.display = 'block';

        filtered.forEach(a => {

            const div = document.createElement('div');

            div.className = 'result-item';

            div.innerHTML = `<span>${a.name}</span> <span class="stock-badge">${a.type === 'client' ? 'عميل' : (a.type === 'supplier' ? 'مورد' : a.type)}</span>`;

            div.onclick = () => {

                document.getElementById(inputId).value = a.name;

                resultsDiv.style.display = 'none';

                // إظهار زر X للمسح

                if (clearBtn) clearBtn.style.display = 'block';

                // تحديث الرصيد للمعلومات فقط

                if (inputId === 'receiptCustomer' || inputId === 'disbursePayee') {
                    const bal = typeof getAccountBalance === 'function' ? getAccountBalance(a.name) : (a.balance || 0);
                    const formattedBal = (bal < 0 ? '-' : '') + Math.abs(bal).toLocaleString('en-US', { minimumFractionDigits: 2 });
                    const balId = (inputId === 'receiptCustomer') ? 'receiptAccountBalance' : 'disburseAccountBalance';
                    const balEl = document.getElementById(balId);
                    if (balEl) balEl.innerText = formattedBal;
                }

            };

            resultsDiv.appendChild(div);

        });

    } else {

        // خيار الإضافة السريعة

        resultsDiv.style.display = 'block';

        resultsDiv.innerHTML = `

                <div class="result-item" onclick="quickAddAccount('${query.replace(/'/g, "\\'")}')" style="color:var(--main-green); font-weight:bold; justify-content:center;">

                <span>➕ إضافة سريع: ${query}</span>

                </div>

                `;

    }

}

function clearAccountSearch(inputId, balanceId) {

    const input = document.getElementById(inputId);

    if (input) {

        input.value = '';

        input.focus();

    }

    if (document.getElementById(balanceId)) document.getElementById(balanceId).innerText = '0.00';

    if (document.getElementById(inputId + 'Clear')) document.getElementById(inputId + 'Clear').style.display = 'none';

    const resultsId = (inputId === 'receiptCustomer') ? 'receiptSearchResults' : 'disburseSearchResults';

    const resultsDiv = document.getElementById(resultsId);

    if (resultsDiv) {

        resultsDiv.innerHTML = '';

        resultsDiv.style.display = 'none';

    }

}

async function handleCustomerSearch(query) {

    const resultsDiv = document.getElementById('customerSearchResults');

    resultsDiv.innerHTML = '';

    if (!query) { resultsDiv.style.display = 'none'; return; }

    // البحث بالاسم أو الكود مباشرة في المصفوفة المحلية لسرعة الاستجابة

    const queryLower = query.toLowerCase();

    const combined = accounts.filter(a =>

        (a.name && a.name.toLowerCase().includes(queryLower)) ||

        (a.code && a.code.toString().includes(queryLower)) ||

        (a.mobile && a.mobile.includes(queryLower))

    );

    if (combined.length > 0) {

        resultsDiv.style.display = 'block';

        combined.forEach(a => {

            const div = document.createElement('div');

            div.className = 'result-item';

            div.innerHTML = `<span>${a.name}</span> <span class="stock-badge">${a.type === 'client' ? 'عميل' : (a.type === 'mixed' ? 'مشترك' : 'حساب')}</span>`;

            div.onclick = () => {

                document.getElementById('customerName').value = a.name;

                resultsDiv.style.display = 'none';

                // تحديث مستوى السعر تلقائياً بناءً على بيانات العميل (فقط إذا لم يكن مثبتاً بالدبوس 📌)
                if (typeof isPriceLevelPinned === 'function' && !isPriceLevelPinned()) {
                    if (a.priceLevel === 'wholesale') {
                        const pl = document.getElementById('salesPriceLevel');
                        if (pl) {
                            pl.value = 'wholesale';
                            updateCartPriceLevel();
                        }
                    } else {
                        const pl = document.getElementById('salesPriceLevel');
                        if (pl) {
                            pl.value = 'retail';
                            updateCartPriceLevel();
                        }
                    }
                }

                updateHeaderPartnerInfo();

                // تحديث المتغير العالمي عند اختيار العميل

                currentSessionSelectedAddress = (a.address || '').split(/[|,]/)[0];

                if (typeof calculateChange === 'function') calculateChange();

                if (typeof checkAccountFrozenAndAlert === 'function') {
                    checkAccountFrozenAndAlert(a);
                }

            };

            resultsDiv.appendChild(div);

        });

    } else {

        resultsDiv.style.display = 'block';

        resultsDiv.innerHTML = `

                <div class="result-item" onclick="quickAddAccount('${query.replace(/'/g, "\\'")}')" style="color:var(--main-green); font-weight:bold; justify-content:center;">

                <span>➕ إضافة عميل جديد: ${query}</span>

                </div>

                `;

    }

}

function quickAddAccount(name) {

    openNewAccountModal();

    document.getElementById('accName').value = name;

    // إخفاء قوائم البحث المفتوحة

    document.querySelectorAll('.search-results').forEach(el => el.style.display = 'none');

}

// ================= نظام التنقل في البحث بالكيبورد =================

let searchSelectedIndex = -1;
let purchaseSearchSelectedIndex = -1;

let currentHeaderProductId = null; let currentHeaderUnit = null; // لتتبع الصنف المختار حالياً في الهيدر قبل الحفظ

// دالة لاختيار الصنف وتعبئة بياناته في الهيدر (المربعات الملونة) قبل الحفظ

async function selectProductToHeader(productId) {

    const product = await db.products.get(productId);

    if (!product) return;

    currentHeaderProductId = productId; // تخزين الـ ID الحالي

    const resultsDiv = document.getElementById('searchResults');

    const pSearch = document.getElementById('productSearch');

    const hQty = document.getElementById('headerQty');

    const hPrice = document.getElementById('headerPrice');

    // 1. كتابة اسم الصنف في مربع البحث

    if (pSearch) pSearch.value = product.name;

    // 2. تحديد السعر التلقائي بناءً على مستوى السعر

    if (hPrice) {

        const priceLevelSelect = document.getElementById('salesPriceLevel');

        const priceLevel = priceLevelSelect ? priceLevelSelect.value : 'retail';

        // البحث عن وحدة البيع الافتراضية إذا وُجدت

        let defaultPrice = product.price;

        if (product.units && product.units.length > 1) {

            const resultsDiv = document.getElementById('searchResults'); if (resultsDiv) resultsDiv.style.display = 'none';

            showUnitSelectionModal(product, 'sales-header');

            return; // Stop here, the modal will complete the action

        } else if (product.units && product.units.length === 1) {

            const defUnit = product.units[0];

            defaultPrice = (priceLevel === 'wholesale') ? (defUnit.wholesale || defUnit.price) : defUnit.price;

            currentHeaderUnit = defUnit;

        } else {

            defaultPrice = (priceLevel === 'wholesale') ? (product.wholesale || product.price) : product.price;

            currentHeaderUnit = null;

        }

        hPrice.value = parseFloat(defaultPrice).toFixed(2);

    }

    // 3. تصفير الكمية لـ 1 والتركيز عليها (دورة الإنتر تبدأ هنا)

    if (hQty) {

        hQty.value = 1;

        hQty.focus();

        setTimeout(() => hQty.select(), 10);

    }

    // 4. إخفاء نتائج البحث

    if (resultsDiv) resultsDiv.style.display = 'none';

    return;

}

async function handleSearch(query) {

    const resultsDiv = document.getElementById('searchResults');

    searchSelectedIndex = -1; // إعادة تصغير المؤشر عند كل كتابة جديدة

    // منع قص النوافذ المنبثقة الجديدة وإلغاء القيود القديمة للفئة search-results
    resultsDiv.style.setProperty('overflow', 'visible', 'important');
    resultsDiv.style.setProperty('max-height', 'none', 'important');
    resultsDiv.style.setProperty('border', 'none', 'important');
    resultsDiv.style.setProperty('background', 'transparent', 'important');
    resultsDiv.style.setProperty('box-shadow', 'none', 'important');

    if (!query) {

        resultsDiv.innerHTML = '';

        resultsDiv.style.display = 'none';

        return;

    }

    // 1. فحص باركود أو كود (تطابق تام صريح)

    if (query.length >= 8 && typeof db !== 'undefined' && db.products) {
        try {
            let exact = await db.products.where('barcode').equals(query).first();

            if (!exact) exact = await db.products.where('code').equals(query).first();

            if (exact) {

                selectProductToHeader(exact.id);

                return;

            }
        } catch (e) { console.warn('DB Search error:', e); }
    }

    // 2. البحث الحي (Live Search)

    const queryLower = query.toLowerCase();

    const filtered = [];
    for (let i = 0; i < productsDB.length; i++) {
        const p = productsDB[i];
        if (
            (p.name && p.name.toLowerCase().includes(queryLower)) ||
            (p.barcode && String(p.barcode).toLowerCase().includes(queryLower)) ||
            (p.code && String(p.code).toLowerCase().includes(queryLower))
        ) {
            filtered.push(p);
            if (filtered.length >= 10) break;
        }
    }

    if (filtered.length > 0) {
        resultsDiv.innerHTML = `
            <div class="pos-search-panel" style="width: calc(100% + 340px); max-width: 580px; min-width: 320px; position: absolute; top: 100%; left: 50%; transform: translateX(50%); z-index: 99999; background: white; border-radius: 14px; box-shadow: 0 15px 35px rgba(0,0,0,0.2); border: 1px solid #cbd5e1; direction: rtl; text-align: right; margin-top: 6px; animation: modalFadeIn 0.2s ease-out;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; border-top-left-radius: 14px; border-top-right-radius: 14px;">
                    <span style="font-weight: 800; font-size: 0.88rem; color: #5e3370;">🔍 نتائج البحث (${filtered.length} صنف)</span>
                    <button onclick="document.getElementById('searchResults').style.display='none';" class="pos-search-close-btn" title="إغلاق النافذة">❌</button>
                </div>
                <div style="max-height: 380px; overflow-y: auto; padding: 6px; scrollbar-gutter: stable;">
                    ${filtered.map(p => {
                        const priceVal = parseFloat(p.price) || 0;
                        const activeWH = ((typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'المخزن الرئيسي').trim();
                        const stockVal = typeof getWarehouseStock === 'function' ? getWarehouseStock(p.name, activeWH) : 0;
                        return `
                            <div class="pos-search-row" onclick="selectProductToHeader(${p.id});" style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: 0.15s; border-radius: 10px; gap: 8px;">
                                <div style="flex: 1.5; min-width: 180px;">
                                    <div style="font-weight: 900; font-size: 0.98rem; color: #1e293b;">${p.name}</div>
                                    <div style="font-size: 0.75rem; color: #64748b; margin-top: 2px;">🏷️ كود: <b style="color:#5e3370;">${p.code || p.id}</b> | باركود: <b>${p.barcode || '---'}</b></div>
                                </div>
                                <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
                                    <div style="text-align: center; background: #f8fafc; padding: 5px 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
                                        <div style="font-size: 0.7rem; color: #64748b;">📦 الرصيد (${activeWH})</div>
                                        <div style="font-weight: 900; font-size: 0.95rem; color: ${stockVal <= 5 ? '#ef4444' : '#10b981'};">${stockVal} <span style="font-size:0.7rem;">${p.unit || 'قطعة'}</span></div>
                                    </div>
                                    <div style="text-align: center; background: rgba(59, 130, 246, 0.08); padding: 5px 14px; border-radius: 8px; border: 1.5px solid rgba(59, 130, 246, 0.25);">
                                        <div style="font-size: 0.7rem; color: #1d4ed8; font-weight: 800;">💰 سعر البيع</div>
                                        <div style="font-weight: 900; font-size: 1rem; color: #1e40af;">${priceVal.toFixed(2)} ج.م</div>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
        resultsDiv.style.display = 'block';
    } else {

        // إذا لم يتم العثور على أي صنف، نظهر خيار "إضافة صنف جديد"

        resultsDiv.innerHTML = '';

        resultsDiv.style.display = 'block';

        const div = document.createElement('div');

        div.className = 'search-item';

        div.style.padding = '15px';

        div.style.cursor = 'pointer';

        div.style.background = '#f5f3ff';

        div.style.border = '2px dashed #8e44ad';

        div.style.borderRadius = '8px';

        div.style.margin = '5px';

        div.style.color = '#8e44ad';

        div.style.textAlign = 'center';

        div.style.fontWeight = 'bold';

        div.innerHTML = `<span style="font-size: 1.2rem;">📝</span> إضافة تفصيلية لصنف جديد: (${query})`;

        div.onclick = () => {

            resultsDiv.style.display = 'none';

            quickAddProduct(query, 'sales');

        };

        resultsDiv.appendChild(div);

    }

}

// دالة جديدة للتحكم في الأسهم والإنتر داخل مربع البحث

const psElem = document.getElementById('productSearch');
if (psElem && !psElem._hasKeydown) {
    psElem._hasKeydown = true;
    psElem.addEventListener('keydown', function (e) {
        const resultsDiv = document.getElementById('searchResults');
        if (!resultsDiv || resultsDiv.style.display === 'none') return;
        const items = resultsDiv.querySelectorAll('.pos-search-row, .search-item, .result-item');
        if (items.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            searchSelectedIndex = (searchSelectedIndex + 1) % items.length;
            updateSearchSelection(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            searchSelectedIndex = (searchSelectedIndex - 1 + items.length) % items.length;
            updateSearchSelection(items);
        } else if (e.key === 'Enter') {
            if (searchSelectedIndex > -1 && items[searchSelectedIndex]) {
                e.preventDefault();
                e.stopPropagation();
                items[searchSelectedIndex].click();
            }
        } else if (e.key === 'Escape') {
            resultsDiv.style.display = 'none';
        }
    });
}

function updateSearchSelection(items) {
    items.forEach((item, index) => {
        if (index === searchSelectedIndex) {
            item.style.background = '#eff6ff';
            item.style.borderRight = '5px solid #3b82f6';
            item.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.15)';
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            item.style.background = '';
            item.style.borderRight = 'none';
            item.style.boxShadow = 'none';
        }
    });
}

function fillSalesHeaderWithUnit(product, unit) {

    currentHeaderProductId = product.id;

    currentHeaderUnit = unit;

    const resultsDiv = document.getElementById('searchResults');

    const pSearch = document.getElementById('productSearch');

    const hQty = document.getElementById('headerQty');

    const hPrice = document.getElementById('headerPrice');

    if (pSearch) pSearch.value = product.name;

    if (hPrice) {

        const priceLevelSelect = document.getElementById('salesPriceLevel');

        const priceLevel = priceLevelSelect ? priceLevelSelect.value : 'retail';

        let p = (priceLevel === 'wholesale') ? (unit.wholesale || unit.price) : unit.price;

        hPrice.value = parseFloat(p).toFixed(2);

    }

    if (hQty) {

        hQty.value = 1;

        hQty.focus();

        setTimeout(() => hQty.select(), 10);

    }

    if (resultsDiv) resultsDiv.style.display = 'none';

}

async function handleSearchEnter(query, event, forceAdd = false) {

    const cleanQuery = String(query || '').trim();

    if (!forceAdd && typeof currentHeaderProductId !== 'undefined' && currentHeaderProductId) {
        const selectedProd = productsDB.find(p => p.id === currentHeaderProductId);
        if (selectedProd && String(selectedProd.name).trim() === cleanQuery) {
            forceAdd = true;
        }
    }

    if (forceAdd && typeof currentHeaderProductId !== 'undefined' && currentHeaderProductId) {

        addToCart(currentHeaderProductId, typeof currentHeaderUnit !== 'undefined' ? currentHeaderUnit : null);

        return;

    }

    if (!query || query.trim() === "") return;

    const resultsDiv = document.getElementById('searchResults');

    // 1. بحث فوري في باركود تشكيلات المقاسات والألوان (Variant Barcode Match)
    let matchingVariant = null;
    let pInDB = productsDB.find(p => {
        if (p.variants && Array.isArray(p.variants)) {
            const vFound = p.variants.find(v => v.barcode && String(v.barcode).trim() === cleanQuery);
            if (vFound) {
                matchingVariant = vFound;
                return true;
            }
        }
        return false;
    });

    if (pInDB && matchingVariant) {
        // إذا كان مسح باركود مقاس محدد، نضيفه للسلة فوراً بتفاصيله
        addToCart(pInDB.id, null, matchingVariant);
        if (resultsDiv) resultsDiv.style.display = 'none';
        const searchInput = document.getElementById('productSearch');
        if (searchInput) searchInput.value = '';
        return;
    }

    // 2. البحث المطابق بالباركود الأساسي أو الكود
    if (!pInDB) {
        pInDB = productsDB.find(p => String(p.barcode).trim() === cleanQuery || String(p.code).trim() === cleanQuery);
    }

    // 3. بحث عميق في باركود الوحدات
    if (!pInDB) {
        pInDB = productsDB.find(p => p.units && p.units.some(u => String(u.unitBarcode).trim() === cleanQuery));
    }

    // 4. إذا لم نجد تطابقاً كاملاً، نبحث بالاسم ونأخذ أول نتيجة لملء الخانات
    if (!pInDB) {
        const queryLower = cleanQuery.toLowerCase();
        const matches = productsDB.filter(p =>
            (p.name && p.name.toLowerCase().includes(queryLower)) ||
            (p.code && String(p.code).toLowerCase().includes(queryLower))
        );
        
        if (matches.length === 1) {
            pInDB = matches[0];
        } else if (matches.length > 1) {
            // يوجد أكثر من منتج يحمل نفس الكلمة (مثلاً "جزمه")، يجب عدم اختيار أول منتج عشوائياً.
            // نترك المستخدم يختار من القائمة المنسدلة.
            return;
        }
    }

    if (pInDB) {
        // إذا كان للموديل مقاسات وألوان ونظام المقاسات مفعل، نفتح نافذة الاختيار السريع
        const isVariantsActive = document.body.classList.contains('bayan-variants-enabled');
        if (isVariantsActive && pInDB.variants && Array.isArray(pInDB.variants) && pInDB.variants.length > 0) {
            showVariantSelectionModal(pInDB, 'sales');
            if (resultsDiv) resultsDiv.style.display = 'none';
            const searchInput = document.getElementById('productSearch');
            if (searchInput) searchInput.value = '';
            return;
        }

        // دايماً نعبي الخانات أولاً ونركز على الكمية (حسب طلب المستخدم)
        selectProductToHeader(pInDB.id);
    } else {

        // الصنف غريب (غير موجود)

        showCustomAlert({

            titleText: '⚠️ صنف غير مسمى',

            msg: `الباركود أو الاسم (${query}) غير مسجل في قاعدة البيانات، هل تريد إضافته الآن؟`,

            type: 'question',

            showCancel: true,

            confirmText: 'نعم، إضافة صنف',

            cancelText: 'إلغاء',

            onConfirm: () => {

                document.getElementById('productSearch').value = '';

                quickAddProduct(query, 'sales');

            }

        });

    }

}

let pendingAddToCartProduct = null;

let unitModalSelectedIndex = 0;

let unitModalContext = 'sales';

function closeUnitSelectionModal() {

    document.getElementById('unitSelectionModal').classList.add('hidden');

    pendingAddToCartProduct = null;

    window.removeEventListener('keydown', handleUnitModalKeydown);

    // إعادة التركيز للمكان الصحيح بناءً على القسم المفتوح لضمان سرعة الإدخال

    if (unitModalContext === 'purchase') {

        const hQty = document.getElementById('purchaseHeaderQty');

        if (hQty) {

            hQty.focus();

            hQty.select();

        }

    } else {

        const searchId = (unitModalContext === 'sales') ? 'productSearch' : 'purchaseSearch';

        const searchInput = document.getElementById(searchId);

        if (searchInput) searchInput.focus();

    }

}

function handleUnitModalKeydown(e) {

    const modal = document.getElementById('unitSelectionModal');

    if (modal.classList.contains('hidden')) return;

    const cards = document.querySelectorAll('.unit-option-card');

    if (cards.length === 0) return;

    if (e.key === 'ArrowDown') {

        e.preventDefault();

        unitModalSelectedIndex = (unitModalSelectedIndex + 1) % cards.length;

        updateUnitModalSelection(cards);

    } else if (e.key === 'ArrowUp') {

        e.preventDefault();

        unitModalSelectedIndex = (unitModalSelectedIndex - 1 + cards.length) % cards.length;

        updateUnitModalSelection(cards);

    } else if (e.key === 'Enter') {

        e.preventDefault();

        // التأكد من تحديد الكارد أولاً ثم تنفيذ الضغط على زر التأكيد

        const targetCard = cards[unitModalSelectedIndex];

        if (targetCard) {

            targetCard.click();

            setTimeout(() => {

                const confirmBtn = document.getElementById('confirmUnitBtn');

                if (confirmBtn) confirmBtn.click();

            }, 10);

        }

    } else if (e.key === 'Escape') {

        e.preventDefault();

        closeUnitSelectionModal();

    }

}

function updateUnitModalSelection(cards) {

    cards.forEach((card, idx) => {

        if (idx === unitModalSelectedIndex) {

            card.classList.add('selected');

            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        } else {

            card.classList.remove('selected');

        }

    });

}

function addToCart(productId, preSelectedUnit = null, preSelectedVariant = null) {
    const product = productsDB.find(p => p.id === productId);
    if (!product) return;

    const effVariant = preSelectedVariant || window._pendingSalesVariant || null;

    const activeWH = ((typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'المخزن الرئيسي').trim();
    const prodAvail = typeof getWarehouseStock === 'function' ? getWarehouseStock(product.name, activeWH) : (parseFloat(product.stock) || 0);
    const varAvail = effVariant ? ((effVariant.warehouseStocks && effVariant.warehouseStocks[activeWH] !== undefined) ? (parseFloat(effVariant.warehouseStocks[activeWH]) || 0) : (parseFloat(effVariant.stock) || 0)) : 0;

    if (prodAvail <= 0 && (!effVariant || varAvail <= 0)) {
        showToast("⚠️ تنبيه: المنتج (" + product.name + ") غير متوفر في المخزن الحالي (" + activeWH + ")!", "warning");
    }

    // إذا لم يكن هناك مقاس محدد مسبقاً وكان للمنتج مقاسات وألوان، نفتح نافذة الاختيار السريع
    const isVariantsActive = document.body.classList.contains('bayan-variants-enabled');
    if (isVariantsActive && !effVariant && product.variants && Array.isArray(product.variants) && product.variants.length > 0) {
        showVariantSelectionModal(product, 'sales');
        return;
    }

    if (preSelectedUnit) {
        completeAddToCart(product, preSelectedUnit, effVariant);
        return;
    }

    if (product.units && product.units.length > 1) {
        showUnitSelectionModal(product, 'sales');
        return;
    }

    const defUnit = (product.units && product.units.length > 0) ? product.units[0] : null;
    completeAddToCart(product, defUnit, effVariant);
}

function completeAddToCart(product, selectedUnit, selectedVariant = null, customQty = null, customPrice = null) {
    const productId = product.id;

    // ميزة إدخال الكمية والسعر من الهيدر أو من باركود الميزان مباشرة
    const hQtyInput = document.getElementById('headerQty');
    const hPriceInput = document.getElementById('headerPrice');
    const hQty = (customQty !== null && customQty !== undefined && customQty > 0) 
        ? customQty 
        : (hQtyInput ? (parseFloat(hQtyInput.value) || 1) : 1);
    const hPrice = (customPrice !== null && customPrice !== undefined)
        ? customPrice
        : ((hPriceInput && hPriceInput.value) ? parseFloat(hPriceInput.value) : null);

    if (hQty <= 0) {
        showToast("⚠️ يرجى إدخال كمية صحيحة أكبر من الصفر!", "warning");
        return false;
    }

    const effVariant = selectedVariant || window._pendingSalesVariant || null;
    const vSize = effVariant ? (effVariant.size || '') : '';
    const vColor = effVariant ? (effVariant.color || '') : '';

    const activeWH = ((typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'المخزن الرئيسي').trim();

    const factor = selectedUnit ? (parseFloat(selectedUnit.factor) || 1) : 1;
    let availBaseStock = 0;
    if (effVariant) {
        if (effVariant.warehouseStocks && typeof effVariant.warehouseStocks === 'object' && effVariant.warehouseStocks[activeWH] !== undefined) {
            availBaseStock = parseFloat(effVariant.warehouseStocks[activeWH]) || 0;
        } else if (activeWH === 'المخزن الرئيسي') {
            availBaseStock = parseFloat(effVariant.stock) || 0;
        } else {
            availBaseStock = 0;
        }
    } else {
        if (typeof getWarehouseStock === 'function') {
            availBaseStock = getWarehouseStock(product.name, activeWH);
        } else if (product.warehouseStocks && product.warehouseStocks[activeWH] !== undefined) {
            availBaseStock = parseFloat(product.warehouseStocks[activeWH]) || 0;
        } else if (activeWH === 'المخزن الرئيسي') {
            availBaseStock = parseFloat(product.stock) || 0;
        } else {
            availBaseStock = 0;
        }
    }

    const maxAvailInUnit = availBaseStock / factor;

    const existingItem = cart.find(item =>
        item.id === productId &&
        ((!item.selectedUnit && !selectedUnit) || (item.selectedUnit && selectedUnit && item.selectedUnit.unitName === selectedUnit.unitName)) &&
        ((item.selectedSize || '') === vSize) &&
        ((item.selectedColor || '') === vColor)
    );

    const newTotalQtyInUnit = (existingItem ? existingItem.qty : 0) + hQty;
    const requestedBaseQty = newTotalQtyInUnit * factor;

    // 🛑 منع صارم: رفض الإضافة إذا كانت الكمية الإجمالية تتجاوز رصيد المخزن المتاح
    if (requestedBaseQty > availBaseStock) {
        const varInfo = effVariant ? ` [${effVariant.size || ''} ${effVariant.color || ''}]` : '';
        const maxAvailStr = maxAvailInUnit <= 0 ? '0' : maxAvailInUnit.toFixed(3).replace(/\.?0+$/, '');
        showToast(`🚫 عذراً، الكمية المطلوبة (${newTotalQtyInUnit}) غير متوفرة! المتاح بمخزن (${activeWH}) للصنف (${product.name}${varInfo}) هو (${maxAvailStr}) فقط`, "error");
        if (typeof BayanBarcode !== 'undefined' && typeof BayanBarcode.playBeep === 'function') {
            BayanBarcode.playBeep(false);
        }
        return false;
    }

    if (existingItem) {
        existingItem.qty = parseFloat((existingItem.qty + hQty).toFixed(3));
        if (hPrice !== null) existingItem.price = hPrice;
    } else {
        const priceLevelSelect = document.getElementById('salesPriceLevel');
        const priceLevel = priceLevelSelect ? priceLevelSelect.value : 'retail';
        let factor = 1;
        let price = 0;
        let itemCost = (effVariant && effVariant.cost) ? parseFloat(effVariant.cost) : (parseFloat(product.cost) || 0);

        if (effVariant) {
            if (priceLevel === 'wholesale') {
                price = parseFloat(effVariant.wholesale) || parseFloat(effVariant.price) || parseFloat(product.wholesale) || parseFloat(product.price) || 0;
            } else {
                price = parseFloat(effVariant.price) || parseFloat(product.price) || 0;
            }
        } else if (selectedUnit) {
            factor = parseFloat(selectedUnit.factor) || 1;
            if (priceLevel === 'wholesale') {
                price = parseFloat(selectedUnit.wholesale) || parseFloat(selectedUnit.price) || 0;
            } else {
                price = parseFloat(selectedUnit.price) || 0;
            }
        } else {
            if (priceLevel === 'wholesale') {
                price = parseFloat(product.wholesale) || parseFloat(product.price) || 0;
            } else {
                price = parseFloat(product.price) || 0;
            }
        }

        const baseOriginalPrice = price;
        const itemDiscount = parseFloat(product.discount) || 0;

        // تحديد ما إذا كان السعر في الهيدر هو مجرد تعبئة تلقائية أم تعديل يدوي
        if (hPrice !== null) {
            price = hPrice;
        }

        // تطبيق الخصم التلقائي إذا لم يقم المستخدم بتعديل السعر يدوياً
        if (hPrice === null || Math.abs(hPrice - baseOriginalPrice) < 0.01) {
            if (itemDiscount > 0) {
                price = Number(Math.max(0, baseOriginalPrice - (baseOriginalPrice * itemDiscount / 100)).toFixed(2));
            }
        }

        cart.push({
            id: product.id,
            code: (effVariant && effVariant.barcode) ? effVariant.barcode : product.code,
            name: product.name,
            originalPrice: baseOriginalPrice,
            discount: itemDiscount,
            price: price,
            cost: itemCost,
            qty: hQty,
            selectedSize: vSize,
            selectedColor: vColor,
            selectedVariant: effVariant,
            units: product.units || [],
            selectedUnit: selectedUnit,
            unitFactor: factor,
            taxType: product.taxType || 'none',
            taxRate: product.taxRate || 0
        });
    }

    renderCart();
    if (typeof calculateCartTotals === 'function') calculateCartTotals();
    if (typeof calculateTotals === 'function') calculateTotals();

    // 📸 عرض صورة الموديل فوراً في اللوحة الجانبية بمجرد نزوله للسلة
    if (typeof updatePOSProductImagePreview === 'function') {
        updatePOSProductImagePreview(product, effVariant);
    }

    // تصفير البحث والمدخلات والتركيز
    if (hQtyInput) hQtyInput.value = 1;
    if (hPriceInput) hPriceInput.value = '';
    currentHeaderProductId = null;
    currentHeaderUnit = null;
    window._pendingSalesVariant = null;

    const searchInput = document.getElementById('productSearch');
    if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
    }
}

// =========================================================================
// 👗 نافذة الاختيار السريع للمقاسات والألوان (Fast Variant Picker Modal with Keyboard Control)
// =========================================================================

let variantModalSelectedIndex = 0;
let variantModalProduct = null;
let variantModalContext = 'sales';

function showUnitSelectionModal(product, context = 'sales') {
    pendingAddToCartProduct = product;

    unitModalContext = context;

    unitModalSelectedIndex = 0;

    const list = document.getElementById('unitSelectionList');

    list.innerHTML = '';

    let priceLevel = 'retail';

    if (context === 'sales' || context === 'sales-header') {

        const priceLevelSelect = document.getElementById('salesPriceLevel');

        priceLevel = priceLevelSelect ? priceLevelSelect.value : 'retail';

    }

    product.units.forEach((unit, idx) => {

        let displayPrice = 0;

        if (context === 'sales' || context === 'sales-header' || context === 'sales-return') {

            if (priceLevel === 'wholesale') {

                displayPrice = parseFloat(unit.wholesale) || parseFloat(unit.price) || 0;

            } else {

                displayPrice = parseFloat(unit.price) || 0;

            }

        } else {

            displayPrice = parseFloat(unit.cost) || 0;

        }

        const card = document.createElement('div');

        card.className = 'unit-option-card' + (idx === 0 ? ' selected' : '');

        card.onclick = () => {

            document.querySelectorAll('.unit-option-card').forEach(c => c.classList.remove('selected'));

            card.classList.add('selected');

        };

        card.ondblclick = () => {

            if (context === 'sales') {

                completeAddToCart(product, unit);

                closeUnitSelectionModal();

            } else if (context === 'sales-header') {

                fillSalesHeaderWithUnit(product, unit);

                closeUnitSelectionModal();

            } else if (context === 'purchase') {

                // بدلاً من الإضافة الفورية، نملأ الهيدر ونركز على الكمية

                fillPurchaseHeaderWithUnit(product, unit);

                closeUnitSelectionModal();

            } else if (context === 'sales-return') {

                completeAddToReturnCart(product, unit);

                closeUnitSelectionModal();

            } else if (context === 'purchase-return') {

                completeAddToPurReturnCart(product, unit);

                closeUnitSelectionModal();

            } else if (context === 'adjustment') {

                // في التسوية، نملأ الهيدر ونركز على الكمية

                if (typeof fillAdjustmentHeaderWithUnit === 'function') {

                    fillAdjustmentHeaderWithUnit(product, unit);

                }

                closeUnitSelectionModal();

            } else if (context === 'transfer') {

                // في التحويل، نملأ الهيدر ونركز على الكمية

                if (typeof fillTransferHeaderWithUnit === 'function') {

                    fillTransferHeaderWithUnit(product, unit);

                }

                closeUnitSelectionModal();

            } else if (context === 'sales-return-header') {

                fillReturnHeaderWithUnit(product, unit, 'sales');

                closeUnitSelectionModal();

            } else if (context === 'purchase-return-header') {

                fillReturnHeaderWithUnit(product, unit, 'purchase');

                closeUnitSelectionModal();

            }

        };

        const formattedFactor = (unit.factor % 1 === 0) ? unit.factor : parseFloat(unit.factor).toFixed(2);

        card.innerHTML = `

                    <div style="display:flex; flex-direction:column;">

                        <span class="unit-name">${unit.unitName}</span>

                        <span style="font-size:0.75rem; color:#64748b;">معامل التحويل: ${formattedFactor}</span>

                    </div>

                    <span class="unit-price">${displayPrice.toFixed(2)} ج.م</span>

                `;

        card.dataset.unitIdx = idx;

        list.appendChild(card);

    });

    document.getElementById('confirmUnitBtn').onclick = () => {

        const selected = document.querySelector('.unit-option-card.selected');

        if (selected) {

            const unitIdx = selected.dataset.unitIdx;

            const unit = product.units[unitIdx];

            if (context === 'sales') {

                completeAddToCart(product, unit);

                closeUnitSelectionModal();

            } else if (context === 'sales-header') {

                fillSalesHeaderWithUnit(product, unit);

                closeUnitSelectionModal();

            } else if (context === 'purchase') {

                fillPurchaseHeaderWithUnit(product, unit);

                closeUnitSelectionModal();

            } else if (context === 'sales-return') {

                completeAddToReturnCart(product, unit);

                closeUnitSelectionModal();

            } else if (context === 'purchase-return') {

                completeAddToPurReturnCart(product, unit);

                closeUnitSelectionModal();

            } else if (context === 'adjustment') {

                if (typeof fillAdjustmentHeaderWithUnit === 'function') {

                    fillAdjustmentHeaderWithUnit(product, unit);

                }

                closeUnitSelectionModal();

            } else if (context === 'transfer') {

                if (typeof fillTransferHeaderWithUnit === 'function') {

                    fillTransferHeaderWithUnit(product, unit);

                }

                closeUnitSelectionModal();

            } else if (context === 'sales-return-header') {

                fillReturnHeaderWithUnit(product, unit, 'sales');

                closeUnitSelectionModal();

            } else if (context === 'purchase-return-header') {

                fillReturnHeaderWithUnit(product, unit, 'purchase');

                closeUnitSelectionModal();

            }

        }

    };

    document.getElementById('unitSelectionModal').classList.remove('hidden');

    if (document.activeElement) document.activeElement.blur();

    window.addEventListener('keydown', handleUnitModalKeydown);
}

function updateItemUnit(index, unitName, cartType = 'sales') {

    const currentCart = (cartType === 'sales') ? cart : purchaseCart;

    const item = currentCart[index];

    if (!item || !item.units) return;

    const unit = item.units.find(u => u.unitName === unitName);

    if (unit) {

        const priceLevel = document.getElementById('salesPriceLevel')?.value || 'retail';

        item.selectedUnit = unit;

        if (cartType === 'sales') {
            const basePrice = (priceLevel === 'wholesale') ? (parseFloat(unit.wholesale) || parseFloat(unit.price) || 0) : (parseFloat(unit.price) || 0);
            item.originalPrice = basePrice;
            const itemDisc = parseFloat(item.discount) || 0;
            if (itemDisc > 0) {
                item.price = Number(Math.max(0, basePrice - (basePrice * itemDisc / 100)).toFixed(2));
            } else {
                item.price = basePrice;
            }
        } else {
            item.price = parseFloat(unit.cost) || 0;
        }

        item.unitFactor = parseFloat(unit.factor) || 1;

        if (cartType === 'sales') renderCart();

        else renderPurchaseCart_Finalized_V3();

    }

}

function removeFromCart(index) {
    if (isEditMode && !checkPermission('docs_edit')) return;
    const item = cart[index];
    if (item) addToTrash('draft_item', item, `حذف من فاتورة بيع(مسودة): ${item.name} - الكمية: ${item.qty}`);
    cart.splice(index, 1);

    // إزالة صورة الموديل أو التحديث لآخر صنف باقي فور الحذف
    if (cart.length === 0) {
        resetPOSProductImagePreview();
    } else {
        const remainingItem = cart[index] || cart[cart.length - 1];
        if (remainingItem) {
            updatePOSProductImagePreview(remainingItem.id, remainingItem.selectedVariant || remainingItem);
        }
    }

    renderCart();
}

function updateQty(index, newQty) {
    if (isEditMode && !checkPermission('docs_edit')) return renderCart();
    const item = cart[index];
    if (!item) return;

    const parsedQty = parseFloat(newQty);
    if (isNaN(parsedQty) || parsedQty <= 0) {
        showToast("⚠️ يرجى إدخال كمية صحيحة أكبر من الصفر!", "warning");
        return renderCart();
    }

    const product = productsDB.find(p => p.id === item.id || p.name === item.name);
    if (product) {
        const factor = parseFloat(item.unitFactor) || 1;
        let effVariant = null;
        if (product.variants && Array.isArray(product.variants)) {
            const sSize = item.selectedSize || item.size || '';
            const sColor = item.selectedColor || item.color || '';
            if (sSize || sColor) {
                effVariant = product.variants.find(v => 
                    (!sSize || v.size === sSize) && 
                    (!sColor || v.color === sColor)
                );
            }
        }

        // في وضع تعديل فاتورة قديمة: إضافة الكمية الأصلية المحجوزة بالفاتورة إلى الرصيد المتاح
        let originalQtyInInvoice = 0;
        if (typeof isEditMode !== 'undefined' && isEditMode && typeof editingOriginalItems !== 'undefined' && Array.isArray(editingOriginalItems)) {
            const sSize = item.selectedSize || item.size || '';
            const sColor = item.selectedColor || item.color || '';
            const matchedOriginal = editingOriginalItems.find(orig => 
                (orig.product === item.name || orig.productId === item.id || (product && (orig.product === product.name || orig.productId === product.id))) &&
                (!sSize || orig.selectedSize === sSize || orig.size === sSize) &&
                (!sColor || orig.selectedColor === sColor || orig.color === sColor)
            );
            if (matchedOriginal) {
                const origFactor = parseFloat(matchedOriginal.unitFactor) || 1;
                originalQtyInInvoice = (parseFloat(matchedOriginal.qty) || 0) * origFactor;
            }
        }

        const activeWH = ((typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'المخزن الرئيسي').trim();

        let currentBaseStock = 0;
        if (effVariant) {
            if (effVariant.warehouseStocks && typeof effVariant.warehouseStocks === 'object' && effVariant.warehouseStocks[activeWH] !== undefined) {
                currentBaseStock = parseFloat(effVariant.warehouseStocks[activeWH]) || 0;
            } else if (activeWH === 'المخزن الرئيسي') {
                currentBaseStock = parseFloat(effVariant.stock) || 0;
            } else {
                currentBaseStock = 0;
            }
        } else {
            if (typeof getWarehouseStock === 'function') {
                currentBaseStock = getWarehouseStock(product.name, activeWH);
            } else if (product.warehouseStocks && product.warehouseStocks[activeWH] !== undefined) {
                currentBaseStock = parseFloat(product.warehouseStocks[activeWH]) || 0;
            } else if (activeWH === 'المخزن الرئيسي') {
                currentBaseStock = parseFloat(product.stock) || 0;
            } else {
                currentBaseStock = 0;
            }
        }

        const availBaseStock = currentBaseStock + originalQtyInInvoice;
        const maxAvailInUnit = availBaseStock / factor;

        if ((parsedQty * factor) > availBaseStock) {
            const varInfo = effVariant ? ` [${effVariant.size || ''} ${effVariant.color || ''}]` : '';
            const maxAvailStr = maxAvailInUnit <= 0 ? '0' : maxAvailInUnit.toFixed(2).replace(/\.00$/, '');
            showToast(`🚫 عذراً، لا يمكن تجاوز الرصيد المتاح! المتاح بمخزن (${activeWH}) للصنف (${product.name}${varInfo}) هو (${maxAvailStr}) فقط`, "error");
            if (typeof BayanBarcode !== 'undefined' && typeof BayanBarcode.playBeep === 'function') {
                BayanBarcode.playBeep(false);
            }
            item.qty = maxAvailInUnit > 0 ? maxAvailInUnit : (item.qty || 1);
            renderCart();
            return;
        }
    }

    item.qty = parsedQty;
    renderCart();
}

function updateCartPrice(index, newPrice) {
    if (isEditMode && !checkPermission('docs_edit')) return renderCart();
    if (newPrice < 0) return;
    cart[index].price = parseFloat(newPrice);
    renderCart();
}

function resetBill() {
    cart = [];
    isEditMode = false;
    editingInvoiceId = null;
    editingOriginalDate = null;
    editingInvoiceType = null;
    editingOriginalItems = [];

    const mainSaveBtn = document.querySelector('#sales-section .btn-save');

    if (mainSaveBtn) {

        mainSaveBtn.style.background = '';

        mainSaveBtn.innerText = '💾 حفظ الفاتورة (F9)';

    }

    currentTotal = 0;

    document.getElementById('discountInput').value = 0;

    document.getElementById('discountType').value = 'val';

    document.getElementById('taxInput').value = 0;

    document.getElementById('taxType').value = 'val';

    document.getElementById('tenderedAmount').value = '';

    document.getElementById('customerName').value = '';

    if (document.getElementById('salesNotes')) document.getElementById('salesNotes').value = '';

    document.getElementById('changeAmount').innerText = '0.00';

    if (document.getElementById('cartFilterInput')) document.getElementById('cartFilterInput').value = '';

    if (document.getElementById('customerCodeDisplay')) document.getElementById('customerCodeDisplay').innerText = '---';

    if (document.getElementById('customerBalanceDisplay')) document.getElementById('customerBalanceDisplay').innerText = '0.00';

    if (document.getElementById('salesItemsCount')) document.getElementById('salesItemsCount').innerText = '0';

    if (document.getElementById('salesTotalQty')) document.getElementById('salesTotalQty').innerText = '0';

    const now = new Date();

    if (document.getElementById('salesDate')) document.getElementById('salesDate').value = now.toLocaleDateString('en-CA');

    if (document.getElementById('salesTime')) document.getElementById('salesTime').value = now.toTimeString().slice(0, 5);

    renderCart();

    // تحديث رقم الفاتورة في المربع الأخضر

    if (document.getElementById('salesBadgeID')) {
        document.getElementById('salesBadgeID').innerText = typeof getNextSequence === 'function' ? getNextSequence('بيع') : 1;
    }

    // 💡 استعادة طريقة السداد الافتراضية للفاتورة القادمة (إما الخيار المثبت بالدبوس 📌 أو كاش تلقائياً)
    const pinnedMethod = getStore('pinned_payment_method');
    const methodSelect = document.getElementById('sales-sectionPaymentMethodSelect') || document.getElementById('salesPaymentMethodSelect');
    if (methodSelect) {
        if (pinnedMethod) {
            methodSelect.value = pinnedMethod;
        } else {
            methodSelect.value = 'نقدي'; // إرجاعها كاش تلقائياً بعد حفظ الفاتورة
        }
        if (typeof selectMethod === 'function') selectMethod(methodSelect);
        selectedMethod = methodSelect.value;
    }
    if (typeof checkPaymentPinState === 'function') checkPaymentPinState();

    // 💡 استعادة مستوى السعر الافتراضي للفاتورة القادمة (إما المثبت بالدبوس 📌 أو الافتراضي)
    if (typeof loadPinnedPriceLevel === 'function') loadPinnedPriceLevel();

    // تصفير لوحة صورة الموديل
    if (typeof resetPOSProductImagePreview === 'function') resetPOSProductImagePreview();

    if (typeof saveCurrentTabState === 'function') saveCurrentTabState();
    if (typeof updateActiveTabTitle === 'function') updateActiveTabTitle('', 'بيع');

    document.getElementById('productSearch').focus();
}

// 📌 إدارة وتثبيت طريقة الدفع المفضلة للفواتير القادمة
window.togglePinPaymentMethod = function(e) {
    if (e) e.stopPropagation();
    const methodSelect = document.getElementById('sales-sectionPaymentMethodSelect') || document.getElementById('salesPaymentMethodSelect');
    if (!methodSelect) return;

    const currentVal = methodSelect.value;
    const existingPinned = getStore('pinned_payment_method');

    if (existingPinned === currentVal) {
        // إلغاء التثبيت
        setStore('pinned_payment_method', '');
        if (typeof showToast === 'function') showToast("🔓 تم إلغاء تثبيت طريقة الدفع المفضلة", "info");
    } else {
        // تثبيت الخيار الحالي
        setStore('pinned_payment_method', currentVal);
        const nameMap = { 'نقدي': 'كاش 💵', 'آجل': 'آجل ⏳', 'تحويل': 'بنك 🏦' };
        if (typeof showToast === 'function') showToast(`📌 تم تثبيت (${nameMap[currentVal] || currentVal}) كطريقة دفع افتراضية للفواتير القادمة`, "success");
    }

    window.checkPaymentPinState();
};

window.checkPaymentPinState = function() {
    const pinBtn = document.getElementById('pinPaymentMethodBtn');
    const methodSelect = document.getElementById('sales-sectionPaymentMethodSelect') || document.getElementById('salesPaymentMethodSelect');
    if (!pinBtn || !methodSelect) return;

    const pinnedVal = getStore('pinned_payment_method');
    const currentVal = methodSelect.value;

    if (pinnedVal && pinnedVal === currentVal) {
        pinBtn.style.opacity = '1';
        pinBtn.style.color = '#f59e0b';
        pinBtn.style.transform = 'scale(1.25)';
        pinBtn.title = `طريقة الدفع (${pinnedVal}) مثبتة كافتراضي. انقر لإلغاء التثبيت`;
    } else {
        pinBtn.style.opacity = '0.5';
        pinBtn.style.color = 'inherit';
        pinBtn.style.transform = 'none';
        pinBtn.title = 'تثبيت طريقة الدفع الحالية كافتراضي للفواتير القادمة';
    }
};

// ================= 📌 إدارة وتثبيت مستوى سعر البيع الدائم (Pinned Price Level) =================
window.isPriceLevelPinned = function() {
    const pinned = getStore('pos_price_level_pinned');
    return pinned === 'true' || pinned === true;
};

window.getPinnedPriceLevel = function() {
    return getStore('pos_pinned_price_level') || 'retail';
};

window.loadPinnedPriceLevel = function() {
    const priceLevelSelect = document.getElementById('salesPriceLevel');
    const pinBtn = document.getElementById('pinPriceLevelBtn');
    const pinIcon = document.getElementById('pinPriceLevelIcon');
    if (!priceLevelSelect) return;

    const isPinned = window.isPriceLevelPinned();
    const pinnedLevel = window.getPinnedPriceLevel();

    if (isPinned) {
        priceLevelSelect.value = pinnedLevel;
        if (pinBtn) {
            pinBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            pinBtn.style.borderColor = '#34d399';
            pinBtn.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.4)';
            pinBtn.title = `مستوى السعر (${pinnedLevel === 'wholesale' ? 'جملة تجار' : 'قطاعي'}) مُثبّت دائماً كافتراضي (انقر لإلغاء التثبيت)`;
        }
        if (pinIcon) pinIcon.innerText = '📌';
    } else {
        if (pinBtn) {
            pinBtn.style.background = 'rgba(255, 255, 255, 0.08)';
            pinBtn.style.borderColor = 'rgba(255, 255, 255, 0.15)';
            pinBtn.style.boxShadow = 'none';
            pinBtn.title = 'انقر لتثبيت مستوى السعر الحالي كافتراضي دائم';
        }
        if (pinIcon) pinIcon.innerText = '📍';
    }
};

window.togglePinPriceLevel = async function(e) {
    if (e) e.stopPropagation();
    const priceLevelSelect = document.getElementById('salesPriceLevel');
    if (!priceLevelSelect) return;

    const currentLevel = priceLevelSelect.value;
    const isCurrentlyPinned = window.isPriceLevelPinned();

    if (!isCurrentlyPinned) {
        // تثبيت دائم
        setStore('pos_price_level_pinned', 'true');
        setStore('pos_pinned_price_level', currentLevel);
        try {
            if (typeof db !== 'undefined' && db.settings) {
                await db.settings.put({ id: 'pinned_price_level', value: currentLevel, isPinned: true });
            }
        } catch(err) {}
        window.loadPinnedPriceLevel();
        if (typeof showToast === 'function') {
            showToast(`📌 تم تثبيت وضع (${currentLevel === 'wholesale' ? 'جملة تجار 📦' : 'القطاعي 🛒'}) كافتراضي دائم للبرنامج!`, 'success');
        }
    } else {
        // إلغاء التثبيت
        setStore('pos_price_level_pinned', 'false');
        try {
            if (typeof db !== 'undefined' && db.settings) {
                await db.settings.put({ id: 'pinned_price_level', value: currentLevel, isPinned: false });
            }
        } catch(err) {}
        window.loadPinnedPriceLevel();
        if (typeof showToast === 'function') {
            showToast('📍 تم إلغاء تثبيت مستوى السعر', 'info');
        }
    }
};

window.onSalesPriceLevelChange = function() {
    const priceLevelSelect = document.getElementById('salesPriceLevel');
    if (!priceLevelSelect) return;

    const newLevel = priceLevelSelect.value;
    if (window.isPriceLevelPinned()) {
        setStore('pos_pinned_price_level', newLevel);
        try {
            if (typeof db !== 'undefined' && db.settings) {
                db.settings.put({ id: 'pinned_price_level', value: newLevel, isPinned: true });
            }
        } catch(err) {}
        window.loadPinnedPriceLevel();
    }
    updateCartPriceLevel();
};

// --- 2. رسم الجدول والحسابات ---

function renderCart() {

    const tbody = document.getElementById('cartTableBody');

    tbody.innerHTML = '';

    let subTotal = 0;

    cart.forEach((item, index) => {

        const itemTotal = item.price * item.qty;

        subTotal += itemTotal;

        let unitOptions = `<option value="قطعة">قطعة</option>`;

        if (item.units && item.units.length > 0) {

            // selectedUnit قد يكون object أو string

            const selectedUnitName = item.selectedUnit

                ? (typeof item.selectedUnit === 'object' ? item.selectedUnit.unitName : item.selectedUnit)

                : null;

            unitOptions = item.units.map(u =>

                `<option value="${u.unitName}" ${u.unitName === selectedUnitName ? 'selected' : ''}>${u.unitName}</option>`

            ).join('');

        }

        const tr = document.createElement('tr');

        // تمييز الأصناف التي نفد رصيدها (خلصانة) بصرياً

        const pInfo = productsDB.find(p => p.id === item.id || p.name === item.name);

        if (pInfo && pInfo.stock <= 0) {
            tr.classList.add('out-of-stock-row');
        }

        const { sizeElement, colorElement } = renderVariantSelectElements(item, index, 'sales');

        const discountTag = (parseFloat(item.discount) > 0) 
            ? `<div style="font-size:0.72rem; color:#dc2626; font-weight:800; display:flex; align-items:center; justify-content:center; gap:3px; margin-top:2px;" title="خصم ${item.discount}%">
                 <span style="text-decoration:line-through; opacity:0.65;">${(parseFloat(item.originalPrice) || (item.price / (1 - (parseFloat(item.discount) || 0) / 100))).toFixed(2)}</span>
                 <span style="background:#fee2e2; color:#b91c1c; padding:1px 4px; border-radius:4px;">-${item.discount}%</span>
               </div>` 
            : '';

        tr.innerHTML = `
                    <td style="font-weight: 800; color: #64748b;">${index + 1}</td>
                    <td style="font-size: 0.82rem; color: #475569; font-weight: bold;">${item.code || '---'}</td>
                    <td style="font-weight: 900; color: #1e293b; text-align: right;">${item.name}</td>
                    <td class="col-variant-size" style="text-align: center;">${sizeElement}</td>
                    <td class="col-variant-color" style="text-align: center;">${colorElement}</td>
                    <td style="text-align: center;">
                        <select onchange="updateItemUnit(${index}, this.value, 'sales')" 
                            style="width: 80px; max-width: 100%; border: 1.5px solid #cbd5e1; background: #fff; color: #1e293b; border-radius: 6px; padding: 4px; font-weight: 800; font-size: 0.85rem; outline: none; cursor: pointer; text-align: center;">
                            ${unitOptions}
                        </select>
                    </td>
                    <td style="text-align: center;">
                        <input type="number" class="qty-input" value="${item.qty}" min="1" step="any"
                               onchange="updateQty(${index}, this.value)" onclick="this.select()" title="تعديل الكمية"
                               style="width: 72px; height: 34px; font-size: 1.1rem; font-weight: 900; text-align: center; border-radius: 8px; border: 2px solid #10b981; background: #ecfdf5; color: #065f46; box-sizing: border-box; padding: 2px 4px;">
                    </td>
                    <td style="text-align: center;">
                        <input type="number" class="price-input" value="${(parseFloat(item.price) || 0).toFixed(2)}" min="0" step="0.01"
                               onchange="updateCartPrice(${index}, this.value)" onclick="this.select()" title="تعديل السعر"
                               style="width: 88px; height: 34px; font-size: 1.05rem; font-weight: 900; text-align: center; border-radius: 8px; border: 2px solid #3b82f6; background: #eff6ff; color: #1e40af; box-sizing: border-box; padding: 2px 4px;">
                        ${discountTag}
                    </td>
                    <td class="cart-item-total" style="font-weight: 900; color: #047857; font-size: 1.1rem; text-align: center;">${itemTotal.toFixed(2)}</td>
                    <td style="text-align: center;">
                        <button class="btn-delete-row" onclick="removeFromCart(${index})" title="حذف هذا الصنف"
                            style="background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; border-radius: 6px; padding: 5px 8px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: 0.2s;">
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                        </button>
                    </td>
        `;
        tr.onclick = (e) => {
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT' && e.target.tagName !== 'BUTTON' && !e.target.closest('button')) {
                document.querySelectorAll('#cartTableBody tr').forEach(r => {
                    r.style.backgroundColor = '';
                    r.style.boxShadow = '';
                });
                tr.style.backgroundColor = '#eff6ff';
                tr.style.boxShadow = 'inset 4px 0 0 #2563eb';
                updatePOSProductImagePreview(item.id, item.selectedVariant || item);
            }
        };
        // عند مرور مؤشر الماوس على أي صنف في الفاتورة، تظهر صورته مع إطار محدد فوراً
        tr.onmouseenter = () => {
            document.querySelectorAll('#cartTableBody tr').forEach(r => {
                r.style.backgroundColor = '';
                r.style.boxShadow = '';
            });
            tr.style.backgroundColor = '#eff6ff';
            tr.style.boxShadow = 'inset 4px 0 0 #2563eb';
            updatePOSProductImagePreview(item.id, item.selectedVariant || item);
        };
        tr.onmouseleave = () => {
            tr.style.backgroundColor = '';
            tr.style.boxShadow = '';
        };
        tr.style.cursor = 'pointer';
        tbody.appendChild(tr);

    });

    document.getElementById('subTotalDisplay').innerText = subTotal.toFixed(2);

    calculateTotals(subTotal);

    updateHeaderPartnerInfo();

}

function updateCartPriceLevel() {

    const priceLevelSelect = document.getElementById('salesPriceLevel');

    const priceLevel = priceLevelSelect ? priceLevelSelect.value : 'retail';

    cart.forEach(item => {
        // البحث عن المنتج الأصلي في قاعدة البيانات لجلب أحدث أسعار الجملة والقطاعي
        const product = productsDB.find(p => p.id === item.id || p.name === item.name);
        if (!product) return;

        let basePrice = 0;

        const sSize = String(item.selectedSize || item.size || '').trim();
        const sColor = String(item.selectedColor || item.color || '').trim();

        // 1. البحث عن التشكيلة المطابقة (المقاس واللون) أولاً
        let matchedVariant = item.selectedVariant || null;
        if (!matchedVariant && product.variants && Array.isArray(product.variants)) {
            matchedVariant = product.variants.find(v => 
                (String(v.size || '').trim() === sSize) && 
                (String(v.color || '').trim() === sColor)
            ) || product.variants.find(v => 
                (!sSize || String(v.size || '').trim() === sSize) && 
                (!sColor || String(v.color || '').trim() === sColor)
            );
        }

        if (matchedVariant) {
            const vPrice = parseFloat(matchedVariant.price) || parseFloat(product.price) || 0;
            const vWholesale = parseFloat(matchedVariant.wholesale) || parseFloat(matchedVariant.price) || parseFloat(product.wholesale) || parseFloat(product.price) || 0;
            if (priceLevel === 'wholesale') {
                basePrice = vWholesale > 0 ? vWholesale : (parseFloat(product.wholesale) || vPrice);
            } else {
                basePrice = vPrice;
            }
        } else if (item.selectedUnit && typeof item.selectedUnit === 'object') {
            // إذا كان هناك وحدة مختارة، نبحث عن نفس الوحدة في المنتج الأصلي
            const unitInDb = product.units ? product.units.find(u => u.unitName === item.selectedUnit.unitName) : null;
            if (unitInDb) {
                if (priceLevel === 'wholesale') {
                    basePrice = parseFloat(unitInDb.wholesale) || parseFloat(unitInDb.price) || 0;
                } else {
                    basePrice = parseFloat(unitInDb.price) || 0;
                }
            } else {
                basePrice = (priceLevel === 'wholesale') ? (parseFloat(product.wholesale) || parseFloat(product.price) || 0) : (parseFloat(product.price) || 0);
            }
        } else {
            // السعر الأساسي للمنتج
            if (priceLevel === 'wholesale') {
                basePrice = parseFloat(product.wholesale) || parseFloat(product.price) || 0;
            } else {
                basePrice = parseFloat(product.price) || 0;
            }
        }

        item.originalPrice = basePrice;
        const itemDisc = parseFloat(item.discount !== undefined ? item.discount : product.discount) || 0;
        item.discount = itemDisc;
        if (itemDisc > 0) {
            item.price = Number(Math.max(0, basePrice - (basePrice * itemDisc / 100)).toFixed(2));
        } else {
            item.price = basePrice;
        }
    });

    if (typeof showToast === 'function') {

        showToast(`تم تحويل الأسعار إلى وضع: ${priceLevel === 'wholesale' ? 'الجملة 📦' : 'القطاعي 🛒'}`, 'info');

    }

    renderCart();

}

function calculateTotals(subTotalParam) {

    // إذا لم يتم تمرير المجموع الفرعي، نحسبه من الجدول الحالي

    let subTotal = subTotalParam;

    if (subTotal === undefined) {

        subTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

    }

    // تحديث إجمالي الأصناف والكمية

    const itemsCount = cart.length;

    const totalQty = cart.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0);

    if (document.getElementById('salesItemsCount')) document.getElementById('salesItemsCount').innerText = itemsCount;

    if (document.getElementById('salesTotalQty')) document.getElementById('salesTotalQty').innerText = totalQty;

    if (document.getElementById('subTotalDisplay')) document.getElementById('subTotalDisplay').innerText = subTotal.toFixed(2);

    // حساب الخصم والتحقق من صحته وقواعد الأمان المنطقية
    let discountVal = parseFloat(document.getElementById('discountInput').value) || 0;
    if (discountVal < 0) {
        document.getElementById('discountInput').value = 0;
        discountVal = 0;
        if (typeof showToast === 'function') showToast("⚠️ لا يمكن إدخال قيمة خصم بالسالب!", "warning");
    }

    const discountType = document.getElementById('discountType').value;
    let discountAmount = (discountType === 'perc') ? (subTotal * discountVal / 100) : discountVal;
    
    if (discountAmount > subTotal && subTotal > 0) {
        if (typeof showToast === 'function') showToast("⚠️ قيمة الخصم أكبر من إجمالي الفاتورة! تم ضبط الخصم بحد أقصى مساوٍ للفاتورة", "warning");
        discountAmount = subTotal;
    }

    if (document.getElementById('salesDiscountAmountDisplay')) document.getElementById('salesDiscountAmountDisplay').innerText = discountAmount.toFixed(2);

    // حساب الإضافة/الضريبة والتحقق من قيم الأمان
    let taxVal = parseFloat(document.getElementById('taxInput').value) || 0;
    if (taxVal < 0) {
        document.getElementById('taxInput').value = 0;
        taxVal = 0;
        if (typeof showToast === 'function') showToast("⚠️ لا يمكن إدخال قيمة إضافة أو ضريبة بالسالب!", "warning");
    }

    const taxType = document.getElementById('taxType').value;
    let taxAmount = (taxType === 'perc') ? (subTotal * taxVal / 100) : taxVal;

    if (document.getElementById('salesTaxAmountDisplay')) document.getElementById('salesTaxAmountDisplay').innerText = taxAmount.toFixed(2);

    const settings = JSON.parse(getStore('pos_settings') || '{}');
    const globalTaxEnabled = settings.taxEnabled || false;
    const globalTaxPercent = parseFloat(settings.taxPercent) || 0;
    let globalTaxAmount = globalTaxEnabled ? (subTotal * globalTaxPercent / 100) : 0;

    currentTotal = subTotal - discountAmount + taxAmount + globalTaxAmount;

    if (currentTotal < 0) currentTotal = 0;

    // تحديث إجمالي كل سطر في الجدول ليعكس توزيع الخصم والمصاريف
    if (subTotal > 0) {
        const ratio = currentTotal / subTotal;
        const rows = document.querySelectorAll('#cartTableBody tr');
        cart.forEach((item, index) => {
            const row = rows[index];
            if (row) {
                const totalCell = row.querySelector('.cart-item-total') || row.cells[8];
                if (totalCell) {
                    totalCell.innerText = (item.price * item.qty * ratio).toFixed(2);
                }
            }
        });
    }

    // تحديث الإجمالي

    if (document.getElementById('totalAmount')) document.getElementById('totalAmount').innerText = currentTotal.toFixed(2);

    // حساب إجمالي المديونية المتراكمة (الرصيد السابق + الفاتورة - المدفوع)

    const prevBal = parseFloat(document.getElementById('prevBalanceDisplay').innerText) || 0;

    const tenderedInput = document.getElementById('tenderedAmount');

    const tendered = parseFloat(tenderedInput ? tenderedInput.value : 0) || 0;

    const grandTotalDebt = prevBal + currentTotal - tendered;

    if (document.getElementById('grandDebtDisplay')) {

        document.getElementById('grandDebtDisplay').innerText = grandTotalDebt.toFixed(2);

    }

    if (typeof calculateChange === 'function') calculateChange();

    // تحديث شارة الربح المباشرة (مع مراعاة تكلفة الوحدة الفرعية)

    const totalCost = cart.reduce((sum, item) => {

        let itemCost = 0;

        if (item.selectedUnit && typeof item.selectedUnit === 'object') {

            const unitCost = parseFloat(item.selectedUnit.cost);

            if (!isNaN(unitCost) && item.selectedUnit.cost !== '') {

                // تكلفة الوحدة الفرعية مدخلة صراحةً

                itemCost = unitCost * item.qty;

            } else {

                // الوحدة بدون تكلفة مخصصة → استخدم التكلفة الأساسية × factor

                const factor = parseFloat(item.unitFactor) || 1;

                itemCost = (parseFloat(item.cost) || 0) * item.qty * factor;

            }

        } else {

            // لا وحدة فرعية → تكلفة المنتج مباشرة

            itemCost = (parseFloat(item.cost) || 0) * item.qty;

        }

        return sum + itemCost;

    }, 0);

    const profit = currentTotal - totalCost;

    const profitBadge = document.getElementById('currentProfitBadge');

    if (profitBadge) {

        if (cart.length === 0 || currentTotal === 0) {

            profitBadge.innerText = '0.00';

            profitBadge.style.color = '';

        } else {

            profitBadge.innerText = profit.toFixed(2);

            profitBadge.style.color = profit >= 0 ? 'var(--main-green)' : '#e74c3c';

        }

    }

    // منطق الأزرار الذكية

    const btnContainer = document.getElementById('dynamicButtons');

    btnContainer.innerHTML = '';

    // الحصول على وسيلة الدفع المختارة

    const method = getSelectedPaymentMethod('sales-section');

    if (currentTotal > 0 && method === 'آجل') {

        btnContainer.style.display = 'flex';

        // الزر الأول: المبلغ بالضبط

        createBtn(btnContainer, currentTotal);

        // الزر الثاني: أقرب رقم صحيح أعلى (Logic)

        let nextRound = Math.ceil(currentTotal / 50) * 50;

        if (nextRound === currentTotal) nextRound += 50;

        createBtn(btnContainer, nextRound);

        // زر ثالث اختياري (فئة أكبر)

        let bigNote = Math.ceil(currentTotal / 100) * 100;

        if (bigNote <= nextRound) bigNote += 100;

        createBtn(btnContainer, bigNote);

    } else {

        btnContainer.style.display = 'none';

    }

}

async function saveBill(force = false, accountChecked = false) {

    if (!checkPermission('docs_add')) return false;

    if (window.isSavingTransaction) return false;

    window.isSavingTransaction = true;

    // تعطيل أزرار الحفظ فوراً لمنع الضغط المزدوج
    const saveBtns = document.querySelectorAll('#sales-section .btn-save, #sales-section .action-btn');
    saveBtns.forEach(b => { b.disabled = true; b.style.pointerEvents = 'none'; b.style.opacity = '0.6'; });

    try {

        // --- 🛑 التحقق من حدود الباقة المجانية (Free Trial Limit) ---

        const currentPlan = window.getBayanPlan();

        if (!isEditMode && !window.enforceSubscriptionCheck('invoice')) {
            return false;
        }

        if (cart.length === 0) {

            showCustomAlert({ titleText: '⚠️ الفاتورة فارغة', msg: 'لا يمكن حفظ فاتورة بدون أصناف.' });

            return false;

        }

        // --- 1. التحقق الصارم من توفر الكميات في المخزن (منع البيع بالسالب نهائياً) ---
        let stockErrors = [];

        cart.forEach(item => {
            const p = productsDB.find(x => x.id === item.id || x.name === item.name);
            if (p) {
                const factor = item.unitFactor || 1;
                const baseQty = item.qty * factor;
                let effVariant = null;
                if (p.variants && Array.isArray(p.variants)) {
                    const sSize = item.selectedSize || item.size || '';
                    const sColor = item.selectedColor || item.color || '';
                    if (sSize || sColor) {
                        effVariant = p.variants.find(v => 
                            (!sSize || v.size === sSize) && 
                            (!sColor || v.color === sColor)
                        );
                    }
                }

                // في وضع التعديل: استرداد الكمية الأصلية المحجوزة في الفاتورة نفسها لإتاحتها
                let originalQtyInInvoice = 0;
                if (typeof isEditMode !== 'undefined' && isEditMode && typeof editingOriginalItems !== 'undefined' && Array.isArray(editingOriginalItems)) {
                    const sSize = item.selectedSize || item.size || '';
                    const sColor = item.selectedColor || item.color || '';
                    const matchedOriginal = editingOriginalItems.find(orig => 
                        (orig.product === item.name || orig.productId === item.id || (p && (orig.product === p.name || orig.productId === p.id))) &&
                        (!sSize || orig.selectedSize === sSize || orig.size === sSize) &&
                        (!sColor || orig.selectedColor === sColor || orig.color === sColor)
                    );
                    if (matchedOriginal) {
                        const origFactor = parseFloat(matchedOriginal.unitFactor) || 1;
                        originalQtyInInvoice = (parseFloat(matchedOriginal.qty) || 0) * origFactor;
                    }
                }

                const currentBaseStock = effVariant ? (parseFloat(effVariant.stock) || 0) : (parseFloat(p.stock) || 0);
                const availStock = currentBaseStock + originalQtyInInvoice;

                if (baseQty > availStock) {
                    const variantInfo = effVariant ? ` [${effVariant.size || ''} ${effVariant.color || ''}]` : '';
                    const availInUnit = (availStock / factor).toFixed(2).replace(/\.00$/, '');
                    stockErrors.push(`❌ ${item.name}${variantInfo}: مطلوب (${item.qty}) / متوفر بالمخزن (${availInUnit})`);
                }
            }
        });

        if (stockErrors.length > 0) {
            showCustomAlert({
                type: 'error',
                titleText: '🚫 منع البيع بالسالب (عجز مخزني)',
                msg: 'لا يمكن حفظ الفاتورة لأن الكميات المطلوبة غير متوفرة في المخزن:\n\n' + stockErrors.join('\n') + '\n\nيرجى تعديل الكميات للمتابعة.',
                confirmText: 'حسناً، تراجع'
            });
            return false;
        }

        // --- 🛑 شرط محاسبي: الآجل لازم عميل مسجل ---

        const selectedMethod = getSelectedPaymentMethod('sales-section');

        const customerName = document.getElementById('customerName').value.trim();

        const tenderedInput = document.getElementById('tenderedAmount');
        let tendered = (tenderedInput && tenderedInput.value !== '') ? (parseFloat(tenderedInput.value) || 0) : 0;

        const isExplicitCreditMethod = window.isTransactionCredit(selectedMethod, 0, 0, 0);

        if (!isExplicitCreditMethod && tendered <= 0 && (!tenderedInput || tenderedInput.value === '')) {
            tendered = currentTotal;
            if (tenderedInput) {
                tenderedInput.value = currentTotal.toFixed(2);
            }
        }

        const isCredit = isExplicitCreditMethod || ((currentTotal - tendered) > 0.001);

        if (customerName && !window.isGenericCashPartner(customerName) && typeof checkAccountFrozenAndAlert === 'function') {
            if (checkAccountFrozenAndAlert(customerName)) {
                return false;
            }
        }

        // التحقق الإلزامي من حساب العميل للآجل والتسجيل السريع
        if (!accountChecked) {
            const ok = await window.ensurePartnerAccountExists(customerName, 'عميل', isCredit, () => {
                window.isSavingTransaction = false;
                saveBill(force, true);
            });
            if (!ok) return false;
        }

        // التحقق فقط إذا كان المبلغ المدفوع أقل من المطلوب ولم تكن الفاتورة آجلة (تأكيد الحفظ)

        if (!force && !isCredit && tendered < currentTotal) {

            showCustomAlert({

                type: 'question',

                titleText: '❓ تأكيد العملية',

                msg: 'المبلغ المدفوع أقل من الإجمالي. هل تريد تسجيل الباقي كمديونية؟',

                showCancel: true,

                confirmText: 'نعم، سجل',

                cancelText: 'تراجع',

                onConfirm: () => {
                    window.isSavingTransaction = false;
                    saveBill(true, true);
                }

            });

            return false;

        }

        // تحديث رصيد العميل بناءً للميزة المضافة لجمع الرصيد السابق وعرض تنبيه ذكي

        if (!force && isCredit) {

            const cleanArabic = (str) => (str || '').trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/[ىي]/g, 'ي').replace(/\s+/g, ' ');

            const targetNameClean = cleanArabic(customerName);

            const accIndex = accounts.findIndex(a => cleanArabic(a.name) === targetNameClean);

            if (accIndex !== -1) {

                const acc = accounts[accIndex];

                // التحقق من الحد الائتماني

                const limit = parseFloat(acc.maxDebt) || 0;

                const currentDebt = getAccountBalance(acc.name);

                const newDebtAmount = currentTotal - tendered;

                if (limit > 0 && (currentDebt + newDebtAmount) > limit) {

                    showCustomAlert({

                        type: 'warning',

                        titleText: '⚠️ تحذير شديد: تجاوز الحد الائتماني المسموح!',

                        msg: `

                                <div style="text-align: right; padding: 10px; background: rgba(230, 126, 34, 0.1); border-radius: 15px; border: 1px solid rgba(230, 126, 34, 0.2);">

                                    <p style="margin-bottom: 10px; font-size: 1.1rem;">👤 العميل: <b style="color: var(--accent-gold);">${acc.name}</b></p>

                                    <hr style="opacity: 0.1; margin: 10px 0;">

                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">

                                        <div>

                                            <span style="font-size: 0.8rem; color: #888;">أعلى دين مسموح:</span>

                                            <div style="font-size: 1.2rem; font-weight: 900; color: #27ae60;">${limit.toFixed(2)}</div>

                                        </div>

                                        <div>

                                            <span style="font-size: 0.8rem; color: #888;">الدين الحالي:</span>

                                            <div style="font-size: 1.2rem; font-weight: 900; color: #e74c3c;">${currentDebt.toFixed(2)}</div>

                                        </div>

                                    </div>

                                    <div style="margin-top: 15px; padding: 10px; background: #e67e22; color: white; border-radius: 10px; font-weight: 900; text-align: center;">

                                        ⚠️ الدين بعد الفاتورة: ${(currentDebt + newDebtAmount).toFixed(2)}

                                    </div>

                                    <p style="margin-top: 15px; color: #333; font-size: 0.95rem; text-align: center; font-weight: bold;">

                                        لقد تجاوز العميل الحد الائتماني المحدد له! هل تريد المتابعة وحفظ الفاتورة على أي حال؟

                                    </p>

                                </div>

                            `,

                        showCancel: true,

                        confirmText: 'نعم، احفظ الفاتورة وتجاوز الحد',

                        cancelText: 'تراجع (لتعديل حد الدين من الحسابات)',

                        onConfirm: () => {

                            saveBill(true);

                        }

                    });

                    return false; // إيقاف العملية مؤقتاً في انتظار التأكيد

                }

                // التنبيه الذكي للمديونية

                const totalDue = currentDebt + newDebtAmount;

                showCustomAlert({

                    type: 'question',

                    titleText: '❓ إجمالي الحساب المطلوب',

                    msg: `العميل عليه سابقاً ${currentDebt.toFixed(2)} ج.م، وبالفاتورة الحالية المستحق ${newDebtAmount.toFixed(2)} ج.م.\n\nيصبح إجمالي المديونية: ${totalDue.toFixed(2)} ج.م.\n\nهل تريد الحفظ؟`,

                    showCancel: true,

                    confirmText: 'نعم، احفظ الفاتورة',

                    cancelText: 'إلغاء',

                    onConfirm: () => {

                        // التحديث سيتم عند استدعاء الدالة بقوة

                        saveBill(true);

                    }

                });

                return false; // نوقف التنفيذ حتى يؤكد المستخدم

            }

        }

        // حفظ أسباب الخصم والإضافة الجديدة (التعلم الآلي)

        const discReason = document.getElementById('discountReason').value.trim();

        const txReason = document.getElementById('taxReason').value.trim();

        if (discReason) addNewReason(discReason, discountReasons, 'discountReasonsList');

        if (txReason) addNewReason(txReason, taxReasons, 'taxReasonsList');

        // حساب رقم الفاتورة (Invoice ID) والتعامل مع المخزن في وضع التعديل

        let newInvoiceId;

        if (isEditMode && editingInvoiceId) {

            newInvoiceId = editingInvoiceId;

            // عكس المخزن القديم وحذف السجلات السابقة باستخدام الوظيفة المركزية

            if (window.revertAndClearOldInvoice) {

                await window.revertAndClearOldInvoice(editingInvoiceId, editingInvoiceType);

            }

        } else {

            newInvoiceId = typeof getNextSequence === 'function' ? getNextSequence('بيع') : 1;

        }

        // تجميد الوقت: استخدام التاريخ الأصلي إذا كنا في وضع التعديل

        const dt = (isEditMode && editingOriginalDate && typeof editingOriginalDate === 'object' && editingOriginalDate.full)
            ? editingOriginalDate
            : (typeof getTransactionDateTime === 'function'
                ? getTransactionDateTime('salesDate', 'salesTime')
                : {
                    full: new Date().toLocaleString('ar-EG'),
                    iso: new Date().toLocaleDateString('en-CA'),
                    time: new Date().toTimeString().slice(0, 5)
                });

        // حساب النسبة لتوزيع الخصم والضريبة على الأصناف في السجل

        const subTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

        const ratio = subTotal > 0 ? (currentTotal / subTotal) : 1;

        // 3. خصم الكميات الجديدة من المخزن وتسجيل العمليات

        let accumulatedItemsTotal = 0;

        const activeWH = (typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'المخزن الرئيسي';

        cart.forEach((cartItem, idx) => {

            const product = productsDB.find(p => p.id === cartItem.id || p.name === cartItem.name);

            const factor = cartItem.unitFactor || 1;
            const baseQty = cartItem.qty * factor;

            if (product) {
                product.stock = (parseFloat(product.stock) || 0) - baseQty;
                if (!product.warehouseStocks) product.warehouseStocks = {};
                product.warehouseStocks[activeWH] = (parseFloat(product.warehouseStocks[activeWH]) || 0) - baseQty;

                // تحديث رصيد التشكيلة (المقاس واللون) في مصفوفة الصنف
                if (product.variants && Array.isArray(product.variants)) {
                    const sSize = cartItem.selectedSize || cartItem.size || '';
                    const sColor = cartItem.selectedColor || cartItem.color || '';
                    if (sSize || sColor) {
                        const matchedVar = product.variants.find(v => 
                            (String(v.size || '').trim() === String(sSize).trim()) && 
                            (String(v.color || '').trim() === String(sColor).trim())
                        ) || product.variants.find(v => 
                            (!sSize || String(v.size || '').trim() === String(sSize).trim()) && 
                            (!sColor || String(v.color || '').trim() === String(sColor).trim())
                        );
                        if (matchedVar) {
                            matchedVar.stock = (parseFloat(matchedVar.stock) || 0) - baseQty;
                            if (!matchedVar.warehouseStocks) matchedVar.warehouseStocks = {};
                            matchedVar.warehouseStocks[activeWH] = (parseFloat(matchedVar.warehouseStocks[activeWH]) || 0) - baseQty;
                        }
                    }
                }
            }

            let itemNetTotal = cartItem.price * cartItem.qty * ratio;
            if (idx === cart.length - 1) {
                itemNetTotal = currentTotal - accumulatedItemsTotal;
            } else {
                itemNetTotal = parseFloat(itemNetTotal.toFixed(2));
                accumulatedItemsTotal += itemNetTotal;
            }
            let itemTotalCost = 0;
            const baseCost = product ? (parseFloat(product.cost) || 0) : 0;

            if (cartItem.selectedUnit && typeof cartItem.selectedUnit === 'object') {
                const unitCost = parseFloat(cartItem.selectedUnit.cost);
                if (!isNaN(unitCost) && unitCost > 0) {
                    itemTotalCost = unitCost * cartItem.qty;
                } else {
                    itemTotalCost = baseCost * baseQty;
                }
            } else {
                itemTotalCost = baseCost * baseQty;
            }

            const profit = itemNetTotal - itemTotalCost;

            // تسجيل الحركة الجديدة
            transactions.push({
                date: dt.full,
                dateISO: dt.iso,
                timeISO: dt.time,
                type: 'بيع 📤',
                method: selectedMethod,
                invoiceId: newInvoiceId,
                product: product ? product.name : (cartItem.name || 'صنف حر'),
                unit: cartItem.selectedUnit ? (typeof cartItem.selectedUnit === 'object' ? cartItem.selectedUnit.unitName : cartItem.selectedUnit) : (cartItem.unit || 'قطعة'),
                size: cartItem.selectedSize || '',
                color: cartItem.selectedColor || '',
                priceLevel: document.getElementById('salesPriceLevel')?.value || 'retail',
                qty: cartItem.qty,
                price: cartItem.price,
                discount: (cartItem.qty * cartItem.price > itemNetTotal) ? ((cartItem.qty * cartItem.price) - itemNetTotal).toFixed(2) : '0.00',
                addition: (itemNetTotal > cartItem.qty * cartItem.price) ? (itemNetTotal - (cartItem.qty * cartItem.price)).toFixed(2) : '0.00',
                total: itemNetTotal.toFixed(2),
                profit: profit.toFixed(2),
                partner: document.getElementById('customerName')?.value?.trim() || (isEditMode && window.editingOriginalPartner ? window.editingOriginalPartner : 'عميل نقدي'),
                user: (isEditMode && window.editingOriginalUser) ? window.editingOriginalUser : (currentUser ? currentUser.name : '-'),
                notes: document.getElementById('salesNotes') ? document.getElementById('salesNotes').value.trim() : '',
                paidAmount: (idx === 0) ? tendered : 0,
                isInvoiceHead: (idx === 0),
                invoiceDiscount: (idx === 0) ? (parseFloat(document.getElementById('discountInput')?.value) || 0) : 0,
                invoiceDiscountType: (idx === 0) ? (document.getElementById('discountType')?.value || 'val') : 'val',
                invoiceTax: (idx === 0) ? (parseFloat(document.getElementById('taxInput')?.value) || 0) : 0,
                invoiceTaxType: (idx === 0) ? (document.getElementById('taxType')?.value || 'val') : 'val',
                invoiceGrandTotal: (idx === 0) ? currentTotal : 0,
                warehouse: activeWH,
                unitFactor: factor, // حفظ المعامل للرجوع إليه عند التعديل مستقبلاً
                editDate: isEditMode ? `${new Date().toLocaleString('ar-EG')} (تعديل: ${currentUser ? currentUser.name : 'مجهول'})` : '-'
            });

        });

        await saveData();

        if (typeof logAuditAction === 'function') {
            const auditAction = isEditMode ? 'تحديث فاتورة بيع' : 'حفظ فاتورة بيع جديدة';
            logAuditAction(auditAction, `فاتورة رقم #${newInvoiceId}, الإجمالي: ${currentTotal.toFixed(2)} ج.م, العميل: ${document.getElementById('customerName')?.value || 'نقدي'}, طريقة الدفع: ${selectedMethod}`);
        }

        // 🖨️ فحص وتنفيذ الطباعة التلقائية فور الحفظ إذا كانت الخاصية مفعلة
        const shouldAutoPrint = (typeof isPOSAutoPrintEnabled === 'function') && isPOSAutoPrintEnabled();
        let autoPrintInvoiceData = null;

        if (shouldAutoPrint) {
            const customerNameInput = document.getElementById('customerName');
            const customer = customerNameInput ? customerNameInput.value.trim() : 'عميل نقدي';
            const isExplicitCredit = selectedMethod.includes('آجل') || selectedMethod.includes('اجل') || selectedMethod.includes('ذمم');
            let paidValue = currentTotal;
            const tenderedInp = document.getElementById('tenderedAmount');
            if (tenderedInp && tenderedInp.value !== '') {
                paidValue = parseFloat(tenderedInp.value) || 0;
            } else if (isExplicitCredit) {
                paidValue = 0;
            }

            let prevBalance = 0;
            if (customer && !window.isGenericCashPartner(customer)) {
                if (typeof getHistoricalPartnerBalance === 'function') {
                    prevBalance = getHistoricalPartnerBalance(customer, newInvoiceId);
                } else if (typeof getAccountBalance === 'function') {
                    prevBalance = getAccountBalance(customer, newInvoiceId);
                }
            } else if (document.getElementById('prevBalanceDisplay')) {
                prevBalance = parseFloat(document.getElementById('prevBalanceDisplay').innerText) || 0;
            }

            let discountVal = parseFloat(document.getElementById('discountInput')?.value) || 0;
            const discountType = document.getElementById('discountType')?.value || 'val';
            let discountAmount = (discountType === 'perc') ? (subTotal * discountVal / 100) : discountVal;

            let taxVal = parseFloat(document.getElementById('taxInput')?.value) || 0;
            const taxType = document.getElementById('taxType')?.value || 'val';
            let taxAmount = (taxType === 'perc') ? (subTotal * taxVal / 100) : taxVal;
            const taxReasonEl = document.getElementById('taxReason');
            const selectedTaxReason = taxReasonEl ? taxReasonEl.value.trim() : 'إضافة';

            const settings = JSON.parse(getStore('pos_settings') || '{}');
            const globalTaxEnabled = settings.taxEnabled || false;
            const globalTaxPercent = parseFloat(settings.taxPercent) || 0;
            let globalTaxAmount = globalTaxEnabled ? (subTotal * globalTaxPercent / 100) : 0;

            autoPrintInvoiceData = {
                invoiceNumber: newInvoiceId,
                invoiceType: selectedMethod,
                date: dt.iso || dt.full.split(' ')[0],
                time: dt.time || '',
                cashier: currentUser ? currentUser.name : 'كاشير',
                customer: customer,
                items: JSON.parse(JSON.stringify(cart)),
                subTotal: subTotal,
                discount: discountAmount,
                tax: taxAmount,
                taxLabel: selectedTaxReason,
                globalTax: globalTaxAmount,
                totalAmount: currentTotal,
                paid: paidValue,
                deferred: currentTotal - paidValue,
                prevBalance: prevBalance,
                currentBalance: prevBalance + (currentTotal - paidValue),
                docType: 'sales'
            };
        }

        showCustomAlert({

            type: 'success',

            titleText: isEditMode ? '✅ تم تحديث الفاتورة' : '✅ تم الحفظ بنجاح',

            msg: `تم ${isEditMode ? 'تحديث' : 'حفظ'} فاتورة البيع رقم #${newInvoiceId} ومعالجة فرق المخزون والمديونية.`

        });

        // إعادة ضبط وضع التعديل (Reset Edit State)

        isEditMode = false;

        editingInvoiceId = null;

        editingOriginalDate = null;

        editingOriginalItems = [];

        const mainSaveBtn = document.querySelector('#sales-section .btn-save');

        if (mainSaveBtn) {

            mainSaveBtn.style.background = '';

            mainSaveBtn.innerText = '💾 حفظ الفاتورة (F9)';

        }

        resetBill();

        // 🖨️ إرسال أمر الطباعة التلقائي المباشر
        if (shouldAutoPrint && autoPrintInvoiceData && typeof printInvoice === 'function') {
            setTimeout(() => {
                printInvoice(autoPrintInvoiceData);
            }, 100);
        }

        return true;

    } finally {

        const saveBtns = document.querySelectorAll('#sales-section .btn-save, #sales-section .action-btn');
        saveBtns.forEach(b => { b.disabled = false; b.style.pointerEvents = 'auto'; b.style.opacity = '1'; });
        window.isSavingTransaction = false;

    }

}

function shareBill(platform) {

    if (!navigator.onLine) {

        alert("⚠️ أنت في وضع الأوفلاين (غير متصل بالإنترنت).\nلا يمكن مشاركة الفاتورة عبر واتساب أو تلجرام حالياً.");

        return;

    }

    if (cart.length === 0) return alert("الفاتورة فارغة!");

    let text = `🛒 * فاتورة جديدة من متجر السعادة *\n`;

    text += `📅 التاريخ: ${new Date().toLocaleString('ar-EG')}\n`;

    text += `👤 العميل: ${document.getElementById('customerName').value || 'نقدي'}\n`;

    text += `------------------\n`;

    cart.forEach(item => {

        const unitName = item.selectedUnit ? (typeof item.selectedUnit === 'object' ? item.selectedUnit.unitName : item.selectedUnit) : (item.unit || 'قطعة');

        text += `▪️ ${item.name} (${item.qty} ${unitName}) = ${(item.price * item.qty).toFixed(2)} \n`;

    });

    text += `------------------\n`;

    text += `💰 * الإجمالي: ${currentTotal.toFixed(2)} ج.م *\n`;

    const encodedText = encodeURIComponent(text);

    let url = '';

    if (platform === 'wa') {

        url = `https://wa.me/?text=${encodedText}`;

    } else if (platform === 'tg') {

        url = `https://t.me/share/url?url=${encodedText}&text=`; // Telegram format

    }

    window.open(url, '_blank');

}

function printBill() {

    if (cart.length === 0) return alert("⚠️ الفاتورة فارغة! لا يمكن طباعة فاتورة بدون أصناف.");

    const method = getSelectedPaymentMethod('sales-section');

    const customerNameInput = document.getElementById('customerName');

    const customer = customerNameInput ? customerNameInput.value.trim() : 'عميل نقدي';

    // --- حماية: منع طباعة آجل لعميل نقدي ---

    if (method.includes('آجل') && (customer === "" || customer.includes('نقدي') || customer.includes('كاش'))) {

        showCustomAlert({

            type: 'error',

            titleText: '⚠️ خطأ في الطباعة',

            msg: 'لا يمكن طباعة فاتورة "آجل" لحساب "نقدي". يرجى اختيار عميل مسجل أولاً لمتابعة مديونيته.'

        });

        if (customerNameInput) {

            customerNameInput.focus();

            customerNameInput.style.border = '2px solid red';

        }

        return;

    }

    const dt = getTransactionDateTime('salesDate', 'salesTime');

    const shopName = document.getElementById('shopName').value || 'متجر السعادة';

    const shopAddress = document.getElementById('shopAddress').value || '';

    const shopPhone = document.getElementById('shopPhone1').value || '';

    const footerMsg = document.getElementById('printFooterMsg').value || 'شكراً لزيارتكم!';

    const salesId = document.getElementById('salesBadgeID') ? document.getElementById('salesBadgeID').innerText : '---';

    const isExplicitCredit = method.includes('آجل') || method.includes('اجل') || method.includes('ذمم') || method.includes('credit');
    let paidValue = currentTotal;
    const tenderedInp = document.getElementById('tenderedAmount');
    if (tenderedInp && tenderedInp.value !== '') {
        paidValue = parseFloat(tenderedInp.value) || 0;
    } else if (isExplicitCredit) {
        paidValue = 0;
    }

    let prevBalance = 0;
    if (customer && !window.isGenericCashPartner(customer)) {
        if (typeof getHistoricalPartnerBalance === 'function') {
            prevBalance = getHistoricalPartnerBalance(customer, salesId);
        } else if (typeof getAccountBalance === 'function') {
            prevBalance = getAccountBalance(customer, salesId);
        }
    } else if (document.getElementById('prevBalanceDisplay')) {
        prevBalance = parseFloat(document.getElementById('prevBalanceDisplay').innerText) || 0;
    }

    let invoiceTotal = currentTotal + prevBalance;
    let creditValue = Math.max(0, invoiceTotal - paidValue);

    let customerAddressToPrint = currentSessionSelectedAddress;

    if (!customerAddressToPrint) {

        const acc = accounts.find(a => a.name === customer);

        if (acc) customerAddressToPrint = (acc.address || acc.mobile || '').split(/[|,]/)[0];

    }

    let subTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

    let discountVal = parseFloat(document.getElementById('discountInput').value) || 0;

    const discountType = document.getElementById('discountType').value;

    let discountAmount = (discountType === 'perc') ? (subTotal * discountVal / 100) : discountVal;

    let taxVal = parseFloat(document.getElementById('taxInput').value) || 0;

    const taxType = document.getElementById('taxType').value;

    let taxAmount = (taxType === 'perc') ? (subTotal * taxVal / 100) : taxVal;

    const taxReasonEl = document.getElementById('taxReason');

    const selectedTaxReason = taxReasonEl ? taxReasonEl.value.trim() : 'إضافة';

    const settings = JSON.parse(getStore('pos_settings') || '{}');

    const globalTaxEnabled = settings.taxEnabled || false;

    const globalTaxPercent = parseFloat(settings.taxPercent) || 0;

    let globalTaxAmount = globalTaxEnabled ? (subTotal * globalTaxPercent / 100) : 0;

    const invoiceData = {

        invoiceNumber: salesId,

        invoiceType: method,

        date: dt.iso || dt.full.split(' ')[0],

        time: dt.time || '',

        cashier: currentUser.name,

        customer: customer,

        items: cart,

        subTotal: subTotal,

        discount: discountAmount,

        tax: taxAmount,

        taxLabel: selectedTaxReason,

        globalTax: globalTaxAmount,

        totalAmount: currentTotal,

        paid: paidValue,

        deferred: currentTotal - paidValue,

        prevBalance: prevBalance,

        currentBalance: prevBalance + (currentTotal - paidValue),

        docType: 'sales'

    };

    if (typeof printInvoice === 'function') {

        printInvoice(invoiceData);

    } else {

        alert('خطأ: محرك الطباعة غير متوفر!');

    }

}

function printPurchaseBill() {

    if (purchaseCart.length === 0) return alert("⚠️ الفاتورة فارغة!");

    const supplier = document.getElementById('supplierName').value || 'مورد عام';

    const dt = getTransactionDateTime('purchaseDate', 'purchaseTime');

    const shopName = document.getElementById('shopName').value || 'متجر السعادة';

    const shopAddress = document.getElementById('shopAddress').value || '';

    const shopPhone = document.getElementById('shopPhone1').value || '';

    const purchaseId = document.getElementById('purchaseBadgeID') ? document.getElementById('purchaseBadgeID').innerText : '---';

    let subTotal = purchaseCart.reduce((sum, item) => sum + (item.price * item.qty), 0);

    let discountVal = parseFloat(document.getElementById('purchaseDiscount').value) || 0;

    const discountType = document.getElementById('purchaseDiscountType').value;

    let discountAmount = (discountType === 'perc') ? (subTotal * discountVal / 100) : discountVal;

    let taxVal = parseFloat(document.getElementById('purchaseTax').value) || 0;

    const taxType = document.getElementById('purchaseTaxType').value;

    let taxAmount = (taxType === 'perc') ? (subTotal * taxVal / 100) : taxVal;

    const settings = JSON.parse(getStore('pos_settings') || '{}');

    const globalTaxEnabled = settings.taxEnabled || false;

    const globalTaxPercent = parseFloat(settings.taxPercent) || 0;

    let globalTaxAmount = globalTaxEnabled ? (subTotal * globalTaxPercent / 100) : 0;

    let finalTotal = subTotal - discountAmount + taxAmount + globalTaxAmount;

    const purchaseTaxReasonEl = document.getElementById('purchaseTaxReason');

    const selectedPurchaseTaxReason = purchaseTaxReasonEl ? purchaseTaxReasonEl.value.trim() : 'إضافة';

    const invoiceData = {

        invoiceNumber: purchaseId,

        invoiceType: 'نقداً',

        date: dt.iso || dt.full.split(' ')[0],

        time: dt.time || '',

        cashier: currentUser.name,

        customer: supplier,

        items: purchaseCart,

        subTotal: subTotal,

        discount: discountAmount,

        tax: taxAmount,

        taxLabel: selectedPurchaseTaxReason,

        globalTax: globalTaxAmount,

        totalAmount: finalTotal,

        paid: finalTotal,

        deferred: 0,

        prevBalance: 0,

        currentBalance: 0,

        docType: 'purchase'

    };

    if (typeof printInvoice === 'function') {

        printInvoice(invoiceData);

    } else {

        alert('خطأ: محرك الطباعة غير متوفر!');

    }

}

async function showCurrentBillProfit() {

    if (cart.length === 0) return alert("⚠️ الفاتورة فارغة!");

    let totalCost = 0;

    let totalSale = 0;

    for (const item of cart) {

        // محاولة جلب المنتج بكل الطرق (رقم أو نص) لضمان الدقة

        let latestProduct = await db.products.get(item.id);

        if (!latestProduct && !isNaN(item.id)) {

            latestProduct = await db.products.get(Number(item.id));

        }

        const baseCost = latestProduct ? (parseFloat(latestProduct.avgBuyPrice) || parseFloat(latestProduct.cost) || 0) : (parseFloat(item.cost) || 0);

        console.log(`DB Debug - Item: ${item.name}, ID: ${item.id}, Found in DB: ${!!latestProduct}, Avg Price: ${baseCost}`);

        let itemCost = 0;

        const factor = parseFloat(item.unitFactor) || 1;

        if (item.selectedUnit && typeof item.selectedUnit === 'object') {

            let unitCost = 0;

            if (latestProduct && latestProduct.units) {

                const u = latestProduct.units.find(un => un.unitName === item.selectedUnit.unitName);

                if (u) unitCost = parseFloat(u.avgBuyPrice) || parseFloat(u.cost) || 0;

            }

            if (unitCost > 0) {

                itemCost = unitCost * item.qty;

            } else {

                itemCost = baseCost * item.qty * factor;

            }

        } else {

            itemCost = baseCost * item.qty * factor;

        }

        totalCost += itemCost;

        totalSale += item.price * item.qty;

    }

    let discountVal = parseFloat(document.getElementById('discountInput').value) || 0;

    const discountType = document.getElementById('discountType').value;

    let discountAmount = (discountType === 'perc') ? (totalSale * discountVal / 100) : discountVal;

    const profit = (totalSale - discountAmount) - totalCost;

    // تعبئة بيانات المودرن مودال الجديد

    document.getElementById('pTotalSales').innerText = totalSale.toFixed(2);

    document.getElementById('pTotalCost').innerText = totalCost.toFixed(2);

    document.getElementById('pDiscount').innerText = discountAmount.toFixed(2);

    document.getElementById('pNetProfit').innerText = profit.toFixed(2);

    // إظهار المودال

    document.getElementById('profitModal').classList.remove('hidden');

}

// --- دوال الطباعة للأقسام الأخرى ---

// =========================================================================
// 📸 معاينة صورة ومواصفات الموديل النشط في شاشة المبيعات (Active Fashion Product Preview)
// =========================================================================

function updatePOSProductImagePreview(productOrId, variant = null) {
    if (!productOrId) {
        resetPOSProductImagePreview();
        return;
    }

    const product = (typeof productOrId === 'object') ? productOrId : productsDB.find(p => p.id === productOrId);
    if (!product) {
        resetPOSProductImagePreview();
        return;
    }

    const placeholder = document.getElementById('posProductImagePlaceholder');
    const activeImg = document.getElementById('posProductActiveImg');
    const badgeEl = document.getElementById('posActiveProductBadge');
    const cardEl = document.getElementById('posProductImageCard');

    if (!placeholder || !activeImg) return;

    if (badgeEl) badgeEl.innerText = 'المحدد 🎯';

    // عرض صورة الموديل فقط بدون أي نصوص أو تفاصيل إضافية مع إطار متوهج وواضح
    if (product.image && typeof product.image === 'string' && product.image.trim() !== '') {
        activeImg.src = product.image;
        activeImg.style.display = 'block';
        placeholder.style.display = 'none';
        if (cardEl) {
            cardEl.style.border = '3.5px solid #2563eb';
            cardEl.style.background = '#f0f7ff';
            cardEl.style.boxShadow = '0 0 0 4px rgba(37, 99, 235, 0.25), 0 10px 25px rgba(37, 99, 235, 0.3)';
        }
    } else {
        activeImg.style.display = 'none';
        placeholder.style.display = 'flex';
        placeholder.innerHTML = `
            <span style="font-size: 3.5rem; opacity: 0.85;">👗</span>
            <div style="font-weight: 800; font-size: 0.78rem; color: #94a3b8; margin-top: 6px;">(لا توجد صورة للموديل)</div>
        `;
        if (cardEl) {
            cardEl.style.border = '3px solid #3b82f6';
            cardEl.style.background = '#f8fafc';
            cardEl.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.2), 0 6px 18px rgba(59, 130, 246, 0.2)';
        }
    }
}

function resetPOSProductImagePreview() {
    const placeholder = document.getElementById('posProductImagePlaceholder');
    const activeImg = document.getElementById('posProductActiveImg');
    const badgeEl = document.getElementById('posActiveProductBadge');
    const cardEl = document.getElementById('posProductImageCard');

    if (badgeEl) badgeEl.innerText = 'جاهز';
    if (activeImg) {
        activeImg.style.display = 'none';
        activeImg.src = '';
    }
    if (placeholder) {
        placeholder.style.display = 'flex';
        placeholder.innerHTML = `
            <span style="font-size: 3rem; margin-bottom: 6px; opacity: 0.75;">👗</span>
            <div style="font-weight: 800; font-size: 0.88rem; color: #64748b;">صورة الموديل</div>
            <div style="font-size: 0.72rem; color: #94a3b8; margin-top: 3px;">تظهر الصورة عند المرور على الصنف</div>
        `;
    }
    if (cardEl) {
        cardEl.style.border = '2.5px dashed #cbd5e1';
        cardEl.style.background = '#ffffff';
        cardEl.style.boxShadow = 'none';
    }
}

window.updatePOSProductImagePreview = updatePOSProductImagePreview;
window.resetPOSProductImagePreview = resetPOSProductImagePreview;

function toggleQuickItems() {
    const container = document.getElementById('quickItemsContainer');
    const btn = document.getElementById('toggleQuickItemsBtn');
    const salesLayout = document.querySelector('.sales-main-layout');
    const tableContainer = salesLayout ? salesLayout.querySelector('.table-container') : null;

    if (!container) return;

    if (container.style.display === 'none') {
        container.style.display = 'flex';
        if (btn) {
            btn.style.background = 'linear-gradient(135deg, #0284c7, #0369a1)';
            btn.style.borderColor = '#0284c7';
            btn.innerHTML = '📸';
        }
        if (tableContainer) tableContainer.style.flex = '1.5';
        setStore('showQuickItems', 'true');
    } else {
        container.style.display = 'none';
        if (btn) {
            btn.style.background = '#64748b';
            btn.style.borderColor = '#64748b';
            btn.innerHTML = '🖼️';
        }
        if (tableContainer) tableContainer.style.flex = '1';
        setStore('showQuickItems', 'false');
    }
}

window.toggleQuickItems = toggleQuickItems;

// تطبيق الحالة المحفوظة عند التشغيل
setTimeout(() => {
    const savedState = getStore('showQuickItems');
    if (savedState === 'false') {
        const container = document.getElementById('quickItemsContainer');
        const btn = document.getElementById('toggleQuickItemsBtn');
        const salesLayout = document.querySelector('.sales-main-layout');
        const tableContainer = salesLayout ? salesLayout.querySelector('.table-container') : null;

        if (container) {
            container.style.display = 'none';
            if (btn) {
                btn.style.background = '#64748b';
                btn.style.borderColor = '#64748b';
                btn.innerHTML = '🖼️';
            }
            if (tableContainer) tableContainer.style.flex = '1';
        }
    }
}, 500);

// =========================================================================
// 🖨️ نظام وخاصية الطباعة التلقائية لشاشة البيع (Auto-Print System for POS)
// =========================================================================

function isPOSAutoPrintEnabled() {
    return getStore('pos_auto_print_enabled') === 'true';
}

function updatePOSAutoPrintUI(isEnabled) {
    const btn = document.getElementById('posAutoPrintToggleBtn');
    const textEl = document.getElementById('posAutoPrintText');
    const iconEl = document.getElementById('posAutoPrintIcon');
    if (!btn || !textEl) return;

    if (isEnabled) {
        btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
        btn.style.borderColor = '#059669';
        btn.style.color = '#ffffff';
        btn.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.3)';
        textEl.innerText = 'طباعة تلقائية: مفعلة ⚡';
        if (iconEl) iconEl.innerText = '🖨️';
    } else {
        btn.style.background = '#f8fafc';
        btn.style.borderColor = '#cbd5e1';
        btn.style.color = '#64748b';
        btn.style.boxShadow = 'none';
        textEl.innerText = 'طباعة تلقائية: معطلة';
        if (iconEl) iconEl.innerText = '🖨️';
    }
}

function togglePOSAutoPrint() {
    const currentState = isPOSAutoPrintEnabled();
    const newState = !currentState;
    setStore('pos_auto_print_enabled', newState ? 'true' : 'false');
    updatePOSAutoPrintUI(newState);

    if (typeof showToast === 'function') {
        showToast(
            newState ? '⚡ تم تفعيل الطباعة التلقائية فور حفظ الفاتورة' : '🔒 تم تعطيل الطباعة التلقائية',
            newState ? 'success' : 'info'
        );
    }
}

window.togglePOSAutoPrint = togglePOSAutoPrint;
window.isPOSAutoPrintEnabled = isPOSAutoPrintEnabled;

// تحميل وتطبيق الحالة المحفوظة عند فتح الصفحة
setTimeout(() => {
    updatePOSAutoPrintUI(isPOSAutoPrintEnabled());
}, 400);
