import React, { useMemo, useState } from "react";
import { CATEGORIAS, SUGERENCIAS_PRODUCTO } from "../constants/index.js";
import {
  EFECTIVO, TRANSFERENCIA, MEDIOS, TIPOS_GASTO,
  fmt, fmtSigno, horaLocal, diaLocal, fechaTexto, textoDia,
  totalesCaja, cuentasConSaldo, porProducto, porVendedor, cartonesEnCaja, resumenTexto, arqueo,
  estadoVenta, agruparPorDia,
} from "../caja.js";

// ── Estilos (los mismos del resto del panel admin) ────────────────────────────
const inp = { background:"#fff", border:"1px solid #e2e8f0", borderRadius:8, padding:"10px 12px", color:"#334155", fontSize:14, outline:"none", width:"100%", boxSizing:"border-box", fontFamily:"inherit" };
const btn = (color, extra={}) => ({ background:color, border:"none", borderRadius:8, padding:"9px 15px", fontWeight:700, fontSize:14, cursor:"pointer", color:"#fff", fontFamily:"inherit", whiteSpace:"nowrap", ...extra });
const card = { background:"#fff", borderRadius:14, padding:14, border:"1px solid #e2e8f0", boxShadow:"0 1px 3px rgba(0,0,0,0.05)" };
const soloNumero = (v) => { const n = parseInt(String(v ?? "").replace(/[^\d]/g, ""), 10); return Number.isFinite(n) ? n : 0; };
const emojiCat = (id) => CATEGORIAS.find(c => c.id === id)?.emoji || "📦";
const CAT_COLOR = { bebida:"#0ea5e9", comida:"#f97316", dulce:"#ec4899", carton:"#16a34a", otro:"#64748b" };
const AZUL = "#0ea5e9";

// Insignia numerada del paso: ✓ si ya está hecho, número si es el actual, atenuada si falta.
function Paso({ numero, titulo, extra, estado }) {
  const color = estado === "hecho" ? "#16a34a" : estado === "activo" ? AZUL : "#cbd5e1";
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
      <div style={{ width:28, height:28, borderRadius:"50%", background:color, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:14, flexShrink:0 }}>
        {estado === "hecho" ? "✓" : numero}
      </div>
      <div style={{ fontSize:15, fontWeight:800, color: estado === "listo" ? "#94a3b8" : "#1e293b" }}>{titulo}</div>
      <div style={{ marginLeft:"auto", fontSize:13, color:"#64748b", fontWeight:700 }}>{extra}</div>
    </div>
  );
}

// Sección plegable: por defecto el detalle de la venta y las cuentas van abiertos; las
// secciones de administración muestran su resumen en el título para no esconder nada.
function Plegable({ id, titulo, resumen, abierto, onToggle, children }) {
  return (
    <div id={id} style={{ ...card, marginBottom:12, padding:0, overflow:"hidden" }}>
      <div onClick={onToggle} style={{ display:"flex", alignItems:"center", gap:10, padding:"13px 14px", cursor:"pointer" }}>
        <div style={{ fontSize:15, fontWeight:800, color:"#1e293b" }}>{titulo}</div>
        <div style={{ marginLeft:"auto", fontSize:12, color:"#64748b", fontWeight:700 }}>{resumen}</div>
        <div style={{ fontSize:12, color:"#94a3b8" }}>{abierto ? "▲" : "▼"}</div>
      </div>
      {abierto && <div style={{ padding:"0 14px 14px" }}>{children}</div>}
    </div>
  );
}

export default function CajaPanel({
  isAdmin, productos = [], ventas = [], cuentas = [], pagos = [], gastos = [], cierres = [], config = {},
  currentPrice, vendedor, onCambiarVendedor, totalCartones = 0, cantidadCartones = 0,
  api, showToast,
}) {
  // Venta en curso
  const [ticket, setTicket] = useState([]);
  const [medio, setMedio] = useState(EFECTIVO);
  const [cuentaSel, setCuentaSel] = useState(null);
  const [cuentaNueva, setCuentaNueva] = useState("");
  // Cuentas al debe
  const [agregando, setAgregando] = useState(null);
  const [pagarOtro, setPagarOtro] = useState(null);
  const [pagoMonto, setPagoMonto] = useState("");
  const [pagoMedio, setPagoMedio] = useState(EFECTIVO);
  const [pagadasAbiertas, setPagadasAbiertas] = useState(false);
  // Historial
  const [soloHoy, setSoloHoy] = useState(true);
  const [editando, setEditando] = useState(null);
  // Secciones de administración (cerradas al entrar para no llenar la pantalla)
  const [abierto, setAbierto] = useState({ productos:false, gastos:false, cierre:false, resumen:false });
  const alternar = (id) => setAbierto(p => ({ ...p, [id]: !p[id] }));
  // Catálogo, gastos, arqueo
  const [prodNombre, setProdNombre] = useState("");
  const [prodPrecio, setProdPrecio] = useState("");
  const [prodCat, setProdCat] = useState("bebida");
  const [prodEdit, setProdEdit] = useState(null);
  const [gastoForm, setGastoForm] = useState({ concepto:"", monto:"", medio:EFECTIVO });
  const [inicial, setInicial] = useState(String(config?.efectivoInicial ?? ""));
  const [contado, setContado] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [nombreVendedor, setNombreVendedor] = useState("");

  const t = useMemo(() => totalesCaja({ ventas, cuentas, pagos, gastos, efectivoInicial: config?.efectivoInicial || 0 }), [ventas, cuentas, pagos, gastos, config]);
  const saldos = useMemo(() => cuentasConSaldo(cuentas, ventas, pagos), [cuentas, ventas, pagos]);
  const abiertas = saldos.filter(c => c.saldo > 0);
  const pagadas = saldos.filter(c => c.saldo <= 0 && c.cantidadLineas > 0);
  const nombreCuenta = (id) => saldos.find(c => c.id === id)?.nombre || "cuenta";
  const productosActivos = useMemo(
    () => productos.filter(p => p.activo !== false).sort((a, b) => (a.orden || 0) - (b.orden || 0) || String(a.nombre).localeCompare(String(b.nombre), "es")),
    [productos]);
  const venta = estadoVenta({ lineas: ticket, medio, cuentaId: cuentaSel, cuentaNombre: cuentaNueva });
  const caja = arqueo({ esperadoEfectivo: t.esperadoEfectivo, contado });
  const cartones = useMemo(() => cartonesEnCaja(ventas), [ventas]);

  const filas = useMemo(() => {
    const hoy = diaLocal(Date.now());
    const de = (lista, tipoMov) => lista.filter(x => !soloHoy || diaLocal(x.ts) === hoy).map(x => ({ ...x, tipoMov }));
    return agruparPorDia([...de(ventas, "venta"), ...de(pagos, "pago"), ...de(gastos, "gasto")]);
  }, [ventas, pagos, gastos, soloHoy]);
  const totalFilas = filas.reduce((a, g) => a + g.filas.length, 0);

  const textoResumen = useMemo(
    () => resumenTexto({ ventas, cuentas, pagos, gastos, efectivoInicial:t.efectivoInicial, contado },
      { titulo:"BINGO SOLIDARIO — CAJA", cartonesEntregados: cantidadCartones ? totalCartones : null }),
    [ventas, cuentas, pagos, gastos, t.efectivoInicial, contado, cantidadCartones, totalCartones]);

  // ── Vender ──────────────────────────────────────────────────────────────────
  const agregarAlTicket = (prod) => {
    const clave = `${prod.productoId}@${prod.precioUnitario}`;
    setTicket(prev => {
      const i = prev.findIndex(l => l.clave === clave);
      if (i === -1) return [...prev, { clave, ...prod, cantidad:1 }];
      const copia = [...prev];
      copia[i] = { ...copia[i], cantidad:copia[i].cantidad + 1 };
      return copia;
    });
  };
  const cambiarCantidad = (clave, delta) => setTicket(prev =>
    prev.map(l => l.clave === clave ? { ...l, cantidad:l.cantidad + delta } : l).filter(l => l.cantidad > 0));

  const registrarVenta = async () => {
    let cuentaId = null, nombre = "";
    if (medio === "debe") {
      nombre = (cuentaSel ? nombreCuenta(cuentaSel) : cuentaNueva.trim());
      cuentaId = cuentaSel;
      if (!cuentaId) { cuentaId = await api.crearCuenta(nombre); setCuentaNueva(""); }
    }
    await api.registrarVenta({ lineas:ticket, medio: cuentaId ? null : medio, cuentaId });
    showToast(medio === "debe"
      ? `📝 ${fmt(venta.total)} al debe de "${nombre}"`
      : `✓ ${fmt(venta.total)} cobrado en ${medio === TRANSFERENCIA ? "transferencia" : medio}`);
    setTicket([]);
    if (medio === "debe") setCuentaSel(cuentaId);
  };

  const registrarPago = async (cuenta, monto, medioPago) => {
    if (!monto || monto <= 0) return showToast("Escribe el monto del pago", "err");
    await api.registrarPago({ cuentaId:cuenta.id, monto, medio:medioPago });
    showToast(`✓ ${fmt(monto)} recibido de ${cuenta.nombre}`);
    setPagarOtro(null); setPagoMonto(""); setPagoMedio(EFECTIVO);
  };

  const agregarACuenta = async (cuenta, p) => {
    await api.registrarVenta({ lineas:[{ productoId:p.id, nombre:p.nombre, tipo:p.categoria === "carton" ? "carton" : "producto", precioUnitario:p.precio, cantidad:1 }], medio:null, cuentaId:cuenta.id });
    showToast(`+ ${p.nombre} a ${cuenta.nombre}`);
  };

  const reiniciarVendedor = () => {
    const nombre = nombreVendedor.trim();
    if (!nombre) return showToast("Escribe tu nombre", "err");
    onCambiarVendedor(nombre); setNombreVendedor("");
  };

  const copiarResumen = async () => {
    try {
      await navigator.clipboard.writeText(textoResumen);
      setCopiado(true); setTimeout(() => setCopiado(false), 2000);
      showToast("📋 Resumen copiado");
    } catch { showToast("Mantén presionado el texto para copiarlo", "err"); }
  };

  // ── Pantallas previas ───────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div style={{ ...card, maxWidth:420, margin:"40px auto", textAlign:"center" }}>
        <div style={{ fontSize:40, marginBottom:10 }}>🔐</div>
        <h3 style={{ margin:"0 0 8px", fontSize:17, color:"#1e293b" }}>La caja es solo para el equipo</h3>
        <p style={{ margin:0, fontSize:13, color:"#64748b" }}>Entra con el PIN del admin (botón 🔐 Admin arriba a la derecha).</p>
      </div>
    );
  }
  if (!vendedor) {
    return (
      <div style={{ ...card, maxWidth:420, margin:"40px auto" }}>
        <div style={{ fontSize:40, textAlign:"center", marginBottom:10 }}>🙋</div>
        <h3 style={{ margin:"0 0 6px", fontSize:17, color:"#1e293b", textAlign:"center" }}>¿Quién está vendiendo?</h3>
        <p style={{ margin:"0 0 14px", fontSize:13, color:"#64748b", textAlign:"center" }}>
          Tu nombre queda en los registros que hagas.
        </p>
        <input autoFocus placeholder="Tu nombre" value={nombreVendedor} onChange={e => setNombreVendedor(e.target.value)}
          onKeyDown={e => e.key === "Enter" && reiniciarVendedor()} style={{ ...inp, textAlign:"center", marginBottom:10 }} />
        <button onClick={reiniciarVendedor} style={btn("#16a34a", { width:"100%", padding:12 })}>Empezar a vender</button>
      </div>
    );
  }

  // ── Piezas de la pantalla ───────────────────────────────────────────────────
  const estadoPaso = (n) => (venta.paso > n ? "hecho" : venta.paso === n ? "activo" : "pendiente");
  const estiloPaso = (n) => {
    const e = estadoPaso(n);
    return {
      ...card, marginBottom:10,
      border: e === "activo" ? `2px solid ${AZUL}` : "1px solid #e2e8f0",
      background: e === "pendiente" ? "#f8fafc" : "#fff",
      boxShadow: e === "activo" ? `0 4px 16px ${AZUL}33` : "0 1px 3px rgba(0,0,0,0.05)",
    };
  };

  const tileProducto = (p) => (
    <button key={p.id} onClick={() => agregarAlTicket({ productoId:p.id, nombre:p.nombre, tipo: p.categoria === "carton" ? "carton" : "producto", precioUnitario:p.precio })}
      style={{ background:"#fff", border:`2px solid ${(CAT_COLOR[p.categoria] || "#64748b")}44`, borderLeft:`5px solid ${CAT_COLOR[p.categoria] || "#64748b"}`, borderRadius:12, padding:"11px 12px", cursor:"pointer", textAlign:"left", fontFamily:"inherit", display:"flex", alignItems:"center", gap:10 }}>
      <span style={{ fontSize:22 }}>{emojiCat(p.categoria)}</span>
      <span style={{ flex:1 }}>
        <span style={{ display:"block", fontSize:14, fontWeight:800, color:"#1e293b", lineHeight:1.2 }}>{p.nombre}</span>
        <span style={{ display:"block", fontSize:13, fontWeight:800, color:"#16a34a" }}>{fmt(p.precio)}</span>
      </span>
      <span style={{ fontSize:18, color:AZUL, fontWeight:800 }}>＋</span>
    </button>
  );

  const stats = [
    { label:"Efectivo en caja", val:fmt(t.esperadoEfectivo), color:"#16a34a" },
    { label:"Transferencias", val:fmt(t.transferencia), color:"#3b82f6" },
    { label:`Al debe${abiertas.length ? ` (${abiertas.length})` : ""}`, val:fmt(t.porCobrar), color:"#f97316" },
    { label:"Neto en caja", val:fmt(t.cobrado), color:"#7c3aed" },
  ];

  // `x.tipo` es lo que se vendió (producto o cartón); `x.tipoMov` es qué pasó (venta, pago, gasto).
  const textoMov = (x) => {
    if (x.tipoMov === "venta") return { titulo:`${x.tipo === "carton" ? "🎟️ " : ""}${x.nombre} ×${x.cantidad}`, sub:`${fmt(x.precioUnitario)} c/u` };
    if (x.tipoMov === "pago") return { titulo:`Pago de ${nombreCuenta(x.cuentaId)}`, sub:"cuenta al debe" };
    return { titulo:x.concepto, sub:"gasto" };
  };

  return (
    <div style={{ maxWidth:980, margin:"0 auto" }}>

      {/* Equipo */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, marginBottom:10, flexWrap:"wrap" }}>
        <div style={{ fontSize:13, color:"#334155", fontWeight:700 }}>👤 Vendiendo como <span style={{ color:"#16a34a" }}>{vendedor}</span></div>
        <button onClick={() => onCambiarVendedor("")} style={btn("#64748b", { padding:"6px 12px", fontSize:12 })}>Cambiar vendedor</button>
      </div>

      {/* Plata de un vistazo */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:8, marginBottom:14 }}>
        {stats.map(s => (
          <div key={s.label} style={{ ...card, padding:"10px 12px" }}>
            <div style={{ fontSize:18, fontWeight:800, color:s.color }}>{s.val}</div>
            <div style={{ fontSize:12, fontWeight:700, color:"#475569" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ══ PASO 1: lo que se lleva ══ */}
      <div style={estiloPaso(1)}>
        <Paso numero="1" titulo="Toca lo que se lleva el cliente" extra={venta.total ? fmt(venta.total) : ""} estado={estadoPaso(1)} />
        {productosActivos.length === 0 ? (
          <div style={{ fontSize:13, color:"#64748b", textAlign:"center", padding:"10px 0" }}>
            Todavía no hay productos en el catálogo.
            <div style={{ marginTop:10 }}>
              <button onClick={() => { setAbierto(p => ({ ...p, productos:true })); setTimeout(() => document.getElementById("bloque-productos")?.scrollIntoView({ behavior:"smooth", block:"start" }), 60); }} style={btn("#0ea5e9")}>🏷️ Armar el catálogo aquí abajo</button>
            </div>
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:8 }}>
            {productosActivos.map(tileProducto)}
            <button onClick={() => agregarAlTicket({ productoId:"carton", nombre:"Cartón", tipo:"carton", precioUnitario: currentPrice })}
              style={{ background:"#f0fdf4", border:"2px solid #16a34a", borderLeft:"5px solid #16a34a", borderRadius:12, padding:"11px 12px", cursor:"pointer", textAlign:"left", fontFamily:"inherit", display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:22 }}>🎟️</span>
              <span style={{ flex:1 }}>
                <span style={{ display:"block", fontSize:14, fontWeight:800, color:"#1e293b" }}>Cartón</span>
                <span style={{ display:"block", fontSize:13, fontWeight:800, color:"#16a34a" }}>{fmt(currentPrice)}</span>
              </span>
              <span style={{ fontSize:18, color:"#16a34a", fontWeight:800 }}>＋</span>
            </button>
          </div>
        )}

        {ticket.length > 0 && (
          <div style={{ marginTop:12, background:"#f8fafc", borderRadius:12, padding:12, border:"1px solid #e2e8f0" }}>
            <div style={{ fontSize:12, fontWeight:800, color:"#64748b", marginBottom:8 }}>SE LLEVA</div>
            {ticket.map(l => (
              <div key={l.clave} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                <div style={{ flex:1, fontSize:14, fontWeight:700, color:"#1e293b" }}>
                  {l.tipo === "carton" ? "🎟️ " : ""}{l.nombre}
                  <span style={{ fontWeight:400, color:"#94a3b8", fontSize:12 }}> · {fmt(l.precioUnitario)} c/u</span>
                </div>
                <button onClick={() => cambiarCantidad(l.clave, -1)} style={{ ...btn("#e2e8f0", { color:"#475569", padding:"2px 11px", fontSize:15 }) }}>−</button>
                <div style={{ minWidth:20, textAlign:"center", fontWeight:800 }}>{l.cantidad}</div>
                <button onClick={() => cambiarCantidad(l.clave, 1)} style={{ ...btn("#e2e8f0", { color:"#475569", padding:"2px 11px", fontSize:15 }) }}>+</button>
                <div style={{ minWidth:72, textAlign:"right", fontWeight:800, color:"#16a34a" }}>{fmt(l.cantidad * l.precioUnitario)}</div>
              </div>
            ))}
            <div style={{ display:"flex", justifyContent:"space-between", borderTop:"1px solid #e2e8f0", marginTop:8, paddingTop:8, fontWeight:800 }}>
              <span style={{ color:"#334155" }}>Total</span><span style={{ color:"#16a34a" }}>{fmt(venta.total)}</span>
            </div>
          </div>
        )}
      </div>

      {/* ══ PASO 2: cómo paga ══ */}
      <div style={estiloPaso(2)}>
        <Paso numero="2" titulo="¿Cómo paga?" estado={estadoPaso(2)} extra={!ticket.length ? "primero elige lo que se lleva" : ""} />
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {[...MEDIOS, { id:"debe", nombre:"Al debe", emoji:"📝" }].map(m => {
            const sel = medio === m.id;
            const activo = ticket.length > 0;
            return (
              <button key={m.id} disabled={!activo} onClick={() => setMedio(m.id)} style={{
                flex:"1 1 130px", background: sel ? (m.id === "debe" ? "#f97316" : "#0f1221") : "#f1f5f9",
                color: sel ? "#fff" : "#475569", border: sel ? "2px solid transparent" : "2px solid transparent",
                borderRadius:12, padding:"13px 14px", fontWeight:800, fontSize:14, cursor: activo ? "pointer" : "not-allowed",
                opacity: activo ? 1 : 0.45, fontFamily:"inherit", textAlign:"center",
              }}>{m.emoji} {m.nombre}</button>
            );
          })}
        </div>

        {ticket.length > 0 && medio === "debe" && (
          <div style={{ background:"#fff7ed", border:"1px solid #fed7aa", borderRadius:12, padding:12, marginTop:10 }}>
            <div style={{ fontSize:13, color:"#9a3412", fontWeight:700, marginBottom:8 }}>
              Queda debiendo {fmt(venta.total)} (bebidas, comida y hasta cartones en la misma cuenta)
            </div>
            {abiertas.length > 0 && (
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:8 }}>
                {abiertas.map(c => (
                  <button key={c.id} onClick={() => { setCuentaSel(cuentaSel === c.id ? null : c.id); setCuentaNueva(""); }}
                    style={{ background: cuentaSel === c.id ? "#f97316" : "#fff", color: cuentaSel === c.id ? "#fff" : "#9a3412", border:"1px solid #fdba74", borderRadius:99, padding:"7px 13px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                    {c.nombre} · debe {fmt(c.saldo)}
                  </button>
                ))}
              </div>
            )}
            <input placeholder="…o el nombre de una cuenta nueva" value={cuentaNueva}
              onChange={e => { setCuentaNueva(e.target.value); setCuentaSel(null); }} style={inp} />
          </div>
        )}
      </div>

      {/* ══ PASO 3: cobrar ══ */}
      <div style={{ ...estiloPaso(3), marginBottom:16 }}>
        <Paso numero="3" titulo="Cobrar" estado={estadoPaso(3)} extra={venta.puedeCobrar ? fmt(venta.total) : ""} />
        <button disabled={!venta.puedeCobrar} onClick={registrarVenta} style={btn(
          !venta.puedeCobrar ? "#cbd5e1" : medio === "debe" ? "#f97316" : medio === TRANSFERENCIA ? "#3b82f6" : "#16a34a",
          { width:"100%", padding:16, fontSize:17, cursor: venta.puedeCobrar ? "pointer" : "not-allowed" })}>
          {!venta.puedeCobrar
            ? venta.texto
            : medio === "debe"
              ? `📝 Anotar ${fmt(venta.total)} al debe de ${cuentaSel ? nombreCuenta(cuentaSel) : cuentaNueva.trim()}`
              : `${medio === TRANSFERENCIA ? "🏦" : "💵"} Cobrar ${fmt(venta.total)} en ${medio === TRANSFERENCIA ? "transferencia" : "efectivo"}`}
        </button>
      </div>

      {/* ══ QUIÉN DEBE (siempre a la vista) ══ */}
      <div style={{ ...card, marginBottom:12, borderLeft:"5px solid #f97316" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom: abiertas.length ? 12 : 0 }}>
          <div style={{ fontSize:15, fontWeight:800, color:"#1e293b" }}>📝 Quién debe</div>
          <div style={{ marginLeft:"auto", fontSize:14, fontWeight:800, color: abiertas.length ? "#f97316" : "#16a34a" }}>
            {abiertas.length ? fmt(t.porCobrar) : "nadie 🎉"}
          </div>
        </div>

        {abiertas.length === 0 && (
          <div style={{ fontSize:13, color:"#64748b", marginTop:6 }}>
            Cuando alguien se lleve cosas y pague después, elige “📝 Al debe” en el paso 2 y la cuenta aparece acá.
          </div>
        )}

        {abiertas.map(c => {
          const lineas = ventas.filter(v => v.cuentaId === c.id).sort((a, b) => (b.ts || 0) - (a.ts || 0));
          const pagosC = pagos.filter(p => p.cuentaId === c.id).sort((a, b) => (b.ts || 0) - (a.ts || 0));
          return (
            <div key={c.id} style={{ borderTop:"1px solid #f1f5f9", paddingTop:12, marginTop:12 }}>
              <div style={{ display:"flex", alignItems:"flex-start", gap:10, flexWrap:"wrap" }}>
                <div style={{ flex:1, minWidth:150 }}>
                  <div style={{ fontSize:16, fontWeight:800, color:"#1e293b" }}>{c.nombre}</div>
                  <div style={{ fontSize:11, color:"#94a3b8" }}>
                    abierta por {c.vendedor || "—"}{pagosC.length ? ` · ya pagó ${fmt(c.pagado)}` : ""}
                  </div>
                </div>
                <div style={{ fontSize:20, fontWeight:800, color:"#f97316" }}>{fmt(c.saldo)}</div>
              </div>

              {/* Detalle completo, sin abrir nada */}
              <div style={{ marginTop:8 }}>
                {lineas.map(l => (
                  <div key={l.id} style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, padding:"5px 0", borderBottom:"1px dashed #f1f5f9" }}>
                    <span style={{ color:"#64748b", minWidth:44 }}>{horaLocal(l.ts)}</span>
                    <span style={{ flex:1, fontWeight:700, color:"#1e293b" }}>{l.tipo === "carton" ? "🎟️ " : ""}{l.nombre} ×{l.cantidad}</span>
                    <span style={{ color:"#94a3b8", fontSize:12 }}>{fmt(l.precioUnitario)} c/u</span>
                    <span style={{ fontWeight:800, color:"#16a34a" }}>{fmt(l.total ?? l.cantidad * l.precioUnitario)}</span>
                    <button onClick={async () => {
                      if (!window.confirm(`¿Quitar "${l.nombre} ×${l.cantidad}" de la cuenta de ${c.nombre}?`)) return;
                      await api.borrarLinea(l.id); showToast("Ítem quitado");
                    }} style={{ background:"none", border:"none", color:"#cbd5e1", cursor:"pointer", fontSize:14 }}>✕</button>
                  </div>
                ))}
                {pagosC.map(p => (
                  <div key={p.id} style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, padding:"5px 0", color:"#166534" }}>
                    <span style={{ minWidth:44 }}>{horaLocal(p.ts)}</span>
                    <span style={{ flex:1, fontWeight:700 }}>{p.medio === TRANSFERENCIA ? "🏦" : "💵"} pago recibido{p.vendedor ? ` · ${p.vendedor}` : ""}</span>
                    <span style={{ fontWeight:800 }}>{fmt(p.monto)}</span>
                    <button onClick={async () => { await api.borrarPago(p.id); showToast("Pago anulado"); }}
                      style={{ background:"none", border:"none", color:"#cbd5e1", cursor:"pointer", fontSize:14 }}>✕</button>
                  </div>
                ))}
              </div>

              {/* Cobrar: un toque para el caso normal */}
              {pagarOtro === c.id ? (
                <div style={{ display:"flex", gap:8, marginTop:10, flexWrap:"wrap" }}>
                  <input autoFocus inputMode="numeric" placeholder={`Monto (debe ${fmt(c.saldo)})`} value={pagoMonto} onChange={e => setPagoMonto(e.target.value)} style={{ ...inp, flex:"1 1 130px", textAlign:"right" }} />
                  <button onClick={() => setPagoMedio(EFECTIVO)} style={btn(pagoMedio === EFECTIVO ? "#0f1221" : "#f1f5f9", pagoMedio === EFECTIVO ? {} : { color:"#475569" })}>💵</button>
                  <button onClick={() => setPagoMedio(TRANSFERENCIA)} style={btn(pagoMedio === TRANSFERENCIA ? "#0f1221" : "#f1f5f9", pagoMedio === TRANSFERENCIA ? {} : { color:"#475569" })}>🏦</button>
                  <button onClick={() => registrarPago(c, soloNumero(pagoMonto), pagoMedio)} style={btn("#16a34a")}>Registrar</button>
                  <button onClick={() => { setPagarOtro(null); setPagoMonto(""); }} style={btn("#f1f5f9", { color:"#475569" })}>Cancelar</button>
                </div>
              ) : (
                <div style={{ display:"flex", gap:8, marginTop:10, flexWrap:"wrap" }}>
                  <button onClick={() => registrarPago(c, c.saldo, EFECTIVO)} style={btn("#16a34a", { flex:"1 1 170px" })}>💵 Ya pagó {fmt(c.saldo)} (efectivo)</button>
                  <button onClick={() => registrarPago(c, c.saldo, TRANSFERENCIA)} style={btn("#3b82f6", { flex:"1 1 190px" })}>🏦 Ya pagó {fmt(c.saldo)} (transferencia)</button>
                  <button onClick={() => { setPagarOtro(c.id); setPagoMonto(String(c.saldo)); setPagoMedio(EFECTIVO); }} style={btn("#f1f5f9", { color:"#475569" })}>Otro monto</button>
                </div>
              )}

              <div style={{ display:"flex", gap:8, marginTop:8, flexWrap:"wrap" }}>
                <button onClick={() => setAgregando(agregando === c.id ? null : c.id)} style={btn("#f1f5f9", { color:"#475569" })}>
                  {agregando === c.id ? "▲ Cerrar" : "➕ Agregar más a la cuenta"}
                </button>
                <button onClick={async () => {
                  if (!window.confirm(`¿Borrar la cuenta de ${c.nombre} con todo su detalle?`)) return;
                  await api.borrarCuenta(c.id); showToast("Cuenta borrada");
                }} style={btn("#fff", { color:"#ef4444", border:"1px solid #fecaca" })}>🗑️ Borrar cuenta</button>
              </div>

              {agregando === c.id && (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))", gap:6, marginTop:8 }}>
                  {productosActivos.map(p => (
                    <button key={p.id} onClick={() => agregarACuenta(c, p)} style={{ background:"#fff", border:`1px solid ${CAT_COLOR[p.categoria] || "#e2e8f0"}`, borderRadius:10, padding:"8px 10px", cursor:"pointer", textAlign:"left", fontFamily:"inherit" }}>
                      <div style={{ fontSize:13, fontWeight:700, color:"#1e293b" }}>{emojiCat(p.categoria)} {p.nombre}</div>
                      <div style={{ fontSize:12, fontWeight:800, color:"#16a34a" }}>{fmt(p.precio)}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {pagadas.length > 0 && (
          <div style={{ marginTop:12, borderTop:"1px solid #f1f5f9", paddingTop:10 }}>
            <button onClick={() => setPagadasAbiertas(!pagadasAbiertas)} style={btn("#f1f5f9", { color:"#475569", fontSize:13 })}>
              {pagadasAbiertas ? "▲" : "▼"} Cuentas ya pagadas ({pagadas.length})
            </button>
            {pagadasAbiertas && (
              <div style={{ marginTop:8 }}>
                {pagadas.map(c => (
                  <div key={c.id} style={{ display:"flex", alignItems:"center", gap:10, fontSize:13, padding:"6px 0", borderBottom:"1px dashed #f1f5f9" }}>
                    <span style={{ flex:1, fontWeight:700, color:"#334155" }}>{c.nombre}</span>
                    <span style={{ color:"#94a3b8" }}>{c.cantidadLineas} ítem(s) · {fmt(c.items)}</span>
                    <span style={{ fontWeight:800, color:"#16a34a" }}>✓ pagada</span>
                    <button onClick={async () => {
                      if (!window.confirm(`¿Borrar la cuenta de ${c.nombre} con todo su detalle?`)) return;
                      await api.borrarCuenta(c.id); showToast("Cuenta borrada");
                    }} style={{ background:"none", border:"none", color:"#cbd5e1", cursor:"pointer", fontSize:14 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══ HISTORIAL (todo el detalle de corrido) ══ */}
      <div style={{ ...card, marginBottom:12 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10, flexWrap:"wrap" }}>
          <div style={{ fontSize:15, fontWeight:800, color:"#1e293b" }}>📋 Historial</div>
          <div style={{ fontSize:12, color:"#64748b" }}>{totalFilas} movimiento(s)</div>
          <button onClick={() => setSoloHoy(!soloHoy)} style={btn(soloHoy ? "#0f1221" : "#f1f5f9", soloHoy ? { fontSize:12, padding:"6px 12px" } : { color:"#475569", fontSize:12, padding:"6px 12px" })}>
            {soloHoy ? "Hoy ▼ (ver todo)" : "Todo ▼ (ver solo hoy)"}
          </button>
        </div>

        {filas.length === 0 && <div style={{ fontSize:13, color:"#94a3b8", textAlign:"center", padding:"14px 0" }}>Sin movimientos{ soloHoy ? " hoy" : "" }</div>}

        {filas.map(g => (
          <div key={g.dia} style={{ marginBottom:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, background:"#f8fafc", borderRadius:8, padding:"6px 10px", marginBottom:6, flexWrap:"wrap" }}>
              <span style={{ fontSize:12, fontWeight:800, color:"#334155", textTransform:"capitalize" }}>{textoDia(g.dia)}</span>
              <span style={{ marginLeft:"auto", fontSize:12, color:"#16a34a", fontWeight:700 }}>entró {fmt(g.entradas)}</span>
              {g.salidas > 0 && <span style={{ fontSize:12, color:"#ef4444", fontWeight:700 }}>salió {fmt(g.salidas)}</span>}
              {g.alDebe > 0 && <span style={{ fontSize:12, color:"#f97316", fontWeight:700 }}>al debe {fmt(g.alDebe)}</span>}
            </div>

            {g.filas.map(x => {
              const monto = x.tipoMov === "venta" ? (x.total ?? x.cantidad * x.precioUnitario) : x.monto;
              const info = textoMov(x);
              const color = x.tipoMov === "gasto" ? "#ef4444" : x.tipoMov === "pago" ? "#3b82f6" : x.cuentaId ? "#f97316" : "#16a34a";
              const medioTxt = x.tipoMov === "venta" && x.cuentaId
                ? `📝 al debe · ${nombreCuenta(x.cuentaId)}`
                : `${x.medio === TRANSFERENCIA ? "🏦 transferencia" : "💵 efectivo"}`;
              const enEdicion = editando?.id === x.id;
              return (
                <div key={x.id} style={{ padding:"8px 2px", borderBottom:"1px solid #f8fafc" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ color:"#94a3b8", fontSize:12, minWidth:42 }}>{horaLocal(x.ts)}</span>
                    <span style={{ flex:1, fontSize:14, fontWeight:700, color:"#1e293b" }}>{info.titulo}</span>
                    <span style={{ fontSize:12, color:"#94a3b8" }}>{info.sub}</span>
                    <span style={{ fontWeight:800, color, minWidth:78, textAlign:"right" }}>{x.tipoMov === "gasto" ? "−" : "+"}{fmt(monto)}</span>
                    <button onClick={() => setEditando(enEdicion ? null : { id:x.id, tipoMov:x.tipoMov, cantidad:x.cantidad, precioUnitario:x.precioUnitario, monto:x.monto, concepto:x.concepto, medio:x.medio })}
                      title="Corregir" style={{ background:"none", border:"none", color: enEdicion ? AZUL : "#cbd5e1", cursor:"pointer", fontSize:14 }}>✎</button>
                    <button onClick={async () => {
                      if (!window.confirm("¿Borrar este movimiento? No se puede deshacer.")) return;
                      if (x.tipoMov === "venta") await api.borrarLinea(x.id);
                      else if (x.tipoMov === "pago") await api.borrarPago(x.id);
                      else await api.borrarGasto(x.id);
                      showToast("Movimiento borrado");
                    }} title="Borrar" style={{ background:"none", border:"none", color:"#cbd5e1", cursor:"pointer", fontSize:14 }}>✕</button>
                  </div>
                  <div style={{ marginLeft:50, fontSize:11, color:"#94a3b8" }}>
                    {medioTxt}{x.vendedor ? ` · ${x.vendedor}` : ""}{!soloHoy ? ` · ${x.dia || diaLocal(x.ts)}` : ""}
                  </div>

                  {enEdicion && (
                    <div style={{ marginLeft:50, marginTop:8, background:"#f8fafc", borderRadius:10, padding:10, border:"1px solid #e2e8f0" }}>
                      {x.tipoMov === "venta" ? (
                        <>
                          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
                            <div>
                              <div style={{ fontSize:11, color:"#94a3b8", fontWeight:700, marginBottom:4 }}>CANTIDAD</div>
                              <input inputMode="numeric" value={editando.cantidad} onChange={e => setEditando({ ...editando, cantidad: soloNumero(e.target.value) })} style={{ ...inp, textAlign:"center" }} />
                            </div>
                            <div>
                              <div style={{ fontSize:11, color:"#94a3b8", fontWeight:700, marginBottom:4 }}>PRECIO UNITARIO</div>
                              <input inputMode="numeric" value={editando.precioUnitario} onChange={e => setEditando({ ...editando, precioUnitario: soloNumero(e.target.value) })} style={{ ...inp, textAlign:"right" }} />
                            </div>
                          </div>
                          {!x.cuentaId && (
                            <div style={{ display:"flex", gap:6, marginBottom:8 }}>
                              {MEDIOS.map(m => (
                                <button key={m.id} onClick={() => setEditando({ ...editando, medio:m.id })} style={{
                                  background: editando.medio === m.id ? "#0f1221" : "#e2e8f0", color: editando.medio === m.id ? "#fff" : "#475569",
                                  border:"none", borderRadius:10, padding:"8px 13px", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit",
                                }}>{m.emoji} {m.nombre}</button>
                              ))}
                            </div>
                          )}
                          <div style={{ fontSize:12, color:"#64748b", marginBottom:8 }}>Queda en <strong>{fmt(soloNumero(editando.cantidad) * soloNumero(editando.precioUnitario))}</strong></div>
                        </>
                      ) : (
                        <div style={{ display:"grid", gridTemplateColumns:"1fr 120px", gap:8, marginBottom:8 }}>
                          {x.tipoMov === "gasto"
                            ? <input value={editando.concepto} onChange={e => setEditando({ ...editando, concepto:e.target.value })} style={inp} />
                            : <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                                {MEDIOS.map(m => (
                                  <button key={m.id} onClick={() => setEditando({ ...editando, medio:m.id })} style={{
                                    background: editando.medio === m.id ? "#0f1221" : "#e2e8f0", color: editando.medio === m.id ? "#fff" : "#475569",
                                    border:"none", borderRadius:10, padding:"8px 12px", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit",
                                  }}>{m.emoji} {m.nombre}</button>
                                ))}
                              </div>}
                          <input inputMode="numeric" value={editando.monto} onChange={e => setEditando({ ...editando, monto: soloNumero(e.target.value) })} style={{ ...inp, textAlign:"right" }} />
                        </div>
                      )}
                      <div style={{ display:"flex", gap:8 }}>
                        <button onClick={async () => {
                          if (x.tipoMov === "venta") {
                            const cantidad = soloNumero(editando.cantidad);
                            const precioUnitario = soloNumero(editando.precioUnitario);
                            if (cantidad < 1) return showToast("La cantidad debe ser 1 o más", "err");
                            await api.corregirLinea(x.id, { cantidad, precioUnitario, total: cantidad * precioUnitario, ...(x.cuentaId ? {} : { medio: editando.medio || EFECTIVO }) });
                          } else if (x.tipoMov === "pago") {
                            const monto = soloNumero(editando.monto);
                            if (monto <= 0) return showToast("El monto debe ser mayor a 0", "err");
                            await api.editarPago(x.id, { monto, medio: editando.medio || EFECTIVO });
                          } else {
                            const monto = soloNumero(editando.monto);
                            if (monto <= 0) return showToast("El monto debe ser mayor a 0", "err");
                            await api.editarGasto(x.id, { concepto: editando.concepto.trim() || "Gasto", monto });
                          }
                          showToast("✓ Corregido"); setEditando(null);
                        }} style={btn("#16a34a", { flex:1 })}>Guardar</button>
                        <button onClick={() => setEditando(null)} style={btn("#f1f5f9", { color:"#475569" })}>Cerrar</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* ══ BLOQUES DE ADMINISTRACIÓN ══ */}
      <Plegable id="bloque-productos" titulo="🏷️ Productos del catálogo" resumen={`${productosActivos.length} a la venta`} abierto={abierto.productos} onToggle={() => alternar("productos")}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 120px", gap:8, marginBottom:8 }}>
          <input placeholder="Nombre (ej: Bebida, Completo, Kuchen)" value={prodNombre} onChange={e => setProdNombre(e.target.value)} style={inp} />
          <input placeholder="Precio $" inputMode="numeric" value={prodPrecio} onChange={e => setProdPrecio(e.target.value)} style={{ ...inp, textAlign:"right" }} />
        </div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:8 }}>
          {CATEGORIAS.map(c => (
            <button key={c.id} onClick={() => setProdCat(c.id)} style={{
              background: prodCat === c.id ? (CAT_COLOR[c.id] || "#64748b") : "#f1f5f9",
              color: prodCat === c.id ? "#fff" : "#475569", border:"none", borderRadius:99,
              padding:"7px 13px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
            }}>{c.emoji} {c.nombre}</button>
          ))}
        </div>
        <div style={{ marginBottom:10 }}>
          <div style={{ fontSize:11, color:"#94a3b8", fontWeight:700, marginBottom:6 }}>ATAJOS (llenan el nombre, tú pones el precio)</div>
          <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
            {SUGERENCIAS_PRODUCTO.map(s => (
              <button key={s} onClick={() => setProdNombre(s)} style={{ background:"#f1f5f9", border:"1px solid #e2e8f0", borderRadius:99, padding:"5px 11px", fontSize:12, color:"#475569", cursor:"pointer", fontFamily:"inherit" }}>{s}</button>
            ))}
          </div>
        </div>
        <button onClick={async () => {
          if (!prodNombre.trim()) return showToast("Escribe el nombre", "err");
          const precio = soloNumero(prodPrecio);
          if (precio <= 0) return showToast("Escribe el precio", "err");
          await api.agregarProducto({ nombre:prodNombre.trim(), precio, categoria:prodCat });
          showToast(`✓ ${prodNombre.trim()} ${fmt(precio)}`); setProdNombre(""); setProdPrecio("");
        }} style={btn("#16a34a", { width:"100%", padding:12 })}>Agregar al catálogo</button>

        <div style={{ marginTop:14 }}>
          {productos.length === 0 && <div style={{ fontSize:13, color:"#94a3b8" }}>El catálogo está vacío</div>}
          {productos.map(p => {
            const enEdicion = prodEdit?.id === p.id;
            return (
              <div key={p.id} style={{ borderBottom:"1px solid #f1f5f9" }}>
                <div onClick={() => setProdEdit(enEdicion ? null : { id:p.id, nombre:p.nombre, precio:String(p.precio), categoria:p.categoria || "otro" })}
                  style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 0", cursor:"pointer", opacity: p.activo === false ? 0.5 : 1 }}>
                  <span style={{ fontSize:18 }}>{emojiCat(p.categoria)}</span>
                  <span style={{ flex:1, fontSize:14, fontWeight:700, color:"#1e293b" }}>
                    {p.nombre} {p.activo === false && <span style={{ fontSize:11, color:"#94a3b8" }}>· oculto</span>}
                  </span>
                  <span style={{ fontWeight:800, color:"#16a34a" }}>{fmt(p.precio)}</span>
                  <button onClick={e => { e.stopPropagation(); api.editarProducto(p.id, { activo: p.activo === false }); }}
                    style={btn("#f1f5f9", { color:"#475569", padding:"5px 9px", fontSize:12 })}>{p.activo === false ? "Mostrar" : "Ocultar"}</button>
                </div>
                {enEdicion && (
                  <div style={{ background:"#f8fafc", borderRadius:10, padding:10, marginBottom:10 }}>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 120px", gap:8, marginBottom:8 }}>
                      <input value={prodEdit.nombre} onChange={e => setProdEdit({ ...prodEdit, nombre:e.target.value })} style={inp} />
                      <input inputMode="numeric" value={prodEdit.precio} onChange={e => setProdEdit({ ...prodEdit, precio:e.target.value })} style={{ ...inp, textAlign:"right" }} />
                    </div>
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
                      {CATEGORIAS.map(c => (
                        <button key={c.id} onClick={() => setProdEdit({ ...prodEdit, categoria:c.id })} style={{
                          background: prodEdit.categoria === c.id ? (CAT_COLOR[c.id] || "#64748b") : "#e2e8f0",
                          color: prodEdit.categoria === c.id ? "#fff" : "#475569", border:"none", borderRadius:99,
                          padding:"6px 12px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
                        }}>{emojiCat(c.id)} {c.nombre}</button>
                      ))}
                    </div>
                    <div style={{ display:"flex", gap:8 }}>
                      <button onClick={async () => {
                        await api.editarProducto(p.id, { nombre:prodEdit.nombre.trim(), precio:soloNumero(prodEdit.precio), categoria:prodEdit.categoria });
                        showToast("✓ Producto actualizado"); setProdEdit(null);
                      }} style={btn("#16a34a", { flex:1 })}>Guardar</button>
                      <button onClick={async () => {
                        if (!window.confirm(`¿Borrar "${p.nombre}" del catálogo?`)) return;
                        await api.borrarProducto(p.id); showToast("Producto borrado"); setProdEdit(null);
                      }} style={btn("#ef4444")}>Borrar</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Plegable>

      <Plegable titulo="➖ Gastos" resumen={gastos.length ? `${fmt(t.gastosTotal)} en ${gastos.length}` : "sin gastos"} abierto={abierto.gastos} onToggle={() => alternar("gastos")}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 120px", gap:8, marginBottom:8 }}>
          <input placeholder="¿En qué se fue? (hielo, insumos, vueltos)" value={gastoForm.concepto} onChange={e => setGastoForm({ ...gastoForm, concepto:e.target.value })} style={inp} />
          <input placeholder="Monto $" inputMode="numeric" value={gastoForm.monto} onChange={e => setGastoForm({ ...gastoForm, monto:e.target.value })} style={{ ...inp, textAlign:"right" }} />
        </div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:8 }}>
          {TIPOS_GASTO.map(tp => (
            <button key={tp} onClick={() => setGastoForm({ ...gastoForm, concepto: tp === "Otro" ? "" : tp })} style={{ background:"#f1f5f9", border:"1px solid #e2e8f0", borderRadius:99, padding:"5px 11px", fontSize:12, color:"#475569", cursor:"pointer", fontFamily:"inherit" }}>{tp}</button>
          ))}
          {MEDIOS.map(m => (
            <button key={m.id} onClick={() => setGastoForm({ ...gastoForm, medio:m.id })} style={{
              background: gastoForm.medio === m.id ? "#0f1221" : "#f1f5f9", color: gastoForm.medio === m.id ? "#fff" : "#475569",
              border:"none", borderRadius:99, padding:"6px 12px", fontWeight:700, fontSize:12, cursor:"pointer", fontFamily:"inherit",
            }}>{m.emoji} {m.nombre}</button>
          ))}
        </div>
        <button onClick={async () => {
          const monto = soloNumero(gastoForm.monto);
          if (!gastoForm.concepto.trim()) return showToast("Escribe en qué se fue", "err");
          if (monto <= 0) return showToast("Escribe el monto", "err");
          await api.registrarGasto({ concepto:gastoForm.concepto.trim(), monto, medio:gastoForm.medio });
          showToast(`✓ Gasto ${fmt(monto)}`); setGastoForm({ concepto:"", monto:"", medio:EFECTIVO });
        }} style={btn("#ef4444", { width:"100%", padding:12 })}>Registrar gasto</button>
        {gastos.length > 0 && (
          <div style={{ marginTop:12 }}>
            {[...gastos].sort((a, b) => (b.ts || 0) - (a.ts || 0)).map(g => (
              <div key={g.id} style={{ display:"flex", alignItems:"center", gap:10, fontSize:13, padding:"6px 0", borderBottom:"1px dashed #f1f5f9" }}>
                <span style={{ color:"#94a3b8", minWidth:44 }}>{horaLocal(g.ts)}</span>
                <span style={{ flex:1, fontWeight:700, color:"#1e293b" }}>{g.concepto}</span>
                <span style={{ color:"#94a3b8", fontSize:11 }}>{g.medio === TRANSFERENCIA ? "🏦" : "💵"} {g.vendedor || "—"}</span>
                <span style={{ fontWeight:800, color:"#ef4444" }}>{fmt(g.monto)}</span>
                <button onClick={async () => { await api.borrarGasto(g.id); showToast("Gasto borrado"); }} style={{ background:"none", border:"none", color:"#cbd5e1", cursor:"pointer", fontSize:14 }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </Plegable>

      <Plegable titulo="🔒 Cierre de caja (arqueo)" resumen={`efectivo esperado ${fmt(t.esperadoEfectivo)}`} abierto={abierto.cierre} onToggle={() => alternar("cierre")}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
          <div>
            <div style={{ fontSize:11, color:"#94a3b8", fontWeight:700, marginBottom:4 }}>EFECTIVO INICIAL (CAMBIO)</div>
            <div style={{ display:"flex", gap:6 }}>
              <input inputMode="numeric" value={inicial} onChange={e => setInicial(e.target.value)} style={{ ...inp, textAlign:"right" }} />
              <button onClick={async () => { await api.guardarEfectivoInicial(soloNumero(inicial)); showToast("✓ Efectivo inicial guardado"); }} style={btn(AZUL)}>Guardar</button>
            </div>
          </div>
          <div>
            <div style={{ fontSize:11, color:"#94a3b8", fontWeight:700, marginBottom:4 }}>EFECTIVO CONTADO</div>
            <input inputMode="numeric" placeholder="Cuenta los billetes y escribe el total" value={contado} onChange={e => setContado(e.target.value)} style={{ ...inp, textAlign:"right" }} />
          </div>
        </div>

        <div style={{ background:"#f8fafc", borderRadius:10, padding:12, fontSize:13 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
            <span style={{ color:"#64748b" }}>Efectivo esperado (inicial + neto en efectivo)</span><strong>{fmt(caja.esperado)}</strong>
          </div>
          {caja.contado !== null && (
            <div style={{ display:"flex", justifyContent:"space-between", borderTop:"1px solid #e2e8f0", paddingTop:8 }}>
              <span style={{ color:"#64748b" }}>Diferencia</span>
              <strong style={{ color: caja.diferencia === 0 ? "#16a34a" : caja.diferencia > 0 ? "#3b82f6" : "#ef4444" }}>
                {fmtSigno(caja.diferencia)} {caja.diferencia === 0 ? "✓ cuadra" : caja.diferencia > 0 ? "sobra" : "falta"}
              </strong>
            </div>
          )}
          <div style={{ fontSize:11, color:"#94a3b8", marginTop:8 }}>
            Transferencias esperadas: <strong>{fmt(t.transferencia)}</strong> · Por cobrar: <strong>{fmt(t.porCobrar)}</strong>
          </div>
        </div>

        <button onClick={async () => {
          if (caja.contado === null) return showToast("Escribe el efectivo contado", "err");
          await api.guardarCierre({
            ts:Date.now(), vendedor,
            efectivoInicial:t.efectivoInicial, esperadoEfectivo:caja.esperado, contado:caja.contado, diferencia:caja.diferencia,
            efectivo:t.efectivo, transferencia:t.transferencia, gastos:t.gastosTotal,
            cobrado:t.cobrado, porCobrar:t.porCobrar, bruto:t.bruto, alDebe:t.alDebe, pagadoDeMas:t.pagadoDeMas,
            cartones:cartones.cantidad, cartonesTotal:cartones.total,
            porProducto:porProducto(ventas), porVendedor:porVendedor({ ventas, pagos, gastos }),
          });
          showToast(`✓ Cierre guardado · ${fmtSigno(caja.diferencia)}`); setContado("");
        }} style={btn("#7c3aed", { width:"100%", padding:13, marginTop:10 })}>Guardar cierre del momento</button>

        {porVendedor({ ventas, pagos, gastos }).length > 0 && (
          <div style={{ marginTop:14, overflowX:"auto" }}>
            <div style={{ fontSize:12, fontWeight:800, color:"#64748b", marginBottom:6 }}>POR VENDEDOR (para cuadrar cada uno)</div>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr style={{ background:"#f8fafc", borderBottom:"2px solid #e2e8f0" }}>
                  {["VENDEDOR", "EFECTIVO", "TRANSF.", "AL DEBE", "GASTOS", "NETO"].map(h => (
                    <th key={h} style={{ padding:"7px 8px", textAlign: h === "VENDEDOR" ? "left" : "right", fontSize:10, color:"#64748b", letterSpacing:1 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {porVendedor({ ventas, pagos, gastos }).map(v => (
                  <tr key={v.vendedor} style={{ borderBottom:"1px solid #f1f5f9" }}>
                    <td style={{ padding:"8px", fontWeight:700 }}>{v.vendedor}</td>
                    <td style={{ padding:"8px", textAlign:"right" }}>{fmt(v.efectivo)}</td>
                    <td style={{ padding:"8px", textAlign:"right" }}>{fmt(v.transferencia)}</td>
                    <td style={{ padding:"8px", textAlign:"right", color:"#f97316" }}>{fmt(v.alDebe)}</td>
                    <td style={{ padding:"8px", textAlign:"right", color:"#ef4444" }}>{fmt(v.gastos)}</td>
                    <td style={{ padding:"8px", textAlign:"right", fontWeight:800, color:"#16a34a" }}>{fmt(v.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {cierres.length > 0 && (
          <div style={{ marginTop:14 }}>
            <div style={{ fontSize:12, fontWeight:800, color:"#64748b", marginBottom:6 }}>CIERRES GUARDADOS</div>
            {[...cierres].sort((a, b) => (b.ts || 0) - (a.ts || 0)).map(c => (
              <div key={c.id} style={{ display:"flex", alignItems:"center", gap:10, fontSize:13, padding:"6px 0", borderBottom:"1px dashed #f1f5f9" }}>
                <span style={{ flex:1, fontWeight:700, color:"#334155" }}>{fechaTexto(c.ts)}</span>
                <span style={{ color:"#94a3b8", fontSize:11 }}>esperado {fmt(c.esperadoEfectivo)} · contado {fmt(c.contado)}</span>
                <span style={{ fontWeight:800, color: c.diferencia === 0 ? "#16a34a" : c.diferencia > 0 ? "#3b82f6" : "#ef4444" }}>{fmtSigno(c.diferencia)}</span>
                <button onClick={async () => { await api.borrarCierre(c.id); showToast("Cierre borrado"); }} style={{ background:"none", border:"none", color:"#cbd5e1", cursor:"pointer", fontSize:14 }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </Plegable>

      <Plegable titulo="📤 Resumen para enviar" resumen="copiar y pegar en WhatsApp" abierto={abierto.resumen} onToggle={() => alternar("resumen")}>
        <button onClick={copiarResumen} style={btn(copiado ? AZUL : "#16a34a", { width:"100%", padding:12, marginBottom:10 })}>
          {copiado ? "✓ Copiado" : "📋 Copiar resumen"}
        </button>
        <textarea readOnly value={textoResumen} rows={16}
          style={{ ...inp, fontFamily:"monospace", fontSize:12, lineHeight:1.5, resize:"vertical", whiteSpace:"pre", marginBottom:12 }} />

        <div style={{ fontSize:12, fontWeight:800, color:"#64748b", marginBottom:6 }}>VENDIDO POR PRODUCTO</div>
        {porProducto(ventas).length === 0 && <div style={{ fontSize:13, color:"#94a3b8" }}>Sin ventas registradas</div>}
        {porProducto(ventas).map(p => (
          <div key={p.clave} style={{ display:"flex", alignItems:"center", gap:10, borderBottom:"1px solid #f1f5f9", padding:"7px 0", fontSize:13 }}>
            <span style={{ flex:1, fontWeight:700, color:"#1e293b" }}>
              {p.tipo === "carton" ? "🎟️ " : ""}{p.nombre}
              {p.alDebe > 0 && <span style={{ fontSize:11, color:"#f97316" }}> · {fmt(p.alDebe)} al debe</span>}
            </span>
            <span style={{ color:"#64748b", minWidth:40, textAlign:"right" }}>×{p.cantidad}</span>
            <span style={{ fontWeight:800, color:"#16a34a", minWidth:80, textAlign:"right" }}>{fmt(p.total)}</span>
          </div>
        ))}
        <div style={{ fontSize:11, color:"#94a3b8", marginTop:10 }}>
          Los {cantidadCartones} cartones entregados ({fmt(totalCartones)}) se cuentan en la pestaña Cartones. Acá se registra la plata que entra, incluidos los cartones que se cobran por caja.
        </div>
      </Plegable>
    </div>
  );
}
