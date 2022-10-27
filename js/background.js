'use strict';

const APPLICABLE_PROTOCOLS = ["http:", "https:"];

const API_BASE = "https://api.prowlapp.com";
const API_URL = `${API_BASE}/publicapi`;
const API_ADD = `${API_URL}/add`;

const TOAST_ID = "send-to-prowl-2-toast";
const CONTEXT_MENU_ID = "send-2-prowl-2";

const ICONS_DIR = "/icons";
const ICON_WARNING = `${ICONS_DIR}/warning.svg`;
const ICON_SEND_TO_DEVICE_SVG = `${ICONS_DIR}/send-to-device.svg`;
const ICON_SEND_TO_DEVICE16 = ICON_SEND_TO_DEVICE_SVG;
const ICON_SEND_TO_DEVICE48 = `${ICONS_DIR}/send-to-device48.svg`;

const API_HEADERS = {
  'Content-Type': 'application/x-www-form-urlencoded'
};

const API_CACHE = "no-cache";

const HTTP_POST = "POST";

const CONTEXT_TYPE_ALL = "all";
const CONTEXT_TYPE_FRAME = "frame";
const CONTEXT_TYPE_PAGE = "page";

const CONTEXT_TYPE_BUBBLE = [
  CONTEXT_TYPE_FRAME,
  "editable",
  "password"
]

// Number of milliseconds a notification toast should be shown before clearing.
const TOAST_TIMEOUT_DEFAULT = 10000;

// extension state variables
let browserTitle = "Firefox?";
let lastSetContextType = CONTEXT_TYPE_PAGE;
let apiKeyContextMenuTextSet = false;

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

  const gettingBrowserInfo = browser.runtime.getBrowserInfo();
  gettingBrowserInfo.then(i => browserTitle = `${i.name} ${i.version}`);
}

// Displays a notification.
function toast(opts) {

  try {
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

    let icon = null;

    if (opts.icon) {
      icon = browser.runtime.getURL(opts.icon);
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
  } catch (error) {
    console.log(error);
    return TOAST_ID;
  }
}

// Displays a notification with a warning icon.
function warning(textKey, dataExtra) {
  return toast({text: textKey, icon: browser.runtime.getURL(ICON_WARNING), timeout: TOAST_TIMEOUT_DEFAULT, data: dataExtra});
}

// Displays a notification with the default application icon.
function notification(textKey, dataExtra) {
  return toast({text: textKey, icon: browser.runtime.getURL(ICON_SEND_TO_DEVICE48), timeout: TOAST_TIMEOUT_DEFAULT, data: dataExtra});
}

// Opens the extension setting page.
function openSettingsPage() {
  browser.runtime.openOptionsPage();
}

// The context menu shown handler that will trigger updating the context menu item text.
function contextMenuShown(info) {

  if (!apiKey) {
    if (!apiKeyContextMenuTextSet) {
      apiKeyContextMenuTextSet = true;
      setContextMenuActionText(browser.i18n.getMessage("contextActionApiKeySet"));
    }
    return;
  }

  apiKeyContextMenuTextSet = false;

  let contexts = info.contexts;
  let typeIsFramed = false;

  while (contexts && contexts[0]) {

    let type = contexts[0];

    let typeIsFrame = type == CONTEXT_TYPE_FRAME;
    typeIsFramed = typeIsFramed || typeIsFrame;

    let isBubbleType = CONTEXT_TYPE_BUBBLE.includes(type);

    // if we're a frame but not *only* a frame, bump to the next.
    if (isBubbleType && contexts.length > 1) {
      contexts.shift();
      continue;
    }

    if (type == CONTEXT_TYPE_ALL) {
      type = typeIsFramed
        ? CONTEXT_TYPE_FRAME
        : CONTEXT_TYPE_PAGE;
    }

    updateContextMenuText(type);
    break;
  }
}

// Updates the context menu with the current type of context the menu is open in.
function updateContextMenuText(contextType) {
  if (lastSetContextType == contextType) {
    return;
  }

  lastSetContextType = contextType;

  let typeStr = browser.i18n.getMessage(`contextType_${contextType}`);
  let actionStr = browser.i18n.getMessage("contextActionSend", typeStr);
  setContextMenuActionText(actionStr);
}

// Sets the context menu text with the given string.
function setContextMenuActionText(text) {
  browser.contextMenus.update(CONTEXT_MENU_ID, {
    title: text
  });
  browser.contextMenus.refresh();
}

// Handles a context menu click to send text, bookmark, or a URL to prowl.
function contextMenuSendToProwl(info, tab) {
  if (info.menuItemId !== CONTEXT_MENU_ID) {
    return;
  }

  // take the user to the settings page if the API key is not set.
  if (!apiKey) {
    openSettingsPage();
    return;
  }

  // if our context was a bookmark, send that bookmark.
  if (info.bookmarkId) {
    bookmarkSendToProwl(info);
    return;
  }

  // get a url, preferring in order: link, the src, then the current page's url.
  const url = info.linkUrl || info.srcUrl || info.pageUrl;

  // get a title preferably from the link text if it exist, then from the tab title if it doesn't.
  const title = info.linkText || tab.title;

  // if we have a selection text, we will be sending that instead of the url.
  if (info.selectionText) {
    sendTextToProwl(info.selectionText, title);
    return;
  }

  // send the url and the title
  sendUrlToProwl(url, title);
}

// Sends a bookmark to prowl.
function bookmarkSendToProwl(info) {
  browser.bookmarks.get(info.bookmarkId)
    .then(marks => marks.map(mark => {
      const url = mark.url;
      const title = mark.title;
      sendUrlToProwl(url, title);
    }));
}

// Sends the given tab to prowl.
function tabSendToProwl(tab) {

  const url = encodeURI(tab.url);
  const title = tab.title;

  sendUrlToProwl(url, title);
}

// Sends a text notification to prowl.
function sendTextToProwl(text, title) {
  sendToProwl({ text, title });
}

// Sends a link notification to prowl.
function sendUrlToProwl(url, title) {
  if (!protocolIsApplicable(url)) {
    warning("badProtocol", APPLICABLE_PROTOCOLS.join(", "));
    return;
  }
  sendToProwl({ url, title });
}

// Sends a message (text or link) to prowl.
function sendToProwl(info) {

  const applicationName = browser.i18n.getMessage("extensionName");

  if (!apiKey) {
    warning("apiKeyMissing");
    openSettingsPage();
    return;
  }

  if (!info.text && !info.url) {
    warning("urlMissing");
    return;
  }

  if (!info.title) {
    info.title = browserTitle || applicationName;
  }

  let description = info.text || info.url;

  let params = new URLSearchParams();

  params.append("apikey", apiKey);
  params.append("priority", apiPriority);
  params.append("application", applicationName);
  params.append("event", info.title);

  params.append("description", description);

  if (info.url) {
    params.append("url", info.url);
  }

  let bodyString = params.toString();

  fetch(API_ADD, {
    method: HTTP_POST,
    headers: API_HEADERS,
    body: bodyString,
    cache: API_CACHE
  })
    .then(resp => {
      if (resp.ok) {
        notification("sentSuccess", info.title);
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

  // initialize our icon on all existing tabs
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
  browser.pageAction.onClicked.addListener(tabSendToProwl);

  // create the context menu entry for our context menu action
  browser.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: browser.i18n.getMessage("contextActionSend", CONTEXT_TYPE_PAGE),
    contexts: ["all", "bookmark", "tab"]
  });

  // add the listeners for our context menu action
  browser.contextMenus.onClicked.addListener(contextMenuSendToProwl);
  browser.contextMenus.onShown.addListener(contextMenuShown);

  // load our initial settings
  loadSettings();

  // add a listener for when settings change
  browser.storage.sync.onChanged.addListener(changes => loadSettings());
}

initializeExtension();
