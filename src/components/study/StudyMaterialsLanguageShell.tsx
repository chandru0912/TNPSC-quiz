import React, { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import {
  StudyMaterialsLanguageProvider,
  useStudyMaterialsLanguage,
} from '../../context/StudyMaterialsLanguageContext'
import { StudyMaterialsTranslatorBar } from './StudyMaterialsTranslatorBar'

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'SVG', 'INPUT', 'TEXTAREA', 'SELECT', 'OPTION'])
const TAMIL_CHAR_REGEX = /[\u0B80-\u0BFF]/
const LATIN_WORD_REGEX = /[A-Za-z]{2,}/

function isTranslatableText(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed || trimmed.length < 2) return false
  if (/^[\d\s.,:%+\-–—/()[\]{}|•·#*⚡📖🏷️📋]+$/.test(trimmed)) return false
  if (/^https?:\/\//i.test(trimmed)) return false
  if (/^ID:\s*[A-Za-z0-9_\-:]+$/i.test(trimmed)) return false
  // Must contain at least one English word to translate to Tamil
  if (!LATIN_WORD_REGEX.test(trimmed)) return false
  // Skip text that is already overwhelmingly Tamil with only an acronym/unit
  if (TAMIL_CHAR_REGEX.test(trimmed) && !/[A-Za-z]{4,}/.test(trimmed)) return false
  return true
}

function shouldSkipElement(el: Element | null): boolean {
  let curr: Element | null = el
  while (curr) {
    if (SKIP_TAGS.has(curr.tagName)) return true
    if (curr.getAttribute('data-no-translate') === 'true') return true
    curr = curr.parentElement
  }
  return false
}

const StudyMaterialsScopeInner: React.FC = () => {
  const location = useLocation()
  const { language, retryNonce, getCachedTranslation, translateTextsBatch } = useStudyMaterialsLanguage()
  const scopeRef = useRef<HTMLDivElement | null>(null)

  // Stores exact original English text per Text node so switching back to English is instant & lossless
  const originalTextMapRef = useRef<WeakMap<Text, string>>(new WeakMap())
  // Tracks the last Tamil text we wrote to a Text node so MutationObserver ignores our own writes
  const appliedTamilMapRef = useRef<WeakMap<Text, string>>(new WeakMap())
  const trackedNodesRef = useRef<Set<Text>>(new Set())

  const runTranslationPass = useRef<() => void>(() => {})

  useEffect(() => {
    let cancelled = false

    const restoreEnglish = () => {
      for (const node of Array.from(trackedNodesRef.current)) {
        if (!node.isConnected) {
          trackedNodesRef.current.delete(node)
          continue
        }
        const orig = originalTextMapRef.current.get(node)
        if (orig !== undefined && node.nodeValue !== orig) {
          node.nodeValue = orig
        }
        appliedTamilMapRef.current.delete(node)
      }
    }

    const applyTamilPass = async () => {
      const root = scopeRef.current
      if (!root || cancelled) return

      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      const nodesBySource = new Map<string, Array<{ node: Text; leading: string; trailing: string }>>()
      const uncachedTexts = new Set<string>()

      let current: Node | null = walker.nextNode()
      while (current) {
        const textNode = current as Text
        current = walker.nextNode()

        if (shouldSkipElement(textNode.parentElement)) continue
        const currentVal = textNode.nodeValue ?? ''
        if (!currentVal.trim()) continue

        const lastTamil = appliedTamilMapRef.current.get(textNode)
        // If this node already has our applied Tamil string, skip re-processing it
        if (lastTamil !== undefined && currentVal === lastTamil) {
          continue
        }

        // Capture / refresh exact original English string
        let originalVal = originalTextMapRef.current.get(textNode)
        if (originalVal === undefined || currentVal !== lastTamil) {
          originalVal = currentVal
          originalTextMapRef.current.set(textNode, originalVal)
          trackedNodesRef.current.add(textNode)
        }

        if (!isTranslatableText(originalVal)) continue

        const leadingMatch = originalVal.match(/^\s*/)
        const trailingMatch = originalVal.match(/\s*$/)
        const leading = leadingMatch ? leadingMatch[0] : ''
        const trailing = trailingMatch ? trailingMatch[0] : ''
        const trimmed = originalVal.trim()

        // Try instant dictionary / localStorage cache first
        const instant = getCachedTranslation(trimmed)
        if (instant) {
          const finalStr = `${leading}${instant}${trailing}`
          appliedTamilMapRef.current.set(textNode, finalStr)
          if (textNode.nodeValue !== finalStr) {
            textNode.nodeValue = finalStr
          }
          continue
        }

        uncachedTexts.add(trimmed)
        const list = nodesBySource.get(trimmed) || []
        list.push({ node: textNode, leading, trailing })
        nodesBySource.set(trimmed, list)
      }

      if (uncachedTexts.size === 0 || cancelled) return

      const translatedMap = await translateTextsBatch(Array.from(uncachedTexts), 'syllabus')
      if (cancelled) return

      for (const [src, targets] of nodesBySource.entries()) {
        const tr = translatedMap[src]
        if (!tr) continue
        for (const { node, leading, trailing } of targets) {
          if (!node.isConnected) continue
          const finalStr = `${leading}${tr}${trailing}`
          appliedTamilMapRef.current.set(node, finalStr)
          if (node.nodeValue !== finalStr) {
            node.nodeValue = finalStr
          }
        }
      }
    }

    runTranslationPass.current = () => {
      if (language === 'ta') {
        void applyTamilPass()
      } else {
        restoreEnglish()
      }
    }

    // Run immediately on language / route / retry change
    runTranslationPass.current()

    if (language !== 'ta') {
      return () => {
        cancelled = true
      }
    }

    // Observe dynamic content loads (units, lessons, study notes, tabs) inside Study Materials ONLY
    const root = scopeRef.current
    if (!root) {
      return () => {
        cancelled = true
      }
    }

    let debounceTimer: number | null = null
    const observer = new MutationObserver(() => {
      if (cancelled) return
      if (debounceTimer !== null) window.clearTimeout(debounceTimer)
      debounceTimer = window.setTimeout(() => {
        debounceTimer = null
        if (!cancelled) {
          void applyTamilPass()
        }
      }, 140)
    })

    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
    })

    return () => {
      cancelled = true
      observer.disconnect()
      if (debounceTimer !== null) window.clearTimeout(debounceTimer)
    }
  }, [language, retryNonce, location.pathname, location.search, getCachedTranslation, translateTextsBatch])

  // On /materials (main StudyMaterials page), the toggle is rendered directly inside the Study Materials header;
  // on all sub-pages (Group1/2/4 units, lessons, classes, StudyNotesPage), show the clean top dock bar.
  const isMainMaterialsPage = location.pathname === '/materials' || location.pathname === '/materials/'

  return (
    <div ref={scopeRef} className="study-materials-scope" lang={language === 'ta' ? 'ta' : 'en'}>
      {!isMainMaterialsPage && <StudyMaterialsTranslatorBar />}
      <Outlet />
    </div>
  )
}

export const StudyMaterialsLanguageShell: React.FC = () => {
  return (
    <StudyMaterialsLanguageProvider>
      <StudyMaterialsScopeInner />
    </StudyMaterialsLanguageProvider>
  )
}
