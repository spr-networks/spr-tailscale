import React from 'react';
import ReactDOM from 'react-dom/client';
import { PluginApp } from '@spr-networks/plugin-ui';
import Plugin from './Plugin';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
// NOTE no StrictMode: gluestack-style's StyledProvider tracks the root provider
// via a module-level useId comparison, and StrictMode's double render breaks it,
// so colorMode (dark mode) never gets applied.
root.render(
  <PluginApp>
    <Plugin />
  </PluginApp>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
