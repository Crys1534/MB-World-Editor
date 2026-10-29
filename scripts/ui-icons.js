// ==========================================================
// 🎨 ÍCONOS DE LA INTERFAZ (dibujos propios A COLOR, 24 x 24, sin pixel art)
// Reemplazan a TODOS los emojis de la interfaz: barra de herramientas, cinta de opciones, Configuration, ventanas, menús,
// avisos... Los emojis de los CHATS (mensajes, reacciones, el selector de emojis) y las notas de las novedades se quedan igual.
//  · Cada ícono es un pedacito de SVG con sus propios colores (relleno + un contorno del mismo tono, más oscuro).
//  · EMOJI_ICONS dice qué ícono va en lugar de cada emoji. Si agregas un texto con emoji a la interfaz, solo
//    hay que poner aquí su ícono (si no está, el emoji se queda como está).
//  · Funciona solo: revisa la página al abrir, al cambiar de idioma y cada vez que aparece algo nuevo (MutationObserver).
//  · En las listas desplegables (<select>) y en los textos de ayuda (title) no se pueden dibujar íconos: ahí el emoji se quita.
//  · Desde JS: window.mbwIcon('save') da el SVG de un ícono; window.mbwDrawIcon(ctx, 'lock', x, y, tamaño) lo dibuja en un lienzo.
// ==========================================================
(function () {
    'use strict';
    const ICONS = {
        "move": "<path d=\"M9.5 13V5.2a1.6 1.6 0 0 1 3.2 0V11v-1.6a1.6 1.6 0 0 1 3.2 0v1.8-.2a1.6 1.6 0 0 1 3.2 0v3.6a6.4 6.4 0 0 1-6.4 6.4h-1.2a6.1 6.1 0 0 1-4.7-2.2l-3-3.6a1.6 1.6 0 0 1 2.4-2.1l2.3 2.2V13Z\" fill=\"#FFD2A6\" stroke=\"#C98957\" stroke-width=\"1.5\"/><path d=\"M12.7 10.6v1.4M15.9 11v1.2\" fill=\"none\" stroke=\"#C98957\" stroke-width=\"1.4\"/>",
        "pencil": "<path d=\"M16.6 3.6a2.2 2.2 0 0 1 3.1 3.1L8.2 18.2 4 19.5l1.3-4.2Z\" fill=\"#FFCD3C\" stroke=\"#C98F00\" stroke-width=\"1.5\"/><path d=\"M14.6 5.6l3.1 3.1\" fill=\"none\" stroke=\"#C98F00\" stroke-width=\"1.4\"/><path d=\"M16.6 3.6a2.2 2.2 0 0 1 3.1 3.1l-1 1-3.1-3.1Z\" fill=\"#FF8FC2\" stroke=\"#C24D86\" stroke-width=\"1.5\"/><path d=\"M5.3 15.3L4 19.5l4.2-1.3Z\" fill=\"#FFD2A6\" stroke=\"#C98957\" stroke-width=\"1.5\"/>",
        "eraser": "<path d=\"M4.7 15.3l9.6-9.6a2 2 0 0 1 2.8 0l2.9 2.9a2 2 0 0 1 0 2.8L12 19.4a3.6 3.6 0 0 1-2.5 1.1H8.2a2 2 0 0 1-1.4-.6l-2.1-2.1a1.8 1.8 0 0 1 0-2.5Z\" fill=\"#FF8FC2\" stroke=\"#C24D86\" stroke-width=\"1.5\"/><path d=\"M4.7 15.3l4.9-4.9 5.6 5.6L12 19.4a3.6 3.6 0 0 1-2.5 1.1H8.2a2 2 0 0 1-1.4-.6l-2.1-2.1a1.8 1.8 0 0 1 0-2.5Z\" fill=\"#5BB3FF\" stroke=\"#1F6FC5\" stroke-width=\"1.5\"/><path d=\"M8.5 20.5h11\" fill=\"none\" stroke=\"#5A6472\" stroke-width=\"1.6\"/>",
        "bucket": "<path d=\"M18.5 11.5L11 4 3.8 11.2a2 2 0 0 0 0 2.8l5.2 5.2a2 2 0 0 0 2.8 0Z\" fill=\"#DCE2EA\" stroke=\"#7D8796\" stroke-width=\"1.5\"/><path d=\"M4.6 12.4h13.9l-6.7 6.8a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1-.4-1.6Z\" fill=\"#5BB3FF\" stroke=\"#1F6FC5\" stroke-width=\"1.5\"/><path d=\"M8.3 6.7L5.6 4\" fill=\"none\" stroke=\"#5A6472\" stroke-width=\"1.6\"/><path d=\"M20.6 15.2s1.6 2 1.6 3.2a1.6 1.6 0 0 1-3.2 0c0-1.2 1.6-3.2 1.6-3.2Z\" fill=\"#5BB3FF\" stroke=\"#1F6FC5\" stroke-width=\"1.5\"/>",
        "select": "<rect x=\"4\" y=\"4\" width=\"16\" height=\"16\" rx=\"1.5\" fill=\"#5BB3FF\" fill-opacity=\".25\" stroke=\"#1F6FC5\" stroke-width=\"2\" stroke-dasharray=\"3 2.6\"/>",
        "magic": "<path d=\"M3.8 20.2l10-10\" stroke=\"#6F3FD0\" stroke-width=\"3.2\" fill=\"none\"/><path d=\"M3.8 20.2l10-10\" stroke=\"#B07CFF\" stroke-width=\"1.4\" fill=\"none\"/><path d=\"M12.6 8.4l2.8 2.8\" stroke=\"#FFFFFF\" stroke-width=\"3.2\" fill=\"none\"/><path d=\"M17.5 2.2l1 2.3 2.3 1-2.3 1-1 2.3-1-2.3-2.3-1 2.3-1Z\" fill=\"#FFCD3C\" stroke=\"#C98F00\" stroke-width=\"1.1\"/><path d=\"M20.5 10.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6Z\" fill=\"#FFCD3C\" stroke=\"#C98F00\" stroke-width=\"1\"/><path d=\"M9.5 2.8l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6Z\" fill=\"#FFCD3C\" stroke=\"#C98F00\" stroke-width=\"1\"/>",
        "lasso": "<ellipse cx=\"13\" cy=\"8.5\" rx=\"8\" ry=\"5\" fill=\"none\" stroke=\"#B07A4F\" stroke-width=\"2.2\"/><path d=\"M8 12.6c-1.8.9-2.3 2.8-1.2 4 1.1 1.2.6 3.2-1.3 4.2\" fill=\"none\" stroke=\"#B07A4F\" stroke-width=\"2\"/><circle cx=\"8.3\" cy=\"12.8\" r=\"1.5\" fill=\"#C98B57\" stroke=\"#7E5230\" stroke-width=\"1\"/>",
        "camera": "<path d=\"M3 8.5A2 2 0 0 1 5 6.5h2.3l1.5-2.2h6.4l1.5 2.2H19a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z\" fill=\"#9AA5B4\" stroke=\"#5A6472\" stroke-width=\"1.5\"/><circle cx=\"12\" cy=\"13\" r=\"4\" fill=\"#FFFFFF\" stroke=\"#7D8796\" stroke-width=\"1.5\"/><circle cx=\"12\" cy=\"13\" r=\"2\" fill=\"#5BB3FF\" stroke=\"#1F6FC5\" stroke-width=\"1.2\"/><circle cx=\"17.8\" cy=\"9.3\" r=\".9\" fill=\"#FF5F5F\"/>",
        "paste": "<rect x=\"4\" y=\"4.5\" width=\"16\" height=\"16.5\" rx=\"2\" fill=\"#C98B57\" stroke=\"#7E5230\" stroke-width=\"1.5\"/><rect x=\"6.5\" y=\"7.5\" width=\"11\" height=\"11\" rx=\"1\" fill=\"#FFFFFF\" stroke=\"#7D8796\" stroke-width=\"1.1\"/><rect x=\"8.5\" y=\"2.8\" width=\"7\" height=\"3.6\" rx=\"1.2\" fill=\"#9AA5B4\" stroke=\"#5A6472\" stroke-width=\"1.5\"/><path d=\"M8.8 11h6.4M8.8 14.5h4.2\" fill=\"none\" stroke=\"#5A6472\" stroke-width=\"1.4\"/>",
        "cut": "<path d=\"M8.3 15.7L18.5 3.5M15.7 15.7L5.5 3.5\" fill=\"none\" stroke=\"#5A6472\" stroke-width=\"2\"/><circle cx=\"6.3\" cy=\"17.7\" r=\"2.8\" fill=\"#FF5F5F\" stroke=\"#B83232\" stroke-width=\"1.5\"/><circle cx=\"17.7\" cy=\"17.7\" r=\"2.8\" fill=\"#FF5F5F\" stroke=\"#B83232\" stroke-width=\"1.5\"/>",
        "copy": "<rect x=\"3.5\" y=\"3\" width=\"12\" height=\"12.5\" rx=\"2\" fill=\"#DCE2EA\" stroke=\"#7D8796\" stroke-width=\"1.5\"/><rect x=\"8.5\" y=\"8.5\" width=\"12\" height=\"12.5\" rx=\"2\" fill=\"#5BB3FF\" stroke=\"#1F6FC5\" stroke-width=\"1.5\"/><path d=\"M11.5 12.5h6M11.5 16h4\" fill=\"none\" stroke=\"#FFFFFF\" stroke-width=\"1.5\"/>",
        "file": "<path d=\"M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z\" fill=\"#FFFFFF\" stroke=\"#7D8796\" stroke-width=\"1.5\"/><path d=\"M14 3v5h5Z\" fill=\"#DCE2EA\" stroke=\"#7D8796\" stroke-width=\"1.2\"/><path d=\"M8.5 13h7M8.5 16.5h4.5\" fill=\"none\" stroke=\"#5BB3FF\" stroke-width=\"1.5\"/>",
        "mirror": "<path d=\"M12 2.5v19\" fill=\"none\" stroke=\"#5A6472\" stroke-width=\"1.6\" stroke-dasharray=\"2 2\"/><path d=\"M9 7.5L3 17h6Z\" fill=\"#5BB3FF\" stroke=\"#1F6FC5\" stroke-width=\"1.5\"/><path d=\"M15 7.5L21 17h-6Z\" fill=\"#B07CFF\" stroke=\"#6F3FD0\" stroke-width=\"1.5\"/>",
        "rotate": "<path d=\"M20 12a8 8 0 1 1-2.4-5.7\" fill=\"none\" stroke=\"#2FBF6F\" stroke-width=\"2.8\"/><path d=\"M20.8 3.5v5.6h-5.6Z\" fill=\"#45D483\" stroke=\"#1E9055\" stroke-width=\"1.2\"/>",
        "save": "<path d=\"M5 3.5h10.8l4.7 4.7V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V5A1.5 1.5 0 0 1 5 3.5Z\" fill=\"#5BB3FF\" stroke=\"#1F6FC5\" stroke-width=\"1.5\"/><path d=\"M7.5 3.5h7v4.5h-7Z\" fill=\"#DCE2EA\" stroke=\"#7D8796\" stroke-width=\"1.2\"/><rect x=\"7\" y=\"13\" width=\"10\" height=\"7.5\" rx=\"1\" fill=\"#FFFFFF\" stroke=\"#7D8796\" stroke-width=\"1.2\"/><path d=\"M9 15.5h6M9 18h4\" fill=\"none\" stroke=\"#9AA5B4\" stroke-width=\"1.3\"/>",
        "gallery": "<rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"2.5\" fill=\"#BDE3FF\" stroke=\"#1F6FC5\" stroke-width=\"1.5\"/><path d=\"M3.8 18.5l5.7-6.2 3.6 3.5 3-2.6 5 4.8V18a2 2 0 0 1-2 2H5.5a2 2 0 0 1-1.7-1.5Z\" fill=\"#45D483\" stroke=\"#1E9055\" stroke-width=\"1.2\"/><circle cx=\"9\" cy=\"9.3\" r=\"2\" fill=\"#FFCD3C\" stroke=\"#C98F00\" stroke-width=\"1.2\"/>",
        "backpack": "<path d=\"M9 6V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V6\" fill=\"none\" stroke=\"#7E5230\" stroke-width=\"1.8\"/><path d=\"M5 10a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v9.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5Z\" fill=\"#C98B57\" stroke=\"#7E5230\" stroke-width=\"1.5\"/><path d=\"M8.5 21v-3.5a1.5 1.5 0 0 1 1.5-1.5h4a1.5 1.5 0 0 1 1.5 1.5V21Z\" fill=\"#FF9A3D\" stroke=\"#C9620F\" stroke-width=\"1.2\"/><path d=\"M5 12.5h14\" fill=\"none\" stroke=\"#7E5230\" stroke-width=\"1.4\"/>",
        "boom": "<path d=\"M12 1.8l2.1 5 4.9-2.2-2 5 5.2 2.4-5.2 2.1 2 5-4.9-2.1L12 22.2l-2.1-5.2-4.9 2.1 2-5L1.8 12l5.2-2.4-2-5 4.9 2.2Z\" fill=\"#FF9A3D\" stroke=\"#C9620F\" stroke-width=\"1.5\"/><path d=\"M12 7l1.3 3 3-.9-1.6 2.9 1.6 2.9-3-.9L12 17l-1.3-3-3 .9 1.6-2.9-1.6-2.9 3 .9Z\" fill=\"#FFCD3C\" stroke=\"#C98F00\" stroke-width=\"1\"/>",
        "weather": "<circle cx=\"8.5\" cy=\"8\" r=\"3.6\" fill=\"#FFCD3C\" stroke=\"#C98F00\" stroke-width=\"1.5\"/><path d=\"M8.5 1.8v1.2M2.3 8h1.2M4.1 3.6l.9.9M12.9 3.6l-.9.9\" fill=\"none\" stroke=\"#C98F00\" stroke-width=\"1.6\"/><path d=\"M8.5 19.5h8.8a3.7 3.7 0 0 0 0-7.4 5.2 5.2 0 0 0-10 1.3A3.1 3.1 0 0 0 8.5 19.5Z\" fill=\"#FFFFFF\" stroke=\"#7D8796\" stroke-width=\"1.5\"/>",
        "tag": "<path d=\"M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.8 8.8a1.4 1.4 0 0 1 0 2l-6.6 6.6a1.4 1.4 0 0 1-2 0Z\" fill=\"#FF9A3D\" stroke=\"#C9620F\" stroke-width=\"1.5\"/><circle cx=\"8.3\" cy=\"8.3\" r=\"1.7\" fill=\"#FFFFFF\" stroke=\"#7D8796\" stroke-width=\"1.2\"/>",
        "star": "<path d=\"M12 3.2l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17.2l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z\" fill=\"none\" stroke=\"#F5B90A\" stroke-width=\"1.9\"/>",
        "star-fill": "<path d=\"M12 3.2l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17.2l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z\" fill=\"#FFCD3C\" stroke=\"#C98F00\" stroke-width=\"1.5\"/>",
        "globe": "<circle cx=\"12\" cy=\"12\" r=\"9\" fill=\"#5BB3FF\" stroke=\"#1F6FC5\" stroke-width=\"1.5\"/><path d=\"M7.5 5.3c1.2 1.4 3.4 1.1 3.9 2.9.4 1.4-1.4 1.8-1.1 3.2.3 1.5 2.4 1 2.7 2.6.2 1.2-.8 2.4-.5 4.3M16.5 5.6c-.6 1.6-.3 2.7 1 3.3 1.2.5 2.4.2 3.4 1.3\" fill=\"none\" stroke=\"#45D483\" stroke-width=\"2.4\"/><path d=\"M5 9.5c1.4.4 2.3 1.5 2 2.9-.3 1.3-1.6 1.6-1.3 3.1M15.5 14.4c1 .6 1.6 1.9 1.2 3.3\" fill=\"none\" stroke=\"#45D483\" stroke-width=\"2\"/>",
        "folder": "<path d=\"M3 7.5a2 2 0 0 1 2-2h4.2l2 2.2H19a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z\" fill=\"#FFCD3C\" stroke=\"#C98F00\" stroke-width=\"1.5\"/><path d=\"M3 10h18\" fill=\"none\" stroke=\"#C98F00\" stroke-width=\"1.3\"/>",
        "folder-open": "<path d=\"M3.5 18.5V7a2 2 0 0 1 2-2h3.8l2 2.2h6.2a2 2 0 0 1 2 2V11\" fill=\"#F2B41E\" stroke=\"#C98F00\" stroke-width=\"1.5\"/><path d=\"M3.5 18.5l2.4-6.2A1.6 1.6 0 0 1 7.4 11.3h13.3a1 1 0 0 1 .9 1.4l-2.4 6.3a1.6 1.6 0 0 1-1.5 1H5a1.5 1.5 0 0 1-1.5-1.5Z\" fill=\"#FFCD3C\" stroke=\"#C98F00\" stroke-width=\"1.5\"/>",
        "news": "<path d=\"M17 9h2.5a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2H6\" fill=\"#DCE2EA\" stroke=\"#7D8796\" stroke-width=\"1.5\"/><path d=\"M4 5.5A1.5 1.5 0 0 1 5.5 4h10A1.5 1.5 0 0 1 17 5.5V19a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2Z\" fill=\"#FFFFFF\" stroke=\"#7D8796\" stroke-width=\"1.5\"/><rect x=\"7\" y=\"7.3\" width=\"6.5\" height=\"4.2\" rx=\".6\" fill=\"#FF5F5F\" stroke=\"#B83232\" stroke-width=\"1.1\"/><path d=\"M7 15h7M7 18h4.5\" fill=\"none\" stroke=\"#9AA5B4\" stroke-width=\"1.4\"/>",
        "publish": "<path d=\"M3.5 10.2v3.6a1 1 0 0 0 1 1H7l9.5 5.2V4L7 9.2H4.5a1 1 0 0 0-1 1Z\" fill=\"#FF5F5F\" stroke=\"#B83232\" stroke-width=\"1.5\"/><path d=\"M7 9.2v5.6\" fill=\"none\" stroke=\"#B83232\" stroke-width=\"1.3\"/><path d=\"M19.5 9.2a4 4 0 0 1 0 5.6\" fill=\"none\" stroke=\"#C9620F\" stroke-width=\"2\"/><path d=\"M7 14.8l1.6 5.2h2.6L10 15.6Z\" fill=\"#DCE2EA\" stroke=\"#7D8796\" stroke-width=\"1.2\"/>",
        "undo": "<path d=\"M4 9.5h10.5a5.5 5.5 0 0 1 0 11H11\" fill=\"none\" stroke=\"#3D9BF0\" stroke-width=\"2.8\"/><path d=\"M9.5 4L3.5 9.5l6 5.5Z\" fill=\"#5BB3FF\" stroke=\"#1F6FC5\" stroke-width=\"1.2\"/>",
        "redo": "<path d=\"M20 9.5H9.5a5.5 5.5 0 0 0 0 11H13\" fill=\"none\" stroke=\"#3D9BF0\" stroke-width=\"2.8\"/><path d=\"M14.5 4l6 5.5-6 5.5Z\" fill=\"#5BB3FF\" stroke=\"#1F6FC5\" stroke-width=\"1.2\"/>",
        "plus": "<circle cx=\"12\" cy=\"12\" r=\"9\" fill=\"#45D483\" stroke=\"#1E9055\" stroke-width=\"1.5\"/><path d=\"M12 7.5v9M7.5 12h9\" fill=\"none\" stroke=\"#FFFFFF\" stroke-width=\"2.4\"/>",
        "gear": "<path d=\"M12.00 4.40 L13.95 2.19 L15.83 2.76 L16.22 5.68 L17.37 6.63 L20.31 6.44 L21.24 8.17 L19.45 10.52 L19.60 12.00 L21.81 13.95 L21.24 15.83 L18.32 16.22 L17.37 17.37 L17.56 20.31 L15.83 21.24 L13.48 19.45 L12.00 19.60 L10.05 21.81 L8.17 21.24 L7.78 18.32 L6.63 17.37 L3.69 17.56 L2.76 15.83 L4.55 13.48 L4.40 12.00 L2.19 10.05 L2.76 8.17 L5.68 7.78 L6.63 6.63 L6.44 3.69 L8.17 2.76 L10.52 4.55Z\" fill=\"#9AA5B4\" stroke=\"#5A6472\" stroke-width=\"1.5\"/><circle cx=\"12\" cy=\"12\" r=\"3.2\" fill=\"#FFFFFF\" stroke=\"#7D8796\" stroke-width=\"1.5\"/>",
        "door": "<path d=\"M5.5 21V4.5a1.5 1.5 0 0 1 1.5-1.5h10a1.5 1.5 0 0 1 1.5 1.5V21Z\" fill=\"#C98B57\" stroke=\"#7E5230\" stroke-width=\"1.5\"/><rect x=\"8\" y=\"5.5\" width=\"8\" height=\"5.5\" rx=\".8\" fill=\"#B57A49\" stroke=\"#7E5230\" stroke-width=\"1\"/><rect x=\"8\" y=\"12.8\" width=\"8\" height=\"5.5\" rx=\".8\" fill=\"#B57A49\" stroke=\"#7E5230\" stroke-width=\"1\"/><path d=\"M3 21h18\" fill=\"none\" stroke=\"#5A6472\" stroke-width=\"1.8\"/><circle cx=\"15.3\" cy=\"12\" r=\"1.1\" fill=\"#FFCD3C\"/>",
        "check": "<path d=\"M5 12.5l4.5 4.5L19 7.5\" fill=\"none\" stroke=\"#2FBF6F\" stroke-width=\"3\"/>",
        "check-circle": "<circle cx=\"12\" cy=\"12\" r=\"9\" fill=\"#45D483\" stroke=\"#1E9055\" stroke-width=\"1.5\"/><path d=\"M8 12.3l2.8 2.8 5.2-5.6\" fill=\"none\" stroke=\"#FFFFFF\" stroke-width=\"2.4\"/>",
        "check-square": "<rect x=\"3.5\" y=\"3.5\" width=\"17\" height=\"17\" rx=\"3.5\" fill=\"#5BB3FF\" stroke=\"#1F6FC5\" stroke-width=\"1.5\"/><path d=\"M8 12.3l2.8 2.8 5.2-5.6\" fill=\"none\" stroke=\"#FFFFFF\" stroke-width=\"2.4\"/>",
        "x": "<path d=\"M6.5 6.5l11 11M17.5 6.5l-11 11\" fill=\"none\" stroke=\"#E5484D\" stroke-width=\"3\"/>",
        "x-circle": "<circle cx=\"12\" cy=\"12\" r=\"9\" fill=\"#FF5F5F\" stroke=\"#B83232\" stroke-width=\"1.5\"/><path d=\"M9 9l6 6M15 9l-6 6\" fill=\"none\" stroke=\"#FFFFFF\" stroke-width=\"2.4\"/>",
        "warning": "<path d=\"M10.3 4.3L2.9 17.5A2 2 0 0 0 4.6 20.5h14.8a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z\" fill=\"#FFCD3C\" stroke=\"#C98F00\" stroke-width=\"1.5\"/><path d=\"M12 9.3v4.4\" fill=\"none\" stroke=\"#3A3A3A\" stroke-width=\"2.2\"/><circle cx=\"12\" cy=\"17\" r=\"1.2\" fill=\"#3A3A3A\"/>",
        "ban": "<circle cx=\"12\" cy=\"12\" r=\"9\" fill=\"#FF5F5F\" stroke=\"#B83232\" stroke-width=\"1.5\"/><circle cx=\"12\" cy=\"12\" r=\"5.6\" fill=\"#FFFFFF\"/><path d=\"M8 8l8 8\" fill=\"none\" stroke=\"#FF5F5F\" stroke-width=\"2.8\"/>",
        "lotus": "<path d=\"M12 14.5c-2.8 0-5.6-2-6.6-5.6 2.7.1 4.8 1.5 6.1 3.7Z\" fill=\"#FF8FC2\" stroke=\"#C24D86\" stroke-width=\"1.5\"/><path d=\"M12 14.5c2.8 0 5.6-2 6.6-5.6-2.7.1-4.8 1.5-6.1 3.7Z\" fill=\"#FF8FC2\" stroke=\"#C24D86\" stroke-width=\"1.5\"/><path d=\"M12 5.5c2 2.4 2 6.4 0 9-2-2.6-2-6.6 0-9Z\" fill=\"#FFB3D6\" stroke=\"#C24D86\" stroke-width=\"1.5\"/><path d=\"M4 18h16\" fill=\"none\" stroke=\"#1E9055\" stroke-width=\"2\"/>",
        "palette": "<path d=\"M12 3a9 9 0 0 0 0 18c1.3 0 2-.9 2-1.8 0-1-.7-1.4-.7-2.3 0-1.1.9-1.8 2-1.8h1.9a3.8 3.8 0 0 0 3.8-3.8C21 6.8 17 3 12 3Z\" fill=\"#F3D9B1\" stroke=\"#7E5230\" stroke-width=\"1.5\"/><circle cx=\"7.4\" cy=\"11.4\" r=\"1.6\" fill=\"#FF5F5F\"/><circle cx=\"9.6\" cy=\"7.2\" r=\"1.6\" fill=\"#5BB3FF\"/><circle cx=\"14.4\" cy=\"7\" r=\"1.6\" fill=\"#45D483\"/><circle cx=\"17.4\" cy=\"10.4\" r=\"1.6\" fill=\"#B07CFF\"/>",
        "rocket": "<path d=\"M9.2 16l-3.2 2.8.8-4.6M14.8 16l3.2 2.8-.8-4.6\" fill=\"#FF5F5F\" stroke=\"#B83232\" stroke-width=\"1.3\"/><path d=\"M12 2.8c3.6 2.2 5.2 5.8 5 10l-2.2 3.2H9.2L7 12.8c-.2-4.2 1.4-7.8 5-10Z\" fill=\"#DCE2EA\" stroke=\"#7D8796\" stroke-width=\"1.5\"/><circle cx=\"12\" cy=\"10\" r=\"2\" fill=\"#5BB3FF\" stroke=\"#1F6FC5\" stroke-width=\"1.2\"/><path d=\"M10.3 16.5L12 21.3l1.7-4.8Z\" fill=\"#FF9A3D\" stroke=\"#C9620F\" stroke-width=\"1.2\"/>",
        "wrench": "<path d=\"M14.7 6.3a4.3 4.3 0 0 0-5.3 5.3L3.8 17.2a2.1 2.1 0 0 0 3 3l5.6-5.6a4.3 4.3 0 0 0 5.3-5.3l-2.6 2.6-2.4-.6-.6-2.4Z\" fill=\"#9AA5B4\" stroke=\"#5A6472\" stroke-width=\"1.5\"/>",
        "brush": "<path d=\"M18.6 3.4a2 2 0 0 1 2.8 2.8L13.2 14.4l-2.8-2.8Z\" fill=\"#C98B57\" stroke=\"#7E5230\" stroke-width=\"1.5\"/><path d=\"M9.6 12.4c-2.2 0-3.8 1.6-3.8 3.8 0 1.6-1 2.6-2.6 3 3.8 1.8 8.8.6 9.3-3.9Z\" fill=\"#B07CFF\" stroke=\"#6F3FD0\" stroke-width=\"1.5\"/>",
        "box": "<path d=\"M3.5 7.5L12 3.2l8.5 4.3v9L12 20.8l-8.5-4.3Z\" fill=\"#E2B07A\" stroke=\"#7E5230\" stroke-width=\"1.5\"/><path d=\"M3.5 7.5L12 11.8l8.5-4.3\" fill=\"none\" stroke=\"#7E5230\" stroke-width=\"1.4\"/><path d=\"M12 11.8v9l8.5-4.3v-9Z\" fill=\"#C98B57\" stroke=\"#7E5230\" stroke-width=\"1.5\"/><path d=\"M7.7 5.4l8.5 4.3\" fill=\"none\" stroke=\"#FFCD3C\" stroke-width=\"1.4\"/>",
        "download": "<path d=\"M4 16.5V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.5\" fill=\"none\" stroke=\"#5A6472\" stroke-width=\"2.2\"/><path d=\"M12 3.5v9\" fill=\"none\" stroke=\"#1F6FC5\" stroke-width=\"2.8\"/><path d=\"M7.5 10.5L12 15l4.5-4.5Z\" fill=\"#5BB3FF\" stroke=\"#1F6FC5\" stroke-width=\"1.2\"/>",
        "upload": "<path d=\"M4 16.5V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.5\" fill=\"none\" stroke=\"#5A6472\" stroke-width=\"2.2\"/><path d=\"M12 15V6\" fill=\"none\" stroke=\"#1E9055\" stroke-width=\"2.8\"/><path d=\"M7.5 8L12 3.5 16.5 8Z\" fill=\"#45D483\" stroke=\"#1E9055\" stroke-width=\"1.2\"/>",
        "trash": "<path d=\"M6 7l1 12.6a1.5 1.5 0 0 0 1.5 1.4h7a1.5 1.5 0 0 0 1.5-1.4L18 7Z\" fill=\"#DCE2EA\" stroke=\"#7D8796\" stroke-width=\"1.5\"/><rect x=\"3.5\" y=\"5\" width=\"17\" height=\"3\" rx=\"1\" fill=\"#FF5F5F\" stroke=\"#B83232\" stroke-width=\"1.5\"/><path d=\"M9.5 5V3.5h5V5\" fill=\"none\" stroke=\"#5A6472\" stroke-width=\"1.5\"/><path d=\"M10 11v6M14 11v6\" fill=\"none\" stroke=\"#5A6472\" stroke-width=\"1.6\"/>",
        "bell": "<path d=\"M6 16.5V11a6 6 0 0 1 12 0v5.5l1.6 2H4.4Z\" fill=\"#FFCD3C\" stroke=\"#C98F00\" stroke-width=\"1.5\"/><path d=\"M10 20.5a2 2 0 0 0 4 0Z\" fill=\"#FF9A3D\" stroke=\"#C9620F\" stroke-width=\"1.2\"/>",
        "bell-off": "<path d=\"M6 16.5V11a6 6 0 0 1 12 0v5.5l1.6 2H4.4Z\" fill=\"#DCE2EA\" stroke=\"#7D8796\" stroke-width=\"1.5\"/><path d=\"M10 20.5a2 2 0 0 0 4 0Z\" fill=\"#9AA5B4\" stroke=\"#5A6472\" stroke-width=\"1.2\"/><path d=\"M3.5 3.5l17 17\" fill=\"none\" stroke=\"#B83232\" stroke-width=\"2.6\"/>",
        "bolt": "<path d=\"M13.5 2.5L4.5 14H11l-1 7.5 9-11.5h-6.5Z\" fill=\"#FFCD3C\" stroke=\"#C98F00\" stroke-width=\"1.5\"/>",
        "monitor": "<rect x=\"3\" y=\"4\" width=\"18\" height=\"12.5\" rx=\"2\" fill=\"#9AA5B4\" stroke=\"#5A6472\" stroke-width=\"1.5\"/><rect x=\"5\" y=\"6\" width=\"14\" height=\"8.5\" rx=\".8\" fill=\"#7CC4FF\" stroke=\"#1F6FC5\" stroke-width=\"1\"/><path d=\"M8.5 20.5h7M12 16.5v4\" fill=\"none\" stroke=\"#5A6472\" stroke-width=\"2\"/>",
        "speaker": "<path d=\"M4 9.2v5.6h3.6L12.5 19V5L7.6 9.2Z\" fill=\"#9AA5B4\" stroke=\"#5A6472\" stroke-width=\"1.5\"/><path d=\"M16 9a4.2 4.2 0 0 1 0 6M18.6 6.4a8 8 0 0 1 0 11.2\" fill=\"none\" stroke=\"#3D9BF0\" stroke-width=\"2\"/>",
        "keyboard": "<rect x=\"2.5\" y=\"6\" width=\"19\" height=\"12\" rx=\"2\" fill=\"#DCE2EA\" stroke=\"#7D8796\" stroke-width=\"1.5\"/><path d=\"M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M6.5 13.6h.01M17 13.6h.01\" fill=\"none\" stroke=\"#5A6472\" stroke-width=\"2.2\"/><path d=\"M9 14.2h6\" fill=\"none\" stroke=\"#5A6472\" stroke-width=\"2\"/>",
        "fullscreen": "<path d=\"M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4\" fill=\"none\" stroke=\"#3D9BF0\" stroke-width=\"2.6\"/>",
        "arrow-left": "<path d=\"M20 12H8\" fill=\"none\" stroke=\"#3D9BF0\" stroke-width=\"3\"/><path d=\"M10.5 5L3.5 12l7 7Z\" fill=\"#5BB3FF\" stroke=\"#1F6FC5\" stroke-width=\"1.2\"/>",
        "arrow-right": "<path d=\"M4 12h12\" fill=\"none\" stroke=\"#3D9BF0\" stroke-width=\"3\"/><path d=\"M13.5 5l7 7-7 7Z\" fill=\"#5BB3FF\" stroke=\"#1F6FC5\" stroke-width=\"1.2\"/>",
        "arrow-down": "<path d=\"M12 4v12\" fill=\"none\" stroke=\"#3D9BF0\" stroke-width=\"3\"/><path d=\"M5 13.5l7 7 7-7Z\" fill=\"#5BB3FF\" stroke=\"#1F6FC5\" stroke-width=\"1.2\"/>",
        "chevron-down": "<path d=\"M6 9.5l6 6 6-6\" fill=\"none\" stroke=\"#3D9BF0\" stroke-width=\"2.8\"/>",
        "chevron-up": "<path d=\"M6 14.5l6-6 6 6\" fill=\"none\" stroke=\"#3D9BF0\" stroke-width=\"2.8\"/>",
        "chevron-right": "<path d=\"M9.5 6l6 6-6 6\" fill=\"none\" stroke=\"#3D9BF0\" stroke-width=\"2.8\"/>",
        "chevron-left": "<path d=\"M14.5 6l-6 6 6 6\" fill=\"none\" stroke=\"#3D9BF0\" stroke-width=\"2.8\"/>",
        "send": "<path d=\"M3.5 11.2L20.5 3.5l-6.3 17-3.2-7.1Z\" fill=\"#5BB3FF\" stroke=\"#1F6FC5\" stroke-width=\"1.5\"/><path d=\"M11 13.4l9.5-9.9\" fill=\"none\" stroke=\"#1F6FC5\" stroke-width=\"1.4\"/>",
        "party": "<path d=\"M4 20.5l3.6-11.6 8 8Z\" fill=\"#FFCD3C\" stroke=\"#C98F00\" stroke-width=\"1.5\"/><path d=\"M6 14.2l3.8 3.8M7 11.2l5.7 5.7\" fill=\"none\" stroke=\"#FF9A3D\" stroke-width=\"1.6\"/><path d=\"M14 3.5v1.8M18.8 5.2l-1.3 1.3M20.5 10h-1.8\" fill=\"none\" stroke=\"#B07CFF\" stroke-width=\"1.8\"/><circle cx=\"12.5\" cy=\"6.5\" r=\"1.1\" fill=\"#FF8FC2\"/><circle cx=\"17.5\" cy=\"12.5\" r=\"1.1\" fill=\"#5BB3FF\"/><circle cx=\"20\" cy=\"3.5\" r=\"1\" fill=\"#45D483\"/>",
        "film": "<rect x=\"3\" y=\"3.5\" width=\"18\" height=\"17\" rx=\"2\" fill=\"#9AA5B4\" stroke=\"#5A6472\" stroke-width=\"1.5\"/><rect x=\"7.5\" y=\"3.5\" width=\"9\" height=\"17\" fill=\"#7CC4FF\" stroke=\"#1F6FC5\" stroke-width=\"1.2\"/><path d=\"M5.2 6.5h.01M5.2 10h.01M5.2 13.5h.01M5.2 17h.01M18.8 6.5h.01M18.8 10h.01M18.8 13.5h.01M18.8 17h.01\" fill=\"none\" stroke=\"#FFFFFF\" stroke-width=\"2\"/>",
        "houses": "<path d=\"M14 20.5v-5.8l3.5-2.9 3 2.5v6.2Z\" fill=\"#5BB3FF\" stroke=\"#1F6FC5\" stroke-width=\"1.5\"/><path d=\"M4 20.5v-8.2l5-4.2 5 4.2v8.2Z\" fill=\"#FFE3B8\" stroke=\"#7E5230\" stroke-width=\"1.5\"/><path d=\"M2.5 12.6L9 7.2l6.5 5.4\" fill=\"none\" stroke=\"#B83232\" stroke-width=\"2\"/><rect x=\"7.5\" y=\"15.5\" width=\"3\" height=\"5\" fill=\"#C98B57\" stroke=\"#7E5230\" stroke-width=\"1\"/><path d=\"M2.5 20.5h19\" fill=\"none\" stroke=\"#1E9055\" stroke-width=\"2\"/>",
        "pig": "<path d=\"M6.6 7.8L5.5 3.8l3.8 2.1M17.4 7.8l1.1-4-3.8 2.1Z\" fill=\"#FF8FC2\" stroke=\"#C24D86\" stroke-width=\"1.3\"/><circle cx=\"12\" cy=\"13\" r=\"7.5\" fill=\"#FFB3D1\" stroke=\"#C24D86\" stroke-width=\"1.5\"/><ellipse cx=\"12\" cy=\"15.2\" rx=\"3\" ry=\"2.1\" fill=\"#FF8FC2\" stroke=\"#C24D86\" stroke-width=\"1.2\"/><path d=\"M10.9 15.2h.01M13.1 15.2h.01M9 10.8h.01M15 10.8h.01\" fill=\"none\" stroke=\"#5A2A3F\" stroke-width=\"2\"/>",
        "hourglass": "<path d=\"M7.5 3v2.5a4.5 4.5 0 0 0 9 0V3Z\" fill=\"#E6F4FF\" stroke=\"#1F6FC5\" stroke-width=\"1.5\"/><path d=\"M7.5 21v-2.5a4.5 4.5 0 0 1 9 0V21Z\" fill=\"#E6F4FF\" stroke=\"#1F6FC5\" stroke-width=\"1.5\"/><path d=\"M9 20.5h6v-1.5a3 3 0 0 0-6 0Z\" fill=\"#FFCD3C\"/><path d=\"M6.5 3h11M6.5 21h11\" fill=\"none\" stroke=\"#7E5230\" stroke-width=\"2.2\"/>",
        "chat": "<path d=\"M4.5 4.5h15a1.5 1.5 0 0 1 1.5 1.5v9.5a1.5 1.5 0 0 1-1.5 1.5H11l-4.5 3.8V17h-2A1.5 1.5 0 0 1 3 15.5V6a1.5 1.5 0 0 1 1.5-1.5Z\" fill=\"#5BB3FF\" stroke=\"#1F6FC5\" stroke-width=\"1.5\"/><path d=\"M7.5 9h9M7.5 12.5h6\" fill=\"none\" stroke=\"#FFFFFF\" stroke-width=\"1.8\"/>",
        "users": "<path d=\"M15.5 4.8a3.5 3.5 0 0 1 0 6.4M18 14.3a6.5 6.5 0 0 1 3.5 5.7\" fill=\"none\" stroke=\"#6F3FD0\" stroke-width=\"2\"/><path d=\"M2.5 20a6.5 6.5 0 0 1 13 0Z\" fill=\"#B07CFF\" stroke=\"#6F3FD0\" stroke-width=\"1.5\"/><circle cx=\"9\" cy=\"8\" r=\"3.6\" fill=\"#FFD2A6\" stroke=\"#C98957\" stroke-width=\"1.5\"/>",
        "fire": "<path d=\"M12 21c-3.9 0-6.5-2.6-6.5-6.1 0-3.4 2.5-5.4 3.6-8.9 1.8 1.4 2.5 3.4 2.5 5.1 1-.8 1.7-2.1 1.9-3.6 2.6 2.2 5 4.8 5 7.5 0 3.5-2.6 6-6.5 6Z\" fill=\"#FF9A3D\" stroke=\"#C9620F\" stroke-width=\"1.5\"/><path d=\"M12 21c-2 0-3.2-1.3-3.2-3 0-1.8 1.4-2.8 2-4.6 2.3 1.4 4.4 3 4.4 4.8 0 1.6-1.3 2.8-3.2 2.8Z\" fill=\"#FFCD3C\" stroke=\"#C98F00\" stroke-width=\"1\"/>",
        "steam": "<path d=\"M8 3.5c-1.2 1.4 1.2 2.6 0 4M12 2.8c-1.2 1.4 1.2 2.6 0 4M16 3.5c-1.2 1.4 1.2 2.6 0 4\" fill=\"none\" stroke=\"#9AA5B4\" stroke-width=\"1.8\"/><path d=\"M3.5 12h17a8.5 8.5 0 0 1-17 0Z\" fill=\"#5BB3FF\" stroke=\"#1F6FC5\" stroke-width=\"1.5\"/>",
        "clock": "<circle cx=\"12\" cy=\"12\" r=\"9\" fill=\"#5BB3FF\" stroke=\"#1F6FC5\" stroke-width=\"1.5\"/><circle cx=\"12\" cy=\"12\" r=\"6.6\" fill=\"#FFFFFF\"/><path d=\"M12 7.5V12l3 2\" fill=\"none\" stroke=\"#2B3340\" stroke-width=\"2\"/>",
        "eye": "<path d=\"M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z\" fill=\"#FFFFFF\" stroke=\"#7D8796\" stroke-width=\"1.5\"/><circle cx=\"12\" cy=\"12\" r=\"3.6\" fill=\"#5BB3FF\" stroke=\"#1F6FC5\" stroke-width=\"1.2\"/><circle cx=\"12\" cy=\"12\" r=\"1.4\" fill=\"#1D2633\"/>",
        "smile": "<circle cx=\"12\" cy=\"12\" r=\"9\" fill=\"#FFCD3C\" stroke=\"#C98F00\" stroke-width=\"1.5\"/><path d=\"M8 14.5a4.6 4.6 0 0 0 8 0\" fill=\"none\" stroke=\"#6B4A00\" stroke-width=\"1.8\"/><path d=\"M9 9.5h.01M15 9.5h.01\" fill=\"none\" stroke=\"#6B4A00\" stroke-width=\"2.4\"/>",
        "pin": "<path d=\"M12 21s-6.5-5.9-6.5-11a6.5 6.5 0 0 1 13 0c0 5.1-6.5 11-6.5 11Z\" fill=\"#FF5F5F\" stroke=\"#B83232\" stroke-width=\"1.5\"/><circle cx=\"12\" cy=\"10\" r=\"2.4\" fill=\"#FFFFFF\"/>",
        "pushpin": "<path d=\"M12 14v7\" fill=\"none\" stroke=\"#5A6472\" stroke-width=\"2\"/><path d=\"M9 3.5h6l-1 5.2 3 3V14H7v-2.3l3-3Z\" fill=\"#FF5F5F\" stroke=\"#B83232\" stroke-width=\"1.5\"/>",
        "gamepad": "<path d=\"M7.2 7h9.6a5 5 0 0 1 4.9 6l-.6 3.1a2.4 2.4 0 0 1-4.1 1.2L15 15.2H9l-2 2.1a2.4 2.4 0 0 1-4.1-1.2L2.3 13A5 5 0 0 1 7.2 7Z\" fill=\"#B07CFF\" stroke=\"#6F3FD0\" stroke-width=\"1.5\"/><path d=\"M7.5 10v4M5.5 12h4\" fill=\"none\" stroke=\"#FFFFFF\" stroke-width=\"1.8\"/><circle cx=\"15.5\" cy=\"11\" r=\"1.1\" fill=\"#FFCD3C\"/><circle cx=\"17.6\" cy=\"13\" r=\"1.1\" fill=\"#45D483\"/>",
        "inbox": "<path d=\"M3 13l2.8-7.2A1.5 1.5 0 0 1 7.2 4.8h9.6a1.5 1.5 0 0 1 1.4 1L21 13v5.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5Z\" fill=\"#DCE2EA\" stroke=\"#7D8796\" stroke-width=\"1.5\"/><path d=\"M3 13h5l1.5 2.5h5L16 13h5v5.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5Z\" fill=\"#5BB3FF\" stroke=\"#1F6FC5\" stroke-width=\"1.5\"/>",
        "target": "<circle cx=\"12\" cy=\"12\" r=\"9\" fill=\"#FF5F5F\" stroke=\"#B83232\" stroke-width=\"1.5\"/><circle cx=\"12\" cy=\"12\" r=\"6\" fill=\"#FFFFFF\"/><circle cx=\"12\" cy=\"12\" r=\"3.2\" fill=\"#FF5F5F\"/>",
        "info": "<circle cx=\"12\" cy=\"12\" r=\"9\" fill=\"#5BB3FF\" stroke=\"#1F6FC5\" stroke-width=\"1.5\"/><path d=\"M12 11v5.5\" fill=\"none\" stroke=\"#FFFFFF\" stroke-width=\"2.4\"/><circle cx=\"12\" cy=\"7.6\" r=\"1.3\" fill=\"#FFFFFF\"/>",
        "battery": "<rect x=\"2.5\" y=\"7\" width=\"17\" height=\"10\" rx=\"2\" fill=\"#DCE2EA\" stroke=\"#7D8796\" stroke-width=\"1.5\"/><path d=\"M22 10.8v2.4\" fill=\"none\" stroke=\"#5A6472\" stroke-width=\"2.2\"/><rect x=\"4.5\" y=\"9\" width=\"9\" height=\"6\" rx=\"1\" fill=\"#45D483\"/>",
        "lock": "<path d=\"M8 10.5V7.5a4 4 0 0 1 8 0v3\" fill=\"none\" stroke=\"#5A6472\" stroke-width=\"2.2\"/><rect x=\"5\" y=\"10.5\" width=\"14\" height=\"10.5\" rx=\"2\" fill=\"#FFCD3C\" stroke=\"#C98F00\" stroke-width=\"1.5\"/><circle cx=\"12\" cy=\"15.5\" r=\"1.6\" fill=\"#6B4A00\"/>",
        "reply": "<path d=\"M4 12h11a5 5 0 0 1 5 5v1.5\" fill=\"none\" stroke=\"#3D9BF0\" stroke-width=\"2.8\"/><path d=\"M9.5 6L3.5 12l6 6Z\" fill=\"#5BB3FF\" stroke=\"#1F6FC5\" stroke-width=\"1.2\"/>",
        "cart": "<path d=\"M3 8.5h18l-2.2 8.2a1.5 1.5 0 0 1-1.4 1.1H6.6a1.5 1.5 0 0 1-1.4-1.1Z\" fill=\"#9AA5B4\" stroke=\"#5A6472\" stroke-width=\"1.5\"/><path d=\"M8 12.5h8\" fill=\"none\" stroke=\"#DCE2EA\" stroke-width=\"1.6\"/><circle cx=\"8.5\" cy=\"20.2\" r=\"1.7\" fill=\"#DCE2EA\" stroke=\"#7D8796\" stroke-width=\"1.2\"/><circle cx=\"15.5\" cy=\"20.2\" r=\"1.7\" fill=\"#DCE2EA\" stroke=\"#7D8796\" stroke-width=\"1.2\"/>",
        "boat": "<path d=\"M12 4.2l6.5 8.3H12Z\" fill=\"#FFFFFF\" stroke=\"#7D8796\" stroke-width=\"1.5\"/><path d=\"M12 3v11.5\" fill=\"none\" stroke=\"#7E5230\" stroke-width=\"1.8\"/><path d=\"M2.5 14.5h19l-2.6 4.2a2 2 0 0 1-1.7.8H6.8a2 2 0 0 1-1.7-.8Z\" fill=\"#C98B57\" stroke=\"#7E5230\" stroke-width=\"1.5\"/>",
        "boot": "<path d=\"M7.5 3.5h5v7.2l6.3 3a2.5 2.5 0 0 1 1.4 2.2V19.5h-15V4.5a1 1 0 0 1 1-1Z\" fill=\"#C98B57\" stroke=\"#7E5230\" stroke-width=\"1.5\"/><path d=\"M5.2 16h15v3.5h-15Z\" fill=\"#9AA5B4\" stroke=\"#5A6472\" stroke-width=\"1.2\"/><path d=\"M12.5 8h-3M12.5 10.7h-3\" fill=\"none\" stroke=\"#FFFFFF\" stroke-width=\"1.5\"/>",
        "calendar": "<rect x=\"3.5\" y=\"5\" width=\"17\" height=\"15.5\" rx=\"2\" fill=\"#FFFFFF\" stroke=\"#7D8796\" stroke-width=\"1.5\"/><path d=\"M3.5 7a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v3h-17Z\" fill=\"#FF5F5F\" stroke=\"#B83232\" stroke-width=\"1.2\"/><path d=\"M8 3v4M16 3v4\" fill=\"none\" stroke=\"#5A6472\" stroke-width=\"2\"/><path d=\"M7.5 13.5h.01M12 13.5h.01M16.5 13.5h.01M7.5 17h.01M12 17h.01\" fill=\"none\" stroke=\"#5A6472\" stroke-width=\"2.2\"/>",
        "reset": "<path d=\"M4 12a8 8 0 1 0 2.4-5.7\" fill=\"none\" stroke=\"#F0862A\" stroke-width=\"2.8\"/><path d=\"M3.2 3.5v5.6h5.6Z\" fill=\"#FF9A3D\" stroke=\"#C9620F\" stroke-width=\"1.2\"/>",
        "dot": "<circle cx=\"12\" cy=\"12\" r=\"5.5\" fill=\"currentColor\"/>",
        "sparkle": "<path d=\"M11 2.5l2 5.6 5.6 2-5.6 2L11 17.7l-2-5.6-5.6-2 5.6-2Z\" fill=\"#FFCD3C\" stroke=\"#C98F00\" stroke-width=\"1.5\"/><path d=\"M18.5 14.5l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9Z\" fill=\"#B07CFF\" stroke=\"#6F3FD0\" stroke-width=\"1\"/>",
        "edit": "<path d=\"M16.6 3.6a2.2 2.2 0 0 1 3.1 3.1L8.2 18.2 4 19.5l1.3-4.2Z\" fill=\"#FF9A3D\" stroke=\"#C9620F\" stroke-width=\"1.5\"/><path d=\"M14.6 5.6l3.1 3.1\" fill=\"none\" stroke=\"#C9620F\" stroke-width=\"1.4\"/>",
        "moon": "<path d=\"M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z\" fill=\"#FFD45C\" stroke=\"#C98F00\" stroke-width=\"1.5\"/><circle cx=\"17.5\" cy=\"5.5\" r=\"1\" fill=\"#FFFFFF\"/>",
        "map": "<path d=\"M3 6.5l6-2.5 6 2.5 6-2.5v13.5l-6 2.5-6-2.5-6 2.5Z\" fill=\"#9BE09B\" stroke=\"#1E9055\" stroke-width=\"1.5\"/><path d=\"M9 4v13.5l6 2.5V6.5Z\" fill=\"#BDE3FF\" stroke=\"#1F6FC5\" stroke-width=\"1.2\"/><path d=\"M5 12c1-.8 2-1 3 0M16.5 9.5c1-.6 2-.6 3 0\" fill=\"none\" stroke=\"#7E5230\" stroke-width=\"1.4\"/>",
        "layout": "<rect x=\"3.5\" y=\"3.5\" width=\"17\" height=\"17\" rx=\"2\" fill=\"#FFFFFF\" stroke=\"#7D8796\" stroke-width=\"1.5\"/><path d=\"M3.5 5.5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2V9h-17Z\" fill=\"#5BB3FF\" stroke=\"#1F6FC5\" stroke-width=\"1.2\"/><rect x=\"11.5\" y=\"11.5\" width=\"6.5\" height=\"6.5\" rx=\"1\" fill=\"#45D483\"/>"
    };
    // emoji (sin el "variation selector" FE0F) -> "nombre|clase de color"
    const EMOJI_ICONS = {
        "⚠": "warning",
        "💾": "save",
        "✅": "check-circle",
        "🚪": "door",
        "🌍": "globe",
        "🌐": "globe",
        "✕": "x",
        "❌": "x-circle",
        "✖": "x",
        "🚫": "ban",
        "🧘": "lotus",
        "🖼": "gallery",
        "✔": "check",
        "✓": "check",
        "☑": "check-square",
        "🎨": "palette",
        "🚀": "rocket",
        "🛠": "wrench",
        "🔧": "wrench",
        "🌸": "palette",
        "⭐": "star-fill",
        "★": "star-fill",
        "☆": "star",
        "🖌": "brush",
        "📄": "file",
        "📦": "box",
        "➕": "plus",
        "📰": "news",
        "📥": "download",
        "📤": "upload",
        "🗑": "trash",
        "🔔": "bell",
        "🔕": "bell-off",
        "⚡": "bolt",
        "📺": "monitor",
        "🔊": "speaker",
        "⌨": "keyboard",
        "⛶": "fullscreen",
        "⬅": "arrow-left",
        "➡": "arrow-right",
        "🎉": "party",
        "📷": "camera",
        "🎞": "film",
        "↔": "mirror",
        "⇋": "mirror",
        "📁": "folder",
        "📂": "folder-open",
        "🎒": "backpack",
        "🏘": "houses",
        "🐷": "pig",
        "🔄": "rotate",
        "💥": "boom",
        "↶": "undo",
        "↷": "redo",
        "✂": "cut",
        "📋": "paste",
        "⏳": "hourglass",
        "💬": "chat",
        "👥": "users",
        "🔥": "fire",
        "♨": "steam",
        "🕘": "clock",
        "🕒": "clock",
        "⏱": "clock",
        "▼": "chevron-down",
        "▾": "chevron-down",
        "▴": "chevron-up",
        "▲": "chevron-up",
        "▸": "chevron-right",
        "▶": "chevron-right",
        "◀": "chevron-left",
        "⚙": "gear",
        "✏": "edit",
        "✎": "edit",
        "👁": "eye",
        "😀": "smile",
        "📍": "pin",
        "📌": "pushpin",
        "🎮": "gamepad",
        "📭": "inbox",
        "🎯": "target",
        "🏷": "tag",
        "↓": "arrow-down",
        "👾": "users",
        "ℹ": "info",
        "🔋": "battery",
        "🔒": "lock",
        "➤": "send",
        "↩": "reply",
        "👆": "move",
        "🧼": "eraser",
        "🪣": "bucket",
        "🔳": "select",
        "🪄": "magic",
        "➰": "lasso",
        "🚃": "cart",
        "🛶": "boat",
        "🥾": "boot",
        "🔴": "dot|c-bad",
        "🟢": "dot|c-ok",
        "📆": "calendar",
        "📅": "calendar",
        "✨": "sparkle",
        "↺": "reset",
        "●": "dot",
        "📢": "publish",
        "🌦": "weather",
        "⚫": "dot",
        "⚪": "dot",
        "🔵": "dot|c-blue",
        "🪟": "monitor",
        "🌑": "moon",
        "🗺": "map"
    };
    // Dentro de esto NO se cambia nada: mensajes y reacciones de los chats, selector de emojis, notas de novedades, nombres que escribe la gente
    const SKIP = '.dc-msg-text, .dc-chat-sub, .dc-reply-text, .dc-bar-quote, .mc-text, .mc-quote-text, .mc-bar-sub, #chat-messages, ' +
        '.news-card, .mp-toast-body, .dc-msg-author, .dc-chat-name, .dc-header-name, .dc-userpanel-name, .mc-name, .mc-who, .sg-name, .sg-author, .struct-name, ' +
        '[class*="react"], [class*="dc-emoji"], .mc-emoji, [data-no-icons], textarea, input, script, style, svg, canvas, code, pre';
    const EMOJI_RE = /(?:\uD83C[\uDDE6-\uDDFF]){2}|(?:[←-⇿⌀-⏿■-◿☀-➿⬀-⯿]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDD00-\uDFFF])️?(?:‍(?:[☀-➿]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDD00-\uDFFF])️?)*/g;
    const HAS_RE = new RegExp(EMOJI_RE.source);

    function symbolsHTML() {
        let out = '';
        Object.keys(ICONS).forEach(function (k) {
            out += '<symbol id="ic-' + k + '" viewBox="0 0 24 24"><g stroke-linecap="round" stroke-linejoin="round">' + ICONS[k] + '</g></symbol>';
        });
        return out;
    }
    function build() {
        if (document.getElementById('mbw-icon-sprite')) return;
        const holder = document.createElement('div');
        holder.innerHTML = '<svg id="mbw-icon-sprite" xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">' + symbolsHTML() + '</svg>';
        document.body.insertBefore(holder.firstChild, document.body.firstChild);
    }
    function iconFor(emoji) {
        const key = emoji.replace(/️/g, '');
        return EMOJI_ICONS[key] || null;
    }
    function svgEl(spec) {
        const parts = spec.split('|');
        const NS = 'http://www.w3.org/2000/svg';
        const s = document.createElementNS(NS, 'svg');
        s.setAttribute('class', 'mbw-ic mbw-ic-auto' + (parts[1] ? ' ' + parts[1] : ''));
        s.setAttribute('aria-hidden', 'true');
        s.setAttribute('focusable', 'false');
        const u = document.createElementNS(NS, 'use');
        u.setAttribute('href', '#ic-' + parts[0]);
        s.appendChild(u);
        return s;
    }
    window.mbwIcon = function (name, cls) {
        return '<svg class="mbw-ic' + (cls ? ' ' + cls : '') + '" aria-hidden="true" focusable="false"><use href="#ic-' + name + '"></use></svg>';
    };

    // Para dibujar un ícono en un lienzo (canvas): los mismos trazos y colores, del tamaño que se pida
    const pathCache = {};
    function pathsOf(name) {
        if (pathCache[name]) return pathCache[name];
        const out = [];
        try {
            const doc = new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg">' + (ICONS[name] || '') + '</svg>', 'image/svg+xml');
            doc.documentElement.querySelectorAll('path, circle, rect, ellipse').forEach(function (e) {
                const n = (k) => Number(e.getAttribute(k)) || 0;
                let p;
                if (e.tagName === 'path') p = new Path2D(e.getAttribute('d'));
                else if (e.tagName === 'circle') { p = new Path2D(); p.arc(n('cx'), n('cy'), n('r'), 0, Math.PI * 2); }
                else if (e.tagName === 'ellipse') { p = new Path2D(); p.ellipse(n('cx'), n('cy'), n('rx'), n('ry'), 0, 0, Math.PI * 2); }
                else { p = new Path2D(); const x = n('x'), y = n('y'), w = n('width'), h = n('height'), r = Math.min(n('rx'), w / 2, h / 2); if (p.roundRect) p.roundRect(x, y, w, h, r); else p.rect(x, y, w, h); }
                out.push({ p: p, fill: e.getAttribute('fill') || 'none', stroke: e.getAttribute('stroke') || 'none', sw: Number(e.getAttribute('stroke-width')) || 2,
                    fo: e.getAttribute('fill-opacity') != null ? Number(e.getAttribute('fill-opacity')) : 1, dash: e.getAttribute('stroke-dasharray') });
            });
        } catch (e) { /* sin DOMParser / Path2D: no se dibuja */ }
        return (pathCache[name] = out);
    }
    window.mbwDrawIcon = function (ctx, name, cx, cy, size, color) {
        const list = pathsOf(name);
        if (!list.length) return false;
        ctx.save();
        ctx.translate(cx - size / 2, cy - size / 2);
        ctx.scale(size / 24, size / 24);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const col = (c) => (c === 'currentColor' ? (color || '#ffffff') : c);
        list.forEach(function (o) {
            if (o.fill !== 'none') { ctx.globalAlpha = o.fo; ctx.fillStyle = col(o.fill); ctx.fill(o.p); ctx.globalAlpha = 1; }
            if (o.stroke !== 'none') { ctx.strokeStyle = col(o.stroke); ctx.lineWidth = o.sw; ctx.setLineDash(o.dash ? o.dash.split(/[ ,]+/).map(Number) : []); ctx.stroke(o.p); }
        });
        ctx.restore();
        return true;
    };
    window.MBW_ICONS = ICONS;
    window.MBW_EMOJI_ICONS = EMOJI_ICONS;

    function skipped(node) {
        const el = node.nodeType === 1 ? node : node.parentElement;
        return !el || !!el.closest(SKIP);
    }
    // Quita los emojis (y el espacio que los sigue) de un texto: para <option> y title
    function strip(text, leadingOnly) {
        if (leadingOnly) return text.replace(new RegExp('^(?:\\s*(?:' + EMOJI_RE.source + '))+\\s*'), '');
        return text.replace(new RegExp('(?:' + EMOJI_RE.source + ')\\s?', 'g'), '').replace(/^\s+/, '');
    }
    function doText(tn) {
        const v = tn.nodeValue;
        if (!v || !HAS_RE.test(v)) return;
        const parent = tn.parentElement;
        if (!parent) return;
        if (parent.tagName === 'OPTION' || parent.tagName === 'TITLE') { const nv = strip(v, false); if (nv !== v) tn.nodeValue = nv; return; }
        if (skipped(tn)) return;
        EMOJI_RE.lastIndex = 0;
        let m, last = 0, changed = false;
        const frag = document.createDocumentFragment();
        while ((m = EMOJI_RE.exec(v))) {
            const spec = iconFor(m[0]);
            if (!spec) continue;
            if (m.index > last) frag.appendChild(document.createTextNode(v.slice(last, m.index)));
            frag.appendChild(svgEl(spec));
            last = m.index + m[0].length;
            changed = true;
        }
        if (!changed) return;
        if (last < v.length) frag.appendChild(document.createTextNode(v.slice(last)));
        parent.replaceChild(frag, tn);
    }
    function doAttrs(el) {
        ['title', 'placeholder', 'aria-label'].forEach(function (a) {
            const v = el.getAttribute && el.getAttribute(a);
            if (v && HAS_RE.test(v)) { const nv = strip(v, true); if (nv !== v) el.setAttribute(a, nv); }
        });
    }
    function scan(root) {
        if (!root) return;
        if (root.nodeType === 3) { doText(root); return; }
        if (root.nodeType !== 1 && root.nodeType !== 11) return;
        if (root.nodeType === 1) {
            if (root.closest && root.closest('svg')) return;
            doAttrs(root);
        }
        if (root.querySelectorAll) root.querySelectorAll('[title],[placeholder],[aria-label]').forEach(doAttrs);
        if (!HAS_RE.test(root.textContent || '')) return;
        const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const list = [];
        let n;
        while ((n = w.nextNode())) if (HAS_RE.test(n.nodeValue)) list.push(n);
        list.forEach(doText);
    }
    window.mbwIconize = scan;

    // lo que va apareciendo (ventanas nuevas, cambios de idioma, avisos...) se revisa en tandas
    let pending = new Set(), queued = false;
    function flush() {
        queued = false;
        const items = Array.from(pending); pending = new Set();
        items.forEach(function (n) { if (n.isConnected) scan(n); });
    }
    function queue(n) {
        pending.add(n);
        if (!queued) { queued = true; (window.requestAnimationFrame || setTimeout)(flush); }
    }
    function start() {
        build();
        if (window.MBW_NO_AUTO_ICONS) return;   // interruptor para apagar el cambio automático de emojis (lo usan las pruebas viejas)
        scan(document.body);
        const obs = new MutationObserver(function (recs) {
            for (let i = 0; i < recs.length; i++) {
                const r = recs[i];
                if (r.type === 'characterData') { if (HAS_RE.test(r.target.nodeValue || '')) queue(r.target); }
                else if (r.type === 'attributes') { if (HAS_RE.test(r.target.getAttribute(r.attributeName) || '')) doAttrs(r.target); }
                else for (let j = 0; j < r.addedNodes.length; j++) {
                    const a = r.addedNodes[j];
                    if (a.nodeType === 3) { if (HAS_RE.test(a.nodeValue || '')) queue(a); }
                    else if (a.nodeType === 1 && a.namespaceURI !== 'http://www.w3.org/2000/svg') queue(a);
                }
            }
        });
        obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title', 'placeholder', 'aria-label'] });
        window.mbwIconObserver = obs;
    }
    if (document.body) build();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
