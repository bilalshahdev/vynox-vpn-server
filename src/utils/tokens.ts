import { preHandlerHookHandler } from "fastify";
import jwt, { SignOptions } from "jsonwebtoken";
import { StringValue } from "ms";
import { config } from "../config";

export interface JwtPayload {
  email: string;
}

const JWT_SECRET = config.auth.jwtSecret;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined in environment variables");
}

export const generateToken = (
  payload: JwtPayload,
  expiresIn: StringValue | number = "1h"
): string => {
  const options: SignOptions = { expiresIn };
  return jwt.sign(payload, JWT_SECRET, options);
};

export const verifyToken: preHandlerHookHandler = async (req, reply) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return reply
      .status(401)
      .send({ status: "error", message: "No token provided" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    (req as any).user = decoded;
  } catch (err) {
    return reply
      .status(401)
      .send({ status: "error", message: "Invalid or expired token" });
  }
};
