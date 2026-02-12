const keys = {
	KeyW: false, KeyA: false, KeyS: false, KeyD: false,
	KeyC: false, Tab: false, KeyQ: false, KeyE: false,
    KeyZ: false, KeyX: false, KeyV: false
};

const mouse = {
	canvasX: null, canvasY: null, gridX: null, gridY: null,
	alignedX: null, alignedY: null, worldX: null, worldY: null,
	right: false, left: false,
	calculateCoordinates: function () {
		this.alignedX = this.gridX * tileSize;
		this.alignedY = canvas.height - this.gridY * tileSize;
		this.worldX = camera.x + this.gridX;
		this.worldY = camera.y + this.gridY;
	}
}

function cameraMovement() {
	if (keys.KeyW) camera.y += camera.speed;
	if (keys.KeyS) camera.y -= camera.speed;
	if (keys.KeyD) camera.x += camera.speed;
	if (keys.KeyA) camera.x -= camera.speed;
}

function teleportSwitch() {
	if (!tpToggle) {
		lastPosition[0].x = camera.x;
		lastPosition[0].y = camera.y;
		if (!firstTime) {
			camera.x = lastPosition[1].x;
			camera.y = lastPosition[1].y;
		}
		tpToggle = true;
	} else {
		lastPosition[1].x = camera.x;
		lastPosition[1].y = camera.y;
		camera.x = lastPosition[0].x;
		camera.y = lastPosition[0].y;
		tpToggle = false;
		firstTime = false;
	}
}

let tpToggle = false;
let firstTime = true;
let lastPosition = [{}, {}];

// --- TECLADO ---
window.addEventListener("keydown", function (event) {
    if (document.activeElement === document.getElementById('console-input')) {
        return; 
    }

	if (keys.hasOwnProperty(event.code)) keys[event.code] = true;

    if (event.code === 'Tab') {
        teleportSwitch();
        event.preventDefault();
    }

    // --- HISTORIAL ---
    if ((event.ctrlKey || event.metaKey) && event.code === 'KeyZ') {
        event.preventDefault();
        historyManager.undo();
    }
    if ((event.ctrlKey || event.metaKey) && event.code === 'KeyY') {
        event.preventDefault();
        historyManager.redo();
    }

    // --- COPIAR (Ctrl+C) ---
    if ((event.ctrlKey || event.metaKey) && event.code === 'KeyC') {
        event.preventDefault();
        if (typeof copySelection === 'function') {
            copySelection();
        }
    }

    // --- PEGAR (Ctrl+V) ---
    if ((event.ctrlKey || event.metaKey) && event.code === 'KeyV') {
        event.preventDefault();
        if (typeof activatePasteMode === 'function') {
            activatePasteMode();
        }
    }

    // Selección manual antigua (Z/X) - Mantenida por si acaso
    if (event.code === 'KeyZ' && !event.ctrlKey) {
        if (typeof setSelectionPoint === 'function') setSelectionPoint(1, mouse.worldX, mouse.worldY);
    }
    if (event.code === 'KeyX') {
        if (typeof setSelectionPoint === 'function') setSelectionPoint(2, mouse.worldX, mouse.worldY);
    }
    
    // Cuentagotas (C sin Ctrl)
    if (event.code === 'KeyC' && !event.ctrlKey) {
         eyedropper(mouse.worldX, mouse.worldY);
    }

    // Hotbar
    if (event.code === 'KeyQ') shapeIndex = (shapeIndex - 1 + 7) % 7;
    if (event.code === 'KeyE') shapeIndex = (shapeIndex + 1) % 7;
    if (event.code.startsWith('Digit')) {
        let num = parseInt(event.code.charAt(5));
        if (!isNaN(num) && num > 0) slotIndex = num - 1;
    }
});

window.addEventListener("keyup", function (event) {
	if (keys.hasOwnProperty(event.code)) keys[event.code] = false;
});

// --- MOUSE ---
canvas.addEventListener("mousemove", (event) => {
	mouse.canvasX = event.offsetX;
	mouse.canvasY = canvas.height - event.offsetY;
	mouse.gridX = Math.floor(mouse.canvasX / tileSize);
	mouse.gridY = Math.floor(mouse.canvasY / tileSize);
    mouse.calculateCoordinates(); 

    // Mover selección
    if (currentTool === 'select' && mouse.left) {
        handleSelectionInput('move', mouse.worldX, mouse.worldY);
    }
})

canvas.addEventListener("mousedown", function (event) {
	if (event.button == 0) mouse.left = true;
	if (event.button == 2) mouse.right = true;

    // Lógica por herramienta en Click
    if (currentTool === 'select' && mouse.left) {
        handleSelectionInput('start', mouse.worldX, mouse.worldY);
    } 
    else if (currentTool === 'paste' && mouse.left) {
        performPaste(mouse.worldX, mouse.worldY);
    }
    else if (mouse.left || mouse.right) {
        // Herramientas continuas (bucket, pencil, eraser)
        if (currentTool === 'bucket' && mouse.left) {
            bucketFill(mouse.worldX, mouse.worldY);
        } else if (currentTool !== 'eyedropper') {
            historyManager.startAction();
        }
    }
});

window.addEventListener("mouseup", function (event) {
    // Fin selección
    if (currentTool === 'select' && mouse.left) {
        handleSelectionInput('end', mouse.worldX, mouse.worldY);
    }

	if (event.button == 0) mouse.left = false;
	if (event.button == 2) mouse.right = false;

    // Terminar acción historial (excepto para herramientas de un solo click o especiales)
    if (currentTool !== 'eyedropper' && currentTool !== 'bucket' && currentTool !== 'select' && currentTool !== 'paste') {
        historyManager.commitAction();
    }
});

canvas.addEventListener("mouseleave", function() {
    if (mouse.left || mouse.right) {
        if (currentTool !== 'select') historyManager.commitAction();
        mouse.left = false;
        mouse.right = false;
    }
});

canvas.addEventListener("contextmenu", e => e.preventDefault());