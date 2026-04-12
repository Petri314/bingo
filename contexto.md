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
│   │   ── (pendientes)
│   ├── constants/
│   │   └── index.js          ✅ Constantes globales separadas
│   ├── utils.js              ✅ Funciones helpers separadas
│   ├── bingo-admin.jsx       🔄 Componente principal (en refactor)
│   ├── firebase.js           ✅ Configuración Firebase
│   └── main.jsx              ✅ Entry point
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

## Mejoras pendientes 🔄

### 🧩 Estructura (en curso)
Componentes que faltan separar de bingo-admin.jsx:
- [ ] GameModal → `src/components/GameModal.jsx`
- [ ] PatternModal → `src/components/PatternModal.jsx`
- [ ] WinnerPopup → `src/components/WinnerPopup.jsx`
- [ ] CardGrid → `src/components/CardGrid.jsx`

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
- [ ] IDs generados con Date.now() + i*10 — posible colisión con múltiples admins simultáneos

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