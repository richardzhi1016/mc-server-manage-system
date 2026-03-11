import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api'

interface FabricVersionEntry {
    version: string
    stable: boolean
}

interface FabricGameVersionsResult {
    versions: string[]
    latestRelease: string
    isLoading: boolean
    error: Error | null
    refetch: () => void
}

interface FabricLoaderVersionsResult {
    versions: string[]
    latestStable: string
    isLoading: boolean
    error: Error | null
    refetch: () => void
}

interface FabricInstallerVersionsResult {
    versions: string[]
    latestStable: string
    isLoading: boolean
    error: Error | null
    refetch: () => void
}

// Module-level cache for game versions
let cachedGameVersions: string[] | null = null
let cachedGameLatestRelease: string | null = null

// Module-level cache for loader versions
let cachedLoaderVersions: string[] | null = null
let cachedLoaderLatestStable: string | null = null

// Module-level cache for installer versions
let cachedInstallerVersions: string[] | null = null
let cachedInstallerLatestStable: string | null = null

export function useFabricGameVersions(): FabricGameVersionsResult {
    const [versions, setVersions] = useState<string[]>(cachedGameVersions || [])
    const [latestRelease, setLatestRelease] = useState<string>(cachedGameLatestRelease || '')
    const [isLoading, setIsLoading] = useState(!cachedGameVersions)
    const [error, setError] = useState<Error | null>(null)

    const fetchVersions = useCallback(async () => {
        setIsLoading(true)
        setError(null)

        try {
            const response = await apiClient.get<FabricVersionEntry[]>('/api/fabric/game-versions')
            const data = response.data

            // Filter to stable releases only
            const stableVersions = data
                .filter((v) => v.stable)
                .map((v) => v.version)

            const latest = stableVersions[0] || ''

            // Cache
            cachedGameVersions = stableVersions
            cachedGameLatestRelease = latest

            setVersions(stableVersions)
            setLatestRelease(latest)
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to fetch Fabric game versions')
            setError(error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        if (!cachedGameVersions) {
            fetchVersions()
        }
    }, [fetchVersions])

    const refetch = useCallback(() => {
        cachedGameVersions = null
        cachedGameLatestRelease = null
        fetchVersions()
    }, [fetchVersions])

    return { versions, latestRelease, isLoading, error, refetch }
}

export function useFabricLoaderVersions(): FabricLoaderVersionsResult {
    const [versions, setVersions] = useState<string[]>(cachedLoaderVersions || [])
    const [latestStable, setLatestStable] = useState<string>(cachedLoaderLatestStable || '')
    const [isLoading, setIsLoading] = useState(!cachedLoaderVersions)
    const [error, setError] = useState<Error | null>(null)

    const fetchVersions = useCallback(async () => {
        setIsLoading(true)
        setError(null)

        try {
            const response = await apiClient.get<FabricVersionEntry[]>('/api/fabric/loader-versions')
            const data = response.data

            // Include all loader versions (only one is typically stable)
            const allVersions = data.map((v) => v.version)
            const stableEntry = data.find((v) => v.stable)
            const latest = stableEntry?.version || allVersions[0] || ''

            // Cache
            cachedLoaderVersions = allVersions
            cachedLoaderLatestStable = latest

            setVersions(allVersions)
            setLatestStable(latest)
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to fetch Fabric loader versions')
            setError(error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        if (!cachedLoaderVersions) {
            fetchVersions()
        }
    }, [fetchVersions])

    const refetch = useCallback(() => {
        cachedLoaderVersions = null
        cachedLoaderLatestStable = null
        fetchVersions()
    }, [fetchVersions])

    return { versions, latestStable, isLoading, error, refetch }
}

export function useFabricInstallerVersions(): FabricInstallerVersionsResult {
    const [versions, setVersions] = useState<string[]>(cachedInstallerVersions || [])
    const [latestStable, setLatestStable] = useState<string>(cachedInstallerLatestStable || '')
    const [isLoading, setIsLoading] = useState(!cachedInstallerVersions)
    const [error, setError] = useState<Error | null>(null)

    const fetchVersions = useCallback(async () => {
        setIsLoading(true)
        setError(null)

        try {
            const response = await apiClient.get<FabricVersionEntry[]>('/api/fabric/installer-versions')
            const data = response.data

            // Filter to stable versions only
            const stableVersions = data
                .filter((v) => v.stable)
                .map((v) => v.version)

            const latest = stableVersions[0] || ''

            // Cache
            cachedInstallerVersions = stableVersions
            cachedInstallerLatestStable = latest

            setVersions(stableVersions)
            setLatestStable(latest)
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to fetch Fabric installer versions')
            setError(error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        if (!cachedInstallerVersions) {
            fetchVersions()
        }
    }, [fetchVersions])

    const refetch = useCallback(() => {
        cachedInstallerVersions = null
        cachedInstallerLatestStable = null
        fetchVersions()
    }, [fetchVersions])

    return { versions, latestStable, isLoading, error, refetch }
}
