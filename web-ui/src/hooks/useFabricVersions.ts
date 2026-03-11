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

// Module-level cache stores ALL raw entries (unfiltered)
let cachedGameEntries: FabricVersionEntry[] | null = null
let cachedGameLatestRelease: string | null = null

let cachedLoaderEntries: FabricVersionEntry[] | null = null
let cachedLoaderLatestStable: string | null = null

let cachedInstallerEntries: FabricVersionEntry[] | null = null
let cachedInstallerLatestStable: string | null = null

export function useFabricGameVersions(stableOnly: boolean = true): FabricGameVersionsResult {
    const [entries, setEntries] = useState<FabricVersionEntry[]>(cachedGameEntries || [])
    const [latestRelease, setLatestRelease] = useState<string>(cachedGameLatestRelease || '')
    const [isLoading, setIsLoading] = useState(!cachedGameEntries)
    const [error, setError] = useState<Error | null>(null)

    const fetchVersions = useCallback(async () => {
        setIsLoading(true)
        setError(null)

        try {
            const response = await apiClient.get<FabricVersionEntry[]>('/api/fabric/game-versions')
            const data = response.data

            const stableEntry = data.find((v) => v.stable)
            const latest = stableEntry?.version || data[0]?.version || ''

            cachedGameEntries = data
            cachedGameLatestRelease = latest

            setEntries(data)
            setLatestRelease(latest)
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to fetch Fabric game versions')
            setError(error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        if (!cachedGameEntries) {
            fetchVersions()
        }
    }, [fetchVersions])

    const refetch = useCallback(() => {
        cachedGameEntries = null
        cachedGameLatestRelease = null
        fetchVersions()
    }, [fetchVersions])

    const versions = stableOnly
        ? entries.filter((v) => v.stable).map((v) => v.version)
        : entries.map((v) => v.version)

    return { versions, latestRelease, isLoading, error, refetch }
}

export function useFabricLoaderVersions(stableOnly: boolean = false): FabricLoaderVersionsResult {
    const [entries, setEntries] = useState<FabricVersionEntry[]>(cachedLoaderEntries || [])
    const [latestStable, setLatestStable] = useState<string>(cachedLoaderLatestStable || '')
    const [isLoading, setIsLoading] = useState(!cachedLoaderEntries)
    const [error, setError] = useState<Error | null>(null)

    const fetchVersions = useCallback(async () => {
        setIsLoading(true)
        setError(null)

        try {
            const response = await apiClient.get<FabricVersionEntry[]>('/api/fabric/loader-versions')
            const data = response.data

            const stableEntry = data.find((v) => v.stable)
            const latest = stableEntry?.version || data[0]?.version || ''

            cachedLoaderEntries = data
            cachedLoaderLatestStable = latest

            setEntries(data)
            setLatestStable(latest)
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to fetch Fabric loader versions')
            setError(error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        if (!cachedLoaderEntries) {
            fetchVersions()
        }
    }, [fetchVersions])

    const refetch = useCallback(() => {
        cachedLoaderEntries = null
        cachedLoaderLatestStable = null
        fetchVersions()
    }, [fetchVersions])

    const versions = stableOnly
        ? entries.filter((v) => v.stable).map((v) => v.version)
        : entries.map((v) => v.version)

    return { versions, latestStable, isLoading, error, refetch }
}

export function useFabricInstallerVersions(stableOnly: boolean = true): FabricInstallerVersionsResult {
    const [entries, setEntries] = useState<FabricVersionEntry[]>(cachedInstallerEntries || [])
    const [latestStable, setLatestStable] = useState<string>(cachedInstallerLatestStable || '')
    const [isLoading, setIsLoading] = useState(!cachedInstallerEntries)
    const [error, setError] = useState<Error | null>(null)

    const fetchVersions = useCallback(async () => {
        setIsLoading(true)
        setError(null)

        try {
            const response = await apiClient.get<FabricVersionEntry[]>('/api/fabric/installer-versions')
            const data = response.data

            const stableEntry = data.find((v) => v.stable)
            const latest = stableEntry?.version || data[0]?.version || ''

            cachedInstallerEntries = data
            cachedInstallerLatestStable = latest

            setEntries(data)
            setLatestStable(latest)
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to fetch Fabric installer versions')
            setError(error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        if (!cachedInstallerEntries) {
            fetchVersions()
        }
    }, [fetchVersions])

    const refetch = useCallback(() => {
        cachedInstallerEntries = null
        cachedInstallerLatestStable = null
        fetchVersions()
    }, [fetchVersions])

    const versions = stableOnly
        ? entries.filter((v) => v.stable).map((v) => v.version)
        : entries.map((v) => v.version)

    return { versions, latestStable, isLoading, error, refetch }
}
