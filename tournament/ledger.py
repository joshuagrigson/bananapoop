import json, glob, sys
pool = json.load(open('pool.json')); byid = {p['id']: p for p in pool}
dos = json.load(open('dossiers.json')); b = json.load(open('borda.json'))
order = b['order']; pts = b['borda']
# Head-to-head results (refereed pairs)
h2h = {}
for f in sorted(glob.glob('h2h-[0-9].json')):
    for r in json.load(open(f)): h2h[r['challenger_id']] = r
# Final top 10: start from Borda top 10, apply refereed upsets (challenger replaces incumbent), then swap substantive duplicates
top10 = order[:10]
notes = []
for c, r in h2h.items():
    if r.get('challenger_wins') and r['incumbent_id'] in top10 and c not in top10:
        top10[top10.index(r['incumbent_id'])] = c; notes.append(f"UPSET: {c} replaced {r['incumbent_id']}: {r['decisive_evidence']}")
    if r.get('same_business') and c in top10 and r['incumbent_id'] in top10:
        loser = c if not r.get('challenger_wins') else r['incumbent_id']
        top10.remove(loser); notes.append(f"DUPLICATE COLLAPSED: {loser} is the same business as its pair; slot freed")
# Fill freed slots from Borda order, honoring spread rules
def spread_ok(sel):
    t = [byid[i]['type'] for i in sel]; f = [byid[i]['form'] for i in sel]; c = [byid[i]['category'] for i in sel]
    return (t.count('trend') >= 2 and t.count('evergreen') >= 2 and t.count('unsolved') >= 2 and len(set(c)) == len(c)
            and f.count('job') >= 1 and f.count('business') >= 5)
for i in order:
    if len(top10) >= 10: break
    if i in top10 or dos[i]['fatal']: continue
    # a challenger that already lost its head-to-head cannot fill a slot ahead of one that has not been refereed unless nothing else fits
    if i in h2h and not h2h[i].get('challenger_wins'): continue
    if spread_ok(top10 + [i]) or len(top10) < 9: top10.append(i); notes.append(f"FILLED slot from Borda order with {i}")
assert len(top10) == 10, top10
print('SPREAD OK:', spread_ok(top10))
# Most comparable incumbent for each eliminated idea: same form first, then same type, then Borda-lowest incumbent
def comparable(i):
    p = byid[i]
    cands = [t for t in top10 if byid[t]['form'] == p['form'] and byid[t]['type'] == p['type']] or \
            [t for t in top10 if byid[t]['type'] == p['type']] or [t for t in top10 if byid[t]['form'] == p['form']] or top10
    return min(cands, key=lambda t: pts[t])
ledger = []
for n, i in enumerate(order, 1):
    if i in top10: continue
    d = dos[i]; p = byid[i]
    if i in h2h:
        r = h2h[i]; inc = r['incumbent_id']
        verdict = ('CHALLENGER WON' if r['challenger_wins'] else 'incumbent held') + f" (refereed): {r['decisive_evidence']}"
    else:
        inc = comparable(i)
        verdict = f"not refereed (panel rank {n}, {pts[i]} pts vs incumbent {pts[inc]}): {d['skeptic']}"
    ledger.append({'rank': n, 'id': i, 'name': p['name'], 'type': p['type'], 'form': p['form'], 'category': p['category'],
                   'beaten_by': inc, 'beaten_by_name': byid[inc]['name'], 'ev': d['ev'], 'median': d['income_median_y2_usd'],
                   'top': d['income_top_decile_usd'], 'p': d['prob_reach_median'], 'reason': verdict, 'fatal': d['fatal']})
json.dump({'top10': top10, 'notes': notes, 'ledger': ledger, 'h2h': h2h}, open('final.json', 'w'), indent=1)
print('\n'.join(notes))
print('\nFINAL TOP 10:')
for n, i in enumerate(top10, 1):
    p = byid[i]; d = dos[i]
    print(f"{n:2d}. {i} | {p['type']}/{p['form']} | {p['category']} | med ${d['income_median_y2_usd']:,} p={d['prob_reach_median']} top ${d['income_top_decile_usd']:,} cap ${d['capital_required_usd']:,} | {p['name']}")
print(f"\nledger entries: {len(ledger)}; refereed: {sum(1 for l in ledger if l['id'] in h2h)}")
