function saveOptions(e) {
  e.preventDefault();
  browser.storage.sync.set({
    apiKey: document.querySelector("#apiKey").value,
    priority: document.querySelector("#priority").value
  });
}

function restoreOptions() {
  function setCurrentChoice(result) {
    document.querySelector("#apiKey").value = result.apiKey || "";
    document.querySelector("#priority").value = result.priority || "0";
  }

  function onError(error) {
    console.log(`Error: ${error}`);
  }

  let getting = browser.storage.sync.get(["apiKey", "priority"]);
  getting.then(setCurrentChoice, onError);
}

document.addEventListener("DOMContentLoaded", restoreOptions);
document.querySelector("form").addEventListener("submit", saveOptions);
