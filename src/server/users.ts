import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AppRole = "admin" | "dispatcher" | "driver";

// 调用者必须是 admin 才能用
async function ensureAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((x) => x.role);
  if (!roles.includes("admin")) throw new Error("只有管理员可以执行此操作");
}

// 创建司机或调度账号
export const createStaffOrDriverUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      email: string;
      password: string;
      name: string;
      phone?: string;
      role: AppRole;
    }) => {
      if (!input.email?.includes("@")) throw new Error("邮箱无效");
      if (!input.password || input.password.length < 6)
        throw new Error("密码至少 6 位");
      if (!input.name?.trim()) throw new Error("姓名必填");
      if (!["admin", "dispatcher", "driver"].includes(input.role))
        throw new Error("角色无效");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    console.log("[CreateUser] Starting creation for:", data.email, "role:", data.role);

    // 1. 创建 auth user
    const { data: created, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (authErr) {
      console.error("[CreateUser] Auth error:", authErr.message);
      throw new Error(authErr.message);
    }
    const newUserId = created.user!.id;
    console.log("[CreateUser] Auth user created ID:", newUserId);

    // 2. 创建 profile
    const profileRole: "staff" | "driver" = data.role === "driver" ? "driver" : "staff";
    const { error: pErr } = await supabaseAdmin.from("profiles").insert({
      name: data.name.trim(),
      email: data.email,
      phone: data.phone || null,
      role: profileRole,
      auth_user_id: newUserId,
    });
    if (pErr) {
      console.error("[CreateUser] Profile insert error:", pErr.message);
      throw new Error(pErr.message);
    }
    console.log("[CreateUser] Profile created for:", newUserId);

    // 3. 角色
    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: newUserId, role: data.role },
        { onConflict: "user_id,role" },
      );
    if (rErr) {
      console.error("[CreateUser] Role assign error:", rErr.message);
    } else {
      console.log("[CreateUser] Role assigned successfully");
    }

    return { ok: true, user_id: newUserId };
  });

// 修改角色 (增加或删除)
export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { user_id: string; role: AppRole; enabled: boolean }) => input,
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    if (data.enabled) {
      await supabaseAdmin
        .from("user_roles")
        .upsert(
          { user_id: data.user_id, role: data.role },
          { onConflict: "user_id,role" },
        );
    } else {
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.user_id)
        .eq("role", data.role);
    }
    return { ok: true };
  });

// 重置密码
export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { user_id: string; password: string }) => {
    if (!input.password || input.password.length < 6) throw new Error("密码至少 6 位");
    return input;
  })
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// 启用/禁用 profile
export const toggleProfileActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { profile_id: string; is_active: boolean }) => input)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ is_active: data.is_active })
      .eq("id", data.profile_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// 为历史数据里没有 auth 登录凭证的老 profile 补建 auth 账号
export const bindAuthToProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { profile_id: string; email: string; password: string; role: AppRole }) => {
      if (!input.email?.includes("@")) throw new Error("邮箱无效");
      if (!input.password || input.password.length < 6) throw new Error("密码至少 6 位");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    console.log("[BindAuth] Binding auth to profile:", data.profile_id, "email:", data.email);

    // 检查 profile 是否已经有绑定
    const { data: profile, error: pFetchErr } = await supabaseAdmin
      .from("profiles")
      .select("id, auth_user_id, email")
      .eq("id", data.profile_id)
      .single();
    if (pFetchErr) {
      console.error("[BindAuth] Profile fetch error:", pFetchErr.message);
      throw new Error(pFetchErr.message);
    }
    if (profile.auth_user_id) throw new Error("该用户已经绑定了登录账号");

    // 1. 创建 auth user
    const { data: created, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (authErr) {
      console.error("[BindAuth] Auth creation error:", authErr.message);
      throw new Error(authErr.message);
    }
    const newUserId = created.user!.id;
    console.log("[BindAuth] Auth user created ID:", newUserId);

    // 2. 回写 auth_user_id 到 profiles
    const { error: updateErr } = await supabaseAdmin
      .from("profiles")
      .update({ auth_user_id: newUserId, email: data.email })
      .eq("id", data.profile_id);
    if (updateErr) {
      console.error("[BindAuth] Profile update error:", updateErr.message);
      throw new Error(updateErr.message);
    }
    console.log("[BindAuth] Profile updated with auth_user_id");

    // 3. 分配角色
    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: newUserId, role: data.role },
        { onConflict: "user_id,role" },
      );
    if (rErr) {
      console.error("[BindAuth] Role assign error:", rErr.message);
    } else {
      console.log("[BindAuth] Role assigned successfully");
    }

    return { ok: true, user_id: newUserId };
  });
