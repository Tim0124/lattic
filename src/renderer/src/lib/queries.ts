import { useEffect } from 'react'
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import type { VaultFile, NoteDoc } from 'src/share/types'

export function useFiles(): UseQueryResult<VaultFile[]> {
  return useQuery({
    queryKey: ['files'],
    queryFn: () => window.api.listFiles()
  })
}

export function useNote(path: string | null): UseQueryResult<NoteDoc | null> {
  return useQuery({
    queryKey: ['note', path],
    queryFn: () => window.api.readNote(path!),
    enabled: path !== null
  })
}

/** vault 檔案變動時讓所有筆記資料失效重抓（資料只在 vault 變動時才會變，搭配 staleTime: Infinity） */
export function useVaultInvalidation(): void {
  const queryClient = useQueryClient()
  useEffect(() => {
    return window.api.onVaultChanged(() => {
      void queryClient.invalidateQueries({ queryKey: ['files'] })
      void queryClient.invalidateQueries({ queryKey: ['note'] })
    })
  }, [queryClient])
}
