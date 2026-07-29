const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== BIẾN MÔI TRƯỜNG ====================
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || null;

console.log('🔐 WEBHOOK_SECRET:', WEBHOOK_SECRET ? '✅ Đã cấu hình' : '⚠️ Chưa cấu hình (chế độ không xác thực)');

// ==================== MIDDLEWARE ====================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==================== DATABASE ====================
const DB_PATH = process.env.VERCEL ? '/tmp/transactions.sqlite' : './transactions.sqlite';
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) console.error('❌ Lỗi DB:', err.message);
  else console.log('✅ SQLite đã sẵn sàng tại:', DB_PATH);
});

db.run(`
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id TEXT UNIQUE,
    account_number TEXT,
    amount INTEGER,
    balance INTEGER,
    description TEXT,
    transaction_type TEXT,
    reference_code TEXT,
    bank_code TEXT,
    transaction_at TEXT,
    received_at TEXT DEFAULT CURRENT_TIMESTAMP,
    raw_data TEXT
  )
`);

// ==================== WEBHOOK ENDPOINT ====================
app.post('/webhook', async (req, res) => {
  console.log('📩 Nhận webhook từ SePay');

  try {
    const data = req.body;
    const signature = req.headers['x-sepay-signature'];

    // ========== XÁC THỰC HMAC-SHA256 ==========
    if (WEBHOOK_SECRET) {
      if (!signature) {
        console.warn('⚠️ Thiếu signature header');
        return res.status(401).json({
          success: false,
          message: 'Missing signature header'
        });
      }

      const payloadString = JSON.stringify(data);
      const computedSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(payloadString)
        .digest('hex');

      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(computedSignature, 'hex')
      );

      if (!isValid) {
        console.warn('⚠️ Chữ ký không hợp lệ!');
        return res.status(401).json({
          success: false,
          message: 'Invalid signature'
        });
      }

      console.log('✅ Chữ ký hợp lệ');
    } else {
      console.log('ℹ️ Chế độ không xác thực (WEBHOOK_SECRET chưa cấu hình)');
    }

    // ========== XỬ LÝ DỮ LIỆU ==========
    console.log('📋 Dữ liệu nhận được:', JSON.stringify(data, null, 2));

    const tx = {
      transaction_id: data.transaction_id || data.id || `TX${Date.now()}`,
      account_number: data.account_number || data.accountNo || data.bank_account || '',
      amount: parseFloat(data.amount || data.amount_vnd || 0),
      balance: parseFloat(data.balance || data.current_balance || 0),
      description: data.description || data.content || data.transfer_content || '',
      transaction_type: data.type || (data.amount > 0 ? 'in' : 'out'),
      reference_code: data.reference_code || data.deposit_code || '',
      bank_code: data.bank_code || data.bankCode || '',
      transaction_at: data.transaction_at || data.created_at || new Date().toISOString(),
      raw_data: JSON.stringify(data)
    };

    // Lưu vào database
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO transactions 
      (transaction_id, account_number, amount, balance, description, transaction_type, reference_code, bank_code, transaction_at, raw_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      tx.transaction_id,
      tx.account_number,
      tx.amount,
      tx.balance,
      tx.description,
      tx.transaction_type,
      tx.reference_code,
      tx.bank_code,
      tx.transaction_at,
      tx.raw_data
    );
    stmt.finalize();

    console.log('✅ Đã lưu giao dịch:', tx.transaction_id);

    res.status(200).json({
      success: true,
      message: 'Webhook received',
      id: tx.transaction_id
    });

  } catch (error) {
    console.error('❌ Lỗi xử lý webhook:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ==================== API LẤY GIAO DỊCH ====================
app.get('/api/transactions', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const type = req.query.type || 'all';

  db.all('SELECT * FROM transactions ORDER BY received_at DESC LIMIT ?', [limit], (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }

    let result = rows;
    if (type === 'in') result = rows.filter(r => r.amount > 0);
    else if (type === 'out') result = rows.filter(r => r.amount < 0);

    let totalIn = 0, totalOut = 0;
    rows.forEach(r => {
      if (r.amount > 0) totalIn += r.amount;
      else totalOut += Math.abs(r.amount);
    });

    res.json({
      success: true,
      total: rows.length,
      total_in: totalIn,
      total_out: totalOut,
      latest_balance: rows.length > 0 ? rows[0].balance : 0,
      data: result.slice(0, limit)
    });
  });
});

// ==================== API LẤY SỐ DƯ MỚI NHẤT ====================
app.get('/api/balance', (req, res) => {
  db.get('SELECT balance, received_at FROM transactions ORDER BY received_at DESC LIMIT 1', (err, row) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }

    res.json({
      success: true,
      balance: row ? row.balance : 0,
      updated_at: row ? row.received_at : null
    });
  });
});

// ==================== TRANG CHỦ ====================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ==================== KHỞI ĐỘNG SERVER ====================
app.listen(PORT, () => {
  console.log(`\n🚀 Server đang chạy tại: http://localhost:${PORT}`);
  console.log(`🔗 Webhook URL: http://localhost:${PORT}/webhook`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔐 Bảo mật: ${WEBHOOK_SECRET ? '✅ HMAC-SHA256 đã bật' : '⚠️ Không xác thực'}\n`);
});
