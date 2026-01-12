
// side_chat.js - Friend Chat System 🌌
// แยกจาก Chronos ทำงานเป็นเอกเทศ

// 1. ตั้งค่า System Prompt (เอาข้อความ Listfriend ยาวๆ ของคุณมาใส่ตรงนี้)
// เพื่อความสวยงามของโค้ด ผมย่อไว้นะครับ ตอนใช้จริงก๊อปที่คุณโพสต์มาแปะทับคำว่า `ใส่ Prompt ยาวๆ...`
const FRIEND_PROMPT = `
Usage: Always active
Use HTML code following the specified format.
All five personalities act as close friends...
( ... ใส่เนื้อหา Prompt ทั้งหมดของคุณตรงนี้ ... )
Progress Enforcement: ...
`;

// 2. ตัวแปรเก็บประวัติแชทเพื่อน (ไม่เกี่ยวกับแชทหลัก)
let friendHistory = [];

// 3. ฟังก์ชันสร้างหน้าต่าง (UI)
const buildSideChatUI = () => {
    // เช็คว่ามีหน้าต่างหรือยัง ถ้ามีแล้วไม่สร้างซ้ำ
    if (document.getElementById('friend-chat-panel')) return;

    // สร้าง HTML
    const panel = document.createElement('div');
    panel.id = 'friend-chat-panel';
    panel.innerHTML = `
        <div class="friend-header" id="friend-drag-handle">
            <span>💬 Friends Chat</span>
            <span style="cursor:pointer;" onclick="$('#friend-chat-panel').hide()">✖</span>
        </div>
        <div class="friend-body" id="friend-log">
            <div style="color:#666; font-size:12px; text-align:center; margin-top:20px;">
                Start chatting or ask for comments...
            </div>
        </div>
        <div class="friend-input-area">
            <textarea id="friend-input" placeholder="OOC Message..."></textarea>
            <button id="friend-send-btn">SEND</button>
        </div>
    `;

    document.body.appendChild(panel);
    
    // ทำให้ลากหน้าต่างได้ (ใช้ JQuery UI ที่มีใน SillyTavern อยู่แล้ว)
    $(panel).draggable({ handle: "#friend-drag-handle" });

    // ผูกปุ่มกดส่ง
    document.getElementById('friend-send-btn').onclick = handleFriendSend;
};

// 4. ฟังก์ชันส่งข้อความและคุยกับ AI
const handleFriendSend = async () => {
    const inputEl = document.getElementById('friend-input');
    const logEl = document.getElementById('friend-log');
    const userText = inputEl.value;

    inputEl.value = ''; // เคลียร์ช่องพิมพ์

    // 4.1 แสดงข้อความเรา
    if (userText) {
        friendHistory.push({ role: 'user', content: `[message] ${userText}` });
        logEl.innerHTML += `<div class="msg-row user-row"><b>Op:</b> ${userText}</div>`;
    }

    // 4.2 ดึงเนื้อเรื่องล่าสุดจากแชทหลัก (Chronos ไม่ยุ่ง อันนี้ดึงเอง)
    const context = SillyTavern.getContext();
    const lastMsg = context.chat && context.chat.length > 0 ? context.chat[context.chat.length - 1] : null;
    let storyContext = "";
    
    if (lastMsg) {
        // ตัด HTML ออกเหมือนที่คุณทำใน Chronos เพื่อประหยัด Token
        let cleanMsg = lastMsg.mes.replace(/<[^>]+>/g, ''); 
        storyContext = `\n\n[Current Story State for Reference:\n${lastMsg.name}: ${cleanMsg}]`;
    }

    // 4.3 เตรียม Prompt ส่ง AI
    // ส่ง: System Prompt + ประวัติคุยกับเพื่อน + (ข้อความเรา + เนื้อเรื่องล่าสุด)
    const sendPayload = [
        { role: 'system', content: FRIEND_PROMPT },
        ...friendHistory,
        { role: 'user', content: (userText ? userText : "Analyze the current situation.") + storyContext }
    ];

    // ใส่ Loading...
    logEl.innerHTML += `<div class="msg-row system-row" id="friend-loading">Friends are typing...</div>`;
    logEl.scrollTop = logEl.scrollHeight;

    try {
        // ใช้ฟังก์ชัน Gen ของ SillyTavern (แบบเงียบ ไม่ลงแชทหลัก)
        // หมายเหตุ: ชื่อฟังก์ชันอาจต่างกันไปตาม version ST แต่ส่วนใหญ่ใช้ generateQuiet หรือ request ทำนองนี้
        // เพื่อความชัวร์ ใช้ท่าไม้ตาย: จำลองการส่ง request เอง หรือใช้ API
        
        // *วิธีที่ง่ายที่สุดสำหรับ Extension มือใหม่ คือใช้ SillyTavern.Generate แต่บอกว่าไม่ต้องใส่แชท*
        // แต่เนื่องจาก API มันซับซ้อน ผมแนะนำให้ใช้ท่านี้ (Pseudo-code สำหรับ ST):
        
        const response = await SillyTavern.generateQuiet(sendPayload); 
        // ถ้า generateQuiet ไม่มีในเวอร์ชั่นที่คุณใช้ ให้ลองค้นหา 'generateText' ใน console ดูครับ
        
        // สมมติว่าได้ text กลับมา
        const replyText = response; 

        // ลบ Loading
        const loadDiv = document.getElementById('friend-loading');
        if(loadDiv) loadDiv.remove();

        // แสดงผล
        friendHistory.push({ role: 'assistant', content: replyText });
        logEl.innerHTML += `<div class="msg-row bot-row">${replyText}</div>`;
        
        // เลื่อนลงล่างสุด
        logEl.scrollTop = logEl.scrollHeight;

    } catch (e) {
        console.error(e);
        const loadDiv = document.getElementById('friend-loading');
        if(loadDiv) loadDiv.innerText = "Error connecting to AI";
    }
};

// 5. CSS (สไตล์แยก ไม่ตีกับ Chronos)
const injectSideChatStyles = () => {
    const style = document.createElement('style');
    style.innerHTML = `
        #friend-chat-panel {
            position: fixed; left: 20px; top: 150px; /* อยู่คนละฝั่งกับ Chronos */
            width: 350px; height: 500px;
            background: #1e1e1e; border: 1px solid #c5a059;
            display: none; flex-direction: column;
            z-index: 99999; box-shadow: 0 0 10px rgba(0,0,0,0.5);
            font-family: 'Segoe UI', sans-serif;
        }
        .friend-header {
            padding: 10px; background: #c5a059; color: black; font-weight: bold;
            display: flex; justify-content: space-between;
        }
        .friend-body {
            flex: 1; overflow-y: auto; padding: 10px; background: #252525; color: #ddd;
        }
        .friend-input-area {
            padding: 10px; background: #333; display: flex; gap: 5px;
        }
        #friend-input {
            flex: 1; height: 40px; background: #111; color: white; border: 1px solid #555;
        }
        #friend-send-btn {
            background: #c5a059; border: none; font-weight: bold; cursor: pointer; padding: 0 15px;
        }
        .msg-row { margin-bottom: 10px; padding: 5px; border-radius: 4px; }
        .user-row { background: #333; text-align: right; }
        .bot-row { background: transparent; }
    `;
    document.head.appendChild(style);
};

// 6. เริ่มทำงาน (Start)
$(document).ready(() => {
    injectSideChatStyles();
    buildSideChatUI();

    // เพิ่มปุ่มเปิดหน้าต่างเพื่อน ตรงแถบเมนูข้างบน (ข้างๆ ปุ่มอื่น)
    const topBar = document.getElementById('top-bar') || document.body; // กันเหนียว
    
    const toggleBtn = document.createElement('div');
    toggleBtn.className = 'drawer-trigger'; // ใช้ class เดียวกับปุ่มอื่นๆ ของ ST
    toggleBtn.innerHTML = '👥';
    toggleBtn.title = 'Open Friend Chat';
    toggleBtn.style.cursor = 'pointer';
    toggleBtn.style.padding = '0 10px';
    toggleBtn.onclick = () => {
        const p = document.getElementById('friend-chat-panel');
        p.style.display = p.style.display === 'none' ? 'flex' : 'none';
    };
    
    // แทรกปุ่มไปก่อนปุ่มแรก
    if(document.getElementById('top-bar')){
         $('#top-bar').append(toggleBtn);
    }
});
