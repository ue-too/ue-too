import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'banana-reduce-motion';

/**
 * Persists the reduce-motion preference in localStorage so it stays
 * in sync across the landing page, 404 page, and any future consumer.
 */
export function useReduceMotion(): [boolean, (v: boolean | ((prev: boolean) => boolean)) => void] {
    const [reduceMotion, setReduceMotionRaw] = useState(() => {
        try {
            return localStorage.getItem(STORAGE_KEY) === 'true';
        } catch {
            return false;
        }
    });

    const setReduceMotion = useCallback(
        (v: boolean | ((prev: boolean) => boolean)) => {
            setReduceMotionRaw(prev => {
                const next = typeof v === 'function' ? v(prev) : v;
                try {
                    localStorage.setItem(STORAGE_KEY, String(next));
                } catch {
                    // ignore storage errors
                }
                return next;
            });
        },
        [],
    );

    useEffect(() => {
        function onStorage(e: StorageEvent) {
            if (e.key === STORAGE_KEY) {
                setReduceMotionRaw(e.newValue === 'true');
            }
        }
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    return [reduceMotion, setReduceMotion];
}
