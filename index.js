// index.js - Chronos V13 (Active Hunter) 🔴🟣🟢

const extensionName = "Chronos_V13_Active";

let stats = {
    enabled: true,
    totalSaved: 0,
    lastSaved: 0,
    isPending: false // สถานะว่าเจอโค้ดรอตัดไหม
};

// =================================================================
// 1. Logic: Stripper
// =================================================================
const stripHtmlToText = (html) => {
    let text = html.replace(/<br\s*\/?>/gi, '\n')
                   .replace(/<\/p>/gi, '\n\n')
                   .replace(/<\/div>/gi, '\n')
                   .replace(/<\/h[1-6]>/gi, '\n');
    text = text.replace(/<[^>]+>/g, '');
    text = text.replace(/\n\s*\n/g, '\n\n').trim();
    return text;
};

const estimateTokens = (chars) => Math.round(chars / 3.5);

// =================================================================
// 2. UI: Psycho Neon Orb (Size 30px)
// =================================================================
const injectStyles = () => {
    const style = document.createElement('style');
    style.innerHTML = `
        #chronos-orb {
            position: fixed; top: 120px; right: 20px;
            width: 30px; height: 30px;
            
            /* สีเริ่มต้น (ม่วง = ปกติ) */
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

        /* สถานะ: เจอโค้ด (สีแดง - เตรียมตัด) */
        #chronos-orb.alert {
            border-color: #FF1744;
            color: #FF1744;
            box-shadow: 0 0 15px #FF1744;
            animation: pulse-red 1s infinite;
        }

        /* สถานะ: ตัดสำเร็จ (สีเขียว) */
        #chronos-orb.success {
            border-color: #00E676;
            color: #00E676;
            box-shadow: 0 0 20px #00E676;
            transform: scale(1.2);
        }

        @keyframes pulse-red { 
            0% { transform: scale(1); } 
            50% { transform: scale(1.1); box-shadow: 0 0 25px #FF1744; } 
            100% { transform: scale(1); } 
        }

        /* Panel & Popup */
        #chronos-panel {
            position: fixed; top: 120px; right: 60px;
            width: 260px; padding: 12px;
            background: #120018; border: 1px solid #D500F9;
            color: #E1BEE7; font-family: monospace; font-size: 11px;
            display: none; z-index: 999999;
            box-shadow: 0 5px 20px rgba(0,0,0,0.8);
            border-radius: 6px;
        }
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
        @keyframes floatUp { 0% { transform: translateY(0); opacity: 1; } 80% { opacity: 1; } 100% { transform: translateY(-60px); opacity: 0; } }
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
    let statusText = stats.isPending ? "<span style='color:#FF1744'>🔴 เจอ HTML! (รอตัด)</span>" : "<span style='color:#00E676'>🟢 คลีน</span>";
    
    panel.innerHTML = `
        <strong style="color:#E040FB;">CHRONOS V13</strong><br>
        สถานะ: ${statusText}<br>
        <div style="margin-top:5px; border-bottom:1px solid #5c007a; padding-bottom:5px;">
            ล่าสุด: <b style="color:#fff;">+${stats.lastSaved}</b> Tok<br>
            รวมทั้งหมด: <b style="color:#00E676;">${stats.totalSaved}</b> Tok
        </div>
        <div style="font-size:9px; color:#aaa; margin-top:5px;">
            *ถ้าลูกแก้วสีแดง แปลว่าเจอโค้ด<br>พอกดส่ง มันจะตัดแล้วกลายเป็นสีเขียว*
        </div>
    `;
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
// 3. Logic: Active Scanner (สแกนตลอดเวลา)
// =================================================================
const scanLastMessage = () => {
    if (typeof SillyTavern === 'undefined') return;
    const context = SillyTavern.getContext();
    if (!context || !context.chat || context.chat.length === 0) return;

    // หาข้อความบอทล่าสุด
    let lastMsg = "";
    for (let i = context.chat.length - 1; i >= 0; i--) {
        if (!context.chat[i].is_user) { lastMsg = context.chat[i].mes; break; }
    }

    const orb = document.getElementById('chronos-orb');
    if (!orb) return;

    // เช็คว่ามี HTML Tag ไหม
    if (lastMsg && /<[^>]+>/.test(lastMsg)) {
        // เจอ! เปลี่ยนเป็นสีแดง
        if (!orb.classList.contains('success')) { // อย่าเพิ่งเปลี่ยนถ้ากำลังโชว์สีเขียวอยู่
            orb.classList.add('alert');
            orb.style.borderColor = "#FF1744";
            stats.isPending = true;
        }
    } else {
        // ไม่เจอ (หรือตัดไปแล้ว)
        orb.classList.remove('alert');
        if (!orb.classList.contains('success')) orb.style.borderColor = "#D500F9";
        stats.isPending = false;
    }
};

// ตั้งเวลาให้สแกนทุกๆ 2 วินาที
setInterval(scanLastMessage, 2000);

// =================================================================
// 4. Logic: Execution (ตอนส่ง)
// =================================================================
const optimizePayload = (data) => {
    if (!stats.enabled) return data;

    let charsSaved = 0;

    if (data.body && data.body.messages) {
        data.body.messages.forEach(msg => {
            if (msg.content && /<[^>]+>/.test(msg.content)) {
                
                const oldLen = msg.content.length;
                const cleanText = stripHtmlToText(msg.content);
                msg.content = `[Display Content:\n${cleanText}]`;

                const newLen = msg.content.length;
                charsSaved += (oldLen - newLen);
            }
        });
    }

    if (charsSaved > 0) {
        const tokens = estimateTokens(charsSaved);
        stats.lastSaved = tokens;
        stats.totalSaved += tokens;
        
        // Effect สำเร็จ (เปลี่ยนสีเขียว + เด้งเลข)
        const orb = document.getElementById('chronos-orb');
        if (orb) {
            orb.classList.remove('alert'); // หยุดแดง
            orb.classList.add('success');  // เป็นเขียว
            
            const rect = orb.getBoundingClientRect();
            showFloatingNumber(tokens, stats.totalSaved, rect.left - 100, rect.top - 20);
            
            // ค้างสีเขียวไว้ 2 วิ แล้วกลับมาเป็นปกติ
            setTimeout(() => {
                orb.classList.remove('success');
            }, 2000);
        }
        console.log(`[Chronos] Saved +${tokens} | Total: ${stats.totalSaved}`);
    }

    return data;
};

// =================================================================
// 5. Start
// =================================================================
injectStyles();
setTimeout(createUI, 1500);

if (typeof SillyTavern !== 'undefined') {
    SillyTavern.extension_manager.register_hook('chat_completion_request', optimizePayload);
    SillyTavern.extension_manager.register_hook('text_completion_request', optimizePayload);
    console.log('[Chronos V13] Active Hunter Loaded.');
}

