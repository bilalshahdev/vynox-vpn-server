// src/models/page.model.ts
import { Schema, model, Document, models } from "mongoose";

export interface IPage extends Document {
  type: string; // e.g., "about", "contact", "terms-conditions"
  title: string;
  description: string; // HTML/text description
  created_at: Date;
  updated_at: Date;
}

const pageSchema = new Schema<IPage>(
  {
    type: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String, required: true }, // HTML
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);

export const PageModel = models.Page || model<IPage>("Page", pageSchema);
