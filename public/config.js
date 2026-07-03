var API_BASE = 'https://mstores.45.38.143.196.nip.io';
function apiFetch(url, opts) {
    return fetch(API_BASE + url, opts).then(function(r) { return r.json(); });
}
function assetUrl(path) {
    if (!path || path.indexOf('data:') === 0) return path;
    if (path.indexOf('http') === 0) return path;
    return API_BASE + path;
}
