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

// Orientación: grid[row][col]
//   row 0 = fila superior, row 4 = fila inferior
//   col 0 = columna B (izquierda), col 4 = columna O (derecha)
//
// Cada patrón tiene:
//   grid      → patrón BINGO completo
//   binguito  → { name, grid } subconjunto para ganar el "Binguito"

export const PATTERNS = [
  // ── 1. Letra L ──────────────────────────────────────────────────────────────
  // X . . . .
  // X . . . .
  // X . . . .
  // X . . . .
  // X X X X X
  {
    id: 'letter_l',
    name: 'Letra L',
    grid: [
      [1,0,0,0,0],
      [1,0,0,0,0],
      [1,0,0,0,0],
      [1,0,0,0,0],
      [1,1,1,1,1],
    ],
    binguito: {
      name: 'Binguito — Base de la L',
      grid: [
        [0,0,0,0,0],
        [0,0,0,0,0],
        [0,0,0,0,0],
        [0,0,0,0,0],
        [1,1,1,1,1],
      ],
    },
  },

  // ── 2. Letra T ──────────────────────────────────────────────────────────────
  // X X X X X
  // . . X . .
  // . . X . .
  // . . X . .
  // . . X . .
  {
    id: 'letter_t',
    name: 'Letra T',
    grid: [
      [1,1,1,1,1],
      [0,0,1,0,0],
      [0,0,1,0,0],
      [0,0,1,0,0],
      [0,0,1,0,0],
    ],
    binguito: {
      name: 'Binguito — Barra Superior',
      grid: [
        [1,1,1,1,1],
        [0,0,0,0,0],
        [0,0,0,0,0],
        [0,0,0,0,0],
        [0,0,0,0,0],
      ],
    },
  },

  // ── 3. Letra C ──────────────────────────────────────────────────────────────
  // X X X X X
  // X . . . .
  // X . . . .
  // X . . . .
  // X X X X X
  {
    id: 'letter_c',
    name: 'Letra C',
    grid: [
      [1,1,1,1,1],
      [1,0,0,0,0],
      [1,0,0,0,0],
      [1,0,0,0,0],
      [1,1,1,1,1],
    ],
    binguito: {
      name: 'Binguito — Espalda Izquierda',
      grid: [
        [1,0,0,0,0],
        [1,0,0,0,0],
        [1,0,0,0,0],
        [1,0,0,0,0],
        [1,0,0,0,0],
      ],
    },
  },

  // ── 4. Letra X ──────────────────────────────────────────────────────────────
  // X . . . X
  // . X . X .
  // . . X . .
  // . X . X .
  // X . . . X
  {
    id: 'letter_x',
    name: 'Letra X',
    grid: [
      [1,0,0,0,1],
      [0,1,0,1,0],
      [0,0,1,0,0],
      [0,1,0,1,0],
      [1,0,0,0,1],
    ],
    binguito: {
      name: 'Binguito — Una Diagonal',
      grid: [
        [1,0,0,0,0],
        [0,1,0,0,0],
        [0,0,1,0,0],
        [0,0,0,1,0],
        [0,0,0,0,1],
      ],
    },
  },

  // ── 5. Cruz (+) ─────────────────────────────────────────────────────────────
  // . . X . .
  // . . X . .
  // X X X X X
  // . . X . .
  // . . X . .
  {
    id: 'cross',
    name: 'Cruz (+)',
    grid: [
      [0,0,1,0,0],
      [0,0,1,0,0],
      [1,1,1,1,1],
      [0,0,1,0,0],
      [0,0,1,0,0],
    ],
    binguito: {
      name: 'Binguito — Palo Vertical',
      grid: [
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,0,1,0,0],
      ],
    },
  },

  // ── 6. Diagonal ─────────────────────────────────────────────────────────────
  // X . . . .
  // . X . . .
  // . . X . .
  // . . . X .
  // . . . . X
  {
    id: 'diagonal',
    name: 'Diagonal',
    grid: [
      [1,0,0,0,0],
      [0,1,0,0,0],
      [0,0,1,0,0],
      [0,0,0,1,0],
      [0,0,0,0,1],
    ],
    binguito: {
      name: 'Binguito — Primeras 2',
      grid: [
        [1,0,0,0,0],
        [0,1,0,0,0],
        [0,0,0,0,0],
        [0,0,0,0,0],
        [0,0,0,0,0],
      ],
    },
  },

  // ── 7. 4 Esquinas ───────────────────────────────────────────────────────────
  // X . . . X
  // . . . . .
  // . . . . .
  // . . . . .
  // X . . . X
  {
    id: 'corners',
    name: '4 Esquinas',
    grid: [
      [1,0,0,0,1],
      [0,0,0,0,0],
      [0,0,0,0,0],
      [0,0,0,0,0],
      [1,0,0,0,1],
    ],
    binguito: {
      name: 'Binguito — 2 Esquinas Arriba',
      grid: [
        [1,0,0,0,1],
        [0,0,0,0,0],
        [0,0,0,0,0],
        [0,0,0,0,0],
        [0,0,0,0,0],
      ],
    },
  },

  // ── 8. Línea Horizontal ─────────────────────────────────────────────────────
  // X X X X X   (fila 0 = primera fila, columnas B I N G O)
  // . . . . .
  // . . . . .
  // . . . . .
  // . . . . .
  {
    id: 'line_h',
    name: 'Línea Horizontal',
    grid: [
      [1,1,1,1,1],
      [0,0,0,0,0],
      [0,0,0,0,0],
      [0,0,0,0,0],
      [0,0,0,0,0],
    ],
    binguito: {
      name: 'Binguito — Últimos 2',
      // Los 2 últimos de esa fila horizontal: col 3 (G) y col 4 (O)
      grid: [
        [0,0,0,1,1],
        [0,0,0,0,0],
        [0,0,0,0,0],
        [0,0,0,0,0],
        [0,0,0,0,0],
      ],
    },
  },

  // ── 9. Línea Vertical ───────────────────────────────────────────────────────
  // X . . . .
  // X . . . .
  // X . . . .
  // X . . . .
  // X . . . .
  {
    id: 'line_v',
    name: 'Línea Vertical',
    grid: [
      [1,0,0,0,0],
      [1,0,0,0,0],
      [1,0,0,0,0],
      [1,0,0,0,0],
      [1,0,0,0,0],
    ],
    binguito: {
      name: 'Binguito — Primeros 2',
      // Los 2 primeros de esa columna vertical: fila 0 y fila 1
      grid: [
        [1,0,0,0,0],
        [1,0,0,0,0],
        [0,0,0,0,0],
        [0,0,0,0,0],
        [0,0,0,0,0],
      ],
    },
  },
];

export const BINGO_LETTER_COLORS = ['#ef4444','#3b82f6','#f59e0b','#22c55e','#a855f7'];

export const TABS = ["🎟️ Cartones","📋 Información","🎱 Sorteo","🏆 Ganadores"];