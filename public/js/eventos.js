document.addEventListener('DOMContentLoaded', async () => {
    const instanciaDropdown = document.getElementById('instancia-dropdown');
    const tipoDropdown = document.getElementById('tipo-dropdown');
    const filtroAplicadoContainer = document.getElementById('filtro-aplicado-container');
    const inicioInput = document.getElementById('filter-inicio');
    const fimInput = document.getElementById('filter-fim');
    const eventosTbody = document.getElementById('eventos-tbody');
    const applyFiltersButton = document.getElementById('apply-filters');
    const authToken = localStorage.getItem('auth_token');
    const loadingOverlay = document.getElementById('loading-overlay'); 


    const url_back = 'https://c747-45-187-161-165.ngrok-free.app'
  
     // Mostrar o loading
     function showLoading() {
      loadingOverlay.style.display = 'flex';
  }

  // Esconder o loading
  function hideLoading() {
      loadingOverlay.style.display = 'none';
  }

    const filtrosAplicados = {
      instancias: [],
      tipos: [],
    };
  
    if (!authToken) {
      alert('Você precisa estar logado para acessar esta página.');
      window.location.href = 'index.html';
      return;
    }
  
    // Função para carregar instâncias
    async function carregarInstancias() {
      try {
        const response = await fetch(`${url_back}/get-instancias`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${authToken}` },
        });
  
        if (!response.ok) throw new Error('Erro ao carregar instâncias.');
  
        const instancias = await response.json();
        instanciaDropdown.innerHTML = '<option value="">Selecione uma instância</option>';
  
        instancias.forEach((instancia) => {
          const option = document.createElement('option');
          option.value = instancia.id;
          option.textContent = instancia.nome;
          instanciaDropdown.appendChild(option);
        });
      } catch (error) {
        console.error('Erro ao carregar instâncias:', error);
      }
    }
  
    // Função para carregar tipos de eventos
    function carregarTipos() {
      const tiposEventos = ['Mensagem Recebida', 'Mensagem Enviada', 'Novo Contato', 'Agendamento'];
      tipoDropdown.innerHTML = '<option value="">Selecione um tipo de evento</option>';
  
      tiposEventos.forEach((tipo) => {
        const option = document.createElement('option');
        option.value = tipo;
        option.textContent = tipo;
        tipoDropdown.appendChild(option);
      });
    }
  
    // Atualizar barra de filtros aplicados
    function atualizarFiltrosAplicados() {
      filtroAplicadoContainer.innerHTML = '';
  
      filtrosAplicados.instancias.forEach((instancia) => {
        const tag = document.createElement('div');
        tag.className = 'filtro-tag';
        tag.textContent = instancia.text;
  
        const removeButton = document.createElement('span');
        removeButton.className = 'remove-tag';
        removeButton.textContent = '×';
        removeButton.addEventListener('click', () => {
          filtrosAplicados.instancias = filtrosAplicados.instancias.filter((i) => i.value !== instancia.value);
          atualizarFiltrosAplicados();
          const option = document.createElement('option');
          option.value = instancia.value;
          option.textContent = instancia.text;
          instanciaDropdown.appendChild(option);
        });
  
        tag.appendChild(removeButton);
        filtroAplicadoContainer.appendChild(tag);
      });
  
      filtrosAplicados.tipos.forEach((tipo) => {
        const tag = document.createElement('div');
        tag.className = 'filtro-tag';
        tag.textContent = tipo.text;
  
        const removeButton = document.createElement('span');
        removeButton.className = 'remove-tag';
        removeButton.textContent = '×';
        removeButton.addEventListener('click', () => {
          filtrosAplicados.tipos = filtrosAplicados.tipos.filter((t) => t.value !== tipo.value);
          atualizarFiltrosAplicados();
          const option = document.createElement('option');
          option.value = tipo.value;
          option.textContent = tipo.text;
          tipoDropdown.appendChild(option);
        });
  
        tag.appendChild(removeButton);
        filtroAplicadoContainer.appendChild(tag);
      });
    }
  
    // Eventos para adicionar filtros
    instanciaDropdown.addEventListener('change', () => {
      const selectedOption = instanciaDropdown.selectedOptions[0];
      if (selectedOption && selectedOption.value) {
        filtrosAplicados.instancias.push({ value: selectedOption.value, text: selectedOption.textContent });
        atualizarFiltrosAplicados();
        instanciaDropdown.removeChild(selectedOption);
      }
    });
  
    tipoDropdown.addEventListener('change', () => {
      const selectedOption = tipoDropdown.selectedOptions[0];
      if (selectedOption && selectedOption.value) {
        filtrosAplicados.tipos.push({ value: selectedOption.value, text: selectedOption.textContent });
        atualizarFiltrosAplicados();
        tipoDropdown.removeChild(selectedOption);
      }
    });
  
    // Carregar eventos com filtros
    async function carregarEventos() {
      const instanciasSelecionadas = filtrosAplicados.instancias.map((i) => i.value);
      const tiposSelecionados = filtrosAplicados.tipos.map((t) => t.value);
      const periodoInicio = inicioInput.value;
      const periodoFim = fimInput.value;
  
      try {
        const query = new URLSearchParams({
          instancias: instanciasSelecionadas.join(','),
          tipos: tiposSelecionados.join(','),
          periodo_inicio: periodoInicio,
          periodo_fim: periodoFim,
        });
  
        const response = await fetch(`${url_back}/eventos?${query.toString()}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${authToken}` },
        });
  
        if (!response.ok) throw new Error('Erro ao carregar eventos.');
  
        const eventos = await response.json();
  
        if (eventos.length === 0) {
          eventosTbody.innerHTML = '<tr><td colspan="4">Nenhum evento encontrado.</td></tr>';
          return;
        }
  
        eventosTbody.innerHTML = eventos
          .map(
            (evento) => `
              <tr>
                <td>${evento.instancia}</td>
                <td>${evento.evento}</td>
                <td>${evento.status_webhook || 'N/A'}</td>
                <td><button class="btn-details" data-id="${evento.id}">Detalhes</button></td>
              </tr>`
          )
          .join('');
      } catch (error) {
        console.error('Erro ao carregar eventos:', error);
        eventosTbody.innerHTML = '<tr><td colspan="4">Erro ao carregar eventos.</td></tr>';
      }
    }
  
    // Listeners
    applyFiltersButton.addEventListener('click', carregarEventos);
  
   showLoading();
    await carregarInstancias();
    carregarTipos();
    hideLoading();
  });
  