// ==========================================
// MULTIPLAYER - INTERFAZ (LISTAS, CHAT PÚBLICO, NOTIFICACIONES, EMOTES)
// ==========================================
// Esto antes vivía mezclado dentro de scripts/multiplayer.js. Se separó
// para que multiplayer.js se quede con la conexión (PeerJS/Firebase) y
// este archivo con todo lo que "dibuja" cosas en pantalla: el chat
// público, la lista de servidores, la lista de gente en línea, las
// notificaciones y los emotes. (El chat PRIVADO, con su lista de chats y su
// panel de emojis, está en scripts/chat-dm.js)
//
// Usa variables definidas en multiplayer.js (isMultiplayer, isHost, peer,
// database, etc.) y en otros archivos (database, firebase). Como los
// scripts clásicos comparten un mismo entorno global, esto funciona sin
// problema siempre que ambos archivos estén cargados en la página (así
// es como ya funcionaba el resto del proyecto antes de esta separación).

// ==========================================
// ✨ NOTIFICACIONES ESTILO ESCRITORIO
// ==========================================
window.showDesktopNotification = function(title, body, icon, onClickCallback) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed; bottom: 20px; right: -400px; width: 320px;
        background: #2c3e50; color: white; border-left: 5px solid #9b59b6;
        border-radius: 6px; padding: 15px; display: flex; gap: 15px; align-items: center;
        box-shadow: 0 4px 20px rgba(0,0,0,0.6); z-index: 9999999;
        font-family: 'Pixeltype', Arial, sans-serif; cursor: pointer;
        transition: right 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    `;
    toast.innerHTML = `
        <div style="width: 45px; height: 45px; border-radius: 50%; background-image: url('${icon}'); background-size: cover; background-position: center; flex-shrink: 0; border: 2px solid white;"></div>
        <div style="flex: 1; overflow: hidden;">
            <div style="font-size: 26px; font-weight: bold; color: #9b59b6; margin-bottom: 2px; text-shadow: 1px 1px 0 #000;">${title}</div>
            <div style="font-size: 18px; color: #ecf0f1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${body}</div>
        </div>
    `;
    toast.onclick = () => {
        if(onClickCallback) onClickCallback();
        toast.style.right = '-400px';
        setTimeout(() => toast.remove(), 400);
    };
    document.body.appendChild(toast);
    setTimeout(() => toast.style.right = '20px', 100);
    setTimeout(() => { if (toast) { toast.style.right = '-400px'; setTimeout(() => toast.remove(), 400); } }, 6000);
};

// Aviso corto para acciones sociales ("Solicitud enviada", "Bloqueado"...).
// Escapa el texto por si trae un nombre de usuario.
window.mpToast = function(title, body, icon) {
    const esc = window.escapeHTML || function(x) { return x; };
    window.showDesktopNotification(esc(title), esc(body), icon || 'assets/default pfp.png');
};

// ==========================================
// ✨ RENDER DE AVATARES ESTILO GOOGLE DOCS
// ==========================================
window.renderLivePlayers = function() {
    const container = document.getElementById('mp-live-players');
    if (!container) return;
    
    if (!isMultiplayer && !isHost) {
        container.innerHTML = '';
        return; 
    }

    const myUID = localStorage.getItem('mbw_uid');
    let drawnCount = 0; 
    let htmlBuilder = ''; // ✨ FIX: Creamos el buffer en memoria

    window.roomPlayers.forEach((p) => {
        if (p.uid === myUID) return; 
        
        let marginLeft = drawnCount > 0 ? '-10px' : '0';
        let zIndex = 100 - drawnCount; 

        let isSpectating = (window.spectatingTargetId === p.peerId);
        let borderColor = isSpectating ? '#e74c3c' : 'var(--bg-header, #2b2d31)';
        let borderWidth = isSpectating ? '3px' : '2px';
        let scale = isSpectating ? 'scale(1.15)' : 'scale(1)';

        // Añadimos al buffer, NO al DOM
        // Clic = espectear (seguir su cámara) · clic derecho = ir a donde está mirando (scripts/mp-live.js)
        const esc = window.escapeHTML || function (x) { return String(x); };
        const tipTr = (k, fb, v) => (typeof window.tmsg === 'function' ? window.tmsg(k, fb, v) : fb.replace('{name}', v && v.name));
        let tip = tipTr('mp_avatar_tip', 'Click: spectate {name} · Right-click: go to {name}', { name: p.name });
        const isRoomHost = window.roomPlayers[0] && window.roomPlayers[0].uid === p.uid;
        if (!isRoomHost) tip += ' · ' + (p.canEdit ? tipTr('mp_avatar_edit', 'can edit') : tipTr('mp_avatar_view', 'view only'));
        const pid = String(p.peerId || '').replace(/'/g, '');
        const pname = String(p.name || '').replace(/\\/g, '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        htmlBuilder += `
            <div class="mp-live-av${p.canEdit && !isRoomHost ? ' can-edit' : ''}${isRoomHost ? ' is-host' : ''}" title="${esc(tip)}" 
                 onclick="toggleSpectatorMode('${pid}', '${pname}')"
                 oncontextmenu="event.preventDefault(); mpGoToPlayer('${pid}'); return false;"
                 style="
                width: 28px; height: 28px; border-radius: 50%; border: ${borderWidth} solid ${borderColor};
                background-color: #34495e; background-image: url('${p.pfp}'); background-size: cover; background-position: center; 
                margin-left: ${marginLeft}; z-index: ${zIndex}; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.3); 
                transform: ${scale}; transition: 0.2s; position: relative; flex: none;" 
                 onmouseover="this.style.transform='translateY(-2px) ${scale}'" 
                 onmouseout="this.style.transform='translateY(0) ${scale}'">
            </div>
        `;
        drawnCount++;
    });
    
    // ✨ FIX: Inyectamos todo de un solo golpe
    container.innerHTML = htmlBuilder; 
};

// ==========================================
// LÓGICA DEL WIZARD (Asistente Visual)
// ==========================================

window.loadPublicServers = function() {
    const listDiv = document.getElementById('public-servers-list');
    if (!listDiv) return;
    listDiv.innerHTML = '<p style="text-align: center; color: #bdc3c7; font-size: 24px;">Searching for worlds...</p>';

    database.ref('servers').off('value');
    database.ref('servers').on('value', (snapshot) => {
        const servers = snapshot.val();

        if (!servers) {
            listDiv.innerHTML = '<p style="text-align: center; color: #95a5a6; font-size: 24px; margin-top: 15px;">No public servers available right now.</p>';
            return;
        }

        const myUID = localStorage.getItem('mbw_uid'); 
        let htmlBuilder = ''; // ✨ FIX: Buffer de memoria

        for (let id in servers) {
            let s = servers[id];
            if (!s || !s.hostName || s.hostName === 'undefined' || s.hostName === 'null') {
                database.ref('servers/' + id).remove(); 
                continue; 
            }

            if (s.access === 'private' && s.hostUid !== myUID) continue;   // sala creada para dejar entrar a alguien que lo pidió (scripts/join-requests.js)
            if (s.access === 'friends_only' && s.hostUid !== myUID) {
                if (!misAmigosConfirmados.includes(s.hostUid)) continue; 
            }

            let isFull = s.currentPlayers >= s.maxPlayers;
            let isAlreadyJoined = false;
            if (isMultiplayer) {
                if (isHost && peer && peer.id === id) isAlreadyJoined = true;
                else if (!isHost && miConexionAlHost && miConexionAlHost.peer === id) isAlreadyJoined = true;
            }

            let buttonConfig = "";
            if (isAlreadyJoined) {
                buttonConfig = `<button style="background: #3498db; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: not-allowed; font-family: 'Pixeltype', sans-serif; font-size: 24px; transition: 0.2s;" disabled>JOINED</button>`;
            } else if (isFull) {
                buttonConfig = `<button style="background: #7f8c8d; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: not-allowed; font-family: 'Pixeltype', sans-serif; font-size: 24px; transition: 0.2s;" disabled>FULL</button>`;
            } else {
                buttonConfig = `<button onclick="joinMultiplayerSession('${id}');" style="background: #2ecc71; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-family: 'Pixeltype', sans-serif; font-size: 24px; transition: 0.2s;">JOIN</button>`;
            }

            let thumbUrl = s.mapThumb || 'assets/Superflat World.png';
            htmlBuilder += `
                <div style="background: rgba(52, 73, 94, 0.8); padding: 10px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #7f8c8d; gap: 12px; margin-bottom: 5px;">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div style="width: 80px; height: 50px; background-image: url('${thumbUrl}'); background-size: cover; background-position: center; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2); image-rendering: pixelated; flex-shrink: 0;"></div>
                        <div>
                            <strong style="color: #4DA6FF; font-size: 24px; display: block; line-height: 1;">${s.hostName}'s Room</strong>
                            <span style="color: #bdc3c7; font-size: 18px;">Map: ${s.mapName}</span>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="color: ${(isFull && !isAlreadyJoined) ? '#e74c3c' : '#2ecc71'}; font-size: 24px; font-weight: bold;">${s.currentPlayers}/${s.maxPlayers}</span>
                        ${buttonConfig}
                    </div>
                </div>
            `;
        }
        
        // ✨ FIX: Inyección única
        listDiv.innerHTML = htmlBuilder; 
    });
}

// ✨ FIX: FUNCIÓN RESTAURADA PARA MOSTRAR JUGADORES ONLINE Y ABRIR CHATS
window.renderPresenceList = function() {
    const users = window.lastKnownUsers;
    const listContainer = document.getElementById('mp-online-users-list');
    if (listContainer) listContainer.innerHTML = '';
    if (!users) return;

    const myUID = localStorage.getItem('mbw_uid');
    let htmlBuilder = '';
    const now = Date.now();

    for (let key in users) {
        const u = users[key];
        const isMe = (myUID && key === myUID);
        const isFriend = typeof misAmigosConfirmados !== 'undefined' && misAmigosConfirmados.includes(u.uid);
        const isBlockedUser = window.isBlocked(u.uid);
        
        let isInMyRoom = window.roomPlayers && window.roomPlayers.some(p => p.uid === u.uid);

        let actionBtn = '';
        if (isHost && window.currentRoomId && !isMe) {
            if (isInMyRoom) {
                actionBtn = `<button onclick="kickPlayer('${u.uid}', '${window.escapeHTML ? window.escapeHTML(u.username) : u.username}')" style="background: #e74c3c; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; color: white; font-size: 16px; transition: 0.2s;" onmouseover="this.style.background='#c0392b'" onmouseout="this.style.background='#e74c3c'" title="Expulsar del servidor">🥾 Kick</button>`;
            } else {
                if (window.inviteCooldowns[u.uid] && now < window.inviteCooldowns[u.uid]) {
                    actionBtn = `<button style="background: #7f8c8d; border: none; padding: 6px 10px; border-radius: 4px; cursor: not-allowed; color: white; font-size: 16px;" disabled>⏳ Wait...</button>`;
                } else {
                    actionBtn = `<button onclick="sendServerInvite('${u.uid}', '${window.escapeHTML ? window.escapeHTML(u.username) : u.username}', event)" style="background: #9b59b6; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; color: white; font-size: 16px; transition: 0.2s;" onmouseover="this.style.background='#8e44ad'" onmouseout="this.style.background='#9b59b6'" title="Invitar al servidor">🎮 Invite</button>`;
                }
            }
        }

        const borderColor = (isMe || isFriend) ? '#1e293b' : '#34495e';
        const safeName = window.escapeHTML ? window.escapeHTML(u.username) : u.username;
        // ✨ Obtenemos el nombre del mundo, si no tiene, dice Unknown
        const safeWorld = window.escapeHTML ? window.escapeHTML(u.worldName || "Unknown") : (u.worldName || "Unknown");

        // ✨ Botones según la relación con esta persona. Van en una fila DEBAJO de la foto y el nombre
        // (antes iban a la derecha y, con varios botones, se aplastaba todo).
        let topRight = '', buttons = '';
        if (isMe) {
            topRight = '<span class="mp-user-tag" style="color: #2ecc71;">(You)</span>';
        } else if (isBlockedUser) {
            topRight = '<span class="mp-user-tag" title="Bloqueado" style="color: #e74c3c;">🚫 Bloqueado</span>';
            if (isInMyRoom) buttons = actionBtn;
        } else {
            const addBtn = isFriend
                ? `<span class="mp-user-friend" title="Ya son amigos">✔ Amigos</span>`
                : `<button onclick="sendFriendRequest('${u.uid}', '${safeName}')" style="background: #2ecc71; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; color: white; font-size: 16px; transition: 0.2s;" onmouseover="this.style.background='#27ae60'" onmouseout="this.style.background='#2ecc71'" title="Añadir amigo">➕ Add</button>`;
            // 🚪 Pedir entrar a su mundo (si no estoy ya en su sala y no soy yo el que tiene la sala)
            let joinBtn = '';
            if (!isInMyRoom && !(isHost && window.currentRoomId) && typeof window.requestJoinWorld === 'function') {
                const waiting = window.mbwJoinCooling && window.mbwJoinCooling(u.uid);
                joinBtn = waiting
                    ? `<button class="mp-join-req is-waiting" disabled style="background: #7f8c8d; border: none; padding: 6px 10px; border-radius: 4px; cursor: not-allowed; color: white; font-size: 16px;">⏳ ${window.tmsg ? window.tmsg('jr_waiting_btn', 'Asked') : 'Asked'}</button>`
                    : `<button class="mp-join-req" data-uid="${u.uid}" onclick="requestJoinWorld(this.dataset.uid)" style="background: #3498db; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; color: white; font-size: 16px; transition: 0.2s;" onmouseover="this.style.background='#2980b9'" onmouseout="this.style.background='#3498db'" title="${window.tmsg ? window.tmsg('jr_btn_tip', 'Ask to join the world they are editing') : 'Ask to join'}">🚪 ${window.tmsg ? window.tmsg('jr_btn', 'Join') : 'Join'}</button>`;
            }
            const msgLabel = window.tmsg ? window.tmsg('mp_msg_btn', 'Message') : 'Message';
            buttons = `${actionBtn}${joinBtn}${addBtn}<button class="mp-user-msg" onclick="openDirectMessage('${u.uid}', '${safeName}')" title="Enviar mensaje">💬 ${msgLabel}</button>`;
        }

        htmlBuilder += `
            <div class="mp-user-card" style="border-color: ${borderColor};">
                <div class="mp-user-top">
                    <div class="mp-user-pfp" style="background-image: url('${u.pfp}');"></div>
                    <div class="mp-user-info">
                        <span class="mp-user-name">${safeName}</span>
                        <span class="mp-user-world">Editing: ${safeWorld}</span>
                    </div>
                    ${topRight}
                </div>
                ${buttons ? `<div class="mp-user-actions">${buttons}</div>` : ''}
            </div>
        `;
    }

    if (htmlBuilder === '') {
        htmlBuilder = '<p style="color: #95a5a6; font-family: \'Pixeltype\', sans-serif; font-size: 20px; text-align: center;">No hay otros jugadores en línea.</p>';
    }

    if (listContainer) listContainer.innerHTML = htmlBuilder;
};

window.renderServerInvites = function(container) {
    const myUID = localStorage.getItem('mbw_uid');
    database.ref('server_invites/' + myUID).once('value', (snapshot) => {
        const invites = snapshot.val();
        container.innerHTML = '';
        const visibleInvites = invites ? Object.keys(invites).filter(k => !window.isBlocked(k)) : [];
        if (visibleInvites.length === 0) { container.innerHTML = '<p style="color: var(--dc-text-muted, #bdc3c7); text-align: center; font-size: 24px;">No notifications yet.</p>'; return; }

        visibleInvites.reverse().forEach(senderUid => {
            let inv = invites[senderUid];
            container.innerHTML += `
                <div style="background: var(--dc-bg-tertiary, rgba(0,0,0,0.2)); padding: 10px; display: flex; align-items: center; gap: 10px; border-radius: 4px; border-left: 3px solid var(--dc-brand, #9b59b6);">
                    <div style="width: 40px; height: 40px; border-radius: 50%; background-image: url('${inv.hostPfp}'); background-size: cover; background-position: center; border: 2px solid white;"></div>
                    <div style="flex: 1; overflow: hidden;">
                        <div style="color: var(--dc-text-strong, white); font-size: 24px; font-weight: bold; margin-bottom: 2px;">${inv.hostName}</div>
                        <div style="color: var(--dc-text-muted, #bdc3c7); font-size: 16px; font-family: Arial; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 6px;">Map: ${inv.mapName}</div>
                        <div style="display: flex; gap: 5px;">
                            <button onclick="acceptServerInvite('${inv.roomId}', '${senderUid}')" style="background: var(--dc-brand, #9b59b6); color: var(--dc-on-brand, white); border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 20px;">Join</button>
                            <button onclick="declineServerInvite('${senderUid}'); openMpSidebar('invites');" style="background: #7f8c8d; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 20px;">X</button>
                        </div>
                    </div>
                </div>
            `;
        });
    });
};

window.renderFriendRequests = function(container) {
    const myUID = localStorage.getItem('mbw_uid');
    database.ref('friend_requests/' + myUID).once('value', (snapshot) => {
        const requests = snapshot.val();
        container.innerHTML = '';

        // La gente bloqueada no aparece aquí
        const senders = requests ? Object.keys(requests).filter(id => !window.isBlocked(id)).reverse() : [];
        if (senders.length === 0) {
            container.innerHTML = '<p style="color: var(--dc-text-muted, #bdc3c7); text-align: center; font-size: 24px;">No friend requests.</p>';
        }

        const makeBtn = (label, bg, onClick) => {
            const b = document.createElement('button');
            b.textContent = label;
            b.style.cssText = `background: ${bg}; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 20px;`;
            b.onclick = onClick;
            return b;
        };

        let pendingCount = 0;
        senders.forEach(senderUid => {
            const req = requests[senderUid] || {};

            const card = document.createElement('div');
            card.style.cssText = `background: var(--dc-bg-tertiary, rgba(0,0,0,0.2)); padding: 10px; display: flex; align-items: center; gap: 10px; border-radius: 4px; border-left: 3px solid ${req.status ? 'var(--dc-text-muted, #7f8c8d)' : 'var(--dc-yellow, #f1c40f)'};`;

            const pfp = document.createElement('div');
            pfp.style.cssText = 'width: 40px; height: 40px; border-radius: 50%; background-size: cover; background-position: center; border: 2px solid white;';
            pfp.style.backgroundImage = `url("${window.isRealPfp(req.pfp) ? req.pfp : 'assets/default pfp.png'}")`;

            const info = document.createElement('div');
            info.style.flex = '1';
            const nameEl = document.createElement('div');
            nameEl.style.cssText = 'color: var(--dc-text-strong, white); font-size: 26px;';
            nameEl.textContent = req.username || 'Unknown User';
            const row = document.createElement('div');
            row.style.cssText = 'display: flex; gap: 5px; margin-top: 5px;';

            if (req.status === 'accepted') {
                row.innerHTML = '<span style="color: var(--dc-green-fg, #2ecc71); font-size: 20px;">✔️ Accepted</span>';
            } else if (req.status === 'rejected') {
                row.innerHTML = '<span style="color: var(--dc-red-fg, #e74c3c); font-size: 20px;">❌ Denied</span>';
            } else {
                pendingCount++;
                // (la lista se vuelve a dibujar sola cuando Firebase confirma el cambio)
                row.appendChild(makeBtn('Accept', '#2ecc71', () => window.acceptFriendRequest(senderUid)));
                row.appendChild(makeBtn('Decline', '#e74c3c', () => window.declineFriendRequest(senderUid)));
                const blockBtn = makeBtn('🚫', '#7f8c8d', () => window.blockUser(senderUid, req.username));
                blockBtn.title = 'Bloquear';
                row.appendChild(blockBtn);
            }

            info.appendChild(nameEl);
            info.appendChild(row);
            card.appendChild(pfp);
            card.appendChild(info);
            container.appendChild(card);
        });

        // ---- Sección de bloqueados (para poder desbloquear) ----
        const blockedMap = window.getBlockedMap();
        const blockedIds = Object.keys(blockedMap);
        if (blockedIds.length > 0) {
            const title = document.createElement('div');
            title.style.cssText = 'color: var(--dc-text-muted, #bdc3c7); font-size: 22px; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--dc-divider, #1a252f);';
            title.textContent = '🚫 Bloqueados';
            container.appendChild(title);

            blockedIds.forEach(uid => {
                const row = document.createElement('div');
                row.style.cssText = 'background: var(--dc-bg-tertiary, rgba(0,0,0,0.2)); padding: 8px 10px; display: flex; align-items: center; gap: 10px; border-radius: 4px; border-left: 3px solid var(--dc-red, #e74c3c);';
                const nm = document.createElement('div');
                nm.style.cssText = 'flex: 1; color: var(--dc-text-strong, white); font-size: 24px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
                nm.textContent = blockedMap[uid] || 'Usuario';
                row.appendChild(nm);
                row.appendChild(makeBtn('Desbloquear', '#7f8c8d', () => window.unblockUser(uid)));
                container.appendChild(row);
            });
        }

        const badge = document.getElementById('badge-friends');
        if (badge) { badge.innerText = pendingCount; badge.style.display = pendingCount > 0 ? 'block' : 'none'; }
    });
};

// (La lista de chats -window.renderChatList- vive ahora en scripts/chat-dm.js)

// ==========================================
// ✨ CEREBRO DE EMOTES Y SEGURIDAD
// ==========================================

// 1. TUS EMOTES INTERNOS (Cambia las URLs por tus imágenes reales)
window.customEmotes = {
    "heart": "assets/UI/emotes/heart.png",
    "flushed": "assets/UI/emotes/flushed.png",
    "air": "assets/UI/emotes/air.png",
    "minifrank": "assets/UI/emotes/minifrank.png",
};

// 2. CATEGORÍAS DE EMOJIS ESTÁNDAR (ARSENAL COMPLETO)
window.emojiCategories = [
    { 
        id: "peo", icon: "😃", name: "People", 
        items: [
            // Caritas y Emociones
            "😀","😃","😄","😁","😆","😅","😂","🤣","🥲","☺️","😊","😇","🙂","🙃","😉","😌","😍","🥰","😘","😗","😙","😚","😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎","🥸","🤩","🥳","😏","😒","😞","😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🫣","🤭","🤫","🤥","😶","😶‍🌫️","😐","😑","😬","🫨","🫠","🙄","😯","😦","😧","😮","😲","🥱","😴","🤤","😪","😵","😵‍💫","🤐","🥴","🤢","🤮","🤧","😷","🤒","🤕","🤑","🤠","😈","👿","👹","👺","🤡","💩","👻","💀","☠️","👽","👾","🤖","🎃",
            // Manos y Gestos
            "👐","🤲","🙌","👏","🤝","👍","👎","👊","✊","🤛","🤜","🤞","✌️","🫰","🤟","🤘","👌","🤌","🤏","🫳","🫴","👈","👉","👆","👇","☝️","✋","🤚","🖐️","🖖","👋","🤙","🫲","🫱","🫷","🫸","💪","🦾","🖕","✍️","🙏","🦶","🦵","🦿","💄","💋","👄","🦷","👅","👂","🦻","👃","👣","👁️","👀","🧠","🫀","🫁",
            // Personas y Profesiones
            "👶","👧","🧒","👦","👩","🧑","👨","👱‍♀️","👱","👱‍♂️","🧔‍♀️","🧔","🧔‍♂️","👵","🧓","👴","👲","👳‍♀️","👳","👳‍♂️","🧕","👮‍♀️","👮","👮‍♂️","👷‍♀️","👷","👷‍♂️","💂‍♀️","💂","💂‍♂️","🕵️‍♀️","🕵️","🕵️‍♂️","👩‍⚕️","🧑‍⚕️","👨‍⚕️","👩‍🌾","🧑‍🌾","👨‍🌾","👩‍🍳","🧑‍🍳","👨‍🍳","👩‍🎓","🧑‍🎓","👨‍🎓","👩‍🎤","🧑‍🎤","👨‍🎤","👩‍🏫","🧑‍🏫","👨‍🏫","👩‍🏭","🧑‍🏭","👨‍🏭","👩‍💻","🧑‍💻","👨‍💻","👩‍💼","🧑‍💼","👨‍💼","👩‍🔧","🧑‍🔧","👨‍🔧","👩‍🔬","🧑‍🔬","👨‍🔬","👩‍🎨","🧑‍🎨","👨‍🎨","👩‍🚒","🧑‍🚒","👨‍🚒","👩‍✈️","🧑‍✈️","👨‍✈️","👩‍🚀","🧑‍🚀","👨‍🚀","👩‍⚖️","🧑‍⚖️","👨‍⚖️","👰‍♀️","👰","👰‍♂️","🤵‍♀️","🤵","🤵‍♂️","👸","🫅","🤴","🥷","🦸‍♀️","🦸","🦸‍♂️","🦹‍♀️","🦹","🦹‍♂️","🤶","🧑‍🎄","🎅","🧙‍♀️","🧙","🧙‍♂️","🧝‍♀️","🧝","🧝‍♂️","🧛‍♀️","🧛","🧛‍♂️","🧟‍♀️","🧟","🧟‍♂️","🧞‍♀️","🧞","🧞‍♂️","🧜‍♀️","🧜","🧜‍♂️","🧚‍♀️","🧚","🧚‍♂️","👼","🤰","🫄","🫃","🤱","👩‍🍼","🧑‍🍼","👨‍🍼","🙇‍♀️","🙇","🙇‍♂️","💁‍♀️","💁","💁‍♂️","🙅‍♀️","🙅","🙅‍♂️","🙆‍♀️","🙆","🙆‍♂️","🙋‍♀️","🙋","🙋‍♂️","🧏‍♀️","🧏","🧏‍♂️","🤦‍♀️","🤦","🤦‍♂️","🤷‍♀️","🤷","🤷‍♂️","🙎‍♀️","🙎","🙎‍♂️","🙍‍♀️","🙍","🙍‍♂️","💇‍♀️","💇","💇‍♂️","💆‍♀️","💆","💆‍♂️","🧖‍♀️","🧖","🧖‍♂️","💅","🤳","💃","🕺","👯‍♀️","👯","👯‍♂️","🕴️","🚶‍♀️","🚶","🚶‍♂️","🧎‍♀️","🧎","🧎‍♂️","🏃‍♀️","🏃","🏃‍♂️","🧍‍♀️","🧍","🧍‍♂️","👭","🧑‍🤝‍🧑","👬","👫"
        ] 
    },
    { id: "nat", icon: "🌿", name: "Nature", items: ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🐔","🐧","🐦","🐤","🦆","🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝","🐛","🦋","🐌","🐞","🐜","🦟","🐢","🐍","🦎","🦖","🦕","🐙","🦑","🦐","🦞","🦀","🐡","🐠","🐟","🐬","🐳","🐋","🦈","🐊","🐅","🐆","🦓","🦍","🦧","🐘","🦛","🦏","🐪","🐫","🦒","🦘","🐃","🐂","🐄","🐎","🐖","🐏","🐑","🦙","🐐","🦌","🐕","🐩","🦮","🐕‍🦺","🐈","🐈‍⬛","🪶","🐓","🦃","🦚","🦜","🦢","🦩","🕊️","🐇","🦝","🦨","🦡","🦦","🦥","🐁","🐀","🐿️","🦔","🐾","🐉","🐲","🌵","🎄","🌲","🌳","🌴","🪵","🌱","🌿","☘️","🍀","🎍","🪴","🎋","🍃","🍂","🍁","🍄","🌾","💐","🌷","🌹","🥀","🌺","🌸","🌼","🌻","🌞","🌝","🌛","🌜","🌚","🌕","🌖","🌗","🌘","🌑","🌒","🌓","🌔","🌙","🌎","🌍","🌏","🪐","💫","⭐️","🌟","✨","⚡️","☄️","💥","🔥","🌪️","🌈","☀️","🌤️","⛅️","🌥️","☁️","🌦️","🌧️","⛈️","🌩️","🌨️","❄️","☃️","⛄️","🌬️","💨","💧","💦","☔️","☂️","🌊","🌫️"] },
    { id: "foo", icon: "🍔", name: "Food", items: ["🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🍆","🥑","🥦","🥬","🥒","🌶️","🫑","🌽","🥕","🫒","🧄","🧅","🥔","🍠","🥐","🥯","🍞","🥖","🥨","🧀","🥚","🍳","🧈","🥞","🧇","🥓","🥩","🍗","🍖","🦴","🌭","🍔","🍟","🍕","🫓","🥪","🥙","🧆","🌮","🌯","🫔","🥗","🥘","🫕","🥫","🍝","🍜","🍲","🍛","🍣","🍱","🥟","🦪","🍤","🍙","🍚","🍘","🍥","🥠","🥮","🍢","🍡","🍧","🍨","🍦","🥧","🧁","🍰","🎂","🍮","🍭","🍬","🍫","🍿","🍩","🍪","🌰","🥜","🍯","🥛","🍼","🫖","☕️","🍵","🧃","🥤","🧋","🍶","🍺","🍻","🥂","🍷","🥃","🍸","🍹","🧉","🍾","🧊","🥄","🍴","🍽️","🥣","🥡","🥢","🧂"] },
    { id: "act", icon: "⚽", name: "Activities", items: ["⚽️","🏀","🏈","⚾️","🥎","🎾","🏐","🏉","🥏","🎱","🪀","🏓","🏸","🏒","🏑","🥍","🏏","🪃","🥅","⛳️","🪁","🏹","🎣","🤿","🥊","🥋","🎽","🛹","🛼","🛷","⛸️","🥌","🎿","⛷️","🏂","🪂","🏋️‍♀️","🏋️","🏋️‍♂️","🤼‍♀️","🤼","🤼‍♂️","🤸‍♀️","🤸","🤸‍♂️","⛹️‍♀️","⛹️","⛹️‍♂️","🤺","🤾‍♀️","🤾","🤾‍♂️","🏌️‍♀️","🏌️","🏌️‍♂️","🏇","🧘‍♀️","🧘","🧘‍♂️","🏄‍♀️","🏄","🏄‍♂️","🏊‍♀️","🏊","🏊‍♂️","🤽‍♀️","🤽","🤽‍♂️","🚣‍♀️","🚣","🚣‍♂️","🧗‍♀️","🧗","🧗‍♂️","🚵‍♀️","🚵","🚵‍♂️","🚴‍♀️","🚴","🚴‍♂️","🏆","🥇","🥈","🥉","🏅","🎖️","🏵️","🎗️","🎫","🎟️","🎪","🤹‍♀️","🤹","🤹‍♂️","🎭","🩰","🎨","🎬","🎤","🎧","🎼","🎹","🥁","🪘","🎷","🎺","🪗","🎸","🪕","🎻","🎲","♟️","🎯","🎳","🎮","🎰","🧩"] },
    { id: "tri", icon: "🚗", name: "Trips", items: ["🚗","🚕","🚙","🚌","🚎","🏎️","🚓","🚑","🚒","🚐","🛻","🚚","🚛","🚜","🦯","🦽","🦼","🛴","🚲","🛵","🏍️","🛺","🚨","🚔","🚍","🚘","🚖","🚡","🚠","🚟","🚃","🚋","🚞","🚝","🚄","🚅","🚈","🚂","🚆","🚇","🚊","🚉","✈️","🛫","🛬","🛩️","💺","🛰️","🚀","🛸","🚁","🛶","⛵️","🚤","🛥️","🛳️","⛴️","🚢","⚓️","🪝","⛽️","🚧","🚦","🚥","🚏","🗺️","🗿","🗽","🗼","🏰","🏯","🏟️","🎡","🎢","🎠","⛲️","⛱️","🏖️","🏝️","🏜️","🌋","⛰️","🏔️","🗻","🏕️","⛺️","🛖","🏠","🏡","🏘️","🏚️","🏗️","🏭","🏢","🏬","🏣","🏤","🏥","🏦","🏨","🏪","🏫","🏩","💒","🏛️","⛪️","🕌","🕍","🛕","🕋","⛩️","🛤️","🛣️","🗾","🎑","🏞️","🌅","🌄","🌠","🎇","🎆","🌇","🌆","🏙️","🌃","🌌","🌉","🌁"] },
    { id: "obj", icon: "💡", name: "Objects", items: ["⌚️","📱","📲","💻","⌨️","🖥️","🖨️","🖱️","🖲️","🕹️","🗜️","💽","💾","💿","📀","📼","📷","📸","📹","🎥","📽️","🎞️","📞","☎️","📟","📠","📺","📻","🎙️","🎚️","🎛️","🧭","⏱️","⏲️","⏰","🕰️","⌛️","⏳","📡","🔋","🔌","💡","🔦","🕯️","🪔","🧯","🛢️","💸","💵","💴","💶","💷","🪙","💰","💳","💎","⚖️","🪜","🧰","🪛","🔧","🔨","⚒️","🛠️","⛏️","🪚","🔩","⚙️","🪤","🧱","⛓️","🧲","🔫","💣","🧨","🪓","🔪","🗡️","⚔️","🛡️","🚬","⚰️","🪦","⚱️","🏺","🔮","📿","🧿","💈","⚗️","🔭","🔬","🕳️","🩹","🩺","💊","💉","🩸","🧬","🦠","🧫","🧪","🌡️","🧹","🪠","🧺","🧻","🚽","🚰","🚿","🛁","🛀","🧼","🪥","🪒","🧽","🪣","🧴","🛎️","🔑","🗝️","🚪","🪑","🛋️","🛏️","🛌","🧸","🪆","🖼️","🪞","🪟","🛍️","🛒","🎁","🎈","🎏","🎀","🪄","🪅","🎊","🎉","🎎","🏮","🎐","🧧","✉️","📩","📨","📧","💌","📥","📤","📦","🏷️","🪧","📪","📫","📬","📭","📮","📯","📜","📃","📄","📑","🧾","📊","📈","📉","🗒️","🗓️","📆","📅","🗑️","📇","🗃️","🗳️","🗄️","📋","📁","📂","🗂️","🗞️","📰","📓","📔","📒","📕","📗","📘","📙","📚","📖","🔖","🧷","🔗","📎","🖇️","📐","📏","🧮","📌","📍","✂️","🖊️","🖋️","✒️","🖌️","🖍️","📝","✏️","🔍","🔎","🔏","🔐","🔒","🔓"] },
    { id: "sym", icon: "❤️", name: "Symbols", items: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟","☮️","✝️","☪️","🕉️","☸️","✡️","🔯","🕎","☯️","☦️","🛐","⛎","♈️","♉️","♊️","♋️","♌️","♍️","♎️","♏️","♐️","♑️","♒️","♓️","🆔","⚛️","🉑","☢️","☣️","📴","📳","🈶","🈚️","🈸","🈺","🈷️","✴️","🆚","💮","🉐","㊙️","㊗️","🈴","🈵","🈹","🈲","🅰️","🅱️","🆎","🆑","🅾️","🆘","❌","⭕️","🛑","⛔️","📛","🚫","💯","💢","♨️","🚷","🚯","🚳","🚱","🔞","📵","🚭","❗️","❕","❓","❔","‼️","⁉️","🔅","🔆","〽️","⚠️","🚸","🔱","⚜️","🔰","♻️","✅","🈯️","💹","❇️","✳️","❎","🌐","💠","Ⓜ️","🌀","💤","🏧","🚾","♿️","🅿️","🛗","🈳","🈂️","🛂","🛃","🛄","🛅","🚹","🚺","🚼","⚧️","🚻","🚮","🎦","📶","🈁","🔣","ℹ️","🔤","🔡","🔠","🆖","🆗","🆙","🆒","🆕","🆓","0️⃣","1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟","🔢","#️⃣","*️⃣","⏏️","▶️","⏸️","⏯️","⏹️","⏺️","⏭️","⏮️","⏩","⏪","⏫","⏬","◀️","🔼","🔽","➡️","⬅️","⬆️","⬇️","↗️","↘️","↙️","↖️","↕️","↔️","↪️","↩️","⤴️","⤵️","🔀","🔁","🔂","🔄","🔃","🎵","🎶","➕","➖","➗","✖️","♾️","💲","💱","™️","©️","®️","〰️","➰","➿","🔚","🔙","🔛","🔝","🔜","✔️","☑️","🔘","🔴","🟠","🟡","🟢","🔵","🟣","⚫️","⚪️","🟤","🔺","🔻","🔸","🔹","🔶","🔷","🔳","🔲","▪️","▫️","◾️","◽️","◼️","◻️","🟥","🟧","🟨","🟩","🟦","🟪","⬛️","⬜️","🟫","🔈","🔇","🔉","🔊","🔔","🔕","📣","📢","👁‍🗨","💬","💭","🗯️","♠️","♣️","♥️","♦️","🃏","🎴","🀄️","🕐","🕑","🕒","🕓","🕔","🕕","🕖","🕗","🕘","🕙","🕚","🕛","🕜","🕝","🕞","🕟","🕠","🕡","🕢","🕣","🕤","🕥","🕦","🕧"] },
    { id: "fla", icon: "🏁", name: "Flags", items: ["🏁","🚩","🎌","🏴","🏳️","🏳️‍🌈","🏳️‍⚧️","🏴‍☠️","🇲🇽","🇪🇸","🇺🇸","🇨🇦","🇦🇷","🇨🇴","🇨🇱","🇵🇪","🇬🇧","🇫🇷","🇩🇪","🇮🇹","🇯🇵","🇰🇷","🇨🇳","🇧🇷","🇮🇳","🇷🇺","🇿🇦","🇦🇺","🇳🇿"] }
];

// 3. SEGURIDAD CONTRA HACKEOS (XSS)
window.escapeHTML = function(str) {
    return String(str || "").replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
};

// 4. EL CONVERTIDOR MÁGICO (Detecta si va solo para hacerlo 56x56 o 24x24)
window.parseEmotes = function(safeText) {
    let cleanText = safeText.trim();
    // Revisa si el mensaje son PURAS etiquetas de emotes separados por espacios
    let onlyEmotesRegex = /^(\s*:[a-zA-Z0-9_]+:\s*)+$/;
    let isOnlyEmotes = onlyEmotesRegex.test(cleanText);
    
    let size = isOnlyEmotes ? '56px' : '24px';
    
    // ✨ FIX: Truco CSS estilo Discord para centrar la imagen en medio del texto
    // Si va acompañado de texto, lo bajamos 6 pixeles para clavarlo en el centro de la letra
    let alignStyle = isOnlyEmotes ? 'vertical-align: middle;' : 'vertical-align: -6px; margin: 0 2px;';

    return cleanText.replace(/:([a-zA-Z0-9_]+):/g, (match, name) => {
        if (window.customEmotes[name]) {
            return `<img src="${window.customEmotes[name]}" style="width:${size}; height:${size}; ${alignStyle} display:inline-block;" alt="${name}" title=":${name}:" onerror="this.src='assets/default pfp.png';">`;
        }
        return match; 
    });
};

// 5. GUARDAR EMOTES RECIENTES
window.saveRecentEmote = function(emoteName) {
    let recents = JSON.parse(localStorage.getItem('mbw_recent_emotes') || "[]");
    recents = recents.filter(e => e !== emoteName); // Quita duplicados
    recents.unshift(emoteName); // Lo pone al inicio
    if(recents.length > 10) recents.pop(); // Máximo 10 recientes
    localStorage.setItem('mbw_recent_emotes', JSON.stringify(recents));
};

// ==========================================
// ✨ EL CHAT Y EL PANEL DISCORD (CONSOLIDADO)
// ==========================================

// ✨ NUEVO: Convertidor de tiempo extendido (Minutos, Horas, Días, Meses, Años)
window.formatTimeAgo = function(timestamp) {
    // Si el usuario nunca en su vida ha entrado desde que pusiste esta actualización
    if (!timestamp) return "Desconectado"; 

    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);

    if (mins < 1) return "Activo hace un momento";
    if (mins < 60) return `Activo hace ${mins} min`;

    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Activo hace ${hours} hora${hours !== 1 ? 's' : ''}`;

    const days = Math.floor(hours / 24);
    if (days === 1) return "Activo ayer";
    if (days < 30) return `Activo hace ${days} días`;

    const months = Math.floor(days / 30);
    if (months < 12) return `Activo hace ${months} mes${months !== 1 ? 'es' : ''}`;

    const years = Math.floor(days / 365);
    return `Activo hace ${years} año${years !== 1 ? 's' : ''}`;
};

// ==========================================
// ✨ CHAT PÚBLICO UNIVERSAL (ONLINE & OFFLINE)
// ==========================================
let chatFadeTimeout;

window.agregarMensajeChatPublico = function(autor, texto) {
    const container = document.getElementById('chat-container');
    const messagesDiv = document.getElementById('chat-messages');
    const input = document.getElementById('chat-input');
    if (!messagesDiv || !container) return;

    const msgDiv = document.createElement('div');
    // Le forzamos el estilo base para que no dependa de otras clases
    msgDiv.style.cssText = "margin-bottom: 4px; font-family: 'Pixeltype', sans-serif; font-size: 20px; text-shadow: 1px 1px 0 #000;";

    // Limpiamos la palabra por si se coló un espacio en blanco ("Sistema " en vez de "Sistema")
    const cleanAutor = autor.trim();

    // Aceptamos "Sistema" y "System" (commands.js y los avisos del host usan "System")
    const autorLower = cleanAutor.toLowerCase();
    if (autorLower === "sistema" || autorLower === "system") {
        // ✨ FUERZA BRUTA: Usamos !important para obligar al navegador a pintarlo gris
        msgDiv.innerHTML = `<span style="color: gray !important; font-style: italic;">[Sistema] ${texto}</span>`;
    } 
    else if (cleanAutor === "Error") {
        msgDiv.innerHTML = `<span style="color: #ff5555 !important; font-style: italic;">[Error] ${texto}</span>`;
    } 
    else {
        // Mensajes de jugadores normales
        const isCommand = texto.startsWith('/');
        const textColor = isCommand ? '#f1c40f' : 'white'; 
        
        // ✨ Convertir links en el chat público
        let textoConLinks = texto.replace(
            /(https?:\/\/[^\s<]+)/g,
            '<a href="$1" target="_blank" style="color: #3498db; text-decoration: underline; cursor: pointer;" onclick="event.stopPropagation();">$1</a>'
        );

        msgDiv.innerHTML = `<span style="color: #4DA6FF !important; font-weight:bold;">&lt;${cleanAutor}&gt;</span> <span style="color: ${textColor} !important;">${textoConLinks}</span>`;
    }

    messagesDiv.appendChild(msgDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    // Mostrar el contenedor
    container.style.display = 'block';
    if (document.activeElement !== input) {
        input.style.display = 'none';
        
        clearTimeout(chatFadeTimeout);
        chatFadeTimeout = setTimeout(() => {
            container.style.display = 'none';
        }, 6000);
    }
};

// ==========================================
// El menú de clic derecho, el panel de emojis de la caja de escribir y todo lo demás
// del chat privado viven ahora en scripts/chat-dm.js
// ==========================================
