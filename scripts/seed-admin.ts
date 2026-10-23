import "dotenv/config"
import bcrypt from "bcrypt";
import prisma from "../src/lib/prisma";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { name: "Admin", email, passwordHash, role: "ADMIN" }
  });
}

main().then(() => console.log("Admin is ready"))
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect());