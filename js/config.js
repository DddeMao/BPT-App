/**
 * Константы и конфигурация приложения
 */
const CONFIG = {
  CRITERIA: ['Рифмы/Образы', 'Структура/Ритмика', 'Реализация стиля', 'Индивидуальность/Харизма', 'Атмосфера/Вайб'],
  MAX_SCORE: 12,
  DB_NAME: 'MusicRatingsDB_v9',
  STORE_SONGS: 'songs',
  STORE_ALBUMS: 'albums',
  STORE_USERS: 'users',
  SESSION_KEY: 'bpt_currentUserId',
  GITHUB_USER: 'DddeMao',
  GITHUB_REPO: 'BvsT',
  MY_TELEGRAM_ID: 696265271,
  TG_BOT_NAME: 'bvst_auth_bot',
  SYNC_DELAY: 5000,
  FAVORITES_SYNC_DELAY: 3000,
};

/**
 * Утилита для исправления ссылок Dropbox
 * Преобразует www.dropbox.com в dl.dropboxusercontent.com для CORS-доступа
 */
function fixDropboxUrl(url) {
  if (!url) return '';
  let clean = url.trim();
  if (clean.includes('dropbox.com')) {
    clean = clean.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
    clean = clean.replace('dropbox.com', 'dl.dropboxusercontent.com');
    clean = clean.replace('?dl=0', '').replace('&dl=0', '');
    clean = clean.replace('?dl=1', '').replace('&dl=1', '');
    clean = clean.replace('?raw=1', '').replace('&raw=1', '');
  }
  return clean;
}
