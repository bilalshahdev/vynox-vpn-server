// src/models/dropdown.model.ts
import { Document, Schema, model, models } from "mongoose";

interface IDropdownValue {
  name: string;
  value: string;
}

interface IDropdown extends Document {
  name: string;
  values: IDropdownValue[];
  created_at: Date;
  updated_at: Date;
}

const DropdownValueSchema = new Schema<IDropdownValue>(
  {
    name: { type: String, required: true },
    value: { type: String, required: true },
  },
  { _id: false }
);

const DropdownSchema = new Schema<IDropdown>(
  {
    name: { type: String, required: true, unique: true },
    values: {
      type: [DropdownValueSchema],
      default: [],
      validate: {
        validator: function (values: IDropdownValue[]) {
          const uniqueValues = new Set(values.map((v) => v.value));
          return uniqueValues.size === values.length;
        },
        message: "Duplicate values are not allowed inside dropdown values.",
      },
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);

const Dropdown =
  models.Dropdown || model<IDropdown>("Dropdown", DropdownSchema);
export { Dropdown, IDropdown, IDropdownValue };
