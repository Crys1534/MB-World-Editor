const historyManager = {
    undoStack: [],
    redoStack: [], 
    maxDepth: 50, 

    currentBatch: null,

    startAction: function() {
        this.currentBatch = [];
    },

    // 🧱 HISTORIAL PARA BLOQUES
    recordChange: function(x, y, oldState, newState) {
        if (!this.currentBatch) return;
        if (JSON.stringify(oldState) === JSON.stringify(newState)) return;

        this.currentBatch.push({
            type: 'block', // Le ponemos etiqueta para saber qué es
            x: x,
            y: y,
            old: oldState ? structuredClone(oldState) : null,
            new: newState ? structuredClone(newState) : null
        });
    },

    // 🧟 HISTORIAL PARA MOBS
    recordMobChange: function(id, oldState, newState) {
        if (!this.currentBatch) return;
        if (JSON.stringify(oldState) === JSON.stringify(newState)) return;

        this.currentBatch.push({
            type: 'mob', // Etiqueta especial para los Mobs
            id: id,
            old: oldState ? structuredClone(oldState) : null,
            new: newState ? structuredClone(newState) : null
        });
    },

    commitAction: function() {
        if (this.currentBatch && this.currentBatch.length > 0) {
            this.undoStack.push(this.currentBatch);
            if (this.undoStack.length > this.maxDepth) this.undoStack.shift();
            this.redoStack = []; 
            this.updateButtonsUI(); 
        }
        this.currentBatch = null;
    },

    undo: function() {
        if (this.undoStack.length === 0) return;
        const actionBatch = this.undoStack.pop();
        this.redoStack.push(actionBatch);

        // Deshacemos hacia atrás
        for (let i = actionBatch.length - 1; i >= 0; i--) {
            const change = actionBatch[i];
            if (change.type === 'mob') {
                this.applyMobState(change.id, change.old);
            } else {
                this.applyBlockState(change.x, change.y, change.old);
            }
        }
        this.updateButtonsUI(); 
    },

    redo: function() {
        if (this.redoStack.length === 0) return;
        const actionBatch = this.redoStack.pop();
        this.undoStack.push(actionBatch);

        // Rehacemos hacia adelante
        for (const change of actionBatch) {
            if (change.type === 'mob') {
                this.applyMobState(change.id, change.new);
            } else {
                this.applyBlockState(change.x, change.y, change.new);
            }
        }
        this.updateButtonsUI(); 
    },

    applyBlockState: function(x, y, state) {
        if (state) { mbwom.setBlockState(x, y, state); } 
        else { if (mbwom.scene[x]) delete mbwom.scene[x][y]; }
        
        renderBlock(x, y);
        if (typeof worldDirty !== 'undefined') worldDirty = true;
        if (typeof enviarMensajeEnRed === 'function') {
            enviarMensajeEnRed({ tipo: "actualizar_bloque", x: x, y: y, estado: state });
        }
    },

    // ✨ APLICADOR DE MOBS (Magia pura: Sabe si se creó, borró o movió)
    applyMobState: function(id, state) {
        if (state) {
            // Si no existía, es Spawn. Si existía, es Mover.
            let isNew = !(mbwom.mobs && mbwom.mobs[id]);
            if (!mbwom.mobs) mbwom.mobs = {};
            mbwom.mobs[id] = structuredClone(state);
            
            if (typeof enviarMensajeEnRed === 'function') {
                if (isNew) enviarMensajeEnRed({ tipo: "accion_spawn_mob", id: id, mob: state });
                else enviarMensajeEnRed({ tipo: "accion_mover_mob", id: id, x: state.x, y: state.y });
            }
        } else {
            // Si state es null, significa que lo deshicimos hasta antes de que naciera (o lo borramos)
            if (mbwom.mobs && mbwom.mobs[id]) {
                delete mbwom.mobs[id];
                if (typeof enviarMensajeEnRed === 'function') {
                    enviarMensajeEnRed({ tipo: "accion_eliminar_mob", id: id });
                }
            }
        }
        
        if (typeof toggleMobInfo === 'function') toggleMobInfo(false);
        if (typeof worldDirty !== 'undefined') worldDirty = true;
    },

    updateButtonsUI: function() {
        const btnUndo = document.querySelector('button[title="Undo (Ctrl+Z)"]');
        const btnRedo = document.querySelector('button[title="Redo (Ctrl+Y)"]');

        if (btnUndo) {
            if (this.undoStack.length === 0) {
                btnUndo.setAttribute('disabled', 'true'); btnUndo.style.opacity = '0.4'; btnUndo.style.cursor = 'not-allowed';
            } else {
                btnUndo.removeAttribute('disabled'); btnUndo.style.opacity = '1'; btnUndo.style.cursor = 'pointer';
            }
        }
        if (btnRedo) {
            if (this.redoStack.length === 0) {
                btnRedo.setAttribute('disabled', 'true'); btnRedo.style.opacity = '0.4'; btnRedo.style.cursor = 'not-allowed';
            } else {
                btnRedo.removeAttribute('disabled'); btnRedo.style.opacity = '1'; btnRedo.style.cursor = 'pointer';
            }
        }
    }
};

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => historyManager.updateButtonsUI());
} else {
    historyManager.updateButtonsUI();
}