document.getElementById('btn-tab')?.addEventListener('click', () => {
  const url = chrome.runtime.getURL('index.html');
  chrome.tabs.create({ url });
  window.close();
});

document.getElementById('btn-window')?.addEventListener('click', () => {
  const url = chrome.runtime.getURL('index.html');
  chrome.windows.create({
    url,
    type: 'popup',
    width: 1280,
    height: 800,
  });
  window.close();
});
