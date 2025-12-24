// index.js - Chronos V39 (Context Master) 🌌📏
// Fixed: "Max of Maxes" Logic (Trust the highest value found)

const extensionName = "Chronos_V39_ContextMaster";

// =================================================================
// 1. UTILITIES
// =================================================================
const getSysTokenCount = (text) => {
    if (!text) return 0;
    try {
        if (typeof SillyTavern !== 'undefined' && SillyTavern.Tokenizers && typeof SillyTavern.Tokenizers.encode === 'function') {
            return SillyTavern.Tokenizers.encode(text).length;
        }
        if (typeof GPTTokenizer_Encoding_Encode === 'function') {
            return GPTTokenizer_Encoding_Encode(text).length;
        }
        return Math.round(text.length / 2.7); 
    } catch (e) {
        return Math.round(text.length / 3);
    }
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
// 2. CORE LOGIC: Calculator (The "Max of Maxes" Fix)
// =================================================================
const calculateStats = () => {
    if (typeof SillyTavern === 'undefined') return { memoryRange: "N/A", original: 0, optimized: 0, remaining: 0, saved: 0, max: 0 };
    
    const context = SillyTavern.getContext();
    const chat = context.chat || [];

    // --- 1. Find Max Context (Scan everywhere, pick highest) ---
    // เราจะรวบรวมตัวเลขจากทุกแหล่งที่เป็นไปได้
    let candidateValues = [];

    // แหล่งที่ 1: UI Input (ค่าที่คุณพิมพ์/เลื่อนเอง)
    const uiIds = ['max_context', 'max_tokens', 'cfg_ctx_size'];
    uiIds.forEach(id => {
        const el = document.getElementById(id);
        if (el && !isNaN(parseInt(el.value))) candidateValues.push(parseInt(el.value));
    });

    // แหล่งที่ 2: API Settings (ค่าที่ตั้งไว้ใน Backend)
    if (SillyTavern.main_api && SillyTavern.main_api.max_context) {
        candidateValues.push(SillyTavern.main_api.max_context);
    }

    // แหล่งที่ 3: Context Object (ค่ามาตรฐาน)
    if (context.max_context) candidateValues.push(context.max_context);
    if (context.max_tokens) candidateValues.push(context.max_tokens);

    // *สูตรเด็ด*: กรองเอาค่าขยะออก (เช่น 0 หรือ NaN) แล้วเอาค่าที่ "มากที่สุด"
    // เพราะถ้าคุณตั้ง 200,000 แปลว่าคุณต้องการ 200,000 แน่นอน (ไม่มีใครตั้งค่าหลอกตัวเองให้สูงเล่นๆ)
    let maxTokens = 8192; // Default fallback
    const validValues = candidateValues.filter(v => typeof v === 'number' && v > 0);
    
    if (validValues.length > 0) {
        maxTokens = Math.max(...validValues);
    }

    // --- 2. Original Total Load ---
    let originalTotalLoad = context.tokens || 0;
    // Fallback อ่านจาก UI Bar
    if (originalTotalLoad === 0 && document.getElementById('token_count_bar')) {
        const text = document.getElementById('token_count_bar').innerText;
        const match = text.match(/(\d+)/);
        if (match) originalTotalLoad = parseInt(match[1]);
    }

    // --- 3. Analyze Chat Components ---
    let sumOriginalChatTokens = 0;
    let sumOptimizedChatTokens = 0;
    let totalSaved = 0;
    let chatDetails = [];
    const MSG_OVERHEAD = 3; 

    chat.forEach((msg, index) => {
        // Original
        const rawLen = getSysTokenCount(msg.mes) + MSG_OVERHEAD;
        sumOriginalChatTokens += rawLen;

        // Optimized
        let cleanContent = msg.mes;
        if (/<[^>]+>|&lt;[^&]+&gt;/.test(cleanContent)) {
             const clean = stripHtmlToText(cleanContent);
             cleanContent = `[System Content:\n${clean}]`;
        }
        const optLen = getSysTokenCount(cleanContent) + MSG_OVERHEAD;
        sumOptimizedChatTokens += optLen;

        // Diff
        const diff = Math.max(0, rawLen - optLen);
        totalSaved += diff;

        chatDetails.push({ index: index, optimizedSize: optLen });
    });

    // --- 4. Final Calculation ---
    // System Overhead
    let staticOverhead = Math.max(0, originalTotalLoad - sumOriginalChatTokens);
    
    const optimizedLoad = staticOverhead + sumOptimizedChatTokens;
    const remainingSpace = Math.max(0, maxTokens - optimizedLoad);

    // --- 5. Memory Range ---
    const availableForChat = maxTokens - staticOverhead;
    let currentFill = 0;
    let startMsgIndex = -1;
    let rememberedCount = 0;

    for (let i = chatDetails.length - 1; i >= 0; i--) {
        const msgSize = chatDetails[i].optimizedSize;
        if (currentFill + msgSize <= availableForChat) {
            currentFill += msgSize;
            startMsgIndex = chatDetails[i].index;
            rememberedCount++;
        } else {
            break;
        }
    }

    let memoryRangeText = "";
    if (chat.length === 0) memoryRangeText = "-";
    else if (rememberedCount >= chat.length) memoryRangeText = `All (#0 - #${chat.length - 1})`;
    else if (startMsgIndex !== -1) memoryRangeText = `#${startMsgIndex} ➔ #${chat.length - 1}`;
    else memoryRangeText = "None (Context Full)";

    return {
        memoryRange: memoryRangeText,
        original: originalTotalLoad,
        optimized: optimizedLoad,
        remaining: remainingSpace,
        saved: totalSaved,
        max: maxTokens
    };
};

// =================================================================
// 3. UI SYSTEM
// =================================================================
const injectStyles = () => {
    const style = document.createElement('style');
    style.innerHTML = `
        /* ORB STYLES */
        #chronos-orb {
            position: fixed; top: 150px; right: 20px; width: 40px; height: 40px;
            background: radial-gradient(circle, rgba(20,0,30,0.9) 0%, rgba(0,0,0,1) 100%);
            border: 2px solid #D500F9; border-radius: 50%;
            z-index: 999999; cursor: pointer; display: flex; align-items: center; justify-content: center;
            font-size: 20px; color: #E040FB; 
            box-shadow: 0 0 15px rgba(213, 0, 249, 0.6), inset 0 0 10px rgba(213, 0, 249, 0.3);
            user-select: none; animation: pulse-glow 3s infinite alternate;
            transition: transform 0.2s;
        }
        #chronos-orb:hover { transform: scale(1.1); border-color: #00E676; color: #00E676; box-shadow: 0 0 25px #00E676; }
        @keyframes pulse-glow { 0% { box-shadow: 0 0 10px #D500F9; } 100% { box-shadow: 0 0 20px #D500F9; } }

        /* INSPECTOR PANEL */
        #chronos-inspector {
            position: fixed; top: 80px; right: 70px; width: 320px; 
            background: rgba(10, 10, 12, 0.95); 
            border: 1px solid #D500F9;
            border-top: 3px solid #D500F9;
            color: #E1BEE7; font-family: 'Consolas', 'Menlo', monospace; font-size: 12px;
            display: none; z-index: 999999; border-radius: 8px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.8); 
            backdrop-filter: blur(10px);
            overflow: hidden;
        }

        .ins-header { 
            background: linear-gradient(90deg, #4A0072, #2a0040); 
            color: #fff; padding: 10px; font-weight: bold; letter-spacing: 1px;
            display: flex; justify-content: space-between; align-items: center;
            border-bottom: 1px solid #D500F9;
        }

        .control-zone { 
            display: flex; gap: 15px; padding: 6px 10px; background: #1a0520; 
            border-bottom: 1px solid #330044; font-size: 11px; color: #00E676; 
        }
        
        .dashboard-zone { background: #050505; padding: 15px; border-bottom: 1px solid #333; }
        .dash-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; align-items: center; }
        .dash-val { font-weight: bold; font-size: 13px; }
        
        .progress-container { width: 100%; height: 6px; background: #222; border-radius: 3px; margin-top: 8px; overflow: hidden; }
        .progress-bar { height: 100%; background: linear-gradient(90deg, #D500F9, #00E676); width: 0%; transition: width 0.4s ease-out; }

        .ins-body { padding: 10px; background: #111; max-height: 400px; overflow-y: auto;}
        
        .msg-list { max-height: 120px; overflow-y: auto; border: 1px solid #333; margin-bottom: 10px; background: #0a0a0a; border-radius: 4px; }
        .msg-item { padding: 6px; cursor: pointer; border-bottom: 1px solid #222; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #888; transition: 0.2s;}
        .msg-item:hover { background: #330044; color: #fff; padding-left: 10px;}

        #view-target-wrapper { margin-top:10px; border-top:1px dashed #444; padding-top:10px; display:none; animation: fade-in 0.3s; }
        .view-area { 
            background: #080808; color: #00E676; padding: 10px; height: 140px; 
            overflow-y: auto; overflow-x: hidden;
            font-size: 11px; line-height: 1.4;
            white-space: pre-wrap; word-wrap: break-word; 
            border: 1px solid #333; border-radius: 4px; margin-top: 5px;
        }
        .stat-badge { 
            display: flex; justify-content: space-between; margin-top: 5px; 
            background: #222; padding: 6px; border-radius: 4px; border: 1px solid #333;
        }

        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #111; }
        ::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #D500F9; }

        @keyframes fade-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
    `;
    document.head.appendChild(style);
};

let dragConfig = { orbUnlocked: false, panelUnlocked: false };

const createUI = () => {
    const oldOrb = document.getElementById('chronos-orb'); if (oldOrb) oldOrb.remove();
    const oldPanel = document.getElementById('chronos-inspector'); if (oldPanel) oldPanel.remove();

    const orb = document.createElement('div'); orb.id = 'chronos-orb'; orb.innerHTML = '⚡';
    const ins = document.createElement('div'); ins.id = 'chronos-inspector';
    document.body.appendChild(orb); document.body.appendChild(ins);
    
    orb.onclick = (e) => {
        if (orb.getAttribute('data-dragging') === 'true') return;
        ins.style.display = (ins.style.display === 'none') ? 'block' : 'none';
        if (ins.style.display === 'block') renderInspector();
    };

    makeDraggable(orb, 'orb'); 
    makeDraggable(ins, 'panel');
};

const renderInspector = () => {
    const ins = document.getElementById('chronos-inspector');
    if (ins.style.display === 'none') return;

    const chat = SillyTavern.getContext().chat || [];
    const stats = calculateStats();
    
    const percent = stats.max > 0 ? Math.min((stats.optimized / stats.max) * 100, 100) : 0;
    
    let listHtml = chat.slice(-5).reverse().map((msg, i) => {
        const actualIdx = chat.length - 1 - i;
        const preview = (msg.mes || "").substring(0, 25).replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const roleIcon = msg.is_user ? '👤' : '🤖';
        return `<div class="msg-item" onclick="viewAIVersion(${actualIdx})">
                    <span style="color:#D500F9;margin-right:5px;">#${actualIdx}</span> ${roleIcon} ${preview}...
                </div>`;
    }).join('');

    ins.innerHTML = `
        <div class="ins-header" id="panel-header">
            <span>🚀 CHRONOS V39</span>
            <span style="cursor:pointer; color:#ff4081;" onclick="this.parentElement.parentElement.style.display='none'">✖</span>
        </div>
        
        <div class="control-zone">
            <label style="cursor:pointer;"><input type="checkbox" onchange="toggleDrag('orb', this.checked)" ${dragConfig.orbUnlocked ? 'checked' : ''}> Move Orb</label>
            <label style="cursor:pointer;"><input type="checkbox" onchange="toggleDrag('panel', this.checked)" ${dragConfig.panelUnlocked ? 'checked' : ''}> Move Win</label>
        </div>

        <div class="dashboard-zone">
            <div class="dash-row" style="border-bottom: 1px dashed #333; padding-bottom: 8px; margin-bottom: 8px;">
                <span style="color:#aaa;">🧠 Active Memory</span>
                <span class="dash-val" style="color:#E040FB;">${stats.memoryRange}</span>
            </div>
            
            <div class="dash-row">
                <span style="color:#aaa;">🛡️ Tokens Saved</span>
                <span class="dash-val" style="color:#00E676;">-${stats.saved} toks</span>
            </div>

            <div class="dash-row">
                <span style="color:#fff;">🔋 Load / Max</span>
                <span class="dash-val" style="color:#fff;">${stats.optimized} / ${stats.max}</span>
            </div>

            <div class="progress-container">
                <div class="progress-bar" style="width: ${percent}%"></div>
            </div>
            
            <div style="text-align:right; font-size:9px; color:#555; margin-top:3px;">Original Load: ${stats.original}</div>
        </div>

        <div class="ins-body">
            <div style="display:flex; gap:5px; margin-bottom:10px;">
                <input type="number" id="chronos-search-id" placeholder="Msg ID..." style="background:#222; border:1px solid #444; color:#fff; width:60px; padding:4px; border-radius:3px;">
                <button onclick="searchById()" style="background:#D500F9; border:none; color:#000; padding:4px 10px; border-radius:3px; cursor:pointer; font-weight:bold;">INSPECT</button>
            </div>
            
            <div style="font-size:9px; color:#666; margin-bottom:4px; text-transform:uppercase;">Recent Messages</div>
            <div class="msg-list">${listHtml}</div>
            
            <div id="view-target-wrapper">
                <div id="view-target-content"></div>
            </div>
        </div>
    `;
};

// =================================================================
// 4. INTERACTION
// =================================================================
window.toggleDrag = (type, isChecked) => {
    if (type === 'orb') dragConfig.orbUnlocked = isChecked;
    if (type === 'panel') {
        dragConfig.panelUnlocked = isChecked;
        const header = document.getElementById('panel-header');
        if(header) header.style.cursor = isChecked ? 'move' : 'default';
    }
};

const makeDraggable = (elm, type) => {
    let pos1=0, pos2=0, pos3=0, pos4=0;
    const dragStart = (e) => {
        if (type === 'orb' && !dragConfig.orbUnlocked) return;
        if (type === 'panel' && !dragConfig.panelUnlocked) return;
        if (type === 'panel' && !e.target.classList.contains('ins-header') && !e.target.parentElement.classList.contains('ins-header')) return;
        
        const clientX = e.clientX || e.touches[0].clientX; 
        const clientY = e.clientY || e.touches[0].clientY;
        pos3 = clientX; pos4 = clientY;
        
        document.onmouseup = dragEnd; document.onmousemove = dragAction;
        document.ontouchend = dragEnd; document.ontouchmove = dragAction;
        elm.setAttribute('data-dragging', 'true');
    };
    const dragAction = (e) => {
        const clientX = e.clientX || e.touches[0].clientX; 
        const clientY = e.clientY || e.touches[0].clientY;
        pos1 = pos3 - clientX; pos2 = pos4 - clientY; 
        pos3 = clientX; pos4 = clientY;
        elm.style.top = (elm.offsetTop - pos2) + "px"; 
        elm.style.left = (elm.offsetLeft - pos1) + "px";
        e.preventDefault();
    };
    const dragEnd = () => {
        document.onmouseup = null; document.onmousemove = null; 
        document.ontouchend = null; document.ontouchmove = null;
        setTimeout(() => elm.setAttribute('data-dragging', 'false'), 100);
    };
    elm.onmousedown = dragStart; elm.ontouchstart = dragStart;
};

window.searchById = () => {
    const idInput = document.getElementById('chronos-search-id');
    const id = parseInt(idInput.value);
    const chat = SillyTavern.getContext().chat || [];
    if (isNaN(id) || id < 0 || id >= chat.length) { alert("Invalid ID"); return; }
    viewAIVersion(id);
};

window.viewAIVersion = (index) => {
    const context = SillyTavern.getContext(); 
    const chat = context.chat || [];
    const msg = chat[index];
    if (!msg) return;

    const wrapper = document.getElementById('view-target-wrapper');
    if (wrapper) wrapper.style.display = 'block';

    const contentDiv = document.getElementById('view-target-content');
    if (!contentDiv) return;

    const rawTokens = getSysTokenCount(msg.mes);
    let cleanText = stripHtmlToText(msg.mes);
    let aiViewText = msg.mes; 
    
    if (/<[^>]+>|&lt;[^&]+&gt;/.test(msg.mes)) {
        aiViewText = `[System Content:\n${cleanText}]`;
    }

    const cleanTokens = getSysTokenCount(aiViewText);
    const saved = Math.max(0, rawTokens - cleanTokens);

    contentDiv.innerHTML = `
        <div style="margin-bottom:3px; color:#D500F9; font-weight:bold; font-size:10px;">
            TARGET ID: #${index} (${msg.is_user ? 'USER' : 'AI'})
        </div>
        <div class="view-area">${aiViewText.replace(/</g, '&lt;')}</div>
        <div class="stat-badge">
            <span style="color:#aaa;">Raw: ${rawTokens}</span>
            <span style="color:#00E676;">Sent: ${cleanTokens}</span>
            <span style="color:#E040FB;">Saved: -${saved}</span>
        </div>
    `;
};

const optimizePayload = (data) => {
    const processText = (text) => {
        if (text && /<[^>]+>|&lt;[^&]+&gt;/.test(text)) {
            return `[System Content:\n${stripHtmlToText(text)}]`;
        }
        return text;
    };
    if (data.body && data.body.messages) {
        data.body.messages.forEach(msg => { msg.content = processText(msg.content); });
    } else if (data.body && data.body.prompt) {
        data.body.prompt = processText(data.body.prompt);
    }
    setTimeout(() => {
        const ins = document.getElementById('chronos-inspector');
        if (ins && ins.style.display === 'block') renderInspector();
    }, 1000);
    return data;
};

// =================================================================
// 5. INITIALIZATION
// =================================================================
(function() {
    injectStyles();
    setTimeout(createUI, 2000); 

    if (typeof SillyTavern !== 'undefined') {
        console.log(`[${extensionName}] Hooks registered.`);
        SillyTavern.extension_manager.register_hook('chat_completion_request', optimizePayload);
        SillyTavern.extension_manager.register_hook('text_completion_request', optimizePayload);
    } else {
        console.warn(`[${extensionName}] SillyTavern object not found.`);
    }
})();
        
