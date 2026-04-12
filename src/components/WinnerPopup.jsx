import { GAMES } from "../constants/index.js";
import { getTextColor } from "../utils.js";

export default function WinnerPopup({ winner, onClose }) {
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

      {[{l:"8%",delay:"0s",dur:"3.2s"},{l:"20%",delay:"0.35s",dur:"2.8s"},{l:"34%",delay:"0.8s",dur:"3.6s"},{l:"50%",delay:"0.15s",dur:"3.0s"},{l:"63%",delay:"0.6s",dur:"2.6s"},{l:"77%",delay:"1.0s",dur:"3.4s"},{l:"90%",delay:"0.45s",dur:"2.9s"},{l:"42%",delay:"1.3s",dur:"3.1s"}].map((b, i) => (
        <div key={"b"+i} className="balloon-float" style={{ left:b.l, animationDelay:b.delay, animationDuration:b.dur }}>🎈</div>
      ))}
      {Array.from({length:22}).map((_, i) => (
        <div key={"cf"+i} className="confetti-piece" style={{ left:`${(i*4.5)%100}%`, width:i%4===0?12:8, height:i%4===0?12:8, borderRadius:i%3===0?"50%":2, background:["#ef4444","#3b82f6","#f59e0b","#22c55e","#a855f7","#ec4899","#14b8a6","#f97316"][i%8], animationDuration:`${2.2+(i%5)*0.35}s`, animationDelay:`${(i*0.14).toFixed(2)}s` }} />
      ))}

      <div className="winner-pop-card" onClick={e => e.stopPropagation()} style={{ background:"#0f1221", border:`3px solid ${gc}`, borderRadius:26, padding:"38px 44px", textAlign:"center", maxWidth:400, width:"92vw", boxShadow:`0 0 80px ${gc}66, 0 0 160px ${gc}22`, position:"relative", zIndex:502 }}>
        <div className="star-pop" style={{ fontSize:20, position:"absolute", top:18, left:22, animationDelay:"0.2s" }}>⭐</div>
        <div className="star-pop" style={{ fontSize:16, position:"absolute", top:22, right:26, animationDelay:"0.4s" }}>✨</div>
        <div className="star-pop" style={{ fontSize:14, position:"absolute", bottom:60, left:18, animationDelay:"0.6s" }}>🌟</div>
        <div className="star-pop" style={{ fontSize:14, position:"absolute", bottom:64, right:20, animationDelay:"0.5s" }}>⭐</div>
        <div style={{ fontSize:62, marginBottom:6, lineHeight:1 }}>🏆</div>
        <div className="shimmer-winner" style={{ fontSize:12, fontWeight:700, letterSpacing:5, color:gc, marginBottom:20, textTransform:"uppercase", fontFamily:"sans-serif" }}>¡Tenemos ganador!</div>
        <div style={{ background:`${gc}18`, borderRadius:16, padding:"20px 24px", marginBottom:18, border:`1.5px solid ${gc}55` }}>
          <div style={{ fontSize:30, fontWeight:800, color:"#ffffff", marginBottom:6, fontFamily:"sans-serif", lineHeight:1.2 }}>{winner.name}</div>
          <div style={{ fontSize:16, color:"#94a3b8", fontFamily:"sans-serif" }}>Cartón <span style={{ color:gc, fontWeight:800, fontSize:18 }}>{winner.card}</span></div>
        </div>
        <div style={{ marginBottom:28, fontFamily:"sans-serif" }}>
          <div style={{ fontSize:15, color:"#e2e8f0", marginBottom:6 }}>Ha ganado el <span style={{ color:gc, fontWeight:700 }}>{winner.game}</span></div>
          <div style={{ fontSize:20, fontWeight:800, color:"#ffffff", letterSpacing:1 }}>¡Felicitaciones! 🎉</div>
        </div>
        <button onClick={onClose} style={{ background:gc, border:"none", borderRadius:14, padding:"14px 0", color:getTextColor(gc), fontWeight:700, fontSize:16, cursor:"pointer", width:"100%", fontFamily:"sans-serif", letterSpacing:0.5, boxShadow:`0 4px 24px ${gc}66` }}>Cerrar</button>
      </div>
    </div>
  );
}
