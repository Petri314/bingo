import React, { useMemo, useState } from "react";
import { CATEGORIAS, SUGERENCIAS_PRODUCTO } from "../constants/index.js";
import {
  EFECTIVO, TRANSFERENCIA, MEDIOS, TIPOS_GASTO,
  fmt, fmtSigno, horaLocal, diaLocal, fechaTexto,
  totalesCaja, cuentasConSaldo, porProducto, porVendedor, cartonesEnCaja, resumenTexto, arqueo,
} from "../caja.js";

// ── Estilos (mismos que el resto del panel admin) ─────────────────────────────
const inp = { background:"#fff", border:"1px solid #e2e8f0", borderRadius:8, padding:"10px 12px", color:"#334155", fontSize:14, outline:"none", width:"100%", boxSizing:"border-box", fontFamily:"sans-serif" };
const btn = (color, extra={}) => ({ background:color, border:"none", borderRadius:8, padding:"9px 15px", fontWeight:700, fontSize:14, cursor:"pointer", color:"#fff", fontFamily:"sans-serif", whiteSpace:"nowrap", ...extra });
const card = { background:"#fff", borderRadius:13, padding:16, border:"1px solid #e2e8f0", boxShadow:"0 1px 3px rgba(0,0,0,0.05)" };
const titulo = { margin:"0 0 12px", fontSize:14, color:"#334155" };
const soloNumero = (v) => { const n = parseInt(String(v ?? "").replace(/[^\d]/g, ""), 10); return Number.isFinite(n) ? n : 0; };
const emojiCat = (id) => CATEGORIAS.find(c => c.id === id)?.emoji || "📦";
const CAT_COLOR = { bebida:"#0ea5e9", comida:"#f97316", dulce:"#ec4899", carton:"#16a34a", otro:"#64748b" };

const VISTAS = [
  { id:"vender",      label:"🛒 Vender" },
  { id:"productos",   label:"🏷️ Productos" },
  { id:"cuentas",     label:"📝 Cuentas" },
  { id:"movimientos", label:"📋 Movimientos" },
  { id:"gastos",      label:"➖ Gastos" },
  { id:"cierre",      label:"🔒 Cierre" },
  { id:"resumen",     label:"📤 Resumen" },
];

export default function CajaPanel({
  isAdmin, productos = [], ventas = [], cuentas = [], pagos = [], gastos = [], cierres = [], config = {},
  currentPrice, vendedor, onCambiarVendedor, totalCartones = 0, cantidadCartones = 0,
  api, showToast,
}) {
  const [vista, setVista] = useState("vender");
  const [ticket, setTicket] = useState([]);
  const [medio, setMedio] = useState(EFECTIVO);
  const [cuentaSel, setCuentaSel] = useState(null);
  const [cuentaNueva, setCuentaNueva] = useState("");
  const [cuentaAbierta, setCuentaAbierta] = useState(null);
  const [cerradasAbiertas, setCerradasAbiertas] = useState(false);
  const [editando, setEditando] = useState(null);
  const [soloHoy, setSoloHoy] = useState(true);
  const [nombreVendedor, setNombreVendedor] = useState("");
  const [prodNombre, setProdNombre] = useState("");
  const [prodPrecio, setProdPrecio] = useState("");
  const [prodCat, setProdCat] = useState("bebida");
  const [prodEdit, setProdEdit] = useState(null);
  const [gastoForm, setGastoForm] = useState({ concepto:"", monto:"", medio:EFECTIVO });
  const [pagoForm, setPagoForm] = useState({ monto:"", medio:EFECTIVO });
  const [inicial, setInicial] = useState(String(config?.efectivoInicial ?? ""));
  const [contado, setContado] = useState("");
  const [copiado, setCopiado] = useState(false);

  const t = useMemo(() => totalesCaja({
    ventas, cuentas, pagos, gastos, efectivoInicial: config?.efectivoInicial || 0,
  }), [ventas, cuentas, pagos, gastos, config]);

  const saldos = useMemo(() => cuentasConSaldo(cuentas, ventas, pagos), [cuentas, ventas, pagos]);
  const abiertas = saldos.filter(c => c.saldo > 0);
  const cerradas = saldos.filter(c => c.saldo <= 0 && c.cantidadLineas > 0);
  const productosActivos = useMemo(
    () => productos.filter(p => p.activo !== false).sort((a, b) => (a.orden || 0) - (b.orden || 0) || String(a.nombre).localeCompare(String(b.nombre), "es")),
    [productos]
  );
  const totalTicket = ticket.reduce((a, l) => a + l.cantidad * l.precioUnitario, 0);
  const caja = arqueo({ esperadoEfectivo: t.esperadoEfectivo, contado });
  const cartones = useMemo(() => cartonesEnCaja(ventas), [ventas]);

  // ── Ticket de la venta en curso ─────────────────────────────────────────────
  const agregarAlTicket = (prod) => {
    const clave = `${prod.productoId}@${prod.precioUnitario}`;
    setTicket(prev => {
      const i = prev.findIndex(l => l.clave === clave);
      if (i === -1) return [...prev, { clave, ...prod, cantidad: 1 }];
      const copia = [...prev];
      copia[i] = { ...copia[i], cantidad: copia[i].cantidad + 1 };
      return copia;
    });
  };
  const cambiarCantidad = (clave, delta) => setTicket(prev =>
    prev.map(l => l.clave === clave ? { ...l, cantidad: l.cantidad + delta } : l).filter(l => l.cantidad > 0));

  const registrarVenta = async () => {
    if (!ticket.length) return showToast("Agrega al menos un producto", "err");
    let cuentaId = null;
    let nombreCuenta = "";
    if (medio === "debe") {
      nombreCuenta = (cuentaSel ? cuentas.find(c => c.id === cuentaSel)?.nombre : cuentaNueva.trim()) || "";
      if (!nombreCuenta) return showToast("Escribe el nombre de la cuenta", "err");
      cuentaId = cuentaSel;
      if (!cuentaId) {
        cuentaId = await api.crearCuenta(nombreCuenta);
        setCuentaNueva("");
      }
    }
    await api.registrarVenta({ lineas: ticket, medio: cuentaId ? null : medio, cuentaId });
    showToast(medio === "debe"
      ? `📝 ${fmt(totalTicket)} a la cuenta "${nombreCuenta}"`
      : `✓ ${fmt(totalTicket)} en ${medio === TRANSFERENCIA ? "transferencia" : medio}`);
    setTicket([]);
    if (medio === "debe") setCuentaSel(cuentaId);
  };

  const registrarPago = async (cuenta) => {
    const monto = soloNumero(pagoForm.monto);
    if (monto <= 0) return showToast("Escribe el monto del pago", "err");
    await api.registrarPago({ cuentaId: cuenta.id, monto, medio: pagoForm.medio });
    showToast(`✓ Pago ${fmt(monto)} de ${cuenta.nombre}`);
    setPagoForm({ monto:"", medio: EFECTIVO });
    if (monto >= cuenta.saldo) setCuentaAbierta(null);
  };

  const reiniciarVendedor = () => {
    const nombre = nombreVendedor.trim();
    if (!nombre) return showToast("Escribe tu nombre", "err");
    onCambiarVendedor(nombre);
    setNombreVendedor("");
  };

  // ── Sin sesión / sin nombre: dos pantallas previas ──────────────────────────
  if (!isAdmin) {
    return (
      <div style={{ ...card, maxWidth:420, margin:"40px auto", textAlign:"center" }}>
        <div style={{ fontSize:40, marginBottom:10 }}>🔐</div>
        <h3 style={{ margin:"0 0 8px", fontSize:17, color:"#1e293b" }}>La caja es solo para el equipo</h3>
        <p style={{ margin:0, fontSize:13, color:"#64748b" }}>
          Entra con el PIN del admin (botón 🔐 Admin arriba a la derecha) para registrar ventas, cuentas y gastos.
        </p>
      </div>
    );
  }

  if (!vendedor) {
    return (
      <div style={{ ...card, maxWidth:420, margin:"40px auto" }}>
        <div style={{ fontSize:40, textAlign:"center", marginBottom:10 }}>🙋</div>
        <h3 style={{ margin:"0 0 6px", fontSize:17, color:"#1e293b", textAlign:"center" }}>¿Quién está vendiendo?</h3>
        <p style={{ margin:"0 0 14px", fontSize:13, color:"#64748b", textAlign:"center" }}>
          Tu nombre queda guardado en los registros que hagas (así cada voluntario puede cuadrar su plata).
        </p>
        <input autoFocus placeholder="Tu nombre" value={nombreVendedor} onChange={e => setNombreVendedor(e.target.value)}
          onKeyDown={e => e.key === "Enter" && reiniciarVendedor()} style={{ ...inp, textAlign:"center", marginBottom:10 }} />
        <button onClick={reiniciarVendedor} style={btn("#16a34a", { width:"100%", padding:12 })}>Empezar a vender</button>
      </div>
    );
  }

  // ── Cabecera de totales ─────────────────────────────────────────────────────
  const stats = [
    { label:"Efectivo en caja", val:fmt(t.esperadoEfectivo), sub:`inicial ${fmt(t.efectivoInicial)} + neto efectivo ${fmt(t.ventasEfectivo + t.pagosEfectivo - t.gastosEfectivo)}`, color:"#16a34a" },
    { label:"Transferencias", val:fmt(t.transferencia), sub:`${fmt(t.ventasTransferencia + t.pagosTransferencia)} − gastos`, color:"#3b82f6" },
    { label:"Por cobrar (al debe)", val:fmt(t.porCobrar), sub:`${abiertas.length} cuenta${abiertas.length === 1 ? "" : "s"} abierta${abiertas.length === 1 ? "" : "s"}`, color:"#f97316" },
    { label:"Neto en caja", val:fmt(t.cobrado), sub:`entró ${fmt(t.bruto)} − gastos ${fmt(t.gastosTotal)}`, color:"#7c3aed" },
  ];

  const vistaCuenta = cuentaAbierta ? saldos.find(c => c.id === cuentaAbierta) : null;
  const lineasCuenta = vistaCuenta ? ventas.filter(v => v.cuentaId === vistaCuenta.id).sort((a, b) => (b.ts || 0) - (a.ts || 0)) : [];
  const pagosCuenta = vistaCuenta ? pagos.filter(p => p.cuentaId === vistaCuenta.id).sort((a, b) => (b.ts || 0) - (a.ts || 0)) : [];

  const movimientos = useMemo(() => {
    const hoy = diaLocal(Date.now());
    const de = (lista, tipo) => lista
      .filter(x => !soloHoy || diaLocal(x.ts) === hoy)
      .map(x => ({ ...x, tipo }));
    return [...de(ventas, "venta"), ...de(pagos, "pago"), ...de(gastos, "gasto")]
      .sort((a, b) => (b.ts || 0) - (a.ts || 0))
      .slice(0, 80);
  }, [ventas, pagos, gastos, soloHoy]);

  const resumenMov = (x) => {
    if (x.tipo === "venta") return `${x.nombre} ×${x.cantidad}`;
    if (x.tipo === "pago") return `Pago de ${saldos.find(c => c.id === x.cuentaId)?.nombre || "cuenta"}`;
    return `Gasto: ${x.concepto}`;
  };

  const textoResumen = useMemo(
    () => resumenTexto({ ventas, cuentas, pagos, gastos, efectivoInicial: t.efectivoInicial, contado },
      { titulo:"BINGO SOLIDARIO — CAJA", cartonesEntregados: cantidadCartones ? totalCartones : null }),
    [ventas, cuentas, pagos, gastos, t.efectivoInicial, contado, cantidadCartones, totalCartones]
  );

  const copiarResumen = async () => {
    try {
      await navigator.clipboard.writeText(textoResumen);
      setCopiado(true); setTimeout(() => setCopiado(false), 2000);
      showToast("📋 Resumen copiado");
    } catch {
      showToast("Mantén presionado el texto para copiarlo", "err");
    }
  };

  return (
    <div style={{ maxWidth:900, margin:"0 auto" }}>
      {/* Equipo */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, marginBottom:10, flexWrap:"wrap" }}>
        <div style={{ fontSize:13, color:"#334155", fontWeight:700 }}>
          👤 Vendiendo como <span style={{ color:"#16a34a" }}>{vendedor}</span>
        </div>
        <button onClick={() => onCambiarVendedor("")} style={{ ...btn("#64748b", { padding:"6px 12px", fontSize:12 }) }}>Cambiar vendedor</button>
      </div>

      {/* Totales */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))", gap:10, marginBottom:12 }}>
        {stats.map(s => (
          <div key={s.label} style={{ ...card, padding:"12px 16px" }}>
            <div style={{ fontSize:22, fontWeight:800, color:s.color }}>{s.val}</div>
            <div style={{ fontSize:13, fontWeight:700, color:"#334155" }}>{s.label}</div>
            <div style={{ fontSize:11, color:"#94a3b8" }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Secciones */}
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:12 }}>
        {VISTAS.map(v => {
          const activo = vista === v.id;
          const badge = v.id === "cuentas" && abiertas.length ? ` ${abiertas.length}` : "";
          return (
            <button key={v.id} onClick={() => setVista(v.id)} style={{
              background: activo ? "#0f1221" : "#fff", border:`1px solid ${activo ? "#0f1221" : "#e2e8f0"}`,
              borderRadius:99, padding:"8px 14px", fontSize:13, fontWeight:700, cursor:"pointer",
              color: activo ? "#fff" : "#475569", fontFamily:"inherit",
            }}>{v.label}{badge}</button>
          );
        })}
      </div>

      {/* ══ VENDER ══ */}
      {vista === "vender" && (
        <div>
          {productosActivos.length === 0 && (
            <div style={{ ...card, textAlign:"center", color:"#64748b", marginBottom:12 }}>
              Todavía no hay productos en el catálogo.
              <div style={{ marginTop:10 }}>
                <button onClick={() => setVista("productos")} style={btn("#0ea5e9")}>🏷️ Armar el catálogo</button>
              </div>
            </div>
          )}

          {productosActivos.length > 0 && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))", gap:8, marginBottom:12 }}>
              {productosActivos.map(p => (
                <button key={p.id} onClick={() => agregarAlTicket({ productoId:p.id, nombre:p.nombre, tipo: p.categoria === "carton" ? "carton" : "producto", precioUnitario: p.precio })}
                  style={{ background:"#fff", border:`2px solid ${(CAT_COLOR[p.categoria] || "#64748b")}33`, borderLeft:`4px solid ${CAT_COLOR[p.categoria] || "#64748b"}`, borderRadius:12, padding:"12px 10px", cursor:"pointer", textAlign:"left", fontFamily:"inherit" }}>
                  <div style={{ fontSize:20 }}>{emojiCat(p.categoria)}</div>
                  <div style={{ fontSize:14, fontWeight:700, color:"#1e293b", lineHeight:1.2 }}>{p.nombre}</div>
                  <div style={{ fontSize:13, fontWeight:800, color:"#16a34a" }}>{fmt(p.precio)}</div>
                </button>
              ))}
              {/* Cartón: se cobra desde la caja (así la plata del cartón queda en el mismo registro) */}
              <button onClick={() => agregarAlTicket({ productoId:"carton", nombre:"Cartón", tipo:"carton", precioUnitario: currentPrice })}
                style={{ background:"#f0fdf4", border:"2px solid #16a34a", borderRadius:12, padding:"12px 10px", cursor:"pointer", textAlign:"left", fontFamily:"inherit" }}>
                <div style={{ fontSize:20 }}>🎟️</div>
                <div style={{ fontSize:14, fontWeight:700, color:"#1e293b" }}>Cartón</div>
                <div style={{ fontSize:13, fontWeight:800, color:"#16a34a" }}>{fmt(currentPrice)}</div>
              </button>
            </div>
          )}

          {ticket.length > 0 && (
            <div style={card}>
              <h3 style={titulo}>Venta en curso</h3>
              <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:12 }}>
                {ticket.map(l => (
                  <div key={l.clave} style={{ display:"flex", alignItems:"center", gap:10, background:"#f8fafc", borderRadius:10, padding:"8px 12px" }}>
                    <div style={{ flex:1, fontSize:14, fontWeight:700, color:"#1e293b" }}>
                      {l.tipo === "carton" ? "🎟️ " : ""}{l.nombre}
                      <span style={{ fontWeight:400, color:"#94a3b8", fontSize:12 }}> · {fmt(l.precioUnitario)} c/u</span>
                    </div>
                    <button onClick={() => cambiarCantidad(l.clave, -1)} style={{ ...btn("#e2e8f0", { color:"#475569", padding:"2px 10px", fontSize:15 }) }}>−</button>
                    <div style={{ minWidth:22, textAlign:"center", fontWeight:800 }}>{l.cantidad}</div>
                    <button onClick={() => cambiarCantidad(l.clave, 1)} style={{ ...btn("#e2e8f0", { color:"#475569", padding:"2px 10px", fontSize:15 }) }}>+</button>
                    <div style={{ minWidth:70, textAlign:"right", fontWeight:800, color:"#16a34a" }}>{fmt(l.cantidad * l.precioUnitario)}</div>
                  </div>
                ))}
              </div>

              <div style={{ fontSize:12, fontWeight:700, color:"#64748b", marginBottom:6 }}>¿CÓMO PAGA?</div>
              <div style={{ display:"flex", gap:6, marginBottom:10, flexWrap:"wrap" }}>
                {[...MEDIOS, { id:"debe", nombre:"Al debe", emoji:"📝" }].map(m => (
                  <button key={m.id} onClick={() => setMedio(m.id)} style={{
                    background: medio === m.id ? (m.id === "debe" ? "#f97316" : "#0f1221") : "#f1f5f9",
                    color: medio === m.id ? "#fff" : "#475569", border:"none", borderRadius:10, padding:"10px 16px",
                    fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"inherit",
                  }}>{m.emoji} {m.nombre}</button>
                ))}
              </div>

              {medio === "debe" && (
                <div style={{ background:"#fff7ed", border:"1px solid #fed7aa", borderRadius:10, padding:12, marginBottom:10 }}>
                  <div style={{ fontSize:12, color:"#9a3412", fontWeight:700, marginBottom:8 }}>
                    Se queda debiendo {fmt(totalTicket)} (bebidas y hasta cartones en la misma cuenta)
                  </div>
                  {abiertas.length > 0 && (
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:8 }}>
                      {abiertas.map(c => (
                        <button key={c.id} onClick={() => { setCuentaSel(cuentaSel === c.id ? null : c.id); setCuentaNueva(""); }}
                          style={{ background: cuentaSel === c.id ? "#f97316" : "#fff", color: cuentaSel === c.id ? "#fff" : "#9a3412", border:"1px solid #fdba74", borderRadius:99, padding:"6px 12px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                          {c.nombre} · {fmt(c.saldo)}
                        </button>
                      ))}
                    </div>
                  )}
                  <input placeholder="…o escribe el nombre para una cuenta nueva" value={cuentaNueva}
                    onChange={e => { setCuentaNueva(e.target.value); setCuentaSel(null); }} style={inp} />
                </div>
              )}

              <button onClick={registrarVenta} style={btn(medio === "debe" ? "#f97316" : "#16a34a", { width:"100%", padding:14, fontSize:16 })}>
                {medio === "debe" ? `📝 Anotar ${fmt(totalTicket)} al debe` : `✓ Cobrar ${fmt(totalTicket)}`}
              </button>
            </div>
          )}

          {ticket.length === 0 && productosActivos.length > 0 && (
            <div style={{ ...card, textAlign:"center", color:"#94a3b8", fontSize:13 }}>
              Toca los productos que se lleva el cliente para armar la venta
            </div>
          )}
        </div>
      )}

      {/* ══ PRODUCTOS ══ */}
      {vista === "productos" && (
        <div>
          <div style={{ ...card, marginBottom:12 }}>
            <h3 style={titulo}>➕ Agregar producto o comida</h3>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 120px", gap:8, marginBottom:8 }}>
              <input placeholder="Nombre (ej: Bebida, Completo, Kuchen)" value={prodNombre} onChange={e => setProdNombre(e.target.value)} style={inp} />
              <input placeholder="Precio $" inputMode="numeric" value={prodPrecio} onChange={e => setProdPrecio(e.target.value)} style={{ ...inp, textAlign:"right" }} />
            </div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
              {CATEGORIAS.map(c => (
                <button key={c.id} onClick={() => setProdCat(c.id)} style={{
                  background: prodCat === c.id ? (CAT_COLOR[c.id] || "#64748b") : "#f1f5f9",
                  color: prodCat === c.id ? "#fff" : "#475569", border:"none", borderRadius:99,
                  padding:"7px 13px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
                }}>{c.emoji} {c.nombre}</button>
              ))}
            </div>
            <button onClick={async () => {
              if (!prodNombre.trim()) return showToast("Escribe el nombre", "err");
              const precio = soloNumero(prodPrecio);
              if (precio <= 0) return showToast("Escribe el precio", "err");
              await api.agregarProducto({ nombre: prodNombre.trim(), precio, categoria: prodCat });
              showToast(`✓ ${prodNombre.trim()} ${fmt(precio)}`);
              setProdNombre(""); setProdPrecio("");
            }} style={btn("#16a34a", { width:"100%", padding:12 })}>Agregar al catálogo</button>

            <div style={{ marginTop:12 }}>
              <div style={{ fontSize:11, color:"#94a3b8", fontWeight:700, marginBottom:6 }}>ATAJOS (llenan el nombre, tú pones el precio)</div>
              <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                {SUGERENCIAS_PRODUCTO.map(s => (
                  <button key={s} onClick={() => setProdNombre(s)} style={{ background:"#f1f5f9", border:"1px solid #e2e8f0", borderRadius:99, padding:"5px 11px", fontSize:12, color:"#475569", cursor:"pointer", fontFamily:"inherit" }}>{s}</button>
                ))}
              </div>
            </div>
          </div>

          {productos.length === 0 && (
            <div style={{ ...card, textAlign:"center", color:"#94a3b8", fontSize:13 }}>El catálogo está vacío</div>
          )}

          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {productos.map(p => {
              const enEdicion = prodEdit?.id === p.id;
              return (
                <div key={p.id}>
                  <div onClick={() => setProdEdit(enEdicion ? null : { id:p.id, nombre:p.nombre, precio:String(p.precio), categoria:p.categoria || "otro" })}
                    style={{ ...card, padding:"12px 16px", display:"flex", alignItems:"center", gap:10, cursor:"pointer", borderLeft:`4px solid ${CAT_COLOR[p.categoria] || "#64748b"}`, opacity: p.activo === false ? 0.5 : 1 }}>
                    <span style={{ fontSize:20 }}>{emojiCat(p.categoria)}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:14, color:"#1e293b" }}>
                        {p.nombre} {p.activo === false && <span style={{ fontSize:11, color:"#94a3b8" }}>· oculto</span>}
                      </div>
                      <div style={{ fontSize:12, color:"#94a3b8" }}>{CATEGORIAS.find(c => c.id === p.categoria)?.nombre || "Otro"}</div>
                    </div>
                    <div style={{ fontWeight:800, color:"#16a34a" }}>{fmt(p.precio)}</div>
                    <button onClick={e => { e.stopPropagation(); api.editarProducto(p.id, { activo: p.activo === false }); }}
                      style={{ ...btn("#f1f5f9", { color:"#475569", padding:"5px 9px", fontSize:12 }) }}>{p.activo === false ? "Mostrar" : "Ocultar"}</button>
                  </div>
                  {enEdicion && (
                    <div style={{ ...card, borderTopLeftRadius:0, borderTopRightRadius:0, background:"#f8fafc" }}>
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
                          await api.editarProducto(p.id, { nombre: prodEdit.nombre.trim(), precio: soloNumero(prodEdit.precio), categoria: prodEdit.categoria });
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
        </div>
      )}

      {/* ══ CUENTAS AL DEBE ══ */}
      {vista === "cuentas" && (
        <div>
          {vistaCuenta ? (
            <div>
              <button onClick={() => { setCuentaAbierta(null); setPagoForm({ monto:"", medio:EFECTIVO }); }} style={{ ...btn("#f1f5f9", { color:"#475569", marginBottom:10 }) }}>‹ Volver a las cuentas</button>
              <div style={{ ...card, marginBottom:12, borderLeft:"4px solid #f97316" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10, flexWrap:"wrap" }}>
                  <div>
                    <h3 style={{ margin:"0 0 4px", fontSize:17, color:"#1e293b" }}>📝 {vistaCuenta.nombre}</h3>
                    <div style={{ fontSize:12, color:"#94a3b8" }}>Abierta por {vistaCuenta.vendedor || "—"} · {lineasCuenta.length} ítem(s)</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:24, fontWeight:800, color: vistaCuenta.saldo > 0 ? "#f97316" : "#16a34a" }}>{fmt(vistaCuenta.saldo)}</div>
                    <div style={{ fontSize:11, color:"#94a3b8" }}>total {fmt(vistaCuenta.items)} · pagado {fmt(vistaCuenta.pagado)}</div>
                  </div>
                </div>
              </div>

              {vistaCuenta.saldo > 0 && (
                <div style={{ ...card, marginBottom:12 }}>
                  <h3 style={titulo}>💵 Registrar pago</h3>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
                    <input inputMode="numeric" placeholder="Monto" value={pagoForm.monto} onChange={e => setPagoForm({ ...pagoForm, monto:e.target.value })} style={{ ...inp, textAlign:"right" }} />
                    <button onClick={() => setPagoForm({ ...pagoForm, monto:String(vistaCuenta.saldo) })} style={btn("#f1f5f9", { color:"#475569" })}>Todo ({fmt(vistaCuenta.saldo)})</button>
                  </div>
                  <div style={{ display:"flex", gap:6, marginBottom:10 }}>
                    {MEDIOS.map(m => (
                      <button key={m.id} onClick={() => setPagoForm({ ...pagoForm, medio:m.id })} style={{
                        background: pagoForm.medio === m.id ? "#0f1221" : "#f1f5f9", color: pagoForm.medio === m.id ? "#fff" : "#475569",
                        border:"none", borderRadius:10, padding:"9px 14px", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit",
                      }}>{m.emoji} {m.nombre}</button>
                    ))}
                  </div>
                  <button onClick={() => registrarPago(vistaCuenta)} style={btn("#16a34a", { width:"100%", padding:12 })}>Registrar pago</button>
                </div>
              )}

              <div style={{ ...card, marginBottom:12 }}>
                <h3 style={titulo}>Consumido</h3>
                {lineasCuenta.length === 0 && <div style={{ fontSize:13, color:"#94a3b8" }}>Sin ítems todavía</div>}
                <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                  {lineasCuenta.map(l => (
                    <div key={l.id} style={{ display:"flex", alignItems:"center", gap:10, background:"#f8fafc", borderRadius:8, padding:"8px 12px" }}>
                      <div style={{ flex:1, fontSize:13, fontWeight:700, color:"#1e293b" }}>
                        {l.tipo === "carton" ? "🎟️ " : ""}{l.nombre} ×{l.cantidad}
                        <span style={{ fontWeight:400, color:"#94a3b8" }}> · {horaLocal(l.ts)} · {l.vendedor || "—"}</span>
                      </div>
                      <div style={{ fontWeight:800, color:"#16a34a", fontSize:13 }}>{fmt(l.total ?? l.cantidad * l.precioUnitario)}</div>
                      <button onClick={async () => {
                        if (!window.confirm(`¿Quitar "${l.nombre} ×${l.cantidad}" de la cuenta?`)) return;
                        await api.borrarLinea(l.id); showToast("Ítem quitado");
                      }} style={{ background:"none", border:"none", color:"#94a3b8", cursor:"pointer", fontSize:15 }}>✕</button>
                    </div>
                  ))}
                </div>
                {pagosCuenta.length > 0 && (
                  <>
                    <div style={{ fontSize:12, fontWeight:700, color:"#64748b", margin:"14px 0 6px" }}>PAGOS RECIBIDOS</div>
                    {pagosCuenta.map(p => (
                      <div key={p.id} style={{ display:"flex", alignItems:"center", gap:10, background:"#f0fdf4", borderRadius:8, padding:"8px 12px", marginBottom:5 }}>
                        <div style={{ flex:1, fontSize:13, fontWeight:700, color:"#166534" }}>
                          {p.medio === TRANSFERENCIA ? "🏦" : "💵"} {horaLocal(p.ts)} · {p.vendedor || "—"}
                        </div>
                        <div style={{ fontWeight:800, color:"#166534", fontSize:13 }}>{fmt(p.monto)}</div>
                        <button onClick={async () => { await api.borrarPago(p.id); showToast("Pago anulado"); }} style={{ background:"none", border:"none", color:"#94a3b8", cursor:"pointer", fontSize:15 }}>✕</button>
                      </div>
                    ))}
                  </>
                )}
              </div>

              {productosActivos.length > 0 && (
                <div style={{ ...card, marginBottom:12 }}>
                  <h3 style={titulo}>Agregar más a la cuenta</h3>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))", gap:6 }}>
                    {productosActivos.map(p => (
                      <button key={p.id} onClick={async () => {
                        await api.registrarVenta({ lineas:[{ productoId:p.id, nombre:p.nombre, tipo: p.categoria === "carton" ? "carton" : "producto", precioUnitario:p.precio, cantidad:1 }], medio:null, cuentaId:vistaCuenta.id });
                        showToast(`+ ${p.nombre} → ${vistaCuenta.nombre}`);
                      }} style={{ background:"#fff", border:`1px solid ${CAT_COLOR[p.categoria] || "#e2e8f0"}`, borderRadius:10, padding:"9px 10px", cursor:"pointer", textAlign:"left", fontFamily:"inherit" }}>
                        <div style={{ fontSize:13, fontWeight:700, color:"#1e293b" }}>{emojiCat(p.categoria)} {p.nombre}</div>
                        <div style={{ fontSize:12, fontWeight:800, color:"#16a34a" }}>{fmt(p.precio)}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={async () => {
                if (!window.confirm(`¿Borrar la cuenta de ${vistaCuenta.nombre} y todo su detalle?`)) return;
                await api.borrarCuenta(vistaCuenta.id); setCuentaAbierta(null); showToast("Cuenta borrada");
              }} style={btn("#ef4444", { width:"100%" })}>🗑️ Borrar cuenta completa</button>
            </div>
          ) : (
            <div>
              {abiertas.length === 0 && (
                <div style={{ ...card, textAlign:"center", color:"#94a3b8", fontSize:13, marginBottom:12 }}>
                  Nadie quedó debiendo nada 🎉 — las cuentas se crean al anotar una venta “al debe”.
                </div>
              )}
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {abiertas.map(c => (
                  <div key={c.id} onClick={() => { setCuentaAbierta(c.id); setPagoForm({ monto:"", medio:EFECTIVO }); }}
                    style={{ ...card, display:"flex", alignItems:"center", gap:12, cursor:"pointer", borderLeft:"4px solid #f97316" }}>
                    <div style={{ fontSize:22 }}>📝</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:15, color:"#1e293b" }}>{c.nombre}</div>
                      <div style={{ fontSize:11, color:"#94a3b8" }}>
                        {c.cantidadLineas} ítem(s){c.pagado > 0 ? ` · pagó ${fmt(c.pagado)}` : ""}{c.vendedor ? ` · ${c.vendedor}` : ""}
                      </div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontWeight:800, color:"#f97316", fontSize:16 }}>{fmt(c.saldo)}</div>
                      <div style={{ fontSize:11, color:"#94a3b8" }}>debe</div>
                    </div>
                  </div>
                ))}
              </div>

              {cerradas.length > 0 && (
                <div style={{ marginTop:14 }}>
                  <button onClick={() => setCerradasAbiertas(!cerradasAbiertas)} style={{ ...btn("#f1f5f9", { color:"#475569" }) }}>
                    {cerradasAbiertas ? "▲" : "▼"} Cuentas pagadas ({cerradas.length})
                  </button>
                  {cerradasAbiertas && (
                    <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:8 }}>
                      {cerradas.map(c => (
                        <div key={c.id} onClick={() => { setCuentaAbierta(c.id); setPagoForm({ monto:"", medio:EFECTIVO }); }}
                          style={{ ...card, padding:"10px 16px", display:"flex", alignItems:"center", gap:10, cursor:"pointer", borderLeft:"4px solid #16a34a" }}>
                          <div style={{ flex:1, fontSize:14, fontWeight:700, color:"#1e293b" }}>{c.nombre}</div>
                          <div style={{ fontSize:12, color:"#94a3b8" }}>total {fmt(c.items)} · {c.cantidadLineas} ítem(s)</div>
                          <div style={{ fontWeight:800, color:"#16a34a", fontSize:13 }}>✓ pagada</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══ MOVIMIENTOS ══ */}
      {vista === "movimientos" && (
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10, gap:10, flexWrap:"wrap" }}>
            <div style={{ fontSize:13, color:"#64748b" }}>
              {soloHoy ? "Movimientos de hoy" : "Todos los movimientos"} · {movimientos.length} registro(s)
            </div>
            <button onClick={() => setSoloHoy(!soloHoy)} style={btn(soloHoy ? "#0f1221" : "#f1f5f9", soloHoy ? {} : { color:"#475569" })}>
              {soloHoy ? "📅 Ver todo" : "📅 Ver solo hoy"}
            </button>
          </div>
          {movimientos.length === 0 && <div style={{ ...card, textAlign:"center", color:"#94a3b8", fontSize:13 }}>Sin movimientos</div>}
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {movimientos.map(x => {
              const enEdicion = editando?.id === x.id;
              const color = x.tipo === "venta" ? "#16a34a" : x.tipo === "pago" ? "#3b82f6" : "#ef4444";
              const signo = x.tipo === "gasto" ? "−" : "+";
              const monto = x.tipo === "venta" ? (x.total ?? x.cantidad * x.precioUnitario) : x.monto;
              return (
                <div key={x.id}>
                  <div onClick={() => setEditando(enEdicion ? null : { id:x.id, tipo:x.tipo, cantidad:x.cantidad, precioUnitario:x.precioUnitario, monto:x.monto, concepto:x.concepto, medio:x.medio })}
                    style={{ ...card, padding:"11px 16px", display:"flex", alignItems:"center", gap:10, cursor:"pointer", borderLeft:`4px solid ${x.tipo === "venta" && x.cuentaId ? "#f97316" : color}` }}>
                    <div style={{ width:52, fontSize:12, color:"#94a3b8", fontWeight:700 }}>{horaLocal(x.ts)}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:14, color:"#1e293b" }}>{resumenMov(x)}</div>
                      <div style={{ fontSize:11, color:"#94a3b8" }}>
                        {x.tipo === "venta"
                          ? (x.cuentaId ? "📝 al debe" : (x.medio === TRANSFERENCIA ? "🏦 transferencia" : "💵 efectivo"))
                          : (x.medio === TRANSFERENCIA ? "🏦 transferencia" : "💵 efectivo")}
                        {x.vendedor ? ` · ${x.vendedor}` : ""}
                        {x.tipo === "venta" && x.dia ? ` · ${x.dia}` : ""}
                      </div>
                    </div>
                    <div style={{ fontWeight:800, color, fontSize:14 }}>{signo}{fmt(monto)}</div>
                  </div>
                  {enEdicion && (
                    <div style={{ ...card, borderTopLeftRadius:0, borderTopRightRadius:0, background:"#f8fafc" }}>
                      {x.tipo === "venta" ? (
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
                          <div style={{ fontSize:12, color:"#64748b", marginBottom:8 }}>
                            Queda en <strong>{fmt(soloNumero(editando.cantidad) * soloNumero(editando.precioUnitario))}</strong>
                          </div>
                        </>
                      ) : x.tipo === "pago" ? (
                        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
                          <input inputMode="numeric" value={editando.monto} onChange={e => setEditando({ ...editando, monto: soloNumero(e.target.value) })} style={{ ...inp, textAlign:"right" }} />
                          <div style={{ display:"flex", gap:6 }}>
                            {MEDIOS.map(m => (
                              <button key={m.id} onClick={() => setEditando({ ...editando, medio:m.id })} style={{
                                background: editando.medio === m.id ? "#0f1221" : "#e2e8f0", color: editando.medio === m.id ? "#fff" : "#475569",
                                border:"none", borderRadius:10, padding:"8px 10px", fontWeight:700, fontSize:12, cursor:"pointer", fontFamily:"inherit", flex:1,
                              }}>{m.emoji}</button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div style={{ display:"grid", gridTemplateColumns:"1fr 120px", gap:8, marginBottom:8 }}>
                          <input value={editando.concepto} onChange={e => setEditando({ ...editando, concepto:e.target.value })} style={inp} />
                          <input inputMode="numeric" value={editando.monto} onChange={e => setEditando({ ...editando, monto: soloNumero(e.target.value) })} style={{ ...inp, textAlign:"right" }} />
                        </div>
                      )}
                      <div style={{ display:"flex", gap:8 }}>
                        <button onClick={async () => {
                          if (x.tipo === "venta") {
                            const cantidad = soloNumero(editando.cantidad);
                            const precioUnitario = soloNumero(editando.precioUnitario);
                            if (cantidad < 1) return showToast("La cantidad debe ser 1 o más", "err");
                            await api.corregirLinea(x.id, { cantidad, precioUnitario, total: cantidad * precioUnitario, ...(x.cuentaId ? {} : { medio: editando.medio || EFECTIVO }) });
                          } else if (x.tipo === "pago") {
                            const monto = soloNumero(editando.monto);
                            if (monto <= 0) return showToast("El monto debe ser mayor a 0", "err");
                            await api.editarPago(x.id, { monto, medio: editando.medio || EFECTIVO });
                          } else {
                            const monto = soloNumero(editando.monto);
                            if (monto <= 0) return showToast("El monto debe ser mayor a 0", "err");
                            await api.editarGasto(x.id, { concepto: editando.concepto.trim() || "Gasto", monto });
                          }
                          showToast("✓ Movimiento corregido"); setEditando(null);
                        }} style={btn("#16a34a", { flex:1 })}>Guardar corrección</button>
                        <button onClick={async () => {
                          if (!window.confirm("¿Borrar este movimiento? No se puede deshacer.")) return;
                          if (x.tipo === "venta") await api.borrarLinea(x.id);
                          else if (x.tipo === "pago") await api.borrarPago(x.id);
                          else await api.borrarGasto(x.id);
                          showToast("Movimiento borrado"); setEditando(null);
                        }} style={btn("#ef4444")}>Borrar</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ GASTOS ══ */}
      {vista === "gastos" && (
        <div>
          <div style={{ ...card, marginBottom:12 }}>
            <h3 style={titulo}>➖ Registrar salida de dinero</h3>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 130px", gap:8, marginBottom:8 }}>
              <input placeholder="¿En qué se fue? (hielo, vueltos, insumos)" value={gastoForm.concepto} onChange={e => setGastoForm({ ...gastoForm, concepto:e.target.value })} style={inp} />
              <input placeholder="Monto $" inputMode="numeric" value={gastoForm.monto} onChange={e => setGastoForm({ ...gastoForm, monto:e.target.value })} style={{ ...inp, textAlign:"right" }} />
            </div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:8 }}>
              {TIPOS_GASTO.map(tp => (
                <button key={tp} onClick={() => setGastoForm({ ...gastoForm, concepto: tp === "Otro" ? "" : tp })} style={{ background:"#f1f5f9", border:"1px solid #e2e8f0", borderRadius:99, padding:"5px 11px", fontSize:12, color:"#475569", cursor:"pointer", fontFamily:"inherit" }}>{tp}</button>
              ))}
            </div>
            <div style={{ display:"flex", gap:6, marginBottom:10 }}>
              {MEDIOS.map(m => (
                <button key={m.id} onClick={() => setGastoForm({ ...gastoForm, medio:m.id })} style={{
                  background: gastoForm.medio === m.id ? "#0f1221" : "#f1f5f9", color: gastoForm.medio === m.id ? "#fff" : "#475569",
                  border:"none", borderRadius:10, padding:"9px 14px", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit",
                }}>{m.emoji} {m.nombre}</button>
              ))}
            </div>
            <button onClick={async () => {
              const monto = soloNumero(gastoForm.monto);
              if (!gastoForm.concepto.trim()) return showToast("Escribe en qué se fue", "err");
              if (monto <= 0) return showToast("Escribe el monto", "err");
              await api.registrarGasto({ concepto: gastoForm.concepto.trim(), monto, medio: gastoForm.medio });
              showToast(`✓ Gasto ${fmt(monto)} registrado`);
              setGastoForm({ concepto:"", monto:"", medio: EFECTIVO });
            }} style={btn("#ef4444", { width:"100%", padding:12 })}>Registrar gasto</button>
          </div>

          <div style={card}>
            <h3 style={titulo}>Gastos registrados ({gastos.length}) · {fmt(t.gastosTotal)}</h3>
            {gastos.length === 0 && <div style={{ fontSize:13, color:"#94a3b8" }}>Sin gastos</div>}
            {[...gastos].sort((a, b) => (b.ts || 0) - (a.ts || 0)).map(g => (
              <div key={g.id} style={{ display:"flex", alignItems:"center", gap:10, background:"#f8fafc", borderRadius:8, padding:"8px 12px", marginBottom:5 }}>
                <div style={{ flex:1, fontSize:13, fontWeight:700, color:"#1e293b" }}>
                  {g.concepto}
                  <span style={{ fontWeight:400, color:"#94a3b8" }}> · {horaLocal(g.ts)} · {g.medio === TRANSFERENCIA ? "🏦" : "💵"} · {g.vendedor || "—"}</span>
                </div>
                <div style={{ fontWeight:800, color:"#ef4444", fontSize:13 }}>{fmt(g.monto)}</div>
                <button onClick={async () => { await api.borrarGasto(g.id); showToast("Gasto borrado"); }} style={{ background:"none", border:"none", color:"#94a3b8", cursor:"pointer", fontSize:15 }}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ CIERRE / ARQUEO ══ */}
      {vista === "cierre" && (
        <div>
          <div style={{ ...card, marginBottom:12 }}>
            <h3 style={titulo}>🔒 Cierre de caja (arqueo)</h3>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
              <div>
                <div style={{ fontSize:11, color:"#94a3b8", fontWeight:700, marginBottom:4 }}>EFECTIVO INICIAL (CAMBIO)</div>
                <div style={{ display:"flex", gap:6 }}>
                  <input inputMode="numeric" value={inicial} onChange={e => setInicial(e.target.value)} style={{ ...inp, textAlign:"right" }} />
                  <button onClick={async () => { await api.guardarEfectivoInicial(soloNumero(inicial)); showToast("✓ Efectivo inicial guardado"); }} style={btn("#0ea5e9")}>Guardar</button>
                </div>
              </div>
              <div>
                <div style={{ fontSize:11, color:"#94a3b8", fontWeight:700, marginBottom:4 }}>EFECTIVO CONTADO</div>
                <input inputMode="numeric" placeholder="Cuenta los billetes y escribe el total" value={contado} onChange={e => setContado(e.target.value)} style={{ ...inp, textAlign:"right" }} />
              </div>
            </div>

            <div style={{ background:"#f8fafc", borderRadius:10, padding:12, fontSize:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}><span style={{ color:"#64748b" }}>Efectivo esperado (inicial + ventas efectivo − gastos)</span><strong>{fmt(caja.esperado)}</strong></div>
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
                ts: Date.now(), vendedor,
                efectivoInicial: t.efectivoInicial, esperadoEfectivo: caja.esperado, contado: caja.contado, diferencia: caja.diferencia,
                efectivo: t.efectivo, transferencia: t.transferencia, gastos: t.gastosTotal,
                cobrado: t.cobrado, porCobrar: t.porCobrar, bruto: t.bruto,
                alDebe: t.alDebe, pagadoDeMas: t.pagadoDeMas,
                cartones: cartones.cantidad, cartonesTotal: cartones.total,
                porProducto: porProducto(ventas), porVendedor: porVendedor({ ventas, pagos, gastos }),
              });
              showToast(`✓ Cierre guardado · diferencia ${fmtSigno(caja.diferencia)}`);
              setContado("");
            }} style={btn("#7c3aed", { width:"100%", padding:13 })}>Guardar cierre del momento</button>
          </div>

          <div style={{ ...card, marginBottom:12 }}>
            <h3 style={titulo}>👥 Por vendedor</h3>
            <div style={{ overflowX:"auto" }}>
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
            <div style={{ fontSize:11, color:"#94a3b8", marginTop:8 }}>
              Cada voluntario puede cuadrar su propia plata con esta tabla (el efectivo inicial es uno solo para todo el evento).
            </div>
          </div>

          <div style={card}>
            <h3 style={titulo}>Cierres guardados ({cierres.length})</h3>
            {cierres.length === 0 && <div style={{ fontSize:13, color:"#94a3b8" }}>Todavía no hay cierres</div>}
            {[...cierres].sort((a, b) => (b.ts || 0) - (a.ts || 0)).map(c => (
              <div key={c.id} style={{ background:"#f8fafc", borderRadius:8, padding:"10px 12px", marginBottom:6 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:"#1e293b" }}>{fechaTexto(c.ts)}</div>
                    <div style={{ fontSize:11, color:"#94a3b8" }}>por {c.vendedor || "—"} · esperado {fmt(c.esperadoEfectivo)} · contado {fmt(c.contado)}</div>
                  </div>
                  <div style={{ fontWeight:800, fontSize:13, color: c.diferencia === 0 ? "#16a34a" : c.diferencia > 0 ? "#3b82f6" : "#ef4444" }}>
                    {fmtSigno(c.diferencia)}
                  </div>
                  <button onClick={async () => { await api.borrarCierre(c.id); showToast("Cierre borrado"); }} style={{ background:"none", border:"none", color:"#94a3b8", cursor:"pointer", fontSize:15 }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ RESUMEN ══ */}
      {vista === "resumen" && (
        <div>
          <div style={{ ...card, marginBottom:12 }}>
            <h3 style={titulo}>📤 Copiar y enviar</h3>
            <textarea readOnly value={textoResumen} rows={18}
              style={{ ...inp, fontFamily:"monospace", fontSize:12, lineHeight:1.5, resize:"vertical", whiteSpace:"pre", marginBottom:10 }} />
            <button onClick={copiarResumen} style={btn(copiado ? "#0ea5e9" : "#16a34a", { width:"100%", padding:12 })}>
              {copiado ? "✓ Copiado" : "📋 Copiar resumen"}
            </button>
          </div>

          <div style={{ ...card, marginBottom:12 }}>
            <h3 style={titulo}>🧾 Vendido por producto</h3>
            {porProducto(ventas).length === 0 && <div style={{ fontSize:13, color:"#94a3b8" }}>Sin ventas registradas</div>}
            {porProducto(ventas).map(p => (
              <div key={p.clave} style={{ display:"flex", alignItems:"center", gap:10, borderBottom:"1px solid #f1f5f9", padding:"8px 0" }}>
                <div style={{ flex:1, fontSize:14, fontWeight:700, color:"#1e293b" }}>
                  {p.tipo === "carton" ? "🎟️ " : ""}{p.nombre}
                  {p.alDebe > 0 && <span style={{ fontSize:11, color:"#f97316" }}> · {fmt(p.alDebe)} al debe</span>}
                </div>
                <div style={{ fontSize:13, color:"#64748b", minWidth:40, textAlign:"right" }}>×{p.cantidad}</div>
                <div style={{ fontWeight:800, color:"#16a34a", minWidth:80, textAlign:"right" }}>{fmt(p.total)}</div>
              </div>
            ))}
          </div>

          <div style={card}>
            <h3 style={titulo}>🗓️ Jornada de hoy</h3>
            {(() => {
              const hoy = diaLocal(Date.now());
              const ventasHoy = ventas.filter(v => diaLocal(v.ts) === hoy);
              const gastosHoy = gastos.filter(g => diaLocal(g.ts) === hoy);
              const tt = totalesCaja({ ventas: ventasHoy, cuentas, pagos, gastos: gastosHoy, efectivoInicial: 0 });
              return (
                <div style={{ fontSize:13, color:"#475569", lineHeight:1.9 }}>
                  <div>Vendido hoy: <strong>{fmt(tt.bruto - (tt.pagosEfectivo + tt.pagosTransferencia))}</strong> en {ventasHoy.length} línea(s)</div>
                  <div>Cobrado hoy (incluye pagos de cuentas): <strong>{fmt(tt.bruto)}</strong></div>
                  <div style={{ color:"#f97316" }}>Al debe hoy: <strong>{fmt(tt.alDebe)}</strong></div>
                  <div style={{ color:"#ef4444" }}>Gastos hoy: <strong>{fmt(tt.gastosTotal)}</strong></div>
                </div>
              );
            })()}
            <div style={{ fontSize:11, color:"#94a3b8", marginTop:10, borderTop:"1px solid #f1f5f9", paddingTop:8 }}>
              Los cartones entregados ({cantidadCartones} · {fmt(totalCartones)}) se cuentan en la pestaña Cartones.
              Acá se registra la plata que efectivamente entra, incluidos los cartones que se cobran por caja.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
