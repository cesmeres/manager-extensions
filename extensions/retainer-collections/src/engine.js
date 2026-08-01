/* ============================================================================
   Retainer Collections — transform engine (Manager.io cash basis)
   ----------------------------------------------------------------------------
   Pure, dependency-free. Turns cash-basis General-Ledger-Transactions rows into
   a "collections by client" report, grouped by income account.

   Reconciliation logic (verified against Manager.io's cash-basis P&L):
     - The account drill-down has boundary rows per invoice (beginning receivable
       + ending balance) split across Debit/Credit.
     - Collection for an invoice this period = round(SUM(Credit) - SUM(Debit), 2),
       computed within each (account, invoice).
     - net > 0  -> a collection (Paid Retainers)
       net < 0  -> a reversal   (Adjustments)
       net == 0 -> no cash moved this period (dropped)
     - Per-account subtotal = its collections; grand total = all selected accounts.

   transform() groups by ACCOUNT. Rows carry an optional `account`; when the
   source has no account column, everything falls into one group whose label is
   opts.defaultAccount (or "").

   Exposed as a browser global (window.RetainerEngine) and as a CommonJS module.
   ========================================================================== */
(function (root) {
  'use strict';

  var INVOICE_RE = /Sales\s+Invoice\s*[—–\-]\s*(\S+)\s*[—–\-]\s*(\S+)/i;

  function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

  function num(v) {
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var s = String(v).replace(/,/g, '').replace(/[^0-9.\-]/g, '').trim();
    if (s === '' || s === '-' || s === '.') return 0;
    var n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }

  function parseTransaction(text) {
    var t = String(text == null ? '' : text);
    var m = t.match(INVOICE_RE);
    return {
      invoice: m ? m[1] : null,
      invoiceDate: m ? m[2] : null,
      key: m ? ('INV:' + m[1]) : ('TXN:' + t.trim())
    };
  }

  function cleanName(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }

  function splitCode(name) {
    var m = /^(\d{3,})\s*[-–—]\s*(.*)$/.exec(name);
    if (m) return { code: m[1], name: m[2].trim() };
    return { code: '', name: name };
  }

  /* Build one account's breakdown from its accumulated invoices. */
  function buildAccount(account, byInvoice, order, td, tc) {
    var paid = [], adjustments = [], zeroCount = 0;
    for (var k = 0; k < order.length; k++) {
      var it = byInvoice[order[k]];
      var net = round2(it.credit - it.debit);
      var sc = splitCode(it.customer);
      var rec = {
        account: account,
        customer: it.customer, clientCode: sc.code, clientName: sc.name,
        invoice: it.invoice, invoiceDate: it.invoiceDate, transaction: it.transaction,
        amount: net, debit: round2(it.debit), credit: round2(it.credit)
      };
      if (net > 0) paid.push(rec);
      else if (net < 0) adjustments.push(rec);
      else zeroCount++;
    }
    var byClient = function (a, b) {
      var an = (a.customer || '').toLowerCase(), bn = (b.customer || '').toLowerCase();
      if (an < bn) return -1; if (an > bn) return 1;
      var ai = parseInt(a.invoice, 10), bi = parseInt(b.invoice, 10);
      if (isFinite(ai) && isFinite(bi)) return ai - bi;
      return String(a.invoice).localeCompare(String(b.invoice));
    };
    paid.sort(byClient); adjustments.sort(byClient);

    var clients = [], seen = Object.create(null);
    for (var j = 0; j < paid.length; j++) {
      var c = paid[j].customer;
      if (!(c in seen)) { seen[c] = { customer: c, count: 0, amount: 0 }; clients.push(seen[c]); }
      seen[c].count++;
      seen[c].amount = round2(seen[c].amount + paid[j].amount);
    }
    var gross = paid.reduce(function (s, x) { return round2(s + x.amount); }, 0);
    var adj = adjustments.reduce(function (s, x) { return round2(s + x.amount); }, 0);
    return {
      account: account, paid: paid, adjustments: adjustments, clients: clients, zeroCount: zeroCount,
      summary: {
        grossPositive: gross, adjustments: adj, net: round2(gross + adj),
        invoicesWithCollections: paid.length, clientsWithCollections: clients.length,
        totalDebit: round2(td), totalCredit: round2(tc), zeroCount: zeroCount
      }
    };
  }

  /* Grand totals across an array of account breakdowns (used for the whole
     report AND for the live subset the user has ticked). */
  function grandSummary(accounts) {
    var gross = 0, adj = 0, inv = 0, td = 0, tc = 0, zero = 0, clients = Object.create(null);
    for (var i = 0; i < accounts.length; i++) {
      var a = accounts[i].summary;
      gross = round2(gross + a.grossPositive); adj = round2(adj + a.adjustments);
      inv += a.invoicesWithCollections; td = round2(td + a.totalDebit); tc = round2(tc + a.totalCredit);
      zero += a.zeroCount || 0;
      for (var j = 0; j < accounts[i].paid.length; j++) clients[accounts[i].paid[j].customer] = 1;
    }
    return {
      grossPositive: gross, adjustments: adj, net: round2(gross + adj),
      invoicesWithCollections: inv, clientsWithCollections: Object.keys(clients).length,
      totalDebit: td, totalCredit: tc, zeroCount: zero, accountCount: accounts.length
    };
  }

  /* ------------------------------------------------------------------------
     transform(rows, opts)
       rows : array of { date, transaction, customer, description, debit, credit,
                         account? }
       opts : { descriptionFilter?, defaultAccount? }
     returns { accounts:[...], summary:{grand}, paid:[flat], adjustments:[flat] }
     ---------------------------------------------------------------------- */
  function transform(rows, opts) {
    opts = opts || {};
    var descFilter = opts.descriptionFilter ? String(opts.descriptionFilter).toLowerCase() : null;
    var defAcct = opts.defaultAccount != null ? String(opts.defaultAccount) : '';

    var acc = Object.create(null), accOrder = [];

    for (var i = 0; i < rows.length; i++) {
      var r = rows[i] || {};
      var txt = r.transaction != null ? r.transaction : (r.Transaction || '');
      if (!txt) continue;
      var desc = r.description != null ? r.description : (r.Description || '');
      if (descFilter && String(desc).toLowerCase().indexOf(descFilter) === -1) continue;
      var debit = num(r.debit != null ? r.debit : r.Debit);
      var credit = num(r.credit != null ? r.credit : r.Credit);
      if (debit === 0 && credit === 0) continue;

      var account = cleanName(r.account != null ? r.account : r.Account) || defAcct;
      var e = acc[account];
      if (!e) { e = acc[account] = { byInvoice: Object.create(null), order: [], td: 0, tc: 0 }; accOrder.push(account); }

      var p = parseTransaction(txt);
      var cust = cleanName(r.customer != null ? r.customer : r.Customer);
      var g = e.byInvoice[p.key];
      if (!g) {
        g = e.byInvoice[p.key] = { key: p.key, invoice: p.invoice, invoiceDate: p.invoiceDate, transaction: cleanName(txt), customer: cust, debit: 0, credit: 0 };
        e.order.push(p.key);
      }
      if (!g.customer && cust) g.customer = cust;
      g.debit += debit; g.credit += credit; e.td += debit; e.tc += credit;
    }

    var accounts = accOrder.map(function (name) {
      var e = acc[name];
      return buildAccount(name, e.byInvoice, e.order, e.td, e.tc);
    });
    accounts.sort(function (a, b) { return (a.account || '').toLowerCase().localeCompare((b.account || '').toLowerCase()); });

    // Flat lists (all accounts) for convenience / CSV.
    var paid = [], adjustments = [];
    accounts.forEach(function (a) { paid = paid.concat(a.paid); adjustments = adjustments.concat(a.adjustments); });

    return { accounts: accounts, summary: grandSummary(accounts), paid: paid, adjustments: adjustments };
  }

  var api = {
    transform: transform, grandSummary: grandSummary,
    parseTransaction: parseTransaction, num: num, round2: round2, splitCode: splitCode, cleanName: cleanName
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.RetainerEngine = api;
})(typeof window !== 'undefined' ? window : this);
