import React from "react";
import { useState, useEffect } from "react";
import { db, PIN } from "./firebase.js";
import { ref, onValue, set, remove, update } from "firebase/database";

const COLS = { B: [1,15], I: [16,30], N: [31,45], G: [46,60], O: [61,75] };
const TOTAL = 75; const PRICE = 1000;
const DB_CARDS = "bingo_cards"; const DB_DRAWN = "bingo_drawn"; const DB_WINNERS = "bingo_winners";

const GAMES = [
  { id: "j1", name: "Juego 1", color: "#ef4444" },
  { id: "j2", name: "Juego 2", color: "#3b82f6" },
  { id: "j3", name: "Juego 3", color: "#22c55e" },
  { id: "j4", name: "Juego 4", color: "#f59e0b" },
  { id: "j5", name: "Juego 5", color: "#a855f7" },
  { id: "j6", name: "Juego 6", color: "#ec4899" },
  { id: "j7", name: "Juego 7", color: "#14b8a6" },
  { id: "j8", name: "Juego 8", color: "#f97316" },
];

const PATTERNS = [
  { id: 'line_h', name: 'Línea Horizontal', grid: [[1,1,1,1,1],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0]] },
  { id: 'line_v', name: 'Línea Vertical', grid: [[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0]] },
  { id: 'diagonal', name: 'Diagonal', grid: [[1,0,0,0,0],[0,1,0,0,0],[0,0,1,0,0],[0,0,0,1,0],[0,0,0,0,1]] },
  { id: 'corners', name: '4 Esquinas', grid: [[1,0,0,0,1],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[1,0,0,0,1]] },
  { id: 'letter_x', name: 'Letra X', grid: [[1,0,0,0,1],[0,1,0,1,0],[0,0,1,0,0],[0,1,0,1,0],[1,0,0,0,1]] },
  { id: 'letter_t', name: 'Letra T', grid: [[1,1,1,1,1],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0]] },
  { id: 'letter_l', name: 'Letra L', grid: [[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,1,1]] },
  { id: 'letter_c', name: 'Letra C', grid: [[1,1,1,1,1],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,1,1]] },
  { id: 'cross', name: 'Cruz (+)', grid: [[0,0,1,0,0],[0,0,1,0,0],[1,1,1,1,1],[0,0,1,0,0],[0,0,1,0,0]] },
  { id: 'blackout', name: 'Cartón Lleno', grid: [[1,1,1,1,1],[1,1,1,1,1],[1,1,1,1,1],[1,1,1,1,1],[1,1,1,1,1]] }
];

function pad(n) { return String(n).padStart(3, "0"); }
function getLetterForNum(n) { for (const [l, [min, max]] of Object.entries(COLS)) if (n >= min && n <= max) return l; return ""; }
function generateCardGrid() {
  const grid = Object.entries(COLS).map(([, [min, max]]) => { const pool = Array.from({ length: max - min + 1 }, (_, i) => i + min); const picked = []; while (picked.length < 5) { const idx = Math.floor(Math.random() * pool.length); picked.push(pool.splice(idx, 1)[0]); } return picked; });
  grid[2][2] = "FREE"; return grid;
}

const TABS = ["🎟️ Cartones", "📋 Asistentes", "🎱 Sorteo", "🏆 Ganadores"];
const inpS = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 12px", color: "#334155", fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "sans-serif" };
const btnS = (color, extra = {}) => ({ background: color, border: "none", borderRadius: 8, padding: "9px 15px", fontWeight: 700, fontSize: 14, cursor: "pointer", color: "#fff", fontFamily: "sans-serif", whiteSpace: "nowrap", ...extra });

function CardGrid({ card, drawn }) {
  const gameColor = GAMES.find(g => g.id === card.gameId)?.color || "#64748b";
  return (<div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 5, maxWidth: 260, margin: "0 auto" }}>{Object.keys(COLS).map(l => (<div key={l} style={{ background: gameColor, borderRadius: 6, textAlign: "center", padding: "6px 0", fontWeight: 800, fontSize: 16, color: "#fff", opacity: 0.9 }}>{l}</div>))}{card.grid[0].map((_, row) => card.grid.map((col, colIdx) => { const val = col[row]; const isFree = val === "FREE"; const isOut = !isFree && drawn.includes(val); return (<div key={`${colIdx}-${row}`} style={{ background: isFree ? "#e0ded8" : isOut ? gameColor : "#f8fafc", borderRadius: 6, padding: "2px", textAlign: "center", fontSize: isFree ? 9 : 14, fontWeight: 700, color: isFree ? "#000" : isOut ? "#fff" : "#64748b", border: "1px solid #e2e8f0" }}>{isFree ? "👁️" : val}</div>); }))}</div>);
}

export default function BingoAdmin() {
  const [tab, setTab] = useState(2);
  const [cards, setCards] = useState([]);
  const [drawn, setDrawn] = useState([]);
  const [lastDrawn, setLastDrawn] = useState(null);
  const [winners, setWinners] = useState([]);
  const [activePattern, setActivePattern] = useState(PATTERNS[0]);
  
  const [activeGame, setActiveGame] = useState(GAMES[0]);
  const [genQty, setGenQty] = useState("");
  const [newOwner, setNewOwner] = useState("");
  const [newQty, setNewQty] = useState("1");
  
  const [search, setSearch] = useState("");
  const [selectedCard, setSelectedCard] = useState(null);
  const [winnerName, setWinnerName] = useState("");
  const [winnerCard, setWinnerCard] = useState("");
  const [toast, setToast] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(false);

  const handleLogin = () => {
    if (pwInput === PIN) {
      setIsAdmin(true); setShowLogin(false); setPwInput(""); setPwError(false);
    } else {
      setPwError(true); setTimeout(() => setPwError(false), 1500);
    }
  };

  const handleLogout = () => { setIsAdmin(false); };
  const showToast = (msg, type = "ok") => { setToast({ msg, type }); setTimeout(() => setToast(null), 2500); };

  const speakNumber = (num) => {
    if (isMuted || !num) return;
    window.speechSynthesis.cancel();
    const letter = getLetterForNum(num);
    const utterance = new SpeechSynthesisUtterance(`${letter}, ${num}`);
    utterance.lang = 'es-ES'; utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    const uC = onValue(ref(db, DB_CARDS), s => { const v = s.val(); setCards(v ? Object.values(v).sort((a,b) => a.id - b.id) : []); });
    const uD = onValue(ref(db, DB_DRAWN), s => { const v = s.val(); if(v){const n=Object.values(v); setDrawn(n); setLastDrawn(n.at(-1)??null);} else { setDrawn([]); setLastDrawn(null); } });
    const uW = onValue(ref(db, DB_WINNERS), s => { const v = s.val(); setWinners(v ? Object.values(v).sort((a,b) => a.ts - b.ts) : []); });
    return () => { uC(); uD(); uW(); };
  }, []);

  const generatePool = async () => {
    const qty = parseInt(genQty);
    if (!qty || qty < 1) return showToast("Ingresa una cantidad válida", "err");
    if (qty > 500) return showToast("Máximo 500 por vez", "err");
    const cardsInGame = cards.filter(c => c.gameId === activeGame.id);
    const startIdx = cardsInGame.length + 1;
    const updates = {};
    for (let i = 0; i < qty; i++) {
      const id = Date.now() + i;
      const cardNum = pad(startIdx + i);
      updates[`${DB_CARDS}/${id}`] = { id, cardNum, gameId: activeGame.id, gameName: activeGame.name, boleto: null, owner: null, paid: false, grid: generateCardGrid() };
    }
    await update(ref(db), updates);
    showToast(`✓ ${activeGame.name}: ${startIdx} al ${pad(startIdx + qty - 1)}`);
    setGenQty("");
  };

  const deleteUnsoldPool = async () => {
    if (!window.confirm(`¿Borrar todos los cartones SIN VENDER de ${activeGame.name}?`)) return;
    const unsold = cards.filter(c => !c.paid && c.gameId === activeGame.id);
    if (unsold.length === 0) return showToast("No hay cartones disponibles en este juego", "err");
    const updates = {};
    unsold.forEach(c => { updates[`${DB_CARDS}/${c.id}`] = null; });
    await update(ref(db), updates);
    showToast(`🗑️ ${unsold.length} cartones de ${activeGame.name} eliminados`);
  };

  const assignCard = async () => {
    const qty = parseInt(newQty) || 1;
    if (!newOwner.trim()) return showToast("Ingresa el nombre", "err");
    const available = cards.filter(c => !c.paid && c.gameId === activeGame.id);
    if (available.length < qty) return showToast(`Solo quedan ${available.length} cartones disponibles en ${activeGame.name}`, "err");
    const updates = {};
    const assignedCardNums = [];
    for (let i = 0; i < qty; i++) {
      const targetCard = available[i];
      updates[`${DB_CARDS}/${targetCard.id}`] = { ...targetCard, owner: newOwner.trim(), paid: true };
      assignedCardNums.push(targetCard.cardNum);
    }
    await update(ref(db), updates);
    showToast(`✓ ${activeGame.name}: ${assignedCardNums.join(', ')}`);
    setNewOwner(""); setNewQty("1");
  };

  const deleteCard = async (id) => { if(!isAdmin) return; await remove(ref(db, `${DB_CARDS}/${id}`)); if(selectedCard?.id===id) setSelectedCard(null); showToast("Eliminado"); };
  
  const toggleNumber = async (n) => {
    if(!isAdmin) return;
    const isMarking = !drawn.includes(n);
    const next = isMarking ? [...drawn, n] : drawn.filter(x => x !== n);
    await set(ref(db, DB_DRAWN), next.length ? Object.fromEntries(next.map((v,i) => [i,v])) : null);
    if (isMarking) speakNumber(n);
  };

  const undoLastDrawn = async () => {
    if (!isAdmin || drawn.length === 0) return;
    const next = drawn.slice(0, -1);
    await set(ref(db, DB_DRAWN), next.length ? Object.fromEntries(next.map((v,i) => [i,v])) : null);
    showToast("↩️ Último número deshecho");
  };

  const resetSort = async () => { await set(ref(db, DB_DRAWN), null); setConfirmReset(false); showToast("Sorteo reiniciado"); };

  const addWinner = async () => {
    if (!winnerName.trim() || !winnerCard.trim()) return showToast("Completa campos", "err");
    const ts = Date.now();
    await set(ref(db, `${DB_WINNERS}/${ts}`), { name: winnerName.trim(), card: winnerCard.trim(), time: new Date().toLocaleTimeString("es-CL"), ts });
    showToast("🏆 ¡Ganador registrado!"); setWinnerName(""); setWinnerCard("");
  };

  const deleteWinner = async (ts) => { await remove(ref(db, `${DB_WINNERS}/${ts}`)); };
  
  const handlePrintCards = () => {
    const cardsToPrint = cards.filter(c => c.grid);
    if (cardsToPrint.length === 0) return showToast("No hay cartones para imprimir", "err");
    const printWindow = window.open('', '_blank');
    let html = `<!DOCTYPE html><html><head>
    <title>Imprimir Cartones</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Stencil&family=Varsity&display=swap" rel="stylesheet">
    <style>
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      body { font-family: sans-serif; margin: 0; padding: 10mm; box-sizing: border-box; }
      .grid-container { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; }
      .card-box { width: 100mm; height: 130mm; border: 2px solid #000; padding: 3mm; border-radius: 8px; text-align: center; page-break-inside: avoid; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; position: relative; overflow: hidden; background: #fff; }
      .color-strip { height: 5mm; width: 100%; position: absolute; top: 0; left: 0; }
      .header-bingo { font-family: 'Varsity', sans-serif; font-size: 26px; margin-top: 6mm; margin-bottom: 2mm; letter-spacing: 4px; line-height: 1; }
      .game-info { font-family: 'Stencil', sans-serif; font-size: 13px; margin-top: 2mm; margin-bottom: 2mm; color: #000; border-top: 1px dashed #aaa; border-bottom: 1px dashed #aaa; padding: 2mm 0; }
      .bingo-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0px; height: 100mm; margin-top: 2mm; }
      .bingo-cell { display: flex; align-items: center; justify-content: center; border-radius: 2px; font-family: 'Stencil', sans-serif; font-size: 45px; font-weight: 400; border: 1px solid #bbb; height: 85%; width: 85%; margin: auto; }
      .footer-info { font-size: 8px; color: #000; margin-top: 3mm; border-top: 1px dashed #000; padding-top: 2mm; font-family: sans-serif; line-height: 1.3; font-weight: 600; }
      .no-print { text-align:center; margin-bottom:20px; }
      @media print { body { padding: 5mm; } .no-print { display: none; } }

      @keyframes pulse {
  0%   { box-shadow: 0 0 10px 2px var(--c); transform: scale(1.1); }
  50%  { box-shadow: 0 0 25px 8px var(--c); transform: scale(1.18); }
  100% { box-shadow: 0 0 10px 2px var(--c); transform: scale(1.1); }
}
    </style></head><body>
      <div class="no-print"><h2>Cartones para Imprimir (${cardsToPrint.length})</h2><button onclick="window.print()" style="padding: 10px 20px; font-size: 16px; cursor: pointer; background: #4caf50; color: white; border: none; border-radius: 5px;">🖨️ IMPRIMIR AHORA</button></div>
      <div class="grid-container">`;
    cardsToPrint.forEach(c => {
      const gameColor = c.gameId ? (GAMES.find(g => g.id === c.gameId)?.color || "#000") : "#000";
      const gameNum = c.gameId ? c.gameId.replace('j', '') : '?';
      html += `<div class="card-box">
        <div class="color-strip" style="background: ${gameColor};"></div>
        <div class="game-info">JUEGO ${gameNum} | CARTÓN ${c.cardNum}</div>
        <div class="bingo-grid">
          ${Object.keys(COLS).map(l => `<div class="bingo-cell" style="background: ${gameColor}; color: white; border:none; font-size:20px;">${l}</div>`).join('')}
          ${c.grid[0].map((_, row) => c.grid.map((col, colIdx) => { const val = col[row]; const isFree = val === "FREE"; return `<div class="bingo-cell" style="background: ${isFree ? "#facc15" : "#f8fafc"}; color: ${isFree ? "#000" : "#222"}; padding: 2px;">${isFree ? '<img src="/QR.png" style="width:100%; height:100%; object-fit:contain;">' : val}</div>`; }).join('')).join('')}
        </div>
        <div class="footer-info">BINGO SOLIDARIO CRISTIAN HIDALGO<br>ESCANEA EL QR DEL CENTRO PARA VER INFO DEL JUEGO</div>
      </div>`;
    });
    html += `</div></body></html>`;
    printWindow.document.write(html); printWindow.document.close();
  };

  const filteredCards = cards.filter(c => c.gameId === activeGame.id && (c.cardNum.includes(search) || (c.owner && c.owner.toLowerCase().includes(search.toLowerCase()))));
  const totalRecaudado = cards.filter(c => c.paid).length * PRICE;

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #172441 0%, #285289 50%, #0a101f 100%)", fontFamily: "sans-serif", color: "#1e293b", paddingBottom: 60 }}>
      
      {/* HEADER */}
      <div style={{ background: "#ffffff", borderBottom: "1px solid #e2e8f0", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>🎰 Bingo Solidario</h1>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: "#64748b" }}>{isAdmin ? "👤 Admin" : "👁 Visualización"}</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={() => setIsMuted(!isMuted)} style={{ background: isMuted ? "#fee2e2" : "#f0fdf4", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 20, cursor: "pointer" }} title={isMuted ? "Activar voz" : "Silenciar voz"}>{isMuted ? "🔇" : "🔊"}</button>
          {isAdmin && (<>
            <div style={{ background: "#f8fafc", borderRadius: 8, padding: "6px 14px", textAlign: "center", border: "1px solid #e2e8f0" }}><div style={{ fontSize: 18, fontWeight: 800, color: "#3b82f6" }}>{cards.length}</div><div style={{ fontSize: 11, color: "#64748b" }}>Creados</div></div>
            <div style={{ background: "#f8fafc", borderRadius: 8, padding: "6px 14px", textAlign: "center", border: "1px solid #e2e8f0" }}><div style={{ fontSize: 18, fontWeight: 800, color: "#16a34a" }}>${totalRecaudado.toLocaleString("es-CL")}</div><div style={{ fontSize: 11, color: "#64748b" }}>Recaudado</div></div>
          </>)}
          {!isAdmin ? <button onClick={() => setShowLogin(true)} style={{ ...btnS("#3b82f6"), fontSize: 13, padding: "8px 14px" }}>🔐 Admin</button> : <button onClick={handleLogout} style={{ ...btnS("#ef4444"), fontSize: 13, padding: "8px 14px" }}>Cerrar sesión</button>}
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0", background: "#ffffff" }}>
        {TABS.map((t, i) => (<button key={t} onClick={() => setTab(i)} style={{ flex: 1, padding: "12px 4px", background: "none", border: "none", color: tab === i ? "#7c3aed" : "#94a3b8", fontWeight: tab === i ? 700 : 400, fontSize: 13, cursor: "pointer", borderBottom: tab === i ? "2px solid #7c3aed" : "2px solid transparent", fontFamily: "sans-serif" }}>{t}</button>))}
      </div>

      {/* TAB SORTEO — fuera del contenedor limitado */}
      {tab === 2 && (
  <div style={{ padding: '20px 24px', width: '100%', boxSizing: 'border-box', minHeight: 'calc(100vh - 50px)', display: 'flex', alignItems: 'center' }}>
    <div className="sorteo-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)', gap: 24, alignItems: 'start', width: '100%' }}>

      {/* FILA SUPERIOR EN MÓVIL: COL1 + COL3 */}
      <div className="sorteo-top-row">

        {/* COL 1: Patrón */}
        <div className="sorteo-col1" style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <div style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.6) 60%, rgba(255,255,255,0) 100%)', border: 'none', borderRadius: 16, padding: 24, textAlign: 'center', boxSizing: 'border-box', width: '100%' }}>
            <div style={{ fontWeight: 800, fontSize: 26, color: activeGame.color, marginBottom: 20 }}>
              {activeGame.name}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: 2, marginBottom: 14 }}>PATRÓN ACTIVO</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5, width: 120, height: 120, margin: '0 auto 16px' }}>
              {activePattern.grid.flat().map((cell, i) => (
                <div key={i} style={{ borderRadius: 4, background: cell ? activeGame.color : '#f1f5f9' }} />
              ))}
            </div>
            {isAdmin && (
              <select
                value={activePattern.id}
                onChange={e => setActivePattern(PATTERNS.find(p => p.id === e.target.value))}
                style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #e2e8f0', outline: 'none', fontSize: 13 }}
              >
                {PATTERNS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            {isAdmin && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginTop: 16 }}>
                {GAMES.map(g => (
                  <button key={g.id} onClick={() => setActiveGame(g)} style={{ background: activeGame.id === g.id ? g.color : '#fff', color: activeGame.id === g.id ? '#fff' : g.color, border: `2px solid ${g.color}`, padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    {g.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="sorteo-imagen" style={{ borderRadius: 16, flex: 1, width: '100%', minHeight: 520, overflow: 'hidden' }}>
            <img src="/iimagen.jpg" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }} />
          </div>
        </div>

        {/* COL 3: Último número */}
        <div className="sorteo-col3" style={{ display: 'flex', flexDirection: 'column', gap: 16, alignSelf: 'flex-start' }}>
          <div style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.6) 60%, rgba(255,255,255,0) 100%)', border: `3px solid ${activeGame.color}`, borderRadius: 20, padding: '32px 24px', textAlign: 'center' }}>
            {lastDrawn ? (
              <>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', letterSpacing: 4, marginBottom: 6 }}>ÚLTIMO</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: activeGame.color, marginBottom: 8 }}>
                  {getLetterForNum(lastDrawn)} – {lastDrawn}
                </div>
                <div style={{ fontSize: 58, fontWeight: 900, color: activeGame.color, lineHeight: 1 }}>
                  {lastDrawn}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 16, color: '#94a3b8', padding: '60px 0', fontWeight: 600 }}>
                {isAdmin ? 'Toca un número para empezar' : 'Esperando sorteo...'}
              </div>
            )}
          </div>
          {isAdmin && (
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              {confirmReset ? (
                <>
                  <button onClick={resetSort} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '12px 22px', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>Confirmar</button>
                  <button onClick={() => setConfirmReset(false)} style={{ background: '#64748b', color: '#fff', border: 'none', padding: '12px 22px', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>Cancelar</button>
                </>
              ) : (
                <>
                  <button onClick={undoLastDrawn} style={{ background: '#f59e0b', color: '#fff', border: 'none', padding: '12px 22px', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>↩️ Deshacer</button>
                  <button onClick={() => setConfirmReset(true)} style={{ background: '#64748b', color: '#fff', border: 'none', padding: '12px 22px', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>🔄 Reiniciar</button>
                </>
              )}
            </div>
          )}
        </div>

      </div>{/* fin sorteo-top-row */}

      {/* COL 2: Tablero */}
      <div className="sorteo-col2" style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.6) 60%, rgba(255,255,255,0) 100%)', border: 'none', borderRadius: 16, padding: 16, display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
            {Object.keys(COLS).map((l, i) => (
              <div key={l} style={{ width: 50, textAlign: 'center', fontWeight: 900, fontSize: 30, fontFamily: "'Poller One', cursive", color: ['#ef4444','#3b82f6','#f59e0b','#22c55e','#a855f7'][i] }}>
                {l}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 2 }}>
            {Object.entries(COLS).map(([letter, [min, max]]) => (
              <div key={letter} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {Array.from({ length: 15 }, (_, i) => i + min).map(n => (
                  <div
                    key={n}
                    onClick={() => toggleNumber(n)}
                    style={{
                      width: 45, height: 45, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 17, fontWeight: 700, fontFamily: "'Poller One', cursive",
                      cursor: isAdmin ? 'pointer' : 'default',
                      transform: n === lastDrawn ? 'scale(1.1)' : 'scale(1)',
                      animation: n === lastDrawn ? 'bingoFlash 0.8s ease-in-out infinite' : 'none',
                      background: n === lastDrawn ? activeGame.color : drawn.includes(n) ? activeGame.color : 'rgba(255,255,255,0.15)',
                      color: n === lastDrawn ? '#fff' : drawn.includes(n) ? '#fff' : 'rgba(255,255,255,0.4)',
                      border: n === lastDrawn ? `3px solid #fff` : drawn.includes(n) ? `2px solid ${activeGame.color}` : '1.5px solid rgba(255,255,255,0.2)',
                      boxShadow: n === lastDrawn ? `0 0 20px ${activeGame.color}` : drawn.includes(n) ? `0 0 8px ${activeGame.color}80` : 'none',
                    }}
                  >
                    {n}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  </div>
)}

      {/* CONTENEDOR LIMITADO para otros tabs */}
      {tab !== 2 && (
        <div style={{ padding: "18px 14px", maxWidth: 760, margin: "0 auto" }}>

          {tab === 0 && (<div style={{ marginTop: 10 }}>
            {isAdmin && (<>
              <div style={{ display: "flex", gap: 6, marginBottom: 15, flexWrap: "wrap" }}>
                {GAMES.map(g => (
                  <button key={g.id} onClick={() => setActiveGame(g)} style={{ background: activeGame.id === g.id ? g.color : "#ffffff", color: activeGame.id === g.id ? "#fff" : g.color, border: `2px solid ${g.color}`, borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{g.name}</button>
                ))}
              </div>
              <div style={{ background: activeGame.color + "15", borderRadius: 13, padding: 16, marginBottom: 12, border: `1px solid ${activeGame.color}40` }}>
                <h3 style={{ margin: "0 0 12px", fontSize: 14, color: activeGame.color }}>1. Generar cartones para {activeGame.name}</h3>
                <div style={{ display: "flex", gap: 10 }}>
                  <input type="number" placeholder="Cantidad (ej: 50)" value={genQty} onChange={e => setGenQty(e.target.value)} style={{ ...inpS, maxWidth: "60%" }} />
                  <button onClick={generatePool} style={{ ...btnS(activeGame.color), flex: 1 }}>Generar</button>
                </div>
                {cards.filter(c => !c.paid && c.gameId === activeGame.id).length > 0 && (
                  <button onClick={deleteUnsoldPool} style={{ ...btnS("#64748b"), width: "100%", marginTop: 10 }}>🗑️ Borrar disponibles de {activeGame.name} ({cards.filter(c => !c.paid && c.gameId === activeGame.id).length})</button>
                )}
              </div>
              {cards.length > 0 && (
                <button onClick={handlePrintCards} style={{ ...btnS("#6366f1"), width: "100%", padding: "12px", marginBottom: 12, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  🖨️ Imprimir Cartones ({cards.length})
                </button>
              )}
              <div style={{ background: "#ffffff", borderRadius: 13, padding: 16, marginBottom: 18, border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
                <h3 style={{ margin: "0 0 12px", fontSize: 14, color: "#334155" }}>2. Asignar en {activeGame.name} <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400 }}>(Quedan {cards.filter(c => !c.paid && c.gameId === activeGame.id).length} cartones)</span></h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 10, marginBottom: 10 }}>
                  <input placeholder="Nombre completo *" value={newOwner} onChange={e => setNewOwner(e.target.value)} style={inpS} />
                  <input type="number" placeholder="Cant." value={newQty} onChange={e => setNewQty(e.target.value)} onKeyDown={e => e.key === "Enter" && assignCard()} style={{ ...inpS, textAlign: "center" }} />
                </div>
                <button onClick={assignCard} style={{ ...btnS(activeGame.color), width: "100%", padding: "11px" }}>Asignar</button>
              </div>
            </>)}
            <input placeholder="🔍 Buscar por N° cartón o nombre..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inpS, width: "100%", marginBottom: 12 }} />
            {filteredCards.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 16px 8px", fontSize: 11, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.05em", borderBottom: "2px solid #e2e8f0", marginBottom: "8px" }}>
                <span style={{ minWidth: "45px" }}>CARTÓN</span>
                <span style={{ flex: 1 }}>ASISTENTE</span>
                <span style={{ minWidth: "70px", textAlign: "center" }}>JUEGO</span>
                <span style={{ textAlign: "right" }}>ESTADO</span>
              </div>
            )}
            {filteredCards.length === 0 && <div style={{ textAlign: "center", color: "#94a3b8", padding: 36 }}>Sin cartones</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {filteredCards.map(c => {
                const gameColor = GAMES.find(g => g.id === c.gameId)?.color || "#94a3b8";
                return (<div key={c.id}>
                  <div onClick={() => setSelectedCard(selectedCard?.id === c.id ? null : c)} style={{ background: "#ffffff", borderRadius: selectedCard?.id === c.id ? "12px 12px 0 0" : 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", borderLeft: `4px solid ${gameColor}` }}>
                    <div style={{ background: gameColor, borderRadius: 8, padding: "4px 10px", fontSize: 13, fontWeight: 800, color: "#fff", minWidth: "45px", textAlign: "center" }}>{c.cardNum}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: c.paid ? "#1e293b" : "#94a3b8" }}>{c.paid ? c.owner : "Disponible"}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>{c.gameName || "Sin juego"}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: c.paid ? "#16a34a" : "#94a3b8" }}>{c.paid ? "✓ Vendido" : "⏳ Espera"}</div>
                      {isAdmin && <button onClick={e => { e.stopPropagation(); deleteCard(c.id); }} style={{ ...btnS("#ef4444"), padding: "4px 8px", fontSize: 11 }}>✕</button>}
                    </div>
                  </div>
                  {selectedCard?.id === c.id && c.grid && (<div style={{ background: "#ffffff", borderRadius: "0 0 12px 12px", padding: 16, border: "1px solid #e2e8f0", borderTop: "none", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
                    <p style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", marginBottom: 12 }}>Números marcados ya salieron</p>
                    <CardGrid card={c} drawn={drawn} />
                  </div>)}
                </div>);
              })}
            </div>
          </div>)}

          {tab === 1 && (<div>
            <h3 style={{ marginTop: 0 }}>Asistentes</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 22 }}>
              {[{ label: "Vendidos", val: cards.filter(c=>c.paid).length, color: "#3b82f6" }, { label: "Recaudado", val: `$${totalRecaudado.toLocaleString("es-CL")}`, color: "#16a34a" }].map(s => (<div key={s.label} style={{ background: "#ffffff", borderRadius: 12, padding: "14px 18px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}><div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.val}</div><div style={{ fontSize: 13, color: "#64748b" }}>{s.label}</div></div>))}
            </div>
            {cards.filter(c=>c.paid).length === 0 ? <div style={{ textAlign: "center", color: "#94a3b8", padding: 36 }}>Sin ventas aún</div> : cards.filter(c=>c.paid).map((c, i) => (<div key={c.id} style={{ background: "#ffffff", borderRadius: 9, padding: "11px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #e2e8f0", marginBottom: 7, borderLeft: `4px solid ${GAMES.find(g=>g.id===c.gameId)?.color||"#000"}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ color: "#94a3b8", fontSize: 12, minWidth: 20 }}>{i + 1}</span><div><span style={{ fontWeight: 700 }}>{c.owner}</span><span style={{ fontSize: 12, color: "#64748b", marginLeft: 8 }}>Cartón {c.cardNum}</span></div></div>
              <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 700 }}>✓ $1.000</span>
            </div>))}
          </div>)}

          {tab === 3 && (<div>
            {isAdmin && (<div style={{ background: "#ffffff", borderRadius: 13, padding: 16, border: "2px solid #fde68a", marginBottom: 22, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
              <h3 style={{ margin: "0 0 12px", fontSize: 14, color: "#92400e" }}>Registrar ganador</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <input placeholder="Nombre" value={winnerName} onChange={e => setWinnerName(e.target.value)} style={inpS} />
                <input placeholder="N° cartón" value={winnerCard} onChange={e => setWinnerCard(e.target.value)} style={inpS} />
              </div>
              <button onClick={addWinner} style={{ ...btnS("#f59e0b"), width: "100%", padding: "11px" }}>🏆 Registrar</button>
            </div>)}
            {winners.length === 0 ? <div style={{ textAlign: "center", color: "#94a3b8", padding: 40 }}>Sin ganadores</div> : winners.map(w => (<div key={w.ts} style={{ background: "#ffffff", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, border: "1px solid #fde68a", marginBottom: 8 }}>
              <div style={{ fontSize: 26 }}>🏆</div>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 15, color: "#92400e" }}>{w.name}</div><div style={{ fontSize: 12, color: "#64748b" }}>Cartón #{w.card} · {w.time}</div></div>
              {isAdmin && <button onClick={() => deleteWinner(w.ts)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 16 }}>✕</button>}
            </div>))}
          </div>)}

        </div>
      )}
      
      {toast && <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: toast.type === "err" ? "#ef4444" : "#10b981", color: "#fff", padding: "12px 24px", borderRadius: 12, fontWeight: 700, fontSize: 14, zIndex: 999, boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", whiteSpace: "nowrap", fontFamily: "sans-serif" }}>{toast.msg}</div>}
      {showLogin && <LoginModal pwInput={pwInput} setPwInput={setPwInput} pwError={pwError} onLogin={handleLogin} onClose={() => { setShowLogin(false); setPwInput(""); setPwError(false); }} />}
    </div>
  );
}

function LoginModal({ pwInput, setPwInput, pwError, onLogin, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, backdropFilter: "blur(5px)" }} onClick={onClose}>
      <div style={{ background: "#1a1d2b", border: "1px solid #2e3244", borderRadius: "15px", padding: "30px", width: "320px", textAlign: "center" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🔐</div>
        <h3 style={{ color: "#e8b75a", marginBottom: "20px" }}>Panel de Control</h3>
        <input style={{ background: pwError ? "rgba(239,68,68,0.15)" : "#1a1d2b", border: `1px solid ${pwError ? "#ef4444" : "#2e3244"}`, color: "white", borderRadius: "8px", padding: "15px", width: "100%", outline: "none", fontSize: "18px", textAlign: "center", letterSpacing: 6, fontFamily: "sans-serif", boxSizing: "border-box" }} type="password" placeholder="PIN" value={pwInput} onChange={e => setPwInput(e.target.value)} onKeyDown={e => e.key === "Enter" && onLogin()} autoFocus />
        {pwError && <p style={{ color: "#ef4444", fontSize: 13, marginTop: 8 }}>PIN incorrecto</p>}
        <button style={{ background: "#e8b75a", color: "#0a0a1a", border: "none", borderRadius: "8px", padding: "12px", width: "100%", marginTop: "15px", fontWeight: 700, fontSize: 15, cursor: "pointer" }} onClick={onLogin}>Entrar</button>
      </div>
    </div>
  );
}