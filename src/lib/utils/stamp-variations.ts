/**
 * Generates random stamp variations for AI score badges
 * Creates truly random imperfections on each render for authentic rubber stamp feel
 */

export interface StampVariation {
  rotation: number;      // -3 to 3 degrees
  opacity: number;       // 0.85 to 1
  translateX: number;    // -2 to 2 px
  translateY: number;    // -1 to 1 px
  inkBleed: number;      // 0 to 2 px blur
  pressureSkew: 'left' | 'right' | 'top' | 'bottom' | 'none';
}

/**
 * Generate random stamp CSS custom properties
 * Apply these as inline styles on stamp elements
 */
export function getStampVariation(): StampVariation {
  return {
    rotation: (Math.random() - 0.5) * 6,           // -3 to 3 degrees
    opacity: 0.85 + Math.random() * 0.15,          // 0.85 to 1
    translateX: (Math.random() - 0.5) * 4,         // -2 to 2 px
    translateY: (Math.random() - 0.5) * 2,         // -1 to 1 px
    inkBleed: Math.random() * 2,                   // 0 to 2 px
    pressureSkew: getRandomPressure(),
  };
}

function getRandomPressure(): 'left' | 'right' | 'top' | 'bottom' | 'none' {
  const options: Array<'left' | 'right' | 'top' | 'bottom' | 'none'> = [
    'left', 'right', 'top', 'bottom', 'none', 'none' // 'none' weighted higher
  ];
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * Convert stamp variation to inline CSS style object
 */
export function getStampStyles(variation?: StampVariation): React.CSSProperties {
  const v = variation || getStampVariation();

  const pressureShadow = getPressureShadow(v.pressureSkew);

  return {
    // '--stamp-rotation': `${v.rotation}deg`,
    '--stamp-opacity': v.opacity,
    // Rotation commented out - keeping other random variations
    // transform: `rotate(${v.rotation}deg) translate(${v.translateX}px, ${v.translateY}px)`,
    transform: `translate(${v.translateX}px, ${v.translateY}px)`,
    opacity: v.opacity,
    // Removed blur filter - causes text rendering issues in Safari/Brave
    boxShadow: pressureShadow,
  } as React.CSSProperties;
}

function getPressureShadow(pressure: StampVariation['pressureSkew']): string | undefined {
  const shadowIntensity = 0.15;

  switch (pressure) {
    case 'left':
      return `inset 3px 0 0 rgba(0,0,0,${shadowIntensity})`;
    case 'right':
      return `inset -3px 0 0 rgba(0,0,0,${shadowIntensity})`;
    case 'top':
      return `inset 0 3px 0 rgba(0,0,0,${shadowIntensity})`;
    case 'bottom':
      return `inset 0 -3px 0 rgba(0,0,0,${shadowIntensity})`;
    default:
      return undefined;
  }
}

/**
 * Get the stamp class name based on AI classification
 */
export function getStampClass(classification: string): string {
  const classMap: Record<string, string> = {
    'human': 'stamp-human',
    'likely_human': 'stamp-likely-human',
    'unsure': 'stamp-unsure',
    'likely_ai': 'stamp-likely-ai',
    'ai': 'stamp-ai',
  };

  return classMap[classification] || 'stamp-unsure';
}

/**
 * Get human-readable label for classification
 */
export function getStampLabel(classification: string): string {
  const labelMap: Record<string, string> = {
    'human': 'Human',
    'likely_human': 'Likely Human',
    'unsure': 'Unsure',
    'likely_ai': 'Likely AI',
    'ai': 'AI Generated',
  };

  return labelMap[classification] || 'Unknown';
}
