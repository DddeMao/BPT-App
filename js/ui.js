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
  currentTrackSongId: null,

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
    if (ratio <= 0.5) { const t = ratio * 2; r = Math.round(start.r + (mid.r - start.r) * t); g = Math.round(start.g + (mid.g - start.g) * t); b = Math.round(start.b + (mid.b - start.b) * t); }
    else { const t = (ratio - 0.5) * 2; r = Math.round(mid.r + (end.r - mid.r) * t); g = Math.round(mid.g + (end.g - mid.g) * t); b = Math.round(mid.b + (end.b - mid.b) * t); }
    return `rgb(${r}, ${g}, ${b})`;
  },

  getScoreColorHex(score) {
    const ratio = score / CONFIG.MAX_SCORE;
    if (ratio <= 0.3) return '#666678';
    if (ratio <= 0.5) return '#8e44ad';
    if (ratio <= 0.7) return '#b366ff';
    if (ratio <= 0.9) return '#ff6b8a';
    return '#ff4d6d';
  },

  getAverageRating(song) {
    if (!song.ratings || song.ratings.length === 0) return null;
    return Math.round(song.ratings.reduce((acc, r) => acc + r.total, 0) / song.ratings.length);
  },

  getAlbumAverageRating(album) {
    if (!album.ratings || album.ratings.length === 0) return null;
    return Math.round(album.ratings.reduce((acc, r) => acc + r.total, 0) / album.ratings.length);
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
    const n = document.createElement('div');
    n.className = 'notification';
    n.textContent = message;
    if (isError) n.style.borderColor = '#cf6679';
    document.body.appendChild(n);
    setTimeout(() => n.classList.add('show'), 10);
    setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 300); }, 2000);
  },

  closeModal(modal) {
    if (!modal || !modal.classList.contains('active')) return;
    modal.classList.add('closing');
    setTimeout(() => { modal.classList.remove('active'); modal.classList.remove('closing'); }, 300);
  },

  // ========== ВИЗУАЛЬНЫЕ КОМПОНЕНТЫ ОЦЕНОК ==========

  renderMiniCircles(scores) {
    if (!scores) return '';
    return `<div class="rating-mini-circles">${scores.map(s => `<span class="rating-mini-circle" style="background:${this.getScoreColorHex(s)}"></span>`).join('')}</div>`;
  },

  renderRatingBars(scores) {
    if (!scores) return '';
    return `<div class="rating-bars">${scores.map((s, i) =>
      `<div class="rating-bar-row"><span class="rating-bar-label">${CONFIG.CRITERIA[i]}</span><div class="rating-bar-track"><div class="rating-bar-fill" style="width:${s/CONFIG.MAX_SCORE*100}%;background:${this.getScoreColorHex(s)}"></div></div><span class="rating-bar-value">${s}</span></div>`
    ).join('')}</div>`;
  },

  renderUserRatingCard(r, isAdmin, songId) {
    const initials = r.username ? r.username.charAt(0).toUpperCase() : '?';
    return `<div class="user-rating-card"><div class="user-rating-header"><div class="user-rating-avatar">${initials}</div><span class="user-rating-name">${this.escapeHtml(r.username)}</span><span class="user-rating-total">${r.total} ★</span>${isAdmin ? `<button class="delete-rating-btn" data-userid="${r.userId}" data-songid="${songId}" style="background:#cf6679;border:none;color:white;padding:2px 8px;border-radius:4px;cursor:pointer;font-size:0.75rem;">✕</button>` : ''}</div>${this.renderRatingBars(r.scores)}</div>`;
  },

  renderAverageRating(song) {
    if (!song.ratings || song.ratings.length === 0) return '';
    const avg = this.getAverageRating(song);
    const avgScores = CONFIG.CRITERIA.map((_, i) => { const vals = song.ratings.map(r => r.scores[i]).filter(s => s !== undefined); return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10 : 0; });
    return `<div class="average-rating-card"><div class="average-rating-title">📊 Средний балл: ${avg} ★ (${song.ratings.length} оценок)</div><div class="rating-bars">${avgScores.map((s, i) =>
      `<div class="rating-bar-row"><span class="rating-bar-label">${CONFIG.CRITERIA[i]}</span><div class="rating-bar-track"><div class="rating-bar-fill" style="width:${s/CONFIG.MAX_SCORE*100}%;background:${this.getScoreColorHex(Math.round(s))}"></div></div><span class="rating-bar-value">${s}</span></div>`
    ).join('')}</div></div>`;
  },

  // ========== ФИЛЬТРАЦИЯ И СОРТИРОВКА ==========

  getFilteredAndSortedSongs(songs) {
    if (!songs || !Array.isArray(songs) || songs.length === 0) return [];
    let filtered = [...songs];
    if (this.currentSearch && this.currentSearch.trim()) {
      const search = this.currentSearch.toLowerCase().trim();
      filtered = filtered.filter(s => (s.title && s.title.toLowerCase().includes(search)) || (s.artist && s.artist.toLowerCase().includes(search)) || (s.album && s.album.toLowerCase().includes(search)));
    }
    switch (this.currentSort) {
      case 'date': filtered.sort((a, b) => { if (a.date && b.date) return b.date.localeCompare(a.date); if (a.date && !b.date) return -1; if (!a.date && b.date) return 1; return 0; }); break;
      case 'name': filtered.sort((a, b) => (a.title || '').localeCompare(b.title || '')); break;
      case 'rating': filtered.sort((a, b) => (this.getAverageRating(b) || 0) - (this.getAverageRating(a) || 0)); break;
      case 'favorites': { const favs = this.getFavorites(); filtered = filtered.filter(s => favs.includes(s.id)); break; }
    }
    return filtered;
  },

  // ========== РЕНДЕРИНГ ТРЕКОВ ==========

  renderSongs(songs) {
    const c = document.getElementById('dynamicList');
    if (!songs || songs.length === 0) {
      c.innerHTML = `<div style="color:#888;text-align:center;padding:40px;">Треки не найдены</div>`;
      return;
    }

    c.className = `song-grid`;
    const favs = this.getFavorites();

    c.innerHTML = songs.map(song => {
      const coverUrl = song.coverUrl || (song.coverBlob ? URL.createObjectURL(song.coverBlob) : ``);
      const avg = this.getAverageRating(song);
      const userRating = song.ratings?.find(r => r.userId === Auth.currentUser.id);
      const hasUserRating = !!userRating;
      const isFavorite = favs.includes(song.id);
      const canDelete = Auth.currentUser?.isAdmin;

      let scoreHtml = ``;
      if (hasUserRating) {
        scoreHtml = `<div style="display:flex;align-items:center;gap:8px;margin-top:6px;">${this.renderMiniCircles(userRating.scores)}<span style="font-size:0.8rem;font-weight:600;">${userRating.total} ★</span></div>`;
        if (avg !== null) scoreHtml += `<div style="font-size:0.7rem;color:var(--text-secondary);margin-top:2px;">Средний: ${avg} ★ (${song.ratings.length})</div>`;
      } else {
        scoreHtml = `<div style="color:#888;font-style:italic;font-size:0.8rem;margin-top:6px;">Вы не оценили</div>`;
        if (avg !== null) {
          scoreHtml += `<div style="display:flex;align-items:center;gap:8px;margin-top:4px;">${this.renderMiniCircles(CONFIG.CRITERIA.map((_,i) => {
            const vals = song.ratings.map(r => r.scores[i]).filter(s => s !== undefined);
            return vals.length ? Math.round(vals.reduce((a,b) => a+b,0)/vals.length) : 0;
          }))} <span style="font-size:0.7rem;color:var(--text-secondary);">${avg} ★ (${song.ratings.length})</span></div>`;
        }
      }

      const commentCount = (song.comments && song.comments.length) || 0;
      const commentClass = commentCount ? `comment-btn has-comments` : `comment-btn`;

      return `<div class="card" data-id="${song.id}">
        <div class="card-cover-wrap">
          ${coverUrl ? `<img class="card-cover" src="${coverUrl}" alt="cover">` : `<div class="card-cover card-cover-empty"></div>`}
          <button class="play-btn-overlay" data-id="${song.id}">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
          </button>
        </div>
        <div class="card-body">
          <div class="card-title">${this.escapeHtml(song.title)}</div>
          <div class="card-artist">${this.escapeHtml(song.artist)}</div>
          ${scoreHtml}
        </div>
        <div class="card-actions">
          <button class="play-btn" data-id="${song.id}"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></button>
          <button class="rate-btn" data-id="${song.id}"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">${hasUserRating ? `<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>` : `<path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>`}</svg></button>
          <button class="comment-btn ${commentClass}" data-id="${song.id}"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>${commentCount ? `<span class="comment-count">${commentCount}</span>` : ``}</button>
          <button class="favorite-btn ${isFavorite ? `is-favorite` : ``}" data-id="${song.id}"><svg width="16" height="16" viewBox="0 0 24 24" fill="${isFavorite ? `currentColor` : `none`}" stroke="currentColor" stroke-width="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg></button>
          ${canDelete ? `<button class="delete-btn" data-id="${song.id}"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>` : ``}
        </div>
      </div>`;
    }).join('').trim();

    c.querySelectorAll('.card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        const id = card.dataset.id;
        if (id) this.openTrackView(id, 'ratings');
      });
    });

    c.querySelectorAll('.play-btn, .play-btn-overlay').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopImmediatePropagation();
        const id = btn.closest('.card')?.dataset.id;
        if (id) Player.play(id);
      });
    });

    c.querySelectorAll('.rate-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopImmediatePropagation();
        const id = btn.closest('.card')?.dataset.id;
        if (id) this.openTrackView(id, 'ratings');
      });
    });

    c.querySelectorAll('.comment-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopImmediatePropagation();
        const id = btn.closest('.card')?.dataset.id;
        if (id) this.openTrackView(id, 'comments');
      });
    });

    c.querySelectorAll('.favorite-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopImmediatePropagation();
        const id = btn.closest('.card')?.dataset.id;
        if (id) this.toggleFavorite(id);
      });
    });

    c.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopImmediatePropagation();
        const id = btn.closest('.card')?.dataset.id;
        if (id && confirm('Удалить этот трек?')) {
          DB.delete(CONFIG.STORE_SONGS, id).then(() => {
            App.refreshAll();
            Sync.onDataChanged();
          });
        }
      });
    });
  },

  async renderAlbums() { const [songs, albums] = await Promise.all([DB.getAll(CONFIG.STORE_SONGS), DB.getAll(CONFIG.STORE_ALBUMS)]); const c = document.getElementById('dynamicList'); const g = new Map(); songs.forEach(s => { if (!s.album) return; if (!g.has(s.album)) g.set(s.album, []); g.get(s.album).push(s); }); c.className = 'album-list'; c.innerHTML = Array.from(g.keys()).map(n => { const t = g.get(n); const f = t[0]; const u = f.coverUrl || (f.coverBlob ? URL.createObjectURL(f.coverBlob) : ''); const d = albums.find(a => a.name === n); const sc = d && d.ratings && d.ratings.length > 0 ? Math.round(d.ratings.reduce((s, r) => s + r.total, 0) / d.ratings.length) : null; return `<div class="album-card" data-album="${this.escapeHtml(n)}">${u ? `<img class="album-cover" src="${u}" alt="cover">` : '<div class="album-cover"></div>'}<div class="album-info"><h3>${this.escapeHtml(n)}</h3><div class="album-artist">${this.escapeHtml(f.artist)}</div><div class="track-count">${t.length} треков ${d?.date ? '📅 ' + d.date : ''}</div><div>${sc !== null ? `<span style="color:var(--accent);font-weight:700;">★ ${sc}</span>` : 'Не оценен'}</div></div></div>`; }).join(''); c.querySelectorAll('.album-card').forEach(card => card.addEventListener('click', () => this.openAlbumView(card.dataset.album))); },

  async renderTopAlbums() { const [albums, songs] = await Promise.all([DB.getAll(CONFIG.STORE_ALBUMS), DB.getAll(CONFIG.STORE_SONGS)]); const c = document.getElementById('topAlbumsList'); const r = albums.filter(a => a.ratings && a.ratings.length > 0).map(a => ({ album: a, avg: this.getAlbumAverageRating(a), firstSong: songs.find(s => s.album === a.name) })).sort((a, b) => b.avg - a.avg).slice(0, 5); if (r.length === 0) { c.innerHTML = ''; return; } c.innerHTML = r.map(({ album, avg, firstSong }) => { const u = firstSong?.coverUrl || (firstSong?.coverBlob ? URL.createObjectURL(firstSong.coverBlob) : ''); return `<div class="top-vertical-item">${u ? `<img src="${u}" alt="cover">` : '<div style="width:44px;height:44px;background:#333;border-radius:8px;"></div>'}<div class="tvi-info"><div class="tvi-title">${this.escapeHtml(album.name)}</div><div class="tvi-artist">${this.escapeHtml(firstSong?.artist || 'Неизвестен')}</div></div><div class="tvi-score">${avg} ★</div></div>`; }).join(''); },

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
    const existingDateRow = document.getElementById('albumDateRow');
    if (existingDateRow) existingDateRow.remove();
    if (isAdmin) {
      const dateRow = document.createElement('div');
      dateRow.id = 'albumDateRow'; dateRow.className = 'album-date-row';
      dateRow.innerHTML = `<label>📅 Дата альбома:</label><input type="date" id="albumDateInput" value="${albumData.date || ''}"><button id="applyDateToTracks" class="btn-settings" style="font-size:0.85rem;">Применить ко всем трекам</button>`;
      container.parentNode.insertBefore(dateRow, container);
      document.getElementById('applyDateToTracks').onclick = async () => { const nd = document.getElementById('albumDateInput').value; if (!confirm(`Применить дату "${nd}" ко всем трекам?`)) return; const o = document.getElementById('loadingOverlay'); if (o) o.classList.add('active'); try { for (const s of albumTracks) { s.date = nd; await DB.put(CONFIG.STORE_SONGS, s); } albumData.date = nd; await DB.put(CONFIG.STORE_ALBUMS, albumData); this.openAlbumView(albumName); Sync.onDataChanged(); } catch (e) { console.error(e); alert('Ошибка'); } finally { if (o) o.classList.remove('active'); } };
      document.getElementById('albumDateInput').addEventListener('change', async () => { albumData.date = document.getElementById('albumDateInput').value; await DB.put(CONFIG.STORE_ALBUMS, albumData); Sync.onDataChanged(); });
    }
    container.innerHTML = orderedTracks.map((song, index) => {
      const coverUrl = song.coverUrl || (song.coverBlob ? URL.createObjectURL(song.coverBlob) : '');
      const avg = this.getAverageRating(song);
      const userRating = song.ratings?.find(r => r.userId === Auth.currentUser?.id);
      let scoreHtml = '';
      if (userRating) { scoreHtml = `<div class="score-circles">${userRating.scores.map((s, i) => `<span class="score-circle" style="background:${this.getScoreColor(s)}" title="${CONFIG.CRITERIA[i]}: ${s}/${CONFIG.MAX_SCORE}">${s}</span>`).join('')}</div><div class="total">Ваша: ${userRating.total} ★</div>`; }
      else { scoreHtml = '<div style="color:#888;">Не оценен</div>'; }
      if (avg !== null) scoreHtml += `<div style="font-size:0.85rem;color:var(--text-secondary);">Средний: ${avg} ★</div>`;
      return `<div class="card draggable-song" draggable="${isAdmin}" data-id="${song.id}">${isAdmin ? '<span class="drag-handle show" title="Перетащить">≡</span>' : ''}<div class="card-top">${coverUrl ? `<img class="card-cover" src="${coverUrl}" alt="cover">` : '<div class="card-cover"></div>'}<div class="card-info"><div class="card-title"><span class="track-num">${index + 1}.</span>${this.escapeHtml(song.title)}</div><div class="card-artist">${this.escapeHtml(song.artist)}</div></div></div>${scoreHtml}<div class="card-actions"><button class="play-btn" data-id="${song.id}">▶ Слушать</button></div></div>`;
    }).join('');
    container.querySelectorAll('.play-btn').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); Player.play(e.target.dataset.id); }));
    const deleteBtn = document.getElementById('deleteAlbumBtn');
    if (deleteBtn) deleteBtn.onclick = async () => { if (confirm(`Удалить альбом "${albumName}"?`)) { for (const s of albumTracks) await DB.delete(CONFIG.STORE_SONGS, s.id); await DB.delete(CONFIG.STORE_ALBUMS, albumName); this.closeModal(document.getElementById('modalAlbumView')); App.refreshAll(); Sync.onDataChanged(); } };
    const rateBtn = document.getElementById('rateAlbumBtn');
    if (rateBtn) rateBtn.onclick = () => { this.closeModal(document.getElementById('modalAlbumView')); this.openAlbumRatingModal(albumName); };
    const downloadBtn = document.getElementById('downloadAlbumBtn');
    if (downloadBtn) {
      const alreadyLocal = albumTracks.filter(s => s.audioBlob).length;
      if (alreadyLocal === albumTracks.length) {
        downloadBtn.textContent = '✅ Альбом уже сохранён';
        downloadBtn.style.background = '#28a745';
        downloadBtn.style.color = '#fff';
        downloadBtn.disabled = true;
      } else {
        downloadBtn.textContent = `📥 Загрузить альбом (${alreadyLocal}/${albumTracks.length} уже есть)`;
      }
      downloadBtn.onclick = () => App.downloadFullAlbum(albumName);
    }
    const closeBtn = document.querySelector('.close-album-view');
    if (closeBtn) closeBtn.onclick = () => this.closeModal(document.getElementById('modalAlbumView'));
    document.getElementById('modalAlbumView').classList.add('active');
  },

  init() {
    const trackListContainer = document.getElementById('tracksContainer');
    if (trackListContainer) {
      trackListContainer.onclick = async (e) => {
        const trackRow = e.target.closest('.track-item');
        if (!trackRow) return;
        const trackId = trackRow.dataset.id;
        if (e.target.closest('.play-btn') || e.target.closest('.pause-btn')) return;
        if (e.target.closest('.track-rating')) {
          this.openTrackView(trackId, 'ratings');
        } else if (e.target.closest('.track-comments')) {
          this.openTrackView(trackId, 'comments');
        } else {
          this.openTrackView(trackId, 'info');
        }
      };
    }
  },

  renderTop12(songs) {
    const c = document.getElementById('topList');
    if (!c) return;
    const rated = songs.filter(s => s.ratings && s.ratings.length > 0)
      .map(s => ({ song: s, avg: this.getAverageRating(s) }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 12);
    if (rated.length === 0) { c.innerHTML = ''; return; }
    c.innerHTML = rated.map(({ song, avg }, i) => {
      const u = song.coverUrl || (song.coverBlob ? URL.createObjectURL(song.coverBlob) : '');
      return `<div class="top-vertical-item" data-id="${song.id}" style="cursor:pointer;">
        ${u ? `<img src="${u}" alt="cover">` : '<div style="width:44px;height:44px;background:#333;border-radius:8px;"></div>'}
        <div class="tvi-info">
          <div class="tvi-title">${i + 1}. ${this.escapeHtml(song.title)}</div>
          <div class="tvi-artist">${this.escapeHtml(song.artist)}</div>
        </div>
        <div class="tvi-score">${avg} ★</div>
      </div>`;
    }).join('');
    c.querySelectorAll('.top-vertical-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        if (id) this.openTrackView(id, 'ratings');
      });
    });
  },

  openTrackView(songId, defaultTab = 'ratings') {
    DB.getAll(CONFIG.STORE_SONGS).then(songs => {
      const song = songs.find(s => s.id === songId);
      if (!song) return;
      this.currentTrackSongId = songId; this.currentRatingSongId = songId; this.currentCommentSongId = songId;
      const coverUrl = song.coverUrl || (song.coverBlob ? URL.createObjectURL(song.coverBlob) : '');
      document.getElementById('trackViewCover').src = coverUrl;
      document.getElementById('trackViewTitle').textContent = song.title;
      document.getElementById('trackViewArtist').textContent = song.artist;
      const avg = this.getAverageRating(song);
      document.getElementById('trackViewMeta').innerHTML = `${song.album ? `<span>💿 ${this.escapeHtml(song.album)}</span>` : ''}${song.date ? `<span>📅 ${song.date}</span>` : ''}${avg !== null ? `<span>⭐ ${avg} средний</span>` : ''}<span>📊 ${song.ratings?.length || 0} оценок</span><span>💬 ${song.comments?.length || 0} комментариев</span>`;
      const producerContainer = document.getElementById('trackViewProducer');
      if (song.producer && song.producer.trim() !== '') {
        producerContainer.textContent = `prod. ${song.producer}`;
        producerContainer.style.display = 'block';
      } else {
        producerContainer.style.display = 'none';
      }

      const lyricsContainer = document.getElementById('trackLyrics');
      if (song.lyrics && song.lyrics.trim() !== '') {
        lyricsContainer.textContent = song.lyrics;
      } else {
        lyricsContainer.innerHTML = '<div class="empty-state">Текст трека пока не добавлен.</div>';
      }

      this.switchTrackTab(defaultTab);
      document.getElementById('trackView').classList.add('active');
    });
  },

  switchTrackTab(tabName) {
    document.querySelectorAll('.track-view-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabName));
    document.querySelectorAll('.track-view-tab-content').forEach(c => c.classList.remove('active'));
    const t = document.getElementById('tab' + tabName.charAt(0).toUpperCase() + tabName.slice(1));
    if (t) t.classList.add('active');
    if (tabName === 'ratings') this.loadTrackRatings();
    if (tabName === 'comments') this.loadTrackComments();
    if (tabName === 'lyrics') this.loadTrackLyrics();
    if (tabName === 'info') this.loadTrackInfo();
    if (tabName === 'ratingsList') this.loadTrackRatingsList();
  },

  loadTrackRatings() {
    const songId = this.currentTrackSongId;
    DB.getAll(CONFIG.STORE_SONGS).then(songs => {
      const song = songs.find(s => s.id === songId);
      if (!song) return;
      const myRating = song.ratings?.find(r => r.userId === Auth.currentUser.id);
      this.buildSliders('ratingSliders', myRating?.scores, () => {
        let sum = 0;
        for (let i = 0; i < CONFIG.CRITERIA.length; i++) { const sl = document.getElementById(`ratingSlidersRange${i}`); if (sl) sum += parseInt(sl.value, 10); }
        document.getElementById('liveTotal').textContent = sum;
        const scores = [];
        for (let i = 0; i < CONFIG.CRITERIA.length; i++) { const sl = document.getElementById(`ratingSlidersRange${i}`); scores.push(sl ? parseInt(sl.value, 10) : 0); }
        const rc = document.getElementById('trackRatingRadar');
        if (rc) RadarChart.drawLarge(rc, scores);
      });
      const rc = document.getElementById('trackRatingRadar');
      if (rc) RadarChart.drawLarge(rc, myRating?.scores || [0, 0, 0, 0, 0]);
    });
  },

  loadTrackRatingsList() {
    const songId = this.currentTrackSongId;
    DB.getAll(CONFIG.STORE_SONGS).then(songs => {
      const song = songs.find(s => s.id === songId);
      if (!song) return;
      const container = document.getElementById('ratingsListContainer');
      const ratings = song.ratings || [];
      const isAdmin = Auth.currentUser?.isAdmin;
      const myUserId = Auth.currentUser?.id;
      if (ratings.length === 0) { container.innerHTML = '<div style="color:#888;text-align:center;padding:40px;">Пока нет оценок</div>'; return; }
      let html = '';
      html += this.renderAverageRating(song);
      const myRating = ratings.find(r => r.userId === myUserId);
      if (myRating) { html += '<div style="font-weight:600;font-size:0.85rem;color:var(--primary);margin:12px 0 8px;">★ Ваша оценка</div>'; html += this.renderUserRatingCard(myRating, isAdmin, songId); }
      const others = ratings.filter(r => r.userId !== myUserId);
      if (others.length > 0) { html += '<div style="font-weight:600;font-size:0.85rem;color:var(--text-secondary);margin:12px 0 8px;">Оценки других пользователей</div>'; html += others.map(r => this.renderUserRatingCard(r, isAdmin, songId)).join(''); }
      container.innerHTML = html;
      if (isAdmin) {
        container.querySelectorAll('.delete-rating-btn').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const tid = e.target.dataset.userid;
            if (!confirm('Удалить эту оценку?')) return;
            const ss = await DB.getAll(CONFIG.STORE_SONGS);
            const s = ss.find(x => x.id === songId);
            if (!s || !s.ratings) return;
            s.ratings = s.ratings.filter(r => String(r.userId) !== String(tid));
            const ts = JSON.parse(localStorage.getItem('bpt_tombstones') || '{}');
            if (!ts.ratings) ts.ratings = [];
            ts.ratings.push({ id: String(tid) + '_' + String(songId), timestamp: Date.now() });
            localStorage.setItem('bpt_tombstones', JSON.stringify(ts));
            await DB.put(CONFIG.STORE_SONGS, s);
            this.loadTrackRatingsList();
            Sync.onDataChanged();
          });
        });
      }
    });
  },

  loadTrackComments() {
    const songId = this.currentTrackSongId;
    DB.getAll(CONFIG.STORE_SONGS).then(songs => {
      const song = songs.find(s => s.id === songId);
      if (!song) return;
      this.renderCommentsList(song.comments || []);
    });
  },

  loadTrackLyrics() {
    const songId = this.currentTrackSongId;
    DB.getAll(CONFIG.STORE_SONGS).then(songs => {
      const song = songs.find(s => s.id === songId);
      if (!song) return;
      const el = document.getElementById('trackLyrics');
      if (song.lyrics) el.textContent = song.lyrics;
      else el.innerHTML = '<div class="track-lyrics-empty"><div class="icon">📝</div><div>Текст песни не добавлен</div></div>';
    });
  },

  loadTrackInfo() {
    const songId = this.currentTrackSongId;
    DB.getAll(CONFIG.STORE_SONGS).then(songs => {
      const song = songs.find(s => s.id === songId);
      if (!song) return;
      const avg = this.getAverageRating(song);
      const rc = song.ratings?.length || 0;
      const cc = song.comments?.length || 0;
      const mp = CONFIG.MAX_SCORE * CONFIG.CRITERIA.length;
      document.getElementById('trackInfoGrid').innerHTML =
        `<div class="track-info-item"><div class="label">Исполнитель</div><div class="value">${this.escapeHtml(song.artist || '—')}</div></div>` +
        `<div class="track-info-item"><div class="label">Продюсер</div><div class="value">${this.escapeHtml(song.producer || '—')}</div></div>` +
        `<div class="track-info-item"><div class="label">Альбом</div><div class="value">${this.escapeHtml(song.album || '—')}</div></div>` +
        `<div class="track-info-item"><div class="label">Дата добавления</div><div class="value">${song.date || '—'}</div></div>` +
        `<div class="track-info-item"><div class="label">Средний балл</div><div class="value highlight">${avg !== null ? avg + ' ★' : '—'}</div></div>` +
        `<div class="track-info-item"><div class="label">Кол-во оценок</div><div class="value">${rc}</div></div>` +
        `<div class="track-info-item"><div class="label">Кол-во комментариев</div><div class="value">${cc}</div></div>` +
        `<div class="track-info-item"><div class="label">Средний общий балл</div><div class="value">${avg !== null ? avg + ' / ' + mp : '—'}</div></div>` +
        `<div class="track-info-item"><div class="label">Аудио</div><div class="value">${song.audioUrl ? '🔗 URL' : song.audioBlob ? '📁 Файл' : '—'}</div></div>`;
    });
  },

  openAlbumRatingModal(albumName) {
    this.currentAlbumRatingName = albumName;
    DB.get(CONFIG.STORE_ALBUMS, albumName).then(album => {
      document.getElementById('albumRatingInfo').textContent = `Альбом: ${albumName}`;
      const myRating = album?.ratings?.find(r => r.userId === Auth.currentUser.id);
      this.buildSliders('albumRatingSliders', myRating?.scores, () => { 
        let s = 0; 
        for (let i = 0; i < CONFIG.CRITERIA.length; i++) { 
          const sl = document.getElementById(`albumRatingSlidersRange${i}`); 
          if (sl) s += parseInt(sl.value, 10); 
        } 
        document.getElementById('albumLiveTotal').textContent = s; 
      });
      
      const oc = document.getElementById('otherAlbumRatings');
      const others = album?.ratings?.filter(r => r.userId !== Auth.currentUser.id) || [];
      const isAdmin = Auth.currentUser?.isAdmin;
      
      oc.innerHTML = others.length === 0 ? '<div style="color:#888;">Нет оценок</div>' : others.map(r => `
        <div class="other-rating-item" style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;">
          <span><strong>${this.escapeHtml(r.username)}</strong>: ${r.total} ★</span>
          ${isAdmin ? `<button class="delete-album-rating-btn" data-userid="${r.userId}" data-albumname="${albumName}" style="background:#cf6679;border:none;color:white;padding:2px 8px;border-radius:4px;cursor:pointer;font-size:0.75rem;">✕</button>` : ''}
        </div>
      `).join('');

      if (isAdmin) {
        oc.querySelectorAll('.delete-album-rating-btn').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const uid = e.target.dataset.userid;
            if (!confirm('Удалить эту оценку альбома?')) return;
            const alb = await DB.get(CONFIG.STORE_ALBUMS, albumName);
            if (!alb || !alb.ratings) return;
            alb.ratings = alb.ratings.filter(r => String(r.userId) !== String(uid));
            await DB.put(CONFIG.STORE_ALBUMS, alb);
            this.openAlbumRatingModal(albumName);
            Sync.onDataChanged();
          });
        });
      }

      document.getElementById('modalAlbumRating').classList.add('active');
    });
  },

  buildSliders(containerId, initialScores, onChange) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = CONFIG.CRITERIA.map((criterion, i) => {
      const val = initialScores ? initialScores[i] : 0;
      return `<div class="rating-slider-row">
        <div class="rating-slider-label"><span>${criterion}</span><span id="${containerId}Val${i}">${val}</span></div>
        <input type="range" id="${containerId}Range${i}" min="0" max="${CONFIG.MAX_SCORE}" value="${val}" class="rating-range">
      </div>`;
    }).join('');

    CONFIG.CRITERIA.forEach((_, i) => {
      const range = document.getElementById(`${containerId}Range${i}`);
      const valSpan = document.getElementById(`${containerId}Val${i}`);
      if (range) {
        range.addEventListener('input', (e) => {
          if (valSpan) valSpan.textContent = e.target.value;
          if (onChange) onChange();
        });
      }
    });
    if (onChange) onChange();
  },

  renderCommentsList(comments) {
    const c = document.getElementById('commentsContainer');
    if (!c) return;
    const isAdmin = Auth.currentUser?.isAdmin;
    if (!comments || comments.length === 0) {
      c.innerHTML = '<div style="color:#888;text-align:center;padding:40px;">Пока нет комментариев. Будьте первыми!</div>';
      return;
    }
    c.innerHTML = comments.map((comment, index) => {
      const initials = comment.username ? comment.username.charAt(0).toUpperCase() : '?';
      return `<div class="comment-item">
        <div class="comment-avatar">${initials}</div>
        <div class="comment-content">
          <div class="comment-header">
            <span class="comment-username">${this.escapeHtml(comment.username)}</span>
            <span class="comment-date">${comment.date}</span>
          </div>
          <div class="comment-text">${this.escapeHtml(comment.text)}</div>
        </div>
        ${isAdmin || comment.userId === Auth.currentUser?.id ? `<button class="delete-comment-btn" data-index="${index}" style="background:none;border:none;color:#888;cursor:pointer;font-size:0.9rem;">✕</button>` : ''}
      </div>`;
    }).join('');

    c.querySelectorAll('.delete-comment-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const index = parseInt(e.target.dataset.index, 10);
        const songId = this.currentTrackSongId;
        const songs = await DB.getAll(CONFIG.STORE_SONGS);
        const song = songs.find(s => s.id === songId);
        if (!song || !song.comments) return;
        song.comments.splice(index, 1);
        await DB.put(CONFIG.STORE_SONGS, song);
        this.loadTrackComments();
        Sync.onDataChanged();
      });
    });
  },

  toggleFavorite(songId) {
    const favs = this.getFavorites();
    const index = favs.indexOf(songId);
    if (index >= 0) {
      favs.splice(index, 1);
    } else {
      favs.push(songId);
    }
    this.saveFavorites(favs);
    this.refreshAll();
    Sync.onDataChanged();
  }
  
  async updateAlbumDatalist() { const a = await DB.getAll(CONFIG.STORE_ALBUMS); document.getElementById('albumList').innerHTML = a.map(x => `<option value="${this.escapeHtml(x.name)}">`).join(''); },

  openAddModal() {
    document.getElementById('addSongForm').reset();
    document.getElementById('audioUrlsContainer').innerHTML = '<div class="audio-track-row" style="margin-bottom:12px;"><input type="text" class="audio-url-input" placeholder="Ссылка на трек" style="width:100%;"><input type="text" class="audio-title-input" placeholder="Название трека" style="width:100%;margin-top:4px;"></div>';
    this.updateAlbumDatalist();
    document.getElementById('modalAdd').classList.add('active');
  },
  
  async openEditModal(songId) {
    if (!Auth.currentUser || !Auth.currentUser.isAdmin) return;
    const ss = await DB.getAll(CONFIG.STORE_SONGS);
    const s = ss.find(x => x.id === songId);
    if (!s) return;
    document.getElementById('editSongId').value = s.id;
    document.getElementById('editSongTitle').value = s.title || '';
    document.getElementById('editSongArtist').value = s.artist || '';
    document.getElementById('editSongProducer').value = s.producer || '';
    document.getElementById('editSongAlbum').value = s.album || '';
    document.getElementById('editSongAudioUrl').value = s.audioUrl || '';
    document.getElementById('editSongCoverUrl').value = s.coverUrl || '';
    document.getElementById('editSongAudioFile').value = '';
    document.getElementById('editSongCoverFile').value = '';
    document.getElementById('editSongLyrics').value = s.lyrics || '';
    document.getElementById('modalEdit').classList.add('active');
  }
};