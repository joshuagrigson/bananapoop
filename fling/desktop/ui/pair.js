const api = window.fling;
const $ = (id) => document.getElementById(id);

function qrBlock(qr, url) {
  const wrap = document.createElement('div');
  const img = document.createElement('img');
  img.className = 'qr';
  img.src = qr;
  img.alt = 'Pairing code';
  const u = document.createElement('div');
  u.className = 'url';
  u.textContent = url.replace(/#k=.*/, '');
  wrap.append(img, u);
  return wrap;
}

function setPhones(n) {
  $('status').classList.toggle('on', n > 0);
  $('statusText').textContent = n > 0 ? (n === 1 ? 'Phone linked' : `${n} phones linked`) : 'No phone linked yet';
}

async function render() {
  const info = await api.pairInfo();
  setPhones(info.phones);
  $('inbox').textContent = info.inbox;
  $('login').checked = info.openAtLogin;

  const lan = $('lan');
  lan.textContent = '';
  if (!info.lan.length) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = 'This laptop is not on a Wi-Fi network right now. Join Wi-Fi or your iPhone hotspot, then reopen this window.';
    lan.appendChild(p);
  } else {
    lan.appendChild(qrBlock(info.lan[0].qr, info.lan[0].url));
    if (info.lan.length > 1) {
      const d = document.createElement('details');
      d.className = 'alt';
      const s = document.createElement('summary');
      s.textContent = 'Phone can\'t connect? Try another network adapter';
      d.appendChild(s);
      for (const l of info.lan.slice(1)) {
        const t = document.createElement('p');
        t.className = 'muted';
        t.textContent = l.name;
        d.append(t, qrBlock(l.qr, l.url));
      }
      lan.appendChild(d);
    }
  }

  $('anywhere').checked = info.tunnel === 'on' || info.tunnel === 'starting';
  const box = $('anywhereBox');
  box.textContent = '';
  if (info.anywhere) box.appendChild(qrBlock(info.anywhere.qr, info.anywhere.url));
  else if (info.tunnel === 'starting') box.innerHTML = '<p class="muted">Opening the tunnel… (first time downloads a small Cloudflare tool)</p>';
  if (info.tunnelError && info.tunnel !== 'on') {
    const e = document.createElement('div');
    e.className = 'err';
    e.textContent = info.tunnelError;
    box.appendChild(e);
  }
}

$('anywhere').addEventListener('change', async (e) => { await api.setAnywhere(e.target.checked); render(); });
$('login').addEventListener('change', async (e) => { e.target.checked = await api.setLogin(e.target.checked); });
$('openInbox').addEventListener('click', () => api.openInbox());
api.on('phones', setPhones);
api.on('tunnel', render);
window.addEventListener('focus', render);
render();
