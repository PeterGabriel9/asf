class QuizApp {
    constructor() {
        this.allQuestions = [];
        this.questions = [];
        this.currentQuestionIndex = 0;
        this.userAnswers = [];
        this.correctAnswers = 0;
        this.questionsPerSession = 40;
        this.totalQuizzes = 0;
        this.currentQuizNumber = 1;
        this.isQuizCompleted = false;
        this.liveFeedback = true;
        this.hasAnsweredCurrent = false;
        this.needsCorrectAnswer = false; // Nou: indică dacă trebuie să aleagă răspunsul corect
        this.wrongAnswers = []; // Nou: listă cu întrebările greșite
        
        this.loadAllQuestions();
        this.initializeEventListeners();
    }

    async loadAllQuestions() {
        try {
            const response = await fetch('chestionar_grupat.json');
            this.allQuestions = await response.json();
            
            console.log(`Total întrebări încărcate: ${this.allQuestions.length}`);
            
            // Calculează numărul total de chestionare bazat pe numărul real de întrebări
            this.totalQuizzes = Math.ceil(this.allQuestions.length / this.questionsPerSession);
            
            this.showQuizSelection();
        } catch (error) {
            console.error('Eroare la încărcarea întrebărilor:', error);
            document.getElementById('questionText').textContent = 'Eroare la încărcarea întrebărilor. Verifică dacă fișierul JSON există.';
        }
    }

    showQuizSelection() {
        // Ascunde containerul de întrebări și rezultate
        document.getElementById('questionContainer').classList.add('hidden');
        document.getElementById('resultsContainer').classList.add('hidden');
        
        // Creează sau afișează selecția de chestionare
        let selectionContainer = document.getElementById('quizSelectionContainer');
        if (!selectionContainer) {
            selectionContainer = document.createElement('div');
            selectionContainer.id = 'quizSelectionContainer';
            selectionContainer.className = 'quiz-selection-container';
            document.querySelector('main').appendChild(selectionContainer);
        }
        
        selectionContainer.classList.remove('hidden');
        selectionContainer.innerHTML = `
            <h2>Selectează chestionarul</h2>
            <p>Total întrebări: ${this.allQuestions.length} | Chestionare disponibile: ${this.totalQuizzes}</p>
            <div class="stats-controls">
                <button id="viewStatsBtn" class="btn btn-secondary" onclick="quizApp.showStats()">📊 Vezi statistici generale</button>
                <button id="clearDataBtn" class="btn btn-secondary" onclick="quizApp.confirmClearData()">🗑️ Șterge toate datele</button>
            </div>
            <div class="quiz-list">
                ${this.generateQuizList()}
            </div>
        `;
    }

    generateQuizList() {
        let html = '';
        for (let i = 1; i <= this.totalQuizzes; i++) {
            const startIndex = (i - 1) * this.questionsPerSession;
            const endIndex = Math.min(startIndex + this.questionsPerSession, this.allQuestions.length);
            const questionsCount = endIndex - startIndex;
            
            // Verifică dacă există progres salvat pentru acest chestionar
            const savedProgress = this.getSavedProgress(i);
            const savedResults = this.getSavedResults(i);
            
            let statusText = '';
            if (savedResults) {
                // Chestionar terminat
                const percentage = Math.round((savedResults.correctAnswers / savedResults.totalQuestions) * 100);
                statusText = `<div class="quiz-completed">✓ Terminat: ${savedResults.correctAnswers}/${savedResults.totalQuestions} (${percentage}%)</div>`;
            } else if (savedProgress) {
                // Progres în curs
                statusText = `<div class="quiz-progress">⏳ Progres: ${savedProgress.currentQuestion + 1}/${questionsCount}</div>`;
            } else {
                // Nou
                statusText = `<div class="quiz-new">🆕 Nou</div>`;
            }
            
            html += `
                <div class="quiz-item" onclick="quizApp.selectQuiz(${i})">
                    <div class="quiz-number">Chestionarul ${i}</div>
                    <div class="quiz-details">Întrebările ${startIndex + 1} - ${endIndex} (${questionsCount} întrebări)</div>
                    ${statusText}
                </div>
            `;
        }
        return html;
    }

    selectQuiz(quizNumber) {
        this.currentQuizNumber = quizNumber;
        const startIndex = (quizNumber - 1) * this.questionsPerSession;
        const endIndex = Math.min(startIndex + this.questionsPerSession, this.allQuestions.length);
        
        this.questions = this.allQuestions.slice(startIndex, endIndex);
        
        // Încearcă să încarce progresul salvat
        const savedProgress = this.getSavedProgress(quizNumber);
        if (savedProgress) {
            this.loadSavedProgress(savedProgress);
        } else {
            this.initializeAnswers();
            this.currentQuestionIndex = 0;
            this.correctAnswers = 0;
        }
        
        // Ascunde selecția și afișează chestionarul
        document.getElementById('quizSelectionContainer').classList.add('hidden');
        document.getElementById('questionContainer').classList.remove('hidden');
        
        this.displayCurrentQuestion();
    }

    initializeAnswers() {
        this.userAnswers = new Array(this.questions.length).fill(null);
    }

    initializeEventListeners() {
        document.getElementById('nextBtn').addEventListener('click', () => this.nextQuestion());
        document.getElementById('prevBtn').addEventListener('click', () => this.prevQuestion());
        document.getElementById('restartBtn').addEventListener('click', () => this.restart());
        document.getElementById('reviewBtn').addEventListener('click', () => this.reviewAnswers());
        document.getElementById('backToSelectionBtn').addEventListener('click', () => this.showQuizSelection());
        document.getElementById('backToHomeBtn').addEventListener('click', () => this.confirmBackToHome());
        
        // Creează referința globală pentru funcția selectQuiz
        window.quizApp = this;
    }

    showLiveFeedback(selectedAnswerIndex) {
        const question = this.questions[this.currentQuestionIndex];
        const selectedAnswerText = question.raspunsuri[selectedAnswerIndex];
        const isCorrect = selectedAnswerText.includes('*');

        // Afișează toate răspunsurile cu indicatori
        document.querySelectorAll('.answer-option').forEach((option, index) => {
            const answerText = question.raspunsuri[index];
            const isThisCorrect = answerText.includes('*');
            
            // NU dezactiva click-urile aici - le gestionăm în displayAnswers
            
            if (isThisCorrect && !this.needsCorrectAnswer) {
                option.classList.add('correct');
            } else if (index === selectedAnswerIndex && !isCorrect) {
                option.classList.add('incorrect');
            }
        });

        // Actualizează scorul doar dacă răspunsul e corect din prima
        if (isCorrect && !this.needsCorrectAnswer) {
            this.correctAnswers++;
            document.getElementById('score').textContent = `Răspunsuri corecte: ${this.correctAnswers}`;
        }
    }

    getSavedProgress(quizNumber) {
        const key = `quiz_progress_${quizNumber}`;
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : null;
    }

    saveProgress() {
        const progressData = {
            quizNumber: this.currentQuizNumber,
            currentQuestion: this.currentQuestionIndex,
            userAnswers: this.userAnswers,
            correctAnswers: this.correctAnswers,
            timestamp: new Date().toISOString()
        };
        
        const key = `quiz_progress_${this.currentQuizNumber}`;
        localStorage.setItem(key, JSON.stringify(progressData));
    }

    loadSavedProgress(savedProgress) {
        this.currentQuestionIndex = savedProgress.currentQuestion;
        this.userAnswers = savedProgress.userAnswers || [];
        this.correctAnswers = savedProgress.correctAnswers || 0;
        
        // Asigură-te că array-ul de răspunsuri are dimensiunea corectă
        while (this.userAnswers.length < this.questions.length) {
            this.userAnswers.push(null);
        }
    }

    clearSavedProgress(quizNumber) {
        const key = `quiz_progress_${quizNumber}`;
        localStorage.removeItem(key);
    }

    getSavedResults(quizNumber) {
        const key = `quiz_results_${quizNumber}`;
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : null;
    }

    saveResults() {
        const resultsData = {
            quizNumber: this.currentQuizNumber,
            correctAnswers: this.correctAnswers,
            totalQuestions: this.questions.length,
            percentage: Math.round((this.correctAnswers / this.questions.length) * 100),
            completedAt: new Date().toISOString(),
            userAnswers: this.userAnswers
        };
        
        const key = `quiz_results_${this.currentQuizNumber}`;
        localStorage.setItem(key, JSON.stringify(resultsData));
    }

    getAllResults() {
        const results = [];
        for (let i = 1; i <= this.totalQuizzes; i++) {
            const result = this.getSavedResults(i);
            if (result) {
                results.push(result);
            }
        }
        return results;
    }

    clearAllData() {
        // Șterge toate progresele și rezultatele
        for (let i = 1; i <= this.totalQuizzes; i++) {
            this.clearSavedProgress(i);
            localStorage.removeItem(`quiz_results_${i}`);
        }
    }

    displayCurrentQuestion() {
        if (this.questions.length === 0) return;

        const question = this.questions[this.currentQuestionIndex];
        
        // Reset feedback state pentru întrebarea curentă
        this.hasAnsweredCurrent = this.userAnswers[this.currentQuestionIndex] !== null;
        this.needsCorrectAnswer = false; // RESETEAZĂ întotdeauna la schimbarea întrebării
        
        // Actualizează informațiile de progres
        document.getElementById('progress').textContent = 
            `Întrebarea ${this.currentQuestionIndex + 1} din ${this.questions.length}`;
        document.getElementById('score').textContent = 
            `Răspunsuri corecte: ${this.correctAnswers}`;
        
        // Actualizează bara de progres
        const progressPercent = ((this.currentQuestionIndex + 1) / this.questions.length) * 100;
        document.getElementById('progressFill').style.width = `${progressPercent}%`;

        // Afișează întrebarea
        document.getElementById('questionNumber').textContent = `${this.currentQuestionIndex + 1}.`;
        document.getElementById('questionText').textContent = question.intrebare;

        // Generează răspunsurile
        this.displayAnswers(question.raspunsuri);

        // Actualizează butoanele
        this.updateNavigationButtons();
    }

    displayAnswers(answers) {
        const container = document.getElementById('answersContainer');
        container.innerHTML = '';

        answers.forEach((answer, index) => {
            const answerDiv = document.createElement('div');
            answerDiv.className = 'answer-option';
            
            // Elimină steluța din textul afișat
            const cleanAnswer = answer.replace('*', '').trim();
            answerDiv.textContent = cleanAnswer;
            answerDiv.dataset.index = index;

            // Verifică dacă acest răspuns a fost selectat anterior
            if (this.userAnswers[this.currentQuestionIndex] === index) {
                answerDiv.classList.add('selected');
                
                // Dacă întrebarea a fost deja răspunsă, afișează feedback-ul
                if (this.hasAnsweredCurrent && this.liveFeedback) {
                    this.showLiveFeedback(index);
                }
            }

            // RESETEAZĂ stilurile și permite click-uri pentru toate răspunsurile
            answerDiv.style.pointerEvents = 'auto';

            // Permite click-uri în funcție de starea curentă
            if (this.needsCorrectAnswer) {
                // În modul "alege răspunsul corect" - permite click pe toate
                answerDiv.addEventListener('click', () => this.selectAnswer(index));
            } else if (!this.hasAnsweredCurrent || !this.liveFeedback) {
                // Permite click normal
                answerDiv.addEventListener('click', () => this.selectAnswer(index));
            } else {
                // Dezactivează toate click-urile doar după răspuns final
                answerDiv.style.pointerEvents = 'none';
            }

            container.appendChild(answerDiv);
        });
    }

    selectAnswer(answerIndex) {
        const question = this.questions[this.currentQuestionIndex];
        const selectedAnswerText = question.raspunsuri[answerIndex];
        const isCorrect = selectedAnswerText.includes('*');

        // Dacă deja a răspuns și trebuie să aleagă răspunsul corect
        if (this.needsCorrectAnswer) {
            if (isCorrect) {
                // A ales răspunsul corect după ce a greșit
                this.needsCorrectAnswer = false;
                document.getElementById('nextBtn').disabled = false;
                document.getElementById('nextBtn').textContent = this.currentQuestionIndex === this.questions.length - 1 ? 'Finalizează' : 'Următoarea';
                
                // Highlight că a ales corect
                document.querySelectorAll('.answer-option').forEach(option => {
                    option.classList.remove('selected', 'retry-correct');
                });
                document.querySelector(`[data-index="${answerIndex}"]`).classList.add('retry-correct');
            }
            return; // Nu permite alte selecții
        }

        // Primul răspuns la întrebarea curentă
        if (this.hasAnsweredCurrent && this.liveFeedback) {
            return; // Nu permite schimbarea după primul răspuns
        }

        // Elimină selecția anterioară
        document.querySelectorAll('.answer-option').forEach(option => {
            option.classList.remove('selected');
        });

        // Selectează noul răspuns
        const selectedOption = document.querySelector(`[data-index="${answerIndex}"]`);
        selectedOption.classList.add('selected');
        this.userAnswers[this.currentQuestionIndex] = answerIndex;

        // Afișează feedback live
        if (this.liveFeedback) {
            this.showLiveFeedback(answerIndex);
            this.hasAnsweredCurrent = true;
            
            if (!isCorrect) {
                // A greșit - trebuie să aleagă răspunsul corect
                this.needsCorrectAnswer = true;
                this.wrongAnswers.push(this.currentQuestionIndex);
                document.getElementById('nextBtn').disabled = true;
                document.getElementById('nextBtn').textContent = 'Alege răspunsul corect!';
            } else {
                // A răspuns corect din prima
                document.getElementById('nextBtn').disabled = false;
            }
        } else {
            document.getElementById('nextBtn').disabled = false;
        }
        
        // Salvează progresul
        this.saveProgress();
    }

    nextQuestion() {
        if (this.currentQuestionIndex < this.questions.length - 1) {
            this.currentQuestionIndex++;
            this.hasAnsweredCurrent = false;
            this.needsCorrectAnswer = false;
            this.displayCurrentQuestion();
        } else {
            this.completeQuiz();
        }
    }

    prevQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--;
            this.hasAnsweredCurrent = this.userAnswers[this.currentQuestionIndex] !== null;
            this.needsCorrectAnswer = false;
            this.displayCurrentQuestion();
        }
    }

    updateNavigationButtons() {
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');

        // Butonul "Înapoi"
        prevBtn.disabled = this.currentQuestionIndex === 0;

        // Butonul "Următoarea"
        const hasAnswer = this.userAnswers[this.currentQuestionIndex] !== null;
        nextBtn.disabled = !hasAnswer;

        // Schimbă textul butonului pentru ultima întrebare
        if (this.currentQuestionIndex === this.questions.length - 1) {
            nextBtn.textContent = 'Finalizează';
        } else {
            nextBtn.textContent = 'Următoarea';
        }
    }

    completeQuiz() {
        this.calculateScore();
        
        // Salvează rezultatele finale
        this.saveResults();
        
        // Șterge progresul salvat (nu mai e nevoie)
        this.clearSavedProgress(this.currentQuizNumber);
        
        this.showResults();
    }

    calculateScore() {
        this.correctAnswers = 0;
        
        this.questions.forEach((question, index) => {
            const userAnswer = this.userAnswers[index];
            if (userAnswer !== null) {
                const selectedAnswerText = question.raspunsuri[userAnswer];
                
                // Verifică dacă răspunsul conține steluța (*)
                if (selectedAnswerText && selectedAnswerText.includes('*')) {
                    this.correctAnswers++;
                }
            }
        });
    }

    confirmBackToHome() {
        if (confirm('Sigur vrei să te întorci la meniu? Progresul va fi salvat automat.')) {
            this.showQuizSelection();
        }
    }

    showResults() {
        document.getElementById('questionContainer').classList.add('hidden');
        document.getElementById('resultsContainer').classList.remove('hidden');

        const percentage = Math.round((this.correctAnswers / this.questions.length) * 100);
        const finalScoreDiv = document.getElementById('finalScore');
        
        finalScoreDiv.textContent = `${this.correctAnswers}/${this.questions.length} (${percentage}%)`;
        
        // Aplică clasa CSS în funcție de scor
        if (percentage >= 80) {
            finalScoreDiv.className = 'final-score score-excellent';
        } else if (percentage >= 60) {
            finalScoreDiv.className = 'final-score score-good';
        } else {
            finalScoreDiv.className = 'final-score score-poor';
        }

        // Afișează detaliile cu informații despre greșeli
        let message = '';
        if (percentage >= 80) {
            message = 'Felicitări! Ai un scor excelent!';
        } else if (percentage >= 60) {
            message = 'Bun! Dar mai ai puțin de studiat.';
        } else {
            message = 'Ar fi bine să mai studiezi înainte de examen.';
        }

        if (this.wrongAnswers.length > 0) {
            message += ` Ai greșit ${this.wrongAnswers.length} întrebări din prima.`;
        }

        document.getElementById('resultsDetails').textContent = message;
        this.isQuizCompleted = true;
    }

    reviewAnswers() {
        document.getElementById('resultsContainer').classList.add('hidden');
        document.getElementById('questionContainer').classList.remove('hidden');
        
        this.currentQuestionIndex = 0;
        this.displayReviewMode();
    }

    displayReviewMode() {
        const question = this.questions[this.currentQuestionIndex];
        
        // Actualizează informațiile
        document.getElementById('progress').textContent = 
            `Revizuire: ${this.currentQuestionIndex + 1} din ${this.questions.length}`;
        document.getElementById('questionNumber').textContent = `${this.currentQuestionIndex + 1}.`;
        document.getElementById('questionText').textContent = question.intrebare;

        // Afișează răspunsurile cu indicatori de corect/incorect
        const container = document.getElementById('answersContainer');
        container.innerHTML = '';

        question.raspunsuri.forEach((answer, index) => {
            const answerDiv = document.createElement('div');
            answerDiv.className = 'answer-option';
            
            // Elimină steluța din textul afișat
            const cleanAnswer = answer.replace('*', '');
            answerDiv.textContent = cleanAnswer;
            
            const isCorrect = answer.includes('*');
            const wasSelected = this.userAnswers[this.currentQuestionIndex] === index;

            if (isCorrect) {
                answerDiv.classList.add('correct');
            } else if (wasSelected) {
                answerDiv.classList.add('incorrect');
            }

            container.appendChild(answerDiv);
        });

        // Actualizează butoanele pentru modul revizuire
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        
        prevBtn.disabled = this.currentQuestionIndex === 0;
        nextBtn.disabled = false;
        
        if (this.currentQuestionIndex === this.questions.length - 1) {
            nextBtn.textContent = 'Înapoi la rezultate';
        } else {
            nextBtn.textContent = 'Următoarea';
        }

        // Modifică comportamentul butoanelor
        nextBtn.onclick = () => {
            if (this.currentQuestionIndex < this.questions.length - 1) {
                this.currentQuestionIndex++;
                this.displayReviewMode();
            } else {
                this.showResults();
            }
        };

        prevBtn.onclick = () => {
            if (this.currentQuestionIndex > 0) {
                this.currentQuestionIndex--;
                this.displayReviewMode();
            }
        };
    }

    restart() {
        this.currentQuestionIndex = 0;
        this.userAnswers = [];
        this.correctAnswers = 0;
        this.isQuizCompleted = false;
        
        document.getElementById('resultsContainer').classList.add('hidden');
        document.getElementById('questionContainer').classList.add('hidden');
        
        // Restaurează comportamentul normal al butoanelor
        document.getElementById('nextBtn').onclick = null;
        document.getElementById('prevBtn').onclick = null;
        
        this.showQuizSelection();
    }

    showStats() {
        const results = this.getAllResults();
        
        if (results.length === 0) {
            alert('Nu ai terminat încă niciun chestionar!');
            return;
        }

        // Calculează statistici generale
        const totalCorrect = results.reduce((sum, r) => sum + r.correctAnswers, 0);
        const totalQuestions = results.reduce((sum, r) => sum + r.totalQuestions, 0);
        const averagePercentage = Math.round((totalCorrect / totalQuestions) * 100);
        
        let statsHTML = `
            <div class="stats-container">
                <h2>📊 Statistici Generale</h2>
                <div class="overall-stats">
                    <div class="stat-item">
                        <div class="stat-number">${results.length}</div>
                        <div class="stat-label">Chestionare completate</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${totalCorrect}/${totalQuestions}</div>
                        <div class="stat-label">Total răspunsuri corecte</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${averagePercentage}%</div>
                        <div class="stat-label">Media generală</div>
                    </div>
                </div>
                
                <h3>Rezultate pe chestionare:</h3>
                <div class="quiz-results-list">
        `;

        results.sort((a, b) => a.quizNumber - b.quizNumber).forEach(result => {
            const date = new Date(result.completedAt).toLocaleDateString('ro-RO');
            statsHTML += `
                <div class="result-item">
                    <div class="result-quiz">Chestionarul ${result.quizNumber}</div>
                    <div class="result-score">${result.correctAnswers}/${result.totalQuestions} (${result.percentage}%)</div>
                    <div class="result-date">${date}</div>
                </div>
            `;
        });

        statsHTML += `
                </div>
                <div class="stats-controls">
                    <button class="btn btn-primary" onclick="quizApp.showQuizSelection()">Înapoi la chestionare</button>
                </div>
            </div>
        `;

        // Afișează statisticile
        document.getElementById('quizSelectionContainer').innerHTML = statsHTML;
    }

    confirmClearData() {
        if (confirm('Sigur vrei să ștergi toate progresele și rezultatele? Această acțiune nu poate fi anulată!')) {
            this.clearAllData();
            alert('Toate datele au fost șterse!');
            this.showQuizSelection();
        }
    }
}

// Inițializează aplicația când pagina se încarcă
document.addEventListener('DOMContentLoaded', () => {
    new QuizApp();
});
