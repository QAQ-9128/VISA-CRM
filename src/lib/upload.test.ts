import { describe, expect, it } from 'vitest'
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, uploadSizeError } from './upload'

describe('uploadSizeError（上传大小限制）', () => {
  it(`限额 ${MAX_UPLOAD_MB}MB：恰好等于 → 放行`, () => {
    expect(uploadSizeError({ size: MAX_UPLOAD_BYTES })).toBeNull()
    expect(uploadSizeError({ size: 1024 })).toBeNull()
  })
  it('超限 → 错误文案含文件名、实际大小与上限', () => {
    const msg = uploadSizeError({ size: 25.4 * 1024 * 1024, name: '护照扫描.pdf' })
    expect(msg).toContain('护照扫描.pdf')
    expect(msg).toContain('25.4MB')
    expect(msg).toContain(`${MAX_UPLOAD_MB}MB`)
  })
  it('无文件名也能给出可读错误', () => {
    const msg = uploadSizeError({ size: MAX_UPLOAD_BYTES + 1 })
    expect(msg).toContain(`${MAX_UPLOAD_MB}MB`)
  })
})
