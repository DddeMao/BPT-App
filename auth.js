// ========== AUTHENTICATION ==========
let currentUser = null;
const SESSION_KEY = 'bpt_currentUserId';
let authMode = 'login';

function saveSession(id) { localStorage.setItem(SESSION_KEY, id); }
function clearSession() { localStorage.removeItem(SESSION_KEY); }
function getSavedUserId() { return localStorage.getItem(SESSION_KEY); }

async function hashPassword(password) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(password));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

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
  const user = { username, passwordHash: await hashPassword(password), isAdmin: false };
  await dbAdd(STORE_USERS, user);
  saveSession(user.id);
  return user;
}

// Listen for Telegram auth event from inline script in index.html
window.addEventListener('telegram-auth', async (e) => {
  const tgUser = e.detail;
  console.log('TG auth event received:', tgUser);
  try {
    if (!tgUser?.id) { alert('Авторизация отклонена.'); return; }
    const MY_TG_ID = 696265271;
    const isAdmin = (tgUser.id === MY_TG_ID);
    const userId = 'tg_' + tgUser.id;
    let user = await dbGet(STORE_USERS, userId);
    if (!user) {
      user = {
        id: userId,
        username: tgUser.username || tgUser.first_name || 'user_' + tgUser.id,
        passwordHash: 'tg_authorized',
        isAdmin,
        tgId: tgUser.id,
        photoUrl: tgUser.photo_url || ''
      };
      await dbAdd(STORE_USERS, user);
    } else {
      user.username = tgUser.username || tgUser.first_name || user.username;
      user.photoUrl = tgUser.photo_url || '';
      user.isAdmin = isAdmin;
      await dbPut(STORE_USERS, user);
    }
    currentUser = user;
    saveSession(currentUser.id);
    showApp();
    navigate('home');
    console.log('TG auth success, app shown');
  } catch (err) {
    console.error('TG auth error:', err);
    alert('Ошибка: ' + err.message);
  }
});

function showAuthScreen() {
  const app = document.getElementById('app');
  const auth = document.getElementById('authScreen');
  if (app) app.style.display = 'none';
  if (auth) auth.style.display = 'flex';
  const u = document.getElementById('authUsername');
  const p = document.getElementById('authPassword');
  if (u) u.value = '';
  if (p) p.value = '';
}

function showApp() {
  console.log('showApp called');
  const auth = document.getElementById('authScreen');
  const app = document.getElementById('app');
  
  if (auth) {
    auth.style.display = 'none';
    // Force override the CSS !important rule
    auth.style.setProperty('display', 'none', 'important');
    console.log('authScreen set to none, computed:', getComputedStyle(auth).display);
  }
  if (app) {
    app.style.display = 'block';
    console.log('app set to block, computed:', getComputedStyle(app).display);
  }
  
  updateAdminUI();
  console.log('showApp done');
}

function updateAdminUI() {
  const isAdmin = currentUser?.isAdmin;
  const addBtn = document.getElementById('addBtn');
  const delBtn = document.getElementById('deleteAlbumBtn');
  if (addBtn) addBtn.style.display = isAdmin ? 'inline-block' : 'none';
  if (delBtn) delBtn.style.display = isAdmin ? 'inline-block' : 'none';
}
