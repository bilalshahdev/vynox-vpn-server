// src/models/ad.model.ts
import { Schema, model, Document, models } from "mongoose";

export interface IAd extends Document {
  type: "banner" | "interstitial" | "reward";
  position: "home" | "splash" | "server" | "report";
  status: boolean;
  ad_id:  string;
  os_type: "android" | "ios";
  created_at: Date;
  updated_at: Date;
}

const adSchema = new Schema<IAd>(
  {
    type: {
      type: String,
      enum: ["banner", "interstitial", "reward"],
      required: true,
    },
    position: {
      type: String,
      enum: ["home", "splash", "server", "report"],
      required: true,
    },
    status: { type: Boolean, default: true },
    ad_id: { type: String },
    os_type: { type: String, enum: ["android", "ios"], required: true },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);

export const AdModel = models.Ad || model<IAd>("Ad", adSchema);
