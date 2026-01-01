// index.js - Chronos V66.17 (Zero Lag / Soft Update) 🌌🧊
// UI: Neon V47 (Preserved)
// Fix: 
// 1. Removes innerHTML spam. Uses DOM text updates for 0% lag.
// 2. Only re-renders lists/numpad if state actually changes.

const extensionName = "Chronos_V66_17_Smooth";

// =================================================================
// 1. STATE & CACHE
// =================================================================
let dragConfig = { orbUnlocked: false, panelUnlocked: false };
let uiState = {
    showNumpad: false,
    viewingId: null,
    numpadValue: "ID...",
    isPanelBuilt: false // Track if we need to build HTML
};

// Cache to prevent useless DOM updates
let lastRenderData = {
    saved: -1,
    range: "",
    total: -1,
    load: -1,
    max: -1,
    msgCount: -1
};

const getChronosTokenizer = () => {
    try {
        if (typeof SillyTavern !== 'undefined' && SillyTavern.Tokenizers) {
            const ctx = SillyTavern.getContext();
            const model = ctx?.model || SillyTavern.settings?.model;
            return SillyTavern.Tokenizers.getTokenizerForModel(model);
        }
        return null;
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
// 2. HOOKS
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
    // Force list refresh on new message
    setTimeout(() => {
        lastRenderData.msgCount = -1; 
        updateUI();
    }, 1000);
    return data;
};

// =================================================================
// 3. CALCULATOR
// =================================================================
const findMaxContext = (contextObj) => {
    let max = 0;
    if (contextObj.max_context && contextObj.max_context > 0) max = parseInt(contextObj.max_context);
    else if (typeof SillyTavern !== 'undefined' && SillyTavern.settings?.context_size) {
        max = parseInt(SillyTavern.settings.context_size);
    }
    if (max === 0 && typeof window.settings !== 'undefined' && window.settings.context_size) {
        max = parseInt(window.settings.context_size);
    }
    if (max === 0) max = 4096; 
    return max;
};

const calculateStats = () => {
    let chat = [];
    let context = {};
    if (typeof SillyTavern !== 'undefined') {
        context = SillyTavern.getContext() || {};
        chat = context.chat || [];
    } else if (typeof window.chat !== 'undefined') chat = window.chat;

    if (!chat || chat.length === 0) return { savedTokens: 0, rangeLabel: "Waiting...", max: 0, totalMsgs: 0, currentLoad: 0 };

    const maxTokens = findMaxContext(context);
    const tokenizer = getChronosTokenizer();
    const quickCount = (text) => {
        if (!text) return 0;
        if (tokenizer && typeof tokenizer.encode === 'function') return tokenizer.encode(text).length;
        return Math.ceil(text.length / 3);
    };

    let totalSaved = 0;
    let messageTokensArray = []; 

    chat.forEach((msg) => {
        const rawMsg = msg.mes || "";
        let rawCount = quickCount(rawMsg);
        let cleanCount = 0;
        if (/<[^>]+>|&lt;[^&]+&gt;/.test(rawMsg)) {
            const cleanText = stripHtmlToText(rawMsg);
            const formattedClean = `[System Content:\n${cleanText}]`;
            cleanCount = quickCount(formattedClean);
            if (rawCount > cleanCount) totalSaved += (rawCount - cleanCount);
        } else {
            cleanCount = rawCount;
        }
        messageTokensArray.push(cleanCount);
    });

    let currentTotalUsage = context.tokens || 0;
    if (currentTotalUsage === 0) currentTotalUsage = messageTokensArray.reduce((a,b)=>a+b, 0);

    let rangeLabel = "...";
    let startIndex = 0;
    let endIndex = chat.length - 1;
    let accumulated = 0;
    
    for (let i = chat.length - 1; i >= 0; i--) {
        let t = messageTokensArray[i];
        if (accumulated + t < maxTokens) {
            accumulated += t;
            startIndex = i;
        } else {
            break;
        }
    }
    rangeLabel = `#${startIndex} ➔ #${endIndex}`;

    return {
        savedTokens: totalSaved,
        rangeLabel: rangeLabel,
        max: maxTokens,
        totalMsgs: chat.length,
        currentLoad: currentTotalUsage
    };
};

// =================================================================
// 4. INTERACTION
// =================================================================
window.toggleNumpad = () => {
    uiState.showNumpad = !uiState.showNumpad;
    renderNumpadSection(); // Re-render only numpad section
};

window.numpadType = (num) => {
    let current = uiState.numpadValue;
    if (current === "ID...") current = "";
    if (current.length < 5) {
        uiState.numpadValue = current + num;
        updateNumpadDisplay();
    }
};

window.numpadDel = () => {
    let current = uiState.numpadValue;
    if (current === "ID..." || current.length === 0) return;
    uiState.numpadValue = current.slice(0, -1);
    if (uiState.numpadValue === "") uiState.numpadValue = "ID...";
    updateNumpadDisplay();
};

window.numpadGo = () => {
    const val = uiState.numpadValue;
    if (val === "ID..." || val === "") return;
    const id = parseInt(val);
    window.setViewingId(id);
};

window.setViewingId = (id) => {
    let chat = [];
    if (typeof SillyTavern !== 'undefined') chat = SillyTavern.getContext()?.chat || [];
    else if (typeof window.chat !== 'undefined') chat = window.chat;
    if (isNaN(id) || id < 0 || id >= chat.length) return;
    
    uiState.viewingId = id;
    renderViewerSection(); // Re-render only viewer
};

window.closeViewer = () => {
    uiState.viewingId = null;
    renderViewerSection();
};

window.closePanel = () => {
    const ins = document.getElementById('chronos-inspector');
    if (ins) ins.style.display = 'none';
};

// =================================================================
// 5. CORE RENDERER (The "Soft Update" Logic)
// =================================================================

// A. Build the Skeleton (Runs Once)
const buildBaseUI = () => {
    const ins = document.getElementById('chronos-inspector');
    if (!ins) return;
    
    ins.innerHTML = `
        <div class="ins-header" id="panel-header">
            <span>🚀 CHRONOS V66.17</span>
            <span style="cursor:pointer; color:#ff4081;" onclick="closePanel()">✖</span>
        </div>
        
        <div class="control-zone">
            <label style="cursor:pointer;"><input type="checkbox" onchange="toggleDrag('orb', this.checked)" ${dragConfig.orbUnlocked ? 'checked' : ''}> Move Orb</label>
            <label style="cursor:pointer;"><input type="checkbox" onchange="toggleDrag('panel', this.checked)" ${dragConfig.panelUnlocked ? 'checked' : ''}> Move Win</label>
        </div>

        <div class="dashboard-zone">
            <div class="dash-row" style="border-bottom: 1px dashed #333; padding-bottom: 8px; margin-bottom: 8px;">
                <span style="color:#aaa;">🔋 Tokens Saved</span>
                <span class="dash-val" style="color:#E040FB;" id="disp-saved">0 T</span>
            </div>

            <div class="dash-row" style="align-items:center;">
                <span style="color:#fff;">🧠 Memory</span>
                <span class="dash-val" style="color:#00E676; font-size:14px;" id="disp-range">...</span>
            </div>

            <div class="progress-container">
                <div class="progress-bar" id="disp-bar" style="width: 0%"></div>
            </div>
            
            <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:5px;">
                <button class="toggle-numpad-btn" id="btn-toggle-numpad" onclick="toggleNumpad()">🔢 ID Search</button>
                <div style="font-size:9px; color:#aaa;">📚 Total: <span style="color:#fff;" id="disp-total">0</span></div>
            </div>
        </div>

        <div class="ins-body">
            <div id="section-numpad"></div>
            <div id="section-viewer"></div>
            
            <div style="font-size:9px; color:#666; margin-bottom:4px; text-transform:uppercase; margin-top:5px;">Recent Messages</div>
            <div class="msg-list" id="section-list"></div>
        </div>
    `;
    uiState.isPanelBuilt = true;
};

// B. Update Numbers Only (Runs Loop)
const updateUI = () => {
    const ins = document.getElementById('chronos-inspector');
    if (!ins || ins.style.display === 'none') return;

    // 1. Build structure if missing
    if (!uiState.isPanelBuilt || ins.innerHTML === "") {
        buildBaseUI();
    }

    const stats = calculateStats();
    const fmt = (n) => (n ? n.toLocaleString() : "0");

    // 2. Soft Update Text Nodes (Zero Lag)
    if (stats.savedTokens !== lastRenderData.saved) {
        document.getElementById('disp-saved').innerText = `${fmt(stats.savedTokens)} T`;
        lastRenderData.saved = stats.savedTokens;
    }
    if (stats.rangeLabel !== lastRenderData.range) {
        document.getElementById('disp-range').innerText = stats.rangeLabel;
        lastRenderData.range = stats.rangeLabel;
    }
    if (stats.totalMsgs !== lastRenderData.total) {
        document.getElementById('disp-total').innerText = fmt(stats.totalMsgs);
        lastRenderData.total = stats.totalMsgs;
    }
    
    // Bar Update
    let percent = stats.max > 0 ? Math.min((stats.currentLoad / stats.max) * 100, 100) : 0;
    if (Math.abs(percent - lastRenderData.load) > 0.5) { // Only update if significant change
        document.getElementById('disp-bar').style.width = `${percent}%`;
        lastRenderData.load = percent;
    }

    // 3. Update Sections if needed
    if (stats.totalMsgs !== lastRenderData.msgCount) {
        renderListSection();
        lastRenderData.msgCount = stats.totalMsgs;
    }

    // Ensure stateful sections are rendered (first run check)
    if (document.getElementById('section-numpad').innerHTML === "" && uiState.showNumpad) renderNumpadSection();
};

const renderNumpadSection = () => {
    const container = document.getElementById('section-numpad');
    const btn = document.getElementById('btn-toggle-numpad');
    if (btn) btn.innerText = uiState.showNumpad ? '🔽 Hide Keypad' : '🔢 ID Search';
    
    if (!uiState.showNumpad) {
        container.innerHTML = "";
        return;
    }
    
    const displayColor = uiState.numpadValue === "ID..." ? "#666" : "#fff";
    container.innerHTML = `
        <div class="numpad-wrapper">
            <div class="numpad-display" id="numpad-screen" style="color:${displayColor}">${uiState.numpadValue}</div>
            <div class="numpad-grid">
                <button class="num-btn" onclick="numpadType(1)">1</button>
                <button class="num-btn" onclick="numpadType(2)">2</button>
                <button class="num-btn" onclick="numpadType(3)">3</button>
                <button class="num-btn del-btn" onclick="numpadDel()">⌫</button>
                <button class="num-btn" onclick="numpadType(4)">4</button>
                <button class="num-btn" onclick="numpadType(5)">5</button>
                <button class="num-btn" onclick="numpadType(6)">6</button>
                <button class="num-btn go-btn" onclick="numpadGo()">GO</button>
                <button class="num-btn" onclick="numpadType(7)">7</button>
                <button class="num-btn" onclick="numpadType(8)">8</button>
                <button class="num-btn" onclick="numpadType(9)">9</button>
                <button class="num-btn" onclick="numpadType(0)">0</button>
            </div>
        </div>
    `;
};

const updateNumpadDisplay = () => {
    const el = document.getElementById('numpad-screen');
    if (el) {
        el.innerText = uiState.numpadValue;
        el.style.color = uiState.numpadValue === "ID..." ? "#666" : "#fff";
    }
};

const renderViewerSection = () => {
    const container = document.getElementById('section-viewer');
    if (uiState.viewingId === null) {
        container.innerHTML = "";
        return;
    }
    
    let chat = [];
    if (typeof SillyTavern !== 'undefined') chat = SillyTavern.getContext()?.chat || [];
    else if (typeof window.chat !== 'undefined') chat = window.chat;
    
    const msg = chat[uiState.viewingId];
    if (msg) {
        let cleanText = stripHtmlToText(msg.mes);
        let aiViewText = msg.mes; 
        if (/<[^>]+>|&lt;[^&]+&gt;/.test(msg.mes)) {
            aiViewText = `[System Content:\n${cleanText}]`;
        }
        container.innerHTML = `
            <div class="viewer-container">
                <div class="viewer-header">
                    <span style="color:#D500F9;">#${uiState.viewingId} Content</span>
                    <button class="close-btn" onclick="closeViewer()">CLOSE</button>
                </div>
                <div class="view-area">${aiViewText.replace(/</g, '&lt;')}</div>
            </div>
        `;
    }
};

const renderListSection = () => {
    const container = document.getElementById('section-list');
    let chat = [];
    if (typeof SillyTavern !== 'undefined') chat = SillyTavern.getContext()?.chat || [];
    else if (typeof window.chat !== 'undefined') chat = window.chat;

    if (chat && chat.length > 0) {
        container.innerHTML = chat.slice(-5).reverse().map((msg, i) => {
            const actualIdx = chat.length - 1 - i;
            const cleanContent = msg.mes || "";
            const preview = cleanContent.substring(0, 20).replace(/</g, '&lt;');
            const roleIcon = msg.is_user ? '👤' : '🤖';
            return `<div class="msg-item" onclick="setViewingId(${actualIdx})">
                        <span style="color:#D500F9;">#${actualIdx}</span> ${roleIcon} ${preview}...
                    </div>`;
        }).join('');
    } else {
        container.innerHTML = `<div style="padding:5px; color:#666; font-style:italic; font-size:10px;">No messages</div>`;
    }
};

// =================================================================
// 6. STYLES
// =================================================================
const injectStyles = () => {
    const exist = document.getElementById('chronos-style');
    if (exist) exist.remove();

    const style = document.createElement('style');
    style.id = 'chronos-style';
    style.innerHTML = `
        #chronos-orb {
            position: fixed; top: 150px; right: 20px; width: 40px; height: 40px;
            background: radial-gradient(circle, rgba(20,0,30,0.9) 0%, rgba(0,0,0,1) 100%);
            border: 2px solid #D500F9; border-radius: 50%;
            z-index: 2147483647; 
            cursor: pointer; display: flex; align-items: center; justify-content: center;
            font-size: 20px; color: #E040FB; 
            box-shadow: 0 0 15px rgba(213, 0, 249, 0.6), inset 0 0 10px rgba(213, 0, 249, 0.3);
            user-select: none; 
            animation: spin-slow 4s linear infinite;
            transition: transform 0.2s;
        }
        #chronos-orb:hover { transform: scale(1.1); border-color: #00E676; color: #00E676; box-shadow: 0 0 25px #00E676; }
        @keyframes spin-slow { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        #chronos-inspector {
            position: fixed; top: 80px; right: 70px; width: 320px; 
            background: rgba(10, 10, 12, 0.95); 
            border: 1px solid #D500F9; border-top: 3px solid #D500F9;
            color: #E1BEE7; font-family: 'Consolas', monospace; font-size: 12px;
            display: none; 
            z-index: 2147483647;
            border-radius: 8px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.8); backdrop-filter: blur(10px);
            overflow: hidden;
        }
        .ins-header { 
            background: linear-gradient(90deg, #4A0072, #2a0040); 
            color: #fff; padding: 10px; font-weight: bold; letter-spacing: 1px; display: flex; justify-content: space-between; 
            border-bottom: 1px solid #D500F9;
        }
        .control-zone { display: flex; gap: 15px; padding: 6px 10px; background: #1a0520; color: #00E676; font-size: 11px; border-bottom: 1px solid #330044; }
        .dashboard-zone { background: #050505; padding: 15px; border-bottom: 1px solid #333; }
        .dash-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; align-items: center; }
        .dash-val { font-weight: bold; font-size: 13px; }
        .progress-container { width: 100%; height: 6px; background: #222; border-radius: 3px; margin-top: 8px; overflow: hidden; }
        .progress-bar { height: 100%; background: linear-gradient(90deg, #D500F9, #00E676); width: 0%; transition: width 0.4s ease-out; }
        
        .ins-body { padding: 10px; background: #111; max-height: 400px; overflow-y: auto;}
        .msg-list { max-height: 120px; overflow-y: auto; border: 1px solid #333; margin-bottom: 10px; background: #0a0a0a; border-radius: 4px; }
        .msg-item { padding: 6px; cursor: pointer; border-bottom: 1px solid #222; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #888; transition: 0.2s;}
        .msg-item:hover { background: #330044; color: #fff; padding-left: 10px;}

        /* Buttons */
        .toggle-numpad-btn { background: #333; color: #fff; border: 1px solid #555; border-radius: 3px; padding: 2px 8px; font-size: 10px; cursor: pointer; }
        .toggle-numpad-btn:hover { background: #555; }
        
        /* Numpad */
        .numpad-wrapper { background: #1a1a1a; padding: 8px; border-radius: 4px; margin-bottom: 10px; border: 1px solid #333; animation: fade-in 0.2s; }
        .numpad-display { background: #000; padding: 4px; text-align: right; font-family: monospace; border: 1px solid #444; margin-bottom: 5px; height: 20px; display:flex; align-items:center; justify-content:flex-end; color: #fff;}
        .numpad-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px; }
        .num-btn { background: #2a2a2a; color: #ccc; border: 1px solid #444; border-radius: 3px; padding: 6px; font-size: 11px; cursor: pointer; }
        .num-btn:active { background: #D500F9; color: #fff; }
        .del-btn { color: #ff4081; }
        .go-btn { background: #00E676; color: #000; font-weight:bold; }

        /* Viewer */
        .viewer-container { margin-bottom: 10px; border: 1px solid #D500F9; border-radius: 4px; background: #080808; overflow: hidden; animation: fade-in 0.2s; }
        .viewer-header { background: #1a0520; padding: 5px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; }
        .close-btn { background: #ff4081; color: #fff; border: none; font-size: 9px; padding: 2px 6px; border-radius: 2px; cursor: pointer; }
        .view-area { padding: 8px; height: 120px; overflow-y: auto; color: #00E676; white-space: pre-wrap; word-wrap: break-word; font-size: 11px; }

        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #111; }
        ::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #D500F9; }
        @keyframes fade-in { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
    `;
    document.head.appendChild(style);
};

// =================================================================
// 7. INIT
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

const createUI = () => {
    const oldOrb = document.getElementById('chronos-orb'); if (oldOrb) oldOrb.remove();
    const oldPanel = document.getElementById('chronos-inspector'); if (oldPanel) oldPanel.remove();
    const orb = document.createElement('div'); orb.id = 'chronos-orb'; orb.innerHTML = '🌀';
    const ins = document.createElement('div'); ins.id = 'chronos-inspector';
    document.body.appendChild(orb); document.body.appendChild(ins);
    orb.onclick = (e) => {
        if (orb.getAttribute('data-dragging') === 'true') return;
        ins.style.display = (ins.style.display === 'none') ? 'block' : 'none';
        if (ins.style.display === 'block') updateUI();
    };
    makeDraggable(orb, 'orb'); makeDraggable(ins, 'panel');
};

(function() {
    injectStyles();
    setTimeout(createUI, 2000); 
    if (typeof SillyTavern !== 'undefined' && SillyTavern.extension_manager) {
        SillyTavern.extension_manager.register_hook('chat_completion_request', optimizePayload);
        SillyTavern.extension_manager.register_hook('text_completion_request', optimizePayload);
    }
    // Loop updates only if panel is open, and only texts
    setInterval(() => {
        const ins = document.getElementById('chronos-inspector');
        if (ins && ins.style.display === 'block') updateUI();
    }, 2000);
})();
