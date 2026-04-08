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
window.multiplayerPlayerLimit = 2; // Límite por defecto

// ✨ NUEVO: Lista maestra de jugadores en la sala actual
window.roomPlayers = [];

// ==========================================
// ✨ RENDER DE AVATARES ESTILO GOOGLE DOCS
// ==========================================
window.renderLivePlayers = function() {
    const container = document.getElementById('mp-live-players');
    if (!container) return;
    container.innerHTML = '';
    
    if (!isMultiplayer && !isHost) return; // Si no estamos conectados a nada, la lista se vacía

    const myUID = localStorage.getItem('mbw_uid');
    let drawnCount = 0; // Para calcular el margen negativo

    window.roomPlayers.forEach((p) => {
        if (p.uid === myUID) return; // 🚫 Regla: Nunca me dibujo a mí mismo

        // Margen negativo para que se empalmen (excepto el primero)
        let marginLeft = drawnCount > 0 ? '-10px' : '0';
        let zIndex = 100 - drawnCount; // El primero queda arriba del segundo

        container.innerHTML += `
            <div title="${p.name}" style="
                width: 28px; height: 28px; 
                border-radius: 50%; 
                border: 2px solid var(--bg-header); /* Borde del color de la barra para separarlos */
                background-color: #34495e; 
                background-image: url('${p.pfp}'); 
                background-size: cover; 
                background-position: center; 
                margin-left: ${marginLeft}; 
                z-index: ${zIndex}; 
                cursor: default; 
                box-shadow: 0 2px 4px rgba(0,0,0,0.3); 
                transition: transform 0.2s;" 
                onmouseover="this.style.transform='translateY(-2px)'" 
                onmouseout="this.style.transform='translateY(0)'">
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
    const buttons = document.querySelectorAll('.mp-limit-btn');
    buttons.forEach(btn => {
        if (parseInt(btn.innerText) === limit) {
            btn.classList.add('selected-limit');
        } else {
            btn.classList.remove('selected-limit');
        }
    });
};

window.setMpView = function(viewId) {
    const views = ['home', 'create-1', 'create-2', 'join'];
    views.forEach(v => {
        const el = document.getElementById('mp-view-' + v);
        if (el) el.style.display = 'none';
    });
    
    const target = document.getElementById('mp-view-' + viewId);
    if (target) target.style.display = 'block';
    
    if (viewId === 'join') {
        window.loadPublicServers();
    }

    // ✨ NUEVO: Si el usuario se arrepiente y regresa al menú anterior, destruimos la sala
    if ((viewId === 'home' || viewId === 'create-1') && isHost) {
        if (peer) {
            peer.destroy(); // Desconecta el servidor P2P
            peer = null;
        }
        if (window.myRoomRef) {
            window.myRoomRef.remove(); // Borra la sala de Firebase
            window.myRoomRef = null;
        }
        isHost = false;
        isMultiplayer = false;
        window.roomPlayers = [];
        renderLivePlayers(); // Vaciamos los avatares de Google Docs
        const statusText = document.getElementById('multiplayer-status');
        if (statusText) statusText.style.display = 'none';
    }
};

window.copyRoomId = function() {
    const copyText = document.getElementById("my-peer-id");
    if (!copyText || !copyText.value) return;
    
    copyText.select();
    copyText.setSelectionRange(0, 99999); 
    navigator.clipboard.writeText(copyText.value).then(() => {
        const hint = document.getElementById("copy-hint");
        if (hint) {
            hint.style.visibility = "visible";
            setTimeout(() => { hint.style.visibility = "hidden"; }, 2000);
        }
    });
};


// ==========================================
// EL ANFITRIÓN CREA LA SALA
// ==========================================
window.hostMultiplayerSession = function() {
    // ✨ NUEVO: Evitar salas duplicadas destruyendo la anterior si hacen clic varias veces
    if (peer) {
        peer.destroy();
    }
    if (window.myRoomRef) {
        window.myRoomRef.remove();
    }

    const statusText = document.getElementById('multiplayer-status');
    if (statusText) {
        statusText.style.display = 'block';
        statusText.innerText = "Status: Creating Server...";
        statusText.style.color = "#f1c40f";
    }

    isHost = true;
    misClientes = []; 
    peer = new Peer(); 

    peer.on('open', function(id) {
        const peerInput = document.getElementById('my-peer-id');
        if (peerInput) peerInput.value = id;
        
        if (statusText) statusText.innerText = `Status: Waiting for players (1/${window.multiplayerPlayerLimit})`;
        
        const hostName = localStorage.getItem('mbw_username') || "Player";
        const myPfp = localStorage.getItem('mbw_profile_pic') || "assets/default pfp.png";
        const myUID = localStorage.getItem('mbw_uid');
        const filenameDisplay = document.getElementById("filename-display");
        const mapName = filenameDisplay && filenameDisplay.value ? filenameDisplay.value : "Survival Map";
        
        // ✨ Agregamos al Host a la lista maestra de la sala
        window.roomPlayers = [{ uid: myUID, name: hostName, pfp: myPfp, peerId: id }];
        isMultiplayer = true;
        renderLivePlayers();

        let mapThumb = "";
        if (typeof projectTemplates !== 'undefined') {
            const template = projectTemplates.find(t => t.name === mapName || t.filename.includes(mapName));
            if (template) mapThumb = template.image;
        }
        if (!mapThumb && typeof mbwom !== 'undefined' && mbwom.world && mbwom.world.thumb) {
            mapThumb = mbwom.world.thumb;
        }

        window.myRoomRef = database.ref('servers/' + id);
        window.myRoomRef.set({
            hostName: hostName,
            mapName: mapName,
            mapThumb: mapThumb,
            currentPlayers: 1,
            maxPlayers: window.multiplayerPlayerLimit,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });

        window.myRoomRef.onDisconnect().remove();
    });

    peer.on('connection', function(conn) {
        if (misClientes.length >= window.multiplayerPlayerLimit - 1) {
            conn.on('open', () => {
                conn.send({ tipo: "error_conexion", mensaje: "Server is full." });
                setTimeout(() => conn.close(), 500);
            });
            return;
        }
        setupHostConnection(conn);
    });
};

// ==========================================
// EL CLIENTE SE CONECTA
// ==========================================
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
        if (statusText) {
            statusText.innerText = "Status: Connection Error";
            statusText.style.color = "#e74c3c";
        }
        alert("Could not connect. The room might be closed or full.");
    });
};

function setupHostConnection(conn) {
    conn.on('open', function() {
        misClientes.push(conn);
        isMultiplayer = true;
        
        const statusText = document.getElementById('multiplayer-status');
        if (statusText) {
            statusText.innerText = `Status: ${misClientes.length + 1}/${window.multiplayerPlayerLimit} Players 🟢`;
            statusText.style.color = "#4CAF50";
        }
        
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
            misClientes.forEach(cliente => {
                if (cliente.peer !== conn.peer && cliente.open) cliente.send(data);
            });
        }
    });

    conn.on('close', function() {
        misClientes = misClientes.filter(c => c.peer !== conn.peer);
        // ✨ Alguien salió, lo borramos de la lista de avatares y avisamos al resto
        window.roomPlayers = window.roomPlayers.filter(p => p.peerId !== conn.peer);
        renderLivePlayers();
        enviarMensajeEnRed({ tipo: "sync_players", players: window.roomPlayers });

        const statusText = document.getElementById('multiplayer-status');
        if (statusText) {
            statusText.innerText = `Status: ${misClientes.length + 1}/${window.multiplayerPlayerLimit} Players 🟢`;
        }
        if (window.myRoomRef) window.myRoomRef.update({ currentPlayers: misClientes.length + 1 });
        enviarMensajeEnRed({ tipo: "chat", autor: "System", texto: "Un jugador se desconectó." });
    });
}

function setupClientConnection(conn) {
    conn.on('open', function() {
        isMultiplayer = true;
        const statusText = document.getElementById('multiplayer-status');
        if (statusText) {
            statusText.innerText = "Status: CONNECTED! 🟢";
            statusText.style.color = "#4CAF50";
        }

        // ✨ El cliente le envía su foto y su nombre al host apenas entra
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
        window.roomPlayers = []; // Me desconecté, vacío los avatares
        renderLivePlayers();

        const statusText = document.getElementById('multiplayer-status');
        if (statusText) {
            statusText.innerText = "Status: Disconnected 🔴";
            statusText.style.color = "#e74c3c";
        }
        alert("Disconnected from Server.");
    });
}

// ==========================================
// ✨ BUSCADOR DE SERVIDORES (EN TIEMPO REAL)
// ==========================================
window.loadPublicServers = function() {
    const listDiv = document.getElementById('public-servers-list');
    if (!listDiv) return;
    listDiv.innerHTML = '<p style="text-align: center; color: #bdc3c7; font-size: 24px;">Searching for worlds...</p>';

    // 1. Apagamos cualquier "escucha" anterior para evitar que se dupliquen los datos en pantalla
    database.ref('servers').off('value');

    // 2. ✨ CAMBIO CLAVE: Usamos .on() para escuchar los cambios en vivo y en directo
    database.ref('servers').on('value', (snapshot) => {
        const servers = snapshot.val();
        listDiv.innerHTML = ''; 

        if (!servers) {
            listDiv.innerHTML = '<p style="text-align: center; color: #95a5a6; font-size: 24px; margin-top: 15px;">No public servers available right now.</p>';
            return;
        }

        for (let id in servers) {
            let s = servers[id];

            // Auto-limpieza de servidores fantasma o corruptos
            if (!s || !s.hostName || s.hostName === 'undefined' || s.hostName === 'null') {
                database.ref('servers/' + id).remove(); 
                continue; 
            }

            let isFull = s.currentPlayers >= s.maxPlayers;
            
            let isAlreadyJoined = false;
            if (isMultiplayer) {
                if (isHost && peer && peer.id === id) {
                    isAlreadyJoined = true;
                } else if (!isHost && miConexionAlHost && miConexionAlHost.peer === id) {
                    isAlreadyJoined = true;
                }
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

            let btnHtml = `
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
            listDiv.innerHTML += btnHtml;
        }
    });
}

// FUNCIONES DE RED
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
    // ✨ RECEPCIÓN DE DATOS DE AVATARES ✨
    if (datos.tipo === "player_info" && isHost) {
        // El anfitrión recibe la foto del cliente y lo agrega a la lista
        if (!window.roomPlayers.find(p => p.uid === datos.uid)) {
            window.roomPlayers.push({ uid: datos.uid, name: datos.name, pfp: datos.pfp, peerId: datos.peerId });
        }
        renderLivePlayers(); // El anfitrión dibuja sus propios avatares
        enviarMensajeEnRed({ tipo: "sync_players", players: window.roomPlayers }); // El anfitrión reparte la lista a todos los demás
    }
    
    if (datos.tipo === "sync_players") {
        // Los clientes reciben la lista completa del anfitrión y la dibujan
        window.roomPlayers = datos.players;
        renderLivePlayers();
    }

    if (datos.tipo === "chat") {
        if (typeof audioManager !== 'undefined') audioManager.playTone(800, 'sine', 0.1, 0.2); 
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
                    mbwom.mobs[mId] = m;
                    mbwom.mobs[mId].x = Number(m.x) || 0;
                    mbwom.mobs[mId].y = Number(m.y) || 0;
                    mbwom.mobs[mId].scene = sceneId;
                }
            }
        }
        if (typeof initializeWorldCache === 'function') initializeWorldCache(); 
        if (typeof worldDirty !== 'undefined') worldDirty = true; 
        if (!window.isMainLoopRunning && typeof mainLoop === 'function') { mainLoop(); window.isMainLoopRunning = true; }
        const filenameDisplay = document.getElementById("filename-display"); 
        if (filenameDisplay && mbwom.world.fileInfo) filenameDisplay.value = mbwom.world.fileInfo.name || "Multiplayer World";
        
        if (typeof closeFileMenu === 'function') closeFileMenu();
        alert("¡Mundo descargado con éxito! Bienvenido al servidor.");
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
    if (datos.tipo === "cursor") {
        window.networkCursors[datos.autor] = { x: datos.x, y: datos.y, lastUpdate: Date.now() };
        if (typeof worldDirty !== 'undefined') worldDirty = true;
    }
}


// ==========================================
// ✨ SISTEMA DE PRESENCIA GLOBAL (¿Quién está online?)
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
                myPresenceRef = onlineUsersRef.push();
                myPresenceRef.onDisconnect().remove().then(() => {
                    const myName = localStorage.getItem('mbw_username') || "Player";
                    const myPfp = localStorage.getItem('mbw_profile_pic') || localStorage.getItem('mbw_pfp') || "assets/default pfp.png";

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
        const users = snapshot.val();
        const listContainer = document.getElementById('mp-online-users-list');
        
        if (listContainer) listContainer.innerHTML = '';
        if (!users) return;

        let htmlContent = '';

        for (let key in users) {
            const u = users[key];
            const isMe = (myPresenceRef && key === myPresenceRef.key);
            const isFriend = misAmigosConfirmados.includes(u.uid);

            htmlContent += `
                <div style="background: rgba(0,0,0,0.4); border: 2px solid ${isMe ? '#2ecc71' : (isFriend ? '#f1c40f' : '#7f8c8d')}; padding: 10px; display: flex; align-items: center; gap: 12px; border-radius: 6px;">
                    <div style="width: 40px; height: 40px; border-radius: 50%; background-image: url('${u.pfp}'); background-size: cover; background-position: center; border: 2px solid #bdc3c7;"></div>
                    <span style="color: white; font-family: 'Pixeltype', sans-serif; font-size: 26px;">${u.username}</span>
                    ${isFriend ? '<span title="Amigos" style="font-size: 16px;">⭐</span>' : ''}
                    
                    ${isMe ? 
                        '<span style="color: #2ecc71; font-size: 16px; margin-left: auto; font-weight: bold;">(Tú)</span>' 
                        : 
                        `<div style="margin-left: auto; display: flex; gap: 8px;">
                            ${!isFriend ? `<button onclick="sendFriendRequest('${u.uid}', '${u.username}')" style="background: #e67e22; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; color: white; font-size: 16px; transition: 0.2s;" onmouseover="this.style.background='#d35400'" onmouseout="this.style.background='#e67e22'" title="Añadir amigo">➕ Amigo</button>` : ''}
                            ${isFriend ? `<button onclick="openPrivateChat('${u.uid}', '${u.username}', '${u.pfp}')" style="background: transparent; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; color: white; font-size: 16px; transition: 0.2s;" onmouseover="this.style.background='#2980b9'" onmouseout="this.style.background='transparent'" title="Enviar mensaje">💬</button>` : ''}
                        </div>`
                    }
                </div>
            `;
        }

        if (listContainer) listContainer.innerHTML = htmlContent;
    });
}


// ==========================================
// ✨ LÓGICA DE AMIGOS Y CHAT PRIVADO (DM)
// ==========================================

let currentChatId = null;
let currentChatListener = null;
let misAmigosConfirmados = [];

window.sendFriendRequest = function(targetUid, targetName) {
    const myUID = localStorage.getItem('mbw_uid');
    const myName = localStorage.getItem('mbw_username') || "Player";
    const myPfp = localStorage.getItem('mbw_profile_pic') || localStorage.getItem('mbw_pfp') || "assets/default pfp.png";

    database.ref('friend_requests/' + targetUid + '/' + myUID).set({
        uid: myUID,
        username: myName,
        pfp: myPfp,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    
    alert("¡Solicitud de amistad enviada a " + targetName + "!");
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

let currentChatPartner = null; 

window.openPrivateChat = function(otherUid, otherName, otherPfp = "assets/default pfp.png") {
    const myUID = localStorage.getItem('mbw_uid');
    currentChatId = myUID < otherUid ? myUID + "_" + otherUid : otherUid + "_" + myUID;
    
    currentChatPartner = { uid: otherUid, name: otherName, pfp: otherPfp };

    document.getElementById('dm-title').innerText = "💬 " + otherName;
    document.getElementById('mp-right-sidebar').style.display = 'flex';
    document.getElementById('sidebar-list-view').style.display = 'none';
    document.getElementById('sidebar-chat-view').style.display = 'flex';
    
    const messagesContainer = document.getElementById('dm-messages');
    if (messagesContainer) messagesContainer.innerHTML = ''; 
    
    if (currentChatListener) {
        database.ref('private_chats/' + currentChatId).off('child_added', currentChatListener);
    }

    const chatRef = database.ref('private_chats/' + currentChatId);
    currentChatListener = chatRef.on('child_added', (snap) => {
        const msg = snap.val();
        const isMe = msg.sender === myUID;
        
        // 1. Obtener la foto correcta (La mía o la de mi amigo)
        const myPfp = localStorage.getItem('mbw_profile_pic') || "assets/default pfp.png";
        const avatarUrl = isMe ? myPfp : currentChatPartner.pfp;

        // 2. Contenedor de la fila (Alineado a la derecha o izquierda según quién envíe)
        const msgRow = document.createElement('div');
        msgRow.style.display = 'flex';
        msgRow.style.alignItems = 'flex-end'; // La foto se alinea a la parte de abajo de la burbuja
        msgRow.style.gap = '8px';
        msgRow.style.marginBottom = '10px';
        msgRow.style.width = '100%';
        msgRow.style.flexDirection = isMe ? 'row-reverse' : 'row'; // Invertir si soy yo

        // 3. El círculo de la foto de perfil
        const avatarDiv = document.createElement('div');
        avatarDiv.style.width = '26px';
        avatarDiv.style.height = '26px';
        avatarDiv.style.borderRadius = '50%';
        avatarDiv.style.backgroundImage = `url('${avatarUrl}')`;
        avatarDiv.style.backgroundSize = 'cover';
        avatarDiv.style.backgroundPosition = 'center';
        avatarDiv.style.flexShrink = '0';
        avatarDiv.style.border = '1px solid rgba(255,255,255,0.3)';

        // 4. La burbuja de texto estilo red social
        const bubbleDiv = document.createElement('div');
        bubbleDiv.style.background = isMe ? '#2ecc71' : '#3498db';
        bubbleDiv.style.color = 'white';
        bubbleDiv.style.padding = '10px 14px';
        // Magia CSS: Hace que la "colita" de la burbuja apunte a la foto de perfil
        bubbleDiv.style.borderRadius = isMe ? '15px 15px 0 15px' : '15px 15px 15px 0';
        bubbleDiv.style.maxWidth = '210px';
        bubbleDiv.style.fontFamily = "Arial, sans-serif";
        bubbleDiv.style.fontSize = "15px";
        bubbleDiv.style.lineHeight = "1.3";
        bubbleDiv.style.boxShadow = "0 2px 5px rgba(0,0,0,0.2)";
        bubbleDiv.style.wordWrap = "break-word";
        bubbleDiv.innerText = msg.text;

        // 5. Ensamblar e inyectar en la pantalla
        msgRow.appendChild(avatarDiv);
        msgRow.appendChild(bubbleDiv);

        if (messagesContainer) {
            messagesContainer.appendChild(msgRow);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        if (!isMe && typeof audioManager !== 'undefined') audioManager.playTone(600, 'sine', 0.05, 0.1);
    });
}

window.sendPrivateMessage = function() {
    const input = document.getElementById('dm-input');
    const text = input.value.trim();
    if (!text || !currentChatId || !currentChatPartner) return;
    
    const myUID = localStorage.getItem('mbw_uid');
    const myName = localStorage.getItem('mbw_username') || "Player";
    const myPfp = localStorage.getItem('mbw_profile_pic') || "assets/default pfp.png";
    
    const timestamp = firebase.database.ServerValue.TIMESTAMP;

    database.ref('private_chats/' + currentChatId).push({
        sender: myUID,
        senderName: myName,
        text: text,
        timestamp: timestamp
    });

    database.ref('user_chats/' + myUID + '/' + currentChatPartner.uid).set({
        name: currentChatPartner.name,
        pfp: currentChatPartner.pfp,
        lastMsg: text,
        timestamp: timestamp
    });

    database.ref('user_chats/' + currentChatPartner.uid + '/' + myUID).set({
        name: myName,
        pfp: myPfp,
        lastMsg: text,
        timestamp: timestamp
    });
    
    input.value = ''; 
    input.focus();
}

// ==========================================
// ✨ CONTROL DE LA BARRA LATERAL (LOBBY)
// ==========================================

let currentSidebarMode = ''; 

window.openMpSidebar = function(mode) {
    const sidebar = document.getElementById('mp-right-sidebar');
    const title = document.getElementById('sidebar-title');
    const content = document.getElementById('sidebar-content');
    const listView = document.getElementById('sidebar-list-view');
    const chatView = document.getElementById('sidebar-chat-view');
    
    if (sidebar) sidebar.style.display = 'flex';
    if (listView) listView.style.display = 'flex';
    if (chatView) chatView.style.display = 'none';
    
    currentSidebarMode = mode;

    if (mode === 'friends') {
        if (title) title.innerText = '👥 Solicitudes';
        if (content) renderFriendRequests(content);
        const badgeFriends = document.getElementById('badge-friends');
        if (badgeFriends) badgeFriends.style.display = 'none'; 
    } else if (mode === 'chats') {
        if (title) title.innerText = '💬 Mis Chats';
        if (content) renderChatList(content);
        const badgeMessages = document.getElementById('badge-messages');
        if (badgeMessages) badgeMessages.style.display = 'none'; 
    }
}

window.closeMpSidebar = function() {
    const sidebar = document.getElementById('mp-right-sidebar');
    if (sidebar) sidebar.style.display = 'none';
}

window.backToSidebarList = function() {
    const chatView = document.getElementById('sidebar-chat-view');
    const listView = document.getElementById('sidebar-list-view');
    
    if (chatView) chatView.style.display = 'none';
    if (listView) listView.style.display = 'flex';
    
    if (currentChatListener && currentChatId) {
        database.ref('private_chats/' + currentChatId).off('child_added', currentChatListener);
    }
}

window.renderChatList = function(container) {
    const myUID = localStorage.getItem('mbw_uid');
    
    database.ref('user_chats/' + myUID).on('value', (snapshot) => {
        const myChats = snapshot.val();
        container.innerHTML = '';
        
        if (!myChats) {
            container.innerHTML = '<p style="color: #bdc3c7; text-align: center; font-size: 20px; margin-top: 20px;">No tienes mensajes activos.</p>';
            return;
        }

        const sorted = Object.keys(myChats).map(uid => ({uid, ...myChats[uid]}))
                       .sort((a, b) => b.timestamp - a.timestamp);

        sorted.forEach(chat => {
            container.innerHTML += `
                <div style="background: rgba(0,0,0,0.3); padding: 12px; display: flex; align-items: center; gap: 12px; border-radius: 6px; border-left: 4px solid #3498db; cursor: pointer; transition: 0.2s;" 
                     onmouseover="this.style.background='rgba(52, 152, 219, 0.2)'" 
                     onmouseout="this.style.background='rgba(0,0,0,0.3)'" 
                     onclick="openPrivateChat('${chat.uid}', '${chat.name}', '${chat.pfp}')">
                    
                    <div style="width: 45px; height: 45px; border-radius: 50%; background-image: url('${chat.pfp}'); background-size: cover; background-position: center; border: 2px solid #FFF; flex-shrink: 0;"></div>
                    
                    <div style="flex: 1; overflow: hidden;">
                        <div style="color: white; font-size: 24px; font-family: 'Pixeltype', sans-serif;">${chat.name}</div>
                        <div style="color: #bdc3c7; font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: Arial;">${chat.lastMsg}</div>
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
        
        if (!requests) {
            container.innerHTML = '<p style="color: #bdc3c7; text-align: center; font-size: 24px;">No hay solicitudes.</p>';
            return;
        }

        let pendingCount = 0;

        Object.keys(requests).reverse().forEach(senderUid => {
            let req = requests[senderUid];
            let statusHtml = '';
            
            if (req.status === 'accepted') {
                statusHtml = '<span style="color: #2ecc71; font-size: 20px;">✔️ Aceptado</span>';
            } else if (req.status === 'rejected') {
                statusHtml = '<span style="color: #e74c3c; font-size: 20px;">❌ Rechazado</span>';
            } else {
                pendingCount++;
                statusHtml = `
                    <button onclick="acceptFriendRequest('${senderUid}'); openMpSidebar('friends');" style="background: #2ecc71; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 20px;">Aceptar</button>
                    <button onclick="declineFriendRequest('${senderUid}'); openMpSidebar('friends');" style="background: #e74c3c; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 20px;">Ignorar</button>
                `;
            }

            container.innerHTML += `
                <div style="background: rgba(0,0,0,0.2); padding: 10px; display: flex; align-items: center; gap: 10px; border-radius: 4px; border-left: 3px solid ${req.status ? '#7f8c8d' : '#f1c40f'};">
                    <div style="width: 40px; height: 40px; border-radius: 50%; background-image: url('${req.pfp}'); background-size: cover; background-position: center; border: 2px solid white;"></div>
                    <div style="flex: 1;">
                        <div style="color: white; font-size: 26px;">${req.username}</div>
                        <div style="display: flex; gap: 5px; margin-top: 5px;">${statusHtml}</div>
                    </div>
                </div>
            `;
        });

        const badge = document.getElementById('badge-friends');
        if (badge) {
            badge.innerText = pendingCount;
            badge.style.display = pendingCount > 0 ? 'block' : 'none';
        }
    });
}

window.startFriendListeners = function() {
    const myUID = localStorage.getItem('mbw_uid');
    if(!myUID) return;

    database.ref('friend_requests/' + myUID).on('value', (snapshot) => {
        const requests = snapshot.val();
        let pending = 0;
        if (requests) {
            for (let id in requests) {
                if (!requests[id].status) pending++;
            }
        }
        const badge = document.getElementById('badge-friends');
        if (badge) {
            badge.innerText = pending;
            badge.style.display = pending > 0 ? 'block' : 'none';
        }
        
        if (typeof currentSidebarMode !== 'undefined' && currentSidebarMode === 'friends') {
            const content = document.getElementById('sidebar-content');
            if (content) renderFriendRequests(content);
        }
    });

    database.ref('friends/' + myUID).on('value', (snapshot) => {
        const friendsObj = snapshot.val();
        if (typeof misAmigosConfirmados !== 'undefined') {
            misAmigosConfirmados = friendsObj ? Object.keys(friendsObj) : [];
        }
        if(typeof initPresenceSystem === 'function') initPresenceSystem(true); 
    });
}

// INICIALIZACIÓN INTELIGENTE
function initMultiplayerModule() {
    setTimeout(initPresenceSystem, 1000);
    const dmInput = document.getElementById('dm-input');
    if (dmInput) {
        dmInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') sendPrivateMessage();
        });
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMultiplayerModule);
} else {
    initMultiplayerModule();
}