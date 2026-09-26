-- =============================================================================
-- Migration 004: Participant Identity, Status Semantics, Notifications & Audit Logs
-- [SRS 3.1 SV-01, SV-02, SV-03, SV-04, SRS 3.2 AD-01, AD-02, SRS 6.2]
-- =============================================================================

-- 1. Bổ sung các cột định danh, KYC và trạng thái hoạt động cho bảng participants
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS student_id TEXT UNIQUE;
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS phone_number CHARACTER VARYING;
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS university_name CHARACTER VARYING;
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS student_card_url TEXT;
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS selfie_with_student_card_url TEXT;
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE;

-- Ràng buộc kiểm tra trạng thái và loại tài khoản chuẩn hóa
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_participant_status'
    ) THEN
        ALTER TABLE public.participants ADD CONSTRAINT chk_participant_status
            CHECK (status IN ('pending', 'approved', 'rejected'));
    END IF;
END $$;

-- 2. Bảng notifications (Thông báo hệ thống cho Sinh viên & Quản trị)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    recipient_type CHARACTER VARYING NOT NULL, -- 'user', 'participant'
    recipient_id TEXT NOT NULL, -- ID người nhận
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type CHARACTER VARYING NOT NULL, -- 'kyc_status', 'team_request', 'match_schedule', 'checkin_status', 'certificate_issued', 'system'
    metadata JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT notifications_pkey PRIMARY KEY (id),
    CONSTRAINT chk_recipient_type CHECK (recipient_type IN ('user', 'participant'))
);

-- 3. Bảng audit_logs (Nhật ký kiểm tra phục vụ bảo mật và audit hành vi quản trị)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    actor_id TEXT NOT NULL,
    actor_role CHARACTER VARYING NOT NULL, -- 'admin', 'ctv', 'participant', 'system'
    action CHARACTER VARYING NOT NULL, -- 'APPROVE_STUDENT', 'REJECT_STUDENT', 'LOCK_PARTICIPANT', 'UNLOCK_PARTICIPANT', 'UPDATE_STUDENT_STATUS'...
    target_table CHARACTER VARYING NOT NULL,
    target_id TEXT,
    payload JSONB DEFAULT '{}'::jsonb,
    ip_address CHARACTER VARYING,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT audit_logs_pkey PRIMARY KEY (id)
);

-- Tạo chỉ mục tìm kiếm tối ưu
CREATE INDEX IF NOT EXISTS idx_participants_status ON public.participants (status);
CREATE INDEX IF NOT EXISTS idx_participants_account_type ON public.participants (account_type);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications (recipient_type, recipient_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON public.audit_logs (target_table, target_id);
