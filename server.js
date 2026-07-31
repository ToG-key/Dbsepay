// api/index.js - Serverless function cho Vercel
const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// Dữ liệu trong memory (khởi tạo rỗng)
let keys = [];

// ===== API ROUTES =====

// 1. Root path - Kiểm tra server
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Key Management API is running',
        endpoints: {
            health: '/api/health',
            keys: '/api/keys',
            checkKey: '/api/check-key',
            addKey: '/api/keys (POST)',
            deleteKey: '/api/keys/:id (DELETE)',
            deleteAll: '/api/keys (DELETE)'
        }
    });
});

// 2. Kiểm tra sức khỏe server
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        totalKeys: keys.length,
        message: 'Server đang chạy'
    });
});

// 3. Lấy danh sách tất cả keys
app.get('/api/keys', (req, res) => {
    res.json({
        success: true,
        data: keys,
        total: keys.length
    });
});

// 4. Lấy chi tiết 1 key theo ID
app.get('/api/keys/:id', (req, res) => {
    const key = keys.find(k => k.id === req.params.id);
    
    if (!key) {
        return res.status(404).json({
            success: false,
            message: 'Không tìm thấy key'
        });
    }
    
    res.json({
        success: true,
        data: key
    });
});

// 5. Kiểm tra key tồn tại
app.post('/api/check-key', (req, res) => {
    const { key } = req.body;
    
    if (!key || key.trim() === '') {
        return res.status(400).json({
            success: false,
            message: 'Vui lòng nhập key cần kiểm tra'
        });
    }

    const foundKey = keys.find(k => k.key === key.trim());
    
    if (foundKey) {
        res.json({
            success: true,
            exists: true,
            message: '✅ Key tồn tại',
            data: {
                key: foundKey.key,
                status: foundKey.status,
                createdAt: foundKey.createdAt
            }
        });
    } else {
        res.json({
            success: true,
            exists: false,
            message: '❌ Key không tồn tại'
        });
    }
});

// 6. Thêm key mới
app.post('/api/keys', (req, res) => {
    const { key, status = 'active' } = req.body;
    
    if (!key || key.trim() === '') {
        return res.status(400).json({
            success: false,
            message: 'Vui lòng nhập key'
        });
    }

    // Kiểm tra key đã tồn tại chưa
    const exists = keys.some(k => k.key === key.trim());
    if (exists) {
        return res.status(400).json({
            success: false,
            message: 'Key đã tồn tại'
        });
    }

    // Tạo key mới
    const newKey = {
        id: `key_${Date.now()}`,
        key: key.trim(),
        status: status,
        createdAt: new Date().toISOString()
    };

    keys.push(newKey);
    
    res.json({
        success: true,
        message: 'Thêm key thành công',
        data: newKey
    });
});

// 7. Xóa key theo ID
app.delete('/api/keys/:id', (req, res) => {
    const index = keys.findIndex(k => k.id === req.params.id);
    
    if (index === -1) {
        return res.status(404).json({
            success: false,
            message: 'Không tìm thấy key'
        });
    }

    const deletedKey = keys[index];
    keys.splice(index, 1);

    res.json({
        success: true,
        message: 'Xóa key thành công',
        data: deletedKey
    });
});

// 8. Xóa tất cả keys
app.delete('/api/keys', (req, res) => {
    const count = keys.length;
    keys = [];

    res.json({
        success: true,
        message: `Đã xóa ${count} keys`,
        data: { deleted: count }
    });
});

// 9. Xử lý route không tồn tại
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'API không tồn tại'
    });
});

// Export cho Vercel
module.exports = app;
