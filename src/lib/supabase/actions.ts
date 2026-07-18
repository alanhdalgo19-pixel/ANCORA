"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface LoginInput {
  email: string;
  password: string;
}

interface LoginResult {
  error: string;
}

/**
 * El mensaje "email no registrado" se resuelve consultando la tabla
 * `usuarios` (la lista real de usuarios del sistema) ANTES de intentar
 * autenticar contra Supabase Auth, que por diseño nunca distingue "email
 * inexistente" de "contraseña incorrecta" en signInWithPassword.
 *
 * Con RLS activado (CLAUDE.md sección 13) esta consulta ya no puede hacerse
 * con la clave anónima: un usuario sin sesión no tiene fila en `usuarios`
 * desde la que resolver get_user_rol(), así que ninguna política le
 * dejaría ver nada. Se usa el cliente admin (service_role) para este único
 * pre-check, que se ejecuta siempre en servidor.
 */
export async function login({
  email,
  password,
}: LoginInput): Promise<LoginResult | void> {
  const emailNormalizado = email.trim().toLowerCase();
  const supabaseAdmin = createAdminClient();

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("activo")
    .eq("email", emailNormalizado)
    .maybeSingle();

  if (!usuario) {
    return { error: "Este email no está registrado en el sistema" };
  }

  if (!usuario.activo) {
    return { error: "Usuario desactivado, contacta con el administrador" };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: emailNormalizado,
    password,
  });

  if (error) {
    return { error: "Credenciales incorrectas" };
  }

  redirect("/");
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
