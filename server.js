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

function readKeys() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Lỗi đọc file:', error.message);
    }
    return [];
}

function writeKeys(keys) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(keys, null, 2));
        return true;
    } catch (error) {
        console.error('Lỗi ghi file:', error.message);
        return false;
    }
}

// ===== TẠO KEY MẶC ĐỊNH NẾU CHƯA CÓ =====

function initDefaultKeys() {
    const keys = readKeys();
    if (keys.length === 0) {
        const defaultKeys = [
            {
                id: 'key_default_1',
                key: 'HL92-REP0-RTAL-LXXX',
                status: 'active',
                type: 'all',
                createdAt: new Date().toISOString()
            },
            {
                id: 'key_default_2',
                key: 'HOTL-KEYA-LLXX-XXXX',
                status: 'active',
                type: 'all',
                createdAt: new Date().toISOString()
            },
            {
                id: 'key_default_3',
                key: 'FULL-ACCE-SSAL-LKEY',
                status: 'active',
                type: 'all',
                createdAt: new Date().toISOString()
            }
        ];
        writeKeys(defaultKeys);
        console.log('✅ Đã tạo 3 key mặc định');
    }
}

// Gọi khởi tạo
initDefaultKeys();

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

// 4. KIỂM TRA KEY (QUAN TRỌNG - DÙNG CHO EXTENSION)
app.get('/api/check-key', (req, res) => {
    try {
        const { key, machine_id } = req.query;
        
        if (!key || key.trim() === '') {
            return res.status(400).json({
                valid: false,
                message: 'Vui lòng nhập key'
            });
        }

        const keys = readKeys();
        const foundKey = keys.find(k => k.key === key.trim() && k.status === 'active');
        
        if (foundKey) {
            // Trả về đúng format extension cần
            res.json({
                valid: true,
                expires: Math.floor(Date.now() / 1000) + 31536000, // 1 năm
                type: foundKey.type || 'all',
                message: '✅ Key hợp lệ'
            });
        } else {
            res.json({
                valid: false,
                message: '❌ Key không tồn tại hoặc đã bị khóa'
            });
        }
    } catch (error) {
        res.status(500).json({
            valid: false,
            message: 'Lỗi kiểm tra key: ' + error.message
        });
    }
});

// 5. Kiểm tra key tồn tại (POST)
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
                valid: foundKey.status === 'active',
                message: foundKey.status === 'active' ? '✅ Key hợp lệ' : '⚠️ Key đã bị khóa',
                data: {
                    key: foundKey.key,
                    status: foundKey.status,
                    type: foundKey.type || 'all',
                    createdAt: foundKey.createdAt
                }
            });
        } else {
            res.json({
                success: true,
                exists: false,
                valid: false,
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

// 6. Thêm key mới
app.post('/api/keys', (req, res) => {
    try {
        const { key, status = 'active', type = 'all' } = req.body;
        
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
            type: type,
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

// 7. Cập nhật key
app.put('/api/keys/:id', (req, res) => {
    try {
        const { status, type } = req.body;
        const keys = readKeys();
        const index = keys.findIndex(k => k.id === req.params.id);
        
        if (index === -1) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy key'
            });
        }

        if (status) keys[index].status = status;
        if (type) keys[index].type = type;
        keys[index].updatedAt = new Date().toISOString();

        if (writeKeys(keys)) {
            res.json({
                success: true,
                message: 'Cập nhật key thành công',
                data: keys[index]
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

// 8. Xóa key theo ID
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

// 9. Xóa tất cả keys
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

// ================================================================
// ===== API /api/vgp - Video/Profile/Group flows cho HotLike =====
// ================================================================

// ===== DANH SÁCH FLOWS ĐẦY ĐỦ =====
const FLOWS = [
    // ===== PROFILE FLOWS =====
    {
        id: '1',
        name: 'Giả mạo + Self-harm + Scam (hardcoded)',
        group: 'Profile',
        target: 'Profile',
        category: 'Impersonation',
        steps: [
            { mfb: { ariaLabel: 'More options' }, wwwfb: { ariaLabel: 'More options' } },
            { mfb: { ariaLabel: 'Find support or report' }, wwwfb: { ariaLabel: 'Find support or report' } },
            { mfb: { ariaLabel: 'Report' }, wwwfb: { ariaLabel: 'Report' } },
            { mfb: { ariaLabel: 'Pretending to be someone' }, wwwfb: { text: 'Pretending to be someone' } },
            { mfb: { ariaLabel: 'Self-harm' }, wwwfb: { text: 'Self-harm' } },
            { mfb: { ariaLabel: 'Scam' }, wwwfb: { text: 'Scam' } }
        ]
    },
    {
        id: '2',
        name: 'Mạo danh (dùng link fake nhập)',
        group: 'Profile',
        target: 'Profile',
        category: 'Impersonation',
        steps: [
            { mfb: { ariaLabel: 'More options' }, wwwfb: { ariaLabel: 'More options' } },
            { mfb: { ariaLabel: 'Find support or report' }, wwwfb: { ariaLabel: 'Find support or report' } },
            { mfb: { ariaLabel: 'Report' }, wwwfb: { ariaLabel: 'Report' } },
            { mfb: { ariaLabel: 'Pretending to be someone' }, wwwfb: { text: 'Pretending to be someone' } },
            { mfb: { inputValue: '{fakeLink}', ariaLabel: 'Link of the profile' }, 
              wwwfb: { inputValue: '{fakeLink}' } }
        ]
    },
    {
        id: '4',
        name: 'Hàng cấm (Alcohol) + Lừa đảo',
        group: 'Profile',
        target: 'Profile',
        category: 'Restricted Goods',
        steps: [
            { mfb: { ariaLabel: 'More options' }, wwwfb: { ariaLabel: 'More options' } },
            { mfb: { ariaLabel: 'Find support or report' }, wwwfb: { ariaLabel: 'Find support or report' } },
            { mfb: { ariaLabel: 'Report' }, wwwfb: { ariaLabel: 'Report' } },
            { mfb: { ariaLabel: 'Alcohol' }, wwwfb: { text: 'Alcohol' } },
            { mfb: { ariaLabel: 'Scam' }, wwwfb: { text: 'Scam' } }
        ]
    },
    {
        id: '7',
        name: 'Hàng cấm + Lừa đảo',
        group: 'Profile',
        target: 'Profile',
        category: 'Restricted Goods',
        steps: [
            { mfb: { ariaLabel: 'More options' }, wwwfb: { ariaLabel: 'More options' } },
            { mfb: { ariaLabel: 'Find support or report' }, wwwfb: { ariaLabel: 'Find support or report' } },
            { mfb: { ariaLabel: 'Report' }, wwwfb: { ariaLabel: 'Report' } },
            { mfb: { ariaLabel: 'Restricted goods' }, wwwfb: { text: 'Restricted goods' } },
            { mfb: { ariaLabel: 'Scam' }, wwwfb: { text: 'Scam' } }
        ]
    },
    {
        id: '8',
        name: 'Nội dung người lớn',
        group: 'Profile',
        target: 'Profile',
        category: 'Adult Content',
        steps: [
            { mfb: { ariaLabel: 'More options' }, wwwfb: { ariaLabel: 'More options' } },
            { mfb: { ariaLabel: 'Find support or report' }, wwwfb: { ariaLabel: 'Find support or report' } },
            { mfb: { ariaLabel: 'Report' }, wwwfb: { ariaLabel: 'Report' } },
            { mfb: { ariaLabel: 'Adult content' }, wwwfb: { text: 'Adult content' } }
        ]
    },
    {
        id: '9',
        name: 'Bạo lực & Thù ghét',
        group: 'Profile',
        target: 'Profile',
        category: 'Violence & Hate',
        steps: [
            { mfb: { ariaLabel: 'More options' }, wwwfb: { ariaLabel: 'More options' } },
            { mfb: { ariaLabel: 'Find support or report' }, wwwfb: { ariaLabel: 'Find support or report' } },
            { mfb: { ariaLabel: 'Report' }, wwwfb: { ariaLabel: 'Report' } },
            { mfb: { ariaLabel: 'Violence' }, wwwfb: { text: 'Violence' } },
            { mfb: { ariaLabel: 'Hate speech' }, wwwfb: { text: 'Hate speech' } }
        ]
    },
    {
        id: '10',
        name: 'An toàn & Lạm dụng',
        group: 'Profile',
        target: 'Profile',
        category: 'Safety & Abuse',
        steps: [
            { mfb: { ariaLabel: 'More options' }, wwwfb: { ariaLabel: 'More options' } },
            { mfb: { ariaLabel: 'Find support or report' }, wwwfb: { ariaLabel: 'Find support or report' } },
            { mfb: { ariaLabel: 'Report' }, wwwfb: { ariaLabel: 'Report' } },
            { mfb: { ariaLabel: 'Safety' }, wwwfb: { text: 'Safety' } },
            { mfb: { ariaLabel: 'Abuse' }, wwwfb: { text: 'Abuse' } }
        ]
    },
    {
        id: '16',
        name: '😢 Tất cả loại report',
        group: 'Profile',
        target: 'Profile',
        category: 'All Types',
        steps: [
            { mfb: { ariaLabel: 'More options' }, wwwfb: { ariaLabel: 'More options' } },
            { mfb: { ariaLabel: 'Find support or report' }, wwwfb: { ariaLabel: 'Find support or report' } },
            { mfb: { ariaLabel: 'Report' }, wwwfb: { ariaLabel: 'Report' } },
            { mfb: { ariaLabel: 'Pretending to be someone' }, wwwfb: { text: 'Pretending to be someone' } },
            { mfb: { ariaLabel: 'Self-harm' }, wwwfb: { text: 'Self-harm' } },
            { mfb: { ariaLabel: 'Scam' }, wwwfb: { text: 'Scam' } },
            { mfb: { ariaLabel: 'Violence' }, wwwfb: { text: 'Violence' } },
            { mfb: { ariaLabel: 'Hate speech' }, wwwfb: { text: 'Hate speech' } }
        ]
    },

    // ===== PAGE FLOWS =====
    {
        id: '6',
        name: 'Fake page nâng cấp',
        group: 'Page',
        target: 'Page',
        category: 'Fake Page',
        steps: [
            { mfb: { ariaLabel: 'More options' }, wwwfb: { ariaLabel: 'More options' } },
            { mfb: { ariaLabel: 'Find support or report' }, wwwfb: { ariaLabel: 'Find support or report' } },
            { mfb: { ariaLabel: 'Report' }, wwwfb: { ariaLabel: 'Report' } },
            { mfb: { ariaLabel: 'Pretending to be someone' }, wwwfb: { text: 'Pretending to be someone' } },
            { mfb: { inputValue: '{fakeLink}', ariaLabel: 'Link of the page' }, 
              wwwfb: { inputValue: '{fakeLink}' } }
        ]
    },
    {
        id: '11',
        name: 'Scam & Thông tin sai',
        group: 'Page',
        target: 'Page',
        category: 'Scam & False Info',
        steps: [
            { mfb: { ariaLabel: 'More options' }, wwwfb: { ariaLabel: 'More options' } },
            { mfb: { ariaLabel: 'Find support or report' }, wwwfb: { ariaLabel: 'Find support or report' } },
            { mfb: { ariaLabel: 'Report' }, wwwfb: { ariaLabel: 'Report' } },
            { mfb: { ariaLabel: 'Scam' }, wwwfb: { text: 'Scam' } },
            { mfb: { ariaLabel: 'False information' }, wwwfb: { text: 'False information' } }
        ]
    },
    {
        id: '12',
        name: 'Bạo lực & Thù ghét',
        group: 'Page',
        target: 'Page',
        category: 'Violence & Hate',
        steps: [
            { mfb: { ariaLabel: 'More options' }, wwwfb: { ariaLabel: 'More options' } },
            { mfb: { ariaLabel: 'Find support or report' }, wwwfb: { ariaLabel: 'Find support or report' } },
            { mfb: { ariaLabel: 'Report' }, wwwfb: { ariaLabel: 'Report' } },
            { mfb: { ariaLabel: 'Violence' }, wwwfb: { text: 'Violence' } },
            { mfb: { ariaLabel: 'Hate speech' }, wwwfb: { text: 'Hate speech' } }
        ]
    },
    {
        id: '13',
        name: 'An toàn & Lạm dụng',
        group: 'Page',
        target: 'Page',
        category: 'Safety & Abuse',
        steps: [
            { mfb: { ariaLabel: 'More options' }, wwwfb: { ariaLabel: 'More options' } },
            { mfb: { ariaLabel: 'Find support or report' }, wwwfb: { ariaLabel: 'Find support or report' } },
            { mfb: { ariaLabel: 'Report' }, wwwfb: { ariaLabel: 'Report' } },
            { mfb: { ariaLabel: 'Safety' }, wwwfb: { text: 'Safety' } },
            { mfb: { ariaLabel: 'Abuse' }, wwwfb: { text: 'Abuse' } }
        ]
    },
    {
        id: '14',
        name: 'Hàng cấm & Adult content',
        group: 'Page',
        target: 'Page',
        category: 'Restricted Goods & Adult',
        steps: [
            { mfb: { ariaLabel: 'More options' }, wwwfb: { ariaLabel: 'More options' } },
            { mfb: { ariaLabel: 'Find support or report' }, wwwfb: { ariaLabel: 'Find support or report' } },
            { mfb: { ariaLabel: 'Report' }, wwwfb: { ariaLabel: 'Report' } },
            { mfb: { ariaLabel: 'Restricted goods' }, wwwfb: { text: 'Restricted goods' } },
            { mfb: { ariaLabel: 'Adult content' }, wwwfb: { text: 'Adult content' } }
        ]
    },
    {
        id: '15',
        name: 'Fake page tổng lực',
        group: 'Page',
        target: 'Page',
        category: 'Fake Page',
        steps: [
            { mfb: { ariaLabel: 'More options' }, wwwfb: { ariaLabel: 'More options' } },
            { mfb: { ariaLabel: 'Find support or report' }, wwwfb: { ariaLabel: 'Find support or report' } },
            { mfb: { ariaLabel: 'Report' }, wwwfb: { ariaLabel: 'Report' } },
            { mfb: { ariaLabel: 'Pretending to be someone' }, wwwfb: { text: 'Pretending to be someone' } },
            { mfb: { ariaLabel: 'Scam' }, wwwfb: { text: 'Scam' } },
            { mfb: { ariaLabel: 'False information' }, wwwfb: { text: 'False information' } }
        ]
    },
    {
        id: '17',
        name: '😢 Tất cả loại report',
        group: 'Page',
        target: 'Page',
        category: 'All Types',
        steps: [
            { mfb: { ariaLabel: 'More options' }, wwwfb: { ariaLabel: 'More options' } },
            { mfb: { ariaLabel: 'Find support or report' }, wwwfb: { ariaLabel: 'Find support or report' } },
            { mfb: { ariaLabel: 'Report' }, wwwfb: { ariaLabel: 'Report' } },
            { mfb: { ariaLabel: 'Pretending to be someone' }, wwwfb: { text: 'Pretending to be someone' } },
            { mfb: { ariaLabel: 'Scam' }, wwwfb: { text: 'Scam' } },
            { mfb: { ariaLabel: 'False information' }, wwwfb: { text: 'False information' } },
            { mfb: { ariaLabel: 'Violence' }, wwwfb: { text: 'Violence' } },
            { mfb: { ariaLabel: 'Hate speech' }, wwwfb: { text: 'Hate speech' } }
        ]
    },

    // ===== GROUP FLOWS =====
    {
        id: '18',
        name: 'Scam & Thông tin sai',
        group: 'Group',
        target: 'Group',
        category: 'Scam & False Info',
        steps: [
            { mfb: { ariaLabel: 'More options' }, wwwfb: { ariaLabel: 'More options' } },
            { mfb: { ariaLabel: 'Find support or report' }, wwwfb: { ariaLabel: 'Find support or report' } },
            { mfb: { ariaLabel: 'Report' }, wwwfb: { ariaLabel: 'Report' } },
            { mfb: { ariaLabel: 'Scam' }, wwwfb: { text: 'Scam' } },
            { mfb: { ariaLabel: 'False information' }, wwwfb: { text: 'False information' } }
        ]
    },
    {
        id: '19',
        name: 'Bạo lực & Thù ghét',
        group: 'Group',
        target: 'Group',
        category: 'Violence & Hate',
        steps: [
            { mfb: { ariaLabel: 'More options' }, wwwfb: { ariaLabel: 'More options' } },
            { mfb: { ariaLabel: 'Find support or report' }, wwwfb: { ariaLabel: 'Find support or report' } },
            { mfb: { ariaLabel: 'Report' }, wwwfb: { ariaLabel: 'Report' } },
            { mfb: { ariaLabel: 'Violence' }, wwwfb: { text: 'Violence' } },
            { mfb: { ariaLabel: 'Hate speech' }, wwwfb: { text: 'Hate speech' } }
        ]
    }
];

// ===== API /api/vgp =====
app.get('/api/vgp', (req, res) => {
    try {
        const { flow, key, machine_id } = req.query;
        
        // Kiểm tra key hợp lệ (nếu có)
        if (key) {
            const keys = readKeys();
            const foundKey = keys.find(k => k.key === key.trim() && k.status === 'active');
            if (!foundKey) {
                return res.status(403).json({
                    error: 'Key không hợp lệ hoặc thiết bị chưa đăng ký'
                });
            }
        }

        // Nếu có flow cụ thể
        if (flow && flow !== '*' && flow !== 'all') {
            const foundFlow = FLOWS.find(f => f.id === flow);
            if (foundFlow) {
                return res.json(foundFlow);
            }
            return res.status(404).json({ error: 'Flow not found' });
        }

        // Trả về tất cả flows
        res.json(FLOWS);
        
    } catch (error) {
        res.status(500).json({
            error: 'Lỗi server',
            message: error.message
        });
    }
});

// ===== API /api/vgp (POST - hỗ trợ lấy nhiều flows) =====
app.post('/api/vgp', (req, res) => {
    try {
        const { flow_ids, key, machine_id } = req.body;
        
        // Kiểm tra key
        if (key) {
            const keys = readKeys();
            const foundKey = keys.find(k => k.key === key.trim() && k.status === 'active');
            if (!foundKey) {
                return res.status(403).json({
                    error: 'Key không hợp lệ hoặc thiết bị chưa đăng ký'
                });
            }
        }

        // Nếu có danh sách flow_ids
        if (flow_ids && Array.isArray(flow_ids) && flow_ids.length > 0) {
            const result = FLOWS.filter(f => flow_ids.includes(f.id));
            return res.json({
                success: true,
                data: result,
                total: result.length
            });
        }

        // Trả về tất cả
        res.json({
            success: true,
            data: FLOWS,
            total: FLOWS.length
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Lỗi server',
            message: error.message
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
    console.log(`   GET    /api/check-key       - CHECK KEY (dùng cho extension)`);
    console.log(`   POST   /api/keys            - Thêm key mới`);
    console.log(`   POST   /api/check-key       - Kiểm tra key tồn tại`);
    console.log(`   PUT    /api/keys/:id        - Cập nhật key`);
    console.log(`   DELETE /api/keys/:id        - Xóa key`);
    console.log(`   DELETE /api/keys            - Xóa tất cả keys`);
    console.log(`\n   🎯 FLOWS API:`);
    console.log(`   GET    /api/vgp             - Lấy tất cả flows`);
    console.log(`   GET    /api/vgp?flow=1      - Lấy flow ID 1`);
    console.log(`   POST   /api/vgp             - Lấy danh sách flows theo ID`);
    console.log(`\n💡 Mở trình duyệt: http://localhost:${PORT}\n`);
});
