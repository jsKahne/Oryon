// Carregar informações do usuário
window.addEventListener('DOMContentLoaded', () => {
    const authToken = localStorage.getItem('auth_token');
    const userName = localStorage.getItem('user_name');
    const loadingOverlay = document.getElementById('loading-overlay'); 
  
     // Mostrar o loading
     function showLoading() {
      loadingOverlay.style.display = 'flex';
  }

  // Esconder o loading
  function hideLoading() {
      loadingOverlay.style.display = 'none';
  }

    if (!authToken) {
      alert('Você precisa estar logado para acessar esta página.');
      window.location.href = 'index.html'; // Redireciona para login
    }
  
    // Exibir o nome do usuário logado
    const userNameElement = document.querySelector('.header p');
    if (userName) {
      userNameElement.textContent = `Bem-vindo, ${userName}`;
    } else {
      userNameElement.textContent = 'Usuário Logado'; // Padrão caso o nome não exista
    }
  });

  showLoading();
  hideLoading();

  