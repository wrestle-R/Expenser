export function createBalancePromptCycle() {
  let generation = 0;
  let checked = false;
  let checking = false;

  return {
    reset() {
      generation++;
      checked = false;
      checking = false;
    },
    async check(loadAlert, present) {
      if (checked || checking) return;
      const started = generation;
      checking = true;
      try {
        const alert = await loadAlert();
        if (started !== generation || !alert) return;
        checked = present(alert);
      } finally {
        if (started === generation) checking = false;
      }
    },
  };
}
