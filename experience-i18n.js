// Shared UI phrases in five languages.
window.goomUI=(cs,en,de,ru,pl)=>document.documentElement.lang?.split('-')[0]==='pl'?(pl||window.goomPolish?.(en)||en):({cs,en,de,ru}[document.documentElement.lang?.split('-')[0]]||cs);
