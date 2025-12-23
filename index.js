// index.js - Chronos V6 (The Decoder & Spy) 🕵️

const extensionName = "Chronos_V6";

let stats = {
    enabled: true,
    totalSaved: 0,
    debugRaw: "" // เอาไว้เก็บค่าดิบๆ
};

// =================================================================
// 1. Super Regex: จับทุกรูปแบบ (ปกติ และ แบบถูกแปลงรหัส)
// =================================================================
// จับทั้ง <details> และ &lt;details&gt;
const superRegex = /(?:<|&lt;)details(?:>|&gt;)[\s\S]*?(?:<|&lt;)\/details(?:>|&gt;)/gi;

const estimateTokens = (chars) => Math.round(chars / 3.5);

// =================================================================
// 2. UI: ลูกแก้ว + หน้าต่าง Spy
// =================================================================
const injectStyles = () => {
    const style = document.createElement('style');
    style.innerHTML = `
        #chronos-orb {
            position: fixed; top: 120px; right: 20px;
            width: 60px; height: 60px;
            background: rgba(255, 0, 0, 0.2); /* สีแดงจางๆ (Standby) */
            border: 2px solid #FF5252; border-radius: 50%;
            z-index: 999999; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            font-size: 28px; color: #fff;
            transition: all 0.3s;
            backdrop-filter: blur(5px);
        }
        #chronos-orb.active { 
            background: rgba(0, 255, 0, 0.2); 
            border-color: #00E676; 
            box-shadow: 0 0 15px #00E676; 
        }

        #chronos-spy {
            position: fixed; top: 120px; right: 90px;
            width: 300px; padding: 10px;
            background: #1e1e1e; border: 1px solid #FF5252;
            color: #ccc; font-family: monospace; font-size: 11px;
            display: none; z-index: 999999;
            box-shadow: 0 10px 30px #000;
        }
        .raw-box {
            width: 100%; height: 100px; 
            background: #000; color: #00FF00; 
            border: 1px solid #333; overflow: auto;
            margin-top: 5px; padding: 5px; white-space: pre-wrap;
        }
        .btn-spy {
            width: 100%; padding: 8px; margin-top: 5px; cursor: pointer;
            background: #333; color: white; border: none;
        }
    `;
    document.head.appendChild(style);
};

const createUI = () => {
    const old = document.getElementById('chronos-orb');
    if (old) old.remove();

    const orb = document.createElement('div');
    orb.id = 'chronos-orb';
    orb.innerHTML = '🕵️'; // ไอคอนนักสืบ
    
    const panel = document.createElement('div');
    panel.id = 'chronos-spy';

    orb.onclick = () => {
        panel.style.display = (panel.style.display === 'none') ? 'block' : 'none';
        renderPanel(panel);
    };

    document.body.appendChild(orb);
    document.body.appendChild(panel);
};

const renderPanel = (panel) => {
    panel.innerHTML = `
        <strong style="color:#FF5252;">CHRONOS SPY TOOL</strong><br>
        Saved Tokens: <b style="color:#00E676;">${stats.totalSaved}</b><br>
        
        <button class="btn-spy" id="btn-spy-now">
            🔍 กดเพื่อดู "ไส้ใน" ข้อความล่าสุด
        </button>
        
        <div style="margin-top:5px;">Code ที่บอทส่งมาจริง (Raw):</div>
        <div class="raw-box" id="raw-display">...</div>
    `;

    setTimeout(() => {
        const btn = document.getElementById('btn-spy-now');
        if(btn) btn.onclick = runSpy;
    }, 100);
};

// =================================================================
// 3. Logic: SPY (กดดูไส้ใน) -> เอาไว้เช็คว่าทำไมไม่ทำงาน
// =================================================================
const runSpy = () => {
    if (typeof SillyTavern === 'undefined') return;
    const context = SillyTavern.getContext();
    const chat = context.chat || [];
    
    if (chat.length === 0) {
        document.getElementById('raw-display').innerText = "ไม่มีข้อความในแชท";
        return;
    }

    // หาข้อความล่าสุดของบอท
    let lastBotMsg = "หาข้อความบอทไม่เจอ";
    for (let i = chat.length - 1; i >= 0; i--) {
        if (!chat[i].is_user) {
            lastBotMsg = chat[i].mes; // นี่คือ RAW CODE จริงๆ
            break;
        }
    }

    // โชว์ในกล่อง
    const displayBox = document.getElementById('raw-display');
    displayBox.innerText = lastBotMsg.substring(0, 500); // ตัดมาแค่ 500 ตัวแรกพอ
    
    // ลองเทส Regex เดี๋ยวนี้เลย
    if (superRegex.test(lastBotMsg)) {
        displayBox.style.borderColor = "#00E676"; // สีเขียว = จับได้!
        alert("✅ Regex จับเจอ! (ระบบควรจะทำงานแล้ว)");
    } else {
        displayBox.style.borderColor = "#FF5252"; // สีแดง = จับไม่ได้
        alert("❌ Regex ยังจับไม่เจอ... ลองดูโค้ดในกล่องดำซิว่ามันเขียนว่าอะไร");
    }
};

// =================================================================
// 4. Logic: ตัดจริง (Execution)
// =================================================================
const optimizePayload = (data) => {
    if (!stats.enabled) return data;

    let charsSavedInThisRound = 0;
    
    if (data.body && data.body.messages) {
        data.body.messages.forEach(msg => {
            // ใช้ Super Regex จับ
            if (msg.content && superRegex.test(msg.content)) {
                
                const oldLen = msg.content.length;
                
                // แทนที่ด้วย Text สั้น
                msg.content = msg.content.replace(superRegex, '[Time Window Info]');
                
                const newLen = msg.content.length;
                charsSavedInThisRound += (oldLen - newLen);
            }
        });
    }

    if (charsSavedInThisRound > 0) {
        const tokens = estimateTokens(charsSavedInThisRound);
        stats.totalSaved += tokens;
        
        // เปลี่ยนลูกแก้วเป็นสีเขียว
        const orb = document.getElementById('chronos-orb');
        if (orb) {
            orb.classList.add('active');
            orb.innerHTML = '⚡';
            setTimeout(() => {
                orb.classList.remove('active');
                orb.innerHTML = '🕵️';
            }, 2000); // โชว์สีเขียว 2 วิ
        }
        console.log(`[Chronos] Saved ${tokens} tokens.`);
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
    console.log('[Chronos V6] Spy Mode Ready.');
}

