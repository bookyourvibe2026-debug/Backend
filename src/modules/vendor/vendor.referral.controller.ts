import { Request, Response, NextFunction } from "express";
import { Referral } from "../../models/Referral.model";
import { sendSuccess } from "../../utils/ApiResponse";

export async function getVendorReferralCode(req: Request, res: Response, next: NextFunction) {
  try {
    const vendorId = (req as any).vendor._id;
    let referral = await Referral.findOne({ referrerId: vendorId, referrerType: "vendor" });

    if (!referral) {
      const code = "BYV-" + Math.random().toString(36).substring(2, 8).toUpperCase();
      referral = await Referral.create({
        referrerId: vendorId,
        referrerType: "vendor",
        code,
        rewardAmount: 250,
      });
    }

    const referralsList = await Referral.find({ referrerId: vendorId });
    const completedCount = referralsList.filter((r) => r.status === "completed").length;
    const totalEarned = completedCount * referral.rewardAmount;

    return sendSuccess(res, 200, {
      code: referral.code,
      rewardAmount: referral.rewardAmount,
      totalReferrals: referralsList.length,
      completedReferrals: completedCount,
      totalEarned,
      referralUrl: `https://bookyourvibe.in/vendor/login?ref=${referral.code}`,
    }, "Referral details retrieved successfully");
  } catch (error) {
    next(error);
  }
}
