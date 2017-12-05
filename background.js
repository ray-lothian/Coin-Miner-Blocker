'use strict';

var prefs = {
  'rules': [],
  'enabled': true,
  'color': '#737373',
  'update-urls': [
    'https://raw.githubusercontent.com/ray-lothian/Coin-Miner-Blocker/master/data/assets/blacklist.txt',
    'https://raw.githubusercontent.com/keraf/NoCoin/master/src/blacklist.txt'
  ],
  'update': 24
};

var cache = {};
chrome.tabs.onRemoved.addListener(id => delete cache[id]);
chrome.webNavigation.onCommitted.addListener(({tabId, frameId}) => {
  if (frameId === 0) {
    delete cache[tabId];
  }
});

var block = {};
block.parse = (content = '') => content.trim().split('\n');
block.read = () => new Promise(resolve => {
  if (prefs.enabled === false) {
    resolve([]);
  }
  else if (prefs.rules.length) {
    resolve(prefs.rules);
  }
  else {
    resolve(fetch('data/assets/blacklist.txt').then(r => r.text()).then(block.parse));
  }
});
block.observer = ({tabId, url}) => {
  cache[tabId] = cache[tabId] || [];
  cache[tabId].push(url);

  chrome.browserAction.setBadgeText({
    tabId,
    text: String(cache[tabId].length)
  });
  chrome.runtime.lastError;
  chrome.browserAction.setTitle({
    tabId,
    title: cache[tabId].join('\n')
  });
  chrome.runtime.lastError;

  return {
    cancel: true
  };
};
block.register = () => {
  // console.log('register');
  chrome.webRequest.onBeforeRequest.removeListener(block.observer);
  return block.read().then(urls => {
    const active = urls.length !== 0;
    if (active) {
      chrome.webRequest.onBeforeRequest.addListener(block.observer, {
        urls,
        types: [
          'xmlhttprequest',
          'script'
        ]
      }, ['blocking']);
    }
    else {
      cache = {};
    }
    chrome.browserAction.setIcon({
      path: {
        '16': 'data/icons' + (active ? '' : '/disabled') + '/16.png',
        '18': 'data/icons' + (active ? '' : '/disabled') + '/18.png',
        '19': 'data/icons' + (active ? '' : '/disabled') + '/19.png',
        '32': 'data/icons' + (active ? '' : '/disabled') + '/32.png',
        '64': 'data/icons' + (active ? '' : '/disabled') + '/64.png'
      }
    });
    chrome.browserAction.setTitle({
      title: active ? 'Coin miming is blocked' : 'Coin mining is allowed'
    });
  });
};
block.update = () => Promise.all(prefs['update-urls'].map(u => fetch(u).then(r => r.text()))).then(arr => {
  let rules = [];
  arr.forEach(c => rules.push(...block.parse(c)));
  rules = rules.filter((s, i, l) => l.indexOf(s) === i);
  chrome.storage.local.set({
    rules
  });
}).catch(e => console.error(e));
block.unregister = () => chrome.webRequest.onBeforeRequest.removeListener(block.observer);

chrome.alarms.onAlarm.addListener(block.update);

chrome.browserAction.onClicked.addListener(({id}) => {
  chrome.storage.local.set({
    enabled: !prefs.enabled
  });
  chrome.browserAction.setBadgeText({
    tabId: id,
    text: ''
  });
});

chrome.storage.onChanged.addListener(ps => {
  Object.keys(ps).forEach(k => prefs[k] = ps[k].newValue);
  if (ps.rules || ps.enabled) {
    block.register();
  }
});

chrome.storage.local.get(prefs, ps => {
  Object.assign(prefs, ps);

  chrome.browserAction.setBadgeBackgroundColor({
    color: prefs.color
  });

  chrome.alarms.create({
    periodInMinutes: prefs.update * 60
  });

  block.update();
  block.register();
});

// FAQs & Feedback
chrome.storage.local.get({
  'version': null,
  'faqs': navigator.userAgent.indexOf('Firefox') === -1,
  'last-update': 0,
}, prefs => {
  const version = chrome.runtime.getManifest().version;

  if (prefs.version ? (prefs.faqs && prefs.version !== version) : true) {
    const now = Date.now();
    const doUpdate = (now - prefs['last-update']) / 1000 / 60 / 60 / 24 > 30;
    chrome.storage.local.set({
      version,
      'last-update': doUpdate ? Date.now() : prefs['last-update']
    }, () => {
      // do not display the FAQs page if last-update occurred less than 30 days ago.
      if (doUpdate) {
        const p = Boolean(prefs.version);
        chrome.tabs.create({
          url: chrome.runtime.getManifest().homepage_url + '?version=' + version +
            '&type=' + (p ? ('upgrade&p=' + prefs.version) : 'install'),
          active: p === false
        });
      }
    });
  }
});

{
  const {name, version} = chrome.runtime.getManifest();
  chrome.runtime.setUninstallURL(
    chrome.runtime.getManifest().homepage_url + '?rd=feedback&name=' + name + '&version=' + version
  );
}
