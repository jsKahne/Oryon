require('dotenv').config();
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const cors = require('cors');
const makeWASocket = require('./Baileys').default;
const { DisconnectReason } = require('./Baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode');
const fs = require('fs');
const { useMultiFileAuthState } = require('./Baileys');
const { fetchLatestBaileysVersion } = require('./Baileys');

// Configuração do Banco de Dados
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

// Configuração do Servidor
const app = express();
const PORT = 3000;
const SECRET_KEY = process.env.SECRET_KEY;


app.use(cors());

app.use(express.json());
app.use(cors({ origin: '*' }));

// Middleware para Logs Simples
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});


// Rota para criar usuário
app.post('/usuarios', async (req, res) => {
    const { nome, email, senha, tipo } = req.body;

    if (!nome || !email || !senha || !tipo) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(senha, 10);
        const result = await pool.query(
            `INSERT INTO oryon_trace.clientes (nome, email, senha, tipo, dt_criacao, dt_atualizacao)
             VALUES ($1, $2, $3, $4, NOW(), NOW())
             RETURNING id, nome, email, tipo`,
            [nome, email, hashedPassword, tipo]
        );

        res.status(201).json({ message: 'Usuário criado com sucesso.', user: result.rows[0] });
    } catch (err) {
        console.error(err);
        if (err.code === '23505') {
            res.status(409).json({ error: 'Email já cadastrado.' });
        } else {
            res.status(500).json({ error: 'Erro no servidor.' });
        }
    }
});

// Rota de login
app.post('/login', async (req, res) => {
    const { email, senha } = req.body;

    try {
        const result = await pool.query('SELECT * FROM oryon_trace.clientes WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        const user = result.rows[0];
        const isPasswordValid = await bcrypt.compare(senha, user.senha);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Senha inválida' });
        }

        const token = jwt.sign({ id: user.id, tipo: user.tipo }, SECRET_KEY, { expiresIn: '1h' });
        res.json({ token, tipo: user.tipo, nome: user.nome });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro no servidor.' });
    }
});

async function enviarEventoParaWebhook(idInstancia, evento, payload) {
    try {
        const query = `
            SELECT webhook FROM oryon_trace.configuracoes_instancias
            WHERE id_instancia = $1 AND evento = $2
        `;
        const result = await pool.query(query, [idInstancia, evento]);

        if (result.rows.length === 0) {
            console.log(`[${evento}] Nenhum webhook configurado para o evento.`);
            return;
        }

        const webhookUrl = result.rows[0].webhook;

        console.log(`\n=== Enviando Evento: ${evento} ===`);
        console.log(`Webhook URL: ${webhookUrl}`);
        console.log('Payload do Evento:', JSON.stringify(payload, null, 2));

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            console.error(`Erro ao enviar evento ${evento} para ${webhookUrl}: ${response.statusText}`);
        } else {
            console.log(`Evento ${evento} enviado com sucesso para ${webhookUrl}.`);
        }
    } catch (error) {
        console.error(`Erro ao enviar evento ${evento}:`, error);
    }
}




// Reconectar Instâncias ao Iniciar o Servidor
async function reconectarInstancias() {
    try {
        const instancias = await pool.query('SELECT * FROM oryon_trace.instancias WHERE status = $1', ['Conectado']);
        for (const instancia of instancias.rows) {
            console.log(`Reconectando instância: ${instancia.telefone} (${instancia.nome})`);

            const authDir = `./auth_info/${instancia.telefone}`;
            const { state, saveCreds } = await useMultiFileAuthState(authDir);
            const version = [2, 3000, 1017531287];

            const socket = makeWASocket({
                auth: state,
                version,
                browser: ['OryonTrace', 'Chrome', '10.0.0'],
            });

            socket.ev.on('creds.update', saveCreds);

            await conectarInstancia(instancia.nome, instancia.telefone, true);

            // Monitorar eventos para a instância reconectada
            iniciarMonitoramentoEventos(socket, instancia.telefone, instancia.id);
        }
    } catch (err) {
        console.error('Erro ao reconectar instâncias:', err);
    }
}


// Função para Conectar uma Nova Instância
async function conectarInstancia(nome, telefone, isReconnecting = false) {
    const authDir = `./auth_info/${telefone}`;
    try {
        if (fs.existsSync(authDir)) {
            if (!isReconnecting) {
                fs.rmSync(authDir, { recursive: true, force: true });
                console.log(`Autenticação antiga removida para ${telefone}`);
            }
        }

        const { state, saveCreds } = await useMultiFileAuthState(authDir);
        const version = [2, 3000, 1017531287]; // Versão estável do WhatsApp Web
        console.log(`Usando a versão específica do WhatsApp Web: ${version}`);

        const socket = makeWASocket({
            auth: state,
            version,
            browser: ['OryonTrace', 'Chrome', '10.0.0'],
        });

        socket.ev.on('creds.update', saveCreds);

        let qrBase64 = null;

        socket.ev.on('connection.update', async (update) => {
            const { connection, qr, lastDisconnect } = update;

            if (qr) {
                console.log(`QR Code gerado para ${telefone}`);
                qrBase64 = await qrcode.toDataURL(qr);

                await pool.query(
                    `INSERT INTO oryon_trace.instancias (nome, telefone, status, dt_criacao, dt_atualizacao)
                     VALUES ($1, $2, $3, NOW(), NOW())
                     ON CONFLICT (telefone) DO UPDATE SET nome = $1, status = $3, dt_atualizacao = NOW()`,
                    [nome, telefone, 'Aguardando Conexão']
                );
            }

            if (connection === 'open') {
                console.log(`Conexão estabelecida com ${telefone}`);
                await pool.query(
                    `UPDATE oryon_trace.instancias SET status = $1, auth_info = $2, dt_atualizacao = NOW() WHERE telefone = $3`,
                    ['Conectado', JSON.stringify(state), telefone]
                );

                // Enviar evento de instância conectada para o webhook
                const payload = {
                    evento: 'instancia_conectada',
                    telefone,
                    nome,
                    timestamp: new Date().toISOString(),
                };
                await enviarEventoParaWebhook(telefone, 'instancia_conectada', payload);
            }

            if (connection === 'close') {
                const reason = new Boom(lastDisconnect?.error).output?.statusCode || 'Desconhecido';
                console.error(`Conexão encerrada para ${telefone}. Razão: ${reason}`);

                await pool.query(
                    `UPDATE oryon_trace.instancias SET status = $1, dt_atualizacao = NOW() WHERE telefone = $2`,
                    ['Desconectado', telefone]
                );

                // Enviar evento de desconexão para o webhook
                const payload = {
                    evento: 'instancia_desconectada',
                    telefone,
                    nome,
                    motivo: reason,
                    timestamp: new Date().toISOString(),
                };
                await enviarEventoParaWebhook(telefone, 'instancia_desconectada', payload);

                // Tentativa de reconexão
                if (reason === 515) {
                    console.log('Erro 515 detectado. Tentando reconectar...');
                    setTimeout(() => conectarInstancia(nome, telefone, true), 5000);
                }
            }
        });

        // Monitorar outros eventos e exibi-los no terminal
        socket.ev.on('messages.upsert', async (messageEvent) => {
            console.log(`Evento de mensagens recebido para ${telefone}:`, JSON.stringify(messageEvent, null, 2));
        });

        socket.ev.on('events', (event) => {
            console.log(`Evento global capturado para ${telefone}:`, JSON.stringify(event, null, 2));
        });

        while (!qrBase64) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }

        return qrBase64;
    } catch (err) {
        console.error(`Erro ao conectar a instância ${telefone}:`, err);
        throw new Error('Erro ao conectar a instância.');
    }
}

// Endpoint para Conectar Instância e Obter QR Code
app.post('/conectar-instancia', async (req, res) => {
    const { nome, telefone } = req.body;
    if (!nome || !telefone) {
        return res.status(400).json({ error: 'Nome e telefone são obrigatórios.' });
    }

    try {
        const qrBase64 = await conectarInstancia(nome, telefone);
        res.status(200).json({ qr: qrBase64 });
    } catch (err) {
        console.error('Erro na conexão:', err);
        res.status(500).json({ error: 'Erro ao conectar a instância.' });
    }
});

app.post('/get-instancias', async (req, res) => {
    try {
        console.log('Iniciando busca de instâncias no banco de dados...');
        const result = await pool.query('SELECT * FROM oryon_trace.instancias');

        if (result.rows.length === 0) {
            console.log('Nenhuma instância encontrada.');
            return res.status(200).json([]);
        }

        console.log('Instâncias encontradas:', result.rows);

        res.setHeader('Content-Type', 'application/json');
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Erro ao buscar instâncias no banco de dados:', err.message);

        res.setHeader('Content-Type', 'application/json');
        res.status(500).json({
            error: 'Erro ao buscar instâncias no banco de dados.',
            details: err.message,
        });
    }
});

// Endpoint para excluir instância
app.delete('/delete-instancia/:telefone', async (req, res) => {
    const { telefone } = req.params;

    if (!telefone) {
        return res.status(400).json({ error: 'Telefone é obrigatório.' });
    }

    try {
        await pool.query('DELETE FROM oryon_trace.instancias WHERE telefone = $1', [telefone]);

        const authDir = `./auth_info/${telefone}`;
        if (fs.existsSync(authDir)) {
            fs.rmSync(authDir, { recursive: true, force: true });
            console.log(`Autenticação removida para ${telefone}`);
        }

        res.status(200).json({ message: 'Instância excluída com sucesso.' });
    } catch (err) {
        console.error(`Erro ao excluir instância ${telefone}:`, err);
        res.status(500).json({ error: 'Erro ao excluir instância.' });
    }
});


app.post('/criar-contato', async (req, res) => {
    const { nome, telefone, utm_source, utm_campaign, utm_medium, utm_term, utm_content } = req.body;

    if (!telefone) {
        return res.status(400).json({ error: 'Telefone é obrigatório.' });
    }

    try {
        await pool.query(
            `INSERT INTO oryon_trace.contatos (nome, telefone, utm_source, utm_campaign, utm_medium, utm_term, utm_content, dt_criacao, dt_atualizacao)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
            [nome, telefone, utm_source, utm_campaign, utm_medium, utm_term, utm_content]
        );
        res.status(201).json({ message: 'Contato criado com sucesso.' });
    } catch (err) {
        console.error('Erro ao criar contato:', err);
        res.status(500).json({ error: 'Erro ao criar contato.' });
    }
});


// Obter configurações de uma instância
app.post('/configuracoes/:id_instancia', async (req, res) => {
    const { id_instancia } = req.params;

    try {
        const result = await pool.query(
            `SELECT * FROM oryon_trace.configuracoes_instancias WHERE id_instancia = $1`,
            [id_instancia]
        );

        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Erro ao buscar configurações:', err);
        res.status(500).json({ error: 'Erro ao buscar configurações.' });
    }
});


app.post('/reconnect-instancia', async (req, res) => {
    const { telefone } = req.body;

    if (!telefone) {
        return res.status(400).json({ error: 'O telefone é obrigatório para reconectar.' });
    }

    const authDir = `./auth_info/${telefone}`;

    try {
        // Remover a autenticação antiga
        if (fs.existsSync(authDir)) {
            fs.rmSync(authDir, { recursive: true, force: true });
            console.log(`Autenticação antiga removida para ${telefone}`);
        }

        // Configuração de autenticação e inicialização do Baileys
        const { state, saveCreds } = await useMultiFileAuthState(authDir);
        const version = [2, 3000, 1017531287]; // Versão estável do WhatsApp Web

        console.log(`Usando a versão específica do WhatsApp Web: ${version}`);

        const socket = makeWASocket({
            auth: state,
            version,
            browser: ['OryonTrace', 'Chrome', '10.0.0'],
        });

        // Salvar as credenciais
        socket.ev.on('creds.update', saveCreds);

        let qrBase64 = null;

        socket.ev.on('connection.update', async (update) => {
            const { connection, qr, lastDisconnect } = update;

            // QR Code gerado
            if (qr) {
                console.log(`QR Code gerado para reconexão de ${telefone}`);
                qrBase64 = await qrcode.toDataURL(qr);

                // Atualiza o status no banco para "Aguardando Conexão"
                await pool.query(
                    `UPDATE oryon_trace.instancias SET status = $1, dt_atualizacao = NOW() WHERE telefone = $2`,
                    ['Aguardando Conexão', telefone]
                );
            }

            // Conexão estabelecida
            if (connection === 'open') {
                console.log(`Reconexão estabelecida com ${telefone}`);
                await pool.query(
                    `UPDATE oryon_trace.instancias SET status = $1, auth_info = $2, dt_atualizacao = NOW() WHERE telefone = $3`,
                    ['Conectado', JSON.stringify(state), telefone]
                );
            }

            // Conexão encerrada
            if (connection === 'close') {
                const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
                console.error(`Conexão encerrada para ${telefone}. Razão: ${reason}`);

                await pool.query(
                    `UPDATE oryon_trace.instancias SET status = $1, dt_atualizacao = NOW() WHERE telefone = $2`,
                    ['Desconectado', telefone]
                );

                // Reconexão automática em caso de erro 515
                if (reason === 515) {
                    console.log('Erro 515 detectado. Tentando reconectar automaticamente...');
                    setTimeout(async () => {
                        try {
                            console.log(`Tentando reconexão automática para ${telefone}...`);

                            // Limpeza e criação de novo socket
                            if (fs.existsSync(authDir)) {
                                fs.rmSync(authDir, { recursive: true, force: true });
                                console.log(`Autenticação limpa novamente para ${telefone}`);
                            }

                            const { state, saveCreds } = await useMultiFileAuthState(authDir);
                            const socket = makeWASocket({
                                auth: state,
                                version: [2, 3000, 1017531287],
                                browser: ['OryonTrace', 'Chrome', '10.0.0'],
                            });

                            socket.ev.on('creds.update', saveCreds);

                            socket.ev.on('connection.update', async (update) => {
                                const { connection } = update;

                                if (connection === 'open') {
                                    console.log(`Reconexão automática bem-sucedida para ${telefone}`);
                                    await pool.query(
                                        `UPDATE oryon_trace.instancias SET status = $1, auth_info = $2, dt_atualizacao = NOW() WHERE telefone = $3`,
                                        ['Conectado', JSON.stringify(state), telefone]
                                    );
                                }
                            });
                        } catch (error) {
                            console.error('Erro ao reconectar automaticamente:', error);
                        }
                    }, 5000);
                }
            }
        });

        // Aguardar o QR Code
        while (!qrBase64) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }

        res.status(200).json({ qr: qrBase64 });
    } catch (err) {
        console.error(`Erro ao reconectar a instância ${telefone}:`, err);
        res.status(500).json({ error: 'Erro ao reconectar a instância.' });
    }
});

// Criar uma nova configuração para uma instância
app.post('/configuracoes', async (req, res) => {
    const { id_instancia, eventos, meta, mensagens } = req.body;

    if (!id_instancia || !eventos) {
        return res.status(400).json({ error: 'Campos obrigatórios: id_instancia e eventos.' });
    }

    try {
        // Loop para salvar Webhooks
        for (const [evento, webhook] of Object.entries(eventos)) {
            await pool.query(
                `INSERT INTO oryon_trace.configuracoes_instancias (id_instancia, tipo, evento, webhook, dt_criacao, dt_atualizacao)
                 VALUES ($1, 'webhook', $2, $3, NOW(), NOW())
                 ON CONFLICT (id_instancia, evento)
                 DO UPDATE SET webhook = $3, dt_atualizacao = NOW()`,
                [id_instancia, evento, webhook || null]
            );
        }

        // Salvar Configurações de Mensagens
        for (const [evento, mensagem] of Object.entries(mensagens || {})) {
            await pool.query(
                `INSERT INTO oryon_trace.configuracoes_instancias (id_instancia, tipo, evento, webhook, dt_criacao, dt_atualizacao)
                 VALUES ($1, 'Config Mensagens', $2, $3, NOW(), NOW())
                 ON CONFLICT (id_instancia, evento)
                 DO UPDATE SET webhook = $3, dt_atualizacao = NOW()`,
                [id_instancia, evento, mensagem || null]
            );
        }

        // Salvar Configurações Meta
        for (const [evento, valor] of Object.entries(meta || {})) {
            await pool.query(
                `INSERT INTO oryon_trace.configuracoes_instancias (id_instancia, tipo, evento, webhook, dt_criacao, dt_atualizacao)
                 VALUES ($1, 'Meta', $2, $3, NOW(), NOW())
                 ON CONFLICT (id_instancia, evento)
                 DO UPDATE SET webhook = $3, dt_atualizacao = NOW()`,
                [id_instancia, evento, valor || null]
            );
        }

        res.status(201).json({ message: 'Configurações salvas ou atualizadas com sucesso.' });
    } catch (err) {
        console.error('Erro ao salvar configurações:', err);
        res.status(500).json({ error: 'Erro ao salvar configurações.' });
    }
});

// Atualizar uma configuração
app.put('/configuracoes/:id', async (req, res) => {
    const { id } = req.params;
    const { webhook, pixel_id, api_conversion_token } = req.body;

    try {
        const result = await pool.query(
            `UPDATE oryon_trace.configuracoes_instancias
             SET webhook = $1, pixel_id = $2, api_conversion_token = $3, dt_atualizacao = NOW()
             WHERE id = $4 RETURNING *`,
            [webhook, pixel_id, api_conversion_token, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Configuração não encontrada.' });
        }

        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error('Erro ao atualizar configuração:', err);
        res.status(500).json({ error: 'Erro ao atualizar configuração.' });
    }
});

// Excluir uma configuração
app.delete('/configuracoes/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            `DELETE FROM oryon_trace.configuracoes_instancias WHERE id = $1 RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Configuração não encontrada.' });
        }

        res.status(200).json({ message: 'Configuração excluída com sucesso.' });
    } catch (err) {
        console.error('Erro ao excluir configuração:', err);
        res.status(500).json({ error: 'Erro ao excluir configuração.' });
    }
});


app.post('/instancias/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            'SELECT id, nome FROM oryon_trace.instancias WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Instância não encontrada.' });
        }

        res.status(200).json(result.rows[0]); // Retorna o ID e o nome da instância
    } catch (error) {
        console.error('Erro ao buscar instância:', error);
        res.status(500).json({ error: 'Erro ao buscar instância.' });
    }
});

// Endpoint para listar todos os eventos de uma instância
app.get('/eventos/:id_instancia', async (req, res) => {
    const { id_instancia } = req.params;

    try {
        const result = await pool.query(
            `SELECT id, evento, webhook, pixel_id, api_conversion_token, dt_criacao, dt_atualizacao
             FROM oryon_trace.configuracoes_instancias
             WHERE id_instancia = $1`,
            [id_instancia]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Nenhum evento encontrado para esta instância.' });
        }

        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Erro ao buscar eventos:', err);
        res.status(500).json({ error: 'Erro ao buscar eventos.' });
    }
});
    // Endpoint para buscar os detalhes de um evento
    app.get('/eventos/detalhes/:id_evento', async (req, res) => {
        const { id_evento } = req.params;
    
        try {
            const result = await pool.query(
                `SELECT id, evento, webhook, pixel_id, api_conversion_token, dt_criacao, dt_atualizacao
                 FROM oryon_trace.configuracoes_instancias
                 WHERE id = $1`,
                [id_evento]
            );
    
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Evento não encontrado.' });
            }
    
            res.status(200).json(result.rows[0]); // Retorna apenas o evento encontrado
        } catch (err) {
            console.error('Erro ao buscar detalhes do evento:', err);
            res.status(500).json({ error: 'Erro ao buscar detalhes do evento.' });
        }
    });
    

    app.post('/webhook/evento', async (req, res) => {
        const { id_instancia, tipo, nome, payload } = req.body;
    
        if (!id_instancia || !tipo || !nome || !payload) {
            return res.status(400).json({ error: 'Campos obrigatórios: id_instancia, tipo, nome, payload.' });
        }
    
        try {
            await pool.query(
                `INSERT INTO oryon_trace.eventos (id_instancia, tipo, nome, payload, dt_criacao)
                 VALUES ($1, $2, $3, $4, NOW())`,
                [id_instancia, tipo, nome, JSON.stringify(payload)]
            );
    
            res.status(201).json({ message: 'Evento salvo com sucesso.' });
        } catch (err) {
            console.error('Erro ao salvar evento:', err);
            res.status(500).json({ error: 'Erro ao salvar evento.' });
        }
    });


    app.get('/eventos', async (req, res) => {
        const { instancias, tipos, periodo_inicio, periodo_fim } = req.query;
    
        try {
            let baseQuery = `
                SELECT e.id, i.nome AS instancia, e.nome AS evento, e.status_webhook, e.dt_criacao
                FROM oryon_trace.eventos e
                JOIN oryon_trace.instancias i ON e.id_instancia = i.id
            `;
            const filters = [];
            const values = [];
    
            if (instancias) {
                const instanciasArray = instancias.split(',');
                filters.push(`e.id_instancia = ANY($${filters.length + 1})`);
                values.push(instanciasArray);
            }
    
            if (tipos) {
                const tiposArray = tipos.split(',');
                filters.push(`e.tipo = ANY($${filters.length + 1})`);
                values.push(tiposArray);
            }
    
            if (periodo_inicio) {
                filters.push(`e.dt_criacao >= $${filters.length + 1}`);
                values.push(periodo_inicio);
            }
    
            if (periodo_fim) {
                filters.push(`e.dt_criacao <= $${filters.length + 1}`);
                values.push(periodo_fim);
            }
    
            if (filters.length > 0) {
                baseQuery += ` WHERE ${filters.join(' AND ')}`;
            }
    
            baseQuery += ' ORDER BY e.dt_criacao DESC';
    
            const result = await pool.query(baseQuery, values);
            res.status(200).json(result.rows);
        } catch (err) {
            console.error('Erro ao buscar eventos:', err);
            res.status(500).json({ error: 'Erro ao buscar eventos.' });
        }
    });
    function extractUTMs(link) {
        try {
            const urlParams = new URLSearchParams(link);
            const dataParam = urlParams.get('data');
            if (!dataParam) return null;
    
            return JSON.parse(decodeURIComponent(dataParam));
        } catch (error) {
            console.error('Erro ao extrair UTMs:', error);
            return null;
        }
    }
    
    async function configurarConexao(socket, telefone, idInstancia, nomeInstancia) {
        socket.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
    
            if (qr) {
                console.log(`QR Code gerado para ${telefone}`);
            }
    
            if (connection === 'open') {
                console.log(`Instância ${telefone} conectada com sucesso.`);
    
                // Atualizar status no banco de dados
                await pool.query(
                    `UPDATE oryon_trace.instancias SET status = $1, dt_atualizacao = NOW() WHERE telefone = $2`,
                    ['Conectado', telefone]
                );
    
                // Disparar evento para webhook
                const payload = {
                    evento: 'instancia_conectada',
                    instancia: nomeInstancia,
                    telefone,
                    timestamp: new Date().toISOString(),
                };
    
                console.log(`Evento Capturado: instancia_conectada`);
                console.log('Detalhes do Evento:', JSON.stringify(payload, null, 2));
    
                await enviarEventoParaWebhook(idInstancia, 'instancia_conectada', payload);
            }
    
            if (connection === 'close') {
                console.error(`Instância ${telefone} desconectada.`);
    
                // Atualizar status no banco de dados
                await pool.query(
                    `UPDATE oryon_trace.instancias SET status = $1, dt_atualizacao = NOW() WHERE telefone = $2`,
                    ['Desconectado', telefone]
                );
    
                // Disparar evento para webhook
                const motivo = new Boom(lastDisconnect?.error)?.output?.statusCode || 'Desconhecido';
                const payload = {
                    evento: 'instancia_desconectada',
                    instancia: nomeInstancia,
                    telefone,
                    motivo,
                    timestamp: new Date().toISOString(),
                };
    
                console.log(`Evento Capturado: instancia_desconectada`);
                console.log('Detalhes do Evento:', JSON.stringify(payload, null, 2));
    
                await enviarEventoParaWebhook(idInstancia, 'instancia_desconectada', payload);
            }
        });
    }
    

    async function configurarEventos(socket, telefone) {
        socket.ev.on('messages.upsert', async (messageEvent) => {
            const { messages, type } = messageEvent;
            if (type !== 'notify') return; // Ignora mensagens que não sejam notificações
    
            for (const message of messages) {
                try {
                    const isGroup = message.key.remoteJid.endsWith('@g.us');
                    const messageId = message.key.id;
                    const messageContent = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
                    const sender = message.key.participant || message.key.remoteJid;
                    const name = message.pushName || 'Desconhecido';
                    const createdAt = new Date();
    
                    // Obter nome do grupo (se for mensagem de grupo)
                    let groupName = null;
                    if (isGroup) {
                        const groupMetadata = await socket.groupMetadata(message.key.remoteJid);
                        groupName = groupMetadata.subject || 'Desconhecido';
                    }
    
                    // Extrair UTMs, se houver
                    let utmData = null;
                    if (messageContent.includes('https://api.whatsapp.com/send')) {
                        utmData = extractUTMs(messageContent);
                    }
    
                    // Verificar se o contato já existe no banco de dados
                    const contatoQuery = 'SELECT * FROM oryon_trace.contatos WHERE telefone = $1';
                    const contato = await pool.query(contatoQuery, [sender]);
                    if (contato.rows.length === 0) {
                        await pool.query(
                            `INSERT INTO oryon_trace.contatos (nome, telefone, utm_source, utm_campaign, utm_medium, utm_term, utm_content, dt_criacao, dt_atualizacao)
                             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
                            [
                                name,
                                sender,
                                utmData?.utm_source || null,
                                utmData?.utm_campaign || null,
                                utmData?.utm_medium || null,
                                utmData?.utm_term || null,
                                utmData?.utm_content || null,
                            ]
                        );
                    }
    
                    // Formatar JSON do evento
                    const eventData = {
                        evento: isGroup ? 'mensagem_recebida_grupo' : 'mensagem_recebida',
                        instancia: telefone,
                        contato: {
                            nome: name,
                            telefone: sender,
                            grupo: isGroup
                                ? {
                                      nome: groupName,
                                      id: message.key.remoteJid,
                                  }
                                : null,
                        },
                        mensagem: {
                            id: messageId,
                            conteudo: messageContent,
                        },
                        utms: utmData || {},
                        timestamp: createdAt.toISOString(),
                    };
    
                    console.log(`Evento Capturado: ${eventData.evento}`);
                    console.log('Detalhes do Evento:', JSON.stringify(eventData, null, 2));
    
                    // Enviar para webhook configurado
                    const evento = isGroup ? 'mensagem_recebida_grupo' : 'mensagem_recebida';
                    const webhookQuery = `
                        SELECT webhook FROM oryon_trace.configuracoes_instancias
                        WHERE evento = $1
                        AND id_instancia = (SELECT id FROM oryon_trace.instancias WHERE telefone = $2)
                    `;
                    const webhook = await pool.query(webhookQuery, [evento, telefone]);
                    if (webhook.rows.length > 0) {
                        await fetch(webhook.rows[0].webhook, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(eventData),
                        });
                        console.log('Evento enviado para webhook:', webhook.rows[0].webhook);
                    }
                } catch (err) {
                    console.error('Erro ao processar mensagem:', err);
                }
            }
        });
    }
    

// Inicia o Servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    reconectarInstancias();
});
