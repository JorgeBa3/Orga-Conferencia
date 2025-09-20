const express = require('express');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const cors = require('cors');
const WebSocket = require('ws');

const app = express();
const port = 3000;

// --- Servidor HTTP ---
app.use(cors());
app.use(express.json());
const server = app.listen(port, () => {
    console.log(`✅ Backend escuchando en http://localhost:${port}`);
});

// --- WebSocket Server ---
const wss = new WebSocket.Server({ server });

wss.on('connection', ws => console.log('✅ Frontend conectado vía WebSocket.'));

function broadcast(message) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// --- Conexión Serial por USB ---
// Usamos el COM3 que nos mostraste en la imagen
const serialPort = new SerialPort({
  path: 'COM3', 
  baudRate: 115200,
});

const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));

serialPort.on('open', () => console.log('✅ Conexión USB con ESP32 en COM3 establecida.'));
serialPort.on('error', (err) => console.log('❌ Error de puerto serial: ', err.message));

// Escucha datos del ESP32 (que pueden venir del teléfono o ser un eco de la PC)
parser.on('data', data => broadcast(data));

// Endpoint para que el Frontend envíe mensajes
// Reemplaza esta parte en tu server.js
app.post('/enviar-mensaje', (req, res) => {
    const mensaje = `Computadora dice: ${req.body.message}`;
    
    // 1. Muestra el mensaje en el frontend INMEDIATAMENTE
    broadcast(mensaje);

    // 2. Envía el mensaje al ESP32 para que lo procese
    serialPort.write(`${mensaje}\n`, (err) => {
        if (err) {
            return res.status(500).send({ message: err.message });
        }
        res.send({ status: 'OK' });
    });
});