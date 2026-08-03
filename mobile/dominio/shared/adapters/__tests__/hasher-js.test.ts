import { crearHasherJs } from '../hasher-js';

describe('hasher-js adapter', () => {
  test('calcula sha256 conocido para input "hola"', () => {
    // Hash sha256 de "hola" verificado independientemente:
    // echo -n "hola" | sha256sum
    const esperado = 'b221d9dbb083a7f33428d7c2a3c3198ae925614d70210e28716ccaa7cd4ddb79';
    const hasher = crearHasherJs();
    expect(hasher.sha256('hola')).toBe(esperado);
  });

  test('mismo input produce mismo hash (determinismo)', () => {
    const hasher = crearHasherJs();
    expect(hasher.sha256('payload-canonico')).toBe(hasher.sha256('payload-canonico'));
  });

  test('inputs distintos producen hashes distintos', () => {
    const hasher = crearHasherJs();
    expect(hasher.sha256('a')).not.toBe(hasher.sha256('b'));
  });
});
