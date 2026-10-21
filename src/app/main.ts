/**
 * src/app/main.ts - Enterprise EdTech Architecture Entrypoint
 * Orchestrates Feature-Sliced Architecture (FSA), Local-First DB, Tri-Mode, Proctoring,
 * Realtime Multiplayer, Document Parser Worker, and Analytics Engine.
 */

import confetti from 'canvas-confetti';
import { localDB } from '../shared/db/dexie-db';
import { getPreloadedSampleExams, findSampleExamByPin } from '../shared/sample-banks';
import type { Exam, StudyMode, ExamAttempt, ExamAnalyticsReport } from '../shared/types';
import { examStateMachine } from '../features/exam-engine/exam-state-machine';
import { questionNavigator } from '../features/exam-engine/question-navigator';
import { proctoringService } from '../features/proctoring/proctoring-service';
import { documentParserService } from '../features/parser/document-parser';
import { smartReviewEditor } from '../features/parser/smart-review-editor';
import { questionStudio } from '../features/editor/question-studio';
import { aiSenseiDrawer } from '../features/ai-tutor/ai-sensei-drawer';
import { lobbyView } from '../features/lobby/lobby-view';
import { examView } from '../features/study-modes/exam/exam-view';
import { practiceView } from '../features/study-modes/practice/practice-view';
import { flashcardView } from '../features/study-modes/flashcard/flashcard-view';
import { multiplayerRoomService } from '../features/multiplayer/room-service';
import { analyticsService } from '../features/analytics/analytics-service';
import { themeManager } from '../features/theme/theme-manager';
import { shuffleExam } from '../features/exam-engine/exam-shuffle';
import { errorTracker } from '../shared/telemetry/error-tracker';
import { downloadScoreCard } from '../features/analytics/score-card-generator';
import { animeMascot } from '../features/mascot/anime-mascot';
import { guildCardManager } from '../features/gamification/guild-card';
import { classroomManager } from '../features/classroom/classroom-manager';
import { offlineSyncQueue } from '../shared/db/offline-queue';

export class OmniQuizApp {
  private currentExam: Exam | null = null;
  private currentMode: StudyMode = 'exam';
  private pendingExam: Exam | null = null;
  private setupSelectedMode: StudyMode = 'exam';
  private setupSelectedDuration: number = 60;
  private lastSubmittedAttempt: ExamAttempt | null = null;
  private isReviewMode: boolean = false;

  public async bootstrap(): Promise<void> {
    console.log('🚀 [OmniQuiz PRO 2.5] Initializing Enterprise EdTech Architecture...');

    // 0. Initialize Error Telemetry & Theme Appearance System
    errorTracker.init();
    themeManager.init();
    animeMascot.init();
    offlineSyncQueue.init();
    void guildCardManager.syncWithCloud();
    this.setupNetworkMonitoring();

    // 1. Preload Sample Banks into Dexie if empty
    await this.seedInitialDatabases();

    // 2. Initialize Lobby View Hub
    this.initLobby();

    // 3. Set Initial State strictly to IDLE (Waiting for user upload or sample pick)
    this.setIdleState();

    // 4. Check Crash Recovery Session (Non-blocking banner)
    await this.checkCrashRecovery();

    // 5. Bind UI Global Controls & Events
    this.bindGlobalEventListeners();
  }

  /**
   * Seed Sample Banks into Dexie IndexedDB
   */
  private async seedInitialDatabases(): Promise<void> {
    const existing = await localDB.getAllExams();
    if (existing.length === 0) {
      const sampleExams = getPreloadedSampleExams();
      for (const exam of sampleExams) {
        await localDB.saveExam(exam);
      }
      console.log(`✅ [Dexie Local Engine] Seeded ${sampleExams.length} multi-subject sample banks.`);
    }
  }

  /**
   * Initialize Lobby Upload Hub & Handlers
   */
  private initLobby(): void {
    lobbyView.init({
      onFileSelected: async (file: File) => {
        await this.handleFileUpload(file);
      },
      onSampleSelected: async (subjectId: string) => {
        await this.loadSampleExam(subjectId);
      },
      onJoinRoom: async (pin: string, name: string, sbd?: string) => {
        await this.handleJoinOnlineRoom(pin, name, sbd);
      },
    });
  }

  public async loadSampleExam(subjectId: string): Promise<void> {
    const exams = await localDB.getAllExams();
    const match = exams.find(
      (e) =>
        e.id.toLowerCase().includes(subjectId.toLowerCase()) ||
        e.subject.toLowerCase().includes(subjectId.toLowerCase())
    );
    if (match) {
      this.openExamSetupModal(match);
    } else {
      const samples = getPreloadedSampleExams();
      const fallback =
        samples.find((s) => s.id.toLowerCase().includes(subjectId.toLowerCase())) || samples[0];
      if (fallback) {
        await localDB.saveExam(fallback);
        this.openExamSetupModal(fallback);
      }
    }
  }

  public async handleFileUpload(file: File): Promise<void> {
    const loadingModal = document.getElementById('loading-modal');
    const loadingStep = document.getElementById('loading-modal-step');
    const loadingBar = document.getElementById('loading-progress-bar');
    const loadingNum = document.getElementById('loading-progress-num');

    try {
      if (loadingModal) loadingModal.style.display = 'flex';
      if (loadingBar) loadingBar.style.width = '0%';
      if (loadingNum) loadingNum.textContent = '0%';
      if (loadingStep) loadingStep.textContent = 'Đang đọc và phân tích tệp tin...';

      const report = await documentParserService.parseFileWithReport(file, undefined, (pct, status) => {
        if (loadingStep) loadingStep.textContent = status;
        if (loadingBar) loadingBar.style.width = `${pct}%`;
        if (loadingNum) loadingNum.textContent = `${pct}%`;
      });

      if (!report.exam || !report.exam.questions || report.exam.questions.length === 0) {
        throw new Error('Tệp không chứa câu hỏi hợp lệ hoặc định dạng bị lỗi. Vui lòng kiểm tra lại!');
      }

      if (loadingModal) loadingModal.style.display = 'none';

      // Open Azota-style Smart Review & Split-Screen Editor
      smartReviewEditor.open(report, async (verifiedExam) => {
        await localDB.saveExam(verifiedExam);
        this.openExamSetupModal(verifiedExam);
      });
    } catch (err: unknown) {
      if (loadingModal) loadingModal.style.display = 'none';
      if (loadingBar) loadingBar.style.width = '0%';
      if (loadingNum) loadingNum.textContent = '0%';
      const errorMsg =
        err instanceof Error && err.message
          ? err.message
          : 'Tệp không chứa câu hỏi hợp lệ hoặc định dạng bị lỗi. Vui lòng kiểm tra lại!';
      themeManager.showToast(errorMsg);
      alert(errorMsg);
    }
  }

  public async handleJoinOnlineRoom(
    pin: string,
    candidateName: string,
    sbd?: string
  ): Promise<void> {
    const cleanPin = pin.trim().toUpperCase();
    try {
      // 1. Check local Dexie DB for exam matching roomCode or ID
      const allExams = await localDB.getAllExams();
      let matchedExam = allExams.find(
        (e) => (e.roomCode && e.roomCode.toUpperCase() === cleanPin) || e.id === cleanPin
      );

      // 2. Check built-in sample banks (9 standard exams: 101201..109209)
      if (!matchedExam) {
        matchedExam = findSampleExamByPin(cleanPin);
      }

      // If found locally or in sample banks, join directly!
      if (matchedExam) {
        await localDB.saveExam(matchedExam);
        themeManager.showToast(`🎉 Đã tìm thấy phòng thi: ${matchedExam.title} (PIN: ${cleanPin})`);

        // Save student candidate details to session / inputs
        const nameInput = document.getElementById('input-join-name') as HTMLInputElement | null;
        if (nameInput) nameInput.value = candidateName;
        const sbdInput = document.getElementById('input-join-sbd') as HTMLInputElement | null;
        if (sbdInput && sbd) sbdInput.value = sbd;

        this.openExamSetupModal(matchedExam);
        return;
      }

      // 3. Verify PIN and check rate limit against backend API
      try {
        const verifyRes = await fetch(`/api/rooms/${encodeURIComponent(cleanPin)}`);
        if (verifyRes.status === 429) {
          const data = (await verifyRes.json()) as { error?: string; retryAfter?: number };
          const retrySec = data.retryAfter || 60;
          lobbyView.lockForRateLimit(retrySec);
          const errText = data.error || 'Bạn đã nhập sai mã PIN quá nhiều lần. Vui lòng thử lại sau 1 phút!';
          themeManager.showToast(`⛔ ${errText}`);
          alert(`⛔ ${errText}`);
          return;
        }
      } catch {
        // Backend API unreachable or running offline: proceed with realtime or offline fallback
      }

      // 4. Connect to multiplayer realtime room
      const fullName = sbd ? `${candidateName} (SBD: ${sbd})` : candidateName;
      const ok = await multiplayerRoomService.joinRoom(cleanPin, fullName, {
        onParticipantListChange: () => {},
        onExamStarted: (exam) => {
          this.openExamSetupModal(exam);
        },
        onLeaderboardUpdate: () => {},
      });

      if (ok) {
        alert(`Đã tham gia phòng thi PIN: ${cleanPin}! Đang chờ giám thị bắt đầu bài thi...`);
      } else {
        themeManager.showToast('❌ Phòng thi không tồn tại hoặc mã PIN không đúng!');
        alert('❌ Phòng thi không tồn tại hoặc mã PIN không đúng!\n(Bạn có thể thử mã PIN đề mẫu: 101201, 102202, 103203...)');
      }
    } catch (err) {
      alert(`Không thể tham gia phòng thi: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Open Exam Configuration Setup Modal before starting test
   */
  public openExamSetupModal(exam: Exam): void {
    this.pendingExam = exam;
    this.setupSelectedMode = this.currentMode || 'exam';
    this.setupSelectedDuration = exam.durationMinutes || 60;

    const modal = document.getElementById('exam-setup-modal');
    if (!modal) {
      this.loadExam(exam);
      return;
    }

    const titleEl = document.getElementById('setup-exam-title');
    if (titleEl) titleEl.textContent = exam.title;

    const metaEl = document.getElementById('setup-exam-meta');
    if (metaEl) {
      metaEl.textContent = `${exam.questions.length} câu hỏi • Môn: ${exam.subject || 'Tổng hợp'} • Thời lượng: ${exam.durationMinutes || 60} phút`;
    }

    // Active mode card state
    document.querySelectorAll('.setup-mode-card').forEach((card) => {
      const mode = card.getAttribute('data-mode');
      card.classList.toggle('active', mode === this.setupSelectedMode);
    });

    // Active duration chip state
    document.querySelectorAll('.duration-chip').forEach((chip) => {
      const mins = parseInt(chip.getAttribute('data-mins') || '0', 10);
      chip.classList.toggle('active', mins === this.setupSelectedDuration);
    });

    // Duration section visibility
    const durationSection = document.getElementById('setup-duration-section');
    if (durationSection) {
      durationSection.style.display = this.setupSelectedMode === 'exam' ? 'block' : 'none';
    }

    modal.style.display = 'flex';
  }

  /**
   * Set UI to pure IDLE state (waiting for user to upload or choose exam)
   */
  public setIdleState(): void {
    examStateMachine.reset();
    proctoringService.stopProctoring();
    this.currentExam = null;
    this.pendingExam = null;
    this.lastSubmittedAttempt = null;
    this.isReviewMode = false;

    const hideFlt1 = document.getElementById('flt-incorrect');
    if (hideFlt1) hideFlt1.style.display = 'none';

    const examSetupModal = document.getElementById('exam-setup-modal');
    if (examSetupModal) examSetupModal.style.display = 'none';

    const sampleGalleryModal = document.getElementById('sample-gallery-modal');
    if (sampleGalleryModal) sampleGalleryModal.style.display = 'none';

    // Show CBT Studio 2.0 Upload Hub via lobbyView
    lobbyView.show();

    // Hide Mobile Palette FAB & Reset Drawer State
    const fab = document.getElementById('btn-mobile-palette-toggle');
    if (fab) fab.style.display = 'none';

    const paletteDrawer = document.getElementById('palette-section');
    if (paletteDrawer) paletteDrawer.classList.remove('mobile-drawer');

    const paletteBackdrop = document.getElementById('palette-drawer-backdrop');
    if (paletteBackdrop) paletteBackdrop.style.display = 'none';

    const btnClose = document.getElementById('btn-close-palette-drawer');
    if (btnClose) btnClose.style.display = 'none';

    // Hide Stats Bar & Timer
    const statsSection = document.getElementById('stats-section');
    if (statsSection) statsSection.style.display = 'none';

    // Hide Palette Sidebar
    const paletteSection = document.getElementById('palette-section');
    if (paletteSection) paletteSection.style.display = 'none';

    // Hide all question & flashcard containers
    const examContainer = document.getElementById('exam-container');
    if (examContainer) {
      examContainer.style.display = 'none';
      examContainer.innerHTML = '';
    }

    const practiceContainer = document.getElementById('practice-container');
    if (practiceContainer) {
      practiceContainer.style.display = 'none';
      practiceContainer.innerHTML = '';
    }

    const flashcardSection = document.getElementById('flashcard-section');
    if (flashcardSection) {
      flashcardSection.style.display = 'none';
      flashcardSection.innerHTML = '';
    }

    const flashcardContainer = document.getElementById('flashcard-container');
    if (flashcardContainer) {
      flashcardContainer.style.display = 'none';
      flashcardContainer.innerHTML = '';
    }

    const quizContainer = document.getElementById('quiz-container');
    if (quizContainer) {
      quizContainer.style.display = 'none';
      quizContainer.innerHTML = '';
    }

    // Hide Header Active Controls
    const activeControls = document.getElementById('exam-active-controls');
    if (activeControls) activeControls.style.display = 'none';

    const resetBtn = document.getElementById('btn-reset');
    if (resetBtn) resetBtn.style.display = 'none';

    const wrapDuration = document.getElementById('wrap-duration-selector');
    if (wrapDuration) wrapDuration.style.display = 'none';

    // Reset palette grid and progress numbers
    const paletteGrid = document.getElementById('palette-grid');
    if (paletteGrid) paletteGrid.innerHTML = '';

    const totalAnsweredEl = document.getElementById('total-answered');
    if (totalAnsweredEl) totalAnsweredEl.textContent = '0';

    const totalQuestionsEl = document.getElementById('total-questions') || document.getElementById('stat-total-q');
    if (totalQuestionsEl) totalQuestionsEl.textContent = '0';

    const progressBar = document.getElementById('quiz-progress-bar');
    if (progressBar) progressBar.style.width = '0%';

    const badge = document.getElementById('palette-completion-badge');
    if (badge) badge.textContent = '0%';

    // Clean up active proctoring, question navigator hotkeys, and FSM
    proctoringService.stopProctoring();
    questionNavigator.destroy();
    examStateMachine.reset();
    this.currentExam = null;
    this.pendingExam = null;
    this.lastSubmittedAttempt = null;
    this.isReviewMode = false;

    const hideFlt2 = document.getElementById('flt-incorrect');
    if (hideFlt2) hideFlt2.style.display = 'none';

    document.body.classList.remove('quiz-active');
  }

  /**
   * Crash Recovery Checkpoint (Non-blocking local-first recovery banner)
   */
  private async checkCrashRecovery(): Promise<void> {
    try {
      const active = await localDB.loadActiveSession();
      if (active && !active.attempt.isCompleted && active.exam && active.exam.questions.length > 0) {
        const now = Date.now();
        const durationMinutes =
          active.exam.durationMinutes ||
          (active.attempt.totalDurationSeconds ? Math.round(active.attempt.totalDurationSeconds / 60) : 0);
        const sessionStartTime =
          typeof active.attempt.startedAt === 'number'
            ? active.attempt.startedAt
            : Number(active.attempt.startedAt) || now;

        // In Exam mode with a time limit, verify wall-clock expiration
        if (active.attempt.mode === 'exam' && durationMinutes > 0) {
          const absoluteDeadline = sessionStartTime + durationMinutes * 60 * 1000;

          if (now >= absoluteDeadline) {
            console.warn(
              '[CrashRecovery] Bài thi đã hết hạn trong thời gian gián đoạn. Tự động chấm điểm và nộp bài.'
            );
            this.currentExam = active.exam;
            this.currentMode = active.attempt.mode;

            await examStateMachine.recoverExpiredSession(active.exam, active.attempt, {
              onStateChange: (state) => this.handleStateChange(state),
              onTimerTick: (timeRemaining, isWarning, isUnlimited) =>
                this.updateTimerDisplay(timeRemaining, isWarning, isUnlimited),
              onAnswerChange: (qIdx) => {
                this.updateQuestionPalette(qIdx);
                this.updateHeaderProgress();
              },
              onAutoSaved: () => this.showAutoSaveIndicator(),
              onExamSubmitted: (attempt) => this.handleExamSubmitted(attempt),
            });

            themeManager.showToast('⚠️ Bài thi đã hết thời gian làm bài trong lúc gián đoạn và đã được nộp tự động.');
            return;
          }

          // If still within deadline, recalculate exact wall-clock remaining time
          const accurateRemaining = Math.max(0, Math.floor((absoluteDeadline - now) / 1000));
          active.attempt.timeRemainingSeconds = accurateRemaining;
        }

        const banner = document.getElementById('recovery-banner');
        const titleEl = document.getElementById('recovery-exam-title');
        if (titleEl) {
          titleEl.textContent = `"${active.exam.title}" (${active.exam.questions.length} câu)`;
        }
        if (banner) {
          banner.style.display = 'flex';

          const btnResume = document.getElementById('btn-recovery-resume');
          btnResume?.addEventListener(
            'click',
            () => {
              banner.style.display = 'none';
              this.currentMode = active.attempt.mode;
              this.loadExam(active.exam, active.attempt);
            },
            { once: true }
          );

          const btnDiscard = document.getElementById('btn-recovery-discard');
          btnDiscard?.addEventListener(
            'click',
            async () => {
              banner.style.display = 'none';
              await localDB.clearActiveSession();
            },
            { once: true }
          );
        }
      }
    } catch (err: unknown) {
      console.warn('[Recovery Check Warning]', err);
    }
  }

  /**
   * Load and render selected exam
   */
  public loadExam(exam: Exam, recoveredAttempt?: ExamAttempt): void {
    if (!exam || !exam.questions || exam.questions.length === 0) {
      alert('Đề thi không có câu hỏi hợp lệ!');
      return;
    }

    this.currentExam = exam;
    this.updateExamHeaderInfo(exam);

    // Hide Upload Section via lobbyView
    lobbyView.hide();

    // Show Mobile Palette FAB if on small screens
    const fab = document.getElementById('btn-mobile-palette-toggle');
    if (fab && window.innerWidth <= 960) {
      fab.style.display = 'inline-flex';
    }

    // Hide Recovery Banner
    const recoveryBanner = document.getElementById('recovery-banner');
    if (recoveryBanner) recoveryBanner.style.display = 'none';

    // Show Stats Section
    const statsSection = document.getElementById('stats-section');
    if (statsSection) statsSection.style.display = 'block';

    // Show Palette Section
    const paletteSection = document.getElementById('palette-section');
    if (paletteSection) paletteSection.style.display = 'block';

    // Show Header Active Controls
    const activeControls = document.getElementById('exam-active-controls');
    if (activeControls) activeControls.style.display = 'inline-flex';

    const resetBtn = document.getElementById('btn-reset');
    if (resetBtn) resetBtn.style.display = 'inline-flex';

    const modeSelect = document.getElementById('mode-selector') as HTMLSelectElement | null;
    if (modeSelect) {
      modeSelect.value = this.currentMode;
    }

    const wrapDuration = document.getElementById('wrap-duration-selector');
    if (wrapDuration) {
      wrapDuration.style.display = this.currentMode === 'exam' ? 'inline-flex' : 'none';
    }

    document.body.classList.add('quiz-active');

    this.startStudySession(recoveredAttempt);
  }

  /**
   * Start study session according to currentMode (Exam, Practice, Flashcard)
   */
  private startStudySession(recoveredAttempt?: ExamAttempt): void {
    if (!this.currentExam) return;

    const examContainer = document.getElementById('exam-container');
    const practiceContainer = document.getElementById('practice-container');
    const flashcardSection = document.getElementById('flashcard-section');
    const flashcardDeck = document.getElementById('flashcard-deck-container') || flashcardSection;

    if (examContainer) {
      examContainer.style.display = this.currentMode === 'exam' ? 'block' : 'none';
    }
    if (practiceContainer) {
      practiceContainer.style.display = this.currentMode === 'practice' ? 'block' : 'none';
    }
    if (flashcardSection) {
      flashcardSection.style.display = this.currentMode === 'flashcard' ? 'block' : 'none';
    }

    // Start State Machine
    examStateMachine.startSession(
      this.currentExam,
      this.currentMode,
      {
        onStateChange: (state) => this.handleStateChange(state),
        onTimerTick: (timeRemaining, isWarning, isUnlimited) =>
          this.updateTimerDisplay(timeRemaining, isWarning, isUnlimited),
        onAnswerChange: (qIdx) => {
          this.updateQuestionPalette(qIdx);
          this.updateHeaderProgress();
        },
        onAutoSaved: () => this.showAutoSaveIndicator(),
        onExamSubmitted: (attempt) => this.handleExamSubmitted(attempt),
      },
      recoveredAttempt
    );

    // Initialize Mode View
    if (this.currentMode === 'exam') {
      const targetId = examContainer ? examContainer.id : 'exam-container';
      examView.init(this.currentExam, targetId);
      this.initProctoring();
    } else if (this.currentMode === 'practice') {
      const targetId = practiceContainer ? practiceContainer.id : 'practice-container';
      practiceView.init(this.currentExam, targetId);
      proctoringService.stopProctoring();
    } else if (this.currentMode === 'flashcard') {
      const targetId = flashcardDeck ? flashcardDeck.id : 'flashcard-deck-container';
      flashcardView.init(this.currentExam, targetId);
      proctoringService.stopProctoring();
    }

    this.renderQuestionPalette();
    this.updateHeaderProgress();
  }

  /**
   * CBT Proctoring Initialization
   */
  private initProctoring(): void {
    animeMascot.onExamModeStart();
    proctoringService.startProctoring({
      onTier1Warning: (violation) => {
        animeMascot.onTabSwitchWarning(1);
        this.showProctoringBanner(violation.detail);
      },
      onTier2Modal: (violation, resumeCallback) => {
        animeMascot.onTabSwitchWarning(2);
        this.showProctoringModal(violation.detail, resumeCallback);
      },
      onTier3Disqualified: () => {
        animeMascot.speak('🚫 Giám thị Sensei: Bạn đã vi phạm quy chế 3 lần và bị đình chỉ làm bài!', 8000, 'serious');
        alert('CẢNH BÁO VI PHẠM: Bạn đã vi phạm quy chế thi 3 lần. Bài thi sẽ bị thu và khóa kết quả!');
        examStateMachine.disqualify();
      },
      onTimerPause: () => examStateMachine.pause(true),
      onTimerResume: () => examStateMachine.resume(),
    });
  }

  /**
   * Render Question Map / Palette
   */
  private renderQuestionPalette(): void {
    const paletteGrid = document.getElementById('palette-grid');
    if (!paletteGrid || !this.currentExam) return;

    const attempt = examStateMachine.getAttempt() || this.lastSubmittedAttempt;
    const answers = attempt?.answers || {};
    const flagged = attempt?.flaggedQuestions || [];

    paletteGrid.innerHTML = this.currentExam.questions
      .map((q, idx) => {
        const isAnswered = answers[idx] && answers[idx].length > 0;
        const isFlagged = flagged.includes(idx);

        let stateClass = '';
        if (this.isReviewMode && attempt) {
          const userAns = answers[idx] || [];
          const corrAns = q.correctAnswer || [];
          const isCorrect =
            userAns.length === corrAns.length && userAns.every((a) => corrAns.includes(a));
          if (isCorrect) stateClass = 'answered-exam correct-exam';
          else if (userAns.length > 0) stateClass = 'wrong-exam';
          else stateClass = 'unattempted-exam';
        } else {
          if (isAnswered) stateClass = 'answered-exam';
          if (isFlagged) stateClass += ' flagged';
        }

        if (idx === 0) stateClass += ' active-current';

        return `
          <button type="button" class="palette-btn ${stateClass}" id="palette-btn-${idx}" data-idx="${idx}" title="Câu ${idx + 1}">
            ${idx + 1}
          </button>
        `;
      })
      .join('');

    paletteGrid.querySelectorAll('.palette-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx') || '0', 10);
        questionNavigator.setIndex(idx);

        paletteGrid.querySelectorAll('.palette-btn').forEach((b) => b.classList.remove('active-current'));
        btn.classList.add('active-current');

        const qCard = document.getElementById(`q-card-${idx}`);
        if (qCard) {
          qCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // Auto close mobile drawer upon selection
        if (window.innerWidth <= 960) {
          const paletteDrawer = document.getElementById('palette-section');
          if (paletteDrawer) paletteDrawer.classList.remove('mobile-drawer');
          const backdrop = document.getElementById('palette-drawer-backdrop');
          if (backdrop) backdrop.style.display = 'none';
          const btnClose = document.getElementById('btn-close-palette-drawer');
          if (btnClose) btnClose.style.display = 'none';
        }
      });
    });

    this.syncQuestionPaletteAndCounters();
  }

  private updateQuestionPalette(qIdx: number): void {
    const btn = document.getElementById(`palette-btn-${qIdx}`);
    if (btn) {
      const attempt = examStateMachine.getAttempt();
      const ans = attempt?.answers[qIdx] || [];
      const isFlagged = attempt?.flaggedQuestions.includes(qIdx) || false;
      btn.classList.toggle('answered-exam', ans.length > 0);
      btn.classList.toggle('flagged', isFlagged);
    }
    this.syncQuestionPaletteAndCounters();
  }

  public syncQuestionPaletteAndCounters(): void {
    if (!this.currentExam) return;

    const attempt = examStateMachine.getAttempt() || this.lastSubmittedAttempt;
    const answers = attempt?.answers || {};
    const flagged = attempt?.flaggedQuestions || [];
    const total = this.currentExam.questions.length;

    const answeredCount = Object.keys(answers).filter(
      (k) => (answers[Number(k)]?.length ?? 0) > 0
    ).length;
    const flaggedCount = flagged.length;
    const unansweredCount = Math.max(0, total - answeredCount);
    const pct = total > 0 ? Math.round((answeredCount / total) * 100) : 0;

    // Review mode wrong questions count
    let wrongCount = 0;
    if (this.isReviewMode && attempt) {
      this.currentExam.questions.forEach((q, idx) => {
        const userAns = answers[idx] || [];
        const corrAns = q.correctAnswer || [];
        const isCorrect =
          userAns.length === corrAns.length && userAns.every((a) => corrAns.includes(a));
        if (!isCorrect) wrongCount++;
      });
    }

    // 1. Update Filter Chips
    const fltAll = document.getElementById('flt-all');
    if (fltAll) fltAll.textContent = `Tất cả (${total})`;

    const fltAnswered = document.getElementById('flt-answered');
    if (fltAnswered) fltAnswered.textContent = `Đã làm (${answeredCount})`;

    const fltFlagged = document.getElementById('flt-flagged');
    if (fltFlagged) fltFlagged.textContent = `Cần xem 🚩 (${flaggedCount})`;

    const fltUnanswered = document.getElementById('flt-unanswered');
    if (fltUnanswered) fltUnanswered.textContent = `Chưa làm (${unansweredCount})`;

    const fltIncorrect = document.getElementById('flt-incorrect');
    if (fltIncorrect) {
      fltIncorrect.textContent = `❌ Câu sai (${wrongCount})`;
      fltIncorrect.style.display = this.isReviewMode ? 'inline-block' : 'none';
    }

    // 2. Update Header & Sticky Stats
    const totalAnsweredEl = document.getElementById('total-answered');
    if (totalAnsweredEl) totalAnsweredEl.textContent = `${answeredCount}`;

    const totalQuestionsEl =
      document.getElementById('total-questions') || document.getElementById('stat-total-q');
    if (totalQuestionsEl) totalQuestionsEl.textContent = `${total}`;

    const progressBar = document.getElementById('quiz-progress-bar');
    if (progressBar) progressBar.style.width = `${pct}%`;

    const badge = document.getElementById('palette-completion-badge');
    if (badge) badge.textContent = `${pct}%`;

    const progressCircle = document.getElementById('palette-progress-circle') as SVGCircleElement | null;
    if (progressCircle) {
      const offset = 81.68 - (81.68 * pct) / 100;
      progressCircle.style.strokeDashoffset = `${offset}`;
    }

    // 3. Update Submit Confirmation Modal Matrix (if modal is opened)
    const mAns = document.getElementById('matrix-count-answered');
    if (mAns) mAns.textContent = `${answeredCount}`;

    const mPct = document.getElementById('matrix-percent-answered');
    if (mPct) mPct.textContent = `${pct}%`;

    const mUn = document.getElementById('matrix-count-unanswered');
    if (mUn) mUn.textContent = `${unansweredCount}`;

    const mFlag = document.getElementById('matrix-count-flagged');
    if (mFlag) mFlag.textContent = `${flaggedCount}`;

    const unWarn = document.getElementById('confirm-unanswered-warning');
    const unHighlight = document.getElementById('confirm-unanswered-highlight');
    if (unWarn && unHighlight) {
      if (unansweredCount > 0) {
        unHighlight.textContent = `${unansweredCount}`;
        unWarn.style.display = 'block';
      } else {
        unWarn.style.display = 'none';
      }
    }
  }

  private updateHeaderProgress(): void {
    this.syncQuestionPaletteAndCounters();
  }

  /**
   * Update Timer UI Display
   */
  private updateTimerDisplay(seconds: number, isWarning: boolean, isUnlimited: boolean = false): void {
    const timerEl = document.getElementById('txt-timer') || document.getElementById('time-remaining');
    if (!timerEl) return;

    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const formatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    if (isUnlimited) {
      timerEl.textContent = `∞ ${formatted}`;
      timerEl.classList.remove('timer-warning');
      timerEl.title = 'Chế độ làm bài không giới hạn thời gian (Đang đếm tiến)';
    } else {
      timerEl.textContent = formatted;
      timerEl.title = 'Thời gian làm bài còn lại';
      timerEl.classList.toggle('timer-warning', isWarning);
      if (seconds === 300) {
        animeMascot.onTimeRunningLow();
      }
    }
  }

  /**
   * Handle Exam Submitted -> Show Results & Analytics
   */
  private handleExamSubmitted(attempt: ExamAttempt): void {
    proctoringService.stopProctoring();
    this.lastSubmittedAttempt = attempt;

    if (!this.currentExam) return;
    const report = analyticsService.generateReport(this.currentExam, attempt);

    // Trigger celebration confetti if score >= 80%
    if (report.scorePercentage >= 80) {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
      });
    }

    // Award Gamification EXP & Mascot speech
    const { bonusExp, leveledUp } = guildCardManager.recordExamCompleted(report.scorePercentage);
    if (report.scorePercentage >= 80) {
      animeMascot.speak(`👑 Xuất sắc Senpai ơi! Đạt ${report.scorePercentage}% (+${bonusExp} XP)! Sensei cực kỳ tự hào! 🌸`, 7000, 'proud');
    } else {
      animeMascot.speak(`💪 Cố gắng lắm Senpai! Nhận ngay +${bonusExp} XP! Lần sau sẽ đột phá hơn nhé! ✨`, 6000, 'happy');
    }

    if (leveledUp) {
      setTimeout(() => {
        animeMascot.speak(`🎉 THĂNG CẤP! Chúc mừng Senpai đạt Level ${guildCardManager.getProfile().level}! 🌟`, 6000, 'proud');
      }, 7500);
    }

    this.showResultsModal(report);
  }

  private showResultsModal(report: ExamAnalyticsReport): void {
    const modal = document.getElementById('results-modal') || document.getElementById('summary-modal');
    if (!modal) return;

    // Anime Hunter RPG Victory Rank Badge & EXP Notification
    const rankEl = document.getElementById('modal-anime-rank-badge');
    const pct = report.scorePercentage;
    let rankBadge = 'D';
    let rankColor = '#94a3b8';
    let rankTitle = '🌱 Học Viên Tập Sự (Rank D)';
    if (pct >= 90) {
      rankBadge = 'S';
      rankColor = '#fbbf24';
      rankTitle = '👑 Huyền Thoại Tri Thức (S-Rank)';
    } else if (pct >= 80) {
      rankBadge = 'A';
      rankColor = '#a855f7';
      rankTitle = '⚡ Đại Pháp Sư Luyện Đề (A-Rank)';
    } else if (pct >= 65) {
      rankBadge = 'B';
      rankColor = '#00f0ff';
      rankTitle = '⚔️ Hiệp Sĩ Khảo Thí (B-Rank)';
    } else if (pct >= 50) {
      rankBadge = 'C';
      rankColor = '#22c55e';
      rankTitle = '🛡️ Vệ Binh Ôn Thi (C-Rank)';
    }

    if (rankEl) {
      rankEl.innerHTML = `
        <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(15, 23, 42, 0.7); border: 1.5px solid ${rankColor}; padding: 6px 16px; border-radius: 999px; margin-bottom: 8px; box-shadow: 0 0 15px ${rankColor}44;">
          <span style="background: ${rankColor}; color: #090d16; font-weight: 900; font-size: 0.95rem; width: 26px; height: 26px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;">${rankBadge}</span>
          <strong style="color: ${rankColor}; font-size: 0.92rem;">${rankTitle}</strong>
        </div>
      `;
    }

    const scoreCircle = document.getElementById('modal-score-num') || document.getElementById('modal-score');
    if (scoreCircle) scoreCircle.textContent = `${report.scorePercentage}`;

    const txtCorrect = document.getElementById('stat-modal-correct') || document.getElementById('modal-correct');
    if (txtCorrect) txtCorrect.textContent = `${report.correctCount}`;

    const txtWrong = document.getElementById('stat-modal-wrong') || document.getElementById('modal-incorrect');
    if (txtWrong) txtWrong.textContent = `${report.wrongCount}`;

    const txtUnattempted = document.getElementById('modal-unattempted');
    if (txtUnattempted) txtUnattempted.textContent = `${report.unansweredCount}`;

    const txtTime = document.getElementById('stat-modal-time') || document.getElementById('modal-pacing');
    if (txtTime) {
      txtTime.textContent = report.averageTimePerQuestion > 0
        ? `${Math.round(report.averageTimePerQuestion)}s/câu`
        : '--';
    }

    const violationsEl = document.getElementById('modal-violations');
    if (violationsEl) {
      violationsEl.textContent = `${report.violations.length}`;
      const boxViolations = document.getElementById('modal-box-violations');
      if (boxViolations) boxViolations.style.display = report.violations.length > 0 ? 'block' : 'none';
    }

    // Render Radar Chart
    const radarCanvas = document.getElementById('radar-canvas') as HTMLCanvasElement | null;
    if (radarCanvas) {
      analyticsService.renderRadarChart(radarCanvas, report.subjectRadar);
    }

    // Render Time Distribution Chart
    const timeCanvas = document.getElementById('time-dist-canvas') as HTMLCanvasElement | null;
    if (timeCanvas) {
      analyticsService.renderTimeDistributionChart(timeCanvas, report.timeDistribution);
    }

    modal.style.display = 'flex';
  }

  /**
   * UI Binding
   */
  private bindGlobalEventListeners(): void {
    // Exam Setup Modal Bindings (Mode Cards, Duration Chips & CTA)
    document.querySelectorAll('.setup-mode-card').forEach((card) => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.setup-mode-card').forEach((c) => c.classList.remove('active'));
        card.classList.add('active');
        const mode = (card.getAttribute('data-mode') || 'exam') as StudyMode;
        this.setupSelectedMode = mode;

        const durationSection = document.getElementById('setup-duration-section');
        if (durationSection) {
          durationSection.style.display = mode === 'exam' ? 'block' : 'none';
        }
      });
    });

    document.querySelectorAll('.duration-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.duration-chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        const mins = parseInt(chip.getAttribute('data-mins') || '60', 10);
        this.setupSelectedDuration = mins;
      });
    });

    const closeSetupModal = (): void => {
      const modal = document.getElementById('exam-setup-modal');
      if (modal) modal.style.display = 'none';
    };

    document.getElementById('btn-close-setup-modal')?.addEventListener('click', closeSetupModal);
    document.getElementById('btn-cancel-setup')?.addEventListener('click', closeSetupModal);

    const setupModal = document.getElementById('exam-setup-modal');
    setupModal?.addEventListener('click', (e) => {
      if (e.target === setupModal) closeSetupModal();
    });

    document.getElementById('btn-start-exam-session')?.addEventListener('click', () => {
      closeSetupModal();
      if (this.pendingExam) {
        this.currentMode = this.setupSelectedMode;
        this.pendingExam.durationMinutes = this.setupSelectedDuration;

        const shuffleQuestions =
          (document.getElementById('setup-shuffle-questions') as HTMLInputElement | null)?.checked ?? false;
        const shuffleOptions =
          (document.getElementById('setup-shuffle-options') as HTMLInputElement | null)?.checked ?? false;

        const preparedExam = shuffleExam(this.pendingExam, shuffleQuestions, shuffleOptions);
        this.loadExam(preparedExam);
      }
    });

    // Mode Switcher buttons
    document.querySelectorAll('[data-study-mode]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const mode = target.getAttribute('data-study-mode') as StudyMode;
        if (mode && mode !== this.currentMode) {
          document.querySelectorAll('[data-study-mode]').forEach((b) => b.classList.remove('active'));
          target.classList.add('active');
          this.currentMode = mode;
          if (this.currentExam) {
            this.startStudySession();
          }
        }
      });
    });

    // Mode Selector Select dropdown
    const modeSelect = document.getElementById('mode-selector') as HTMLSelectElement | null;
    if (modeSelect) {
      modeSelect.addEventListener('change', () => {
        const mode = modeSelect.value as StudyMode;
        if (['exam', 'practice', 'flashcard'].includes(mode)) {
          this.currentMode = mode;
          const wrapDuration = document.getElementById('wrap-duration-selector');
          if (wrapDuration) {
            wrapDuration.style.display = mode === 'exam' ? 'inline-flex' : 'none';
          }
          if (this.currentExam) {
            this.startStudySession();
          }
        }
      });
    }

    // Duration Selector
    const durationSelect = document.getElementById('duration-selector') as HTMLSelectElement | null;
    if (durationSelect) {
      durationSelect.addEventListener('change', () => {
        const mins = parseInt(durationSelect.value, 10);
        if (this.currentExam && mins > 0) {
          this.currentExam.durationMinutes = mins;
          const attempt = examStateMachine.getAttempt();
          if (attempt) {
            attempt.timeRemainingSeconds = mins * 60;
            attempt.totalDurationSeconds = mins * 60;
          }
        }
      });
    }

    // Palette Filter Chips Handling (All, Answered, Flagged, Unanswered, Incorrect)
    const filterPalette = (filterType: 'all' | 'answered' | 'flagged' | 'unanswered' | 'incorrect') => {
      document.querySelectorAll('.filter-chip').forEach((c) => c.classList.remove('active'));
      const activeChip = document.getElementById(`flt-${filterType}`);
      activeChip?.classList.add('active');

      const attempt = examStateMachine.getAttempt() || this.lastSubmittedAttempt;
      const answers = attempt?.answers || {};
      const flagged = attempt?.flaggedQuestions || [];

      document.querySelectorAll<HTMLElement>('.palette-btn').forEach((btn) => {
        const idx = parseInt(btn.getAttribute('data-idx') || '0', 10);
        const hasAns = answers[idx] && answers[idx]!.length > 0;
        const isFlag = flagged.includes(idx);

        let visible = true;
        if (filterType === 'answered') {
          visible = Boolean(hasAns);
        } else if (filterType === 'flagged') {
          visible = Boolean(isFlag);
        } else if (filterType === 'unanswered') {
          visible = !hasAns;
        } else if (filterType === 'incorrect') {
          if (this.currentExam && this.currentExam.questions[idx]) {
            const corrAns = this.currentExam.questions[idx]!.correctAnswer || [];
            const userAns = answers[idx] || [];
            const isCorrect = userAns.length === corrAns.length && userAns.every((a) => corrAns.includes(a));
            visible = !isCorrect;
          }
        }
        btn.style.display = visible ? 'inline-flex' : 'none';
      });
    };

    document.getElementById('flt-all')?.addEventListener('click', () => filterPalette('all'));
    document.getElementById('flt-answered')?.addEventListener('click', () => filterPalette('answered'));
    document.getElementById('flt-flagged')?.addEventListener('click', () => filterPalette('flagged'));
    document.getElementById('flt-unanswered')?.addEventListener('click', () => filterPalette('unanswered'));
    document.getElementById('flt-incorrect')?.addEventListener('click', () => filterPalette('incorrect'));

    // Submit Exam Buttons & Confirmation Modal Flow
    const showSubmitConfirmationModal = (): void => {
      this.syncQuestionPaletteAndCounters();
      const modal = document.getElementById('submit-confirm-modal');
      if (modal) {
        modal.style.display = 'flex';
      } else {
        const ok = window.confirm('Bạn có chắc chắn muốn nộp bài thi ngay bây giờ?');
        if (ok) void doSubmitExam();
      }
    };

    const doSubmitExam = async (): Promise<void> => {
      const confirmModal = document.getElementById('submit-confirm-modal');
      if (confirmModal) confirmModal.style.display = 'none';

      let attempt = await examStateMachine.submit();
      if (!attempt) {
        const existing = examStateMachine.getAttempt();
        if (existing && this.currentExam) {
          attempt = existing;
          attempt.isCompleted = true;
          attempt.submittedAt = Date.now();
          await localDB.saveAttempt(attempt);
          this.handleExamSubmitted(attempt);
        } else if (this.currentExam) {
          const newAttempt: ExamAttempt = {
            id: `attempt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            examId: this.currentExam.id,
            examTitle: this.currentExam.title,
            mode: this.currentMode,
            startedAt: Date.now() - 60000,
            submittedAt: Date.now(),
            timeRemainingSeconds: 0,
            totalDurationSeconds: (this.currentExam.durationMinutes || 60) * 60,
            answers: {},
            flaggedQuestions: [],
            eliminatedOptions: {},
            timeSpentPerQuestion: {},
            score: 0,
            accuracy: 0,
            isCompleted: true,
            violations: [],
          };
          this.handleExamSubmitted(newAttempt);
        }
      }
    };

    document.getElementById('btn-submit-exam')?.addEventListener('click', showSubmitConfirmationModal);
    document.getElementById('finish-btn')?.addEventListener('click', showSubmitConfirmationModal);
    document.getElementById('txt-btn-submit-aside')?.addEventListener('click', showSubmitConfirmationModal);
    document.getElementById('btn-cancel-submit')?.addEventListener('click', () => {
      const modal = document.getElementById('submit-confirm-modal');
      if (modal) modal.style.display = 'none';
    });
    document.getElementById('btn-proceed-submit')?.addEventListener('click', () => {
      void doSubmitExam();
    });

    // Reset Button -> Return to pure IDLE state
    document.getElementById('btn-reset')?.addEventListener('click', () => {
      const confirmReset = window.confirm('Bạn có muốn kết thúc bài thi và quay về giao diện chọn đề thi không?');
      if (confirmReset) {
        this.setIdleState();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });

    // Mobile Question Palette Drawer controls (<960px)
    const fab = document.getElementById('btn-mobile-palette-toggle');
    const paletteSection = document.getElementById('palette-section');
    const paletteBackdrop = document.getElementById('palette-drawer-backdrop');
    const btnClosePalette = document.getElementById('btn-close-palette-drawer');

    const openPaletteDrawer = () => {
      if (paletteSection) paletteSection.classList.add('mobile-drawer');
      if (paletteBackdrop) paletteBackdrop.style.display = 'block';
      if (btnClosePalette) btnClosePalette.style.display = 'inline-block';
    };

    const closePaletteDrawer = () => {
      if (paletteSection) paletteSection.classList.remove('mobile-drawer');
      if (paletteBackdrop) paletteBackdrop.style.display = 'none';
      if (btnClosePalette) btnClosePalette.style.display = 'none';
    };

    fab?.addEventListener('click', openPaletteDrawer);
    paletteBackdrop?.addEventListener('click', closePaletteDrawer);
    btnClosePalette?.addEventListener('click', closePaletteDrawer);

    // Modal Close Buttons
    const closeModal = (): void => {
      const modal = document.getElementById('results-modal') || document.getElementById('summary-modal');
      if (modal) modal.style.display = 'none';
    };

    // Review Exam Detailed Breakdown Handler
    const reviewExamHandler = (): void => {
      closeModal();
      if (!this.lastSubmittedAttempt || !this.currentExam) return;

      this.isReviewMode = true;

      const examContainer = document.getElementById('exam-container');
      const practiceContainer = document.getElementById('practice-container');
      const flashcardSection = document.getElementById('flashcard-section');

      if (this.currentMode === 'practice') {
        if (practiceContainer) practiceContainer.style.display = 'block';
        if (examContainer) examContainer.style.display = 'none';
        if (flashcardSection) flashcardSection.style.display = 'none';
        practiceView.render();
      } else {
        if (examContainer) examContainer.style.display = 'block';
        if (practiceContainer) practiceContainer.style.display = 'none';
        if (flashcardSection) flashcardSection.style.display = 'none';
        examView.renderReviewMode(this.lastSubmittedAttempt);
      }

      this.renderQuestionPalette();
      this.syncQuestionPaletteAndCounters();

      themeManager.showToast('📖 Đang xem lại bài làm chi tiết (Tô xanh đáp án đúng, tô đỏ đáp án sai)');
      animeMascot.speak('💡 Sensei đã mở toàn bộ lời giải chi tiết và đáp án cho bạn rồi nhé!', 6000, 'proud');

      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    document.getElementById('txt-modal-review')?.addEventListener('click', reviewExamHandler);

    document.getElementById('btn-modal-close')?.addEventListener('click', closeModal);
    document.getElementById('btn-close-summary-modal')?.addEventListener('click', closeModal);

    const summaryModal = document.getElementById('results-modal') || document.getElementById('summary-modal');
    summaryModal?.addEventListener('click', (e) => {
      if (e.target === summaryModal) closeModal();
    });

    // Global Escape Key to close all modals and drawers
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal();
        closePaletteDrawer();
        const submitModal = document.getElementById('submit-confirm-modal');
        if (submitModal) submitModal.style.display = 'none';
        const setupModal = document.getElementById('exam-setup-modal');
        if (setupModal) setupModal.style.display = 'none';
        const galleryModal = document.getElementById('sample-gallery-modal');
        if (galleryModal) galleryModal.style.display = 'none';
        const toolsModal = document.getElementById('tools-modal');
        if (toolsModal) toolsModal.style.display = 'none';
        aiSenseiDrawer.close();
        questionStudio.close();
      }
    });

    // Results Modal "Làm bài mới" -> Return to IDLE state
    document.getElementById('txt-modal-new-quiz')?.addEventListener('click', () => {
      closeModal();
      this.setIdleState();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Results Modal "Luyện lại câu sai" / "Retake"
    document.getElementById('txt-modal-retake')?.addEventListener('click', () => {
      closeModal();
      if (this.currentExam) {
        this.loadExam(this.currentExam);
      }
    });

    // Export PDF Buttons
    const exportPdfHandler = (): void => {
      if (this.currentExam) {
        const attempt = examStateMachine.getAttempt() || this.lastSubmittedAttempt;
        const report = attempt ? analyticsService.generateReport(this.currentExam, attempt) : undefined;
        analyticsService.exportExamToPDF(this.currentExam, report);
      }
    };
    document.getElementById('btn-export-pdf')?.addEventListener('click', exportPdfHandler);
    document.getElementById('txt-modal-export')?.addEventListener('click', exportPdfHandler);

    // Export CSV Gradebook
    document.getElementById('btn-export-csv')?.addEventListener('click', () => {
      if (this.currentExam) {
        const attempt = examStateMachine.getAttempt() || this.lastSubmittedAttempt;
        if (attempt) {
          const report = analyticsService.generateReport(this.currentExam, attempt);
          analyticsService.exportCSVGradebook(report);
        }
      }
    });

    // Viral Score Card Certificate Generator (OG 1200x630)
    document.getElementById('btn-export-scorecard')?.addEventListener('click', async () => {
      if (this.currentExam) {
        const attempt = examStateMachine.getAttempt() || this.lastSubmittedAttempt;
        if (attempt) {
          const report = analyticsService.generateReport(this.currentExam, attempt);
          const candidateName =
            (document.getElementById('input-join-name') as HTMLInputElement | null)?.value.trim() ||
            'Thí sinh tự do';
          themeManager.showToast('🎨 Đang kết xuất thẻ điểm vinh danh...');
          await downloadScoreCard(this.currentExam, attempt, report, candidateName);
        }
      }
    });

    // Multiplayer PIN Room Creation
    const createRoomHandler = async (): Promise<void> => {
      if (!this.currentExam) {
        alert('Vui lòng chọn hoặc tải lên một đề thi trước khi tạo phòng thi!');
        return;
      }
      const hostName = prompt('Nhập tên của bạn (Giáo viên / Host):', 'Thầy Giáo') || 'Giáo viên';
      const pin = await multiplayerRoomService.createRoom(hostName, this.currentExam, {
        onParticipantListChange: () => {},
        onExamStarted: (ex) => this.loadExam(ex),
        onLeaderboardUpdate: () => {},
      });
      this.showRoomShareModal(pin, this.currentExam.title);
    };
    document.getElementById('btn-create-room')?.addEventListener('click', createRoomHandler);
    document.getElementById('btn-tools-host-room')?.addEventListener('click', createRoomHandler);

    // Question Studio Triggers (Hero Button & Tools Modal)
    const openQuestionStudioHandler = (): void => {
      const toolsModal = document.getElementById('tools-modal');
      if (toolsModal) toolsModal.style.display = 'none';
      questionStudio.open(this.currentExam, (updatedExam) => {
        this.openExamSetupModal(updatedExam);
      });
    };
    document.getElementById('btn-open-studio-hero')?.addEventListener('click', openQuestionStudioHandler);
    document.getElementById('btn-tools-open-studio')?.addEventListener('click', openQuestionStudioHandler);

    // History Modal
    document.getElementById('btn-tools-history')?.addEventListener('click', () => {
      const toolsModal = document.getElementById('tools-modal');
      if (toolsModal) toolsModal.style.display = 'none';
      const historyModal = document.getElementById('history-modal');
      if (historyModal) historyModal.style.display = 'flex';
    });
    document.getElementById('btn-close-history')?.addEventListener('click', () => {
      const historyModal = document.getElementById('history-modal');
      if (historyModal) historyModal.style.display = 'none';
    });
    document.getElementById('btn-history-modal-close')?.addEventListener('click', () => {
      const historyModal = document.getElementById('history-modal');
      if (historyModal) historyModal.style.display = 'none';
    });

    // Leaderboard Modal
    document.getElementById('btn-tools-leaderboard')?.addEventListener('click', () => {
      const toolsModal = document.getElementById('tools-modal');
      if (toolsModal) toolsModal.style.display = 'none';
      const lbModal = document.getElementById('room-leaderboard-modal');
      if (lbModal) lbModal.style.display = 'flex';
    });
    document.getElementById('btn-close-leaderboard-modal')?.addEventListener('click', () => {
      const lbModal = document.getElementById('room-leaderboard-modal');
      if (lbModal) lbModal.style.display = 'none';
    });

    // AI Sensei Drawer Triggers
    const openAiSenseiHandler = (): void => {
      const currentQIdx = questionNavigator.getCurrentIndex();
      aiSenseiDrawer.open(this.currentExam, currentQIdx);
    };
    document.getElementById('btn-open-ai-tutor')?.addEventListener('click', openAiSenseiHandler);
    document.getElementById('btn-tools-ocr')?.addEventListener('click', openAiSenseiHandler);
    document.getElementById('btn-tools-ai-key')?.addEventListener('click', openAiSenseiHandler);

    // Stop canvas animation loops when tab is hidden to save battery & GPU
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        const canvas = document.getElementById('confetti-canvas') as HTMLCanvasElement | null;
        if (canvas) canvas.style.display = 'none';
      }
    });
  }

  private handleStateChange(state: string): void {
    console.debug(`[Exam State Change] -> ${state}`);
  }

  private showAutoSaveIndicator(): void {
    const indicator = document.getElementById('auto-save-indicator');
    if (indicator) {
      indicator.textContent = '✓ Đã tự động lưu';
      indicator.classList.add('fade');
      setTimeout(() => indicator.classList.remove('fade'), 1500);
    }
  }

  private showProctoringBanner(msg: string): void {
    let banner = document.getElementById('proctoring-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'proctoring-banner';
      banner.style.position = 'fixed';
      banner.style.top = '0';
      banner.style.left = '0';
      banner.style.right = '0';
      banner.style.background = '#ef4444';
      banner.style.color = '#fff';
      banner.style.padding = '10px';
      banner.style.textAlign = 'center';
      banner.style.fontWeight = 'bold';
      banner.style.zIndex = '50';
      document.body.appendChild(banner);
    }
    banner.textContent = `⚠️ CẢNH BÁO VI PHẠM: ${msg}`;
    banner.style.display = 'block';
    setTimeout(() => {
      if (banner) banner.style.display = 'none';
    }, 4000);
  }

  private showProctoringModal(msg: string, resumeCallback: () => void): void {
    const modal = document.getElementById('proctoring-modal') || document.getElementById('anticheat-modal');
    if (!modal) {
      alert(`⚠️ CẢNH BÁO VI PHẠM LẦN 2: ${msg}\nBấm OK để tiếp tục làm bài.`);
      resumeCallback();
      return;
    }

    const txt = modal.querySelector('.proctoring-modal-text') || document.getElementById('anticheat-desc');
    if (txt) txt.textContent = msg;

    const pill = document.getElementById('anticheat-pill');
    if (pill) pill.textContent = 'Số lần vi phạm: 2/3 (Cảnh báo nghiêm trọng!)';

    modal.style.display = 'flex';

    const resumeBtn = modal.querySelector('#btn-proctoring-resume') || document.getElementById('anticheat-ack-btn');
    resumeBtn?.addEventListener(
      'click',
      () => {
        modal.style.display = 'none';
        resumeCallback();
      },
      { once: true }
    );
  }

  /**
   * Display Room PIN and Native Canvas QR Code Share Modal
   */
  public showRoomShareModal(pin: string, examTitle: string): void {
    let modal = document.getElementById('room-share-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'room-share-modal';
      modal.style.cssText = `
        position: fixed; inset: 0; z-index: 9996; background: rgba(9, 13, 22, 0.85);
        backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; padding: 16px;
      `;
      document.body.appendChild(modal);
    }

    const shareUrl = `${window.location.origin}${window.location.pathname}?pin=${pin}`;

    modal.innerHTML = `
      <div style="
        background: #0f172a; border: 1px solid rgba(0, 240, 255, 0.4); border-radius: 20px;
        width: 95%; max-width: 480px; text-align: center; padding: 24px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8);
      ">
        <h3 style="margin: 0 0 6px; color: #f8fafc; font-size: 1.25rem;">🎉 Đã Tạo Phòng Thi Trực Tuyến</h3>
        <p style="margin: 0 0 16px; color: #94a3b8; font-size: 0.88rem;">${examTitle}</p>

        <!-- PIN Display -->
        <div style="background: rgba(0, 240, 255, 0.1); border: 2px dashed #00f0ff; border-radius: 12px; padding: 12px; margin-bottom: 16px;">
          <span style="font-size: 0.8rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; display: block;">Mã PIN vào phòng</span>
          <strong style="font-size: 2.4rem; color: #00f0ff; letter-spacing: 6px; font-family: monospace;">${pin}</strong>
        </div>

        <!-- Canvas QR Code -->
        <div style="display: flex; justify-content: center; margin-bottom: 16px;">
          <canvas id="share-modal-qr-canvas" width="200" height="200" style="border-radius: 12px; box-shadow: 0 4px 14px rgba(0,0,0,0.4);"></canvas>
        </div>

        <!-- Action Buttons -->
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <button type="button" id="btn-copy-share-link" style="
            background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); color: #f8fafc;
            padding: 10px; border-radius: 10px; cursor: pointer; font-size: 0.88rem; font-weight: 600;
          ">📋 Sao chép đường link phòng thi</button>

          <button type="button" id="btn-open-live-proctor" style="
            background: linear-gradient(135deg, #00f0ff, #0284c7); border: none; color: #090d16;
            padding: 11px; border-radius: 10px; cursor: pointer; font-size: 0.92rem; font-weight: 700;
          ">📡 Mở Bảng Giám Sát Phòng Thi (Live)</button>

          <button type="button" id="btn-close-room-share" style="
            background: transparent; border: none; color: #94a3b8; padding: 8px; cursor: pointer; font-size: 0.85rem;
          ">✕ Đóng cửa sổ</button>
        </div>
      </div>
    `;

    modal.style.display = 'flex';

    // Render Canvas QR
    const qrCanvas = modal.querySelector('#share-modal-qr-canvas') as HTMLCanvasElement | null;
    if (qrCanvas) {
      classroomManager.renderQrToCanvas(qrCanvas, shareUrl, 200);
    }

    modal.querySelector('#btn-copy-share-link')?.addEventListener('click', () => {
      void navigator.clipboard.writeText(shareUrl);
      themeManager.showToast('✅ Đã sao chép link phòng thi vào bộ nhớ tạm!');
    });

    modal.querySelector('#btn-open-live-proctor')?.addEventListener('click', () => {
      modal!.style.display = 'none';
      classroomManager.showTeacherDashboardModal(pin);
    });

    modal.querySelector('#btn-close-room-share')?.addEventListener('click', () => {
      modal!.style.display = 'none';
    });
  }

  private updateExamHeaderInfo(exam: Exam): void {
    const titleEl = document.getElementById('txt-exam-title') || document.getElementById('txt-app-title');
    if (titleEl) titleEl.textContent = exam.title;

    const countEl = document.getElementById('stat-total-q') || document.getElementById('total-questions');
    if (countEl) countEl.textContent = `${exam.totalQuestions}`;
  }

  /**
   * PWA Offline/Online Network Connection Monitoring
   */
  public setupNetworkMonitoring(): void {
    const badge = document.getElementById('offline-indicator-badge');
    const textEl = document.getElementById('offline-indicator-text');

    const updateNetworkStatus = (isOnline: boolean) => {
      if (!badge || !textEl) return;
      if (!isOnline) {
        badge.classList.remove('is-online');
        badge.classList.add('is-offline');
        badge.style.display = 'inline-flex';
        textEl.textContent = '⚡ Ngoại tuyến (Offline Mode) - Sẵn sàng làm bài';
        themeManager.showToast('⚡ Chế độ Ngoại tuyến: 9 đề thi mẫu và dữ liệu bài thi đã sẵn sàng!');
      } else {
        badge.classList.remove('is-offline');
        badge.classList.add('is-online');
        textEl.textContent = '🟢 Đã kết nối';
        badge.style.display = 'inline-flex';
        setTimeout(() => {
          if (typeof navigator !== 'undefined' && navigator.onLine && badge) {
            badge.style.display = 'none';
          }
        }, 3500);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('offline', () => updateNetworkStatus(false));
      window.addEventListener('online', () => updateNetworkStatus(true));

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        updateNetworkStatus(false);
      }
    }
  }
}

declare global {
  interface Window {
    OmniQuizAppInstance?: OmniQuizApp;
  }
}

// Auto bootstrap on DOM Ready
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const app = new OmniQuizApp();
    app.bootstrap().catch((err: unknown) => console.error('[Bootstrap Error]', err));
    window.OmniQuizAppInstance = app;
  });
}
