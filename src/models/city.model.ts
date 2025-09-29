// src/models/city.model.ts
import { Schema, model, models, Document } from "mongoose";

export interface ICity extends Document {
  name: string; // "Lahore"
  slug: string; // "lahore"
  state: string; // "PB"
  country_id: string; // "PK" (ref Country._id)
  latitude: number; // 31.5204
  longitude: number; // 74.3587
  created_at: Date;
  updated_at: Date;
}

const CitySchema = new Schema<ICity>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    state: { type: String, required: true, uppercase: true, trim: true },
    country_id: {
      type: String,
      required: true,
      ref: "Country",
      uppercase: true,
      trim: true,
    },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

CitySchema.index({ country_id: 1, slug: 1 }, { unique: true });
CitySchema.index({ country_id: 1, state: 1, name: 1 }, { unique: true });

// normalize slug + uppercasing
CitySchema.pre("validate", function (next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, "-");
  }
  if (this.country_id) this.country_id = this.country_id.toUpperCase();
  if (this.state) this.state = this.state.toUpperCase();
  if (this.slug) this.slug = this.slug.toLowerCase();
  next();
});



export const CityModel = models.City || model<ICity>("City", CitySchema);
