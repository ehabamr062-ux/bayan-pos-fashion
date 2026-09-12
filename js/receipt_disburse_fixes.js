/**
 * Bayan POS - Receipt & Disbursement Fixes & Improvements
 * - Replaces native browser alert() with the custom modern modal alert.
 * - Restores checkbox functionality for "Print Automatically" and "Close Tab" in Receipt/Disbursement.
 * - Persists checkbox states using IndexedDB (bayanDB.settings via getStore/setStore).
 */

// 1. Override window.alert globally to use the modern custom alert system
(function() {
    const originalAlert = window.alert;
    window.alert = function(message) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert({
                type: 'warning',
                titleText: 'تنبيه',
                msg: message,
                confirmText: 'حسناً'
            });
        } else if (typeof showToast === 'function') {
            showToast(message, 'warning');
        } else {
            originalAlert(message);
        }
    };
})();

// 2. Setup robust persistence and logic for Receipt & Disbursement checkboxes using IndexedDB (bayanDB.settings via getStore/setStore)
window.syncReceiptDisburseCheckboxes = function() {
    const keys = [
        { id: 'receiptPrintCheck', key: 'bayan_receiptPrint' },
        { id: 'receiptCloseCheck', key: 'bayan_receiptClose' },
        { id: 'disbursePrintCheck', key: 'bayan_disbursePrint' },
        { id: 'disburseCloseCheck', key: 'bayan_disburseClose' }
    ];

    keys.forEach(item => {
        const el = document.getElementById(item.id);
        if (!el) return;

        let val = null;
        if (typeof getStore === 'function') {
            val = getStore(item.key);
        }

        if (val !== null && val !== undefined) {
            el.checked = (val === 'true' || val === true);
        }

        if (!el.dataset.boundListener) {
            el.dataset.boundListener = 'true';
            el.addEventListener('change', () => {
                const isChecked = el.checked;
                if (typeof setStore === 'function') {
                    setStore(item.key, isChecked);
                }
            });
        }
    });
};

document.addEventListener('DOMContentLoaded', () => {
    if (typeof window.syncReceiptDisburseCheckboxes === 'function') {
        window.syncReceiptDisburseCheckboxes();
    }
});

// =========================================================================
// 5. Bayan POS - Fixes for User warning and Sales Analysis click event
// =========================================================================
(function() {
    const checkAndBlock = (msg) => {
        if (typeof msg === 'string' && (msg.includes('اختيار مستخدم') || msg.includes('كتابة الاسم') || msg.includes('مستخدم أو كتابة'))) {
            console.log('🚫 [Bayan Fix] تم حجب تنبيه اختيار المستخدم عند فتح التطبيق بنجاح.');
            return true;
        }
        return false;
    };

    // اعتراض alert لمنع رسالة اختيار المستخدم
    const originalAlert = window.alert;
    window.alert = function(message) {
        if (checkAndBlock(message)) return;
        return originalAlert.apply(this, arguments);
    };

    // اعتراض showCustomAlert و showToast بعد تحميل الصفحة
    document.addEventListener('DOMContentLoaded', () => {
        // اعتراض showCustomAlert
        if (typeof window.showCustomAlert === 'function') {
            const originalShowCustomAlert = window.showCustomAlert;
            window.showCustomAlert = function(options) {
                if (options && (checkAndBlock(options.msg) || checkAndBlock(options.text) || checkAndBlock(options.titleText))) {
                    return;
                }
                return originalShowCustomAlert.apply(this, arguments);
            };
        }

        // اعتراض showToast
        if (typeof window.showToast === 'function') {
            const originalShowToast = window.showToast;
            window.showToast = function(message, type) {
                if (checkAndBlock(message)) return;
                return originalShowToast.apply(this, arguments);
            };
        }

        // إيقاف إظهار الفاتورة عند النقر على عمود "الصنف" في جدول تحليل المبيعات
        const analysisTableBody = document.getElementById('analysisTableBody');
        if (analysisTableBody) {
            analysisTableBody.addEventListener('click', function(e) {
                const td = e.target.closest('td');
                if (!td) return;
                const index = td.cellIndex;
                // عمود الصنف ترتيبه 4 في الجدول (العمود الخامس)
                if (index === 4) {
                    console.log('🚫 [Bayan Fix] تم منع فتح الفاتورة عند الضغط على الصنف في تحليل المبيعات.');
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                }
            }, true); // استخدام capture لمنع تشغيل الأحداث الأخرى
        }

        // تسجيل مستمعي الأحداث للتحقق من كميات المرتجع في الجداول
        const returnCart = document.getElementById('returnCartBody');
        const purReturnCart = document.getElementById('purReturnCartBody');
        if (returnCart) {
            returnCart.addEventListener('input', handleQtyValidation);
        }
        if (purReturnCart) {
            purReturnCart.addEventListener('input', handleQtyValidation);
        }
    });

    // كود التحقق من كمية المرتجع لعدم تجاوز الكمية الأصلية للفاتورة
    window.bayanReturnMaxQty = window.bayanReturnMaxQty || {};

    if (typeof window.confirmReturnItemsSelection === 'function') {
        const originalConfirm = window.confirmReturnItemsSelection;
        window.confirmReturnItemsSelection = function(...args) {
            const rows = document.querySelectorAll('#selectReturnItemsTableBody tr');
            for (let row of rows) {
                const checkbox = row.querySelector('input[type="checkbox"]');
                if (checkbox && checkbox.checked) {
                    const name = row.cells[2] ? row.cells[2].innerText.trim() : '';
                    const unit = row.cells[3] ? row.cells[3].innerText.trim() : '';
                    const availableQty = parseFloat(row.cells[6] ? row.cells[6].innerText : 0) || 0;
                    const input = row.cells[7] ? row.cells[7].querySelector('input') : null;
                    
                    if (input && name) {
                        const returnQty = parseFloat(input.value) || 0;
                        if (returnQty <= 0) {
                            showCustomAlert({
                                type: 'error',
                                titleText: 'خطأ في الكمية',
                                msg: `يرجى إدخال كمية مرتجع أكبر من الصفر للصنف: ${name}`,
                                confirmText: 'حسناً'
                            });
                            return;
                        }
                        if (returnQty > availableQty) {
                            showCustomAlert({
                                type: 'error',
                                titleText: 'تجاوز الكمية المتاحة',
                                msg: `لا يمكن إرجاع كمية (${returnQty}) أكبر من الكمية المتاحة للإرجاع (${availableQty}) للصنف: ${name}`,
                                confirmText: 'حسناً'
                            });
                            return;
                        }
                        // حفظ الحد الأقصى للكمية المتاحة
                        const key = name + '_' + unit;
                        window.bayanReturnMaxQty[key] = availableQty;
                    }
                }
            }
            return originalConfirm.apply(this, args);
        };
    }

    function handleQtyValidation(e) {
        const input = e.target;
        if (input.type === 'number') {
            const row = input.closest('tr');
            if (!row) return;
            
            const cell = input.closest('td');
            if (!cell || cell.cellIndex !== 4) return; // عمود الكمية

            const nameCell = row.cells[2];
            const unitCell = row.cells[3];
            if (!nameCell || !unitCell) return;

            const name = nameCell.innerText.trim();
            const unit = unitCell.innerText.trim();
            const key = name + '_' + unit;

            if (window.bayanReturnMaxQty && window.bayanReturnMaxQty[key] !== undefined) {
                const maxQty = window.bayanReturnMaxQty[key];
                const currentVal = parseFloat(input.value) || 0;
                if (currentVal > maxQty) {
                    showCustomAlert({
                        type: 'warning',
                        titleText: 'تنبيه',
                        msg: `الكمية المدخلة تتجاوز الكمية المتاحة للإرجاع من الفاتورة الأصلية (${maxQty}). تم ضبط الكمية تلقائياً للحد الأقصى المسموح به.`,
                        confirmText: 'حسناً'
                    });
                    input.value = maxQty;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        }
    }

    // 7. Inventory Adjustment Notes Column and Delete Button Styling Fix
    (function() {
        window.bayanAdjustmentNotes = window.bayanAdjustmentNotes || {};

        // MutationObserver to dynamically add the notes cell and fix the delete button style
        const target = document.getElementById('adjTableBody');
        if (target) {
            const observer = new MutationObserver((mutations) => {
                const rows = target.querySelectorAll('tr');
                const productCounts = {}; // Reset counts for each run

                rows.forEach((row) => {
                    // If it's the empty placeholder row, make sure it spans 11 columns instead of 10
                    const emptyCell = row.querySelector('td[colspan="10"]');
                    if (emptyCell) {
                        emptyCell.setAttribute('colspan', '11');
                        return;
                    }

                    // If it's a product row (has cells and is not the placeholder)
                    if (row.cells.length === 10) {
                        // Check if notes input is already present
                        if (row.querySelector('.adj-row-note-input')) return;

                        // Insert notes cell before the last cell (which is the delete button)
                        const newCell = row.insertCell(9);
                        newCell.className = 'col-adj-notes';
                        newCell.style.padding = '8px';
                        
                        const noteInput = document.createElement('input');
                        noteInput.type = 'text';
                        noteInput.className = 'adj-row-note-input';
                        noteInput.style.cssText = 'width: 100%; height: 32px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 0 8px; font-size: 0.85rem; outline: none; transition: 0.2s;';
                        noteInput.placeholder = 'ملاحظة...';
                        noteInput.onfocus = function() { this.style.borderColor = '#f1c40f'; };
                        noteInput.onblur = function() { this.style.borderColor = '#cbd5e1'; };

                        newCell.appendChild(noteInput);
                    }

                    // Generate a unique row key based on product properties and order
                    const code = row.cells[1] ? row.cells[1].innerText.trim() : '';
                    const name = row.cells[2] ? row.cells[2].innerText.trim() : '';
                    const unit = row.cells[6] ? row.cells[6].innerText.trim() : '';
                    const baseKey = `${code}_${name}_${unit}`;
                    productCounts[baseKey] = (productCounts[baseKey] || 0) + 1;
                    const rowKey = `${baseKey}_${productCounts[baseKey]}`;

                    const noteInput = row.querySelector('.adj-row-note-input');
                    if (noteInput) {
                        // Populate saved note value if it exists in the map
                        if (window.bayanAdjustmentNotes[rowKey] !== undefined) {
                            noteInput.value = window.bayanAdjustmentNotes[rowKey];
                        }

                        // Attach input event to save notes as user types
                        noteInput.oninput = function() {
                            window.bayanAdjustmentNotes[rowKey] = this.value;
                        };
                    }

                    // Fix the delete button to look like a red delete/trash button instead of a blue/generic button
                    const lastCell = row.cells[row.cells.length - 1];
                    if (lastCell) {
                        const btn = lastCell.querySelector('button');
                        if (btn && !btn.dataset.fixedDelete) {
                            btn.dataset.fixedDelete = 'true';
                            btn.style.cssText = 'background: #fee2e2 !important; color: #ef4444 !important; border: 1px solid #fecaca !important; width: 35px; height: 35px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; transition: 0.2s; margin: auto;';
                            btn.innerHTML = '🗑️';
                            btn.onmouseover = function() { this.style.background = '#fecaca !important'; };
                            btn.onmouseout = function() { this.style.background = '#fee2e2 !important'; };
                        }
                    }
                });

                // Sync header badges
                setTimeout(() => {
                    const qtySpan = document.getElementById('adjTotalQty');
                    const totalSpan = document.getElementById('adjGrandTotal');
                    const headerQty = document.getElementById('headerAdjTotalQty');
                    const headerTotal = document.getElementById('headerAdjGrandTotal');
                    
                    if (qtySpan && headerQty) {
                        headerQty.innerText = qtySpan.innerText;
                    }
                    if (totalSpan && headerTotal) {
                        headerTotal.innerText = totalSpan.innerText;
                    }
                }, 50);
            });

            observer.observe(target, { childList: true, subtree: true });
        }

        // Intercept addAdjItem to capture the note value
        let capturedNote = '';
        if (typeof window.addAdjItem === 'function') {
            const originalAddAdjItem = window.addAdjItem;
            window.addAdjItem = function(...args) {
                const noteInput = document.getElementById('adjNotes');
                capturedNote = noteInput ? noteInput.value.trim() : '';
                
                // Run the original function
                originalAddAdjItem.apply(this, args);

                // Set the captured note on the newly added row
                setTimeout(() => {
                    const rows = document.querySelectorAll('#adjTableBody tr');
                    if (rows.length > 0) {
                        const lastRow = rows[rows.length - 1];
                        if (lastRow && !lastRow.querySelector('td[colspan]')) {
                            const code = lastRow.cells[1] ? lastRow.cells[1].innerText.trim() : '';
                            const name = lastRow.cells[2] ? lastRow.cells[2].innerText.trim() : '';
                            const unit = lastRow.cells[6] ? lastRow.cells[6].innerText.trim() : '';
                            const baseKey = `${code}_${name}_${unit}`;
                            
                            // Find count to match the key suffix
                            let count = 0;
                            rows.forEach(r => {
                                const c = r.cells[1] ? r.cells[1].innerText.trim() : '';
                                const n = r.cells[2] ? r.cells[2].innerText.trim() : '';
                                const u = r.cells[6] ? r.cells[6].innerText.trim() : '';
                                if (`${c}_${n}_${u}` === baseKey) count++;
                            });
                            
                            const rowKey = `${baseKey}_${count}`;
                            window.bayanAdjustmentNotes[rowKey] = capturedNote;

                            const noteInRow = lastRow.querySelector('.adj-row-note-input');
                            if (noteInRow) {
                                noteInRow.value = capturedNote;
                            }
                        }
                    }
                    // Clear the quick notes input
                    if (noteInput) noteInput.value = '';
                }, 50);
            };
        }

        // Intercept saveAdjustment to copy row-specific notes to the saved transaction objects
        if (typeof window.saveAdjustment === 'function') {
            const originalSaveAdjustment = window.saveAdjustment;
            window.saveAdjustment = async function(...args) {
                if (typeof window.transactions === 'undefined') {
                    return originalSaveAdjustment.apply(this, args);
                }

                const oldLen = window.transactions.length;

                // Capture all notes from the rows in order
                const rowNotes = [];
                const rows = document.querySelectorAll('#adjTableBody tr');
                rows.forEach(row => {
                    const noteInput = row.querySelector('.adj-row-note-input');
                    if (noteInput) {
                        rowNotes.push(noteInput.value.trim());
                    }
                });

                // Run original save function
                const success = await originalSaveAdjustment.apply(this, args);

                // If save was successful and transactions were added
                if (window.transactions.length > oldLen) {
                    // Map the notes to the newly created transaction objects
                    let noteIdx = 0;
                    for (let i = oldLen; i < window.transactions.length; i++) {
                        if (noteIdx < rowNotes.length) {
                            const itemNote = rowNotes[noteIdx++];
                            if (itemNote) {
                                const originalNote = window.transactions[i].notes || '';
                                window.transactions[i].notes = originalNote 
                                    ? `${originalNote} (${itemNote})` 
                                    : itemNote;
                            }
                        }
                    }
                    // Resave updated transactions to the DB
                    const updatedTxRows = [];
                    for (let i = oldLen; i < window.transactions.length; i++) {
                        updatedTxRows.push(window.transactions[i]);
                    }
                    if (typeof window.saveTransactionChanges === 'function' && updatedTxRows.length > 0) {
                        await window.saveTransactionChanges({
                            newTransactions: updatedTxRows,
                            modifiedProducts: [],
                            modifiedAccounts: []
                        });
                    } else if (typeof window.saveData === 'function') {
                        await window.saveData();
                    }
                    // Reset notes cache on success
                    window.bayanAdjustmentNotes = {};
                }

                return success;
            };
        }
    })();

    // 8. Failsafe to allow decimal/fractional input in any quantity field
    document.addEventListener('focusin', (e) => {
        const target = e.target;
        if (target && target.type === 'number') {
            const id = target.id;
            const isQtyInput = id && (id.toLowerCase().includes('qty') || id.toLowerCase().includes('quantity') || id.toLowerCase().includes('amount') || id.toLowerCase().includes('paid'));
            const isInTable = target.closest('table') !== null;
            if (isQtyInput || isInTable) {
                if (target.getAttribute('min') !== '0') {
                    target.setAttribute('min', '0');
                }
                if (target.getAttribute('step') !== 'any') {
                    target.setAttribute('step', 'any');
                }
            }
        }
    }, true);
})();

/**
 * تصدير احترافي لسندات القبض والصرف إلى Excel & PDF يشمل كافة البيانات الفعلية للسند
 */
function exportVoucherToExcel(voucherType = 'receipt') {
    const isReceipt = voucherType === 'receipt';
    const title = isReceipt ? 'سند قبض' : 'سند صرف';
    
    const id = isReceipt ? (document.getElementById('receiptID')?.value || '1') : (document.getElementById('disburseID')?.value || '1');
    const partner = isReceipt ? (document.getElementById('receiptCustomer')?.value || '-') : (document.getElementById('disbursePayee')?.value || '-');
    const amount = isReceipt ? (document.getElementById('receiptAmount')?.value || '0.00') : (document.getElementById('disburseAmount')?.value || '0.00');
    const notes = isReceipt ? (document.getElementById('receiptNotes')?.value || '-') : (document.getElementById('disburseNotes')?.value || '-');
    const dateStr = isReceipt ? (document.getElementById('receiptDate')?.value || new Date().toISOString().slice(0,10)) : (document.getElementById('disburseDate')?.value || new Date().toISOString().slice(0,10));
    const timeStr = isReceipt ? (document.getElementById('receiptTime')?.value || new Date().toTimeString().slice(0,5)) : (document.getElementById('disburseTime')?.value || new Date().toTimeString().slice(0,5));
    
    const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const d = new Date(dateStr);
    const dayName = isNaN(d.getDay()) ? '-' : dayNames[d.getDay()];
    const userName = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.name : 'المدير العام';

    const XLSXLib = (typeof getXLSXLibrary === 'function' ? getXLSXLibrary() : (typeof XLSX !== 'undefined' ? XLSX : null));
    if (XLSXLib) {
        const data = [
            {
                "رقم السند": id,
                "نوع العملية": title,
                "استلمنا من / صُرف لـ": partner,
                "المبلغ (ج.م)": parseFloat(amount) || 0,
                "اليوم": dayName,
                "التاريخ": dateStr,
                "الوقت": timeStr,
                "البيان / الملاحظات": notes,
                "المستخدم المسؤول": userName
            }
        ];

        const ws = XLSXLib.utils.json_to_sheet(data);
        ws['!dir'] = 'rtl';
        const wb = XLSXLib.utils.book_new();
        XLSXLib.utils.book_append_sheet(wb, ws, title);
        XLSXLib.writeFile(wb, `${title}_${id}.xlsx`);
    } else {
        let csv = "\uFEFFرقم السند,نوع العملية,الجهة / الحساب,المبلغ,اليوم,التاريخ,الوقت,البيان,المستخدم\n";
        csv += `"${id}","${title}","${partner}","${amount}","${dayName}","${dateStr}","${timeStr}","${notes}","${userName}"\n`;
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${title}_${id}.csv`;
        link.click();
    }
    
    if (typeof showToast === 'function') showToast(`✅ تم تصدير ${title} إلى ملف Excel بنجاح`, 'success');
}


