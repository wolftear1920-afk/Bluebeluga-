// index.js - Chronos V39 (Context Master) 🌌📏
// FULL SAFE BUILD — COPY ONLY / NO EDIT

const extensionName = "Chronos_V39_ContextMaster";

// =================================================================
// 1. UTILITIES
// =================================================================
const getSysTokenCount = (text) => {
    if (!text) return 0;
    try {
        if (typeof SillyTavern !== 'undefined'
            && SillyTavern.Tokenizers
            && typeof SillyTavern.Tokenizers.encode === 'function') {
            return SillyTavern.Tokenizers.encode(text).length;
        }
        if (typeof GPTTokenizer_Encoding_Encode === 'function') {
            return GPTTokenizer_Encoding_Encode(text).length;
        }
        return Math.round(text.length / 2.7);
    } catch {
        return Math.round(text.length / 3);
    }
};

const stripHtmlToText = (html) => {
    if (!html) return "";
    let text = html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/h[1-6]>/gi, '\n');

    text = text.replace(/<[^>]+>/g, '');
    text = text.replace(/&lt;([^&]+)&gt;/g, '$1');
    text = text.replace(/\n\s*\n/g, '\n\n').trim();
    return text;
};

// =================================================================
// 2. CORE LOGIC
// =================================================================
const calculateStats = () => {
    if (typeof SillyTavern === 'undefined') {
        return { memoryRange: "N/A", original: 0, optimized: 0, remaining: 0, saved: 0, max: 0 };
    }

    const context = SillyTavern.getContext();
    const chat = context.chat || [];

    let candidates = [];

    ['max_context', 'max_tokens', 'cfg_ctx_size'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !isNaN(parseInt(el.value))) candidates.push(parseInt(el.value));
    });

    if (SillyTavern.main_api?.max_context) candidates.push(SillyTavern.main_api.max_context);
    if (context.max_context) candidates.push(context.max_context);
    if (context.max_tokens) candidates.push(context.max_tokens);

    const valid = candidates.filter(v => typeof v === 'number' && v > 0);
    const maxTokens = valid.length ? Math.max(...valid) : 8192;

    let originalTotalLoad = context.tokens || 0;
    if (!originalTotalLoad && document.getElementById('token_count_bar')) {
        const m = document.getElementById('token_count_bar').innerText.match(/(\d+)/);
        if (m) originalTotalLoad = parseInt(m[1]);
    }

    let sumOriginal = 0;
    let sumOptimized = 0;
    let savedTotal = 0;
    let chatDetails = [];
    const MSG_OVERHEAD = 3;

    chat.forEach((msg, i) => {
        const raw = getSysTokenCount(msg.mes || "") + MSG_OVERHEAD;
        sumOriginal += raw;

        let clean = msg.mes || "";
        if (/<[^>]+>|&lt;[^&]+&gt;/.test(clean)) {
            clean = `[System Content:\n${stripHtmlToText(clean)}]`;
        }

        const opt = getSysTokenCount(clean) + MSG_OVERHEAD;
        sumOptimized += opt;
        savedTotal += Math.max(0, raw - opt);

        chatDetails.push({ index: i, optimizedSize: opt });
    });

    const staticOverhead = Math.max(0, originalTotalLoad - sumOriginal);
    const optimizedLoad = staticOverhead + sumOptimized;
    const remainingSpace = Math.max(0, maxTokens - optimizedLoad);

    const available = maxTokens - staticOverhead;
    let fill = 0;
    let startIdx = -1;
    let count = 0;

    for (let i = chatDetails.length - 1; i >= 0; i--) {
        if (fill + chatDetails[i].optimizedSize <= available) {
            fill += chatDetails[i].optimizedSize;
            startIdx = chatDetails[i].index;
            count++;
        } else break;
    }

    let memoryRange = "-";
    if (chat.length) {
        if (count >= chat.length) memoryRange = `All (#0 - #${chat.length - 1})`;
        else if (startIdx !== -1) memoryRange = `#${startIdx} ➔ #${chat.length - 1}`;
        else memoryRange = "None (Context Full)";
    }

    return {
        memoryRange,
        original: originalTotalLoad,
        optimized: optimizedLoad,
        remaining: remainingSpace,
        saved: savedTotal,
        max: maxTokens
    };
};

// =================================================================
// 3. UI SYSTEM
// =================================================================
const injectStyles = () => {
    const style = document.createElement('style');
    style.innerHTML = `
    #chronos-orb {
        position: fixed; top: 150px; right: 20px;
        width: 40px; height: 40px;
        background: radial-gradient(circle, rgba(20,0,30,0.9), #000);
        border: 2px solid #D500F9; border-radius: 50%;
        z-index: 999999; cursor: pointer;
        display:flex; align-items:center; justify-content:center;
        font-size:20px; color:#E040FB;
        box-shadow:0 0 15px rgba(213,0,249,.6);
        user-select:none;
    }
    #chronos-inspector {
        position: fixed; top: 80px; right: 70px;
        width: 320px; background: rgba(10,10,12,.95);
        border:1px solid #D500F9;
        color:#E1BEE7; font-family:Consolas,monospace;
        display:none; z-index:999999;
        border-radius:8px;
    }
    `;
    document.head.appendChild(style);
};

let dragConfig = { orbUnlocked: false, panelUnlocked: false };

const createUI = () => {
    document.getElementById('chronos-orb')?.remove();
    document.getElementById('chronos-inspector')?.remove();

    const orb = document.createElement('div');
    orb.id = 'chronos-orb';
    orb.innerHTML = '⚡';

    const panel = document.createElement('div');
    panel.id = 'chronos-inspector';

    document.body.appendChild(orb);
    document.body.appendChild(panel);

    orb.onclick = () => {
        panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
        if (panel.style.display === 'block') renderInspector();
    };
};

const renderInspector = () => {
    const panel = document.getElementById('chronos-inspector');
    if (!panel) return;

    const stats = calculateStats();
    panel.innerHTML = `
        <div style="padding:10px;font-weight:bold;color:#fff;">
            🚀 CHRONOS V39
        </div>
        <div style="padding:10px;font-size:12px;">
            <div>🧠 Memory: <b>${stats.memoryRange}</b></div>
            <div>🔋 Load: ${stats.optimized} / ${stats.max}</div>
            <div style="color:#00E676;">🛡️ Saved: -${stats.saved}</div>
        </div>
    `;
};

// =================================================================
// 4. PAYLOAD OPTIMIZER
// =================================================================
const optimizePayload = (data) => {
    const processText = (text) => {
        if (text && /<[^>]+>|&lt;[^&]+&gt;/.test(text)) {
            return `[System Content:\n${stripHtmlToText(text)}]`;
        }
        return text;
    };

    if (data.body?.messages && Array.isArray(data.body.messages)) {
        data.body.messages = data.body.messages.map(m => ({
            ...m,
            content: processText(m.content)
        }));
    } else if (data.body?.prompt) {
        data.body.prompt = processText(data.body.prompt);
    }

    setTimeout(() => {
        if (document.getElementById('chronos-inspector')?.style.display === 'block') {
            renderInspector();
        }
    }, 500);

    return data;
};

// =================================================================
// 5. INIT
// =================================================================
(function () {
    injectStyles();
    setTimeout(createUI, 2000);

    if (typeof SillyTavern !== 'undefined') {
        if (!window.__chronosV39HooksRegistered) {
            SillyTavern.extension_manager.register_hook('chat_completion_request', optimizePayload);
            SillyTavern.extension_manager.register_hook('text_completion_request', optimizePayload);
            window.__chronosV39HooksRegistered = true;
        }
        console.log(`[${extensionName}] READY`);
    }
})();
