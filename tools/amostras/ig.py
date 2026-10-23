#!/usr/bin/python3
"""Lê o perfil PÚBLICO de um Instagram (sem login): seguidores, posts e foto de perfil.
uso: python3 ig.py handle [handle ...]        -> uma linha JSON por perfil
Uma requisição por perfil, com pausa. Só dado que a própria página pública mostra."""
import html, json, re, sys, time, urllib.request

UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1"


def _num(txt):
    t = txt.replace(",", "").strip().upper()
    m = re.match(r"([\d.]+)\s*([KM]?)", t)
    if not m:
        return None
    v = float(m.group(1))
    return int(v * {"": 1, "K": 1e3, "M": 1e6}[m.group(2)])


def meta(handle):
    req = urllib.request.Request("https://www.instagram.com/%s/" % handle, headers={"User-Agent": UA})
    try:
        s = urllib.request.urlopen(req, timeout=20).read().decode("utf8", "replace")
    except Exception as e:
        return {"handle": handle, "ok": False, "erro": str(e)[:80]}
    d = re.search(r'og:description" content="([^"]*)', s)
    img = re.search(r'og:image" content="([^"]+)', s)
    if not d or not img:
        return {"handle": handle, "ok": False, "erro": "sem meta (login ou perfil inexistente)"}
    t = html.unescape(d.group(1))
    seg = re.search(r"([\d.,]+[KM]?)\s+Followers", t)
    posts = re.search(r"([\d.,]+[KM]?)\s+Posts", t)
    return {"handle": handle, "ok": True, "seguidores": _num(seg.group(1)) if seg else None,
            "posts": _num(posts.group(1)) if posts else None, "avatar": html.unescape(img.group(1))}


def baixa(url, destino):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    open(destino, "wb").write(urllib.request.urlopen(req, timeout=20).read())


if __name__ == "__main__":
    for h in sys.argv[1:]:
        m = meta(h)
        m.pop("avatar", None)
        print(json.dumps(m, ensure_ascii=False), flush=True)
        time.sleep(1.4)
