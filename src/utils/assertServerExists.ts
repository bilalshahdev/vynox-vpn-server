import mongoose from "mongoose";
import { ServerModel } from "../models/server.model";

async function assertServerExists(server_id: string) {
  if (!mongoose.isValidObjectId(server_id)) {
    const err: any = new Error(
      "Invalid server_id: must be a 24-hex Mongo ObjectId"
    );
    err.statusCode = 400;
    throw err;
  }

  const exists = await ServerModel.exists({ _id: server_id });
  if (!exists) {
    const err: any = new Error("Server not found");
    err.statusCode = 404;
    throw err;
  }
}

export default assertServerExists;
