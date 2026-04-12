import { pad, getTextColor, getLetterForNum, generateCardGrid, checkPattern } from "./utils.js";
import ResetModal from "./components/ResetModal.jsx";
import LoginModal from "./components/LoginModal.jsx";
import GameModal from "./components/GameModal.jsx";
import PatternModal from "./components/PatternModal.jsx";
import WinnerPopup from "./components/WinnerPopup.jsx";
import { CardGridMemo } from "./components/CardGrid.jsx";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { db } from "./firebase.js";
import { ref, onValue, set, remove, update, runTransaction } from "firebase/database";
import { COLS, TOTAL, PRICE, DB_CARDS, DB_DRAWN, DB_WINNERS, DB_STATE, GAMES, PATTERNS, BINGO_LETTER_COLORS, TABS } from "./constants/index.js";

const inpS = { background:"#fff", border:"1px solid #e2e8f0", borderRadius:8, padding:"10px 12px", color:"#334155", fontSize:14, outline:"none", width:"100%", boxSizing:"border-box", fontFamily:"sans-serif" };
const btnS = (color, extra={}) => ({ background:color, border:"none", borderRadius:8, padding:"9px 15px", fontWeight:700, fontSize:14, cursor:"pointer", color:"#fff", fontFamily:"sans-serif", whiteSpace:"nowrap", ...extra });

export default function BingoAdmin() {
  const [tab, setTab]                   = useState(2);
  const [cards, setCards]               = useState([]);
  const [drawn, setDrawn]               = useState([]);
  const [lastDrawn, setLastDrawn]       = useState(null);
  const [winners, setWinners] = useState([]);
  const winnersRef = useRef([]);
  const savingWinnerRef = useRef(false);
  const touchStartX = useRef(null);
  const [activePattern, setActivePattern] = useState(PATTERNS[0]);
  const [activeGame, setActiveGame]     = useState(GAMES[0]);
  const [alreadyWon, setAlreadyWon]     = useState(false);
  const [genQty, setGenQty]             = useState("");
  const [newOwner, setNewOwner]         = useState("");
  const [newQty, setNewQty]             = useState("1");
  const [search, setSearch]             = useState("");
  const [selectedCard, setSelectedCard] = useState(null);
  const [winnerName, setWinnerName]     = useState("");
  const [winnerCard, setWinnerCard]     = useState("");
  const [toast, setToast]               = useState(null);
  const [isMuted, setIsMuted]           = useState(false);
  const [isAdmin, setIsAdmin]           = useState(false);
  const [showLogin, setShowLogin]       = useState(false);
  const [pwInput, setPwInput]           = useState("");
  const [pwError, setPwError]           = useState(false);
  const [showPatternModal, setShowPatternModal] = useState(false);
  const [showGameModal, setShowGameModal]       = useState(false);
  const [showResetModal, setShowResetModal]     = useState(false);
  const [isFullscreen, setIsFullscreen]         = useState(false);
  const [showArrows, setShowArrows] = useState(false);
const arrowTimeout = useRef(null);
  const [winnerPopup, setWinnerPopup]   = useState(null);
  const [selectedWinner, setSelectedWinner] = useState(null);
  const [confirmAssign, setConfirmAssign] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const [countdownEndsAt, setCountdownEndsAt] = useState(null);
  const [countdownDisplay, setCountdownDisplay] = useState(0);
  const [countdownInput, setCountdownInput] = useState("5");

  const [newSaleAnim, setNewSaleAnim] = useState(null);
  const prevSoldCount = useRef(0);
  const prevSoldIds = useRef(new Set());

  useEffect(() => {
    if (!countdownEndsAt) {
      setCountdownDisplay(0);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((countdownEndsAt - Date.now()) / 1000));
      setCountdownDisplay(remaining);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [countdownEndsAt]);

  useEffect(() => {
    const token = sessionStorage.getItem("admin_token");
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.exp * 1000 > Date.now()) {
        setIsAdmin(true);
      } else {
        sessionStorage.removeItem("admin_token");
      }
    } catch {
      sessionStorage.removeItem("admin_token");
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const handleLogin = async () => {
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pwInput }),
      });
      if (!res.ok) {
        setPwError(true);
        setTimeout(() => setPwError(false), 1500);
        return;
      }
      const { token } = await res.json();
      sessionStorage.setItem("admin_token", token);
      setIsAdmin(true);
      setShowLogin(false);
      setPwInput("");
      setPwError(false);
    } catch (err) {
      console.error("Error de login:", err);
      setPwError(true);
      setTimeout(() => setPwError(false), 1500);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("admin_token");
    setIsAdmin(false);
  };

  const showToast = (msg, type="ok") => { setToast({msg, type}); setTimeout(() => setToast(null), 2500); };
  const handleDragStart = (e) => {
  touchStartX.current = e.clientX ?? e.touches?.[0]?.clientX;
};
const handleShowArrows = () => {
  if (!isFullscreen) return;
  setShowArrows(true);
  clearTimeout(arrowTimeout.current);
  arrowTimeout.current = setTimeout(() => setShowArrows(false), 2000);
};

const handleDragEnd = (e) => {
  if (touchStartX.current === null) return;
  const endX = e.clientX ?? e.changedTouches?.[0]?.clientX;
  const diff = touchStartX.current - endX;
  if (Math.abs(diff) > 50) {
    if (diff > 0) {
      setTab(prev => Math.min(prev + 1, TABS.length - 1));
    } else {
      setTab(prev => Math.max(prev - 1, 0));
    }
  }
  touchStartX.current = null;
};

  const speakNumber = (num) => {
    if (isMuted || !num) return;
    window.speechSynthesis.cancel();
    const doSpeak = () => {
      const u = new SpeechSynthesisUtterance(`${getLetterForNum(num)}, ${num}`);
      u.lang = "es-ES";
      u.rate = 0.75;
      u.pitch = 1.1;
      u.volume = 1;
      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find(v => v.name === "Google español") ||
        voices.find(v => v.name === "Microsoft Laura - Spanish (Spain)") ||
        voices.find(v => v.lang === "es-ES");
      if (preferred) u.voice = preferred;
      window.speechSynthesis.speak(u);
    };
    if (window.speechSynthesis.getVoices().length === 0) {
      const handleVoicesChanged = () => {
        window.speechSynthesis.onvoiceschanged = null;
        doSpeak();
      };
      window.speechSynthesis.onvoiceschanged = handleVoicesChanged;
    } else {
      doSpeak();
    }
  };

  useEffect(() => {
    const uC = onValue(ref(db, DB_CARDS), s => {
      const v = s.val();
      const parsed = v ? Object.values(v).map(c => ({
        ...c,
        grid: c.grid
          ? [0,1,2,3,4].map(ci => {
              const col = c.grid[ci] ?? c.grid[String(ci)];
              if (!col) return Array(5).fill(null);
              return [0,1,2,3,4].map(ri => col[ri] ?? col[String(ri)] ?? null);
            })
          : null
      })).sort((a, b) => a.id - b.id) : [];

      const soldNow = parsed.filter(c => c.paid);
      if (soldNow.length > prevSoldCount.current && prevSoldCount.current > 0) {
        const newest = soldNow.find(c => !prevSoldIds.current.has(c.id));
        if (newest) {
          const audio = new Audio("/cajaRegistradora.mp3");
          audio.volume = 0.8;
          audio.play().catch(() => {});
          setNewSaleAnim(newest);
          setTimeout(() => setNewSaleAnim(null), 3000);
        }
      }
      prevSoldCount.current = soldNow.length;
      prevSoldIds.current = new Set(soldNow.map(c => c.id));
      setCards(parsed);
    });

    const uD = onValue(ref(db, DB_DRAWN), s => {
      const v = s.val();
      if (v) {
        const n = Object.values(v);
        setDrawn(n);
        setLastDrawn(n.at(-1) ?? null);
      } else {
        setDrawn([]);
        setLastDrawn(null);
      }
    });

    const uW = onValue(ref(db, DB_WINNERS), s => {
      const v = s.val();
      const all = v ? Object.values(v) : [];
      const unique = Object.values(
        all.reduce((acc, w) => {
          const key = `${w.gameId}_${w.card}`;
          if (!acc[key] || w.ts > acc[key].ts) acc[key] = w;
          return acc;
        }, {})
      ).sort((a, b) => a.ts - b.ts);
      winnersRef.current = unique;
      setWinners(unique);
    });

    const uS = onValue(ref(db, DB_STATE), s => {
      const v = s.val(); if (!v) return;
      if (v.gameId)    { const g = GAMES.find(g => g.id === v.gameId);       if (g) setActiveGame(g); }
      if (v.patternId) { const p = PATTERNS.find(p => p.id === v.patternId); if (p) setActivePattern(p); }
      if (typeof v.alreadyWon === "boolean") setAlreadyWon(v.alreadyWon);
      if (v.countdownEndsAt !== undefined) {
        setCountdownEndsAt(v.countdownEndsAt > Date.now() ? v.countdownEndsAt : null);
      }
      if (v.currentWinner && v.currentWinner.ts && Date.now() - v.currentWinner.ts < 8000) {
        setWinnerPopup(v.currentWinner);
      } else {
        setWinnerPopup(null);
      }
    });

    return () => { uC(); uD(); uW(); uS(); };
  }, []);

  const handleSelectGame = async (game) => {
    await update(ref(db, DB_STATE), { gameId:game.id, alreadyWon:false, currentWinner:null });
    setWinnerPopup(null);
  };

  const handleSelectPattern = async (pattern) => {
    await update(ref(db, DB_STATE), { patternId:pattern.id, alreadyWon:false, currentWinner:null });
  };

  const generatePool = async () => {
    const qty = parseInt(genQty);
    if (!qty || qty < 1) return showToast("Ingresa una cantidad válida", "err");
    if (qty > 500) return showToast("Máximo 500 por vez", "err");
    const startIdx = cards.filter(c => c.gameId === activeGame.id).length + 1;
    const updates = {};
    for (let i = 0; i < qty; i++) {
      const id = Date.now() + (i * 10);
      const grid = generateCardGrid();
      const gridObj = {};
      grid.forEach((col, ci) => { gridObj[ci] = {...col}; });
      updates[`${DB_CARDS}/${id}`] = { id, cardNum:pad(startIdx+i), gameId:activeGame.id, gameName:activeGame.name, boleto:null, owner:null, paid:false, grid:gridObj };
    }
    await update(ref(db), updates);
    showToast(`✓ ${activeGame.name}: ${pad(startIdx)} al ${pad(startIdx+qty-1)}`);
    setGenQty("");
  };

  const deleteUnsoldPool = async () => {
    if (!window.confirm(`¿Borrar todos los cartones SIN VENDER de ${activeGame.name}?`)) return;
    const unsold = cards.filter(c => !c.paid && c.gameId === activeGame.id);
    if (!unsold.length) return showToast("No hay cartones disponibles", "err");
    const updates = {};
    unsold.forEach(c => { updates[`${DB_CARDS}/${c.id}`] = null; });
    await update(ref(db), updates);
    showToast(`🗑️ ${unsold.length} cartones eliminados`);
  };

  const assignCard = async () => {
    const qty = parseInt(newQty) || 1;
    if (!newOwner.trim()) return showToast("Ingresa el nombre", "err");
    const available = cards.filter(c => !c.paid && c.gameId === activeGame.id);
    if (available.length < qty) return showToast(`Solo quedan ${available.length} cartones en ${activeGame.name}`, "err");
    const nums = available.slice(0, qty).map(c => c.cardNum);
    setConfirmAssign({ owner:newOwner.trim(), qty, nums, available, selected:available.slice(0, qty).map(c => c.id) });
  };

  const confirmAssignCard = async () => {
    if (!confirmAssign) return;
    const freshSnap = await new Promise(res =>
      onValue(ref(db, DB_CARDS), res, { onlyOnce: true })
    );
    const freshData = freshSnap.val() || {};
    const alreadySold = confirmAssign.selected.filter(id => {
      const fresh = freshData[id];
      return fresh && fresh.paid;
    });
    if (alreadySold.length > 0) {
      const soldNums = confirmAssign.available
        .filter(c => alreadySold.includes(c.id))
        .map(c => c.cardNum)
        .join(", ");
      showToast(`Cartón(es) ${soldNums} ya fueron vendidos`, "err");
      setConfirmAssign(null);
      return;
    }
    const updates = {};
    const toAssign = confirmAssign.available.filter(c => confirmAssign.selected.includes(c.id));
    toAssign.forEach(c => {
      updates[`${DB_CARDS}/${c.id}`] = {
        id:c.id, cardNum:c.cardNum, gameId:c.gameId, gameName:c.gameName,
        grid:c.grid, owner:confirmAssign.owner, paid:true, soldAt:Date.now()
      };
    });
    await update(ref(db), updates);
    showToast(`✓ ${activeGame.name}: ${confirmAssign.nums.join(', ')}`);
    setNewOwner(""); setNewQty("1"); setConfirmAssign(null);
  };

  const deleteCard = async (id) => {
    if (!isAdmin) return;
    await remove(ref(db, `${DB_CARDS}/${id}`));
    if (selectedCard?.id === id) setSelectedCard(null);
    showToast("Eliminado");
  };

  const toggleNumber = async (n) => {
    if (!isAdmin) return;
    const isMarking = !drawn.includes(n);
    const next = isMarking ? [...drawn, n] : drawn.filter(x => x !== n);
    await set(ref(db, DB_DRAWN), next.length ? Object.fromEntries(next.map((v, i) => [i, v])) : null);
    if (isMarking) speakNumber(n);

    if (isMarking) {
      const soldCards = cards.filter(c => c.paid && c.gameId === activeGame.id);
      for (const card of soldCards) {
        if (!card.grid) continue;
        if (checkPattern(card, next, activePattern)) {
          const winnerKey = `${activeGame.id}_${card.cardNum}`;
          const winnerRef = ref(db, `${DB_WINNERS}/${winnerKey}`);
          await runTransaction(winnerRef, (existing) => {
            if (existing !== null) return;
            return { id:winnerKey, name:card.owner, card:card.cardNum, game:activeGame.name, gameId:activeGame.id, patternId:activePattern.id, time:new Date().toLocaleTimeString("es-CL"), ts:Date.now(), drawn:[...next] };
          });
          const snap = await new Promise(res => onValue(winnerRef, res, { onlyOnce: true }));
          if (snap.val()) {
            update(ref(db, DB_STATE), { alreadyWon:true, currentWinner:snap.val() });
          }
          break;
        }
      }
    }
  };

  const resetSort = async () => {
    await set(ref(db, DB_DRAWN), null);
    await update(ref(db, DB_STATE), { alreadyWon:false, currentWinner:null });
    setShowResetModal(false);
    showToast("Sorteo reiniciado");
  };

  const addWinner = async () => {
    if (!winnerName.trim() || !winnerCard.trim()) return showToast("Completa campos", "err");
    const winnerKey = `${activeGame.id}_${winnerCard.trim()}`;
    await set(ref(db, `${DB_WINNERS}/${winnerKey}`), { id:winnerKey, name:winnerName.trim(), card:winnerCard.trim(), game:activeGame.name, gameId:activeGame.id, time:new Date().toLocaleTimeString("es-CL"), ts:Date.now(), drawn:[...drawn] });
    showToast("🏆 ¡Ganador registrado!");
    setWinnerName("");
    setWinnerCard("");
  };

  const deleteWinner = async (id) => await remove(ref(db, `${DB_WINNERS}/${id}`));

  const handlePrintCards = () => {
    const cardsToPrint = cards.filter(c => c.grid);
    if (!cardsToPrint.length) return showToast("No hay cartones para imprimir", "err");
    const printWindow = window.open('', '_blank');
    let html = `<!DOCTYPE html><html><head><title>Imprimir Cartones</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Poller+One&display=swap" rel="stylesheet">
    <style>
      *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
      body{font-family:sans-serif;margin:0;padding:3mm 3mm 3mm 8mm;box-sizing:border-box;}
      .grid-container{display:grid;grid-template-columns:1fr 1fr;gap:0;}
      .card-box{width:110mm;height:130mm;border:2px solid #000;padding:3mm;border-radius:8px;text-align:center;page-break-inside:avoid;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;position:relative;overflow:hidden;background:#fff;}
      .color-strip{height:5mm;width:100%;position:absolute;top:0;left:0;}
      .game-info{font-family:'Poller One',cursive;font-size:13px;font-weight:900;margin-top:2mm;margin-bottom:2mm;color:#000;border-top:1px dashed #aaa;border-bottom:1px dashed #aaa;padding:2mm 0;}
      .bingo-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:0;height:100mm;margin-top:2mm;}
      .bingo-cell{display:flex;align-items:center;justify-content:center;border-radius:2px;font-family:'Poller One',cursive;font-size:45px;font-weight:400;border:1px solid #bbb;height:85%;width:85%;margin:auto;}
      .footer-info{font-size:8px;color:#000;margin-top:3mm;border-top:1px dashed #000;padding-top:2mm;font-family:sans-serif;line-height:1.3;font-weight:600;}
      .no-print{text-align:center;margin-bottom:20px;}
      @media print{body{padding:5mm;}.no-print{display:none;}}
    </style></head><body>
    <div class="no-print"><h2>Cartones (${cardsToPrint.length})</h2><button onclick="window.print()" style="padding:10px 20px;font-size:16px;cursor:pointer;background:#4caf50;color:white;border:none;border-radius:5px;">🖨️ IMPRIMIR</button></div>
    <div class="grid-container">`;
    cardsToPrint.forEach(c => {
      const gc2 = c.gameId ? (GAMES.find(g => g.id === c.gameId)?.color || "#000") : "#000";
      const gn = c.gameId ? c.gameId.replace('j', '') : '?';
      html += `<div class="card-box"><div class="color-strip" style="background:${gc2};"></div>
      <div class="game-info">JUEGO ${gn} | CARTÓN ${c.cardNum}</div>
      <div class="bingo-grid">
        ${Object.keys(COLS).map((l, i) => `<div class="bingo-cell" style="background:${['#ef4444','#3b82f6','#f59e0b','#22c55e','#a855f7'][i]};color:white;border:none;font-size:20px;font-family:'Poller One',cursive;">${l}</div>`).join('')}
        ${Array.isArray(c.grid) && c.grid[0] ? c.grid[0].map((_, row) => c.grid.map((col, ci) => { const val = col[row]; const isFree = val === "FREE"; return `<div class="bingo-cell" style="background:${isFree ? "#facc15" : "#f8fafc"};color:${isFree ? "#000" : "#222"};padding:2px;">${isFree ? '<img src="/qr-code.png" style="width:100%;height:100%;object-fit:contain;">' : val}</div>`; }).join('')).join('') : ''}
      </div>
      <div class="footer-info">BINGO SOLIDARIO CRISTIAN HIDALGO<br>ESCANEA EL QR DEL CENTRO PARA VER INFO DEL JUEGO</div></div>`;
    });
    html += `</div></body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const filteredCards = useMemo(() =>
    cards.filter(c =>
      c.gameId === activeGame.id &&
      (c.cardNum.includes(search) ||
      (c.owner && c.owner.toLowerCase().includes(search.toLowerCase())))
    ), [cards, activeGame.id, search]);

  const filteredSold = useMemo(() =>
    filteredCards.filter(c => c.paid),
    [filteredCards]);

  const visibleCards = useMemo(() =>
    search ? filteredCards : filteredSold.slice(-10).reverse(),
    [search, filteredCards, filteredSold]);

  const totalRecaudado = useMemo(() =>
    cards.filter(c => c.paid).length * PRICE,
    [cards]);

  const jugadoresActuales = useMemo(() =>
    cards.filter(c => c.paid && c.gameId === activeGame.id).length,
    [cards, activeGame.id]);

  const gc = activeGame.color;
  const gameNum = activeGame.id.replace("j", "");
  const premioSrc = (gameId) => `/premios/${gameId}.png`;
  const premioSrcMobile = (gameId) => `/premios/${gameId}-mobile.png`;

  return (

    
    <div onMouseDown={handleDragStart} onMouseUp={handleDragEnd} onClick={handleShowArrows} onTouchStart={handleDragStart} onTouchEnd={handleDragEnd} style={{ minHeight:"100vh", background:"linear-gradient(135deg,#172441 0%,#285289 50%,#0a101f 100%)", fontFamily:"sans-serif", color:"#1e293b", paddingBottom:60 }}>

      {/* ── HEADER ── */}
      <div style={{ background:"#0f1221", borderBottom:"1px solid rgba(255,255,255,0.08)", padding:"10px 16px", display:"flex", justifyContent:"space-between", alignItems:"center", gap:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div>
            <div style={{ fontSize:16, fontWeight:800, color:"#fff", lineHeight:1.1 }}>Bingo Solidario</div>
            <div style={{ fontSize:11, color:gc, fontWeight:600 }}>{isAdmin ? "👤 Admin" : "👁 Visualización"}</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <button onClick={() => setIsMuted(!isMuted)} style={{ background:"rgba(255,255,255,0.07)", border:"none", borderRadius:8, padding:"6px 10px", fontSize:18, cursor:"pointer" }}>{isMuted ? "🔇" : "🔊"}</button>
          <button onClick={()=>{ isFullscreen ? document.exitFullscreen() : document.documentElement.requestFullscreen(); }} style={{ background:"rgba(255,255,255,0.07)", border:"none", borderRadius:8, padding:"6px 10px", fontSize:18, cursor:"pointer" }}>{isFullscreen ? "⛶" : "⛶"}</button>
          {!isAdmin
            ? <button onClick={() => setShowLogin(true)} style={{ background:gc, border:"none", borderRadius:8, padding:"8px 14px", fontSize:13, fontWeight:700, cursor:"pointer", color:getTextColor(gc) }}>🔐 Admin</button>
            : <button onClick={handleLogout} style={{ background:"#ef4444", border:"none", borderRadius:8, padding:"8px 14px", fontSize:13, fontWeight:700, cursor:"pointer", color:"#fff" }}>Salir</button>
          }
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{ display:"flex", background:"#0f1221", padding:"8px 12px", gap:6, borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
        {TABS.map((t, i) => {
          const isActive = tab === i;
          const labels = ["Cartones", "Información", "Sorteo", "Ganadores"];
          return (
            <button key={t} onClick={() => setTab(i)} style={{
              flex:1, padding:"10px 6px",
              background: isActive ? gc : "rgba(255,255,255,0.05)",
              border:"none", borderRadius:10,
              color: isActive ? getTextColor(gc) : "#64748b",
              fontWeight: isActive ? 700 : 500, fontSize:15,
              cursor:"pointer", fontFamily:"'Nunito', sans-serif",
              transition:"all 0.2s ease",
              boxShadow: isActive ? `0 0 12px ${gc}66` : "none"
            }}>
              {labels[i]}
            </button>
          );
        })}
      </div>

      {/* ══ TAB SORTEO ══ */}
      {tab === 2 && (
        <div style={{ padding:"16px 20px", width:"100%", boxSizing:"border-box", minHeight:"calc(100vh - 112px)", display:"flex", flexDirection:"column", gap:14, paddingBottom: isAdmin ? 90 : 60 }}>
          <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Poller+One&family=Nunito:wght@700&family=Bebas+Neue&family=Righteous&display=swap');
            @keyframes numPop { 0%{transform:scale(0.3) rotate(-8deg);opacity:0} 60%{transform:scale(1.4) rotate(3deg);opacity:1} 100%{transform:scale(1) rotate(0deg);opacity:1} }
            .num-pop { animation: numPop 0.9s cubic-bezier(0.34,1.56,0.64,1) forwards; }
            @media (min-width: 769px) {
              .panel-inferior-pc {
                display: grid;
                grid-template-columns: 140px 160px 1fr 140px;
                gap: 12px;
                min-height: 170px;
              }
            }
            @media (max-width: 768px) {
              .bingo-board-mobile { display: flex !important; flex-direction: row !important; gap: 4px !important; }
              .bingo-board-mobile .bingo-row { display: flex !important; flex-direction: column !important; flex: 1 !important; gap: 4px !important; }
              .bingo-board-mobile .bingo-letter { display: none !important; }
              .bingo-board-mobile .bingo-number { flex: unset !important; width: 100% !important; aspect-ratio: 1/1 !important; }
              .panel-inferior-pc {
                display: grid !important;
                grid-template-columns: 1fr 1fr !important;
                grid-template-rows: auto auto !important;
                gap: 12px !important;
              }
              .zona-patron { grid-column: 1 !important; grid-row: 1 !important; }
              .zona-ultimo { grid-column: 2 !important; grid-row: 1 !important; }
              .zona-premio { grid-column: 1 / -1 !important; grid-row: 2 !important; min-height:220px !important; }
              .zona-jugadores { grid-column: 1 / -1 !important; grid-row: 3 !important; }
              .btn-flotantes-mobile { bottom: 80px !important; gap: 8px !important; }
              .btn-flotantes-mobile button { padding: 8px 12px !important; font-size: 12px !important; }
              .mobile-bingo-letters { display: flex !important; }
            }
            @media (max-width: 768px) {
              .btn-flotantes-mobile { position: relative !important; bottom: auto !important; top: auto !important; margin-bottom: 10px !important; border-top: none !important; border-bottom: 1px solid rgba(255,255,255,0.1) !important; }
            }
          `}</style>

          {/* ── BOTONES FLOTANTES ADMIN ── */}
          {isAdmin && !isFullscreen && (
            <div className="btn-flotantes-mobile" style={{ position:"fixed", bottom:0, left:0, right:0, display:"flex", flexDirection:"row", justifyContent:"center", gap:12, padding:"12px 16px", background:"rgba(10,16,31,0.95)", backdropFilter:"blur(10px)", borderTop:"1px solid rgba(255,255,255,0.1)", zIndex:100 }}>
              <button onClick={() => setShowPatternModal(true)} style={{ background:"rgba(255,255,255,0.08)", border:`2px solid ${gc}`, borderRadius:14, padding:"11px 24px", color:gc, fontWeight:700, fontSize:13, cursor:"pointer", backdropFilter:"blur(10px)", display:"flex", alignItems:"center", gap:8 }}>🎯 Patrón</button>
              <button onClick={() => setShowGameModal(true)} style={{ background:gc, border:"none", borderRadius:14, padding:"11px 24px", color:getTextColor(gc), fontWeight:700, fontSize:13, cursor:"pointer", display:"flex", alignItems:"center", gap:8, boxShadow:`0 4px 20px ${gc}66` }}>🎮 Juego</button>
              <button onClick={() => setShowResetModal(true)} style={{ background:"rgba(255,255,255,0.08)", border:"2px solid #ef4444", borderRadius:14, padding:"11px 24px", color:"#ef4444", fontWeight:700, fontSize:13, cursor:"pointer", backdropFilter:"blur(10px)", display:"flex", alignItems:"center", gap:8 }}>🔄 Reiniciar</button>
            </div>
          )}

          <div className="mobile-bingo-letters" style={{ display:'none', justifyContent:'space-around', marginBottom:10 }}>
            {Object.keys(COLS).map((letter, idx) => (
              <div key={letter} style={{ width:50, height:50, borderRadius:12, flexShrink:0, background:BINGO_LETTER_COLORS[idx], display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Nunito', sans-serif", fontWeight:900, fontSize:24, color:"#fff", boxShadow:`0 0 12px ${BINGO_LETTER_COLORS[idx]}99` }}>{letter}</div>
            ))}
          </div>

          <div className="bingo-board-mobile" style={{ background:"rgba(255,255,255,0.06)", borderRadius:18, padding:"14px 16px", border:`1px solid ${gc}33`, display:"flex", flexDirection:"column" }}>
            {Object.entries(COLS).map(([letter, [min, max]], rowIdx) => (
              <div key={letter} className="bingo-row" style={{ display:"flex", gap:5, marginBottom:rowIdx < 4 ? 6 : 0, alignItems:"center" }}>
                <div className="bingo-letter" style={{ width:44, height:44, borderRadius:10, flexShrink:0, background:BINGO_LETTER_COLORS[rowIdx], display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Poller One',cursive", fontWeight:900, fontSize:22, color:"#fff", boxShadow:`0 0 12px ${BINGO_LETTER_COLORS[rowIdx]}99` }}>{letter}</div>
                {Array.from({length:15}, (_, i) => i + min).map(n => {
                  const isLast = n === lastDrawn;
                  const isDrawn = drawn.includes(n);
                  return (
                    <div key={n} className="bingo-number" onClick={() => toggleNumber(n)} style={{ flex:1, aspectRatio:"1/1", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"clamp(29px,3vw,50px)", fontWeight:700, fontFamily:"'Poller One',cursive", cursor:isAdmin ? "pointer" : "default", background:isDrawn ? gc : "rgba(255,255,255,0.10)", color:isDrawn ? "#fff" : "rgba(131,128,128,0.72)", textShadow:isDrawn ? "0 0 15px #000, 0 0 5px #000" : "none", border:isLast ? `3px solid #fff` : isDrawn ? `2px solid ${gc}` : "1px solid rgba(255,255,255,0.15)", boxShadow:isLast ? `0 0 16px ${gc}` : isDrawn ? `0 0 6px ${gc}88` : "none", transform:isLast ? "scale(1.18)" : "scale(1)", transition:"transform 0.15s" }}>{n}</div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* ── PANEL INFERIOR: 4 ZONAS ── */}
          <div className="panel-inferior-pc">

            {/* ZONA 1 — Patrón activo */}
            <div className="zona-patron" style={{ background:"rgba(255,255,255,0.07)", borderRadius:14, padding:"12px 10px", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8, border:`1px solid ${gc}44` }}>
              <div style={{ background:gc, borderRadius:8, padding:"3px 14px", fontSize:13, fontWeight:800, color:getTextColor(gc), letterSpacing:1 }}>JUEGO {gameNum}</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:2, width:100 }}>
                {Object.keys(COLS).map((l, i) => (<div key={l} style={{ height:15, borderRadius:3, background:BINGO_LETTER_COLORS[i], display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, fontWeight:800, color:"#fff" }}>{l}</div>))}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:2, width:100 }}>
                {activePattern.grid.flat().map((cell, i) => (<div key={i} style={{ height:15, borderRadius:3, background:cell ? gc : "rgba(255,255,255,0.07)", border:cell ? "none" : "1px solid rgba(255,255,255,0.1)" }} />))}
              </div>
              <div style={{ fontSize:11, fontWeight:700, color:"#e2e8f0", textAlign:"center", lineHeight:1.3 }}>{activePattern.name}</div>
            </div>

            {/* ZONA 2 — Último número */}
            <div className="zona-ultimo" style={{ background:gc, borderRadius:14, padding:12, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", border:`4px solid #fff`, boxShadow:`0 0 30px ${gc}, 0 0 60px ${gc}88, inset 0 0 20px rgba(255,255,255,0.15)`, transform:lastDrawn ? "scale(1.04)" : "scale(1)", transition:"all 0.3s ease" }}>
              {lastDrawn ? (
                <>
                  <div style={{ fontSize:50, fontWeight:800, color:getTextColor(gc), marginBottom:2, fontFamily:"'Poller One',cursive" }}>{getLetterForNum(lastDrawn)}</div>
                  <div style={{ fontSize:80, fontWeight:900, color:getTextColor(gc), lineHeight:1, fontFamily:"'Poller One',cursive" }} key={lastDrawn} className="num-pop">{lastDrawn}</div>
                </>
              ) : (
                <div style={{ fontSize:12, color:getTextColor(gc), textAlign:"center", fontWeight:600, lineHeight:1.7 }}>{isAdmin ? "Toca un\nnúmero" : "Esperando\nsorteo..."}</div>
              )}
            </div>

            {/* ZONA 3 — Premio */}
            <div className="zona-premio" style={{ borderRadius:14, overflow:"hidden", border:`1px solid ${gc}33`, background:`linear-gradient(135deg,${gc}11,${gc}22)`, display:"flex", alignItems:"center", justifyContent:"center", maxHeight:300 }}>
              <img
                key={activeGame.id}
                src={window.innerWidth < 768 ? premioSrcMobile(activeGame.id) : premioSrc(activeGame.id)}
                alt="Premio"
                style={{ width:"100%", height:"100%", objectFit:"contain", display:"block" }}
                onError={e => {
                  e.target.onerror = null;
                  const isMobile = e.target.src.includes("-mobile");
                  e.target.src = isMobile ? "/premios/placeholder-mobile.png" : "/premios/placeholder.png";
                }}
              />
            </div>

            {/* ZONA 4 — Nº Jugadores */}
            <div className="zona-jugadores" style={{ background:"rgba(255,255,255,0.07)", borderRadius:14, padding:"12px 10px", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8, border:`1px solid ${gc}44` }}>
              <div style={{ fontSize:10, fontWeight:700, color:"#94a3b8", letterSpacing:2, textTransform:"uppercase" }}>Jugadores</div>
              <div style={{ fontSize:54, fontWeight:900, color:"#ffffff", lineHeight:1, fontFamily:"'Poller One',cursive", textShadow:`0 0 20px ${gc}88` }}>{jugadoresActuales}</div>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                <div style={{ background:gc, borderRadius:6, padding:"2px 12px", fontSize:11, fontWeight:800, color:getTextColor(gc) }}>{activeGame.name}</div>
                <div style={{ fontSize:10, color:"#64748b" }}>cartones vendidos</div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ══ OTROS TABS ══ */}
      {tab !== 2 && (
        <div style={{ padding: tab === 1 && !isAdmin ? "0" : "18px 14px", maxWidth: tab === 1 && !isAdmin ? "100%" : 760, margin:"0 auto" }}>

          {/* ══ TAB CARTONES ══ */}
          {tab === 0 && (<div style={{ marginTop:10 }}>
            {isAdmin && (<>
              <div style={{ marginBottom:15 }}>
                <button onClick={() => setShowGameModal(true)} style={{ background:activeGame.color, border:"none", borderRadius:10, padding:"10px 20px", fontSize:14, fontWeight:700, cursor:"pointer", color:getTextColor(activeGame.color), display:"flex", alignItems:"center", gap:8 }}>🎮 {activeGame.name} ▼</button>
              </div>
              <div style={{ background:activeGame.color+"15", borderRadius:13, padding:16, marginBottom:12, border:`1px solid ${activeGame.color}40` }}>
                <h3 style={{ margin:"0 0 12px", fontSize:14, color:activeGame.color }}>1. Generar cartones — {activeGame.name}</h3>
                <div style={{ display:"flex", gap:10 }}>
                  <input type="number" placeholder="Cantidad (ej: 50)" value={genQty} onChange={e => setGenQty(e.target.value)} style={{...inpS, maxWidth:"60%"}} />
                  <button onClick={generatePool} style={{...btnS(activeGame.color), flex:1, color:getTextColor(activeGame.color)}}>Generar</button>
                </div>
                {cards.filter(c => !c.paid && c.gameId === activeGame.id).length > 0 && (
                  <button onClick={deleteUnsoldPool} style={{...btnS("#64748b"), width:"100%", marginTop:10}}>🗑️ Borrar disponibles de {activeGame.name} ({cards.filter(c => !c.paid && c.gameId === activeGame.id).length})</button>
                )}
              </div>
              {cards.length > 0 && (
                <button onClick={handlePrintCards} style={{...btnS("#6366f1"), width:"100%", padding:"12px", marginBottom:12, fontSize:15, display:"flex", alignItems:"center", justifyContent:"center", gap:8}}>🖨️ Imprimir Cartones ({cards.length})</button>
              )}
              <div style={{ background:"#ffffff", borderRadius:13, padding:16, marginBottom:18, border:"1px solid #e2e8f0", boxShadow:"0 4px 6px -1px rgba(0,0,0,0.1)" }}>
                <h3 style={{ margin:"0 0 12px", fontSize:14, color:"#334155" }}>2. Asignar — {activeGame.name} <span style={{ fontSize:11, color:"#94a3b8", fontWeight:400 }}>(Quedan {cards.filter(c => !c.paid && c.gameId === activeGame.id).length})</span></h3>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 100px", gap:10, marginBottom:10 }}>
                  <input placeholder="Nombre completo *" value={newOwner} onChange={e => setNewOwner(e.target.value)} style={inpS} />
                  <input type="number" placeholder="Cant." value={newQty} onChange={e => setNewQty(e.target.value)} onKeyDown={e => e.key === "Enter" && assignCard()} style={{...inpS, textAlign:"center"}} />
                </div>
                <button onClick={assignCard} style={{...btnS(activeGame.color), width:"100%", padding:"11px", color:getTextColor(activeGame.color)}}>Asignar</button>
              </div>
            </>)}
            <input placeholder="🔍 Buscar por N° cartón o nombre..." value={search} onChange={e => setSearch(e.target.value)} style={{...inpS, width:"100%", marginBottom:12}} />
            {filteredCards.length > 0 && (<div style={{ display:"flex", alignItems:"center", gap:12, padding:"0 16px 8px", fontSize:11, fontWeight:800, color:"#94a3b8", letterSpacing:"0.05em", borderBottom:"2px solid #e2e8f0", marginBottom:8 }}>
              <span style={{ minWidth:45 }}>CARTÓN</span><span style={{ flex:1 }}>ASISTENTE</span><span style={{ minWidth:70, textAlign:"center" }}>JUEGO</span><span style={{ textAlign:"right" }}>ESTADO</span>
            </div>)}
            {filteredCards.length === 0 && <div style={{ textAlign:"center", color:"#94a3b8", padding:36 }}>Sin cartones</div>}
            {!search && filteredCards.length > 10 && <div style={{ textAlign:"center", color:"#94a3b8", fontSize:12, padding:"8px 0" }}>Mostrando últimos 10 de {filteredCards.length} — busca por nombre o número para filtrar</div>}
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {visibleCards.map(c => {
                const gameColor = GAMES.find(g => g.id === c.gameId)?.color || "#94a3b8";
                const gameTextColor = getTextColor(GAMES.find(g => g.id === c.gameId)?.color || "#fff");
                return (<div key={c.id}>
                  <div onClick={() => setSelectedCard(selectedCard?.id === c.id ? null : c)} style={{ background:"#ffffff", borderRadius:selectedCard?.id === c.id ? "12px 12px 0 0" : 12, padding:"12px 16px", display:"flex", alignItems:"center", gap:12, cursor:"pointer", border:"1px solid #e2e8f0", boxShadow:"0 1px 3px rgba(0,0,0,0.05)", borderLeft:`4px solid ${gameColor}` }}>
                    <div style={{ background:gameColor, borderRadius:8, padding:"4px 10px", fontSize:13, fontWeight:800, color:gameTextColor, minWidth:45, textAlign:"center" }}>{c.cardNum}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:14, color:c.paid ? "#1e293b" : "#94a3b8" }}>{c.paid ? c.owner : "Disponible"}</div>
                      <div style={{ fontSize:11, color:"#94a3b8" }}>{c.gameName || "Sin juego"}</div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:c.paid ? "#16a34a" : "#94a3b8" }}>{c.paid ? "✓ Vendido" : "⏳ Espera"}</div>
                      {isAdmin && <button onClick={e => { e.stopPropagation(); setConfirmDelete(c); }} style={{...btnS("#ef4444"), padding:"4px 8px", fontSize:11}}>✕</button>}
                    </div>
                  </div>
                  {selectedCard?.id === c.id && c.grid && (<div style={{ background:"#ffffff", borderRadius:"0 0 12px 12px", padding:16, border:"1px solid #e2e8f0", borderTop:"none", boxShadow:"0 4px 6px -1px rgba(0,0,0,0.1)" }}>
                    <p style={{ fontSize:12, color:"#94a3b8", textAlign:"center", marginBottom:12 }}>Números marcados ya salieron</p>
                    <CardGridMemo card={c} drawn={drawn} />
                  </div>)}
                </div>);
              })}
            </div>
          </div>)}

          {/* ══ TAB INFORMACIÓN ══ */}
          {tab === 1 && (<div style={{ minHeight:"calc(100vh - 160px)" }}>
            {isAdmin ? (
              <div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
                  {[{label:"Vendidos", val:cards.filter(c => c.paid).length, color:"#3b82f6"},{label:"Recaudado", val:`$${totalRecaudado.toLocaleString("es-CL")}`, color:"#16a34a"}].map(s => (<div key={s.label} style={{ background:"#ffffff", borderRadius:12, padding:"14px 18px", border:"1px solid #e2e8f0" }}><div style={{ fontSize:26, fontWeight:800, color:s.color }}>{s.val}</div><div style={{ fontSize:13, color:"#64748b" }}>{s.label}</div></div>))}
                </div>
                <div style={{ background:"#ffffff", borderRadius:13, padding:16, marginBottom:16, border:"1px solid #e2e8f0" }}>
                  <h3 style={{ margin:"0 0 12px", fontSize:14, color:"#334155" }}>⏱️ Countdown</h3>
                  <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                    <input type="number" placeholder="Minutos" value={countdownInput} onChange={e => setCountdownInput(e.target.value)} style={{...inpS, maxWidth:120}} />
                    <button onClick={() => {
                      const mins = parseInt(countdownInput) || 5;
                      const endsAt = Date.now() + mins * 60 * 1000;
                      update(ref(db, DB_STATE), { countdownEndsAt: endsAt });
                    }} style={{...btnS("#3b82f6"), flex:1}}>▶ Iniciar</button>
                    <button onClick={() => update(ref(db, DB_STATE), { countdownEndsAt: 0 })} style={{...btnS("#ef4444")}}>■ Detener</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="viz-grid" style={{ background:"linear-gradient(135deg,#0f1221 0%,#1a1d2b 100%)", height:"auto", padding:"12px 16px 60px 16px", display:"grid", gridTemplateColumns:"264px 1fr", gridTemplateRows:"auto", minHeight:"100vh", gap:10, boxSizing:"border-box", width:"100%", overflow:"visible" }}>
                <style>{`
                  @keyframes slideIn { from{transform:translateY(-10px);opacity:0} to{transform:translateY(0);opacity:1} }
                  @keyframes pulseViz { 0%,100%{transform:scale(1)} 50%{transform:scale(1.03)} }
                  @keyframes ticker { from{transform:translateX(100%)} to{transform:translateX(-100%)} }
                  @keyframes tickerCompradores { from{transform:translateX(0)} to{transform:translateX(-50%)} }
                  @keyframes salePopIn { 0%{transform:scale(0.5) translateY(20px);opacity:0} 60%{transform:scale(1.1) translateY(-5px);opacity:1} 100%{transform:scale(1) translateY(0);opacity:1} }
                  @keyframes barGlow { 0%,100%{opacity:1} 50%{opacity:0.7} }
                  @media (max-width: 768px) {
                    .viz-grid { grid-template-columns: 1fr !important; }
                    .viz-grid > * { grid-column: 1 / -1 !important; }
                    .viz-col-left { width: 100% !important; min-width: 0 !important; }
                    .viz-col-right { width: 100% !important; min-width: 0 !important; }
                    .viz-col-left *, .viz-col-right * { max-width: 100% !important; box-sizing: border-box !important; }
                    .viz-stats { grid-template-columns: 1fr 1fr !important; }
                    .viz-patron-grid { width: 120px !important; }
                  }
                `}</style>

                {newSaleAnim && (
                  <div style={{ position:"fixed", inset:0, zIndex:400, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.6)", backdropFilter:"blur(4px)" }}>
                    <style>{`
                      @keyframes saleCardIn { 0%{transform:scale(0.3) rotate(-8deg);opacity:0} 70%{transform:scale(1.08) rotate(2deg);opacity:1} 100%{transform:scale(1) rotate(0deg);opacity:1} }
                      @keyframes saleShimmer { 0%,100%{opacity:1} 50%{opacity:0.6} }
                      @keyframes saleSplitTop { 0%{transform:translateY(0);opacity:1} 100%{transform:translateY(-120px);opacity:0} }
                      @keyframes saleSplitBot { 0%{transform:translateY(0);opacity:1} 100%{transform:translateY(120px);opacity:0} }
                      @keyframes saleBalloon { 0%{transform:translateY(0) rotate(0deg);opacity:1} 100%{transform:translateY(-110vh) rotate(720deg);opacity:0} }
                      .sale-card { animation: saleCardIn 0.65s cubic-bezier(0.34,1.56,0.64,1) forwards; }
                      .sale-shimmer { animation: saleShimmer 1.2s ease-in-out infinite; }
                      .sale-top { animation: saleCardIn 0.65s cubic-bezier(0.34,1.56,0.64,1) forwards, saleSplitTop 0.5s ease 2.5s forwards; }
                      .sale-bot { animation: saleCardIn 0.65s cubic-bezier(0.34,1.56,0.64,1) forwards, saleSplitBot 0.5s ease 2.5s forwards; }
                      .sale-balloon { position:fixed;bottom:-90px;font-size:36px;animation:saleBalloon linear infinite;pointer-events:none;z-index:401; }
                    `}</style>
                    {[{l:"10%",delay:"0s",dur:"2.8s"},{l:"25%",delay:"0.3s",dur:"3.2s"},{l:"50%",delay:"0.6s",dur:"2.6s"},{l:"70%",delay:"0.2s",dur:"3.0s"},{l:"88%",delay:"0.8s",dur:"2.9s"}].map((b, i) => (
                      <div key={i} className="sale-balloon" style={{ left:b.l, animationDelay:b.delay, animationDuration:b.dur }}>🎈</div>
                    ))}
                    {Array.from({length:16}).map((_, i) => (
                      <div key={"cf"+i} style={{ position:"fixed", bottom:-20, left:`${(i*6.5)%100}%`, width:i%3===0?10:7, height:i%3===0?10:7, borderRadius:i%2===0?"50%":2, background:["#ef4444","#3b82f6","#f59e0b","#22c55e","#a855f7","#ec4899"][i%6], pointerEvents:"none", zIndex:401, animation:`saleBalloon ${2+(i%4)*0.3}s linear ${(i*0.1).toFixed(1)}s infinite` }} />
                    ))}
                    <div className="sale-card" style={{ background:"#0f1221", border:`3px solid ${GAMES.find(g => g.id === newSaleAnim.gameId)?.color || "#22c55e"}`, borderRadius:26, overflow:"hidden", boxShadow:`0 0 80px ${GAMES.find(g => g.id === newSaleAnim.gameId)?.color || "#22c55e"}66, 0 0 160px ${GAMES.find(g => g.id === newSaleAnim.gameId)?.color || "#22c55e"}22`, maxWidth:380, width:"90vw", position:"relative", zIndex:402 }}>
                      <div style={{ position:"absolute", top:0, left:0, right:0, height:4, background:GAMES.find(g => g.id === newSaleAnim.gameId)?.color || "#22c55e" }} />
                      <div className="sale-top" style={{ padding:"22px 28px 12px", textAlign:"center", borderBottom:`1px solid ${GAMES.find(g => g.id === newSaleAnim.gameId)?.color || "#22c55e"}33` }}>
                        <div className="sale-shimmer" style={{ fontSize:11, fontWeight:700, letterSpacing:4, color:GAMES.find(g => g.id === newSaleAnim.gameId)?.color || "#22c55e", marginBottom:10, textTransform:"uppercase" }}>🎟️ Nuevo cartón vendido</div>
                        <div style={{ fontSize:32, fontWeight:900, color:"#fff", letterSpacing:1, marginBottom:4 }}>{newSaleAnim.owner}</div>
                      </div>
                      <div className="sale-bot" style={{ padding:"12px 28px 22px", textAlign:"center" }}>
                        <div style={{ display:"flex", justifyContent:"center", alignItems:"center", gap:12 }}>
                          <span style={{ background:GAMES.find(g => g.id === newSaleAnim.gameId)?.color || "#22c55e", borderRadius:10, padding:"6px 18px", fontSize:18, fontWeight:900, color:getTextColor(GAMES.find(g => g.id === newSaleAnim.gameId)?.color || "#fff") }}>#{newSaleAnim.cardNum}</span>
                          <span style={{ fontSize:14, color:"#94a3b8", fontWeight:600 }}>{newSaleAnim.gameName}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Fila 1: Juego activo */}
                <div style={{ gridColumn:"1/-1", background:`linear-gradient(135deg,${gc}22,${gc}44)`, borderRadius:12, padding:"10px 18px", border:`2px solid ${gc}`, textAlign:"center" }}>
                  <div style={{ fontSize:10, fontWeight:700, color:gc, letterSpacing:3, textTransform:"uppercase" }}>Juego Activo</div>
                  <div style={{ fontSize:26, fontWeight:900, color:"#fff", lineHeight:1.1, textTransform:"uppercase", letterSpacing:2 }}>{activeGame.name}</div>
                </div>

                {/* Fila 2: Countdown */}
                {countdownDisplay > 0 ? (
                  <div style={{ gridColumn:"1/-1", background:"#1a1d2b", borderRadius:12, padding:"10px 20px", border:"2px solid #f59e0b", textAlign:"center", animation:"pulseViz 1s ease infinite", display:"flex", alignItems:"center", justifyContent:"center", gap:16, flexWrap:"wrap" }}>
                    <div style={{ fontSize:20, fontWeight:700, color:"#f59e0b", letterSpacing:3 }}>EL BINGO COMIENZA EN</div>
                    <div style={{ fontSize:42, fontWeight:900, color:"#f59e0b", lineHeight:1, fontFamily:"'Poller One',cursive" }}>
                      {String(Math.floor(countdownDisplay/60)).padStart(2,"0")}:{String(countdownDisplay%60).padStart(2,"0")}
                    </div>
                  </div>
                ) : (
                  <div style={{ gridColumn:"1/-1", background:"#1a1d2b", borderRadius:12, padding:"10px 20px", border:`2px solid ${gc}`, textAlign:"center", display:"flex", alignItems:"center", justifyContent:"center", gap:16 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:gc, letterSpacing:3 }}>EL BINGO COMIENZA EN</div>
                    <div style={{ fontSize:42, fontWeight:900, color:gc, lineHeight:1, fontFamily:"'Poller One',cursive" }}>¡YA!</div>
                  </div>
                )}

                {/* Columna izquierda */}
                <div className="viz-col-left" style={{ display:"flex", flexDirection:"column", gap:10, overflow:"visible", minHeight:"auto", paddingBottom:12 }}>
                  <div style={{ background:"#1a1d2b", borderRadius:12, height:180, padding:"12px 14px", border:`1px solid ${gc}44`, flexShrink:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8 }}>
                    <div style={{ fontSize:10, color:"#94a3b8", fontWeight:600, marginBottom:8, letterSpacing:2, textAlign:"center" }}>PATRÓN ACTIVO</div>
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
                      <div className="viz-patron-grid" style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:2, width:150, flexShrink:0 }}>
                        {activePattern.grid.flat().map((cell, i) => (<div key={i} style={{ height:18, borderRadius:3, background:cell ? gc : "rgba(255,255,255,0.07)" }} />))}
                      </div>
                      <div>
                        <div style={{ fontSize:14, fontWeight:800, color:"#fff", lineHeight:1.2, textAlign:"center" }}>{activePattern.name}</div>
                        <div style={{ fontSize:11, color:gc, fontWeight:600, marginTop:3, textAlign:"center" }}>{activeGame.name}</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ background:"#1a1d2b", borderRadius:12, padding:"10px 14px", border:`1px solid ${gc}44`, flexShrink:0, textAlign:"center" }}>
                    <div style={{ fontSize:10, color:"#94a3b8", fontWeight:600, letterSpacing:2, marginBottom:4 }}>PRECIO CARTÓN</div>
                    <div style={{ fontSize:28, fontWeight:900, color:gc, fontFamily:"'Poller One',cursive" }}>${PRICE.toLocaleString("es-CL")}</div>
                  </div>

                  <div style={{ background:"#1a1d2b", borderRadius:12, padding:"12px 14px", border:`1px solid ${gc}44`, height:375, overflow:"hidden", display:"flex", flexDirection:"column" }}>
                    <div style={{ fontSize:10, color:"#94a3b8", fontWeight:600, marginBottom:10, letterSpacing:2 }}>ÚLTIMOS COMPRADORES</div>
                    <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column", gap:1 }}>
                      {cards.filter(c => c.paid && c.gameId === activeGame.id).sort((a, b) => (b.soldAt||0) - (a.soldAt||0)).slice(0, 12).map((c, i, arr) => (
                        <div key={c.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:i < arr.length-1 ? "1px solid rgba(255,255,255,0.05)" : "none", animation:"slideIn 0.3s ease" }}>
                          <span style={{ fontWeight:700, color:"#fff", fontSize:13, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"70%" }}>{c.owner}</span>
                          <span style={{ background:gc, borderRadius:5, padding:"2px 8px", fontSize:11, fontWeight:700, color:getTextColor(GAMES.find(g => g.id === c.gameId)?.color || "#fff"), flexShrink:0 }}>#{c.cardNum}</span>
                        </div>
                      ))}
                      {cards.filter(c => c.paid && c.gameId === activeGame.id).length === 0 && <div style={{ textAlign:"center", color:"#64748b", fontSize:12 }}>Sin compradores aún</div>}
                    </div>
                  </div>
                </div>

                {/* Columna derecha */}
                <div className="viz-col-right" style={{ display:"flex", flexDirection:"column", gap:10, overflow:"hidden", minHeight:"auto" }}>
                  <div className="viz-stats" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, flexShrink:0 }}>
                    <div style={{ background:"#1a1d2b", borderRadius:12, padding:"10px 14px", border:`1px solid ${gc}44`, textAlign:"center" }}>
                      <div style={{ fontSize:40, fontWeight:900, color:gc, lineHeight:1, fontFamily:"'Poller One',cursive" }}>{cards.filter(c => c.paid && c.gameId === activeGame.id).length}</div>
                      <div style={{ fontSize:10, color:"#94a3b8", marginTop:3, fontWeight:600, letterSpacing:1 }}>JUGADORES</div>
                    </div>
                    <div style={{ background:"#1a1d2b", borderRadius:12, padding:"10px 14px", border:"1px solid #16a34a44", textAlign:"center" }}>
                      <div style={{ fontSize:35, fontWeight:900, color:"#16a34a", lineHeight:1.2 }}>${Math.floor(totalRecaudado/1000)}K</div>
                      <div style={{ fontSize:10, color:"#94a3b8", marginTop:3, fontWeight:600, letterSpacing:1 }}>RECAUDADO</div>
                    </div>
                  </div>

                  <div style={{ background:"#1a1d2b", borderRadius:12, padding:"14px 18px", border:`1px solid ${gc}44`, flexShrink:0 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                      <span style={{ fontSize:16, color:"#94a3b8", fontWeight:700, letterSpacing:1 }}>CARTONES VENDIDOS</span>
                      <span style={{ fontSize:20, color:gc, fontWeight:800 }}>{cards.filter(c => c.paid && c.gameId === activeGame.id).length} / {cards.filter(c => c.gameId === activeGame.id).length}</span>
                    </div>
                    <div style={{ background:"rgba(255,255,255,0.1)", borderRadius:99, height:18, overflow:"hidden" }}>
                      <div style={{ background:gc, height:"100%", borderRadius:99, width:`${cards.filter(c => c.gameId === activeGame.id).length > 0 ? (cards.filter(c => c.paid && c.gameId === activeGame.id).length / cards.filter(c => c.gameId === activeGame.id).length) * 100 : 0}%`, transition:"width 0.8s ease", animation:"barGlow 2s ease-in-out infinite", boxShadow:`0 0 12px ${gc}99` }} />
                    </div>
                  </div>

                  <div style={{ borderRadius:12, overflow:"hidden", border:`2px solid ${gc}33`, background:"#000", height:300, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <img
                      key={activeGame.id}
                      src={window.innerWidth < 768 ? premioSrcMobile(activeGame.id) : premioSrc(activeGame.id)}
                      alt="Premio"
                      style={{ width:"100%", height:"100%", objectFit:"contain", display:"block" }}
                      onError={e => {
                        e.target.onerror = null;
                        const isMobile = e.target.src.includes("-mobile");
                        e.target.src = isMobile ? "/premios/placeholder-mobile.png" : "/premios/placeholder.png";
                      }}
                    />
                  </div>

                  <div style={{ background:"#1a1d2b", borderRadius:12, padding:"10px 14px", border:`1px solid ${gc}44`, flexShrink:0 }}>
                    <div style={{ fontSize:10, color:"#94a3b8", fontWeight:600, marginBottom:8, letterSpacing:2 }}>JUEGOS</div>
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                      {GAMES.map(g => (
                        <div key={g.id} style={{ background:g.id === activeGame.id ? g.color : "rgba(255,255,255,0.05)", borderRadius:8, padding:"4px 10px", border:`1px solid ${g.color}44`, display:"flex", alignItems:"center", gap:5 }}>
                          <div style={{ width:7, height:7, borderRadius:"50%", background:g.color, flexShrink:0 }} />
                          <span style={{ fontSize:11, fontWeight:700, color:g.id === activeGame.id ? getTextColor(g.color) : "#94a3b8" }}>{g.name}</span>
                          <span style={{ fontSize:10, color:g.id === activeGame.id ? (getTextColor(g.color) === "#000" ? "#00000088" : "rgba(255,255,255,0.6)") : "#64748b" }}>({cards.filter(c => c.paid && c.gameId === g.id).length})</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {cards.filter(c => c.paid && c.gameId === activeGame.id).length > 0 && (
                    <div style={{ background:"#1a1d2b", borderRadius:10, padding:"8px 0", border:`1px solid ${gc}44`, overflow:"hidden", flexShrink:0 }}>
                      <div style={{ display:"flex", animation:"tickerCompradores 40s linear infinite", whiteSpace:"nowrap", width:"max-content" }}>
                        {[...cards.filter(c => c.paid && c.gameId === activeGame.id), ...cards.filter(c => c.paid && c.gameId === activeGame.id)].map((c, i) => (
                          <span key={i} style={{ display:"inline-flex", alignItems:"center", gap:6, marginRight:32, fontSize:12, fontWeight:700, color:"#fff" }}>
                            <span style={{ background:gc, borderRadius:5, padding:"2px 7px", fontSize:11, color:getTextColor(GAMES.find(g => g.id === c.gameId)?.color || "#fff"), fontWeight:700 }}>#{c.cardNum}</span>
                            {c.owner}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {winners.length > 0 && (
                    <div style={{ background:"#1a1d2b", borderRadius:10, padding:"8px 0", border:"1px solid #f59e0b44", overflow:"hidden", flexShrink:0 }}>
                      <div style={{ display:"flex", animation:"ticker 10s linear infinite", whiteSpace:"nowrap" }}>
                        {winners.map((w, i) => {
                          const wColor = GAMES.find(g => g.id === w.gameId)?.color || "#f59e0b";
                          return (
                            <span key={i} style={{ display:"inline-flex", alignItems:"center", gap:6, marginRight:32, fontSize:12, fontWeight:700, color:"#fff" }}>
                              <span style={{ fontSize:10, color:"#f59e0b" }}>🏆</span>
                              <span style={{ background:wColor, borderRadius:5, padding:"2px 7px", fontSize:11, color:getTextColor(GAMES.find(g => g.id === w.gameId)?.color || "#fff"), fontWeight:700 }}>{w.game}</span>
                              {w.name} · #{w.card}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>)}

          {/* ══ TAB GANADORES ══ */}
          {tab === 3 && (<div>
            {isAdmin && (<div style={{ background:"#ffffff", borderRadius:13, padding:16, border:"2px solid #fde68a", marginBottom:22, boxShadow:"0 4px 6px -1px rgba(0,0,0,0.1)" }}>
              <h3 style={{ margin:"0 0 12px", fontSize:14, color:"#92400e" }}>Registrar ganador manualmente</h3>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
                <input placeholder="Nombre" value={winnerName} onChange={e => setWinnerName(e.target.value)} style={inpS} />
                <input placeholder="N° cartón" value={winnerCard} onChange={e => setWinnerCard(e.target.value)} style={inpS} />
              </div>
              <button onClick={addWinner} style={{...btnS("#f59e0b"), width:"100%", padding:"11px"}}>🏆 Registrar</button>
            </div>)}
            {winners.length === 0
              ? <div style={{ textAlign:"center", color:"#94a3b8", padding:40 }}>Sin ganadores</div>
              : winners.map(w => {
                const isExpanded = selectedWinner === (w.id || w.ts);
                const winnerCardData = cards.find(c => c.cardNum === w.card && c.gameId === w.gameId);
                const winnerPattern = PATTERNS.find(p => p.id === w.patternId) || activePattern;
                return (<div key={w.id || w.ts}>
                  <div onClick={() => setSelectedWinner(isExpanded ? null : (w.id || w.ts))} style={{ background:"#ffffff", borderRadius:isExpanded ? "12px 12px 0 0" : 12, padding:"14px 16px", display:"flex", alignItems:"center", gap:12, cursor:"pointer", border:"1px solid #fde68a", boxShadow:"0 1px 3px rgba(0,0,0,0.05)" }}>
                    <div style={{ fontSize:26 }}>🏆</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:15, color:"#92400e" }}>{w.name}</div>
                      <div style={{ fontSize:12, color:"#64748b" }}>Cartón #{w.card} · <span style={{ color:GAMES.find(g => g.id === w.gameId)?.color || "#64748b", fontWeight:700 }}>{w.game || ""}</span> · {w.time}</div>
                    </div>
                    {isAdmin && <button onClick={e => { e.stopPropagation(); deleteWinner(w.id || w.ts); setSelectedWinner(null); }} style={{ background:"none", border:"none", color:"#94a3b8", cursor:"pointer", fontSize:16 }}>✕</button>}
                    <span style={{ color:"#94a3b8", fontSize:12 }}>{isExpanded ? "▲" : "▼"}</span>
                  </div>
                  {isExpanded && winnerCardData && winnerCardData.grid && (
                    <div style={{ background:"#ffffff", borderRadius:"0 0 12px 12px", padding:16, border:"1px solid #fde68a", borderTop:"none", boxShadow:"0 4px 6px -1px rgba(0,0,0,0.1)" }}>
                      <p style={{ fontSize:12, color:"#92400e", textAlign:"center", marginBottom:4, fontWeight:700 }}>Patrón ganador</p>
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:2, width:80, height:80, margin:"0 auto 12px" }}>
                        {winnerPattern.grid.flat().map((cell, i) => (<div key={i} style={{ borderRadius:2, background:cell ? "#f59e0b" : "#f1f5f9", border:cell ? "none" : "1px solid #e2e8f0" }} />))}
                      </div>
                      <CardGridMemo card={winnerCardData} drawn={Array.isArray(w.drawn) ? w.drawn : w.drawn ? Object.values(w.drawn) : drawn} pattern={winnerPattern} />
                    </div>
                  )}
                  {isExpanded && !winnerCardData && (
                    <div style={{ background:"#ffffff", borderRadius:"0 0 12px 12px", padding:16, border:"1px solid #fde68a", borderTop:"none", textAlign:"center", color:"#94a3b8", fontSize:13 }}>
                      Cartón #{w.card} no encontrado en los datos actuales
                    </div>
                  )}
                </div>);
              })
            }
          </div>)}

        </div>
      )}

      {/* ── MODALES Y TOAST ── */}
      {confirmDelete && (
        <div onClick={() => setConfirmDelete(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:300, backdropFilter:"blur(4px)" }}>
          <div onClick={e => e.stopPropagation()} style={{ background:"#fff", borderRadius:20, padding:28, width:"min(360px,92vw)", textAlign:"center" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🗑️</div>
            <h3 style={{ margin:"0 0 8px", fontSize:18, color:"#1e293b" }}>¿Eliminar cartón?</h3>
            <p style={{ color:"#64748b", fontSize:14, margin:"0 0 8px" }}>Cartón <strong>{confirmDelete.cardNum}</strong></p>
            {confirmDelete.paid && <p style={{ color:"#64748b", fontSize:14, margin:"0 0 20px" }}>Asignado a <strong>{confirmDelete.owner}</strong></p>}
            <div style={{ display:"flex", gap:12 }}>
              <button onClick={() => setConfirmDelete(null)} style={{ flex:1, background:"#f1f5f9", border:"none", borderRadius:10, padding:"12px", color:"#64748b", fontWeight:700, fontSize:14, cursor:"pointer" }}>Cancelar</button>
              <button onClick={() => { deleteCard(confirmDelete.id); setConfirmDelete(null); }} style={{ flex:1, background:"#ef4444", border:"none", borderRadius:10, padding:"12px", color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer" }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {confirmAssign && (
        <div onClick={() => setConfirmAssign(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:300, backdropFilter:"blur(4px)" }}>
          <div onClick={e => e.stopPropagation()} style={{ background:"#fff", borderRadius:20, padding:28, width:"min(400px,92vw)", boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ fontSize:32, textAlign:"center", marginBottom:8 }}>🎟️</div>
            <h3 style={{ textAlign:"center", margin:"0 0 20px", fontSize:18, color:"#1e293b" }}>Confirmar asignación</h3>
            <div style={{ background:"#f8fafc", borderRadius:12, padding:16, marginBottom:20, border:"1px solid #e2e8f0" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                <span style={{ color:"#64748b", fontSize:14 }}>Nombre</span>
                <span style={{ fontWeight:700, fontSize:14, color:"#1e293b" }}>{confirmAssign.owner}</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                <span style={{ color:"#64748b", fontSize:14 }}>Cantidad</span>
                <span style={{ fontWeight:700, fontSize:14, color:"#1e293b" }}>{confirmAssign.qty} cartón{confirmAssign.qty > 1 ? "es" : ""}</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <span style={{ color:"#64748b", fontSize:14 }}>Buscar y agregar</span>
                <input placeholder="Ej: 045" style={{ background:"#f1f5f9", border:"1px solid #e2e8f0", borderRadius:8, padding:"6px 10px", fontSize:13, width:"60%", outline:"none", fontFamily:"sans-serif" }}
                  onChange={e => {
                    const val = e.target.value.trim();
                    if (!val) return;
                    const found = confirmAssign.available.filter(c => !c.paid && c.cardNum.includes(val.padStart(3, "0")));
                    if (found.length === 1) {
                      const alreadySel = confirmAssign.selected.includes(found[0].id);
                      if (!alreadySel && confirmAssign.selected.length < confirmAssign.qty) {
                        setConfirmAssign(p => {
                          const newSelected = [...p.selected, found[0].id];
                          return {...p, selected:newSelected, nums:p.available.filter(x => newSelected.includes(x.id)).map(x => x.cardNum)};
                        });
                      } else if (!alreadySel && confirmAssign.selected.length >= confirmAssign.qty) {
                        showToast(`Máximo ${confirmAssign.qty} cartón${confirmAssign.qty > 1 ? "es" : ""}`, "err");
                      }
                      e.target.value = "";
                      setTimeout(() => {
                        const el = document.getElementById(`carton-${found[0].id}`);
                        if (el) el.scrollIntoView({behavior:"smooth", block:"center"});
                      }, 100);
                    }
                  }}
                />
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <span style={{ color:"#64748b", fontSize:14 }}>Cartones</span>
                <div id="cartones-list" style={{ display:"flex", gap:6, flexWrap:"wrap", justifyContent:"flex-end", maxWidth:"70%", maxHeight:120, overflowY:"auto", padding:"4px 0" }}>
                  {confirmAssign.available.filter(c => !c.paid).map(c => {
                    const isSel = confirmAssign.selected.includes(c.id);
                    return (<span id={`carton-${c.id}`} key={c.id} onClick={() => {
                      const alreadySel = confirmAssign.selected.includes(c.id);
                      if (alreadySel) {
                        if (confirmAssign.selected.length <= 1) return;
                        setConfirmAssign(p => ({...p, selected:p.selected.filter(id => id !== c.id), nums:p.available.filter(x => p.selected.filter(id => id !== c.id).includes(x.id)).map(x => x.cardNum)}));
                      } else {
                        if (confirmAssign.selected.length >= confirmAssign.qty) return;
                        setConfirmAssign(p => ({...p, selected:[...p.selected, c.id], nums:p.available.filter(x => [...p.selected, c.id].includes(x.id)).map(x => x.cardNum)}));
                      }
                    }} style={{ background:isSel ? activeGame.color : "#e2e8f0", color:isSel ? getTextColor(activeGame.color) : "#64748b", borderRadius:6, padding:"4px 10px", fontSize:13, fontWeight:700, cursor:"pointer", border:isSel ? `2px solid ${activeGame.color}` : "2px solid #e2e8f0" }}>{c.cardNum}</span>);
                  })}
                </div>
              </div>
            </div>
            {confirmAssign.selected.length > 0 && (
              <div style={{ background:"#f8fafc", borderRadius:10, padding:"10px 14px", marginBottom:16, border:"1px solid #e2e8f0" }}>
                <div style={{ fontSize:12, color:"#64748b", marginBottom:8, fontWeight:600 }}>Cartones seleccionados ({confirmAssign.selected.length}/{confirmAssign.qty})</div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {confirmAssign.available.filter(c => confirmAssign.selected.includes(c.id)).map(c => (
                    <span key={c.id} onClick={() => {
                      setConfirmAssign(p => {
                        const newSelected = p.selected.filter(id => id !== c.id);
                        return {...p, selected:newSelected, nums:p.available.filter(x => newSelected.includes(x.id)).map(x => x.cardNum)};
                      });
                    }} style={{ background:activeGame.color, color:getTextColor(activeGame.color), borderRadius:6, padding:"4px 10px", fontSize:13, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
                      {c.cardNum} <span style={{ fontSize:10, opacity:0.7 }}>✕</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display:"flex", gap:12 }}>
              <button onClick={() => setConfirmAssign(null)} style={{ flex:1, background:"#f1f5f9", border:"none", borderRadius:10, padding:"12px", color:"#64748b", fontWeight:700, fontSize:14, cursor:"pointer" }}>Cancelar</button>
              <button onClick={confirmAssignCard} style={{ flex:1, background:activeGame.color, border:"none", borderRadius:10, padding:"12px", color:getTextColor(activeGame.color), fontWeight:700, fontSize:14, cursor:"pointer" }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {isFullscreen && showArrows && (
  <>
    <div onClick={() => setTab(prev => Math.max(prev - 1, 0))} style={{ position:"fixed", left:0, top:0, bottom:0, width:80, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", zIndex:200, background:"linear-gradient(to right, rgba(0,0,0,0.35), transparent)", transition:"opacity 0.3s" }}>
      <div style={{ fontSize:48, color:"#fff", opacity:0.85, userSelect:"none" }}>‹</div>
    </div>
    <div onClick={() => setTab(prev => Math.min(prev + 1, TABS.length - 1))} style={{ position:"fixed", right:0, top:0, bottom:0, width:80, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", zIndex:200, background:"linear-gradient(to left, rgba(0,0,0,0.35), transparent)", transition:"opacity 0.3s" }}>
      <div style={{ fontSize:48, color:"#fff", opacity:0.85, userSelect:"none" }}>›</div>
    </div>
  </>
)}

      {toast && <div style={{ position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)", background:toast.type === "err" ? "#ef4444" : "#10b981", color:"#fff", padding:"12px 24px", borderRadius:12, fontWeight:700, fontSize:14, zIndex:999, boxShadow:"0 10px 15px -3px rgba(0,0,0,0.1)", whiteSpace:"nowrap", fontFamily:"sans-serif" }}>{toast.msg}</div>}
      {showLogin && <LoginModal pwInput={pwInput} setPwInput={setPwInput} pwError={pwError} onLogin={handleLogin} onClose={() => { setShowLogin(false); setPwInput(""); setPwError(false); }} />}
      {showPatternModal && <PatternModal activePattern={activePattern} activeGame={activeGame} onSelect={handleSelectPattern} onClose={() => setShowPatternModal(false)} />}
      {showGameModal && <GameModal activeGame={activeGame} onSelect={handleSelectGame} onClose={() => setShowGameModal(false)} />}
      {showResetModal && <ResetModal onConfirm={resetSort} onClose={() => setShowResetModal(false)} />}
      {winnerPopup && <WinnerPopup winner={winnerPopup} onClose={() => setWinnerPopup(null)} />}
    </div>
  );
}