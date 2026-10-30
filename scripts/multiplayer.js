window.spectatingTargetId = null; // Rastrea a quién vemos
window.mySpectators = new Set(); // Rastrea quién NOS está viendo a nosotros

// Función para activar/desactivar el espectador
window.toggleSpectatorMode = function(targetPeerId, targetName) {
    const myName = localStorage.getItem('mbw_username') || "Player";

    // ✨ NUEVO: Escudo Anti-Bucle (Inception)
    // Si intentamos encender la cámara hacia alguien que YA nos está viendo...
    if (window.spectatingTargetId !== targetPeerId && window.mySpectators && window.mySpectators.has(targetName)) {
        if (typeof showDesktopNotification === 'function') {
            showDesktopNotification("🚫 No puedes", targetName + " ya te está especteando a ti.", "assets/default pfp.png");
        }
        return; // 🛑 Detenemos la función aquí, no hace nada más.
    }

    if (window.spectatingTargetId === targetPeerId) {
        // 🔴 APAGAR: Le avisamos al objetivo que ya no lo vemos
        if (typeof enviarMensajeEnRed === 'function') {
            enviarMensajeEnRed({ tipo: "spectator_update", targetPeer: window.spectatingTargetId, spectatorName: myName, spectating: false });
        }
        
        window.spectatingTargetId = null; 
        
        // ✨ FIX: REINICIO Y ALINEACIÓN DE CÁMARA
        if (typeof camera !== 'undefined' && typeof mbwom !== 'undefined' && mbwom.world) {
            let miX = Number(mbwom.world.worldX);
            let miY = -Number(mbwom.world.worldY);
            
            if (typeof grid !== 'undefined') {
                camera.x = miX - (grid.width / 2);
                camera.y = miY - (grid.height / 2);
            }
            camera.x = Math.round(camera.x);
            camera.y = Math.round(camera.y);
        }
        
        if (typeof worldDirty !== 'undefined') worldDirty = true;
        if (typeof showDesktopNotification === 'function') showDesktopNotification("Spectator Mode!", "Camera reset.", "assets/default pfp.png");
        
    } else {
        // 🟢 ENCENDER: Si ya veíamos a alguien más, le avisamos que nos fuimos
        if (window.spectatingTargetId && typeof enviarMensajeEnRed === 'function') {
            enviarMensajeEnRed({ tipo: "spectator_update", targetPeer: window.spectatingTargetId, spectatorName: myName, spectating: false });
        }

        window.spectatingTargetId = targetPeerId; 
        
        // Le avisamos al NUEVO objetivo que lo estamos viendo
        if (typeof enviarMensajeEnRed === 'function') {
            enviarMensajeEnRed({ tipo: "spectator_update", targetPeer: targetPeerId, spectatorName: myName, spectating: true });
        }

        if (typeof showDesktopNotification === 'function') showDesktopNotification("Spectator Mode", "You're following " + targetName, "assets/default pfp.png");
    }
    
    if (typeof window.renderLivePlayers === 'function') window.renderLivePlayers();
};

// ==========================================
// ✨ MOTOR MULTIJUGADOR P2P + FIREBASE (SERVIDORES PÚBLICOS)
// ==========================================

const firebaseConfig = {
    apiKey: "AIzaSyDawixERthu8gHpy-ckb8PMNVOMhlBEQMs",
    authDomain: "mbwe-multiplayer.firebaseapp.com",
    databaseURL: "https://mbwe-multiplayer-default-rtdb.firebaseio.com",
    projectId: "mbwe-multiplayer",
    storageBucket: "mbwe-multiplayer.firebasestorage.app",
    messagingSenderId: "257037230459",
    appId: "1:257037230459:web:cb96f22f7a5c1629fa5dde"
};
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

let peer = null;
let isMultiplayer = false;
let isHost = false; 
let misClientes = []; 
let miConexionAlHost = null; 
window.networkCursors = {};
window.myRoomRef = null; 
window.multiplayerPlayerLimit = 2; 

// Variables Maestras
window.roomPlayers = [];
window.currentRoomId = null; 
window.lastKnownUsers = null; 
window.multiplayerAccess = 'public'; 
window.inviteCooldowns = window.inviteCooldowns || {};

// Almacenaje temporal del mapa a hostear
window.mpSelectedMapName = null;
window.mpSelectedMapData = null;
window.mpSelectedMapThumb = null;

// ✨ Sistema de Respuestas
let replyingTo = null; 


// ==========================================
// ✨ AYUDAS: NOMBRES/FOTOS, BLOQUEADOS, FOTO SINCRONIZADA, REINICIO DEL CHAT
// ==========================================
const MP_DEFAULT_PFP = "assets/default pfp.png";
const MP_FRIEND_RETRY_MS = 7 * 24 * 60 * 60 * 1000; // tras un rechazo, se puede volver a intentar en 7 días
window.friendProfiles = {}; // nombre/foto guardados de mis amigos (se llena desde Firebase)

// ¿Es un nombre "de verdad"? (no vacío ni valores de relleno como "Unknown User" o "undefined")
window.isRealName = function(n) {
    return typeof n === 'string' && n.trim() !== '' && n !== 'Unknown User' && n !== 'User' && n !== 'undefined' && n !== 'null';
};
// ¿Es una foto "de verdad"? (no vacía, ni "undefined", ni la foto por defecto)
window.isRealPfp = function(p) {
    return typeof p === 'string' && p.trim() !== '' && p !== 'undefined' && p !== 'null' && p !== MP_DEFAULT_PFP;
};
// Busca el mejor nombre/foto de una persona: primero si está en línea, luego el registro del chat,
// luego el registro de amigo. Nunca devuelve "undefined": como mínimo "Unknown User" + foto por defecto.
window.resolveChatInfo = function(uid, rec, friendRec) {
    const online = window.lastKnownUsers && window.lastKnownUsers[uid];
    rec = rec || {};
    const f = (friendRec !== undefined) ? friendRec : window.friendProfiles[uid];
    const fr = (f && typeof f === 'object') ? f : {};
    const names = [online && online.username, rec.name, fr.name];
    const pfps = [online && online.pfp, rec.pfp, fr.pfp];
    const anyName = (n) => typeof n === 'string' && n.trim() !== '' && n !== 'undefined' && n !== 'null';
    return {
        name: names.find(window.isRealName) || names.find(anyName) || 'Unknown User',
        pfp: pfps.find(window.isRealPfp) || MP_DEFAULT_PFP,
        online: !!online
    };
};

// --- Bloqueados: se guardan solo en este navegador (uid -> nombre) ---
window.getBlockedMap = function() {
    try {
        const m = JSON.parse(localStorage.getItem('mbw_blocked') || '{}');
        return (m && typeof m === 'object') ? m : {};
    } catch (e) { return {}; }
};
window.isBlocked = function(uid) {
    return !!uid && Object.prototype.hasOwnProperty.call(window.getBlockedMap(), uid);
};
function saveBlockedMap(map) {
    try { localStorage.setItem('mbw_blocked', JSON.stringify(map)); } catch (e) {}
}

// --- Foto de perfil: solo se vuelve a subir si cambió desde la última vez ---
function _pfpTag(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) { h = ((h << 5) + h + str.charCodeAt(i)) | 0; }
    return str.length + ':' + h;
}
function _getPfpSyncMap() {
    try {
        const m = JSON.parse(localStorage.getItem('mbw_pfp_sync') || '{}');
        return (m && typeof m === 'object') ? m : {};
    } catch (e) { return {}; }
}
window.pfpNeedsSync = function(key, pfp) {
    return _getPfpSyncMap()[key] !== _pfpTag(String(pfp || ''));
};
window.markPfpSynced = function(key, pfp) {
    try {
        const m = _getPfpSyncMap();
        m[key] = _pfpTag(String(pfp || ''));
        localStorage.setItem('mbw_pfp_sync', JSON.stringify(m));
    } catch (e) {}
};

// (resetChatComposer, setReply, cancelReply y todo lo que dibuja el chat privado
//  ahora viven en scripts/chat-dm.js)

window.setMpLimit = function(limit) {
    window.multiplayerPlayerLimit = limit;
	// ✨ FIX: Si por alguna razón intentan poner 1, lo forzamos a ser 2 mínimo
    if (limit < 2) limit = 2;
	
    const buttons = document.querySelectorAll('.mp-limit-btn');
    buttons.forEach(btn => btn.classList.toggle('selected-limit', parseInt(btn.innerText) === limit));
};

window.toggleMpAccess = function(checkbox) {
    window.multiplayerAccess = checkbox.checked ? 'friends_only' : 'public';
    const label = document.getElementById('mp-access-label');
    if (label) {
        label.innerText = checkbox.checked ? 'Friends Only' : 'Public';
        label.style.color = checkbox.checked ? '#f1c40f' : '#2ecc71';
    }
};

window.setMpView = function(viewId) {
    // (ronda 52: el asistente nuevo de "Create Server" está en scripts/server-wizard.js; los nombres viejos llevan a sus pasos nuevos)
    const ALIAS = { 'create-1': 'create-world', 'create-map': 'create-world', 'create-2': 'create-setup' };
    const wasOld = !!ALIAS[viewId];
    viewId = ALIAS[viewId] || viewId;
    const views = ['home', 'join', 'create-world', 'create-setup'];
    views.forEach(v => {
        const el = document.getElementById('mp-view-' + v);
        if (el) el.style.display = 'none';
    });
    
    const target = document.getElementById('mp-view-' + viewId);
    if (target) target.style.display = 'block';
    
    if (viewId === 'join') window.loadPublicServers();
    if (window.mbwServerWizard) window.mbwServerWizard.onView(viewId);

    // volver al principio del asistente (o a "home") con una sala abierta = se cierra la sala
    if ((viewId === 'home' || viewId === 'create-world' || (wasOld && viewId !== 'create-setup')) && isHost) {
        if (peer) { peer.destroy(); peer = null; }
        if (window.myRoomRef) { window.myRoomRef.remove(); window.myRoomRef = null; }
        isHost = false;
        isMultiplayer = false;
        window.currentRoomId = null;
        window.roomPlayers = [];
        window.mpSelectedMapData = null;
        renderLivePlayers(); 
        if (typeof window.renderPresenceList === 'function') window.renderPresenceList(); 
        const statusText = document.getElementById('multiplayer-status');
        if (statusText) statusText.style.display = 'none';
        
        window.multiplayerAccess = 'public';
        const accessToggle = document.getElementById('mp-access-toggle');
        if (accessToggle) accessToggle.checked = false;
        const accessLabel = document.getElementById('mp-access-label');
        if (accessLabel) { accessLabel.innerText = 'Public'; accessLabel.style.color = '#2ecc71'; }
    }
};

window.copyRoomId = function() {
    const copyText = document.getElementById("my-peer-id");
    if (!copyText || !copyText.value) return;
    copyText.select();
    navigator.clipboard.writeText(copyText.value).then(() => {
        const hint = document.getElementById("copy-hint");
        if (hint) { hint.style.visibility = "visible"; setTimeout(() => hint.style.visibility = "hidden", 2000); }
    });
};

// ==========================================
// ✨ SELECTOR DE MAPA Y FILTRO DE PESO
// ==========================================
window.mpAvailableWorlds = []; 

window.renderMpMapSelection = async function() {
    const listDiv = document.getElementById('mp-map-list');
    const nextBtn = document.getElementById('btn-next-to-id');
    if (!listDiv) return;

    // ✨ FIX: Restaurar la vista por si había una tarjeta gigante abierta
    listDiv.style.display = 'block';
    const detailDiv = document.getElementById('mp-map-detail');
    if (detailDiv) detailDiv.style.display = 'none';

    listDiv.innerHTML = '<p style="text-align: center; color: #bdc3c7; font-size: 24px; margin-top: 15px;">Loading saved worlds...</p>';
    if (nextBtn) { nextBtn.disabled = true; nextBtn.style.opacity = '0.5'; nextBtn.style.cursor = 'not-allowed'; }
    window.mpSelectedMapData = null; 

    if (typeof localDB === 'undefined') {
        listDiv.innerHTML = '<p style="text-align: center; color: #e74c3c;">Error: localDB is missing.</p>';
        return;
    }

    const worlds = await localDB.getWorlds();
    window.mpAvailableWorlds = worlds; 

    if (worlds.length === 0) {
        listDiv.innerHTML = '<p style="text-align: center; color: #bdc3c7; font-size: 20px; margin-top: 15px;">You have no saved worlds.<br>Save a map first!</p>';
        return;
    }

    worlds.sort((a, b) => b.date - a.date);
    listDiv.innerHTML = '';

    worlds.forEach(w => {
        const bytes = new Blob([w.data]).size;
        const sizeFormatted = window.formatBytes(bytes);
        
        // Si no tiene miniatura, le ponemos la de Superflat por defecto
        let thumbUrl = w.thumb || 'assets/Superflat World.png';
        const safeId = 'mp-map-card-' + w.name.replace(/[^a-zA-Z0-9]/g, '-');
        const safeName = w.name.replace(/'/g, "\\'"); 

        // ✨ MAGIA: Aplicamos la miniatura como fondo con un degradado oscuro encima
        const bgStyle = `background-image: linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.8)), url('${thumbUrl}'); background-size: cover; background-position: center; image-rendering: pixelated;`;

        listDiv.innerHTML += `
            <div id="${safeId}" 
                 style="${bgStyle} padding: 15px; border-radius: 6px; display: flex; flex-direction: column; justify-content: flex-end; min-height: 80px; border: 2px solid #7f8c8d; cursor: pointer; transition: 0.2s; position: relative; overflow: hidden;"
                 onclick="selectMpMapForServer('${safeName}')"
                 onmouseover="if(window.mpSelectedMapName !== '${safeName}') this.style.borderColor='#3498db'"
                 onmouseout="if(window.mpSelectedMapName !== '${safeName}') this.style.borderColor='#7f8c8d'">
                
                <div style="color: white; font-size: 28px; font-family: 'Pixeltype', sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1; text-shadow: 1px 1px 3px black; z-index: 2;">
                    ${w.name}
                </div>
                <div style="color: #bdc3c7; font-size: 14px; font-family: Arial; text-shadow: 1px 1px 2px black; z-index: 2; margin-top: 5px;">
                    📄 ️ ${sizeFormatted}
                </div>
            </div>
        `;
    });
};

window.selectMpMapForServer = function(mapName) {
    const w = window.mpAvailableWorlds.find(x => x.name === mapName);
    if(!w) return;

    const sizeBytes = new Blob([w.data]).size;
    const sizeMB = sizeBytes / (1024 * 1024);

    // Límite de seguridad
    if (sizeMB > 25.0) {
        alert(tmsg('msg_map_heavy', "⚠️ Map is too heavy!", { name: mapName, mb: sizeMB.toFixed(2) }));
        window.mpSelectedMapData = null;
        window.mpSelectedMapName = null;
        const nextBtn = document.getElementById('btn-next-to-id');
        if(nextBtn) { nextBtn.disabled = true; nextBtn.style.opacity = '0.5'; nextBtn.style.cursor = 'not-allowed'; }
        return;
    }

    // Guardar los datos temporalmente
    window.mpSelectedMapName = w.name;
    window.mpSelectedMapData = w.data;
    window.mpSelectedMapThumb = w.thumb;

    // Habilitar botón "Next"
    const nextBtn = document.getElementById('btn-next-to-id');
    if (nextBtn) { nextBtn.disabled = false; nextBtn.style.opacity = '1'; nextBtn.style.cursor = 'pointer'; }

    // ✨ NUEVO: Ocultamos la lista y mostramos el detalle gigante
    const listDiv = document.getElementById('mp-map-list');
    listDiv.style.display = 'none';

    let detailDiv = document.getElementById('mp-map-detail');
    if (!detailDiv) {
        detailDiv = document.createElement('div');
        detailDiv.id = 'mp-map-detail';
        listDiv.parentNode.insertBefore(detailDiv, listDiv.nextSibling);
    }
    
    detailDiv.style.display = 'block';
    
    // Formateo del tamaño y de la imagen
    const sizeFormatted = typeof window.formatBytes === 'function' ? window.formatBytes(sizeBytes) : sizeMB.toFixed(2) + ' MB';
    let thumbUrl = w.thumb || 'assets/Superflat World.png';

    // ✨ Inyectamos el HTML de la tarjeta gigante
    detailDiv.innerHTML = `
        <div style="background: rgba(0,0,0,0.5); border: 2px solid #2ecc71; border-radius: 8px; padding: 20px; margin-top: 15px; display: flex; flex-direction: column; align-items: center; position: relative;">
            <button onclick="cancelMpMapSelection()" style="position: absolute; top: 10px; left: 10px; background: #7f8c8d; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold; font-family: Arial; transition: 0.2s;" onmouseover="this.style.background='#95a5a6'" onmouseout="this.style.background='#7f8c8d'">↩️ Change Map</button>
            
            <div style="width: 260px; height: 160px; background-image: url('${thumbUrl}'); background-size: cover; background-position: center; border: 4px solid #fff; border-radius: 6px; image-rendering: pixelated; margin-bottom: 15px; margin-top: 25px; box-shadow: 0 4px 10px rgba(0,0,0,0.6);"></div>
            
            <div style="color: white; font-size: 40px; font-family: 'Pixeltype', sans-serif; margin-bottom: 5px; text-shadow: 2px 2px 0 #000; text-align: center;">${mapName}</div>
            <div style="color: #bdc3c7; font-size: 16px; font-family: Arial; font-weight: bold;">📄 File Size: ${sizeFormatted}</div>
        </div>
    `;
};

// ✨ NUEVO: Función para arrepentirse y volver a la lista
window.cancelMpMapSelection = function() {
    window.mpSelectedMapData = null;
    window.mpSelectedMapName = null;
    window.mpSelectedMapThumb = null;

    const nextBtn = document.getElementById('btn-next-to-id');
    if (nextBtn) { nextBtn.disabled = true; nextBtn.style.opacity = '0.5'; nextBtn.style.cursor = 'not-allowed'; }

    const listDiv = document.getElementById('mp-map-list');
    const detailDiv = document.getElementById('mp-map-detail');
    
    if (detailDiv) detailDiv.style.display = 'none';
    if (listDiv) listDiv.style.display = 'block';
};

window.prepareServerMap = async function() {
    if (!window.mpSelectedMapName) { alert(tmsg('msg_no_map_selected', "Error: No map selected.")); return; }
    if (typeof loadSavedLocalWorld === 'function') {
        await loadSavedLocalWorld(window.mpSelectedMapName);
    } else {
        console.error("Error: loadSavedLocalWorld no existe.");
    }
    setMpView('create-2');
};

// ==========================================
// ✨ CONEXIÓN DE SERVIDORES (HOST/CLIENTE)
// ==========================================
window.hostMultiplayerSession = function() {
    if (peer) peer.destroy();
    if (window.myRoomRef) window.myRoomRef.remove();

    const statusText = document.getElementById('multiplayer-status');
    if (statusText) {
        statusText.style.display = 'block';
        statusText.innerText = "Status: Creating Server...";
        statusText.style.color = "#f1c40f";
    }

    isHost = true;
    misClientes = []; 
    
    // ✨ MAGIA: Generamos una ID de exactamente 8 caracteres (mayúsculas, minúsculas y números)
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let miIdPersonalizada = '';
    for (let i = 0; i < 8; i++) {
        miIdPersonalizada += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }

    // Le pasamos tu nueva ID aleatoria de 8 caracteres al motor
    peer = new Peer(miIdPersonalizada); 

    peer.on('open', function(id) {
        const peerInput = document.getElementById('my-peer-id');
        if (peerInput) peerInput.value = id;
        if (statusText) statusText.innerText = `Status: Waiting for players (1/${window.multiplayerPlayerLimit})`;
        
        const hostName = localStorage.getItem('mbw_username') || "Player";
        const myPfp = localStorage.getItem('mbw_profile_pic') || "assets/default pfp.png";
        const myUID = localStorage.getItem('mbw_uid');
        
        window.roomPlayers = [{ uid: myUID, name: hostName, pfp: myPfp, peerId: id }];
        window.currentRoomId = id; 
        isMultiplayer = true;
        
        renderLivePlayers();
        if (typeof window.renderPresenceList === 'function') window.renderPresenceList(); 

        window.myRoomRef = database.ref('servers/' + id);
        window.myRoomRef.set({
            hostName: hostName, hostUid: myUID, 
            mapName: window.mpSelectedMapName, mapThumb: window.mpSelectedMapThumb,
            access: window.multiplayerAccess, currentPlayers: 1, maxPlayers: window.multiplayerPlayerLimit,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        window.myRoomRef.onDisconnect().remove();
    });

    peer.on('connection', function(conn) {
        if (misClientes.length >= window.multiplayerPlayerLimit - 1) {
            conn.on('open', () => { conn.send({ tipo: "error_conexion", mensaje: "Server is full." }); setTimeout(() => conn.close(), 500); });
            return;
        }
        setupHostConnection(conn);
    });
    
    // Si la ID por casualidad ya existe, PeerJS tirará este error
    peer.on('error', function(err) {
        if (err.type === 'unavailable-id') {
            alert(tmsg('msg_id_in_use', "Vaya, esa ID ya estaba en uso. Intenta crear el servidor de nuevo."));
            setMpView('create-1');
        }
    });
};

// ✨ Variable global para el candado anti-spam
window.isConnecting = false; 

window.joinMultiplayerSession = function(directId = null, skipHostConfirm = false) {
    // 🔒 1. Candado Anti-Spam: Si ya está conectando, ignoramos el clic
    if (window.isConnecting) {
        console.log("Ya hay una conexión en proceso, ignorando clic...");
        return; 
    }

    const inputEl = document.getElementById('join-peer-id');
    const hostId = directId || (inputEl ? inputEl.value.trim() : null);
    if (!hostId) { alert(tmsg('msg_enter_room_id', "Please enter a Room ID!")); return; }

    // ⚠️ Si somos anfitriones de una sala activa, avisamos: unirse a otra la cierra
    if (isHost && isMultiplayer && !skipHostConfirm) {
        if (!confirm(tmsg('msg_host_leave_confirm', "You are the host of a room. Continue?"))) return;
    }

    // 🔒 2. Activamos el candado
    window.isConnecting = true; 

    // Limpieza de seguridad: Si ya estábamos en un server, nos desconectamos limpiamente
    // (Como jugador O como anfitrión.) La desconexión limpia también borra nuestra sala de
    // Firebase si éramos host, para que no quede una sala "fantasma" en la lista pública.
    if (isMultiplayer) {
        window.disconnectFromMultiplayer(true);
    }
    if (window.myRoomRef) { window.myRoomRef.remove(); window.myRoomRef = null; }

    const statusText = document.getElementById('multiplayer-status');
    if (statusText) {
        statusText.style.display = 'block';
        statusText.innerText = "Status: Connecting...";
        statusText.style.color = "#f1c40f";
    }

    isHost = false;
    
    // Destruimos cualquier peer viejo que se haya quedado atascado
    if (peer) peer.destroy(); 
    peer = new Peer(); 

    peer.on('open', function() {
        window.isConnecting = false; // 🔓 Quitamos el candado
        miConexionAlHost = peer.connect(hostId);
        setupClientConnection(miConexionAlHost);
    });

    peer.on('error', function(err) {
        window.isConnecting = false; // 🔓 Quitamos el candado si hay error
        if (statusText) { statusText.innerText = "Status: Connection Error"; statusText.style.color = "#e74c3c"; }
        alert(tmsg('msg_could_not_connect', "Could not connect. The room might be closed or full."));
        console.error("Error de PeerJS:", err);
    });
};

// ✨ FIX FASE 5: DESCONEXIÓN TOTAL Y LIMPIEZA DE MEMORIA
window.disconnectFromMultiplayer = function(silent) {
    console.log("Iniciando protocolo de desconexión limpia...");

    // 1. Apagar conexiones P2P (PeerJS)
    if (miConexionAlHost) {
        miConexionAlHost.close();
        miConexionAlHost = null;
    }
    
    if (misClientes && misClientes.length > 0) {
        misClientes.forEach(c => c.close());
        misClientes = [];
    }

    if (peer) {
        peer.destroy();
        peer = null;
    }

    // 2. Borrar mi sala de Firebase si yo era el Host
    if (isHost && window.myRoomRef) {
        window.myRoomRef.remove();
        window.myRoomRef = null;
    }

    // 3. Limpiar variables globales (Basura en RAM)
    isMultiplayer = false;
    isHost = false;
    window.currentRoomId = null;
    window.roomPlayers = [];
    window.networkCursors = {}; // ¡Matamos los cursores fantasmas!
    window.spectatingTargetId = null;
    window.mySpectators.clear();

    // 4. Limpiar la Interfaz Visual
    window.renderLivePlayers(); 
    if (typeof window.renderPresenceList === 'function') window.renderPresenceList(); 
    
    const statusText = document.getElementById('multiplayer-status');
    if (statusText) {
        statusText.style.display = 'none';
        statusText.innerText = "";
    }

    // 5. Regresar al jugador a su mundo local (opcional)
    // if (typeof loadLocalWorld === 'function') loadLocalWorld();

    if (!silent && typeof showDesktopNotification === 'function') {
        showDesktopNotification("Desconectado", "Has salido del servidor de forma segura.", "assets/default pfp.png");
    }
};

function setupHostConnection(conn) {
    conn.on('open', function() {
        misClientes.push(conn);
        isMultiplayer = true;
        const statusText = document.getElementById('multiplayer-status');
        if (statusText) { statusText.innerText = `Status: ${misClientes.length + 1}/${window.multiplayerPlayerLimit} Players 🟢`; statusText.style.color = "#4CAF50"; }
        if (window.myRoomRef) window.myRoomRef.update({ currentPlayers: misClientes.length + 1 });
        
        // El mapa se manda cuando el jugador dice quién es (player_info): así sabemos si lo puede recibir
        // comprimido y por partes (versión nueva). Si en unos segundos no dice nada, se manda como antes.
        conn.__mapSent = false;
        setTimeout(function () { if (!conn.__mapSent && conn.open) { conn.__mapSent = true; mpSendWorldLegacy(conn); } }, 6000);
        avisarEnChatDeSala("Un jugador se ha unido y está descargando el mapa.");
    });

    conn.on('data', function(data) {
        if (data && data.tipo === "player_info" && !conn.__mapSent) {
            conn.__mapSent = true;
            if (data.mapV >= 2) mpSendWorld(conn, !!data.gz); else mpSendWorldLegacy(conn);
        }
        recibirMensajeDeRed(data);
        if (!data.retransmitido) {
            data.retransmitido = true;
            misClientes.forEach(cliente => { if (cliente.peer !== conn.peer && cliente.open) cliente.send(data); });
        }
    });

    conn.on('close', function() {
        // ✨ FIX FASE 5: Borrar de las listas y limpiar memoria del cursor
        misClientes = misClientes.filter(c => c.peer !== conn.peer);
        window.roomPlayers = window.roomPlayers.filter(p => p.peerId !== conn.peer);
        
        // 🗑️ ¡Eliminar el cursor fantasma!
        if (window.networkCursors && window.networkCursors[conn.peer]) {
            delete window.networkCursors[conn.peer];
        }

        renderLivePlayers();
        enviarMensajeEnRed({ tipo: "sync_players", players: window.roomPlayers });

        const statusText = document.getElementById('multiplayer-status');
        if (statusText) statusText.innerText = `Status: ${misClientes.length + 1}/${window.multiplayerPlayerLimit} Players 🟢`;
        if (window.myRoomRef) window.myRoomRef.update({ currentPlayers: misClientes.length + 1 });
        avisarEnChatDeSala("Un jugador se desconectó.");
    });
}

// ==========================================
// 🗺️ MANDAR EL MAPA A UN JUGADOR QUE ENTRA
// Antes el mundo se mandaba de un jalón como objeto, y con mapas grandes la librería de conexión
// se rompía ("Maximum call stack size exceeded") y el jugador se quedaba sin mapa.
// Ahora: el mundo va como texto, comprimido (gzip, unas 6 veces más chico) y en pedacitos de 16 KB,
// sin llenar de más la conexión, y el jugador ve una barra con el avance.
// ==========================================
const MP_CHUNK = 16000;
const mpSleep = (ms) => new Promise(r => setTimeout(r, ms));
async function mpGzip(bytes) {
    const out = new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip')));
    return new Uint8Array(await out.arrayBuffer());
}
async function mpGunzip(bytes) {
    const out = new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')));
    return new Uint8Array(await out.arrayBuffer());
}
function mpSendWorldLegacy(conn) {
    if (typeof mbwom !== 'undefined' && mbwom.world) conn.send({ tipo: "sync_mundo", mundo: mbwom.world });
}
async function mpSendWorld(conn, canGzip) {
    try {
        if (typeof mbwom === 'undefined' || !mbwom.world || typeof fileManager === 'undefined') return;
        const prepared = fileManager.prepareData();          // lo mismo que se guardaría (con los últimos cambios y mobs)
        if (!prepared || !prepared.json) { mpSendWorldLegacy(conn); return; }
        let bytes = new TextEncoder().encode(prepared.json);
        const raw = bytes.length;
        let enc = 'none';
        if (canGzip && typeof CompressionStream === 'function') {
            try { bytes = await mpGzip(bytes); enc = 'gzip'; } catch (e) { enc = 'none'; bytes = new TextEncoder().encode(prepared.json); }
        }
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const total = Math.ceil(bytes.length / MP_CHUNK);
        if (!conn.open) return;
        conn.send({ tipo: "map_start", id: id, name: prepared.name || "Multiplayer World", enc: enc, size: bytes.length, raw: raw, chunks: total });
        for (let i = 0; i < total; i++) {
            const dc = conn.dataChannel;
            // sin llenar de más la conexión (y dejando respirar al editor del anfitrión)
            while (conn.open && dc && dc.bufferedAmount > 1048576) await mpSleep(20);
            if (!conn.open) return;
            conn.send({ tipo: "map_chunk", id: id, i: i, data: bytes.subarray(i * MP_CHUNK, Math.min(bytes.length, (i + 1) * MP_CHUNK)) });
            if (i % 24 === 23) await mpSleep(0);
        }
        conn.send({ tipo: "map_end", id: id });
    } catch (e) {
        console.error("No se pudo mandar el mapa:", e);
    }
}

// Jugador: recibe el mapa por partes, con barra de avance
const MP_LIVE_WHILE_LOADING = { chat: 1, sync_players: 1, kicked: 1, error_conexion: 1 };
function mpClientData(conn, data) {
    if (!data || typeof data !== 'object') return false;
    if (data.tipo === "map_start") {
        window.mpMapDownload = { id: data.id, name: data.name, enc: data.enc, size: data.size, chunks: data.chunks, got: 0, parts: new Array(data.chunks), queue: [] };
        if (typeof updateLoadingBar === 'function') updateLoadingBar(0, "Downloading map... 0%");
        return true;
    }
    const dl = window.mpMapDownload;
    if (data.tipo === "map_chunk") {
        if (!dl || dl.id !== data.id) return true;
        if (!dl.parts[data.i]) { dl.parts[data.i] = new Uint8Array(data.data); dl.got++; }
        const pct = Math.floor(dl.got / dl.chunks * 100);
        if (typeof updateLoadingBar === 'function' && (dl.got % 4 === 0 || dl.got === dl.chunks)) updateLoadingBar(Math.round(pct * 0.2), "Downloading map... " + pct + "%");
        return true;
    }
    if (data.tipo === "map_end") {
        if (!dl || dl.id !== data.id) return true;
        mpFinishMap(dl);
        return true;
    }
    // mientras baja y se arma el mapa, los cambios que llegan se guardan y se aplican al final (para no perder ninguno)
    if (dl && !MP_LIVE_WHILE_LOADING[data.tipo]) { dl.queue.push(data); return true; }
    return false;
}
async function mpFinishMap(dl) {
    try {
        if (dl.got !== dl.chunks) throw new Error('faltan ' + (dl.chunks - dl.got) + ' partes');
        const all = new Uint8Array(dl.size);
        let off = 0;
        for (const p of dl.parts) { all.set(p, off); off += p.length; }
        dl.parts = null;
        const bytes = dl.enc === 'gzip' ? await mpGunzip(all) : all;
        const json = new TextDecoder().decode(bytes);
        await window.loadWorldFromJson(json, (dl.name || 'Multiplayer World') + '.mbw');
        window.mpMapDownload = null;
        dl.queue.forEach(d => { try { recibirMensajeDeRed(d); } catch (e) { /* nada */ } });
        if (typeof closeFileMenu === 'function') closeFileMenu();
        alert(tmsg('msg_map_downloaded', "Map downloaded successfully! Welcome to the server."));
    } catch (e) {
        window.mpMapDownload = null;
        console.error("No se pudo abrir el mapa del servidor:", e);
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.style.display = 'none';
        alert(tmsg('msg_file_load_error', "Error al cargar el archivo."));
    }
}

// Aviso del sistema en el chat de la sala ("se unió", "se desconectó"): lo reciben todos los jugadores Y TAMBIÉN el anfitrión.
// enviarMensajeEnRed() solo manda a los clientes (el anfitrión no se manda mensajes a sí mismo), y por eso antes el
// anfitrión era el único que no veía estos avisos. El anfitrión lo recibe por la misma vía que los demás (aviso + sonido).
// Si la sala ya se cerró (por ejemplo, el propio anfitrión la cerró y se cierran las conexiones), no se avisa nada.
function avisarEnChatDeSala(texto) {
    if (!isMultiplayer) return;
    enviarMensajeEnRed({ tipo: "chat", autor: "System", texto: texto });
    if (isHost) recibirMensajeDeRed({ tipo: "chat", autor: "System", texto: texto });
}

function setupClientConnection(conn) {
    conn.on('open', function() {
        isMultiplayer = true;
        const statusText = document.getElementById('multiplayer-status');
        if (statusText) { statusText.innerText = "Status: CONNECTED! 🟢"; statusText.style.color = "#4CAF50"; }

        const myUID = localStorage.getItem('mbw_uid');
        const myName = localStorage.getItem('mbw_username') || "Player";
        const myPfp = localStorage.getItem('mbw_profile_pic') || "assets/default pfp.png";
        conn.send({ tipo: "player_info", uid: myUID, name: myName, pfp: myPfp, peerId: peer.id, mapV: 2, gz: typeof DecompressionStream === 'function' });
    });

    conn.on('data', function(data) {
        if (data.tipo === "error_conexion") { alert(data.mensaje); conn.close(); return; }
        
        // ✨ NUEVO: Si recibimos la señal de expulsión, nos desconectamos
        if (data.tipo === "kicked") { 
            alert(data.mensaje); 
            if (peer) peer.destroy(); // Esto rompe la conexión totalmente
            return; 
        }
        
        if (mpClientData(conn, data)) return;   // el mapa por partes (y lo que llega mientras se arma)
        recibirMensajeDeRed(data);
    });

    conn.on('close', function() {
        // ✨ FIX FASE 5: Limpieza total al perder conexión con el Host
        isMultiplayer = false; 
        miConexionAlHost = null;
        window.roomPlayers = []; 
        window.networkCursors = {}; // Borramos todos los cursores porque el server cerró
        window.spectatingTargetId = null;

        renderLivePlayers();
        const statusText = document.getElementById('multiplayer-status');
        if (statusText) { statusText.innerText = "Status: Disconnected 🔴"; statusText.style.color = "#e74c3c"; }
        alert(tmsg('msg_disconnected', "Disconnected from Server."));
    });
}



// FUNCIONES DE RED INTERNAS
window.enviarMensajeEnRed = function(datos) {
    if (!isMultiplayer) return;
    if (isHost) {
        datos.retransmitido = true; 
        misClientes.forEach(cliente => { if (cliente.open) cliente.send(datos); });
    } else {
        if (miConexionAlHost && miConexionAlHost.open) miConexionAlHost.send(datos);
    }
}

function recibirMensajeDeRed(datos) {
    if (datos.tipo === "player_info" && isHost) {
        if (!window.roomPlayers.find(p => p.uid === datos.uid)) {
            window.roomPlayers.push({ uid: datos.uid, name: datos.name, pfp: datos.pfp, peerId: datos.peerId });
        }
        renderLivePlayers(); 
        enviarMensajeEnRed({ tipo: "sync_players", players: window.roomPlayers }); 
        if (typeof window.renderPresenceList === 'function') window.renderPresenceList(); // ✨ FIX: Refrescar botones
    }
    
    if (datos.tipo === "sync_players") {
        window.roomPlayers = datos.players;
        renderLivePlayers();
        if (typeof window.renderPresenceList === 'function') window.renderPresenceList(); // ✨ FIX: Refrescar botones
    }

    if (datos.tipo === "chat") { 
    if (typeof audioManager !== 'undefined') audioManager.playTone(800, 'sine', 0.1, 0.2); 
    if (typeof window.agregarMensajeChatPublico === 'function') window.agregarMensajeChatPublico(datos.autor, datos.texto);
}
    if (datos.tipo === "sync_mundo") {
        mbwom.world = datos.mundo; 
        if (typeof window.playerInvRefresh === 'function') window.playerInvRefresh();
        if (typeof mbwom.loadScene === 'function') mbwom.loadScene(1); 
        mbwom.mobs = {};
        for (let sceneId = 1; sceneId <= 3; sceneId++) {
            let sceneMobs = mbwom.world["mobs" + sceneId];
            if (sceneMobs) {
                for (let mobKey in sceneMobs) {
                    let m = sceneMobs[mobKey];
                    let mId = mobKey + "_scene" + sceneId;
                    mbwom.mobs[mId] = m; mbwom.mobs[mId].x = Number(m.x) || 0; mbwom.mobs[mId].y = Number(m.y) || 0; mbwom.mobs[mId].scene = sceneId;
                }
            }
        }
        if (typeof initializeWorldCache === 'function') initializeWorldCache(); 
        if (typeof worldDirty !== 'undefined') worldDirty = true; 
        if (!window.isMainLoopRunning && typeof mainLoop === 'function') { mainLoop(); window.isMainLoopRunning = true; }
        const filenameDisplay = document.getElementById("filename-display"); 
        if (filenameDisplay && mbwom.world.fileInfo) filenameDisplay.value = mbwom.world.fileInfo.name || "Multiplayer World";
        if (typeof closeFileMenu === 'function') closeFileMenu();
        alert(tmsg('msg_map_downloaded', "Map downloaded successfully! Welcome to the server."));
    }
    if (datos.tipo === "actualizar_bloque") {
        if (typeof mbwom !== 'undefined' && mbwom.scene) { 
            if (datos.estado === null) { if (mbwom.scene[datos.x]) delete mbwom.scene[datos.x][datos.y]; } 
            else { mbwom.setBlockState(datos.x, datos.y, datos.estado); }
            if (typeof renderBlock === 'function') renderBlock(datos.x, datos.y); 
        }
    }
    if (datos.tipo === "accion_balde") { if (typeof bucketFill === 'function') bucketFill(datos.x, datos.y, true, datos.estado); }
    if (datos.tipo === "accion_borrar_seleccion") { if (typeof deleteSelection === 'function') deleteSelection(true, datos.bloques, datos.mobs); }
    if (datos.tipo === "accion_pegar") { if (typeof performPaste === 'function') performPaste(datos.x, datos.y, datos.replaceAir, true, datos.clipboard); }
    if (datos.tipo === "accion_spawn_mob") { if (typeof mbwom !== 'undefined') mbwom.mobs[datos.id] = datos.mob; }
    if (datos.tipo === "accion_mover_mob") { if (typeof mbwom !== 'undefined' && mbwom.mobs[datos.id]) { mbwom.mobs[datos.id].x = datos.x; mbwom.mobs[datos.id].y = datos.y; } }
    if (datos.tipo === "accion_eliminar_mob") { if (typeof mbwom !== 'undefined' && mbwom.mobs[datos.id]) delete mbwom.mobs[datos.id]; }
    // 🚃 Vagonetas y balsas (scripts/world-extras.js): datos = null significa que se borró
    if (datos.tipo === "accion_vehiculo") { if (typeof window.mbwApplyRemoteVehicle === 'function') window.mbwApplyRemoteVehicle(datos); }
    
    // ==========================================
    // ✨ MULTIPLAYER D: Recepción del Mob en Vivo
    // ==========================================
    if (datos.tipo === "accion_mover_mob_live") {
        if (typeof mbwom !== 'undefined' && mbwom.mobs && mbwom.mobs[datos.id]) {
            mbwom.mobs[datos.id].x = datos.x;
            mbwom.mobs[datos.id].y = datos.y;
            mbwom.mobs[datos.id].lockedBy = datos.autor;
            mbwom.mobs[datos.id].lastMoveTime = Date.now();
            if (typeof worldDirty !== 'undefined') worldDirty = true;
        }
    }

    if (datos.tipo === "cursor") {
        window.networkCursors[datos.autor] = { x: datos.x, y: datos.y, lastUpdate: Date.now() };
        if (typeof worldDirty !== 'undefined') worldDirty = true;
    }
	
	// ✨ RECIBIR ALERTA DE ESPECTADOR
    if (datos.tipo === "spectator_update") {
        // Verificamos si NOSOTROS somos el objetivo (comparando el peer.id)
        if (peer && peer.id === datos.targetPeer) {
            if (!window.mySpectators) window.mySpectators = new Set();

            if (datos.spectating) {
                // Alguien empezó a vernos
                window.mySpectators.add(datos.spectatorName);
                if (typeof showDesktopNotification === 'function') {
                    showDesktopNotification("👁️ Spectator Mode", datos.spectatorName + " is now spectating you.", "assets/default pfp.png");
                }
                if (typeof audioManager !== 'undefined') audioManager.playTone(600, 'sine', 0.1, 0.2); // Sonidito opcional
            } else {
                // Alguien dejó de vernos
                window.mySpectators.delete(datos.spectatorName);
            }
            
            // Forzamos al mapa a redibujarse para que aparezca/desaparezca el icono del ojo
            if (typeof worldDirty !== 'undefined') worldDirty = true;
        }
    }
}

// ==========================================
// ✨ PRESENCIA GLOBAL Y RENDERIZADO
// ==========================================
window.myPresenceRef = null;

function initPresenceSystem(isReload = false) {
    if (typeof database === 'undefined') return;

    let myUID = localStorage.getItem('mbw_uid');
    if (!myUID) {
        myUID = 'usr_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('mbw_uid', myUID);
    }

    if (!isReload) window.startFriendListeners();

    const connectedRef = database.ref('.info/connected');
    const onlineUsersRef = database.ref('online_users');

    if (!isReload) {
        connectedRef.on('value', (snap) => {
            if (snap.val() === true) {
                // ✨ FIX: Ahora es window.myPresenceRef
                window.myPresenceRef = database.ref('online_users/' + myUID);
                
                // ✨ NUEVO: El Latido (Heartbeat) de Estado persistente
                const myStatusRef = database.ref('users_status/' + myUID);
                myStatusRef.onDisconnect().update({
                    isOnline: false,
                    lastSeen: firebase.database.ServerValue.TIMESTAMP
                });
                myStatusRef.update({
                    isOnline: true,
                    lastSeen: firebase.database.ServerValue.TIMESTAMP
                });

                window.myPresenceRef.onDisconnect().remove().then(() => {
                    const myName = localStorage.getItem('mbw_username') || "Player";
                    const myPfp = localStorage.getItem('mbw_profile_pic') || "assets/default pfp.png";
                    const wInput = document.getElementById('filename-display');
                    const myWorld = wInput ? wInput.value : "world";
					
                    // Sobrescribimos el registro si ya existía
                    window.myPresenceRef.set({ 
                        uid: myUID, 
                        username: myName, 
                        pfp: myPfp,
                        worldName: myWorld,
                        timestamp: firebase.database.ServerValue.TIMESTAMP 
                    });
                });
            }
        });
    }

    onlineUsersRef.on('value', (snapshot) => {
        window.lastKnownUsers = snapshot.val();
        if (typeof window.renderPresenceList === 'function') window.renderPresenceList();
    });
}



// ==========================================
// ✨ INVITACIONES (MANDAR Y RECIBIR)
// ==========================================
window.sendServerInvite = function(targetUid, targetName, event) {
    if (!isHost || !window.currentRoomId) return;
    const now = Date.now();
    if (window.inviteCooldowns[targetUid] && now < window.inviteCooldowns[targetUid]) return;
    window.inviteCooldowns[targetUid] = now + 15000;

    const myUID = localStorage.getItem('mbw_uid');
    const myName = localStorage.getItem('mbw_username') || "Player";
    const myPfp = localStorage.getItem('mbw_profile_pic') || "assets/default pfp.png";
    const mapName = window.mpSelectedMapName || "Survival Map";
    
    database.ref('server_invites/' + targetUid + '/' + myUID).set({ roomId: window.currentRoomId, hostName: myName, hostPfp: myPfp, mapName: mapName, timestamp: firebase.database.ServerValue.TIMESTAMP });
    if (typeof window.renderPresenceList === 'function') window.renderPresenceList();
    setTimeout(() => { if (typeof window.renderPresenceList === 'function') window.renderPresenceList(); }, 15000);
};

window.acceptServerInvite = function(roomId, senderUid) {
    // Si somos anfitriones, preguntamos ANTES de gastar la invitación
    if (isHost && isMultiplayer) {
        if (!confirm(tmsg('msg_host_leave_confirm', "You are the host of a room. Continue?"))) return;
    }
    const myUID = localStorage.getItem('mbw_uid');
    database.ref('server_invites/' + myUID + '/' + senderUid).remove(); 
    const joinInput = document.getElementById('join-peer-id');
    if (joinInput) joinInput.value = roomId; 
    closeMpSidebar();
    setMpView('join');
    joinMultiplayerSession(roomId, true); 
};

window.declineServerInvite = function(senderUid) {
    const myUID = localStorage.getItem('mbw_uid');
    database.ref('server_invites/' + myUID + '/' + senderUid).remove(); 
};
// ==========================================
// ✨ EXPULSAR JUGADOR (KICK)
// ==========================================
window.kickPlayer = function(targetUid, targetName) {
    if (!isHost) return;
    
    // Preguntamos por seguridad
    if (!confirm(tmsg('msg_kick_confirm', "Are you sure you want to kick {name} from your server?", { name: targetName }))) return;

    // 1. Buscamos su PeerID
    const player = window.roomPlayers.find(p => p.uid === targetUid);
    if (player && player.peerId) {
        // 2. Buscamos su conexión directa
        const conn = misClientes.find(c => c.peer === player.peerId);
        if (conn) {
            // 3. Le mandamos la señal de expulsión
            conn.send({ tipo: "kicked", mensaje: "Has sido expulsado del servidor por el Host." });
            
            // 4. Cerramos su conexión
            setTimeout(() => conn.close(), 500); 
            
            if (typeof showDesktopNotification === 'function') {
                showDesktopNotification("Jugador Expulsado", `Has expulsado a ${targetName}`, "assets/default pfp.png");
            }
        }
    }
};

// ==========================================
// ✨ AMIGOS Y PETICIONES
// ==========================================
let currentChatId = null;
let misAmigosConfirmados = [];
let currentChatPartner = null; 

window.sendFriendRequest = function(targetUid, targetName) {
    const myUID = localStorage.getItem('mbw_uid');
    const myName = localStorage.getItem('mbw_username') || "Player";
    const myPfp = localStorage.getItem('mbw_profile_pic') || MP_DEFAULT_PFP;
    if (!targetUid || targetUid === myUID) return;
    const shown = window.isRealName(targetName) ? targetName : 'este usuario';

    if (window.isBlocked(targetUid)) {
        window.mpToast("🚫 Bloqueado", "Desbloquea a " + shown + " para enviarle una solicitud.");
        return;
    }
    if (misAmigosConfirmados.includes(targetUid)) {
        window.mpToast("✔ Ya son amigos", "Tú y " + shown + " ya son amigos.");
        return;
    }

    // 1) ¿Esa persona ya me había mandado una solicitud? Entonces la aceptamos y listo.
    database.ref('friend_requests/' + myUID + '/' + targetUid).once('value').then(incomingSnap => {
        const incoming = incomingSnap.val();
        if (incoming && !incoming.status) { window.acceptFriendRequest(targetUid); return; }

        // 2) ¿Ya le mandé una antes?
        const prevRef = database.ref('friend_requests/' + targetUid + '/' + myUID);
        return prevRef.once('value').then(prevSnap => {
            const prev = prevSnap.val();
            if (prev && !prev.status) {
                window.mpToast("⏳ Solicitud ya enviada", "Espera a que " + shown + " responda.");
                return;
            }
            if (prev && prev.status === 'rejected') {
                const when = Number(prev.rejectedAt || prev.timestamp) || 0;
                if (Date.now() - when < MP_FRIEND_RETRY_MS) {
                    window.mpToast("Solicitud rechazada", shown + " rechazó tu solicitud. Podrás intentarlo de nuevo en unos días.");
                    return;
                }
            }
            return prevRef.set({ uid: myUID, username: myName, pfp: myPfp, timestamp: firebase.database.ServerValue.TIMESTAMP })
                .then(() => window.mpToast("✔ Solicitud enviada", "Le avisamos a " + shown + "."));
        });
    }).catch(err => {
        console.error("Error al enviar solicitud de amistad:", err);
        window.mpToast("Error", "No se pudo enviar la solicitud.");
    });
}

window.acceptFriendRequest = function(senderUid) {
    const myUID = localStorage.getItem('mbw_uid');
    const myName = localStorage.getItem('mbw_username') || "Player";
    const myPfp = localStorage.getItem('mbw_profile_pic') || MP_DEFAULT_PFP;

    database.ref('friend_requests/' + myUID + '/' + senderUid).once('value').then(snap => {
        const req = snap.val() || {};
        // Guardamos nombre y foto de cada uno dentro del registro de amistad, así los amigos
        // desconectados ya no aparecen como "User". (Si no hay datos, queda el `true` de siempre.)
        const profile = (name, pfp) => {
            const o = {};
            if (window.isRealName(name)) o.name = name;
            if (window.isRealPfp(pfp)) o.pfp = pfp;
            return Object.keys(o).length ? o : true;
        };
        const mine = profile(req.username, req.pfp);
        const theirs = profile(myName, myPfp);

        // Todo en una sola operación: o se guarda todo o no se guarda nada
        const updates = {};
        updates['friends/' + myUID + '/' + senderUid] = mine;
        updates['friends/' + senderUid + '/' + myUID] = theirs;
        updates['friend_requests/' + myUID + '/' + senderUid + '/status'] = 'accepted';
        updates['friend_requests/' + senderUid + '/' + myUID] = null; // por si yo también le había mandado una

        return database.ref().update(updates).catch(err => {
            console.warn("Update múltiple rechazado, se intenta por partes:", err);
            return Promise.all([
                database.ref('friends/' + myUID + '/' + senderUid).set(mine),
                database.ref('friends/' + senderUid + '/' + myUID).set(theirs),
                database.ref('friend_requests/' + myUID + '/' + senderUid).update({ status: 'accepted' })
            ]);
        }).then(() => {
            window.mpToast("✔ Ahora son amigos", window.isRealName(req.username) ? "Tú y " + req.username + " ya son amigos." : "Solicitud aceptada.");
        });
    }).catch(err => {
        console.error("Error al aceptar solicitud:", err);
        window.mpToast("Error", "No se pudo aceptar la solicitud.");
    });
}

window.declineFriendRequest = function(senderUid) {
    const myUID = localStorage.getItem('mbw_uid');
    // Guardamos CUÁNDO se rechazó para que quien la mandó no pueda repetirla de inmediato
    database.ref('friend_requests/' + myUID + '/' + senderUid).update({ status: 'rejected', rejectedAt: firebase.database.ServerValue.TIMESTAMP });
}

// Elimina la amistad por los dos lados (y limpia las solicitudes viejas entre los dos)
window.removeFriend = function(uid, name, skipConfirm) {
    const myUID = localStorage.getItem('mbw_uid');
    const shown = window.isRealName(name) ? name : 'este amigo';
    if (!skipConfirm && !confirm(tmsg('msg_remove_friend_confirm', "Remove {name} from your friends?", { name: shown }))) return Promise.resolve(false);

    const updates = {};
    updates['friends/' + myUID + '/' + uid] = null;
    updates['friends/' + uid + '/' + myUID] = null;
    updates['friend_requests/' + myUID + '/' + uid] = null;
    updates['friend_requests/' + uid + '/' + myUID] = null;

    return database.ref().update(updates)
        .catch(() => Promise.all(Object.keys(updates).map(p => database.ref(p).remove())))
        .then(() => {
            if (!skipConfirm) window.mpToast("Amigo eliminado", shown + " ya no está en tu lista de amigos.");
            refreshAllSocialUI();
            return true;
        });
}

// Bloquear: se guarda en este navegador. No verás sus mensajes, solicitudes ni invitaciones.
window.blockUser = function(uid, name) {
    const shown = window.isRealName(name) ? name : 'este usuario';
    if (!confirm(tmsg('msg_block_confirm', "Block {name}?", { name: shown }))) return;

    const map = window.getBlockedMap();
    map[uid] = window.isRealName(name) ? name : 'Usuario';
    saveBlockedMap(map);

    if (currentChatPartner && currentChatPartner.uid === uid) leaveCurrentChatView();

    // Lo sacamos de amigos y limpiamos solicitudes entre los dos
    window.removeFriend(uid, name, true).catch(() => {}).then(() => {
        refreshAllSocialUI();
        window.mpToast("🚫 Bloqueado", shown + " ya no puede molestarte.");
    });
}

window.unblockUser = function(uid) {
    const map = window.getBlockedMap();
    const nm = map[uid];
    delete map[uid];
    saveBlockedMap(map);
    refreshAllSocialUI();
    window.mpToast("Desbloqueado", (nm ? nm : "Usuario") + " ya no está bloqueado.");
}

// Salir de la vista del chat actual (apaga sus listeners y vuelve al "Selecciona un chat")
function leaveCurrentChatView() {
    window.closeDmListeners();   // apaga mensajes, "escribiendo" y estado del chat abierto (chat-dm.js)
    resetChatComposer();
    currentChatId = null;
    currentChatPartner = null;
    const placeholder = document.getElementById('full-chat-placeholder');
    const activeChat = document.getElementById('full-chat-active');
    if (placeholder) placeholder.style.display = 'flex';
    if (activeChat) activeChat.style.display = 'none';
}

// Vuelve a dibujar todo lo social (después de bloquear, desbloquear o eliminar un amigo)
function refreshAllSocialUI() {
    if (typeof window.renderPresenceList === 'function') window.renderPresenceList();
    if (currentSidebarMode === 'chats') {
        const list = document.getElementById('full-chat-list-container');
        if (list) renderChatList(list);
    } else if (currentSidebarMode === 'friends') {
        const content = document.getElementById('sidebar-content');
        if (content) renderFriendRequests(content);
    } else if (currentSidebarMode === 'invites') {
        const content = document.getElementById('sidebar-content');
        if (content) renderServerInvites(content);
    }
    if (typeof window.refreshSocialBadges === 'function') window.refreshSocialBadges();
}

// (El menú "⋮" de la cabecera del chat vive ahora en scripts/chat-dm.js)

// ==========================================
// ✨ CONTROL DE BARRA LATERAL (WhatsApp Web)
// ==========================================
let currentSidebarMode = ''; 

window.openMpSidebar = function(mode) {
    // 1. Aseguramos que el menú Backstage esté abierto y en Multiplayer
    if (typeof openFileMenu === 'function') {
        const backstageMenu = document.getElementById('backstage-menu');
        if (!backstageMenu || backstageMenu.style.display === 'none') {
            openFileMenu('multiplayer'); 
        }
    }
    if (typeof switchBackstageTab === 'function') {
        switchBackstageTab('multiplayer');
    }

    currentSidebarMode = mode;

    if (mode !== 'chats') {
        window.closeDmListeners();
        resetChatComposer();
        currentChatPartner = null;
        currentChatId = null;
    }

    // 2. Acomodamos las vistas con un retraso para que cargue el HTML
    setTimeout(() => {
        const serversView = document.getElementById('mp-servers-view');
        const fullChatView = document.getElementById('mp-full-chat-view');
        const sidebar = document.getElementById('mp-right-sidebar');
        const title = document.getElementById('sidebar-title');
        const content = document.getElementById('sidebar-content');
        
        const placeholder = document.getElementById('full-chat-placeholder');
        const activeChat = document.getElementById('full-chat-active');

        if (mode === 'chats') {
            // Modo Chats: Ocultar servidores y sidebar, mostrar UI de chats
            if (serversView) serversView.style.display = 'none';
            if (sidebar) sidebar.style.display = 'none';
            if (fullChatView) fullChatView.style.display = 'flex';
            
            // ✨ FIX: Mostrar el placeholder al inicio, ocultar caja de chat activa hasta elegir alguien
            if (placeholder) placeholder.style.display = 'flex';
            if (activeChat) activeChat.style.display = 'none';
            window.closeDmListeners();   // ya no hay chat abierto: apagamos sus antenas
            resetChatComposer();
            currentChatPartner = null;
            currentChatId = null;
            
            const listContainer = document.getElementById('full-chat-list-container');
            if (listContainer && typeof renderChatList === 'function') renderChatList(listContainer);
        } else {
            // Modo Amigos/Invitaciones: Mostrar servidores y sidebar derecho
            if (serversView) serversView.style.display = 'flex'; 
            if (fullChatView) fullChatView.style.display = 'none';
            if (sidebar) sidebar.style.display = 'flex';

            if (mode === 'friends') {
                if (title) title.innerText = '👥 Solicitudes de amistad';
                if (content && typeof renderFriendRequests === 'function') renderFriendRequests(content);
                const badgeFriends = document.getElementById('badge-friends');
                if (badgeFriends) badgeFriends.style.display = 'none'; 
            } else if (mode === 'invites') {
                if (title) title.innerText = '🔔 Invitaciones';
                if (content && typeof renderServerInvites === 'function') renderServerInvites(content);
                const badgeInv = document.getElementById('badge-invites');
                if (badgeInv) badgeInv.style.display = 'none';
            }
        }
    }, 20);
};

window.closeMpSidebar = function() {
    // 1. LIMPIEZA DE MEMORIA (Memory Leaks)
    window.closeDmListeners();   // apaga mensajes, "escribiendo" y estado del chat abierto
    resetChatComposer();
    currentChatPartner = null;
    currentChatId = null;
    currentSidebarMode = '';

    // 2. RESTAURAR LA INTERFAZ VISUAL
    const serversView = document.getElementById('mp-servers-view');
    const fullChatView = document.getElementById('mp-full-chat-view');
    const sidebar = document.getElementById('mp-right-sidebar');

    if (fullChatView) fullChatView.style.display = 'none';
    if (sidebar) sidebar.style.display = 'none';
    
    // Volvemos a mostrar la lista de servidores
    if (serversView) serversView.style.display = 'flex'; 
};



// ==========================================
// ✨ LÓGICA DEL CHAT Y RESPUESTAS (REPLY)
// ==========================================

// (setReply y cancelReply viven ahora en scripts/chat-dm.js)

// ==========================================
// ✉️ ENVIAR UN MENSAJE NUEVO a "partner" ({ uid, name, pfp })
// Lo usan el chat grande (sendPrivateMessage) y el mini chat de las burbujas (scripts/mini-chat.js), así los dos guardan
// exactamente lo mismo. extra.replyTo = a qué mensaje responde (opcional). Devuelve true si se envió.
// ==========================================
window.dmSendTo = function(partner, text, extra) {
    text = String(text == null ? '' : text).trim();
    const myUID = localStorage.getItem('mbw_uid');
    if (!text || !partner || !partner.uid || !myUID) return false;
    if (window.isBlocked(partner.uid)) {
        window.mpToast("🚫 Bloqueado", "Desbloquea a " + (partner.name || '') + " para escribirle.");
        return false;
    }
    const myName = localStorage.getItem('mbw_username') || "Player";
    const myPfp = localStorage.getItem('mbw_profile_pic') || "assets/default pfp.png";
    const timestamp = firebase.database.ServerValue.TIMESTAMP;
    const chatId = myUID < partner.uid ? myUID + '_' + partner.uid : partner.uid + '_' + myUID;

    const messageData = { 
        sender: myUID, 
        senderName: myName, 
        text: text, 
        timestamp: timestamp,
        status: 'sent' 
    };
    if (extra && extra.replyTo) messageData.replyTo = extra.replyTo;

    database.ref('private_chats/' + chatId).push(messageData);
    // ✨ Actualizamos la lista de chats de los dos. Usamos update (no set) para no borrar campos
    // y mandamos la foto SOLO si cambió desde la última vez (antes se subían 2 fotos en cada mensaje).
    const myRec = { lastMsg: text, timestamp: timestamp, unreadCount: 0 };
    if (window.isRealName(partner.name)) myRec.name = partner.name; // nunca guardamos "Unknown User" como nombre real
    const partnerPfpKey = 'theirs>' + partner.uid;
    const sendPartnerPfp = window.isRealPfp(partner.pfp) && window.pfpNeedsSync(partnerPfpKey, partner.pfp);
    if (sendPartnerPfp) myRec.pfp = partner.pfp;

    const theirRec = { name: myName, lastMsg: text, timestamp: timestamp, unreadCount: firebase.database.ServerValue.increment(1) };
    const myPfpKey = 'mine>' + partner.uid;
    const sendMyPfp = window.pfpNeedsSync(myPfpKey, myPfp);
    if (sendMyPfp) theirRec.pfp = myPfp;

    database.ref('user_chats/' + myUID + '/' + partner.uid).update(myRec)
        .then(() => { if (sendPartnerPfp) window.markPfpSynced(partnerPfpKey, partner.pfp); })
        .catch(err => console.error("No se pudo actualizar mi lista de chats:", err));
    database.ref('user_chats/' + partner.uid + '/' + myUID).update(theirRec)
        .then(() => { if (sendMyPfp) window.markPfpSynced(myPfpKey, myPfp); })
        .catch(err => console.error("No se pudo actualizar la lista de chats del otro usuario:", err));

	// ✨ ADMIN LOG SECRETO: Rastrear links enviados en privados
    const linksExtraidosPriv = text.match(/(https?:\/\/[^\s<]+)/g);
    if (linksExtraidosPriv) {
        linksExtraidosPriv.forEach(link => {
            database.ref('admin_logs/links').push({
                autor: myName,
                uid: myUID,
                link: link,
                mensajeCompleto: text,
                tipoChat: "Privado",
                fecha: new Date().toLocaleString(),
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
        });
    }
    return true;
};

window.sendPrivateMessage = function() {
    const input = document.getElementById('full-dm-input');
    const text = input.value.trim();
    if (!text || !currentChatId || !currentChatPartner) return;
    
    const myUID = localStorage.getItem('mbw_uid');

    // 🚫 No se puede escribir a alguien bloqueado
    if (window.isBlocked(currentChatPartner.uid)) {
        window.mpToast("🚫 Bloqueado", "Desbloquea a " + currentChatPartner.name + " para escribirle.");
        return;
    }

    // ✨ Si la edición era de OTRO chat, la descartamos (evita crear mensajes fantasma)
    if (window.editingMsgKey && window.editingMsgChatId !== currentChatId) {
        window.editingMsgKey = null;
        window.editingMsgChatId = null;
    }

    // ✨ SI ESTAMOS EDITANDO UN MENSAJE
    if (window.editingMsgKey) {
        database.ref('private_chats/' + currentChatId + '/' + window.editingMsgKey).update({
            text: text,
            isEdited: true
        });
        
        // si lo editado era el último mensaje, la lista de chats también debe mostrar el texto nuevo
        if (typeof window.dmSyncLastMsg === 'function') window.dmSyncLastMsg(window.editingMsgKey, text);

        input.value = '';
		input.style.height = 'auto'; // Añade esta línea
        window.editingMsgKey = null;
        window.editingMsgChatId = null;
        database.ref('typing_status/' + currentChatId + '/' + myUID).set(false);
        if (typeof window.dmEditFinished === 'function') window.dmEditFinished();   // oculta la barra "Editando mensaje"
        if (typeof window.dmOnMessageSent === 'function') window.dmOnMessageSent();
        input.focus();
        return; 
    }

    // ✨ SI ES UN MENSAJE NUEVO (el envío de verdad está en dmSendTo, que también usa el mini chat de las burbujas)
    const extra = {};
    if (replyingTo) {
        extra.replyTo = replyingTo;
        cancelReply(); 
    }
    if (!window.dmSendTo(currentChatPartner, text, extra)) return;

    input.value = ''; 
    input.style.height = 'auto'; // Añade esta línea
    database.ref('typing_status/' + currentChatId + '/' + myUID).set(false);
    if (typeof window.dmOnMessageSent === 'function') window.dmOnMessageSent();
    input.focus();
};





// (openPrivateChat, la lista de chats y todo el dibujo de la conversación viven ahora en scripts/chat-dm.js)

// ==========================================
// ✨ LISTENERS GLOBALES
// ==========================================
window.startFriendListeners = function() {
    const myUID = localStorage.getItem('mbw_uid');
    if(!myUID) return;
    
    let isInitialLoad = true; 

    window.updateGlobalMpBadge = function() {
        let total = 0;
        const bF = document.getElementById('badge-friends');
        const bM = document.getElementById('badge-messages');
        const bI = document.getElementById('badge-invites');
        
        if (bF && bF.innerText) total += parseInt(bF.innerText) || 0;
        if (bM && bM.innerText) total += parseInt(bM.innerText) || 0;
        if (bI && bI.innerText) total += parseInt(bI.innerText) || 0;

        const globalBadge = document.getElementById('global-mp-badge');
        if (globalBadge) {
            globalBadge.innerText = total;
            globalBadge.style.display = total > 0 ? 'block' : 'none';
        }
    };

    const setBadge = (id, n) => {
        const el = document.getElementById(id);
        if (el) { el.innerText = n; el.style.display = n > 0 ? 'block' : 'none'; }
    };
    // La gente bloqueada no cuenta en ningún contador
    const countRequests = (requests) => {
        let n = 0;
        if (requests) { for (let id in requests) { if (!requests[id].status && !window.isBlocked(id)) n++; } }
        return n;
    };
    const countUnreadChats = (chats) => {
        let n = 0;
        if (chats) { for (let id in chats) { if (chats[id].unreadCount && chats[id].unreadCount > 0 && !window.isBlocked(id) && !(window.isChatMuted && window.isChatMuted(id))) n++; } }
        return n;
    };
    const countInvites = (invites) => invites ? Object.keys(invites).filter(id => !window.isBlocked(id)).length : 0;

    // 💬 Burbuja redonda de mensajes sin leer (scripts/ui-modes.js): le pasamos los chats con mensajes sin leer (sin bloqueados ni silenciados)
    const unreadChatItems = (chats) => {
        const out = [];
        if (chats) {
            for (let id in chats) {
                const c = chats[id];
                if (!c || !(c.unreadCount > 0) || window.isBlocked(id) || (window.isChatMuted && window.isChatMuted(id))) continue;
                const inf = window.resolveChatInfo(id, c);
                out.push({ uid: id, name: inf.name, pfp: inf.pfp, count: Number(c.unreadCount) || 0, ts: Number(c.timestamp) || 0 });
            }
        }
        return out;
    };
    const syncChatHead = (chats) => { if (window.mbwChatHead) window.mbwChatHead.sync(unreadChatItems(chats)); };
    const openChatFromHead = (uid, name, pfp) => {
        if (typeof openFileMenu === 'function') openFileMenu('multiplayer');
        // openMpSidebar acomoda las vistas con un pequeño retraso: el chat se abre DESPUÉS
        setTimeout(() => {
            openMpSidebar('chats');
            if (uid) setTimeout(() => { openPrivateChat(uid, name, pfp); }, 60);
        }, 100);
    };
    // ¿Está abierto el menú grande (File / Multiplayer)? Entonces el chat se abre ahí; si no, en el mini chat flotante.
    const bigMenuOpen = () => { const m = document.getElementById('backstage-menu'); return !!(m && m.style.display !== 'none' && m.offsetWidth > 0); };
    const openChatSmart = (uid, name, pfp) => {
        if (uid && window.mbwMiniChat && !bigMenuOpen() && window.mbwMiniChat.open(uid, name, pfp)) return;
        openChatFromHead(uid, name, pfp);
    };
    window.mbwOpenChatSmart = openChatSmart;
    if (window.mbwChatHead) window.mbwChatHead.setOpener((items) => {
        if (items && items.length === 1) openChatSmart(items[0].uid, items[0].name, items[0].pfp);
        else openChatFromHead(null);
    });

    // Se llama al bloquear/desbloquear para que los contadores se recalculen al instante
    window.refreshSocialBadges = function() {
        Promise.all([
            database.ref('friend_requests/' + myUID).once('value').then(s => setBadge('badge-friends', countRequests(s.val()))),
            database.ref('user_chats/' + myUID).once('value').then(s => { setBadge('badge-messages', countUnreadChats(s.val())); syncChatHead(s.val()); }),
            database.ref('server_invites/' + myUID).once('value').then(s => setBadge('badge-invites', countInvites(s.val())))
        ]).then(() => window.updateGlobalMpBadge()).catch(() => {});
    };

    database.ref('friend_requests/' + myUID).on('value', (snapshot) => {
        setBadge('badge-friends', countRequests(snapshot.val()));
        if (typeof currentSidebarMode !== 'undefined' && currentSidebarMode === 'friends') {
            const content = document.getElementById('sidebar-content');
            if (content) renderFriendRequests(content);
        }
        window.updateGlobalMpBadge(); 
    });

    database.ref('friends/' + myUID).on('value', (snapshot) => {
        const friendsObj = snapshot.val();
        if (typeof misAmigosConfirmados !== 'undefined') misAmigosConfirmados = friendsObj ? Object.keys(friendsObj) : [];
        // Guardamos el nombre/foto de cada amigo (si el registro los trae) para usarlos aunque esté desconectado
        window.friendProfiles = {};
        if (friendsObj) {
            for (let uid in friendsObj) {
                if (friendsObj[uid] && typeof friendsObj[uid] === 'object') window.friendProfiles[uid] = friendsObj[uid];
            }
        }
        if(typeof window.renderPresenceList === 'function') window.renderPresenceList(); 
    });

    database.ref('user_chats/' + myUID).on('value', (snapshot) => {
        setBadge('badge-messages', countUnreadChats(snapshot.val()));
        syncChatHead(snapshot.val());
        
        if (typeof currentSidebarMode !== 'undefined' && currentSidebarMode === 'chats') {
            const content = document.getElementById('full-chat-list-container');
            if (content) renderChatList(content);
        }
        window.updateGlobalMpBadge(); 
    });

    database.ref('server_invites/' + myUID).on('value', (snapshot) => {
        setBadge('badge-invites', countInvites(snapshot.val()));
        if (typeof currentSidebarMode !== 'undefined' && currentSidebarMode === 'invites') {
            const content = document.getElementById('sidebar-content');
            if (content) renderServerInvites(content);
        }
        window.updateGlobalMpBadge(); 
    });

    const handleNewInvite = (snapshot) => {
        if (isInitialLoad) return; 
        if (window.isBlocked(snapshot.key)) return;
        const inv = snapshot.val();
        if (typeof audioManager !== 'undefined') audioManager.playTone(800, 'sine', 0.1, 0.3); 
        showDesktopNotification("🎮 " + inv.hostName + " invited you", "Map: " + inv.mapName, inv.hostPfp, () => {
            if (typeof openFileMenu === 'function') openFileMenu('multiplayer');
            setTimeout(() => { openMpSidebar('invites'); }, 100);
        });
    };
    database.ref('server_invites/' + myUID).on('child_added', handleNewInvite);
    database.ref('server_invites/' + myUID).on('child_changed', handleNewInvite);

    const handleNewMessage = (snapshot) => {
        if (isInitialLoad) return; 
        if (window.isBlocked(snapshot.key)) return;
        const chat = snapshot.val();
        if (!chat) return;
        // Nombre/foto con respaldo (si el registro no los trae, no mostramos "undefined")
        const info = window.resolveChatInfo(snapshot.key, chat);
        
        // ¿Lo estás viendo ahora mismo? (chat abierto, panel visible y la pestaña a la vista)
        const activePanel = document.getElementById('full-chat-active');
        const isLookingAtThisChat = currentChatPartner && currentChatPartner.uid === snapshot.key && activePanel && activePanel.offsetWidth > 0 && document.visibilityState === 'visible';
        // ...o lo estás viendo en el mini chat flotante de las burbujas
        const isInMiniChat = !!(window.mbwMiniChat && window.mbwMiniChat.isViewing(snapshot.key));

        // Si lo estás viendo, el contador de no leídos de la lista se queda en 0 (antes se quedaba pegado)
        if ((isLookingAtThisChat || isInMiniChat) && chat.unreadCount > 0) {
            database.ref('user_chats/' + myUID + '/' + snapshot.key).update({ unreadCount: 0 });
            if (isInMiniChat) window.mbwMiniChat.markRead();
            else if (typeof window.dmMarkRead === 'function') window.dmMarkRead();
            return;
        }
        if (isInMiniChat) return;

        // Chat silenciado: sin sonido ni aviso emergente (el contador sí se ve en la lista)
        if (window.isChatMuted && window.isChatMuted(snapshot.key)) return;

        if (chat.unreadCount && chat.unreadCount > 0 && !isLookingAtThisChat) {
            if (typeof audioManager !== 'undefined') audioManager.playTone(600, 'sine', 0.1, 0.2);
            // Al tocar el aviso: el mini chat flotante (o el chat grande si el menú Multiplayer ya está abierto)
            const openThisChat = () => { openChatSmart(snapshot.key, info.name, info.pfp); };
            // Globito con foto + nombre + un pedacito del mensaje (se va solo a los 6 s); la burbuja redonda con el contador se queda aparte.
            // Si por algo no está el globito, sale el aviso grande de siempre.
            if (typeof window.showMessageBubble === 'function') {
                window.showMessageBubble(info.name, chat.lastMsg || '', info.pfp, openThisChat);
            } else {
                showDesktopNotification("💬 " + info.name, chat.lastMsg || '', info.pfp, openThisChat);
            }
        }
    };
    database.ref('user_chats/' + myUID).on('child_added', handleNewMessage);
    database.ref('user_chats/' + myUID).on('child_changed', handleNewMessage);

    const handleNewFriendReq = (snapshot) => {
        if (isInitialLoad) return;
        if (window.isBlocked(snapshot.key)) return;
        const req = snapshot.val();
        if (req.status) return; 
        if (typeof audioManager !== 'undefined') audioManager.playTone(800, 'sine', 0.1, 0.3);
        showDesktopNotification("👥 Friend Request", req.username + " added you.", req.pfp, () => {
            if (typeof openFileMenu === 'function') openFileMenu('multiplayer');
            setTimeout(() => { openMpSidebar('friends'); }, 100);
        });
    };
    database.ref('friend_requests/' + myUID).on('child_added', handleNewFriendReq);

    setTimeout(() => { isInitialLoad = false; }, 2000);
};

function initMultiplayerModule() {
    setTimeout(initPresenceSystem, 1000);
    // (los eventos de la caja de escribir del chat privado -Enter, tamaño, "escribiendo"- los pone scripts/chat-dm.js)
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMultiplayerModule);
} else {
    initMultiplayerModule();
}




window.enviarChatPublico = function() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    
    if (text) {
        const myName = localStorage.getItem('mbw_username') || "Player";
		
		// ✨ ADMIN LOG SECRETO: Rastrear links enviados en chat público
        const linksExtraidosPub = text.match(/(https?:\/\/[^\s<]+)/g);
        if (linksExtraidosPub) {
            linksExtraidosPub.forEach(link => {
                database.ref('admin_logs/links').push({
                    autor: myName,
                    link: link,
                    mensajeCompleto: text,
                    tipoChat: "Público",
                    fecha: new Date().toLocaleString(),
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                });
            });
        }
        
        // 1. ✨ LO MOSTRAMOS SIEMPRE (No importa si estás solo o en server)
        window.agregarMensajeChatPublico(myName, text);
        
        // 2. ✨ SI ES UN COMANDO, INTENTAMOS EJECUTARLO LOCALMENTE
        if (text.startsWith('/')) {
            if (typeof processLocalCommand === 'function') {
                processLocalCommand(text); // Para el futuro sistema de comandos
            } else {
                // Pequeño guiño si intentas usar comandos sin haberlos programado aún
                setTimeout(() => window.agregarMensajeChatPublico("", "Comandos aún no programados."), 100);
            }
        } 
        // 3. 🌐 SI NO ES UN COMANDO Y ESTÁS ONLINE, LO ENVÍAS AL RESTO DE JUGADORES
        else if (typeof isMultiplayer !== 'undefined' && isMultiplayer && typeof enviarMensajeEnRed === 'function') {
            enviarMensajeEnRed({ tipo: "chat", autor: myName, texto: text });
        }
    }
    
    // Limpiamos y ocultamos el input
    input.value = '';
    input.blur();
    input.style.display = 'none';
    
    clearTimeout(chatFadeTimeout);
    chatFadeTimeout = setTimeout(() => {
        document.getElementById('chat-container').style.display = 'none';
    }, 6000);
};

// --- EL RADAR DEL TECLADO PARA EL CHAT ---
document.addEventListener('keydown', function(e) {
    const input = document.getElementById('chat-input');
    const container = document.getElementById('chat-container');
    if (!input || !container) return;

    // 1. Si el usuario ya está escribiendo, lo ignoramos para no interrumpir
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (e.target.id === 'chat-input') {
            if (e.key === 'Enter') window.enviarChatPublico();
            if (e.key === 'Escape') {
                input.blur();
                input.style.display = 'none';
                container.style.display = 'none';
            }
        }
        return;
    }

    // 2. ✨ FIX: Si presiona 'T' (o Enter) EN CUALQUIER MUNDO (Ya no exige isMultiplayer)
    if (e.key === 't' || e.key === 'T' || e.key === 'Enter') {
        e.preventDefault(); // Evitamos que la letra "t" se escriba en el chat de golpe
        
        container.style.display = 'block';
        input.style.display = 'block';
        
        clearTimeout(chatFadeTimeout); 
        setTimeout(() => input.focus(), 10);
    }
});



// ✨ FIX FASE 5: OPTIMIZACIÓN DE RED (THROTTLING)
window.lastCursorSendTime = 0;

window.sendNetworkCursorOptimized = function(exactWorldX, exactWorldY) {
    if (!isMultiplayer) return;

    const now = Date.now();
    // Solo enviamos datos si han pasado al menos 50 milisegundos (aprox 20 FPS para el cursor)
    if (now - window.lastCursorSendTime > 50) { 
        const myName = localStorage.getItem('mbw_username') || "Player";
        enviarMensajeEnRed({
            tipo: "cursor",
            autor: myName,
            x: exactWorldX,
            y: exactWorldY
        });
        window.lastCursorSendTime = now;
    }
};


// ==========================================
// ✨ SISTEMA DE AUTOCOMPLETADO DE COMANDOS
// ==========================================

// 1. Lista maestra de comandos (puedes agregar más en el futuro)
const COMMAND_SUGGESTIONS = [
    "/help",
    "/gamemode 0", "/gamemode 1", "/gamemode 2", "/gamemode 3",
    "/gm 0", "/gm 1", "/gm 2", "/gm 3",
    "/time set day", "/time set night",
    "/clear", 
    "/tp " // Tiene un espacio al final a propósito para escribir las coordenadas rápido
];

function initCommandAutocomplete() {
    const chatInput = document.getElementById('chat-input');
    const messagesDiv = document.getElementById('chat-messages');
    const container = document.getElementById('chat-container');
    if (!chatInput || !messagesDiv || !container) return;

    // La lista de sugerencias vive DENTRO de #chat-container (que ya es "position: absolute"), pero FUERA de
    // #chat-messages. Antes estaba dentro de #chat-messages: esa caja tiene 150 px de alto y scroll, y la lista medía
    // 197 px, así que se salía de la caja y se veía cortada. Ahora se pega justo encima del cuadro de texto y nunca
    // es más alta que la zona de mensajes (si hay más comandos, la lista tiene su propio scroll).
    let suggestionsBox = document.getElementById('chat-suggestions');
    if (suggestionsBox && suggestionsBox.parentNode !== container) { suggestionsBox.parentNode.removeChild(suggestionsBox); suggestionsBox = null; }
    if (!suggestionsBox) {
        suggestionsBox = document.createElement('div');
        suggestionsBox.id = 'chat-suggestions';
        suggestionsBox.style.cssText = `
            position: absolute;
            left: 0;
            width: 100%;
            overflow-y: auto;
            overflow-x: hidden;
            background: rgba(0, 0, 0, 0.85);
            border: 2px solid #333;
            color: #f1c40f;
            display: none;
            z-index: 1000;
            font-family: 'Pixeltype', sans-serif;
            font-size: 20px;
            text-shadow: 1px 1px 0 #000;
            box-sizing: border-box;
            border-radius: 5px 5px 0 0;
        `;
        container.appendChild(suggestionsBox);
    }

    function hideSuggestions() { suggestionsBox.style.display = 'none'; }
    function placeSuggestions() {
        // justo encima del cuadro de texto, y como máximo tan alta como la zona de mensajes
        suggestionsBox.style.bottom = chatInput.offsetHeight + 'px';
        suggestionsBox.style.maxHeight = Math.max(60, messagesDiv.offsetHeight) + 'px';
    }

    // Vigilar cada letra que el jugador escribe
    chatInput.addEventListener('input', function() {
        const text = this.value;

        // Si no empieza con "/", ocultamos la lista
        if (!text.startsWith('/')) {
            hideSuggestions();
            return;
        }

        // Filtrar la lista
        const matches = COMMAND_SUGGESTIONS.filter(cmd => cmd.toLowerCase().startsWith(text.toLowerCase()));

        if (matches.length > 0) {
            suggestionsBox.innerHTML = '';

            matches.forEach(cmd => {
                const item = document.createElement('div');
                item.textContent = cmd;
                item.style.cssText = "padding: 6px 10px; cursor: pointer; border-bottom: 1px solid #333; transition: background 0.1s; white-space: nowrap;";

                item.onmouseover = () => item.style.background = "rgba(255, 255, 255, 0.2)";
                item.onmouseout = () => item.style.background = "transparent";
                // el clic no le quita el foco al cuadro de texto (así no se cierra antes de tiempo)
                item.onmousedown = (e) => e.preventDefault();

                item.onclick = () => {
                    chatInput.value = cmd.endsWith(' ') ? cmd : cmd + ' ';
                    chatInput.focus();
                    hideSuggestions();
                };

                suggestionsBox.appendChild(item);
            });

            placeSuggestions();
            suggestionsBox.style.display = 'block';
            suggestionsBox.scrollTop = 0;
        } else {
            hideSuggestions();
        }
    });

    // Ocultar la lista si presionan Enter o Escape, o si el cuadro de texto pierde el foco
    chatInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === 'Escape') hideSuggestions();
    });
    chatInput.addEventListener('blur', hideSuggestions);
}
// Arrancamos el sistema (con un pequeño retraso para asegurar que la página ya cargó el chat)
setTimeout(initCommandAutocomplete, 500);




window.openDirectMessage = function(uid, name) {
    // 1. Nos aseguramos de que el menú Backstage principal (donde viven los chats) esté abierto
    if (typeof openFileMenu === 'function') {
        const backstageMenu = document.getElementById('backstage-menu');
        if (!backstageMenu || backstageMenu.style.display === 'none') {
            openFileMenu('multiplayer'); 
        }
    }
    
    // 2. Navegamos hacia la pestaña correcta del Backstage (Multiplayer)
    if (typeof switchBackstageTab === 'function') {
        switchBackstageTab('multiplayer');
    }

    // 3. Pequeño retraso para permitir que la UI cargue, abrimos el panel y luego el chat específico
    setTimeout(() => {
        openMpSidebar('chats'); 
        setTimeout(() => {
            openPrivateChat(uid, name, 'assets/default pfp.png');
        }, 50); // Le damos tiempo extra para que el HTML de full-chat-active se despliegue
    }, 50);
};