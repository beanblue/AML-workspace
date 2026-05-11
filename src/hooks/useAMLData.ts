import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { notionService } from '../services/notionService'
import { agentService } from '../services/agentService'
import type { AMLModule } from '../types'

type AMLAction = 'query' | 'agentAdvice'

interface UseAMLDataResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  setData: Dispatch<SetStateAction<T | null>>
}

export function useAMLData<T>(
  module: AMLModule,
  action: AMLAction,
  params?: Record<string, unknown>,
): UseAMLDataResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const stableParams = useMemo(() => params ?? {}, [params])

  const requestData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      if (action === 'agentAdvice') {
        const response = await agentService.generateAdvice({
          module,
          scene: String(stableParams.scene ?? '默认场景'),
          context: stableParams,
        })
        setData(response.data as T)
      } else {
        const response = await notionService.queryModuleData<T>(module, stableParams)
        setData(response.data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '数据请求失败')
    } finally {
      setLoading(false)
    }
  }, [action, module, stableParams])

  useEffect(() => {
    void requestData()
  }, [requestData])

  return {
    data,
    loading,
    error,
    refetch: requestData,
    setData,
  }
}
