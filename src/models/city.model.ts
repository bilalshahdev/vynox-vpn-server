// src/models/city.model.ts
import { Schema, model, models, Document } from "mongoose";

export interface ICity extends Document {
  name: string;
  slug: string;
  state: string;
  country: string; // ref Country._id ("IN")
  latitude: number;
  longitude: number;
  created_at: Date;
  updated_at: Date;
}

const CitySchema = new Schema<ICity>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    state: { type: String, required: true, uppercase: true, trim: true },

    country: {
      type: String,
      ref: "Country", // 👈 directly reference Country model
      required: true,
      uppercase: true,
      trim: true,
    },

    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

// indexes
CitySchema.index({ country: 1, slug: 1 }, { unique: true });
CitySchema.index({ country: 1, state: 1, name: 1 }, { unique: true });

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
  if (this.country) this.country = this.country.toUpperCase();
  if (this.state) this.state = this.state.toUpperCase();
  if (this.slug) this.slug = this.slug.toLowerCase();
  next();
});

// Ensure virtuals are included when converting to JSON
CitySchema.set("toObject", { virtuals: true });
CitySchema.set("toJSON", { virtuals: true });

export const CityModel = models.City || model<ICity>("City", CitySchema);
