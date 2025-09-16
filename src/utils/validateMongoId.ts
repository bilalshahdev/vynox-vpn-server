// src/services/_utils.ts
import { Types } from "mongoose";
export function validateMongoId(id: string) {
  if (!Types.ObjectId.isValid(id)) {
    const err: any = new Error("Invalid id: must be a 24-hex Mongo ObjectId");
    err.statusCode = 400;
    throw err;
  }
}
