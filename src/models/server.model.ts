// src/models/server.model.ts
import { Schema, model, Document, models } from "mongoose";

export interface IServer extends Document {
  general: {
    name: string;
    categories: string[];
    country: string;
    country_code: string;
    flag: string;
    city: string;
    is_pro: boolean;
    mode: "test" | "live";
    ip: string;
    latitude: number;
    longitude: number;
    os_type: "android" | "ios" | "both";
  };
  openvpn_config?: {
    username: string;
    password: string;
    config: string;
  };
  wireguard_config?: {
    address: string;
    config: string;
  };
  created_at: Date;
  updated_at: Date;
}

const serverSchema = new Schema<IServer>(
  {
    general: {
      name: { type: String, required: true },
      categories: [
        { type: String, enum: ["gaming", "streaming"], required: true },
      ],
      country: { type: String, required: true },
      country_code: { type: String, required: true },
      flag: { type: String, required: true },
      city: { type: String, required: true },
      is_pro: { type: Boolean, default: false },
      mode: { type: String, enum: ["test", "live"], default: "test" },
      ip: {
        type: String,
        required: true,
        unique: true,
      },
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      os_type: { type: String, enum: ["android", "ios", "both"], required: true },
    },
    openvpn_config: {
      username: { type: String },
      password: { type: String },
      config: { type: String },
    },
    wireguard_config: {
      address: { type: String },
      config: { type: String },
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);

serverSchema.index({
  "general.os_type": 1,
  "general.is_pro": 1,
  "general.mode": 1,
  created_at: 1,
});
serverSchema.index({ "general.is_pro": 1, created_at: 1 });

export const ServerModel =
  models.Server || model<IServer>("Server", serverSchema);
