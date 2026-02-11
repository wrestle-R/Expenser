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
    onboarded: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const User = models.User || model<IUser>("User", UserSchema);
