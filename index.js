// index.js - Chronos V32 (Native Linker) 🔗💎

const extensionName = "Chronos_V32_Native";

// ค่าเริ่มต้น (ไม่ต้องมีตัวหารแล้ว มีแค่ Base Offset เผื่อไว้)
let config = {
    baseOffset: 0 // เดี๋ยวเราจะลองคำนวณ Base อัตโนมัติด้วย
};

// =================================================================
// 1. Logic: Stripper (ล้างโค้ดเหมือนเดิม)
// =================================================================
const stripHtmlToText = (html) => {
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
// 2. Logic: Native Tokenizer (พระเอกของงาน)
// =================================================================
const getNativeTokenCount = (text) => {
    if (!text) return 0;
    
    try {
        // วิธีที่ 1: เรียกผ่าน Module ของ SillyTavern โดยตรง (แม่นยำที่สุด)
        if (typeof SillyTavern !== 'undefined' && SillyTavern.Tokenizers && typeof SillyTavern.Tokenizers.encode === 'function') {
            const tokens = SillyTavern.Tokenizers.encode(text);
            return tokens.length;
        }
        
        // วิธีที่ 2: ถ้าหาไม่เจอ ลองเรียกผ่าน Global Encoder (บางเวอร์ชันใช้ตัวนี้)
        if (typeof GPTTokenizer_Encoding_Encode === 'function') {
            return GPTTokenizer_Encoding_Encode(text).length;
        }

        // วิธีที่ 3: กันตาย (ถ้าหาไม่เจอจริงๆ ค่อยใช้สูตรหาร)
        console.warn("[Chronos] Native tokenizer not found, falling back to estimation.");
        return Math.round(text.length / 2.5);
        
    } catch (e) {
        console.error("[Chronos] Tokenizer Error:", e);
        return 0;
    }
};

// =================================================================
// 3. Logic: Context Calculator
// =================================================================
const calculateStats = () => {
    if (typeof SillyTavern === 'undefined') return { chatRaw: 0, chatReal: 0, totalRaw: 0, totalReal: 0 };
    
    const context = SillyTavern.getContext();
    const chat = context.chat || [];
    const maxTokens = context.max_context || 8192;
    
    // --- 1. คำนวณ Base (System + Card) แบบ Native ---
    let baseTokens = 0;
    
    // ลองคำนวณ Base จากข้อมูลจริง
    if (context.characterId && SillyTavern.characters && SillyTavern.characters[context.characterId]) {
        const char = SillyTavern.characters[context.characterId];
        // รวมทุกอย่างที่เป็นโครงสร้างหลัก
        const charText = (char.description || "") + "\n" + 
                         (char.personality || "") + "\n" + 
                         (char.scenario || "") + "\n" + 
                         (char.first_mes || "");
        
        // บวก System Prompt (ประมาณการ หรือดึงถ้าทำได้)
        // System Prompt มักจะซ่อนอยู่ลึก เราจะบวกค่าเฉลี่ยมาตรฐาน หรือใช้ค่า Offset ที่ user ตั้งเผื่อไว้
        baseTokens = getNativeTokenCount(charText) + config.baseOffset;
    } else {
        baseTokens = config.baseOffset;
    }

    // --- 2. คำนวณ Chat History ---
    let chatRaw = 0;
    let chatReal = 0;
    let rememberedCount = 0;
    
    // เริ่มต้นนับที่ Base
    let currentRawTotal = baseTokens;
    let currentRealTotal = baseTokens;

    for (let i = chat.length - 1; i >= 0; i--) {
        const msg = chat[i];
        
        // Raw (แบบ Silly) - ใช้ Native Count
        const rawTok = getNativeTokenCount(msg.mes) + 5; // +5 เผื่อ Metadata
        
        // Real (แบบตัดแล้ว) - ใช้ Native Count
        let content = msg.mes;
        if (content.includes('<') && content.includes('>')) {
            const clean = stripHtmlToText(content);
            content = `[System Content:\n${clean}]`;
        }
        const realTok = getNativeTokenCount(content) + 5;

        // เช็คโควต้า (ใช้ยอด Real เป็นตัวตัดสิน)
        if (currentRealTotal + realTok < maxTokens) {
            chatRaw += rawTok;
            chatReal += realTok;
            
            currentRawTotal += rawTok;
            currentRealTotal += realTok;
            rememberedCount++;
        } else {
            // หยุดนับเมื่อเต็ม
            break;
        }
    }

    return {
        base: baseTokens,
        chatRaw: chatRaw,
        chatReal: chatReal,
        totalRaw: currentRawTotal,
        totalReal: currentRealTotal,
        max: maxTokens,
        count: rememberedCount
    };
};

// =================================================================
// UI (ยังคงฟีเจอร์เดิมครบถ้วน)
// =================================================================
const injectStyles = () => {
    const style = document.createElement('style');
    style.innerHTML = `
        #chronos-orb {
            position: fixed; top: 150px; right: 20px; width: 35px; height: 35px;
            background: rgba(10, 0, 15, 0.9); border: 2px solid #D500F9; border-radius: 50%;
            z-index: 999999; cursor: pointer; display: flex; align-items: center; justify-content: center;
            font-size: 18px; color: #E040FB; box-shadow: 0 0 15px rgba(213, 0, 249, 0.6);
            user-select: none; animation: spin-slow 4s linear infinite;
        }
        #chronos-orb:hover { border-color: #00E676; color: #00E676; box-shadow: 0 0 25px #00E676; }
        @keyframes spin-slow { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        #chronos-inspector {
            position: fixed; top: 80px; right: 70px; width: 320px; 
            background: rgba(15, 0, 20, 0.98); border: 2px solid #D500F9;
            color: #E1BEE7; font-family: 'Consolas', monospace; font-size: 11px;
            display: none; z-index: 999999; border-radius: 12px;
            box-shadow: 0 10px 50px #000; backdrop-filter: blur(5px);
        }
        .ins-header { background: linear-gradient(90deg, #330044, #5c007a); color: #fff; padding: 8px 10px; font-weight: bold; border-bottom: 1px solid #D500F9; display: flex; justify-content: space-between; }
        .control-zone { display: flex; gap: 10px; padding: 5px 10px; background: #220033; border-bottom: 1px solid #550077; font-size: 10px; color: #00E676; }
        
        .calib-zone { background: #111; padding: 10px; border-bottom: 1px solid #333; }
        .calib-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px; }
        .calib-input { background: #000; border: 1px solid #555; color: #fff; width: 60px; text-align: center; }
        
        .dashboard-zone { background: #000; padding: 10px; border-bottom: 1px solid #333; }
        .dash-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
        .sub-row { display: flex; justify-content: space-between; margin-bottom: 2px; padding-left: 10px; color: #777; font-size: 10px; }

        .ins-body { padding: 10px; }
        .search-row { display: flex; gap: 5px; margin-bottom: 10px; }
        .search-input { background: #222; border: 1px solid #D500F9; color: #fff; padding: 3px; width: 50px; border-radius: 3px; }
        .search-btn { background: #D500F9; color: #000; border: none; padding: 3px 8px; cursor: pointer; border-radius: 3px; font-weight:bold;}
        .msg-list { max-height: 100px; overflow-y: auto; border: 1px solid #333; margin-bottom: 10px; background: #111; }
        .msg-item { padding: 5px; cursor: pointer; border-bottom: 1px solid #222; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #aaa; }
        .msg-item:hover { background: #330044; color: #fff; }
        .view-area { background: #000; color: #00E676; padding: 8px; height: 120px; overflow-y: auto; font-size: 10px; white-space: pre-wrap; border: 1px solid #5c007a; border-radius: 4px; }
        .stat-badge { display: flex; justify-content: space-between; margin-top: 5px; background: #222; padding: 5px; border-radius: 4px; }
    `;
    document.head.appendChild(style);
};

let dragConfig = { orbUnlocked: false, panelUnlocked: false };

const createUI = () => {
    const old = document.getElementById('chronos-orb'); if (old) old.remove();
    const oldPanel = document.getElementById('chronos-inspector'); if (oldPanel) oldPanel.remove();
    const orb = document.createElement('div'); orb.id = 'chronos-orb'; orb.innerHTML = '🌀';
    const ins = document.createElement('div'); ins.id = 'chronos-inspector';
    document.body.appendChild(orb); document.body.appendChild(ins);
    
    orb.onclick = (e) => {
        if (orb.getAttribute('data-dragging') === 'true') return;
        ins.style.display = (ins.style.display === 'none') ? 'block' : 'none';
        if (ins.style.display === 'block') renderInspector();
    };
    makeDraggable(orb, 'orb'); makeDraggable(ins, 'panel');
};

const renderInspector = () => {
    const ins = document.getElementById('chronos-inspector');
    const chat = SillyTavern.getContext().chat || [];
    const stats = calculateStats();

    let listHtml = chat.slice(-5).reverse().map((msg, i) => {
        const actualIdx = chat.length - 1 - i;
        const preview = msg.mes.substring(0, 20).replace(/</g, '&lt;');
        return `<div class="msg-item" onclick="viewAIVersion(${actualIdx})">#${actualIdx} ${msg.is_user ? '👤' : '🤖'} ${preview}...</div>`;
    }).join('');

    ins.innerHTML = `
        <div class="ins-header" id="panel-header">
            <span>🔗 NATIVE LINKER V32</span>
            <span style="cursor:pointer;" onclick="this.parentElement.parentElement.style.display='none'">✖</span>
        </div>
        
        <div class="control-zone">
            <label style="display:flex;gap:5px;cursor:pointer;"><input type="checkbox" onchange="toggleDrag('orb', this.checked)" ${dragConfig.orbUnlocked ? 'checked' : ''}>🔓Orb</label>
            <label style="display:flex;gap:5px;cursor:pointer;"><input type="checkbox" onchange="toggleDrag('panel', this.checked)" ${dragConfig.panelUnlocked ? 'checked' : ''}>🔓Win</label>
        </div>

        <div class="calib-zone">
            <div style="font-size:10px; color:#aaa; margin-bottom:5px;">
                ระบบกำลังใช้ <b>Native Tokenizer</b> ของ SillyTavern คำนวณ
            </div>
            <div class="calib-row">
                <span>Extra Offset:</span>
                <input type="number" value="${config.baseOffset}" class="calib-input" onchange="updateOffset(this.value)">
            </div>
            <div style="font-size:9px; color:#555;">(ใส่เลขเพิ่ม ถ้า Base ยังไม่ตรงเป๊ะ)</div>
            <button onclick="renderInspector()" style="width:100%; margin-top:5px; background:#333; color:#fff; border:none; cursor:pointer;">🔄 REFRESH</button>
        </div>

        <div class="dashboard-zone">
            <div class="dash-row">
                <span style="color:#FF9800;">🟠 Total Raw:</span>
                <b style="color:#FF9800;">${stats.totalRaw}</b>
            </div>
            <div class="sub-row">
                <span>(Base: ${stats.base} | Chat: ${stats.chatRaw})</span>
            </div>

            <div class="dash-row" style="border-top:1px solid #333; margin-top:5px; padding-top:5px;">
                <span style="color:#00E676;">🟢 Total Real:</span>
                <b style="color:#00E676;">${stats.totalReal} / ${stats.max}</b>
            </div>
            <div class="sub-row">
                <span style="color:#00E676;">(Chat Real: ${stats.chatReal})</span>
            </div>
        </div>

        <div class="ins-body">
            <div class="search-row">
                <span>ID:</span> <input type="number" id="chronos-search-id" class="search-input">
                <button class="search-btn" onclick="searchById()">Check</button>
            </div>
            <div class="msg-list">${listHtml}</div>
            <div id="view-target"></div>
        </div>
    `;
};

window.updateOffset = (value) => {
    config.baseOffset = parseInt(value) || 0;
};

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
        const clientX = e.clientX || e.touches[0].clientX; const clientY = e.clientY || e.touches[0].clientY;
        pos3 = clientX; pos4 = clientY;
        document.onmouseup = dragEnd; document.onmousemove = dragAction;
        document.ontouchend = dragEnd; document.ontouchmove = dragAction;
        elm.setAttribute('data-dragging', 'true');
    };
    const dragAction = (e) => {
        const clientX = e.clientX || e.touches[0].clientX; const clientY = e.clientY || e.touches[0].clientY;
        pos1 = pos3 - clientX; pos2 = pos4 - clientY; pos3 = clientX; pos4 = clientY;
        elm.style.top = (elm.offsetTop - pos2) + "px"; elm.style.left = (elm.offsetLeft - pos1) + "px";
        e.preventDefault();
    };
    const dragEnd = () => {
        document.onmouseup = null; document.onmousemove = null; document.ontouchend = null; document.ontouchmove = null;
        setTimeout(() => elm.setAttribute('data-dragging', 'false'), 100);
    };
    elm.onmousedown = dragStart; elm.ontouchstart = dragStart;
};

window.searchById = () => {
    const id = parseInt(document.getElementById('chronos-search-id').value);
    const chat = SillyTavern.getContext().chat || [];
    if (isNaN(id) || id < 0 || id >= chat.length) { alert("Invalid ID"); return; }
    viewAIVersion(id);
};

window.viewAIVersion = (index) => {
    const chat = SillyTavern.getContext().chat;
    const msg = chat[index].mes;
    const rawTokens = getNativeTokenCount(msg.mes);
    const cleanText = stripHtmlToText(msg.mes);
    const aiViewText = `[System Content:\n${cleanText}]`;
    const cleanTokens = getNativeTokenCount(aiViewText);
    const saved = rawTokens - cleanTokens;

    document.getElementById('view-target').innerHTML = `
        <div style="margin-bottom:3px; color:#D500F9;">ID: #${index}</div>
        <div class="view-area">${aiViewText}</div>
        <div class="stat-badge">
            <span>Raw: <b>${rawTokens}</b></span>
            <span style="color:#00E676;">Real: <b>${cleanTokens}</b></span>
            <span style="color:#E040FB;">Save: <b>${saved > 0 ? saved : 0}</b></span>
        </div>
    `;
};

const optimizePayload = (data) => {
    const process = (text) => {
        if (text && /<[^>]+>|&lt;[^&]+&gt;/.test(text)) return `[System Content:\n${stripHtmlToText(text)}]`;
        return text;
    };
    if (data.body && data.body.messages) data.body.messages.forEach(msg => msg.content = process(msg.content));
    else if (data.body && data.body.prompt) data.body.prompt = process(data.body.prompt);
    return data;
};

injectStyles();
setTimeout(createUI, 1500);
if (typeof SillyTavern !== 'undefined') {
    SillyTavern.extension_manager.register_hook('chat_completion_request', optimizePayload);
    SillyTavern.extension_manager.register_hook('text_completion_request', optimizePayload);
}
    
