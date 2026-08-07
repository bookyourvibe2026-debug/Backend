import { connectDatabase, disconnectDatabase } from "../config/db";
import { logger } from "../config/logger";
import { VendorModel } from "../models/Vendor.model";
import { hashPassword } from "../utils/password";

async function resetOwnerPassword() {
  await connectDatabase();
  const targetEmail = "owner@bookyourvibe.in";
  const newPassword = "Owner@12345";
  const passwordHash = await hashPassword(newPassword);

  const vendor = await VendorModel.findOne({ email: targetEmail });
  if (vendor) {
    vendor.passwordHash = passwordHash;
    await vendor.save();
    logger.info(`Successfully updated password for ${targetEmail} to: ${newPassword}`);
  } else {
    const created = await VendorModel.create({
      ownerName: "Test Owner",
      businessName: "Premium Sports Arena",
      email: targetEmail,
      phone: "9988776655",
      passwordHash,
      state: "Maharashtra",
      city: "Mumbai",
      status: "approved",
      approvedOn: new Date(),
      categories: ["Cricket", "Turf", "Football"],
      address: { street: "Andheri West", pinCode: "400053", country: "India" },
    });
    logger.info(`Created new owner account ${created.email} with password: ${newPassword}`);
  }

  await disconnectDatabase();
}

resetOwnerPassword()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err }, "Reset failed");
    process.exit(1);
  });
