const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const app = express();
const PORT = process.env.PORT || 3000;
const isVercel = !!process.env.VERCEL;
const DATA_DIR = process.env.DATA_DIR || (isVercel ? '/tmp/data' : path.join(__dirname, 'data'));
const PUBLIC_DIR = process.env.PUBLIC_DIR || (isVercel ? '/tmp/public' : path.join(__dirname, 'public'));

// Set DB_PATH before requiring db
process.env.DB_PATH = path.join(DATA_DIR, 'store.db');
const db = require('./db');

app.use(express.json({ limit: '2gb' }));
app.use(express.static(path.join(__dirname, 'public')));
if (PUBLIC_DIR !== path.join(__dirname, 'public')) {
  app.use(express.static(PUBLIC_DIR));
}

// Ensure directories
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
['icons', 'apps', 'screenshots'].forEach(dir => {
  const p = path.join(PUBLIC_DIR, dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

// ─── Auth helpers ────────────────────────────────────────────────────────

function hashPassword(pw) {
  return crypto.createHash('sha256').update(pw).digest('hex');
}

function makeToken(user) {
  return Buffer.from(user.id + ':' + user.username + ':' + Date.now()).toString('base64');
}

function getUserFromToken(token) {
  try {
    const raw = Buffer.from(token, 'base64').toString('utf8');
    return db.getUser(parseInt(raw.split(':')[0]));
  } catch { return null; }
}

function adminAuth(req, res, next) {
  if (req.headers['x-admin-token'] !== 'U9NegNSvJM3WYBFu')
    return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// ─── Apps API ────────────────────────────────────────────────────────────

app.get('/api/apps', (req, res) => {
  const list = db.listApps(req.query.q || '');
  res.json(list);
});

app.get('/api/apps/:id', (req, res) => {
  const app = db.getApp(parseInt(req.params.id));
  if (!app) return res.status(404).json({ error: 'App not found' });
  res.json(app);
});

app.post('/api/apps', adminAuth, (req, res) => {
  const { name, developer, price, rating, color_theme, platform, category, description } = req.body;
  if (!name || !developer) return res.status(400).json({ error: 'Name and developer required' });
  const app = db.createApp({
    name, developer,
    price: price || 'Free',
    rating: rating || 0,
    color_theme: color_theme || '#0078D7',
    platform: platform || 'android',
    category: category || 'other',
    description: description || '',
    icon_url: '', file_url: ''
  });
  res.json({ success: true, app });
});

app.put('/api/apps/:id', adminAuth, (req, res) => {
  const id = parseInt(req.params.id);
  if (!db.getApp(id)) return res.status(404).json({ error: 'App not found' });
  const app = db.updateApp(id, req.body);
  res.json({ success: true, app });
});

app.delete('/api/apps/:id', adminAuth, (req, res) => {
  db.deleteApp(parseInt(req.params.id));
  res.json({ success: true });
});

// ─── File uploads ────────────────────────────────────────────────────────

app.post('/api/apps/:id/icon', adminAuth, (req, res) => {
  const id = parseInt(req.params.id);
  if (!db.getApp(id)) return res.status(404).json({ error: 'App not found' });
  const { data } = req.body;
  if (!data) return res.status(400).json({ error: 'No image data' });
  const m = data.match(/^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,(.+)$/);
  if (!m) return res.status(400).json({ error: 'Invalid image format' });
  try {
    const ext = m[1] === 'svg+xml' ? 'svg' : m[1];
    const filename = 'app_' + id + '.' + ext;
    fs.writeFileSync(path.join(PUBLIC_DIR, 'icons', filename), m[2], 'base64');
    const url = '/icons/' + filename;
    db.setAppIcon(id, url);
    res.json({ success: true, icon_url: url });
  } catch(e) { res.status(400).json({ error: 'Иконка слишком большая.' }); }
});

app.post('/api/apps/:id/appfile', adminAuth, (req, res) => {
  const id = parseInt(req.params.id);
  if (!db.getApp(id)) return res.status(404).json({ error: 'App not found' });
  const { data, name } = req.body;
  if (!data) return res.status(400).json({ error: 'No file data' });
  const m = data.match(/^data:application\/octet-stream;base64,(.+)$/);
  const raw = !m ? (data.split(',')[1] || data) : m[1];
  try {
    const filename = (name || 'app_' + id + '.msi').replace(/[^a-zA-Z0-9._-]/g, '_');
    fs.writeFileSync(path.join(PUBLIC_DIR, 'apps', filename), raw, 'base64');
    const url = '/apps/' + filename;
    db.setAppFile(id, url);
    res.json({ success: true, file_url: url });
  } catch(e) { res.status(400).json({ error: 'Файл слишком большой.' }); }
});

app.post('/api/apps/:id/screenshots', adminAuth, (req, res) => {
  const id = parseInt(req.params.id);
  if (!db.getApp(id)) return res.status(404).json({ error: 'App not found' });
  const { data } = req.body;
  if (!data) return res.status(400).json({ error: 'No image data' });
  const m = data.match(/^data:image\/(png|jpeg|jpg|gif|webp);base64,(.+)$/);
  if (!m) return res.status(400).json({ error: 'Invalid image format' });
  try {
    const count = db.getScreenshots(id).length + 1;
    const filename = 'ss_' + id + '_' + count + '.png';
    fs.writeFileSync(path.join(PUBLIC_DIR, 'screenshots', filename), m[2], 'base64');
    db.addScreenshot(id, '/screenshots/' + filename);
    res.json({ success: true });
  } catch(e) { res.status(400).json({ error: 'Скриншот слишком большой.' }); }
});

app.delete('/api/apps/:id/screenshots/:index', adminAuth, (req, res) => {
  const id = parseInt(req.params.id);
  const idx = parseInt(req.params.index);
  const list = db.getScreenshots(id);
  if (idx < 0 || idx >= list.length) return res.status(404).json({ error: 'Screenshot not found' });
  db.deleteScreenshot(id, idx);
  res.json({ success: true });
});

// ─── Reviews ─────────────────────────────────────────────────────────────

app.get('/api/apps/:id/reviews', (req, res) => {
  res.json(db.getReviews(parseInt(req.params.id)));
});

app.post('/api/apps/:id/reviews', (req, res) => {
  const appId = parseInt(req.params.id);
  if (!db.getApp(appId)) return res.status(404).json({ error: 'App not found' });
  const token = req.headers['x-auth-token'];
  const user = token ? getUserFromToken(token) : null;
  if (!user) return res.status(401).json({ error: 'Требуется вход' });
  const { rating, comment } = req.body;
  if (!rating || !comment) return res.status(400).json({ error: 'Rating and comment required' });
  db.addReview(appId, user.id, user.display_name, user.avatar_url || '', rating, comment);
  const newRating = db.getRating(appId);
  db.updateApp(appId, { rating: newRating });
  res.json({ success: true });
});

app.delete('/api/reviews/:id', adminAuth, (req, res) => {
  db.deleteReview(parseInt(req.params.id));
  res.json({ success: true });
});

// ─── Auth ────────────────────────────────────────────────────────────────

app.post('/api/register', (req, res) => {
  const { username, password, displayName } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const existing = db.getUserByName(username);
  if (existing) return res.status(400).json({ error: 'Username taken' });
  const u = db.createUser(username, hashPassword(password), displayName || username);
  if (!u) return res.status(500).json({ error: 'Registration failed' });
  res.json({ success: true, user: { id: u.id, username: u.username, displayName: u.display_name, avatar_url: u.avatar_url }, token: makeToken(u) });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const u = db.getUserByName(username || '');
  if (!u || u.password !== hashPassword(password || ''))
    return res.status(401).json({ error: 'Invalid username or password' });
  res.json({ success: true, user: { id: u.id, username: u.username, displayName: u.display_name, avatar_url: u.avatar_url }, token: makeToken(u) });
});

app.get('/api/me', (req, res) => {
  const token = req.headers['x-auth-token'];
  if (!token) return res.status(401).json({ error: 'No token' });
  const u = getUserFromToken(token);
  if (!u) return res.status(401).json({ error: 'Invalid token' });
  res.json({ id: u.id, username: u.username, displayName: u.display_name, avatar_url: u.avatar_url });
});

// ─── Submissions ─────────────────────────────────────────────────────────

app.post('/api/submissions', (req, res) => {
  const token = req.headers['x-auth-token'];
  if (!token) return res.status(401).json({ error: 'Требуется вход' });
  const user = getUserFromToken(token);
  if (!user) return res.status(401).json({ error: 'Требуется вход' });
  const { name, developer, description, platform, category, price, icon_data, file_data, file_name, screenshots_data } = req.body;
  if (!name || !developer) return res.status(400).json({ error: 'Название и разработчик обязательны' });
  const sub = db.createSubmission({
    userId: user.id,
    authorName: user.display_name,
    name, developer, description: description || '',
    platform: platform || 'windows',
    category: category || 'other',
    price: price || 'Free',
    icon_data: icon_data || '',
    file_data: file_data || '',
    file_name: file_name || '',
    screenshots_data: screenshots_data || []
  });
  res.json({ success: true, submission: sub });
});

app.put('/api/submissions/:id', adminAuth, (req, res) => {
  const id = parseInt(req.params.id);
  const found = db.getSubmission(id);
  if (!found) return res.status(404).json({ error: 'Заявка не найдена' });
  const { action } = req.body;
  if (action === 'approve') {
    const app = db.createApp({
      name: found.name, developer: found.developer,
      price: found.price || 'Free', rating: 0,
      color_theme: '#0078D7',
      platform: found.platform || 'windows',
      category: found.category || 'other',
      description: found.description || '',
      icon_url: '', file_url: ''
    });
    // Save icon
    if (found.icon_data) {
      try {
        const m = found.icon_data.match(/^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,(.+)$/);
        if (m) {
          const ext = m[1] === 'svg+xml' ? 'svg' : m[1];
          const fn = 'app_' + app.id + '.' + ext;
          fs.writeFileSync(path.join(PUBLIC_DIR, 'icons', fn), m[2], 'base64');
          db.setAppIcon(app.id, '/icons/' + fn);
        }
      } catch(e) { console.error('[icon]', e.message); }
    }
    // Save file
    if (found.file_data) {
      try {
        const raw = found.file_data.split(',')[1] || found.file_data;
        const fn = (found.file_name || 'app_' + app.id + '.msi').replace(/[^a-zA-Z0-9._-]/g, '_');
        fs.writeFileSync(path.join(PUBLIC_DIR, 'apps', fn), raw, 'base64');
        db.setAppFile(app.id, '/apps/' + fn);
      } catch(e) { console.error('[file]', e.message); }
    }
    // Save screenshots
    if (found.screenshots_data && found.screenshots_data.length) {
      try {
        found.screenshots_data.forEach(function(data, i) {
          const m = data.match(/^data:image\/(png|jpeg|jpg|gif|webp);base64,(.+)$/);
          if (m) {
            const fn = 'ss_' + app.id + '_' + (i + 1) + '.png';
            fs.writeFileSync(path.join(PUBLIC_DIR, 'screenshots', fn), m[2], 'base64');
            db.addScreenshot(app.id, '/screenshots/' + fn);
          }
        });
      } catch(e) { console.error('[ss]', e.message); }
    }
    db.updateSubmissionStatus(id, 'approved');
    res.json({ success: true, app: db.getApp(app.id) });
  } else if (action === 'reject') {
    db.updateSubmissionStatus(id, 'rejected');
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Некорректное действие' });
  }
});

app.get('/api/submissions', adminAuth, (req, res) => {
  res.json(db.listSubmissions());
});

// ─── Download ────────────────────────────────────────────────────────────

app.get('/api/apps/:id/download', (req, res) => {
  const found = db.getApp(parseInt(req.params.id));
  if (!found) return res.status(404).json({ error: 'App not found' });
  if (!found.file_url) return res.status(404).json({ error: 'No file uploaded' });
  const fpath = path.join(PUBLIC_DIR, found.file_url.replace(/^\//, ''));
  if (!fs.existsSync(fpath)) return res.status(404).json({ error: 'File not found' });
  res.setHeader('Content-Disposition', 'attachment; filename="' + path.basename(found.file_url) + '"');
  res.setHeader('Content-Type', 'application/octet-stream');
  fs.createReadStream(fpath).pipe(res);
});

// ─── Categories ──────────────────────────────────────────────────────────

app.get('/api/categories', (req, res) => {
  const rows = db.listApps('');
  res.json([...new Set(rows.map(a => a.category))]);
});

// ─── Error handler ───────────────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error('[server]', err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

// ─── Start ───────────────────────────────────────────────────────────────

if (!isVercel) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log('Metro Store running at http://localhost:' + PORT);
    const os = require('os');
    const ifaces = os.networkInterfaces();
    for (const name of Object.keys(ifaces)) {
      for (const iface of ifaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          console.log('Local network: http://' + iface.address + ':' + PORT);
        }
      }
    }
  });
}

module.exports = app;
