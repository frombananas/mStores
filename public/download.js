(function(){

  function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function renderStars(rating) {
    var s = '';
    for (var i = 1; i <= 5; i++) {
      if (rating >= i) s += '\u2605';
      else if (rating >= i - 0.5) s += '\u00BD';
      else s += '\u2606';
    }
    return s;
  }

  function loadAppData() {
    var id = getQueryParam('id');
    if (!id) {
      document.title = 'О приложении';
      document.getElementById('appTitle').textContent = 'Название приложения';
      return;
    }

    currentAppId = id;

    fetch('/api/apps/' + id)
      .then(function(r){ return r.json(); })
      .then(function(app){
        if (!app) return;

        document.title = app.name + ' — подробнее';
        document.getElementById('appTitle').textContent = app.name;
        document.getElementById('appDescription').textContent = app.description;
        document.getElementById('publisher').textContent = app.developer;
        document.getElementById('copyright').textContent = '\u00A9 ' + new Date().getFullYear() + ' ' + app.developer + '. Все права защищены.';
        var p = app.platform || '';
        var platMap = { android: 'Android', iphone: 'iPhone', 'windows phone': 'Windows Phone', windows: 'Windows' };
        document.getElementById('appPlatform').textContent = platMap[app.platform] || p || '—';
        var catMap = { social: 'Соцсети', games: 'Игры', productivity: 'Продукты', entertainment: 'Развлечения', news: 'Новости', creativity: 'Творчество', music: 'Музыка', photo: 'Фото', other: 'Другое' };
        document.getElementById('appCategory').textContent = catMap[app.category] || app.category;
        document.getElementById('appPrice').textContent = app.price;
        document.getElementById('appRating').textContent = app.rating + ' ' + renderStars(app.rating);
        document.getElementById('fileSize').textContent = (12 + (app.id % 20)) + '.' + (app.id * 3 % 10) + ' MB';

        var iconEl = document.getElementById('appIconHeader');
        if (app.icon_url) {
          iconEl.src = app.icon_url;
          iconEl.style.display = 'inline-block';
        } else {
          iconEl.style.display = 'none';
        }

        currentAppFileUrl = app.file_url || null;
        showScreenshots(app.screenshots || [], app.color_theme);
      })
      .catch(function(){
        document.getElementById('appDescription').textContent = 'Не удалось загрузить информацию о приложении.';
      });
  }

  function showScreenshots(screenshots, color) {
    var mainImg = document.getElementById('heroImg');
    var thumbs = document.getElementById('screenshotThumbs');
    thumbs.innerHTML = '';

    if (!screenshots.length) {
      var bg = color || '#1da84c';
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="' + bg + '"/><text x="200" y="155" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-family="Segoe UI,sans-serif" font-size="18" font-weight="200">Нет скриншотов</text></svg>';
      mainImg.src = 'data:image/svg+xml,' + encodeURIComponent(svg);
      return;
    }

    mainImg.src = screenshots[0];
    screenshots.forEach(function(url, i){
      var thumb = document.createElement('img');
      thumb.src = url;
      thumb.className = 'ss-thumb' + (i === 0 ? ' active' : '');
      thumb.addEventListener('click', function(){
        mainImg.src = url;
        thumbs.querySelectorAll('.ss-thumb').forEach(function(t){ t.classList.remove('active'); });
        thumb.classList.add('active');
      });
      thumbs.appendChild(thumb);
    });
  }

  var currentAppId = null;
  var currentAppFileUrl = null;
  var selectedRating = 0;

  function loadReviews() {
    var id = getQueryParam('id');
    if (!id) return;
    currentAppId = id;
    fetch('/api/apps/' + id + '/reviews')
      .then(function(r){ return r.json(); })
      .then(function(list){
        var el = document.getElementById('reviewsList');
        if (!el) return;
        el.innerHTML = '';
        if (!list.length) {
          el.innerHTML = '<p style="color:#999;font-size:13px;font-weight:300;">Ещё нет отзывов. Будьте первым!</p>';
          return;
        }
        list.forEach(function(r){
          var card = document.createElement('div');
          card.className = 'review-card';
          var starsHtml = '';
          for (var i = 1; i <= 5; i++) {
            starsHtml += '<span class="rstar' + (i <= r.rating ? ' active' : '') + '">&#9733;</span>';
          }
          var avatar = r.avatar_url || '';
          card.innerHTML =
            '<div class="review-avatar-wrap"><img src="' + avatar + '" alt="" class="review-avatar"></div>' +
            '<div class="review-body">' +
              '<div class="review-author">' + esc(r.author) + '<span class="review-date">' + r.date + '</span></div>' +
              '<div class="review-stars-display">' + starsHtml + '</div>' +
              '<div class="review-comment">' + esc(r.comment) + '</div>' +
            '</div>';
          el.appendChild(card);
        });
      });
  }

  function getToken() {
    return localStorage.getItem('store_token') || '';
  }

  function getCurrentUser() {
    var token = getToken();
    if (!token) return null;
    try {
      var raw = atob(token);
      var parts = raw.split(':');
      return { id: parseInt(parts[0]), username: parts[1] };
    } catch { return null; }
  }

  function fetchCurrentUser(cb) {
    var token = getToken();
    if (!token) { cb(null); return; }
    fetch('/api/me', { headers: { 'x-auth-token': token } })
      .then(function(r){ return r.json(); })
      .then(function(u){ cb(u); })
      .catch(function(){ cb(null); });
  }

  function initReviewForm() {
    var stars = document.querySelectorAll('#reviewStars .rstar');
    stars.forEach(function(s){
      s.addEventListener('click', function(){
        selectedRating = parseInt(this.dataset.v);
        stars.forEach(function(x){ x.classList.toggle('active', parseInt(x.dataset.v) <= selectedRating); });
      });
      s.addEventListener('mouseenter', function(){
        var v = parseInt(this.dataset.v);
        stars.forEach(function(x){ x.classList.toggle('hover', parseInt(x.dataset.v) <= v); });
      });
      s.addEventListener('mouseleave', function(){
        stars.forEach(function(x){ x.classList.remove('hover'); });
      });
    });

    fetchCurrentUser(function(user){
      if (user) {
        document.getElementById('reviewAuthorDisplay').style.display = 'block';
        document.getElementById('reviewAuthorName').textContent = user.displayName;
      }
    });

    document.getElementById('reviewSubmitBtn').addEventListener('click', submitReview);
  }

  function submitReview() {
    var comment = document.getElementById('reviewComment').value.trim();
    var msg = document.getElementById('reviewMsg');
    var token = getToken();
    if (!token) { msg.innerHTML = 'Чтобы оставить отзыв, <a href="/" class="link-purple" style="cursor:pointer;">войдите</a>'; return; }
    if (!selectedRating) { msg.textContent = 'Выберите оценку'; return; }
    if (!comment) { msg.textContent = 'Напишите комментарий'; return; }

    var headers = { 'Content-Type': 'application/json' };
    if (token) headers['x-auth-token'] = token;

    fetch('/api/apps/' + currentAppId + '/reviews', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ rating: selectedRating, comment: comment })
    }).then(function(r){ return r.json(); }).then(function(res){
      if (res.success) {
        msg.textContent = 'Отзыв отправлен!';
        document.getElementById('reviewComment').value = '';
        selectedRating = 0;
        document.querySelectorAll('#reviewStars .rstar').forEach(function(x){ x.classList.remove('active'); });
        loadReviews();
        setTimeout(function(){ msg.textContent = ''; }, 3000);
      } else {
        msg.textContent = 'Ошибка при отправке отзыва';
      }
    });
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  function handleBack() {
    var page = document.querySelector('.page');
    if (page) page.classList.add('slide-out');
    setTimeout(function() {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = '/';
      }
    }, 250);
  }

  function handleDownload() {
    var btn = document.getElementById('downloadBtn');

    if (btn.classList.contains('done')) return;

    if (!currentAppFileUrl) {
      btn.textContent = 'Файл недоступен';
      btn.classList.add('done');
      return;
    }

    var a = document.createElement('a');
    a.href = '/api/apps/' + currentAppId + '/download';
    a.download = '';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){ document.body.removeChild(a); }, 200);

    btn.textContent = 'Скачано';
    btn.classList.add('done');
  }

  function init() {
    loadAppData();

    var id = getQueryParam('id');
    if (id) { loadReviews(); initReviewForm(); }

    document.getElementById('backBtn').addEventListener('click', handleBack);
    document.getElementById('downloadBtn').addEventListener('click', handleDownload);

    document.querySelectorAll('.link-purple').forEach(function(el){
      el.addEventListener('click', function(e){
        e.preventDefault();
        var href = this.getAttribute('href');
        if (href && href !== '#') window.open(href, '_blank');
      });
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
