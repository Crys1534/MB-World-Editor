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
    // Si estamos escribiendo en el chat/consola, ignorar controles de juego
    if (document.activeElement === document.getElementById('console-input') || 
        document.activeElement === document.getElementById('inventory-search')) {
        // Permitir cerrar inventario con E incluso si estamos escribiendo
        if (event.code === 'KeyE' && document.activeElement === document.getElementById('inventory-search')) {
             event.preventDefault();
             if (typeof toggleInventory === 'function') toggleInventory();
             return;
        }
        return; 
    }

	if (keys.hasOwnProperty(event.code)) keys[event.code] = true;

    if (event.code === 'Tab') {
        teleportSwitch();
        event.preventDefault();
    }

    if ((event.ctrlKey || event.metaKey) && event.code === 'KeyZ') {
        event.preventDefault();
        historyManager.undo();
    }
    if ((event.ctrlKey || event.metaKey) && event.code === 'KeyY') {
        event.preventDefault();
        historyManager.redo();
    }

    if ((event.ctrlKey || event.metaKey) && event.code === 'KeyC') {
        event.preventDefault();
        if (typeof copySelection === 'function') {
            copySelection();
        }
    }

    if ((event.ctrlKey || event.metaKey) && event.code === 'KeyV') {
        event.preventDefault();
        if (typeof activatePasteMode === 'function') {
            activatePasteMode();
        }
    }

    if (event.code === 'KeyZ' && !event.ctrlKey) {
        if (typeof setSelectionPoint === 'function') setSelectionPoint(1, mouse.worldX, mouse.worldY);
    }
    if (event.code === 'KeyX') {
        if (typeof setSelectionPoint === 'function') setSelectionPoint(2, mouse.worldX, mouse.worldY);
    }
    
    if (event.code === 'KeyC' && !event.ctrlKey) {
         eyedropper(mouse.worldX, mouse.worldY);
    }

    // --- NUEVO INVENTARIO ---
    if (event.code === 'KeyE') {
        // PREVENIMOS que la 'e' se escriba en el input
        event.preventDefault(); 
        if (typeof toggleInventory === 'function') toggleInventory();
    }

    // --- HOTBAR (Números) ---
    if (event.code.startsWith('Digit')) {
        let num = parseInt(event.code.charAt(5));
        if (!isNaN(num) && num > 0) {
            slotIndex = num - 1;
            if (typeof updateHotbarSelection === 'function') updateHotbarSelection();
        }
    }
});

window.addEventListener("keyup", function (event) {
	if (keys.hasOwnProperty(event.code)) keys[event.code] = false;
});

canvas.addEventListener("mousemove", (event) => {
	mouse.canvasX = event.offsetX;
	mouse.canvasY = canvas.height - event.offsetY;
	mouse.gridX = Math.floor(mouse.canvasX / tileSize);
	mouse.gridY = Math.floor(mouse.canvasY / tileSize);
    mouse.calculateCoordinates(); 

    if ((currentTool === 'select' || currentTool === 'lasso') && mouse.left) {
        handleSelectionInput('move', mouse.worldX, mouse.worldY);
    }
})

canvas.addEventListener("mousedown", function (event) {
	if (event.button == 0) mouse.left = true;
	if (event.button == 2) mouse.right = true;

    if ((currentTool === 'select' || currentTool === 'lasso') && mouse.left) {
        handleSelectionInput('start', mouse.worldX, mouse.worldY);
    } 
    else if (currentTool === 'paste' && mouse.left) {
        performPaste(mouse.worldX, mouse.worldY);
    }
    else if (mouse.left || mouse.right) {
        if (currentTool === 'bucket' && mouse.left) {
            bucketFill(mouse.worldX, mouse.worldY);
        } else if (currentTool !== 'eyedropper') {
            historyManager.startAction();
        }
    }
});

window.addEventListener("mouseup", function (event) {
    if ((currentTool === 'select' || currentTool === 'lasso') && mouse.left) {
        handleSelectionInput('end', mouse.worldX, mouse.worldY);
    }

	if (event.button == 0) mouse.left = false;
	if (event.button == 2) mouse.right = false;

    if (currentTool !== 'eyedropper' && currentTool !== 'bucket' && currentTool !== 'select' && currentTool !== 'lasso' && currentTool !== 'paste') {
        historyManager.commitAction();
    }
});

canvas.addEventListener("mouseleave", function() {
    if (mouse.left || mouse.right) {
        if (currentTool !== 'select' && currentTool !== 'lasso') historyManager.commitAction();
        mouse.left = false;
        mouse.right = false;
    }
});

canvas.addEventListener("contextmenu", e => e.preventDefault());