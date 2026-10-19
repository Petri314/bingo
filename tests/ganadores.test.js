// Tests del registro de ganadores (bug real del evento de abril: salían 2 a 4
// ganadores porque varios cartones completaban el mismo patrón y cada toque del
// admin, con el estado de React atrasado, anotaba uno más).
//
// Se ejecutan con:  npm test
import test from "node:test";
import assert from "node:assert/strict";
import { checkPattern, checkBinguito, ganadoEnEsteSorteo, resolverRegistro, claveGanador } from "../src/utils.js";
import { PATTERNS } from "../src/constants/index.js";

const ESQUINAS = PATTERNS.find(p => p.id === "corners");
const LINEA_H  = PATTERNS.find(p => p.id === "line_h");
assert.ok(ESQUINAS && LINEA_H, "los patrones de prueba deben existir");

// Cartón k: cumple "4 esquinas" con los números 1+k, 5+k, 61+k, 65+k
// y "Línea Horizontal" con 1+k, 16+k, 31+k, 46+k, 61+k
function carton(k, gameId = "j1") {
  return {
    id: k, cardNum: String(k + 1).padStart(3, "0"), gameId, paid: true, owner: `Persona ${k + 1}`,
    grid: [
      [1 + k, 2 + k, 3 + k, 4 + k, 5 + k],           // B
      [16 + k, 17 + k, 18 + k, 19 + k, 20 + k],      // I
      [31 + k, 32 + k, "FREE", 34 + k, 35 + k],      // N
      [46 + k, 47 + k, 48 + k, 49 + k, 50 + k],      // G
      [61 + k, 62 + k, 63 + k, 64 + k, 65 + k],      // O
    ],
  };
}
const CUATRO_CARTONES = [0, 1, 2, 3].map(k => carton(k));

// Números que completan las 4 esquinas de los 4 cartones (16 números):
// el cartón 001 las completa con el número 65 y los otros tres con 66, 67 y 68.
const ESQUINAS_16 = [1, 2, 3, 4, 5, 6, 7, 8, 61, 62, 63, 64, 65, 66, 67, 68];
// ...y estos tres completan además la Línea Horizontal del cartón 001
const CON_LINEA = [...ESQUINAS_16, 16, 31, 46];

// Reproduce el bucle de toggleNumber: recorre los cartones vendidos y anota el primero
// que cumple el patrón. A propósito NO usa la guarda `alreadyWon`: es el caso peor, el
// admin cantando números seguidos con el estado atrasado (lo que pasó en el evento).
function cantar(nodo, cards, dibujados, pattern, { gameId = "j1", roundId = 1000 } = {}) {
  for (const card of cards) {
    if (!checkPattern(card, dibujados, pattern)) continue;
    // La misma clave que usa la app: un juego tiene un solo ganador por ronda.
    const clave = claveGanador(gameId, roundId);
    const registro = { id: clave, gameId, card: card.cardNum, name: card.owner, patternId: pattern.id, roundId, drawn: [...dibujados] };
    const { previo, siguiente } = resolverRegistro(nodo, clave, registro, { gameId, roundId });
    if (previo) return { estado: "previo", previo, nodo };
    return { estado: "nuevo", registro, nodo: siguiente };
  }
  return { estado: "ninguno", nodo };
}

// Canta un sorteo completo, acumulando los ganadores en el nodo
function cantarSorteo(cards, numeros, pattern, { nodo = {}, gameId = "j1", roundId = 1000 } = {}) {
  const dibujados = [];
  const eventos = [];
  for (const n of numeros) {
    dibujados.push(n);
    const r = cantar(nodo, cards, dibujados, pattern, { gameId, roundId });
    nodo = r.nodo;
    if (r.estado !== "ninguno") eventos.push({ numero: n, ...r });
  }
  return { nodo, eventos, dibujados };
}

test("un solo ganador aunque 4 cartones completen el mismo patrón", () => {
  const { nodo, eventos } = cantarSorteo(CUATRO_CARTONES, ESQUINAS_16, ESQUINAS);

  assert.equal(eventos.filter(e => e.estado === "nuevo").length, 1, "solo se anota un ganador");
  assert.equal(eventos.filter(e => e.estado === "previo").length, 3, "los otros 3 intentos quedan bloqueados");
  assert.deepEqual(Object.keys(nodo), ["j1_r1000"], "gana el primer cartón que cumplió el patrón");
  assert.equal(eventos[0].numero, 65, "gana con el último número que le faltaba");
});

test("el criterio anterior (dedup solo por cartón) anotaba los 4: así se producía el bug", () => {
  const viejo = {};
  for (let i = 0; i < ESQUINAS_16.length; i++) {
    const dibujados = ESQUINAS_16.slice(0, i + 1);
    for (const card of CUATRO_CARTONES) {
      if (!checkPattern(card, dibujados, ESQUINAS)) continue;
      const clave = `j1_${card.cardNum}`;
      if (!viejo[clave]) viejo[clave] = { card: card.cardNum };
    }
  }
  assert.equal(Object.keys(viejo).length, 4, "el criterio viejo dejaba 4 ganadores del mismo patrón");
});

test("misma ronda: no hay segundo ganador; ronda nueva: sí se puede volver a ganar", () => {
  const ronda1 = cantarSorteo(CUATRO_CARTONES, ESQUINAS_16, ESQUINAS);
  assert.equal(Object.keys(ronda1.nodo).length, 1);

  // Mismos números y misma ronda (por ejemplo, el admin vuelve a pasar por el cartón 002)
  const repetido = cantar(ronda1.nodo, CUATRO_CARTONES, ESQUINAS_16, ESQUINAS, { roundId: 1000 });
  assert.equal(repetido.estado, "previo", "en la misma ronda sigue bloqueado");
  assert.equal(Object.keys(repetido.nodo).length, 1);

  // Reiniciar el sorteo = roundId nuevo (lo escribe el botón Reiniciar)
  const ronda2 = cantarSorteo(CUATRO_CARTONES, ESQUINAS_16, ESQUINAS, { nodo: ronda1.nodo, roundId: 2000 });
  assert.equal(ronda2.eventos.filter(e => e.estado === "nuevo").length, 1, "en ronda nueva sí gana");
  assert.equal(Object.keys(ronda2.nodo).length, 2, "el historial conserva el ganador de cada ronda");
});

test("ganadores de un evento anterior (sin roundId) no bloquean", () => {
  const deAbril = [{ gameId: "j1", card: "007", patternId: "corners", drawn: [1, 5, 61, 65] }];
  assert.equal(ganadoEnEsteSorteo(deAbril, { gameId: "j1", roundId: 5000 }), null,
    "un ganador viejo sin roundId no bloquea la ronda en curso");
  assert.equal(ganadoEnEsteSorteo(deAbril, { gameId: "j1", roundId: undefined }), null,
    "sin roundId tampoco se bloquea nada");
  assert.ok(ganadoEnEsteSorteo([{ gameId: "j1", card: "007", roundId: 5000 }], { gameId: "j1", roundId: 5000 }),
    "pero sí bloquea uno de la misma ronda");
});

test("un juego = un ganador: cambiar el patrón no habilita otro", () => {
  const ronda = cantarSorteo(CUATRO_CARTONES, CON_LINEA, ESQUINAS);
  assert.deepEqual(Object.keys(ronda.nodo), ["j1_r1000"], "gana 4 esquinas");

  // Con los mismos números, otro cartón cumple Línea Horizontal, pero el juego ya tiene ganador
  const conLinea = cantar(ronda.nodo, CUATRO_CARTONES, ronda.dibujados, LINEA_H, { roundId: 1000 });
  assert.equal(conLinea.estado, "previo", "el juego ya tiene ganador en esta ronda");
  assert.equal(Object.keys(conLinea.nodo).length, 1, "no se agrega un segundo ganador");
});

test("cada juego tiene su propio ganador", () => {
  const j1 = [carton(0, "j1"), carton(1, "j1")];
  const j2 = [carton(0, "j2"), carton(1, "j2")];
  const ronda1 = cantarSorteo(j1, ESQUINAS_16, ESQUINAS, { gameId: "j1" });
  const ronda2 = cantarSorteo(j2, ESQUINAS_16, ESQUINAS, { nodo: ronda1.nodo, gameId: "j2" });
  assert.deepEqual(Object.keys(ronda2.nodo).sort(), ["j1_r1000", "j2_r1000"]);
});

test("si el admin borra el ganador equivocado, el correcto se puede anotar", () => {
  const cards = [carton(0), carton(1), carton(2)];
  const ronda = cantarSorteo(cards, ESQUINAS_16, ESQUINAS);
  assert.deepEqual(Object.keys(ronda.nodo), ["j1_r1000"], "se anota el primero que cumple el patrón");

  // El admin corrige: borra ese ganador desde la pestaña Ganadores...
  const sinElPrimero = { ...ronda.nodo };
  delete sinElPrimero["j1_r1000"];
  // ...y vuelve a cantar un número: ahora se detecta el cartón que realmente ganó
  const corregido = cantar(sinElPrimero, [carton(1)], ESQUINAS_16, ESQUINAS);
  assert.equal(corregido.estado, "nuevo");
  assert.deepEqual(Object.keys(corregido.nodo), ["j1_r1000"]);
  assert.equal(corregido.registro.card, "002");
});

test("la clave de ganador es por juego y ronda, no por cartón", () => {
  const k = claveGanador("j1", 1000);
  assert.equal(k, claveGanador("j1", 1000), "misma ronda y juego → misma clave");
  assert.notEqual(k, claveGanador("j1", 2000), "otra ronda → otra clave");
  assert.notEqual(k, claveGanador("j2", 1000), "otro juego → otra clave");

  // Dos cartones distintos que cumplen el patrón a la vez intentan escribir la misma
  // clave: el segundo encuentra al primero y no se guarda.
  const primero = { gameId:"j1", card:"001", roundId:1000 };
  const segundo = { gameId:"j1", card:"002", roundId:1000 };
  const { previo, siguiente } = resolverRegistro({ [k]: primero }, k, segundo,
    { gameId:"j1", roundId:1000 });
  assert.equal(previo.card, "001");
  assert.equal(siguiente, null, "no se agrega un segundo ganador");
});

test("el binguito usa la misma protección (un solo binguito por ronda)", () => {
  let nodo = {};
  const dibujados = [];
  let nuevos = 0;
  for (const n of ESQUINAS_16) {
    dibujados.push(n);
    for (const card of CUATRO_CARTONES) {
      if (!checkBinguito(card, dibujados, ESQUINAS)) continue;
      const clave = claveGanador("j1", 1000);
      const registro = { id: clave, gameId: "j1", card: card.cardNum, patternId: ESQUINAS.id, roundId: 1000, drawn: [...dibujados] };
      const { previo, siguiente } = resolverRegistro(nodo, clave, registro, { gameId: "j1", roundId: 1000 });
      if (!previo) { nodo = siguiente; nuevos++; }
    }
  }
  assert.equal(nuevos, 1, "solo un binguito en la ronda");
  assert.equal(Object.keys(nodo).length, 1);
});
