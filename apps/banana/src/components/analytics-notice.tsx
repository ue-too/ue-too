import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

const STORAGE_KEY = 'banana-analytics-notice-dismissed';

export function AnalyticsNotice() {
    const { t } = useTranslation();

    useEffect(() => {
        if (localStorage.getItem(STORAGE_KEY)) return;

        const id = toast.info(t('analyticsNotice'), {
            duration: 8000,
            onDismiss: () => localStorage.setItem(STORAGE_KEY, '1'),
            onAutoClose: () => localStorage.setItem(STORAGE_KEY, '1'),
        });

        return () => { toast.dismiss(id); };
    }, [t]);

    return null;
}
