export const COLS = { B: [1,15], I: [16,30], N: [31,45], G: [46,60], O: [61,75] };
export const TOTAL = 75;
export const PRICE = 1000;
export const DB_CARDS   = "bingo_cards";
export const DB_DRAWN   = "bingo_drawn";
export const DB_WINNERS = "bingo_winners";
export const DB_STATE   = "bingo_state";

export const GAMES = [
  { id: "j1",  name: "Juego 1",  color: "#FF0000" },
  { id: "j2",  name: "Juego 2",  color: "#00FFFF" },
  { id: "j3",  name: "Juego 3",  color: "#FFFF00" },
  { id: "j4",  name: "Juego 4",  color: "#7F00FF" },
  { id: "j5",  name: "Juego 5",  color: "#00FF00" },
  { id: "j6",  name: "Juego 6",  color: "#FF00FF" },
  { id: "j7",  name: "Juego 7",  color: "#FF7F00" },
  { id: "j8",  name: "Juego 8",  color: "#007FFF" },
  { id: "j9",  name: "Juego 9",  color: "#7FFF00" },
  { id: "j10", name: "Juego 10", color: "#FF007F" },
  { id: "j11", name: "Juego 11", color: "#0000FF" },
  { id: "j12", name: "Juego 12", color: "#00FF7F" },
];

export const PATTERNS = [
  { id: 'line_h',   name: 'Línea Horizontal', grid: [[1,1,1,1,1],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0]] },
  { id: 'line_v',   name: 'Línea Vertical',   grid: [[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0]] },
  { id: 'diagonal', name: 'Diagonal',          grid: [[1,0,0,0,0],[0,1,0,0,0],[0,0,1,0,0],[0,0,0,1,0],[0,0,0,0,1]] },
  { id: 'corners',  name: '4 Esquinas',        grid: [[1,0,0,0,1],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[1,0,0,0,1]] },
  { id: 'letter_x', name: 'Letra X',           grid: [[1,0,0,0,1],[0,1,0,1,0],[0,0,1,0,0],[0,1,0,1,0],[1,0,0,0,1]] },
  { id: 'letter_t', name: 'Letra T',           grid: [[1,1,1,1,1],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0]] },
  { id: 'letter_l', name: 'Letra L',           grid: [[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,1,1]] },
  { id: 'letter_c', name: 'Letra C',           grid: [[1,1,1,1,1],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,1,1]] },
  { id: 'cross',    name: 'Cruz (+)',           grid: [[0,0,1,0,0],[0,0,1,0,0],[1,1,1,1,1],[0,0,1,0,0],[0,0,1,0,0]] },
  { id: 'blackout', name: 'Cartón Lleno',      grid: [[1,1,1,1,1],[1,1,1,1,1],[1,1,1,1,1],[1,1,1,1,1],[1,1,1,1,1]] },
];

export const BINGO_LETTER_COLORS = ['#ef4444','#3b82f6','#f59e0b','#22c55e','#a855f7'];

export const TABS = ["🎟️ Cartones","📋 Información","🎱 Sorteo","🏆 Ganadores"];