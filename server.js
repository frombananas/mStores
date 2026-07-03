const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const app = express();
const PORT = process.env.PORT || 3000;
const isVercel = !!process.env.VERCEL;
const DATA_DIR = process.env.DATA_DIR || (isVercel ? '/tmp/data' : path.join(__dirname, 'data'));
const PUBLIC_DIR = process.env.PUBLIC_DIR || (isVercel ? '/tmp/public' : path.join(__dirname, 'public'));

// Set DB_PATH before requiring db
process.env.DB_PATH = path.join(DATA_DIR, 'store.db');
const db = require('./db');

app.use(express.json({ limit: '100mb' }));
app.use(express.static(path.join(__dirname, 'public')));
if (PUBLIC_DIR !== path.join(__dirname, 'public')) {
  app.use(express.static(PUBLIC_DIR));
}

// Ensure directories
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const uploadsDir = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
['icons', 'apps', 'screenshots'].forEach(dir => {
  const p = path.join(PUBLIC_DIR, dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

const LOG_FILE = path.join(DATA_DIR, 'server.log');
function log(msg) {
  const line = '[' + new Date().toISOString() + '] ' + msg + '\n';
  fs.appendFileSync(LOG_FILE, line, 'utf8');
  console.log(line.trim());
}

const ul = multer({ storage: multer.diskStorage({
  destination: function(req, file, cb) { cb(null, uploadsDir); },
  filename: function(req, file, cb) { cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname || '')); }
}), limits: { fileSize: 500 * 1024 * 1024 } });

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

const STORE_URL = process.env.STORE_URL || 'https://mstores.45.38.143.196.nip.io';

function fixAssetUrls(app) {
  if (app.icon_url && !app.icon_url.startsWith('http')) app.icon_url = STORE_URL + app.icon_url;
  if (app.screenshots) app.screenshots = app.screenshots.map(function(url) {
    return url && !url.startsWith('http') ? STORE_URL + url : url;
  });
  return app;
}

app.get('/api/apps', (req, res) => {
  const list = db.listApps(req.query.search || req.query.q || '');
  res.json(list.map(fixAssetUrls));
});

app.get('/api/apps/:id', (req, res) => {
  const app = db.getApp(parseInt(req.params.id));
  if (!app) return res.status(404).json({ error: 'App not found' });
  if (app.file_url) {
    const fpath = path.join(PUBLIC_DIR, app.file_url.replace(/^\//, ''));
    try { app.file_size = fs.statSync(fpath).size; } catch(e) { app.file_size = 0; }
  }
  res.json(fixAssetUrls(app));
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

app.post('/api/apps/:id/spotlight', adminAuth, (req, res) => {
  const id = parseInt(req.params.id);
  if (!db.getApp(id)) return res.status(404).json({ error: 'App not found' });
  db.toggleSpotlight(id);
  const app = db.getApp(id);
  log('SPOTLIGHT app#' + id + ' -> ' + (app.spotlight ? 'ON' : 'OFF'));
  res.json({ success: true, app });
});

// ─── File uploads ────────────────────────────────────────────────────────

app.post('/api/apps/:id/icon', adminAuth, ul.single('icon'), (req, res) => {
  const id = parseInt(req.params.id);
  if (!db.getApp(id)) return res.status(404).json({ error: 'App not found' });
  if (!req.file) return res.status(400).json({ error: 'No file' });
  try {
    const ext = path.extname(req.file.originalname).replace(/^\./, '').toLowerCase() || 'png';
    const filename = 'app_' + id + '.' + ext;
    fs.renameSync(req.file.path, path.join(PUBLIC_DIR, 'icons', filename));
    const url = '/icons/' + filename;
    db.setAppIcon(id, url);
    log('ICON uploaded app#' + id + ' ' + req.file.originalname + ' (' + (req.file.size / 1024 / 1024).toFixed(1) + 'MB)');
    res.json({ success: true, icon_url: url });
  } catch(e) { res.status(400).json({ error: 'Иконка слишком большая.' }); }
});

app.post('/api/apps/:id/appfile', adminAuth, ul.single('appfile'), (req, res) => {
  const id = parseInt(req.params.id);
  if (!db.getApp(id)) return res.status(404).json({ error: 'App not found' });
  if (!req.file) return res.status(400).json({ error: 'No file' });
  try {
    const filename = (req.file.originalname || 'app_' + id + '.msi').replace(/[^a-zA-Z0-9._-]/g, '_');
    fs.renameSync(req.file.path, path.join(PUBLIC_DIR, 'apps', filename));
    const url = '/apps/' + filename;
    db.setAppFile(id, url);
    log('FILE uploaded app#' + id + ' ' + filename + ' (' + (req.file.size / 1024 / 1024).toFixed(1) + 'MB)');
    res.json({ success: true, file_url: url });
  } catch(e) { res.status(400).json({ error: 'Файл слишком большой.' }); }
});

app.post('/api/apps/:id/screenshots', adminAuth, ul.array('screenshots', 20), (req, res) => {
  const id = parseInt(req.params.id);
  if (!db.getApp(id)) return res.status(404).json({ error: 'App not found' });
  if (!req.files || !req.files.length) return res.status(400).json({ error: 'No files' });
  try {
    req.files.forEach(function(file, i) {
      const count = db.getScreenshots(id).length + 1;
      const filename = 'ss_' + id + '_' + count + '.png';
      fs.renameSync(file.path, path.join(PUBLIC_DIR, 'screenshots', filename));
      db.addScreenshot(id, '/screenshots/' + filename);
    });
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
  db.setRating(appId, newRating);
  log('REVIEW app#' + appId + ' by ' + user.display_name + ' ' + rating + '★');
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

app.post('/api/changepass', (req, res) => {
  const token = req.headers['x-auth-token'];
  if (!token) return res.status(401).json({ error: 'No token' });
  const u = getUserFromToken(token);
  if (!u) return res.status(401).json({ error: 'Invalid token' });
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) return res.status(400).json({ error: 'Заполните все поля' });
  if (u.password !== hashPassword(oldPassword)) return res.status(400).json({ error: 'Неверный старый пароль' });
  db.changePassword(u.id, hashPassword(newPassword));
  res.json({ success: true });
});

// ─── Submissions ─────────────────────────────────────────────────────────

const submissionUpload = multer({ storage: multer.diskStorage({
  destination: function(req, file, cb) { cb(null, uploadsDir); },
  filename: function(req, file, cb) { cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname || '')); }
}), limits: { fileSize: 500 * 1024 * 1024 } }).fields([
  { name: 'icon', maxCount: 1 },
  { name: 'appfile', maxCount: 1 },
  { name: 'screenshots', maxCount: 20 }
]);

app.post('/api/submissions', (req, res) => {
  submissionUpload(req, res, function(err) {
    if (err) return res.status(400).json({ error: err.message });
    const token = req.headers['x-auth-token'];
    if (!token) return res.status(401).json({ error: 'Требуется вход' });
    const user = getUserFromToken(token);
    if (!user) return res.status(401).json({ error: 'Требуется вход' });
    const { name, developer, description, platform, category, price } = req.body;
    if (!name || !developer) return res.status(400).json({ error: 'Название и разработчик обязательны' });
    let iconData = '';
    let fileData = '';
    let fileName = '';
    let screenshotsData = [];
    try {
      if (req.files && req.files.icon && req.files.icon[0]) {
        const ext = path.extname(req.files.icon[0].originalname).replace(/^\./, '').toLowerCase() || 'png';
        const fn = (user.id || 'u') + '_icon_' + Date.now() + '.' + ext;
        fs.renameSync(req.files.icon[0].path, path.join(uploadsDir, fn));
        iconData = fn;
      }
      if (req.files && req.files.appfile && req.files.appfile[0]) {
        fileName = req.files.appfile[0].originalname || '';
        const fn = (user.id || 'u') + '_app_' + Date.now() + path.extname(fileName);
        fs.renameSync(req.files.appfile[0].path, path.join(uploadsDir, fn));
        fileData = fn;
      }
      if (req.files && req.files.screenshots) {
        req.files.screenshots.forEach(function(ss, i) {
          const fn = (user.id || 'u') + '_ss_' + Date.now() + '_' + i + '.png';
          fs.renameSync(ss.path, path.join(uploadsDir, fn));
          screenshotsData.push(fn);
        });
      }
    } catch(e) {
      return res.status(400).json({ error: 'Файл слишком большой.' });
    }
    const sub = db.createSubmission({
      userId: user.id,
      authorName: user.display_name,
      name, developer, description: description || '',
      platform: platform || 'windows',
      category: category || 'other',
      price: price || 'Free',
      icon_data: iconData,
      file_data: fileData,
      file_name: fileName,
      screenshots_data: screenshotsData
    });
    log('SUBMIT #' + sub.id + ' ' + name + ' by ' + user.display_name);
    res.json({ success: true, submission: sub });
  });
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
        const src = path.join(uploadsDir, found.icon_data);
        if (fs.existsSync(src)) {
          const ext = path.extname(found.icon_data).replace(/^\./, '').toLowerCase() || 'png';
          const fn = 'app_' + app.id + '.' + ext;
          fs.copyFileSync(src, path.join(PUBLIC_DIR, 'icons', fn));
          db.setAppIcon(app.id, '/icons/' + fn);
        }
      } catch(e) { console.error('[icon]', e.message); }
    }
    // Save file
    if (found.file_data) {
      try {
        const src = path.join(uploadsDir, found.file_data);
        if (fs.existsSync(src)) {
          const fn = (found.file_name || 'app_' + app.id + '.msi').replace(/[^a-zA-Z0-9._-]/g, '_');
          fs.copyFileSync(src, path.join(PUBLIC_DIR, 'apps', fn));
          db.setAppFile(app.id, '/apps/' + fn);
        }
      } catch(e) { console.error('[file]', e.message); }
    }
    // Save screenshots
    if (found.screenshots_data && found.screenshots_data.length) {
      try {
        found.screenshots_data.forEach(function(name, i) {
          const src = path.join(uploadsDir, name);
          if (fs.existsSync(src)) {
            const fn = 'ss_' + app.id + '_' + (i + 1) + '.png';
            fs.copyFileSync(src, path.join(PUBLIC_DIR, 'screenshots', fn));
            db.addScreenshot(app.id, '/screenshots/' + fn);
          }
        });
      } catch(e) { console.error('[ss]', e.message); }
    }
    db.updateSubmissionStatus(id, 'approved');
    log('APPROVE #' + id + ' → app#' + app.id + ' ' + found.name);
    res.json({ success: true, app: db.getApp(app.id) });
  } else if (action === 'reject') {
    // Delete submission completely
    if (found.icon_data) {
      try { const p = path.join(uploadsDir, found.icon_data); if (fs.existsSync(p)) fs.unlinkSync(p); } catch(e) {}
    }
    if (found.file_data) {
      try { const p = path.join(uploadsDir, found.file_data); if (fs.existsSync(p)) fs.unlinkSync(p); } catch(e) {}
    }
    if (found.screenshots_data && found.screenshots_data.length) {
      found.screenshots_data.forEach(function(name) {
        try { const p = path.join(uploadsDir, name); if (fs.existsSync(p)) fs.unlinkSync(p); } catch(e) {}
      });
    }
    db.deleteSubmission(id);
    log('DELETE submission #' + id + ' ' + found.name);
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
  db.incrementDownload(parseInt(req.params.id));
  log('DOWNLOAD app#' + req.params.id + ' ' + found.name);
  res.setHeader('Content-Disposition', 'attachment; filename="' + path.basename(found.file_url) + '"');
  res.setHeader('Content-Type', 'application/octet-stream');
  fs.createReadStream(fpath).pipe(res);
});

app.get('/api/stats', (req, res) => {
  res.json({ totalDownloads: db.totalDownloads() });
});

// ─── Categories ──────────────────────────────────────────────────────────

app.get('/api/categories', (req, res) => {
  const rows = db.listApps('');
  res.json([...new Set(rows.map(a => a.category))]);
});

// ─── Logs ────────────────────────────────────────────────────────────────

app.get('/api/logs', adminAuth, (req, res) => {
  if (!fs.existsSync(LOG_FILE)) return res.json([]);
  const lines = fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n').slice(-200);
  res.json(lines);
});

// ─── Deploy (HTTP-based pull+restart, works without SSH) ──────────────────

app.post('/__deploy', adminAuth, (req, res) => {
  const { execSync } = require('child_process');
  try {
    const out1 = execSync('cd /opt/mStores && git pull origin main 2>&1').toString();
    const out2 = execSync('cd /opt/mStores && npm install --omit=dev 2>&1').toString();
    res.json({ success: true, git: out1, npm: out2 });
    setTimeout(() => process.exit(0), 500);
  } catch(e) {
    res.status(500).json({ error: e.toString() });
  }
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
