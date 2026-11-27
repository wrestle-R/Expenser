export function createBalancePromptCycle() {
  let generation = 0;
  let checked = false;
  let checking = false;
  let lastShownId;

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
        if (alert._id && alert._id === lastShownId) return;
        checked = present(alert);
        if (checked) lastShownId = alert._id;
      } finally {
        if (started === generation) checking = false;
      }
    },
  };
}
