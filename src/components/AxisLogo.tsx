/**
 * Marca do AXIS.
 *
 * Redesenhada em vetor a partir do logótipo da empresa: disco verde com anel
 * dourado, o "A" atravessado pela órbita e o "I" ao centro.
 *
 * Vetor e não o ficheiro original de propósito. O original é um render com
 * relevo, brilhos e sombras — bonito em grande, papa em 32 píxeis, e pesado
 * para ir em todas as páginas. Aqui as formas são as mesmas, reduzidas ao que
 * ainda se lê pequeno, e o ficheiro fica em centenas de bytes.
 *
 * As cores são fixas, e não do tema: é a marca da empresa, não a paleta do
 * cliente. Um cliente com o sistema em verde ou offwhite continua a ver o
 * mesmo logótipo — é isso que faz dele um logótipo.
 */

const VERDE = "#1e5b3a";
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
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-label={title}
    >
      <defs>
        <linearGradient id="axis-ouro" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={OURO_CLARO} />
          <stop offset="50%" stopColor={OURO} />
          <stop offset="100%" stopColor={OURO_ESCURO} />
        </linearGradient>
      </defs>

      {/* disco, anel exterior e o filete interior */}
      <circle cx="16" cy="16" r="15" fill={VERDE} />
      <circle cx="16" cy="16" r="15" fill="none" stroke="url(#axis-ouro)" strokeWidth="2" />
      <circle cx="16" cy="16" r="12.4" fill="none" stroke="url(#axis-ouro)" strokeWidth="0.7" opacity="0.85" />

      <g fill="none" stroke="url(#axis-ouro)" strokeLinecap="round" strokeLinejoin="round">
        {/* órbita: é ela que faz as vezes da travessa do A */}
        <ellipse cx="16" cy="16.2" rx="9.8" ry="5.4" strokeWidth="1.6" transform="rotate(-14 16 16.2)" />
        {/* o A */}
        <path d="M10.4 22.6 L16 8.8 L21.6 22.6" strokeWidth="2.1" />
        {/* o I, com as serifas */}
        <path d="M13.7 22.6 H18.3 M16 22.6 V15.2 M14.3 15.2 H17.7" strokeWidth="1.8" />
      </g>
    </svg>
  );
}
