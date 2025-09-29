// src/models/ad.model.ts
import { Schema, model, Document, models } from "mongoose";

export interface IAd extends Document {
  type: string;
  position: string;
  status: boolean;
  ad_id: string;
  os_type: "android" | "ios";
  created_at: Date;
  updated_at: Date;
}

const adSchema = new Schema<IAd>(
  {
    type: {
      type: String,
      required: true,
    },
    position: {
      type: String,
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

adSchema.index({ os_type: 1, position: 1, status: 1, created_at: -1 });

export const AdModel = models.Ad || model<IAd>("Ad", adSchema);
