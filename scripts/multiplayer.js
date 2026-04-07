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

// 2. Sincronización total (Cuando el host presiona "Send World")
    if (datos.tipo === "sync_mundo") {
        console.log("🌍 ¡Recibiendo mapa completo del anfitrión!");
        
        // 1. Sobreescribimos el objeto del mundo
        mbwom.world = datos.mundo;
        
        // ✨ 2. FIX: Desempaquetar los Mobs correctamente para que no se congele la pantalla
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

        // ✨ 3. FIX: Cargar la dimensión actual en memoria
        if (typeof mbwom.loadScene === 'function') mbwom.loadScene(1);

        // ✨ 4. FIX: Reconstruir los bloques visuales
        if (typeof initializeWorldCache === 'function') initializeWorldCache();

        // ✨ 5. FIX CRÍTICO: ¡Encender el motor de movimiento y dibujado!
        if (!window.isMainLoopRunning && typeof mainLoop === 'function') {
            mainLoop();
            window.isMainLoopRunning = true;
        }

        // 6. Actualizar el nombre en la barra superior
        const filenameDisplay = document.getElementById("filename-display");
        if (filenameDisplay && mbwom.world.fileInfo) {
            filenameDisplay.value = mbwom.world.fileInfo.name || "Multiplayer World";
        }
        
        alert("¡Mundo recibido y sincronizado! Ya puedes moverte.");
    }

    // 3. Actualización de bloques en tiempo real (Lápiz, Borrador, Pincel)
    if (datos.tipo === "actualizar_bloque") {
        // Verificamos que el motor MBWOM esté listo
        if (typeof mbwom !== 'undefined' && mbwom.scene) {
            
            if (datos.estado === null) {
                // Caso Borrador: Si el estado es null, eliminamos el bloque de la escena
                if (mbwom.scene[datos.x]) {
                    delete mbwom.scene[datos.x][datos.y];
                }
            } else {
                // Caso Lápiz/Pincel: Aplicamos el estado completo del bloque
                mbwom.setBlockState(datos.x, datos.y, datos.estado);
            }
            
            // Renderizamos únicamente el bloque afectado para mantener el rendimiento
            if (typeof renderBlock === 'function') {
                renderBlock(datos.x, datos.y);
            }
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

    // Le enviamos una copia exacta de tu mundo a través de la red
    enviarMensajeEnRed({
        tipo: "sync_mundo",
        mundo: mbwom.world
    });
    
    console.log("¡Mundo enviado con éxito!");
    alert("Mundo enviado al otro jugador 🚀");
};