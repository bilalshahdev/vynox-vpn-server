// src/services/_utils.ts
import { Types } from "mongoose";
export function validateMongoId(id: string) {
  if (!Types.ObjectId.isValid(id)) {
    const err = new Error("Invalid server_id: must be a 24-hex Mongo ObjectId");
    (err as any).statusCode = 400;
    throw err;
  }
  return new Types.ObjectId(id);
}
