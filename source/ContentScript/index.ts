import {setupXFetch} from './xfetch';

setupXFetch();

const s = document.createElement('script');
s.src = chrome.runtime.getURL('js/contentScriptMain.bundle.js');
s.onload = function onload(): void {
  s.remove();
};
(document.head || document.documentElement).appendChild(s);

export {};
