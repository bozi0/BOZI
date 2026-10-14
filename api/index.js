const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join('/tmp', 'orders.json');

app.use(cors());
app.use(express.json());

// 读取订单名单
function loadOrders() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {}
  return {};
}

// 保存订单名单
function saveOrders(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data));
  } catch (e) {}
}

// 注册订单号
app.post('/register', (req, res) => {
  const { orderNo, device, version, color } = req.body || {};
  if (!orderNo || typeof orderNo !== 'string' || orderNo.length !== 43) {
    return res.status(400).json({ ok: false, error: 'invalid' });
  }
  const orders = loadOrders();
  orders[orderNo] = { ts: Date.now(), device, version, color };
  saveOrders(orders);
  res.json({ ok: true });
});

// 验证订单号
app.post('/verify', (req, res) => {
  const { orderNo } = req.body || {};
  if (!orderNo || typeof orderNo !== 'string') {
    return res.status(400).json({ ok: false, error: 'invalid' });
  }
  const orders = loadOrders();
  if (orders[orderNo]) {
    return res.json({ ok: true, registered: true, data: orders[orderNo] });
  }
  res.json({ ok: true, registered: false });
});

// 健康检查
app.get('/', (req, res) => {
  res.send('Bozi API is running. 🚀');
});

app.listen(PORT, () => {
  console.log('Bozi API listening on ' + PORT);
});
