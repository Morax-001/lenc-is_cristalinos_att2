// Formulário de contato — Lençóis Cristalinos
// Requer o jQuery carregado antes deste arquivo (ver contato.html).

$(function () {
  var $form = $('#form-contato');
  if ($form.length === 0) return;

  var $status = $('#form-status');
  var $botao = $form.find('button[type="submit"]');
  var $contador = $('#contador');
  var textoOriginalBotao = $botao.text();
  var CAMPOS = ['nome', 'email', 'assunto', 'mensagem'];
  var ROTULOS = { nome: 'Nome', email: 'E-mail', assunto: 'Assunto', mensagem: 'Mensagem' };

  function valorDe(campo) {
    return $form.find('[name="' + campo + '"]').val().trim();
  }

  function mostrarStatus(tipo, texto) {
    $status.attr('class', 'form-status ' + tipo).text(texto);
  }

  function atualizarContador() {
    $contador.text($form.find('[name="mensagem"]').val().length + ' / 2000');
  }

  // Retorna o primeiro campo vazio, ou null se todos estiverem preenchidos
  function campoVazio() {
    for (var i = 0; i < CAMPOS.length; i++) {
      if (valorDe(CAMPOS[i]) === '') return CAMPOS[i];
    }
    return null;
  }

  // Tira o destaque vermelho assim que a pessoa volta a digitar
  $form.on('input', 'input, textarea', function () {
    $(this).removeClass('invalido');
    if (this.name === 'mensagem') atualizarContador();
  });

  $form.on('submit', function (e) {
    e.preventDefault();
    $form.find('.invalido').removeClass('invalido');

    var vazio = campoVazio();
    if (vazio) {
      mostrarStatus('erro', 'Preencha o campo ' + ROTULOS[vazio] + '.');
      $form.find('[name="' + vazio + '"]').addClass('invalido').focus();
      return;
    }

    var dados = {
      nome: valorDe('nome'),
      email: valorDe('email'),
      assunto: valorDe('assunto'),
      mensagem: valorDe('mensagem'),
      website: $form.find('[name="website"]').val() // campo isca
    };

    $botao.prop('disabled', true).text('Enviando...');
    mostrarStatus('enviando', 'Enviando sua mensagem...');

    $.ajax({
      url: '/api/contato',
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify(dados),
      dataType: 'json',
      timeout: 10000
    })
      .done(function () {
        // SUCESSO: Avisa na tela, limpa o formulário e redireciona
        mostrarStatus('sucesso', 'Mensagem enviada com sucesso! Redirecionando...');
        $form[0].reset();
        atualizarContador();
        setTimeout(function () {
          window.location.href = 'vlw.html';
        }, 900);
      })
      .fail(function (xhr, textStatus) {
        // FALHA: Avisa na tela o que aconteceu, mas NÃO limpa os campos para não perder o que foi digitado
        console.error('Falha no envio:', textStatus, xhr.status, xhr.responseText);
        mostrarStatus('erro', 'Não foi possível enviar no momento. Verifique os dados e tente novamente.');
        $botao.prop('disabled', false).text(textoOriginalBotao);
      });
  });

  atualizarContador();
});