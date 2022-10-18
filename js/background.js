const APPLICABLE_PROTOCOLS = ["http:", "https:"];

const API_BASE = "https://api.prowlapp.com";
const API_URL = `${API_BASE}/publicapi`;
const API_ADD = `${API_URL}/add`;

const TOAST_ID = "send-to-prowl-2-toast";

const ICONS_DIR = "/icons";
const ICON_WARNING = `${ICONS_DIR}/warning.svg`;
const ICON_SEND_TO_DEVICE16 = `${ICONS_DIR}/send-to-device.svg`;
const ICON_SEND_TO_DEVICE48 = `${ICONS_DIR}/send-to-device48.svg`;

const API_HEADERS = {
  'Content-Type': 'application/x-www-form-urlencoded'
};

const HTTP_POST = "POST";

// Number of milliseconds a notification toast should be shown before clearing.
const TOAST_TIMEOUT_DEFAULT = 10000;

// Variables representing user settings.
let apiKey = "";
let apiPriority = "0";

// Returns true if the given URL is one that the user can send to Prowl.
function protocolIsApplicable(url) {
  const protocol = (new URL(url)).protocol;
  return APPLICABLE_PROTOCOLS.includes(protocol);
}

// Initializes the pageAction on the tab, if it's an applicable URL.
function initializePageAction(tab) {
  if (protocolIsApplicable(tab.url)) {
    browser.pageAction.setIcon({tabId: tab.id, path: ICON_SEND_TO_DEVICE16});
    browser.pageAction.setTitle({tabId: tab.id, title: browser.i18n.getMessage("titleActionSend")});
    browser.pageAction.show(tab.id);
  }
}

// Loads user settings from the browser storage.
function loadSettings() {

  function onFailedToGetSettings(error) {
    console.log(`Settings load error: ${error}`);
  }

  function onGotSettings(item) {
    if (item.apiKey) {
      apiKey = item.apiKey;
    }
    if (item.priority) {
      apiPriority = item.priority;
    }
  }

  const gettingSettings = browser.storage.sync.get(["apiKey", "priority"]);
  gettingSettings.then(onGotSettings, onFailedToGetSettings);
}

// Displays a notification.
function toast(opts) {

  if (typeof opts === 'string') {
    opts = {
      text: opts,
    }
  }

  if (!opts.id) {
    opts.id = TOAST_ID;
  }

  const title = browser.i18n.getMessage("extensionName");
  const content = browser.i18n.getMessage(opts.text, opts.data);

  if (opts.icon) {
    icon = browser.extension.getURL(opts.icon);
  }

  let showingToast = browser.notifications.create(opts.id, {
    type: "basic",
    iconUrl: icon,
    title,
    message: content,
  });

  if (opts.timeout) {
    showingToast.then(() => {
      setTimeout(() => {
        browser.notifications.clear(opts.id);
      }, opts.timeout);
    });
  }

  return opts.id;
}

// Displays a notification with a warning icon.
function warning(textKey, dataExtra) {
  return toast({text: textKey, icon: browser.extension.getURL(ICON_WARNING), timeout: TOAST_TIMEOUT_DEFAULT, data: dataExtra});
}

// Displays a notification with the default application icon.
function notification(textKey, dataExtra) {
  return toast({text: textKey, icon: browser.extension.getURL(ICON_SEND_TO_DEVICE48), timeout: TOAST_TIMEOUT_DEFAULT, data: dataExtra});
}

// Opens the extension setting page.
function openSettingsPage() {
  browser.runtime.openOptionsPage();
}

// Sends the given tab to prowl.
function sendToProwl(tab) {

  const url = encodeURI(tab.url);
  const title = tab.title;
  const applicationName = browser.i18n.getMessage("extensionName");

  if (!apiKey) {
    warning("apiKeyMissing");
    openSettingsPage();
    return;
  }

  if (!url) {
    warning("urlMissing");
    return;
  }

  let params = new URLSearchParams();

  params.append("apikey", apiKey);
  params.append("priority", apiPriority);
  params.append("application", applicationName);
  params.append("event", title);
  params.append("description", url);
  params.append("url", url);

  let bodyString = params.toString();

  fetch(API_ADD, {
      method: HTTP_POST,
      headers: API_HEADERS,
      body: bodyString,
      cache: "no-cache"
  })
    .then(resp => {
      if (resp.ok) {
        notification("sentSuccess", title);
      } else {
        console.log(resp);

        if (resp.status == 401) {
          warning("sentUnauthorized");
        } else {
          warning("sentFailure", resp.statusText);
        }
      }
    })
    .catch(err => warning("sentException", err));
}

// Initializes the extension and sets up the state with any user settings.
function initializeExtension() {

  // initalize our icon on all existing tabs
  let gettingAllTabs = browser.tabs.query({});
  gettingAllTabs.then((tabs) => {
    for (let tab of tabs) {
      initializePageAction(tab);
    }
  });

  // add a listener to re-init our icon on tab update
  browser.tabs.onUpdated.addListener((id, changeInfo, tab) => {
    initializePageAction(tab);
  });

  // add the listener for our page action
  browser.pageAction.onClicked.addListener(sendToProwl);

  // load our initial settings
  loadSettings();

  // add a listener for when settings change
  browser.storage.sync.onChanged.addListener(changes => loadSettings());
}

initializeExtension();
