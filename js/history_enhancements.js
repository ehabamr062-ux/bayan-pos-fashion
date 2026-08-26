/**
 * Bayan POS - History Section Enhancements
 * 1. عمود "الكمية بعد العملية" (رصيد المخزون بعد كل حركة)
 * 2. فلتر البحث برقم الفاتورة أو اسم العميل/المورد
 */
(function () {
    'use strict';

    // =============================================
    // SECTION 1: CSS
    // =============================================
    function injectCSS() {
        if (document.getElementById('history-enh-style')) return;
        const s = document.createElement('style');
        s.id = 'history-enh-style';
        s.textContent = `
            .col-hist-11 {
                background: linear-gradient(135deg, rgba(124,58,237,0.08), rgba(245,158,11,0.08)) !important;
                font-weight: 900;
                color: #7c3aed;
                text-align: center;
                white-space: nowrap;
            }
            .hist-balance-up   { color: #059669; font-weight: 900; }
            .hist-balance-down { color: #dc2626; font-weight: 900; }
            .hist-balance-zero { color: #94a3b8; font-weight: 700; }

            /* تحسين مربع فلتر الفاتورة */
            #historyInvoiceClientFilter:focus {
                box-shadow: 0 0 0 3px rgba(124,58,237,0.15);
            }
        `;
        document.head.appendChild(s);
    }

    // =============================================
    // SECTION 2: حساب "الكمية بعد العملية"
    // =============================================


    /**
     * يقرأ الرصيد النهائي من window.productsDB (حقل stock)
     * وهو نفس "الرصيد النهائي" الظاهر في قسم البضاعة
     */
    function getProductStock(productName) {
        if (!productName) return null;
        const db = window.productsDB || window.products || [];
        // بحث بالاسم الكامل أولاً
        let prod = db.find(p => (p.name || '').trim() === productName.trim());
        // لو ما لقى، ابحث بجزء من الاسم
        if (!prod) prod = db.find(p => (p.name || '').includes(productName.trim()));
        if (!prod) return null;
        // حقل الرصيد النهائي هو 'stock'
        const stock = parseFloat(prod.stock);
        return isNaN(stock) ? null : stock;
    }

    function injectBalanceColumn() {
        const tbody = document.getElementById('historyTableBody');
        if (!tbody) return;

        const rows = Array.from(tbody.querySelectorAll('tr'));
        if (rows.length === 0) return;

        rows.forEach(row => {
            // تجنّب إضافة العمود مرتين
            if (row.querySelector('.col-hist-11')) return;

            const cells = row.querySelectorAll('td');
            if (cells.length < 6) {
                const td = document.createElement('td');
                td.className = 'col-hist-11';
                td.textContent = '—';
                row.appendChild(td);
                return;
            }

            // عمود 4 = اسم الصنف
            const productName = cells[4]?.textContent?.trim() || '';
            const stock = getProductStock(productName);

            const td = document.createElement('td');
            td.className = 'col-hist-11';
            td.style.textAlign = 'center';

            if (stock === null) {
                td.innerHTML = `<span class="hist-balance-zero">—</span>`;
            } else if (stock > 0) {
                td.innerHTML = `<span class="hist-balance-up">▲ ${stock % 1 === 0 ? stock : stock.toFixed(2)}</span>`;
            } else if (stock < 0) {
                td.innerHTML = `<span class="hist-balance-down">▼ ${Math.abs(stock % 1 === 0 ? stock : stock.toFixed(2))}</span>`;
            } else {
                td.innerHTML = `<span class="hist-balance-zero">0</span>`;
            }

            row.appendChild(td);
        });
    }

    // =============================================
    // SECTION 3: فلتر البحث برقم الفاتورة/العميل
    // =============================================

    window.applyHistoryInvoiceClientFilter = function (query) {
        const tbody = document.getElementById('historyTableBody');
        if (!tbody) return;
        const q = (query || '').trim().toLowerCase();
        const rows = tbody.querySelectorAll('tr');
        rows.forEach(row => {
            if (!q) {
                row.style.display = '';
                return;
            }
            const cells = row.querySelectorAll('td');
            // عمود 1 = رقم الفاتورة, عمود 8 = الطرف الثاني (عميل/مورد)
            const invoiceNum  = cells[1]?.textContent?.toLowerCase() || '';
            const clientName  = cells[8]?.textContent?.toLowerCase() || '';
            const match = invoiceNum.includes(q) || clientName.includes(q);
            row.style.display = match ? '' : 'none';
        });
    };

    // =============================================
    // SECTION 4: مراقبة تحديث الجدول
    // =============================================
    function observeHistoryTable() {
        const tbody = document.getElementById('historyTableBody');
        if (!tbody) return;

        const obs = new MutationObserver(() => {
            setTimeout(() => injectBalanceColumn(), 100);
        });
        obs.observe(tbody, { childList: true, subtree: true });

        // تشغيل أول مرة لو الجدول ممتليء
        setTimeout(() => injectBalanceColumn(), 500);
    }

    // =============================================
    // SECTION 5: hook renderHistoryTable
    // =============================================
    function hookRenderHistory() {
        const orig = window.renderHistoryTable;
        if (typeof orig === 'function') {
            window.renderHistoryTable = function () {
                const r = orig.apply(this, arguments);
                setTimeout(() => injectBalanceColumn(), 200);
                return r;
            };
        }
    }

    // =============================================
    // INIT
    // =============================================
    document.addEventListener('DOMContentLoaded', () => {
        injectCSS();
        hookRenderHistory();
        observeHistoryTable();
    });

})();
