import { Schema, model, Document, models } from "mongoose";

export interface IConnectivity extends Document {
  user_id: string;
  server_id: string;
  connected_at: Date;
  disconnected_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

const connectivitySchema = new Schema<IConnectivity>(
  {
    user_id: { type: String, required: true, index: true },
    server_id: { type: String, required: true, index: true },
    connected_at: { type: Date, required: true },
    disconnected_at: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Safety: disconnected_at >= connected_at (if present)
connectivitySchema.path("disconnected_at").validate(function (v: Date | null) {
  if (v == null) return true;
  return this.connected_at && v.getTime() >= this.connected_at.getTime();
}, "disconnected_at cannot be earlier than connected_at");

connectivitySchema.index(
  { user_id: 1, server_id: 1, disconnected_at: 1 },
  {
    unique: true,
    partialFilterExpression: { disconnected_at: null },
    name: "uniq_open_session",
  }
);
connectivitySchema.index({ user_id: 1, connected_at: -1 });
connectivitySchema.index({ server_id: 1, connected_at: -1 });
connectivitySchema.index({ connected_at: -1 }); // optional, only if needed

export const ConnectivityModel =
  models.Connectivity ||
  model<IConnectivity>("Connectivity", connectivitySchema);
