import { PATTERNS, BINGO_LETTER_COLORS } from "../constants/index.js";
import { getTextColor } from "../utils.js";

// Mini visualización de un grid 5x5 con color de relleno y opcionalmente
// celdas "overlay" en otro color (para mostrar binguito sobre bingo).
function PatternGrid({ grid, fillColor, size = 80 }) {
  const cellSize = size / 5;
  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:2, width:size, height:size }}>
      {grid.flat().map((cell, i) => (
        <div
          key={i}
          style={{
            borderRadius: 2,
            background: cell ? fillColor : "rgba(255,255,255,0.06)",
            border: cell ? "none" : "1px solid rgba(255,255,255,0.08)",
          }}
        />
      ))}
    </div>
  );
}

// Grid combinado: muestra bingo completo en tenue + binguito encima en color vivo
function CombinedGrid({ bingoGrid, binguitoGrid, bingoColor, binguitoColor, size = 80 }) {
  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:2, width:size, height:size }}>
      {bingoGrid.flat().map((cell, i) => {
        const row = Math.floor(i / 5);
        const col = i % 5;
        const isBinguito = binguitoGrid[row][col];
        const isBingo    = cell && !isBinguito;
        return (
          <div
            key={i}
            style={{
              borderRadius: 2,
              background: isBinguito
                ? binguitoColor
                : isBingo
                  ? `${bingoColor}44`
                  : "rgba(255,255,255,0.06)",
              border: (!isBinguito && !isBingo) ? "1px solid rgba(255,255,255,0.08)" : "none",
              boxShadow: isBinguito ? `0 0 4px ${binguitoColor}88` : "none",
            }}
          />
        );
      })}
    </div>
  );
}

export default function PatternModal({ activePattern, activeGame, onSelect, onClose }) {
  const gc = activeGame.color;
  const binguitoColor = "#f59e0b"; // amarillo constante para el binguito

  return (
    <div
      onClick={onClose}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:300, backdropFilter:"blur(4px)" }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background:"#1a1d2b", border:"1px solid #2e3244", borderRadius:20, padding:28, width:"min(720px,96vw)", maxHeight:"90vh", overflowY:"auto" }}
      >
        {/* Encabezado */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <h3 style={{ margin:0, color:"#fff", fontSize:18, fontWeight:700 }}>Seleccionar patrón</h3>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#94a3b8", fontSize:22, cursor:"pointer" }}>✕</button>
        </div>

        {/* Leyenda */}
        <div style={{ display:"flex", gap:16, marginBottom:18, flexWrap:"wrap" }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:"#94a3b8" }}>
            <div style={{ width:12, height:12, borderRadius:2, background:binguitoColor }} />
            Binguito (subpatrón)
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:"#94a3b8" }}>
            <div style={{ width:12, height:12, borderRadius:2, background:`${gc}55` }} />
            Bingo (patrón completo)
          </div>
        </div>

        {/* Grilla de patrones */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))", gap:14 }}>
          {PATTERNS.map(p => {
            const sel = activePattern.id === p.id;
            return (
              <button
                key={p.id}
                onClick={() => { onSelect(p); onClose(); }}
                style={{
                  background: sel ? `${gc}18` : "#252838",
                  border: `2px solid ${sel ? gc : "#2e3244"}`,
                  borderRadius: 14,
                  padding: "14px 10px",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                  transition: "border-color 0.15s",
                }}
              >
                {/* Grid combinado binguito + bingo */}
                {p.binguito ? (
                  <CombinedGrid
                    bingoGrid={p.grid}
                    binguitoGrid={p.binguito.grid}
                    bingoColor={sel ? gc : "#60a5fa"}
                    binguitoColor={binguitoColor}
                    size={90}
                  />
                ) : (
                  <PatternGrid
                    grid={p.grid}
                    fillColor={sel ? gc : "#60a5fa"}
                    size={90}
                  />
                )}

                {/* Nombre del patrón */}
                <span style={{ fontSize:12, fontWeight:700, color: sel ? gc : "#e2e8f0", textAlign:"center", lineHeight:1.3 }}>
                  {p.name}
                </span>

                {/* Etiqueta binguito */}
                {p.binguito && (
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3, width:"100%" }}>
                    <div style={{ width:"100%", height:1, background:"rgba(255,255,255,0.08)", marginBottom:2 }} />
                    <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                      <div style={{ width:8, height:8, borderRadius:1, background:binguitoColor, flexShrink:0 }} />
                      <span style={{ fontSize:10, color:"#f59e0b", fontWeight:600, textAlign:"center", lineHeight:1.3 }}>
                        {p.binguito.name}
                      </span>
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}