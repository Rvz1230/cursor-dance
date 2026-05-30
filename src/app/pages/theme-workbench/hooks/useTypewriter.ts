import { useCallback, useEffect, useRef, useState } from "react";

interface UseTypewriterOptions {
  speed?: number;
}

interface UseTypewriterReturn {
  displayedText: string;
  isTyping: boolean;
  flush: () => void;
}

/**
 * Gradually reveals characters from `fullText` at a given speed (ms per tick).
 * Each tick reveals 1–3 random characters, creating a natural typing feel.
 * When the buffer empties, `displayedText` equals `fullText`.
 *
 * Call `flush()` to instantly reveal all buffered text (e.g. on cancel).
 */
export function useTypewriter(
  fullText: string,
  options: UseTypewriterOptions = {},
): UseTypewriterReturn {
  const { speed = 40 } = options;
  const [displayedText, setDisplayedText] = useState("");
  const bufferRef = useRef("");
  const revealedCountRef = useRef(0);
  const prevLengthRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fullTextRef = useRef(fullText);

  // Keep a ref to the latest fullText so the interval callback reads current value
  fullTextRef.current = fullText;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTyping = useCallback(() => {
    clearTimer();
    timerRef.current = setInterval(() => {
      if (bufferRef.current.length === 0) {
        // Sync to fullText when empty
        setDisplayedText(fullTextRef.current);
        clearTimer();
        return;
      }
      const charsToReveal = Math.min(
        1 + Math.floor(Math.random() * 2), // 1–3 chars
        bufferRef.current.length,
      );
      revealedCountRef.current += charsToReveal;
      bufferRef.current = bufferRef.current.slice(charsToReveal);
      setDisplayedText(fullTextRef.current.slice(0, revealedCountRef.current));
    }, speed);
  }, [speed, clearTimer]);

  // Detect new text arriving (delta) and push into buffer
  useEffect(() => {
    const prevLen = prevLengthRef.current;
    if (fullText.length > prevLen) {
      const delta = fullText.slice(prevLen);
      bufferRef.current += delta;
      prevLengthRef.current = fullText.length;
      if (!timerRef.current) {
        startTyping();
      }
    } else if (fullText.length < prevLen) {
      // fullText was reset (e.g. streaming ended, cleared)
      bufferRef.current = "";
      revealedCountRef.current = 0;
      prevLengthRef.current = 0;
      clearTimer();
      setDisplayedText("");
    }
  }, [fullText, startTyping, clearTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return clearTimer;
  }, [clearTimer]);

  const flush = useCallback(() => {
    clearTimer();
    bufferRef.current = "";
    revealedCountRef.current = fullTextRef.current.length;
    setDisplayedText(fullTextRef.current);
  }, [clearTimer]);

  return {
    displayedText,
    isTyping: timerRef.current !== null,
    flush,
  };
}
