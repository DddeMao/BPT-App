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
    const adminTgId = String(CONFIG.MY_TELEGRAM_ID);
    const expectedAdminId = 'tg_' + adminTgId;

    let adminUser = users.find(u => u.tgId === adminTgId || u.id === expectedAdminId || u.username.toLowerCase() === 'letlu' || u.username.toLowerCase() === 'letluvv');

    if (!adminUser) {
      const adminHash = await this.hashPassword('123123');
      adminUser = {
        id: expectedAdminId,
        username: 'Letlu',
        passwordHash: adminHash,
        isAdmin: true,
        tgId: adminTgId,
      };
      await DB.put(CONFIG.STORE_USERS, adminUser);
    } else {
      let needsUpdate = false;
      if (!adminUser.isAdmin) {
        adminUser.isAdmin = true;
        needsUpdate = true;
      }
      if (!adminUser.tgId) {
        adminUser.tgId = adminTgId;
        needsUpdate = true;
      }
      if (adminUser.id !== expectedAdminId) {
        const oldId = adminUser.id;
        adminUser.id = expectedAdminId;
        await DB.put(CONFIG.STORE_USERS, adminUser);
        await DB.delete(CONFIG.STORE_USERS, oldId);
        await Auth.migrateRatingsAndComments(oldId, expectedAdminId);
      } else if (needsUpdate) {
        await DB.put(CONFIG.STORE_USERS, adminUser);
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
    const deterministicId = 'tg_' + tgId;
    const allUsers = await DB.getAll(CONFIG.STORE_USERS);
    const isConfigAdmin = (tgId === String(CONFIG.MY_TELEGRAM_ID));

    // Ищем существующего пользователя по tgId, фиксированному ID или старым никам
    let user = allUsers.find(u => u.tgId === tgId || u.id === deterministicId);

    if (!user && isConfigAdmin) {
      user = allUsers.find(u => u.isAdmin || u.username.toLowerCase() === 'letlu' || u.username.toLowerCase() === 'letluvv');
    }

    if (!user && tgUser.username) {
      const tgHandle = tgUser.username.toLowerCase();
      user = allUsers.find(u => !u.tgId && u.username.toLowerCase() === tgHandle);
    }

    if (!user) {
      user = allUsers.find(u => !u.tgId && (u.username.toLowerCase() === 'letlu' || u.username.toLowerCase() === 'letluvv'));
    }

    let oldIdsToMigrate = [];

    if (user) {
      if (user.id !== deterministicId) {
        oldIdsToMigrate.push(user.id);
        await DB.delete(CONFIG.STORE_USERS, user.id);
        user.id = deterministicId;
      }
      user.tgId = tgId;
      if (isConfigAdmin) {
        user.isAdmin = true;
        user.username = 'Letlu'; // Жестко фиксируем кастомный ник админа
      } else if (!user.username || user.username.toLowerCase().startsWith('tg_user_')) {
        user.username = tgUser.username || tgUser.first_name || 'User';
      }
      if (tgUser.first_name) user.tgFirstName = tgUser.first_name;
      if (tgUser.photo_url) user.tgPhotoUrl = tgUser.photo_url;

      await DB.add(CONFIG.STORE_USERS, user);
    } else {
      let baseName = isConfigAdmin ? 'Letlu' : (tgUser.username || tgUser.first_name || ('tg_user_' + tgId));
      let finalUsername = baseName;
      let counter = 1;
      while (allUsers.some(u => u.username.toLowerCase() === finalUsername.toLowerCase() && u.id !== deterministicId)) {
        finalUsername = `${baseName}_${counter}`;
        counter++;
      }

      user = {
        id: deterministicId,
        username: finalUsername,
        passwordHash: 'tg_authorized',
        isAdmin: isConfigAdmin,
        tgId: tgId,
        tgFirstName: tgUser.first_name || '',
        tgPhotoUrl: tgUser.photo_url || '',
      };

      await DB.add(CONFIG.STORE_USERS, user);
    }

    // Переносим старые оценки со всех старых/дублирующихся ID на текущий детерминированный ID
    for (const oldId of oldIdsToMigrate) {
      if (oldId !== user.id) {
        await Auth.migrateRatingsAndComments(oldId, user.id);
      }
    }

    const dummyUsers = allUsers.filter(u => u.tgId === tgId && u.id !== user.id);
    for (const dummy of dummyUsers) {
      await Auth.migrateRatingsAndComments(dummy.id, user.id);
      await DB.delete(CONFIG.STORE_USERS, dummy.id);
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
        console.log(`[Auth] Успешно перенесены оценки/комментарии с ID ${oldUserId} на ID ${newUserId}`);
      }
    } catch (err) {
      console.error('[Auth] Ошибка миграции:', err);
    }
  }
};

window.onTelegramAuth = (tgUser) => Auth.onTelegramAuth(tgUser);