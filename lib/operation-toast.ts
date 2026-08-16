export type ToastKind = 'success' | 'error' | 'warning'

export type ImportSummary = { imported: number; updated: number; skipped: number; failed: number }
export type InvitationSummary = { total: number; sent: number; failed: number; skipped: number }

// Pure, UI-layer toast decision helpers. The API returns structured results;
// these classify the result and produce ONE concise summary message. They never
// call toast directly so they can be unit-tested and keep toast responsibility
// in the component layer.

export function classifyImport(result: ImportSummary): { kind: ToastKind; message: string } {
  const successful = result.imported + result.updated
  if (result.failed === 0 && successful > 0) {
    return { kind: 'success', message: `Broker import completed — ${successful} brokers processed.` }
  }
  if (successful > 0 && result.failed > 0) {
    return { kind: 'warning', message: `Broker import completed with issues — ${successful} processed, ${result.failed} failed.` }
  }
  if (successful === 0 && result.failed === 0) {
    return { kind: 'success', message: 'Broker import completed — no brokers were imported.' }
  }
  return { kind: 'error', message: `Broker import failed — ${result.failed} broker${result.failed === 1 ? '' : 's'} could not be imported.` }
}

export function classifyInvitations(summary: InvitationSummary): { kind: ToastKind; message: string } {
  if (summary.sent > 0 && summary.failed === 0) {
    return { kind: 'success', message: `Invitation emails accepted — ${summary.sent} invitation${summary.sent === 1 ? '' : 's'}.` }
  }
  if (summary.sent > 0 && summary.failed > 0) {
    return { kind: 'warning', message: `Invitations completed with issues — ${summary.sent} accepted, ${summary.failed} failed.` }
  }
  if (summary.sent === 0 && summary.failed === 0 && summary.skipped > 0) {
    return { kind: 'warning', message: `No new invitations sent — ${summary.skipped} broker${summary.skipped === 1 ? '' : 's'} already have active invitations.` }
  }
  if (summary.sent === 0 && summary.failed > 0) {
    return { kind: 'error', message: `Invitation emails failed — ${summary.failed} invitation${summary.failed === 1 ? '' : 's'} could not be sent.` }
  }
  return { kind: 'success', message: 'Invitations processed.' }
}

export function classifyRetry(summary: InvitationSummary): { kind: ToastKind; message: string } {
  if (summary.sent > 0 && summary.failed === 0) {
    return { kind: 'success', message: `Retry completed — ${summary.sent} invitation email${summary.sent === 1 ? '' : 's'} accepted.` }
  }
  if (summary.sent > 0 && summary.failed > 0) {
    return { kind: 'warning', message: `Retry completed with issues — ${summary.sent} accepted, ${summary.failed} failed.` }
  }
  if (summary.sent === 0 && summary.failed === 0 && summary.skipped > 0) {
    return { kind: 'warning', message: `No new invitations sent — ${summary.skipped} broker${summary.skipped === 1 ? '' : 's'} already have active invitations.` }
  }
  if (summary.sent === 0 && summary.failed > 0) {
    return { kind: 'error', message: 'Retry failed — the invitation emails could not be sent.' }
  }
  return { kind: 'success', message: 'Retry completed.' }
}
