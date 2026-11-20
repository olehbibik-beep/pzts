// Same language order as the editor: Czech, English, German, Russian.
window.goomUI=(cs,en,de,ru)=>({cs,en,de,ru}[document.documentElement.lang?.split('-')[0]]||cs);
