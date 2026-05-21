/**
 * Радиарная диаграмма (Spider Chart) для визуализации оценок
 * Canvas-based, без внешних зависимостей
 */
const RadarChart = {
  /**
   * Рисует радиарную диаграмму на canvas
   * @param {HTMLCanvasElement} canvas - элемент canvas
   * @param {Array} scores - массив оценок [0-12, 0-12, ...]
   * @param {Object} options - настройки
   */
  draw(canvas, scores, options = {}) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // Размеры
    const size = options.size || canvas.offsetWidth || 200;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    ctx.scale(dpr, dpr);

    const centerX = size / 2;
    const centerY = size / 2;
    const radius = (size / 2) - (options.padding || 20);
    const levels = options.levels || 4;
    const criteria = options.criteria || CONFIG.CRITERIA;
    const maxScore = options.maxScore || CONFIG.MAX_SCORE;
    const numAxes = criteria.length;

    // Цвета
    const bgColor = options.bgColor || 'rgba(179, 102, 255, 0.1)';
    const fillColor = options.fillColor || 'rgba(179, 102, 255, 0.25)';
    const strokeColor = options.strokeColor || '#b366ff';
    const gridColor = options.gridColor || 'rgba(179, 102, 255, 0.15)';
    const textColor = options.textColor || '#a0a0b0';
    const dotColor = options.dotColor || '#ff4d6d';

    // Очистка
    ctx.clearRect(0, 0, size, size);

    // Рисуем сетку (концентрические многоугольники)
    for (let level = 1; level <= levels; level++) {
      const levelRadius = (radius / levels) * level;
      ctx.beginPath();
      for (let i = 0; i <= numAxes; i++) {
        const angle = (Math.PI * 2 * i / numAxes) - Math.PI / 2;
        const x = centerX + Math.cos(angle) * levelRadius;
        const y = centerY + Math.sin(angle) * levelRadius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Рисуем оси
    for (let i = 0; i < numAxes; i++) {
      const angle = (Math.PI * 2 * i / numAxes) - Math.PI / 2;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Рисуем данные
    if (scores && scores.length > 0) {
      // Фон
      ctx.beginPath();
      for (let i = 0; i <= numAxes; i++) {
        const idx = i % numAxes;
        const angle = (Math.PI * 2 * idx / numAxes) - Math.PI / 2;
        const value = (scores[idx] || 0) / maxScore;
        const r = radius * value;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Точки на осях
      for (let i = 0; i < numAxes; i++) {
        const angle = (Math.PI * 2 * i / numAxes) - Math.PI / 2;
        const value = (scores[i] || 0) / maxScore;
        const r = radius * value;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;

        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = dotColor;
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // Подписи осей
    ctx.font = `${options.fontSize || 11}px 'Segoe UI', system-ui, sans-serif`;
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < numAxes; i++) {
      const angle = (Math.PI * 2 * i / numAxes) - Math.PI / 2;
      const labelRadius = radius + 18;
      const x = centerX + Math.cos(angle) * labelRadius;
      const y = centerY + Math.sin(angle) * labelRadius;

      // Обрезаем длинные названия
      const label = criteria[i] || '';
      const shortLabel = label.length > 10 ? label.substring(0, 8) + '…' : label;
      ctx.fillText(shortLabel, x, y);
    }
  },

  /**
   * Создаёт мини-радар для карточки трека
   */
  drawMini(canvas, scores) {
    this.draw(canvas, scores, {
      size: 48,
      padding: 8,
      levels: 3,
      fontSize: 0,
      bgColor: 'rgba(179, 102, 255, 0.15)',
      fillColor: 'rgba(179, 102, 255, 0.3)',
      strokeColor: '#b366ff',
      gridColor: 'rgba(179, 102, 255, 0.1)',
      dotColor: '#ff4d6d',
    });
  },

  /**
   * Создаёт радар для модального окна оценки
   */
  drawLarge(canvas, scores) {
    this.draw(canvas, scores, {
      size: 280,
      padding: 30,
      levels: 4,
      fontSize: 11,
      bgColor: 'rgba(179, 102, 255, 0.08)',
      fillColor: 'rgba(179, 102, 255, 0.2)',
      strokeColor: '#b366ff',
      gridColor: 'rgba(179, 102, 255, 0.12)',
      dotColor: '#ff4d6d',
    });
  },

  /**
   * Рисует несколько радаров для сравнения оценок
   */
  drawComparison(canvas, ratings) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const size = canvas.offsetWidth || 300;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    ctx.scale(dpr, dpr);

    const centerX = size / 2;
    const centerY = size / 2;
    const radius = (size / 2) - 35;
    const levels = 4;
    const criteria = CONFIG.CRITERIA;
    const maxScore = CONFIG.MAX_SCORE;
    const numAxes = criteria.length;

    // Очистка
    ctx.clearRect(0, 0, size, size);

    // Сетка
    for (let level = 1; level <= levels; level++) {
      const levelRadius = (radius / levels) * level;
      ctx.beginPath();
      for (let i = 0; i <= numAxes; i++) {
        const angle = (Math.PI * 2 * i / numAxes) - Math.PI / 2;
        const x = centerX + Math.cos(angle) * levelRadius;
        const y = centerY + Math.sin(angle) * levelRadius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(179, 102, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Оси
    for (let i = 0; i < numAxes; i++) {
      const angle = (Math.PI * 2 * i / numAxes) - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius);
      ctx.strokeStyle = 'rgba(179, 102, 255, 0.1)';
      ctx.stroke();
    }

    // Подписи
    ctx.font = '10px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#a0a0b0';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < numAxes; i++) {
      const angle = (Math.PI * 2 * i / numAxes) - Math.PI / 2;
      const x = centerX + Math.cos(angle) * (radius + 16);
      const y = centerY + Math.sin(angle) * (radius + 16);
      const label = criteria[i] || '';
      ctx.fillText(label.length > 8 ? label.substring(0, 7) + '…' : label, x, y);
    }

    // Цвета для разных пользователей
    const colors = [
      { fill: 'rgba(179, 102, 255, 0.2)', stroke: '#b366ff', dot: '#ff4d6d' },
      { fill: 'rgba(255, 77, 109, 0.15)', stroke: '#ff4d6d', dot: '#b366ff' },
      { fill: 'rgba(0, 255, 136, 0.15)', stroke: '#00ff88', dot: '#ffd700' },
      { fill: 'rgba(255, 215, 0, 0.15)', stroke: '#ffd700', dot: '#00ff88' },
    ];

    // Рисуем каждый рейтинг
    ratings.forEach((rating, idx) => {
      const color = colors[idx % colors.length];
      const scores = rating.scores || [];

      ctx.beginPath();
      for (let i = 0; i <= numAxes; i++) {
        const si = i % numAxes;
        const angle = (Math.PI * 2 * si / numAxes) - Math.PI / 2;
        const value = (scores[si] || 0) / maxScore;
        const r = radius * value;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = color.fill;
      ctx.fill();
      ctx.strokeStyle = color.stroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  }
};
