// The edge portal: drop files from Explorer here to send them to the phone.

const api = window.fling;
const pill = document.getElementById('pill');
const label = document.getElementById('label');

function setLinked(n) {
  pill.classList.toggle('linked', n > 0);
  label.textContent = n > 0 ? 'Phone' : 'Fling';
}
api.phones().then(setLinked);
api.on('phones', setLinked);

pill.addEventListener('click', () => api.showPair());

let depth = 0;
window.addEventListener('dragenter', (e) => { e.preventDefault(); depth++; pill.classList.add('over'); });
window.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
window.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) pill.classList.remove('over'); });
window.addEventListener('drop', async (e) => {
  e.preventDefault();
  depth = 0;
  pill.classList.remove('over');
  for (const f of e.dataTransfer.files) {
    const p = api.pathFor(f);
    if (p) await api.sendToPhone(p);
  }
});
