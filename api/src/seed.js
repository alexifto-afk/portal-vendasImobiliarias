import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const db = new PrismaClient();
try {
  const {
    ADMIN_EMAIL: email,
    ADMIN_PASSWORD: password,
    ADMIN_NAME: name,
  } = process.env;
  if (!email || !name || !password || password.length < 12)
    throw new Error(
      "Configure ADMIN_EMAIL, ADMIN_NAME e ADMIN_PASSWORD com 12+ caracteres.",
    );
  if (await db.user.findUnique({ where: { email: email.toLowerCase() } }))
    throw new Error("Usuário existente; seed não altera credenciais.");
  await db.user.create({
    data: {
      email: email.toLowerCase(),
      name,
      passwordHash: await bcrypt.hash(password, 12),
      role: "ADMIN",
    },
  });
  console.log("Administrador criado.");
} finally {
  await db.$disconnect();
}
