// Mock de expo-sqlite para tests
module.exports = {
  openDatabaseSync: jest.fn(() => ({
    execAsync: jest.fn().mockResolvedValue(undefined),
    getAllAsync: jest.fn().mockResolvedValue([]),
    getFirstAsync: jest.fn().mockResolvedValue(null),
    runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 }),
    closeAsync: jest.fn().mockResolvedValue(undefined),
  })),
  SQLiteDatabase: jest.fn(),
};
