const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const DB_PATH = process.env.DB_PATH || path.join(
  process.env.DATA_DIR || path.join(__dirname, 'data'),
  'store.db'
);

// Ensure directory
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ──────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS apps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    developer TEXT NOT NULL,
    price TEXT DEFAULT 'Free',
    rating REAL DEFAULT 0,
    color_theme TEXT DEFAULT '#0078D7',
    icon_url TEXT DEFAULT '',
    file_url TEXT DEFAULT '',
    platform TEXT DEFAULT 'windows',
    category TEXT DEFAULT 'other',
    description TEXT DEFAULT '',
    installed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS screenshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id INTEGER NOT NULL,
    url TEXT NOT NULL,
    FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id INTEGER NOT NULL,
    user_id INTEGER,
    author TEXT NOT NULL,
    avatar_url TEXT DEFAULT '',
    rating INTEGER NOT NULL,
    comment TEXT NOT NULL,
    date TEXT NOT NULL,
    FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    author_name TEXT,
    name TEXT NOT NULL,
    developer TEXT NOT NULL,
    description TEXT DEFAULT '',
    platform TEXT DEFAULT 'windows',
    category TEXT DEFAULT 'other',
    price TEXT DEFAULT 'Free',
    status TEXT DEFAULT 'pending',
    icon_data TEXT DEFAULT '',
    file_data TEXT DEFAULT '',
    file_name TEXT DEFAULT '',
    screenshots_data TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now')),
    approved_at TEXT
  );
`);

// Migration: add spotlight column if missing
try { db.exec(`ALTER TABLE apps ADD COLUMN spotlight INTEGER DEFAULT 0`); } catch(e) {}

// ─── Social Tables ─────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    user_id INTEGER PRIMARY KEY,
    first_name TEXT DEFAULT '',
    last_name TEXT DEFAULT '',
    status TEXT DEFAULT '',
    city TEXT DEFAULT '',
    birth_date TEXT DEFAULT '',
    avatar_url TEXT DEFAULT '',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS wall_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    author_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS friends (
    user_id INTEGER NOT NULL,
    friend_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, friend_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// ─── Prepared Statements ────────────────────────────────────────────────

// Apps
const stmtInsertApp = db.prepare(`INSERT INTO apps (name,developer,price,rating,color_theme,icon_url,file_url,platform,category,description) VALUES (@name,@developer,@price,@rating,@color_theme,@icon_url,@file_url,@platform,@category,@description)`);
const stmtUpdateApp = db.prepare(`UPDATE apps SET name=@name,developer=@developer,price=@price,rating=@rating,color_theme=@color_theme,platform=@platform,category=@category,description=@description WHERE id=@id`);
const stmtGetApp = db.prepare(`SELECT * FROM apps WHERE id = ?`);
const stmtAllApps = db.prepare(`SELECT * FROM apps ORDER BY spotlight DESC, id`);
const stmtDeleteApp = db.prepare(`DELETE FROM apps WHERE id = ?`);
const stmtSetIcon = db.prepare(`UPDATE apps SET icon_url = ? WHERE id = ?`);
const stmtSetFile = db.prepare(`UPDATE apps SET file_url = ? WHERE id = ?`);
const stmtSearchApps = db.prepare(`SELECT * FROM apps WHERE name LIKE @q OR developer LIKE @q OR description LIKE @q ORDER BY spotlight DESC, id`);
const stmtSetSpotlight = db.prepare(`UPDATE apps SET spotlight = CASE WHEN spotlight=1 THEN 0 ELSE 1 END WHERE id = ?`);
const stmtUpdateRating = db.prepare(`UPDATE apps SET rating = ? WHERE id = ?`);
const stmtIncDownload = db.prepare(`UPDATE apps SET installed = installed + 1 WHERE id = ?`);
const stmtTotalDownloads = db.prepare(`SELECT SUM(installed) as total FROM apps`);

// Screenshots
const stmtAddSS = db.prepare(`INSERT INTO screenshots (app_id, url) VALUES (?, ?)`);
const stmtGetSS = db.prepare(`SELECT * FROM screenshots WHERE app_id = ? ORDER BY id`);
const stmtDelSS = db.prepare(`DELETE FROM screenshots WHERE app_id = ? AND id = (SELECT id FROM screenshots WHERE app_id = ? ORDER BY id LIMIT 1 OFFSET ?)`);
const stmtDelAllSS = db.prepare(`DELETE FROM screenshots WHERE app_id = ?`);

// Reviews
const stmtAddReview = db.prepare(`INSERT INTO reviews (app_id, user_id, author, avatar_url, rating, comment, date) VALUES (?, ?, ?, ?, ?, ?, ?)`);
const stmtGetReviews = db.prepare(`SELECT * FROM reviews WHERE app_id = ? ORDER BY id DESC`);
const stmtDelReview = db.prepare(`DELETE FROM reviews WHERE id = ?`);
const stmtAvgRating = db.prepare(`SELECT AVG(rating) as avg FROM reviews WHERE app_id = ?`);
const stmtCountReviews = db.prepare(`SELECT COUNT(*) as cnt FROM reviews WHERE app_id = ?`);

// Users
const stmtGetUser = db.prepare(`SELECT * FROM users WHERE id = ?`);
const stmtGetUserByName = db.prepare(`SELECT * FROM users WHERE username = ?`);
const stmtInsertUser = db.prepare(`INSERT INTO users (username, password, display_name, avatar_url) VALUES (?, ?, ?, ?)`);
const stmtChangePass = db.prepare(`UPDATE users SET password = ? WHERE id = ?`);

// Submissions
const stmtInsertSub = db.prepare(`INSERT INTO submissions (user_id,author_name,name,developer,description,platform,category,price,icon_data,file_data,file_name,screenshots_data) VALUES (@uid,@aname,@name,@dev,@desc,@plat,@cat,@price,@icon,@file,@fname,@ss)`);
const stmtGetSub = db.prepare(`SELECT * FROM submissions WHERE id = ?`);
const stmtAllSubs = db.prepare(`SELECT * FROM submissions ORDER BY id DESC`);
const stmtUpdateSubStatus = db.prepare(`UPDATE submissions SET status = ?, approved_at = ? WHERE id = ?`);
const stmtDeleteSub = db.prepare(`DELETE FROM submissions WHERE id = ?`);

// ─── Helpers ─────────────────────────────────────────────────────────────

function appWithScreenshots(row) {
  const ss = stmtGetSS.all(row.id).map(r => r.url);
  const cnt = stmtCountReviews.get(row.id);
  return { ...row, screenshots: ss, reviewCount: cnt ? cnt.cnt : 0 };
}

function subWithScreenshots(row) {
  let ss = [];
  try { ss = JSON.parse(row.screenshots_data || '[]'); } catch {}
  return { ...row, screenshots_data: ss };
}

// ─── Exports ─────────────────────────────────────────────────────────────

module.exports = {
  // Apps
  createApp(data) {
    const info = stmtInsertApp.run(data);
    return stmtGetApp.get(info.lastInsertRowid);
  },
  updateApp(id, data) {
    stmtUpdateApp.run({ ...data, id });
    return stmtGetApp.get(id);
  },
  getApp(id) {
    const row = stmtGetApp.get(id);
    return row ? appWithScreenshots(row) : null;
  },
  listApps(search) {
    if (search) {
      const q = '%' + search + '%';
      return stmtSearchApps.all({ q }).map(appWithScreenshots);
    }
    return stmtAllApps.all().map(appWithScreenshots);
  },
  deleteApp(id) {
    stmtDelAllSS.run(id);
    stmtDeleteApp.run(id);
  },
  setAppIcon(id, url) { stmtSetIcon.run(url, id); },
  setAppFile(id, url) { stmtSetFile.run(url, id); },
  toggleSpotlight(id) { return stmtSetSpotlight.run(id); },
  setRating(id, rating) { return stmtUpdateRating.run(rating, id); },
  incrementDownload(id) { return stmtIncDownload.run(id); },
  totalDownloads() {
    const row = stmtTotalDownloads.get();
    return row ? row.total : 0;
  },

  // Screenshots
  addScreenshot(appId, url) { stmtAddSS.run(appId, url); },
  getScreenshots(appId) { return stmtGetSS.all(appId); },
  deleteScreenshot(appId, index) {
    stmtDelSS.run(appId, appId, index);
  },

  // Reviews
  addReview(appId, userId, author, avatarUrl, rating, comment) {
    const now = new Date().toLocaleDateString('ru-RU');
    const info = stmtAddReview.run(appId, userId || null, author, avatarUrl || '', rating, comment, now);
    return { id: info.lastInsertRowid };
  },
  getReviews(appId) { return stmtGetReviews.all(appId); },
  deleteReview(id) { stmtDelReview.run(id); },
  getRating(appId) {
    const r = stmtAvgRating.get(appId);
    return r.avg ? Math.round(r.avg * 10) / 10 : 0;
  },

  // Users
  getUser(id) { return stmtGetUser.get(id); },
  getUserByName(username) { return stmtGetUserByName.get(username); },
  changePassword(id, passwordHash) { stmtChangePass.run(passwordHash, id); },
  createUser(username, passwordHash, displayName) {
    try {
      const info = stmtInsertUser.run(username, passwordHash, displayName, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSYcH2Ux5jTji1CDmRQ2FHCkWa9BYLAQ9m9bw&s');
      return stmtGetUser.get(info.lastInsertRowid);
    } catch { return null; }
  },

  // Submissions
  createSubmission(data) {
    const info = stmtInsertSub.run({
      uid: data.userId,
      aname: data.authorName,
      name: data.name,
      dev: data.developer,
      desc: data.description || '',
      plat: data.platform || 'windows',
      cat: data.category || 'other',
      price: data.price || 'Free',
      icon: data.icon_data || '',
      file: data.file_data || '',
      fname: data.file_name || '',
      ss: JSON.stringify(data.screenshots_data || [])
    });
    return subWithScreenshots(stmtGetSub.get(info.lastInsertRowid));
  },
  getSubmission(id) {
    const row = stmtGetSub.get(id);
    return row ? subWithScreenshots(row) : null;
  },
  listSubmissions() { return stmtAllSubs.all().map(subWithScreenshots); },
  updateSubmissionStatus(id, status) {
    const approvedAt = status === 'approved' ? new Date().toISOString() : null;
    stmtUpdateSubStatus.run(status, approvedAt, id);
  },
  deleteSubmission(id) { stmtDeleteSub.run(id); },

  // ─── Social ──────────────────────────────────────────────────────────
  getProfile(userId) {
    let p = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId);
    if (!p) {
      const u = this.getUser(userId);
      if (!u) return null;
      db.prepare('INSERT OR IGNORE INTO profiles (user_id, first_name, last_name) VALUES (?, ?, ?)').run(userId, u.display_name, '');
      return { user_id: userId, first_name: u.display_name, last_name: '', status: '', city: '', birth_date: '', avatar_url: u.avatar_url };
    }
    const u = this.getUser(userId);
    if (u) p.avatar_url = p.avatar_url || u.avatar_url;
    return p;
  },
  updateProfile(userId, fields) {
    const keys = Object.keys(fields).filter(k => ['first_name','last_name','status','city','birth_date','avatar_url'].includes(k));
    if (!keys.length) return;
    const sets = keys.map(k => `${k} = ?`).join(', ');
    const vals = keys.map(k => fields[k]);
    db.prepare(`INSERT INTO profiles (user_id, ${keys.join(',')}) VALUES (?, ${keys.map(()=>'?').join(',')}) ON CONFLICT(user_id) DO UPDATE SET ${sets}`).run(userId, ...vals, ...vals);
  },
  getWallPosts(userId) {
    return db.prepare(`SELECT w.*, u.display_name as author_name, u.avatar_url as author_avatar FROM wall_posts w JOIN users u ON w.author_id = u.id WHERE w.user_id = ? ORDER BY w.created_at DESC LIMIT 50`).all(userId);
  },
  addWallPost(userId, authorId, text) {
    return db.prepare('INSERT INTO wall_posts (user_id, author_id, text) VALUES (?, ?, ?)').run(userId, authorId, text);
  },
  getFriends(userId) {
    return db.prepare(`SELECT u.id, u.display_name, u.avatar_url, p.first_name, p.last_name FROM friends f JOIN users u ON f.friend_id = u.id LEFT JOIN profiles p ON u.id = p.user_id WHERE f.user_id = ?`).all(userId);
  },
  addFriend(userId, friendId) {
    db.prepare('INSERT OR IGNORE INTO friends (user_id, friend_id) VALUES (?, ?)').run(userId, friendId);
    db.prepare('INSERT OR IGNORE INTO friends (user_id, friend_id) VALUES (?, ?)').run(friendId, userId);
  },
  removeFriend(userId, friendId) {
    db.prepare('DELETE FROM friends WHERE user_id = ? AND friend_id = ?').run(userId, friendId);
    db.prepare('DELETE FROM friends WHERE user_id = ? AND friend_id = ?').run(friendId, userId);
  },
  searchPeople(query) {
    return db.prepare(`SELECT u.id, u.display_name, u.avatar_url FROM users u WHERE u.display_name LIKE ? LIMIT 20`).all(`%${query}%`);
  },
};
