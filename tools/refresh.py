"""Build data/proxies.json for the tgPROXXY website.

Sources:
  1) 0xRadikal/Free-Telegram-Proxy        -> verified/proxies.json (FakeTLS + real DC check)
  2) tgmtproxy/telegram-mtproto-proxy-list -> proxies.txt (hourly "alive" list)

Usage:
  python tools/refresh.py              # 60 proxies
  python tools/refresh.py --limit 40   # custom size
"""

import argparse
import ipaddress
import json
import os
import re
import time
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 tgPROXXY-site"}
RAD = "https://raw.githubusercontent.com/0xRadikal/Free-Telegram-Proxy/main/verified/proxies.json"
TG = "https://raw.githubusercontent.com/tgmtproxy/telegram-mtproto-proxy-list/main/proxies.txt"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def http(url, timeout=60):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")


def build(limit):
    rad = json.loads(http(RAD))
    tg_text = http(TG)

    alive = set()
    for line in tg_text.splitlines():
        m = re.search(r"server=([^&]+)&port=(\d+)&secret=([0-9A-Za-z_\-+/=]+)", line)
        if m:
            alive.add((m.group(1).rstrip(".").lower(), int(m.group(2)), m.group(3)))

    cands = []
    for p in rad:
        if p.get("type") != "faketls":
            continue
        if p.get("uptime", 0) < 0.95:
            continue
        host = p["server"].rstrip(".").lower()
        if (host, p["port"], p["secret"]) not in alive:
            continue
        try:
            net = str(ipaddress.ip_network(p["ip"] + "/24", strict=False))
        except Exception:
            net = p.get("ip", host)
        cands.append({
            "server": host,
            "port": int(p["port"]),
            "secret": p["secret"],
            "country": p.get("country") or "??",
            "rtt": int(p.get("rtt_ms") or 9999),
            "uptime": round(float(p.get("uptime") or 0) * 100, 1),
            "net": net,
        })

    cands.sort(key=lambda x: x["rtt"])

    picked, hosts, nets, per_country = [], set(), set(), {}
    for p in cands:
        if p["server"] in hosts or p["net"] in nets:
            continue
        if per_country.get(p["country"], 0) >= 8:
            continue
        hosts.add(p["server"])
        nets.add(p["net"])
        per_country[p["country"]] = per_country.get(p["country"], 0) + 1
        picked.append(p)
        if len(picked) >= limit:
            break

    for p in picked:
        p.pop("net", None)
        p["link"] = "https://t.me/proxy?server={}&port={}&secret={}".format(
            p["server"], p["port"], p["secret"])
        p["tg"] = "tg://proxy?server={}&port={}&secret={}".format(
            p["server"], p["port"], p["secret"])

    return {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "count": len(picked),
        "sources": [
            "https://github.com/0xRadikal/Free-Telegram-Proxy",
            "https://github.com/tgmtproxy/telegram-mtproto-proxy-list",
        ],
        "proxies": picked,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=60)
    ap.add_argument("--out", default=os.path.join(ROOT, "data", "proxies.json"))
    args = ap.parse_args()

    data = build(args.limit)
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write("\n")

    print("{} proxies -> {}".format(data["count"], args.out))
    for p in data["proxies"][:10]:
        print("  {:>2} {:>5}ms up={:>3}% {}".format(
            p["country"], p["rtt"], int(p["uptime"]), p["server"]))


if __name__ == "__main__":
    main()
