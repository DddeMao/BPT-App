class AudioVisualizer {
    constructor(options) {
        this.canvas = document.getElementById(options.canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.audioElement = document.getElementById(options.audioId);

        // --- НАСТРОЙКИ ВИЗУАЛИЗАТОРА ---
        this.barWidth = options.barWidth || 8;
        this.barGap = options.barGap || 2;
        this.fftSize = options.fftSize || 512;
        this.colorStart = options.colorStart || '#00d2ff';
        this.colorEnd = options.colorEnd || '#3a7bd5';
        this.opacity = options.opacity || 0.3;
        this.smoothing = options.smoothing || 0.8;
        this.heightScale = options.heightScale || 0.3;

        this.audioCtx = null;
        this.analyser = null;
        this.source = null;
        this.dataArray = null;
        this.bufferLength = null;
        this.isInitialized = false;

        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    init() {
        if (!this.audioCtx) {
            try {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                this.analyser = this.audioCtx.createAnalyser();
                this.analyser.fftSize = this.fftSize;
                this.analyser.smoothingTimeConstant = this.smoothing;

                this.source = this.audioCtx.createMediaElementSource(this.audioElement);
                this.source.connect(this.analyser);
                this.analyser.connect(this.audioCtx.destination);

                this.bufferLength = this.analyser.frequencyBinCount;
                this.dataArray = new Uint8Array(this.bufferLength);
            } catch (e) {
                console.error("Ошибка инициализации Web Audio API:", e);
                return;
            }
        }

        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        if (!this.isInitialized) {
            this.isInitialized = true;
            this.draw();
        }
    }

     draw() {
        requestAnimationFrame(() => this.draw());

        if (!this.analyser || !this.dataArray) return;

        this.analyser.getByteFrequencyData(this.dataArray);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        let x = 0;
        const gradient = this.ctx.createLinearGradient(0, this.canvas.height, 0, 0);
        gradient.addColorStop(0, this.colorStart);
        gradient.addColorStop(1, this.colorEnd);

        this.ctx.fillStyle = gradient;
        this.ctx.globalAlpha = this.opacity;

        for (let i = 0; i < this.bufferLength; i++) {
            const barHeight = (this.dataArray[i] / 255) * this.canvas.height * this.heightScale;

            this.ctx.fillRect(x, this.canvas.height - barHeight, this.barWidth, barHeight);

            x += this.barWidth + this.barGap;
            
            if (x > this.canvas.width) break;
        }
    }
}