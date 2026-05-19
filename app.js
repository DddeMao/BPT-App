// ========== КОНСТАНТЫ ==========
const CRITERIA = ['Рифмы/Образы','Структура/Ритмика','Реализация стиля','Индивидуальность/Харизма','Атмосфера/Вайб'];
const MAX_SCORE = 12;
const DB_NAME = 'MusicRatingsDB_v8';
const STORE_SONGS = 'songs';
const STORE_ALBUMS = 'albums';
const STORE_USERS = 'users';

// ========== ГЛОБАЛЬНОЕ СОСТОЯНИЕ ==========
let db = null;
let currentUser = null;
const SESSION_KEY = 'bpt_currentUserId';

let currentView = 'songs';
let currentRatingSongId = null;
let currentCommentSongId = null;
let currentAlbumRatingName = null;

let currentSort = 'date';
let currentSearch = '';

let contextMenuSongId = null;

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
function saveSession(userId) { localStorage.setItem(SESSION_KEY, userId); }
function clearSession() { localStorage.removeItem(SESSION_KEY); }
function getSavedUserId() { return localStorage.getItem(SESSION_KEY); }

// ========== GITHUB SYNC ==========
const githubUser = 'DddeMao';
const githubRepo = 'BvsT';
let githubToken = localStorage.getItem('bpt_github_token') || '';
let isSyncing = false;
let syncTimeout = null;

function setSyncing(state) {
  isSyncing = state;
  const dot = document.getElementById('syncingDot');
  if (dot) dot.classList.toggle('active', state);
  const loadingText = document.getElementById('loadingText');
  if (loadingText) loadingText.textContent = state ? 'Синхронизация…' : '';
}

// ========== ХЭШИРОВАНИЕ ПАРОЛЯ ==========
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ========== БАЗА ДАННЫХ ==========
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 8);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_SONGS)) {
        db.createObjectStore(STORE_SONGS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_ALBUMS)) {
        db.createObjectStore(STORE_ALBUMS, { keyPath: 'name' });
      }
      if (!db.objectStoreNames.contains(STORE_USERS)) {
        const userStore = db.createObjectStore(STORE_USERS, { keyPath: 'id' });
        userStore.createIndex('username', 'username', { unique: true });
      }
    };
    request.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };
    request.onerror = (e) => reject(e.target.error);
  });
}

function dbAdd(storeName, item) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    if (!item.id) item.id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const request = store.add(item);
    request.onsuccess = () => resolve(item);
    request.onerror = (e) => reject(e.target.error);
  });
}

function dbPut(storeName, item) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(item);
    request.onsuccess = () => resolve(item);
    request.onerror = (e) => reject(e.target.error);
  });
}

function dbDelete(storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
}

function dbGet(storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = (e) => reject(e.target.error);
  });
}

function dbGetAll(storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

function getUserByUsername(username) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_USERS, 'readonly');
    const store = tx.objectStore(STORE_USERS);
    const index = store.index('username');
    const request = index.get(username);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = (e) => reject(e.target.error);
  });
}

// ========== ИНИЦИАЛИЗАЦИЯ АДМИНИСТРАТОРА ==========
async function initAdmin() {
  const users = await dbGetAll(STORE_USERS);
  if (users.length === 0) {
    const adminHash = await hashPassword('123123');
    await dbAdd(STORE_USERS, { username: 'Letluvv', passwordHash: adminHash, isAdmin: true });
  }
}

function updateAdminUI() {
  const isAdmin = currentUser?.isAdmin;
  document.getElementById('addBtn').style.display = isAdmin ? 'inline-block' : 'none';
  document.getElementById('deleteAlbumBtn').style.display = isAdmin ? 'inline-block' : 'none';
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ========== DOM-ЭЛЕМЕНТЫ ==========
const topSidebar = document.getElementById('topSidebar');
const topList = document.getElementById('topList');
const topAlbumsSidebar = document.getElementById('topAlbumsSidebar');
const topAlbumsList = document.getElementById('topAlbumsList');
const dynamicList = document.getElementById('dynamicList');
const playerBar = document.getElementById('player');
const audioPlayer = document.getElementById('audioPlayer');
const playerCover = document.getElementById('playerCover');
const playerTitle = document.getElementById('playerTitle');
const playerArtist = document.getElementById('playerArtist');
const viewSongsBtn = document.getElementById('viewSongsBtn');
const viewAlbumsBtn = document.getElementById('viewAlbumsBtn');

// ========== АУТЕНТИФИКАЦИЯ ==========
const authScreen = document.getElementById('authScreen');
const appDiv = document.getElementById('app');
const authTitle = document.getElementById('authTitle');
const authForm = document.getElementById('authForm');
const authUsername = document.getElementById('authUsername');
const authPassword = document.getElementById('authPassword');
const toggleAuthModeLink = document.getElementById('toggleAuthMode');
let authMode = 'login';

async function handleLogin(username, password) {
  const user = await getUserByUsername(username);
  if (!user) throw new Error('Неверный логин или пароль');
  const hash = await hashPassword(password);
  if (hash !== user.passwordHash) throw new Error('Неверный логин или пароль');
  saveSession(user.id);
  return user;
}

async function handleRegister(username, password) {
  const existing = await getUserByUsername(username);
  if (existing) throw new Error('Пользователь с таким ником уже существует');
  const isAdmin = false;
  const passwordHash = await hashPassword(password);
  const user = { username, passwordHash, isAdmin };
  await dbAdd(STORE_USERS, user);
  saveSession(user.id);
  return user;
}

function showAuthScreen() {
  appDiv.style.display = 'none';
  authScreen.style.display = 'flex';
  authUsername.value = '';
  authPassword.value = '';
  if (authMode === 'register') {
    authUsername.readOnly = false;
  }
}

function showApp() {
	console.trace("showApp была вызвана! Текущий пользователь:", currentUser);

  if (!currentUser || !currentUser.isAdmin) {
    console.error("Заблокирована попытка несанкционированного вызова showApp()!");
    
	if (document.getElementById('app')) document.getElementById('app').style.display = 'none';
    if (document.getElementById('player')) document.getElementById('player').style.display = 'none';
    if (document.getElementById('authScreen')) document.getElementById('authScreen').style.display = 'flex';
    
    return;
  }

  appDiv.style.display = 'flex';
  authScreen.style.display = 'none';
  document.getElementById('currentUserDisplay').textContent = `👤 ${currentUser.username}`;
  document.getElementById('addBtn').style.display = currentUser.isAdmin ? 'inline-block' : 'none';
  document.getElementById('deleteAlbumBtn').style.display = currentUser.isAdmin ? 'inline-block' : 'none';
  document.getElementById('syncNowBtn').style.display = 'inline-block';
  updateAdminUI();
}

document.getElementById('authForm').addEventListener('submit', async (e) => {
  e.preventDefault(); // Отменяем стандартную отправку формы

  const username = authUsername.value.trim();
  const password = authPassword.value;

  if (!username || !password) return;

  // === ЗАЩИТА АДМИНА: Обязательный вход через Telegram ===
  if (username.toLowerCase() === 'letluvv') {
    showNotification('Для аккаунта Letluvv вход через Telegram обязателен! 🔒', true);
    
    const tgButton = document.getElementById('telegram-login-container');
    if (tgButton) {
      tgButton.style.transform = 'scale(1.05)';
      tgButton.style.transition = 'transform 0.2s ease';
      setTimeout(() => tgButton.style.transform = 'scale(1)', 300);
    }
    return;
  }

  try {
    if (authMode === 'login') {
      currentUser = await handleLogin(username, password);
    } else {
      currentUser = await handleRegister(username, password);
    }
    showApp();
    refreshAll();
  } catch (err) {
    alert(err.message);
  }
});

if (authForm) {
  authForm.addEventListener('submit', (e) => {
    // Получаем имя, которое вводит пользователь
    const usernameInput = document.getElementById('username')?.value || '';
    
    // Если кто-то пытается войти под Letluvv через обычную форму — намертво блокируем отправку!
    if (usernameInput.trim() === 'Letluvv') {
      e.preventDefault(); 
      e.stopPropagation();
      alert('Вход для Letluvv возможен ТОЛЬКО через кнопку Telegram!');
      return false;
    }
  });
}

toggleAuthModeLink.addEventListener('click', (e) => {
  e.preventDefault();
  authMode = authMode === 'login' ? 'register' : 'login';
  authTitle.textContent = authMode === 'login' ? 'Вход' : 'Регистрация';
  toggleAuthModeLink.textContent = authMode === 'login' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти';
  authUsername.readOnly = false;

  const tgBlock = document.getElementById('tgAdminBlock');
  if (tgBlock) {
    tgBlock.style.display = authMode === 'login' ? 'block' : 'none';
  }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  currentUser = null;
  clearSession();
  showAuthScreen();
});

// ========== СМЕНА НИКА И НАСТРОЙКИ ==========
document.getElementById('settingsBtn').addEventListener('click', () => {
  document.getElementById('newUsername').value = currentUser.username;
  document.getElementById('settingsPassword').value = '';
  
  const tokenInput = document.getElementById('settingsGithubToken');
  if (tokenInput) {
    tokenInput.value = localStorage.getItem('bpt_github_token') || '';
  }
  
  document.getElementById('modalSettings').classList.add('active');
  
  updateAdminUI();
});

document.querySelector('.close-settings').addEventListener('click', () => {
  closeModal(document.getElementById('modalSettings'));
});

// ==========================================
// ЛОГИКА ОТКРЫТИЯ ОКНА НАСТРОЕК 
// ==========================================
document.getElementById('settingsBtn').addEventListener('click', () => {
  document.getElementById('newUsername').value = currentUser.username;
  document.getElementById('settingsPassword').value = '';
  
  // Автоматически подставляем ранее сохраненный токен из localStorage
  const tokenInput = document.getElementById('settingsGithubToken');
  if (tokenInput) {
    tokenInput.value = localStorage.getItem('bpt_github_token') || '';
  }
  
  document.getElementById('modalSettings').classList.add('active');
  updateAdminUI();
});

// ==========================================
// ЕДИНЫЙ И ПРАВИЛЬНЫЙ ОБРАБОТЧИК ФОРМЫ НАСТРОЕК
// ==========================================
document.getElementById('settingsForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const newUsername = document.getElementById('newUsername').value.trim();
  const password = document.getElementById('settingsPassword').value;
  if (!newUsername || !password) return;

  try {
    // 1. Проверяем текущий пароль пользователя
    const hash = await hashPassword(password);
    if (hash !== currentUser.passwordHash) throw new Error('Неверный пароль');
    
    let userUpdated = false;

    // 2. Если пользователь решил сменить никнейм
    if (newUsername !== currentUser.username) {
      const existing = await getUserByUsername(newUsername);
      if (existing) throw new Error('Этот ник уже занят');

      // Создаем объект обновленного пользователя
      const updatedUser = { ...currentUser, username: newUsername };
      await dbPut(STORE_USERS, updatedUser);
      
      // Обновляем никнейм в истории оценок и комментариев ко ВСЕМ ПЕСНЯМ
      const songs = await dbGetAll(STORE_SONGS);
      for (const song of songs) {
        let changed = false;
        
        if (song.ratings) {
          for (const r of song.ratings) {
            if (r.userId === currentUser.id) {
              r.username = newUsername;
              changed = true;
            }
          }
        }
        
        if (song.comments) {
          for (const c of song.comments) {
            if (c.userId === currentUser.id) {
              c.username = newUsername;
              changed = true;
            }
          }
        }
        
        if (changed) await dbPut(STORE_SONGS, song);
      }

      // Обновляем никнейм в оценках ко ВСЕМ АЛЬБОМАМ
      const albums = await dbGetAll(STORE_ALBUMS);
      for (const album of albums) {
        if (album.ratings) {
          let changed = false;
          for (const r of album.ratings) {
            if (r.userId === currentUser.id) {
              r.username = newUsername;
              changed = true;
            }
          }
          if (changed) await dbPut(STORE_ALBUMS, album);
        }
      }

      // Фиксируем обновленного юзера в глобальной переменной
      currentUser = updatedUser;
      
      // Обновляем отображение имени в шапке сайта
      const userDisplay = document.getElementById('currentUserDisplay');
      if (userDisplay) {
        userDisplay.textContent = `👤 ${currentUser.username}`;
      }
      
      userUpdated = true;
    }
    
    // 3. Сохранение GitHub Token в localStorage (Безопасный перенос!)
    const tokenInput = document.getElementById('settingsGithubToken');
    if (tokenInput) {
      const newTokenValue = tokenInput.value.trim();
      localStorage.setItem('bpt_github_token', newTokenValue);
      githubToken = newTokenValue; // Обновляем глобальную переменную проекта
    }
    
    // 4. Закрываем красивую модалку и уведомляем об успехе
    showNotification('Настройки успешно сохранены!');
    closeModal(document.getElementById('modalSettings'));
    
    // 5. Дергаем апдейты интерфейса и запускаем фоновую синхронизацию
    refreshAll();
    
    if (typeof onDataChanged === 'function') {
      onDataChanged();
    }
    
    if (githubToken) {
      syncWithGitHub();
    }

  } catch (error) {
    console.error('Ошибка изменения настроек:', error);
    if (typeof showNotification === 'function') {
      showNotification(error.message, true); 
    } else {
      alert(error.message);
    }
  }
});

function getFavorites() {
  if (!currentUser) return [];
  return JSON.parse(localStorage.getItem(`bpt_favorites_${currentUser.id}`) || '[]');
}

function saveFavorites(favs) {
  if (!currentUser) return;
  localStorage.setItem(`bpt_favorites_${currentUser.id}`, JSON.stringify(favs));
}

// ========== ТОП-12 ==========
function getAverageRating(song) {
  if (!song.ratings || song.ratings.length === 0) return null;
  const sum = song.ratings.reduce((acc, r) => acc + r.total, 0);
  return Math.round(sum / song.ratings.length);
}

function renderTop12(songs) {
  const rated = songs.filter(s => s.ratings && s.ratings.length > 0)
                     .map(s => ({ song: s, avg: getAverageRating(s) }))
                     .sort((a, b) => b.avg - a.avg)
                     .slice(0, 12);
  if (rated.length === 0) {
    topList.innerHTML = '';
    return;
  }
  topList.innerHTML = rated.map(({ song, avg }) => {
    const coverUrl = song.coverUrl || (song.coverBlob ? URL.createObjectURL(song.coverBlob) : '');
    return `
      <div class="top-vertical-item">
        ${coverUrl ? `<img src="${coverUrl}" alt="cover">` : '<div style="width:44px;height:44px;background:#333;border-radius:8px;"></div>'}
        <div class="tvi-info">
          <div class="tvi-title">${escapeHtml(song.title)}</div>
          <div class="tvi-artist">${escapeHtml(song.artist)}</div>
        </div>
        <div class="tvi-score">${avg} ★</div>
      </div>`;
  }).join('');
}

function getScoreColor(score) {
  const maxScore = 12;
  const ratio = score / maxScore;
  const startColor = { r: 60, g: 50, b: 70 };
  const midColor = { r: 179, g: 102, b: 255 };
  const endColor = { r: 255, g: 77, b: 109 };
  let r, g, b;
  if (ratio <= 0.5) {
    const t = ratio * 2;
    r = Math.round(startColor.r + (midColor.r - startColor.r) * t);
    g = Math.round(startColor.g + (midColor.g - startColor.g) * t);
    b = Math.round(startColor.b + (midColor.b - startColor.b) * t);
  } else {
    const t = (ratio - 0.5) * 2;
    r = Math.round(midColor.r + (endColor.r - midColor.r) * t);
    g = Math.round(midColor.g + (endColor.g - midColor.g) * t);
    b = Math.round(midColor.b + (endColor.b - midColor.b) * t);
  }
  return `rgb(${r}, ${g}, ${b})`;
}

function getFilteredAndSortedSongs(songs) {
  if (!songs || !Array.isArray(songs) || songs.length === 0) return [];
  let filtered = [...songs];
  if (currentSearch && currentSearch.trim()) {
    const search = currentSearch.toLowerCase().trim();
    filtered = filtered.filter(s => 
      (s.title && s.title.toLowerCase().includes(search)) ||
      (s.artist && s.artist.toLowerCase().includes(search)) ||
      (s.album && s.album.toLowerCase().includes(search))
    );
  }
  if (currentSort === 'date') {
    filtered.sort((a, b) => {
      if (a.date && b.date) return b.date.localeCompare(a.date);
      if (a.date && !b.date) return -1;
      if (!a.date && b.date) return 1;
      return 0;
    });
  } else if (currentSort === 'name') {
    filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  } else if (currentSort === 'rating') {
    filtered.sort((a, b) => {
      const avgA = getAverageRating(a) || 0;
      const avgB = getAverageRating(b) || 0;
      return avgB - avgA;
    });
  } else if (currentSort === 'favorites') {
    const favs = getFavorites();
    filtered = filtered.filter(s => favs.includes(s.id));
  }
  return filtered;
}

// ========== ОТОБРАЖЕНИЕ ТРЕКОВ ==========
function renderSongs(songs) {
  if (!songs || songs.length === 0) {
    dynamicList.innerHTML = '<div style="color:#888; text-align:center; padding:40px;">Треки не найдены</div>';
    return;
  }
  dynamicList.className = 'song-grid';
  const favs = getFavorites();
  dynamicList.innerHTML = songs.map(song => {
    const coverUrl = song.coverUrl || (song.coverBlob ? URL.createObjectURL(song.coverBlob) : '');
    const avg = getAverageRating(song);
    const userRating = song.ratings?.find(r => r.userId === currentUser.id);
    const hasUserRating = !!userRating;
    const isFavorite = favs.includes(song.id);
    const canDelete = currentUser?.isAdmin;
    let scoreHtml = '';
    if (hasUserRating) {
      const circles = userRating.scores.map((s, i) =>
        `<span class="score-circle" style="background: ${getScoreColor(s)};" title="${CRITERIA[i]}: ${s}/${MAX_SCORE}">${s}</span>`
      ).join('');
      scoreHtml = `<div class="score-circles">${circles}</div><div class="total">Ваша: ${userRating.total} ★</div>`;
    } else {
      scoreHtml = `<div style="color:#888; font-style:italic;">Вы не оценили</div>`;
    }
    if (avg !== null) {
      scoreHtml += `<div style="font-size:0.85rem; color:var(--text-secondary); text-align:right;">Средний балл: ${avg} ★ (${song.ratings.length} оценок)</div>`;
    }
    const albumLine = song.album ? `<span>💿 ${escapeHtml(song.album)}</span>` : '';
    const dateLine = song.date ? `<span>📅 ${song.date}</span>` : '';
    const commentCount = (song.comments && song.comments.length) || 0;
    const commentClass = commentCount ? 'comment-btn has-comments' : 'comment-btn';
    return `
      <div class="card" data-id="${song.id}">
        <div class="card-top">
          ${coverUrl ? `<img class="card-cover" src="${coverUrl}" alt="cover">` : '<div class="card-cover"></div>'}
          <div class="card-info">
            <div class="card-title">${escapeHtml(song.title)}</div>
            <div class="card-artist">${escapeHtml(song.artist)}</div>
            <div class="card-meta">${albumLine} ${dateLine}</div>
          </div>
        </div>
        ${scoreHtml}
        <div class="card-actions">
          <div class="card-actions-left">
            <button class="play-btn" data-id="${song.id}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </button>
          </div>
          <div class="card-actions-right">
            <button class="rate-btn" data-id="${song.id}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">${hasUserRating ? '<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>' : '<path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>'}</svg>
            </button>
            <button class="comment-btn ${commentClass}" data-id="${song.id}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>
              ${commentCount ? `<span class="comment-count">${commentCount}</span>` : ''}
            </button>
            <button class="favorite-btn ${isFavorite ? 'is-favorite' : ''}" data-id="${song.id}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="${isFavorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
            </button>
            ${canDelete ? `
              <button class="delete-btn" data-id="${song.id}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
              </button>
            ` : ''}
          </div>
        </div>
      </div>`;
  }).join('');

  document.querySelectorAll('.play-btn').forEach(btn =>
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.closest('.card')?.dataset.id;
      if (id) playSong(id);
    })
  );
  document.querySelectorAll('.rate-btn').forEach(btn =>
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.closest('.card')?.dataset.id;
      if (id) openRatingModal(id);
    })
  );
  document.querySelectorAll('.comment-btn').forEach(btn =>
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.closest('.card')?.dataset.id;
      if (id) openCommentModal(id);
    })
  );
  document.querySelectorAll('.favorite-btn').forEach(btn =>
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = e.currentTarget.closest('.card')?.dataset.id;
      if (id) {
        toggleFavorite(id);
        refreshAll();
      }
    })
  );
  document.querySelectorAll('.delete-btn').forEach(btn =>
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.closest('.card')?.dataset.id;
      if (id && confirm('Удалить этот трек и все его данные?')) {
        dbDelete(STORE_SONGS, id).then(() => {
          refreshAll();
          syncWithGitHub();
        });
      }
    })
  );
}

function playSong(id) {
  dbGetAll(STORE_SONGS).then(songs => {
    const song = songs.find(s => s.id === id);
    if (!song) return;
    if (song.audioUrl) {
      audioPlayer.src = song.audioUrl;
    } else if (song.audioBlob) {
      audioPlayer.src = URL.createObjectURL(song.audioBlob);
    } else {
      alert('Нет доступного аудио для этого трека');
      return;
    }
    playerCover.src = song.coverUrl || (song.coverBlob ? URL.createObjectURL(song.coverBlob) : '');
    playerTitle.textContent = song.title;
    playerArtist.textContent = song.artist;
    playerBar.style.display = 'flex';
    audioPlayer.play().catch(console.log);
  });
}

// Обработчики пульсации для плеера
audioPlayer.addEventListener('play', () => {
  setTimeout(() => {
    if (!audioPlayer.paused) {
      playerCover.classList.add('playing');
    }
  }, 50);
});

audioPlayer.addEventListener('pause', () => {
  playerCover.style.animation = 'none';
  playerCover.offsetHeight;
  playerCover.style.animation = '';
  playerCover.classList.remove('playing');
});

audioPlayer.addEventListener('ended', () => {
  playerCover.classList.remove('playing');
});

// ========== РЕЖИМЫ ПРОСМОТРА ==========
function showSongsView() {
  currentView = 'songs';
  viewSongsBtn.classList.add('btn-active');
  viewAlbumsBtn.classList.remove('btn-active');
  topSidebar.style.display = 'block';
  topAlbumsSidebar.style.display = 'none';
  const searchBar = document.querySelector('.search-sort-bar');
  if (searchBar) searchBar.style.display = 'flex';
  dbGetAll(STORE_SONGS).then(songs => {
    const filtered = getFilteredAndSortedSongs(songs);
    renderSongs(filtered);
    renderTop12(songs);
  });
}

function showAlbumsView() {
  currentView = 'albums';
  viewAlbumsBtn.classList.add('btn-active');
  viewSongsBtn.classList.remove('btn-active');
  topSidebar.style.display = 'none';
  topAlbumsSidebar.style.display = 'block';
  document.querySelector('.search-sort-bar').style.display = 'none';
  renderAlbums();
  renderTopAlbums();
}

// ========== ОТОБРАЖЕНИЕ АЛЬБОМОВ ==========
async function renderAlbums() {
  const [songs, albums] = await Promise.all([dbGetAll(STORE_SONGS), dbGetAll(STORE_ALBUMS)]);
  const albumGroups = new Map();
  
  songs.forEach(s => {
    if (!s.album) return;
    if (!albumGroups.has(s.album)) albumGroups.set(s.album, []);
    albumGroups.get(s.album).push(s);
  });
  
  dynamicList.className = 'album-list';
  dynamicList.innerHTML = Array.from(albumGroups.keys()).map(albumName => {
    const tracks = albumGroups.get(albumName);
    const firstTrack = tracks[0];
    const coverUrl = firstTrack.coverUrl || (firstTrack.coverBlob ? URL.createObjectURL(firstTrack.coverBlob) : '');
    const albumData = albums.find(a => a.name === albumName);
    const totalScore = albumData && albumData.ratings && albumData.ratings.length > 0
      ? Math.round(albumData.ratings.reduce((sum, r) => sum + r.total, 0) / albumData.ratings.length)
      : null;
    const scoreDisplay = totalScore !== null
      ? `<span style="color:var(--accent); font-weight:700;">★ ${totalScore}</span>`
      : 'Не оценен';
    const dateDisplay = albumData?.date ? `📅 ${albumData.date}` : '';
    
    return `
      <div class="album-card" data-album="${escapeHtml(albumName)}">
        ${coverUrl ? `<img class="album-cover" src="${coverUrl}" alt="cover">` : '<div class="album-cover"></div>'}
        <div class="album-info">
          <h3>${escapeHtml(albumName)}</h3>
          <div class="album-artist">${escapeHtml(firstTrack.artist)}</div>
          <div class="track-count">${tracks.length} треков ${dateDisplay}</div>
          <div>${scoreDisplay}</div>
        </div>
      </div>`;
  }).join('');
  
  document.querySelectorAll('.album-card').forEach(card => {
    card.addEventListener('click', () => openAlbumView(card.dataset.album));
  });
}

// ========== ПРОСМОТР АЛЬБОМА ==========
async function openAlbumView(albumName) {
  const songs = await dbGetAll(STORE_SONGS);
  const albumTracks = songs.filter(s => s.album === albumName);
  if (albumTracks.length === 0) return;

  const albumData = await dbGet(STORE_ALBUMS, albumName) || { name: albumName, ratings: [], trackOrder: [], date: '' };
  const trackOrder = albumData.trackOrder || albumTracks.map(t => t.id);
  
  const orderedTracks = trackOrder
    .map(id => albumTracks.find(t => t.id === id))
    .filter(t => t !== undefined);

  albumTracks.forEach(t => {
    if (!orderedTracks.includes(t)) orderedTracks.push(t);
  });

  const isAdmin = currentUser?.isAdmin;
  document.getElementById('albumViewTitle').textContent = `💿 ${albumName}`;
  const container = document.getElementById('albumViewTracks');

  // Управляем датой альбома (для Админа)
  const existingDateRow = document.getElementById('albumDateRow');
  if (existingDateRow) existingDateRow.remove();

  if (isAdmin) {
    const dateRow = document.createElement('div');
    dateRow.id = 'albumDateRow';
    dateRow.className = 'album-date-row';
    dateRow.innerHTML = `
      <label>📅 Дата альбома:</label>
      <input type="date" id="albumDateInput" value="${albumData.date || ''}">
      <button id="applyDateToTracks" class="btn-settings" style="font-size:0.85rem;">Применить ко всем трекам</button>
    `;
    container.parentNode.insertBefore(dateRow, container);

    document.getElementById('applyDateToTracks').onclick = async () => {
      const newDate = document.getElementById('albumDateInput').value;
      if (!confirm(`Применить дату "${newDate}" ко всем трекам этого альбома?`)) return;
      
      const overlay = document.getElementById('loadingOverlay');
      if (overlay) overlay.classList.add('active');
      
      try {
        for (const song of albumTracks) {
          song.date = newDate;
          await dbPut(STORE_SONGS, song);
        }
        albumData.date = newDate;
        await dbPut(STORE_ALBUMS, albumData);
        openAlbumView(albumName);
        if (typeof onDataChanged === 'function') onDataChanged();
      } catch (err) {
        console.error(err);
        alert('Ошибка при обновлении даты');
      } finally {
        if (overlay) overlay.classList.remove('active');
      }
    };

    document.getElementById('albumDateInput').addEventListener('change', async () => {
      albumData.date = document.getElementById('albumDateInput').value;
      await dbPut(STORE_ALBUMS, albumData);
      if (typeof onDataChanged === 'function') onDataChanged();
    });
  }

  // Рендерим список треков внутри альбома
  container.innerHTML = orderedTracks.map((song, index) => {
    const coverUrl = song.coverUrl || (song.coverBlob ? URL.createObjectURL(song.coverBlob) : '');
    const avg = getAverageRating(song);
    const userRating = song.ratings?.find(r => r.userId === currentUser?.id);
    let scoreHtml = '';
    
    if (userRating) {
      scoreHtml = `<div class="score-circles">${userRating.scores.map((s,i) => `<span class="score-circle" style="background: ${getScoreColor(s)};" title="${CRITERIA[i]}: ${s}/${MAX_SCORE}">${s}</span>`).join('')}</div><div class="total">Ваша: ${userRating.total} ★</div>`;
    } else {
      scoreHtml = `<div style="color:#888;">Не оценен</div>`;
    }
    
    if (avg !== null) {
      scoreHtml += `<div style="font-size:0.85rem; color:var(--text-secondary);">Средний: ${avg} ★</div>`;
    }
    
    return `
      <div class="card draggable-song" draggable="${isAdmin}" data-id="${song.id}">
        ${isAdmin ? `<span class="drag-handle show" title="Перетащить">≡</span>` : ''}
        <div class="card-top">
          ${coverUrl ? `<img class="card-cover" src="${coverUrl}" alt="cover">` : '<div class="card-cover"></div>'}
          <div class="card-info">
            <div class="card-title">
              <span class="track-num">${index + 1}.</span>${escapeHtml(song.title)}
            </div>
            <div class="card-artist">${escapeHtml(song.artist)}</div>
          </div>
        </div>
        ${scoreHtml}
        <div class="card-actions">
          <button class="play-btn" data-id="${song.id}">▶ Слушать</button>
        </div>
      </div>`;
  }).join('');

  // Навешиваем клик на кнопки "Слушать"
  container.querySelectorAll('.play-btn').forEach(btn =>
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      playSong(e.target.dataset.id);
    })
  );

  // Логика удаления всего альбома
  const deleteBtn = document.getElementById('deleteAlbumBtn');
  if (deleteBtn) {
    deleteBtn.onclick = async () => {
      if (confirm(`Удалить альбом "${albumName}" и все его треки?`)) {
        for (const song of albumTracks) {
          await dbDelete(STORE_SONGS, song.id);
        }
        await dbDelete(STORE_ALBUMS, albumName);
        closeModal(document.getElementById('modalAlbumView'));
        refreshAll();
        if (typeof onDataChanged === 'function') onDataChanged();
      }
    };
  }

  // Логика Drag-and-Drop перетаскивания треков (для Админа)
  const draggables = container.querySelectorAll('.draggable-song');
  if (isAdmin) {
    let draggedItem = null;
    draggables.forEach(item => {
      item.addEventListener('dragstart', (e) => {
        draggedItem = item;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', item.dataset.id);
      });
      
      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        draggedItem = null;
        draggables.forEach(d => d.classList.remove('drag-over'));
      });
      
      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (item !== draggedItem) {
          item.classList.add('drag-over');
        }
      });

      item.addEventListener('dragleave', () => {
        item.classList.remove('drag-over');
      });

      item.addEventListener('drop', async (e) => {
        e.preventDefault();
        if (item === draggedItem) return;

        const allItems = Array.from(container.querySelectorAll('.draggable-song'));
        const draggedIndex = allItems.indexOf(draggedItem);
        const targetIndex = allItems.indexOf(item);

        if (draggedIndex < targetIndex) {
          item.parentNode.insertBefore(draggedItem, item.nextSibling);
        } else {
          item.parentNode.insertBefore(draggedItem, item);
        }

        const newOrder = Array.from(container.querySelectorAll('.draggable-song')).map(d => d.dataset.id);
        albumData.trackOrder = newOrder;
        await dbPut(STORE_ALBUMS, albumData);
        
        openAlbumView(albumName);
        if (typeof onDataChanged === 'function') onDataChanged();
      });
    });
  }

  // Настройка кнопок внутри окна просмотра
  const rateBtn = document.getElementById('rateAlbumBtn');
  if (rateBtn) {
    rateBtn.onclick = () => {
      closeModal(document.getElementById('modalAlbumView'));
      openAlbumRatingModal(albumName);
    };
  }

  const closeBtn = document.querySelector('.close-album-view');
  if (closeBtn) {
    closeBtn.onclick = () => closeModal(document.getElementById('modalAlbumView'));
  }

  // Открываем модальное окно просмотра альбома
  document.getElementById('modalAlbumView').classList.add('active');
}

// ========== ВСПОМОГАТЕЛЬНЫЕ РАСЧЕТЫ РЕЙТИНГОВ АЛЬБОМОВ ==========
function getAlbumAverageRating(album) {
  if (!album.ratings || album.ratings.length === 0) return null;
  const sum = album.ratings.reduce((acc, r) => acc + r.total, 0);
  return Math.round(sum / album.ratings.length);
}

// ========== РЕНДЕРИНГ ТОП АЛЬБОМОВ ==========
async function renderTopAlbums() {
  const [albums, songs] = await Promise.all([dbGetAll(STORE_ALBUMS), dbGetAll(STORE_SONGS)]);
  const rated = albums
    .filter(a => a.ratings && a.ratings.length > 0)
    .map(a => ({
      album: a,
      avg: getAlbumAverageRating(a),
      firstSong: songs.find(s => s.album === a.name)
    }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 5);
    
  if (rated.length === 0) {
    topAlbumsList.innerHTML = '';
    return;
  }
  
  topAlbumsList.innerHTML = rated.map(({ album, avg, firstSong }) => {
    const coverUrl = firstSong?.coverUrl || (firstSong?.coverBlob ? URL.createObjectURL(firstSong.coverBlob) : '');
    const artistName = firstSong?.artist || 'Неизвестен';
    return `
      <div class="top-vertical-item">
        ${coverUrl ? `<img src="${coverUrl}" alt="cover">` : '<div style="width:44px;height:44px;background:#333;border-radius:8px;"></div>'}
        <div class="tvi-info">
          <div class="tvi-title">${escapeHtml(album.name)}</div>
          <div class="tvi-artist">${escapeHtml(artistName)}</div>
        </div>
        <div class="tvi-score">${avg} ★</div>
      </div>
    `;
  }).join('');
}

// ========== УНИВЕРСАЛЬНАЯ ФУНКЦИЯ ПОЛЗУНКОВ ==========
function buildSliders(containerId, values, onChange) {
  const container = document.getElementById(containerId);
  container.innerHTML = CRITERIA.map((name, i) => {
    const val = values ? values[i] : 0;
    return `<div class="range-group">
      <label><span>${name}</span><span id="${containerId}Val${i}">${val}</span></label>
      <input type="range" id="${containerId}Range${i}" min="0" max="${MAX_SCORE}" value="${val}" step="1">
    </div>`;
  }).join('');
  CRITERIA.forEach((_, i) => {
    const slider = document.getElementById(`${containerId}Range${i}`);
    const valSpan = document.getElementById(`${containerId}Val${i}`);
    slider.addEventListener('input', () => {
      valSpan.textContent = slider.value;
      onChange();
    });
  });
  onChange();
}

// ========== ОЦЕНКА ТРЕКА ==========
function openRatingModal(songId) {
  dbGetAll(STORE_SONGS).then(songs => {
    const song = songs.find(s => s.id === songId);
    if (!song) return;
    currentRatingSongId = songId;
    const coverUrl = song.coverUrl || (song.coverBlob ? URL.createObjectURL(song.coverBlob) : '');
    document.getElementById('ratingHeader').innerHTML = `
      ${coverUrl ? `<img class="rating-cover" src="${coverUrl}" alt="cover">` : ''}
      <div><strong>${escapeHtml(song.artist)}</strong><br>${escapeHtml(song.title)}</div>`;
    const myRating = song.ratings?.find(r => r.userId === currentUser.id);
    buildSliders('ratingSliders', myRating?.scores, () => {
      let sum = 0;
      for (let i = 0; i < CRITERIA.length; i++) {
        const slider = document.getElementById(`ratingSlidersRange${i}`);
        if (slider) sum += parseInt(slider.value, 10);
      }
      document.getElementById('liveTotal').textContent = sum;
    });
    const otherContainer = document.getElementById('otherRatings');
    const others = song.ratings?.filter(r => r.userId !== currentUser.id) || [];
    otherContainer.innerHTML = others.length === 0
      ? '<div style="color:#888;">Нет оценок</div>'
      : others.map(r => `<div><strong>${escapeHtml(r.username)}</strong>: ${r.total} ★ (${r.scores.map((s,i)=>`${CRITERIA[i]}:${s}`).join(', ')})</div>`).join('');
    document.getElementById('modalRating').classList.add('active');
  });
}

document.querySelector('.close-rating').addEventListener('click', () =>
  closeModal(document.getElementById('modalRating'))
);

document.getElementById('ratingForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentRatingSongId) return;
  const scores = CRITERIA.map((_, i) => {
    const slider = document.getElementById(`ratingSlidersRange${i}`);
    return slider ? parseInt(slider.value, 10) : 0;
  });
  const total = scores.reduce((a, b) => a + b, 0);
  const songs = await dbGetAll(STORE_SONGS);
  const song = songs.find(s => s.id === currentRatingSongId);
  if (!song) return;
  if (!song.ratings) song.ratings = [];
  const myIndex = song.ratings.findIndex(r => r.userId === currentUser.id);
  const ratingObj = { userId: currentUser.id, username: currentUser.username, scores, total, date: new Date().toISOString() };
  if (myIndex >= 0) song.ratings[myIndex] = ratingObj;
  else song.ratings.push(ratingObj);
  await dbPut(STORE_SONGS, song);
  closeModal(document.getElementById('modalRating'));
  refreshAll();
  onDataChanged();
});

// ========== ОЦЕНКА АЛЬБОМА ==========
function openAlbumRatingModal(albumName) {
  currentAlbumRatingName = albumName;
  dbGet(STORE_ALBUMS, albumName).then(album => {
    document.getElementById('albumRatingInfo').textContent = `Альбом: ${albumName}`;
    const myRating = album?.ratings?.find(r => r.userId === currentUser.id);
    buildSliders('albumRatingSliders', myRating?.scores, () => {
      let sum = 0;
      for (let i = 0; i < CRITERIA.length; i++) {
        const slider = document.getElementById(`albumRatingSlidersRange${i}`);
        if (slider) sum += parseInt(slider.value, 10);
      }
      document.getElementById('albumLiveTotal').textContent = sum;
    });
    const otherContainer = document.getElementById('otherAlbumRatings');
    const others = album?.ratings?.filter(r => r.userId !== currentUser.id) || [];
    otherContainer.innerHTML = others.length === 0
      ? '<div style="color:#888;">Нет оценок</div>'
      : others.map(r => `<div><strong>${escapeHtml(r.username)}</strong>: ${r.total} ★</div>`).join('');
    document.getElementById('modalAlbumRating').classList.add('active');
  });
}

document.querySelector('.close-album-rating').addEventListener('click', () =>
  closeModal(document.getElementById('modalAlbumRating'))
);

document.getElementById('albumRatingForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentAlbumRatingName) return;
  const scores = CRITERIA.map((_, i) => {
    const slider = document.getElementById(`albumRatingSlidersRange${i}`);
    return slider ? parseInt(slider.value, 10) : 0;
  });
  const total = scores.reduce((a, b) => a + b, 0);
  const album = await dbGet(STORE_ALBUMS, currentAlbumRatingName) || { name: currentAlbumRatingName, ratings: [], trackOrder: [] };
  if (!album.ratings) album.ratings = [];
  const myIndex = album.ratings.findIndex(r => r.userId === currentUser.id);
  const ratingObj = { userId: currentUser.id, username: currentUser.username, scores, total, date: new Date().toISOString() };
  if (myIndex >= 0) album.ratings[myIndex] = ratingObj;
  else album.ratings.push(ratingObj);
  await dbPut(STORE_ALBUMS, album);
  closeModal(document.getElementById('modalAlbumRating'));
  refreshAll();
  onDataChanged();
});

// ========== КОММЕНТАРИИ ==========
function openCommentModal(songId) {
  dbGetAll(STORE_SONGS).then(songs => {
    const song = songs.find(s => s.id === songId);
    if (!song) return;
    currentCommentSongId = songId;
    document.getElementById('commentSongInfo').textContent = `${song.artist} — ${song.title}`;
    document.getElementById('commentAuthor').value = currentUser.username;
    renderCommentsList(song.comments || []);
    document.getElementById('commentText').value = '';
    document.getElementById('modalComment').classList.add('active');
  });
}

function renderCommentsList(comments) {
  const container = document.getElementById('commentsContainer');
  if (comments.length === 0) {
    container.innerHTML = '<div style="color:#888; text-align:center;">Пока нет комментариев</div>';
    return;
  }
  container.innerHTML = comments.map((c, idx) => {
    const canDelete = c.userId === currentUser.id;
    return `
      <div class="comment-item">
        ${canDelete ? `<button class="comment-del" data-index="${idx}">✕</button>` : ''}
        <div class="comment-author">${escapeHtml(c.username)}</div>
        <div class="comment-text">${escapeHtml(c.text)}</div>
        <div class="comment-date">${c.date || ''}</div>
      </div>`;
  }).join('');
  container.querySelectorAll('.comment-del').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const index = parseInt(e.target.dataset.index, 10);
      const songs = await dbGetAll(STORE_SONGS);
      const song = songs.find(s => s.id === currentCommentSongId);
      if (!song || !song.comments) return;
      song.comments.splice(index, 1);
      await dbPut(STORE_SONGS, song);
      renderCommentsList(song.comments);
      onDataChanged();
    });
  });
}

document.getElementById('addCommentBtn').addEventListener('click', async () => {
  if (!currentCommentSongId) return;
  const text = document.getElementById('commentText').value.trim();
  if (!text) return alert('Введите текст комментария');
  const songs = await dbGetAll(STORE_SONGS);
  const song = songs.find(s => s.id === currentCommentSongId);
  if (!song) return;
  if (!song.comments) song.comments = [];
  song.comments.push({
    userId: currentUser.id,
    username: currentUser.username,
    text,
    date: new Date().toLocaleString('ru-RU')
  });
  await dbPut(STORE_SONGS, song);
  openCommentModal(currentCommentSongId);
  onDataChanged();
});

document.querySelector('.close-comment').addEventListener('click', () =>
  closeModal(document.getElementById('modalComment'))
);

// ========== ДОБАВЛЕНИЕ ТРЕКА (URL или файл) ==========
const addAlbumInput = document.getElementById('addAlbum');
const albumDatalist = document.getElementById('albumList');
const addArtistInput = document.getElementById('addArtist');
const addDateInput = document.getElementById('addDate');
const audioUrlsContainer = document.getElementById('audioUrlsContainer');

// Динамическое добавление полей для ссылок
audioUrlsContainer.addEventListener('input', function(e) {
  if (e.target.classList.contains('audio-url-input') || e.target.classList.contains('audio-title-input')) {
    const allRows = Array.from(audioUrlsContainer.querySelectorAll('.audio-track-row'));
    const lastRow = allRows[allRows.length - 1];
    const lastUrlInput = lastRow.querySelector('.audio-url-input');
    const lastTitleInput = lastRow.querySelector('.audio-title-input');
    if (lastUrlInput.value.trim() !== '' || lastTitleInput.value.trim() !== '') {
      const newRow = document.createElement('div');
      newRow.className = 'audio-track-row';
      newRow.style.marginBottom = '12px';
      newRow.innerHTML = `
        <input type="text" class="audio-url-input" placeholder="Ссылка на трек" style="width: 100%;">
        <input type="text" class="audio-title-input" placeholder="Название трека" style="width: 100%; margin-top: 4px;">
      `;
      audioUrlsContainer.appendChild(newRow);
    }
    const rows = Array.from(audioUrlsContainer.querySelectorAll('.audio-track-row'));
    rows.forEach((row, index) => {
      const urlInput = row.querySelector('.audio-url-input');
      const titleInput = row.querySelector('.audio-title-input');
      if (urlInput.value.trim() === '' && titleInput.value.trim() === '' && index !== rows.length - 1) {
        row.remove();
      }
    });
  }
});

async function updateAlbumDatalist() {
  const albums = await dbGetAll(STORE_ALBUMS);
  albumDatalist.innerHTML = albums.map(a => `<option value="${escapeHtml(a.name)}">`).join('');
}

async function checkAlbumExists(albumName) {
  if (!albumName) return false;
  const album = await dbGet(STORE_ALBUMS, albumName);
  return !!album;
}

document.getElementById('addBtn').addEventListener('click', async () => {
  document.getElementById('addSongForm').reset();
  audioUrlsContainer.innerHTML = `
    <div class="audio-track-row" style="margin-bottom: 12px;">
      <input type="text" class="audio-url-input" placeholder="Ссылка на трек" style="width: 100%;">
      <input type="text" class="audio-title-input" placeholder="Название трека" style="width: 100%; margin-top: 4px;">
    </div>
  `;
  await updateAlbumDatalist();
  document.getElementById('modalAdd').classList.add('active');
});

document.querySelector('#modalAdd .close').addEventListener('click', () => {
  closeModal(document.getElementById('modalAdd'));
});

document.getElementById('addSongForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const artist = document.getElementById('addArtist').value.trim();
  const album = document.getElementById('addAlbum').value.trim();
  const date = document.getElementById('addDate').value;
  const coverUrl = document.getElementById('addCoverUrl').value.trim();

  if (!artist) return alert('Введите исполнителя');

  const rows = Array.from(audioUrlsContainer.querySelectorAll('.audio-track-row'));
  const tracks = rows
    .map(row => ({
      url: row.querySelector('.audio-url-input').value.trim(),
      title: row.querySelector('.audio-title-input').value.trim()
    }))
    .filter(track => track.url !== '');

  if (tracks.length === 0) return alert('Добавьте хотя бы одну ссылку на аудиофайл');

  for (const track of tracks) {
    if (!track.title) {
      return alert('Укажите название для каждого трека, на который вы добавили ссылку');
    }
  }

  try {
    for (const track of tracks) {
      const newSong = {
        title: track.title,
        artist,
        album: album || '',
        date,
        audioUrl: track.url,
        coverUrl: coverUrl || '',
        ratings: [],
        comments: []
      };
      const addedSong = await dbAdd(STORE_SONGS, newSong);
      if (album) {
        const albumData = await dbGet(STORE_ALBUMS, album);
        if (albumData) {
          const currentOrder = albumData.trackOrder || [];
          currentOrder.push(addedSong.id);
          await dbPut(STORE_ALBUMS, { ...albumData, trackOrder: currentOrder });
        } else {
          await dbPut(STORE_ALBUMS, { name: album, ratings: [], trackOrder: [addedSong.id] });
        }
      }
    }
    closeModal(document.getElementById('modalAdd'));
    refreshAll();
    onDataChanged();
  } catch (err) {
    console.error(err);
    alert('Ошибка при сохранении треков');
  }
});

// ========== GITHUB SYNC (метаданные) ==========
async function syncWithGitHub(force = false) {
  if (typeof isSyncing !== 'undefined' && isSyncing) return;
  
  // 1. Проверяем наличие токена ДО того, как переключить флаг загрузки
  if (typeof githubToken === 'undefined' || !githubToken) {
    console.warn('Синхронизация пропущена: GitHub Token не указан в настройках.');
    if (typeof showNotification === 'function') {
      showNotification('Синхронизация недоступна: укажите токен в настройках ⚙️', true);
    }
    return;
  }
  
  // 2. Дополнительная проверка остальных параметров
  if (typeof githubUser === 'undefined' || !githubUser || typeof githubRepo === 'undefined' || !githubRepo) {
    console.warn('Синхронизация пропущена: Не указан пользователь или репозиторий GitHub.');
    return;
  }
  
  if (typeof setSyncing === 'function') {
    setSyncing(true);
  }
  
  const progressBar = document.getElementById('syncProgressContainer');
  const progressFill = document.getElementById('syncProgressFill');
  
  if (progressBar && progressBar.style) progressBar.style.display = 'flex';
  if (progressFill && progressFill.style) progressFill.style.width = '0%';
  
  try {
    if (progressFill && progressFill.style) progressFill.style.width = '30%';
    if (typeof uploadMetadataToGitHub === 'function') await uploadMetadataToGitHub();
    
    if (progressFill && progressFill.style) progressFill.style.width = '60%';
    let remoteData = null;
    if (typeof downloadMetadataFromGitHub === 'function') {
      remoteData = await downloadMetadataFromGitHub();
    }
    
    if (progressFill && progressFill.style) progressFill.style.width = '80%';
    if (remoteData) {
      if (typeof mergeRemoteMetadata === 'function') await mergeRemoteMetadata(remoteData);
      if (typeof uploadMetadataToGitHub === 'function') await uploadMetadataToGitHub();
    }
    
    if (progressFill && progressFill.style) progressFill.style.width = '100%';
    if (force && typeof showNotification === 'function') {
      showNotification('Синхронизация завершена');
    }
  } catch (err) {
    console.error('Синхронизация не удалась:', err);
    if (force && typeof showNotification === 'function') {
      showNotification('Ошибка синхронизации: ' + err.message);
    }
  } finally {
    // Безопасно скрываем прогресс-бар
    setTimeout(() => {
      const progressBar = document.getElementById('syncProgressContainer');
      if (progressBar && progressBar.style) {
        progressBar.style.display = 'none';
      }
    }, 500);
    
    if (typeof setSyncing === 'function') setSyncing(false);
    if (typeof refreshAll === 'function') refreshAll();
  }
}

async function downloadMetadataFromGitHub() {
  const url = `https://api.github.com/repos/${githubUser}/${githubRepo}/contents/bpt-data.json`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `token ${githubToken}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Ошибка загрузки: ${res.status}`);
  const data = await res.json();
  const binary = atob(data.content);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const decoder = new TextDecoder('utf-8');
  const jsonStr = decoder.decode(bytes);
  return JSON.parse(jsonStr);
}

async function uploadMetadataToGitHub() {
  const songs = await dbGetAll(STORE_SONGS);
  const albums = await dbGetAll(STORE_ALBUMS);
  const users = await dbGetAll(STORE_USERS);
  const songsMeta = songs.map(song => ({
    id: song.id,
    title: song.title,
    artist: song.artist,
    album: song.album,
    date: song.date,
    ratings: song.ratings,
    comments: song.comments,
    audioUrl: song.audioUrl || null,
    coverUrl: song.coverUrl || null
  }));
  const usersWithFavorites = users.map(user => ({
    ...user,
    favorites: JSON.parse(localStorage.getItem(`bpt_favorites_${user.id}`) || '[]')
  }));
  const metadata = { 
    version: 2, 
    songs: songsMeta, 
    albums, 
    users: usersWithFavorites,
    lastModified: Date.now()
  };
  const jsonStr = JSON.stringify(metadata, null, 2);
  const encoder = new TextEncoder();
  const utf8Bytes = encoder.encode(jsonStr);
  let binary = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  const base64content = btoa(binary);
  let sha = null;
  try {
    const check = await fetch(`https://api.github.com/repos/${githubUser}/${githubRepo}/contents/bpt-data.json`, {
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (check.ok) {
      const info = await check.json();
      sha = info.sha;
    }
  } catch (e) {}
  const body = {
    message: `Update ${new Date().toISOString()}`,
    content: base64content,
    branch: 'main'
  };
  if (sha) body.sha = sha;
  const res = await fetch(`https://api.github.com/repos/${githubUser}/${githubRepo}/contents/bpt-data.json`, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${githubToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Ошибка загрузки: ${res.status}`);
  }
}

async function mergeRemoteMetadata(remoteData) {
  const localSongs = await dbGetAll(STORE_SONGS);
  const localAlbums = await dbGetAll(STORE_ALBUMS);
  let conflictCount = 0;
  for (const remoteSong of remoteData.songs || []) {
    const local = localSongs.find(s => s.id === remoteSong.id);
    if (local) {
      let changed = false;
      if (!local.ratings) local.ratings = [];
      for (const remoteRating of remoteSong.ratings || []) {
        const localIdx = local.ratings.findIndex(r => r.userId === remoteRating.userId);
        if (localIdx === -1) {
          local.ratings.push(remoteRating);
          changed = true;
        } else {
          const localDate = new Date(local.ratings[localIdx].date);
          const remoteDate = new Date(remoteRating.date);
          if (Math.abs(remoteDate - localDate) < 5000) {
            conflictCount++;
          } else if (remoteDate > localDate) {
            local.ratings[localIdx] = remoteRating;
            changed = true;
          }
        }
      }
      if (!local.comments) local.comments = [];
      for (const remoteComment of remoteSong.comments || []) {
        const duplicate = local.comments.find(c =>
          c.userId === remoteComment.userId &&
          c.text === remoteComment.text &&
          c.date === remoteComment.date
        );
        if (!duplicate) {
          local.comments.push(remoteComment);
          changed = true;
        }
      }
      if (remoteSong.audioUrl && !local.audioUrl) {
        local.audioUrl = remoteSong.audioUrl;
        changed = true;
      }
      if (remoteSong.coverUrl && !local.coverUrl) {
        local.coverUrl = remoteSong.coverUrl;
        changed = true;
      }
      if (remoteSong.date && !local.date) {
        local.date = remoteSong.date;
        changed = true;
      }
      if (changed) await dbPut(STORE_SONGS, local);
    } else {
      const newSong = {
        ...remoteSong,
        audioUrl: remoteSong.audioUrl || null,
        coverUrl: remoteSong.coverUrl || null,
        ratings: remoteSong.ratings || [],
        comments: remoteSong.comments || [],
        audioBlob: null,
        coverBlob: null
      };
      await dbAdd(STORE_SONGS, newSong);
    }
  }
  if (remoteData.users) {
    for (const remoteUser of remoteData.users) {
      const localUser = await getUserByUsername(remoteUser.username);
      if (!localUser) {
        await dbAdd(STORE_USERS, remoteUser);
        if (remoteUser.favorites) {
          localStorage.setItem(`bpt_favorites_${remoteUser.id}`, JSON.stringify(remoteUser.favorites));
        }
      } else {
        const localFavs = JSON.parse(localStorage.getItem(`bpt_favorites_${localUser.id}`) || '[]');
        const remoteFavs = remoteUser.favorites || [];
        const mergedFavs = [...new Set([...localFavs, ...remoteFavs])];
        localStorage.setItem(`bpt_favorites_${localUser.id}`, JSON.stringify(mergedFavs));
      }
    }
  }
  if (remoteData.albums) {
    for (const remoteAlbum of remoteData.albums) {
      const exists = localAlbums.find(a => a.name === remoteAlbum.name);
      if (!exists) {
        await dbPut(STORE_ALBUMS, remoteAlbum);
      } else if (remoteAlbum.trackOrder) {
        const mergedOrder = [...remoteAlbum.trackOrder];
        for (const id of exists.trackOrder || []) {
          if (!mergedOrder.includes(id)) mergedOrder.push(id);
        }
        await dbPut(STORE_ALBUMS, { ...exists, trackOrder: mergedOrder });
      }
    }
  }
  if (conflictCount > 0) {
    showNotification(`Обнаружено ${conflictCount} конфликтов. Локальные данные сохранены.`);
  }
}

function onDataChanged() {
  if (githubUser && githubRepo && githubToken) {
    clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => syncWithGitHub(), 5000);
  }
}

document.getElementById('syncNowBtn').addEventListener('click', () => {
  syncWithGitHub(true);
});

// Поиск
document.getElementById('searchInput').addEventListener('input', (e) => {
  currentSearch = e.target.value;
  document.getElementById('clearSearchBtn').style.display = currentSearch ? 'block' : 'none';
  refreshAll();
});

document.getElementById('clearSearchBtn').addEventListener('click', () => {
  document.getElementById('searchInput').value = '';
  currentSearch = '';
  document.getElementById('clearSearchBtn').style.display = 'none';
  refreshAll();
});

// Сортировка
document.getElementById('sortDateBtn').addEventListener('click', () => setSort('date'));
document.getElementById('sortNameBtn').addEventListener('click', () => setSort('name'));
document.getElementById('sortRatingBtn').addEventListener('click', () => setSort('rating'));
document.getElementById('sortFavoritesBtn').addEventListener('click', () => setSort('favorites'));

function setSort(sort) {
  currentSort = sort;
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`sort${sort.charAt(0).toUpperCase() + sort.slice(1)}Btn`).classList.add('active');
  refreshAll();
}

// Избранное
function toggleFavorite(songId) {
  if (!currentUser) return;
  const key = `bpt_favorites_${currentUser.id}`;
  const favorites = JSON.parse(localStorage.getItem(key) || '[]');
  const index = favorites.indexOf(songId);
  if (index >= 0) {
    favorites.splice(index, 1);
  } else {
    favorites.push(songId);
  }
  localStorage.setItem(key, JSON.stringify(favorites));
  refreshAll();
  if (githubToken) {
    clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => syncWithGitHub(), 3000);
  }
}

function showNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  document.body.appendChild(notification);
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 2000);
}

// ========== ОБЩЕЕ ОБНОВЛЕНИЕ ==========
function refreshAll() {
  if (currentView === 'songs') {
    dbGetAll(STORE_SONGS).then(songs => {
      if (!songs || songs.length === 0) {
        dynamicList.innerHTML = '<div style="color:#888; text-align:center; padding:40px;">Нет треков</div>';
        topList.innerHTML = '';
        return;
      }
      const filtered = getFilteredAndSortedSongs(songs);
      renderSongs(filtered);
      renderTop12(songs);
    });
  } else {
    renderAlbums();
    renderTopAlbums();
  }
}

viewSongsBtn.addEventListener('click', showSongsView);
viewAlbumsBtn.addEventListener('click', showAlbumsView);

window.addEventListener('click', (e) => {
  document.querySelectorAll('.modal').forEach(m => {
    if (e.target === m) closeModal(m);
  });
});

// ========== СТАРТ ==========
openDB().then(() => initAdmin()).then(async () => {
  const savedId = getSavedUserId();
  if (savedId) {
    const user = await dbGet(STORE_USERS, savedId);
    if (user) {
      currentUser = user;
      showApp();
      refreshAll();
      if (githubUser && githubRepo && githubToken) {
        setTimeout(() => syncWithGitHub(), 1000);
      }
      return;
    } else {
      clearSession();
    }
  }
  showAuthScreen();
}).catch(err => {
  console.error(err);
  alert('Ошибка инициализации базы данных');
});

// Контекстное меню
document.addEventListener('contextmenu', (e) => {
  const card = e.target.closest('.card');
  if (card) {
    e.preventDefault();
    contextMenuSongId = card.dataset.id;
    const favs = getFavorites();
    const isFav = favs.includes(contextMenuSongId);
    const favItem = document.querySelector('.context-menu-favorite');
    if (favItem) {
      favItem.innerHTML = isFav ? '❤️ Удалить из избранного' : '❤️ В избранное';
    }
    const deleteItem = document.querySelector('.context-menu-delete');
    if (deleteItem) {
      deleteItem.style.display = currentUser?.isAdmin ? 'block' : 'none';
    }
    const menu = document.getElementById('contextMenu');
    menu.style.left = e.pageX + 'px';
    menu.style.top = e.pageY + 'px';
    menu.style.display = 'block';
  }
});

document.addEventListener('click', () => {
  document.getElementById('contextMenu').style.display = 'none';
});

// Обработчики пунктов контекстного меню
document.querySelectorAll('.context-menu-item').forEach(item => {
  item.addEventListener('click', () => {
    const action = item.dataset.action;
    if (!contextMenuSongId) return;
    if (action === 'play') playSong(contextMenuSongId);
    if (action === 'rate') openRatingModal(contextMenuSongId);
    if (action === 'comment') openCommentModal(contextMenuSongId);
    if (action === 'favorite') {
      toggleFavorite(contextMenuSongId);
      const isFav = getFavorites().includes(contextMenuSongId);
      showNotification(isFav ? 'Добавлено в избранное' : 'Удалено из избранного');
    }
    if (action === 'delete' && currentUser?.isAdmin) {
      showConfirm('Удалить трек?', () => {
        dbDelete(STORE_SONGS, contextMenuSongId).then(() => {
          refreshAll();
          syncWithGitHub();
        });
      });
    }
    document.getElementById('contextMenu').style.display = 'none';
  });
});

// Горячие клавиши
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === ' ') {
    e.preventDefault();
    if (audioPlayer.paused) audioPlayer.play();
    else audioPlayer.pause();
  }
  if (e.key === 'ArrowLeft') audioPlayer.currentTime -= 5;
  if (e.key === 'ArrowRight') audioPlayer.currentTime += 5;
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal.active').forEach(m => closeModal(m));
  }
});

// Функция плавного закрытия модального окна
function closeModal(modal) {
  if (!modal || !modal.classList.contains('active')) return;
  modal.classList.add('closing');
  setTimeout(() => {
    modal.classList.remove('active');
    modal.classList.remove('closing');
  }, 300);
}

// ========== ДВУХФАКТОРНАЯ АУТЕНТИФИКАЦИЯ ЧЕРЕЗ TELEGRAM ==========
async function onTelegramAuth(tgUser) {
  console.log('Данные от Telegram получены:', tgUser);
 
  const MY_TELEGRAM_ID = 696265271;

  if (!tgUser || !tgUser.id) {
    alert('Авторизация отклонена. Доступ заблокирован!');
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload(); 
    return;
  }

  if (tgUser.id === MY_TELEGRAM_ID) {
    let adminUser = await getUserByUsername('Letluvv');
    
    if (!adminUser) {
      adminUser = { 
        id: 'admin_tg_' + tgUser.id, 
        username: 'Letluvv', 
        passwordHash: 'tg_authorized', 
        isAdmin: true 
      };
      await dbPut(STORE_USERS, adminUser);
    }

    currentUser = adminUser;
    currentUser.isAdmin = true; 
    saveSession(currentUser.id);
    
    showApp();
    refreshAll();
  } else {
    alert('Доступ запрещен. Вы не являетесь владельцем проекта.');
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload(); 
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const authScreen = document.getElementById('authScreen');
  const authForm = document.getElementById('authForm');
  
  if (authScreen && authScreen.style.display !== 'none') {
    localStorage.removeItem('currentUserId');
    sessionStorage.removeItem('tg_user');
    if (typeof currentUser !== 'undefined') currentUser = null;
  }

  if (authForm) {
    authForm.addEventListener('submit', (e) => {
      const usernameInput = document.getElementById('username')?.value || '';
      
      if (usernameInput.trim() === 'Letluvv') {
        e.preventDefault(); 
        e.stopPropagation();
        alert('Вход для Letluvv возможен только через синюю кнопку Telegram!');
        return false;
      }
    });
  }
});