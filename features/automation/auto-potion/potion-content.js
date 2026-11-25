(() => {
  "use strict";
  const channel = "gst:potion:v1";
  let revision = 0, settings = null;
  function configure(value) {
    settings = GSTFeatureOptions.normalizePotion(value);
    GSTWindowBridge.send({ channel, type: "configure", preferences: settings });
  }
  window.addEventListener("message", (event) => {
    if (GSTWindowBridge.matches(event, channel)
        && event.data.type === "ready" && settings) configure(settings);
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.potionPreferences) {
      revision++;
      configure(changes.potionPreferences.newValue);
    }
  });
  window.addEventListener("pageshow", () => { if (settings) configure(settings); });
  const initialRevision = revision;
  chrome.storage.local.get("potionPreferences").then(({ potionPreferences }) => {
    if (revision === initialRevision) configure(potionPreferences);
  }).catch(() => { /* Never enable automatic item usage on a failed storage read. */ });
})();
