// index.js - Chronos V28 (Persistent & Smart Click) 💾🖱️

const extensionName = "Chronos_V28_Persistent";

// ค่าตัวหารเริ่มต้น (Calibration)
let calibration = {
    thaiDivisor: 1.3,
    engDivisor: 3.5
};

// Config การลาก
let dragConfig = { orbUnlocked: false, panelUnlocked: false };

// =================================================================
// 1. Logic: Save/Load System (จำตำแหน่ง)
// =================================================================
const savePosition = (id, top, left) => {
    localStorage.setItem(`chronos_pos_${id}`, JSON.stringify({ top, left }));
};

const loadPosition = (id, element) => {
    const saved = localStorage.getItem(`chronos_pos_${id}`);
    if (saved) {
        const pos = JSON.parse(saved);
        element.style.top = pos.top;
        element.style.left = pos.left;
        // ป้องกันตกขอบจอ (ถ้าเคยลากไปไกลแล้วย่อจอ)
        /* (Optional constraints logic could go here) */
    }
};

// =================================================================
// 2. Logic: Stripper & Estimator
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

const estimateTokens = (text) => {
    if (!text) return 0;
    const thaiChars = (text.match(/[\u0E00-\u0E7F]/g) || []).length;
    const otherChars = text.length - thaiChars;
    return Math.round(thaiChars / calibration.thaiDivisor) + Math.round(otherChars / calibration.engDivisor);
};

const calculateDualContext = () => {
    if (typeof SillyTavern === 'undefined') return { raw: 0, real: 0, max: 0, count: 0 };
    const context = SillyTavern.getContext();
    const chat = context.chat || [];
    const maxTokens = context.max_context || 8192; 
    
    let baseRaw = 0;
    if (context.characterId && SillyTavern.characters && SillyTavern.characters[context.characterId]) {
        const char = SillyTavern.characters[context.characterId];
        const baseText = (char.description || "") + (char.first_mes || "") + (char.personality || "") + (char.scenario || "");
        baseRaw = estimateTokens(baseText) + 500;
    }
    
    let currentRaw = baseRaw;
    let currentReal = baseRaw;
    let rememberedMsgCount = 0;

    for (let i = chat.length - 1; i >= 0; i--) {
        const msg = chat[i];
        const rawTok = estimateTokens(msg.mes) + 5;
        
        let content = msg.mes;
        if (content.includes('<') && content.includes('>')) {
            content = `[System Content:\n${stripHtmlToText(content)}]`;
        }
        const realTok = estimateTokens(content) + 5;

        if (currentReal + realTok < maxTokens) {
            currentRaw += rawTok;
            currentReal += realTok;
            rememberedMsgCount++;
        } else {
            break;
        }
    }
    return { raw: currentRaw, real: currentReal, max: maxTokens, count: rememberedMsgCount };
};

// =================================================================
// 3. UI
// =================================================================
const injectStyles = () => {
    const style = document.createElement('style');
    style.innerHTML = `
        #chronos-orb {
            position: fixed; top: 150px; right: 20px;
            width: 35px; height: 35px;
            background: rgba(10, 0, 15, 0.9);
            border: 2px solid #D500F9; border-radius: 50%;
            z-index: 999999; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            font-size: 18px; color: #E040FB;
            box-shadow: 0 0 15px rgba(213, 0, 249, 0.6);
            user-select: none; touch-action: none;
            animation: spin-slow 4s linear infinite;
        }
        #chronos-orb:hover { border-color: #00E676; color: #00E676; box-shadow: 0 0 25px #00E676; }
        @keyframes spin-slow { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        #chronos-inspector {
            position: fixed; top: 100px; right: 70px; width: 320px; 
            background: rgba(15, 0, 20, 0.98); border: 2px solid #D500F9;
            color: #E1BEE7; font-family: 'Consolas', monospace; font-size: 11px;
            display: none; z-index: 999999; border-radius: 12px;
            box-shadow: 0 10px 50px #000; overflow: hidden;
            backdrop-filter: blur(5px);
        }
        .ins-header { 
            background: linear-gradient(90deg, #330044, #5c007a); 
            color: #fff; padding: 8px 10px; font-weight: bold; 
            border-bottom: 1px solid #D500F9; display: flex; justify-content: space-between;
        }
        .control-zone {
            display: flex; gap: 10px; padding: 5px 10px; background: #220033;
            border-bottom: 1px solid #550077; font-size: 10px; color: #00E676;
        }
        .calib-zone { background: #111; padding: 10px; border-bottom: 1px solid #333; }
        .calib-row { display: flex; align-items: center; gap: 5px; margin-bottom: 5px; }
        .calib-input { background: #000; border: 1px solid #555; color: #fff; width: 50px; text-align: center; }
        
        .dashboard-zone { background: #000; padding: 10px; border-bottom: 1px solid #333; }
        .dash-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
        .progress-bg { width: 100%; height: 6px; background: #333; border-radius: 3px; overflow: hidden; margin-top: 5px; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #00E676, #00C853); width: 0%; transition: width 0.5s; }
        
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

const createUI = () => {
    const old = document.getElementById('chronos-orb');
    if (old) old.remove();
    const oldPanel = document.getElementById('chronos-inspector');
    if (oldPanel) oldPanel.remove();

    const orb = document.createElement('div');
    orb.id = 'chronos-orb';
    orb.innerHTML = '🌀';
    
    const ins = document.createElement('div');
    ins.id = 'chronos-inspector';
    
    document.body.appendChild(orb);
    document.body.appendChild(ins);

    // Load ตำแหน่งที่บันทึกไว้
    loadPosition('orb', orb);
    loadPosition('panel', ins);

    // ติดตั้งระบบลากแบบใหม่ (Smart Click)
    setupSmartDrag(orb, 'orb', () => {
        // Callback เมื่อเกิดการ "คลิก" (ไม่ใช่ลาก)
        ins.style.display = (ins.style.display === 'none') ? 'block' : 'none';
        if (ins.style.display === 'block') renderInspector();
    });

    setupSmartDrag(ins, 'panel', null); // Panel ไม่ต้องมีคลิก
};

const renderInspector = () => {
    const ins = document.getElementById('chronos-inspector');
    const chat = SillyTavern.getContext().chat || [];
    const stats = calculateDualContext();
    const percent = Math.min((stats.used / stats.max) * 100, 100);

    let listHtml = chat.slice(-5).reverse().map((msg, i) => {
        const actualIdx = chat.length - 1 - i;
        const preview = msg.mes.substring(0, 20).replace(/</g, '&lt;');
        return `<div class="msg-item" onclick="viewAIVersion(${actualIdx})">#${actualIdx} ${msg.is_user ? '👤' : '🤖'} ${preview}...</div>`;
    }).join('');

    ins.innerHTML = `
        <div class="ins-header" id="panel-header">
            <span>💾 V28 PERSISTENT</span>
            <span style="cursor:pointer;" onclick="this.parentElement.parentElement.style.display='none'">✖</span>
        </div>
        
        <div class="control-zone">
            <label style="display:flex;gap:5px;cursor:pointer;"><input type="checkbox" onchange="toggleDrag('orb', this.checked)" ${dragConfig.orbUnlocked ? 'checked' : ''}>🔓Orb</label>
            <label style="display:flex;gap:5px;cursor:pointer;"><input type="checkbox" onchange="toggleDrag('panel', this.checked)" ${dragConfig.panelUnlocked ? 'checked' : ''}>🔓Win</label>
        </div>

        <div class="calib-zone">
            <div style="color:#E040FB; margin-bottom:5px;">Calibration (Th/En):</div>
            <div class="calib-row">
                <span>🇹🇭:</span>
                <input type="number" step="0.1" value="${calibration.thaiDivisor}" class="calib-input" onchange="updateCalib('thai', this.value)">
                <span>🇺🇸:</span>
                <input type="number" step="0.1" value="${calibration.engDivisor}" class="calib-input" onchange="updateCalib('eng', this.value)">
            </div>
            <button onclick="renderInspector()" style="width:100%; margin-top:5px; background:#333; color:#fff; border:none; cursor:pointer;">🔄 Recalculate</button>
        </div>

        <div class="dashboard-zone">
            <div class="dash-row" style="border-bottom:1px solid #333; padding-bottom:5px; margin-bottom:5px;">
                <span style="color:#FF9800;">🟠 Raw:</span>
                <b style="color:#FF9800;">${stats.raw} Tok</b>
            </div>
            <div class="dash-row">
                <span style="color:#00E676;">🟢 Real:</span>
                <b style="color:#00E676;">${stats.real} / ${stats.max}</b>
            </div>
            <div class="progress-bg"><div class="progress-fill" style="width: ${percent}%"></div></div>
            <div class="dash-row" style="margin-top:8px;">
                <span style="color:#aaa;">Memory:</span>
                <span style="color:#E040FB;">${stats.count} msgs</span>
            </div>
        </div>

        <div class="ins-body">
            <div class="search-row">
                <input type="number" id="chronos-search-id" class="search-input" placeholder="ID">
                <button class="search-btn" onclick="searchById()">Check</button>
            </div>
            <div class="msg-list">${listHtml}</div>
            <div id="view-target"></div>
        </div>
    `;
};

// =================================================================
// 4. Smart Drag System (แก้ปัญหาคลิกยาก)
// =================================================================
const setupSmartDrag = (elm, type, onClick) => {
    let pos1=0, pos2=0, pos3=0, pos4=0;
    let isDragging = false; // ตัวจับว่าขยับเมาส์ไปเยอะไหม
    let startX = 0, startY = 0;

    const dragStart = (e) => {
        // เช็คว่า Unlock หรือยัง
        if (type === 'orb' && !dragConfig.orbUnlocked) {
            // ถ้าล็อคอยู่ ให้กดคลิกได้ปกติเลย ไม่ต้องเข้าโหมดลาก
            if (onClick) return; // ปล่อยให้ event click ทำงานตามปกติ
        }
        
        // ถ้าเป็น Panel ต้องจับที่ Header
        if (type === 'panel') {
             if (!dragConfig.panelUnlocked) return;
             if (!e.target.classList.contains('ins-header') && !e.target.parentElement.classList.contains('ins-header')) return;
        }

        const clientX = e.clientX || e.touches[0].clientX;
        const clientY = e.clientY || e.touches[0].clientY;
        
        // เริ่มต้นลาก
        pos3 = clientX; pos4 = clientY;
        startX = clientX; startY = clientY;
        isDragging = false; // รีเซ็ตสถานะ

        document.onmouseup = dragEnd; document.onmousemove = dragAction;
        document.ontouchend = dragEnd; document.ontouchmove = dragAction;
    };

    const dragAction = (e) => {
        const clientX = e.clientX || e.touches[0].clientX;
        const clientY = e.clientY || e.touches[0].clientY;

        // คำนวณระยะที่ขยับ
        const moveX = Math.abs(clientX - startX);
        const moveY = Math.abs(clientY - startY);

        // ถ้าขยับเกิน 5px ถือว่า "ลาก" (ไม่ใช่คลิกแล้ว)
        if (moveX > 5 || moveY > 5) {
            isDragging = true;
        }

        // ถ้า Lock อยู่ ห้ามขยับตำแหน่ง
        if ((type === 'orb' && !dragConfig.orbUnlocked) || (type === 'panel' && !dragConfig.panelUnlocked)) return;

        pos1 = pos3 - clientX; pos2 = pos4 - clientY;
        pos3 = clientX; pos4 = clientY;
        elm.style.top = (elm.offsetTop - pos2) + "px";
        elm.style.left = (elm.offsetLeft - pos1) + "px";
        e.preventDefault();
    };

    const dragEnd = () => {
        document.onmouseup = null; document.onmousemove = null;
        document.ontouchend = null; document.ontouchmove = null;

        // บันทึกตำแหน่งลง LocalStorage
        if (isDragging) {
            savePosition(type, elm.style.top, elm.style.left);
        } else {
            // ถ้าขยับเมาส์น้อยกว่า 5px ถือเป็น "คลิก" -> เรียกฟังก์ชันเปิดเมนู
            if (onClick) onClick();
        }
    };

    elm.onmousedown = dragStart; elm.ontouchstart = dragStart;
};

// --- Helpers ---
window.updateCalib = (type, value) => {
    const val = parseFloat(value);
    if (val > 0) {
        if (type === 'thai') calibration.thaiDivisor = val;
        if (type === 'eng') calibration.engDivisor = val;
    }
};

window.toggleDrag = (type, isChecked) => {
    if (type === 'orb') dragConfig.orbUnlocked = isChecked;
    if (type === 'panel') {
        dragConfig.panelUnlocked = isChecked;
        const header = document.getElementById('panel-header');
        if(header) header.style.cursor = isChecked ? 'move' : 'default';
    }
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
    const rawTokens = estimateTokens(msg);
    const cleanText = stripHtmlToText(msg);
    const aiViewText = `[System Content:\n${cleanText}]`;
    const cleanTokens = estimateTokens(aiViewText);
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

