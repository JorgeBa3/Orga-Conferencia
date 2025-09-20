# Documentación del Sistema de Chat Multi-dispositivo ESP32

## Descripción General

Este sistema completo permite la comunicación entre tres dispositivos diferentes: una aplicación web (frontend), un servidor Node.js (backend) y un dispositivo ESP32 que actúa como hub de comunicación. El ESP32 maneja tanto conexión USB (con la computadora) como Bluetooth (con dispositivos móviles), creando un chat multi-dispositivo en tiempo real.

![alt text](<Diagrama sin título.drawio.png>)
## Arquitectura del Sistema

```
Dispositivo Móvil (Bluetooth) ↔ ESP32 ↔ Servidor Node.js (USB) ↔ Frontend Web (WebSocket)
```

### Componentes del Sistema

1. **Frontend Web**: Interfaz de usuario HTML/CSS/JS
2. **Servidor Node.js**: Backend con WebSocket y comunicación serial
3. **ESP32**: Hub de comunicación con Bluetooth y USB
4. **Dispositivo Móvil**: Cliente Bluetooth

## Dependencias

```json
{
  "express": "^4.x.x",
  "serialport": "^10.x.x", 
  "@serialport/parser-readline": "^10.x.x",
  "cors": "^2.x.x",
  "ws": "^8.x.x"
}
```

## Componentes Principales

### 1. Frontend Web (HTML/CSS/JavaScript)

#### Características
- **Interfaz**: Chat responsivo con diseño moderno
- **Conexión**: WebSocket para comunicación en tiempo real
- **Estilos**: Mensajes diferenciados por origen (Computadora/Teléfono)

#### Funcionalidades
- Envío de mensajes mediante formulario
- Recepción automática de mensajes vía WebSocket  
- Clasificación visual de mensajes por origen
- Scroll automático para nuevos mensajes

#### Estructura del DOM
```html
#chat-container
├── h1 (título)
├── #messages (contenedor de mensajes)
└── #messageForm (formulario de envío)
    ├── #messageInput (campo de texto)
    └── button (botón enviar)
```

#### Clases CSS para Mensajes
- `.message.computer`: Mensajes de la computadora (azul, alineados a la derecha)
- `.message.phone`: Mensajes del teléfono (verde, alineados a la izquierda)

### 2. Servidor Node.js (Backend)

#### Servidor HTTP (Express)

- **Puerto**: 3000
- **Middlewares**:
  - `cors()`: Habilita CORS para solicitudes cross-origin
  - `express.json()`: Parser para peticiones JSON
- **Función**: Maneja peticiones HTTP REST y sirve como base para el servidor WebSocket

#### Servidor WebSocket

- **Implementación**: Biblioteca `ws`
- **Puerto**: Compartido con el servidor HTTP (3000)
- **Funcionalidad**: 
  - Acepta conexiones WebSocket desde el frontend
  - Difunde mensajes a todos los clientes conectados

##### Función `broadcast(message)`

```javascript
function broadcast(message) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}
```

**Propósito**: Envía un mensaje a todos los clientes WebSocket conectados que estén en estado abierto.

#### Conexión Serial USB

- **Puerto**: COM3
- **Velocidad**: 115200 baudios
- **Parser**: ReadlineParser con delimitador `\n`

##### Configuración del Puerto Serial

```javascript
const serialPort = new SerialPort({
  path: 'COM3', 
  baudRate: 115200,
});
```

##### Eventos del Puerto Serial

- **`open`**: Se ejecuta cuando se establece la conexión con el ESP32
- **`error`**: Maneja errores de comunicación serial
- **`data`**: Procesa datos recibidos del ESP32 y los difunde vía WebSocket

### 3. ESP32 (Hub de Comunicación)

#### Características Técnicas
- **Microcontrolador**: ESP32
- **Bibliotecas**: BluetoothSerial
- **Comunicación**: 
  - Puerto serie (USB) a 115200 baudios
  - Bluetooth Serial con nombre "ESP32_Chat_Hub"

#### Funcionalidad Principal
El ESP32 actúa como intermediario entre:
- Dispositivos móviles (vía Bluetooth)
- Servidor Node.js (vía USB/Serial)

#### Lógica de Procesamiento de Mensajes

1. **Recepción desde PC (USB)**:
   - Lee mensajes del puerto serie
   - Los reenvía al dispositivo Bluetooth conectado
   - Genera respuesta propia con prefijo "ESP dice:"

2. **Recepción desde Teléfono (Bluetooth)**:
   - Lee mensajes del puerto Bluetooth
   - Los reenvía al servidor vía USB con prefijo "Mensaje del telefono:"
   - Genera respuesta propia con prefijo "ESP dice:"

#### Código Principal (loop())
```cpp
// Revisa mensajes de la computadora (USB)
if (Serial.available()) {
    mensajeRecibido = Serial.readStringUntil('\n');
    // Reenvía al teléfono vía Bluetooth
    SerialBT.println(mensajeRecibido);
}

// Revisa mensajes del teléfono (Bluetooth)  
if (SerialBT.available()) {
    mensajeRecibido = SerialBT.readStringUntil('\n');
    // Reenvía a la PC vía USB
    Serial.println("Mensaje del telefono" + mensajeRecibido);
}

// Genera respuesta del ESP32 a ambos dispositivos
String respuesta = "ESP dice: " + mensajeRecibido;
Serial.println(respuesta);    // A la computadora
SerialBT.println(respuesta);  // Al teléfono
```

## API Endpoints

### POST `/enviar-mensaje`

**Descripción**: Recibe mensajes del frontend y los procesa de forma dual.

**Cuerpo de la petición**:
```json
{
  "message": "string"
}
```

**Proceso de ejecución**:
1. Formatea el mensaje: `"Computadora dice: {mensaje}"`
2. Difunde inmediatamente el mensaje a todos los clientes WebSocket
3. Envía el mensaje al ESP32 vía puerto serial
4. Retorna estado de la operación

**Respuestas**:
- **200 OK**: `{ "status": "OK" }`
- **500 Error**: `{ "message": "error_message" }`

## Flujo de Comunicación Completo

### Escenario 1: Mensaje desde Frontend Web → Dispositivo Móvil

1. Usuario ingresa mensaje en el frontend web
2. Frontend envía POST a `/enviar-mensaje` del servidor Node.js
3. Servidor formatea mensaje como "Computadora dice: [mensaje]"
4. Servidor difunde mensaje a todos los clientes WebSocket (feedback inmediato)
5. Servidor envía mensaje al ESP32 vía puerto serial
6. ESP32 recibe mensaje y lo reenvía al dispositivo Bluetooth
7. ESP32 genera respuesta "ESP dice: [mensaje]" y la envía a ambos dispositivos

### Escenario 2: Mensaje desde Dispositivo Móvil → Frontend Web

1. Usuario envía mensaje desde app Bluetooth del móvil
2. ESP32 recibe mensaje vía Bluetooth
3. ESP32 reenvía mensaje al servidor con prefijo "Mensaje del telefono:"
4. Servidor recibe mensaje y lo difunde vía WebSocket
5. Frontend recibe y muestra mensaje clasificado como tipo "phone"
6. ESP32 genera respuesta "ESP dice: [mensaje]" y la envía a ambos dispositivos

### Tipos de Mensajes en el Sistema

- **"Computadora dice: [mensaje]"**: Originado desde el frontend web
- **"Mensaje del telefono[mensaje]"**: Originado desde dispositivo móvil
- **"ESP dice: [mensaje]"**: Respuesta automática del ESP32

## Configuración y Despliegue

### Requisitos del Sistema

#### Hardware
- ESP32 con Bluetooth integrado
- Cable USB para conexión ESP32-Computadora
- Dispositivo móvil con Bluetooth

#### Software
- Node.js 14+
- Arduino IDE o PlatformIO
- Aplicación de terminal Bluetooth en el móvil

### Instalación

#### 1. Servidor Node.js
```bash
npm install express serialport @serialport/parser-readline cors ws
```

#### 2. Programación del ESP32
```cpp
// Instalar biblioteca BluetoothSerial
#include "BluetoothSerial.h"
```

#### 3. Frontend Web
- Archivo HTML independiente
- No requiere instalación adicional

### Configuración

#### 1. ESP32
- Programar con el código Arduino proporcionado
- El dispositivo aparecerá como "ESP32_Chat_Hub" en Bluetooth

#### 2. Servidor Node.js  
- Verificar que el ESP32 esté conectado en COM3
- Ejecutar: `node server.js`

#### 3. Frontend Web
- Abrir el archivo HTML en un navegador
- Verificar conexión WebSocket a localhost:3000

#### 4. Dispositivo Móvil
- Emparejar con "ESP32_Chat_Hub"
- Usar aplicación de terminal Bluetooth (ej: Serial Bluetooth Terminal)

### Ejecución del Sistema

#### Orden de Inicio Recomendado

1. **Programar y conectar ESP32**
   ```bash
   # Compilar y subir código Arduino
   # Conectar ESP32 por USB
   ```

2. **Iniciar servidor Node.js**
   ```bash
   node server.js
   ```

3. **Abrir frontend web**
   ```bash
   # Abrir archivo HTML en navegador
   # Verificar conexión WebSocket
   ```

4. **Conectar dispositivo móvil**
   ```bash
   # Emparejar Bluetooth con "ESP32_Chat_Hub"
   # Abrir app de terminal Bluetooth
   ```

### Logs del Sistema

#### Servidor Node.js
- `✅ Backend escuchando en http://localhost:3000`
- `✅ Frontend conectado vía WebSocket.`
- `✅ Conexión USB con ESP32 en COM3 establecida.`
- `❌ Error de puerto serial: [mensaje_error]`

#### ESP32 (Monitor Serie)
- `El Hub de comunicacion esta listo. Version final.`
- Mensajes recibidos y procesados en tiempo real

#### Frontend Web
- Conexión WebSocket automática
- Mensajes clasificados visualmente por origen

## Consideraciones Técnicas

### Manejo de Errores

#### Servidor Node.js
- Errores del puerto serial se registran en consola
- Errores de escritura serial retornan HTTP 500
- Verificación del estado de WebSocket antes del envío

#### ESP32
- Verificación de disponibilidad de datos antes de lectura
- Limpieza de mensajes con `trim()` para eliminar caracteres de control
- Validación de longitud de mensajes antes del procesamiento

#### Frontend Web
- Manejo de errores de fetch con try-catch
- Reconexión automática de WebSocket (navegador)
- Validación de formulario para mensajes vacíos

### Escalabilidad

#### Limitaciones Actuales
- Un solo ESP32 por servidor Node.js
- Un dispositivo Bluetooth por ESP32
- Múltiples clientes WebSocket simultáneos (ilimitado)

#### Posibles Mejoras de Escalabilidad
- Múltiples ESP32 con identificadores únicos
- Pool de conexiones Bluetooth
- Sistema de salas/canales de chat

### Rendimiento

#### Optimizaciones Implementadas
- Comunicación asíncrona en todos los niveles
- Broadcast eficiente con verificación de estado WebSocket
- Parser de línea optimizado para datos serie
- CSS optimizado para renderizado rápido

#### Métricas Típicas
- Latencia de mensaje: < 100ms entre dispositivos
- Throughput: Limitado por velocidad serie (115200 baud)
- Capacidad de clientes WebSocket: Limitada por recursos del servidor

### Limitaciones del Sistema

#### Técnicas
- Puerto serial fijo (COM3) en el servidor
- Un solo dispositivo Bluetooth por ESP32
- Sin autenticación en WebSocket o Bluetooth
- Sin persistencia de mensajes
- Dependiente de la disponibilidad del puerto USB

#### Funcionales  
- No hay historial de chat persistente
- Sin indicadores de estado de conexión
- Sin confirmación de entrega de mensajes
- Mensajes limitados por buffer del puerto serie

#### Seguridad
- Comunicación sin cifrado
- Bluetooth sin autenticación
- WebSocket sin validación de origen
- Sin rate limiting para prevenir spam

## Posibles Mejoras y Extensiones

### Funcionalidades Avanzadas

#### Sistema de Chat
- **Historial persistente**: Base de datos para almacenar mensajes
- **Usuarios identificados**: Sistema de autenticación y perfiles
- **Salas de chat**: Múltiples canales de comunicación
- **Estado de conexión**: Indicadores en tiempo real de usuarios conectados
- **Confirmación de entrega**: Acknowledgment de mensajes recibidos

#### Mejoras Técnicas
- **Auto-detección de puertos**: Escaneo automático de puertos seriales disponibles
- **Configuración dinámica**: Variables de entorno y archivos de configuración
- **Logs estructurados**: Sistema de logging con niveles y rotación
- **Reconexión automática**: Manejo de desconexiones y reconexión inteligente
- **Rate limiting**: Prevención de spam y control de flujo

#### Seguridad
- **Autenticación WebSocket**: Tokens JWT para validación de clientes
- **Cifrado Bluetooth**: Implementación de protocolos seguros
- **Validación de entrada**: Sanitización y validación de mensajes
- **HTTPS/WSS**: Comunicación cifrada end-to-end

### Extensiones del Hardware

#### Múltiples ESP32
- Red de dispositivos ESP32 interconectados
- Protocolo de mesh networking
- Balanceador de carga para conexiones

#### Sensores Adicionales
- Indicadores LED de estado
- Botones físicos para funciones rápidas
- Pantalla OLED para mostrar mensajes
- Sensores ambientales integrados

### Mejoras de la Interfaz

#### Frontend Web
- **Interfaz responsive mejorada**: Diseño mobile-first
- **Temas personalizables**: Modo oscuro/claro
- **Emojis y multimedia**: Soporte para imágenes y emoticonos
- **Notificaciones**: Alerts del navegador para mensajes nuevos
- **PWA**: Aplicación web progresiva instalable

#### Aplicación Móvil Nativa
- Desarrollo de app nativa para iOS/Android
- Integración con notificaciones push
- Interfaz optimizada para móvil
- Gestión avanzada de conexiones Bluetooth

### Monitoreo y Analytics

#### Dashboard de Administración
- Panel de control para gestionar conexiones
- Estadísticas de uso y rendimiento
- Logs en tiempo real
- Configuración remota de parámetros


## Casos de Uso Extendidos

### Educación
- Aulas interactivas con comunicación estudiante-profesor
- Laboratorios de IoT y programación
- Demostraciones de protocolos de comunicación

### Domótica
- Hub central de comunicación para casa inteligente
- Control de dispositivos IoT desde múltiples interfaces
- Sistema de notificaciones familiares

### Industria
- Comunicación máquina-operador
- Monitoreo de sensores industriales
- Sistema de alertas de producción
