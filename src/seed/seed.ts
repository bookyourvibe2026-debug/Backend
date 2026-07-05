import { env } from "../config/env";
import { connectDatabase, disconnectDatabase } from "../config/db";
import { logger } from "../config/logger";
import { AdminModel } from "../models/Admin.model";
import { hashPassword } from "../utils/password";

async function seed() {
  if (!env.SEED_ADMIN_EMAIL || !env.SEED_ADMIN_PASSWORD) {
    throw new Error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in your .env before running the seed script.");
  }

  await connectDatabase();

  const existing = await AdminModel.findOne({ email: env.SEED_ADMIN_EMAIL });
  if (existing) {
    logger.info(`Admin ${env.SEED_ADMIN_EMAIL} already exists — skipping.`);
  } else {
    const passwordHash = await hashPassword(env.SEED_ADMIN_PASSWORD);
    await AdminModel.create({
      name: "Super Admin",
      email: env.SEED_ADMIN_EMAIL,
      passwordHash,
      role: "super_admin",
    });
    logger.info(`Created super admin: ${env.SEED_ADMIN_EMAIL}`);
  }

  await disconnectDatabase();
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err }, "Seed failed");
    process.exit(1);
  });
