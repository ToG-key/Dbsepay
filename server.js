const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== MIDDLEWARE ====================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==================== DATABASE ====================
// Dùng SQLite trong thư mục /tmp (Vercel hỗ trợ ghi tạm)
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
  console.log('📋 Dữ liệu:', JSON.stringify(req.body, null, 2));

  try {
    const data = req.body;

    // Xác thực signature (nếu có)
    const signature = req.headers['x-sepay-signature'];
    const secret = process.env.WEBHOOK_SECRET;
    if (secret && signature) {
      const computed = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(data))
        .digest('hex');
      if (computed !== signature) {
        return res.status(401).json({ success: false, message: 'Invalid signature' });
      }
    }

    // Parse dữ liệu
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

    res.status(200).json({
      success: true,
      message: 'Webhook received',
      id: tx.transaction_id
    });

  } catch (error) {
    console.error('❌ Lỗi:', error);
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

// ==================== TRANG CHỦ ====================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ==================== KHỞI ĐỘNG SERVER ====================
app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
  console.log(`🔗 Webhook URL: http://localhost:${PORT}/webhook`);
});
