```javascript
const API_URL = "https://script.google.com/macros/s/AKfycbyBseYyHhoEhDK_qdhBBU_sHwxvqfLEBqjdQvV2vrnNe_IYIUdxRF6xYLagEEElYhqw/exec";

const STORAGE_USUARIO = "usuarioAutenticado";

const elementos = {
  pantallaLogin: document.getElementById("pantallaLogin"),
  areaPrincipal: document.getElementById("areaPrincipal"),
  formLogin: document.getElementById("formLogin"),
  formSolicitud: document.getElementById("formSolicitud"),
  correo: document.getElementById("correo"),
  pin: document.getElementById("pin"),
  tipoSolicitud: document.getElementById("tipoSolicitud"),
  titulo: document.getElementById("titulo"),
  descripcion: document.getElementById("descripcion"),
  prioridad: document.getElementById("prioridad"),
  btnLogin: document.getElementById("btnLogin"),
  btnGuardarSolicitud: document.getElementById("btnGuardarSolicitud"),
  btnActualizar: document.getElementById("btnActualizar"),
  btnCerrarSesion: document.getElementById("btnCerrarSesion"),
  btnImprimir: document.getElementById("btnImprimir"),
  textoUsuarioAutenticado: document.getElementById("textoUsuarioAutenticado"),
  mensajeCarga: document.getElementById("mensajeCarga"),
  mensajeExito: document.getElementById("mensajeExito"),
  mensajeError: document.getElementById("mensajeError"),
  cuerpoTablaSolicitudes: document.getElementById("cuerpoTablaSolicitudes")
};

document.addEventListener("DOMContentLoaded", iniciarAplicacion);

function iniciarAplicacion() {
  elementos.formLogin.addEventListener("submit", manejarLogin);
  elementos.formSolicitud.addEventListener("submit", manejarCrearSolicitud);
  elementos.btnActualizar.addEventListener("click", listarSolicitudes);
  elementos.btnCerrarSesion.addEventListener("click", cerrarSesion);
  elementos.btnImprimir.addEventListener("click", imprimirGuardarPDF);

  const usuarioGuardado = obtenerUsuarioSesion();

  if (usuarioGuardado) {
    mostrarAreaPrincipal(usuarioGuardado);
    listarSolicitudes();
  } else {
    mostrarPantallaLogin();
  }
}

async function manejarLogin(evento) {
  evento.preventDefault();
  ocultarMensajes();

  const correo = elementos.correo.value.trim();
  const pin = elementos.pin.value.trim();

  if (!correo || !pin) {
    mostrarError("Ingresa el correo y el PIN.");
    return;
  }

  if (!validarAPIURL()) {
    return;
  }

  try {
    establecerCargando(true, "Validando usuario...");

    const respuesta = await enviarPeticion({
      accion: "login",
      correo,
      pin
    });

    if (!respuesta.ok || !respuesta.usuario) {
      throw new Error(respuesta.mensaje || "Correo o PIN incorrecto.");
    }

    const usuario = normalizarUsuario(respuesta.usuario);

    if (!usuario.idUsuario || !usuario.nombre || !usuario.correo) {
      throw new Error("La respuesta del servidor no contiene los datos completos del usuario.");
    }

    sessionStorage.setItem(STORAGE_USUARIO, JSON.stringify(usuario));

    elementos.formLogin.reset();
    mostrarAreaPrincipal(usuario);
    mostrarExito("Ingreso correcto.");
    await listarSolicitudes();
  } catch (error) {
    mostrarError(error.message || "No fue posible iniciar sesión.");
  } finally {
    establecerCargando(false);
  }
}

async function manejarCrearSolicitud(evento) {
  evento.preventDefault();
  ocultarMensajes();

  const usuario = obtenerUsuarioSesion();

  if (!usuario) {
    cerrarSesion();
    mostrarError("La sesión no está activa. Ingresa nuevamente.");
    return;
  }

  if (!validarFormularioSolicitud()) {
    return;
  }

  if (!validarAPIURL()) {
    return;
  }

  try {
    establecerCargando(true, "Guardando solicitud...");

    const respuesta = await enviarPeticion({
      accion: "crearSolicitud",
      idUsuario: usuario.idUsuario,
      solicitante: usuario.nombre,
      correo: usuario.correo,
      tipoSolicitud: elementos.tipoSolicitud.value.trim(),
      titulo: elementos.titulo.value.trim(),
      descripcion: elementos.descripcion.value.trim(),
      prioridad: elementos.prioridad.value.trim()
    });

    if (!respuesta.ok) {
      throw new Error(respuesta.mensaje || "No fue posible guardar la solicitud.");
    }

    elementos.formSolicitud.reset();
    mostrarExito("Solicitud registrada correctamente.");
    await listarSolicitudes();
  } catch (error) {
    mostrarError(error.message || "No fue posible guardar la solicitud.");
  } finally {
    establecerCargando(false);
  }
}

async function listarSolicitudes() {
  ocultarMensajes();

  const usuario = obtenerUsuarioSesion();

  if (!usuario) {
    cerrarSesion();
    return;
  }

  if (!validarAPIURL()) {
    return;
  }

  try {
    establecerCargando(true, "Consultando solicitudes...");

    const respuesta = await enviarPeticion({
      accion: "listarSolicitudes",
      idUsuario: usuario.idUsuario,
      correo: usuario.correo
    });

    if (!respuesta.ok) {
      throw new Error(respuesta.mensaje || "No fue posible consultar las solicitudes.");
    }

    const solicitudes = Array.isArray(respuesta.solicitudes) ? respuesta.solicitudes : [];
    construirTablaSolicitudes(solicitudes);
  } catch (error) {
    construirTablaSolicitudes([]);
    mostrarError(error.message || "No fue posible consultar las solicitudes.");
  } finally {
    establecerCargando(false);
  }
}

async function enviarPeticion(datos) {
  const parametros = new URLSearchParams();

  Object.keys(datos).forEach((clave) => {
    parametros.append(clave, datos[clave] ?? "");
  });

  const respuesta = await fetch(API_URL, {
    method: "POST",
    body: parametros
  });

  const texto = await respuesta.text();

  if (!respuesta.ok) {
    throw new Error("Error de conexión con el servidor.");
  }

  let datosRespuesta;

  try {
    datosRespuesta = JSON.parse(texto);
  } catch (error) {
    throw new Error("La respuesta del servidor no tiene formato JSON válido.");
  }

  return normalizarRespuesta(datosRespuesta);
}

function normalizarRespuesta(respuesta) {
  const ok = respuesta.ok === true || respuesta.exito === true || respuesta.success === true;

  return {
    ok,
    mensaje: respuesta.mensaje || respuesta.message || "",
    usuario: respuesta.usuario || respuesta.data?.usuario || null,
    solicitudes: respuesta.solicitudes || respuesta.data?.solicitudes || []
  };
}

function normalizarUsuario(usuario) {
  return {
    idUsuario: String(usuario.idUsuario || "").trim(),
    nombre: String(usuario.nombre || "").trim(),
    correo: String(usuario.correo || "").trim()
  };
}

function validarFormularioSolicitud() {
  const tipoSolicitud = elementos.tipoSolicitud.value.trim();
  const titulo = elementos.titulo.value.trim();
  const descripcion = elementos.descripcion.value.trim();
  const prioridad = elementos.prioridad.value.trim();

  if (!tipoSolicitud || !titulo || !descripcion || !prioridad) {
    mostrarError("Completa todos los campos de la solicitud.");
    return false;
  }

  return true;
}

function validarAPIURL() {
  if (!API_URL || API_URL === "PEGAR_AQUI_LA_URL_DE_APPS_SCRIPT") {
    mostrarError("Configura la URL de Google Apps Script en API_URL.");
    return false;
  }

  return true;
}

function construirTablaSolicitudes(solicitudes) {
  elementos.cuerpoTablaSolicitudes.innerHTML = "";

  if (!solicitudes.length) {
    const fila = document.createElement("tr");
    fila.id = "filaSinSolicitudes";

    const celda = document.createElement("td");
    celda.colSpan = 10;
    celda.textContent = "No existen solicitudes registradas.";

    fila.appendChild(celda);
    elementos.cuerpoTablaSolicitudes.appendChild(fila);
    return;
  }

  solicitudes.forEach((solicitud) => {
    const fila = document.createElement("tr");

    const campos = [
      "idSolicitud",
      "fechaRegistro",
      "idUsuario",
      "solicitante",
      "correo",
      "tipoSolicitud",
      "titulo",
      "descripcion",
      "prioridad",
      "estado"
    ];

    campos.forEach((campo) => {
      const celda = document.createElement("td");
      celda.textContent = solicitud[campo] ?? "";
      fila.appendChild(celda);
    });

    elementos.cuerpoTablaSolicitudes.appendChild(fila);
  });
}

function mostrarPantallaLogin() {
  elementos.pantallaLogin.hidden = false;
  elementos.areaPrincipal.hidden = true;
  ocultarMensajes();
}

function mostrarAreaPrincipal(usuario) {
  elementos.pantallaLogin.hidden = true;
  elementos.areaPrincipal.hidden = false;
  elementos.textoUsuarioAutenticado.textContent = `${usuario.nombre} | ${usuario.correo}`;
}

function cerrarSesion() {
  sessionStorage.removeItem(STORAGE_USUARIO);
  elementos.formLogin.reset();
  elementos.formSolicitud.reset();
  construirTablaSolicitudes([]);
  mostrarPantallaLogin();
}

function obtenerUsuarioSesion() {
  const datos = sessionStorage.getItem(STORAGE_USUARIO);

  if (!datos) {
    return null;
  }

  try {
    return JSON.parse(datos);
  } catch (error) {
    sessionStorage.removeItem(STORAGE_USUARIO);
    return null;
  }
}

function imprimirGuardarPDF() {
  ocultarMensajes();
  window.print();
}

function establecerCargando(estado, mensaje = "Procesando información...") {
  elementos.mensajeCarga.textContent = mensaje;
  elementos.mensajeCarga.hidden = !estado;

  elementos.btnLogin.disabled = estado;
  elementos.btnGuardarSolicitud.disabled = estado;
  elementos.btnActualizar.disabled = estado;
  elementos.btnCerrarSesion.disabled = estado;
  elementos.btnImprimir.disabled = estado;
}

function ocultarMensajes() {
  elementos.mensajeCarga.hidden = true;
  elementos.mensajeExito.hidden = true;
  elementos.mensajeError.hidden = true;
}

function mostrarExito(mensaje) {
  elementos.mensajeExito.textContent = mensaje;
  elementos.mensajeExito.hidden = false;
  elementos.mensajeError.hidden = true;
}

function mostrarError(mensaje) {
  elementos.mensajeError.textContent = mensaje;
  elementos.mensajeError.hidden = false;
  elementos.mensajeExito.hidden = true;
}
```
