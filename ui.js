// ========== UI RENDERING ==========
let currentView = 'songs';
let currentSort = 'date';
let currentSearch = '';
let contextMenuSongId = null;

// --- Track detail modal (new unified approach) ---
function openTrackModal(songId) {
  dbGetAll(STORE_SONGS).then(songs => {
    const song = songs.find(s => s.id === songId);
    if (!song) return;

    // Fill track info
    const coverUrl = song.coverUrl || (song.coverBlob ? URL.createObjectURL(song.coverBlob) : '');
    const imgEl = document.getElementById('trackModalCover');
    const titleEl = document.getElementById('trackModalTitle');
    const artistEl = document.getElementById('trackModalArtist');
    const albumEl = document.getElementById('trackModalAlbum');
    const dateEl = document.getElementById('trackModalDate');
    const playsEl = document.getElementById('trackModalPlays');
    const avgEl = document.getElementById('trackModalAvg');

    if (imgEl) { imgEl.src = coverUrl; imgEl.style.display = coverUrl ? 'block' : 'none'; }
    if (titleEl) titleEl.textContent = song.title;
    if (artistEl) artistEl.textContent = song.artist;
    if (albumEl) albumEl.textContent = song.album || '—';
    if (dateEl) dateEl.textContent = song.date || '—';
    if (playsEl) playsEl.textContent = song.plays || 0;
    if (avgEl) {
      const avg = getAverageRating(song);
      avgEl.textContent = avg !== null ? `${avg} ★ (${song.ratings?.length || 0})` : 'Нет оценок';
    }

    // Draw radar for user's rating
    const myRating = song.ratings?.find(r => r.userId === currentUser?.id);
    const scores = myRating?.scores || CRITERIA.map(() => 0);
    setTimeout(() => drawRadarChart('trackModalRadar', scores, 180), 50);

    // Comments count
    const cc = document.getElementById('trackModalCommentCount');
    if (cc) cc.textContent = song.comments?.length || 0;

    // Favorite button
    const favBtn = document.getElementById('trackModalFavBtn');
    if (favBtn) {
      const isFav = getFavorites().includes(songId);
      favBtn.classList.toggle('is-favorite', isFav);
      favBtn.onclick = () => { toggleFavorite(songId); openTrackModal(songId); };
    }

    // Play button
    const playBtn = document.getElementById('trackModalPlayBtn');
    if (playBtn) playBtn.onclick = () => playSong(songId);

    // Rate button
    const rateBtn = document.getElementById('trackModalRateBtn');
    if (rateBtn) rateBtn.onclick = () => { closeModal(document.getElementById('modalTrack')); openRatingModal(songId); };

    // Comments button
    const commBtn = document.getElementById('trackModalCommentsBtn');
    if (commBtn) commBtn.onclick = () => { closeModal(document.getElementById('modalTrack')); openCommentModal(songId); };

    // Show modal
    const modal = document.getElementById('modalTrack');
    if (modal) modal.classList.add('active');
  });
}

// --- Render track grid (main page) ---
function renderFeed(songs) {
  const feed = document.getElementById('feed');
  if (!feed) return;

  if (!songs?.length) {
    feed.innerHTML = '<div class="empty-state">Треки не найдены</div>';
    return;
  }

  feed.className = 'grid-container';
  feed.innerHTML = songs.map(song => {
    const coverUrl = song.coverUrl || (song.coverBlob ? URL.createObjectURL(song.coverBlob) : '');
    const avg = getAverageRating(song);
    const isFav = getFavorites().includes(song.id);
    return `
      <div class="card" data-id="${song.id}" onclick="openTrackModal('${song.id}')">
        <div class="card-cover-wrap">
          ${coverUrl ? `<img class="card-cover" src="${coverUrl}" alt="">` : '<div class="card-cover card-cover-placeholder"></div>'}
          <button class="card-play-btn" onclick="event.stopPropagation(); playSong('${song.id}')" title="Воспроизвести">▶</button>
        </div>
        <div class="card-info">
          <div class="card-title">${escapeHtml(song.title)}</div>
          <div class="card-artist">${escapeHtml(song.artist)}</div>
        </div>
        <div class="card-bottom">
          ${avg !== null ? `<span class="card-avg">${avg} ★</span>` : '<span class="card-avg card-avg-empty">—</span>'}
          <button class="card-fav-btn ${isFav ? 'is-favorite' : ''}" onclick="event.stopPropagation(); toggleFavorite('${song.id}'); refreshAll();" title="Избранное">♥</button>
        </div>
      </div>`;
  }).join('');
}

// --- Render albums ---
async function renderAlbums() {
  const [songs, albums] = await Promise.all([dbGetAll(STORE_SONGS), dbGetAll(STORE_ALBUMS)]);
  const groups = new Map();
  songs.forEach(s => {
    if (!s.album) return;
    if (!groups.has(s.album)) groups.set(s.album, []);
    groups.get(s.album).push(s);
  });

  const container = document.getElementById('album-grid') || document.getElementById('content');
  if (!container) return;
  container.className = 'album-grid';

  if (!groups.size) {
    container.innerHTML = '<div class="empty-state">Альбомы не найдены</div>';
    return;
  }

  container.innerHTML = Array.from(groups.keys()).map(name => {
    const tracks = groups.get(name);
    const first = tracks[0];
    const coverUrl = first.coverUrl || (first.coverBlob ? URL.createObjectURL(first.coverBlob) : '');
    const ad = albums.find(a => a.name === name);
    const score = ad?.ratings?.length ? Math.round(ad.ratings.reduce((s, r) => s + r.total, 0) / ad.ratings.length) : null;
    return `
      <div class="album-card" onclick="openAlbumView('${escapeHtml(name)}')">
        ${coverUrl ? `<img class="album-cover" src="${coverUrl}" alt="">` : '<div class="album-cover album-cover-placeholder"></div>'}
        <div class="album-info">
          <div class="album-title">${escapeHtml(name)}</div>
          <div class="album-artist">${escapeHtml(first.artist)}</div>
          <div class="album-meta">${tracks.length} треков${score !== null ? ` · ${score} ★` : ''}</div>
        </div>
      </div>`;
  }).join('');
}

// --- Comments ---
function openCommentModal(songId) {
  dbGetAll(STORE_SONGS).then(songs => {
    const song = songs.find(s => s.id === songId);
    if (!song) return;
    currentCommentSongId = songId;
    const info = document.getElementById('commentSongInfo');
    if (info) info.textContent = `${song.artist} — ${song.title}`;
    renderCommentsList(song.comments || []);
    const modal = document.getElementById('modalComment');
    if (modal) modal.classList.add('active');
  });
}

function renderCommentsList(comments) {
  const c = document.getElementById('commentsContainer');
  if (!c) return;
  if (!comments.length) { c.innerHTML = '<div class="empty-state-small">Пока нет комментариев</div>'; return; }
  c.innerHTML = comments.map((cm, idx) => `
    <div class="comment-item">
      ${cm.userId === currentUser?.id ? `<button class="comment-del" data-index="${idx}">✕</button>` : ''}
      <div class="comment-author">${escapeHtml(cm.username)}</div>
      <div class="comment-text">${escapeHtml(cm.text)}</div>
      <div class="comment-date">${cm.date || ''}</div>
    </div>`).join('');
  c.querySelectorAll('.comment-del').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const i = parseInt(e.target.dataset.index);
      const songs = await dbGetAll(STORE_SONGS);
      const song = songs.find(s => s.id === currentCommentSongId);
      if (!song?.comments) return;
      song.comments.splice(i, 1);
      await dbPut(STORE_SONGS, song);
      renderCommentsList(song.comments);
      onDataChanged();
    });
  });
}

async function addComment() {
  if (!currentCommentSongId) return;
  const text = document.getElementById('commentText')?.value.trim();
  if (!text) return;
  const songs = await dbGetAll(STORE_SONGS);
  const song = songs.find(s => s.id === currentCommentSongId);
  if (!song) return;
  if (!song.comments) song.comments = [];
  song.comments.push({ userId: currentUser.id, username: currentUser.username, text, date: new Date().toLocaleString('ru-RU') });
  await dbPut(STORE_SONGS, song);
  openCommentModal(currentCommentSongId);
  onDataChanged();
}

// --- Favorites ---
function getFavorites() {
  if (!currentUser) return [];
  return JSON.parse(localStorage.getItem(`bpt_favorites_${currentUser.id}`) || '[]');
}

function toggleFavorite(songId) {
  if (!currentUser) return;
  const key = `bpt_favorites_${currentUser.id}`;
  const favs = JSON.parse(localStorage.getItem(key) || '[]');
  const idx = favs.indexOf(songId);
  if (idx >= 0) favs.splice(idx, 1); else favs.push(songId);
  localStorage.setItem(key, JSON.stringify(favs));
  refreshAll();
  if (githubToken) { clearTimeout(syncTimeout); syncTimeout = setTimeout(() => syncWithGitHub(), 3000); }
}

// --- Sorting & filtering ---
function getFilteredAndSortedSongs(songs) {
  if (!songs?.length) return [];
  let f = [...songs];
  if (currentSearch?.trim()) {
    const q = currentSearch.toLowerCase().trim();
    f = f.filter(s => (s.title?.toLowerCase().includes(q)) || (s.artist?.toLowerCase().includes(q)) || (s.album?.toLowerCase().includes(q)));
  }
  if (currentSort === 'date') f.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  else if (currentSort === 'name') f.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  else if (currentSort === 'rating') f.sort((a, b) => (getAverageRating(b) || 0) - (getAverageRating(a) || 0));
  else if (currentSort === 'favorites') f = f.filter(s => getFavorites().includes(s.id));
  return f;
}

function setSort(sort) {
  currentSort = sort;
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`sort${sort.charAt(0).toUpperCase() + sort.slice(1)}Btn`);
  if (btn) btn.classList.add('active');
  refreshAll();
}

// --- View switching ---
function showSongsView() {
  currentView = 'songs';
  const sb = document.getElementById('searchSortBar');
  if (sb) sb.style.display = 'flex';
  dbGetAll(STORE_SONGS).then(songs => renderFeed(getFilteredAndSortedSongs(songs)));
}

function showAlbumsView() {
  currentView = 'albums';
  const sb = document.getElementById('searchSortBar');
  if (sb) sb.style.display = 'none';
  renderAlbums();
}

// --- Refresh ---
function refreshAll() {
  if (currentView === 'songs') {
    dbGetAll(STORE_SONGS).then(songs => renderFeed(getFilteredAndSortedSongs(songs)));
  } else {
    renderAlbums();
  }
}

// --- Modal helpers ---
function closeModal(modal) {
  if (!modal || !modal.classList.contains('active')) return;
  modal.classList.add('closing');
  setTimeout(() => { modal.classList.remove('active'); modal.classList.remove('closing'); }, 300);
}

// --- Notifications ---
function showNotification(msg) {
  const n = document.createElement('div');
  n.className = 'notification';
  n.textContent = msg;
  document.body.appendChild(n);
  setTimeout(() => n.classList.add('show'), 10);
  setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 300); }, 2000);
}

// --- Loading ---
function showLoading(text = 'Загрузка...') {
  const o = document.getElementById('loadingOverlay');
  const t = document.getElementById('loadingText');
  if (t) t.textContent = text;
  if (o) o.classList.add('active');
}

function hideLoading() {
  const o = document.getElementById('loadingOverlay');
  if (o) o.classList.remove('active');
}
