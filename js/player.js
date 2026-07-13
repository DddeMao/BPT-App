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

    // Улучшенный обработчик прогресса буферизации
    updateBuffered() {
      if (!this.audio.buffered || this.audio.buffered.length === 0) return;
      
      const bufferedEnd = this.audio.buffered.end(this.audio.buffered.length - 1);
     const duration = this.audio.duration || 0;
    
     if (duration > 0) {
       const percent = (bufferedEnd / duration) * 100;
       if (this.progressBar) {
         this.progressBar.style.width = percent + '%';
       }
     }
    },

    // Обновление прогресс-бара загрузки
    this.audio.addEventListener('progress', () => this.updateProgress());
    this.audio.addEventListener('loadeddata', () => this.updateProgress());
    this.audio.addEventListener('canplay', () => this.updateProgress());
    this.audio.addEventListener('timeupdate', () => this.updateProgress());
    this.audio.addEventListener('waiting', () => this.showLoading(true));
    this.audio.addEventListener('playing', () => this.showLoading(false));
    this.audio.addEventListener('stalled', () => this.showLoading(true));
    this.audio.addEventListener('error', () => this.showLoading(false));
    this.audio.addEventListener('progress', () => this.updateBuffered());
    this.audio.addEventListener('timeupdate', () => this.updateBuffered());
    this.audio.addEventListener('waiting', () => this.showLoading(true));
    this.audio.addEventListener('playing', () => this.showLoading(false));
    this.audio.addEventListener('canplaythrough', () => this.showLoading(false));
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
      this.progressBar.style.background = 'linear-gradient(90deg, var(--primary), var(--accent), var(--primary))';
      this.progressBar.style.backgroundSize = '200% 100%';
      this.progressBar.style.animation = 'progressPulse 1.5s linear infinite';
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

    // Сброс
    if (this.progressBar) {
      this.progressBar.style.width = '0%';
    }

    let audioSource = '';

    if (song.audioUrl) {
      audioSource = fixDropboxUrl(song.audioUrl);
    } else if (song.audioBlob) {
      audioSource = URL.createObjectURL(song.audioBlob);
    } else {
      alert('Нет доступного аудио для этого трека');
      return;
    }

    this.audio.onerror = () => {
      console.error('Audio error');
      UI.showNotification('Ошибка загрузки аудио. Проверьте ссылку.', true);
      this.showLoading(false);
    };

    this.audio.src = audioSource;
    this.audio.preload = 'metadata';           // Важно: metadata + progressive download
    this.audio.load();                         // Принудительно начинаем загрузку

    this.cover.src = song.coverUrl ? fixDropboxUrl(song.coverUrl) : 
                    (song.coverBlob ? URL.createObjectURL(song.coverBlob) : '');
    this.title.textContent = song.title || 'Без названия';
    this.artist.textContent = song.artist || 'Неизвестный исполнитель';
    this.bar.style.display = 'flex';

    // Автоматически начинаем воспроизведение, как только можно
    this.audio.addEventListener('canplay', () => {
      this.audio.play().catch(err => {
        console.log('Autoplay prevented:', err);
        if (err.name === 'NotAllowedError') {
          UI.showNotification('Нажмите play для воспроизведения', true);
        }
      });
    }, { once: true });

    this.showLoading(true);
  },
};
