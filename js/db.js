/**
 * Работа с IndexedDB
 */
const DB = {
  instance: null,

  open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(CONFIG.DB_NAME, 8);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(CONFIG.STORE_SONGS)) {
          db.createObjectStore(CONFIG.STORE_SONGS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(CONFIG.STORE_ALBUMS)) {
          db.createObjectStore(CONFIG.STORE_ALBUMS, { keyPath: 'name' });
        }
        if (!db.objectStoreNames.contains(CONFIG.STORE_USERS)) {
          const userStore = db.createObjectStore(CONFIG.STORE_USERS, { keyPath: 'id' });
          userStore.createIndex('username', 'username', { unique: true });
        }
      };
      request.onsuccess = (e) => {
        this.instance = e.target.result;
        resolve(this.instance);
      };
      request.onerror = (e) => reject(e.target.error);
    });
  },

  add(storeName, item, isSync = false) {
    return new Promise((resolve, reject) => {
      if (!isSync) item.updatedAt = Date.now();
      if (!item.id) item.id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      const tx = this.instance.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.add(item);
      request.onsuccess = () => resolve(item);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  put(storeName, item, isSync = false) {
    return new Promise((resolve, reject) => {
      if (!isSync) item.updatedAt = Date.now();
      const tx = this.instance.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(item);
      request.onsuccess = () => resolve(item);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  delete(storeName, key, isSync = false) {
    return new Promise((resolve, reject) => {
      if (!isSync) {
        const tombstones = JSON.parse(localStorage.getItem('bpt_tombstones') || '{}');
        if (!tombstones[storeName]) tombstones[storeName] = [];
        tombstones[storeName].push({ id: key, timestamp: Date.now() });
        localStorage.setItem('bpt_tombstones', JSON.stringify(tombstones));
      }
      const tx = this.instance.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e.target.error);
    });
  },

  get(storeName, key) {
    return new Promise((resolve, reject) => {
      const tx = this.instance.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  getAll(storeName) {
    return new Promise((resolve, reject) => {
      const tx = this.instance.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async getUserByUsername(username) {
    return new Promise((resolve, reject) => {
      const tx = this.instance.transaction(CONFIG.STORE_USERS, 'readonly');
      const store = tx.objectStore(CONFIG.STORE_USERS);
      const index = store.index('username');
      const request = index.get(username);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = (e) => reject(e.target.error);
    });
  },
};
