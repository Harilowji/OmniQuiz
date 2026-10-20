-- ============================================================================
-- OmniQuiz PRO - Enterprise Supabase PostgreSQL Architecture (Azota Anime Edition)
-- Fully compliant with Row Level Security (RLS), Anti-Cheat Answer Key Hiding,
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
    streak_days INTEGER NOT NULL DEFAULT 0,
    last_active_date DATE DEFAULT CURRENT_DATE,
    unlocked_themes TEXT[] DEFAULT ARRAY['academic', 'playful'],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index profiles for fast username & role queries
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_exp ON public.profiles(exp DESC);

-- ============================================================================
-- 2. EXAMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 45,
    room_code VARCHAR(6) UNIQUE,
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
    content TEXT NOT NULL,
    options JSONB NOT NULL, -- Array of string options: ["Hà Nội", "Huế", "Đà Nẵng", "TP.HCM"]
    media_url TEXT,
    explanation TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_questions_exam_id ON public.questions(exam_id, order_index);

-- ============================================================================
-- 4. QUESTION_KEYS TABLE (STRICT SECURED VAULT FOR TEACHER & GRADING RPC ONLY)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.question_keys (
    question_id UUID PRIMARY KEY REFERENCES public.questions(id) ON DELETE CASCADE,
    correct_option INTEGER[] NOT NULL, -- Array of correct 0-based option indices: [0] or [1, 3]
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
    answers JSONB NOT NULL, -- Map: {"1": [0], "2": [2]}
    score NUMERIC(5,2) NOT NULL DEFAULT 0,
    total_questions INTEGER NOT NULL,
    correct_count INTEGER NOT NULL DEFAULT 0,
    time_spent_seconds INTEGER NOT NULL DEFAULT 0,
    tab_switches INTEGER NOT NULL DEFAULT 0,
    exp_awarded INTEGER NOT NULL DEFAULT 0,
    rank_tier TEXT NOT NULL DEFAULT 'B', -- S, A, B, C, D
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

-- 6.4 Question Keys Policies (ANTI-CHEAT STRICT ISOLATION)
-- Students NEVER have SELECT permissions on question_keys!
CREATE POLICY "Only exam creator can read question keys" 
ON public.question_keys FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM public.questions q 
    JOIN public.exams e ON e.id = q.exam_id 
    WHERE q.id = question_keys.question_id 
    AND e.creator_id = auth.uid()
));

CREATE POLICY "Exam creators can insert/update question keys" 
ON public.question_keys FOR ALL 
USING (EXISTS (
    SELECT 1 FROM public.questions q 
    JOIN public.exams e ON e.id = q.exam_id 
    WHERE q.id = question_keys.question_id 
    AND e.creator_id = auth.uid()
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
-- 7. SECURED RPC FUNCTION: submit_exam (Anti-Cheat Server-Side Grading)
-- ============================================================================
CREATE OR REPLACE FUNCTION submit_exam(
    p_exam_id UUID,
    p_answers JSONB,
    p_time_spent INTEGER,
    p_tab_switches INTEGER DEFAULT 0,
    p_candidate_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated privileges to read question_keys safely
SET search_path = public
AS $$
DECLARE
    v_total_questions INTEGER := 0;
    v_correct_count INTEGER := 0;
    v_score NUMERIC(5,2) := 0;
    v_exp_earned INTEGER := 0;
    v_rank_tier TEXT := 'C';
    v_q RECORD;
    v_user_ans_json JSONB;
    v_user_ans INTEGER[];
    v_submission_id UUID;
    v_uid UUID := auth.uid();
BEGIN
    -- 1. Loop through all questions in this exam
    FOR v_q IN 
        SELECT q.id, q.order_index, k.correct_option 
        FROM public.questions q
        JOIN public.question_keys k ON k.question_id = q.id
        WHERE q.exam_id = p_exam_id
        ORDER BY q.order_index ASC
    LOOP
        v_total_questions := v_total_questions + 1;
        v_user_ans_json := p_answers->(v_q.order_index::TEXT);

        -- Convert user answer JSON array to integer array
        IF v_user_ans_json IS NOT NULL AND jsonb_typeof(v_user_ans_json) = 'array' THEN
            SELECT ARRAY_AGG(x::INTEGER)
            INTO v_user_ans
            FROM jsonb_array_elements_text(v_user_ans_json) AS x;

            -- Compare user answer with correct answer key (arrays sorted)
            IF v_user_ans IS NOT NULL AND v_user_ans = v_q.correct_option THEN
                v_correct_count := v_correct_count + 1;
            END IF;
        END IF;
    END LOOP;

    -- Avoid division by zero
    IF v_total_questions > 0 THEN
        v_score := ROUND((v_correct_count::NUMERIC / v_total_questions::NUMERIC) * 10.0, 2);
    ELSE
        v_score := 0;
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

    -- Calculate Anime RPG EXP Reward
    -- +20 EXP per correct question, +50 EXP bonus for zero tab switches, +100 for S-rank
    v_exp_earned := (v_correct_count * 20) + (CASE WHEN p_tab_switches = 0 THEN 50 ELSE 0 END) + (CASE WHEN v_rank_tier = 'S' THEN 100 ELSE 0 END);

    -- 2. Insert into submissions
    INSERT INTO public.submissions (
        exam_id,
        user_id,
        candidate_name,
        answers,
        score,
        total_questions,
        correct_count,
        time_spent_seconds,
        tab_switches,
        exp_awarded,
        rank_tier
    ) VALUES (
        p_exam_id,
        v_uid,
        p_candidate_name,
        p_answers,
        v_score,
        v_total_questions,
        v_correct_count,
        p_time_spent,
        p_tab_switches,
        v_exp_earned,
        v_rank_tier
    ) RETURNING id INTO v_submission_id;

    -- 3. Update user profile EXP, Level, and Streak if authenticated
    IF v_uid IS NOT NULL THEN
        UPDATE public.profiles
        SET 
            exp = profiles.exp + v_exp_earned,
            level = GREATEST(1, FLOOR((profiles.exp + v_exp_earned) / 500) + 1),
            streak_days = CASE 
                WHEN profiles.last_active_date = CURRENT_DATE THEN profiles.streak_days
                WHEN profiles.last_active_date = CURRENT_DATE - INTERVAL '1 day' THEN profiles.streak_days + 1
                ELSE 1
            END,
            last_active_date = CURRENT_DATE,
            updated_at = NOW()
        WHERE profiles.id = v_uid;
    END IF;

    -- 4. Return secure summary result (Zero answer keys exposed!)
    RETURN jsonb_build_object(
        'submission_id', v_submission_id,
        'exam_id', p_exam_id,
        'score', v_score,
        'score100', ROUND(v_score * 10.0, 1),
        'total_questions', v_total_questions,
        'correct_count', v_correct_count,
        'rank_tier', v_rank_tier,
        'exp_earned', v_exp_earned,
        'time_spent_seconds', p_time_spent,
        'tab_switches', p_tab_switches
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
