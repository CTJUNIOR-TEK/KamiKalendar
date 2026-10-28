import React, { useState, useEffect } from 'react';
import { CountView, AddView, NotFoundView } from './ui';

export const App: React.FC = () => {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    const path = window.location.pathname;
    return path === '/' ? '/contar' : path;
  });

  useEffect(() => {
    // Redireciona amigavelmente "/" para "/contar"
    if (window.location.pathname === '/') {
      window.history.replaceState({}, '', '/contar');
      setCurrentPath('/contar');
    }

    const handlePopState = () => {
      const path = window.location.pathname;
      setCurrentPath(path === '/' ? '/contar' : path);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const navigateTo = (path: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    setCurrentPath(path);
  };

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    // Permite nova aba / modificadores (Ctrl, Meta, Shift, Alt), download ou target externo
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.altKey ||
      e.ctrlKey ||
      e.shiftKey
    ) {
      return;
    }

    const target = e.currentTarget.getAttribute('target');
    if (target && target !== '_self') {
      return;
    }

    if (e.currentTarget.hasAttribute('download')) {
      return;
    }

    e.preventDefault();
    navigateTo(path);
  };

  const isCount = currentPath === '/contar';
  const isAdd = currentPath === '/adicionar';

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="brand-wrapper">
          <span className="brand-icon" role="img" aria-label="Chaveiro KamiKalendar">🔑</span>
          <h1 className="brand-title">
            Kami<span className="brand-title-accent">Kalendar</span>
          </h1>
        </div>
        <p className="brand-tagline">
          Calculadora de dias úteis com base em datas da lista nacional da BrasilAPI.
        </p>

        <nav aria-label="Navegação principal" className="nav-tabs">
          <a
            href="/contar"
            onClick={(e) => handleLinkClick(e, '/contar')}
            aria-current={isCount ? 'page' : undefined}
            className={`nav-tab-link ${isCount ? 'active' : ''}`}
          >
            Contar Intervalo
          </a>
          <a
            href="/adicionar"
            onClick={(e) => handleLinkClick(e, '/adicionar')}
            aria-current={isAdd ? 'page' : undefined}
            className={`nav-tab-link ${isAdd ? 'active' : ''}`}
          >
            Adicionar Dias Úteis
          </a>
        </nav>
      </header>

      <main>
        {isCount && <CountView />}
        {isAdd && <AddView />}
        {!isCount && !isAdd && <NotFoundView currentPath={currentPath} onNavigate={navigateTo} />}
      </main>
    </div>
  );
};

export default App;
