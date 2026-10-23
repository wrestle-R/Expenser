export type WorkflowSchedule = { days: number[]; time: string; timeZone: string; enabled: boolean };
export const WEEKDAYS: string[];
export function parseWorkflowSchedule(value: unknown, amount: number): WorkflowSchedule | null;
export function describeWorkflowSchedule(schedule?: WorkflowSchedule | null): string;
