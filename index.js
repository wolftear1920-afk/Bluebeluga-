// index.js - Chronos V17 (The Truth Seeker) 🕵️‍♂️📜

const extensionName = "Chronos_V17_Truth";

let stats = {
    enabled: true,
    totalSaved: 0,
    lastSaved: 0
};

// =================================================================
// 1. Logic: Stripper
// =================================================================
const stripHtmlToText = (html) => {
    // เก็บความยาวเดิมไว้เทียบ
    const lenBefore = html.length;

    let text = html.replace(/<br\s*\/?>/gi, '\n')
                   .replace(/<\/p>/gi, '\n\n')
                   .replace(/<\/div>/gi, '\n')
                   .replace(/<\/h[1-6]>/gi, '\n');
    
    // ลบ Tags ทั้งหมด
    text = text.replace(/<[^>]+>/g, ''); 
    text = text.replace(/&lt;[^&]+&gt;/g, ''); 
    text = text.replace(/\n\s*\n/g, '\n\n').trim();
    
    return text;
};

const estimateTokens = (chars) => Math.round(chars / 3.5);

// =================================================================
// 2. UI: Psycho Neon (30px)
// =================================================================
const injectStyles = () => {
    const style = document.createElement('style');
    style.innerHTML = `
        #chronos-orb {
            position: fixed; top: 120px; right: 20px;
            width: 30px; height: 30px;
            background: rgba(10, 0, 10, 0.9);
            border: 2px solid #D500F9; border-radius: 50%;
            z-index: 999999; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            font-size: 16px; color: #E040FB;
            box-shadow: 0 0 10px rgba(213, 0, 249, 0.6);
            transition: all 0.3s; user-select: none;
            backdrop-filter: blur(4px);
        }
        #chronos-orb:hover { transform: scale(1.15); box-shadow: 0 0 20px #D500F9; border-color: #fff; }
        #chronos-orb.working { background: #D500F9; color: #000; animation: pulse-neon 0.5s infinite; }
        @keyframes pulse-neon { 0% { box-shadow: 0 0 5px #D500F9; } 50% { box-shadow: 0 0 20px #E040FB; } 100% { box-shadow: 0 0 5px #D500F9; } }

        #chronos-panel {
            position: fixed; top: 120px; right: 60px;
            width: 280px; padding: 12px;
            background: #0f0014; border: 1px solid #D500F9;
            color: #E1BEE7; font-family: monospace; font-size: 11px;
            display: none; z-index: 999999;
            box-shadow: 0 10px 30px rgba(0,0,0,0.9); border-radius: 8px;
        }
        .btn-spy {
            width: 100%; padding: 6px; background: #330044; color: #E040FB; 
            border: 1px solid #D500F9; margin-top: 10px; cursor: pointer;
        }
        .spy-box {
            background: #000; border: 1px solid #5c007a; color: #00E676;
            padding: 8px; margin-top: 5px; max-height: 200px; overflow-y: auto;
            white-space: pre-wrap; font-size: 10px;
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
        <strong style="color:#E040FB;">CHRONOS V17</strong><br>
        <div style="margin-top:5px; border-bottom:1px solid #5c007a; padding-bottom:5px;">
            ล่าสุด: <b style="color:#fff;">+${stats.lastSaved}</b> Tok<br>
            รวมทั้งหมด: <b style="color:#00E676;">${stats.totalSaved}</b> Tok
        </div>
        <button class="btn-spy" onclick="spyLastMessage()">👁️ Spy View</button>
        <div id="spy-area" class="spy-box">...</div>
    `;
};

window.spyLastMessage = () => {
    if (typeof SillyTavern === 'undefined') return;
    const context = SillyTavern.getContext();
    const chat = context.chat || [];
    let lastMsg = "";
    for (let i = chat.length - 1; i >= 0; i--) {
        if (!chat[i].is_user) { lastMsg = chat[i].mes; break; }
    }
    const spyArea = document.getElementById('spy-area');
    if (!lastMsg) { spyArea.innerText = "No bot message"; return; }
    
    if (/<[^>]+>|&lt;[^&]+&gt;/.test(lastMsg)) {
        const cleanText = stripHtmlToText(lastMsg);
        spyArea.innerText = `[System Content:\n${cleanText}]`;
        spyArea.style.color = "#00E676";
    } else {
        spyArea.innerText = "(Clean Text)";
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
// 3. Logic: Execution with LOGGING
// =================================================================
const processText = (text, index) => {
    const originalLen = text.length;
    
    // ลองเช็คซิว่ารับอะไรเข้ามา
    if (text.includes("<") && text.includes(">")) {
        console.log(`[Chronos] Msg #${index}: Found HTML! (Len: ${originalLen})`);
    } else {
        console.log(`[Chronos] Msg #${index}: No HTML found. (Already Clean?)`);
    }

    const htmlRegex = /<[^>]+>|&lt;[^&]+&gt;/;
    
    if (text && htmlRegex.test(text)) {
        const cleanText = stripHtmlToText(text);
        const newContent = `[System Content:\n${cleanText}]`;
        
        const saved = originalLen - newContent.length;
        console.log(`[Chronos] Msg #${index}: STRIPPED! Saved ${saved} chars`);
        
        return { content: newContent, saved: saved };
    }
    return null;
};

const optimizePayload = (data) => {
    if (!stats.enabled) return data;

    const orb = document.getElementById('chronos-orb');
    if (orb) orb.classList.add('working');

    console.log("[Chronos] --- SENDING REQUEST ---");

    let totalCharsSavedThisRound = 0;

    if (data.body && data.body.messages && Array.isArray(data.body.messages)) {
        data.body.messages.forEach((msg, idx) => {
            const result = processText(msg.content, idx);
            if (result && result.saved > 0) {
                msg.content = result.content;
                totalCharsSavedThisRound += result.saved;
            }
        });
    } else if (data.body && data.body.prompt && typeof data.body.prompt === 'string') {
        const result = processText(data.body.prompt, "prompt");
        if (result && result.saved > 0) {
            data.body.prompt = result.content;
            totalCharsSavedThisRound += result.saved;
        }
    }

    // สรุปยอด
    if (totalCharsSavedThisRound > 0) {
        const tokens = estimateTokens(totalCharsSavedThisRound);
        stats.lastSaved = tokens;
        stats.totalSaved += tokens;
        
        if (orb) {
            const rect = orb.getBoundingClientRect();
            showFloatingNumber(tokens, stats.totalSaved, rect.left - 100, rect.top - 20);
        }
        console.log(`[Chronos] TOTAL SAVED THIS ROUND: ${tokens} Tokens`);
    } else {
        console.log(`[Chronos] TOTAL SAVED: 0 (No modifications made)`);
    }

    setTimeout(() => {
        if (orb) orb.classList.remove('working');
        const panel = document.getElementById('chronos-panel');
        if(panel && panel.style.display === 'block') renderPanel(panel);
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
    console.log('[Chronos V17] Truth Seeker Loaded.');
}
    
