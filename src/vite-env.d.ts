/// <reference types="vite/client" />

declare namespace JSX {
  interface IntrinsicElements {
    'wistia-player': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      'media-id': string;
      aspect?: string;
    };
  }
}
