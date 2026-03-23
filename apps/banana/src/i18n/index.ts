import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en';
import ja from './locales/ja';
import zhTW from './locales/zh-TW';

const STORAGE_KEY = 'banana-i18n-lang';

function getInitialLanguage(): string {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (stored === 'en' || stored === 'zh-TW' || stored === 'ja'))
        return stored;
    const browserLang = navigator.language;
    if (browserLang.startsWith('zh')) return 'zh-TW';
    if (browserLang.startsWith('ja')) return 'ja';
    return 'en';
}

i18n.use(initReactI18next).init({
    resources: {
        en,
        'zh-TW': zhTW,
        ja,
    },
    lng: getInitialLanguage(),
    fallbackLng: 'en',
    interpolation: {
        escapeValue: false,
    },
});

i18n.on('languageChanged', (lng) => {
    localStorage.setItem(STORAGE_KEY, lng);
});

export default i18n;
