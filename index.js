// index.js - Chronos V15 (Gemini Spy Edition) 🟣👁️

const extensionName = "Chronos_V15_Spy";

let stats = {
    enabled: true,
    totalSaved: 0,
    lastSaved: 0
};

// =================================================================
// 1. Logic: Stripper (ตัวล้างโค้ดสำหรับ Gemini)
// =================================================================
const stripHtmlToText = (html) => {
    // 1. แปลง Tag บรรทัดใหม่ให้ Gemini อ่านง่าย
    let text = html.replace(/<br\s*\/?>/gi, '\n')
                   .replace(/<\/p>/gi, '\n\n')
                   .replace(/<\/div>/gi, '\n')
                   .replace(/<\/h[1-6]>/gi, '\n');
    
    // 2. ล้าง HTML Tags และ Encoded Tags ออกให้เกลี้ยง
    text = text.replace(/<[^>]+>/g, ''); 
    text = text.replace(/&lt;[^&]+&gt;/g, ''); 
    
    // 3. จัดระเบียบ
    text = text.replace(/\n\s*\n/g, '\n\n').trim();
    return text;
};

const estimateTokens = (chars) => Math.round(chars / 3.5);

// =================================================================
// 2. UI: Psycho Neon (30px) + Spy Panel
// =================================================================
const injectStyles = () => {
    const style = document.createElement('style');
    style.innerHTML = `
        #chronos-orb {
            position: fixed; top: 120px; right: 20px;
            width: 30px; height: 30px;
            background: rgba(10, 0, 10, 0.9);
            border: 2px solid #D500F9;
            border-radius: 50%;
            z-index: 999999; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            font-size: 16px; color: #E040FB;
            box-shadow: 0 0 10px rgba(213, 0, 249, 0.6);
            transition: all 0.3s;
            user-select: none;
            backdrop-filter: blur(4px);
        }
        #chronos-orb:hover { transform: scale(1.15); box-shadow: 0 0 20px #D500F9; border-color: #fff; }
        #chronos-orb.working { background: #D500F9; color: #000; animation: pulse-neon 0.5s infinite; }
        @keyframes pulse-neon { 0% { box-shadow: 0 0 5px #D500F9; } 50% { box-shadow: 0 0 20px #E040FB; } 100% { box-shadow: 0 0 5px #D500F9; } }

        /* Panel เมนู */
        #chronos-panel {
            position: fixed; top: 120px; right: 60px;
            width: 280px; padding: 12px;
            background: #0f0014; border: 1px solid #D500F9;
            color: #E1BEE7; font-family: monospace; font-size: 11px;
            display: none; z-index: 999999;
            box-shadow: 0 10px 30px rgba(0,0,0,0.9);
            border-radius: 8px;
        }
        
        /* กล่องแสดงผล Spy */
        .spy-box {
            background: #000; border: 1px solid #5c007a; 
            color: #00E676; /* สีเขียว Hacker */
            padding: 8px; margin-top: 5px; 
            max-height: 200px; overflow-y: auto;
            white-space: pre-wrap; font-size: 10px;
            font-family: 'Consolas', monospace;
        }

        /* ปุ่มกด */
        .btn-spy {
            width: 100%; padding: 6px; 
            background: #330044; color: #E040FB; 
            border: 1px solid #D500F9; margin-top: 10px; 
            cursor: pointer; font-weight: bold;
            transition: background 0.2s;
        }
        .btn-spy:hover { background: #550077; color: #fff; }

        /* Popup แจ้งเตือน 2 บรรทัด */
        .token-popup {
            position: fixed;
            background: rgba(18, 0, 24, 0.95);
            border: 1px solid #D500F9;
            padding: 8px 12px;
            border-radius: 8px;
            pointer-events: none; z-index: 1000000;
            box-shadow: 0 5px 15px rgba(0,0,0,0.5);
            animation: floatUp 3s ease-out forwards;
            display: flex; flex-direction: column; align-items: flex-start;
        }
        .popup-row-latest { color: #00E676; font-weight: bold; font-size: 14px; text-shadow: 0 1px 2px black; }
        .popup-row-total { color: #E1BEE7; font-size: 10px; margin-top: 2px; border-top: 1px solid rgba(213, 0, 249, 0.3); padding-top: 2px; width: 100%; }
        @keyframes floatUp { 0% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(-60px); opacity: 0; } }
    `;
    document.head.appendChild(style);
};

const createUI = () => {
    const old = document.getElementById('chronos-orb');
    if (old) old.remove();

    const orb = document.createElement('div');
    orb.id = 'chronos-orb';
    orb.innerHTML = '🌀'; 
    
    const panel = document.createElement('div');
    panel.id = 'chronos-panel';

    orb.onclick = () => {
        panel.style.display = (panel.style.display === 'none') ? 'block' : 'none';
        renderPanel(panel);
    };

    document.body.appendChild(orb);
    document.body.appendChild(panel);
};

const renderPanel = (panel) => {
    panel.innerHTML = `
        <strong style="color:#E040FB;">CHRONOS V15 (SPY)</strong><br>
        <div style="margin-top:5px; border-bottom:1px solid #5c007a; padding-bottom:5px;">
            ล่าสุด: <b style="color:#fff;">+${stats.lastSaved}</b> Tok<br>
            รวมทั้งหมด: <b style="color:#00E676;">${stats.totalSaved}</b> Tok
        </div>
        
        <button class="btn-spy" onclick="spyLastMessage()">
            👁️ ส่องสิ่งที่ AI เห็น (Spy)
        </button>
        
        <div style="margin-top:5px; color:#aaa;">ผลลัพธ์ (Clean Text):</div>
        <div id="spy-area" class="spy-box">กดปุ่มด้านบนเพื่อดู...</div>
    `;
};

// --- ฟังก์ชัน Spy: ดูข้อความล่าสุดแบบ Real-time ---
window.spyLastMessage = () => {
    if (typeof SillyTavern === 'undefined') return;
    const context = SillyTavern.getContext();
    const chat = context.chat || [];
    
    // หาข้อความบอทล่าสุด
    let lastMsg = "";
    for (let i = chat.length - 1; i >= 0; i--) {
        if (!chat[i].is_user) { lastMsg = chat[i].mes; break; }
    }

    const spyArea = document.getElementById('spy-area');

    if (!lastMsg) {
        spyArea.innerText = "ไม่พบข้อความบอทในประวัติ";
        spyArea.style.color = "red";
        return;
    }

    // เช็คว่ามี HTML ไหม
    if (/<[^>]+>|&lt;[^&]+&gt;/.test(lastMsg)) {
        const cleanText = stripHtmlToText(lastMsg);
        // แสดงผลลัพธ์
        spyArea.innerText = `[System Content:\n${cleanText}]`;
        spyArea.style.color = "#00E676"; // สีเขียว = ตัดแล้ว
    } else {
        spyArea.innerText = "(ข้อความนี้ไม่มี HTML ให้ตัด)";
        spyArea.style.color = "#aaa";
    }
};

const showFloatingNumber = (amount, total, x, y) => {
    const el = document.createElement('div');
    el.className = 'token-popup';
    el.innerHTML = `
        <div class="popup-row-latest">⚡ +${amount} Tokens</div>
        <div class="popup-row-total">📦 รวมสะสม: ${total}</div>
    `;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
};

// =================================================================
// 3. Logic: Execution (ทำงานตอนกดส่ง)
// =================================================================
const processText = (text) => {
    const htmlRegex = /<[^>]+>|&lt;[^&]+&gt;/;
    
    if (text && htmlRegex.test(text)) {
        const oldLen = text.length;
        const cleanText = stripHtmlToText(text);
        
        // นี่คือรูปแบบที่ส่งให้ Gemini 3.0 Flash
        const newContent = `[System Content:\n${cleanText}]`;
        
        return {
            content: newContent,
            saved: oldLen - newContent.length
        };
    }
    return null;
};

const optimizePayload = (data) => {
    if (!stats.enabled) return data;

    const orb = document.getElementById('chronos-orb');
    if (orb) orb.classList.add('working');

    let charsSaved = 0;

    // Chat Completion (Gemini 3.0 Flash ใช้อันนี้)
    if (data.body && data.body.messages && Array.isArray(data.body.messages)) {
        data.body.messages.forEach(msg => {
            const result = processText(msg.content);
            if (result && result.saved > 0) {
                msg.content = result.content;
                charsSaved += result.saved;
            }
        });
    }
    // เผื่อไว้สำหรับ Text Completion
    else if (data.body && data.body.prompt && typeof data.body.prompt === 'string') {
        const result = processText(data.body.prompt);
        if (result && result.saved > 0) {
            data.body.prompt = result.content;
            charsSaved += result.saved;
        }
    }

    if (charsSaved > 0) {
        const tokens = estimateTokens(charsSaved);
        stats.lastSaved = tokens;
        stats.totalSaved += tokens;
        
        if (orb) {
            const rect = orb.getBoundingClientRect();
            showFloatingNumber(tokens, stats.totalSaved, rect.left - 100, rect.top - 20);
        }
        console.log(`[Chronos] SUCCESS! Saved ${tokens} tokens.`);
    }

    setTimeout(() => {
        if (orb) orb.classList.remove('working');
        const panel = document.getElementById('chronos-panel');
        if(panel && panel.style.display === 'block') {
             // อัปเดตตัวเลขใน Panel ถ้าเปิดอยู่
             renderPanel(panel);
        }
    }, 500);

    return data;
};

// =================================================================
// 4. Start
// =================================================================
injectStyles();
setTimeout(createUI, 1500);

if (typeof SillyTavern !== 'undefined') {
    SillyTavern.extension_manager.register_hook('chat_completion_request', optimizePayload);
    SillyTavern.extension_manager.register_hook('text_completion_request', optimizePayload);
    console.log('[Chronos V15] Spy Mode Ready.');
}

