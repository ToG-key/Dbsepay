const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const DB_FILE = path.join(__dirname, 'keys_database.json');

// Khởi tạo file database nếu chưa có
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({}), 'utf-8');
}

const loadDB = () => JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
const saveDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 4), 'utf-8');

// ==========================================
// API 1: TẠO KEY MỚI (Dành cho Admin)
// ==========================================
app.post('/api/keys/create', (req, res) => {
    const days = parseInt(req.body.days) || 30;
    const newKey = crypto.randomBytes(8).toString('hex').toUpperCase();
    const expireTime = Date.now() + (days * 24 * 60 * 60 * 1000);

    const db = loadDB();
    db[newKey] = {
        status: "pending",
        isExpired: false,
        expireTime: expireTime,
        createdAt: Date.now()
    };
    saveDB(db);

    res.json({ success: true, key: newKey, days: days });
});

// ==========================================
// API 2: KIỂM TRA KEY (c.py gọi API này)
// ==========================================
app.post('/api/keys/check-status', (req, res) => {
    const key = req.body.key;
    if (!key) return res.status(400).json({ success: false, error: "Thiếu key" });

    const db = loadDB();
    
    // Nếu không tìm thấy key
    if (!db[key]) {
        return res.status(404).json({ success: false, error: "Key không tồn tại" });
    }

    const keyData = db[key];

    // Kiểm tra xem key đã quá hạn chưa
    if (Date.now() > keyData.expireTime) {
        keyData.isExpired = true;
        db[key] = keyData;
        saveDB(db);
    }

    // Trả về kết quả cho c.py
    res.json({
        success: true,
        status: keyData.status,
        isExpired: keyData.isExpired
    });
});

// ==========================================
// API 3: XÓA KEY NGẦM (c.py gọi API này nếu key hợp lệ)
// ==========================================
app.post('/api/keys/manual-delete', (req, res) => {
    const key = req.body.key;
    if (!key) return res.status(400).json({ success: false, error: "Thiếu key" });

    const db = loadDB();
    if (db[key]) {
        delete db[key]; // Xóa key khỏi database
        saveDB(db);
        return res.json({ success: true });
    }
    res.status(404).json({ success: false, error: "Key không tồn tại" });
});

// ==========================================
// API 4: XEM DANH SÁCH KEY (Dành cho Admin)
// ==========================================
app.get('/api/keys/list', (req, res) => {
    const db = loadDB();
    const list = Object.keys(db).map(k => ({
        key: k,
        status: db[k].status,
        isExpired: Date.now() > db[k].expireTime,
        expireTime: new Date(db[k].expireTime).toLocaleString('vi-VN')
    }));
    res.json({ success: true, total: list.length, keys: list });
});

// Khởi chạy
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`[SERVER] Backend đang chạy tại http://localhost:${PORT}`);
});
