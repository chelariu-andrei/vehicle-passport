import { html, raw } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import type { Part, Snapshot, SnapshotEvent } from './snapshot.ts';
import { tokensCss } from './tokens.generated.ts';

export const UNAVAILABLE = 'This passport is no longer available.';
export const TEMPORARY = 'We cannot show this passport right now. Please try again in a moment.';

const EVIDENCE: Record<string, string> = {
  ESTIMATED: 'Estimated',
  USER_CONFIRMED: 'Confirmed',
  DOCUMENTED: 'Documented',
  VERIFIED: 'Verified',
};
const EVIDENCE_NOTE: Record<string, string> = {
  ESTIMATED: 'Entered by hand, with no document behind it.',
  USER_CONFIRMED: 'Entered or checked by the seller, with no document behind it.',
  DOCUMENTED: 'Taken from an invoice the seller scanned.',
  VERIFIED: 'Confirmed by an independent source.',
};
// Class names avoid the evidence words so the page never contains "Verified" unless the API said so.
const TONE: Record<string, number> = { ESTIMATED: 1, USER_CONFIRMED: 2, DOCUMENTED: 3, VERIFIED: 4 };
const TYPES: Record<string, string> = { SERVICE: 'Service', REPAIR: 'Repair', TIRES: 'Tires', ITP: 'ITP' };

const css = `${tokensCss}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:400 var(--body-lg-size)/var(--body-lg-line) system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:40rem;margin:0 auto;padding:var(--space-4)}
h1,h2,h3{margin:0}
.hero{background:var(--brand-deep);color:var(--on-brand-deep);border-radius:var(--radius-xl);padding:var(--space-5);margin-top:var(--space-4)}
.hero h1{font-size:var(--display-size);line-height:var(--display-line);font-weight:var(--display-weight);letter-spacing:var(--display-tracking)}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.05em;overflow-wrap:anywhere}
.vin{font-size:var(--vin-size);margin:var(--space-2) 0 0}
.facts{display:flex;flex-wrap:wrap;gap:var(--space-2) var(--space-6);margin:var(--space-4) 0 0;padding:0}
.facts div{min-width:5rem}
dt{font-size:var(--caption-size);opacity:.8}
dd{margin:0;font-size:var(--body-size)}
.frozen{font-size:var(--caption-size);color:var(--ink-muted);margin:var(--space-3) 0 0}
h2{font-size:var(--title-lg-size);line-height:var(--title-lg-line);margin:var(--space-8) 0 var(--space-3)}
ol{list-style:none;margin:0;padding:0;display:grid;gap:var(--space-3)}
.event{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-lg);padding:var(--space-4)}
.event h3{font-size:var(--title-size);line-height:var(--title-line)}
.meta{color:var(--ink-muted);font-size:var(--body-size);margin:var(--space-1) 0 0}
.badge{display:inline-block;border:1px solid currentColor;border-radius:var(--radius-sm);padding:2px var(--space-2);font-size:var(--caption-size);font-weight:650;margin-top:var(--space-2)}
.tone-1{color:var(--evidence-estimated)}.tone-2{color:var(--evidence-confirmed)}
.tone-3{color:var(--evidence-documented)}.tone-4{color:var(--evidence-top)}
.note{font-size:var(--caption-size);color:var(--ink-muted);margin:var(--space-1) 0 0}
.notes{white-space:pre-wrap;overflow-wrap:anywhere;margin:var(--space-3) 0 0;font-size:var(--body-size)}
table{width:100%;border-collapse:collapse;margin-top:var(--space-3);font-size:var(--body-size)}
th{text-align:left;font-size:var(--caption-size);color:var(--ink-muted);font-weight:500}
td,th{padding:var(--space-1) 0;border-top:1px solid var(--line)}
td.n,th.n{text-align:right}
.integrity{background:var(--surface-raised);border-radius:var(--radius-lg);padding:var(--space-4);margin-top:var(--space-6)}
.integrity p{margin:var(--space-2) 0 0;font-size:var(--body-size);color:var(--ink-muted)}
.integrity .mono{font-size:var(--vin-sm-size);color:var(--ink)}
a.button{display:inline-flex;align-items:center;min-height:48px;margin-top:var(--space-6);padding:0 var(--space-6);border-radius:var(--radius-pill);background:var(--brand);color:var(--on-brand);font-weight:650;text-decoration:none}
a:focus-visible{outline:3px solid var(--focus);outline-offset:3px}
.message{margin-top:var(--space-12);text-align:center}
`;

function page(title: string, body: HtmlEscapedString | Promise<HtmlEscapedString>) {
  return html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="referrer" content="no-referrer">
<title>${title}</title>
<style>${raw(css)}</style>
</head>
<body><main>${body}</main></body>
</html>`;
}

export function messagePage(message: string) {
  return page('Vehicle passport', html`<h1 class="message" style="font-size:var(--title-lg-size)">${message}</h1>`);
}

const money = (amount: string | null, currency: string | null) =>
  amount === null ? '' : currency ? `${amount} ${currency}` : amount;

function partRows(parts: Part[]) {
  return html`<table>
<thead><tr><th>Part</th><th class="n">Qty</th><th class="n">Price</th></tr></thead>
<tbody>${parts.map(
    (p) => html`<tr><td>${p.name}</td><td class="n">${p.qty ?? ''}</td><td class="n">${p.price ?? ''}</td></tr>`,
  )}</tbody>
</table>`;
}

function eventItem(e: SnapshotEvent) {
  const label = EVIDENCE[e.evidence] ?? 'Unknown';
  const note = EVIDENCE_NOTE[e.evidence] ?? '';
  const cost = money(e.costAmount, e.currency);
  const meta = [e.date, e.odometerKm === null ? null : `${e.odometerKm} km`, cost || null].filter(Boolean).join(' · ');
  return html`<li class="event">
<h3>${TYPES[e.type] ?? e.type}${e.serviceName ? html` · ${e.serviceName}` : ''}</h3>
<p class="meta">${meta}</p>
<span class="badge tone-${TONE[e.evidence] ?? 1}">Evidence: ${label}</span>
<p class="note">${note}</p>
${e.documentPresent ? html`<p class="note">An invoice was attached when this entry was recorded.</p>` : ''}
${e.notes ? html`<p class="notes">${e.notes}</p>` : ''}
${e.parts && e.parts.length > 0 ? partRows(e.parts) : ''}
${e.labor !== null ? html`<p class="meta">Labor: ${money(e.labor, e.currency)}</p>` : ''}
</li>`;
}

export function passportPage(snapshot: Snapshot, hash: string, algorithm: string, pdfHref: string) {
  const v = snapshot.vehicle;
  const name = [v.make, v.model].filter(Boolean).join(' ') || 'Vehicle';
  const facts: [string, string | number | null][] = [
    ['Year', v.year],
    ['Engine', v.engine],
    ['Fuel', v.fuel],
  ];
  return page(
    `${name} passport`,
    html`<section class="hero">
<h1>${name}</h1>
<p class="mono vin">${v.vin}</p>
<dl class="facts">${facts
      .filter(([, value]) => value !== null && value !== '')
      .map(([key, value]) => html`<div><dt>${key}</dt><dd>${value}</dd></div>`)}</dl>
<p class="frozen">Frozen snapshot. It does not change after it was created.</p>
</section>
<h2>Service history</h2>
${
  snapshot.events.length === 0
    ? html`<p class="meta">No entries were recorded.</p>`
    : html`<ol>${snapshot.events.map(eventItem)}</ol>`
}
<section class="integrity">
<h2 style="margin:0;font-size:var(--title-size)">Integrity hash</h2>
<p>This ${algorithm} hash only shows whether the record was changed after it was frozen. It says nothing about whether the entries are true. Each entry's evidence is stated above.</p>
<p class="mono">${hash}</p>
</section>
<a class="button" href="${pdfHref}">Download PDF</a>`,
  );
}
