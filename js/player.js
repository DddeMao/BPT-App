/**
 * Аудиоплеер + визуализатор
 */
const Player = {
  audio: null,
  cover: null,
  title: null,
  artist: null,
  bar: null,

  init() {
    this.audio = document.getElementById('audioPlayer');
    this.cover = document.getElementById('playerCover');
    this.title = document.getElementById('playerTitle');
    this.artist = document.getElementById('playerArtist');
    this.bar = document.getElementById('player');

    // Инициализация визуализатора
    Visualizer.init();

    this.audio.addEventListener('play', () => {
      setTimeout(() => { if (!this.audio.paused) this.cover.classList.add('playing'); }, 50);
      Visualizer.connect();
    });
    this.audio.addEventListener('pause', () => {
      this.cover.style.animation = 'none';
      this.cover.offsetHeight;
      this.cover.style.animation = '';
      this.cover.classList.remove('playing');
      Visualizer.stop();
    });
    this.audio.addEventListener('ended', () => {
      this.cover.classList.remove('playing');
      Visualizer.stop();
    });

    // Кнопка переключения режима визуализации
    const modeBtn = document.getElementById('visualizerModeBtn');
    if (modeBtn) {
      modeBtn.addEventListener('click', () => {
        const modes = ['bars', 'waves', 'circle'];
        const currentIdx = modes.indexOf(Visualizer.mode);
        const nextMode = modes[(currentIdx + 1) % modes.length];
        Visualizer.setMode(nextMode);
        modeBtn.textContent = nextMode === 'bars' ? '📊' : nextMode === 'waves' ? '〰️' : '⭕';
      });
    }
  },

  async play(songId) {
    const songs = await DB.getAll(CONFIG.STORE_SONGS);
    const song = songs.find(s => s.id === songId);
    if (!song) return;

    if (song.audioUrl) {
      this.audio.src = song.audioUrl;
    } else if (song.audioBlob) {
      this.audio.src = URL.createObjectURL(song.audioBlob);
    } else {
      alert('Нет доступного аудио для этого трека');
      return;
    }

    this.cover.src = song.coverUrl || (song.coverBlob ? URL.createObjectURL(song.coverBlob) : '');
    this.title.textContent = song.title;
    this.artist.textContent = song.artist;
    this.bar.style.display = 'flex';
    this.audio.play().catch(console.log);
  },
};
