chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (sender.id !== chrome.runtime.id || msg?.type !== "OFFSCREEN_PARSE") return;
  try {
    const doc = new DOMParser().parseFromString(String(msg.html), "text/html");
    respond(window.__optSnapshot(doc, String(msg.url)) ?? null);
  } catch {
    respond(null);
  }
});
