// src/models/country.model.ts
import { Schema, model, models, Document } from "mongoose";

export interface ICountry extends Document {
  _id: string;
  name: string;
  slug: string;
  flag?: string;
  country_code?: string;
  created_at: Date;
  updated_at: Date;
}

const CountrySchema = new Schema<ICountry>(
  {
    _id: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
    },
    flag: { type: String, trim: true },
    country_code: { type: String, trim: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

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
