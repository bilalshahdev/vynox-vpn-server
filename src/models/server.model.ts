// src/models/server.model.ts
import { Schema, model, Document, models, Types } from "mongoose";

export interface IServer extends Document {
  general: {
    name: string;
    categories: ("gaming" | "streaming")[];
    country_id: string;
    city_id: Types.ObjectId;
    is_pro: boolean;
    mode: "test" | "live" | "off";
    ip: string;
    os_type: "android" | "ios";
  };
  openvpn_config?: { username: string; password: string; config: string };
  wireguard_config?: { address: string; config: string };
  created_at: Date;
  updated_at: Date;
}

const serverSchema = new Schema<IServer>(
  {
    general: {
      name: { type: String, required: true, trim: true },
      categories: [
        { type: String, enum: ["gaming", "streaming"], required: true },
      ],
      country_id: {
        type: String,
        ref: "Country",
        required: true,
        uppercase: true,
        trim: true,
      },
      city_id: { type: Schema.Types.ObjectId, ref: "City", required: true },
      is_pro: { type: Boolean, default: false },
      mode: { type: String, enum: ["test", "live", "off"], default: "test" },
      ip: { type: String, required: true },
      os_type: { type: String, enum: ["android", "ios"], required: true },
    },
    openvpn_config: { username: String, password: String, config: String },
    wireguard_config: { address: String, config: String },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Uniqueness & recency
serverSchema.index(
  { "general.os_type": 1, "general.ip": 1 },
  { unique: true, name: "uniq_os_type_ip" }
);
serverSchema.index({ "general.os_type": 1, created_at: -1 });
serverSchema.index({ "general.mode": 1, created_at: -1 });
serverSchema.index({ "general.is_pro": 1, created_at: -1 });

serverSchema.pre("save", async function (next) {
  try {
    const doc = this as IServer;
    if (
      doc.isModified("general.city_id") ||
      doc.isModified("general.country_id")
    ) {
      const City = this.model("City");
      const city = await City.findById(doc.general.city_id)
        .select("country")
        .lean<any>();
      if (!city) return next(new Error("Invalid city_id"));
      if (city.country !== doc.general.country_id) {
        return next(
          new Error("city.country does not match general.country_id")
        );
      }
    }
    next();
  } catch (e) {
    next(e as Error);
  }
});

export const ServerModel =
  models.Server || model<IServer>("Server", serverSchema);
