import React from 'react';

export const PlaceholderView: React.FC = () => {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>KamiKalendar</h1>
      <p>Calculadora de dias úteis com feriados nacionais brasileiros.</p>
      <section style={{ marginTop: '1.5rem', background: '#f5f5f5', padding: '1rem', borderRadius: '4px' }}>
        <h2>Fase 1 - Configuração e Estrutura</h2>
        <p>Motor de cálculo e carregamento de calendários versionados previstos para fases subsequentes.</p>
        <ul>
          <li>Futura rota: <code>/contar</code> (Intervalo inclusivo)</li>
          <li>Futura rota: <code>/adicionar</code> (Adição a partir do dia útil seguinte; N=0 retorna a própria data)</li>
        </ul>
      </section>
    </div>
  );
};
