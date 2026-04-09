# Contexto del Proyecto: Bingo Solidario - Cristian Hidalgo

## 1. Resumen General
Aplicación web 100% funcional construida con **React** (Vite) y **Firebase Realtime Database**. 
Funciona como un motor completo para jugar un Bingo clásico con cartones generados automáticamente (del 1 al 75), soportando múltiples juegos (8 en total). 
Desplegado y asociado a **Vercel** para producción.

## 2. Estructura de Archivos (`src/`)
*   **`main.jsx`**: Punto de entrada. Renderiza directamente el componente `<BingoAdmin />`.
*   **`firebase.js`**: Configuración centralizada. Exporta `db` (conexión a RTDB) y `PIN` (autenticación admin).
*   **`bingo-admin.jsx`**: Componente principal y **único** de la aplicación. Contiene todo el sistema de autenticación, generación de cartones, sorteo y registro de ganadores.

## 3. Flujo de la Aplicación

El sistema se divide en 4 pestañas principales. Al abrir la app, carga por defecto la pestaña **"Sorteo"**. El usuario ingresa como "Visualización" y debe pulsar "🔐 Admin" para hacer cambios.

### Pestaña 1: 🎟️ Cartones
*   **Selector de Juegos:** 8 juegos predefinidos (`Juego 1` al `Juego 8`), cada uno con un color único (Rojo, Azul, Verde, Amarillo, Morado, Rosa, Teal, Naranja).
*   **Paso 1 - Generar pool:** El admin ingresa una cantidad (ej: 50) y genera cartones en blanco para el juego activo. Los N° de cartón son correlativos y auto-formateados a 3 dígitos (001, 002...).
*   **Paso 2 - Asignar:** Formulario simplificado que pide "Nombre completo" y "Cant." (cantidad de cartones a asignar a esa persona). Asigna los primeros cartones disponibles del juego seleccionado.
*   **Mantenimiento:** 
    *   Botón "🗑️ Borrar disponibles" para limpiar los cartones sin vender de un juego específico.
    *   Botón "✕" para eliminar un cartón individual.
*   **🖨️ Imprimir Cartones:** Abre una nueva ventana con un layout de impresión optimizado (2 cartones por página, fuentes Stencil/Varsity, franja de color del juego, pie de página institucional). La celda FREE muestra una imagen `/QR.png`.
*   **Vista de Lista:** Muestra `CARTÓN | ASISTENTE | JUEGO | ESTADO`. Al hacer clic en un cartón, se despliega su grilla B-I-N-G-O mostrando los números que ya han salido en el sorteo (pintados del color del juego).
*   **Buscador:** Filtra la lista por N° de cartón o nombre del asistente.

### Pestaña 2: 📋 Asistentes
*   **Resumen financiero:** Cards superiores mostrando total de vendidos y dinero recaudado (Precio base: $1.000).
*   **Listado:** Detalla a cada asistente con su posición, nombre, N° de cartón, un indicador de color según el juego, y su estado de pago ("✓ $1.000").

### Pestaña 3: 🎱 Sorteo (Abre por defecto)

#### Layout PC (3 columnas)
El tab de sorteo está **fuera del contenedor limitado de 760px**, ocupa el ancho completo de la pantalla con `minHeight: calc(100vh - 50px)` y `display: flex; alignItems: center` para centrado vertical.

Grid principal: `gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)'`

- **COL 1 (izquierda):** 
  - Card con nombre del juego activo + patrón activo (grilla 5x5 visual) + selector de patrón + botones de juego (solo admin).
  - Card de imagen debajo (`/imagen.jpg`) que ocupa el espacio restante con `flex: 1` y `minHeight: 520`.
- **COL 2 (centro):** Tablero de 75 bolillas en formato circular, fuente `Poller One`, encabezados B-I-N-G-O en sus colores clásicos.
- **COL 3 (derecha):** Card con el último número sorteado en grande + botones Deshacer/Reiniciar (solo admin).

Todas las cards usan fondo con efecto **degradado tipo agua** (`linear-gradient(180deg, rgba(255,255,255,0.95) → rgba(255,255,255,0))`). El fondo general de la página es un **degradado oscuro** (`linear-gradient(135deg, #0f172a, #1e3a5f, #0f172a)`).

#### Layout Móvil (responsive ≤768px)
Controlado por clases CSS en `index.html`:
- `.sorteo-top-row`: en PC usa `display: contents` (invisible para el grid). En móvil cambia a `display: flex; flex-direction: row` mostrando COL1 y COL3 lado a lado (50/50) en la fila superior.
- `.sorteo-col2` (tablero): ocupa el ancho completo debajo, centrado, con `overflow-x: auto`.
- `.sorteo-imagen` (card de imagen): se oculta en móvil con `display: none`.

#### Bolillas del tablero
- **No sorteadas:** fondo `rgba(255,255,255,0.15)`, texto `rgba(255,255,255,0.4)`, borde sutil.
- **Sorteadas:** fondo sólido del color del juego, texto blanco, glow `0 0 8px color80`.
- **Última sorteada:** animación `bingoFlash` (pulse + glow intenso), borde blanco 3px.

#### Animación bingoFlash
Definida en `index.html` dentro de `<style>`:
```css
@keyframes bingoFlash {
  0%   { transform: scale(1.1); box-shadow: 0 0 10px 4px rgba(239,68,68,0.6); }
  50%  { transform: scale(1.22); box-shadow: 0 0 30px 10px rgba(239,68,68,0.9); }
  100% { transform: scale(1.1); box-shadow: 0 0 10px 4px rgba(239,68,68,0.6); }
}
```

*   **Voz en Español:** Al marcar una bolilla, una locutora automática dice la letra y el número (ej: "O, 62"). Web Speech API, `lang: es-ES`, `rate: 0.9`.
*   **Botón Bocina (🔊/🔇):** Silencia o activa la voz desde el header.
*   **Deshacer / Reiniciar:** Con confirmación de 2 pasos para reiniciar.
*   **Modo Solo Lectura:** Si no es admin, bloquea el clic en las bolillas.

### Pestaña 4: 🏆 Ganadores
*   **Formulario:** Registra ganador con "Nombre" y "N° cartón".
*   **Listado:** Muestra ganadores con emoji trofeo, nombre, cartón y hora exacta.
*   **Acción Admin:** Botón "✕" para eliminar un ganador.

## 4. Fuentes
- **Poller One** (Google Fonts): usada en encabezados B-I-N-G-O y números del tablero.
- Cargada en `index.html`: `https://fonts.googleapis.com/css2?family=Poller+One&display=swap`

## 5. Estructura de la Base de Datos (Firebase RTDB)
*   **`bingo_cards`**: `{ id, cardNum, gameId, gameName, boleto: null, owner, paid, grid }`
*   **`bingo_drawn`**: Array de bolillas sorteadas (1 al 75).
*   **`bingo_winners`**: `{ name, card, time, ts }`

## 6. Archivos Estáticos (`public/`)
- `/QR.png`: imagen que aparece en la celda FREE al imprimir cartones.
- `/imagen.jpg`: imagen decorativa que aparece en la COL 1 del sorteo (PC).

## 7. Estado Actual (ESTABLE Y EN PRODUCCIÓN)
*   ✅ Arquitectura simplificada a un solo archivo de componentes (`bingo-admin.jsx`).
*   ✅ Login interno integrado.
*   ✅ Fondo oscuro con degradado en pestaña sorteo.
*   ✅ Cards con efecto degradado tipo agua (transparencia hacia abajo).
*   ✅ Tablero de bolillas circular con fuente Poller One.
*   ✅ Animación bingoFlash en el último número sorteado.
*   ✅ Layout responsive: 3 columnas en PC, COL1+COL3 arriba / tablero abajo en móvil.
*   ✅ Imagen decorativa en COL 1 (oculta en móvil).
*   ✅ Locutor automático funcional (Web Speech API).
*   ✅ Sistema de 8 juegos con colores independientes.
*   ✅ Sistema de impresión de cartones nativo.
*   ✅ Desplegado en Vercel (`vercel --prod`).

---
**PRÓXIMOS PASOS:**
*(Aquí anotaremos lo que hagamos a continuación)*

ver qr del carton que no carga, hay que subirla a git