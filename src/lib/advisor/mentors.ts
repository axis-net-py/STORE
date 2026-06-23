export interface Mentor {
  name: string
  /** Domain grouping, shown to the model to aid selection. */
  domain: string
  /** Terse essence/frameworks. Required for niche figures; optional for globally famous ones. */
  signature?: string
}

/**
 * The cast the Conselheiro picks from. Well-known figures need only name + domain
 * (Claude renders their voice from training); niche/Brazilian figures get a terse
 * signature to anchor fidelity. No RAG — this index lives in the system prompt.
 */
export const MENTOR_ROSTER: Mentor[] = [
  // Filosofia, estoicismo & mente soberana
  { name: 'Marcus Aurelius', domain: 'Filosofia/estoicismo' },
  { name: 'Sêneca', domain: 'Filosofia/estoicismo' },
  { name: 'Ryan Holiday', domain: 'Estoicismo aplicado', signature: 'obstáculo é o caminho; ego é o inimigo' },
  { name: 'Jordan Peterson', domain: 'Responsabilidade/sentido', signature: 'ordem vs caos, responsabilidade individual' },
  { name: 'Eckhart Tolle', domain: 'Presença/consciência', signature: 'o poder do agora, dissolver o ego' },

  // Estratégia, poder & competição
  { name: 'Robert Greene', domain: 'Poder/estratégia', signature: '48 leis do poder, natureza humana, timing' },
  { name: 'Sun Tzu', domain: 'Estratégia/guerra', signature: 'vencer sem lutar, terreno, engano' },
  { name: 'Naval Ravikant', domain: 'Riqueza/alavancagem', signature: 'leverage (código/mídia), specific knowledge' },

  // Gestão & arquitetura de negócios
  { name: 'Peter Drucker', domain: 'Gestão', signature: 'eficácia, o cliente define o negócio' },
  { name: 'Jim Collins', domain: 'Empresas duradouras', signature: 'Good to Great, flywheel, Level 5 leadership' },
  { name: 'Jack Welch', domain: 'Gestão/performance', signature: 'candor, diferenciação, nº 1 ou 2 no mercado' },
  { name: 'Ram Charan', domain: 'Execução', signature: 'execution discipline, know-how operacional' },
  { name: 'John Doerr', domain: 'Metas/OKRs', signature: 'Measure What Matters, OKRs' },
  { name: 'Stephen Covey', domain: 'Eficácia pessoal', signature: '7 hábitos, win-win, comece pelo fim' },

  // Capital, investimento & longevidade
  { name: 'Warren Buffett', domain: 'Investimento', signature: 'value investing, moat, círculo de competência' },
  { name: 'Ray Dalio', domain: 'Princípios/macro', signature: 'principles, radical transparency, ciclos' },
  { name: 'Jorge Paulo Lemann', domain: 'Capital/escala (BR)', signature: '3G, meritocracia, dono, orçamento base zero' },
  { name: 'Luiz Barsi', domain: 'Dividendos (BR)', signature: 'carteira de dividendos, longo prazo, renda' },
  { name: 'Morgan Housel', domain: 'Psicologia do dinheiro', signature: 'comportamento > planilha, margem de segurança' },

  // Fundadores & inovação radical
  { name: 'Jeff Bezos', domain: 'Escala/cliente', signature: 'obsessão pelo cliente, Day 1, decisões tipo-1/2' },
  { name: 'Elon Musk', domain: 'Primeiros princípios', signature: 'first principles, deletar etapas, urgência' },
  { name: 'Steve Jobs', domain: 'Produto/visão', signature: 'foco, simplicidade, intersecção arte+tecnologia' },
  { name: 'Alex Hormozi', domain: 'Ofertas/escala', signature: 'grand slam offer, value equation, LTV/CAC' },

  // Empreendedores brasileiros & resiliência
  { name: 'Flávio Augusto da Silva', domain: 'Negócios (BR)', signature: 'geração de valor, mentalidade de dono' },
  { name: 'Abílio Diniz', domain: 'Varejo (BR)', signature: 'disciplina, foco no cliente, longevidade' },
  { name: 'Geraldo Rufino', domain: 'Resiliência (BR)', signature: 'JR Diesel, do lixo ao milhão, reinvenção' },
  { name: 'Tallis Gomes', domain: 'Startups (BR)', signature: 'Easy Taxi/Singu, "Nada Easy", execução enxuta' },
  { name: 'Pablo Marçal', domain: 'Mentalidade/vendas (BR)', signature: 'alta intensidade, propósito, ação massiva' },
  { name: 'Giovanni Begossi', domain: 'Empreendedorismo (BR)', signature: 'figura de nicho — usar web_search para fidelidade' },
  { name: 'Alfredo Soares', domain: 'E-commerce/vendas (BR)', signature: 'G4, "Bora Vender", varejo digital' },
  { name: 'Felipe Alves', domain: 'Criador/negócios (BR)', signature: 'Fe Alves SN (@fealvessn) — usar web_search para fidelidade' },

  // Vendas & negociação
  { name: 'Robert Cialdini', domain: 'Persuasão', signature: '6 princípios: reciprocidade, escassez, prova social…' },
  { name: 'Neil Rackham', domain: 'Vendas consultivas', signature: 'SPIN Selling (Situação/Problema/Implicação/Necessidade)' },
  { name: 'Jeffrey Gitomer', domain: 'Vendas', signature: 'Sales Bible, valor antes do preço' },
  { name: 'Brian Tracy', domain: 'Vendas/metas', signature: 'psicologia da venda, "Eat That Frog"' },
  { name: 'Aaron Ross & Marylou Tyler', domain: 'Vendas outbound/B2B', signature: 'Predictable Revenue, especialização do time, cold 2.0' },
  { name: 'OG Mandino', domain: 'Vendas/inspiração', signature: 'O Maior Vendedor do Mundo, hábitos e pergaminhos' },
  { name: 'Chris Voss', domain: 'Negociação', signature: 'Never Split the Difference, empatia tática, espelhamento' },
  { name: 'Rodrigo Noll', domain: 'Marketing de indicação (BR)', signature: 'máquina de indicações, referral sistematizado' },

  // Marketing, autoridade & comunicação
  { name: 'Simon Sinek', domain: 'Propósito/liderança', signature: 'Start With Why, golden circle' },
  { name: 'Seth Godin', domain: 'Marketing', signature: 'Purple Cow, permission marketing, tribo, remarkable' },
  { name: 'John C. Maxwell', domain: 'Liderança', signature: '21 leis da liderança, influência' },
  { name: 'Dale Carnegie', domain: 'Relações/influência', signature: 'Como Fazer Amigos e Influenciar Pessoas' },
  { name: 'Robin Sharma', domain: 'Liderança/maestria', signature: '5 AM Club, lidere sem títulos' },
  { name: 'Nicholas Boothman', domain: 'Conexão/rapport', signature: 'rapport em 90 segundos, linguagem corporal' },
  { name: 'Brené Brown', domain: 'Vulnerabilidade/liderança', signature: 'coragem, vulnerabilidade, "Daring Greatly"' },

  // Alta performance, hábitos & coaching
  { name: 'Tony Robbins', domain: 'Peak performance', signature: 'estados emocionais, alavancas de decisão, ação massiva' },
  { name: 'Tim Ferriss', domain: 'Otimização/experimentos', signature: '80/20, desconstruir habilidades, frameworks "4-Hour"' },
  { name: 'Tim Gallwey', domain: 'Inner game', signature: 'Inner Game, Self 1 vs Self 2, foco relaxado' },
  { name: 'Brendon Burchard', domain: 'Alta performance', signature: 'High Performance Habits, clareza/energia/coragem' },
  { name: 'Charles Duhigg', domain: 'Hábitos/produtividade', signature: 'loop do hábito (deixa-rotina-recompensa)' },
  { name: 'David Goggins', domain: 'Resiliência mental', signature: 'calejar a mente, regra dos 40%, accountability brutal' },

  // Mentalidade, manifestação & metafísica
  { name: 'Napoleon Hill', domain: 'Realização', signature: 'Quem Pensa Enriquece, propósito definido, mastermind' },
  { name: 'Bob Proctor', domain: 'Mentalidade/riqueza', signature: 'paradigmas, imagem mental, lei da atração' },
  { name: 'Joseph Murphy', domain: 'Mente subconsciente', signature: 'O Poder do Subconsciente, autossugestão' },
  { name: 'Neville Goddard', domain: 'Imaginação criativa', signature: 'assuma o estado desejado, "living in the end"' },
  { name: 'Vadim Zeland', domain: 'Transurfing', signature: 'Transurfing, intenção vs desejo, gestão de realidade' },
  { name: 'Joe Dispenza', domain: 'Neurociência/mente', signature: 'quebrar o hábito de ser você mesmo, estados elevados' },
  { name: 'T. Harv Eker', domain: 'Mentalidade de riqueza', signature: 'Os Segredos da Mente Milionária, blueprint financeiro' },
  { name: 'Paulo Vieira', domain: 'Coaching (BR)', signature: 'O Poder da Ação, Febracis, ressignificação' },
]
