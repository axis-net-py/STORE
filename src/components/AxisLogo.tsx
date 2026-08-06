/**
 * Marca do AXIS.
 *
 * Redesenhada em vetor a partir do logótipo da empresa: disco verde com anel
 * dourado, duas órbitas entrelaçadas, o "A" e o "I" com serifas ao centro.
 *
 * A primeira tentativa tinha uma órbita só, e é isso que a fazia parecer um
 * emblema genérico: o que identifica esta marca é o **cruzamento** de duas
 * elipses inclinadas em sentidos opostos, que envolvem as letras como um átomo.
 * Com uma só, restava um oval à volta de um "A" — podia ser de qualquer coisa.
 *
 * Desenhada em viewBox de 64 e não de 32: as órbitas cruzam-se em ângulos
 * pequenos e, na grelha de 32, os pontos de cruzamento caíam todos no mesmo
 * píxel e o entrelaçado desaparecia.
 *
 * O relevo do original não vem: é um render com brilhos e sombras, bonito em
 * grande e papa em pequeno. Ficam as formas, que é o que se lê em qualquer
 * tamanho, e o ficheiro fica em centenas de bytes em vez de centenas de kB.
 *
 * As letras são traçadas por cima de um contorno verde mais grosso. É o que
 * faz o "A" e o "I" passarem à frente das órbitas em vez de se fundirem com
 * elas — o mesmo efeito que no original vem do relevo.
 *
 * As cores são da marca e não do tema: a paleta muda por cliente, o logótipo
 * não. É isso que faz dele um logótipo.
 */

const VERDE = "#1a6141";
const OURO_CLARO = "#f0dfa0";
const OURO = "#cfa94e";
const OURO_ESCURO = "#a3792a";

export function AxisLogo({
  size = 40,
  className,
  title = "AXIS",
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label={title}
    >
      <defs>
        <linearGradient id="axis-ouro" x1="10%" y1="0%" x2="90%" y2="100%">
          <stop offset="0%" stopColor={OURO_CLARO} />
          <stop offset="45%" stopColor={OURO} />
          <stop offset="100%" stopColor={OURO_ESCURO} />
        </linearGradient>
      </defs>

      {/* Disco, anel exterior e o filete interior */}
      <circle cx="32" cy="32" r="30" fill={VERDE} />
      <circle cx="32" cy="32" r="30" fill="none" stroke="url(#axis-ouro)" strokeWidth="3.6" />
      <circle cx="32" cy="32" r="25.4" fill="none" stroke="url(#axis-ouro)" strokeWidth="1.1" opacity="0.9" />

      {/* As duas órbitas, inclinadas em sentidos opostos */}
      <g fill="none" stroke="url(#axis-ouro)" strokeWidth="3.2">
        <ellipse cx="32" cy="33" rx="19.2" ry="7.8" transform="rotate(-28 32 33)" />
        <ellipse cx="32" cy="33" rx="19.2" ry="7.8" transform="rotate(28 32 33)" />
      </g>

      {/* Letras: primeiro o contorno verde, que as destaca das órbitas… */}
      <g fill="none" stroke={VERDE} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 47.5 L32 15.5 L44 47.5" />
        <path d="M32 46.5 V29.5 M26.5 29.5 H37.5 M25 47.5 H39" />
      </g>
      {/* …e por cima o traço dourado. */}
      <g fill="none" stroke="url(#axis-ouro)" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 47.5 L32 15.5 L44 47.5" strokeWidth="4" />
        <path d="M32 46.5 V29.5 M26.5 29.5 H37.5 M25 47.5 H39" strokeWidth="3.4" />
      </g>
    </svg>
  );
}
