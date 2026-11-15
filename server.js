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

// Hàm đọc/ghi database
const loadDB = () => JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
const saveDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 4), 'utf-8');

// ==========================================
// API 1: TẠO KEY MỚI (Dành cho Admin)
// ==========================================
app.post('/api/keys/create', (req, res) => {
    const days = parseInt(req.body.days) || 30;
    const newKey = crypto.randomBytes(8).toString('hex').toUpperCase();
    
    // Tính thời gian hết hạn (mili-giây)
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
// API 2: KIỂM TRA KEY (Dành cho Web/Tool)
// ==========================================
app.post('/api/keys/check-status', (req, res) => {
    const key = req.body.key;
    if (!key) return res.status(400).json({ success: false, error: "Thiếu key" });

    const db = loadDB();
    if (!db[key]) {
        return res.status(404).json({ success: false, error: "Key không tồn tại" });
    }

    const keyData = db[key];

    // Kiểm tra hết hạn
    if (Date.now() > keyData.expireTime) {
        keyData.isExpired = true;
        db[key] = keyData;
        saveDB(db);
    }

    res.json({
        success: true,
        status: keyData.status,
        isExpired: keyData.isExpired
    });
});

// ==========================================
// API 3: XÓA KEY (Sau khi xác thực thành công)
// ==========================================
app.post('/api/keys/manual-delete', (req, res) => {
    const key = req.body.key;
    if (!key) return res.status(400).json({ success: false, error: "Thiếu key" });

    const db = loadDB();
    if (db[key]) {
        delete db[key];
        saveDB(db);
        return res.json({ success: true });
    }
    res.status(404).json({ success: false, error: "Key không tồn tại" });
});

// Khởi chạy server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`[SERVER] Backend JS đang chạy tại http://localhost:${PORT}`);
});
