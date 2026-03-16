import { useState, useEffect, useCallback } from 'react'

interface MinecraftVersionsResult {
    versions: string[]
    releaseVersions: string[]  // Only release-type versions (no snapshots/old_beta/old_alpha)
    versionsMap: Map<string, string>  // Maps version ID to metadata URL
    latestRelease: string
    isLoading: boolean
    error: Error | null
    refetch: () => void
}

const VERSIONS_API_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest.json'

interface VersionManifest {
    latest: {
        release: string
        snapshot: string
    }
    versions: Array<{
        id: string
        type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha'
        url: string
        time: string
        releaseTime: string
    }>
}

// Cache for version data to avoid refetching
let cachedVersions: string[] | null = null
let cachedReleaseVersions: string[] | null = null
let cachedVersionsMap: Map<string, string> | null = null
let cachedLatestRelease: string | null = null

export function useMinecraftVersions(): MinecraftVersionsResult {
    const [versions, setVersions] = useState<string[]>(cachedVersions || [])
    const [releaseVersions, setReleaseVersions] = useState<string[]>(cachedReleaseVersions || [])
    const [versionsMap, setVersionsMap] = useState<Map<string, string>>(cachedVersionsMap || new Map())
    const [latestRelease, setLatestRelease] = useState<string>(cachedLatestRelease || '1.20.4')
    const [isLoading, setIsLoading] = useState(!cachedVersions)
    const [error, setError] = useState<Error | null>(null)

    const fetchVersions = useCallback(async () => {
        setIsLoading(true)
        setError(null)

        try {
            const response = await fetch(VERSIONS_API_URL)
            if (!response.ok) {
                throw new Error(`Failed to fetch versions: ${response.statusText}`)
            }

            const data: VersionManifest = await response.json()

            // Extract version IDs
            const versionIds = data.versions.map((v) => v.id)
            const releaseIds = data.versions.filter((v) => v.type === 'release').map((v) => v.id)

            // Build version ID to URL map
            const versionUrlMap = new Map<string, string>()
            for (const v of data.versions) {
                versionUrlMap.set(v.id, v.url)
            }

            // Cache the results
            cachedVersions = versionIds
            cachedReleaseVersions = releaseIds
            cachedVersionsMap = versionUrlMap
            cachedLatestRelease = data.latest?.release || '1.20.4'

            setVersions(versionIds)
            setReleaseVersions(releaseIds)
            setVersionsMap(versionUrlMap)
            setLatestRelease(cachedLatestRelease)
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to fetch Minecraft versions')
            setError(error)
            console.error('Failed to fetch Minecraft versions:', error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        // Only fetch if not already cached
        if (!cachedVersions) {
            fetchVersions()
        }
    }, [fetchVersions])

    const refetch = useCallback(() => {
        // Clear cache and refetch
        cachedVersions = null
        cachedReleaseVersions = null
        cachedVersionsMap = null
        cachedLatestRelease = null
        fetchVersions()
    }, [fetchVersions])

    return {
        versions,
        releaseVersions,
        versionsMap,
        latestRelease,
        isLoading,
        error,
        refetch,
    }
}

