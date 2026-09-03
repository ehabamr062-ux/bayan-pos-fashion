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
    // SECTION 2: فلتر البحث برقم الفاتورة/العميل
    // =============================================
    window.applyHistoryInvoiceClientFilter = function (query) {
        if (typeof renderHistoryTable === 'function') {
            renderHistoryTable();
        }
    };

    // =============================================
    // INIT
    // =============================================
    document.addEventListener('DOMContentLoaded', () => {
        injectCSS();
    });

})();
