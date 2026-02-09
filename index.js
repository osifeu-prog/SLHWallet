require('dotenv').config({ override: true });
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');
const { ethers } = require('ethers');
const abi = require('./abi.json');
const { t } = require('./i18n');
const log = require('./logger');
const ledger = require('./ledger');

// ENV
const token = process.env.TELEGRAM_BOT_TOKEN;
const rpcUrl = process.env.BSC_RPC;
const botPrivateKey = process.env.PRIVATE_KEY;
const contractAddress = process.env.CONTRACT_ADDRESS;

// Community & donate config
const INVESTORS_GROUP_LINK = 'https://t.me/+HIzvM8sEgh1kNWY0';
const TON_DONATE_ADDRESS = 'UQCr743gEr_nqV_0SBkSp3CtYS_15R3LDLBvLmKeEv7XdGvp';
const EVM_DONATE_ADDRESS = '0xb80cc6c9815af7f5d720a194711e0a3d188c6ef8';
const DEV_CONTACT = 'Kaufman (Osif Ungar)';

// כאן תכניס את ה-chatId שלך
const DEV_CHAT_ID = 224223270;

// Provider + bot wallet + contract
const provider = new ethers.JsonRpcProvider(rpcUrl);
const botWallet = new ethers.Wallet(botPrivateKey, provider);
const contract = new ethers.Contract(contractAddress, abi, botWallet);

// Users storage
const USERS_FILE = './users.json';
let users = {};
if (fs.existsSync(USERS_FILE)) {
  try {
    users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8') || '{}');
  } catch (e) {
    console.error('Error reading users.json, using empty structure.');
    users = {};
  }
}

function saveUsers() {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Create new wallet for user
function createNewWallet() {
  const wallet = ethers.Wallet.createRandom();
  return {
    address: wallet.address,
    privateKey: wallet.privateKey
  };
}

// Telegram bot
const bot = new TelegramBot(token, { polling: true });

bot.on('polling_error', (err) => {
  log.error('Polling error', { err });
});

// /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  if (!users[chatId]) {
    users[chatId] = { lang: 'he' };
    saveUsers();
  }
  log.info('User started bot', { chatId });

  const text = t(users, chatId, 'start');
  bot.sendMessage(chatId, text);
});

// /help
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  const text = t(users, chatId, 'help');
  bot.sendMessage(chatId, text);
});

// /setlang
bot.onText(/\/setlang/, async (msg) => {
  const chatId = msg.chat.id;
  const text = t(users, chatId, 'choose_lang');
  bot.sendMessage(chatId, text);
});

// language selection
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();

  if (!users[chatId]) {
    users[chatId] = { lang: 'he' };
    saveUsers();
  }

  if (['he', 'en', 'ru'].includes(text.toLowerCase())) {
    users[chatId].lang = text.toLowerCase();
    saveUsers();
    bot.sendMessage(chatId, t(users, chatId, 'lang_set', { lang: text.toLowerCase() }));
    log.info('Language changed', { chatId, lang: text.toLowerCase() });
    return;
  }
});

// wallet type selection & steps
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();

  if (!users[chatId]) {
    users[chatId] = { lang: 'he' };
    saveUsers();
  }

  const user = users[chatId];

  if (/^\/(start|help|balance|send|setlang|donate|community|learn|deposit|meah_balance|request|meah_send)/.test(text)) {
    return;
  }

  if (user.step === 'awaiting_private_key') {
    const pk = text;
    try {
      const w = new ethers.Wallet(pk);
      users[chatId] = {
        ...users[chatId],
        walletType: 'imported',
        address: w.address,
        privateKey: pk,
        step: null
      };
      saveUsers();
      bot.sendMessage(chatId, t(users, chatId, 'wallet_imported', { address: w.address }));
      log.info('Wallet imported', { chatId, address: w.address });
    } catch (e) {
      bot.sendMessage(chatId, t(users, chatId, 'invalid_key'));
      log.warn('Invalid private key', { chatId });
    }
    return;
  }

  if (user.step === 'awaiting_external_address') {
    const addr = text;
    if (!ethers.isAddress(addr)) {
      bot.sendMessage(chatId, t(users, chatId, 'invalid_address'));
      return;
    }
    users[chatId] = {
      ...users[chatId],
      walletType: 'external',
      address: addr,
      step: null
    };
    saveUsers();
    bot.sendMessage(chatId, t(users, chatId, 'external_address_saved', { address: addr }));
    log.info('External address saved', { chatId, address: addr });
    return;
  }

  if (!user.walletType && ['1', '2', '3'].includes(text)) {
    if (text === '1') {
      const w = createNewWallet();
      users[chatId] = {
        ...users[chatId],
        walletType: 'managed',
        address: w.address,
        privateKey: w.privateKey,
        step: null
      };
      saveUsers();
      bot.sendMessage(chatId, t(users, chatId, 'wallet_created', {
        address: w.address,
        privateKey: w.privateKey
      }));
      log.info('Managed wallet created', { chatId, address: w.address });
    } else if (text === '2') {
      users[chatId].step = 'awaiting_private_key';
      saveUsers();
      bot.sendMessage(chatId, t(users, chatId, 'import_key'));
      log.info('Awaiting private key', { chatId });
    } else if (text === '3') {
      users[chatId].step = 'awaiting_external_address';
      saveUsers();
      bot.sendMessage(chatId, t(users, chatId, 'external_address_ask'));
      log.info('Awaiting external address', { chatId });
    }
    return;
  }
});

// /balance
bot.onText(/\/balance/, async (msg) => {
  const chatId = msg.chat.id;
  const user = users[chatId];

  if (!user || !user.address) {
    return bot.sendMessage(chatId, t(users, chatId, 'no_wallet'));
  }

  try {
    const address = user.address;

    const bnbBalanceWei = await provider.getBalance(address);
    const bnbBalance = ethers.formatEther(bnbBalanceWei);

    const tokenBalance = await contract.balanceOf(address);
    const decimals = await contract.decimals();
    const humanTokenBalance = Number(tokenBalance) / 10 ** Number(decimals);

    const name = await contract.name();
    const symbol = await contract.symbol();

    bot.sendMessage(
      chatId,
      t(users, chatId, 'balance', {
        address,
        bnb: bnbBalance,
        tokenName: name,
        symbol,
        tokenBalance: humanTokenBalance
      })
    );
    log.info('Balance checked', { chatId, address });
  } catch (err) {
    log.error('Balance error', { chatId, err });
    bot.sendMessage(chatId, t(users, chatId, 'balance_error'));
  }
});

// /send <address> <amount>
bot.onText(/\/send (.+) (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const user = users[chatId];

  if (!user || !user.address) {
    return bot.sendMessage(chatId, t(users, chatId, 'no_wallet'));
  }

  if (user.walletType === 'external') {
    return bot.sendMessage(chatId, t(users, chatId, 'send_external_block'));
  }

  const to = match[1];
  const amountStr = match[2];

  if (!ethers.isAddress(to)) {
    return bot.sendMessage(chatId, t(users, chatId, 'send_invalid_address'));
  }

  try {
    const decimals = await contract.decimals();
    const amount = ethers.parseUnits(amountStr, decimals);

    const senderWallet =
      user.walletType === 'managed' || user.walletType === 'imported'
        ? new ethers.Wallet(user.privateKey, provider)
        : botWallet;

    const contractWithSigner = contract.connect(senderWallet);

    const tx = await contractWithSigner.transfer(to, amount);
    bot.sendMessage(chatId, t(users, chatId, 'send_sending', { hash: tx.hash }));
    log.info('Send tx submitted', { chatId, from: senderWallet.address, to, amount: amountStr, hash: tx.hash });

    const receipt = await tx.wait();
    if (receipt.status === 1) {
      bot.sendMessage(chatId, t(users, chatId, 'send_success'));
      log.info('Send tx success', { chatId, hash: tx.hash });

      ledger.logTransaction({
        type: 'SLH_TRANSFER',
        network: 'BSC',
        fromChatId: chatId,
        fromAddress: senderWallet.address,
        toAddress: to,
        amount: amountStr,
        txHash: tx.hash
      });
    } else {
      bot.sendMessage(chatId, t(users, chatId, 'send_fail'));
      log.warn('Send tx failed', { chatId, hash: tx.hash });
    }
  } catch (err) {
    log.error('Send tx error', { chatId, err });
    bot.sendMessage(chatId, t(users, chatId, 'send_error'));
  }
});

// /deposit
bot.onText(/\/deposit/, async (msg) => {
  const chatId = msg.chat.id;
  const user = users[chatId];

  if (!user || !user.address) {
    return bot.sendMessage(chatId, t(users, chatId, 'no_wallet'));
  }

  try {
    const symbol = await contract.symbol();
    bot.sendMessage(chatId, t(users, chatId, 'deposit', {
      address: user.address,
      symbol
    }));
    log.info('Deposit address shown', { chatId, address: user.address });
  } catch (err) {
    log.error('Deposit error', { chatId, err });
    bot.sendMessage(chatId, t(users, chatId, 'balance_error'));
  }
});

// /community
bot.onText(/\/community/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, t(users, chatId, 'community', {
    link: INVESTORS_GROUP_LINK
  }));
  log.info('Community link sent', { chatId });
});

// /donate
bot.onText(/\/donate/, async (msg) => {
  const chatId = msg.chat.id;

  const parts = [
    t(users, chatId, 'donate_intro'),
    '',
    t(users, chatId, 'donate_ton', { tonAddress: TON_DONATE_ADDRESS }),
    '',
    t(users, chatId, 'donate_evm', { evmAddress: EVM_DONATE_ADDRESS }),
    '',
    t(users, chatId, 'donate_meah'),
    '',
    t(users, chatId, 'donate_tax'),
    '',
    t(users, chatId, 'donate_contact', { devContact: DEV_CONTACT }),
    '',
    t(users, chatId, 'dev_signature')
  ];

  bot.sendMessage(chatId, parts.join('\n'));
  log.info('Donate info sent', { chatId });
});

// /learn
bot.onText(/\/learn/, async (msg) => {
  const chatId = msg.chat.id;

  const parts = [
    t(users, chatId, 'learn_intro'),
    '',
    t(users, chatId, 'learn_points'),
    '',
    t(users, chatId, 'learn_more'),
    '',
    t(users, chatId, 'dev_signature')
  ];

  bot.sendMessage(chatId, parts.join('\n'));
  log.info('Learn info sent', { chatId });
});

// /meah_balance
bot.onText(/\/meah_balance/, (msg) => {
  const chatId = msg.chat.id;
  const bal = ledger.getMeahBalance(chatId);
  bot.sendMessage(chatId, `היתרה הפנימית שלך במטבע MEAH: ${bal}`);
});

// /request <amount>
bot.onText(/\/request (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const amount = Number(match[1]);

  if (isNaN(amount) || amount <= 0) {
    return bot.sendMessage(chatId, 'סכום לא תקין.');
  }

  ledger.logTransaction({
    type: 'MEAH_REQUEST',
    fromChatId: chatId,
    username: msg.from.username || null,
    amount,
    status: 'PENDING'
  });

  bot.sendMessage(chatId, `הבקשה שלך ל‑${amount} MEAH נרשמה.`);
});

// /meah_send <chatId> <amount> (dev only)
bot.onText(/\/meah_send (\d+) (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  if (chatId !== DEV_CHAT_ID) {
    return bot.sendMessage(chatId, 'הפקודה הזו זמינה רק למפתח.');
  }

  const target = Number(match[1]);
  const amount = Number(match[2]);

  if (isNaN(amount) || amount <= 0) {
    return bot.sendMessage(chatId, 'סכום לא תקין.');
  }

  ledger.addMeah(target, amount);

  ledger.logTransaction({
    type: 'MEAH_TRANSFER_INTERNAL',
    fromChatId: chatId,
    toChatId: target,
    amount
  });

  bot.sendMessage(chatId, `נשלחו ${amount} MEAH ל‑${target}.`);

  try {
    bot.sendMessage(target, `קיבלת ${amount} MEAH מהמפתח.`);
  } catch {}
});

console.log('הבוט רץ... (SLH MEAH multi-language, donate, community, learn, ledger ready)');
