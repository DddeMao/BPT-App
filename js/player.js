/**
 * Аудиоплеер
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
    });
  },

  async play(songId) {
    const songs = await DB.getAll(CONFIG.STORE_SONGS);
    const song = songs.find(s => s.id === songId);
    if (!song) return;

    this.audio.pause();
    this.audio.src = '';

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

    this.audio.load();
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
