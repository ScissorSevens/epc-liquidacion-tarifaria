import { crearIdGeneratorUuid } from '../id-generator-uuid';

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('id-generator-uuid adapter', () => {
  test('genera uuid v4 válido', () => {
    const gen = crearIdGeneratorUuid();
    const id = gen.uuid();
    expect(id).toMatch(UUID_V4_REGEX);
  });

  test('dos llamadas devuelven uuids distintos', () => {
    const gen = crearIdGeneratorUuid();
    expect(gen.uuid()).not.toBe(gen.uuid());
  });
});
