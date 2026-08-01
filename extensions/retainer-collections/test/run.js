#!/usr/bin/env node
/* Regression test for engine.js against a real CSV export of a retainer
   account drill-down (cash basis). No data is committed to the repo.

   Usage:  node test/run.js "/path/to/detail.csv"
*/
'use strict';
var fs = require('fs');
var path = require('path');
var E = require(path.join(__dirname, '..', 'src', 'engine.js'));

var file = process.argv[2];
if (!file) { console.error('Usage: node test/run.js <detail.csv>'); process.exit(2); }

// RFC4180-ish CSV parser (quotes, embedded commas/newlines)
function parseCSV(text) {
  var rows = [], row = [], f = '', i = 0, q = false;
  text = text.replace(/\r\n?/g, '\n');
  while (i < text.length) {
    var c = text[i];
    if (q) { if (c === '"') { if (text[i+1] === '"') { f += '"'; i += 2; continue; } q = false; i++; continue; } f += c; i++; continue; }
    if (c === '"') { q = true; i++; continue; }
    if (c === ',') { row.push(f); f = ''; i++; continue; }
    if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; i++; continue; }
    f += c; i++;
  }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  return rows;
}

var table = parseCSV(fs.readFileSync(file, 'utf8'));
var header = table[0].map(function (h) { return String(h).toLowerCase().trim(); });
function col(names) { for (var i = 0; i < header.length; i++) for (var j = 0; j < names.length; j++) if (header[i].indexOf(names[j]) > -1) return i; return -1; }
var iTx = col(['transaction','reference','invoice']), iCust = col(['customer','contact','client']),
    iDesc = col(['description','item']), iDeb = col(['debit']), iCred = col(['credit']), iDate = col(['date']);

var rows = table.slice(1).filter(function (r) { return r.length > 1; }).map(function (r) {
  return { date: iDate>-1?r[iDate]:'', transaction: r[iTx], customer: iCust>-1?r[iCust]:'',
           description: iDesc>-1?r[iDesc]:'', debit: r[iDeb], credit: r[iCred] };
});

var rep = E.transform(rows);
var s = rep.summary;
console.log('rows                :', rows.length);
console.log('clients w/ coll     :', s.clientsWithCollections);
console.log('invoices w/ coll    :', s.invoicesWithCollections);
console.log('gross collections   :', s.grossPositive.toLocaleString());
console.log('adjustments         :', s.adjustments.toLocaleString());
console.log('NET (P&L figure)    :', s.net.toLocaleString());
console.log('total credit        :', s.totalCredit.toLocaleString());
console.log('total debit         :', s.totalDebit.toLocaleString());
console.log('accounts            :', s.accountCount, '(' + rep.accounts.map(function(a){return (a.account||'(unnamed)')+' '+a.summary.net.toLocaleString();}).join(' | ') + ')');

var ledgerNet = E.round2(s.totalCredit - s.totalDebit);
var reportNet = E.round2(s.grossPositive + s.adjustments);
var ok = Math.abs(ledgerNet - reportNet) < 0.005 && Math.abs(reportNet - s.net) < 0.005;
console.log('\nreconciliation      :', ok ? 'PASS — report ties to ledger' : 'FAIL');
process.exit(ok ? 0 : 1);
