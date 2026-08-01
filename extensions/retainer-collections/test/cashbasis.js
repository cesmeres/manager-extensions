#!/usr/bin/env node
/* Unit tests for the records-based cash-basis reconstruction (cashbasis.js),
   including the hand-off into engine.js for rendering totals. No live data.
     node test/cashbasis.js
*/
'use strict';
var path = require('path');
var CB = require(path.join(__dirname, '..', 'src', 'cashbasis.js'));
var E = require(path.join(__dirname, '..', 'src', 'engine.js'));

var fails = 0;
function eq(label, got, want) {
  var ok = (typeof want === 'number') ? Math.abs((got || 0) - want) < 0.005 : got === want;
  console.log((ok ? '  ok  ' : ' FAIL ') + label + '  got=' + got + ' want=' + want);
  if (!ok) fails++;
}

// Accounts: A = retainer (selected), B = a reimbursement account (not selected)
var sel = new Set(['A']);

var invoicesByKey = {
  I1: { customerKey: 'C1', reference: '25783', date: '01/01/2026', lines: [{ account: 'A', amount: 1500 }, { account: 'B', amount: 800 }] }, // total 2300
  I2: { customerKey: 'C2', reference: '25999', date: '01/01/2026', lines: [{ account: 'A', amount: 1000 }] },                                 // total 1000
  I3: { customerKey: 'C1', reference: '26100', date: '02/01/2026', lines: [{ account: 'A', amount: 3000 }, { account: 'B', amount: 1000 }] }, // total 4000
  I4: { customerKey: 'C4', reference: '26200', date: '02/01/2026', lines: [{ account: 'A', amount: 1000 }, { account: 'B', amount: 2000 }] }  // total 3000
};

var receipts = [
  { key: 'R1', date: '2026-07-05', customerKey: 'C1', allocations: [{ invoice: 'I1', amount: 2300 }] }, // full -> A 1500.00
  { key: 'R2', date: '2026-07-06', customerKey: 'C2', allocations: [{ invoice: 'I2', amount: 400 }] },  // partial -> A 400.00
  { key: 'R3', date: '2026-07-07', customerKey: 'C1', allocations: [{ invoice: 'I3', amount: 1000 }] }, // partial -> A 1000*3000/4000 = 750.00
  { key: 'R4', date: '2026-07-08', customerKey: 'C3', directs: [{ account: 'A', customerKey: 'C3', amount: 500 }] }, // direct income
  { key: 'R5', date: '2026-07-09', customerKey: 'C9', allocations: [{ invoice: 'IX', amount: 999 }] }, // unknown invoice
  { key: 'R6', date: '2026-07-10', customerKey: 'C4', allocations: [{ invoice: 'I4', amount: 1000 }] }  // partial -> A 1000*1000/3000 = 333.33
];

var res = CB.compute(receipts, invoicesByKey, { accounts: sel });

eq('R1 full payment -> A', pick(res.rows, 'C1', '25783'), 1500);
eq('R2 partial -> A', pick(res.rows, 'C2', '25999'), 400);
eq('R3 partial proportional -> A', pick(res.rows, 'C1', '26100'), 750);
eq('R4 direct income -> A', pick(res.rows, 'C3', '(direct)'), 500);
eq('R6 partial rounding -> A (333.33)', pick(res.rows, 'C4', '26200'), 333.33);
eq('unknown invoice tracked', res.stats.unknownInvoices.length, 1);
eq('unknown invoice is IX', res.stats.unknownInvoices[0], 'IX');

var grandExpected = 1500 + 400 + 750 + 500 + 333.33; // 3483.33
var sum = res.rows.reduce(function (s, r) { return CB.round2(s + r.amount); }, 0);
eq('grand total of rows', sum, grandExpected);

// Hand off to the render engine
var names = { account: { A: 'Client Retainer Charges - Monthly' }, customer: { C1: '210001 - ALPHA', C2: '210002 - BETA', C3: '210003 - GAMMA', C4: '210004 - DELTA' } };
var ledger = CB.toLedgerRows(res.rows, names);
var report = E.transform(ledger);
eq('engine: one account', report.summary.accountCount, 1);
eq('engine: grand gross', report.summary.grossPositive, grandExpected);
eq('engine: distinct clients', report.summary.clientsWithCollections, 4); // C1,C2,C3,C4
eq('engine: C1 subtotal (1500+750)', clientAmt(report, 'Client Retainer Charges - Monthly', '210001 - ALPHA'), 2250);

// Credit note reduces (sign -1)
var cnRows = CB.compute([{ key: 'CN1', date: '2026-07-11', allocations: [{ invoice: 'I2', amount: 1000, customerKey: 'C2' }] }], invoicesByKey, { accounts: sel, sign: -1 }).rows;
eq('credit note negative', cnRows[0].amount, -1000);

console.log(fails ? ('\n' + fails + ' FAILED') : '\nALL PASSED');
process.exit(fails ? 1 : 0);

function pick(rows, cust, inv) {
  var r = rows.filter(function (x) { return x.customerKey === cust && String(x.invoice) === String(inv); });
  return r.length ? r.reduce(function (s, x) { return s + x.amount; }, 0) : undefined;
}
function clientAmt(report, acctName, cust) {
  var a = report.accounts.filter(function (x) { return x.account === acctName; })[0];
  if (!a) return undefined;
  var c = a.clients.filter(function (x) { return x.customer === cust; })[0];
  return c ? c.amount : undefined;
}
