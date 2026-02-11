// server.js (Render 云端专用)
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// === MongoDB Atlas 非 SRV URI ===
const mongoUrl = "mongodb://youyouwodego:yesiqi521@cluster0-shard-00-00.em9snb8.mongodb.net:27017,cluster0-shard-00-01.em9snb8.mongodb.net:27017,cluster0-shard-00-02.em9snb8.mongodb.net:27017/mycollectorDB?ssl=true&replicaSet=atlas-0&authSource=admin&retryWrites=true&w=majority";

// 连接 MongoDB
mongoose.connect(mongoUrl)
  .then(() => console.log('✅ MongoDB 已连接'))
  .catch(err => console.error('❌ MongoDB 连接失败:', err));

// 数据模型
const NumberSchema = new mongoose.Schema({
  number: String,
  time: { type: Date, default: Date.now }
});
const NumberModel = mongoose.model('Number', NumberSchema);

// 中间件
app.use(bodyParser.json());
app.use(express.static(__dirname));
app.use(session({
  secret: 'mySecret123',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 30 * 60 * 1000 } // 30分钟
}));

// 接收手机号
app.post('/submit', async (req, res) => {
  const { number } = req.body;

  if (!/^[0-9]{10,12}$/.test(number)) {
    return res.json({ success: false, message: 'Please enter a correct and genuine phone number' });
  }

  try {
    const doc = new NumberModel({ number });
    await doc.save();
    res.json({ success: true });
  } catch (err) {
    console.error('❌ 数据保存失败:', err);
    res.json({ success: false, message: '保存失败' });
  }
});

// 后台页面
app.get('/admin', async (req, res) => {
  if (!req.session.isAdmin) {
    return res.sendFile(path.join(__dirname, 'admin-login.html'));
  }

  try {
    const data = await NumberModel.find().sort({ time: -1 });
    res.send(`
      <h2>管理员后台</h2>
      <ul>
        ${data.map(item => `<li>${item.number} - ${new Date(item.time).toLocaleString()}</li>`).join('')}
      </ul>
      <a href=" ">退出登录</a >
    `);
  } catch (err) {
    res.send('读取数据失败');
  }
});

// 登录接口
const ADMIN_PASSWORD = '123456';
app.post('/admin-login', (req, res) => {
  const { password } = req.body;

  if (password === ADMIN_PASSWORD) {
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

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器已启动：http://localhost:${PORT}`);
});