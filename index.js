// index.js

const extensionName = "TimeWindow_VisualSaver";

// =================================================================
// ส่วนที่ 1: สร้างปุ่มจิ๋ว (Floating Icon) และหน้าต่างแสดงผล
// =================================================================
let stats = {
    enabled: true,
    lastSavedTokens: 0,
    lastSavedChars: 0,
    totalSavedTokens: 0,
    lastMessageTimestamp: "ยังไม่มีการส่งข้อความ"
};

// ฟังก์ชันสร้าง UI (ปุ่มลอย)
const createFloatingUI = () => {
    // ลบอันเก่าออกก่อนกันซ้ำ
    const existingIcon = document.getElementById('tw-saver-icon');
    if (existingIcon) existingIcon.remove();

    // 1. สร้างปุ่มไอคอน (รูปโล่)
    const iconDiv = document.createElement('div');
    iconDiv.id = 'tw-saver-icon';
    iconDiv.innerHTML = '🛡️'; // หรือเปลี่ยนเป็น 🍃 ก็ได้
    
    // แต่งสวยๆ (CSS ในตัว)
    Object.assign(iconDiv.style, {
        position: 'fixed',
        bottom: '80px',       // อยู่ด้านล่าง (สูงกว่าช่องแชทนิดหน่อย)
        left: '10px',         // ชิดซ้าย
        width: '40px',
        height: '40px',
        backgroundColor: 'rgba(30, 30, 30, 0.7)',
        color: '#fff',
        borderRadius: '50%',
        textAlign: 'center',
        lineHeight: '40px',
        fontSize: '20px',
        cursor: 'pointer',
        zIndex: '9999',
        boxShadow: '0 2px 5px rgba(0,0,0,0.5)',
        transition: 'all 0.3s ease',
        userSelect: 'none'
    });

    // เอฟเฟกต์ตอนชี้/กด
    iconDiv.onmouseover = () => { iconDiv.style.backgroundColor = 'rgba(50, 50, 50, 0.9)'; };
    iconDiv.onmouseout = () => { iconDiv.style.backgroundColor = 'rgba(30, 30, 30, 0.7)'; };

    // 2. สร้างหน้าต่าง Info (ซ่อนอยู่)
    const infoPanel = document.createElement('div');
    infoPanel.id = 'tw-saver-info';
    Object.assign(infoPanel.style, {
        position: 'fixed',
        bottom: '130px',
        left: '10px',
        padding: '15px',
        backgroundColor: '#263238', // สีเทาอมน้ำเงินเข้ม
        color: '#eceff1',
        borderRadius: '8px',
        boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
        zIndex: '9999',
        display: 'none', // ซ่อนไว้ก่อน
        fontSize: '14px',
        maxWidth: '250px',
        fontFamily: 'sans-serif'
    });

    // 3. ใส่ฟังก์ชันกดปุ่ม -> โชว์/ซ่อน รายละเอียด
    iconDiv.onclick = () => {
        if (infoPanel.style.display === 'none') {
            updateInfoContent(infoPanel);
            infoPanel.style.display = 'block';
        } else {
            infoPanel.style.display = 'none';
        }
    };

    document.body.appendChild(iconDiv);
    document.body.appendChild(infoPanel);
};

// ฟังก์ชันอัปเดตข้อความในหน้าต่าง Info
const updateInfoContent = (panel) => {
    panel.innerHTML = `
        <div style="border-bottom: 1px solid #546E7A; padding-bottom: 5px; margin-bottom: 5px; font-weight: bold;">
            📊 Time Window Saver
        </div>
        <div style="font-size: 13px;">
            <b>ล่าสุด (${stats.lastMessageTimestamp}):</b><br>
            <span style="color: #69F0AE;">ประหยัด: ~${stats.lastSavedTokens} Tokens</span><br>
            <span style="color: #B0BEC5;">(ตัดออก ${stats.lastSavedChars} ตัวอักษร)</span>
            <br><hr style="border: 0; border-top: 1px dashed #546E7A; margin: 5px 0;">
            <b>ยอดรวมทั้งหมด:</b><br>
            ประหยัดไปแล้ว: <b>${stats.totalSavedTokens}</b> Tokens
        </div>
        <div style="margin-top: 8px; font-size: 10px; color: #90A4AE; text-align: right;">
            แตะที่ไอคอนเพื่อปิด
        </div>
    `;
};

// =================================================================
// ส่วนที่ 2: Logic การตัดคำ (เหมือนเดิม แต่เพิ่มการเก็บค่า)
// =================================================================
const estimateTokens = (chars) => Math.round(chars / 3.5);

const optimizePrompt = (data) => {
    if (!stats.enabled) return data;

    // Regex ตัวเดิม
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

    // เช็ค Chat Completion
    if (data.body && data.body.messages) {
        data.body.messages.forEach(msg => {
            if (msg.content && msg.content.includes('<details>')) {
                msg.content = msg.content.replace(regex, replacer);
                modified = true;
            }
        });
    } 
    // เช็ค Text Completion
    else if (data.body && data.body.prompt && typeof data.body.prompt === 'string') {
        if (data.body.prompt.includes('<details>')) {
            data.body.prompt = data.body.prompt.replace(regex, replacer);
            modified = true;
        }
    }

    // ถ้ามีการตัดคำเกิดขึ้น ให้บันทึกสถิติ
    if (modified && totalSavingsInThisMessage > 0) {
        const savedTokens = estimateTokens(totalSavingsInThisMessage);
        
        // อัปเดตตัวแปร Global
        stats.lastSavedChars = totalSavingsInThisMessage;
        stats.lastSavedTokens = savedTokens;
        stats.totalSavedTokens += savedTokens;
        
        // เก็บเวลาปัจจุบัน (ชั่วโมง:นาที)
        const now = new Date();
        stats.lastMessageTimestamp = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;

        // เอฟเฟกต์กระพริบที่ไอคอน เพื่อบอกว่า "ทำงานแล้วนะ"
        const icon = document.getElementById('tw-saver-icon');
        if (icon) {
            icon.style.backgroundColor = '#69F0AE'; // สีเขียวสว่าง
            setTimeout(() => {
                icon.style.backgroundColor = 'rgba(30, 30, 30, 0.7)'; // กลับเป็นสีเดิม
            }, 500);
        }
        
        console.log(`[Saver] Saved ${savedTokens} tokens in this message.`);
    } else {
        // ถ้าข้อความนี้ไม่มี Time Window ให้เคลียร์ค่าล่าสุดเป็น 0
        stats.lastSavedChars = 0;
        stats.lastSavedTokens = 0;
        stats.lastMessageTimestamp = "ข้อความล่าสุดไม่มี TimeWindow";
    }

    return data;
};

// =================================================================
// ส่วนที่ 3: เริ่มทำงาน
// =================================================================

// สร้างปุ่มทันทีที่โหลดเสร็จ
// หน่วงเวลาเล็กน้อยเพื่อให้หน้าจอโหลดครบก่อน
setTimeout(createFloatingUI, 2000);

if (typeof SillyTavern !== 'undefined') {
    SillyTavern.extension_manager.register_hook('chat_completion_request', optimizePrompt);
    SillyTavern.extension_manager.register_hook('text_completion_request', optimizePrompt);
    console.log('[Visual Saver] Loaded.');
        }
    
