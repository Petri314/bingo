import React from "react";

export default function LoginModal({ pwInput, setPwInput, pwError, onLogin, onClose }) {
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