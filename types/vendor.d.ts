export {};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    clarity?: (...args: unknown[]) => void;
    niobium?: {
      store?: {
        getQuote: (...args: unknown[]) => Promise<Response>;
        makeOrder: (...args: unknown[]) => Promise<Response>;
        trackOrder: (...args: unknown[]) => Promise<Response>;
      };
      notification?: {
        subscribe: (...args: unknown[]) => Promise<Response>;
        contactUs: (...args: unknown[]) => Promise<Response>;
      };
    };
  }
}
