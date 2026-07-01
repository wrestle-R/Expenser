import type { UserProfile as ContextUserProfile } from "@/context/UserContext";
import type { UserProfile as DbUserProfile } from "@/lib/db";

const contextProfile: ContextUserProfile = {
  userId: "user-1",
  name: "Russel Daniel Paul",
  email: "russel@example.com",
  occupation: "Student",
  paymentMethods: ["bank"],
  balances: {
    bank: 0,
    cash: 0,
    splitwise: 0,
  },
  onboarded: true,
  dashboardTutorialCompleted: false,
};

const dbProfile: DbUserProfile = {
  _id: "db-1",
  userId: "user-1",
  name: "Russel Daniel Paul",
  email: "russel@example.com",
  occupation: "Student",
  paymentMethods: ["bank"],
  balances: {
    bank: 0,
    cash: 0,
    splitwise: 0,
  },
  onboarded: true,
  dashboardTutorialCompleted: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const contextCompletion: boolean = contextProfile.dashboardTutorialCompleted;
const dbCompletion: boolean = dbProfile.dashboardTutorialCompleted;

void contextCompletion;
void dbCompletion;
