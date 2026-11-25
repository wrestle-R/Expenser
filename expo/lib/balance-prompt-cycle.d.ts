export function createBalancePromptCycle(): {
  reset(): void;
  check<T>(loadAlert: () => Promise<T | undefined>, present: (alert: T) => boolean): Promise<void>;
};
