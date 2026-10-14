// Tests de la caja del evento. Lo importante que se prueba acá:
//   1. Que el efectivo y la transferencia se sumen separados (para cuadrar la caja).
//   2. Que una venta "al debe" NO cuente como plata cobrada hasta que llegue el pago,
//      y que un solo pago pueda saldar una cuenta con hartas cosas (incluidos cartones).
//   3. Que el arqueo (esperado vs contado) dé la diferencia correcta y que el monto
//      inicial de cambio no se pierda.
//   4. Que los gastos bajen el efectivo esperado y no el "por cobrar".
//
// Se ejecutan con:  npm test
import test from "node:test";
import assert from "node:assert/strict";
import {
  EFECTIVO, TRANSFERENCIA, fmt, fmtSigno, diaLocal, esAlDebe, saldoCuenta, cuentasConSaldo,
  totalesCaja, arqueo, porProducto, porVendedor, cartonesEnCaja, resumenTexto,
  estadoVenta, agruparPorDia, textoDia,
} from "../src/caja.js";

const BEBIDA = { id: "p1", nombre: "Bebida", precio: 1500 };
const COMPLETO = { id: "p2", nombre: "Completo", precio: 3000 };

let n = 0;
const venta = (prod, cantidad, medio, extra = {}) => {
  const precioUnitario = prod.precio;
  return {
    id: `v${++n}`, ts: 1000 + n, dia: diaLocal(1000 + n),
    nombre: prod.nombre, productoId: prod.id, tipo: extra.tipo || "producto",
    cantidad, precioUnitario, total: cantidad * precioUnitario,
    medio: extra.cuentaId ? null : medio, cuentaId: extra.cuentaId || null,
    vendedor: extra.vendedor || "Patricio",
  };
};
const pago = (cuentaId, monto, medio, vendedor = "Patricio") =>
  ({ id: `g${++n}`, cuentaId, monto, medio, ts: 2000 + n, vendedor });
const gasto = (concepto, monto, medio, vendedor = "Patricio") =>
  ({ id: `s${++n}`, concepto, monto, medio, ts: 3000 + n, vendedor });

test("fmt y diaLocal formatean como se muestra en pantalla", () => {
  assert.equal(fmt(1500), "$1.500");
  assert.equal(fmt(1234567), "$1.234.567");
  assert.equal(fmt(""), "$0");
  const ts = new Date(2026, 9, 14, 23, 30).getTime();  // 14 de octubre 2026, 23:30 local
  assert.equal(diaLocal(ts), "2026-10-14");
});

test("ventas al contado: efectivo y transferencia se suman por separado", () => {
  const ventas = [
    venta(BEBIDA, 2, EFECTIVO),          // 3.000 efectivo
    venta(COMPLETO, 1, TRANSFERENCIA),   // 3.000 transferencia
    venta(BEBIDA, 1, EFECTIVO),          // 1.500 efectivo
  ];
  const t = totalesCaja({ ventas, efectivoInicial: 20000 });

  assert.equal(t.ventasEfectivo, 4500);
  assert.equal(t.ventasTransferencia, 3000);
  assert.equal(t.cobrado, 7500);
  assert.equal(t.porCobrar, 0);
  assert.equal(t.esperadoEfectivo, 24500, "el inicial de cambio queda dentro de la caja");
});

test("al debe: no cuenta como cobrado hasta que llega el pago; un pago salda varias cosas", () => {
  // Un grupo pide 4 bebidas y 3 cartones (a $1.000) y paga todo después con UNA transferencia.
  const cuenta = { id: "c1", nombre: "Mesa 4", ts: 900, vendedor: "Ana" };
  const ventas = [
    venta(BEBIDA, 4, null, { cuentaId: "c1", vendedor: "Ana" }),
    venta({ id: "carton", nombre: "Cartón", precio: 1000 }, 3, null, { cuentaId: "c1", tipo: "carton", vendedor: "Ana" }),
  ];
  const antes = totalesCaja({ ventas, cuentas: [cuenta] });
  assert.equal(antes.cobrado, 0, "nada de eso es plata cobrada todavía");
  assert.equal(antes.porCobrar, 9000, "4×1.500 + 3×1.000 quedan al debe");
  assert.equal(antes.esperadoEfectivo, 0);

  const pagos = [pago("c1", 9000, TRANSFERENCIA, "Ana")];
  const despues = totalesCaja({ ventas, cuentas: [cuenta], pagos });
  assert.equal(despues.porCobrar, 0, "la cuenta queda saldada");
  assert.equal(despues.transferencia, 9000);
  assert.equal(despues.efectivo, 0);
  assert.equal(despues.cobrado, 9000);
  assert.equal(saldoCuenta(cuenta, ventas, pagos).saldo, 0);
});

test("pago parcial: queda saldo a favor del bingo y se marca pagado de más cuando se pasa", () => {
  const cuenta = { id: "c1", nombre: "Juan", ts: 900 };
  const ventas = [venta(COMPLETO, 2, null, { cuentaId: "c1" })];   // 6.000 al debe
  const parcial = totalesCaja({ ventas, cuentas: [cuenta], pagos: [pago("c1", 2000, EFECTIVO)] });
  assert.equal(parcial.porCobrar, 4000, "lo que falta por cobrar");
  assert.equal(parcial.efectivo, 2000, "lo que ya entró a la caja");

  const deMas = totalesCaja({ ventas, cuentas: [cuenta], pagos: [pago("c1", 7000, EFECTIVO)] });
  assert.equal(deMas.porCobrar, 0);
  assert.equal(deMas.pagadoDeMas, 1000, "pagó 1.000 de más y hay que devolverlos");
});

test("cuentasConSaldo deja las abiertas primero y calcula el último movimiento", () => {
  const cuentas = [
    { id: "c1", nombre: "Mesa 1", ts: 1 },
    { id: "c2", nombre: "Mesa 2", ts: 2 },
    { id: "c3", nombre: "Sin uso", ts: 3 },
  ];
  const ventas = [venta(BEBIDA, 1, null, { cuentaId: "c1" }), venta(BEBIDA, 2, null, { cuentaId: "c2" })];
  const pagos = [pago("c2", 3000, EFECTIVO)];
  const filas = cuentasConSaldo(cuentas, ventas, pagos);

  assert.equal(filas[0].nombre, "Mesa 1");
  assert.equal(filas[0].abierta, true);
  assert.equal(filas.find((f) => f.id === "c2").abierta, false, "Mesa 2 quedó pagada y se va al final");
  assert.equal(filas.find((f) => f.id === "c3").cantidadLineas, 0, "una cuenta sin líneas se ve vacía, no rota");
});

test("gastos: bajan el efectivo esperado y no tocan el por cobrar", () => {
  const ventas = [venta(BEBIDA, 2, EFECTIVO), venta(COMPLETO, 1, null, { cuentaId: "c1" })];
  const cuentas = [{ id: "c1", nombre: "Ana", ts: 1 }];
  const gastos = [gasto("Hielo", 2000, EFECTIVO)];
  const t = totalesCaja({ ventas, cuentas, gastos, efectivoInicial: 10000 });

  assert.equal(t.gastosTotal, 2000);
  assert.equal(t.efectivo, 3000 - 2000, "el gasto en efectivo sale de la caja");
  assert.equal(t.cobrado, 1000);
  assert.equal(t.esperadoEfectivo, 11000);
  assert.equal(t.porCobrar, 3000, "los gastos no cambian lo que falta por cobrar");
  assert.equal(t.alDebe, 3000);
  assert.equal(t.totalEvento, 4000, "cobrado + por cobrar");
});

test("gasto pagado por transferencia: sale de las transferencias, no del efectivo", () => {
  const ventas = [venta(COMPLETO, 1, TRANSFERENCIA), venta(BEBIDA, 2, EFECTIVO)];
  const t = totalesCaja({ ventas, gastos: [gasto("Insumos", 3000, TRANSFERENCIA)], efectivoInicial: 5000 });
  assert.equal(t.efectivo, 3000);
  assert.equal(t.transferencia, 0);
  assert.equal(t.esperadoEfectivo, 8000);
});

test("arqueo: diferencia con el monto contado, y sin contar no inventa diferencias", () => {
  assert.equal(fmtSigno(-3000), "−$3.000", "una diferencia negativa se lee como falta, no como $-3.000");
  assert.equal(fmtSigno(3000), "+$3.000");
  assert.equal(fmtSigno(0), "$0");
  assert.deepEqual(arqueo({ esperadoEfectivo: 50000, contado: 49000 }), { esperado: 50000, contado: 49000, diferencia: -1000 });
  assert.deepEqual(arqueo({ esperadoEfectivo: 50000, contado: 51000 }), { esperado: 50000, contado: 51000, diferencia: 1000 });
  assert.deepEqual(arqueo({ esperadoEfectivo: 50000, contado: "" }), { esperado: 50000, contado: null, diferencia: null });
  assert.deepEqual(arqueo({ esperadoEfectivo: 50000 }), { esperado: 50000, contado: null, diferencia: null });
});

test("porProducto agrupa por producto y marca lo que está al debe", () => {
  const ventas = [
    venta(BEBIDA, 2, EFECTIVO),
    venta(BEBIDA, 1, TRANSFERENCIA),
    venta(BEBIDA, 4, null, { cuentaId: "c1" }),
    venta(COMPLETO, 1, EFECTIVO),
  ];
  const filas = porProducto(ventas);
  assert.deepEqual(filas.map((f) => f.nombre), ["Bebida", "Completo"]);
  assert.equal(filas[0].cantidad, 7);
  assert.equal(filas[0].total, 10500);
  assert.equal(filas[0].alDebe, 6000);
  assert.equal(filas[1].total, 3000);
});

test("cartonesEnCaja separa los cartones que se cobraron desde la caja", () => {
  const ventas = [
    venta({ id: "carton", nombre: "Cartón", precio: 1000 }, 3, EFECTIVO, { tipo: "carton" }),
    venta({ id: "carton", nombre: "Cartón", precio: 1000 }, 2, null, { tipo: "carton", cuentaId: "c1" }),
    venta(BEBIDA, 1, EFECTIVO),
  ];
  const c = cartonesEnCaja(ventas);
  assert.equal(c.cantidad, 5);
  assert.equal(c.total, 5000);
  assert.equal(c.cobrado, 3000);
  assert.equal(c.alDebe, 2000);
});

test("porVendedor cuadra la plata de cada voluntario por separado", () => {
  const ventas = [
    venta(BEBIDA, 2, EFECTIVO, { vendedor: "Ana" }),
    venta(COMPLETO, 2, null, { cuentaId: "c1", vendedor: "Ana" }),
    venta(BEBIDA, 1, TRANSFERENCIA, { vendedor: "Beto" }),
  ];
  const filas = porVendedor({ ventas, gastos: [gasto("Hielo", 1000, EFECTIVO, "Ana")] });
  const ana = filas.find((f) => f.vendedor === "Ana");
  const beto = filas.find((f) => f.vendedor === "Beto");

  assert.equal(ana.efectivo, 3000 - 1000);
  assert.equal(ana.alDebe, 6000);
  assert.equal(ana.total, 2000, "su venta al contado menos el gasto que pagó");
  assert.equal(beto.transferencia, 1500);
  assert.equal(beto.total, 1500);
});

test("el resumen de texto trae los números que se van a copiar", () => {
  const cuenta = { id: "c1", nombre: "Mesa 4", ts: 1 };
  const datos = {
    ventas: [
      venta(BEBIDA, 2, EFECTIVO),
      venta({ id: "carton", nombre: "Cartón", precio: 1000 }, 3, null, { tipo: "carton", cuentaId: "c1" }),
    ],
    cuentas: [cuenta],
    gastos: [gasto("Hielo", 1000, EFECTIVO)],
    efectivoInicial: 20000,
  };
  const txt = resumenTexto(datos, { cartonesEntregados: 3000 });

  assert.match(txt, /BINGO SOLIDARIO — CAJA/);
  assert.match(txt, /Bebida ×2/);
  assert.match(txt, /Efectivo/);
  assert.match(txt, /\$2\.000/, "2 bebidas a 1.500 = 3.000, menos 1.000 de hielo = 2.000 netos");
  assert.match(txt, /Por cobrar/);
  assert.match(txt, /\$3\.000/, "la cuenta de la mesa 4 sigue al debe");
  assert.match(txt, /Mesa 4/);
  assert.match(txt, /Inicial \(cambio\)/);
  assert.match(txt, /Cartones entregados/);
});

test("estadoVenta: guía el orden de la venta (elegir → cómo paga → cobrar)", () => {
  const bebida = { productoId: "p1", nombre: "Bebida", precioUnitario: 1500, cantidad: 2, tipo: "producto" };

  const vacio = estadoVenta({ lineas: [] });
  assert.equal(vacio.paso, 1, "sin productos todavía no hay nada que cobrar");
  assert.equal(vacio.puedeCobrar, false);
  assert.match(vacio.texto, /Toca lo que se lleva/);

  const conCosas = estadoVenta({ lineas: [bebida] });
  assert.equal(conCosas.paso, 3);
  assert.equal(conCosas.total, 3000);
  assert.equal(conCosas.puedeCobrar, true);

  const alDebeSinNombre = estadoVenta({ lineas: [bebida], medio: "debe" });
  assert.equal(alDebeSinNombre.paso, 2, "al debe sin nombre no deja cobrar: falta el paso 2");
  assert.equal(alDebeSinNombre.puedeCobrar, false);
  assert.match(alDebeSinNombre.texto, /nombre/i);

  assert.equal(estadoVenta({ lineas: [bebida], medio: "debe", cuentaNombre: "Mesa 4" }).puedeCobrar, true);
  assert.equal(estadoVenta({ lineas: [bebida], medio: "debe", cuentaId: "c1" }).puedeCobrar, true);

  const gratis = estadoVenta({ lineas: [{ ...bebida, precioUnitario: 0 }] });
  assert.equal(gratis.puedeCobrar, false, "un total en $0 no se cobra");
  assert.match(gratis.texto, /\$0/);
});

test("agruparPorDia: separa las jornadas y suma entradas, salidas y al debe", () => {
  const ahora = Date.now();
  const hoy = diaLocal(ahora);
  const ayer = diaLocal(ahora - 86400000);
  const filas = [
    { tipoMov: "venta", id: "v1", ts: ahora, total: 3000, medio: EFECTIVO },
    { tipoMov: "venta", id: "v2", ts: ahora, total: 6000, cuentaId: "c1" },
    { tipoMov: "pago", id: "g1", ts: ahora, monto: 2000, cuentaId: "c1" },
    { tipoMov: "gasto", id: "s1", ts: ahora, monto: 1000, concepto: "Hielo" },
    { tipoMov: "venta", id: "v3", ts: ahora - 86400000, dia: ayer, total: 1500 },
  ];
  const grupos = agruparPorDia(filas);

  assert.equal(grupos.length, 2);
  assert.equal(grupos[0].dia, hoy, "la jornada más reciente va primero");
  assert.equal(grupos[0].entradas, 5000, "la venta al contado y el pago entran");
  assert.equal(grupos[0].salidas, 1000, "el gasto sale");
  assert.equal(grupos[0].alDebe, 6000, "lo que quedó al debe ese día");
  assert.equal(grupos[0].filas.length, 4);
  assert.equal(grupos[0].filas[0].ts >= grupos[0].filas[3].ts, true, "las filas van de la más nueva a la más vieja");
  assert.equal(grupos[1].dia, ayer);
  assert.equal(grupos[1].entradas, 1500);
  assert.equal(grupos[1].alDebe, 0);
});

test("textoDia arma el encabezado de la jornada", () => {
  const txt = textoDia("2026-10-14");
  assert.match(txt, /14/);
  assert.match(txt, /octubre/i);
  assert.equal(textoDia(""), "", "sin día no inventa texto");
});

test("esAlDebe distingue una venta al contado de una anotada en una cuenta", () => {
  assert.equal(esAlDebe(venta(BEBIDA, 1, EFECTIVO)), false);
  assert.equal(esAlDebe(venta(BEBIDA, 1, null, { cuentaId: "c1" })), true);
  assert.equal(esAlDebe(null), false);
});
