(() => {
  "use strict";
  let chest = false, chestRevision = 0;
  const send = () => GSTWindowBridge.send({ channel: "gst:background:v1", chest });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.chestPreferences) { chestRevision++; chest = changes.chestPreferences.newValue?.enabled === true; }
    if (changes.chestPreferences) send();
  });
  const c = chestRevision;
  chrome.storage.local.get(["chestPreferences"]).then((saved) => {
    if (c === chestRevision) chest = saved.chestPreferences?.enabled === true;
    send();
  }).catch(() => {});
  window.addEventListener("message", (event) => {
    if (GSTWindowBridge.matches(event, "gst:background-ready:v1")) send();
  });
  window.addEventListener("pageshow", send);
})();
