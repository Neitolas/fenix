import { useEffect, useState } from 'react'

type Connection = 'checking' | 'connected' | 'unavailable'

export default function App() {
  const [connection, setConnection] = useState<Connection>('checking')

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/health/', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Falha na conexão')
        const data: unknown = await response.json()
        if (typeof data !== 'object' || data === null || !('status' in data) || data.status !== 'ok') {
          throw new Error('Resposta inesperada')
        }
        setConnection('connected')
      })
      .catch(() => {
        if (!controller.signal.aborted) setConnection('unavailable')
      })
    return () => controller.abort()
  }, [])

  const connectionLabel = {
    checking: 'Verificando conexão',
    connected: 'Conexão estabelecida',
    unavailable: 'Central indisponível',
  }[connection]

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Fênix, início">F.E.N.I.X.<span>Mobilidade urbana</span></a>
        <span className={`connection ${connection}`} role="status">{connectionLabel}</span>
      </header>
      <section className="hero" aria-labelledby="title">
        <p className="eyebrow">Iniciativa F.O.G.O. / Protocolo PROMETHEUS</p>
        <h1 id="title">Uma cidade capaz<br />de <em>recomeçar.</em></h1>
        <p className="intro">Conhecer os recursos. Recuperar a operação. Antecipar o próximo desafio.</p>
      </section>
      <section className="modules" aria-label="Frentes do projeto">
        <article><span className="number">01</span><h2>Inventário</h2><p>Equipamentos e agentes reunidos em uma visão da cidade.</p><span className="stage">Em desenvolvimento</span></article>
        <article><span className="number">02</span><h2>Operação</h2><p>Localização, disponibilidade e manutenção para apoiar decisões.</p><span className="stage">Em desenvolvimento</span></article>
        <article><span className="number">03</span><h2>Prevenção</h2><p>Históricos que ajudam a identificar riscos antes das falhas.</p><span className="stage">Em desenvolvimento</span></article>
      </section>
      <footer>Da falha à recuperação. Dos dados à prevenção.</footer>
    </main>
  )
}
