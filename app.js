// ========== APP ENTRY POINT ==========
const githubUser = 'DddeMao';
const githubRepo = 'BvsT';
let githubToken = localStorage.getItem('bpt_github_token') || '';
let isSyncing = false;
let syncTimeout = null;

// --- Event listeners (safe null-checked) ---
function initEventListeners() {
  // Settings
  const sBtn = document.getElementById('settingsBtn');
  if (sBtn) sBtn.addEventListener('click', () => {
    const u = document.getElementById('newUsername'), p = document.getElementById('settingsPassword');
    const t = document.getElementById('settingsGithubToken');
    if (u) u.value = currentUser?.username || '';
    if (p) p.value = '';
    if (t) t.value = githubToken;
    const m = document.getElementById('modalSettings');
    if (m) m.classList.add('active');
    updateAdminUI();
  });

  const closeSettings = document.querySelector('.close-settings');
  if (closeSettings) closeSettings.addEventListener('click', () => closeModal(document.getElementById('modalSettings')));

  // Settings form
  const sf = document.getElementById('settingsForm');
  if (sf) sf.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nu = document.getElementById('newUsername')?.value.trim();
    const pw = document.getElementById('settingsPassword')?.value;
    if (!nu) return;
    const skip = currentUser?.isAdmin || currentUser?.passwordHash === 'tg_authorized';
    if (!skip && !pw) { showNotification('Введите пароль'); return; }
    if (!skip) {
      const h = await hashPassword(pw);
      if (h !== currentUser.passwordHash) throw new Error('Неверный пароль');
    }
    if (nu !== currentUser.username) {
      const ex = await getUserByUsername(nu);
      if (ex) throw new Error('Ник занят');
      currentUser.username = nu;
      await dbPut(STORE_USERS, currentUser);
    }
    const tok = document.getElementById('settingsGithubToken')?.value.trim();
    if (tok !== undefined) { githubToken = tok; localStorage.setItem('bpt_github_token', tok); }
    showNotification('Сохранено!');
    closeModal(document.getElementById('modalSettings'));
    refreshAll();
    if (githubToken) syncWithGitHub();
  });

  // Logout
  const lo = document.getElementById('logoutBtn');
  if (lo) lo.addEventListener('click', () => { currentUser = null; clearSession(); showAuthScreen(); });

  // Search
  const si = document.getElementById('searchInput');
  const cs = document.getElementById('clearSearchBtn');
  if (si) si.addEventListener('input', (e) => { currentSearch = e.target.value; if (cs) cs.style.display = currentSearch ? 'block' : 'none'; refreshAll(); });
  if (cs) cs.addEventListener('click', () => { if (si) si.value = ''; currentSearch = ''; cs.style.display = 'none'; refreshAll(); });

  // Sort
  ['Date','Name','Rating','Favorites'].forEach(s => {
    const b = document.getElementById(`sort${s}Btn`);
    if (b) b.addEventListener('click', () => setSort(s.toLowerCase()));
  });

  // Sync
  const sn = document.getElementById('syncNowBtn');
  if (sn) sn.addEventListener('click', () => syncWithGitHub(true));

  // Add track
  const ab = document.getElementById('addBtn');
  if (ab) ab.addEventListener('click', async () => {
    const f = document.getElementById('addSongForm');
    if (f) f.reset();
    const c = document.getElementById('audioUrlsContainer');
    if (c) c.innerHTML = '<div class="audio-track-row"><input type="text" class="audio-url-input" placeholder="Ссылка на трек" style="width:100%;"><input type="text" class="audio-title-input" placeholder="Название" style="width:100%;margin-top:4px;"></div>';
    const m = document.getElementById('modalAdd');
    if (m) m.classList.add('active');
  });

  const closeAdd = document.querySelector('#modalAdd .close');
  if (closeAdd) closeAdd.addEventListener('click', () => closeModal(document.getElementById('modalAdd')));

  // Rating form
  const rf = document.getElementById('ratingForm');
  if (rf) rf.addEventListener('submit', (e) => { e.preventDefault(); saveSongRating(); });

  const closeRating = document.querySelector('.close-rating');
  if (closeRating) closeRating.addEventListener('click', () => closeModal(document.getElementById('modalRating')));

  // Album rating
  const ar = document.getElementById('albumRatingForm');
  if (ar) ar.addEventListener('submit', (e) => { e.preventDefault(); saveAlbumRating(); });

  const closeAR = document.querySelector('.close-album-rating');
  if (closeAR) closeAR.addEventListener('click', () => closeModal(document.getElementById('modalAlbumRating')));

  // Comments
  const ac = document.getElementById('addCommentBtn');
  if (ac) ac.addEventListener('click', addComment);

  const closeComm = document.querySelector('.close-comment');
  if (closeComm) closeComm.addEventListener('click', () => closeModal(document.getElementById('modalComment')));

  // Edit track
  const ef = document.getElementById('editSongForm');
  if (ef) ef.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser?.isAdmin) return;
    const id = document.getElementById('editSongId')?.value;
    const songs = await dbGetAll(STORE_SONGS);
    const song = songs.find(s => s.id === id);
    if (!song) return;
    song.title = document.getElementById('editSongTitle')?.value.trim() || song.title;
    song.artist = document.getElementById('editSongArtist')?.value.trim() || song.artist;
    song.album = document.getElementById('editSongAlbum')?.value.trim() || '';
    song.audioUrl = document.getElementById('editSongAudioUrl')?.value.trim() || null;
    song.coverUrl = document.getElementById('editSongCoverUrl')?.value.trim() || null;
    await dbPut(STORE_SONGS, song);
    closeModal(document.getElementById('modalEdit'));
    refreshAll();
    onDataChanged();
  });

  const closeEdit = document.querySelector('.close-edit');
  if (closeEdit) closeEdit.addEventListener('click', () => closeModal(document.getElementById('modalEdit')));

  // Modal overlay click
  window.addEventListener('click', (e) => {
    document.querySelectorAll('.modal').forEach(m => { if (e.target === m) closeModal(m); });
  });

  // Keyboard
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === ' ') { e.preventDefault(); togglePlay(); }
    if (e.key === 'ArrowLeft') audioPlayer.currentTime -= 5;
    if (e.key === 'ArrowRight') audioPlayer.currentTime += 5;
    if (e.key === 'Escape') document.querySelectorAll('.modal.active').forEach(m => closeModal(m));
  });

  // Context menu
  document.addEventListener('contextmenu', (e) => {
    const card = e.target.closest('.card');
    if (card) {
      e.preventDefault();
      contextMenuSongId = card.dataset.id;
      const cm = document.getElementById('contextMenu');
      if (cm) { cm.style.left = e.pageX + 'px'; cm.style.top = e.pageY + 'px'; cm.style.display = 'block'; }
    }
  });

  document.addEventListener('click', () => {
    const cm = document.getElementById('contextMenu');
    if (cm) cm.style.display = 'none';
  });

  // Context menu items
  document.querySelectorAll('.context-menu-item').forEach(item => {
    item.addEventListener('click', () => {
      const action = item.dataset.action;
      if (!contextMenuSongId) return;
      if (action === 'play') playSong(contextMenuSongId);
      if (action === 'rate') openRatingModal(contextMenuSongId);
      if (action === 'comment') openCommentModal(contextMenuSongId);
      if (action === 'favorite') { toggleFavorite(contextMenuSongId); showNotification(getFavorites().includes(contextMenuSongId) ? 'В избранном' : 'Удалено из избранного'); }
      if (action === 'edit' && currentUser?.isAdmin) openEditModal(contextMenuSongId);
      if (action === 'delete' && currentUser?.isAdmin) {
        if (confirm('Удалить трек?')) dbDelete(STORE_SONGS, contextMenuSongId).then(() => { refreshAll(); syncWithGitHub(); });
      }
      const cm = document.getElementById('contextMenu');
      if (cm) cm.style.display = 'none';
    });
  });
}

// --- Auth form ---
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('authForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const u = document.getElementById('authUsername')?.value.trim();
      const p = document.getElementById('authPassword')?.value;
      if (!u || !p) return;
      if (u.toLowerCase() === 'letluvv') { alert('Для Letluvv вход через Telegram!'); return; }
      try {
        currentUser = authMode === 'login' ? await handleLogin(u, p) : await handleRegister(u, p);
        showApp();
        navigate('home');
      } catch (err) { alert(err.message); }
    });
  }

  const toggle = document.getElementById('toggleAuthMode');
  if (toggle) {
    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      authMode = authMode === 'login' ? 'register' : 'login';
      const t = document.getElementById('authTitle');
      if (t) t.textContent = authMode === 'login' ? 'Вход' : 'Регистрация';
      toggle.textContent = authMode === 'login' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти';
    });
  }
});

// --- GitHub Sync ---
function setSyncing(state) {
  isSyncing = state;
  const dot = document.getElementById('syncingDot');
  if (dot) dot.classList.toggle('active', state);
}

async function syncWithGitHub(force = false) {
  if (isSyncing) return;
  if (!githubToken) { if (force) showNotification('Укажите токен в настройках', true); return; }
  setSyncing(true);
  const pb = document.getElementById('syncProgressContainer');
  const pf = document.getElementById('syncProgressFill');
  if (pb) pb.style.display = 'flex';
  if (pf) pf.style.width = '10%';
  try {
    const remote = await downloadMetadataFromGitHub();
    if (pf) pf.style.width = '40%';
    if (remote) await mergeRemoteMetadata(remote);
    if (pf) pf.style.width = '70%';
    await uploadMetadataToGitHub();
    if (pf) pf.style.width = '100%';
    if (force) showNotification('Синхронизация завершена');
  } catch (err) {
    console.error('Sync failed:', err);
    if (force) showNotification('Ошибка: ' + err.message);
  } finally {
    setTimeout(() => { if (pb) pb.style.display = 'none'; }, 500);
    setSyncing(false);
    refreshAll();
  }
}

async function downloadMetadataFromGitHub() {
  const res = await fetch(`https://api.github.com/repos/${githubUser}/${githubRepo}/contents/bpt-data.json`, {
    headers: { 'Authorization': `token ${githubToken}`, 'Accept': 'application/vnd.github.v3+json' }
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Ошибка: ${res.status}`);
  const data = await res.json();
  const bin = atob(data.content);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return JSON.parse(new TextDecoder('utf-8').decode(bytes));
}

async function uploadMetadataToGitHub() {
  const [songs, albums, users] = await Promise.all([dbGetAll(STORE_SONGS), dbGetAll(STORE_ALBUMS), dbGetAll(STORE_USERS)]);
  const tombstones = JSON.parse(localStorage.getItem('bpt_tombstones') || '{}');
  const meta = {
    version: 3,
    songs: songs.map(s => ({ id: s.id, title: s.title, artist: s.artist, album: s.album, date: s.date, ratings: s.ratings, comments: s.comments, audioUrl: s.audioUrl, coverUrl: s.coverUrl, updatedAt: s.updatedAt || 0 })),
    albums: albums.map(a => ({ ...a, updatedAt: a.updatedAt || 0 })),
    users: users.map(u => ({ ...u, favorites: JSON.parse(localStorage.getItem(`bpt_favorites_${u.id}`) || '[]') })),
    tombstones,
    lastModified: Date.now()
  };
  const json = JSON.stringify(meta, null, 2);
  const b64 = btoa(new TextEncoder().encode(json).reduce((s, b) => s + String.fromCharCode(b), ''));
  let sha = null;
  try { const r = await fetch(`https://api.github.com/repos/${githubUser}/${githubRepo}/contents/bpt-data.json`, { headers: { 'Authorization': `token ${githubToken}` } }); if (r.ok) sha = (await r.json()).sha; } catch (e) {}
  const body = { message: `Sync ${new Date().toISOString()}`, content: b64, branch: 'main' };
  if (sha) body.sha = sha;
  const res = await fetch(`https://api.github.com/repos/${githubUser}/${githubRepo}/contents/bpt-data.json`, {
    method: 'PUT',
    headers: { 'Authorization': `token ${githubToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`Ошибка: ${res.status}`);
}

async function mergeRemoteMetadata(remote) {
  const [localSongs, localAlbums] = await Promise.all([dbGetAll(STORE_SONGS), dbGetAll(STORE_ALBUMS)]);
  const lt = JSON.parse(localStorage.getItem('bpt_tombstones') || '{}');
  const rt = remote.tombstones || {};
  ['songs', 'albums'].forEach(store => {
    if (!lt[store]) lt[store] = [];
    (rt[store] || []).forEach(t => { if (!lt[store].find(l => l.id === t.id)) lt[store].push(t); });
  });
  localStorage.setItem('bpt_tombstones', JSON.stringify(lt));

  const mergeR = (a = [], b = []) => {
    const m = new Map();
    [...a, ...b].forEach(r => { if (!r?.userId) return; const e = m.get(r.userId); if (!e || !e.date || !r.date || new Date(r.date) > new Date(e.date)) m.set(r.userId, r); });
    return Array.from(m.values());
  };

  for (const rs of remote.songs || []) {
    const del = lt.songs?.find(t => t.id === rs.id);
    if (del) { if (!rs.updatedAt || del.timestamp >= rs.updatedAt) { await dbDelete(STORE_SONGS, rs.id, true); continue; } else { lt.songs = lt.songs.filter(t => t.id !== rs.id); localStorage.setItem('bpt_tombstones', JSON.stringify(lt)); } }
    const loc = localSongs.find(s => s.id === rs.id);
    if (loc) {
      let ch = false;
      if ((rs.updatedAt || 0) > (loc.updatedAt || 0)) { Object.assign(loc, { title: rs.title, artist: rs.artist, album: rs.album, audioUrl: rs.audioUrl, coverUrl: rs.coverUrl, date: rs.date, updatedAt: rs.updatedAt }); ch = true; }
      const mr = mergeR(loc.ratings, rs.ratings);
      if (JSON.stringify(loc.ratings) !== JSON.stringify(mr)) { loc.ratings = mr; ch = true; }
      (rs.comments || []).forEach(rc => { if (!loc.comments?.find(c => c.userId === rc.userId && c.text === rc.text && c.date === rc.date)) { if (!loc.comments) loc.comments = []; loc.comments.push(rc); ch = true; } });
      if (ch) await dbPut(STORE_SONGS, loc, true);
    } else {
      await dbAdd(STORE_SONGS, { ...rs, audioBlob: null, coverBlob: null }, true);
    }
  }

  if (remote.users) {
    for (const ru of remote.users) {
      const loc = await getUserByUsername(ru.username);
      if (!loc) { await dbAdd(STORE_USERS, ru, true); if (ru.favorites) localStorage.setItem(`bpt_favorites_${ru.id}`, JSON.stringify(ru.favorites)); }
      else { const mf = [...new Set([...JSON.parse(localStorage.getItem(`bpt_favorites_${loc.id}`) || '[]'), ...(ru.favorites || [])])]; localStorage.setItem(`bpt_favorites_${loc.id}`, JSON.stringify(mf)); }
    }
  }

  for (const ra of remote.albums || []) {
    const del = lt.albums?.find(t => t.id === ra.name);
    if (del) { if (!ra.updatedAt || del.timestamp >= ra.updatedAt) { await dbDelete(STORE_ALBUMS, ra.name, true); continue; } else { lt.albums = lt.albums.filter(t => t.id !== ra.name); localStorage.setItem('bpt_tombstones', JSON.stringify(lt)); } }
    const loc = localAlbums.find(a => a.name === ra.name);
    if (!loc) { await dbPut(STORE_ALBUMS, ra, true); }
    else {
      let ch = false;
      if ((ra.updatedAt || 0) > (loc.updatedAt || 0)) { loc.trackOrder = ra.trackOrder || []; loc.date = ra.date || ''; loc.updatedAt = ra.updatedAt; ch = true; }
      const mr = mergeR(loc.ratings, ra.ratings);
      if (JSON.stringify(loc.ratings) !== JSON.stringify(mr)) { loc.ratings = mr; ch = true; }
      if (ch) await dbPut(STORE_ALBUMS, loc, true);
    }
  }
}

function onDataChanged() {
  if (githubUser && githubRepo && githubToken) { clearTimeout(syncTimeout); syncTimeout = setTimeout(() => syncWithGitHub(), 5000); }
}

// --- Edit modal ---
async function openEditModal(songId) {
  if (!currentUser?.isAdmin) return;
  const songs = await dbGetAll(STORE_SONGS);
  const song = songs.find(s => s.id === songId);
  if (!song) return;
  const f = id => document.getElementById(id);
  if (f('editSongId')) f('editSongId').value = song.id;
  if (f('editSongTitle')) f('editSongTitle').value = song.title || '';
  if (f('editSongArtist')) f('editSongArtist').value = song.artist || '';
  if (f('editSongAlbum')) f('editSongAlbum').value = song.album || '';
  if (f('editSongAudioUrl')) f('editSongAudioUrl').value = song.audioUrl || '';
  if (f('editSongCoverUrl')) f('editSongCoverUrl').value = song.coverUrl || '';
  const m = document.getElementById('modalEdit');
  if (m) m.classList.add('active');
}

// --- Album view ---
async function openAlbumView(albumName) {
  const songs = await dbGetAll(STORE_SONGS);
  const tracks = songs.filter(s => s.album === albumName);
  if (!tracks.length) return;
  const ad = await dbGet(STORE_ALBUMS, albumName) || { name: albumName, ratings: [], trackOrder: [], date: '' };
  const order = ad.trackOrder || tracks.map(t => t.id);
  const ordered = order.map(id => tracks.find(t => t.id === id)).filter(Boolean);
  tracks.forEach(t => { if (!ordered.includes(t)) ordered.push(t); });

  const isAdmin = currentUser?.isAdmin;
  const titleEl = document.getElementById('albumViewTitle');
  if (titleEl) titleEl.textContent = `💿 ${albumName}`;
  const container = document.getElementById('albumViewTracks');
  if (!container) return;

  container.innerHTML = ordered.map((song, i) => {
    const coverUrl = song.coverUrl || (song.coverBlob ? URL.createObjectURL(song.coverBlob) : '');
    const avg = getAverageRating(song);
    return `
      <div class="card draggable-song" draggable="${isAdmin}" data-id="${song.id}">
        ${isAdmin ? '<span class="drag-handle">≡</span>' : ''}
        <div class="card-top">
          ${coverUrl ? `<img class="card-cover" src="${coverUrl}" alt="">` : '<div class="card-cover"></div>'}
          <div class="card-info">
            <div class="card-title"><span class="track-num">${i + 1}.</span>${escapeHtml(song.title)}</div>
            <div class="card-artist">${escapeHtml(song.artist)}</div>
          </div>
        </div>
        <div class="card-actions">
          <button class="play-btn" data-id="${song.id}" onclick="playSong('${song.id}')">▶</button>
          ${avg !== null ? `<span style="color:var(--text-dim);font-size:0.8rem;">${avg} ★</span>` : ''}
        </div>
      </div>`;
  }).join('');

  const delBtn = document.getElementById('deleteAlbumBtn');
  if (delBtn) delBtn.style.display = isAdmin ? 'inline-block' : 'none';

  const rateBtn = document.getElementById('rateAlbumBtn');
  if (rateBtn) rateBtn.onclick = () => { closeModal(document.getElementById('modalAlbumView')); openAlbumRatingModal(albumName); };

  const closeBtn = document.querySelector('.close-album-view');
  if (closeBtn) closeBtn.onclick = () => closeModal(document.getElementById('modalAlbumView'));

  const modal = document.getElementById('modalAlbumView');
  if (modal) modal.classList.add('active');
}

// --- Bootstrap ---
openDB().then(() => initAdmin()).then(async () => {
  const savedId = getSavedUserId();
  if (savedId) {
    const user = await dbGet(STORE_USERS, savedId);
    if (user) {
      currentUser = user;
      showApp();
      initEventListeners();
      navigate('home');
      if (githubToken) setTimeout(() => syncWithGitHub(), 1000);
      return;
    } else { clearSession(); }
  }
  showAuthScreen();
}).catch(err => { console.error(err); alert('Ошибка БД'); });
