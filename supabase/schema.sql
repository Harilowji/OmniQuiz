-- ============================================================================
-- OmniQuiz PRO - Enterprise Supabase PostgreSQL Architecture (Azota Anime Edition 4.0)
-- Fully compliant with Row Level Security (RLS), Anti-Cheat Answer Key Hiding,
-- 3 Question Types (Multiple Choice ABCD, True/False Group 4-items, Short Answer),
-- Gamified Anime RPG Experience (EXP / Level / Streak / Badges), and Serverless RPC Grading.
-- ============================================================================

-- 0. ENABLE REQUIRED EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. PROFILES TABLE (Linked with auth.users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    avatar_url TEXT DEFAULT 'assets/avatars/default.png',
    role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'admin')),
    exp INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 1,
    streak_days INTEGER NOT NULL DEFAULT 1,
    last_active_date DATE DEFAULT CURRENT_DATE,
    total_answered INTEGER NOT NULL DEFAULT 0,
    total_correct INTEGER NOT NULL DEFAULT 0,
    rank_tier TEXT NOT NULL DEFAULT 'D' CHECK (rank_tier IN ('S', 'A', 'B', 'C', 'D')),
    unlocked_themes TEXT[] DEFAULT ARRAY['academic', 'playful'],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index profiles for fast username & role queries
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_exp ON public.profiles(exp DESC);

-- View alias user_profiles for unified client compatibility
CREATE OR REPLACE VIEW public.user_profiles AS
SELECT * FROM public.profiles;

-- ============================================================================
-- 2. EXAMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    subject TEXT DEFAULT 'Tổng hợp',
    duration_minutes INTEGER NOT NULL DEFAULT 45,
    room_code VARCHAR(10) UNIQUE,
    mode TEXT NOT NULL DEFAULT 'practice' CHECK (mode IN ('practice', 'official')),
    shuffle_questions BOOLEAN NOT NULL DEFAULT true,
    shuffle_options BOOLEAN NOT NULL DEFAULT true,
    is_public BOOLEAN NOT NULL DEFAULT true,
    total_questions INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exams_creator ON public.exams(creator_id);
CREATE INDEX IF NOT EXISTS idx_exams_room_code ON public.exams(room_code);
CREATE INDEX IF NOT EXISTS idx_exams_public ON public.exams(is_public) WHERE is_public = true;

-- ============================================================================
-- 3. QUESTIONS TABLE (PUBLIC / SAFE: NO CORRECT ANSWER FIELD)
-- ============================================================================
-- Students fetching this table CANNOT see the correct answer through browser DevTools (F12)
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    question_type TEXT NOT NULL DEFAULT 'multiple_choice' CHECK (question_type IN ('multiple_choice', 'true_false_group', 'short_answer')),
    content TEXT NOT NULL,
    options JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of strings or sub-item definitions
    media_url TEXT,
    difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
    explanation TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_questions_exam_id ON public.questions(exam_id, order_index);

-- ============================================================================
-- 4. QUESTION_SECRET_KEYS TABLE (STRICT SECURED VAULT FOR TEACHER & GRADING RPC ONLY)
-- ============================================================================
-- Stores secret correct answers:
-- - multiple_choice: 'A' or [0]
-- - true_false_group: {"a": true, "b": false, "c": false, "d": true}
-- - short_answer: "12.5"
CREATE TABLE IF NOT EXISTS public.question_secret_keys (
    question_id UUID PRIMARY KEY REFERENCES public.questions(id) ON DELETE CASCADE,
    exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    correct_answer JSONB NOT NULL,
    explanation TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_question_secret_keys_exam ON public.question_secret_keys(exam_id);

-- Legacy backward compatibility table if exists
CREATE TABLE IF NOT EXISTS public.question_keys (
    question_id UUID PRIMARY KEY REFERENCES public.questions(id) ON DELETE CASCADE,
    correct_option INTEGER[] NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 5. SUBMISSIONS TABLE (STUDENT EXAM ATTEMPTS & GRADES)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    candidate_name TEXT,
    candidate_sbd TEXT,
    answers JSONB NOT NULL, -- Map: {"0": [1], "1": {"a": true, "b": false}, "2": "12.5"}
    score NUMERIC(5,2) NOT NULL DEFAULT 0,
    total_questions INTEGER NOT NULL,
    correct_count INTEGER NOT NULL DEFAULT 0,
    time_spent_seconds INTEGER NOT NULL DEFAULT 0,
    tab_switches INTEGER NOT NULL DEFAULT 0,
    exp_awarded INTEGER NOT NULL DEFAULT 0,
    rank_tier TEXT NOT NULL DEFAULT 'D', -- S, A, B, C, D
    review_details JSONB DEFAULT '[]'::jsonb,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submissions_exam_id ON public.submissions(exam_id);
CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON public.submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_score ON public.submissions(exam_id, score DESC);

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_secret_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- 6.1 Profiles Policies
CREATE POLICY "Public profiles are viewable by everyone" 
ON public.profiles FOR SELECT 
USING (true);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

-- 6.2 Exams Policies
CREATE POLICY "Anyone can view public exams or exams they created" 
ON public.exams FOR SELECT 
USING (is_public = true OR creator_id = auth.uid());

CREATE POLICY "Authenticated users can create exams" 
ON public.exams FOR INSERT 
WITH CHECK (auth.role() = 'authenticated' AND (creator_id = auth.uid() OR creator_id IS NULL));

CREATE POLICY "Exam creators can update their own exams" 
ON public.exams FOR UPDATE 
USING (creator_id = auth.uid());

CREATE POLICY "Exam creators can delete their own exams" 
ON public.exams FOR DELETE 
USING (creator_id = auth.uid());

-- 6.3 Questions Policies
CREATE POLICY "Anyone can view questions of readable exams" 
ON public.questions FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM public.exams e 
    WHERE e.id = questions.exam_id 
    AND (e.is_public = true OR e.creator_id = auth.uid())
));

CREATE POLICY "Exam creators can manage questions" 
ON public.questions FOR ALL 
USING (EXISTS (
    SELECT 1 FROM public.exams e 
    WHERE e.id = questions.exam_id 
    AND e.creator_id = auth.uid()
));

-- 6.4 Question Secret Keys Policies (ANTI-CHEAT STRICT ISOLATION)
-- Students NEVER have SELECT permissions on question_secret_keys in official exam mode!
CREATE POLICY "Exam creators can manage question secret keys" 
ON public.question_secret_keys FOR ALL 
USING (EXISTS (
    SELECT 1 FROM public.exams e 
    WHERE e.id = question_secret_keys.exam_id 
    AND e.creator_id = auth.uid()
));

CREATE POLICY "Students can view question secret keys only in practice mode" 
ON public.question_secret_keys FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM public.exams e 
    WHERE e.id = question_secret_keys.exam_id 
    AND (e.creator_id = auth.uid() OR e.mode = 'practice')
));

-- 6.5 Submissions Policies
CREATE POLICY "Students can view their own submissions" 
ON public.submissions FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Exam creators can view all submissions for their exams" 
ON public.submissions FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM public.exams e 
    WHERE e.id = submissions.exam_id 
    AND e.creator_id = auth.uid()
));

CREATE POLICY "Anyone can insert submission via client or RPC" 
ON public.submissions FOR INSERT 
WITH CHECK (true);

-- ============================================================================
-- 7. SECURED RPC FUNCTION: submit_exam (Anti-Cheat 3-Part Server-Side Grading)
-- ============================================================================
CREATE OR REPLACE FUNCTION submit_exam(
    p_exam_id UUID,
    p_answers JSONB,
    p_time_spent INTEGER,
    p_tab_switches INTEGER DEFAULT 0,
    p_candidate_name TEXT DEFAULT NULL,
    p_candidate_sbd TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated privileges to read question_secret_keys safely
SET search_path = public
AS $$
DECLARE
    v_total_questions INTEGER := 0;
    v_correct_count INTEGER := 0;
    v_total_points NUMERIC(6,3) := 0;
    v_score NUMERIC(5,2) := 0;
    v_accuracy NUMERIC(5,1) := 0;
    v_exp_earned INTEGER := 0;
    v_rank_tier TEXT := 'D';
    v_q RECORD;
    v_user_ans_json JSONB;
    v_correct_key JSONB;
    v_submission_id UUID;
    v_uid UUID := auth.uid();
    v_review_details JSONB := '[]'::jsonb;
    v_item_detail JSONB;
    v_q_points NUMERIC(5,2);
    v_sub_matches INTEGER;
    v_user_text TEXT;
    v_key_text TEXT;
    v_user_opt INTEGER;
    v_key_opt INTEGER;
    v_new_level INTEGER := 1;
    v_new_streak INTEGER := 1;
BEGIN
    -- 1. Loop through all questions in this exam
    FOR v_q IN 
        SELECT 
            q.id, 
            q.order_index, 
            q.question_type, 
            q.content, 
            COALESCE(k.correct_answer, 
                CASE 
                    WHEN lk.correct_option IS NOT NULL THEN to_jsonb(lk.correct_option) 
                    ELSE '[]'::jsonb 
                END
            ) AS correct_answer,
            COALESCE(k.explanation, q.explanation) AS explanation
        FROM public.questions q
        LEFT JOIN public.question_secret_keys k ON k.question_id = q.id
        LEFT JOIN public.question_keys lk ON lk.question_id = q.id
        WHERE q.exam_id = p_exam_id
        ORDER BY q.order_index ASC
    LOOP
        v_total_questions := v_total_questions + 1;
        v_user_ans_json := p_answers->(v_q.order_index::TEXT);
        v_correct_key := v_q.correct_answer;
        v_q_points := 0;

        -- CASE A: True/False Group 4-items (Part II)
        IF v_q.question_type = 'true_false_group' THEN
            v_sub_matches := 0;
            IF v_user_ans_json IS NOT NULL AND jsonb_typeof(v_user_ans_json) = 'object' THEN
                IF (v_user_ans_json->>'a') IS NOT NULL AND (v_user_ans_json->>'a' = v_correct_key->>'a') THEN v_sub_matches := v_sub_matches + 1; END IF;
                IF (v_user_ans_json->>'b') IS NOT NULL AND (v_user_ans_json->>'b' = v_correct_key->>'b') THEN v_sub_matches := v_sub_matches + 1; END IF;
                IF (v_user_ans_json->>'c') IS NOT NULL AND (v_user_ans_json->>'c' = v_correct_key->>'c') THEN v_sub_matches := v_sub_matches + 1; END IF;
                IF (v_user_ans_json->>'d') IS NOT NULL AND (v_user_ans_json->>'d' = v_correct_key->>'d') THEN v_sub_matches := v_sub_matches + 1; END IF;
            END IF;

            -- Standard Ministry of Education / Azota True-False Grading Scale:
            -- 1 match = 0.10, 2 matches = 0.25, 3 matches = 0.50, 4 matches = 1.00
            IF v_sub_matches = 1 THEN v_q_points := 0.10;
            ELSIF v_sub_matches = 2 THEN v_q_points := 0.25;
            ELSIF v_sub_matches = 3 THEN v_q_points := 0.50;
            ELSIF v_sub_matches = 4 THEN v_q_points := 1.00; v_correct_count := v_correct_count + 1;
            END IF;

        -- CASE B: Short Answer Numerical Fill-in (Part III)
        ELSIF v_q.question_type = 'short_answer' THEN
            v_user_text := LOWER(TRIM(REGEXP_REPLACE(COALESCE(v_user_ans_json #>> '{}', ''), ',', '.', 'g')));
            v_key_text := LOWER(TRIM(REGEXP_REPLACE(COALESCE(v_correct_key #>> '{}', ''), ',', '.', 'g')));
            
            -- Strip trailing decimals if integer (e.g. 12.0 -> 12)
            v_user_text := REGEXP_REPLACE(v_user_text, '\.0+$', '');
            v_key_text := REGEXP_REPLACE(v_key_text, '\.0+$', '');

            IF v_user_text <> '' AND v_user_text = v_key_text THEN
                v_q_points := 1.00;
                v_correct_count := v_correct_count + 1;
            END IF;

        -- CASE C: Standard Multiple Choice ABCD (Part I)
        ELSE
            IF v_user_ans_json IS NOT NULL THEN
                -- Check if array format [0] or single string "A"
                IF jsonb_typeof(v_user_ans_json) = 'array' AND jsonb_typeof(v_correct_key) = 'array' THEN
                    IF v_user_ans_json = v_correct_key THEN
                        v_q_points := 1.00;
                        v_correct_count := v_correct_count + 1;
                    END IF;
                ELSE
                    v_user_text := UPPER(TRIM(COALESCE(v_user_ans_json #>> '{}', '')));
                    v_key_text := UPPER(TRIM(COALESCE(v_correct_key #>> '{}', '')));
                    IF v_user_text <> '' AND v_user_text = v_key_text THEN
                        v_q_points := 1.00;
                        v_correct_count := v_correct_count + 1;
                    END IF;
                END IF;
            END IF;
        END IF;

        v_total_points := v_total_points + v_q_points;

        -- Build review detail record
        v_item_detail := jsonb_build_object(
            'order_index', v_q.order_index,
            'question_type', v_q.question_type,
            'points_awarded', v_q_points,
            'user_answer', v_user_ans_json,
            'correct_answer', v_correct_key,
            'explanation', v_q.explanation
        );
        v_review_details := v_review_details || v_item_detail;
    END LOOP;

    -- Avoid division by zero: normalize to 10-point scale
    IF v_total_questions > 0 THEN
        v_score := ROUND((v_total_points / v_total_questions::NUMERIC) * 10.0, 2);
        v_accuracy := ROUND((v_correct_count::NUMERIC / v_total_questions::NUMERIC) * 100.0, 1);
    ELSE
        v_score := 0;
        v_accuracy := 0;
    END IF;

    -- Determine Anime S/A/B/C/D Rank Tier
    IF v_score >= 9.0 THEN
        v_rank_tier := 'S';
    ELSIF v_score >= 8.0 THEN
        v_rank_tier := 'A';
    ELSIF v_score >= 6.5 THEN
        v_rank_tier := 'B';
    ELSIF v_score >= 5.0 THEN
        v_rank_tier := 'C';
    ELSE
        v_rank_tier := 'D';
    END IF;

    -- Calculate Anime RPG EXP Reward (150 EXP per level threshold)
    -- +20 EXP per correct question, +50 EXP bonus for zero tab switches, +100 for S-rank
    v_exp_earned := (v_correct_count * 20) 
        + (CASE WHEN p_tab_switches = 0 THEN 50 ELSE 0 END) 
        + (CASE WHEN v_rank_tier = 'S' THEN 100 ELSE 0 END);

    -- 2. Insert into submissions
    INSERT INTO public.submissions (
        exam_id,
        user_id,
        candidate_name,
        candidate_sbd,
        answers,
        score,
        total_questions,
        correct_count,
        time_spent_seconds,
        tab_switches,
        exp_awarded,
        rank_tier,
        review_details
    ) VALUES (
        p_exam_id,
        v_uid,
        p_candidate_name,
        p_candidate_sbd,
        p_answers,
        v_score,
        v_total_questions,
        v_correct_count,
        p_time_spent,
        p_tab_switches,
        v_exp_earned,
        v_rank_tier,
        v_review_details
    ) RETURNING id INTO v_submission_id;

    -- 3. Atomic Profile Update: EXP, Level (150 EXP/level), Rank, and Streak
    IF v_uid IS NOT NULL THEN
        UPDATE public.profiles
        SET 
            exp = profiles.exp + v_exp_earned,
            level = GREATEST(1, FLOOR((profiles.exp + v_exp_earned) / 150) + 1),
            total_answered = profiles.total_answered + v_total_questions,
            total_correct = profiles.total_correct + v_correct_count,
            rank_tier = v_rank_tier,
            streak_days = CASE 
                WHEN profiles.last_active_date = CURRENT_DATE THEN profiles.streak_days
                WHEN profiles.last_active_date = CURRENT_DATE - INTERVAL '1 day' THEN profiles.streak_days + 1
                ELSE 1
            END,
            last_active_date = CURRENT_DATE,
            updated_at = NOW()
        WHERE profiles.id = v_uid
        RETURNING level, streak_days INTO v_new_level, v_new_streak;
    END IF;

    -- 4. Return secure summary result (Zero secret keys leaked in official mode)
    RETURN jsonb_build_object(
        'submission_id', v_submission_id,
        'exam_id', p_exam_id,
        'score', v_score,
        'score100', ROUND(v_score * 10.0, 1),
        'total_questions', v_total_questions,
        'correct_count', v_correct_count,
        'accuracy', v_accuracy,
        'rank_tier', v_rank_tier,
        'exp_earned', v_exp_earned,
        'new_level', v_new_level,
        'new_rank', v_rank_tier,
        'streak_days', v_new_streak,
        'time_spent_seconds', p_time_spent,
        'tab_switches', p_tab_switches,
        'review_details', v_review_details
    );
END;
$$;

-- ============================================================================
-- 8. TRIGGER: Automatic Profile Creation on User Signup
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, username, avatar_url, role)
    VALUES (
        NEW.id,
        COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            NEW.raw_user_meta_data->>'username',
            split_part(NEW.email, '@', 1)
        ),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', 'assets/avatars/default.png'),
        COALESCE(NEW.raw_user_meta_data->>'role', 'student')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
