import { PATTERNS, BINGO_LETTER_COLORS } from "../constants/index.js";

export default function PatternModal({ activePattern, activeGame, onSelect, onClose }) {
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:300, backdropFilter:"blur(4px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ background:"#1a1d2b", border:"1px solid #2e3244", borderRadius:20, padding:28, width:"min(680px,95vw)", maxHeight:"90vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22 }}>
          <h3 style={{ margin:0, color:"#fff", fontSize:18, fontWeight:700 }}>Seleccionar patrón</h3>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#94a3b8", fontSize:22, cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:14 }}>
          {PATTERNS.map(p => {
            const sel = activePattern.id === p.id;
            return (
              <button key={p.id} onClick={() => { onSelect(p); onClose(); }} style={{ background:sel ? activeGame.color + "22" : "#252838", border:`2px solid ${sel ? activeGame.color : "#2e3244"}`, borderRadius:14, padding:"14px 10px", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:3, width:80, height:80 }}>
                  {p.grid.flat().map((cell, i) => (
                    <div key={i} style={{ borderRadius:2, background:cell ? (sel ? activeGame.color : "#60a5fa") : "#1e2235" }} />
                  ))}
                </div>
                <span style={{ fontSize:12, fontWeight:700, color:sel ? activeGame.color : "#94a3b8", textAlign:"center", lineHeight:1.3 }}>{p.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
