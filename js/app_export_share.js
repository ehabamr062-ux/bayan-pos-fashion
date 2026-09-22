// ============================================================
//  محرك التصدير والمشاركة PDF و Excel (Export & Sharing Engine)
// ============================================================
        function exportToExcel() {
            if (!transactions || transactions.length === 0) return alert("❌ لا توجد بيانات للتصدير");

            const XLSXLib = (typeof getXLSXLibrary === 'function' ? getXLSXLibrary() : (typeof XLSX !== 'undefined' ? XLSX : null));
            
            const data = transactions.map(row => ({
                "التاريخ": row.date || "-",
                "نوع العملية": row.type || "-",
                "الصنف": row.product || "-",
                "الكمية": row.qty || 0,
                "السعر": row.price || 0,
                "الإجمالي": row.total || 0,
                "العميل / المورد": row.partner || "-"
            }));

            if (XLSXLib && XLSXLib.utils) {
                try {
                    const ws = XLSXLib.utils.json_to_sheet(data);
                    const wb = XLSXLib.utils.book_new();
                    XLSXLib.utils.book_append_sheet(wb, ws, "سجل الحركة");
                    XLSXLib.writeFile(wb, "سجل_الحركات_بيان.xlsx");
                    if (typeof showToast === 'function') showToast("✅ تم تصدير سجل الحركات إلى Excel بنجاح", "success");
                    return;
                } catch(e) {
                    console.warn("XLSX export failed, fallback to UTF-8 CSV:", e);
                }
            }

            // Fallback: UTF-8 BOM CSV
            let csvContent = "\uFEFFالتاريخ,النوع,الصنف,الكمية,السعر,الإجمالي,الطرف الثاني\n";
            transactions.forEach(row => {
                csvContent += `"${row.date || ''}","${row.type || ''}","${row.product || ''}","${row.qty || 0}","${row.price || 0}","${row.total || 0}","${row.partner || ''}"\n`;
            });

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = "سجل_الحركات_بيان.csv";
            link.click();
        }

        // ================= منطق القبض والدفع (Receipt & Change Logic) =================
// ================= نظام التصدير الموحد الاحترافي (PDF & Excel Export Engine) =================

// 1. منشئ ملف PDF الحقيقي بدون فتح نافذة الطباعة (Pure PDF Stream & Blob Builder)
function createPDFBlobFromDataURL(dataURL, width, height) {
    const base64Data = dataURL.split(',')[1];
    const binaryStr = atob(base64Data);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
    }
    
    const pdfWidth = 595.28;
    const pdfHeight = (height / width) * pdfWidth;

    const pdfHeader = `%PDF-1.4\n`;
    const obj1 = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
    const obj2 = `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`;
    const obj3 = `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pdfWidth.toFixed(2)} ${pdfHeight.toFixed(2)}] /Contents 4 0 R /Resources << /XObject << /I1 5 0 R >> >> >>\nendobj\n`;
    
    const contentStream = `q ${pdfWidth.toFixed(2)} 0 0 ${pdfHeight.toFixed(2)} 0 0 cm /I1 Do Q\n`;
    const obj4 = `4 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}endstream\nendobj\n`;
    
    const obj5Head = `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${len} >>\nstream\n`;
    const obj5Tail = `\nendstream\nendobj\n`;

    const encoder = new TextEncoder();
    const hBytes = encoder.encode(pdfHeader + obj1 + obj2 + obj3 + obj4 + obj5Head);
    const tBytes = encoder.encode(obj5Tail);

    const offset1 = pdfHeader.length;
    const offset2 = offset1 + obj1.length;
    const offset3 = offset2 + obj2.length;
    const offset4 = offset3 + obj3.length;
    const offset5 = offset4 + obj4.length;
    const endObj5Pos = offset5 + obj5Head.length + len + obj5Tail.length;

    const xref = `xref\n0 6\n0000000000 65535 f \n${String(offset1).padStart(10, '0')} 00000 n \n${String(offset2).padStart(10, '0')} 00000 n \n${String(offset3).padStart(10, '0')} 00000 n \n${String(offset4).padStart(10, '0')} 00000 n \n${String(offset5).padStart(10, '0')} 00000 n \n`;
    const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${endObj5Pos}\n%%EOF`;
    const trBytes = encoder.encode(xref + trailer);

    return new Blob([hBytes, bytes, tBytes, trBytes], { type: 'application/pdf' });
}
window.createPDFBlobFromDataURL = createPDFBlobFromDataURL;

// 2. دالة تصدير عنصر إلى PDF وتنزيله مباشرة بدون فتح نافذة Print نهائياً (متوافقة 100% مع Electron والويب)
async function exportElementToPDF(elementOrId, fileName) {
    let element = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
    if (!element) {
        element = document.getElementById('receipt-area') || document.getElementById('customInvoiceModal') || document.body;
    }
    
    if (typeof showToast === 'function') showToast("🔄 جاري إنشاء وتنزيل ملف PDF...", "info");

    try {
        const computed = window.getComputedStyle(element);
        const isHidden = (computed.display === 'none' || computed.visibility === 'hidden' || element.offsetWidth === 0);

        const origDisplay = element.style.display;
        const origPos = element.style.position;
        const origLeft = element.style.left;
        const origTop = element.style.top;
        const origZIndex = element.style.zIndex;

        if (isHidden) {
            element.style.display = 'block';
            element.style.position = 'absolute';
            element.style.left = '-9999px';
            element.style.top = '0px';
            element.style.zIndex = '-9999';
        }

        if (typeof html2canvas === 'function') {
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false
            });

            if (isHidden) {
                element.style.display = origDisplay;
                element.style.position = origPos;
                element.style.left = origLeft;
                element.style.top = origTop;
                element.style.zIndex = origZIndex;
            }

            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const pdfBlob = createPDFBlobFromDataURL(imgData, canvas.width, canvas.height);
            
            const url = URL.createObjectURL(pdfBlob);
            const link = document.createElement('a');
            link.href = url;
            const cleanName = (fileName || 'فاتورة').replace(/[\\\/:*?"<>|]/g, '_');
            link.download = cleanName.endsWith('.pdf') ? cleanName : (cleanName + '.pdf');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 4000);
            
            if (typeof showToast === 'function') showToast("✅ تم تصدير وتنزيل ملف PDF بنجاح", "success");
        } else {
            if (isHidden) {
                element.style.display = origDisplay;
                element.style.position = origPos;
                element.style.left = origLeft;
                element.style.top = origTop;
                element.style.zIndex = origZIndex;
            }
            window.print();
        }
    } catch(err) {
        console.error("PDF Export Error:", err);
        window.print();
        if (typeof showToast === 'function') showToast("ℹ️ تم فتح نافذة الطباعة/الحفظ كـ PDF", "info");
    }
}
window.exportElementToPDF = exportElementToPDF;

function getXLSXLibrary() {
    let lib = null;
    if (typeof window !== 'undefined' && window.XLSX && (window.XLSX.utils || window.XLSX.read)) lib = window.XLSX;
    else if (typeof XLSX !== 'undefined' && XLSX && (XLSX.utils || XLSX.read)) lib = XLSX;
    else if (typeof globalThis !== 'undefined' && globalThis.XLSX && (globalThis.XLSX.utils || globalThis.XLSX.read)) lib = globalThis.XLSX;
    else if (typeof self !== 'undefined' && self.XLSX && (self.XLSX.utils || self.XLSX.read)) lib = self.XLSX;
    else if (typeof window !== 'undefined' && window.tempModule && window.tempModule.exports && (window.tempModule.exports.utils || window.tempModule.exports.read)) lib = window.tempModule.exports;

    if (!lib && typeof require === 'function') {
        try {
            const path = require('path');
            const xlsxPath = path.join(__dirname, '..', 'lib', 'xlsx.full.min.js');
            const _reqXLSX = require(xlsxPath);
            if (_reqXLSX && (_reqXLSX.utils || _reqXLSX.read)) lib = _reqXLSX;
        } catch(e) {}
        if (!lib) {
            try {
                const _reqNodeXLSX = require('xlsx');
                if (_reqNodeXLSX && (_reqNodeXLSX.utils || _reqNodeXLSX.read)) lib = _reqNodeXLSX;
            } catch(e) {}
        }
    }

    if (lib && typeof window !== 'undefined') {
        window.XLSX = lib;
    }
    return lib;
}
window.getXLSXLibrary = getXLSXLibrary;

// دالة المحرك المباشر الحصين لتصدير المصفوفات كملفات Excel/CSV محصنة بـ UTF-8 BOM
function downloadAOAAsExcelCSV(aoaData, fileName) {
    if (!Array.isArray(aoaData) || aoaData.length === 0) return;
    let csvContent = "\uFEFF";
    aoaData.forEach(row => {
        let rowStr = row.map(val => {
            if (val === null || val === undefined) return '""';
            let str = String(val).replace(/"/g, '""');
            return `"${str}"`;
        }).join(',');
        csvContent += rowStr + "\r\n";
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const cleanName = (fileName || 'تقرير').replace(/[\\\/:*?"<>|]/g, '_');
    link.download = cleanName.endsWith('.csv') || cleanName.endsWith('.xlsx') ? cleanName : (cleanName + '.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    if (typeof showToast === 'function') showToast("✅ تم تصدير التقرير بنجاح", "success");
}
window.downloadAOAAsExcelCSV = downloadAOAAsExcelCSV;

// =========================================================================
// 🛡️ منظومة الفحص والتحقق الصارم من اكتمال البيانات قبل التصدير والمشاركة
// =========================================================================
function validateDocumentData(type, actionType = 'التصدير') {
    let isValid = true;
    let errorMsg = "";

    if (type === 'receipt') {
        const amount = parseFloat(document.getElementById('receiptAmount')?.value) || 0;
        const customer = (document.getElementById('receiptCustomer')?.value || '').trim();
        const isCustEmpty = (!customer || customer === 'غير محدد' || customer === 'عميل نقدي' || customer === 'عميل');

        if (amount <= 0 && isCustEmpty) {
            isValid = false;
            errorMsg = `⚠️ لا يمكن ${actionType}: يرجى كتابة اسم العميل وإدخال مبلغ سند القبض أولاً!`;
        } else if (amount <= 0) {
            isValid = false;
            errorMsg = `⚠️ لا يمكن ${actionType}: يرجى إدخال مبلغ صحيح لسند القبض أولاً!`;
        } else if (isCustEmpty) {
            isValid = false;
            errorMsg = `⚠️ لا يمكن ${actionType}: يرجى كتابة وتحديد اسم العميل أولاً للسند!`;
        }
    } else if (type === 'disbursement') {
        const amount = parseFloat(document.getElementById('disburseAmount')?.value) || 0;
        const payee = (document.getElementById('disbursePayee')?.value || '').trim();
        const isPayeeEmpty = (!payee || payee === 'غير محدد' || payee === 'مورد نقدي' || payee === 'جهة');

        if (amount <= 0 && isPayeeEmpty) {
            isValid = false;
            errorMsg = `⚠️ لا يمكن ${actionType}: يرجى كتابة اسم المستلم/المورد وإدخال مبلغ سند الصرف أولاً!`;
        } else if (amount <= 0) {
            isValid = false;
            errorMsg = `⚠️ لا يمكن ${actionType}: يرجى إدخال مبلغ صحيح لسند الصرف أولاً!`;
        } else if (isPayeeEmpty) {
            isValid = false;
            errorMsg = `⚠️ لا يمكن ${actionType}: يرجى كتابة اسم المستلم / المورد أولاً للسند!`;
        }
    } else if (type === 'dailyReport') {
        const fromD = document.getElementById('reportDateFrom')?.value || new Date().toLocaleDateString('en-CA');
        const toD = document.getElementById('reportDateTo')?.value || new Date().toLocaleDateString('en-CA');

        const periodTxs = (typeof transactions !== 'undefined' && Array.isArray(transactions))
            ? transactions.filter(t => t.dateISO && t.dateISO >= fromD && t.dateISO <= toD)
            : [];

        const repData = window.dailyReportData || {};
        const totalSales = parseFloat(repData.totalSales || 0);
        const totalPurchases = parseFloat(repData.totalPurchases || 0);
        const totalReceipts = parseFloat(repData.totalReceipts || 0);
        const totalExpenses = parseFloat(repData.totalExpenses || 0);
        const grossProfit = parseFloat(repData.grossProfit || 0);
        const netProfit = parseFloat(repData.netProfit || 0);

        const hasDomTotals = (
            (document.getElementById('dailyTotalSales')?.innerText && parseFloat(document.getElementById('dailyTotalSales').innerText) > 0) ||
            (document.getElementById('dailyTotalPurchases')?.innerText && parseFloat(document.getElementById('dailyTotalPurchases').innerText) > 0) ||
            (document.getElementById('dailyTotalReceipts')?.innerText && parseFloat(document.getElementById('dailyTotalReceipts').innerText) > 0) ||
            (document.getElementById('dailyTotalExpenses')?.innerText && parseFloat(document.getElementById('dailyTotalExpenses').innerText) > 0)
        );

        const hasAnyActivity = (periodTxs.length > 0 || totalSales > 0 || totalPurchases > 0 || totalReceipts > 0 || totalExpenses > 0 || grossProfit !== 0 || netProfit !== 0 || hasDomTotals);

        if (!hasAnyActivity) {
            isValid = false;
            errorMsg = `⚠️ لا يمكن ${actionType}: لا توجد أي حركات أو معاملات مالية مسجلة في هذا اليوم لتصديرها!`;
        }
    } else if (type === 'sales') {
        const hasCart = (typeof window.cart !== 'undefined' && Array.isArray(window.cart) && window.cart.length > 0);
        if (!hasCart) {
            isValid = false;
            errorMsg = `⚠️ لا يمكن ${actionType}: سلة المبيعات فارغة! يرجى إضافة أصناف أولاً.`;
        }
    } else if (type === 'purchase') {
        const hasPurCart = (typeof window.purchaseCart !== 'undefined' && Array.isArray(window.purchaseCart) && window.purchaseCart.length > 0);
        if (!hasPurCart) {
            isValid = false;
            errorMsg = `⚠️ لا يمكن ${actionType}: فاتورة المشتريات فارغة! يرجى إضافة أصناف أولاً.`;
        }
    } else if (type === 'salesReturn') {
        const hasRetCart = ((typeof window.salesReturnCart !== 'undefined' && Array.isArray(window.salesReturnCart) && window.salesReturnCart.length > 0) ||
                            (typeof window.returnCart !== 'undefined' && Array.isArray(window.returnCart) && window.returnCart.length > 0));
        if (!hasRetCart) {
            isValid = false;
            errorMsg = `⚠️ لا يمكن ${actionType}: سلة مرتجع المبيعات فارغة! يرجى اختيار أصناف للمرتجع أولاً.`;
        }
    } else if (type === 'purchaseReturn') {
        const hasPurRetCart = ((typeof window.purchaseReturnCart !== 'undefined' && Array.isArray(window.purchaseReturnCart) && window.purchaseReturnCart.length > 0) ||
                               (typeof window.purReturnCart !== 'undefined' && Array.isArray(window.purReturnCart) && window.purReturnCart.length > 0));
        if (!hasPurRetCart) {
            isValid = false;
            errorMsg = `⚠️ لا يمكن ${actionType}: سلة مرتجع المشتريات فارغة! يرجى اختيار أصناف للمرتجع أولاً.`;
        }
    } else if (type === 'adjustment') {
        const adjTable = document.getElementById('adjustmentTableBody');
        const hasRows = adjTable && adjTable.children && adjTable.children.length > 0 && !adjTable.innerText.includes('لا توجد أصناف');
        if (!hasRows) {
            isValid = false;
            errorMsg = `⚠️ لا يمكن ${actionType}: جدول التسوية المخزنية فارغ! لا توجد أصناف للتصدير.`;
        }
    }

    if (!isValid) {
        document.querySelectorAll('.share-menu').forEach(m => m.classList.remove('active'));
        if (typeof showToast === 'function') showToast(errorMsg, "warning");
        else alert(errorMsg);
        return false;
    }
    return true;
}
window.validateDocumentData = validateDocumentData;

// دالة استخراج اسم الطرف/العميل/المورد بحسب نوع المستند
function getPartnerNameForType(type) {
    if (type === 'sales') {
        return (document.getElementById('customerName')?.value || '').trim();
    } else if (type === 'purchase') {
        return (document.getElementById('supplierName')?.value || '').trim();
    } else if (type === 'receipt') {
        return (document.getElementById('receiptCustomer')?.value || '').trim();
    } else if (type === 'disbursement') {
        return (document.getElementById('disbursePayee')?.value || '').trim();
    } else if (type === 'salesReturn') {
        return (document.getElementById('salesReturnPartnerDisplay')?.innerText || '').trim();
    } else if (type === 'purchaseReturn') {
        return (document.getElementById('purReturnPartnerDisplay')?.innerText || '').trim();
    }
    return '';
}
window.getPartnerNameForType = getPartnerNameForType;

// دالة جلب رقم هاتف الطرف من سجل الحسابات العامة (accounts)
function getPartnerPhone(partnerName) {
    if (!partnerName || typeof partnerName !== 'string') return '';
    const clean = (s) => (s || '').trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/[ىي]/g, 'ي').replace(/\s+/g, ' ');
    const searchClean = clean(partnerName);
    if (!searchClean || ['عميل نقدي', 'نقدي', 'مورد', 'عميل', 'جهة', '---'].includes(searchClean)) {
        return '';
    }

    const accList = (typeof accounts !== 'undefined' && Array.isArray(accounts)) ? accounts : ((typeof window.accounts !== 'undefined' && Array.isArray(window.accounts)) ? window.accounts : []);

    if (accList && accList.length > 0) {
        const found = accList.find(a => a && a.name && (a.name.trim() === partnerName.trim() || clean(a.name) === searchClean));
        if (found) {
            const raw = found.mobile || found.phone || found.landline || '';
            if (raw) return String(raw).trim();
        }
    }
    return '';
}
window.getPartnerPhone = getPartnerPhone;

// دالة تنظيف وتنسيق رقم الهاتف ليتوافق مع رابط الواتساب الدولي
function formatPhoneForWhatsApp(phone) {
    if (!phone) return '';
    let digits = String(phone).replace(/[^0-9]/g, '');
    if (!digits) return '';

    if (digits.startsWith('00')) {
        digits = digits.substring(2);
    }
    // أرقام المحمول المصرية (010, 011, 012, 015) المكونة من 11 رقماً
    if (digits.length === 11 && digits.startsWith('01')) {
        digits = '2' + digits;
    } else if (digits.length === 10 && (digits.startsWith('10') || digits.startsWith('11') || digits.startsWith('12') || digits.startsWith('15'))) {
        digits = '20' + digits;
    }
    return digits;
}
window.formatPhoneForWhatsApp = formatPhoneForWhatsApp;

// دالة التعبئة التلقائية لرقم هاتف العميل واسمه عند فتح أي من قوائم المشاركة
function autoFillSharePhone(menuId) {
    const menuToType = {
        'salesInvoiceShareMenu': 'sales',
        'salesShareMenu': 'salesReturn',
        'purchaseInvoiceShareMenu': 'purchase',
        'purShareMenu': 'purchaseReturn',
        'receiptShareMenu': 'receipt',
        'disburseShareMenu': 'disbursement'
    };
    const type = menuToType[menuId];
    if (!type) return;

    const phoneInput = document.getElementById('waSharePhone_' + type);
    const partnerInfo = document.getElementById('waSharePartnerInfo_' + type);

    const partnerName = getPartnerNameForType(type);
    if (partnerInfo) {
        if (partnerName && !['عميل نقدي', 'نقدي', 'مورد', 'عميل', 'جهة', '---'].includes(partnerName)) {
            partnerInfo.innerText = `الطرف: ${partnerName}`;
            partnerInfo.title = partnerName;
        } else {
            partnerInfo.innerText = '';
        }
    }

    if (phoneInput) {
        const phone = getPartnerPhone(partnerName);
        phoneInput.value = phone || '';
        setTimeout(() => {
            if (phoneInput && !phoneInput.value) {
                try { phoneInput.focus(); } catch (e) {}
            }
        }, 120);
    }
}
window.autoFillSharePhone = autoFillSharePhone;

// دالة مشاركة الفاتورة أو السند كصورة عالية الدقة عبر الواتساب مع النسخ للحافظة والتنزيل المباشر
async function shareTransactionWithImage(type, targetPhone) {
    const platformLabel = 'المشاركة عبر الواتساب';
    if (typeof validateDocumentData === 'function' && !validateDocumentData(type, platformLabel)) {
        return;
    }

    // إغلاق أي قوائم مشاركة مفتوحة
    document.querySelectorAll('.share-menu').forEach(m => m.classList.remove('active'));

    // استخراج رقم الهاتف من الحقل أو من بيانات الطرف
    let phone = (targetPhone || '').trim();
    if (!phone) {
        const phoneInput = document.getElementById('waSharePhone_' + type);
        if (phoneInput && phoneInput.value.trim()) {
            phone = phoneInput.value.trim();
        }
    }
    if (!phone) {
        const pName = getPartnerNameForType(type);
        phone = getPartnerPhone(pName);
    }
    const cleanPhone = formatPhoneForWhatsApp(phone);

    // تفعيل حالة التحميل على زر الصورة لمنع تكرار النقر وإعلام الكاشير
    const imgBtn = document.getElementById('btnShareWaImage_' + type);
    const origBtnHTML = imgBtn ? imgBtn.innerHTML : '';
    if (imgBtn) {
        imgBtn.disabled = true;
        imgBtn.innerHTML = '<span class="wa-spin">⏳</span> جاري التجهيز...';
    }

    if (typeof showToast === 'function') {
        showToast("🎨 جاري تجهيز صورة الفاتورة للواتساب...", "info");
    }

    try {
        // 1. تجهيز قالب الفاتورة/السند الفعلي
        if (typeof prepareBillHTML === 'function') {
            prepareBillHTML(type);
        }
        const receiptArea = document.getElementById('receipt-area');
        if (!receiptArea || !receiptArea.children.length) {
            throw new Error("تعذر تجهيز قالب الفاتورة للطباعة");
        }

        // 2. إعداد الحفظ المؤقت للتنسيق للرسم بجودة فائقة
        const origDisplay = receiptArea.style.display;
        const origPos = receiptArea.style.position;
        const origLeft = receiptArea.style.left;
        const origTop = receiptArea.style.top;
        const origZIndex = receiptArea.style.zIndex;
        const origWidth = receiptArea.style.width;
        const origBackground = receiptArea.style.background;

        let targetRenderWidth = '340px';
        try {
            const savedSettings = JSON.parse(getStore('bayan_print_template_choice') || '{}');
            const templateChoice = savedSettings.template || '80mm Standard';
            if (templateChoice === 'A4 Professional' || templateChoice === 'A4') targetRenderWidth = '794px';
            else if (templateChoice === 'A5 Modern' || templateChoice === 'A5') targetRenderWidth = '560px';
            else if (templateChoice === '57mm Mobile' || templateChoice === '57mm') targetRenderWidth = '240px';
            else targetRenderWidth = '340px';
        } catch (_) {}

        receiptArea.style.display = 'block';
        receiptArea.style.position = 'fixed';
        receiptArea.style.left = '-9999px';
        receiptArea.style.top = '0px';
        receiptArea.style.zIndex = '-99999';
        receiptArea.style.width = (type === 'sales' ? targetRenderWidth : '680px');
        receiptArea.style.background = '#ffffff';

        let canvas;
        try {
            if (typeof html2canvas !== 'function') {
                throw new Error("مكتبة تحويل الصور html2canvas غير محملة");
            }
            // إزالة windowWidth الثابتة لتفادي بطء محاكاة الشاشات الكبيرة ولتسريع المعالجة إلى أقل من ثانية واحدة
            canvas = await html2canvas(receiptArea, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false
            });
        } finally {
            receiptArea.style.display = origDisplay;
            receiptArea.style.position = origPos;
            receiptArea.style.left = origLeft;
            receiptArea.style.top = origTop;
            receiptArea.style.zIndex = origZIndex;
            receiptArea.style.width = origWidth;
            receiptArea.style.background = origBackground;
        }

        if (!canvas) throw new Error("تعذر إنشاء صورة الفاتورة");

        const imgData = canvas.toDataURL('image/png');

        // 3. نسخ الصورة إلى الحافظة (Clipboard) لتكون جاهزة للصق المباشر (Ctrl + V)
        let copied = false;
        try {
            if (typeof require !== 'undefined') {
                const { clipboard, nativeImage } = require('electron');
                if (clipboard && nativeImage) {
                    const image = nativeImage.createFromDataURL(imgData);
                    clipboard.writeImage(image);
                    copied = true;
                }
            }
        } catch (e) {
            console.warn("Electron clipboard writeImage error:", e);
        }

        if (!copied && navigator.clipboard && typeof ClipboardItem !== 'undefined') {
            try {
                if (typeof window.focus === 'function') {
                    try { window.focus(); } catch (_) {}
                }
                const blob = await new Promise((resolve) => {
                    canvas.toBlob((b) => resolve(b), 'image/png');
                });
                if (blob) {
                    try {
                        await navigator.clipboard.write([
                            new ClipboardItem({ 'image/png': blob })
                        ]);
                        copied = true;
                    } catch (clipErr) {
                        console.info("ملاحظة: تعذر النسخ المباشر للحافظة عبر المتصفح، تم توفير الصورة عبر التنزيل التلقائي.");
                    }
                }
            } catch (err) {
                console.info("ملاحظة تحويل الصورة للحافظة:", err.message || err);
            }
        }

        // 4. تنزيل الصورة محلياً فقط كإجراء احتياطي إذا فشل النسخ للحافظة
        let fileName = "فاتورة";
        let docTitle = "فاتورة";
        let docNo = "---";
        if (type === 'sales') {
            const p = document.getElementById('customerName')?.value || 'عميل';
            docNo = document.getElementById('salesInvoiceNo')?.value || document.getElementById('salesBadgeID')?.innerText || '---';
            fileName = `فاتورة_مبيعات_${p}_${docNo}`;
            docTitle = "📄 فاتورة مبيعات";
        } else if (type === 'purchase') {
            const p = document.getElementById('supplierName')?.value || 'مورد';
            docNo = document.getElementById('purchaseInvoiceNo')?.value || document.getElementById('purBadgeID')?.innerText || '---';
            fileName = `فاتورة_مشتريات_${p}_${docNo}`;
            docTitle = "📦 فاتورة مشتريات";
        } else if (type === 'salesReturn') {
            const p = document.getElementById('salesReturnPartnerDisplay')?.innerText || 'عميل';
            docNo = document.getElementById('salesReturnBadgeID')?.innerText || '---';
            fileName = `مرتجع_مبيعات_${p}_${docNo}`;
            docTitle = "🔄 مرتجع مبيعات";
        } else if (type === 'purchaseReturn') {
            const p = document.getElementById('purReturnPartnerDisplay')?.innerText || 'مورد';
            docNo = document.getElementById('purReturnBadgeID')?.innerText || '---';
            fileName = `مرتجع_مشتريات_${p}_${docNo}`;
            docTitle = "🔄 مرتجع مشتريات";
        } else if (type === 'receipt') {
            const p = document.getElementById('receiptCustomer')?.value || 'عميل';
            docNo = document.getElementById('receiptID')?.value || '---';
            fileName = `سند_قبض_${p}_${docNo}`;
            docTitle = "💵 سند قبض";
        } else if (type === 'disbursement') {
            const p = document.getElementById('disbursePayee')?.value || 'جهة';
            docNo = document.getElementById('disburseID')?.value || '---';
            fileName = `سند_صرف_${p}_${docNo}`;
            docTitle = "💸 سند صرف";
        }

        // تنزيل الصورة كملف فقط في حال تعذر النسخ للحافظة (لتجنب تراكم الملفات عند نجاح النسخ المباشر)
        if (!copied) {
            try {
                const cleanFileName = (fileName || 'فاتورة').replace(/[\\\/:*?"<>|]/g, '_') + '.png';
                const link = document.createElement('a');
                link.href = imgData;
                link.download = cleanFileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } catch (downloadErr) {
                console.warn("Auto-download error:", downloadErr);
            }
        }

        const shopName = (typeof getMerchantStoreName === 'function' ? getMerchantStoreName() : (document.getElementById('shopName')?.value || 'بَيَان POS'));
        const partnerName = getPartnerNameForType(type) || 'عميلنا العزيز';
        
        let invoiceSummary = '';
        if (type === 'sales' && typeof cart !== 'undefined' && cart.length > 0) {
            const tot = (typeof currentTotal !== 'undefined' ? currentTotal : 0).toFixed(2);
            invoiceSummary = `\n💰 الإجمالي: *${tot} ج.م*` +
                             `\n📋 عدد الأصناف: *${cart.length}*`;
        }

        const greeting = `مرحباً بك *${partnerName}* ✨\nمن: *${shopName}*\nمرفق لسيادتكم (${docTitle}) رقم: *#${docNo}*${invoiceSummary}\n\nشكراً لتعاملكم الراقي معنا! 🙏`;
        const encodedText = encodeURIComponent(greeting);

        let waUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodedText}` : `https://wa.me/?text=${encodedText}`;

        window.open(waUrl, '_blank');

        if (copied) {
            // فتح نافذة المساعد الفورية لتوضيح زرار Ctrl + V للكاشير بشكل لافت وبديهي
            showWhatsAppPasteHelperModal();
            if (typeof showToast === 'function') {
                showToast("📋 تم تجهيز الفاتورة ونسخها للحافظة بنجاح! اضغط (Ctrl + V) في واتساب لإرسالها فوراً 🚀", "success");
            }
        } else {
            if (typeof showToast === 'function') {
                showToast("📥 تم تجهيز الفاتورة بتصميم الطباعة وتنزيلها لجهازك! يمكنك إرفاقها في واتساب 🚀", "success");
            }
        }
    } catch (err) {
        console.error("WhatsApp Image Share Error:", err);
        if (typeof showToast === 'function') {
            showToast("❌ حدث خطأ أثناء تجهيز الصورة: " + err.message, "error");
        }
    } finally {
        if (imgBtn) {
            imgBtn.disabled = false;
            imgBtn.innerHTML = origBtnHTML;
        }
    }
}
window.shareTransactionWithImage = shareTransactionWithImage;

// نافذة التوضيح للكاشير لاختصار اللصق Ctrl + V
function showWhatsAppPasteHelperModal() {
    let modal = document.getElementById('waPasteModal');
    if (modal) {
        modal.style.display = 'flex';
        const handleKey = (e) => {
            if (e.key === 'Enter' || e.key === 'Escape') {
                closeWhatsAppPasteHelperModal();
                window.removeEventListener('keydown', handleKey);
            }
        };
        window.addEventListener('keydown', handleKey);
        modal.onclick = (e) => {
            if (e.target === modal) {
                closeWhatsAppPasteHelperModal();
                window.removeEventListener('keydown', handleKey);
            }
        };
    }
}
window.showWhatsAppPasteHelperModal = showWhatsAppPasteHelperModal;

function closeWhatsAppPasteHelperModal() {
    const modal = document.getElementById('waPasteModal');
    if (modal) {
        modal.style.display = 'none';
    }
}
window.closeWhatsAppPasteHelperModal = closeWhatsAppPasteHelperModal;

// منشئ الرسائل النصية المباشرة المنسقة للواتساب
function buildWhatsAppTextMessage(type) {
    const shopName = (typeof getMerchantStoreName === 'function' ? getMerchantStoreName() : (document.getElementById('shopName')?.value || 'بَيَان POS'));
    const nowStr = (typeof getTransactionDateTime === 'function' ? getTransactionDateTime('salesDate', 'salesTime').full : new Date().toLocaleString('ar-EG'));
    
    let header = `✨ *${shopName}* ✨\n`;
    let body = "";
    
    if (type === 'sales') {
        const partner = document.getElementById('customerName')?.value || 'عميل نقدي';
        const invNo = document.getElementById('salesInvoiceNo')?.value || document.getElementById('salesBadgeID')?.innerText || '---';
        const grandTotal = (typeof currentTotal !== 'undefined' ? currentTotal : 0).toFixed(2);
        const method = (typeof getSelectedPaymentMethod === 'function' ? getSelectedPaymentMethod('sales-section') : (document.getElementById('salesPaymentMethod')?.value || 'نقدي'));
        const disc = parseFloat(document.getElementById('salesDiscount')?.value) || 0;
        const tax = parseFloat(document.getElementById('salesTax')?.value) || 0;

        header += `📄 *فاتورة مبيعات* #${invNo}\n👤 العميل: *${partner}*\n📅 التاريخ: ${nowStr}\n`;
        
        if (typeof cart !== 'undefined' && cart.length > 0) {
            body += `\n📋 *تفاصيل الأصناف:*\n`;
            cart.forEach((item, idx) => {
                const q = parseFloat(item.qty) || 1;
                const p = parseFloat(item.price) || 0;
                const tot = (q * p).toFixed(2);
                let unitStr = item.selectedUnit ? (typeof item.selectedUnit === 'object' ? item.selectedUnit.unitName : item.selectedUnit) : (item.unit || '');
                if (unitStr) unitStr = ` (${unitStr})`;
                body += `${idx + 1}. *${item.name}*${unitStr}\n   ▫️ الكمية: ${q} × السعر: ${p.toFixed(2)} = *${tot} ج.م*\n`;
            });
        }
        
        body += `\n💰 *الإجمالي النهائي: ${grandTotal} ج.م*`;
        if (disc > 0) body += `\n🏷️ الخصم: ${disc.toFixed(2)} ج.م`;
        if (tax > 0) body += `\n🧾 الضريبة: ${tax.toFixed(2)} ج.م`;
        body += `\n💳 طريقة الدفع: ${method}`;
        
    } else if (type === 'purchase') {
        const partner = document.getElementById('supplierName')?.value || 'مورد';
        const invNo = document.getElementById('purchaseInvoiceNo')?.value || document.getElementById('purBadgeID')?.innerText || '---';
        const items = (typeof purchaseCart !== 'undefined' && Array.isArray(purchaseCart)) ? purchaseCart : [];
        const grandTotal = items.reduce((sum, it) => sum + ((parseFloat(it.qty) || 1) * (parseFloat(it.cost) || 0)), 0).toFixed(2);
        
        header += `📦 *فاتورة مشتريات* #${invNo}\n👤 المورد: *${partner}*\n📅 التاريخ: ${nowStr}\n`;
        if (items.length > 0) {
            body += `\n📋 *الأصناف:*\n`;
            items.forEach((item, idx) => {
                const q = parseFloat(item.qty) || 1;
                const c = parseFloat(item.cost) || 0;
                body += `${idx + 1}. *${item.name}* (الكمية: ${q} × ${c.toFixed(2)}) = *${(q * c).toFixed(2)} ج.م*\n`;
            });
        }
        body += `\n💰 *الإجمالي النهائي: ${grandTotal} ج.م*`;
        
    } else if (type === 'salesReturn') {
        const partner = document.getElementById('salesReturnPartnerDisplay')?.innerText || 'عميل';
        const docNo = document.getElementById('salesReturnBadgeID')?.innerText || '---';
        const total = document.getElementById('salesReturnTotalDisplay')?.innerText || '0.00';
        header += `🔄 *مرتجع مبيعات* #${docNo}\n👤 الطرف: *${partner}*\n📅 التاريخ: ${nowStr}\n`;
        body += `\n💰 *إجمالي المرتجع: ${total} ج.م*`;
        
    } else if (type === 'purchaseReturn') {
        const partner = document.getElementById('purReturnPartnerDisplay')?.innerText || 'مورد';
        const docNo = document.getElementById('purReturnBadgeID')?.innerText || '---';
        const total = document.getElementById('purReturnTotalDisplay')?.innerText || '0.00';
        header += `🔄 *مرتجع مشتريات* #${docNo}\n👤 الطرف: *${partner}*\n📅 التاريخ: ${nowStr}\n`;
        body += `\n💰 *إجمالي المرتجع: ${total} ج.م*`;
        
    } else if (type === 'receipt') {
        const partner = document.getElementById('receiptCustomer')?.value || 'عميل';
        const docNo = document.getElementById('receiptID')?.value || '---';
        const amount = document.getElementById('receiptAmount')?.value || '0.00';
        const notes = document.getElementById('receiptNotes')?.value || '';
        header += `💵 *سند قبض نقدية* #${docNo}\n👤 المستلم منه: *${partner}*\n📅 التاريخ: ${nowStr}\n`;
        body += `\n💰 *المبلغ المقبوض: ${amount} ج.م*`;
        if (notes) body += `\n📝 البيان / الملاحظات: ${notes}`;
        
    } else if (type === 'disbursement') {
        const partner = document.getElementById('disbursePayee')?.value || 'جهة';
        const docNo = document.getElementById('disburseID')?.value || '---';
        const amount = document.getElementById('disburseAmount')?.value || '0.00';
        const notes = document.getElementById('disburseNotes')?.value || '';
        header += `💸 *سند صرف نقدية* #${docNo}\n👤 يصرف لسيادة: *${partner}*\n📅 التاريخ: ${nowStr}\n`;
        body += `\n💰 *المبلغ المنصرف: ${amount} ج.م*`;
        if (notes) body += `\n📝 البيان / الملاحظات: ${notes}`;
    }
    
    const footer = `\n\n🙏 *شكراً لتعاملكم الراقي معنا!*`;
    return header + body + footer;
}
window.buildWhatsAppTextMessage = buildWhatsAppTextMessage;

// 2.6 دالة مشاركة الفواتير والمستندات عبر الواتساب والتليجرام (تدعم إرسال الصورة وإرسال النص المباشر)
async function shareTransaction(type, platform) {
    if (type === 'dailyReport' && typeof isDailyReportAmountsProtected === 'function' && isDailyReportAmountsProtected()) {
        if (typeof window.verifyAdminPinAuthorization === 'function') {
            const ok = await window.verifyAdminPinAuthorization('📤 مشاركة تقرير الحركة اليومية', 'يتطلب مشاركة بيانات تقرير الحركة اليومية إدخال رمز PIN المدير.');
            if (!ok) return;
        } else {
            if (typeof showToast === 'function') showToast('🔒 المبالغ المالية محمية ولا يمكن مشاركتها بدون إذن المدير', 'error');
            return;
        }
    }

    const platformLabel = (platform === 'wa_image' || platform === 'wa' || platform === 'whatsapp' || platform === 'wa_text') 
        ? 'المشاركة عبر الواتساب' 
        : 'المشاركة عبر التلجرام';
        
    if (typeof validateDocumentData === 'function' && !validateDocumentData(type, platformLabel)) {
        return;
    }

    // 1. خيار إرسال صورة الفاتورة (نسخ ولصق بتصميم الطباعة الحقيقي)
    if (platform === 'wa_image' || (platform === 'wa' && type !== 'dailyReport') || (platform === 'whatsapp' && type !== 'dailyReport')) {
        shareTransactionWithImage(type);
        return;
    }

    // 2. خيار الإرسال النصي المباشر السريع للواتساب (بدون الحاجة لنسخ أو لصق أو كيبورد)
    if (platform === 'wa_text') {
        let phone = '';
        const phoneInput = document.getElementById('waSharePhone_' + type);
        if (phoneInput && phoneInput.value.trim()) {
            phone = phoneInput.value.trim();
        }
        if (!phone) {
            const pName = getPartnerNameForType(type);
            phone = getPartnerPhone(pName);
        }
        const cleanPhone = formatPhoneForWhatsApp(phone);
        
        const message = buildWhatsAppTextMessage(type);
        const encodedText = encodeURIComponent(message);
        const shareUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodedText}` : `https://wa.me/?text=${encodedText}`;
        
        document.querySelectorAll('.share-menu').forEach(m => m.classList.remove('active'));
        if (typeof showToast === 'function') {
            showToast("💬 جاري فتح محادثة الواتساب مع الفاتورة النصية جاهزة للإرسال فوراً! 🚀", "success");
        }
        window.open(shareUrl, '_blank');
        return;
    }

    // 3. مشاركة التقرير اليومي الشامل أو التلجرام
    let title = "مشاركة مستند";
    let invNo = "---";
    let partnerName = "---";
    let grandTotal = "0.00";
    let itemsText = "";

    if (type === 'dailyReport') {
        title = "📊 تقرير الحركة اليومية الشامل";
        partnerName = "تقرير تقفيل اليومية";
        
        const fromD = document.getElementById('reportDateFrom')?.value || new Date().toLocaleDateString('en-CA');
        const toD = document.getElementById('reportDateTo')?.value || new Date().toLocaleDateString('en-CA');
        
        const whSelect = document.getElementById('dailyReportWarehouseSelect');
        const selectedWh = (whSelect && whSelect.value !== 'all') ? whSelect.value : ((window.dailyReportData && window.dailyReportData.selectedWarehouse !== 'all') ? window.dailyReportData.selectedWarehouse : '');
        const whText = selectedWh ? `🏢 المخزن: ${selectedWh}\n` : '';

        const trSelect = document.getElementById('dailyReportTreasurySelect');
        const selectedTr = (trSelect && trSelect.value !== 'all') ? trSelect.value : ((window.dailyReportData && window.dailyReportData.selectedTreasury !== 'all') ? window.dailyReportData.selectedTreasury : '');
        const trText = selectedTr ? `💰 الخزينة / وسيلة الدفع: ${selectedTr}\n` : '';

        const repData = window.dailyReportData || {};
        const netProfit = repData.netProfit !== undefined ? repData.netProfit.toFixed(2) : (document.getElementById('dailyNetProfit')?.innerText || '0.00');
        const totalSales = repData.totalSales !== undefined ? repData.totalSales.toFixed(2) : (document.getElementById('dailyTotalSales')?.innerText || '0.00');
        const totalPurchases = repData.totalPurchases !== undefined ? repData.totalPurchases.toFixed(2) : (document.getElementById('dailyTotalPurchases')?.innerText || '0.00');
        const totalExpenses = repData.totalExpenses !== undefined ? repData.totalExpenses.toFixed(2) : (document.getElementById('dailyTotalExpenses')?.innerText || '0.00');
        const totalReceipts = repData.totalReceipts !== undefined ? repData.totalReceipts.toFixed(2) : (document.getElementById('dailyTotalReceipts')?.innerText || '0.00');
        const grossProfit = repData.grossProfit !== undefined ? repData.grossProfit.toFixed(2) : (document.getElementById('dailyGrossProfit')?.innerText || '0.00');

        const canViewProfits = (typeof hasPermission === 'function') ? hasPermission('general_profits') : true;
        grandTotal = canViewProfits ? netProfit : totalSales;
        itemsText = `\n📅 الفترة: من ${fromD} إلى ${toD}\n` +
                    whText +
                    trText +
                    `🛍️ إجمالي المبيعات: ${totalSales} ج.م\n` +
                    (repData.totalSalesCash !== undefined ? `  💵 منها كاش الدرج: ${repData.totalSalesCash.toFixed(2)} ج.م\n` : '') +
                    (repData.vodafoneCashTotal !== undefined && (repData.vodafoneCashTotal !== 0 || (repData.vodafoneCashSales && repData.vodafoneCashSales > 0)) ? `  📱 فودافون كاش (صافي): ${repData.vodafoneCashTotal.toFixed(2)} ج.م\n` : '') +
                    (repData.totalSalesNonCash && repData.totalSalesNonCash > 0 ? `  💳 باقي المحافظ والشبكة: ${(repData.totalSalesNonCash - (repData.vodafoneCashSales || 0)).toFixed(2)} ج.م\n` : '') +
                    `📦 إجمالي المشتريات: ${totalPurchases} ج.م\n` +
                    `💵 المقبوضات المالية: ${totalReceipts} ج.م\n` +
                    `💸 المصروفات / السندات: ${totalExpenses} ج.م\n` +
                    (repData.finalCashBalance !== undefined ? `💰 الرصيد النهائي بالدرج: ${repData.finalCashBalance.toFixed(2)} ج.م\n` : '') +
                    (canViewProfits ? (`📈 مجمل الربح: ${grossProfit} ج.م\n🎯 صافي الربح النهائي: ${netProfit} ج.م`) : '');
    }

    const shopName = document.getElementById('shopName')?.value || 'بَيَان POS';
    let message = "";
    if (type === 'dailyReport') {
        message = `✨ *${shopName}* ✨\n${title}${itemsText}\n\nتاريخ الاستخراج: ${new Date().toLocaleDateString('ar-EG')}\nتم الاستخراج بواسطة برنامج بَيَان 🚀`;
    } else {
        message = buildWhatsAppTextMessage(type);
    }

    const encodedText = encodeURIComponent(message);
    let shareUrl = "";

    if (platform === 'wa' || platform === 'whatsapp') {
        shareUrl = `https://wa.me/?text=${encodedText}`;
    } else if (platform === 'tg' || platform === 'telegram') {
        shareUrl = `https://t.me/share/url?url=${encodedText}`;
    }

    document.querySelectorAll('.share-menu').forEach(m => m.classList.remove('active'));

    if (shareUrl) {
        if (typeof showToast === 'function') {
            showToast("📱 جاري فتح نافذة المشاركة...", "info");
        }
        window.open(shareUrl, '_blank');
    }
}
window.shareTransaction = shareTransaction;

// 3. دالة تصدير بيانات الفاتورة والمستندات إلى ملف Excel غني يشمل كافة الحقول والبيانات المطلوبة
function exportInvoiceDataToExcel(type, fileName, customItems) {
    if (typeof validateDocumentData === 'function' && !validateDocumentData(type, 'تصدير ملف إكسل')) {
        return false;
    }
    const XLSXLib = (typeof getXLSXLibrary === 'function' ? getXLSXLibrary() : (typeof XLSX !== 'undefined' ? XLSX : (typeof window.XLSX !== 'undefined' ? window.XLSX : null)));

    const currentUserStr = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.name : 'المدير العام';
    const shopName = document.getElementById('shopName')?.value || 'بَيَان POS';

    let meta = {};
    let itemRows = [];
    let summary = {};

    if (type === 'sales') {
        const partner = document.getElementById('customerName')?.value || 'عميل نقدي';
        const method = (typeof getSelectedPaymentMethod === 'function' ? getSelectedPaymentMethod('sales-section') : (document.getElementById('salesPaymentMethod')?.value || 'نقدي'));
        const invNo = document.getElementById('salesInvoiceNo')?.value || document.getElementById('salesInvNoDisplay')?.innerText || document.getElementById('salesBadgeID')?.innerText || 'مبيعات';
        const date = (typeof getTransactionDateTime === 'function' ? getTransactionDateTime('salesDate', 'salesTime').full : new Date().toLocaleString('ar-EG'));
        const status = method.includes('آجل') ? 'آجل (مديونية)' : 'نقدي (مسدد)';
        const disc = parseFloat(document.getElementById('salesDiscount')?.value) || 0;
        const tax = parseFloat(document.getElementById('salesTax')?.value) || 0;
        const grandTotal = parseFloat(typeof currentTotal !== 'undefined' ? currentTotal : 0);

        meta = {
            title: "فاتورة مبيعات",
            invNo: invNo,
            date: date,
            partner: partner,
            method: method,
            status: status,
            user: currentUserStr
        };

        let subTotal = 0;
        itemRows = (typeof cart !== 'undefined' ? cart : []).map(item => {
            const pInDB = (typeof productsDB !== 'undefined' ? productsDB.find(p => p.id === item.id || p.name === item.name) : null);
            const barcode = item.barcode || (pInDB ? (pInDB.barcode || pInDB.code || '-') : '-');
            const unit = item.selectedUnit ? (typeof item.selectedUnit === 'object' ? item.selectedUnit.unitName : item.selectedUnit) : (item.unit || 'قطعة');
            const qty = parseFloat(item.qty) || 1;
            const price = parseFloat(item.price) || 0;
            const itemDisc = parseFloat(item.discount || 0);
            const itemTax = parseFloat(item.tax || 0);
            const total = (qty * price) - itemDisc + itemTax;
            subTotal += total;
            return {
                name: item.name || '-',
                barcode: barcode,
                qty: qty,
                unit: unit,
                price: price,
                discount: itemDisc,
                tax: itemTax,
                total: total
            };
        });

        let discountAmount = (document.getElementById('discountType')?.value === 'perc') ? (subTotal * disc / 100) : disc;
        let taxAmount = (document.getElementById('taxType')?.value === 'perc') ? (subTotal * tax / 100) : tax;

        summary = {
            subTotal: subTotal,
            discount: discountAmount,
            tax: taxAmount,
            grandTotal: (grandTotal > 0 ? grandTotal : (subTotal - discountAmount + taxAmount))
        };
    } else if (type === 'purchase') {
        const partner = document.getElementById('supplierName')?.value || 'مورد';
        const method = (typeof getSelectedPaymentMethod === 'function' ? getSelectedPaymentMethod('purchase-section') : (document.getElementById('purchasePaymentMethod')?.value || 'نقدي'));
        const invNo = document.getElementById('purchaseInvoiceNo')?.value || document.getElementById('purBadgeID')?.innerText || 'مشتريات';
        const date = document.getElementById('purchaseDate')?.value || new Date().toLocaleDateString('ar-EG');
        const status = method.includes('آجل') ? 'آجل (مديونية)' : 'نقدي (مسدد)';
        const totalNet = parseFloat(document.getElementById('purchaseGrandTotal')?.innerText) || 0;

        meta = {
            title: "فاتورة مشتريات",
            invNo: invNo,
            date: date,
            partner: partner,
            method: method,
            status: status,
            user: currentUserStr
        };

        let subTotal = 0;
        itemRows = (typeof purchaseCart !== 'undefined' ? purchaseCart : []).map(item => {
            const pInDB = (typeof productsDB !== 'undefined' ? productsDB.find(p => p.id === item.id || p.name === item.name) : null);
            const barcode = item.barcode || (pInDB ? (pInDB.barcode || pInDB.code || '-') : '-');
            const unit = item.selectedUnit ? (typeof item.selectedUnit === 'object' ? item.selectedUnit.unitName : item.selectedUnit) : (item.unit || 'قطعة');
            const qty = parseFloat(item.qty) || 1;
            const price = parseFloat(item.price) || 0;
            const total = qty * price;
            subTotal += total;
            return {
                name: item.name || '-',
                barcode: barcode,
                qty: qty,
                unit: unit,
                price: price,
                discount: 0,
                tax: 0,
                total: total
            };
        });

        summary = {
            subTotal: subTotal,
            grandTotal: (totalNet > 0 ? totalNet : subTotal)
        };
    } else if (type === 'salesReturn' || type === 'purchaseReturn') {
        const isSales = (type === 'salesReturn');
        const partner = isSales ? (document.getElementById('salesReturnPartnerDisplay')?.innerText || 'عميل') : (document.getElementById('purReturnPartnerDisplay')?.innerText || 'مورد');
        const date = isSales ? (document.getElementById('salesReturnDate')?.value || new Date().toLocaleDateString('ar-EG')) : (document.getElementById('purReturnDate')?.value || new Date().toLocaleDateString('ar-EG'));
        const invNo = isSales ? (document.getElementById('salesReturnBadgeID')?.innerText || 'مرتجع مبيعات') : (document.getElementById('purReturnBadgeID')?.innerText || 'مرتجع مشتريات');
        const totalNet = parseFloat(document.getElementById(isSales ? 'returnTotalAmount' : 'purReturnTotalAmount')?.innerText) || 0;
        const cartArr = isSales ? (typeof returnCart !== 'undefined' ? returnCart : []) : (typeof purReturnCart !== 'undefined' ? purReturnCart : []);

        meta = {
            title: isSales ? "مرتجع مبيعات 🔄" : "مرتجع مشتريات 🔄",
            invNo: invNo,
            date: date,
            partner: partner,
            method: "مرتجع",
            status: "مكتمل",
            user: currentUserStr
        };

        let subTotal = 0;
        itemRows = cartArr.map(item => {
            const qty = parseFloat(item.qty) || 1;
            const price = parseFloat(item.price) || 0;
            const total = qty * price;
            subTotal += total;
            return {
                name: item.name || '-',
                barcode: item.barcode || '-',
                qty: qty,
                unit: item.unit || 'قطعة',
                price: price,
                discount: 0,
                tax: 0,
                total: total
            };
        });

        summary = {
            subTotal: subTotal,
            grandTotal: (totalNet > 0 ? totalNet : subTotal)
        };
    } else if (type === 'receipt' || type === 'disbursement') {
        const isReceipt = (type === 'receipt');
        const amount = parseFloat(document.getElementById(isReceipt ? 'receiptAmount' : 'disburseAmount')?.value) || 0;
        const partner = document.getElementById(isReceipt ? 'receiptCustomer' : 'disbursePayee')?.value || (isReceipt ? 'عميل' : 'مورد');
        const date = document.getElementById(isReceipt ? 'receiptDate' : 'disburseDate')?.value || new Date().toLocaleDateString('ar-EG');
        const invNo = document.getElementById(isReceipt ? 'receiptID' : 'disburseID')?.value || (isReceipt ? 'سند قبض' : 'سند صرف');
        const notes = document.getElementById(isReceipt ? 'receiptNotes' : 'disburseNotes')?.value || (isReceipt ? 'سند قبض مالي' : 'سند صرف مالي');

        meta = {
            title: isReceipt ? "سند قبض مالي 💵" : "سند صرف مالي 💸",
            invNo: invNo,
            date: date,
            partner: partner,
            method: document.getElementById(isReceipt ? 'receiptPaymentMethod' : 'disbursePaymentMethod')?.value || "نقدي",
            status: "مكتمل",
            user: currentUserStr
        };

        itemRows = [{
            name: notes,
            barcode: "-",
            qty: 1,
            unit: "عملية",
            price: amount,
            discount: 0,
            tax: 0,
            total: amount
        }];

        summary = {
            grandTotal: amount
        };
    } else if (type === 'dailyReport') {
        const fromDate = document.getElementById('reportDateFrom')?.value || new Date().toLocaleDateString('en-CA');
        const toDate = document.getElementById('reportDateTo')?.value || new Date().toLocaleDateString('en-CA');
        
        const whSelect = document.getElementById('dailyReportWarehouseSelect');
        const selectedWh = (whSelect && whSelect.value !== 'all') ? whSelect.value : ((window.dailyReportData && window.dailyReportData.selectedWarehouse !== 'all') ? window.dailyReportData.selectedWarehouse : 'all');
        const selectedWhLabel = (selectedWh !== 'all') ? selectedWh : 'كافة المخازن والفروع';

        const trSelect = document.getElementById('dailyReportTreasurySelect');
        const selectedTr = (trSelect && trSelect.value !== 'all') ? trSelect.value : ((window.dailyReportData && window.dailyReportData.selectedTreasury !== 'all') ? window.dailyReportData.selectedTreasury : 'all');
        const selectedTrLabel = (selectedTr !== 'all') ? selectedTr : 'كافة الخزائن ووسائل الدفع';

        const repData = window.dailyReportData || {};
        const netProfit = repData.netProfit !== undefined ? repData.netProfit.toFixed(2) : (document.getElementById('dailyNetProfit')?.innerText || '0.00');
        const totalSales = repData.totalSales !== undefined ? repData.totalSales.toFixed(2) : (document.getElementById('dailyTotalSales')?.innerText || '0.00');
        const totalPurchases = repData.totalPurchases !== undefined ? repData.totalPurchases.toFixed(2) : (document.getElementById('dailyTotalPurchases')?.innerText || '0.00');
        const totalExpenses = repData.totalExpenses !== undefined ? repData.totalExpenses.toFixed(2) : (document.getElementById('dailyTotalExpenses')?.innerText || '0.00');
        const totalReceipts = repData.totalReceipts !== undefined ? repData.totalReceipts.toFixed(2) : (document.getElementById('dailyTotalReceipts')?.innerText || '0.00');
        const grossProfit = repData.grossProfit !== undefined ? repData.grossProfit.toFixed(2) : (document.getElementById('dailyGrossProfit')?.innerText || '0.00');

        let filtered = (typeof transactions !== 'undefined' ? transactions : []).filter(t => (!fromDate || t.dateISO >= fromDate) && (!toDate || t.dateISO <= toDate) && !(t.type && t.type.includes('تحويل') && t.transferStatus === 'rejected'));
        if (selectedWh !== 'all') {
            filtered = filtered.filter(t => {
                if (t.type && t.type.includes('تحويل')) {
                    return (t.warehouse === selectedWh || t.sourceWarehouse === selectedWh || t.toWarehouse === selectedWh || t.destWarehouse === selectedWh || t.fromWarehouse === selectedWh);
                }
                return (t.warehouse === selectedWh || (!t.warehouse && selectedWh === 'المخزن الرئيسي'));
            });
        }
        if (selectedTr !== 'all') {
            const isNonCashMethodStr = (s) => {
                if (!s) return false;
                const str = String(s).toLowerCase();
                return str.includes('بنك') || str.includes('تحويل') || str.includes('فيزا') || 
                       str.includes('شيك') || str.includes('شبكة') || str.includes('فودافون') || 
                       str.includes('فودافن') || str.includes('vodafone') || str.includes('voda') || 
                       str.includes('اورنج') || str.includes('أورانج') || str.includes('orange') || 
                       str.includes('اتصالات') || str.includes('etisalat') || str.includes('وي') || 
                       str.includes('we') || str.includes('انستاباي') || str.includes('إنستاباي') || 
                       str.includes('انستا') || str.includes('insta') || str.includes('محفظة') || 
                       str.includes('wallet') || str.includes('مدى') || str.includes('mada') || 
                       str.includes('master') || str.includes('بطاقة') || str.includes('card') ||
                       str === 'vodafone_cash';
            };
            filtered = filtered.filter(t => {
                const m = String(t.method || t.paymentMethod || t.treasury || '').trim().toLowerCase();
                const sel = selectedTr.trim().toLowerCase();
                const isSelCash = !isNonCashMethodStr(sel) && (sel.includes('نقد') || sel.includes('كاش') || sel.includes('cash'));
                if (isSelCash) {
                    if (!m) return true;
                    return !isNonCashMethodStr(m) && !m.includes('آجل') && !m.includes('ذمم');
                }
                const clean = str => str.replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\s]+/u, '').trim();
                const cleanSel = clean(sel);
                const cleanM = clean(m);
                if (cleanSel.includes('فودافون') || cleanSel.includes('فودافن') || cleanSel.includes('vodafone') || cleanSel.includes('voda') || cleanSel === 'vodafone_cash') {
                    return cleanM.includes('فودافون') || cleanM.includes('فودافن') || cleanM.includes('vodafone') || cleanM.includes('voda') || cleanM === 'vodafone_cash';
                }
                if (cleanSel.includes('انستاباي') || cleanSel.includes('إنستاباي') || cleanSel.includes('insta')) {
                    return cleanM.includes('انستاباي') || cleanM.includes('إنستاباي') || cleanM.includes('insta');
                }
                return cleanM === cleanSel || cleanM.includes(cleanSel) || cleanSel.includes(cleanM);
            });
        }
        
        const canViewProfits = (typeof hasPermission === 'function') ? hasPermission('general_profits') : true;
        const summaryRows = [
            ["📊 ملخص تقرير الحركة والتقفيل اليومي"],
            ["الفترة الزمنية:", `من ${fromDate} إلى ${toDate}`],
            ["🏢 المخزن:", selectedWhLabel],
            ["💰 الخزينة / وسيلة الدفع:", selectedTrLabel],
            ["تاريخ الاستخراج:", new Date().toLocaleString('ar-EG')],
            [],
            ["البيان المالي", "القيمة الإجمالية (ج.م)"],
            ["🛍️ إجمالي المبيعات العامة", totalSales],
            ["🛒 مبيعات نقدية (درج الكاش)", repData.totalSalesCash !== undefined ? repData.totalSalesCash.toFixed(2) : '-'],
            ["📱 صافي محفظة فودافون كاش", repData.vodafoneCashTotal !== undefined ? repData.vodafoneCashTotal.toFixed(2) : '0.00'],
            ["💳 مبيعات إلكترونية / فيزا وبنكي", repData.totalSalesNonCash !== undefined ? repData.totalSalesNonCash.toFixed(2) : '-'],
            ["📦 إجمالي المشتريات والتوريد", totalPurchases],
            ["💵 إجمالي المقبوضات (سندات القبض)", totalReceipts],
            ["💸 إجمالي المصروفات وسندات الصرف", totalExpenses],
            ["⏺️ رصيد سابق (افتتاحي)", repData.previousBalance !== undefined ? repData.previousBalance.toFixed(2) : '-'],
            ["🔄 صافي حركة النقدية بالدرج", repData.netCashMovement !== undefined ? repData.netCashMovement.toFixed(2) : '-'],
            ["💰 الرصيد النهائي بالدرج", repData.finalCashBalance !== undefined ? repData.finalCashBalance.toFixed(2) : '-']
        ];

        if (canViewProfits) {
            summaryRows.push(
                ["📈 مجمل الربح", grossProfit],
                ["🎯 صافي الربح النهائي", netProfit]
            );
        }

        summaryRows.push([], ["📋 تفاصيل سجل الحركات والفواتير خلال الفترة:"]);

        const headersRow = ["م", "رقم الفاتورة / المستند", "حالة/نوع الفاتورة", "التاريخ والوقت", "العميل / المورد", "طريقة الدفع", "اسم المنتج / الصنف", "الباركود", "الكمية", "سعر الوحدة", "الخصم", "الضريبة", "إجمالي الحركة", "المستخدم"];
        summaryRows.push(headersRow);

        filtered.forEach((t, idx) => {
            summaryRows.push([
                idx + 1,
                t.invoiceId || t.id || '-',
                t.type || 'حركة',
                t.dateISO ? `${t.dateISO} ${t.timeISO || ''}` : (t.date || '-'),
                t.partner || '-',
                t.method || 'نقدي',
                t.product || '-',
                t.barcode || '-',
                t.qty || 1,
                parseFloat(t.price || 0).toFixed(2),
                parseFloat(t.discount || 0).toFixed(2),
                parseFloat(t.tax || 0).toFixed(2),
                parseFloat(t.total || t.price || 0).toFixed(2),
                t.user || currentUserStr
            ]);
        });

        if (XLSXLib && XLSXLib.utils) {
            try {
                const ws = XLSXLib.utils.aoa_to_sheet(summaryRows);
                ws['!dir'] = 'rtl';
                ws['!cols'] = [{ wch: 6 }, { wch: 22 }, { wch: 18 }, { wch: 20 }, { wch: 22 }, { wch: 14 }, { wch: 25 }, { wch: 16 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 16 }];

                const wb = XLSXLib.utils.book_new();
                XLSXLib.utils.book_append_sheet(wb, ws, "تقرير الحركة اليومية");
                
                const cleanFileName = (fileName || 'Bayan_Daily_Report').replace(/[\\\/:*?"<>|]/g, '_');
                XLSXLib.writeFile(wb, cleanFileName.endsWith('.xlsx') ? cleanFileName : (cleanFileName + '.xlsx'));
                return showToast("✅ تم تصدير ملف Excel تقرير الحركة اليومية بنجاح", "success");
            } catch (e) {
                console.warn("XLSXLib dailyReport aoa_to_sheet fallback:", e);
            }
        }

        if (typeof downloadAOAAsExcelCSV === 'function') {
            downloadAOAAsExcelCSV(summaryRows, fileName || 'Bayan_Daily_Report');
        } else if (typeof window.downloadAOAAsExcelCSV === 'function') {
            window.downloadAOAAsExcelCSV(summaryRows, fileName || 'Bayan_Daily_Report');
        }
        return;
    } else if (type === 'invoices') {
        const fromDate = document.getElementById('invFilterFrom')?.value || '';
        const toDate = document.getElementById('invFilterTo')?.value || '';
        const filtered = (typeof transactions !== 'undefined' ? transactions : []).filter(t => (!fromDate || t.dateISO >= fromDate) && (!toDate || t.dateISO <= toDate));
        
        const items = filtered.map((t, idx) => ({
            "م": idx + 1,
            "رقم الفاتورة / المستند": t.invoiceId || t.id || '-',
            "حالة/نوع الفاتورة": t.type || 'حركة',
            "التاريخ والوقت": t.dateISO ? `${t.dateISO} ${t.timeISO || ''}` : (t.date || '-'),
            "العميل / المورد": t.partner || '-',
            "طريقة الدفع": t.method || 'نقدي',
            "اسم المنتج / الصنف": t.product || '-',
            "الباركود": t.barcode || '-',
            "الكمية": t.qty || 1,
            "الوحدة": t.unit || 'قطعة',
            "سعر الوحدة (ج.م)": parseFloat(t.price || 0).toFixed(2),
            "الخصم": parseFloat(t.discount || 0).toFixed(2),
            "الضريبة": parseFloat(t.tax || 0).toFixed(2),
            "إجمالي الصنف (ج.م)": parseFloat(t.total || t.price || 0).toFixed(2),
            "المستخدم المسؤول": t.user || currentUserStr
        }));

        if (!items || items.length === 0) {
            return showToast("⚠️ لا توجد بيانات للتصدير حالياً", "warning");
        }

        if (XLSXLib && XLSXLib.utils) {
            try {
                const ws = XLSXLib.utils.json_to_sheet(items);
                ws['!dir'] = 'rtl';
                const colWidths = Object.keys(items[0]).map(key => ({
                    wch: items.reduce((maxW, row) => Math.max(maxW, String(row[key] || '').length + 2), key.length + 6)
                }));
                ws['!cols'] = colWidths;

                const wb = XLSXLib.utils.book_new();
                XLSXLib.utils.book_append_sheet(wb, ws, "سجل الفواتير");
                
                const cleanFileName = (fileName || 'Bayan_Invoices_Report').replace(/[\\\/:*?"<>|]/g, '_');
                XLSXLib.writeFile(wb, cleanFileName.endsWith('.xlsx') ? cleanFileName : (cleanFileName + '.xlsx'));
                return showToast("✅ تم تصدير ملف Excel الشامل للفواتير بنجاح", "success");
            } catch (e) {
                console.warn("XLSXLib json_to_sheet fallback:", e);
            }
        }

        const keys = Object.keys(items[0]);
        const aoaTable = [keys];
        items.forEach(it => {
            aoaTable.push(keys.map(k => it[k]));
        });
        if (typeof downloadAOAAsExcelCSV === 'function') {
            downloadAOAAsExcelCSV(aoaTable, fileName || 'Bayan_Invoices_Report');
        } else if (typeof window.downloadAOAAsExcelCSV === 'function') {
            window.downloadAOAAsExcelCSV(aoaTable, fileName || 'Bayan_Invoices_Report');
        }
        return;
    }

    if (!itemRows || itemRows.length === 0) {
        return showToast("⚠️ لا توجد أصناف داخل الفاتورة لتصديرها إلى Excel", "warning");
    }

    const aoa = [];
    aoa.push([`📄 ${meta.title} - ${shopName}`]);
    aoa.push([]); 
    aoa.push(["رقم الفاتورة / المستند:", meta.invNo, "", "التاريخ والوقت:", meta.date]);
    aoa.push(["الطرف الثاني (العميل/المورد):", meta.partner, "", "طريقة الدفع والحالة:", `${meta.method} (${meta.status})`]);
    aoa.push(["المستخدم المسؤول:", meta.user, "", "", ""]);
    aoa.push([]); 
    aoa.push(["م", "اسم الصنف / المنتج", "الباركود", "الكمية", "الوحدة", "سعر الوحدة (ج.م)", "الخصم (ج.م)", "الضريبة (ج.م)", "إجمالي الصنف (ج.م)"]);

    itemRows.forEach((item, idx) => {
        aoa.push([
            idx + 1,
            item.name,
            item.barcode,
            item.qty,
            item.unit,
            parseFloat(item.price).toFixed(2),
            parseFloat(item.discount || 0).toFixed(2),
            parseFloat(item.tax || 0).toFixed(2),
            parseFloat(item.total).toFixed(2)
        ]);
    });

    aoa.push([]); 
    if (summary.subTotal !== undefined) aoa.push(["", "", "", "", "", "", "", "المجموع الفرعي:", parseFloat(summary.subTotal).toFixed(2)]);
    if (summary.discount !== undefined && summary.discount > 0) aoa.push(["", "", "", "", "", "", "", "إجمالي الخصم:", `-${parseFloat(summary.discount).toFixed(2)}`]);
    if (summary.tax !== undefined && summary.tax > 0) aoa.push(["", "", "", "", "", "", "", "إجمالي الضريبة:", `+${parseFloat(summary.tax).toFixed(2)}`]);
    if (summary.grandTotal !== undefined) aoa.push(["", "", "", "", "", "", "", "إجمالي الفاتورة الصافي:", parseFloat(summary.grandTotal).toFixed(2)]);

    const cleanFileName = (fileName || 'Bayan_Invoice').replace(/[\\\/:*?"<>|]/g, '_');

    if (XLSXLib && XLSXLib.utils) {
        try {
            const ws = XLSXLib.utils.aoa_to_sheet(aoa);
            ws['!dir'] = 'rtl';
            ws['!cols'] = [{ wch: 6 }, { wch: 32 }, { wch: 18 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 18 }];

            const wb = XLSXLib.utils.book_new();
            XLSXLib.utils.book_append_sheet(wb, ws, "الفاتورة");

            XLSXLib.writeFile(wb, cleanFileName.endsWith('.xlsx') ? cleanFileName : (cleanFileName + '.xlsx'));
            return showToast("✅ تم تصدير ملف Excel احترافي وشامل للفاتورة بنجاح", "success");
        } catch (e) {
            console.warn("XLSXLib writeFile fallback triggered:", e);
        }
    }

    if (typeof downloadAOAAsExcelCSV === 'function') {
        downloadAOAAsExcelCSV(aoa, cleanFileName);
    } else if (typeof window.downloadAOAAsExcelCSV === 'function') {
        window.downloadAOAAsExcelCSV(aoa, cleanFileName);
    }
}
window.exportInvoiceDataToExcel = exportInvoiceDataToExcel;

// تجهيز كود HTML الفعلي للمستند المخصص قبل تصدير PDF
function prepareBillHTML(type) {
    if (typeof validateDocumentData === 'function' && !validateDocumentData(type, 'تجهيز المستند')) return;
    const receiptArea = document.getElementById('receipt-area');
    if (!receiptArea) return;

    const shopName = document.getElementById('shopName')?.value || 'بَيَان POS';
    const shopAddress = document.getElementById('shopAddress')?.value || '';
    const shopPhone = document.getElementById('shopPhone1')?.value || '';
    const footerMsg = document.getElementById('printFooterMsg')?.value || 'شكراً لتعاملكم معنا';
    const userName = (typeof currentUser !== 'undefined' && currentUser ? currentUser.name : 'المدير العام');
    const todayDate = new Date().toLocaleDateString('ar-EG');
    const todayTime = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

    if (type === 'receipt' || type === 'disbursement') {
        const isReceipt = (type === 'receipt');
        const title = isReceipt ? 'سند قبض مالي 💵' : 'سند صرف مالي 💸';
        const mainColor = isReceipt ? '#065f46' : '#991b1b';
        const id = isReceipt ? (document.getElementById('receiptID')?.value || '---') : (document.getElementById('disburseID')?.value || '---');
        const partnerLabel = isReceipt ? 'استلمنا من السيد / الحساب:' : 'صُرف لطلب السيد / الحساب:';
        const partner = isReceipt ? (document.getElementById('receiptCustomer')?.value || 'عميل') : (document.getElementById('disbursePayee')?.value || 'جهة');
        const amount = parseFloat(document.getElementById(isReceipt ? 'receiptAmount' : 'disburseAmount')?.value) || 0;
        const notes = document.getElementById(isReceipt ? 'receiptNotes' : 'disburseNotes')?.value || (isReceipt ? 'مقابل سند قبض مالي' : 'مقابل سند صرف مالي');
        const method = document.getElementById(isReceipt ? 'receiptPaymentMethod' : 'disbursePaymentMethod')?.value || 'نقدي';
        const dateStr = document.getElementById(isReceipt ? 'receiptDate' : 'disburseDate')?.value || todayDate;
        const timeStr = document.getElementById(isReceipt ? 'receiptTime' : 'disburseTime')?.value || todayTime;

        // حساب الأرصدة المالية الحقيقية للحساب/العميل (قبل حفظ السند الحالي)
        const prevBal = (typeof getAccountBalance === 'function' ? getAccountBalance(partner) : 0);
        const remainBal = isReceipt ? (prevBal - amount) : (prevBal + amount);

        receiptArea.innerHTML = `
            <div class="print-container" style="direction:rtl; padding:25px; font-family:'Arial',sans-serif; background:#fff; color:#000; width:100%; border:3px double ${mainColor}; box-sizing:border-box; border-radius:8px;">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid ${mainColor}; padding-bottom:12px; margin-bottom:15px;">
                    <div>
                        <div style="font-size:22px; font-weight:900; color:${mainColor};">${shopName}</div>
                        ${shopAddress ? `<div style="font-size:12px; color:#475569; margin-top:3px;">${shopAddress} ${shopPhone ? ' | ' + shopPhone : ''}</div>` : ''}
                    </div>
                    <div style="text-align:center;">
                        <div style="font-size:18px; font-weight:bold; background:${mainColor}; color:#fff; padding:6px 20px; border-radius:6px;">${title}</div>
                        <div style="font-size:13px; font-weight:bold; margin-top:5px; color:#334155;">رقم السند: <span style="color:${mainColor}; font-size:15px;">#${id}</span></div>
                    </div>
                </div>

                <div style="display:flex; justify-content:space-between; background:#f8fafc; padding:10px 15px; border:1px solid #cbd5e1; border-radius:6px; margin-bottom:15px; font-size:13px; font-weight:bold;">
                    <div>التاريخ: ${dateStr} - ${timeStr}</div>
                    <div>طريقة الدفع: <span style="color:${mainColor}">${method}</span></div>
                    <div>المسؤول: ${userName}</div>
                </div>

                <div style="border:1px solid #cbd5e1; padding:12px 15px; border-radius:6px; margin-bottom:12px; font-size:14px; line-height:1.8;">
                    <div style="margin-bottom:8px;"><b>${partnerLabel}</b> <span style="font-size:16px; font-weight:bold; color:#0f172a;">${partner}</span></div>
                    <div style="margin-bottom:8px; display:flex; align-items:center;">
                        <b style="margin-left:8px;">مبلغ وقدره:</b>
                        <span style="font-size:20px; font-weight:900; color:${mainColor}; background:#f1f5f9; padding:2px 14px; border-radius:4px; border:1px solid ${mainColor};">
                            ${amount.toFixed(2)} ج.م
                        </span>
                    </div>
                    <div><b>وذلك عن / البيان:</b> <span style="color:#334155; font-weight:bold;">${notes}</span></div>
                </div>

                <!-- مربعات الحساب والترصيد المالي المخصص والواضح -->
                <div style="display:flex; justify-content:space-between; gap:10px; margin-bottom:15px; text-align:center;">
                    <div style="flex:1; background:#f1f5f9; padding:10px; border-radius:6px; border:1px solid #cbd5e1;">
                        <div style="font-size:12px; color:#64748b; font-weight:bold;">الرصيد السابق (قبل السند)</div>
                        <div style="font-size:16px; font-weight:900; color:#334155; margin-top:3px;">${prevBal.toFixed(2)} ج.م</div>
                    </div>
                    <div style="flex:1; background:${isReceipt ? '#f0fdf4' : '#fef2f2'}; padding:10px; border-radius:6px; border:1px solid ${mainColor};">
                        <div style="font-size:12px; color:${mainColor}; font-weight:bold;">${isReceipt ? 'المبلغ المقبوض حالياً' : 'المبلغ المصروف حالياً'}</div>
                        <div style="font-size:18px; font-weight:900; color:${mainColor}; margin-top:3px;">${amount.toFixed(2)} ج.م</div>
                    </div>
                    <div style="flex:1; background:#f8fafc; padding:10px; border-radius:6px; border:1px solid #cbd5e1;">
                        <div style="font-size:12px; color:#64748b; font-weight:bold;">الرصيد المتبقي (بعد السند)</div>
                        <div style="font-size:16px; font-weight:900; color:#0f172a; margin-top:3px;">${remainBal.toFixed(2)} ج.م</div>
                    </div>
                </div>

                <div style="margin-top:30px; display:flex; justify-content:space-between; text-align:center; font-size:13px; font-weight:bold; padding:0 20px;">
                    <div>
                        <div>توقيع المستلم</div>
                        <div style="margin-top:35px; border-bottom:1px dashed #000; width:140px;"></div>
                    </div>
                    <div>
                        <div>المحاسب / المدير</div>
                        <div style="margin-top:35px; border-bottom:1px dashed #000; width:140px;"></div>
                    </div>
                </div>

                <div style="text-align:center; margin-top:20px; font-size:12px; color:#64748b; border-top:1px solid #e2e8f0; padding-top:10px;">${footerMsg}</div>
            </div>
        `;
    } else if (type === 'salesReturn' || type === 'purchaseReturn') {
        const isSalesRet = (type === 'salesReturn');
        const title = isSalesRet ? "إشعار مرتجع مبيعات 🔄" : "إشعار مرتجع مشتريات 🔄";
        const mainColor = isSalesRet ? "#1e40af" : "#c2410c";
        const partner = isSalesRet ? (document.getElementById('salesReturnPartnerDisplay')?.innerText || 'عميل') : (document.getElementById('purReturnPartnerDisplay')?.innerText || 'مورد');
        const invId = isSalesRet ? (document.getElementById('salesReturnBadgeID')?.innerText || '---') : (document.getElementById('purReturnBadgeID')?.innerText || '---');
        const cartArr = isSalesRet ? (typeof returnCart !== 'undefined' ? returnCart : []) : (typeof purReturnCart !== 'undefined' ? purReturnCart : []);
        
        let subTotal = cartArr.reduce((sum, item) => sum + ((parseFloat(item.price)||0) * (parseFloat(item.qty)||1)), 0);
        let itemsRows = cartArr.map(item => {
            const qty = parseFloat(item.qty || 0);
            const price = parseFloat(item.price || 0);
            const lineTotal = (price * qty).toFixed(2);
            return `<tr>
                <td style="text-align:right; padding:6px; border:1px solid #000; font-weight:bold;">${item.name || ''}</td>
                <td style="text-align:center; padding:6px; border:1px solid #000;">${qty} ${item.unit || 'قطعة'}</td>
                <td style="text-align:center; padding:6px; border:1px solid #000;">${price.toFixed(2)}</td>
                <td style="text-align:center; padding:6px; border:1px solid #000; font-weight:bold;">${lineTotal}</td>
            </tr>`;
        }).join('');

        receiptArea.innerHTML = `
            <div class="print-container" style="direction:rtl; padding:20px; font-family:'Arial',sans-serif; background:#fff; color:#000; width:100%; box-sizing:border-box;">
                <div style="text-align:center; border-bottom:2px solid ${mainColor}; padding-bottom:10px; margin-bottom:12px;">
                    <div style="font-size:22px; font-weight:900;">${shopName}</div>
                    <div style="font-size:16px; font-weight:bold; background:${mainColor}; color:#fff; display:inline-block; padding:4px 16px; margin-top:6px; border-radius:6px;">${title}</div>
                </div>
                <table style="width:100%; margin-bottom:12px; font-size:13px; font-weight:bold;">
                    <tr><td><b>رقم الإشعار:</b> ${invId}</td><td style="text-align:left;"><b>التاريخ:</b> ${todayDate}</td></tr>
                    <tr><td><b>الطرف الثاني:</b> ${partner}</td><td style="text-align:left;"><b>المسؤول:</b> ${userName}</td></tr>
                </table>
                <table style="width:100%; border-collapse:collapse; margin-bottom:12px; font-size:13px;">
                    <thead>
                        <tr style="background:#f1f5f9;">
                            <th style="text-align:right; border:1px solid #000; padding:8px;">اسم الصنف المرتجع</th>
                            <th style="border:1px solid #000; padding:8px;">الكمية</th>
                            <th style="border:1px solid #000; padding:8px;">سعر الوحدة</th>
                            <th style="border:1px solid #000; padding:8px;">الإجمالي</th>
                        </tr>
                    </thead>
                    <tbody>${itemsRows}</tbody>
                </table>
                <div style="font-size:16px; font-weight:900; text-align:left; border-top:2px solid #000; padding-top:8px; color:${mainColor};">
                    إجمالي المبلغ المرتجع: ${subTotal.toFixed(2)} ج.م
                </div>
            </div>
        `;
    } else if (type === 'dailyReport') {
        const fromD = document.getElementById('reportDateFrom')?.value || todayDate;
        const toD = document.getElementById('reportDateTo')?.value || todayDate;
        const data = window.dailyReportData || {};
        const whSelect = document.getElementById('dailyReportWarehouseSelect');
        const selectedWh = (whSelect && whSelect.value !== 'all') ? whSelect.value : ((data.selectedWarehouse && data.selectedWarehouse !== 'all') ? data.selectedWarehouse : '');

        const netProfit = data.netProfit !== undefined ? data.netProfit.toFixed(2) : (document.getElementById('dailyNetProfit')?.innerText || '0.00');
        const totalSales = data.totalSales !== undefined ? data.totalSales.toFixed(2) : (document.getElementById('dailyTotalSales')?.innerText || '0.00');
        const totalPurchases = data.totalPurchases !== undefined ? data.totalPurchases.toFixed(2) : (document.getElementById('dailyTotalPurchases')?.innerText || '0.00');
        const totalExpenses = data.totalExpenses !== undefined ? data.totalExpenses.toFixed(2) : (document.getElementById('dailyTotalExpenses')?.innerText || '0.00');
        const totalReceipts = data.totalReceipts !== undefined ? data.totalReceipts.toFixed(2) : (document.getElementById('dailyTotalReceipts')?.innerText || '0.00');
        const grossProfit = data.grossProfit !== undefined ? data.grossProfit.toFixed(2) : (document.getElementById('dailyGrossProfit')?.innerText || '0.00');

        receiptArea.innerHTML = `
            <div class="print-container" style="direction:rtl; padding:25px; font-family:'Cairo','Arial',sans-serif; background:#fff; color:#000; width:100%; box-sizing:border-box; border:2px solid #0f172a; border-radius:10px;">
                <div style="text-align:center; border-bottom:2px solid #0f172a; padding-bottom:12px; margin-bottom:15px;">
                    <div style="font-size:24px; font-weight:900; color:#0f172a;">${shopName}</div>
                    ${shopAddress ? `<div style="font-size:13px; color:#475569;">${shopAddress} ${shopPhone ? ' | ' + shopPhone : ''}</div>` : ''}
                    <div style="font-size:18px; font-weight:bold; background:#0f172a; color:#fff; display:inline-block; padding:6px 24px; margin-top:10px; border-radius:6px;">📊 تقرير الحركة والملخص اليومي</div>
                </div>

                <div style="display:flex; justify-content:space-between; background:#f8fafc; padding:10px 15px; border:1px solid #cbd5e1; border-radius:6px; margin-bottom:15px; font-size:13px; font-weight:bold;">
                    <div>الفترة من: ${fromD} إلى: ${toD}${selectedWh ? ` | 🏢 المخزن: ${selectedWh}` : ''}</div>
                    <div>تاريخ الاستخراج: ${todayDate} - ${todayTime}</div>
                    <div>المسؤول: ${userName}</div>
                </div>

                <table style="width:100%; border-collapse:collapse; margin-bottom:15px; font-size:14px;">
                    <thead>
                        <tr style="background:#0f172a; color:#fff;">
                            <th style="padding:10px; border:1px solid #000; text-align:right;">بيان الحركة المالية</th>
                            <th style="padding:10px; border:1px solid #000; text-align:left;">المبلغ الإجمالي (ج.م)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td style="padding:9px; border:1px solid #cbd5e1; font-weight:bold;">🛍️ إجمالي المبيعات</td><td style="padding:9px; border:1px solid #cbd5e1; text-align:left; font-weight:900; color:#16a34a;">${totalSales} ج.م</td></tr>
                        <tr><td style="padding:9px; border:1px solid #cbd5e1; font-weight:bold;">📦 إجمالي المشتريات والتوريد</td><td style="padding:9px; border:1px solid #cbd5e1; text-align:left; font-weight:900; color:#dc2626;">${totalPurchases} ج.م</td></tr>
                        <tr><td style="padding:9px; border:1px solid #cbd5e1; font-weight:bold;">💵 إجمالي المقبوضات (سندات القبض)</td><td style="padding:9px; border:1px solid #cbd5e1; text-align:left; font-weight:900; color:#0284c7;">${totalReceipts} ج.م</td></tr>
                        <tr><td style="padding:9px; border:1px solid #cbd5e1; font-weight:bold;">💸 إجمالي المصروفات وسندات الصرف</td><td style="padding:9px; border:1px solid #cbd5e1; text-align:left; font-weight:900; color:#e11d48;">${totalExpenses} ج.م</td></tr>
                        <tr style="background:#f1f5f9;"><td style="padding:9px; border:1px solid #cbd5e1; font-weight:bold;">📈 مجمل الأرباح</td><td style="padding:9px; border:1px solid #cbd5e1; text-align:left; font-weight:900; color:#2563eb;">${grossProfit} ج.م</td></tr>
                        <tr style="background:#dcfce7;"><td style="padding:12px; border:2px solid #16a34a; font-weight:900; font-size:16px;">🎯 صافي الربح النهائي</td><td style="padding:12px; border:2px solid #16a34a; text-align:left; font-weight:900; font-size:18px; color:#15803d;">${netProfit} ج.م</td></tr>
                    </tbody>
                </table>

                <div style="text-align:center; margin-top:20px; font-size:12px; color:#64748b; border-top:1px solid #e2e8f0; padding-top:10px;">${footerMsg}</div>
            </div>
        `;
    } else {
        // فواتير المبيعات والمشتريات العادية
        const isSalesRet = (type === 'salesReturn' || type === 'sales-return' || type === 'return_sales' || (String(type).includes('مرتجع') && (String(type).includes('بيع') || String(type).includes('مبيعات'))));
        const isPurRet = (type === 'purchaseReturn' || type === 'purchase-return' || type === 'return_purchase' || (String(type).includes('مرتجع') && (String(type).includes('شراء') || String(type).includes('مشتريات'))));
        const isSales = (type === 'sales' || type === 'sale' || type === 'بيع');

        // في فواتير المبيعات: استخدام نفس كود وتصميم قالب الطباعة الفعلي المعتمد 100% (80mm/A4/A5)
        if (isSales && typeof window.buildInvoiceDocumentHTML === 'function' && typeof window.getSalesInvoicePrintData === 'function') {
            const invData = window.getSalesInvoicePrintData();
            const rendered = window.buildInvoiceDocumentHTML(invData);
            receiptArea.innerHTML = `
                <div style="background:#ffffff; color:#000000; padding:4mm; margin:0 auto; width:100%; max-width:${rendered.pageWidth}; box-sizing:border-box; font-family:'Arial','Segoe UI',Tahoma,sans-serif; text-align:right; direction:rtl;">
                    ${rendered.content}
                </div>
            `;
            return;
        }
        const title = isSalesRet ? "🔄 مرتجع مبيعات" : (isPurRet ? "🔄 مرتجع مشتريات" : (isSales ? "فاتورة مبيعات" : "فاتورة مشتريات 🚐"));
        const partner = isSales ? (document.getElementById('customerName')?.value.trim() || 'عميل نقدي') : (document.getElementById('supplierName')?.value.trim() || 'مورد');
        const method = isSales ? (typeof getSelectedPaymentMethod === 'function' ? getSelectedPaymentMethod('sales-section') : 'نقدي') : (document.getElementById('purchasePaymentMethod')?.value || 'نقدي');
        const dt = (typeof getTransactionDateTime === 'function' ? getTransactionDateTime('salesDate', 'salesTime') : { full: todayDate });
        const invId = isSales ? (document.getElementById('salesBadgeID')?.innerText || '---') : (document.getElementById('purBadgeID')?.innerText || '---');
        let cartArr = isSales ? (typeof cart !== 'undefined' ? cart : []) : (typeof purchaseCart !== 'undefined' ? purchaseCart : []);
        
        if ((!cartArr || cartArr.length === 0) && typeof editingOriginalItems !== 'undefined' && Array.isArray(editingOriginalItems) && editingOriginalItems.length > 0) {
            cartArr = editingOriginalItems.map(item => ({
                name: item.product || item.name,
                qty: item.qty,
                price: item.price,
                unit: item.unit,
                selectedUnit: item.unit
            }));
        }
        if ((!cartArr || cartArr.length === 0) && typeof editingInvoiceId !== 'undefined' && editingInvoiceId && typeof transactions !== 'undefined') {
            const invTx = transactions.filter(t => String(t.invoiceId) === String(editingInvoiceId) && t.product);
            if (invTx.length > 0) {
                cartArr = invTx.map(item => ({
                    name: item.product || item.productName || item.name,
                    qty: item.qty,
                    price: item.price,
                    unit: item.unit,
                    selectedUnit: item.unit
                }));
            }
        }

        let subTotal = cartArr.reduce((sum, item) => sum + ((parseFloat(item.price)||0) * (parseFloat(item.qty)||1)), 0);
        let itemsRows = cartArr.map(item => {
            const qty = parseFloat(item.qty || 0);
            const price = parseFloat(item.price || 0);
            const lineTotal = (price * qty).toFixed(2);
            const unitName = item.selectedUnit ? (typeof item.selectedUnit === 'object' ? item.selectedUnit.unitName : item.selectedUnit) : (item.unit || 'قطعة');
            return `<tr>
                <td style="text-align:right; padding:6px; border:1px solid #000; font-weight:bold;">${item.name || ''}</td>
                <td style="text-align:center; padding:6px; border:1px solid #000;">${qty} ${unitName}</td>
                <td style="text-align:center; padding:6px; border:1px solid #000;">${price.toFixed(2)}</td>
                <td style="text-align:center; padding:6px; border:1px solid #000; font-weight:bold;">${lineTotal}</td>
            </tr>`;
        }).join('');

        let discountVal = parseFloat(document.getElementById('discountInput')?.value) || 0;
        let discountAmount = (document.getElementById('discountType')?.value === 'perc') ? (subTotal * discountVal / 100) : discountVal;
        let taxVal = parseFloat(document.getElementById('taxInput')?.value) || 0;
        let taxAmount = (document.getElementById('taxType')?.value === 'perc') ? (subTotal * taxVal / 100) : taxVal;
        let grandTotal = (subTotal - discountAmount + taxAmount);

        receiptArea.innerHTML = `
            <div class="print-container" style="direction:rtl; padding:20px; font-family:'Arial',sans-serif; background:#fff; color:#000; width:100%; box-sizing:border-box;">
                <div style="text-align:center; border-bottom:2px solid #000; padding-bottom:12px; margin-bottom:12px;">
                    <div style="font-size:24px; font-weight:900;">${shopName}</div>
                    ${shopAddress ? `<div style="font-size:13px; color:#555;">${shopAddress} ${shopPhone ? ' | ' + shopPhone : ''}</div>` : ''}
                    <div style="font-size:18px; font-weight:bold; border:2px solid #000; display:inline-block; padding:4px 18px; margin-top:8px; border-radius:6px; background:#f8fafc;">${title}</div>
                </div>
                <table style="width:100%; margin-bottom:12px; font-size:13px; font-weight:bold; line-line:1.6;">
                    <tr><td><b>رقم الفاتورة:</b> ${invId}</td><td style="text-align:left;"><b>التاريخ والوقت:</b> ${dt.full || dt.iso || todayDate}</td></tr>
                    <tr><td><b>الطرف الثاني:</b> ${partner}</td><td style="text-align:left;"><b>طريقة الدفع:</b> ${method}</td></tr>
                    <tr><td><b>المستخدم المسؤول:</b> ${userName}</td><td></td></tr>
                </table>
                <table style="width:100%; border-collapse:collapse; margin-bottom:12px; font-size:13px;">
                    <thead>
                        <tr style="background:#f1f5f9;">
                            <th style="text-align:right; border:1px solid #000; padding:8px;">الصنف / المنتج</th>
                            <th style="border:1px solid #000; padding:8px;">الكمية</th>
                            <th style="border:1px solid #000; padding:8px;">السعر (ج.م)</th>
                            <th style="border:1px solid #000; padding:8px;">الإجمالي (ج.م)</th>
                        </tr>
                    </thead>
                    <tbody>${itemsRows}</tbody>
                </table>
                <div style="font-size:14px; font-weight:bold; border-top:2px solid #000; padding-top:10px; line-height:1.8;">
                    <div style="display:flex; justify-content:space-between;"><span>المجموع الفرعي:</span><span>${subTotal.toFixed(2)} ج.م</span></div>
                    ${discountAmount > 0 ? `<div style="display:flex; justify-content:space-between; color:#dc2626;"><span>إجمالي الخصم:</span><span>-${discountAmount.toFixed(2)} ج.م</span></div>` : ''}
                    ${taxAmount > 0 ? `<div style="display:flex; justify-content:space-between; color:#2563eb;"><span>إجمالي الضريبة:</span><span>+${taxAmount.toFixed(2)} ج.م</span></div>` : ''}
                    <div style="display:flex; justify-content:space-between; font-size:19px; font-weight:900; margin-top:6px; border-top:2px dashed #000; padding-top:6px;"><span>صافي الإجمالي النهائي:</span><span>${grandTotal.toFixed(2)} ج.م</span></div>
                </div>
                <div style="text-align:center; margin-top:20px; font-size:13px; border-top:1px solid #ccc; padding-top:10px; font-weight:bold;">${footerMsg}</div>
            </div>
        `;
    }
}
window.prepareBillHTML = prepareBillHTML;

// ================= تصدير العناصر كصورة عالية الجودة =================
async function exportElementToImage(elementOrId, fileName) {
    try {
        let element = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
        if (!element) throw new Error("العنصر المراد تصديره غير موجود!");

        let isHidden = false;
        let origDisplay = '', origPos = '', origLeft = '', origTop = '', origZIndex = '';

        if (window.getComputedStyle(element).display === 'none') {
            isHidden = true;
            origDisplay = element.style.display;
            origPos = element.style.position;
            origLeft = element.style.left;
            origTop = element.style.top;
            origZIndex = element.style.zIndex;

            element.style.display = 'block';
            element.style.position = 'absolute';
            element.style.left = '-9999px';
            element.style.top = '0px';
            element.style.zIndex = '-9999';
        }

        if (typeof html2canvas === 'function') {
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false
            });

            if (isHidden) {
                element.style.display = origDisplay;
                element.style.position = origPos;
                element.style.left = origLeft;
                element.style.top = origTop;
                element.style.zIndex = origZIndex;
            }

            const imgData = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = imgData;
            const cleanName = (fileName || 'صورة_التقرير').replace(/[\\\/:*?"<>|]/g, '_');
            link.download = cleanName.endsWith('.png') ? cleanName : (cleanName + '.png');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            if (typeof showToast === 'function') showToast("✅ تم تصدير صورة التقرير بنجاح", "success");
        } else {
            if (isHidden) {
                element.style.display = origDisplay;
                element.style.position = origPos;
                element.style.left = origLeft;
                element.style.top = origTop;
                element.style.zIndex = origZIndex;
            }
            showToast("⚠️ مكتبة تحويل الصور غير محملة", "error");
        }
    } catch(err) {
        console.error("Image Export Error:", err);
        if (typeof showToast === 'function') showToast("❌ فشل تصدير الصورة: " + err.message, "error");
    }
}
window.exportElementToImage = exportElementToImage;

async function exportCurrentBill(type, format) {
    if (type === 'dailyReport' && typeof isDailyReportAmountsProtected === 'function' && isDailyReportAmountsProtected()) {
        if (typeof window.verifyAdminPinAuthorization === 'function') {
            const ok = await window.verifyAdminPinAuthorization('📊 تصدير تقرير الحركة اليومية', 'يتطلب تصدير ملفات تقرير الحركة اليومية إدخال رمز PIN المدير.');
            if (!ok) return false;
        } else {
            if (typeof showToast === 'function') showToast('🔒 المبالغ المالية محمية ولا يمكن تصديرها بدون إذن المدير', 'error');
            return false;
        }
    }

    const actionLabel = (format === 'pdf' ? 'تصدير PDF' : (format === 'excel' ? 'تصدير ملف إكسل' : 'تصدير الصورة'));
    if (typeof validateDocumentData === 'function' && !validateDocumentData(type, actionLabel)) {
        return false;
    }

    let fileName = "فاتورة";
    let elementId = "";

    if (type === 'sales') {
        fileName = "فاتورة_مبيعات_" + (document.getElementById('customerName')?.value || 'عميل');
        elementId = 'sales-section';
    } else if (type === 'salesReturn') {
        fileName = "مرتجع_مبيعات_" + (document.getElementById('salesReturnPartnerDisplay')?.innerText || 'عميل');
        elementId = 'sales-return-section';
    } else if (type === 'purchaseReturn') {
        fileName = "مرتجع_مشتريات_" + (document.getElementById('purReturnPartnerDisplay')?.innerText || 'مورد');
        elementId = 'purchase-return-section';
    } else if (type === 'purchase') {
        fileName = "فاتورة_مشتريات_" + (document.getElementById('supplierName')?.value || 'مورد');
        elementId = 'purchase-section';
    } else if (type === 'receipt') {
        fileName = "سند_قبض_" + (document.getElementById('receiptCustomer')?.value || 'عميل');
        elementId = 'receipt-section';
    } else if (type === 'disbursement') {
        fileName = "سند_صرف_" + (document.getElementById('disbursePayee')?.value || 'جهة');
        elementId = 'disbursement-section';
    } else if (type === 'adjustment') {
        fileName = "تسوية_مخزنية_" + new Date().toLocaleDateString('ar-EG');
        elementId = 'adjustment-section';
    } else if (type === 'dailyReport') {
        fileName = "تقرير_الحركة_اليومية_" + (document.getElementById('reportDateFrom')?.value || new Date().toLocaleDateString('en-CA'));
        elementId = 'daily-report-section';
    } else if (type === 'invoices') {
        fileName = "سجل_الفواتير_والحركات";
        elementId = 'invoices-section';
    }

    document.querySelectorAll('.share-menu').forEach(m => m.classList.remove('active'));

    if (format === 'excel') {
        exportInvoiceDataToExcel(type, fileName);
    } else if (format === 'pdf') {
        prepareBillHTML(type);
        const receiptArea = document.getElementById('receipt-area');
        let target = (receiptArea && receiptArea.children.length > 0) ? receiptArea : elementId;
        exportElementToPDF(target, fileName);
    } else if (format === 'image') {
        prepareBillHTML(type);
        const receiptArea = document.getElementById('receipt-area');
        let target = (receiptArea && receiptArea.children.length > 0) ? receiptArea : elementId;
        exportElementToImage(target, fileName);
    }
}
window.exportCurrentBill = exportCurrentBill;