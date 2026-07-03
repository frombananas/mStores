(function(){
  if (typeof NodeList !== 'undefined' && !NodeList.prototype.forEach) {
    NodeList.prototype.forEach = Array.prototype.forEach;
  }
  var allApps = [];
  var currentUser = null;
  var currentPlatform = 'android';

  function makeIcon(name, color, size) {
    var initials = name.split(' ').map(function(w){ return w[0]; }).join('').substring(0, 2);
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '"><rect width="' + size + '" height="' + size + '" fill="' + color + '"/><text x="' + (size/2) + '" y="' + (size/2 + 6) + '" text-anchor="middle" fill="white" font-family="Segoe UI,sans-serif" font-size="' + Math.floor(size/3) + '" font-weight="300">' + initials + '</text></svg>';
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  function renderStars(rating) {
    var html = '';
    for (var i = 1; i <= 5; i++) {
      if (rating >= i) html += '<span class="star full"></span>';
      else if (rating >= i - 0.5) html += '<span class="star half"></span>';
      else html += '<span class="star empty"></span>';
    }
    return html;
  }

  function createSpotlightTile(app, delay) {
    var div = document.createElement('div');
    div.className = 'spotlight-tile tile';
    div.style.animationDelay = delay + 'ms';
    div.classList.add('slide-in');
    div.dataset.id = app.id;

    var hero = '';
    if (app.screenshots && app.screenshots.length) {
      hero = '<div class="spotlight-hero"><img src="' + app.screenshots[0] + '" alt=""></div>';
    } else {
      hero = '<div class="spotlight-hero" style="background:' + app.color_theme + ';"><div class="spotlight-hero-placeholder"><span style="color:rgba(255,255,255,0.3);font-size:48px;font-weight:200;">' + app.name + '</span></div></div>';
    }

    var iconHtml = '';
    if (app.icon_url) {
      iconHtml = '<img src="' + app.icon_url + '" alt="">';
    } else {
      var initials = app.name.split(' ').map(function(w){ return w[0]; }).join('').substring(0, 2);
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" fill="' + app.color_theme + '"/><text x="80" y="98" text-anchor="middle" fill="white" font-family="Segoe UI,sans-serif" font-size="60" font-weight="300">' + initials + '</text></svg>';
      iconHtml = '<img src="data:image/svg+xml,' + encodeURIComponent(svg) + '" alt="">';
    }

    div.innerHTML =
      hero +
      '<div class="spotlight-info">' +
        '<div class="spotlight-icon-frame">' + iconHtml + '</div>' +
        '<div class="spotlight-text">' +
          '<span class="spotlight-name">' + app.name + '</span>' +
          '<span class="spotlight-dev">' + app.developer + '</span>' +
          '<div class="spotlight-stars">' + renderStars(app.rating) + '<span class="review-count">(' + (app.reviewCount || 0) + ')</span></div>' +
          '<span class="spotlight-desc">' + (app.description || '') + '</span>' +
        '</div>' +
      '</div>';
    return div;
  }

  function createSurfaceItem(app, delay) {
    var div = document.createElement('div');
    div.className = 'surface-item tile';
    div.style.animationDelay = delay + 'ms';
    div.classList.add('slide-in');
    div.dataset.id = app.id;
    var icon = app.icon_url || makeIcon(app.name, app.color_theme, 80);
    div.innerHTML =
      '<div class="surface-icon"><img src="' + icon + '" width="80" height="80" alt=""></div>' +
      '<div class="surface-info">' +
        '<span class="surface-name">' + app.name + '</span>' +
        '<span class="surface-price">' + app.price + (app.installed ? ' &bull; Установлено' : '') + '</span>' +
        '<div class="surface-rating">' + renderStars(app.rating) + '<span class="review-count"> (' + (app.reviewCount || 0) + ')</span></div>' +
      '</div>';
    return div;
  }

  function createFeaturedTile(app, delay) {
    var div = document.createElement('div');
    div.className = 'featured-tile tile';
    div.style.animationDelay = delay + 'ms';
    div.classList.add('slide-in');
    div.dataset.id = app.id;
    var icon = app.icon_url || makeIcon(app.name, app.color_theme, 130);

    var catMap = {
      social: 'Соцсети', games: 'Игры', productivity: 'Продукты',
      entertainment: 'Развлечения', news: 'Новости', creativity: 'Творчество',
      music: 'Музыка', photo: 'Фото', other: 'Другое'
    };
    var cat = catMap[app.category] || app.category;
    var price = app.price === 'Free' ? 'Бесплатно' : app.price;

    div.innerHTML =
      '<div class="featured-icon"><img src="' + icon + '" width="130" height="130" alt=""></div>' +
      '<span class="featured-name">' + app.name + '</span>' +
      '<span class="featured-price">' + price + '</span>' +
      '<div class="featured-rating-row">' +
        '<div class="featured-stars">' + renderStars(app.rating) + '</div>' +
        '<span class="featured-reviews">' + (app.reviewCount || 0) + '</span>' +
      '</div>' +
      '<span class="featured-category">' + cat + '</span>';
    return div;
  }

  function fetchApps(query) {
    var params = '';
    if (query) params = '?search=' + encodeURIComponent(query);
    return apiFetch('/api/apps' + params).then(function(r){ return r.json(); });
  }

  function fetchApp(id) {
    return apiFetch('/api/apps/' + id).then(function(r){ return r.json(); });
  }

  function installApp(id) {
    return apiFetch('/api/apps/' + id + '/install', { method: 'POST' }).then(function(r){ return r.json(); });
  }

  var currentModalApp = null;

  function openModal(id) {
    fetchApp(id).then(function(app){
      if (!app) return;
      currentModalApp = app;
      var overlay = document.getElementById('modalOverlay');
      var hero = document.getElementById('modalHero');
      hero.style.backgroundColor = app.color_theme;
      var icon = makeIcon(app.name, 'rgba(255,255,255,0.2)', 90);
      document.getElementById('modalHeroIcon').innerHTML = '<img src="' + icon + '" width="90" height="90" alt="">';
      document.getElementById('modalTitle').textContent = app.name;
      document.getElementById('modalDev').textContent = app.developer;
      document.getElementById('modalRating').innerHTML = renderStars(app.rating);
      document.getElementById('modalDesc').textContent = app.description;
      var catMap = { social: 'Соцсети', games: 'Игры', productivity: 'Продукты', entertainment: 'Развлечения', news: 'Новости', creativity: 'Творчество', music: 'Музыка', photo: 'Фото', other: 'Другое' };
      document.getElementById('modalCategory').textContent = catMap[app.category] || app.category;
      document.getElementById('modalPrice').textContent = app.price;
      document.getElementById('modalRatingVal').textContent = app.rating + ' / 5';
      document.getElementById('moreInfoLink').href = 'download.html?id=' + app.id;
      updateInstallBtn(app);
      overlay.classList.add('active');
    });
  }

  function updateInstallBtn(app) {
    var btn = document.getElementById('installBtn');
    if (app.installed) {
      btn.textContent = 'Установлено';
      btn.className = 'install-btn installed';
    } else {
      btn.textContent = 'Установить';
      btn.className = 'install-btn';
    }
  }

  function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
    currentModalApp = null;
  }

  function handleInstall() {
    if (!currentModalApp) return;
    installApp(currentModalApp.id).then(function(result){
      if (result.success) {
        currentModalApp.installed = result.installed;
        updateInstallBtn(currentModalApp);
        for (var i = 0; i < allApps.length; i++) {
          if (allApps[i].id === currentModalApp.id) {
            allApps[i].installed = result.installed;
            break;
          }
        }
      }
    });
  }

  function renderHome(apps) {
    if (currentPlatform) apps = apps.filter(function(a){ return a.platform === currentPlatform; });
    var spotlightEl = document.getElementById('spotlightContainer');
    var surfaceEl = document.getElementById('surfaceList');
    var featuredEl = document.getElementById('featuredGrid');
    var newEl = document.getElementById('newGrid');
    var topFreeEl = document.getElementById('topFreeList');

    spotlightEl.innerHTML = '';
    surfaceEl.innerHTML = '';
    featuredEl.innerHTML = '';
    newEl.innerHTML = '';
    topFreeEl.innerHTML = '';

    if (apps.length === 0) return;

    var sorted = apps.slice().sort(function(a,b){
      if (a.spotlight !== b.spotlight) return b.spotlight - a.spotlight;
      return b.rating - a.rating;
    });
    var spotlightApps = sorted.slice(0, 1);
    var delay = 0;
    var step = 60;
    spotlightApps.forEach(function(app){
      var el = createSpotlightTile(app, delay);
      spotlightEl.appendChild(el);
      delay += step;
    });

    var surfaceApps = apps.slice(1, 9);
    surfaceApps.forEach(function(app){
      var el = createSurfaceItem(app, delay);
      surfaceEl.appendChild(el);
      delay += step;
    });

    var featuredApps = apps.slice(3, 12);
    featuredApps.forEach(function(app){
      var el = createFeaturedTile(app, delay);
      featuredEl.appendChild(el);
      delay += step;
    });

    var newApps = apps.slice(7, 16);
    newApps.forEach(function(app){
      var el = createFeaturedTile(app, delay);
      newEl.appendChild(el);
      delay += step;
    });

    var topFreeApps = apps.filter(function(a){ return a.price === 'Free'; }).slice(0, 8);
    topFreeApps.forEach(function(app){
      var el = createSurfaceItem(app, delay);
      topFreeEl.appendChild(el);
      delay += step;
    });

    document.querySelectorAll('.tile').forEach(function(el){
      el.addEventListener('click', tileClickHandler);
    });
  }

  function tileClickHandler(e) {
    var el = e.currentTarget;
    var id = el.dataset.id;
    if (id) window.location.href = 'download.html?id=' + id;
  }

  function doSearch() {
    var query = document.getElementById('searchInput').value.trim();
    if (!query) {
      showHome();
      return;
    }
    fetchApps(query).then(function(results){
      var track = document.getElementById('panoramaTrack');

      var existing = document.querySelector('.search-section');
      if (existing) existing.remove();

      // Hide normal sections
      track.querySelectorAll('.panorama-section').forEach(function(s){
        s.style.display = 'none';
        s.style.width = '0';
        s.style.minWidth = '0';
        s.style.marginRight = '0';
      });

      var section = document.createElement('div');
      section.className = 'search-section';
      section.style.cssText = 'display:flex;flex-direction:column;min-width:100vw;padding:40px 24px;';

      var header = document.createElement('div');
      header.style.cssText = 'margin-bottom:24px;';

      var title = document.createElement('h2');
      title.className = 'section-title';
      title.style.cssText = 'font-size:1.8rem;font-weight:200;color:#333;margin-bottom:6px;';
      title.textContent = 'Результаты поиска';

      var word = results.length === 1 ? ' результат' : (results.length >= 2 && results.length <= 4 ? ' результата' : ' результатов');
      var info = document.createElement('p');
      info.style.cssText = 'font-size:14px;font-weight:300;color:#777;';
      info.textContent = results.length + word + ' по "' + query + '"';

      header.appendChild(title);
      header.appendChild(info);

      var grid = document.createElement('div');
      grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,150px);gap:16px;';

      results.forEach(function(app, i){
        var el = createFeaturedTile(app, 0);
        el.style.animation = 'none';
        grid.appendChild(el);
      });

      section.appendChild(header);
      section.appendChild(grid);
      track.appendChild(section);

      grid.querySelectorAll('.tile').forEach(function(el){
        el.addEventListener('click', tileClickHandler);
      });

      document.getElementById('panorama').scrollLeft = 0;
    });
  }

  function showHome() {
    var existing = document.querySelector('.search-section');
    if (existing) existing.remove();
    document.querySelectorAll('.panorama-section').forEach(function(s){
      s.style.display = '';
      s.style.width = '';
      s.style.minWidth = '';
      s.style.marginRight = '';
    });
  }

  /* ─── Auth ───────────────────────────────────── */

  function saveToken(token) {
    localStorage.setItem('store_token', token || '');
  }

  function getToken() {
    return localStorage.getItem('store_token') || '';
  }

  function loadUser() {
    var token = getToken();
    if (!token) return;
    apiFetch('/api/me', { headers: { 'x-auth-token': token } })
      .then(function(r){ return r.json(); })
      .then(function(user){
        if (user && user.displayName) setLoggedIn(user);
      }).catch(function(){});
  }

  function setLoggedIn(user) {
    document.getElementById('accountLabel').textContent = user.displayName || user.username;
    // Restore logged-in menu
    var menu = document.getElementById('accountMenu');
    menu.innerHTML = '<button class="account-item" data-action="submit" id="menuSubmit">Подать заявку</button><button class="account-item" data-action="changepass" id="menuChangepass">Сменить пароль</button><button class="account-item" data-action="logout" id="menuLogout">Выйти</button>';
    if (user.username === 'admin') {
      document.getElementById('menuChangepass').style.display = 'none';
    }
    document.getElementById('menuSubmit').addEventListener('click', function(ev){
      ev.stopPropagation();
      menu.style.display = 'none';
      document.getElementById('submitOverlay').style.display = 'flex';
    });
    document.getElementById('menuLogout').addEventListener('click', function(ev){
      ev.stopPropagation();
      menu.style.display = 'none';
      setLoggedOut();
    });
    document.getElementById('menuChangepass').addEventListener('click', function(ev){
      ev.stopPropagation();
      menu.style.display = 'none';
      document.getElementById('authOverlay').classList.add('active');
      document.getElementById('authTitle').textContent = 'Сменить пароль';
      document.getElementById('authFormLogin').style.display = 'none';
      document.getElementById('authFormRegister').style.display = 'none';
      document.getElementById('authFormChangepass').style.display = 'flex';
      document.getElementById('authTabs').style.display = 'none';
      document.getElementById('cpOldPassword').value = '';
      document.getElementById('cpNewPassword').value = '';
      document.getElementById('cpMsg').textContent = '';
    });
    currentUser = user;
  }

  function setLoggedOut() {
    localStorage.removeItem('store_token');
    document.getElementById('accountLabel').textContent = 'Учетная запись';
    document.getElementById('accountMenu').style.display = 'none';
    currentUser = null;
  }

  function openAuth() {
    document.getElementById('authOverlay').classList.add('active');
    document.getElementById('loginMsg').textContent = '';
    document.getElementById('regMsg').textContent = '';
    document.getElementById('cpMsg').textContent = '';
    document.getElementById('authTitle').textContent = 'Metro Store';
    document.getElementById('authFormLogin').style.display = 'flex';
    document.getElementById('authFormRegister').style.display = 'none';
    document.getElementById('authFormChangepass').style.display = 'none';
    document.getElementById('authTabs').style.display = '';
    var loginTab = document.querySelector('.auth-tab[data-tab="login"]');
    var regTab = document.querySelector('.auth-tab[data-tab="register"]');
    if (loginTab) loginTab.classList.add('active');
    if (regTab) regTab.classList.remove('active');
  }

  function initAuth() {
    loadUser();

    // Account dropdown
    document.getElementById('accountBtn').addEventListener('click', function(e){
      e.stopPropagation();
      var token = getToken();
      var menu = document.getElementById('accountMenu');
      if (!token) {
        // Toggle dropdown: show login/register item
        menu.innerHTML = '<button class="account-item" id="menuLoginItem">Войти</button><button class="account-item" id="menuRegisterItem">Регистрация</button>';
        menu.style.display = menu.style.display === 'none' ? '' : 'none';
        document.getElementById('menuLoginItem').addEventListener('click', function(ev){
          ev.stopPropagation();
          menu.style.display = 'none';
          openAuth();
          document.querySelector('.auth-tab[data-tab="login"]').click();
        });
        document.getElementById('menuRegisterItem').addEventListener('click', function(ev){
          ev.stopPropagation();
          menu.style.display = 'none';
          openAuth();
          document.querySelector('.auth-tab[data-tab="register"]').click();
        });
        return;
      }
      menu.style.display = menu.style.display === 'none' ? '' : 'none';
    });

    // Close dropdown on outside click
    document.addEventListener('click', function(){
      document.getElementById('accountMenu').style.display = 'none';
    });

    document.getElementById('authCloseBtn').addEventListener('click', closeAuth);
    document.getElementById('authOverlay').addEventListener('click', function(e){
      if (e.target === this) closeAuth();
    });
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape') closeAuth();
    });

    document.querySelectorAll('.auth-tab').forEach(function(tab){
      tab.addEventListener('click', function(){
        document.querySelectorAll('.auth-tab').forEach(function(t){ t.classList.remove('active'); });
        this.classList.add('active');
        var isLogin = this.dataset.tab === 'login';
        document.getElementById('authFormLogin').style.display = isLogin ? 'flex' : 'none';
        document.getElementById('authFormRegister').style.display = isLogin ? 'none' : 'flex';
        document.getElementById('authFormChangepass').style.display = 'none';
      });
    });

    function handleLogin() {
      var username = document.getElementById('loginUsername').value.trim();
      var password = document.getElementById('loginPassword').value;
      var msg = document.getElementById('loginMsg');
      if (!username || !password) { msg.textContent = 'Заполните все поля'; return; }
      apiFetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username, password: password })
      }).then(function(r){ return r.json(); }).then(function(res){
        if (res.success) {
          saveToken(res.token);
          setLoggedIn(res.user);
        closeAuth();
      } else {
        msg.textContent = res.error;
      }
    }).catch(function(){ msg.textContent = 'Ошибка соединения'; });
  }

  function handleRegister() {
      var username = document.getElementById('regUsername').value.trim();
      var displayName = document.getElementById('regDisplayName').value.trim() || username;
      var password = document.getElementById('regPassword').value;
      var msg = document.getElementById('regMsg');
      if (!username || !password) { msg.textContent = 'Заполните все поля'; return; }
      apiFetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username, displayName: displayName, password: password })
      }).then(function(r){ return r.json(); }).then(function(res){
        if (res.success) {
          saveToken(res.token);
          setLoggedIn(res.user);
        closeAuth();
      } else {
        msg.textContent = res.error;
      }
    }).catch(function(){ msg.textContent = 'Ошибка соединения'; });
  }

    document.getElementById('loginBtn').addEventListener('click', handleLogin);
    document.getElementById('registerBtn').addEventListener('click', handleRegister);

    document.getElementById('loginPassword').addEventListener('keydown', function(e){
      if (e.key === 'Enter') handleLogin();
    });
    document.getElementById('regPassword').addEventListener('keydown', function(e){
      if (e.key === 'Enter') handleRegister();
    });

    document.getElementById('cpBtn').addEventListener('click', function(){
      var oldPw = document.getElementById('cpOldPassword').value;
      var newPw = document.getElementById('cpNewPassword').value;
      var msg = document.getElementById('cpMsg');
      if (!oldPw || !newPw) { msg.textContent = 'Заполните все поля'; return; }
      apiFetch('/api/changepass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': getToken() },
        body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw })
      }).then(function(r){ return r.json(); }).then(function(res){
        if (res.success) {
          msg.style.color = '#008A00';
          msg.textContent = 'Пароль изменён';
        } else {
          msg.style.color = '#E81123';
          msg.textContent = res.error || 'Ошибка';
        }
      }).catch(function(){ msg.textContent = 'Ошибка соединения'; });
    });
  }

  function closeAuth() {
    document.getElementById('authOverlay').classList.remove('active');
    document.getElementById('authFormLogin').style.display = 'flex';
    document.getElementById('authFormRegister').style.display = 'none';
    document.getElementById('authFormChangepass').style.display = 'none';
    document.querySelector('.auth-tab[data-tab="login"]').classList.add('active');
    document.querySelector('.auth-tab[data-tab="register"]').classList.remove('active');
  }

  function loadStats() {
    apiFetch('/api/stats').then(function(r){ return r.json(); }).then(function(s){
      document.getElementById('statsTotal').textContent = s.totalDownloads || 0;
    }).catch(function(){});
  }

  function checkPermission() {
    if (typeof Android === 'undefined') return;
    if (Android.checkInstallPermission()) return;
    var ov = document.getElementById('errOverlay');
    document.getElementById('errTitle').textContent = 'Требуется разрешение';
    document.getElementById('errDesc').textContent = 'Для установки приложений из mStore необходимо разрешить установку из неизвестных источников. Без этого приложения могут не установиться.';
    document.getElementById('errBtn').textContent = 'Открыть настройки';
    ov.style.display = 'flex';
    document.getElementById('errBtn').onclick = function(){
      Android.requestInstallPermission();
    };
    function recheck() {
      if (Android.checkInstallPermission()) {
        ov.style.display = 'none';
        document.removeEventListener('visibilitychange', recheck);
      }
    }
    document.addEventListener('visibilitychange', recheck);
  }

  function init() {
    checkPermission();
    initAuth();

    fetchApps().then(function(apps){
      allApps = apps;
      renderHome(apps);
    });

    loadStats();
    setInterval(loadStats, 5000);

    var panorama = document.getElementById('panorama');
    panorama.addEventListener('wheel', function(e) {
      e.preventDefault();
      panorama.scrollBy({ left: e.deltaY * 5, behavior: 'smooth' });
    }, { passive: false });

    document.getElementById('searchInput').addEventListener('keydown', function(e){
      if (e.key === 'Enter') doSearch();
    });

    document.getElementById('searchInput').addEventListener('input', function(){
      if (!this.value.trim()) {
        showHome();
      }
    });

    document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
    document.getElementById('modalOverlay').addEventListener('click', function(e){
      if (e.target === this) closeModal();
    });
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape') closeModal();
    });
    document.getElementById('installBtn').addEventListener('click', handleInstall);

    document.querySelector('.header-logo').addEventListener('click', function(e){
      e.preventDefault();
      document.getElementById('searchInput').value = '';
      showHome();
      document.getElementById('panorama').scrollLeft = 0;
    });

    // Submit app
    document.getElementById('submitOverlay').addEventListener('click', function(e){
      if (e.target === this) this.style.display = 'none';
    });
    document.getElementById('submitAppBtnSend').addEventListener('click', function(){
      var name = document.getElementById('subName').value.trim();
      var developer = document.getElementById('subDeveloper').value.trim();
      var msg = document.getElementById('submitMsg');
      var btn = this;
      var progressDiv = document.getElementById('submitProgress');
      var progressBar = document.getElementById('submitProgressBar');
      var progressText = document.getElementById('submitProgressText');
      if (!name || !developer) { msg.textContent = 'Название и разработчик обязательны'; return; }
      var token = getToken();
      if (!token) { msg.style.color = '#E81123'; msg.textContent = 'Сначала войдите в аккаунт'; return; }
      btn.textContent = 'Отправка...';
      btn.disabled = true;
      msg.textContent = '';

      var fd = new FormData();
      fd.append('name', name);
      fd.append('developer', developer);
      fd.append('description', document.getElementById('subDescription').value.trim());
      fd.append('platform', document.getElementById('subPlatform').value);
      fd.append('category', document.getElementById('subCategory').value);
      fd.append('price', document.getElementById('subPrice').value.trim() || 'Free');

      var iconInput = document.getElementById('subIcon');
      var fileInput = document.getElementById('subAppFile');
      var ssInput = document.getElementById('subScreenshots');

      if (iconInput && iconInput.files && iconInput.files[0]) {
        fd.append('icon', iconInput.files[0]);
      }
      if (fileInput && fileInput.files && fileInput.files[0]) {
        fd.append('appfile', fileInput.files[0]);
      }
      if (ssInput && ssInput.files) {
        for (var i = 0; i < ssInput.files.length; i++) {
          fd.append('screenshots', ssInput.files[i]);
        }
      }

      progressDiv.style.display = '';
      progressBar.style.width = '0%';
      progressText.textContent = 'Загрузка...';

      var xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/submissions');
      xhr.setRequestHeader('x-auth-token', token);

      xhr.upload.addEventListener('progress', function(e){
        if (e.lengthComputable) {
          var pct = Math.round((e.loaded / e.total) * 100);
          progressBar.style.width = pct + '%';
          progressText.textContent = pct + '%';
        } else {
          progressBar.style.width = '100%';
          progressText.textContent = 'Обработка...';
        }
      });

      xhr.addEventListener('load', function(){
        try {
          var d = JSON.parse(xhr.responseText);
          if (d.success) {
            msg.style.color = '#008A00';
            msg.textContent = 'Заявка отправлена! После модерации приложение появится в магазине.';
            document.getElementById('subName').value = '';
            document.getElementById('subDeveloper').value = '';
            document.getElementById('subDescription').value = '';
            document.getElementById('subPrice').value = 'Free';
            if (iconInput) iconInput.value = '';
            if (fileInput) fileInput.value = '';
            if (ssInput) ssInput.value = '';
          } else {
            msg.style.color = '#E81123';
            msg.textContent = d.error || 'Ошибка';
          }
        } catch(e) {
          msg.style.color = '#E81123';
          msg.textContent = 'Ошибка сервера';
        }
        btn.textContent = 'Отправить';
        btn.disabled = false;
        setTimeout(function(){ progressDiv.style.display = 'none'; }, 2000);
      });

      xhr.addEventListener('error', function(){
        msg.style.color = '#E81123';
        msg.textContent = 'Ошибка соединения';
        btn.textContent = 'Отправить';
        btn.disabled = false;
        progressDiv.style.display = 'none';
      });

      xhr.send(fd);
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
