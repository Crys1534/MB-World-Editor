/* 🔊 MB WORLD EDIT - AUDIO MANAGER (Web Audio API Synthesizer)
   Genera efectos de sonido estilo 8-bits procedimentalmente y reproduce audios externos.
*/

const audioManager = {
    ctx: null,
    enabled: true,
    masterVolume: 0.3,
    audioCache: {}, // ✨ NUEVO: Para guardar los MP3 cargados

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

        osc.type = type; 
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

    // Función para generar ruido 
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

// ✨ NUEVO: FUNCIÓN PARA REPRODUCIR SONIDOS DE MOBS (MP3) ✨
    playMobSound: function(mobName) {
        if (!this.enabled) return;

        // Usamos el reproductor nativo de HTML5 (que sí funciona en file:///)
        const audioUrl = `assets/sfx/${mobName}.mp3`;
        const mobAudio = new Audio(audioUrl);
        
        mobAudio.volume = this.masterVolume * 1; // Ajustamos el volumen
        
        // Reproducimos el sonido
        mobAudio.play().catch(e => {
            // Si el archivo MP3 no existe, simplemente lo ignoramos en silencio
            console.log(`AudioManager: No hay sonido para el mob: ${mobName}`);
        });
    },
	
    // --- EFECTOS ESPECÍFICOS ---

    playSound: function(name) {
        switch (name) {
            case 'ui_click': this.playTone(800, 'square', 0.05, 0.5); break;
            case 'ui_hover': this.playTone(1200, 'sine', 0.03, 0.1); break;
            case 'ui_open': this.playTone(400, 'triangle', 0.2, 0.4, 400); break;
            case 'ui_close': this.playTone(600, 'triangle', 0.15, 0.4, -300); break;
            case 'ui_error': this.playTone(150, 'sawtooth', 0.3, 0.6, -50); break;
            case 'ui_success':
                this.playTone(880, 'square', 0.1, 0.4);
                setTimeout(() => this.playTone(1100, 'square', 0.2, 0.4), 100);
                break;
            case 'tool_switch': this.playTone(1500, 'sine', 0.05, 0.3); break;
            case 'place_block': this.playTone(300, 'square', 0.08, 0.6, -100); break;
            case 'break_block': this.playNoise(0.12, 0.7); break;
            case 'paint': this.playTone(400 + Math.random()*100, 'sine', 0.1, 0.3); break;
            case 'teleport': this.playTone(200, 'sawtooth', 0.4, 0.5, 1000); break;
            case 'trash':
                this.playNoise(0.05, 0.8);
                setTimeout(() => this.playNoise(0.08, 0.6), 60);
                setTimeout(() => this.playNoise(0.12, 0.4), 140);
                break;
        }
    }
};

window.addEventListener('click', () => {
    if (!audioManager.ctx) audioManager.init();
}, { once: true });