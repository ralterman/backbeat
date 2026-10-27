import { prisma } from "@/lib/prisma";

/**
 * The $5 one-time "Video Pass": unlocks a single video for a FREE user
 * without changing their plan. For that video only:
 *   - generation is full-length (the 60 s free cap does not apply),
 *   - two tracks instead of one (one regeneration round, so up to
 *     PASS_OPTION_CAP options including the original free track),
 *   - exports are full-length and watermark-free.
 * Bought from the results page via Stripe Checkout in payment mode
 * (/api/stripe/checkout?video=<id>); the webhook writes the VideoPass row.
 */
export { PASS_PRICE_CENTS, PASS_LABEL, PASS_OPTION_CAP } from "@/lib/videoPassShared";

export async function getVideoPass(videoId: string) {
  return prisma.videoPass.findUnique({ where: { videoId } });
}
