import { createClient } from '@supabase/supabase-js';
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

// 司机账号
const drivers = [
  { email: 'driver1@kennedy.test', name: '张师傅' },
  { email: 'driver2@kennedy.test', name: '李师傅' },
  { email: 'driver3@kennedy.test', name: '王师傅' },
  { email: 'driver4@kennedy.test', name: '陈师傅' },
  { email: 'driver5@kennedy.test', name: '刘师傅' },
];

// 调度员 + 管理员
const staff = [
  { email: 'admin@kennedy.test', name: '总管理员', role: 'admin', password: 'admin123' },
  { email: 'dispatch@kennedy.test', name: '调度员', role: 'dispatcher', password: 'dispatch123' },
];

async function ensureUser(email, password) {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
  let user = list.users.find(u => u.email === email);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
    });
    if (error) throw error;
    user = data.user;
    console.log('Created', email);
  } else {
    // 强制重置密码并确认邮箱
    await admin.auth.admin.updateUserById(user.id, { password, email_confirm: true });
    console.log('Updated', email);
  }
  return user;
}

async function setRole(userId, role) {
  await admin.from('user_roles').upsert({ user_id: userId, role }, { onConflict: 'user_id,role' });
}

for (const d of drivers) {
  const u = await ensureUser(d.email, 'driver123');
  // 绑定到 profiles
  await admin.from('profiles').update({ auth_user_id: u.id }).eq('email', d.email);
  await setRole(u.id, 'driver');
}

for (const s of staff) {
  const u = await ensureUser(s.email, s.password);
  // 创建 profile
  const { data: existing } = await admin.from('profiles').select('id').eq('email', s.email).maybeSingle();
  if (!existing) {
    await admin.from('profiles').insert({ name: s.name, email: s.email, role: 'staff', auth_user_id: u.id });
  } else {
    await admin.from('profiles').update({ auth_user_id: u.id, name: s.name }).eq('email', s.email);
  }
  await setRole(u.id, s.role);
  // dispatcher 同时也是 admin? 不,只赋 dispatcher
}

// admin 也应该能干 dispatcher 的活
const { data: adminList } = await admin.auth.admin.listUsers({ perPage: 200 });
const adminUser = adminList.users.find(u => u.email === 'admin@kennedy.test');
if (adminUser) await setRole(adminUser.id, 'dispatcher');

console.log('Done');
