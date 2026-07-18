"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
 */
export async function login({
  email,
  password,
}: LoginInput): Promise<LoginResult | void> {
  const emailNormalizado = email.trim().toLowerCase();
  const supabase = createClient();

  const { data: usuario } = await supabase
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
