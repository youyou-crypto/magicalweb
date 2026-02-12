// server.js
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

// ====================
// MongoDB Atlas 设置（已写死：按你要求）
// ====================
const mongoUrl =
  'mongodb+srv://youyouwodego:yesiqi521@cluster0.em9snb8.mongodb.net/mycollectorDB?retryWrites=true&w=majority&appName=Cluster0';

// ====================
// Mongoose Schema
// ====================
const numberSchema = new mongoose.Schema({
  number: { type: String, required: true },
  time: { type: Date, default: Date.now }
});
const NumberModel = mongoose.model('Number', numberSchema);

// ====================
// 中间件
// ====================
app.use(bodyParser.json());
app.use(express.static(__dirname));

app.use(
  session({
    secret: 'mySecret123',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 30 * 60 * 1000 } // 30分钟
  })
);

// 本地 JSON 文件（注意：Render 上文件不保证持久，重启/重新部署可能丢）
const DATA_FILE = path.join(__dirname, 'data.json');
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}

// ====================
// MongoDB 写入：失败自动重试（方案一）
// ====================
async function createWithRetry(doc, retries = 2) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      return await NumberModel.create(doc);
    } catch (err) {
      lastErr = err;
      // 等一会再重试：500ms、1000ms、1500ms...
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw lastErr;
}

// ====================
// 接收号码
// ====================
app.post('/submit', async (req, res) => {
  const number = String(req.body.number || '').trim();

  if (!/^[0-9]{10,12}$/.test(number)) {
    return res.json({
      success: false,
      message: 'Please enter a correct and genuine phone number'
    });
  }

  const entry = { number, time: new Date() };

  // ===== 保存到本地 JSON（可选，Render 上不保证持久）=====
  try {
    const localData = JSON.parse(fs.readFileSync(DATA_FILE));
    localData.push(entry);
    fs.writeFileSync(DATA_FILE, JSON.stringify(localData, null, 2));
  } catch (err) {
    console.error('❌ 本地数据保存失败:', err);
  }

  // ===== 保存到 MongoDB（带重试）=====
  try {
    await createWithRetry(entry, 2); // 重试 2 次
    return res.json({ success: true });
  } catch (err) {
    console.error('❌ 数据保存到 MongoDB 失败(已重试):', err);
    return res.json({ success: false, message: 'Database error' });
  }
});

// ====================
// 管理员后台
// ====================
app.get('/admin', async (req, res) => {
  if (!req.session.isAdmin) {
    return res.sendFile(path.join(__dirname, 'admin-login.html'));
  }

  let data = [];
  try {
    data = await NumberModel.find().sort({ time: -1 }).lean();
  } catch (err) {
    console.error('❌ MongoDB 读取数据失败:', err);
  }

  res.send(`
    <h2>管理员后台</h2>
    <ul>
      ${data
        .map(
          (item) =>
            `<li>${item.number} - ${new Date(item.time).toLocaleString()}</li>`
        )
        .join('')}
    </ul>
    <a href=" ">退出登录</a >
  `);
});

// 登录接口
app.post('/admin-login', (req, res) => {
  const { password } = req.body || {};

  if (password === '123456') {
    req.session.isAdmin = true;
    res.json({ success: true });
  } else {
    res.json({ success: false, message: '密码错误' });
  }
});

// 退出登录
app.get('/admin-logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin');
  });
});

// ====================
// 启动服务器：先连上 MongoDB 再 listen（避免 buffering 超时）
// ====================
async function start() {
  try {
    await mongoose.connect(mongoUrl, {
      serverSelectionTimeoutMS: 10000
    });
    console.log('✅ MongoDB 连接成功');

    app.listen(PORT, () => {
      console.log(`服务器已启动：http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ MongoDB 连接失败:', err);
    process.exit(1);
  }
}

start();
