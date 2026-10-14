// ── Caja del evento ──────────────────────────────────────────────────────────
// Todo lo que se vende además de los cartones (bebida, comida, dulces) más lo que se
// cobra en caja, con el detalle de efectivo / transferencia / al debe, los gastos y el
// arqueo. Son funciones puras para que la plata se pueda probar con npm test
// (ver tests/caja.test.js) sin depender de Firebase ni de React.
//
// Modelo de datos (Firebase Realtime Database):
//   bingo_productos/{id}  { id, nombre, precio, categoria, activo }
//   bingo_ventas/{id}     { id, ts, dia, nombre, productoId, tipo, cantidad,
//                           precioUnitario, total, medio, cuentaId, vendedor }
//        · contado  → medio "efectivo" | "transferencia", cuentaId = null
//        · al debe  → cuentaId = <cuenta>, medio = null (se cobra con pagos)
//   bingo_cuentas/{id}    { id, nombre, ts, vendedor }
//   bingo_pagos/{id}      { id, cuentaId, monto, medio, ts, vendedor }
//   bingo_gastos/{id}     { id, concepto, monto, medio, ts, vendedor }
//   bingo_cierres/{id}    arqueo guardado (snapshot del momento)
//
// Montos en pesos enteros (CLP), sin decimales: se redondea siempre.

export const EFECTIVO = "efectivo";
export const TRANSFERENCIA = "transferencia";

export const MEDIOS = [
  { id: EFECTIVO, nombre: "Efectivo", emoji: "💵" },
  { id: TRANSFERENCIA, nombre: "Transferencia", emoji: "🏦" },
];

export const TIPOS_GASTO = ["Compra", "Vuelto", "Insumo", "Otro"];

export function fmt(n) {
  const v = Math.round(Number(n) || 0);
  return `$${v.toLocaleString("es-CL")}`;
}

// Monto con signo, para las diferencias del arqueo: "+$1.000", "−$1.000" o "$0".
export function fmtSigno(n) {
  const v = Math.round(Number(n) || 0);
  if (v === 0) return fmt(0);
  return `${v > 0 ? "+" : "−"}${fmt(Math.abs(v))}`;
}

export function sumar(lista, valor = (x) => x.total) {
  return (lista || []).reduce((a, x) => a + Math.round(Number(valor(x)) || 0), 0);
}

export function horaLocal(ts) {
  return new Date(ts || Date.now()).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}

// Clave de la jornada en hora local (YYYY-MM-DD) para agrupar por día.
export function diaLocal(ts) {
  const d = new Date(ts || Date.now());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function fechaTexto(ts) {
  return new Date(ts || Date.now()).toLocaleString("es-CL", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// Una venta al debe es la que pertenece a una cuenta (todavía no pagada).
export function esAlDebe(venta) {
  return !!(venta && venta.cuentaId);
}

export function lineasDeCuenta(cuentaId, ventas) {
  return (ventas || []).filter((v) => v.cuentaId === cuentaId);
}

export function pagosDeCuenta(cuentaId, pagos) {
  return (pagos || []).filter((p) => p.cuentaId === cuentaId);
}

export function medioDe(venta) {
  if (esAlDebe(venta)) return "debe";
  return venta.medio || EFECTIVO;
}

export function totalLinea(venta) {
  const guardado = Number(venta.total);
  if (Number.isFinite(guardado) && venta.total !== undefined && venta.total !== null) return Math.round(guardado);
  return Math.round((Number(venta.cantidad) || 0) * (Number(venta.precioUnitario) || 0));
}

// Saldo de una cuenta al debe: lo pedido menos lo ya pagado.
//   saldo > 0  → todavía debe esa plata
//   saldo = 0  → pagada
//   saldo < 0  → pagó de más (hay que devolver)
export function saldoCuenta(cuenta, ventas, pagos) {
  const items = sumar(lineasDeCuenta(cuenta.id, ventas));
  const pagado = sumar(pagosDeCuenta(cuenta.id, pagos), (p) => p.monto);
  return { items, pagado, saldo: items - pagado };
}

// Todas las cuentas con su saldo calculado, primero las que todavía deben.
export function cuentasConSaldo(cuentas, ventas, pagos) {
  return (cuentas || [])
    .map((c) => {
      const { items, pagado, saldo } = saldoCuenta(c, ventas, pagos);
      const lineas = lineasDeCuenta(c.id, ventas);
      const pagosCuenta = pagosDeCuenta(c.id, pagos);
      const ultimo = Math.max(0, ...lineas.map((v) => v.ts || 0), ...pagosCuenta.map((p) => p.ts || 0));
      return {
        ...c, items, pagado, saldo,
        cantidadLineas: lineas.length,
        cantidadPagos: pagosCuenta.length,
        ultimo,
        abierta: saldo !== 0,
      };
    })
    .sort((a, b) => (b.abierta ? 1 : 0) - (a.abierta ? 1 : 0) || b.ultimo - a.ultimo);
}

// Números grandes de la caja. `cobrado*` va neto de gastos; `bruto` es solo lo que entró.
export function totalesCaja({ ventas = [], cuentas = [], pagos = [], gastos = [], efectivoInicial = 0 } = {}) {
  const contado = (ventas || []).filter((v) => !v.cuentaId);
  const ventasEfectivo = sumar(contado.filter((v) => v.medio === EFECTIVO));
  const ventasTransferencia = sumar(contado.filter((v) => v.medio === TRANSFERENCIA));
  const ventasExtranjeras = sumar(contado.filter((v) => v.medio !== EFECTIVO && v.medio !== TRANSFERENCIA));

  const pagosEfectivo = sumar(pagos.filter((p) => p.medio === EFECTIVO), (p) => p.monto);
  const pagosTransferencia = sumar(pagos.filter((p) => p.medio === TRANSFERENCIA), (p) => p.monto);
  const gastosEfectivo = sumar(gastos.filter((g) => g.medio === EFECTIVO), (g) => g.monto);
  const gastosTransferencia = sumar(gastos.filter((g) => g.medio === TRANSFERENCIA), (g) => g.monto);

  const alDebe = sumar(ventas.filter(esAlDebe));
  const saldos = cuentasConSaldo(cuentas, ventas, pagos);
  const porCobrar = saldos.filter((c) => c.saldo > 0).reduce((a, c) => a + c.saldo, 0);
  const pagadoDeMas = saldos.filter((c) => c.saldo < 0).reduce((a, c) => a - c.saldo, 0);

  const efectivo = ventasEfectivo + pagosEfectivo - gastosEfectivo;
  const transferencia = ventasTransferencia + pagosTransferencia - gastosTransferencia;
  const gastosTotal = gastosEfectivo + gastosTransferencia;
  const bruto = ventasEfectivo + ventasTransferencia + ventasExtranjeras + pagosEfectivo + pagosTransferencia;
  const cobrado = bruto - gastosTotal;
  const inicial = Math.round(Number(efectivoInicial) || 0);

  return {
    ventasEfectivo, ventasTransferencia, ventasExtranjeras,
    pagosEfectivo, pagosTransferencia,
    gastosEfectivo, gastosTransferencia, gastosTotal,
    alDebe, porCobrar, pagadoDeMas,
    bruto, cobrado,
    efectivo, transferencia,
    efectivoInicial: inicial,
    esperadoEfectivo: inicial + efectivo,
    cuentas: saldos,
    totalEvento: cobrado + porCobrar,
  };
}

// Arqueo: lo que debería haber en la caja de efectivo vs lo que se contó.
export function arqueo({ esperadoEfectivo = 0, contado = null } = {}) {
  const esperado = Math.round(Number(esperadoEfectivo) || 0);
  if (contado === null || contado === undefined || contado === "") {
    return { esperado, contado: null, diferencia: null };
  }
  const c = Math.round(Number(contado) || 0);
  return { esperado, contado: c, diferencia: c - esperado };
}

// Desglose por producto (lo vendido, distinguiendo lo que quedó al debe).
export function porProducto(ventas) {
  const mapa = new Map();
  for (const v of ventas || []) {
    const clave = v.productoId || `nombre:${v.nombre}`;
    const fila = mapa.get(clave) || { clave, nombre: v.nombre, tipo: v.tipo || "producto", cantidad: 0, total: 0, alDebe: 0 };
    fila.cantidad += Number(v.cantidad) || 0;
    fila.total += totalLinea(v);
    if (esAlDebe(v)) fila.alDebe += totalLinea(v);
    mapa.set(clave, fila);
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total || String(a.nombre).localeCompare(String(b.nombre), "es"));
}

// Desglose por vendedor: sirve para cuadrar la plata de cada voluntario por separado.
export function porVendedor({ ventas = [], pagos = [], gastos = [] } = {}) {
  const mapa = new Map();
  const fila = (nombre) => {
    const k = String(nombre || "Sin nombre").trim() || "Sin nombre";
    if (!mapa.has(k)) mapa.set(k, { vendedor: k, vendido: 0, cobrado: 0, alDebe: 0, pagos: 0, gastos: 0, efectivo: 0, transferencia: 0, lineas: 0 });
    return mapa.get(k);
  };
  for (const v of ventas || []) {
    const f = fila(v.vendedor);
    f.lineas += 1;
    f.vendido += totalLinea(v);
    if (esAlDebe(v)) { f.alDebe += totalLinea(v); }
    else {
      f.cobrado += totalLinea(v);
      if (v.medio === TRANSFERENCIA) f.transferencia += totalLinea(v);
      else f.efectivo += totalLinea(v);
    }
  }
  for (const p of pagos || []) {
    const f = fila(p.vendedor);
    f.pagos += Math.round(Number(p.monto) || 0);
    if (p.medio === TRANSFERENCIA) f.transferencia += Math.round(Number(p.monto) || 0);
    else f.efectivo += Math.round(Number(p.monto) || 0);
  }
  for (const g of gastos || []) {
    const f = fila(g.vendedor);
    f.gastos += Math.round(Number(g.monto) || 0);
    if (g.medio === TRANSFERENCIA) f.transferencia -= Math.round(Number(g.monto) || 0);
    else f.efectivo -= Math.round(Number(g.monto) || 0);
  }
  for (const f of mapa.values()) f.total = f.cobrado + f.pagos - f.gastos;
  return [...mapa.values()].sort((a, b) => b.total - a.total);
}

// Los cartones que se cobraron desde la caja (tipo "carton"): van aparte del total
// de la pestaña Cartones, que cuenta cartones entregados.
export function cartonesEnCaja(ventas) {
  const lineas = (ventas || []).filter((v) => v.tipo === "carton");
  return { cantidad: sumar(lineas, (v) => v.cantidad), total: sumar(lineas), cobrado: sumar(lineas.filter((v) => !v.cuentaId)), alDebe: sumar(lineas.filter(esAlDebe)) };
}

// Texto de una jornada para los encabezados del historial: "2026-10-14" → "mié 14 de octubre".
export function textoDia(dia) {
  const [y, m, d] = String(dia || "").split("-").map(Number);
  if (!y || !m || !d) return String(dia || "");
  return new Date(y, m - 1, d).toLocaleDateString("es-CL", { weekday:"short", day:"2-digit", month:"long" });
}

// Estado del flujo de venta: en qué paso va quien vende y si ya puede cobrar.
//   1 → todavía no eligió nada ("toca lo que se lleva")
//   2 → eligió cosas, pero falta decidir cómo paga (o a nombre de quién queda al debe)
//   3 → puede cobrar / anotar al debe
// Sirve para que la pantalla muestre siempre el paso en curso y no haya que adivinar
// que primero van los productos y después el cobro.
export function estadoVenta({ lineas = [], medio = EFECTIVO, cuentaId = null, cuentaNombre = "" } = {}) {
  const total = sumar(lineas, (l) => (Number(l.cantidad) || 0) * (Number(l.precioUnitario) || 0));
  if (!lineas.length) return { paso:1, total:0, puedeCobrar:false, texto:"Toca lo que se lleva el cliente" };
  if (total <= 0) return { paso:3, total, puedeCobrar:false, texto:"El total está en $0: revisa el precio del producto" };
  if (medio === "debe" && !cuentaId && !String(cuentaNombre || "").trim()) {
    return { paso:2, total, puedeCobrar:false, texto:"Escribe a nombre de quién queda la deuda" };
  }
  return { paso:3, total, puedeCobrar:true, texto:"" };
}

// Historial agrupado por jornada: entradas (ventas cobradas y pagos), salidas (gastos) y
// lo que quedó al debe ese día. Sirve para leer el detalle de corrido, día por día.
// Cada fila trae `tipoMov` = "venta" | "pago" | "gasto" (así el campo `tipo` de una venta
// puede seguir diciendo si era un producto o un cartón).
export function agruparPorDia(filas = []) {
  const mapa = new Map();
  for (const f of filas) {
    const dia = f.dia || diaLocal(f.ts);
    if (!mapa.has(dia)) mapa.set(dia, { dia, filas:[], entradas:0, salidas:0, alDebe:0 });
    const grupo = mapa.get(dia);
    grupo.filas.push(f);
    const monto = Math.round(Number(f.total !== undefined && f.total !== null ? f.total : f.monto) || 0);
    if (f.tipoMov === "gasto") grupo.salidas += monto;
    else if (f.tipoMov === "venta" && f.cuentaId) grupo.alDebe += monto;
    else grupo.entradas += monto;
  }
  return [...mapa.values()]
    .map((g) => ({ ...g, filas: g.filas.sort((a, b) => (b.ts || 0) - (a.ts || 0)) }))
    .sort((a, b) => (a.dia < b.dia ? 1 : -1));
}

// Resumen en texto plano para copiar y pegar (WhatsApp).
export function resumenTexto(datos, { titulo = "BINGO SOLIDARIO — CAJA", cartonesEntregados = null } = {}) {
  const t = totalesCaja(datos);
  const L = [];
  const linea = (a, b) => L.push(`${a}`.padEnd(24, " ") + b);

  L.push(`*${titulo}*`);
  L.push(fechaTexto(Date.now()));
  L.push("");

  const productos = porProducto(datos.ventas);
  if (productos.length) {
    L.push("*VENDIDO*");
    for (const p of productos) linea(`${p.nombre} ×${p.cantidad}`, fmt(p.total));
    L.push("");
  }

  L.push("*PLATA*");
  linea("💵 Efectivo", fmt(t.efectivo));
  linea("🏦 Transferencias", fmt(t.transferencia));
  if (t.gastosTotal) linea("➖ Gastos", fmt(t.gastosTotal));
  linea("✅ Neto en caja", fmt(t.cobrado));
  L.push("");
  linea("📝 Por cobrar (al debe)", fmt(t.porCobrar));
  if (t.pagadoDeMas) linea("⚠️ Pagado de más", fmt(t.pagadoDeMas));

  const abiertas = t.cuentas.filter((c) => c.saldo > 0);
  if (abiertas.length) {
    L.push("");
    L.push("*CUENTAS POR COBRAR*");
    for (const c of abiertas) linea(`- ${c.nombre}`, fmt(c.saldo));
  }

  const caja = arqueo({ esperadoEfectivo: t.esperadoEfectivo, contado: datos.contado });
  L.push("");
  L.push("*CAJA DE EFECTIVO*");
  linea("Inicial (cambio)", fmt(t.efectivoInicial));
  linea("Esperado", fmt(caja.esperado));
  if (caja.contado !== null) {
    linea("Contado", fmt(caja.contado));
    linea("Diferencia", fmtSigno(caja.diferencia));
  }

  const vendedores = porVendedor(datos);
  if (vendedores.length > 1) {
    L.push("");
    L.push("*POR VENDEDOR*");
    for (const v of vendedores) linea(`${v.vendedor} (efvo ${fmt(v.efectivo)})`, fmt(v.total));
  }

  if (cartonesEntregados !== null) {
    L.push("");
    linea("Cartones entregados (aparte)", fmt(cartonesEntregados));
  }

  return L.join("\n");
}
