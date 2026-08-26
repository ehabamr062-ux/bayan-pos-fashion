function initPriceTracking() {
    renderPriceTrackingDashboard();
}

async function renderPriceTrackingDashboard() {
    const container = document.getElementById('price-tracking-section');
    if (!container) return;

    // جلب المنتجات المبرمجة أو الافتراضية
    const defaultProducts = [
        { name: "أحمر", field: "r", color: "#ef4444", bg: "#fffafb", border: "#fee2e2" },
        { name: "أبيض", field: "w", color: "#475569", bg: "#f8fafc", border: "#e2e8f0" },
        { name: "بلدي", field: "b", color: "#16a34a", bg: "#f0fdf4", border: "#dcfce7" }
    ];
    const mappedProducts = JSON.parse(getStore('bayan_mapped_products') || JSON.stringify(defaultProducts));

    // جلب البيانات المحفوظة فوراً لوضعها داخل الـ HTML
    const savedData = JSON.parse(getStore('bayan_egg_prices') || '{}');
    const displayDate = savedData.date || '--';

    const boxesHtml = mappedProducts.map(p => `
        <div style="display: flex; align-items: center; gap: 8px; background: ${p.bg}; padding: 6px 12px; border-radius: 8px; border: 1px solid ${p.border}; min-width: 100px;">
            <label style="color:${p.color}; font-size:0.7rem; font-weight:bold;">${p.name}:</label>
            <div id="price_${p.field}" style="color:#1e293b; font-size:1.1rem; font-weight:950;">${savedData[p.field] || '--'}${savedData[p.field] ? ' ج.م' : ''}</div>
        </div>
    `).join('');

    const headersHtml = mappedProducts.map(p => `
        <th style="color:${p.color};">${p.name}</th>
    `).join('');

            container.innerHTML = `
                <div class="products-panel">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px;">
                        <button class="btn-back-home" onclick="switchSection('dashboard')" title="العودة للقائمة الرئيسية">↩️</button>
                        <div class="section-header-box" style="background: linear-gradient(135deg, #2c3e50, #000000); margin:0; display: flex; align-items: center; justify-content: space-between; flex: 1; margin-right: 15px;">
                            <div style="display: flex; align-items: center;">
                                <span class="icon">💰</span>
                                <span class="title">متابعة أسعار المنتجات والربحية</span>
                            </div>
                            <span style="background: #f59e0b; color: #fff; font-size: 0.85rem; font-weight: 900; padding: 4px 15px; border-radius: 12px; letter-spacing: 0.5px;">🚀 سيتم تطوير التطبيق 15/9 إن شاء الله قريباً</span>
                        </div>
                    </div>
                    <!-- بورصة البيض المطورة (Ultra-Compact Strip) -->
                    <div id="eggBursaContainer" onclick="showEggPriceHistory()" style="margin-bottom: 15px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); display: flex; align-items: center; gap: 20px; justify-content: space-between; cursor: pointer; transition: 0.3s;" title="اضغط لعرض سجل الأسعار السابقة">
                        <div style="display: flex; align-items: center; gap: 8px; min-width: 150px;">
                            <span style="font-size: 1.2rem;">🥚</span>
                            <h3 style="margin:0; color:#1e293b; font-size:0.9rem; font-weight: 900; white-space: nowrap;">بورصة الأسعار</h3>
                            <div style="display:flex; gap:5px;">
                                <button class="action-btn" onclick="event.stopPropagation(); fetchEggPrices(this)" style="background:none; border:none; color:#3b82f6; cursor:pointer; font-size:0.8rem; padding:0; font-weight:bold; text-decoration: underline;">تحديث</button>
                                <button class="action-btn" onclick="event.stopPropagation(); showAddMappedProductModal()" style="background:none; border:none; color:#16a34a; cursor:pointer; font-size:0.8rem; padding:0; font-weight:bold; text-decoration: underline;">+ صنف</button>
                            </div>
                        </div>
                        
                        <div style="display: flex; gap: 10px; flex: 1; justify-content: center; flex-wrap: wrap;">
                            ${boxesHtml}
                            <!-- المربع الرابع: التاريخ -->
                            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; background: #fefce8; padding: 6px 15px; border-radius: 8px; border: 1px solid #fef08a; min-width: 140px;">
                                <span style="color:#854d0e; font-size:0.65rem; font-weight:900;">هذا السعر ليوم:</span>
                                <div id="eggDisplayDate" style="color:#1e293b; font-size:0.9rem; font-weight:900;">${displayDate}</div>
                            </div>
                        </div>
                        <div id="ptEggDate" style="font-size:0.6rem; color:#94a3b8; font-weight:bold; min-width: 100px; text-align: left;"></div>
                    </div>

                    <div class="report-filter-bar" style="margin-bottom: 20px; display: grid; grid-template-columns: 1fr 180px; gap: 15px; align-items: center;">
                        <div class="form-group" style="margin:0; position:relative;">
                            <input type="text" id="ptProductSearch" class="search-input" style="height:40px; font-size:0.9rem;" placeholder="🔍 ابحث عن منتج لمعرفة تاريخ أسعاره..." oninput="searchProductForTracking(this.value)">
                            <div id="ptSearchResults" class="search-results" style="display:none; width:100%; top:45px;"></div>
                        </div>
                        <button class="btn-show-report" onclick="renderPriceTrackingDashboard()" style="height:40px; background:#1e293b; color:white; font-size:0.85rem; padding:0 15px; border-radius:10px; font-weight:bold; border:none; cursor:pointer;">♻️ تحديث الكل</button>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 20px;">
                        <!-- الجزء الأيمن: إحصائيات عامة -->
                        <div class="sub-group" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:15px; padding:20px;">
                            <h3 style="color:#1e293b; margin-top:0; border-bottom:2px solid #3b82f6; padding-bottom:8px;">📊 ملخص الربحية</h3>
                            <div id="ptMarketSummary" style="display:flex; flex-direction:column; gap:15px; margin-top:15px;">
                                <!-- سيتم تعبئته -->
                                <div class="loading-spinner">جاري التحليل...</div>
                            </div>
                        </div>

                        <!-- الجزء الأيسر: جدول المنتجات النشطة -->
                        <div class="sub-group" style="background:white; border:1px solid #e2e8f0; border-radius:15px; padding:20px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                                <h3 style="color:#1e293b; margin:0;">📈 حركة الأسعار الأخيرة</h3>
                                <span style="font-size:0.8rem; color:#64748b;">أحدث 10 أصناف تم تحديث تكلفتها</span>
                            </div>
                            <div class="table-container" style="max-height: 500px;">
                                <table class="invoice-table">
                                    <thead>
                                        <tr>
                                            <th>المنتج</th>
                                            <th>آخر تكلفة</th>
                                            <th>سعر البيع</th>
                                            <th>الهامش %</th>
                                            <th>التاريخ</th>
                                        </tr>
                                    </thead>
                                    <tbody id="ptRecentChangesBody">
                                        <!-- سيتم تعبئته -->
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <!-- مودال عرض تاريخ صنف محدد -->
                    <div id="ptHistoryModal" class="modal-overlay hidden" style="z-index: 20000; background:rgba(0,0,0,0.8); ">
                        <div class="modal-content" style="width: 90%; max-width: 1000px; border-radius: 20px; padding: 30px; background: white; border-top: 8px solid var(--accent-gold);">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:25px; border-bottom:1px solid #eee; padding-bottom:15px;">
                                <div>
                                    <h2 id="ptModalProductName" style="margin:0; color:#1e293b;">تاريخ أسعار المنتج</h2>
                                    <span id="ptModalBarcode" style="color:#64748b; font-size:0.9rem;">كود: -</span>
                                </div>
                                <button class="btn-close-modal" onclick="closePtHistoryModal()" style="font-size:1.5rem; background:none; border:none; cursor:pointer;">❌</button>
                            </div>

                            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px;">
                                <div class="amount-box" style="background:#f0f9ff; border:1px solid #bae6fd;">
                                    <label style="color:#0369a1;">أقل تكلفة شراء</label>
                                    <div id="ptMinCost" class="val" style="color:#0369a1;">0.00</div>
                                </div>
                                <div class="amount-box" style="background:#fef2f2; border:1px solid #fecaca;">
                                    <label style="color:#991b1b;">أعلى تكلفة شراء</label>
                                    <div id="ptMaxCost" class="val" style="color:#991b1b;">0.00</div>
                                </div>
                                <div class="amount-box" style="background:#f0fdf4; border:1px solid #bbf7d0;">
                                    <label style="color:#166534;">متوسط سعر البيع</label>
                                    <div id="ptAvgSale" class="val" style="color:#166534;">0.00</div>
                                </div>
                                <div class="amount-box" style="background:var(--accent-gold-bg); border:1px solid var(--accent-gold);">
                                    <label style="color:var(--accent-gold);">متوسط الهامش %</label>
                                    <div id="ptAvgMargin" class="val" style="color:var(--accent-gold);">0%</div>
                                </div>
                            </div>

                            <div class="table-container" style="max-height: 400px; border-radius: 12px; border: 1px solid #f1f5f9;">
                                <table class="invoice-table">
                                    <thead style="background:#f8fafc;">
                                        <tr>
                                            <th>التاريخ</th>
                                            <th>العملية</th>
                                            <th>المورد / الشريك</th>
                                            <th>التكلفة للقطعة</th>
                                            <th>سعر البيع</th>
                                            <th>هامش الربح</th>
                                        </tr>
                                    </thead>
                                    <tbody id="ptHistoryTableBody">
                                        <!-- سيتم تعبئته -->
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <!-- مودال سجل أسعار البيض -->
                    <div id="eggHistoryModal" class="modal-overlay hidden" style="z-index: 20001; background:rgba(0,0,0,0.8); ">
                        <div class="modal-content" style="width: 90%; max-width: 600px; border-radius: 20px; padding: 25px; background: white; border-top: 8px solid #f59e0b;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid #eee; padding-bottom:15px;">
                                <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                                    <h2 style="margin:0; color:#1e293b; font-size:1.1rem;">📜 سجل الأسعار</h2>
                                    <div style="display:flex; align-items:center; gap:8px; background:#f1f5f9; padding:5px 12px; border-radius:10px; border:1px solid #e2e8f0;">
                                        <select id="eggFetchType" onchange="toggleEggDateInputs()" style="border:none; background:none; font-size:0.8rem; font-weight:bold; color:#1e293b; outline:none; cursor:pointer;">
                                            <option value="today">سعر اليوم</option>
                                            <option value="yesterday">سعر أمس</option>
                                            <option value="custom">يوم محدد...</option>
                                        </select>
                                        
                                        <div id="eggCustomDateRange" style="display:none; align-items:center; gap:5px; border-right:1px solid #cbd5e1; padding-right:10px; margin-right:5px;">
                                            <label style="font-size:0.65rem; color:#64748b;">اختر التاريخ:</label>
                                            <input type="date" id="eggDateFrom" style="border:none; background:none; font-size:0.75rem; font-weight:bold;">
                                        </div>

                                        <button onclick="fetchEggPriceByDate()" id="fetchByDateBtn" style="background:#3b82f6; color:white; border:none; padding:5px 15px; border-radius:8px; font-size:0.75rem; font-weight:bold; cursor:pointer; transition:0.3s;">جلب السعر</button>
                                    </div>
                                </div>
                                <button class="btn-close-modal" onclick="closeEggHistoryModal()" style="font-size:1.5rem; background:none; border:none; cursor:pointer;">❌</button>
                            </div>
                            <div class="table-container" style="max-height: 450px; border-radius: 12px;">
                                <table class="invoice-table">
                                    <thead style="background:#fefce8;">
                                        <tr>
                                            <th>التاريخ</th>
                                            ${headersHtml}
                                        </tr>
                                    </thead>
                                    <tbody id="eggHistoryTableBody">
                                        <!-- سيتم تعبئته من localStorage -->
                                    </tbody>
                                </table>
                            </div>
                            <div style="margin-top:15px; text-align:center; font-size:0.8rem; color:#64748b;">يتم حفظ السعر في السجل تلقائياً عند كل تحديث جديد</div>
                        </div>
                    </div>
                    <!-- مودال إضافة صنف للبورصة -->
                    <div id="addMappedProductModal" class="modal-overlay hidden" style="z-index: 20002; background:rgba(0,0,0,0.8); ">
                        <div class="modal-content" style="width: 90%; max-width: 400px; border-radius: 20px; padding: 25px; background: white; border-top: 8px solid #16a34a;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid #eee; padding-bottom:15px;">
                                <h2 style="margin:0; color:#1e293b; font-size:1.1rem;">➕ إضافة صنف للبورصة</h2>
                                <button class="btn-close-modal" onclick="closeAddMappedProductModal()" style="font-size:1.5rem; background:none; border:none; cursor:pointer;">❌</button>
                            </div>
                            <div style="display:flex; flex-direction:column; gap:15px;">
                                <div class="form-group">
                                    <label style="font-weight:bold; color:#475569;">اسم الصنف (محلياً):</label>
                                    <input type="text" id="newMappedName" placeholder="مثلاً: علف بادي" style="width:100%; height:40px; border:1px solid #cbd5e1; border-radius:8px; padding:0 10px;">
                                </div>
                                <div class="form-group">
                                    <label style="font-weight:bold; color:#475569;">كود الحقل في البورصة:</label>
                                    <input type="text" id="newMappedField" placeholder="مثلاً: f أو feed" style="width:100%; height:40px; border:1px solid #cbd5e1; border-radius:8px; padding:0 10px;">
                                </div>
                                <button onclick="saveMappedProduct()" style="height:40px; background:#16a34a; color:white; border:none; border-radius:10px; font-weight:bold; cursor:pointer; transition:0.3s;">حفظ الصنف</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            loadPriceTrackingData();
            
            // جلب أسعار البيض عند التحميل
            fetchEggPrices();
        }

        async function fetchEggPrices(btn = null) {
            const dateEl = document.getElementById('ptEggDate');
            const eggDateBox = document.getElementById('eggDisplayDate');
            
            const defaultProducts = [
                { name: "أحمر", field: "r", color: "#ef4444", bg: "#fffafb", border: "#fee2e2" },
                { name: "أبيض", field: "w", color: "#475569", bg: "#f8fafc", border: "#e2e8f0" },
                { name: "بلدي", field: "b", color: "#16a34a", bg: "#f0fdf4", border: "#dcfce7" }
            ];
            const mappedProducts = JSON.parse(getStore('bayan_mapped_products') || JSON.stringify(defaultProducts));

            // محاولة تحميل البيانات المحفوظة أولاً
            const savedData = getStore('bayan_egg_prices');
            const today = new Date().toLocaleDateString('en-CA');
            
            if (!btn && savedData) {
                const data = JSON.parse(savedData);
                
                mappedProducts.forEach(p => {
                    const el = document.getElementById(`price_${p.field}`);
                    if (el && data[p.field]) el.innerText = data[p.field] + ' ج.م';
                });
                
                if (eggDateBox) eggDateBox.innerText = data.date || '--';

                if (dateEl) {
                    const isOld = data.date !== today;
                    dateEl.innerHTML = isOld ? 
                        `<span style="color:#ef4444; font-weight:900;">⚠️ سعر منتهي</span>` : 
                        `(تحديث: ${data.time})`;
                }
                if (data.date === today) return;
            }

            if (btn) btn.innerHTML = '⌛ جاري الجلب...';
            
            try {
                const apiUrl = `https://firestore.googleapis.com/v1/projects/bursa-c6eef/databases/(default)/documents/prices/${today}`;
                
                const response = await fetch(apiUrl);
                if (!response.ok) throw new Error("Firestore API error");
                
                const data = await response.json();
                
                if (data.fields) {
                    const prices = {
                        date: today,
                        time: new Date().toLocaleTimeString('ar-EG')
                    };
                    
                    mappedProducts.forEach(p => {
                        if (data.fields[p.field]) {
                            prices[p.field] = data.fields[p.field].stringValue;
                        }
                    });

                    // حفظ في الذاكرة المحلية (السعر الحالي)
                    setStore('bayan_egg_prices', JSON.stringify(prices));
                    
                    // تحديث السجل التاريخي
                    updateEggPriceHistory(prices);
                    
                    mappedProducts.forEach(p => {
                        const el = document.getElementById(`price_${p.field}`);
                        if (el) el.innerText = (prices[p.field] || '??') + ' ج.م';
                    });
                    
                    if (eggDateBox) eggDateBox.innerText = prices.date;
                    if (dateEl) dateEl.innerText = `(تحديث: ${prices.time})`;
                }

            } catch (error) {
                console.error("❌ فشل جلب أسعار البيض من البورصة الخاصة:", error);
                mappedProducts.forEach(p => {
                    const el = document.getElementById(`price_${p.field}`);
                    if (el && el.innerText === '--') el.innerText = 'خطأ اتصال';
                });
            } finally {
                if (btn) btn.innerHTML = '🔄 تحديث الأسعار';
            }
        }

        async function loadPriceTrackingData() {
            const recentBody = document.getElementById('ptRecentChangesBody');
            const summaryDiv = document.getElementById('ptMarketSummary');
            if (!recentBody || !summaryDiv) return;

            // 1. جلب التغييرات الأخيرة في التكلفة (من transactions نوع شراء)
            const purTrans = transactions.filter(t => t.type.includes('شراء') && !t.type.includes('مرتجع')).reverse();
            
            // نريد فريد حسب المنتج لأحدث سعر شراء
            const uniqueProducts = [];
            const seen = new Set();
            for (const t of purTrans) {
                if (!seen.has(t.product)) {
                    uniqueProducts.push(t);
                    seen.add(t.product);
                }
                if (uniqueProducts.length >= 15) break;
            }

            recentBody.innerHTML = uniqueProducts.map(t => {
                const product = productsDB.find(p => p.name === t.product);
                const cost = parseFloat(t.price);
                const sale = product ? parseFloat(product.price) : 0;
                const margin = sale > 0 ? ((sale - cost) / sale * 100).toFixed(1) : 0;
                const marginColor = margin < 10 ? '#ef4444' : (margin > 30 ? '#10b981' : '#f59e0b');

                return `
                    <tr onclick="viewProductPriceHistory('${t.product.replace(/'/g, "\\'")}')" style="cursor:pointer;">
                        <td><strong>${t.product}</strong></td>
                        <td>${cost.toFixed(2)}</td>
                        <td>${sale.toFixed(2)}</td>
                        <td><span style="color:${marginColor}; font-weight:bold;">${margin}%</span></td>
                        <td style="font-size:0.8rem; color:#64748b;">${t.date}</td>
                    </tr>
                `;
            }).join('') || '<tr><td colspan="5" style="text-align:center;">لا توجد عمليات شراء مؤخراً</td></tr>';

            // 2. تحليل الملخص
            let totalProducts = productsDB.length;
            let lowMargin = productsDB.filter(p => {
                const cost = parseFloat(p.cost) || 0;
                const sale = parseFloat(p.price) || 0;
                return sale > 0 && ((sale - cost) / sale < 0.1); // أقل من 10%
            }).length;

            summaryDiv.innerHTML = `
                <div style="background:white; padding:15px; border-radius:10px; border-right:4px solid #3b82f6;">
                    <span style="display:block; font-size:0.8rem; color:#64748b;">إجمالي الأصناف المرصودة</span>
                    <span style="font-size:1.5rem; font-weight:900; color:#1e293b;">${totalProducts} صنف</span>
                </div>
                <div style="background:white; padding:15px; border-radius:10px; border-right:4px solid #ef4444;">
                    <span style="display:block; font-size:0.8rem; color:#64748b;">أصناف بهامش ربح ضعيف (<10%)</span>
                    <span style="font-size:1.5rem; font-weight:900; color:#ef4444;">${lowMargin} صنف</span>
                </div>
                <div style="background:white; padding:15px; border-radius:10px; border-right:4px solid #10b981;">
                    <span style="display:block; font-size:0.8rem; color:#64748b;">الأكثر مبيعاً هذا الشهر</span>
                    <span style="font-size:1rem; font-weight:bold; color:#1e293b;">سيتم الربط مع المبيعات</span>
                </div>
            `;
        }

        function searchProductForTracking(query) {
            const results = document.getElementById('ptSearchResults');
            if (!query.trim()) { results.style.display = 'none'; return; }

            const matches = productsDB.filter(p => p.name.includes(query) || (p.barcode && p.barcode.includes(query))).slice(0, 10);
            if (matches.length > 0) {
                results.style.display = 'block';
                results.innerHTML = matches.map(p => `
                    <div class="result-item" onclick="viewProductPriceHistory('${p.name.replace(/'/g, "\\'")}'); document.getElementById('ptProductSearch').value=''; document.getElementById('ptSearchResults').style.display='none';">
                        <span>${p.name}</span>
                        <span style="font-size:0.8rem; opacity:0.6;">بيبي: ${p.price.toFixed(2)} | شراء: ${p.cost.toFixed(2)}</span>
                    </div>
                `).join('');
            } else {
                results.style.display = 'none';
            }
        }

        function viewProductPriceHistory(productName) {
            const product = productsDB.find(p => p.name === productName);
            if (!product) return;

            document.getElementById('ptModalProductName').innerText = product.name;
            document.getElementById('ptModalBarcode').innerText = `كود: ${product.barcode || '-'}`;
            
            // تصفية كل العمليات المتعلقة بهذا الصنف
            const prodTrans = transactions.filter(t => t.product === productName && (t.type.includes('شراء') || t.type.includes('بيع') || t.type.includes('تسوية')));
            
            const tableBody = document.getElementById('ptHistoryTableBody');
            let historyHTML = "";

            let costs = [];
            let sales = [];
            let margins = [];

            prodTrans.reverse().forEach(t => {
                const type = t.type;
                const isPurchase = type.includes('شراء');
                const costVal = isPurchase ? parseFloat(t.price) : (product.cost || 0); // تقديري للبيع
                const saleVal = !isPurchase ? parseFloat(t.price) : (product.price || 0);
                
                if (isPurchase) costs.push(costVal);
                if (!isPurchase) sales.push(saleVal);
                
                const margin = saleVal > 0 ? ((saleVal - costVal) / saleVal * 100).toFixed(1) : 0;
                margins.push(parseFloat(margin));

                historyHTML += `
                    <tr>
                        <td style="white-space:nowrap; font-size:0.85rem;">${t.date}</td>
                        <td><span class="stock-badge ${isPurchase ? 'badge-purchase' : 'badge-sale'}">${type}</span></td>
                        <td>${t.partner || '-'}</td>
                        <td style="font-weight:bold; color:${isPurchase?'#3b82f6':''}">${parseFloat(t.price).toFixed(2)}</td>
                        <td>${product.price.toFixed(2)}</td>
                        <td><span style="font-weight:bold; color:${margin < 10 ? '#ef4444' : '#10b981'}">${margin}%</span></td>
                    </tr>
                `;
            });

            tableBody.innerHTML = historyHTML || '<tr><td colspan="6" style="text-align:center; padding:30px; color:#64748b;">لا توجد حركة مسجلة لهذا الصنف حتى الآن.</td></tr>';

            // معلومات إحصائية
            document.getElementById('ptMinCost').innerText = costs.length > 0 ? Math.min(...costs).toFixed(2) : '0.00';
            document.getElementById('ptMaxCost').innerText = costs.length > 0 ? Math.max(...costs).toFixed(2) : '0.00';
            document.getElementById('ptAvgSale').innerText = sales.length > 0 ? (sales.reduce((a,b)=>a+b,0)/sales.length).toFixed(2) : product.price.toFixed(2);
            document.getElementById('ptAvgMargin').innerText = margins.length > 0 ? (margins.reduce((a,b)=>a+b,0)/margins.length).toFixed(1) + '%' : '0%';

            document.getElementById('ptHistoryModal').classList.remove('hidden');
        }

        function closePtHistoryModal() {
            document.getElementById('ptHistoryModal').classList.add('hidden');
        }

        // --- سجل أسعار البيض التاريخي ---
        function updateEggPriceHistory(newPrices) {
            let history = JSON.parse(getStore('bayan_egg_history') || '[]');
            
            // تحقق إذا كان التاريخ موجوداً مسبقاً، لو موجود حدثه، لو مش موجود ضيفه
            const index = history.findIndex(h => h.date === newPrices.date);
            if (index > -1) {
                history[index] = newPrices;
            } else {
                history.push(newPrices);
            }
            
            // ترتيب السجل بحيث يكون التاريخ الأحدث في الأعلى
            history.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            // الاحتفاظ بآخر 100 سجل لتوفير المساحة
            if (history.length > 100) history = history.slice(0, 100);
            
            setStore('bayan_egg_history', JSON.stringify(history));
        }

        function showEggPriceHistory() {
            const modal = document.getElementById('eggHistoryModal');
            const tbody = document.getElementById('eggHistoryTableBody');
            if (!modal || !tbody) return;

            const history = JSON.parse(getStore('bayan_egg_history') || '[]');
            
            const defaultProducts = [
                { name: "أحمر", field: "r", color: "#ef4444" },
                { name: "أبيض", field: "w", color: "#475569" },
                { name: "بلدي", field: "b", color: "#16a34a" }
            ];
            const mappedProducts = JSON.parse(getStore('bayan_mapped_products') || JSON.stringify(defaultProducts));

            if (history.length === 0) {
                tbody.innerHTML = `<tr><td colspan="${mappedProducts.length + 1}" style="text-align:center; padding:20px; color:#94a3b8;">لا يوجد سجل أسعار محفوظ حتى الآن</td></tr>`;
            } else {
                tbody.innerHTML = history.map(h => {
                    const cellsHtml = mappedProducts.map(p => {
                        const val = h[p.field] || (p.field === 'r' ? h.red : '') || (p.field === 'w' ? h.white : '') || (p.field === 'b' ? h.baladi : '') || '--';
                        return `<td style="color:${p.color}; font-weight:bold;">${val}</td>`;
                    }).join('');
                    
                    return `
                        <tr>
                            <td style="font-weight:900; font-size:0.85rem;">${h.date}</td>
                            ${cellsHtml}
                        </tr>
                    `;
                }).join('');
            }

            modal.classList.remove('hidden');
        }

        function closeEggHistoryModal() {
            document.getElementById('eggHistoryModal').classList.add('hidden');
        }

        function toggleEggDateInputs() {
            const type = document.getElementById('eggFetchType').value;
            const customRange = document.getElementById('eggCustomDateRange');
            customRange.style.display = (type === 'custom') ? 'flex' : 'none';
        }

        // --- جلب سعر يوم محدد من الأرشيف ---
        async function fetchEggPriceByDate() {
            const type = document.getElementById('eggFetchType').value;
            const btn = document.getElementById('fetchByDateBtn');
            const originalText = btn.innerText;
            
            let datesToFetch = [];
            const today = new Date();

            if (type === 'today') {
                datesToFetch.push(today.toLocaleDateString('en-CA'));
            } else if (type === 'yesterday') {
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                datesToFetch.push(yesterday.toLocaleDateString('en-CA'));
            } else {
                const from = document.getElementById('eggDateFrom').value;
                if (!from) {
                    showNotifications('⚠️ يرجى اختيار التاريخ أولاً', 'warning');
                    return;
                }
                datesToFetch.push(from);
            }

            btn.innerText = '⏳ جاري البحث...';
            btn.disabled = true;

            let successCount = 0;
            try {
                for (const targetDate of datesToFetch) {
                    const apiUrl = `https://firestore.googleapis.com/v1/projects/bursa-c6eef/databases/(default)/documents/prices/${targetDate}`;
                    
                    const response = await fetch(apiUrl);
                    if (response.ok) {
                        const data = await response.json();
                        if (data.fields) {
                            const prices = {
                                red: data.fields.r ? data.fields.r.stringValue : null,
                                white: data.fields.w ? data.fields.w.stringValue : null,
                                baladi: data.fields.b ? data.fields.b.stringValue : null,
                                date: targetDate,
                                time: "مسترجع"
                            };
                            updateEggPriceHistory(prices);
                            successCount++;
                        }
                    }
                }

                if (successCount > 0) {
                    showNotifications(`✅ تم جلب السعر بنجاح`, 'success');
                    showEggPriceHistory(); // تحديث الجدول فوراً
                } else {
                    showNotifications('⚠️ لم نجد أسعار لهذا التاريخ في الموقع', 'warning');
                }
            } catch (error) {
                console.error("Fetch error:", error);
                showNotifications('❌ فشل الاتصال بالموقع', 'error');
            } finally {
                btn.innerText = originalText;
                btn.disabled = false;
            }
        }
        function showAddMappedProductModal() {
            const modal = document.getElementById('addMappedProductModal');
            if (modal) modal.classList.remove('hidden');
        }

        function closeAddMappedProductModal() {
            const modal = document.getElementById('addMappedProductModal');
            if (modal) modal.classList.add('hidden');
        }

        function saveMappedProduct() {
            const nameEl = document.getElementById('newMappedName');
            const fieldEl = document.getElementById('newMappedField');
            
            if (!nameEl || !fieldEl) return;
            
            const name = nameEl.value.trim();
            const field = fieldEl.value.trim();
            
            if (!name || !field) {
                showNotifications('⚠️ يرجى إدخال اسم الصنف وكود الحقل', 'warning');
                return;
            }
            
            const defaultProducts = [
                { name: "أحمر", field: "r", color: "#ef4444", bg: "#fffafb", border: "#fee2e2" },
                { name: "أبيض", field: "w", color: "#475569", bg: "#f8fafc", border: "#e2e8f0" },
                { name: "بلدي", field: "b", color: "#16a34a", bg: "#f0fdf4", border: "#dcfce7" }
            ];
            
            let mappedProducts = JSON.parse(getStore('bayan_mapped_products') || JSON.stringify(defaultProducts));
            
            // تحقق إذا كان الكود مضاف مسبقاً
            if (mappedProducts.some(p => p.field === field)) {
                showNotifications('⚠️ هذا الكود مضاف مسبقاً', 'warning');
                return;
            }
            
            // ألوان عشوائية أو افتراضية للمنتج الجديد
            const colors = ["#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"];
            const randomColor = colors[Math.floor(Math.random() * colors.length)];
            
            mappedProducts.push({
                name: name,
                field: field,
                color: randomColor,
                bg: "#f8fafc",
                border: "#e2e8f0"
            });
            
            setStore('bayan_mapped_products', JSON.stringify(mappedProducts));
            
            showNotifications('✅ تم حفظ الصنف الجديد بنجاح', 'success');
            closeAddMappedProductModal();
            
            // إعادة بناء الشاشة لعرض الصنف الجديد
            renderPriceTrackingDashboard();
        }

        window.showAddMappedProductModal = showAddMappedProductModal;
        window.closeAddMappedProductModal = closeAddMappedProductModal;
        window.saveMappedProduct = saveMappedProduct;
