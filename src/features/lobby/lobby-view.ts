/**
 * src/features/lobby/lobby-view.ts - Lobby & CBT Studio 2.0 Upload Hub
 * Governs the initial IDLE screen: Dropzone parsing, Curated Subject Banks,
 * Sample Modal Gallery, and 6-digit discrete OTP PIN Online Exam entry point.
 */

export interface LobbyHandlers {
  onFileSelected: (file: File) => Promise<void> | void;
  onSampleSelected: (bankKey: string) => Promise<void> | void;
  onJoinRoom: (pin: string, studentName: string, sbd?: string) => Promise<void> | void;
}

export class LobbyView {
  private handlers: LobbyHandlers | null = null;
  private isInitialized = false;

  public init(handlers: LobbyHandlers): void {
    this.handlers = handlers;
    if (this.isInitialized) return;
    this.isInitialized = true;

    this.bindDropzone();
    this.bindFileInput();
    this.bindCuratedBanks();
    this.bindSampleGalleryModal();
    this.bindPinJoin();
  }

  public show(): void {
    const uploadSection = document.getElementById('upload-section');
    if (uploadSection) {
      uploadSection.style.display = 'block';
    }
  }

  public hide(): void {
    const uploadSection = document.getElementById('upload-section');
    if (uploadSection) {
      uploadSection.style.display = 'none';
    }
  }

  private rateLimitInterval: ReturnType<typeof setInterval> | number = 0;

  /**
   * Temporarily lock OTP input controls during 429 Rate Limit
   */
  public lockForRateLimit(seconds = 60): void {
    clearInterval(this.rateLimitInterval);
    const otpInputs = document.querySelectorAll<HTMLInputElement>('.otp-digit');
    const legacyPinInput = document.getElementById('input-join-pin') as HTMLInputElement | null;
    const btnJoin = document.getElementById('btn-join-room') as HTMLButtonElement | null;

    otpInputs.forEach((inp) => {
      inp.disabled = true;
    });
    if (legacyPinInput) legacyPinInput.disabled = true;
    if (btnJoin) btnJoin.disabled = true;

    let remaining = seconds;
    const updateBtnText = () => {
      if (btnJoin) {
        btnJoin.textContent = `⏳ Chờ ${remaining}s...`;
      }
    };
    updateBtnText();

    this.rateLimitInterval = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(this.rateLimitInterval);
        otpInputs.forEach((inp) => {
          inp.disabled = false;
        });
        if (legacyPinInput) legacyPinInput.disabled = false;
        if (btnJoin) {
          btnJoin.disabled = false;
          btnJoin.textContent = 'Vào phòng thi ➔';
        }
      } else {
        updateBtnText();
      }
    }, 1000);
  }

  /**
   * Zone 1: Drag & Drop Area
   */
  private bindDropzone(): void {
    const dropzone = document.getElementById('dropzone-area');
    if (!dropzone) return;

    ['dragenter', 'dragover'].forEach((eventName) => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('dragover');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length > 0) {
        const file = dt.files[0];
        if (file) {
          this.handlers?.onFileSelected(file);
        }
      }
    });
  }

  /**
   * Zone 1: File Input Button
   */
  private bindFileInput(): void {
    const fileInput = document.getElementById('file-input') as HTMLInputElement | null;
    if (!fileInput) return;

    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        if (file) {
          this.handlers?.onFileSelected(file);
        }
        fileInput.value = ''; // Reset input to allow selecting same file again
      }
    });
  }

  /**
   * Zone 2: Curated Banks Dropdown & Quick Pills
   */
  private bindCuratedBanks(): void {
    const select = document.getElementById('sample-subject-select') as HTMLSelectElement | null;
    const btnLoad = document.getElementById('btn-load-sample');

    btnLoad?.addEventListener('click', () => {
      const selectedKey = select?.value;
      if (selectedKey) {
        this.handlers?.onSampleSelected(selectedKey);
      }
    });

    // Subject quick pills (.subj-pill)
    const pills = document.querySelectorAll<HTMLButtonElement>('.subj-pill');
    pills.forEach((pill) => {
      pill.addEventListener('click', () => {
        const key = pill.getAttribute('data-subj');
        if (key) {
          if (select) select.value = key;
          this.handlers?.onSampleSelected(key);
        }
      });
    });
  }

  /**
   * Zone 2: Sample Bank Gallery Modal Trigger & Card Clicks
   */
  private bindSampleGalleryModal(): void {
    const btnOpen = document.getElementById('btn-open-sample-gallery');
    const modal = document.getElementById('sample-gallery-modal');
    const btnClose = document.getElementById('btn-close-gallery-modal');

    const openGallery = () => {
      if (modal) modal.style.display = 'flex';
    };

    const closeGallery = () => {
      if (modal) modal.style.display = 'none';
    };

    btnOpen?.addEventListener('click', openGallery);
    btnClose?.addEventListener('click', closeGallery);

    // Clicking modal overlay backdrop closes it
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeGallery();
      }
    });

    // Gallery item selection buttons & cards
    const galleryGrid = document.getElementById('gallery-cards-grid');
    if (galleryGrid) {
      galleryGrid.querySelectorAll<HTMLElement>('.gallery-item-card').forEach((card) => {
        card.addEventListener('click', (e) => {
          const target = e.target as HTMLElement;
          const selectBtn = target.closest<HTMLElement>('.btn-select-gallery-exam');
          const bankKey = selectBtn?.getAttribute('data-bank-key') || card.getAttribute('data-bank');
          if (bankKey) {
            closeGallery();
            this.handlers?.onSampleSelected(bankKey);
          }
        });
      });
    }
  }

  /**
   * Zone 3: 6-Digit Discrete OTP PIN Online Room Form
   */
  private bindPinJoin(): void {
    const btnJoin = document.getElementById('btn-join-room');
    const inputLegacyPin = document.getElementById('input-join-pin') as HTMLInputElement | null;
    const inputName = document.getElementById('input-join-name') as HTMLInputElement | null;
    const inputSbd = document.getElementById('input-join-sbd') as HTMLInputElement | null;
    const otpInputs = Array.from(
      document.querySelectorAll<HTMLInputElement>('.otp-digit')
    );

    const getFullPin = (): string => {
      if (otpInputs.length === 6) {
        return otpInputs.map((inp) => inp.value.trim().toUpperCase()).join('');
      }
      return inputLegacyPin?.value.trim().toUpperCase() || '';
    };

    const syncPinValue = (pin: string) => {
      if (inputLegacyPin) {
        inputLegacyPin.value = pin;
      }
    };

    // OTP Discrete Inputs Management
    otpInputs.forEach((inp, idx) => {
      // 1. Auto-advance on input (strictly digits 0-9)
      inp.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        const digitsOnly = target.value.replace(/\D/g, '');
        target.value = digitsOnly.charAt(0);

        const full = getFullPin();
        syncPinValue(full);

        if (target.value && idx < otpInputs.length - 1) {
          otpInputs[idx + 1]?.focus();
          otpInputs[idx + 1]?.select();
        } else if (target.value && idx === otpInputs.length - 1) {
          // If 6th digit entered, advance to name input
          inputName?.focus();
        }
      });

      // 2. Backspace auto-retreat & Arrow key navigation
      inp.addEventListener('keydown', (e) => {
        // Block letters and special characters (allow navigation and control keys)
        if (
          !/[0-9]/.test(e.key) &&
          !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'].includes(e.key) &&
          !e.ctrlKey &&
          !e.metaKey
        ) {
          e.preventDefault();
          return;
        }

        if (e.key === 'Backspace') {
          if (!inp.value && idx > 0) {
            e.preventDefault();
            const prev = otpInputs[idx - 1];
            if (prev) {
              prev.value = '';
              prev.focus();
              syncPinValue(getFullPin());
            }
          }
        } else if (e.key === 'ArrowLeft' && idx > 0) {
          e.preventDefault();
          otpInputs[idx - 1]?.focus();
        } else if (e.key === 'ArrowRight' && idx < otpInputs.length - 1) {
          e.preventDefault();
          otpInputs[idx + 1]?.focus();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          inputName?.focus();
        }
      });

      // 3. Paste support across all 6 inputs (strips spaces, dashes, letters)
      inp.addEventListener('paste', (e) => {
        e.preventDefault();
        const clipboardData = e.clipboardData;
        if (!clipboardData) return;

        const pastedDigits = clipboardData
          .getData('text')
          .replace(/\D/g, '')
          .substring(0, 6);

        if (pastedDigits) {
          for (let i = 0; i < otpInputs.length; i++) {
            const digit = pastedDigits.charAt(i);
            const inputEl = otpInputs[i];
            if (inputEl) inputEl.value = digit;
          }

          syncPinValue(getFullPin());

          // Focus next unfilled input or the candidate name
          if (pastedDigits.length >= 6) {
            inputName?.focus();
          } else {
            otpInputs[pastedDigits.length]?.focus();
          }
        }
      });

      // Auto-select text on focus
      inp.addEventListener('focus', () => {
        inp.select();
      });
    });

    // Submit handler
    btnJoin?.addEventListener('click', () => {
      const pin = getFullPin();
      const name = inputName?.value.trim() || '';
      const sbd = inputSbd?.value.trim() || undefined;

      if (!pin || pin.length < 4) {
        alert('Vui lòng nhập đầy đủ mã PIN phòng thi (tối thiểu 4 đến 6 ký tự).');
        otpInputs[0]?.focus();
        return;
      }

      if (!name) {
        alert('Vui lòng nhập họ và tên thí sinh.');
        inputName?.focus();
        return;
      }

      this.handlers?.onJoinRoom(pin, name, sbd);
    });

    // Enter in SBD triggers join
    inputSbd?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        btnJoin?.click();
      }
    });

    inputName?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        btnJoin?.click();
      }
    });
  }
}

export const lobbyView = new LobbyView();
