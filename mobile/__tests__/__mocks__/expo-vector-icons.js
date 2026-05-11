// Mock de @expo/vector-icons para tests
const React = require('react');
const { Text } = require('react-native');

function crearIconoMock(nombre) {
  return function IconoMock(props) {
    return React.createElement(Text, { testID: props.testID }, nombre);
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
