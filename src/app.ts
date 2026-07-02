import express from "express";
import { healthRouter } from "./routes/health.routes";
import { attestationsRouter } from "./routes/attestations.routes";
import { paymentsRouter } from "./routes/payments.routes";
import { institutionsRouter } from "./routes/institutions.routes";
import { tradingRouter } from "./routes/trading.routes";
import { linkRouter } from "./routes/link.routes";
import { usersRouter } from "./routes/users.routes";
import { errorHandler } from "./middleware/errorHandler";
import { logger } from "./utils/logger";

/**
 * CRITICAL DEPENDENCY NOTE: every route handler across routes/ is an async
 * function that THROWS AppError/ComplianceError/etc. rather than calling
 * next(err) manually. This only correctly reaches errorHandler.ts below on
 * Express 5.x, which natively forwards rejected promises from async route
 * handlers to error-handling middleware. On Express 4.x, every one of those
 * throws would become a silent unhandled rejection and NEVER reach
 * errorHandler - effectively breaking every error path in the API. Do not
 * downgrade the express dependency below 5.0.0 (see package.json) without
 * also retrofitting every route handler with explicit try/catch + next(err),
 * or installing express-async-errors.
 */

export const app = express();

app.use(express.json());

app.use((req, _res, next) => {
  logger.debug("Incoming request", { method: req.method, path: req.path });
  next();
});

// Mounted in no particular dependency order - each router is independent
// and owns its own full route paths (e.g. "/institutions/payees"), so order
// of app.use() calls here does not affect routing behavior.
app.use(healthRouter);
app.use(attestationsRouter);
app.use(paymentsRouter);
app.use(institutionsRouter);
app.use(tradingRouter);
app.use(linkRouter);
app.use(usersRouter);

app.use((req, res) => {
  res
    .status(404)
    .json({ error: `No route for ${req.method} ${req.path}`, type: "NotFoundError" });
});

// MUST be registered last - Express only recognizes a 4-argument function
// as error-handling middleware, and only applies it to errors from routes
// registered before it.
app.use(errorHandler);
