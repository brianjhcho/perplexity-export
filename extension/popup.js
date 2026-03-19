const btn = document.getElementById('exportBtn');
const progress = document.getElementById('progress');
const progressFill = document.getElementById('progressFill');
const status = document.getElementById('status');
const stats = document.getElementById('stats');
const error = document.getElementById('error');
const done = document.getElementById('done');

btn.addEventListener('click', async () => {
  // Check we're on perplexity.ai
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab.url.includes('perplexity.ai')) {
    error.style.display = 'block';
    error.textContent = 'Navigate to perplexity.ai first';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Exporting...';
  progress.style.display = 'block';
  error.style.display = 'none';

  // Inject and run the content script
  chrome.tabs.sendMessage(tab.id, { action: 'startExport' });
});

// Listen for progress updates from content script
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'scroll-progress') {
    status.textContent = `Scrolling... ${msg.count} threads found`;
    progressFill.style.width = '10%';
  }
  if (msg.type === 'fetch-progress') {
    const pct = Math.round((msg.done / msg.total) * 90) + 10;
    progressFill.style.width = pct + '%';
    status.textContent = `${msg.done}/${msg.total} threads`;
    stats.style.display = 'block';
    stats.textContent = `${msg.saved} saved, ${msg.failed} failed`;
  }
  if (msg.type === 'done') {
    progressFill.style.width = '100%';
    status.textContent = 'Complete!';
    btn.textContent = 'Done!';
    done.style.display = 'block';
    done.textContent = `${msg.saved} threads exported. Check your Downloads folder.`;
  }
  if (msg.type === 'error') {
    error.style.display = 'block';
    error.textContent = msg.message;
    btn.disabled = false;
    btn.textContent = 'Export All Threads';
  }
});
