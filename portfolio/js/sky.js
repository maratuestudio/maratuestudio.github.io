// Camarote Sky: a noite cai, as manchas fluidas da campanha seguem o mouse, cada atração é um passe.
(() => {
const { DPR, $, mouse, clamp, eio, eout, carrega, progresso, visivel } = PF;
const sec = $('#sky'), fundo = $('#sk-cv');
const ATRACOES = [
  ['gaabio', 'Gaabio'], ['jao', 'Jão Luís'], ['karl', 'Karl'], ['lcr', 'LCR'], ['maysa', 'Maysa Reis'], ['melo', 'Melo'], ['navi', 'Navi'],
];

/* ---------- fundo: manchas fluidas num shader ---------- */
// o céu do Sky como função: a Splendore desenha o mesmo céu pra a aquarela desmanchar sem emenda
// precisa de: uniform float t, tom; uniform vec2 m, css;
PF.CEU_SKY = `
float s_hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float s_noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(s_hash(i),s_hash(i+vec2(1,0)),f.x), mix(s_hash(i+vec2(0,1)),s_hash(i+vec2(1,1)),f.x), f.y); }
float s_fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s+=a*s_noise(p); p*=2.03; a*=.5; } return s; }
float s_suave(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*f*(f*(f*6.-15.)+10.);
  return mix(mix(s_hash(i),s_hash(i+vec2(1,0)),f.x), mix(s_hash(i+vec2(0,1)),s_hash(i+vec2(1,1)),f.x), f.y); }
float s_onda(vec2 p){ return s_suave(p)*.7 + s_suave(p*1.9+3.1)*.3; }
float s_forma(vec2 p, vec2 c, float r, float sem, vec2 mm){
  vec2 q = p - c;
  float w = s_onda(q*1.1 + vec2(sem, t*.035)) - .5;
  float d = r - length(q*vec2(1., 1.12)) + w*.38;
  d += .07*exp(-dot(p-mm, p-mm)/.05);
  return d;
}
vec3 ceuSky(vec2 v){
  vec2 asp = vec2(css.x/css.y, 1.), p = v*asp, mm = m*asp;
  vec3 col = vec3(.02,.025,.11);
  vec2 g = fract(v*css/13.)-.5; float pt = smoothstep(.12,.07,length(g)) * smoothstep(.55,.7,s_fbm(v*2.2 + t*.01)) * .22;
  col += vec3(.45,.4,1.)*pt;
  float sh = sin(tom*3.)*.06;
  float dC = s_forma(p, vec2(asp.x*.36 + sh, 1.04), .42, 7., mm);
  vec3 cC = mix(vec3(.35,.1,.7), vec3(.75,.15,.75), smoothstep(.6,1.,v.y));
  col = mix(col, cC*.75, smoothstep(-.06,.06,dC)*.85);
  float dB = s_forma(p, vec2(-.02, .24 - sh), .36, 3., mm);
  vec3 cB = mix(vec3(.12,.25,1.), vec3(.45,.85,1.), smoothstep(.0,.45,v.y) * (1.-smoothstep(.0,.25,p.x)));
  cB = mix(cB, vec3(.85,.97,1.), (1.-smoothstep(0.,.045,dB))*.75);
  col = mix(col, cB, smoothstep(-.004,.004,dB));
  col += cB*exp(-max(-dB,0.)*30.)*.18*step(dB,0.);
  float dA = s_forma(p, vec2(asp.x*.97, .04 + sh), .64, 1., mm);
  vec3 cA = mix(vec3(.88,.15,.82), vec3(1.,.35,.55), smoothstep(.0,.3,v.y));
  cA = mix(cA, vec3(1.,.82,.45), smoothstep(.32,.62,v.y));
  cA *= .9 + .12*smoothstep(0.,.25,dA);
  cA = mix(cA, vec3(1.,.95,.88), (1.-smoothstep(0.,.05,dA))*.5);
  col = mix(col, cA, smoothstep(-.004,.004,dA));
  col += cA*exp(-max(-dA,0.)*28.)*.2*step(dA,0.);
  float dD = s_forma(p, vec2(asp.x*.12 - sh, .9), .09, 5., mm);
  vec3 cD = mix(vec3(1.,.5,.6), vec3(1.,.8,.5), smoothstep(.8,1.,v.y));
  cD = mix(cD, vec3(1.,.96,.9), (1.-smoothstep(0.,.03,dD))*.45);
  col = mix(col, cD, smoothstep(-.004,.004,dD));
  return col;
}`;
const fx = PF.gl(fundo, `
uniform vec2 res, css; uniform float t, noite, tom, topo; uniform vec2 m;
${PF.CEU_SKY}
void main(){
  // antes da noite, o fundo vem do preto do fim da Tropicalíssima
  // no fim da seção o fundo sobe com a página; desenha no lugar da tela, igual à Splendore
  gl_FragColor = vec4(mix(vec3(.067), ceuSky(vec2(v.x, v.y - topo)), noite), 1.);
}`);
function tamanho() { fx.tamanho(innerWidth, innerHeight, Math.min(DPR, 1.25)); }
tamanho(); addEventListener('resize', tamanho);

/* ---------- passes ---------- */
const lineup = $('.sk-line'), pilha = $('#sk-passes'), nome = $('#sk-nome'), cont = $('#sk-cont');
const passes = ATRACOES.map(([id, n], i) => {
  const d = document.createElement('button');
  d.className = 'passe'; d.setAttribute('aria-label', n);
  d.innerHTML = `<img src="/portfolio/img/sky-at-${id}.webp" alt="${n}, atração confirmada"><i class="passe__brilho"></i><span class="passe__furo"></span>`;
  pilha.appendChild(d); return d;
});
let atual = -2, tomAlvo = 0, tom = 0, foco = -1;
// os sete juntos, em leque; o mouse levanta um de cada vez
function nomeia(i) {
  if (i === atual) return; atual = i;
  nome.textContent = i < 0 ? '' : ATRACOES[i][1]; nome.classList.remove('entra'); void nome.offsetWidth; if (i >= 0) nome.classList.add('entra');
  cont.textContent = i < 0 ? `${ATRACOES.length} atrações` : `${String(i + 1).padStart(2, '0')} / ${String(ATRACOES.length).padStart(2, '0')}`;
  tomAlvo = Math.max(0, i) * .14;
}
passes.forEach((d, i) => {
  d.addEventListener('pointerenter', () => { foco = i; });
  d.addEventListener('pointerleave', () => { if (foco === i) foco = -1; });
  d.addEventListener('click', () => { foco = foco === i ? -1 : i; });
});
function leque(abre) {
  const n = passes.length, meio = (n - 1) / 2, larg = passes[0].offsetWidth;
  const celular = innerWidth < 700;
  passes.forEach((d, j) => {
    const k = j - meio, ativo = j === foco;
    const x = k * larg * (celular ? .42 : .78) * abre;
    const y = k * k * 6 * abre + (ativo ? -innerHeight * .06 : 0);
    const rot = k * 6 * abre;
    d.style.setProperty('--tx', x.toFixed(1) + 'px'); d.style.setProperty('--ty', y.toFixed(1) + 'px');
    d.style.setProperty('--rot', (ativo ? 0 : rot).toFixed(2) + 'deg'); d.style.setProperty('--sc', ativo ? 1.12 : 1);
    d.style.zIndex = ativo ? 99 : 50 - Math.round(Math.abs(k));
    d.classList.toggle('frente', ativo);
    if (!ativo) { d.style.setProperty('--rx', '0deg'); d.style.setProperty('--ry', '0deg'); }
  });
}
let iniciou = false;
const caixaFundo = $('.sk-fundo');
function quadro(ms) {
  // o céu é fixo na tela e só aparece enquanto o Sky está à vista
  if (!visivel(sec)) { caixaFundo.style.visibility = 'hidden'; return; }
  caixaFundo.style.visibility = 'visible';
  const t = PF.tempo(ms);
  const r = sec.getBoundingClientRect();
  const noite = eio(clamp(1 - r.top / innerHeight));
  tom += (tomAlvo - tom) * .05;
  PF.skyTom = tom;
  fx.desenha({ res: [fundo.width, fundo.height], css: [innerWidth, innerHeight], topo: fundo.getBoundingClientRect().top / innerHeight, t, noite, tom, m: [mouse.x / innerWidth, 1 - mouse.y / innerHeight] });
  sec.style.setProperty('--noite', noite.toFixed(3));
  // passes em leque
  if (visivel(lineup)) {
    leque(eout(clamp(progresso(lineup) * 1.6 + .15)));
    nomeia(foco);
    if (foco >= 0) {
      const f = passes[foco], b = f.getBoundingClientRect();
      const dx = (mouse.x - (b.left + b.width / 2)) / innerWidth, dy = (mouse.y - (b.top + b.height / 2)) / innerHeight;
      f.style.setProperty('--rx', (-dy * 18).toFixed(2) + 'deg'); f.style.setProperty('--ry', (dx * 22).toFixed(2) + 'deg');
      f.style.setProperty('--bx', (50 + dx * 120).toFixed(1) + '%');
    }
  }

}

const pronta = Promise.resolve();
PF.registra({ id: 'sky', cor: '#090B2A', pronta, quadro, chegada: () => innerHeight * 1.2 });
})();
