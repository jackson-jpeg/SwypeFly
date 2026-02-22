import type { VercelRequest, VercelResponse } from '@vercel/node';
import { serverDatabases, DATABASE_ID, COLLECTIONS, Query } from '../../services/appwriteServer';

const ADMIN_SECRET = process.env.ADMIN_SECRET || process.env.CRON_SECRET || '';

function checkAuth(req: VercelRequest): boolean {
  const auth = req.headers.authorization;
  if (auth && auth === `Bearer ${ADMIN_SECRET}`) return true;
  const q = (req.query.secret as string) || '';
  return q === ADMIN_SECRET;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'PATCH') {
    // Update a destination's approval status
    const { id, approved, hidden } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing id' });

    try {
      const updates: Record<string, unknown> = {};
      if (typeof approved === 'boolean') updates.approved = approved;
      if (typeof hidden === 'boolean') updates.hidden = hidden;

      await serverDatabases.updateDocument(DATABASE_ID, COLLECTIONS.destinations, id, updates);
      return res.json({ ok: true, id, ...updates });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  // GET — fetch all destinations
  try {
    const allDocs: any[] = [];
    let offset = 0;
    const limit = 100;
    while (true) {
      const batch = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.destinations, [
        Query.limit(limit),
        Query.offset(offset),
        Query.orderAsc('city'),
      ]);
      allDocs.push(...batch.documents);
      if (allDocs.length >= batch.total) break;
      offset += limit;
    }

    // If ?json=1, return raw JSON
    if (req.query.json === '1') {
      return res.json({ total: allDocs.length, destinations: allDocs });
    }

    // Return the audit HTML page
    res.setHeader('Content-Type', 'text/html');
    return res.send(buildAuditPage(allDocs));
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}

function buildAuditPage(destinations: any[]): string {
  const dataJson = JSON.stringify(
    destinations.map((d) => ({
      id: d.$id,
      city: d.city,
      country: d.country,
      tagline: d.tagline,
      imageUrl: d.image_url,
      imageUrls: d.image_urls || [],
      iataCode: d.iata_code,
      vibeTags: d.vibe_tags || [],
      flightPrice: d.flight_price,
      approved: d.approved ?? null,
      hidden: d.hidden ?? false,
    }))
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SoGoJet — Destination Audit</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0a; color: #e0e0e0; }
  .header { position: sticky; top: 0; z-index: 100; background: #111; border-bottom: 1px solid #333; padding: 16px 24px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
  .header h1 { font-size: 20px; color: #fff; }
  .stats { font-size: 14px; color: #888; }
  .stats span { color: #4fc3f7; font-weight: 600; }
  .filters { display: flex; gap: 8px; margin-left: auto; }
  .filters button { padding: 6px 14px; border-radius: 20px; border: 1px solid #444; background: #1a1a1a; color: #ccc; cursor: pointer; font-size: 13px; transition: all 0.2s; }
  .filters button.active { background: #4fc3f7; color: #000; border-color: #4fc3f7; }
  .filters button:hover { border-color: #4fc3f7; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; padding: 24px; }
  .card { background: #1a1a1a; border-radius: 12px; overflow: hidden; border: 2px solid transparent; transition: border-color 0.3s; }
  .card.approved { border-color: #4caf50; }
  .card.rejected { border-color: #f44336; }
  .card.hidden { opacity: 0.4; }
  .card-images { position: relative; height: 220px; overflow: hidden; }
  .card-images img { width: 100%; height: 100%; object-fit: cover; display: none; }
  .card-images img.active { display: block; }
  .img-nav { position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%); display: flex; gap: 4px; }
  .img-nav .dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,0.4); cursor: pointer; }
  .img-nav .dot.active { background: #fff; }
  .img-counter { position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.6); color: #fff; padding: 2px 8px; border-radius: 10px; font-size: 12px; }
  .img-error { position: absolute; top: 8px; left: 8px; background: rgba(244,67,54,0.9); color: #fff; padding: 2px 8px; border-radius: 10px; font-size: 11px; }
  .card-info { padding: 12px 16px; }
  .card-info h3 { font-size: 16px; color: #fff; margin-bottom: 2px; }
  .card-info .meta { font-size: 13px; color: #888; margin-bottom: 6px; }
  .card-info .tags { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 10px; }
  .card-info .tag { font-size: 11px; background: #2a2a2a; color: #aaa; padding: 2px 8px; border-radius: 10px; }
  .card-actions { display: flex; gap: 8px; padding: 0 16px 12px; }
  .btn { flex: 1; padding: 8px; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
  .btn-approve { background: #1b5e20; color: #4caf50; }
  .btn-approve:hover, .btn-approve.active { background: #4caf50; color: #fff; }
  .btn-reject { background: #b71c1c33; color: #f44336; }
  .btn-reject:hover, .btn-reject.active { background: #f44336; color: #fff; }
  .btn-hide { background: #333; color: #888; }
  .btn-hide:hover, .btn-hide.active { background: #ff9800; color: #000; }
  .toast { position: fixed; bottom: 24px; right: 24px; background: #333; color: #fff; padding: 12px 20px; border-radius: 8px; font-size: 14px; z-index: 200; display: none; }
  .toast.show { display: block; }
  .search { padding: 8px 14px; border-radius: 8px; border: 1px solid #444; background: #1a1a1a; color: #fff; font-size: 14px; width: 200px; }
  .arrow { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.5); color: #fff; border: none; padding: 8px 6px; cursor: pointer; font-size: 18px; z-index: 5; }
  .arrow-left { left: 4px; border-radius: 0 6px 6px 0; }
  .arrow-right { right: 4px; border-radius: 6px 0 0 6px; }
</style>
</head>
<body>
<div class="header">
  <h1>✈️ SoGoJet Audit</h1>
  <div class="stats"><span id="total">0</span> destinations · <span id="approvedCount">0</span> approved · <span id="rejectedCount">0</span> rejected · <span id="pendingCount">0</span> pending</div>
  <input class="search" id="search" placeholder="Search city or country…">
  <div class="filters">
    <button class="active" data-filter="all">All</button>
    <button data-filter="pending">Pending</button>
    <button data-filter="approved">Approved</button>
    <button data-filter="rejected">Rejected</button>
    <button data-filter="broken">Broken Images</button>
  </div>
</div>
<div class="grid" id="grid"></div>
<div class="toast" id="toast"></div>
<script>
const DESTINATIONS = ${dataJson};
const SECRET = new URLSearchParams(location.search).get('secret') || '';
let filter = 'all';
let searchQuery = '';

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

async function updateDest(id, updates) {
  try {
    const r = await fetch('/api/admin/audit?secret=' + SECRET, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    });
    const j = await r.json();
    if (j.ok) {
      const d = DESTINATIONS.find(x => x.id === id);
      if (d) Object.assign(d, updates);
      render();
      toast('Updated ' + (d?.city || id));
    } else {
      toast('Error: ' + j.error);
    }
  } catch(e) { toast('Network error'); }
}

function render() {
  const grid = document.getElementById('grid');
  let filtered = DESTINATIONS.filter(d => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!d.city.toLowerCase().includes(q) && !d.country.toLowerCase().includes(q) && !(d.iataCode||'').toLowerCase().includes(q)) return false;
    }
    if (filter === 'pending') return d.approved === null || d.approved === undefined;
    if (filter === 'approved') return d.approved === true;
    if (filter === 'rejected') return d.approved === false;
    if (filter === 'broken') return d._broken;
    return true;
  });

  document.getElementById('total').textContent = DESTINATIONS.length;
  document.getElementById('approvedCount').textContent = DESTINATIONS.filter(d => d.approved === true).length;
  document.getElementById('rejectedCount').textContent = DESTINATIONS.filter(d => d.approved === false).length;
  document.getElementById('pendingCount').textContent = DESTINATIONS.filter(d => d.approved === null || d.approved === undefined).length;

  grid.innerHTML = filtered.map(d => {
    const allImages = [d.imageUrl, ...(d.imageUrls || [])].filter(Boolean);
    const statusClass = d.approved === true ? 'approved' : d.approved === false ? 'rejected' : '';
    const hiddenClass = d.hidden ? 'hidden' : '';
    return \`<div class="card \${statusClass} \${hiddenClass}" data-id="\${d.id}">
      <div class="card-images" data-id="\${d.id}">
        \${allImages.map((url, i) => \`<img src="\${url}" class="\${i === 0 ? 'active' : ''}" data-idx="\${i}" loading="lazy" onerror="this.style.display='none';markBroken('\${d.id}')">\`).join('')}
        \${allImages.length > 1 ? \`
          <button class="arrow arrow-left" onclick="navImg('\${d.id}',-1)">‹</button>
          <button class="arrow arrow-right" onclick="navImg('\${d.id}',1)">›</button>
          <div class="img-nav">\${allImages.map((_, i) => \`<div class="dot \${i===0?'active':''}" onclick="goImg('\${d.id}',\${i})"></div>\`).join('')}</div>
        \` : ''}
        <div class="img-counter">\${allImages.length} img</div>
        \${d._broken ? '<div class="img-error">⚠ Broken</div>' : ''}
      </div>
      <div class="card-info">
        <h3>\${d.city}, \${d.country}</h3>
        <div class="meta">\${d.iataCode || '—'} · $\${d.flightPrice} · "\${d.tagline}"</div>
        <div class="tags">\${(d.vibeTags||[]).map(t => \`<span class="tag">\${t}</span>\`).join('')}</div>
      </div>
      <div class="card-actions">
        <button class="btn btn-approve \${d.approved === true ? 'active' : ''}" onclick="updateDest('\${d.id}',{approved:true})">✓ Approve</button>
        <button class="btn btn-reject \${d.approved === false ? 'active' : ''}" onclick="updateDest('\${d.id}',{approved:false})">✗ Reject</button>
        <button class="btn btn-hide \${d.hidden ? 'active' : ''}" onclick="updateDest('\${d.id}',{hidden:!\${d.hidden}})">👁 Hide</button>
      </div>
    </div>\`;
  }).join('');
}

window.markBroken = function(id) {
  const d = DESTINATIONS.find(x => x.id === id);
  if (d) d._broken = true;
};

window.navImg = function(id, dir) {
  const container = document.querySelector(\`.card-images[data-id="\${id}"]\`);
  const imgs = container.querySelectorAll('img');
  const dots = container.querySelectorAll('.dot');
  let current = [...imgs].findIndex(i => i.classList.contains('active'));
  imgs[current]?.classList.remove('active');
  dots[current]?.classList.remove('active');
  current = (current + dir + imgs.length) % imgs.length;
  imgs[current]?.classList.add('active');
  dots[current]?.classList.add('active');
};

window.goImg = function(id, idx) {
  const container = document.querySelector(\`.card-images[data-id="\${id}"]\`);
  container.querySelectorAll('img').forEach((img, i) => img.classList.toggle('active', i === idx));
  container.querySelectorAll('.dot').forEach((dot, i) => dot.classList.toggle('active', i === idx));
};

document.querySelectorAll('.filters button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelector('.filters .active').classList.remove('active');
    btn.classList.add('active');
    filter = btn.dataset.filter;
    render();
  });
});

document.getElementById('search').addEventListener('input', e => {
  searchQuery = e.target.value;
  render();
});

render();
</script>
</body>
</html>`;
}
