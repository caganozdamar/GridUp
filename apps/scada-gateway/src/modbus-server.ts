import type { EventEmitter } from 'events';
import { ServerTCP } from 'modbus-serial';
import type { RegisterStore } from './register-store.js';

export interface ModbusServerHandle {
  close(): Promise<void>;
}

/**
 * READ-ONLY Modbus TCP server (Asama 7 madde 9).
 *
 * Sadece `getHoldingRegister` implemente edilir (FC03/FC04 -> Read Holding
 * Registers). `setRegister`/`setCoil` KASITLI OLARAK tanimlanmaz: bu
 * kutuphanede (modbus-serial) bir write vector'u yoksa, gelen FC06/FC16
 * yazma istekleri hicbir state degistirmeden yanitsiz birakilir (istemci
 * tarafinda timeout olur). Boylece SCADA/PLC tarafi bu prototip uzerinden
 * GRID UP'a asla komut/veri yazamaz.
 */
export function startModbusServer(store: RegisterStore, options: { host: string; port: number }): ModbusServerHandle {
  const server = new ServerTCP(
    {
      getHoldingRegister: (address: number) => store.readRegister(address),
    },
    { host: options.host, port: options.port, unitID: 1 },
  );

  // modbus-serial'in ServerTCP.d.ts overload seti nodenext altinda TS'in
  // dogru overload'u secmesini engelliyor; EventEmitter'in genel `on`
  // imzasina cast edilerek workaround yapiliyor.
  const emitter = server as unknown as EventEmitter;
  emitter.on('socketError', (err: Error) => {
    console.error(`[SCADA] Modbus socket error: ${err.message}`);
  });

  emitter.on('serverError', (err: Error) => {
    console.error(`[SCADA] Modbus server error: ${err.message}`);
  });

  return {
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}
