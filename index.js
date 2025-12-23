// index.js

const extensionName = "TimeWindow_VisualSaver";

// =================================================================
// ส่วนที่ 1: สร้างปุ่มจิ๋ว (Floating Icon)
// =================================================================
let stats = {
    enabled: true,
    lastSavedTokens: 0,
    lastSavedChars: 0,
    totalSavedTokens: 0,
    lastMessageTimestamp: "-"
};

const createFloatingUI = () => {
    // ลบอันเก่าออกก่อน (ถ้ามี)
    const existingIcon = document.getElementById('tw-saver-icon');
    if (existingIcon) existingIcon.remove();

    // 1. สร้างปุ่มไอคอน (รูปโล่)
    const iconDiv = document.createElement('div');
    iconDiv.id = 'tw-saver-icon';
    iconDiv.innerHTML = '🛡️'; 
    
    // แต่งสวยๆ + ดันตำแหน่งขึ้นสูงๆ
    Object.assign(iconDiv.style, {
        position: 'fixed',
        bottom: '300px',      // <--- แก้ตรงนี้: ดันขึ้นมาสูง 300px (ประมาณกลางจอครึ่งล่าง)
        left: '15px',         // ขยับออกจากขอบซ้ายนิดนึง
        width: '45px',
        height: '45px',
        backgroundColor: 'rgba(20, 20, 20, 0.9)', // สีดำเข้ม
        border: '2px solid white', // <--- เพิ่มขอบสีขาวให้เห็นชัดๆ
        color: '#fff',
        borderRadius: '50%',
        textAlign: 'center',
        lineHeight: '41px',   // จัดกึ่งกลางแนวตั้ง
        fontSize: '24px',
        cursor: 'pointer',
        zIndex: '2147483647', // <--- ค่าสูงสุดที่เป็นไปได้ (อยู่บนทุกอย่างแน่นอน)
        boxShadow: '0 4px 8px rgba(0,0,0,0.8)',
        transition: 'transform 0.2s ease',
        userSelect: 'none',
        display: 'block'      // บังคับแสดงผล
    });

    // 2. สร้างหน้าต่าง Info (ซ่อนอยู่)
    const infoPanel = document.createElement('div');
    infoPanel.id = 'tw-saver-info';
    Object.assign(infoPanel.style, {
        position: 'fixed',
        bottom: '360px',      // <--- ดันหน้าต่าง Info ขึ้นตามปุ่ม
        left: '15px',
        padding: '15px',
        backgroundColor: '#263238',
        color: '#eceff1',
        borderRadius: '8px',
        border: '1px solid #546E7A',
        boxShadow: '0 10px 20px rgba(0,0,0,0.5)',
        zIndex: '2147483647',
        display: 'none',
        fontSize: '14px',
        width: '220px',
        fontFamily: 'sans-serif'
    });

    // ใส่ฟังก์ชันกดปุ่ม
    iconDiv.onclick = () => {
        if (infoPanel.style.display === 'none') {
            updateInfoContent(infoPanel);
            infoPanel.style.display = 'block';
        } else {
            infoPanel.style.display = 'none';
        }
    };
    
    // เอฟเฟกต์กดแล้วเด้งดึ๋ง
    iconDiv.onmousedown = () => iconDiv.style.transform = 'scale(0.9)';
    iconDiv.onmouseup = () => iconDiv.style.transform = 'scale(1)';

    // ยัดใส่หน้าเว็บ
    document.body.appendChild(iconDiv);
    document.body.appendChild(infoPanel);
    console.log('[Visual Saver] Icon created at bottom: 300px');
};

const updateInfoContent = (panel) => {
    panel.innerHTML = `
        <div style="border-bottom: 1px solid #78909C; padding-bottom: 5px; margin-bottom: 8px; font-weight: bold; color: #80CBC4;">
            🛡️ Token Saver Stats
        </div>
        <div style="font-size: 13px; line-height: 1.5;">
            <b>⏳ เมื่อ:</b> ${stats.lastMessageTimestamp}<br>
            <b>✂️ ตัดออก:</b> ${stats.lastSavedChars} ตัวอักษร<br>
            <b>💰 ประหยัด:</b> <span style="color: #69F0AE; font-size: 1.1em; font-weight: bold;">~${stats.lastSavedTokens}</span> Tokens
            <hr style="border: 0; border-top: 1px dashed #546E7A; margin: 8px 0;">
            <b>📦 ยอดรวม:</b> ${stats.totalSavedTokens} Tokens
        </div>
        <div style="margin-top: 5px; font-size: 10px; color: #B0BEC5; text-align: right;">
            กดที่โล่เพื่อปิด
        </div>
    `;
};

// =================================================================
// ส่วนที่ 2: Logic การตัดคำ
// =================================================================
const estimateTokens = (chars) => Math.round(chars / 3.5);

const optimizePrompt = (data) => {
    if (!stats.enabled) return data;

    const regex = /<details>[\s\S]*?<summary>(.*?)<\/summary>[\s\S]*?TIME:<\/b>\s*(.*?)<br>[\s\S]*?WEATHER:<\/b>\s*(.*?)<br>[\s\S]*?LOCATION:<\/b>\s*(.*?)<br>[\s\S]*?NOW PLAYING:<\/b>\s*(.*?)[\s\S]*?<\/details>/gi;

    let totalSavingsInThisMessage = 0;

    const replacer = (match, datePart, time, weather, loc, music) => {
        const cleanDate = datePart.replace(/<[^>]*>?/gm, '').trim().replace('📅', '').trim();
        const shortText = `[Time Window: ${cleanDate} | Time: ${time.trim()} | Weather: ${weather.trim()} | Loc: ${loc.trim()} | Music: ${music.trim()}]`;
        
        const saving = match.length - shortText.length;
        if (saving > 0) totalSavingsInThisMessage += saving;
        return shortText;
    };

    let modified = false;

    // Chat Completion
    if (data.body && data.body.messages) {
        data.body.messages.forEach(msg => {
            if (msg.content && msg.content.includes('<details>')) {
                msg.content = msg.content.replace(regex, replacer);
                modified = true;
            }
        });
    } 
    // Text Completion
    else if (data.body && data.body.prompt && typeof data.body.prompt === 'string') {
        if (data.body.prompt.includes('<details>')) {
            data.body.prompt = data.body.prompt.replace(regex, replacer);
            modified = true;
        }
    }

    if (modified && totalSavingsInThisMessage > 0) {
        const savedTokens = estimateTokens(totalSavingsInThisMessage);
        
        stats.lastSavedChars = totalSavingsInThisMessage;
        stats.lastSavedTokens = savedTokens;
        stats.totalSavedTokens += savedTokens;
        
        const now = new Date();
        stats.lastMessageTimestamp = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;

        // ทำให้ปุ่มกระพริบสีเขียว
        const icon = document.getElementById('tw-saver-icon');
        if (icon) {
            icon.style.backgroundColor = '#00E676'; // เขียวสด
            icon.style.borderColor = '#00E676';
            setTimeout(() => {
                icon.style.backgroundColor = 'rgba(20, 20, 20, 0.9)'; // กลับเป็นสีเดิม
                icon.style.borderColor = 'white';
            }, 800);
        }
    } else {
        stats.lastSavedChars = 0;
        stats.lastSavedTokens = 0;
        stats.lastMessageTimestamp = "ล่าสุดไม่มีข้อมูล";
    }

    return data;
};

// =================================================================
// ส่วนที่ 3: เริ่มทำงาน (เพิ่มความชัวร์ในการโหลด)
// =================================================================

// ลองสร้างปุ่มหลายรอบหน่อย เผื่อหน้าเว็บโหลดช้า
setTimeout(createFloatingUI, 1000); // 1 วินาที
setTimeout(createFloatingUI, 3000); // 3 วินาที (กันเหนียว)
setTimeout(createFloatingUI, 5000); // 5 วินาที (กันเหนียวสุดๆ)

if (typeof SillyTavern !== 'undefined') {
    SillyTavern.extension_manager.register_hook('chat_completion_request', optimizePrompt);
    SillyTavern.extension_manager.register_hook('text_completion_request', optimizePrompt);
    console.log('[Visual Saver] Loaded with HIGH Position.');
}

