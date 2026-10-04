import React from 'react';

// Símbolo reutilizável da Bolsa de Compras com a Carinha ("oo" + sorriso) dentro
export const ShoppingBagFaceBadge: React.FC<{
  className?: string;
  bagFill?: string;
  bagStroke?: string;
  handleStroke?: string;
}> = ({
  className = 'w-6 h-6',
  bagFill = '#FFFFFF',
  bagStroke = '#7C3AED',
  handleStroke = '#09090B',
}) => (
  <svg
    viewBox="0 0 40 42"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Alça da bolsa de compras */}
    <path
      d="M13 12V9.5C13 5.63401 16.134 2.5 20 2.5C23.866 2.5 27 5.63401 27 9.5V12"
      stroke={handleStroke}
      strokeWidth="3.2"
      strokeLinecap="round"
    />
    {/* Corpo da bolsa de compras */}
    <path
      d="M6.5 12.5C6.5 10.8431 7.84315 9.5 9.5 9.5H30.5C32.1569 9.5 33.5 10.8431 33.5 12.5L35.5 34.5C35.6656 36.2681 34.2747 37.8 32.5 37.8H7.5C5.72527 37.8 4.33443 36.2681 4.5 34.5L6.5 12.5Z"
      fill={bagFill}
      stroke={bagStroke}
      strokeWidth="3.2"
      strokeLinejoin="round"
    />
    {/* Furos da alça na bolsa */}
    <circle cx="13" cy="13.5" r="1.5" fill={handleStroke} />
    <circle cx="27" cy="13.5" r="1.5" fill={handleStroke} />

    {/* Carinha menorzinha DENTRO da bolsa de compras (2 olhinhos "oo" roxos + pupila preta + sorriso roxo) */}
    {/* Olho esquerdo */}
    <circle
      cx="14.5"
      cy="22"
      r="4.6"
      fill="#FAF5FF"
      stroke="#7C3AED"
      strokeWidth="2.2"
    />
    <circle cx="15.4" cy="21.3" r="2" fill="#09090B" />
    <circle cx="16" cy="20.7" r="0.7" fill="#FFFFFF" />

    {/* Olho direito */}
    <circle
      cx="25.5"
      cy="22"
      r="4.6"
      fill="#FAF5FF"
      stroke="#7C3AED"
      strokeWidth="2.2"
    />
    <circle cx="26.4" cy="21.3" r="2" fill="#09090B" />
    <circle cx="27" cy="20.7" r="0.7" fill="#FFFFFF" />

    {/* Sorriso roxo com seta dentro da bolsa */}
    <path
      d="M12.5 30C16 34.2 24 34.2 27.5 29.8"
      stroke="#7C3AED"
      strokeWidth="2.6"
      strokeLinecap="round"
    />
    <path
      d="M25.2 28.8L28.5 29.3L27.7 32.5"
      stroke="#7C3AED"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Ícone elaborado do App Achadinhos Delivery (Roxo, Branco e Preto) com a Bolsa de Compras + Carinha dentro + DELIVERY + Carinha de Moto
export const AchadinhosAppIconSVG: React.FC<{ className?: string }> = ({
  className = 'w-16 h-16',
}) => {
  return (
    <svg
      viewBox="0 0 256 256"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Ícone Achadinhos Delivery"
    >
      {/* Fundo Roxo Real com moldura Preta e Branca */}
      <rect width="256" height="256" rx="56" fill="#7C3AED" />
      <rect
        x="8"
        y="8"
        width="240"
        height="240"
        rx="48"
        stroke="#09090B"
        strokeWidth="6"
      />

      {/* BOLSA DE COMPRAS CENTRAL NO TOPO COM A CARINHA DENTRO */}
      {/* Alça da Bolsa */}
      <path
        d="M96 48V34C96 19.6406 110.327 10 128 10C145.673 10 160 19.6406 160 34V48"
        stroke="#09090B"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <path
        d="M96 48V34C96 19.6406 110.327 10 128 10C145.673 10 160 19.6406 160 34V48"
        stroke="#FFFFFF"
        strokeWidth="5"
        strokeLinecap="round"
      />

      {/* Corpo da Bolsa de Compras Branca com borda Preta */}
      <path
        d="M52 50C52 41.1634 59.1634 34 68 34H188C196.837 34 204 41.1634 204 50L214 132C215.105 141.482 207.689 149.8 198.143 149.8H57.8572C48.311 149.8 40.8951 141.482 42 132L52 50Z"
        fill="#FFFFFF"
        stroke="#09090B"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      {/* Ilhós da alça */}
      <circle cx="96" cy="52" r="5" fill="#09090B" />
      <circle cx="160" cy="52" r="5" fill="#09090B" />

      {/* Carinha menorzinha dentro da Bolsa */}
      {/* Olho esquerdo "o" */}
      <circle
        cx="102"
        cy="82"
        r="16"
        fill="#FAF5FF"
        stroke="#7C3AED"
        strokeWidth="6.5"
      />
      <circle cx="106" cy="79" r="6.5" fill="#09090B" />
      <circle cx="108.5" cy="76.5" r="2.2" fill="#FFFFFF" />

      {/* Olho direito "o" */}
      <circle
        cx="154"
        cy="82"
        r="16"
        fill="#FAF5FF"
        stroke="#7C3AED"
        strokeWidth="6.5"
      />
      <circle cx="158" cy="79" r="6.5" fill="#09090B" />
      <circle cx="160.5" cy="76.5" r="2.2" fill="#FFFFFF" />

      {/* Sorriso roxo com seta dentro da bolsa */}
      <path
        d="M92 110C110 128 146 128 164 108"
        stroke="#7C3AED"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M154 104L167 106L164 118"
        stroke="#7C3AED"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Nome ACHADINHOS dentro da base da bolsa */}
      <text
        x="128"
        y="141"
        textAnchor="middle"
        fill="#09090B"
        fontFamily="sans-serif"
        fontWeight="900"
        fontSize="15"
        letterSpacing="1.5"
      >
        ACHADINHOS
      </text>

      {/* Faixa inferior: DELIVERY + Carinha de Moto Elaborado */}
      <rect x="22" y="162" width="114" height="34" rx="10" fill="#09090B" />
      <text
        x="79"
        y="185"
        textAnchor="middle"
        fill="#FFFFFF"
        fontFamily="sans-serif"
        fontWeight="900"
        fontSize="17"
        letterSpacing="1.5"
      >
        DELIVERY
      </text>

      {/* Linhas de velocidade */}
      <line
        x1="26"
        y1="210"
        x2="68"
        y2="210"
        stroke="#FFFFFF"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <line
        x1="38"
        y1="224"
        x2="92"
        y2="224"
        stroke="#09090B"
        strokeWidth="4.5"
        strokeLinecap="round"
      />

      {/* CARINHA DE MOTO ELABORADO (Direita Inferior) */}
      <g transform="translate(132, 148)">
        <rect
          x="8"
          y="22"
          width="26"
          height="24"
          rx="5"
          fill="#FFFFFF"
          stroke="#09090B"
          strokeWidth="3"
        />
        <path
          d="M15 36C18 40 24 40 27 36"
          stroke="#7C3AED"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        <circle
          cx="48"
          cy="16"
          r="12"
          fill="#FFFFFF"
          stroke="#09090B"
          strokeWidth="3"
        />
        <path d="M50 11H59C60 14 59 18 56 19H50V11Z" fill="#09090B" />
        <path
          d="M36 48L42 28L66 34"
          stroke="#FFFFFF"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M14 48H52L62 56H82L72 30H62"
          fill="#09090B"
          stroke="#FFFFFF"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="77" cy="34" r="4" fill="#FFFFFF" />
        <circle
          cx="26"
          cy="64"
          r="13"
          fill="#09090B"
          stroke="#FFFFFF"
          strokeWidth="4"
        />
        <circle cx="26" cy="64" r="5" fill="#7C3AED" />
        <circle
          cx="76"
          cy="64"
          r="13"
          fill="#09090B"
          stroke="#FFFFFF"
          strokeWidth="4"
        />
        <circle cx="76" cy="64" r="5" fill="#7C3AED" />
      </g>
    </svg>
  );
};

// Logotipo principal "Achadinhos Delivery":
// Na linha de cima: Achadinh + [Bolsa de Compras alinhada na linha com a carinha menor dentro] + s
// Na linha de baixo: DELIVERY + Carinha de Moto elaborado
export const AchadinhosDeliveryLogo: React.FC<{
  size?: 'sm' | 'lg';
  theme?: 'light' | 'dark';
  className?: string;
}> = ({ size = 'sm', theme = 'light', className = '' }) => {
  const isLarge = size === 'lg';
  const isDark = theme === 'dark';

  return (
    <span
      aria-label="Achadinhos Delivery"
      className={`inline-flex flex-col items-start select-none leading-none ${className}`}
    >
      <span className="sr-only">Achadinhos Delivery</span>

      {/* Linha Superior perfeitamente alinhada na horizontal (sem cair para baixo da linha!) */}
      <span
        aria-hidden="true"
        className={`inline-flex items-center font-display font-bold tracking-tight leading-none ${
          isDark ? 'text-white' : 'text-zinc-950'
        } ${isLarge ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-xl'}`}
      >
        <span>Achadinh</span>

        {/* Bolsa de Compras com a carinha menor dentro, alinhada na linha das letras */}
        <span className="inline-flex items-center justify-center mx-0.5 -translate-y-[1px]">
          <ShoppingBagFaceBadge
            className={
              isLarge
                ? 'w-7 h-7 sm:w-8 sm:h-8'
                : 'w-5 h-5 sm:w-6 sm:h-6'
            }
            bagFill="#FFFFFF"
            bagStroke="#7C3AED"
            handleStroke={isDark ? '#FFFFFF' : '#09090B'}
          />
        </span>

        <span>s</span>
      </span>

      {/* Linha Inferior: Badge DELIVERY + Carinha de Moto Elaborado (com espaço limpo sem sobrepor) */}
      <span
        aria-hidden="true"
        className="inline-flex items-center gap-1.5 mt-0.5 leading-none"
      >
        <span
          className={`font-sans font-black tracking-wider uppercase px-1.5 py-0.5 rounded bg-[#7C3AED] text-white leading-none shadow-2xs ${
            isLarge ? 'text-[11px] sm:text-xs' : 'text-[9px] sm:text-[10px]'
          }`}
        >
          Delivery
        </span>

        {/* Carinha de Moto Elaborado */}
        <svg
          viewBox="0 0 54 32"
          fill="none"
          className={
            isLarge
              ? 'w-10 h-6 shrink-0'
              : 'w-7.5 h-4.5 sm:w-8.5 sm:h-5 shrink-0'
          }
        >
          <line
            x1="1"
            y1="14"
            x2="8"
            y2="14"
            stroke="#7C3AED"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <line
            x1="3"
            y1="19"
            x2="9"
            y2="19"
            stroke={isDark ? '#FFFFFF' : '#09090B'}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <line
            x1="0.5"
            y1="24"
            x2="7.5"
            y2="24"
            stroke="#9333EA"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Baú de entrega Roxo com mini sorriso branco */}
          <rect
            x="10"
            y="8.5"
            width="11"
            height="10"
            rx="2.2"
            fill="#7C3AED"
            stroke={isDark ? '#FFFFFF' : '#09090B'}
            strokeWidth="1.5"
          />
          <path
            d="M13 14.5C14.5 16.5 17 16.5 18.5 14.5"
            stroke="#FFFFFF"
            strokeWidth="1.5"
            strokeLinecap="round"
          />

          {/* Capacete do Entregador */}
          <circle
            cx="26.5"
            cy="6.5"
            r="5"
            fill="#09090B"
            stroke="#7C3AED"
            strokeWidth="1.8"
          />
          <path
            d="M27.5 4.2H31.2C31.8 5.6 31.4 7.4 29.8 8H27.5V4.2Z"
            fill="#FFFFFF"
          />

          {/* Corpo do entregador */}
          <path
            d="M21 19.5L24.5 11.5L34.5 13.5"
            stroke={isDark ? '#FFFFFF' : '#09090B'}
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M21 19.5L24.5 11.5L30 12.8"
            stroke="#7C3AED"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Carena e Chassi da Moto Scooter */}
          <path
            d="M12 19.5H29L33.5 22.5H42L38 11.5H33.5"
            fill="#7C3AED"
            stroke={isDark ? '#FFFFFF' : '#09090B'}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Farol dianteiro */}
          <circle cx="40.5" cy="13.5" r="2" fill="#FFFFFF" stroke="#09090B" strokeWidth="1" />
          <path
            d="M44 12L49 10.5M44.5 14L50 14M44 16L49 17.5"
            stroke="#7C3AED"
            strokeWidth="1.6"
            strokeLinecap="round"
          />

          {/* Roda Traseira */}
          <circle
            cx="17.5"
            cy="25"
            r="5"
            fill="#09090B"
            stroke={isDark ? '#FFFFFF' : '#09090B'}
            strokeWidth="1.5"
          />
          <circle cx="17.5" cy="25" r="2.8" fill="#7C3AED" />
          <circle cx="17.5" cy="25" r="1.1" fill="#FFFFFF" />

          {/* Roda Dianteira */}
          <circle
            cx="39.5"
            cy="25"
            r="5"
            fill="#09090B"
            stroke={isDark ? '#FFFFFF' : '#09090B'}
            strokeWidth="1.5"
          />
          <circle cx="39.5" cy="25" r="2.8" fill="#7C3AED" />
          <circle cx="39.5" cy="25" r="1.1" fill="#FFFFFF" />
        </svg>
      </span>
    </span>
  );
};
