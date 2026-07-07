(function(){
var currentUser = null;
var token = localStorage.getItem('vk_token');

function api(url, opts) {
  opts = opts || {};
  if (token) {
    opts.headers = opts.headers || {};
    opts.headers['x-auth-token'] = token;
  }
  return apiFetch(url, opts);
}

function initAuth() {
  if (!token) { showAuth(); return; }
  api('/api/social/me').then(function(profile){
    if (!profile || profile.error) { showAuth(); return; }
    currentUser = profile;
    document.getElementById('authOverlay').classList.remove('active');
    document.getElementById('headerRight').innerHTML =
      '<span style="color:#fff;font-size:13px;">' + profile.first_name + '</span>' +
      '<a href="#" id="logoutLink" style="color:rgba(255,255,255,0.7);font-size:12px;">Выйти</a>' +
      '<a href="../index.html" style="color:#fff;font-size:13px;">Магазин</a>';
    document.getElementById('logoutLink').addEventListener('click', function(e){
      e.preventDefault();
      localStorage.removeItem('vk_token');
      token = null;
      location.reload();
    });
    loadProfile(currentUser);
  }).catch(function(){ showAuth(); });
}

function showAuth() {
  document.getElementById('authOverlay').classList.add('active');
}

document.getElementById('loginBtn').addEventListener('click', function(){
  var u = document.getElementById('loginUser').value.trim();
  var p = document.getElementById('loginPass').value;
  if (!u || !p) { document.getElementById('loginMsg').textContent = 'Заполните все поля'; return; }
  apiFetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: u, password: p })
  }).then(function(res){
    if (res.success) {
      token = res.token;
      localStorage.setItem('vk_token', token);
      location.reload();
    } else {
      document.getElementById('loginMsg').textContent = res.error || 'Ошибка';
    }
  });
});

document.getElementById('registerBtn').addEventListener('click', function(){
  var u = document.getElementById('regUser').value.trim();
  var n = document.getElementById('regName').value.trim();
  var p = document.getElementById('regPass').value;
  if (!u || !n || !p) { document.getElementById('regMsg').textContent = 'Заполните все поля'; return; }
  apiFetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: u, displayName: n, password: p })
  }).then(function(res){
    if (res.success) {
      token = res.token;
      localStorage.setItem('vk_token', token);
      location.reload();
    } else {
      document.getElementById('regMsg').textContent = res.error || 'Ошибка';
    }
  });
});

document.querySelectorAll('.vk-tab').forEach(function(tab){
  tab.addEventListener('click', function(){
    document.querySelectorAll('.vk-tab').forEach(function(t){ t.classList.remove('active'); });
    this.classList.add('active');
    var isLogin = this.dataset.tab === 'login';
    document.getElementById('loginForm').style.display = isLogin ? '' : 'none';
    document.getElementById('registerForm').style.display = isLogin ? 'none' : '';
  });
});

// Navigation
document.querySelectorAll('.vk-menu-item').forEach(function(item){
  item.addEventListener('click', function(e){
    e.preventDefault();
    document.querySelectorAll('.vk-menu-item').forEach(function(i){ i.classList.remove('active'); });
    this.classList.add('active');
    var page = this.dataset.page;
    if (page === 'profile') loadProfile(currentUser);
    else if (page === 'friends') loadFriends();
    else if (page === 'search') loadSearch();
    else if (page === 'news') loadNews();
  });
});

// Profile page
function loadProfile(user) {
  var c = document.getElementById('mainContent');
  if (!user) user = currentUser;
  c.innerHTML =
    '<div class="profile-header">' +
      '<div class="profile-avatar" style="background:' + stringToColor(user.first_name || '?') + '">' +
        (user.avatar_url ? '<img src="' + user.avatar_url + '" alt="">' : '<span>' + (user.first_name || '?')[0] + '</span>') +
      '</div>' +
      '<div class="profile-info">' +
        '<h2>' + esc(user.first_name) + ' ' + esc(user.last_name || '') + '</h2>' +
        '<div class="status">' + esc(user.status || '') + '</div>' +
        '<div class="detail">' + (user.city ? 'Город: ' + esc(user.city) : '') + '</div>' +
        '<div class="detail">' + (user.birth_date ? 'День рождения: ' + esc(user.birth_date) : '') + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="wall">' +
      '<div class="wall-post-form">' +
        '<div class="wall-post-avatar" style="background:' + stringToColor(currentUser.first_name) + '">' +
          (currentUser.avatar_url ? '<img src="' + currentUser.avatar_url + '" alt="">' : '<span>' + currentUser.first_name[0] + '</span>') +
        '</div>' +
        '<textarea id="postText" placeholder="Что у вас нового?"></textarea>' +
        '<button class="vk-btn" id="postBtn">Отправить</button>' +
      '</div>' +
      '<div id="wallPosts">Загрузка...</div>' +
    '</div>';

  document.getElementById('postBtn').addEventListener('click', function(){
    var text = document.getElementById('postText').value.trim();
    if (!text) return;
    api('/api/social/posts', { method: 'POST', body: JSON.stringify({ userId: user.user_id, text: text }) }).then(function(){
      document.getElementById('postText').value = '';
      loadWallPosts(user.user_id);
    });
  });

  loadWallPosts(user.user_id);
}

function loadWallPosts(userId) {
  api('/api/social/posts/' + userId).then(function(posts){
    var el = document.getElementById('wallPosts');
    if (!el) return;
    if (!posts || !posts.length) { el.innerHTML = '<p style="color:#939393;padding:12px 0;">Нет записей</p>'; return; }
    el.innerHTML = posts.map(function(p){
      return '<div class="wall-post">' +
        '<div class="wall-post-header">' +
          '<div class="wall-post-avatar" style="background:' + stringToColor(p.author_name) + '">' +
            (p.author_avatar ? '<img src="' + p.author_avatar + '" alt="">' : '<span>' + p.author_name[0] + '</span>') +
          '</div>' +
          '<div><div class="wall-post-name">' + esc(p.author_name) + '</div><div class="wall-post-date">' + p.created_at + '</div></div>' +
        '</div>' +
        '<div class="wall-post-text">' + esc(p.text) + '</div>' +
      '</div>';
    }).join('');
  });
}

// Friends page
function loadFriends() {
  var c = document.getElementById('mainContent');
  c.innerHTML = '<div class="page-title">Друзья</div><div class="friends-grid" id="friendsGrid">Загрузка...</div>';
  api('/api/social/me').then(function(p){
    var el = document.getElementById('friendsGrid');
    if (!p.friends || !p.friends.length) { el.innerHTML = '<p style="color:#939393;padding:12px;">Нет друзей</p>'; return; }
    el.innerHTML = p.friends.map(function(f){
      return '<div class="friend-card" data-id="' + f.id + '">' +
        '<div class="friend-avatar" style="background:' + stringToColor(f.display_name) + '">' +
          (f.avatar_url ? '<img src="' + f.avatar_url + '" alt="">' : '<span>' + f.display_name[0] + '</span>') +
        '</div>' +
        '<span class="friend-name">' + esc(f.display_name) + '</span>' +
      '</div>';
    }).join('');
    document.querySelectorAll('.friend-card').forEach(function(card){
      card.addEventListener('click', function(){
        loadUserProfile(this.dataset.id);
      });
    });
  });
}

// Search page
function loadSearch() {
  var c = document.getElementById('mainContent');
  c.innerHTML =
    '<div class="page-title">Поиск людей</div>' +
    '<div style="display:flex;gap:8px;margin-bottom:12px;">' +
      '<input type="text" id="searchPeople" class="vk-input" placeholder="Введите имя..." style="flex:1;">' +
      '<button class="vk-btn" id="searchPeopleBtn">Найти</button>' +
    '</div>' +
    '<div class="friends-grid" id="searchResults"></div>';

  document.getElementById('searchPeopleBtn').addEventListener('click', doSearch);
  document.getElementById('searchPeople').addEventListener('keydown', function(e){ if(e.key==='Enter') doSearch(); });

  function doSearch() {
    var q = document.getElementById('searchPeople').value.trim();
    if (!q) return;
    api('/api/social/search?q=' + encodeURIComponent(q)).then(function(list){
      var el = document.getElementById('searchResults');
      if (!list || !list.length) { el.innerHTML = '<p style="color:#939393;padding:12px;">Никого не найдено</p>'; return; }
      el.innerHTML = list.map(function(u){
        return '<div class="friend-card" data-id="' + u.id + '">' +
          '<div class="friend-avatar" style="background:' + stringToColor(u.display_name) + '">' +
            (u.avatar_url ? '<img src="' + u.avatar_url + '" alt="">' : '<span>' + u.display_name[0] + '</span>') +
          '</div>' +
          '<span class="friend-name">' + esc(u.display_name) + '</span>' +
          '<button class="vk-btn vk-btn-gray add-friend-btn" data-id="' + u.id + '" style="margin-left:auto;">Добавить</button>' +
        '</div>';
      }).join('');
      document.querySelectorAll('.add-friend-btn').forEach(function(btn){
        btn.addEventListener('click', function(e){
          e.stopPropagation();
          api('/api/social/friends/' + this.dataset.id, { method: 'POST' }).then(function(){
            btn.textContent = '✓';
            btn.disabled = true;
          });
        });
      });
      document.querySelectorAll('#searchResults .friend-card').forEach(function(card){
        card.addEventListener('click', function(){ loadUserProfile(this.dataset.id); });
      });
    });
  }
}

// Another user's profile
function loadUserProfile(userId) {
  api('/api/social/user/' + userId).then(function(user){
    var c = document.getElementById('mainContent');
    document.querySelectorAll('.vk-menu-item').forEach(function(i){ i.classList.remove('active'); });
    c.innerHTML =
      '<div class="profile-header">' +
        '<div class="profile-avatar" style="background:' + stringToColor(user.first_name || '?') + '">' +
          (user.avatar_url ? '<img src="' + user.avatar_url + '" alt="">' : '<span>' + (user.first_name || '?')[0] + '</span>') +
        '</div>' +
        '<div class="profile-info">' +
          '<h2>' + esc(user.first_name) + ' ' + esc(user.last_name || '') + '</h2>' +
          '<div class="status">' + esc(user.status || '') + '</div>' +
          '<div class="profile-actions">' +
            '<button class="vk-btn" id="addFriendBtn">Добавить в друзья</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="wall"><div id="userWallPosts">Загрузка...</div></div>';

    document.getElementById('addFriendBtn').addEventListener('click', function(){
      api('/api/social/friends/' + userId, { method: 'POST' }).then(function(){
        document.getElementById('addFriendBtn').textContent = '✓ Заявка отправлена';
        document.getElementById('addFriendBtn').disabled = true;
      });
    });
    loadUserWallPosts(userId);
  });
}

function loadUserWallPosts(userId) {
  api('/api/social/posts/' + userId).then(function(posts){
    var el = document.getElementById('userWallPosts');
    if (!el) return;
    if (!posts || !posts.length) { el.innerHTML = '<p style="color:#939393;padding:12px 0;">Нет записей</p>'; return; }
    el.innerHTML = posts.map(function(p){
      return '<div class="wall-post">' +
        '<div class="wall-post-header">' +
          '<div class="wall-post-avatar" style="background:' + stringToColor(p.author_name) + '">' +
            (p.author_avatar ? '<img src="' + p.author_avatar + '" alt="">' : '<span>' + p.author_name[0] + '</span>') +
          '</div>' +
          '<div><div class="wall-post-name">' + esc(p.author_name) + '</div><div class="wall-post-date">' + p.created_at + '</div></div>' +
        '</div>' +
        '<div class="wall-post-text">' + esc(p.text) + '</div>' +
      '</div>';
    }).join('');
  });
}

function loadNews() {
  var c = document.getElementById('mainContent');
  c.innerHTML = '<div class="page-title">Новости</div><div id="newsFeed">Загрузка...</div>';
  api('/api/social/me').then(function(p){
    if (!p.friends || !p.friends.length) {
      document.getElementById('newsFeed').innerHTML = '<p style="color:#939393;">Добавьте друзей, чтобы видеть новости</p>';
      return;
    }
    var feed = document.getElementById('newsFeed');
    feed.innerHTML = '';
    var loaded = 0;
    p.friends.forEach(function(f){
      api('/api/social/posts/' + f.id).then(function(posts){
        if (posts && posts.length) {
          posts.forEach(function(post){
            var div = document.createElement('div');
            div.className = 'wall-post';
            div.style.background = '#fff';
            div.style.borderRadius = '4px';
            div.style.padding = '12px';
            div.style.marginBottom = '8px';
            div.innerHTML =
              '<div class="wall-post-header">' +
                '<div class="wall-post-avatar" style="background:' + stringToColor(post.author_name) + '">' +
                  (post.author_avatar ? '<img src="' + post.author_avatar + '" alt="">' : '<span>' + post.author_name[0] + '</span>') +
                '</div>' +
                '<div><div class="wall-post-name">' + esc(post.author_name) + '</div><div class="wall-post-date">' + post.created_at + '</div></div>' +
              '</div>' +
              '<div class="wall-post-text">' + esc(post.text) + '</div>';
            feed.appendChild(div);
          });
        }
        loaded++;
        if (loaded === p.friends.length && !feed.children.length) {
          feed.innerHTML = '<p style="color:#939393;">Пока нет новостей</p>';
        } else {
          var loadEl = feed.querySelector('.loading-msg');
          if (loadEl) loadEl.remove();
        }
      });
    });
  });
}

function esc(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function stringToColor(s) {
  var h = 0;
  for (var i = 0; i < (s || '?').length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  var colors = ['#4a76a8','#e74c3c','#2ecc71','#e67e22','#9b59b6','#1abc9c','#f1c40f','#e91e63','#00bcd4','#795548'];
  return colors[Math.abs(h) % colors.length];
}

document.addEventListener('DOMContentLoaded', initAuth);
})();
