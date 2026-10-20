// Café Sergipano: marca fictícia, modelo de site da MARATU.
// Mesmo formato de dados do script original (o painel grava assim). Datas relativas a hoje.
(() => {
  const dia = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const F = "/modelos/cafe-sergipano/assets/fotos/";
  window.VILA_SEMENTE = {
    config: {
      capa: F + "capa.jpg",
      sobre: "Um café de esquina com mesa comprida, forró na sexta e oficina no sábado de manhã.\nO grão vem de pequenos produtores do agreste e a torra é feita aqui.",
      whatsapp: "#", comunidade: "", instagram: "", endereco: "Centro, Aracaju", mapa: "#",
      horario: [
        { dias: [2, 3, 4], abre: "08:00", fecha: "20:00" },
        { dias: [5], abre: "08:00", fecha: "24:00" },
        { dias: [6], abre: "09:00", fecha: "24:00" },
        { dias: [0], abre: "09:00", fecha: "14:00" },
      ],
      fotos: [F + "balcao.jpg", F + "bolo.jpg", F + "sala.jpg", F + "mesa.jpg", F + "vitrine.jpg", F + "escada.jpg", F + "xicara.jpg"],
    },
    eventos: [
      { id: "e1", tipo: "festa", categoria: "Forró", titulo: "Forró pé de serra", resumo: "Trio ao vivo a partir das 20h.", data: dia(2), inicio: "20:00", fim: "", cartaz: "", preco: 20, vagas: null, vendidos: 0, esgotado: false, sympla: "", fazer: "", inclui: "", levar: "", conduz: "", publicado: true },
      { id: "e2", tipo: "oficina", categoria: "Renda", titulo: "Renda irlandesa, primeiros pontos", resumo: "O ponto que veio de Divina Pastora, pra quem nunca pegou na agulha.", data: dia(3), inicio: "09:30", fim: "", cartaz: "", preco: 90, vagas: 10, vendidos: 8, esgotado: false, sympla: "#", fazer: "", inclui: "Linha, agulha e café", levar: "", conduz: "", publicado: true },
      { id: "e3", tipo: "oficina", categoria: "Xilogravura", titulo: "Xilogravura em uma tarde", resumo: "Você sai com a matriz e três cópias.", data: dia(5), inicio: "14:00", fim: "", cartaz: "", preco: 120, vagas: 8, vendidos: 3, esgotado: false, sympla: "#", fazer: "", inclui: "", levar: "", conduz: "", publicado: true },
      { id: "e4", tipo: "festa", categoria: "Samba", titulo: "Samba de coco na calçada", resumo: "", data: dia(6), inicio: "17:00", fim: "", cartaz: "", preco: 0, vagas: null, vendidos: 0, esgotado: false, sympla: "", fazer: "", inclui: "", levar: "", conduz: "", publicado: true },
      { id: "e5", tipo: "oficina", categoria: "Café", titulo: "Métodos de preparo", resumo: "Coado, prensa e aeropress lado a lado.", data: dia(9), inicio: "10:00", fim: "", cartaz: "", preco: 70, vagas: 6, vendidos: 6, esgotado: false, sympla: "#", fazer: "", inclui: "", levar: "", conduz: "", publicado: true },
      { id: "e6", tipo: "festa", categoria: "Cordel", titulo: "Noite de cordel", resumo: "Microfone aberto pra quem quiser declamar.", data: dia(12), inicio: "19:30", fim: "", cartaz: "", preco: 0, vagas: null, vendidos: 0, esgotado: false, sympla: "", fazer: "", inclui: "", levar: "", conduz: "", publicado: true },
    ],
    cardapio: [
      { id: "s1", nome: "Cafés", itens: [
        { id: "i1", nome: "Coado da casa", preco: 9, descricao: "Grão do agreste, torra média", disponivel: true },
        { id: "i2", nome: "Espresso", preco: 7, descricao: "", disponivel: true },
        { id: "i3", nome: "Cappuccino", preco: 13, descricao: "", disponivel: true },
        { id: "i4", nome: "Café com rapadura", preco: 11, descricao: "Adoçado na hora", disponivel: true },
      ] },
      { id: "s2", nome: "Comidinhas", itens: [
        { id: "i5", nome: "Cuscuz com queijo coalho", preco: 16, descricao: "", disponivel: true },
        { id: "i6", nome: "Bolo de puba", preco: 10, descricao: "A fatia", disponivel: true },
        { id: "i7", nome: "Tapioca de carne de sol", preco: 19, descricao: "", disponivel: false },
      ] },
    ],
    duvidas: [
      { p: "Precisa reservar mesa?", r: "Durante a semana não. Na sexta do forró, reserve pelo WhatsApp." },
      { p: "Como recebo o ingresso das oficinas?", r: "A compra é feita online e o ingresso chega no seu e-mail logo depois do pagamento." },
      { p: "Tem opção sem lactose?", r: "Tem leite de castanha pra qualquer bebida." },
    ],
  };
})();
