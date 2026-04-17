# MARATU \u2014 p\u00e1ginas de teste de redesign

Arquivos com prefixo `teste-` para rodar em paralelo ao site atual sem substituir nada.

## Como usar

1. Copia todos os arquivos `teste-*.html`, `teste-style.css` e `teste-script.js` para a raiz do reposit\u00f3rio do site MARATU no GitHub.
2. Se as fontes Jack e Clother j\u00e1 est\u00e3o na pasta `fonts/` do site principal, elas v\u00e3o funcionar automaticamente (o CSS aponta pra `fonts/`). Se n\u00e3o estiverem, ajuste o caminho em `teste-style.css` nas primeiras linhas `@font-face`.
3. Faz commit e push. Acessa:
   - `maratu.com.br/teste-index.html` (home)
   - `maratu.com.br/teste-estudio.html`
   - `maratu.com.br/teste-colecoes.html`
   - `maratu.com.br/teste-origens.html`
   - `maratu.com.br/teste-mangue-haus.html`
   - `maratu.com.br/teste-objetos.html`
   - `maratu.com.br/teste-feira.html`
   - `maratu.com.br/teste-produto.html`
   - `maratu.com.br/teste-contato.html`

## Mapa de p\u00e1ginas

| Arquivo | Fun\u00e7\u00e3o |
|---|---|
| `teste-index.html` | home, narrativa + vitrine |
| `teste-estudio.html` | sobre o est\u00fadio |
| `teste-colecoes.html` | \u00edndice dos volumes |
| `teste-origens.html` | cole\u00e7\u00e3o Origens (10 posters) |
| `teste-mangue-haus.html` | cole\u00e7\u00e3o Mangue Haus |
| `teste-objetos.html` | cole\u00e7\u00e3o Objetos 3D, status "em breve" |
| `teste-feira.html` | loja geral (ex-Feira MARATU, unificada) |
| `teste-produto.html` | template de p\u00e1gina individual |
| `teste-contato.html` | contato |

## Decis\u00f5es de design

### Paleta (redistribu\u00edda por fun\u00e7\u00e3o)
- **Areia Orla** (#F0ECE4) \u2014 fundo base
- **Preto Mangue** (#0D0D0B) \u2014 tipografia e se\u00e7\u00f5es de contraste
- **Laranja Caju** (#C8501A) \u2014 CTAs, destaques, sinaliza\u00e7\u00e3o
- **Azul Sergipe** (#0E3272) \u2014 backgrounds de cole\u00e7\u00e3o
- **Azul Atalaia** (#2E6FC4) \u2014 reserva pra usos pontuais
- **Dourado Sol** (#D4960A) \u2014 ornamento raro

### Tipografia
- **Jack** \u2014 display, tamanhos absurdos (at\u00e9 22rem no hero)
- **Clother** \u2014 corpo
- **JetBrains Mono** \u2014 labels t\u00e9cnicos, fichas, meta-informa\u00e7\u00f5es

A Space Mono foi descartada como voc\u00ea queria.

### Gramatica bauhaus tropical
- Grade de 12 colunas vis\u00edvel (aperta tecla `G` pra ver a grade sobreposta, funciona em qualquer p\u00e1gina)
- Labels t\u00e9cnicos nos cantos (tipo `01 / manifesto`, `vol. 02`) reforçam a estética de documento editorial
- Desconstru\u00e7\u00e3o por deslocamento: produtos com `transform: translateY(40px)` quebram o alinhamento da grade
- Alfabeto de semic\u00edrculos animado no manifesto da home, gerado via `clip-path` (n\u00e3o precisa de imagem)

### Intera\u00e7\u00f5es
- Cursor custom laranja (vira areia com blend-difference em contextos pretos/azuis)
- Scroll reveal com delays escalonados
- Header some ao rolar pra baixo, reaparece ao subir
- Menu mobile em overlay full-screen
- Transi\u00e7\u00e3o de entrada (cortina laranja deslizando pra cima)
- Hover nos itens da vitrine sobe 8px
- Hover no \u00edndice de cole\u00e7\u00f5es inverte cor (fundo preto, texto areia)

### Mobile
Experi\u00eancia equivalente, n\u00e3o reduzida:
- Grid redistribui (colunas vs full-width), n\u00e3o colapsa
- Tipografia mant\u00e9m escala agressiva proporcional
- Menu overlay com itens em Jack gigante
- Cursor custom desativado, usa cursor nativo

## Pontos de aten\u00e7\u00e3o

1. **Imagens dos posters**: as p\u00e1ginas est\u00e3o com placeholders. Substituir as `.vitrine__media-placeholder` e `.produto__media` por `<img>` com os arquivos reais das cole\u00e7\u00f5es quando estiverem prontos.
2. **Telefone do WhatsApp**: est\u00e1 como `5579999999999`. Trocar pelo n\u00famero real do est\u00fadio.
3. **E-mail**: `ola@maratu.com.br` \u2014 confirma se \u00e9 esse o endere\u00e7o definitivo.
4. **Form de newsletter**: s\u00f3 tem comportamento visual (bot\u00e3o muda pra "assinado"). Integrar com Brevo/Cloudflare como est\u00e1 no site atual pra valer.
5. **P\u00e1gina de produto**: o bot\u00e3o de encomendar gera mensagem din\u00e2mica pro WhatsApp baseada no tamanho selecionado.
6. **Fontes**: se as fontes Jack e Clother estiverem em outro caminho que n\u00e3o `fonts/`, ajustar os `@font-face` no topo de `teste-style.css`.

## Easter egg

Em qualquer p\u00e1gina, aperta `G` no teclado. A grade de 12 colunas fica vis\u00edvel por cima de tudo. \u00datil pra conferir alinhamentos e pra mostrar o DNA bauhaus do site.
