// ==========================================
// ✨ MOTOR MULTIJUGADOR P2P (HASTA 6 JUGADORES)
// ==========================================

let peer = null;
let isMultiplayer = false;
let isHost = false; // ¿Soy yo el creador de la sala?

// HOST: Lista de jugadores conectados a mí
let misClientes = []; 

// CLIENTE: Mi cable directo hacia el Host
let miConexionAlHost = null; 

window.networkCursors = {};

// 1. EL ANFITRIÓN (HOST) CREA LA SALA
window.hostMultiplayerSession = function() {
    document.getElementById('multiplayer-status').innerText = "Status: Creating Server...";
    document.getElementById('multiplayer-status').style.color = "#f1c40f";

    isHost = true;
    misClientes = []; 
    peer = new Peer(); 

    peer.on('open', function(id) {
        document.getElementById('my-peer-id').value = id;
        document.getElementById('multiplayer-status').innerText = `Status: Waiting for players (1/${multiplayerPlayerLimit})`;
        console.log("¡Sala creada! Mi ID es: " + id);
    });

    peer.on('connection', function(conn) {
        // Comprobar si la sala está llena (El Host cuenta como 1)
        if (misClientes.length >= multiplayerPlayerLimit - 1) {
            console.log("Conexión rechazada: Sala llena.");
            conn.on('open', () => {
                conn.send({ tipo: "error_conexion", mensaje: "El servidor está lleno." });
                setTimeout(() => conn.close(), 500);
            });
            return;
        }
        setupHostConnection(conn);
    });

    peer.on('error', function(err) {
        console.error("Error en Peer:", err);
        alert("Error de conexión: " + err.type);
    });
};

// 2. EL CLIENTE (INVITADO) SE CONECTA A LA SALA
window.joinMultiplayerSession = function() {
    const hostId = document.getElementById('join-peer-id').value.trim();
    if (!hostId) { alert("Please enter a Room ID!"); return; }

    document.getElementById('multiplayer-status').innerText = "Status: Connecting...";
    
    isHost = false;
    peer = new Peer(); 

    peer.on('open', function() {
        console.log("Conectando al host: " + hostId);
        miConexionAlHost = peer.connect(hostId);
        setupClientConnection(miConexionAlHost);
    });

    peer.on('error', function(err) {
        console.error("Error en Peer:", err);
        document.getElementById('multiplayer-status').innerText = "Status: Connection Error";
        alert("No se pudo conectar. Revisa el ID.");
    });
};

// 3.A PREPARAR EL CABLE DEL HOST HACIA UN CLIENTE
function setupHostConnection(conn) {
    conn.on('open', function() {
        misClientes.push(conn);
        isMultiplayer = true;
        
        document.getElementById('multiplayer-status').innerText = `Status: ${misClientes.length + 1}/${multiplayerPlayerLimit} Players 🟢`;
        document.getElementById('multiplayer-status').style.color = "#4CAF50";
        
        const chatContainer = document.getElementById('chat-container');
        if (chatContainer) chatContainer.style.display = 'block';

        enviarMensajeEnRed({ tipo: "chat", autor: "System", texto: "Un jugador se ha unido al servidor." });
    });

    conn.on('data', function(data) {
        // 1. El host dibuja los cambios en su propia pantalla
        recibirMensajeDeRed(data);
        
        // 2. EL HOST RETRANSMITE: Le avisa a todos los demás invitados de lo que pasó
        if (!data.retransmitido) {
            data.retransmitido = true;
            misClientes.forEach(cliente => {
                if (cliente.peer !== conn.peer && cliente.open) { 
                    cliente.send(data);
                }
            });
        }
    });

    conn.on('close', function() {
        misClientes = misClientes.filter(c => c.peer !== conn.peer); // Quitar de la lista
        document.getElementById('multiplayer-status').innerText = `Status: ${misClientes.length + 1}/${multiplayerPlayerLimit} Players 🟢`;
        enviarMensajeEnRed({ tipo: "chat", autor: "System", texto: "Un jugador se desconectó." });
        
        if (misClientes.length === 0) {
            document.getElementById('multiplayer-status').innerText = `Status: Waiting for players (1/${multiplayerPlayerLimit})`;
        }
    });
}

// 3.B PREPARAR EL CABLE DEL CLIENTE HACIA EL HOST
function setupClientConnection(conn) {
    conn.on('open', function() {
        isMultiplayer = true;
        document.getElementById('multiplayer-status').innerText = "Status: CONNECTED! 🟢";
        document.getElementById('multiplayer-status').style.color = "#4CAF50";
        
        const chatContainer = document.getElementById('chat-container');
        if (chatContainer) chatContainer.style.display = 'block';
    });

    conn.on('data', function(data) {
        if (data.tipo === "error_conexion") {
            alert(data.mensaje);
            conn.close();
            return;
        }
        recibirMensajeDeRed(data);
    });

    conn.on('close', function() {
        isMultiplayer = false;
        miConexionAlHost = null;
        document.getElementById('multiplayer-status').innerText = "Status: Disconnected 🔴";
        document.getElementById('multiplayer-status').style.color = "#e74c3c";
        
        const chatContainer = document.getElementById('chat-container');
        if (chatContainer) chatContainer.style.display = 'none';
        alert("El servidor se ha cerrado o te has desconectado.");
    });
}

// 4. FUNCIONES DE ENVÍO INTELIGENTE (Host vs Invitado)
window.enviarMensajeEnRed = function(datos) {
    if (!isMultiplayer) return;

    if (isHost) {
        datos.retransmitido = true; // El Host grita a todos
        misClientes.forEach(cliente => {
            if (cliente.open) cliente.send(datos);
        });
    } else {
        // El Invitado le susurra solo al Host
        if (miConexionAlHost && miConexionAlHost.open) {
            miConexionAlHost.send(datos);
        }
    }
}

// 5. PROCESAR MENSAJES (El Cerebro)
function recibirMensajeDeRed(datos) {

    // A. Chat
    if (datos.tipo === "chat") {
        if (typeof addMessageToChat === 'function') addMessageToChat(datos.autor || "Player", datos.texto);
        if (typeof audioManager !== 'undefined') audioManager.playTone(800, 'sine', 0.1, 0.2); 
    }
    
    // B. Sincronización total (Mundo completo)
    if (datos.tipo === "sync_mundo") {
        console.log("🌍 ¡Recibiendo mapa completo!");
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
        
        if (!window.isMainLoopRunning && typeof mainLoop === 'function') {
            mainLoop(); 
            window.isMainLoopRunning = true;
        }

        const filenameDisplay = document.getElementById("filename-display"); 
        if (filenameDisplay && mbwom.world.fileInfo) {
            filenameDisplay.value = mbwom.world.fileInfo.name || "Multiplayer World";
        }
        alert("¡Mundo recibido! Ya puedes moverte.");
    }

    // C. Actualización de bloques
    if (datos.tipo === "actualizar_bloque") {
        if (typeof mbwom !== 'undefined' && mbwom.scene) { 
            if (datos.estado === null) {
                if (mbwom.scene[datos.x]) delete mbwom.scene[datos.x][datos.y];
            } else {
                mbwom.setBlockState(datos.x, datos.y, datos.estado); 
            }
            if (typeof renderBlock === 'function') renderBlock(datos.x, datos.y); 
        }
    }

    // D. HERRAMIENTAS MASIVAS
    if (datos.tipo === "accion_balde") {
        if (typeof bucketFill === 'function') bucketFill(datos.x, datos.y, true, datos.estado);
    }
    if (datos.tipo === "accion_borrar_seleccion") {
        if (typeof deleteSelection === 'function') deleteSelection(true, datos.bloques, datos.mobs);
    }
    if (datos.tipo === "accion_pegar") {
        if (typeof performPaste === 'function') performPaste(datos.x, datos.y, datos.replaceAir, true, datos.clipboard);
    }

    // E. MOBS (Entidades y Animales)
    if (datos.tipo === "accion_spawn_mob") {
        if (typeof mbwom !== 'undefined') mbwom.mobs[datos.id] = datos.mob;
    }
    if (datos.tipo === "accion_mover_mob") {
        if (typeof mbwom !== 'undefined' && mbwom.mobs[datos.id]) {
            mbwom.mobs[datos.id].x = datos.x;
            mbwom.mobs[datos.id].y = datos.y;
        }
    }
    if (datos.tipo === "accion_eliminar_mob") {
        if (typeof mbwom !== 'undefined' && mbwom.mobs[datos.id]) delete mbwom.mobs[datos.id];
    }

    // F. CURSORES FANTASMA
    if (datos.tipo === "cursor") {
        window.networkCursors[datos.autor] = { x: datos.x, y: datos.y, lastUpdate: Date.now() };
        if (typeof worldDirty !== 'undefined') worldDirty = true;
    }
}

// 6. COMPARTIR MUNDO (Host o Invitado)
window.compartirMundoActual = function() {
    if (!isMultiplayer) return alert("¡Aún no estás conectado!");
    if (!mbwom || !mbwom.world) return alert("¡Primero abre un mundo para poder compartirlo!");
    enviarMensajeEnRed({ tipo: "sync_mundo", mundo: mbwom.world });
    alert("Mundo enviado a todos los jugadores 🚀");
};

// ==========================================
// ✨ SISTEMA DE CHAT
// ==========================================
function addMessageToChat(autor, texto, color = "white") {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    const msgDiv = document.createElement('div');
    msgDiv.innerHTML = `<span style="color: #4DA6FF;">[${autor}]:</span> <span style="color: ${color};">${texto}</span>`;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

window.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && this.value.trim() !== "") {
                const mensaje = this.value.trim();
                const miNombre = localStorage.getItem('mbw_username') || "Player";
                addMessageToChat(miNombre, mensaje, "#a2ff00"); // Mostrar localmente
                enviarMensajeEnRed({ tipo: "chat", autor: miNombre, texto: mensaje }); // Enviar a la red
                this.value = ""; 
            }
        });
    }
});