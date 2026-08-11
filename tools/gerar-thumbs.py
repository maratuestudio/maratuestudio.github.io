#!/usr/bin/env python3
"""Gera as variantes leves do catalogo e sobe pro R2.

Os originais no R2 sao PNG em resolucao de impressao (26 MB so nas capas dos
cards). O card mostra no maximo ~300 px de largura, entao o navegador baixava
100x mais bytes do que precisava. Aqui o original fica intacto e ganha dois
irmaos:

  thumbs/<caminho sem extensao>.webp   1000 px, limpa      -> card    (?t=1)
  wm/<caminho sem extensao>.webp       1400 px, com marca  -> ampliada (?w=1)

Isto e o lote das imagens antigas. Imagem nova ja sai assim do proprio admin,
por admin-imagens.js — as duas implementacoes da marca precisam bater.

Uso:
  python3 tools/gerar-thumbs.py            # so gera, em tools/thumbs-out
  python3 tools/gerar-thumbs.py --subir    # gera e sobe pro R2
"""
import json
import os
import subprocess
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor

from PIL import Image

import marca_dagua

API = "https://maratu-api.raphaelnascimento.workers.dev"
BUCKET = "maratu-catalog"
RAIZ = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(RAIZ, "thumbs-src")
OUT = os.path.join(RAIZ, "thumbs-out")
LARGURA = 1000   # cobre o card em 3x
QUALIDADE = 78


def pega(url, dest=None):
    # o Worker recusa o User-Agent padrao do urllib
    req = urllib.request.Request(url, headers={"User-Agent": "maratu-thumbs/1.0"})
    with urllib.request.urlopen(req) as r:
        dados = r.read()
    if dest:
        with open(dest, "wb") as f:
            f.write(dados)
    return dados


def chaves():
    cat = json.loads(pega(API + "/api/catalog"))
    ks = []
    for p in cat["produtos"]:
        for campo in ("imagem_principal", "imagem_hover"):
            if p.get(campo):
                ks.append(p[campo])
        for cor in (p.get("cores") or []):
            if cor.get("img"):
                ks.append(cor["img"])
    return sorted(set(ks))


def baixar(k):
    dest = os.path.join(SRC, k.replace("/", "__"))
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return dest
    pega(API + "/img/" + k, dest)
    return dest


def gerar(k):
    """Devolve (chave, bytes do original, {variante: arquivo local})."""
    origem = baixar(k)
    os.makedirs(OUT, exist_ok=True)
    base = os.path.splitext(k)[0].replace("/", "__")
    im = Image.open(origem)
    if im.mode not in ("RGB", "RGBA"):
        im = im.convert("RGBA" if "A" in im.getbands() else "RGB")

    mini = os.path.join(OUT, base + ".webp")
    peq = im
    if peq.width > LARGURA:
        peq = peq.resize((LARGURA, round(peq.height * LARGURA / peq.width)), Image.LANCZOS)
    peq.save(mini, "WEBP", quality=QUALIDADE, method=6)

    marca = os.path.join(OUT, base + ".wm.webp")
    marca_dagua.aplicar(im).save(
        marca, "WEBP", quality=marca_dagua.ESPEC["qualidade"], method=6)

    return k, os.path.getsize(origem), {"thumbs": mini, "wm": marca}


def subir(k, variante, arquivo):
    chave = variante + "/" + os.path.splitext(k)[0] + ".webp"
    cmd = ["npx", "--yes", "wrangler@4", "r2", "object", "put",
           f"{BUCKET}/{chave}", "--file", arquivo,
           "--content-type", "image/webp", "--remote"]
    r = subprocess.run(cmd, capture_output=True, text=True, cwd=RAIZ)
    return chave, r.returncode == 0, (r.stderr or r.stdout)[-300:]


def main():
    os.makedirs(SRC, exist_ok=True)
    ks = chaves()
    print(f"{len(ks)} imagens no catalogo")
    with ThreadPoolExecutor(6) as ex:
        feitos = list(ex.map(gerar, ks))
    antes = sum(a for _, a, _ in feitos)
    mini = sum(os.path.getsize(v["thumbs"]) for _, _, v in feitos)
    marca = sum(os.path.getsize(v["wm"]) for _, _, v in feitos)
    for k, a, v in sorted(feitos, key=lambda r: -r[1])[:8]:
        print(f"  {a/1e6:6.2f} MB -> {os.path.getsize(v['thumbs'])/1e3:5.0f} KB card"
              f" / {os.path.getsize(v['wm'])/1e3:5.0f} KB marcada   {k}")
    print(f"total: {antes/1e6:.1f} MB de original -> "
          f"{mini/1e6:.2f} MB em card + {marca/1e6:.2f} MB marcadas")

    if "--subir" not in sys.argv:
        print("\n(nada foi pro R2; rode com --subir)")
        return
    ruins = []
    envios = [(k, var, arq) for k, _, v in feitos for var, arq in v.items()]
    for k, var, arq in envios:
        chave, ok, log = subir(k, var, arq)
        print(("  ok  " if ok else "  ERRO ") + chave)
        if not ok:
            ruins.append((chave, log))
    for chave, log in ruins:
        print(f"\nfalhou {chave}:\n{log}")
    print(f"\nsubiram {len(envios) - len(ruins)}/{len(envios)}")


if __name__ == "__main__":
    main()
