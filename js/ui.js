/**
 * UI: рендеринг, модальные окна, утилиты
 */
const UI = {
  currentView: 'songs',
  currentSort: 'date',
  currentSearch: '',
  currentRatingSongId: null,
  currentCommentSongId: null,
  currentAlbumRatingName: null,
  contextMenuSongId: null,

  // ========== УТИЛИТЫ ==========

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  getScoreColor(score) {
    const ratio = score / CONFIG.MAX_SCORE;
    const start = { r: 60, g: 50, b: 70 };
    const mid = { r: 179, g: 102, b: 255 };
    const end = { r: 255, g: 77, b: 109 };
    let r, g, b;
    if (ratio <= 0.5) {
      const t = ratio * 2;
      r = Math.round(start.r + (mid.r - start.r) * t);
      g = Math.round(start.g + (mid.g - start.g) * t);
      b = Math.round(start.b + (mid.b - start.b) * t);
    } else {
      const t = (ratio - 0.5) * 2;
      r = Math.round(mid.r + (end.r - mid.r) * t);
      g = Math.round(mid.g + (end.g - mid.g) * t);
      b = Math.round(mid.b + (end.b - mid.b) * t);
    }
    return `rgb(${r}, ${g}, ${b})`;
  },

  getAverageRating(song) {
    if (!song.ratings || song.ratings.length === 0) return null;
    const sum = song.ratings.reduce((acc, r) => acc + r.total, 0);
    return Math.round(sum / song.ratings.length);
  },

  getAlbumAverageRating(album) {
    if (!album.ratings || album.ratings.length === 0) return null;
    const sum = album.ratings.reduce((acc, r) => acc + r.total, 0);
    return Math.round(sum / album.ratings.length);
  },

  getFavorites() {
    if (!Auth.currentUser) return [];
    return JSON.parse(localStorage.getItem(`bpt_favorites_${Auth.currentUser.id}`) || '[]');
  },

  saveFavorites(favs) {
    if (!Auth.currentUser) return;
    localStorage.setItem(`bpt_favorites_${Auth.currentUser.id}`, JSON.stringify(favs));
  },

  fixDropboxUrl(url) {
    if (!url) return '';
    let clean = url.trim();
    if (clean.includes('dropbox.com')) {
      clean = clean.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
      clean = clean.replace('?dl=0', '').replace('&dl=0', '');
      clean = clean.replace('?dl=1', '').replace('&dl=1', '');
      clean = clean.replace('?raw=1', '').replace('&raw=1', '');
    }
    return clean;
  },

  showNotification(message, isError = false) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    if (isError) notification.style.borderColor = '#cf6679';
    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  },

  closeModal(modal) {
    if (!modal || !modal.classList.contains('active')) return;
    modal.classList.add('closing');
    setTimeout(() => {
      modal.classList.remove('active');
      modal.classList.remove('closing');
    }, 300);
  },

  // ========== ФИЛЬТРАЦИЯ И СОРТИРОВКА ==========

  getFilteredAndSortedSongs(songs) {
    if (!songs || !Array.isArray(songs) || songs.length === 0) return [];
    let filtered = [...songs];

    if (this.currentSearch && this.currentSearch.trim()) {
      const search = this.currentSearch.toLowerCase().trim();
      filtered = filtered.filter(s =>
        (s.title && s.title.toLowerCase().includes(search)) ||
        (s.artist && s.artist.toLowerCase().includes(search)) ||
        (s.album && s.album.toLowerCase().includes(search))
      );
    }

    switch (this.currentSort) {
      case 'date':
        filtered.sort((a, b) => {
          if (a.date && b.date) return b.date.localeCompare(a.date);
          if (a.date && !b.date) return -1;
          if (!a.date && b.date) return 1;
          return 0;
        });
        break;
      case 'name':
        filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        break;
      case 'rating':
        filtered.sort((a, b) => (this.getAverageRating(b) || 0) - (this.getAverageRating(a) || 0));
        break;
      case 'favorites': {
        const favs = this.getFavorites();
        filtered = filtered.filter(s => favs.includes(s.id));
        break;
      }
    }
    return filtered;
  },

  // ========== РЕНДЕРИНГ ТРЕКОВ ==========

  renderSongs(songs) {
    const container = document.getElementById('dynamicList');
    if (!songs || songs.length === 0) {
      container.innerHTML = '<div style="color:#888; text-align:center; padding:40px;">Треки не найдены</div>';
      return;
    }
    container.className = 'song-grid';
    const favs = this.getFavorites();

    container.innerHTML = songs.map(song => {
      const coverUrl = song.coverUrl || (song.coverBlob ? URL.createObjectURL(song.coverBlob) : '');
      const avg = this.getAverageRating(song);
      const userRating = song.ratings?.find(r => r.userId === Auth.currentUser.id);
      const hasUserRating = !!userRating;
      const isFavorite = favs.includes(song.id);
      const canDelete = Auth.currentUser?.isAdmin;

      let scoreHtml = '';
      if (hasUserRating) {
        const circles = userRating.scores.map((s, i) =>
          `<span class="score-circle" style="background: ${this.getScoreColor(s)};" title="${CONFIG.CRITERIA[i]}: ${s}/${CONFIG.MAX_SCORE}">${s}</span>`
        ).join('');
        scoreHtml = `<div class="score-circles">${circles}</div><div class="total">Ваша: ${userRating.total} ★</div>`;
      } else {
        scoreHtml = `<div style="color:#888; font-style:italic;">Вы не оценили</div>`;
      }
      if (avg !== null) {
        scoreHtml += `<div style="font-size:0.85rem; color:var(--text-secondary); text-align:right;">Средний балл: ${avg} ★ (${song.ratings.length} оценок)</div>`;
      }

      const albumLine = song.album ? `<span>💿 ${this.escapeHtml(song.album)}</span>` : '';
      const dateLine = song.date ? `<span>📅 ${song.date}</span>` : '';
      const commentCount = (song.comments && song.comments.length) || 0;
      const commentClass = commentCount ? 'comment-btn has-comments' : 'comment-btn';

      return `
        <div class="card" data-id="${song.id}">
          <div class="card-top">
            ${coverUrl ? `<img class="card-cover" src="${coverUrl}" alt="cover">` : '<div class="card-cover"></div>'}
            <div class="card-info">
              <div class="card-title">${this.escapeHtml(song.title)}</div>
              <div class="card-artist">${this.escapeHtml(song.artist)}</div>
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

    // Обработчики карточек
    container.querySelectorAll('.play-btn').forEach(btn =>
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.closest('.card')?.dataset.id;
        if (id) Player.play(id);
      })
    );
    container.querySelectorAll('.rate-btn').forEach(btn =>
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.closest('.card')?.dataset.id;
        if (id) this.openRatingModal(id);
      })
    );
    container.querySelectorAll('.comment-btn').forEach(btn =>
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.closest('.card')?.dataset.id;
        if (id) this.openCommentModal(id);
      })
    );
    container.querySelectorAll('.favorite-btn').forEach(btn =>
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = e.currentTarget.closest('.card')?.dataset.id;
        if (id) this.toggleFavorite(id);
      })
    );
    container.querySelectorAll('.delete-btn').forEach(btn =>
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.closest('.card')?.dataset.id;
        if (id && confirm('Удалить этот трек и все его данные?')) {
          DB.delete(CONFIG.STORE_SONGS, id).then(() => {
            App.refreshAll();
            Sync.onDataChanged();
          });
        }
      })
    );
  },

  // ========== РЕНДЕРИНГ ТОП-12 ==========

  async renderTop12(songs) {
    const container = document.getElementById('topList');
    const rated = songs.filter(s => s.ratings && s.ratings.length > 0)
      .map(s => ({ song: s, avg: this.getAverageRating(s) }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 12);

    if (rated.length === 0) { container.innerHTML = ''; return; }

    container.innerHTML = rated.map(({ song, avg }) => {
      const coverUrl = song.coverUrl || (song.coverBlob ? URL.createObjectURL(song.coverBlob) : '');
      return `
        <div class="top-vertical-item">
          ${coverUrl ? `<img src="${coverUrl}" alt="cover">` : '<div style="width:44px;height:44px;background:#333;border-radius:8px;"></div>'}
          <div class="tvi-info">
            <div class="tvi-title">${this.escapeHtml(song.title)}</div>
            <div class="tvi-artist">${this.escapeHtml(song.artist)}</div>
          </div>
          <div class="tvi-score">${avg} ★</div>
        </div>`;
    }).join('');
  },

  // ========== РЕНДЕРИНГ АЛЬБОМОВ ==========

  async renderAlbums() {
    const [songs, albums] = await Promise.all([DB.getAll(CONFIG.STORE_SONGS), DB.getAll(CONFIG.STORE_ALBUMS)]);
    const container = document.getElementById('dynamicList');
    const albumGroups = new Map();

    songs.forEach(s => {
      if (!s.album) return;
      if (!albumGroups.has(s.album)) albumGroups.set(s.album, []);
      albumGroups.get(s.album).push(s);
    });

    container.className = 'album-list';
    container.innerHTML = Array.from(albumGroups.keys()).map(albumName => {
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
        <div class="album-card" data-album="${this.escapeHtml(albumName)}">
          ${coverUrl ? `<img class="album-cover" src="${coverUrl}" alt="cover">` : '<div class="album-cover"></div>'}
          <div class="album-info">
            <h3>${this.escapeHtml(albumName)}</h3>
            <div class="album-artist">${this.escapeHtml(firstTrack.artist)}</div>
            <div class="track-count">${tracks.length} треков ${dateDisplay}</div>
            <div>${scoreDisplay}</div>
          </div>
        </div>`;
    }).join('');

    container.querySelectorAll('.album-card').forEach(card =>
      card.addEventListener('click', () => this.openAlbumView(card.dataset.album))
    );
  },

  async renderTopAlbums() {
    const [albums, songs] = await Promise.all([DB.getAll(CONFIG.STORE_ALBUMS), DB.getAll(CONFIG.STORE_SONGS)]);
    const container = document.getElementById('topAlbumsList');
    const rated = albums
      .filter(a => a.ratings && a.ratings.length > 0)
      .map(a => ({ album: a, avg: this.getAlbumAverageRating(a), firstSong: songs.find(s => s.album === a.name) }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 5);

    if (rated.length === 0) { container.innerHTML = ''; return; }

    container.innerHTML = rated.map(({ album, avg, firstSong }) => {
      const coverUrl = firstSong?.coverUrl || (firstSong?.coverBlob ? URL.createObjectURL(firstSong.coverBlob) : '');
      const artistName = firstSong?.artist || 'Неизвестен';
      return `
        <div class="top-vertical-item">
          ${coverUrl ? `<img src="${coverUrl}" alt="cover">` : '<div style="width:44px;height:44px;background:#333;border-radius:8px;"></div>'}
          <div class="tvi-info">
            <div class="tvi-title">${this.escapeHtml(album.name)}</div>
            <div class="tvi-artist">${this.escapeHtml(artistName)}</div>
          </div>
          <div class="tvi-score">${avg} ★</div>
        </div>`;
    }).join('');
  },

  // ========== ПРОСМОТР АЛЬБОМА ==========

  async openAlbumView(albumName) {
    const songs = await DB.getAll(CONFIG.STORE_SONGS);
    const albumTracks = songs.filter(s => s.album === albumName);
    if (albumTracks.length === 0) return;

    const albumData = await DB.get(CONFIG.STORE_ALBUMS, albumName) || { name: albumName, ratings: [], trackOrder: [], date: '' };
    const trackOrder = albumData.trackOrder || albumTracks.map(t => t.id);
    const orderedTracks = trackOrder.map(id => albumTracks.find(t => t.id === id)).filter(t => t !== undefined);
    albumTracks.forEach(t => { if (!orderedTracks.includes(t)) orderedTracks.push(t); });

    const isAdmin = Auth.currentUser?.isAdmin;
    document.getElementById('albumViewTitle').textContent = `💿 ${albumName}`;
    const container = document.getElementById('albumViewTracks');

    // Дата альбома (для админа)
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
          for (const song of albumTracks) { song.date = newDate; await DB.put(CONFIG.STORE_SONGS, song); }
          albumData.date = newDate;
          await DB.put(CONFIG.STORE_ALBUMS, albumData);
          this.openAlbumView(albumName);
          Sync.onDataChanged();
        } catch (err) { console.error(err); alert('Ошибка при обновлении даты'); }
        finally { if (overlay) overlay.classList.remove('active'); }
      };

      document.getElementById('albumDateInput').addEventListener('change', async () => {
        albumData.date = document.getElementById('albumDateInput').value;
        await DB.put(CONFIG.STORE_ALBUMS, albumData);
        Sync.onDataChanged();
      });
    }

    // Рендер треков
    container.innerHTML = orderedTracks.map((song, index) => {
      const coverUrl = song.coverUrl || (song.coverBlob ? URL.createObjectURL(song.coverBlob) : '');
      const avg = this.getAverageRating(song);
      const userRating = song.ratings?.find(r => r.userId === Auth.currentUser?.id);
      let scoreHtml = '';
      if (userRating) {
        scoreHtml = `<div class="score-circles">${userRating.scores.map((s, i) => `<span class="score-circle" style="background: ${this.getScoreColor(s)};" title="${CONFIG.CRITERIA[i]}: ${s}/${CONFIG.MAX_SCORE}">${s}</span>`).join('')}</div><div class="total">Ваша: ${userRating.total} ★</div>`;
      } else {
        scoreHtml = `<div style="color:#888;">Не оценен</div>`;
      }
      if (avg !== null) scoreHtml += `<div style="font-size:0.85rem; color:var(--text-secondary);">Средний: ${avg} ★</div>`;

      return `
        <div class="card draggable-song" draggable="${isAdmin}" data-id="${song.id}">
          ${isAdmin ? `<span class="drag-handle show" title="Перетащить">≡</span>` : ''}
          <div class="card-top">
            ${coverUrl ? `<img class="card-cover" src="${coverUrl}" alt="cover">` : '<div class="card-cover"></div>'}
            <div class="card-info">
              <div class="card-title"><span class="track-num">${index + 1}.</span>${this.escapeHtml(song.title)}</div>
              <div class="card-artist">${this.escapeHtml(song.artist)}</div>
            </div>
          </div>
          ${scoreHtml}
          <div class="card-actions">
            <button class="play-btn" data-id="${song.id}">▶ Слушать</button>
          </div>
        </div>`;
    }).join('');

    container.querySelectorAll('.play-btn').forEach(btn =>
      btn.addEventListener('click', (e) => { e.stopPropagation(); Player.play(e.target.dataset.id); })
    );

    // Drag-and-Drop
    if (isAdmin) {
      const draggables = container.querySelectorAll('.draggable-song');
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
          if (item !== draggedItem) item.classList.add('drag-over');
        });
        item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
        item.addEventListener('drop', async (e) => {
          e.preventDefault();
          if (item === draggedItem) return;
          const allItems = Array.from(container.querySelectorAll('.draggable-song'));
          const draggedIndex = allItems.indexOf(draggedItem);
          const targetIndex = allItems.indexOf(item);
          if (draggedIndex < targetIndex) item.parentNode.insertBefore(draggedItem, item.nextSibling);
          else item.parentNode.insertBefore(draggedItem, item);
          const newOrder = Array.from(container.querySelectorAll('.draggable-song')).map(d => d.dataset.id);
          albumData.trackOrder = newOrder;
          await DB.put(CONFIG.STORE_ALBUMS, albumData);
          this.openAlbumView(albumName);
          Sync.onDataChanged();
        });
      });
    }

    // Кнопки
    const deleteBtn = document.getElementById('deleteAlbumBtn');
    if (deleteBtn) {
      deleteBtn.onclick = async () => {
        if (confirm(`Удалить альбом "${albumName}" и все его треки?`)) {
          for (const song of albumTracks) await DB.delete(CONFIG.STORE_SONGS, song.id);
          await DB.delete(CONFIG.STORE_ALBUMS, albumName);
          this.closeModal(document.getElementById('modalAlbumView'));
          App.refreshAll();
          Sync.onDataChanged();
        }
      };
    }

    const rateBtn = document.getElementById('rateAlbumBtn');
    if (rateBtn) {
      rateBtn.onclick = () => {
        this.closeModal(document.getElementById('modalAlbumView'));
        this.openAlbumRatingModal(albumName);
      };
    }

    const closeBtn = document.querySelector('.close-album-view');
    if (closeBtn) closeBtn.onclick = () => this.closeModal(document.getElementById('modalAlbumView'));

    document.getElementById('modalAlbumView').classList.add('active');
  },

  // ========== МОДАЛКА ОЦЕНКИ ТРЕКА ==========

  buildSliders(containerId, values, onChange) {
    const container = document.getElementById(containerId);
    container.innerHTML = CONFIG.CRITERIA.map((name, i) => {
      const val = values ? values[i] : 0;
      return `<div class="range-group">
        <label><span>${name}</span><span id="${containerId}Val${i}">${val}</span></label>
        <input type="range" id="${containerId}Range${i}" min="0" max="${CONFIG.MAX_SCORE}" value="${val}" step="1">
      </div>`;
    }).join('');
    CONFIG.CRITERIA.forEach((_, i) => {
      const slider = document.getElementById(`${containerId}Range${i}`);
      const valSpan = document.getElementById(`${containerId}Val${i}`);
      slider.addEventListener('input', () => { valSpan.textContent = slider.value; onChange(); });
    });
    onChange();
  },

  openRatingModal(songId) {
    DB.getAll(CONFIG.STORE_SONGS).then(songs => {
      const song = songs.find(s => s.id === songId);
      if (!song) return;
      this.currentRatingSongId = songId;
      const coverUrl = song.coverUrl || (song.coverBlob ? URL.createObjectURL(song.coverBlob) : '');
      document.getElementById('ratingHeader').innerHTML = `
        ${coverUrl ? `<img class="rating-cover" src="${coverUrl}" alt="cover">` : ''}
        <div><strong>${this.escapeHtml(song.artist)}</strong><br>${this.escapeHtml(song.title)}</div>`;
      const myRating = song.ratings?.find(r => r.userId === Auth.currentUser.id);
      this.buildSliders('ratingSliders', myRating?.scores, () => {
        let sum = 0;
        for (let i = 0; i < CONFIG.CRITERIA.length; i++) {
          const slider = document.getElementById(`ratingSlidersRange${i}`);
          if (slider) sum += parseInt(slider.value, 10);
        }
        document.getElementById('liveTotal').textContent = sum;
      });
      const otherContainer = document.getElementById('otherRatings');
      const others = song.ratings?.filter(r => r.userId !== Auth.currentUser.id) || [];
      const isAdmin = Auth.currentUser?.isAdmin;
      otherContainer.innerHTML = others.length === 0
        ? '<div style="color:#888;">Нет оценок</div>'
        : others.map((r, idx) => `
          <div class="other-rating-item" style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;">
            <span><strong>${this.escapeHtml(r.username)}</strong>: ${r.total} ★ (${r.scores.map((s, i) => `${CONFIG.CRITERIA[i]}:${s}`).join(', ')})</span>
            ${isAdmin ? `<button class="delete-rating-btn" data-userid="${r.userId}" style="background:#cf6679;border:none;color:white;padding:2px 8px;border-radius:4px;cursor:pointer;font-size:0.75rem;">✕</button>` : ''}
          </div>`).join('');

      if (isAdmin) {
        otherContainer.querySelectorAll('.delete-rating-btn').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const targetUserId = e.target.dataset.userid;
            if (!confirm('Удалить эту оценку?')) return;
            const songs = await DB.getAll(CONFIG.STORE_SONGS);
            const s = songs.find(s => s.id === songId);
            if (!s || !s.ratings) return;
            s.ratings = s.ratings.filter(r => r.userId !== targetUserId);
            await DB.put(CONFIG.STORE_SONGS, s);
            this.openRatingModal(songId);
            Sync.onDataChanged();
          });
        });
      }

      document.getElementById('modalRating').classList.add('active');
    });
  },

  // ========== МОДАЛКА ОЦЕНКИ АЛЬБОМА ==========

  openAlbumRatingModal(albumName) {
    this.currentAlbumRatingName = albumName;
    DB.get(CONFIG.STORE_ALBUMS, albumName).then(album => {
      document.getElementById('albumRatingInfo').textContent = `Альбом: ${albumName}`;
      const myRating = album?.ratings?.find(r => r.userId === Auth.currentUser.id);
      this.buildSliders('albumRatingSliders', myRating?.scores, () => {
        let sum = 0;
        for (let i = 0; i < CONFIG.CRITERIA.length; i++) {
          const slider = document.getElementById(`albumRatingSlidersRange${i}`);
          if (slider) sum += parseInt(slider.value, 10);
        }
        document.getElementById('albumLiveTotal').textContent = sum;
      });
      const otherContainer = document.getElementById('otherAlbumRatings');
      const others = album?.ratings?.filter(r => r.userId !== Auth.currentUser.id) || [];
      const isAdmin = Auth.currentUser?.isAdmin;
      otherContainer.innerHTML = others.length === 0
        ? '<div style="color:#888;">Нет оценок</div>'
        : others.map(r => `
          <div class="other-rating-item" style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;">
            <span><strong>${this.escapeHtml(r.username)}</strong>: ${r.total} ★</span>
            ${isAdmin ? `<button class="delete-album-rating-btn" data-userid="${r.userId}" style="background:#cf6679;border:none;color:white;padding:2px 8px;border-radius:4px;cursor:pointer;font-size:0.75rem;">✕</button>` : ''}
          </div>`).join('');

      if (isAdmin) {
        otherContainer.querySelectorAll('.delete-album-rating-btn').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const targetUserId = e.target.dataset.userid;
            if (!confirm('Удалить эту оценку альбома?')) return;
            const alb = await DB.get(CONFIG.STORE_ALBUMS, albumName);
            if (!alb || !alb.ratings) return;
            alb.ratings = alb.ratings.filter(r => r.userId !== targetUserId);
            await DB.put(CONFIG.STORE_ALBUMS, alb);
            this.openAlbumRatingModal(albumName);
            Sync.onDataChanged();
          });
        });
      }

      document.getElementById('modalAlbumRating').classList.add('active');
    });
  },

  // ========== КОММЕНТАРИИ ==========

  openCommentModal(songId) {
    DB.getAll(CONFIG.STORE_SONGS).then(songs => {
      const song = songs.find(s => s.id === songId);
      if (!song) return;
      this.currentCommentSongId = songId;
      document.getElementById('commentSongInfo').textContent = `${song.artist} — ${song.title}`;
      document.getElementById('commentAuthor').value = Auth.currentUser.username;
      this.renderCommentsList(song.comments || []);
      document.getElementById('commentText').value = '';
      document.getElementById('modalComment').classList.add('active');
    });
  },

  renderCommentsList(comments) {
    const container = document.getElementById('commentsContainer');
    if (comments.length === 0) {
      container.innerHTML = '<div style="color:#888; text-align:center;">Пока нет комментариев</div>';
      return;
    }
    container.innerHTML = comments.map((c, idx) => {
      const canDelete = c.userId === Auth.currentUser.id;
      return `
        <div class="comment-item">
          ${canDelete ? `<button class="comment-del" data-index="${idx}">✕</button>` : ''}
          <div class="comment-author">${this.escapeHtml(c.username)}</div>
          <div class="comment-text">${this.escapeHtml(c.text)}</div>
          <div class="comment-date">${c.date || ''}</div>
        </div>`;
    }).join('');
    container.querySelectorAll('.comment-del').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const index = parseInt(e.target.dataset.index, 10);
        const songs = await DB.getAll(CONFIG.STORE_SONGS);
        const song = songs.find(s => s.id === this.currentCommentSongId);
        if (!song || !song.comments) return;
        song.comments.splice(index, 1);
        await DB.put(CONFIG.STORE_SONGS, song);
        this.renderCommentsList(song.comments);
        Sync.onDataChanged();
      });
    });
  },

  // ========== ИЗБРАННОЕ ==========

  toggleFavorite(songId) {
    if (!Auth.currentUser) return;
    const key = `bpt_favorites_${Auth.currentUser.id}`;
    const favorites = JSON.parse(localStorage.getItem(key) || '[]');
    const index = favorites.indexOf(songId);
    if (index >= 0) favorites.splice(index, 1);
    else favorites.push(songId);
    localStorage.setItem(key, JSON.stringify(favorites));
    App.refreshAll();
    if (Sync.token) {
      clearTimeout(Sync.syncTimeout);
      Sync.syncTimeout = setTimeout(() => Sync.sync(), CONFIG.FAVORITES_SYNC_DELAY);
    }
  },

  // ========== ДОБАВЛЕНИЕ ТРЕКА ==========

  async updateAlbumDatalist() {
    const albums = await DB.getAll(CONFIG.STORE_ALBUMS);
    document.getElementById('albumList').innerHTML = albums.map(a => `<option value="${this.escapeHtml(a.name)}">`).join('');
  },

  openAddModal() {
    document.getElementById('addSongForm').reset();
    document.getElementById('audioUrlsContainer').innerHTML = `
      <div class="audio-track-row" style="margin-bottom: 12px;">
        <input type="text" class="audio-url-input" placeholder="Ссылка на трек" style="width: 100%;">
        <input type="text" class="audio-title-input" placeholder="Название трека" style="width: 100%; margin-top: 4px;">
      </div>
    `;
    this.updateAlbumDatalist();
    document.getElementById('modalAdd').classList.add('active');
  },

  // ========== РЕДАКТИРОВАНИЕ ТРЕКА ==========

  async openEditModal(songId) {
    if (!Auth.currentUser || !Auth.currentUser.isAdmin) return;
    const songs = await DB.getAll(CONFIG.STORE_SONGS);
    const song = songs.find(s => s.id === songId);
    if (!song) return;

    document.getElementById('editSongId').value = song.id;
    document.getElementById('editSongTitle').value = song.title || '';
    document.getElementById('editSongArtist').value = song.artist || '';
    document.getElementById('editSongAlbum').value = song.album || '';
    document.getElementById('editSongAudioUrl').value = song.audioUrl || '';
    document.getElementById('editSongCoverUrl').value = song.coverUrl || '';
    document.getElementById('editSongAudioFile').value = '';
    document.getElementById('editSongCoverFile').value = '';
    document.getElementById('modalEdit').classList.add('active');
  },
};
