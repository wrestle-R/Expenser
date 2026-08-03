export async function processBankImportCandidate({
  candidate,
  parse,
  queueTransaction,
  saveReview,
}) {
  const response = await parse(candidate);
  if (response.kind === "transaction") {
    await queueTransaction(response);
    return response.kind;
  }
  if (response.kind === "review_event" || response.kind === "unparsed") {
    const saved = await saveReview(response, candidate);
    if (!saved) throw new Error("Review item could not be saved");
  }
  return response.kind;
}
