const fs = require('fs');

const TRANSACTIONS_FILE = './transactions.json';
const MEAH_FILE = './meah_balances.json';

// --- Load transactions ---
let transactions = [];
try {
  if (fs.existsSync(TRANSACTIONS_FILE)) {
    transactions = JSON.parse(fs.readFileSync(TRANSACTIONS_FILE, 'utf8') || '[]');
  }
} catch {
  transactions = [];
}

// --- Load MEAH balances ---
let meahBalances = {};
try {
  if (fs.existsSync(MEAH_FILE)) {
    meahBalances = JSON.parse(fs.readFileSync(MEAH_FILE, 'utf8') || '{}');
  }
} catch {
  meahBalances = {};
}

// --- Save helpers ---
function saveTransactions() {
  fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify(transactions, null, 2));
}

function saveMeah() {
  fs.writeFileSync(MEAH_FILE, JSON.stringify(meahBalances, null, 2));
}

// --- MEAH functions ---
function getMeahBalance(chatId) {
  return meahBalances[chatId] || 0;
}

function addMeah(chatId, amount) {
  meahBalances[chatId] = getMeahBalance(chatId) + amount;
  saveMeah();
}

function subMeah(chatId, amount) {
  meahBalances[chatId] = getMeahBalance(chatId) - amount;
  saveMeah();
}

// --- Transaction logging ---
function logTransaction(entry) {
  transactions.push({
    ...entry,
    timestamp: new Date().toISOString()
  });
  saveTransactions();
}

module.exports = {
  getMeahBalance,
  addMeah,
  subMeah,
  logTransaction
};
