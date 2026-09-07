/**
 * Аутентификация и управление пользователями[cite: 7]
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
  },

  getSavedUserId() {
    return localStorage.getItem(CONFIG.SESSION_KEY);
  },

  async initAdmin() {
    const users = await DB.getAll(CONFIG.STORE_USERS);
    const existingAdmin = users.find(u => u.username.toLowerCase() === 'letluvv');
    if (!existingAdmin) {
      const adminHash = await this.hashPassword('123123');
      await DB.add(CONFIG.STORE_USERS, {
        username: 'Letluvv',
        passwordHash: adminHash,
        isAdmin: true,
        tgId: String(CONFIG.MY_TELEGRAM_ID),
      });
    } else {
      let needsUpdate = false;
      if (!existingAdmin.isAdmin) {
        existingAdmin.isAdmin = true;
        needsUpdate = true;
      }
      if (!existingAdmin.tgId) {
        existingAdmin.tgId = String(CONFIG.MY_TELEGRAM_ID);
        needsUpdate = true;
      }
      if (needsUpdate) {
        await DB.put(CONFIG.STORE_USERS, existingAdmin);
      }
    }
  },

  async handleLogin(username, password) {
    const user = await DB.getUserByUsername(username);
    if (!user) throw new Error('Неверный логин или пароль');
    const hash = await this.hashPassword(password);
    if (hash !== user.passwordHash) throw new Error('Неверный логин или пароль');
    this.saveSession(user.id);
    return user;
  },

  async handleRegister(username, password) {
    const existing = await DB.getUserByUsername(username);
    if (existing) throw new Error('Пользователь с таким ником уже существует. Попробуйте войти или выберите другой ник.');

    const passwordHash = await this.hashPassword(password);
    const user = { username, passwordHash, isAdmin: false };

    try {
      await DB.add(CONFIG.STORE_USERS, user);
    } catch (e) {
      if (e.name === 'ConstraintError' || e.message?.includes('unique') || e.message?.includes('already exists')) {
        throw new Error('Пользователь с таким ником уже существует. Попробуйте войти или выберите другой ник.');
      }
      throw e;
    }

    this.saveSession(user.id);
    return user;
  },

  async onTelegramAuth(tgUser) {
    console.log('[TG Auth] Данные от Telegram:', tgUser);

    if (!tgUser || !tgUser.id) {
      alert('Ошибка авторизации Telegram. Попробуйте ещё раз.');
      return;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    if (tgUser.auth_date && (currentTime - tgUser.auth_date > 86400)) {
      alert('Сессия устарела. Попробуйте войти снова.');
      return;
    }

    const tgId = String(tgUser.id);
    const allUsers = await DB.getAll(CONFIG.STORE_USERS);

    // 1. Проверяем существующего пользователя по сохраненному TG ID
    let user = allUsers.find(u => u.tgId === tgId);

    if (user) {
      this.currentUser = user;
      this.saveSession(user.id);
      App.showApp();
      App.refreshAll();
      return;
    }

    // 2. Надежный поиск администратора (проверка по ID из конфига, нику или имени в Telegram)
    const usernameLower = (tgUser.username || '').toLowerCase();
    const firstNameLower = (tgUser.first_name || '').toLowerCase();

    const existingAdmin = allUsers.find(u => 
      u.isAdmin && (
        u.tgId === tgId || 
        String(CONFIG.MY_TELEGRAM_ID) === tgId ||
        u.username.toLowerCase() === 'letluvv' ||
        usernameLower === 'letluvv' ||
        firstNameLower === 'letluvv'
      )
    );

    if (existingAdmin) {
      existingAdmin.tgId = tgId; // Привязываем актуальный TG ID
      await DB.put(CONFIG.STORE_USERS, existingAdmin);
      this.currentUser = existingAdmin;
      this.saveSession(existingAdmin.id);
      App.showApp();
      App.refreshAll();
      return;
    }

    const username = tgUser.username || tgUser.first_name || 'tg_user_' + tgUser.id;
    const existingByName = await DB.getUserByUsername(username);
    
    user = {
      id: 'tg_' + tgUser.id,
      username: existingByName ? (username + '_' + tgUser.id) : username,
      passwordHash: 'tg_authorized',
      isAdmin: false,
      tgId: tgId,
      tgFirstName: tgUser.first_name || '',
      tgPhotoUrl: tgUser.photo_url || '',
    };

    await DB.add(CONFIG.STORE_USERS, user);
    console.log('[TG Auth] Зарегистрирован новый пользователь:', user);
    this.currentUser = user;
    this.saveSession(user.id);
    App.showApp();
    App.refreshAll();
  },
};

window.onTelegramAuth = (tgUser) => Auth.onTelegramAuth(tgUser);