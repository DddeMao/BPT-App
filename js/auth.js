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
  },

  getSavedUserId() {
    return localStorage.getItem(CONFIG.SESSION_KEY);
  },

  async initAdmin() {
    const users = await DB.getAll(CONFIG.STORE_USERS);
    if (users.length === 0) {
      const adminHash = await this.hashPassword('123123');
      await DB.add(CONFIG.STORE_USERS, { username: 'Letluvv', passwordHash: adminHash, isAdmin: true });
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
    if (existing) throw new Error('Пользователь с таким ником уже существует');
    const passwordHash = await this.hashPassword(password);
    const user = { username, passwordHash, isAdmin: false };
    await DB.add(CONFIG.STORE_USERS, user);
    this.saveSession(user.id);
    return user;
  },

  async onTelegramAuth(tgUser) {
    console.log('[TG Auth] Данные от Telegram:', tgUser);
    console.log('[TG Auth] Ожидаемый ID:', CONFIG.MY_TELEGRAM_ID);
    console.log('[TG Auth] Полученный ID:', tgUser?.id);
    console.log('[TG Auth] Совпадение:', tgUser?.id === CONFIG.MY_TELEGRAM_ID);

    if (!tgUser || !tgUser.id) {
      alert('Авторизация отклонена. Доступ заблокирован!');
      window.location.reload();
      return;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    if (tgUser.auth_date && (currentTime - tgUser.auth_date > 30)) {
      alert('Вход отменен. Чтобы сменить аккаунт, нажмите синюю кнопку Telegram и выберите «ВЫЙТИ» в углу попапа!');
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
      return;
    }

    if (tgUser.id === CONFIG.MY_TELEGRAM_ID) {
      let adminUser = await DB.getUserByUsername('Letluvv');
      if (!adminUser) {
        adminUser = {
          id: 'admin_tg_' + tgUser.id,
          username: 'Letluvv',
          passwordHash: 'tg_authorized',
          isAdmin: true,
        };
        await DB.put(CONFIG.STORE_USERS, adminUser);
        console.log('[TG Auth] Создан админ аккаунт:', adminUser);
      } else {
        console.log('[TG Auth] Найден существующий админ:', adminUser);
      }
      this.currentUser = adminUser;
      this.currentUser.isAdmin = true;
      this.saveSession(this.currentUser.id);
      App.showApp();
      App.refreshAll();
    } else {
      alert('Доступ запрещен. Ваш Telegram ID: ' + tgUser.id + ' не совпадает с ожидаемым.');
      window.location.reload();
    }
  },
};

// Глобальная функция для Telegram виджета
window.onTelegramAuth = (tgUser) => Auth.onTelegramAuth(tgUser);
