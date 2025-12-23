// index.js - Chronos V8 (Universal HTML Stripper) 🌪️

const extensionName = "Chronos_V8_Universal";

let stats = {
    enabled: true,
    totalSaved: 0,
    status: "Ready"
};

// =================================================================
// 1. Logic: The Universal Stripper (เครื่องโม่แป้ง HTML)
// =================================================================
// ฟังก์ชันนี้จะแปลง HTML หรูๆ ให้กลายเป็น Text ธรรมดา
const stripHtmlToText = (html) => {
    // 1. เปลี่ยน <br>, <p>, </div> ให้เป็น "ขึ้นบรรทัดใหม่" (เพื่อให้ AI อ่านรู้เรื่อง)
    let text = html.replace(/<br\s*\/?>/gi, '\n')
                   .replace(/<\/p>/gi, '\n\n')
                   .replace(/<\/div>/gi, '\n')
                   .replace(/<\/h[1-6]>/gi, '\n');

    // 2. ลบ Tag HTML ที่เหลือทิ้งทั้งหมด (<...>)
    text = text.replace(/<[^>]+>/g, '');

    // 3. จัดระเบียบช่องว่าง (ลบช่องว่างซ้ำซ้อน)
    text = text.replace(/\n\s*\n/g, '\n\n').trim();

    return text;
};

const estimateTokens = (chars) => Math.round(chars / 3.5);

// =================================================================
// 2. UI: ลูกแก้วสีม่วง (Universal Mode)
// =================================================================
const injectStyles = () => {
    const style = document.createElement('style');
    style.innerHTML = `
        #chronos-orb {
            position: fixed; top: 120px; right: 20px;
            width: 60px; height: 60px;
            background: rgba(0, 0, 0, 0.8);
            border: 2px solid #D500F9; /* สีม่วงนีออน */
            border-radius: 50%;
            z-index: 999999; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            font-size: 28px; color: #E040FB;
            box-shadow: 0 0 15px rgba(213, 0, 249, 0.5);
            transition: all 0.3s;
            user-select: none;
            backdrop-filter: blur(4px);
        }
        #chronos-orb:hover { transform: scale(1.1); box-shadow: 0 0 25px rgba(213, 0, 249, 0.8); }
        #chronos-orb.working { 
            background: #D500F9; color: #000; 
            animation: pulse-purple 1s infinite;
        }
        
        @keyframes pulse-purple { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }

        #chronos-panel {
            position: fixed; top: 120px; right: 90px;
            width: 280px; padding: 15px;
            background: #121212; border: 1px solid #D500F9;
            color: #eee; font-family: monospace; font-size: 11px;
            display: none; z-index: 999999;
            box-shadow: 0 10px 40px #000;
            max-height: 80vh; overflow-y: auto;
        }
        .preview-box {
            background: #222; border: 1px solid #444; color: #00E676;
            padding: 8px; margin-top: 5px; max-height: 150px; overflow: auto;
            white-space: pre-wrap; font-size: 10px;
        }
    `;
    document.head.appendChild(style);
};

const createUI = () => {
    const old = document.getElementById('chronos-orb');
    if (old) old.remove();

    const orb = document.createElement('div');
    orb.id = 'chronos-orb';
    orb.innerHTML = '🌀'; // พายุหมุน (ดูดทุกอย่าง)
    
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
        <strong style="color:#D500F9;">CHRONOS UNIVERSAL V8</strong><br>
        Saved Tokens: <b style="color:#00E676;">${stats.totalSaved}</b><br>
        -----------------------------<br>
        <button onclick="checkLatestConversion()" style="width:100%; padding:5px; background:#333; color:white; border:1px solid #D500F9; cursor:pointer;">
            🔍 เช็คข้อความล่าสุด (Preview)
        </button>
        <div style="margin-top:5px;">AI จะเห็นแบบนี้:</div>
        <div id="preview-area" class="preview-box">...</div>
    `;
};

// ฟังก์ชันสำหรับปุ่มเช็ค (ให้เห็นภาพก่อนส่งจริง)
window.checkLatestConversion = () => {
    if (typeof SillyTavern === 'undefined') return;
    const context = SillyTavern.getContext();
    const chat = context.chat || [];
    
    // หาข้อความบอทล่าสุด
    let lastMsg = "";
    for (let i = chat.length - 1; i >= 0; i--) {
        if (!chat[i].is_user) { lastMsg = chat[i].mes; break; }
    }

    if (!lastMsg) {
        document.getElementById('preview-area').innerText = "ไม่พบข้อความบอท";
        return;
    }

    // ทดลองแปลง
    if (lastMsg.includes('<') && lastMsg.includes('>')) {
        const cleanText = stripHtmlToText(lastMsg);
        document.getElementById('preview-area').innerText = cleanText;
    } else {
        document.getElementById('preview-area').innerText = "(ข้อความนี้ไม่มี HTML)";
    }
};

// =================================================================
// 3. Logic: ตัดจริงตอนส่ง (Execution)
// =================================================================
const optimizePayload = (data) => {
    if (!stats.enabled) return data;

    // เปลี่ยนสีลูกแก้ว
    const orb = document.getElementById('chronos-orb');
    if (orb) orb.classList.add('working');

    let charsSaved = 0;

    if (data.body && data.body.messages) {
        data.body.messages.forEach(msg => {
            // เช็คว่ามี HTML Tag ไหม (ถ้ามี <...> แสดงว่ามีโอกาสเป็นโค้ด)
            if (msg.content && /<[^>]+>/.test(msg.content)) {
                
                const oldLen = msg.content.length;
                
                // --- ขั้นตอนการล้างบาง ---
                // แปลง HTML ทั้งก้อน ให้เหลือแต่ Text
                const cleanText = stripHtmlToText(msg.content);
                
                // ใส่ Header นิดหน่อยให้ AI รู้ว่านี่คือข้อมูล System/Context
                // (ถ้ามันยาวๆ มักจะเป็น Status หรือ OOC)
                msg.content = `[System/Display Content:\n${cleanText}]`;

                const newLen = msg.content.length;
                charsSaved += (oldLen - newLen);
            }
        });
    }

    if (charsSaved > 0) {
        const tokens = estimateTokens(charsSaved);
        stats.totalSaved += tokens;
        console.log(`[Chronos V8] Stripped HTML. Saved ~${tokens} tokens.`);
    }

    setTimeout(() => {
        if (orb) orb.classList.remove('working');
        const panel = document.getElementById('chronos-panel');
        if(panel && panel.style.display === 'block') renderPanel(panel);
    }, 1000);

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
    console.log('[Chronos V8] Universal Loaded.');
}

