export {};

declare global {
    interface LaravelWindow {
        csrfToken?: string | null;
        [key: string]: any;
    }

    interface Window {
        Laravel?: LaravelWindow;
    }
}
