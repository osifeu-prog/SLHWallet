const fs = require('fs');

const cache = {};

function loadLang(lang) {
  if (!cache[lang]) {
    const raw = fs.readFileSync(`./locales/${lang}.json`, 'utf8');
    cache[lang] = JSON.parse(raw);
  }
  return cache[lang];
}

function t(users, chatId, key, params = {}) {
  const lang = (users[chatId] && users[chatId].lang) || 'he';
  const dict = loadLang(lang);
  let text = dict[key] || key;

  for (const p in params) {
    text = text.replace(`{{${p}}}`, params[p]);
  }

  return text;
}

module.exports = { t };
