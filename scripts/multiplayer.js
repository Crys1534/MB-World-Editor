window.spectatingTargetId = null; // Rastrea a quién vemos
window.mySpectators = new Set(); // Rastrea quién NOS está viendo a nosotros

// Función para activar/desactivar el espectador
window.toggleSpectatorMode = function(targetPeerId, targetName) {
    const myName = localStorage.getItem('mbw_username') || "Player";

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
// ✨ NOTIFICACIONES ESTILO ESCRITORIO
// ==========================================
window.showDesktopNotification = function(title, body, icon, onClickCallback) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed; bottom: 20px; right: -400px; width: 320px;
        background: #2c3e50; color: white; border-left: 5px solid #9b59b6;
        border-radius: 6px; padding: 15px; display: flex; gap: 15px; align-items: center;
        box-shadow: 0 4px 20px rgba(0,0,0,0.6); z-index: 9999999;
        font-family: 'Pixeltype', Arial, sans-serif; cursor: pointer;
        transition: right 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    `;
    toast.innerHTML = `
        <div style="width: 45px; height: 45px; border-radius: 50%; background-image: url('${icon}'); background-size: cover; background-position: center; flex-shrink: 0; border: 2px solid white;"></div>
        <div style="flex: 1; overflow: hidden;">
            <div style="font-size: 26px; font-weight: bold; color: #9b59b6; margin-bottom: 2px; text-shadow: 1px 1px 0 #000;">${title}</div>
            <div style="font-size: 18px; color: #ecf0f1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${body}</div>
        </div>
    `;
    toast.onclick = () => {
        if(onClickCallback) onClickCallback();
        toast.style.right = '-400px';
        setTimeout(() => toast.remove(), 400);
    };
    document.body.appendChild(toast);
    setTimeout(() => toast.style.right = '20px', 100);
    setTimeout(() => { if (toast) { toast.style.right = '-400px'; setTimeout(() => toast.remove(), 400); } }, 6000);
};

// ==========================================
// ✨ RENDER DE AVATARES ESTILO GOOGLE DOCS
// ==========================================
window.renderLivePlayers = function() {
    const container = document.getElementById('mp-live-players');
    if (!container) return;
    container.innerHTML = '';
    if (!isMultiplayer && !isHost) return; 

    const myUID = localStorage.getItem('mbw_uid');
    let drawnCount = 0; 

    window.roomPlayers.forEach((p) => {
        if (p.uid === myUID) return; 
        
        let marginLeft = drawnCount > 0 ? '-10px' : '0';
        let zIndex = 100 - drawnCount; 

        // ✨ MAGIA: Checamos si lo estamos espectando para ponerle borde rojo
        let isSpectating = (window.spectatingTargetId === p.peerId);
        let borderColor = isSpectating ? '#e74c3c' : 'var(--bg-header)';
        let borderWidth = isSpectating ? '3px' : '2px';
        let scale = isSpectating ? 'scale(1.15)' : 'scale(1)';

        container.innerHTML += `
            <div title="Click to spectate ${p.name}" 
                 onclick="toggleSpectatorMode('${p.peerId}', '${p.name.replace(/'/g, "\\'")}')"
                 style="
                width: 28px; height: 28px; border-radius: 50%; border: ${borderWidth} solid ${borderColor};
                background-color: #34495e; background-image: url('${p.pfp}'); background-size: cover; background-position: center; 
                margin-left: ${marginLeft}; z-index: ${zIndex}; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.3); 
                transform: ${scale}; transition: 0.2s;" 
                 onmouseover="this.style.transform='translateY(-2px) ${scale}'" 
                 onmouseout="this.style.transform='translateY(0) ${scale}'">
            </div>
        `;
        drawnCount++;
    });
};

// ==========================================
// LÓGICA DEL WIZARD (Asistente Visual)
// ==========================================
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
    const views = ['home', 'create-1', 'create-map', 'create-2', 'join'];
    views.forEach(v => {
        const el = document.getElementById('mp-view-' + v);
        if (el) el.style.display = 'none';
    });
    
    const target = document.getElementById('mp-view-' + viewId);
    if (target) target.style.display = 'block';
    
    if (viewId === 'join') window.loadPublicServers();
    if (viewId === 'create-map') window.renderMpMapSelection();

    if ((viewId === 'home' || viewId === 'create-1' || viewId === 'create-map') && isHost) {
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
        let thumbUrl = w.thumb || 'assets/Superflat World.png';
        const safeId = 'mp-map-card-' + w.name.replace(/[^a-zA-Z0-9]/g, '-');
        const safeName = w.name.replace(/'/g, "\\'"); 

        listDiv.innerHTML += `
            <div id="${safeId}" 
                 style="background: rgba(0,0,0,0.4); padding: 8px; border-radius: 6px; display: flex; align-items: center; border: 2px solid #7f8c8d; cursor: pointer; transition: 0.2s;"
                 onclick="selectMpMapForServer('${safeName}')"
                 onmouseover="if(window.mpSelectedMapName !== '${safeName}') this.style.borderColor='#3498db'"
                 onmouseout="if(window.mpSelectedMapName !== '${safeName}') this.style.borderColor='#7f8c8d'">
                <div style="width: 60px; height: 40px; background-image: url('${thumbUrl}'); background-size: cover; background-position: center; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2); flex-shrink: 0; margin-right: 12px; image-rendering: pixelated;"></div>
                <div style="flex: 1; overflow: hidden; text-align: left;">
                    <div style="color: white; font-size: 24px; font-family: 'Pixeltype', sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1;">${w.name}</div>
                    <div style="color: #bdc3c7; font-size: 14px; font-family: Arial;">⚖️ ${sizeFormatted}</div> </div>
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
        alert(`⚠️ Map is too heavy!\n\nThe map "${mapName}" weighs ${sizeMB.toFixed(2)} MB.\n\nTo guarantee a stable connection without crashing the server, the absolute limit is 25 MB.\n\nPlease select a lighter map.`);
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
            <div style="color: #bdc3c7; font-size: 16px; font-family: Arial; font-weight: bold;">⚖️ File Size: ${sizeFormatted}</div>
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
    if (!window.mpSelectedMapName) { alert("Error: No map selected."); return; }
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
            alert("Vaya, esa ID ya estaba en uso. Intenta crear el servidor de nuevo.");
            setMpView('create-1');
        }
    });
};

window.joinMultiplayerSession = function(directId = null) {
    const inputEl = document.getElementById('join-peer-id');
    const hostId = directId || (inputEl ? inputEl.value.trim() : null);
    if (!hostId) { alert("Please enter a Room ID!"); return; }

    const statusText = document.getElementById('multiplayer-status');
    if (statusText) {
        statusText.style.display = 'block';
        statusText.innerText = "Status: Connecting...";
        statusText.style.color = "#f1c40f";
    }

    isHost = false;
    peer = new Peer(); 

    peer.on('open', function() {
        miConexionAlHost = peer.connect(hostId);
        setupClientConnection(miConexionAlHost);
    });

    peer.on('error', function() {
        if (statusText) { statusText.innerText = "Status: Connection Error"; statusText.style.color = "#e74c3c"; }
        alert("Could not connect. The room might be closed or full.");
    });
};

function setupHostConnection(conn) {
    conn.on('open', function() {
        misClientes.push(conn);
        isMultiplayer = true;
        const statusText = document.getElementById('multiplayer-status');
        if (statusText) { statusText.innerText = `Status: ${misClientes.length + 1}/${window.multiplayerPlayerLimit} Players 🟢`; statusText.style.color = "#4CAF50"; }
        if (window.myRoomRef) window.myRoomRef.update({ currentPlayers: misClientes.length + 1 });
        
        if (typeof mbwom !== 'undefined' && mbwom.world) {
            conn.send({ tipo: "sync_mundo", mundo: mbwom.world });
        }
        enviarMensajeEnRed({ tipo: "chat", autor: "System", texto: "Un jugador se ha unido y está descargando el mapa." });
    });

    conn.on('data', function(data) {
        recibirMensajeDeRed(data);
        if (!data.retransmitido) {
            data.retransmitido = true;
            misClientes.forEach(cliente => { if (cliente.peer !== conn.peer && cliente.open) cliente.send(data); });
        }
    });

    conn.on('close', function() {
        misClientes = misClientes.filter(c => c.peer !== conn.peer);
        window.roomPlayers = window.roomPlayers.filter(p => p.peerId !== conn.peer);
        renderLivePlayers();
        enviarMensajeEnRed({ tipo: "sync_players", players: window.roomPlayers });

        const statusText = document.getElementById('multiplayer-status');
        if (statusText) statusText.innerText = `Status: ${misClientes.length + 1}/${window.multiplayerPlayerLimit} Players 🟢`;
        if (window.myRoomRef) window.myRoomRef.update({ currentPlayers: misClientes.length + 1 });
        enviarMensajeEnRed({ tipo: "chat", autor: "System", texto: "Un jugador se desconectó." });
    });
}

function setupClientConnection(conn) {
    conn.on('open', function() {
        isMultiplayer = true;
        const statusText = document.getElementById('multiplayer-status');
        if (statusText) { statusText.innerText = "Status: CONNECTED! 🟢"; statusText.style.color = "#4CAF50"; }

        const myUID = localStorage.getItem('mbw_uid');
        const myName = localStorage.getItem('mbw_username') || "Player";
        const myPfp = localStorage.getItem('mbw_profile_pic') || "assets/default pfp.png";
        conn.send({ tipo: "player_info", uid: myUID, name: myName, pfp: myPfp, peerId: peer.id });
    });

    conn.on('data', function(data) {
        if (data.tipo === "error_conexion") { alert(data.mensaje); conn.close(); return; }
        recibirMensajeDeRed(data);
    });

    conn.on('close', function() {
        isMultiplayer = false; miConexionAlHost = null;
        window.roomPlayers = []; 
        renderLivePlayers();
        const statusText = document.getElementById('multiplayer-status');
        if (statusText) { statusText.innerText = "Status: Disconnected 🔴"; statusText.style.color = "#e74c3c"; }
        alert("Disconnected from Server.");
    });
}

window.loadPublicServers = function() {
    const listDiv = document.getElementById('public-servers-list');
    if (!listDiv) return;
    listDiv.innerHTML = '<p style="text-align: center; color: #bdc3c7; font-size: 24px;">Searching for worlds...</p>';

    database.ref('servers').off('value');
    database.ref('servers').on('value', (snapshot) => {
        const servers = snapshot.val();
        listDiv.innerHTML = ''; 

        if (!servers) {
            listDiv.innerHTML = '<p style="text-align: center; color: #95a5a6; font-size: 24px; margin-top: 15px;">No public servers available right now.</p>';
            return;
        }

        const myUID = localStorage.getItem('mbw_uid'); 

        for (let id in servers) {
            let s = servers[id];
            if (!s || !s.hostName || s.hostName === 'undefined' || s.hostName === 'null') {
                database.ref('servers/' + id).remove(); 
                continue; 
            }

            if (s.access === 'friends_only' && s.hostUid !== myUID) {
                if (!misAmigosConfirmados.includes(s.hostUid)) continue; 
            }

            let isFull = s.currentPlayers >= s.maxPlayers;
            let isAlreadyJoined = false;
            if (isMultiplayer) {
                if (isHost && peer && peer.id === id) isAlreadyJoined = true;
                else if (!isHost && miConexionAlHost && miConexionAlHost.peer === id) isAlreadyJoined = true;
            }

            let buttonConfig = "";
            if (isAlreadyJoined) {
                buttonConfig = `<button style="background: #3498db; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: not-allowed; font-family: 'Pixeltype', sans-serif; font-size: 24px; transition: 0.2s;" disabled>JOINED</button>`;
            } else if (isFull) {
                buttonConfig = `<button style="background: #7f8c8d; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: not-allowed; font-family: 'Pixeltype', sans-serif; font-size: 24px; transition: 0.2s;" disabled>FULL</button>`;
            } else {
                buttonConfig = `<button onclick="document.getElementById('join-peer-id').value = '${id}'; joinMultiplayerSession('${id}');" style="background: #2ecc71; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-family: 'Pixeltype', sans-serif; font-size: 24px; transition: 0.2s;">JOIN</button>`;
            }

            let thumbUrl = s.mapThumb || 'assets/Superflat World.png';
            listDiv.innerHTML += `
                <div style="background: rgba(52, 73, 94, 0.8); padding: 10px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #7f8c8d; gap: 12px; margin-bottom: 5px;">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div style="width: 80px; height: 50px; background-image: url('${thumbUrl}'); background-size: cover; background-position: center; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2); image-rendering: pixelated; flex-shrink: 0;"></div>
                        <div>
                            <strong style="color: #4DA6FF; font-size: 24px; display: block; line-height: 1;">${s.hostName}'s Room</strong>
                            <span style="color: #bdc3c7; font-size: 18px;">Map: ${s.mapName}</span>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="color: ${(isFull && !isAlreadyJoined) ? '#e74c3c' : '#2ecc71'}; font-size: 24px; font-weight: bold;">${s.currentPlayers}/${s.maxPlayers}</span>
                        ${buttonConfig}
                    </div>
                </div>
            `;
        }
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
    }
    
    if (datos.tipo === "sync_players") {
        window.roomPlayers = datos.players;
        renderLivePlayers();
    }

    if (datos.tipo === "chat") { 
    if (typeof audioManager !== 'undefined') audioManager.playTone(800, 'sine', 0.1, 0.2); 
    if (typeof window.agregarMensajeChatPublico === 'function') window.agregarMensajeChatPublico(datos.autor, datos.texto);
}
    if (datos.tipo === "sync_mundo") {
        mbwom.world = datos.mundo; 
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
        alert("Map downloaded successfully! Welcome to the server.");
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
let myPresenceRef = null;

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
                // ✨ FIX: Usamos tu UID como la llave única en la base de datos
                myPresenceRef = database.ref('online_users/' + myUID);
                
                myPresenceRef.onDisconnect().remove().then(() => {
                    const myName = localStorage.getItem('mbw_username') || "Player";
                    const myPfp = localStorage.getItem('mbw_profile_pic') || "assets/default pfp.png";
                    
                    // Sobrescribimos el registro si ya existía
                    myPresenceRef.set({ 
                        uid: myUID, 
                        username: myName, 
                        pfp: myPfp, 
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

window.renderPresenceList = function() {
    const users = window.lastKnownUsers;
    const listContainer = document.getElementById('mp-online-users-list');
    if (listContainer) listContainer.innerHTML = '';
    if (!users) return;

    // ✨ AQUÍ ESTÁ EL FIX: Leemos tu ID para que el código sepa quién eres tú
    const myUID = localStorage.getItem('mbw_uid');

    let htmlContent = '';
    const now = Date.now();

    for (let key in users) {
        const u = users[key];
        // Ahora sí, esta línea no va a fallar
        const isMe = (myUID && key === myUID);
        const isFriend = misAmigosConfirmados.includes(u.uid);
        
        let inviteBtn = '';
        if (isHost && window.currentRoomId && !isMe) {
            if (window.inviteCooldowns[u.uid] && now < window.inviteCooldowns[u.uid]) {
                inviteBtn = `<button style="background: #7f8c8d; border: none; padding: 6px 10px; border-radius: 4px; cursor: not-allowed; color: white; font-size: 16px;" disabled>⏳ Wait...</button>`;
            } else {
                inviteBtn = `<button onclick="sendServerInvite('${u.uid}', '${u.username}', event)" style="background: #9b59b6; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; color: white; font-size: 16px; transition: 0.2s;" onmouseover="this.style.background='#8e44ad'" onmouseout="this.style.background='#9b59b6'" title="Invite to server">🎮 Invite</button>`;
            }
        }

        const borderColor = (isMe || isFriend) ? '#1e293b' : '#34495e';

        htmlContent += `
            <div style="background: rgba(0,0,0,0.4); border: 2px solid ${borderColor}; padding: 10px; display: flex; align-items: center; gap: 12px; border-radius: 6px;">
                <div style="width: 40px; height: 40px; border-radius: 50%; background-image: url('${u.pfp}'); background-size: cover; background-position: center; border: 2px solid #bdc3c7;"></div>
                <span style="color: white; font-family: 'Pixeltype', sans-serif; font-size: 26px;">${u.username}</span>
                ${isMe ? 
                    '<span style="color: #2ecc71; font-size: 16px; margin-left: auto; font-weight: bold;">(You)</span>' 
                    : 
                    `<div style="margin-left: auto; display: flex; gap: 8px;">
                        ${inviteBtn}
                        ${!isFriend ? `<button onclick="sendFriendRequest('${u.uid}', '${u.username}')" style="background: #e67e22; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; color: white; font-size: 16px; transition: 0.2s;" onmouseover="this.style.background='#d35400'" onmouseout="this.style.background='#e67e22'">➕ Add</button>` : ''}
                        ${isFriend ? `<button onclick="openPrivateChat('${u.uid}', '${u.username}', '${u.pfp}')" style="background: transparent; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; color: white; font-size: 16px; transition: 0.2s;" onmouseover="this.style.background='#2980b9'" onmouseout="this.style.background='transparent'">💬</button>` : ''}
                    </div>`
                }
            </div>
        `;
    }
    if (listContainer) listContainer.innerHTML = htmlContent;
};

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
    const myUID = localStorage.getItem('mbw_uid');
    database.ref('server_invites/' + myUID + '/' + senderUid).remove(); 
    const joinInput = document.getElementById('join-peer-id');
    if (joinInput) joinInput.value = roomId; 
    closeMpSidebar();
    setMpView('join');
    joinMultiplayerSession(roomId); 
};

window.declineServerInvite = function(senderUid) {
    const myUID = localStorage.getItem('mbw_uid');
    database.ref('server_invites/' + myUID + '/' + senderUid).remove(); 
};

// ==========================================
// ✨ AMIGOS Y PETICIONES
// ==========================================
let currentChatId = null;
let currentChatListener = null;
let misAmigosConfirmados = [];
let currentChatPartner = null; 

window.sendFriendRequest = function(targetUid, targetName) {
    const myUID = localStorage.getItem('mbw_uid');
    const myName = localStorage.getItem('mbw_username') || "Player";
    const myPfp = localStorage.getItem('mbw_profile_pic') || "assets/default pfp.png";
    database.ref('friend_requests/' + targetUid + '/' + myUID).set({ uid: myUID, username: myName, pfp: myPfp, timestamp: firebase.database.ServerValue.TIMESTAMP });
    alert("Friend request sent to " + targetName + "!");
}
window.acceptFriendRequest = function(senderUid) {
    const myUID = localStorage.getItem('mbw_uid');
    database.ref('friends/' + myUID + '/' + senderUid).set(true);
    database.ref('friends/' + senderUid + '/' + myUID).set(true);
    database.ref('friend_requests/' + myUID + '/' + senderUid).update({ status: 'accepted' });
}
window.declineFriendRequest = function(senderUid) {
    const myUID = localStorage.getItem('mbw_uid');
    database.ref('friend_requests/' + myUID + '/' + senderUid).update({ status: 'rejected' });
}

// ==========================================
// ✨ CONTROL DE BARRA LATERAL (WhatsApp Web)
// ==========================================
let currentSidebarMode = ''; 

window.openMpSidebar = function(mode) {
    if (typeof openFileMenu === 'function') {
        const fileMenu = document.getElementById('file-menu');
        if (fileMenu && fileMenu.style.display === 'none') openFileMenu();
    }
    if (typeof switchBackstageTab === 'function') switchBackstageTab('multiplayer');

    currentSidebarMode = mode;

    if (mode !== 'chats') {
        currentChatPartner = null;
        // ✨ FIX: Destruir el radar fantasma si cambiamos a la pestaña de Amigos o Servidores
        if (currentChatListener && currentChatId) {
            database.ref('private_chats/' + currentChatId).off('child_added', currentChatListener);
            database.ref('private_chats/' + currentChatId).off('child_changed');
            currentChatListener = null;
            currentChatId = null;
        }
    }
    
    const serversView = document.getElementById('mp-servers-view');
    const fullChatView = document.getElementById('mp-full-chat-view');
    const sidebar = document.getElementById('mp-right-sidebar');
    const title = document.getElementById('sidebar-title');
    const content = document.getElementById('sidebar-content');

    if (mode === 'chats') {
        if (serversView) serversView.style.display = 'none';
        if (sidebar) sidebar.style.display = 'none';
        if (fullChatView) fullChatView.style.display = 'flex';
        
        const listContainer = document.getElementById('full-chat-list-container');
        if (listContainer) renderChatList(listContainer);
    } else {
        if (serversView) serversView.style.display = 'flex'; 
        if (fullChatView) fullChatView.style.display = 'none';
        if (sidebar) sidebar.style.display = 'flex';

        if (mode === 'friends') {
            if (title) title.innerText = '👥 Friend requests';
            if (content) renderFriendRequests(content);
            const badgeFriends = document.getElementById('badge-friends');
            if (badgeFriends) badgeFriends.style.display = 'none'; 
        } else if (mode === 'invites') {
            if (title) title.innerText = '🔔 Notifications';
            if (content) renderServerInvites(content);
            const badgeInv = document.getElementById('badge-invites');
            if (badgeInv) badgeInv.style.display = 'none';
        }
    }
};

window.closeMpSidebar = function() {
    const sidebar = document.getElementById('mp-right-sidebar');
    if (sidebar) sidebar.style.display = 'none';
    
    currentChatPartner = null;
    // ✨ FIX: Destruir el radar fantasma al cerrar el menú lateral
    if (currentChatListener && currentChatId) {
        database.ref('private_chats/' + currentChatId).off('child_added', currentChatListener);
        database.ref('private_chats/' + currentChatId).off('child_changed');
        currentChatListener = null;
        currentChatId = null;
    }
};

window.renderServerInvites = function(container) {
    const myUID = localStorage.getItem('mbw_uid');
    database.ref('server_invites/' + myUID).once('value', (snapshot) => {
        const invites = snapshot.val();
        container.innerHTML = '';
        if (!invites) { container.innerHTML = '<p style="color: #bdc3c7; text-align: center; font-size: 24px;">No notifications yet.</p>'; return; }

        Object.keys(invites).reverse().forEach(senderUid => {
            let inv = invites[senderUid];
            container.innerHTML += `
                <div style="background: rgba(0,0,0,0.2); padding: 10px; display: flex; align-items: center; gap: 10px; border-radius: 4px; border-left: 3px solid #9b59b6;">
                    <div style="width: 40px; height: 40px; border-radius: 50%; background-image: url('${inv.hostPfp}'); background-size: cover; background-position: center; border: 2px solid white;"></div>
                    <div style="flex: 1; overflow: hidden;">
                        <div style="color: white; font-size: 24px; font-weight: bold; margin-bottom: 2px;">${inv.hostName}</div>
                        <div style="color: #bdc3c7; font-size: 16px; font-family: Arial; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 6px;">Map: ${inv.mapName}</div>
                        <div style="display: flex; gap: 5px;">
                            <button onclick="acceptServerInvite('${inv.roomId}', '${senderUid}')" style="background: #9b59b6; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 20px;">Join</button>
                            <button onclick="declineServerInvite('${senderUid}'); openMpSidebar('invites');" style="background: #7f8c8d; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 20px;">X</button>
                        </div>
                    </div>
                </div>
            `;
        });
    });
};

window.renderFriendRequests = function(container) {
    const myUID = localStorage.getItem('mbw_uid');
    database.ref('friend_requests/' + myUID).once('value', (snapshot) => {
        const requests = snapshot.val();
        container.innerHTML = '';
        if (!requests) { container.innerHTML = '<p style="color: #bdc3c7; text-align: center; font-size: 24px;">No friend requests.</p>'; return; }

        let pendingCount = 0;
        Object.keys(requests).reverse().forEach(senderUid => {
            let req = requests[senderUid];
            let statusHtml = '';
            if (req.status === 'accepted') statusHtml = '<span style="color: #2ecc71; font-size: 20px;">✔️ Accepted</span>';
            else if (req.status === 'rejected') statusHtml = '<span style="color: #e74c3c; font-size: 20px;">❌ Denied</span>';
            else {
                pendingCount++;
                statusHtml = `<button onclick="acceptFriendRequest('${senderUid}'); openMpSidebar('friends');" style="background: #2ecc71; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 20px;">Accept</button>
                              <button onclick="declineFriendRequest('${senderUid}'); openMpSidebar('friends');" style="background: #e74c3c; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 20px;">Decline</button>`;
            }
            container.innerHTML += `
                <div style="background: rgba(0,0,0,0.2); padding: 10px; display: flex; align-items: center; gap: 10px; border-radius: 4px; border-left: 3px solid ${req.status ? '#7f8c8d' : '#f1c40f'};">
                    <div style="width: 40px; height: 40px; border-radius: 50%; background-image: url('${req.pfp}'); background-size: cover; background-position: center; border: 2px solid white;"></div>
                    <div style="flex: 1;"><div style="color: white; font-size: 26px;">${req.username}</div><div style="display: flex; gap: 5px; margin-top: 5px;">${statusHtml}</div></div>
                </div>
            `;
        });
        const badge = document.getElementById('badge-friends');
        if (badge) { badge.innerText = pendingCount; badge.style.display = pendingCount > 0 ? 'block' : 'none'; }
    });
}

// ==========================================
// ✨ LÓGICA DEL CHAT Y RESPUESTAS (REPLY)
// ==========================================

window.setReply = function(msgId, senderName, text) {
    replyingTo = { msgId, senderName, text };
    
    let replyPreview = document.getElementById('full-chat-reply-preview');
    if (!replyPreview) {
        replyPreview = document.createElement('div');
        replyPreview.id = 'full-chat-reply-preview';
        replyPreview.style.cssText = `
            background: rgba(0,0,0,0.2); border-left: 4px solid #f1c40f;
            padding: 10px 15px; margin: 0; border-radius: 8px 8px 0 0;
            display: flex; justify-content: space-between; align-items: center;
            font-family: Arial, sans-serif; font-size: 13px; color: #ecf0f1;
        `;
        const chatActive = document.getElementById('full-chat-active');
        const inputArea = chatActive.querySelector('div[style*="background: #34495e"]');
        chatActive.insertBefore(replyPreview, inputArea);
    }
    
    replyPreview.style.display = 'flex';
    replyPreview.innerHTML = `
        <div style="overflow: hidden;">
            <div style="color: #f1c40f; font-weight: bold; font-size: 14px;">Respondiendo a ${senderName}</div>
            <div style="opacity: 0.7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 16px; font-family: 'Pixeltype'">${text}</div>
        </div>
        <span onclick="cancelReply()" style="cursor: pointer; font-size: 24px; margin-left: 10px; color: #e74c3c;">&times;</span>
    `;
    document.getElementById('full-dm-input').focus();
};

window.cancelReply = function() {
    replyingTo = null;
    const preview = document.getElementById('full-chat-reply-preview');
    if (preview) preview.style.display = 'none';
};

window.sendPrivateMessage = function() {
    const input = document.getElementById('full-dm-input');
    const text = input.value.trim();
    if (!text || !currentChatId || !currentChatPartner) return;
    
    const myUID = localStorage.getItem('mbw_uid');
    const myName = localStorage.getItem('mbw_username') || "Player";
    const myPfp = localStorage.getItem('mbw_profile_pic') || "assets/default pfp.png";
    const timestamp = firebase.database.ServerValue.TIMESTAMP;

    // ✨ SI ESTAMOS EDITANDO UN MENSAJE
    if (window.editingMsgKey) {
        database.ref('private_chats/' + currentChatId + '/' + window.editingMsgKey).update({
            text: text,
            isEdited: true
        });
        
        input.value = '';
        window.editingMsgKey = null;
        database.ref('typing_status/' + currentChatId + '/' + myUID).set(false);
        let typingIndicator = document.getElementById('dm-typing-indicator');
        if (typingIndicator) {
            typingIndicator.style.display = 'none';
            typingIndicator.style.color = "#2ecc71"; // Regresa al color original
        }
        input.focus();
        return; 
    }

    // ✨ SI ES UN MENSAJE NUEVO
    const messageData = { 
        sender: myUID, 
        senderName: myName, 
        text: text, 
        timestamp: timestamp,
        status: 'sent' 
    };

    if (replyingTo) {
        messageData.replyTo = replyingTo;
        cancelReply(); 
    }

    database.ref('private_chats/' + currentChatId).push(messageData);
    database.ref('user_chats/' + myUID + '/' + currentChatPartner.uid).set({ name: currentChatPartner.name, pfp: currentChatPartner.pfp, lastMsg: text, timestamp: timestamp, unreadCount: 0 });
    database.ref('user_chats/' + currentChatPartner.uid + '/' + myUID).set({ name: myName, pfp: myPfp, lastMsg: text, timestamp: timestamp, unreadCount: firebase.database.ServerValue.increment(1) });
    
    input.value = ''; 
    database.ref('typing_status/' + currentChatId + '/' + myUID).set(false);
    input.focus();
};

window.renderChatList = function(container) {
    const myUID = localStorage.getItem('mbw_uid');
    database.ref('friends/' + myUID).once('value', (friendsSnap) => {
        const friends = friendsSnap.val() || {};
        database.ref('user_chats/' + myUID).once('value', (snapshot) => {
            const myChats = snapshot.val() || {};
            container.innerHTML = '';
            let chatEntries = {};
            
            for (let uid in myChats) { chatEntries[uid] = myChats[uid]; }
            for (let uid in friends) {
                if (!chatEntries[uid]) {
                    let friendName = "User"; let friendPfp = "assets/default pfp.png";
                    if (window.lastKnownUsers && window.lastKnownUsers[uid]) {
                        friendName = window.lastKnownUsers[uid].username; friendPfp = window.lastKnownUsers[uid].pfp;
                    }
                    chatEntries[uid] = { name: friendName, pfp: friendPfp, lastMsg: "", timestamp: 0, unreadCount: 0 };
                }
            }

            const sorted = Object.keys(chatEntries).map(uid => ({uid, ...chatEntries[uid]})).sort((a, b) => b.timestamp - a.timestamp);
            if (sorted.length === 0) { container.innerHTML = '<p style="color: #bdc3c7; text-align: center; font-size: 24px; margin-top: 20px;">No friends or active chats.</p>'; return; }

            sorted.forEach(chat => {
                let unreadBadge = (chat.unreadCount && chat.unreadCount > 0) ? `<div style="background: #e74c3c; color: white; font-size: 14px; font-weight: bold; padding: 2px 8px; border-radius: 12px; margin-left: auto; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${chat.unreadCount}</div>` : '';
                let msgStyle = chat.lastMsg === "" ? "font-style: italic; opacity: 0.6;" : "";
                
                let isActive = currentChatPartner && currentChatPartner.uid === chat.uid;
                let bgStyle = isActive ? 'rgba(52, 152, 219, 0.4)' : 'rgba(0,0,0,0.3)';
                let borderStyle = isActive ? '4px solid #f1c40f' : '4px solid #3498db';

                // ✨ Protección contra comillas en los nombres que rompen los botones
                let safeName = chat.name.replace(/'/g, "\\'");

                container.innerHTML += `
                    <div style="background: ${bgStyle}; padding: 12px; display: flex; align-items: center; gap: 12px; border-radius: 0px; border-left: ${borderStyle}; cursor: pointer; transition: 0.2s; margin-bottom: 1px;" onmouseover="this.style.background='rgba(52, 152, 219, 0.2)'" onmouseout="this.style.background='${bgStyle}'" onclick="openPrivateChat('${chat.uid}', '${safeName}', '${chat.pfp}')">
                        <div style="width: 45px; height: 45px; border-radius: 50%; background-image: url('${chat.pfp}'); background-size: cover; background-position: center; border: 2px solid #FFF; flex-shrink: 0;"></div>
                        <div style="flex: 1; overflow: hidden; display: flex; align-items: center;">
                            <div style="flex: 1; overflow: hidden;">
                                <div style="color: white; font-size: 24px; font-family: 'Pixeltype', sans-serif;">${chat.name}</div>
                                <div style="color: #bdc3c7; font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: Arial; ${msgStyle}">${chat.lastMsg}</div>
                            </div>
                            ${unreadBadge}
                        </div>
                    </div>
                `;
            });
        });
    });
};

// ==========================================
// ✨ CEREBRO DE EMOTES Y SEGURIDAD
// ==========================================

// 1. TUS EMOTES INTERNOS (Cambia las URLs por tus imágenes reales)
window.customEmotes = {
    "gg": "assets/emote_gg.png",
    "rip": "assets/emote_rip.png",
    "pog": "assets/emote_pog.png",
    "heart": "assets/emote_heart.png",
    "troll": "assets/emote_troll.png",
    "wow": "assets/emote_wow.png",
    "mad": "assets/emote_mad.png",
    "happy": "assets/emote_happy.png"
};

// 2. CATEGORÍAS DE EMOJIS ESTÁNDAR (ARSENAL COMPLETO)
window.emojiCategories = [
    { 
        id: "peo", icon: "😃", name: "People", 
        items: [
            // Caritas y Emociones
            "😀","😃","😄","😁","😆","😅","😂","🤣","🥲","☺️","😊","😇","🙂","🙃","😉","😌","😍","🥰","😘","😗","😙","😚","😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎","🥸","🤩","🥳","😏","😒","😞","😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🫣","🤭","🤫","🤥","😶","😶‍🌫️","😐","😑","😬","🫨","🫠","🙄","😯","😦","😧","😮","😲","🥱","😴","🤤","😪","😵","😵‍💫","🤐","🥴","🤢","🤮","🤧","😷","🤒","🤕","🤑","🤠","😈","👿","👹","👺","🤡","💩","👻","💀","☠️","👽","👾","🤖","🎃",
            // Manos y Gestos
            "👐","🤲","🙌","👏","🤝","👍","👎","👊","✊","🤛","🤜","🤞","✌️","🫰","🤟","🤘","👌","🤌","🤏","🫳","🫴","👈","👉","👆","👇","☝️","✋","🤚","🖐️","🖖","👋","🤙","🫲","🫱","🫷","🫸","💪","🦾","🖕","✍️","🙏","🦶","🦵","🦿","💄","💋","👄","🦷","👅","👂","🦻","👃","👣","👁️","👀","🧠","🫀","🫁",
            // Personas y Profesiones
            "👶","👧","🧒","👦","👩","🧑","👨","👱‍♀️","👱","👱‍♂️","🧔‍♀️","🧔","🧔‍♂️","👵","🧓","👴","👲","👳‍♀️","👳","👳‍♂️","🧕","👮‍♀️","👮","👮‍♂️","👷‍♀️","👷","👷‍♂️","💂‍♀️","💂","💂‍♂️","🕵️‍♀️","🕵️","🕵️‍♂️","👩‍⚕️","🧑‍⚕️","👨‍⚕️","👩‍🌾","🧑‍🌾","👨‍🌾","👩‍🍳","🧑‍🍳","👨‍🍳","👩‍🎓","🧑‍🎓","👨‍🎓","👩‍🎤","🧑‍🎤","👨‍🎤","👩‍🏫","🧑‍🏫","👨‍🏫","👩‍🏭","🧑‍🏭","👨‍🏭","👩‍💻","🧑‍💻","👨‍💻","👩‍💼","🧑‍💼","👨‍💼","👩‍🔧","🧑‍🔧","👨‍🔧","👩‍🔬","🧑‍🔬","👨‍🔬","👩‍🎨","🧑‍🎨","👨‍🎨","👩‍🚒","🧑‍🚒","👨‍🚒","👩‍✈️","🧑‍✈️","👨‍✈️","👩‍🚀","🧑‍🚀","👨‍🚀","👩‍⚖️","🧑‍⚖️","👨‍⚖️","👰‍♀️","👰","👰‍♂️","🤵‍♀️","🤵","🤵‍♂️","👸","🫅","🤴","🥷","🦸‍♀️","🦸","🦸‍♂️","🦹‍♀️","🦹","🦹‍♂️","🤶","🧑‍🎄","🎅","🧙‍♀️","🧙","🧙‍♂️","🧝‍♀️","🧝","🧝‍♂️","🧛‍♀️","🧛","🧛‍♂️","🧟‍♀️","🧟","🧟‍♂️","🧞‍♀️","🧞","🧞‍♂️","🧜‍♀️","🧜","🧜‍♂️","🧚‍♀️","🧚","🧚‍♂️","👼","🤰","🫄","🫃","🤱","👩‍🍼","🧑‍🍼","👨‍🍼","🙇‍♀️","🙇","🙇‍♂️","💁‍♀️","💁","💁‍♂️","🙅‍♀️","🙅","🙅‍♂️","🙆‍♀️","🙆","🙆‍♂️","🙋‍♀️","🙋","🙋‍♂️","🧏‍♀️","🧏","🧏‍♂️","🤦‍♀️","🤦","🤦‍♂️","🤷‍♀️","🤷","🤷‍♂️","🙎‍♀️","🙎","🙎‍♂️","🙍‍♀️","🙍","🙍‍♂️","💇‍♀️","💇","💇‍♂️","💆‍♀️","💆","💆‍♂️","🧖‍♀️","🧖","🧖‍♂️","💅","🤳","💃","🕺","👯‍♀️","👯","👯‍♂️","🕴️","🚶‍♀️","🚶","🚶‍♂️","🧎‍♀️","🧎","🧎‍♂️","🏃‍♀️","🏃","🏃‍♂️","🧍‍♀️","🧍","🧍‍♂️","👭","🧑‍🤝‍🧑","👬","👫"
        ] 
    },
    { id: "nat", icon: "🌿", name: "Nature", items: ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🐔","🐧","🐦","🐤","🦆","🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝","🐛","🦋","🐌","🐞","🐜","🦟","🐢","🐍","🦎","🦖","🦕","🐙","🦑","🦐","🦞","🦀","🐡","🐠","🐟","🐬","🐳","🐋","🦈","🐊","🐅","🐆","🦓","🦍","🦧","🐘","🦛","🦏","🐪","🐫","🦒","🦘","🐃","🐂","🐄","🐎","🐖","🐏","🐑","🦙","🐐","🦌","🐕","🐩","🦮","🐕‍🦺","🐈","🐈‍⬛","🪶","🐓","🦃","🦚","🦜","🦢","🦩","🕊️","🐇","🦝","🦨","🦡","🦦","🦥","🐁","🐀","🐿️","🦔","🐾","🐉","🐲","🌵","🎄","🌲","🌳","🌴","🪵","🌱","🌿","☘️","🍀","🎍","🪴","🎋","🍃","🍂","🍁","🍄","🌾","💐","🌷","🌹","🥀","🌺","🌸","🌼","🌻","🌞","🌝","🌛","🌜","🌚","🌕","🌖","🌗","🌘","🌑","🌒","🌓","🌔","🌙","🌎","🌍","🌏","🪐","💫","⭐️","🌟","✨","⚡️","☄️","💥","🔥","🌪️","🌈","☀️","🌤️","⛅️","🌥️","☁️","🌦️","🌧️","⛈️","🌩️","🌨️","❄️","☃️","⛄️","🌬️","💨","💧","💦","☔️","☂️","🌊","🌫️"] },
    { id: "foo", icon: "🍔", name: "Food", items: ["🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🍆","🥑","🥦","🥬","🥒","🌶️","🫑","🌽","🥕","🫒","🧄","🧅","🥔","🍠","🥐","🥯","🍞","🥖","🥨","🧀","🥚","🍳","🧈","🥞","🧇","🥓","🥩","🍗","🍖","🦴","🌭","🍔","🍟","🍕","🫓","🥪","🥙","🧆","🌮","🌯","🫔","🥗","🥘","🫕","🥫","🍝","🍜","🍲","🍛","🍣","🍱","🥟","🦪","🍤","🍙","🍚","🍘","🍥","🥠","🥮","🍢","🍡","🍧","🍨","🍦","🥧","🧁","🍰","🎂","🍮","🍭","🍬","🍫","🍿","🍩","🍪","🌰","🥜","🍯","🥛","🍼","🫖","☕️","🍵","🧃","🥤","🧋","🍶","🍺","🍻","🥂","🍷","🥃","🍸","🍹","🧉","🍾","🧊","🥄","🍴","🍽️","🥣","🥡","🥢","🧂"] },
    { id: "act", icon: "⚽", name: "Activities", items: ["⚽️","🏀","🏈","⚾️","🥎","🎾","🏐","🏉","🥏","🎱","🪀","🏓","🏸","🏒","🏑","🥍","🏏","🪃","🥅","⛳️","🪁","🏹","🎣","🤿","🥊","🥋","🎽","🛹","🛼","🛷","⛸️","🥌","🎿","⛷️","🏂","🪂","🏋️‍♀️","🏋️","🏋️‍♂️","🤼‍♀️","🤼","🤼‍♂️","🤸‍♀️","🤸","🤸‍♂️","⛹️‍♀️","⛹️","⛹️‍♂️","🤺","🤾‍♀️","🤾","🤾‍♂️","🏌️‍♀️","🏌️","🏌️‍♂️","🏇","🧘‍♀️","🧘","🧘‍♂️","🏄‍♀️","🏄","🏄‍♂️","🏊‍♀️","🏊","🏊‍♂️","🤽‍♀️","🤽","🤽‍♂️","🚣‍♀️","🚣","🚣‍♂️","🧗‍♀️","🧗","🧗‍♂️","🚵‍♀️","🚵","🚵‍♂️","🚴‍♀️","🚴","🚴‍♂️","🏆","🥇","🥈","🥉","🏅","🎖️","🏵️","🎗️","🎫","🎟️","🎪","🤹‍♀️","🤹","🤹‍♂️","🎭","🩰","🎨","🎬","🎤","🎧","🎼","🎹","🥁","🪘","🎷","🎺","🪗","🎸","🪕","🎻","🎲","♟️","🎯","🎳","🎮","🎰","🧩"] },
    { id: "tri", icon: "🚗", name: "Trips", items: ["🚗","🚕","🚙","🚌","🚎","🏎️","🚓","🚑","🚒","🚐","🛻","🚚","🚛","🚜","🦯","🦽","🦼","🛴","🚲","🛵","🏍️","🛺","🚨","🚔","🚍","🚘","🚖","🚡","🚠","🚟","🚃","🚋","🚞","🚝","🚄","🚅","🚈","🚂","🚆","🚇","🚊","🚉","✈️","🛫","🛬","🛩️","💺","🛰️","🚀","🛸","🚁","🛶","⛵️","🚤","🛥️","🛳️","⛴️","🚢","⚓️","🪝","⛽️","🚧","🚦","🚥","🚏","🗺️","🗿","🗽","🗼","🏰","🏯","🏟️","🎡","🎢","🎠","⛲️","⛱️","🏖️","🏝️","🏜️","🌋","⛰️","🏔️","🗻","🏕️","⛺️","🛖","🏠","🏡","🏘️","🏚️","🏗️","🏭","🏢","🏬","🏣","🏤","🏥","🏦","🏨","🏪","🏫","🏩","💒","🏛️","⛪️","🕌","🕍","🛕","🕋","⛩️","🛤️","🛣️","🗾","🎑","🏞️","🌅","🌄","🌠","🎇","🎆","🌇","🌆","🏙️","🌃","🌌","🌉","🌁"] },
    { id: "obj", icon: "💡", name: "Objects", items: ["⌚️","📱","📲","💻","⌨️","🖥️","🖨️","🖱️","🖲️","🕹️","🗜️","💽","💾","💿","📀","📼","📷","📸","📹","🎥","📽️","🎞️","📞","☎️","📟","📠","📺","📻","🎙️","🎚️","🎛️","🧭","⏱️","⏲️","⏰","🕰️","⌛️","⏳","📡","🔋","🔌","💡","🔦","🕯️","🪔","🧯","🛢️","💸","💵","💴","💶","💷","🪙","💰","💳","💎","⚖️","🪜","🧰","🪛","🔧","🔨","⚒️","🛠️","⛏️","🪚","🔩","⚙️","🪤","🧱","⛓️","🧲","🔫","💣","🧨","🪓","🔪","🗡️","⚔️","盾","🚬","⚰️","🪦","⚱️","🏺","🔮","📿","🧿","💈","⚗️","🔭","🔬","🕳️","🩹","🩺","💊","💉","🩸","🧬","🦠","🧫","🧪","🌡️","🧹","🪠","🧺","🧻","🚽","🚰","🚿","🛁","🛀","🧼","🪥","🪒","🧽","🪣","🧴","🛎️","🔑","🗝️","🚪","🪑","🛋️","🛏️","🛌","🧸","🪆","🖼️","🪞","🪟","🛍️","🛒","🎁","🎈","🎏","🎀","🪄","🪅","🎊","🎉","🎎","🏮","🎐","🧧","✉️","📩","📨","📧","💌","📥","📤","📦","🏷️","🪧","📪","📫","📬","📭","📮","📯","📜","📃","📄","📑","🧾","📊","📈","📉","🗒️","🗓️","📆","📅","🗑️","📇","🗃️","🗳️","🗄️","📋","📁","📂","🗂️","🗞️","📰","📓","📔","📒","📕","📗","📘","📙","📚","📖","🔖","🧷","🔗","📎","🖇️","📐","📏","🧮","📌","📍","✂️","🖊️","🖋️","✒️","🖌️","🖍️","📝","✏️","🔍","🔎","🔏","🔐","🔒","🔓"] },
    { id: "sym", icon: "❤️", name: "Symbols", items: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟","☮️","✝️","☪️","🕉️","☸️","✡️","🔯","🕎","☯️","☦️","🛐","⛎","♈️","♉️","♊️","♋️","♌️","♍️","♎️","♏️","♐️","♑️","♒️","♓️","🆔","⚛️","🉑","☢️","☣️","📴","📳","🈶","🈚️","🈸","🈺","🈷️","✴️","🆚","💮","🉐","㊙️","㊗️","🈴","🈵","🈹","🈲","🅰️","🅱️","🆎","🆑","🅾️","🆘","❌","⭕️","🛑","⛔️","📛","🚫","💯","💢","♨️","🚷","🚯","🚳","🚱","🔞","📵","🚭","❗️","❕","❓","❔","‼️","⁉️","🔅","🔆","〽️","⚠️","🚸","🔱","⚜️","🔰","♻️","✅","🈯️","💹","❇️","✳️","❎","🌐","💠","Ⓜ️","🌀","💤","🏧","🚾","♿️","🅿️","🛗","🈳","🈂️","🛂","🛃","🛄","🛅","🚹","🚺","🚼","⚧️","🚻","🚮","🎦","📶","🈁","🔣","ℹ️","🔤","🔡","🔠","🆖","🆗","🆙","🆒","🆕","🆓","0️⃣","1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟","🔢","#️⃣","*️⃣","⏏️","▶️","⏸️","⏯️","⏹️","⏺️","⏭️","⏮️","⏩","⏪","⏫","⏬","◀️","🔼","🔽","➡️","⬅️","⬆️","⬇️","↗️","↘️","↙️","↖️","↕️","↔️","↪️","↩️","⤴️","⤵️","🔀","🔁","🔂","🔄","🔃","🎵","🎶","➕","➖","➗","✖️","♾️","💲","💱","™️","©️","®️","〰️","➰","➿","🔚","🔙","🔛","🔝","🔜","✔️","☑️","🔘","🔴","🟠","🟡","🟢","🔵","🟣","⚫️","⚪️","🟤","🔺","🔻","🔸","🔹","🔶","🔷","🔳","🔲","▪️","▫️","◾️","◽️","◼️","◻️","🟥","🟧","🟨","🟩","🟦","🟪","⬛️","⬜️","🟫","🔈","🔇","🔉","🔊","🔔","🔕","📣","📢","👁‍🗨","💬","💭","🗯️","♠️","♣️","♥️","♦️","🃏","🎴","🀄️","🕐","🕑","🕒","🕓","🕔","🕕","🕖","🕗","🕘","🕙","🕚","🕛","🕜","🕝","🕞","🕟","🕠","🕡","🕢","🕣","🕤","🕥","🕦","🕧"] },
    { id: "fla", icon: "🏁", name: "Flags", items: ["🏁","🚩","🎌","🏴","🏳️","🏳️‍🌈","🏳️‍⚧️","🏴‍☠️","🇲🇽","🇪🇸","🇺🇸","🇨🇦","🇦🇷","🇨🇴","🇨🇱","🇵🇪","🇬🇧","🇫🇷","🇩🇪","🇮🇹","🇯🇵","🇰🇷","🇨🇳","🇧🇷","🇮🇳","🇷🇺","🇿🇦","🇦🇺","🇳🇿"] }
];

// 3. SEGURIDAD CONTRA HACKEOS (XSS)
window.escapeHTML = function(str) {
    return String(str || "").replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
};

// 4. EL CONVERTIDOR MÁGICO (Detecta si va solo para hacerlo 56x56 o 24x24)
window.parseEmotes = function(safeText) {
    let cleanText = safeText.trim();
    // Revisa si el mensaje son PURAS etiquetas de emotes separados por espacios
    let onlyEmotesRegex = /^(\s*:[a-zA-Z0-9_]+:\s*)+$/;
    let isOnlyEmotes = onlyEmotesRegex.test(cleanText);
    
    let size = isOnlyEmotes ? '56px' : '24px';
    
    // ✨ FIX: Truco CSS estilo Discord para centrar la imagen en medio del texto
    // Si va acompañado de texto, lo bajamos 6 pixeles para clavarlo en el centro de la letra
    let alignStyle = isOnlyEmotes ? 'vertical-align: middle;' : 'vertical-align: -6px; margin: 0 2px;';

    return cleanText.replace(/:([a-zA-Z0-9_]+):/g, (match, name) => {
        if (window.customEmotes[name]) {
            return `<img src="${window.customEmotes[name]}" style="width:${size}; height:${size}; ${alignStyle} display:inline-block;" alt="${name}" title=":${name}:" onerror="this.src='assets/default pfp.png';">`;
        }
        return match; 
    });
};

// 5. GUARDAR EMOTES RECIENTES
window.saveRecentEmote = function(emoteName) {
    let recents = JSON.parse(localStorage.getItem('mbw_recent_emotes') || "[]");
    recents = recents.filter(e => e !== emoteName); // Quita duplicados
    recents.unshift(emoteName); // Lo pone al inicio
    if(recents.length > 10) recents.pop(); // Máximo 10 recientes
    localStorage.setItem('mbw_recent_emotes', JSON.stringify(recents));
};

// ==========================================
// ✨ EL CHAT Y EL PANEL DISCORD
// ==========================================
window.openPrivateChat = function(otherUid, otherName, otherPfp = "assets/default pfp.png") {
    
    if (currentChatListener && currentChatId) {
        database.ref('private_chats/' + currentChatId).off('child_added', currentChatListener);
        database.ref('private_chats/' + currentChatId).off('child_changed');
    }
    if (window.typingListener && currentChatId && currentChatPartner) {
        database.ref('typing_status/' + currentChatId + '/' + currentChatPartner.uid).off('value', window.typingListener);
    }

    if (typeof window.openMpSidebar === 'function') window.openMpSidebar('chats');

    const myUID = localStorage.getItem('mbw_uid');
    currentChatId = myUID < otherUid ? myUID + "_" + otherUid : otherUid + "_" + myUID;
    currentChatPartner = { uid: otherUid, name: otherName, pfp: otherPfp };

    database.ref('user_chats/' + myUID + '/' + otherUid).update({ unreadCount: 0 });

    const placeholder = document.getElementById('full-chat-placeholder');
    const activePanel = document.getElementById('full-chat-active');
    const headerName = document.getElementById('full-chat-header-name');
    const headerPfp = document.getElementById('full-chat-header-pfp');
    const messagesContainer = document.getElementById('full-dm-messages');
    const dmInput = document.getElementById('full-dm-input');

    if (placeholder) placeholder.style.display = 'none';
    if (activePanel) activePanel.style.display = 'flex';
    if (headerName) headerName.innerText = otherName;
    if (headerPfp) headerPfp.style.backgroundImage = `url('${otherPfp}')`;
    if (messagesContainer) messagesContainer.innerHTML = ''; 

    const listContainer = document.getElementById('full-chat-list-container');
    if (listContainer) renderChatList(listContainer);

    // ✨ SEMÁFORO DE SONIDO (Evita la metralleta al cargar)
    let isHistoryLoaded = false;
    const chatRef = database.ref('private_chats/' + currentChatId);
    chatRef.once('value').then(() => { isHistoryLoaded = true; });

    let lastRenderedDate = ""; 
    
    // ✨ RENDERIZADO DE MENSAJES
    const renderBubble = (msg, msgKey) => {
        const isMe = msg.sender === myUID;
        const date = new Date(msg.timestamp || Date.now());
        const timeString = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

        // Sanitización y Emotes
        let textToRender = "";
        let extraStyle = "";

        if (msg.isDeleted) {
            textToRender = "🚫 Este mensaje fue eliminado";
            extraStyle = "font-style: italic; opacity: 0.6;";
        } else {
            let safeText = window.escapeHTML(msg.text);
            let emotedText = window.parseEmotes(safeText); // Convertir :nombres: a imágenes
            
            textToRender = emotedText.replace(/(?:x:\s*)?(-?\d+)\s*(?:,|y:)\s*(-?\d+)/gi, 
                '<span style="color: #3498db; text-decoration: underline; font-weight: bold; cursor: pointer;" onclick="if(window.camera !== undefined){camera.x=$1; camera.y=$2; window.worldDirty=true;} event.stopPropagation();" title="Teletransportar">[$1, $2]</span>'
            );
            if (msg.isEdited) textToRender += ' <span style="font-size: 11px; opacity: 0.6; margin-left: 6px;">(editado)</span>';
        }

        let replyHtml = '';
        if (msg.replyTo) {
            replyHtml = `
                <div style="background: rgba(0,0,0,0.15); border-left: 3px solid #f1c40f; padding: 5px 8px; margin-bottom: 8px; border-radius: 4px; font-family: Arial;">
                    <b style="display: block; font-size: 11px; color: #f1c40f;">${window.escapeHTML(msg.replyTo.senderName)}</b>
                    <span style="display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; font-size: 13px; opacity: 0.8;">${window.parseEmotes(window.escapeHTML(msg.replyTo.text))}</span>
                </div>
            `;
        }

        let ticksHtml = isMe ? `<span id="ticks-${msgKey}" style="color: ${msg.status === 'read' ? '#3498db' : '#bdc3c7'}; font-size: 13px; margin-left: 4px; font-weight: bold;">✓✓</span>` : '';

        return `
            ${replyHtml}
            <div id="msg-text-${msgKey}" style="margin-bottom: 2px; ${extraStyle}">${textToRender}</div>
            <div style="font-size: 10px; text-align: right; opacity: 0.7; margin-top: 4px; font-weight: bold;">
                ${timeString} ${ticksHtml}
            </div>
        `;
    };

    currentChatListener = chatRef.on('child_added', (snap) => {
        const msg = snap.val();
        const msgKey = snap.key;
        const isMe = msg.sender === myUID;

        if (!isMe && activePanel && activePanel.offsetWidth > 0 && currentChatPartner.uid === otherUid) {
            if (msg.status !== 'read') database.ref('private_chats/' + currentChatId + '/' + msgKey).update({ status: 'read' });
            if (isHistoryLoaded && typeof audioManager !== 'undefined') audioManager.playTone(600, 'sine', 0.05, 0.1);
        }

        const date = new Date(msg.timestamp || Date.now());
        const today = new Date();
        const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);

        let dateString = "";
        if (date.toDateString() === today.toDateString()) dateString = "Today";
        else if (date.toDateString() === yesterday.toDateString()) dateString = "Yesterday";
        else dateString = date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });

        if (dateString !== lastRenderedDate) {
            const sepDiv = document.createElement('div');
            sepDiv.style.textAlign = 'center'; sepDiv.style.margin = '15px 0'; sepDiv.style.width = '100%';
            sepDiv.innerHTML = `<span style="background: rgba(0,0,0,0.5); color: #ecf0f1; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-family: Arial, sans-serif; font-weight: bold; box-shadow: 0 1px 3px rgba(0,0,0,0.4); text-transform: capitalize;">${dateString}</span>`;
            if (messagesContainer) messagesContainer.appendChild(sepDiv);
            lastRenderedDate = dateString; 
        }

        const msgRow = document.createElement('div');
        msgRow.style.cssText = `display: flex; align-items: flex-end; gap: 8px; margin-bottom: 10px; width: 100%; flex-direction: ${isMe ? 'row-reverse' : 'row'};`;
        
        const avatarDiv = document.createElement('div');
        avatarDiv.style.cssText = `width: 32px; height: 32px; border-radius: 50%; background-image: url('${isMe ? localStorage.getItem('mbw_profile_pic') : currentChatPartner.pfp}'); background-size: cover; flex-shrink: 0;`;

        const bubbleDiv = document.createElement('div');
        bubbleDiv.style.cssText = `background: ${isMe ? '#0f172a' : '#243341'}; color: white; padding: 8px 12px 4px 12px; border-radius: ${isMe ? '15px 15px 0 15px' : '15px 15px 15px 0'}; max-width: 210px; font-family: Arial; font-size: 15px; box-shadow: 0 2px 5px rgba(0,0,0,0.2); word-wrap: break-word; cursor: pointer;`;
        
        bubbleDiv.innerHTML = renderBubble(msg, msgKey);

        bubbleDiv.addEventListener('contextmenu', (e) => {
            e.preventDefault(); e.stopPropagation();
            if (typeof window.showChatContextMenu === 'function') window.showChatContextMenu(e.clientX, e.clientY, msgKey, msg, isMe);
        });

        msgRow.appendChild(avatarDiv); msgRow.appendChild(bubbleDiv);
        if (messagesContainer) { messagesContainer.appendChild(msgRow); messagesContainer.scrollTop = messagesContainer.scrollHeight; }
    });

    chatRef.on('child_changed', (snap) => {
        const msg = snap.val();
        if (msg.sender === myUID) {
            const tick = document.getElementById(`ticks-${snap.key}`);
            if (tick) tick.style.color = msg.status === 'read' ? '#3498db' : '#bdc3c7';
        }
        const bubble = document.getElementById(`msg-text-${snap.key}`);
        if (bubble) bubble.parentElement.innerHTML = renderBubble(msg, snap.key);
    });

    // ✨ PANEL DISCORD Y BOTÓN
    if (dmInput && !document.getElementById('dm-emoji-btn')) {
        let emojiBtn = document.createElement('button');
        emojiBtn.id = 'dm-emoji-btn';
        emojiBtn.innerHTML = '😀';
        emojiBtn.style.cssText = "background: transparent; border: none; font-size: 22px; cursor: pointer; padding: 5px 10px; transition: 0.2s; filter: grayscale(100%) opacity(0.7); outline: none;";
        emojiBtn.onmouseover = () => emojiBtn.style.filter = 'grayscale(0%) opacity(1)';
        emojiBtn.onmouseout = () => emojiBtn.style.filter = 'grayscale(100%) opacity(0.7)';
        dmInput.parentNode.insertBefore(emojiBtn, dmInput.nextSibling);
        dmInput.parentNode.style.position = 'relative';

        const picker = document.createElement('div');
        picker.id = 'dm-emoji-picker';
        picker.style.cssText = "display: none; position: absolute; bottom: 60px; right: 20px; width: 432px; height: 350px; background: #2b2d31; border: 1px solid #1e1f22; border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.6); z-index: 10000; flex-direction: column; overflow: hidden; font-family: Arial;";
        
        // Estructura Interna del Panel
        picker.innerHTML = `
            <div style="display: flex; background: #1e1f22; border-bottom: 1px solid #000;">
                <div id="tab-btn-emotes" style="flex:1; padding: 10px; text-align: center; color: #fff; cursor: pointer; background: #313338; font-weight: bold; border-bottom: 2px solid #5865F2;">Emotes</div>
                <div id="tab-btn-emojis" style="flex:1; padding: 10px; text-align: center; color: #aaa; cursor: pointer; border-bottom: 2px solid transparent;">Emojis</div>
            </div>
            
            <div id="view-emotes" style="flex: 1; overflow-y: auto; padding: 10px; display: block;">
    <div style="font-size: 11px; font-weight: bold; color: #949ba4; margin-bottom: 8px;">Most used</div>
    <div id="emotes-recents-grid" style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 0px; justify-items: stretch;"></div>
    
    <div style="height: 1px; background: #3f4147; margin: 10px 0;"></div>
    
    <div style="font-size: 11px; font-weight: bold; color: #949ba4; margin-bottom: 8px;">All emotes</div>
    <div id="emotes-all-grid" style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 0px; justify-items: stretch;"></div>
</div>

            <div id="view-emojis" style="flex: 1; overflow-y: hidden; display: none; flex-direction: column;">
                <div id="emoji-subtabs" style="display: flex; background: #2b2d31; padding: 5px; border-bottom: 1px solid #1e1f22; gap: 0px; overflow-x: auto;"></div>
                <div id="emoji-scroll-area" style="flex: 1; overflow-y: auto; padding: 10px;"></div>
            </div>
        `;
        dmInput.parentNode.appendChild(picker);

        // Lógica de Pestañas
        const tEmotes = picker.querySelector('#tab-btn-emotes');
        const tEmojis = picker.querySelector('#tab-btn-emojis');
        const vEmotes = picker.querySelector('#view-emotes');
        const vEmojis = picker.querySelector('#view-emojis');

        tEmotes.onclick = () => { tEmotes.style.color='#fff'; tEmotes.style.background='#313338'; tEmotes.style.borderBottom='2px solid #5865F2'; tEmojis.style.color='#aaa'; tEmojis.style.background='transparent'; tEmojis.style.borderBottom='2px solid transparent'; vEmotes.style.display='block'; vEmojis.style.display='none'; };
        tEmojis.onclick = () => { tEmojis.style.color='#fff'; tEmojis.style.background='#313338'; tEmojis.style.borderBottom='2px solid #5865F2'; tEmotes.style.color='#aaa'; tEmotes.style.background='transparent'; tEmotes.style.borderBottom='2px solid transparent'; vEmojis.style.display='flex'; vEmotes.style.display='none'; };

        // Renderizar Emotes Internos
        const renderEmotesGrid = () => {
            const allGrid = picker.querySelector('#emotes-all-grid');
            const recGrid = picker.querySelector('#emotes-recents-grid');
            allGrid.innerHTML = ''; recGrid.innerHTML = '';
            
            const createBtn = (name) => {
                let div = document.createElement('div');
                div.style.cssText = "width: 48px; height: 48px; display: flex; justify-content: center; align-items: center; cursor: pointer; border-radius: 6px; transition: 0.1s;";
                div.innerHTML = `<img src="${window.customEmotes[name]}" style="max-width: 32px; max-height: 32px;" title=":${name}:" onerror="this.src='assets/default pfp.png';">`;
                div.onmouseover = () => div.style.background = '#404249';
                div.onmouseout = () => div.style.background = 'transparent';
                div.onclick = () => {
                    dmInput.value += ` :${name}: `;
                    window.saveRecentEmote(name);
                    renderEmotesGrid(); // Actualiza recientes
                    picker.style.display = 'none'; dmInput.focus();
                };
                return div;
            };

            Object.keys(window.customEmotes).forEach(name => allGrid.appendChild(createBtn(name)));
            let recents = JSON.parse(localStorage.getItem('mbw_recent_emotes') || "[]");
            if(recents.length === 0) recGrid.innerHTML = '<span style="color:#555; font-size:12px; grid-column: span 5;">No hay recientes</span>';
            recents.forEach(name => { if(window.customEmotes[name]) recGrid.appendChild(createBtn(name)); });
        };
        renderEmotesGrid();

        // Renderizar Emojis Estándar
        const subTabs = picker.querySelector('#emoji-subtabs');
        const scrollArea = picker.querySelector('#emoji-scroll-area');
        window.emojiCategories.forEach(cat => {
            // Subtab
            let st = document.createElement('div');
            st.innerHTML = cat.icon;
            st.style.cssText = "padding: 5px; cursor: pointer; font-size: 16px; border-radius: 4px; transition: 0.2s;";
            st.title = cat.name;
            st.onmouseover = () => st.style.background = '#404249';
            st.onmouseout = () => st.style.background = 'transparent';
            st.onclick = () => { scrollArea.querySelector(`#cat-${cat.id}`).scrollIntoView({behavior: 'smooth'}); };
            subTabs.appendChild(st);

            // Categoria en scroll
            let title = document.createElement('div');
            title.id = `cat-${cat.id}`;
            title.innerText = cat.name.toUpperCase();
            title.style.cssText = "font-size: 11px; font-weight: bold; color: #949ba4; margin: 10px 0 8px 0;";
            scrollArea.appendChild(title);

            let grid = document.createElement('div');
            grid.style.cssText = "display: grid; grid-template-columns: repeat(9, 1fr); gap: 0px;";
            cat.items.forEach(emo => {
                let eSpan = document.createElement('span');
                eSpan.innerText = emo;
                eSpan.style.cssText = "font-size: 32px; cursor: pointer; padding: 0px; border-radius: 4px; text-align: center;";
                eSpan.onmouseover = () => eSpan.style.background = '#404249';
                eSpan.onmouseout = () => eSpan.style.background = 'transparent';
                eSpan.onclick = () => { dmInput.value += emo; picker.style.display = 'none'; dmInput.focus(); };
                grid.appendChild(eSpan);
            });
            scrollArea.appendChild(grid);
        });

        // Toggle del panel
        emojiBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); picker.style.display = picker.style.display === 'none' ? 'flex' : 'none'; };
        document.addEventListener('click', (e) => { if (e.target !== emojiBtn && !picker.contains(e.target)) picker.style.display = 'none'; });
    }

    // ✨ OPTIMIZACIÓN ESCRIBIENDO... (THROTTLING)
    if (dmInput && !dmInput.hasAttribute('data-typing-listener')) {
        let typingTimeout; let isTyping = false;
        dmInput.addEventListener('input', function() {
            if (!currentChatId) return;
            if (!isTyping) { isTyping = true; database.ref('typing_status/' + currentChatId + '/' + myUID).set(true); }
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => { isTyping = false; database.ref('typing_status/' + currentChatId + '/' + myUID).set(false); }, 2000);
        });
        dmInput.setAttribute('data-typing-listener', 'true');
    }

    let typingIndicator = document.getElementById('dm-typing-indicator');
    if (!typingIndicator) {
        typingIndicator = document.createElement('div');
        typingIndicator.id = 'dm-typing-indicator';
        typingIndicator.style.cssText = `position: absolute; bottom: 65px; left: 0; width: 100%; padding: 40px 15px 10px 15px; color: #2ecc71; font-size: 22px; font-style: italic; font-family: 'Pixeltype', sans-serif; background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%); pointer-events: none; box-sizing: border-box; text-shadow: 2px 2px 2px #000; z-index: 99; display: none; transition: opacity 0.3s;`;
        if (activePanel) {
            activePanel.style.position = 'relative'; 
            activePanel.appendChild(typingIndicator);
        }
    }

    window.typingListener = database.ref('typing_status/' + currentChatId + '/' + otherUid).on('value', (snap) => {
        if (snap.val() === true) {
            typingIndicator.innerText = `${otherName} está escribiendo...`;
            typingIndicator.style.display = 'block';
            if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight;
        } else {
            typingIndicator.style.display = 'none';
        }
    });
};

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

    database.ref('friend_requests/' + myUID).on('value', (snapshot) => {
        const requests = snapshot.val();
        let pending = 0;
        if (requests) { for (let id in requests) { if (!requests[id].status) pending++; } }
        const badge = document.getElementById('badge-friends');
        if (badge) { badge.innerText = pending; badge.style.display = pending > 0 ? 'block' : 'none'; }
        if (typeof currentSidebarMode !== 'undefined' && currentSidebarMode === 'friends') {
            const content = document.getElementById('sidebar-content');
            if (content) renderFriendRequests(content);
        }
        window.updateGlobalMpBadge(); 
    });

    database.ref('friends/' + myUID).on('value', (snapshot) => {
        const friendsObj = snapshot.val();
        if (typeof misAmigosConfirmados !== 'undefined') misAmigosConfirmados = friendsObj ? Object.keys(friendsObj) : [];
        if(typeof window.renderPresenceList === 'function') window.renderPresenceList(); 
    });

    database.ref('user_chats/' + myUID).on('value', (snapshot) => {
        const chats = snapshot.val();
        let unreadUsers = 0; 
        if (chats) { for (let id in chats) { if (chats[id].unreadCount && chats[id].unreadCount > 0) unreadUsers++; } }
        const badgeMsgs = document.getElementById('badge-messages');
        if (badgeMsgs) { badgeMsgs.innerText = unreadUsers; badgeMsgs.style.display = unreadUsers > 0 ? 'block' : 'none'; }
        
        if (typeof currentSidebarMode !== 'undefined' && currentSidebarMode === 'chats') {
            const content = document.getElementById('full-chat-list-container');
            if (content) renderChatList(content);
        }
        window.updateGlobalMpBadge(); 
    });

    database.ref('server_invites/' + myUID).on('value', (snapshot) => {
        const invites = snapshot.val();
        let count = invites ? Object.keys(invites).length : 0;
        const badgeInv = document.getElementById('badge-invites');
        if (badgeInv) { badgeInv.innerText = count; badgeInv.style.display = count > 0 ? 'block' : 'none'; }
        if (typeof currentSidebarMode !== 'undefined' && currentSidebarMode === 'invites') {
            const content = document.getElementById('sidebar-content');
            if (content) renderServerInvites(content);
        }
        window.updateGlobalMpBadge(); 
    });

    const handleNewInvite = (snapshot) => {
        if (isInitialLoad) return; 
        const inv = snapshot.val();
        if (typeof audioManager !== 'undefined') audioManager.playTone(800, 'sine', 0.1, 0.3); 
        showDesktopNotification("🎮 " + inv.hostName + " invited you", "Map: " + inv.mapName, inv.hostPfp, () => {
            if (typeof openFileMenu === 'function') openFileMenu();
            setTimeout(() => { openMpSidebar('invites'); }, 100);
        });
    };
    database.ref('server_invites/' + myUID).on('child_added', handleNewInvite);
    database.ref('server_invites/' + myUID).on('child_changed', handleNewInvite);

    const handleNewMessage = (snapshot) => {
        if (isInitialLoad) return; 
        const chat = snapshot.val();
        
        // ✨ FIX: Inteligencia para NO lanzar notificación si ya lo estás viendo
        const activePanel = document.getElementById('full-chat-active');
        const isLookingAtThisChat = currentChatPartner && currentChatPartner.uid === snapshot.key && activePanel && activePanel.offsetWidth > 0;

        if (chat.unreadCount && chat.unreadCount > 0 && !isLookingAtThisChat) {
            if (typeof audioManager !== 'undefined') audioManager.playTone(600, 'sine', 0.1, 0.2);
            showDesktopNotification("💬 " + chat.name, chat.lastMsg, chat.pfp, () => {
                if (typeof openFileMenu === 'function') openFileMenu();
                setTimeout(() => { openMpSidebar('chats'); openPrivateChat(snapshot.key, chat.name, chat.pfp); }, 100);
            });
        }
    };
    database.ref('user_chats/' + myUID).on('child_added', handleNewMessage);
    database.ref('user_chats/' + myUID).on('child_changed', handleNewMessage);

    const handleNewFriendReq = (snapshot) => {
        if (isInitialLoad) return;
        const req = snapshot.val();
        if (req.status) return; 
        if (typeof audioManager !== 'undefined') audioManager.playTone(800, 'sine', 0.1, 0.3);
        showDesktopNotification("👥 Friend Request", req.username + " added you.", req.pfp, () => {
            if (typeof openFileMenu === 'function') openFileMenu();
            setTimeout(() => { openMpSidebar('friends'); }, 100);
        });
    };
    database.ref('friend_requests/' + myUID).on('child_added', handleNewFriendReq);

    setTimeout(() => { isInitialLoad = false; }, 2000);
};

let typingTimeout; // Temporizador global

function initMultiplayerModule() {
    setTimeout(initPresenceSystem, 1000);
    const dmInput = document.getElementById('full-dm-input');
    
    if (dmInput) {
        dmInput.addEventListener('keydown', function(e) { 
            if (e.key === 'Enter') sendPrivateMessage(); 
        });

        // ✨ NUEVO: Detectar cuando el usuario escribe
        dmInput.addEventListener('input', function() {
            if (!currentChatId) return;
            const myUID = localStorage.getItem('mbw_uid');
            
            // Avisar a Firebase que estamos escribiendo
            database.ref('typing_status/' + currentChatId + '/' + myUID).set(true);

            // Si dejamos de escribir por 2 segundos, avisar que paramos
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => {
                database.ref('typing_status/' + currentChatId + '/' + myUID).set(false);
            }, 2000);
        });
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMultiplayerModule);
} else {
    initMultiplayerModule();
}


// ==========================================
// ✨ CHAT PÚBLICO (ESTILO MINECRAFT CON LA TECLA T)
// ==========================================
let chatFadeTimeout;

window.agregarMensajeChatPublico = function(autor, texto) {
    const container = document.getElementById('chat-container');
    const messagesDiv = document.getElementById('chat-messages');
    const input = document.getElementById('chat-input');
    if (!messagesDiv || !container) return;

    // Crear el mensaje
    const msgDiv = document.createElement('div');
    msgDiv.innerHTML = `<span style="color: #f1c40f; font-weight:bold;">&lt;${autor}&gt;</span> <span style="color: white;">${texto}</span>`;
    messagesDiv.appendChild(msgDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    // Mostrar el contenedor. Si no estamos escribiendo en este momento, ocultamos la caja de texto.
    container.style.display = 'block';
    if (document.activeElement !== input) {
        input.style.display = 'none';
        
        // Auto-ocultar el chat entero después de 6 segundos de inactividad
        clearTimeout(chatFadeTimeout);
        chatFadeTimeout = setTimeout(() => {
            container.style.display = 'none';
        }, 6000);
    }
};

window.enviarChatPublico = function() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    
    // Solo enviar si hay texto y estamos conectados a un servidor
    if (text && isMultiplayer) {
        const myName = localStorage.getItem('mbw_username') || "Player";
        enviarMensajeEnRed({ tipo: "chat", autor: myName, texto: text });
        window.agregarMensajeChatPublico(myName, text); // Imprimir nuestro propio mensaje
    }
    
    input.value = '';
    input.blur();
    input.style.display = 'none';
    
    // Iniciar el temporizador para que el chat desaparezca después de enviar
    clearTimeout(chatFadeTimeout);
    chatFadeTimeout = setTimeout(() => {
        document.getElementById('chat-container').style.display = 'none';
    }, 6000);
};

// --- EL RADAR DEL TECLADO ---
document.addEventListener('keydown', function(e) {
    const input = document.getElementById('chat-input');
    const container = document.getElementById('chat-container');
    if (!input || !container) return;

    // 1. Si el usuario está escribiendo en cualquier otro lado (buscando bloques, guardando mapas), lo ignoramos.
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

    // 2. Si presiona 'T' y está en un servidor multijugador
    if ((e.key === 't' || e.key === 'T') && isMultiplayer) {
        e.preventDefault(); // Evitamos que la letra "t" se escriba solita
        
        container.style.display = 'block';
        input.style.display = 'block';
        
        // Detenemos el auto-ocultado mientras el jugador piensa qué escribir
        clearTimeout(chatFadeTimeout); 
        
        setTimeout(() => input.focus(), 10);
    }
});


// ==========================================
// ✨ MENÚ CONTEXTUAL DE CHAT (VERSIÓN CORREGIDA)
// ==========================================
window.editingMsgKey = null; 

window.showChatContextMenu = function(x, y, msgKey, msg, isMe) {
    let menu = document.getElementById('chat-context-menu');
    if (!menu) {
        menu = document.createElement('div');
        menu.id = 'chat-context-menu';
        // ✨ FIX: Z-index extremo para que nada lo tape
        menu.style.cssText = "position: fixed; background: #1e293b; border: 2px solid #34495e; border-radius: 6px; box-shadow: 0 4px 15px rgba(0,0,0,0.8); z-index: 9999999; display: flex; flex-direction: column; overflow: hidden; font-family: Arial, sans-serif; font-size: 14px; min-width: 140px;";
        document.body.appendChild(menu);
        
        // ✨ FIX: Cerrar con mousedown si hacemos clic fuera del menú
        document.addEventListener('mousedown', (e) => { 
            if (menu && !menu.contains(e.target)) menu.style.display = 'none'; 
        });
    }

    menu.innerHTML = ''; 
    
    // Opcion 1: Responder
    let replyBtn = document.createElement('div');
    replyBtn.innerHTML = "↩️ Reply";
    replyBtn.style.cssText = "padding: 10px 15px; cursor: pointer; color: white; border-bottom: 1px solid #34495e; transition: 0.2s;";
    replyBtn.onmouseover = () => replyBtn.style.background = '#2c3e50';
    replyBtn.onmouseout = () => replyBtn.style.background = 'transparent';
    replyBtn.onclick = () => {
        menu.style.display = 'none'; // Cerrar menú al hacer clic
        if (typeof window.setReply === 'function' && !msg.isDeleted) window.setReply(msgKey, msg.senderName, msg.text);
    };
    menu.appendChild(replyBtn);

    // Opciones 2 y 3: Editar y Borrar (Solo si es nuestro y no está borrado)
    if (isMe && !msg.isDeleted) {
        let editBtn = document.createElement('div');
        editBtn.innerHTML = "✏️ Edit";
        editBtn.style.cssText = "padding: 10px 15px; cursor: pointer; color: white; border-bottom: 1px solid #34495e; transition: 0.2s;";
        editBtn.onmouseover = () => editBtn.style.background = '#2c3e50';
        editBtn.onmouseout = () => editBtn.style.background = 'transparent';
        editBtn.onclick = () => {
            menu.style.display = 'none'; // Cerrar menú
            const input = document.getElementById('full-dm-input');
            if (input) {
                input.value = msg.text; 
                input.focus();
                window.editingMsgKey = msgKey; 
                let typingIndicator = document.getElementById('dm-typing-indicator');
                if (typingIndicator) {
                    typingIndicator.innerText = "Editando mensaje... (Enter para guardar)";
                    typingIndicator.style.display = 'block';
                    typingIndicator.style.color = "#f1c40f";
                }
            }
        };
        menu.appendChild(editBtn);

        let deleteBtn = document.createElement('div');
        deleteBtn.innerHTML = "🗑️ Delete";
        deleteBtn.style.cssText = "padding: 10px 15px; cursor: pointer; color: #e74c3c; font-weight: bold; transition: 0.2s;";
        deleteBtn.onmouseover = () => { deleteBtn.style.background = '#e74c3c'; deleteBtn.style.color = 'white'; };
        deleteBtn.onmouseout = () => { deleteBtn.style.background = 'transparent'; deleteBtn.style.color = '#e74c3c'; };
        deleteBtn.onclick = () => {
            menu.style.display = 'none'; // Cerrar menú
            if (window.currentChatId) {
                database.ref('private_chats/' + currentChatId + '/' + msgKey).update({
                    isDeleted: true,
                    text: "🚫 Este mensaje fue eliminado"
                });
            }
        };
        menu.appendChild(deleteBtn);
    }

    // Posicionar el menú usando las coordenadas del ratón en la pantalla
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.display = 'flex';
};