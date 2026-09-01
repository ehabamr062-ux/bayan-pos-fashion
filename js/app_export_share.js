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

// 2.6 دالة مشاركة الفواتير والمستندات عبر الواتساب والتليجرام
function shareTransaction(type, platform) {
    let isBillEmpty = false;
    if (type === 'sales' && (!window.cart || window.cart.length === 0)) isBillEmpty = true;
    else if (type === 'purchase' && (!window.purchaseCart || window.purchaseCart.length === 0)) isBillEmpty = true;
    else if (type === 'salesReturn' && (!window.salesReturnCart || window.salesReturnCart.length === 0)) isBillEmpty = true;
    else if (type === 'purchaseReturn' && (!window.purchaseReturnCart || window.purchaseReturnCart.length === 0)) isBillEmpty = true;
    else if (type === 'receipt' && (!document.getElementById('receiptAmount')?.value || parseFloat(document.getElementById('receiptAmount')?.value) === 0)) isBillEmpty = true;
    else if (type === 'disbursement' && (!document.getElementById('disburseAmount')?.value || parseFloat(document.getElementById('disburseAmount')?.value) === 0)) isBillEmpty = true;

    if (isBillEmpty) {
        document.querySelectorAll('.share-menu').forEach(m => m.classList.remove('active'));
        if (typeof showToast === 'function') showToast("⚠️ الفاتورة فارغة! يرجى إضافة أصناف أو بيانات أولاً قبل المشاركة.", "warning");
        else alert("⚠️ الفاتورة فارغة! يرجى إضافة أصناف أو بيانات أولاً قبل المشاركة.");
        return;
    }

    let title = "مشاركة مستند";
    let invNo = "---";
    let partnerName = "---";
    let grandTotal = "0.00";
    let itemsText = "";

    if (type === 'sales') {
        title = "📄 فاتورة مبيعات";
        partnerName = document.getElementById('customerName')?.value || 'عميل نقدي';
        invNo = document.getElementById('salesInvoiceNo')?.value || document.getElementById('salesInvNoDisplay')?.innerText || '---';
        grandTotal = (typeof currentTotal !== 'undefined' ? currentTotal : 0).toFixed(2);
        if (typeof cart !== 'undefined' && cart.length > 0) {
            itemsText = "\n📋 الأصناف:\n" + cart.map((item, i) => `${i + 1}. ${item.name} (${item.qty} × ${item.price}) = ${(item.qty * item.price).toFixed(2)}`).join('\n');
        }
    } else if (type === 'purchase') {
        title = "📦 فاتورة مشتريات";
        partnerName = document.getElementById('supplierName')?.value || 'مورد';
        invNo = document.getElementById('purchaseInvoiceNo')?.value || '---';
        grandTotal = (typeof purchaseCart !== 'undefined' ? purchaseCart.reduce((sum, item) => sum + (item.qty * item.cost), 0) : 0).toFixed(2);
        if (typeof purchaseCart !== 'undefined' && purchaseCart.length > 0) {
            itemsText = "\n📋 الأصناف:\n" + purchaseCart.map((item, i) => `${i + 1}. ${item.name} (${item.qty} × ${item.cost}) = ${(item.qty * item.cost).toFixed(2)}`).join('\n');
        }
    } else if (type === 'salesReturn') {
        title = "🔄 مرتجع مبيعات";
        partnerName = document.getElementById('salesReturnPartnerDisplay')?.innerText || 'عميل';
        grandTotal = (document.getElementById('salesReturnTotalDisplay')?.innerText || '0.00');
    } else if (type === 'purchaseReturn') {
        title = "🔄 مرتجع مشتريات";
        partnerName = document.getElementById('purReturnPartnerDisplay')?.innerText || 'مورد';
        grandTotal = (document.getElementById('purReturnTotalDisplay')?.innerText || '0.00');
    } else if (type === 'receipt') {
        title = "💵 سند قبض";
        partnerName = document.getElementById('receiptCustomer')?.value || 'عميل';
        grandTotal = (document.getElementById('receiptAmount')?.value || '0.00');
    } else if (type === 'disbursement') {
        title = "💸 سند صرف";
        partnerName = document.getElementById('disbursePayee')?.value || 'جهة';
        grandTotal = (document.getElementById('disburseAmount')?.value || '0.00');
    } else if (type === 'dailyReport') {
        title = "📊 تقرير الحركة اليومية الشامل";
        partnerName = "تقرير تقفيل اليومية";
        
        const fromD = document.getElementById('reportDateFrom')?.value || new Date().toLocaleDateString('en-CA');
        const toD = document.getElementById('reportDateTo')?.value || new Date().toLocaleDateString('en-CA');
        
        const netProfit = document.getElementById('dailyNetProfit')?.innerText || '0.00';
        const totalSales = document.getElementById('dailyTotalSales')?.innerText || '0.00';
        const totalPurchases = document.getElementById('dailyTotalPurchases')?.innerText || '0.00';
        const totalExpenses = document.getElementById('dailyTotalExpenses')?.innerText || '0.00';
        const totalReceipts = document.getElementById('dailyTotalReceipts')?.innerText || '0.00';
        const totalDisbursements = document.getElementById('dailyTotalDisbursements')?.innerText || '0.00';
        const grossProfit = document.getElementById('dailyGrossProfit')?.innerText || '0.00';

        grandTotal = netProfit;
        itemsText = `\n📅 الفترة: من ${fromD} إلى ${toD}\n` +
                    `🛍️ إجمالي المبيعات: ${totalSales} ج.م\n` +
                    `📦 إجمالي المشتريات: ${totalPurchases} ج.م\n` +
                    `💵 المقبوضات المالية: ${totalReceipts} ج.م\n` +
                    `💸 المصروفات / السندات: ${totalExpenses} ج.م\n` +
                    `📈 مجمل الربح: ${grossProfit} ج.م\n` +
                    `🎯 صافي الربح النهائي: ${netProfit} ج.م`;
    }

    const shopName = document.getElementById('shopName')?.value || 'بَيَان POS';
    let message = "";
    if (type === 'dailyReport') {
        message = `✨ *${shopName}* ✨\n${title}${itemsText}\n\nتاريخ الاستخراج: ${new Date().toLocaleDateString('ar-EG')}\nتم الاستخراج بواسطة برنامج بَيَان 🚀`;
    } else {
        message = `✨ *${shopName}* ✨\n${title}\n📌 رقم المستند: ${invNo}\n👤 الطرف: ${partnerName}\n💰 الإجمالي: ${grandTotal} ج.م${itemsText}\n\nشكراً لتعاملكم معنا! 🙏`;
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
        
        const netProfit = document.getElementById('dailyNetProfit')?.innerText || '0.00';
        const totalSales = document.getElementById('dailyTotalSales')?.innerText || '0.00';
        const totalPurchases = document.getElementById('dailyTotalPurchases')?.innerText || '0.00';
        const totalExpenses = document.getElementById('dailyTotalExpenses')?.innerText || '0.00';
        const totalReceipts = document.getElementById('dailyTotalReceipts')?.innerText || '0.00';
        const totalDisbursements = document.getElementById('dailyTotalDisbursements')?.innerText || '0.00';
        const grossProfit = document.getElementById('dailyGrossProfit')?.innerText || '0.00';

        const filtered = (typeof transactions !== 'undefined' ? transactions : []).filter(t => (!fromDate || t.dateISO >= fromDate) && (!toDate || t.dateISO <= toDate));
        
        const summaryRows = [
            ["📊 ملخص تقرير الحركة والتقفيل اليومي"],
            ["الفترة الزمنية:", `من ${fromDate} إلى ${toDate}`],
            ["تاريخ الاستخراج:", new Date().toLocaleString('ar-EG')],
            [],
            ["البيان المالي", "القيمة الإجمالية (ج.م)"],
            ["🛍️ إجمالي المبيعات", totalSales],
            ["📦 إجمالي المشتريات والتوريد", totalPurchases],
            ["💵 إجمالي المقبوضات (سندات القبض)", totalReceipts],
            ["💸 إجمالي المصروفات وسندات الصرف", totalExpenses],
            ["📈 مجمل الربح", grossProfit],
            ["🎯 صافي الربح النهائي", netProfit],
            [],
            ["📋 تفاصيل سجل الحركات والفواتير خلال الفترة:"]
        ];

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
        const netProfit = data.netProfit !== undefined ? data.netProfit.toFixed(2) : '0.00';
        const totalSales = data.totalSales !== undefined ? data.totalSales.toFixed(2) : '0.00';
        const totalPurchases = data.totalPurchases !== undefined ? data.totalPurchases.toFixed(2) : '0.00';
        const totalExpenses = data.totalExpenses !== undefined ? data.totalExpenses.toFixed(2) : '0.00';
        const totalReceipts = data.totalReceipts !== undefined ? data.totalReceipts.toFixed(2) : '0.00';
        const grossProfit = data.grossProfit !== undefined ? data.grossProfit.toFixed(2) : '0.00';

        receiptArea.innerHTML = `
            <div class="print-container" style="direction:rtl; padding:25px; font-family:'Cairo','Arial',sans-serif; background:#fff; color:#000; width:100%; box-sizing:border-box; border:2px solid #0f172a; border-radius:10px;">
                <div style="text-align:center; border-bottom:2px solid #0f172a; padding-bottom:12px; margin-bottom:15px;">
                    <div style="font-size:24px; font-weight:900; color:#0f172a;">${shopName}</div>
                    ${shopAddress ? `<div style="font-size:13px; color:#475569;">${shopAddress} ${shopPhone ? ' | ' + shopPhone : ''}</div>` : ''}
                    <div style="font-size:18px; font-weight:bold; background:#0f172a; color:#fff; display:inline-block; padding:6px 24px; margin-top:10px; border-radius:6px;">📊 تقرير الحركة والملخص اليومي</div>
                </div>

                <div style="display:flex; justify-content:space-between; background:#f8fafc; padding:10px 15px; border:1px solid #cbd5e1; border-radius:6px; margin-bottom:15px; font-size:13px; font-weight:bold;">
                    <div>الفترة من: ${fromD} إلى: ${toD}</div>
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
        const isSales = (type === 'sales');
        const title = isSales ? "فاتورة مبيعات" : "فاتورة مشتريات 🚐";
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

function exportCurrentBill(type, format) {
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

// ================= مساعد بَيَان الذكي (Gemini AI Assistant Copilot) =================