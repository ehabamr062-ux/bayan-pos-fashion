// ============================================================
//  المساعد الذكي الصوتي والمحادثة (AI Copilot & Smart Assistant)
// ============================================================
        window.aiConversationHistory = [];

        function toggleAICopilot() {
            const drawer = document.getElementById('aiCopilotDrawer');
            if (!drawer) return;

            const isHidden = drawer.style.right === '-420px' || drawer.style.right === '';
            if (isHidden) {
                drawer.style.right = '0px';
                // فحص توفر مفتاح الـ API
                const key = getStore('bayan_gemini_key') || '';
                const alertBox = document.getElementById('aiKeyAlertBox');
                if (!key) {
                    if (alertBox) alertBox.style.display = 'block';
                } else {
                    if (alertBox) alertBox.style.display = 'none';
                }
                setTimeout(() => {
                    document.getElementById('aiChatInput').focus();
                }, 400);
            } else {
                drawer.style.right = '-420px';
                if (isAIVoiceActive) stopAIVoice();
            }
        }

        async function saveQuickAIKey() {
            const key = document.getElementById('aiQuickApiKeyInput').value.trim();
            if (!key) return alert('⚠️ يرجى إدخال مفتاح API صحيح');
            // ✅ أمان: حفظ في IndexedDB (لا يظهر في F12)
            try {
                if (typeof db !== 'undefined' && db.settings) {
                    await db.settings.put({ id: 'gemini_key', value: key });
                    removeStore('bayan_gemini_key'); // حذف القديم
                }
            } catch(e) {
                setStore('bayan_gemini_key', key); // fallback
            }

            const settingsInput = document.getElementById('geminiApiKeyInput');
            if (settingsInput) settingsInput.value = key;

            document.getElementById('aiKeyAlertBox').style.display = 'none';
            showToast('🔑 تم حفظ مفتاح الـ API وتفعيل المساعد بنجاح!', 'success');
        }

        function getAILocalDatabaseContext() {
            // 1. الحسابات والأرصدة (تقليص لأهم/أول 50 حساب لتجنب تجاوز الحد)
            const accountsList = (window.accounts || []).slice(0, 50).map(a => {
                const bal = typeof getAccountBalance === 'function' ? getAccountBalance(a.name) : 0;
                return `- ${a.name} (${a.type}): رصيده ${bal.toFixed(2)} ج.م (إذا كان الرصيد موجب فله فلوس/دائن، سالب عليه فلوس/مدين)`;
            }).join('\n') + (window.accounts && window.accounts.length > 50 ? '\n... (تم تقليص القائمة لـ 50 حساب)' : '');

            // 2. المنتجات والمخزون (تقليص لأول 100 منتج)
            const hasPurchasePerm = checkPermission('docs_purchase_price');
            const productsList = (window.productsDB || []).slice(0, 100).map(p => {
                const costInfo = hasPurchasePerm ? `, سعر التكلفة: ${p.cost || p.cost_price || 0} ج.م` : '';
                return `- ${p.name} (كود: ${p.code || '---'}, باركود: ${p.barcode || '---'}): المخزون العام: ${p.stock || 0} ${p.unit || 'قطعة'}, سعر البيع: ${p.price || 0} ج.م${costInfo}, الرف: ${p.shelf || 'غير محدد'}`;
            }).join('\n') + (window.productsDB && window.productsDB.length > 100 ? '\n... (تم تقليص القائمة لـ 100 صنف)' : '');

            // 3. ملخص الفواتير الأخيرة (آخر 30 عملية)
            const recentTransactions = (window.transactions || []).slice(-30).map(t => {
                return `- فاتورة #${t.invoiceId || 'بدون'} | التاريخ: ${t.date} | النوع: ${t.type} | الطرف: ${t.partner || 'عام'} | الإجمالي: ${t.total || t.price || 0} ج.م | الطريقة: ${t.method || 'نقدي'}`;
            }).join('\n');

            // 4. حالة النظام
            const activeTab = window.activeTabId || 'dashboard';
            const activeWarehouse = (window.currentUser && window.currentUser.warehouseName) ? window.currentUser.warehouseName : 'المخزن الرئيسي';
            const user = (window.currentUser && window.currentUser.name) ? window.currentUser.name : 'المدير';

            return `
=== حالة النظام الحالية ===
- المستخدم الحالي: ${user}
- التبويب المفتوح حالياً: ${activeTab}
- المستودع/المخزن النشط: ${activeWarehouse}
- صلاحية رؤية التكلفة/الأرباح: ${hasPurchasePerm ? 'مسموح' : 'غير مسموح (محجوب)'}

=== قائمة العملاء والموردين وأرصدتهم الحالية ===
${accountsList || 'لا يوجد حسابات مسجلة حالياً.'}

=== قائمة المنتجات والأسعار والمخزون الحالي ===
${productsList || 'لا يوجد أصناف في المخزن حالياً.'}

=== ملخص آخر 30 حركة مالية وفواتير ===
${recentTransactions || 'لا يوجد فواتير مسجلة حالياً.'}
`;
        }

        const AI_LIMIT_12H = 4;
        const AI_LIMIT_WEEKLY = 28;

        window.getGeminiApiKeys = async function() {
            let apiKeys = [];
            // ✅ أمان: نقرأ مفتاح AI من IndexedDB أولاً (لا يظهر في F12)
            try {
                if (typeof db !== 'undefined' && db.settings) {
                    const stored = await db.settings.get('gemini_key');
                    if (stored && stored.value) {
                        apiKeys = stored.value.split(/[\s,;\|]+/).map(k => k.trim()).filter(Boolean);
                    }
                }
            } catch(e) {}

            // Fallback: localStorage (migration من النظام القديم)
            if (apiKeys.length === 0) {
                const userKeys = getStore('bayan_gemini_key');
                if (userKeys) {
                    apiKeys = userKeys.split(/[\s,;\|]+/).map(k => k.trim()).filter(Boolean);
                    // نقل تلقائيلـ IndexedDB وحذف من localStorage
                    try {
                        if (typeof db !== 'undefined' && db.settings) {
                            await db.settings.put({ id: 'gemini_key', value: userKeys });
                            removeStore('bayan_gemini_key');
                        }
                    } catch(e) {}
                }
            }

            if (apiKeys.length === 0) {
                apiKeys = [];
            }
            return apiKeys;
        };

        function checkAILimits() {
            let usage = JSON.parse(getStore('bayan_ai_usage'));
            if (!usage) {
                usage = {
                    currentCount: 0,
                    lastResetTime: Date.now(),
                    weeklyCount: 0,
                    weeklyResetTime: Date.now()
                };
            }

            const now = Date.now();
            const twelveHoursMs = 12 * 60 * 60 * 1000;
            const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

            if (now - usage.lastResetTime >= twelveHoursMs) {
                usage.currentCount = 0;
                usage.lastResetTime = now;
            }
            if (now - usage.weeklyResetTime >= sevenDaysMs) {
                usage.weeklyCount = 0;
                usage.weeklyResetTime = now;
            }

            setStore('bayan_ai_usage', JSON.stringify(usage));
            return usage;
        }

        function incrementAIUsage() {
            let usage = checkAILimits();
            usage.currentCount++;
            usage.weeklyCount++;
            setStore('bayan_ai_usage', JSON.stringify(usage));
            if (typeof window.updateAILimitsUI === 'function') window.updateAILimitsUI();
        }

        window.updateAILimitsUI = function() {
            const usage = checkAILimits();

            const currentPct = Math.min(100, Math.round((usage.currentCount / AI_LIMIT_12H) * 100));
            const weeklyPct = Math.min(100, Math.round((usage.weeklyCount / AI_LIMIT_WEEKLY) * 100));

            const currentTextEl = document.getElementById('aiCurrentUsageText');
            const currentBarEl = document.getElementById('aiCurrentUsageBar');
            const currentResetEl = document.getElementById('aiCurrentResetText');

            if (currentTextEl) currentTextEl.innerText = `تم استخدام ${currentPct}%`;
            if (currentBarEl) {
                currentBarEl.style.width = `${currentPct}%`;
                if (currentPct >= 100) currentBarEl.style.background = '#ef4444'; // Red if full
                else currentBarEl.style.background = '#f8fafc';
            }

            const nextResetDate = new Date(usage.lastResetTime + 12 * 60 * 60 * 1000);
            if (currentResetEl) {
                let hours = nextResetDate.getHours();
                let mins = nextResetDate.getMinutes().toString().padStart(2, '0');
                let ampm = hours >= 12 ? 'م' : 'ص';
                hours = hours % 12;
                hours = hours ? hours : 12; 
                currentResetEl.innerText = `يُعاد ضبط السقف في ${hours}:${mins} ${ampm}`;
            }

            const weeklyTextEl = document.getElementById('aiWeeklyUsageText');
            const weeklyResetEl = document.getElementById('aiWeeklyResetText');

            if (weeklyTextEl) weeklyTextEl.innerText = `تم استخدام ${weeklyPct}%`;
            if (weeklyResetEl) {
                const nextWeeklyDate = new Date(usage.weeklyResetTime + 7 * 24 * 60 * 60 * 1000);
                const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
                let wHours = nextWeeklyDate.getHours();
                let wMins = nextWeeklyDate.getMinutes().toString().padStart(2, '0');
                let wAmpm = wHours >= 12 ? 'م' : 'ص';
                wHours = wHours % 12;
                wHours = wHours ? wHours : 12; 
                weeklyResetEl.innerText = `يُعاد ضبط السقف في ${nextWeeklyDate.getDate()} ${months[nextWeeklyDate.getMonth()]} عند الساعة ${wHours}:${wMins} ${wAmpm}`;
            }
        };

        async function sendAIChatMessage() {
            const usage = checkAILimits();
            if (usage.currentCount >= AI_LIMIT_12H) {
                showCustomAlert({
                    type: 'warning',
                    titleText: '⚠️ تنبيه',
                    msg: `لقد استنفدت الحد الأقصى للمساعد الذكي (${AI_LIMIT_12H} رسائل). يُعاد ضبط السقف في غضون 12 ساعة.`
                });
                return;
            }

            const inputEl = document.getElementById('aiChatInput');
            const query = inputEl.value.trim();
            if (!query) return;

            const apiKeys = window.getGeminiApiKeys();
            if (apiKeys.length === 0) {
                alert('⚠️ يرجى تعيين مفتاح Gemini API أولاً لتشغيل المساعد.');
                document.getElementById('aiKeyAlertBox').style.display = 'flex';
                return;
            }

            // إضافة رسالة المستخدم للدردشة
            appendAIChatBubble(query, 'user');
            inputEl.value = '';

            // إضافة فقاعة التحميل
            const loadingId = 'ai-loading-' + Date.now();
            const messagesContainer = document.getElementById('aiChatMessages');
            const loadingBubble = document.createElement('div');
            loadingBubble.className = 'ai-loading-msg';
            loadingBubble.id = loadingId;
            loadingBubble.innerHTML = `
                <div class="ai-loading-dot"></div>
                <div class="ai-loading-dot"></div>
                <div class="ai-loading-dot"></div>
            `;
            messagesContainer.appendChild(loadingBubble);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;

            try {
                // إعداد سياق قاعدة البيانات المحلي
                const dbContext = getAILocalDatabaseContext();

                // بناء الطلب لـ Gemini API
                const systemInstruction = `
أنت "مساعد بيان الذكي" (Bayan AI Copilot)، خبير مالي وإداري ذكي ومساعد لنظام بيان المحاسبي (Bayan POS).
أجب عن أسئلة المستخدم باللغة العربية بأسلوب احترافي، واضح، ومبسط.
لديك وصول كامل لبيانات النظام الحالية الملحقة بالرسالة (العملاء، المنتجات، والفواتير).

قواعد هامة جداً:
1. إذا سألك المستخدم أسئلة تحليلية (مثال: من هو أكثر عميل عليه ديون، أو ما هو الصنف الأكثر مبيعاً، أو كم إجمالي المبيعات)، قم بالبحث في البيانات المرفقة وحساب النتيجة بدقة ثم أجب بالتفصيل واسم الشخص والأرقام.
2. إذا طلب منك المستخدم فتح قسم معين (مثل البيع، الشراء، الحسابات، المخازن، أو استعلام الأصناف) أو البحث عن صنف معين، قم بإدراج أمر التحكم بصيغة JSON داخل وسم <action> في نهاية إجابتك تماماً بدون أي نصوص أخرى داخل هذا الوسم.
صيغة أمر التحكم كالتالي:
- لفتح قسم معين: <action>{"navigate": "sales"}</action> (الخيارات المتاحة: "sales", "purchase", "receipt", "disbursement", "inventory", "accounts", "invoices", "warehouse-report", "product-inquiry", "settings")
- للبحث عن منتج في قسم استعلام الأصناف: <action>{"search_product": "اسم المنتج أو الباركود"}</action> (في هذه الحالة يجب فتح قسم product-inquiry وتصفية المنتج).
3. لا تقم أبداً بكشف أو عرض أو حساب أسعار التكلفة (سعر الشراء) أو أرباح الفواتير إذا كان حقل "صلاحية رؤية التكلفة/الأرباح" قيمته "غير مسموح (محجوب)"، وأجب بأدب أنك لا تملك الصلاحية لعرض هذه البيانات المالية.
`;

                // تحضير سجل المحادثة
                window.aiConversationHistory.push({ role: 'user', parts: [{ text: query }] });

                // إرسال الطلب لـ Gemini API
                const fullPrompt = `${systemInstruction}\n\nسياق قاعدة بيانات البرنامج الحالية:\n${dbContext}\n\nسؤال المستخدم: ${query}`;
                let response = null;
                let lastError = null;
                for (let k = 0; k < apiKeys.length; k++) {
                    const currentKey = apiKeys[k];
                    try {
                        response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${currentKey}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                contents: [
                                    { role: 'user', parts: [{ text: fullPrompt }] }
                                ],
                                generationConfig: { temperature: 0.4 }
                            })
                        });
                        if (response.ok) {
                            lastError = null;
                            break;
                        } else {
                            let errDetails = "";
                            try {
                                const errJson = await response.json();
                                errDetails = errJson.error.message || JSON.stringify(errJson);
                            } catch(e) {
                                errDetails = await response.text();
                            }
                            lastError = new Error(`مفتاح رقم ${k+1} فشل (${response.status}): ${errDetails}`);
                        }
                    } catch (e) {
                        lastError = e;
                    }
                }
                if (lastError || !response || !response.ok) {
                    throw lastError || new Error("فشلت جميع المحاولات باستخدام مفاتيح API المتاحة.");
                }

                const data = await response.json();
                const replyText = data.candidates[0].content.parts[0].text || 'فشل في توليد إجابة.';

                // إزالة فقاعة التحميل
                const loader = document.getElementById(loadingId);
                if (loader) loader.remove();

                // معالجة وحذف وسم الـ action من النص المعروض
                let cleanReply = replyText;
                let actionObj = null;
                const actionMatch = replyText.match(/<action>([\s\S]*?)<\/action>/);
                if (actionMatch) {
                    try {
                        actionObj = JSON.parse(actionMatch[1].trim());
                        cleanReply = replyText.replace(/<action>[\s\S]*?<\/action>/g, '').trim();
                    } catch (e) {
                        console.error('Failed to parse AI action JSON:', e);
                    }
                }

                // إضافة إجابة البوت للدردشة
                appendAIChatBubble(cleanReply, 'bot');
                window.aiConversationHistory.push({ role: 'model', parts: [{ text: replyText }] });

                // تنفيذ أمر التحكم إذا وُجد
                if (actionObj) {
                    executeAIAction(actionObj);
                }

            } catch (err) {
                console.error(err);
                const loader = document.getElementById(loadingId);
                if (loader) loader.remove();
                appendAIChatBubble(`🚀 مساعد بيان الذكي قيد التطوير والتحديث الجذري حالياً، وسيتم إطلاق الإصدار الجديد في 15/10.`, 'bot');
            }
        }

        function appendAIChatBubble(text, sender) {
            const messagesContainer = document.getElementById('aiChatMessages');
            if (!messagesContainer) return;

            const bubble = document.createElement('div');
            bubble.className = sender === 'user' ? 'ai-user-msg' : 'ai-bot-msg';

            // تحويل علامات markdown البسيطة لنصوص منسقة
            let formattedText = text
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/\n/g, '<br>');

            bubble.innerHTML = `<div style="line-height: 1.6;">${formattedText}</div>`;

            if (sender === 'bot') {
                const actionContainer = document.createElement('div');
                actionContainer.style.cssText = 'display: flex; justify-content: flex-end; margin-top: 5px; border-top: 1px solid rgba(0,0,0,0.05); padding-top: 5px;';

                const copyBtn = document.createElement('button');
                copyBtn.innerHTML = '📋 نسخ';
                copyBtn.style.cssText = 'background: transparent; border: 1px solid #cbd5e1; color: #64748b; font-size: 0.7rem; padding: 3px 8px; border-radius: 6px; cursor: pointer; transition: 0.2s; font-family: inherit; font-weight: bold; display: flex; align-items: center; gap: 4px;';
                copyBtn.setAttribute('onmouseover', 'this.style.background="#e2e8f0"');
                copyBtn.setAttribute('onmouseout', 'this.style.background="transparent"');
                copyBtn.setAttribute('data-text', encodeURIComponent(text));
                copyBtn.setAttribute('onclick', 'window.copyAiMessageText(this)');

                actionContainer.appendChild(copyBtn);
                bubble.appendChild(actionContainer);
            }

            messagesContainer.appendChild(bubble);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        function executeAIAction(action) {
            if (action.navigate) {
                if (typeof switchSection === 'function') {
                    switchSection(action.navigate);
                    showToast(`🤖 تم فتح قسم: ${action.navigate} بواسطة الذكاء الاصطناعي`, 'info');
                }
            }
            if (action.search_product) {
                if (typeof switchSection === 'function') {
                    switchSection('product-inquiry');
                    setTimeout(() => {
                        const input = document.getElementById('inquirySearchInput');
                        if (input) {
                            input.value = action.search_product;
                            if (typeof handleInquirySearch === 'function') {
                                handleInquirySearch(action.search_product);
                            }
                        }
                    }, 500);
                }
            }
        }

        // ================= تملي الصوت المدمج (Speech-to-Text) =================
        function toggleAIVoiceInput() {
            if (isAIVoiceActive) {
                stopAIVoice();
                return;
            }

            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                alert('⚠️ متصفحك الحالي لا يدعم ميزة التعرف على الصوت. يرجى استخدام متصفح Google Chrome.');
                return;
            }

            try {
                aiRecognition = new SpeechRecognition();
                aiRecognition.lang = 'ar-EG'; // اللغة العربية مصر
                aiRecognition.interimResults = false;
                aiRecognition.maxAlternatives = 1;

                aiRecognition.onstart = function() {
                    isAIVoiceActive = true;
                    const voiceBtn = document.getElementById('aiVoiceBtn');
                    if (voiceBtn) {
                        voiceBtn.style.background = '#ef4444';
                        voiceBtn.style.color = 'white';
                    }
                    const statusText = document.getElementById('aiVoiceStatus');
                    if (statusText) statusText.style.display = 'block';
                };

                aiRecognition.onresult = function(event) {
                    const resultText = event.results[0][0].transcript;
                    const inputEl = document.getElementById('aiChatInput');
                    if (inputEl) {
                        inputEl.value = resultText;
                        showToast(`🎙️ تم التعرف: "${resultText}"`, 'info');
                    }
                };

                aiRecognition.onerror = function(event) {
                    console.error('Speech recognition error:', event.error);
                    stopAIVoice();
                };

                aiRecognition.onend = function() {
                    stopAIVoice();
                };

                aiRecognition.start();

            } catch (e) {
                console.error(e);
                stopAIVoice();
            }
        }

        function stopAIVoice() {
            isAIVoiceActive = false;
            if (aiRecognition) {
                try { aiRecognition.stop(); } catch(e){}
            }
            const voiceBtn = document.getElementById('aiVoiceBtn');
            if (voiceBtn) {
                voiceBtn.style.background = 'white';
                voiceBtn.style.color = '#334155';
            }
            const statusText = document.getElementById('aiVoiceStatus');
            if (statusText) statusText.style.display = 'none';
        }

        // ================= مساعد بيان الذكي (الشاشة الكاملة - AI Assistant Page) =================
        let isFullAIVoiceActive = false;
        let fullAiRecognition = null;

        async function sendFullAIChatMessage() {
            const usage = checkAILimits();
            if (usage.currentCount >= AI_LIMIT_12H) {
                showCustomAlert({
                    type: 'warning',
                    titleText: '⚠️ تنبيه',
                    msg: `لقد استنفدت الحد الأقصى للمساعد الذكي (${AI_LIMIT_12H} رسائل). يُعاد ضبط السقف في غضون 12 ساعة.`
                });
                return;
            }

            const inputEl = document.getElementById('aiAssistantFullInput');
            if (!inputEl) return;
            const query = inputEl.value.trim();
            if (!query) return;

            const apiKeys = window.getGeminiApiKeys();
            if (apiKeys.length === 0) {
                alert('⚠️ يرجى تعيين مفتاح Gemini API أولاً لتشغيل المساعد.');
                return;
            }

            // إضافة رسالة المستخدم للدردشة
            appendFullAIChatBubble(query, 'user');
            inputEl.value = '';

            // إضافة فقاعة التحميل
            const loadingId = 'ai-full-loading-' + Date.now();
            const messagesContainer = document.getElementById('aiAssistantFullChatLogs');
            if (!messagesContainer) return;

            const loadingBubble = document.createElement('div');
            loadingBubble.className = 'ai-loading-msg';
            loadingBubble.id = loadingId;
            loadingBubble.style.alignSelf = 'flex-start';
            loadingBubble.innerHTML = `
                <div class="ai-loading-dot"></div>
                <div class="ai-loading-dot"></div>
                <div class="ai-loading-dot"></div>
            `;
            messagesContainer.appendChild(loadingBubble);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;

            try {
                // إعداد سياق قاعدة البيانات المحلي
                const dbContext = getAILocalDatabaseContext();

                // بناء الطلب لـ Gemini API
                const systemInstruction = `
أنت "مساعد بيان الذكي" (Bayan AI Copilot)، خبير مالي وإداري ذكي ومساعد لنظام بيان المحاسبي (Bayan POS).
أجب عن أسئلة المستخدم باللغة العربية بأسلوب احترافي، واضح، ومبسط.
لديك وصول كامل لبيانات النظام الحالية الملحقة بالرسالة (العملاء، المنتجات، والفواتير).

قواعد هامة جداً:
1. إذا سألك المستخدم أسئلة تحليلية (مثال: من هو أكثر عميل عليه ديون، أو ما هو الصنف الأكثر مبيعاً، أو كم إجمالي المبيعات)، قم بالبحث في البيانات المرفقة وحساب النتيجة بدقة ثم أجب بالتفصيل واسم الشخص والأرقام.
2. إذا طلب منك المستخدم فتح قسم معين (مثل البيع، الشراء، الحسابات، المخازن، أو استعلام الأصناف) أو البحث عن صنف معين، قم بإدراج أمر التحكم بصيغة JSON داخل وسم <action> في نهاية إجابتك تماماً بدون أي نصوص أخرى داخل هذا الوسم.
صيغة أمر التحكم كالتالي:
- لفتح قسم معين: <action>{"navigate": "sales"}</action> (الخيارات المتاحة: "sales", "purchase", "receipt", "disbursement", "inventory", "accounts", "invoices", "warehouse-report", "product-inquiry", "settings")
- للبحث عن منتج في قسم استعلام الأصناف: <action>{"search_product": "اسم المنتج أو الباركود"}</action> (في هذه الحالة يجب فتح قسم product-inquiry وتصفية المنتج).
3. لا تقم أبداً بكشف أو عرض أو حساب أسعار التكلفة (سعر الشراء) أو أرباح الفواتير إذا كان حقل "صلاحية رؤية التكلفة/الأرباح" قيمته "غير مسموح (محجوب)"، وأجب بأدب أنك لا تملك الصلاحية لعرض هذه البيانات المالية.
`;

                // إرسال الطلب لـ Gemini API
                const fullPrompt = `${systemInstruction}\n\nسياق قاعدة بيانات البرنامج الحالية:\n${dbContext}\n\nسؤال المستخدم: ${query}`;
                let response = null;
                let lastError = null;
                for (let k = 0; k < apiKeys.length; k++) {
                    const currentKey = apiKeys[k];
                    try {
                        response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${currentKey}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                contents: [
                                    { role: 'user', parts: [{ text: fullPrompt }] }
                                ],
                                generationConfig: { temperature: 0.4 }
                            })
                        });
                        if (response.ok) {
                            lastError = null;
                            break;
                        } else {
                            let errDetails = "";
                            try {
                                const errJson = await response.json();
                                errDetails = errJson.error.message || JSON.stringify(errJson);
                            } catch(e) {
                                errDetails = await response.text();
                            }
                            lastError = new Error(`مفتاح رقم ${k+1} فشل (${response.status}): ${errDetails}`);
                        }
                    } catch (e) {
                        lastError = e;
                    }
                }
                if (lastError || !response || !response.ok) {
                    throw lastError || new Error("فشلت جميع المحاولات باستخدام مفاتيح API المتاحة.");
                }

                const data = await response.json();
                const replyText = data.candidates[0].content.parts[0].text || 'فشل في توليد إجابة.';

                // إزالة فقاعة التحميل
                const loader = document.getElementById(loadingId);
                if (loader) loader.remove();

                // معالجة وحذف وسم الـ action من النص المعروض
                let cleanReply = replyText;
                let actionObj = null;
                const actionMatch = replyText.match(/<action>([\s\S]*?)<\/action>/);
                if (actionMatch) {
                    try {
                        actionObj = JSON.parse(actionMatch[1].trim());
                        cleanReply = replyText.replace(/<action>[\s\S]*?<\/action>/g, '').trim();
                    } catch (e) {
                        console.error('Failed to parse AI action JSON:', e);
                    }
                }

                // إضافة إجابة البوت للدردشة
                incrementAIUsage();
                appendFullAIChatBubble(cleanReply, 'bot');

                // تنفيذ أمر التحكم إذا وُجد
                if (actionObj) {
                    executeAIAction(actionObj);
                }

            } catch (err) {
                console.error(err);
                const loader = document.getElementById(loadingId);
                if (loader) loader.remove();
                appendFullAIChatBubble(`🚀 مساعد بيان الذكي قيد التطوير والتحديث الجذري حالياً، وسيتم إطلاق الإصدار الجديد في 15/10.`, 'bot');
            }
        }

        function appendFullAIChatBubble(text, sender) {
            const messagesContainer = document.getElementById('aiAssistantFullChatLogs');
            if (!messagesContainer) return;

            const bubble = document.createElement('div');
            bubble.className = sender === 'user' ? 'ai-user-msg' : 'ai-bot-msg';

            if (sender === 'bot') {
                bubble.style.background = '#f8fafc';
                bubble.style.border = '1px solid #e2e8f0';
                bubble.style.color = '#0f172a';
                bubble.style.alignSelf = 'flex-start';
                bubble.style.borderRadius = '18px 18px 18px 0';
            } else {
                bubble.style.alignSelf = 'flex-end';
                bubble.style.background = 'linear-gradient(135deg, #7c3aed, #6d28d9)';
                bubble.style.color = 'white';
                bubble.style.borderRadius = '18px 18px 0 18px';
            }

            // تحويل علامات markdown البسيطة لنصوص منسقة
            let formattedText = text
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/\n/g, '<br>');

            bubble.innerHTML = `<div style="line-height: 1.6;">${formattedText}</div>`;

            if (sender === 'bot') {
                const actionContainer = document.createElement('div');
                actionContainer.style.cssText = 'display: flex; justify-content: flex-end; margin-top: 10px; border-top: 1px solid #e2e8f0; padding-top: 8px;';

                const copyBtn = document.createElement('button');
                copyBtn.innerHTML = '📋 نسخ';
                copyBtn.style.cssText = 'background: transparent; border: 1px solid #cbd5e1; color: #64748b; font-size: 0.75rem; padding: 4px 10px; border-radius: 6px; cursor: pointer; transition: 0.2s; font-family: inherit; font-weight: bold; display: flex; align-items: center; gap: 5px;';
                copyBtn.setAttribute('onmouseover', 'this.style.background="#e2e8f0"');
                copyBtn.setAttribute('onmouseout', 'this.style.background="transparent"');
                copyBtn.setAttribute('data-text', encodeURIComponent(text));
                copyBtn.setAttribute('onclick', 'window.copyAiMessageText(this)');

                actionContainer.appendChild(copyBtn);
                bubble.appendChild(actionContainer);
            }
            messagesContainer.appendChild(bubble);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;

            // حفظ الدردشة في IndexedDB لضمان عدم وجود قيود على المساحة
            if (typeof db !== 'undefined') {
                db.settings.put({ id: 'bayan_ai_chat_history', data: messagesContainer.innerHTML }).catch(e => {
                    console.warn("تعذر حفظ الدردشة في IndexedDB, الرجوع لـ LocalStorage", e);
                    setStore('bayan_ai_chat_history', messagesContainer.innerHTML);
                });
            } else {
                setStore('bayan_ai_chat_history', messagesContainer.innerHTML);
            }
        }

        window.loadAIChatHistory = async function() {
            const container = document.getElementById('aiAssistantFullChatLogs');
            if (!container) return;

            let history = null;
            if (typeof db !== 'undefined') {
                try {
                    const doc = await db.settings.get('bayan_ai_chat_history');
                    if (doc) history = doc.data;
                } catch(e) {}
            }
            if (!history) history = getStore('bayan_ai_chat_history');

            if (history && history.trim() !== "") {
                container.innerHTML = history;
                container.scrollTop = container.scrollHeight;
            }
        };

        function clickSuggestedAIPrompt(promptText) {
            const inputEl = document.getElementById('aiAssistantFullInput');
            if (inputEl) {
                inputEl.value = promptText;
                sendFullAIChatMessage();
            }
        }

        window.copyAiMessageText = function(btn) {
            const textToCopy = decodeURIComponent(btn.getAttribute('data-text'));
            navigator.clipboard.writeText(textToCopy).then(() => {
                btn.innerHTML = '✅ تم النسخ';
                btn.style.color = '#10b981';
                btn.style.borderColor = '#10b981';
                setTimeout(() => {
                    btn.innerHTML = '📋 نسخ';
                    btn.style.color = '#64748b';
                    btn.style.borderColor = '#cbd5e1';
                }, 2000);
            });
        };

        function toggleFullAIVoiceInput() {
            if (isFullAIVoiceActive) {
                stopFullAIVoice();
                return;
            }

            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                alert('⚠️ متصفحك الحالي لا يدعم ميزة التعرف على الصوت. يرجى استخدام متصفح Google Chrome.');
                return;
            }

            try {
                fullAiRecognition = new SpeechRecognition();
                fullAiRecognition.lang = 'ar-EG';
                fullAiRecognition.interimResults = false;
                fullAiRecognition.maxAlternatives = 1;

                fullAiRecognition.onstart = function() {
                    isFullAIVoiceActive = true;
                    const voiceBtn = document.getElementById('aiAssistantFullVoiceBtn');
                    if (voiceBtn) {
                        voiceBtn.style.background = '#ef4444';
                        voiceBtn.style.color = 'white';
                    }
                };

                fullAiRecognition.onresult = function(event) {
                    const resultText = event.results[0][0].transcript;
                    const inputEl = document.getElementById('aiAssistantFullInput');
                    if (inputEl) {
                        inputEl.value = resultText;
                        showToast(`🎙️ تم التعرف: "${resultText}"`, 'info');
                    }
                };

                fullAiRecognition.onerror = function(event) {
                    console.error('Full AI Speech recognition error:', event.error);
                    stopFullAIVoice();
                };

                fullAiRecognition.onend = function() {
                    stopFullAIVoice();
                };

                fullAiRecognition.start();

            } catch (e) {
                console.error(e);
                stopFullAIVoice();
            }
        }

        function stopFullAIVoice() {
            isFullAIVoiceActive = false;
            if (fullAiRecognition) {
                try { fullAiRecognition.stop(); } catch(e){}
            }
            const voiceBtn = document.getElementById('aiAssistantFullVoiceBtn');
            if (voiceBtn) {
                voiceBtn.style.background = '#f1f5f9';
                voiceBtn.style.color = '#475569';
            }
        }

        // إعداد استماع لزر الإنتر في حقل الإدخال
        document.addEventListener('DOMContentLoaded', () => {
            if (typeof window.updateAILimitsUI === 'function') window.updateAILimitsUI();
            if (typeof window.loadAIChatHistory === 'function') window.loadAIChatHistory();
            const fullInput = document.getElementById('aiAssistantFullInput');
            if (fullInput) {
                fullInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        sendFullAIChatMessage();
                    }
                });
            }
        });

        async function debugGeminiModels() {
            const apiKeys = window.getGeminiApiKeys();
            const apiKey = apiKeys[0] || '';
            try {
                const res = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
                const data = await res.json();

                let modalHtml = '';
                if (data.models && data.models.length > 0) {
                    const modelItems = data.models.map(m => {
                        const mName = m.name.replace('models/', '');
                        return `<div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px; margin-bottom: 8px; font-family: monospace; font-size: 0.9rem; display: flex; justify-content: space-between; align-items: center;">
                            <span style="color:#f8fafc;">${mName}</span>
                            <span style="font-size: 0.75rem; color: #10b981; background: rgba(16, 185, 129, 0.1); padding: 2px 6px; border-radius: 4px;">متاح ✅</span>
                        </div>`;
                    }).join('');
                    modalHtml = `
                        <h3 style="margin: 0 0 15px 0; font-size: 1.2rem; color: #fff; font-weight: bold; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">🔍 النماذج المتاحة بنجاح</h3>
                        <p style="color:#94a3b8; font-size: 0.85rem; margin-bottom: 15px;">تم الاتصال بالخادم بنجاح واسترداد قائمة النماذج الخاصة بالمفتاح:</p>
                        <div style="max-height: 250px; overflow-y: auto; padding-right: 5px; scrollbar-width: thin; scrollbar-color: #475569 transparent;">
                            ${modelItems}
                        </div>
                    `;
                } else {
                    modalHtml = `
                        <h3 style="margin: 0 0 15px 0; font-size: 1.2rem; color: #ef4444; font-weight: bold; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">⚠️ فشل جلب النماذج</h3>
                        <p style="color:#94a3b8; font-size: 0.85rem; margin-bottom: 15px;">لم يتم العثور على نماذج أو يوجد خطأ في المفتاح:</p>
                        <pre style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px; font-family: monospace; font-size: 0.8rem; overflow-x: auto; color: #cbd5e1; direction: ltr; text-align: left;">${JSON.stringify(data, null, 2)}</pre>
                    `;
                }

                showCustomAIModal(modalHtml);
            } catch(e) {
                showCustomAIModal(`
                    <h3 style="margin: 0 0 15px 0; font-size: 1.2rem; color: #ef4444; font-weight: bold; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">❌ خطأ في الاتصال</h3>
                    <p style="color:#f8fafc; font-size: 0.9rem;">حدث خطأ أثناء محاولة الاتصال بخادم جيميناي:</p>
                    <div style="background: rgba(239,68,68,0.1); color: #ef4444; padding: 10px; border-radius: 8px; font-family: monospace; font-size: 0.85rem; margin-top: 10px; direction: ltr; text-align: left;">${e.message}</div>
                `);
            }
        }

        function showCustomAIModal(contentHtml) {
            let existingModal = document.getElementById('aiModelsDebugModal');
            if (existingModal) existingModal.remove();

            const modal = document.createElement('div');
            modal.id = 'aiModelsDebugModal';
            modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6);  z-index: 9999; justify-content: center; align-items: center;';

            modal.innerHTML = `
                <div style="background: linear-gradient(145deg, #1e293b, #0f172a); color: white; border-radius: 20px; padding: 25px; width: 90%; max-width: 450px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); border: 1px solid rgba(255, 255, 255, 0.1); position: relative; overflow: hidden; animation: slideUp 0.3s ease-out;">
                    ${contentHtml}
                    <button onclick="document.getElementById('aiModelsDebugModal').remove()" style="width: 100%; padding: 12px; border-radius: 10px; background: #334155; color: white; font-weight: bold; font-size: 1rem; border: none; cursor: pointer; transition: 0.2s; margin-top: 20px;" onmouseover="this.style.background='#475569'" onmouseout="this.style.background='#334155'">إغلاق</button>
                </div>
            `;
            document.body.appendChild(modal);
        }

/**
 * Dynamic Print Template Builder
 */