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
    const existingAdmin = users.find(u => u.username.toLowerCase() === 'letluvv' || u.isAdmin);
    if (!existingAdmin) {
      const adminHash = await this.hashPassword('123123');
      await DB.add(CONFIG.STORE_USERS, {
        username: 'Letlu',
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

    let user = null;

    // 1. Ищем пользователя по уже привязанному Telegram ID
    user = allUsers.find(u => u.tgId === tgId);

    // 2. Если не нашли по tgId, проверяем администратора
    if (!user) {
      const isTargetAdmin = (tgId === String(CONFIG.MY_TELEGRAM_ID)) || 
                            (tgUser.username && tgUser.username.toLowerCase() === 'letluvv') ||
                            (tgUser.first_name && tgUser.first_name.toLowerCase() === 'letluvv');

      if (isTargetAdmin) {
        user = allUsers.find(u => u.isAdmin || u.username.toLowerCase() === 'letluvv' || u.username.toLowerCase() === 'letlu');
      }
    }

    // 3. Пытаемся автоматически сопоставить по нику/имени Telegram
    if (!user) {
      const tgHandles = [
        (tgUser.username || '').toLowerCase(),
        (tgUser.first_name || '').toLowerCase()
      ].filter(Boolean);

      user = allUsers.find(u => !u.tgId && tgHandles.includes(u.username.toLowerCase()));
    }

    // 4. Если всё еще не нашли, выводим диалог выбора старого аккаунта для привязки
    if (!user) {
      const unlinkedOldUsers = allUsers.filter(u => !u.tgId);
      
      if (unlinkedOldUsers.length > 0) {
        const oldNicksList = unlinkedOldUsers.map(u => u.username).join(', ');
        const inputNick = prompt(
          `Вход через Telegram (@${tgUser.username || tgUser.first_name}).\n\n` +
          `Найдены существующие аккаунты без привязки к Telegram: [ ${oldNicksList} ].\n\n` +
          `Введите точный никнейм вашего старого аккаунта (например: Letlu), чтобы вернуть свои оценки и комментарии:`
        );

        if (inputNick) {
          user = unlinkedOldUsers.find(u => u.username.toLowerCase() === inputNick.trim().toLowerCase());
        }
      }
    }

    // 5. Если старый аккаунт найден — привязываем к нему tgId, сохраняя его оригинальный ID!
    if (user) {
      user.tgId = tgId;
      if (tgUser.first_name) user.tgFirstName = tgUser.first_name;
      if (tgUser.photo_url) user.tgPhotoUrl = tgUser.photo_url;
      await DB.put(CONFIG.STORE_USERS, user);
      console.log('[TG Auth] Старый аккаунт успешно привязан к Telegram:', user);

      // Удаляем временный/дублирующий аккаунт (если он успел создаться ранее)
      const dummyTgUser = allUsers.find(u => u.id === ('tg_' + tgId) && u.id !== user.id);
      if (dummyTgUser) {
        await DB.delete(CONFIG.STORE_USERS, dummyTgUser.id);
      }
    } else {
      // 6. Если старых аккаунтов нет — создаем новый профиль
      let baseName = tgUser.username || tgUser.first_name || ('tg_user_' + tgId);
      let finalUsername = baseName;

      let counter = 1;
      while (allUsers.some(u => u.username.toLowerCase() === finalUsername.toLowerCase())) {
        finalUsername = `${baseName}_${counter}`;
        counter++;
      }

      user = {
        id: 'tg_' + tgId,
        username: finalUsername,
        passwordHash: 'tg_authorized',
        isAdmin: false,
        tgId: tgId,
        tgFirstName: tgUser.first_name || '',
        tgPhotoUrl: tgUser.photo_url || '',
      };

      await DB.add(CONFIG.STORE_USERS, user);
      console.log('[TG Auth] Создан новый пользователь:', user);
    }

    this.currentUser = user;
    this.saveSession(user.id);
    App.showApp();
    App.refreshAll();
  },
};

window.onTelegramAuth = (tgUser) => Auth.onTelegramAuth(tgUser);