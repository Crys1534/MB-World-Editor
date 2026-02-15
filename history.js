const historyManager = {
    undoStack: [],
    redoStack: [],
    maxDepth: 50, // Ahora podemos guardar más pasos porque pesan muy poco

    // Variable para agrupar cambios (ej: un trazo de lápiz completo)
    currentBatch: null,

    // Inicia una nueva "transacción" de cambios
    startAction: function() {
        this.currentBatch = [];
    },

    // Registra un cambio individual dentro de la transacción actual
    recordChange: function(x, y, oldState, newState) {
        if (!this.currentBatch) return;
        
        // Optimización: Si el bloque es idéntico, no guardamos nada
        if (JSON.stringify(oldState) === JSON.stringify(newState)) return;

        this.currentBatch.push({
            x: x,
            y: y,
            old: oldState ? structuredClone(oldState) : null,
            new: newState ? structuredClone(newState) : null
        });
    },

    // Cierra la transacción y la guarda en la pila de deshacer
    commitAction: function() {
        if (this.currentBatch && this.currentBatch.length > 0) {
            this.undoStack.push(this.currentBatch);
            
            if (this.undoStack.length > this.maxDepth) {
                this.undoStack.shift();
            }
            
            // Al hacer un cambio nuevo, el futuro (redo) deja de ser válido
            this.redoStack = []; 
        }
        this.currentBatch = null;
    },

    undo: function() {
        if (this.undoStack.length === 0) return;

        const actionBatch = this.undoStack.pop();
        this.redoStack.push(actionBatch);

        // Revertimos los cambios (Iteramos hacia atrás para orden cronológico inverso)
        for (let i = actionBatch.length - 1; i >= 0; i--) {
            const change = actionBatch[i];
            this.applyBlockState(change.x, change.y, change.old);
        }
    },

    redo: function() {
        if (this.redoStack.length === 0) return;

        const actionBatch = this.redoStack.pop();
        this.undoStack.push(actionBatch);

        // Re-aplicamos los cambios
        for (const change of actionBatch) {
            this.applyBlockState(change.x, change.y, change.new);
        }
    },

    // Función auxiliar para aplicar cambios visuales y lógicos
    applyBlockState: function(x, y, state) {
        if (state) {
            mbwom.setBlockState(x, y, state);
        } else {
            // Si el estado es null, borramos el bloque
            if (mbwom.scene[x]) delete mbwom.scene[x][y];
        }
        // Renderizamos solo este bloque (instantáneo)
        renderBlock(x, y);
    }
};