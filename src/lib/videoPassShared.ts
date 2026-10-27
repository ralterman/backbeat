/**
 * Video Pass constants shared by server and client code. Kept free of any
 * server import (prisma, pg) so the results page can bundle them; the
 * database lookup lives in ./videoPass.ts.
 */

/** The $5 one-time price, for display. The charge itself is the Stripe price. */
export const PASS_PRICE_CENTS = 500;
export const PASS_LABEL = "Video Pass";
/** Original free track + the two full-length tracks the pass generates. */
export const PASS_OPTION_CAP = 3;
