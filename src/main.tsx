import '@fontsource-variable/noto-serif-sc';
import '@fontsource-variable/noto-sans-sc';
import React from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './App';
import './style.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
