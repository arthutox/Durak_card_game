import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { loadScreen } from './App';
import './styles/global.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root element is missing in index.html');

void loadScreen(window.location.pathname).then((Screen) => {
  createRoot(root).render(
    <StrictMode>
      <Screen />
    </StrictMode>,
  );
});
