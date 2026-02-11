import mongoose from "mongoose";

export interface IWorkflow {
  userId: string;
  name: string;
  type: "income" | "expense";
  amount?: number;
  description: string;
  category: string;
  paymentMethod: "bank" | "cash" | "splitwise";
  splitAmount?: number;
  createdAt: Date;
  updatedAt: Date;
}

const WorkflowSchema = new mongoose.Schema<IWorkflow>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["income", "expense"],
      required: true,
    },
    amount: {
      type: Number,
      default: 0,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      default: "General",
    },
    paymentMethod: {
      type: String,
      enum: ["bank", "cash", "splitwise"],
      required: true,
    },
    splitAmount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.Workflow ||
  mongoose.model<IWorkflow>("Workflow", WorkflowSchema);
