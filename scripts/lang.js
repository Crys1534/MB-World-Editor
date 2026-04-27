// ==========================================
// 🌐 DICCIONARIO DE IDIOMAS (i18n)
// ==========================================
const i18n = {
    en: {
        // --- DRAG & DROP ---
        "drag_drop_title": "📁 Drop your world file here!",
        "drag_drop_subtitle": "Drop the .mbw file anywhere",

        // --- TOP BAR ---
        "btn_file": "File",
        "tooltip_save_now": "Save Now",
        "lbl_auto_save": "Auto save",
        "btn_multiplayer": "Multiplayer",
        "btn_help": "Help",
        "menu_configuration": "Configuration",
        "menu_join_discord": "Join our community!",
        "menu_about": "About...",
        "tooltip_undo": "Undo (Ctrl+Z)",
        "tooltip_redo": "Redo (Ctrl+Y)",
        "tooltip_news": "Updates & Changelog",
        "btn_news": "News",

        // --- RIBBON TABS ---
        "tab_insert": "Insert",
        "tab_world_settings": "World Settings",
        "tab_create": "Create",
        "tab_view": "View",
        "btn_export": "Export",
        "btn_world_info": "World Info",

        // --- INSERT TAB ---
        "tooltip_paste": "Paste (Ctrl+V)",
        "btn_paste": "Paste",
        "tooltip_cut": "Cut (Ctrl+X)",
        "tooltip_copy": "Copy (Ctrl+C)",
        "lbl_clipboard": "Clipboard",
        "lbl_size": "Size",
        "lbl_rounded": "Rounded",
        "tooltip_spray": "Toggle Spray Mode",
        "btn_spray": "Spray",
        "lbl_brush_settings": "Brush Settings",
        "tooltip_inventory": "Open Inventory (E)",
        "lbl_inventory": "Inventory (E)",
        "tooltip_save_struct": "Select an area first",
        "btn_save_structure_multiline": "Save<br>Structure",
        "lbl_empty": "Empty",
        "tooltip_structures": "Open Library / See All",
        "lbl_structures_tab": "Structures (R)",
        "tooltip_mobs": "Open Mob Browser",
        "lbl_mobs_tab": "Mobs (M)",

        // --- WORLD SETTINGS TAB ---
        "lbl_gamemode": "Gamemode:",
        "gm_survival": "Survival",
        "gm_creative": "Creative",
        "gm_adventure": "Adventure",
        "gm_spectator": "Spectator",
        "lbl_difficulty": "Difficulty:",
        "diff_peaceful": "Peaceful",
        "diff_easy": "Easy",
        "diff_normal": "Normal",
        "diff_hard": "Hard",
        "lbl_cheats": "Cheats",
        "lbl_hardcore": "Hardcore",
        "lbl_day": "Day:",
        "tooltip_days_passed": "Days passed (Read Only)",
        "lbl_time": "Time:",
        "lbl_live_time": "Live Time",
        "lbl_weather": "Weather:",
        "weather_clear": "Clear",
        "weather_rain": "Rain",
        "weather_thunder": "Thunder",
        "lbl_world_settings": "World Settings",
        "btn_manage_achievements": "Manage<br>Achievs.",
        "lbl_achievements": "Achievements",
        "lbl_keep_inv": "Keep<br>Inv.",
        "lbl_daylight_cycle": "Daylight<br>Cycle",
        "lbl_mob_griefing": "Mob<br>Griefing",
        "lbl_mob_loot": "Mob<br>Loot",
        "lbl_fire_tick": "Fire<br>Tick",
        "lbl_gamerules": "Game Rules",
        "lbl_health": "Health",
        "lbl_hunger": "Hunger",
        "lbl_xp": "XP",
        "lbl_player": "Player",

        // --- CREATE TAB ---
        "btn_create_chest": "Create<br>Loot Chest",
        "lbl_chests": "Chests",
        "btn_create_item": "Create<br>Item",
        "lbl_custom_items": "Custom Items",

        // --- VIEW TAB ---
        "lbl_show_grid": "Show Grid",
        "lbl_grid": "Grid",
        "btn_change_dim": "Change<br>Dimension",
        "lbl_dimensions": "Dimensions",
        "lbl_weather_anim": "Weather<br>Animation",

        // --- TOOLBAR ---
        "tooltip_tool_move": "Move Tool",
        "tooltip_tool_pencil": "Pencil",
        "tooltip_tool_eraser": "Eraser",
        "tooltip_tool_bucket": "Bucket",
        "tooltip_tool_select": "Select",
        "tooltip_tool_magic": "Magic Wand",
        "tooltip_tool_lasso": "Free form",
        "tooltip_tool_eyedropper": "Eyedropper",
        "tooltip_screenshot": "Screenshot",

        // --- SIDEBAR WORLD INFO ---
        "side_info_title": "World Info",
        "side_info_name": "World Name:",
        "side_info_author": "Author:",
        "side_info_version": "Version:",
        "side_info_seed": "Seed:",
        "side_info_cheats": "Cheats Enabled:",
        "side_info_dragon": "Defeated Enderdragon:",
        "side_info_size": "File Size: ",

        // --- MODAL: SETTINGS ---
        "config_title": "Configuration",
        "config_language": "Language",
        "config_theme": "Theme",
        "config_autosave": "Auto-Save Interval",
        "config_off": "Off (Disabled)",
        "config_1m": "Every 1 minute",
        "config_5m": "Every 5 minutes",
        "config_10m": "Every 10 minutes",
        "config_volume": "Master Volume",

        // --- MODAL: INVENTORY ---
        "modal_inventory": "Inventory",
        "pl_search": "Search...",
        "chest_content_title": "Loot Chest Content",
        "pl_chest_name": "Chest Name...",
        "btn_save_chest": "Save Chest",
        "item_creator_title": "Custom Item Creator",
        "btn_save_item": "💾 Save Item",
        "msg_select_first": "Select an item",
        "lbl_enchantments": "Enchantments",

        // --- MODAL: STRUCTURES ---
        "struct_browser_title": "Structures Browser",
        "tab_saved": "Saved",
        "tab_vanilla": "Vanilla",
        "tab_community": "Community",
        "tooltip_import_json": "Import JSON",
        "btn_import_mini": "📥 Import",
        "tooltip_export_json": "Export JSON",
        "btn_export_mini": "💾 Export",
        "tooltip_delete_all": "Delete All Saved",
        "btn_reset_mini": "⚠️ Reset",
        "sub_all": "All",
        "sub_structures": "Structures",
        "sub_chests": "Chests",
        "sub_houses": "Houses",
        "sub_pixel_art": "Pixel Art",
        "sub_other": "Other",
        "btn_gen_chest": "Generate Chest",
        "lbl_author": "Author:",
        "lbl_category": "Category:",
        "btn_load_struct": "Load Structure",
        "tooltip_edit_info": "Edit Info",
        "btn_edit": "Edit",
        "tooltip_delete": "Delete",
        "btn_delete": "Delete",

        // --- MODAL: MOBS ---
        "mob_browser_title": "Mob Browser",
        "tab_animals": "Animals",
        "tab_overworld": "Overworld",
        "tab_nether": "Nether",
        "tab_end": "End",
        "lbl_health_hp": "Health: 20 HP",
        "btn_spawn_mob": "Spawn Mob",

        // --- MODAL: SAVE STRUCTURE ---
        "modal_save_struct_title": "Save New Structure",
        "lbl_title": "Title",
        "pl_text": "Text",
        "pl_username": "Username",
        "lbl_category_hidden": "Category",
        "lbl_tag": "Tag",
        "sub_structure": "Structure",
        "sub_house": "House",
        "sub_vehicle": "Vehicle",
        "btn_cancel": "Cancel",
        "btn_save": "Save",

        // --- MODAL: ACHIEVEMENTS ---
        "achiev_title": "Achievements",
        "btn_unlock_all": "Unlock All",
        "btn_reset_all": "Reset All",
        "ach_breed": "Breed two animals",
        "ach_brew": "Brew a potion",
        "ach_crafting": "Craft a crafting table",
        "ach_stone_pick": "Craft a stone pickaxe",
        "ach_wood_pick": "Craft a wooden pickaxe",
        "ach_iron_pick": "Craft an iron pickaxe",
        "ach_flaming_chicken": "Defeat a flaming chicken",
        "ach_eat": "Eat some food",
        "ach_enchant": "Enchant an item",
        "ach_bow": "Fire a bow",
        "ach_fish": "Fish a fish",
        "ach_farm": "Grow a farm",
        "ach_tree": "Grow a tree",
        "ach_cake": "Make a cake",
        "ach_furnace": "Make a furnace",
        "ach_iron_ingot": "Make an iron ingot",
        "ach_portal_stone": "Make portal stone",
        "ach_torches": "Make some torches",
        "ach_mine_wood": "Mine a block of wood",
        "ach_mine_diamond": "Mine diamonds",
        "ach_mine_gold": "Mine gold",
        "ach_mine_obsidian": "Mine obsidian",
        "ach_door_wiring": "Open a door with wiring",
        "ach_open_inv": "Open the inventory",
        "ach_place_block": "Place a block",
        "ach_slay_blaze": "Slay a blaze",
        "ach_slay_cow": "Slay a cow",
        "ach_slay_creeper": "Slay a creeper",
        "ach_slay_ghast": "Slay a ghast by its fireball",
        "ach_slay_magma": "Slay a magma cube",
        "ach_slay_nethereye": "Slay a nethereye",
        "ach_slay_pig": "Slay a pig",
        "ach_slay_sheep": "Slay a sheep",
        "ach_slay_skeleton": "Slay a skeleton",
        "ach_slay_slime": "Slay a slime",
        "ach_slay_spider": "Slay a spider",
        "ach_slay_zombie": "Slay a zombie",
        "ach_slay_zpigman": "Slay a zombie pigman",
        "ach_slay_enderman": "Slay an enderman",
        "ach_slay_dragon": "Slay the ender dragon",
        "ach_tame_dog": "Tame a dog",
        "ach_tp_pearl": "Teleport with enderpearl",
        "ach_travel_nether": "Travel to the nether",
        "ach_unlock_end": "Unlock the ender portal",
        "ach_use_bed": "Use a bed",
        "ach_use_anvil": "Use an anvil",

        // --- MODAL: DIMENSIONS ---
        "dim_title": "Select Dimension",

        // --- MODAL: EDIT INFO ---
        "edit_info_title": "Edit Structure Info",
        "btn_update": "Update",

        // --- MODAL: CONFIRM ---
        "confirm_title": "Confirm Action",
        "confirm_msg": "Are you sure?",
        "btn_yes": "Yes",
        "btn_no": "No",

        // --- MODAL: NEWS ---
        "news_title": "📰 Updates",
        "btn_back": "Back",

        // --- MODAL: LIGHTBOX ---
        "tooltip_close": "Close",

        // --- LOADING ---
        "loading_world": "Loading World...",

        // --- CHAT ---
        "pl_chat": "Press Enter to chat...",

        // --- STATUS BAR ---
        "tooltip_fps": "Frames Per Second",
        "status_ready": "Ready",
        "tooltip_zoom_out": "Zoom Out",
        "tooltip_zoom_in": "Zoom In",
        "tooltip_zoom_reset": "Click to Reset",
        "tooltip_fullscreen": "Fullscreen",

        // --- PROFILE ---
        "profile_title": "My Profile",
        "lbl_username": "Username:",

        // --- ABOUT ---
        "about_desc": "A Mine Blocks web-tool to design, edit, and share your favorite worlds directly from your browser.",
        "about_last_update": "Last Update:",

        // --- UI HANDLER JS ---
        "cat_all": "All Items",
        "cat_custom": "Custom",
        "cat_blocks": "Blocks",
        "cat_decoration": "Decoration",
        "cat_transportation": "Transportation",
        "cat_tools": "Tools",
        "cat_food": "Food and Crops",
        "cat_armor": "Armor",
        "cat_potions": "Potions",
        "cat_enchantedbooks": "Enchanted Books",

        "tooltip_open_inv": "Click to open Inventory",
        "lbl_creative_inv": "Creative Inventory",
        "pl_search_item": "Search item... (e.g. Diamond)",
        "lbl_none": "None",
        "tooltip_spawn": "Spawn",
        "msg_no_bases": "No bases found.",
        "msg_no_custom_mobs": "No custom mobs yet.<br>Go to Create > Custom Mob!",
        "lbl_health_hp_prefix": "Health: ",
        "msg_system": "System",
        "msg_spawn_custom": "⚡ You spawned your creation: ",
        "msg_spawn_saved": "⚡ Created and saved: ",
        "err_template_not_found": "Error: Template not found for",
        "lbl_mutant": "Mutant",
        "lbl_enchanted_book": "Enchanted Book",
        "lbl_potion_effect": "Potion Effect",
        "lbl_custom_chest": "Custom Chest",
        "msg_tp": "WHOOSH! Teleported to",
		
		// --- FILE MENU (BACKSTAGE) ---
        "menu_back": "Back",
        "menu_my_worlds": "My Worlds",
        "menu_templates": "Templates",
        "menu_multiplayer": "Multiplayer",
        "menu_load_world": "Load World",
        "menu_export": "Export",
        "tooltip_change_pfp": "Click to change picture",
        "mp_public_servers": "Public Servers",
        "mp_searching_worlds": "Searching for worlds...",
        "mp_join_or_create": "Join by ID or Create your own:",
        "mp_create_server": "Create Server",
        "mp_paste_id": "Paste ID here...",
        "mp_connect": "Connect",
        "mp_players_limit": "Players Limit:",
        "mp_access": "Access: ",
        "mp_public": "Public",
        "mp_next": "Next",
        "mp_cancel": "Cancel",
        "mp_select_map": "Select Map:",
        "mp_generate_start": "Generate ID & Start",
        "mp_room_id": "Your Room ID (Share this):",
        "mp_click_copy": "Click to copy!",
        "mp_id_placeholder": "ID will appear here...",
        "mp_copied": "Copied to clipboard!",
        "mp_close_server": "Close Server & Back",
        "mp_status_not_connected": "Status: Not Connected",
        "mp_online": "Online",
        "mp_loading_players": "Loading players...",
        "mp_chats": "Chats",
        "mp_select_chat": "Select a chat to start",
        "mp_name_placeholder": "Name",
        "mp_send_message": "Send a message...",
        "mp_inbox": "Inbox",
        "fs_no_saved_worlds": "No saved worlds yet",
        "fs_start_template": "Start from a Template",
        "tooltip_delete_world": "Delete World"
    },
    
    es: {
        // --- DRAG & DROP ---
        "drag_drop_title": "📁 ¡Suelta tu mundo aquí!",
        "drag_drop_subtitle": "Arrastra el archivo .mbw en cualquier parte",

        // --- TOP BAR ---
        "btn_file": "Archivo",
        "tooltip_save_now": "Guardar Ahora",
        "lbl_auto_save": "Autoguardado",
        "btn_multiplayer": "Multijugador",
        "btn_help": "Ayuda",
        "menu_configuration": "Configuración",
        "menu_join_discord": "¡Únete a la comunidad!",
        "menu_about": "Acerca de...",
        "tooltip_undo": "Deshacer (Ctrl+Z)",
        "tooltip_redo": "Rehacer (Ctrl+Y)",
        "tooltip_news": "Novedades y Cambios",
        "btn_news": "Noticias",

        // --- RIBBON TABS ---
        "tab_insert": "Insertar",
        "tab_world_settings": "Mundo",
        "tab_create": "Crear",
        "tab_view": "Vista",
        "btn_export": "Exportar",
        "btn_world_info": "Info. Mundo",

        // --- INSERT TAB ---
        "tooltip_paste": "Pegar (Ctrl+V)",
        "btn_paste": "Pegar",
        "tooltip_cut": "Cortar (Ctrl+X)",
        "tooltip_copy": "Copiar (Ctrl+C)",
        "lbl_clipboard": "Portapapeles",
        "lbl_size": "Tamaño",
        "lbl_rounded": "Círculo",
        "tooltip_spray": "Activar Spray",
        "btn_spray": "Spray",
        "lbl_brush_settings": "Pinceles",
        "tooltip_inventory": "Abrir Inventario (E)",
        "lbl_inventory": "Inventario (E)",
        "tooltip_save_struct": "Selecciona un área primero",
        "btn_save_structure_multiline": "Guardar<br>Estructura",
        "lbl_empty": "Vacío",
        "tooltip_structures": "Abrir Librería / Ver Todas",
        "lbl_structures_tab": "Estructuras (R)",
        "tooltip_mobs": "Abrir Mobs",
        "lbl_mobs_tab": "Mobs (M)",

        // --- WORLD SETTINGS TAB ---
        "lbl_gamemode": "Modo:",
        "gm_survival": "Supervivencia",
        "gm_creative": "Creativo",
        "gm_adventure": "Aventura",
        "gm_spectator": "Espectador",
        "lbl_difficulty": "Dificultad:",
        "diff_peaceful": "Pacífico",
        "diff_easy": "Fácil",
        "diff_normal": "Normal",
        "diff_hard": "Difícil",
        "lbl_cheats": "Trucos",
        "lbl_hardcore": "Extremo",
        "lbl_day": "Día:",
        "tooltip_days_passed": "Días transcurridos (Solo lectura)",
        "lbl_time": "Hora:",
        "lbl_live_time": "Tiempo Real",
        "lbl_weather": "Clima:",
        "weather_clear": "Despejado",
        "weather_rain": "Lluvia",
        "weather_thunder": "Tormenta",
        "lbl_world_settings": "Opciones de Mundo",
        "btn_manage_achievements": "Gestionar<br>Logros",
        "lbl_achievements": "Logros",
        "lbl_keep_inv": "Cons.<br>Inv.",
        "lbl_daylight_cycle": "Ciclo<br>Día",
        "lbl_mob_griefing": "Daño<br>Mobs",
        "lbl_mob_loot": "Botín<br>Mobs",
        "lbl_fire_tick": "Propa.<br>Fuego",
        "lbl_gamerules": "Reglas de Juego",
        "lbl_health": "Vida",
        "lbl_hunger": "Hambre",
        "lbl_xp": "Experiencia",
        "lbl_player": "Jugador",

        // --- CREATE TAB ---
        "btn_create_chest": "Crear<br>Cofre",
        "lbl_chests": "Cofres",
        "btn_create_item": "Crear<br>Ítem",
        "lbl_custom_items": "Ítems",

        // --- VIEW TAB ---
        "lbl_show_grid": "Mostrar Cuadrícula",
        "lbl_grid": "Cuadrícula",
        "btn_change_dim": "Cambiar<br>Dimensión",
        "lbl_dimensions": "Dimensiones",
        "lbl_weather_anim": "Animación<br>de Clima",

        // --- TOOLBAR ---
        "tooltip_tool_move": "Herramienta Mover",
        "tooltip_tool_pencil": "Lápiz",
        "tooltip_tool_eraser": "Borrador",
        "tooltip_tool_bucket": "Cubo de Pintura",
        "tooltip_tool_select": "Seleccionar",
        "tooltip_tool_magic": "Varita Mágica",
        "tooltip_tool_lasso": "Lazo",
        "tooltip_tool_eyedropper": "Gotero",
        "tooltip_screenshot": "Captura de Pantalla",

        // --- SIDEBAR WORLD INFO ---
        "side_info_title": "Información",
        "side_info_name": "Nombre:",
        "side_info_author": "Creador:",
        "side_info_version": "Versión:",
        "side_info_seed": "Semilla:",
        "side_info_cheats": "Trucos Activados:",
        "side_info_dragon": "Enderdragon Vencido:",
        "side_info_size": "Tamaño: ",

        // --- MODAL: SETTINGS ---
        "config_title": "Configuración",
        "config_language": "Idioma",
        "config_theme": "Tema / Apariencia",
        "config_autosave": "Intervalo de Autoguardado",
        "config_off": "Desactivado",
        "config_1m": "Cada 1 minuto",
        "config_5m": "Cada 5 minutos",
        "config_10m": "Cada 10 minutos",
        "config_volume": "Volumen Principal",

        // --- MODAL: INVENTORY ---
        "modal_inventory": "Inventario",
        "pl_search": "Buscar...",
        "chest_content_title": "Contenido del Cofre",
        "pl_chest_name": "Nombre del cofre...",
        "btn_save_chest": "Guardar Cofre",
        "item_creator_title": "Creador de Ítems",
        "btn_save_item": "💾 Guardar Ítem",
        "msg_select_first": "Selecciona un ítem",
        "lbl_enchantments": "Encantamientos",

        // --- MODAL: STRUCTURES ---
        "struct_browser_title": "Librería de Estructuras",
        "tab_saved": "Guardadas",
        "tab_vanilla": "Juego Base",
        "tab_community": "Comunidad",
        "tooltip_import_json": "Importar Archivo JSON",
        "btn_import_mini": "📥 Importar",
        "tooltip_export_json": "Exportar Archivo JSON",
        "btn_export_mini": "💾 Exportar",
        "tooltip_delete_all": "Borrar todas las guardadas",
        "btn_reset_mini": "⚠️ Reiniciar",
        "sub_all": "Todo",
        "sub_structures": "Estructuras",
        "sub_chests": "Cofres",
        "sub_houses": "Casas",
        "sub_pixel_art": "Pixel Art",
        "sub_other": "Otros",
        "btn_gen_chest": "Generar Cofre",
        "lbl_author": "Creador:",
        "lbl_category": "Categoría:",
        "btn_load_struct": "Cargar Estructura",
        "tooltip_edit_info": "Editar Info",
        "btn_edit": "Editar",
        "tooltip_delete": "Eliminar",
        "btn_delete": "Eliminar",

        // --- MODAL: MOBS ---
        "mob_browser_title": "Librería de Mobs",
        "tab_animals": "Animales",
        "tab_overworld": "Superficie",
        "tab_nether": "Nether",
        "tab_end": "El Fin",
        "lbl_health_hp": "Vida: 20 HP",
        "btn_spawn_mob": "Spawnear",

        // --- MODAL: SAVE STRUCTURE ---
        "modal_save_struct_title": "Guardar Nueva Estructura",
        "lbl_title": "Nombre",
        "pl_text": "Texto",
        "pl_username": "Usuario",
        "lbl_category_hidden": "Categoría",
        "lbl_tag": "Etiqueta",
        "sub_structure": "Estructura",
        "sub_house": "Casa",
        "sub_vehicle": "Vehículo",
        "btn_cancel": "Cancelar",
        "btn_save": "Guardar",

        // --- MODAL: ACHIEVEMENTS ---
        "achiev_title": "Logros",
        "btn_unlock_all": "Desbloquear",
        "btn_reset_all": "Reiniciar",
        "ach_breed": "Reproducir dos animales",
        "ach_brew": "Hacer una poción",
        "ach_crafting": "Hacer una mesa de crafteo",
        "ach_stone_pick": "Hacer un pico de piedra",
        "ach_wood_pick": "Hacer un pico de madera",
        "ach_iron_pick": "Hacer un pico de hierro",
        "ach_flaming_chicken": "Derrotar al Pollo en Llamas",
        "ach_eat": "Comer algo",
        "ach_enchant": "Encantar un ítem",
        "ach_bow": "Disparar un arco",
        "ach_fish": "Pescar un pez",
        "ach_farm": "Cultivar algo",
        "ach_tree": "Plantar un árbol",
        "ach_cake": "Hacer un pastel",
        "ach_furnace": "Hacer un horno",
        "ach_iron_ingot": "Fundir un lingote de hierro",
        "ach_portal_stone": "Crear Piedra de Portal",
        "ach_torches": "Crear antorchas",
        "ach_mine_wood": "Minar madera",
        "ach_mine_diamond": "Minar diamantes",
        "ach_mine_gold": "Minar oro",
        "ach_mine_obsidian": "Minar obsidiana",
        "ach_door_wiring": "Abrir una puerta con cables",
        "ach_open_inv": "Abrir el inventario",
        "ach_place_block": "Colocar un bloque",
        "ach_slay_blaze": "Matar a un Blaze",
        "ach_slay_cow": "Matar a una Vaca",
        "ach_slay_creeper": "Matar a un Creeper",
        "ach_slay_ghast": "Matar a un Ghast con su fuego",
        "ach_slay_magma": "Matar a un Cubo de Magma",
        "ach_slay_nethereye": "Matar a un Nethereye",
        "ach_slay_pig": "Matar a un Cerdo",
        "ach_slay_sheep": "Matar a una Oveja",
        "ach_slay_skeleton": "Matar a un Esqueleto",
        "ach_slay_slime": "Matar a un Slime",
        "ach_slay_spider": "Matar a una Araña",
        "ach_slay_zombie": "Matar a un Zombie",
        "ach_slay_zpigman": "Matar a un Hombrecerdo",
        "ach_slay_enderman": "Matar a un Enderman",
        "ach_slay_dragon": "Matar al Dragón del Fin",
        "ach_tame_dog": "Domesticar a un perro",
        "ach_tp_pearl": "Teletransportarse con perla",
        "ach_travel_nether": "Viajar al Nether",
        "ach_unlock_end": "Desbloquear el Portal al Fin",
        "ach_use_bed": "Dormir en una cama",
        "ach_use_anvil": "Usar un yunque",

        // --- MODAL: DIMENSIONS ---
        "dim_title": "Seleccionar Dimensión",

        // --- MODAL: EDIT INFO ---
        "edit_info_title": "Editar Información",
        "btn_update": "Actualizar",

        // --- MODAL: CONFIRM ---
        "confirm_title": "Confirmar Acción",
        "confirm_msg": "¿Estás seguro?",
        "btn_yes": "Sí",
        "btn_no": "No",

        // --- MODAL: NEWS ---
        "news_title": "📰 Novedades",
        "btn_back": "Volver",

        // --- MODAL: LIGHTBOX ---
        "tooltip_close": "Cerrar",

        // --- LOADING ---
        "loading_world": "Cargando Mundo...",

        // --- CHAT ---
        "pl_chat": "Presiona Enter para hablar...",

        // --- STATUS BAR ---
        "tooltip_fps": "Fotogramas Por Segundo",
        "status_ready": "Listo",
        "tooltip_zoom_out": "Alejar",
        "tooltip_zoom_in": "Acercar",
        "tooltip_zoom_reset": "Restablecer",
        "tooltip_fullscreen": "Pantalla Completa",

        // --- PROFILE ---
        "profile_title": "Mi Perfil",
        "lbl_username": "Nombre de Usuario:",

        // --- ABOUT ---
        "about_desc": "Una herramienta web para Mine Blocks. Diseña, edita y comparte tus mundos favoritos directamente desde tu navegador.",
        "about_last_update": "Última Actualización:",

        // --- UI HANDLER JS ---
        "cat_all": "Todos",
        "cat_custom": "Personalizado",
        "cat_blocks": "Bloques",
        "cat_decoration": "Decoración",
        "cat_transportation": "Transporte",
        "cat_tools": "Herramientas",
        "cat_food": "Comida y Cultivos",
        "cat_armor": "Armaduras",
        "cat_potions": "Pociones",
        "cat_enchantedbooks": "Libros Encantados",

        "tooltip_open_inv": "Clic para abrir el Inventario",
        "lbl_creative_inv": "Inventario Creativo",
        "pl_search_item": "Buscar ítem... (ej. Diamante)",
        "lbl_none": "Ninguno",
        "tooltip_spawn": "Aparecer",
        "msg_no_bases": "No se encontraron bases.",
        "msg_no_custom_mobs": "Aún no hay mobs personalizados.<br>¡Ve a Crear > Mob Custom!",
        "lbl_health_hp_prefix": "Vida: ",
        "msg_system": "Sistema",
        "msg_spawn_custom": "⚡ Has spawneado tu creación: ",
        "msg_spawn_saved": "⚡ Creado y guardado: ",
        "err_template_not_found": "Error: No encontré la plantilla de ",
        "lbl_mutant": "Mutante ",
        "lbl_enchanted_book": "Libro Encantado",
        "lbl_potion_effect": "Efecto de Poción",
        "lbl_custom_chest": "Cofre Personalizado",
        "msg_tp": "¡FIIUUM! Teletransportado a",
		
		// --- FILE MENU (BACKSTAGE) ---
        "menu_back": "Volver",
        "menu_my_worlds": "Mis Mundos",
        "menu_templates": "Plantillas",
        "menu_multiplayer": "Multijugador",
        "menu_load_world": "Cargar Mundo",
        "menu_export": "Exportar",
        "tooltip_change_pfp": "Clic para cambiar foto",
        "mp_public_servers": "Servidores Públicos",
        "mp_searching_worlds": "Buscando mundos...",
        "mp_join_or_create": "Únete por ID o Crea el tuyo:",
        "mp_create_server": "Crear Servidor",
        "mp_paste_id": "Pega la ID aquí...",
        "mp_connect": "Conectar",
        "mp_players_limit": "Límite de Jugadores:",
        "mp_access": "Acceso: ",
        "mp_public": "Público",
        "mp_next": "Siguiente",
        "mp_cancel": "Cancelar",
        "mp_select_map": "Seleccionar Mapa:",
        "mp_generate_start": "Generar ID e Iniciar",
        "mp_room_id": "Tu ID de Sala (Compártelo):",
        "mp_click_copy": "¡Clic para copiar!",
        "mp_id_placeholder": "La ID aparecerá aquí...",
        "mp_copied": "¡Copiado al portapapeles!",
        "mp_close_server": "Cerrar Servidor y Volver",
        "mp_status_not_connected": "Estado: No Conectado",
        "mp_online": "En Línea",
        "mp_loading_players": "Cargando jugadores...",
        "mp_chats": "Chats",
        "mp_select_chat": "Selecciona un chat para iniciar",
        "mp_name_placeholder": "Nombre",
        "mp_send_message": "Enviar un mensaje...",
        "mp_inbox": "Bandeja",
        "fs_no_saved_worlds": "Aún no hay mundos guardados",
        "fs_start_template": "Comenzar desde una Plantilla",
        "tooltip_delete_world": "Eliminar Mundo"
    }
};

// Leemos el idioma guardado en el navegador (por defecto inglés)
let currentLang = localStorage.getItem('mbw_lang') || 'en';

// Función para JS (Alertas, tooltips, etc.)
window.t = function(key) {
    return i18n[currentLang][key] || key; 
};

// Función que traduce el HTML en tiempo real
window.setLanguage = function(langCode) {
    if (!i18n[langCode]) return;
    
    currentLang = langCode;
    localStorage.setItem('mbw_lang', currentLang); // Guardar preferencia

    // Actualiza el selector del menú Configuration
    const selectEl = document.getElementById('lang-select');
    if (selectEl) selectEl.value = currentLang;

    // Escanear y traducir todos los textos del HTML
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (i18n[currentLang][key]) {
            el.innerHTML = i18n[currentLang][key]; // Reemplaza el texto (soporta <br>)
        }
    });

    // Escanear y traducir los "placeholder" de los inputs
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (i18n[currentLang][key]) {
            el.placeholder = i18n[currentLang][key];
        }
    });

    // Escanear y traducir los títulos/tooltips (title="")
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (i18n[currentLang][key]) {
            el.title = i18n[currentLang][key];
        }
    });
};

// Ejecutar la traducción automáticamente apenas carga la página
window.addEventListener('DOMContentLoaded', () => {
    setLanguage(currentLang);
});