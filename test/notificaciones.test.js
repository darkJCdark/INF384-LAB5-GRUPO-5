const test = require('node:test');
const assert = require('node:assert');
const { validarUrlNotificacion, registrarComercio, urlDeComercio } = require('../src/notificaciones');

test('acepta una url publica https', () => {
  assert.strictEqual(validarUrlNotificacion('https://comercio.example.com/pagos').ok, true);
});

test('rechaza http', () => {
  assert.strictEqual(validarUrlNotificacion('http://comercio.example.com/pagos').ok, false);
});

test('rechaza una direccion privada', () => {
  assert.strictEqual(validarUrlNotificacion('https://10.0.0.8/pagos').ok, false);
  assert.strictEqual(validarUrlNotificacion('https://192.168.1.20/pagos').ok, false);
});

test('rechaza localhost', () => {
  assert.strictEqual(validarUrlNotificacion('https://localhost/pagos').ok, false);
  assert.strictEqual(validarUrlNotificacion('https://127.0.0.1/pagos').ok, false);
});

test('rechaza otras formas de direccion interna', () => {
  assert.strictEqual(validarUrlNotificacion('https://172.16.5.1/pagos').ok, false);
  assert.strictEqual(validarUrlNotificacion('https://169.254.169.254/pagos').ok, false);
  assert.strictEqual(validarUrlNotificacion('https://127.1/pagos').ok, false);
  assert.strictEqual(validarUrlNotificacion('https://[::1]/pagos').ok, false);
  assert.strictEqual(validarUrlNotificacion('https://[::ffff:10.0.0.1]/pagos').ok, false);
});

test('acepta una direccion publica fuera de los rangos internos', () => {
  assert.strictEqual(validarUrlNotificacion('https://172.32.0.1/pagos').ok, true);
  assert.strictEqual(validarUrlNotificacion('https://8.8.8.8/pagos').ok, true);
});

test('registra la url del comercio', () => {
  const r = registrarComercio('bodega-lucha', 'https://bodega.example.com/aviso');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(urlDeComercio('bodega-lucha'), 'https://bodega.example.com/aviso');
});
