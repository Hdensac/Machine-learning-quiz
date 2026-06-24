/**
 * ML Quiz Lab - Application JS
 * Gère l'état de l'application, le chargement dynamique, le chronomètre,
 * les modes d'affichage et le système de remédiation.
 */

// Cartes de correspondance des thèmes
const THEMES_CONFIG = {
  dbscan: { file: 'dbscan.json', name: 'DBSCAN', gradient: 'gradient-dbscan', glow: 'glow-dbscan' },
  arbre_decision: { file: 'arbre_decision.json', name: 'Arbres de Décision', gradient: 'gradient-arbre_decision', glow: 'glow-arbre_decision' },
  svm: { file: 'svm.json', name: 'SVM (Support Vector Machines)', gradient: 'gradient-svm', glow: 'glow-svm' },
  appriori: { file: 'appriori.json', name: 'Algorithme Apriori', gradient: 'gradient-appriori', glow: 'glow-appriori' },
  pca: { file: 'pca.json', name: 'ACP (Analyse en Composantes Principales)', gradient: 'gradient-pca', glow: 'glow-pca' },
  regression: { file: 'regression.json', name: 'Régression Linéaire & Logistique', gradient: 'gradient-regression', glow: 'glow-regression' },
  ultimate: { file: '', name: 'Quiz Ultime (Multi-thèmes)', gradient: 'gradient-svm', glow: 'glow-svm' }
};

// État global de l'application
const state = {
  currentThemeId: null,      // ex: 'svm', 'dbscan', 'ultimate'
  originalQuestions: [],     // Liste complète des questions d'origine du quiz actif
  questions: [],             // Liste des questions du quiz actif (peut être filtrée en remédiation)
  userAnswers: {},           // Format: { questionId: ['A', 'C'] }
  flaggedQuestions: new Set(), // IDs des questions marquées pour révision
  currentQuestionIndex: 0,   // Index actif en mode une par une
  timeRemaining: 1200,       // Chronomètre en secondes (20 mins = 1200s)
  totalDuration: 1200,       // Durée de référence pour la barre de progression temporelle
  timerIntervalId: null,     // Interval ID du timer
  isRemediationMode: false,  // Indique si le quiz en cours est une remédiation
  viewMode: 'single',        // 'single' (une par une) ou 'fluid' (liste défilable)
  score: 0                   // Score final calculé
};

// --- INITIALISATION AU CHARGEMENT ---
document.addEventListener('DOMContentLoaded', () => {
  initHomeScreen();
  bindGlobalEvents();
});

// --- ÉCRAN D'ACCUEIL ---
function initHomeScreen() {
  const cardsContainer = document.getElementById('theme-cards-container');
  cardsContainer.innerHTML = '';

  Object.entries(THEMES_CONFIG).forEach(([themeId, config]) => {
    if (themeId === 'ultimate') return; // Ne pas afficher dans la grille standard
    
    const bestScore = localStorage.getItem(`best_score_${themeId}`);
    const scoreText = bestScore !== null ? `${bestScore} / 50` : 'Non tenté';
    
    const cardHtml = `
      <div class="glass-card glow-${themeId} rounded-2xl p-6 flex flex-col justify-between h-64 animate-fade-in relative overflow-hidden group">
        <!-- Fond décoratif avec effet lumineux au survol -->
        <div class="absolute -right-16 -top-16 w-36 h-36 rounded-full bg-indigo-500/10 blur-2xl group-hover:bg-indigo-500/20 transition-all duration-300"></div>
        
        <div>
          <div class="w-12 h-12 rounded-xl flex items-center justify-center ${config.gradient} text-white shadow-lg mb-4">
            ${getThemeIcon(themeId)}
          </div>
          <h3 class="text-xl font-bold text-slate-100 leading-tight mb-2">${config.name}</h3>
          <p class="text-sm text-slate-400">50 questions d'entraînement académique sur ce module de Machine Learning.</p>
        </div>
        
        <div class="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-4">
          <div class="text-xs">
            <span class="text-slate-500 block uppercase tracking-wider font-semibold">Meilleur Score</span>
            <span class="text-slate-200 font-bold text-sm flex items-center gap-1.5 mt-0.5">
              ${bestScore !== null ? '<span class="w-2 h-2 rounded-full bg-emerald-500"></span>' : '<span class="w-2 h-2 rounded-full bg-slate-600"></span>'}
              ${scoreText}
            </span>
          </div>
          <button onclick="startQuiz('${themeId}')" class="px-4 py-2 text-xs font-semibold text-white rounded-lg ${config.gradient} shadow-md transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98]">
            Commencer
          </button>
        </div>
      </div>
    `;
    cardsContainer.insertAdjacentHTML('beforeend', cardHtml);
  });
  
  // Afficher le meilleur score du Quiz Ultime sur sa bannière
  const ultimateBest = localStorage.getItem('best_score_ultimate');
  document.getElementById('ultimate-best-score').textContent = ultimateBest !== null ? `${ultimateBest} / 20` : 'Non tenté';
  
  updateGlobalStats();
}

function updateGlobalStats() {
  let completedCount = 0;
  let scoreSum = 0;
  let totalAttempted = 0;
  
  Object.keys(THEMES_CONFIG).forEach(themeId => {
    const bestScore = localStorage.getItem(`best_score_${themeId}`);
    if (bestScore !== null) {
      completedCount++;
      scoreSum += parseInt(bestScore, 10);
      totalAttempted++;
    }
  });
  
  document.getElementById('stats-completed-themes').textContent = completedCount;
  document.getElementById('stats-avg-score').textContent = totalAttempted > 0 ? Math.round((scoreSum / (totalAttempted * 50)) * 100) + '%' : '0%';
}

// --- LANCEMENT DU QUIZ ---
async function startQuiz(themeId, customQuestions = null) {
  showLoading(true);
  
  try {
    state.currentThemeId = themeId;
    
    if (customQuestions) {
      // Cas du mode Remédiation : on injecte la sélection filtrée
      // On mélange l'ordre des questions de remédiation pour briser la mémorisation
      state.questions = shuffleArray([...customQuestions]);
      state.isRemediationMode = true;
      // Temps adapté : 24 secondes par question, minimum 2 minutes
      state.timeRemaining = Math.max(120, state.questions.length * 24);
      state.totalDuration = state.timeRemaining;
    } else {
      // Mode normal : on télécharge le fichier JSON complet
      const response = await fetch(`data/${THEMES_CONFIG[themeId].file}`);
      if (!response.ok) throw new Error('Impossible de charger les questions');
      
      const data = await response.json();
      // Préparation : Mélange des options, ajustement des réponses, et mélange des questions
      state.originalQuestions = prepareAndShuffleQuiz(data);
      state.questions = [...state.originalQuestions];
      state.isRemediationMode = false;
      state.timeRemaining = 1200; // 20 minutes
      state.totalDuration = 1200;
    }
    
    // Réinitialisation des réponses et variables d'état
    state.userAnswers = {};
    state.flaggedQuestions.clear();
    state.currentQuestionIndex = 0;
    
    // Basculer l'affichage vers l'écran du quiz
    switchScreen('home-screen', 'quiz-screen');
    
    // Initialiser les composants UI du quiz
    initQuizHeader();
    renderQuestionNavigator();
    renderCurrentQuestion();
    
    // Lancer le timer
    startTimer();
    
  } catch (error) {
    console.error(error);
    alert(`Erreur de chargement : assurez-vous de faire tourner le serveur local (README.md) pour charger les données.`);
  } finally {
    showLoading(false);
  }
}

// --- LANCEMENT DU QUIZ ULTIME (20 QUESTIONS MÉLANGÉES) ---
async function startUltimateQuiz() {
  showLoading(true);
  
  try {
    state.currentThemeId = 'ultimate';
    state.isRemediationMode = false;
    
    // 1. Fetch de tous les thèmes en parallèle (exclure 'ultimate' de l'itération)
    const fetchPromises = Object.entries(THEMES_CONFIG)
      .filter(([themeId]) => themeId !== 'ultimate')
      .map(([themeId, config]) => {
        return fetch(`data/${config.file}`)
          .then(res => {
            if (!res.ok) throw new Error(`Erreur lors du chargement du thème ${themeId}`);
            return res.json();
          })
          .then(data => ({ themeId, questions: data }));
      });
      
    const results = await Promise.all(fetchPromises);
    
    // 2. Tirage des questions selon la distribution {3, 4, 3, 4, 3, 3}
    const distribution = {
      dbscan: 3,
      arbre_decision: 4,
      svm: 3,
      appriori: 4,
      pca: 3,
      regression: 3
    };
    
    let ultimateQuestions = [];
    
    results.forEach(({ themeId, questions }) => {
      const countToDraw = distribution[themeId] || 3;
      // Deep copy et mélange du pool de questions du thème
      const pool = shuffleArray([...questions]);
      // Sélection des N premières questions
      const selected = pool.slice(0, countToDraw);
      
      // Préparation individuelle de chaque question (mélange des options avec détection des dépendances)
      const preparedSelected = selected.map(q => prepareQuestionOptions(q));
      
      ultimateQuestions.push(...preparedSelected);
    });
    
    // 3. Mélanger l'ordre global des 20 questions (intervertir les thèmes aléatoirement)
    shuffleArray(ultimateQuestions);
    
    state.originalQuestions = ultimateQuestions;
    state.questions = [...state.originalQuestions];
    state.timeRemaining = 480; // 8 minutes (20 questions * 24 secondes)
    state.totalDuration = 480;
    
    // Réinitialisation des réponses et variables d'état
    state.userAnswers = {};
    state.flaggedQuestions.clear();
    state.currentQuestionIndex = 0;
    
    // Basculer l'affichage vers l'écran du quiz
    switchScreen('home-screen', 'quiz-screen');
    
    // Initialiser les composants UI du quiz
    initQuizHeader();
    renderQuestionNavigator();
    renderCurrentQuestion();
    
    // Lancer le timer
    startTimer();
    
  } catch (error) {
    console.error(error);
    alert(`Erreur de chargement du Quiz Ultime : assurez-vous de faire tourner le serveur local.`);
  } finally {
    showLoading(false);
  }
}

// --- GESTION DU CHRONOMÈTRE ---
function startTimer() {
  if (state.timerIntervalId) clearInterval(state.timerIntervalId);
  
  const timerLabel = document.getElementById('timer-label');
  const timerProgress = document.getElementById('timer-progress');
  
  const updateTimerUI = () => {
    const minutes = Math.floor(state.timeRemaining / 60);
    const seconds = state.timeRemaining % 60;
    timerLabel.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // Mise à jour de la barre de progression temporelle
    const percentLeft = (state.timeRemaining / state.totalDuration) * 100;
    timerProgress.style.width = `${percentLeft}%`;
    
    // Alerte temps faible (< 2 minutes)
    const headerContainer = document.getElementById('timer-container');
    if (state.timeRemaining <= 120) {
      headerContainer.classList.add('pulse-timer-alert', 'text-red-400');
      timerProgress.classList.remove('bg-indigo-500');
      timerProgress.classList.add('bg-red-500');
    } else {
      headerContainer.classList.remove('pulse-timer-alert', 'text-red-400');
      timerProgress.classList.remove('bg-red-500');
      timerProgress.classList.add('bg-indigo-500');
    }
  };
  
  updateTimerUI();
  
  state.timerIntervalId = setInterval(() => {
    state.timeRemaining--;
    updateTimerUI();
    
    if (state.timeRemaining <= 0) {
      clearInterval(state.timerIntervalId);
      submitQuiz(true); // Soumission automatique forcée
    }
  }, 1000);
}

// --- INITIALISATION UI DU QUIZ ---
function initQuizHeader() {
  const theme = THEMES_CONFIG[state.currentThemeId];
  document.getElementById('quiz-theme-title').textContent = theme.name;
  
  const remBadge = document.getElementById('remediation-badge');
  if (state.isRemediationMode) {
    remBadge.classList.remove('hidden');
    remBadge.textContent = `Remédiation (${state.questions.length} questions)`;
  } else {
    remBadge.classList.add('hidden');
  }
}

// Rend le panneau de navigation latéral droit
function renderQuestionNavigator() {
  const grid = document.getElementById('navigator-grid');
  grid.innerHTML = '';
  
  state.questions.forEach((q, idx) => {
    const answered = state.userAnswers[q.id] && state.userAnswers[q.id].length > 0;
    const flagged = state.flaggedQuestions.has(q.id);
    
    let btnClass = 'border border-slate-700 hover:border-indigo-500 text-slate-300';
    if (idx === state.currentQuestionIndex && state.viewMode === 'single') {
      btnClass = 'ring-2 ring-indigo-500 font-bold bg-indigo-500/20 text-indigo-300 border-indigo-500';
    } else if (answered) {
      btnClass = 'bg-indigo-600 hover:bg-indigo-500 text-white border-transparent';
    }
    
    const flagDot = flagged 
      ? '<span class="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center text-[10px] text-slate-950 font-bold">🚩</span>'
      : '';
      
    const btnHtml = `
      <button onclick="navigateToQuestion(${idx})" class="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium relative transition-all ${btnClass}">
        ${idx + 1}
        ${flagDot}
      </button>
    `;
    grid.insertAdjacentHTML('beforeend', btnHtml);
  });
  
  // Progress tracker numérique
  const total = state.questions.length;
  const answeredCount = state.questions.filter(q => state.userAnswers[q.id] && state.userAnswers[q.id].length > 0).length;
  document.getElementById('nav-progress-text').textContent = `${answeredCount} / ${total} répondues`;
  document.getElementById('nav-progress-bar').style.width = `${(answeredCount / total) * 100}%`;
}

// --- RENDU D'UNE QUESTION ---
function renderCurrentQuestion() {
  const area = document.getElementById('quiz-questions-area');
  area.innerHTML = '';
  
  if (state.viewMode === 'single') {
    const q = state.questions[state.currentQuestionIndex];
    area.innerHTML = buildQuestionCardHtml(q, state.currentQuestionIndex, true);
  } else {
    // Mode liste fluide : on affiche toutes les questions à la suite
    state.questions.forEach((q, idx) => {
      area.innerHTML += buildQuestionCardHtml(q, idx, false);
    });
  }
  
  // Rendre l'état des flags et boutons de nav bas
  updateBottomNavBar();
}

// Génère le HTML d'une carte question
function buildQuestionCardHtml(question, index, isSingleMode) {
  const isMulti = Array.isArray(question.correct);
  const userAns = state.userAnswers[question.id] || [];
  
  // Rendu des options
  let optionsHtml = '';
  question.options.forEach(opt => {
    const key = getOptionKey(opt);
    const checked = userAns.includes(key);
    const inputId = `opt-${question.id}-${key}`;
    const name = `question-${question.id}`;
    
    const inputType = isMulti ? 'checkbox' : 'radio';
    const selectedClass = checked ? 'choice-item-selected border-indigo-500' : 'border-slate-800 bg-slate-900/30';
    
    optionsHtml += `
      <label for="${inputId}" class="choice-item flex items-start gap-4 p-4 rounded-xl border ${selectedClass} cursor-pointer transition-all hover:bg-slate-800/40">
        <div class="flex items-center h-6">
          <input type="${inputType}" id="${inputId}" name="${name}" value="${key}" 
            ${checked ? 'checked' : ''} 
            onchange="handleAnswerSelect(${question.id}, '${key}', ${isMulti})"
            class="w-4 h-4 text-indigo-600 bg-slate-900 border-slate-700 rounded focus:ring-indigo-500 focus:ring-offset-slate-950 focus:ring-2">
        </div>
        <span class="text-slate-200 text-sm font-medium leading-relaxed">${opt}</span>
      </label>
    `;
  });
  
  const badgeThemeHtml = question.theme 
    ? `<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-800 text-slate-400 border border-slate-700/60">${question.theme}</span>`
    : '';
    
  return `
    <div id="q-card-${index}" class="glass-card rounded-2xl p-6 md:p-8 animate-slide-up mb-6 border-slate-800 relative">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <span class="text-indigo-400 text-sm font-semibold tracking-wider uppercase font-mono">Question ${index + 1} / ${state.questions.length}</span>
        <div class="flex items-center gap-2">
          ${badgeThemeHtml}
          <span class="px-2.5 py-1 text-xs font-semibold rounded-full ${isMulti ? 'bg-purple-950/40 text-purple-300 border border-purple-800/50' : 'bg-blue-950/40 text-blue-300 border border-blue-800/50'}">
            ${isMulti ? '🚩 Choix multiples' : 'Choix unique'}
          </span>
        </div>
      </div>
      
      <h2 class="text-lg md:text-xl font-bold text-slate-100 leading-snug mb-6">${question.question}</h2>
      
      <div class="flex flex-col gap-3">
        ${optionsHtml}
      </div>
    </div>
  `;
}

// Mise à jour de la barre de navigation basse (Précédent, Suivant, Flag)
function updateBottomNavBar() {
  const container = document.getElementById('bottom-nav-container');
  
  if (state.viewMode !== 'single') {
    container.innerHTML = `
      <div class="flex items-center justify-between w-full">
        <span class="text-xs text-slate-400">Mode Liste Fluide</span>
        <button onclick="confirmSubmitQuiz()" class="px-6 py-2.5 font-bold text-white rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all">
          Valider le Quiz
        </button>
      </div>
    `;
    return;
  }
  
  const q = state.questions[state.currentQuestionIndex];
  const isFirst = state.currentQuestionIndex === 0;
  const isLast = state.currentQuestionIndex === state.questions.length - 1;
  const isFlagged = state.flaggedQuestions.has(q.id);
  
  container.innerHTML = `
    <div class="flex items-center justify-between w-full">
      <button onclick="prevQuestion()" ${isFirst ? 'disabled' : ''} 
        class="px-4 py-2 text-sm font-semibold rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 hover:border-slate-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:pointer-events-none transition-all">
        ← Précédent
      </button>
      
      <button onclick="toggleFlag(${q.id})" 
        class="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl border ${isFlagged ? 'bg-amber-950/30 border-amber-500 text-amber-400' : 'border-slate-700 text-slate-300 hover:bg-slate-800'} transition-all">
        <span>🚩</span>
        <span class="hidden md:inline">${isFlagged ? 'Signalisée' : 'Signaler'}</span>
      </button>
      
      ${isLast 
        ? `<button onclick="confirmSubmitQuiz()" class="px-6 py-2.5 font-bold text-white rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 shadow-lg active:scale-[0.98] transition-all">Terminer</button>`
        : `<button onclick="nextQuestion()" class="px-5 py-2.5 font-bold text-white rounded-xl bg-indigo-600 hover:bg-indigo-500 shadow-lg active:scale-[0.98] transition-all">Suivant →</button>`
      }
    </div>
  `;
}

// --- ACTIONS QUIZ ---
function handleAnswerSelect(questionId, optionKey, isMulti) {
  let answers = state.userAnswers[questionId] || [];
  
  if (isMulti) {
    if (answers.includes(optionKey)) {
      answers = answers.filter(k => k !== optionKey);
    } else {
      answers.push(optionKey);
    }
  } else {
    answers = [optionKey];
  }
  
  state.userAnswers[questionId] = answers;
  
  // Re-synchronisation locale des classes sélectionnées (évite le re-render complet)
  const questionIndex = state.questions.findIndex(q => q.id === questionId);
  const qCard = document.getElementById(`q-card-${questionIndex}`);
  if (qCard) {
    const labels = qCard.querySelectorAll('.choice-item');
    labels.forEach(lbl => {
      const input = lbl.querySelector('input');
      if (input.checked) {
        lbl.classList.remove('border-slate-800', 'bg-slate-900/30');
        lbl.classList.add('choice-item-selected', 'border-indigo-500');
      } else {
        lbl.classList.remove('choice-item-selected', 'border-indigo-500');
        lbl.classList.add('border-slate-800', 'bg-slate-900/30');
      }
    });
  }
  
  renderQuestionNavigator();
  updateBottomNavBar();
}

function navigateToQuestion(idx) {
  state.currentQuestionIndex = idx;
  
  if (state.viewMode === 'single') {
    renderCurrentQuestion();
    renderQuestionNavigator();
  } else {
    // Mode fluid : scroll fluide vers la carte correspondante
    const card = document.getElementById(`q-card-${idx}`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}

function nextQuestion() {
  if (state.currentQuestionIndex < state.questions.length - 1) {
    state.currentQuestionIndex++;
    renderCurrentQuestion();
    renderQuestionNavigator();
  }
}

function prevQuestion() {
  if (state.currentQuestionIndex > 0) {
    state.currentQuestionIndex--;
    renderCurrentQuestion();
    renderQuestionNavigator();
  }
}

function toggleFlag(qId) {
  if (state.flaggedQuestions.has(qId)) {
    state.flaggedQuestions.delete(qId);
  } else {
    state.flaggedQuestions.add(qId);
  }
  renderQuestionNavigator();
  updateBottomNavBar();
}

function changeViewMode(mode) {
  if (state.viewMode === mode) return;
  
  state.viewMode = mode;
  
  // Basculer l'état visuel des boutons
  const btnSingle = document.getElementById('view-btn-single');
  const btnFluid = document.getElementById('view-btn-fluid');
  
  if (mode === 'single') {
    btnSingle.classList.add('bg-slate-800', 'text-slate-100');
    btnSingle.classList.remove('text-slate-400');
    btnFluid.classList.remove('bg-slate-800', 'text-slate-100');
    btnFluid.classList.add('text-slate-400');
  } else {
    btnFluid.classList.add('bg-slate-800', 'text-slate-100');
    btnFluid.classList.remove('text-slate-400');
    btnSingle.classList.remove('bg-slate-800', 'text-slate-100');
    btnSingle.classList.add('text-slate-400');
  }
  
  renderCurrentQuestion();
  renderQuestionNavigator();
}

// --- SOUMISSION & MODAL ---
function confirmSubmitQuiz() {
  const answeredCount = state.questions.filter(q => state.userAnswers[q.id] && state.userAnswers[q.id].length > 0).length;
  const total = state.questions.length;
  const unansweredCount = total - answeredCount;
  const flaggedCount = state.flaggedQuestions.size;
  
  const modalText = document.getElementById('confirm-modal-text');
  
  let msg = `Vous avez répondu à <strong class="text-indigo-400">${answeredCount}</strong> questions sur <strong class="text-indigo-400">${total}</strong>.`;
  if (unansweredCount > 0) {
    msg += `<br><span class="text-amber-400 font-semibold">⚠️ Attention : ${unansweredCount} questions sont sans réponse.</span>`;
  }
  if (flaggedCount > 0) {
    msg += `<br><span>🚩 Vous avez ${flaggedCount} question(s) marquée(s) pour révision.</span>`;
  }
  
  modalText.innerHTML = msg;
  document.getElementById('confirm-modal').classList.remove('hidden', 'pointer-events-none');
}

function closeConfirmModal() {
  document.getElementById('confirm-modal').classList.add('hidden', 'pointer-events-none');
}

function exitQuizWithConfirmation() {
  if (confirm("Voulez-vous vraiment quitter le quiz ? Votre progression en cours sera perdue.")) {
    cleanupQuiz();
    switchScreen('quiz-screen', 'home-screen');
    initHomeScreen();
  }
}

// Libère le chronomètre et variables
function cleanupQuiz() {
  if (state.timerIntervalId) {
    clearInterval(state.timerIntervalId);
    state.timerIntervalId = null;
  }
  document.getElementById('timer-container').classList.remove('pulse-timer-alert', 'text-red-400');
}

// --- CALCUL DU SCORE & ECRAN RÉSULTATS ---
function submitQuiz(isAuto = false) {
  cleanupQuiz();
  closeConfirmModal();
  
  if (isAuto) {
    alert("Temps écoulé ! Votre quiz a été validé automatiquement.");
  }
  
  // Calcul du score précis
  let scoreValue = 0;
  state.questions.forEach(q => {
    const expected = q.correct;
    const user = state.userAnswers[q.id] || [];
    
    let isCorrect = false;
    if (Array.isArray(expected)) {
      // Choix multiple : comparaison stricte des ensembles
      isCorrect = expected.length === user.length && expected.every(opt => user.includes(opt));
    } else {
      // Choix unique
      isCorrect = user.length === 1 && user[0] === expected;
    }
    
    if (isCorrect) scoreValue++;
  });
  
  state.score = scoreValue;
  
  // Enregistrer dans localStorage si c'est le meilleur score et qu'on n'est pas en remédiation
  if (!state.isRemediationMode) {
    const pastBest = localStorage.getItem(`best_score_${state.currentThemeId}`);
    if (pastBest === null || scoreValue > parseInt(pastBest, 10)) {
      localStorage.setItem(`best_score_${state.currentThemeId}`, scoreValue);
    }
  }
  
  // Afficher les résultats
  switchScreen('quiz-screen', 'results-screen');
  renderResults();
}

function renderResults() {
  const total = state.questions.length;
  const scorePercent = Math.round((state.score / total) * 100);
  
  // Calcul du temps passé
  const timeUsed = state.totalDuration - state.timeRemaining;
  const minUsed = Math.floor(timeUsed / 60);
  const secUsed = timeUsed % 60;
  document.getElementById('result-time-spent').textContent = `${minUsed}m ${secUsed}s`;
  
  // Progression circulaire animée
  const dashOffset = 282.6 * (1 - state.score / total);
  document.getElementById('circle-val').style.strokeDashoffset = dashOffset;
  
  // Déterminer la couleur de la note
  const circleVal = document.getElementById('circle-val');
  circleVal.className = 'circle-progress-val'; // reset
  if (scorePercent >= 80) {
    circleVal.classList.add('stroke-emerald-500');
  } else if (scorePercent >= 50) {
    circleVal.classList.add('stroke-indigo-500');
  } else {
    circleVal.classList.add('stroke-red-500');
  }
  
  // Animation numérique progressive (count-up)
  animateNumberCount('result-score-numeric', 0, state.score, 1200);
  document.getElementById('result-score-total').textContent = ` / ${total}`;
  document.getElementById('result-score-percent').textContent = `${scorePercent}% de réussite`;
  
  // Appréciation textuelle
  const titleRating = document.getElementById('result-title-rating');
  const descRating = document.getElementById('result-desc-rating');
  
  if (scorePercent >= 90) {
    titleRating.textContent = "Expert en Machine Learning !";
    titleRating.className = "text-xl font-bold text-emerald-400";
    descRating.textContent = "Vos connaissances sur ce thème sont exceptionnelles. Vous êtes prêt pour l'évaluation !";
  } else if (scorePercent >= 75) {
    titleRating.textContent = "Excellent score !";
    titleRating.className = "text-xl font-bold text-indigo-400";
    descRating.textContent = "Une excellente maîtrise du sujet. Encore quelques détails à peaufiner.";
  } else if (scorePercent >= 50) {
    titleRating.textContent = "Score correct !";
    titleRating.className = "text-xl font-bold text-amber-400";
    descRating.textContent = "Le sujet est compris dans l'ensemble, mais de nombreuses notions méritent révision.";
  } else {
    titleRating.textContent = "À réviser !";
    titleRating.className = "text-xl font-bold text-red-400";
    descRating.textContent = "Les résultats montrent des lacunes importantes. Prenez le temps de relire vos cours.";
  }
  
  // Désactiver ou activer le bouton de remédiation s'il n'y a pas d'erreurs
  const wrongCount = total - state.score;
  const remedBtn = document.getElementById('remed-action-btn');
  if (wrongCount === 0) {
    remedBtn.disabled = true;
    remedBtn.classList.add('opacity-50', 'pointer-events-none');
    remedBtn.textContent = 'Aucune erreur !';
  } else {
    remedBtn.disabled = false;
    remedBtn.classList.remove('opacity-50', 'pointer-events-none');
    remedBtn.textContent = 'Refaire les questions manquées';
  }
  
  // Mettre à jour le bouton filtre "Toutes" avec le total dynamique
  const filterAllBtn = document.querySelector('.filter-btn[data-filter="all"]');
  if (filterAllBtn) {
    filterAllBtn.textContent = `Toutes (${total})`;
  }
  
  // Rendre le récapitulatif détaillé
  renderReviewList('all');
}

// --- REVUE DÉTAILLÉE DU QUIZ ---
function renderReviewList(filter = 'all') {
  const container = document.getElementById('review-questions-list');
  container.innerHTML = '';
  
  // Gérer le filtre actif
  const buttons = document.querySelectorAll('.filter-btn');
  buttons.forEach(btn => {
    if (btn.getAttribute('data-filter') === filter) {
      btn.classList.add('bg-indigo-600', 'text-white', 'border-transparent');
      btn.classList.remove('bg-slate-900', 'text-slate-400', 'border-slate-800');
    } else {
      btn.classList.remove('bg-indigo-600', 'text-white', 'border-transparent');
      btn.classList.add('bg-slate-900', 'text-slate-400', 'border-slate-800');
    }
  });
  
  state.questions.forEach((q, idx) => {
    const expected = q.correct;
    const user = state.userAnswers[q.id] || [];
    
    // Évaluer l'état
    let isCorrect = false;
    if (Array.isArray(expected)) {
      isCorrect = expected.length === user.length && expected.every(opt => user.includes(opt));
    } else {
      isCorrect = user.length === 1 && user[0] === expected;
    }
    
    const isUnanswered = user.length === 0;
    const isFlagged = state.flaggedQuestions.has(q.id);
    
    // Application du filtre
    if (filter === 'correct' && !isCorrect) return;
    if (filter === 'wrong' && (isCorrect || isUnanswered)) return;
    if (filter === 'unanswered' && !isUnanswered) return;
    if (filter === 'flagged' && !isFlagged) return;
    
    // Construction des options de revue
    let optionsHtml = '';
    q.options.forEach(opt => {
      const key = getOptionKey(opt);
      const isExpected = Array.isArray(expected) ? expected.includes(key) : expected === key;
      const isSelected = user.includes(key);
      
      let optBorderClass = 'border-slate-800 bg-slate-950/20';
      let badgeIcon = '';
      
      if (isExpected) {
        // C'était une bonne réponse (attendue)
        optBorderClass = 'choice-item-correct border-emerald-500 bg-emerald-500/5';
        badgeIcon = '<span class="text-emerald-500 font-bold ml-auto flex items-center gap-1 text-xs">✓ Bonne réponse</span>';
      } else if (isSelected && !isExpected) {
        // L'utilisateur l'a sélectionnée mais elle est fausse
        optBorderClass = 'choice-item-incorrect border-red-500 bg-red-500/5';
        badgeIcon = '<span class="text-red-500 font-bold ml-auto flex items-center gap-1 text-xs">✗ Votre choix (incorrect)</span>';
      } else if (isSelected && isExpected) {
        // L'utilisateur a choisi la bonne réponse (déjà couvert par isExpected)
        optBorderClass = 'choice-item-correct border-emerald-500 bg-emerald-500/5';
        badgeIcon = '<span class="text-emerald-500 font-bold ml-auto flex items-center gap-1 text-xs">✓ Correct</span>';
      }
      
      // Petit checkmark si coché
      const checkIndicator = isSelected 
        ? `<div class="w-4 h-4 rounded flex items-center justify-center text-xs text-white ${isExpected ? 'bg-emerald-500' : 'bg-red-500'}">✓</div>`
        : `<div class="w-4 h-4 rounded border ${isExpected ? 'border-emerald-500' : 'border-slate-700'}"></div>`;
      
      optionsHtml += `
        <div class="flex items-start gap-4 p-4 rounded-xl border ${optBorderClass}">
          <div class="flex items-center h-5 mt-0.5">
            ${checkIndicator}
          </div>
          <span class="text-slate-300 text-sm font-medium leading-relaxed">${opt}</span>
          ${badgeIcon}
        </div>
      `;
    });
    
    // Cartouche globale de statut
    let statusHeader = '';
    if (isCorrect) {
      statusHeader = `
        <div class="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span> Correct
        </div>
      `;
    } else if (isUnanswered) {
      statusHeader = `
        <div class="flex items-center gap-2 text-amber-500 font-bold text-xs uppercase tracking-wider">
          <span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Non répondu
        </div>
      `;
    } else {
      statusHeader = `
        <div class="flex items-center gap-2 text-red-500 font-bold text-xs uppercase tracking-wider">
          <span class="w-2.5 h-2.5 rounded-full bg-red-500"></span> Incorrect
        </div>
      `;
    }
    
    const correctValText = Array.isArray(expected) ? expected.join(', ') : expected;
    const correctionBanner = !isCorrect 
      ? `
        <div class="mt-4 p-3 bg-slate-900 border border-slate-800 rounded-lg flex items-center gap-2">
          <span class="text-xs text-slate-400 font-semibold uppercase tracking-wider">Solution :</span>
          <span class="px-2 py-0.5 text-xs font-bold rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
            Option(s) ${correctValText}
          </span>
        </div>
      `
      : '';
      
    const cardHtml = `
      <div class="glass-card rounded-xl p-5 md:p-6 border-slate-800/80 mb-4">
        <div class="flex items-center justify-between gap-3 mb-3 border-b border-slate-800/50 pb-3">
          <div class="flex items-center gap-2.5">
            <span class="text-xs font-mono text-slate-500">Q${idx + 1}</span>
            ${statusHeader}
          </div>
          ${isFlagged ? '<span class="text-xs bg-amber-950/40 text-amber-400 border border-amber-800/50 px-2 py-0.5 rounded-md font-semibold">🚩 Signalée</span>' : ''}
        </div>
        
        <p class="text-sm font-semibold text-slate-200 mb-4 leading-relaxed">${q.question}</p>
        
        <div class="flex flex-col gap-2">
          ${optionsHtml}
        </div>
        
        ${correctionBanner}
      </div>
    `;
    container.insertAdjacentHTML('beforeend', cardHtml);
  });
  
  if (container.children.length === 0) {
    container.innerHTML = `
      <div class="text-center py-12 border border-dashed border-slate-800 rounded-xl bg-slate-900/10">
        <span class="text-4xl">📭</span>
        <p class="text-sm text-slate-400 mt-2">Aucune question ne correspond à ce filtre.</p>
      </div>
    `;
  }
}

// --- REMÉDIATION ET RETENTATIVE ---
function triggerRemediation() {
  // Sélectionner uniquement les questions manquées dans le tour qui vient de finir.
  // En remédiation, state.questions contient déjà le sous-ensemble ciblé.
  const missedQuestions = state.questions.filter(q => {
    const expected = q.correct;
    const user = state.userAnswers[q.id] || [];
    
    if (Array.isArray(expected)) {
      return !(expected.length === user.length && expected.every(opt => user.includes(opt)));
    } else {
      return !(user.length === 1 && user[0] === expected);
    }
  });
  
  if (missedQuestions.length === 0) {
    alert("Félicitations, vous n'avez fait aucune erreur sur ce quiz !");
    return;
  }
  
  // Basculer en mode remédiation avec les questions filtrées
  switchScreen('results-screen', 'quiz-screen');
  startQuiz(state.currentThemeId, missedQuestions);
}

function triggerRetakeFullQuiz() {
  switchScreen('results-screen', 'quiz-screen');
  startQuiz(state.currentThemeId);
}

function returnToHome() {
  switchScreen('results-screen', 'home-screen');
  initHomeScreen();
}

// --- UTILS ET BINDINGS ---
function getOptionKey(option) {
  // Extrait la clé "A" depuis "A. Sequential Vector Machine" ou "A) Density..."
  const match = option.trim().match(/^([A-Za-z0-9]+)/);
  return match ? match[1] : option.trim().charAt(0);
}

function switchScreen(fromId, toId) {
  const fromScreen = document.getElementById(fromId);
  const toScreen = document.getElementById(toId);
  
  fromScreen.classList.add('hidden');
  toScreen.classList.remove('hidden');
  
  // Remonter en haut de page
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function showLoading(show) {
  const loader = document.getElementById('global-loader');
  if (show) {
    loader.classList.remove('hidden');
  } else {
    loader.classList.add('hidden');
  }
}

function getThemeIcon(themeId) {
  // SVG Lucide standardisés
  const icons = {
    dbscan: `<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    arbre_decision: `<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/></svg>`,
    svm: `<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.886L3.82 9.06l5.09 4.306-1.92 5.897L12 15.63l5.01 3.633-1.92-5.897 5.09-4.306-6.268-.174z"/></svg>`,
    appriori: `<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/></svg>`,
    pca: `<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
    regression: `<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m18.7 8-5.1 5.2-2.8-2.7L7 14.3"/></svg>`
  };
  return icons[themeId] || icons['dbscan'];
}

function animateNumberCount(id, start, end, duration) {
  const obj = document.getElementById(id);
  let startTime = null;
  
  const step = (timestamp) => {
    if (!startTime) startTime = timestamp;
    const progress = Math.min((timestamp - startTime) / duration, 1);
    obj.innerHTML = Math.floor(progress * (end - start) + start);
    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  };
  
  window.requestAnimationFrame(step);
}

function bindGlobalEvents() {
  // Liaison des boutons de changement de vue
  document.getElementById('view-btn-single').addEventListener('click', () => changeViewMode('single'));
  document.getElementById('view-btn-fluid').addEventListener('click', () => changeViewMode('fluid'));
  
  // Liaison des boutons de filtre de revue
  const filterContainer = document.getElementById('review-filter-container');
  filterContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (btn) {
      const filter = btn.getAttribute('data-filter');
      renderReviewList(filter);
    }
  });
}

// --- SHUFFLING & PARSING ALGORITHMS ---

/**
 * Mélange un tableau sur place avec l'algorithme de Fisher-Yates.
 */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Extrait la lettre clé et le texte d'une option.
 * supporte "A. Option", "A) Option", "A - Option", etc.
 */
function parseOption(optionStr) {
  const match = optionStr.trim().match(/^([A-Za-z0-9]+)[\s\.\)\-]\s*(.*)$/);
  if (match) {
    return { key: match[1], text: match[2] };
  }
  return { key: optionStr.trim().charAt(0), text: optionStr.trim().substring(1).trim() };
}

/**
 * Détermine si les options d'une question peuvent être mélangées.
 * Renvoie false si les choix de réponse contiennent des références croisées ("A et B", "ci-dessus", etc.).
 */
function shouldShuffleOptions(question) {
  // Regex élargi pour détecter les options dépendantes de l'ordre ou croisées
  const pattern = /(ci-dessus|ci-dessous|toutes les|aucune de|aucune des|les deux|propositions| propositions|les propositions|A et |A ou |B et |B ou|C et |C ou|les choix)/i;
  return !question.options.some(opt => pattern.test(opt));
}

/**
 * Prépare une question individuelle :
 * - Soit en mélangeant ses options s'il n'y a pas d'incohérence logique.
 * - Soit en gardant l'ordre original pour préserver la validité (ex: "A et C sont corrects").
 */
function prepareQuestionOptions(q) {
  if (!shouldShuffleOptions(q)) {
    // Renvoyer une copie intacte pour préserver la cohérence des choix dépendants
    return {
      ...q,
      options: [...q.options],
      correct: Array.isArray(q.correct) ? [...q.correct] : q.correct
    };
  }

  // Parser les options et évaluer si elles sont correctes
  const parsedOptions = q.options.map(opt => {
    const parsed = parseOption(opt);
    const isCorrect = Array.isArray(q.correct)
      ? q.correct.includes(parsed.key)
      : q.correct === parsed.key;
    return { text: parsed.text, isCorrect };
  });
  
  // Mélanger les options
  shuffleArray(parsedOptions);
  
  // Reconstruire les options avec de nouvelles lettres et réponses correctes
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const newOptions = [];
  const newCorrect = [];
  
  parsedOptions.forEach((opt, idx) => {
    const letter = alphabet[idx] || String.fromCharCode(65 + idx);
    newOptions.push(`${letter}. ${opt.text}`);
    if (opt.isCorrect) {
      newCorrect.push(letter);
    }
  });
  
  return {
    ...q,
    options: newOptions,
    correct: Array.isArray(q.correct) ? newCorrect : (newCorrect[0] || '')
  };
}

/**
 * Prépare et mélange le quiz :
 * 1. Mélange (ou préserve) les options de chaque question et réajuste la/les bonne(s) réponse(s).
 * 2. Mélange l'ordre global des questions.
 */
function prepareAndShuffleQuiz(questions) {
  const copiedQuestions = questions.map(q => prepareQuestionOptions(q));
  
  // Mélanger l'ordre des questions elles-mêmes
  shuffleArray(copiedQuestions);
  
  return copiedQuestions;
}
