// ============================================================
//  الآلة الحاسبة المتقدمة وسجل الحسابات (Advanced Calculator Engine)
// ============================================================
    window.toggleMaximizeCalculator = function() {
        const modal = document.getElementById('royalCalculator');
        const btn = document.getElementById('maximizeCalcBtn');
        if (!modal) return;

        modal.classList.toggle('maximized');
        if (modal.classList.contains('maximized')) {
            modal.style.top = '';
            modal.style.left = '';
            modal.style.transform = '';
            if (btn) btn.innerText = '🔳';
        } else {
            modal.style.top = '50%';
            modal.style.left = '50%';
            modal.style.transform = 'translate(-50%, -50%) scale(0.9)';
            if (btn) btn.innerText = '🔲';
        }
    };

    function toggleCalculator() {
        const modal = document.getElementById('royalCalculator');
        const bubble = document.getElementById('calcBubble');
        if (!modal) return;

        // تحميل السجل فقط عند الفتح لأول مرة لضمان اكتمال تجهيز قاعدة البيانات
        if (!isCalcHistoryLoaded) {
            calcHistory = JSON.parse(getStore('bayan_calc_history') || '[]');
            isCalcHistoryLoaded = true;
        }

        modal.classList.toggle('visible');
        if (modal.classList.contains('visible')) {
            bubble.classList.remove('visible');
            calcClear();
            renderCalcHistory();
            makeDraggable(modal, document.getElementById('calcHeader'));

            let existingTab = openTabs.find(t => t.id === 'calculator');
            if (!existingTab) {
                openTabs.push({ id: 'calculator', type: 'calculator', label: '🧮 الحاسبة' });
            }
            activeTabId = 'calculator';
            renderTabs();
        } else {
            openTabs = openTabs.filter(t => t.id !== 'calculator');
            if (activeTabId === 'calculator') {
                activeTabId = 'dashboard';
            }
            renderTabs();
        }
    }

    function minimizeCalculator() {
        const modal = document.getElementById('royalCalculator');
        const bubble = document.getElementById('calcBubble');
        modal.classList.remove('visible');
        bubble.classList.add('visible');
        makeDraggable(bubble, bubble);

        if (activeTabId === 'calculator') {
            activeTabId = 'dashboard';
        }
        renderTabs();
    }

    function restoreCalculator() {
        const modal = document.getElementById('royalCalculator');
        const bubble = document.getElementById('calcBubble');
        bubble.classList.remove('visible');
        modal.classList.add('visible');
        makeDraggable(modal, document.getElementById('calcHeader'));

        let existingTab = openTabs.find(t => t.id === 'calculator');
        if (!existingTab) {
            openTabs.push({ id: 'calculator', type: 'calculator', label: '🧮 الحاسبة' });
        }
        activeTabId = 'calculator';
        renderTabs();
    }

    // دالة السحب والإفلات العالمية (Ultra-Fast Draggable Logic)
    function makeDraggable(el, handle) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        handle.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            if (el.classList.contains('maximized')) return;
            e = e || window.event;
            // e.preventDefault(); // تم التعطيل للسماح بلمس الأزرار
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;

            // منع تحديد النصوص أثناء السحب
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'move';
        }

        function elementDrag(e) {
            e = e || window.event;
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;

            // سحب فوري بدون أي تأخير (Zero Latency) لإحساس بالخفة التامة
            el.style.top = (el.offsetTop - pos2) + "px";
            el.style.left = (el.offsetLeft - pos1) + "px";
            el.style.bottom = "auto"; 
            el.style.right = "auto";
            el.style.margin = "0";
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
            // إعادة السماح بتحديد النصوص
            document.body.style.userSelect = 'auto';
            document.body.style.cursor = 'default';
        }
    }

    function calcAppend(val) {
        const current = document.getElementById('calc-current');
        const prev = document.getElementById('calc-prev');

        if (val === '%' && calcExpression === "") return;

        // منع تكرار العمليات الحسابية المتتالية
        const lastChar = calcExpression.slice(-1);
        const ops = ['+', '-', '*', '/', '%'];
        if (ops.includes(val) && ops.includes(lastChar)) {
            calcExpression = calcExpression.slice(0, -1) + val;
        } else {
            calcExpression += val;
        }

        current.innerText = calcExpression || "0";
    }

    function calcClear() {
        calcExpression = "";
        document.getElementById('calc-current').innerText = "0";
        document.getElementById('calc-prev').innerText = "";
    }

    function calcDelete() {
        calcExpression = calcExpression.slice(0, -1);
        document.getElementById('calc-current').innerText = calcExpression || "0";
    }

    // ✅ أمان: محلل رياضي آمن يمنع Code Injection في بيئة Electron
    // eval() خطير في Electron لأنه يملك صلاحيات Node.js (قراءة/حذف ملفات)
    function safeMathEval(expr) {
        // السماح فقط بالأرقام والعمليات الرياضية الأساسية والأقواس والنقطة العشرية
        if (!/^[\d\s\+\-\*\/\.\(\)]+$/.test(expr)) {
            throw new Error('تعبير غير مسموح به');
        }
        // تنفيذ آمن داخل نطاق محدود بدون وصول للـ globals
        return Function('"use strict"; return (' + expr + ')')();
    }

    function calcResult() {
        const current = document.getElementById('calc-current');
        const prev = document.getElementById('calc-prev');
        if (calcExpression === "") return;

        try {
            // استبدال الرموز للعرض الصحيح قبل الحساب
            let finalExpr = calcExpression.replace(/×/g, '*').replace(/÷/g, '/');
            const result = safeMathEval(finalExpr);

            // إضافة للسجل
            const historyItem = { expr: calcExpression, res: result, time: new Date().toLocaleTimeString('ar-EG') };
            calcHistory.unshift(historyItem);
            if (calcHistory.length > 20) calcHistory.pop();
            setStore('bayan_calc_history', JSON.stringify(calcHistory));

            prev.innerText = calcExpression + " =";
            current.innerText = result;
            calcExpression = result.toString();
            renderCalcHistory();
        } catch (e) {
            current.innerText = "Error";
            setTimeout(calcClear, 1000);
        }
    }

    function loadCalcHistory() {
        try {
            const stored = getStore('bayan_calc_history');
            calcHistory = stored ? JSON.parse(stored) : [];
        } catch (e) {
            calcHistory = [];
        }
    }

    function toggleCalcHistory() {
        const area = document.getElementById('calcHistoryArea');
        if (!area) return;

        loadCalcHistory();
        renderCalcHistory();
        area.classList.toggle('visible');
    }

    function clearCalcHistory() {
        if (confirm("هل أنت متأكد من مسح سجل العمليات بالكامل؟")) {
            calcHistory = [];
            setStore('bayan_calc_history', JSON.stringify(calcHistory));
            renderCalcHistory();
            if (typeof showToast === 'function') showToast("🗑️ تم تصفير السجل بنجاح", "info");
        }
    }

    function renderCalcHistory() {
        const area = document.getElementById('calcHistoryArea');
        if (!area) return;
        
        if (!calcHistory || calcHistory.length === 0) {
            area.innerHTML = '<div style="color:#94a3b8; font-size:0.9rem; text-align:center; padding:15px; font-weight:bold;">📭 لا يوجد سجل عمليات محفوظة حتى الآن</div>';
            return;
        }

        area.innerHTML = calcHistory.map((item, idx) => `
            <div class="history-item" onclick="useCalcHistory(${idx})" title="اضغط لاستخدام هذه النتيجة">
                <span style="color: #cbd5e1; font-weight: 700; font-size: 0.9rem;">${item.expr}</span>
                <span style="color: #38bdf8; font-weight: 900; font-size: 1.1rem;">= ${item.res}</span>
            </div>
        `).join('');
    }

    function useCalcHistory(idx) {
        const item = calcHistory[idx];
        if (item) {
            calcExpression = item.res.toString();
            document.getElementById('calc-current').innerText = calcExpression;
            document.getElementById('calc-prev').innerText = item.expr + " =";
        }
    }

    function copyCalcResult() {
        const current = document.getElementById('calc-current');
        const display = document.getElementById('calcDisplay');
        if (!current || current.innerText === "0" || current.innerText === "") return;

        const textToCopy = current.innerText;
        navigator.clipboard.writeText(textToCopy).then(() => {
            // تفعيل الوميض الأخضر
            if (display) {
                display.classList.add('copied');
                setTimeout(() => display.classList.remove('copied'), 400);
            }
            showToast("✅ تم نسخ الرقم: " + textToCopy, "success");
        }).catch(err => {
            console.error('فشل النسخ: ', err);
        });
    }

    // دعم لوحة المفاتيح للآلة الحاسبة
    window.addEventListener('keydown', (e) => {
        const modal = document.getElementById('royalCalculator');
        if (!modal || !modal.classList.contains('visible')) return;

        if (e.key >= '0' && e.key <= '9') calcAppend(e.key);
        if (e.key === '+') calcAppend('+');
        if (e.key === '-') calcAppend('-');
        if (e.key === '*') calcAppend('*');
        if (e.key === '/') { e.preventDefault(); calcAppend('/'); }
        if (e.key === '.') calcAppend('.');
        if (e.key === '%') calcAppend('%');
        if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); calcResult(); }
        if (e.key === 'Backspace') calcDelete();
        if (e.key === 'Escape') toggleCalculator();
    });
