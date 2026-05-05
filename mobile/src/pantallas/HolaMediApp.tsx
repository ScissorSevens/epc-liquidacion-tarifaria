import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Alert, Button, StyleSheet, Text, View } from 'react-native';
import { bootstrapApp } from '../composition/bootstrap';
import type { Lectura } from '@dominio/captura-lecturas/types';
import type { ItemCola } from '@dominio/sincronizacion/types';

function periodoActualYYYYMM(): string {
  const ahora = new Date();
  const yyyy = ahora.getFullYear().toString();
  const mm = (ahora.getMonth() + 1).toString().padStart(2, '0');
  return `${yyyy}${mm}`;
}

function generarIdMedidorTest(): number {
  // Usamos los ultimos 6 digitos del timestamp para evitar el UNIQUE
  // (id_medidor + id_periodo) entre corridas sucesivas durante una
  // misma sesion de prueba.
  return Number(Date.now().toString().slice(-6));
}

function generarUuidSimple(): string {
  // crypto.randomUUID NO esta garantizado en RN sin shim. Para el demo
  // usamos un UUID-like derivado de timestamp + random; suficiente para
  // satisfacer la PK TEXT de cola_sincronizacion.
  const ts = Date.now().toString(16);
  const rnd = Math.floor(Math.random() * 1e12).toString(16);
  return `demo-${ts}-${rnd}`;
}

export default function HolaMediApp() {
  const [cargando, setCargando] = useState(false);

  const probarPersistencia = async () => {
    setCargando(true);
    try {
      const { lecturaRepo, colaRepo, smoke } = await bootstrapApp();

      // 1. Insertar una lectura dummy.
      const idMedidor = generarIdMedidorTest();
      const periodo = periodoActualYYYYMM();
      const lecturaDummy: Lectura = {
        id_medidor: idMedidor,
        id_periodo: periodo,
        id_operario: 1,
        lectura_actual: 15,
        lectura_anterior: 0,
        estado_validacion: 'pendiente',
        timestamp_captura: new Date().toISOString(),
        estado_sync: 'pendiente',
      };
      const lecturaInsertada = await lecturaRepo.guardar(lecturaDummy);

      // 2. Leerla de vuelta por id.
      const lecturaLeida = await lecturaRepo.obtenerPorId(
        lecturaInsertada.id_lectura as number,
      );

      // 3. Encolar un mensaje sync dummy.
      const itemDummy: ItemCola = {
        id: generarUuidSimple(),
        tipo: 'LECTURA',
        payload: { idMedidor, periodo, valor: 15 },
        hashLocal: 'demo-hash-local',
        estado: 'PENDIENTE',
        intentos: 0,
        ultimoError: null,
        ultimoIntentoEn: null,
        creadoEn: new Date(),
      };
      await colaRepo.guardar(itemDummy);
      const colaPendientes = (await colaRepo.listarPendientes()).length;

      Alert.alert(
        'Persistencia OK',
        JSON.stringify(
          {
            estado: 'OK',
            smoke,
            lecturaInsertada,
            lecturaLeida,
            colaPendientes,
          },
          null,
          2,
        ),
      );
    } catch (error) {
      const e = error as Error;
      Alert.alert(
        'Persistencia FAIL',
        JSON.stringify(
          {
            estado: 'ERROR',
            mensaje: e.message,
            stack: e.stack?.split('\n').slice(0, 5).join('\n'),
          },
          null,
          2,
        ),
      );
    } finally {
      setCargando(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>MediApp</Text>
      <Text style={styles.subtitulo}>EPC Lecturas Rurales</Text>
      <Text style={styles.version}>v0.2.0 - Lunes 4 mayo 2026</Text>
      {cargando ? (
        <ActivityIndicator size="large" color="#0066cc" />
      ) : (
        <Button title="Probar Persistencia SQLite" onPress={probarPersistencia} />
      )}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  titulo: { fontSize: 32, fontWeight: 'bold', color: '#0066cc' },
  subtitulo: { fontSize: 18, marginTop: 8, color: '#444' },
  version: { fontSize: 12, marginTop: 4, marginBottom: 30, color: '#888' },
});
