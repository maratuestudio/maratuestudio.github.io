#!/usr/bin/env python3
"""Gera as miniaturas WebP do catalogo e sobe pro R2 em thumbs/.

Os originais no R2 sao PNG em resolucao de impressao (26 MB so nas capas dos
cards). O card mostra no maximo ~300 px de largura, entao o navegador baixava
100x mais bytes do que precisava. Aqui o original fica intacto e ganha um
irmao leve: thumbs/<caminho sem extensao>.webp.

Uso:
  python3 tools/gerar-thumbs.py            # gera em tools/thumbs-out
  python3 tools/gerar-thumbs.py --subir    # gera e sobe pro R2
"""
import json
import os
import subprocess
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor

from PIL import Image

API = "https://maratu-api.raphaelnascimento.workers.dev"
BUCKET = "maratu-catalog"
RAIZ = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(RAIZ, "thumbs-src")
OUT = os.path.join(RAIZ, "thumbs-out")
LARGURA = 1000   # cobre o card em 3x e ainda serve o lightbox
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
    origem = baixar(k)
    destino = os.path.join(OUT, os.path.splitext(k)[0].replace("/", "__") + ".webp")
    os.makedirs(OUT, exist_ok=True)
    im = Image.open(origem)
    if im.mode not in ("RGB", "RGBA"):
        im = im.convert("RGBA" if "A" in im.getbands() else "RGB")
    if im.width > LARGURA:
        im = im.resize((LARGURA, round(im.height * LARGURA / im.width)), Image.LANCZOS)
    im.save(destino, "WEBP", quality=QUALIDADE, method=6)
    return k, os.path.getsize(origem), os.path.getsize(destino), destino


def subir(k, arquivo):
    chave = "thumbs/" + os.path.splitext(k)[0] + ".webp"
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
    antes = sum(a for _, a, _, _ in feitos)
    depois = sum(d for _, _, d, _ in feitos)
    for k, a, d, _ in sorted(feitos, key=lambda r: -r[1])[:8]:
        print(f"  {a/1e6:6.2f} MB -> {d/1e3:6.0f} KB  {k}")
    print(f"total: {antes/1e6:.1f} MB -> {depois/1e6:.2f} MB "
          f"({100 - depois/antes*100:.0f}% a menos)")

    if "--subir" not in sys.argv:
        print("\n(nada foi pro R2; rode com --subir)")
        return
    ruins = []
    for k, _, _, arquivo in feitos:
        chave, ok, log = subir(k, arquivo)
        print(("  ok  " if ok else "  ERRO ") + chave)
        if not ok:
            ruins.append((chave, log))
    for chave, log in ruins:
        print(f"\nfalhou {chave}:\n{log}")
    print(f"\nsubiram {len(feitos) - len(ruins)}/{len(feitos)}")


if __name__ == "__main__":
    main()
