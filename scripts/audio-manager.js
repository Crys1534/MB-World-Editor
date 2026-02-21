/* 🔊 MB WORLD EDIT - AUDIO MANAGER (Web Audio API Synthesizer)
   Genera efectos de sonido estilo 8-bits procedimentalmente.
*/

const audioManager = {
    ctx: null,
    enabled: true,
    masterVolume: 0.3,

    init: function() {
        try {
            window.AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        } catch (e) {
            console.warn("Web Audio API not supported.");
            this.enabled = false;
        }
    },

    // Función auxiliar para generar osciladores
    playTone: function(freq, type, duration, vol = 1, slide = 0) {
        if (!this.enabled || !this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type; // 'sine', 'square', 'sawtooth', 'triangle'
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        
        if (slide !== 0) {
            osc.frequency.exponentialRampToValueAtTime(freq + slide, this.ctx.currentTime + duration);
        }

        gain.gain.setValueAtTime(vol * this.masterVolume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },

    // Función para generar ruido (para romper bloques y efecto basura)
    playNoise: function(duration, vol = 1) {
        if (!this.enabled || !this.ctx) return;
        
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(vol * this.masterVolume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        noise.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start();
    },

    // --- EFECTOS ESPECÍFICOS ---

    playSound: function(name) {
        switch (name) {
            case 'ui_click':
                // Click agudo tipo "bip"
                this.playTone(800, 'square', 0.05, 0.5);
                break;
            
            case 'ui_hover':
                // Click muy suave
                this.playTone(1200, 'sine', 0.03, 0.1);
                break;

            case 'ui_open':
                // Sonido ascendente
                this.playTone(400, 'triangle', 0.2, 0.4, 400); 
                break;

            case 'ui_close':
                // Sonido descendente
                this.playTone(600, 'triangle', 0.15, 0.4, -300);
                break;

            case 'ui_error':
                // Tono grave "buzz"
                this.playTone(150, 'sawtooth', 0.3, 0.6, -50);
                break;

            case 'ui_success':
                // Arpegio rápido
                this.playTone(880, 'square', 0.1, 0.4);
                setTimeout(() => this.playTone(1100, 'square', 0.2, 0.4), 100);
                break;

            case 'tool_switch':
                // Sonido metálico corto
                this.playTone(1500, 'sine', 0.05, 0.3);
                break;

            case 'place_block':
                // Sonido percusivo "Pock"
                this.playTone(300, 'square', 0.08, 0.6, -100);
                break;

            case 'break_block':
                // Ruido blanco "Krsh"
                this.playNoise(0.12, 0.7);
                break;

            case 'paint':
                // Sonido suave repetitivo para spray/bucket
                this.playTone(400 + Math.random()*100, 'sine', 0.1, 0.3);
                break;
                
            case 'teleport':
                // Sonido de ciencia ficción
                this.playTone(200, 'sawtooth', 0.4, 0.5, 1000);
                break;

            case 'trash':
                // Simulación de papel arrugado (3 ráfagas rápidas de ruido)
                // Ráfaga 1: Inicial fuerte
                this.playNoise(0.05, 0.8);
                // Ráfaga 2: Crujido medio (ligero retraso)
                setTimeout(() => this.playNoise(0.08, 0.6), 60);
                // Ráfaga 3: Final suave (más retraso)
                setTimeout(() => this.playNoise(0.12, 0.4), 140);
                break;
        }
    }
};

// Iniciar al cargar (o al primer clic del usuario para cumplir políticas de navegador)
window.addEventListener('click', () => {
    if (!audioManager.ctx) audioManager.init();
}, { once: true });