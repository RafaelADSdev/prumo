import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
let muted = false;
const output = new Writable({
  write(chunk, encoding, callback) {
    if (!muted) process.stdout.write(chunk);
    callback();
  },
});
const rl = createInterface({ input: process.stdin, output, terminal: true });
const email = (await rl.question("E-mail do administrador: ")).trim();
async function secret(prompt: string) {
  process.stdout.write(prompt);
  muted = true;
  try {
    return await rl.question("");
  } finally {
    muted = false;
    process.stdout.write("\n");
  }
}
const password = await secret(
  "Senha (mínimo 12 caracteres, digitação oculta): ",
);
const confirmation = await secret("Repita a senha: ");
rl.close();
if (
  !/^\S+@\S+\.\S+$/.test(email) ||
  password.length < 12 ||
  password !== confirmation
)
  throw Error("E-mail, senha ou confirmação inválidos");
const db = new PrismaClient();
try {
  if (await db.admin.count())
    throw Error("Administrador já configurado. Não há cadastro público.");
  await db.admin.create({
    data: { id: 1, email, hash: await hash(password, 12) },
  });
  console.log("Administrador criado. Execute npm run dev.");
} finally {
  await db.$disconnect();
}
