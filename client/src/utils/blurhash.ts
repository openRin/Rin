const BASE83_ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~";

const encode83 = (value: number, length: number) => {
  let result = "";
  for (let i = 1; i <= length; i++) {
    const digit = Math.floor(value / 83 ** (length - i)) % 83;
    result += BASE83_ALPHABET[digit] || "";
  }
  return result;
};

const decode83 = (value: string) => {
  let result = 0;
  for (const char of value) {
    const digit = BASE83_ALPHABET.indexOf(char);
    if (digit === -1) {
      throw new Error("Invalid blurhash character");
    }
    result = result * 83 + digit;
  }
  return result;
};

const srgbToLinear = (value: number) => {
  const normalized = value / 255;
  if (normalized <= 0.04045) {
    return normalized / 12.92;
  }
  return ((normalized + 0.055) / 1.055) ** 2.4;
};

const linearToSrgb = (value: number) => {
  const normalized = Math.max(0, Math.min(1, value));
  if (normalized <= 0.0031308) {
    return Math.round(normalized * 12.92 * 255 + 0.5);
  }
  return Math.round((1.055 * normalized ** (1 / 2.4) - 0.055) * 255 + 0.5);
};

const signPow = (value: number, exp: number) => {
  return Math.sign(value) * Math.abs(value) ** exp;
};

const encodeDC = ([r, g, b]: [number, number, number]) => {
  return (linearToSrgb(r) << 16) + (linearToSrgb(g) << 8) + linearToSrgb(b);
};

const decodeDC = (value: number): [number, number, number] => {
  const r = value >> 16;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
};

const encodeAC = (
  [r, g, b]: [number, number, number],
  maximumValue: number,
) => {
  const quantR = Math.floor(
    Math.max(0, Math.min(18, Math.floor(signPow(r / maximumValue, 0.5) * 9 + 9.5))),
  );
  const quantG = Math.floor(
    Math.max(0, Math.min(18, Math.floor(signPow(g / maximumValue, 0.5) * 9 + 9.5))),
  );
  const quantB = Math.floor(
    Math.max(0, Math.min(18, Math.floor(signPow(b / maximumValue, 0.5) * 9 + 9.5))),
  );

  return quantR * 19 * 19 + quantG * 19 + quantB;
};

const decodeAC = (
  value: number,
  maximumValue: number,
): [number, number, number] => {
  const quantR = Math.floor(value / (19 * 19));
  const quantG = Math.floor(value / 19) % 19;
  const quantB = value % 19;

  return [
    signPow((quantR - 9) / 9, 2) * maximumValue,
    signPow((quantG - 9) / 9, 2) * maximumValue,
    signPow((quantB - 9) / 9, 2) * maximumValue,
  ];
};

export function encodeBlurhash(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  componentX = 4,
  componentY = 3,
) {
  if (componentX < 1 || componentX > 9 || componentY < 1 || componentY > 9) {
    throw new Error("Blurhash components must be between 1 and 9");
  }
  if (width <= 0 || height <= 0 || pixels.length !== width * height * 4) {
    throw new Error("Invalid image data for blurhash");
  }

  const factors: Array<[number, number, number]> = [];

  for (let y = 0; y < componentY; y++) {
    for (let x = 0; x < componentX; x++) {
      const normalisation = x === 0 && y === 0 ? 1 : 2;
      let r = 0;
      let g = 0;
      let b = 0;

      for (let j = 0; j < height; j++) {
        for (let i = 0; i < width; i++) {
          const basis =
            normalisation *
            Math.cos((Math.PI * x * i) / width) *
            Math.cos((Math.PI * y * j) / height);
          const index = 4 * (j * width + i);
          r += basis * srgbToLinear(pixels[index] || 0);
          g += basis * srgbToLinear(pixels[index + 1] || 0);
          b += basis * srgbToLinear(pixels[index + 2] || 0);
        }
      }

      const scale = 1 / (width * height);
      factors.push([r * scale, g * scale, b * scale]);
    }
  }

  const dc = factors[0] || [0, 0, 0];
  const ac = factors.slice(1);

  let maximumValue = 1;
  if (ac.length > 0) {
    const actualMaximumValue = Math.max(
      ...ac.map((value) => Math.max(Math.abs(value[0]), Math.abs(value[1]), Math.abs(value[2]))),
    );
    const quantisedMaximumValue = Math.max(
      0,
      Math.min(82, Math.floor(actualMaximumValue * 166 - 0.5)),
    );
    maximumValue = (quantisedMaximumValue + 1) / 166;
  }

  const sizeFlag = componentX - 1 + (componentY - 1) * 9;
  const quantisedMaximumValue =
    ac.length > 0 ? Math.max(0, Math.min(82, Math.floor(maximumValue * 166 - 1))) : 0;

  let blurhash = "";
  blurhash += encode83(sizeFlag, 1);
  blurhash += encode83(quantisedMaximumValue, 1);
  blurhash += encode83(encodeDC(dc), 4);

  for (const value of ac) {
    blurhash += encode83(encodeAC(value, maximumValue), 2);
  }

  return blurhash;
}

export function decodeBlurhash(
  blurhash: string,
  width: number,
  height: number,
  punch = 1,
) {
  if (!blurhash || blurhash.length < 6) {
    throw new Error("Invalid blurhash");
  }

  const sizeFlag = decode83(blurhash[0] || "");
  const componentX = (sizeFlag % 9) + 1;
  const componentY = Math.floor(sizeFlag / 9) + 1;
  const expectedLength = 4 + 2 * componentX * componentY;
  if (blurhash.length !== expectedLength) {
    throw new Error("Invalid blurhash length");
  }

  const maximumValue = (decode83(blurhash[1] || "") + 1) / 166;
  const colors: Array<[number, number, number]> = [];

  colors.push(decodeDC(decode83(blurhash.slice(2, 6))));

  for (let i = 1; i < componentX * componentY; i++) {
    const value = decode83(blurhash.slice(4 + i * 2, 6 + i * 2));
    colors.push(decodeAC(value, maximumValue * punch));
  }

  const pixels = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0;
      let g = 0;
      let b = 0;

      for (let j = 0; j < componentY; j++) {
        for (let i = 0; i < componentX; i++) {
          const basis =
            Math.cos((Math.PI * x * i) / width) *
            Math.cos((Math.PI * y * j) / height);
          const color = colors[i + j * componentX] || [0, 0, 0];
          r += color[0] * basis;
          g += color[1] * basis;
          b += color[2] * basis;
        }
      }

      const index = 4 * (y * width + x);
      pixels[index] = linearToSrgb(r);
      pixels[index + 1] = linearToSrgb(g);
      pixels[index + 2] = linearToSrgb(b);
      pixels[index + 3] = 255;
    }
  }

  return pixels;
}

export function drawBlurhashToCanvas(
  canvas: HTMLCanvasElement,
  blurhash: string,
  width = 32,
  height = 32,
) {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  const pixels = decodeBlurhash(blurhash, width, height);
  const imageData = new ImageData(pixels, width, height);
  canvas.width = width;
  canvas.height = height;
  context.putImageData(imageData, 0, 0);
}
