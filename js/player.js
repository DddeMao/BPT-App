/**
 * Аудиоплеер с потоковой загрузкой и индикатором прогресса
 */
const Player = {
  audio: null,
  cover: null,
  title: null,
  artist: null,
  bar: null,
  progressBar: null,

  init() {
    this.audio = document.getElementById('audioPlayer');
    this.cover = document.getElementById('playerCover');
    this.title = document.getElementById('playerTitle');
    this.artist = document.getElementById('playerArtist');
    this.bar = document.getElementById('player');
    this.progressBar = document.getElementById('playerProgressBar');

    this.audio.addEventListener('play', () => {
      setTimeout(() => { if (!this.audio.paused) this.cover.classList.add('playing'); }, 50);
    });
    this.audio.addEventListener('pause', () => {
      this.cover.style.animation = 'none';
      this.cover.offsetHeight;
      this.cover.style.animation = '';
      this.cover.classList.remove('playing');
    });
    this.audio.addEventListener('ended', () => {
      this.cover.classList.remove('playing');
      this.updateProgress();
    });

    // Обновление прогресс-бара загрузки
    this.audio.addEventListener('progress', () => this.updateProgress());
    this.audio.addEventListener('loadeddata', () => this.updateProgress());
    this.audio.addEventListener('canplay', () => this.updateProgress());
    this.audio.addEventListener('timeupdate', () => this.updateProgress());
    this.audio.addEventListener('waiting', () => this.showLoading(true));
    this.audio.addEventListener('playing', () => this.showLoading(false));
    this.audio.addEventListener('stalled', () => this.showLoading(true));
    this.audio.addEventListener('error', () => this.showLoading(false));
  },

  updateProgress() {
    if (!this.progressBar || !this.audio.duration) return;
    const buffered = this.audio.buffered;
    if (buffered.length > 0) {
      const loaded = buffered.end(buffered.length - 1) / this.audio.duration * 100;
      this.progressBar.style.width = loaded + '%';
    }
  },

  showLoading(isLoading) {
    if (!this.progressBar) return;
    if (isLoading) {
      this.progressBar.style.opacity = '1';
      this.progressBar.style.background = 'linear-gradient(90deg, var(--primary), var(--accent), var(--primary))';
      this.progressBar.style.backgroundSize = '200% 100%';
      this.progressBar.style.animation = 'progressPulse 1.5s ease-in-out infinite';
    } else {
      this.progressBar.style.animation = 'none';
      this.progressBar.style.background = 'linear-gradient(90deg, var(--primary), var(--accent))';
    }
  },

  async play(songId) {
    const songs = await DB.getAll(CONFIG.STORE_SONGS);
    const song = songs.find(s => s.id === songId);
    if (!song) return;

    this.audio.pause();
    this.audio.src = '';

    // Сброс прогресс-бара
    if (this.progressBar) {
      this.progressBar.style.width = '0%';
      this.progressBar.style.opacity = '1';
    }

    if (song.audioUrl) {
      this.audio.src = fixDropboxUrl(song.audioUrl);
    } else if (song.audioBlob) {
      this.audio.src = URL.createObjectURL(song.audioBlob);
    } else {
      alert('Нет доступного аудио для этого трека');
      return;
    }

    this.cover.src = song.coverUrl ? fixDropboxUrl(song.coverUrl) : (song.coverBlob ? URL.createObjectURL(song.coverBlob) : '');
    this.title.textContent = song.title;
    this.artist.textContent = song.artist;
    this.bar.style.display = 'flex';

    // Потоковая загрузка — preload="none", браузер сам загрузит по мере необходимости
    this.audio.preload = 'none';

    try {
      await this.audio.play();
    } catch (err) {
      console.log('Play error:', err);
      if (err.name === 'NotAllowedError') {
        if (typeof UI !== 'undefined') {
          UI.showNotification('Нажмите play в плеере для воспроизведения', true);
        }
      }
    }
  },
};
