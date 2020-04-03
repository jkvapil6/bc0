const Client = require("./js/Client");
const Indicators = require("./js/Indicators");
const StrategyManager = require("./js/StrategyManager");
const Chart = require("chart.js");
const Orders = require("./js/Orders");
const SymbolChart = require("./js/View/SymbolChart");

const btnConnect = document.getElementById("btnConnect");
const btnDisconnect = document.getElementById("btnDisconnect");
const inReqPort = document.getElementById("inReqPort");
const inPullPort = document.getElementById("inPullPort");
const btnBuy = document.getElementById("btnBuy");
const btnClose = document.getElementById("btnClose");

const tabOpenedTrades = document.querySelector("#tabOpenedTrades tbody");
const canvasChart = document.querySelector("#myChart");
const selectSymbol = document.getElementById("selectSymbol");

// MetaTrader Client
let client;

// Need reference for clearing when disconnected
let symbolReqInterval;

// Graph settings
const MAX_CHART_X_VALUES = 25;

// Every <n> ms will be requests send
const timeFrame = 500;

// Init Chart
const chartSettings = SymbolChart.getSetting();
const priceChart = new Chart(canvasChart, chartSettings);

//////////////// Setup Database //////////////////

///
/// Knex: https://devhints.io/knex
///
const db = require("knex")({
  client: "sqlite3",
  connection: {
    filename: "./db"
  }
});

// let res = db("Symbol_EURUSD");

////////////////////////////////////////////////////////////////////////////

///
/// Saves price to SQLite Database
///
const savePriceToDb = (symbol, price, db) => {
  let res = db("symbol_" + symbol).insert({
    price: price
  });

  res.then(rows => {
    // console.log(`Inserted ${rows}. row into ${symbol} symbol table!`);
    // console.log("result:");
    // console.log(rows);
    // for (row of rows) {
    //   console.log(row.name);
    //   pResult.textContent += row.name + ", ";
    // }
  });
};

////////////////////////////////////////////////////////////////////////////

///
/// Prepares Strategy Manager
/// TODO : User defined indicators
///
const initStrategyManager = () => {
  //
  // Prepare indicators
  const indicators = [];

  indicators.push(
    {
      name: "ma15",
      dbLen: 15,
      f: Indicators.average(15)
    },
    {
      name: "ma3",
      dbLen: 3,
      f: Indicators.average(3)
    }
  );

  return new StrategyManager(client, db, indicators);
};

////////////////////////////////////////////////////////////////////////////

///
/// mainLoop keeps updating rates and opened trades every <timeFrame>
///
const mainLoop = (symbol, symbolArr, strategyManager) => {
  symbolReqInterval = setInterval(() => {
    //
    // Request for opened trades
    Orders.getOpenedTrades(client);
    //
    // Request for update symbol rates
    Orders.rates(client, symbol);
    //
    // Get opened trades
    let openedTrades = client.getOpenedTrades();
    //
    // Update trades HTML table
    SymbolChart.displayOpenedTrades(openedTrades);
    //
    // Get last price
    let lastPrice = symbolArr[symbolArr.length - 1];

    if (lastPrice != undefined) {
      //
      // Insert price to db
      savePriceToDb(symbol, lastPrice.getPrice(), db);

      if (symbolArr.length < 2) {
        //
        // Adjust chart scales
        SymbolChart.adjustChartScales(lastPrice.getPrice(), chartSettings);
      } else {
        //
        // Sends <prices> to all strategies
        strategyManager.sendEvent(openedTrades, symbolArr);
        //
        // Insert data, Adjust chart scales
        SymbolChart.updateChart(
          priceChart,
          symbolArr.length,
          chartSettings,
          lastPrice.getPrice()
        );
      }
    }
  }, timeFrame);
};

////////////////////////////////////////////////////////////////////////////

///
/// Connects to MT
///
const connectToMt = () => {
  // const reqPort = inReqPort.value;
  // const pullPort = inPullPort.value;

  const reqPort = "5555";
  const pullPort = "5556";

  // Disable possibility of multiple connection
  btnConnect.disabled = true;

  // Select market symbol (EURUSD)
  const symbol = selectSymbol.value;

  // Create new metatrader client && connects
  client = new Client(reqPort, pullPort);
  client.connect();

  // Create strategy manager which handles incomming events
  const strategyManager = initStrategyManager();

  // Create new strategy (id, symbol, usedIndicators)
  strategyManager.addStrategy(66, symbol, ["ma15"]);

  // Set monitorting symbol & get reference on the array
  const symbolArr = client.setSymbolMonitoring(symbol);

  mainLoop(symbol, symbolArr, strategyManager);
};

////////////////////////////////////////////////////////////////////////////

///
/// Client sends buy order
///
const buy = () => {
  let symbol = selectSymbol.value;

  if (client !== undefined && client.isConnected()) {
    Orders.buy(client, "Unique ID of strategy", symbol);
  } else {
    console.log("You have to be connected!");
  }
};

////////////////////////////////////////////////////////////////////////////

///
/// Function gets opened trades
///
const getOpenedTrades = () => {
  let symbol = selectSymbol.value;

  if (client !== undefined && client.isConnected()) {
    // Orders.closeOrder(client, ticket);
    /// TODO: add strategy
    // console.log("OPENED TRADES: ");
    // console.log(client.getOpenedTrades());
  } else {
    console.log("You have to be connected!");
  }
};

////////////////////////////////////////////////////////////////////////////

///
/// Disconnects from MT
///
const dissconnectFromMT = () => {
  console.log("Disconnecting..");
  client.disconnect();
  clearInterval(symbolReqInterval);
};

////////////////////////////// Set Listeners ///////////////////////////////

btnConnect.addEventListener("click", connectToMt);
btnDisconnect.addEventListener("click", dissconnectFromMT);
btnBuy.addEventListener("click", buy);
btnClose.addEventListener("click", getOpenedTrades);
