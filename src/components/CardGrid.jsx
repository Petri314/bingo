import React from "react";
import { COLS, GAMES } from "../constants/index.js";

function CardGrid({ card, drawn, pattern }) {
  const gameColor = GAMES.find(g => g.id === card.gameId)?.color || "#64748b";
  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:5, maxWidth:150, margin:"0 auto" }}>
      {Object.keys(COLS).map(l => (
        <div key={l} style={{ background:gameColor, borderRadius:6, textAlign:"center", padding:"6px 0", fontWeight:800, fontSize:16, color:"#fff", opacity:0.9 }}>{l}</div>
      ))}
      {card.grid[0].map((_, row) => card.grid.map((col, colIdx) => {
        const val = col[row];
        const isFree = val === "FREE";
        const isOut = !isFree && drawn.includes(val);
        const isPattern = pattern ? pattern.grid[row][colIdx] : false;
        if (pattern && !isPattern && !isFree) return (
          <div key={`${colIdx}-${row}`} style={{ background:"#f1f5f9", borderRadius:6, aspectRatio:"1/1", border:"1px solid #e2e8f0" }} />
        );
        return (
          <div key={`${colIdx}-${row}`} style={{
            background: isFree ? "#e0ded8" : isOut ? gameColor : "#f8fafc",
            borderRadius: 6, padding: "2px", textAlign: "center",
            fontSize: isFree ? 9 : 14, fontWeight: 700,
            color: isFree ? "#000" : isOut ? "#fff" : "#64748b",
            border: isPattern ? `2.5px solid ${isOut ? "#fbbf24" : "#f59e0b"}` : "1px solid #e2e8f0",
            boxShadow: isPattern && isOut ? "0 0 8px #fbbf2488" : "none",
            position: "relative"
          }}>
            {isFree ? "👁️" : val}
            {isPattern && isOut && <span style={{ position:"absolute", top:-2, right:-2, fontSize:8 }}>⭐</span>}
          </div>
        );
      }))}
    </div>
  );
}

export const CardGridMemo = React.memo(CardGrid, (prev, next) => {
  return (
    prev.card.id === next.card.id &&
    prev.drawn.length === next.drawn.length &&
    prev.pattern?.id === next.pattern?.id
  );
});

export default CardGrid;
