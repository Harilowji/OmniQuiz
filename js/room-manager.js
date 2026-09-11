/**
 * room-manager.js - Realtime Cloud Exam Room & Room PIN CBT Architecture
 * Phase 4 Enterprise Proctoring & Cloud CBT
 * Allows hosting synchronized online exam rooms with 6-digit PIN codes,
 * student PIN-based participation, serverless room synchronization via Supabase,
 * and live exam room leaderboards.
 */

const RoomManager = (() => {
    const ACTIVE_ROOM_KEY = 'omni_active_room_session';
    const LOCAL_ROOMS_KEY = 'omni_local_hosted_rooms';

    let currentActiveRoom = null;

    /**
     * Generate a unique, readable 6-digit PIN code (e.g. 748291)
     */
    function generateRoomPin() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    /**
     * Get active student session if participating via Room PIN
     */
    function getActiveSession() {
        if (currentActiveRoom) return currentActiveRoom;
        try {
            const raw = sessionStorage.getItem(ACTIVE_ROOM_KEY);
            if (raw) {
                currentActiveRoom = JSON.parse(raw);
                return currentActiveRoom;
            }
        } catch (e) {}
        return null;
    }

    /**
     * Clear active room session (e.g. after exam finished or reset)
     */
    function clearActiveSession() {
        currentActiveRoom = null;
        sessionStorage.removeItem(ACTIVE_ROOM_KEY);
    }

    /**
     * Host a new Exam Room with a PIN Code
     */
    async function hostExamRoom(options) {
        const title = (options.title || 'Phòng thi trực tuyến OmniQuiz').trim();
        const questions = options.questions || [];
        const durationMinutes = parseInt(options.durationMinutes, 10) || 60;
        const isAnticheat = options.isAnticheat !== false;
        const hostName = (options.hostName || 'Giảng viên / Quản trị viên').trim();

        if (questions.length === 0) {
            alert('Cần có ít nhất 1 câu hỏi để khởi tạo phòng thi!');
            return null;
        }

        const roomPin = generateRoomPin();
        const roomPayload = {
            id: roomPin,
            title: title,
            questions_count: questions.length,
            duration_minutes: durationMinutes,
            anticheat_enabled: isAnticheat,
            host_name: hostName,
            created_at: new Date().toISOString(),
            // Save questions payload
            questions_data: questions
        };

        // 1. Cache to local storage so the host and local clients can always access
        try {
            const hosted = JSON.parse(localStorage.getItem(LOCAL_ROOMS_KEY) || '{}');
            hosted[roomPin] = roomPayload;
            localStorage.setItem(LOCAL_ROOMS_KEY, JSON.stringify(hosted));
        } catch (e) {
            console.warn('[RoomManager] Failed to cache room locally:', e);
        }

        // 2. Sync to Supabase cloud table "exam_rooms" if configured
        let cloudSynced = false;
        if (window.SupabaseClient && SupabaseClient.isConfigured()) {
            try {
                const client = window.supabase ? window.supabase.createClient(
                    SupabaseClient.getStoredConfig().url,
                    SupabaseClient.getStoredConfig().key
                ) : null;

                if (client) {
                    const { error } = await client
                        .from('exam_rooms')
                        .upsert([{
                            id: roomPin,
                            title: title,
                            questions_count: questions.length,
                            duration_minutes: durationMinutes,
                            anticheat_enabled: isAnticheat,
                            host_name: hostName,
                            questions_data: questions,
                            created_at: roomPayload.created_at
                        }]);

                    if (!error) {
                        cloudSynced = true;
                        console.log('[RoomManager] Room published to Supabase Cloud:', roomPin);
                    } else {
                        console.warn('[RoomManager] Supabase room publish warning:', error.message);
                    }
                }
            } catch (err) {
                console.warn('[RoomManager] Cloud publish error:', err);
            }
        }

        return {
            roomPin,
            title,
            questionsCount: questions.length,
            durationMinutes,
            cloudSynced
        };
    }

    /**
     * Fetch Room details by PIN Code
     */
    async function fetchRoomByPin(pin) {
        const cleanPin = String(pin).trim();
        if (!cleanPin) return null;

        // 1. Try Supabase cloud first
        if (window.SupabaseClient && SupabaseClient.isConfigured()) {
            try {
                const client = window.supabase ? window.supabase.createClient(
                    SupabaseClient.getStoredConfig().url,
                    SupabaseClient.getStoredConfig().key
                ) : null;

                if (client) {
                    const { data, error } = await client
                        .from('exam_rooms')
                        .select('*')
                        .eq('id', cleanPin)
                        .maybeSingle();

                    if (!error && data) {
                        return {
                            id: data.id,
                            title: data.title,
                            durationMinutes: data.duration_minutes || 60,
                            anticheatEnabled: Boolean(data.anticheat_enabled),
                            questions: data.questions_data || [],
                            cloudSource: true
                        };
                    }
                }
            } catch (err) {
                console.warn('[RoomManager] Supabase fetch error:', err);
            }
        }

        // 2. Fallback to locally cached hosted rooms
        try {
            const hosted = JSON.parse(localStorage.getItem(LOCAL_ROOMS_KEY) || '{}');
            if (hosted[cleanPin]) {
                const r = hosted[cleanPin];
                return {
                    id: r.id,
                    title: r.title,
                    durationMinutes: r.duration_minutes || 60,
                    anticheatEnabled: Boolean(r.anticheat_enabled),
                    questions: r.questions_data || [],
                    cloudSource: false
                };
            }
        } catch (e) {}

        return null;
    }

    /**
     * Submit student exam result to the room
     */
    async function submitRoomResult(record) {
        const session = getActiveSession();
        if (!session || !session.roomPin) return false;

        const submission = {
            room_id: session.roomPin,
            student_name: session.studentName || 'Thí sinh ẩn danh',
            student_id: session.studentId || 'N/A',
            score10: record.score10,
            score100: record.score100,
            correct_count: record.correctCount,
            wrong_count: record.wrongCount,
            total_questions: record.totalQuestions,
            duration_spent: record.durationSpent,
            violation_count: record.violationCount || 0,
            submitted_at: new Date().toISOString()
        };

        // Cache locally
        try {
            const subKey = `omni_sub_${session.roomPin}`;
            const existing = JSON.parse(localStorage.getItem(subKey) || '[]');
            existing.push(submission);
            localStorage.setItem(subKey, JSON.stringify(existing));
        } catch (e) {}

        // Cloud sync to Supabase table "room_submissions"
        if (window.SupabaseClient && SupabaseClient.isConfigured()) {
            try {
                const client = window.supabase ? window.supabase.createClient(
                    SupabaseClient.getStoredConfig().url,
                    SupabaseClient.getStoredConfig().key
                ) : null;

                if (client) {
                    await client.from('room_submissions').insert([submission]);
                    console.log('[RoomManager] Student score submitted to Cloud Room:', session.roomPin);
                }
            } catch (err) {
                console.warn('[RoomManager] Error uploading room submission:', err);
            }
        }

        return true;
    }

    /**
     * Fetch Room Leaderboard rankings
     */
    async function fetchRoomLeaderboard(roomPin) {
        const cleanPin = String(roomPin).trim();
        if (!cleanPin) return [];

        // 1. Try fetching from Supabase
        if (window.SupabaseClient && SupabaseClient.isConfigured()) {
            try {
                const client = window.supabase ? window.supabase.createClient(
                    SupabaseClient.getStoredConfig().url,
                    SupabaseClient.getStoredConfig().key
                ) : null;

                if (client) {
                    const { data, error } = await client
                        .from('room_submissions')
                        .select('*')
                        .eq('room_id', cleanPin)
                        .order('score10', { ascending: false })
                        .order('duration_spent', { ascending: true })
                        .limit(50);

                    if (!error && Array.isArray(data) && data.length > 0) {
                        return data.map((row, idx) => ({
                            rank: idx + 1,
                            studentName: row.student_name,
                            studentId: row.student_id,
                            score10: row.score10,
                            correctCount: row.correct_count,
                            totalQuestions: row.total_questions,
                            durationSpent: row.duration_spent,
                            violationCount: row.violation_count,
                            submittedAt: row.submitted_at
                        }));
                    }
                }
            } catch (e) {
                console.warn('[RoomManager] Cloud leaderboard fetch error:', e);
            }
        }

        // 2. Fallback to local storage
        try {
            const subKey = `omni_sub_${cleanPin}`;
            const localData = JSON.parse(localStorage.getItem(subKey) || '[]');
            localData.sort((a, b) => {
                if (b.score10 !== a.score10) return b.score10 - a.score10;
                return a.duration_spent - b.duration_spent;
            });
            return localData.map((row, idx) => ({
                rank: idx + 1,
                studentName: row.student_name,
                studentId: row.student_id,
                score10: row.score10,
                correctCount: row.correct_count,
                totalQuestions: row.total_questions,
                durationSpent: row.duration_spent,
                violationCount: row.violation_count,
                submittedAt: row.submitted_at
            }));
        } catch (e) {
            return [];
        }
    }

    /**
     * UI: Open Host Room Modal
     */
    function openHostModal(questions) {
        if (!questions || questions.length === 0) {
            alert('Chưa có câu hỏi nào trong hệ thống! Vui lòng tải đề thi hoặc chọn đề mẫu trước.');
            return;
        }

        const modal = document.getElementById('host-room-modal');
        if (!modal) return;

        const countEl = document.getElementById('host-q-count');
        if (countEl) countEl.innerText = `${questions.length} câu hỏi`;

        // Pre-fill default title
        const titleInput = document.getElementById('host-input-title');
        if (titleInput && !titleInput.value) {
            titleInput.value = 'Đề thi trắc nghiệm CBT - ' + new Date().toLocaleDateString('vi-VN');
        }

        // Hide result view if previously shown
        const createdBox = document.getElementById('host-room-created-box');
        const setupBox = document.getElementById('host-room-setup-box');
        if (createdBox) createdBox.style.display = 'none';
        if (setupBox) setupBox.style.display = 'block';

        modal.style.display = 'flex';
    }

    /**
     * UI: Open Leaderboard Modal
     */
    async function openLeaderboardModal(roomPin) {
        const pin = roomPin || (getActiveSession() ? getActiveSession().roomPin : null);
        if (!pin) {
            const promptPin = prompt('Nhập mã PIN phòng thi để xem Bảng Xếp Hạng:');
            if (!promptPin) return;
            return openLeaderboardModal(promptPin.trim());
        }

        const modal = document.getElementById('room-leaderboard-modal');
        if (!modal) return;

        const pinLabel = document.getElementById('leaderboard-room-pin');
        if (pinLabel) pinLabel.innerText = pin;

        const tbody = document.getElementById('leaderboard-tbody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 24px;">Đang tải kết quả phòng thi...</td></tr>';

        modal.style.display = 'flex';

        const list = await fetchRoomLeaderboard(pin);
        if (!tbody) return;

        if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 30px; opacity: 0.7;">Chưa có thí sinh nào nộp bài trong phòng thi này.</td></tr>';
            return;
        }

        let html = '';
        list.forEach(item => {
            let rankMedal = `#${item.rank}`;
            if (item.rank === 1) rankMedal = '🥇 1';
            else if (item.rank === 2) rankMedal = '🥈 2';
            else if (item.rank === 3) rankMedal = '🥉 3';

            const mins = Math.floor(item.durationSpent / 60);
            const secs = item.durationSpent % 60;
            const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

            const violationBadge = item.violationCount > 0
                ? `<span style="color:#ef4444; font-weight:700;">⚠️ ${item.violationCount} lần</span>`
                : '<span style="color:#22c55e;">0</span>';

            html += `
                <tr>
                    <td style="font-weight:700; text-align:center;">${rankMedal}</td>
                    <td><strong>${escapeHtml(item.studentName)}</strong></td>
                    <td style="opacity:0.8;">${escapeHtml(item.studentId || '--')}</td>
                    <td style="font-weight:700; color:var(--primary-color);">${item.score10}/10</td>
                    <td>${timeStr}</td>
                    <td style="text-align:center;">${violationBadge}</td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    }

    /**
     * Helper to escape HTML characters
     */
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Setup DOM Events for Room Manager
     */
    function init() {
        // Close host modal
        document.getElementById('btn-close-host-modal')?.addEventListener('click', () => {
            const modal = document.getElementById('host-room-modal');
            if (modal) modal.style.display = 'none';
        });

        // Close leaderboard modal
        document.getElementById('btn-close-leaderboard-modal')?.addEventListener('click', () => {
            const modal = document.getElementById('room-leaderboard-modal');
            if (modal) modal.style.display = 'none';
        });

        // Copy PIN code button
        document.getElementById('btn-copy-room-pin')?.addEventListener('click', () => {
            const pinEl = document.getElementById('host-display-pin');
            if (pinEl && pinEl.innerText) {
                navigator.clipboard.writeText(pinEl.innerText).then(() => {
                    if (window.UIManager) UIManager.showToast('✓ Đã sao chép mã PIN vào Clipboard!');
                });
            }
        });

        // Refresh leaderboard button
        document.getElementById('btn-refresh-leaderboard')?.addEventListener('click', () => {
            const pinLabel = document.getElementById('leaderboard-room-pin');
            if (pinLabel && pinLabel.innerText) {
                openLeaderboardModal(pinLabel.innerText);
            }
        });
    }

    return {
        init,
        hostExamRoom,
        fetchRoomByPin,
        submitRoomResult,
        fetchRoomLeaderboard,
        openHostModal,
        openLeaderboardModal,
        getActiveSession,
        setActiveSession: (sess) => {
            currentActiveRoom = sess;
            sessionStorage.setItem(ACTIVE_ROOM_KEY, JSON.stringify(sess));
        },
        clearActiveSession
    };
})();

// Auto initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', RoomManager.init);
} else {
    RoomManager.init();
}
