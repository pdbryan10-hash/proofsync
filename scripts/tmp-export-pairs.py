p = 'surveyor/export.mjs'
raw = open(p, 'rb').read().decode('utf-8')
nl = '\r\n' if '\r\n' in raw else '\n'

def rep(a, b):
    global raw
    a = a.replace('\n', nl); b = b.replace('\n', nl)
    assert a in raw, a[:70]
    raw = raw.replace(a, b)

rep("import { propose } from './propose.mjs';",
    "import { propose } from './propose.mjs';\nimport { pair } from '../kernel/pair.mjs';")

# every ordered pair, precomputed — there is no engine on the other end
rep("fs.writeFileSync(path.join(OUT, 'data', 'systems.json'), JSON.stringify(index));",
"""fs.writeFileSync(path.join(OUT, 'data', 'systems.json'), JSON.stringify(index));

// Every ordered pair. A linkage map is cheap to compute and there is nothing on
// the far end to compute it with, so both directions are written out.
let pairs = 0;
for (const A of systems) {
  for (const B of systems) {
    if (A.id === B.id) continue;
    fs.writeFileSync(path.join(OUT, 'data', `pair-${A.id}-${B.id}.json`),
      JSON.stringify(pair(A, B, { root: ROOT })));
    pairs += 1;
  }
}
console.log(` \u00b7 ${pairs} linkage map(s)`);""")

# the page already carries the static seam; it only needs telling, plus the
# asset paths and the two things that make no sense without an engine.
rep("""const swap = (a, b) => {""", """html = html.replace('<script>', '<script>window.PROOFMAP_STATIC = true;', 1);
const swap = (a, b) => {""")
rep("""swap("fetch('/api/domain')", "fetch('data/domain.json')");
swap("fetch('/api/systems')", "fetch('data/systems.json')");
swap("fetch('/api/system?id=' + encodeURIComponent(id))", "fetch('data/system-' + id + '.json')");
swap("href=\\"/file?p=${encodeURIComponent(d.captures + '\\\\\\\\' + s)}\\"", "href=\\"shots/${d.id}/${s}\\"");
swap("src=\\"/file?p=${encodeURIComponent(d.captures + '\\\\\\\\' + s)}\\"", "src=\\"shots/${d.id}/${s}\\"");
swap("src=\\"/file?p=${encodeURIComponent(d.captures + '\\\\\\\\' + d.video)}\\"", "src=\\"shots/${d.id}/${d.video}\\"");""",
"""swap("href=\\"/file?p=${encodeURIComponent(d.captures + '\\\\\\\\' + s)}\\"", "href=\\"shots/${d.id}/${s}\\"");
swap("src=\\"/file?p=${encodeURIComponent(d.captures + '\\\\\\\\' + s)}\\"", "src=\\"shots/${d.id}/${s}\\"");
swap("src=\\"/file?p=${encodeURIComponent(d.captures + '\\\\\\\\' + d.video)}\\"", "src=\\"shots/${d.id}/${d.video}\\"");""")
open(p, 'wb').write(raw.encode('utf-8'))
print('export: pairs + static flag')
