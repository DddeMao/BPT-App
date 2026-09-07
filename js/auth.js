/**
 * Аутентификация и управление пользователями
 */
const Auth = {
  currentUser: null,

  async hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  saveSession(userId) {
    localStorage.setItem(CONFIG.SESSION_KEY, userId);
  },

  clearSession() {
    localStorage.removeItem(CONFIG.SESSION_KEY);
    this.currentUser = null;
  },

  getSavedUserId() {
    return localStorage.getItem(CONFIG.SESSION_KEY);
  },

  // НОВЫЙ МЕТОД: Восстановление сессии при перезагрузке страницы
  async initSession() {
    const userId = this.getSavedUserId();
    if (!userId) return null;
    
    try {
      await DB.open();
      const user = await DB.get(CONFIG.STORE_USERS, userId);
      if (user) {
        this.currentUser = user;
        return user;
      } else {
        this.clearSession();
      }
    } catch (e) {
      console.error('[Auth] Ошибка восстановления сессии:', e);
      this.clearSession();
    }
    return null;
  },

  async initAdmin() {
    const users = await DB.getAll(CONFIG.STORE_USERS);
    const adminTgId = String(CONFIG.MY_TELEGRAM_ID);
    const expectedAdminId = 'tg_' + adminTgId;

    let adminUser = users.find(u => u.tgId === adminTgId || u.id === expectedAdminId || (u.username && u.username.toLowerCase() === 'letluvv'));

    if (!adminUser) {
      const adminHash = await this.hashPassword('123123');
      adminUser = {
        id: expectedAdminId,
        username: 'Letluvv',
        passwordHash: adminHash,
        isAdmin: true,
        tgId: adminTgId,
      };
      await DB.put(CONFIG.STORE_USERS, adminUser);
    } else {
      const oldId = adminUser.id;
      adminUser.id = expectedAdminId;
      adminUser.isAdmin = true;
      adminUser.tgId = adminTgId;
      adminUser.username = 'Letluvv';

      if (oldId && oldId !== expectedAdminId) {
        await DB.put(CONFIG.STORE_USERS, adminUser);
        await DB.delete(CONFIG.STORE_USERS, oldId);
        await Auth.migrateRatingsAndComments(oldId, expectedAdminId);
      } else {
        await DB.put(CONFIG.STORE_USERS, adminUser);
      }
    }
  },

  async handleLogin(username, password) {
    const user = await DB.getUserByUsername(username);
    if (!user) throw new Error('Неверный логин или пароль');
    const hash = await this.hashPassword(password);
    if (hash !== user.passwordHash) throw new Error('Неверный логин или пароль');
    this.currentUser = user;
    this.saveSession(user.id);
    return user;
  },

  async handleRegister(username, password) {
    const existing = await DB.getUserByUsername(username);
    if (existing) throw new Error('Пользователь с таким ником уже существует.');

    const passwordHash = await this.hashPassword(password);
    const user = { username, passwordHash, isAdmin: false };

    await DB.put(CONFIG.STORE_USERS, user);
    this.currentUser = user;
    this.saveSession(user.id);
    return user;
  },

  async onTelegramAuth(tgUser) {
    if (!tgUser || !tgUser.id) return;

    const tgId = String(tgUser.id);
    const deterministicId = 'tg_' + tgId;
    const allUsers = await DB.getAll(CONFIG.STORE_USERS);
    const isConfigAdmin = (tgId === String(CONFIG.MY_TELEGRAM_ID));

    let user = allUsers.find(u => u.tgId === tgId || u.id === deterministicId);

    if (user) {
      if (user.id !== deterministicId) {
        await DB.delete(CONFIG.STORE_USERS, user.id);
        user.id = deterministicId;
      }
      user.tgId = tgId;
      if (isConfigAdmin) {
        user.isAdmin = true;
        user.username = 'Letluvv';
      }
      await DB.put(CONFIG.STORE_USERS, user);
    } else {
      let baseName = isConfigAdmin ? 'Letluvv' : (tgUser.username || tgUser.first_name || ('tg_user_' + tgId));
      user = {
        id: deterministicId,
        username: baseName,
        passwordHash: 'tg_authorized',
        isAdmin: isConfigAdmin,
        tgId: tgId,
      };
      await DB.put(CONFIG.STORE_USERS, user);
    }

    this.currentUser = user;
    this.saveSession(user.id);
    if (typeof App !== 'undefined' && App.showApp) {
      App.showApp();
      App.refreshAll();
    }
  },

  async migrateRatingsAndComments(oldUserId, newUserId) {
    if (oldUserId === newUserId) return;
    try {
      const songs = await DB.getAll(CONFIG.STORE_SONGS);
      let changed = false;
      for (const song of songs) {
        let songChanged = false;
        if (song.ratings) {
          song.ratings.forEach(r => { if (String(r.userId) === String(oldUserId)) { r.userId = newUserId; songChanged = true; } });
        }
        if (song.comments) {
          song.comments.forEach(c => { if (String(c.userId) === String(oldUserId)) { c.userId = newUserId; songChanged = true; } });
        }
        if (songChanged) {
          await DB.put(CONFIG.STORE_SONGS, song);
          changed = true;
        }
      }
    } catch (err) {
      console.error('[Auth] Ошибка миграции:', err);
    }
  }
};

window.onTelegramAuth = (tgUser) => Auth.onTelegramAuth(tgUser);