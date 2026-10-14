import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCsgirJRTX1-rRQPLX90700WFisHnpmmHs",
  authDomain: "bingo-fb3a9.firebaseapp.com",
  projectId: "bingo-fb3a9",
  storageBucket: "bingo-fb3a9.appspot.com",
  messagingSenderId: "728862630885",
  appId: "1:728862630885:web:6c69ace4c664e2c600850c",
  databaseURL: "https://bingo-fb3a9-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// El PIN del admin NO va aquí: se valida en el servidor (api/login.js) contra la
// variable de entorno ADMIN_PIN, y en Vercel se configura en Settings → Environment Variables.
export { db };
