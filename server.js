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
// MongoDB Atlas 设置
// ====================
const mongoUrl = "mongodb://youyouwodego:yesiqi521@cluster0-shard-00-00.em9snb8.mongodb.net:27017,cluster0-shard-00-01.em9snb8.mongodb.net:27017,cluster0-shard-00-02.em9snb8.mongodb.net:27017/mycollectorDB?ssl=true&replicaSet=atlas-0&authSource=admin&retryWrites=true&w=majority";

// 连接 MongoDB
mongoose.connect(mongoUrl)
  .then(() => console.log('✅ MongoDB 连接成功'))
  .catch(err => console.error('❌ MongoDB 连接失败:', err));

// 创建 Mongoose Schema
const numberSchema = new mongoose.Schema({
  number: String,
  time: { type: Date, default: Date.now }
});
const NumberModel = mongoose.model('Number', numberSchema);

// ====================
// 中间件
// ====================
app.use(bodyParser.json());
app.use(express.static(__dirname));

app.use(session({
  secret: 'mySecret123',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 30 * 60 * 1000 } // 30分钟
}));

// 本地 JSON 文件
const DATA_FILE = path.join(__dirname, 'data.json');
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}

// ====================
// 接收手机号
// ====================
app.post('/submit', async (req, res) => {
  const number = req.body.number;

  if (!/^[0-9]{10,12}$/.test(number)) {
    return res.json({ success: false, message: 'Please enter a correct and genuine phone number' });
  }

  const entry = { number, time: new Date() };

  // ===== 保存到本地 JSON =====
  try {
    const localData = JSON.parse(fs.readFileSync(DATA_FILE));
    localData.push(entry);
    fs.writeFileSync(DATA_FILE, JSON.stringify(localData, null, 2));
  } catch (err) {
    console.error('❌ 本地数据保存失败:', err);
  }

  // ===== 保存到 MongoDB =====
  try {
    await NumberModel.create(entry);
  } catch (err) {
    console.error('❌ 数据保存到 MongoDB 失败:', err);
  }

  res.json({ success: true });
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
    data = await NumberModel.find().sort({ time: -1 }).exec();
  } catch (err) {
    console.error('❌ MongoDB 读取数据失败:', err);
  }

  res.send(`
    <h2>管理员后台</h2>
    <ul>
      ${data.map(item => `<li>${item.number} - ${new Date(item.time).toLocaleString()}</li>`).join('')}
    </ul>
    <a href=" ">退出登录</a >
  `);
});

// 登录接口
app.post('/admin-login', (req, res) => {
  const { password } = req.body;

  if (password === '123456') { // 自定义密码
    req.session.isAdmin = true;
    res.json({ success: true });
  } else {
    res.json({ success: false, message: '密码错误' });
  }
});

// 退出登录
app.get('/admin-logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin');
});

// ====================
// 启动服务器
// ====================
app.listen(PORT, () => {
  console.log(`服务器已启动：http://localhost:${PORT}`);
});
