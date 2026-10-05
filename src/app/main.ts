/**
 * src/app/main.ts - Enterprise EdTech Architecture Entrypoint
 * Orchestrates Feature-Sliced Architecture (FSA), Local-First DB, Tri-Mode, Proctoring,
 * Realtime Multiplayer, Document Parser Worker, and Analytics Engine.
 */

import confetti from 'canvas-confetti';
import { localDB } from '../shared/db/dexie-db';
import { getPreloadedSampleExams } from '../shared/sample-banks';
import type { Exam, StudyMode, ExamAttempt, ExamAnalyticsReport } from '../shared/types';
import { examStateMachine } from '../features/exam-engine/exam-state-machine';
import { proctoringService } from '../features/proctoring/proctoring-service';
import { documentParserService } from '../features/parser/document-parser';
import { examView } from '../features/study-modes/exam/exam-view';
import { practiceView } from '../features/study-modes/practice/practice-view';
import { flashcardView } from '../features/study-modes/flashcard/flashcard-view';
import { multiplayerRoomService } from '../features/multiplayer/room-service';
import { analyticsService } from '../features/analytics/analytics-service';

export class OmniQuizApp {
  private currentExam: Exam | null = null;
  private currentMode: StudyMode = 'exam';

  public async bootstrap(): Promise<void> {
    console.log('🚀 [OmniQuiz PRO 2.5] Initializing Enterprise EdTech Architecture...');

    // 1. Preload Sample Banks into Dexie if empty
    await this.seedInitialDatabases();

    // 2. Check Crash Recovery Session
    await this.checkCrashRecovery();

    // 3. Bind UI Global Controls & Events
    this.bindGlobalEventListeners();

    // 4. Default Load First Exam
    const allExams = await localDB.getAllExams();
    if (allExams.length > 0) {
      this.loadExam(allExams[0]!);
    }
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
   * Crash Recovery Checkpoint
   */
  private async checkCrashRecovery(): Promise<void> {
    const active = await localDB.loadActiveSession();
    if (active && !active.attempt.isCompleted) {
      const confirmResume = window.confirm(
        `Phát hiện phiên thi chưa nộp: "${active.exam.title}". Bạn có muốn tiếp tục làm bài không?`
      );
      if (confirmResume) {
        this.currentExam = active.exam;
        this.currentMode = active.attempt.mode;
        this.startStudySession(active.attempt);
      } else {
        await localDB.clearActiveSession();
      }
    }
  }

  /**
   * Load and render selected exam
   */
  public loadExam(exam: Exam): void {
    this.currentExam = exam;
    this.updateExamHeaderInfo(exam);

    const statsSection = document.getElementById('stats-section');
    if (statsSection) statsSection.style.display = 'block';

    const paletteSection = document.getElementById('palette-section');
    if (paletteSection) paletteSection.style.display = 'block';

    const emptyWelcome = document.getElementById('empty-quiz-welcome');
    if (emptyWelcome) emptyWelcome.style.display = 'none';

    this.startStudySession();
  }

  /**
   * Start study session according to currentMode (Exam, Practice, Flashcard)
   */
  private startStudySession(recoveredAttempt?: ExamAttempt): void {
    if (!this.currentExam) return;

    const examContainer = document.getElementById('exam-container') || document.getElementById('quiz-container');
    const practiceContainer = document.getElementById('practice-container') || document.getElementById('quiz-container');
    const flashcardContainer = document.getElementById('flashcard-container') || document.getElementById('flashcard-section');
    const flashcardDeck = document.getElementById('flashcard-deck-container') || flashcardContainer;

    if (examContainer && examContainer !== practiceContainer) {
      examContainer.style.display = this.currentMode === 'exam' ? 'block' : 'none';
    }
    if (practiceContainer && practiceContainer !== examContainer) {
      practiceContainer.style.display = this.currentMode === 'practice' ? 'block' : 'none';
    }
    if (flashcardContainer) {
      flashcardContainer.style.display = this.currentMode === 'flashcard' ? 'block' : 'none';
    }
    const quizContainer = document.getElementById('quiz-container');
    if (quizContainer) {
      quizContainer.style.display = this.currentMode === 'flashcard' ? 'none' : 'block';
    }

    // Start State Machine
    examStateMachine.startSession(
      this.currentExam,
      this.currentMode,
      {
        onStateChange: (state) => this.handleStateChange(state),
        onTimerTick: (timeRemaining, isWarning) => this.updateTimerDisplay(timeRemaining, isWarning),
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
      const targetId = document.getElementById('exam-container') ? 'exam-container' : 'quiz-container';
      examView.init(this.currentExam, targetId);
      this.initProctoring();
    } else if (this.currentMode === 'practice') {
      const targetId = document.getElementById('practice-container') ? 'practice-container' : 'quiz-container';
      practiceView.init(this.currentExam, targetId);
      proctoringService.stopProctoring();
    } else if (this.currentMode === 'flashcard') {
      const targetId = flashcardDeck ? (flashcardDeck.id || 'flashcard-section') : 'flashcard-section';
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
    proctoringService.startProctoring({
      onTier1Warning: (violation) => {
        this.showProctoringBanner(violation.detail);
      },
      onTier2Modal: (violation, resumeCallback) => {
        this.showProctoringModal(violation.detail, resumeCallback);
      },
      onTier3Disqualified: () => {
        alert('CẢNH BÁO VI PHẠM: Bạn đã vi phạm quy chế thi 3 lần. Bài thi sẽ bị thu và khóa kết quả!');
        examStateMachine.disqualify();
      },
      onTimerPause: () => examStateMachine.pause(),
      onTimerResume: () => examStateMachine.resume(),
    });
  }

  /**
   * Render Question Map / Palette
   */
  private renderQuestionPalette(): void {
    const paletteGrid = document.getElementById('palette-grid');
    if (!paletteGrid || !this.currentExam) return;

    const attempt = examStateMachine.getAttempt();
    const answers = attempt?.answers || {};
    const flagged = attempt?.flaggedQuestions || [];

    paletteGrid.innerHTML = this.currentExam.questions
      .map((_, idx) => {
        const isAnswered = answers[idx] && answers[idx].length > 0;
        const isFlagged = flagged.includes(idx);

        let stateClass = '';
        if (isAnswered) stateClass = 'answered-exam';
        if (isFlagged) stateClass += ' flagged';

        return `
          <button type="button" class="palette-btn ${stateClass}" id="palette-btn-${idx}" data-idx="${idx}">
            ${idx + 1}
          </button>
        `;
      })
      .join('');

    paletteGrid.querySelectorAll('.palette-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx') || '0', 10);
        const card = document.getElementById(`q-card-${idx}`);
        card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });
  }

  private updateQuestionPalette(qIdx: number): void {
    const btn = document.getElementById(`palette-btn-${qIdx}`);
    if (!btn) return;
    const attempt = examStateMachine.getAttempt();
    const ans = attempt?.answers[qIdx] || [];
    btn.classList.toggle('answered-exam', ans.length > 0);
  }

  private updateHeaderProgress(): void {
    if (!this.currentExam) return;
    const attempt = examStateMachine.getAttempt();
    const answers = attempt?.answers || {};
    const answeredCount = Object.keys(answers).filter((k) => (answers[Number(k)]?.length ?? 0) > 0).length;
    const total = this.currentExam.questions.length;

    const totalAnsweredEl = document.getElementById('total-answered');
    if (totalAnsweredEl) totalAnsweredEl.textContent = `${answeredCount}`;

    const totalQuestionsEl = document.getElementById('total-questions') || document.getElementById('stat-total-q');
    if (totalQuestionsEl) totalQuestionsEl.textContent = `${total}`;

    const progressBar = document.getElementById('quiz-progress-bar');
    if (progressBar && total > 0) {
      const pct = Math.round((answeredCount / total) * 100);
      progressBar.style.width = `${pct}%`;
    }

    const badge = document.getElementById('palette-completion-badge');
    if (badge && total > 0) {
      badge.textContent = `${Math.round((answeredCount / total) * 100)}%`;
    }
  }

  /**
   * Update Timer UI Display
   */
  private updateTimerDisplay(seconds: number, isWarning: boolean): void {
    const timerEl = document.getElementById('txt-timer') || document.getElementById('time-remaining');
    if (!timerEl) return;

    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    timerEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    timerEl.classList.toggle('timer-warning', isWarning);
  }

  /**
   * Handle Exam Submitted -> Show Results & Analytics
   */
  private handleExamSubmitted(attempt: ExamAttempt): void {
    proctoringService.stopProctoring();

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

    this.showResultsModal(report);
  }

  private showResultsModal(report: ExamAnalyticsReport): void {
    const modal = document.getElementById('results-modal') || document.getElementById('summary-modal');
    if (!modal) return;

    const scoreCircle = document.getElementById('modal-score-num') || document.getElementById('modal-score');
    if (scoreCircle) scoreCircle.textContent = `${report.scorePercentage}`;

    const txtCorrect = document.getElementById('stat-modal-correct') || document.getElementById('modal-correct');
    if (txtCorrect) txtCorrect.textContent = `${report.correctCount}`;

    const txtWrong = document.getElementById('stat-modal-wrong') || document.getElementById('modal-incorrect');
    if (txtWrong) txtWrong.textContent = `${report.wrongCount}`;

    const txtUnattempted = document.getElementById('modal-unattempted');
    if (txtUnattempted) txtUnattempted.textContent = `${report.unansweredCount}`;

    const txtTime = document.getElementById('stat-modal-time') || document.getElementById('modal-pacing');
    if (txtTime) txtTime.textContent = `${Math.round(report.averageTimePerQuestion)}s/câu`;

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
    // Mode Switcher buttons
    document.querySelectorAll('[data-study-mode]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const mode = target.getAttribute('data-study-mode') as StudyMode;
        if (mode && mode !== this.currentMode) {
          document.querySelectorAll('[data-study-mode]').forEach((b) => b.classList.remove('active'));
          target.classList.add('active');
          this.currentMode = mode;
          this.startStudySession();
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
            wrapDuration.style.display = mode === 'exam' ? 'block' : 'none';
          }
          this.startStudySession();
        }
      });
    }

    // Submit Exam Buttons
    const submitHandler = (): void => {
      const confirmSubmit = window.confirm('Bạn có chắc chắn muốn nộp bài thi ngay bây giờ?');
      if (confirmSubmit) {
        examStateMachine.submit();
      }
    };
    document.getElementById('btn-submit-exam')?.addEventListener('click', submitHandler);
    document.getElementById('finish-btn')?.addEventListener('click', submitHandler);
    document.getElementById('txt-btn-submit-aside')?.addEventListener('click', submitHandler);

    // Reset Button
    document.getElementById('btn-reset')?.addEventListener('click', () => {
      const confirmReset = window.confirm('Bạn có muốn làm mới và quay về giao diện chọn đề thi không?');
      if (confirmReset) {
        examStateMachine.pause();
        proctoringService.stopProctoring();
        const uploadSec = document.getElementById('upload-section');
        if (uploadSec) uploadSec.scrollIntoView({ behavior: 'smooth' });
      }
    });

    // Load Sample Button & Subject Quick Pills
    const sampleSelect = document.getElementById('sample-subject-select') as HTMLSelectElement | null;
    const loadSampleExam = async (subjectId: string): Promise<void> => {
      const exams = await localDB.getAllExams();
      const match = exams.find((e) => e.id.toLowerCase().includes(subjectId.toLowerCase()) || e.subject.toLowerCase().includes(subjectId.toLowerCase()));
      if (match) {
        this.loadExam(match);
      } else {
        const samples = getPreloadedSampleExams();
        const fallback = samples.find((s) => s.id.toLowerCase().includes(subjectId.toLowerCase())) || samples[0];
        if (fallback) {
          await localDB.saveExam(fallback);
          this.loadExam(fallback);
        }
      }
    };

    document.getElementById('btn-load-sample')?.addEventListener('click', async () => {
      const subject = sampleSelect ? sampleSelect.value : 'informatics_10';
      await loadSampleExam(subject);
    });

    document.querySelectorAll('.subj-pill').forEach((pill) => {
      pill.addEventListener('click', async (e) => {
        const target = e.currentTarget as HTMLElement;
        const subj = target.getAttribute('data-subj');
        if (subj) {
          if (sampleSelect) sampleSelect.value = subj;
          await loadSampleExam(subj);
        }
      });
    });

    // File Ingestion Dropzone & File Input
    const handleFileUpload = async (file: File): Promise<void> => {
      try {
        const loadingModal = document.getElementById('loading-modal');
        const loadingStep = document.getElementById('loading-modal-step');
        const loadingBar = document.getElementById('loading-progress-bar');
        const loadingNum = document.getElementById('loading-progress-num');

        if (loadingModal) loadingModal.style.display = 'flex';

        const parsedExam = await documentParserService.parseFile(file, undefined, (pct, status) => {
          if (loadingStep) loadingStep.textContent = status;
          if (loadingBar) loadingBar.style.width = `${pct}%`;
          if (loadingNum) loadingNum.textContent = `${pct}%`;
        });

        if (loadingModal) loadingModal.style.display = 'none';

        await localDB.saveExam(parsedExam);
        this.loadExam(parsedExam);
      } catch (err: unknown) {
        const loadingModal = document.getElementById('loading-modal');
        if (loadingModal) loadingModal.style.display = 'none';
        alert(err instanceof Error ? err.message : String(err));
      }
    };

    const fileInputs = [
      document.getElementById('file-input-native') as HTMLInputElement | null,
      document.getElementById('file-input') as HTMLInputElement | null,
    ];
    fileInputs.forEach((input) => {
      input?.addEventListener('change', async () => {
        if (input.files && input.files[0]) {
          await handleFileUpload(input.files[0]);
        }
      });
    });

    const dropzone = document.getElementById('dropzone-area');
    if (dropzone) {
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-over');
      });
      dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
      dropzone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
          await handleFileUpload(e.dataTransfer.files[0]);
        }
      });
    }

    // Modal Close Buttons
    const closeModal = (): void => {
      const modal = document.getElementById('results-modal') || document.getElementById('summary-modal');
      if (modal) modal.style.display = 'none';
    };
    document.getElementById('txt-modal-review')?.addEventListener('click', closeModal);
    document.getElementById('btn-modal-close')?.addEventListener('click', closeModal);

    // Export PDF Buttons
    const exportPdfHandler = (): void => {
      if (this.currentExam) {
        const attempt = examStateMachine.getAttempt();
        const report = attempt ? analyticsService.generateReport(this.currentExam, attempt) : undefined;
        analyticsService.exportExamToPDF(this.currentExam, report);
      }
    };
    document.getElementById('btn-export-pdf')?.addEventListener('click', exportPdfHandler);
    document.getElementById('txt-modal-export')?.addEventListener('click', exportPdfHandler);

    // Export CSV Gradebook
    document.getElementById('btn-export-csv')?.addEventListener('click', () => {
      if (this.currentExam) {
        const attempt = examStateMachine.getAttempt();
        if (attempt) {
          const report = analyticsService.generateReport(this.currentExam, attempt);
          analyticsService.exportCSVGradebook(report);
        }
      }
    });

    // Multiplayer PIN Room Creation
    const createRoomHandler = async (): Promise<void> => {
      if (!this.currentExam) return;
      const hostName = prompt('Nhập tên của bạn (Giáo viên / Host):', 'Thầy Giáo') || 'Giáo viên';
      const pin = await multiplayerRoomService.createRoom(hostName, this.currentExam, {
        onParticipantListChange: (list) => console.log('[Room Members]', list),
        onExamStarted: (ex) => this.loadExam(ex),
        onLeaderboardUpdate: (ranked) => console.log('[Leaderboard]', ranked),
      });
      alert(`Đã tạo phòng thi trực tuyến! Mã PIN: ${pin}`);
    };
    document.getElementById('btn-create-room')?.addEventListener('click', createRoomHandler);
    document.getElementById('btn-tools-host-room')?.addEventListener('click', createRoomHandler);
  }

  private handleStateChange(state: string): void {
    console.log(`[Exam State Change] -> ${state}`);
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
      banner.style.zIndex = '999999';
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

  private updateExamHeaderInfo(exam: Exam): void {
    const titleEl = document.getElementById('txt-exam-title') || document.getElementById('txt-app-title');
    if (titleEl) titleEl.textContent = exam.title;

    const countEl = document.getElementById('stat-total-q') || document.getElementById('total-questions');
    if (countEl) countEl.textContent = `${exam.totalQuestions}`;
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
