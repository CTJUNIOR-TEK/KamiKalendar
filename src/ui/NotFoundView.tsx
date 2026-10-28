import React from 'react';

interface NotFoundViewProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const NotFoundView: React.FC<NotFoundViewProps> = ({ currentPath, onNavigate }) => {
  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
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
    onNavigate(path);
  };

  return (
    <section aria-labelledby="heading-404" className="not-found-card">
      <h2 id="heading-404">
        404 - Página Não Encontrada
      </h2>
      <p>
        A rota solicitada <code>{currentPath}</code> não foi encontrada no KamiKalendar.
      </p>
      <div className="not-found-actions">
        <a
          href="/contar"
          onClick={(e) => handleLinkClick(e, '/contar')}
          className="btn-primary"
          style={{ textDecoration: 'none' }}
        >
          Ir para Contar Dias Úteis
        </a>
        <a
          href="/adicionar"
          onClick={(e) => handleLinkClick(e, '/adicionar')}
          className="btn-secondary"
          style={{ textDecoration: 'none', padding: '0.75rem 1.25rem', fontSize: '0.95rem' }}
        >
          Ir para Adicionar Dias Úteis
        </a>
      </div>
    </section>
  );
};
