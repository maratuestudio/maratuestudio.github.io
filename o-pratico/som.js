// Paisagem sonora d'O Pratico: mar a noite, mistico, um pouco de suspense. Sem melodia fixa.
// Backup da versao esoterica (coro + harmonicos + tigela): som_antes_mar.js
// Camadas:
//  1. Ondas: ruido que vem, quebra e recua em ciclos de 7 a 12 s, alternando esquerda e direita.
//  2. Fundo do mar: re grave com um mi bemol encostado (segunda menor), batimento lento = tensao.
//  3. Coro afogado: vozes em "u", bem baixas, por baixo de tudo.
//  4. Harmonica de vidro (a tampura saiu a pedido dele; backup som_com_tampura.js) em notas soltas, escala frigia dominante.
//     Rabeca com eco ping-pong e nuvem de sintetizador uma oitava acima. Versao alta e seca: som_violino_alto.js
//     Rabeca: melodia de ida e volta (8 notas, ~11 s) a cada 40 a 60 s. Notas reais de violino (viol.js); versao sintetica: som_rabeca_sintetica.js. Backup sem ela: som_antes_rabeca.js
//     O canto de baleia saiu (ele achou uivo de terror); backup som_com_baleia.js
//  5. Sino de boia: 2 ou 3 badaladas irregulares, longe, a cada 30 a 45 s.
//  6. Buzina de navio no nevoeiro: grave e longa, a cada 60 a 90 s.
// Tudo passa por uma sala longa (7 s). Mesmo codigo roda ao vivo e gravado (OfflineAudioContext).
// Leve: 1 buffer de ruido compartilhado, 1 convolver, osciladores dos eventos param sozinhos.
(function (global) {
  function Mar(ctx, saida) {
    const sr = ctx.sampleRate, R = Math.random, T0 = ctx.currentTime;
    const fora = ctx.createGain(); fora.gain.value = 1.7; fora.connect(saida); saida = fora;
    const mk = (seg, f) => { const b = ctx.createBuffer(2, sr * seg, sr); for (let c = 0; c < 2; c++) f(b.getChannelData(c)); return b; };
    const filtro = (t, f, q = .7) => { const x = ctx.createBiquadFilter(); x.type = t; x.frequency.value = f; x.Q.value = q; return x; };
    const ganho = v => { const g = ctx.createGain(); g.gain.value = v; return g; };
    const pan = v => { if (!ctx.createStereoPanner) return ganho(1); const p = ctx.createStereoPanner(); p.pan.value = v; return p; };
    const osc = (tipo, f, det = 0, t = T0) => { const o = ctx.createOscillator(); o.type = tipo; o.frequency.value = f; o.detune.value = det; o.start(t); return o; };

    // ruido rosa (mais "agua" que o marrom), 8 s, em loop
    const rosa = mk(8, d => {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < d.length; i++) {
        const w = R() * 2 - 1;
        b0 = .99886 * b0 + w * .0555179; b1 = .99332 * b1 + w * .0750759; b2 = .969 * b2 + w * .153852;
        b3 = .8665 * b3 + w * .3104856; b4 = .55 * b4 + w * .5329522; b5 = -.7616 * b5 - w * .016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * .5362) * .11; b6 = w * .115926;
      }
    });
    const ruido = (t, o = 0) => { const s = ctx.createBufferSource(); s.buffer = rosa; s.loop = true; s.start(t, o); return s; };

    // sala: cauda longa e escura
    const sala = ctx.createConvolver();
    sala.buffer = mk(7, d => { let v = 0; for (let i = 0; i < d.length; i++) { v = v * .6 + (R() * 2 - 1) * .4; d[i] = v * Math.pow(1 - i / d.length, 2.6); } });
    const salaG = ganho(.55); sala.connect(salaG).connect(saida);
    const seco = ganho(1); seco.connect(saida);
    const longe = ganho(1); longe.connect(filtro('lowpass', 1800)).connect(sala);   // o que esta longe so chega pela sala

    // 1. ondas: duas vozes de onda (esq. e dir.), cada uma com corpo grave + espuma aguda
    const ondas = [-.55, .55].map((p, k) => {
      const pp = pan(p); pp.connect(seco); pp.connect(sala);
      const corpoF = filtro('lowpass', 300, .5), corpoG = ganho(.02);
      ruido(T0, k * 3.1).connect(corpoF).connect(corpoG).connect(pp);
      const espF = filtro('bandpass', 2400, .6), espG = ganho(0);
      ruido(T0, k * 5.3 + 1).connect(espF).connect(espG).connect(pp);
      return { corpoF, corpoG, espF, espG, t: T0 + .5 + k * 4.5 };
    });
    // ressaca constante bem baixa
    ruido(T0, 2).connect(filtro('lowpass', 180)).connect(ganho(.16)).connect(seco);

    // 2. fundo do mar: re1 + mi bemol, sub grave, batimento
    const fundo = ganho(0); fundo.connect(seco); fundo.connect(sala);
    fundo.gain.setValueAtTime(0, T0); fundo.gain.linearRampToValueAtTime(.05, T0 + 10);
    const fundoF = filtro('lowpass', 220, .8); fundoF.connect(fundo);
    [[36.71, 0, .9], [73.42, -4, .5], [77.78, 3, .22]].forEach(([f, c, v]) => osc('triangle', f, c).connect(ganho(v)).connect(fundoF));
    // o filtro do fundo respira devagar (marulho por baixo)
    const lfo = osc('sine', .045); lfo.connect(ganho(90)).connect(fundoF.frequency);

    // 3. coro afogado: "u" grave, re e la, quase so sentido
    const coro = ganho(0); coro.connect(longe);
    const coroIn = ganho(1);
    [[73.42, -.4], [110, .4]].forEach(([f, p]) => { const pp = pan(p); pp.connect(coroIn); [-8, 7].forEach(c => osc('sawtooth', f, c).connect(ganho(.3)).connect(pp)); });
    coroIn.connect(filtro('bandpass', 330, 8)).connect(ganho(1)).connect(coro);
    coroIn.connect(filtro('bandpass', 620, 10)).connect(ganho(.35)).connect(coro);

    // 4b. harmonica de vidro: notas soltas na escala frigia dominante de re (re mi-b fa# sol la si-b do)
    const ESC = [293.66, 329.63, 369.99, 415.30, 440, 493.88, 523.25, 587.33];   // modo nordestino, igual a rabeca
    function vidro(t) {
      const n = 2 + ((R() * 3) | 0); let i = (R() * 4) | 0, ti = t;
      for (let k = 0; k < n; k++) {
        const f = ESC[i], dur = 2.6 + R() * 1.6, g = ganho(0); g.connect(pan(R() * 1.2 - .6)).connect(longe); g.connect(seco);
        g.gain.setValueAtTime(0, ti); g.gain.linearRampToValueAtTime(.035, ti + .35); g.gain.exponentialRampToValueAtTime(.0004, ti + dur);
        [[1, 1], [2, .22], [3.01, .06]].forEach(([m, v]) => { const o = osc('sine', f * m, 0, ti); o.connect(ganho(v)).connect(g); o.stop(ti + dur + .05); });
        const trem = osc('sine', 4.2, 0, ti); trem.connect(ganho(.012)).connect(g.gain); trem.stop(ti + dur);
        i = Math.max(0, Math.min(ESC.length - 1, i + [-2, -1, 1, 2, 3][(R() * 5) | 0]));
        ti += .9 + R() * 1.1;
      }
    }

    // 4c. rabeca: a melodia da carta, ida e volta, modo nordestino de re (re mi fa# sol# la si do)
    //     ida = o salto (re fa# sol# la, sobe ate o do); volta = desce nadando (si la) e pousa no re onde comecou
    const MELO = [[293.66, 1.0], [369.99, .8], [415.30, .8], [440, 1.5], [523.25, 1.3], [493.88, .9], [440, 1.1], [293.66, 3.4]];
    // notas reais de violino (viol.js, CC0) tocadas com cara de rabeca: corpo anasalado, afinacao torta, escorregao na entrada
    const VB = {}, FONTE = { E4: 331.6, G4: 393.8, C5: 525.0 };          // afinacao medida de cada gravacao
    const DE = ['E4', 'G4', 'G4', 'G4', 'C5', 'C5', 'G4', 'E4'];        // de qual gravacao sai cada nota da melodia
    const pega = () => new Promise(ok => {
      if (global.VIOL || typeof document === 'undefined') return ok();
      const sc = document.createElement('script'); sc.src = 'viol.js'; sc.onload = sc.onerror = () => ok(); document.head.appendChild(sc);
    });
    let vOk = false;
    this.pronto = pega().then(() => Promise.all(Object.entries(global.VIOL || {}).map(([k, b64]) => {
      const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      return new Promise(ok => ctx.decodeAudioData(u.buffer, x => { VB[k] = x; ok(); }, () => ok()));
    }))).then(() => { vOk = !!VB.E4; });
    const pronto = this.pronto;
    // eco: ping-pong esquerda/direita, cada volta mais escura
    const ecoIn = ganho(1), eL = ctx.createDelay(2), eR = ctx.createDelay(2); eL.delayTime.value = .46; eR.delayTime.value = .46;
    const eF = filtro('lowpass', 1800, .5), eFb = ganho(.42), eS = ganho(.6);
    ecoIn.connect(eL); eL.connect(eF).connect(eR); eR.connect(eFb).connect(eL);
    eL.connect(pan(-.8)).connect(eS); eR.connect(pan(.8)).connect(eS); eS.connect(seco); eS.connect(sala);

    // nuvem: sintetizador macio que segue a melodia uma oitava acima, entra devagar e fica depois que o violino some
    function nuvem(t) {
      const g = ganho(0), lp = filtro('lowpass', 1100, .4); lp.connect(g); g.connect(sala); g.connect(ganho(.35)).connect(seco);
      const tot = MELO.reduce((a, m) => a + m[1], 0);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.05, t + 2.2); g.gain.setTargetAtTime(0, t + tot - .5, 1.6);
      const vs = [['sawtooth', -9, .35], ['sawtooth', 9, .35], ['sine', 0, 1], ['triangle', 1200, .25]].map(([tp, c, v]) => { const o = osc(tp, MELO[0][0] * 2, c, t); o.connect(ganho(v)).connect(lp); return o; });
      const resp = osc('sine', .18, 0, t); resp.connect(ganho(260)).connect(lp.frequency);   // filtro respira
      let ti = t;
      MELO.forEach(([f, d]) => { vs.forEach(o => o.frequency.setTargetAtTime(f * 2, ti, .28)); ti += d; });   // desliza de nota em nota
      [...vs, resp].forEach(o => o.stop(t + tot + 7));
    }

    function rabeca(t) {
      if (!vOk) { pronto.then(() => { if (vOk && t > ctx.currentTime + .2) rabeca(t); }); return; }
      const sai = ganho(.2), hp = filtro('highpass', 230, .7), nariz = filtro('peaking', 1400, 1.2), brilho = filtro('peaking', 3200, 1);
      nariz.gain.value = 6; brilho.gain.value = -4;
      sai.connect(hp).connect(nariz).connect(brilho);
      brilho.connect(ganho(.45)).connect(pan(.15)).connect(seco);   // pouco direto: o violino vem de longe
      brilho.connect(ganho(1.3)).connect(sala);                     // muito de sala
      brilho.connect(ganho(.7)).connect(ecoIn);                      // e eco
      nuvem(t);
      let ti = t;
      MELO.forEach(([f, d], i) => {
        const afina = (R() * 2 - 1) * 12, k = DE[i], taxa = f * Math.pow(2, afina / 1200) / FONTE[k];
        const s = ctx.createBufferSource(); s.buffer = VB[k];
        s.playbackRate.setValueAtTime(taxa * .985, ti - .06); s.playbackRate.setTargetAtTime(taxa, ti, .035);   // escorregao curto
        const g = ganho(0), ult = i === MELO.length - 1, sol = ult ? 2.2 : .32;
        g.gain.setValueAtTime(0, ti - .06); g.gain.linearRampToValueAtTime(i === 3 || i === 4 ? 1.15 : 1, ti + .08);
        g.gain.setTargetAtTime(0, ti + d - (ult ? 1.2 : .02), ult ? .6 : .1);
        s.connect(g).connect(sai); s.start(ti - .06, .06); s.stop(ti + d + sol + .5);
        ti += d;
      });
    }

    // 5. sino de boia: parciais inarmonicas, longe
    function sino(t) {
      const f = 392 + R() * 40, p = pan(R() * 1.4 - .7); p.connect(longe); p.connect(seco);
      const n = 2 + ((R() * 2) | 0);
      for (let i = 0; i < n; i++) {
        const ti = t + i * (1.4 + R() * 1.6), g = ganho(0); g.connect(filtro('lowpass', 2600)).connect(p);
        g.gain.setValueAtTime(0, ti); g.gain.linearRampToValueAtTime(.05 * (1 - i * .25), ti + .008); g.gain.exponentialRampToValueAtTime(.0003, ti + 6);
        [[1, 1], [2.4, .5], [3.9, .25], [5.4, .12], [.5, .3]].forEach(([m, v]) => { const o = osc('sine', f * m, R() * 6, ti); o.connect(ganho(v)).connect(g); o.stop(ti + 6.2); });
      }
    }

    // 6. buzina de navio no nevoeiro
    function buzina(t) {
      const dur = 3.2 + R() * 1.5, g = ganho(0); g.connect(filtro('lowpass', 380, 1.2)).connect(pan(R() - .5)).connect(longe);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.2, t + .5); g.gain.setValueAtTime(.2, t + dur - .8); g.gain.linearRampToValueAtTime(0, t + dur);
      [[61.7, -6], [61.7, 6], [92.5, 0]].forEach(([f, c]) => { const o = osc('sawtooth', f, c, t); o.connect(ganho(.33)).connect(g); o.stop(t + dur + .1); });
    }

    // agenda
    let tCoro = T0 + 3, tVid = T0 + 30, tRab = T0 + 12, tSino = T0 + 22, tBuz = T0 + 40;
    this.agenda = ate => {
      ondas.forEach(o => {
        while (o.t < ate) {
          const ciclo = 7 + R() * 5, forca = .6 + R() * .4, t = o.t, quebra = t + ciclo * .38;
          // vem: corpo cresce e abre
          o.corpoG.gain.setTargetAtTime(.32 * forca, t, ciclo * .14);
          o.corpoF.frequency.setTargetAtTime(700 + forca * 500, t, ciclo * .14);
          // quebra: espuma estoura e chia
          o.espG.gain.setTargetAtTime(.22 * forca, quebra, .25);
          o.espF.frequency.setTargetAtTime(3200, quebra, .3);
          // recua: tudo fecha e a espuma escorre
          o.corpoG.gain.setTargetAtTime(.04, quebra + .4, ciclo * .16);
          o.corpoF.frequency.setTargetAtTime(260, quebra + .4, ciclo * .2);
          o.espG.gain.setTargetAtTime(0, quebra + .6, ciclo * .12);
          o.espF.frequency.setTargetAtTime(1500, quebra + .6, ciclo * .2);
          o.t += ciclo;
        }
      });
      while (tCoro < ate) {
        const dur = 20 + R() * 10;
        coro.gain.setTargetAtTime(.05 + R() * .03, tCoro, 4);
        coro.gain.setTargetAtTime(.008, tCoro + dur * .55, 4);
        tCoro += dur;
      }
      while (tVid < ate) { vidro(tVid); tVid += 11 + R() * 9; }
      while (tRab < ate) { rabeca(tRab); tRab += 40 + R() * 20; tVid = Math.max(tVid, tRab - 28); }  // vidro nao pisa na rabeca
      while (tSino < ate) { sino(tSino); tSino += 30 + R() * 15; }
      while (tBuz < ate) { buzina(tBuz); tBuz += 60 + R() * 30; }
    };
  }
  global.Mar = Mar;
})(typeof window !== 'undefined' ? window : globalThis);
