import json, glob, sys
pool = json.load(open('pool.json')); byid = {p['id']: p for p in pool}
dos = json.load(open('dossiers.json'))
ids = [p['id'] for p in pool]; N = len(ids)
borda = {i: 0 for i in ids}; judges = []
for f in sorted(glob.glob('judge-*.json')):
    j = json.load(open(f)); judges.append(j)
    seen = set(); pos = 0
    for i in j['ranking']:
        if i not in borda or i in seen: continue
        seen.add(i); borda[i] += N - pos; pos += 1
    missing = [i for i in ids if i not in seen]
    print(f"{f}: lens={j.get('lens')} ranked={len(seen)} missing={missing}")
order = sorted(ids, key=lambda i: -borda[i])
json.dump({'borda': borda, 'order': order, 'judges': [{'lens': j.get('lens'), 'rationale': j.get('rationale'), 'top10': j['ranking'][:10]} for j in judges]}, open('borda.json', 'w'), indent=1)
print('\nBORDA ORDER (top 40):')
for n, i in enumerate(order[:40], 1):
    p = byid[i]; d = dos[i]
    print(f"{n:2d}. {i} {borda[i]:4d} pts | {p['type']:9s} {p['form']:8s} | {p['category'][:34]:34s} | med ${d['income_median_y2_usd']:,} p={d['prob_reach_median']} top ${d['income_top_decile_usd']:,} | {p['name'][:60]}")
print('\nPER-JUDGE TOP 10:')
for j in judges: print(' ', j.get('lens'), j['ranking'][:10])
