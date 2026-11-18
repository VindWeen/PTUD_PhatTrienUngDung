export function assessmentContexts(contexts) {
  // Multiple memberships can expose the same adoption. The API runs one
  // assessment per adoption, so only distinct executable contexts are selectable.
  return [...new Map(contexts.map(context => [
    String(context.regulation_version_id) + ':' + (context.adoption_id ?? 'owner'),
    context,
  ])).entries()];
}

export function effective(version, day) {
  return version.publication_status === 'PUBLISHED'
    && Boolean(version.effective_from)
    && String(version.effective_from).slice(0, 10) <= day
    && (!version.effective_to || String(version.effective_to).slice(0, 10) >= day);
}
