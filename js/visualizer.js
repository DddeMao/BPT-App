/**
 * Аудио визуализатор для плеера
 * Canvas-based, без внешних зависимостей
 * Режимы: waves, bars, circle
 */
const Visualizer = {
  audioContext: null,
  analyser: null,
  source: null,
  animationId: null,
  mode: 'bars', // 'waves', 'bars', 'circle'
  canvas: null,
  ctx: null,

  /**
   * Инициализация визуализатора
   */
  init() {
    this.canvas = document.getElementById('visualizerCanvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },

  /**
   * Подключение к аудиоплееру
   */
  connect() {
    const audio = document.getElementById('audioPlayer');
    if (!audio) return;

    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.source = this.audioContext.createMediaElementSource(audio);
      this.source.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
    }

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    this.start();
  },

  /**
   * Запуск анимации
   */
  start() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.draw();
  },

  /**
   * Остановка анимации
   */
  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.clear();
  },

  /**
   * Очистка canvas
   */
  clear() {
    if (!this.ctx || !this.canvas) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  },

  /**
   * Изменение размера canvas
   */
  resize() {
    if (!this.canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
  },

  /**
   * Переключение режима
   */
  setMode(mode) {
    this.mode = mode;
  },

  /**
   * Основной цикл отрисовки
   */
  draw() {
    if (!this.analyser || !this.ctx) return;

    this.animationId = requestAnimationFrame(() => this.draw());

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);

    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    this.ctx.clearRect(0, 0, width, height);

    switch (this.mode) {
      case 'waves':
        this.drawWaves(dataArray, bufferLength, width, height);
        break;
      case 'bars':
        this.drawBars(dataArray, bufferLength, width, height);
        break;
      case 'circle':
        this.drawCircle(dataArray, bufferLength, width, height);
        break;
    }
  },

  /**
   * Режим: волны
   */
  drawWaves(dataArray, bufferLength, width, height) {
    const sliceWidth = width / bufferLength;
    let x = 0;

    // Градиентная линия
    const gradient = this.ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, '#b366ff');
    gradient.addColorStop(0.5, '#ff4d6d');
    gradient.addColorStop(1, '#b366ff');

    this.ctx.beginPath();
    this.ctx.strokeStyle = gradient;
    this.ctx.lineWidth = 2;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 255;
      const y = (v * height / 2) + (height / 2);

      if (i === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);

      x += sliceWidth;
    }

    this.ctx.stroke();

    // Заливка под волной
    this.ctx.lineTo(width, height);
    this.ctx.lineTo(0, height);
    this.ctx.closePath();

    const fillGradient = this.ctx.createLinearGradient(0, 0, 0, height);
    fillGradient.addColorStop(0, 'rgba(179, 102, 255, 0.3)');
    fillGradient.addColorStop(1, 'rgba(179, 102, 255, 0)');
    this.ctx.fillStyle = fillGradient;
    this.ctx.fill();
  },

  /**
   * Режим: частотные столбцы
   */
  drawBars(dataArray, bufferLength, width, height) {
    const barCount = 64;
    const barWidth = width / barCount - 2;
    const step = Math.floor(bufferLength / barCount);

    for (let i = 0; i < barCount; i++) {
      const value = dataArray[i * step] / 255;
      const barHeight = value * height * 0.9;
      const x = i * (barWidth + 2);
      const y = height - barHeight;

      // Градиент для каждого столбца
      const gradient = this.ctx.createLinearGradient(x, y, x, height);
      gradient.addColorStop(0, '#b366ff');
      gradient.addColorStop(0.5, '#ff4d6d');
      gradient.addColorStop(1, 'rgba(255, 77, 109, 0.3)');

      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(x, y, barWidth, barHeight);

      // Свечение сверху
      if (barHeight > 5) {
        this.ctx.beginPath();
        this.ctx.arc(x + barWidth / 2, y, Math.min(barWidth / 2, 4), 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        this.ctx.fill();
      }
    }
  },

  /**
   * Режим: круговой спектр
   */
  drawCircle(dataArray, bufferLength, width, height) {
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 4;
    const barCount = 64;
    const step = Math.floor(bufferLength / barCount);

    for (let i = 0; i < barCount; i++) {
      const value = dataArray[i * step] / 255;
      const barHeight = value * radius * 0.8;
      const angle = (Math.PI * 2 * i / barCount) - Math.PI / 2;

      const x1 = centerX + Math.cos(angle) * radius;
      const y1 = centerY + Math.sin(angle) * radius;
      const x2 = centerX + Math.cos(angle) * (radius + barHeight);
      const y2 = centerY + Math.sin(angle) * (radius + barHeight);

      const gradient = this.ctx.createLinearGradient(x1, y1, x2, y2);
      gradient.addColorStop(0, '#b366ff');
      gradient.addColorStop(1, '#ff4d6d');

      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.strokeStyle = gradient;
      this.ctx.lineWidth = 3;
      this.ctx.lineCap = 'round';
      this.ctx.stroke();
    }

    // Внутренний круг
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, radius - 2, 0, Math.PI * 2);
    this.ctx.strokeStyle = 'rgba(179, 102, 255, 0.2)';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();
  }
};
