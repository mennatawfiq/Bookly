import prisma from "../src/lib/prisma";
import { seedAdmin } from "./seed-admin";

seedAdmin().then(() => console.log("Admin is ready"))
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect());