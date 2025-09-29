// src/models/faq.model.ts
import { Schema, model, models, Document } from "mongoose";

export interface IFaq extends Document {
  question: string;
  slug: string;
  answer: string;
  created_at: Date;
  updated_at: Date;
}

const FaqSchema = new Schema<IFaq>(
  {
    question: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
    },
    answer: { type: String, required: true, trim: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

// indexes
FaqSchema.index({ slug: 1 }, { unique: true });
FaqSchema.index({ question: 1 });

export const FaqModel = models.Faq || model<IFaq>("Faq", FaqSchema);
