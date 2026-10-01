/**
 * CoinShare - Lógica Frontend em Vanilla JS (Fetch API)
 * Todas as funções, variáveis e seletores em Português
 */

// URL base da API Flask
const URL_BASE_API = (window.location.protocol.startsWith('http') && window.location.port === '5000') 
  ? '' 
  : 'http://127.0.0.1:5000';

// Estado Reativo da Aplicação
const estado = {
  usuarioAtual: null,
  grupoIdAtivo: null,
  grupoAtivo: null,
  despesaAtiva: null,
  telaAtual: 'tela-autenticacao',
  membrosGrupo: [],
  membrosSelecionadosNovoGrupo: [],
  modoRelatorio: 'membro' // 'membro' ou 'categoria'
};

// Chaves de Persistência no LocalStorage
const CHAVES_ARMAZENAMENTO = {
  USUARIO: 'coinshare_usuario',
  GRUPO_ATIVO: 'coinshare_grupo_id_ativo',
  TELA: 'coinshare_tela_atual'
};

function salvarSessao() {
  if (estado.usuarioAtual) {
    try {
      localStorage.setItem(CHAVES_ARMAZENAMENTO.USUARIO, JSON.stringify(estado.usuarioAtual));
      if (estado.grupoIdAtivo) {
        localStorage.setItem(CHAVES_ARMAZENAMENTO.GRUPO_ATIVO, String(estado.grupoIdAtivo));
      } else {
        localStorage.removeItem(CHAVES_ARMAZENAMENTO.GRUPO_ATIVO);
      }
      if (estado.telaAtual && estado.telaAtual !== 'tela-autenticacao') {
        localStorage.setItem(CHAVES_ARMAZENAMENTO.TELA, estado.telaAtual);
      }
    } catch (erro) {
      console.warn('Erro ao salvar sessão no armazenamento local:', erro);
    }
  }
}

function carregarSessao() {
  try {
    const usuarioSalvo = localStorage.getItem(CHAVES_ARMAZENAMENTO.USUARIO);
    if (!usuarioSalvo) return null;
    const usuario = JSON.parse(usuarioSalvo);
    const grupoIdSalvo = localStorage.getItem(CHAVES_ARMAZENAMENTO.GRUPO_ATIVO);
    const telaSalva = localStorage.getItem(CHAVES_ARMAZENAMENTO.TELA);
    return {
      usuario,
      grupoIdAtivo: grupoIdSalvo ? parseInt(grupoIdSalvo, 10) : null,
      tela: telaSalva || 'tela-inicio'
    };
  } catch (erro) {
    console.warn('Erro ao recuperar sessão do armazenamento local:', erro);
    return null;
  }
}

function limparSessao() {
  try {
    localStorage.removeItem(CHAVES_ARMAZENAMENTO.USUARIO);
    localStorage.removeItem(CHAVES_ARMAZENAMENTO.GRUPO_ATIVO);
    localStorage.removeItem(CHAVES_ARMAZENAMENTO.TELA);
  } catch (erro) {}
}

// ==========================================================================
// UTILITÁRIOS DA INTERFACE
// ==========================================================================

function formatarMoeda(valor) {
  const numero = parseFloat(valor) || 0;
  return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function exibirNotificacao(mensagem, tipo = 'sucesso') {
  const conteiner = document.getElementById('conteiner-notificacoes');
  if (!conteiner) return;

  const notificacao = document.createElement('div');
  let classeTipo = 'notificacao-sucesso';
  if (tipo === 'erro' || tipo === 'error') {
    classeTipo = 'notificacao-erro';
  } else if (tipo === 'aviso' || tipo === 'warning' || tipo === 'alerta') {
    classeTipo = 'notificacao-aviso';
  }
  notificacao.className = `notificacao ${classeTipo}`;
  notificacao.textContent = mensagem;

  conteiner.appendChild(notificacao);

  setTimeout(() => {
    notificacao.remove();
  }, 3500);
}

function gerarCaixaEstadoVazio({ titulo, mensagem, textoBotaoPrincipal = '', acaoBotaoPrincipal = '', exibirBotaoGrupos = true }) {
  return `
    <div class="caixa-grupo-vazio">
      <div class="icone-caixa-vazia">
        <svg viewBox="0 0 24 24" class="svg-vazio"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
      </div>
      <h3 class="titulo-vazio">${titulo}</h3>
      <p class="texto-grupo-vazio">${mensagem}</p>
      <div class="linha-botoes-vazio">
        ${textoBotaoPrincipal ? `<button type="button" class="botao botao-primario" onclick="${acaoBotaoPrincipal}">${textoBotaoPrincipal}</button>` : ''}
        ${exibirBotaoGrupos ? `<button type="button" class="botao botao-secundario" onclick="abrirModalTrocaGrupo()">MEUS GRUPOS</button>` : ''}
      </div>
    </div>
  `;
}

function exibirTela(idTela) {
  const todasTelas = document.querySelectorAll('.tela, .screen');
  todasTelas.forEach(tela => {
    tela.classList.remove('ativa');
    tela.classList.remove('active');
  });

  const telaAlvo = document.getElementById(idTela);
  if (telaAlvo) {
    telaAlvo.classList.add('ativa');
    telaAlvo.classList.add('active');
    estado.telaAtual = idTela;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Persiste a tela ativa caso o usuário esteja autenticado
  if (estado.usuarioAtual && idTela !== 'tela-autenticacao') {
    try {
      localStorage.setItem(CHAVES_ARMAZENAMENTO.TELA, idTela);
    } catch (erro) {}
  }

  // Controle de visibilidade das barras de navegação (Desktop e Mobile)
  const ehPublica = (idTela === 'tela-autenticacao');
  const barraInferior = document.getElementById('barra-navegacao-inferior');
  const cabecalhoDesktop = document.getElementById('cabecalho-navegacao-desktop');

  if (ehPublica) {
    barraInferior?.classList.add('oculto');
    barraInferior?.classList.add('hidden');
    cabecalhoDesktop?.classList.add('oculto');
    cabecalhoDesktop?.classList.add('hidden');
  } else {
    barraInferior?.classList.remove('oculto');
    barraInferior?.classList.remove('hidden');
    cabecalhoDesktop?.classList.remove('oculto');
    cabecalhoDesktop?.classList.remove('hidden');
    atualizarDestaqueNavegacao(idTela);
  }
}

function atualizarDestaqueNavegacao(idTela) {
  const botoesAbaMobile = document.querySelectorAll('.botao-aba-navegacao');
  botoesAbaMobile.forEach(botao => {
    botao.classList.toggle('ativa', botao.getAttribute('data-alvo') === idTela);
  });

  const linksDesktop = document.querySelectorAll('.link-navegacao-desktop');
  linksDesktop.forEach(link => {
    link.classList.toggle('ativa', link.getAttribute('data-alvo') === idTela);
  });
}

function copiarParaAreaTransferencia(texto, mensagemSucesso = 'Copiado para a área de transferência!') {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(texto).then(() => {
      exibirNotificacao(mensagemSucesso);
    }).catch(() => {
      copiarTextoAlternativo(texto, mensagemSucesso);
    });
  } else {
    copiarTextoAlternativo(texto, mensagemSucesso);
  }
}

function copiarTextoAlternativo(texto, mensagemSucesso) {
  const areaTexto = document.createElement('textarea');
  areaTexto.value = texto;
  document.body.appendChild(areaTexto);
  areaTexto.select();
  try {
    document.execCommand('copy');
    exibirNotificacao(mensagemSucesso);
  } catch (erro) {
    exibirNotificacao('Não foi possível copiar o texto.', 'erro');
  }
  document.body.removeChild(areaTexto);
}

// ==========================================================================
// ÍCONES SVG EMBUTIDOS (Sem dependências externas)
// ==========================================================================

const ICONES = {
  pago: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`,
  pendente: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 2v6h.01L6 8.01 10 12l-4 4 .01.01H6V22h12v-5.99h-.01L18 16l-4-4 4-3.99-.01-.01H18V2H6zm10 14.5V20H8v-3.5l4-4 4 4zm-4-5l-4-4V4h8v3.5l-4 4z"/></svg>`,
  atrasado: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/></svg>`,
  carrinho: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>`,
  transferencia: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M6.99 11L3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z"/></svg>`,
  restaurante: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"/></svg>`,
  grupo: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>`,
  casa: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>`
};

function obterIconeCategoria(categoria) {
  const minusculo = (categoria || '').toLowerCase();
  if (minusculo.includes('mercado') || minusculo.includes('compra')) return ICONES.carrinho;
  if (minusculo.includes('transf') || minusculo.includes('pix')) return ICONES.transferencia;
  if (minusculo.includes('restaurante') || minusculo.includes('almoço') || minusculo.includes('janta') || minusculo.includes('alim') || minusculo.includes('bebida')) return ICONES.restaurante;
  if (minusculo.includes('aluguel') || minusculo.includes('moradia')) return ICONES.casa;
  return ICONES.grupo;
}

// ==========================================================================
// REQUISIÇÕES FETCH - API FLASK
// ==========================================================================

async function requisicaoApi(caminhoEndpoint, opcoes = {}) {
  try {
    const urlCompleta = `${URL_BASE_API}${caminhoEndpoint}`;
    const cabecalhosPadrao = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    const configuracao = {
      ...opcoes,
      headers: {
        ...cabecalhosPadrao,
        ...(opcoes.headers || {})
      }
    };

    const resposta = await fetch(urlCompleta, configuracao);
    const dados = await resposta.json();

    if (!resposta.ok) {
      throw new Error(dados.mensagem || dados.message || `Erro na requisição: ${resposta.status}`);
    }

    return dados;
  } catch (erro) {
    console.error(`Erro ao acessar ${caminhoEndpoint}:`, erro);
    exibirNotificacao(erro.mensagem || erro.message || 'Erro ao conectar com a API.', 'erro');
    throw erro;
  }
}

// ==========================================================================
// 1. AUTENTICAÇÃO E SESSÃO
// ==========================================================================

async function entrarUsuario(email, senha) {
  try {
    const dados = await requisicaoApi('/api/autenticacao/login', {
      method: 'POST',
      body: JSON.stringify({ email, senha })
    });

    estado.usuarioAtual = dados.usuario || dados.user;
    estado.grupoIdAtivo = dados.grupo_id_ativo || dados.activeGroupId || null;

    salvarSessao();
    aplicarConfiguracoesUsuario(estado.usuarioAtual);
    exibirNotificacao(dados.mensagem || dados.message || 'Bem-vindo de volta!');
    await inicializarVisualizacaoApp();
  } catch (erro) {
    // Notificação já disparada por requisicaoApi
  }
}

async function cadastrarUsuario(nome, email, senha) {
  try {
    const dados = await requisicaoApi('/api/autenticacao/cadastrar', {
      method: 'POST',
      body: JSON.stringify({ nome, email, senha })
    });

    estado.usuarioAtual = dados.usuario || dados.user;
    estado.grupoIdAtivo = dados.grupo_id_ativo || dados.activeGroupId || null;

    salvarSessao();
    aplicarConfiguracoesUsuario(estado.usuarioAtual);
    exibirNotificacao(dados.mensagem || dados.message || 'Cadastro realizado com sucesso!');
    await inicializarVisualizacaoApp();
  } catch (erro) {
    // Tratado
  }
}

async function entrarLoginSocial(provedor) {
  const nomeProvedor = provedor || 'redes sociais';
  exibirNotificacao(`Em breve: login com ${nomeProvedor} estará disponível!`, 'aviso');
}

function aplicarConfiguracoesUsuario(usuario) {
  if (!usuario) return;

  // Preferência de Modo Noturno
  const alternadorModoEscuro = document.getElementById('config-alternar-modo-escuro');
  if (usuario.modo_escuro || usuario.dark_mode) {
    document.body.classList.add('modo-escuro');
    if (alternadorModoEscuro) alternadorModoEscuro.checked = true;
  } else {
    document.body.classList.remove('modo-escuro');
    if (alternadorModoEscuro) alternadorModoEscuro.checked = false;
  }

  // Notificações
  const alternadorNotificacoes = document.getElementById('config-alternar-notificacoes');
  if (alternadorNotificacoes) {
    alternadorNotificacoes.checked = Boolean(usuario.notificacoes || usuario.notifications);
  }

  // Atualiza exibição de dados e avatar
  atualizarExibicaoPerfil();
}

function atualizarExibicaoPerfil() {
  if (!estado.usuarioAtual) return;
  const usuario = estado.usuarioAtual;
  const nomeUsuario = usuario.nome || usuario.name || 'USUÁRIO';
  const emailUsuario = usuario.email || '';

  // Cabeçalho Mobile e Desktop
  const cabecalhoNome = document.getElementById('cabecalho-usuario-nome');
  if (cabecalhoNome) cabecalhoNome.textContent = nomeUsuario.toUpperCase();

  const etiquetaDesktop = document.getElementById('etiqueta-usuario-desktop');
  if (etiquetaDesktop) etiquetaDesktop.textContent = nomeUsuario.toUpperCase();

  // Tela de Configurações
  const configNome = document.getElementById('config-nome-usuario');
  if (configNome) configNome.textContent = nomeUsuario;

  const configEmail = document.getElementById('config-email-usuario');
  if (configEmail) configEmail.textContent = emailUsuario;

  const configIniciais = document.getElementById('config-iniciais-avatar');
  if (configIniciais) {
    const partesNome = nomeUsuario.trim().split(' ');
    const iniciais = partesNome.length > 1 
      ? (partesNome[0][0] + partesNome[1][0]).toUpperCase() 
      : partesNome[0].slice(0, 2).toUpperCase();
    configIniciais.textContent = iniciais;
  }
}

function sairConta() {
  estado.usuarioAtual = null;
  estado.grupoIdAtivo = null;
  estado.grupoAtivo = null;
  estado.despesaAtiva = null;
  limparSessao();
  exibirTela('tela-autenticacao');
  exibirNotificacao('Você saiu da sua conta.');
}

// ==========================================================================
// 2. PAINEL PRINCIPAL / INÍCIO (Figura 3)
// ==========================================================================

async function carregarPainel() {
  if (!estado.usuarioAtual) return;

  // Se não temos grupoIdAtivo, busca os grupos vinculados ao usuário
  if (!estado.grupoIdAtivo) {
    try {
      const dadosGrupos = await requisicaoApi(`/api/grupos?usuario_id=${estado.usuarioAtual.id}`);
      const listaGrupos = dadosGrupos.grupos || dadosGrupos.groups || [];
      if (listaGrupos.length > 0) {
        estado.grupoIdAtivo = listaGrupos[0].id;
      }
    } catch (erro) {
      // Continua para renderizar estado de grupo vazio
    }
  }

  const elementoNomeGrupo = document.getElementById('nome-grupo-inicio');
  const elementoSaldoGrupo = document.getElementById('saldo-grupo-inicio');
  const conteinerRecentes = document.getElementById('lista-despesas-recentes-inicio');

  if (!estado.grupoIdAtivo) {
    if (elementoNomeGrupo) elementoNomeGrupo.textContent = 'NENHUM GRUPO ATIVO';
    if (elementoSaldoGrupo) elementoSaldoGrupo.textContent = 'R$ 0,00';
    if (conteinerRecentes) {
      conteinerRecentes.innerHTML = `
        <div class="caixa-grupo-vazio">
          <p class="texto-grupo-vazio">Você ainda não participa de nenhum grupo.</p>
          <button type="button" class="botao botao-primario" id="botao-primeiro-grupo">CRIAR MEU PRIMEIRO GRUPO</button>
        </div>
      `;
      document.getElementById('botao-primeiro-grupo')?.addEventListener('click', abrirTelaCriarGrupo);
    }
    return;
  }

  try {
    const dados = await requisicaoApi(`/api/grupos/${estado.grupoIdAtivo}/painel`);
    estado.grupoAtivo = dados.grupo || dados.group;
    estado.membrosGrupo = dados.membros || dados.members || [];

    // Nome e saldo total do grupo
    const nomeGrupo = estado.grupoAtivo.nome || estado.grupoAtivo.name || 'GRUPO';
    const totalGrupo = dados.total_grupo ?? dados.group_total ?? 0;
    if (elementoNomeGrupo) elementoNomeGrupo.textContent = nomeGrupo.toUpperCase();
    if (elementoSaldoGrupo) elementoSaldoGrupo.textContent = formatarMoeda(totalGrupo);

    // Despesas Recentes (Figura 3)
    if (conteinerRecentes) {
      conteinerRecentes.innerHTML = '';
      const despesasRecentes = dados.despesas_recentes || dados.recent_expenses || [];

      if (despesasRecentes.length === 0) {
        conteinerRecentes.innerHTML = `<p class="legenda-cinza texto-centralizado">Nenhuma despesa recente registrada neste grupo.</p>`;
      } else {
        despesasRecentes.forEach(desp => {
          const cartao = document.createElement('div');
          cartao.className = 'cartao-despesa-recente';
          cartao.onclick = () => abrirDetalhesDespesa(desp.id);

          const pagador = desp.nome_pagador || desp.paid_by_name || 'Participante';
          const titulo = desp.titulo || desp.title || 'Despesa';
          const valor = desp.valor_total ?? desp.total_amount ?? 0;

          cartao.innerHTML = `
            <div class="despesa-recente-esquerda">
              <div class="avatar-preto">
                <svg viewBox="0 0 24 24" class="icone-avatar"><path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
              </div>
              <div class="nomes-despesa-recente">
                <strong class="titulo-pessoa-recente">${pagador}</strong>
                <span class="sub-etiqueta-recente">SALDO: ${titulo.toUpperCase()}</span>
              </div>
            </div>
            <div class="valor-despesa-recente">
              ${formatarMoeda(valor)}
            </div>
          `;
          conteinerRecentes.appendChild(cartao);
        });
      }
    }
  } catch (erro) {
    estado.grupoIdAtivo = null;
    salvarSessao();
    if (elementoNomeGrupo) elementoNomeGrupo.textContent = 'SELECIONE UM GRUPO';
    if (elementoSaldoGrupo) elementoSaldoGrupo.textContent = 'R$ 0,00';
    if (conteinerRecentes) {
      conteinerRecentes.innerHTML = `
        <div class="caixa-grupo-vazio">
          <p class="texto-grupo-vazio">Nenhum grupo ativo selecionado.</p>
          <button type="button" class="botao botao-primario" id="botao-novo-grupo-erro">CRIAR NOVO GRUPO</button>
        </div>
      `;
      document.getElementById('botao-novo-grupo-erro')?.addEventListener('click', abrirTelaCriarGrupo);
    }
  }
}

// ==========================================================================
// 3. TELA DE DESPESAS DO GRUPO (Figura 4)
// ==========================================================================

async function carregarTodasDespesas() {
  const conteiner = document.getElementById('lista-todas-despesas');
  if (!conteiner) return;

  if (!estado.grupoIdAtivo) {
    conteiner.innerHTML = gerarCaixaEstadoVazio({
      titulo: 'Nenhum grupo ativo',
      mensagem: 'Crie ou selecione um grupo para visualizar e lançar despesas.',
      textoBotaoPrincipal: 'CRIAR NOVO GRUPO',
      acaoBotaoPrincipal: 'abrirTelaCriarGrupo()'
    });
    exibirTela('tela-despesas');
    return;
  }

  try {
    const usuarioParam = estado.usuarioAtual ? `?usuario_id=${estado.usuarioAtual.id}` : '';
    const dados = await requisicaoApi(`/api/grupos/${estado.grupoIdAtivo}/despesas${usuarioParam}`);
    conteiner.innerHTML = '';
    const listaDespesas = dados.despesas || dados.expenses || [];

    if (listaDespesas.length === 0) {
      conteiner.innerHTML = `
        <div class="caixa-grupo-vazio">
          <div class="icone-caixa-vazia">
            <svg viewBox="0 0 24 24" class="svg-vazio"><path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-7-2h2v-4h4v-2h-4V7h-2v4H7v2h4z"/></svg>
          </div>
          <h3 class="titulo-vazio">Nenhuma despesa registrada</h3>
          <p class="texto-grupo-vazio">Este grupo ainda não possui compras ou gastos cadastrados.</p>
          <button type="button" class="botao botao-primario-menta" onclick="prepararTelaNovaDespesa()">REGISTRAR PRIMEIRA DESPESA</button>
        </div>
      `;
      exibirTela('tela-despesas');
      return;
    }

    listaDespesas.forEach(desp => {
      const cartao = document.createElement('article');
      const ehRecebedor = Boolean(estado.usuarioAtual && desp.pago_por === estado.usuarioAtual.id);
      
      // Quem registra a despesa é o recebedor; para ele sua fração já consta como PAGO
      const statusDespesa = ehRecebedor ? 'pago' : (desp.status || 'pendente');
      cartao.className = `item-despesa-cartao cartao-item-despesa status-${statusDespesa}`;
      cartao.onclick = () => abrirDetalhesDespesa(desp.id);

      const iconeStatus = ICONES[statusDespesa] || ICONES.pendente;
      const titulo = desp.titulo || desp.title || 'Despesa';
      const categoria = desp.categoria || desp.category || 'Geral';
      const valorTotal = desp.valor_total ?? desp.total_amount ?? 0;
      const pagador = desp.nome_pagador || desp.paid_by_name || 'Participante';
      const valorPorMembro = desp.valor_por_membro ?? desp.amount_per_member ?? 0;

      const rotuloComprador = ehRecebedor ? 'VOCÊ (RECEBEDOR)' : pagador.toUpperCase();
      const rotuloStatus = ehRecebedor ? 'PAGO' : statusDespesa.toUpperCase();

      const podeGerenciar = Boolean(
        estado.usuarioAtual && (
          desp.pago_por === estado.usuarioAtual.id || 
          estado.usuarioAtual.papel === 'admin'
        )
      );

      const botoesAcaoHtml = podeGerenciar ? `
        <div class="acoes-cartao-despesa">
          <button type="button" class="botao-icone-acao-cartao botao-editar-despesa-card" title="Editar Despesa">
            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
          </button>
          <button type="button" class="botao-icone-acao-cartao botao-excluir-despesa-card" title="Excluir Despesa">
            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
        </div>
      ` : '';

      cartao.innerHTML = `
        <div class="topo-cartao-despesa">
          <div class="info-cabecalho-despesa">
            <span class="pre-rotulo-despesa">DESPESA:</span>
            <div class="linha-titulo-despesa">
              <strong class="nome-titulo-despesa">${titulo}</strong>
              <span class="pilula-categoria-despesa">
                ${obterIconeCategoria(categoria)}
                ${categoria}
              </span>
            </div>
          </div>
          <div class="direita-topo-cartao-despesa">
            <div class="exibicao-total-despesa">
              TOTAL: ${formatarMoeda(valorTotal)}
            </div>
            ${botoesAcaoHtml}
          </div>
        </div>

        <div class="corpo-cartao-despesa">
          <div class="info-comprador-despesa">
            <span class="linha-comprador-despesa">COMPRADO POR: ${rotuloComprador}</span>
            <span class="linha-por-membro-despesa">VALOR POR MEMBRO: ${formatarMoeda(valorPorMembro)}</span>
          </div>

          <div class="selo-status-em-linha">
            <div class="circulo-icone-status">
              ${iconeStatus}
            </div>
            <span class="rotulo-status-pequeno">${rotuloStatus}</span>
          </div>
        </div>
      `;

      if (podeGerenciar) {
        const btnEdit = cartao.querySelector('.botao-editar-despesa-card');
        if (btnEdit) {
          btnEdit.onclick = (e) => {
            e.stopPropagation();
            abrirModalEditarDespesa(desp);
          };
        }
        const btnDel = cartao.querySelector('.botao-excluir-despesa-card');
        if (btnDel) {
          btnDel.onclick = (e) => {
            e.stopPropagation();
            excluirDespesaConfirmada(desp);
          };
        }
      }

      conteiner.appendChild(cartao);
    });

    exibirTela('tela-despesas');
  } catch (erro) {
    exibirTela('tela-despesas');
  }
}

// ==========================================================================
// 4. DETALHES DA DESPESA (Figuras 7, 8, 9)
// ==========================================================================

async function abrirDetalhesDespesa(despesaId) {
  try {
    const dados = await requisicaoApi(`/api/despesas/${despesaId}`);
    const despesa = dados.despesa || dados.expense;
    estado.despesaAtiva = despesa;

    const cartaoPrincipal = document.getElementById('detalhe-cartao-principal');
    const ehRecebedor = Boolean(estado.usuarioAtual && despesa.pago_por === estado.usuarioAtual.id);
    
    // Para quem registrou a despesa (recebedor), ela SEMPRE aparece como PAGO (ele não paga a si mesmo)
    const statusDespesa = ehRecebedor ? 'pago' : (despesa.status || 'pendente');
    cartaoPrincipal.className = `cartao-principal-detalhe status-${statusDespesa}`;

    // Data e Hora Formatadas
    const dataBruta = despesa.data_despesa || despesa.expense_date || '';
    const dataFormatada = dataBruta.includes('-') 
      ? dataBruta.split('-').reverse().join('/') 
      : dataBruta;

    const horaFormatada = despesa.hora_despesa || despesa.expense_time || '12:00';
    const categoria = despesa.categoria || despesa.category || 'Alimentação';
    const titulo = despesa.titulo || despesa.title || 'Despesa';
    const pagador = despesa.nome_pagador || despesa.paid_by_name || 'Participante';
    const total = despesa.valor_total ?? despesa.total_amount ?? 0;
    const porMembro = despesa.valor_por_membro ?? despesa.amount_per_member ?? 0;
    const local = despesa.local_compra || despesa.location || 'Não informado';

    document.getElementById('detalhe-data').textContent = dataFormatada;
    document.getElementById('detalhe-hora').textContent = `${horaFormatada} H`;
    document.getElementById('detalhe-categoria').textContent = categoria.toUpperCase();
    document.getElementById('detalhe-titulo').textContent = titulo.toUpperCase();
    document.getElementById('detalhe-comprador').textContent = ehRecebedor ? 'VOCÊ (RECEBEDOR)' : pagador.toUpperCase();
    document.getElementById('detalhe-total').textContent = formatarMoeda(total);
    document.getElementById('detalhe-valor-por-membro').textContent = formatarMoeda(porMembro);
    document.getElementById('detalhe-local').textContent = local.toUpperCase();

    // Selo de Status Circular
    const seloStatus = document.getElementById('detalhe-selo-status');
    seloStatus.className = `selo-status-grande status-${statusDespesa}`;
    document.getElementById('detalhe-icone-status').innerHTML = ICONES[statusDespesa] || ICONES.pago;
    document.getElementById('detalhe-texto-status').textContent = statusDespesa.toUpperCase();

    // Aviso específico para o recebedor
    const avisoRecebedor = document.getElementById('detalhe-aviso-recebedor');
    if (avisoRecebedor) {
      if (ehRecebedor) {
        avisoRecebedor.classList.remove('oculto');
        const textoAviso = document.getElementById('texto-detalhe-aviso-recebedor');
        if (textoAviso) {
          textoAviso.textContent = 'Você registrou esta despesa e é o recebedor. Sua parte já está paga e os acertos dos outros membros serão feitos para você.';
        }
      } else {
        avisoRecebedor.classList.add('oculto');
      }
    }

    // Botão PAGAR (apenas para membros devedores; NUNCA para o recebedor pois não tem como ele pagar a si mesmo)
    const botaoPagar = document.getElementById('botao-detalhe-pagar');
    if (!ehRecebedor) {
      const minhaDivisao = (despesa.divisoes || []).find(d => estado.usuarioAtual && d.usuario_id === estado.usuarioAtual.id);
      const estouQuitado = minhaDivisao ? Boolean(minhaDivisao.esta_pago ?? minhaDivisao.is_paid) : false;

      if (!estouQuitado && (despesa.status === 'pendente' || despesa.status === 'atrasado')) {
        botaoPagar.classList.remove('oculto');
        botaoPagar.textContent = `PAGAR PARA ${pagador.toUpperCase()}`;
        botaoPagar.onclick = () => abrirModalPagarDespesa(despesa);
      } else {
        botaoPagar.classList.add('oculto');
      }
    } else {
      botaoPagar.classList.add('oculto');
    }

    // Lista de Divisões
    const listaDivisoes = document.getElementById('lista-divisoes-detalhe');
    listaDivisoes.innerHTML = '';
    const divisoes = despesa.divisoes || despesa.splits || [];

    divisoes.forEach(div => {
      const linha = document.createElement('div');
      linha.className = 'linha-item-divisao';
      const nomeMembro = div.nome_membro || div.member_name || 'Membro';
      const pct = div.porcentagem ?? div.percentage ?? 0;
      const valorDiv = div.valor ?? div.amount ?? 0;

      // O recebedor da despesa já tem sua cota sempre quitada
      const ehMembroRecebedor = (div.usuario_id === despesa.pago_por);
      const estaPago = ehMembroRecebedor || Boolean(div.esta_pago ?? div.is_paid);

      linha.innerHTML = `
        <span>${nomeMembro} ${ehMembroRecebedor ? '<strong>(Recebedor)</strong>' : ''} (${pct}%)</span>
        <div>
          <span>${formatarMoeda(valorDiv)}</span>
          <span class="etiqueta-divisao-paga ${estaPago ? 'paga' : 'pendente'}">
            ${estaPago ? 'Quitado' : 'Pendente'}
          </span>
        </div>
      `;
      listaDivisoes.appendChild(linha);
    });

    // Ações de Gestão (Editar e Excluir)
    const conteinerGestao = document.getElementById('conteiner-acoes-gestor-despesa');
    if (conteinerGestao) {
      const podeGerenciar = Boolean(
        estado.usuarioAtual && (
          despesa.pago_por === estado.usuarioAtual.id || 
          estado.usuarioAtual.papel === 'admin'
        )
      );

      if (podeGerenciar) {
        conteinerGestao.classList.remove('oculto');
        const btnEditar = document.getElementById('botao-detalhes-editar');
        if (btnEditar) {
          btnEditar.onclick = () => abrirModalEditarDespesa(despesa);
        }
        const btnExcluir = document.getElementById('botao-detalhes-excluir');
        if (btnExcluir) {
          btnExcluir.onclick = () => excluirDespesaConfirmada(despesa);
        }
      } else {
        conteinerGestao.classList.add('oculto');
      }
    }

    exibirTela('tela-detalhes-despesa');
  } catch (erro) {
    // Tratado
  }
}

function abrirModalEditarDespesa(despesa) {
  if (!despesa) return;
  estado.despesaAtiva = despesa;

  const idInput = document.getElementById('editar-despesa-id');
  const tituloInput = document.getElementById('editar-despesa-titulo');
  const categoriaInput = document.getElementById('editar-despesa-categoria');
  const valorInput = document.getElementById('editar-despesa-valor');
  const localInput = document.getElementById('editar-despesa-local');

  if (idInput) idInput.value = despesa.id;
  if (tituloInput) tituloInput.value = despesa.titulo || despesa.title || '';
  if (categoriaInput) categoriaInput.value = despesa.categoria || despesa.category || 'Alimentação';
  if (valorInput) valorInput.value = despesa.valor_total ?? despesa.total_amount ?? '';
  if (localInput) localInput.value = despesa.local_compra || despesa.location || '';

  const modal = document.getElementById('modal-editar-despesa');
  if (modal) modal.classList.remove('oculto');
}

function fecharModalEditarDespesa() {
  const modal = document.getElementById('modal-editar-despesa');
  if (modal) modal.classList.add('oculto');
}

async function salvarEdicaoDespesa(evento) {
  if (evento && evento.preventDefault) evento.preventDefault();

  const id = document.getElementById('editar-despesa-id')?.value;
  const titulo = document.getElementById('editar-despesa-titulo')?.value.trim();
  const categoria = document.getElementById('editar-despesa-categoria')?.value;
  const valor = parseFloat(document.getElementById('editar-despesa-valor')?.value);
  const local = document.getElementById('editar-despesa-local')?.value.trim();

  if (!titulo || isNaN(valor) || valor <= 0) {
    exibirNotificacao('Informe um nome válido e valor maior que zero.', 'aviso');
    return;
  }

  try {
    const resposta = await requisicaoApi(`/api/despesas/${id}/editar`, {
      method: 'POST',
      body: JSON.stringify({
        titulo: titulo,
        categoria: categoria,
        valor_total: valor,
        local_compra: local
      })
    });

    exibirNotificacao(resposta.mensagem || 'Despesa atualizada com sucesso!', 'sucesso');
    fecharModalEditarDespesa();

    await abrirDetalhesDespesa(id);
    if (typeof carregarPainel === 'function') carregarPainel();
    if (typeof carregarTodasDespesas === 'function') carregarTodasDespesas();
    if (typeof carregarAcertoContas === 'function') carregarAcertoContas();
  } catch (erro) {
    exibirNotificacao(erro.message || 'Erro ao atualizar despesa.', 'erro');
  }
}

async function excluirDespesaConfirmada(despesa) {
  if (!despesa) return;
  const titulo = despesa.titulo || despesa.title || 'esta despesa';

  const confirmou = confirm(`Tem certeza que deseja excluir "${titulo}"?\nEsta ação removerá os rateios e registros financeiros vinculados.`);
  if (!confirmou) return;

  try {
    const resposta = await requisicaoApi(`/api/despesas/${despesa.id}/excluir`, {
      method: 'POST'
    });

    exibirNotificacao(resposta.mensagem || 'Despesa excluída com sucesso!', 'sucesso');
    fecharModalEditarDespesa();

    await carregarTodasDespesas();
    if (typeof carregarPainel === 'function') carregarPainel();
    if (typeof carregarAcertoContas === 'function') carregarAcertoContas();
    exibirTela('tela-despesas');
  } catch (erro) {
    exibirNotificacao(erro.message || 'Erro ao excluir despesa.', 'erro');
  }
}

// ==========================================================================
// 5. NOVA DESPESA (Figuras 5 e 6)
// ==========================================================================

async function prepararTelaNovaDespesa() {
  if (!estado.usuarioAtual) {
    exibirNotificacao('Entre na sua conta para registrar despesas.', 'erro');
    exibirTela('tela-autenticacao');
    return;
  }

  if (!estado.grupoIdAtivo) {
    exibirNotificacao('Você precisa criar um grupo antes de lançar despesas.');
    abrirTelaCriarGrupo();
    return;
  }

  try {
    if (!estado.membrosGrupo || estado.membrosGrupo.length === 0) {
      const dados = await requisicaoApi(`/api/grupos/${estado.grupoIdAtivo}/painel`);
      estado.membrosGrupo = dados.membros || dados.members || [];
    }

    // Identifica o usuário atual como o recebedor da despesa
    const elementoRecebedor = document.getElementById('despesa-nome-recebedor');
    if (elementoRecebedor && estado.usuarioAtual) {
      elementoRecebedor.textContent = `${estado.usuarioAtual.nome} (Você)`;
    }

    // Tabela de Divisão Desigual
    const corpoTabela = document.getElementById('corpo-tabela-divisao-desigual');
    corpoTabela.innerHTML = '';

    const quantidadeMembros = (estado.membrosGrupo && estado.membrosGrupo.length > 0) ? estado.membrosGrupo.length : 1;
    const porcentagemPadrao = Math.floor(100 / quantidadeMembros);

    estado.membrosGrupo.forEach((membro, indice) => {
      const linha = document.createElement('tr');
      const nomeMembro = membro.nome || membro.name || 'Participante';
      const ehRecebedor = (estado.usuarioAtual && membro.id === estado.usuarioAtual.id);
      const porcentagem = (indice === quantidadeMembros - 1) 
        ? (100 - porcentagemPadrao * (quantidadeMembros - 1)) 
        : porcentagemPadrao;

      linha.innerHTML = `
        <td>${nomeMembro} ${ehRecebedor ? '<span class="selo-mini-recebedor">(Você - Recebedor)</span>' : ''}</td>
        <td>
          <input type="number" min="0" max="100" class="entrada-tabela-porcentagem" 
            data-usuario-id="${membro.id}" value="${porcentagem}"> %
        </td>
      `;
      corpoTabela.appendChild(linha);
    });

    // Anexa evento de recálculo nas entradas
    document.querySelectorAll('.entrada-tabela-porcentagem').forEach(entrada => {
      entrada.addEventListener('input', recalcularSomaPorcentagens);
      entrada.addEventListener('change', recalcularSomaPorcentagens);
    });

    recalcularSomaPorcentagens();
    exibirTela('tela-nova-despesa');
  } catch (erro) {
    console.error('Erro ao preparar tela de nova despesa:', erro);
  }
}

function recalcularSomaPorcentagens() {
  const entradas = document.querySelectorAll('.entrada-tabela-porcentagem');
  let soma = 0;
  entradas.forEach(entrada => {
    soma += parseFloat(entrada.value) || 0;
  });

  const indicador = document.getElementById('indicador-soma-porcentagem');
  if (indicador) {
    const valida = (Math.round(soma) === 100);
    indicador.innerHTML = `Total: <strong>${soma}%</strong> ${valida ? '✓' : '(Ajuste para 100%)'}`;
    indicador.classList.toggle('valida', valida);
    indicador.classList.toggle('invalida', !valida);
  }
}

async function submeterNovaDespesa(evento) {
  if (evento && evento.preventDefault) evento.preventDefault();

  if (!estado.usuarioAtual) {
    exibirNotificacao('Sessão expirada. Entre novamente na conta.', 'erro');
    exibirTela('tela-autenticacao');
    return;
  }

  if (!estado.grupoIdAtivo) {
    exibirNotificacao('Selecione ou crie um grupo antes de lançar despesas.', 'erro');
    abrirTelaCriarGrupo();
    return;
  }

  const entradaTitulo = document.getElementById('despesa-titulo');
  const titulo = entradaTitulo ? entradaTitulo.value.trim() : '';
  const entradaCategoria = document.getElementById('despesa-categoria');
  const categoria = entradaCategoria ? entradaCategoria.value : 'Outros';
  const entradaValor = document.getElementById('despesa-valor');
  const valorTotal = entradaValor ? parseFloat(entradaValor.value) : 0;
  const entradaLocal = document.getElementById('despesa-local');
  const localCompra = entradaLocal ? entradaLocal.value.trim() : '';
  const radioDivisao = document.querySelector('input[name="tipo-divisao"]:checked');
  const tipoDivisao = radioDivisao ? radioDivisao.value : 'igual';

  if (!titulo || !valorTotal || valorTotal <= 0) {
    exibirNotificacao('Informe o nome e o valor da despesa.', 'erro');
    return;
  }

  let divisoes = [];
  if (tipoDivisao === 'desigual') {
    const entradas = document.querySelectorAll('.entrada-tabela-porcentagem');
    let somaPorcentagens = 0;
    entradas.forEach(entrada => {
      const usuarioId = parseInt(entrada.getAttribute('data-usuario-id'), 10);
      const porcentagem = parseFloat(entrada.value) || 0;
      somaPorcentagens += porcentagem;
      divisoes.push({
        usuario_id: usuarioId,
        user_id: usuarioId,
        porcentagem: porcentagem,
        percentage: porcentagem,
        valor: Math.round(valorTotal * (porcentagem / 100) * 100) / 100,
        amount: Math.round(valorTotal * (porcentagem / 100) * 100) / 100
      });
    });

    if (Math.round(somaPorcentagens) !== 100) {
      exibirNotificacao(`A soma das porcentagens deve ser 100% (atual: ${somaPorcentagens}%).`, 'erro');
      return;
    }
  }

  try {
    const corpoRequisicao = {
      pago_por: estado.usuarioAtual.id,
      paid_by: estado.usuarioAtual.id,
      titulo,
      title: titulo,
      categoria,
      category: categoria,
      valor_total: valorTotal,
      total_amount: valorTotal,
      local_compra: localCompra,
      location: localCompra,
      tipo_divisao: tipoDivisao,
      split_type: tipoDivisao,
      divisoes,
      splits: divisoes
    };

    const resposta = await requisicaoApi(`/api/grupos/${estado.grupoIdAtivo}/despesas`, {
      method: 'POST',
      body: JSON.stringify(corpoRequisicao)
    });

    exibirNotificacao(resposta.mensagem || resposta.message || 'Despesa criada com sucesso!');
    document.getElementById('formulario-nova-despesa')?.reset();
    salvarSessao();
    await carregarPainel();
    exibirTela('tela-inicio');
  } catch (erro) {
    console.error('Erro ao registrar despesa:', erro);
  }
}

// ==========================================================================
// 6. MODAL PAGAR DESPESA (Figura 10)
// ==========================================================================

function abrirModalPagarDespesa(dadosDespesa) {
  // Quem registra a despesa é o recebedor; ele não pode pagar a si mesmo
  if (estado.usuarioAtual && dadosDespesa.pago_por === estado.usuarioAtual.id) {
    exibirNotificacao('Você registrou esta despesa e é o recebedor. Não tem como pagar a si mesmo.', 'aviso');
    return;
  }

  estado.despesaAtiva = dadosDespesa;
  const modal = document.getElementById('modal-pagar-despesa');

  const titulo = dadosDespesa.titulo || dadosDespesa.title || 'Despesa';
  const pagador = dadosDespesa.nome_pagador || dadosDespesa.paid_by_name || 'Participante';
  const valorDevido = dadosDespesa.valor_por_membro || dadosDespesa.amount_per_member || dadosDespesa.valor_total || dadosDespesa.total_amount || 0;
  const chavePix = dadosDespesa.chave_pix_pagador || dadosDespesa.paid_by_pix || 'contato@coinshare.com';

  document.getElementById('modal-pagar-nome-despesa').textContent = titulo.toUpperCase();
  document.getElementById('modal-pagar-nome-comprador').textContent = pagador.toUpperCase();
  document.getElementById('modal-pagar-valor-devido').textContent = formatarMoeda(valorDevido);
  document.getElementById('modal-pagar-valor-personalizado').value = valorDevido;
  document.getElementById('modal-pagar-chave-pix').value = chavePix;

  const botaoConfirmar = document.getElementById('modal-botao-confirmar-pagamento');
  botaoConfirmar.textContent = `PAGAR PARA ${pagador.toUpperCase()}`;

  modal.classList.remove('oculto');
}

async function confirmarPagamentoDespesa() {
  if (!estado.despesaAtiva) return;
  const despesa = estado.despesaAtiva;
  const entradaValor = document.getElementById('modal-pagar-valor-personalizado');
  const valor = parseFloat(entradaValor.value) || despesa.valor_por_membro || despesa.valor_total;

  try {
    let resposta;
    if (despesa.ehAcerto && despesa.devedor_id && despesa.credor_id) {
      resposta = await requisicaoApi(`/api/grupos/${estado.grupoIdAtivo}/acertos/liquidar`, {
        method: 'POST',
        body: JSON.stringify({
          devedor_id: despesa.devedor_id,
          credor_id: despesa.credor_id,
          valor: valor
        })
      });
      await carregarAcertoContas();
      await carregarPainel();
    } else {
      resposta = await requisicaoApi(`/api/despesas/${despesa.id}/pagar`, {
        method: 'POST',
        body: JSON.stringify({
          usuario_id: estado.usuarioAtual ? estado.usuarioAtual.id : null,
          user_id: estado.usuarioAtual ? estado.usuarioAtual.id : null,
          valor: valor,
          amount: valor
        })
      });
      await abrirDetalhesDespesa(despesa.id);
    }

    exibirNotificacao(resposta.mensagem || resposta.message || 'Pagamento concluído com sucesso!');
    document.getElementById('modal-pagar-despesa').classList.add('oculto');
  } catch (erro) {
    exibirNotificacao(erro.message || 'Erro ao processar pagamento.', 'erro');
  }
}

// ==========================================================================
// 7. ACERTO DE CONTAS (Figura 15)
// ==========================================================================

async function carregarAcertoContas() {
  const elementoPagar = document.getElementById('acerto-total-pagar');
  const elementoReceber = document.getElementById('acerto-total-receber');
  const elementoBalanco = document.getElementById('acerto-balanco-geral');
  const conteiner = document.getElementById('conteiner-lista-dividas');

  if (!estado.grupoIdAtivo) {
    if (elementoPagar) elementoPagar.textContent = 'R$ 0,00';
    if (elementoReceber) elementoReceber.textContent = 'R$ 0,00';
    if (elementoBalanco) elementoBalanco.textContent = 'R$ 0,00';
    if (conteiner) {
      conteiner.innerHTML = gerarCaixaEstadoVazio({
        titulo: 'Nenhum grupo ativo',
        mensagem: 'Selecione ou crie um grupo para calcular o balanço de acerto de contas e quem deve para quem.',
        textoBotaoPrincipal: 'CRIAR NOVO GRUPO',
        acaoBotaoPrincipal: 'abrirTelaCriarGrupo()'
      });
    }
    exibirTela('tela-acerto-contas');
    return;
  }

  try {
    const usuarioId = estado.usuarioAtual ? estado.usuarioAtual.id : 1;
    const dados = await requisicaoApi(`/api/grupos/${estado.grupoIdAtivo}/acertos?usuario_id=${usuarioId}`);

    // Resumo dos Saldos
    const resumo = dados.resumo || dados.summary || {};
    if (elementoPagar) elementoPagar.textContent = formatarMoeda(resumo.total_a_pagar ?? resumo.total_to_pay ?? 0);
    if (elementoReceber) elementoReceber.textContent = formatarMoeda(resumo.total_a_receber ?? resumo.total_to_receive ?? 0);
    if (elementoBalanco) elementoBalanco.textContent = formatarMoeda(resumo.balanco_geral ?? resumo.general_balance ?? 0);

    // Lista Quem Deve Para Quem
    if (conteiner) {
      conteiner.innerHTML = '';
      const dividas = dados.dividas || dados.debts || [];

      if (dividas.length === 0) {
        conteiner.innerHTML = `
          <div class="caixa-grupo-vazio">
            <div class="icone-caixa-vazia">
              <svg viewBox="0 0 24 24" class="svg-vazio"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
            </div>
            <h3 class="titulo-vazio">Tudo em dia!</h3>
            <p class="texto-grupo-vazio">Não há pendências de acerto de contas ou dívidas registradas neste grupo no momento.</p>
          </div>
        `;
      } else {
        dividas.forEach(divida => {
          const cartao = document.createElement('article');
          cartao.className = 'cartao-divida-item cartao-linha-divida';

          const deId = divida.de_usuario_id || divida.from_user_id;
          const paraId = divida.para_usuario_id || divida.to_user_id;
          const deNome = divida.de_nome || divida.from_name || 'Participante';
          const paraNome = divida.para_nome || divida.to_name || 'Recebedor';
          const valorDivida = divida.valor ?? divida.amount ?? 0;
          const paraPix = divida.para_chave_pix || divida.para_pix || divida.to_pix || '';

          const usuarioAtualId = estado.usuarioAtual ? estado.usuarioAtual.id : null;
          const ehDevedor = Boolean(usuarioAtualId && deId === usuarioAtualId);
          const ehCredor = Boolean(usuarioAtualId && paraId === usuarioAtualId);

          let tituloTexto = `${deNome} deve para ${paraNome}`;
          let rotuloValor = 'Valor a acertar:';

          if (ehDevedor) {
            tituloTexto = `Você deve para ${paraNome}`;
            rotuloValor = 'Valor a pagar:';
          } else if (ehCredor) {
            tituloTexto = `${deNome} deve para você`;
            rotuloValor = 'Valor a receber:';
          }

          let elementoAcaoHtml = '';
          if (ehDevedor) {
            elementoAcaoHtml = `
              <button type="button" class="botao-acao-pagar" data-para-nome="${paraNome}" data-para-pix="${paraPix}" data-valor="${valorDivida}">
                PAGAR AGORA
              </button>
            `;
          } else if (ehCredor) {
            elementoAcaoHtml = `
              <button type="button" class="botao-acao-marcar-pago" data-de-nome="${deNome}" data-de-id="${deId}" data-para-id="${paraId}" data-valor="${valorDivida}" title="Dar baixa no acerto e marcar como pago">
                MARCAR COMO PAGO
              </button>
            `;
          } else {
            elementoAcaoHtml = `<span class="selo-status-pendente-acerto">PENDENTE</span>`;
          }

          cartao.innerHTML = `
            <div class="coluna-info-divida">
              <strong class="titulo-divida">${tituloTexto}</strong>
              <p class="descricao-divida">${rotuloValor} <strong class="valor-quantia-divida">${formatarMoeda(valorDivida)}</strong></p>
              ${(ehDevedor && paraPix) ? `<span class="selo-pix-divida">Chave Pix: ${paraPix}</span>` : ''}
            </div>
            ${elementoAcaoHtml}
          `;

          const botaoMarcarPago = cartao.querySelector('.botao-acao-marcar-pago');
          if (botaoMarcarPago) {
            botaoMarcarPago.onclick = async () => {
              const confirmou = confirm(`Deseja dar baixa e confirmar que você recebeu o pagamento de ${formatarMoeda(valorDivida)} de ${deNome}?`);
              if (!confirmou) return;

              try {
                const resposta = await requisicaoApi(`/api/grupos/${estado.grupoIdAtivo}/acertos/liquidar`, {
                  method: 'POST',
                  body: JSON.stringify({
                    devedor_id: deId,
                    credor_id: paraId,
                    valor: valorDivida
                  })
                });

                exibirNotificacao(resposta.mensagem || `Acerto com ${deNome} marcado como pago com sucesso!`, 'sucesso');
                await carregarAcertoContas();
                await carregarPainel();
                if (typeof carregarTodasDespesas === 'function') carregarTodasDespesas();
              } catch (erro) {
                exibirNotificacao(erro.message || 'Erro ao marcar acerto como pago.', 'erro');
              }
            };
          }

          const botaoPagar = cartao.querySelector('.botao-acao-pagar');
          if (botaoPagar) {
            botaoPagar.onclick = () => {
              if (paraPix) {
                copiarParaAreaTransferencia(paraPix, `Chave Pix de ${paraNome} copiada! Faça a transferência.`);
              }
              abrirModalPagarDespesa({
                id: estado.despesaAtiva ? estado.despesaAtiva.id : 1,
                titulo: `Acerto com ${paraNome}`,
                title: `Acerto com ${paraNome}`,
                nome_pagador: paraNome,
                paid_by_name: paraNome,
                chave_pix_pagador: paraPix,
                paid_by_pix: paraPix,
                valor_por_membro: valorDivida,
                amount_per_member: valorDivida,
                valor_total: valorDivida,
                total_amount: valorDivida,
                ehAcerto: true,
                devedor_id: deId,
                credor_id: paraId
              });
            };
          }

          conteiner.appendChild(cartao);
        });
      }
    }

    exibirTela('tela-acerto-contas');
  } catch (erro) {
    exibirTela('tela-acerto-contas');
  }
}

// ==========================================================================
// 8. RELATÓRIOS DO GRUPO (Figura 11)
// ==========================================================================

async function carregarRelatorios() {
  const svg = document.getElementById('svg-grafico-rosca');
  const legenda = document.getElementById('legenda-grafico');
  const corpoTabela = document.getElementById('corpo-tabela-conformidade');

  if (!estado.grupoIdAtivo) {
    if (svg) svg.innerHTML = `<circle cx="100" cy="100" r="60" fill="transparent" stroke="#cbd5e1" stroke-width="32" />`;
    if (legenda) {
      legenda.innerHTML = gerarCaixaEstadoVazio({
        titulo: 'Nenhum grupo ativo',
        mensagem: 'Crie ou selecione um grupo para visualizar relatórios de compras e índices de pagamento.',
        textoBotaoPrincipal: 'CRIAR NOVO GRUPO',
        acaoBotaoPrincipal: 'abrirTelaCriarGrupo()'
      });
    }
    if (corpoTabela) {
      corpoTabela.innerHTML = `<tr><td colspan="2" class="legenda-cinza texto-centralizado">Nenhum grupo ativo selecionado.</td></tr>`;
    }
    exibirTela('tela-relatorios');
    return;
  }

  try {
    const dados = await requisicaoApi(`/api/grupos/${estado.grupoIdAtivo}/relatorios`);

    renderizarGraficoRelatorios(dados);
    renderizarTabelaConformidade(dados.conformidade || dados.compliance || []);

    exibirTela('tela-relatorios');
  } catch (erro) {
    exibirTela('tela-relatorios');
  }
}

function renderizarGraficoRelatorios(dados) {
  const ehModoMembro = (estado.modoRelatorio === 'membro');
  const subtitulo = document.getElementById('subtitulo-modo-relatorio');
  if (subtitulo) {
    subtitulo.textContent = ehModoMembro 
      ? 'CONFIRA QUEM REALIZOU MAIS COMPRAS NO PERÍODO.' 
      : 'CONFIRA A DISTRIBUIÇÃO DOS GASTOS POR CATEGORIA.';
  }

  const conjuntoDados = ehModoMembro 
    ? (dados.por_membro || dados.by_member || []) 
    : (dados.por_categoria || dados.by_category || []);

  const svg = document.getElementById('svg-grafico-rosca');
  const legenda = document.getElementById('legenda-grafico');
  svg.innerHTML = '';
  legenda.innerHTML = '';

  const cores = ['#2563eb', '#f97316', '#eab308', '#10b981', '#ec4899', '#8b5cf6'];
  const total = conjuntoDados.reduce((acumulado, item) => acumulado + (item.total || 0), 0);

  if (total === 0) {
    svg.innerHTML = `<circle cx="100" cy="100" r="60" fill="transparent" stroke="#cbd5e1" stroke-width="32" />`;
    legenda.innerHTML = `<p class="legenda-cinza">Sem dados suficientes para gerar o gráfico.</p>`;
    return;
  }

  const raio = 60;
  const circunferencia = 2 * Math.PI * raio;
  let anguloAcumulado = 0;

  conjuntoDados.forEach((item, indice) => {
    const valor = item.total || 0;
    const rotulo = item.nome || item.name || item.categoria || item.category || 'Outros';
    const cor = cores[indice % cores.length];
    const porcentagem = valor / total;
    const comprimentoTraco = `${porcentagem * circunferencia} ${circunferencia}`;
    const deslocamentoTraco = -anguloAcumulado * circunferencia;

    // Elemento do gráfico em SVG
    const circulo = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circulo.setAttribute('cx', '100');
    circulo.setAttribute('cy', '100');
    circulo.setAttribute('r', raio.toString());
    circulo.setAttribute('fill', 'transparent');
    circulo.setAttribute('stroke', cor);
    circulo.setAttribute('stroke-width', '34');
    circulo.setAttribute('stroke-dasharray', comprimentoTraco);
    circulo.setAttribute('stroke-dashoffset', deslocamentoTraco.toString());
    circulo.innerHTML = `<title>${rotulo}: ${formatarMoeda(valor)} (${Math.round(porcentagem * 100)}%)</title>`;
    svg.appendChild(circulo);

    anguloAcumulado += porcentagem;

    // Item de legenda
    const itemLegenda = document.createElement('div');
    itemLegenda.className = 'item-legenda';
    itemLegenda.innerHTML = `
      <span class="ponto-cor-legenda ponto-cor-${indice % cores.length}"></span>
      <span>${rotulo} (${Math.round(porcentagem * 100)}%)</span>
    `;
    legenda.appendChild(itemLegenda);
  });
}

function renderizarTabelaConformidade(listaConformidade) {
  const corpoTabela = document.getElementById('corpo-tabela-conformidade');
  if (!corpoTabela) return;
  corpoTabela.innerHTML = '';

  if (!listaConformidade || listaConformidade.length === 0) {
    corpoTabela.innerHTML = `<tr><td colspan="2" class="legenda-cinza texto-centralizado">Nenhum dado de pagamento registrado para este grupo.</td></tr>`;
    return;
  }

  listaConformidade.forEach(item => {
    const taxa = item.taxa_pagamento ?? item.compliance_rate ?? 100;
    const classeTaxa = taxa >= 80 ? 'taxa-alta' : (taxa >= 50 ? 'taxa-media' : 'taxa-baixa');
    const nome = item.nome || item.name || 'Membro';

    const linha = document.createElement('tr');
    linha.innerHTML = `
      <td>${nome}</td>
      <td class="${classeTaxa}">${taxa}%</td>
    `;
    corpoTabela.appendChild(linha);
  });
}

// ==========================================================================
// 9. HISTÓRICO DE TRANSAÇÕES (Figura 12)
// ==========================================================================

async function carregarHistoricoTransacoes(tipoFiltro = 'todos') {
  const elementoSaldo = document.getElementById('saldo-grupo-historico');
  const conteiner = document.getElementById('conteiner-lista-transacoes');

  if (!estado.grupoIdAtivo) {
    if (elementoSaldo) elementoSaldo.textContent = 'R$ 0,00';
    if (conteiner) {
      conteiner.innerHTML = gerarCaixaEstadoVazio({
        titulo: 'Nenhum grupo ativo',
        mensagem: 'Crie ou selecione um grupo para visualizar o extrato histórico de transações.',
        textoBotaoPrincipal: 'CRIAR NOVO GRUPO',
        acaoBotaoPrincipal: 'abrirTelaCriarGrupo()'
      });
    }
    exibirTela('tela-historico');
    return;
  }

  try {
    const dados = await requisicaoApi(`/api/grupos/${estado.grupoIdAtivo}/transacoes?tipo=${tipoFiltro}`);

    const totalGrupo = dados.total_grupo ?? dados.group_total ?? 0;
    if (elementoSaldo) elementoSaldo.textContent = formatarMoeda(totalGrupo);

    if (conteiner) {
      conteiner.innerHTML = '';
      const transacoes = dados.transacoes || dados.transactions || [];

      if (transacoes.length === 0) {
        conteiner.innerHTML = `
          <div class="caixa-grupo-vazio">
            <div class="icone-caixa-vazia">
              <svg viewBox="0 0 24 24" class="svg-vazio"><path fill="currentColor" d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>
            </div>
            <h3 class="titulo-vazio">Nenhuma transação encontrada</h3>
            <p class="texto-grupo-vazio">O histórico de movimentações financeiras deste grupo está vazio.</p>
          </div>
        `;
      } else {
        transacoes.forEach(transacao => {
          const cartao = document.createElement('div');
          cartao.className = 'cartao-transacao-item cartao-item-transacao';

          const tipo = transacao.tipo_transacao || transacao.tx_type || 'saida';
          const ehEntrada = (tipo === 'entrada');
          const sinal = ehEntrada ? '+' : '-';
          const categoria = transacao.categoria || transacao.category || 'Geral';
          const icone = obterIconeCategoria(categoria);
          const usuario = transacao.nome_usuario || transacao.user_name || 'Participante';
          const dataFormatada = transacao.data_transacao || transacao.tx_date || '';
          const valor = transacao.valor ?? transacao.amount ?? 0;

          cartao.innerHTML = `
            <div class="bloco-esquerdo-transacao esquerda-item-transacao">
              <div class="circulo-icone-transacao caixa-icone-transacao">
                ${icone}
              </div>
              <div class="info-meta-transacao coluna-nomes-transacao">
                <strong class="titulo-transacao">${usuario}</strong>
                <span class="categoria-data-transacao linha-meta-transacao">${categoria.toUpperCase()} • ${dataFormatada}</span>
              </div>
            </div>
            <div class="direita-item-transacao">
              <span class="valor-transacao ${tipo} tipo-${tipo}">
                ${sinal} ${formatarMoeda(valor)}
              </span>
            </div>
          `;

          conteiner.appendChild(cartao);
        });
      }
    }

    exibirTela('tela-historico');
  } catch (erro) {
    exibirTela('tela-historico');
  }
}

// ==========================================================================
// 10. CRIAR NOVO GRUPO (Figura 13)
// ==========================================================================

function abrirTelaCriarGrupo() {
  document.getElementById('formulario-criar-grupo')?.reset();
  estado.membrosSelecionadosNovoGrupo = [];
  renderizarEtiquetasMembrosSelecionados();
  exibirTela('tela-criar-grupo');
}

function renderizarEtiquetasMembrosSelecionados() {
  const conteiner = document.getElementById('etiquetas-participantes-selecionados');
  if (!conteiner) return;
  conteiner.innerHTML = '';

  estado.membrosSelecionadosNovoGrupo.forEach((membro, indice) => {
    const etiqueta = document.createElement('span');
    etiqueta.className = 'etiqueta-membro';
    etiqueta.innerHTML = `
      ${membro}
      <button type="button" class="remover-etiqueta-membro" aria-label="Remover">&times;</button>
    `;
    etiqueta.querySelector('.remover-etiqueta-membro').addEventListener('click', () => {
      removerEtiquetaMembro(indice);
    });
    conteiner.appendChild(etiqueta);
  });
}

function removerEtiquetaMembro(indice) {
  estado.membrosSelecionadosNovoGrupo.splice(indice, 1);
  renderizarEtiquetasMembrosSelecionados();
}

async function submeterCriacaoGrupo(evento) {
  if (evento && evento.preventDefault) evento.preventDefault();

  if (!estado.usuarioAtual) {
    exibirNotificacao('Sessão expirada. Entre novamente na conta.', 'erro');
    exibirTela('tela-autenticacao');
    return;
  }

  const entradaNome = document.getElementById('grupo-nome');
  const nome = entradaNome ? entradaNome.value.trim() : '';
  const entradaDescricao = document.getElementById('grupo-descricao');
  const descricao = entradaDescricao ? entradaDescricao.value.trim() : '';
  const radioTipo = document.querySelector('input[name="tipo-grupo"]:checked');
  const tipoGrupo = radioTipo ? radioTipo.value : 'fechado';

  if (!nome) {
    exibirNotificacao('Informe o nome do grupo.', 'erro');
    return;
  }

  try {
    const corpoRequisicao = {
      usuario_id: estado.usuarioAtual.id,
      user_id: estado.usuarioAtual.id,
      nome,
      name: nome,
      descricao,
      description: descricao,
      tipo_grupo: tipoGrupo,
      group_type: tipoGrupo,
      membros: estado.membrosSelecionadosNovoGrupo,
      members: estado.membrosSelecionadosNovoGrupo
    };

    const resposta = await requisicaoApi('/api/grupos', {
      method: 'POST',
      body: JSON.stringify(corpoRequisicao)
    });

    exibirNotificacao(resposta.mensagem || resposta.message || 'Grupo criado com sucesso!');
    estado.grupoIdAtivo = resposta.grupo_id || resposta.groupId;
    salvarSessao();
    await carregarPainel();
    exibirTela('tela-inicio');
  } catch (erro) {
    console.error('Erro ao criar grupo:', erro);
  }
}

// ==========================================================================
// 11. MEMBROS DO GRUPO
// ==========================================================================

async function carregarTelaMembros() {
  const elementoCodigo = document.getElementById('membros-codigo-convite');
  const conteiner = document.getElementById('conteiner-lista-membros');

  if (!estado.grupoIdAtivo) {
    if (elementoCodigo) elementoCodigo.textContent = '-';
    if (conteiner) {
      conteiner.innerHTML = gerarCaixaEstadoVazio({
        titulo: 'Nenhum grupo ativo',
        mensagem: 'Crie ou selecione um grupo para visualizar os participantes e convites.',
        textoBotaoPrincipal: 'CRIAR NOVO GRUPO',
        acaoBotaoPrincipal: 'abrirTelaCriarGrupo()'
      });
    }
    exibirTela('tela-membros');
    return;
  }

  try {
    const dados = await requisicaoApi(`/api/grupos/${estado.grupoIdAtivo}/painel`);
    const grupo = dados.grupo || dados.group || {};
    const codigoConvite = grupo.codigo_convite || grupo.invite_code || '-';

    if (elementoCodigo) elementoCodigo.textContent = codigoConvite;

    if (conteiner) {
      conteiner.innerHTML = '';
      const membros = dados.membros || dados.members || [];

      if (membros.length === 0) {
        conteiner.innerHTML = `
          <div class="caixa-grupo-vazio">
            <h3 class="titulo-vazio">Nenhum membro cadastrado</h3>
            <p class="texto-grupo-vazio">Adicione participantes para dividir as despesas do grupo.</p>
          </div>
        `;
      } else {
        membros.forEach(membro => {
          const cartao = document.createElement('div');
          cartao.className = 'cartao-linha-membro';

          const nome = membro.nome || membro.name || 'Membro';
          const email = membro.email || '';
          const chavePix = membro.chave_pix || membro.pix_key || '';
          const papel = membro.papel || membro.role || 'membro';

          cartao.innerHTML = `
            <div class="membro-esquerda">
              <div class="avatar-preto">
                <svg viewBox="0 0 24 24" class="icone-avatar"><path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
              </div>
              <div>
                <strong>${nome}</strong>
                <p class="legenda-cinza">${email}</p>
                ${chavePix ? `<span class="legenda-cinza">Pix: ${chavePix}</span>` : ''}
              </div>
            </div>
            <span class="selo-papel-membro">${papel}</span>
          `;
          conteiner.appendChild(cartao);
        });
      }
    }

    exibirTela('tela-membros');
  } catch (erro) {
    exibirTela('tela-membros');
  }
}

// ==========================================================================
// 12. CONFIGURAÇÕES E MODAIS (Figura 14)
// ==========================================================================

async function atualizarDadosPerfil(dadosParaAtualizar) {
  try {
    const resposta = await requisicaoApi('/api/autenticacao/perfil', {
      method: 'PUT',
      body: JSON.stringify({
        ...dadosParaAtualizar,
        usuario_id: estado.usuarioAtual ? estado.usuarioAtual.id : 1,
        user_id: estado.usuarioAtual ? estado.usuarioAtual.id : 1
      })
    });

    estado.usuarioAtual = resposta.usuario || resposta.user;
    salvarSessao();
    aplicarConfiguracoesUsuario(estado.usuarioAtual);
    exibirNotificacao(resposta.mensagem || resposta.message || 'Configurações salvas!');
  } catch (erro) {
    // Tratado
  }
}

async function abrirModalTrocaGrupo() {
  try {
    const usuarioId = estado.usuarioAtual ? estado.usuarioAtual.id : 1;
    const dados = await requisicaoApi(`/api/grupos?usuario_id=${usuarioId}`);
    const conteiner = document.getElementById('lista-selecao-grupos');
    conteiner.innerHTML = '';
    const grupos = dados.grupos || dados.groups || [];

    if (grupos.length === 0) {
      conteiner.innerHTML = `<p class="legenda-cinza texto-centralizado">Você não possui grupos criados.</p>`;
    } else {
      grupos.forEach(grupo => {
        const item = document.createElement('div');
        item.className = 'cartao-despesa-recente';
        const nome = grupo.nome || grupo.name || 'Grupo';
        const descricao = grupo.descricao || grupo.description || 'Sem descrição';
        const ehAtivo = (grupo.id === estado.grupoIdAtivo);

        item.innerHTML = `
          <div>
            <strong class="titulo-pessoa-recente">${nome}</strong>
            <p class="legenda-cinza">${descricao}</p>
          </div>
          <button type="button" class="botao botao-primario botao-selecionar-grupo">
            ${ehAtivo ? 'Ativo ✓' : 'Selecionar'}
          </button>
        `;

        item.onclick = async () => {
          estado.grupoIdAtivo = grupo.id;
          salvarSessao();
          document.getElementById('modal-lista-grupos').classList.add('oculto');
          await carregarPainel();
          exibirNotificacao(`Grupo ativo alterado para ${nome}!`);
        };

        conteiner.appendChild(item);
      });
    }

    document.getElementById('modal-lista-grupos').classList.remove('oculto');
  } catch (erro) {
    // Tratado
  }
}

function abrirModalEditarPerfil() {
  if (!estado.usuarioAtual) return;
  const usuario = estado.usuarioAtual;
  document.getElementById('perfil-nome').value = usuario.nome || usuario.name || '';
  document.getElementById('perfil-telefone').value = usuario.telefone || usuario.phone || '';
  document.getElementById('perfil-chave-pix').value = usuario.chave_pix || usuario.pix_key || '';
  document.getElementById('perfil-nova-senha').value = '';
  document.getElementById('modal-editar-perfil').classList.remove('oculto');
}

// ==========================================================================
// INICIALIZAÇÃO DA APLICAÇÃO E BINDINGS DE EVENTOS
// ==========================================================================

async function inicializarVisualizacaoApp() {
  await carregarPainel();
  exibirTela('tela-inicio');
}

document.addEventListener('DOMContentLoaded', () => {

  // --- Alternador de Abas de Autenticação (Entrar / Cadastrar) ---
  const botaoAbaEntrar = document.getElementById('botao-aba-entrar');
  const botaoAbaCadastrar = document.getElementById('botao-aba-cadastrar');
  const formularioLogin = document.getElementById('formulario-login');
  const formularioCadastro = document.getElementById('formulario-cadastro');
  const subtituloAutenticacao = document.getElementById('subtitulo-autenticacao');

  function mudarParaLogin() {
    botaoAbaEntrar?.classList.add('ativa');
    botaoAbaCadastrar?.classList.remove('ativa');
    formularioLogin?.classList.remove('oculto');
    formularioCadastro?.classList.add('oculto');
    if (subtituloAutenticacao) subtituloAutenticacao.textContent = 'BEM VINDO DE VOLTA';
  }

  function mudarParaCadastro() {
    botaoAbaCadastrar?.classList.add('ativa');
    botaoAbaEntrar?.classList.remove('ativa');
    formularioCadastro?.classList.remove('oculto');
    formularioLogin?.classList.add('oculto');
    if (subtituloAutenticacao) subtituloAutenticacao.textContent = 'SEJA BEM VINDO';
  }

  botaoAbaEntrar?.addEventListener('click', mudarParaLogin);
  botaoAbaCadastrar?.addEventListener('click', mudarParaCadastro);
  document.getElementById('botao-alternar-cadastro')?.addEventListener('click', mudarParaCadastro);
  document.getElementById('botao-alternar-login')?.addEventListener('click', mudarParaLogin);

  // Submit Login
  formularioLogin?.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const senha = document.getElementById('login-senha').value;
    if (!email || !senha) {
      exibirNotificacao('Preencha e-mail e senha.', 'erro');
      return;
    }
    await entrarUsuario(email, senha);
  });

  // Submit Cadastro
  formularioCadastro?.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const nome = document.getElementById('cadastro-nome').value.trim();
    const email = document.getElementById('cadastro-email').value.trim();
    const senha = document.getElementById('cadastro-senha').value;
    const confirmacao = document.getElementById('cadastro-confirmar-senha').value;
    const termos = document.getElementById('cadastro-termos').checked;

    if (!termos) {
      exibirNotificacao('Você deve concordar com os termos & políticas.', 'erro');
      return;
    }
    if (senha !== confirmacao) {
      exibirNotificacao('As senhas digitadas não conferem.', 'erro');
      return;
    }
    await cadastrarUsuario(nome, email, senha);
  });

  // Botões de Login Social (Informativo "Em breve" - sem simulação de login)
  document.querySelectorAll('.botao-social').forEach(botao => {
    botao.addEventListener('click', (evento) => {
      evento.preventDefault();
      evento.stopPropagation();
      const provedor = botao.getAttribute('data-provedor') || 'redes sociais';
      exibirNotificacao(`Em breve: login com ${provedor} estará disponível!`, 'aviso');
    });
  });

  // Esqueci minha senha
  document.getElementById('botao-esqueci-senha')?.addEventListener('click', () => {
    exibirNotificacao('Um link de recuperação foi enviado para o seu e-mail.');
  });

  // --- Navegação Bottom Bar (Mobile) ---
  document.getElementById('nav-btn-inicio')?.addEventListener('click', () => {
    carregarPainel();
    exibirTela('tela-inicio');
  });

  document.getElementById('nav-btn-historico')?.addEventListener('click', () => {
    carregarHistoricoTransacoes('todos');
  });

  document.getElementById('nav-btn-grupo')?.addEventListener('click', () => {
    carregarTodasDespesas();
    exibirTela('tela-despesas');
  });

  document.getElementById('nav-btn-configuracoes')?.addEventListener('click', () => {
    atualizarExibicaoPerfil();
    exibirTela('tela-configuracoes');
  });

  // --- Navegação Desktop Bar ---
  document.getElementById('link-nav-inicio')?.addEventListener('click', () => {
    carregarPainel();
    exibirTela('tela-inicio');
  });

  document.getElementById('link-nav-despesas')?.addEventListener('click', () => {
    carregarTodasDespesas();
    exibirTela('tela-despesas');
  });

  document.getElementById('link-nav-acerto')?.addEventListener('click', () => {
    carregarAcertoContas();
  });

  document.getElementById('link-nav-relatorios')?.addEventListener('click', () => {
    carregarRelatorios();
  });

  document.getElementById('link-nav-historico')?.addEventListener('click', () => {
    carregarHistoricoTransacoes('todos');
  });

  document.getElementById('link-nav-membros')?.addEventListener('click', () => {
    carregarTelaMembros();
  });

  document.getElementById('link-nav-configuracoes')?.addEventListener('click', () => {
    atualizarExibicaoPerfil();
    exibirTela('tela-configuracoes');
  });

  document.getElementById('botao-acao-sair-desktop')?.addEventListener('click', sairConta);

  // --- Ações Rápidas Dashboard (Figura 3) ---
  document.getElementById('botao-rapido-membros')?.addEventListener('click', carregarTelaMembros);
  document.getElementById('botao-rapido-relatorios')?.addEventListener('click', carregarRelatorios);
  document.getElementById('botao-rapido-acerto')?.addEventListener('click', carregarAcertoContas);
  document.getElementById('botao-rapido-novo-grupo')?.addEventListener('click', abrirTelaCriarGrupo);
  document.getElementById('botao-ver-todas-despesas')?.addEventListener('click', () => {
    carregarTodasDespesas();
    exibirTela('tela-despesas');
  });

  // FAB (+): Nova despesa
  document.getElementById('botao-flutuante-nova-despesa')?.addEventListener('click', prepararTelaNovaDespesa);
  document.getElementById('botao-flutuante-historico-novo')?.addEventListener('click', prepararTelaNovaDespesa);
  document.getElementById('botao-despesas-nova-compra')?.addEventListener('click', prepararTelaNovaDespesa);

  // --- Botões Voltar para o Início ---
  const botoesVoltarInicio = [
    'botao-despesas-voltar-inicio',
    'botao-detalhe-inicio',
    'botao-acerto-inicio',
    'botao-relatorios-inicio',
    'botao-membros-inicio',
    'botao-voltar-despesas',
    'botao-voltar-detalhes',
    'botao-voltar-acerto',
    'botao-voltar-relatorios',
    'botao-voltar-historico',
    'botao-voltar-criar-grupo',
    'botao-voltar-configuracoes',
    'botao-voltar-membros'
  ];

  botoesVoltarInicio.forEach(idBotao => {
    document.getElementById(idBotao)?.addEventListener('click', () => {
      carregarPainel();
      exibirTela('tela-inicio');
    });
  });

  // Botões de Voltar específicos
  document.getElementById('botao-detalhe-voltar')?.addEventListener('click', () => {
    carregarTodasDespesas();
    exibirTela('tela-despesas');
  });

  document.getElementById('botao-fechar-nova-despesa')?.addEventListener('click', () => {
    carregarPainel();
    exibirTela('tela-inicio');
  });

  document.getElementById('botao-voltar-nova-despesa')?.addEventListener('click', () => {
    carregarPainel();
    exibirTela('tela-inicio');
  });

  document.getElementById('botao-acerto-voltar')?.addEventListener('click', () => {
    carregarPainel();
    exibirTela('tela-inicio');
  });

  document.getElementById('botao-relatorios-voltar')?.addEventListener('click', () => {
    carregarPainel();
    exibirTela('tela-inicio');
  });

  // --- Troca de Tipo de Divisão Nova Despesa (IGUAL vs DESIGUAL) ---
  const radiosTipoDivisao = document.querySelectorAll('input[name="tipo-divisao"]');
  radiosTipoDivisao.forEach(radio => {
    radio.addEventListener('change', () => {
      const secaoDesigual = document.getElementById('secao-divisao-desigual');
      if (radio.value === 'desigual') {
        secaoDesigual.classList.remove('oculto');
      } else {
        secaoDesigual.classList.add('oculto');
      }
    });
  });

  // Formulário Nova Despesa Submit
  document.getElementById('formulario-nova-despesa')?.addEventListener('submit', submeterNovaDespesa);

  // Modal Pagar Despesa Eventos
  document.getElementById('botao-fechar-modal-pagar')?.addEventListener('click', () => {
    document.getElementById('modal-pagar-despesa').classList.add('oculto');
  });

  document.getElementById('modal-botao-copiar-pix')?.addEventListener('click', () => {
    const chave = document.getElementById('modal-pagar-chave-pix').value;
    copiarParaAreaTransferencia(chave, 'Chave Pix copiada com sucesso!');
  });

  document.getElementById('modal-botao-confirmar-pagamento')?.addEventListener('click', confirmarPagamentoDespesa);

  // Filtros de Relatório (Por Membro vs Por Categorias)
  document.querySelectorAll('input[name="modo-visualizacao-relatorio"]').forEach(radio => {
    radio.addEventListener('change', () => {
      estado.modoRelatorio = radio.value;
      carregarRelatorios();
    });
  });

  // Filtros de Transações (Todos / Entradas / Saídas)
  document.querySelectorAll('.pilula-transacao').forEach(pilula => {
    pilula.addEventListener('click', () => {
      document.querySelectorAll('.pilula-transacao').forEach(p => p.classList.remove('ativa'));
      pilula.classList.add('ativa');
      const filtro = pilula.getAttribute('data-filtro');
      carregarHistoricoTransacoes(filtro);
    });
  });

  // Seletor de Período do Histórico
  document.getElementById('selecao-periodo-transacoes')?.addEventListener('change', () => {
    const pilulaAtiva = document.querySelector('.pilula-transacao.ativa');
    const filtro = pilulaAtiva ? pilulaAtiva.getAttribute('data-filtro') : 'todos';
    carregarHistoricoTransacoes(filtro);
  });

  // Modal Editar Despesa Eventos
  document.getElementById('botao-fechar-modal-editar-despesa')?.addEventListener('click', fecharModalEditarDespesa);
  document.getElementById('botao-cancelar-edicao-despesa')?.addEventListener('click', fecharModalEditarDespesa);
  document.getElementById('formulario-editar-despesa')?.addEventListener('submit', salvarEdicaoDespesa);

  // Troca de Grupo
  document.getElementById('botao-trocar-grupo-inicio')?.addEventListener('click', abrirModalTrocaGrupo);
  document.getElementById('botao-fechar-modal-grupos')?.addEventListener('click', () => {
    document.getElementById('modal-lista-grupos').classList.add('oculto');
  });
  document.getElementById('botao-abrir-modal-criar-grupo')?.addEventListener('click', () => {
    document.getElementById('modal-lista-grupos').classList.add('oculto');
    abrirTelaCriarGrupo();
  });

  // Criar Grupo Form Submit
  document.getElementById('formulario-criar-grupo')?.addEventListener('submit', submeterCriacaoGrupo);

  // Alternância do Tipo de Grupo (Fechado vs Aberto)
  const cartaoFechado = document.getElementById('cartao-tipo-fechado');
  const cartaoAberto = document.getElementById('cartao-tipo-aberto');
  document.querySelectorAll('input[name="tipo-grupo"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.value === 'fechado') {
        cartaoFechado?.classList.add('ativa');
        cartaoAberto?.classList.remove('ativa');
      } else {
        cartaoAberto?.classList.add('ativa');
        cartaoFechado?.classList.remove('ativa');
      }
    });
  });

  // Contador de caracteres da descrição do grupo
  const entradaDescricaoGrupo = document.getElementById('grupo-descricao');
  entradaDescricaoGrupo?.addEventListener('input', () => {
    const contador = document.getElementById('contagem-caracteres-descricao');
    if (contador) contador.textContent = entradaDescricaoGrupo.value.length;
  });

  // Busca e inclusão de participantes no Criar Grupo
  const entradaBuscaParticipantes = document.getElementById('grupo-buscar-participantes');
  entradaBuscaParticipantes?.addEventListener('keydown', (evento) => {
    if (evento.key === 'Enter') {
      evento.preventDefault();
      const valor = entradaBuscaParticipantes.value.trim();
      if (valor && !estado.membrosSelecionadosNovoGrupo.includes(valor)) {
        estado.membrosSelecionadosNovoGrupo.push(valor);
        renderizarEtiquetasMembrosSelecionados();
        entradaBuscaParticipantes.value = '';
      }
    }
  });

  document.getElementById('botao-copiar-link-convite')?.addEventListener('click', () => {
    const link = document.getElementById('grupo-link-convite').value || 'https://coinshare.app/convite';
    copiarParaAreaTransferencia(link, 'Link de convite do grupo copiado!');
  });

  // Copiar código do grupo na tela de membros
  document.getElementById('botao-copiar-codigo-membros')?.addEventListener('click', () => {
    const codigo = document.getElementById('membros-codigo-convite')?.textContent || '';
    copiarParaAreaTransferencia(codigo, `Código do grupo "${codigo}" copiado!`);
  });

  // Modal Adicionar Participante
  document.getElementById('gatilho-modal-adicionar-membro')?.addEventListener('click', () => {
    document.getElementById('modal-adicionar-membro').classList.remove('oculto');
  });

  document.getElementById('botao-fechar-modal-membro')?.addEventListener('click', () => {
    document.getElementById('modal-adicionar-membro').classList.add('oculto');
  });

  document.getElementById('formulario-adicionar-membro')?.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const entradaEmail = document.getElementById('adicionar-membro-email');
    const valor = entradaEmail ? entradaEmail.value.trim() : '';
    if (!valor) return;

    try {
      const resposta = await requisicaoApi(`/api/grupos/${estado.grupoIdAtivo}/membros`, {
        method: 'POST',
        body: JSON.stringify({ email: valor, usuario: valor })
      });
      exibirNotificacao(resposta.mensagem || 'Membro adicionado!');
      entradaEmail.value = '';
      document.getElementById('modal-adicionar-membro').classList.add('oculto');
      await carregarTelaMembros();
    } catch (erro) {
      // Tratado
    }
  });

  // Configurações: Modo Noturno Alternância
  const alternadorModoEscuro = document.getElementById('config-alternar-modo-escuro');
  alternadorModoEscuro?.addEventListener('change', () => {
    const estaEscuro = alternadorModoEscuro.checked;
    if (estaEscuro) {
      document.body.classList.add('modo-escuro');
    } else {
      document.body.classList.remove('modo-escuro');
    }
    atualizarDadosPerfil({ modo_escuro: estaEscuro, dark_mode: estaEscuro });
  });

  // Configurações: Notificações Alternância
  const alternadorNotificacoes = document.getElementById('config-alternar-notificacoes');
  alternadorNotificacoes?.addEventListener('change', () => {
    atualizarDadosPerfil({ notificacoes: alternadorNotificacoes.checked, notifications: alternadorNotificacoes.checked });
  });

  // Configurações: Modais de Edição de Perfil
  document.getElementById('botao-editar-perfil')?.addEventListener('click', abrirModalEditarPerfil);
  document.getElementById('config-botao-dados-pessoais')?.addEventListener('click', abrirModalEditarPerfil);
  document.getElementById('config-botao-senha')?.addEventListener('click', abrirModalEditarPerfil);
  document.getElementById('config-botao-pix')?.addEventListener('click', abrirModalEditarPerfil);
  document.getElementById('config-botao-gerenciar-grupos')?.addEventListener('click', abrirModalTrocaGrupo);
  document.getElementById('config-botao-sair-grupo')?.addEventListener('click', () => {
    exibirNotificacao('Para sair deste grupo, transfira suas pendências antes.');
  });
  document.getElementById('config-botao-metodos-pagamento')?.addEventListener('click', () => {
    exibirNotificacao('Método ativo: PIX com liquidação instantânea.');
  });

  document.getElementById('botao-fechar-modal-perfil')?.addEventListener('click', () => {
    document.getElementById('modal-editar-perfil').classList.add('oculto');
  });

  document.getElementById('formulario-editar-perfil')?.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const nome = document.getElementById('perfil-nome').value.trim();
    const telefone = document.getElementById('perfil-telefone').value.trim();
    const chave_pix = document.getElementById('perfil-chave-pix').value.trim();
    const nova_senha = document.getElementById('perfil-nova-senha').value;

    await atualizarDadosPerfil({ 
      nome, 
      name: nome, 
      telefone, 
      phone: telefone, 
      chave_pix, 
      pix_key: chave_pix, 
      nova_senha, 
      new_password: nova_senha 
    });
    document.getElementById('modal-editar-perfil').classList.add('oculto');
  });

  // Configurações: Sair da Conta e Exclusão
  document.getElementById('botao-sair-conta')?.addEventListener('click', sairConta);
  document.getElementById('botao-excluir-conta')?.addEventListener('click', () => {
    if (confirm('Tem certeza de que deseja excluir sua conta? Esta ação é irreversível.')) {
      exibirNotificacao('Conta excluída com sucesso.');
      sairConta();
    }
  });

  // Notificações nos Cabeçalhos
  document.getElementById('botao-notificacoes-desktop')?.addEventListener('click', () => {
    exibirNotificacao('Você não tem novas notificações no momento.');
  });
  document.getElementById('botao-notificacoes-inicio')?.addEventListener('click', () => {
    exibirNotificacao('Você não tem novas notificações no momento.');
  });
  document.getElementById('botao-notificacoes-historico')?.addEventListener('click', () => {
    exibirNotificacao('Você não tem novas notificações no momento.');
  });

  // Adicionar Categoria Rápida
  document.getElementById('botao-adicionar-categoria')?.addEventListener('click', () => {
    const novaCategoria = prompt('Digite o nome da nova categoria:');
    if (novaCategoria && novaCategoria.trim()) {
      const seletor = document.getElementById('despesa-categoria');
      const opcao = document.createElement('option');
      opcao.value = novaCategoria.trim();
      opcao.textContent = novaCategoria.trim();
      opcao.selected = true;
      seletor.appendChild(opcao);
      exibirNotificacao(`Categoria "${novaCategoria.trim()}" adicionada!`);
    }
  });

  // Restaura sessão se o usuário já estiver autenticado no navegador
  const sessaoSalva = carregarSessao();
  if (sessaoSalva && sessaoSalva.usuario) {
    estado.usuarioAtual = sessaoSalva.usuario;
    estado.grupoIdAtivo = sessaoSalva.grupoIdAtivo || null;
    aplicarConfiguracoesUsuario(sessaoSalva.usuario);
    atualizarExibicaoPerfil();
    carregarPainel().then(() => {
      const telaDestino = (sessaoSalva.tela && sessaoSalva.tela !== 'tela-autenticacao') 
        ? sessaoSalva.tela 
        : 'tela-inicio';
      exibirTela(telaDestino);
    }).catch(() => {
      exibirTela('tela-inicio');
    });
  } else {
    // Caso não haja sessão salva, exibe a tela de login/cadastro
    exibirTela('tela-autenticacao');
  }
});

// Exposição explícita para ações acionadas via atributos onclick dinâmicos
window.abrirTelaCriarGrupo = abrirTelaCriarGrupo;
window.abrirModalTrocaGrupo = abrirModalTrocaGrupo;
window.prepararTelaNovaDespesa = prepararTelaNovaDespesa;
window.recalcularSomaPorcentagens = recalcularSomaPorcentagens;
window.removerEtiquetaMembro = removerEtiquetaMembro;
window.carregarPainel = carregarPainel;
window.exibirTela = exibirTela;
window.carregarTodasDespesas = carregarTodasDespesas;
window.carregarAcertoContas = carregarAcertoContas;
window.carregarRelatorios = carregarRelatorios;
window.carregarHistoricoTransacoes = carregarHistoricoTransacoes;
window.carregarTelaMembros = carregarTelaMembros;

