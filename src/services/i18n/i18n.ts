import enMessages from '@src/locales/en.json';

export class I18nService {
    private static instance : I18nService;
    private messages        : typeof enMessages = enMessages;

    private constructor() { }

    public static getInstance(): I18nService {
        if (!I18nService.instance) {
            I18nService.instance = new I18nService();
        }

        return I18nService.instance;
    }

    public t(key: string, ...args: any[]): string {
        const parts = key.split('.');
        let message = parts.reduce((obj, key) => obj?.[key], this.messages as any);

        if (typeof message !== 'string') {
            console.warn(`Missing translation for key: ${key}`);

            return key;
        }

        return args.reduce((msg, arg, i) => msg.replace(`{${i}}`, String(arg)), message);
    }
}

export const i18n = I18nService.getInstance();
