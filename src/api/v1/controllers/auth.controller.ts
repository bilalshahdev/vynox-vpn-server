// src/api/v1/controllers/auth.controller.ts
import { FastifyReply, FastifyRequest } from "fastify";
import { LoginSchema } from "../../../schemas/auth.schema";
import { adminEmail, adminPassword } from "../../../config/constants";
import { generateToken } from "../../../utils/tokens";

export const login = async (
  req: FastifyRequest<{ Body: LoginSchema }>,
  reply: FastifyReply
) => {
  const { email, password } = req.body;

  if (email !== adminEmail || password !== adminPassword) {
    return reply
      .status(401)
      .send({ status: "error", message: "Invalid credentials" });
  }

  const token = generateToken({ email });

  return reply.send({
    status: "success",
    message: "Login successful",
    data: {
      token,
    },
  });
};
