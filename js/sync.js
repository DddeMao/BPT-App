/**
 * GitHub синхронизация
 */
const Sync = {
  token: localStorage.getItem('bpt_github_token') || '',
  isSyncing: false,
  syncTimeout: null,

  setSyncing(state) {
    this.isSyncing = state;
    const dot = document.getElementById('syncingDot');
    if (dot) dot.classList.toggle('active', state);
    const loadingText = document.getElementById('loadingText');
    if (loadingText) loadingText.textContent = state ? 'Синхронизация…' : '';
  },

  async downloadMetadata() {
    const url = `https://api.github.com/repos/${CONFIG.GITHUB_USER}/${CONFIG.GITHUB_REPO}/contents/bpt-data.json`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `token ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Ошибка загрузки: ${res.status}`);
    const data = await res.json();
    const binary = atob(data.content);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const decoder = new TextDecoder('utf-8');
    return JSON.parse(decoder.decode(bytes));
  },

  async uploadMetadata() {
    const songs = await DB.getAll(CONFIG.STORE_SONGS);
    const albums = await DB.getAll(CONFIG.STORE_ALBUMS);
    const users = await DB.getAll(CONFIG.STORE_USERS);
    const tombstones = JSON.parse(localStorage.getItem('bpt_tombstones') || '{}');

    const songsMeta = songs.map(song => ({
      id: song.id,
      title: song.title,
      artist: song.artist,
      album: song.album,
      date: song.date,
      ratings: song.ratings,
      comments: song.comments,
      audioUrl: song.audioUrl || null,
      coverUrl: song.coverUrl || null,
      updatedAt: song.updatedAt || 0,
    }));

    const albumsMeta = albums.map(a => ({ ...a, updatedAt: a.updatedAt || 0 }));

    const usersWithFavorites = users.map(user => ({
      ...user,
      favorites: JSON.parse(localStorage.getItem(`bpt_favorites_${user.id}`) || '[]'),
    }));

    const metadata = {
      version: 3,
      songs: songsMeta,
      albums: albumsMeta,
      users: usersWithFavorites,
      tombstones,
      lastModified: Date.now(),
    };

    const jsonStr = JSON.stringify(metadata, null, 2);
    const utf8Bytes = new TextEncoder().encode(jsonStr);
    let binary = '';
    for (let i = 0; i < utf8Bytes.length; i++) binary += String.fromCharCode(utf8Bytes[i]);
    const base64content = btoa(binary);

    let sha = null;
    try {
      const check = await fetch(`https://api.github.com/repos/${CONFIG.GITHUB_USER}/${CONFIG.GITHUB_REPO}/contents/bpt-data.json`, {
        headers: { 'Authorization': `token ${this.token}`, 'Accept': 'application/vnd.github.v3+json' },
      });
      if (check.ok) {
        const info = await check.json();
        sha = info.sha;
      }
    } catch (e) {}

    const body = { message: `Sync Update ${new Date().toISOString()}`, content: base64content, branch: 'main' };
    if (sha) body.sha = sha;

    const res = await fetch(`https://api.github.com/repos/${CONFIG.GITHUB_USER}/${CONFIG.GITHUB_REPO}/contents/bpt-data.json`, {
      method: 'PUT',
      headers: { 'Authorization': `token ${this.token}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Ошибка загрузки: ${res.status}`);
  },

  mergeRatings(localRatings = [], remoteRatings = []) {
    const rMap = new Map();
    const processRating = (r) => {
      if (!r || !r.userId) return;
      const existing = rMap.get(r.userId);
      if (!existing || !existing.date || !r.date || new Date(r.date) > new Date(existing.date)) {
        rMap.set(r.userId, r);
      }
    };
    localRatings.forEach(processRating);
    remoteRatings.forEach(processRating);
    return Array.from(rMap.values());
  },

  async mergeRemoteMetadata(remoteData) {
    const localSongs = await DB.getAll(CONFIG.STORE_SONGS);
    const localAlbums = await DB.getAll(CONFIG.STORE_ALBUMS);

    const localTombstones = JSON.parse(localStorage.getItem('bpt_tombstones') || '{}');
    const remoteTombstones = remoteData.tombstones || {};

    ['songs', 'albums'].forEach(store => {
      if (!localTombstones[store]) localTombstones[store] = [];
      if (remoteTombstones[store]) {
        remoteTombstones[store].forEach(rt => {
          if (!localTombstones[store].find(lt => lt.id === rt.id)) {
            localTombstones[store].push(rt);
          }
        });
      }
    });
    localStorage.setItem('bpt_tombstones', JSON.stringify(localTombstones));

    for (const remoteSong of remoteData.songs || []) {
      const isDeleted = localTombstones.songs?.find(t => t.id === remoteSong.id);
      if (isDeleted) {
        if (!remoteSong.updatedAt || isDeleted.timestamp >= remoteSong.updatedAt) {
          await DB.delete(CONFIG.STORE_SONGS, remoteSong.id, true);
          continue;
        } else {
          localTombstones.songs = localTombstones.songs.filter(t => t.id !== remoteSong.id);
          localStorage.setItem('bpt_tombstones', JSON.stringify(localTombstones));
        }
      }

      const local = localSongs.find(s => s.id === remoteSong.id);
      if (local) {
        let changed = false;
        const localTime = local.updatedAt || 0;
        const remoteTime = remoteSong.updatedAt || 0;

        if (remoteTime > localTime) {
          local.title = remoteSong.title;
          local.artist = remoteSong.artist;
          local.album = remoteSong.album;
          local.audioUrl = remoteSong.audioUrl;
          local.coverUrl = remoteSong.coverUrl;
          local.date = remoteSong.date;
          local.updatedAt = remoteTime;
          changed = true;
        }

        const mergedRatings = this.mergeRatings(local.ratings, remoteSong.ratings);
        if (JSON.stringify(local.ratings) !== JSON.stringify(mergedRatings)) {
          local.ratings = mergedRatings;
          changed = true;
        }

        if (!local.comments) local.comments = [];
        for (const remoteComment of remoteSong.comments || []) {
          const duplicate = local.comments.find(c => c.userId === remoteComment.userId && c.text === remoteComment.text && c.date === remoteComment.date);
          if (!duplicate) {
            local.comments.push(remoteComment);
            changed = true;
          }
        }

        if (changed) await DB.put(CONFIG.STORE_SONGS, local, true);
      } else {
        await DB.add(CONFIG.STORE_SONGS, { ...remoteSong, audioBlob: null, coverBlob: null }, true);
      }
    }

    if (remoteData.users) {
      for (const remoteUser of remoteData.users) {
        const localUser = await DB.getUserByUsername(remoteUser.username);
        if (!localUser) {
          await DB.add(CONFIG.STORE_USERS, remoteUser, true);
          if (remoteUser.favorites) {
            localStorage.setItem(`bpt_favorites_${remoteUser.id}`, JSON.stringify(remoteUser.favorites));
          }
        } else {
          const localFavs = JSON.parse(localStorage.getItem(`bpt_favorites_${localUser.id}`) || '[]');
          const remoteFavs = remoteUser.favorites || [];
          const mergedFavs = [...new Set([...localFavs, ...remoteFavs])];
          localStorage.setItem(`bpt_favorites_${localUser.id}`, JSON.stringify(mergedFavs));
        }
      }
    }

    for (const remoteAlbum of remoteData.albums || []) {
      const isDeletedAlbum = localTombstones.albums?.find(t => t.id === remoteAlbum.name);
      if (isDeletedAlbum) {
        if (!remoteAlbum.updatedAt || isDeletedAlbum.timestamp >= remoteAlbum.updatedAt) {
          await DB.delete(CONFIG.STORE_ALBUMS, remoteAlbum.name, true);
          continue;
        } else {
          localTombstones.albums = localTombstones.albums.filter(t => t.id !== remoteAlbum.name);
          localStorage.setItem('bpt_tombstones', JSON.stringify(localTombstones));
        }
      }

      const exists = localAlbums.find(a => a.name === remoteAlbum.name);
      if (!exists) {
        await DB.put(CONFIG.STORE_ALBUMS, remoteAlbum, true);
      } else {
        let albumChanged = false;
        const localTime = exists.updatedAt || 0;
        const remoteTime = remoteAlbum.updatedAt || 0;

        if (remoteTime > localTime) {
          exists.trackOrder = remoteAlbum.trackOrder || [];
          exists.date = remoteAlbum.date || '';
          exists.updatedAt = remoteTime;
          albumChanged = true;
        } else {
          const mergedOrder = [...(exists.trackOrder || [])];
          for (const id of remoteAlbum.trackOrder || []) {
            if (!mergedOrder.includes(id)) { mergedOrder.push(id); albumChanged = true; }
          }
          if (albumChanged) exists.trackOrder = mergedOrder;
        }

        const mergedAlbumRatings = this.mergeRatings(exists.ratings, remoteAlbum.ratings);
        if (JSON.stringify(exists.ratings) !== JSON.stringify(mergedAlbumRatings)) {
          exists.ratings = mergedAlbumRatings;
          albumChanged = true;
        }

        if (albumChanged) await DB.put(CONFIG.STORE_ALBUMS, exists, true);
      }
    }
  },

  async sync(force = false) {
    if (this.isSyncing) return;
    if (!this.token || !CONFIG.GITHUB_USER || !CONFIG.GITHUB_REPO) {
      if (force) UI.showNotification('Укажите токен и репозиторий в настройках ⚙️', true);
      return;
    }

    this.setSyncing(true);
    const progressBar = document.getElementById('syncProgressContainer');
    const progressFill = document.getElementById('syncProgressFill');
    if (progressBar) progressBar.style.display = 'flex';
    if (progressFill) progressFill.style.width = '10%';

    try {
      const remoteData = await this.downloadMetadata();
      if (progressFill) progressFill.style.width = '40%';

      if (remoteData) await this.mergeRemoteMetadata(remoteData);
      if (progressFill) progressFill.style.width = '70%';

      await this.uploadMetadata();
      if (progressFill) progressFill.style.width = '100%';

      if (force) UI.showNotification('Синхронизация завершена');
    } catch (err) {
      console.error('Синхронизация не удалась:', err);
      if (force) UI.showNotification('Ошибка: ' + err.message);
    } finally {
      setTimeout(() => { if (progressBar) progressBar.style.display = 'none'; }, 500);
      this.setSyncing(false);
      App.refreshAll();
    }
  },

  onDataChanged() {
    if (CONFIG.GITHUB_USER && CONFIG.GITHUB_REPO && this.token) {
      clearTimeout(this.syncTimeout);
      this.syncTimeout = setTimeout(() => this.sync(), CONFIG.SYNC_DELAY);
    }
  },
};
