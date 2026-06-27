const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '500mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');

function saveData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, 'apps.json'), JSON.stringify(apps));
  fs.writeFileSync(path.join(DATA_DIR, 'reviews.json'), JSON.stringify(reviews));
  fs.writeFileSync(path.join(DATA_DIR, 'users.json'), JSON.stringify(users));
  fs.writeFileSync(path.join(DATA_DIR, 'submissions.json'), JSON.stringify(submissions));
  fs.writeFileSync(path.join(DATA_DIR, 'counters.json'), JSON.stringify({ nextAppId, nextReviewId, nextUserId, nextSubmissionId }));
}

function loadData() {
  if (!fs.existsSync(DATA_DIR)) return;
  try {
    const a = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'apps.json'), 'utf8'));
    if (a) { apps.length = 0; a.forEach(x => apps.push(x)); }
  } catch {}
  try {
    const r = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'reviews.json'), 'utf8'));
    if (r) { reviews.length = 0; r.forEach(x => reviews.push(x)); }
  } catch {}
  try {
    const u = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'users.json'), 'utf8'));
    if (u) { users.length = 0; u.forEach(x => users.push(x)); }
  } catch {}
  try {
    const s = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'submissions.json'), 'utf8'));
    if (s) { submissions.length = 0; s.forEach(x => submissions.push(x)); }
  } catch {}
  try {
    const c = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'counters.json'), 'utf8'));
    if (c) { nextAppId = c.nextAppId || 1; nextReviewId = c.nextReviewId || 1; nextUserId = c.nextUserId || 1; nextSubmissionId = c.nextSubmissionId || 1; }
  } catch {}
}

let nextAppId = 1;
let nextReviewId = 1;
let nextUserId = 1;
let nextSubmissionId = 1;

const apps = [];

const reviews = [];

const users = [];

const submissions = [];

loadData();

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
['icons', 'apps', 'screenshots'].forEach(function(dir) {
  const p = path.join(__dirname, 'public', dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

function hashPassword(pw) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(pw).digest('hex');
}

function makeToken(user) {
  const raw = user.id + ':' + user.username + ':' + Date.now();
  return Buffer.from(raw).toString('base64');
}

function getUserFromToken(token) {
  try {
    const raw = Buffer.from(token, 'base64').toString('utf8');
    const parts = raw.split(':');
    const id = parseInt(parts[0]);
    return users.find(u => u.id === id);
  } catch { return null; }
}

// ─── Auth ─────────────────────────────────────────────────────────────────

app.post('/api/register', (req, res) => {
  const { username, password, displayName } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  if (username.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters' });
  if (password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
  if (users.find(u => u.username === username)) return res.status(409).json({ error: 'Username already taken' });
  const avatar_url = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR5huors2BmL35-tFrF2_ojZW0bJ4YPK5tV5yvIvSsGTtiC1mqWGpWhf8w&s=10';
  const user = {
    id: nextUserId++,
    username,
    password: hashPassword(password),
    displayName: displayName || username,
    avatar_url,
    createdAt: new Date().toISOString()
  };
  users.push(user);
  saveData();
  const token = makeToken(user);
  res.json({ success: true, token, user: { id: user.id, username: user.username, displayName: user.displayName, avatar_url } });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const user = users.find(u => u.username === username);
  if (!user || user.password !== hashPassword(password)) return res.status(401).json({ error: 'Invalid username or password' });
  const token = makeToken(user);
  res.json({ success: true, token, user: { id: user.id, username: user.username, displayName: user.displayName, avatar_url: user.avatar_url } });
});

app.get('/api/me', (req, res) => {
  const token = req.headers['x-auth-token'];
  if (!token) return res.status(401).json({ error: 'No token' });
  const user = getUserFromToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid token' });
  res.json({ id: user.id, username: user.username, displayName: user.displayName, avatar_url: user.avatar_url });
});

// ─── Apps ───────────────────────────────────────────────────────────────

app.get('/api/apps', (req, res) => {
  const { search, category } = req.query;
  let result = apps;
  if (search) {
    const q = search.toLowerCase();
    result = result.filter(a => a.name.toLowerCase().includes(q) || a.developer.toLowerCase().includes(q));
  }
  if (category) result = result.filter(a => a.category === category);
  const withReviews = result.map(a => {
    const count = reviews.filter(r => r.appId === a.id).length;
    return Object.assign({}, a, { reviewCount: count });
  });
  res.json(withReviews);
});

app.get('/api/apps/:id', (req, res) => {
  const found = apps.find(a => a.id === parseInt(req.params.id));
  if (!found) return res.status(404).json({ error: 'App not found' });
  res.json(found);
});

app.post('/api/apps/:id/install', (req, res) => {
  const found = apps.find(a => a.id === parseInt(req.params.id));
  if (!found) return res.status(404).json({ error: 'App not found' });
  found.installed = !found.installed;
  saveData();
  res.json({ success: true, installed: found.installed, app: found });
});

// ─── Admin CRUD ─────────────────────────────────────────────────────────

function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (token !== 'U9NegNSvJM3WYBFu') return res.status(401).json({ error: 'Unauthorized' });
  next();
}

app.post('/api/apps', adminAuth, (req, res) => {
  const { name, developer, price, rating, color_theme, platform, category, description } = req.body;
  if (!name || !developer) return res.status(400).json({ error: 'Name and developer required' });
  const app = {
    id: nextAppId++,
    name, developer,
    price: price || 'Free',
    rating: rating || 0,
    color_theme: color_theme || '#0078D7',
    icon_url: '',
    platform: platform || 'android',
    category: category || 'other',
    installed: false,
    screenshots: [],
    description: description || ''
  };
  apps.push(app);
  saveData();
  res.json({ success: true, app });
});

app.put('/api/apps/:id', adminAuth, (req, res) => {
  const found = apps.find(a => a.id === parseInt(req.params.id));
  if (!found) return res.status(404).json({ error: 'App not found' });
  const { name, developer, price, rating, color_theme, platform, category, description } = req.body;
  if (name !== undefined) found.name = name;
  if (developer !== undefined) found.developer = developer;
  if (price !== undefined) found.price = price;
  if (rating !== undefined) found.rating = rating;
  if (color_theme !== undefined) found.color_theme = color_theme;
  if (platform !== undefined) found.platform = platform;
  if (category !== undefined) found.category = category;
  if (description !== undefined) found.description = description;
  saveData();
  res.json({ success: true, app: found });
});

app.delete('/api/apps/:id', adminAuth, (req, res) => {
  const idx = apps.findIndex(a => a.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'App not found' });
  apps.splice(idx, 1);
  saveData();
  res.json({ success: true });
});

// ─── File uploads ───────────────────────────────────────────────────────

app.post('/api/apps/:id/icon', adminAuth, (req, res) => {
  const found = apps.find(a => a.id === parseInt(req.params.id));
  if (!found) return res.status(404).json({ error: 'App not found' });
  const { data } = req.body;
  if (!data) return res.status(400).json({ error: 'No image data' });
  const matches = data.match(/^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,(.+)$/);
  if (!matches) return res.status(400).json({ error: 'Invalid image format' });
  const ext = matches[1] === 'svg+xml' ? 'svg' : matches[1];
  const buffer = Buffer.from(matches[2], 'base64');
  const filename = 'app_' + found.id + '.' + ext;
  const filepath = path.join(__dirname, 'public', 'icons', filename);
  fs.writeFileSync(filepath, buffer);
  found.icon_url = '/icons/' + filename;
  saveData();
  res.json({ success: true, icon_url: found.icon_url });
});

app.post('/api/apps/:id/appfile', adminAuth, (req, res) => {
  const found = apps.find(a => a.id === parseInt(req.params.id));
  if (!found) return res.status(404).json({ error: 'App not found' });
  const { data, name } = req.body;
  if (!data) return res.status(400).json({ error: 'No file data' });
  const matches = data.match(/^data:application\/octet-stream;base64,(.+)$/);
  if (!matches) {
    const fallback = data.split(',')[1] || data;
    const buffer = Buffer.from(fallback, 'base64');
    const filename = (name || 'app_' + found.id + '.msi').replace(/[^a-zA-Z0-9._-]/g, '_');
    const filepath = path.join(__dirname, 'public', 'apps', filename);
    fs.writeFileSync(filepath, buffer);
    found.file_url = '/apps/' + filename;
    saveData();
    return res.json({ success: true, file_url: found.file_url });
  }
  const buffer = Buffer.from(matches[1], 'base64');
  const filename = (name || 'app_' + found.id + '.msi').replace(/[^a-zA-Z0-9._-]/g, '_');
  const filepath = path.join(__dirname, 'public', 'apps', filename);
  fs.writeFileSync(filepath, buffer);
  found.file_url = '/apps/' + filename;
  saveData();
  res.json({ success: true, file_url: found.file_url });
});

app.post('/api/apps/:id/screenshots', adminAuth, (req, res) => {
  const found = apps.find(a => a.id === parseInt(req.params.id));
  if (!found) return res.status(404).json({ error: 'App not found' });
  const { data } = req.body;
  if (!data) return res.status(400).json({ error: 'No image data' });
  const matches = data.match(/^data:image\/(png|jpeg|jpg|gif|webp);base64,(.+)$/);
  if (!matches) return res.status(400).json({ error: 'Invalid image format' });
  const buffer = Buffer.from(matches[2], 'base64');
  const count = (found.screenshots || []).length + 1;
  const filename = 'ss_' + found.id + '_' + count + '.png';
  const filepath = path.join(__dirname, 'public', 'screenshots', filename);
  fs.writeFileSync(filepath, buffer);
  if (!found.screenshots) found.screenshots = [];
  found.screenshots.push('/screenshots/' + filename);
  saveData();
  res.json({ success: true, screenshots: found.screenshots });
});

app.delete('/api/apps/:id/screenshots/:index', adminAuth, (req, res) => {
  const found = apps.find(a => a.id === parseInt(req.params.id));
  if (!found) return res.status(404).json({ error: 'App not found' });
  const idx = parseInt(req.params.index);
  if (!found.screenshots || idx < 0 || idx >= found.screenshots.length) return res.status(404).json({ error: 'Screenshot not found' });
  found.screenshots.splice(idx, 1);
  saveData();
  res.json({ success: true, screenshots: found.screenshots });
});

// ─── Submissions ──────────────────────────────────────────────────────

app.post('/api/submissions', (req, res) => {
  const token = req.headers['x-auth-token'];
  if (!token) return res.status(401).json({ error: 'Требуется вход' });
  const user = getUserFromToken(token);
  if (!user) return res.status(401).json({ error: 'Требуется вход' });
  const { name, developer, description, platform, category, price, icon_data, file_data, file_name, screenshots_data } = req.body;
  if (!name || !developer) return res.status(400).json({ error: 'Название и разработчик обязательны' });
  const sub = {
    id: nextSubmissionId++,
    userId: user.id,
    authorName: user.displayName,
    name, developer, description: description || '',
    platform: platform || 'windows',
    category: category || 'other',
    price: price || 'Free',
    status: 'pending',
    icon_data: icon_data || '',
    file_data: file_data || '',
    file_name: file_name || '',
    screenshots_data: Array.isArray(screenshots_data) ? screenshots_data : [],
    createdAt: new Date().toISOString()
  };
  submissions.push(sub);
  saveData();
  res.json({ success: true, submission: sub });
});

app.put('/api/submissions/:id', adminAuth, (req, res) => {
  const found = submissions.find(s => s.id === parseInt(req.params.id));
  if (!found) return res.status(404).json({ error: 'Заявка не найдена' });
  const { action } = req.body; // 'approve' or 'reject'
  if (action === 'approve') {
    // Create app from submission
    const appId = nextAppId++;
    const app = {
      id: appId,
      name: found.name,
      developer: found.developer,
      price: found.price || 'Free',
      rating: 0,
      color_theme: '#0078D7',
      icon_url: '',
      platform: found.platform || 'windows',
      category: found.category || 'other',
      file_url: '',
      installed: false,
      screenshots: [],
      description: found.description || ''
    };

    // Save icon if provided
    if (found.icon_data) {
      try {
        const matches = found.icon_data.match(/^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,(.+)$/);
        if (matches) {
          const ext = matches[1] === 'svg+xml' ? 'svg' : matches[1];
          const buffer = Buffer.from(matches[2], 'base64');
          const filename = 'app_' + appId + '.' + ext;
          const filepath = path.join(__dirname, 'public', 'icons', filename);
          fs.writeFileSync(filepath, buffer);
          app.icon_url = '/icons/' + filename;
        }
      } catch(e) { console.error('[icon]', e.message); }
    }

    // Save app file if provided
    if (found.file_data) {
      try {
        const fallback = found.file_data.split(',')[1] || found.file_data;
        const buffer = Buffer.from(fallback, 'base64');
        const safeName = (found.file_name || 'app_' + appId + '.msi');
        const filename = safeName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filepath = path.join(__dirname, 'public', 'apps', filename);
        fs.writeFileSync(filepath, buffer);
        app.file_url = '/apps/' + filename;
      } catch(e) { console.error('[file]', e.message); }
    }

    // Save screenshots if provided
    if (found.screenshots_data && found.screenshots_data.length) {
      try {
        const ssDir = path.join(__dirname, 'public', 'screenshots');
        found.screenshots_data.forEach(function(data, i) {
          const matches = data.match(/^data:image\/(png|jpeg|jpg|gif|webp);base64,(.+)$/);
          if (matches) {
            const buffer = Buffer.from(matches[2], 'base64');
            const filename = 'ss_' + appId + '_' + (i + 1) + '.png';
            const filepath = path.join(ssDir, filename);
            fs.writeFileSync(filepath, buffer);
            app.screenshots.push('/screenshots/' + filename);
          }
        });
      } catch(e) { console.error('[screenshots]', e.message); }
    }

    apps.push(app);
    found.status = 'approved';
    found.approvedAt = new Date().toISOString();
    saveData();
    res.json({ success: true, app });
  } else if (action === 'reject') {
    found.status = 'rejected';
    saveData();
    res.json({ success: true, submission: found });
  } else {
    res.status(400).json({ error: 'Некорректное действие' });
  }
});

app.get('/api/submissions', adminAuth, (req, res) => {
  res.json(submissions.slice().reverse());
});

// ─── Reviews ────────────────────────────────────────────────────────────

app.get('/api/apps/:id/reviews', (req, res) => {
  const appReviews = reviews.filter(r => r.appId === parseInt(req.params.id));
  res.json(appReviews);
});

app.post('/api/apps/:id/reviews', (req, res) => {
  const found = apps.find(a => a.id === parseInt(req.params.id));
  if (!found) return res.status(404).json({ error: 'App not found' });
  let author = req.body.author;
  let avatar_url = '';
  const token = req.headers['x-auth-token'];
  if (token) {
    const user = getUserFromToken(token);
    if (user) { author = user.displayName; avatar_url = user.avatar_url || ''; }
  }
  const { rating, comment } = req.body;
  if (!author || !comment || !rating) return res.status(400).json({ error: 'author, rating and comment required' });
  const review = {
    id: nextReviewId++,
    appId: parseInt(req.params.id),
    author: author.substring(0, 30),
    avatar_url,
    rating: Math.min(5, Math.max(1, parseInt(rating))),
    comment: comment.substring(0, 500),
    date: new Date().toISOString().split('T')[0]
  };
  reviews.push(review);
  saveData();
  res.json({ success: true, review });
});

app.delete('/api/reviews/:id', adminAuth, (req, res) => {
  const idx = reviews.findIndex(r => r.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Review not found' });
  reviews.splice(idx, 1);
  saveData();
  res.json({ success: true });
});

app.get('/api/categories', (req, res) => {
  res.json([...new Set(apps.map(a => a.category))]);
});

// ─── Download ─────────────────────────────────────────────────────────────

app.get('/api/apps/:id/download', (req, res) => {
  const found = apps.find(a => a.id === parseInt(req.params.id));
  if (!found) return res.status(404).json({ error: 'App not found' });
  if (!found.file_url) return res.status(404).json({ error: 'No file uploaded' });
  const filepath = path.join(__dirname, 'public', found.file_url.replace(/^\//, ''));
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'File not found' });
  const filename = path.basename(found.file_url);
  res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
  res.setHeader('Content-Type', 'application/octet-stream');
  fs.createReadStream(filepath).pipe(res);
});

// Global error handler — always return JSON
app.use((err, req, res, next) => {
  console.error('[server]', err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

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

  // Tunnel via localtunnel npm
  try {
    const lt = require('localtunnel');
    lt({ port: PORT }).then(tunnel => {
      console.log('Public URL: ' + tunnel.url);
      fs.writeFileSync(path.join(__dirname, 'public_url.txt'), tunnel.url, 'utf8');
      tunnel.on('close', () => {
        console.log('[tunnel] closed');
      });
    }).catch(err => {
      console.log('[tunnel] error: ' + err.message);
    });
  } catch(e) {
    console.log('[tunnel] not available');
  }
});
