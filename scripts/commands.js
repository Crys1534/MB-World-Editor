// ==========================================
// ✨ SISTEMA DE COMANDOS LOCALES
// ==========================================

window.processLocalCommand = function(text) {
    const args = text.slice(1).trim().split(/\s+/);
    const command = args[0].toLowerCase();

    switch (command) {
        
        case 'help':
        case '?':
            window.agregarMensajeChatPublico("System", "Comandos disponibles: /help, /gamemode (o /gm), /time set, /clear");
            break;

        case 'gamemode':
        case 'gm':
            const gmSelect = document.getElementById('gamemode');
            if (!gmSelect) {
                window.agregarMensajeChatPublico("Error", "No se encontró el selector de gamemode en la interfaz.");
                break;
            }

            let newMode = "";
            const argGm = args[1] ? args[1].toLowerCase() : "";

            // Asignar según el argumento
            if (argGm === '0' || argGm === 'survival' || argGm === 's') newMode = 'survival';
            else if (argGm === '1' || argGm === 'creative' || argGm === 'c') newMode = 'creative';
            else if (argGm === '2' || argGm === 'adventure' || argGm === 'a') newMode = 'adventure';
            else if (argGm === '3' || argGm === 'spectator' || argGm === 'sp') newMode = 'spectator';

            if (newMode) {
                gmSelect.value = newMode;
                // ✨ FIX: Le avisamos a la página que el valor cambió para que actualice el mundo
                gmSelect.dispatchEvent(new Event('change')); 
                window.agregarMensajeChatPublico("System", `Modo de juego actualizado a ${newMode}.`);
            } else {
                window.agregarMensajeChatPublico("System", "Uso: /gamemode [0|1|2|3] o [survival|creative|adventure|spectator]");
            }
            break;

        case 'time':
            if (args[1] === 'set' && args[2] !== undefined) {
                const timeInput = document.getElementById('gr-time');
                if (!timeInput) {
                    window.agregarMensajeChatPublico("Error", "No se encontró el control de tiempo en la interfaz.");
                    break;
                }

                let newTime = null;
                const argTime = args[2].toLowerCase();

                if (argTime === 'day') {
                    newTime = 0;
                } else if (argTime === 'night') {
                    newTime = 50;
                } else if (!isNaN(argTime)) {
                    // Si es un número, comprobamos que esté entre 0 y 99
                    const parsedTime = parseInt(argTime);
                    if (parsedTime >= 0 && parsedTime <= 99) {
                        newTime = parsedTime;
                    }
                }

                if (newTime !== null) {
                    timeInput.value = newTime;
                    // ✨ FIX: Disparamos eventos 'input' y 'change' para que se mueva la barrita visualmente
                    timeInput.dispatchEvent(new Event('input'));
                    timeInput.dispatchEvent(new Event('change'));
                    
                    let timeName = newTime;
                    if (newTime === 0) timeName = "Día (0)";
                    if (newTime === 50) timeName = "Noche (50)";
                    
                    window.agregarMensajeChatPublico("System", `Tiempo cambiado a: ${timeName}`);
                } else {
                    window.agregarMensajeChatPublico("System", "Uso: /time set [day|night|0-99]");
                }
            } else {
                window.agregarMensajeChatPublico("System", "Uso: /time set [day|night|0-99]");
            }
            break;

        case 'fly':
            if (typeof mbwom !== 'undefined' && mbwom.world) {
                mbwom.world.fly = !mbwom.world.fly; 
                const estado = mbwom.world.fly ? "ACTIVADO" : "DESACTIVADO";
                window.agregarMensajeChatPublico("System", `Modo de vuelo ${estado}.`);
            }
            break;

		case 'tp':
        case 'teleport':
            // Verificamos que haya escrito las dos coordenadas: /tp [x] [y]
            if (args.length >= 3) {
                const destX = parseFloat(args[1]);
                const destY = parseFloat(args[2]);

                if (!isNaN(destX) && !isNaN(destY)) {
                    if (typeof mbwom !== 'undefined' && mbwom.world) {
                        
                        // 1. Guardamos la nueva posición en la base de datos del mundo
                        mbwom.world.worldX = destX;
                        mbwom.world.worldY = destY; 
                        
                        // 2. ✨ FIX: Movemos la CÁMARA del editor físicamente
                        if (typeof camera !== 'undefined') {
                            camera.x = destX;
                            // En Mine Blocks la cámara en Y suele coincidir con worldY, pero si ves que
                            // vas en dirección contraria, cámbialo a: camera.y = -destY;
                            camera.y = destY; 
                        }

                        // 3. Forzamos un refresco de pantalla si la función existe
                        if (typeof render === 'function') {
                            render();
                        } else if (typeof draw === 'function') {
                            draw();
                        }

                        window.agregarMensajeChatPublico("System", `Teletransportado a X: ${destX}, Y: ${destY}`);
                    }
                } else {
                    window.agregarMensajeChatPublico("Error", "Las coordenadas deben ser números. Uso: /tp [x] [y]");
                }
            } else {
                window.agregarMensajeChatPublico("Error", "Faltan coordenadas. Uso: /tp [x] [y]");
            }
            break;
			
        case 'clear':
            const messagesDiv = document.getElementById('chat-messages');
            if (messagesDiv) {
                messagesDiv.innerHTML = '';
            }
            window.agregarMensajeChatPublico("System", "Historial de chat limpiado.");
            break;

        default:
            window.agregarMensajeChatPublico("Error", `Comando desconocido: /${command}. Escribe /help para ver la lista.`);
            break;
			
    }
};