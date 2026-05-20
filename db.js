// ========== DATABASE LAYER & UTILS ==========
const DB_NAME = 'MusicRatingsDB_v9';
const STORE_SONGS = 'songs';
const STORE_ALBUMS = 'albums';
const STORE_USERS = 'users';

let db = null;

// --- Utils (used by multiple modules, defined first) ---
function escapeHtml(text) {
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

function getAverageRating(song) {
  if (!song?.ratings?.length) return null;
  return Math.round(song.ratings.reduce((a, r) => a + r.total, 0) / song.ratings.length);
}

// --- DB Core ---
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 9);
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains(STORE_SONGS)) d.createObjectStore(STORE_SONGS, { keyPath: 'id' });
      if (!d.objectStoreNames.contains(STORE_ALBUMS)) d.createObjectStore(STORE_ALBUMS, { keyPath: 'name' });
      if (!d.objectStoreNames.contains(STORE_USERS)) {
        const s = d.createObjectStore(STORE_USERS, { keyPath: 'id' });
        s.createIndex('username', 'username', { unique: true });
      }
    };
    req.onsuccess = (e) => { db = e.target.result; resolve(db); };
    req.onerror = (e) => reject(e.target.error);
  });
}

function dbReq(store, method, key, value, isSync) {
  return new Promise((resolve, reject) => {
    if (!isSync && value && value.updatedAt !== undefined) value.updatedAt = Date.now();
    const tx = db.transaction(store, 'readwrite');
    const s = tx.objectStore(store);
    let r;
    if (method === 'add') {
      if (!value.id) value.id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      r = s.add(value);
    } else if (method === 'put') {
      r = s.put(value);
    } else if (method === 'delete') {
      if (!isSync) {
        const ts = JSON.parse(localStorage.getItem('bpt_tombstones') || '{}');
        if (!ts[store]) ts[store] = [];
        ts[store].push({ id: key, timestamp: Date.now() });
        localStorage.setItem('bpt_tombstones', JSON.stringify(ts));
      }
      r = s.delete(key);
    } else if (method === 'get') {
      r = s.get(key);
    } else if (method === 'getAll') {
      r = s.getAll();
    }
    r.onsuccess = () => resolve(r.result);
    r.onerror = (e) => reject(e.target.error);
  });
}

const dbAdd = (store, item, sync) => dbReq(store, 'add', null, item, sync);
const dbPut = (store, item, sync) => dbReq(store, 'put', null, item, sync);
const dbDelete = (store, key, sync) => dbReq(store, 'delete', key, null, sync);
const dbGet = (store, key) => dbReq(store, 'get', key);
const dbGetAll = (store) => dbReq(store, 'getAll');

function getUserByUsername(username) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_USERS, 'readonly');
    const idx = tx.objectStore(STORE_USERS).index('username');
    const r = idx.get(username);
    r.onsuccess = () => resolve(r.result || null);
    r.onerror = (e) => reject(e.target.error);
  });
}

async function initAdmin() {
  const users = await dbGetAll(STORE_USERS);
  if (users.length === 0) {
    const hash = await hashPassword('123123');
    await dbAdd(STORE_USERS, { username: 'Letluvv', passwordHash: hash, isAdmin: true });
  }
}
