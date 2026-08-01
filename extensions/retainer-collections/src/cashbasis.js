/* ============================================================================
   Cash-basis reconstruction from source records (Manager.io)
   ----------------------------------------------------------------------------
   Live mode can't read Manager's rendered cash-basis report, so we rebuild it
   from records the API DOES expose: receipts (money in) allocated to sales
   invoices, attributed to income accounts net-of-tax, proportionally.

   Recognition model (matches Manager's cash-basis P&L for tax-free lines):
     income to account A, from a receipt payment P applied to invoice I
       = P * ( netA(I) / total(I) )
     where netA(I) = sum of I's line amounts posting to A,
           total(I) = sum of ALL I's line amounts (the invoice total).
     Rounded to 2 dp per (receipt-payment, account) — this reproduces the
     sub-unit residuals seen in partial payments across multi-line invoices.

   Pure & dependency-free; unit-tested with synthetic fixtures. Emits GL-like
   rows { account, transaction, customer, credit, debit } so the existing
   RetainerEngine.transform() renders them with per-account subtotals.
   ========================================================================== */
(function (root) {
  'use strict';
  function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

  /* invoiceTotal: sum of all line net amounts (+ tax if present). */
  function invoiceTotal(inv) {
    if (typeof inv.total === 'number' && inv.total) return inv.total;
    var t = 0;
    (inv.lines || []).forEach(function (l) { t += (l.amount || 0) + (l.tax || 0); });
    return round2(t);
  }

  /* Sum of an invoice's net line amounts posting to each selected account. */
  function netByAccount(inv, sel) {
    var m = Object.create(null);
    (inv.lines || []).forEach(function (l) {
      if (sel.has(l.account)) m[l.account] = (m[l.account] || 0) + (l.amount || 0);
    });
    return m;
  }

  /* ------------------------------------------------------------------------
     compute(receipts, invoicesByKey, opts) -> { rows, stats }
       receipts       : [{ key, date, customerKey, allocations:[{invoice, amount}],
                           directs:[{account, customerKey, amount}] }]
       invoicesByKey  : { <invoiceKey>: { customerKey, reference, date,
                                          lines:[{account, amount, tax?}], total? } }
       opts           : { accounts:Set<accountKey>, sign?:+1|-1 }
     rows: [{ accountKey, customerKey, invoice, invoiceDate, amount }]
     ---------------------------------------------------------------------- */
  function compute(receipts, invoicesByKey, opts) {
    opts = opts || {};
    var sel = opts.accounts;                 // Set of selected income account keys
    var sign = opts.sign === -1 ? -1 : 1;    // credit notes pass -1
    var rows = [];
    var stats = { receiptsUsed: 0, allocations: 0, directs: 0, unknownInvoices: {}, matchedPayments: 0 };

    (receipts || []).forEach(function (r) {
      var used = false;
      (r.allocations || []).forEach(function (al) {
        stats.allocations++;
        var inv = invoicesByKey[al.invoice];
        if (!inv) { stats.unknownInvoices[al.invoice] = 1; return; }
        var total = invoiceTotal(inv);
        if (!total) return;
        var byAcct = netByAccount(inv, sel);
        var hit = false;
        for (var ak in byAcct) {
          var share = round2(sign * al.amount * (byAcct[ak] / total));
          if (share === 0) continue;
          rows.push({
            accountKey: ak,
            customerKey: inv.customerKey || r.customerKey || al.customerKey || '',
            invoice: inv.reference || al.invoice,
            invoiceDate: inv.date || '',
            amount: share
          });
          hit = true;
        }
        if (hit) { used = true; stats.matchedPayments++; }
      });
      (r.directs || []).forEach(function (d) {
        stats.directs++;
        if (!sel.has(d.account)) return;
        var amt = round2(sign * d.amount);
        if (amt === 0) return;
        rows.push({ accountKey: d.account, customerKey: d.customerKey || r.customerKey || '', invoice: '(direct)', invoiceDate: r.date || '', amount: amt });
        used = true;
      });
      if (used) stats.receiptsUsed++;
    });

    stats.unknownInvoices = Object.keys(stats.unknownInvoices);
    return { rows: rows, stats: stats };
  }

  /* Map compute() rows -> GL-like rows for RetainerEngine.transform().
       names: { account:{key->name}, customer:{key->name} } */
  function toLedgerRows(rows, names) {
    names = names || {}; var an = names.account || {}, cn = names.customer || {};
    return rows.map(function (x) {
      var cust = cn[x.customerKey] || x.customerKey || '';
      var txn = 'Sales Invoice — ' + (x.invoice || '?') + ' — ' + (x.invoiceDate || '');
      return {
        account: an[x.accountKey] || x.accountKey || '',
        transaction: txn,
        customer: cust,
        credit: x.amount >= 0 ? x.amount : '',
        debit: x.amount < 0 ? -x.amount : ''
      };
    });
  }

  var api = { compute: compute, toLedgerRows: toLedgerRows, invoiceTotal: invoiceTotal, round2: round2 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.RetainerCashBasis = api;
})(typeof window !== 'undefined' ? window : this);
