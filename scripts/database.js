// ==========================================
// 🗄️ MBW DATABASE: BLOQUES, ITEMS Y CATEGORÍAS
// ==========================================

window.inventoryCategories = {
    // La pestaña "all" se llena automáticamente
    all: { icon: 'chest', items: [] }, 

    // 🗡️ Ítems Creados
    Custom: { 
        icon: 'ObsidianPickaxe', 
        items: [] // Se llena dinámicamente por LocalStorage
    },
    
    // 🧱 Blocks
    Blocks: { 
        icon: 'bricks', 
        items: [
            'br', 'dt', 'dt_1', 'farm', 'myc', 'gdt', 'cdt', 'r', 'cs',
            'ms', 'sb', 'clore', 'in', 'gd', 'dmore', 'rs', 'os', 'lap',
            'to', 'egem', 'wd1', 'wd_1', 'wd_2', 'wp', 'bbb', 'top', 'ib',
            'gb', 'db', 'lapb', 'clb', 'sd', 'ss', 'cy1', 'bricks', 'books',
            'b', 'magma', 'j', 'snowblock', 'ice', 'fice', 'fice_1', 'fice_2', 'fice_3', 'fice_4', 
            'gv', 'cloth_white', 'cloth_lightgray', 'cloth_gray', 'cloth_black', 'cloth_brown', 'cloth_purple', 'cloth_magenta', 'cloth_red', 
            'cloth_orange', 'cloth_pink', 'cloth_yellow', 'cloth_lightgreen', 'cloth_green', 'cloth_cyan', 'cloth_lightblue', 'cloth_blue', 'cloth_rainbow', 
            'gs', 'gs_white', 'gs_lightgray', 'gs_gray', 'gs_black', 'gs_brown', 'gs_purple', 'gs_magenta', 'gs_redg', 
            'gs_orange', 'gs_pink', 'gs_yellow', 'gs_lightgreen', 'gs_green', 'gs_cyan', 'gs_lightblue', 'gs_blue', 'bddt', 
            'bdr', 'bdcs', 'bdbbb', 'bdbricks', 'bdbooks', 'bdsb', 'bdcloth_white', 'bdcloth_lightgray', 'bdcloth_gray', 
            'bdcloth_black', 'bdcloth_brown', 'bdcloth_purple', 'bdcloth_magenta', 'bdcloth_red', 'bdcloth_orange', 'bdcloth_pink', 'bdcloth_yellow', 'bdcloth_lightgreen', 
            'bdcloth_green', 'bdcloth_cyan', 'bdcloth_lightblue', 'bdcloth_blue', 'bdcloth_rainbow', 'bdgs', 'bdgs_white', 'bdgs_lightgray', 'bdgs_gray', 
            'bdgs_black', 'bdgs_brown', 'bdgs_purple', 'bdgs_magenta', 'bdwp', 'bdgs_redg', 'bdgs_orange', 'bdgs_pink', 'bdgs_yellow', 
            'bdgs_lightgreen', 'bdgs_green', 'bdgs_cyan', 'bdgs_lightblue', 'bdgs_blue', 'pk', 'pk_2', 'pk_3', 'pk_4', 
            'pk_5', 'pk_6', 'pk_7', 'pk_8', 'pk_9', 'pk_10', 'pk_11', 'hai_1', 'stairr_1', 
            'stairr_2', 'stairr_3', 'stairr_4', 'staircs_1', 'staircs_2', 'staircs_3', 'staircs_4', 'stairsb_1', 'stairsb_2', 
            'stairsb_3', 'stairsb_4', 'stairob_1', 'stairob_2', 'stairob_3', 'stairob_4', 'stairbr_1', 'stairbr_2', 'stairbr_3', 
            'stairbr_4', 'stairwp_1', 'stairwp_2', 'stairwp_3', 'stairwp_4', 'stairib_1', 'stairib_2', 'stairib_3', 'stairib_4', 
            'stairgb_1', 'stairgb_2', 'stairgb_3', 'stairgb_4', 'stairdb_1', 'stairdb_2', 'stairdb_3', 'stairdb_4', 'stairbrick_1', 
            'stairbrick_2', 'stairbrick_3', 'stairbrick_4', 'stairn_1', 'stairn_2', 'stairn_3', 'stairn_4', 'stairbbb_1', 'stairbbb_2', 
            'stairbbb_3', 'stairbbb_4', 'halfr_1', 'halfr_2', 'halfcs_1', 'halfcs_2', 'halfsb_1', 'halfsb_2', 'halfob_1', 
            'halfob_2', 'halfbr_1', 'halfbr_2', 'halfwp_1', 'halfwp_2', 'halfib_1', 'halfib_2', 'halfgb_1', 'halfgb_2', 
            'halfdb_1', 'halfdb_2', 'halfbrick_1', 'halfbrick_2', 'halfn_1', 'halfn_2', 'halfbbb_1', 'halfbbb_2'
        ]
    },

    // 🌿 Decoration
    Decoration: { 
        icon: 'shrub', 
        items: [
            'craft', 'oven', 'chest', 'echest', 'cmp', 'enchant', 'anvil', 'ntag', 'bed1_red', 'dr2', 'idr2', 'bdr2', 'td1', 'sign', 'sl', 'lv', 'lv1', 'lv2', 'lv3', 'lv4', 'st', 'ladder', 'fnc', 'fncg', 'nfnc', 'nfncg', 'ibar', 'th_1'
        ]
    },
    
    // 🛤️ Transportation
    Transportation: { 
        icon: 'rail', 
        items: [
            'rail', 'rail_1', 'rail_2', 'railp', 'railp_1', 'railp_2', 'raila', 'raila_1', 'raila_2', 'raild', 'raild_1', 'raild_2'
        ]
    },

    // ⛏️ Tools
    Tools: { 
        icon: 'DiamondPickaxe', 
        items: [
            'WoodenPickaxe', 'StonePickaxe', 'IronPickaxe', 'GoldPickaxe', 'DiamondPickaxe', 'ObsidianPickaxe',
            'WoodenSword', 'StoneSword', 'IronSword', 'GoldSword', 'DiamondSword',
            'WoodenAxe', 'StoneAxe', 'IronAxe', 'GoldAxe', 'DiamondAxe',
            'WoodenShovel', 'StoneShovel', 'IronShovel', 'GoldShovel', 'DiamondShovel',
            'WoodenHoe', 'StoneHoe', 'IronHoe', 'GoldHoe', 'DiamondHoe',
            'fr', 'frodcarrot', 'Shear'
        ]
    },
    
    // 🍗 Food and Crops
    Food: { 
        icon: 'bread', 
        items: [
            'egg', 'fireegg', 'cegg', 'or', 'lemon', 'gasd', 'gap', 'capple', 'crml', 
            'sugar', 'icec', 'potato', 'ppotato', 'bsed', 'beet', 'wseed', 'gmels', 'pseed', 
            'pkp', 'carrot', 'gcarrot', 'wheat', 'bread', 'cookie', 'ccane', 
            'cake_1', 'cake_2', 'cake_3', 'cake_4', 'cake_5', 'cake_6', 'cake_7', 
            'ccake_1', 'ccake_2', 'ccake_3', 'ccake_4', 'ccake_5', 'ccake_6', 'ccake_7', 
            'nw', 'nw_2', 'nw_3', 'nw_4', 'nw_5', 'nw_6', 'nw_7', 
            'seed', 'seed_2', 'seed_3', 'seed_4', 'seed_5', 'seed_6', 'seed_7', 
            'carrot_1', 'carrot_2', 'carrot_3', 'carrot_4', 'carrot_5', 'carrot_6', 'carrot_7', 
            'wseed_1', 'wseed_2', 'wseed_3', 'wseed_4', 'wseed_5', 'wseed_6', 'wseed_7',
            'pseed_2', 'pseed_3', 'pseed_4', 'pseed_5', 'pseed_6', 'pseed_7',
            'pork', 'cpork', 'bacon', 'cbacon', 'beef', 'cbeef', 'chicken', 'cchicken', 'nugget',
            'mutton', 'cmutton', 'rabbit', 'crabbit', 'fi', 'cfi', 'salmon', 'csalmon', 'clown', 'puff',
            'rf', 'bowl', 'soup', 'rabbitsoup', 'beetsoup', 'lade', 'apade', 'orade', 'mbk'
        ]
    },
    
    // 🛡️ Armor
    Armor: { 
        icon: 'DiamondShirt', 
        items: [
            'LeatherCap', 'LeatherShirt', 'LeatherPants', 'LeatherShoes', 'IronCap', 'IronShirt', 'IronPants', 'IronShoes', 'GoldCap', 
            'GoldShirt', 'GoldPants', 'GoldShoes', 'DiamondCap', 'DiamondShirt', 'DiamondPants', 'DiamondShoes', 'DragonCap', 'DragonShirt', 
            'DragonPants', 'DragonShoes','SnowCap', 'AfroCap', 'PartyCap', 'ShadesCap', 'MustacheCap'
        ]
    },
    
    // 🧪 Pociones
    Potions: {
        icon: 'potion', 
        items: [] // Se llena dinámicamente con las combinaciones
    },
    
    // 📚 Libros Encantados
    EnchantedBooks: {
        icon: 'ebook',
        items: [] // Se llena dinámicamente con las combinaciones
    }
};

// ==========================================
// 🗄️ MBW DATABASE: DICCIONARIOS DE TRADUCCIÓN
// ==========================================
window.ITEM_IDS = { 
    'Diamond':'dm', 'GoldIngot':'gi', 'IronIngot':'ii', 'Emerald':'em', 'Coal':'c', 
    'RottenFlesh':'rf', 'Bone':'bo', 'Arrow':'a', 'Gunpowder':'gp', 'String':'st', 
    'SpiderEye':'se', 'Slimeball':'sl', 'Stick':'s', 'Apple':'ap', 'GoldenApple':'gap', 
    'Bread':'br', 'Beef':'bf', 'Wood':'w', 'Cobblestone':'cb', 'DiamondSword':'DiamondSword' 
};

// Diccionario Inverso generado automáticamente
window.REVERSE_IDS = Object.fromEntries(Object.entries(window.ITEM_IDS).map(([k, v]) => [v, k]));