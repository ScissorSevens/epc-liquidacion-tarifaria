ALTER TABLE suscriptor ADD COLUMN email TEXT;
ALTER TABLE suscriptor ADD COLUMN telefono TEXT;

CREATE INDEX idx_suscriptor_email ON suscriptor (email);
CREATE INDEX idx_suscriptor_telefono ON suscriptor (telefono);
