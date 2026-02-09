const tg = window.Telegram.WebApp;
tg.expand();

function getBalance() {
  tg.sendData(JSON.stringify({ action: "balance" }));
}

function openRequests() {
  tg.sendData(JSON.stringify({ action: "requests" }));
}

function openMarketplace() {
  tg.sendData(JSON.stringify({ action: "marketplace" }));
}

function openP2P() {
  tg.sendData(JSON.stringify({ action: "p2p" }));
}
