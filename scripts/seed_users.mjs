// Crea los usuarios iniciales del sistema: una cuenta en Supabase Auth y su
// fila correspondiente en la tabla `usuarios`. Idempotente: se puede
// ejecutar varias veces sin duplicar nada.
//
// Uso: npm run seed:users
//
// Nota: se usa `fetch` directo contra la API de Supabase (Auth Admin + REST)
// en lugar del SDK @supabase/supabase-js. El SDK inicializa un cliente
// Realtime que requiere WebSocket nativo, no disponible en Node 20 sin el
// paquete "ws"; este script no necesita Realtime, así que evitamos esa
// dependencia extra.

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.resolve(__dirname, "..", ".env.local");

function cargarEnvLocal(rutaArchivo) {
  if (!existsSync(rutaArchivo)) return;
  const contenido = readFileSync(rutaArchivo, "utf-8");
  for (const linea of contenido.split("\n")) {
    const coincidencia = linea.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!coincidencia) continue;
    const [, clave, valorBruto] = coincidencia;
    if (!(clave in process.env)) {
      process.env[clave] = valorBruto.trim();
    }
  }
}

cargarEnvLocal(ENV_PATH);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local",
  );
  process.exit(1);
}

const AUTH_HEADERS = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

async function fetchJson(url, options) {
  const respuesta = await fetch(url, options);
  const texto = await respuesta.text();
  const cuerpo = texto ? JSON.parse(texto) : null;
  if (!respuesta.ok) {
    const mensaje =
      cuerpo?.msg || cuerpo?.message || cuerpo?.error_description || texto;
    throw new Error(`${respuesta.status} ${respuesta.statusText}: ${mensaje}`);
  }
  return cuerpo;
}

async function buscarUsuarioAuthPorEmail(email) {
  const perPage = 200;
  let page = 1;

  for (;;) {
    const { users } = await fetchJson(
      `${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=${perPage}`,
      { headers: AUTH_HEADERS },
    );
    const encontrado = users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );
    if (encontrado) return encontrado;
    if (users.length < perPage) return null;
    page += 1;
  }
}

async function crearUsuarioAuth({ email, password }) {
  return fetchJson(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: AUTH_HEADERS,
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
}

async function buscarFilaUsuarioPorEmail(email) {
  const filas = await fetchJson(
    `${SUPABASE_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}&select=id`,
    { headers: AUTH_HEADERS },
  );
  return filas[0] ?? null;
}

async function crearFilaUsuario({ id, nombre, email, rol }) {
  await fetchJson(`${SUPABASE_URL}/rest/v1/usuarios`, {
    method: "POST",
    headers: { ...AUTH_HEADERS, Prefer: "return=minimal" },
    body: JSON.stringify({ id, nombre, email, rol, activo: true }),
  });
}

const USUARIOS_INICIALES = [
  {
    nombre: "Alan Hidalgo",
    email: "alan.hdalgo19@gmail.com",
    password: "ancora2026",
    rol: "admin",
  },
  {
    nombre: "Esperanza",
    email: "esperanza@ancora.local",
    password: "ancora2026",
    rol: "admin",
  },
  {
    nombre: "Sonia",
    email: "sonia@ancora.local",
    password: "ancora2026",
    rol: "operador",
  },
  {
    nombre: "Mohamed",
    email: "mohamed@ancora.local",
    password: "ancora2026",
    rol: "admin",
  },
];

async function main() {
  let creados = 0;
  let existentes = 0;

  for (const definicion of USUARIOS_INICIALES) {
    const filaExistente = await buscarFilaUsuarioPorEmail(definicion.email);

    if (filaExistente) {
      console.log(`Ya existía: ${definicion.email}`);
      existentes += 1;
      continue;
    }

    let usuarioAuth;
    try {
      usuarioAuth = await buscarUsuarioAuthPorEmail(definicion.email);
      if (!usuarioAuth) {
        usuarioAuth = await crearUsuarioAuth(definicion);
      }
    } catch (error) {
      console.error(
        `Error con la cuenta Auth de "${definicion.email}": ${error.message}`,
      );
      continue;
    }

    try {
      await crearFilaUsuario({
        id: usuarioAuth.id,
        nombre: definicion.nombre,
        email: definicion.email,
        rol: definicion.rol,
      });
    } catch (error) {
      console.error(
        `Error insertando "${definicion.email}" en tabla usuarios: ${error.message}`,
      );
      continue;
    }

    console.log(
      `Creado: ${definicion.nombre} (${definicion.email}) — rol ${definicion.rol}`,
    );
    creados += 1;
  }

  console.log(`\n${creados} usuarios creados, ${existentes} ya existían.`);
}

main().catch((error) => {
  console.error("Error inesperado:", error);
  process.exit(1);
});
