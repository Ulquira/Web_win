import urllib.request
import time
import json

base = 'https://webwin-api-service-eus.azurewebsites.net'

endpoints = [
    '/api/4dm1n_/dashboard-stats?fechaInicio=2026-11-02&fechaFin=2026-11-02',
    '/api/4dm1n_/dashboard-stats?fechaInicio=2026-11-02&fechaFin=2026-11-02&grupoServicio=INSTALACION',
    '/api/4dm1n_/chats-dashboard-stats?fechaInicio=2026-11-02&fechaFin=2026-11-02',
    '/api/4dm1n_/chats-dashboard-stats?fechaInicio=2026-11-02&fechaFin=2026-11-02&grupoServicio=INSTALACION'
]

for ep in endpoints:
    url = base + ep
    t0 = time.time()
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=45) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            elapsed = time.time() - t0
            kpis = data.get('kpis', {})
            total = kpis.get('total_ots') or kpis.get('totalChats')
            print(f"[{resp.status}] in {elapsed:.2f}s | total={total} | {ep}")
    except Exception as e:
        elapsed = time.time() - t0
        print(f"[FAIL] in {elapsed:.2f}s | {ep} -> {e}")
