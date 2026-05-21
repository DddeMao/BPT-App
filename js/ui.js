/**
 * UI: СЂРµРЅРґРµСЂРёРЅРі, РјРѕРґР°Р»СЊРЅС‹Рµ РѕРєРЅР°, СѓС‚РёР»РёС‚С‹
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

  // ========== РЈРўРР›РРўР« ==========

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

  // ========== Р¤РР›Р¬РўР РђР¦РРЇ Р РЎРћР РўРР РћР’РљРђ ==========

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

  // ========== Р Р•РќР”Р•Р РРќР“ РўР Р•РљРћР’ ==========

  renderSongs(songs) {
    const container = document.getElementById('dynamicList');
    if (!songs || songs.length === 0) {
      container.innerHTML = '<div style="color:#888; text-align:center; padding:40px;">РўСЂРµРєРё РЅРµ РЅР°Р№РґРµРЅС‹</div>';
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
        scoreHtml = `
          <div class="card-score-row" style="display:flex;align-items:center;gap:10px;">
            <canvas class="card-radar" width="48" height="48" data-scores='${JSON.stringify(userRating.scores)}'></canvas>
            <div style="flex:1;">
              <div class="total" style="font-size:0.9rem;">Р’Р°С€Р°: ${userRating.total} в…</div>
              ${avg !== null ? `<div style="font-size:0.75rem;color:var(--text-secondary);">РЎСЂРµРґРЅРёР№: ${avg} в… (${song.ratings.length})</div>` : ''}
            </div>
          </div>`;
      } else {
        scoreHtml = `<div style="color:#888; font-style:italic; font-size:0.85rem;">Р’С‹ РЅРµ РѕС†РµРЅРёР»Рё</div>`;
        if (avg !== null) {
          scoreHtml += `<div style="font-size:0.75rem;color:var(--text-secondary);">РЎСЂРµРґРЅРёР№: ${avg} в… (${song.ratings.length})</div>`;
        }
      }

      const albumLine = song.album ? `<span>рџ’ї ${this.escapeHtml(song.album)}</span>` : '';
      const dateLine = song.date ? `<span>рџ“… ${song.date}</span>` : '';
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

    // РћС‚СЂРёСЃРѕРІРєР° РјРёРЅРё-СЂР°РґР°СЂРѕРІ РЅР° РєР°СЂС‚РѕС‡РєР°С…
    container.querySelectorAll('.card-radar').forEach(canvas => {
      try {
        const scores = JSON.parse(canvas.dataset.scores);
        RadarChart.drawMini(canvas, scores);
      } catch (e) {}
    });

    // РћР±СЂР°Р±РѕС‚С‡РёРєРё РєР°СЂС‚РѕС‡РµРє
    container.querySelectorAll('.play-btn').forEach(btn =>
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.closest('.card')?.dataset.id;
        if (id) Player.play(id);
      })
    );
    container.querySelectorAll('.rate-btn').forEach(btn =>
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.closest('.card')?.dataset.id;
        if (id) this.openTrackView(id, 'ratings');
      })
    );
    container.querySelectorAll('.comment-btn').forEach(btn =>
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.closest('.card')?.dataset.id;
        if (id) this.openTrackView(id, 'comments');
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
        if (id && confirm('РЈРґР°Р»РёС‚СЊ СЌС‚РѕС‚ С‚СЂРµРє Рё РІСЃРµ РµРіРѕ РґР°РЅРЅС‹Рµ?')) {
          DB.delete(CONFIG.STORE_SONGS, id).then(() => {
            App.refreshAll();
            Sync.onDataChanged();
          });
        }
      })
    );

    // РљР»РёРє РїРѕ РєР°СЂС‚РѕС‡РєРµ вЂ” РѕС‚РєСЂС‹С‚СЊ РѕРєРЅРѕ С‚СЂРµРєР°
    container.querySelectorAll('.card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        const id = card.dataset.id;
        if (id) this.openTrackView(id, 'ratings');
      });
    });
  },

  // ========== Р Р•РќР”Р•Р РРќР“ РўРћРџ-12 ==========

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
        <div class="top-vertical-item" data-id="${song.id}" style="cursor:pointer;">
          ${coverUrl ? `<img src="${coverUrl}" alt="cover">` : '<div style="width:44px;height:44px;background:#333;border-radius:8px;"></div>'}
          <div class="tvi-info">
            <div class="tvi-title">${this.escapeHtml(song.title)}</div>
            <div class="tvi-artist">${this.escapeHtml(song.artist)}</div>
          </div>
          <div class="tvi-score">${avg} в…</div>
        </div>`;
    }).join('');

    // РљР»РёРє РїРѕ СЌР»РµРјРµРЅС‚Сѓ С‚РѕРї-12
    container.querySelectorAll('.top-vertical-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        if (id) this.openTrackView(id, 'ratings');
      });
    });
  },

  // ========== Р Р•РќР”Р•Р РРќР“ РђР›Р¬Р‘РћРњРћР’ ==========

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
        ? `<span style="color:var(--accent); font-weight:700;">в… ${totalScore}</span>`
        : 'РќРµ РѕС†РµРЅРµРЅ';
      const dateDisplay = albumData?.date ? `рџ“… ${albumData.date}` : '';
      return `
        <div class="album-card" data-album="${this.escapeHtml(albumName)}">
          ${coverUrl ? `<img class="album-cover" src="${coverUrl}" alt="cover">` : '<div class="album-cover"></div>'}
          <div class="album-info">
            <h3>${this.escapeHtml(albumName)}</h3>
            <div class="album-artist">${this.escapeHtml(firstTrack.artist)}</div>
            <div class="track-count">${tracks.length} С‚СЂРµРєРѕРІ ${dateDisplay}</div>
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
      const artistName = firstSong?.artist || 'РќРµРёР·РІРµСЃС‚РµРЅ';
      return `
        <div class="top-vertical-item">
          ${coverUrl ? `<img src="${coverUrl}" alt="cover">` : '<div style="width:44px;height:44px;background:#333;border-radius:8px;"></div>'}
          <div class="tvi-info">
            <div class="tvi-title">${this.escapeHtml(album.name)}</div>
            <div class="tvi-artist">${this.escapeHtml(artistName)}</div>
          </div>
          <div class="tvi-score">${avg} в…</div>
        </div>`;
    }).join('');
  },

  // ========== РџР РћРЎРњРћРўР  РђР›Р¬Р‘РћРњРђ ==========

  async openAlbumView(albumName) {
    const songs = await DB.getAll(CONFIG.STORE_SONGS);
    const albumTracks = songs.filter(s => s.album === albumName);
    if (albumTracks.length === 0) return;
    const albumData = await DB.get(CONFIG.STORE_ALBUMS, albumName) || { name: albumName, ratings: [], trackOrder: [], date: '' };
    const trackOrder = albumData.trackOrder || albumTracks.map(t => t.id);
    const orderedTracks = trackOrder.map(id => albumTracks.find(t => t.id === id)).filter(t => t !== undefined);
    albumTracks.forEach(t => { if (!orderedTracks.includes(t)) orderedTracks.push(t); });
    const isAdmin = Auth.currentUser?.isAdmin;
    document.getElementById('albumViewTitle').textContent = `рџ’ї ${albumName}`;
    const container = document.getElementById('albumViewTracks');
    const existingDateRow = document.getElementById('albumDateRow');
    if (existingDateRow) existingDateRow.remove();
    if (isAdmin) {
      const dateRow = document.createElement('div');
      dateRow.id = 'albumDateRow';
      dateRow.className = 'album-date-row';
      dateRow.innerHTML = `
        <label>рџ“… Р”Р°С‚Р° Р°Р»СЊР±РѕРјР°:</label>
        <input type="date" id="albumDateInput" value="${albumData.date || ''}">
        <button id="applyDateToTracks" class="btn-settings" style="font-size:0.85rem;">РџСЂРёРјРµРЅРёС‚СЊ РєРѕ РІСЃРµРј С‚СЂРµРєР°Рј</button>
      `;
      container.parentNode.insertBefore(dateRow, container);
      document.getElementById('applyDateToTracks').onclick = async () => {
        const newDate = document.getElementById('albumDateInput').value;
        if (!confirm(`РџСЂРёРјРµРЅРёС‚СЊ РґР°С‚Сѓ "${newDate}" РєРѕ РІСЃРµРј С‚СЂРµРєР°Рј СЌС‚РѕРіРѕ Р°Р»СЊР±РѕРјР°?`)) return;
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.classList.add('active');
        try {
          for (const song of albumTracks) { song.date = newDate; await DB.put(CONFIG.STORE_SONGS, song); }
          albumData.date = newDate;
          await DB.put(CONFIG.STORE_ALBUMS, albumData);
          this.openAlbumView(albumName);
          Sync.onDataChanged();
        } catch (err) { console.error(err); alert('РћС€РёР±РєР° РїСЂРё РѕР±РЅРѕРІР»РµРЅРёРё РґР°С‚С‹'); }
        finally { if (overlay) overlay.classList.remove('active'); }
      };
      document.getElementById('albumDateInput').addEventListener('change', async () => {
        albumData.date = document.getElementById('albumDateInput').value;
        await DB.put(CONFIG.STORE_ALBUMS, albumData);
        Sync.onDataChanged();
      });
    }
    container.innerHTML = orderedTracks.map((song, index) => {
      const coverUrl = song.coverUrl || (song.coverBlob ? URL.createObjectURL(song.coverBlob) : '');
      const avg = this.getAverageRating(song);
      const userRating = song.ratings?.find(r => r.userId === Auth.currentUser?.id);
      let scoreHtml = '';
      if (userRating) {
        scoreHtml = `<div class="score-circles">${userRating.scores.map((s, i) => `<span class="score-circle" style="background: ${this.getScoreColor(s)};" title="${CONFIG.CRITERIA[i]}: ${s}/${CONFIG.MAX_SCORE}">${s}</span>`).join('')}</div><div class="total">Р’Р°С€Р°: ${userRating.total} в…</div>`;
      } else {
        scoreHtml = `<div style="color:#888;">РќРµ РѕС†РµРЅРµРЅ</div>`;
      }
      if (avg !== null) scoreHtml += `<div style="font-size:0.85rem; color:var(--text-secondary);">РЎСЂРµРґРЅРёР№: ${avg} в…</div>`;
      return `
        <div class="card draggable-song" draggable="${isAdmin}" data-id="${song.id}">
          ${isAdmin ? `<span class="drag-handle show" title="РџРµСЂРµС‚Р°С‰РёС‚СЊ">в‰Ў</span>` : ''}
          <div class="card-top">
            ${coverUrl ? `<img class="card-cover" src="${coverUrl}" alt="cover">` : '<div class="card-cover"></div>'}
            <div class="card-info">
              <div class="card-title"><span class="track-num">${index + 1}.</span>${this.escapeHtml(song.title)}</div>
              <div class="card-artist">${this.escapeHtml(song.artist)}</div>
            </div>
          </div>
          ${scoreHtml}
          <div class="card-actions">
            <button class="play-btn" data-id="${song.id}">в–¶ РЎР»СѓС€Р°С‚СЊ</button>
          </div>
        </div>`;
    }).join('');
    container.querySelectorAll('.play-btn').forEach(btn =>
      btn.addEventListener('click', (e) => { e.stopPropagation(); Player.play(e.target.dataset.id); })
    );
    if (isAdmin) {
      const draggables = container.querySelectorAll('.draggable-song');
      let draggedItem = null;
      draggables.forEach(item => {
        item.addEventListener('dragstart', (e) => { draggedItem = item; item.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', item.dataset.id); });
        item.addEventListener('dragend', () => { item.classList.remove('dragging'); draggedItem = null; draggables.forEach(d => d.classList.remove('drag-over')); });
        item.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (item !== draggedItem) item.classList.add('drag-over'); });
        item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
        item.addEventListener('drop', async (e) => { e.preventDefault(); if (item === draggedItem) return; const allItems = Array.from(container.querySelectorAll('.draggable-song')); const draggedIndex = allItems.indexOf(draggedItem); const targetIndex = allItems.indexOf(item); if (draggedIndex < targetIndex) item.parentNode.insertBefore(draggedItem, item.nextSibling); else item.parentNode.insertBefore(draggedItem, item); const newOrder = Array.from(container.querySelectorAll('.draggable-song')).map(d => d.dataset.id); albumData.trackOrder = newOrder; await DB.put(CONFIG.STORE_ALBUMS, albumData); this.openAlbumView(albumName); Sync.onDataChanged(); });
      });
    }
    const deleteBtn = document.getElementById('deleteAlbumBtn');
    if (deleteBtn) { deleteBtn.onclick = async () => { if (confirm(`РЈРґР°Р»РёС‚СЊ Р°Р»СЊР±РѕРј "${albumName}" Рё РІСЃРµ РµРіРѕ С‚СЂРµРєРё?`)) { for (const song of albumTracks) await DB.delete(CONFIG.STORE_SONGS, song.id); await DB.delete(CONFIG.STORE_ALBUMS, albumName); this.closeModal(document.getElementById('modalAlbumView')); App.refreshAll(); Sync.onDataChanged(); } }; }
    const rateBtn = document.getElementById('rateAlbumBtn');
    if (rateBtn) { rateBtn.onclick = () => { this.closeModal(document.getElementById('modalAlbumView')); this.openAlbumRatingModal(albumName); }; }
    const closeBtn = document.querySelector('.close-album-view');
    if (closeBtn) closeBtn.onclick = () => this.closeModal(document.getElementById('modalAlbumView'));
    document.getElementById('modalAlbumView').classList.add('active');
  },

  // ========== РћРљРќРћ РўР Р•РљРђ РЎ Р’РљР›РђР”РљРђРњР ==========

  openTrackView(songId, defaultTab = 'ratings') {
    DB.getAll(CONFIG.STORE_SONGS).then(songs => {
      const song = songs.find(s => s.id === songId);
      if (!song) return;
      this.currentTrackSongId = songId;
      this.currentRatingSongId = songId;
      this.currentCommentSongId = songId;

      const coverUrl = song.coverUrl || (song.coverBlob ? URL.createObjectURL(song.coverBlob) : '');

      // Р—Р°РїРѕР»РЅСЏРµРј С€Р°РїРєСѓ
      document.getElementById('trackViewCover').src = coverUrl;
      document.getElementById('trackViewTitle').textContent = song.title;
      document.getElementById('trackViewArtist').textContent = song.artist;

      const avg = this.getAverageRating(song);
      const ratingCount = song.ratings?.length || 0;
      const commentCount = song.comments?.length || 0;
      document.getElementById('trackViewMeta').innerHTML = `
        ${song.album ? `<span>рџ’ї ${this.escapeHtml(song.album)}</span>` : ''}
        ${song.date ? `<span>рџ“… ${song.date}</span>` : ''}
        ${avg !== null ? `<span>в­ђ ${avg} СЃСЂРµРґРЅРёР№</span>` : ''}
        <span>рџ“Љ ${ratingCount} РѕС†РµРЅРѕРє</span>
        <span>рџ’¬ ${commentCount} РєРѕРјРјРµРЅС‚Р°СЂРёРµРІ</span>
      `;

      // РџРµСЂРµРєР»СЋС‡Р°РµРј РІРєР»Р°РґРєСѓ
      this.switchTrackTab(defaultTab);

      // РћС‚РєСЂС‹РІР°РµРј РѕРєРЅРѕ
      document.getElementById('trackView').classList.add('active');
    });
  },

  switchTrackTab(tabName) {
    // РћР±РЅРѕРІР»СЏРµРј РєРЅРѕРїРєРё РІРєР»Р°РґРѕРє
    document.querySelectorAll('.track-view-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // РћР±РЅРѕРІР»СЏРµРј СЃРѕРґРµСЂР¶РёРјРѕРµ
    document.querySelectorAll('.track-view-tab-content').forEach(content => {
      content.classList.remove('active');
    });
    const targetContent = document.getElementById('tab' + tabName.charAt(0).toUpperCase() + tabName.slice(1));
    if (targetContent) targetContent.classList.add('active');

    // Р—Р°РіСЂСѓР¶Р°РµРј РґР°РЅРЅС‹Рµ РґР»СЏ РІРєР»Р°РґРєРё
    if (tabName === 'ratings') this.loadTrackRatings();
    if (tabName === 'comments') this.loadTrackComments();
    if (tabName === 'lyrics') this.loadTrackLyrics();
    if (tabName === 'info') this.loadTrackInfo();
  },

  loadTrackRatings() {
    const songId = this.currentTrackSongId;
    DB.getAll(CONFIG.STORE_SONGS).then(songs => {
      const song = songs.find(s => s.id === songId);
      if (!song) return;
      const myRating = song.ratings?.find(r => r.userId === Auth.currentUser.id);
      this.buildSliders('ratingSliders', myRating?.scores, () => {
        let sum = 0;
        for (let i = 0; i < CONFIG.CRITERIA.length; i++) {
          const slider = document.getElementById(`ratingSlidersRange${i}`);
          if (slider) sum += parseInt(slider.value, 10);
        }
        document.getElementById('liveTotal').textContent = sum;
        // РћР±РЅРѕРІР»СЏРµРј СЂР°РґР°СЂ
        const scores = [];
        for (let i = 0; i < CONFIG.CRITERIA.length; i++) {
          const slider = document.getElementById(`ratingSlidersRange${i}`);
          scores.push(slider ? parseInt(slider.value, 10) : 0);
        }
        const radarCanvas = document.getElementById('trackRatingRadar');
        if (radarCanvas) RadarChart.drawLarge(radarCanvas, scores);
      });

      // РћС‚СЂРёСЃРѕРІРєР° СЂР°РґР°СЂР°
      const radarCanvas = document.getElementById('trackRatingRadar');
      if (radarCanvas) {
        RadarChart.drawLarge(radarCanvas, myRating?.scores || [0, 0, 0, 0, 0]);
      }

      // Р§СѓР¶РёРµ РѕС†РµРЅРєРё
      const otherContainer = document.getElementById('otherRatings');
      const others = song.ratings?.filter(r => r.userId !== Auth.currentUser.id) || [];
      const isAdmin = Auth.currentUser?.isAdmin;
      otherContainer.innerHTML = others.length === 0
        ? '<div style="color:#888;">РќРµС‚ РѕС†РµРЅРѕРє</div>'
        : others.map((r) => `
          <div class="other-rating-item" style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;">
            <span><strong>${this.escapeHtml(r.username)}</strong>: ${r.total} в… (${r.scores.map((s, i) => `${CONFIG.CRITERIA[i]}:${s}`).join(', ')})</span>
            ${isAdmin ? `<button class="delete-rating-btn" data-userid="${r.userId}" style="background:#cf6679;border:none;color:white;padding:2px 8px;border-radius:4px;cursor:pointer;font-size:0.75rem;">вњ•</button>` : ''}
          </div>`).join('');

      if (isAdmin) {
        otherContainer.querySelectorAll('.delete-rating-btn').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const targetUserId = e.target.dataset.userid;
            if (!confirm('РЈРґР°Р»РёС‚СЊ СЌС‚Сѓ РѕС†РµРЅРєСѓ?')) return;
            const songs = await DB.getAll(CONFIG.STORE_SONGS);
            const s = songs.find(s => s.id === songId);
            if (!s || !s.ratings) return;
            s.ratings = s.ratings.filter(r => String(r.userId) !== String(targetUserId));
            await DB.put(CONFIG.STORE_SONGS, s);
            this.loadTrackRatings();
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
      const lyricsEl = document.getElementById('trackLyrics');
      if (song.lyrics) {
        lyricsEl.textContent = song.lyrics;
      } else {
        lyricsEl.innerHTML = '<div class="track-lyrics-empty"><div class="icon">рџ“ќ</div><div>РўРµРєСЃС‚ РїРµСЃРЅРё РЅРµ РґРѕР±Р°РІР»РµРЅ</div></div>';
      }
    });
  },

  loadTrackInfo() {
    const songId = this.currentTrackSongId;
    DB.getAll(CONFIG.STORE_SONGS).then(songs => {
      const song = songs.find(s => s.id === songId);
      if (!song) return;
      const avg = this.getAverageRating(song);
      const ratingCount = song.ratings?.length || 0;
      const commentCount = song.comments?.length || 0;
      const totalScore = song.ratings?.reduce((sum, r) => sum + r.total, 0) || 0;
      const maxPossible = ratingCount * CONFIG.MAX_SCORE * CONFIG.CRITERIA.length;

      document.getElementById('trackInfoGrid').innerHTML = `
        <div class="track-info-item">
          <div class="label">РСЃРїРѕР»РЅРёС‚РµР»СЊ</div>
          <div class="value">${this.escapeHtml(song.artist || 'вЂ”')}</div>
        </div>
        <div class="track-info-item">
          <div class="label">РђР»СЊР±РѕРј</div>
          <div class="value">${this.escapeHtml(song.album || 'вЂ”')}</div>
        </div>
        <div class="track-info-item">
          <div class="label">Р”Р°С‚Р° РґРѕР±Р°РІР»РµРЅРёСЏ</div>
          <div class="value">${song.date || 'вЂ”'}</div>
        </div>
        <div class="track-info-item">
          <div class="label">РЎСЂРµРґРЅРёР№ Р±Р°Р»Р»</div>
          <div class="value highlight">${avg !== null ? avg + ' в…' : 'вЂ”'}</div>
        </div>
        <div class="track-info-item">
          <div class="label">РљРѕР»-РІРѕ РѕС†РµРЅРѕРє</div>
          <div class="value">${ratingCount}</div>
        </div>
        <div class="track-info-item">
          <div class="label">РљРѕР»-РІРѕ РєРѕРјРјРµРЅС‚Р°СЂРёРµРІ</div>
          <div class="value">${commentCount}</div>
        </div>
        <div class="track-info-item">
          <div class="label">РћР±С‰РёР№ Р±Р°Р»Р»</div>
          <div class="value">${totalScore} / ${maxPossible}</div>
        </div>
        <div class="track-info-item">
          <div class="label">РђСѓРґРёРѕ</div>
          <div class="value">${song.audioUrl ? 'рџ”— URL' : song.audioBlob ? 'рџ“Ѓ Р¤Р°Р№Р»' : 'вЂ”'}</div>
        </div>
      `;
    });
  },

  // ========== РњРћР”РђР›РљРђ РћР¦Р•РќРљР РђР›Р¬Р‘РћРњРђ ==========

  openAlbumRatingModal(albumName) {
    this.currentAlbumRatingName = albumName;
    DB.get(CONFIG.STORE_ALBUMS, albumName).then(album => {
      document.getElementById('albumRatingInfo').textContent = `РђР»СЊР±РѕРј: ${albumName}`;
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
        ? '<div style="color:#888;">РќРµС‚ РѕС†РµРЅРѕРє</div>'
        : others.map(r => `
          <div class="other-rating-item" style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;">
            <span><strong>${this.escapeHtml(r.username)}</strong>: ${r.total} в…</span>
            ${isAdmin ? `<button class="delete-album-rating-btn" data-userid="${r.userId}" style="background:#cf6679;border:none;color:white;padding:2px 8px;border-radius:4px;cursor:pointer;font-size:0.75rem;">вњ•</button>` : ''}
          </div>`).join('');
      if (isAdmin) {
        otherContainer.querySelectorAll('.delete-album-rating-btn').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const targetUserId = e.target.dataset.userid;
            if (!confirm('РЈРґР°Р»РёС‚СЊ СЌС‚Сѓ РѕС†РµРЅРєСѓ Р°Р»СЊР±РѕРјР°?')) return;
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

  // ========== РџРћР›Р—РЈРќРљР ==========

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

  // ========== РљРћРњРњР•РќРўРђР РР ==========

  renderCommentsList(comments) {
    const container = document.getElementById('commentsContainer');
    if (comments.length === 0) {
      container.innerHTML = '<div style="color:#888; text-align:center;">РџРѕРєР° РЅРµС‚ РєРѕРјРјРµРЅС‚Р°СЂРёРµРІ</div>';
      return;
    }
    container.innerHTML = comments.map((c, idx) => {
      const canDelete = c.userId === Auth.currentUser.id;
      return `
        <div class="comment-item">
          ${canDelete ? `<button class="comment-del" data-index="${idx}">вњ•</button>` : ''}
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

  // ========== РР—Р‘Р РђРќРќРћР• ==========

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

  // ========== Р”РћР‘РђР’Р›Р•РќРР• РўР Р•РљРђ ==========

  async updateAlbumDatalist() {
    const albums = await DB.getAll(CONFIG.STORE_ALBUMS);
    document.getElementById('albumList').innerHTML = albums.map(a => `<option value="${this.escapeHtml(a.name)}">`).join('');
  },

  openAddModal() {
    document.getElementById('addSongForm').reset();
    document.getElementById('audioUrlsContainer').innerHTML = `
      <div class="audio-track-row" style="margin-bottom: 12px;">
        <input type="text" class="audio-url-input" placeholder="РЎСЃС‹Р»РєР° РЅР° С‚СЂРµРє" style="width: 100%;">
        <input type="text" class="audio-title-input" placeholder="РќР°Р·РІР°РЅРёРµ С‚СЂРµРєР°" style="width: 100%; margin-top: 4px;">
      </div>
    `;
    this.updateAlbumDatalist();
    document.getElementById('modalAdd').classList.add('active');
  },

  // ========== Р Р•Р”РђРљРўРР РћР’РђРќРР• РўР Р•РљРђ ==========

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

