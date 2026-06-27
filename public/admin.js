(function(){
  var TOKEN = '';
  var currentIconData = null;
  var currentFileData = null;
  var currentFileName = '';
  var currentScreenshots = [];
  var currentExistingScreenshots = [];

  function api(path, opts) {
    opts = opts || {};
    var headers = { 'Content-Type': 'application/json' };
    if (TOKEN) headers['x-admin-token'] = TOKEN;
    return fetch(path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function(r){
      return r.text().then(function(text){
        try { return JSON.parse(text); }
        catch(e) { throw new Error('Ошибка сервера: ' + text.slice(0,200)); }
      });
    });
  }

  function login() {
    var pass = document.getElementById('adminPass').value;
    TOKEN = pass;
    api('/api/apps').then(function(apps){
      if (Array.isArray(apps)) {
        localStorage.setItem('metro_admin_token', TOKEN);
        showPanel();
        renderApps(apps);
      } else {
        document.getElementById('loginError').textContent = 'Неверный пароль';
        TOKEN = '';
      }
    });
  }

  function showPanel() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('panelScreen').style.display = '';
    loadSubmissions();
  }

  function loadSubmissions() {
    api('/api/submissions').then(function(list){
      if (!Array.isArray(list)) return;
      var tbody = document.getElementById('submissionsBody');
      tbody.innerHTML = '';
      list.forEach(function(s){
        var tr = document.createElement('tr');
        var statusClass = s.status === 'pending' ? 'status-pending' : (s.status === 'approved' ? 'status-approved' : 'status-rejected');
        var actionsHtml = '';
        if (s.status === 'pending') {
          actionsHtml = '<button class="admin-btn admin-btn-small admin-btn-green" onclick="approveSub(' + s.id + ')">Approve</button> ' +
            '<button class="admin-btn admin-btn-small admin-btn-red" onclick="rejectSub(' + s.id + ')">Reject</button>';
        } else {
          actionsHtml = '<span style="font-size:12px;color:#888;">' + s.status + '</span>';
        }
        tr.innerHTML =
          '<td>' + s.id + '</td>' +
          '<td>' + esc(s.authorName || '–') + '</td>' +
          '<td>' + esc(s.name) + '</td>' +
          '<td>' + esc(s.developer) + '</td>' +
          '<td>' + esc(s.platform) + '</td>' +
          '<td class="' + statusClass + '">' + s.status + '</td>' +
          '<td class="actions">' + actionsHtml + '</td>';
        tbody.appendChild(tr);
      });
    });
  }

  window.approveSub = function(id) {
    api('/api/submissions/' + id, { method: 'PUT', body: { action: 'approve' } }).then(function(r){
      if (r.success) { loadSubmissions(); refreshList(); alert('Приложение одобрено и добавлено в магазин'); }
    });
  };

  window.rejectSub = function(id) {
    api('/api/submissions/' + id, { method: 'PUT', body: { action: 'reject' } }).then(function(r){
      if (r.success) { loadSubmissions(); alert('Заявка отклонена'); }
    });
  };

  function renderApps(list) {
    var tbody = document.getElementById('appsBody');
    tbody.innerHTML = '';
    list.forEach(function(app){
      var tr = document.createElement('tr');
      var iconHtml = app.icon_url ? '<img src="' + app.icon_url + '" width="24" height="24" alt="" style="vertical-align:middle;margin-right:4px;">' : '';
      tr.innerHTML =
        '<td>' + app.id + '</td>' +
        '<td>' + iconHtml + esc(app.name) + '</td>' +
        '<td>' + esc(app.developer) + '</td>' +
        '<td>' + esc(app.platform || 'android') + '</td>' +
        '<td>' + esc(app.category) + '</td>' +
        '<td>' + esc(app.price) + '</td>' +
        '<td>' + app.rating + '</td>' +
        '<td class="actions">' +
          '<button class="admin-btn admin-btn-small" onclick="editApp(' + app.id + ')">Edit</button>' +
          '<button class="admin-btn admin-btn-small admin-btn-red" onclick="deleteApp(' + app.id + ')">Delete</button>' +
        '</td>';
      tbody.appendChild(tr);
    });
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  window.editApp = function(id) {
    currentIconData = null;
    currentFileData = null;
    currentFileName = '';
    currentScreenshots = [];
    currentExistingScreenshots = [];
    document.getElementById('screenshotsPreview').innerHTML = '';
    api('/api/apps/' + id).then(function(app){
      document.getElementById('editId').value = app.id;
      document.getElementById('fName').value = app.name;
      document.getElementById('fDeveloper').value = app.developer;
      document.getElementById('fPrice').value = app.price;
      document.getElementById('fRating').value = app.rating;
      document.getElementById('fCategory').value = app.category;
      document.getElementById('fPlatform').value = app.platform || 'android';
      document.getElementById('fColor').value = app.color_theme;
      document.getElementById('fDesc').value = app.description;
      var preview = document.getElementById('iconPreview');
      var img = document.getElementById('iconPreviewImg');
      if (app.icon_url) {
        img.src = app.icon_url;
        preview.style.display = '';
      } else {
        preview.style.display = 'none';
      }
      document.getElementById('fileInfo').textContent = app.file_url ? 'Загружен: ' + app.file_url : '';
      var ssPreview = document.getElementById('screenshotsPreview');
      ssPreview.innerHTML = '';
      if (app.screenshots && app.screenshots.length) {
        currentExistingScreenshots = app.screenshots.slice();
        app.screenshots.forEach(function(url, i){
          var wrap = document.createElement('div');
          wrap.style.position = 'relative';
          wrap.innerHTML = '<img src="' + url + '" width="100" height="70" alt="" style="border:1px solid #ddd;object-fit:cover;">' +
            '<button type="button" style="position:absolute;top:-6px;right:-6px;width:18px;height:18px;background:#E81123;color:#fff;border:none;font-size:11px;line-height:18px;text-align:center;cursor:pointer;" data-idx="' + i + '">&times;</button>';
          ssPreview.appendChild(wrap);
        });
        ssPreview.querySelectorAll('button').forEach(function(btn){
          btn.addEventListener('click', function(){
            var idx = parseInt(this.dataset.idx);
            currentExistingScreenshots.splice(idx, 1);
            this.parentElement.remove();
          });
        });
      }
      document.getElementById('appModalTitle').textContent = 'Редактировать';
      document.getElementById('formSubmit').textContent = 'Сохранить';
      document.getElementById('appModalOverlay').style.display = 'flex';
    });
  };

  window.deleteApp = function(id) {
    if (!confirm('Удалить это приложение?')) return;
    api('/api/apps/' + id, { method: 'DELETE' }).then(function(res){
      if (res.success) refreshList();
    });
  };

  function refreshList() {
    api('/api/apps').then(renderApps);
  }

  function openAddForm() {
    currentIconData = null;
    currentFileData = null;
    currentFileName = '';
    currentScreenshots = [];
    currentExistingScreenshots = [];
    document.getElementById('editId').value = '';
    document.getElementById('fName').value = '';
    document.getElementById('fDeveloper').value = '';
    document.getElementById('fPrice').value = 'Free';
    document.getElementById('fRating').value = '0';
    document.getElementById('fCategory').value = 'social';
    document.getElementById('fPlatform').value = 'android';
    document.getElementById('fColor').value = '#0078D7';
    document.getElementById('fDesc').value = '';
    document.getElementById('iconPreview').style.display = 'none';
    document.getElementById('fileInfo').textContent = '';
    document.getElementById('screenshotsPreview').innerHTML = '';
    document.getElementById('appModalTitle').textContent = 'Добавить приложение';
    document.getElementById('formSubmit').textContent = 'Добавить';
    document.getElementById('appModalOverlay').style.display = 'flex';
  }

  function closeForm() {
    document.getElementById('appModalOverlay').style.display = 'none';
    currentIconData = null;
    currentFileData = null;
    currentFileName = '';
    currentScreenshots = [];
    currentExistingScreenshots = [];
  }

  function readFileAsDataURL(file, cb) {
    var reader = new FileReader();
    reader.onload = function(){ cb(reader.result); };
    reader.readAsDataURL(file);
  }

  function submitForm(e) {
    e.preventDefault();
    var btn = document.getElementById('formSubmit');
    btn.textContent = 'Сохранение...';
    btn.disabled = true;
    var id = document.getElementById('editId').value;
    var data = {
      name: document.getElementById('fName').value,
      developer: document.getElementById('fDeveloper').value,
      price: document.getElementById('fPrice').value,
      rating: parseFloat(document.getElementById('fRating').value) || 0,
      platform: document.getElementById('fPlatform').value || 'android',
      category: document.getElementById('fCategory').value || 'other',
      color_theme: document.getElementById('fColor').value || '#0078D7',
      description: document.getElementById('fDesc').value
    };
    var method = id ? 'PUT' : 'POST';
    var url = id ? '/api/apps/' + id : '/api/apps';
    api(url, { method: method, body: data }).then(function(res){
      if (!res.success) { btn.textContent = id ? 'Сохранить' : 'Добавить'; btn.disabled = false; alert('Ошибка: ' + (res.error || 'неизвестно')); return; }
      var appId = res.app ? res.app.id : id;
      var chain = Promise.resolve();
      if (currentIconData) {
        chain = chain.then(function(){
          return api('/api/apps/' + appId + '/icon', { method: 'POST', body: { data: currentIconData } });
        });
      }
      if (currentFileData) {
        chain = chain.then(function(){
          return api('/api/apps/' + appId + '/appfile', { method: 'POST', body: { data: currentFileData, name: currentFileName } });
        });
      }
      currentScreenshots.forEach(function(ss){
        chain = chain.then(function(){
          return api('/api/apps/' + appId + '/screenshots', { method: 'POST', body: { data: ss } });
        });
      });
      chain.then(function(){
        closeForm();
        refreshList();
        btn.textContent = id ? 'Сохранить' : 'Добавить';
        btn.disabled = false;
      }).catch(function(err){
        btn.textContent = id ? 'Сохранить' : 'Добавить';
        btn.disabled = false;
        alert('Приложение создано, но ошибка при загрузке файлов: ' + (err && err.message ? err.message : 'неизвестная ошибка'));
      });
    }).catch(function(err){
      btn.textContent = id ? 'Сохранить' : 'Добавить';
      btn.disabled = false;
      alert('Ошибка сервера: ' + (err && err.message ? err.message : 'неизвестная ошибка'));
    });
  }

  function init() {
    var saved = localStorage.getItem('metro_admin_token');
    if (saved) {
      TOKEN = saved;
      api('/api/apps').then(function(apps){
        if (Array.isArray(apps)) { showPanel(); renderApps(apps); }
        else { TOKEN = ''; localStorage.removeItem('metro_admin_token'); }
      });
    }

    document.getElementById('loginBtn').addEventListener('click', login);
    document.getElementById('adminPass').addEventListener('keydown', function(e){
      if (e.key === 'Enter') login();
    });
    document.getElementById('addAppBtn').addEventListener('click', openAddForm);
    document.getElementById('formCancel').addEventListener('click', closeForm);
    document.getElementById('appForm').addEventListener('submit', submitForm);
    document.getElementById('logoutBtn').addEventListener('click', function(){
      TOKEN = '';
      localStorage.removeItem('metro_admin_token');
      document.getElementById('loginScreen').style.display = 'flex';
      document.getElementById('panelScreen').style.display = 'none';
    });

    document.getElementById('fIcon').addEventListener('change', function(){
      var file = this.files[0];
      if (!file) return;
      readFileAsDataURL(file, function(data){
        currentIconData = data;
        document.getElementById('iconPreviewImg').src = data;
        document.getElementById('iconPreview').style.display = '';
      });
    });

    document.getElementById('fAppFile').addEventListener('change', function(){
      var file = this.files[0];
      if (!file) return;
      readFileAsDataURL(file, function(data){
        currentFileData = data;
        currentFileName = file.name;
        document.getElementById('fileInfo').textContent = 'Файл: ' + file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)';
      });
    });

    document.getElementById('fScreenshots').addEventListener('change', function(){
      var files = this.files;
      var preview = document.getElementById('screenshotsPreview');
      for (var i = 0; i < files.length; i++) {
        (function(file){
          readFileAsDataURL(file, function(data){
            currentScreenshots.push(data);
            var wrap = document.createElement('div');
            wrap.style.position = 'relative';
            wrap.innerHTML = '<img src="' + data + '" width="100" height="70" alt="" style="border:1px solid #ddd;object-fit:cover;">';
            preview.appendChild(wrap);
          });
        })(files[i]);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
