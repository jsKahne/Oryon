document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const idEvento = urlParams.get('id');
    const detalhesContainer = document.getElementById('detalhes-container');

    const url_back = 'https://c747-45-187-161-165.ngrok-free.app'
    const loadingOverlay = document.getElementById('loading-overlay'); 

    if (!idEvento) {
        detalhesContainer.innerHTML = '<p>ID do evento não fornecido.</p>';
        return;
    }

     // Mostrar o loading
     function showLoading() {
        loadingOverlay.style.display = 'flex';
    }

    // Esconder o loading
    function hideLoading() {
        loadingOverlay.style.display = 'none';
    }

    // Função para carregar os detalhes do evento
    async function carregarDetalhes() {
        try {
            const response = await fetch(`${url_back}/eventos/detalhes/${idEvento}`);
            if (!response.ok) {
                throw new Error('Erro ao carregar detalhes do evento.');
            }

            const detalhes = await response.json();

            detalhesContainer.innerHTML = `
                <p><strong>ID:</strong> ${detalhes.id}</p>
                <p><strong>Evento:</strong> ${detalhes.evento}</p>
                <p><strong>Webhook:</strong> ${detalhes.webhook}</p>
                <p><strong>Pixel ID:</strong> ${detalhes.pixel_id || 'N/A'}</p>
                <p><strong>Token API Conversão:</strong> ${detalhes.api_conversion_token || 'N/A'}</p>
                <p><strong>Data de Criação:</strong> ${new Date(detalhes.dt_criacao).toLocaleString()}</p>
                <p><strong>Última Atualização:</strong> ${new Date(detalhes.dt_atualizacao).toLocaleString()}</p>
            `;
        } catch (error) {
            console.error('Erro ao carregar detalhes:', error);
            detalhesContainer.innerHTML = '<p>Erro ao carregar detalhes do evento.</p>';
        }
    }

    showLoading();
    await carregarDetalhes();
    hideLoading();
});
