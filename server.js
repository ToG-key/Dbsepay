const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const DB_FILE = path.join(__dirname, 'keys_database.json');

if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({}), 'utf-8');
}

const loadDB = () => JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
const saveDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 4), 'utf-8');

// ==========================================
// TRANG CHỦ (Sửa lỗi Cannot GET /)
// ==========================================
app.get('/', (req, res) => {
    res.json({
        status: "ok",
        message: "Hệ thống API Key đang hoạt động",
        endpoints: [
            "POST /api/keys/create",
            "GET|POST /api/keys/check-status",
            "POST /api/keys/manual-delete",
            "GET /api/keys/list"
        ]
    });
});

// ==========================================
// API 1: TẠO KEY MỚI (POST)
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
// API 2: KIỂM TRA KEY (HỖ TRỢ CẢ GET VÀ POST)
// ==========================================
app.all('/api/keys/check-status', (req, res) => {
    // Lấy key từ body (nếu là POST) hoặc từ query ?key=... (nếu là GET)
    const key = (req.body && req.body.key) || req.query.key;
    
    if (!key) return res.status(400).json({ success: false, error: "Thiếu key" });

    const db = loadDB();
    if (!db[key]) {
        return res.status(404).json({ success: false, error: "Key không tồn tại" });
    }

    const keyData = db[key];

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
// API 3: XÓA KEY (POST)
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

// ==========================================
// API 4: XEM TOÀN BỘ KEY (GET)
// ==========================================
app.get('/api/keys/list', (req, res) => {
    try {
        const db = loadDB();
        const list = Object.keys(db).map(key => {
            return {
                key: key,
                status: db[key].status,
                isExpired: db[key].isExpired || Date.now() > db[key].expireTime,
                expireTime: new Date(db[key].expireTime).toLocaleString('vi-VN'),
                createdAt: new Date(db[key].createdAt).toLocaleString('vi-VN')
            };
        });

        res.json({ success: true, total: list.length, keys: list });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`[SERVER] Backend JS đang chạy tại http://localhost:${PORT}`);
});
