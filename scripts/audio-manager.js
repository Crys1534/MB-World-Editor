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

    let finalFileName = mobName;

    // ✨ EXCEPCIÓN PARA EL LOBO: Elegir un ladrido al azar (bark1 a bark10)
    if (mobName.toLowerCase() === 'wolf') {
        const randomBark = Math.floor(Math.random() * 10) + 1;
        finalFileName = `bark${randomBark}`;
    }

    // Usamos el reproductor nativo de HTML5
    const audioUrl = `assets/sfx/${finalFileName}.mp3`;
    const mobAudio = new Audio(audioUrl);
    
    // Ajustamos el volumen usando tu variable masterVolume
    mobAudio.volume = (this.masterVolume !== undefined) ? this.masterVolume : 1.0;
    
    // Reproducimos el sonido
    mobAudio.play().catch(e => {
        // Si el archivo MP3 no existe, lo informamos en consola
        console.log(`AudioManager: No se pudo reproducir [${finalFileName}.mp3] para el mob: ${mobName}`);
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


// ==========================================
// ✨ SISTEMA DE SONIDOS AL PONER Y ROMPER BLOQUES (CON ANTI-CACOFONÍA)
// ==========================================

window.addEventListener('DOMContentLoaded', () => {
    window.blockSounds = {
        glass: [
            new Audio('assets/sfx/glass1.mp3'),
            new Audio('assets/sfx/glass2.mp3'),
            new Audio('assets/sfx/glass3.mp3')
        ],

        default: new Audio('assets/sfx/block.mp3')
    };

    setTimeout(() => {
        if (typeof mbwom !== 'undefined' && mbwom.setBlockState) {
            const originalSetBlockState = mbwom.setBlockState;
            
            mbwom.setBlockState = function(x, y, newState, layer) {
                const oldState = mbwom.getBlockState(x, y, layer);
                
                let oldType = (oldState && oldState.type !== undefined) ? oldState.type : 'air';
                let newType = (newState && newState.type !== undefined) ? newState.type : newState;
                
                if (oldType === 0) oldType = 'air';
                if (newType === 0 || !newType) newType = 'air';
                
                oldType = String(oldType);
                newType = String(newType);

                if (oldType !== newType) {
                    if (newType !== 'air') {
                        playBlockSound(newType);
                    } else if (oldType !== 'air') {
                        playBlockSound(oldType);
                    }
                }
                
                return originalSetBlockState.apply(this, arguments);
            };
        }
    }, 1000);
});

// ✨ NUEVO: Variable para controlar el ritmo de los sonidos
window.lastBlockSoundTime = 0;

window.playBlockSound = function(blockType) {
    if (!blockType) return;

    // ✨ ANTI-CACOFONÍA: Evitamos que suenen decenas de bloques en el mismo clic.
    // 40 milisegundos es perfecto para que suene 1 sola vez por clic de pincel grande,
    // pero permite que suene como ráfaga si arrastras el ratón.
    let now = Date.now();
    if (now - window.lastBlockSoundTime < 40) return; 
    window.lastBlockSoundTime = now;
    
    let soundType = null;
    let typeStr = String(blockType).toLowerCase();

    // Clasificación de bloques
    if (typeStr === 'gs' || typeStr.startsWith('gs_') || typeStr === 'bd_gs' || typeStr.startsWith('bd_gs_') || typeStr.includes('glass')) {
        soundType = 'glass';
    } 
    else if (typeStr.includes('wood') || typeStr.includes('plank') || typeStr.includes('log') || typeStr.includes('chest')) {
        soundType = 'wood';
    } 
    else if (typeStr.includes('stone') || typeStr.includes('cobble') || typeStr.includes('ore') || typeStr.includes('brick')) {
        soundType = 'stone';
    } 
    else if (typeStr.includes('dirt') || typeStr.includes('grass') || typeStr.includes('sand') || typeStr.includes('gravel')) {
        soundType = 'dirt';
    }
    else if (typeStr.includes('leaf') || typeStr.includes('leaves') || typeStr.includes('flower')) {
        soundType = 'leaves';
    }
    else {
        soundType = 'default';
    }

    if (soundType && window.blockSounds[soundType]) {
        let soundSource = window.blockSounds[soundType];
        
        if (Array.isArray(soundSource)) {
            soundSource = soundSource[Math.floor(Math.random() * soundSource.length)];
        }

        const soundClone = soundSource.cloneNode();
        soundClone.volume = (typeof window.masterVolume !== 'undefined') ? window.masterVolume : 1.0;
        soundClone.play().catch(e => console.warn("Audio bloqueado:", e));
    }
};

// ==========================================
// ✨ EFECTOS DE SONIDO PARA LA EXPERIENCIA (XP)
// ==========================================

window.addEventListener('DOMContentLoaded', () => {
    const xpInput = document.getElementById('player-xp');
    
    if (xpInput) {
        // 1. Precargamos los sonidos base (Plantillas)
        const orbSounds = [
            new Audio('assets/sfx/orb1.mp3'),
            new Audio('assets/sfx/orb2.mp3'),
            new Audio('assets/sfx/orb3.mp3'),
            new Audio('assets/sfx/orb4.mp3')
        ];
        const levelUpSound = new Audio('assets/sfx/levelup.mp3');

        let previousXp = parseInt(xpInput.value) || 0;

        xpInput.addEventListener('input', (e) => {
            const currentXp = parseInt(e.target.value) || 0;

            if (currentXp > previousXp) {
                const vol = (typeof window.masterVolume !== 'undefined') ? window.masterVolume : 1.0;
                const crossedDecade = Math.floor(currentXp / 10) > Math.floor(previousXp / 10);

                if (crossedDecade || (currentXp % 10 === 0 && currentXp !== 0)) {
                    // 🌟 ¡Sube de Nivel! (CLONAMOS EL AUDIO PARA QUE NO SE CORTE)
                    const soundClone = levelUpSound.cloneNode();
                    soundClone.volume = vol;
                    soundClone.play().catch(err => console.warn("Audio bloqueado:", err));
                } else {
                    // 🔵 Orbe Normal: (CLONAMOS EL AUDIO PARA QUE SE SUPERPONGAN)
                    const randomOrb = orbSounds[Math.floor(Math.random() * orbSounds.length)];
                    const soundClone = randomOrb.cloneNode();
                    soundClone.volume = vol;
                    soundClone.play().catch(err => console.warn("Audio bloqueado:", err));
                }
            }

            previousXp = currentXp;
        });
    }
});


// ==========================================
// ✨ EFECTOS DE SONIDO PARA LA INTERFAZ
// ==========================================

window.addEventListener('DOMContentLoaded', () => {
    // Seleccionamos todos los botones que tengan la clase 'mini-arrow-btn'
    const arrowButtons = document.querySelectorAll('.mini-arrow-btn');
    
    // Pre-cargamos el sonido de clic en la memoria
    // NOTA: Asegúrate de que la ruta 'assets/sfx/click.mp3' coincida con tu archivo real
    const uiClickSound = new Audio('assets/sfx/click.mp3');
    
    arrowButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Reiniciamos el sonido por si el usuario hace clic muy rápido
            uiClickSound.currentTime = 0; 
            
            // Lo atamos a tu sistema de volumen global (si existe), si no, lo dejamos al 100%
            uiClickSound.volume = (typeof window.masterVolume !== 'undefined') ? window.masterVolume : 1.0;
            
            // Reproducimos el sonido (ignoramos el error si el navegador bloquea el autoplay inicial)
            uiClickSound.play().catch(e => console.warn("Sonido de UI bloqueado por el navegador:", e));
        });
    });
});

window.audioSettings = { master: 100, sfx: 100, ui: 100, notif: 100 };

window.updateAudioChannel = function(channel, value) {
    window.audioSettings[channel] = parseInt(value);
    document.getElementById(`vol-${channel}-display`).innerText = value + '%';
    localStorage.setItem('mbw_audio_' + channel, value);
    // Aquí puedes disparar una lógica extra si necesitas actualizar el audio en tiempo real
    console.log(`Canal ${channel} ajustado a ${value}`);
};

// Cargar al iniciar
window.addEventListener('DOMContentLoaded', () => {
    ['master', 'sfx', 'ui', 'notif'].forEach(ch => {
        let saved = localStorage.getItem('mbw_audio_' + ch);
        if (saved !== null) {
            window.audioSettings[ch] = parseInt(saved);
            let slider = document.querySelector(`input[oninput="updateAudioChannel('${ch}', this.value)"]`);
            let display = document.getElementById(`vol-${ch}-display`);
            if (slider) slider.value = saved;
            if (display) display.innerText = saved + '%';
        }
    });
});