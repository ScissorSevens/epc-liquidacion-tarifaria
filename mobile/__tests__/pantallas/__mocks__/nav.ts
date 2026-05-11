import { jest } from '@jest/globals';

export const crearNavMock = () => ({
  navigate: jest.fn(),
  goBack: jest.fn(),
  popToTop: jest.fn(),
  replace: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
  dispatch: jest.fn(),
});

export const crearRouteMock = (params: Record<string, unknown> = {}) => ({
  key: 'test-route',
  name: 'Test',
  params,
});
