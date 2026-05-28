import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// 每个测试后卸载 React 树，避免相互污染
afterEach(() => {
  cleanup()
})
