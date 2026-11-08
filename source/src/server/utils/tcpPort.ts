import net from 'net';

export const isTcpPortInUse = (port: number, host = '127.0.0.1'): Promise<boolean> => new Promise((resolve) => {
  const socket = new net.Socket();

  const finish = (inUse: boolean) => {
    socket.removeAllListeners();
    socket.destroy();
    resolve(inUse);
  };

  socket.setTimeout(500);
  socket.once('connect', () => finish(true));
  socket.once('timeout', () => finish(false));
  socket.once('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'ECONNREFUSED' || error.code === 'EHOSTUNREACH') {
      finish(false);
      return;
    }
    finish(true);
  });

  socket.connect(port, host);
});
