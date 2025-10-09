// src/models/feedback.model.ts
import { Schema, model, Document, Types, models } from "mongoose";

export interface IFeedback extends Document {
  reason: string;
  network_type: "wifi" | "mobile";
  requested_server: string;
  server_id: Types.ObjectId;
  rating: number;
  review: string;
  additional_data?: Record<string, any>;
  os_type: "android" | "ios";
  datetime: Date;
  created_at: Date;
  updated_at: Date;
}

const feedbackSchema = new Schema<IFeedback>(
  {
    reason: { type: String, required: true },
    network_type: { type: String, enum: ["wifi", "mobile"] },
    requested_server: { type: String },
    server_id: { type: Schema.Types.ObjectId, ref: "Server" },
    rating: { type: Number, min: 1, max: 5 },
    review: { type: String, required: true },
    additional_data: { type: Schema.Types.Mixed },
    os_type: { type: String, enum: ["android", "ios"], required: true },
    datetime: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

feedbackSchema.index({ datetime: -1 });
feedbackSchema.index({ rating: 1, datetime: -1 });

export const FeedbackModel =
  models.Feedback || model<IFeedback>("Feedback", feedbackSchema);
