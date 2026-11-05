// =================================================================
// ⬇️ LISTA COMPLETA DE BLOQUES/ITEMS DEL INVENTARIO ⬇️
// =================================================================
// Antes esto vivía como una copia local dentro de scripts/ui-handler.js
// (y otra copia, ligeramente distinta y desactualizada, en el archivo
// scripts/database.js que ya no se usa). Ahora hay una sola fuente de
// verdad, aquí, y ui-handler.js (y cualquier otro archivo que la
// necesite) la usa como window.inventoryCategories.
window.inventoryCategories = {
    // La pestaña "all" se llena automáticamente, no necesitas editar 'items' aquí.
    all: { icon: 'chest', items: [] },

// 🗡️ Ítems Creados
    Custom: {
        icon: 'ObsidianPickaxe',
        items: [] // Se llena por LocalStorage
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
'gs', 'gs_white', 'gs_lightgray', 'gs_gray', 'gs_black', 'gs_brown', 'gs_purple', 'gs_magenta', 'gs_red',
'gs_orange', 'gs_pink', 'gs_yellow', 'gs_lightgreen', 'gs_green', 'gs_cyan', 'gs_lightblue', 'gs_blue', 'bddt',
'bdr', 'bdcs', 'bdbbb', 'bdbricks', 'bdbooks', 'bdsb', 'bdcloth_white', 'bdcloth_lightgray', 'bdcloth_gray',
'bdcloth_black', 'bdcloth_brown', 'bdcloth_purple', 'bdcloth_magenta', 'bdcloth_red', 'bdcloth_orange', 'bdcloth_pink', 'bdcloth_yellow', 'bdcloth_lightgreen',
'bdcloth_green', 'bdcloth_cyan', 'bdcloth_lightblue', 'bdcloth_blue', 'bdcloth_rainbow', 'bdgs', 'bdgs_white', 'bdgs_lightgray', 'bdgs_gray',
'bdgs_black', 'bdgs_brown', 'bdgs_purple', 'bdgs_magenta', 'bdwp', 'bdgs_red', 'bdgs_orange', 'bdgs_pink', 'bdgs_yellow',
'bdgs_lightgreen', 'bdgs_green', 'bdgs_cyan', 'bdgs_lightblue', 'bdgs_blue', 'pk', 'pk_2', 'pk_3', 'pk_4',
'pk_5', 'pk_6', 'pk_7', 'pk_8', 'pk_9', 'pk_10', 'pk_11', 'hai_1', 'stairr_1',
'stairr_2', 'stairr_3', 'stairr_4', 'staircs_1', 'staircs_2', 'staircs_3', 'staircs_4', 'stairsb_1', 'stairsb_2',
'stairsb_3', 'stairsb_4', 'stairob_1', 'stairob_2', 'stairob_3', 'stairob_4', 'stairbr_1', 'stairbr_2', 'stairbr_3',
'stairbr_4', 'stairwp_1', 'stairwp_2', 'stairwp_3', 'stairwp_4', 'stairib_1', 'stairib_2', 'stairib_3', 'stairib_4',
'stairgb_1', 'stairgb_2', 'stairgb_3', 'stairgb_4', 'stairdb_1', 'stairdb_2', 'stairdb_3', 'stairdb_4', 'stairbrick_1',
'stairbrick_2', 'stairbrick_3', 'stairbrick_4', 'stairn_1', 'stairn_2', 'stairn_3', 'stairn_4', 'stairbbb_1', 'stairbbb_2',
'stairbbb_3', 'stairbbb_4', 'halfr_1', 'halfr_2', 'halfcs_1', 'halfcs_2', 'halfsb_1', 'halfsb_2', 'halfob_1',
'halfob_2', 'halfbr_1', 'halfbr_2', 'halfwp_1', 'halfwp_2', 'halfib_1', 'halfib_2', 'halfgb_1', 'halfgb_2',
'halfdb_1', 'halfdb_2', 'halfbrick_1', 'halfbrick_2', 'halfn_1', 'halfn_2', 'halfbbb_1', 'halfbbb_2',
'ob', 'bdob', 'n', 'nb', 'bdnb', 'rnb', 'nwb', 'ssd', 'glow', 'es', 'dsb', 'boneb', 'tob', 'lemonb', 'slimeb', 'hay_1', 'hay_2',
'portalstone', 'pf', 'pf_2', 'portal',
        ]
    },

    // 🌱 Nature (nuevo): plantas, líquidos y cosas del mundo natural
    Nature: {
        icon: 'fw2',
        items: [
            'wr', 'la', 'ad', 'lgr', 'shrub', 'ds', 'fw1', 'fw2', 'ms1', 'ms2', 'msb1', 'msb2', 'msb3', 'msb4', 'bb', 'ct', 'sc',
            'sw', 'coral', 'lp', 'moss', 'web', 'snow', 'mel', 'fire',
        ]
    },

    // 🌿 Decoration
    Decoration: {
        icon: 'shrub',
        items: [
            'craft', 'oven', 'chest', 'echest', 'cmp', 'enchant', 'anvil', 'ntag', 'bed1_red', 'dr2', 'idr2', 'bdr2', 'td1', 'sign', 'sl', 'lv', 'lv1', 'lv2', 'lv3', 'lv4', 'st', 'ladder', 'fnc', 'fncg', 'nfnc', 'nfncg', 'ibar',
            // Antorcha: _1 parada (recta), _2 y _3 inclinadas a la pared (una de cada lado). (dispenser y dropper ahora están en Redstone)
            'th_1', 'th_2', 'th_3',
            'jl', 'lant_1', 'lant_2', 'lant_3', 'ortorch_1', 'ortorch_2', 'ortorch_3', 'rp', 'td2', 'brew', 'brew_1', 'brew_2',
            'brew_3', 'cauldron', 'cauldron_1', 'cauldron_2', 'cauldron_3', 'cmp_1', 'cmp_2', 'cmp_3', 'cmp_4', 'cmp_5',
            'anvil_2', 'anvil_3', 'hcl', 'degg', 'bed1_white', 'bed1_lightgray', 'bed1_gray', 'bed1_black', 'bed1_brown',
            'bed1_purple', 'bed1_magenta', 'bed1_orange', 'bed1_pink', 'bed1_yellow', 'bed1_lightgreen', 'bed1_green',
            'bed1_cyan', 'bed1_lightblue', 'bed1_blue', 'carpet_white', 'carpet_lightgray', 'carpet_gray', 'carpet_black',
            'carpet_brown', 'carpet_purple', 'carpet_magenta', 'carpet_red', 'carpet_orange', 'carpet_pink', 'carpet_yellow',
            'carpet_lightgreen', 'carpet_green', 'carpet_cyan', 'carpet_lightblue', 'carpet_blue', 'carpet_rainbow', 'bl',
            'bl_lightgray', 'bl_gray', 'bl_black', 'bl_brown', 'bl_purple', 'bl_magenta', 'bl_red', 'bl_orange', 'bl_pink',
            'bl_yellow', 'bl_lightgreen', 'bl_green', 'bl_cyan', 'bl_lightblue', 'bl_blue', 'bl_ghast',
        ]
    },

    // 🔴 Redstone (nuevo): mecanismos. Dispenser y dropper: _1 izquierda, _2 derecha, _3 arriba, _4 abajo
    Redstone: {
        icon: 'rstorch',
        items: [
            'dispense_1', 'dispense_2', 'dispense_3', 'dispense_4', 'dropper_1', 'dropper_2', 'dropper_3', 'dropper_4',
            'rsd', 'rsd_1', 'rstorch', 'light', 'lever', 'lever_1', 'lever_2', 'button', 'button_1', 'button_2', 'pp', 'wpp',
            'note', 'piston_1', 'piston1_1', 'piston2_1', 'spiston_1', 'spiston1_1', 'spiston2_1', 'TNT',
        ]
    },

    // 🌿 Transportation
    Transportation: {
        icon: 'rail',
        items: [
            'rail', 'rail_1', 'rail_2', 'railp', 'railp_1', 'railp_2', 'raila', 'raila_1', 'raila_2', 'raild', 'raild_1', 'raild_2',
            'cart', 'raft', 'saddle',
        ]
    },

    // 🌿 Tools
    Tools: {
        icon: 'DiamondPickaxe',
        items: [
            'WoodenPickaxe', 'StonePickaxe', 'IronPickaxe', 'GoldPickaxe', 'DiamondPickaxe', 'ObsidianPickaxe',
            'WoodenSword', 'StoneSword', 'IronSword', 'GoldSword', 'DiamondSword',
            'WoodenAxe', 'StoneAxe', 'IronAxe', 'GoldAxe', 'DiamondAxe',
            'WoodenShovel', 'StoneShovel', 'IronShovel', 'GoldShovel', 'DiamondShovel',
            'WoodenHoe', 'StoneHoe', 'IronHoe', 'GoldHoe', 'DiamondHoe',
            'fr', 'Shear',
            'bow', 'spear', 'bshur', 'fas', 'coas', 'scepter', 'snowb',   // coas = Carrot on a Stick, scepter = (Useless) Scepter: los nombres del juego
        ]
    },

    // 🌿 Food and Crops
    Food: {
        icon: 'bread',
        items: [
            'egg', 'fireegg', 'cegg', 'or', 'lemon', 'gasd', 'gap', 'capple', 'crml',
            'sugar', 'icec', 'potato', 'ppotato', 'beet', 'wseed', 'gmels', 'pseed',
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
            'rf', 'bowl', 'soup', 'rabbitsoup', 'beetsoup', 'lade', 'apade', 'orade', 'mbk',
            'ap', 'mels', 'bpotato', 'ccb', 'bseed', 'bseed_3', 'bseed_5', 'bseed_7', 'potato_1', 'potato_4', 'potato_5',
            'potato_7', 'pseed_1',
        ]
    },

    // 💎 Materials (nuevo): minerales, lo que sueltan los mobs, tintes y otros objetos sueltos
    Materials: {
        icon: 'dm',
        items: [
            'cl', 'cl2', 'ii', 'gi', 'dm', 'll', 'topaz', 'egemd', 'oddrock', 'ironn', 'goldn', 'flint', 'gss', 'cy', 'brick',
            'nbr', 'paper', 'book', 'cbook', 'tag', 'clock', 'compass', 'feather', 'leather', 'rleather', 'bone', 'bonem',
            'fiber', 'ink', 'se', 'fse', 'gp', 'ep', 'eoe', 'blazer', 'bp', 'gt', 'slimeball', 'magmac', 'rfoot', 'dscl', 'boe',
            'scepters', 'dye', 'dye_lightgray', 'dye_gray', 'dye_brown', 'dye_purple', 'dye_magenta', 'dye_red', 'dye_pink',
            'dye_yellow', 'dye_lightgreen', 'dye_green', 'dye_cyan', 'dye_lightblue',
        ]
    },

    // 🥚 Mobs (nuevo): huevos para hacer aparecer mobs, cabezas y el spawner
    Mobs: {
        icon: 'megg_creeper',
        items: [
            'mobSpawner', 'mh_1', 'mh_2', 'mh_3', 'mh_4', 'mh_5', 'mh_6', 'mh_7', 'mh_8', 'mh_9', 'megg_skeleton',
            'megg_magmacube', 'megg_zombie', 'megg_ghast', 'megg_spider', 'megg_blaze', 'megg_chicken', 'megg_cow',
            'megg_creeper', 'megg_enderman', 'megg_mushroom', 'megg_pig', 'megg_sheep', 'megg_wolf',
            'megg_enderdragon', 'megg_squid', 'megg_rabbit', 'megg_cowctus', 'megg_zombiepigman', 'megg_bat', 'megg_slime',
        ]
    },

    // 🌿 Armor
    Armor: {
        icon: 'DiamondShirt',
        items: [
            'LeatherCap', 'LeatherShirt', 'LeatherPants', 'LeatherShoes', 'IronCap', 'IronShirt', 'IronPants', 'IronShoes', 'GoldCap',
            'GoldShirt', 'GoldPants', 'GoldShoes', 'DiamondCap', 'DiamondShirt', 'DiamondPants', 'DiamondShoes', 'DragonCap', 'DragonShirt',
            'DragonPants', 'DragonShoes','SnowCap', 'AfroCap', 'PartyCap', 'ShadesCap', 'MustacheCap',
        ]
    },

    // 🧪 Pociones
    Potions: {
        icon: 'potion',
        items: []
    },

// 📚 Libros Encantados
    EnchantedBooks: {
        icon: 'ebook',
        items: []
    },

};
