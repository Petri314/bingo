import { GAMES } from "../constants/index.js";
import { getTextColor } from "../utils.js";

export default function GameModal({ activeGame, onSelect, onClose }) {
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:300, backdropFilter:"blur(4px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ background:"#1a1d2b", border:"1px solid #2e3244", borderRadius:20, padding:28, width:"min(460px,95vw)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22 }}>
          <h3 style={{ margin:0, color:"#fff", fontSize:18, fontWeight:700 }}>Seleccionar juego</h3>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#94a3b8", fontSize:22, cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          {GAMES.map(g => {
            const sel = activeGame.id === g.id;
            return (
              <button key={g.id} onClick={() => { onSelect(g); onClose(); }} style={{ background:sel ? g.color : "#252838", border:`2px solid ${sel ? g.color : "#2e3244"}`, borderRadius:14, padding:"16px 12px", cursor:"pointer", display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:18, height:18, borderRadius:"50%", background:g.color, flexShrink:0, border:sel ? (["j2","j3","j5","j9","j12"].includes(g.id) ? "2px solid #000" : "2px solid #fff") : "none" }} />
                <span style={{ fontSize:14, fontWeight:700, color:sel ? getTextColor(g.color) : "#e2e8f0" }}>{g.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}