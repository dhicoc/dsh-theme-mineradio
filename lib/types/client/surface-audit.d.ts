/**
 * Surface audit — the adaptation loop, closed.
 *
 * Instead of waiting for "this slab looks unthemed" reports, the audit
 * sweeps the live DOM for the exact signature of an un-adapted surface:
 * a large element whose COMPUTED background-color is fully opaque. It is
 * self-calibrating — everything the theme already reaches computes to
 * alpha < 1 (token-tinted fills via the override stack, family glass, the
 * lifted bones), so what remains is precisely the stock-painted residue
 * no rule has met yet.
 *
 * Each hit is stamped `data-dsh-aqua-unthemed` (gold dashed outline while
 * `data-dsh-aqua-audit` sits on <html>) and grouped by its CSS-module word
 * root into a report that maps 1:1 onto new sweep roots or blacklist
 * entries. Dev-tool console API, no settings surface:
 *
 *   __mineradioAudit()        — scan, stamp, report (copies to clipboard)
 *   __mineradioAudit(false)   — clear stamps
 */
/**
 * Run one audit pass: sweep, stamp, report.
 * @returns a disposer that clears the stamps and the audit attribute.
 */
export declare function runSurfaceAudit(): () => void;
