// api/index.js - Serverless function cho Vercel
const express = require('express');
const cors = require('cors');

const app = express();

// Cấu hình CORS chi tiết
const corsOptions = {
    origin: '*', // Cho phép tất cả domain
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['Content-Length', 'X-Requested-With'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// Dữ liệu trong memory (sẽ mất khi server restart)
let keys = [];
let counter = 1;

// ===== API ROUTES =====

// Kiểm tra sức khỏe server
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        message: 'Server đang chạy',
        totalKeys: keys.length,
        environment: process.env.NODE_ENV || 'development'
    });
});

// Lấy danh sách tất cả keys
app.get('/api/keys', (req, res) => {
    res.json({
        success: true,
        data: keys,
        total: keys.length
    });
});

// Lấy key theo ID
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

// Thêm key mới
app.post('/api/keys', (req, res) => {
    const { key, status = 'active' } = req.body;
    
    // Kiểm tra dữ liệu
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
        id: `key_${Date.now()}_${counter++}`,
        key: key.trim(),
        status: status || 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    keys.unshift(newKey);
    
    res.json({
        success: true,
        message: 'Thêm key thành công',
        data: newKey
    });
});

// Thêm nhiều keys cùng lúc
app.post('/api/keys/bulk', (req, res) => {
    const { keys: newKeys } = req.body;
    
    if (!newKeys || !Array.isArray(newKeys) || newKeys.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Vui lòng cung cấp danh sách keys'
        });
    }

    const added = [];
    const failed = [];

    newKeys.forEach(keyValue => {
        if (keyValue && keyValue.trim() !== '') {
            const exists = keys.some(k => k.key === keyValue.trim());
            if (!exists) {
                const newKey = {
                    id: `key_${Date.now()}_${counter++}`,
                    key: keyValue.trim(),
                    status: 'active',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                keys.unshift(newKey);
                added.push(newKey);
            } else {
                failed.push({ key: keyValue, reason: 'Đã tồn tại' });
            }
        }
    });

    res.json({
        success: true,
        message: `Thêm thành công ${added.length} keys`,
        data: {
            added: added,
            failed: failed,
            total: keys.length
        }
    });
});

// Cập nhật key
app.put('/api/keys/:id', (req, res) => {
    const { key, status } = req.body;
    const index = keys.findIndex(k => k.id === req.params.id);
    
    if (index === -1) {
        return res.status(404).json({
            success: false,
            message: 'Không tìm thấy key'
        });
    }

    if (key && key.trim() !== '') {
        keys[index].key = key.trim();
    }
    
    if (status) {
        keys[index].status = status;
    }
    
    keys[index].updatedAt = new Date().toISOString();

    res.json({
        success: true,
        message: 'Cập nhật key thành công',
        data: keys[index]
    });
});

// Xóa key
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

// Xóa tất cả keys
app.delete('/api/keys', (req, res) => {
    const count = keys.length;
    keys = [];

    res.json({
        success: true,
        message: `Đã xóa ${count} keys`,
        data: { deleted: count }
    });
});

// Tìm kiếm keys
app.get('/api/keys/search/:keyword', (req, res) => {
    const keyword = req.params.keyword.toLowerCase();
    const results = keys.filter(k => 
        k.key.toLowerCase().includes(keyword)
    );

    res.json({
        success: true,
        data: results,
        total: results.length
    });
});

// Lấy thống kê
app.get('/api/stats', (req, res) => {
    const stats = {
        total: keys.length,
        active: keys.filter(k => k.status === 'active').length,
        inactive: keys.filter(k => k.status === 'inactive').length,
        pending: keys.filter(k => k.status === 'pending').length,
        latest: keys.slice(0, 5).map(k => ({
            key: k.key,
            status: k.status,
            createdAt: k.createdAt
        }))
    };

    res.json({
        success: true,
        data: stats
    });
});

// ===== XỬ LÝ LỖI 404 =====
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'API không tồn tại'
    });
});

// ===== XỬ LÝ LỖI CHUNG =====
app.use((err, req, res, next) => {
    console.error('Lỗi server:', err);
    res.status(500).json({
        success: false,
        message: 'Lỗi server nội bộ',
        error: err.message
    });
});

// Export cho Vercel
module.exports = app;
