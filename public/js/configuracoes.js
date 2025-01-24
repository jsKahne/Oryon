document.addEventListener('DOMContentLoaded', async () => {
    const instanciaNomeElement = document.getElementById('instancia-nome');
    const feedbackElement = document.getElementById('feedback');

    // Inputs para Webhooks
    const inputEventoMe = document.getElementById('evento-me');
    const inputEventoMr = document.getElementById('evento-mr');
    const inputEventoNc = document.getElementById('evento-nc');
    const inputEventoAg = document.getElementById('evento-ag');
    const inputEventoCancelamentoAgendamento = document.getElementById('evento-cancelamento-agendamento');
    const inputEventoInstanciaConectada = document.getElementById('evento-instancia-conectada');
    const inputEventoInstanciaDesconectada = document.getElementById('evento-instancia-desconectada');

    // Inputs para Config Mensagens
    const inputMensagemAgendamento = document.getElementById('evento-agendamento');

    // Inputs para Meta Configurações
    const inputMetaPixel = document.getElementById('meta-pixel');
    const inputMetaToken = document.getElementById('meta-token');

    const saveConfigButton = document.getElementById('save-config');
    const urlParams = new URLSearchParams(window.location.search);
    const idInstancia = urlParams.get('id');
    const authToken = localStorage.getItem('auth_token');
    const userName = localStorage.getItem('user_name');

    const loadingOverlay = document.getElementById('loading-overlay'); // Elemento de loading

    const url_back = 'https://c747-45-187-161-165.ngrok-free.app';

    if (!authToken) {
        alert('Você precisa estar logado para acessar esta página.');
        window.location.href = 'index.html';
        return;
    }

    if (!idInstancia) {
        instanciaNomeElement.textContent = 'ID da instância não fornecido.';
        return;
    }

    const userNameElement = document.querySelector('.header p');
    userNameElement.textContent = userName || 'Usuário Logado';

    // Mostrar o loading
    function showLoading() {
        loadingOverlay.style.display = 'flex';
    }

    // Esconder o loading
    function hideLoading() {
        loadingOverlay.style.display = 'none';
    }

    // Carregar o nome da instância
    async function carregarNomeInstancia() {
        try {
            const response = await fetch(`${url_back}/instancias/${idInstancia}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${authToken}` },
            });

            if (!response.ok) throw new Error(`Erro ao carregar nome: ${response.status}`);

            const instancia = await response.json();
            instanciaNomeElement.textContent = instancia.nome || 'Nome não encontrado';
        } catch (error) {
            console.error('Erro ao carregar nome da instância:', error);
            instanciaNomeElement.textContent = 'Erro ao carregar nome';
        }
    }

    // Carregar as configurações da instância
    async function carregarConfiguracoes() {
        try {
            const response = await fetch(`${url_back}/configuracoes/${idInstancia}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${authToken}` },
            });

            if (!response.ok) throw new Error('Erro ao carregar configurações.');

            const configuracoes = await response.json();

            configuracoes.forEach((config) => {
                switch (config.tipo) {
                    case 'webhook':
                        if (config.evento === 'mensagem_enviada') inputEventoMe.value = config.webhook || '';
                        if (config.evento === 'mensagem_recebida') inputEventoMr.value = config.webhook || '';
                        if (config.evento === 'novo_contato') inputEventoNc.value = config.webhook || '';
                        if (config.evento === 'agendamento') inputEventoAg.value = config.webhook || '';
                        if (config.evento === 'cancelamento_agendamento') inputEventoCancelamentoAgendamento.value = config.webhook || '';
                        if (config.evento === 'instancia_conectada') inputEventoInstanciaConectada.value = config.webhook || '';
                        if (config.evento === 'instancia_desconectada') inputEventoInstanciaDesconectada.value = config.webhook || '';
                        break;
                    case 'Config Mensagens':
                        if (config.evento === 'mensagem_agendamento') inputMensagemAgendamento.value = config.webhook || '';
                        if (config.evento === 'cancelamento_agendamento') inputEventoCancelamentoAgendamento.value = config.webhook || '';
                        break;
                    case 'Meta':
                        if (config.evento === 'pixel_id') inputMetaPixel.value = config.webhook || '';
                        if (config.evento === 'api_conversion') inputMetaToken.value = config.webhook || '';
                        break;
                }
            });
        } catch (error) {
            console.error('Erro ao carregar configurações:', error);
            feedbackElement.textContent = 'Erro ao carregar configurações.';
            feedbackElement.style.color = 'red';
        }
    }

    // Salvar as configurações
    saveConfigButton.addEventListener('click', async () => {
        const configData = {
            id_instancia: idInstancia,
            eventos: {
                mensagem_enviada: inputEventoMe.value || null,
                mensagem_recebida: inputEventoMr.value || null,
                novo_contato: inputEventoNc.value || null,
                agendamento: inputEventoAg.value || null,
                cancelamento_agendamento: inputEventoCancelamentoAgendamento.value || null,
                instancia_conectada: inputEventoInstanciaConectada.value || null,
                instancia_desconectada: inputEventoInstanciaDesconectada.value || null,
            },
            mensagens: {
                mensagem_agendamento: inputMensagemAgendamento.value || null,
                cancelamento_agendamento: inputEventoCancelamentoAgendamento.value || null,
            },
            meta: {
                pixel_id: inputMetaPixel.value || null,
                api_conversion: inputMetaToken.value || null,
            },
        };

        try {
            showLoading();
            const response = await fetch(`${url_back}/configuracoes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                },
                body: JSON.stringify(configData),
            });
            
            if (response.ok) {
                hideLoading();
                feedbackElement.textContent = 'Configurações salvas com sucesso!';
                feedbackElement.style.color = 'green';
                setTimeout(() => (window.location.href = 'instancias.html'), 1000);
            } else {
                hideLoading();
                feedbackElement.textContent = 'Erro ao salvar configurações.';
                feedbackElement.style.color = 'red';
            }
        } catch (error) {
            hideLoading();
            console.error('Erro ao salvar configurações:', error);
            feedbackElement.textContent = 'Erro ao salvar configurações.';
            feedbackElement.style.color = 'red';
        }
    });

    // Executar as funções com o loading
    showLoading();
    await carregarNomeInstancia();
    await carregarConfiguracoes();
    hideLoading();
});
