// src/models/connectivity.model.ts
import { Schema, model, Document, models } from "mongoose";

interface IConnectivity extends Document {
  user_id: string;
  server_id: string;
  connected_at: Date;
  disconnected_at: Date | null; // allow null until disconnected
  created_at: Date;
  updated_at: Date;
}

const connectivitySchema = new Schema<IConnectivity>(
  {
    user_id: { type: String, required: true },
    server_id: { type: String, required: true },
    connected_at: { type: Date, required: true },
    disconnected_at: { type: Date, default: null }, // ⬅️ not required anymore
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);

// Optional safety: disconnected_at must be >= connected_at (if present)
connectivitySchema.path("disconnected_at").validate(function (v: Date | null) {
  if (v == null) return true;
  return this.connected_at && v.getTime() >= this.connected_at.getTime();
}, "disconnected_at cannot be earlier than connected_at");

connectivitySchema.index({ user_id: 1 });
connectivitySchema.index({ server_id: 1 });
connectivitySchema.index({ connected_at: -1 });

export const ConnectivityModel =
  models.Connectivity ||
  model<IConnectivity>("Connectivity", connectivitySchema);
