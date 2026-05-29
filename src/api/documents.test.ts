import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as docsApi from './documents'
import { wireFrom } from '../test/sbMock'

const { fromMock, uploadMock, signedUrlMock, storageFromMock } = vi.hoisted(() => {
  const uploadMock = vi.fn()
  const signedUrlMock = vi.fn()
  const storageFromMock = vi.fn(() => ({ upload: uploadMock, createSignedUrl: signedUrlMock }))
  return { fromMock: vi.fn(), uploadMock, signedUrlMock, storageFromMock }
})

vi.mock('../lib/supabase', () => ({
  supabase: { from: fromMock, storage: { from: storageFromMock } },
  setRememberMe: vi.fn(),
}))

beforeEach(() => {
  fromMock.mockReset()
  uploadMock.mockReset()
  signedUrlMock.mockReset()
  storageFromMock.mockClear()
})

describe('listDocumentsByCustomer', () => {
  it('按 customer_id、排除归档', async () => {
    const b = wireFrom(fromMock, { documents: { data: [] } })
    await docsApi.listDocumentsByCustomer('cust1')
    expect(fromMock).toHaveBeenCalledWith('documents')
    expect(b.documents.eq).toHaveBeenCalledWith('customer_id', 'cust1')
    expect(b.documents.eq).toHaveBeenCalledWith('is_archived', false)
  })
})

describe('listDocumentsByCase', () => {
  it('按 case_id 过滤', async () => {
    const b = wireFrom(fromMock, { documents: { data: [] } })
    await docsApi.listDocumentsByCase('case1')
    expect(b.documents.eq).toHaveBeenCalledWith('case_id', 'case1')
  })
})

describe('listAllDocuments', () => {
  it('排除归档、仅取有实体文件(storage_path 非空)的，按上传时间倒序', async () => {
    const b = wireFrom(fromMock, { documents: { data: [] } })
    await docsApi.listAllDocuments()
    expect(fromMock).toHaveBeenCalledWith('documents')
    expect(b.documents.eq).toHaveBeenCalledWith('is_archived', false)
    expect(b.documents.not).toHaveBeenCalledWith('storage_path', 'is', null)
    expect(b.documents.order).toHaveBeenCalledWith('created_at', { ascending: false })
  })
})

describe('createDocument', () => {
  it('插入并返回', async () => {
    const row = { id: 'd1', customer_id: 'cust1', doc_type: 'passport' }
    const b = wireFrom(fromMock, { documents: { data: row } })
    const r = await docsApi.createDocument({ customer_id: 'cust1', doc_type: 'passport' })
    expect(b.documents.insert).toHaveBeenCalledWith({ customer_id: 'cust1', doc_type: 'passport' })
    expect(r).toEqual(row)
  })
})

describe('updateDocument', () => {
  it('按 id 更新', async () => {
    const b = wireFrom(fromMock, { documents: { data: { id: 'd1' } } })
    await docsApi.updateDocument('d1', { title: '新标题' })
    expect(b.documents.update).toHaveBeenCalledWith({ title: '新标题' })
    expect(b.documents.eq).toHaveBeenCalledWith('id', 'd1')
  })
})

describe('archiveDocument', () => {
  it('软删除：update({is_archived:true})，不 delete', async () => {
    const b = wireFrom(fromMock, { documents: {} })
    await docsApi.archiveDocument('d1')
    expect(b.documents.update).toHaveBeenCalledWith({ is_archived: true })
    expect(b.documents.delete).not.toHaveBeenCalled()
  })
})

describe('buildStoragePath', () => {
  it('以 customer/case 开头，文件名安全化（空格→_）', () => {
    expect(docsApi.buildStoragePath('cust1', 'case1', 'my photo.png', 'X')).toBe(
      'cust1/case1/X-my_photo.png',
    )
  })
  it('无 case 用 general', () => {
    expect(docsApi.buildStoragePath('cust1', null, 'a.pdf', 'X')).toBe('cust1/general/X-a.pdf')
  })
})

describe('uploadFile', () => {
  it('上传到私有 bucket case-files，返回 storage_path + file_name', async () => {
    uploadMock.mockResolvedValue({ data: { path: 'p' }, error: null })
    const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' })
    const r = await docsApi.uploadFile(file, 'cust1', 'case1')
    expect(storageFromMock).toHaveBeenCalledWith('case-files')
    const [pathArg, fileArg] = uploadMock.mock.calls[0]
    expect(pathArg).toMatch(/^cust1\/case1\//)
    expect(fileArg).toBe(file)
    expect(r.file_name).toBe('doc.pdf')
    expect(r.storage_path).toMatch(/^cust1\/case1\//)
  })
})

describe('getDocumentSignedUrl', () => {
  it('用 createSignedUrl 返回短时链接（不用公开 URL）', async () => {
    signedUrlMock.mockResolvedValue({ data: { signedUrl: 'https://signed' }, error: null })
    const url = await docsApi.getDocumentSignedUrl('cust1/case1/x.pdf')
    expect(storageFromMock).toHaveBeenCalledWith('case-files')
    expect(signedUrlMock).toHaveBeenCalledWith('cust1/case1/x.pdf', expect.any(Number))
    expect(url).toBe('https://signed')
  })
})
