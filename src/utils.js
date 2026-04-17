import { COLS } from "./constants/index.js";
export function pad(n) { return String(n).padStart(3, "0"); }

export function getTextColor(hexColor) {
  const hex = hexColor.replace("#","");
  const r = parseInt(hex.substring(0,2),16);
  const g = parseInt(hex.substring(2,4),16);
  const b = parseInt(hex.substring(4,6),16);
  const brightness = (r*299 + g*587 + b*114) / 1000;
  return brightness > 128 ? "#000" : "#fff";
}

export function getLetterForNum(n) {
  for (const [l,[min,max]] of Object.entries(COLS)) if (n>=min&&n<=max) return l;
  return "";
}

export function generateCardGrid() {
  const grid = Object.entries(COLS).map(([,[min,max]]) => {
    const pool = Array.from({length:max-min+1},(_,i)=>i+min);
    const picked = [];
    while (picked.length<5) { const idx=Math.floor(Math.random()*pool.length); picked.push(pool.splice(idx,1)[0]); }
    return picked;
  });
  grid[2][2] = "FREE"; return grid;
}

// Verifica si un cartón cumple un patrón dado (bingo o binguito).
// patternGrid es un grid[row][col] con 1 en las celdas requeridas.
// card.grid es grid[col][row] (orientación del cartón).
function _checkGrid(card, drawn, patternGrid) {
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      if (!patternGrid[row][col]) continue;
      const col_arr = card.grid[col];
      if (!col_arr || col_arr.length < 5) return false;
      const val = col_arr[row];
      if (val === "FREE") continue;
      if (!drawn.includes(val)) return false;
    }
  }
  return true;
}

export function checkPattern(card, drawn, pattern) {
  return _checkGrid(card, drawn, pattern.grid);
}

// Verifica si el cartón cumple el subpatrón "binguito" del patrón activo.
// Devuelve false si el patrón no tiene binguito definido.
export function checkBinguito(card, drawn, pattern) {
  if (!pattern.binguito) return false;
  return _checkGrid(card, drawn, pattern.binguito.grid);
}