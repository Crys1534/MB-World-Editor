// ==========================================
// ✨ MOTOR MULTIJUGADOR P2P (PEERJS)
// ==========================================

let peer = null;       // Tu identidad en la red
let connection = null; // El cable que te une a tu amigo
let isMultiplayer = false; // ¿Estás jugando con alguien?

// 1. EL ANFITRIÓN (HOST) CREA LA SALA
window.hostMultiplayerSession = function() {
    document.getElementById('multiplayer-status').innerText = "Status: Creating Server...";
    document.getElementById('multiplayer-status').style.color = "#f1c40f";

    // Inicializamos un ID aleatorio en la red
    peer = new Peer(); 

    // Cuando el servidor de PeerJS nos da nuestro ID oficial
    peer.on('open', function(id) {
        document.getElementById('my-peer-id').value = id; // Lo mostramos en pantalla
        document.getElementById('multiplayer-status').innerText = "Status: Waiting for players...";
        console.log("¡Sala creada! Mi ID es: " + id);
    });

    // Cuando alguien se conecta a nosotros
    peer.on('connection', function(conn) {
        connection = conn;
        setupConnection();
    });
};

// 2. EL CLIENTE (INVITADO) SE CONECTA A LA SALA
window.joinMultiplayerSession = function() {
    const hostId = document.getElementById('join-peer-id').value.trim();
    if (!hostId) {
        alert("Please enter a Room ID!");
        return;
    }

    document.getElementById('multiplayer-status').innerText = "Status: Connecting...";
    
    peer = new Peer(); // Nos creamos una identidad también

    peer.on('open', function() {
        // Nos conectamos al ID del anfitrión
        connection = peer.connect(hostId);
        setupConnection();
    });
};

// 3. PREPARAR EL CABLE DE COMUNICACIÓN (Común para ambos)
function setupConnection() {
    connection.on('open', function() {
        // ¡Se logró la conexión!
        isMultiplayer = true;
        document.getElementById('multiplayer-status').innerText = "Status: CONNECTED! 🟢";
        document.getElementById('multiplayer-status').style.color = "#4CAF50";
        console.log("¡Conexión multijugador establecida!");

        // Prueba de fuego: Le mandamos un saludo al otro navegador
        enviarMensajeEnRed({ tipo: "chat", texto: "¡Hola desde la otra computadora!" });
    });

    // Escuchar cuando el otro navegador nos manda datos
    connection.on('data', function(data) {
        recibirMensajeDeRed(data);
    });

    connection.on('close', function() {
        isMultiplayer = false;
        document.getElementById('multiplayer-status').innerText = "Status: Disconnected 🔴";
        document.getElementById('multiplayer-status').style.color = "#e74c3c";
        alert("La conexión multijugador se ha perdido.");
    });
}

// 4. FUNCIONES DE ENVÍO Y RECEPCIÓN
window.enviarMensajeEnRed = function(datos) {
    if (isMultiplayer && connection && connection.open) {
        connection.send(datos); // Manda el paquete de datos instantáneamente
    }
}

// 5. PROCESAR MENSAJES RECIBIDOS
function recibirMensajeDeRed(datos) {
    console.log("📥 DATO RECIBIDO:", datos);

    // A. Chat
    if (datos.tipo === "chat") {
        console.log("💬 " + (datos.autor || "Amigo") + ": " + datos.texto);
        
        // ✨ Agregamos el mensaje a la interfaz
        if (typeof addMessageToChat === 'function') {
            addMessageToChat(datos.autor || "Amigo", datos.texto);
        }
        
        // ✨ Reproducimos un sonido tipo 8-bits al recibir mensaje
        if (typeof audioManager !== 'undefined') {
            audioManager.playTone(800, 'sine', 0.1, 0.2); 
        }
    }

    // B. Sincronización total (Cuando el host presiona "Send World")
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

    // C. Actualización de bloques en tiempo real
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
}

// ✨ ENVIAR EL MUNDO COMPLETO AL AMIGO
window.compartirMundoActual = function() {
    if (!isMultiplayer) {
        alert("¡Aún no estás conectado con nadie!");
        return;
    }
    if (!mbwom || !mbwom.world) {
        alert("¡Primero abre un mundo para poder compartirlo!");
        return;
    }

    enviarMensajeEnRed({
        tipo: "sync_mundo",
        mundo: mbwom.world
    });
    
    console.log("¡Mundo enviado!");
    alert("Mundo enviado al otro jugador 🚀");
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
    
    // Auto-scroll para ver siempre el mensaje más reciente
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Escuchar la tecla Enter en la caja de texto
window.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && this.value.trim() !== "") {
                const mensaje = this.value.trim();
                
                // Usamos el nombre de tu perfil global (o "Player" si no hay uno)
                const miNombre = localStorage.getItem('mbw_username') || "Player";
                
                // 1. Lo mostramos en nuestra propia pantalla (en color verde claro)
                addMessageToChat(miNombre, mensaje, "#a2ff00");
                
                // 2. Se lo enviamos al amigo por la red
                enviarMensajeEnRed({ tipo: "chat", autor: miNombre, texto: mensaje });
                
                // Limpiamos la caja
                this.value = ""; 
            }
        });
    }
});