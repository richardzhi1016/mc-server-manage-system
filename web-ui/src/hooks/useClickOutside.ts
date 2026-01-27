import { useEffect, useRef, type RefObject } from 'react'

/**
 * Hook that triggers a callback when clicking outside of the target element.
 * Useful for closing dropdowns, modals, and popovers.
 * 
 * @param handler - Callback function to run when clicking outside
 * @returns A ref to attach to the target element
 * 
 * @example
 * const dropdownRef = useClickOutside(() => setIsOpen(false))
 * return <div ref={dropdownRef}>...</div>
 * 
 * @example with existing ref
 * const modalRef = useRef<HTMLDivElement>(null)
 * useClickOutside(() => onClose(), modalRef)
 */
export function useClickOutside<T extends HTMLElement = HTMLDivElement>(
    handler: () => void,
    existingRef?: RefObject<T | null>
): RefObject<T | null> {
    const internalRef = useRef<T | null>(null)
    const ref = existingRef || internalRef

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                handler()
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [handler, ref])

    return ref
}
