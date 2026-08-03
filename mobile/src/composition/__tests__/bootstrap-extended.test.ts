import { crearRepositoriosEmision } from '../emision-repositories';


describe('repositorios de emision expuestos por BootstrapApp', () => {
  it('crea periodoRepo, liquidacionRepo y consumoHistoricoRepo', () => {
    const repos = crearRepositoriosEmision();

    expect(repos.periodoRepo).toBeDefined();
    expect(repos.liquidacionRepo).toBeDefined();
    expect(repos.consumoHistoricoRepo).toBeDefined();
  });

  it('cada repositorio expone buscarPorId, listar y operaciones de escritura', () => {
    const repos = crearRepositoriosEmision();

    for (const repo of [
      repos.periodoRepo,
      repos.liquidacionRepo,
      repos.consumoHistoricoRepo,
    ]) {
      expect(typeof repo.buscarPorId).toBe('function');
      expect(typeof repo.listar).toBe('function');
      expect(typeof repo.crear).toBe('function');
      expect(typeof repo.guardar).toBe('function');
      expect(typeof repo.actualizar).toBe('function');
      expect(typeof repo.eliminar).toBe('function');
    }

    expect(typeof repos.consumoHistoricoRepo.listarPorSuscriptor).toBe('function');
  });
});
