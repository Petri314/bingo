import React from "react";

export default function ResetModal({ onConfirm, onClose }) {
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