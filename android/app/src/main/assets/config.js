var API_BASE = 'https://mstores.45.38.143.196.nip.io';
function apiFetch(url, opts) {
    return fetch(API_BASE + url, opts);
}
