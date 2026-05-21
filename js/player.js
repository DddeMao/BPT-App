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

    // CORS для визуализатора — обязательно для Dropbox и других внешних источников
    this.audio.crossOrigin = 'anonymous';

    // Инициализация визуализатора (опционально)
    if (typeof Visualizer !== 'undefined') {
      Visualizer.init();
    }

    this.audio.addEventListener('play', () => {
      setTimeout(() => { if (!this.audio.paused) this.cover.classList.add('playing'); }, 50);
      // Визуализатор подключается только если есть canvas
      if (typeof Visualizer !== 'undefined' && Visualizer.canvas) {
        try { Visualizer.connect(); } catch(e) { console.warn('Visualizer error:', e); }
      }
    });
    this.audio.addEventListener('pause', () => {
      this.cover.style.animation = 'none';
      this.cover.offsetHeight;
      this.cover.style.animation = '';
      this.cover.classList.remove('playing');
      if (typeof Visualizer !== 'undefined') Visualizer.stop();
    });
    this.audio.addEventListener('ended', () => {
      this.cover.classList.remove('playing');
      if (typeof Visualizer !== 'undefined') Visualizer.stop();
    });

    // Кнопка переключения режима визуализации
    const modeBtn = document.getElementById('visualizerModeBtn');
    if (modeBtn) {
      modeBtn.addEventListener('click', () => {
        if (typeof Visualizer === 'undefined') return;
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

    // Останавливаем текущее воспроизведение
    this.audio.pause();
    this.audio.src = '';

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

    // Загружаем и воспроизводим
    this.audio.load();
    try {
      await this.audio.play();
    } catch (err) {
      console.log('Play error:', err);
      if (err.name === 'NotAllowedError') {
        UI.showNotification('Нажмите play в плеере для воспроизведения', true);
      }
    }
  },
};
