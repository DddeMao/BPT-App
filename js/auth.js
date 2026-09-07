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
    const existingAdmin = users.find(u => u.isAdmin || u.username.toLowerCase() === 'letlu' || u.username.toLowerCase() === 'letluvv');
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
    const isConfigAdmin = (tgId === String(CONFIG.MY_TELEGRAM_ID));

    if (isConfigAdmin) {
      user = allUsers.find(u => u.isAdmin || u.username.toLowerCase() === 'letluvv');
    }

    if (!user) {
      user = allUsers.find(u => u.tgId === tgId);
    }

    if (!user && tgUser.username) {
      const tgHandle = tgUser.username.toLowerCase();
      user = allUsers.find(u => !u.tgId && u.username.toLowerCase() === tgHandle);
    }

    if (!user && isConfigAdmin) {
      user = {
        username: 'Letlu',
        passwordHash: await this.hashPassword('123123'),
        isAdmin: true,
        tgId: tgId,
      };
      await DB.add(CONFIG.STORE_USERS, user);
    }

    if (!user) {
      const unlinked = allUsers.filter(u => !u.tgId);
      if (unlinked.length === 1) {
        user = unlinked[0];
      }
    }

    if (user) {
      const oldUserId = user.id;
      user.tgId = tgId;
      if (isConfigAdmin) user.isAdmin = true;
      if (tgUser.first_name) user.tgFirstName = tgUser.first_name;
      if (tgUser.photo_url) user.tgPhotoUrl = tgUser.photo_url;
      await DB.put(CONFIG.STORE_USERS, user);

      const dummyId = 'tg_' + tgId;
      if (oldUserId !== dummyId) {
        await Auth.migrateRatingsAndComments(dummyId, user.id);
        const dummyUser = allUsers.find(u => u.id === dummyId);
        if (dummyUser) {
          await DB.delete(CONFIG.STORE_USERS, dummyId);
        }
      }

      console.log('[TG Auth] Аккаунт успешно синхронизирован с Telegram:', user);
    } else {
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
        isAdmin: isConfigAdmin,
        tgId: tgId,
        tgFirstName: tgUser.first_name || '',
        tgPhotoUrl: tgUser.photo_url || '',
      };

      await DB.add(CONFIG.STORE_USERS, user);
      console.log('[TG Auth] Создан новый профиль:', user);
    }

    this.currentUser = user;
    this.saveSession(user.id);
    App.showApp();
    App.refreshAll();
  },

  async migrateRatingsAndComments(oldUserId, newUserId) {
    if (oldUserId === newUserId) return;
    try {
      const songs = await DB.getAll(CONFIG.STORE_SONGS);
      let changed = false;
      for (const song of songs) {
        let songChanged = false;
        if (song.ratings) {
          for (const r of song.ratings) {
            if (String(r.userId) === String(oldUserId)) {
              r.userId = newUserId;
              songChanged = true;
            }
          }
        }
        if (song.comments) {
          for (const c of song.comments) {
            if (String(c.userId) === String(oldUserId)) {
              c.userId = newUserId;
              songChanged = true;
            }
          }
        }
        if (songChanged) {
          await DB.put(CONFIG.STORE_SONGS, song);
          changed = true;
        }
      }
      if (changed) {
        console.log(`[Auth] Успешно перенесены старые оценки/комментарии с ID ${oldUserId} на ID ${newUserId}`);
      }
    } catch (err) {
      console.error('[Auth] Ошибка при миграции оценок:', err);
    }
  }
};

window.onTelegramAuth = (tgUser) => Auth.onTelegramAuth(tgUser);