const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));
app.use(express.json());
app.use(express.static(__dirname));

// Đường dẫn file dữ liệu
const DATA_FILE = path.join(__dirname, 'key.json');

// ===== HÀM ĐỌC/GHI DỮ LIỆU =====

// Đọc dữ liệu từ file
function readKeys() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Lỗi đọc file:', error);
    }
    return [];
}

// Ghi dữ liệu vào file
function writeKeys(keys) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(keys, null, 2));
        return true;
    } catch (error) {
        console.error('Lỗi ghi file:', error);
        return false;
    }
}

// ===== API ROUTES =====

// Root - Phục vụ index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 1. Health check
app.get('/api/health', (req, res) => {
    const keys = readKeys();
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        totalKeys: keys.length,
        message: 'Server đang chạy'
    });
});

// 2. Lấy danh sách keys
app.get('/api/keys', (req, res) => {
    try {
        const keys = readKeys();
        res.json({
            success: true,
            data: keys,
            total: keys.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Lỗi lấy danh sách keys',
            error: error.message
        });
    }
});

// 3. Lấy key theo ID
app.get('/api/keys/:id', (req, res) => {
    try {
        const keys = readKeys();
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
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Lỗi lấy key',
            error: error.message
        });
    }
});

// 4. Kiểm tra key tồn tại
app.post('/api/check-key', (req, res) => {
    try {
        const { key } = req.body;
        
        if (!key || key.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập key cần kiểm tra'
            });
        }

        const keys = readKeys();
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
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Lỗi kiểm tra key',
            error: error.message
        });
    }
});

// 5. Thêm key mới
app.post('/api/keys', (req, res) => {
    try {
        const { key, status = 'active' } = req.body;
        
        if (!key || key.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập key'
            });
        }

        const keys = readKeys();
        
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
        
        if (writeKeys(keys)) {
            res.json({
                success: true,
                message: 'Thêm key thành công',
                data: newKey
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Lỗi lưu dữ liệu'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Lỗi thêm key',
            error: error.message
        });
    }
});

// 6. Xóa key theo ID
app.delete('/api/keys/:id', (req, res) => {
    try {
        const keys = readKeys();
        const index = keys.findIndex(k => k.id === req.params.id);
        
        if (index === -1) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy key'
            });
        }

        const deletedKey = keys[index];
        keys.splice(index, 1);

        if (writeKeys(keys)) {
            res.json({
                success: true,
                message: 'Xóa key thành công',
                data: deletedKey
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Lỗi lưu dữ liệu'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Lỗi xóa key',
            error: error.message
        });
    }
});

// 7. Xóa tất cả keys
app.delete('/api/keys', (req, res) => {
    try {
        const count = readKeys().length;
        
        if (writeKeys([])) {
            res.json({
                success: true,
                message: `Đã xóa ${count} keys`,
                data: { deleted: count }
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Lỗi lưu dữ liệu'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Lỗi xóa tất cả keys',
            error: error.message
        });
    }
});

// 404 - Xử lý route không tồn tại
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'API không tồn tại'
    });
});

// Khởi động server
app.listen(PORT, () => {
    console.log(`\n🚀 SERVER ĐANG CHẠY`);
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`📁 Dữ liệu lưu tại: ${DATA_FILE}`);
    console.log(`\n📋 API ENDPOINTS:`);
    console.log(`   GET    /api/health          - Kiểm tra server`);
    console.log(`   GET    /api/keys            - Lấy danh sách keys`);
    console.log(`   GET    /api/keys/:id        - Lấy key theo ID`);
    console.log(`   POST   /api/keys            - Thêm key mới`);
    console.log(`   POST   /api/check-key       - Kiểm tra key tồn tại`);
    console.log(`   DELETE /api/keys/:id        - Xóa key`);
    console.log(`   DELETE /api/keys            - Xóa tất cả keys`);
    console.log(`\n💡 Mở trình duyệt: http://localhost:${PORT}\n`);
});
