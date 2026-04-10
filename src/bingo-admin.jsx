import React from "react";
import { useState, useEffect } from "react";
import { db, PIN } from "./firebase.js";
import { ref, onValue, set, remove, update, runTransaction } from "firebase/database";

const COLS = { B: [1,15], I: [16,30], N: [31,45], G: [46,60], O: [61,75] };
const TOTAL = 75; const PRICE = 1000;
const DB_CARDS   = "bingo_cards";
const DB_DRAWN   = "bingo_drawn";
const DB_WINNERS = "bingo_winners";
const DB_STATE   = "bingo_state";

const GAMES = [
  { id: "j1",  name: "Juego 1",  color: "#FF0000" }, // Rojo
  { id: "j2",  name: "Juego 2",  color: "#00FFFF" }, // Cian (Opuesto del Rojo)
  { id: "j3",  name: "Juego 3",  color: "#FFFF00" }, // Amarillo
  { id: "j4",  name: "Juego 4",  color: "#7F00FF" }, // Violeta (Opuesto del Amarillo)
  { id: "j5",  name: "Juego 5",  color: "#00FF00" }, // Verde
  { id: "j6",  name: "Juego 6",  color: "#FF00FF" }, // Magenta (Opuesto del Verde)
  { id: "j7",  name: "Juego 7",  color: "#FF7F00" }, // Naranja
  { id: "j8",  name: "Juego 8",  color: "#007FFF" }, // Azul Cielo (Opuesto del Naranja)
  { id: "j9",  name: "Juego 9",  color: "#7FFF00" }, // Verde Lima
  { id: "j10", name: "Juego 10", color: "#FF007F" }, // Rosa Intenso (Opuesto del Lima)
  { id: "j11", name: "Juego 11", color: "#0000FF" }, // Azul
  { id: "j12", name: "Juego 12", color: "#00FF7F" }, // Verde Primavera (Opuesto del Azul)
];

const PATTERNS = [
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

const BINGO_LETTER_COLORS = ['#ef4444','#3b82f6','#f59e0b','#22c55e','#a855f7'];

function pad(n) { return String(n).padStart(3, "0"); }
function getLetterForNum(n) { for (const [l,[min,max]] of Object.entries(COLS)) if (n>=min&&n<=max) return l; return ""; }
function generateCardGrid() {
  const grid = Object.entries(COLS).map(([,[min,max]]) => {
    const pool = Array.from({length:max-min+1},(_,i)=>i+min);
    const picked = [];
    while (picked.length<5) { const idx=Math.floor(Math.random()*pool.length); picked.push(pool.splice(idx,1)[0]); }
    return picked;
  });
  grid[2][2] = "FREE"; return grid;
}

function checkPattern(card, drawn, pattern) {
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      if (!pattern.grid[row][col]) continue;
      const val = card.grid[col][row];
      if (val === "FREE") continue;
      if (!drawn.includes(val)) return false;
    }
  }
  return true;
}

const TABS = ["🎟️ Cartones","📋 Asistentes","🎱 Sorteo","🏆 Ganadores"];
const inpS = { background:"#fff", border:"1px solid #e2e8f0", borderRadius:8, padding:"10px 12px", color:"#334155", fontSize:14, outline:"none", width:"100%", boxSizing:"border-box", fontFamily:"sans-serif" };
const btnS = (color, extra={}) => ({ background:color, border:"none", borderRadius:8, padding:"9px 15px", fontWeight:700, fontSize:14, cursor:"pointer", color:"#fff", fontFamily:"sans-serif", whiteSpace:"nowrap", ...extra });

function CardGrid({ card, drawn, pattern }) {
  const gameColor = GAMES.find(g=>g.id===card.gameId)?.color||"#64748b";
  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:5, maxWidth:260, margin:"0 auto" }}>
      {Object.keys(COLS).map(l=>(<div key={l} style={{ background:gameColor, borderRadius:6, textAlign:"center", padding:"6px 0", fontWeight:800, fontSize:16, color:"#fff", opacity:0.9 }}>{l}</div>))}
      {card.grid[0].map((_,row)=>card.grid.map((col,colIdx)=>{ 
        const val=col[row]; 
        const isFree=val==="FREE"; 
        const isOut=!isFree&&drawn.includes(val); 
        const isPattern=pattern?pattern.grid[row][colIdx]:false;
        if (pattern&&!isPattern&&!isFree) return (<div key={`${colIdx}-${row}`} style={{ background:"#f1f5f9", borderRadius:6, aspectRatio:"1/1", border:"1px solid #e2e8f0" }} />);
        return (<div key={`${colIdx}-${row}`} style={{ 
          background:isFree?"#e0ded8":isOut?gameColor:"#f8fafc", 
          borderRadius:6, padding:"2px", textAlign:"center", fontSize:isFree?9:14, fontWeight:700, 
          color:isFree?"#000":isOut?"#fff":"#64748b", 
          border:isPattern?`2.5px solid ${isOut?"#fbbf24":"#f59e0b"}`:"1px solid #e2e8f0",
          boxShadow:isPattern&&isOut?"0 0 8px #fbbf2488":"none",
          position:"relative" 
        }}>{isFree?"👁️":val}{isPattern&&isOut&&<span style={{position:"absolute",top:-2,right:-2,fontSize:8}}>⭐</span>}</div>); 
      }))}
    </div>
  );
}

function PatternModal({ activePattern, activeGame, onSelect, onClose }) {
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:300, backdropFilter:"blur(4px)" }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#1a1d2b", border:"1px solid #2e3244", borderRadius:20, padding:28, width:"min(680px,95vw)", maxHeight:"90vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22 }}>
          <h3 style={{ margin:0, color:"#fff", fontSize:18, fontWeight:700 }}>Seleccionar patrón</h3>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#94a3b8", fontSize:22, cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:14 }}>
          {PATTERNS.map(p=>{
            const sel = activePattern.id===p.id;
            return (
              <button key={p.id} onClick={()=>{ onSelect(p); onClose(); }} style={{ background:sel?activeGame.color+"22":"#252838", border:`2px solid ${sel?activeGame.color:"#2e3244"}`, borderRadius:14, padding:"14px 10px", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:3, width:80, height:80 }}>
                  {p.grid.flat().map((cell,i)=>(<div key={i} style={{ borderRadius:2, background:cell?(sel?activeGame.color:"#60a5fa"):"#1e2235" }} />))}
                </div>
                <span style={{ fontSize:12, fontWeight:700, color:sel?activeGame.color:"#94a3b8", textAlign:"center", lineHeight:1.3 }}>{p.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function GameModal({ activeGame, onSelect, onClose }) {
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:300, backdropFilter:"blur(4px)" }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#1a1d2b", border:"1px solid #2e3244", borderRadius:20, padding:28, width:"min(460px,95vw)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22 }}>
          <h3 style={{ margin:0, color:"#fff", fontSize:18, fontWeight:700 }}>Seleccionar juego</h3>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#94a3b8", fontSize:22, cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          {GAMES.map(g=>{
            const sel = activeGame.id===g.id;
            return (
              <button key={g.id} onClick={()=>{ onSelect(g); onClose(); }} style={{ background:sel?g.color:"#252838", border:`2px solid ${sel?g.color:"#2e3244"}`, borderRadius:14, padding:"16px 12px", cursor:"pointer", display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:18, height:18, borderRadius:"50%", background:g.color, flexShrink:0, border:sel?(["j2","j3","j5","j9","j12"].includes(g.id)?"2px solid #000":"2px solid #fff"):"none" }} />
                <span style={{ fontSize:14, fontWeight:700, color:sel?(["j2","j3","j5","j9","j12"].includes(g.id)?"#000":"#fff"):"#e2e8f0" }}>{g.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ResetModal({ onConfirm, onClose }) {
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:300, backdropFilter:"blur(4px)" }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#1a1d2b", border:"1px solid #ef4444", borderRadius:20, padding:32, width:"min(360px,90vw)", textAlign:"center" }}>
        <div style={{ fontSize:40, marginBottom:12 }}>🔄</div>
        <h3 style={{ color:"#fff", margin:"0 0 8px", fontSize:18 }}>¿Reiniciar sorteo?</h3>
        <p style={{ color:"#94a3b8", fontSize:14, margin:"0 0 24px" }}>Se borrarán todos los números sorteados. Esta acción no se puede deshacer.</p>
        <div style={{ display:"flex", gap:12 }}>
          <button onClick={onClose} style={{ flex:1, background:"#2e3244", border:"none", borderRadius:10, padding:"12px", color:"#e2e8f0", fontWeight:700, fontSize:14, cursor:"pointer" }}>Cancelar</button>
          <button onClick={onConfirm} style={{ flex:1, background:"#ef4444", border:"none", borderRadius:10, padding:"12px", color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer" }}>Reiniciar</button>
        </div>
      </div>
    </div>
  );
}

function WinnerPopup({ winner, onClose }) {
  const game = GAMES.find(g => g.id === winner.gameId);
  const gc = game?.color || "#f59e0b";
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:500, background:"rgba(0,0,0,0.88)", display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(6px)" }}>
      <style>{`
        @keyframes popIn { 0%{transform:scale(0.3) rotate(-8deg);opacity:0} 70%{transform:scale(1.08) rotate(2deg);opacity:1} 100%{transform:scale(1) rotate(0deg);opacity:1} }
        @keyframes floatBalloon { 0%{transform:translateY(0) rotate(0deg);opacity:1} 100%{transform:translateY(-110vh) rotate(720deg);opacity:0} }
        @keyframes shimmerWinner { 0%,100%{opacity:1} 50%{opacity:0.55} }
        @keyframes starPop { 0%{transform:scale(0) rotate(0deg);opacity:0} 60%{transform:scale(1.3) rotate(180deg);opacity:1} 100%{transform:scale(1) rotate(360deg);opacity:1} }
        .winner-pop-card { animation:popIn 0.65s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        .shimmer-winner  { animation:shimmerWinner 1.4s ease-in-out infinite; }
        .star-pop        { animation:starPop 0.7s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        .balloon-float   { position:fixed;bottom:-90px;font-size:44px;animation:floatBalloon linear infinite;pointer-events:none;line-height:1;z-index:501; }
        .confetti-piece  { position:fixed;bottom:-20px;pointer-events:none;animation:floatBalloon linear infinite;z-index:501; }
      `}</style>
      {[{l:"8%",delay:"0s",dur:"3.2s"},{l:"20%",delay:"0.35s",dur:"2.8s"},{l:"34%",delay:"0.8s",dur:"3.6s"},{l:"50%",delay:"0.15s",dur:"3.0s"},{l:"63%",delay:"0.6s",dur:"2.6s"},{l:"77%",delay:"1.0s",dur:"3.4s"},{l:"90%",delay:"0.45s",dur:"2.9s"},{l:"42%",delay:"1.3s",dur:"3.1s"}].map((b,i)=>(
        <div key={"b"+i} className="balloon-float" style={{left:b.l,animationDelay:b.delay,animationDuration:b.dur}}>🎈</div>
      ))}
      {Array.from({length:22}).map((_,i)=>(
        <div key={"cf"+i} className="confetti-piece" style={{ left:`${(i*4.5)%100}%`, width:i%4===0?12:8, height:i%4===0?12:8, borderRadius:i%3===0?"50%":2, background:["#ef4444","#3b82f6","#f59e0b","#22c55e","#a855f7","#ec4899","#14b8a6","#f97316"][i%8], animationDuration:`${2.2+(i%5)*0.35}s`, animationDelay:`${(i*0.14).toFixed(2)}s` }}/>
      ))}
      <div className="winner-pop-card" onClick={e=>e.stopPropagation()} style={{ background:"#0f1221", border:`3px solid ${gc}`, borderRadius:26, padding:"38px 44px", textAlign:"center", maxWidth:400, width:"92vw", boxShadow:`0 0 80px ${gc}66, 0 0 160px ${gc}22`, position:"relative", zIndex:502 }}>
        <div className="star-pop" style={{fontSize:20,position:"absolute",top:18,left:22,animationDelay:"0.2s"}}>⭐</div>
        <div className="star-pop" style={{fontSize:16,position:"absolute",top:22,right:26,animationDelay:"0.4s"}}>✨</div>
        <div className="star-pop" style={{fontSize:14,position:"absolute",bottom:60,left:18,animationDelay:"0.6s"}}>🌟</div>
        <div className="star-pop" style={{fontSize:14,position:"absolute",bottom:64,right:20,animationDelay:"0.5s"}}>⭐</div>
        <div style={{fontSize:62,marginBottom:6,lineHeight:1}}>🏆</div>
        <div className="shimmer-winner" style={{fontSize:12,fontWeight:700,letterSpacing:5,color:gc,marginBottom:20,textTransform:"uppercase",fontFamily:"sans-serif"}}>¡Tenemos ganador!</div>
        <div style={{background:`${gc}18`,borderRadius:16,padding:"20px 24px",marginBottom:18,border:`1.5px solid ${gc}55`}}>
          <div style={{fontSize:30,fontWeight:800,color:"#ffffff",marginBottom:6,fontFamily:"sans-serif",lineHeight:1.2}}>{winner.name}</div>
          <div style={{fontSize:16,color:"#94a3b8",fontFamily:"sans-serif"}}>Cartón <span style={{color:gc,fontWeight:800,fontSize:18}}>{winner.card}</span></div>
        </div>
        <div style={{marginBottom:28,fontFamily:"sans-serif"}}>
          <div style={{fontSize:15,color:"#e2e8f0",marginBottom:6}}>Ha ganado el <span style={{color:gc,fontWeight:700}}>{winner.game}</span></div>
          <div style={{fontSize:20,fontWeight:800,color:"#ffffff",letterSpacing:1}}>¡Felicitaciones! 🎉</div>
        </div>
        <button onClick={onClose} style={{background:gc,border:"none",borderRadius:14,padding:"14px 0",color:"#fff",fontWeight:700,fontSize:16,cursor:"pointer",width:"100%",fontFamily:"sans-serif",letterSpacing:0.5,boxShadow:`0 4px 24px ${gc}66`}}>Cerrar</button>
      </div>
    </div>
  );
}

export default function BingoAdmin() {
  const [tab, setTab]                   = useState(2);
  const [cards, setCards]               = useState([]);
  const [drawn, setDrawn]               = useState([]);
  const [lastDrawn, setLastDrawn]       = useState(null);
  const [winners, setWinners] = useState([]);
const winnersRef = React.useRef([]);
const savingWinnerRef = React.useRef(false);
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
  const [winnerPopup, setWinnerPopup]   = useState(null);
  const [selectedWinner, setSelectedWinner] = useState(null);
  const [confirmAssign, setConfirmAssign] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(()=>{
    const handleResize = () => setIsFullscreen(window.innerHeight === window.screen.height);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  },[]);

  const handleLogin = () => {
    if (pwInput===PIN) { setIsAdmin(true); setShowLogin(false); setPwInput(""); setPwError(false); }
    else { setPwError(true); setTimeout(()=>setPwError(false),1500); }
  };
  const handleLogout = () => setIsAdmin(false);
  const showToast = (msg,type="ok") => { setToast({msg,type}); setTimeout(()=>setToast(null),2500); };

  const speakNumber = (num) => {
    if (isMuted||!num) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(`${getLetterForNum(num)}, ${num}`);
    u.lang="es-ES"; u.rate=0.9;
    window.speechSynthesis.speak(u);
  };

  useEffect(()=>{
    const uC = onValue(ref(db,DB_CARDS), s=>{ 
  const v=s.val(); 
  const parsed = v ? Object.values(v).map(c => ({
    ...c,
    grid: c.grid ? [0,1,2,3,4].map(ci => 
      c.grid[ci] ? [0,1,2,3,4].map(ri => c.grid[ci][ri] ?? c.grid[ci][String(ri)]) : []
    ) : null
  })).sort((a,b)=>a.id-b.id) : [];
  setCards(parsed);
});
    const uD = onValue(ref(db,DB_DRAWN),   s=>{ const v=s.val(); if(v){const n=Object.values(v); setDrawn(n); setLastDrawn(n.at(-1)??null);} else{setDrawn([]); setLastDrawn(null);} });
    const uW = onValue(ref(db,DB_WINNERS), s=>{ 
  const v=s.val(); 
  const all = v ? Object.values(v) : [];
  const unique = Object.values(
    all.reduce((acc, w) => {
      const key = `${w.gameId}_${w.card}`;
      if (!acc[key] || w.ts > acc[key].ts) acc[key] = w;
      return acc;
    }, {})
  ).sort((a,b) => a.ts - b.ts);
  winnersRef.current = unique;
  setWinners(unique);
});
    const uS = onValue(ref(db,DB_STATE), s=>{
      const v = s.val(); if (!v) return;
      if (v.gameId)   { const g=GAMES.find(g=>g.id===v.gameId);     if(g) setActiveGame(g); }
      if (v.patternId){ const p=PATTERNS.find(p=>p.id===v.patternId); if(p) setActivePattern(p); }
      if (typeof v.alreadyWon==="boolean") setAlreadyWon(v.alreadyWon);
      if (v.currentWinner) {
        if (Date.now()-v.currentWinner.ts < 30000) setWinnerPopup(v.currentWinner);
      } else { setWinnerPopup(null); }
    });
    return ()=>{ uC(); uD(); uW(); uS(); };
  },[]);

  const handleSelectGame = async (game) => {
    await update(ref(db,DB_STATE),{ gameId:game.id, alreadyWon:false, currentWinner:null });
  };
  const handleSelectPattern = async (pattern) => {
    await update(ref(db,DB_STATE),{ patternId:pattern.id, alreadyWon:false, currentWinner:null });
  };


  const generatePool = async () => {
    const qty=parseInt(genQty);
    if (!qty||qty<1) return showToast("Ingresa una cantidad válida","err");
    if (qty>500) return showToast("Máximo 500 por vez","err");
    const startIdx=cards.filter(c=>c.gameId===activeGame.id).length+1;
    const updates={};
    for (let i=0;i<qty;i++) { 
  const id=Date.now()+(i*10); 
  const grid = generateCardGrid();
  const gridObj = {};
  grid.forEach((col, ci) => { gridObj[ci] = {...col}; });
  updates[`${DB_CARDS}/${id}`]={id,cardNum:pad(startIdx+i),gameId:activeGame.id,gameName:activeGame.name,boleto:null,owner:null,paid:false,grid:gridObj}; 
}
    await update(ref(db),updates);
    showToast(`✓ ${activeGame.name}: ${startIdx} al ${pad(startIdx+qty-1)}`);
    setGenQty("");
  };

  const deleteUnsoldPool = async () => {
    if (!window.confirm(`¿Borrar todos los cartones SIN VENDER de ${activeGame.name}?`)) return;
    const unsold=cards.filter(c=>!c.paid&&c.gameId===activeGame.id);
    if (!unsold.length) return showToast("No hay cartones disponibles","err");
    const updates={}; unsold.forEach(c=>{ updates[`${DB_CARDS}/${c.id}`]=null; });
    await update(ref(db),updates); showToast(`🗑️ ${unsold.length} cartones eliminados`);
  };

  const assignCard = async () => {
    const qty=parseInt(newQty)||1;
    if (!newOwner.trim()) return showToast("Ingresa el nombre","err");
    const available=cards.filter(c=>!c.paid&&c.gameId===activeGame.id);
    if (available.length<qty) return showToast(`Solo quedan ${available.length} cartones en ${activeGame.name}`,"err");
    const nums=available.slice(0,qty).map(c=>c.cardNum);
    setConfirmAssign({ owner:newOwner.trim(), qty, nums, available, selected:available.slice(0,qty).map(c=>c.id) });
  };

  const confirmAssignCard = async () => {
    if (!confirmAssign) return;
    const updates={};
    const toAssign=confirmAssign.available.filter(c=>confirmAssign.selected.includes(c.id));
    toAssign.forEach(c=>{ updates[`${DB_CARDS}/${c.id}`]={...c,owner:confirmAssign.owner,paid:true}; });
    await update(ref(db),updates);
    showToast(`✓ ${activeGame.name}: ${confirmAssign.nums.join(', ')}`);
    setNewOwner(""); setNewQty("1"); setConfirmAssign(null);
  };

  const deleteCard = async (id) => { if (!isAdmin) return; await remove(ref(db,`${DB_CARDS}/${id}`)); if(selectedCard?.id===id) setSelectedCard(null); showToast("Eliminado"); };

      const toggleNumber = async (n) => {
    if (!isAdmin) return;
    const isMarking=!drawn.includes(n);
    const next=isMarking?[...drawn,n]:drawn.filter(x=>x!==n);
    await set(ref(db,DB_DRAWN),next.length?Object.fromEntries(next.map((v,i)=>[i,v])):null);
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
            update(ref(db,DB_STATE),{ alreadyWon:true, currentWinner:snap.val() });
          }
          break;
        }
      }
    }
  };

  const resetSort = async () => {
    await set(ref(db,DB_DRAWN),null);
    await update(ref(db,DB_STATE),{ alreadyWon:false, currentWinner:null });
    setShowResetModal(false); showToast("Sorteo reiniciado");
  };

    const addWinner = async () => {
    if (!winnerName.trim()||!winnerCard.trim()) return showToast("Completa campos","err");
    const winnerKey = `${activeGame.id}_${winnerCard.trim()}`;
            await set(ref(db,`${DB_WINNERS}/${winnerKey}`),{ id:winnerKey, name:winnerName.trim(), card:winnerCard.trim(), game:activeGame.name, gameId:activeGame.id, time:new Date().toLocaleTimeString("es-CL"), ts:Date.now(), drawn:[...drawn] });
    showToast("🏆 ¡Ganador registrado!"); setWinnerName(""); setWinnerCard("");
  };

  const deleteWinner = async (id) => await remove(ref(db,`${DB_WINNERS}/${id}`));

  const handlePrintCards = () => {
    const cardsToPrint=cards.filter(c=>c.grid);
    if (!cardsToPrint.length) return showToast("No hay cartones para imprimir","err");
    const printWindow=window.open('','_blank');
    let html=`<!DOCTYPE html><html><head><title>Imprimir Cartones</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Stencil&family=Varsity&display=swap" rel="stylesheet">
    <style>
      *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
      body{font-family:sans-serif;margin:0;padding:10mm;box-sizing:border-box;}
      .grid-container{display:grid;grid-template-columns:1fr 1fr;gap:8mm;}
      .card-box{width:100mm;height:130mm;border:2px solid #000;padding:3mm;border-radius:8px;text-align:center;page-break-inside:avoid;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;position:relative;overflow:hidden;background:#fff;}
      .color-strip{height:5mm;width:100%;position:absolute;top:0;left:0;}
      .game-info{font-family:'Stencil',sans-serif;font-size:13px;margin-top:2mm;margin-bottom:2mm;color:#000;border-top:1px dashed #aaa;border-bottom:1px dashed #aaa;padding:2mm 0;}
      .bingo-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:0;height:100mm;margin-top:2mm;}
      .bingo-cell{display:flex;align-items:center;justify-content:center;border-radius:2px;font-family:'Stencil',sans-serif;font-size:45px;font-weight:400;border:1px solid #bbb;height:85%;width:85%;margin:auto;}
      .footer-info{font-size:8px;color:#000;margin-top:3mm;border-top:1px dashed #000;padding-top:2mm;font-family:sans-serif;line-height:1.3;font-weight:600;}
      .no-print{text-align:center;margin-bottom:20px;}
      @media print{body{padding:5mm;}.no-print{display:none;}}
    </style></head><body>
    <div class="no-print"><h2>Cartones (${cardsToPrint.length})</h2><button onclick="window.print()" style="padding:10px 20px;font-size:16px;cursor:pointer;background:#4caf50;color:white;border:none;border-radius:5px;">🖨️ IMPRIMIR</button></div>
    <div class="grid-container">`;
    cardsToPrint.forEach(c=>{
      const gc2=c.gameId?(GAMES.find(g=>g.id===c.gameId)?.color||"#000"):"#000";
      const gn=c.gameId?c.gameId.replace('j',''):'?';
      html+=`<div class="card-box"><div class="color-strip" style="background:${gc2};"></div>
      <div class="game-info">JUEGO ${gn} | CARTÓN ${c.cardNum}</div>
      <div class="bingo-grid">
        ${Object.keys(COLS).map(l=>`<div class="bingo-cell" style="background:${gc2};color:white;border:none;font-size:20px;">${l}</div>`).join('')}
        ${Array.isArray(c.grid)&&c.grid[0]?c.grid[0].map((_,row)=>c.grid.map((col,ci)=>{ const val=col[row]; const isFree=val==="FREE"; return `<div class="bingo-cell" style="background:${isFree?"#facc15":"#f8fafc"};color:${isFree?"#000":"#222"};padding:2px;">${isFree?'<img src="qr-code.png" style="width:100%;height:100%;object-fit:contain;">':val}</div>`; }).join('')).join(''):''}
      </div>
      <div class="footer-info">BINGO SOLIDARIO CRISTIAN HIDALGO<br>ESCANEA EL QR DEL CENTRO PARA VER INFO DEL JUEGO</div></div>`;
    });
    html+=`</div></body></html>`;
    printWindow.document.write(html); printWindow.document.close();
  };

  const filteredCards    = cards.filter(c=>c.gameId===activeGame.id&&(c.cardNum.includes(search)||(c.owner&&c.owner.toLowerCase().includes(search.toLowerCase()))));
const filteredSold     = filteredCards.filter(c=>c.paid);
const visibleCards     = search ? filteredCards : filteredSold.slice(-10).reverse();
  const totalRecaudado   = cards.filter(c=>c.paid).length*PRICE;
  const jugadoresActuales = cards.filter(c=>c.paid&&c.gameId===activeGame.id).length;
  const gc = activeGame.color;
  const gameNum = activeGame.id.replace("j","");

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#172441 0%,#285289 50%,#0a101f 100%)", fontFamily:"sans-serif", color:"#1e293b", paddingBottom:60 }}>

      {/* ── HEADER ── */}
      <div style={{ background:"#ffffff", borderBottom:"1px solid #e2e8f0", padding:"14px 18px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10, boxShadow:"0 4px 6px -1px rgba(0,0,0,0.05)" }}>
        <div>
          <h1 style={{ margin:0, fontSize:20, fontWeight:800 }}>🎰 Bingo Solidario</h1>
          <p style={{ margin:"3px 0 0", fontSize:12, color:"#64748b" }}>{isAdmin?"👤 Admin":"👁 Visualización"}</p>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <button onClick={()=>setIsMuted(!isMuted)} style={{ background:isMuted?"#fee2e2":"#f0fdf4", border:"none", borderRadius:8, padding:"6px 10px", fontSize:20, cursor:"pointer" }}>{isMuted?"🔇":"🔊"}</button>
          {isAdmin&&(<>
            <div style={{ background:"#f8fafc", borderRadius:8, padding:"6px 14px", textAlign:"center", border:"1px solid #e2e8f0" }}><div style={{ fontSize:18, fontWeight:800, color:"#3b82f6" }}>{cards.length}</div><div style={{ fontSize:11, color:"#64748b" }}>Creados</div></div>
            <div style={{ background:"#f8fafc", borderRadius:8, padding:"6px 14px", textAlign:"center", border:"1px solid #e2e8f0" }}><div style={{ fontSize:18, fontWeight:800, color:"#16a34a" }}>${totalRecaudado.toLocaleString("es-CL")}</div><div style={{ fontSize:11, color:"#64748b" }}>Recaudado</div></div>
          </>)}
          {!isAdmin
            ?<button onClick={()=>setShowLogin(true)} style={{...btnS("#3b82f6"),fontSize:13,padding:"8px 14px"}}>🔐 Admin</button>
            :<button onClick={handleLogout} style={{...btnS("#ef4444"),fontSize:13,padding:"8px 14px"}}>Cerrar sesión</button>
          }
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{ display:"flex", borderBottom:"1px solid #e2e8f0", background:"#ffffff" }}>
        {TABS.map((t,i)=>(<button key={t} onClick={()=>setTab(i)} style={{ flex:1, padding:"12px 4px", background:"none", border:"none", color:tab===i?"#7c3aed":"#94a3b8", fontWeight:tab===i?700:400, fontSize:13, cursor:"pointer", borderBottom:tab===i?"2px solid #7c3aed":"2px solid transparent", fontFamily:"sans-serif" }}>{t}</button>))}
      </div>

      {/* ══ TAB SORTEO ══ */}
      {tab===2&&(
        <div style={{ padding:"16px 20px", width:"100%", boxSizing:"border-box", minHeight:"calc(100vh - 112px)", display:"flex", flexDirection:"column", gap:14, paddingBottom: isAdmin ? 90 : 60 }}>
          <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Poller+One&display=swap');
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
          `}</style>

          <div className="mobile-bingo-letters" style={{ display: 'none', justifyContent: 'space-around', marginBottom: 10 }}>
            {Object.keys(COLS).map((letter, idx) => (
              <div key={letter} style={{ width:50, height:50, borderRadius:12, flexShrink:0, background:BINGO_LETTER_COLORS[idx], display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Poller One', cursive", fontWeight:900, fontSize:24, color:"#fff", boxShadow:`0 0 12px ${BINGO_LETTER_COLORS[idx]}99` }}>{letter}</div>
            ))}
          </div>

          <div className="bingo-board-mobile" style={{ background:"rgba(255,255,255,0.06)", borderRadius:18, padding:"14px 16px", border:`1px solid ${gc}33`, display:"flex", flexDirection:"column" }}>
            {Object.entries(COLS).map(([letter,[min,max]],rowIdx)=>(
              <div key={letter} className="bingo-row" style={{ display:"flex", gap:5, marginBottom:rowIdx<4?6:0, alignItems:"center" }}>
                <div className="bingo-letter" style={{ width:44, height:44, borderRadius:10, flexShrink:0, background:BINGO_LETTER_COLORS[rowIdx], display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Poller One',cursive", fontWeight:900, fontSize:22, color:"#fff", boxShadow:`0 0 12px ${BINGO_LETTER_COLORS[rowIdx]}99` }}>{letter}</div>
                {Array.from({length:15},(_,i)=>i+min).map(n=>{
                  const isLast=n===lastDrawn; const isDrawn=drawn.includes(n);
                  return (
                    <div key={n} className="bingo-number" onClick={()=>toggleNumber(n)} style={{ flex:1, aspectRatio:"1/1", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"clamp(29px,3vw,50px)", fontWeight:700, fontFamily:"'Poller One',cursive", cursor:isAdmin?"pointer":"default", background:isDrawn?gc:"rgba(255,255,255,0.10)", color:isDrawn?"#fff":"rgba(131,128,128,0.72)",
textShadow:isDrawn?"0 0 15px #000, 0 0 5px #000":"none", border:isLast?`3px solid #fff`:isDrawn?`2px solid ${gc}`:"1px solid rgba(255,255,255,0.15)", boxShadow:isLast?`0 0 16px ${gc}`:isDrawn?`0 0 6px ${gc}88`:"none", transform:isLast?"scale(1.18)":"scale(1)", transition:"transform 0.15s" }}>{n}</div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* ── PANEL INFERIOR: 4 ZONAS ── */}
          <div className="panel-inferior-pc">

            {/* ZONA 1 — Patrón activo */}
            <div className="zona-patron" style={{ background:"rgba(255,255,255,0.07)", borderRadius:14, padding:"12px 10px", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8, border:`1px solid ${gc}44` }}>
              <div style={{ background:gc, borderRadius:8, padding:"3px 14px", fontSize:13, fontWeight:800, color:"#fff", letterSpacing:1 }}>JUEGO {gameNum}</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:2, width:100 }}>
                {Object.keys(COLS).map((l,i)=>(<div key={l} style={{ height:15, borderRadius:3, background:BINGO_LETTER_COLORS[i], display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, fontWeight:800, color:"#fff" }}>{l}</div>))}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:2, width:100 }}>
                {activePattern.grid.flat().map((cell,i)=>(<div key={i} style={{ height:15, borderRadius:3, background:cell?gc:"rgba(255,255,255,0.07)", border:cell?"none":"1px solid rgba(255,255,255,0.1)" }} />))}
              </div>
              <div style={{ fontSize:11, fontWeight:700, color:"#e2e8f0", textAlign:"center", lineHeight:1.3 }}>{activePattern.name}</div>
            </div>

            {/* ZONA 2 — Último número */}
            <div className="zona-ultimo" style={{ background:"rgba(255,255,255,0.07)", borderRadius:14, padding:12, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", border:`2px solid ${gc}`, boxShadow:`0 0 24px ${gc}44` }}>
              {lastDrawn ? (
                <>
                  <div style={{ fontSize:15, fontWeight:800, color:gc, marginBottom:2, fontFamily:"'Poller One',cursive" }}>{getLetterForNum(lastDrawn)} – {lastDrawn}</div>
                  <div style={{ fontSize:72, fontWeight:900, color:gc, lineHeight:1, fontFamily:"'Poller One',cursive", textShadow:`0 0 30px ${gc}` }}>{lastDrawn}</div>
                </>
              ):(
                <div style={{ fontSize:12, color:"#64748b", textAlign:"center", fontWeight:600, lineHeight:1.7 }}>{isAdmin?"Toca un\nnúmero":"Esperando\nsorteo..."}</div>
              )}
            </div>

            {/* ZONA 3 — Premio */}
            <div className="zona-premio" style={{ borderRadius:14, overflow:"hidden", border:`1px solid ${gc}33`, background:`linear-gradient(135deg,${gc}11,${gc}22)`, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <img src="/img.png" alt="Premio" style={{ width:"100%", height:"100%", objectFit:"contain", display:"block" }}
                onError={e=>{ e.target.style.display="none"; e.target.parentNode.innerHTML=`<div style="color:${gc};font-size:15px;font-weight:700;text-align:center;padding:20px;line-height:1.8;font-family:sans-serif">🏅 Información<br>del premio<br><span style='font-size:11px;color:#64748b'>Sube <code>img.png</code> a <code>public/</code></span></div>`; }}
              />
            </div>

            {/* ZONA 4 — Nº Jugadores */}
            <div className="zona-jugadores" style={{ background:"rgba(255,255,255,0.07)", borderRadius:14, padding:"12px 10px", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8, border:`1px solid ${gc}44` }}>
              <div style={{ fontSize:10, fontWeight:700, color:"#94a3b8", letterSpacing:2, textTransform:"uppercase" }}>Jugadores</div>
              <div style={{ fontSize:54, fontWeight:900, color:"#ffffff", lineHeight:1, fontFamily:"'Poller One',cursive", textShadow:`0 0 20px ${gc}88` }}>{jugadoresActuales}</div>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                <div style={{ background:gc, borderRadius:6, padding:"2px 12px", fontSize:11, fontWeight:800, color:"#fff" }}>{activeGame.name}</div>
                <div style={{ fontSize:10, color:"#64748b" }}>cartones vendidos</div>
              </div>
            </div>

          </div>

          {/* ── BOTONES FLOTANTES ADMIN ── */}
          {isAdmin&&!isFullscreen&&(
            <div className="btn-flotantes-mobile" style={{ position:"fixed", bottom:0, left:0, right:0, display:"flex", flexDirection:"row", justifyContent:"center", gap:12, padding:"12px 16px", background:"rgba(10,16,31,0.95)", backdropFilter:"blur(10px)", borderTop:"1px solid rgba(255,255,255,0.1)", zIndex:100 }}>
              <button onClick={()=>setShowPatternModal(true)} style={{ background:"rgba(255,255,255,0.08)", border:`2px solid ${gc}`, borderRadius:14, padding:"11px 24px", color:gc, fontWeight:700, fontSize:13, cursor:"pointer", backdropFilter:"blur(10px)", display:"flex", alignItems:"center", gap:8 }}>🎯 Patrón</button>
              <button onClick={()=>setShowGameModal(true)} style={{ background:gc, border:"none", borderRadius:14, padding:"11px 24px", color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer", display:"flex", alignItems:"center", gap:8, boxShadow:`0 4px 20px ${gc}66` }}>🎮 Juego</button>
              <button onClick={()=>setShowResetModal(true)} style={{ background:"rgba(255,255,255,0.08)", border:"2px solid #ef4444", borderRadius:14, padding:"11px 24px", color:"#ef4444", fontWeight:700, fontSize:13, cursor:"pointer", backdropFilter:"blur(10px)", display:"flex", alignItems:"center", gap:8 }}>🔄 Reiniciar</button>
            </div>
          )}
        </div>
      )}

      {/* ══ OTROS TABS ══ */}
      {tab!==2&&(
        <div style={{ padding:"18px 14px", maxWidth:760, margin:"0 auto" }}>

          {tab===0&&(<div style={{ marginTop:10 }}>
            {isAdmin&&(<>
              <div style={{ marginBottom:15 }}>
                <button onClick={()=>setShowGameModal(true)} style={{ background:activeGame.color, border:"none", borderRadius:10, padding:"10px 20px", fontSize:14, fontWeight:700, cursor:"pointer", color:["j2","j3","j5","j9","j12"].includes(activeGame.id)?"#000":"#fff", display:"flex", alignItems:"center", gap:8 }}>🎮 {activeGame.name} ▼</button>
              </div>
              <div style={{ background:activeGame.color+"15", borderRadius:13, padding:16, marginBottom:12, border:`1px solid ${activeGame.color}40` }}>
                <h3 style={{ margin:"0 0 12px", fontSize:14, color:activeGame.color }}>1. Generar cartones — {activeGame.name}</h3>
                <div style={{ display:"flex", gap:10 }}>
                  <input type="number" placeholder="Cantidad (ej: 50)" value={genQty} onChange={e=>setGenQty(e.target.value)} style={{...inpS,maxWidth:"60%"}} />
                  <button onClick={generatePool} style={{...btnS(activeGame.color),flex:1,color:["j2","j3","j5","j9","j12"].includes(activeGame.id)?"#000":"#fff"}}>Generar</button>
                </div>
                {cards.filter(c=>!c.paid&&c.gameId===activeGame.id).length>0&&(
                  <button onClick={deleteUnsoldPool} style={{...btnS("#64748b"),width:"100%",marginTop:10}}>🗑️ Borrar disponibles de {activeGame.name} ({cards.filter(c=>!c.paid&&c.gameId===activeGame.id).length})</button>
                )}
              </div>
              {cards.length>0&&(
                <button onClick={handlePrintCards} style={{...btnS("#6366f1"),width:"100%",padding:"12px",marginBottom:12,fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>🖨️ Imprimir Cartones ({cards.length})</button>
              )}
              <div style={{ background:"#ffffff", borderRadius:13, padding:16, marginBottom:18, border:"1px solid #e2e8f0", boxShadow:"0 4px 6px -1px rgba(0,0,0,0.1)" }}>
                <h3 style={{ margin:"0 0 12px", fontSize:14, color:"#334155" }}>2. Asignar — {activeGame.name} <span style={{ fontSize:11, color:"#94a3b8", fontWeight:400 }}>(Quedan {cards.filter(c=>!c.paid&&c.gameId===activeGame.id).length})</span></h3>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 100px", gap:10, marginBottom:10 }}>
                  <input placeholder="Nombre completo *" value={newOwner} onChange={e=>setNewOwner(e.target.value)} style={inpS} />
                  <input type="number" placeholder="Cant." value={newQty} onChange={e=>setNewQty(e.target.value)} onKeyDown={e=>e.key==="Enter"&&assignCard()} style={{...inpS,textAlign:"center"}} />
                </div>
                <button onClick={assignCard} style={{...btnS(activeGame.color),width:"100%",padding:"11px",color:["j2","j3","j5","j9","j12"].includes(activeGame.id)?"#000":"#fff"}}>Asignar</button>
              </div>
            </>)}
            <input placeholder="🔍 Buscar por N° cartón o nombre..." value={search} onChange={e=>setSearch(e.target.value)} style={{...inpS,width:"100%",marginBottom:12}} />
            {filteredCards.length>0&&(<div style={{ display:"flex", alignItems:"center", gap:12, padding:"0 16px 8px", fontSize:11, fontWeight:800, color:"#94a3b8", letterSpacing:"0.05em", borderBottom:"2px solid #e2e8f0", marginBottom:8 }}>
              <span style={{ minWidth:45 }}>CARTÓN</span><span style={{ flex:1 }}>ASISTENTE</span><span style={{ minWidth:70, textAlign:"center" }}>JUEGO</span><span style={{ textAlign:"right" }}>ESTADO</span>
            </div>)}
            {filteredCards.length===0&&<div style={{ textAlign:"center", color:"#94a3b8", padding:36 }}>Sin cartones</div>}
{!search&&filteredCards.length>10&&<div style={{ textAlign:"center", color:"#94a3b8", fontSize:12, padding:"8px 0" }}>Mostrando últimos 10 de {filteredCards.length} — busca por nombre o número para filtrar</div>}
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {visibleCards.map(c=>{
                const gameColor=GAMES.find(g=>g.id===c.gameId)?.color||"#94a3b8";
const gameTextColor=["j2","j3","j5","j9","j12"].includes(c.gameId)?"#000":"#fff";
                return (<div key={c.id}>
                  <div onClick={()=>setSelectedCard(selectedCard?.id===c.id?null:c)} style={{ background:"#ffffff", borderRadius:selectedCard?.id===c.id?"12px 12px 0 0":12, padding:"12px 16px", display:"flex", alignItems:"center", gap:12, cursor:"pointer", border:"1px solid #e2e8f0", boxShadow:"0 1px 3px rgba(0,0,0,0.05)", borderLeft:`4px solid ${gameColor}` }}>
                    <div style={{ background:gameColor, borderRadius:8, padding:"4px 10px", fontSize:13, fontWeight:800, color:gameTextColor, minWidth:45, textAlign:"center" }}>{c.cardNum}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:14, color:c.paid?"#1e293b":"#94a3b8" }}>{c.paid?c.owner:"Disponible"}</div>
                      <div style={{ fontSize:11, color:"#94a3b8" }}>{c.gameName||"Sin juego"}</div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:c.paid?"#16a34a":"#94a3b8" }}>{c.paid?"✓ Vendido":"⏳ Espera"}</div>
                      {isAdmin&&<button onClick={e=>{e.stopPropagation();setConfirmDelete(c);}} style={{...btnS("#ef4444"),padding:"4px 8px",fontSize:11}}>✕</button>}
                    </div>
                  </div>
                  {selectedCard?.id===c.id&&c.grid&&(<div style={{ background:"#ffffff", borderRadius:"0 0 12px 12px", padding:16, border:"1px solid #e2e8f0", borderTop:"none", boxShadow:"0 4px 6px -1px rgba(0,0,0,0.1)" }}>
                    <p style={{ fontSize:12, color:"#94a3b8", textAlign:"center", marginBottom:12 }}>Números marcados ya salieron</p>
                    <CardGrid card={c} drawn={drawn} />
                  </div>)}
                </div>);
              })}
            </div>
          </div>)}

          {tab===1&&(<div>
            <h3 style={{ marginTop:0 }}>Asistentes</h3>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:22 }}>
              {[{label:"Vendidos",val:cards.filter(c=>c.paid).length,color:"#3b82f6"},{label:"Recaudado",val:`$${totalRecaudado.toLocaleString("es-CL")}`,color:"#16a34a"}].map(s=>(<div key={s.label} style={{ background:"#ffffff", borderRadius:12, padding:"14px 18px", border:"1px solid #e2e8f0", boxShadow:"0 1px 3px rgba(0,0,0,0.05)" }}><div style={{ fontSize:26, fontWeight:800, color:s.color }}>{s.val}</div><div style={{ fontSize:13, color:"#64748b" }}>{s.label}</div></div>))}
            </div>
            {cards.filter(c=>c.paid).length===0?<div style={{ textAlign:"center", color:"#94a3b8", padding:36 }}>Sin ventas aún</div>:cards.filter(c=>c.paid).map((c,i)=>(<div key={c.id} style={{ background:"#ffffff", borderRadius:9, padding:"11px 14px", display:"flex", justifyContent:"space-between", alignItems:"center", border:"1px solid #e2e8f0", marginBottom:7, borderLeft:`4px solid ${GAMES.find(g=>g.id===c.gameId)?.color||"#000"}` }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}><span style={{ color:"#94a3b8", fontSize:12, minWidth:20 }}>{i+1}</span><div><span style={{ fontWeight:700 }}>{c.owner}</span><span style={{ fontSize:12, color:"#64748b", marginLeft:8 }}>Cartón {c.cardNum}</span></div></div>
              <span style={{ fontSize:12, color:"#16a34a", fontWeight:700 }}>✓ $1.000</span>
            </div>))}
          </div>)}

                    {tab===3&&(<div>
            {isAdmin&&(<div style={{ background:"#ffffff", borderRadius:13, padding:16, border:"2px solid #fde68a", marginBottom:22, boxShadow:"0 4px 6px -1px rgba(0,0,0,0.1)" }}>
              <h3 style={{ margin:"0 0 12px", fontSize:14, color:"#92400e" }}>Registrar ganador manualmente</h3>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
                <input placeholder="Nombre" value={winnerName} onChange={e=>setWinnerName(e.target.value)} style={inpS} />
                <input placeholder="N° cartón" value={winnerCard} onChange={e=>setWinnerCard(e.target.value)} style={inpS} />
              </div>
              <button onClick={addWinner} style={{...btnS("#f59e0b"),width:"100%",padding:"11px"}}>🏆 Registrar</button>
            </div>)}
            {winners.length===0?<div style={{ textAlign:"center", color:"#94a3b8", padding:40 }}>Sin ganadores</div>:winners.map(w=>{
              const isExpanded = selectedWinner===(w.id||w.ts);
              const winnerCardData = cards.find(c=>c.cardNum===w.card&&c.gameId===w.gameId);
              const winnerPattern = PATTERNS.find(p => p.id === w.patternId) || activePattern;
              return (<div key={w.id||w.ts}>
                <div onClick={()=>setSelectedWinner(isExpanded?null:(w.id||w.ts))} style={{ background:"#ffffff", borderRadius:isExpanded?"12px 12px 0 0":12, padding:"14px 16px", display:"flex", alignItems:"center", gap:12, cursor:"pointer", border:"1px solid #fde68a", boxShadow:"0 1px 3px rgba(0,0,0,0.05)" }}>
                  <div style={{ fontSize:26 }}>🏆</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:15, color:"#92400e" }}>{w.name}</div>
                    <div style={{ fontSize:12, color:"#64748b" }}>Cartón #{w.card} · {w.game||""} · {w.time}</div>
                  </div>
                  {isAdmin&&<button onClick={e=>{e.stopPropagation();deleteWinner(w.id||w.ts);setSelectedWinner(null);}} style={{ background:"none", border:"none", color:"#94a3b8", cursor:"pointer", fontSize:16 }}>✕</button>}
                  <span style={{ color:"#94a3b8", fontSize:12 }}>{isExpanded?"▲":"▼"}</span>
                </div>
                {isExpanded&&winnerCardData&&winnerCardData.grid&&(
                  <div style={{ background:"#ffffff", borderRadius:"0 0 12px 12px", padding:16, border:"1px solid #fde68a", borderTop:"none", boxShadow:"0 4px 6px -1px rgba(0,0,0,0.1)" }}>
                    <p style={{ fontSize:12, color:"#92400e", textAlign:"center", marginBottom:4, fontWeight:700 }}>Patrón ganador</p>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:2, width:80, height:80, margin:"0 auto 12px" }}>
                      {winnerPattern.grid.flat().map((cell,i)=>(<div key={i} style={{ borderRadius:2, background:cell?"#f59e0b":"#f1f5f9", border:cell?"none":"1px solid #e2e8f0" }} />))}
                    </div>
                                                           <CardGrid card={winnerCardData} drawn={Array.isArray(w.drawn)?w.drawn:w.drawn?Object.values(w.drawn):drawn} pattern={winnerPattern} />
                  </div>
                )}
                {isExpanded&&!winnerCardData&&(
                  <div style={{ background:"#ffffff", borderRadius:"0 0 12px 12px", padding:16, border:"1px solid #fde68a", borderTop:"none", textAlign:"center", color:"#94a3b8", fontSize:13 }}>
                    Cartón #{w.card} no encontrado en los datos actuales
                  </div>
                )}
              </div>);
            })}
          </div>)}

        </div>
      )}
      {confirmDelete&&(
  <div onClick={()=>setConfirmDelete(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:300, backdropFilter:"blur(4px)" }}>
    <div onClick={e=>e.stopPropagation()} style={{ background:"#fff", borderRadius:20, padding:28, width:"min(360px,92vw)", textAlign:"center" }}>
      <div style={{ fontSize:40, marginBottom:12 }}>🗑️</div>
      <h3 style={{ margin:"0 0 8px", fontSize:18, color:"#1e293b" }}>¿Eliminar cartón?</h3>
      <p style={{ color:"#64748b", fontSize:14, margin:"0 0 8px" }}>Cartón <strong>{confirmDelete.cardNum}</strong></p>
      {confirmDelete.paid&&<p style={{ color:"#64748b", fontSize:14, margin:"0 0 20px" }}>Asignado a <strong>{confirmDelete.owner}</strong></p>}
      <div style={{ display:"flex", gap:12 }}>
        <button onClick={()=>setConfirmDelete(null)} style={{ flex:1, background:"#f1f5f9", border:"none", borderRadius:10, padding:"12px", color:"#64748b", fontWeight:700, fontSize:14, cursor:"pointer" }}>Cancelar</button>
        <button onClick={()=>{ deleteCard(confirmDelete.id); setConfirmDelete(null); }} style={{ flex:1, background:"#ef4444", border:"none", borderRadius:10, padding:"12px", color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer" }}>Eliminar</button>
      </div>
    </div>
  </div>
)}
      {confirmAssign&&(
  <div onClick={()=>setConfirmAssign(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:300, backdropFilter:"blur(4px)" }}>
    <div onClick={e=>e.stopPropagation()} style={{ background:"#fff", borderRadius:20, padding:28, width:"min(400px,92vw)", boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}>
      <div style={{ fontSize:32, textAlign:"center", marginBottom:8 }}>🎟️</div>
      <h3 style={{ textAlign:"center", margin:"0 0 20px", fontSize:18, color:"#1e293b" }}>Confirmar asignación</h3>
      <div style={{ background:"#f8fafc", borderRadius:12, padding:16, marginBottom:20, border:"1px solid #e2e8f0" }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
          <span style={{ color:"#64748b", fontSize:14 }}>Nombre</span>
          <span style={{ fontWeight:700, fontSize:14, color:"#1e293b" }}>{confirmAssign.owner}</span>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
          <span style={{ color:"#64748b", fontSize:14 }}>Cantidad</span>
          <span style={{ fontWeight:700, fontSize:14, color:"#1e293b" }}>{confirmAssign.qty} cartón{confirmAssign.qty>1?"es":""}</span>
        </div>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <span style={{ color:"#64748b", fontSize:14 }}>Buscar y agregar</span>
          <input placeholder="Ej: 045" style={{ background:"#f1f5f9", border:"1px solid #e2e8f0", borderRadius:8, padding:"6px 10px", fontSize:13, width:"60%", outline:"none", fontFamily:"sans-serif" }}
            onChange={e=>{
              const val=e.target.value.trim();
              if (!val) return;
              const found=confirmAssign.available.filter(c=>!c.paid&&c.cardNum.includes(val.padStart(3,"0")));
              if (found.length===1) {
                const alreadySel=confirmAssign.selected.includes(found[0].id);
                if (!alreadySel && confirmAssign.selected.length<confirmAssign.qty) {
                  setConfirmAssign(p=>{
                    const newSelected=[...p.selected, found[0].id];
                    return {...p, selected:newSelected, nums:p.available.filter(x=>newSelected.includes(x.id)).map(x=>x.cardNum)};
                  });
                } else if (!alreadySel && confirmAssign.selected.length>=confirmAssign.qty) {
                  showToast(`Máximo ${confirmAssign.qty} cartón${confirmAssign.qty>1?"es":""}`, "err");
                }
                e.target.value="";
                setTimeout(()=>{
                  const el=document.getElementById(`carton-${found[0].id}`);
                  if(el) el.scrollIntoView({behavior:"smooth", block:"center"});
                },100);
              }
            }}
          />
        </div>


        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <span style={{ color:"#64748b", fontSize:14 }}>Cartones</span>
          <div id="cartones-list" style={{ display:"flex", gap:6, flexWrap:"wrap", justifyContent:"flex-end", maxWidth:"70%", maxHeight:120, overflowY:"auto", padding:"4px 0" }}>
            {confirmAssign.available.filter(c=>!c.paid).map(c=>{
              const isSel=confirmAssign.selected.includes(c.id);
              return (<span id={`carton-${c.id}`} key={c.id} onClick={()=>{
                const alreadySel=confirmAssign.selected.includes(c.id);
                if (alreadySel) {
                  if (confirmAssign.selected.length<=1) return;
                  setConfirmAssign(p=>({...p, selected:p.selected.filter(id=>id!==c.id), nums:p.available.filter(x=>p.selected.filter(id=>id!==c.id).includes(x.id)).map(x=>x.cardNum)}));
                } else {
                  if (confirmAssign.selected.length>=confirmAssign.qty) return;
                  setConfirmAssign(p=>({...p, selected:[...p.selected,c.id], nums:p.available.filter(x=>[...p.selected,c.id].includes(x.id)).map(x=>x.cardNum)}));
                }
              }} style={{ background:isSel?activeGame.color:"#e2e8f0", color:isSel?(["j2","j3","j5","j9","j12"].includes(activeGame.id)?"#000":"#fff"):"#64748b", borderRadius:6, padding:"4px 10px", fontSize:13, fontWeight:700, cursor:"pointer", border:isSel?`2px solid ${activeGame.color}`:"2px solid #e2e8f0" }}>{c.cardNum}</span>);
            })}
          </div>
        </div>
      </div>

      {confirmAssign.selected.length>0&&(
  <div style={{ background:"#f8fafc", borderRadius:10, padding:"10px 14px", marginBottom:16, border:"1px solid #e2e8f0" }}>
    <div style={{ fontSize:12, color:"#64748b", marginBottom:8, fontWeight:600 }}>Cartones seleccionados ({confirmAssign.selected.length}/{confirmAssign.qty})</div>
    <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
      {confirmAssign.available.filter(c=>confirmAssign.selected.includes(c.id)).map(c=>(
        <span key={c.id} onClick={()=>{
          setConfirmAssign(p=>{
            const newSelected=p.selected.filter(id=>id!==c.id);
            return {...p, selected:newSelected, nums:p.available.filter(x=>newSelected.includes(x.id)).map(x=>x.cardNum)};
          });
        }} style={{ background:activeGame.color, color:["j2","j3","j5","j9","j12"].includes(activeGame.id)?"#000":"#fff", borderRadius:6, padding:"4px 10px", fontSize:13, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
          {c.cardNum} <span style={{ fontSize:10, opacity:0.7 }}>✕</span>
        </span>
      ))}
    </div>
  </div>
)}
      <div style={{ display:"flex", gap:12 }}>
        <button onClick={()=>setConfirmAssign(null)} style={{ flex:1, background:"#f1f5f9", border:"none", borderRadius:10, padding:"12px", color:"#64748b", fontWeight:700, fontSize:14, cursor:"pointer" }}>Cancelar</button>
        <button onClick={confirmAssignCard} style={{ flex:1, background:activeGame.color, border:"none", borderRadius:10, padding:"12px", color:["j2","j3","j5","j9","j12"].includes(activeGame.id)?"#000":"#fff", fontWeight:700, fontSize:14, cursor:"pointer" }}>Confirmar</button>
      </div>
    </div>
  </div>
)}

      {toast&&<div style={{ position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)", background:toast.type==="err"?"#ef4444":"#10b981", color:"#fff", padding:"12px 24px", borderRadius:12, fontWeight:700, fontSize:14, zIndex:999, boxShadow:"0 10px 15px -3px rgba(0,0,0,0.1)", whiteSpace:"nowrap", fontFamily:"sans-serif" }}>{toast.msg}</div>}
      {showLogin&&<LoginModal pwInput={pwInput} setPwInput={setPwInput} pwError={pwError} onLogin={handleLogin} onClose={()=>{setShowLogin(false);setPwInput("");setPwError(false);}} />}
      {showPatternModal&&<PatternModal activePattern={activePattern} activeGame={activeGame} onSelect={handleSelectPattern} onClose={()=>setShowPatternModal(false)} />}
      {showGameModal&&<GameModal activeGame={activeGame} onSelect={handleSelectGame} onClose={()=>setShowGameModal(false)} />}
      {showResetModal&&<ResetModal onConfirm={resetSort} onClose={()=>setShowResetModal(false)} />}
      {winnerPopup&&<WinnerPopup winner={winnerPopup} onClose={()=>setWinnerPopup(null)} />}
    </div>
  );
}

function LoginModal({ pwInput, setPwInput, pwError, onLogin, onClose }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, backdropFilter:"blur(5px)" }} onClick={onClose}>
      <div style={{ background:"#1a1d2b", border:"1px solid #2e3244", borderRadius:15, padding:30, width:320, textAlign:"center" }} onClick={e=>e.stopPropagation()}>
        <div style={{ fontSize:32, marginBottom:8 }}>🔐</div>
        <h3 style={{ color:"#e8b75a", marginBottom:20 }}>Panel de Control</h3>
        <input style={{ background:pwError?"rgba(239,68,68,0.15)":"#1a1d2b", border:`1px solid ${pwError?"#ef4444":"#2e3244"}`, color:"white", borderRadius:8, padding:15, width:"100%", outline:"none", fontSize:18, textAlign:"center", letterSpacing:6, fontFamily:"sans-serif", boxSizing:"border-box" }} type="password" placeholder="PIN" value={pwInput} onChange={e=>setPwInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&onLogin()} autoFocus />
        {pwError&&<p style={{ color:"#ef4444", fontSize:13, marginTop:8 }}>PIN incorrecto</p>}
        <button style={{ background:"#e8b75a", color:"#0a0a1a", border:"none", borderRadius:8, padding:12, width:"100%", marginTop:15, fontWeight:700, fontSize:15, cursor:"pointer" }} onClick={onLogin}>Entrar</button>
      </div>
    </div>
  );
}