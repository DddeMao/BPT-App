/**
 * Точка входа — инициализация и связывание модулей
 */
const App = {
  init() {
    this.bindGlobalEvents();
    this.bindTrackViewEvents();
  },

  // ========== ОБРАБОТЧИКИ СОБЫТИЙ ==========

  bindGlobalEvents() {
    // Навигация (верхняя + нижняя)
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const view = e.currentTarget.dataset.view;
        if (view) this.navigateTo(view);
      });
    });

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

    // Оценка альбома
    document.querySelector('.close-album-rating').addEventListener('click', () => UI.closeModal(document.getElementById('modalAlbumRating')));
    document.getElementById('albumRatingForm').addEventListener('submit', (e) => this.handleAlbumRatingSubmit(e));

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

    // Закрытие модалок по клику на фон
    window.addEventListener('click', (e) => {
      document.querySelectorAll('.modal').forEach(m => {
        if (e.target === m) UI.closeModal(m);
      });
      // Закрытие окна трека
      if (e.target.id === 'trackView') {
        document.getElementById('trackView').classList.remove('active');
      }
    });

    // Горячие клавиши
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === ' ') { e.preventDefault(); Player.audio.paused ? Player.audio.play() : Player.audio.pause(); }
      if (e.key === 'ArrowLeft') Player.audio.currentTime -= 5;
      if (e.key === 'ArrowRight') Player.audio.currentTime += 5;
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(m => UI.closeModal(m));
        document.getElementById('trackView').classList.remove('active');
      }
    });

    // Контекстное меню
    this.bindContextMenu();

    // Динамические поля аудио
    this.bindAudioUrlFields();

    // Автозаполнение тегов
    this.bindTagReader();
  },

  // ========== ОБРАБОТЧИКИ ОКНА ТРЕКА ==========

  bindTrackViewEvents() {
    // Закрытие окна трека
    document.getElementById('trackViewClose').addEventListener('click', () => {
      document.getElementById('trackView').classList.remove('active');
    });

    // Переключение вкладок
    document.querySelectorAll('.track-view-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabName = e.currentTarget.dataset.tab;
        if (tabName) UI.switchTrackTab(tabName);
      });
    });

    // Форма оценки внутри окна трека
    document.getElementById('ratingForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleTrackRatingSubmit();
    });

    // Форма комментариев внутри окна трека
    document.getElementById('addCommentBtn').addEventListener('click', () => {
      this.handleTrackCommentSubmit();
    });
  },

  async handleTrackRatingSubmit() {
    const songId = UI.currentTrackSongId;
    if (!songId) return;
    const scores = CONFIG.CRITERIA.map((_, i) => {
      const slider = document.getElementById(`ratingSlidersRange${i}`);
      return slider ? parseInt(slider.value, 10) : 0;
    });
    const total = scores.reduce((a, b) => a + b, 0);
    const songs = await DB.getAll(CONFIG.STORE_SONGS);
    const song = songs.find(s => s.id === songId);
    if (!song) return;
    if (!song.ratings) song.ratings = [];
    const myIndex = song.ratings.findIndex(r => String(r.userId) === String(Auth.currentUser.id));
    const ratingObj = { userId: Auth.currentUser.id, username: Auth.currentUser.username, scores, total, date: new Date().toISOString() };
    if (myIndex >= 0) song.ratings[myIndex] = ratingObj;
    else song.ratings.push(ratingObj);
    await DB.put(CONFIG.STORE_SONGS, song);
    UI.showNotification('Оценка сохранена!');
    UI.loadTrackRatings();
    Sync.onDataChanged();
  },

  async handleTrackCommentSubmit() {
    const songId = UI.currentTrackSongId;
    if (!songId) return;
    const text = document.getElementById('commentText').value.trim();
    if (!text) return alert('Введите текст комментария');
    const songs = await DB.getAll(CONFIG.STORE_SONGS);
    const song = songs.find(s => s.id === songId);
    if (!song) return;
    if (!song.comments) song.comments = [];
    song.comments.push({
      userId: Auth.currentUser.id,
      username: Auth.currentUser.username,
      text,
      date: new Date().toLocaleString('ru-RU'),
    });
    await DB.put(CONFIG.STORE_SONGS, song);
    document.getElementById('commentText').value = '';
    UI.loadTrackComments();
    Sync.onDataChanged();
  },

  // ========== КОНТЕКСТНОЕ МЕНЮ ==========

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
        if (action === 'rate') UI.openTrackView(UI.contextMenuSongId, 'ratings');
        if (action === 'comment') UI.openTrackView(UI.contextMenuSongId, 'comments');
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
    const songAudio = document.getElementById('songAudio');
    if (!songAudio) return;
    songAudio.addEventListener('change', function(e) {
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
      const tgBlock = document.getElementById('tgAdminBlock');
      if (tgBlock) {
        tgBlock.style.display = 'block';
        this.initTelegramWidget();
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
  
    if (tgBlock) {
      tgBlock.style.display = 'block';
      setTimeout(() => {
     this.initTelegramWidget();
    }, 100);
    }
  },

  initTelegramWidget() {
    const wrapper = document.getElementById('tg-widget-wrapper');
    if (!wrapper) return;

   // Очищаем предыдущий виджет
   wrapper.innerHTML = '';

    // Создаём новый скрипт с data-атрибутами
    const script = document.createElement('script');
   script.src = 'https://telegram.org/js/telegram-widget.js?22';
   script.async = true;
    
   script.setAttribute('data-telegram-login', 'bvst_auth_bot');
    script.setAttribute('data-size', 'large');
   script.setAttribute('data-radius', '8');
   script.setAttribute('data-onauth', 'onTelegramAuth(user)');
   script.setAttribute('data-request-access', 'write');
   script.setAttribute('data-user-photo', 'true'); // опционально — показывать аватарку

   wrapper.appendChild(script);
  },

  toggleAuthMode(e) {
    e.preventDefault();
    this.authMode = this.authMode === 'login' ? 'register' : 'login';
    document.getElementById('authTitle').textContent = this.authMode === 'login' ? 'Вход' : 'Регистрация';
    document.getElementById('toggleAuthMode').textContent = this.authMode === 'login' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти';
    document.getElementById('authUsername').readOnly = false;
    const tgBlock = document.getElementById('tgAdminBlock');
    const username = document.getElementById('authUsername').value.trim().toLowerCase();
    if (tgBlock) tgBlock.style.display = (this.authMode === 'login' && username === 'letluvv') ? 'block' : 'none';
  },

  handleLogout() {
    Auth.currentUser = null;
    Auth.clearSession();
    this.showAuthScreen();
  },

  showAuthScreen() {
    document.getElementById('app').style.display = 'none';
    document.getElementById('authScreen').style.display = 'flex';
    
    // Скрываем стандартную форму логина/пароля
    const authForm = document.getElementById('authForm');
    if (authForm) authForm.style.display = 'none';

    // Также скрываем переключатель режима входа (если он был)
    const toggleMode = document.getElementById('toggleAuthMode');
    if (toggleMode) toggleMode.style.display = 'none';

    // Показываем блок с Telegram-виджетом и сразу инициализируем его
    const tgBlock = document.getElementById('tgAdminBlock');
    if (tgBlock) {
      tgBlock.style.display = 'block';
      this.initTelegramWidget();
    }
  },

  showApp() {
    if (!Auth.currentUser) {
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

  // ========== НАВИГАЦИЯ МЕЖДУ РАЗДЕЛАМИ ==========

  navigateTo(view) {
    UI.currentView = view;
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.view === view);
    });
    document.getElementById('topSidebar').style.display = 'none';
    document.getElementById('topAlbumsSidebar').style.display = 'none';
    const searchBar = document.getElementById('searchBar');
    if (searchBar) searchBar.style.display = 'none';
    const container = document.getElementById('dynamicList');

    switch (view) {
      case 'home':
        document.getElementById('topSidebar').style.display = 'block';
        if (searchBar) searchBar.style.display = 'flex';
        DB.getAll(CONFIG.STORE_SONGS).then(songs => {
          const filtered = UI.getFilteredAndSortedSongs(songs);
          UI.renderSongs(filtered);
          UI.renderTop12(songs);
        });
        break;
      case 'albums':
        document.getElementById('topAlbumsSidebar').style.display = 'block';
        UI.renderAlbums();
        UI.renderTopAlbums();
        break;
      case 'favorites':
        if (searchBar) searchBar.style.display = 'flex';
        DB.getAll(CONFIG.STORE_SONGS).then(songs => {
          const favs = UI.getFavorites();
          const filtered = songs.filter(s => favs.includes(s.id));
          if (filtered.length === 0) {
            container.innerHTML = '<div style="color:#888;text-align:center;padding:60px 20px;"><div style="font-size:3rem;margin-bottom:16px;">💜</div><div>Нет избранных треков</div><div style="font-size:0.85rem;margin-top:8px;color:var(--text-muted);">Нажмите ❤️ на треке чтобы добавить</div></div>';
          } else {
            UI.renderSongs(filtered);
          }
          document.getElementById('topList').innerHTML = '';
        });
        break;
      case 'top':
        if (searchBar) searchBar.style.display = 'flex';
        DB.getAll(CONFIG.STORE_SONGS).then(songs => {
          const rated = songs.filter(s => s.ratings && s.ratings.length > 0).map(s => ({ song: s, avg: UI.getAverageRating(s) })).sort((a, b) => b.avg - a.avg).slice(0, 20);
          if (rated.length === 0) {
            container.innerHTML = '<div style="color:#888;text-align:center;padding:60px 20px;"><div style="font-size:3rem;margin-bottom:16px;">🏆</div><div>Нет оценённых треков</div></div>';
          } else {
            UI.renderSongs(rated.map(r => r.song));
          }
          document.getElementById('topList').innerHTML = '';
        });
        break;
      case 'search':
        if (searchBar) searchBar.style.display = 'flex';
        document.getElementById('searchInput').focus();
        DB.getAll(CONFIG.STORE_SONGS).then(songs => {
          const filtered = UI.getFilteredAndSortedSongs(songs);
          UI.renderSongs(filtered);
          UI.renderTop12(songs);
        });
        break;
    }
  },

  refreshAll() {
    this.navigateTo(UI.currentView);
  },

  setSort(sort) {
    UI.currentSort = sort;
    document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`sort${sort.charAt(0).toUpperCase() + sort.slice(1)}Btn`);
    if (btn) btn.classList.add('active');
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
    if (!skipPasswordCheck && !password) { UI.showNotification('Введите пароль для сохранения!', true); return; }
    try {
      if (!skipPasswordCheck) { const hash = await Auth.hashPassword(password); if (hash !== Auth.currentUser.passwordHash) throw new Error('Неверный пароль'); }
      if (newUsername !== Auth.currentUser.username) {
        const existing = await DB.getUserByUsername(newUsername);
        if (existing) throw new Error('Этот ник уже занят');
        const updatedUser = { ...Auth.currentUser, username: newUsername };
        await DB.put(CONFIG.STORE_USERS, updatedUser);
        const songs = await DB.getAll(CONFIG.STORE_SONGS);
        for (const song of songs) {
          let changed = false;
          if (song.ratings) { for (const r of song.ratings) { if (r.userId === Auth.currentUser.id) { r.username = newUsername; changed = true; } } }
          if (song.comments) { for (const c of song.comments) { if (c.userId === Auth.currentUser.id) { c.username = newUsername; changed = true; } } }
          if (changed) await DB.put(CONFIG.STORE_SONGS, song);
        }
        const albums = await DB.getAll(CONFIG.STORE_ALBUMS);
        for (const album of albums) {
          if (album.ratings) { let changed = false; for (const r of album.ratings) { if (r.userId === Auth.currentUser.id) { r.username = newUsername; changed = true; } } if (changed) await DB.put(CONFIG.STORE_ALBUMS, album); }
        }
        Auth.currentUser = updatedUser;
        const userDisplay = document.getElementById('currentUserDisplay');
        if (userDisplay) userDisplay.textContent = `👤 ${Auth.currentUser.username}`;
      }
      const tokenInput = document.getElementById('settingsGithubToken');
      if (tokenInput) { const newTokenValue = tokenInput.value.trim(); localStorage.setItem('bpt_github_token', newTokenValue); Sync.token = newTokenValue; }
      UI.showNotification('Настройки успешно сохранены!');
      UI.closeModal(document.getElementById('modalSettings'));
      this.refreshAll();
      Sync.onDataChanged();
      if (Sync.token) Sync.sync();
    } catch (error) { console.error('Ошибка изменения настроек:', error); UI.showNotification(error.message, true); }
  },

  // ========== ДОБАВЛЕНИЕ ТРЕКА ==========

  async handleAddSong(e) {
    e.preventDefault();
    const artist = document.getElementById('addArtist').value.trim();
    const producer = document.getElementById('addProducer').value.trim();
    const album = document.getElementById('addAlbum').value.trim();
    const date = document.getElementById('addDate').value;
    const rawCoverUrl = document.getElementById('addCoverUrl').value.trim();
    const coverUrl = UI.fixDropboxUrl(rawCoverUrl);
    
    // Получаем текст песни из формы добавления
    const lyrics = document.getElementById('addLyrics') ? document.getElementById('addLyrics').value.trim() : '';

    if (!artist) return alert('Введите исполнителя');
    const rows = Array.from(document.getElementById('audioUrlsContainer').querySelectorAll('.audio-track-row'));
    const tracks = rows.map(row => ({ url: UI.fixDropboxUrl(row.querySelector('.audio-url-input').value.trim()), title: row.querySelector('.audio-title-input').value.trim() })).filter(track => track.url !== '');
    if (tracks.length === 0) return alert('Добавьте хотя бы одну ссылку на аудиофайл');
    for (const track of tracks) { if (!track.title) return alert('Укажите название для каждого трека'); }
    try {
      for (const track of tracks) {
        // Добавляем lyrics: lyrics в объект трека
        const newSong = { title: track.title, artist, producer: producer || '', album: album || '', date, audioUrl: track.url, coverUrl: coverUrl || '', lyrics: lyrics, ratings: [], comments: [] };
        const addedSong = await DB.add(CONFIG.STORE_SONGS, newSong);
        if (album) {
          const albumData = await DB.get(CONFIG.STORE_ALBUMS, album);
          if (albumData) { const currentOrder = albumData.trackOrder || []; currentOrder.push(addedSong.id); await DB.put(CONFIG.STORE_ALBUMS, { ...albumData, trackOrder: currentOrder }); }
          else { await DB.put(CONFIG.STORE_ALBUMS, { name: album, ratings: [], trackOrder: [addedSong.id] }); }
        }
      }
      UI.closeModal(document.getElementById('modalAdd'));
      // Сбрасываем форму после успешного добавления
      document.getElementById('addSongForm').reset();
      this.refreshAll();
      Sync.onDataChanged();
    } catch (err) { console.error(err); alert('Ошибка при сохранении треков'); }
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
      song.producer = document.getElementById('editSongProducer').value.trim() || '';
      
      // Читаем и сохраняем текст песни при редактировании
      const lyricsField = document.getElementById('editSongLyrics');
      song.lyrics = lyricsField ? lyricsField.value.trim() : '';

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
        if (oldAlbum) { const albumOldObj = await DB.get(CONFIG.STORE_ALBUMS, oldAlbum); if (albumOldObj && albumOldObj.trackOrder) { albumOldObj.trackOrder = albumOldObj.trackOrder.filter(id => id !== song.id); await DB.put(CONFIG.STORE_ALBUMS, albumOldObj); } }
        if (newAlbum) { const albumNewObj = await DB.get(CONFIG.STORE_ALBUMS, newAlbum) || { name: newAlbum, ratings: [], trackOrder: [] }; if (!albumNewObj.trackOrder) albumNewObj.trackOrder = []; if (!albumNewObj.trackOrder.includes(song.id)) albumNewObj.trackOrder.push(song.id); await DB.put(CONFIG.STORE_ALBUMS, albumNewObj); }
      }
      UI.closeModal(document.getElementById('modalEdit'));
      this.refreshAll();
      Sync.onDataChanged();
    } catch (error) { console.error('Ошибка при редактировании трека:', error); alert('Не удалось сохранить изменения: ' + error.message); }
    finally { if (overlay) overlay.classList.remove('active'); }
  },

  // ========== ОЦЕНКА АЛЬБОМА ==========

  async handleAlbumRatingSubmit(e) {
    e.preventDefault();
    if (!UI.currentAlbumRatingName) return;
    const scores = CONFIG.CRITERIA.map((_, i) => { const slider = document.getElementById(`albumRatingSlidersRange${i}`); return slider ? parseInt(slider.value, 10) : 0; });
    const total = scores.reduce((a, b) => a + b, 0);
    const album = await DB.get(CONFIG.STORE_ALBUMS, UI.currentAlbumRatingName) || { name: UI.currentAlbumRatingName, ratings: [], trackOrder: [] };
    if (!album.ratings) album.ratings = [];
    const myIndex = album.ratings.findIndex(r => String(r.userId) === String(Auth.currentUser.id));
    const ratingObj = { userId: Auth.currentUser.id, username: Auth.currentUser.username, scores, total, date: new Date().toISOString() };
    if (myIndex >= 0) album.ratings[myIndex] = ratingObj;
    else album.ratings.push(ratingObj);
    await DB.put(CONFIG.STORE_ALBUMS, album);
    UI.closeModal(document.getElementById('modalAlbumRating'));
    this.refreshAll();
    Sync.onDataChanged();
  },

  // ========== ЛОКАЛЬНАЯ ЗАГРУЗКА ВСЕГО АЛЬБОМА ==========

  async downloadFullAlbum(albumName) {
    if (!albumName) return;
    
    const btn = document.getElementById('downloadAlbumBtn');
    if (btn) {
      btn.disabled = true;
      btn.style.opacity = '0.7';
      btn.textContent = '⏳ Подготовка... 0%';
    }

    try {
      // 1. Получаем все треки из IndexedDB
      const songs = await DB.getAll(CONFIG.STORE_SONGS);
      
      // 2. Отбираем только треки нужного альбома
      const albumSongs = songs.filter(s => s.album === albumName);
      
      if (albumSongs.length === 0) {
        alert('В этом альбоме пока нет треков.');
        if (btn) { btn.disabled = false; btn.textContent = '📥 Скачать альбом'; }
        return;
      }

      let processed = 0;

      // 3. Перебираем треки и скачиваем их
      for (const song of albumSongs) {
        // Если трек уже сохранен в IndexedDB как Blob — пропускаем скачивание
        if (song.audioBlob) {
          processed++;
          if (btn) btn.textContent = `⏳ Загрузка... ${Math.round((processed / albumSongs.length) * 100)}%`;
          continue;
        }

        // Если есть ссылка, скачиваем файл в память
        if (song.audioUrl) {
          try {
            const response = await fetch(song.audioUrl);
            if (!response.ok) throw new Error(`Статус сети: ${response.status}`);
            
            const blob = await response.blob();
            
            // Записываем бинарник в объект трека
            song.audioBlob = blob;
            
            // Пересохраняем обновленный трек в базу данных
            await DB.put(CONFIG.STORE_SONGS, song);
          } catch (fetchErr) {
            console.error(` Не удалось скачать трек "${song.title}":`, fetchErr);
          }
        }

        processed++;
        if (btn) btn.textContent = `⏳ Загрузка... ${Math.round((processed / albumSongs.length) * 100)}%`;
      }

      // 4. Завершение загрузки
      if (btn) {
        btn.textContent = '✅ Альбом сохранен локально';
        btn.style.background = '#28a745'; // Зеленый цвет успеха
        btn.style.color = '#fff';
      }
      
      if (typeof UI !== 'undefined' && typeof UI.showNotification === 'function') {
        UI.showNotification('Альбом успешно сохранен на устройство!');
      }

      // Триггерим синхронизацию, чтобы зафиксировать состояние
      Sync.onDataChanged();

    } catch (error) {
      console.error('Ошибка при скачивании альбома:', error);
      alert('Произошла ошибка при загрузке альбома.');
      if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.textContent = '📥 Скачать альбом';
      }
    }
  },
};

// ========== СТАРТ ==========
document.addEventListener('DOMContentLoaded', async () => {
  UI.init();
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
