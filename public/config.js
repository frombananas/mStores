var API_BASE = 'https://mstores.45.38.143.196.nip.io';
function apiFetch(url, opts) {
    return new Promise(function(resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open((opts && opts.method) || 'GET', API_BASE + url);
        if (opts && opts.headers) {
            for (var k in opts.headers) xhr.setRequestHeader(k, opts.headers[k]);
        }
        xhr.onload = function() {
            try { resolve(JSON.parse(xhr.responseText)); }
            catch (e) { reject(e); }
        };
        xhr.onerror = function() { reject(new Error('Network error')); };
        if (opts && opts.body) xhr.send(opts.body);
        else xhr.send();
    });
}
function assetUrl(path) {
    if (!path || path.indexOf('data:') === 0) return path;
    if (path.indexOf('http') === 0) return path;
    return API_BASE + path;
}
