// ============================================================================
// 📰 NOTAS DE ACTUALIZACIÓN  —  ESTE ES EL ÚNICO ARCHIVO QUE TIENES QUE EDITAR
// ============================================================================
//
// ➕ PARA AGREGAR UNA NOTA NUEVA (3 pasos):
//    1. Copia la "NOTA DE EJEMPLO" de más abajo (desde "===== NOTA" hasta antes de la siguiente "=====")
//       o copia cualquier nota que ya exista.
//    2. Pégala justo debajo de la línea  "PEGA AQUÍ LAS NOTAS NUEVAS". Las más nuevas van ARRIBA.
//    3. Cambia los textos, guarda el archivo y recarga el editor con Ctrl+F5.
//    (Los números 1, 2, 3... de las notas se ponen solos. No los escribas.)
//
// ✏️ CÓMO SE ESCRIBE UNA NOTA:
//    • Cada nota empieza con una línea que dice "===== NOTA".
//    • Arriba van los datos (title, date, image, hero, excerpt, gallery) y después una línea con "---".
//    • Abajo de la línea "---" va el texto de la nota:
//         # Changelog:                  -> un título
//         - algo nuevo                  -> un punto de la lista
//             - un sub-punto            -> con 4 espacios antes del "-" queda dentro del punto de arriba
//         - [fixed] algo arreglado      -> [fixed], [beta], [change]... salen como etiqueta gris
//         - **negrita**  __subrayado__  -> negrita y subrayado
//         - copia bloques con `C`       -> lo que va entre comillas invertidas sale como tecla / código
//         una línea sin "-"             -> un párrafo de texto normal
//         // un apunte                  -> las líneas que empiezan con // se ignoran
//
// ⚠️ REGLAS:
//    • NO escribas  */  (asterisco y barra juntos) en ningún lado: rompe el archivo.
//    • No hace falta escribir HTML. Los símbolos < > & se escriben normal.
//    • Guarda el archivo siempre como UTF-8 (es lo normal en VS Code y en el Bloc de notas nuevo); si no, los emojis salen raros.
//    • Si algo no sale bien, abre la consola del navegador (F12): ahí dice qué nota tiene el problema.
//    • Para esconder una nota sin borrarla, ponle una línea  hidden: yes  arriba.
//
// ============================================================================

const NEWS_TEXT = (function () {/*

===== NOTA DE EJEMPLO (cópiala, cambia los textos y borra la línea "hidden: yes" de tu copia)
hidden: yes
title: v9.9 - Título de la nota
date: Nov 3, 2026
image: https://i.imgur.com/XXXXXXX.png
// image = la imagen chica que sale en la lista. Si el link no carga, se ve el ícono del editor.
hero: https://i.imgur.com/XXXXXXX.png
// hero = (opcional) la imagen grande de arriba al abrir la nota. Si no la pones, se usa "image".
excerpt: Una frase corta que sale en la lista
gallery: https://i.imgur.com/AAAAAAA.png
gallery: https://i.imgur.com/BBBBBBB.png
// gallery = (opcional) las fotos de abajo. Una línea "gallery:" por cada foto.
---
# Changelog:
- **🐷 Algo nuevo y grande**
    - un detalle de eso
- algo nuevo normal
- copia bloques con `C`
- [change] algo que cambió
- [beta] algo en beta

- [fixed] algo que se arregló
- [fixed] otra cosa que se arregló

// ⬇⬇⬇  PEGA AQUÍ LAS NOTAS NUEVAS  (la más nueva arriba de todas)  ⬇⬇⬇

===== NOTA
title: v2.5 - Custom Mobs Update
date: Oct 22, 2026
image: https://i.imgur.com/wASVrTn.png
excerpt: Custom mobs, player inventory, editable chests, smooth camera and more!
gallery: https://i.imgur.com/wASVrTn.png
gallery: https://i.imgur.com/xd7OjTe.png
gallery: https://i.imgur.com/9eEL4Uj.png
---
# Changelog:
- 🐷 Custom mobs!
- 🎒 Player inventory
- **📷 Improved Screenshots**
    - now you can select the area you want to appear
- 📢 Button to publish your map to the community
- 💬 The chat system was updated
- 🐶 Dogs
- Smooth camera
- 📦 Editable chests
- the eyedropper was removed from the tools - you can still copy blocks with `C`
- the default theme is now Dark Blue
- [fixed] when opening a world, the camera is centered on the player
- [fixed] improved wooden fence rendering
- [fixed] dogs no longer use the wolf sprite
- [fixed] code cleanup
- [fixed] performance improvements
- [fixed] the room closes if the host joins another room
- [fixed] 'undo' for deleting or cutting blocks


===== NOTA
title: v2.4d Update
date: Jun 14, 2026
image: https://i.imgur.com/ohQQP6r.png
excerpt: Chats Upgrade
gallery: https://i.imgur.com/aE1tlNJ.png
---
- [fixed] option to hide mob names
- [fixed] 8% zoom level
- [fixed] the public and private chat now accept links
- [fixed] you can now press Enter to start a new line when typing a message
- [fixed] the private message button works again
- [fixed] the file size is now displayed compressed.


===== NOTA
title: v2.4c Patch
date: Jun 8, 2026
image: https://i.imgur.com/aE1tlNJ.png
excerpt: Dimensions Patch
gallery: https://i.imgur.com/aE1tlNJ.png
---
- [fixed] CRITICAL BUG: Mobs from other dimensions no longer disappear when you export the world


===== NOTA
title: v2.4b Patch
date: Jun 7, 2026
image: https://i.imgur.com/dF9pGoN.png
excerpt: Dimensions Patch
gallery: https://i.imgur.com/ywOhzEz.png
gallery: https://i.imgur.com/K9hNb66.png
gallery: https://i.imgur.com/RFbpOjN.png
---
- [fixed] CRITICAL BUG: Mobs no longer disappear when you switch dimensions
- status-bar is now smaller
- Normal & OP options for Generated Chests


===== NOTA
title: v2.4 - QoL Update
date: May 26, 2026
image: https://i.imgur.com/xo6OpcV.png
excerpt: Languages, sounds and other Quality of Life updates!
gallery: https://i.imgur.com/4agjCDx.png
gallery: https://i.imgur.com/KewIXUk.png
gallery: https://i.imgur.com/JhFxPFF.png
gallery: https://i.imgur.com/sawRIux.png
gallery: https://i.imgur.com/H7szZBx.png
gallery: https://i.imgur.com/ADpMMP5.png
---
# Changelog:
- **🗣️ Languages!**
    - Spanish
    - Portuguese
- **➕ ¡Addons!**
    - Spawnskins Preview
    - Pixel Art Auto-Builder
- [beta] **🐷Mobs!**
    - 🦑squid
    - ⛄snowgolem
- [beta] **🔉SFX!**
    - clic
    - xp orb
    - level up
    - broken glass
    - wolf
    - mooshroom & cowctus cow
    - slime
- [beta] **🎒 Inventory**
    - slime block
    - moustache
    - santa hat
    - party hat
    - sunglasses
    - scepter
    - scepter stone
- 💾 backups for saved worlds
- 🔍 more zoom levels: 3%, 4%, 5%, 75%, 400%, 500%, 600%
- ⚙️ configuration redesign
    - customizable toolbar
- pencil now has 1-100 sizes
- versions history for worlds
- worlds can now be pinned in the menu
- dimensions now has backgrounds
- thumbnails for saved worlds now saves as PNG (better quality)
- new icons:
    - spray
    - background for dimensions
- changelogs for Snapshots

- [fixed] enchantments for fishing rod
- [fixed] items can no longer be enchanted with Unbreakable I-III in Custom Items
- [fixed] auto-save works with all open worlds
- [fixed] multiple areas can be selected again
- [fixed] bucket, brush, select, and lasso tools
- [fixed] structures now attach to air blocks
- [fixed] block rendering when zooming
- [fixed] rendering for Ghasts, Magmacubes, and Blazes
- [fixed] the grid is no longer disabled when refreshing the page


===== NOTA
title: v2.3 - Multiplayer Update
date: April 25, 2026
image: https://i.imgur.com/HLeNf8x.png
excerpt: Create a map with friends, chat with them, and more!
gallery: https://i.imgur.com/OGBQD83.gif
gallery: https://i.imgur.com/5hObGAo.png
gallery: https://i.imgur.com/q8VDWc4.png
gallery: https://i.imgur.com/My2zgUi.png
---
# Changelog:
- **🌐 Multiplayer!**
    - up to 6 players
    - spectator mode!
    - server chat
    - server invites
    - kick players
    - 🔔Notifications, 👥Friend Requests and ✉MDs
    - reply, edit and delete messages
    - reactions to messages
    - emojis & emotes
- **Menu**
    - saved worlds
    - world templates
- [beta] 🐷Mobs!
- [beta] 🎒Inventory
    - food
    - new items
- 💾 auto-save
- 🎨 new theme: Pastel 2 (Cool)
- weather animation
- day & night animation
- now you can see your position in the world
- [change] the magic wand now selects more area and works up to x=6000
- [change] configuration
    - volume
    - auto-save

- [fixed] enchantments for fishing rod


===== NOTA
title: v2.2 - Chests Update
date: March 23, 2026
image: https://i.imgur.com/HX0oYeQ.png
excerpt: Huge update including new structures, magic wand, custom items, tabs system, and much more!
gallery: https://i.imgur.com/LgECGcx.png
gallery: https://i.imgur.com/JVCV5E1.png
gallery: https://i.imgur.com/ilXaPlD.png
---
# Changelog:
- [Beta] **🏘️ Structures Library**
    - storage limit removed
    - __Vanilla__
        - Tree 3, Tree 4, Nether, Nether Portal, End Portal
    - __Community__
        - Nether Portal (Minecraft), Special Items (v2), Overpowered Chest,
        - J Block (pixelart), Sheep (pixelart), Bad Apple (pixelart),
        - Nether Enhanced, The Four Wolves,
        - SkyWars - Candy Map, SkyWars - Nether Map,
        - SkyWars - Trees Map, SkyBlock, Dungeon Enhanced,
        - Armor "Stand" (Diamond), Frank (pixelart)
- **🪄 new tool: magic wand**
- [Beta] 🎒 Inventory
    - enchanted books
    - more items added
- 🎨 new theme: Windows XP®
- **🎁 Chest Creator**
    - random loot chest generator button
- **📑 Gamerules**
    - keep inventory
    - do daylight cycle
    - mob griefing
    - mob loot
    - fire tick
- **📂 ¡Tabs System!** - Ahora se pueden abrir múltiples mundos
- **⛏️ Custom Items Creator**
- window effects
- pasted structures now do paste the air blocks (shift+clic)
- player and world options
    - health
    - hunger
    - xp
    - time
    - weather
    - difficulty
- changes to the console (/tp)

- [Fixed] camera speed
- [Fixed] the lasso/free form tool now can save structures
- [Fixed] some missing textures added
- [Fixed] screenshot tool


===== NOTA
title: v2.1 - Structures Update
date: February 23, 2026
image: https://i.imgur.com/8IIHD3d.png
excerpt: Structures library, improved tools, new UI, and bug fixes.
---
# Changelog:
- [Beta] 🏘️ **Structures library!**
    - structures can be saved using the Select tool
    - tabs: Saved, Vanilla, and Community
    - backups
    - quick access to structures (vanilla)
- improved Select tool
    - now required to copy structures
    - multiple selection
- improved brush tool
    - brush/eraser sizes (1-7)
    - rounded mode
    - spray mode
- [Beta] 🔊 Sound effects
    - deleted structure
- optimization improvements
- cursor changed
- floating toolbar
- improved interface
- grid icon
- interface with icons to change dimensions

- [Fixed] camera fixed
- [Fixed] Fix Hardcore Mode option re-implemented


===== NOTA
title: v2.0
date: January 16, 2026
image: /favicon.ico
hero: https://i.imgur.com/4ZYclOO.png
excerpt: New UI, Copy-Paste, Zoom, and more!
---
# Changelog:
- new UI
- copy-paste structures feature (select area, Ctrl+C)
- zoom (25, 50, 100, 150, and 200%)
- [Beta] Inventory
- optimization improvements
- /tp command in-app

*/}).toString().replace(/^[\s\S]*?\/\*/, '').replace(/\*\/[\s\S]*$/, '');
