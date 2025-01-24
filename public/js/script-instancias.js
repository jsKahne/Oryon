document.addEventListener('DOMContentLoaded', async () => {
    const btnAbrirModal = document.getElementById('btn-abrir-modal-cad-instancia');
    const modalCadInstancia = document.getElementById('modal-cad-instancia');
    const btnFecharModal = document.getElementById('btn-fechar-modal-cad-instancia');
    const formCadInstancia = document.getElementById('form-cad-instancia');
    const qrCodeContainer = document.getElementById('qr-code-container');
    const qrCodeImg = document.getElementById('qr-code-img');
    const instanciasList = document.getElementById('instancias-list');
    const btnFecharModalReconectar = document.getElementById('btn-fechar-modal-reconectar');
    const loadingOverlay = document.getElementById('loading-overlay');

    const url_back = 'https://c747-45-187-161-165.ngrok-free.app';

    let updateInterval = null;

    // Mostrar o loading
    function showLoading() {
        loadingOverlay.style.display = 'flex';
    }

    // Esconder o loading
    function hideLoading() {
        loadingOverlay.style.display = 'none';
    }

    // Função para criar uma pausa
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Fechar modal de cadastro
    btnFecharModal.addEventListener('click', () => {
        modalCadInstancia.style.display = 'none';
        formCadInstancia.reset();
        qrCodeContainer.style.display = 'none';
        qrCodeImg.src = '';
        if (updateInterval) {
            clearInterval(updateInterval);
            updateInterval = null;
        }
    });

    // Abrir modal de cadastro
    btnAbrirModal.addEventListener('click', () => {
        modalCadInstancia.style.display = 'flex';
    });

    // Função para carregar lista de instâncias e exibir em cards
    async function carregarInstancias() {
        showLoading();
        try {
            const response = await fetch(`${url_back}/get-instancias`, {
                method: 'POST',
            });

            if (!response.ok) throw new Error('Erro ao carregar instâncias.');

            const instancias = await response.json();

            if (instancias.length === 0) {
                instanciasList.innerHTML = '<p>Nenhuma instância encontrada.</p>';
                hideLoading();
                return;
            }

            // Montar os cards com as informações das instâncias
            instanciasList.innerHTML = instancias.map(instancia => `
                <div class="card-instancia">
                    <!-- Status Icon -->
                    <div class="status-icon">
                        ${instancia.status === 'conectado' 
                            ? `<svg width="24" height="24" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="60" cy="60" r="48" fill="#44bf00"></circle>
                                <polygon fill="#fff" points="53.303,84 26.139,56.838 33.582,49.395 53.303,69.116 86.418,36 93.861,43.443"></polygon>
                            </svg>`
                            : `<svg width="24" height="24" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                                <path fill="#f44336" d="M44,24c0,11.045-8.955,20-20,20S4,35.045,4,24S12.955,4,24,4S44,12.955,44,24z"></path>
                                <path fill="#fff" d="M29.656,15.516l2.828,2.828l-14.14,14.14l-2.828-2.828L29.656,15.516z"></path>
                                <path fill="#fff" d="M32.484,29.656l-2.828,2.828l-14.14-14.14l2.828-2.828L32.484,29.656z"></path>
                            </svg>`}
                    </div>
            
                    <!-- Nome e Detalhes -->
                    <h3>${instancia.nome}</h3>
                    <p><strong>Telefone:</strong> ${instancia.telefone}</p>
                    <p><strong>Status:</strong> ${instancia.status}</p>
                    <p><strong>Atualizado:</strong> ${new Date(instancia.dt_atualizacao).toLocaleString()}</p>
            
                    <!-- Botões de Ação -->
                    <div class="buttons">
                        <button class="btn-delete" data-telefone="${instancia.telefone}">
                            <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M 10 2 L 9 3 L 4 3 L 4 5 L 5 5 L 5 20 C 5 20.522222 5.1913289 21.05461 5.5683594 21.431641 C 5.9453899 21.808671 6.4777778 22 7 22 L 17 22 C 17.522222 22 18.05461 21.808671 18.431641 21.431641 C 18.808671 21.05461 19 20.522222 19 20 L 19 5 L 20 5 L 20 3 L 15 3 L 14 2 L 10 2 z"></path>
                            </svg>
                        </button>
                        <button class="btn-config" data-id="${instancia.id}">
                             <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="24" height="24" viewBox="0,0,256,256">
                                <g fill="#ffffff" fill-rule="nonzero" stroke="none" stroke-width="1" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="10" stroke-dasharray="" stroke-dashoffset="0" font-family="none" font-weight="none" font-size="none" text-anchor="none" style="mix-blend-mode: normal"><g transform="scale(5.12,5.12)"><path d="M32.21875,2.0625l-4.375,1.71875l0.78125,3.78125c-0.30469,0.30469 -0.62891,0.65625 -0.96875,1.03125l-3.75,-0.84375l-1.84375,4.3125l3.1875,2.125c-0.03516,0.52734 -0.03516,1.06641 0,1.59375l-3.28125,2l1.71875,4.375l3.6875,-0.75c0.33203,0.39844 0.69531,0.76172 1.09375,1.09375l-0.84375,3.6875l4.34375,1.84375l2.125,-3.1875c0.53125,0.03516 1.03125,0.03516 1.5625,0l2.03125,3.28125l4.375,-1.71875l-0.84375,-4c0.39453,-0.32812 0.73438,-0.70312 1.0625,-1.09375l3.8125,0.96875l1.875,-4.375l-3.3125,-2.03125c0.03125,-0.51953 0.03125,-1.01172 0,-1.53125l3.28125,-2.03125l-1.71875,-4.375l-3.8125,0.84375c-0.32812,-0.39453 -0.69922,-0.76562 -1.09375,-1.09375l0.84375,-3.6875l-4.34375,-1.84375l-2.03125,3.1875c-0.52344,-0.05078 -1.05078,-0.07812 -1.5625,-0.03125zM35,11c2.21094,0 4,1.78906 4,4c0,2.21094 -1.78906,4 -4,4c-2.21094,0 -4,-1.78906 -4,-4c0,-2.21094 1.78906,-4 4,-4zM13.53125,20l-0.625,4c-0.55078,0.17578 -1.10937,0.42578 -1.65625,0.71875l-3.34375,-2.4375l-3.5,3.5l2.3125,3.375c-0.27734,0.54688 -0.49609,1.09766 -0.6875,1.65625l-4.03125,0.75v4.875l4,0.71875c0.17578,0.55469 0.42188,1.13672 0.71875,1.6875l-2.4375,3.25l3.5,3.5l3.375,-2.3125c0.54297,0.27734 1.10156,0.49609 1.65625,0.6875l0.625,4.03125h4.90625l0.71875,-4c0.55859,-0.17578 1.13672,-0.42187 1.6875,-0.71875l3.34375,2.4375l3.5,-3.5l-2.40625,-3.375c0.27344,-0.54297 0.46484,-1.10156 0.65625,-1.65625l4.15625,-0.75v-4.90625l-4.09375,-0.625c-0.17578,-0.55078 -0.42578,-1.11328 -0.71875,-1.65625l2.40625,-3.34375l-3.46875,-3.625l-3.40625,2.4375c-0.53516,-0.27344 -1.07422,-0.49609 -1.625,-0.6875l-0.625,-4.03125zM16,30c2.19922,0 4,1.80078 4,4c0,2.19922 -1.80078,4 -4,4c-2.19922,0 -4,-1.80078 -4,-4c0,-2.19922 1.80078,-4 4,-4z"></path></g></g>
                            </svg>
                        </button>
                    </div>
            
                    <!-- Botão de Reconectar -->
                    ${instancia.status !== 'conectado' 
                        ? `<button class="btn-reconnect" data-telefone="${instancia.telefone}">Reconectar</button>` 
                        : ''}
                </div>
            `).join('');

            // Configurar eventos dos botões
            document.querySelectorAll('.btn-config').forEach(button => {
                button.addEventListener('click', () => {
                    const idInstancia = button.getAttribute('data-id');
                    window.location.href = `configuracoes.html?id=${idInstancia}`;
                });
            });

            document.querySelectorAll('.btn-reconnect').forEach(button => {
                button.addEventListener('click', async () => {
                    const telefone = button.getAttribute('data-telefone');
                    await reconectarInstancia(telefone);
                });
            });

            document.querySelectorAll('.btn-delete').forEach(button => {
                button.addEventListener('click', async () => {
                    const telefone = button.getAttribute('data-telefone');
                    await excluirInstancia(telefone);
                });
            });

        } catch (error) {
            console.error('Erro ao carregar instâncias:', error);
            instanciasList.innerHTML = '<p>Erro ao carregar instâncias.</p>';
        }
        hideLoading();
    }

    // Cadastro de nova instância
    formCadInstancia.addEventListener('submit', async (event) => {
        event.preventDefault();

        const nome = document.getElementById('input-nome').value;
        const telefone = document.getElementById('input-telefone').value;

        try {
            const response = await fetch(`${url_back}/conectar-instancia`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome, telefone }),
            });

            if (response.ok) {
                const data = await response.json();
                if (data.qr) {
                    qrCodeImg.src = data.qr;
                    qrCodeContainer.style.display = 'block';
                } else {
                    alert('QR Code não gerado. Verifique o backend.');
                }
                await carregarInstancias();
            } else {
                const error = await response.json();
                alert(`Erro ao cadastrar instância: ${error.error}`);
            }
        } catch (error) {
            console.error('Erro ao cadastrar instância:', error);
            alert('Erro ao conectar a instância.');
        }
    });

    // Reconectar instância
    async function reconectarInstancia(telefone) {
        const modalReconnect = document.getElementById('modal-reconnect-instancia');
        const reconnectTitle = document.getElementById('reconnect-title');
        const qrCodeReconnectImg = document.getElementById('qr-code-reconnect-img');
        const btnReconnectOk = document.getElementById('btn-reconnect-ok');
    
        try {
            showLoading();
    
            const response = await fetch(`${url_back}/reconnect-instancia`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ telefone }),
            });
    
            if (response.ok) {
                const data = await response.json();
    
                reconnectTitle.textContent = `Reconectando a instância (${telefone})`;
                qrCodeReconnectImg.src = data.qr;
                modalReconnect.style.display = 'flex';
            } else {
                const error = await response.json();
                alert(`Erro ao reconectar instância: ${error.error}`);
            }
        } catch (error) {
            console.error('Erro ao reconectar instância:', error);
            alert('Erro ao reconectar instância.');
        } finally {
            hideLoading();
        }
    
        btnReconnectOk.addEventListener('click', () => {
            modalReconnect.style.display = 'none';
        });
    }
    

    // Excluir instância
    async function excluirInstancia(telefone) {
        showLoading();
        try {
            const response = await fetch(`${url_back}/delete-instancia/${telefone}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                alert('Instância excluída com sucesso.');
                await carregarInstancias();
            } else {
                const error = await response.json();
                alert(`Erro ao excluir instância: ${error.error}`);
            }
        } catch (error) {
            console.error('Erro ao excluir instância:', error);
            alert('Erro ao excluir a instância.');
        }
        hideLoading();
    }

    // Carregar as instâncias ao iniciar
    showLoading();
    await carregarInstancias();
    hideLoading();
});
