// Bonjour Splendore: Paris em aquarela. O céu do Sky se desmancha em tinta, a fachada passa,
// depois: o jornal gira, a torre acende, o iPad vira parede, o Louvre se pinta e as peças caem na mesa.
(() => {
const { DPR, $, mouse, clamp, eio, carrega, progresso, visivel, cobre } = PF;
const sec = $('#splendore');
const PAPEL = '#F6F3EC';

const TINTA = `
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<6;i++){ s+=a*noise(p); p*=2.07; a*=.5; } return s; }
float tinta(vec2 u, float k, float sem){
  vec2 q = u*vec2(res.x/res.y,1.)*1.8;
  float n = fbm(q + sem + fbm(q*2.+sem)*.6)*.78 + (1.-u.y)*.22;
  return smoothstep(n-.03, n+.03, k*1.3-.15);
}
vec3 lavado(vec2 u){
  // papel com aguada azul, como o fundo das peças da campanha
  vec3 papel = vec3(.965,.953,.925), azul = vec3(.66,.8,.86);
  float n = fbm(u*vec2(res.x/res.y,1.)*1.4 + 4.);
  float b = smoothstep(.42,.78,n) * (.55 + .45*smoothstep(.0,.7,1.-u.y));
  return mix(papel, azul, b*.55) + (noise(u*res*.5)-.5)*.02;
}`;

/* ---------- abertura: céu do Sky > aquarela > fachada passando > papel com o nome ---------- */
const heroi = $('.sp-heroi'), cvH = $('#sp-cv'), titulo = $('#sp-titulo');
const fxH = PF.gl(cvH, `
uniform sampler2D P; uniform vec2 res, css, m; uniform float t, tom, k1, k2, pan, topo, par, veu;
${PF.CEU_SKY}
${TINTA}
vec2 fuv(vec2 u){
  // a fachada ocupa a altura toda e corre de lado com a rolagem
  float scr = res.x/res.y, alto = max(1., scr/par), larg = par*alto;
  return vec2((u.x*scr + pan*(larg - scr))/larg, (u.y - .5)/alto + .5);
}
vec3 fachada(vec2 u){
  vec2 f = fuv(u);
  if (veu < .01) return texture2D(P, f).rgb;
  // quando o nome chega, a fachada sai de foco, como lente de câmera
  float r = veu*.008; vec3 s = texture2D(P, f).rgb;
  for (int i = 0; i < 28; i++){ float a = float(i)*2.39996; float d = sqrt(float(i+1)/28.); s += texture2D(P, f + vec2(cos(a), sin(a)*par)*r*d).rgb; }
  return s/29.;
}
void main(){
  vec2 u = v, vp = vec2(v.x, v.y - topo);
  float m1 = tinta(u, k1, 3.1), m2 = tinta(u, k2, 9.7);
  float g = noise(u*90.)-.5;
  vec3 a = ceuSky(vp), b = fachada(u + vec2(g,-g)*.006*(1.-m1)*step(.001,k1)), c = lavado(u + vec2(-g,g)*.006*(1.-m2));
  vec3 col = mix(a, b, m1);
  float e1 = m1*(1.-m1)*4.*clamp(length(b-a)*2.5,0.,1.);
  col *= 1. - e1*.16;
  // o nome chega ao entardecer: a tela escurece num azul de Paris e as janelas acendem por dentro
  float azul = clamp((b.b - b.r)*3.2, 0., 1.) * m1;
  vec3 noite = col * vec3(.16, .21, .29) + vec3(.012, .025, .05);
  vec2 q = (u - vec2(.5,.48))*vec2(res.x/res.y, 1.);
  noite *= .62 + .38*smoothstep(.15, .95, length(q*vec2(.75,1.)));   // o centro mais fundo segura o texto
  vec3 luz = vec3(1., .76, .42) * (.5 + .4*b.g) * (.85 + .15*sin(t*.6 + u.x*7.));
  noite = mix(noite, luz*.8, azul*.75);
  col = mix(col, noite, veu*.9);
  // no fim, a tinta leva tudo pro papel
  float e2 = m2*(1.-m2)*4.*clamp(length(c-col)*2.5,0.,1.);
  col = mix(col, c, m2) * (1. - e2*.16);
  gl_FragColor = vec4(col, 1.);
}`);
let painel, parP = 2.5;
function tamH() { fxH.tamanho(innerWidth, innerHeight, Math.min(DPR, 1.5)); }

const im = {};
function monta() {
  tamH(); fxH.textura('P', 0, painel); parP = painel.naturalWidth / painel.naturalHeight;
}
const pronta = (async () => {
  const p = await carrega('/portfolio/img/spl-painel.webp');
  painel = p;
  monta();
})();
addEventListener('resize', () => painel && monta());

/* ---------- jornal, torre e parede ---------- */
const jornal = $('.sp-jornal'), papel = $('#jr-papel'), flash = $('#jr-flash');
const torre = $('.sp-torre'), cvT = $('#sp-torre-cv'), parede = $('.sp-parede'), cvP = $('#sp-parede-cv'), rotP = $('.sp-parede__rot');
const imT = {};
// o vídeo da fachada sendo desenhada no iPad vira textura e se pinta na parede de verdade
const ipad = Object.assign(document.createElement('video'), { src: '/portfolio/img/spl-video-fachada.mp4', muted: true, loop: true, playsInline: true, preload: 'none' });
ipad.setAttribute('playsinline', ''); ipad.setAttribute('muted', '');
const fxT = PF.gl(cvT, `
uniform sampler2D T; uniform vec2 res, m; uniform float t, ar, noite, brilho, aparece;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
vec2 cobre(vec2 u){ float scr = res.x/res.y; return scr > ar ? vec2(u.x, (u.y-.5)*ar/scr+.5) : vec2((u.x-.5)*scr/ar+.5, u.y); }
float torreEm(vec2 f){
  vec3 c = texture2D(T, f).rgb; float l = dot(c, vec3(.3,.59,.11));
  float verde = smoothstep(.04,.12, c.g - c.r);
  return smoothstep(.7,.48,l) * (1.-verde) * smoothstep(.1,.17,f.y) * smoothstep(.16,.0,abs(f.x-.5)-.06);
}
void main(){
  vec2 f = cobre(v); vec3 c = texture2D(T, f).rgb;
  float l = dot(c, vec3(.3,.59,.11)), verde = smoothstep(.04,.12, c.g - c.r);
  float ceu = smoothstep(.62,.8,l) * (1.-verde);
  // anoitece: o céu vira azul-noite, o resto escurece
  vec3 ceuNoite = mix(vec3(.03,.05,.12), vec3(.12,.16,.3), v.y*.6);
  vec3 nt = mix(c*vec3(.22,.26,.36), ceuNoite + c*.06, ceu);
  vec3 col = mix(c, nt, noite);
  // a estrutura aquece um pouco quando acende
  float tw = torreEm(f);
  // como a Eiffel de verdade: primeiro a estrutura acende dourada
  float ouro = clamp(brilho*1.8, 0., 1.);
  col = mix(col, vec3(1.,.72,.3)*(.55 + .7*(1.-l)), tw*ouro*.85);
  col += vec3(1.,.6,.2)*tw*ouro*.12;
  // centelhas: cada célula da torre pisca no seu ritmo
  vec2 px = v*res; float cel = 7.*res.y/900.;
  vec2 id = floor(px/cel), cc = (id+.5)*cel;
  float h = hash(id);
  vec2 fc = cobre(cc/res);
  float naTorre = torreEm(fc);
  float mouse = exp(-dot((cc/res - m)*vec2(res.x/res.y,1.), (cc/res - m)*vec2(res.x/res.y,1.))/.012);
  float pisca = pow(max(0., sin(t*(2.+h*5.) + h*40.)), 10.) * step(.6 - mouse*.4, h) * clamp(brilho*2.-1., 0., 1.);
  vec2 d = (px - cc)/cel;
  float estrela = max(0., 1. - length(d)*2.2) + max(0., 1. - abs(d.x)*9.)*max(0.,1.-abs(d.y)*1.6)*.6 + max(0., 1. - abs(d.y)*9.)*max(0.,1.-abs(d.x)*1.6)*.6;
  // depois as centelhas brancas piscam por cima
  col += vec3(1.,.97,.9) * estrela * pisca * smoothstep(.15,.5,naTorre) * 2.2;
  // entra nascendo do papel: no encontro com a cena anterior a cor é a mesma
  gl_FragColor = vec4(mix(vec3(.965,.953,.925), col, aparece), 1.);
}`);
const fxP = PF.gl(cvP, `
uniform sampler2D A, B; uniform vec2 res, arA, arB; uniform float t, k, aparece;
${TINTA}
vec2 cobre(vec2 u, float ar){ float scr = res.x/res.y; return scr > ar ? vec2(u.x, (u.y-.5)*ar/scr+.5) : vec2((u.x-.5)*scr/ar+.5, u.y); }
void main(){
  vec2 u = v; float m1 = tinta(u, k, 5.3); float g = noise(u*90.)-.5;
  vec3 a = texture2D(A, cobre(u, .5625) + vec2(0., -.04)).rgb, b = texture2D(B, cobre(u + vec2(g,-g)*.006*(1.-m1), .5625) + vec2(0., .06)).rgb;
  vec3 col = mix(a, b, m1) * (1. - m1*(1.-m1)*4.*clamp(length(b-a)*2.5,0.,1.)*.16);
  gl_FragColor = vec4(mix(vec3(.965,.953,.925), col, aparece), 1.);
}`);
function montaExtras() {
  const esc = Math.min(DPR, 1.5);
  fxT.tamanho(innerWidth, innerHeight, esc); fxT.textura('T', 0, imT.torre);
  fxP.tamanho(innerWidth, innerHeight, esc); fxP.textura('B', 1, imT.real); if (ipad.readyState >= 2) fxP.textura('A', 0, ipad);
}
const prontaExtras = Promise.all([carrega('/portfolio/img/spl-eiffel.webp'), carrega('/portfolio/img/spl-parede-real.webp')]).then(([a, b]) => { imT.torre = a; imT.real = b; });
Promise.all([prontaExtras]).then(() => { const f = () => painel ? montaExtras() : setTimeout(f, 100); f(); });
addEventListener('resize', () => imT.torre && painel && montaExtras());

/* ---------- peças: chegam grandes e caem na mesa uma sobre a outra ---------- */
const pilha = $('.sp-pilha'), plItens = [...document.querySelectorAll('.pl-item')], plNome = $('#pl-nome');
const plGiro = plItens.map((_, i) => ((i * 47) % 11 - 5) * .9), plDx = plItens.map((_, i) => ((i * 31) % 9 - 4) * 1.2);
let plAtual = -1;
function quadroPilha() {
  if (!visivel(pilha)) return;
  const p = progresso(pilha), n = plItens.length, pos = p * (n - .4);
  plItens.forEach((el, i) => {
    const k = i === 0 ? 1 : clamp(pos - i + .6);   // 0 = fora, embaixo; 1 = pousada (a primeira já chega pousada)
    const e = 1 - Math.pow(1 - k, 3);
    const y = (1 - e) * 110, rot = plGiro[i] + (1 - e) * 14 * (i % 2 ? 1 : -1), sc = 1.12 - .12 * e;
    const baixo = clamp(pos - i - .4);           // as de baixo apagam um pouco quando a próxima pousa
    el.style.transform = `translate(calc(-50% + ${plDx[i]}vw), calc(-50% + ${y.toFixed(2)}vh)) rotate(${rot.toFixed(2)}deg) scale(${sc.toFixed(3)})`;
    // fica só a peça da vez: a de baixo some quando a próxima pousa
    el.style.opacity = k <= 0 ? 0 : (1 - eio(baixo)).toFixed(3);
    el.style.filter = '';
    el.style.zIndex = i + 1;
  });
  const i = clamp(Math.floor(pos + .2), 0, n - 1);
  if (i !== plAtual) { plAtual = i; plNome.textContent = plItens[i].querySelector('img').alt; }
}

/* ---------- o resto: profundidade na rolagem, vídeos e faixa de monumentos ---------- */
const flutuam = [...sec.querySelectorAll('[data-vel]')];
const videos = [...sec.querySelectorAll('.sp-processo video')], processo = $('.sp-processo');

function quadro(ms) {
  if (!visivel(sec)) { cvH.style.visibility = 'hidden'; return; }
  const t = PF.tempo(ms), mm = [mouse.x / innerWidth, 1 - mouse.y / innerHeight];
  if (!visivel(heroi)) cvH.style.visibility = 'hidden';
  if (visivel(heroi) && painel) {
    const r = heroi.getBoundingClientRect(), H = innerHeight;
    const p = clamp(-r.top / (r.height - H));
    // canvas fixo na tela; só o recorte acompanha a seção (na borda os dois lados mostram o mesmo céu)
    const topo = 0;
    cvH.style.visibility = 'visible';
    cvH.style.clipPath = `inset(${Math.max(0, r.top).toFixed(0)}px 0 ${Math.max(0, H - r.bottom).toFixed(0)}px 0)`;
    const k1 = eio(clamp(p / .2)), pan = clamp((p - .1) / .76), k2 = eio(clamp((p - .84) / .14));
    const tt = clamp((p - .3) / .1), veu = eio(clamp((p - .26) / .12));
    fxH.desenha({ res: [cvH.width, cvH.height], css: [innerWidth, innerHeight], m: mm, t, tom: PF.skyTom || 0, k1, k2, pan, topo, par: parP, veu });
    titulo.style.opacity = Math.min(tt, clamp((r.bottom - H) / (H * .28)));   // some antes do jornal subir titulo.style.transform = `translateY(${((1 - tt) * 3).toFixed(2)}vh)`;
    // negativo > positivo: quando a tinta clareia a tela, o nome escurece junto
    titulo.classList.toggle('claro', k2 > .45);
  }
  for (const el of flutuam) {
    const r = el.getBoundingClientRect(); if (r.bottom < -200 || r.top > innerHeight + 200) continue;
    const d = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
    el.style.translate = `0 ${(-d * +el.dataset.vel * 120).toFixed(1)}px`;
  }
  quadroPilha();
  // o Louvre pronto anda devagar atrás do vídeo
  const lf = $('#sp-louvre-fundo');
  if (lf && visivel(processo)) { const r = processo.getBoundingClientRect(), k = clamp(1 - (r.top + r.height) / (innerHeight + r.height)); lf.style.transform = `translateX(${((k - .5) * -8).toFixed(2)}%) scale(${(1.04 + k * .06).toFixed(3)})`;
    lf.style.opacity = eio(clamp(1 - r.top / innerHeight)).toFixed(3); }
  const perto = processo.getBoundingClientRect(), ve = perto.top < innerHeight * 1.5 && perto.bottom > -innerHeight * .5;
  videos.forEach(v => {
    if (ve && v.preload !== 'auto') { v.preload = 'auto'; v.load(); }
    const vr = v.getBoundingClientRect(), dentro = vr.top < innerHeight && vr.bottom > 0;
    if (dentro && v.paused && !PF.reduzir) v.play().catch(() => {}); else if (!dentro && !v.paused) v.pause();
  });
  // o jornal gira como nos filmes antigos e para na manchete
  if (visivel(jornal)) {
    const p = progresso(jornal), k = 1 - Math.pow(1 - clamp(p / .55), 3);
    papel.style.transform = `translate(-50%,-50%) rotate(${((1 - k) * 1260).toFixed(1)}deg) scale(${(.03 + .97 * k).toFixed(4)})`;
    flash.style.opacity = (Math.max(0, 1 - Math.abs(p - .56) / .06) * .55).toFixed(3);
  }
  // a torre anoitece e pisca em dourado; perto do mouse, brilha mais
  if (visivel(torre) && imT.torre) {
    const p = progresso(torre);
    fxT.desenha({ res: [cvT.width, cvT.height], ar: imT.torre.naturalWidth / imT.torre.naturalHeight, t, m: mm, aparece: eio(clamp(1 - torre.getBoundingClientRect().top / innerHeight)), noite: eio(clamp(p / .3)) * (1 - eio(clamp((p - .84) / .16))), brilho: clamp((p - .25) / .3) * (1 - clamp((p - .84) / .1)) });
  }
  // o vídeo da fachada sendo desenhada no iPad vira a foto da parede de verdade
  if (visivel(parede) && imT.real) {
    const p = progresso(parede);
    if (ipad.preload !== 'auto') { ipad.preload = 'auto'; ipad.load(); }
    if (ipad.paused && !PF.reduzir) ipad.play().catch(() => {});
    if (ipad.readyState >= 2) fxP.textura('A', 0, ipad);
    fxP.desenha({ res: [cvP.width, cvP.height], t, k: eio(clamp((p - .3) / .4)), aparece: eio(clamp(1 - parede.getBoundingClientRect().top / innerHeight)) });
    rotP.style.opacity = clamp((p - .6) / .12);
  } else if (!ipad.paused) ipad.pause();
  // começa a baixar o vídeo do iPad quando a torre aparece
  if (visivel(torre) && ipad.preload !== 'auto') { ipad.preload = 'auto'; ipad.load(); }
}

PF.registra({ id: 'splendore', cor: PAPEL, pronta, quadro, chegada: () => (heroi.offsetHeight - innerHeight) * .8 });
})();
