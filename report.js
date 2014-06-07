/*
Usage examples:

node report.js PERSONAL_ACCESS_TOKEN
node report.js PERSONAL_ACCESS_TOKEN output_file_name.csv
*/

var fs = require('fs'),
    SquareConnect = require('square-connect'),
    Q = require('q');

var accessToken;
if (!accessToken) {
  if (process.argv.length > 2) {
    accessToken = process.argv[2];
  } else {
    throw new Error('Specify an access token!');
  }
}
var square = new SquareConnect(accessToken);

var outputLines = [];

// CSV headers
var fieldNames = ['Timestamp',
  'Gross Sales',
  'Discounts',
  'Net Sales',
  'Tax',
  'Tip',
  'Total Collected',
  'Card - Swiped',
  'Card - Keyed',
  'Cash',
  'Other Tender',
  'Fees',
  'Net Total',
  'Payment ID',
  'Card Brand',
  'PAN Suffix',
  'Device Name',
  'Details'];
outputLines.push(fieldNames.join(','));

// Grab payments list
console.log('Fetching payments');
Q.ninvoke(square, 'api', 'me/payments')
.then(function(res) {
  var payments = res.data;
  console.log('Got ' + payments.length + ' payments');
  // Grab details for each payment
  return Q.all(payments.map(function(payment) {
    var deferred = Q.defer();
    console.log('Fetching payment ' + payment.id);
    square.api('me/payments/' + payment.id, function(err, res) {
      if (err) {
        deferred.reject(err);
      } else {
        console.log('Got payment ' + payment.id);
        deferred.resolve(res.data);
      }
    });
    return deferred.promise;
  }));
})
.then(function(payments) {
  // Format payment data
  payments.forEach(function(payment) {
    var values = [];
    values.push(payment.created_at);

    var netAmount = payment.total_collected_money.amount - payment.tax_money.amount - payment.tip_money.amount;
    var grossAmount = netAmount + payment.discount_money.amount;
    
    values.push(formatAmount(grossAmount));
    values.push(formatMoney(payment.discount_money));
    values.push(formatAmount(netAmount));
    values.push(formatMoney(payment.tax_money));
    values.push(formatMoney(payment.tip_money));
    values.push(formatMoney(payment.total_collected_money));
    var swipedAmount = 0, keyedAmount = 0, cashAmount = 0, otherAmount = 0;
    payment.tender.forEach(function(tender) {
      if (tender.type === 'CREDIT_CARD') {
        if (tender.entry_method === 'SWIPED') {
          swipedAmount += tender.total_money.amount;
        } else {
          keyedAmount += tender.total_money.amount;
        }        
      } else if (tender.type === 'CASH') {
        cashAmount += tender.total_money.amount;
      } else {
        otherAmount += tender.total_money.amount;
      }
    });
    values.push(formatAmount(swipedAmount));
    values.push(formatAmount(keyedAmount));
    values.push(formatAmount(cashAmount));
    values.push(formatAmount(otherAmount));
    values.push(formatMoney(payment.processing_fee_money));
    values.push(formatMoney(payment.net_total_money));
    values.push(payment.id);
    var tender = payment.tender[0];
    if (tender.type === 'CREDIT_CARD') {
      values.push(tender.card_brand);
      values.push(tender.pan_suffix);
    } else {
      values.push('');
      values.push('');
    }
    values.push(payment.device.name);
    values.push(payment.payment_url);

    outputLines.push(values.join(','));
  });

  var outputFileName = process.argv[3] || 'transactions.csv';
  console.log('Writing to ' + outputFileName);
  require('fs').writeFileSync(outputFileName, outputLines.join('\n'));
})
.done();


// helper functions below

function formatMoney(money) {
  return formatAmount(money.amount);
}

function formatAmount(amount) {
  var parts = ['$'];
  if (amount < 0) {
    parts.push('-');
  }
  parts.push((amount/100).toFixed(2));
  return parts.join('');
}
