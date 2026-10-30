// Lo poquito que la página puede pedirle al programa (solo la página del editor)
const { contextBridge, ipcRenderer } = require('electron');

if (location.origin === 'https://crys1534.github.io') {
    contextBridge.exposeInMainWorld('mbwDesktop', {
        isDesktop: true,
        info: () => ipcRenderer.invoke('mbw:info'),
        takeFile: (id) => ipcRenderer.invoke('mbw:take-file', id)
    });
}
