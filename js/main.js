/**
 * Точка входа — инициализация и связывание модулей
 */
const App = {
  init() {
    this.bindGlobalEvents();
  },

  // ========== ОБРАБОТЧИКИ СОБЫТИЙ ==========

  bindGlobalEvents() {
    // Кнопки навигации
    document.getElementById('viewSongsBtn').addEventListener('click', () => this.showSongsView());
    document.getElementById('viewAlbumsBtn').addEventListener('click', () => this.showAlbumsView());

    // Аутентификация
    document.getElementById('authForm').addEventListener('submit', (e) => this.handleAuthSubmit(e));
    document.getElementById('toggleAuthMode').addEventListener('click', (e) => this.toggleAuthMode(e));
    document.getElementById('logoutBtn').addEventListener('click', () => this.handleLogout());

    // Настройки
    document.getElementById('settingsBtn').addEventListener('click', () => this.openSettings());
    document.querySelector('.close-settings').addEventListener('click', () => UI.closeModal(document.getElementById('modalSettings')));
    document.getElementById('settingsForm').addEventListener('submit', (e) => this.handleSettingsSubmit(e));

    // Добавление трека
    document.getElementById('addBtn').addEventListener('click', () => UI.openAddModal());
    document.querySelector('#modalAdd .close').addEventListener('click', () => UI.closeModal(document.getElementById('modalAdd')));
    document.getElementById('addSongForm').addEventListener('submit', (e) => this.handleAddSong(e));

    // Редактирование трека
    document.querySelector('.close-edit').addEventListener('click', () => UI.closeModal(document.getElementById('modalEdit')));
    document.getElementById('editSongForm').addEventListener('submit', (e) => this.handleEditSong(e));

    // Оценка трека
    document.querySelector('.close-rating').addEventListener('click', () => UI.closeModal(document.getElementById('modalRating')));
    document.getElementById('ratingForm').addEventListener('submit', (e) => this.handleRatingSubmit(e));

    // Оценка альбома
    document.querySelector('.close-album-rating').addEventListener('click', () => UI.closeModal(document.getElementById('modalAlbumRating')));
    document.getElementById('albumRatingForm').addEventListener('submit', (e) => this.handleAlbumRatingSubmit(e));

    // Комментарии
    document.querySelector('.close-comment').addEventListener('click', () => UI.closeModal(document.getElementById('modalComment')));
    document.getElementById('addCommentBtn').addEventListener('click', () => this.handleAddComment());

    // Синхронизация
    document.getElementById('syncNowBtn').addEventListener('click', () => Sync.sync(true));

    // Поиск
    document.getElementById('searchInput').addEventListener('input', (e) => {
      UI.currentSearch = e.target.value;
      document.getElementById('clearSearchBtn').style.display = UI.currentSearch ? 'block' : 'none';
      this.refreshAll();
    });
    document.getElementById('clearSearchBtn').addEventListener('click', () => {
      document.getElementById('searchInput').value = '';
      UI.currentSearch = '';
      document.getElementById('clearSearchBtn').style.display = 'none';
      this.refreshAll();
    });

    // Сортировка
    document.getElementById('sortDateBtn').addEventListener('click', () => this.setSort('date'));
    document.getElementById('sortNameBtn').addEventListener('click', () => this.setSort('name'));
    document.getElementById('sortRatingBtn').addEventListener('click', () => this.setSort('rating'));
    document.getElementById('sortFavoritesBtn').addEventListener('click', () => this.setSort('favorites'));

    // Закрытие модалок по клику на фон
    window.addEventListener('click', (e) => {
      document.querySelectorAll('.modal').forEach(m => {
        if (e.target === m) UI.closeModal(m);
      });
    });

    // Горячие клавиши
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === ' ') { e.preventDefault(); Player.audio.paused ? Player.audio.play() : Player.audio.pause(); }
      if (e.key === 'ArrowLeft') Player.audio.currentTime -= 5;
      if (e.key === 'ArrowRight') Player.audio.currentTime += 5;
      if (e.key === 'Escape') document.querySelectorAll('.modal.active').forEach(m => UI.closeModal(m));
    });

    // Контекстное меню
    this.bindContextMenu();

    // Динамические поля аудио
    this.bindAudioUrlFields();

    // Автозаполнение тегов
    this.bindTagReader();
  },

  bindContextMenu() {
    document.addEventListener('contextmenu', (e) => {
      const card = e.target.closest('.card');
      if (card) {
        e.preventDefault();
        UI.contextMenuSongId = card.dataset.id;
        const favs = UI.getFavorites();
        const isFav = favs.includes(UI.contextMenuSongId);
        const favItem = document.querySelector('.context-menu-favorite');
        if (favItem) favItem.innerHTML = isFav ? '❤️ Удалить из избранного' : '❤️ В избранное';
        const deleteItem = document.querySelector('.context-menu-delete');
        if (deleteItem) deleteItem.style.display = Auth.currentUser?.isAdmin ? 'block' : 'none';
        const menu = document.getElementById('contextMenu');
        menu.style.left = e.pageX + 'px';
        menu.style.top = e.pageY + 'px';
        menu.style.display = 'block';
      }
      const adminItems = document.querySelectorAll('.admin-only-item');
      adminItems.forEach(item => { item.style.display = Auth.currentUser?.isAdmin ? 'block' : 'none'; });
    });

    document.addEventListener('click', () => {
      document.getElementById('contextMenu').style.display = 'none';
    });

    document.querySelectorAll('.context-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        if (!UI.contextMenuSongId) return;
        if (action === 'play') Player.play(UI.contextMenuSongId);
        if (action === 'rate') UI.openRatingModal(UI.contextMenuSongId);
        if (action === 'comment') UI.openCommentModal(UI.contextMenuSongId);
        if (action === 'favorite') {
          UI.toggleFavorite(UI.contextMenuSongId);
          const isFav = UI.getFavorites().includes(UI.contextMenuSongId);
          UI.showNotification(isFav ? 'Добавлено в избранное' : 'Удалено из избранного');
        }
        if (action === 'edit') UI.openEditModal(UI.contextMenuSongId);
        if (action === 'delete' && Auth.currentUser?.isAdmin) {
          if (confirm('Удалить этот трек?')) {
            DB.delete(CONFIG.STORE_SONGS, UI.contextMenuSongId).then(() => {
              this.refreshAll();
              Sync.sync();
            });
          }
        }
        document.getElementById('contextMenu').style.display = 'none';
      });
    });
  },

  bindAudioUrlFields() {
    const container = document.getElementById('audioUrlsContainer');
    container.addEventListener('input', function(e) {
      if (e.target.classList.contains('audio-url-input') || e.target.classList.contains('audio-title-input')) {
        const allRows = Array.from(container.querySelectorAll('.audio-track-row'));
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
          container.appendChild(newRow);
        }
        const rows = Array.from(container.querySelectorAll('.audio-track-row'));
        rows.forEach((row, index) => {
          const urlInput = row.querySelector('.audio-url-input');
          const titleInput = row.querySelector('.audio-title-input');
          if (urlInput.value.trim() === '' && titleInput.value.trim() === '' && index !== rows.length - 1) {
            row.remove();
          }
        });
      }
    });
  },

  bindTagReader() {
    document.getElementById('songAudio').addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (!file) return;
      if (typeof jsmediatags === 'undefined') { console.error('jsmediatags не загружена'); return; }

      jsmediatags.read(file, {
        onSuccess: function(tag) {
          const tags = tag.tags;
          if (tags.title) document.getElementById('songTitle').value = tags.title;
          else document.getElementById('songTitle').value = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
          if (tags.artist) document.getElementById('songArtist').value = tags.artist;
          if (tags.album) document.getElementById('songAlbum').value = tags.album;
          if (tags.picture) {
            const image = tags.picture;
            let base64String = '';
            for (let i = 0; i < image.data.length; i++) base64String += String.fromCharCode(image.data[i]);
            const base64 = 'data:' + image.format + ';base64,' + btoa(base64String);
            fetch(base64).then(res => res.blob()).then(blob => {
              const coverFile = new File([blob], 'cover_from_tags.jpg', { type: image.format });
              const dataTransfer = new DataTransfer();
              dataTransfer.items.add(coverFile);
              const coverInput = document.getElementById('songCover');
              if (coverInput) coverInput.files = dataTransfer.files;
            }).catch(err => console.error('Не удалось распарсить обложку:', err));
          }
        },
        onError: function() {
          const titleInput = document.getElementById('songTitle');
          if (titleInput && !titleInput.value) titleInput.value = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        },
      });
    });
  },

  // ========== АУТЕНТИФИКАЦИЯ ==========

  authMode: 'login',

  async handleAuthSubmit(e) {
    e.preventDefault();
    const username = document.getElementById('authUsername').value.trim();
    const password = document.getElementById('authPassword').value;
    if (!username || !password) return;

    if (username.toLowerCase() === 'letluvv') {
      UI.showNotification('Для аккаунта Letluvv вход через Telegram обязателен! 🔒', true);
      const tgButton = document.getElementById('telegram-login-container');
      if (tgButton) {
        tgButton.style.transform = 'scale(1.05)';
        tgButton.style.transition = 'transform 0.2s ease';
        setTimeout(() => tgButton.style.transform = 'scale(1)', 300);
      }
      return;
    }

    try {
      if (this.authMode === 'login') {
        Auth.currentUser = await Auth.handleLogin(username, password);
      } else {
        Auth.currentUser = await Auth.handleRegister(username, password);
      }
      this.showApp();
      this.refreshAll();
    } catch (err) {
      alert(err.message);
    }
  },

  toggleAuthMode(e) {
    e.preventDefault();
    this.authMode = this.authMode === 'login' ? 'register' : 'login';
    document.getElementById('authTitle').textContent = this.authMode === 'login' ? 'Вход' : 'Регистрация';
    document.getElementById('toggleAuthMode').textContent = this.authMode === 'login' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти';
    document.getElementById('authUsername').readOnly = false;
    const tgBlock = document.getElementById('tgAdminBlock');
    if (tgBlock) tgBlock.style.display = this.authMode === 'login' ? 'block' : 'none';
  },

  handleLogout() {
    Auth.currentUser = null;
    Auth.clearSession();
    this.showAuthScreen();
  },

  // ========== ЭКРАНЫ ==========

  showAuthScreen() {
    document.getElementById('app').style.display = 'none';
    document.getElementById('authScreen').style.display = 'flex';
    document.getElementById('authUsername').value = '';
    document.getElementById('authPassword').value = '';
  },

  showApp() {
    if (!Auth.currentUser || !Auth.currentUser.isAdmin) {
      console.error('Заблокирована попытка несанкционированного вызова showApp()!');
      if (document.getElementById('app')) document.getElementById('app').style.display = 'none';
      if (document.getElementById('player')) document.getElementById('player').style.display = 'none';
      if (document.getElementById('authScreen')) document.getElementById('authScreen').style.display = 'flex';
      return;
    }
    document.getElementById('app').style.display = 'flex';
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('currentUserDisplay').textContent = `👤 ${Auth.currentUser.username}`;
    document.getElementById('addBtn').style.display = Auth.currentUser.isAdmin ? 'inline-block' : 'none';
    document.getElementById('deleteAlbumBtn').style.display = Auth.currentUser.isAdmin ? 'inline-block' : 'none';
    document.getElementById('syncNowBtn').style.display = 'inline-block';
    this.updateAdminUI();
  },

  updateAdminUI() {
    const isAdmin = Auth.currentUser?.isAdmin;
    document.getElementById('addBtn').style.display = isAdmin ? 'inline-block' : 'none';
    document.getElementById('deleteAlbumBtn').style.display = isAdmin ? 'inline-block' : 'none';
  },

  // ========== ВИДЫ ==========

  showSongsView() {
    UI.currentView = 'songs';
    document.getElementById('viewSongsBtn').classList.add('btn-active');
    document.getElementById('viewAlbumsBtn').classList.remove('btn-active');
    document.getElementById('topSidebar').style.display = 'block';
    document.getElementById('topAlbumsSidebar').style.display = 'none';
    const searchBar = document.querySelector('.search-sort-bar');
    if (searchBar) searchBar.style.display = 'flex';
    DB.getAll(CONFIG.STORE_SONGS).then(songs => {
      const filtered = UI.getFilteredAndSortedSongs(songs);
      UI.renderSongs(filtered);
      UI.renderTop12(songs);
    });
  },

  showAlbumsView() {
    UI.currentView = 'albums';
    document.getElementById('viewAlbumsBtn').classList.add('btn-active');
    document.getElementById('viewSongsBtn').classList.remove('btn-active');
    document.getElementById('topSidebar').style.display = 'none';
    document.getElementById('topAlbumsSidebar').style.display = 'block';
    document.querySelector('.search-sort-bar').style.display = 'none';
    UI.renderAlbums();
    UI.renderTopAlbums();
  },

  refreshAll() {
    if (UI.currentView === 'songs') {
      DB.getAll(CONFIG.STORE_SONGS).then(songs => {
        if (!songs || songs.length === 0) {
          document.getElementById('dynamicList').innerHTML = '<div style="color:#888; text-align:center; padding:40px;">Нет треков</div>';
          document.getElementById('topList').innerHTML = '';
          return;
        }
        const filtered = UI.getFilteredAndSortedSongs(songs);
        UI.renderSongs(filtered);
        UI.renderTop12(songs);
      });
    } else {
      UI.renderAlbums();
      UI.renderTopAlbums();
    }
  },

  // ========== СОРТИРОВКА ==========

  setSort(sort) {
    UI.currentSort = sort;
    document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`sort${sort.charAt(0).toUpperCase() + sort.slice(1)}Btn`).classList.add('active');
    this.refreshAll();
  },

  // ========== НАСТРОЙКИ ==========

  openSettings() {
    document.getElementById('newUsername').value = Auth.currentUser.username;
    document.getElementById('settingsPassword').value = '';
    const tokenInput = document.getElementById('settingsGithubToken');
    if (tokenInput) tokenInput.value = localStorage.getItem('bpt_github_token') || '';
    document.getElementById('modalSettings').classList.add('active');
    this.updateAdminUI();
  },

  async handleSettingsSubmit(e) {
    e.preventDefault();
    const newUsername = document.getElementById('newUsername').value.trim();
    const password = document.getElementById('settingsPassword').value;
    if (!newUsername) return;

    const skipPasswordCheck = (Auth.currentUser.username === 'Letluvv' || Auth.currentUser.isAdmin || Auth.currentUser.passwordHash === 'tg_authorized');
    if (!skipPasswordCheck && !password) {
      UI.showNotification('Введите пароль для сохранения!', true);
      return;
    }

    try {
      if (!skipPasswordCheck) {
        const hash = await Auth.hashPassword(password);
        if (hash !== Auth.currentUser.passwordHash) throw new Error('Неверный пароль');
      }

      if (newUsername !== Auth.currentUser.username) {
        const existing = await DB.getUserByUsername(newUsername);
        if (existing) throw new Error('Этот ник уже занят');

        const updatedUser = { ...Auth.currentUser, username: newUsername };
        await DB.put(CONFIG.STORE_USERS, updatedUser);

        const songs = await DB.getAll(CONFIG.STORE_SONGS);
        for (const song of songs) {
          let changed = false;
          if (song.ratings) {
            for (const r of song.ratings) {
              if (r.userId === Auth.currentUser.id) { r.username = newUsername; changed = true; }
            }
          }
          if (song.comments) {
            for (const c of song.comments) {
              if (c.userId === Auth.currentUser.id) { c.username = newUsername; changed = true; }
            }
          }
          if (changed) await DB.put(CONFIG.STORE_SONGS, song);
        }

        const albums = await DB.getAll(CONFIG.STORE_ALBUMS);
        for (const album of albums) {
          if (album.ratings) {
            let changed = false;
            for (const r of album.ratings) {
              if (r.userId === Auth.currentUser.id) { r.username = newUsername; changed = true; }
            }
            if (changed) await DB.put(CONFIG.STORE_ALBUMS, album);
          }
        }

        Auth.currentUser = updatedUser;
        const userDisplay = document.getElementById('currentUserDisplay');
        if (userDisplay) userDisplay.textContent = `👤 ${Auth.currentUser.username}`;
      }

      const tokenInput = document.getElementById('settingsGithubToken');
      if (tokenInput) {
        const newTokenValue = tokenInput.value.trim();
        localStorage.setItem('bpt_github_token', newTokenValue);
        Sync.token = newTokenValue;
      }

      UI.showNotification('Настройки успешно сохранены!');
      UI.closeModal(document.getElementById('modalSettings'));
      this.refreshAll();
      Sync.onDataChanged();
      if (Sync.token) Sync.sync();
    } catch (error) {
      console.error('Ошибка изменения настроек:', error);
      UI.showNotification(error.message, true);
    }
  },

  // ========== ДОБАВЛЕНИЕ ТРЕКА ==========

  async handleAddSong(e) {
    e.preventDefault();
    const artist = document.getElementById('addArtist').value.trim();
    const album = document.getElementById('addAlbum').value.trim();
    const date = document.getElementById('addDate').value;
    const rawCoverUrl = document.getElementById('addCoverUrl').value.trim();
    const coverUrl = UI.fixDropboxUrl(rawCoverUrl);

    if (!artist) return alert('Введите исполнителя');

    const rows = Array.from(document.getElementById('audioUrlsContainer').querySelectorAll('.audio-track-row'));
    const tracks = rows
      .map(row => ({
        url: UI.fixDropboxUrl(row.querySelector('.audio-url-input').value.trim()),
        title: row.querySelector('.audio-title-input').value.trim(),
      }))
      .filter(track => track.url !== '');

    if (tracks.length === 0) return alert('Добавьте хотя бы одну ссылку на аудиофайл');
    for (const track of tracks) {
      if (!track.title) return alert('Укажите название для каждого трека');
    }

    try {
      for (const track of tracks) {
        const newSong = {
          title: track.title, artist, album: album || '', date,
          audioUrl: track.url, coverUrl: coverUrl || '',
          ratings: [], comments: [],
        };
        const addedSong = await DB.add(CONFIG.STORE_SONGS, newSong);
        if (album) {
          const albumData = await DB.get(CONFIG.STORE_ALBUMS, album);
          if (albumData) {
            const currentOrder = albumData.trackOrder || [];
            currentOrder.push(addedSong.id);
            await DB.put(CONFIG.STORE_ALBUMS, { ...albumData, trackOrder: currentOrder });
          } else {
            await DB.put(CONFIG.STORE_ALBUMS, { name: album, ratings: [], trackOrder: [addedSong.id] });
          }
        }
      }
      UI.closeModal(document.getElementById('modalAdd'));
      this.refreshAll();
      Sync.onDataChanged();
    } catch (err) {
      console.error(err);
      alert('Ошибка при сохранении треков');
    }
  },

  // ========== РЕДАКТИРОВАНИЕ ТРЕКА ==========

  async handleEditSong(e) {
    e.preventDefault();
    if (!Auth.currentUser || !Auth.currentUser.isAdmin) return;

    const songId = document.getElementById('editSongId').value;
    const songs = await DB.getAll(CONFIG.STORE_SONGS);
    const song = songs.find(s => s.id === songId);
    if (!song) return;

    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.add('active');

    try {
      song.title = document.getElementById('editSongTitle').value.trim();
      song.artist = document.getElementById('editSongArtist').value.trim();
      const oldAlbum = song.album;
      const newAlbum = document.getElementById('editSongAlbum').value.trim();
      song.album = newAlbum || null;
      song.audioUrl = document.getElementById('editSongAudioUrl').value.trim() || null;
      song.coverUrl = document.getElementById('editSongCoverUrl').value.trim() || null;

      const audioFile = document.getElementById('editSongAudioFile').files[0];
      if (audioFile) { song.audioBlob = audioFile; song.audioUrl = null; }

      const coverFile = document.getElementById('editSongCoverFile').files[0];
      if (coverFile) { song.coverBlob = coverFile; song.coverUrl = null; }

      await DB.put(CONFIG.STORE_SONGS, song);

      if (oldAlbum !== newAlbum) {
        if (oldAlbum) {
          const albumOldObj = await DB.get(CONFIG.STORE_ALBUMS, oldAlbum);
          if (albumOldObj && albumOldObj.trackOrder) {
            albumOldObj.trackOrder = albumOldObj.trackOrder.filter(id => id !== song.id);
            await DB.put(CONFIG.STORE_ALBUMS, albumOldObj);
          }
        }
        if (newAlbum) {
          const albumNewObj = await DB.get(CONFIG.STORE_ALBUMS, newAlbum) || { name: newAlbum, ratings: [], trackOrder: [] };
          if (!albumNewObj.trackOrder) albumNewObj.trackOrder = [];
          if (!albumNewObj.trackOrder.includes(song.id)) albumNewObj.trackOrder.push(song.id);
          await DB.put(CONFIG.STORE_ALBUMS, albumNewObj);
        }
      }

      UI.closeModal(document.getElementById('modalEdit'));
      this.refreshAll();
      Sync.onDataChanged();
    } catch (error) {
      console.error('Ошибка при редактировании трека:', error);
      alert('Не удалось сохранить изменения: ' + error.message);
    } finally {
      if (overlay) overlay.classList.remove('active');
    }
  },

  // ========== ОЦЕНКИ ==========

  async handleRatingSubmit(e) {
    e.preventDefault();
    if (!UI.currentRatingSongId) return;
    const scores = CONFIG.CRITERIA.map((_, i) => {
      const slider = document.getElementById(`ratingSlidersRange${i}`);
      return slider ? parseInt(slider.value, 10) : 0;
    });
    const total = scores.reduce((a, b) => a + b, 0);
    const songs = await DB.getAll(CONFIG.STORE_SONGS);
    const song = songs.find(s => s.id === UI.currentRatingSongId);
    if (!song) return;
    if (!song.ratings) song.ratings = [];
    const myIndex = song.ratings.findIndex(r => r.userId === Auth.currentUser.id);
    const ratingObj = { userId: Auth.currentUser.id, username: Auth.currentUser.username, scores, total, date: new Date().toISOString() };
    if (myIndex >= 0) song.ratings[myIndex] = ratingObj;
    else song.ratings.push(ratingObj);
    await DB.put(CONFIG.STORE_SONGS, song);
    UI.closeModal(document.getElementById('modalRating'));
    this.refreshAll();
    Sync.onDataChanged();
  },

  async handleAlbumRatingSubmit(e) {
    e.preventDefault();
    if (!UI.currentAlbumRatingName) return;
    const scores = CONFIG.CRITERIA.map((_, i) => {
      const slider = document.getElementById(`albumRatingSlidersRange${i}`);
      return slider ? parseInt(slider.value, 10) : 0;
    });
    const total = scores.reduce((a, b) => a + b, 0);
    const album = await DB.get(CONFIG.STORE_ALBUMS, UI.currentAlbumRatingName) || { name: UI.currentAlbumRatingName, ratings: [], trackOrder: [] };
    if (!album.ratings) album.ratings = [];
    const myIndex = album.ratings.findIndex(r => r.userId === Auth.currentUser.id);
    const ratingObj = { userId: Auth.currentUser.id, username: Auth.currentUser.username, scores, total, date: new Date().toISOString() };
    if (myIndex >= 0) album.ratings[myIndex] = ratingObj;
    else album.ratings.push(ratingObj);
    await DB.put(CONFIG.STORE_ALBUMS, album);
    UI.closeModal(document.getElementById('modalAlbumRating'));
    this.refreshAll();
    Sync.onDataChanged();
  },

  // ========== КОММЕНТАРИИ ==========

  async handleAddComment() {
    if (!UI.currentCommentSongId) return;
    const text = document.getElementById('commentText').value.trim();
    if (!text) return alert('Введите текст комментария');
    const songs = await DB.getAll(CONFIG.STORE_SONGS);
    const song = songs.find(s => s.id === UI.currentCommentSongId);
    if (!song) return;
    if (!song.comments) song.comments = [];
    song.comments.push({
      userId: Auth.currentUser.id,
      username: Auth.currentUser.username,
      text,
      date: new Date().toLocaleString('ru-RU'),
    });
    await DB.put(CONFIG.STORE_SONGS, song);
    UI.openCommentModal(UI.currentCommentSongId);
    Sync.onDataChanged();
  },
};

// ========== СТАРТ ==========
document.addEventListener('DOMContentLoaded', async () => {
  Player.init();
  App.init();

  try {
    await DB.open();
    await Auth.initAdmin();

    const savedId = Auth.getSavedUserId();
    if (savedId) {
      const user = await DB.get(CONFIG.STORE_USERS, savedId);
      if (user) {
        Auth.currentUser = user;
        App.showApp();
        App.refreshAll();
        if (CONFIG.GITHUB_USER && CONFIG.GITHUB_REPO && Sync.token) {
          setTimeout(() => Sync.sync(), 1000);
        }
        return;
      } else {
        Auth.clearSession();
      }
    }
    App.showAuthScreen();
  } catch (err) {
    console.error(err);
    alert('Ошибка инициализации базы данных');
  }
});
