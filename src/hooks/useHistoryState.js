import { useCallback, useRef, useState } from 'react'

const COALESCE_MS = 600

export function useHistoryState(initial) {
  const [state, setState] = useState(initial)
  const stateRef = useRef(initial)
  const pastRef = useRef([])
  const futureRef = useRef([])
  const lastKeyRef = useRef(null)
  const lastTimeRef = useRef(0)

  const applyNext = useCallback((next, options = {}) => {
    const { recordHistory = true, coalesceKey = null } = options
    const prev = stateRef.current
    if (next === prev) return

    if (recordHistory) {
      const now = Date.now()
      const shouldCoalesce =
        coalesceKey != null &&
        lastKeyRef.current === coalesceKey &&
        now - lastTimeRef.current < COALESCE_MS &&
        pastRef.current.length > 0

      if (!shouldCoalesce) {
        pastRef.current.push(prev)
        futureRef.current = []
      }

      lastKeyRef.current = coalesceKey
      lastTimeRef.current = now
    }

    stateRef.current = next
    setState(next)
  }, [])

  const commit = useCallback(
    (updater, options) => {
      const prev = stateRef.current
      const next = typeof updater === 'function' ? updater(prev) : updater
      applyNext(next, options)
    },
    [applyNext],
  )

  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return false
    const previous = pastRef.current.pop()
    futureRef.current.push(stateRef.current)
    lastKeyRef.current = null
    lastTimeRef.current = 0
    stateRef.current = previous
    setState(previous)
    return true
  }, [])

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return false
    const next = futureRef.current.pop()
    pastRef.current.push(stateRef.current)
    lastKeyRef.current = null
    lastTimeRef.current = 0
    stateRef.current = next
    setState(next)
    return true
  }, [])

  return { state, commit, undo, redo }
}
