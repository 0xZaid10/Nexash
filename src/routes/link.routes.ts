import { Router } from "express";
import { z } from "zod";
import { validateBody } from "../middleware/validate";
import { consumeLinkToken, linkPrivyToUser } from "../db/users";
import { NotFoundError } from "../utils/result";

export const linkRouter = Router();

const LinkSchema = z.object({
  token: z.string().min(1),
  privyUserId: z.string().min(1),
  walletAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(),
});

linkRouter.post("/link", validateBody(LinkSchema), (req, res) => {
  const { token, privyUserId, walletAddress } = req.body;

  const user = consumeLinkToken(token);
  if (!user) {
    throw new NotFoundError("Link token is invalid or has expired. Use /link in the bot to get a new one.");
  }

  linkPrivyToUser(user.id, privyUserId, walletAddress);

  res.json({
    success: true,
    userId: user.id,
    telegramHandle: user.telegramHandle,
    walletAddress: walletAddress ?? null,
  });
});
