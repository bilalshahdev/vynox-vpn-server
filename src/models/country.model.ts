// src/models/country.model.ts
import { Schema, model, models, Document } from "mongoose";

export interface ICountry extends Document {
  _id: string; // ISO2 code, e.g. "PK"
  name: string; // "Pakistan"
  slug: string; // "pakistan"
  flag?: string; // "pk.png"
  country_code?: string; // "PK"
  created_at: Date;
  updated_at: Date;
}

const CountrySchema = new Schema<ICountry>(
  {
    _id: { type: String, required: true, trim: true, uppercase: true }, // ISO2
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
    },
    flag: { type: String, trim: true }, // store "pk.png" or a path
    country_code: { type: String, trim: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

// indexes
CountrySchema.index({ slug: 1 }, { unique: true });
CountrySchema.index({ name: 1 });

// normalize
CountrySchema.pre("validate", function (next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, "-");
  }
  if (this._id) this._id = this._id.toUpperCase();
  if (this.slug) this.slug = this.slug.toLowerCase();
  next();
});

export const CountryModel =
  models.Country || model<ICountry>("Country", CountrySchema);
