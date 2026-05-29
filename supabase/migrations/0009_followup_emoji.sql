-- ============================================================================
-- 0009 — 跟进记录的 emoji 标记
-- 在 Supabase Dashboard → SQL Editor 整段粘贴运行。
--
-- 给 follow_ups 增加 emoji_marker（可空 text）：在「记录」统一表里作为跟进行的标记，
-- 可选项 ❓ ⚠️ ‼️ 💬 ℹ️ 📞 ✉️（前端常量，见 src/types/domain.ts FOLLOW_UP_EMOJIS），空则默认显示 💬。
-- 选项配置放前端、不入库；原 channel 列保留不动。
-- 纯增量、可重复执行。
-- ============================================================================

alter table public.follow_ups add column if not exists emoji_marker text;
