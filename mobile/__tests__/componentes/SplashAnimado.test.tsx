import { render } from '@testing-library/react-native';
import { Image } from 'react-native';

import { SplashAnimado } from '../../src/componentes/SplashAnimado';

describe('SplashAnimado', () => {
  const logoFixture = { uri: 'logo-test-fixture' };

  it('monta sin errores con el logo provisto', () => {
    const { UNSAFE_root } = render(
      <SplashAnimado onAnimationEnd={jest.fn()} logo={logoFixture} />,
    );
    expect(UNSAFE_root).toBeTruthy();
  });

  it('contiene un nodo Image con el source del logo', () => {
    const { UNSAFE_getByType } = render(
      <SplashAnimado onAnimationEnd={jest.fn()} logo={logoFixture} />,
    );
    const imagenes = UNSAFE_getByType(Image);
    expect(imagenes).toBeTruthy();
    expect(imagenes.props.source).toEqual(logoFixture);
  });

  it('no invoca onAnimationEnd inmediatamente al montar', () => {
    const onAnimationEnd = jest.fn();
    render(<SplashAnimado onAnimationEnd={onAnimationEnd} logo={logoFixture} />);
    expect(onAnimationEnd).not.toHaveBeenCalled();
  });
});