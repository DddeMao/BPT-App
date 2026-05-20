// ========== PLAYER ==========
const audioPlayer = document.getElementById('audioPlayer');
let currentSongId = null;

function playSong(id) {
  currentSongId = id;
  dbGetAll(STORE_SONGS).then(songs => {
    const song = songs.find(s => s.id === id);
    if (!song) return;
    if (song.audioUrl) audioPlayer.src = song.audioUrl;
    else if (song.audioBlob) audioPlayer.src = URL.createObjectURL(song.audioBlob);
    else { alert('Нет аудио'); return; }

    const mt = document.getElementById('miniTitle');
    const ma = document.getElementById('miniArtist');
    const mc = document.getElementById('miniCover');
    const fp = document.getElementById('floatingPlayer');
    if (mt) mt.textContent = song.title;
    if (ma) ma.textContent = song.artist;
    if (mc) {
      mc.src = song.coverUrl || (song.coverBlob ? URL.createObjectURL(song.coverBlob) : '');
      mc.style.display = mc.src ? 'block' : 'none';
    }
    if (fp) fp.style.display = 'flex';
    audioPlayer.play().catch(() => {});
  });
}

function togglePlay() {
  if (audioPlayer.paused) audioPlayer.play().catch(() => {});
  else audioPlayer.pause();
}

// Player events
audioPlayer.addEventListener('play', () => {
  const btn = document.getElementById('playPauseBtn');
  const mc = document.getElementById('miniCover');
  if (btn) btn.textContent = '⏸';
  if (mc) mc.classList.add('spinning');
});

audioPlayer.addEventListener('pause', () => {
  const btn = document.getElementById('playPauseBtn');
  const mc = document.getElementById('miniCover');
  if (btn) btn.textContent = '▶';
  if (mc) mc.classList.remove('spinning');
});

audioPlayer.addEventListener('ended', () => {
  const btn = document.getElementById('playPauseBtn');
  const mt = document.getElementById('miniTitle');
  const ma = document.getElementById('miniArtist');
  const mc = document.getElementById('miniCover');
  if (btn) btn.textContent = '▶';
  if (mt) mt.textContent = 'Ничего не играет';
  if (ma) ma.textContent = '';
  if (mc) { mc.classList.remove('spinning'); mc.style.display = 'none'; }
});
