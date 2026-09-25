import json, html
f = json.load(open('final.json')); pool = json.load(open('pool.json')); byid = {p['id']: p for p in pool}; dos = json.load(open('dossiers.json'))
head = open('report-head.md').read()
def money(n): return '$' + format(int(n), ',')
rows = []
for l in f['ledger']:
    rows.append(f"- {l['rank']}. [{l['id']}] {l['name']} ({l['type']}/{l['form']}) -> beaten by [{l['beaten_by']}] {l['beaten_by_name']}. {l['reason']}")
open('REPORT.md', 'w').write(head + '\n' + '\n'.join(rows) + '\n')
# HTML fragments for the page
def esc(s): return html.escape(str(s))
top_cards = []
for n, i in enumerate(f['top10'], 1):
    p = byid[i]; d = dos[i]
    top_cards.append(f"""<li class="pick"><div class="rank">{n}</div><div class="body"><h3>{esc(p['name'])}</h3>
<p class="tags"><span class="tag t-{p['type']}">{p['type']}</span><span class="tag">{p['form']}</span><span class="tag">{esc(p['category'])}</span></p>
<dl class="nums"><div><dt>Median, year 2</dt><dd>{money(d['income_median_y2_usd'])}</dd></div><div><dt>Top decile</dt><dd>{money(d['income_top_decile_usd'])}</dd></div><div><dt>Odds of median</dt><dd>{d['prob_reach_median']:.0%}</dd></div><div><dt>Capital</dt><dd>{money(d['capital_required_usd'])}</dd></div><div><dt>First dollar</dt><dd>{d['months_to_first_dollar']} mo</dd></div><div><dt>Durability</dt><dd>{d['durability_5yr']}/10</dd></div></dl>
<p class="ev"><strong>Evidence.</strong> {esc(d['key_numbers'])}</p><p class="sk"><strong>Skeptic.</strong> {esc(d['skeptic'])}</p></div></li>""")
ledger_rows = []
for l in f['ledger']:
    cls = ' class="ref"' if l['id'] in f['h2h'] else (' class="fatal"' if l['fatal'] else '')
    ledger_rows.append(f"<tr{cls}><td>{l['rank']}</td><td><b>{l['id']}</b> {esc(l['name'])}<br><small>{l['type']} / {l['form']}</small></td><td>{money(l['median'])}<br><small>top {money(l['top'])}, p {l['p']}</small></td><td><b>{l['beaten_by']}</b> {esc(l['beaten_by_name'])}</td><td>{esc(l['reason'])}</td></tr>")
tpl = open('page-template.html').read()
page = tpl.replace('{{TOP10}}', '\n'.join(top_cards)).replace('{{LEDGER}}', '\n'.join(ledger_rows))
open('tournament-report.html', 'w').write(page)
print('REPORT.md', len(open('REPORT.md').read()), 'chars; html', len(page), 'chars; ledger rows', len(rows))
