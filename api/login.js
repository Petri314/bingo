import jwt from "jsonwebtoken";

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { pin } = req.body;

  if (!pin || pin !== process.env.ADMIN_PIN) {
    // Mismo mensaje para PIN vacío o incorrecto — no revelar cuál falló
    return res.status(401).json({ error: "PIN incorrecto" });
  }

  const token = jwt.sign(
    { role: "admin" },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );

  return res.status(200).json({ token });
}