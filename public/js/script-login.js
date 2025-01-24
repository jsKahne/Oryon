const loginForm = document.getElementById('loginForm');
const errorMessage = document.getElementById('error-message');
const loadingOverlay = document.getElementById('loading-overlay');

const url_back = 'https://c747-45-187-161-165.ngrok-free.app'


loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  // Mostrar o loading
  loadingOverlay.style.display = 'flex';

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  try {
    const response = await fetch(`${url_back}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, senha: password }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      errorMessage.textContent = errorData.error || 'Erro desconhecido.';
      return;
    }

    const data = await response.json();
    localStorage.setItem('auth_token', data.token); // Salvar o token
    localStorage.setItem('user_name', data.nome); // Salvar o nome do usuário
    alert('Login realizado com sucesso!');
    window.location.href = '/home.html'; // Redireciona para a página inicial
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    errorMessage.textContent = 'Erro ao conectar ao servidor.';
  } finally {
    // Ocultar o loading após o processamento
    loadingOverlay.style.display = 'none';
  }
});

  // Capturar o clique no botão e enviar o formulário
  document.getElementById('submitButton').addEventListener('click', function(event) {
      event.preventDefault();
      document.getElementById('loginForm').dispatchEvent(new Event('submit'));
  });
