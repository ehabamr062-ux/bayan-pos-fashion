/**
 * Bayan POS - Price Tracking Section Fixes
 * 1. Fast alphabetical scroll bar (inside pt-fast-scrollbar in HTML)
 * 2. Move dynamic content to pt-content-area after render
 * 3. Fix stats logic for products with sub-units
 */

(function () {
    'use strict';

    // ========================
    // SECTION 1: CSS STYLES
    // ========================
    function injectCSS() {
        if (document.getElementById('pt-fixes-style')) return;
        const style = document.createElement('style');
        style.id = 'pt-fixes-style';
        style.textContent = `
            /* شريط التمرير الأبجدي */
            #pt-fast-scrollbar {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 2px;
                padding: 10px 4px;
                background: rgba(255,255,255,0.92);
                border-right: 1px solid #e2e8f0;
                min-width: 34px;
                max-width: 34px;
                overflow-y: auto;
                scrollbar-width: none;
                box-shadow: 2px 0 10px rgba(0,0,0,0.05);
                flex-shrink: 0;
                user-select: none;
                height: 100%;
            }
            #pt-fast-scrollbar::-webkit-scrollbar { display: none; }

            .pt-sb-btn {
                font-size: 0.62rem;
                font-weight: 800;
                color: #64748b;
                cursor: pointer;
                padding: 2px 5px;
                border-radius: 7px;
                transition: all 0.15s ease;
                min-width: 24px;
                text-align: center;
                line-height: 1.7;
                font-family: 'Cairo', sans-serif;
            }
            .pt-sb-btn:hover {
                background: linear-gradient(135deg, #3b82f6, #6366f1);
                color: white;
                transform: scale(1.2);
            }
            .pt-sb-btn.active {
                background: linear-gradient(135deg, #10b981, #059669);
                color: white;
            }

            /* بانر الإحصاءات الصحيحة داخل المودال */
            #pt-corrected-stats {
                display: flex;
                gap: 8px;
                padding: 10px 12px;
                background: linear-gradient(135deg, #f0fdf4, #ecfdf5);
                border: 2px solid #10b981;
                border-radius: 12px;
                margin-bottom: 12px;
                flex-wrap: wrap;
                justify-content: space-around;
                font-family: 'Cairo', sans-serif;
                direction: rtl;
            }
            .pt-cs-item {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 2px;
                min-width: 80px;
            }
            .pt-cs-label { font-size: 0.65rem; color: #64748b; font-weight: 700; text-align: center; }
            .pt-cs-value { font-size: 1rem; font-weight: 900; color: #047857; }
            .pt-cs-note  { font-size: 0.55rem; color: #94a3b8; text-align: center; }
        `;
        document.head.appendChild(style);
    }

    // ========================
    // SECTION 2: FAST SCROLL BAR
    // ========================
    const ARABIC_LETTERS = [
        'أ','ب','ت','ث','ج','ح','خ','د','ذ','ر',
        'ز','س','ش','ص','ض','ط','ظ','ع','غ','ف',
        'ق','ك','ل','م','ن','ه','و','ي'
    ];

    function normalizeFirst(str) {
        if (!str) return '';
        const c = str.charAt(0);
        if (c === 'إ' || c === 'آ' || c === 'ا') return 'أ';
        return c;
    }

    function buildScrollBar() {
        const bar = document.getElementById('pt-fast-scrollbar');
        if (!bar) return;

        // الحروف من قاعدة البيانات (الأسرع والأدق)
        let letters = [];
        if (window.productsDB && window.productsDB.length > 0) {
            const seen = new Set();
            window.productsDB.forEach(p => { if (p.name) seen.add(normalizeFirst(p.name)); });
            letters = ARABIC_LETTERS.filter(l => seen.has(l));
        }

        // fallback: من المحتوى المرسوم
        if (letters.length === 0) {
            const area = document.getElementById('pt-content-area') || document.getElementById('price-tracking-section');
            if (area) {
                const seen = new Set();
                area.querySelectorAll('[onclick*="viewProductPriceHistory"]').forEach(el => {
                    const m = el.getAttribute('onclick').match(/viewProductPriceHistory\(['"](.)/);
                    if (m) seen.add(normalizeFirst(m[1]));
                });
                letters = ARABIC_LETTERS.filter(l => seen.has(l));
            }
        }

        if (letters.length === 0) return;

        bar.innerHTML = letters.map(l =>
            `<span class="pt-sb-btn" onclick="ptScrollTo('${l}')" title="${l}">${l}</span>`
        ).join('');
    }

    window.ptScrollTo = function (letter) {
        // التمرير داخل pt-content-area
        const area = document.getElementById('pt-content-area') || document.getElementById('price-tracking-section');
        if (!area) return;

        // تظليل الحرف النشط
        document.querySelectorAll('.pt-sb-btn').forEach(b => b.classList.remove('active'));
        const btn = Array.from(document.querySelectorAll('.pt-sb-btn')).find(b => b.textContent.trim() === letter);
        if (btn) btn.classList.add('active');

        // البحث عن أول عنصر بهذا الحرف
        const targets = area.querySelectorAll('[onclick*="viewProductPriceHistory"]');
        for (const el of targets) {
            const m = el.getAttribute('onclick').match(/viewProductPriceHistory\(['"]([^'"]+)['"]\)/);
            if (m && normalizeFirst(m[1]) === letter) {
                const offset = el.getBoundingClientRect().top - area.getBoundingClientRect().top + area.scrollTop - 10;
                area.scrollTo({ top: offset, behavior: 'smooth' });
                return;
            }
        }
    };

    // ========================
    // SECTION 3: MOVE CONTENT TO pt-content-area
    // ========================
    function moveContentToArea() {
        const section = document.getElementById('price-tracking-section');
        const contentArea = document.getElementById('pt-content-area');
        if (!section || !contentArea) return;

        // نقل كل الأطفال عدا الشريط والـ content-area
        const children = Array.from(section.children).filter(c =>
            c.id !== 'pt-fast-scrollbar' && c.id !== 'pt-content-area'
        );
        children.forEach(child => contentArea.appendChild(child));
    }

    // ========================
    // SECTION 4: HOOK RENDER FUNCTIONS
    // ========================
    function hookFunctions() {
        const origRender = window.renderPriceTrackingDashboard;
        if (typeof origRender === 'function') {
            window.renderPriceTrackingDashboard = async function () {
                const r = await origRender.apply(this, arguments);
                setTimeout(() => { moveContentToArea(); buildScrollBar(); }, 350);
                return r;
            };
        }

        const origInit = window.initPriceTracking;
        if (typeof origInit === 'function') {
            window.initPriceTracking = function () {
                const r = origInit.apply(this, arguments);
                setTimeout(() => { moveContentToArea(); buildScrollBar(); }, 600);
                return r;
            };
        }
    }

    // ========================
    // SECTION 5: FIX STATS LOGIC
    // ========================
    function isPrimaryUnit(t) {
        if (!t.unitFactor) return true;
        const uf = parseFloat(t.unitFactor);
        return isNaN(uf) || uf === 1;
    }

    function computeCorrectStats(productName) {
        if (!window.productsDB || !window.transactions) return null;
        const product = window.productsDB.find(p => p.name === productName);
        if (!product) return null;

        const purchasePrices = window.transactions
            .filter(t => t.product === productName && t.type && t.type.includes('شراء') && !t.type.includes('مرتجع') && isPrimaryUnit(t))
            .map(t => parseFloat(t.price) || 0).filter(p => p > 0);

        const salePrices = window.transactions
            .filter(t => t.product === productName && t.type && t.type.includes('بيع') && !t.type.includes('مرتجع') && isPrimaryUnit(t))
            .map(t => parseFloat(t.price) || 0).filter(p => p > 0);

        const currentSale = parseFloat(product.price) || 0;
        const currentCost = parseFloat(product.cost) || 0;
        const minCost = purchasePrices.length > 0 ? Math.min(...purchasePrices) : null;
        const maxCost = purchasePrices.length > 0 ? Math.max(...purchasePrices) : null;
        const avgSale = salePrices.length > 0
            ? salePrices.reduce((a, b) => a + b, 0) / salePrices.length
            : currentSale;
        const refSale = currentSale > 0 ? currentSale : avgSale;
        const margins = purchasePrices.map(cost => refSale > 0 ? (refSale - cost) / refSale * 100 : 0);
        const avgMargin = margins.length > 0
            ? margins.reduce((a, b) => a + b, 0) / margins.length
            : (refSale > 0 && currentCost > 0 ? (refSale - currentCost) / refSale * 100 : 0);

        return { minCost, maxCost, avgSale, avgMargin, purchaseCount: purchasePrices.length, saleCount: salePrices.length };
    }

    function injectCorrectedStats(productName) {
        const stats = computeCorrectStats(productName);
        if (!stats) return;

        // إزالة البانر القديم
        const old = document.getElementById('pt-corrected-stats');
        if (old) old.remove();

        // تصحيح ptAvgSale (ID مباشر موجود في الكود الأصلي)
        const avgSaleEl = document.getElementById('ptAvgSale');
        if (avgSaleEl) avgSaleEl.innerText = stats.avgSale.toFixed(2);

        // تصحيح باقي العناصر بناءً على النص المجاور
        document.querySelectorAll('span, b, strong').forEach(el => {
            if (!el.offsetParent) return;
            const parent = el.parentElement;
            if (!parent) return;
            const pText = parent.textContent || '';
            const val = (el.innerText || '').trim();
            if ((/^\d+\.?\d*$/.test(val) || val === '--') && pText.includes('أقل') && pText.includes('شراء'))
                el.innerText = stats.minCost !== null ? stats.minCost.toFixed(2) : '--';
            else if ((/^\d+\.?\d*$/.test(val) || val === '--') && pText.includes('أعلى') && pText.includes('شراء'))
                el.innerText = stats.maxCost !== null ? stats.maxCost.toFixed(2) : '--';
            else if (/^\d+\.?\d*$/.test(val) && pText.includes('متوسط') && pText.includes('بيع'))
                el.innerText = stats.avgSale.toFixed(2);
            else if (/^\d+\.?\d*%$/.test(val) && pText.includes('هامش'))
                el.innerText = stats.avgMargin.toFixed(1) + '%';
        });

        // البحث عن المودال المفتوح الذي يحتوي اسم المنتج
        let targetModal = null;
        document.querySelectorAll('[id]').forEach(m => {
            if (m.classList.contains('hidden') || m.style.display === 'none') return;
            if (m.id && (m.id.includes('Modal') || m.id.includes('modal') || m.id.includes('History')) && m.textContent.includes(productName))
                targetModal = m;
        });
        if (!targetModal) return;

        // إنشاء البانر
        const banner = document.createElement('div');
        banner.id = 'pt-corrected-stats';
        banner.innerHTML = `
            <div class="pt-cs-item">
                <span class="pt-cs-label">📉 أقل سعر شراء</span>
                <span class="pt-cs-value">${stats.minCost !== null ? stats.minCost.toFixed(2) : '--'}</span>
                <span class="pt-cs-note">وحدة أساسية</span>
            </div>
            <div class="pt-cs-item">
                <span class="pt-cs-label">📈 أعلى سعر شراء</span>
                <span class="pt-cs-value">${stats.maxCost !== null ? stats.maxCost.toFixed(2) : '--'}</span>
                <span class="pt-cs-note">وحدة أساسية</span>
            </div>
            <div class="pt-cs-item">
                <span class="pt-cs-label">💰 متوسط البيع</span>
                <span class="pt-cs-value">${stats.avgSale.toFixed(2)}</span>
                <span class="pt-cs-note">${stats.saleCount > 0 ? stats.saleCount + ' معاملة' : 'السعر الحالي'}</span>
            </div>
            <div class="pt-cs-item">
                <span class="pt-cs-label">📊 متوسط الهامش</span>
                <span class="pt-cs-value">${stats.avgMargin.toFixed(1)}%</span>
                <span class="pt-cs-note">وحدة أساسية فقط</span>
            </div>
        `;

        const body = targetModal.querySelector('.modal-body, [class*="content"], form, table') || targetModal.firstElementChild;
        if (body) body.insertBefore(banner, body.firstChild);
    }

    function hookViewProductHistory() {
        const original = window.viewProductPriceHistory;
        window.viewProductPriceHistory = function (productName) {
            if (typeof original === 'function') original.call(this, productName);
            setTimeout(() => injectCorrectedStats(productName), 130);
        };
    }

    // ========================
    // SECTION 6: OBSERVE CONTENT AREA
    // ========================
    function observeContentArea() {
        // راقب price-tracking-section لو الكود الأصلي كتب فيه محتوى جديد
        const section = document.getElementById('price-tracking-section');
        if (section) {
            new MutationObserver(() => {
                setTimeout(() => { moveContentToArea(); buildScrollBar(); }, 200);
            }).observe(section, { childList: true });
        }
    }

    // ========================
    // INIT
    // ========================
    document.addEventListener('DOMContentLoaded', () => {
        injectCSS();
        hookFunctions();
        hookViewProductHistory();
        observeContentArea();
        // بناء الشريط بعد تحميل قاعدة البيانات
        setTimeout(() => buildScrollBar(), 2000);
    });

})();
