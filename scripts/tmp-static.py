p = 'surveyor/ui.html'
raw = open(p, 'rb').read().decode('utf-8')
nl = '\r\n' if '\r\n' in raw else '\n'

def rep(a, b):
    global raw
    a = a.replace('\n', nl); b = b.replace('\n', nl)
    assert a in raw, a[:70]
    raw = raw.replace(a, b)

# One seam, so the same page runs two ways: against the local engine, or against
# a folder of files on a server that has no engine at all.
rep("""const $ = (s) => document.querySelector(s);""",
"""const $ = (s) => document.querySelector(s);
/* THE ONE SEAM.
   Locally this page talks to the engine on localhost. Published, there is no
   engine — a survey needs a browser and a person to sign in — so it reads the
   same shapes from static files written at export time. Everything below is
   identical either way, which is the point: the published report cannot drift
   from the one on the desk. */
const STATIC = !!window.PROOFMAP_STATIC;
const api = {
  domain: () => fetch(STATIC ? 'data/domain.json' : '/api/domain').then((r) => r.json()),
  systems: () => fetch(STATIC ? 'data/systems.json' : '/api/systems').then((r) => r.json()),
  system: (id) => fetch(STATIC ? 'data/system-' + id + '.json' : '/api/system?id=' + encodeURIComponent(id)).then((r) => r.json()),
  asset: (sysId, captures, file) => (STATIC ? 'shots/' + sysId + '/' + file
    : '/file?p=' + encodeURIComponent(captures + '\\\\' + file)),
};""")

rep("""  const list = await (await fetch('/api/systems')).json();""",
    """  const list = await api.systems();""")
rep("""  DOMAIN = await (await fetch('/api/domain')).json();""",
    """  DOMAIN = await api.domain();""")
rep("""  const d = await (await fetch('/api/system?id=' + encodeURIComponent(id))).json();""",
    """  const d = await api.system(id);""")
rep("""    ${d.video ? `<h3>The walkthrough</h3><video controls preload="metadata"
      src="/file?p=${encodeURIComponent(d.captures + '\\\\' + d.video)}"></video>` : ''}""",
    """    ${d.video ? `<h3>The walkthrough</h3><video controls preload="metadata"
      src="${api.asset(d.id, d.captures, d.video)}"></video>` : ''}""")
rep("""    <div class="shots">${d.shots.map((s) => `<button onclick="zoom(this.querySelector('img').src)"
      aria-label="Enlarge ${esc(s)}"><img loading="lazy" alt="${esc(s)}"
      src="/file?p=${encodeURIComponent(d.captures + '\\\\' + s)}"></button>`).join('')}</div>`;""",
    """    <div class="shots">${d.shots.map((s) => `<button onclick="zoom(this.querySelector('img').src)"
      aria-label="Enlarge ${esc(s)}"><img loading="lazy" alt="${esc(s)}"
      src="${api.asset(d.id, d.captures, s)}"></button>`).join('')}</div>`;""")

# Published, there is nothing to survey and no path to disk worth showing.
rep("""    <p class="path">${esc(d.captures)}</p>""",
    """    ${STATIC ? '' : `<p class="path">${esc(d.captures)}</p>`}""")
rep("""  <button class="act" onclick="newSurvey.showModal()">Survey a new system</button>""",
    """  <button class="act" id="newbtn" onclick="newSurvey.showModal()">Survey a new system</button>""")
rep("""loadSystems(); landing();""",
"""if (STATIC) {
  // No engine here. Say so rather than offering a button that cannot work.
  const b = $('#newbtn');
  b.disabled = true; b.title = 'Surveying runs on the desktop, where a browser can be opened and signed into';
  b.textContent = 'Surveying runs on the desktop';
  b.style.opacity = .55; b.style.cursor = 'default';
}
loadSystems(); landing();""")
open(p, 'wb').write(raw.encode('utf-8'))
print('ui: one seam added')
