// =========================================================
// 📂 FILE MENU (FULLSCREEN DYNAMIC THEMES) - CÓDIGO UNIFICADO
// =========================================================

const projectTemplates = [
    {
        filename: 'Superflat World.mbw',
        name: 'Superflat World',
        version: '1.27.1',
        seed: '153366',
        author: 'Carlos Petit',
        image: 'assets/Superflat World.png'
    },
    {
        filename: 'Biomes 1.1 - Nether Update.mbw',
        name: 'Biomes 1.1 - Nether Update',
        version: '1.31.1',
        seed: 'Crystal',
        author: 'Crystal',
        image: 'assets/Biomes 1_1 - Nether Update.png'
    },
    {
        filename: '1.31.2 - All block tiles test.mbw',
        name: '1.31.2 - All block tiles test',
        version: '1.31.2',
        seed: '150167',
        author: 'WSDguy2014',
        image: 'assets/All block tiles test.png'
    }
];

function initBackstageMenu() {
    if (document.getElementById('backstage-menu')) return;

    const style = document.createElement('style');
    style.innerHTML = `
        #backstage-menu {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background-color: var(--bg-panel); color: var(--text);
            z-index: 999999; display: none; flex-direction: row; 
            font-family: inherit;
        }

        .backstage-sidebar {
            width: 232px; background-color: var(--bg-header);
            display: flex; flex-direction: column;
            box-shadow: 2px 0 10px rgba(0,0,0,0.5);
            z-index: 2;
        }

        .backstage-back-btn {
            background: transparent; color: var(--text); border: none; font-size: 22px;
            text-align: left; padding: 15px 20px; cursor: pointer; font-weight: bold;
            margin-bottom: 20px; display: flex; align-items: center; gap: 10px;
        }
        .backstage-back-btn:hover { background-color: var(--input-bg); }

        .backstage-nav-btn {
            background: transparent; color: var(--text); border: none; font-size: 16px; font-weight: bold;
            text-align: left; padding: 15px 25px; cursor: pointer; transition: background 0.2s;
            border-left: 5px solid transparent; display: flex; align-items: center; gap: 10px;
        }
        .backstage-nav-btn:hover { background-color: var(--input-bg); }
        .backstage-nav-btn.active { 
            background-color: var(--bg-panel); 
            border-left: 5px solid #4DA6FF; 
            color: #4DA6FF; 
        }

        .backstage-content {
            flex: 1; background-color: var(--bg-panel); color: var(--text);
            display: flex; flex-direction: column; overflow: hidden;
        }

        .backstage-panel { 
            display: none; animation: fadeIn 0.3s ease; 
            flex: 1; overflow-y: auto; flex-direction: column;
        }
        .backstage-panel.active { display: flex; }
        
        #panel-my-worlds, #panel-templates { padding: 50px 80px; }
        #panel-multiplayer { padding: 0; background: #2c3e50; }

        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        .template-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; margin-top: 30px; }
        .template-card {
            background-color: var(--bg-dark); border: 2px solid var(--border); border-radius: 6px;
            display: flex; flex-direction: column; cursor: pointer; overflow: hidden; height: auto; min-height: 310px;
            transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        }
        .template-card:hover { transform: translateY(-5px); border-color: #4DA6FF; box-shadow: 0 8px 20px rgba(0,0,0,0.5); }
        .template-thumb {
            width: 100%; height: 200px; background-color: var(--input-bg); background-size: cover; background-position: center; 
            image-rendering: pixelated; border-bottom: 2px solid var(--border); display: flex; justify-content: center; align-items: center;
        }
        .template-info { padding: 15px; display: flex; flex-direction: column; gap: 5px; text-align: left; }
        .t-name { font-size: 18px; font-weight: bold; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .t-meta { font-size: 13px; color: var(--text); opacity: 0.7; }
    `;
    document.head.appendChild(style);

    const backstageHTML = `
        <div class="backstage-sidebar">
            <button class="backstage-back-btn" onclick="closeFileMenu()"><span>⬅️</span> Back</button>
            <button id="nav-btn-my-worlds" class="backstage-nav-btn active" onclick="switchBackstageTab('my-worlds')">📁 My Worlds</button>
            <button id="nav-btn-templates" class="backstage-nav-btn" onclick="switchBackstageTab('templates')">🌍 Templates</button>
            
            <div style="height: 1px; background: var(--border); margin: 5px 25px; opacity: 0.5;"></div>
            <button id="nav-btn-multiplayer" class="backstage-nav-btn" onclick="switchBackstageTab('multiplayer')">🌐 Multiplayer</button>
            
            <div style="height: 1px; background: var(--border); margin: 5px 25px; opacity: 0.5;"></div>
            <button class="backstage-nav-btn" onclick="document.getElementById('file-input').click(); closeFileMenu();" style="font-weight: normal; font-size: 14px; opacity: 0.8;">📥 Load World</button>
            <button class="backstage-nav-btn" onclick="if(typeof fileManager !== 'undefined') fileManager.export(); closeFileMenu();" style="font-weight: normal; font-size: 14px; opacity: 0.8;">💾 Export</button>
			<button class="backstage-nav-btn" onclick="openModal('settings-modal'); closeFileMenu();" style="font-weight: normal; font-size: 14px; opacity: 0.8; margin-top: auto; margin-bottom: 10px;">⚙️ Configuration</button>
        </div>
        
        <div class="backstage-content">
            
            <div style="display: flex; justify-content: flex-end; align-items: center; padding: 4px 30px; background: var(--bg-header); border-bottom: 2px solid var(--border); gap: 8px; z-index: 10; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
                <div style="position: relative; cursor: pointer; font-size: 28px;" onclick="openMpSidebar('chats')">
                    💬
                    <span id="badge-messages" style="display: none; position: absolute; top: -5px; right: -10px; background: #e74c3c; color: white; font-size: 14px; font-weight: bold; font-family: Arial; padding: 2px 6px; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">0</span>
                </div>
                <div style="position: relative; cursor: pointer; font-size: 28px;" onclick="openMpSidebar('friends')">
                    👥
                    <span id="badge-friends" style="display: none; position: absolute; top: -5px; right: -10px; background: #e74c3c; color: white; font-size: 14px; font-weight: bold; font-family: Arial; padding: 2px 6px; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">0</span>
                </div>
                <div style="position: relative; cursor: pointer; font-size: 28px;" onclick="openMpSidebar('invites')">
                    🔔
                    <span id="badge-invites" style="display: none; position: absolute; top: -5px; right: -10px; background: #e74c3c; color: white; font-size: 14px; font-weight: bold; font-family: Arial; padding: 2px 6px; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">0</span>
                </div>
                <div id="mp-pfp-preview" onclick="document.getElementById('profile-upload').click()" title="Click to change picture" style="width: 36px; height: 36px; border-radius: 50%; background-size: cover; background-position: center; border: 2px solid var(--border); cursor: pointer; background-color: var(--input-bg); transition: 0.2s;" onmouseover="this.style.borderColor='#4DA6FF'" onmouseout="this.style.borderColor='var(--border)'"></div>
            </div>

            <div id="panel-my-worlds" class="backstage-panel active">
                <div id="fs-local-worlds-list" style="display: flex; flex-direction: column; max-width: 900px;"></div>
            </div>
            
            <div id="panel-templates" class="backstage-panel">
                <div id="template-grid-container" class="template-grid"></div>
            </div>

            <div id="panel-multiplayer" class="backstage-panel">
                <div style="flex: 1; display: flex; overflow: hidden; position: relative; width: 100%;">
                    
                    <div id="mp-servers-view" style="flex: 1; display: flex; flex-direction: row; padding: 0px; gap: 20px; width: 100%;">
                        <div id="mp-main-wizard" style="flex: 1; padding: 0px; overflow-y: auto; display: flex; flex-direction: column; align-items: center; color: white; font-family: 'Pixeltype', sans-serif;">
                            
                            <div id="mp-view-join" style="display: block; width: 100%; max-width: 500px; margin-top: 20px; text-align: left;">
                                <h2 style="margin: 0px; color: #f1c40f; font-size: 48px; text-shadow: 2px 2px 0 #000; text-align: center; margin-bottom: 20px;">🌐 Public Servers</h2>
                                
                                <div id="public-servers-list" style="height: 250px; overflow-y: auto; background: rgba(0,0,0,0.3); border-radius: 5px; padding: 10px; margin-bottom: 15px; display: flex; flex-direction: column; gap: 8px; border: 2px solid #34495e;">
                                    <p style="text-align: center; color: #bdc3c7; font-size: 24px;">Searching for worlds...</p>
                                </div>

                                <p style="margin-bottom: 5px; color: #bdc3c7; font-size: 22px; text-align: center;">Join by ID or Create your own:</p>
                                
                                <div style="display: flex; gap: 10px; margin-bottom: 15px; align-items: center;">
                                    <button class="menu-btn" style="background: #2ecc71; border: 2px solid #27ae60; font-size: 22px; padding: 8px 15px; color: white; cursor: pointer; border-radius: 5px; min-width: 169px;" onclick="setMpView('create-1')">Create Server</button>
                                    
                                    <input type="text" id="join-peer-id" placeholder="Paste ID here..." style="flex: 1; width: 0px; font-size: 24px; padding: 8px; box-sizing: border-box; background: #ecf0f1; border: none; border-radius: 4px; outline: none; color: #333;">
                                    
                                    <button class="menu-btn" style="background: #3498db; border: 2px solid #2980b9; font-size: 22px; padding: 8px 15px; color: white; cursor: pointer; border-radius: 5px;" onclick="joinMultiplayerSession()">Connect</button>
                                </div>
                            </div>

                            <div id="mp-view-create-1" style="display: none; width: 100%; max-width: 450px; margin-top: 20px;">
                                <h3 style="margin-bottom: 10px; color: #bdc3c7; font-size: 28px;">Players Limit:</h3>
                                <div id="mp-player-buttons" style="display: flex; justify-content: space-between; margin-bottom: 20px;">
                                    <button class="mp-limit-btn selected-limit" onclick="setMpLimit(2)">2</button>
                                    <button class="mp-limit-btn" onclick="setMpLimit(3)">3</button>
                                    <button class="mp-limit-btn" onclick="setMpLimit(4)">4</button>
                                    <button class="mp-limit-btn" onclick="setMpLimit(5)">5</button>
                                    <button class="mp-limit-btn" onclick="setMpLimit(6)">6</button>
                                </div>
                                
                                <div style="margin-bottom: 25px; display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.2); padding: 10px 15px; border-radius: 6px; border: 1px solid #34495e;">
                                    <div style="color: #bdc3c7; font-size: 26px;">Access: <span id="mp-access-label" style="color: #2ecc71; font-weight: bold;">Public</span></div>
                                    <label class="ms-switch">
                                        <input type="checkbox" id="mp-access-toggle" onchange="toggleMpAccess(this)">
                                        <span class="ms-slider"></span>
                                    </label>
                                </div>

                                <button class="menu-btn" style="background: #2ecc71; border: 2px solid #27ae60; width: 100%; font-size: 26px; color: white; padding: 10px; cursor: pointer; border-radius: 5px; margin-bottom: 10px;" onclick="setMpView('create-map')">Next ➡️</button>
                                <button class="menu-btn" style="background: #7f8c8d; border: 2px solid #95a5a6; width: 100%; font-size: 26px; color: white; padding: 10px; cursor: pointer; border-radius: 5px;" onclick="setMpView('join')">⬅️ Cancel</button>
                            </div>

                            <div id="mp-view-create-map" style="display: none; width: 100%; max-width: 450px; margin-top: 0px; text-align: left;">
                                <h3 style="margin-bottom: 10px; color: #bdc3c7; font-size: 28px; text-align: center;">Select Map:</h3>
                                <div id="mp-map-list" style="height: 190px; overflow-y: auto; background: rgba(0,0,0,0.3); border-radius: 5px; padding: 10px; margin-bottom: 15px; display: flex; flex-direction: column; gap: 8px; border: 2px solid #34495e;">
                                    </div>
                                <button id="btn-next-to-id" class="menu-btn" style="background: #2ecc71; border: 2px solid #27ae60; width: 100%; font-size: 26px; color: white; padding: 10px; cursor: not-allowed; border-radius: 5px; margin-bottom: 10px; opacity: 0.5;" disabled onclick="prepareServerMap()">Next ➡️</button>
                                <button class="menu-btn" style="background: #7f8c8d; border: 2px solid #95a5a6; width: 100%; font-size: 26px; color: white; padding: 10px; cursor: pointer; border-radius: 5px;" onclick="setMpView('create-1')">⬅️ Back</button>
                            </div>

                            <div id="mp-view-create-2" style="display: none; width: 100%; max-width: 450px; margin-top: 20px;">
                                <button class="menu-btn" style="background: #e67e22; border: 2px solid #d35400; width: 100%; margin-bottom: 15px; font-size: 26px; color: white; padding: 10px; cursor: pointer; border-radius: 5px;" onclick="hostMultiplayerSession()">Generate ID & Start</button>
                                <p style="margin-bottom: 5px; color: #bdc3c7; font-size: 22px; text-align: center;">Your Room ID (Share this):</p>
                                <input type="text" id="my-peer-id" readonly onclick="copyRoomId()" title="Click to copy!" placeholder="ID will appear here..." style="width: 100%; text-align: center; font-size: 26px; cursor: pointer; background: #ecf0f1; border: none; padding: 10px; border-radius: 4px; box-sizing: border-box; outline: none; color: #333;">
                                <p id="copy-hint" style="color: #2ecc71; font-size: 18px; margin-top: 5px; height: 16px; visibility: hidden; text-align: center;">Copied to clipboard!</p>
                                <button class="menu-btn" style="background: #7f8c8d; border: 2px solid #95a5a6; width: 100%; font-size: 26px; color: white; padding: 10px; cursor: pointer; border-radius: 5px; margin-top: 15px;" onclick="setMpView('create-map')">⬅️ Close Server & Back</button>
                            </div>

                            <p id="multiplayer-status" style="display: none; margin-top: 25px; font-weight: bold; font-size: 28px; color: #bdc3c7;">Status: Not Connected</p>
                        </div>
                        <div style="width: 364px; padding: 20px; display: flex; flex-direction: column; align-items: center; font-family: 'Pixeltype', sans-serif; border-left: 2px solid #34495e;">
                            <h2 style="margin-top: 0; color: #2ecc71; font-size: 44px; text-shadow: 2px 2px 0 #000; margin-bottom: 15px;">Online</h2>
                            <div id="mp-online-users-list" style="width: 100%; flex: 1; overflow-y: auto; background: rgba(0,0,0,0.2); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 8px; border: 2px solid #34495e;">
                                <p style="text-align: center; color: #bdc3c7; font-size: 24px;">Cargando jugadores...</p>
                            </div>
                        </div>
                    </div>

                    <div id="mp-full-chat-view" style="display: none; flex: 1; flex-direction: row; width: 100%; height: 100%; background: #2c3e50;">
                        <div style="width: 350px; background: #34495e; border-right: 2px solid #1a252f; display: flex; flex-direction: column;">
                            <div style="padding: 15px; border-bottom: 2px solid #1a252f; display: flex; justify-content: space-between; align-items: center;">
                                <h3 style="margin: 0; color: white; font-size: 32px;">💬 Chats</h3>
                            </div>
                            <div id="full-chat-list-container" style="flex: 1; overflow-y: auto; padding: 0px; display: flex; flex-direction: column; gap: 0px;"></div>
                        </div>

                        <div style="flex: 1; display: flex; flex-direction: column; background: #2c3e50; position: relative; width: 68%;">
                            
                            <div id="full-chat-placeholder" style="flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                                <span style="font-size: 80px; opacity: 0.2; margin-bottom: 20px;">💬</span>
                                <h2 style="color: #bdc3c7; font-family: 'Pixeltype', sans-serif; font-size: 42px; opacity: 0.5; margin: 0;">Selecciona un chat para iniciar</h2>
                            </div>

                            <div id="full-chat-active" style="display: none; flex: 1; flex-direction: column; height: 100%;">
                                <div style="background: #1a252f; padding: 15px 25px; display: flex; align-items: center; gap: 15px; box-shadow: 0 2px 10px rgba(0,0,0,0.3); z-index: 2;">
                                    <div id="full-chat-header-pfp" style="width: 45px; height: 45px; border-radius: 50%; background-size: cover; background-position: center; border: 2px solid white;"></div>
                                    <h4 id="full-chat-header-name" style="margin: 0; color: white; font-size: 36px; font-family: 'Pixeltype', sans-serif;">Nombre</h4>
                                </div>
                                
                                <div id="full-dm-messages" style="flex: 1; padding: 25px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; background: #2c3e50;"></div>
                                
                                <div style="display: flex; padding: 6px 25px; background: #34495e; gap: 0px; border-top: 2px solid #1a252f;">
                                    <input type="text" id="full-dm-input" placeholder="Send a message..." style="flex: 1; padding: 12px; font-family: 'Pixeltype', sans-serif; font-size: 26px; border-radius: 8px; border: none; outline: none; background: #ecf0f1; color: #333;">
                                    <button onclick="sendPrivateMessage()" style="background: #2ecc71; border: none; border-radius: 8px; padding: 0 25px; font-size: 28px; cursor: pointer; color: white; transition: 0.2s; font-family: 'Pixeltype', sans-serif;" onmouseover="this.style.background='#27ae60'" onmouseout="this.style.background='#2ecc71'">➔</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div id="mp-right-sidebar" style="position: absolute; top: 0; right: 0; bottom: 0; width: 350px; background: #34495e; border-left: 2px solid #1a252f; display: none; flex-direction: column; box-shadow: -10px 0 25px rgba(0,0,0,0.6); font-family: 'Pixeltype', sans-serif; z-index: 20; animation: slideIn 0.3s ease-out;">
                        <style>
                            @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
                        </style>
                        <div id="sidebar-list-view" style="flex: 1; display: flex; flex-direction: column;">
                            <div style="background: #2c3e50; padding: 15px; display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1a252f;">
                                <h3 id="sidebar-title" style="margin: 0; color: white; font-size: 32px;">Bandeja</h3>
                                <span onclick="closeMpSidebar()" style="color: white; cursor: pointer; font-size: 28px;">&times;</span>
                            </div>
                            <div id="sidebar-content" style="flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px;"></div>
                        </div>
                    </div>

                </div>
            </div>

        </div>
    `;
    const container = document.createElement('div');
    container.id = 'backstage-menu';
    container.innerHTML = backstageHTML;
    document.body.appendChild(container);

    generateTemplateCards();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initBackstageMenu);
} else {
    initBackstageMenu();
}

function createUnifiedWorldCard(data) {
    let imageStyle = data.image ? `background-image: url('${data.image}');` : '';
    let fallbackIcon = data.image ? '' : '<span style="font-size:60px; opacity:0.3; color: var(--text);">🌍</span>';
    let deleteBtnHTML = !data.isTemplate ? `<button class="delete-btn" onclick="event.stopPropagation(); deleteSavedLocalWorld('${data.name}');" style="position: absolute; top: 10px; right: 10px; background: rgba(231, 76, 60, 0.9); color: white; border: 2px solid #c0392b; border-radius: 4px; width: 34px; height: 34px; font-size: 18px; cursor: pointer; display: flex; justify-content: center; align-items: center; z-index: 10; box-shadow: 0 2px 4px rgba(0,0,0,0.5);" title="Delete World">🗑️</button>` : '';
    return `<div class="template-card" style="position: relative;">${deleteBtnHTML}<div class="template-thumb" style="${imageStyle}" onclick="${data.onClick}">${fallbackIcon}</div><div class="template-info" onclick="${data.onClick}"><div class="t-name" title="${data.name}">${data.name}</div><div class="t-meta"><b>Version:</b> ${data.version || ""}</div><div class="t-meta"><b>Author:</b> ${data.author || ""}</div>${data.dateStr ? `<div class="t-meta">📆 ${data.dateStr}</div>` : ''}${data.sizeStr ? `<div class="t-meta">📄 ${data.sizeStr}</div>` : ''}</div></div>`;
}

window.openFileMenu = function() {
    const menu = document.getElementById('backstage-menu');
    if (menu) menu.style.display = 'flex';
    const savedPic = localStorage.getItem('mbw_profile_pic');
    const lobbyPfp = document.getElementById('mp-pfp-preview');
    if (lobbyPfp) lobbyPfp.style.backgroundImage = savedPic ? `url('${savedPic}')` : `url('assets/default pfp.png')`;
    switchBackstageTab('my-worlds');
};

window.closeFileMenu = function() {
    const menu = document.getElementById('backstage-menu');
    if (menu) menu.style.display = 'none';
};

window.switchBackstageTab = function(tabName) {
    document.querySelectorAll('.backstage-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.backstage-nav-btn').forEach(b => b.classList.remove('active'));
    const targetPanel = document.getElementById('panel-' + tabName);
    const targetBtn = document.getElementById('nav-btn-' + tabName);
    if (targetPanel) targetPanel.classList.add('active');
    if (targetBtn) targetBtn.classList.add('active');
    
    if (tabName === 'my-worlds') renderFullscreenWorldsList(); 
    else if (tabName === 'multiplayer') {
        const savedPic = localStorage.getItem('mbw_profile_pic');
        const lobbyPfp = document.getElementById('mp-pfp-preview');
        if (lobbyPfp) lobbyPfp.style.backgroundImage = savedPic ? `url('${savedPic}')` : `url('assets/default pfp.png')`;
        
        // ✨ Al cliquear el botón "🌐 Multiplayer" reseteamos a la vista normal de Servidores
        const serversView = document.getElementById('mp-servers-view');
        const fullChatView = document.getElementById('mp-full-chat-view');
        const sidebar = document.getElementById('mp-right-sidebar');
        if (serversView) serversView.style.display = 'flex';
        if (fullChatView) fullChatView.style.display = 'none';
        if (sidebar) sidebar.style.display = 'none';
    }
};

function generateTemplateCards() {
    const grid = document.getElementById('template-grid-container');
    if (!grid) return;
    let cardsHTML = '';
    for (let t of projectTemplates) cardsHTML += createUnifiedWorldCard({ isTemplate: true, name: t.name, author: t.author, version: t.version, image: t.image, onClick: `loadTemplate('${t.filename}')` });
    grid.innerHTML = cardsHTML;
}

window.loadTemplate = function(filename) {
    fetch('dev-maps/' + filename).then(r => r.blob()).then(blob => {
        const file = new File([blob], filename, { type: "application/octet-stream" });
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        const fileInput = document.getElementById('file-input');
        if (fileInput) { fileInput.files = dataTransfer.files; fileInput.dispatchEvent(new Event('change')); }
        closeFileMenu(); 
    });
};

// ✨ NUEVO: Función unificada para formatear el peso de los archivos
window.formatBytes = function(bytes) {
    if (bytes === 0) return '0 KB';
    const k = 1024;
    if (bytes < k * k) {
        return (bytes / k).toFixed(1) + ' KB';
    } else {
        return (bytes / (k * k)).toFixed(2) + ' MB';
    }
};

window.renderFullscreenWorldsList = async function() {
    const listDiv = document.getElementById("fs-local-worlds-list");
    if(!listDiv || typeof localDB === 'undefined') return;
    const worlds = await localDB.getWorlds();
    
    if(worlds.length === 0) {
        listDiv.style.cssText = "display: flex; flex-direction: column; max-width: 900px;";
        listDiv.className = "";
        listDiv.innerHTML = `<div style="text-align: center; padding: 60px; background: var(--bg-dark); border-radius: 12px; border: 2px dashed var(--border);"><div style="font-size: 60px; opacity: 0.3; margin-bottom: 15px;">📭</div><h3 style="color: var(--text); font-size: 24px; margin: 0 0 10px 0;">No saved worlds yet</h3><button onclick="switchBackstageTab('templates')" style="margin-top: 25px; padding: 10px 30px; background: #4DA6FF; color: #FFF; border: none; font-weight: bold; cursor: pointer; font-size: 16px; border-radius: 4px;">Start from a Template</button></div>`;
        return;
    }
    
    worlds.sort((a, b) => b.date - a.date);
    listDiv.style.cssText = ""; 
    listDiv.className = "template-grid";
    
    listDiv.innerHTML = worlds.map(w => {
        const dateObj = new Date(w.date);
        const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        // ✨ Usamos la nueva función unificada
        const bytes = new Blob([w.data]).size;
        const sizeFormatted = window.formatBytes(bytes);
        
        return createUnifiedWorldCard({ 
            isTemplate: false, 
            name: w.name, 
            author: w.fileInfo ? w.fileInfo.author : "", 
            version: w.fileInfo ? w.fileInfo.version : "", 
            image: w.thumb, 
            dateStr: dateStr, 
            sizeStr: sizeFormatted, // <--- Aquí inyectamos el resultado
            onClick: `loadSavedLocalWorld('${w.name}'); closeFileMenu();` 
        });
    }).join('');
};

window.deleteSavedLocalWorld = async function(name) {
    if(confirm('Are you sure?')) { await localDB.deleteWorld(name); renderFullscreenWorldsList(); }
};