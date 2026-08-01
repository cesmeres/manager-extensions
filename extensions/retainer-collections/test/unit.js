#!/usr/bin/env node
/* Synthetic unit tests for engine.js — multi-account grouping, subtotals,
   grand total, zero-drop, reversals. No external data.
     node test/unit.js
*/
'use strict';
var path = require('path');
var E = require(path.join(__dirname, '..', 'src', 'engine.js'));

var fails = 0;
function eq(label, got, want) {
  var ok = Math.abs((got || 0) - want) < 0.005 || got === want;
  console.log((ok ? '  ok  ' : ' FAIL ') + label + '  got=' + got + ' want=' + want);
  if (!ok) fails++;
}

var rows = [
  // account: Retainer - Monthly
  { account: 'Client Retainer Charges - Monthly', transaction: 'Sales Invoice — A1 — 01/01/2026', customer: '210001 - CLIENT X', credit: 1000 },
  { account: 'Client Retainer Charges - Monthly', transaction: 'Sales Invoice — A1 — 01/01/2026', customer: '210001 - CLIENT X', debit: 0 },   // boundary
  { account: 'Client Retainer Charges - Monthly', transaction: 'Sales Invoice — A2 — 02/01/2026', customer: '210002 - CLIENT Y', credit: 500 },
  { account: 'Client Retainer Charges - Monthly', transaction: 'Sales Invoice — A3 — 03/01/2026', customer: '210009 - ZERO', debit: 300, credit: 300 }, // net 0 -> drop
  // account: Retainer - Quarterly
  { account: 'Client Retainer Charges - Quarterly', transaction: 'Sales Invoice — B1 — 01/01/2026', customer: '210001 - CLIENT X', credit: 1500 },
  { account: 'Client Retainer Charges - Quarterly', transaction: 'Sales Invoice — B2 — 02/01/2026', customer: '210003 - CLIENT Z', debit: 200 } // net -200 -> reversal
];

var rep = E.transform(rows);
console.log('accounts:', rep.accounts.map(function (a) { return a.account; }).join(' | '));

eq('account count', rep.summary.accountCount, 2);

var monthly = rep.accounts.filter(function (a) { return /Monthly/.test(a.account); })[0];
var quarterly = rep.accounts.filter(function (a) { return /Quarterly/.test(a.account); })[0];

eq('Monthly gross', monthly.summary.grossPositive, 1500);
eq('Monthly paid invoices', monthly.summary.invoicesWithCollections, 2);
eq('Monthly clients', monthly.summary.clientsWithCollections, 2);
eq('Monthly zero dropped', monthly.summary.zeroCount, 1);
eq('Monthly adjustments', monthly.summary.adjustments, 0);

eq('Quarterly gross', quarterly.summary.grossPositive, 1500);
eq('Quarterly adjustments', quarterly.summary.adjustments, -200);
eq('Quarterly net', quarterly.summary.net, 1300);
eq('Quarterly paid invoices', quarterly.summary.invoicesWithCollections, 1);

eq('GRAND gross', rep.summary.grossPositive, 3000);
eq('GRAND adjustments', rep.summary.adjustments, -200);
eq('GRAND net', rep.summary.net, 2800);
eq('GRAND paid invoices', rep.summary.invoicesWithCollections, 3);
eq('GRAND distinct clients (paid)', rep.summary.clientsWithCollections, 2); // X, Y (Z is reversal-only)

// grandSummary over a subset (simulate ticking only Monthly)
var subset = E.grandSummary([monthly]);
eq('subset (Monthly only) net', subset.net, 1500);

// single-account fallback (no account column) -> one group labelled defaultAccount
var rep2 = E.transform(
  [{ transaction: 'Sales Invoice — C1 — 01/01/2026', customer: 'X', credit: 100 }],
  { defaultAccount: 'Retainer' }
);
eq('single-account count', rep2.summary.accountCount, 1);
eq('single-account label matches', rep2.accounts[0].account === 'Retainer' ? 1 : 0, 1);

console.log(fails ? ('\n' + fails + ' FAILED') : '\nALL PASSED');
process.exit(fails ? 1 : 0);
