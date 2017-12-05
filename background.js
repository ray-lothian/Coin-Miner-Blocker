'use strict';

var cache = {};
chrome.tabs.onRemoved.addListener(id => delete cache[id]);

var block = {};
block.parse = content => content.trim().split('\n');
block.read = () => new Promise(resolve => chrome.storage.local.get({
  'rules': []
}, prefs => {
  if (prefs.rules.length) {
    resolve(prefs.rules);
  }
  else {
    resolve(fetch('data/assets/blacklist.txt').then(r => r.text()).then(block.parse));
  }
}));
block.observer = ({tabId, url}) => {
  cache[tabId] = cache[tabId] || [];
  cache[tabId].push(url);

  chrome.browserAction.setBadgeText({
    tabId,
    text: String(cache[tabId].length)
  });
  chrome.browserAction.setTitle({
    title: cache[tabId].join('\n')
  });

  return {
    cancel: true
  };
};
block.register = () => {
  chrome.webRequest.onBeforeRequest.removeListener(block.observer);
  return block.read().then(urls => chrome.webRequest.onBeforeRequest.addListener(block.observer, {
    urls,
    types: [
      'xmlhttprequest',
      'script'
    ]
  }, ['blocking']));
};
block.update = () => new Promise((resolve, reject) => chrome.storage.local.get({
  'update-urls': [
    'https://raw.githubusercontent.com/ray-lothian/Coin-Blocker/master/data/assets/blacklist.txt',
    'https://raw.githubusercontent.com/keraf/NoCoin/master/src/blacklist.txt'
  ]
}, prefs => {
  Promise.all(prefs['update-urls'].map(u => fetch(u).then(r => r.text))).then(arr => {
    const list = [];
    arr.forEach(block.parse).map(l => list.push(...l));
    console.log(list);
  });
}));

block.update();
