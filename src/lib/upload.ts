/**
 * 上传文件大小限制（单一事实来源）：
 * api/documents.uploadFile 是全部上传的咽喉（客户文件 / 发票 / 档案），在那里强制；
 * 各上传 UI 用 UPLOAD_LIMIT_HINT 提示用户。
 * 20MB：覆盖扫描件/护照照片绰绰有余，也远低于 Supabase 免费版单对象 50MB 上限。
 */
export const MAX_UPLOAD_MB = 20
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
export const UPLOAD_LIMIT_HINT = `单个文件最大 ${MAX_UPLOAD_MB}MB`

/** 超限返回错误文案（含实际大小），合规返回 null。 */
export function uploadSizeError(file: { size: number; name?: string }): string | null {
  if (file.size <= MAX_UPLOAD_BYTES) return null
  const mb = Math.round((file.size / 1024 / 1024) * 10) / 10
  return `文件${file.name ? `「${file.name}」` : ''}约 ${mb}MB，超过 ${MAX_UPLOAD_MB}MB 上限，请压缩后再传`
}
