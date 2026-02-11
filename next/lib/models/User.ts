import mongoose, { Schema, Document, models, model } from "mongoose";

export interface IUser extends Document {
  clerkId: string;
  name: string;
  email: string;
  occupation: string;
  paymentMethods: string[];
  balances: {
    bank: number;
    cash: number;
    splitwise: number;
  };
  workflows: {
    _id?: string;
    name: string;
    type: "income" | "expense";
    amount: number;
    description: string;
    category: string;
    paymentMethod: "bank" | "cash" | "splitwise";
    splitAmount: number;
  }[];
  onboarded: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    clerkId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    occupation: { type: String, default: "" },
    paymentMethods: { type: [String], default: [] },
    balances: {
      bank: { type: Number, default: 0 },
      cash: { type: Number, default: 0 },
      splitwise: { type: Number, default: 0 },
    },
    workflows: [
      {
        name: { type: String, required: true },
        type: { type: String, enum: ["income", "expense"], required: true },
        amount: { type: Number, required: true },
        description: { type: String, default: "" },
        category: { type: String, default: "General" },
        paymentMethod: { type: String, enum: ["bank", "cash", "splitwise"], required: true },
        splitAmount: { type: Number, default: 0 },
      },
    ],
    onboarded: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const User = models.User || model<IUser>("User", UserSchema);
