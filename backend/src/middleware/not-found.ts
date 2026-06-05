import type { RequestHandler } from "express";
import { fail } from "../utils/api-response";

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json(
    fail("ROUTE_NOT_FOUND", `Route ${req.method} ${req.originalUrl} was not found`)
  );
};
