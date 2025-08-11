/**
 * Translates HSV to RGB
 *
 * @param r RED color 0..255
 * @param g GREEN color 0..255
 * @param b BLUE color 0..255
 * @returns [H, S, V]
 */
export function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  // Normalize RGB values to [0, 1]
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const v = max * 100;

  // Calculate Hue
  if (delta !== 0) {
    if (max === rNorm) {
      h = 60 * (((gNorm - bNorm) / delta) % 6);
    } else if (max === gNorm) {
      h = 60 * ((bNorm - rNorm) / delta + 2);
    } else {
      h = 60 * ((rNorm - gNorm) / delta + 4);
    }
  }

  if (h < 0) {
    h += 360;
  }

  // Calculate Saturation
  if (max !== 0) {
    s = (delta / max) * 100;
  }

  return {
    h: Math.round(h),
    s: Math.round(s),
    v: Math.round(v),
  };
}


/**
 * Translates HSV to RGB
 *
 * @param h (H)ue
 * @param s (S)aturation
 * @param v (V)alue
 * @returns [R,G,B] Color 0..255
 */
export function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const sNorm = s / 100;
  const vNorm = v / 100;
  const c = vNorm * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = vNorm - c;

  let rNorm = 0, gNorm = 0, bNorm = 0;

  if (h >= 0 && h < 60) {
    rNorm = c; gNorm = x; bNorm = 0;
  } else if (h >= 60 && h < 120) {
    rNorm = x; gNorm = c; bNorm = 0;
  } else if (h >= 120 && h < 180) {
    rNorm = 0; gNorm = c; bNorm = x;
  } else if (h >= 180 && h < 240) {
    rNorm = 0; gNorm = x; bNorm = c;
  } else if (h >= 240 && h < 300) {
    rNorm = x; gNorm = 0; bNorm = c;
  } else {
    rNorm = c; gNorm = 0; bNorm = x;
  }

  return {
    r: Math.round((rNorm + m) * 255),
    g: Math.round((gNorm + m) * 255),
    b: Math.round((bNorm + m) * 255),
  };
}

export function _HSVtoRGB(h: number, s: number, v: number): { r: number, g: number, b: number } {
  const hNorm = h / 360;
  const sNorm = s / 100;

  const i = Math.floor(hNorm * 6);
  const f = hNorm * 6 - i;
  const p = (1 - sNorm);
  const q = (1 - f * sNorm);
  const t = (1 - (1 - f) * sNorm);

  let r, g, b;

  if (i % 6 === 0) {
    r = 1; g = t; b = p;
  } else if (i % 6 === 1) {
    r = q; g = 1; b = p;
  } else if (i % 6 === 2) {
    r = p; g = 1; b = t;
  } else if (i % 6 === 3) {
    r = p; g = q; b = 1;
  } else if (i % 6 === 4) {
    r = t; g = p; b = 1;
  } else if (i % 6 === 5) {
    r = 1; g = p; b = q;
  }

  return {
    r: Math.round((r as number) * 255),
    g: Math.round((g as number) * 255),
    b: Math.round((b as number) * 255),
  };
}