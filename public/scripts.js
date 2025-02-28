
let startTime = new Date();

const baseServer = "https://mainnet-idx.4160.nodely.dev"
const port = 443;
const token = ""; //{ 'X-API-key': '' };

const indexerClient = new algosdk.Indexer("", baseServer, token);

let oraAssetId = 1284444444;		// Orange assetId
let oraMiningAppV1 = 1284326447;	// Orange Mining (V1.1)  

let lastRound = 0;  // avoid query same round
// TODO: let removeAfterRounds = 20; // 20 rounds = 1 minute (roundtime 3s = 20 rounds/min )

let running = true; // stop querying indexer

let oraMiningTxs = [];
let oraMinedTxs = [];

var uniqueMinedTxs = [];
var uniqueMiningTxs = [];


$(document).on('click', '.toggle-play', function () {
  $(this).children().toggleClass("fa-pause fa-play");
  running = !running;
});

$(document).on('click', '.toggle-tables', function () {
  $(this).children().toggleClass("fa-eye fa-eye-slash");
  $('#txsTableDiv').css('display') == 'block' ? $('#txsTableDiv').css('display', 'none') : $('#txsTableDiv').css('display', 'block')
});

$(document).on('click', '.toggle-chart', function () {
  $(this).children().toggleClass("fa-eye fa-eye-slash");
  $('#3d-graph').css('display') == 'block' ? $('#3d-graph').css('display', 'none') : $('#3d-graph').css('display', 'block')
});

class EventEmitter {

  constructor() {
    this.running = true;
    this.events = {};
  }

  subscribe(eventName, fn) {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }

    this.events[eventName].push(fn);

    return () => {
      this.events[eventName] = this.events[eventName].filter(eventFn => fn !== eventFn);
    }
  }

  emit(eventName, data) {
    const event = this.events[eventName];
    if (event) {
      event.forEach(fn => {
        fn.call(null, data);
      });
    }
  }
}


async function queryIndexer() {

  let txs = [];

  if (!running) {
    console.log(`Paused. Not querying indexer`);
    // Repeat 
    setTimeout(() => queryIndexer(), 2000);

    return;
  }

  // Get round
  round = (await indexerClient.makeHealthCheck().do()).round

  // New round
  if (lastRound !== round) {
    lastRound = round;

    // ---------------- 
    // Orange winner payments
    // Get txs
    res = await indexerClient.lookupAssetTransactions(oraAssetId).round(round).do();
    txs = res.transactions;
    txs.map((tx) => {

      // Block brings too much info
      //block = await indexerClient.lookupBlock(round).do()
      //block.transactions.map((tx) => {

      // Mining V1.1 - Mined ORA
      if (tx['txType'] == 'appl' && tx['applicationTransaction']['applicationId'] == oraMiningAppV1) {
        if (tx['innerTxns'] !== undefined) {
          tx['innerTxns'].map((inner) => {
            let innerTx = inner['assetTransferTransaction'];
            emitter.emit('oraMined', {
              round: round,
              sender: inner['sender'],
              receiver: innerTx['receiver'],
              amount: innerTx['amount']
            });
          })
        }
      }
    })

    // ---------------- 
    // Orange mining txs - app calls
    // Get round transations interacting with oraMiningAppV1
    res = await indexerClient.searchForTransactions().round(round).applicationID(oraMiningAppV1).do();
    txs = res.transactions;

    var feesPerSender = [];
    noInnerTxs = txs.filter((tx) => { return tx['innerTxns'] == undefined }).map((tx) => { return { sender: tx.sender, fees: Number(tx.fee) } })
    feesPerSender = feesPerSender.concat(noInnerTxs);

    // Inner txs
    innerTxs = txs.filter((tx) => { return tx['innerTxns'] !== undefined }).map((tx) => tx['innerTxns'])

    //console.log(`searchForTransactions (txs/inner): ${txs.length}/${innerTxs.length} `)

    allTxsInnerTxs = [];
    innerTxs.map((inners) => inners.map((inner) => allTxsInnerTxs.push({ sender: inner['sender'], fee: inner['fee'] })))

    allTxsInnerTxs.reduce(function (res, value) {
      if (!res[value.sender]) {
        res[value.sender] = { sender: value.sender, fees: 0 };
        feesPerSender.push(res[value.sender])
      }
      res[value.sender].fees += Number(value.fee);
      return res;
    }, {});

    feesPerSender.map((mining) => {
      emitter.emit('oraMining', {
        round: round,
        sender: mining.sender,
        fees: mining.fees
      });
    })

  }

  // Repeat query
  setTimeout(() => queryIndexer(), 2000);
}

function short(str) {
  return str.substring(0, 5) + '...' + str.substring(str.length - 5)
}

function sortByProperty(property) {
  return function (a, b) {
    if (a[property] > b[property])
      return 1;
    else if (a[property] < b[property])
      return -1;

    return 0;
  }
}

// To have leading zero digits in strings.
function pad(num, size) {
  var s = num + "";
  while (s.length < size) s = "0" + s;
  return s;
}

// ms to time/duration
msToDuration = function (ms) {
  var seconds = ms / 1000;
  var hh = Math.floor(seconds / 3600),
    mm = Math.floor(seconds / 60) % 60,
    ss = Math.floor(seconds) % 60,
    mss = ms % 1000;

  if (hh > 0) {
    return pad(hh, 2) + ':' + pad(mm, 2) + ':' + pad(ss, 2);
  } else {
    return pad(mm, 2) + ' : ' + pad(ss, 2)
  }

}

function updateStats() {

  // Update stats
  let currentTime = new Date();
  let elapsed = msToDuration(currentTime - startTime);
  $('#elapsed').text(elapsed);
  $('#miners').text(uniqueMiningTxs.length);
  $('#tps').text((oraMiningTxs.length / (((new Date) - startTime) / 1000)).toFixed(2));


  setTimeout(() => {
    updateStats();
  }, 1000);


}
updateStats();


let emitter = new EventEmitter();

emitter.subscribe('oraMining', data => {
  //console.log(data);

  let round = Number(data.round);
  let sender = data.sender;
  let fees = data.fees;

  oraMiningTxs.push(data);

  uniqueMiningTxs = [];
  oraMiningTxs.reduce(function (res, value) {
    if (!res[value.sender]) {
      res[value.sender] = { sender: value.sender, fees: 0 };
      uniqueMiningTxs.push(res[value.sender])
    }
    res[value.sender].fees += value.fees;
    return res;
  }, {});

  uniqueMiningTxs = uniqueMiningTxs.sort(sortByProperty('fees'));

  //console.log(uniqueMinedTxs);

  $("#tblMiningTotals > tbody").empty();
  uniqueMiningTxs.map((juicer) => {

    receiver = juicer.sender;
    // TODO: miner address <> payout address
    beneficiary = receiver;
    if (receiver == 'J5WY7ZMGCEXBW6UJW6NXWZAV7QFLBCWDGFGZOQHLTZHLWVCHZWQL4NXHWU') {
      beneficiary = 'SKUNK6YC62GXISEHI3THRANBZ57BF7LZCQAQHDCZE3I5SEY3ECKGKGFCB4';
    }

    juicerOraEarnings = oraMinedTxs.filter((miner) => miner.receiver == beneficiary);
    juicedOra = juicerOraEarnings.length == 0 ? 0 : juicerOraEarnings.map(p => p.amount).reduce((a, b) => a + b, 0);



    var row = $('<tr><td style="width:200px;">' + short(juicer.sender) + (receiver == beneficiary ? '' : '(' + short(beneficiary).substring(0, 5) + ')') + '</td><td>' + (juicer.fees / 10 ** 6).toFixed(6) * 1 + '</td><td>' + juicedOra.toFixed(4) * 1 + '</td></tr>').hide();
    $('#tblMiningTotals > tbody').prepend($(row));
    $(row).fadeIn("slow");
  })

  var row = $('<tr><td style="width:200px;">' + round + '</td><td>' + short(sender) + '</td><td>' + (fees / 10 ** 6).toFixed(6) * 1 + '</td></tr>').hide();
  $('#tblMining > tbody').prepend($(row));
  $(row).fadeIn("slow");

  addNode('JP3ENKDQC2BOYRMLFGKBS7RB2IVNF7VNHCFHVTRNHOENRQ6R4UN7MCNXPI', round, 'Orange Mining v1.1')
  addNode(sender, round, short(sender));
  addLink(sender, 'JP3ENKDQC2BOYRMLFGKBS7RB2IVNF7VNHCFHVTRNHOENRQ6R4UN7MCNXPI');

  $('.loader').remove();

})

emitter.subscribe('oraMined', data => {

  //console.log(data)

  let round = Number(data.round);
  let sender = data.sender;
  let receiver = data.receiver;
  let amount = (Number(data.amount) / 10 ** 8).toFixed(5) * 1;

  oraMinedTxs.push({ round: round, sender: sender, receiver: receiver, amount: amount })


  uniqueMinedTxs = [];
  oraMinedTxs.reduce(function (res, value) {
    if (!res[value.receiver]) {
      res[value.receiver] = { receiver: value.receiver, amount: 0 };
      uniqueMinedTxs.push(res[value.receiver])
    }
    res[value.receiver].amount += value.amount;
    return res;
  }, {});

  uniqueMinedTxs = uniqueMinedTxs.sort(sortByProperty('amount'));

  //console.log(uniqueMinedTxs);

  let id = receiver;

  let shortSender = short(sender)
  let shortReceiver = short(receiver)

  if (sender == 'JP3ENKDQC2BOYRMLFGKBS7RB2IVNF7VNHCFHVTRNHOENRQ6R4UN7MCNXPI') { shortSender = 'Orange Mining v1.1' }

  var row = $('<tr><td style="width:200px;">' + round + '</td><td>' + shortReceiver + '</td><td>' + amount + '</td></tr>').hide();
  $('#txsMined > tbody').prepend($(row));
  $(row).fadeIn("slow");


  addNode(sender, round, shortSender);

  addNode(receiver, round, shortReceiver);

  addLink(sender, receiver);


});

function addNode(id, round, text) {
  if (!Graph) return;
  const { nodes, links } = Graph.graphData();

  nodeExists = nodes.filter(function (el) { return el.id === id }).length > 0;
  if (nodeExists) return;

  Graph.graphData({
    nodes: [...nodes, { id, round, text }],
    links: [...links]
  });

}

function addLink(sender, receiver) {
  if (!Graph) return;
  const { nodes, links } = Graph.graphData();

  linkExists = links.filter(function (el) { return el.source.id === sender && el.target.id === receiver }).length > 0;
  if (linkExists) return;

  Graph.graphData({
    nodes: [...nodes],
    links: [...links, { source: sender, target: receiver }]
  });

}

queryIndexer()
