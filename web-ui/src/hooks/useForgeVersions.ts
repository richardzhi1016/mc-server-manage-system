import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api'

interface ForgeVersionsResult {
    versions: string[]
    latestVersion: string
    isLoading: boolean
    error: Error | null
    refetch: () => void
}

// Cache by MC version string to avoid redundant requests
const cache: Record<string, string[]> = {}

export function useForgeVersions(mcVersion: string): ForgeVersionsResult {
    const [versions, setVersions] = useState<string[]>(() => cache[mcVersion] ?? [])
    const [isLoading, setIsLoading] = useState(!cache[mcVersion] && !!mcVersion)
    const [error, setError] = useState<Error | null>(null)

    const fetchVersions = useCallback(async () => {
        if (!mcVersion) {
            setVersions([])
            setIsLoading(false)
            return
        }
        setIsLoading(true)
        setError(null)
        try {
            const response = await apiClient.get<{ versions: string[] }>(
                `/api/forge/versions?mc_version=${encodeURIComponent(mcVersion)}`
            )
            const data = response.data.versions
            cache[mcVersion] = data
            setVersions(data)
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to fetch Forge versions'))
            setVersions([])
        } finally {
            setIsLoading(false)
        }
    }, [mcVersion])

    useEffect(() => {
        if (cache[mcVersion]) {
            setVersions(cache[mcVersion])
            setIsLoading(false)
        } else {
            fetchVersions()
        }
    }, [mcVersion, fetchVersions])

    const refetch = useCallback(() => {
        delete cache[mcVersion]
        fetchVersions()
    }, [mcVersion, fetchVersions])

    return {
        versions,
        latestVersion: versions[0] ?? '',
        isLoading,
        error,
        refetch,
    }
}
