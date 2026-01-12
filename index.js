// index.js - Chronos V66.21 (Original Logic + Tab System) 🌌
// UI: Neon V47 (Preserved) + Friend Overlay
// Fix: Removes innerHTML spam. Uses DOM text updates.

const extensionName = "Chronos_Integrated_Full";

// =================================================================
// 0. CONFIG (ส่วนเดียวที่เพิ่มเข้ามาในท่อนนี้)
// =================================================================
// ⚠️ ใส่ Prompt แก๊งเพื่อนตรงนี้ (ห้ามลบ ` หัวท้าย)
const FRIEND_SYSTEM_PROMPT = `
Usage: Always active
Use HTML code following the specified format.
All five personalities act as close friends...
(วาง Prompt ของคุณทับข้อความนี้)
Progress Enforcement: ...
`;

// =================================================================
// 1. STATE & CACHE
// =================================================================
let dragConfig = { orbUnlocked: false, panelUnlocked: false };
let uiState = {
    showNumpad: false,
    viewingId: null,
    numpadValue: "ID...",
    isPanelBuilt: false, // Track if we need to build HTML
    friendMode: false    // <--- เพิ่มตัวแปรสำหรับโหมดเพื่อน
};

let friendChatHistory = []; // เก็บประวัติแชทเพื่อน

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
    renderListSection();   // Re-render list to show active state
};

window.closeViewer = () => {
    uiState.viewingId = null;
    renderViewerSection();
    renderListSection();
};

window.closePanel = () => {
    const ins = document.getElementById('chronos-inspector');
    if (ins) ins.style.display = 'none';
};

// --- NEW SYSTEM: TAB & FRIEND CHAT ---
window.toggleTabMode = () => {
    uiState.friendMode = !uiState.friendMode;
    
    // สลับ View
    const normalView = document.getElementById('view-normal');
    const friendView = document.getElementById('view-friend');
    const tabBtn = document.getElementById('holo-tab-btn');

    if (normalView && friendView) {
        normalView.style.display = uiState.friendMode ? 'none' : 'block';
        friendView.style.display = uiState.friendMode ? 'flex' : 'none';
    }

    // เปลี่ยนข้อความบนปุ่ม Tab
    if (tabBtn) {
        tabBtn.innerText = uiState.friendMode ? 'STATS' : 'SYSTEM';
        tabBtn.style.color = uiState.friendMode ? '#D500F9' : '#000'; // สีม่วงตอนกลับ, สีดำตอนอยู่ System
    }
};

window.sendFriendMsg = async () => {
    const input = document.getElementById('friend-input');
    const log = document.getElementById('friend-log');
    const txt = input.value.trim();
    if (!txt) return;
    
    input.value = ''; 

    // 1. Show User Msg
    log.innerHTML += `<div style="margin-bottom:6px; text-align:right; padding:6px; background:#333; border-radius:4px; color:#aaa;"><b>Op:</b> ${txt}</div>`;
    friendChatHistory.push({ role: 'user', content: `[message] ${txt}` });
    log.scrollTop = log.scrollHeight;

    // 2. Prepare Context
    const context = SillyTavern.getContext();
    const lastMsg = context.chat && context.chat.length > 0 ? context.chat[context.chat.length-1] : { name: '?', mes: '' };
    const cleanMes = stripHtmlToText(lastMsg.mes);
    
    // 3. Payload
    const payload = [
        { role: 'system', content: FRIEND_SYSTEM_PROMPT },
        ...friendChatHistory,
        { role: 'user', content: `(Current Story Context:\n${lastMsg.name}: ${cleanMes})\n\n[message] ${txt}` }
    ];

    // 4. Send API
    const loadId = 'load-' + Date.now();
    log.innerHTML += `<div id="${loadId}" style="color:#C5A059; font-size:10px; margin:5px;">System Processing...</div>`;
    log.scrollTop = log.scrollHeight;

    try {
        let reply = "";
        if (typeof SillyTavern.Generate === 'function') {
             reply = await SillyTavern.Generate(payload, { quiet: true });
        } else {
             reply = "⚠️ API Error: Generation function not found.";
        }
        document.getElementById(loadId).remove();
        friendChatHistory.push({ role: 'assistant', content: reply });
        
        log.innerHTML += `<div style="margin-bottom:10px; padding:5px; border-radius:4px;">${reply}</div>`;

    } catch (e) {
        document.getElementById(loadId).innerText = "Error: " + e.message;
    }
    log.scrollTop = log.scrollHeight;
};
// =================================================================
// 5. CORE RENDERER (Updated with Tab & Animations)
// =================================================================

// A. Build the Skeleton
const buildBaseUI = () => {
    const ins = document.getElementById('chronos-inspector');
    if (!ins) return;
    
    ins.innerHTML = `
        <div id="holo-tab-btn" onclick="toggleTabMode()">SYSTEM</div>

        <div class="ins-header" id="panel-header">
            <span>🚀 CHRONOS V66.21</span>
            <span style="cursor:pointer; color:#ff4081;" onclick="closePanel()">✖</span>
        </div>
        
        <div class="control-zone">
            <div class="switch-row">
                <label class="neon-switch">
                    <input type="checkbox" onchange="toggleDrag('orb', this.checked)" ${dragConfig.orbUnlocked ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
                <span class="switch-label">Move Orb</span>
            </div>
            
            <div class="switch-row">
                <label class="neon-switch">
                    <input type="checkbox" onchange="toggleDrag('panel', this.checked)" ${dragConfig.panelUnlocked ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
                <span class="switch-label">Move Win</span>
            </div>
        </div>

        <div id="view-normal" style="display: ${uiState.friendMode ? 'none' : 'block'};">
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
        </div>

        <div id="view-friend" style="display: ${uiState.friendMode ? 'flex' : 'none'}; flex-direction: column; height: 380px;">
            <div id="friend-log" style="flex:1; overflow-y:auto; padding:10px; background:#1a1a1a; font-size:12px; color:#ccc;">
                <div style="text-align:center; color:#555; margin-top:20px;">
                    System Access Granted.<br>Connected.
                </div>
            </div>
            <div style="padding:8px; background:#222; display:flex; gap:5px; border-top:2px solid #C5A059;">
                <input type="text" id="friend-input" style="flex:1; background:#000; border:1px solid #444; color:#fff; padding:5px; font-size:12px;" placeholder="Command / Message..." onkeydown="if(event.key==='Enter') sendFriendMsg()">
                <button onclick="sendFriendMsg()" style="background:#C5A059; border:none; color:#000; font-weight:bold; cursor:pointer; padding:0 10px;">➤</button>
            </div>
        </div>
    `;
    uiState.isPanelBuilt = true;
};

// B. Update Numbers
const updateUI = () => {
    const ins = document.getElementById('chronos-inspector');
    if (!ins || ins.style.display === 'none') return;

    if (!uiState.isPanelBuilt || ins.innerHTML === "") {
        buildBaseUI();
    }

    // Skip stats if in friend mode
    if (uiState.friendMode) return;

    const stats = calculateStats();
    const fmt = (n) => (n ? n.toLocaleString() : "0");

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
    
    let percent = stats.max > 0 ? Math.min((stats.currentLoad / stats.max) * 100, 100) : 0;
    if (Math.abs(percent - lastRenderData.load) > 0.5) {
        document.getElementById('disp-bar').style.width = `${percent}%`;
        lastRenderData.load = percent;
    }

    if (stats.totalMsgs !== lastRenderData.msgCount) {
        renderListSection();
        lastRenderData.msgCount = stats.totalMsgs;
    }

    if (document.getElementById('section-numpad').innerHTML === "" && uiState.showNumpad) renderNumpadSection();
};

const renderNumpadSection = () => {
    const container = document.getElementById('section-numpad');
    const btn = document.getElementById('btn-toggle-numpad');
    if (btn) btn.innerText = uiState.showNumpad ? '🔽 Hide' : '🔢 Search';
    
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
            
            // เพิ่ม Logic: Active Class
            const isActive = (uiState.viewingId === actualIdx);
            const activeClass = isActive ? 'msg-active' : '';

            return `<div class="msg-item ${activeClass}" onclick="setViewingId(${actualIdx})">
                        <span style="color:#D500F9;">#${actualIdx}</span> ${roleIcon} ${preview}...
                    </div>`;
        }).join('');
    } else {
        container.innerHTML = `<div style="padding:5px; color:#666; font-style:italic; font-size:10px;">No messages</div>`;
    }
};

// =================================================================
// 6. STYLES (Upgraded)
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
            background: rgba(10, 10, 12, 0.98); 
            border: 1px solid #D500F9; border-top: 3px solid #D500F9;
            color: #E1BEE7; font-family: 'Consolas', monospace; font-size: 12px;
            display: none; 
            z-index: 2147483647;
            border-radius: 8px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.9); backdrop-filter: blur(10px);
            overflow: visible; /* เปิดให้ Tab งอกออกมาได้ */
        }

        /* --- NEW TAB BUTTON (ปุ่มทอง) --- */
        #holo-tab-btn {
            position: absolute; top: -24px; right: 20px;
            background: #C5A059;
            color: #000; font-size: 11px; font-weight: 800; letter-spacing: 1px;
            padding: 4px 15px; border-radius: 4px 4px 0 0;
            border: 1px solid #E6B870; border-bottom: 2px solid #C5A059;
            box-shadow: 0 -4px 10px rgba(197, 160, 89, 0.3);
            z-index: 10;
            cursor: pointer; transition: 0.2s;
        }
        #holo-tab-btn:hover { transform: translateY(-2px); box-shadow: 0 -6px 15px rgba(197, 160, 89, 0.6); }

        .ins-header { 
            background: linear-gradient(90deg, #4A0072, #2a0040); 
            color: #fff; padding: 10px; font-weight: bold; letter-spacing: 1px; display: flex; justify-content: space-between; 
            border-bottom: 1px solid #D500F9;
        }

        /* --- NEON SWITCHES --- */
        .control-zone { display: flex; gap: 15px; padding: 10px; background: #150518; border-bottom: 1px solid #330044; align-items: center;}
        .switch-row { display: flex; align-items: center; gap: 8px; }
        .switch-label { font-size: 11px; color: #ccc; }
        .neon-switch { position: relative; display: inline-block; width: 30px; height: 16px; }
        .neon-switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #333; transition: .4s; border-radius: 16px; border: 1px solid #555; }
        .slider:before { position: absolute; content: ""; height: 10px; width: 10px; left: 2px; bottom: 2px; background-color: white; transition: .4s; border-radius: 50%; }
        input:checked + .slider { background-color: #2a0040; border-color: #00E676; }
        input:checked + .slider:before { transform: translateX(14px); background-color: #00E676; box-shadow: 0 0 5px #00E676; }

        .dashboard-zone { background: #050505; padding: 15px; border-bottom: 1px solid #333; }
        .dash-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; align-items: center; }
        .dash-val { font-weight: bold; font-size: 13px; }
        .progress-container { width: 100%; height: 6px; background: #222; border-radius: 3px; margin-top: 8px; overflow: hidden; }
        .progress-bar { height: 100%; background: linear-gradient(90deg, #D500F9, #00E676); width: 0%; transition: width 0.4s ease-out; }
        
        .ins-body { padding: 10px; background: #111; max-height: 400px; overflow-y: auto;}
        
        /* --- LIST ANIMATION (Swipe) --- */
        .msg-list { max-height: 120px; overflow-y: auto; border: 1px solid #333; margin-bottom: 10px; background: #0a0a0a; border-radius: 4px; }
        .msg-item { padding: 8px; cursor: pointer; border-bottom: 1px solid #222; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #888; transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); }
        .msg-item:hover { background: #330044; color: #fff; padding-left: 12px; }
        
        .msg-active { 
            background: linear-gradient(90deg, #330044, #1a0520); 
            color: #fff; 
            padding-left: 15px !important; /* ดันไปขวา */
            border-left: 3px solid #00E676; /* ขีดเขียว */
            transform: translateX(5px); /* ขยับวืบ */
            box-shadow: -5px 0 10px rgba(0,0,0,0.5);
        }

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
    const orb = document.createElement('div'); orb.id = 'chronos-orb'; orb.innerHTML = '🌌';
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
        

