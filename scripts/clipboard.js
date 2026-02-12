const clipboard = {
    data: null, // Aquí guardaremos los bloques
    width: 0,
    height: 0,

    // Copia el área seleccionada
    copy: function() {
        if (!selection.p1 || !selection.p2) {
            console.log("¡Selecciona un área primero!");
            return;
        }

        // Calcular límites de la selección
        const minX = Math.min(selection.p1.x, selection.p2.x);
        const maxX = Math.max(selection.p1.x, selection.p2.x);
        const minY = Math.min(selection.p1.y, selection.p2.y);
        const maxY = Math.max(selection.p1.y, selection.p2.y);

        const buffer = [];
        
        // Extraer los datos brutos de la escena
        for (let x = minX; x <= maxX; x++) {
            const col = [];
            for (let y = minY; y <= maxY; y++) {
                // Clonamos el objeto para evitar referencias (Deep Copy simple)
                // Asumimos que mbwom.scene[x][y] contiene los datos del bloque
                let blockData = null;
                if (mbwom.scene[x] && mbwom.scene[x][y]) {
                    blockData = JSON.parse(JSON.stringify(mbwom.scene[x][y]));
                }
                col.push(blockData);
            }
            buffer.push(col);
        }

        this.data = buffer;
        this.width = maxX - minX + 1;
        this.height = maxY - minY + 1;
        
        console.log(`Copiado área de ${this.width}x${this.height} bloques.`);
        alert(`Copiado: ${this.width}x${this.height} bloques. Ahora puedes cargar otro archivo y pegar.`);
    },

    // Pega el contenido en la posición del mouse
    paste: function() {
        if (!this.data) {
            console.log("El portapapeles está vacío.");
            return;
        }

        // Usamos la posición del mouse en el mundo como punto de inserción (esquina superior izquierda)
        const startX = mouse.worldX;
        const startY = mouse.worldY;

        console.log(`Pegando en X:${startX} Y:${startY}`);

        for (let i = 0; i < this.data.length; i++) {
            for (let j = 0; j < this.data[i].length; j++) {
                const block = this.data[i][j];
                const targetX = startX + i;
                const targetY = startY + j;

                // Verificamos que esté dentro de los límites del mundo actual
                if (mbwom.scene[targetX] && targetY >= 0 && targetY < mbwom.scene[targetX].length) {
                    
                    // Sobrescribimos el bloque en el modelo de datos
                    mbwom.scene[targetX][targetY] = block ? JSON.parse(JSON.stringify(block)) : null;
                    
                    // Actualizamos la visualización (cache)
                    renderBlock(targetX, targetY);
                }
            }
        }
    }
};