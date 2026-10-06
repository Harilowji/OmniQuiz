/**
 * src/features/lobby/lobby-view.ts - Lobby & CBT Studio 2.0 Upload Hub
 * Governs the initial IDLE screen: Dropzone parsing, Curated Subject Banks,
 * and 6-digit PIN Online Exam entry point.
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
   * Zone 3: 6-Digit PIN Online Room Form
   */
  private bindPinJoin(): void {
    const btnJoin = document.getElementById('btn-join-room');
    const inputPin = document.getElementById('input-join-pin') as HTMLInputElement | null;
    const inputName = document.getElementById('input-join-name') as HTMLInputElement | null;
    const inputSbd = document.getElementById('input-join-sbd') as HTMLInputElement | null;

    btnJoin?.addEventListener('click', () => {
      const pin = inputPin?.value.trim().toUpperCase() || '';
      const name = inputName?.value.trim() || '';
      const sbd = inputSbd?.value.trim() || undefined;

      if (!pin || pin.length < 4) {
        alert('Vui lòng nhập mã PIN hợp lệ (từ 4 đến 6 ký tự).');
        inputPin?.focus();
        return;
      }

      if (!name) {
        alert('Vui lòng nhập họ và tên thí sinh.');
        inputName?.focus();
        return;
      }

      this.handlers?.onJoinRoom(pin, name, sbd);
    });

    // Enter key triggers join
    inputPin?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        inputName?.focus();
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
