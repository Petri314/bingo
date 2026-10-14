# Bingo Solidario — Contexto del Proyecto

## ¿Qué es?
Aplicación web de Bingo Solidario para evento presencial.
- Admin controla el sorteo, vende cartones y registra ganadores
- Jugadores ven el estado en tiempo real desde sus dispositivos
- El evento es la próxima semana

## Stack
- React + Vite (frontend)
- Firebase Realtime Database (backend en tiempo real)
- Vercel (deploy y funciones serverless)

## URL de producción
https://bingo-app-final.vercel.app

## Estructura actual del proyecto
```
proyecto/
├── api/
│   └── login.js              ✅ Función serverless para login seguro
├── src/
│   ├── components/
│   │   ├── LoginModal.jsx    ✅ Separado
│   │   ├── ResetModal.jsx    ✅ Separado
│   │   ├── CardGrid.jsx      ✅ Separado (exporta CardGrid default + CardGridMemo named)
│   │   ├── GameModal.jsx     ✅ Separado
│   │   ├── PatternModal.jsx  ✅ Separado
│   │   ├── WinnerPopup.jsx   ✅ Separado
│   │   └── CajaPanel.jsx     💰 Pestaña de caja (ventas, cuentas al debe, gastos, cierre)
│   ├── constants/
│   │   └── index.js          ✅ Constantes globales separadas
│   ├── utils.js              ✅ Funciones helpers separadas (cartones y ganadores)
│   ├── caja.js               💰 Lógica pura de la caja (totales, arqueo, resumen)
│   ├── bingo-admin.jsx       ✅ Componente principal (refactor completo)
│   ├── firebase.js           ✅ Configuración Firebase
│   └── main.jsx              ✅ Entry point
├── tests/
│   ├── ganadores.test.js     ✅ Un ganador por juego y ronda
│   └── caja.test.js          💰 Caja: efectivo/transferencia, al debe, arqueo
├── public/
│   └── premios/              🖼️ Imágenes de premios por juego
├── .env.local                ✅ Variables de entorno locales (en .gitignore)
├── vite.config.js            ✅ Con proxy /api para desarrollo local
└── package.json
```

## Variables de entorno
| Variable     | Dónde          | Descripción                        |
|--------------|----------------|------------------------------------|
| ADMIN_PIN    | Vercel + .env.local | PIN de acceso admin (4915)    |
| JWT_SECRET   | Vercel + .env.local | Clave para firmar tokens JWT   |

## Mejoras completadas ✅

### 🔐 Seguridad
- PIN movido al servidor (antes estaba expuesto en el bundle del cliente)
- Login via función serverless `/api/login.js`
- Token JWT con expiración de 8 horas
- Sesión persiste al recargar página (useEffect que verifica token)
- Logout limpia el token de sessionStorage
- `.env.local` protegido con `.gitignore`
- Proxy en vite.config.js para que /api funcione en desarrollo local

### ⚡ Rendimiento
- `useMemo` en: filteredCards, filteredSold, visibleCards, totalRecaudado, jugadoresActuales
- `React.memo` en CardGrid — evita re-renderizar 200+ cartones innecesariamente

### 🧩 Estructura
- Constantes globales → `src/constants/index.js`
- Funciones helpers → `src/utils.js` (pad, getTextColor, getLetterForNum, generateCardGrid, checkPattern)
- LoginModal → `src/components/LoginModal.jsx`
- ResetModal → `src/components/ResetModal.jsx`
- CardGrid + CardGridMemo → `src/components/CardGrid.jsx`
- GameModal → `src/components/GameModal.jsx`
- PatternModal → `src/components/PatternModal.jsx`
- WinnerPopup → `src/components/WinnerPopup.jsx`
- `bingo-admin.jsx` queda como orquestador puro: solo estado, lógica y llamadas a Firebase

## Mejoras pendientes 🔄

### 🔐 Seguridad (post-evento)
- [ ] Firebase Security Rules — actualmente abiertas (.read y .write: true)
- [ ] Firebase Admin SDK para escrituras desde servidor
  - Requiere crear funciones serverless para cada acción de escritura:
    - /api/draw (marcar número)
    - /api/assign (asignar cartón)
    - /api/reset (reiniciar sorteo)
    - /api/winner (registrar ganador)

### 🐛 Bugs / lógica (pendiente revisar)
- [ ] Patrones solo verifican una orientación fija
  - Ej: línea horizontal solo gana en fila 1, no en cualquier fila
- [ ] Cartones: IDs generados con Date.now() + i*10 — posible colisión con múltiples admins
  simultáneos. La caja ya usa `push()` (clave generada por Firebase), que es lo correcto:
  conviene migrar la generación de cartones al mismo criterio.
- [ ] Los cartones se cuentan como recaudados al marcarlos vendidos (entregados), aunque se
  paguen después. La plata cobrada sí queda exacta en la pestaña Caja.

## Datos del juego
- 12 juegos con colores distintos (j1 al j12)
- 10 patrones: línea H/V, diagonal, esquinas, letras X/T/L/C, cruz, cartón lleno
- 75 números (B:1-15, I:16-30, N:31-45, G:46-60, O:61-75)
- Precio cartón: $1.000 CLP
- PIN admin: guardado en .env.local y Vercel (no hardcodeado)

## Notas importantes
- Firebase Rules están ABIERTAS intencionalmente hasta después del evento
- El countdown usa timestamp absoluto (countdownEndsAt) para sincronizar todos los clientes
- La detección de ganadores usa runTransaction para evitar condiciones de carrera
- Las imágenes de premios van en /public/premios/j1.png ... j12.png (y versión mobile)
- El panel tiene 5 pestañas: Cartones, Información, Sorteo, Ganadores y Caja (💰). La caja
  pide PIN de admin y el nombre del voluntario que vende (guardado en el celular).
- `import { PIN } from "./firebase.js"` fue eliminado de bingo-admin.jsx (PIN migró al servidor)

## Ganadores: un solo ganador por juego (corregido)

El evento de abril tuvo 2 a 4 ganadores por juego. Causa: el único freno era el flag
`alreadyWon` leído del estado de React, que llega atrasado mientras el admin canta números
seguidos; como varios cartones cumplen el mismo patrón casi al mismo tiempo, cada toque
anotaba uno más. Además, volver a elegir el mismo juego o patrón en el modal reseteaba ese
flag (y con la clave de ganador por cartón, los demás cartones entraban como nuevos).

Ahora funciona así:
- El ganador se anota con una **transacción sobre todo el nodo de ganadores**, que aborta
  si ya hay uno del mismo juego en la misma ronda (`src/utils.js` → `resolverRegistro`).
- La **ronda** se identifica con `bingo_state.roundId`, que solo cambia al pulsar Reiniciar:
  un juego tiene un ganador por ronda; para un ganador nuevo hay que Reiniciar (o borrar el
  ganador registrado, si fue un error de tipeo).
- `bingo_state.alreadyWon` se lee fresco desde Firebase dentro de `toggleNumber`.
- Re-elegir el juego o el patrón activo ya no reinicia al ganador ya registrado.
- Los registros de eventos anteriores (sin `roundId`) no bloquean el evento nuevo.
- El binguito usa la misma protección, por separado del bingo.

Tests: `npm test` (usa `node --test`, sin dependencias extra). `tests/ganadores.test.js`
reproduce el bug (con el criterio viejo se anotaban 4 ganadores) y verifica el arreglo.

## Caja del evento (bebida, comida y todo lo que entra)

Pestaña nueva **💰 Caja**. No hace falta saber de antemano qué se va a vender: el catálogo
(Productos) se arma la misma noche con nombre, precio y categoría.

### Cómo se usa durante el evento (todo en una sola pantalla)
1. Cada voluntario abre el panel en su celular con el PIN y escribe su nombre (queda en
   `localStorage.bingo_vendedor`): cada registro guarda quién lo hizo.
2. **Paso 1 · Toca lo que se lleva el cliente**: el catálogo está a la vista; cada toque
   suma al ticket y debajo se ve el detalle de lo elegido con el total. Hay un botón 🎟️
   Cartón al precio activo para los cartones que se cobran por la caja.
3. **Paso 2 · ¿Cómo paga?**: 💵 Efectivo, 🏦 Transferencia o 📝 Al debe con el nombre.
   Mientras no haya productos elegidos estos botones están bloqueados y el paso avisa
   “primero elige lo que se lleva”: así el orden de la venta se ve, no hay que adivinarlo.
4. **Paso 3 · Cobrar**: un botón grande que dice el monto y el medio (“Cobrar $3.000 en
   transferencia”, “Anotar $3.000 al debe de Mesa 4”).
5. **📝 Quién debe**: siempre a la vista, con cada cuenta **desplegada** (los ítems, la hora
   y quién los anotó, cuánto pagó y el saldo). Se cobra con un toque — “Ya pagó $X
   (efectivo)” — o con “Otro monto” para pagos parciales.
6. **📋 Historial**: todo de corrido, con hora, medio de pago y quién, agrupado por jornada
   con los subtotales de cada día (entró / salió / al debe). Cada fila trae ✎ para corregir
   (cantidad, precio, medio) y ✕ para borrar; el detalle se ve sin abrir nada.
7. Abajo, cuatro bloques plegables que muestran su resumen en el título: **Productos**
   (catálogo), **Gastos**, **Cierre de caja (arqueo)** y **Resumen para enviar**.
   - *Cierre*: efectivo inicial de cambio; efectivo esperado = inicial + ventas y pagos en
     efectivo − gastos en efectivo; efectivo contado y la diferencia (sobra/falta). El
     arqueo se puede guardar con fecha, quién lo hizo y el desglose completo, y hay una
     tabla por vendedor para cuadrar cada uno.
   - *Resumen*: desglose por producto más un texto listo para copiar y pegar en WhatsApp.

Criterio de diseño (porque la primera versión resultó confusa): el detalle de la venta, las
cuentas al debe y el historial van **siempre desplegados**; lo único que se pliega son los
bloques de administración, y aun así cada título muestra su dato clave (cuántos productos a
la venta, cuánto se gastó, cuánto efectivo se espera). El flujo de venta va numerado en
pantalla para que no haya que recordar el orden.

### Dónde queda cada dato (Firebase)
| Nodo | Contenido |
|---|---|
| `bingo_productos` | catálogo: nombre, precio, categoría, activo |
| `bingo_ventas` | una línea por ítem; `medio` efectivo/transferencia, o `cuentaId` si quedó al debe |
| `bingo_cuentas` | cuentas al debe (nombre de quien debe) |
| `bingo_pagos` | pagos que van saldando una cuenta |
| `bingo_gastos` | salidas de dinero |
| `bingo_cierres` | arqueos guardados (snapshot del momento) |
| `bingo_caja/efectivoInicial` | el cambio con que parte la caja |

Las claves se generan con `push()` (las crea Firebase), así dos voluntarios vendiendo a la
vez desde sus celulares no chocan entre sí.

### Ojo con los cartones (para no contar dos veces)
- La pestaña **Cartones** cuenta cartones **entregados** (devengado): controla qué cartón
  tiene cada persona.
- La pestaña **Caja** cuenta la **plata que entra**, incluidos los cartones que se cobran
  por la caja (botón 🎟️ Cartón).
- Por eso los dos totales no se suman: en la Caja los cartones entregados se muestran solo
  como referencia.

### Lógica pura y tests
- `src/caja.js`: totales (efectivo y transferencia separados), saldos de cuentas al debe,
  arqueo, desglose por producto y por vendedor, texto del resumen.
- `src/components/CajaPanel.jsx`: la interfaz de la pestaña.
- `tests/caja.test.js`: cubre, entre otros, el caso real del evento — 4 bebidas y 3 cartones
  al debe, pagados después con una sola transferencia —, el pago parcial, el que pagó de
  más, los gastos según su medio de pago, la diferencia del arqueo, y el flujo de la venta
  (`estadoVenta`) y el agrupado del historial por jornada (`agruparPorDia`).