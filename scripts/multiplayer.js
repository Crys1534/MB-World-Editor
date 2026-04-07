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

function recibirMensajeDeRed(datos) {
    console.log("📥 DATO RECIBIDO DE LA RED:", datos);

    // Si es un mensaje de prueba, lo mostramos
    if (datos.tipo === "chat") {
        alert("Tu amigo dice: " + datos.texto);
    }
    
    // (AQUÍ ES DONDE PONDREMOS LA LÓGICA DE PONER/ROMPER BLOQUES MÁS ADELANTE)
}