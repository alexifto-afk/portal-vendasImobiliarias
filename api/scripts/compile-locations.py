"""Compile only municipality IDs/names from a versioned public reference snapshot."""
import hashlib
import json
import re
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

if len(sys.argv) != 3:
    raise SystemExit('Usage: python scripts/compile-locations.py estados.json municipios.json')
states_path, cities_path = map(Path, sys.argv[1:])
states = json.loads(states_path.read_text(encoding='utf-8-sig'))
cities = json.loads(cities_path.read_text(encoding='utf-8-sig'))
def key(value):
    return ''.join(c for c in unicodedata.normalize('NFD', value.casefold()) if not unicodedata.combining(c))
by_code = {row['codigo_uf']: row for row in states}
result = {row['uf']: {'name': row['nome'], 'cities': []} for row in states}
ids, names = set(), set()
for row in cities:
    code = str(row['codigo_ibge'])
    state = by_code[row['codigo_uf']]['uf']
    name = row['nome'].strip()
    if not re.fullmatch(r'\d{7}', code) or not code.startswith(str(row['codigo_uf'])) or not 2 <= len(name) <= 100:
        raise ValueError('Invalid municipality record')
    if code in ids or (state, key(name)) in names:
        raise ValueError('Duplicate municipality ID/name')
    ids.add(code); names.add((state, key(name)))
    result[state]['cities'].append([code, name])
if len(result) != 27 or len(cities) < 5571:
    raise ValueError('Incomplete municipality reference: must include 27 UFs and at least 5571 localities')
for row in result.values():
    row['cities'].sort(key=lambda city: (key(city[1]), city[0]))
folder = Path(__file__).resolve().parents[1] / 'data'
folder.mkdir(exist_ok=True)
# One municipality per line keeps the snapshot reviewable and compact.
lines = ['{']
for index, state in enumerate(sorted(result)):
    row = result[state]
    lines.append(f'  "{state}": {{"name": {json.dumps(row["name"], ensure_ascii=False)}, "cities": [')
    lines += ['    ' + json.dumps(city, ensure_ascii=False) + (',' if i < len(row['cities']) - 1 else '') for i, city in enumerate(row['cities'])]
    lines.append('  ]}' + (',' if index < len(result) - 1 else ''))
lines.append('}')
(folder/'brazil-cities.json').write_text('\n'.join(lines)+'\n', encoding='utf-8')
metadata = {
    'source': 'https://github.com/kelvins/municipios-brasileiros',
    'files': ['json/estados.json', 'json/municipios.json'],
    'consultedAt': datetime.now(timezone.utc).date().isoformat(),
    'license': 'MIT; see MUNICIPALITIES-LICENSE.txt',
    'rawSha256': {'states': hashlib.sha256(states_path.read_bytes()).hexdigest(), 'cities': hashlib.sha256(cities_path.read_bytes()).hexdigest()},
    'stateCount': len(result), 'cityCount': len(cities),
    'note': 'Municipality names/IBGE codes from the reference repository; direct IBGE API was unavailable during compilation. Boa Esperança do Norte (5101837) was independently confirmed on its IBGE city page.',
}
(folder/'brazil-cities-source.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2)+'\n',encoding='utf-8')
print(json.dumps({'states': len(result), 'cities': len(cities), 'TO': len(result['TO']['cities']), 'SP': len(result['SP']['cities'])}))
