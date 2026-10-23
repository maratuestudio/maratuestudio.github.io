#!/usr/bin/python3
"""Monta a prévia de um prospecto: pega a foto de perfil do Instagram dele (página pública),
tira a cor da marca, guarda a logo no repositório, cria o endereço curto maratu.com.br/p/<handle>
e gera a imagem (computador + celular). Não envia nada pra ninguém e não grava no banco.

uso: python3 previa.py '{"handle":"cafebotanicopoa","nome":"Café Botânico","cidade":"Porto Alegre",
                         "tipo":"comercio","ramo":"cafe","consulta":"cafeteria","id":"pmvh..."}'
tipo: comercio (página) ou mei (painel). Precisa do servidor da prévia na 8750 (imagem local).
Imprime um JSON com o link, a cor, a imagem e o SQL que põe a prévia na fila da Abordagem."""
import colorsys, json, os, subprocess, sys, urllib.parse
from datetime import date
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import ig  # noqa: E402

RAIZ = os.path.abspath(os.path.join(AQUI, "..", ".."))
SAIDA = os.path.expanduser("~/Documents/Maratu Estúdio/Prospeccao/previas")
BASE = "https://maratu.com.br"

# o que a página mostra por nicho (o mesmo modelo, com os itens do ramo certo)
ITENS = {
    "hamburgueria": ("Hambúrgueres artesanais|Combos|Porções|Milk-shakes|Sobremesas|Delivery", "Hamburgueria"),
    "cafeteria": ("Café coado|Espresso e cappuccino|Bolos do dia|Pão de queijo|Sanduíches|Sucos e chás", "Cafeteria"),
    "salão de beleza": ("Corte|Coloração|Escova e penteado|Tratamentos capilares|Manicure e pedicure|Sobrancelha", "Salão de beleza"),
    "pet shop": ("Banho e tosa|Rações|Acessórios|Veterinário|Hotel pet|Entrega", "Pet shop"),
    "padaria": ("Pães do dia|Bolos|Salgados|Café da manhã|Encomendas|Entrega", "Padaria"),
    "restaurante": ("Prato do dia|Executivo|Porções|Sobremesas|Bebidas|Entrega", "Restaurante"),
}


def cor_da_marca(caminho):
    """Cor dominante e viva da foto de perfil, escurecida o bastante pra letra branca ler em cima."""
    im = Image.open(caminho).convert("RGB").resize((64, 64))
    q = im.quantize(colors=8, method=Image.Quantize.MEDIANCUT)
    pal = q.getpalette()[: 8 * 3]
    cont = sorted(q.getcolors(), reverse=True)
    melhor, nota_melhor = None, -1
    for n, idx in cont:
        r, g, b = pal[idx * 3: idx * 3 + 3]
        h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
        if l > 0.88 or l < 0.08:  # quase branco ou quase preto não é cor de marca
            continue
        nota = n * (0.25 + s)
        if nota > nota_melhor:
            melhor, nota_melhor = (h, l, s), nota
    if melhor is None:
        return "#1F3A2E"
    h, l, s = melhor
    l = min(l, 0.30)  # letra branca em cima precisa de contraste
    s = max(s, 0.35) if s > 0.12 else s
    r, g, b = colorsys.hls_to_rgb(h, l, s)
    return "#%02X%02X%02X" % (round(r * 255), round(g * 255), round(b * 255))


def main(c):
    h = c["handle"]
    m = ig.meta(h)
    if not m.get("ok"):
        return {"handle": h, "erro": m.get("erro")}
    os.makedirs(os.path.join(RAIZ, "modelos/amostra-pagina/logos"), exist_ok=True)
    bruto = "/tmp/claude-501/_av_%s.jpg" % h
    ig.baixa(m["avatar"], bruto)
    cor = c.get("cor") or cor_da_marca(bruto)
    logo = "logos/%s.jpg" % h
    Image.open(bruto).convert("RGB").resize((240, 240), Image.LANCZOS).save(os.path.join(RAIZ, "modelos/amostra-pagina", logo), quality=90)

    mei = c.get("tipo") == "mei"
    q = {"ramo": c["ramo"], "nome": c["nome"], "logo": logo, "cor": cor}
    if mei:
        ofic = {"personal trainer": ("treino", "Personal trainer"), "fisioterapeuta": ("saude", "Fisioterapia"),
                "confeitaria": ("encomenda", "Confeitaria")}.get(c.get("consulta", ""))
        if ofic:
            q["ramo"], q["oficio"] = ofic
    if not mei:
        if c.get("cidade"):
            q["cidade"] = c["cidade"]
        itens, tipo_txt = ITENS.get(c.get("consulta", ""), (None, None))
        if itens:
            q["itens"], q["tipo"] = itens, tipo_txt
    longo = "%s/modelos/%s/?%s" % (BASE, "painel-mei" if mei else "amostra-pagina", urllib.parse.urlencode(q))

    # endereço curto: maratu.com.br/p/<handle> leva à prévia completa
    pasta = os.path.join(RAIZ, "p", h)
    os.makedirs(pasta, exist_ok=True)
    open(os.path.join(pasta, "index.html"), "w").write(
        '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="robots" content="noindex">'
        '<meta name="viewport" content="width=device-width,initial-scale=1"><title>%s</title>'
        '<script>location.replace(%s)</script></head><body></body></html>' % (c["nome"].replace("<", ""), json.dumps(longo)))
    curto = "%s/p/%s" % (BASE, h)

    os.makedirs(SAIDA, exist_ok=True)
    img = os.path.join(SAIDA, h + ".png")
    local = dict(q)
    script = "painel.js" if mei else "pagina.js"
    subprocess.run(["node", os.path.join(AQUI, script), json.dumps(local), img], check=True, capture_output=True)

    sql = ("UPDATE prospec SET previa='%s', logo='%s', proximo='%s', passo=0, status='fila', seguidores=%s WHERE id='%s'"
           % (curto, logo, date.today().isoformat(), m.get("seguidores") or 0, c.get("id", "")))
    return {"handle": h, "link": curto, "cor": cor, "imagem": img, "seguidores": m.get("seguidores"), "posts": m.get("posts"), "sql": sql}


if __name__ == "__main__":
    print(json.dumps(main(json.loads(sys.argv[1])), ensure_ascii=False))
