// index.js - Chronos V57 (Direct Line) 📉🎯
// Logic: Strict adherence to 'context_size' setting. No auto-expand.
// Behavior: Max Context = Slider Value (always).

const extensionName = "Chronos_V57_DirectLine";

// =================================================================
// 1. HELPERS
// =================================================================
const getChronosTokenizer = () => {
    try {
        const ctx = SillyTavern.getContext();
        const model = ctx?.model || ctx?.settings?.model || SillyTavern?.settings?.model;
        return model ? SillyTavern.Tokenizers.getTokenizerForModel(model) : null;
    } catch (e) { return null; }
};

const stripHtmlToText = (html) => {
    if (!html) return "";
    let text = html.replace(/<br\s*\/?>/gi, '\n')
                   .replace(/<\/p>/gi, '\n\n')
                   .replace(/<\/div>/gi, '\n')
                   .replace(/<\/h[1-6]>/gi, '\n');
    text = text.replace(/<[^>]+>/g, ''); 
    text = text.replace(/&lt;[^&]+&gt;/g, ''); 
    text = text.replace(/\n\s*\n/g, '\n\n').trim();
    return text;
};

// =================================================================
// 2. PAYLOAD MODIFIER
// =================================================================
const optimizePayload = (data) => {
    const processText = (text) => {
        if (text && /<[^>]+>|&lt;[^&]+&gt;/.test(text)) {
            return `[System Content:\n${stripHtmlToText(text)}]`;
        }
        return text;
    };
    if (data.body?.messages) {
        data.body.messages.forEach(msg => msg.content = processText(msg.content));
    } else if (data.body?.prompt) {
        data.body.prompt = processText(data.body.prompt);
    }
    setTimeout(() => {
        const ins = document.getElementById('chronos-inspector');
        if (ins && ins.style.display === 'block') renderInspector();
    }, 500);
    return data;
};

// =================================================================
// 3. STRICT CALCULATOR (USER LOGIC)
// =================================================================
const calculateStats = () => {
    if (typeof SillyTavern === 'undefined') return { memoryRange: "Loading...", original: 0, optimized: 0, saved: 0, max: 0 };
    
    const context = SillyTavern.getContext();
    const chat = context.chat || [];
    const tokenizer = getChronosTokenizer();
    const quickCount = (text) => (tokenizer && typeof tokenizer.encode === 'function') ? tokenizer.encode(text).length : Math.round(text.length / 3);

    // --- A. SAVINGS ---
    let totalSavings = 0;
    chat.forEach((msg) => {
        const rawMsg = msg.mes || "";
        if (/<[^>]+>|&lt;[^&]+&gt;/.test(rawMsg)) {
            const rawLen = quickCount(rawMsg);
            const cleanMsg = `[System Content:\n${stripHtmlToText(rawMsg)}]`;
            const optLen = quickCount(cleanMsg);
            totalSavings += Math.max(0, rawLen - optLen);
        }
    });

    // --- B. BASE LOAD ---
    let stTotalTokens = context.tokens || 0;
    const tokenCounterEl = document.getElementById('token_counter') || document.querySelector('.token-counter');
    if (tokenCounterEl) {
        const text = tokenCounterEl.innerText || "";
        const parts = text.split('/');
        if (parts.length > 0) {
            const domCurrent = parseInt(parts[0].replace(/[^0-9]/g, ''));
            if (!isNaN(domCurrent) && domCurrent > 0) stTotalTokens = domCurrent;
        }
    }
    if (stTotalTokens === 0 && chat.length > 0) {
         let manualChat = 0;
         chat.forEach(m => manualChat += quickCount(m.mes));
         stTotalTokens = manualChat + 2000;
    }

    // --- C. MAX CONTEXT (USER REQUESTED LOGIC) ---
    let maxTokens;

    // Logic ตามที่คุณส่งมาเป๊ะๆ
    if (SillyTavern.settings?.context_size) {
        maxTokens = parseInt(SillyTavern.settings.context_size);
    } else if (context.max_context) {
        maxTokens = parseInt(context.max_context);
    } else {
        maxTokens = 8192;
    }

    // Unlock = เปลี่ยนแค่ Label ไม่เปลี่ยนเพดาน
    const isUnlocked = SillyTavern.settings?.unlock_context;

    // --- D. RESULT ---
    const finalOptimizedLoad = Math.max(0, stTotalTokens - totalSavings);
    
    // Status Logic
    let memoryRangeText = "Healthy";
    const percent = maxTokens > 0 ? (finalOptimizedLoad / maxTokens) : 0;
    
    if (percent > 1) memoryRangeText = "Overflow"; // เกินเพดานที่ตั้งไว้
    else if (percent > 0.9) memoryRangeText = "Critical";
    else if (percent > 0.75) memoryRangeText = "Heavy";

    return {
        memoryRange: memoryRangeText,
        original: stTotalTokens,
        optimized: finalOptimizedLoad,
        saved: totalSavings,
        max: maxTokens,
        unlocked: isUnlocked
    };
};

// =================================================================
// 4. UI RENDERER (NEON V39)
// =================================================================
const renderInspector = () => {
    const ins = document.getElementById('chronos-inspector');
    if (!ins || ins.style.display === 'none') return;

    const msgListEl = ins.querySelector('.msg-list');
    const prevScrollTop = msgListEl ? msgListEl.scrollTop : 0;

    const chat = SillyTavern.getContext().chat || [];
    const stats = calculateStats();
    
    // Visual Bar Cap at 100% (แม้ตัวเลขจะเกิน)
    let percent = 0;
    if (stats.max > 0) {
        percent = (stats.optimized / stats.max) * 100;
        if (percent > 100) percent = 100;
    }

    let listHtml = chat.slice(-5).reverse().map((msg, i) => {
        const actualIdx = chat.length - 1 - i;
        const preview = (msg.mes || "").substring(0, 30).replace(/</g, '&lt;');
        const roleIcon = msg.is_user ? '👤' : '🤖';
        return `<div class="msg-item" onclick="viewAIVersion(${actualIdx})">
                    <span style="color:#D500F9; font-weight:bold;">#${actualIdx}</span> ${roleIcon} ${preview}...
                </div>`;
    }).join('');

    // Format numbers
    const fmt = (n) => Math.round(n).toLocaleString();
    
    // Display Label: Show "Unlock" if checked, but keep the number static
    const maxLabel = stats.unlocked ? `${fmt(stats.max)} (🔓)` : fmt(stats.max);

    ins.innerHTML = `
        <div class="ins-header" id="panel-header">
            <span>🚀 CHRONOS V57 (Direct)</span>
            <span style="cursor:pointer; color:#ff4081;" onclick="this.parentElement.parentElement.style.display='none'">✖</span>
        </div>
        
        <div class="control-zone">
            <label style="cursor:pointer;"><input type="checkbox" onchange="toggleDrag('orb', this.checked)" ${dragConfig.orbUnlocked ? 'checked' : ''}> Orb</label>
            <label style="cursor:pointer;"><input type="checkbox" onchange="toggleDrag('panel', this.checked)" ${dragConfig.panelUnlocked ? 'checked' : ''}> Win</label>
        </div>

        <div class="dashboard-zone">
            <div class="dash-row">
                <span style="color:#aaa;">✂️ HTML Saved</span>
                <span class="dash-val" style="color:#00E676;">-${fmt(stats.saved)}</span>
            </div>

            <div class="dash-row">
                <span style="color:#fff;">🔋 Load</span>
                <span class="dash-val" style="color:#fff;">${fmt(stats.optimized)} / ${maxLabel}</span>
            </div>
            
            <div class="dash-row" style="margin-top:4px; font-size:10px; color:#666;">
                <span>(ST View: ${fmt(stats.original)})</span>
            </div>

            <div class="progress-container">
                <div class="progress-bar" style="width: ${percent}%"></div>
            </div>
        </div>

        <div class="ins-body">
            <div class="msg-list">${listHtml}</div>
            <div id="view-target-wrapper"><div id="view-target-content"></div></div>
        </div>
    `;

    const newMsgListEl = ins.querySelector('.msg-list');
    if (newMsgListEl) newMsgListEl.scrollTop = prevScrollTop;
};

// =================================================================
// 5. STYLES (NEON GLASS)
// =================================================================
let dragConfig = { orbUnlocked: false, panelUnlocked: false };

const injectStyles = () => {
    const style = document.createElement('style');
    style.innerHTML = `
        #chronos-orb { position: fixed; top: 150px; right: 20px; width: 40px; height: 40px; background: radial-gradient(circle, rgba(20,0,30,0.9) 0%, rgba(0,0,0,1) 100%); border: 2px solid #D500F9; border-radius: 50%; z-index: 999999; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #E040FB; box-shadow: 0 0 15px rgba(213, 0, 249, 0.6); animation: spin-slow 10s linear infinite; }
        #chronos-inspector { position: fixed; top: 80px; right: 70px; width: 320px; background: rgba(10, 10, 12, 0.95); border: 1px solid #D500F9; border-top: 3px solid #D500F9; color: #E1BEE7; font-family: 'Consolas', monospace; font-size: 12px; display: none; z-index: 999999; border-radius: 8px; box-shadow: 0 20px 60px rgba(0,0,0,0.8); backdrop-filter: blur(10px); }
        .ins-header { background: linear-gradient(90deg, #4A0072, #2a0040); color: #fff; padding: 10px; font-weight: bold; display: flex; justify-content: space-between; border-bottom: 1px solid #D500F9; }
        .control-zone { display: flex; gap: 10px; padding: 6px 10px; background: #1a0520; color: #00E676; border-bottom: 1px solid #330044; }
        .dashboard-zone { background: #050505; padding: 15px; border-bottom: 1px solid #333; }
        .dash-row { display: flex; justify-content: space-between; margin-bottom: 6px; }
        .dash-val { font-weight: bold; font-size: 13px; }
        .progress-container { width: 100%; height: 6px; background: #222; border-radius: 3px; margin-top: 8px; }
        .progress-bar { height: 100%; background: linear-gradient(90deg, #D500F9, #00E676); width: 0%; transition: width 0.4s; }
        .ins-body { padding: 10px; max-height: 400px; overflow-y: auto; background: #111; }
        .msg-list { max-height: 120px; overflow-y: auto; border: 1px solid #333; background: #0a0a0a; border-radius: 4px; margin-bottom: 10px; }
        .msg-item { padding: 6px; border-bottom: 1px solid #222; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #888; }
        .msg-item:hover { background: #330044; color: #fff; }
        .view-area { background: #080808; color: #00E676; padding: 10px; height: 140px; overflow-y: auto; border: 1px solid #333; border-radius: 4px; margin-top: 5px; white-space: pre-wrap; }
        @keyframes spin-slow { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);
};

window.toggleDrag = (type, v) => {
    if (type === 'orb') dragConfig.orbUnlocked = v;
    if (type === 'panel') { dragConfig.panelUnlocked = v; document.getElementById('panel-header').style.cursor = v ? 'move' : 'default'; }
};

const makeDraggable = (elm, type) => {
    let pos1=0, pos2=0, pos3=0, pos4=0;
    const dragStart = (e) => {
        if ((type === 'orb' && !dragConfig.orbUnlocked) || (type === 'panel' && !dragConfig.panelUnlocked)) return;
        if (type === 'panel' && !e.target.closest('.ins-header')) return;
        e.preventDefault();
        pos3 = e.clientX || e.touches?.[0].clientX; pos4 = e.clientY || e.touches?.[0].clientY;
        document.onmouseup = dragEnd; document.onmousemove = dragAction;
        document.ontouchend = dragEnd; document.ontouchmove = dragAction;
        elm.setAttribute('data-dragging', 'true');
    };
    const dragAction = (e) => {
        const cx = e.clientX || e.touches?.[0].clientX; const cy = e.clientY || e.touches?.[0].clientY;
        pos1 = pos3 - cx; pos2 = pos4 - cy; pos3 = cx; pos4 = cy;
        elm.style.top = (elm.offsetTop - pos2) + "px"; elm.style.left = (elm.offsetLeft - pos1) + "px";
    };
    const dragEnd = () => {
        document.onmouseup = null; document.onmousemove = null; document.ontouchend = null; document.ontouchmove = null;
        setTimeout(()=>elm.setAttribute('data-dragging', 'false'), 100);
    };
    elm.onmousedown = dragStart; elm.ontouchstart = dragStart;
};

window.viewAIVersion = (index) => {
    const chat = SillyTavern.getContext().chat || [];
    const msg = chat[index];
    if (!msg) return;
    const wrapper = document.getElementById('view-target-wrapper');
    const content = document.getElementById('view-target-content');
    wrapper.style.display = 'block';
    let text = msg.mes;
    if (/<[^>]+>|&lt;[^&]+&gt;/.test(text)) text = `[System Content:\n${stripHtmlToText(text)}]`;
    content.innerHTML = `<div class="view-area">${text.replace(/</g, '&lt;')}</div>`;
};

const createUI = () => {
    const orb = document.createElement('div'); orb.id = 'chronos-orb'; orb.innerHTML = '🌀';
    const ins = document.createElement('div'); ins.id = 'chronos-inspector';
    document.body.append(orb, ins);
    orb.onclick = () => {
        if (orb.getAttribute('data-dragging') === 'true') return;
        ins.style.display = ins.style.display === 'none' ? 'block' : 'none';
        if (ins.style.display === 'block') renderInspector();
    };
    makeDraggable(orb, 'orb'); makeDraggable(ins, 'panel');
};

(function() {
    injectStyles();
    setTimeout(createUI, 1500); 
    if (typeof SillyTavern !== 'undefined') {
        console.log(`[${extensionName}] Ready.`);
        SillyTavern.extension_manager.register_hook('chat_completion_request', optimizePayload);
        SillyTavern.extension_manager.register_hook('text_completion_request', optimizePayload);
        setInterval(() => {
            if (document.getElementById('chronos-inspector')?.style.display === 'block') {
                renderInspector();
            }
        }, 2000);
    }
})();
        
