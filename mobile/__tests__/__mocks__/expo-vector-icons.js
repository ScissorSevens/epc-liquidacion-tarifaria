// Mock de @expo/vector-icons para tests.
//
// Antes: el mock rendereaba <Text testID={...}>nombreSet</Text> con el
// nombre del set ("MaterialIcons") como children, ignorando el `name`
// prop. Eso impedia distinguir "icono presente" de "icono ausente" via
// el nombre del icono en tests.
//
// Ahora: el mock respeta el `name` prop y lo expone como children del
// Text, ademas de propagar testID y accessibilityLabel. Asi los tests
// pueden:
//   1. Buscar el icono por nombre (getByText('badge')).
//   2. Buscar el icono por testID derivado (getByTestId('ff-9-icon')).
//   3. Verificar accesibilidad (accessibilityLabel propagado).
//
// Compatible con tests previos: cuando NO se pasa `name`, children es
// la cadena vacia, asi que los filtros existentes que buscaban nombres
// especificos siguen retornando length 0.
const React = require('react');
const { Text } = require('react-native');

function crearIconoMock(nombre) {
  return function IconoMock(props) {
    return React.createElement(
      Text,
      {
        testID: props.testID,
        accessibilityLabel: props.accessibilityLabel,
      },
      props.name !== undefined && props.name !== null ? props.name : '',
    );
  };
}

const MaterialIcons = crearIconoMock('MaterialIcons');
const Ionicons = crearIconoMock('Ionicons');
const FontAwesome = crearIconoMock('FontAwesome');
const AntDesign = crearIconoMock('AntDesign');
const Feather = crearIconoMock('Feather');

// Soporte para import default Y import nombrado
MaterialIcons.default = MaterialIcons;

module.exports = MaterialIcons;
module.exports.default = MaterialIcons;
module.exports.MaterialIcons = MaterialIcons;
module.exports.Ionicons = Ionicons;
module.exports.FontAwesome = FontAwesome;
module.exports.AntDesign = AntDesign;
module.exports.Feather = Feather;
