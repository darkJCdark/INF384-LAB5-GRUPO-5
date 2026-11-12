const net = require('net');

// Rangos internos que no se aceptan como destino de notificacion.
// Reemplaza a la libreria `ip` (CVE-2024-29415, sin version corregida).
const internas = new net.BlockList();
internas.addSubnet('0.0.0.0', 8, 'ipv4');
internas.addSubnet('10.0.0.0', 8, 'ipv4');
internas.addSubnet('100.64.0.0', 10, 'ipv4');
internas.addSubnet('127.0.0.0', 8, 'ipv4');
internas.addSubnet('169.254.0.0', 16, 'ipv4');
internas.addSubnet('172.16.0.0', 12, 'ipv4');
internas.addSubnet('192.168.0.0', 16, 'ipv4');
internas.addAddress('::', 'ipv6');
internas.addAddress('::1', 'ipv6');
internas.addSubnet('fc00::', 7, 'ipv6');
internas.addSubnet('fe80::', 10, 'ipv6');

function esDireccionInterna(host) {
  const familia = net.isIPv6(host) ? 'ipv6' : 'ipv4';
  return internas.check(host, familia);
}

const comercios = new Map();

function validarUrlNotificacion(valor) {
  let url;
  try {
    url = new URL(valor);
  } catch (e) {
    return { ok: false, error: 'url invalida' };
  }
  if (url.protocol !== 'https:') {
    return { ok: false, error: 'solo https' };
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost') {
    return { ok: false, error: 'destino interno' };
  }
  if (net.isIP(host) && esDireccionInterna(host)) {
    return { ok: false, error: 'destino interno' };
  }
  return { ok: true, url: url.toString() };
}

function registrarComercio(comercio, urlNotificacion) {
  const resultado = validarUrlNotificacion(urlNotificacion);
  if (!resultado.ok) return resultado;
  comercios.set(comercio, resultado.url);
  return { ok: true, comercio, url: resultado.url };
}

function urlDeComercio(comercio) {
  return comercios.get(comercio) || null;
}

module.exports = { validarUrlNotificacion, registrarComercio, urlDeComercio };
