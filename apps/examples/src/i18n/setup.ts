import { applyTranslations, createLanguageSwitcher } from './index';

document.addEventListener('DOMContentLoaded', () => {
    const switcherTarget = document.getElementById('lang-switcher-container');
    if (switcherTarget) {
        createLanguageSwitcher(switcherTarget);
    }
    applyTranslations();
});
