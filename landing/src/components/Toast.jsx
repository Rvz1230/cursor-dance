import { createContext, useContext, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const ToastContext = createContext(null);

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message) => {
    setToast({ id: Date.now(), message });
    setTimeout(() => setToast(null), 3200);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ y: -60, opacity: 0, x: "-50%" }}
            animate={{ y: 0, opacity: 1, x: "-50%" }}
            exit={{ y: -20, opacity: 0, x: "-50%" }}
            role="status"
            aria-live="polite"
            className="fixed top-6 left-1/2 z-[100] px-5 py-3 rounded-full bg-white text-gray-900 text-sm font-medium shadow-lg shadow-black/20"
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </ToastContext.Provider>
  );
}
