// --- 1. CONFIGURAÇÃO DAS BASES DE DADOS ---
const BASE_URLS = {
    juridico: './dadosJuridicos.json', // ESTUDO GERAL
    diario: 'base/dados.json'        // ESTUDO DO DIA
};
const DB_STORAGE_KEY = 'current_db_key'; // Chave para salvar a base de dados ativa

// Determina qual URL está ativa, buscando no localStorage ou usando a padrão.
let currentBaseKey = localStorage.getItem(DB_STORAGE_KEY) || 'juridico'; 
let currentBaseUrl = BASE_URLS[currentBaseKey];

// --- Variáveis de Estado ---
const STORAGE_KEY = 'studyApp_data';
const MAX_ITENS = 51; // Limite de itens a serem exibidos por sessão
let editingIndex = -1; // Rastreia o índice do item em edição
let studyData = []; // Inicializado vazio, será preenchido pelo localStorage ou JSON.

// --- CONTROLE PARA O FLASH WRITE ---
const FLASH_WRITE_TIME_SECONDS = 60;
let flashWriteTimer;
let currentFlashWriteQuestionIndex = 0;
let currentFlashWriteData = []; // Armazena os 25 itens da sessão atual
// ------------------------------------


// --- PERSISTÊNCIA E INICIALIZAÇÃO ---

function loadStudyData() {
    // A chave do storage agora inclui a base de dados para garantir que dados de 'juridico'
    // não se misturem com os dados de 'diario'.
    const key = `${STORAGE_KEY}_${currentBaseKey}`; 
    const savedData = localStorage.getItem(key);
    // Tenta carregar dados salvos. Se não houver, retorna array vazio.
    return savedData ? JSON.parse(savedData) : [];
}

function saveStudyData() {
    const key = `${STORAGE_KEY}_${currentBaseKey}`;
    localStorage.setItem(key, JSON.stringify(studyData));
}

/**
 * Tenta carregar dados salvos no LocalStorage para a base ativa.
 * Se vazio, faz um FETCH para carregar o JSON externo da base ativa.
 */
async function loadInitialDataAndApplyURL() {
    // 1. Tenta carregar dados salvos PARA A BASE ATUAL.
    studyData = loadStudyData();

    if (studyData.length === 0) {
        console.log(`LocalStorage vazio para '${currentBaseKey}'. Tentando carregar dados do JSON em ${currentBaseUrl}...`);
        try {
            // 2. Faz a requisição assíncrona ao JSON externo da URL ATIVA
            const response = await fetch(currentBaseUrl);
            
            if (!response.ok) {
                throw new Error(`Erro de rede ou arquivo JSON não encontrado: ${response.status}`);
            }

            const externalData = await response.json();
            
            // 3. Usa o JSON como base e salva no LocalStorage (na chave específica da base)
            studyData = externalData;
            saveStudyData(); 
            console.log(`Dados carregados do JSON (${currentBaseKey}) com sucesso. Total de ${studyData.length} itens.`);

        } catch (error) {
            console.error("ERRO: Não foi possível carregar o JSON externo. Motivo:", error);
            // Define studyData como vazio se o carregamento falhar
            studyData = [];
        }
    }
} 

/**
 * Alterna entre as bases de dados e recarrega todo o aplicativo.
 */
async function switchDatabase() {
    // 1. Determina a nova chave
    const newBaseKey = currentBaseKey === 'juridico' ? 'diario' : 'juridico';
    
    // 2. Atualiza variáveis de estado
    currentBaseKey = newBaseKey;
    currentBaseUrl = BASE_URLS[newBaseKey];
    localStorage.setItem(DB_STORAGE_KEY, newBaseKey); // Persiste a escolha

    // 3. Recarrega os dados (busca no localStorage da nova base ou faz fetch do novo JSON)
    await loadInitialDataAndApplyURL();
    
    // 4. Limpa e reinicializa a UI
    const dbSwitchButton = document.getElementById('db-switch-btn');
    if (dbSwitchButton) {
        dbSwitchButton.textContent = `Mudar para: ${currentBaseKey === 'juridico' ? 'ESTUDO DA SEMANA' : 'ESTUDO GERAL'}`;
    }
    
    // Reinicializa todas as abas e exibe a principal
    showTab('flashcards');
    renderFlashCards();
    renderSimulado();
    renderVfSimulado();
    renderFlashWrite(); 
    
    // NOTA: 'alert' será substituído por um modal/mensagem na próxima iteração
    alert(`Base de dados alterada para: ${newBaseKey.toUpperCase()}!`);
}


// --- FUNÇÕES DE CONTROLE DE EXIBIÇÃO ---

/**
 * Seleciona e embaralha os dados, limitando ao número máximo (MAX_ITENS).
 * Garante que a seleção é diferente a cada chamada (a cada recarga/alternância de aba).
 * @returns {Array} Array de dados limitado e aleatório.
 */
function getShuffledAndLimitedData() {
    const dataCopy = [...studyData];
    // Embaralha
    const shuffled = dataCopy.sort(() => 0.5 - Math.random());
    // Limita
    return shuffled.slice(0, MAX_ITENS);
}


function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.querySelectorAll('.tab-button').forEach(button => button.classList.remove('active'));

    const tabContent = document.getElementById(tabId);
    if (tabContent) tabContent.classList.add('active');

    const tabButton = document.querySelector(`.tab-button[onclick="showTab('${tabId}')"]`);
    if (tabButton) tabButton.classList.add('active');
    
    // Força a renderização aleatória e limitada ao trocar de aba
    if (tabId === 'flashcards') renderFlashCards();
    if (tabId === 'simulado') renderSimulado();
    if (tabId === 'verdadeiro-falso') renderVfSimulado();
    if (tabId === 'flash-write') renderFlashWrite();
}

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Renderiza o botão de troca de DB antes de carregar dados
    const tabContainer = document.querySelector('.tab-container');
    
    const switchButton = document.createElement('button');
    switchButton.id = 'db-switch-btn';
    switchButton.className = 'db-switch-btn';
    switchButton.textContent = `Mudar para: ${currentBaseKey === 'juridico' ? 'ESTUDO DA SEMANA' : 'ESTUDO GERAL'}`;
    switchButton.onclick = switchDatabase;
    
    // Adiciona o botão ao lado das abas (ajuste o seletor conforme seu HTML)
    if (tabContainer) {
        tabContainer.parentNode.insertBefore(switchButton, tabContainer.nextSibling);
    } else {
        // Fallback se .tab-container não for encontrado
        document.body.prepend(switchButton); 
    }


    // 2. ESPERA os dados serem carregados (do LocalStorage ou do JSON)
    await loadInitialDataAndApplyURL(); 
    
    // 3. Continua a inicialização
    if (studyData.length === 0) {
        const container = document.querySelector('.container');
        if (container) {
            container.innerHTML = `<h1>Erro de Carregamento</h1><p>Não foi possível carregar os dados da base **${currentBaseKey.toUpperCase()}**. Verifique se o arquivo em <code>${currentBaseUrl}</code> existe.</p>`;
        }
        return;
    }

    // Inicializa a UI apenas após os dados estarem disponíveis
    showTab('flashcards');
    renderFlashCards();
    renderSimulado();
    renderVfSimulado();
    renderFlashWrite(); 
});


// 1. Adicionar Dados e Atualizar Views
const studyForm = document.getElementById('study-form');
if (studyForm) {
    studyForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const pergunta = document.getElementById('pergunta').value.trim();
        const resposta = document.getElementById('resposta').value.trim();

        if (pergunta && resposta) {
            studyData.push({ pergunta, resposta });

            saveStudyData(); 

            this.reset();
            // NOTA: 'alert' será substituído por um modal/mensagem na próxima iteração
            alert('Item adicionado com sucesso!'); 
            
            // Renderiza apenas os cards da aba ativa, chamando showTab
            const activeTabElement = document.querySelector('.tab-content.active');
            if (activeTabElement) {
                showTab(activeTabElement.id);
            }
        } else {
            // NOTA: 'alert' será substituído por um modal/mensagem na próxima iteração
            alert('Por favor, preencha a pergunta e a resposta.');
        }
    });
}


// --- FUNÇÕES DE EDIÇÃO E EXCLUSÃO (Operam no array original) ---

function deleteFlashCard(originalIndex) {
    // NOTA: 'confirm' será substituído por um modal/mensagem na próxima iteração
    if (confirm(`Tem certeza que deseja excluir o item "${studyData[originalIndex].pergunta}"?`)) { 
        studyData.splice(originalIndex, 1);
        saveStudyData();
        // Renderiza todas as abas, pois o conjunto de dados mudou
        showTab('flashcards'); // Retorna para a aba principal após a exclusão
    }
}

function startEdit(originalIndex) {
    if (editingIndex !== -1 && editingIndex !== originalIndex) {
        renderFlashCards();
    }
    editingIndex = originalIndex;
    renderFlashCards(); 
}

function saveEdit(originalIndex) {
    const newPergunta = document.getElementById(`edit-pergunta-${originalIndex}`).value.trim();
    const newResposta = document.getElementById(`edit-resposta-${originalIndex}`).value.trim();

    if (newPergunta && newResposta) {
        studyData[originalIndex].pergunta = newPergunta;
        studyData[originalIndex].resposta = newResposta;
        
        editingIndex = -1;
        saveStudyData();
        // Renderiza a aba atual
        const activeTabElement = document.querySelector('.tab-content.active');
        if (activeTabElement) {
            showTab(activeTabElement.id);
        }
        // NOTA: 'alert' será substituído por um modal/mensagem na próxima iteração
        alert('Item atualizado com sucesso!'); 
    } else {
        // NOTA: 'alert' será substituído por um modal/mensagem na próxima iteração
        alert('Pergunta e Resposta não podem estar vazias.');
    }
}

function cancelEdit() {
    editingIndex = -1;
    renderFlashCards();
}

// 2. Renderizar Flash Cards (Usa dados limitados e aleatórios)
function renderFlashCards() {
    const container = document.getElementById('flashcard-container');
    if (!container) return;
    
    container.innerHTML = ''; 

    if (studyData.length === 0) {
        container.innerHTML = '<p>Nenhum dado disponível. Adicione um item na aba "Adicionar" ou verifique se o JSON foi carregado.</p>';
        return;
    }

    const limitedData = getShuffledAndLimitedData(); 

    limitedData.forEach((item) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'flashcard-wrapper';
        
        // Mapeia o item aleatório de volta para o índice original para ações de CRUD
        const originalIndex = studyData.findIndex(d => d.pergunta === item.pergunta && d.resposta === item.resposta);


        if (originalIndex === editingIndex) {
            // Renderiza o formulário de edição
            wrapper.innerHTML = `
                <div class="edit-form">
                    <h4>Editando Item ${originalIndex + 1}</h4>
                    <label>Frente:</label>
                    <textarea id="edit-pergunta-${originalIndex}">${item.pergunta}</textarea>
                    
                    <label>Verso:</label>
                    <textarea id="edit-resposta-${originalIndex}">${item.resposta}</textarea>
                    
                    <div class="card-controls">
                        <button type="button" class="control-btn save" onclick="saveEdit(${originalIndex})">Salvar</button>
                        <button type="button" class="control-btn cancel" onclick="cancelEdit()">Cancelar</button>
                    </div>
                </div>
            `;
        } else {
            // Renderiza o Flash Card normal
            wrapper.innerHTML = `
                <div class="flashcard" onclick="this.classList.toggle('flipped')">
                    <div class="card-inner">
                        <div class="card-front">
                            <p><strong>${item.pergunta}</strong></p>
                        </div>
                        <div class="card-back">
                            <p>${item.resposta}</p>
                        </div>
                    </div>
                </div>
                <div class="card-controls">
                    <button type="button" class="control-btn edit" onclick="startEdit(${originalIndex})">Editar</button>
                    <button type="button" class="control-btn delete" onclick="deleteFlashCard(${originalIndex})">Excluir</button>
                </div>
            `;
        }
        
        container.appendChild(wrapper);
    });
}


// 3. Renderizar Simulado (Múltipla Escolha)
function renderSimulado() {
    const form = document.getElementById('simulado-form');
    if (!form) return;
    
    let resultParagraph = document.getElementById('simulado-result');
    if (!resultParagraph) {
        resultParagraph = document.createElement('p');
        resultParagraph.id = 'simulado-result';
    }
    
    let checkButton = form.querySelector('button[onclick="checkSimulado()"]');
    form.innerHTML = ''; 
    form.appendChild(resultParagraph); 

    if (studyData.length < 4) {
        form.innerHTML = '<p>São necessários no mínimo 4 itens para gerar um simulado de múltipla escolha.</p>';
        return;
    }
    
    const limitedData = getShuffledAndLimitedData(); 
    const distractorData = [...studyData].sort(() => 0.5 - Math.random()); // Usa todos os dados para distratores

    limitedData.forEach((item, index) => {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'simulado-question-wrapper';
        questionDiv.dataset.correctAnswer = item.resposta; // Guarda a resposta certa

        questionDiv.innerHTML = `<h4>${index + 1}. ${item.pergunta}</h4>`;

        const correctAnswer = item.resposta;
        const options = new Set([correctAnswer]); 
        
        // Coleta distratores únicos
        for (const distractorItem of distractorData) {
            if (options.size === 4) break; 
            if (distractorItem.resposta !== correctAnswer) {
                options.add(distractorItem.resposta);
            }
        }
        
        const optionArray = Array.from(options).sort(() => 0.5 - Math.random());

        optionArray.forEach((option, optIndex) => {
            const radioId = `q${index}-opt${optIndex}`;
            questionDiv.innerHTML += `
                <input type="radio" id="${radioId}" name="question-${index}" value="${option}" required>
                <label for="${radioId}">${option}</label><br>
            `;
        });
        
        form.appendChild(questionDiv);
    });
    
    if (!checkButton) {
        checkButton = document.createElement('button');
        checkButton.type = 'button';
        checkButton.onclick = checkSimulado;
        checkButton.textContent = 'Verificar Respostas';
    }
    form.appendChild(checkButton);
}

// 4. Lógica de Verificação do Simulado (Múltipla Escolha)
function checkSimulado() {
    let correctCount = 0;
    const form = document.getElementById('simulado-form');
    if (!form) return;
    
    const resultParagraph = document.getElementById('simulado-result');

    const questionDivs = form.querySelectorAll('.simulado-question-wrapper');
    const totalQuestions = questionDivs.length;

    if (totalQuestions === 0) return;

    questionDivs.forEach((questionDiv, index) => {
        const selectedRadio = form.querySelector(`input[name="question-${index}"]:checked`);
        const correctAnswer = questionDiv.dataset.correctAnswer;
        
        questionDiv.style.backgroundColor = 'transparent';
        
        if (selectedRadio) {
            const userAnswer = selectedRadio.value;
            
            if (userAnswer === correctAnswer) {
                correctCount++;
                questionDiv.style.backgroundColor = '#DFF2BF';
            } else {
                questionDiv.style.backgroundColor = '#FFCCCC';
            }
        } else {
            questionDiv.style.backgroundColor = '#FFFACD'; // Amarelo: Não respondido
        }
    });

    const percentage = ((correctCount / totalQuestions) * 100).toFixed(2);
    if (resultParagraph) {
        resultParagraph.innerHTML = `✅ **Resultado (Múltipla Escolha):** Você acertou **${correctCount}** de **${totalQuestions}** questões (${percentage}%).`;
        resultParagraph.style.marginTop = '20px';
    }
}


// 5. Renderizar Simulado (Verdadeiro ou Falso)
function renderVfSimulado() {
    const form = document.getElementById('vf-simulado-form');
    if (!form) return;
    
    let resultParagraph = document.getElementById('vf-simulado-result');
    if (!resultParagraph) {
        resultParagraph = document.createElement('p');
        resultParagraph.id = 'vf-simulado-result';
    }
    
    let checkButton = form.querySelector('button[onclick="checkVfSimulado()"]');
    form.innerHTML = ''; 
    form.appendChild(resultParagraph); 

    if (studyData.length === 0) {
        form.innerHTML = '<p>Adicione itens para gerar o simulado de Verdadeiro ou Falso.</p>';
        return;
    }
    
    const limitedData = getShuffledAndLimitedData();

    limitedData.forEach((item, index) => {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'vf-question-wrapper';
        
        const isTrueStatement = Math.random() < 0.5; // 50% de chance de ser verdadeiro
        let statement = "";
        let expectedAnswer = "";
        
        if (isTrueStatement) {
            statement = item.resposta; // A afirmação é a resposta correta
            expectedAnswer = "Verdadeiro";
        } else {
            // Cria uma afirmação falsa (usando a resposta de outro item)
            let wrongAnswer = item.resposta;
            const wrongItems = studyData.filter(d => d.resposta !== item.resposta);
            
            if (wrongItems.length > 0) {
                wrongAnswer = wrongItems[Math.floor(Math.random() * wrongItems.length)].resposta;
            }
            
            statement = wrongAnswer;
            expectedAnswer = "Falso";
        }
        
        questionDiv.innerHTML = `<h4>${index + 1}. Pergunta: "${item.pergunta}"</h4><p>Afirmação: **${statement}**</p>`;
        
        questionDiv.dataset.correctAnswer = expectedAnswer; 

        questionDiv.innerHTML += `
            <input type="radio" id="vf-q${index}-v" name="vf-question-${index}" value="Verdadeiro" required>
            <label for="vf-q${index}-v">Verdadeiro</label><br>
            <input type="radio" id="vf-q${index}-f" name="vf-question-${index}" value="Falso">
            <label for="vf-q${index}-f">Falso</label><br>
        `;
        
        form.appendChild(questionDiv);
    });
    
    if (!checkButton) {
        checkButton = document.createElement('button');
        checkButton.type = 'button';
        checkButton.onclick = checkVfSimulado;
        checkButton.textContent = 'Verificar Respostas';
    }
    form.appendChild(checkButton);
}

// 6. Lógica de Verificação do Simulado (Verdadeiro ou Falso)
function checkVfSimulado() {
    let correctCount = 0;
    const form = document.getElementById('vf-simulado-form');
    if (!form) return;
    
    const resultParagraph = document.getElementById('vf-simulado-result');
    
    const questionDivs = form.querySelectorAll('.vf-question-wrapper');
    const totalQuestions = questionDivs.length;

    if (totalQuestions === 0) return;

    questionDivs.forEach((questionDiv, index) => {
        const selectedRadio = form.querySelector(`input[name="vf-question-${index}"]:checked`);
        const expectedAnswer = questionDiv.dataset.correctAnswer;
        
        questionDiv.style.backgroundColor = 'transparent';
        
        if (selectedRadio) {
            const userAnswer = selectedRadio.value;
            if (userAnswer === expectedAnswer) {
                correctCount++;
                questionDiv.style.backgroundColor = '#DFF2BF';
            } else {
                questionDiv.style.backgroundColor = '#FFCCCC';
            }
        } else {
            questionDiv.style.backgroundColor = '#FFFACD'; 
        }
    });

    const percentage = ((correctCount / totalQuestions) * 100).toFixed(2);
    if (resultParagraph) {
        resultParagraph.innerHTML = `✅ **Resultado (V/F):** Você acertou **${correctCount}** de **${totalQuestions}** afirmações (${percentage}%).`;
        resultParagraph.style.marginTop = '20px';
    }
}


// --- 7 & 8: FUNÇÕES DO DESAFIO DE ESCRITA RÁPIDA (FLASH WRITE) ---

// 7. Renderizar Desafio de Escrita Rápida (Flash Write)
function renderFlashWrite() {
    clearTimeout(flashWriteTimer);
    const form = document.getElementById('flash-write-form');
    if (!form) return;

    let timerDisplay = document.getElementById('timer-display');
    let resultParagraph = document.getElementById('flash-write-result');
    
    // Limpa o formulário e configura elementos de controle
    form.innerHTML = ''; 
    
    if (!timerDisplay) {
        timerDisplay = document.createElement('div');
        timerDisplay.id = 'timer-display';
    } 
    form.appendChild(timerDisplay);

    if (!resultParagraph) {
        resultParagraph = document.createElement('p');
        resultParagraph.id = 'flash-write-result';
    }
    form.appendChild(resultParagraph);


    if (studyData.length === 0) {
        form.innerHTML = '<p>Adicione itens para iniciar o Desafio de Escrita Rápida.</p>';
        return;
    }
    
    // Zera o índice e pega os 25 itens da sessão
    currentFlashWriteQuestionIndex = 0;
    currentFlashWriteData = getShuffledAndLimitedData();
    
    if (currentFlashWriteData.length > 0) {
        displayFlashWriteQuestion(form);
    } else {
        form.innerHTML = '<p>Não há itens suficientes para o desafio.</p>';
    }
}

// Função para exibir a pergunta atual do Flash Write
function displayFlashWriteQuestion(form) {
    clearTimeout(flashWriteTimer);
    const resultParagraph = document.getElementById('flash-write-result');
    const timerDisplay = document.getElementById('timer-display');
    
    // CORREÇÃO: Busca o botão pelo ID para evitar duplicação (o ID será adicionado abaixo)
    let checkButton = document.getElementById('flash-write-check-button'); 

    if (resultParagraph) resultParagraph.innerHTML = ''; // Limpa resultados anteriores

    if (currentFlashWriteQuestionIndex >= currentFlashWriteData.length) {
        form.innerHTML = '<p style="font-size: 1.2em; color: #4169E1;">Fim do Desafio! Recarregue a página ou troque de aba para um novo conjunto.</p>';
        return;
    }

    const item = currentFlashWriteData[currentFlashWriteQuestionIndex];

    const questionDiv = document.createElement('div');
    questionDiv.innerHTML = `<h4>${currentFlashWriteQuestionIndex + 1}. ${item.pergunta}</h4>`;
    questionDiv.className = 'flash-write-question';
    
    questionDiv.innerHTML += `
        <textarea id="flash-write-input" name="flash-write-response" placeholder="Sua resposta rápida aqui..."></textarea>
        <div id="flash-write-answer" style="margin-top: 15px; padding: 10px; border: 1px dashed #B0E0E6; background: #fffaf0; display: none;">
            <p style="font-weight: bold; color: #4682B4;">Resposta Correta:</p>
            <p>${item.resposta}</p>
        </div>
    `;
    
    // Remove as perguntas anteriores antes de adicionar a nova
    form.querySelectorAll('.flash-write-question').forEach(q => q.remove());
    if (timerDisplay) {
        form.insertBefore(questionDiv, timerDisplay.nextSibling);
    } else {
        form.appendChild(questionDiv);
    }

    // Re-adiciona ou cria o botão de verificar
    if (!checkButton) {
        checkButton = document.createElement('button');
        checkButton.type = 'button';
        checkButton.onclick = checkFlashWrite;
        checkButton.textContent = 'Comparar e Avaliar';
        checkButton.id = 'flash-write-check-button'; // Adiciona ID ÚNICO
        form.appendChild(checkButton);
    } else {
        // Se o botão existir, apenas o move para o final e o reabilita
        form.appendChild(checkButton); 
        checkButton.textContent = 'Comparar e Avaliar';
        checkButton.disabled = false;
    }
    
    startFlashWriteTimer();
}

// Função de Controle do Cronômetro
function startFlashWriteTimer() {
    let timeLeft = FLASH_WRITE_TIME_SECONDS;
    const timerDisplay = document.getElementById('timer-display');
    const inputField = document.getElementById('flash-write-input');
    const checkButton = document.getElementById('flash-write-check-button');

    if (inputField) inputField.disabled = false;
    if (checkButton) checkButton.disabled = false;
    
    if (timerDisplay) timerDisplay.textContent = `Tempo restante: ${timeLeft} segundos`;

    flashWriteTimer = setInterval(() => {
        timeLeft--;
        if (timerDisplay) timerDisplay.textContent = `Tempo restante: ${timeLeft} segundos`;

        if (timeLeft <= 0) {
            clearInterval(flashWriteTimer);
            if (timerDisplay) timerDisplay.textContent = '⏰ Tempo Esgotado! Avalie sua resposta.';
            if (inputField) inputField.disabled = true;
            // Força a exibição da resposta
            const answerDiv = document.getElementById('flash-write-answer');
            if (answerDiv) answerDiv.style.display = 'block'; 
        }
    }, 1000);
}

// 8. Lógica de Verificação do Flash Write (Autoavaliação)
function checkFlashWrite() {
    clearTimeout(flashWriteTimer);
    const inputField = document.getElementById('flash-write-input');
    const answerDiv = document.getElementById('flash-write-answer');
    const resultParagraph = document.getElementById('flash-write-result');
    const checkButton = document.getElementById('flash-write-check-button');

    if (inputField) inputField.disabled = true;
    if (checkButton) checkButton.disabled = true;
    
    // 1. Revela a Resposta Correta
    if (answerDiv) answerDiv.style.display = 'block';

    // 2. Apresenta a Autoavaliação
    if (resultParagraph) {
        resultParagraph.innerHTML = `
            <div style="margin-top: 20px; padding: 15px; border: 2px solid #5F9EA0; border-radius: 8px; background: #E0FFFF;">
                <p style="font-weight: bold; color: #4682B4;">Como você avalia sua resposta?</p>
                <button type="button" class="control-btn save" style="margin-right: 10px;" onclick="nextFlashWriteQuestion('Fácil')">Fácil (Acertei)</button>
                <button type="button" class="control-btn edit" style="margin-right: 10px; background: #FFD700;" onclick="nextFlashWriteQuestion('Médio')">Médio (Houve Hesitação)</button>
                <button type="button" class="control-btn delete" onclick="nextFlashWriteQuestion('Difícil')">Difícil (Errei)</button>
            </div>
        `;
    }
}

// 9. Avançar para a próxima pergunta
function nextFlashWriteQuestion(rating) {
    // Nesta função, a lógica futura de Repetição Espaçada seria acionada.
    console.log(`Questão ${currentFlashWriteQuestionIndex + 1} avaliada como: ${rating}`);
    
    currentFlashWriteQuestionIndex++;
    
    const form = document.getElementById('flash-write-form');
    if (form) displayFlashWriteQuestion(form);
}