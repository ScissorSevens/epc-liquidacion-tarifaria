// Mock de expo-asset para tests
module.exports = {
  Asset: {
    loadAsync: jest.fn().mockResolvedValue([]),
    fromModule: jest.fn(() => ({ uri: 'mock-uri', localUri: 'mock-local-uri' })),
  },
};
