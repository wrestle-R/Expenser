import mongoose, { Schema, Document, models, model } from "mongoose";

export interface ITransaction extends Document {
  clerkId: string;
  type: "income" | "expense";
  amount: number;
  description: string;
  category: string;
  paymentMethod: "bank" | "cash" | "splitwise";
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    clerkId: { type: String, required: true, index: true },
    type: { type: String, enum: ["income", "expense"], required: true },
    amount: { type: Number, required: true },
    description: { type: String, required: true },
    category: { type: String, default: "General" },
    paymentMethod: {
      type: String,
      enum: ["bank", "cash", "splitwise"],
      required: true,
    },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const Transaction =
  models.Transaction || model<ITransaction>("Transaction", TransactionSchema);
