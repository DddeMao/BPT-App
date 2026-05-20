// ========== RATINGS & RADAR CHARTS ==========
const CRITERIA = ['Текст/Рифмы', 'Флоу/Ритмика', 'Стиль', 'Харизма', 'Вайб'];
const EXT_CRITERIA = ['Сведение', 'Мастеринг', 'Бит'];
const MAX_SCORE = 12;

let currentRatingSongId = null;
let currentAlbumRatingName = null;

// --- Helpers ---
function getScoreColor(score) {
  const r = score / MAX_SCORE;
  const c1 = [30, 30, 45], c2 = [0, 240, 255], c3 = [255, 0, 170];
  let rgb;
  if (r <= 0.5) { const t = r * 2; rgb = c1.map((v, i) => Math.round(v + (c2[i] - v) * t)); }
  else { const t = (r - 0.5) * 2; rgb = c2.map((v, i) => Math.round(v + (c3[i] - v) * t)); }
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

// --- Radar Chart (Canvas) ---
function drawRadarChart(canvasId, scores, size) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const cx = size / 2, cy = size / 2, r = size * 0.35;
  const n = scores.length;
  const angleStep = (Math.PI * 2) / n;

  ctx.clearRect(0, 0, size, size);

  // Background web
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (let level = 1; level <= 4; level++) {
    ctx.beginPath();
    const lr = r * level / 4;
    for (let i = 0; i <= n; i++) {
      const a = i * angleStep - Math.PI / 2;
      const x = cx + Math.cos(a) * lr, y = cy + Math.sin(a) * lr;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Axes
  for (let i = 0; i < n; i++) {
    const a = i * angleStep - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.stroke();
  }

  // Data polygon
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const idx = i % n;
    const val = (scores[idx] || 0) / MAX_SCORE;
    const a = idx * angleStep - Math.PI / 2;
    const x = cx + Math.cos(a) * r * val, y = cy + Math.sin(a) * r * val;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(0,240,255,0.15)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,240,255,0.8)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Dots
  for (let i = 0; i < n; i++) {
    const val = (scores[i] || 0) / MAX_SCORE;
    const a = i * angleStep - Math.PI / 2;
    const x = cx + Math.cos(a) * r * val, y = cy + Math.sin(a) * r * val;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = getScoreColor(scores[i] || 0);
    ctx.fill();
  }

  // Labels
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = `${Math.max(9, size * 0.055)}px Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < n; i++) {
    const a = i * angleStep - Math.PI / 2;
    const labelR = r + size * 0.08;
    const x = cx + Math.cos(a) * labelR, y = cy + Math.sin(a) * labelR;
    ctx.fillText(CRITERIA[i].split('/')[0], x, y);
  }
}

// --- Sliders ---
function buildSliders(containerId, values, onChange) {
  const c = document.getElementById(containerId);
  if (!c) return;
  c.innerHTML = CRITERIA.map((name, i) => {
    const val = values ? values[i] : 0;
    return `<div class="range-group">
      <label><span>${name}</span><span class="range-val" id="${containerId}Val${i}">${val}</span></label>
      <input type="range" id="${containerId}Range${i}" min="0" max="${MAX_SCORE}" value="${val}" step="1">
    </div>`;
  }).join('');
  CRITERIA.forEach((_, i) => {
    const s = document.getElementById(`${containerId}Range${i}`);
    const v = document.getElementById(`${containerId}Val${i}`);
    if (s) s.addEventListener('input', () => { if (v) v.textContent = s.value; onChange(); });
  });
  onChange();
}

// --- Open rating modal ---
function openRatingModal(songId) {
  dbGetAll(STORE_SONGS).then(songs => {
    const song = songs.find(s => s.id === songId);
    if (!song) return;
    currentRatingSongId = songId;

    const coverUrl = song.coverUrl || (song.coverBlob ? URL.createObjectURL(song.coverBlob) : '');
    const hdr = document.getElementById('ratingHeader');
    if (hdr) hdr.innerHTML = `
      ${coverUrl ? `<img class="rating-cover" src="${coverUrl}" alt="">` : ''}
      <div><strong>${escapeHtml(song.artist)}</strong><br>${escapeHtml(song.title)}</div>`;

    const myRating = song.ratings?.find(r => r.userId === currentUser?.id);
    buildSliders('ratingSliders', myRating?.scores, () => {
      let sum = 0;
      for (let i = 0; i < CRITERIA.length; i++) {
        const s = document.getElementById(`ratingSlidersRange${i}`);
        if (s) sum += parseInt(s.value, 10);
      }
      const lt = document.getElementById('liveTotal');
      if (lt) lt.textContent = sum;
      const scores = CRITERIA.map((_, i) => {
        const s = document.getElementById(`ratingSlidersRange${i}`);
        return s ? parseInt(s.value, 10) : 0;
      });
      setTimeout(() => drawRadarChart('ratingRadar', scores, 200), 0);
    });

    const initScores = myRating?.scores || CRITERIA.map(() => 0);
    setTimeout(() => drawRadarChart('ratingRadar', initScores, 200), 0);

    const others = song.ratings?.filter(r => r.userId !== currentUser?.id) || [];
    const oc = document.getElementById('otherRatings');
    if (oc) {
      if (others.length === 0) {
        oc.innerHTML = '<div style="color:var(--text-muted);">Нет оценок</div>';
      } else {
        oc.innerHTML = others.map(r => {
          const initials = r.username.substring(0, 2).toUpperCase();
          return `<div class="other-rating-item">
            <div class="other-rating-avatar">${escapeHtml(initials)}</div>
            <div class="other-rating-info">
              <strong>${escapeHtml(r.username)}</strong>
              <span class="other-rating-total">${r.total} ★</span>
            </div>
            <canvas class="other-rating-radar" id="radar_${r.userId}" width="60" height="60"></canvas>
          </div>`;
        }).join('');
        others.forEach(r => {
          setTimeout(() => drawRadarChart(`radar_${r.userId}`, r.scores, 60), 0);
        });
      }
    }

    const modal = document.getElementById('modalRating');
    if (modal) modal.classList.add('active');
  });
}

// --- Save rating ---
async function saveSongRating() {
  if (!currentRatingSongId) return;
  const scores = CRITERIA.map((_, i) => {
    const s = document.getElementById(`ratingSlidersRange${i}`);
    return s ? parseInt(s.value, 10) : 0;
  });
  const total = scores.reduce((a, b) => a + b, 0);
  const songs = await dbGetAll(STORE_SONGS);
  const song = songs.find(s => s.id === currentRatingSongId);
  if (!song) return;
  if (!song.ratings) song.ratings = [];
  const idx = song.ratings.findIndex(r => r.userId === currentUser?.id);
  const obj = { userId: currentUser.id, username: currentUser.username, scores, total, date: new Date().toISOString() };
  if (idx >= 0) song.ratings[idx] = obj;
  else song.ratings.push(obj);
  await dbPut(STORE_SONGS, song);
  closeModal(document.getElementById('modalRating'));
  refreshAll();
  onDataChanged();
}

// --- Album rating ---
function openAlbumRatingModal(albumName) {
  currentAlbumRatingName = albumName;
  dbGet(STORE_ALBUMS, albumName).then(album => {
    const info = document.getElementById('albumRatingInfo');
    if (info) info.textContent = `Альбом: ${albumName}`;
    const myRating = album?.ratings?.find(r => r.userId === currentUser?.id);
    buildSliders('albumRatingSliders', myRating?.scores, () => {
      let sum = 0;
      for (let i = 0; i < CRITERIA.length; i++) {
        const s = document.getElementById(`albumRatingSlidersRange${i}`);
        if (s) sum += parseInt(s.value, 10);
      }
      const lt = document.getElementById('albumLiveTotal');
      if (lt) lt.textContent = sum;
    });
    const others = album?.ratings?.filter(r => r.userId !== currentUser?.id) || [];
    const oc = document.getElementById('otherAlbumRatings');
    if (oc) {
      oc.innerHTML = others.length === 0
        ? '<div style="color:var(--text-muted);">Нет оценок</div>'
        : others.map(r => `<div><strong>${escapeHtml(r.username)}</strong>: ${r.total} ★</div>`).join('');
    }
    const modal = document.getElementById('modalAlbumRating');
    if (modal) modal.classList.add('active');
  });
}

async function saveAlbumRating() {
  if (!currentAlbumRatingName) return;
  const scores = CRITERIA.map((_, i) => {
    const s = document.getElementById(`albumRatingSlidersRange${i}`);
    return s ? parseInt(s.value, 10) : 0;
  });
  const total = scores.reduce((a, b) => a + b, 0);
  const album = await dbGet(STORE_ALBUMS, currentAlbumRatingName) || { name: currentAlbumRatingName, ratings: [], trackOrder: [] };
  if (!album.ratings) album.ratings = [];
  const idx = album.ratings.findIndex(r => r.userId === currentUser?.id);
  const obj = { userId: currentUser.id, username: currentUser.username, scores, total, date: new Date().toISOString() };
  if (idx >= 0) album.ratings[idx] = obj;
  else album.ratings.push(obj);
  await dbPut(STORE_ALBUMS, album);
  closeModal(document.getElementById('modalAlbumRating'));
  refreshAll();
  onDataChanged();
}
