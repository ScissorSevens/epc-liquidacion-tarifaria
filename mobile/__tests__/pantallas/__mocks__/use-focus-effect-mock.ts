// Importar este archivo al inicio de cada test que use useFocusEffect
// Sustituye useFocusEffect por useEffect que se ejecuta solo una vez
jest.mock('@react-navigation/native', () => {
  const ReactNative = require('react');
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useFocusEffect: (cb) => {
      ReactNative.useEffect(() => {
        const cleanup = cb();
        return typeof cleanup === 'function' ? cleanup : undefined;
      }, []); // eslint-disable-line react-hooks/exhaustive-deps
    },
  };
});
