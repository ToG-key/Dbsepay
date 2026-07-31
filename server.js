const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Đường dẫn file lưu dữ liệu
const DATA_FILE = path.join(__dirname, 'data.json');

// ===== HÀM ĐỌC/GHI DỮ LIỆU =====

// Đọc dữ liệu từ file
function readData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Lỗi đọc file:', error);
    }
    return { keys: [], counter: 1 };
}

// Ghi dữ liệu vào file
function writeData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Lỗi ghi file:', error);
        return false;
    }
}

// ===== API ROUTES =====

// Kiểm tra sức khỏe server
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        message: 'Server đang chạy'
    });
});

// Lấy danh sách tất cả keys
app.get('/api/keys', (req, res) => {
    try {
        const data = readData();
        res.json({
            success: true,
            data: data.keys,
            total: data.keys.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Lỗi lấy danh sách keys',
            error: error.message
        });
    }
});

// Lấy key theo ID
app.get('/api/keys/:id', (req, res) => {
    try {
        const data = readData();
        const key = data.keys.find(k => k.id === req.params.id);
        
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

// Thêm key mới
app.post('/api/keys', (req, res) => {
    try {
        const { key, status = 'active' } = req.body;
        
        // Kiểm tra dữ liệu
        if (!key || key.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập key'
            });
        }

        const data = readData();
        
        // Kiểm tra key đã tồn tại chưa
        const exists = data.keys.some(k => k.key === key.trim());
        if (exists) {
            return res.status(400).json({
                success: false,
                message: 'Key đã tồn tại'
            });
        }

        // Tạo key mới
        const newKey = {
            id: `key_${Date.now()}_${data.counter++}`,
            key: key.trim(),
            status: status || 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        data.keys.unshift(newKey);
        
        if (writeData(data)) {
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

// Thêm nhiều keys cùng lúc
app.post('/api/keys/bulk', (req, res) => {
    try {
        const { keys: newKeys } = req.body;
        
        if (!newKeys || !Array.isArray(newKeys) || newKeys.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng cung cấp danh sách keys'
            });
        }

        const data = readData();
        const added = [];
        const failed = [];

        newKeys.forEach(keyValue => {
            if (keyValue && keyValue.trim() !== '') {
                // Kiểm tra trùng
                const exists = data.keys.some(k => k.key === keyValue.trim());
                if (!exists) {
                    const newKey = {
                        id: `key_${Date.now()}_${data.counter++}`,
                        key: keyValue.trim(),
                        status: 'active',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };
                    data.keys.unshift(newKey);
                    added.push(newKey);
                } else {
                    failed.push({ key: keyValue, reason: 'Đã tồn tại' });
                }
            }
        });

        if (writeData(data)) {
            res.json({
                success: true,
                message: `Thêm thành công ${added.length} keys`,
                data: {
                    added: added,
                    failed: failed,
                    total: data.keys.length
                }
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
            message: 'Lỗi thêm nhiều keys',
            error: error.message
        });
    }
});

// Cập nhật key
app.put('/api/keys/:id', (req, res) => {
    try {
        const { key, status } = req.body;
        const data = readData();
        
        const index = data.keys.findIndex(k => k.id === req.params.id);
        if (index === -1) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy key'
            });
        }

        if (key && key.trim() !== '') {
            data.keys[index].key = key.trim();
        }
        
        if (status) {
            data.keys[index].status = status;
        }
        
        data.keys[index].updatedAt = new Date().toISOString();

        if (writeData(data)) {
            res.json({
                success: true,
                message: 'Cập nhật key thành công',
                data: data.keys[index]
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
            message: 'Lỗi cập nhật key',
            error: error.message
        });
    }
});

// Xóa key
app.delete('/api/keys/:id', (req, res) => {
    try {
        const data = readData();
        const index = data.keys.findIndex(k => k.id === req.params.id);
        
        if (index === -1) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy key'
            });
        }

        const deletedKey = data.keys[index];
        data.keys.splice(index, 1);

        if (writeData(data)) {
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

// Xóa tất cả keys
app.delete('/api/keys', (req, res) => {
    try {
        const data = readData();
        const count = data.keys.length;
        data.keys = [];

        if (writeData(data)) {
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

// Tìm kiếm keys
app.get('/api/keys/search/:keyword', (req, res) => {
    try {
        const keyword = req.params.keyword.toLowerCase();
        const data = readData();
        
        const results = data.keys.filter(k => 
            k.key.toLowerCase().includes(keyword)
        );

        res.json({
            success: true,
            data: results,
            total: results.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Lỗi tìm kiếm',
            error: error.message
        });
    }
});

// Lấy thống kê
app.get('/api/stats', (req, res) => {
    try {
        const data = readData();
        const stats = {
            total: data.keys.length,
            active: data.keys.filter(k => k.status === 'active').length,
            inactive: data.keys.filter(k => k.status === 'inactive').length,
            pending: data.keys.filter(k => k.status === 'pending').length,
            latest: data.keys.slice(0, 5).map(k => ({
                key: k.key,
                status: k.status,
                createdAt: k.createdAt
            }))
        };

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Lỗi lấy thống kê',
            error: error.message
        });
    }
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

// ===== KHỞI ĐỘNG SERVER =====
app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại: http://localhost:${PORT}`);
    console.log(`📁 Dữ liệu lưu tại: ${DATA_FILE}`);
    console.log(`📋 API endpoints:`);
    console.log(`   GET    /api/health         - Kiểm tra server`);
    console.log(`   GET    /api/keys           - Lấy danh sách keys`);
    console.log(`   GET    /api/keys/:id       - Lấy key theo ID`);
    console.log(`   POST   /api/keys           - Thêm key mới`);
    console.log(`   POST   /api/keys/bulk      - Thêm nhiều keys`);
    console.log(`   PUT    /api/keys/:id       - Cập nhật key`);
    console.log(`   DELETE /api/keys/:id       - Xóa key`);
    console.log(`   DELETE /api/keys           - Xóa tất cả keys`);
    console.log(`   GET    /api/keys/search/:keyword - Tìm kiếm`);
    console.log(`   GET    /api/stats          - Thống kê`);
});

// ===== XỬ LÝ TẮT SERVER =====
process.on('SIGINT', () => {
    console.log('\n👋 Đang tắt server...');
    process.exit(0);
});
