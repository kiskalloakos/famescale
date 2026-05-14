import { TextStyle } from 'react-native';

const noOffset = { width: 0, height: 0 };

// Subtle halo for small accents (icons ~14-24pt, small colored labels).
export const glowGreen: TextStyle = {
  textShadowColor: 'rgba(0, 200, 150, 0.4)',
  textShadowOffset: noOffset,
  textShadowRadius: 8,
};

export const glowAmber: TextStyle = {
  textShadowColor: 'rgba(255, 169, 77, 0.4)',
  textShadowOffset: noOffset,
  textShadowRadius: 8,
};

// Softer, wider halo for large display numbers (hero amounts 30pt+).
export const glowGreenHero: TextStyle = {
  textShadowColor: 'rgba(0, 200, 150, 0.25)',
  textShadowOffset: noOffset,
  textShadowRadius: 14,
};

export const glowAmberHero: TextStyle = {
  textShadowColor: 'rgba(255, 169, 77, 0.25)',
  textShadowOffset: noOffset,
  textShadowRadius: 14,
};
